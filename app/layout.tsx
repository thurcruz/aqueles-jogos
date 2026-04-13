import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Nunito } from "next/font/google";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
});

const nunito = Nunito({
  weight: ["400", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aqueles Jogos — Plataforma de Jogos Multiplayer",
  description:
    "Jogos multiplayer em tempo real para jogar com amigos. Do canal Aqueles Jogos!",
  keywords: ["jogos", "multiplayer", "adivinhe palavras", "aqueles jogos"],
  openGraph: {
    title: "Aqueles Jogos",
    description: "Jogos multiplayer em tempo real",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#5B1FA8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${pressStart2P.variable} ${nunito.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
