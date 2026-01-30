'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload as UploadIcon, Trash2 } from 'lucide-react';
import { ChatMessage } from '@/components/ChatMessage';
import { FileUpload } from '@/components/FileUpload';
import { ChatMessage as ChatMessageType, streamChatMessage, deleteDocuments } from '@/lib/api';
import { generateUserId } from '@/lib/utils';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('userId');
      if (stored) return stored;
      const newId = generateUserId();
      localStorage.setItem('userId', newId);
      return newId;
    }
    return generateUserId();
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessageType = {
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let assistantContent = '';
      let sources: Array<{ content: string; source: string }> = [];

      await streamChatMessage(
        userMessage.content,
        userId,
        (chunk) => {
          assistantContent += chunk;
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = assistantContent;
            } else {
              newMessages.push({
                role: 'assistant',
                content: assistantContent,
              });
            }
            
            return newMessages;
          });
        },
        (newSources) => {
          sources = newSources;
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.sources = sources;
            }
            return newMessages;
          });
        }
      );
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '抱歉,发生了错误。请稍后重试。',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearDocuments = async () => {
    if (!confirm('确定要删除所有已上传的文档吗?')) return;

    try {
      await deleteDocuments(userId);
      alert('文档已成功删除');
    } catch (error) {
      alert('删除文档失败');
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: '文档已成功上传!现在你可以向我提问了。',
      },
    ]);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PDF 聊天助手</h1>
            <p className="text-sm text-gray-600">上传 PDF 文档并向 AI 提问</p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <UploadIcon className="w-4 h-4" />
              <span>上传文档</span>
            </button>
            
            <button
              onClick={handleClearDocuments}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>清空文档</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col max-w-6xl mx-auto w-full">
        {showUpload && (
          <div className="p-4 bg-white border-b border-gray-200">
            <FileUpload userId={userId} onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <UploadIcon className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">开始使用</h2>
                <p className="text-gray-600">
                  上传你的 PDF 文档,然后向 AI 助手提问任何关于文档内容的问题。
                </p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  上传第一个文档
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <ChatMessage key={index} {...message} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-4xl mx-auto flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题... (Shift+Enter 换行)"
              className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              disabled={loading}
            />
            
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Send className="w-5 h-5" />
              <span>发送</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
