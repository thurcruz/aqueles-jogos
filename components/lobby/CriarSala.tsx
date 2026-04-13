"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { criarSala, entrarNaSala, salvarDadosLocais, gerarHostId } from "@/lib/supabase";

const OPCOES_RODADAS = [3, 5, 7, 10];
const OPCOES_TEMPO = [30, 45, 60, 90];

export default function CriarSala() {
  const router = useRouter();
  const [apelido, setApelido] = useState("");
  const [rodadas, setRodadas] = useState(5);
  const [tempo, setTempo] = useState(60);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!apelido.trim()) {
      setErro("Digite seu apelido!");
      return;
    }
    if (apelido.trim().length < 2) {
      setErro("Apelido muito curto!");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const hostId = gerarHostId();
      const sala = await criarSala(hostId, { rodadas, tempo_por_rodada: tempo });
      const jogador = await entrarNaSala(sala.id, apelido.trim(), 1);

      salvarDadosLocais({
        apelido: apelido.trim(),
        sala_id: sala.id,
        jogador_id: jogador.id,
        codigo_sala: sala.codigo,
      });

      // Salva o host_id separadamente para verificações
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

      {/* Número de rodadas */}
      <div>
        <label className="block font-corpo font-black text-white text-sm mb-2 uppercase tracking-wide">
          Número de rodadas
        </label>
        <div className="grid grid-cols-4 gap-2">
          {OPCOES_RODADAS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRodadas(n)}
              className={`py-3 rounded-xl border-2 font-corpo font-black text-lg transition-all ${
                rodadas === n
                  ? "bg-amarelo border-amarelo-hover text-roxo-escuro shadow-brutal-amarelo"
                  : "bg-white/10 border-white/30 text-white hover:bg-white/20"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-white/60 text-xs mt-1 font-corpo">por dupla</p>
      </div>

      {/* Tempo por rodada */}
      <div>
        <label className="block font-corpo font-black text-white text-sm mb-2 uppercase tracking-wide">
          Tempo por rodada
        </label>
        <div className="grid grid-cols-4 gap-2">
          {OPCOES_TEMPO.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTempo(t)}
              className={`py-3 rounded-xl border-2 font-corpo font-black text-base transition-all ${
                tempo === t
                  ? "bg-amarelo border-amarelo-hover text-roxo-escuro shadow-brutal-amarelo"
                  : "bg-white/10 border-white/30 text-white hover:bg-white/20"
              }`}
            >
              {t}s
            </button>
          ))}
        </div>
      </div>

      {/* Resumo */}
      <Card variante="roxo" padding="sm" className="border-white/30 bg-white/10">
        <p className="text-white/80 font-corpo text-sm text-center">
          <span className="font-black text-amarelo">{rodadas * 2}</span> rodadas no total ·{" "}
          <span className="font-black text-amarelo">{tempo}s</span> cada ·{" "}
          <span className="font-black text-amarelo">{Math.ceil((rodadas * 2 * tempo) / 60)} min</span> aprox.
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
