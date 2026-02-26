import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';

/**
 * 支持的文件类型
 */
export const SUPPORTED_FILE_TYPES = {
  // PDF
  'application/pdf': 'pdf',
  // Word
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  // Excel
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  // PowerPoint
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  // 文本格式
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/json': 'json',
  'text/html': 'html',
  // 图片 (用于 OCR)
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_FILE_TYPES;

/**
 * 获取支持的 MIME 类型列表
 */
export function getSupportedMimeTypes(): string[] {
  return Object.keys(SUPPORTED_FILE_TYPES);
}

/**
 * 获取支持的文件扩展名列表
 */
export function getSupportedExtensions(): string[] {
  return [...new Set(Object.values(SUPPORTED_FILE_TYPES))];
}

/**
 * 检查文件类型是否支持
 */
export function isFileTypeSupported(mimeType: string): boolean {
  return mimeType in SUPPORTED_FILE_TYPES;
}

/**
 * 根据文件扩展名获取 MIME 类型
 */
export function getMimeTypeFromExtension(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase().slice(1);
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    html: 'text/html',
    htm: 'text/html',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
  };
  return mimeMap[ext] || null;
}

/**
 * 文档转换服务
 * 支持将多种文件格式转换为 Markdown，然后分割成文档块
 */
export class DocumentConverterService {
  private textSplitter: RecursiveCharacterTextSplitter;
  private pythonPath: string;

  constructor() {
    // 初始化文本分割器
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '。', '！', '？', '.', '!', '?', ' ', ''],
    });

    // Python 路径 - 支持环境变量配置
    this.pythonPath = process.env.PYTHON_PATH || 'python';
  }

  /**
   * 使用 MarkItDown 转换文件到 Markdown
   */
  private async convertWithMarkItDown(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // 创建临时文件
      const tempDir = os.tmpdir();
      const ext = path.extname(filename) || `.${SUPPORTED_FILE_TYPES[mimeType as SupportedMimeType]}`;
      const tempFilePath = path.join(tempDir, `markitdown_${Date.now()}${ext}`);
      
      try {
        // 写入临时文件
        fs.writeFileSync(tempFilePath, buffer);
        
        // 调用 Python markitdown
        const pythonScript = `
import sys
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("${tempFilePath.replace(/\\/g, '\\\\')}")
print(result.text_content)
`;
        
        const process = spawn(this.pythonPath, ['-c', pythonScript]);
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', (code) => {
          // 清理临时文件
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            console.warn('Failed to delete temp file:', tempFilePath);
          }
          
          if (code === 0) {
            resolve(stdout.trim());
          } else {
            reject(new Error(`MarkItDown conversion failed: ${stderr || 'Unknown error'}`));
          }
        });
        
        process.on('error', (err) => {
          // 清理临时文件
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            console.warn('Failed to delete temp file:', tempFilePath);
          }
          reject(new Error(`Failed to start Python process: ${err.message}`));
        });
        
      } catch (error) {
        // 清理临时文件
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          // 忽略
        }
        reject(error);
      }
    });
  }

  /**
   * 使用内置方法转换 PDF (备用方案)
   */
  private async convertPdfFallback(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * 转换纯文本格式
   */
  private convertPlainText(buffer: Buffer): string {
    return buffer.toString('utf-8');
  }

  /**
   * 转换 CSV 到 Markdown 表格
   */
  private convertCsvToMarkdown(buffer: Buffer): string {
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return '';
    
    const rows = lines.map(line => {
      // 简单的 CSV 解析 (不处理引号内的逗号)
      return line.split(',').map(cell => cell.trim());
    });
    
    if (rows.length === 0) return '';
    
    // 构建 Markdown 表格
    let markdown = '';
    
    // 表头
    markdown += '| ' + rows[0].join(' | ') + ' |\n';
    markdown += '| ' + rows[0].map(() => '---').join(' | ') + ' |\n';
    
    // 数据行
    for (let i = 1; i < rows.length; i++) {
      markdown += '| ' + rows[i].join(' | ') + ' |\n';
    }
    
    return markdown;
  }

  /**
   * 转换 JSON 到 Markdown
   */
  private convertJsonToMarkdown(buffer: Buffer): string {
    try {
      const content = buffer.toString('utf-8');
      const data = JSON.parse(content);
      
      // 递归转换 JSON 为可读文本
      const convertValue = (value: any, indent: number = 0): string => {
        const prefix = '  '.repeat(indent);
        
        if (value === null) return `${prefix}null`;
        if (typeof value !== 'object') return `${prefix}${value}`;
        
        if (Array.isArray(value)) {
          return value.map((item, i) => `${prefix}- ${convertValue(item, 0)}`).join('\n');
        }
        
        return Object.entries(value)
          .map(([k, v]) => {
            if (typeof v === 'object' && v !== null) {
              return `${prefix}**${k}:**\n${convertValue(v, indent + 1)}`;
            }
            return `${prefix}**${k}:** ${v}`;
          })
          .join('\n');
      };
      
      return convertValue(data);
    } catch (error) {
      // 如果 JSON 解析失败，返回原始内容
      return buffer.toString('utf-8');
    }
  }

  /**
   * 主转换方法 - 将文件转换为 Markdown 文本
   */
  async convertToMarkdown(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    console.log(`Converting file: ${filename} (${mimeType})`);
    
    // 首先尝试使用 MarkItDown
    try {
      const result = await this.convertWithMarkItDown(buffer, filename, mimeType);
      if (result && result.trim().length > 0) {
        console.log(`Successfully converted ${filename} using MarkItDown`);
        return result;
      }
    } catch (error) {
      console.warn(`MarkItDown conversion failed for ${filename}, trying fallback:`, error);
    }
    
    // 备用方案：根据文件类型使用内置转换器
    switch (mimeType) {
      case 'application/pdf':
        return this.convertPdfFallback(buffer);
        
      case 'text/plain':
      case 'text/markdown':
        return this.convertPlainText(buffer);
        
      case 'text/csv':
        return this.convertCsvToMarkdown(buffer);
        
      case 'application/json':
        return this.convertJsonToMarkdown(buffer);
        
      case 'text/html':
        // HTML 直接返回文本内容（简化处理）
        return buffer.toString('utf-8').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
      default:
        throw new Error(`Unsupported file type: ${mimeType}. Please install MarkItDown for extended format support.`);
    }
  }

  /**
   * 处理单个文件并转换为文档块
   */
  async processFile(buffer: Buffer, filename: string, mimeType: string): Promise<Document[]> {
    try {
      // 转换为 Markdown
      const markdown = await this.convertToMarkdown(buffer, filename, mimeType);
      
      if (!markdown || markdown.trim().length === 0) {
        throw new Error('No text content found in file');
      }
      
      // 分割文本为块
      const documents = await this.textSplitter.createDocuments(
        [markdown],
        [
          {
            source: filename,
            type: SUPPORTED_FILE_TYPES[mimeType as SupportedMimeType] || 'unknown',
            originalMimeType: mimeType,
          },
        ]
      );
      
      console.log(`Processed ${filename} into ${documents.length} chunks`);
      return documents;
    } catch (error) {
      console.error(`Error processing file ${filename}:`, error);
      throw new Error(`Failed to process file: ${filename}`);
    }
  }

  /**
   * 批量处理多个文件
   */
  async processFiles(
    files: Array<{ buffer: Buffer; filename: string; mimeType: string }>
  ): Promise<Document[]> {
    const allDocuments: Document[] = [];
    const errors: string[] = [];
    
    for (const file of files) {
      try {
        const documents = await this.processFile(file.buffer, file.filename, file.mimeType);
        allDocuments.push(...documents);
      } catch (error) {
        const errorMsg = `Failed to process ${file.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    // 如果所有文件都失败了，抛出错误
    if (allDocuments.length === 0 && errors.length > 0) {
      throw new Error(`All files failed to process:\n${errors.join('\n')}`);
    }
    
    // 如果部分文件失败，记录警告但继续
    if (errors.length > 0) {
      console.warn(`Some files failed to process:\n${errors.join('\n')}`);
    }
    
    return allDocuments;
  }
}
