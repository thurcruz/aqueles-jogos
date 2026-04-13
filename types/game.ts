// ─── Tipos do Banco de Dados ───────────────────────────────────────────────

export type StatusSala = "aguardando" | "jogando" | "encerrada";
export type StatusRodada = "ativa" | "acertou" | "errou" | "tempo";
export type TipoEvento = "dica" | "acertou" | "ponto" | "proximo" | "timer" | "iniciar" | "fim";
export type Dificuldade = 1 | 2 | 3;
export type Dupla = 1 | 2;

export interface ConfigSala {
  rodadas: number;
  tempo_por_rodada: number;
}

export interface Sala {
  id: string;
  codigo: string;
  status: StatusSala;
  host_id: string;
  jogo: string;
  config: ConfigSala;
  rodada_atual: number;
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
  dificuldade: Dificuldade;
}

export interface Rodada {
  id: string;
  sala_id: string;
  numero: number;
  palavra_id: string;
  dupla_vez: Dupla;
  status: StatusRodada;
  iniciou_em: string | null;
  encerrou_em: string | null;
}

export interface RodadaComPalavra extends Rodada {
  palavras: Palavra;
}

export interface Evento {
  id: string;
  sala_id: string;
  tipo: TipoEvento;
  payload: Record<string, unknown>;
  criado_em: string;
}

// ─── Tipos de Estado do Jogo ───────────────────────────────────────────────

export type PapelJogador = "dica-dor" | "adivinhador" | "espectador";

export interface EstadoJogo {
  sala: Sala | null;
  jogadores: Jogador[];
  rodadaAtual: RodadaComPalavra | null;
  eventos: Evento[];
  papelLocal: PapelJogador;
  jogadorLocal: Jogador | null;
}

export interface PlacarDupla {
  dupla: Dupla;
  pontos: number;
  jogadores: Jogador[];
}

export interface ResultadoRodada {
  acertou: boolean;
  dupla: Dupla;
  palavra: string;
  pontos_ganhos: number;
}

// ─── Tipos de Lobby ────────────────────────────────────────────────────────

export interface FormCriarSala {
  apelido: string;
  rodadas: number;
  tempo_por_rodada: number;
}

export interface FormEntrarSala {
  apelido: string;
  codigo: string;
}

export interface DadosLocais {
  apelido: string;
  sala_id: string;
  jogador_id: string;
  codigo_sala: string;
}

// ─── Tipos de Realtime ────────────────────────────────────────────────────

export interface PayloadDica {
  dica: string;
  numero: number;
  jogador_id: string;
  apelido: string;
}

export interface PayloadPonto {
  dupla: Dupla;
  jogador_id: string;
  apelido: string;
  palavra: string;
}

export interface PayloadTimer {
  tempo_restante: number;
  rodada_id: string;
}

export interface PayloadProximo {
  proxima_dupla: Dupla;
  rodada_numero: number;
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
  cor: string;
}
