import React from 'react';
import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    content: string;
    source: string;
  }>;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content, sources }) => {
  const [showSources, setShowSources] = React.useState(false);

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg',
        role === 'user' ? 'bg-blue-50 ml-auto max-w-[80%]' : 'bg-gray-50 max-w-full'
      )}
    >
      <div className="flex-shrink-0">
        {role === 'user' ? (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
      
      <div className="flex-1 space-y-2">
        <div className="text-sm font-medium text-gray-900">
          {role === 'user' ? '你' : 'AI 助手'}
        </div>
        
        <div className="text-gray-700 whitespace-pre-wrap">{content}</div>
        
        {sources && sources.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowSources(!showSources)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {showSources ? '隐藏来源' : `查看来源 (${sources.length})`}
            </button>
            
            {showSources && (
              <div className="mt-2 space-y-2">
                {sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-gray-200 rounded text-xs"
                  >
                    <div className="font-medium text-gray-900 mb-1">
                      来源 {idx + 1}: {source.source}
                    </div>
                    <div className="text-gray-600">{source.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
