import { useState, useRef, useEffect } from 'react';
import { aiAPI } from '../services/api';
import { FiSend, FiMessageCircle, FiUser, FiMessageSquare, FiPlus, FiCpu, FiTrendingDown, FiMapPin, FiCalendar, FiBarChart2 } from 'react-icons/fi';

const SUGGESTIONS = [
  { text: 'How can I reduce my emissions?', icon: <FiTrendingDown size={13} /> },
  { text: 'Suggest eco-friendly travel options', icon: <FiMapPin size={13} /> },
  { text: 'Give me a weekly sustainability plan', icon: <FiCalendar size={13} /> },
  { text: 'Explain my carbon report', icon: <FiBarChart2 size={13} /> },
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
        content: "New session started. Ask me anything about your trip emissions, travel modes, carpooling, EV swaps, or how to reduce your daily commute footprint.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-10rem)] flex flex-col">

      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-eco-700 dark:text-eco-400">Personal Mobility Intelligence</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white">AI Sustainability Assistant</h1>
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">Powered by Gemini & OpenAI, contextualized on your carbon logs</p>
        </div>
        <button onClick={handleNewChat} className="btn-secondary text-sm flex items-center gap-1.5">
          <FiPlus size={14} /> New Chat
        </button>
      </div>

      {/* Split Layout: History (Left) vs Chat Window (Right) */}
      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">

        {/* Left Panel: Chat Histories (Hidden on mobile) */}
        <div className="hidden md:flex w-64 shrink-0 card p-4 flex-col justify-between">
          <div className="space-y-4">
            <h3 className="section-label px-1">Saved Sessions</h3>
            <div className="space-y-1">
              {HISTORIES.map((h) => (
                <button key={h.id} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-ink-700 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 text-left font-medium transition-colors group">
                  <FiMessageCircle className="text-ink-400 group-hover:text-eco-600 dark:group-hover:text-eco-400 shrink-0" size={14} />
                  <span className="truncate min-w-0 flex-1">{h.title}</span>
                  <span className="text-[9px] text-ink-400 dark:text-ink-500 shrink-0">{h.date}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/40 p-3 text-[10px] text-ink-500 dark:text-ink-400 leading-normal flex items-start gap-2">
            <FiCpu className="text-eco-600 dark:text-eco-400 shrink-0 mt-0.5" size={13} />
            <span>AI responses are fine-tuned dynamically on your carbon calculator history.</span>
          </div>
        </div>

        {/* Right Panel: Chat Interface */}
        <div className="flex-1 flex flex-col card-flush overflow-hidden min-w-0">

          {/* Chat Bubble Area */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 min-h-0">
            <div className="flex flex-col gap-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start gap-3 max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>

                    {/* Avatar bubble */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      msg.role === 'user'
                        ? 'bg-eco-600 text-white'
                        : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-300'
                    }`}>
                      {msg.role === 'user' ? <FiUser size={14} /> : <FiMessageSquare size={14} />}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className={`p-3.5 rounded-xl ${
                        msg.role === 'user'
                          ? 'bg-eco-600 text-white rounded-tr-none'
                          : 'bg-ink-100 dark:bg-ink-800 text-ink-800 dark:text-ink-200 rounded-tl-none border border-ink-200/70 dark:border-ink-700'
                      }`}>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed font-medium">{msg.content}</p>
                      </div>
                      <span className={`text-[9px] text-ink-400 dark:text-ink-500 block px-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                        {msg.time}
                      </span>
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {loading && (
              <div className="flex justify-start mt-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-500 dark:text-ink-300">
                    <FiMessageSquare size={14} />
                  </div>
                  <div className="bg-ink-100 dark:bg-ink-800 p-4 rounded-xl rounded-tl-none border border-ink-200/70 dark:border-ink-700">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-eco-600 dark:bg-eco-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-eco-600 dark:bg-eco-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-eco-600 dark:bg-eco-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Prompt Suggestions & Input Area */}
          <div className="p-4 border-t border-ink-200 dark:border-ink-800 bg-surface-1 dark:bg-ink-950 space-y-4">
            {/* Suggestions Chips (Only shown when convo is short) */}
            {messages.length <= 2 && (
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => sendMessage(s.text)}
                    className="px-3.5 py-2 rounded-lg text-xs border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 font-semibold transition-colors flex items-center gap-1.5 select-none"
                  >
                    <span className="text-eco-600 dark:text-eco-400 shrink-0">{s.icon}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="flex gap-2">
              <input
                type="text"
                className="input-field flex-1 text-sm"
                placeholder="Ask about mode shifts, carpooling, EV swaps..."
                aria-label="Message the assistant"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="btn-primary px-4 py-2 flex items-center justify-center shrink-0"
                aria-label="Send message"
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
