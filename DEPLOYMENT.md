# 部署指南

本文档介绍如何将 PDF 聊天机器人部署到生产环境。

## 目录

1. [Supabase 设置](#supabase-设置)
2. [后端部署](#后端部署)
3. [前端部署](#前端部署)
4. [环境变量配置](#环境变量配置)
5. [常见问题](#常见问题)

## Supabase 设置

### 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com)
2. 点击 "New Project"
3. 填写项目信息:
   - Name: pdf-chatbot
   - Database Password: (设置一个强密码)
   - Region: (选择最近的区域)
4. 点击 "Create new project"

### 2. 配置数据库

1. 在 Supabase 控制台中,进入 "SQL Editor"
2. 点击 "New query"
3. 复制 `supabase-setup.sql` 文件的内容
4. 粘贴并点击 "Run"
5. 确认所有 SQL 语句执行成功

### 3. 获取 API 密钥

1. 进入 "Project Settings" > "API"
2. 复制以下信息:
   - Project URL (SUPABASE_URL)
   - service_role key (SUPABASE_SERVICE_ROLE_KEY)

⚠️ **重要**: service_role key 具有完全访问权限,请妥善保管,不要泄露!

## 后端部署

### 方案 1: Railway (推荐)

Railway 提供简单的部署体验和慷慨的免费额度。

1. **创建 Railway 账号**
   - 访问 [Railway](https://railway.app)
   - 使用 GitHub 账号登录

2. **创建新项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 连接你的 GitHub 仓库
   - 选择 `backend` 目录

3. **配置环境变量**
   
   在 Railway 项目设置中添加以下环境变量:
   \`\`\`
   OPENROUTER_API_KEY=your-openrouter-key
   OPENROUTER_MODEL=anthropic/claude-3-sonnet
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   PORT=3001
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   \`\`\`

4. **配置启动命令**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

5. **部署**
   - Railway 会自动检测 Node.js 项目并开始构建
   - 等待部署完成
   - 复制生成的 URL (例如: https://your-app.railway.app)

### 方案 2: Render

1. 访问 [Render](https://render.com)
2. 创建新的 "Web Service"
3. 连接 GitHub 仓库
4. 配置:
   - Name: pdf-chatbot-backend
   - Environment: Node
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm start`
5. 添加环境变量(同 Railway)
6. 点击 "Create Web Service"

### 方案 3: Heroku

1. 安装 Heroku CLI
2. 登录: `heroku login`
3. 创建应用:
   \`\`\`bash
   cd backend
   heroku create pdf-chatbot-backend
   \`\`\`
4. 设置环境变量:
   \`\`\`bash
   heroku config:set OPENROUTER_API_KEY=your-key
   heroku config:set SUPABASE_URL=your-url
   # ... 其他环境变量
   \`\`\`
5. 部署:
   \`\`\`bash
   git push heroku main
   \`\`\`

## 前端部署

### Vercel (推荐)

Vercel 是 Next.js 的最佳部署平台。

1. **安装 Vercel CLI**
   \`\`\`bash
   npm install -g vercel
   \`\`\`

2. **部署**
   \`\`\`bash
   cd frontend
   vercel
   \`\`\`

3. **配置环境变量**
   - 在 Vercel 控制台中,进入项目设置
   - 添加环境变量:
     \`\`\`
     NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
     \`\`\`

4. **重新部署**
   \`\`\`bash
   vercel --prod
   \`\`\`

### Netlify

1. 在 Netlify 控制台中创建新站点
2. 连接 GitHub 仓库
3. 配置构建设置:
   - Build command: `cd frontend && npm run build`
   - Publish directory: `frontend/.next`
4. 添加环境变量
5. 部署

## 环境变量配置

### 后端环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| OPENROUTER_API_KEY | OpenRouter API 密钥 | sk-or-v1-xxx |
| OPENROUTER_MODEL | 使用的 LLM 模型 | anthropic/claude-3-sonnet |
| SUPABASE_URL | Supabase 项目 URL | https://xxx.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | Supabase 服务密钥 | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... |
| PORT | 服务端口 | 3001 |
| NODE_ENV | 运行环境 | production |
| FRONTEND_URL | 前端 URL (用于 CORS) | https://your-app.vercel.app |

### 前端环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| NEXT_PUBLIC_API_URL | 后端 API URL | https://your-api.railway.app |

## 验证部署

### 1. 检查后端健康状态

访问: `https://your-backend-url/api/health`

应该返回:
\`\`\`json
{
  "status": "ok",
  "timestamp": "2024-01-30T12:00:00.000Z"
}
\`\`\`

### 2. 测试前端

1. 访问前端 URL
2. 尝试上传一个小的 PDF 文件
3. 检查浏览器控制台是否有错误
4. 尝试提问并查看是否能正常获得回复

## 性能优化

### 1. 启用 CDN

- Vercel 和 Netlify 自动提供 CDN
- 确保静态资源被正确缓存

### 2. 数据库索引

确保 Supabase 中的索引已创建:
\`\`\`sql
-- 检查索引
SELECT * FROM pg_indexes WHERE tablename = 'documents';
\`\`\`

### 3. 环境变量优化

生产环境建议配置:
\`\`\`env
NODE_ENV=production
OPENROUTER_MODEL=anthropic/claude-3-sonnet  # 或更快的模型
\`\`\`

### 4. 监控

- 使用 Railway/Render 内置的日志监控
- 设置 Supabase 数据库监控
- 考虑添加 Sentry 进行错误追踪

## 常见问题

### Q1: CORS 错误

**症状**: 前端无法连接后端,浏览器控制台显示 CORS 错误

**解决方案**:
1. 确保后端的 `FRONTEND_URL` 环境变量设置正确
2. 检查前端的 `NEXT_PUBLIC_API_URL` 是否正确
3. 在后端 `src/index.ts` 中检查 CORS 配置

### Q2: 数据库连接错误

**症状**: 上传文档或查询时出错

**解决方案**:
1. 检查 Supabase URL 和密钥是否正确
2. 确认 Supabase 项目处于活动状态
3. 验证 SQL 脚本是否正确执行

### Q3: 文件上传失败

**症状**: 无法上传 PDF 文件

**解决方案**:
1. 检查文件大小是否超过限制 (默认 10MB)
2. 确认文件格式为 PDF
3. 查看后端日志了解详细错误

### Q4: OpenRouter API 错误

**症状**: 聊天功能不工作

**解决方案**:
1. 验证 API 密钥是否有效
2. 检查 OpenRouter 账户余额
3. 确认选择的模型可用

### Q5: 部署后环境变量未生效

**症状**: 应用使用了错误的配置

**解决方案**:
1. 重新检查环境变量设置
2. 重新部署应用
3. 清除构建缓存后重试

## 扩展建议

### 1. 添加认证

使用 Supabase Auth 或 NextAuth.js 添加用户认证

### 2. 添加支付

集成 Stripe 实现付费功能

### 3. 添加分析

- Google Analytics
- Mixpanel
- PostHog

### 4. 添加缓存

- Redis 缓存频繁查询
- CDN 缓存静态资源

### 5. 数据备份

- 定期备份 Supabase 数据库
- 导出重要文档

## 安全建议

1. **永远不要泄露**:
   - SUPABASE_SERVICE_ROLE_KEY
   - OPENROUTER_API_KEY
   - 任何包含 "secret" 或 "private" 的密钥

2. **使用环境变量**:
   - 不要在代码中硬编码密钥
   - 使用 .env 文件 (加入 .gitignore)

3. **启用 HTTPS**:
   - 确保前后端都使用 HTTPS
   - Vercel 和 Railway 自动提供

4. **限制访问**:
   - 实施速率限制
   - 添加用户认证
   - 限制文件大小和数量

5. **监控异常**:
   - 设置错误警报
   - 定期检查日志
   - 监控 API 使用情况

## 更新部署

### 后端更新

\`\`\`bash
# Railway/Render 会自动检测 Git 推送
git add .
git commit -m "Update backend"
git push origin main
\`\`\`

### 前端更新

\`\`\`bash
# Vercel 会自动部署
git add .
git commit -m "Update frontend"
git push origin main

# 或使用 Vercel CLI
vercel --prod
\`\`\`

## 支持

如有问题,请:
1. 查看日志文件
2. 检查环境变量配置
3. 参考本文档的常见问题部分
4. 在 GitHub 上提交 Issue

祝部署顺利! 🚀
