"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { supabase, entrarNaSala, salvarDadosLocais, gerarHostId, gerarCodigoSala } from "@/lib/supabase";
import type { ModoJogo } from "@/types/game";

const OPCOES_PALAVRAS = [5, 6, 7, 8, 9, 10];
const OPCOES_TEMPO = [30, 45, 60, 90];

export default function CriarSala() {
  const router = useRouter();
  const [apelido, setApelido] = useState("");
  const [modo, setModo] = useState<ModoJogo>("2v2");
  const [numPalavras, setNumPalavras] = useState(7);
  const [tempoDica, setTempoDica] = useState(60);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!apelido.trim()) { setErro("Digite seu apelido!"); return; }
    if (apelido.trim().length < 2) { setErro("Apelido muito curto!"); return; }

    setCarregando(true);
    setErro("");

    try {
      const hostId = gerarHostId();
      const codigo = gerarCodigoSala();

      const { data: sala, error } = await supabase
        .from("salas")
        .insert({
          codigo,
          host_id: hostId,
          status: "aguardando",
          jogo: "adivinhe-palavras",
          config: { modo, num_palavras: numPalavras, tempo_dica: tempoDica },
          palavra_atual_idx: 0,
        })
        .select()
        .single();

      if (error) throw error;

      const jogador = await entrarNaSala(sala.id, apelido.trim(), 1);

      salvarDadosLocais({
        apelido: apelido.trim(),
        sala_id: sala.id,
        jogador_id: jogador.id,
        codigo_sala: sala.codigo,
      });

      localStorage.setItem("aj_host_id", hostId);
      localStorage.setItem("aj_sala_host_id", sala.host_id);

      router.push(`/sala/${sala.codigo}`);
    } catch (err) {
      console.error(err);
      setErro("Erro ao criar sala. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleCriar} className="space-y-5">
      {/* Apelido */}
      <div>
        <label className="block font-corpo font-black text-white text-sm mb-2 uppercase tracking-wide">
          Seu apelido
        </label>
        <input
          type="text"
          value={apelido}
          onChange={(e) => setApelido(e.target.value)}
          placeholder="Ex: Pedrão, MariPower..."
          maxLength={20}
          className="w-full px-4 py-3 rounded-xl border-2 border-roxo bg-white font-corpo font-bold text-roxo-escuro placeholder-gray-400 focus:outline-none focus:border-amarelo focus:ring-2 focus:ring-amarelo/30 transition-all text-lg"
        />
      </div>

      {/* Modo de jogo */}
      <div>
        <label className="block font-corpo font-black text-white text-sm mb-2 uppercase tracking-wide">
          Modo de jogo
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setModo("1v1")}
            className={`py-4 rounded-xl border-2 font-corpo font-black transition-all text-left px-4 ${
              modo === "1v1"
                ? "bg-amarelo border-amarelo-hover text-roxo-escuro shadow-brutal-amarelo"
                : "bg-white/10 border-white/30 text-white hover:bg-white/20"
            }`}
          >
            <div className="text-2xl mb-1">⚔️</div>
            <div className="text-base">1 vs 1</div>
            <div className={`text-xs font-bold mt-1 ${modo === "1v1" ? "text-roxo/70" : "text-white/50"}`}>
              Bot dá as dicas, dois jogadores competem
            </div>
          </button>
          <button
            type="button"
            onClick={() => setModo("2v2")}
            className={`py-4 rounded-xl border-2 font-corpo font-black transition-all text-left px-4 ${
              modo === "2v2"
                ? "bg-amarelo border-amarelo-hover text-roxo-escuro shadow-brutal-amarelo"
                : "bg-white/10 border-white/30 text-white hover:bg-white/20"
            }`}
          >
            <div className="text-2xl mb-1">👥</div>
            <div className="text-base">2 vs 2</div>
            <div className={`text-xs font-bold mt-1 ${modo === "2v2" ? "text-roxo/70" : "text-white/50"}`}>
              Duplas competem, um dá dicas e o outro adivinha
            </div>
          </button>
        </div>
      </div>

      {/* Número de palavras */}
      <div>
        <label className="block font-corpo font-black text-white text-sm mb-2 uppercase tracking-wide">
          Palavras por partida
        </label>
        <div className="grid grid-cols-6 gap-2">
          {OPCOES_PALAVRAS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNumPalavras(n)}
              className={`py-3 rounded-xl border-2 font-corpo font-black text-base transition-all ${
                numPalavras === n
                  ? "bg-amarelo border-amarelo-hover text-roxo-escuro shadow-brutal-amarelo"
                  : "bg-white/10 border-white/30 text-white hover:bg-white/20"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Tempo para dar dicas */}
      <div>
        <label className="block font-corpo font-black text-white text-sm mb-2 uppercase tracking-wide">
          Tempo para dar dicas
        </label>
        <div className="grid grid-cols-4 gap-2">
          {OPCOES_TEMPO.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTempoDica(t)}
              className={`py-3 rounded-xl border-2 font-corpo font-black text-base transition-all ${
                tempoDica === t
                  ? "bg-amarelo border-amarelo-hover text-roxo-escuro shadow-brutal-amarelo"
                  : "bg-white/10 border-white/30 text-white hover:bg-white/20"
              }`}
            >
              {t}s
            </button>
          ))}
        </div>
        <p className="text-white/50 text-xs font-corpo mt-1">
          {modo === "1v1"
            ? "Tempo total para adivinhar antes de passar"
            : "Tempo do dica-dor — ao zerar, palavra passa para o adversário"}
        </p>
      </div>

      {/* Resumo */}
      <Card variante="roxo" padding="sm" className="border-white/30 bg-white/10">
        <p className="text-white/80 font-corpo text-sm text-center">
          Modo{" "}
          <span className="font-black text-amarelo">{modo}</span>
          {" · "}
          <span className="font-black text-amarelo">{numPalavras} palavras</span>
          {" · "}
          <span className="font-black text-amarelo">{tempoDica}s</span> por dica
        </p>
      </Card>

      {/* Erro */}
      {erro && (
        <div className="bg-vermelho/20 border border-vermelho rounded-xl px-4 py-3 text-white font-corpo font-bold text-sm">
          {erro}
        </div>
      )}

      <Button
        type="submit"
        variante="amarelo"
        tamanho="lg"
        larguraTotal
        carregando={carregando}
        icone={<span>🚀</span>}
      >
        Criar Sala
      </Button>
    </form>
  );
}
