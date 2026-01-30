import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';

export class PDFService {
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor() {
    // 初始化文本分割器
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', ' ', ''],
    });
  }

  /**
   * 从 PDF 缓冲区提取文本
   */
  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * 处理 PDF 文件并转换为文档块
   */
  async processPDF(
    buffer: Buffer,
    filename: string
  ): Promise<Document[]> {
    try {
      // 提取文本
      const text = await this.extractTextFromPDF(buffer);

      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in PDF');
      }

      // 分割文本为块
      const documents = await this.textSplitter.createDocuments(
        [text],
        [
          {
            source: filename,
            type: 'pdf',
          },
        ]
      );

      console.log(`Processed PDF into ${documents.length} chunks`);
      return documents;
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw new Error('Failed to process PDF file');
    }
  }

  /**
   * 批量处理多个 PDF 文件
   */
  async processPDFs(
    files: Array<{ buffer: Buffer; filename: string }>
  ): Promise<Document[]> {
    const allDocuments: Document[] = [];

    for (const file of files) {
      const documents = await this.processPDF(file.buffer, file.filename);
      allDocuments.push(...documents);
    }

    return allDocuments;
  }
}
