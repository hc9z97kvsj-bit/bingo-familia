'use client';

import { useState } from 'react';
import { useBingoRealtime } from '../../../hooks/useBingoRealtime';
import Link from 'next/link';
import { ArrowLeft, Trophy, Search, Calendar, Clock, Ticket, CheckCircle2, AlertCircle, Phone, History } from 'lucide-react';
import { db } from '../../../lib/firebase';
import { ref, update } from 'firebase/database';

export default function HistorialPanel() {
  const { users, cards } = useBingoRealtime();
  const [searchTerm, setSearchTerm] = useState('');

  let allWins: any[] = [];
  
  users.forEach((user: any) => {
    if (user.winHistory) {
      // ACÁ ESTÁ EL CAMBIO CLAVE PARA VERCEL: (win: any) y (c: any)
      const userWins = Object.values(user.winHistory).map((win: any) => {
        const cardInfo = cards.find((c: any) => c.id === win.cardId);
        return {
          ...win,
          userName: user.name,
          userDni: user.dni,
          userPhone: user.phone,
          userId: user.id
        };
      });
      allWins = [...allWins, ...userWins];
    }
  });

  allWins.sort((a: any, b: any) => b.timestamp - a.timestamp);

  const filteredWins = allWins.filter((win: any) => 
    win.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    win.userDni?.includes(searchTerm) ||
    win.cardId?.includes(searchTerm)
  );

  const togglePayment = async (userId: string, winId: string, currentPaid: boolean) => {
    await update(ref(db, `users/${userId}/winHistory/${winId}`), { paid: !currentPaid });
  };

  const handleContactWhatsApp = (phone: string) => { 
    if(phone) window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank'); 
  };

  return (
    <div className="min-h-screen bg-[#010326] text-[#F2F2F2] p-4 md:p-8 font-sans selection:bg-[#4B68BF]/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <header className="bg-[#010326] border border-[#4B68BF]/50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="bg-white/10 p-3 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="w-6 h-6 text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-[#F2F2F2] tracking-tight uppercase flex items-center gap-2">
                <History className="w-6 h-6 text-[#F29188]" /> Auditoría de Premios
              </h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Registro inalterable de ganadores</p>
            </div>
          </div>

          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar DNI, Nombre o Cartón..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-80 bg-[#010326]/50 border border-[#4B68BF]/30 rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-white outline-none focus:border-[#F29188] transition-colors"
            />
          </div>
        </header>

        <div className="bg-[#010326] border border-[#4B68BF]/50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-6 rounded-[2rem] min-h-[500px]">
          {filteredWins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-500 opacity-50">
              <Trophy className="w-16 h-16 mb-4" />
              <p className="font-black uppercase tracking-widest">No hay registros de premios</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#4B68BF]/30 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="pb-3 pl-4">Jugador</th>
                    <th className="pb-3">Premio</th>
                    <th className="pb-3">Cartón</th>
                    <th className="pb-3">Fecha y Hora</th>
                    <th className="pb-3 text-right pr-4">Estado / Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWins.map((win: any, idx: number) => (
                    <tr key={win.id || idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 pl-4">
                        <div className="font-black text-sm text-white uppercase">{win.userName}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-2">
                          DNI: {win.userDni}
                          {win.userPhone && (
                            <button onClick={() => handleContactWhatsApp(win.userPhone)} className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {win.userPhone}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="font-black text-emerald-400 text-lg leading-none">${win.prize}</div>
                        <div className="text-[9px] font-black text-[#F29188] uppercase tracking-widest mt-1">{win.type}</div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1.5 bg-white/10 w-fit px-3 py-1.5 rounded-lg border border-white/10">
                          <Ticket className="w-4 h-4 text-[#4B68BF]" />
                          <span className="font-black text-sm text-white">{win.cardId}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300"><Calendar className="w-3.5 h-3.5" /> {win.dateString}</div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 mt-1"><Clock className="w-3 h-3" /> {win.timeString}</div>
                      </td>
                      <td className="py-4 text-right pr-4">
                        <button 
                          onClick={() => togglePayment(win.userId, win.id, win.paid)}
                          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border inline-flex items-center gap-2 ${win.paid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/20'}`}
                        >
                          {win.paid ? <><CheckCircle2 className="w-4 h-4" /> Pagado</> : <><AlertCircle className="w-4 h-4" /> Pagar</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}