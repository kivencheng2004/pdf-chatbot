import express, { Request, Response } from 'express';
import multer from 'multer';
import { PDFService } from '../services/pdf';
import { VectorStoreService } from '../services/vectorStore';
import { ChatService } from '../services/chat';

const router = express.Router();

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

const pdfService = new PDFService();
const vectorStoreService = new VectorStoreService();
const chatService = new ChatService();

/**
 * POST /api/upload
 * 上传并处理 PDF 文件
 */
router.post('/upload', upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    const userId = req.body.userId || 'default-user';

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Processing ${files.length} PDF files for user ${userId}`);

    // 处理所有 PDF 文件
    const fileData = files.map(file => ({
      buffer: file.buffer,
      filename: file.originalname,
    }));

    const documents = await pdfService.processPDFs(fileData);

    // 存储到向量数据库
    await vectorStoreService.addDocuments(documents, userId);

    res.json({
      success: true,
      message: `Successfully processed ${files.length} file(s)`,
      documentsCreated: documents.length,
      files: files.map(f => f.originalname),
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process files',
    });
  }
});

/**
 * POST /api/chat
 * 处理聊天请求
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { question, userId = 'default-user', stream = false } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    console.log(`Chat request from user ${userId}: ${question}`);

    // 搜索相关文档
    const relevantDocs = await vectorStoreService.similaritySearch(
      question,
      4,
      userId
    );

    if (relevantDocs.length === 0) {
      return res.json({
        answer: '抱歉,我没有找到相关的文档内容来回答你的问题。请先上传一些 PDF 文件。',
        sources: [],
      });
    }

    // 流式响应
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        for await (const chunk of chatService.streamAnswer(question, relevantDocs)) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }

        // 发送来源信息
        const sources = relevantDocs.map(doc => ({
          content: doc.pageContent.substring(0, 200) + '...',
          source: doc.metadata.source,
        }));

        res.write(`data: ${JSON.stringify({ sources, done: true })}\n\n`);
        res.end();
      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
        res.end();
      }
    } else {
      // 非流式响应
      const answer = await chatService.generateAnswer(question, relevantDocs);
      
      const sources = relevantDocs.map(doc => ({
        content: doc.pageContent.substring(0, 200) + '...',
        source: doc.metadata.source,
      }));

      res.json({
        answer,
        sources,
      });
    }
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process chat request',
    });
  }
});

/**
 * DELETE /api/documents
 * 删除用户的所有文档
 */
router.delete('/documents', async (req: Request, res: Response) => {
  try {
    const { userId = 'default-user' } = req.body;

    await vectorStoreService.deleteUserDocuments(userId);

    res.json({
      success: true,
      message: 'All documents deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete documents',
    });
  }
});

/**
 * GET /api/health
 * 健康检查
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
