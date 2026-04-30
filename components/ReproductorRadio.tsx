'use client';
import { useEffect, useRef, useState, memo } from 'react';
import { Radio, Play, Pause, Volume2, VolumeX, ChevronDown, ChevronUp, Headphones } from 'lucide-react';
import { db } from '../lib/firebase';
import { ref, onValue } from 'firebase/database';

const ReproductorRadio = memo(() => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3); // ARRANCAMOS EN 30%
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Variables para la API
  const [songTitle, setSongTitle] = useState('Conectando con la radio...');
  const [songArt, setSongArt] = useState('');
  const [listeners, setListeners] = useState(0);

  // Variables para el Fade-Out y Fade-In Automático
  const [gameStatus, setGameStatus] = useState('waiting');
  const prevStatusRef = useRef('waiting');
  const prevVolumeRef = useRef(0.3); 
  const wasPlayingRef = useRef(false);

  // 1. Escuchar en tiempo real si el admin "Inicia" o "Termina" la partida
  useEffect(() => {
    const statusRef = ref(db, 'game/state/status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        setGameStatus(snapshot.val());
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Autoplay Inteligente al cargar el componente (Entrada a la sala habilitada)
  useEffect(() => {
    const tryAutoplay = () => {
      if (audioRef.current && !isPlaying) {
        audioRef.current.volume = volume;
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch((err) => console.log("Autoplay bloqueado por el navegador", err));
      }
    };
    const timer = setTimeout(tryAutoplay, 1000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Ejecutar Fade-Out (bajar volumen) o Fade-In (subir volumen)
  useEffect(() => {
    let fadeInterval: NodeJS.Timeout;
    
    // CASO A: El admin INICIA la partida (Fade Out)
    if (prevStatusRef.current === 'waiting' && gameStatus === 'playing') {
      const currentlyPlaying = audioRef.current && !audioRef.current.paused;
      wasPlayingRef.current = !!currentlyPlaying;
      
      if (currentlyPlaying && audioRef.current && audioRef.current.volume > 0) {
        prevVolumeRef.current = volume > 0 ? volume : 0.3;
        const steps = 20;
        const fadeStep = audioRef.current.volume / steps;
        
        fadeInterval = setInterval(() => {
          if (audioRef.current && audioRef.current.volume > fadeStep) {
            audioRef.current.volume -= fadeStep;
            setVolume(audioRef.current.volume);
          } else {
            clearInterval(fadeInterval);
            if (audioRef.current) {
              audioRef.current.volume = 0;
              audioRef.current.pause();
            }
            setIsPlaying(false);
            setVolume(0);
          }
        }, 100);
      }
    } 
    // CASO B: El admin TERMINA o REINICIA la partida (Fade In)
    else if (prevStatusRef.current !== 'waiting' && gameStatus === 'waiting') {
      if (wasPlayingRef.current && audioRef.current) {
        audioRef.current.volume = 0;
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
            const steps = 20;
            const targetVolume = prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.3;
            const fadeStep = targetVolume / steps;

            fadeInterval = setInterval(() => {
              if (audioRef.current && audioRef.current.volume + fadeStep < targetVolume) {
                audioRef.current.volume += fadeStep;
                setVolume(audioRef.current.volume);
              } else {
                clearInterval(fadeInterval);
                if (audioRef.current) {
                  audioRef.current.volume = targetVolume;
                }
                setVolume(targetVolume);
              }
            }, 100);
          }).catch(() => {});
        }
      }
    }

    prevStatusRef.current = gameStatus;
    return () => { if (fadeInterval) clearInterval(fadeInterval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus]); 

  // 4. Obtener info de la canción y oyentes cada 10 segundos
  useEffect(() => {
    const fetchRadioInfo = async () => {
      try {
        const response = await fetch('https://streaming01.shockmedia.com.ar/cp/get_info.php?p=8916');
        const data = await response.json();
        if (data && data.title) setSongTitle(data.title);
        if (data && data.art) setSongArt(data.art);
        if (data && data.listeners !== undefined) setListeners(data.listeners);
      } catch (error) {}
    };
    fetchRadioInfo();
    const interval = setInterval(fetchRadioInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  // 5. Controlar el volumen manual del usuario
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // 6. Media Session API
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: songTitle,
        artist: 'Bingo de la Familia - Radio en Vivo',
        artwork: [{ src: songArt || 'https://via.placeholder.com/512/010326/F29188', sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', () => { if (audioRef.current) { audioRef.current.play(); setIsPlaying(true); } });
      navigator.mediaSession.setActionHandler('pause', () => { if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); } });
    }
  }, [songTitle, songArt]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); } 
      else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) { playPromise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); }
      }
    }
  };
  const toggleMute = () => setIsMuted(!isMuted);

  return (
    <>
      <audio ref={audioRef} preload="none" className="hidden"><source src="https://streaming01.shockmedia.com.ar:8916/stream/;" type="audio/mpeg" /></audio>
      <style>{`
        @keyframes scroll-song { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-scroll-song { display: flex; width: max-content; animation: scroll-song 12s linear infinite; }
        .animate-scroll-song:hover { animation-play-state: paused; }
        .mask-edges { mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }
      `}</style>

      {/* BARRA DESMINIMIZADA */}
      <div className={`fixed bottom-0 left-0 right-0 z-[100] h-20 md:h-24 bg-[#010326]/95 backdrop-blur-xl border-t border-[#4B68BF]/30 flex items-center justify-between px-2 md:px-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] 
        transition-all duration-500 ease-in-out transform 
        ${isMinimized ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 pointer-events-auto'}`}
      >
        
        {/* IZQUIERDA */}
        <div className="flex items-center gap-2 md:gap-4 w-[42%] md:w-[40%] overflow-hidden">
          <div className="relative w-10 h-10 md:w-16 md:h-16 rounded-md bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 shadow-lg">
             {songArt ? <img src={songArt} alt="Carátula" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#4B68BF] to-[#010326]"><Radio className="text-[#F29188] w-5 h-5" /></div>}
          </div>
          <div className="flex flex-col overflow-hidden w-full pr-1">
            <div className="w-full overflow-hidden mask-edges">
              <div className="animate-scroll-song">
                <span className="text-white font-black text-[10px] md:text-sm whitespace-nowrap pr-8 cursor-default" title={songTitle}>{songTitle}</span>
                <span className="text-white font-black text-[10px] md:text-sm whitespace-nowrap pr-8 cursor-default" title={songTitle}>{songTitle}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-0.5 md:mt-1">
              <div className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">{isPlaying && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}<span className={`relative inline-flex rounded-full h-full w-full ${isPlaying ? 'bg-green-500' : 'bg-slate-500'}`}></span></span>
                <span className="text-[8px] md:text-[10px] text-slate-400 uppercase tracking-widest font-bold hidden sm:inline">{isPlaying ? 'En Vivo' : 'Pausado'}</span>
              </div>
              <div className="flex items-center gap-1 text-[#F29188] bg-white/5 px-1.5 md:px-2 py-0.5 rounded-full border border-white/10">
                <Headphones size={8} className="md:w-3 md:h-3" />
                <span className="text-[8px] md:text-[10px] font-black uppercase">{listeners} {listeners === 1 ? 'OYENTE' : 'OYENTES'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CENTRO: PLAY/PAUSA */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 w-[16%] md:w-[20%]">
           <button onClick={togglePlay} aria-label={isPlaying ? "Pausar" : "Reproducir"} className="w-10 h-10 md:w-14 md:h-14 bg-white text-[#010326] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
             {isPlaying ? <Pause size={20} className="fill-current md:w-6 md:h-6" /> : <Play size={20} className="fill-current ml-1 md:w-6 md:h-6" />}
           </button>
        </div>

        {/* DERECHA: VOLUMEN FUNCIONAL EN MÓVIL Y MINIMIZAR */}
        <div className="flex items-center justify-end gap-2 md:gap-6 w-[42%] md:w-[40%]">
           
           {isPlaying ? (
             <div className="hidden lg:flex items-end gap-1 h-6">
                <div className="w-1 bg-[#F29188] animate-[bounce_1s_infinite] h-full rounded-t-sm"></div>
                <div className="w-1 bg-[#F29188] animate-[bounce_1.2s_infinite] h-3/4 rounded-t-sm"></div>
                <div className="w-1 bg-[#F29188] animate-[bounce_0.8s_infinite] h-1/2 rounded-t-sm"></div>
                <div className="w-1 bg-[#F29188] animate-[bounce_1.5s_infinite] h-4/5 rounded-t-sm"></div>
             </div>
           ) : <div className="hidden lg:block w-6"></div>}

           {/* BARRA DE VOLUMEN (Ahora visible en celulares) */}
           <div className="flex items-center gap-1.5 md:gap-2 group w-full max-w-[70px] md:max-w-[120px] justify-end">
              <button onClick={toggleMute} aria-label="Silenciar" title="Silenciar volumen" className="text-slate-400 hover:text-white transition-colors flex-shrink-0">
                {isMuted || volume === 0 ? <VolumeX size={16} className="md:w-5 md:h-5" /> : <Volume2 size={16} className="md:w-5 md:h-5" />}
              </button>
              <div className="relative w-full h-1.5 bg-slate-700 rounded-full">
                <div className="absolute top-0 left-0 h-full bg-white group-hover:bg-[#F29188] rounded-full transition-colors" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}></div>
                <input type="range" title="Ajustar volumen" aria-label="Control de volumen" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); if (isMuted) setIsMuted(false); }} className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" />
              </div>
           </div>

           <button onClick={() => setIsMinimized(true)} aria-label="Minimizar reproductor" title="Minimizar reproductor" className="text-slate-400 hover:text-white bg-slate-800/50 p-1.5 md:p-2 rounded-full border border-slate-700/50 hover:bg-slate-700 transition-all flex-shrink-0">
             <ChevronDown size={16} className="md:w-5 md:h-5" />
           </button>
        </div>
      </div>

      {/* BURBUJA MINIMIZADA */}
      <div className={`fixed bottom-6 right-6 z-[100] flex flex-col items-center gap-3 
        transition-all duration-300 ease-in-out transform 
        ${isMinimized ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-50 opacity-0 pointer-events-none'}`}
      >
          <button onClick={() => setIsMinimized(false)} title="Expandir radio" aria-label="Expandir reproductor de radio" className="bg-[#010326] text-slate-400 hover:text-white p-2 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-slate-700 transition-colors"><ChevronUp size={18} /></button>
          <button onClick={togglePlay} title={isPlaying ? "Pausar" : "Reproducir"} aria-label={isPlaying ? "Pausar" : "Reproducir"} className="relative w-16 h-16 rounded-full border-4 border-[#4B68BF] shadow-[0_0_20px_rgba(75,104,191,0.5)] overflow-hidden group hover:scale-105 active:scale-95 transition-all">
             {songArt ? <img src={songArt} alt="Carátula" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#010326] flex items-center justify-center"><Radio className="text-[#F29188]" size={20} /></div>}
             <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity">{isPlaying ? <Pause className="text-white fill-current" size={24} /> : <Play className="text-white fill-current ml-1" size={24} />}</div>
          </button>
      </div>
    </>
  );
});

ReproductorRadio.displayName = 'ReproductorRadio';
export default ReproductorRadio;