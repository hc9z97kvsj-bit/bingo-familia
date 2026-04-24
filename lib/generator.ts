import { BingoCardData } from '../app/types/bingo';

export function generateCards(count: number): BingoCardData[] {
  const cards: BingoCardData[] = [];

  for (let i = 1; i <= count; i++) {
    const grid: number[][] = [
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0]
    ];
    const usedNumbers = new Set<number>();

    const getColRange = (c: number) => {
      if (c === 0) return [1, 9];
      if (c === 8) return [80, 90];
      return [c * 10, c * 10 + 9];
    };

    for (let r = 0; r < 3; r++) {
      const cols: number[] = [];
      while (cols.length < 5) {
        const c = Math.floor(Math.random() * 9);
        if (!cols.includes(c)) cols.push(c);
      }
      cols.forEach(c => {
        const [min, max] = getColRange(c);
        let num;
        do {
          num = Math.floor(Math.random() * (max - min + 1)) + min;
        } while (usedNumbers.has(num));
        usedNumbers.add(num);
        grid[r][c] = num;
      });
    }

    // Ordenar de menor a mayor
    for (let c = 0; c < 9; c++) {
      const colNums: number[] = [];
      for (let r = 0; r < 3; r++) {
        if (grid[r][c] !== 0) colNums.push(grid[r][c]);
      }
      colNums.sort((a, b) => a - b);
      let index = 0;
      for (let r = 0; r < 3; r++) {
        if (grid[r][c] !== 0) {
          grid[r][c] = colNums[index];
          index++;
        }
      }
    }

    cards.push({
      id: String(i).padStart(4, '0'),
      serial: `SERIE-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      numbers: Array.from(usedNumbers),
      // LA OPCIÓN NUCLEAR: Convertimos la matriz en texto puro antes de mandarla
      grid: JSON.stringify(grid) as any, 
      ownerId: null,
      ownerName: null
    });
  }
  return cards;
}