# 📄 PDF Chatbot - 基于 RAG 的智能文档对话助手

一个基于 **OpenRouter API** 和 **Supabase 向量数据库** 构建的 PDF 智能问答系统。用户可以上传 PDF 文档，系统利用 **LangChain** 框架进行文档分块、向量化存储，并通过大语言模型实现精准的语义检索问答。

---

## ✨ 功能特点

* 📄 **PDF 文档上传** - 支持批量上传并自动提取文本。
* 🔍 **智能向量检索** - 使用 `pgvector` 进行语义搜索，即使没有完全匹配的关键词也能找到相关内容。
* 💬 **实时对话** - 支持流式响应，像使用 ChatGPT 一样与你的 PDF 对话。
* 📚 **来源追踪** - 每个回答都会标注引用的具体文档片段，确保回答有据可依。
* 👤 **用户隔离** - 每个用户的文档独立存储，互不干扰。

---

## 🛠️ 技术栈

### 前端

* **Next.js 14** (React 框架)
* **TypeScript** (类型安全)
* **Tailwind CSS** (样式框架)

### 后端

* **Node.js + Express**
* **LangChain** (AI 应用框架)
* **OpenRouter API** (LLM 服务)
* **Supabase** (向量数据库)

---

## 🚀 快速启动

### 1. 前置要求

* **Node.js** (v18 或更高版本)
* **Supabase** 账号
* **OpenRouter** API Key

### 2. Supabase 数据库设置

在 Supabase 的 **SQL Editor** 中运行以下脚本，初始化向量插件、数据表及核心搜索函数（已优化支持 LangChain 过滤）：

```sql
-- 1. 启用向量扩展
create extension if not exists vector;

-- 2. 创建文档存储表
create table documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(1536) -- 对应 OpenAI text-embedding-3-small 的维度
);

-- 3. 创建相似度匹配函数
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter jsonb default '{}'
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
    and (filter = '{}'::jsonb or metadata @> filter)
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;

```

### 3. 后端配置 (`/backend`)

1. 进入目录并安装依赖：
```bash
cd backend
npm install
npm i --save-dev @types/pdf-parse # 安装必要的类型定义

```


2. 创建 `.env` 文件并填写配置：
```env
OPENROUTER_API_KEY=你的OpenRouter密钥
SUPABASE_URL=你的Supabase地址
SUPABASE_SERVICE_ROLE_KEY=你的ServiceRole密钥
OPENROUTER_MODEL=openai/text-embedding-3-small # 建议使用的嵌入模型

```


3. 启动：`npm run dev`

### 4. 前端配置 (`/frontend`)

1. 进入目录并安装依赖：
```bash
cd frontend
npm install

```


2. 创建 `.env` 文件：
```env
NEXT_PUBLIC_API_URL=http://localhost:3001

```


3. 启动：`npm run dev`

---

## 💡 常见问题排查 (FAQ)

* **Q: 为什么上传成功后，提问返回 0 个结果？**
* **A**: 可能是相似度阈值设得太高。在 `vectorStore.ts` 中将 `match_threshold` 调低至 `0.5` 左右；或尝试输入更具体的“关键词”而非宽泛的总结性问题。


* **Q: 提示找不到 `match_documents` 函数？**
* **A**: 请确保你在 Supabase 中运行的是最新的 SQL 脚本。LangChain 需要该函数包含 `filter` 参数。


* **Q: 为什么会有 TypeScript 报错？**
* **A**: 请确保安装了 `@types/pdf-parse`，或者在 `src` 目录下添加 `types.d.ts` 手动声明模块。



---

## 📜 许可证

[MIT License](https://www.google.com/search?q=LICENSE)
