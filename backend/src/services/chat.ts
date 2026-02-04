import OpenAI from 'openai';
import { Document } from 'langchain/document';

export class ChatService {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // 优先使用环境变量中的模型，如果没有设置或设置错误，则使用默认的高级模型
    const envModel = process.env.OPENROUTER_MODEL;
    
    // 检查是否错误地将 embedding 模型配置为聊天模型
    if (envModel && envModel.includes('embedding')) {
      console.warn(`⚠️ 配置警告: OPENROUTER_MODEL 环境变量被设置为 embedding 模型 (${envModel})。已自动切换到 Claude 3.5 Sonnet。`);
      this.model = 'anthropic/claude-3.5-sonnet';
    } else {
      // 默认使用 Claude 3.5 Sonnet，它的回复质量很高
      this.model = envModel || 'anthropic/claude-3.5-sonnet';
    }
    
    console.log(`ChatService initialized with model: ${this.model}`);
  }

  /**
   * 构建带上下文的提示词
   */
  private buildPrompt(question: string, context: Document[]): string {
    const contextText = context
      .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
      .join('\n\n');

    return `你是一个智能助手。请基于以下提供的文档片段回答用户的问题。

文档片段:
${contextText}

请注意：
1. 如果文档内容包含答案，请详细回答。
2. 如果文档内容与问题相关但不完整，请基于常识补充，但要说明哪些是文档里的，哪些是补充的。
3. 如果文档内容完全不相关，你可以尝试用你的通用知识回答，但请告知用户文档中没有相关信息。

用户问题: ${question}

回答:`;
  }

  /**
   * 生成回答 (流式)
   */
  async *streamAnswer(
    question: string,
    context: Document[]
  ): AsyncGenerator<string, void, unknown> {
    // 将 prompt 定义在 try 块外部，以便 catch 块也能访问
    let prompt = '';
    try {
      prompt = this.buildPrompt(question, context);

      console.log(`Starting chat stream with model: ${this.model}`);

      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000, // 增加 token 限制以支持更长的回复
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('Error streaming answer:', error);
      // 如果 Claude 失败，尝试回退到 GPT-3.5
      if (this.model !== 'openai/gpt-3.5-turbo') {
         console.log('尝试回退到 gpt-3.5-turbo...');
         try {
            // 如果 prompt 为空（例如 buildPrompt 失败），重新构建
            if (!prompt) {
                prompt = this.buildPrompt(question, context);
            }

            const fallbackStream = await this.client.chat.completions.create({
                model: 'openai/gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
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
      throw new Error(`Failed to generate answer: ${error instanceof Error ? error.message : String(error)}`);
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
      const prompt = this.buildPrompt(question, context);

      console.log(`Generating answer with model: ${this.model}`);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      return response.choices[0]?.message?.content || '无法生成回答';
    } catch (error) {
      console.error('Error generating answer:', error);
      throw new Error(`Failed to generate answer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
