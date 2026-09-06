import { useState } from 'react';
import { Send } from 'lucide-react';

const INITIAL_MESSAGES = [
  { id: 'm1', user: 'Alex', text: 'Starting a 45 min pomodoro now.', time: '10:02 AM' },
  { id: 'm2', user: 'Sarah', text: 'Good luck!', time: '10:03 AM' },
  { id: 'm3', user: 'System', text: 'Soham joined the room.', time: '10:15 AM', isSystem: true },
];

export function RoomActivity() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setMessages([
      ...messages,
      {
        id: Date.now().toString(),
        user: 'You',
        text: input,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setInput('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-[300px]">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-900 tracking-tight">Room Activity</h3>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`text-sm ${msg.isSystem ? 'text-center' : ''}`}>
            {msg.isSystem ? (
              <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-medium">
                {msg.text}
              </span>
            ) : (
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-medium text-slate-900">{msg.user}</span>
                  <span className="text-xs text-slate-400">{msg.time}</span>
                </div>
                <p className="text-slate-700 bg-slate-50 inline-block px-3 py-2 rounded-lg rounded-tl-none border border-slate-100">
                  {msg.text}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-200 bg-white">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 transition-shadow"
          />
          <button 
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
