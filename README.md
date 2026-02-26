# 文档智能问答助手

一个基于 **OpenRouter API** 和 **Supabase 向量数据库** 构建的多格式文档智能问答系统。支持上传 PDF、Word、Excel、PowerPoint 等多种格式的文档，并通过大语言模型实现精准的语义检索问答。

---

## 功能特点

### 多格式文档支持
- **PDF** - PDF 文档
- **Word** - .doc, .docx 文档
- **Excel** - .xls, .xlsx 表格（自动转换为 Markdown 表格）
- **PowerPoint** - .ppt, .pptx 演示文稿
- **文本格式** - TXT, Markdown, CSV, JSON, HTML

### 智能问答功能
- **智能向量检索** - 使用 `pgvector` 进行语义搜索
- **实时流式对话** - 支持流式响应，实时显示回答
- **来源追踪** - 每个回答都会标注引用的具体文档片段
- **双模型架构** - 独立的 Embedding 模型和 Chat 模型

### 安全特性
- **提示词注入防护** - 使用安全的 System Prompt 设计，防止用户操纵 AI
- **敏感信息过滤** - 自动过滤 API Key、密码、身份证、银行卡等敏感信息
- **输出安全检查** - 防止 AI 意外泄露敏感配置信息
- **速率限制** - 防止 API 滥用（每15分钟100个请求）
- **安全响应头** - 使用 Helmet 中间件增强 HTTP 安全

---

## 技术栈

### 前端
- **Next.js 14** (React 框架)
- **TypeScript** (类型安全)
- **Tailwind CSS** (样式框架)
- **Lucide Icons** (图标库)

### 后端
- **Node.js + Express**
- **TypeScript**
- **LangChain** (AI 应用框架)
- **OpenRouter API** (LLM 服务)
- **Supabase** (向量数据库)
- **MarkItDown** (文档转换，可选)

---

## 快速启动

### 1. 前置要求

- **Node.js** >= 18.0.0
- **Supabase** 账号
- **OpenRouter** API Key
- **Python** >= 3.10 (可选，用于高级文档转换)

### 2. Supabase 数据库设置

在 Supabase 的 **SQL Editor** 中运行 `supabase-setup.sql` 文件中的脚本。

### 3. 后端配置 (`/backend`)

1. 进入目录并安装依赖：
```bash
cd backend
npm install
```

2. 创建 `.env` 文件：
```env
# OpenRouter API 配置
OPENROUTER_API_KEY=your_openrouter_api_key

# Supabase 配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 模型配置
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small

# 服务器配置
PORT=3001
FRONTEND_URL=http://localhost:3000

# 可选: Python 路径 (用于 MarkItDown)
# PYTHON_PATH=/usr/bin/python3
```

3. 启动开发服务器：
```bash
npm run dev
```

### 4. 前端配置 (`/frontend`)

1. 进入目录并安装依赖：
```bash
cd frontend
npm install
```

2. 创建 `.env.local` 文件：
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

3. 启动开发服务器：
```bash
npm run dev
```

### 5. 安装 MarkItDown (可选)

如果需要完整支持 Word、Excel、PowerPoint 等格式，安装 Python 和 MarkItDown：
```bash
pip install 'markitdown[all]'
```

---

## API 接口

### POST /api/upload
上传文档文件。

**请求**: `multipart/form-data`
- `files`: 文件列表 (最多10个，每个最大20MB)
- `userId`: 用户ID (可选)

**响应**:
```json
{
  "success": true,
  "message": "成功处理 3 个文件",
  "documentsCreated": 45,
  "files": [...]
}
```

### POST /api/chat
发送聊天消息。

**请求**: `application/json`
```json
{
  "question": "文档中提到了什么内容？",
  "userId": "user_123",
  "stream": true
}
```

### DELETE /api/documents
删除用户的所有文档。

### GET /api/supported-types
获取支持的文件类型列表。

### GET /api/health
健康检查。

---

## 安全说明

### 提示词注入防护

系统使用了多层防护机制：

1. **安全 System Prompt** - 使用 XML 标签分隔符和明确的安全规则
2. **输入检测** - 检测常见的注入攻击模式（角色扮演、指令覆盖等）
3. **输出过滤** - 过滤可能包含敏感信息的输出

### 敏感信息自动过滤

系统会自动检测并脱敏以下内容：
- OpenAI/OpenRouter API Key (`sk-...`)
- JWT Token
- AWS 密钥
- 密码字段
- 中国身份证号
- 银行卡号
- 手机号码

---

## 项目结构

```
pdf-chatbot/
├── backend/
│   ├── src/
│   │   ├── index.ts              # 入口文件
│   │   ├── routes/
│   │   │   └── api.ts            # API 路由
│   │   └── services/
│   │       ├── chat.ts           # 聊天服务
│   │       ├── documentConverter.ts  # 文档转换服务
│   │       ├── security.ts       # 安全服务
│   │       └── vectorStore.ts    # 向量存储服务
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── page.tsx          # 主页面
│   │   ├── components/
│   │   │   ├── ChatMessage.tsx   # 聊天消息组件
│   │   │   └── FileUpload.tsx    # 文件上传组件
│   │   └── lib/
│   │       ├── api.ts            # API 客户端
│   │       └── utils.ts          # 工具函数
│   └── package.json
├── supabase-setup.sql            # 数据库初始化脚本
└── README.md
```

---

## 常见问题

### Q: 上传 Word/Excel 文件提示不支持？
A: 系统有两种处理模式：
1. **带 MarkItDown**: 安装 Python 和 `markitdown` 后可支持所有格式
2. **不带 MarkItDown**: 仅支持 PDF、TXT、CSV、JSON 等基础格式

### Q: 为什么上传成功后搜索返回空结果？
A: 可能的原因：
1. 文档内容为空或无法提取文本
2. 问题与文档内容不相关
3. 相似度阈值设置过高

### Q: 提示词注入防护如何工作？
A: 系统会检测常见的注入模式（如"忽略之前的指令"），并使用安全的 System Prompt 设计防止 AI 行为被操纵。即使检测到可疑输入，系统也会正常处理问题但忽略注入指令。

---

## 许可证

[MIT License](https://opensource.org/licenses/MIT)
