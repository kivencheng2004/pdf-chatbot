import OpenAI from 'openai';
import { Document } from 'langchain/document';
import { buildSecureSystemPrompt, securityService } from './security';

export class ChatService {
  private client: OpenAI;
  private model: string;
  private systemPrompt: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // 优先使用环境变量中的模型
    const envModel = process.env.OPENROUTER_MODEL;
    
    // 检查是否错误地将 embedding 模型配置为聊天模型
    if (envModel && envModel.includes('embedding')) {
      console.warn(`配置警告: OPENROUTER_MODEL 被设置为 embedding 模型 (${envModel})。已自动切换到 Claude 3.5 Sonnet。`);
      this.model = 'anthropic/claude-3.5-sonnet';
    } else {
      this.model = envModel || 'anthropic/claude-3.5-sonnet';
    }
    
    // 初始化安全的 System Prompt
    this.systemPrompt = buildSecureSystemPrompt();
    
    console.log(`ChatService initialized with model: ${this.model}`);
  }

  /**
   * 构建带上下文的用户消息
   */
  private buildUserMessage(question: string, context: Document[]): string {
    const contextText = context
      .map((doc, i) => {
        const source = doc.metadata?.source || '未知来源';
        return `【文档片段 ${i + 1}】来源: ${source}\n${doc.pageContent}`;
      })
      .join('\n\n---\n\n');

    return `<DOCUMENT_CONTEXT>
${contextText}
</DOCUMENT_CONTEXT>

<USER_QUESTION>
${question}
</USER_QUESTION>

请基于上述文档内容回答用户的问题。`;
  }

  /**
   * 生成回答 (流式)
   */
  async *streamAnswer(
    question: string,
    context: Document[]
  ): AsyncGenerator<string, void, unknown> {
    try {
      const userMessage = this.buildUserMessage(question, context);

      console.log(`Starting chat stream with model: ${this.model}`);

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('Error streaming answer:', error);
      
      // 如果主模型失败，尝试回退到 GPT-3.5
      if (this.model !== 'openai/gpt-3.5-turbo') {
        console.log('尝试回退到 gpt-3.5-turbo...');
        try {
          const userMessage = this.buildUserMessage(question, context);
          
          const fallbackStream = await this.client.chat.completions.create({
            model: 'openai/gpt-3.5-turbo',
            messages: [
              { role: 'system', content: this.systemPrompt },
              { role: 'user', content: userMessage },
            ],
            stream: true,
            temperature: 0.7,
          });
          
          for await (const chunk of fallbackStream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) yield content;
          }
          return;
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
        }
      }
      
      throw new Error(`生成回答失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 生成回答 (非流式)
   */
  async generateAnswer(
    question: string,
    context: Document[]
  ): Promise<string> {
    try {
      const userMessage = this.buildUserMessage(question, context);

      console.log(`Generating answer with model: ${this.model}`);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      return response.choices[0]?.message?.content || '无法生成回答';
    } catch (error) {
      console.error('Error generating answer:', error);
      
      // 尝试回退
      if (this.model !== 'openai/gpt-3.5-turbo') {
        try {
          const userMessage = this.buildUserMessage(question, context);
          
          const response = await this.client.chat.completions.create({
            model: 'openai/gpt-3.5-turbo',
            messages: [
              { role: 'system', content: this.systemPrompt },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
          });
          
          return response.choices[0]?.message?.content || '无法生成回答';
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
        }
      }
      
      throw new Error(`生成回答失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
