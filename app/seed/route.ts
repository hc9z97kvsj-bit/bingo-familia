import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { ref, set } from 'firebase/database';
import { generateCards } from '@/lib/generator';

export async function POST() {
  try {
    const cards = generateCards(2500);
    
    // Convertimos el array de cartones a un objeto para Realtime Database
    const cardsData: Record<string, any> = {};
    cards.forEach(card => {
      cardsData[card.id] = card;
    });

    // Subimos todos los cartones
    await set(ref(db, 'cards'), cardsData);

    // Inicializamos el estado del juego
    await set(ref(db, 'game/state'), {
      status: 'waiting',
      drawnNumbers: [],
      winner: null
    });

    // Reiniciamos los usuarios (opcional, limpia la sala para una nueva noche de bingo)
    await set(ref(db, 'users'), {});

    return NextResponse.json({ success: true, message: 'Base de datos RTDB inicializada con 2500 cartones.' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Error al inicializar la BD' }, { status: 500 });
  }
}