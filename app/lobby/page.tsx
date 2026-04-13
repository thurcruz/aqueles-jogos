"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import CriarSala from "@/components/lobby/CriarSala";
import EntrarSala from "@/components/lobby/EntrarSala";
import { Suspense } from "react";

function LobbyContent() {
  const searchParams = useSearchParams();
  const abaParam = searchParams.get("aba");
  const codigoParam = searchParams.get("codigo");

  const [abaAtiva, setAbaAtiva] = useState<"criar" | "entrar">(
    abaParam === "entrar" || codigoParam ? "entrar" : "criar"
  );

  useEffect(() => {
    if (abaParam === "entrar" || codigoParam) {
      setAbaAtiva("entrar");
    }
  }, [abaParam, codigoParam]);

  return (
    <main className="min-h-screen flex flex-col px-4 py-6">
      {/* Header */}
      <div className="max-w-lg mx-auto w-full mb-6">
        <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white font-corpo font-bold text-sm transition-colors">
          ← Voltar
        </Link>
        <h1 className="font-pixel text-white text-lg mt-3 text-sombra">
          LOBBY
        </h1>
      </div>

      {/* Card principal */}
      <div className="max-w-lg mx-auto w-full flex-1">
        <Card variante="roxo" padding="lg" className="bg-white/10 border-white/20">
          {/* Abas */}
          <div className="flex rounded-xl overflow-hidden border-2 border-white/20 mb-6">
            <button
              onClick={() => setAbaAtiva("criar")}
              className={`flex-1 py-3 font-corpo font-black text-sm uppercase tracking-wide transition-all ${
                abaAtiva === "criar"
                  ? "bg-amarelo text-roxo-escuro"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              🏠 Criar Sala
            </button>
            <button
              onClick={() => setAbaAtiva("entrar")}
              className={`flex-1 py-3 font-corpo font-black text-sm uppercase tracking-wide transition-all ${
                abaAtiva === "entrar"
                  ? "bg-amarelo text-roxo-escuro"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              🎮 Entrar
            </button>
          </div>

          {/* Conteúdo da aba */}
          {abaAtiva === "criar" ? (
            <CriarSala />
          ) : (
            <EntrarSala codigoInicial={codigoParam ?? ""} />
          )}
        </Card>
      </div>
    </main>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-pixel text-white text-sm animate-pulse">Carregando...</div>
      </div>
    }>
      <LobbyContent />
    </Suspense>
  );
}
