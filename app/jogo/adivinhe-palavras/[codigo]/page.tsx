"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PlayerChip from "@/components/ui/PlayerChip";
import TimerRodada from "@/components/jogo/TimerRodada";
import TabelaPalavras from "@/components/jogo/TabelaPalavras";
import Placar from "@/components/jogo/Placar";
import {
  supabase,
  carregarDadosLocais,
  buscarJogadoresDaSala,
  publicarEvento,
  adicionarPontos,
} from "@/lib/supabase";
import {
  determinarPapel,
  calcularTotalRodadas,
  proximaDupla,
} from "@/lib/gameLogic";
import { useRealtime, useRealtimeSala } from "@/hooks/useRealtime";
import type { Sala, Jogador, Palavra, Evento } from "@/types/game";

type FaseJogo =
  | "carregando"
  | "preparando"
  | "rodada-ativa"
  | "entre-rodadas"
  | "fim";

interface EstadoRodada {
  id: string;
  numero: number;
  duplaVez: 1 | 2;
  palavraAtual: Palavra | null;
  todasPalavras: Palavra[];
  palavraIdx: number;
  acertos: boolean[];
  dicas: string[];
  status: string;
}

export default function JogoPrincipal() {
  const params = useParams();
  const router = useRouter();
  const codigo = (params.codigo as string).toUpperCase();

  const [dadosLocais] = useState(() => carregarDadosLocais());
  const [sala, setSala] = useState<Sala | null>(null);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [fase, setFase] = useState<FaseJogo>("carregando");
  const [rodada, setRodada] = useState<EstadoRodada | null>(null);
  const [dica, setDica] = useState("");
  const [timerAtivo, setTimerAtivo] = useState(false);
  const [dicasDador, setDicasDador] = useState<string[]>([]);
  const [placarFinal, setPlacarFinal] = useState(false);

  // Para sincronizar palavras entre jogadores
  const palavrasGlobaisRef = useRef<Palavra[]>([]);

  const jogadorLocalId = dadosLocais?.jogador_id ?? "";
  const jogadorLocal = jogadores.find((j) => j.id === jogadorLocalId) ?? null;

  // ─── Carregar dados iniciais ───────────────────────────────────────────

  useEffect(() => {
    if (!codigo) return;
    carregarJogo();
  }, [codigo]);

  async function carregarJogo() {
    try {
      const { data: salaData } = await supabase
        .from("salas")
        .select("*")
        .eq("codigo", codigo)
        .single();

      if (!salaData) return;
      setSala(salaData as Sala);

      const jogadoresData = await buscarJogadoresDaSala(salaData.id);
      setJogadores(jogadoresData);

      // Busca evento de início para ter as palavras
      const { data: eventoIniciar } = await supabase
        .from("eventos")
        .select("*")
        .eq("sala_id", salaData.id)
        .eq("tipo", "iniciar")
        .order("criado_em", { ascending: false })
        .limit(1)
        .single();

      if (eventoIniciar) {
        const palavrasIds = (eventoIniciar.payload as { palavras_ids: string[] }).palavras_ids;
        const { data: palavrasData } = await supabase
          .from("palavras")
          .select("*")
          .in("id", palavrasIds);

        if (palavrasData) {
          // Ordena conforme IDs originais
          const palavrasOrdenadas = palavrasIds
            .map((id) => palavrasData.find((p) => p.id === id))
            .filter(Boolean) as Palavra[];
          palavrasGlobaisRef.current = palavrasOrdenadas;
        }
      }

      // Busca rodada ativa
      const { data: rodadaData } = await supabase
        .from("rodadas")
        .select("*, palavras(*)")
        .eq("sala_id", salaData.id)
        .eq("status", "ativa")
        .order("numero", { ascending: false })
        .limit(1)
        .single();

      if (rodadaData) {
        const totalRodadas = calcularTotalRodadas(salaData.config.rodadas);
        const palavrasPorRodada = 5;
        const offset = (rodadaData.numero - 1) * palavrasPorRodada;
        const palavrasDaRodada = palavrasGlobaisRef.current.slice(
          offset,
          offset + palavrasPorRodada
        );

        setRodada({
          id: rodadaData.id,
          numero: rodadaData.numero,
          duplaVez: rodadaData.dupla_vez as 1 | 2,
          palavraAtual: palavrasDaRodada[0] ?? null,
          todasPalavras: palavrasDaRodada,
          palavraIdx: 0,
          acertos: [],
          dicas: [],
          status: "ativa",
        });

        if (salaData.rodada_atual === totalRodadas && rodadaData.status !== "ativa") {
          setFase("fim");
        } else {
          setFase("preparando");
        }
      } else {
        setFase("fim");
      }
    } catch (err) {
      console.error("Erro ao carregar jogo:", err);
    }
  }

  // ─── Realtime: eventos do jogo ─────────────────────────────────────────

  const handleNovoEvento = useCallback(
    (novoEvento: Record<string, unknown>) => {
      const evento = novoEvento as Evento;

      if (evento.tipo === "dica") {
        const payload = evento.payload as { dica: string; numero: number };
        setDicasDador((prev) => {
          if (prev.includes(payload.dica)) return prev;
          return [...prev, payload.dica];
        });
      }

      if (evento.tipo === "acertou") {
        const payload = evento.payload as { palavra_idx: number; dupla: number };
        setRodada((prev) => {
          if (!prev) return prev;
          const novosAcertos = [...prev.acertos];
          novosAcertos[payload.palavra_idx] = true;

          const proximoIdx = payload.palavra_idx + 1;
          const proximaPalavra = prev.todasPalavras[proximoIdx] ?? null;

          return {
            ...prev,
            acertos: novosAcertos,
            palavraIdx: proximoIdx,
            palavraAtual: proximaPalavra,
          };
        });
        setDicasDador([]);
      }

      if (evento.tipo === "proximo") {
        const payload = evento.payload as {
          proxima_dupla: 1 | 2;
          rodada_numero: number;
          palavras_offset: number;
        };

        const palavrasDaRodada = palavrasGlobaisRef.current.slice(
          payload.palavras_offset,
          payload.palavras_offset + 5
        );

        setRodada({
          id: "",
          numero: payload.rodada_numero,
          duplaVez: payload.proxima_dupla,
          palavraAtual: palavrasDaRodada[0] ?? null,
          todasPalavras: palavrasDaRodada,
          palavraIdx: 0,
          acertos: [],
          dicas: [],
          status: "ativa",
        });
        setDicasDador([]);
        setTimerAtivo(false);
        setFase("preparando");
      }

      if (evento.tipo === "fim") {
        setFase("fim");
        setPlacarFinal(true);
      }
    },
    []
  );

  useRealtime({
    salaId: sala?.id ?? "",
    tabela: "eventos",
    ativo: !!sala?.id,
    onInsert: handleNovoEvento,
  });

  useRealtime({
    salaId: sala?.id ?? "",
    tabela: "jogadores",
    ativo: !!sala?.id,
    onUpdate: (j) => {
      setJogadores((prev) =>
        prev.map((jg) => (jg.id === (j as Jogador).id ? { ...jg, ...(j as Jogador) } : jg))
      );
    },
  });

  useRealtimeSala({
    salaId: sala?.id ?? "",
    ativo: !!sala?.id,
    onUpdate: (s) => setSala((prev) => (prev ? { ...prev, ...(s as Sala) } : prev)),
  });

  // ─── Papel do jogador ──────────────────────────────────────────────────

  const papel =
    rodada && jogadorLocal
      ? determinarPapel(
          jogadorLocalId,
          rodada.duplaVez,
          jogadores
        )
      : "espectador";

  // ─── Ações do jogo ─────────────────────────────────────────────────────

  function handleIniciarRodada() {
    setTimerAtivo(true);
    setFase("rodada-ativa");
  }

  async function handleEnviarDica(e: React.FormEvent) {
    e.preventDefault();
    if (!dica.trim() || !sala || !rodada) return;

    const dicaTexto = dica.trim();
    setDica("");

    await publicarEvento(sala.id, "dica", {
      dica: dicaTexto,
      numero: dicasDador.length + 1,
      jogador_id: jogadorLocalId,
      apelido: jogadorLocal?.apelido ?? "",
    });
  }

  async function handleAcertou() {
    if (!sala || !rodada || !jogadorLocal) return;

    // Adiciona ponto para os jogadores da dupla da vez
    const jogadoresDaDupla = jogadores.filter(
      (j) => j.dupla === rodada.duplaVez && j.ativo
    );
    for (const j of jogadoresDaDupla) {
      await adicionarPontos(j.id, 1);
    }

    await publicarEvento(sala.id, "acertou", {
      palavra_idx: rodada.palavraIdx,
      dupla: rodada.duplaVez,
      palavra: rodada.palavraAtual?.palavra ?? "",
    });

    // Verifica se acabaram as palavras
    if (rodada.palavraIdx >= rodada.todasPalavras.length - 1) {
      await handleFimRodada("acertou");
    }
  }

  async function handleFimRodada(motivo: "tempo" | "acertou" | "passou") {
    if (!sala || !rodada) return;
    setTimerAtivo(false);

    // Atualiza status da rodada no banco
    await supabase
      .from("rodadas")
      .update({ status: motivo === "acertou" ? "acertou" : "tempo", encerrou_em: new Date().toISOString() })
      .eq("sala_id", sala.id)
      .eq("numero", rodada.numero);

    const totalRodadas = calcularTotalRodadas(sala.config.rodadas);

    if (rodada.numero >= totalRodadas) {
      // Fim de jogo
      await supabase
        .from("salas")
        .update({ status: "encerrada" })
        .eq("id", sala.id);

      await publicarEvento(sala.id, "fim", {});
      setFase("fim");
    } else {
      // Próxima rodada
      const proximaRodadaNum = rodada.numero + 1;
      const proximaDuplaVez = proximaDupla(rodada.duplaVez);
      const offset = (proximaRodadaNum - 1) * 5;

      const proximaPalavra = palavrasGlobaisRef.current[offset];
      if (proximaPalavra) {
        await supabase.from("rodadas").insert({
          sala_id: sala.id,
          numero: proximaRodadaNum,
          palavra_id: proximaPalavra.id,
          dupla_vez: proximaDuplaVez,
          status: "ativa",
          iniciou_em: new Date().toISOString(),
        });

        await supabase
          .from("salas")
          .update({ rodada_atual: proximaRodadaNum })
          .eq("id", sala.id);
      }

      await publicarEvento(sala.id, "proximo", {
        proxima_dupla: proximaDuplaVez,
        rodada_numero: proximaRodadaNum,
        palavras_offset: offset,
      });

      setFase("entre-rodadas");
    }
  }

  // ─── Renders por fase ──────────────────────────────────────────────────

  if (fase === "carregando") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="font-pixel text-amarelo text-sm animate-pulse mb-2">
            Carregando jogo...
          </div>
        </div>
      </div>
    );
  }

  if (fase === "fim") {
    return (
      <TelaFimDeJogo
        jogadores={jogadores}
        sala={sala}
        codigo={codigo}
        onJogarNovamente={() => router.push(`/sala/${codigo}`)}
      />
    );
  }

  if (fase === "entre-rodadas") {
    return (
      <TelaEntreRodadas
        rodadaNumero={rodada?.numero ?? 1}
        proximaDuplaVez={rodada ? proximaDupla(rodada.duplaVez) : 1}
        jogadores={jogadores}
        onContinuar={handleIniciarRodada}
        isHost={papel === "dica-dor" || papel === "adivinhador"}
        sala={sala}
      />
    );
  }

  return (
    <main className="min-h-screen flex flex-col px-4 py-4">
      <div className="max-w-lg mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-corpo text-white/60 text-xs font-bold">
              RODADA {rodada?.numero ?? 1} •{" "}
              {sala ? calcularTotalRodadas(sala.config.rodadas) : "?"} TOTAL
            </p>
            <p className="font-corpo font-black text-white text-sm">
              Dupla {rodada?.duplaVez ?? 1} jogando
            </p>
          </div>
          <Link href={`/jogo/adivinhe-palavras/${codigo}/placar`} target="_blank">
            <Button variante="fantasma" tamanho="sm">
              📊 Placar
            </Button>
          </Link>
        </div>

        {/* Placar resumido */}
        <Placar
          jogadores={jogadores}
          rodadaAtual={rodada?.numero}
          totalRodadas={sala ? calcularTotalRodadas(sala.config.rodadas) : undefined}
        />

        {/* Timer (apenas durante rodada ativa) */}
        {fase === "rodada-ativa" && sala && (
          <Card variante="roxo" padding="md" className="bg-white/10 border-white/20">
            <TimerRodada
              duracaoSegundos={sala.config.tempo_por_rodada}
              ativo={timerAtivo}
              onTempoEsgotado={() => handleFimRodada("tempo")}
            />
          </Card>
        )}

        {/* Tela de preparação */}
        {fase === "preparando" && rodada && (
          <TelaPreparo
            duplaVez={rodada.duplaVez}
            papel={papel}
            onIniciar={handleIniciarRodada}
            jogadores={jogadores}
          />
        )}

        {/* Tela do dica-dor */}
        {fase === "rodada-ativa" && papel === "dica-dor" && rodada && (
          <TelaDicaDor
            rodada={rodada}
            dica={dica}
            onChangeDica={setDica}
            onEnviarDica={handleEnviarDica}
            onAcertou={handleAcertou}
            onPassar={() => handleFimRodada("passou")}
            dicasEnviadas={dicasDador}
          />
        )}

        {/* Tela do adivinhador */}
        {fase === "rodada-ativa" && papel === "adivinhador" && rodada && (
          <TelaAdivinhador
            rodada={rodada}
            dicas={dicasDador}
            onAcertou={handleAcertou}
          />
        )}

        {/* Tela do adversário / espectador */}
        {fase === "rodada-ativa" &&
          (papel === "adversario" || papel === "espectador") &&
          rodada && (
            <TelaEspectador
              rodada={rodada}
              dicas={dicasDador}
              papel={papel}
              onRoubar={papel === "adversario" ? handleAcertou : undefined}
            />
          )}

        {/* Jogadores online */}
        <Card variante="padrao" padding="sm">
          <p className="font-corpo font-black text-gray-500 text-xs uppercase tracking-wide mb-2">
            Jogadores
          </p>
          <div className="flex flex-wrap gap-2">
            {jogadores.map((j) => (
              <PlayerChip
                key={j.id}
                jogador={j}
                isLocal={j.id === jogadorLocalId}
                compact
              />
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────

function TelaPreparo({
  duplaVez,
  papel,
  onIniciar,
  jogadores,
}: {
  duplaVez: 1 | 2;
  papel: string;
  onIniciar: () => void;
  jogadores: Jogador[];
}) {
  const jaDupla = jogadores.filter((j) => j.dupla === duplaVez && j.ativo);

  return (
    <Card variante="amarelo" padding="md" className="text-center">
      <p className="font-pixel text-roxo-escuro text-xs mb-2">PRÓXIMA RODADA</p>
      <p className="font-corpo font-black text-roxo-escuro text-2xl mb-1">
        Dupla {duplaVez} joga!
      </p>
      <div className="flex justify-center gap-2 flex-wrap mb-4">
        {jaDupla.map((j) => (
          <span key={j.id} className="bg-roxo text-white px-3 py-1 rounded-full font-corpo font-bold text-sm">
            {j.apelido}
          </span>
        ))}
      </div>
      {(papel === "dica-dor" || papel === "adivinhador") ? (
        <Button variante="primario" tamanho="lg" larguraTotal onClick={onIniciar} icone={<span>▶️</span>}>
          Começar Rodada!
        </Button>
      ) : (
        <p className="font-corpo font-bold text-roxo/70 text-sm">
          Aguardando a dupla iniciar...
        </p>
      )}
    </Card>
  );
}

function TelaDicaDor({
  rodada,
  dica,
  onChangeDica,
  onEnviarDica,
  onAcertou,
  onPassar,
  dicasEnviadas,
}: {
  rodada: EstadoRodada;
  dica: string;
  onChangeDica: (v: string) => void;
  onEnviarDica: (e: React.FormEvent) => void;
  onAcertou: () => void;
  onPassar: () => void;
  dicasEnviadas: string[];
}) {
  return (
    <div className="space-y-3">
      {/* Palavra secreta */}
      <Card variante="amarelo" padding="md" className="text-center">
        <p className="font-pixel text-roxo/60 text-xs mb-1">PALAVRA SECRETA</p>
        <p className="font-pixel text-roxo-escuro text-3xl leading-tight">
          {rodada.palavraAtual?.palavra ?? "—"}
        </p>
        <p className="font-corpo text-roxo/60 text-xs mt-1">
          {rodada.palavraAtual?.categoria}
        </p>
        <p className="font-corpo text-roxo/40 text-xs mt-1">
          Dê dicas sem falar a palavra!
        </p>
      </Card>

      {/* Input de dica */}
      <form onSubmit={onEnviarDica} className="flex gap-2">
        <input
          type="text"
          value={dica}
          onChange={(e) => onChangeDica(e.target.value)}
          placeholder="Digite uma dica..."
          maxLength={40}
          autoComplete="off"
          className="flex-1 px-4 py-3 rounded-xl border-2 border-roxo bg-white font-corpo font-bold text-roxo-escuro placeholder-gray-400 focus:outline-none focus:border-amarelo text-lg"
        />
        <Button type="submit" variante="primario" tamanho="md" disabled={!dica.trim()}>
          ↵
        </Button>
      </form>

      {/* Dicas enviadas */}
      {dicasEnviadas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dicasEnviadas.map((d, i) => (
            <span key={i} className="bg-white/20 text-white px-3 py-1 rounded-full font-corpo font-bold text-sm">
              {d}
            </span>
          ))}
        </div>
      )}

      {/* Botões de ação */}
      <div className="grid grid-cols-2 gap-2">
        <Button variante="secundario" tamanho="lg" onClick={onAcertou} icone={<span>✅</span>}>
          Acertou!
        </Button>
        <Button variante="perigo" tamanho="lg" onClick={onPassar} icone={<span>⏭️</span>}>
          Passar
        </Button>
      </div>

      {/* Tabela de palavras */}
      <TabelaPalavras
        palavras={rodada.todasPalavras}
        palavraAtualIdx={rodada.palavraIdx}
        acertos={rodada.acertos}
        mostrarPalavras={true}
      />
    </div>
  );
}

function TelaAdivinhador({
  rodada,
  dicas,
  onAcertou,
}: {
  rodada: EstadoRodada;
  dicas: string[];
  onAcertou: () => void;
}) {
  return (
    <div className="space-y-3">
      <Card variante="roxo" padding="md" className="bg-roxo-claro text-center">
        <p className="font-pixel text-white/60 text-xs mb-1">VOCÊ É O ADIVINHADOR</p>
        <p className="font-corpo font-black text-white text-lg">
          Escute as dicas e responda!
        </p>
      </Card>

      {/* Dicas chegando */}
      <Card variante="padrao" padding="md">
        <p className="font-corpo font-black text-gray-500 text-xs uppercase mb-3">
          Dicas ({dicas.length})
        </p>
        {dicas.length === 0 ? (
          <div className="text-center py-4">
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-roxo/30 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
            <p className="font-corpo text-gray-400 text-sm mt-2">Aguardando dicas...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dicas.map((d, i) => (
              <div key={i} className="flex items-center gap-2 animate-slide-up">
                <span className="font-pixel text-roxo text-xs">{i + 1}.</span>
                <span className="font-corpo font-bold text-roxo-escuro text-lg">{d}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button
        variante="amarelo"
        tamanho="xl"
        larguraTotal
        onClick={onAcertou}
        icone={<span>✅</span>}
      >
        Acertei!
      </Button>

      <TabelaPalavras
        palavras={rodada.todasPalavras}
        palavraAtualIdx={rodada.palavraIdx}
        acertos={rodada.acertos}
        mostrarPalavras={false}
      />
    </div>
  );
}

function TelaEspectador({
  rodada,
  dicas,
  papel,
  onRoubar,
}: {
  rodada: EstadoRodada;
  dicas: string[];
  papel: string;
  onRoubar?: () => void;
}) {
  return (
    <div className="space-y-3">
      <Card variante="roxo" padding="md" className="bg-white/10 border-white/20 text-center">
        <p className="font-pixel text-white/60 text-xs mb-1">
          {papel === "adversario" ? "VOCÊ É O ADVERSÁRIO" : "ESPECTADOR"}
        </p>
        <p className="font-corpo font-black text-white text-base">
          {papel === "adversario"
            ? "Se a dupla errar, você pode roubar o ponto!"
            : "Acompanhe o jogo!"}
        </p>
      </Card>

      {/* Dicas */}
      <Card variante="padrao" padding="md">
        <p className="font-corpo font-black text-gray-500 text-xs uppercase mb-3">
          Dicas em tempo real
        </p>
        {dicas.length === 0 ? (
          <p className="font-corpo text-gray-400 text-sm text-center py-2">
            Aguardando dicas...
          </p>
        ) : (
          <div className="space-y-2">
            {dicas.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-pixel text-roxo text-xs">{i + 1}.</span>
                <span className="font-corpo font-bold text-roxo-escuro text-lg">{d}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {papel === "adversario" && onRoubar && (
        <Button
          variante="perigo"
          tamanho="xl"
          larguraTotal
          onClick={onRoubar}
          icone={<span>💥</span>}
        >
          Roubar Ponto!
        </Button>
      )}

      <TabelaPalavras
        palavras={rodada.todasPalavras}
        palavraAtualIdx={rodada.palavraIdx}
        acertos={rodada.acertos}
        mostrarPalavras={false}
      />
    </div>
  );
}

function TelaEntreRodadas({
  rodadaNumero,
  proximaDuplaVez,
  jogadores,
  onContinuar,
  isHost,
  sala,
}: {
  rodadaNumero: number;
  proximaDuplaVez: 1 | 2;
  jogadores: Jogador[];
  onContinuar: () => void;
  isHost: boolean;
  sala: Sala | null;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full space-y-5">
        <div className="text-center">
          <p className="font-pixel text-white/60 text-xs mb-2">RODADA ENCERRADA</p>
          <p className="font-pixel text-amarelo text-2xl">
            Rodada {rodadaNumero} ok!
          </p>
        </div>

        <Placar jogadores={jogadores} />

        <Card variante="amarelo" padding="md" className="text-center">
          <p className="font-corpo font-black text-roxo-escuro text-xl">
            Dupla {proximaDuplaVez} se prepara!
          </p>
          <div className="flex justify-center gap-2 flex-wrap mt-2">
            {jogadores
              .filter((j) => j.dupla === proximaDuplaVez && j.ativo)
              .map((j) => (
                <span
                  key={j.id}
                  className="bg-roxo text-white px-3 py-1 rounded-full font-corpo font-bold text-sm"
                >
                  {j.apelido}
                </span>
              ))}
          </div>
        </Card>

        {isHost ? (
          <Button
            variante="primario"
            tamanho="xl"
            larguraTotal
            onClick={onContinuar}
            icone={<span>▶️</span>}
          >
            Continuar
          </Button>
        ) : (
          <Card variante="roxo" padding="sm" className="bg-white/10 border-white/20 text-center">
            <p className="font-corpo text-white/70 text-sm font-bold">
              Aguardando a dupla continuar...
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}

function TelaFimDeJogo({
  jogadores,
  sala,
  codigo,
  onJogarNovamente,
}: {
  jogadores: Jogador[];
  sala: Sala | null;
  codigo: string;
  onJogarNovamente: () => void;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full space-y-5">
        <div className="text-center">
          <p className="font-pixel text-white text-3xl animate-pulse-scale">
            🏆 FIM DE JOGO!
          </p>
          <p className="font-corpo text-white/70 text-base mt-2 font-bold">
            Resultado final
          </p>
        </div>

        <Placar jogadores={jogadores} finalizado grande />

        <div className="grid grid-cols-2 gap-3">
          <Button
            variante="amarelo"
            tamanho="lg"
            larguraTotal
            onClick={onJogarNovamente}
            icone={<span>🔄</span>}
          >
            Jogar de novo
          </Button>
          <Link href="/" className="block">
            <Button variante="fantasma" tamanho="lg" larguraTotal icone={<span>🏠</span>}>
              Início
            </Button>
          </Link>
        </div>

        <Link
          href={`/jogo/adivinhe-palavras/${codigo}/placar`}
          target="_blank"
          className="block"
        >
          <Button variante="secundario" tamanho="md" larguraTotal icone={<span>📊</span>}>
            Ver Placar na TV
          </Button>
        </Link>
      </div>
    </main>
  );
}
