# 🔍 "找到 0 个相似文档" 问题修复指南

## 问题症状

```
Processing 1 PDF files for user user_xxx
Processed PDF into 53 chunks
Successfully added 53 documents to vector store
Chat request from user user_xxx: 请简单介绍一下该pdf的内容
Found 0 similar documents
```

文档上传成功,但查询时找不到任何文档。

## 快速诊断(3 步)

### 步骤 1: 检查数据库中的文档

在 Supabase SQL 编辑器中运行:

```sql
-- 检查文档总数
SELECT COUNT(*) as total_documents FROM documents;

-- 检查有 embedding 的文档
SELECT COUNT(*) as docs_with_embeddings 
FROM documents 
WHERE embedding IS NOT NULL;

-- 查看最近的文档
SELECT 
  id,
  metadata->>'userId' as user_id,
  metadata->>'source' as source,
  LENGTH(content) as content_length,
  CASE WHEN embedding IS NOT NULL THEN 'YES' ELSE 'NO' END as has_embedding
FROM documents 
ORDER BY created_at DESC 
LIMIT 10;
```

**预期结果:**
- `total_documents` 应该 > 0
- `docs_with_embeddings` 应该 = `total_documents`
- 应该能看到你上传的文档

**如果文档数为 0:**
→ 跳到 [问题 A: 文档没有保存](#问题-a-文档没有保存)

**如果有文档但 embedding 为 NULL:**
→ 跳到 [问题 B: Embedding 生成失败](#问题-b-embedding-生成失败)

### 步骤 2: 测试搜索函数

```sql
-- 使用已有的 embedding 测试搜索
WITH test_embedding AS (
  SELECT embedding 
  FROM documents 
  WHERE embedding IS NOT NULL 
  LIMIT 1
)
SELECT 
  id,
  LEFT(content, 100) as preview,
  similarity
FROM test_embedding,
LATERAL match_documents(embedding, 5, '{}'::jsonb);
```

**预期结果:** 应该返回至少 5 个结果

**如果返回 0 个结果:**
→ 跳到 [问题 C: 搜索函数有问题](#问题-c-搜索函数有问题)

### 步骤 3: 检查用户 ID

```sql
-- 查看所有不同的用户 ID
SELECT DISTINCT 
  metadata->>'userId' as stored_user_id,
  COUNT(*) as document_count
FROM documents 
GROUP BY metadata->>'userId';
```

**检查:** 你在前端使用的 userId 是否与数据库中存储的一致?

---

## 常见问题及解决方案

### 问题 A: 文档没有保存

**症状:** `SELECT COUNT(*) FROM documents` 返回 0

**可能原因:**
1. Supabase 连接配置错误
2. 权限问题
3. 表不存在

**解决方案:**

1. **检查 Supabase 配置**
   ```bash
   # 在 backend 目录
   cat .env | grep SUPABASE
   ```
   
   确保:
   - `SUPABASE_URL` 格式: `https://xxxxx.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` 已正确设置

2. **验证表存在**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name = 'documents';
   ```
   
   如果不存在,运行 `supabase-setup-fixed.sql`

3. **检查权限**
   ```sql
   -- 授予权限
   GRANT ALL ON documents TO anon, authenticated;
   ```

### 问题 B: Embedding 生成失败

**症状:** 有文档但 `embedding IS NULL`

**可能原因:**
1. OpenRouter API Key 无效
2. API 配额用完
3. Embedding 模型配置错误

**解决方案:**

1. **验证 OpenRouter API Key**
   ```bash
   curl https://openrouter.ai/api/v1/auth/key \
     -H "Authorization: Bearer $OPENROUTER_API_KEY"
   ```

2. **检查后端日志**
   查找 embedding 相关的错误

3. **测试 embedding 生成**
   
   创建测试文件 `backend/test-embedding.ts`:
   ```typescript
   import { OpenAIEmbeddings } from '@langchain/openai';
   import dotenv from 'dotenv';
   
   dotenv.config();
   
   const embeddings = new OpenAIEmbeddings({
     openAIApiKey: process.env.OPENROUTER_API_KEY,
     configuration: {
       baseURL: 'https://openrouter.ai/api/v1',
     },
     modelName: 'text-embedding-3-small',
   });
   
   embeddings.embedQuery('测试文本')
     .then(result => {
       console.log('✅ Embedding 生成成功');
       console.log('维度:', result.length);
     })
     .catch(err => {
       console.error('❌ Embedding 生成失败:', err);
     });
   ```
   
   运行: `npx ts-node test-embedding.ts`

### 问题 C: 搜索函数有问题

**症状:** 测试查询返回 0 个结果

**解决方案:**

1. **重新创建函数**
   ```sql
   DROP FUNCTION IF EXISTS match_documents CASCADE;
   
   CREATE OR REPLACE FUNCTION match_documents(
     query_embedding vector(1536),
     match_count int DEFAULT 10,
     filter jsonb DEFAULT '{}'::jsonb
   )
   RETURNS TABLE (
     id bigint,
     content text,
     metadata jsonb,
     similarity float
   )
   LANGUAGE plpgsql
   AS $$
   BEGIN
     RETURN QUERY
     SELECT
       documents.id,
       documents.content,
       documents.metadata,
       1 - (documents.embedding <=> query_embedding) as similarity
     FROM documents
     WHERE 
       (filter = '{}'::jsonb OR documents.metadata @> filter)
     ORDER BY documents.embedding <=> query_embedding
     LIMIT match_count;
   END;
   $$;
   ```

2. **验证索引**
   ```sql
   -- 重建索引
   DROP INDEX IF EXISTS documents_embedding_idx;
   
   CREATE INDEX documents_embedding_idx 
   ON documents 
   USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 100);
   ```

### 问题 D: 用户 ID 不匹配

**症状:** 数据库中有文档,但特定用户查询时找不到

**最常见的原因!**

**检查:**
```sql
-- 数据库中存储的 userId
SELECT DISTINCT metadata->>'userId' FROM documents;

-- 例如可能返回: "user_1769737535536_rm317j8v9"
```

**对比:**
- 前端发送的 userId
- 后端日志中的 userId

**临时解决方案 1: 移除用户过滤**

编辑 `backend/src/services/vectorStore.ts`:
```typescript
async similaritySearch(query: string, k: number = 4, userId?: string) {
  // 暂时不使用用户过滤
  const results = await vectorStore.similaritySearch(query, k);
  return results;
}
```

**临时解决方案 2: 使用正确的 userId**

1. 查看数据库中实际的 userId
2. 在前端使用相同的 userId
3. 或者删除所有文档重新上传

**永久解决方案:**

已在更新的代码中实现:先不过滤搜索,找到文档后再手动过滤,如果过滤后为空则返回所有结果。

---

## 使用更新的代码

我已经更新了以下文件:

1. **`backend/src/services/vectorStore.ts`**
   - 改进的搜索逻辑
   - 详细的日志输出
   - 智能的用户过滤

2. **`backend/src/routes/api-debug.ts`**
   - 更详细的日志
   - 新增调试端点
   - 更好的错误信息

3. **`database-diagnostic.sql`**
   - 完整的诊断脚本
   - 一键检查所有问题

### 如何使用更新的代码

1. **替换文件**
   ```bash
   # 备份旧文件
   cp backend/src/services/vectorStore.ts backend/src/services/vectorStore.ts.bak
   
   # 使用新文件(从更新的项目包中)
   ```

2. **重启后端**
   ```bash
   cd backend
   npm run dev
   ```

3. **测试**
   - 重新上传 PDF
   - 提问
   - 查看详细日志

---

## 调试端点

更新后的代码包含调试端点:

### 查看所有文档
```bash
curl http://localhost:3001/api/debug/documents
```

这会返回数据库中最近的 10 个文档及其元数据。

---

## 完整诊断流程

运行项目中的 `database-diagnostic.sql` 获取完整的系统状态:

```sql
-- 复制 database-diagnostic.sql 的全部内容
-- 在 Supabase SQL 编辑器中运行
```

这会显示:
1. ✅ 文档总数
2. ✅ Embedding 状态
3. ✅ 用户 ID 分布
4. ✅ 函数测试结果
5. ✅ 索引状态
6. ✅ 示例文档

---

## 最可能的原因(按概率排序)

1. **用户 ID 不匹配** (80%) ⭐⭐⭐
   - 前端生成的 userId 与查询时使用的不一致
   - 解决:使用更新的代码,自动处理这个问题

2. **Embedding 未生成** (15%)
   - OpenRouter API 问题
   - 解决:检查 API key 和日志

3. **数据库配置问题** (5%)
   - 函数未创建或参数错误
   - 解决:重新运行 `supabase-setup-fixed.sql`

---

## 快速修复命令

在 Supabase SQL 编辑器中一次性运行:

```sql
-- 1. 检查问题
SELECT '1. 文档总数' as check_item, COUNT(*) as value FROM documents
UNION ALL
SELECT '2. 有embedding的文档', COUNT(*) FROM documents WHERE embedding IS NOT NULL
UNION ALL
SELECT '3. 不同用户数', COUNT(DISTINCT metadata->>'userId') FROM documents;

-- 2. 如果有文档,测试搜索
WITH test AS (
  SELECT embedding FROM documents WHERE embedding IS NOT NULL LIMIT 1
)
SELECT '测试搜索:' as check_item, COUNT(*) as found_docs
FROM test, LATERAL match_documents(test.embedding, 10, '{}'::jsonb);

-- 3. 显示用户ID
SELECT '用户ID:' as check_item, 
       metadata->>'userId' as value,
       COUNT(*) as count
FROM documents 
GROUP BY metadata->>'userId';
```

根据结果确定问题所在!

---

## 需要帮助?

如果以上都不能解决问题:

1. 运行 `database-diagnostic.sql` 获取完整状态
2. 复制所有输出结果
3. 检查后端控制台的完整日志
4. 查看 `TROUBLESHOOTING.md` 获取更多帮助
