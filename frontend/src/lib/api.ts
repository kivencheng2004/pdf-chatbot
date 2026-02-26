import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60秒超时
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    content: string;
    source: string;
  }>;
}

export interface UploadResult {
  success: boolean;
  message: string;
  documentsCreated: number;
  files: Array<{
    name: string;
    type: string;
    size: number;
  }>;
}

export interface SupportedTypes {
  mimeTypes: string[];
  extensions: string[];
  description: Record<string, string>;
}

/**
 * 上传文件（支持多种格式）
 */
export const uploadFiles = async (files: File[], userId?: string): Promise<UploadResult> => {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });
  if (userId) {
    formData.append('userId', userId);
  }

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000, // 上传超时设为2分钟
  });

  return response.data;
};

/**
 * 兼容旧的 API 名称
 * @deprecated 使用 uploadFiles 代替
 */
export const uploadPDFs = uploadFiles;

/**
 * 发送聊天消息（非流式）
 */
export const sendChatMessage = async (
  question: string,
  userId?: string
): Promise<{
  answer: string;
  sources: Array<{ content: string; source: string }>;
}> => {
  const response = await api.post('/chat', {
    question,
    userId,
    stream: false,
  });

  return response.data;
};

/**
 * 发送聊天消息（流式）
 */
export const streamChatMessage = async (
  question: string,
  userId: string | undefined,
  onChunk: (chunk: string) => void,
  onSources: (sources: Array<{ content: string; source: string }>) => void
): Promise<void> => {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      userId,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          
          if (data.content) {
            onChunk(data.content);
          }
          
          if (data.sources) {
            onSources(data.sources);
          }
          
          if (data.error) {
            throw new Error(data.error);
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            console.warn('Failed to parse SSE data:', line);
          } else {
            throw e;
          }
        }
      }
    }
  }

  // 处理剩余的 buffer
  if (buffer.startsWith('data: ')) {
    try {
      const data = JSON.parse(buffer.slice(6));
      if (data.sources) {
        onSources(data.sources);
      }
    } catch (e) {
      // 忽略解析错误
    }
  }
};

/**
 * 删除所有文档
 */
export const deleteDocuments = async (userId?: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete('/documents', {
    data: { userId },
  });

  return response.data;
};

/**
 * 获取支持的文件类型
 */
export const getSupportedTypes = async (): Promise<SupportedTypes> => {
  const response = await api.get('/supported-types');
  return response.data;
};

/**
 * 健康检查
 */
export const checkHealth = async (): Promise<{
  status: string;
  timestamp: string;
  version: string;
  features: Record<string, boolean>;
}> => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
