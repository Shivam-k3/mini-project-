import { useState, useRef, useEffect } from 'react';
import { aiAPI } from '../services/api';
import { FiSend, FiMessageCircle } from 'react-icons/fi';

const SUGGESTIONS = [
  'How can I reduce my emissions?',
  'Suggest eco-friendly travel options',
  'Give me a weekly sustainability plan',
  'Explain my carbon report',
];

export default function Assistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm EcoGuardian AI, your personal sustainability assistant for SDG 13 Climate Action. I can help you reduce emissions, plan eco-friendly travel, and explain your carbon footprint. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input;
    if (!msg.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await aiAPI.chat(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">AI Sustainability Assistant</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Powered by Gemini/OpenAI — personalized for your data</p>
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => sendMessage(s)}
            className="px-3 py-1.5 rounded-full text-sm glass hover:bg-eco-50 dark:hover:bg-eco-900/20
                       text-gray-600 dark:text-gray-300 transition-all">
            {s}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="flex-1 glass-card overflow-y-auto space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl ${
              msg.role === 'user'
                ? 'bg-gradient-to-r from-eco-500 to-ocean-500 text-white rounded-br-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2 text-eco-600 dark:text-eco-400 text-sm font-medium">
                  <FiMessageCircle size={14} /> EcoGuardian AI
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-eco-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-eco-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-eco-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          className="input-field flex-1"
          placeholder="Ask about sustainability, emissions, or get recommendations..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
        />
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()} className="btn-primary px-4">
          <FiSend size={20} />
        </button>
      </div>
    </div>
  );
}
