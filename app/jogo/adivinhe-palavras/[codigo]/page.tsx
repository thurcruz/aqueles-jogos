"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PlayerChip from "@/components/ui/PlayerChip";
import PixelIcon from "@/components/ui/PixelIcon";
import {
  supabase,
  carregarDadosLocais,
  buscarJogadoresDaSala,
  publicarEvento,
  adicionarPontos,
  sairDaSala,
} from "@/lib/supabase";
import {
  determinarPapel2v2,
  calcularPlacar,
  quemGanhou,
  jogadoresPorDupla,
  outraDupla,
  validarDica,
} from "@/lib/gameLogic";
import { useRealtime, useRealtimeSala } from "@/hooks/useRealtime";
import type { Sala, Jogador, Palavra, Evento, Dupla, ModoJogo } from "@/types/game";

// ─── Tipos internos ───────────────────────────────────────────────────────

type FaseJogo =
  | "carregando"
  | "preparando"     // entre palavras — "Próxima palavra..."
  | "ativa"          // palavra em andamento
  | "passou"         // dupla 1 errou → dupla 2 tenta
  | "resultado"      // mostra quem acertou / ninguém acertou
  | "fim";           // partida encerrada

interface EstadoLocal {
  palavras: Palavra[];
  palavraIdx: number;
  vezDupla: Dupla;           // qual dupla iniciou esta palavra
  passouParaAdversario: boolean;
  dicasDadas: string[];
  jaErraram: string[];       // IDs de jogadores que já erraram (1v1)
  dicaBotIdx: number;        // quantas dicas do bot já foram reveladas
  quemAcertou: string | null; // apelido de quem acertou
}

// ─── Página principal ────────────────────────────────────────────────────

export default function JogoPrincipal() {
  const params = useParams();
  const router = useRouter();
  const codigo = (params.codigo as string).toUpperCase();

  const [dadosLocais] = useState(() => carregarDadosLocais());
  const [sala, setSala] = useState<Sala | null>(null);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [fase, setFase] = useState<FaseJogo>("carregando");
  const [estado, setEstado] = useState<EstadoLocal>({
    palavras: [],
    palavraIdx: 0,
    vezDupla: 1,
    passouParaAdversario: false,
    dicasDadas: [],
    jaErraram: [],
    dicaBotIdx: 0,
    quemAcertou: null,
  });
  const [dica, setDica] = useState("");
  const [palpite, setPalpite] = useState("");
  const [erroDica, setErroDica] = useState("");
  const [flashErro, setFlashErro] = useState(false);
  const [flashAcerto, setFlashAcerto] = useState(false);
  const [clueStartedAt, setClueStartedAt] = useState(() => Date.now()); // timestamp de quando a dica atual começou
  const botTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const revelarDicaRef = useRef<(() => void) | null>(null); // para o handlePalpite acionar a próxima dica
  const resultadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jogadorLocalIdRef = useRef("");
  const estadoRef = useRef<EstadoLocal | null>(null); // ref sempre atualizado para evitar stale closures
  const avancarPalavraRef = useRef<((proximaDuplaVez?: Dupla) => Promise<void>) | null>(null);
  const salaRef = useRef<Sala | null>(null);
  // Chaves `palavraIdx:dica` de TODAS as palavras — impede broadcasts duplicados ou stale de word anterior
  const dicasVistaRef = useRef(new Set<string>());

  const jogadorLocalId = dadosLocais?.jogador_id ?? "";
  jogadorLocalIdRef.current = jogadorLocalId;
  estadoRef.current = estado;
  salaRef.current = sala;
  const jogadorLocal = jogadores.find((j) => j.id === jogadorLocalId) ?? null;
  const modo: ModoJogo = (sala?.config?.modo as ModoJogo) ?? "2v2";

  // ─── Carregar dados iniciais ─────────────────────────────────────────

  const carregarJogo = useCallback(async () => {
    const { data: salaData } = await supabase
      .from("salas")
      .select("*")
      .eq("codigo", codigo)
      .single();
    if (!salaData) return;
    setSala(salaData as Sala);

    const jogs = await buscarJogadoresDaSala(salaData.id);
    setJogadores(jogs);

    // Busca evento de início para ter as palavras
    const { data: evIniciar } = await supabase
      .from("eventos")
      .select("*")
      .eq("sala_id", salaData.id)
      .eq("tipo", "iniciar")
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    if (!evIniciar) return;

    const palavrasIds = (evIniciar.payload as { palavras_ids: string[] }).palavras_ids;
    const { data: palavrasData } = await supabase
      .from("palavras")
      .select("*")
      .in("id", palavrasIds);

    if (!palavrasData) return;

    const palavrasOrdenadas = palavrasIds
      .map((id) => palavrasData.find((p) => p.id === id))
      .filter(Boolean) as Palavra[];

    // Busca o estado atual da partida (último evento proxima_palavra ou iniciar)
    const { data: evEstado } = await supabase
      .from("eventos")
      .select("*")
      .eq("sala_id", salaData.id)
      .in("tipo", ["proxima_palavra", "iniciar"])
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    let palavraIdx = 0;
    let vezDupla: Dupla = 1;
    if (evEstado?.tipo === "proxima_palavra") {
      const p = evEstado.payload as { palavra_idx: number; vez_dupla: Dupla };
      palavraIdx = p.palavra_idx;
      vezDupla = p.vez_dupla;
    }

    // Busca as dicas já dadas para a palavra atual (humanas e do bot)
    const { data: evDicas } = await supabase
      .from("eventos")
      .select("*")
      .eq("sala_id", salaData.id)
      .in("tipo", ["dica", "dica_bot"])
      .order("criado_em", { ascending: true });

    // Reconstrói o Set com TODOS os eventos (evita que broadcasts stale de palavras antigas
    // sejam adicionados). Apenas as dicas da palavra atual vão para dicasDadas.
    dicasVistaRef.current.clear();
    const dicasAtuaisSet = new Set<string>();
    const dicasAtuais: string[] = [];
    let dicaBotIdxAtual = 0;
    let ultimaDicaBotTs: number | null = null;
    if (evDicas) {
      for (const ev of evDicas) {
        const p = ev.payload as { palavra_idx: number; dica: string };
        const key = `${p.palavra_idx}:${p.dica}`;
        dicasVistaRef.current.add(key);
        if (p.palavra_idx === palavraIdx && !dicasAtuaisSet.has(p.dica)) {
          dicasAtuaisSet.add(p.dica);
          dicasAtuais.push(p.dica);
        }
        if (ev.tipo === "dica_bot" && p.palavra_idx === palavraIdx) {
          dicaBotIdxAtual++;
          ultimaDicaBotTs = new Date(ev.criado_em).getTime();
        }
      }
    }

    // Timer: usa timestamp da última dica do bot; fallback = início da palavra
    const wordStartTs = evEstado?.criado_em ? new Date(evEstado.criado_em).getTime() : Date.now();
    setClueStartedAt(ultimaDicaBotTs ?? wordStartTs);

    setEstado({
      palavras: palavrasOrdenadas,
      palavraIdx,
      vezDupla,
      passouParaAdversario: false,
      dicasDadas: dicasAtuais,
      jaErraram: [],
      dicaBotIdx: dicaBotIdxAtual,
      quemAcertou: null,
    });

    setFase(salaData.status === "encerrada" ? "fim" : "ativa");
  }, [codigo]);

  useEffect(() => {
    carregarJogo();
  }, [carregarJogo]);

  // ─── Polling fallback: sincroniza estado caso Realtime falhe ─────────
  useEffect(() => {
    if (!sala?.id || fase === "carregando" || fase === "fim") return;

    const syncInterval = setInterval(async () => {
      const { data: salaAtual } = await supabase
        .from("salas")
        .select("palavra_atual_idx, status")
        .eq("id", sala.id)
        .single();

      if (!salaAtual) return;

      if (salaAtual.status === "encerrada") {
        setFase("fim");
        return;
      }

      // Se o índice da palavra no banco divergiu, recarrega tudo (mudança de palavra)
      // "preparando" é permitido para resgatar jogador remoto preso se o broadcast falhar
      if (
        salaAtual.palavra_atual_idx !== null &&
        salaAtual.palavra_atual_idx !== estado.palavraIdx &&
        fase !== "resultado"
      ) {
        carregarJogo();
        return;
      }

      // Dentro da mesma palavra: busca dicas que possam ter sido perdidas pelo Realtime
      const { data: evDicas } = await supabase
        .from("eventos")
        .select("payload")
        .eq("sala_id", sala.id)
        .in("tipo", ["dica", "dica_bot"])
        .order("criado_em", { ascending: true });

      if (evDicas) {
        const novasDicas: string[] = [];
        for (const ev of evDicas) {
          const p = ev.payload as { palavra_idx: number; dica: string };
          const key = `${p.palavra_idx}:${p.dica}`;
          if (!dicasVistaRef.current.has(key)) {
            dicasVistaRef.current.add(key);
            novasDicas.push(p.dica);
          }
        }
        if (novasDicas.length > 0) {
          setEstado((prev) => ({
            ...prev,
            dicasDadas: [...prev.dicasDadas, ...novasDicas],
          }));
        }
      }
    }, 3000);

    return () => clearInterval(syncInterval);
  }, [sala?.id, fase, estado.palavraIdx, carregarJogo]);

  // Helper: publica no DB + envia broadcast imediato para todos
  // (declarado aqui pois bot effect depende dele)
  const publicar = useCallback(
    async (tipo: string, payload: Record<string, unknown>) => {
      if (!sala?.id) return;
      broadcastRef.current?.send({
        type: "broadcast",
        event: "game_event",
        payload: { tipo, payload },
      });
      try { await publicarEvento(sala.id, tipo, payload); } catch (e) { console.error(e); }
    },
    [sala?.id]
  );

  // ─── Bot 1v1: revela dicas automaticamente ───────────────────────────

  useEffect(() => {
    if (modo !== "1v1" || fase !== "ativa") return;
    if (estado.palavras.length === 0) return;

    // Só o jogador da vez publica — usa dupla do jogador local (primitivo, sem dep em `jogadores`)
    if (!jogadorLocal || jogadorLocal.dupla !== estado.vezDupla) return;

    const palavraAtual = estado.palavras[estado.palavraIdx];
    const dicas = palavraAtual?.dicas ?? [];
    // Sem dicas no banco → exibe o que tem mas não quebra
    if (dicas.length === 0) return;

    const tempoDicaMs = (sala?.config?.tempo_dica ?? 60) * 1000;
    let dicaIdx = estado.dicaBotIdx;

    const revelarProximaDica = () => {
      if (dicaIdx >= dicas.length) {
        clearInterval(botTimerRef.current!);
        // Mostra a palavra por 3s antes de avançar (issue 3)
        setFase("resultado");
        publicar("ninguem_acertou", { palavra_idx: estado.palavraIdx });
        setTimeout(() => avancarPalavraRef.current?.(outraDupla(estado.vezDupla)), 3000);
        return;
      }
      const dica = dicas[dicaIdx];
      dicaIdx += 1;

      const key = `${estado.palavraIdx}:${dica}`;
      if (dicasVistaRef.current.has(key)) return;
      dicasVistaRef.current.add(key);
      setEstado((prev) => ({ ...prev, dicasDadas: [...prev.dicasDadas, dica], dicaBotIdx: prev.dicaBotIdx + 1 }));
      setClueStartedAt(Date.now());

      publicar("dica_bot", {
        dica,
        numero: dicaIdx - 1,
        palavra_idx: estado.palavraIdx,
      });
    };

    // Expõe para handlePalpite poder acionar próxima dica quando errar
    revelarDicaRef.current = revelarProximaDica;

    // Primeira dica aparece imediatamente
    if (dicaIdx === 0) revelarProximaDica();

    // Dicas seguintes no intervalo configurado
    botTimerRef.current = setInterval(revelarProximaDica, tempoDicaMs);

    return () => {
      if (botTimerRef.current) clearInterval(botTimerRef.current);
    };
  // jogadorLocal.dupla e estado.vezDupla controlam quem é o ativo — sem `jogadores` array para evitar restart a cada update de pontos
  }, [modo, fase, estado.palavraIdx, estado.palavras.length, estado.vezDupla, jogadorLocal?.dupla, jogadorLocalId, sala?.config?.tempo_dica, sala?.id, publicar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Realtime ────────────────────────────────────────────────────────

  const handleEvento = useCallback((novoEvento: unknown) => {
    const evento = novoEvento as Evento;

    if (evento.tipo === "dica") {
      const p = evento.payload as { dica: string; palavra_idx: number };
      const key = `${p.palavra_idx}:${p.dica}`;
      if (dicasVistaRef.current.has(key)) return;
      dicasVistaRef.current.add(key);
      setEstado((prev) => ({ ...prev, dicasDadas: [...prev.dicasDadas, p.dica] }));
    }

    if (evento.tipo === "dica_bot") {
      const p = evento.payload as { dica: string; palavra_idx: number };
      const key = `${p.palavra_idx}:${p.dica}`;
      if (dicasVistaRef.current.has(key)) return;
      dicasVistaRef.current.add(key);
      setEstado((prev) => ({
        ...prev,
        dicasDadas: [...prev.dicasDadas, p.dica],
        // Incrementa dicaBotIdx só para a palavra atual (controla qual dica o bot revela a seguir)
        dicaBotIdx: p.palavra_idx === prev.palavraIdx ? prev.dicaBotIdx + 1 : prev.dicaBotIdx,
      }));
      // Reseta o timer só para dicas da palavra atual
      if (p.palavra_idx === estadoRef.current?.palavraIdx) {
        setClueStartedAt(Date.now());
      }
    }

    if (evento.tipo === "passou") {
      const p = evento.payload as { palavra_idx: number; vez_dupla_nova?: Dupla };
      setEstado((prev) => {
        if (p.palavra_idx !== prev.palavraIdx) return prev;
        return {
          ...prev,
          passouParaAdversario: true,
          ...(p.vez_dupla_nova ? { vezDupla: p.vez_dupla_nova } : {}),
        };
      });
      // Em 1v1 (vez_dupla_nova presente), mantém "ativa" para o bot do novo jogador funcionar
      setFase(p.vez_dupla_nova ? "ativa" : "passou");
    }

    if (evento.tipo === "acertou") {
      const p = evento.payload as { palavra_idx: number; apelido: string; jogador_id: string };
      // Ignora broadcast próprio — já tratado localmente em handlePalpite
      if (p.jogador_id === jogadorLocalIdRef.current) return;
      setEstado((prev) => ({ ...prev, quemAcertou: p.apelido }));
      setFlashAcerto(true);
      setTimeout(() => setFlashAcerto(false), 1200);
      setFase("resultado");
      if (resultadoTimerRef.current) clearTimeout(resultadoTimerRef.current);
      resultadoTimerRef.current = setTimeout(() => setFase("preparando"), 2500);
    }

    if (evento.tipo === "ninguem_acertou") {
      const p = evento.payload as { palavra_idx: number };
      setEstado((prev) => {
        if (p.palavra_idx !== prev.palavraIdx) return prev;
        return { ...prev, quemAcertou: null };
      });
      setFase("resultado");
      if (resultadoTimerRef.current) clearTimeout(resultadoTimerRef.current);
      resultadoTimerRef.current = setTimeout(() => setFase("preparando"), 3000);
    }

    if (evento.tipo === "proxima_palavra") {
      // Cancela qualquer timer de resultado pendente
      if (resultadoTimerRef.current) {
        clearTimeout(resultadoTimerRef.current);
        resultadoTimerRef.current = null;
      }
      const p = evento.payload as {
        palavra_idx: number;
        vez_dupla: Dupla;
      };
      setEstado((prev) => ({
        ...prev,
        palavraIdx: p.palavra_idx,
        vezDupla: p.vez_dupla,
        passouParaAdversario: false,
        dicasDadas: [],
        jaErraram: [],
        dicaBotIdx: 0,
        quemAcertou: null,
      }));
      setClueStartedAt(Date.now());
      setFase("ativa");
      if (salaRef.current?.id) {
        buscarJogadoresDaSala(salaRef.current.id).then(setJogadores).catch(console.error);
      }
    }

    if (evento.tipo === "fim") {
      setFase("fim");
    }
  }, []);

  // ─── Broadcast: canal WebSocket confiável (fallback do postgres_changes) ─
  useEffect(() => {
    if (!sala?.id) return;
    const channel = supabase.channel(`game:${sala.id}`);
    channel
      .on("broadcast", { event: "game_event" }, ({ payload }) => {
        handleEvento(payload as Evento);
      })
      .subscribe();
    broadcastRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      broadcastRef.current = null;
    };
  }, [sala?.id, handleEvento]);

  useRealtime({
    salaId: sala?.id ?? "",
    tabela: "eventos",
    ativo: !!sala?.id,
    onInsert: handleEvento,
  });

  useRealtime({
    salaId: sala?.id ?? "",
    tabela: "jogadores",
    ativo: !!sala?.id,
    onUpdate: (j) => {
      const jog = j as unknown as Jogador;
      setJogadores((prev) => prev.map((jg) => (jg.id === jog.id ? { ...jg, ...jog } : jg)));
    },
  });

  useRealtimeSala({
    salaId: sala?.id ?? "",
    ativo: !!sala?.id,
    onUpdate: (s) => {
      const sa = s as unknown as Sala;
      setSala((prev) => (prev ? { ...prev, ...sa } : prev));
    },
  });

  // ─── Papel do jogador ─────────────────────────────────────────────────

  const rodadaEstado = estado.palavras.length > 0;

  const papel =
    modo === "2v2" && rodadaEstado
      ? determinarPapel2v2(
          jogadorLocalId,
          estado.vezDupla,
          estado.passouParaAdversario,
          jogadores
        )
      : "espectador";

  // 1v1: é a minha vez?
  const minhaVez1v1 = modo === "1v1" && jogadorLocal?.dupla === estado.vezDupla;
  const jogadorDaVez = jogadores.find((j) => j.dupla === estado.vezDupla && j.ativo) ?? null;

  // ─── Ações ───────────────────────────────────────────────────────────

  async function handleEnviarDica(e: React.FormEvent) {
    e.preventDefault();
    if (!sala) return;
    const { valida, erro } = validarDica(dica);
    if (!valida) { setErroDica(erro ?? ""); return; }
    setErroDica("");

    await publicar("dica", {
      dica: dica.trim().toLowerCase(),
      palavra_idx: estado.palavraIdx,
      jogador_id: jogadorLocalId,
    });
    setDica("");
  }

  async function handlePassar() {
    if (!sala) return;
    await publicar("passou", {
      palavra_idx: estado.palavraIdx,
      dupla: estado.vezDupla,
    });
    // Localmente já atualiza
    setEstado((prev) => ({ ...prev, passouParaAdversario: true }));
    setFase("passou");
  }

  async function handlePalpite(e: React.FormEvent) {
    e.preventDefault();
    if (!sala || !jogadorLocal) return;
    const limpo = palpite.trim().toLowerCase();
    if (!limpo) return;

    const palavraAtual = estado.palavras[estado.palavraIdx];
    if (!palavraAtual) return;

    // Normaliza removendo espaços e hífens para suportar nomes compostos
    const normalizar = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, "");
    const correto = normalizar(limpo) === normalizar(palavraAtual.palavra);

    if (correto) {
      // Adiciona ponto para o jogador (e dupla em 2v2)
      await adicionarPontos(jogadorLocalId, 1);
      if (modo === "2v2") {
        // Ponto para toda a dupla que acertou
        const duplaVencedora = estado.passouParaAdversario
          ? outraDupla(estado.vezDupla)
          : estado.vezDupla;
        const companheiros = jogadores.filter(
          (j) => j.dupla === duplaVencedora && j.ativo && j.id !== jogadorLocalId
        );
        for (const c of companheiros) await adicionarPontos(c.id, 1);
      }

      // Mostra resultado localmente imediatamente (não espera Realtime)
      setEstado((prev) => ({ ...prev, quemAcertou: jogadorLocal.apelido }));
      setFlashAcerto(true);
      setTimeout(() => setFlashAcerto(false), 1200);
      setFase("resultado");
      setPalpite("");

      // Publica para o outro jogador (DB + broadcast)
      publicar("acertou", {
        palavra_idx: estado.palavraIdx,
        jogador_id: jogadorLocalId,
        apelido: jogadorLocal.apelido,
        dupla: jogadorLocal.dupla,
      });

      // Avança após mostrar o resultado
      const proximaDupla = modo === "1v1" ? estado.vezDupla : outraDupla(estado.vezDupla);
      setTimeout(() => {
        setFase("preparando");
        avancarPalavraRef.current?.(proximaDupla);
      }, 2500);
    } else {
      // Errou
      setFlashErro(true);
      setTimeout(() => setFlashErro(false), 600);
      setPalpite("");

      if (modo === "1v1") {
        const palavraAtualVal = estado.palavras[estado.palavraIdx];
        const dicasTotais = palavraAtualVal?.dicas ?? [];
        const novaDupla = outraDupla(estado.vezDupla);

        if (estado.dicaBotIdx < dicasTotais.length) {
          // Revela próxima dica imediatamente e passa para o adversário (1 tentativa por dica)
          if (botTimerRef.current) clearInterval(botTimerRef.current);
          if (revelarDicaRef.current) revelarDicaRef.current();
          await publicar("passou", {
            palavra_idx: estado.palavraIdx,
            dupla: estado.vezDupla,
            vez_dupla_nova: novaDupla,
          });
          setEstado((prev) => ({ ...prev, passouParaAdversario: false, vezDupla: novaDupla }));
          setFase("ativa");
        } else {
          // Sem mais dicas → ninguém acertou, mostra a palavra
          if (botTimerRef.current) clearInterval(botTimerRef.current);
          await publicar("ninguem_acertou", { palavra_idx: estado.palavraIdx });
          setFase("resultado");
          setTimeout(() => avancarPalavraRef.current?.(novaDupla), 3000);
        }
      } else {
        // Em 2v2: se a dupla da vez errou → passa para adversário
        if (!estado.passouParaAdversario) {
          await handlePassar();
        } else {
          // Adversário também errou → avança
          await avancarPalavra();
        }
      }
    }
  }

  async function avancarPalavra(proximaDuplaVez?: Dupla) {
    if (!sala) return;
    // Usa ref para evitar stale closure quando chamado de dentro de setTimeout
    const estadoAtual = estadoRef.current!;
    const proximoIdx = estadoAtual.palavraIdx + 1;

    if (proximoIdx >= estadoAtual.palavras.length) {
      await supabase.from("salas").update({ status: "encerrada" }).eq("id", sala.id);
      await publicar("fim", {});
      setFase("fim");
      return;
    }

    const dupla = proximaDuplaVez ?? outraDupla(estadoAtual.vezDupla);

    setEstado((prev) => ({
      ...prev,
      palavraIdx: proximoIdx,
      vezDupla: dupla,
      passouParaAdversario: false,
      dicasDadas: [],
      jaErraram: [],
      dicaBotIdx: 0,
      quemAcertou: null,
    }));
    setClueStartedAt(Date.now());
    setFase("ativa");

    // Grava o evento PRIMEIRO para que carregarJogo() sempre encontre o estado correto
    try {
      await publicarEvento(sala.id, "proxima_palavra", {
        palavra_idx: proximoIdx,
        vez_dupla: dupla,
      });
    } catch (e) {
      console.error("Erro ao gravar proxima_palavra:", e);
    }

    // Atualiza a sala (polling detecta essa mudança)
    await supabase
      .from("salas")
      .update({ palavra_atual_idx: proximoIdx })
      .eq("id", sala.id);

    // Broadcast imediato para o outro jogador
    broadcastRef.current?.send({
      type: "broadcast",
      event: "game_event",
      payload: { tipo: "proxima_palavra", payload: { palavra_idx: proximoIdx, vez_dupla: dupla } },
    });
  }
  // Sempre aponta para a versão mais recente (evita stale closure em setTimeout)
  avancarPalavraRef.current = avancarPalavra;

  // ─── Helpers de renderização ──────────────────────────────────────────

  const palavraAtual = estado.palavras[estado.palavraIdx] ?? null;

  if (fase === "carregando") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-pixel text-amarelo text-sm animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (fase === "fim") {
    return <TelaFim jogadores={jogadores} modo={modo} codigo={codigo} onReiniciar={() => router.push(`/sala/${codigo}`)} />;
  }

  return (
    <main className={`min-h-screen flex flex-col px-4 py-4 transition-colors duration-300 ${flashAcerto ? "bg-verde/30" : flashErro ? "bg-vermelho/20" : ""}`}>
      <div className="max-w-lg mx-auto w-full space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-corpo text-white/50 text-xs font-bold uppercase">
              Palavra {estado.palavraIdx + 1} / {estado.palavras.length}
            </p>
            <p className="font-corpo font-black text-white text-sm">
              {modo === "1v1"
                ? `Vez de ${jogadorDaVez?.apelido ?? "..."}`
                : `Dupla ${estado.passouParaAdversario ? outraDupla(estado.vezDupla) : estado.vezDupla} tentando`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/jogo/adivinhe-palavras/${codigo}/placar`} target="_blank">
              <Button variante="fantasma" tamanho="sm"><PixelIcon type="chart" size={14} /></Button>
            </Link>
            <button
              onClick={async () => {
                if (!confirm("Sair da sala?")) return;
                if (jogadorLocalId) await sairDaSala(jogadorLocalId).catch(() => {});
                router.push("/lobby");
              }}
              className="px-3 py-2 rounded-xl border-2 border-white/30 bg-white/10 text-white/60 font-corpo font-bold text-xs hover:bg-vermelho/30 hover:border-vermelho hover:text-white transition-all"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Mini placar */}
        <MiniPlacar jogadores={jogadores} modo={modo} />

        {/* Progresso de palavras */}
        <ProgressoPalavras
          total={estado.palavras.length}
          atual={estado.palavraIdx}
        />

        {/* Fase: preparando */}
        {fase === "preparando" && (
          <Card variante="amarelo" padding="md" className="text-center animate-slide-up">
            <p className="font-pixel text-roxo-escuro text-lg">
              Próxima palavra!
            </p>
            <p className="font-corpo text-roxo/70 font-bold text-sm mt-2">
              {modo === "1v1"
                ? `Vez de ${jogadorDaVez?.apelido ?? "..."}`
                : `Dupla ${estado.vezDupla} começa`}
            </p>
          </Card>
        )}

        {/* Fase: ativa ou passou */}
        {(fase === "ativa" || fase === "passou") && palavraAtual && (
          <>
            {/* Tela do dica-dor (2v2) */}
            {modo === "2v2" && papel === "dica-dor" && (
              <TelaDicaDor2v2
                palavra={palavraAtual}
                dicasDadas={estado.dicasDadas}
                dica={dica}
                erroDica={erroDica}
                onChangeDica={(v) => { setDica(v); setErroDica(""); }}
                onEnviarDica={handleEnviarDica}
                onPassar={handlePassar}
                passouParaAdversario={estado.passouParaAdversario}
                tempoDica={sala?.config?.tempo_dica ?? 60}
                startedAt={clueStartedAt}
              />
            )}

            {/* Tela 1v1: vez do jogador */}
            {modo === "1v1" && minhaVez1v1 && (
              <TelaAdivinhador1v1
                dicas={estado.dicasDadas}
                palpite={palpite}
                onChangePalpite={setPalpite}
                onEnviarPalpite={handlePalpite}
                flashErro={flashErro}
                tempoDica={sala?.config?.tempo_dica ?? 60}
                startedAt={clueStartedAt}
                onTimerZerou={() => {/* intervalo controla a revelação */}}
              />
            )}

            {/* Tela 1v1: aguardando a vez */}
            {modo === "1v1" && !minhaVez1v1 && (
              <TelaEsperando1v1
                dicas={estado.dicasDadas}
                apelidoDaVez={jogadorDaVez?.apelido ?? ""}
                tempoDica={sala?.config?.tempo_dica ?? 60}
                startedAt={clueStartedAt}
              />
            )}

            {/* Tela do adivinhador (2v2) */}
            {modo === "2v2" && papel === "adivinhador" && (
              <TelaAdivinhador
                dicas={estado.dicasDadas}
                palpite={palpite}
                onChangePalpite={setPalpite}
                onEnviarPalpite={handlePalpite}
                flashErro={flashErro}
                jaErrei={estado.jaErraram.includes(jogadorLocalId)}
                modo={modo}
              />
            )}

            {/* Adversário esperando (2v2) — quando é a vez do adversário dar dicas */}
            {modo === "2v2" && papel === "adversario" && !estado.passouParaAdversario && (
              <TelaAdversarioEsperando dicas={estado.dicasDadas} />
            )}

            {/* Adversário tentando (2v2) — palavra passou */}
            {modo === "2v2" && papel === "adversario" && estado.passouParaAdversario && (
              <TelaAdivinhador
                dicas={estado.dicasDadas}
                palpite={palpite}
                onChangePalpite={setPalpite}
                onEnviarPalpite={handlePalpite}
                flashErro={flashErro}
                jaErrei={false}
                modo={modo}
                isRuoubo
              />
            )}

            {/* Dica-dor adversário (2v2) quando passa a palavra */}
            {modo === "2v2" && papel === "dica-dor" && estado.passouParaAdversario && (
              <Card variante="roxo" padding="md" className="bg-white/10 border-white/20 text-center">
                <p className="font-pixel text-amarelo text-xs mb-1">PALAVRA PASSOU!</p>
                <p className="font-corpo font-black text-white">
                  Dupla adversária está tentando...
                </p>
              </Card>
            )}
          </>
        )}

        {/* Resultado */}
        {fase === "resultado" && (
          <Card
            variante={estado.quemAcertou ? "amarelo" : "roxo"}
            padding="md"
            className="text-center animate-slide-up"
          >
            {estado.quemAcertou ? (
              <>
                <p className="font-pixel text-roxo-escuro text-xl mb-1">
                  {estado.quemAcertou === jogadorLocal?.apelido ? "[+] VOCE ACERTOU!" : "[+] ACERTOU!"}
                </p>
                <p className="font-corpo font-black text-roxo-escuro text-lg">
                  {estado.quemAcertou === jogadorLocal?.apelido ? "Joga de novo!" : estado.quemAcertou}
                </p>
                <p className="font-corpo text-roxo/70 text-sm font-bold mt-1">
                  era: <span className="text-roxo-escuro">{palavraAtual?.palavra}</span>
                </p>
              </>
            ) : (
              <>
                <p className="font-pixel text-white text-lg mb-1">[X] NINGUEM ACERTOU</p>
                <p className="font-corpo text-white/70 font-bold text-sm">
                  era: <span className="text-white">{palavraAtual?.palavra}</span>
                </p>
              </>
            )}
          </Card>
        )}

        {/* Jogadores */}
        <Card variante="padrao" padding="sm">
          <div className="flex flex-wrap gap-2">
            {jogadores.map((j) => (
              <PlayerChip key={j.id} jogador={j} isLocal={j.id === jogadorLocalId} compact />
            ))}
          </div>
        </Card>

      </div>
    </main>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────

function ProgressoPalavras({ total, atual }: { total: number; atual: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full transition-all duration-300 ${
            i < atual
              ? "bg-verde"
              : i === atual
              ? "bg-amarelo"
              : "bg-white/20"
          }`}
        />
      ))}
    </div>
  );
}

function MiniPlacar({ jogadores, modo }: { jogadores: Jogador[]; modo: ModoJogo }) {
  const { dupla1, dupla2 } = calcularPlacar(jogadores, modo);
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-roxo-claro/50 border border-white/20 rounded-xl px-3 py-2 text-center">
        <p className="font-pixel text-white/60 text-xs">{dupla1.label}</p>
        <p className="font-pixel text-amarelo text-2xl">{dupla1.pontos}</p>
      </div>
      <div className="bg-verde/30 border border-white/20 rounded-xl px-3 py-2 text-center">
        <p className="font-pixel text-white/60 text-xs">{dupla2.label}</p>
        <p className="font-pixel text-verde text-2xl">{dupla2.pontos}</p>
      </div>
    </div>
  );
}

function TelaDicaDor2v2({
  palavra,
  dicasDadas,
  dica,
  erroDica,
  onChangeDica,
  onEnviarDica,
  onPassar,
  passouParaAdversario,
  tempoDica,
  startedAt,
}: {
  palavra: Palavra;
  dicasDadas: string[];
  dica: string;
  erroDica: string;
  onChangeDica: (v: string) => void;
  onEnviarDica: (e: React.FormEvent) => void;
  onPassar: () => void;
  passouParaAdversario: boolean;
  tempoDica: number;
  startedAt: number;
}) {
  if (passouParaAdversario) {
    return (
      <Card variante="roxo" padding="md" className="bg-white/10 border-white/20 text-center">
        <p className="font-corpo text-white font-black">Adversário está tentando…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Timer */}
      <TimerInline
        startedAt={startedAt}
        duracaoSegundos={tempoDica}
        onZerou={onPassar}
      />

      {/* Palavra a ser descrita */}
      <Card variante="amarelo" padding="md" className="text-center">
        <p className="font-corpo text-roxo/50 text-xs font-bold uppercase mb-1">
          Descreva com 1 palavra por vez
        </p>
        <p className="font-pixel text-roxo-escuro text-3xl leading-tight break-all">
          {palavra.palavra}
        </p>
        <p className="font-corpo text-roxo/50 text-xs mt-1">{palavra.categoria}</p>
      </Card>

      {/* Dicas enviadas */}
      {dicasDadas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dicasDadas.map((d, i) => (
            <span key={i} className="bg-white text-roxo-escuro border-2 border-roxo px-3 py-1 rounded-full font-corpo font-black text-sm shadow-brutal-sm">
              {d}
            </span>
          ))}
        </div>
      )}

      {/* Input de dica */}
      <form onSubmit={onEnviarDica} className="flex gap-2">
        <input
          type="text"
          value={dica}
          onChange={(e) => onChangeDica(e.target.value.replace(/\s/g, ""))}
          placeholder="1 palavra como dica..."
          maxLength={30}
          autoComplete="off"
          className="flex-1 px-4 py-3 rounded-xl border-2 border-roxo bg-white font-corpo font-bold text-roxo-escuro placeholder-gray-400 focus:outline-none focus:border-amarelo text-lg"
        />
        <Button type="submit" variante="primario" disabled={!dica.trim()}>↵</Button>
      </form>
      {erroDica && (
        <p className="text-amarelo font-corpo font-bold text-sm">{erroDica}</p>
      )}

      <Button variante="perigo" tamanho="md" larguraTotal onClick={onPassar} icone={<span>⏭️</span>}>
        Passar para adversário
      </Button>
    </div>
  );
}

/** Timer compacto inline — sincronizado por startedAt (timestamp absoluto) */
function TimerInline({
  duracaoSegundos,
  startedAt,
  onZerou,
  label = "Tempo para dar dicas",
}: {
  duracaoSegundos: number;
  startedAt: number;
  onZerou: () => void;
  label?: string;
}) {
  const calcRestante = () =>
    Math.max(0, duracaoSegundos - Math.floor((Date.now() - startedAt) / 1000));

  const [restante, setRestante] = useState(calcRestante);
  const onZerouRef = useRef(onZerou);
  onZerouRef.current = onZerou;

  // Re-sincroniza quando startedAt ou duração mudam (reload, nova dica)
  useEffect(() => {
    setRestante(calcRestante());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, duracaoSegundos]);

  useEffect(() => {
    if (restante <= 0) {
      onZerouRef.current();
      return;
    }
    const id = setTimeout(() => setRestante(calcRestante()), 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante, startedAt]);

  const pct = (restante / duracaoSegundos) * 100;
  const critico = restante <= 10;
  const urgente = restante <= 20;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-corpo text-white/60 text-xs font-bold uppercase">
          {label}
        </span>
        <span
          className={`font-pixel text-2xl font-bold ${
            critico ? "text-vermelho animate-pulse" : urgente ? "text-amarelo" : "text-verde"
          }`}
        >
          {restante}s
        </span>
      </div>
      <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden border border-white/20">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            critico ? "bg-vermelho" : urgente ? "bg-amarelo" : "bg-verde"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {critico && (
        <p className="text-vermelho font-corpo font-black text-xs text-center mt-1 animate-pulse">
          [!] Vai passar para o adversario!
        </p>
      )}
    </div>
  );
}

function TelaAdivinhador1v1({
  dicas,
  palpite,
  onChangePalpite,
  onEnviarPalpite,
  flashErro,
  tempoDica,
  startedAt,
  onTimerZerou,
}: {
  dicas: string[];
  palpite: string;
  onChangePalpite: (v: string) => void;
  onEnviarPalpite: (e: React.FormEvent) => void;
  flashErro: boolean;
  tempoDica: number;
  startedAt: number;
  onTimerZerou: () => void;
}) {
  return (
    <div className="space-y-3">
      <TimerInline
        startedAt={startedAt}
        duracaoSegundos={tempoDica}
        onZerou={onTimerZerou}
        label="Tempo para adivinhar"
      />

      <Card variante="padrao" padding="md">
        <p className="font-corpo font-black text-gray-500 text-xs uppercase mb-3">
          Dicas do bot ({dicas.length})
        </p>
        {dicas.length === 0 ? (
          <div className="text-center py-4">
            <div className="flex justify-center gap-1 mb-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 bg-roxo/30 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <p className="font-corpo text-gray-400 text-sm">Primeira dica chegando...</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dicas.map((d, i) => (
              <span key={i} className="bg-roxo text-white px-3 py-1.5 rounded-full font-corpo font-black text-base shadow-brutal-sm animate-slide-up">
                {d}
              </span>
            ))}
          </div>
        )}
      </Card>

      <form onSubmit={onEnviarPalpite} className="flex gap-2">
        <input
          type="text"
          value={palpite}
          onChange={(e) => onChangePalpite(e.target.value)}
          placeholder="Qual a palavra?"
          maxLength={40}
          autoComplete="off"
          autoFocus
          className={`flex-1 px-4 py-3 rounded-xl border-2 font-corpo font-black text-roxo-escuro placeholder-gray-400 focus:outline-none text-xl transition-colors ${
            flashErro
              ? "border-vermelho bg-vermelho/10 focus:border-vermelho animate-wiggle"
              : "border-roxo bg-white focus:border-amarelo"
          }`}
        />
        <Button type="submit" variante="amarelo" tamanho="lg" disabled={!palpite.trim()}>
          ✓
        </Button>
      </form>
    </div>
  );
}

function TelaEsperando1v1({
  dicas,
  apelidoDaVez,
  tempoDica,
  startedAt,
}: {
  dicas: string[];
  apelidoDaVez: string;
  tempoDica: number;
  startedAt: number;
}) {
  const calcRestante = () =>
    Math.max(0, tempoDica - Math.floor((Date.now() - startedAt) / 1000));

  const [restante, setRestante] = useState(calcRestante);

  useEffect(() => {
    setRestante(calcRestante());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, tempoDica]);

  useEffect(() => {
    if (restante <= 0) return;
    const id = setTimeout(() => setRestante(calcRestante()), 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante, startedAt]);

  const pct = (restante / tempoDica) * 100;
  const critico = restante <= 10;
  const urgente = restante <= 20;

  return (
    <div className="space-y-3">
      {/* Timer sincronizado pelo startedAt absoluto */}
      <div className="w-full opacity-60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-corpo text-white/60 text-xs font-bold uppercase">
            Tempo de {apelidoDaVez}
          </span>
          <span className={`font-pixel text-2xl font-bold ${critico ? "text-vermelho" : urgente ? "text-amarelo" : "text-verde"}`}>
            {restante}s
          </span>
        </div>
        <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden border border-white/20">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${critico ? "bg-vermelho" : urgente ? "bg-amarelo" : "bg-verde"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <Card variante="padrao" padding="md">
        <p className="font-corpo font-black text-gray-500 text-xs uppercase mb-2">
          Dicas do bot ({dicas.length})
        </p>
        {dicas.length === 0 ? (
          <p className="font-corpo text-gray-400 text-sm text-center py-2">Aguardando dicas...</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dicas.map((d, i) => (
              <span key={i} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-corpo font-bold text-sm">
                {d}
              </span>
            ))}
          </div>
        )}
        <p className="font-corpo text-gray-400 text-xs text-center mt-3">
          Aguarde — é a vez de <span className="font-black">{apelidoDaVez}</span>
        </p>
      </Card>
    </div>
  );
}

function TelaAdivinhador({
  dicas,
  palpite,
  onChangePalpite,
  onEnviarPalpite,
  flashErro,
  jaErrei,
  modo,
  isRuoubo = false,
}: {
  dicas: string[];
  palpite: string;
  onChangePalpite: (v: string) => void;
  onEnviarPalpite: (e: React.FormEvent) => void;
  flashErro: boolean;
  jaErrei: boolean;
  modo: ModoJogo;
  isRuoubo?: boolean;
}) {
  return (
    <div className="space-y-3">
      {isRuoubo && (
        <Card variante="amarelo" padding="sm" className="text-center">
          <p className="font-pixel text-roxo-escuro text-xs">ROUBO! Palavra passou pra vocês 💥</p>
        </Card>
      )}

      {/* Dicas */}
      <Card variante="padrao" padding="md">
        <p className="font-corpo font-black text-gray-500 text-xs uppercase mb-3">
          {modo === "1v1" ? "Dicas do bot" : "Dicas da dupla"} ({dicas.length})
        </p>
        {dicas.length === 0 ? (
          <div className="text-center py-4">
            <div className="flex justify-center gap-1 mb-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 bg-roxo/30 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <p className="font-corpo text-gray-400 text-sm">Aguardando dicas...</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dicas.map((d, i) => (
              <span key={i} className="bg-roxo text-white px-3 py-1.5 rounded-full font-corpo font-black text-base shadow-brutal-sm animate-slide-up">
                {d}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Input de palpite */}
      {!jaErrei ? (
        <form onSubmit={onEnviarPalpite} className="flex gap-2">
          <input
            type="text"
            value={palpite}
            onChange={(e) => onChangePalpite(e.target.value)}
            placeholder="Qual a palavra?"
            maxLength={40}
            autoComplete="off"
            autoFocus
            className={`flex-1 px-4 py-3 rounded-xl border-2 font-corpo font-black text-roxo-escuro placeholder-gray-400 focus:outline-none text-xl transition-colors ${
              flashErro
                ? "border-vermelho bg-vermelho/10 focus:border-vermelho animate-wiggle"
                : "border-roxo bg-white focus:border-amarelo"
            }`}
          />
          <Button type="submit" variante="amarelo" tamanho="lg" disabled={!palpite.trim()}>
            ✓
          </Button>
        </form>
      ) : (
        <Card variante="roxo" padding="md" className="bg-vermelho/20 border-vermelho text-center">
          <p className="font-corpo font-black text-white">❌ Você errou — aguarde o outro jogador</p>
        </Card>
      )}
    </div>
  );
}

function TelaAdversarioEsperando({ dicas }: { dicas: string[] }) {
  return (
    <Card variante="padrao" padding="md">
      <p className="font-corpo font-black text-gray-500 text-xs uppercase mb-3">
        Dicas em tempo real
      </p>
      {dicas.length === 0 ? (
        <p className="font-corpo text-gray-400 text-sm text-center py-2">Aguardando dicas…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {dicas.map((d, i) => (
            <span key={i} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-corpo font-bold text-sm">
              {d}
            </span>
          ))}
        </div>
      )}
      <p className="text-center font-corpo text-gray-400 text-xs mt-3">
        Se a dupla adversária errar, a palavra passa pra vocês!
      </p>
    </Card>
  );
}

function TelaFim({
  jogadores,
  modo,
  codigo,
  onReiniciar,
}: {
  jogadores: Jogador[];
  modo: ModoJogo;
  codigo: string;
  onReiniciar: () => void;
}) {
  const { dupla1, dupla2 } = calcularPlacar(jogadores, modo);
  const vencedor = quemGanhou(dupla1, dupla2);
  const d1 = jogadoresPorDupla(jogadores, 1);
  const d2 = jogadoresPorDupla(jogadores, 2);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full space-y-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            <PixelIcon type="trophy" size={28} color="#F5C400" />
            <p className="font-pixel text-white text-2xl animate-pulse-scale">FIM!</p>
            <PixelIcon type="trophy" size={28} color="#F5C400" />
          </div>
          <p className="font-corpo text-white/60 font-bold mt-1">
            {vencedor === "empate"
              ? "Empate!"
              : modo === "1v1"
              ? `${vencedor === 1 ? d1[0]?.apelido : d2[0]?.apelido} venceu!`
              : `Dupla ${vencedor} venceu!`}
          </p>
        </div>

        {/* Placar */}
        <div className="grid grid-cols-2 gap-3">
          {[{ pd: dupla1, jogs: d1 }, { pd: dupla2, jogs: d2 }].map(({ pd, jogs }) => (
            <div
              key={pd.dupla}
              className={`rounded-xl border-4 p-5 text-center ${
                vencedor === pd.dupla
                  ? "border-amarelo bg-amarelo/20"
                  : "border-white/20 bg-white/5"
              }`}
            >
              <p className="font-pixel text-white/60 text-xs mb-2">{pd.label}</p>
              <p className={`font-pixel text-6xl mb-3 ${vencedor === pd.dupla ? "text-amarelo" : "text-white/70"}`}>
                {pd.pontos}
              </p>
              {jogs.map((j) => (
                <p key={j.id} className="font-corpo font-black text-white text-sm">{j.apelido}</p>
              ))}
              {vencedor === pd.dupla && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <PixelIcon type="star" size={12} color="#F5C400" />
                  <p className="font-pixel text-amarelo text-xs">VENCEDOR</p>
                  <PixelIcon type="star" size={12} color="#F5C400" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variante="amarelo" tamanho="lg" larguraTotal onClick={onReiniciar} icone={<PixelIcon type="reload" size={16} color="currentColor" />}>
            Jogar de novo
          </Button>
          <Link href="/" className="block">
            <Button variante="fantasma" tamanho="lg" larguraTotal icone={<PixelIcon type="home" size={16} color="currentColor" />}>
              Inicio
            </Button>
          </Link>
        </div>

        <Link href={`/jogo/adivinhe-palavras/${codigo}/placar`} target="_blank" className="block">
          <Button variante="secundario" tamanho="md" larguraTotal icone={<PixelIcon type="chart" size={14} color="currentColor" />}>
            Ver Placar na TV
          </Button>
        </Link>
      </div>
    </main>
  );
}
