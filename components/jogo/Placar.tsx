"use client";

import clsx from "clsx";
import type { Jogador } from "@/types/game";
import { calcularPlacar, quemGanhou } from "@/lib/gameLogic";

interface PlacarProps {
  jogadores: Jogador[];
  rodadaAtual?: number;
  totalRodadas?: number;
  finalizado?: boolean;
  grande?: boolean;
}

const AVATARES = ["🦊", "🐸", "🦁", "🐯", "🐧", "🦄", "🐲", "🦋", "🐙", "🦀"];

function getAvatar(apelido: string): string {
  const idx =
    apelido.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    AVATARES.length;
  return AVATARES[idx];
}

export default function Placar({
  jogadores,
  rodadaAtual,
  totalRodadas,
  finalizado = false,
  grande = false,
}: PlacarProps) {
  const { dupla1, dupla2 } = calcularPlacar(jogadores);
  const vencedor = finalizado ? quemGanhou(dupla1, dupla2) : null;

  const liderando = dupla1.pontos > dupla2.pontos
    ? 1
    : dupla2.pontos > dupla1.pontos
    ? 2
    : null;

  return (
    <div className={clsx("w-full", grande && "max-w-2xl mx-auto")}>
      {/* Título */}
      {finalizado && (
        <div className="text-center mb-4">
          <p className="font-pixel text-amarelo text-lg">
            {vencedor === "empate" ? "🤝 EMPATE!" : `🏆 DUPLA ${vencedor} VENCEU!`}
          </p>
        </div>
      )}

      {/* Info da rodada */}
      {rodadaAtual !== undefined && totalRodadas !== undefined && !finalizado && (
        <div className="text-center mb-3">
          <span className="font-corpo font-bold text-white/70 text-sm">
            Rodada {rodadaAtual} de {totalRodadas}
          </span>
        </div>
      )}

      {/* Placar lado a lado */}
      <div className="grid grid-cols-2 gap-3">
        {/* Dupla 1 */}
        <div
          className={clsx(
            "rounded-xl border-2 p-4 text-center transition-all",
            liderando === 1 && !finalizado
              ? "border-amarelo shadow-brutal-amarelo bg-roxo-claro"
              : vencedor === 1
              ? "border-amarelo shadow-brutal-amarelo bg-verde"
              : "border-white/30 bg-white/10"
          )}
        >
          <p className={clsx(
            "font-pixel text-xs mb-2",
            liderando === 1 || vencedor === 1 ? "text-amarelo" : "text-white/60"
          )}>
            DUPLA 1
          </p>
          <p className={clsx(
            "font-pixel mb-3 leading-none",
            grande ? "text-6xl" : "text-4xl",
            liderando === 1 || vencedor === 1 ? "text-amarelo" : "text-white"
          )}>
            {dupla1.pontos}
          </p>
          <div className="space-y-1">
            {dupla1.jogadores.map((j) => (
              <div key={j.id} className="flex items-center justify-center gap-1.5">
                <span className="text-sm">{getAvatar(j.apelido)}</span>
                <span className="font-corpo font-bold text-white text-xs truncate">
                  {j.apelido}
                </span>
              </div>
            ))}
            {dupla1.jogadores.length === 0 && (
              <p className="text-white/40 font-corpo text-xs">Sem jogadores</p>
            )}
          </div>
        </div>

        {/* Dupla 2 */}
        <div
          className={clsx(
            "rounded-xl border-2 p-4 text-center transition-all",
            liderando === 2 && !finalizado
              ? "border-verde shadow-[4px_4px_0_#15803d] bg-green-800"
              : vencedor === 2
              ? "border-verde shadow-[4px_4px_0_#15803d] bg-verde"
              : "border-white/30 bg-white/10"
          )}
        >
          <p className={clsx(
            "font-pixel text-xs mb-2",
            liderando === 2 || vencedor === 2 ? "text-verde" : "text-white/60"
          )}>
            DUPLA 2
          </p>
          <p className={clsx(
            "font-pixel mb-3 leading-none",
            grande ? "text-6xl" : "text-4xl",
            liderando === 2 || vencedor === 2 ? "text-verde" : "text-white"
          )}>
            {dupla2.pontos}
          </p>
          <div className="space-y-1">
            {dupla2.jogadores.map((j) => (
              <div key={j.id} className="flex items-center justify-center gap-1.5">
                <span className="text-sm">{getAvatar(j.apelido)}</span>
                <span className="font-corpo font-bold text-white text-xs truncate">
                  {j.apelido}
                </span>
              </div>
            ))}
            {dupla2.jogadores.length === 0 && (
              <p className="text-white/40 font-corpo text-xs">Sem jogadores</p>
            )}
          </div>
        </div>
      </div>

      {/* VS central (quando não finalizado) */}
      {!finalizado && (
        <div className="text-center mt-2">
          <span className="font-pixel text-white/40 text-xs">VS</span>
        </div>
      )}
    </div>
  );
}
