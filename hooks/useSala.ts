"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, buscarJogadoresDaSala, trocarDupla } from "@/lib/supabase";
import { useRealtime, useRealtimeSala } from "./useRealtime";
import type { Sala, Jogador } from "@/types/game";

interface UseSalaOptions {
  codigoSala: string;
  jogadorId?: string;
}

export function useSala({ codigoSala, jogadorId }: UseSalaOptions) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega sala e jogadores inicialmente
  const carregarDados = useCallback(async () => {
    if (!codigoSala) return;

    try {
      const { data: salaData, error: salaError } = await supabase
        .from("salas")
        .select("*")
        .eq("codigo", codigoSala.toUpperCase())
        .single();

      if (salaError) throw salaError;

      setSala(salaData as Sala);
      const jogadoresData = await buscarJogadoresDaSala(salaData.id);
      setJogadores(jogadoresData);
    } catch (err) {
      console.error("Erro ao carregar sala:", err);
      setErro("Sala não encontrada.");
    } finally {
      setCarregando(false);
    }
  }, [codigoSala]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Realtime: novos jogadores
  useRealtime({
    salaId: sala?.id ?? "",
    tabela: "jogadores",
    ativo: !!sala?.id,
    onInsert: (novoJogador) => {
      setJogadores((prev) => {
        const existe = prev.find((j) => j.id === (novoJogador as Jogador).id);
        if (existe) return prev;
        return [...prev, novoJogador as Jogador];
      });
    },
    onUpdate: (jogadorAtualizado) => {
      setJogadores((prev) =>
        prev.map((j) =>
          j.id === (jogadorAtualizado as Jogador).id
            ? { ...j, ...(jogadorAtualizado as Jogador) }
            : j
        )
      );
    },
  });

  // Realtime: mudanças na sala
  useRealtimeSala({
    salaId: sala?.id ?? "",
    ativo: !!sala?.id,
    onUpdate: (salaAtualizada) => {
      setSala((prev) => (prev ? { ...prev, ...(salaAtualizada as Sala) } : prev));
    },
  });

  const jogadorLocal = jogadores.find((j) => j.id === jogadorId) ?? null;

  const handleTrocarDupla = useCallback(
    async (novaDupla: 1 | 2) => {
      if (!jogadorId) return;
      try {
        await trocarDupla(jogadorId, novaDupla);
      } catch (err) {
        console.error("Erro ao trocar dupla:", err);
      }
    },
    [jogadorId]
  );

  return {
    sala,
    jogadores,
    jogadorLocal,
    carregando,
    erro,
    trocarDupla: handleTrocarDupla,
    recarregar: carregarDados,
  };
}
