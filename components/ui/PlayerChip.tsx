import clsx from "clsx";
import type { Jogador } from "@/types/game";

interface PlayerChipProps {
  jogador: Jogador;
  isLocal?: boolean;
  isHost?: boolean;
  onTrocarDupla?: (dupla: 1 | 2) => void;
  compact?: boolean;
}

const CORES_DUPLA = {
  1: {
    bg: "bg-roxo-claro",
    border: "border-roxo-escuro",
    text: "text-white",
    badge: "bg-amarelo text-roxo-escuro",
  },
  2: {
    bg: "bg-verde",
    border: "border-green-700",
    text: "text-white",
    badge: "bg-white text-verde",
  },
};

const AVATARES = ["🦊", "🐸", "🦁", "🐯", "🐧", "🦄", "🐲", "🦋", "🐙", "🦀"];

function getAvatar(apelido: string): string {
  const idx =
    apelido.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    AVATARES.length;
  return AVATARES[idx];
}

export default function PlayerChip({
  jogador,
  isLocal = false,
  isHost = false,
  onTrocarDupla,
  compact = false,
}: PlayerChipProps) {
  const cores = CORES_DUPLA[jogador.dupla as 1 | 2];
  const avatar = getAvatar(jogador.apelido);

  if (compact) {
    return (
      <div
        className={clsx(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 font-corpo font-bold text-sm",
          cores.bg,
          cores.border,
          cores.text
        )}
      >
        <span>{avatar}</span>
        <span>{jogador.apelido}</span>
        {isLocal && (
          <span className="text-xs opacity-75">(você)</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
        cores.bg,
        cores.border,
        isLocal && "ring-2 ring-amarelo ring-offset-1"
      )}
    >
      {/* Avatar */}
      <div className="text-2xl w-10 h-10 flex items-center justify-center bg-white/20 rounded-full">
        {avatar}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={clsx("font-corpo font-black text-base truncate", cores.text)}>
            {jogador.apelido}
          </span>
          {isLocal && (
            <span className="text-xs bg-amarelo text-roxo-escuro px-1.5 py-0.5 rounded font-bold uppercase">
              você
            </span>
          )}
          {isHost && (
            <span className="text-xs bg-white/30 text-white px-1.5 py-0.5 rounded font-bold uppercase">
              host
            </span>
          )}
        </div>
        {jogador.pontos > 0 && (
          <div className={clsx("text-xs font-bold mt-0.5", cores.text, "opacity-80")}>
            {jogador.pontos} {jogador.pontos === 1 ? "ponto" : "pontos"}
          </div>
        )}
      </div>

      {/* Trocar dupla */}
      {onTrocarDupla && isLocal && (
        <button
          onClick={() => onTrocarDupla(jogador.dupla === 1 ? 2 : 1)}
          className="text-xs bg-white/20 hover:bg-white/40 text-white px-2 py-1 rounded font-bold transition-colors"
          title="Trocar de dupla"
        >
          ⇄
        </button>
      )}
    </div>
  );
}
