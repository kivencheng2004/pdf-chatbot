import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    content: string;
    source: string;
  }>;
}

export const uploadPDFs = async (files: File[], userId?: string) => {
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
  });

  return response.data;
};

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

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n\n');

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
          console.error('Error parsing SSE data:', e);
        }
      }
    }
  }
};

export const deleteDocuments = async (userId?: string) => {
  const response = await api.delete('/documents', {
    data: { userId },
  });

  return response.data;
};

export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
