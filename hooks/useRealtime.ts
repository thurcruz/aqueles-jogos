"use client";

import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type TabelaRealtime = "salas" | "jogadores" | "rodadas" | "eventos";

interface UseRealtimeOptions {
  salaId: string;
  tabela: TabelaRealtime;
  onInsert?: (payload: unknown) => void;
  onUpdate?: (payload: unknown) => void;
  onDelete?: (payload: unknown) => void;
  ativo?: boolean;
}

export function useRealtime({
  salaId,
  tabela,
  onInsert,
  onUpdate,
  onDelete,
  ativo = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!ativo || !salaId) return;

    const channelName = `${tabela}:sala:${salaId}`;

    channelRef.current = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: tabela,
          filter: `sala_id=eq.${salaId}`,
        },
        (payload) => {
          onInsert?.(payload.new);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: tabela,
          filter: tabela === "salas" ? `id=eq.${salaId}` : `sala_id=eq.${salaId}`,
        },
        (payload) => {
          onUpdate?.(payload.new);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: tabela,
          filter: `sala_id=eq.${salaId}`,
        },
        (payload) => {
          onDelete?.(payload.old);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [salaId, tabela, ativo, onInsert, onUpdate, onDelete]);
}

// Hook específico para updates de sala (usa id ao invés de sala_id)
interface UseRealtimeSalaOptions {
  salaId: string;
  onUpdate?: (payload: unknown) => void;
  ativo?: boolean;
}

export function useRealtimeSala({
  salaId,
  onUpdate,
  ativo = true,
}: UseRealtimeSalaOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!ativo || !salaId) return;

    channelRef.current = supabase
      .channel(`sala:${salaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "salas",
          filter: `id=eq.${salaId}`,
        },
        (payload) => {
          onUpdate?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [salaId, ativo, onUpdate]);
}

// Hook de presença (para saber quem está online)
interface UsePresencaOptions {
  salaId: string;
  jogadorId: string;
  apelido: string;
  ativo?: boolean;
}

export function usePresenca({
  salaId,
  jogadorId,
  apelido,
  ativo = true,
}: UsePresencaOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const trackPresence = useCallback(() => {
    if (!channelRef.current || !ativo) return;
    channelRef.current.track({ jogador_id: jogadorId, apelido, online_at: Date.now() });
  }, [jogadorId, apelido, ativo]);

  useEffect(() => {
    if (!ativo || !salaId || !jogadorId) return;

    channelRef.current = supabase.channel(`presenca:${salaId}`, {
      config: { presence: { key: jogadorId } },
    });

    channelRef.current.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        trackPresence();
      }
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [salaId, jogadorId, ativo, trackPresence]);
}
