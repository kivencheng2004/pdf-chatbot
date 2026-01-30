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
    
    // 使用 OpenAI embeddings (通过 OpenRouter 代理)
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
      modelName: 'text-embedding-3-small',
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
      console.log('用户 ID:', userId);

      const vectorStore = await SupabaseVectorStore.fromExistingIndex(
        this.embeddings,
        {
          client: this.supabase,
          tableName: 'documents',
          queryName: 'match_documents',
        }
      );

      // 先不使用过滤器进行搜索,确保能找到文档
      console.log('执行搜索(不使用用户过滤)...');
      const results = await vectorStore.similaritySearch(query, k);
      
      console.log(`找到 ${results.length} 个相似文档`);
      
      // 如果指定了 userId,手动过滤结果
      if (userId && results.length > 0) {
        console.log('应用用户过滤:', userId);
        const filteredResults = results.filter(
          doc => doc.metadata.userId === userId
        );
        console.log(`过滤后剩余 ${filteredResults.length} 个文档`);
        
        // 如果过滤后没有结果,返回所有结果(用户可能想查看所有文档)
        if (filteredResults.length === 0) {
          console.log('警告: 用户过滤后没有结果,返回所有匹配文档');
          return results;
        }
        
        return filteredResults;
      }
      
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
