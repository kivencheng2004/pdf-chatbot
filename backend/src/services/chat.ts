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
    this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-sonnet';
  }

  /**
   * 构建带上下文的提示词
   */
  private buildPrompt(question: string, context: Document[]): string {
    const contextText = context
      .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
      .join('\n\n');

    return `你是一个有帮助的 AI 助手,专门回答关于用户上传的 PDF 文档的问题。

以下是相关的文档内容:

${contextText}

基于以上内容,请回答以下问题。如果答案不在提供的文档中,请明确说明。

问题: ${question}

回答:`;
  }

  /**
   * 生成回答 (流式)
   */
  async *streamAnswer(
    question: string,
    context: Document[]
  ): AsyncGenerator<string, void, unknown> {
    try {
      const prompt = this.buildPrompt(question, context);

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
        max_tokens: 1000,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error('Error streaming answer:', error);
      throw new Error('Failed to generate answer');
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

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || '无法生成回答';
    } catch (error) {
      console.error('Error generating answer:', error);
      throw new Error('Failed to generate answer');
    }
  }
}
