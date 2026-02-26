import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from 'langchain/document';
import * as fs from 'fs';
import * as path from 'path';

// 本地存储路径
const DATA_DIR = path.join(process.cwd(), 'data');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');

interface StoredDocument {
  pageContent: string;
  metadata: Record<string, any>;
}

export class VectorStoreService {
  private embeddings: OpenAIEmbeddings;
  private vectorStore: MemoryVectorStore | null = null;
  private documents: Document[] = [];
  private initialized: boolean = false;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY must be configured in .env file');
    }
    
    const embeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL || 'text-embedding-3-small';
    console.log(`VectorStoreService initialized with embedding model: ${embeddingModel}`);
    console.log(`Using local storage at: ${DATA_DIR}`);

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
      modelName: embeddingModel,
    });

    // 确保数据目录存在
    this.ensureDataDir();
    
    // 加载已存储的文档
    this.loadDocuments();
    
    this.initialized = true;
  }

  /**
   * 确保数据目录存在
   */
  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`Created data directory: ${DATA_DIR}`);
    }
  }

  /**
   * 从本地文件加载文档
   */
  private loadDocuments(): void {
    try {
      if (fs.existsSync(DOCUMENTS_FILE)) {
        const data = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
        const stored: StoredDocument[] = JSON.parse(data);
        this.documents = stored.map(doc => new Document({
          pageContent: doc.pageContent,
          metadata: doc.metadata,
        }));
        console.log(`Loaded ${this.documents.length} documents from local storage`);
      } else {
        console.log('No existing documents found, starting fresh');
      }
    } catch (error) {
      console.error('Error loading documents from file:', error);
      this.documents = [];
    }
  }

  /**
   * 保存文档到本地文件
   */
  private saveDocuments(): void {
    try {
      const stored: StoredDocument[] = this.documents.map(doc => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
      }));
      fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(stored, null, 2), 'utf-8');
      console.log(`Saved ${this.documents.length} documents to local storage`);
    } catch (error) {
      console.error('Error saving documents to file:', error);
    }
  }

  /**
   * 重建向量存储
   */
  private async rebuildVectorStore(): Promise<void> {
    if (this.documents.length === 0) {
      this.vectorStore = null;
      return;
    }

    try {
      console.log(`Building vector store with ${this.documents.length} documents...`);
      this.vectorStore = await MemoryVectorStore.fromDocuments(
        this.documents,
        this.embeddings
      );
      console.log(`Vector store built successfully`);
    } catch (error: any) {
      console.error('Error rebuilding vector store:', error);
      
      // 提供更清晰的错误提示
      if (error.message?.includes('No endpoints found') || error.message?.includes('data policy')) {
        console.error('\n========================================');
        console.error('EMBEDDING ERROR: OpenRouter 隐私设置问题');
        console.error('请访问 https://openrouter.ai/settings/privacy');
        console.error('并修改数据保留策略以允许 embedding 模型使用');
        console.error('========================================\n');
      }
      
      this.vectorStore = null;
    }
  }

  /**
   * 检查服务是否已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('VectorStoreService not properly initialized');
    }
  }

  /**
   * 将文档添加到向量数据库
   */
  async addDocuments(documents: Document[], userId: string): Promise<void> {
    this.ensureInitialized();
    
    if (!documents || documents.length === 0) {
      throw new Error('No documents to add');
    }

    try {
      // 为每个文档添加用户ID和时间戳元数据
      const docsWithMetadata = documents.map(doc => new Document({
        pageContent: doc.pageContent,
        metadata: {
          ...doc.metadata,
          userId,
          timestamp: new Date().toISOString(),
        },
      }));

      // 添加到文档列表
      this.documents.push(...docsWithMetadata);
      
      // 保存到本地
      this.saveDocuments();
      
      // 重建向量存储
      await this.rebuildVectorStore();

      console.log(`Successfully added ${documents.length} documents for user ${userId}`);
    } catch (error) {
      console.error('Error adding documents to vector store:', error);
      throw new Error('Failed to add documents to vector database');
    }
  }

  /**
   * 相似度搜索
   */
  async similaritySearch(
    query: string,
    k: number = 4,
    userId?: string
  ): Promise<Document[]> {
    this.ensureInitialized();

    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    // 如果没有文档，返回空数组
    if (this.documents.length === 0) {
      console.log('No documents in vector store');
      return [];
    }

    try {
      console.log(`Performing similarity search: query="${query.substring(0, 50)}...", k=${k}`);

      // 如果向量存储不存在，重建它
      if (!this.vectorStore) {
        await this.rebuildVectorStore();
      }

      if (!this.vectorStore) {
        console.log('Vector store is empty');
        return [];
      }

      // 执行搜索
      const results = await this.vectorStore.similaritySearch(query, k);
      
      console.log(`Found ${results.length} similar documents`);
      
      return results;
    } catch (error) {
      console.error('Error performing similarity search:', error);
      throw new Error('Failed to search documents');
    }
  }

  /**
   * 带分数的相似度搜索
   */
  async similaritySearchWithScore(
    query: string,
    k: number = 4
  ): Promise<Array<[Document, number]>> {
    this.ensureInitialized();

    if (this.documents.length === 0 || !this.vectorStore) {
      return [];
    }

    try {
      const results = await this.vectorStore.similaritySearchWithScore(query, k);
      return results;
    } catch (error) {
      console.error('Error performing similarity search with score:', error);
      throw new Error('Failed to search documents');
    }
  }

  /**
   * 删除用户的所有文档
   */
  async deleteUserDocuments(userId: string): Promise<void> {
    this.ensureInitialized();

    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const beforeCount = this.documents.length;
      
      // 过滤掉该用户的文档
      this.documents = this.documents.filter(
        doc => doc.metadata?.userId !== userId
      );
      
      const deletedCount = beforeCount - this.documents.length;
      
      // 保存到本地
      this.saveDocuments();
      
      // 重建向量存储
      await this.rebuildVectorStore();
      
      console.log(`Deleted ${deletedCount} documents for user ${userId}`);
    } catch (error) {
      console.error('Error deleting user documents:', error);
      throw new Error('Failed to delete documents');
    }
  }

  /**
   * 删除所有文档
   */
  async deleteAllDocuments(): Promise<void> {
    this.ensureInitialized();

    try {
      this.documents = [];
      this.vectorStore = null;
      
      // 删除本地文件
      if (fs.existsSync(DOCUMENTS_FILE)) {
        fs.unlinkSync(DOCUMENTS_FILE);
      }
      
      console.log('Deleted all documents');
    } catch (error) {
      console.error('Error deleting all documents:', error);
      throw new Error('Failed to delete all documents');
    }
  }

  /**
   * 获取文档数量
   */
  async getDocumentCount(userId?: string): Promise<number> {
    this.ensureInitialized();

    if (userId) {
      return this.documents.filter(doc => doc.metadata?.userId === userId).length;
    }
    
    return this.documents.length;
  }
}
