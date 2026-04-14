import { createClient } from "@supabase/supabase-js";
import type {
  Sala,
  Jogador,
  Palavra,
  Evento,
} from "@/types/game";

// Fallback vazio evita crash durante o build estático do Next.js.
// Os valores reais vêm das env vars configuradas na Vercel.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Tipos do banco ────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      salas: { Row: Sala; Insert: Omit<Sala, "id" | "criado_em">; Update: Partial<Sala> };
      jogadores: { Row: Jogador; Insert: Omit<Jogador, "id" | "entrou_em">; Update: Partial<Jogador> };
      palavras: { Row: Palavra; Insert: Omit<Palavra, "id">; Update: Partial<Palavra> };

      eventos: { Row: Evento; Insert: Omit<Evento, "id" | "criado_em">; Update: Partial<Evento> };
    };
  };
}

// ─── Helpers de Sala ──────────────────────────────────────────────────────

export async function buscarSalaPorCodigo(codigo: string) {
  const { data, error } = await supabase
    .from("salas")
    .select("*")
    .eq("codigo", codigo.toUpperCase())
    .single();

  if (error) throw error;
  return data as Sala;
}

export async function criarSala(
  hostId: string,
  config: { rodadas: number; tempo_por_rodada: number }
): Promise<Sala> {
  const codigo = gerarCodigoSala();

  const { data, error } = await supabase
    .from("salas")
    .insert({
      codigo,
      host_id: hostId,
      status: "aguardando",
      jogo: "adivinhe-palavras",
      config,
      rodada_atual: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Sala;
}

export async function atualizarStatusSala(
  salaId: string,
  status: "aguardando" | "jogando" | "encerrada"
) {
  const { error } = await supabase
    .from("salas")
    .update({ status })
    .eq("id", salaId);

  if (error) throw error;
}

// ─── Helpers de Jogador ───────────────────────────────────────────────────

export async function entrarNaSala(
  salaId: string,
  apelido: string,
  dupla: 1 | 2 = 1
): Promise<Jogador> {
  const { data, error } = await supabase
    .from("jogadores")
    .insert({
      sala_id: salaId,
      apelido,
      dupla,
      pontos: 0,
      ativo: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Jogador;
}

export async function buscarJogadoresDaSala(salaId: string): Promise<Jogador[]> {
  const { data, error } = await supabase
    .from("jogadores")
    .select("*")
    .eq("sala_id", salaId)
    .eq("ativo", true)
    .order("entrou_em", { ascending: true });

  if (error) throw error;
  return (data as Jogador[]) || [];
}

export async function trocarDupla(jogadorId: string, dupla: 1 | 2) {
  const { error } = await supabase
    .from("jogadores")
    .update({ dupla })
    .eq("id", jogadorId);

  if (error) throw error;
}

export async function sairDaSala(jogadorId: string) {
  const { error } = await supabase
    .from("jogadores")
    .update({ ativo: false })
    .eq("id", jogadorId);

  if (error) throw error;
  limparDadosLocais();
}

export async function adicionarPontos(jogadorId: string, pontos: number) {
  const { data: jogador } = await supabase
    .from("jogadores")
    .select("pontos")
    .eq("id", jogadorId)
    .single();

  if (!jogador) return;

  const { error } = await supabase
    .from("jogadores")
    .update({ pontos: jogador.pontos + pontos })
    .eq("id", jogadorId);

  if (error) throw error;
}


// ─── Helpers de Palavras ──────────────────────────────────────────────────

export async function buscarPalavrasAleatorias(quantidade: number): Promise<Palavra[]> {
  const { data, error } = await supabase
    .from("palavras")
    .select("*")
    .order("id");

  if (error) throw error;

  const palavras = data as Palavra[];
  const embaralhadas = palavras.sort(() => Math.random() - 0.5);
  return embaralhadas.slice(0, quantidade);
}

// ─── Helpers de Eventos ───────────────────────────────────────────────────

export async function publicarEvento(
  salaId: string,
  tipo: string,
  payload: Record<string, unknown>
) {
  const { error } = await supabase
    .from("eventos")
    .insert({ sala_id: salaId, tipo, payload });

  if (error) throw error;
}

export async function buscarEventosDaRodada(
  salaId: string,
  limite = 50
): Promise<Evento[]> {
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .eq("sala_id", salaId)
    .order("criado_em", { ascending: false })
    .limit(limite);

  if (error) throw error;
  return ((data as Evento[]) || []).reverse();
}

// ─── Utilidades ───────────────────────────────────────────────────────────

export function gerarCodigoSala(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "AJ-";
  for (let i = 0; i < 4; i++) {
    codigo += chars[Math.floor(Math.random() * chars.length)];
  }
  return codigo;
}

export function gerarHostId(): string {
  return "host-" + Math.random().toString(36).substring(2, 11);
}

export function salvarDadosLocais(dados: {
  apelido: string;
  sala_id: string;
  jogador_id: string;
  codigo_sala: string;
}) {
  if (typeof window === "undefined") return;
  localStorage.setItem("aj_dados", JSON.stringify(dados));
}

export function carregarDadosLocais() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("aj_dados");
    if (!raw) return null;
    return JSON.parse(raw) as {
      apelido: string;
      sala_id: string;
      jogador_id: string;
      codigo_sala: string;
    };
  } catch {
    return null;
  }
}

export function limparDadosLocais() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("aj_dados");
}
