'use client';

import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { ref, update, set } from 'firebase/database';
import { useBingoRealtime } from '../../hooks/useBingoRealtime';
import { generateCards } from '../../lib/generator';
import { WinningMode, WinnerInfo } from '../types/bingo';
import Link from 'next/link';
import { 
  Trophy, Banknote, Play, Square, RotateCcw, 
  RefreshCw, Settings, Users, CheckCircle2, 
  Trash2, MonitorPlay, Ticket, Activity, Award,
  Dices, Phone, MessageCircle, Clock, ListChecks, Filter,
  History, Music, Pause, Radio, Megaphone, MapPin, Image as ImageIcon, Store, Pencil
} from 'lucide-react';
import ReactPlayer from 'react-player';

export default function AdminPanel() {
  const { gameState, users, cards, ads, setPlayerLimit, resetPlayerCards, toggleUserPayment, addAd, toggleAd, deleteAd } = useBingoRealtime();
  const [drawInput, setDrawInput] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<WinningMode>('line-and-bingo');
  
  const [now, setNow] = useState(Date.now());
  const [userFilter, setUserFilter] = useState<'all' | 'online' | 'offline' | 'unpaid'>('all');

  const [localPrizes, setLocalPrizes] = useState<{pool: string | number, line: string | number, bingo: string | number}>({ 
    pool: 10000, line: 2000, bingo: 8000 
  });
  
  const [youtubeLink, setYoutubeLink] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // NUEVO: Estado para editar publicidad
  const [newAd, setNewAd] = useState({ name: '', zone: '', address: '', hours: '', imageUrl: '', phone: '' });
  const [editingAdId, setEditingAdId] = useState<string | null>(null);

  useEffect(() => {
    if (gameState.youtubeUrl) setYoutubeLink(gameState.youtubeUrl);
    if (gameState.youtubeTitle) setYoutubeTitle(gameState.youtubeTitle);
  }, [gameState.youtubeUrl, gameState.youtubeTitle]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getCleanPrizes = () => ({ pool: Number(localPrizes.pool) || 0, line: Number(localPrizes.line) || 0, bingo: Number(localPrizes.bingo) || 0 });

  const updateConfigLive = async () => {
    await update(ref(db, 'game/state'), { winningMode: selectedMode, prizes: getCleanPrizes(), youtubeUrl: youtubeLink, youtubeTitle: youtubeTitle });
    alert('✅ ¡Configuración actualizada! Los jugadores ya pueden ver y escuchar los cambios.');
  };

  const startGame = async () => {
    if (confirm("¿Iniciar partida? Ya no se podrán seleccionar cartones.")) {
      await update(ref(db, 'game/state'), { status: 'playing', winningMode: selectedMode, winner: null, lineWinner: null, prizes: getCleanPrizes() });
      setIsPreviewPlaying(false); 
    }
  };

  const resetGame = async () => {
    if (confirm("¿Reiniciar partida? Se borrarán los números sorteados y ganadores.")) {
      await update(ref(db, 'game/state'), { status: 'waiting', drawnNumbers: [], winner: null, lineWinner: null });
    }
  };

  const deleteUser = async (userId: string) => {
    if(!confirm("⚠️ ¿ELIMINAR AL JUGADOR?\n\nPerderá todos sus cartones, historial de victorias y será desconectado del juego.")) return;
    const userCards = cards.filter(c => c.ownerId === userId);
    for(const c of userCards) { await update(ref(db, `cards/${c.id}`), { ownerId: "", ownerName: "" }); }
    await set(ref(db, `users/${userId}`), null);
  };

  const togglePayment = async (userId: string, winId: string, currentPaid: boolean) => {
    await update(ref(db, `users/${userId}/winHistory/${winId}`), { paid: !currentPaid });
  };

  const executeDraw = async (num: number) => {
    if (isNaN(num) || num < 1 || num > 90) return alert("Número inválido (1-90)");
    if (gameState.drawnNumbers.includes(num)) return alert("El número ya fue sorteado");

    const newDrawn = [...gameState.drawnNumbers, num];
    const occupiedCards = cards.filter(c => Boolean(c.ownerId) && c.ownerId !== "");
    
    let detectedBingos: WinnerInfo[] = [];
    let detectedLines: WinnerInfo[] = gameState.lineWinner || []; 
    let isNewLine = false;

    const prizes = getCleanPrizes();
    const serverDate = new Date();
    const timeString = serverDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = serverDate.toLocaleDateString('es-AR');
    const timestampId = Date.now();

    for (const card of occupiedCards) {
      if (gameState.winningMode === 'bingo-only' || gameState.winningMode === 'line-and-bingo') {
          const hasBingo = card.numbers.every((n: number) => newDrawn.includes(n));
          if (hasBingo) {
            detectedBingos.push({ userId: card.ownerId || '', name: card.ownerName || '', cardId: card.id, timestamp: timeString, prize: gameState.prizes?.bingo || prizes.bingo });
            const winId = `win_${timestampId}_${card.id}`;
            await update(ref(db, `users/${card.ownerId}/winHistory/${winId}`), {
              id: winId, type: 'BINGO', dateString, timeString, cardId: card.id, winningNumbers: card.numbers.join(' - '), prize: gameState.prizes?.bingo || prizes.bingo, paid: false, timestamp: timestampId
            });
          }
      }

      if ((gameState.winningMode === 'line-only' || gameState.winningMode === 'line-and-bingo') && (!gameState.lineWinner || gameState.lineWinner.length === 0)) {
        let safeGrid: number[][] = [];
        try { safeGrid = typeof card.grid === 'string' ? JSON.parse(card.grid) : card.grid; } catch (e) {}

        for (let r = 0; r < 3; r++) {
          const rowNumbers = safeGrid[r].filter(n => n !== 0);
          if (rowNumbers.length === 5 && rowNumbers.every(n => newDrawn.includes(n))) {
            detectedLines.push({ userId: card.ownerId || '', name: card.ownerName || '', cardId: card.id, timestamp: timeString, prize: gameState.prizes?.line || prizes.line });
            isNewLine = true;
            const winId = `win_line_${timestampId}_${card.id}`;
            await update(ref(db, `users/${card.ownerId}/winHistory/${winId}`), {
              id: winId, type: 'LÍNEA', dateString, timeString, cardId: card.id, winningNumbers: rowNumbers.join(' - '), prize: gameState.prizes?.line || prizes.line, paid: false, timestamp: timestampId
            });
            break; 
          }
        }
      }
    }

    let isGameOver = false;
    if (detectedBingos.length > 0 && (gameState.winningMode === 'bingo-only' || gameState.winningMode === 'line-and-bingo')) isGameOver = true;
    if (isNewLine && gameState.winningMode === 'line-only') isGameOver = true;

    if (isGameOver) {
      await update(ref(db, 'game/state'), { drawnNumbers: newDrawn, status: 'finished', winner: detectedBingos.length > 0 ? detectedBingos : detectedLines, lineWinner: gameState.winningMode === 'line-only' ? null : (detectedLines.length > 0 ? detectedLines : null) });
    } else {
      await update(ref(db, 'game/state'), { drawnNumbers: newDrawn, lineWinner: detectedLines.length > 0 ? detectedLines : null });
    }
  };

  const drawManual = async () => { await executeDraw(parseInt(drawInput)); setDrawInput(''); };

  const drawRandom = async () => {
    const availableNumbers = Array.from({length: 90}, (_, i) => i + 1).filter(n => !gameState.drawnNumbers.includes(n));
    if (availableNumbers.length === 0) return alert("¡Ya se sortearon los 90 números!");
    await executeDraw(availableNumbers[Math.floor(Math.random() * availableNumbers.length)]);
  };

  const initDatabase = async () => {
      if(!confirm("Esto generará 2500 cartones y borrará los anteriores. ¿Continuar?")) return;
      setIsInitializing(true);
      try {
        const newCards = generateCards(2500);
        const cardsData: Record<string, any> = {};
        newCards.forEach(card => { cardsData[card.id] = card; });
        await set(ref(db, 'cards'), cardsData);
        await set(ref(db, 'game/state'), { status: 'waiting', drawnNumbers: [], winningMode: 'line-and-bingo', winner: null, lineWinner: null, prizes: { pool: 0, line: 0, bingo: 0 } });
        await set(ref(db, 'users'), null);
        alert('Base de datos inicializada con éxito.');
      } catch (error) { alert('Hubo un error en la conexión.'); }
      setIsInitializing(false);
  };

  const handleContactWhatsApp = (phone: string) => { window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank'); };
  const formatUptime = (lastLoginAt?: number) => {
    if (!lastLoginAt) return '-';
    const diff = Math.floor((now - lastLoginAt) / 1000);
    return `${Math.floor(diff / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`;
  };

  // LÓGICA DE PUBLICIDAD: Crear o Editar
  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newAd.name || !newAd.imageUrl || !newAd.zone) return alert("Nombre, Zona y URL de Imagen son obligatorios.");
    
    if (editingAdId) {
      await update(ref(db, `ads/${editingAdId}`), newAd);
      alert("Publicidad actualizada con éxito.");
    } else {
      addAd(newAd);
      alert("Publicidad agregada con éxito.");
    }

    setNewAd({ name: '', zone: '', address: '', hours: '', imageUrl: '', phone: '' });
    setEditingAdId(null);
  };

  const handleEditAdClick = (ad: any) => {
    setNewAd({
      name: ad.name,
      zone: ad.zone,
      address: ad.address || '',
      hours: ad.hours || '',
      imageUrl: ad.imageUrl,
      phone: ad.phone || ''
    });
    setEditingAdId(ad.id);
  };

  const occupiedCardsCount = cards.filter(c => Boolean(c.ownerId) && c.ownerId !== "").length;
  const lastNumber = gameState.drawnNumbers.length > 0 ? gameState.drawnNumbers[gameState.drawnNumbers.length - 1] : null;
  const usersReadyCount = users.filter(user => user.isReady).length;
  const usersPaidCount = users.filter(user => user.hasPaidCards).length;

  const filteredUsers = users.filter(u => {
    if (userFilter === 'online') return u.isOnline;
    if (userFilter === 'offline') return !u.isOnline;
    if (userFilter === 'unpaid') return !u.hasPaidCards;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#010326] text-[#F2F2F2] p-4 md:p-8 font-sans selection:bg-[#4B68BF]/30 relative overflow-x-hidden">
      
      {youtubeLink && (
        <div className="fixed -left-[9999px] pointer-events-none">
          {/* @ts-ignore */}
          <ReactPlayer url={youtubeLink} playing={isPreviewPlaying} volume={0.4} width="1px" height="1px" config={{ youtube: { playerVars: { autoplay: 1, controls: 0 } } }} />
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <header className="bg-[#010326] border border-[#4B68BF]/50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-6 md:px-8 rounded-3xl flex flex-col xl:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4 w-full xl:w-auto justify-center xl:justify-start">
            <div className="w-14 h-14 rounded-2xl bg-[#4B68BF] flex items-center justify-center shadow-[0_0_20px_rgba(75,104,191,0.6)]"><MonitorPlay className="w-8 h-8 text-[#F2F2F2]" /></div>
            <div>
              <h1 className="text-3xl font-black text-[#F2F2F2] tracking-tight uppercase">Admin Bingo Familia</h1>
              <div className="flex items-center gap-2 mt-1">
                <Activity className="w-4 h-4 text-[#F29188]" />
                <span className="text-slate-300 font-bold text-xs tracking-wider uppercase">Estado:</span>
                <span className={`text-xs font-black px-3 py-1 rounded-lg border ${gameState.status === 'waiting' ? 'bg-[#F2F2F2] text-[#010326] border-[#F2F2F2]' : gameState.status === 'playing' ? 'bg-[#4B68BF] text-[#F2F2F2] border-[#4B68BF]' : 'bg-[#F22613] text-[#F2F2F2] border-[#F22613]'}`}>
                  {gameState.status === 'waiting' ? 'EN ESPERA' : gameState.status === 'playing' ? 'EN CURSO' : 'FINALIZADO'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-center xl:items-end gap-4 w-full xl:w-auto">
             {gameState.status === 'waiting' && (
                <div className="flex gap-2 bg-[#010326] p-1.5 rounded-xl border border-[#4B68BF]/30">
                    {(['bingo-only', 'line-and-bingo', 'line-only'] as WinningMode[]).map((mode) => (
                      <button key={mode} onClick={() => setSelectedMode(mode)} className={`px-5 py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all uppercase ${selectedMode === mode ? 'bg-[#F29188] text-[#010326] shadow-[0_0_15px_rgba(242,145,136,0.4)]' : 'bg-transparent border border-[#F29188]/30 text-[#F29188] hover:bg-[#F29188]/10'}`}>
                          {mode === 'bingo-only' ? 'Cartón Lleno' : mode === 'line-and-bingo' ? 'Línea y Cartón' : 'Solo Línea'}
                      </button>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap justify-center gap-3">
                <Link href="/admin/historial" className="flex items-center gap-2 bg-[#4B68BF]/20 text-[#4B68BF] border border-[#4B68BF]/50 px-6 py-3 rounded-xl font-black hover:bg-[#4B68BF]/30 transition-all text-sm shadow-md"><History className="w-4 h-4" /> Auditoría</Link>
                <button onClick={initDatabase} disabled={isInitializing} className="flex items-center gap-2 bg-[#F2F2F2] text-[#010326] border border-[#F2F2F2] px-6 py-3 rounded-xl font-black hover:bg-gray-300 transition-all text-sm shadow-md"><RotateCcw className="w-4 h-4" /> Reset DB</button>
                {gameState.status === 'waiting' ? (
                  <button onClick={startGame} className="flex items-center gap-2 bg-[#4B68BF] border border-[#4B68BF] px-8 py-3 rounded-xl font-black text-white hover:bg-[#4B68BF]/80 transition-all text-sm shadow-[0_0_20px_rgba(75,104,191,0.5)]"><Play className="w-5 h-5" /> INICIAR PARTIDA</button>
                ) : (
                  <button onClick={resetGame} className="flex items-center gap-2 bg-[#F22613] border border-[#F22613] px-8 py-3 rounded-xl font-black text-white hover:bg-[#F22613]/80 transition-all text-sm shadow-[0_0_20px_rgba(242,38,19,0.5)]"><Square className="w-5 h-5 fill-current" /> DETENER SORTEO</button>
                )}
            </div>
          </div>
        </header>

        {/* AJUSTES */}
        {gameState.status === 'waiting' && (
          <div className="bg-[#010326] border border-[#4B68BF]/50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-6 md:p-8 rounded-[2rem]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-[#4B68BF]/30 pb-4">
              <div className="flex items-center gap-3"><Settings className="w-6 h-6 text-[#F29188]" /><h2 className="text-base font-black text-[#F2F2F2] tracking-wide uppercase">Ajustes Previos</h2></div>
              <button onClick={updateConfigLive} className="flex items-center gap-2 bg-[#F29188] text-[#010326] font-black border border-[#F29188] px-6 py-3 rounded-xl hover:bg-[#F29188]/90 transition-all shadow-md w-full md:w-auto justify-center uppercase text-xs tracking-widest"><RefreshCw className="w-4 h-4" /> Aplicar Cambios</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {[{ label: 'Fondo Recaudado', key: 'pool', id: 'input-pool' }, { label: 'Premio por Línea', key: 'line', id: 'input-line' }, { label: 'Premio por Bingo', key: 'bingo', id: 'input-bingo' }].map((item) => (
                <div key={item.key} className="bg-white/5 p-5 rounded-2xl border border-[#4B68BF]/40 focus-within:border-[#F29188] transition-all shadow-inner">
                  <label htmlFor={item.id} className="block text-[11px] font-bold text-[#F2F2F2]/70 mb-2 uppercase tracking-widest">{item.label}</label>
                  <div className="flex items-center gap-3">
                    <div className="bg-[#4B68BF] p-2 rounded-lg"><Banknote className="w-5 h-5 text-white" /></div>
                    <span className="text-2xl font-black text-[#F29188]">$</span>
                    <input id={item.id} type="number" title={item.label} placeholder="0" value={(localPrizes as any)[item.key]} onChange={e => setLocalPrizes({...localPrizes, [item.key]: e.target.value})} className="bg-transparent text-2xl font-black text-[#F2F2F2] outline-none w-full" />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 p-5 rounded-2xl border border-[#4B68BF]/40 focus-within:border-[#F29188] transition-all shadow-inner">
                <label className="block text-[11px] font-bold text-[#F2F2F2]/70 mb-2 uppercase tracking-widest">Nombre de la Canción/Radio</label>
                <div className="flex items-center gap-3">
                  <div className="bg-[#4B68BF] p-2 rounded-lg"><Radio className="w-5 h-5 text-white" /></div>
                  <input type="text" placeholder="Ej: Enganchados Cumbia..." value={youtubeTitle} onChange={e => setYoutubeTitle(e.target.value)} className="bg-transparent text-sm font-bold text-[#F2F2F2] outline-none w-full placeholder:text-slate-500" />
                </div>
              </div>

              <div className="bg-white/5 p-5 rounded-2xl border border-[#4B68BF]/40 focus-within:border-[#F29188] transition-all shadow-inner">
                <label className="block text-[11px] font-bold text-[#F2F2F2]/70 mb-2 uppercase tracking-widest">Lobby Youtube Link</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsPreviewPlaying(!isPreviewPlaying)} aria-label="Probar Música" title="Probar Música" className={`p-2 rounded-lg transition-colors shadow-md ${isPreviewPlaying ? 'bg-[#F29188] text-[#010326]' : 'bg-[#4B68BF] text-white hover:bg-[#4B68BF]/80'}`}>
                    {isPreviewPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-[2px]" />}
                  </button>
                  <input type="url" placeholder="https://youtu.be/..." value={youtubeLink} onChange={e => { setYoutubeLink(e.target.value); setIsPreviewPlaying(false); }} className="bg-transparent text-sm font-medium text-[#F2F2F2] outline-none w-full" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANELES DE GANADORES GIGANTE CON CONTACTO */}
        {(gameState.winner || gameState.lineWinner) && (
          <div className="space-y-4">
            {gameState.winner?.map((w, i) => {
              const winnerUser = users.find(u => u.id === w.userId);
              const winnerPhone = winnerUser?.phone || 'Sin número registrado';
              return (
                <div key={`winner-${i}`} className="bg-gradient-to-r from-[#F29188] to-[#4B68BF] border-4 border-[#F2F2F2] p-8 md:p-10 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6 shadow-[0_0_40px_rgba(242,145,136,0.4)] animate-in zoom-in duration-500">
                  <div className="flex items-center gap-6 z-10 w-full md:w-auto">
                    <div className="bg-[#010326] p-5 rounded-3xl shadow-xl"><Trophy className="w-14 h-14 text-[#F29188]" /></div>
                    <div>
                      <p className="text-[12px] font-black text-[#010326] uppercase tracking-[.3em] mb-1">¡BINGO CANTADO!</p>
                      <h2 className="text-5xl font-black text-[#010326] leading-tight">{w.name}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-[#010326] text-sm font-bold">
                        <span className="flex items-center gap-2 bg-[#F2F2F2] px-4 py-2 rounded-lg shadow-sm"><Ticket className="w-4 h-4" /> Cartón Nº {w.cardId}</span>
                        <span className="flex items-center gap-2 bg-[#010326]/10 border border-[#010326]/20 pl-4 pr-2 py-1.5 rounded-lg shadow-sm">
                          <Phone className="w-4 h-4" /> {winnerPhone}
                          {winnerUser?.phone && (<button aria-label="Contactar" title="Contactar" onClick={() => handleContactWhatsApp(winnerUser.phone as string)} className="ml-1 bg-green-500 text-white p-1.5 rounded-md hover:bg-green-600 transition-all"><MessageCircle className="w-4 h-4" /></button>)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#010326] border-2 border-[#F2F2F2] px-10 py-6 rounded-3xl text-center min-w-[250px] shadow-2xl">
                    <p className="text-[11px] font-bold text-[#F29188] uppercase tracking-widest mb-1">Monto a Pagar</p>
                    <p className="text-5xl font-black text-[#F2F2F2]">${w.prize}</p>
                  </div>
                </div>
              );
            })}
            {gameState.lineWinner && !gameState.winner && gameState.lineWinner.map((w, i) => {
              const lineWinnerUser = users.find(u => u.id === w.userId);
              const lineWinnerPhone = lineWinnerUser?.phone || 'Sin número registrado';
              return (
                <div key={`linewinner-${i}`} className="bg-[#4B68BF] border-4 border-[#010326] p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-6 shadow-[0_0_30px_rgba(75,104,191,0.5)]">
                  <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className="bg-[#F2F2F2] p-4 rounded-2xl shadow-md"><Award className="w-10 h-10 text-[#4B68BF]" /></div>
                    <div>
                      <p className="text-[12px] font-black text-[#F2F2F2]/80 uppercase tracking-widest mb-1">LÍNEA GANADA</p>
                      <h3 className="text-4xl font-black text-[#F2F2F2]">{w.name}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-sm font-bold text-[#010326]">
                        <span className="flex items-center gap-2 bg-[#F2F2F2] px-3 py-1.5 rounded-lg shadow-sm"><Ticket className="w-4 h-4" /> Cartón Nº {w.cardId}</span>
                        <span className="flex items-center gap-2 bg-[#010326]/20 text-[#F2F2F2] pl-3 pr-1.5 py-1 rounded-lg shadow-sm">
                          <Phone className="w-4 h-4" /> {lineWinnerPhone}
                          {lineWinnerUser?.phone && (<button aria-label="Contactar" title="Contactar" onClick={() => handleContactWhatsApp(lineWinnerUser.phone as string)} className="ml-1 bg-green-500 text-white p-1.5 rounded-md hover:bg-green-400"><MessageCircle className="w-3.5 h-3.5" /></button>)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#F2F2F2] border-2 border-[#010326] px-8 py-5 rounded-2xl text-center min-w-[200px] shadow-lg">
                    <p className="text-[11px] font-black text-[#4B68BF] uppercase tracking-widest mb-1">Monto a Pagar</p>
                    <p className="text-4xl font-black text-[#010326]">${w.prize}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODULOS PRINCIPALES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#010326] border border-[#4B68BF]/50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-6 md:p-8 rounded-[2rem] flex flex-col min-h-[450px]">
            <div className="flex justify-between items-center mb-8 border-b border-[#4B68BF]/30 pb-4">
              <div className="flex items-center gap-3"><Ticket className="w-6 h-6 text-[#F29188]" /><h2 className="text-base font-black text-[#F2F2F2] tracking-wide uppercase">Motor de Sorteo</h2></div>
              {lastNumber && <div className="bg-[#F2F2F2] text-[#010326] px-5 py-2 rounded-xl font-black animate-pulse text-sm shadow-md flex items-center gap-2">ÚLTIMO CANTO: <span className="text-[#F22613] text-lg">{lastNumber}</span></div>}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="flex-1 bg-white/5 border-2 border-[#4B68BF]/50 rounded-2xl p-4 flex items-center focus-within:border-[#F29188] transition-colors shadow-inner">
                <input id="draw-input" type="number" title="Número a sortear" placeholder="Número Manual..." value={drawInput} onChange={e => setDrawInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && drawManual()} disabled={gameState.status === 'finished' || gameState.status === 'waiting'} className="w-full bg-transparent text-4xl text-center font-black outline-none text-[#F2F2F2] placeholder:text-[#F2F2F2]/20 disabled:opacity-30" />
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button onClick={drawManual} disabled={gameState.status === 'finished' || gameState.status === 'waiting' || drawInput === ''} className="flex-1 sm:flex-none bg-[#4B68BF] px-8 py-4 sm:py-0 rounded-2xl font-black text-lg text-white hover:bg-[#4B68BF]/80 disabled:opacity-30 uppercase tracking-widest">Cantar</button>
                <button onClick={drawRandom} disabled={gameState.status === 'finished' || gameState.status === 'waiting'} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#F29188] px-8 py-4 sm:py-0 rounded-2xl font-black text-lg text-[#010326] hover:bg-[#F29188]/80 disabled:opacity-30 uppercase tracking-widest"><Dices className="w-6 h-6" /> Azar</button>
              </div>
            </div>
            <div className="flex-1 bg-white/5 rounded-2xl p-6 border border-[#4B68BF]/20 overflow-y-auto">
              <p className="text-[11px] font-bold text-[#F2F2F2]/60 uppercase tracking-widest mb-4">Historial de Sorteo</p>
              <div className="flex flex-wrap gap-3">
                {gameState.drawnNumbers.map((num, idx) => (
                  <div key={`drawn-${num}-${idx}`} className="w-14 h-14 rounded-2xl bg-[#4B68BF] flex items-center justify-center font-black text-2xl text-white shadow-md border-b-4 border-black/40">{num}</div>
                ))}
                {gameState.drawnNumbers.length === 0 && (
                  <div className="w-full text-center py-10 flex flex-col items-center gap-3"><Dices className="w-10 h-10 text-[#4B68BF]/30" /><p className="text-sm font-bold text-[#4B68BF]/60 uppercase tracking-widest">Aún no hay números sorteados</p></div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#010326] border border-[#4B68BF]/50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-6 rounded-[2rem] flex flex-col max-h-[650px] overflow-hidden">
            <div className="flex items-center justify-between mb-6 border-b border-[#4B68BF]/30 pb-4">
              <div className="flex items-center gap-3"><Users className="w-6 h-6 text-[#F29188]" /><h2 className="text-base font-black text-[#F2F2F2] tracking-wide uppercase">Gestión Jugadores</h2></div>
              <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                 <button onClick={() => setUserFilter('all')} className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-all ${userFilter === 'all' ? 'bg-[#4B68BF] text-white' : 'text-slate-400 hover:text-white'}`}>Todos</button>
                 <button onClick={() => setUserFilter('unpaid')} className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-all ${userFilter === 'unpaid' ? 'bg-[#F22613] text-white' : 'text-slate-400 hover:text-white'}`}>Deuda</button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[#F2F2F2] p-3 rounded-2xl text-center shadow-md flex flex-col justify-center"><p className="text-2xl font-black text-[#010326] leading-none">{usersReadyCount}<span className="text-sm text-[#010326]/50">/{users.length}</span></p><p className="text-[9px] font-black text-[#010326]/70 uppercase tracking-widest mt-1">Listos</p></div>
              <div className="bg-[#4B68BF] p-3 rounded-2xl text-center shadow-md flex flex-col justify-center"><p className="text-2xl font-black text-white leading-none">{usersPaidCount}</p><p className="text-[9px] font-black text-white/70 uppercase tracking-widest mt-1">Pagaron</p></div>
              <div className="bg-white/10 border border-[#4B68BF]/30 p-3 rounded-2xl text-center shadow-md flex flex-col justify-center"><p className="text-2xl font-black text-[#F29188] leading-none">{occupiedCardsCount}</p><p className="text-[9px] font-black text-[#F29188]/70 uppercase tracking-widest mt-1">Cartones</p></div>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#4B68BF]/50 pb-4">
              {filteredUsers.map((user, index) => {
                const winsArray = user.winHistory ? Object.values(user.winHistory).sort((a,b) => b.timestamp - a.timestamp) : [];
                return (
                  <div key={user.id || `user-${index}`} className={`bg-white/5 p-5 rounded-2xl border transition-all shadow-sm relative ${user.hasPaidCards ? 'border-emerald-500/30 hover:border-emerald-500/60' : 'border-[#4B68BF]/20 hover:border-[#F29188]/50'}`}>
                    <button aria-label="Eliminar Jugador" title="Eliminar Jugador" onClick={() => deleteUser(user.id)} className="absolute top-4 right-4 text-slate-500 hover:text-[#F22613] transition-colors"><Trash2 className="w-4 h-4" /></button>
                    <div className="mb-4 pr-6">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${user.isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-slate-600'}`}></div>
                        <span className={`font-black text-base uppercase ${user.isReady ? 'text-[#F29188]' : 'text-[#F2F2F2]'}`}>{user.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-[#F2F2F2]/60 font-medium mt-2">
                        <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-[#4B68BF]" /> {user.phone || '-'}</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-[#4B68BF]" /> {user.isOnline ? `Online: ${formatUptime(user.lastLoginAt)}` : 'Offline'}</span>
                      </div>
                    </div>

                    {winsArray.length > 0 && (
                      <div className="bg-[#010326]/50 border border-white/5 rounded-xl p-3 mb-4">
                        <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Trophy className="w-3 h-3" /> Premios Ganados</p>
                        <div className="space-y-2">
                          {winsArray.map((win, wIdx) => (
                            <div key={win.id || `win-${wIdx}`} className="flex flex-col gap-2 bg-white/5 p-2 rounded-lg text-xs font-medium border border-white/5">
                              <div className="flex justify-between items-center text-[#F2F2F2]/80"><span><strong className="text-white">{win.type}</strong> | Cº {win.cardId}</span><span>{win.timeString}</span></div>
                              <div className="flex justify-between items-center mt-1 border-t border-white/5 pt-2">
                                <span className="text-emerald-400 font-bold">${win.prize}</span>
                                <button onClick={() => togglePayment(user.id, win.id, win.paid)} className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all border ${win.paid ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'}`}>{win.paid ? '✓ Pagado' : '💵 Pagar'}</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center border-t border-white/10 pt-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-[#F2F2F2]/50 uppercase tracking-widest hidden sm:inline">Límite:</span>
                          <div className="flex gap-1">{[1, 3, 6].map(n => (<button key={n} onClick={() => setPlayerLimit(user.id, n)} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black transition-all ${ (user.maxCards || 6) === n ? 'bg-[#4B68BF] text-white shadow-md' : 'border border-[#4B68BF]/50 text-[#4B68BF] hover:bg-[#4B68BF]/20'}`}>{n}</button>))}</div>
                        </div>
                        <button onClick={() => toggleUserPayment(user.id, !user.hasPaidCards)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all border ${user.hasPaidCards ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-[#F22613]/10 text-[#F22613] border-[#F22613]/30'}`}>
                          <Banknote className="w-3 h-3" />{user.hasPaidCards ? 'PAGADO' : 'DEBE'}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.phone && (<button aria-label="WhatsApp" title="WhatsApp" onClick={() => handleContactWhatsApp(user.phone as string)} className="text-green-400 bg-green-400/10 p-1.5 rounded-lg hover:bg-green-400/20 transition-colors"><MessageCircle className="w-4 h-4" /></button>)}
                        <button aria-label="Soltar Cartones" title="Soltar Cartones" onClick={() => resetPlayerCards(user.id)} className="text-[#F22613] bg-[#F22613]/10 p-1.5 rounded-lg hover:bg-[#F22613]/20 transition-colors"><ListChecks className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* MODULO COMERCIAL / PATROCINADORES */}
        <div className="bg-[#010326] border border-[#4B68BF]/50 shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-6 md:p-8 rounded-[2rem] w-full">
          <div className="flex items-center gap-3 mb-6 border-b border-[#4B68BF]/30 pb-4">
            <Megaphone className="w-6 h-6 text-[#F29188]" />
            <h2 className="text-base font-black text-[#F2F2F2] tracking-wide uppercase">Patrocinadores / Comercios Locales</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white/5 p-6 rounded-2xl border border-[#4B68BF]/20 h-fit">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Store className="w-4 h-4" /> {editingAdId ? 'Editar Patrocinador' : 'Nuevo Patrocinador'}
              </h3>
              <form onSubmit={handleSaveAd} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Nombre Comercial *</label>
                  <input type="text" required value={newAd.name} onChange={e => setNewAd({...newAd, name: e.target.value})} className="w-full bg-[#010326]/50 border border-[#4B68BF]/30 rounded-lg p-2.5 text-sm text-white outline-none focus:border-[#F29188]" placeholder="Ej: Pizzería Los Amigos" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Zona / Localidad *</label>
                  <div className="flex items-center bg-[#010326]/50 border border-[#4B68BF]/30 rounded-lg p-2.5 focus-within:border-[#F29188]">
                    <MapPin className="w-4 h-4 text-[#4B68BF] mr-2" />
                    <input type="text" required value={newAd.zone} onChange={e => setNewAd({...newAd, zone: e.target.value})} className="w-full bg-transparent text-sm text-white outline-none" placeholder="Ej: Tucumán, Alderetes..." />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Teléfono WhatsApp</label>
                  <div className="flex items-center bg-[#010326]/50 border border-[#4B68BF]/30 rounded-lg p-2.5 focus-within:border-[#F29188]">
                    <MessageCircle className="w-4 h-4 text-[#4B68BF] mr-2" />
                    <input type="tel" value={newAd.phone} onChange={e => setNewAd({...newAd, phone: e.target.value})} className="w-full bg-transparent text-sm text-white outline-none" placeholder="Ej: 3811234567" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Dirección</label>
                  <input type="text" value={newAd.address} onChange={e => setNewAd({...newAd, address: e.target.value})} className="w-full bg-[#010326]/50 border border-[#4B68BF]/30 rounded-lg p-2.5 text-sm text-white outline-none focus:border-[#F29188]" placeholder="Ej: Av. Principal 123" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Horario de Atención</label>
                  <input type="text" value={newAd.hours} onChange={e => setNewAd({...newAd, hours: e.target.value})} className="w-full bg-[#010326]/50 border border-[#4B68BF]/30 rounded-lg p-2.5 text-sm text-white outline-none focus:border-[#F29188]" placeholder="Ej: Lun a Sab de 20 a 00hs" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest mb-1">Link de la Imagen (URL) *</label>
                  <div className="flex items-center bg-[#010326]/50 border border-[#4B68BF]/30 rounded-lg p-2.5 focus-within:border-[#F29188]">
                    <ImageIcon className="w-4 h-4 text-[#4B68BF] mr-2" />
                    <input type="url" required value={newAd.imageUrl} onChange={e => setNewAd({...newAd, imageUrl: e.target.value})} className="w-full bg-transparent text-sm text-white outline-none" placeholder="https://..." />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="submit" className="flex-1 bg-[#F29188] text-[#010326] font-black uppercase tracking-widest text-xs py-3 rounded-lg hover:bg-[#F29188]/80 transition-colors">
                    {editingAdId ? 'Actualizar' : 'Guardar'}
                  </button>
                  {editingAdId && (
                    <button type="button" onClick={() => { setEditingAdId(null); setNewAd({ name: '', zone: '', address: '', hours: '', imageUrl: '', phone: '' }); }} className="bg-slate-700 text-white font-black uppercase tracking-widest text-xs px-4 py-3 rounded-lg hover:bg-slate-600 transition-colors">
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ads.length === 0 && <p className="text-slate-500 text-sm col-span-2 text-center py-10">No hay publicidades cargadas actualmente.</p>}
                {ads.map(ad => (
                  <div key={ad.id} className={`flex gap-4 p-4 rounded-2xl border transition-all ${ad.isActive ? 'bg-white/5 border-[#4B68BF]/40' : 'bg-black/20 border-white/5 opacity-60'}`}>
                    <img src={ad.imageUrl} alt={ad.name} className="w-20 h-20 object-cover rounded-xl border-2 border-slate-800" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150?text=Error+Imagen')} />
                    <div className="flex flex-col justify-between flex-1">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-black text-white text-sm uppercase leading-tight truncate pr-2">{ad.name}</h4>
                          <div className="flex gap-2">
                            <button onClick={() => handleEditAdClick(ad)} className="text-slate-500 hover:text-[#4B68BF]" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteAd(ad.id)} className="text-slate-500 hover:text-red-500" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <span className="inline-block bg-[#4B68BF]/20 text-[#4B68BF] text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-1">{ad.zone}</span>
                        {ad.phone && <span className="block text-[9px] text-slate-400 mt-1">📞 {ad.phone}</span>}
                      </div>
                      <button onClick={() => toggleAd(ad.id, ad.isActive)} className={`mt-2 text-[9px] font-black uppercase tracking-widest py-1.5 rounded transition-colors border ${ad.isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
                        {ad.isActive ? 'Ocultar al público' : 'Mostrar al público'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}