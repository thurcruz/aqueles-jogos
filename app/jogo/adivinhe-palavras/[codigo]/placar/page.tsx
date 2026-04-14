"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { supabase, buscarJogadoresDaSala } from "@/lib/supabase";
import { useRealtime, useRealtimeSala } from "@/hooks/useRealtime";
import { calcularPlacar, quemGanhou } from "@/lib/gameLogic";
import type { Sala, Jogador, ModoJogo } from "@/types/game";

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
  const [ultimaDica, setUltimaDica] = useState("");
  const [urlAtual, setUrlAtual] = useState("");
  const [flashDupla, setFlashDupla] = useState<1 | 2 | null>(null);
  const [palavraAtual, setPalavraAtual] = useState<string | null>(null);
  const [palavraIdx, setPalavraIdx] = useState(0);
  const [totalPalavras, setTotalPalavras] = useState(0);

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

    const jogs = await buscarJogadoresDaSala(salaData.id);
    setJogadores(jogs);

    // Busca palavras do evento iniciar
    const { data: evIniciar } = await supabase
      .from("eventos")
      .select("*")
      .eq("sala_id", salaData.id)
      .eq("tipo", "iniciar")
      .single();

    if (evIniciar) {
      const payload = evIniciar.payload as { palavras_ids: string[]; num_palavras: number };
      setTotalPalavras(payload.num_palavras ?? payload.palavras_ids?.length ?? 0);

      // Busca palavra atual
      const numPalavras = payload.palavras_ids?.length ?? 0;
      const idx = salaData.palavra_atual_idx ?? 0;
      setPalavraIdx(idx);

      if (payload.palavras_ids && payload.palavras_ids[idx]) {
        const { data: palavraData } = await supabase
          .from("palavras")
          .select("palavra")
          .eq("id", payload.palavras_ids[idx])
          .single();
        if (palavraData) setPalavraAtual(palavraData.palavra);
        setTotalPalavras(numPalavras);
      }
    }
  }

  useRealtime({
    salaId: sala?.id ?? "",
    tabela: "jogadores",
    ativo: !!sala?.id,
    onUpdate: (j) => {
      const jog = j as unknown as Jogador;
      setJogadores((prev) => prev.map((jg) => (jg.id === jog.id ? { ...jg, ...jog } : jg)));
    },
    onInsert: (j) => {
      const jog = j as unknown as Jogador;
      setJogadores((prev) => {
        if (prev.find((jg) => jg.id === jog.id)) return prev;
        return [...prev, jog];
      });
    },
  });

  useRealtimeSala({
    salaId: sala?.id ?? "",
    ativo: !!sala?.id,
    onUpdate: (s) => {
      const sa = s as unknown as Sala;
      setSala((prev) => (prev ? { ...prev, ...sa } : prev));
      if ((sa as Sala).palavra_atual_idx !== undefined) {
        setPalavraIdx((sa as Sala).palavra_atual_idx);
      }
    },
  });

  useRealtime({
    salaId: sala?.id ?? "",
    tabela: "eventos",
    ativo: !!sala?.id,
    onInsert: (ev) => {
      const evento = ev as unknown as { tipo: string; payload: Record<string, unknown> };

      if (evento.tipo === "dica" || evento.tipo === "dica_bot") {
        setUltimaDica(evento.payload.dica as string);
      }

      if (evento.tipo === "acertou") {
        const dupla = evento.payload.dupla as 1 | 2;
        setFlashDupla(dupla);
        setUltimaDica("");
        setTimeout(() => setFlashDupla(null), 1200);
      }

      if (evento.tipo === "proxima_palavra") {
        const idx = evento.payload.palavra_idx as number;
        setPalavraIdx(idx);
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

  const modo: ModoJogo = (sala.config?.modo as ModoJogo) ?? "2v2";
  const { dupla1, dupla2 } = calcularPlacar(jogadores, modo);
  const finalizado = sala.status === "encerrada";
  const vencedor = finalizado ? quemGanhou(dupla1, dupla2) : null;

  return (
    <main className="min-h-screen bg-roxo flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="mb-6 text-center">
        <h1 className="font-pixel text-amarelo text-lg">AQUELES JOGOS</h1>
        <p className="font-corpo text-white/50 text-sm font-bold mt-1">Adivinhe as Palavras · {modo}</p>
      </div>

      {/* Código + progresso */}
      <div className="mb-6 text-center">
        <p className="font-pixel text-white text-3xl tracking-widest">{codigo}</p>
        {totalPalavras > 0 && (
          <p className="font-corpo text-white/50 text-sm mt-2 font-bold">
            Palavra {palavraIdx + 1} de {totalPalavras}
          </p>
        )}
      </div>

      {/* Placar */}
      <div className="w-full max-w-2xl grid grid-cols-2 gap-4 mb-6">
        {[
          { pd: dupla1, flash: flashDupla === 1, vence: vencedor === 1, jogs: jogadores.filter(j => j.dupla === 1 && j.ativo) },
          { pd: dupla2, flash: flashDupla === 2, vence: vencedor === 2, jogs: jogadores.filter(j => j.dupla === 2 && j.ativo) },
        ].map(({ pd, flash, vence, jogs }) => (
          <div
            key={pd.dupla}
            className={`rounded-2xl border-4 p-6 text-center transition-all duration-300 ${
              flash
                ? "border-amarelo bg-amarelo scale-105 shadow-brutal-lg"
                : vence
                ? "border-amarelo bg-amarelo/20"
                : "border-white/20 bg-white/5"
            }`}
          >
            <p className={`font-pixel text-sm mb-3 ${flash ? "text-roxo-escuro" : "text-white/60"}`}>
              {pd.label}
            </p>
            <p className={`font-pixel leading-none mb-4 text-8xl ${flash ? "text-roxo-escuro" : pd.pontos >= (pd.dupla === 1 ? dupla2.pontos : dupla1.pontos) ? "text-amarelo" : "text-white/70"}`}>
              {pd.pontos}
            </p>
            {jogs.map((j) => (
              <div key={j.id} className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xl">{getAvatar(j.apelido)}</span>
                <span className={`font-corpo font-black text-lg ${flash ? "text-roxo-escuro" : "text-white"}`}>{j.apelido}</span>
              </div>
            ))}
            {flash && <p className="font-pixel text-roxo-escuro text-xs mt-3 animate-pulse">+1 PONTO!</p>}
          </div>
        ))}
      </div>

      {/* Última dica */}
      {ultimaDica && (
        <div className="mb-4 bg-white/10 border-2 border-white/20 rounded-2xl px-8 py-4 text-center animate-slide-up">
          <p className="font-corpo text-white/50 text-xs font-bold uppercase mb-1">Dica</p>
          <p className="font-corpo font-black text-white text-4xl">{ultimaDica}</p>
        </div>
      )}

      {/* Vencedor */}
      {finalizado && vencedor && (
        <div className="mb-6 bg-amarelo/20 border-4 border-amarelo rounded-2xl px-8 py-4 text-center animate-slide-up">
          <p className="font-pixel text-amarelo text-2xl">
            {vencedor === "empate" ? "🤝 EMPATE!" : `🏆 ${vencedor === 1 ? dupla1.label : dupla2.label} VENCEU!`}
          </p>
        </div>
      )}

      {/* QR Code */}
      {urlAtual && (
        <div className="mt-4 flex flex-col items-center gap-2 opacity-50">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={`${urlAtual}/lobby?codigo=${codigo}`} size={80} bgColor="#ffffff" fgColor="#3A0F80" level="M" />
          </div>
          <p className="font-corpo text-white/50 text-xs font-bold">Escaneie para entrar</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <div className="w-2 h-2 bg-verde rounded-full animate-pulse" />
        <span className="font-corpo text-white/40 text-xs font-bold">Placar ao vivo</span>
      </div>
    </main>
  );
}
