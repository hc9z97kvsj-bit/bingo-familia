'use client';

import { useState, useEffect, useRef } from 'react';
import { useBingoRealtime } from '../hooks/useBingoRealtime';
import BingoCard from '../components/BingoCard';
import ReproductorRadio from '../components/ReproductorRadio';
import ChatBingo from '../components/ChatBingo';
import { db } from '../lib/firebase';
import { ref, update, get, onDisconnect } from 'firebase/database';
import { Ticket, Dices, Coins, Star, Sparkles, Lock, RefreshCw, X, ScrollText, History, Volume2, VolumeX, MapPin, Clock, MessageCircle, CheckCircle2, Share2, Trash2, Hourglass, Banknote, Trophy, Calendar, Info, LogOut, Headphones, Play, Pause, Radio, AlertTriangle } from 'lucide-react';

export default function Home() {
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState(''); 
  
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; iconType: 'trash' | 'logout'; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: 'Aceptar', cancelText: 'Cancelar', iconType: 'trash', onConfirm: () => {} });

  const [customAlert, setCustomAlert] = useState<{
    isOpen: boolean; title: string; message: string; type: 'warning' | 'success' | 'info'; showWhatsapp?: boolean;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(100); 
  
  const [markMode, setMarkMode] = useState<'auto' | 'manual'>('auto');
  const [manualMarks, setManualMarks] = useState<Record<string, number[]>>({});

  const [lineAlertDismissed, setLineAlertDismissed] = useState(false);
  const [lineCountdown, setLineCountdown] = useState(5);
  
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

  const announcedLineRef = useRef(false);
  const announcedBingoRef = useRef(false);
  const hasCheckedRestore = useRef(false); 

  const [selectedZone, setSelectedZone] = useState('Todas');
  const [selectedAd, setSelectedAd] = useState<any>(null);

  const { cards, gameState, users, ads, selectCard, toggleReady, resetPlayerCards } = useBingoRealtime(userId);
  
  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  const prevDrawnCount = useRef(0);
  const prevStatusRef = useRef(gameState.status);

  const currentUser = users.find((u: any) => u.id === userId);
  const isReady = currentUser?.isReady || false;
  const maxCards = currentUser?.maxCards || 6; 
  const hasPaid = currentUser?.hasPaidCards || false;
  const myCards = cards.filter((c: any) => c.ownerId === userId);
  const myWins = currentUser?.winHistory ? Object.values(currentUser.winHistory).sort((a: any, b: any) => b.timestamp - a.timestamp) : [];

  const [radioTitle, setRadioTitle] = useState('Conectando...');
  const [radioArt, setRadioArt] = useState('');
  const [radioListeners, setRadioListeners] = useState(0);
  const [isMiniPlaying, setIsMiniPlaying] = useState(false);
  const [miniVolume, setMiniVolume] = useState(0.3); 
  const miniAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch('https://streaming01.shockmedia.com.ar/cp/get_info.php?p=8916');
        const data = await res.json();
        if (data.title) setRadioTitle(data.title);
        if (data.art) setRadioArt(data.art);
        if (data.listeners !== undefined) setRadioListeners(data.listeners);
      } catch (e) {}
    };
    fetchInfo();
    const interval = setInterval(fetchInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (miniAudioRef.current) { miniAudioRef.current.volume = miniVolume; }
  }, [miniVolume]);

  useEffect(() => {
    if (!isLogged || gameState.isGameLocked) {
      const tryAutoplay = () => {
        if (miniAudioRef.current && !isMiniPlaying) {
          miniAudioRef.current.volume = miniVolume;
          miniAudioRef.current.play().then(() => setIsMiniPlaying(true)).catch(() => {});
        }
      };
      const timer = setTimeout(tryAutoplay, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLogged, gameState.isGameLocked]);

  const toggleMiniPlay = () => {
    if (miniAudioRef.current) {
      if (isMiniPlaying) { miniAudioRef.current.pause(); setIsMiniPlaying(false); } 
      else { miniAudioRef.current.volume = miniVolume; miniAudioRef.current.play().then(() => setIsMiniPlaying(true)).catch(() => {}); }
    }
  };

  useEffect(() => {
    const unlockiOSPermissions = () => {
      setHasInteracted(true);
      try {
        const silentAudio = new Audio('https://actions.google.com/sounds/v1/ui/button_click.ogg');
        silentAudio.volume = 0; silentAudio.play().catch(() => {});
      } catch (e) {}
      if ('speechSynthesis' in window) {
        const silentSpeech = new SpeechSynthesisUtterance('');
        silentSpeech.volume = 0; window.speechSynthesis.speak(silentSpeech);
      }
    };
    window.addEventListener('click', unlockiOSPermissions, { once: true });
    window.addEventListener('touchstart', unlockiOSPermissions, { once: true });
    return () => { window.removeEventListener('click', unlockiOSPermissions); window.removeEventListener('touchstart', unlockiOSPermissions); };
  }, []);

  useEffect(() => {
    if (isLogged && currentUser && cards.length > 0 && hasPaid && !hasCheckedRestore.current) {
      hasCheckedRestore.current = true; 
      if (gameState.status === 'waiting' && myCards.length === 0 && currentUser.lastPlayedCards && currentUser.lastPlayedCards.length > 0) {
        setShowRestoreModal(true);
      }
    }
  }, [isLogged, currentUser, cards.length, myCards.length, gameState.status, hasPaid]);

  useEffect(() => {
    const savedId = localStorage.getItem('bingoUserId');
    const savedName = localStorage.getItem('bingoUserName');
    if (savedId && savedName) {
      setUserId(savedId); setUserName(savedName); setIsLogged(true);
      const userRef = ref(db, `users/${savedId}`);
      update(userRef, { isOnline: true, lastLoginAt: Date.now() });
      onDisconnect(userRef).update({ isOnline: false });
    }
  }, []);

  useEffect(() => {
    if (prevStatusRef.current === 'waiting' && gameState.status === 'playing') {
      if (isVoiceEnabled && window.speechSynthesis && hasInteracted) {
        window.speechSynthesis.cancel(); 
        const speech = new SpeechSynthesisUtterance("El bingo inicia en tres, dos, uno.");
        speech.lang = 'es-AR'; window.speechSynthesis.speak(speech);
      }
    }
    prevStatusRef.current = gameState.status;
  }, [gameState.status, isVoiceEnabled, hasInteracted]);

  useEffect(() => {
    if (gameState.status === 'waiting') {
      setManualMarks({}); setMarkMode('auto'); setLineAlertDismissed(false);
      announcedLineRef.current = false; announcedBingoRef.current = false;
    }
  }, [gameState.status]);

  useEffect(() => {
    if (gameState.drawnNumbers.length > prevDrawnCount.current && gameState.drawnNumbers.length > 0) {
      if (hasInteracted) {
        try {
          const sound = new Audio('https://actions.google.com/sounds/v1/ui/button_click.ogg');
          sound.volume = 0.5; sound.play().catch(() => {});
        } catch (error) {}
        const lastNumber = gameState.drawnNumbers[gameState.drawnNumbers.length - 1];
        if (isVoiceEnabled && window.speechSynthesis) {
          window.speechSynthesis.cancel(); 
          const speech = new SpeechSynthesisUtterance(lastNumber.toString());
          speech.lang = 'es-AR'; window.speechSynthesis.speak(speech);
        }
      }
      if (historyScrollRef.current) historyScrollRef.current.scrollLeft = historyScrollRef.current.scrollWidth;
    }
    prevDrawnCount.current = gameState.drawnNumbers.length;
  }, [gameState.drawnNumbers, isVoiceEnabled, hasInteracted]);

  useEffect(() => {
    if (gameState.lineWinner && gameState.lineWinner.length > 0 && !announcedLineRef.current) {
      announcedLineRef.current = true; setLineAlertDismissed(false); setLineCountdown(5);
      if (hasInteracted) {
        try {
          const lineSound = new Audio('https://actions.google.com/sounds/v1/alarms/ding_dong.ogg');
          lineSound.volume = 0.7; lineSound.play().catch(() => {});
        } catch (e) {}
        if (isVoiceEnabled && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const names = gameState.lineWinner.map((w: any) => w.name).join(' y ');
          const speech = new SpeechSynthesisUtterance(`¡Línea! de ${names}`);
          speech.lang = 'es-AR'; window.speechSynthesis.speak(speech);
        }
      }
    }
  }, [gameState.lineWinner, isVoiceEnabled, hasInteracted]);

  useEffect(() => {
    if (gameState.winner && gameState.winner.length > 0 && !announcedBingoRef.current) {
      announcedBingoRef.current = true;
      if (hasInteracted) {
        try {
          const bingoSound = new Audio('https://actions.google.com/sounds/v1/foley/casino_jackpot.ogg');
          bingoSound.volume = 1.0; bingoSound.play().catch(() => {});
        } catch (e) {}
        if (isVoiceEnabled && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const names = gameState.winner.map((w: any) => w.name).join(' y ');
          const speech = new SpeechSynthesisUtterance(`¡Bingo! Tenemos ganador. Felicitaciones a ${names}`);
          speech.lang = 'es-AR'; window.speechSynthesis.speak(speech);
        }
      }
    }
  }, [gameState.winner, isVoiceEnabled, hasInteracted]);

  useEffect(() => {
    if (lineCountdown > 0 && !lineAlertDismissed && gameState.lineWinner && gameState.lineWinner.length > 0) {
      const timer = setTimeout(() => setLineCountdown(lineCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lineCountdown === 0 && !lineAlertDismissed) { setLineAlertDismissed(true); }
  }, [lineCountdown, lineAlertDismissed, gameState.lineWinner]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !lastName.trim() || !dni.trim() || !phone.trim()) return;
    if (!acceptedTerms) { setCustomAlert({ isOpen: true, title: 'Atención', message: 'Debes aceptar los Términos y Condiciones para poder registrarte y jugar.', type: 'warning' }); return; }
    const newId = `usr_${dni}`; const fullName = `${name.trim()} ${lastName.trim()}`;
    localStorage.setItem('bingoUserId', newId); localStorage.setItem('bingoUserName', fullName);
    setUserId(newId); setUserName(fullName); setIsLogged(true);
    hasCheckedRestore.current = false; setHasInteracted(true);
    if ('speechSynthesis' in window) { const silentSpeech = new SpeechSynthesisUtterance(''); silentSpeech.volume = 0; window.speechSynthesis.speak(silentSpeech); }
    const userRef = ref(db, `users/${newId}`); const snap = await get(userRef); const currentCount = snap.exists() ? (snap.val().loginCount || 0) : 0;
    onDisconnect(userRef).update({ isOnline: false });
    await update(userRef, { id: newId, name: fullName, phone: phone.trim(), dni: dni.trim(), isOnline: true, lastLoginAt: Date.now(), loginCount: currentCount + 1, hasPaidCards: snap.exists() && snap.val().hasPaidCards !== undefined ? snap.val().hasPaidCards : false });
  };

  const handleLogout = () => {
    setCustomConfirm({ isOpen: true, title: 'Cerrar Sesión', message: '¿Estás seguro de que querés salir? Podrás volver a entrar con tu DNI.', confirmText: 'Sí, salir', cancelText: 'Cancelar', iconType: 'logout', onConfirm: () => {
        if (userId) update(ref(db, `users/${userId}`), { isOnline: false });
        localStorage.removeItem('bingoUserId'); localStorage.removeItem('bingoUserName');
        setIsLogged(false); setUserId(''); setUserName(''); setName(''); setLastName(''); setDni(''); setPhone(''); setAcceptedTerms(false); hasCheckedRestore.current = false; setCustomConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleShare = async () => {
    const shareData = { title: 'Bingo de la Familia', text: '🍀 ¡Vení a jugar al Bingo de la Familia conmigo! ¡Hay grandes premios! 🎲', url: window.location.origin };
    try { if (navigator.share) { await navigator.share(shareData); } else { await navigator.clipboard.writeText(window.location.origin); setCustomAlert({ isOpen: true, title: '¡Genial!', message: 'Enlace copiado al portapapeles. Ya podés pegarlo en WhatsApp o en tus redes.', type: 'success' }); } } catch (err) {}
  };

  const handleSelect = async (cardId: string) => { 
    if (!hasPaid) { setCustomAlert({ isOpen: true, title: 'Cuenta Inactiva', message: 'Tus cartones están bloqueados.\n\nPor favor comunicate con el administrador para confirmar tu pago y que te habilite a elegirlos.', type: 'warning', showWhatsapp: true }); return; }
    if (gameState.status !== 'waiting' || isReady) return; await selectCard(cardId, userId, userName); 
  };

  const handleDropAll = () => {
    setCustomConfirm({ isOpen: true, title: 'Soltar Cartones', message: '¿Estás seguro de soltar todos tus cartones actuales para elegir otros nuevos?', confirmText: 'Sí, soltarlos', cancelText: 'Cancelar', iconType: 'trash', onConfirm: async () => { await resetPlayerCards(userId); setCustomConfirm(prev => ({ ...prev, isOpen: false })); } });
  };

  const handleToggleReady = async () => {
    const newReadyState = !isReady; if (newReadyState && myCards.length > 0) { await update(ref(db, `users/${userId}`), { lastPlayedCards: myCards.map((c: any) => c.id), lastPlayedDate: Date.now() }); }
    await toggleReady(userId, newReadyState);
  };

  const handleReclaimCards = async () => {
    setShowRestoreModal(false); if (!currentUser?.lastPlayedCards) return;
    const available: string[] = []; const taken: string[] = [];
    currentUser.lastPlayedCards.forEach((cardId: string) => { const card = cards.find((c: any) => c.id === cardId); if (card && (!card.ownerId || card.ownerId === "")) available.push(cardId); else taken.push(cardId); });
    const updates: any = {}; available.forEach((cardId: string) => { updates[`cards/${cardId}/ownerId`] = userId; updates[`cards/${cardId}/ownerName`] = userName; });
    if (Object.keys(updates).length > 0) await update(ref(db), updates);
    if (taken.length > 0) { setCustomAlert({ isOpen: true, title: 'Cartones Recuperados', message: `Recuperamos ${available.length} de tus cartones anteriores.\n\nLamentablemente, los cartones [${taken.join(', ')}] ya fueron ocupados por alguien más.\n\nElegí otros cartones para completar tu límite.`, type: 'warning' }); }
  };

  const formatRestoreDate = (ts?: number) => {
    if (!ts) return ''; const d = new Date(ts); const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']; const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'agos', 'sep', 'oct', 'nov', 'dic'];
    return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]} del ${d.getFullYear()}`;
  };

  const handleMarkNumber = (cardId: string, num: number) => {
    if (!gameState.drawnNumbers.includes(num)) return;
    setManualMarks(prev => { const currentMarks = prev[cardId] || []; if (currentMarks.includes(num)) return prev; return { ...prev, [cardId]: [...currentMarks, num] }; });
  };

  const handleModeSwitch = (mode: 'auto' | 'manual') => {
    setMarkMode(mode); if (mode === 'manual') { const newMarks: Record<string, number[]> = {}; myCards.forEach((card: any) => { newMarks[card.id] = card.numbers.filter((n: any) => gameState.drawnNumbers.includes(n)); }); setManualMarks(newMarks); }
  };

  const activeAds = ads ? ads.filter((a: any) => a.isActive) : [];
  const uniqueZones = ['Todas', ...Array.from(new Set(activeAds.map((a: any) => a.zone)))];
  const displayedAds = activeAds.filter((a: any) => selectedZone === 'Todas' || a.zone === selectedZone);

  const renderLayoutLobby = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#010326] flex items-center justify-center p-4 md:p-10 font-sans relative overflow-hidden">
      <audio ref={miniAudioRef} preload="none" className="hidden"><source src="https://streaming01.shockmedia.com.ar:8916/stream/;" type="audio/mpeg" /></audio>
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20"><Ticket className="absolute top-[10%] left-[10%] w-16 h-16 text-[#4B68BF] animate-[bounce_4s_infinite]" /><Dices className="absolute bottom-[15%] left-[20%] w-20 h-20 text-[#F29188] animate-[bounce_6s_infinite_reverse]" /><Coins className="absolute top-[25%] right-[15%] w-14 h-14 text-[#F2F2F2] animate-[bounce_5s_infinite]" /></div>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row min-h-[600px] relative z-10 border border-[#4B68BF]/20">
        <div className="w-full md:w-1/2 relative bg-gradient-to-b from-slate-100 to-slate-300 p-4 md:p-8 flex flex-col justify-between">
           <div className="text-center mb-6"><span className="bg-white/50 backdrop-blur-md text-slate-600 border border-white/40 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">Reproductor Bingo - Esperando Partida</span></div>
           <div className="flex-1 mb-6"><ChatBingo userId={userId} userName={userName} isLogged={isLogged} /></div>
           <div className="bg-[#1a1a2e] rounded-3xl p-4 shadow-xl flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-black shrink-0 shadow-inner relative group border border-slate-700">{radioArt ? <img src={radioArt} alt="Radio" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#F29188]"><Radio size={24}/></div>}<button onClick={toggleMiniPlay} aria-label={isMiniPlaying ? "Pausar radio" : "Reproducir radio"} title={isMiniPlaying ? "Pausar radio" : "Reproducir radio"} className="absolute inset-0 bg-black/40 flex items-center justify-center hover:bg-black/60 transition-all">{isMiniPlaying ? <Pause className="text-white fill-current" size={20} /> : <Play className="text-white fill-current ml-1" size={20} />}</button></div>
                <div className="flex-1 overflow-hidden"><div className="w-full overflow-hidden mask-edges mb-1.5"><div className="flex whitespace-nowrap text-white font-black text-xs uppercase tracking-tight animate-[scroll-song_12s_linear_infinite]"><span className="pr-10">{radioTitle}</span><span className="pr-10">{radioTitle}</span></div></div><div className="flex items-center gap-3"><span className="flex items-center gap-1.5 text-[9px] font-black text-green-400 uppercase tracking-widest"><span className={`w-1.5 h-1.5 rounded-full ${isMiniPlaying ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></span> {isMiniPlaying ? 'Al Aire' : 'Pausado'}</span><span className="flex items-center gap-1 text-slate-400 text-[9px] font-black uppercase"><Headphones size={10}/> {radioListeners} {radioListeners === 1 ? 'Oyente' : 'Oyentes'}</span></div></div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-700/50 pt-3"><span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Volumen</span><div className="flex items-center gap-2 group w-1/2 relative"><Volume2 size={12} className="text-slate-400" /><div className="relative w-full h-1.5 bg-slate-700 rounded-full"><div className="absolute top-0 left-0 h-full bg-[#F29188] rounded-full transition-colors" style={{ width: `${miniVolume * 100}%` }}></div><input type="range" title="Ajustar volumen" aria-label="Control de volumen" min="0" max="1" step="0.01" value={miniVolume} onChange={(e) => setMiniVolume(parseFloat(e.target.value))} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" /></div></div></div>
           </div>
        </div>
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white relative items-center text-center"><img src="/logo.png" alt="Bingo de la Familia" className="w-20 h-20 mb-6 rounded-2xl shadow-sm border-2 border-slate-50" />{children}</div>
      </div>
      <style>{`
        @keyframes scroll-song { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .mask-edges { mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }
      `}</style>
    </div>
  );

  // ==========================================
  // RENDERIZADO CONDICIONAL DE PANTALLAS
  // ==========================================
  
  if (!isLogged) {
    return renderLayoutLobby(
      <>
        <h2 className="text-2xl md:text-3xl font-black text-[#010326] uppercase tracking-tight leading-tight">Ingresa tus Datos</h2>
        <div className="w-12 h-1.5 bg-[#F29188] rounded-full mt-3 mb-8 mx-auto"></div>
        <form onSubmit={handleLogin} className="space-y-4 w-full max-w-sm text-left">
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="w-full bg-slate-50 border-2 border-slate-100 py-3 px-4 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-[#4B68BF] transition-all text-sm" /><input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" className="w-full bg-slate-50 border-2 border-slate-100 py-3 px-4 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-[#4B68BF] transition-all text-sm" /><input type="number" required value={dni} onChange={(e) => setDni(e.target.value)} placeholder="DNI (Sin puntos)" className="w-full bg-slate-50 border-2 border-slate-100 py-3 px-4 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-[#4B68BF] transition-all text-sm" /><input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" className="w-full bg-slate-50 border-2 border-slate-100 py-3 px-4 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-[#4B68BF] transition-all text-sm" />
          <div className="flex items-start gap-3 py-2"><input type="checkbox" id="terms" required checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-1 w-4 h-4 text-[#4B68BF] border-slate-300 rounded focus:ring-[#4B68BF]" /><label htmlFor="terms" className="text-[10px] text-slate-500 font-medium leading-tight">Acepto los <button type="button" onClick={() => setShowTerms(true)} className="text-[#4B68BF] font-bold hover:underline">Términos</button> y declaro ser <strong>mayor de 18 años</strong>.</label></div>
          <button type="submit" className="w-full bg-[#F22613] text-white font-black py-4 rounded-xl shadow-md hover:-translate-y-0.5 active:scale-95 transition-all uppercase tracking-wider text-sm">¡A Jugar!</button>
          
          <button type="button" onClick={() => setShowTutorial(true)} className="w-full flex items-center justify-center gap-1.5 text-slate-400 hover:text-[#4B68BF] pt-2 text-[10px] font-black uppercase tracking-widest transition-colors">
            <Info className="w-3.5 h-3.5" /> ¿No sabés cómo jugar?
          </button>
        </form>

        {/* MODAL DE TÉRMINOS Y CONDICIONES (CORREGIDO Y COMPLETO) */}
        {showTerms && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#010326]/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border-2 border-[#4B68BF]/30 animate-in zoom-in-95">
              <div className="bg-[#4B68BF] p-5 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <ScrollText className="w-5 h-5" />
                  <h3 className="font-black uppercase tracking-wider text-sm">Términos y Condiciones</h3>
                </div>
                <button onClick={() => setShowTerms(false)} title="Cerrar términos" aria-label="Cerrar términos" className="hover:bg-white/20 p-1.5 rounded-full transition-colors">
                  <X className="w-5 h-5"/>
                </button>
              </div>
              <div className="p-6 overflow-y-auto text-xs text-slate-600 space-y-4">
                <p className="font-medium text-sm text-slate-700">Al participar en el <strong>Bingo de la Familia</strong>, usted acepta las siguientes reglas y condiciones de juego:</p>
                <div className="space-y-3">
                  <div className="text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                    <strong className="text-sm">1. Edad Mínima (+18):</strong><br/> El juego es estrictamente para mayores de 18 años. Al registrarse, usted confirma bajo juramento cumplir con este requisito legal.
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <strong className="text-sm text-slate-800">2. Validez de Cartones:</strong><br/> Los cartones seleccionados no participarán del sorteo oficial hasta que el administrador verifique y confirme su pago.
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <strong className="text-sm text-slate-800">3. Entrega de Premios:</strong><br/> Los premios se entregarán única y exclusivamente al titular del DNI registrado en este formulario. Sin excepciones.
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <strong className="text-sm text-slate-800">4. Cortes de Conexión:</strong><br/> Si pierde su conexión a internet o se le apaga el celular, no se preocupe. Sus cartones seguirán jugando automáticamente en nuestro servidor y el sistema lo registrará si gana.
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <strong className="text-sm text-slate-800">5. Sistema Automatizado:</strong><br/> La extracción de bolillas y validación de ganadores se realizan mediante un sistema 100% automatizado, transparente y no apelable.
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <strong className="text-sm text-slate-800">6. Empates:</strong><br/> En el caso de que dos o más jugadores completen el Bingo o la Línea exactamente en la misma bolilla, el pozo del premio se dividirá en partes iguales.
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 text-center border-t border-slate-100">
                <button onClick={() => { setAcceptedTerms(true); setShowTerms(false); }} className="w-full bg-[#010326] text-white px-6 py-4 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-[#4B68BF] transition-all shadow-md active:scale-95">
                  Aceptar y Continuar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {customAlert.isOpen && (<div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#010326]/80 backdrop-blur-sm animate-in fade-in duration-300"><div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border-2 border-[#4B68BF]/20"><div className="p-6 text-center flex flex-col items-center pt-8"><div className={`p-4 rounded-full mb-4 shadow-inner ${customAlert.type === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>{customAlert.type === 'warning' ? <AlertTriangle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}</div><h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{customAlert.title}</h3><p className="text-slate-600 text-sm font-medium px-2 whitespace-pre-wrap">{customAlert.message}</p></div><div className="p-4 bg-slate-50 flex flex-col gap-3 border-t border-slate-100">{customAlert.showWhatsapp && (<a href="https://wa.me/5493816537730" target="_blank" rel="noopener noreferrer" className="w-full bg-green-500 text-white font-black py-3.5 rounded-xl shadow-md hover:bg-green-600 transition-all uppercase text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4" /> Escribir al Administrador</a>)}<button onClick={() => setCustomAlert({ ...customAlert, isOpen: false })} className="w-full bg-[#010326] text-white font-black py-3.5 rounded-xl shadow-md hover:bg-[#4B68BF] transition-all uppercase text-xs tracking-widest active:scale-95">Entendido</button></div></div></div>)}
        
        {showTutorial && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#010326]/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowTutorial(false)}>
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
              <div className="bg-[#F29188] p-5 flex justify-between items-center text-[#010326]">
                <div className="flex items-center gap-2"><Info className="w-6 h-6" /><h3 className="font-black uppercase tracking-wider text-base">¿Cómo Jugar?</h3></div>
                <button onClick={() => setShowTutorial(false)} className="hover:bg-black/10 p-1.5 rounded-full transition-colors" title="Cerrar"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 bg-slate-50">
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-blue-100 p-3 rounded-full text-[#4B68BF] shrink-0"><Ticket className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">1. Elegí tus cartones</h4><p className="mt-1 font-medium leading-snug">Seleccioná los cartones que más te gusten haciendo clic sobre ellos. Luego apretá el botón verde que dice "¡Estoy Listo!".</p></div></div>
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-red-100 p-3 rounded-full text-[#F22613] shrink-0"><Lock className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">2. Confirmá tu pago</h4><p className="mt-1 font-medium leading-snug">Tus cartones quedarán bloqueados hasta que el organizador confirme tu pago.</p></div></div>
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-purple-100 p-3 rounded-full text-purple-600 shrink-0"><RefreshCw className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">3. Automático o Manual</h4><p className="mt-1 font-medium leading-snug">Podés dejar que el sistema marque los números solos (Auto) o tocarlos vos mismo (Manual).</p></div></div>
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-yellow-100 p-3 rounded-full text-yellow-600 shrink-0"><Trophy className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">4. ¡Ganar!</h4><p className="mt-1 font-medium leading-snug">Si sos el primero en completar la línea o el cartón, ¡el sistema avisará a todos al instante!</p></div></div>
              </div>
              <div className="p-4 border-t border-slate-200 bg-white text-center"><button onClick={() => setShowTutorial(false)} className="w-full bg-[#4B68BF] text-white px-6 py-4 rounded-xl font-black hover:bg-blue-700 transition-colors uppercase tracking-widest text-sm shadow-md">¡Entendido!</button></div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (gameState.isGameLocked) {
    return renderLayoutLobby(
      <div className="flex flex-col items-center justify-center max-w-xs mx-auto animate-in zoom-in-95 duration-500">
         <h2 className="text-2xl font-black text-[#010326] uppercase tracking-tight leading-tight mb-6">Hola, Bienvenido<br/>al Bingo de la Familia</h2>
         <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 shadow-inner">
           <p className="font-black text-[#4B68BF] text-sm uppercase tracking-wide leading-relaxed">Esta es la sala de espera.<br/><br/>Cuando el admin habilite la sala, podrás ver tus cartones y jugar.</p>
         </div>
         <p className="text-xs text-slate-400 font-bold mt-6 uppercase tracking-widest flex items-center gap-2"><Headphones size={14} /> Mientras tanto, podés usar el chat y escuchar música</p>
         
         <button type="button" onClick={() => setShowTutorial(true)} className="mt-6 flex items-center justify-center gap-1.5 text-slate-400 hover:text-[#4B68BF] py-2 text-[10px] font-black uppercase tracking-widest transition-colors">
            <Info className="w-3.5 h-3.5" /> ¿No sabés cómo jugar?
         </button>

         {showTutorial && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#010326]/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowTutorial(false)}>
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
              <div className="bg-[#F29188] p-5 flex justify-between items-center text-[#010326]">
                <div className="flex items-center gap-2"><Info className="w-6 h-6" /><h3 className="font-black uppercase tracking-wider text-base">¿Cómo Jugar?</h3></div>
                <button onClick={() => setShowTutorial(false)} className="hover:bg-black/10 p-1.5 rounded-full transition-colors" title="Cerrar"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 bg-slate-50">
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-blue-100 p-3 rounded-full text-[#4B68BF] shrink-0"><Ticket className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">1. Elegí tus cartones</h4><p className="mt-1 font-medium leading-snug">Seleccioná los cartones que más te gusten haciendo clic sobre ellos. Luego apretá el botón verde que dice "¡Estoy Listo!".</p></div></div>
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-red-100 p-3 rounded-full text-[#F22613] shrink-0"><Lock className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">2. Confirmá tu pago</h4><p className="mt-1 font-medium leading-snug">Tus cartones quedarán bloqueados hasta que el organizador confirme tu pago.</p></div></div>
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-purple-100 p-3 rounded-full text-purple-600 shrink-0"><RefreshCw className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">3. Automático o Manual</h4><p className="mt-1 font-medium leading-snug">Podés dejar que el sistema marque los números solos (Auto) o tocarlos vos mismo (Manual).</p></div></div>
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-yellow-100 p-3 rounded-full text-yellow-600 shrink-0"><Trophy className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">4. ¡Ganar!</h4><p className="mt-1 font-medium leading-snug">Si sos el primero en completar la línea o el cartón, ¡el sistema avisará a todos al instante!</p></div></div>
              </div>
              <div className="p-4 border-t border-slate-200 bg-white text-center"><button onClick={() => setShowTutorial(false)} className="w-full bg-[#4B68BF] text-white px-6 py-4 rounded-xl font-black hover:bg-blue-700 transition-colors uppercase tracking-widest text-sm shadow-md">¡Entendido!</button></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (cards.length === 0) return <div className="min-h-screen flex flex-col gap-6 items-center justify-center bg-[#010326] text-white"><div className="w-16 h-16 border-4 border-white/20 border-t-[#4B68BF] rounded-full animate-spin"></div><div className="text-xl font-black animate-pulse tracking-widest uppercase">Conectando...</div></div>;

  const isWaiting = gameState.status === 'waiting'; const baseCards = isWaiting ? cards : myCards; const filteredCards = searchTerm ? baseCards.filter((c: any) => c.id.includes(searchTerm)) : baseCards;
  const visibleCards = filteredCards.slice(0, visibleCount);
  const lastDrawnNumber = gameState.drawnNumbers.length > 0 ? gameState.drawnNumbers[gameState.drawnNumbers.length - 1] : null; const previousNumbers = gameState.drawnNumbers.slice(0, -1); const bingoWinners = Array.isArray(gameState.winner) ? gameState.winner : (gameState.winner ? [gameState.winner] : null); const lineWinners = Array.isArray(gameState.lineWinner) ? gameState.lineWinner : (gameState.lineWinner ? [gameState.lineWinner] : null); const arePrizesSet = gameState.prizes && (gameState.prizes.line > 0 || gameState.prizes.bingo > 0);

  return (
    <main className="min-h-screen bg-slate-100 font-sans selection:bg-blue-200 relative pb-32 overflow-x-hidden">
      
      {showTutorial && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#010326]/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowTutorial(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-[#F29188] p-5 flex justify-between items-center text-[#010326]">
              <div className="flex items-center gap-2"><Info className="w-6 h-6" /><h3 className="font-black uppercase tracking-wider text-base">¿Cómo Jugar?</h3></div>
              <button onClick={() => setShowTutorial(false)} className="hover:bg-black/10 p-1.5 rounded-full transition-colors" title="Cerrar"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 bg-slate-50">
              <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-blue-100 p-3 rounded-full text-[#4B68BF] shrink-0"><Ticket className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">1. Elegí tus cartones</h4><p className="mt-1 font-medium leading-snug">Seleccioná los cartones que más te gusten haciendo clic sobre ellos. Luego apretá el botón verde que dice "¡Estoy Listo!".</p></div></div>
              <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-red-100 p-3 rounded-full text-[#F22613] shrink-0"><Lock className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">2. Confirmá tu pago</h4><p className="mt-1 font-medium leading-snug">Tus cartones quedarán bloqueados hasta que el organizador confirme tu pago.</p></div></div>
              <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-purple-100 p-3 rounded-full text-purple-600 shrink-0"><RefreshCw className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">3. Automático o Manual</h4><p className="mt-1 font-medium leading-snug">Podés dejar que el sistema marque los números solos (Auto) o tocarlos vos mismo (Manual).</p></div></div>
              <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="bg-yellow-100 p-3 rounded-full text-yellow-600 shrink-0"><Trophy className="w-6 h-6"/></div><div><h4 className="font-black text-slate-800 text-base uppercase tracking-tight">4. ¡Ganar!</h4><p className="mt-1 font-medium leading-snug">Si sos el primero en completar la línea o el cartón, ¡el sistema avisará a todos al instante!</p></div></div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-white text-center"><button onClick={() => setShowTutorial(false)} className="w-full bg-[#4B68BF] text-white px-6 py-4 rounded-xl font-black hover:bg-blue-700 transition-colors uppercase tracking-widest text-sm shadow-md">¡Entendido!</button></div>
          </div>
        </div>
      )}

      <style>{` @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } } .animate-marquee { animation: marquee 40s linear infinite; display: flex; width: max-content; } .animate-marquee:hover { animation-play-state: paused; } `}</style>
      <header className="bg-white px-4 md:px-8 py-4 shadow-sm border-b sticky top-0 z-30 flex flex-col gap-4">
        <div className="flex justify-between items-center w-full"><div><h1 className="text-2xl font-black text-[#010326] leading-none tracking-tight">Bingo de la Familia</h1><p className="text-xs font-bold text-[#4B68BF] mt-1 uppercase tracking-widest">{userName}</p></div><div className="flex items-center gap-2"><button onClick={() => setShowTutorial(true)} title="Ver tutorial" aria-label="Ver tutorial" className="p-2.5 rounded-xl border bg-blue-50 text-[#4B68BF] border-blue-200 hover:bg-blue-100"><Info className="w-4 h-4" /></button><button onClick={handleShare} title="Compartir bingo" aria-label="Compartir bingo" className="p-2.5 rounded-xl border bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"><Share2 className="w-4 h-4" /></button><button onClick={() => setShowHistoryModal(true)} title="Historial de premios" aria-label="Historial de premios" className="p-2.5 rounded-xl border bg-amber-50 text-amber-500 border-amber-200 hover:bg-amber-100"><Trophy className="w-4 h-4" /></button><button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} title={isVoiceEnabled ? "Silenciar locutora" : "Activar locutora"} aria-label={isVoiceEnabled ? "Silenciar locutora" : "Activar locutora"} className={`p-2.5 rounded-xl border transition-colors ${isVoiceEnabled ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button><button onClick={handleLogout} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-4 py-2.5 rounded-xl transition-colors border border-slate-200 uppercase tracking-widest">Salir</button></div></div>
        <div className="flex flex-col gap-2 w-full mt-1"><div className="flex items-center"><span className="bg-[#010326] text-[#F2F2F2] px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-sm"><span className="w-2 h-2 rounded-full bg-[#4B68BF] animate-pulse"></span>Jugando por: { gameState.winningMode === 'line-only' ? 'Solo Línea' : gameState.winningMode === 'bingo-only' ? 'Solo Cartón Lleno' : 'Línea y Cartón Lleno' }</span></div><div className="flex gap-2 w-full overflow-x-auto scrollbar-hide pb-1 items-center">{!arePrizesSet ? (<div className="bg-slate-100 border border-slate-300 text-slate-500 px-4 py-2 rounded-xl text-[11px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm w-full md:w-auto animate-pulse"><RefreshCw className="w-4 h-4 animate-spin text-[#4B68BF]" /> Calculando pozo y premios...</div>) : (<>{gameState.prizes.line > 0 && (<div className="bg-blue-50 border border-blue-200 text-[#4B68BF] px-4 py-2 rounded-xl text-[11px] md:text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> <span>LÍNEA:</span> <span className="font-black text-base md:text-lg leading-none">${gameState.prizes.line}</span></div>)}{gameState.prizes.bingo > 0 && (<div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-xl text-[11px] md:text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> <span>BINGO:</span> <span className="font-black text-base md:text-lg leading-none">${gameState.prizes.bingo}</span></div>)}</>)}</div></div>
        {isWaiting && !hasPaid && (<div className="mt-6 bg-red-50 border-2 border-red-200 p-6 rounded-2xl text-center shadow-sm mx-4 md:mx-0"><div className="flex justify-center mb-3"><Lock className="w-10 h-10 text-red-500 animate-pulse" /></div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Cuenta Inactiva</h2><p className="text-slate-600 font-medium text-sm">Tus cartones están bloqueados. <strong className="text-red-600">Comunicate con el administrador para confirmar tu pago</strong> y que te habilite a elegirlos.</p></div>)}
        {isWaiting && hasPaid && (<div className={`mt-6 px-4 py-4 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-4 border-2 mx-4 md:mx-0 ${isReady ? 'bg-green-50 border-green-300' : 'bg-white border-[#4B68BF]/30'}`}><div className="text-center lg:text-left"><p className={`font-black text-sm md:text-base ${isReady ? 'text-green-700' : 'text-slate-700'}`}>Cartones Seleccionados: {myCards.length} <span className="text-xs font-bold text-slate-400">(Máx {maxCards})</span></p>{isReady ? <p className="text-xs font-bold text-green-600 mt-0.5">¡Cartones confirmados! Esperando al administrador...</p> : <p className="text-xs font-bold text-[#4B68BF] mt-0.5">Elegí tus cartones en la lista y luego confirmá acá abajo.</p>}</div>{myCards.length > 0 && (<div className="flex w-full lg:w-auto gap-2">{!isReady && <button onClick={handleDropAll} className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-red-50 text-[#F22613] border border-red-200"><Trash2 className="w-4 h-4 inline mr-2"/>Soltar</button>}<button onClick={handleToggleReady} className={`flex-1 px-6 py-3 rounded-xl font-black text-sm shadow-sm ${isReady ? 'bg-slate-200 text-slate-600' : 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]'}`}>{isReady ? 'Modificar' : '¡Estoy Listo!'}</button></div>)}</div>)}
        {!isWaiting && (<div className="mt-6 bg-[#010326] rounded-2xl p-2 md:p-3 shadow-inner flex items-center relative border border-slate-800 mx-4 md:mx-0"><div className="text-[10px] font-black text-slate-500 uppercase absolute top-1.5 left-4">Sorteo</div><div className="flex-shrink-0 flex items-center justify-center mt-3 ml-2 border-r border-slate-700 pr-4">{lastDrawnNumber ? <div className="w-[50px] h-[50px] bg-gradient-to-br from-green-400 to-green-600 text-white text-2xl font-black rounded-full flex items-center justify-center animate-pulse">{lastDrawnNumber}</div> : <div className="w-[50px] h-[50px] bg-slate-800 text-slate-600 text-3xl font-black rounded-full flex items-center justify-center">-</div>}</div><div ref={historyScrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide px-3 pt-4 pb-1 w-full items-center smooth-scroll">{previousNumbers.length > 0 ? previousNumbers.map((num: number, i: number) => (<div key={i} className="flex-shrink-0 flex items-center justify-center font-black rounded-full min-w-[34px] h-[34px] bg-slate-800 text-slate-300 text-xs shadow-inner border border-slate-700">{num}</div>)) : <span className="text-slate-500 font-medium text-xs mt-1">Historial vacío...</span>}</div></div>)}
      </header>

      {activeAds.length > 0 && (<div className="max-w-7xl mx-auto px-4 pt-6"><div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"><div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center"><span className="text-xs font-black text-slate-500 uppercase flex items-center gap-1.5"><Star className="w-4 h-4 text-yellow-400 fill-current"/> Patrocinios</span></div><div className="overflow-hidden w-full pt-4 pb-4"><div className="animate-marquee flex gap-4 px-2">{[...displayedAds, ...displayedAds].map((ad: any, idx: number) => (<div key={`${ad.id}-${idx}`} onClick={() => setSelectedAd(ad)} className="min-w-[280px] border border-slate-200 rounded-xl overflow-hidden shadow-sm cursor-pointer"><div className="h-32 bg-slate-100 relative"><img src={ad.imageUrl} alt="" className="w-full h-full object-cover"/></div><div className="p-4"><h3 className="font-black text-slate-800 text-sm">{ad.name}</h3></div></div>))}</div></div></div></div>)}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {isWaiting && (<div className="mb-8"><input type="number" placeholder="🔍 Buscar cartón por número..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-4 md:p-5 bg-white border-2 border-slate-200 rounded-2xl text-lg font-bold outline-none shadow-sm" /></div>)}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">{visibleCards.map((card: any) => (<BingoCard key={card.id} card={card} userId={userId} drawnNumbers={gameState.drawnNumbers} onSelect={handleSelect} gameStatus={gameState.status} markMode={markMode} manualMarks={manualMarks[card.id] || []} onMarkNumber={handleMarkNumber} isReady={isReady} />))}</div>

        {isWaiting && visibleCards.length < filteredCards.length && (
          <div className="mt-10 text-center">
            <button onClick={() => setVisibleCount(prev => prev + 100)} className="w-full md:w-auto bg-white border-2 border-slate-200 text-[#010326] font-black text-lg px-10 py-5 rounded-2xl hover:border-[#4B68BF] hover:text-[#4B68BF] hover:bg-slate-50 active:scale-95 transition-all shadow-md">Cargar más cartones ↓</button>
            <p className="text-slate-400 text-xs font-bold mt-4 uppercase tracking-widest">Viendo {visibleCards.length} de {filteredCards.length} cartones</p>
          </div>
        )}
      </div>

      {selectedAd && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010326]/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedAd(null)}><div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}><div className="relative bg-slate-100 flex-shrink-0 flex items-center justify-center h-[40vh] md:h-[50vh] border-b border-slate-200"><img src={selectedAd.imageUrl} alt={selectedAd.name} className="max-w-full max-h-full object-contain" /><button onClick={() => setSelectedAd(null)} title="Cerrar anuncio" aria-label="Cerrar anuncio" className="absolute top-3 right-3 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"><X className="w-5 h-5" /></button></div><div className="p-6 overflow-y-auto flex flex-col items-center text-center"><h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">{selectedAd.name}</h3><div className="space-y-3 text-sm text-slate-600 font-medium mb-8 w-full max-w-xs">{selectedAd.zone && <div className="flex items-center justify-center gap-2"><MapPin className="w-4 h-4 text-[#4B68BF]" /> {selectedAd.zone}</div>}{selectedAd.address && <div className="flex items-center justify-center gap-2"><MapPin className="w-4 h-4 text-[#4B68BF]" /> {selectedAd.address}</div>}{selectedAd.hours && <div className="flex items-center justify-center gap-2"><Clock className="w-4 h-4 text-[#4B68BF]" /> {selectedAd.hours}</div>}</div>{selectedAd.phone ? (<a href={`https://wa.me/${selectedAd.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-full bg-green-500 text-white px-6 py-4 rounded-2xl font-black hover:bg-green-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-[0_10px_20px_rgba(34,197,94,0.3)]"><MessageCircle className="w-5 h-5" /> Contactar Ahora</a>) : (<button onClick={() => setSelectedAd(null)} className="w-full bg-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black hover:bg-slate-300 transition-all uppercase tracking-widest">Cerrar</button>)}</div></div></div>)}
      {showHistoryModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010326]/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowHistoryModal(false)}><div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}><div className="bg-[#4B68BF] p-5 flex justify-between items-center text-white"><div className="flex items-center gap-2"><Trophy className="w-5 h-5" /><h3 className="font-black uppercase tracking-wider text-sm">Mis Premios</h3></div><button onClick={() => setShowHistoryModal(false)} title="Cerrar historial" aria-label="Cerrar historial" className="hover:bg-white/20 p-1.5 rounded-full transition-colors"><X className="w-5 h-5"/></button></div><div className="p-6 overflow-y-auto space-y-3 bg-slate-100">{myWins.length === 0 ? (<div className="text-center py-8 text-slate-500"><Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="font-bold text-sm uppercase tracking-widest">Aún no hay premios</p><p className="text-xs mt-1">¡Seguí participando para ganar!</p></div>) : (myWins.map((win: any) => (<div key={win.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden shadow-sm"><div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#F29188] to-[#4B68BF]"></div><div className="flex justify-between items-start pl-2"><div><span className="text-[10px] font-black text-[#4B68BF] uppercase tracking-widest">{win.type}</span><h4 className="font-black text-slate-800 text-lg leading-none mt-1">${win.prize}</h4></div><div className="text-right"><span className="text-xs font-bold text-slate-500 flex items-center justify-end gap-1"><Calendar className="w-3 h-3" /> {win.dateString}</span><span className="text-[10px] font-medium text-slate-400 flex items-center justify-end gap-1 mt-0.5"><Clock className="w-2.5 h-2.5" /> {win.timeString}</span></div></div><div className="pl-2 pt-2 border-t border-slate-100 mt-1 flex justify-between items-center"><span className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Cartón Nº {win.cardId}</span><span className={`text-[9px] font-black uppercase px-2 py-1 rounded tracking-widest ${win.paid ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-amber-100 text-amber-600 border border-amber-200'}`}>{win.paid ? 'Pagado' : 'Pendiente'}</span></div></div>)))}</div></div></div>)}
      {showRestoreModal && currentUser?.lastPlayedCards && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010326]/80 backdrop-blur-sm animate-in fade-in duration-300"><div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col border-4 border-[#4B68BF] animate-in zoom-in-95"><div className="bg-gradient-to-r from-[#010326] to-[#4B68BF] p-6 flex flex-col items-center text-white text-center relative"><div className="absolute -top-6 -right-6 text-white/10"><History className="w-32 h-32" /></div><div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm mb-4 border border-white/20 relative z-10"><Ticket className="w-10 h-10 text-[#F29188]" /></div><h3 className="font-black uppercase tracking-widest text-xl relative z-10">¡Tus cartones te esperan!</h3></div><div className="p-8 text-center"><p className="text-slate-600 font-medium text-base mb-6 leading-relaxed">Tenés guardada tu selección de la jugada pasada del día:<br/><span className="text-[#4B68BF] font-black text-lg bg-blue-50 px-3 py-1 rounded-lg mt-2 inline-block">{formatRestoreDate(currentUser.lastPlayedDate)}</span><br/><br/>Tus cartones anteriores fueron: <br/><span className="font-black text-xl text-slate-800">{currentUser.lastPlayedCards.join(' - ')}</span></p><div className="flex flex-col gap-3"><button onClick={handleReclaimCards} className="w-full bg-green-500 text-white px-6 py-4 rounded-2xl font-black hover:bg-green-600 transition-all shadow-[0_5px_15px_rgba(34,197,94,0.4)] active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> Jugar con los mismos cartones</button><button onClick={() => setShowRestoreModal(false)} className="w-full bg-slate-100 text-slate-600 border border-slate-300 px-6 py-4 rounded-2xl font-bold hover:bg-slate-200 hover:text-slate-800 transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Modificar cartones</button></div></div></div></div>)}
      {lineWinners && lineWinners.length > 0 && (!bingoWinners || bingoWinners.length === 0) && !lineAlertDismissed && (<div className="bg-gradient-to-r from-[#4B68BF] to-indigo-600 text-white px-5 py-4 mx-4 md:mx-auto md:max-w-4xl mt-6 rounded-[1.5rem] shadow-2xl border-2 border-blue-400/50 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 z-20 relative"><div className="absolute -top-3 -right-3 flex items-center gap-2"><div className="bg-[#010326] text-yellow-300 text-xs font-black px-3 py-1.5 rounded-full shadow-lg border-2 border-slate-700 flex items-center gap-1"><Hourglass className="w-3 h-3" /> {lineCountdown}s</div><button onClick={() => setLineAlertDismissed(true)} title="Cerrar aviso de línea" aria-label="Cerrar aviso de línea" className="bg-[#F22613] hover:bg-red-400 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg font-bold border-2 border-white transition-transform hover:scale-110 active:scale-95">✕</button></div><div className="flex flex-col md:flex-row items-center text-center md:text-left gap-4 w-full md:w-auto"><Banknote className="w-12 h-12 text-yellow-300 animate-bounce drop-shadow-lg" /><div><p className="font-black text-xl md:text-2xl leading-tight uppercase tracking-wide text-yellow-300 drop-shadow-md">{lineWinners.length > 1 ? '¡EMPATE DE LÍNEA!' : '¡LÍNEA!'}</p><p className="text-blue-100 font-bold mt-1 text-lg">{lineWinners.map((w: any) => w.name).join(' y ')}</p><p className="text-blue-200/80 text-sm font-medium">Cartones: {lineWinners.map((w: any) => w.cardId).join(', ')}</p></div></div><div className="bg-white/10 backdrop-blur-md text-white px-8 py-3 rounded-2xl font-black shadow-inner border border-white/20 text-center w-full md:w-auto"><span className="text-[10px] block text-blue-200 uppercase tracking-widest mb-1">Premio {lineWinners.length > 1 ? 'a repartir' : 'ganado'}</span><span className="text-3xl">${lineWinners[0]?.prize}</span></div></div>)}
      {bingoWinners && bingoWinners.length > 0 && (<div className="fixed inset-0 bg-[#010326]/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white p-8 md:p-10 rounded-[2.5rem] max-w-lg w-full text-center shadow-[0_0_100px_rgba(75,104,191,0.3)] animate-in zoom-in slide-in-from-bottom-10 border-[6px] border-yellow-400"><div className="flex justify-center mb-6"><Trophy className="w-20 h-20 text-yellow-400 animate-bounce drop-shadow-xl" /></div><h2 className="text-4xl md:text-5xl font-black text-[#010326] mb-3 uppercase tracking-tight">{bingoWinners.length > 1 ? '¡EMPATE MÚLTIPLE!' : '¡BINGO!'}</h2><div className="w-20 h-1.5 bg-yellow-400 mx-auto rounded-full mb-8"></div><div className="space-y-3 mb-8 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">{bingoWinners.map((w: any, idx: number) => (<div key={idx} className="bg-slate-50 border border-slate-200 py-4 px-4 rounded-2xl flex flex-col items-center shadow-sm"><span className="text-2xl text-[#010326] font-black mb-1">{w.name}</span><span className="text-[#4B68BF] font-black text-sm bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">Cartón Nº {w.cardId}</span></div>))}</div><div className="flex flex-col items-center justify-center font-black text-green-700 mb-8 bg-green-50 py-5 rounded-3xl border-[3px] border-green-200 shadow-inner"><span className="text-xs text-green-600 tracking-widest uppercase mb-1">Premio {bingoWinners.length > 1 ? 'a repartir' : 'ganado'}</span><span className="text-5xl md:text-6xl">${bingoWinners[0]?.prize}</span></div><button onClick={() => window.location.reload()} className="w-full bg-[#010326] text-white px-8 py-5 rounded-2xl font-black text-xl hover:bg-[#4B68BF] active:scale-95 transition-all shadow-xl">Cerrar y Ver Tablero</button></div></div>)}
      {customConfirm.isOpen && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#010326]/80 backdrop-blur-sm animate-in fade-in duration-300"><div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border-2 border-[#4B68BF]/20"><div className="p-6 text-center flex flex-col items-center pt-8"><div className="bg-red-50 p-4 rounded-full mb-4 shadow-inner">{customConfirm.iconType === 'trash' ? (<Trash2 className="w-8 h-8 text-[#F22613]" />) : (<LogOut className="w-8 h-8 text-[#F22613]" />)}</div><h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{customConfirm.title}</h3><p className="text-slate-600 text-sm font-medium px-2">{customConfirm.message}</p></div><div className="p-4 bg-slate-50 flex gap-3 border-t border-slate-100"><button onClick={() => setCustomConfirm(prev => ({ ...prev, isOpen: false }))} className="flex-1 bg-white text-slate-600 font-bold py-3.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all uppercase text-xs tracking-widest shadow-sm">{customConfirm.cancelText}</button><button onClick={customConfirm.onConfirm} className="flex-1 bg-[#F22613] text-white font-black py-3.5 rounded-xl shadow-md hover:bg-red-600 transition-all uppercase text-xs tracking-widest active:scale-95">{customConfirm.confirmText}</button></div></div></div>)}
      {customAlert.isOpen && (<div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#010326]/80 backdrop-blur-sm animate-in fade-in duration-300"><div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border-2 border-[#4B68BF]/20"><div className="p-6 text-center flex flex-col items-center pt-8"><div className={`p-4 rounded-full mb-4 shadow-inner ${customAlert.type === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>{customAlert.type === 'warning' ? <AlertTriangle className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}</div><h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{customAlert.title}</h3><p className="text-slate-600 text-sm font-medium px-2 whitespace-pre-wrap">{customAlert.message}</p></div><div className="p-4 bg-slate-50 flex flex-col gap-3 border-t border-slate-100">{customAlert.showWhatsapp && (<a href="https://wa.me/5493816537730" target="_blank" rel="noopener noreferrer" className="w-full bg-green-500 text-white font-black py-3.5 rounded-xl shadow-md hover:bg-green-600 transition-all uppercase text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4" /> Escribir al Administrador</a>)}<button onClick={() => setCustomAlert({ ...customAlert, isOpen: false })} className="w-full bg-[#010326] text-white font-black py-3.5 rounded-xl shadow-md hover:bg-[#4B68BF] transition-all uppercase text-xs tracking-widest active:scale-95">Entendido</button></div></div></div>)}

      <ReproductorRadio />
    </main>
  );
}