"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { JOGOS_DISPONIVEIS } from "@/lib/gameLogic";

export default function Home() {
  const router = useRouter();
  const [mostrarEntrar, setMostrarEntrar] = useState(false);
  const [codigoRapido, setCodigoRapido] = useState("");

  function handleEntrarRapido(e: React.FormEvent) {
    e.preventDefault();
    if (codigoRapido.trim().length >= 4) {
      const codigo = codigoRapido.trim().toUpperCase();
      const codigoFormatado = codigo.startsWith("AJ-") ? codigo : `AJ-${codigo}`;
      router.push(`/lobby?codigo=${codigoFormatado}`);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          {/* Logo */}
          <div>
            <h1 className="font-pixel text-amarelo text-xl leading-tight text-sombra">
              AQUELES
            </h1>
            <h1 className="font-pixel text-white text-xl leading-tight text-sombra -mt-1">
              JOGOS
            </h1>
          </div>

          {/* Botão entrar com código */}
          <Button
            variante="amarelo"
            tamanho="sm"
            icone={<span>🎮</span>}
            onClick={() => setMostrarEntrar((v) => !v)}
          >
            Entrar
          </Button>
        </div>

        {/* Input de código rápido */}
        {mostrarEntrar && (
          <div className="max-w-lg mx-auto mt-3 animate-slide-up">
            <form onSubmit={handleEntrarRapido} className="flex gap-2">
              <input
                type="text"
                value={codigoRapido}
                onChange={(e) => setCodigoRapido(e.target.value)}
                placeholder="Código da sala (AJ-XXXX)"
                maxLength={7}
                autoFocus
                className="flex-1 px-4 py-2 rounded-xl border-2 border-roxo bg-white font-pixel text-roxo-escuro text-sm placeholder-gray-400 focus:outline-none focus:border-amarelo uppercase tracking-widest"
              />
              <Button type="submit" variante="amarelo" tamanho="sm">
                IR
              </Button>
            </form>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="px-4 py-6">
        <div className="max-w-lg mx-auto text-center">
          <p className="font-corpo font-black text-white/80 text-lg">
            Jogos multiplayer em tempo real para jogar com seus amigos!
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Link href="/lobby">
              <Button variante="amarelo" tamanho="lg" icone={<span>🚀</span>}>
                Criar Sala
              </Button>
            </Link>
            <Link href="/lobby?aba=entrar">
              <Button variante="fantasma" tamanho="lg" icone={<span>🎯</span>}>
                Entrar
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Grid de jogos */}
      <section className="flex-1 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <h2 className="font-pixel text-white text-sm mb-4 text-center">JOGOS</h2>

          <div className="space-y-3">
            {JOGOS_DISPONIVEIS.map((jogo) => (
              <JogoCard key={jogo.id} jogo={jogo} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-6 text-center">
        <p className="font-corpo text-white/40 text-sm">
          Feito com 💜 pelo canal{" "}
          <span className="text-amarelo font-bold">Aqueles Jogos</span>
        </p>
      </footer>
    </main>
  );
}

interface JogoCardProps {
  jogo: (typeof JOGOS_DISPONIVEIS)[0];
}

function JogoCard({ jogo }: JogoCardProps) {
  const router = useRouter();

  if (!jogo.disponivel) {
    return (
      <Card variante="padrao" className="opacity-60 relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="text-4xl w-14 h-14 flex items-center justify-center bg-gray-100 rounded-xl flex-shrink-0">
            {jogo.icone}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-corpo font-black text-roxo-escuro text-lg">
                {jogo.nome}
              </h3>
              <span className="bg-gray-200 text-gray-500 text-xs font-bold px-2 py-0.5 rounded uppercase">
                Em breve
              </span>
            </div>
            <p className="font-corpo text-gray-500 text-sm mt-1">{jogo.descricao}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <button
      onClick={() => router.push("/lobby")}
      className="w-full text-left"
    >
      <Card
        variante="destaque"
        className="cursor-pointer hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
      >
        <div className="flex items-start gap-4">
          <div className="text-4xl w-14 h-14 flex items-center justify-center bg-roxo/10 rounded-xl border-2 border-roxo/20 flex-shrink-0">
            {jogo.icone}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-corpo font-black text-roxo-escuro text-lg">
                {jogo.nome}
              </h3>
              <span className="bg-verde text-white text-xs font-bold px-2 py-0.5 rounded uppercase">
                Jogar agora
              </span>
            </div>
            <p className="font-corpo text-gray-600 text-sm mt-1">{jogo.descricao}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-corpo text-xs text-gray-500">
                👥 {jogo.minJogadores}–{jogo.maxJogadores} jogadores
              </span>
            </div>
          </div>
          <div className="text-roxo text-xl flex-shrink-0">→</div>
        </div>
      </Card>
    </button>
  );
}
