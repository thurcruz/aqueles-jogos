import type { Jogador, PlacarDupla, Dupla } from "@/types/game";

// ─── Lógica de Placar ─────────────────────────────────────────────────────

export function calcularPlacar(jogadores: Jogador[]): {
  dupla1: PlacarDupla;
  dupla2: PlacarDupla;
} {
  const dupla1Jogadores = jogadores.filter((j) => j.dupla === 1 && j.ativo);
  const dupla2Jogadores = jogadores.filter((j) => j.dupla === 2 && j.ativo);

  return {
    dupla1: {
      dupla: 1,
      pontos: dupla1Jogadores.reduce((acc, j) => acc + j.pontos, 0),
      jogadores: dupla1Jogadores,
    },
    dupla2: {
      dupla: 2,
      pontos: dupla2Jogadores.reduce((acc, j) => acc + j.pontos, 0),
      jogadores: dupla2Jogadores,
    },
  };
}

export function quemGanhou(dupla1: PlacarDupla, dupla2: PlacarDupla): Dupla | "empate" {
  if (dupla1.pontos > dupla2.pontos) return 1;
  if (dupla2.pontos > dupla1.pontos) return 2;
  return "empate";
}

// ─── Lógica de Rodadas ────────────────────────────────────────────────────

export function proximaDupla(duplaAtual: Dupla): Dupla {
  return duplaAtual === 1 ? 2 : 1;
}

export function calcularTotalRodadas(rodadas: number): number {
  // Cada dupla joga o número configurado de rodadas
  return rodadas * 2;
}

// ─── Validação de Sala ────────────────────────────────────────────────────

export function salaTemJogadoresSuficientes(jogadores: Jogador[]): boolean {
  const temDupla1 = jogadores.some((j) => j.dupla === 1 && j.ativo);
  const temDupla2 = jogadores.some((j) => j.dupla === 2 && j.ativo);
  return temDupla1 && temDupla2;
}

export function jogadoresPorDupla(jogadores: Jogador[], dupla: Dupla): Jogador[] {
  return jogadores.filter((j) => j.dupla === dupla && j.ativo);
}

// ─── Timer ────────────────────────────────────────────────────────────────

export function formatarTempo(segundos: number): string {
  if (segundos <= 0) return "0";
  return String(segundos);
}

export function calcularCorTimer(segundos: number, total: number): string {
  const pct = segundos / total;
  if (pct > 0.5) return "text-verde";
  if (pct > 0.25) return "text-amarelo";
  return "text-vermelho";
}

// ─── Geração de Palavras ──────────────────────────────────────────────────

export function sortearPalavrasDaRodada<T>(palavras: T[], quantidade: number): T[] {
  const embaralhadas = [...palavras].sort(() => Math.random() - 0.5);
  return embaralhadas.slice(0, quantidade);
}

// ─── Papel do Jogador na Rodada ───────────────────────────────────────────

export type PapelNaRodada = "dica-dor" | "adivinhador" | "adversario" | "espectador";

export function determinarPapel(
  jogadorId: string,
  duplaVez: Dupla,
  jogadores: Jogador[],
  duplaVezPrimeiro?: string // ID do jogador que dá as dicas
): PapelNaRodada {
  const jogador = jogadores.find((j) => j.id === jogadorId);
  if (!jogador) return "espectador";

  if (jogador.dupla !== duplaVez) return "adversario";

  // Na dupla da vez: o primeiro é dica-dor, o segundo é adivinhador
  const jogadoresDaDupla = jogadores
    .filter((j) => j.dupla === duplaVez && j.ativo)
    .sort((a, b) => new Date(a.entrou_em).getTime() - new Date(b.entrou_em).getTime());

  if (jogadoresDaDupla.length === 0) return "espectador";

  if (duplaVezPrimeiro) {
    if (jogadorId === duplaVezPrimeiro) return "dica-dor";
    return "adivinhador";
  }

  if (jogadoresDaDupla[0]?.id === jogadorId) return "dica-dor";
  return "adivinhador";
}

// ─── Dados dos Jogos (Home) ───────────────────────────────────────────────

export const JOGOS_DISPONIVEIS = [
  {
    id: "adivinhe-palavras",
    nome: "Adivinhe as Palavras",
    descricao: "Dê dicas para seu parceiro adivinhar a palavra antes do tempo acabar!",
    icone: "💬",
    disponivel: true,
    minJogadores: 2,
    maxJogadores: 8,
    cor: "#5B1FA8",
  },
  {
    id: "quem-sou-eu",
    nome: "Quem Sou Eu?",
    descricao: "Descubra quem você é fazendo perguntas de sim ou não!",
    icone: "🎭",
    disponivel: false,
    minJogadores: 2,
    maxJogadores: 10,
    cor: "#0F766E",
  },
  {
    id: "jogo-da-forca",
    nome: "Jogo da Forca",
    descricao: "Adivinhe a palavra letra por letra antes de perder!",
    icone: "✏️",
    disponivel: false,
    minJogadores: 2,
    maxJogadores: 6,
    cor: "#B45309",
  },
  {
    id: "o-impostor",
    nome: "O Impostor",
    descricao: "Descubra quem é o impostor no grupo antes que seja tarde!",
    icone: "🕵️",
    disponivel: false,
    minJogadores: 4,
    maxJogadores: 12,
    cor: "#BE123C",
  },
];
