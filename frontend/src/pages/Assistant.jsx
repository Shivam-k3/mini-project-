import { useState, useRef, useEffect } from 'react';
import { aiAPI } from '../services/api';
import { FiSend, FiMessageSquare, FiCompass, FiPlus, FiCpu } from 'react-icons/fi';

const SUGGESTIONS = [
  { text: 'How can I reduce my emissions?', icon: '🌱' },
  { text: 'Suggest eco-friendly travel options', icon: '🚇' },
  { text: 'Give me a weekly sustainability plan', icon: '📅' },
  { text: 'Explain my carbon report', icon: '📊' },
];

const HISTORIES = [
  { id: 1, title: 'Commute offsets advice', date: 'Today' },
  { id: 2, title: 'Carpool vs metro savings', date: 'Yesterday' },
  { id: 3, title: 'EV vs petrol comparison', date: '3 days ago' },
];

export default function Assistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm EcoGuardian, your personal mobility advisor. I analyze your logged trips, travel modes and vehicle occupancy to give you tailored recommendations.\n\nHow can I help you cut your commute emissions today?",
      time: '12:00 PM'
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

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', content: msg, time: currentTime }]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await aiAPI.chat(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered a communication error with the LLM API. Please verify your keys or connection.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "New Session Initialized. Ask me anything about your carbon footprints, Decarbonization strategies, or SDG 13 targets.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-10rem)] flex flex-col">
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">AI Sustainability Assistant</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Powered by Gemini & OpenAI — Contextualized on your carbon logs</p>
        </div>
        <button onClick={handleNewChat} className="btn-secondary py-2 px-3 text-xs font-bold flex items-center gap-1.5 bg-white/60 dark:bg-gray-850 hover:bg-white/95">
          <FiPlus size={14} /> New Chat
        </button>
      </div>

      {/* Split Layout: History (Left) vs Chat Window (Right) */}
      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        
        {/* Left Panel: Chat Histories (Hidden on mobile) */}
        <div className="w-60 glass rounded-3xl p-4 flex flex-col justify-between hidden md:flex border border-gray-200/50 dark:border-white/5 bg-white/30">
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">Saved Sessions</h3>
            <div className="space-y-1">
              {HISTORIES.map((h) => (
                <button key={h.id} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-150 dark:hover:bg-gray-800/40 text-left font-medium transition-all group">
                  <FiMessageSquare className="text-gray-400 group-hover:text-eco-500 shrink-0" size={14} />
                  <span className="truncate">{h.title}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-eco-500/5 to-ocean-500/5 border border-eco-500/10 text-[10px] text-gray-400 leading-normal flex items-start gap-2">
            <FiCpu className="text-eco-500 shrink-0 mt-0.5" size={13} />
            <span>AI responses are fine-tuned dynamically on your carbon calculator history.</span>
          </div>
        </div>

        {/* Right Panel: Chat Interface */}
        <div className="flex-1 flex flex-col justify-between glass-card p-0 overflow-hidden border border-gray-200/50 dark:border-white/5">
          
          {/* Chat Bubble Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`flex items-start gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  
                  {/* Avatar bubble */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-eco-400 to-ocean-500 text-white' 
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}>
                    {msg.role === 'user' ? '👤' : '🤖'}
                  </div>

                  <div className="space-y-1">
                    <div className={`p-4 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-eco-500 to-ocean-500 text-white rounded-tr-none shadow-md shadow-eco-500/5'
                        : 'bg-gray-100/70 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-200/20 dark:border-white/5'
                    }`}>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed font-medium">{msg.content}</p>
                    </div>
                    <span className={`text-[9px] text-gray-400 block px-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      {msg.time}
                    </span>
                  </div>

                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-xs">🤖</div>
                  <div className="bg-gray-100/70 dark:bg-gray-800/40 p-4 rounded-2xl rounded-tl-none border border-gray-200/20 dark:border-white/5">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-eco-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-eco-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-eco-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Prompt Suggestions & Input Area */}
          <div className="p-4 border-t border-gray-200/50 dark:border-white/5 bg-white/20 dark:bg-gray-900/10 space-y-4">
            {/* Suggestions Chips (Only shown when convo is short) */}
            {messages.length <= 2 && (
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {SUGGESTIONS.map((s) => (
                  <button 
                    key={s.text} 
                    onClick={() => sendMessage(s.text)}
                    className="px-3.5 py-2 rounded-xl text-xs border border-gray-200/50 dark:border-white/5 bg-white/40 dark:bg-gray-900/40 hover:bg-white/80 dark:hover:bg-gray-900/80 text-gray-600 dark:text-gray-300 font-semibold transition-all duration-300 active:scale-95 flex items-center gap-1.5 select-none"
                  >
                    <span>{s.icon}</span> {s.text}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1 text-xs"
                placeholder="Ask about mode shifts, carpooling, EV swaps..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
              />
              <button 
                onClick={() => sendMessage()} 
                disabled={loading || !input.trim()} 
                className="btn-primary px-4 py-2 flex items-center justify-center active:scale-95 shrink-0"
              >
                <FiSend size={15} />
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
