import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, update, push, remove } from 'firebase/database';
import { Card, GameState, User } from '../app/types/bingo';

export function useBingoRealtime(currentUserId?: string) {
  const [cards, setCards] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    status: 'waiting',
    drawnNumbers: [],
    winningMode: 'line-and-bingo',
    winner: null,
    lineWinner: null,
    prizes: { pool: 0, line: 0, bingo: 0 },
    isGameLocked: false // Acá está el famoso candado
  });
  const [users, setUsers] = useState<User[]>([]);
  const [ads, setAds] = useState<any[]>([]);

  useEffect(() => {
    // Escuchar el estado del juego
    const stateRef = ref(db, 'game/state');
    const unsubState = onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState({
          status: data.status || 'waiting',
          drawnNumbers: data.drawnNumbers || [],
          winningMode: data.winningMode || 'line-and-bingo',
          winner: data.winner || null,
          lineWinner: data.lineWinner || null,
          prizes: data.prizes || { pool: 0, line: 0, bingo: 0 },
          youtubeUrl: data.youtubeUrl || '',
          youtubeTitle: data.youtubeTitle || '',
          isGameLocked: data.isGameLocked || false // Leemos el candado de la base de datos
        });
      }
    });

    // Escuchar los cartones
    const cardsRef = ref(db, 'cards');
    const unsubCards = onValue(cardsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedCards = Object.values(data) as Card[];
        setCards(parsedCards);
      } else {
        setCards([]);
      }
    });

    // Escuchar a los jugadores
    const usersRef = ref(db, 'users');
    const unsubUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedUsers = Object.values(data) as User[];
        setUsers(parsedUsers);
      } else {
        setUsers([]);
      }
    });

    // Escuchar las publicidades
    const adsRef = ref(db, 'ads');
    const unsubAds = onValue(adsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedAds = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val
        }));
        setAds(parsedAds);
      } else {
        setAds([]);
      }
    });

    return () => {
      unsubState();
      unsubCards();
      unsubUsers();
      unsubAds();
    };
  }, []);

  const selectCard = async (cardId: string, userId: string, userName: string) => {
    const currentUser = users.find(u => u.id === userId);
    const maxCards = currentUser?.maxCards || 6;
    const myCards = cards.filter(c => c.ownerId === userId);

    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    if (card.ownerId === userId) {
      await update(ref(db, `cards/${cardId}`), { ownerId: "", ownerName: "" });
    } else {
      if (card.ownerId && card.ownerId !== "") {
        alert("Este cartón ya fue elegido por otro jugador.");
        return;
      }
      if (myCards.length >= maxCards) {
        alert(`Límite alcanzado: solo podés jugar con ${maxCards} cartones simultáneos.`);
        return;
      }
      await update(ref(db, `cards/${cardId}`), { ownerId: userId, ownerName: userName });
    }
  };

  const toggleReady = async (userId: string, isReady: boolean) => {
    await update(ref(db, `users/${userId}`), { isReady });
  };

  const setPlayerLimit = async (userId: string, maxCards: number) => {
    await update(ref(db, `users/${userId}`), { maxCards });
  };

  const resetPlayerCards = async (userId: string) => {
    const userCards = cards.filter(c => c.ownerId === userId);
    const updates: any = {};
    userCards.forEach(c => {
      updates[`cards/${c.id}/ownerId`] = "";
      updates[`cards/${c.id}/ownerName`] = "";
    });
    updates[`users/${userId}/isReady`] = false;
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
    }
  };

  const toggleUserPayment = async (userId: string, hasPaidCards: boolean) => {
    await update(ref(db, `users/${userId}`), { hasPaidCards });
  };

  const addAd = async (adData: any) => {
    const newAdRef = push(ref(db, 'ads'));
    await update(newAdRef, { ...adData, isActive: true });
  };

  const toggleAd = async (adId: string, currentStatus: boolean) => {
    await update(ref(db, `ads/${adId}`), { isActive: !currentStatus });
  };

  const deleteAd = async (adId: string) => {
    if(confirm("¿Eliminar este patrocinador?")) {
      await remove(ref(db, `ads/${adId}`));
    }
  };

  return {
    cards,
    gameState,
    users,
    ads,
    selectCard,
    toggleReady,
    setPlayerLimit,
    resetPlayerCards,
    toggleUserPayment,
    addAd,
    toggleAd,
    deleteAd
  };
}