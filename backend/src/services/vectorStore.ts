import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { Document } from 'langchain/document';

export class VectorStoreService {
  private supabase: SupabaseClient;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    // 使用环境变量配置 embedding 模型，如果未设置则默认使用 text-embedding-3-small
    const embeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL || 'text-embedding-3-small';
    console.log(`VectorStoreService initialized with embedding model: ${embeddingModel}`);

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
      modelName: embeddingModel,
    });
  }

  /**
   * 将文档添加到向量数据库
   */
  async addDocuments(documents: Document[], userId: string): Promise<void> {
    try {
      // 为每个文档添加用户ID元数据
      const docsWithMetadata = documents.map(doc => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          userId,
          timestamp: new Date().toISOString(),
        },
      }));

      await SupabaseVectorStore.fromDocuments(
        docsWithMetadata,
        this.embeddings,
        {
          client: this.supabase,
          tableName: 'documents',
          queryName: 'match_documents',
        }
      );

      console.log(`Successfully added ${documents.length} documents to vector store`);
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
    try {
      console.log('=== 开始向量搜索 ===');
      console.log('查询文本:', query);
      console.log('k 值:', k);
      // console.log('用户 ID:', userId); // 不再需要打印用户ID，因为我们不再使用它进行过滤

      const vectorStore = await SupabaseVectorStore.fromExistingIndex(
        this.embeddings,
        {
          client: this.supabase,
          tableName: 'documents',
          queryName: 'match_documents',
        }
      );

      // 1. 全局搜索：不使用任何用户过滤
      console.log('执行全局搜索(忽略用户ID)...');
      
      const results = await vectorStore.similaritySearch(query, k);
      
      console.log(`找到 ${results.length} 个相似文档`);
      
      // 直接返回结果，不再进行任何用户ID过滤
      console.log('=== 搜索完成 ===');
      return results;
    } catch (error) {
      console.error('Error performing similarity search:', error);
      throw new Error('Failed to search documents');
    }
  }

  /**
   * 删除用户的所有文档
   */
  async deleteUserDocuments(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('documents')
        .delete()
        .eq('metadata->userId', userId);

      if (error) throw error;
      
      console.log(`Deleted all documents for user ${userId}`);
    } catch (error) {
      console.error('Error deleting user documents:', error);
      throw new Error('Failed to delete documents');
    }
  }
}
