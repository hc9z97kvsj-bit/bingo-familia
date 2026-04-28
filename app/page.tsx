'use client';

import { useState, useEffect, useRef } from 'react';
import { useBingoRealtime } from '../hooks/useBingoRealtime';
import BingoCard from '../components/BingoCard';
import { db } from '../lib/firebase';
import { ref, update, get, onDisconnect } from 'firebase/database';
import { Ticket, Dices, Coins, Star, Sparkles, Lock, RefreshCw, X, ScrollText, History, Volume2, VolumeX, Music, Play, Pause, MapPin, Clock, MessageCircle, CheckCircle2, Share2, Trash2, Hourglass, Banknote, Trophy, Calendar, Radio, Info, LogOut } from 'lucide-react';

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
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    iconType: 'trash' | 'logout';
    onConfirm: () => void;
  }>({
    isOpen: false, title: '', message: '', confirmText: 'Aceptar', cancelText: 'Cancelar', iconType: 'trash', onConfirm: () => {}
  });

  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(20); 
  
  const [markMode, setMarkMode] = useState<'auto' | 'manual'>('auto');
  const [manualMarks, setManualMarks] = useState<Record<string, number[]>>({});

  const [lineAlertDismissed, setLineAlertDismissed] = useState(false);
  const [lineCountdown, setLineCountdown] = useState(5);
  
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const announcedLineRef = useRef(false);
  const announcedBingoRef = useRef(false);
  const hasCheckedRestore = useRef(false); 

  const [selectedZone, setSelectedZone] = useState('Todas');
  const [selectedAd, setSelectedAd] = useState<any>(null);

  const { cards, gameState, users, ads, selectCard, toggleReady, resetPlayerCards } = useBingoRealtime(userId);
  
  const radioRef = useRef<HTMLAudioElement | null>(null);
  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  const prevDrawnCount = useRef(0);
  const prevStatusRef = useRef(gameState.status);

  const currentUser = users.find((u: any) => u.id === userId);
  const isReady = currentUser?.isReady || false;
  const maxCards = currentUser?.maxCards || 6; 
  const hasPaid = currentUser?.hasPaidCards || false;
  const myCards = cards.filter((c: any) => c.ownerId === userId);
  
  const myWins = currentUser?.winHistory ? Object.values(currentUser.winHistory).sort((a: any, b: any) => b.timestamp - a.timestamp) : [];

  const getCleanAudioUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('%20') || url.includes('%C2')) return url;
    return encodeURI(url);
  };

  const safeAudioUrl = getCleanAudioUrl(gameState.youtubeUrl || '');

  useEffect(() => {
    const unlockiOSPermissions = () => {
      setHasInteracted(true);
      try {
        const silentAudio = new Audio('/draw.mp3');
        silentAudio.volume = 0;
        silentAudio.play().catch(() => {});
      } catch (e) {}

      if ('speechSynthesis' in window) {
        const silentSpeech = new SpeechSynthesisUtterance('');
        silentSpeech.volume = 0;
        window.speechSynthesis.speak(silentSpeech);
      }
    };

    window.addEventListener('click', unlockiOSPermissions, { once: true });
    window.addEventListener('touchstart', unlockiOSPermissions, { once: true });
    
    return () => {
      window.removeEventListener('click', unlockiOSPermissions);
      window.removeEventListener('touchstart', unlockiOSPermissions);
    };
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
      setUserId(savedId);
      setUserName(savedName);
      setIsLogged(true);
      
      const userRef = ref(db, `users/${savedId}`);
      update(userRef, { isOnline: true, lastLoginAt: Date.now() });
      onDisconnect(userRef).update({ isOnline: false });
    }
  }, []);

  const toggleRadio = () => {
    if (radioRef.current) {
      if (isMusicPlaying) {
        radioRef.current.pause();
      } else {
        radioRef.current.volume = gameState.status === 'playing' ? 0.15 : 0.6;
        radioRef.current.play().catch(() => {
          setIsMusicPlaying(false);
        });
      }
    }
  };

  useEffect(() => {
    if (radioRef.current && isMusicPlaying) {
        radioRef.current.volume = gameState.status === 'playing' ? 0.15 : 0.6;
    }
  }, [gameState.status, isMusicPlaying]);

  useEffect(() => {
    if (prevStatusRef.current === 'waiting' && gameState.status === 'playing') {
      if (isVoiceEnabled && window.speechSynthesis && hasInteracted) {
        window.speechSynthesis.cancel(); 
        const speech = new SpeechSynthesisUtterance("El bingo inicia en tres, dos, uno.");
        speech.lang = 'es-AR';
        window.speechSynthesis.speak(speech);
      }
    }
    prevStatusRef.current = gameState.status;
  }, [gameState.status, isVoiceEnabled, hasInteracted]);

  useEffect(() => {
    if (gameState.status === 'waiting') {
      setManualMarks({});
      setMarkMode('auto');
      setLineAlertDismissed(false);
      announcedLineRef.current = false; 
      announcedBingoRef.current = false;
    }
  }, [gameState.status]);

  useEffect(() => {
    if (gameState.drawnNumbers.length > prevDrawnCount.current && gameState.drawnNumbers.length > 0) {
      if (hasInteracted) {
        try {
          const sound = new Audio('/draw.mp3');
          sound.volume = 0.5;
          const playPromise = sound.play();
          if (playPromise !== undefined) playPromise.catch(() => {});
        } catch (error) {}

        const lastNumber = gameState.drawnNumbers[gameState.drawnNumbers.length - 1];
        if (isVoiceEnabled && window.speechSynthesis) {
          window.speechSynthesis.cancel(); 
          const speech = new SpeechSynthesisUtterance(lastNumber.toString());
          speech.lang = 'es-AR';
          window.speechSynthesis.speak(speech);
        }
      }

      if (historyScrollRef.current) historyScrollRef.current.scrollLeft = historyScrollRef.current.scrollWidth;
    }
    prevDrawnCount.current = gameState.drawnNumbers.length;
  }, [gameState.drawnNumbers, isVoiceEnabled, hasInteracted]);

  useEffect(() => {
    if (gameState.lineWinner && gameState.lineWinner.length > 0 && !announcedLineRef.current) {
      announcedLineRef.current = true; 
      setLineAlertDismissed(false); 
      setLineCountdown(5);

      if (hasInteracted) {
        try {
          const lineSound = new Audio('https://actions.google.com/sounds/v1/alarms/ding_dong.ogg');
          lineSound.volume = 0.7;
          lineSound.play().catch(() => {});
        } catch (e) {}

        if (isVoiceEnabled && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const names = gameState.lineWinner.map((w: any) => w.name).join(' y ');
          const speech = new SpeechSynthesisUtterance(`¡Línea! de ${names}`);
          speech.lang = 'es-AR';
          window.speechSynthesis.speak(speech);
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
          bingoSound.volume = 1.0;
          bingoSound.play().catch(() => {});
        } catch (e) {}

        if (isVoiceEnabled && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const names = gameState.winner.map((w: any) => w.name).join(' y ');
          const speech = new SpeechSynthesisUtterance(`¡Bingo! Tenemos ganador. Felicitaciones a ${names}`);
          speech.lang = 'es-AR';
          window.speechSynthesis.speak(speech);
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
    if (!acceptedTerms) return alert("Debes aceptar los Términos y Condiciones para jugar.");
    
    const newId = `usr_${dni}`;
    const fullName = `${name.trim()} ${lastName.trim()}`;
    
    localStorage.setItem('bingoUserId', newId);
    localStorage.setItem('bingoUserName', fullName);
    setUserId(newId);
    setUserName(fullName);
    setIsLogged(true);
    hasCheckedRestore.current = false; 
    setHasInteracted(true);

    if ('speechSynthesis' in window) {
      const silentSpeech = new SpeechSynthesisUtterance('');
      silentSpeech.volume = 0;
      window.speechSynthesis.speak(silentSpeech);
    }
    
    const userRef = ref(db, `users/${newId}`);
    const snap = await get(userRef);
    const currentCount = snap.exists() ? (snap.val().loginCount || 0) : 0;
    onDisconnect(userRef).update({ isOnline: false });
    await update(userRef, { 
      id: newId, name: fullName, phone: phone.trim(), dni: dni.trim(),
      isOnline: true, lastLoginAt: Date.now(), loginCount: currentCount + 1,
      hasPaidCards: snap.exists() && snap.val().hasPaidCards !== undefined ? snap.val().hasPaidCards : false
    });
  };

  const handleLogout = () => {
    setCustomConfirm({
      isOpen: true,
      title: 'Cerrar Sesión',
      message: '¿Estás seguro de que querés salir? Podrás volver a entrar con tu DNI.',
      confirmText: 'Sí, salir',
      cancelText: 'Cancelar',
      iconType: 'logout',
      onConfirm: () => {
        if (userId) update(ref(db, `users/${userId}`), { isOnline: false });
        localStorage.removeItem('bingoUserId'); localStorage.removeItem('bingoUserName');
        setIsLogged(false); setUserId(''); setUserName(''); setName(''); setLastName(''); setDni(''); setPhone('');
        setAcceptedTerms(false); hasCheckedRestore.current = false; setIsMusicPlaying(false);
        setCustomConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Bingo de la Familia',
      text: '🍀 ¡Vení a jugar al Bingo de la Familia conmigo! ¡Hay grandes premios! 🎲',
      url: window.location.origin
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        alert('¡Enlace copiado al portapapeles! Ya podés pegarlo en WhatsApp o en tus redes.');
      }
    } catch (err) {}
  };

  const handleSelect = async (cardId: string) => {
    // ELIMINÉ LA RESTRICCIÓN DE PAGO PARA QUE PUEDAN ELEGIR
    if (gameState.status !== 'waiting' || isReady) return; 
    await selectCard(cardId, userId, userName);
  };

  const handleDropAll = () => {
    setCustomConfirm({
      isOpen: true,
      title: 'Soltar Cartones',
      message: '¿Estás seguro de soltar todos tus cartones actuales para elegir otros nuevos?',
      confirmText: 'Sí, soltarlos',
      cancelText: 'Cancelar',
      iconType: 'trash',
      onConfirm: async () => {
        await resetPlayerCards(userId);
        setCustomConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleToggleReady = async () => {
    const newReadyState = !isReady;
    if (newReadyState && myCards.length > 0) {
      await update(ref(db, `users/${userId}`), { lastPlayedCards: myCards.map((c: any) => c.id), lastPlayedDate: Date.now() });
    }
    await toggleReady(userId, newReadyState);
  };

  const handleReclaimCards = async () => {
    setShowRestoreModal(false);
    if (!currentUser?.lastPlayedCards) return;
    const available: string[] = []; const taken: string[] = [];
    currentUser.lastPlayedCards.forEach((cardId: string) => {
      const card = cards.find((c: any) => c.id === cardId);
      if (card && (!card.ownerId || card.ownerId === "")) available.push(cardId); else taken.push(cardId);
    });
    const updates: any = {};
    available.forEach((cardId: string) => { updates[`cards/${cardId}/ownerId`] = userId; updates[`cards/${cardId}/ownerName`] = userName; });
    if (Object.keys(updates).length > 0) await update(ref(db), updates);
    if (taken.length > 0) alert(`⚠️ Recuperamos ${available.length} de tus cartones anteriores.\n\nLamentablemente, los cartones: [${taken.join(', ')}] ya fueron ocupados por alguien más en esta partida.\n\nElegí otros cartones para completar tu límite.`);
  };

  const formatRestoreDate = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'agos', 'sep', 'oct', 'nov', 'dic'];
    return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]} del ${d.getFullYear()}`;
  };

  const handleMarkNumber = (cardId: string, num: number) => {
    if (!gameState.drawnNumbers.includes(num)) return;
    setManualMarks(prev => {
        const currentMarks = prev[cardId] || [];
        if (currentMarks.includes(num)) return prev;
        return { ...prev, [cardId]: [...currentMarks, num] };
    });
  };

  const handleModeSwitch = (mode: 'auto' | 'manual') => {
    setMarkMode(mode);
    if (mode === 'manual') {
      const newMarks: Record<string, number[]> = {};
      // ACÁ ESTÁ EL ARREGLO DE VERCEL -> (n: any)
      myCards.forEach((card: any) => { newMarks[card.id] = card.numbers.filter((n: any) => gameState.drawnNumbers.includes(n)); });
      setManualMarks(newMarks);
    }
  };

  const activeAds = ads ? ads.filter((a: any) => a.isActive) : [];
  const uniqueZones = ['Todas', ...Array.from(new Set(activeAds.map((a: any) => a.zone)))];
  const displayedAds = activeAds.filter((a: any) => selectedZone === 'Todas' || a.zone === selectedZone);

  if (gameState.isGameLocked) {
    return (
      <div className="min-h-screen bg-[#010326] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans z-50">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
           <Ticket className="absolute top-[10%] left-[10%] w-16 h-16 text-[#4B68BF] animate-[bounce_4s_infinite]" />
           <Dices className="absolute bottom-[15%] left-[20%] w-20 h-20 text-[#F29188] animate-[bounce_6s_infinite_reverse]" />
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] max-w-md w-full text-center shadow-[0_0_50px_rgba(75,104,191,0.3)] animate-in zoom-in slide-in-from-bottom-10 border-[6px] border-[#4B68BF]/30 relative z-10">
          <div className="flex justify-center mb-6">
            <div className="bg-[#4B68BF]/10 p-5 rounded-full">
              <Clock className="w-16 h-16 text-[#4B68BF] animate-pulse" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-[#010326] mb-3 uppercase tracking-tight">¡Sala Cerrada!</h2>
          <div className="w-16 h-1.5 bg-[#F29188] mx-auto rounded-full mb-6"></div>
          <p className="text-slate-600 font-medium text-sm mb-8 leading-relaxed">
            El bingo se encuentra fuera de horario y no se puede jugar en este momento. <br/><br/>
            Cualquier consulta, por favor comunicate con el vendedor.
          </p>
          <a 
            href="https://wa.me/5492254423709" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="w-full bg-green-500 text-white px-6 py-4 rounded-2xl font-black hover:bg-green-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-[0_10px_20px_rgba(34,197,94,0.3)]"
          >
            <MessageCircle className="w-5 h-5" /> Consultar Horarios
          </a>
        </div>
      </div>
    );
  }

  // ==========================================
  // PANTALLA DE LOGIN
  // ==========================================
  if (!isLogged) {
    return (
      <div className="min-h-screen bg-[#010326] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans z-50">
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
           <Ticket className="absolute top-[10%] left-[10%] w-16 h-16 text-[#4B68BF] animate-[bounce_4s_infinite]" />
           <Dices className="absolute bottom-[15%] left-[20%] w-20 h-20 text-[#F29188] animate-[bounce_6s_infinite_reverse]" />
           <Coins className="absolute top-[25%] right-[15%] w-14 h-14 text-[#F2F2F2] animate-[bounce_5s_infinite]" />
           <Star className="absolute bottom-[30%] right-[10%] w-12 h-12 text-[#4B68BF] animate-[pulse_3s_infinite]" />
           <Sparkles className="absolute top-[50%] left-[5%] w-10 h-10 text-[#F29188] animate-[pulse_4s_infinite]" />
        </div>

        <div className="text-center mb-6 z-10 px-4 flex flex-col items-center relative mt-4">
          <div className="relative">
            <div className="absolute inset-0 bg-[#F29188] blur-3xl opacity-20 rounded-full animate-pulse"></div>
            <img src="/logo.jpg" alt="Bingo de la Familia" className="w-48 h-48 md:w-64 md:h-64 object-cover rounded-full shadow-[0_0_50px_rgba(0,0,0,0.8)] border-[6px] border-[#4B68BF]/30 relative z-10" />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] w-full max-w-sm relative z-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] px-8 pb-8 pt-10">
          <h2 className="text-center text-xl font-black text-slate-800 mb-6 uppercase tracking-widest">Ingresa tus datos</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative"><input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="w-full border-b-2 border-slate-100 py-3 px-1 text-slate-800 font-bold focus:outline-none focus:border-[#4B68BF] transition-colors bg-transparent placeholder:text-slate-400 placeholder:font-medium" /></div>
            <div className="relative"><input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" className="w-full border-b-2 border-slate-100 py-3 px-1 text-slate-800 font-bold focus:outline-none focus:border-[#4B68BF] transition-colors bg-transparent placeholder:text-slate-400 placeholder:font-medium" /></div>
            <div className="relative"><input type="number" required value={dni} onChange={(e) => setDni(e.target.value)} placeholder="DNI (Sin puntos)" className="w-full border-b-2 border-slate-100 py-3 px-1 text-slate-800 font-bold focus:outline-none focus:border-[#4B68BF] transition-colors bg-transparent placeholder:text-slate-400 placeholder:font-medium" /></div>
            <div className="relative"><input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (Ej: 3512345678)" className="w-full border-b-2 border-slate-100 py-3 px-1 text-slate-800 font-bold focus:outline-none focus:border-[#4B68BF] transition-colors bg-transparent placeholder:text-slate-400 placeholder:font-medium" /></div>

            <div className="flex items-start gap-3 pt-3">
              <input type="checkbox" id="terms" required checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-1 w-4 h-4 text-[#4B68BF] border-slate-300 rounded focus:ring-[#4B68BF]" />
              <label htmlFor="terms" className="text-xs text-slate-500 font-medium leading-tight">
                He leído, acepto los <button type="button" onClick={() => setShowTerms(true)} className="text-[#4B68BF] font-bold hover:underline">Términos y Condiciones</button> y declaro ser <strong>mayor de 18 años</strong>.
              </label>
            </div>
            <button type="submit" aria-label="Entrar" className="w-full bg-[#F22613] text-white font-black text-lg py-4 rounded-full mt-6 shadow-[0_8px_20px_rgba(242,38,19,0.3)] hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(242,38,19,0.4)] active:scale-95 transition-all tracking-wide uppercase">¡A Jugar!</button>
          </form>
        </div>

        {/* BOTÓN DE TUTORIAL EN LA PANTALLA DE INICIO */}
        <button 
          type="button" 
          onClick={() => setShowTutorial(true)} 
          className="mt-8 z-10 flex items-center gap-2 text-white bg-white/10 border border-white/20 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all shadow-lg"
        >
           <Info className="w-5 h-5" /> ¿No sabés cómo jugar?
        </button>

        {showTerms && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010326]/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 border-2 border-[#4B68BF]/30">
              <div className="bg-[#4B68BF] p-5 flex justify-between items-center text-white">
                <div className="flex items-center gap-2"><ScrollText className="w-5 h-5" /><h3 className="font-black uppercase tracking-wider text-sm">Términos y Condiciones</h3></div>
                <button onClick={() => setShowTerms(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors" title="Cerrar" aria-label="Cerrar"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 overflow-y-auto text-sm text-slate-600 space-y-4">
                <p>Al participar en el <strong>Bingo de la Familia</strong>, usted acepta las siguientes reglas:</p>
                <div className="space-y-3">
                  <p className="text-red-500 bg-red-50 p-2 rounded-md"><strong>1. Edad Mínima (+18):</strong> El juego es estrictamente para mayores de 18 años. Al ingresar sus datos, usted confirma y declara cumplir con este requisito legal.</p>
                  <p><strong>2. Validez de Cartones:</strong> Los cartones no participan del sorteo hasta que el administrador confirme el pago.</p>
                  <p><strong>3. Entrega de Premios:</strong> Los premios se entregarán exclusivamente al titular del DNI registrado en este formulario.</p>
                  <p><strong>4. Cortes de Conexión:</strong> Sus cartones seguirán participando del juego de manera automática en el servidor en caso de perder conexión a internet.</p>
                  <p><strong>5. Modalidad de Juego:</strong> Las decisiones del sistema automatizado son finales y no apelables.</p>
                  <p><strong>6. Empates:</strong> En caso de que dos o más jugadores completen el Bingo o la Línea al mismo tiempo, el premio se dividirá en partes iguales.</p>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
                <button onClick={() => { setAcceptedTerms(true); setShowTerms(false); }} className="w-full bg-[#010326] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#4B68BF] transition-colors uppercase tracking-widest text-xs">
                  Aceptar y Continuar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* MODAL DEL TUTORIAL DESDE LOGIN */}
        {showTutorial && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#010326]/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowTutorial(false)}>
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
              <div className="bg-[#F29188] p-5 flex justify-between items-center text-[#010326]">
                <div className="flex items-center gap-2"><Info className="w-6 h-6" /><h3 className="font-black uppercase tracking-wider text-base">¿Cómo Jugar?</h3></div>
                <button onClick={() => setShowTutorial(false)} className="hover:bg-black/10 p-1.5 rounded-full transition-colors" title="Cerrar"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 bg-slate-50">
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-blue-100 p-3 rounded-full text-[#4B68BF] shrink-0"><Ticket className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-black text-slate-800 text-base uppercase tracking-tight">1. Elegí tus cartones</h4>
                    <p className="mt-1 font-medium leading-snug">Seleccioná los cartones que más te gusten haciendo clic sobre ellos. Luego apretá el botón verde que dice "¡Estoy Listo!".</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-red-100 p-3 rounded-full text-[#F22613] shrink-0"><Lock className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-black text-slate-800 text-base uppercase tracking-tight">2. Confirmá tu pago</h4>
                    <p className="mt-1 font-medium leading-snug">Tus cartones seleccionados quedarán bloqueados de forma segura hasta que te comuniques con el vendedor y él confirme tu pago.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-purple-100 p-3 rounded-full text-purple-600 shrink-0"><RefreshCw className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-black text-slate-800 text-base uppercase tracking-tight">3. Automático o Manual</h4>
                    <p className="mt-1 font-medium leading-snug">Durante el sorteo, podés dejar que el sistema marque los números solos (Automático) o ir tocándolos vos mismo por diversión (Manual).</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-yellow-100 p-3 rounded-full text-yellow-600 shrink-0"><Trophy className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-black text-slate-800 text-base uppercase tracking-tight">4. ¡Ganar!</h4>
                    <p className="mt-1 font-medium leading-snug">No hace falta gritar bingo. Si sos el primero en completar la línea o el cartón, ¡el sistema avisará a todos y te mostrará como ganador al instante!</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 bg-white text-center">
                <button onClick={() => setShowTutorial(false)} className="w-full bg-[#4B68BF] text-white px-6 py-4 rounded-xl font-black hover:bg-blue-700 transition-colors uppercase tracking-widest text-sm shadow-md">
                  ¡Entendido!
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col gap-6 items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-slate-200 border-t-[#4B68BF] rounded-full animate-spin"></div>
        <div className="text-xl font-black text-slate-400 animate-pulse tracking-widest uppercase">Conectando...</div>
      </div>
    );
  }

  const isWaiting = gameState.status === 'waiting';
  const baseCards = isWaiting ? cards : myCards;
  const filteredCards = searchTerm ? baseCards.filter((c: any) => c.id.includes(searchTerm)) : baseCards;
  const visibleCards = filteredCards.slice(0, visibleCount);
  
  const lastDrawnNumber = gameState.drawnNumbers.length > 0 ? gameState.drawnNumbers[gameState.drawnNumbers.length - 1] : null;
  const previousNumbers = gameState.drawnNumbers.slice(0, -1);

  const bingoWinners = Array.isArray(gameState.winner) ? gameState.winner : (gameState.winner ? [gameState.winner] : null);
  const lineWinners = Array.isArray(gameState.lineWinner) ? gameState.lineWinner : (gameState.lineWinner ? [gameState.lineWinner] : null);
  const arePrizesSet = gameState.prizes && (gameState.prizes.line > 0 || gameState.prizes.bingo > 0);

  return (
    <main className="min-h-screen bg-slate-100 font-sans selection:bg-blue-200 relative pb-24 overflow-x-hidden">
      
      {/* INYECCIÓN DE CSS PARA EL CARRUSEL INFINITO DE PUBLICIDADES */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
          display: flex;
          width: max-content;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {safeAudioUrl && (
        <audio 
          ref={radioRef} 
          src={safeAudioUrl} 
          preload="none" 
          onPlay={() => setIsMusicPlaying(true)}
          onPause={() => setIsMusicPlaying(false)}
          onError={() => {
            setIsMusicPlaying(false);
          }}
        />
      )}
      
      <header className="bg-white px-4 md:px-8 py-4 shadow-sm border-b sticky top-0 z-30 flex flex-col gap-4">
        <div className="flex justify-between items-center w-full">
          <div>
            <h1 className="text-2xl font-black text-[#010326] leading-none tracking-tight">Bingo de la Familia</h1>
            <p className="text-xs font-bold text-[#4B68BF] mt-1 uppercase tracking-widest">{userName}</p>
          </div>
          
          <div className="flex items-center gap-2">
            
            {/* BOTÓN DE TUTORIAL ADENTRO DEL JUEGO */}
            <button aria-label="Tutorial" onClick={() => setShowTutorial(true)} className="p-2.5 rounded-xl border transition-colors bg-blue-50 text-[#4B68BF] border-blue-200 hover:bg-blue-100" title="¿Cómo jugar?">
              <Info className="w-4 h-4" />
            </button>

            <button aria-label="Compartir Bingo" onClick={handleShare} className="p-2.5 rounded-xl border transition-colors bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" title="Invitar Amigos">
              <Share2 className="w-4 h-4" />
            </button>

            <button aria-label="Mis Premios" onClick={() => setShowHistoryModal(true)} className="p-2.5 rounded-xl border transition-colors bg-amber-50 text-amber-500 border-amber-200 hover:bg-amber-100" title="Mis Premios">
              <Trophy className="w-4 h-4" />
            </button>

            {safeAudioUrl && (
              <div className="hidden md:flex items-center bg-[#4B68BF]/10 border border-[#4B68BF]/20 rounded-xl px-3 py-1.5 gap-2 max-w-[200px]">
                <button aria-label="Reproducir" onClick={toggleRadio} className="text-[#4B68BF] hover:text-[#F29188] transition-colors flex-shrink-0 bg-white p-1 rounded-full shadow-sm" title={isMusicPlaying ? "Pausar música" : "Reproducir música"}>
                  {isMusicPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-[1px]" />}
                </button>
                <div className="flex flex-col overflow-hidden w-full">
                  <span className="flex items-center gap-1 text-[8px] font-black text-[#4B68BF] uppercase tracking-widest">
                    <Radio className={`w-2 h-2 ${isMusicPlaying ? 'animate-pulse text-[#F29188]' : ''}`} /> 
                    Radio Bingo
                  </span>
                  <span className="text-[10px] font-bold text-slate-700 truncate">{gameState.youtubeTitle || 'Música en vivo'}</span>
                </div>
              </div>
            )}

            {safeAudioUrl && (
              <button aria-label="Música" onClick={toggleRadio} className={`md:hidden p-2.5 rounded-xl border transition-colors ${isMusicPlaying ? 'bg-[#4B68BF]/10 text-[#4B68BF] border-[#4B68BF]/30' : 'bg-slate-100 text-slate-400 border-slate-200'}`} title={isMusicPlaying ? "Pausar música" : "Reproducir música"}>
                {isMusicPlaying ? <Music className="w-4 h-4 animate-pulse" /> : <Music className="w-4 h-4 opacity-50" />}
              </button>
            )}

            <button aria-label="Voz" onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} className={`p-2.5 rounded-xl border transition-colors ${isVoiceEnabled ? 'bg-blue-50 text-[#4B68BF] border-blue-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`} title={isVoiceEnabled ? "Desactivar Locutora" : "Activar Locutora"}>
              {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            
            <button onClick={handleLogout} className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-700 px-4 py-2.5 rounded-xl transition-colors border border-slate-200">
              Salir
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full mt-1">
          <div className="flex items-center">
            <span className="bg-[#010326] text-[#F2F2F2] px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#4B68BF] animate-pulse"></span>
              Jugando por: { gameState.winningMode === 'line-only' ? 'Solo Línea' : gameState.winningMode === 'bingo-only' ? 'Solo Cartón Lleno' : 'Línea y Cartón Lleno' }
            </span>
          </div>
          <div className="flex gap-2 w-full overflow-x-auto scrollbar-hide pb-1 items-center">
            {!arePrizesSet ? (
              <div className="bg-slate-100 border border-slate-300 text-slate-500 px-4 py-2 rounded-xl text-[11px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm w-full md:w-auto animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-[#4B68BF]" /> Calculando pozo y premios...
              </div>
            ) : (
              <>
                {(gameState.winningMode === 'line-only' || gameState.winningMode === 'line-and-bingo') && gameState.prizes.line > 0 && (
                  <div className="bg-blue-50 border border-blue-200 text-[#4B68BF] px-4 py-2 rounded-xl text-[11px] md:text-xs font-black uppercase tracking-wider whitespace-nowrap shadow-sm flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5" /> <span>LÍNEA:</span> <span className="font-black text-base md:text-lg leading-none">${gameState.prizes.line}</span>
                  </div>
                )}
                {(gameState.winningMode === 'bingo-only' || gameState.winningMode === 'line-and-bingo') && gameState.prizes.bingo > 0 && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-xl text-[11px] md:text-xs font-black uppercase tracking-wider whitespace-nowrap shadow-sm flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" /> <span>BINGO:</span> <span className="font-black text-base md:text-lg leading-none">${gameState.prizes.bingo}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* EL TABLERO PRINCIPAL DE CARTONES SIEMPRE VISIBLE */}
        <div className="max-w-7xl mx-auto py-8">
          
          {/* AVISO GIGANTE SI NO PAGÓ AÚN */}
          {isWaiting && !hasPaid && (
            <div className="mb-8 bg-red-50 border-2 border-red-200 p-6 rounded-2xl text-center shadow-sm mx-4 md:mx-0">
              <div className="flex justify-center mb-3"><Lock className="w-10 h-10 text-red-500" /></div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Falta Confirmar Pago</h2>
              <p className="text-slate-600 font-medium text-sm">Podés ir eligiendo tus cartones en la lista de abajo, pero <strong className="text-red-600">no participarán del sorteo</strong> hasta que el organizador confirme tu pago y te habilite el botón verde.</p>
            </div>
          )}

          {isWaiting && hasPaid && (
            <div className={`mb-6 px-4 py-4 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-4 transition-colors border-2 mx-4 md:mx-0 ${isReady ? 'bg-green-50 border-green-300 shadow-inner' : 'bg-white border-[#4B68BF]/30 shadow-sm'}`}>
              <div className="text-center lg:text-left">
                <p className={`font-black text-sm md:text-base ${isReady ? 'text-green-700' : 'text-slate-700'}`}>
                  Cartones Seleccionados: {myCards.length} <span className="text-xs font-bold text-slate-400">(Máx {maxCards})</span>
                </p>
                {!isReady && <p className="text-xs font-bold text-[#4B68BF] mt-0.5">Elegí tus cartones en la lista y luego confirmá acá abajo.</p>}
                {isReady && <p className="text-xs font-bold text-green-600 mt-0.5">¡Cartones confirmados! Esperando al administrador...</p>}
              </div>
              {myCards.length > 0 && (
                <div className="flex flex-wrap md:flex-nowrap gap-2 w-full lg:w-auto">
                  {!isReady && (
                    <button onClick={handleDropAll} className="flex-1 lg:flex-none px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-sm bg-red-50 text-[#F22613] hover:bg-red-100 border border-red-200 flex items-center justify-center gap-2">
                      <Trash2 className="w-4 h-4" /> Soltar Todos
                    </button>
                  )}
                  <button onClick={handleToggleReady} className={`flex-1 lg:flex-none px-6 py-3 rounded-xl font-black text-sm transition-all shadow-sm ${isReady ? 'bg-slate-200 text-slate-600 hover:bg-slate-300 border border-slate-300' : 'bg-green-500 text-white hover:bg-green-400 hover:-translate-y-0.5 shadow-[0_0_15px_rgba(34,197,94,0.4)] border border-green-600'}`}>
                    {isReady ? 'Modificar Selección' : '¡Estoy Listo!'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!isWaiting && (
            <div className="bg-[#010326] rounded-2xl p-2 md:p-3 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] overflow-hidden flex items-center relative border border-slate-800 mx-4 md:mx-0 mb-6">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest absolute top-1.5 left-4">Sorteo</div>
              <div className="flex-shrink-0 flex flex-col items-center justify-center mt-3 ml-2 border-r border-slate-700 pr-4">
                {lastDrawnNumber ? (
                  <div className="w-[50px] h-[50px] md:w-[60px] md:h-[60px] bg-gradient-to-br from-green-400 to-green-600 text-white text-2xl md:text-3xl font-black rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.6)] animate-pulse border-2 border-white/20">{lastDrawnNumber}</div>
                ) : (
                  <div className="w-[50px] h-[50px] md:w-[60px] md:h-[60px] bg-slate-800 text-slate-600 text-3xl font-black rounded-full flex items-center justify-center shadow-inner border border-slate-700">-</div>
                )}
              </div>
              <div ref={historyScrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide flex-nowrap px-3 pt-4 pb-1 w-full items-center smooth-scroll">
                {previousNumbers.length > 0 ? previousNumbers.map((num: number, i: number) => (
                  <div key={i} className="flex-shrink-0 flex items-center justify-center font-black rounded-full min-w-[34px] h-[34px] md:min-w-[40px] md:h-[40px] bg-slate-800 text-slate-300 text-xs md:text-sm shadow-inner border border-slate-700">{num}</div>
                )) : (
                  <span className="text-slate-500 font-medium text-xs mt-1">Historial vacío...</span>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* BLOQUE DE PUBLICIDADES CON CARRUSEL INFINITO AUTOMÁTICO */}
      {activeAds.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center overflow-x-auto">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 whitespace-nowrap"><Star className="w-4 h-4 text-yellow-400 fill-current" /> Apoyan este Bingo</span>
              <div className="flex gap-2 ml-4">
                {uniqueZones.map((zone: string) => (
                  <button key={zone} onClick={() => setSelectedZone(zone)} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${selectedZone === zone ? 'bg-[#4B68BF] text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                    {zone}
                  </button>
                ))}
              </div>
            </div>
            
            {displayedAds.length === 0 ? (
              <div className="w-full text-center py-6 text-slate-400 text-xs font-bold uppercase">No hay patrocinios en esta zona.</div>
            ) : (
              <div className="overflow-hidden relative w-full pt-4 pb-4">
                <div className="animate-marquee gap-4 px-2">
                  {[...displayedAds, ...displayedAds, ...displayedAds, ...displayedAds].map((ad: any, idx: number) => (
                    <div 
                      key={`${ad.id}-${idx}`} 
                      onClick={() => setSelectedAd(ad)} 
                      className="min-w-[280px] max-w-[280px] flex-shrink-0 border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group cursor-pointer bg-white"
                    >
                      <div className="h-32 bg-slate-100 overflow-hidden relative">
                        <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/400x200?text=Visitanos')} />
                        <div className="absolute bottom-2 left-2 bg-[#010326]/80 backdrop-blur-sm text-white text-[9px] font-black px-2 py-1 rounded uppercase flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#F29188]" /> {ad.zone}
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-black text-slate-800 text-sm uppercase truncate mb-2">{ad.name}</h3>
                        {ad.address && <p className="text-xs text-slate-500 font-medium truncate flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {ad.address}</p>}
                        {ad.hours && <p className="text-xs text-slate-500 font-medium truncate mt-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> {ad.hours}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LA GRILLA MAGICA DE CARTONES SE MUESTRA SIEMPRE */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {isWaiting && (
          <div className="mb-8 z-20">
            <input type="number" placeholder="🔍 Buscar cartón por número..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-4 md:p-5 bg-white border-2 border-slate-200 rounded-2xl text-lg font-bold text-[#010326] shadow-lg shadow-slate-200/50 focus:border-[#4B68BF] focus:ring-4 focus:ring-[#4B68BF]/10 outline-none transition-all placeholder:text-slate-400" />
          </div>
        )}

        {!isWaiting && (
          <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-200 pb-4 gap-4">
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-black text-[#010326] tracking-tight">Tus Cartones</h2>
              {markMode === 'auto' ? (
                <p className="text-slate-500 text-sm font-bold mt-1">El marcado es 100% automático.</p>
              ) : (
                <p className="text-[#4B68BF] text-sm md:text-base font-black mt-1 animate-pulse">👉 MODO MANUAL: Tocá los números sorteados para marcarlos.</p>
              )}
            </div>
            <div className="flex bg-slate-200 p-1.5 rounded-xl shadow-inner w-full md:w-auto">
                <button onClick={() => handleModeSwitch('auto')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${markMode === 'auto' ? 'bg-white text-[#4B68BF] shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Automático</button>
                <button onClick={() => handleModeSwitch('manual')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${markMode === 'manual' ? 'bg-white text-[#4B68BF] shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Manual</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {visibleCards.map((card: any) => (
            <BingoCard key={card.id} card={card} userId={userId} drawnNumbers={gameState.drawnNumbers} onSelect={handleSelect} gameStatus={gameState.status} markMode={markMode} manualMarks={manualMarks[card.id] || []} onMarkNumber={handleMarkNumber} isReady={isReady} />
          ))}
        </div>

        {isWaiting && visibleCards.length < filteredCards.length && (
          <div className="mt-10 text-center">
            <button onClick={() => setVisibleCount(prev => prev + 20)} className="w-full md:w-auto bg-white border-2 border-slate-200 text-[#010326] font-black text-lg px-10 py-4 rounded-2xl hover:border-[#4B68BF] hover:text-[#4B68BF] hover:bg-slate-50 active:scale-95 transition-all shadow-sm">
              Cargar más cartones ↓
            </button>
          </div>
        )}
      </div>

      {/* MODAL DE PUBLICIDAD A PANTALLA COMPLETA */}
      {selectedAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010326]/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSelectedAd(null)}>
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="relative bg-slate-100 flex-shrink-0 flex items-center justify-center h-[40vh] md:h-[50vh] border-b border-slate-200">
              <img src={selectedAd.imageUrl} alt={selectedAd.name} className="max-w-full max-h-full object-contain" />
              <button onClick={() => setSelectedAd(null)} className="absolute top-3 right-3 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex flex-col items-center text-center">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">{selectedAd.name}</h3>
              <div className="space-y-3 text-sm text-slate-600 font-medium mb-8 w-full max-w-xs">
                {selectedAd.zone && <div className="flex items-center justify-center gap-2"><MapPin className="w-4 h-4 text-[#4B68BF]" /> {selectedAd.zone}</div>}
                {selectedAd.address && <div className="flex items-center justify-center gap-2"><MapPin className="w-4 h-4 text-[#4B68BF]" /> {selectedAd.address}</div>}
                {selectedAd.hours && <div className="flex items-center justify-center gap-2"><Clock className="w-4 h-4 text-[#4B68BF]" /> {selectedAd.hours}</div>}
              </div>
              {selectedAd.phone ? (
                <a href={`https://wa.me/${selectedAd.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-full bg-green-500 text-white px-6 py-4 rounded-2xl font-black hover:bg-green-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-[0_10px_20px_rgba(34,197,94,0.3)]">
                  <MessageCircle className="w-5 h-5" /> Contactar Ahora
                </a>
              ) : (
                <button onClick={() => setSelectedAd(null)} className="w-full bg-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black hover:bg-slate-300 transition-all uppercase tracking-widest">
                  Cerrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEL HISTORIAL DE PREMIOS DEL JUGADOR */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010326]/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-[#4B68BF] p-5 flex justify-between items-center text-white">
              <div className="flex items-center gap-2"><Trophy className="w-5 h-5" /><h3 className="font-black uppercase tracking-wider text-sm">Mis Premios</h3></div>
              <button onClick={() => setShowHistoryModal(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors" aria-label="Cerrar"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3 bg-slate-100">
              {myWins.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-bold text-sm uppercase tracking-widest">Aún no hay premios</p>
                  <p className="text-xs mt-1">¡Seguí participando para ganar!</p>
                </div>
              ) : (
                myWins.map((win: any) => (
                  <div key={win.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden shadow-sm">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#F29188] to-[#4B68BF]"></div>
                    <div className="flex justify-between items-start pl-2">
                       <div>
                         <span className="text-[10px] font-black text-[#4B68BF] uppercase tracking-widest">{win.type}</span>
                         <h4 className="font-black text-slate-800 text-lg leading-none mt-1">${win.prize}</h4>
                       </div>
                       <div className="text-right">
                         <span className="text-xs font-bold text-slate-500 flex items-center justify-end gap-1"><Calendar className="w-3 h-3" /> {win.dateString}</span>
                         <span className="text-[10px] font-medium text-slate-400 flex items-center justify-end gap-1 mt-0.5"><Clock className="w-2.5 h-2.5" /> {win.timeString}</span>
                       </div>
                    </div>
                    <div className="pl-2 pt-2 border-t border-slate-100 mt-1 flex justify-between items-center">
                       <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Cartón Nº {win.cardId}</span>
                       <span className={`text-[9px] font-black uppercase px-2 py-1 rounded tracking-widest ${win.paid ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-amber-100 text-amber-600 border border-amber-200'}`}>{win.paid ? 'Pagado' : 'Pendiente'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECUPERAR CARTONES */}
      {showRestoreModal && currentUser?.lastPlayedCards && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010326]/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col border-4 border-[#4B68BF] animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-[#010326] to-[#4B68BF] p-6 flex flex-col items-center text-white text-center relative">
              <div className="absolute -top-6 -right-6 text-white/10"><History className="w-32 h-32" /></div>
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm mb-4 border border-white/20 relative z-10"><Ticket className="w-10 h-10 text-[#F29188]" /></div>
              <h3 className="font-black uppercase tracking-widest text-xl relative z-10">¡Tus cartones te esperan!</h3>
            </div>
            <div className="p-8 text-center">
              <p className="text-slate-600 font-medium text-base mb-6 leading-relaxed">
                Tenés guardada tu selección de la jugada pasada del día:<br/>
                <span className="text-[#4B68BF] font-black text-lg bg-blue-50 px-3 py-1 rounded-lg mt-2 inline-block">
                  {formatRestoreDate(currentUser.lastPlayedDate)}
                </span>
                <br/><br/>
                Tus cartones anteriores fueron: <br/>
                <span className="font-black text-xl text-slate-800">{currentUser.lastPlayedCards.join(' - ')}</span>
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={handleReclaimCards} className="w-full bg-green-500 text-white px-6 py-4 rounded-2xl font-black hover:bg-green-600 transition-all shadow-[0_5px_15px_rgba(34,197,94,0.4)] active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Jugar con los mismos cartones
                </button>
                <button onClick={() => setShowRestoreModal(false)} className="w-full bg-slate-100 text-slate-600 border border-slate-300 px-6 py-4 rounded-2xl font-bold hover:bg-slate-200 hover:text-slate-800 transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Modificar cartones
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANTALLA DE GANADORES DE LÍNEA */}
      {lineWinners && lineWinners.length > 0 && (!bingoWinners || bingoWinners.length === 0) && !lineAlertDismissed && (
        <div className="bg-gradient-to-r from-[#4B68BF] to-indigo-600 text-white px-5 py-4 mx-4 md:mx-auto md:max-w-4xl mt-6 rounded-[1.5rem] shadow-2xl border-2 border-blue-400/50 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 z-20 relative">
          <div className="absolute -top-3 -right-3 flex items-center gap-2">
            <div className="bg-[#010326] text-yellow-300 text-xs font-black px-3 py-1.5 rounded-full shadow-lg border-2 border-slate-700 flex items-center gap-1"><Hourglass className="w-3 h-3" /> {lineCountdown}s</div>
            <button onClick={() => setLineAlertDismissed(true)} className="bg-[#F22613] hover:bg-red-400 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg font-bold border-2 border-white transition-transform hover:scale-110 active:scale-95">✕</button>
          </div>
          <div className="flex flex-col md:flex-row items-center text-center md:text-left gap-4 w-full md:w-auto">
            <Banknote className="w-12 h-12 text-yellow-300 animate-bounce drop-shadow-lg" />
            <div>
              <p className="font-black text-xl md:text-2xl leading-tight uppercase tracking-wide text-yellow-300 drop-shadow-md">{lineWinners.length > 1 ? '¡EMPATE DE LÍNEA!' : '¡LÍNEA!'}</p>
              <p className="text-blue-100 font-bold mt-1 text-lg">{lineWinners.map((w: any) => w.name).join(' y ')}</p>
              <p className="text-blue-200/80 text-sm font-medium">Cartones: {lineWinners.map((w: any) => w.cardId).join(', ')}</p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md text-white px-8 py-3 rounded-2xl font-black shadow-inner border border-white/20 text-center w-full md:w-auto">
            <span className="text-[10px] block text-blue-200 uppercase tracking-widest mb-1">Premio {lineWinners.length > 1 ? 'a repartir' : 'ganado'}</span>
            <span className="text-3xl">${lineWinners[0]?.prize}</span>
          </div>
        </div>
      )}

      {/* PANTALLA GIGANTE DE BINGO */}
      {bingoWinners && bingoWinners.length > 0 && (
        <div className="fixed inset-0 bg-[#010326]/95 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] max-w-lg w-full text-center shadow-[0_0_100px_rgba(75,104,191,0.3)] animate-in zoom-in slide-in-from-bottom-10 border-[6px] border-yellow-400">
            <div className="flex justify-center mb-6"><Trophy className="w-20 h-20 text-yellow-400 animate-bounce drop-shadow-xl" /></div>
            <h2 className="text-4xl md:text-5xl font-black text-[#010326] mb-3 uppercase tracking-tight">{bingoWinners.length > 1 ? '¡EMPATE MÚLTIPLE!' : '¡BINGO!'}</h2>
            <div className="w-20 h-1.5 bg-yellow-400 mx-auto rounded-full mb-8"></div>
            <div className="space-y-3 mb-8 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                {bingoWinners.map((w: any, idx: number) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 py-4 px-4 rounded-2xl flex flex-col items-center shadow-sm">
                        <span className="text-2xl text-[#010326] font-black mb-1">{w.name}</span>
                        <span className="text-[#4B68BF] font-black text-sm bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">Cartón Nº {w.cardId}</span>
                    </div>
                ))}
            </div>
            <div className="flex flex-col items-center justify-center font-black text-green-700 mb-8 bg-green-50 py-5 rounded-3xl border-[3px] border-green-200 shadow-inner">
              <span className="text-xs text-green-600 tracking-widest uppercase mb-1">Premio {bingoWinners.length > 1 ? 'a repartir' : 'ganado'}</span>
              <span className="text-5xl md:text-6xl">${bingoWinners[0]?.prize}</span>
            </div>
            <button onClick={() => window.location.reload()} className="w-full bg-[#010326] text-white px-8 py-5 rounded-2xl font-black text-xl hover:bg-[#4B68BF] active:scale-95 transition-all shadow-xl">Cerrar y Ver Tablero</button>
          </div>
        </div>
      )}
      
      {/* MODAL DEL TUTORIAL INTERNO */}
      {showTutorial && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#010326]/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowTutorial(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="bg-[#F29188] p-5 flex justify-between items-center text-[#010326]">
              <div className="flex items-center gap-2"><Info className="w-6 h-6" /><h3 className="font-black uppercase tracking-wider text-base">¿Cómo Jugar?</h3></div>
              <button onClick={() => setShowTutorial(false)} className="hover:bg-black/10 p-1.5 rounded-full transition-colors" title="Cerrar"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600 bg-slate-50">
              <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="bg-blue-100 p-3 rounded-full text-[#4B68BF] shrink-0"><Ticket className="w-6 h-6"/></div>
                <div>
                  <h4 className="font-black text-slate-800 text-base uppercase tracking-tight">1. Elegí tus cartones</h4>
                  <p className="mt-1 font-medium leading-snug">Seleccioná los cartones que más te gusten haciendo clic sobre ellos. Luego apretá el botón verde que dice "¡Estoy Listo!".</p>
                </div>
              </div>
              <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="bg-red-100 p-3 rounded-full text-[#F22613] shrink-0"><Lock className="w-6 h-6"/></div>
                <div>
                  <h4 className="font-black text-slate-800 text-base uppercase tracking-tight">2. Confirmá tu pago</h4>
                  <p className="mt-1 font-medium leading-snug">Tus cartones seleccionados quedarán bloqueados de forma segura hasta que te comuniques con el vendedor y él confirme tu pago.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="bg-purple-100 p-3 rounded-full text-purple-600 shrink-0"><RefreshCw className="w-6 h-6"/></div>
                <div>
                  <h4 className="font-black text-slate-800 text-base uppercase tracking-tight">3. Automático o Manual</h4>
                  <p className="mt-1 font-medium leading-snug">Durante el sorteo, podés dejar que el sistema marque los números solos (Automático) o ir tocándolos vos mismo por diversión (Manual).</p>
                </div>
              </div>
              <div className="flex gap-4 items-start bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="bg-yellow-100 p-3 rounded-full text-yellow-600 shrink-0"><Trophy className="w-6 h-6"/></div>
                <div>
                  <h4 className="font-black text-slate-800 text-base uppercase tracking-tight">4. ¡Ganar!</h4>
                  <p className="mt-1 font-medium leading-snug">No hace falta gritar bingo. Si sos el primero en completar la línea o el cartón, ¡el sistema avisará a todos y te mostrará como ganador al instante!</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-white text-center">
              <button onClick={() => setShowTutorial(false)} className="w-full bg-[#4B68BF] text-white px-6 py-4 rounded-xl font-black hover:bg-blue-700 transition-colors uppercase tracking-widest text-sm shadow-md">
                ¡Entendido!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NUEVO CARTEL DE CONFIRMACIÓN PERSONALIZADO */}
      {customConfirm.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#010326]/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border-2 border-[#4B68BF]/20">
            <div className="p-6 text-center flex flex-col items-center pt-8">
              <div className="bg-red-50 p-4 rounded-full mb-4 shadow-inner">
                {customConfirm.iconType === 'trash' ? (
                  <Trash2 className="w-8 h-8 text-[#F22613]" />
                ) : (
                  <LogOut className="w-8 h-8 text-[#F22613]" />
                )}
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{customConfirm.title}</h3>
              <p className="text-slate-600 text-sm font-medium px-2">{customConfirm.message}</p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3 border-t border-slate-100">
              <button
                onClick={() => setCustomConfirm(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-white text-slate-600 font-bold py-3.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all uppercase text-xs tracking-widest shadow-sm"
              >
                {customConfirm.cancelText}
              </button>
              <button
                onClick={customConfirm.onConfirm}
                className="flex-1 bg-[#F22613] text-white font-black py-3.5 rounded-xl shadow-md hover:bg-red-600 transition-all uppercase text-xs tracking-widest active:scale-95"
              >
                {customConfirm.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}