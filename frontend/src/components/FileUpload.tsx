import React, { useRef, useState } from 'react';
import { Upload, File, X, Loader2, FileText, Table, Presentation } from 'lucide-react';
import { uploadFiles } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';

interface FileUploadProps {
  userId?: string;
  onUploadComplete?: () => void;
}

// 支持的文件类型
const SUPPORTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.txt', '.md', '.csv', '.json', '.html', '.htm'
];

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
];

// 获取文件图标
const getFileIcon = (filename: string) => {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'pdf':
      return <FileText className="w-5 h-5 text-red-500" />;
    case 'doc':
    case 'docx':
      return <FileText className="w-5 h-5 text-blue-500" />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <Table className="w-5 h-5 text-green-500" />;
    case 'ppt':
    case 'pptx':
      return <Presentation className="w-5 h-5 text-orange-500" />;
    default:
      return <File className="w-5 h-5 text-gray-500" />;
  }
};

// 获取文件类型描述
const getFileTypeDescription = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop();
  
  const typeMap: Record<string, string> = {
    pdf: 'PDF 文档',
    doc: 'Word 文档',
    docx: 'Word 文档',
    xls: 'Excel 表格',
    xlsx: 'Excel 表格',
    ppt: 'PowerPoint',
    pptx: 'PowerPoint',
    txt: '纯文本',
    md: 'Markdown',
    csv: 'CSV 表格',
    json: 'JSON 数据',
    html: 'HTML 网页',
    htm: 'HTML 网页',
  };
  
  return typeMap[ext || ''] || '文件';
};

// 检查文件是否支持
const isFileSupported = (file: File): boolean => {
  const ext = '.' + file.name.toLowerCase().split('.').pop();
  return SUPPORTED_EXTENSIONS.includes(ext) || SUPPORTED_MIME_TYPES.includes(file.type);
};

export const FileUpload: React.FC<FileUploadProps> = ({ userId, onUploadComplete }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // 过滤支持的文件
    const supportedFiles = selectedFiles.filter(isFileSupported);
    const unsupportedCount = selectedFiles.length - supportedFiles.length;
    
    if (unsupportedCount > 0) {
      setError(`${unsupportedCount} 个文件不支持，已忽略。支持的格式: PDF, Word, Excel, PPT, TXT, CSV, JSON, HTML, Markdown`);
    } else {
      setError(null);
    }
    
    if (supportedFiles.length === 0) {
      return;
    }
    
    // 最多 10 个文件
    if (files.length + supportedFiles.length > 10) {
      setError('最多只能上传 10 个文件');
      return;
    }
    
    // 检查单个文件大小（20MB）
    const oversizedFiles = supportedFiles.filter(f => f.size > 20 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError(`${oversizedFiles.map(f => f.name).join(', ')} 超过 20MB 限制`);
      return;
    }
    
    setFiles(prev => [...prev, ...supportedFiles].slice(0, 10));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('请先选择文件');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setProgress('准备上传...');

    try {
      setProgress(`正在上传 ${files.length} 个文件...`);
      const result = await uploadFiles(files, userId);
      
      setSuccess(`成功处理 ${result.documentsCreated} 个文档块`);
      setFiles([]);
      setProgress(null);
      
      if (onUploadComplete) {
        onUploadComplete();
      }
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || '上传失败，请重试');
      setProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const supportedFiles = droppedFiles.filter(isFileSupported);
    
    if (supportedFiles.length === 0) {
      setError('拖放的文件不支持，请选择 PDF、Word、Excel、PPT 等格式');
      return;
    }
    
    if (files.length + supportedFiles.length > 10) {
      setError('最多只能上传 10 个文件');
      return;
    }
    
    setFiles(prev => [...prev, ...supportedFiles].slice(0, 10));
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="w-full space-y-4">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer bg-white"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">点击或拖拽上传文档</p>
        <p className="text-xs text-gray-500 mb-3">
          支持 PDF、Word、Excel、PowerPoint、TXT、CSV、JSON、HTML、Markdown
        </p>
        <p className="text-xs text-gray-400">最多 10 个文件，每个最大 20MB</p>
        
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_EXTENSIONS.join(',')}
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">
            已选择的文件 ({files.length}/10):
          </h3>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(file.name)}
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate" title={file.name}>
                      {file.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getFileTypeDescription(file.name)} · {formatFileSize(file.size)}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-1.5 hover:bg-gray-200 rounded-full flex-shrink-0"
                  disabled={uploading}
                  title="移除文件"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{progress || '处理中...'}</span>
              </>
            ) : (
              <span>上传并处理文件</span>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}
    </div>
  );
};
