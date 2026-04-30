'use client';

import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../lib/firebase';
import { ref, update, set } from 'firebase/database';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { useBingoRealtime } from '../../hooks/useBingoRealtime';
import { generateCards } from '../../lib/generator';
import { WinningMode, WinnerInfo } from '../types/bingo';
import Link from 'next/link';
import { 
  Trophy, Banknote, Play, Square, RotateCcw, 
  RefreshCw, Settings, Users, CheckCircle2, 
  Trash2, MonitorPlay, Ticket, Activity, Award,
  Dices, Phone, MessageCircle, Clock, ListChecks, Filter,
  History, Music, Pause, Radio, Megaphone, MapPin, Image as ImageIcon, Store, Pencil,
  Lock, Unlock, LogOut, AlertTriangle, ShieldCheck, Info
} from 'lucide-react';
import ReactPlayer from 'react-player';

export default function AdminPanel() {
  // ==========================================
  // ESTADOS DE SESIÓN Y UI
  // ==========================================
  const [isAdminLogged, setIsAdminLogged] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // MODALES PERSONALIZADOS
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; iconType: 'trash' | 'warning' | 'power'; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: 'Aceptar', cancelText: 'Cancelar', iconType: 'warning', onConfirm: () => {} });

  const [customAlert, setCustomAlert] = useState<{
    isOpen: boolean; title: string; message: string; type: 'warning' | 'success' | 'info';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdminLogged(!!user);
      setIsCheckingSession(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPass);
    } catch (error) {
      setCustomAlert({ isOpen: true, title: 'Error de Acceso', message: 'Correo o contraseña incorrectos.', type: 'warning' });
      setAdminPass('');
    }
  };

  const handleAdminLogout = async () => {
    setCustomConfirm({ isOpen: true, title: 'Cerrar Sesión', message: '¿Estás seguro de que deseas salir del panel de control?', confirmText: 'Sí, salir', cancelText: 'Cancelar', iconType: 'power', onConfirm: async () => {
      await signOut(auth);
      setCustomConfirm(prev => ({ ...prev, isOpen: false }));
    }});
  };

  // ==========================================
  // DATOS DEL JUEGO (HOOK)
  // ==========================================
  const { gameState, users, cards, ads, setPlayerLimit, resetPlayerCards, toggleUserPayment, addAd, toggleAd, deleteAd } = useBingoRealtime();
  const [drawInput, setDrawInput] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<WinningMode>('line-and-bingo');
  
  const [now, setNow] = useState(Date.now());
  const [userFilter, setUserFilter] = useState<'all' | 'online' | 'offline' | 'unpaid' | 'ready'>('all');

  const [localPrizes, setLocalPrizes] = useState<{pool: string | number, line: string | number, bingo: string | number}>({ 
    pool: 10000, line: 2000, bingo: 8000 
  });
  
  const [youtubeLink, setYoutubeLink] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // REFERENCIA PARA LA PROMESA DE AUDIO Y EVITAR EL ERROR DE ABORT
  const audioPromiseRef = useRef<Promise<void> | null>(null);

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
    setCustomAlert({ isOpen: true, title: '¡Éxito!', message: 'Configuración actualizada. Los jugadores ya pueden ver los cambios.', type: 'success' });
  };

  const startGame = async () => {
    setCustomConfirm({ isOpen: true, title: 'Iniciar Partida', message: '¿Estás seguro de iniciar? Los jugadores ya no podrán seleccionar cartones y el audio hará un fundido.', confirmText: '¡Iniciar!', cancelText: 'Cancelar', iconType: 'power', onConfirm: async () => {
      await update(ref(db, 'game/state'), { status: 'playing', winningMode: selectedMode, winner: null, lineWinner: null, prizes: getCleanPrizes() });
      setIsPreviewPlaying(false); 
      setCustomConfirm(prev => ({ ...prev, isOpen: false }));
    }});
  };

  const resetGame = async () => {
    setCustomConfirm({ isOpen: true, title: 'Detener y Reiniciar', message: '¿Detener la partida actual? Se borrarán los números sorteados y el historial de ganadores en pantalla.', confirmText: 'Sí, reiniciar', cancelText: 'Cancelar', iconType: 'warning', onConfirm: async () => {
      await update(ref(db, 'game/state'), { status: 'waiting', drawnNumbers: [], winner: null, lineWinner: null });
      setCustomConfirm(prev => ({ ...prev, isOpen: false }));
    }});
  };

  const executeDeleteUser = async (userId: string) => {
    const userCards = cards.filter((c: any) => c.ownerId === userId);
    for(const c of userCards) { await update(ref(db, `cards/${c.id}`), { ownerId: "", ownerName: "" }); }
    await set(ref(db, `users/${userId}`), null);
    setCustomConfirm(prev => ({ ...prev, isOpen: false }));
  };

  const deleteUser = (userId: string) => {
    setCustomConfirm({ isOpen: true, title: 'Eliminar Jugador', message: '¿Estás seguro? Perderá todos sus cartones, historial de victorias y será desconectado del juego.', confirmText: 'Eliminar', cancelText: 'Cancelar', iconType: 'trash', onConfirm: () => executeDeleteUser(userId) });
  };

  const togglePayment = async (userId: string, winId: string, currentPaid: boolean) => {
    await update(ref(db, `users/${userId}/winHistory/${winId}`), { paid: !currentPaid });
  };

  const toggleGameLock = async () => {
    const isLocked = gameState.isGameLocked || false;
    setCustomConfirm({ isOpen: true, title: isLocked ? 'Abrir Sala' : 'Cerrar Sala', message: isLocked ? 'Los jugadores en el Lobby serán enviados a sus cartones para jugar.' : 'Nadie podrá entrar a ver los cartones. Serán enviados a la Sala de Espera.', confirmText: isLocked ? 'Sí, Abrir' : 'Sí, Cerrar', cancelText: 'Cancelar', iconType: 'warning', onConfirm: async () => {
      await update(ref(db, 'game/state'), { isGameLocked: !isLocked });
      setCustomConfirm(prev => ({ ...prev, isOpen: false }));
    }});
  };

  // ==========================================
  // MOTOR DEL SORTEO
  // ==========================================
  const executeDraw = async (num: number) => {
    if (isNaN(num) || num < 1 || num > 90) return setCustomAlert({ isOpen: true, title: 'Error', message: 'Número inválido. Debe ser del 1 al 90.', type: 'warning' });
    if (gameState.drawnNumbers.includes(num)) return setCustomAlert({ isOpen: true, title: 'Atención', message: `El número ${num} ya fue sorteado.`, type: 'info' });

    const newDrawn = [...gameState.drawnNumbers, num];
    const occupiedCards = cards.filter((c: any) => Boolean(c.ownerId) && c.ownerId !== "");
    
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
        let safeGrid: any[] = [];
        try { safeGrid = typeof card.grid === 'string' ? JSON.parse(card.grid) : card.grid; } catch (e) {}

        for (let r = 0; r < 3; r++) {
          let rowNumbers: number[] = [];
          if (safeGrid && safeGrid.length === 3 && safeGrid[r]) { rowNumbers = safeGrid[r].filter((n: any) => n !== 0); } 
          else if (card.numbers && card.numbers.length === 15) { rowNumbers = card.numbers.slice(r * 5, (r + 1) * 5); }

          if (rowNumbers.length === 5 && rowNumbers.every((n: number) => newDrawn.includes(n))) {
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
    if (availableNumbers.length === 0) return setCustomAlert({ isOpen: true, title: 'Sorteo Finalizado', message: '¡Ya se sortearon los 90 números!', type: 'info' });
    await executeDraw(availableNumbers[Math.floor(Math.random() * availableNumbers.length)]);
  };

  const initDatabase = async () => {
    setCustomConfirm({ isOpen: true, title: 'Reiniciar Base de Datos', message: '¡Peligro! Esto generará 2500 cartones nuevos, borrará los anteriores y eliminará a todos los usuarios. ¿Estás absolutamente seguro?', confirmText: 'Sí, formatear todo', cancelText: 'Cancelar', iconType: 'warning', onConfirm: async () => {
      setCustomConfirm(prev => ({ ...prev, isOpen: false }));
      setIsInitializing(true);
      try {
        const newCards = generateCards(2500);
        const cardsData: Record<string, any> = {};
        newCards.forEach(card => { cardsData[card.id] = card; });
        await set(ref(db, 'cards'), cardsData);
        await set(ref(db, 'game/state'), { status: 'waiting', drawnNumbers: [], winningMode: 'line-and-bingo', winner: null, lineWinner: null, prizes: { pool: 0, line: 0, bingo: 0 }, isGameLocked: true });
        await set(ref(db, 'users'), null);
        setCustomAlert({ isOpen: true, title: 'Formateo Exitoso', message: 'Base de datos inicializada con 2500 cartones. La sala ha quedado CERRADA por defecto.', type: 'success' });
      } catch (error) { setCustomAlert({ isOpen: true, title: 'Error', message: 'Hubo un error de conexión al limpiar la base.', type: 'warning' }); }
      setIsInitializing(false);
    }});
  };

  const handleContactWhatsApp = (phone: string) => { window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank'); };
  const formatUptime = (lastLoginAt?: number) => {
    if (!lastLoginAt) return '-';
    const diff = Math.floor((now - lastLoginAt) / 1000);
    return `${Math.floor(diff / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`;
  };

  // ==========================================
  // GESTIÓN DE PUBLICIDADES
  // ==========================================
  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newAd.name || !newAd.imageUrl || !newAd.zone) return setCustomAlert({ isOpen: true, title: 'Faltan Datos', message: 'Nombre, Zona y URL de Imagen son obligatorios.', type: 'warning' });
    
    if (editingAdId) {
      await update(ref(db, `ads/${editingAdId}`), newAd);
      setCustomAlert({ isOpen: true, title: 'Éxito', message: 'Publicidad actualizada con éxito.', type: 'success' });
    } else {
      addAd(newAd);
      setCustomAlert({ isOpen: true, title: 'Éxito', message: 'Publicidad agregada con éxito.', type: 'success' });
    }
    setNewAd({ name: '', zone: '', address: '', hours: '', imageUrl: '', phone: '' });
    setEditingAdId(null);
  };

  const handleEditAdClick = (ad: any) => {
    setNewAd({ name: ad.name, zone: ad.zone, address: ad.address || '', hours: ad.hours || '', imageUrl: ad.imageUrl, phone: ad.phone || '' });
    setEditingAdId(ad.id);
  };

  // ESTADÍSTICAS Y FILTROS
  const occupiedCardsCount = cards.filter((c: any) => Boolean(c.ownerId) && c.ownerId !== "").length;
  const lastNumber = gameState.drawnNumbers.length > 0 ? gameState.drawnNumbers[gameState.drawnNumbers.length - 1] : null;
  const usersReadyCount = users.filter((user: any) => user.isReady).length;
  const usersPaidCount = users.filter((user: any) => user.hasPaidCards).length;

  const filteredUsers = users.filter((u: any) => {
    if (userFilter === 'online') return u.isOnline;
    if (userFilter === 'offline') return !u.isOnline;
    if (userFilter === 'unpaid') return !u.hasPaidCards;
    if (userFilter === 'ready') return u.isReady;
    return true;
  });

  // ==========================================
  // RENDERIZADOS
  // ==========================================
  if (isCheckingSession) return <div className="min-h-screen bg-[#1E1940]"></div>;

  if (!isAdminLogged) {
    return (
      <div className="min-h-screen bg-[#1E1940] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
           <MonitorPlay className="absolute top-[10%] left-[10%] w-32 h-32 text-[#5B44F2]" />
           <ShieldCheck className="absolute bottom-[20%] right-[15%] w-40 h-40 text-[#312773]" />
        </div>

        <div className="bg-[#312773]/90 p-8 md:p-12 rounded-[2rem] border border-[#5B44F2]/30 backdrop-blur-xl max-w-md w-full text-center shadow-[0_20px_60px_rgba(0,0,0,0.6)] relative z-10">
          <div className="bg-[#5B44F2]/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-[#5B44F2]/50 shadow-inner">
            <Lock className="w-10 h-10 text-[#8466F2]" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest drop-shadow-md">NUCLEUS</h2>
          <p className="text-[#8466F2] text-xs font-black uppercase tracking-widest mb-10">Admin Control Panel</p>
          
          <form onSubmit={handleAdminLogin} className="space-y-5">
            <input 
              type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} 
              placeholder="Correo Administrativo" 
              className="w-full bg-[#1E1940]/80 border-2 border-[#3A29A6] py-4 px-5 rounded-xl text-white font-bold focus:outline-none focus:border-[#8466F2] transition-colors tracking-wide placeholder:text-[#8466F2]/50" 
            />
            <input 
              type="password" required value={adminPass} onChange={(e) => setAdminPass(e.target.value)} 
              placeholder="Contraseña" 
              className="w-full bg-[#1E1940]/80 border-2 border-[#3A29A6] py-4 px-5 rounded-xl text-white font-bold focus:outline-none focus:border-[#8466F2] transition-colors tracking-wide placeholder:text-[#8466F2]/50" 
            />
            <button type="submit" className="w-full mt-4 bg-[#5B44F2] text-white font-black text-sm py-4 rounded-xl shadow-[0_10px_25px_rgba(91,68,242,0.4)] hover:bg-[#8466F2] hover:-translate-y-1 active:scale-95 transition-all uppercase tracking-widest">
              Autorizar Acceso
            </button>
          </form>
          <Link href="/" className="block mt-8 text-xs font-bold text-[#8466F2]/60 hover:text-white transition-colors uppercase tracking-wider">← Retornar al Juego</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1E1940] text-[#F2F2F2] p-4 md:p-6 lg:p-8 font-sans selection:bg-[#5B44F2]/50 relative overflow-x-hidden">
      
      {/* Componente Oculto de YouTube por retrocompatibilidad */}
      {youtubeLink && (
        <div className="fixed -left-[9999px] pointer-events-none">
          {/* @ts-ignore */}
          <ReactPlayer url={youtubeLink} playing={isPreviewPlaying} volume={0.4} width="1px" height="1px" config={{ youtube: { playerVars: { autoplay: 1, controls: 0 } } }} />
        </div>
      )}

      {/* HEADER / TOPBAR ESTILO FINTECH */}
      <header className="max-w-[1400px] mx-auto bg-[#312773] border border-[#5B44F2]/30 shadow-2xl p-5 md:px-8 rounded-3xl flex flex-col xl:flex-row justify-between items-center gap-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#5B44F2] opacity-10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-4 w-full xl:w-auto justify-center xl:justify-start z-10">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#5B44F2] to-[#3A29A6] flex items-center justify-center shadow-lg border border-[#8466F2]/30"><MonitorPlay className="w-7 h-7 text-white" /></div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-widest uppercase drop-shadow-sm">NUCLEUS ADMIN</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest shadow-inner border ${gameState.status === 'waiting' ? 'bg-[#1E1940] text-[#8466F2] border-[#5B44F2]' : gameState.status === 'playing' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                {gameState.status === 'waiting' ? '• Espera' : gameState.status === 'playing' ? '• En Curso' : '• Fin'}
              </span>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest shadow-inner border flex items-center gap-1 ${gameState.isGameLocked ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                 {gameState.isGameLocked ? <><Lock className="w-3 h-3" /> Cerrada</> : <><Unlock className="w-3 h-3" /> Abierta</>}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-center xl:items-end gap-4 w-full xl:w-auto z-10">
           {gameState.status === 'waiting' && (
              <div className="flex gap-2 bg-[#1E1940] p-1.5 rounded-xl border border-[#5B44F2]/30 shadow-inner">
                  {(['line-only', 'bingo-only', 'line-and-bingo'] as WinningMode[]).map((mode) => (
                    <button key={mode} onClick={() => setSelectedMode(mode)} className={`px-4 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all uppercase ${selectedMode === mode ? 'bg-[#5B44F2] text-white shadow-md' : 'text-[#8466F2] hover:bg-[#312773]'}`}>
                        {mode === 'bingo-only' ? 'Cartón Lleno' : mode === 'line-and-bingo' ? 'Línea y Cartón' : 'Solo Línea'}
                    </button>
                  ))}
              </div>
          )}
          <div className="flex flex-wrap justify-center gap-3">
              <Link href="/admin/historial" className="flex items-center gap-2 bg-[#3A29A6]/40 text-[#8466F2] border border-[#5B44F2]/50 px-5 py-2.5 rounded-xl font-black hover:bg-[#3A29A6] hover:text-white transition-all text-xs tracking-widest uppercase"><History className="w-4 h-4" /> Auditoría</Link>
              
              <button onClick={toggleGameLock} className={`flex items-center gap-2 border px-5 py-2.5 rounded-xl font-black transition-all text-xs tracking-widest uppercase ${gameState.isGameLocked ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500 hover:text-white' : 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500 hover:text-white'}`}>
                 {gameState.isGameLocked ? <><Unlock className="w-4 h-4" /> Abrir Sala</> : <><Lock className="w-4 h-4" /> Cerrar Sala</>}
              </button>

              {gameState.status === 'waiting' ? (
                <button onClick={startGame} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 border-none px-6 py-2.5 rounded-xl font-black text-[#010326] hover:scale-105 transition-all text-xs tracking-widest uppercase shadow-[0_5px_20px_rgba(52,211,153,0.4)]"><Play className="w-4 h-4 fill-current" /> Iniciar Sorteo</button>
              ) : (
                <button onClick={resetGame} className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-rose-400 border-none px-6 py-2.5 rounded-xl font-black text-white hover:scale-105 transition-all text-xs tracking-widest uppercase shadow-[0_5px_20px_rgba(239,68,68,0.4)]"><Square className="w-4 h-4 fill-current" /> Detener Sorteo</button>
              )}

              <button onClick={handleAdminLogout} aria-label="Salir" title="Salir" className="flex items-center justify-center w-10 h-10 bg-[#1E1940] text-[#8466F2] border border-[#5B44F2]/30 rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm">
                <LogOut className="w-4 h-4" />
              </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* PANELES DE GANADORES GIGANTES */}
        {(gameState.winner || gameState.lineWinner) && (
          <div className="space-y-4 mb-8">
            {gameState.winner?.map((w, i) => {
              const winnerUser = users.find((u: any) => u.id === w.userId);
              const winnerPhone = winnerUser?.phone || 'Sin registro';
              return (
                <div key={`winner-${i}`} className="bg-gradient-to-r from-amber-400 to-orange-500 border border-amber-300 p-8 md:p-10 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-6 shadow-[0_10px_40px_rgba(251,191,36,0.3)] animate-in zoom-in duration-500">
                  <div className="flex items-center gap-6 z-10 w-full md:w-auto">
                    <div className="bg-white/20 p-5 rounded-3xl shadow-inner backdrop-blur-sm"><Trophy className="w-14 h-14 text-white" /></div>
                    <div>
                      <p className="text-[12px] font-black text-orange-900 uppercase tracking-[.3em] mb-1">¡BINGO GANADOR!</p>
                      <h2 className="text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-md">{w.name}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-4 text-[#010326] text-sm font-bold">
                        <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm"><Ticket className="w-4 h-4 text-orange-500" /> Cartón Nº {w.cardId}</span>
                        <span className="flex items-center gap-2 bg-white/30 text-orange-900 backdrop-blur-sm border border-white/40 pl-4 pr-2 py-1.5 rounded-xl shadow-sm">
                          <Phone className="w-4 h-4" /> {winnerPhone}
                          {winnerUser?.phone && (<button title="Contactar por WhatsApp" aria-label="Contactar por WhatsApp" onClick={() => handleContactWhatsApp(winnerUser.phone as string)} className="ml-1 bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600 transition-all shadow-md"><MessageCircle className="w-4 h-4" /></button>)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white px-10 py-8 rounded-[2rem] text-center min-w-[280px] shadow-2xl">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto a Entregar</p>
                    <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-amber-600">${w.prize}</p>
                  </div>
                </div>
              );
            })}
            {gameState.lineWinner && !gameState.winner && gameState.lineWinner.map((w, i) => {
              const lineWinnerUser = users.find((u: any) => u.id === w.userId);
              const lineWinnerPhone = lineWinnerUser?.phone || 'Sin registro';
              return (
                <div key={`linewinner-${i}`} className="bg-gradient-to-r from-[#5B44F2] to-[#3A29A6] border border-[#8466F2]/50 p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row justify-between items-center gap-6 shadow-[0_10px_30px_rgba(91,68,242,0.3)] animate-in slide-in-from-top-4">
                  <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className="bg-white/10 p-4 rounded-2xl shadow-inner backdrop-blur-sm"><Award className="w-10 h-10 text-[#8466F2]" /></div>
                    <div>
                      <p className="text-[10px] font-black text-[#8466F2] uppercase tracking-widest mb-1">LÍNEA GANADORA</p>
                      <h3 className="text-3xl font-black text-white drop-shadow-sm">{w.name}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-3 text-sm font-bold text-[#010326]">
                        <span className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm"><Ticket className="w-4 h-4 text-[#5B44F2]" /> Cartón Nº {w.cardId}</span>
                        <span className="flex items-center gap-2 bg-white/10 text-white border border-white/20 pl-3 pr-1.5 py-1 rounded-lg shadow-sm backdrop-blur-sm">
                          <Phone className="w-4 h-4 text-[#8466F2]" /> {lineWinnerPhone}
                          {lineWinnerUser?.phone && (<button title="Contactar por WhatsApp" aria-label="Contactar por WhatsApp" onClick={() => handleContactWhatsApp(lineWinnerUser.phone as string)} className="ml-1 bg-green-500 text-white p-1.5 rounded-md hover:bg-green-400"><MessageCircle className="w-3.5 h-3.5" /></button>)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#1E1940] border border-[#5B44F2] px-8 py-6 rounded-2xl text-center min-w-[200px] shadow-xl">
                    <p className="text-[10px] font-black text-[#8466F2] uppercase tracking-widest mb-1">A Pagar</p>
                    <p className="text-4xl font-black text-white">${w.prize}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* COLUMNA IZQUIERDA: MOTOR DE JUEGO */}
          <div className="xl:col-span-1 flex flex-col gap-8">
            
            {/* MOTOR DE SORTEO */}
            <div className="bg-[#312773] border border-[#5B44F2]/30 shadow-2xl p-6 md:p-8 rounded-[2rem] flex flex-col flex-1">
              <div className="flex justify-between items-center mb-8 border-b border-[#5B44F2]/20 pb-4">
                <div className="flex items-center gap-3"><Dices className="w-6 h-6 text-[#8466F2]" /><h2 className="text-sm font-black text-white tracking-widest uppercase">Sorteador</h2></div>
              </div>

              <div className="flex flex-col items-center justify-center mb-8 flex-1">
                 <div className="relative mb-6">
                    <div className="absolute inset-0 bg-[#5B44F2] blur-xl opacity-30 rounded-full"></div>
                    <div className="w-40 h-40 bg-[#1E1940] border-[6px] border-[#5B44F2] rounded-full flex items-center justify-center relative z-10 shadow-2xl shadow-[#1E1940]">
                      {lastNumber ? (
                        <span className="text-7xl font-black text-white tracking-tighter animate-in zoom-in">{lastNumber}</span>
                      ) : (
                        <span className="text-4xl font-black text-[#5B44F2]/30">-</span>
                      )}
                    </div>
                 </div>
                 
                 <div className="w-full flex gap-3 mb-6">
                    <div className="flex-1 bg-[#1E1940] border border-[#5B44F2]/50 rounded-xl p-2 flex items-center shadow-inner">
                      <input type="number" title="Número a sortear" aria-label="Número a sortear manual" placeholder="Nº Manual" value={drawInput} onChange={e => setDrawInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && drawManual()} disabled={gameState.status === 'finished' || gameState.status === 'waiting'} className="w-full bg-transparent text-xl text-center font-black outline-none text-white placeholder:text-slate-600 disabled:opacity-30" />
                    </div>
                    <button onClick={drawManual} disabled={gameState.status === 'finished' || gameState.status === 'waiting' || drawInput === ''} className="bg-[#5B44F2] px-6 rounded-xl font-black text-white hover:bg-[#8466F2] disabled:opacity-30 uppercase tracking-widest text-xs transition-colors shadow-md">Cantar</button>
                 </div>
                 
                 <button onClick={drawRandom} disabled={gameState.status === 'finished' || gameState.status === 'waiting'} className="w-full py-5 rounded-xl font-black text-lg text-white bg-gradient-to-r from-[#5B44F2] to-[#3A29A6] hover:from-[#8466F2] hover:to-[#5B44F2] disabled:opacity-30 uppercase tracking-widest transition-all shadow-[0_5px_20px_rgba(91,68,242,0.4)] flex items-center justify-center gap-3">
                   <RotateCcw className="w-5 h-5" /> Sorteo Aleatorio
                 </button>
              </div>

              <div className="bg-[#1E1940] rounded-2xl p-5 border border-[#5B44F2]/20 min-h-[120px] max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#5B44F2]/50">
                <p className="text-[9px] font-black text-[#8466F2] uppercase tracking-widest mb-3">Historial ({gameState.drawnNumbers.length})</p>
                <div className="flex flex-wrap gap-2">
                  {gameState.drawnNumbers.map((num, idx) => (
                    <div key={`drawn-${num}-${idx}`} className="w-9 h-9 rounded-lg bg-[#312773] border border-[#5B44F2]/50 flex items-center justify-center font-black text-sm text-white shadow-sm">{num}</div>
                  ))}
                  {gameState.drawnNumbers.length === 0 && <span className="text-xs text-slate-500 font-medium">Vacío...</span>}
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: CONFIGURACIÓN Y USUARIOS */}
          <div className="xl:col-span-2 flex flex-col gap-8">
            
            {/* WIDGET DE AJUSTES PREVIOS (PREMIOS Y RADIO) */}
            {gameState.status === 'waiting' && (
              <div className="bg-[#312773] border border-[#5B44F2]/30 shadow-2xl p-6 rounded-[2rem] animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-5 border-b border-[#5B44F2]/20 pb-3">
                  <div className="flex items-center gap-2"><Settings className="w-5 h-5 text-[#8466F2]" /><h2 className="text-xs font-black text-white tracking-widest uppercase">Parámetros del Sorteo</h2></div>
                  <button onClick={updateConfigLive} className="flex items-center gap-2 bg-[#5B44F2] text-white font-black px-4 py-2 rounded-lg hover:bg-[#8466F2] transition-all shadow-md uppercase text-[10px] tracking-widest"><RefreshCw className="w-3.5 h-3.5" /> Guardar</button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  {[{ label: 'Fondo Pozo', key: 'pool' }, { label: 'Premio Línea', key: 'line' }, { label: 'Premio Bingo', key: 'bingo' }].map((item) => (
                    <div key={item.key} className="bg-[#1E1940] p-4 rounded-xl border border-[#5B44F2]/30 focus-within:border-[#8466F2] transition-colors shadow-inner flex items-center gap-3">
                      <div className="bg-[#312773] p-2 rounded-lg"><Banknote className="w-4 h-4 text-[#8466F2]" /></div>
                      <div className="flex-1">
                         <label className="block text-[9px] font-black text-slate-400 mb-0.5 uppercase tracking-widest">{item.label}</label>
                         <div className="flex items-center font-black text-white text-lg"><span className="text-[#8466F2] mr-1">$</span><input type="number" title={item.label} aria-label={item.label} placeholder="0" value={(localPrizes as any)[item.key]} onChange={e => setLocalPrizes({...localPrizes, [item.key]: e.target.value})} className="bg-transparent outline-none w-full" /></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#1E1940] p-4 rounded-xl border border-[#5B44F2]/30 focus-within:border-[#8466F2] transition-colors shadow-inner flex items-center gap-3">
                    <div className="bg-[#312773] p-2 rounded-lg"><Radio className="w-4 h-4 text-[#8466F2]" /></div>
                    <div className="flex-1">
                       <label className="block text-[9px] font-black text-slate-400 mb-0.5 uppercase tracking-widest">Nombre Radio / Título</label>
                       <input type="text" title="Título de la radio" aria-label="Título de la radio" value={youtubeTitle} onChange={e => setYoutubeTitle(e.target.value)} placeholder="Opcional..." className="bg-transparent text-sm font-bold text-white outline-none w-full placeholder:text-slate-600" />
                    </div>
                  </div>
                  <div className="bg-[#1E1940] p-4 rounded-xl border border-[#5B44F2]/30 focus-within:border-[#8466F2] transition-colors shadow-inner flex items-center gap-3">
                    <div className="flex-1">
                       <label className="block text-[9px] font-black text-slate-400 mb-0.5 uppercase tracking-widest">Link MP3 Backup</label>
                       <input type="url" title="Link de música MP3" aria-label="Link de música MP3" value={youtubeLink} onChange={e => { setYoutubeLink(e.target.value); setIsPreviewPlaying(false); }} placeholder="https://..." className="bg-transparent text-sm font-bold text-white outline-none w-full placeholder:text-slate-600" />
                    </div>
                    <button 
                      onClick={() => {
                        // CANCELAMOS LA PROMESA ANTERIOR SI EXISTE
                        if (audioPromiseRef.current) {
                          audioPromiseRef.current.catch(() => {}); // Ignoramos el error de aborto
                        }
                        setIsPreviewPlaying(!isPreviewPlaying);
                      }} 
                      title="Probar audio" 
                      aria-label="Probar audio" 
                      className={`p-2.5 rounded-lg transition-colors shadow-md ${isPreviewPlaying ? 'bg-emerald-500 text-white' : 'bg-[#312773] text-[#8466F2] hover:bg-[#5B44F2] hover:text-white'}`}
                    >
                      {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-[2px]" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TABLA DE USUARIOS MEJORADA */}
            <div className="bg-[#312773] border border-[#5B44F2]/30 shadow-2xl rounded-[2rem] flex flex-col flex-1 overflow-hidden min-h-[400px]">
              
              <div className="p-6 md:p-8 border-b border-[#5B44F2]/20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
                  <div className="flex items-center gap-3"><Users className="w-6 h-6 text-[#8466F2]" /><h2 className="text-sm font-black text-white tracking-widest uppercase">Base de Jugadores</h2></div>
                  
                  <div className="flex bg-[#1E1940] rounded-xl p-1 border border-[#5B44F2]/30 shadow-inner w-full md:w-auto overflow-x-auto scrollbar-hide">
                    {[
                      { id: 'all', label: 'Todos' }, { id: 'ready', label: 'Listos' }, 
                      { id: 'unpaid', label: 'Deudores' }, { id: 'online', label: 'Online' }
                    ].map(f => (
                      <button key={f.id} onClick={() => setUserFilter(f.id as any)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${userFilter === f.id ? (f.id === 'unpaid' ? 'bg-red-500 text-white' : 'bg-[#5B44F2] text-white') : 'text-slate-400 hover:text-white'}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#1E1940] p-4 rounded-2xl border border-[#5B44F2]/20 flex flex-col items-center justify-center shadow-inner"><p className="text-3xl font-black text-white">{usersReadyCount}<span className="text-sm text-slate-500">/{users.length}</span></p><p className="text-[9px] font-black text-[#8466F2] uppercase tracking-widest mt-1">Confirmados</p></div>
                  <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 flex flex-col items-center justify-center shadow-inner"><p className="text-3xl font-black text-emerald-400">{usersPaidCount}</p><p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Abonaron</p></div>
                  <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 flex flex-col items-center justify-center shadow-inner"><p className="text-3xl font-black text-amber-400">{occupiedCardsCount}</p><p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Cartones</p></div>
                </div>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-[#5B44F2]/50">
                {filteredUsers.length === 0 && <p className="text-center py-10 text-sm font-medium text-slate-400">No hay usuarios en esta categoría.</p>}
                
                {filteredUsers.map((user: any, index: number) => {
                  const winsArray = user.winHistory ? Object.values(user.winHistory).sort((a: any, b: any) => b.timestamp - a.timestamp) : [];
                  const userCards = cards.filter((c: any) => c.ownerId === user.id);
                  const isSelecting = userCards.length > 0 && !user.isReady;

                  return (
                    <div key={`user-${user.id || 'undefined'}-${index}`} className={`bg-[#1E1940] p-5 rounded-2xl border transition-all relative overflow-hidden ${user.hasPaidCards ? 'border-emerald-500/30' : 'border-[#5B44F2]/30'}`}>
                      {/* Borde izquierdo de color para estado rápido */}
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${user.hasPaidCards ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                      
                      <button aria-label="Eliminar Jugador" title="Eliminar" onClick={() => deleteUser(user.id)} className="absolute top-4 right-4 text-slate-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pr-6 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2.5 h-2.5 rounded-full shadow-lg ${user.isOnline ? 'bg-green-500 shadow-green-500/50' : 'bg-slate-600'}`}></div>
                            <span className="font-black text-base uppercase text-white">{user.name}</span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone || '-'}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {user.isOnline ? formatUptime(user.lastLoginAt) : 'Offline'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                           <button onClick={() => toggleUserPayment(user.id, !user.hasPaidCards)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-md ${user.hasPaidCards ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/40'}`}>
                              {user.hasPaidCards ? '✓ Aprobado' : 'Pendiente'}
                           </button>
                           {user.phone && (<button aria-label="Escribir por WhatsApp" title="WhatsApp" onClick={() => handleContactWhatsApp(user.phone as string)} className="text-white bg-green-500 p-2 rounded-lg hover:bg-green-600 transition-colors shadow-md"><MessageCircle className="w-4 h-4" /></button>)}
                        </div>
                      </div>

                      <div className="bg-[#312773]/50 rounded-xl p-3 border border-[#5B44F2]/20 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-black text-[#8466F2] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                            <Ticket className="w-3 h-3" /> Estado: <span className={user.isReady ? 'text-emerald-400' : isSelecting ? 'text-amber-400' : 'text-slate-400'}>{user.isReady ? 'CONFIRMADO' : isSelecting ? 'ELIGIENDO...' : 'SIN CARTONES'}</span>
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {userCards.length > 0 ? userCards.map((c: any) => (<span key={c.id} className="bg-[#5B44F2] text-white px-2 py-0.5 rounded text-xs font-black shadow-sm">#{c.id}</span>)) : <span className="text-xs text-slate-500">Ningún cartón</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-bold text-slate-500 uppercase">Límite:</span>
                           <div className="flex bg-[#1E1940] rounded-lg p-0.5 border border-[#5B44F2]/30">
                             {[1, 3, 6].map(n => (<button key={n} onClick={() => setPlayerLimit(user.id, n)} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black transition-all ${ (user.maxCards || 6) === n ? 'bg-[#5B44F2] text-white' : 'text-slate-400 hover:text-white'}`}>{n}</button>))}
                           </div>
                           <button onClick={() => resetPlayerCards(user.id)} className="ml-1 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/30 p-1.5 rounded-lg transition-all" aria-label="Liberar cartones" title="Liberar todos sus cartones"><ListChecks className="w-4 h-4" /></button>
                        </div>
                      </div>

                      {winsArray.length > 0 && (
                        <div className="space-y-2">
                          {winsArray.map((win: any, wIdx: number) => (
                            <div key={`win-${win.id || 'undefined'}-${wIdx}`} className="flex justify-between items-center bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-xs font-medium">
                              <div><span className="font-black text-amber-500 mr-2">{win.type}</span><span className="text-white">Cartón #{win.cardId}</span></div>
                              <div className="flex items-center gap-3">
                                <span className="text-emerald-400 font-black">${win.prize}</span>
                                <button onClick={() => togglePayment(user.id, win.id, win.paid)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${win.paid ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{win.paid ? 'Saldado' : 'A Pagar'}</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* MODULO PATROCINADORES */}
        <div className="bg-[#312773] border border-[#5B44F2]/30 shadow-2xl p-6 md:p-8 rounded-[2rem] w-full">
          <div className="flex justify-between items-center mb-6 border-b border-[#5B44F2]/20 pb-4">
            <div className="flex items-center gap-3"><Store className="w-6 h-6 text-[#8466F2]" /><h2 className="text-sm font-black text-white tracking-widest uppercase">Marcas y Patrocinios</h2></div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-[#1E1940] p-6 rounded-2xl border border-[#5B44F2]/30 h-fit shadow-inner">
              <h3 className="text-xs font-black text-[#8466F2] uppercase tracking-widest mb-5 flex items-center gap-2">
                <Pencil className="w-4 h-4" /> {editingAdId ? 'Editar Patrocinador' : 'Agregar Patrocinador'}
              </h3>
              <form onSubmit={handleSaveAd} className="space-y-4">
                {/* Inputs de Formulario (Usan el mismo state) */}
                <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Comercial *</label><input type="text" required title="Nombre comercial" aria-label="Nombre comercial" value={newAd.name} onChange={e => setNewAd({...newAd, name: e.target.value})} className="w-full bg-[#312773] border border-[#5B44F2]/50 rounded-xl p-3 text-sm text-white outline-none focus:border-white transition-colors" placeholder="Ej: Pizzería X" /></div>
                <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Zona *</label><input type="text" required title="Zona del comercio" aria-label="Zona del comercio" value={newAd.zone} onChange={e => setNewAd({...newAd, zone: e.target.value})} className="w-full bg-[#312773] border border-[#5B44F2]/50 rounded-xl p-3 text-sm text-white outline-none focus:border-white transition-colors" placeholder="Ej: Centro" /></div>
                <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Link de Imagen *</label><input type="url" required title="Link de la imagen" aria-label="Link de la imagen" value={newAd.imageUrl} onChange={e => setNewAd({...newAd, imageUrl: e.target.value})} className="w-full bg-[#312773] border border-[#5B44F2]/50 rounded-xl p-3 text-sm text-white outline-none focus:border-white transition-colors" placeholder="https://..." /></div>
                <div className="grid grid-cols-2 gap-3">
                   <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono</label><input type="tel" title="Teléfono del comercio" aria-label="Teléfono del comercio" value={newAd.phone} onChange={e => setNewAd({...newAd, phone: e.target.value})} className="w-full bg-[#312773] border border-[#5B44F2]/50 rounded-xl p-3 text-sm text-white outline-none focus:border-white transition-colors" placeholder="Opcional" /></div>
                   <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Horario</label><input type="text" title="Horario del comercio" aria-label="Horario del comercio" value={newAd.hours} onChange={e => setNewAd({...newAd, hours: e.target.value})} className="w-full bg-[#312773] border border-[#5B44F2]/50 rounded-xl p-3 text-sm text-white outline-none focus:border-white transition-colors" placeholder="Opcional" /></div>
                </div>
                <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección Física</label><input type="text" title="Dirección del comercio" aria-label="Dirección del comercio" value={newAd.address} onChange={e => setNewAd({...newAd, address: e.target.value})} className="w-full bg-[#312773] border border-[#5B44F2]/50 rounded-xl p-3 text-sm text-white outline-none focus:border-white transition-colors" placeholder="Opcional" /></div>
                
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-[#5B44F2] text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl hover:bg-[#8466F2] transition-colors shadow-md">{editingAdId ? 'Guardar Cambios' : 'Añadir a Lista'}</button>
                  {editingAdId && <button type="button" onClick={() => { setEditingAdId(null); setNewAd({ name: '', zone: '', address: '', hours: '', imageUrl: '', phone: '' }); }} className="bg-slate-700 text-white font-black uppercase tracking-widest text-xs px-5 py-3.5 rounded-xl hover:bg-slate-600 transition-colors shadow-md">Cancelar</button>}
                </div>
              </form>
            </div>

            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ads.length === 0 && <div className="col-span-2 text-center py-16 bg-[#1E1940] rounded-2xl border border-[#5B44F2]/30 border-dashed"><Store className="w-10 h-10 text-slate-600 mx-auto mb-3" /><p className="text-slate-400 text-sm font-black uppercase tracking-widest">Sin Patrocinios</p></div>}
                
                {ads.map((ad: any, idx: number) => (
                  <div key={`ad-${ad.id || 'undefined'}-${idx}`} className={`flex gap-4 p-4 rounded-2xl border transition-all ${ad.isActive ? 'bg-[#1E1940] border-[#5B44F2]/50 shadow-md' : 'bg-[#1E1940]/50 border-slate-700 opacity-60'}`}>
                    <img src={ad.imageUrl} alt={ad.name} className="w-24 h-24 object-cover rounded-xl border border-[#5B44F2]/30 shadow-inner" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/150?text=Error')} />
                    <div className="flex flex-col justify-between flex-1 overflow-hidden">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-black text-white text-sm uppercase leading-tight truncate pr-2" title={ad.name}>{ad.name}</h4>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => handleEditAdClick(ad)} className="text-[#8466F2] hover:text-white" title="Editar patrocinador" aria-label="Editar patrocinador"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => deleteAd(ad.id)} className="text-red-400 hover:text-red-500" title="Eliminar patrocinador" aria-label="Eliminar patrocinador"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <span className="inline-block bg-[#5B44F2] text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm">{ad.zone}</span>
                      </div>
                      <button onClick={() => toggleAd(ad.id, ad.isActive)} className={`mt-3 text-[9px] font-black uppercase tracking-widest py-2 rounded-lg transition-colors border shadow-sm ${ad.isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'}`}>
                        {ad.isActive ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CONTENEDOR INVISIBLE EXTRA AL FINAL PARA DAR ESPACIO AL HACER SCROLL */}
        <div className="h-10"></div>
      </div>

      {/* ========================================================= */}
      {/* MODALES COMPARTIDOS DEL PANEL (Reemplazan los feos alert/confirm nativos) */}
      {/* ========================================================= */}
      
      {/* Modal de Confirmación */}
      {customConfirm.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#010326]/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#1E1940] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border border-[#5B44F2]/50">
            <div className="p-8 text-center flex flex-col items-center">
              <div className={`p-4 rounded-2xl mb-5 shadow-inner border ${customConfirm.iconType === 'trash' ? 'bg-red-500/10 border-red-500/30 text-red-500' : customConfirm.iconType === 'power' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                {customConfirm.iconType === 'trash' && <Trash2 className="w-8 h-8" />}
                {customConfirm.iconType === 'power' && <MonitorPlay className="w-8 h-8" />}
                {customConfirm.iconType === 'warning' && <AlertTriangle className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tight">{customConfirm.title}</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">{customConfirm.message}</p>
            </div>
            <div className="p-5 bg-[#312773]/50 flex gap-3 border-t border-[#5B44F2]/20">
              <button onClick={() => setCustomConfirm(prev => ({ ...prev, isOpen: false }))} className="flex-1 bg-transparent text-slate-300 font-bold py-3.5 rounded-xl border border-slate-600 hover:bg-slate-700 transition-all uppercase text-[10px] tracking-widest">
                {customConfirm.cancelText}
              </button>
              <button onClick={customConfirm.onConfirm} className={`flex-1 text-white font-black py-3.5 rounded-xl shadow-md transition-all uppercase text-[10px] tracking-widest active:scale-95 ${customConfirm.iconType === 'trash' || customConfirm.iconType === 'warning' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#5B44F2] hover:bg-[#8466F2]'}`}>
                {customConfirm.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alerta Info/Error */}
      {customAlert.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#010326]/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#1E1940] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border border-[#5B44F2]/50">
            <div className="p-8 text-center flex flex-col items-center">
              <div className={`p-4 rounded-2xl mb-5 shadow-inner border ${customAlert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : customAlert.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-[#5B44F2]/10 border-[#5B44F2]/30 text-[#8466F2]'}`}>
                {customAlert.type === 'warning' && <AlertTriangle className="w-8 h-8" />}
                {customAlert.type === 'success' && <CheckCircle2 className="w-8 h-8" />}
                {customAlert.type === 'info' && <Info className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tight">{customAlert.title}</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed whitespace-pre-wrap">{customAlert.message}</p>
            </div>
            <div className="p-5 bg-[#312773]/50 flex flex-col gap-3 border-t border-[#5B44F2]/20">
              <button onClick={() => setCustomAlert({ ...customAlert, isOpen: false })} className="w-full bg-[#5B44F2] text-white font-black py-3.5 rounded-xl shadow-md hover:bg-[#8466F2] transition-all uppercase text-[10px] tracking-widest active:scale-95">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}