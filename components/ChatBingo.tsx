'use client';
import { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { ref, push, onValue, serverTimestamp } from 'firebase/database';
import { Lock } from 'lucide-react'; // <-- ¡ACÁ FALTABA ESTO!

export default function ChatBingo({ userId, userName, isLogged }: { userId: string, userName: string, isLogged: boolean }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Escuchar mensajes en tiempo real
  useEffect(() => {
    const chatRef = ref(db, 'chat/messages');
    const unsub = onValue(chatRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const msgs = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        // Ordenamos por tiempo y mostramos solo los últimos 50 para no saturar
        setMessages(msgs.sort((a, b) => a.timestamp - b.timestamp).slice(-50));
      } else {
        setMessages([]);
      }
    });
    return () => unsub();
  }, []);

  // Bajar el scroll automáticamente cuando llega un mensaje nuevo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !isLogged) return;
    
    await push(ref(db, 'chat/messages'), {
      userId,
      userName,
      text: newMessage.trim(),
      timestamp: serverTimestamp()
    });
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-[350px] md:h-[420px] bg-white rounded-t-xl rounded-b-3xl shadow-xl overflow-hidden relative border border-slate-100">
      
      {/* CABECERA DEL CHAT */}
      <div className="p-4 bg-white z-10 text-center flex flex-col items-center shadow-sm">
        <h3 className="font-black text-[#010326] tracking-widest text-lg md:text-xl uppercase">Chat Bingo</h3>
        <span className="bg-[#F22613] text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest mt-1">
          Conecta con usuarios conectados
        </span>
      </div>

      {/* LISTA DE MENSAJES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.userId === userId ? 'items-end' : 'items-start'}`}>
            <span className="text-[9px] font-bold text-slate-400 mb-0.5 ml-1">{msg.userName}</span>
            <div className={`px-4 py-2 rounded-2xl text-xs md:text-sm max-w-[85%] shadow-sm ${msg.userId === userId ? 'bg-[#4B68BF] text-white rounded-tr-sm' : 'bg-white text-slate-700 rounded-tl-sm border border-slate-200'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ZONA DE ESCRITURA */}
      <form onSubmit={handleSend} className="p-3 bg-white flex gap-2 border-t border-slate-100">
        <div className="flex-1 bg-slate-200 rounded-2xl flex items-center pr-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={!isLogged}
            placeholder={isLogged ? "Escribe un mensaje..." : "Regístrate para chatear..."}
            className="flex-1 px-4 py-3 bg-transparent border-none outline-none text-sm disabled:opacity-50 text-slate-700 font-medium"
          />
          <button 
            type="submit" 
            title="Enviar mensaje"
            aria-label="Enviar mensaje"
            disabled={!isLogged || !newMessage.trim()} 
            className="text-slate-600 font-black text-[10px] uppercase tracking-widest px-3 py-2 disabled:opacity-30 transition-all hover:text-[#4B68BF]"
          >
            Enviar
          </button>
        </div>
      </form>

      {/* BLOQUEO TRANSPARENTE SI NO ESTÁ REGISTRADO */}
      {!isLogged && (
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-20 flex items-center justify-center p-6 text-center transition-all">
          <div className="bg-white p-5 rounded-3xl shadow-2xl border-2 border-slate-100 animate-in zoom-in-95">
            <Lock className="w-8 h-8 text-[#4B68BF] mx-auto mb-2 opacity-50" />
            <p className="font-black text-slate-800 text-sm uppercase tracking-tight">Chat Bloqueado</p>
            <p className="text-xs text-slate-500 font-medium mt-1 leading-snug">Ingresa tus datos a la derecha para unirte a la conversación.</p>
          </div>
        </div>
      )}

    </div>
  );
}