"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PlayerChip from "@/components/ui/PlayerChip";
import { useSala } from "@/hooks/useSala";
import {
  carregarDadosLocais,
  supabase,
  buscarPalavrasAleatorias,
  sairDaSala,
} from "@/lib/supabase";
import {
  salaTemJogadoresSuficientes,
  jogadoresPorDupla,
} from "@/lib/gameLogic";
import type { Jogador, ModoJogo } from "@/types/game";

export default function SalaPage() {
  const params = useParams();
  const router = useRouter();
  const codigo = (params.codigo as string).toUpperCase();

  const [dadosLocais] = useState(() => carregarDadosLocais());
  const [iniciando, setIniciando] = useState(false);
  const [urlAtual, setUrlAtual] = useState("");
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    setUrlAtual(window.location.origin);
  }, []);

  const { sala, jogadores, carregando, erro, trocarDupla } = useSala({
    codigoSala: codigo,
    jogadorId: dadosLocais?.jogador_id,
  });

  useEffect(() => {
    if (sala?.status === "jogando") {
      router.push(`/jogo/adivinhe-palavras/${codigo}`);
    }
  }, [sala?.status, codigo, router]);

  useEffect(() => {
    if (!dadosLocais || !sala) return;
    setIsHost(localStorage.getItem("aj_sala_host_id") === sala.host_id);
  }, [dadosLocais, sala]);

  const modo: ModoJogo = (sala?.config?.modo as ModoJogo) ?? "2v2";
  const numPalavras: number = sala?.config?.num_palavras ?? 7;
  const podeiniciar = salaTemJogadoresSuficientes(jogadores, modo);
  const dupla1 = jogadoresPorDupla(jogadores, 1);
  const dupla2 = jogadoresPorDupla(jogadores, 2);

  const handleIniciarJogo = useCallback(async () => {
    if (!sala || !podeiniciar) return;
    setIniciando(true);

    try {
      const palavras = await buscarPalavrasAleatorias(numPalavras);

      await supabase.from("eventos").insert({
        sala_id: sala.id,
        tipo: "iniciar",
        payload: {
          palavras_ids: palavras.map((p) => p.id),
          num_palavras: numPalavras,
          modo,
        },
      });

      await supabase
        .from("salas")
        .update({ status: "jogando", palavra_atual_idx: 0 })
        .eq("id", sala.id);

      router.push(`/jogo/adivinhe-palavras/${codigo}`);
    } catch (err) {
      console.error("Erro ao iniciar jogo:", err);
      setIniciando(false);
    }
  }, [sala, podeiniciar, codigo, router, numPalavras, modo]);

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="font-pixel text-amarelo text-sm animate-pulse mb-2">Carregando sala...</div>
          <div className="font-pixel text-white/40 text-xs">{codigo}</div>
        </div>
      </div>
    );
  }

  if (erro || !sala) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card variante="padrao" padding="lg" className="max-w-sm w-full text-center">
          <p className="font-corpo font-bold text-vermelho text-lg mb-4">
            {erro ?? "Sala não encontrada"}
          </p>
          <Link href="/lobby">
            <Button variante="primario" larguraTotal>Voltar ao Lobby</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const urlSala = `${urlAtual}/lobby?codigo=${codigo}`;
  const minJogadoresMensagem =
    modo === "1v1"
      ? "Precisa de 1 jogador em cada lado"
      : "Precisa de 2 jogadores em cada dupla";

  return (
    <main className="min-h-screen flex flex-col px-4 py-6">
      <div className="max-w-lg mx-auto w-full space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-corpo text-white/60 text-sm font-bold uppercase tracking-wide">
              Sala de Espera
            </p>
            <h1 className="font-pixel text-amarelo text-2xl text-sombra mt-1">{codigo}</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="font-corpo text-white/60 text-xs">
                {jogadores.length} jogador{jogadores.length !== 1 ? "es" : ""}
              </p>
              <div className="flex items-center justify-end gap-1 mt-1">
                <div className="w-2 h-2 bg-verde rounded-full animate-pulse" />
                <span className="font-corpo text-verde text-xs font-bold">Aguardando</span>
              </div>
            </div>
            <button
              onClick={async () => {
                if (!confirm("Sair da sala?")) return;
                if (dadosLocais?.jogador_id) await sairDaSala(dadosLocais.jogador_id).catch(() => {});
                router.push("/lobby");
              }}
              className="px-3 py-1.5 rounded-xl border-2 border-white/30 bg-white/10 text-white/60 font-corpo font-bold text-xs hover:bg-vermelho/30 hover:border-vermelho hover:text-white transition-all"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Código */}
        <Card variante="padrao" padding="sm" className="text-center">
          <p className="font-corpo text-gray-500 text-xs mb-1 uppercase font-bold tracking-wide">
            Compartilhe o código
          </p>
          <p className="font-pixel text-roxo text-3xl tracking-widest">{codigo}</p>
        </Card>

        {/* Modo e palavras */}
        <Card variante="padrao" padding="sm">
          <div className="flex items-center justify-around text-center">
            <div>
              <p className="font-pixel text-roxo text-lg uppercase">{modo}</p>
              <p className="font-corpo text-gray-500 text-xs font-bold">modo</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="font-pixel text-roxo text-lg">{numPalavras}</p>
              <p className="font-corpo text-gray-500 text-xs font-bold">palavras</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="font-pixel text-roxo text-lg">
                {modo === "1v1" ? "2" : "4"}
              </p>
              <p className="font-corpo text-gray-500 text-xs font-bold">jogadores</p>
            </div>
          </div>
        </Card>

        {/* QR Code */}
        {urlAtual && (
          <Card variante="padrao" padding="md" className="flex flex-col items-center gap-3">
            <p className="font-corpo text-gray-500 text-xs uppercase font-bold tracking-wide">
              QR Code para entrar
            </p>
            <div className="bg-white p-3 rounded-xl border-2 border-roxo/20">
              <QRCodeSVG value={urlSala} size={140} bgColor="#ffffff" fgColor="#3A0F80" level="M" />
            </div>
          </Card>
        )}

        {/* Duplas */}
        <div className="grid grid-cols-2 gap-3">
          <Card variante="roxo" padding="sm" className="bg-roxo-claro/80 border-white/30">
            <h3 className="font-pixel text-white text-xs mb-3 text-center">
              {modo === "1v1" ? "JOGADOR 1" : "DUPLA 1"}
            </h3>
            <div className="space-y-2">
              {dupla1.map((j: Jogador) => (
                <PlayerChip
                  key={j.id}
                  jogador={j}
                  isLocal={j.id === dadosLocais?.jogador_id}
                  onTrocarDupla={j.id === dadosLocais?.jogador_id ? trocarDupla : undefined}
                />
              ))}
              {dupla1.length === 0 && (
                <p className="text-white/40 font-corpo text-xs text-center py-2">Ninguém ainda</p>
              )}
            </div>
          </Card>

          <Card variante="roxo" padding="sm" className="bg-verde/30 border-white/30">
            <h3 className="font-pixel text-white text-xs mb-3 text-center">
              {modo === "1v1" ? "JOGADOR 2" : "DUPLA 2"}
            </h3>
            <div className="space-y-2">
              {dupla2.map((j: Jogador) => (
                <PlayerChip
                  key={j.id}
                  jogador={j}
                  isLocal={j.id === dadosLocais?.jogador_id}
                  onTrocarDupla={j.id === dadosLocais?.jogador_id ? trocarDupla : undefined}
                />
              ))}
              {dupla2.length === 0 && (
                <p className="text-white/40 font-corpo text-xs text-center py-2">Ninguém ainda</p>
              )}
            </div>
          </Card>
        </div>

        {!podeiniciar && (
          <div className="bg-amarelo/20 border-2 border-amarelo rounded-xl px-4 py-3 text-center">
            <p className="font-corpo font-bold text-white text-sm">
              ⚠️ {minJogadoresMensagem}
            </p>
          </div>
        )}

        {isHost ? (
          <Button
            variante="amarelo"
            tamanho="xl"
            larguraTotal
            carregando={iniciando}
            disabled={!podeiniciar}
            onClick={handleIniciarJogo}
            icone={<span>🎮</span>}
          >
            Iniciar Jogo!
          </Button>
        ) : (
          <Card variante="roxo" padding="sm" className="bg-white/10 border-white/20 text-center">
            <p className="font-corpo text-white/70 text-sm font-bold">
              Aguardando o host iniciar...
            </p>
            <div className="flex justify-center gap-1 mt-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
