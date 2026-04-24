import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mitrax Bingo Online",
  description: "Sistema interactivo de Bingo Multijugador en tiempo real",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="es" 
      suppressHydrationWarning 
    >
      {/* Usamos 'font-sans' de Tailwind para que use la fuente predeterminada más linda de tu sistema */}
      <body className="font-sans antialiased min-h-screen bg-slate-50">
        {children}
      </body>
    </html>
  );
}