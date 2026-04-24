import { NextResponse } from 'next/server';
import { generateCards } from '@/lib/generator';

export async function GET() {
  // Generamos los 2500 cartones y los enviamos al frontend
  const cards = generateCards(2500);
  return NextResponse.json(cards);
}