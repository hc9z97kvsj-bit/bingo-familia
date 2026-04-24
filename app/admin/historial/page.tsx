'use client';

import { useState } from 'react';
import { useBingoRealtime } from '../../../hooks/useBingoRealtime';
import Link from 'next/link';
import { 
  ArrowLeft, Search, Trophy, CheckCircle2, 
  AlertCircle, Calendar, Clock, Ticket, 
  UserCircle, CreditCard, Hash, Award
} from 'lucide-react';

export default function HistorialPanel() {
  const { users, cards } = useBingoRealtime();
  const [searchTerm, setSearchTerm] = useState('');

  // Extraemos todos los premios de todos los usuarios y los ordenamos del más nuevo al más viejo
  const historial = users.flatMap(user => {
    if (!user.winHistory) return [];
    return Object.values(user.winHistory).map(win => {
      // Buscamos el cartón para obtener su número de serie
      const cardInfo = cards.find(c => c.id === win.cardId);
      return {
        ...win,
        userDni: user.dni,
        userName: user.name,
        serial: cardInfo ? cardInfo.serial : 'N/D',
      };
    });
  }).sort((a, b) => b.timestamp - a.timestamp);

  // Filtro de búsqueda
  const filteredHistorial = historial.filter(record => 
    record.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    record.userDni.includes(searchTerm) ||
    record.cardId.includes(searchTerm)
  );

  // Estadísticas rápidas
  const totalPremios = filteredHistorial.length;
  const dineroPagado = filteredHistorial.filter(h => h.paid).reduce((acc, curr) => acc + curr.prize, 0);
  const dineroPendiente = filteredHistorial.filter(h => !h.paid).reduce((acc, curr) => acc + curr.prize, 0);

  return (
    <div className="min-h-screen bg-[#010326] text-[#F2F2F2] p-4 md:p-8 font-sans selection:bg-[#4B68BF]/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="bg-[#010326] border border-[#4B68BF]/50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-6 md:px-8 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
          <div className="flex items-center gap-4 z-10 w-full md:w-auto">
            <Link href="/admin" className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 transition-colors text-slate-300 hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-black text-[#F2F2F2] tracking-tight uppercase flex items-center gap-3">
                <Trophy className="w-8 h-8 text-[#F29188]" /> Historial de Premios
              </h1>
              <p className="text-[#4B68BF] font-bold text-xs tracking-wider uppercase mt-1">Registro de Auditoría General</p>
            </div>
          </div>

          <div className="relative w-full md:w-96 z-10">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por DNI, Nombre o Cartón..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-[#4B68BF]/30 rounded-xl py-3 pl-12 pr-4 text-[#F2F2F2] placeholder:text-slate-500 focus:outline-none focus:border-[#F29188] transition-colors shadow-inner"
            />
          </div>
        </header>

        {/* MÉTRICAS RÁPIDAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-[#4B68BF]/20 p-6 rounded-[2rem] flex items-center gap-4 shadow-lg">
            <div className="bg-[#4B68BF]/20 p-4 rounded-2xl border border-[#4B68BF]/30"><Award className="w-8 h-8 text-[#4B68BF]" /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Premios Registrados</p>
              <p className="text-3xl font-black text-white">{totalPremios}</p>
            </div>
          </div>
          <div className="bg-white/5 border border-emerald-500/20 p-6 rounded-[2rem] flex items-center gap-4 shadow-lg">
            <div className="bg-emerald-500/20 p-4 rounded-2xl border border-emerald-500/30"><CheckCircle2 className="w-8 h-8 text-emerald-400" /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pagado</p>
              <p className="text-3xl font-black text-emerald-400">${dineroPagado}</p>
            </div>
          </div>
          <div className="bg-white/5 border border-[#F22613]/20 p-6 rounded-[2rem] flex items-center gap-4 shadow-lg">
            <div className="bg-[#F22613]/20 p-4 rounded-2xl border border-[#F22613]/30"><AlertCircle className="w-8 h-8 text-[#F22613]" /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deuda Pendiente</p>
              <p className="text-3xl font-black text-[#F22613]">${dineroPendiente}</p>
            </div>
          </div>
        </div>

        {/* TABLA DE AUDITORÍA */}
        <div className="bg-[#010326] border border-[#4B68BF]/50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] rounded-[2rem] overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-[#4B68BF] text-white text-[10px] uppercase tracking-widest">
                  <th className="px-6 py-4 font-black border-r border-white/10"><div className="flex items-center gap-2"><CreditCard className="w-3.5 h-3.5"/> DNI</div></th>
                  <th className="px-6 py-4 font-black border-r border-white/10"><div className="flex items-center gap-2"><UserCircle className="w-3.5 h-3.5"/> Jugador</div></th>
                  <th className="px-6 py-4 font-black border-r border-white/10"><div className="flex items-center gap-2"><Ticket className="w-3.5 h-3.5"/> Nº Cartón</div></th>
                  <th className="px-6 py-4 font-black border-r border-white/10"><div className="flex items-center gap-2"><Hash className="w-3.5 h-3.5"/> Serie</div></th>
                  <th className="px-6 py-4 font-black border-r border-white/10"><div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5"/> Fecha</div></th>
                  <th className="px-6 py-4 font-black border-r border-white/10"><div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5"/> Hora</div></th>
                  <th className="px-6 py-4 font-black border-r border-white/10"><div className="flex items-center gap-2"><Award className="w-3.5 h-3.5"/> Premio</div></th>
                  <th className="px-6 py-4 font-black"><div className="flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5"/> Estado</div></th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {filteredHistorial.length > 0 ? filteredHistorial.map((record, i) => (
                  <tr key={record.id} className={`border-b border-white/5 transition-colors hover:bg-white/5 ${i % 2 === 0 ? 'bg-black/20' : 'bg-transparent'}`}>
                    <td className="px-6 py-4 text-slate-300 font-mono">{record.userDni}</td>
                    <td className="px-6 py-4 text-white font-bold uppercase">{record.userName}</td>
                    <td className="px-6 py-4 text-[#F29188] font-black">Cº {record.cardId}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-mono">{record.serial}</td>
                    <td className="px-6 py-4 text-slate-300">{record.dateString}</td>
                    <td className="px-6 py-4 text-slate-300">{record.timeString}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[#4B68BF] font-black text-[10px] uppercase tracking-widest">{record.type}</span>
                        <span className="text-emerald-400 font-black text-lg">${record.prize}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {record.paid ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-[#F22613]/10 text-[#F22613] border border-[#F22613]/30 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">
                          <AlertCircle className="w-3.5 h-3.5" /> Pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      No se encontraron registros de premios con esa búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}