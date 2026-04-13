"use client";

import clsx from "clsx";
import type { Palavra } from "@/types/game";

interface TabelaPalavrasProps {
  palavras: Palavra[];
  palavraAtualIdx: number;
  acertos: boolean[];
  mostrarPalavras?: boolean; // false para espectadores que não devem ver
}

export default function TabelaPalavras({
  palavras,
  palavraAtualIdx,
  acertos,
  mostrarPalavras = true,
}: TabelaPalavrasProps) {
  return (
    <div className="space-y-2">
      {palavras.map((palavra, idx) => {
        const isAtual = idx === palavraAtualIdx;
        const isAcertou = acertos[idx] === true;
        const isErrou = acertos[idx] === false;
        const isPendente = acertos[idx] === undefined;

        return (
          <div
            key={palavra.id}
            className={clsx(
              "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-300",
              isAtual && !isAcertou && !isErrou
                ? "bg-amarelo border-amarelo-hover shadow-brutal-amarelo scale-105"
                : isAcertou
                ? "bg-verde border-green-700 shadow-[2px_2px_0_#15803d]"
                : isErrou
                ? "bg-vermelho/20 border-vermelho"
                : "bg-white/10 border-white/20"
            )}
          >
            {/* Ícone de status */}
            <div className="text-xl w-7 text-center flex-shrink-0">
              {isAcertou
                ? "✅"
                : isErrou
                ? "❌"
                : isAtual
                ? "👉"
                : isPendente && idx > palavraAtualIdx
                ? "⬜"
                : "⬜"}
            </div>

            {/* Palavra */}
            <div className="flex-1 min-w-0">
              {mostrarPalavras ? (
                <span
                  className={clsx(
                    "font-corpo font-black text-lg",
                    isAtual && !isAcertou && !isErrou
                      ? "text-roxo-escuro"
                      : isAcertou
                      ? "text-white"
                      : "text-white"
                  )}
                >
                  {palavra.palavra}
                </span>
              ) : (
                <span className="font-corpo font-black text-lg text-white/40">
                  {isAtual ? "???" : isAcertou ? "✓" : "---"}
                </span>
              )}
            </div>

            {/* Categoria */}
            {mostrarPalavras && (
              <span
                className={clsx(
                  "text-xs font-corpo font-bold px-2 py-0.5 rounded uppercase",
                  isAtual && !isAcertou
                    ? "bg-roxo text-white"
                    : "bg-white/20 text-white/60"
                )}
              >
                {palavra.categoria}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
