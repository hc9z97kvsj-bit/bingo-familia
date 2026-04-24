import { useState, useEffect } from 'react';
import { ref, onValue, update, set } from 'firebase/database';
import { db } from '../lib/firebase';
import { BingoCardData, GameState, User, Ad } from '../app/types/bingo';

export function useBingoRealtime(userId?: string) {
  const [cards, setCards] = useState<BingoCardData[]>([]);
  const [gameState, setGameState] = useState<GameState>({ 
    status: 'waiting', drawnNumbers: [], winningMode: 'line-and-bingo',
    winner: null, lineWinner: null, prizes: { pool: 0, line: 0, bingo: 0 }
  });
  const [users, setUsers] = useState<User[]>([]);
  const [ads, setAds] = useState<Ad[]>([]); // NUEVO: Estado de Publicidad

  const snapshotToArray = <T,>(snapshot: any): T[] => {
    if (snapshot.exists()) {
      return Object.values(snapshot.val()) as T[];
    }
    return [];
  };

  useEffect(() => {
    const unsubsCards = onValue(ref(db, 'cards'), (snap) => setCards(snapshotToArray<BingoCardData>(snap)));
    
    const unsubsGame = onValue(ref(db, 'game/state'), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setGameState({
          status: data.status || 'waiting', drawnNumbers: data.drawnNumbers || [],
          winningMode: data.winningMode || 'line-and-bingo', winner: data.winner || null,
          lineWinner: data.lineWinner || null, prizes: data.prizes || { pool: 0, line: 0, bingo: 0 },
          youtubeUrl: data.youtubeUrl || '', youtubeTitle: data.youtubeTitle || ''
        });
      }
    });
    
    const unsubsUsers = onValue(ref(db, 'users'), (snap) => setUsers(snapshotToArray<User>(snap)));
    
    // NUEVO: Escuchar Publicidad en tiempo real
    const unsubsAds = onValue(ref(db, 'ads'), (snap) => setAds(snapshotToArray<Ad>(snap)));

    return () => { unsubsCards(); unsubsGame(); unsubsUsers(); unsubsAds(); };
  }, []);

  const selectCard = async (cardId: string, uid: string, uname: string) => {
    if (!uid || !uname) return;
    const myCards = cards.filter(c => c.ownerId === uid);
    const targetCard = cards.find(c => c.id === cardId);
    const currentUser = users.find(u => u.id === uid);
    const limit = currentUser?.maxCards || 6;
    if (!targetCard) return;
    if (targetCard.ownerId === uid) {
      await update(ref(db, `cards/${cardId}`), { ownerId: "", ownerName: "" });
      return;
    }
    if (targetCard.ownerId && targetCard.ownerId !== "") return alert("Este cartón ya lo agarró otra persona.");
    if (myCards.length >= limit) return alert(`¡No podés elegir más! Tu límite asignado es de ${limit} cartones.`);
    
    await update(ref(db, `cards/${cardId}`), { ownerId: uid, ownerName: uname });
  };

  const toggleReady = async (uid: string, isReady: boolean) => {
    if (!uid) return;
    await update(ref(db, `users/${uid}`), { isReady });
  };

  const setPlayerLimit = async (uid: string, limit: number) => {
    if (!uid) return;
    await update(ref(db, `users/${uid}`), { maxCards: limit });
  };

  const toggleUserPayment = async (uid: string, hasPaid: boolean) => {
    if (!uid) return;
    await update(ref(db, `users/${uid}`), { hasPaidCards: hasPaid });
  };

  const resetPlayerCards = async (uid: string) => {
    if (!uid) return;
    const userCards = cards.filter(c => c.ownerId === uid);
    for (const c of userCards) {
      await update(ref(db, `cards/${c.id}`), { ownerId: "", ownerName: "" });
    }
    await update(ref(db, `users/${uid}`), { isReady: false, hasPaidCards: false });
  };

  // NUEVAS FUNCIONES DE PUBLICIDAD
  const addAd = async (adData: Omit<Ad, 'id' | 'timestamp' | 'isActive'>) => {
    const id = `ad_${Date.now()}`;
    await set(ref(db, `ads/${id}`), { ...adData, id, isActive: true, timestamp: Date.now() });
  };

  const toggleAd = async (id: string, currentStatus: boolean) => {
    await update(ref(db, `ads/${id}`), { isActive: !currentStatus });
  };

  const deleteAd = async (id: string) => {
    if(confirm("¿Eliminar este patrocinador definitivamente?")) {
      await set(ref(db, `ads/${id}`), null);
    }
  };

  return { cards, gameState, users, ads, selectCard, toggleReady, setPlayerLimit, toggleUserPayment, resetPlayerCards, addAd, toggleAd, deleteAd };
}