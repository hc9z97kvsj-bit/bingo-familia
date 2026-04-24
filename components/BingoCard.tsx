'use client';

import { BingoCardData } from '../app/types/bingo';

interface Props {
  card: BingoCardData;
  userId: string;
  drawnNumbers: number[];
  onSelect?: (id: string) => void;
  gameStatus: 'waiting' | 'playing' | 'finished';
  markMode?: 'auto' | 'manual';
  manualMarks?: number[];
  onMarkNumber?: (cardId: string, num: number) => void;
  isReady?: boolean;
}

export default function BingoCard({ 
  card, 
  userId, 
  drawnNumbers, 
  onSelect, 
  gameStatus, 
  markMode = 'auto', 
  manualMarks = [], 
  onMarkNumber,
  isReady = false 
}: Props) {
  
  const isMine = card.ownerId === userId;
  const isOccupied = Boolean(card.ownerId) && card.ownerId !== userId;
  const isPlayMode = gameStatus !== 'waiting';

  const markedCount = isPlayMode ? card.numbers.filter((n: number) => {
    if (markMode === 'auto') return drawnNumbers.includes(n);
    return manualMarks.includes(n);
  }).length : 0;
  
  const numbersLeft = 15 - markedCount;
  const isAlmostWinning = isPlayMode && numbersLeft === 1 && isMine;

  const handleCardClick = () => {
    if (gameStatus === 'waiting' && !isOccupied && !isReady && onSelect) {
      onSelect(card.id);
    }
  };

  const handleCellClick = (e: React.MouseEvent, cellNum: number) => {
    e.stopPropagation(); 
    if (isPlayMode && isMine && markMode === 'manual' && cellNum !== 0 && onMarkNumber) {
      onMarkNumber(card.id, cellNum);
    }
  };

  let wrapperStyle = 'transition-transform duration-200 group';
  if (isOccupied) wrapperStyle += ' opacity-40 cursor-not-allowed grayscale';
  else if (isMine && !isPlayMode) {
    wrapperStyle += ' scale-105 shadow-2xl ring-4 ';
    wrapperStyle += isReady ? 'ring-green-500' : 'ring-blue-500 cursor-pointer';
  }
  else if (!isOccupied && !isPlayMode) wrapperStyle += ' cursor-pointer hover:-translate-y-1 hover:shadow-lg';
  else if (isAlmostWinning) wrapperStyle += ' animate-pulse shadow-[0_0_25px_rgba(250,204,21,0.8)] ring-4 ring-yellow-400';
  else if (isPlayMode) wrapperStyle += ' cursor-default';

  let safeGrid: number[][] = [];
  try {
    safeGrid = typeof card.grid === 'string' ? JSON.parse(card.grid) : card.grid;
  } catch (e) {
    safeGrid = [];
  }

  return (
    <div onClick={handleCardClick} className={`relative bg-white text-black font-sans border-[3px] border-black flex flex-col ${wrapperStyle}`}>
      
      <div className="flex justify-between items-center px-2 py-1 text-[10px] md:text-xs font-bold border-b-[3px] border-black tracking-wide bg-white">
        <span>CARTÓN N.º {card.id}</span>
        <span>{card.serial}</span>
      </div>

      <div className="grid grid-rows-3 bg-black gap-[2px]">
        {safeGrid?.map((row: number[], rIndex: number) => (
          <div key={rIndex} className="grid grid-cols-9 gap-[2px]">
            {row.map((cell: number, cIndex: number) => {
              
              const isMarked = isPlayMode && cell !== 0 && (
                markMode === 'auto' ? drawnNumbers.includes(cell) : manualMarks.includes(cell)
              );
              
              let cellBg = cell === 0 ? 'bg-[#f39c12]' : 'bg-white';
              let cellText = 'text-black';
              
              if (isMarked) {
                cellBg = 'bg-green-600';
                cellText = 'text-white';
              }

              const isClickable = isPlayMode && isMine && markMode === 'manual' && cell !== 0 && !isMarked;

              return (
                <div 
                  key={`${rIndex}-${cIndex}`} 
                  onClick={(e) => cell !== 0 && handleCellClick(e, cell)}
                  className={`flex items-center justify-center aspect-square text-sm sm:text-xl md:text-2xl font-bold select-none transition-colors duration-150
                    ${cellBg} ${cellText} ${isClickable ? 'cursor-pointer hover:bg-orange-100 active:bg-orange-300' : ''}`}
                >
                  <span className={cell !== 0 ? "scale-y-110" : ""}>
                    {cell !== 0 ? cell : ''}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="text-right px-2 py-[2px] text-[8px] sm:text-[10px] border-t-[3px] border-black font-bold tracking-widest uppercase bg-white">
        Bingo de la Familia
      </div>

      {isPlayMode && isMine && isAlmostWinning && (
         <div className="absolute -top-4 -right-4 bg-red-600 text-white text-[10px] sm:text-xs font-black px-3 py-1 rounded-full animate-bounce shadow-lg border-2 border-white z-10">
           ¡A 1 NÚMERO!
         </div>
      )}

      {isMine && !isPlayMode && (
        <div className={`absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full border-[3px] border-white shadow-md font-bold z-10 transition-all duration-200
          ${!isReady ? 'bg-blue-600 text-white group-hover:bg-red-500 group-hover:rotate-90' : 'bg-green-500 text-white'}
        `}>
          <span className={`block ${!isReady ? 'group-hover:hidden' : ''}`}>✓</span>
          {!isReady && <span className="hidden group-hover:block text-xl leading-none -mt-[2px]">×</span>}
        </div>
      )}
    </div>
  );
}