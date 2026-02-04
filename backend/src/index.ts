import dotenv from 'dotenv';
// 确保在任何其他导入之前加载环境变量
dotenv.config();

import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 3001;

// 打印关键配置信息（脱敏）
console.log('=== Server Configuration ===');
console.log(`Supabase URL: ${process.env.SUPABASE_URL}`);
console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
console.log(`Chat Model: ${process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet (default)'}`);
console.log(`Embedding Model: ${process.env.OPENROUTER_EMBEDDING_MODEL || 'text-embedding-3-small (default)'}`);
console.log('============================');

// 中间件
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api', apiRoutes);

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 API available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
