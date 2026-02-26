import dotenv from 'dotenv';
// 确保在任何其他导入之前加载环境变量
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import apiRoutes from './routes/api';
import { securityService } from './services/security';

const app = express();
const PORT = process.env.PORT || 3001;

// 配置打印（脱敏）
console.log('=== Server Configuration ===');
console.log(`Storage: Local (./data)`);
console.log(`OpenRouter API Key: ${process.env.OPENROUTER_API_KEY ? '[CONFIGURED]' : '[NOT SET - Required!]'}`);
console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
console.log(`Chat Model: ${process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet (default)'}`);
console.log(`Embedding Model: ${process.env.OPENROUTER_EMBEDDING_MODEL || 'text-embedding-3-small (default)'}`);
console.log('============================');

// 安全中间件 - Helmet 提供基本的安全头
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS 配置
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（如移动应用或 Postman）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 速率限制 - 防止滥用
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 最多 100 个请求
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 对 API 路由应用速率限制
app.use('/api', limiter);

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志中间件（脱敏处理）
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    // 不记录敏感路径的详细信息
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  
  next();
});

// API 路由
app.use('/api', apiRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '未找到请求的资源' });
});

// 全局错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err.message);
  
  // 过滤错误消息中的敏感信息
  const safeMessage = securityService.filterOutput(err.message || 'Internal server error');
  
  res.status(err.status || 500).json({
    error: safeMessage,
  });
});

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
