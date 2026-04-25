import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bingo de la Familia",
  description: "¡Vení a jugar al Bingo de la Familia! Sorteos en vivo, grandes premios y mucha diversión.",
  icons: {
    icon: '/logo.png', // Este es el favicon de la pestaña de la compu
    apple: '/logo.png', // Este es el ícono si alguien lo guarda en la pantalla de su celular
  },
  openGraph: {
    title: 'Bingo de la Familia',
    description: '¡Vení a jugar al Bingo de la Familia! Sorteos en vivo, grandes premios y mucha diversión.',
    url: 'https://bingo-familia.vercel.app', 
    siteName: 'Bingo de la Familia',
    images: [
      {
        url: '/logo.png', // Esta es la imagen que va a salir en la miniatura de WhatsApp
        width: 800,
        height: 800,
        alt: 'Logo Bingo de la Familia',
      },
    ],
    locale: 'es_AR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}