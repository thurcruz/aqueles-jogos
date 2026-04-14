import type { Jogador, PlacarDupla, Dupla, ModoJogo } from "@/types/game";

// ─── Placar ───────────────────────────────────────────────────────────────

export function calcularPlacar(
  jogadores: Jogador[],
  modo: ModoJogo = "2v2"
): { dupla1: PlacarDupla; dupla2: PlacarDupla } {
  const d1 = jogadores.filter((j) => j.dupla === 1 && j.ativo);
  const d2 = jogadores.filter((j) => j.dupla === 2 && j.ativo);

  if (modo === "1v1") {
    return {
      dupla1: {
        dupla: 1,
        label: d1[0]?.apelido ?? "Jogador 1",
        pontos: d1.reduce((s, j) => s + j.pontos, 0),
        jogadores: d1,
      },
      dupla2: {
        dupla: 2,
        label: d2[0]?.apelido ?? "Jogador 2",
        pontos: d2.reduce((s, j) => s + j.pontos, 0),
        jogadores: d2,
      },
    };
  }

  return {
    dupla1: {
      dupla: 1,
      label: "Dupla 1",
      pontos: d1.reduce((s, j) => s + j.pontos, 0),
      jogadores: d1,
    },
    dupla2: {
      dupla: 2,
      label: "Dupla 2",
      pontos: d2.reduce((s, j) => s + j.pontos, 0),
      jogadores: d2,
    },
  };
}

export function quemGanhou(
  dupla1: PlacarDupla,
  dupla2: PlacarDupla
): Dupla | "empate" {
  if (dupla1.pontos > dupla2.pontos) return 1;
  if (dupla2.pontos > dupla1.pontos) return 2;
  return "empate";
}

// ─── Papéis em 2v2 ───────────────────────────────────────────────────────

export type PapelNaRodada =
  | "dica-dor"      // da equipe da vez: vê a palavra, digita dicas
  | "adivinhador"   // da equipe da vez: vê as dicas, tenta acertar
  | "adversario"    // equipe adversária (pode tomar a palavra se a vez passar)
  | "espectador";   // não está participando ativamente

export function determinarPapel2v2(
  jogadorId: string,
  vezDupla: Dupla,
  passouParaAdversario: boolean,
  jogadores: Jogador[]
): PapelNaRodada {
  const jogador = jogadores.find((j) => j.id === jogadorId);
  if (!jogador) return "espectador";

  // Equipe que está "tentando" agora
  const duplaAtiva = passouParaAdversario
    ? vezDupla === 1 ? 2 : 1
    : vezDupla;

  const jogadoresDaDuplaAtiva = jogadores
    .filter((j) => j.dupla === duplaAtiva && j.ativo)
    .sort((a, b) => new Date(a.entrou_em).getTime() - new Date(b.entrou_em).getTime());

  if (jogador.dupla !== duplaAtiva) return "adversario";

  // O primeiro a entrar na dupla é o dica-dor
  if (jogadoresDaDuplaAtiva[0]?.id === jogadorId) return "dica-dor";
  return "adivinhador";
}

// ─── Validação de dica ────────────────────────────────────────────────────

/** Dica deve ser exatamente 1 palavra, sem espaços */
export function validarDica(dica: string): {
  valida: boolean;
  erro?: string;
} {
  const limpa = dica.trim();
  if (!limpa) return { valida: false, erro: "Digite uma palavra" };
  if (/\s/.test(limpa))
    return { valida: false, erro: "A dica deve ser apenas 1 palavra!" };
  if (limpa.length > 30)
    return { valida: false, erro: "Palavra muito longa" };
  return { valida: true };
}

/** Palpite deve ser exatamente 1 palavra */
export function validarPalpite(palpite: string): boolean {
  const limpo = palpite.trim();
  return limpo.length > 0 && !/\s/.test(limpo);
}

// ─── Validação de sala ────────────────────────────────────────────────────

export function salaTemJogadoresSuficientes(
  jogadores: Jogador[],
  modo: ModoJogo
): boolean {
  const d1 = jogadores.filter((j) => j.dupla === 1 && j.ativo);
  const d2 = jogadores.filter((j) => j.dupla === 2 && j.ativo);
  if (modo === "1v1") return d1.length >= 1 && d2.length >= 1;
  // 2v2: ao menos 2 por dupla
  return d1.length >= 2 && d2.length >= 2;
}

export function jogadoresPorDupla(
  jogadores: Jogador[],
  dupla: Dupla
): Jogador[] {
  return jogadores
    .filter((j) => j.dupla === dupla && j.ativo)
    .sort(
      (a, b) =>
        new Date(a.entrou_em).getTime() - new Date(b.entrou_em).getTime()
    );
}

// ─── Utilitários ──────────────────────────────────────────────────────────

export function outraDupla(dupla: Dupla): Dupla {
  return dupla === 1 ? 2 : 1;
}

// ─── Jogos disponíveis ────────────────────────────────────────────────────

export const JOGOS_DISPONIVEIS = [
  {
    id: "adivinhe-palavras",
    nome: "MEGASENA",
    descricao:
      "Dê dicas (só palavras!) para seu parceiro adivinhar antes do adversário!",
    icone: "💬",
    disponivel: true,
    minJogadores: 2,
    maxJogadores: 8,
  },
  {
    id: "quem-sou-eu",
    nome: "Quem Sou Eu?",
    descricao: "Descubra quem você é fazendo perguntas de sim ou não!",
    icone: "🎭",
    disponivel: false,
    minJogadores: 2,
    maxJogadores: 10,
  },
  {
    id: "jogo-da-forca",
    nome: "Jogo da Forca",
    descricao: "Adivinhe a palavra letra por letra antes de perder!",
    icone: "✏️",
    disponivel: false,
    minJogadores: 2,
    maxJogadores: 6,
  },
  {
    id: "o-impostor",
    nome: "O Impostor",
    descricao: "Descubra quem é o impostor antes que seja tarde!",
    icone: "🕵️",
    disponivel: false,
    minJogadores: 4,
    maxJogadores: 12,
  },
];
