"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { supabase, buscarJogadoresDaSala } from "@/lib/supabase";
import { useRealtime, useRealtimeSala } from "@/hooks/useRealtime";
import { calcularPlacar, calcularTotalRodadas, quemGanhou } from "@/lib/gameLogic";
import type { Sala, Jogador } from "@/types/game";

const AVATARES = ["🦊", "🐸", "🦁", "🐯", "🐧", "🦄", "🐲", "🦋", "🐙", "🦀"];
function getAvatar(apelido: string): string {
  const idx = apelido.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATARES.length;
  return AVATARES[idx];
}

export default function PlacarPage() {
  const params = useParams();
  const codigo = (params.codigo as string).toUpperCase();

  const [sala, setSala] = useState<Sala | null>(null);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [ultimaDica, setUltimaDica] = useState<string>("");
  const [urlAtual, setUrlAtual] = useState("");
  const [flashPonto, setFlashPonto] = useState<1 | 2 | null>(null);

  useEffect(() => {
    setUrlAtual(window.location.origin);
    carregarDados();
  }, [codigo]);

  async function carregarDados() {
    const { data: salaData } = await supabase
      .from("salas")
      .select("*")
      .eq("codigo", codigo)
      .single();

    if (!salaData) return;
    setSala(salaData as Sala);

    const jogadoresData = await buscarJogadoresDaSala(salaData.id);
    setJogadores(jogadoresData);
  }

  // Realtime: jogadores
  useRealtime({
    salaId: sala?.id ?? "",
    tabela: "jogadores",
    ativo: !!sala?.id,
    onUpdate: (j) => {
      setJogadores((prev) =>
        prev.map((jg) => (jg.id === (j as Jogador).id ? { ...jg, ...(j as Jogador) } : jg))
      );
    },
    onInsert: (j) => {
      setJogadores((prev) => {
        if (prev.find((jg) => jg.id === (j as Jogador).id)) return prev;
        return [...prev, j as Jogador];
      });
    },
  });

  // Realtime: sala
  useRealtimeSala({
    salaId: sala?.id ?? "",
    ativo: !!sala?.id,
    onUpdate: (s) => setSala((prev) => (prev ? { ...prev, ...(s as Sala) } : prev)),
  });

  // Realtime: eventos
  useRealtime({
    salaId: sala?.id ?? "",
    tabela: "eventos",
    ativo: !!sala?.id,
    onInsert: (ev) => {
      const evento = ev as { tipo: string; payload: Record<string, unknown> };
      if (evento.tipo === "dica") {
        setUltimaDica(evento.payload.dica as string);
      }
      if (evento.tipo === "acertou") {
        const dupla = evento.payload.dupla as 1 | 2;
        setFlashPonto(dupla);
        setTimeout(() => setFlashPonto(null), 1000);
        setUltimaDica("");
      }
    },
  });

  if (!sala) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-roxo">
        <p className="font-pixel text-white/50 text-sm animate-pulse">Carregando placar...</p>
      </div>
    );
  }

  const { dupla1, dupla2 } = calcularPlacar(jogadores);
  const totalRodadas = calcularTotalRodadas(sala.config.rodadas);
  const finalizado = sala.status === "encerrada";
  const vencedor = finalizado ? quemGanhou(dupla1, dupla2) : null;

  return (
    <main className="min-h-screen bg-roxo flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="mb-6 text-center">
        <h1 className="font-pixel text-amarelo text-lg leading-tight">AQUELES JOGOS</h1>
        <p className="font-corpo text-white/50 text-sm font-bold mt-1">
          Adivinhe as Palavras
        </p>
      </div>

      {/* Código da sala */}
      <div className="mb-6 text-center">
        <p className="font-corpo text-white/40 text-xs font-bold uppercase tracking-widest mb-1">
          Sala
        </p>
        <p className="font-pixel text-white text-3xl tracking-widest">{codigo}</p>
        <p className="font-corpo text-white/50 text-sm mt-1 font-bold">
          Rodada {sala.rodada_atual} de {totalRodadas}
        </p>
      </div>

      {/* Placar grande */}
      <div className="w-full max-w-2xl grid grid-cols-2 gap-4 mb-6">
        {/* Dupla 1 */}
        <div
          className={`rounded-2xl border-4 p-6 text-center transition-all duration-300 ${
            flashPonto === 1
              ? "border-amarelo bg-amarelo shadow-brutal-lg scale-105"
              : vencedor === 1
              ? "border-amarelo bg-amarelo/20"
              : dupla1.pontos > dupla2.pontos
              ? "border-amarelo/60 bg-white/10"
              : "border-white/20 bg-white/5"
          }`}
        >
          <p className={`font-pixel text-sm mb-3 ${
            flashPonto === 1 ? "text-roxo-escuro" : "text-white/60"
          }`}>
            DUPLA 1
          </p>
          <p className={`font-pixel leading-none mb-4 text-8xl ${
            flashPonto === 1
              ? "text-roxo-escuro"
              : dupla1.pontos >= dupla2.pontos
              ? "text-amarelo"
              : "text-white/70"
          }`}>
            {dupla1.pontos}
          </p>
          <div className="space-y-2">
            {dupla1.jogadores.map((j) => (
              <div key={j.id} className="flex items-center justify-center gap-2">
                <span className="text-xl">{getAvatar(j.apelido)}</span>
                <span className={`font-corpo font-black text-lg ${
                  flashPonto === 1 ? "text-roxo-escuro" : "text-white"
                }`}>
                  {j.apelido}
                </span>
              </div>
            ))}
          </div>
          {flashPonto === 1 && (
            <div className="mt-3 font-pixel text-roxo-escuro text-xs animate-pulse">
              +1 PONTO!
            </div>
          )}
        </div>

        {/* Dupla 2 */}
        <div
          className={`rounded-2xl border-4 p-6 text-center transition-all duration-300 ${
            flashPonto === 2
              ? "border-verde bg-verde shadow-[6px_6px_0_#15803d] scale-105"
              : vencedor === 2
              ? "border-verde bg-verde/20"
              : dupla2.pontos > dupla1.pontos
              ? "border-verde/60 bg-white/10"
              : "border-white/20 bg-white/5"
          }`}
        >
          <p className={`font-pixel text-sm mb-3 ${
            flashPonto === 2 ? "text-white" : "text-white/60"
          }`}>
            DUPLA 2
          </p>
          <p className={`font-pixel leading-none mb-4 text-8xl ${
            flashPonto === 2
              ? "text-white"
              : dupla2.pontos >= dupla1.pontos
              ? "text-verde"
              : "text-white/70"
          }`}>
            {dupla2.pontos}
          </p>
          <div className="space-y-2">
            {dupla2.jogadores.map((j) => (
              <div key={j.id} className="flex items-center justify-center gap-2">
                <span className="text-xl">{getAvatar(j.apelido)}</span>
                <span className={`font-corpo font-black text-lg ${
                  flashPonto === 2 ? "text-white" : "text-white"
                }`}>
                  {j.apelido}
                </span>
              </div>
            ))}
          </div>
          {flashPonto === 2 && (
            <div className="mt-3 font-pixel text-white text-xs animate-pulse">
              +1 PONTO!
            </div>
          )}
        </div>
      </div>

      {/* Última dica */}
      {ultimaDica && (
        <div className="mb-4 bg-white/10 border-2 border-white/20 rounded-2xl px-8 py-4 text-center animate-slide-up">
          <p className="font-corpo text-white/50 text-xs font-bold uppercase mb-1">
            Última dica
          </p>
          <p className="font-corpo font-black text-white text-3xl">{ultimaDica}</p>
        </div>
      )}

      {/* Vencedor */}
      {finalizado && vencedor && (
        <div className="mb-6 text-center bg-amarelo/20 border-4 border-amarelo rounded-2xl px-8 py-4 animate-slide-up">
          <p className="font-pixel text-amarelo text-2xl">
            {vencedor === "empate" ? "🤝 EMPATE!" : `🏆 DUPLA ${vencedor} VENCEU!`}
          </p>
        </div>
      )}

      {/* QR Code para entrar */}
      {urlAtual && (
        <div className="mt-4 flex flex-col items-center gap-3 opacity-60">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG
              value={`${urlAtual}/lobby?codigo=${codigo}`}
              size={80}
              bgColor="#ffffff"
              fgColor="#3A0F80"
              level="M"
            />
          </div>
          <p className="font-corpo text-white/50 text-xs font-bold">
            Escaneie para entrar na sala
          </p>
        </div>
      )}

      {/* Status ao vivo */}
      <div className="mt-4 flex items-center gap-2">
        <div className="w-2 h-2 bg-verde rounded-full animate-pulse" />
        <span className="font-corpo text-white/40 text-xs font-bold">
          Placar ao vivo · atualiza automaticamente
        </span>
      </div>
    </main>
  );
}
