import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { DocumentConverterService, getSupportedMimeTypes, isFileTypeSupported, getMimeTypeFromExtension } from '../services/documentConverter';
import { VectorStoreService } from '../services/vectorStore';
import { ChatService } from '../services/chat';
import { securityService } from '../services/security';

const router = express.Router();

// 支持的文件类型
const SUPPORTED_MIME_TYPES = getSupportedMimeTypes();

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB (增加以支持更多格式)
  },
  fileFilter: (req, file, cb) => {
    // 获取 MIME 类型（优先使用文件扩展名判断，因为有些文件的 MIME 类型可能不准确）
    const mimeFromExt = getMimeTypeFromExtension(file.originalname);
    const mimeType = mimeFromExt || file.mimetype;
    
    if (isFileTypeSupported(mimeType)) {
      // 将正确的 MIME 类型存储以便后续使用
      (file as any).detectedMimeType = mimeType;
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}。支持的类型包括: PDF, Word, Excel, PowerPoint, TXT, CSV, JSON, HTML, Markdown`));
    }
  },
});

// 延迟初始化服务（避免在配置缺失时立即崩溃）
let documentConverterService: DocumentConverterService | null = null;
let vectorStoreService: VectorStoreService | null = null;
let chatService: ChatService | null = null;

function getServices() {
  if (!documentConverterService) {
    documentConverterService = new DocumentConverterService();
  }
  if (!vectorStoreService) {
    vectorStoreService = new VectorStoreService();
  }
  if (!chatService) {
    chatService = new ChatService();
  }
  return { documentConverterService, vectorStoreService, chatService };
}

/**
 * 错误处理中间件
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * POST /api/upload
 * 上传并处理文档文件（支持多种格式）
 */
router.post('/upload', upload.array('files', 10), asyncHandler(async (req: Request, res: Response) => {
  const { documentConverterService, vectorStoreService } = getServices();
  
  const files = req.files as Express.Multer.File[];
  const userId = req.body.userId || 'default-user';

  if (!files || files.length === 0) {
    return res.status(400).json({ error: '未上传任何文件' });
  }

  console.log(`Processing ${files.length} files for user ${userId}`);

  // 处理所有文件
  const fileData = files.map(file => ({
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: (file as any).detectedMimeType || file.mimetype,
  }));

  const documents = await documentConverterService.processFiles(fileData);

  // 存储到向量数据库
  await vectorStoreService.addDocuments(documents, userId);

  res.json({
    success: true,
    message: `成功处理 ${files.length} 个文件`,
    documentsCreated: documents.length,
    files: files.map(f => ({
      name: f.originalname,
      type: (f as any).detectedMimeType || f.mimetype,
      size: f.size,
    })),
  });
}));

/**
 * POST /api/chat
 * 处理聊天请求（带安全检查）
 */
router.post('/chat', asyncHandler(async (req: Request, res: Response) => {
  const { vectorStoreService, chatService } = getServices();
  
  const { question, userId = 'default-user', stream = false } = req.body;

  if (!question) {
    return res.status(400).json({ error: '问题不能为空' });
  }

  // 安全检查：清理用户输入
  const { sanitized: sanitizedQuestion, warnings, blocked } = securityService.sanitizeInput(question);
  
  if (blocked) {
    return res.status(400).json({ 
      error: '您的问题包含不允许的内容，请重新提问',
      warnings 
    });
  }

  // 如果有警告，记录日志但继续处理
  if (warnings.length > 0) {
    console.warn(`[Security Warning] User ${userId}: ${warnings.join(', ')}`);
  }

  console.log(`Chat request from user ${userId}: ${sanitizedQuestion.substring(0, 100)}...`);

  // 搜索相关文档
  const relevantDocs = await vectorStoreService.similaritySearch(
    sanitizedQuestion,
    4,
    userId
  );

  if (relevantDocs.length === 0) {
    return res.json({
      answer: '抱歉，我没有找到相关的文档内容来回答你的问题。请先上传一些文档文件（支持 PDF、Word、Excel、PowerPoint 等格式）。',
      sources: [],
    });
  }

  // 流式响应
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      let fullResponse = '';
      
      for await (const chunk of chatService.streamAnswer(sanitizedQuestion, relevantDocs)) {
        fullResponse += chunk;
        // 对每个 chunk 进行安全过滤
        const filteredChunk = securityService.filterOutput(chunk);
        res.write(`data: ${JSON.stringify({ content: filteredChunk })}\n\n`);
      }

      // 发送来源信息（过滤敏感内容）
      const sources = relevantDocs.map(doc => ({
        content: securityService.filterOutput(doc.pageContent.substring(0, 200)) + '...',
        source: doc.metadata.source,
      }));

      res.write(`data: ${JSON.stringify({ sources, done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ error: '处理请求时发生错误' })}\n\n`);
      res.end();
    }
  } else {
    // 非流式响应
    const answer = await chatService.generateAnswer(sanitizedQuestion, relevantDocs);
    
    // 过滤输出中的敏感信息
    const filteredAnswer = securityService.filterOutput(answer);
    
    const sources = relevantDocs.map(doc => ({
      content: securityService.filterOutput(doc.pageContent.substring(0, 200)) + '...',
      source: doc.metadata.source,
    }));

    res.json({
      answer: filteredAnswer,
      sources,
    });
  }
}));

/**
 * DELETE /api/documents
 * 删除用户的所有文档
 */
router.delete('/documents', asyncHandler(async (req: Request, res: Response) => {
  const { vectorStoreService } = getServices();
  
  const { userId = 'default-user' } = req.body;

  await vectorStoreService.deleteUserDocuments(userId);

  res.json({
    success: true,
    message: '所有文档已成功删除',
  });
}));

/**
 * GET /api/supported-types
 * 获取支持的文件类型列表
 */
router.get('/supported-types', (req: Request, res: Response) => {
  res.json({
    mimeTypes: SUPPORTED_MIME_TYPES,
    extensions: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'md', 'csv', 'json', 'html'],
    description: {
      'application/pdf': 'PDF 文档',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word 文档 (.docx)',
      'application/msword': 'Word 文档 (.doc)',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel 表格 (.xlsx)',
      'application/vnd.ms-excel': 'Excel 表格 (.xls)',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint (.pptx)',
      'application/vnd.ms-powerpoint': 'PowerPoint (.ppt)',
      'text/plain': '纯文本 (.txt)',
      'text/markdown': 'Markdown (.md)',
      'text/csv': 'CSV 表格 (.csv)',
      'application/json': 'JSON 数据 (.json)',
      'text/html': 'HTML 网页 (.html)',
    },
  });
});

/**
 * GET /api/health
 * 健康检查
 */
router.get('/health', (req: Request, res: Response) => {
  const configured = {
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };
  
  res.json({
    status: configured.openrouter ? 'ok' : 'misconfigured',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    storage: 'local',
    configured,
    features: {
      multiFormatUpload: true,
      securityFiltering: true,
      streamingChat: true,
      localStorage: true,
    },
  });
});

/**
 * 全局错误处理
 */
router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err.message);
  
  // 检查是否是配置错误
  if (err.message?.includes('must be configured')) {
    return res.status(503).json({
      error: '服务未正确配置，请检查环境变量',
      details: '请确保 .env 文件中配置了 OPENROUTER_API_KEY',
    });
  }
  
  // 过滤错误消息中的敏感信息
  const safeMessage = securityService.filterOutput(err.message || '服务器内部错误');
  
  res.status(err.status || 500).json({
    error: safeMessage,
  });
});

export default router;
