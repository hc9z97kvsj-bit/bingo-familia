export interface BingoCardData {
  id: string;
  serial: string;
  numbers: number[];
  grid: any;
  ownerId: string | null;
  ownerName: string | null;
}

export interface WinRecord {
  id: string;
  type: 'LÍNEA' | 'BINGO';
  dateString: string;
  timeString: string;
  cardId: string;
  winningNumbers: string;
  prize: number;
  paid: boolean;
  timestamp: number;
}

export interface Ad {
  id: string;
  name: string;
  imageUrl: string;
  address: string;
  hours: string;
  zone: string;
  phone?: string; // NUEVO: Teléfono de contacto
  isActive: boolean;
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
  dni: string;
  phone?: string;
  selectedCards: string[];
  isReady?: boolean; 
  maxCards?: number; 
  isOnline?: boolean;
  lastLoginAt?: number;
  loginCount?: number;
  winHistory?: Record<string, WinRecord>;
  hasPaidCards?: boolean; 
  lastPlayedCards?: string[];
  lastPlayedDate?: number;
}

export type WinningMode = 'bingo-only' | 'line-and-bingo' | 'line-only';

export interface WinnerInfo {
  userId: string;
  name: string;
  cardId: string;
  timestamp?: string;
  prize: number;
}

export interface GameState {
  status: 'waiting' | 'playing' | 'finished';
  drawnNumbers: number[];
  winningMode: WinningMode;
  lineWinner: WinnerInfo[] | null;
  winner: WinnerInfo[] | null;
  youtubeUrl?: string; 
  youtubeTitle?: string;
  prizes: {
    pool: number;
    line: number;
    bingo: number;
  };
}