import React, { useRef, useState } from 'react';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { uploadPDFs } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';

interface FileUploadProps {
  userId?: string;
  onUploadComplete?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ userId, onUploadComplete }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const pdfFiles = selectedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== selectedFiles.length) {
      setError('只支持 PDF 文件');
      return;
    }
    
    if (pdfFiles.length > 5) {
      setError('最多只能上传 5 个文件');
      return;
    }
    
    setFiles(prev => [...prev, ...pdfFiles].slice(0, 5));
    setError(null);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('请先选择文件');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadPDFs(files, userId);
      setSuccess(`成功上传 ${result.documentsCreated} 个文档块`);
      setFiles([]);
      
      if (onUploadComplete) {
        onUploadComplete();
      }
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || '上传失败,请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">点击或拖拽上传 PDF 文件</p>
        <p className="text-xs text-gray-500">最多 5 个文件,每个最大 10MB</p>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">已选择的文件:</h3>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <File className="w-5 h-5 text-red-500" />
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{file.name}</div>
                  <div className="text-gray-500">{formatFileSize(file.size)}</div>
                </div>
              </div>
              
              <button
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-gray-200 rounded"
                disabled={uploading}
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          ))}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>上传中...</span>
              </>
            ) : (
              <span>上传文件</span>
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
