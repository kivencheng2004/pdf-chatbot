# PDF 聊天机器人

一个基于 OpenRouter API 和 Supabase 向量数据库的 PDF 聊天机器人应用。用户可以上传 PDF 文档,系统会自动提取文本并存储到向量数据库中,然后用户可以通过自然语言与文档进行交互式问答。

## 功能特点

- 📄 **PDF 文档上传** - 支持批量上传多个 PDF 文件
- 🔍 **智能检索** - 使用向量相似度搜索找到最相关的文档内容
- 💬 **实时对话** - 支持流式响应,实时显示 AI 回答
- 📚 **来源追踪** - 显示答案来源的具体文档片段
- 🗑️ **文档管理** - 可以清空已上传的文档
- 👤 **用户隔离** - 每个用户的文档独立存储

## 技术栈

### 后端
- **Node.js + TypeScript** - 服务端运行环境
- **Express** - Web 框架
- **LangChain** - AI 应用开发框架
- **OpenRouter API** - LLM 服务提供商(支持多种模型)
- **Supabase** - 向量数据库
- **pdf-parse** - PDF 文本提取

### 前端
- **Next.js 14** - React 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架
- **Lucide React** - 图标库

## 项目结构

```
pdf-chatbot/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── services/       # 业务逻辑层
│   │   │   ├── vectorStore.ts    # 向量数据库服务
│   │   │   ├── pdf.ts            # PDF 处理服务
│   │   │   └── chat.ts           # 聊天服务
│   │   ├── routes/         # API 路由
│   │   │   └── api.ts
│   │   └── index.ts        # 入口文件
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── frontend/               # 前端应用
    ├── src/
    │   ├── app/           # Next.js 应用
    │   │   ├── page.tsx   # 主页面
    │   │   ├── layout.tsx # 布局
    │   │   └── globals.css
    │   ├── components/    # React 组件
    │   │   ├── ChatMessage.tsx
    │   │   └── FileUpload.tsx
    │   └── lib/          # 工具函数
    │       ├── api.ts    # API 客户端
    │       └── utils.ts  # 通用工具
    ├── package.json
    ├── next.config.js
    └── .env.example
```

## 快速开始

### 前置要求

1. **Node.js** (v18 或更高版本)
2. **Supabase 账号** - 用于向量数据库
3. **OpenRouter API Key** - 用于 LLM 服务

### Supabase 设置

1. 创建 Supabase 项目
2. 在 SQL 编辑器中运行以下 SQL 创建必要的表和函数:

\`\`\`sql
-- 启用 pgvector 扩展
create extension if not exists vector;

-- 创建文档表
create table documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(1536)
);

-- 创建索引以加速向量搜索
create index on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 创建相似度搜索函数
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
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
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
\`\`\`

### 安装步骤

1. **克隆或下载项目**

2. **后端设置**

\`\`\`bash
cd backend

# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件,填入你的配置
# OPENROUTER_API_KEY=your-key
# SUPABASE_URL=your-url
# SUPABASE_SERVICE_ROLE_KEY=your-key
\`\`\`

3. **前端设置**

\`\`\`bash
cd frontend

# 安装依赖
npm install

# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件
# NEXT_PUBLIC_API_URL=http://localhost:3001
\`\`\`

### 运行项目

1. **启动后端服务**

\`\`\`bash
cd backend
npm run dev
\`\`\`

后端服务将运行在 `http://localhost:3001`

2. **启动前端应用**

\`\`\`bash
cd frontend
npm run dev
\`\`\`

前端应用将运行在 `http://localhost:3000`

3. **访问应用**

在浏览器中打开 `http://localhost:3000`

## 使用说明

1. **上传文档**
   - 点击"上传文档"按钮
   - 选择一个或多个 PDF 文件(最多 5 个,每个最大 10MB)
   - 点击"上传文件"按钮
   - 等待文档处理完成

2. **提问**
   - 在输入框中输入你的问题
   - 点击"发送"按钮或按 Enter 键
   - AI 会基于上传的文档内容回答你的问题

3. **查看来源**
   - 每个回答下方可以点击"查看来源"
   - 查看 AI 引用的具体文档片段

4. **清空文档**
   - 点击"清空文档"按钮
   - 确认后会删除所有已上传的文档

## API 端点

### POST /api/upload
上传 PDF 文件

**请求**
- Content-Type: multipart/form-data
- Body: files (array of PDF files), userId (optional)

**响应**
\`\`\`json
{
  "success": true,
  "message": "Successfully processed 2 file(s)",
  "documentsCreated": 45,
  "files": ["document1.pdf", "document2.pdf"]
}
\`\`\`

### POST /api/chat
发送聊天消息

**请求**
\`\`\`json
{
  "question": "这个文档讲了什么?",
  "userId": "user_123",
  "stream": false
}
\`\`\`

**响应**
\`\`\`json
{
  "answer": "这个文档主要讲述了...",
  "sources": [
    {
      "content": "文档片段内容...",
      "source": "document1.pdf"
    }
  ]
}
\`\`\`

### DELETE /api/documents
删除用户的所有文档

**请求**
\`\`\`json
{
  "userId": "user_123"
}
\`\`\`

## 环境变量说明

### 后端环境变量

\`\`\`env
# OpenRouter API 配置
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=anthropic/claude-3-sonnet  # 可选其他模型

# Supabase 配置
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 服务器配置
PORT=3001
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:3000
\`\`\`

### 前端环境变量

\`\`\`env
NEXT_PUBLIC_API_URL=http://localhost:3001
\`\`\`

## 自定义配置

### 修改 LLM 模型

在 `backend/.env` 中修改:
\`\`\`env
OPENROUTER_MODEL=anthropic/claude-3-sonnet
# 或者其他支持的模型,如:
# OPENROUTER_MODEL=openai/gpt-4
# OPENROUTER_MODEL=google/gemini-pro
\`\`\`

### 调整文本分块参数

在 `backend/src/services/pdf.ts` 中修改:
\`\`\`typescript
this.textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,      // 每个文本块的大小
  chunkOverlap: 200,    // 文本块之间的重叠
});
\`\`\`

### 修改检索数量

在 `backend/src/routes/api.ts` 中修改:
\`\`\`typescript
const relevantDocs = await vectorStoreService.similaritySearch(
  question,
  4,  // 检索的文档数量
  userId
);
\`\`\`

## 部署

### 后端部署

推荐使用以下平台:
- Railway
- Render
- Heroku
- AWS/Google Cloud/Azure

确保设置好所有环境变量。

### 前端部署

推荐使用 Vercel:
\`\`\`bash
cd frontend
vercel
\`\`\`

或者其他支持 Next.js 的平台。

## 常见问题

**Q: 为什么上传文档后无法搜索到内容?**
A: 确保 Supabase 中的表和函数已正确创建,检查环境变量是否正确配置。

**Q: 如何更改支持的文件大小限制?**
A: 在 `backend/src/routes/api.ts` 中修改 multer 配置的 `fileSize` 参数。

**Q: 可以使用其他向量数据库吗?**
A: 可以,需要修改 `vectorStore.ts` 中的实现,LangChain 支持多种向量数据库。

**Q: 如何提高搜索准确性?**
A: 可以调整文本分块大小、增加检索文档数量、或者尝试不同的 embedding 模型。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request!

## 致谢

本项目受到 [mayooear/ai-pdf-chatbot-langchain](https://github.com/mayooear/ai-pdf-chatbot-langchain) 的启发。
