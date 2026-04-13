"use client";

import { useEffect, useState, useCallback } from "react";
import clsx from "clsx";

interface TimerRodadaProps {
  duracaoSegundos: number;
  ativo: boolean;
  onTempoEsgotado?: () => void;
  onTick?: (segundosRestantes: number) => void;
}

export default function TimerRodada({
  duracaoSegundos,
  ativo,
  onTempoEsgotado,
  onTick,
}: TimerRodadaProps) {
  const [segundosRestantes, setSegundosRestantes] = useState(duracaoSegundos);

  const resetTimer = useCallback(() => {
    setSegundosRestantes(duracaoSegundos);
  }, [duracaoSegundos]);

  useEffect(() => {
    resetTimer();
  }, [duracaoSegundos, resetTimer]);

  useEffect(() => {
    if (!ativo) return;

    const interval = setInterval(() => {
      setSegundosRestantes((prev) => {
        const novo = prev - 1;
        onTick?.(novo);
        if (novo <= 0) {
          clearInterval(interval);
          onTempoEsgotado?.();
          return 0;
        }
        return novo;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [ativo, onTempoEsgotado, onTick]);

  const porcentagem = (segundosRestantes / duracaoSegundos) * 100;
  const urgente = segundosRestantes <= 10;
  const critico = segundosRestantes <= 5;

  const corBarra = critico
    ? "bg-vermelho"
    : urgente
    ? "bg-amarelo"
    : "bg-verde";

  const corNumero = critico
    ? "text-vermelho"
    : urgente
    ? "text-amarelo"
    : "text-verde";

  return (
    <div className="w-full">
      {/* Número grande */}
      <div className="text-center mb-2">
        <span
          className={clsx(
            "font-pixel text-5xl font-bold transition-all duration-300",
            corNumero,
            critico && "animate-pulse"
          )}
        >
          {segundosRestantes}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="w-full h-4 bg-white/20 rounded-full overflow-hidden border-2 border-white/30">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            corBarra
          )}
          style={{ width: `${porcentagem}%` }}
        />
      </div>

      {urgente && (
        <p className={clsx(
          "text-center font-corpo font-black text-sm mt-1 uppercase tracking-wide",
          critico ? "text-vermelho animate-pulse" : "text-amarelo"
        )}>
          {critico ? "⚠️ Acabando!" : "⏰ Corre!"}
        </p>
      )}
    </div>
  );
}
