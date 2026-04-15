// ─── Tipos do Banco de Dados ───────────────────────────────────────────────

export type StatusSala = "aguardando" | "jogando" | "encerrada";
export type TipoEvento =
  | "iniciar"
  | "dica"
  | "palpite"
  | "acertou"
  | "passou"
  | "proxima_palavra"
  | "dica_bot"
  | "ninguem_acertou"
  | "fim";
export type Dificuldade = 1 | 2 | 3;
export type Dupla = 1 | 2;
export type ModoJogo = "1v1" | "2v2";

export interface ConfigSala {
  modo: ModoJogo;
  num_palavras: number;  // 5–10
  tempo_dica: number;    // segundos para dar dicas (30/45/60/90)
}

export interface Sala {
  id: string;
  codigo: string;
  status: StatusSala;
  host_id: string;
  jogo: string;
  config: ConfigSala;
  palavra_atual_idx: number; // índice da palavra atual na lista
  criado_em: string;
}

export interface Jogador {
  id: string;
  sala_id: string;
  apelido: string;
  dupla: Dupla;
  pontos: number;
  ativo: boolean;
  entrou_em: string;
}

export interface Palavra {
  id: string;
  categoria: string;
  palavra: string;
  dicas: string[]; // dicas pré-definidas para modo 1v1 (bot)
  dificuldade: Dificuldade;
}

export interface Evento {
  id: string;
  sala_id: string;
  tipo: TipoEvento;
  payload: Record<string, unknown>;
  criado_em: string;
}

// ─── Estado do jogo no cliente ────────────────────────────────────────────

/** Qual é o estado de uma palavra durante a partida */
export type EstadoPalavra =
  | "aguardando"       // ainda não começou
  | "dupla1-tentando"  // dupla 1 está dando dicas / tentando
  | "dupla2-tentando"  // dupla 2 está tentando (após dupla 1 errar)
  | "acertou"          // alguém acertou
  | "nenhum-acertou";  // ambos erraram, passou

export interface EstadoPartida {
  palavras: Palavra[];           // lista completa da partida
  palavraAtualIdx: number;       // índice atual
  vez: Dupla;                    // qual dupla pode dar dica agora
  passouParaAdversario: boolean; // dupla 1 errou, dupla 2 tenta
  dicasDadas: string[];          // dicas visíveis na tela
  estadoPalavra: EstadoPalavra;
  // 1v1: índice de qual dica do bot foi revelada
  dicaBotIdx: number;
  // jogadores que já erraram nesta palavra (1v1)
  jaErraram: string[];
}

// ─── Tipos de Lobby ────────────────────────────────────────────────────────

export interface PlacarDupla {
  dupla: Dupla | "jogador";
  label: string;
  pontos: number;
  jogadores: Jogador[];
}

export interface DadosLocais {
  apelido: string;
  sala_id: string;
  jogador_id: string;
  codigo_sala: string;
}

// ─── Jogos disponíveis ────────────────────────────────────────────────────

export interface JogoInfo {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  disponivel: boolean;
  minJogadores: number;
  maxJogadores: number;
}
