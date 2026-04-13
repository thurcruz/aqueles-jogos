-- ============================================================
--  AQUELES JOGOS — Schema do Banco de Dados
--  Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- Salas de jogo
create table if not exists salas (
  id uuid default gen_random_uuid() primary key,
  codigo text unique not null,
  status text default 'aguardando' check (status in ('aguardando', 'jogando', 'encerrada')),
  host_id text not null,
  jogo text default 'adivinhe-palavras',
  config jsonb default '{"rodadas": 5, "tempo_por_rodada": 60}',
  rodada_atual int default 0,
  criado_em timestamp with time zone default now()
);

-- Jogadores em cada sala
create table if not exists jogadores (
  id uuid default gen_random_uuid() primary key,
  sala_id uuid references salas(id) on delete cascade,
  apelido text not null,
  dupla int default 1 check (dupla in (1, 2)),
  pontos int default 0,
  ativo boolean default true,
  entrou_em timestamp with time zone default now()
);

-- Palavras do jogo
create table if not exists palavras (
  id uuid default gen_random_uuid() primary key,
  categoria text not null,
  palavra text not null,
  dificuldade int default 1 check (dificuldade in (1, 2, 3))
);

-- Rodadas de cada partida
create table if not exists rodadas (
  id uuid default gen_random_uuid() primary key,
  sala_id uuid references salas(id) on delete cascade,
  numero int not null,
  palavra_id uuid references palavras(id),
  dupla_vez int not null check (dupla_vez in (1, 2)),
  status text default 'ativa' check (status in ('ativa', 'acertou', 'errou', 'tempo')),
  iniciou_em timestamp with time zone,
  encerrou_em timestamp with time zone
);

-- Eventos em tempo real
create table if not exists eventos (
  id uuid default gen_random_uuid() primary key,
  sala_id uuid references salas(id) on delete cascade,
  tipo text not null check (tipo in ('dica', 'acertou', 'ponto', 'proximo', 'timer', 'iniciar', 'fim')),
  payload jsonb default '{}',
  criado_em timestamp with time zone default now()
);

-- ─── Índices ──────────────────────────────────────────────────────────────

create index if not exists idx_salas_codigo on salas(codigo);
create index if not exists idx_jogadores_sala_id on jogadores(sala_id);
create index if not exists idx_rodadas_sala_id on rodadas(sala_id);
create index if not exists idx_eventos_sala_id on eventos(sala_id);
create index if not exists idx_eventos_tipo on eventos(tipo);
create index if not exists idx_palavras_categoria on palavras(categoria);

-- ─── Row Level Security ───────────────────────────────────────────────────

alter table salas enable row level security;
alter table jogadores enable row level security;
alter table palavras enable row level security;
alter table rodadas enable row level security;
alter table eventos enable row level security;

-- Políticas permissivas (sem autenticação obrigatória)
-- Em produção, considere restringir estas políticas

create policy "Salas são públicas" on salas for all using (true) with check (true);
create policy "Jogadores são públicos" on jogadores for all using (true) with check (true);
create policy "Palavras são públicas" on palavras for select using (true);
create policy "Rodadas são públicas" on rodadas for all using (true) with check (true);
create policy "Eventos são públicos" on eventos for all using (true) with check (true);

-- ─── Habilitar Realtime ───────────────────────────────────────────────────
-- Execute estes comandos no SQL Editor ou na aba Realtime do Supabase

alter publication supabase_realtime add table salas;
alter publication supabase_realtime add table jogadores;
alter publication supabase_realtime add table rodadas;
alter publication supabase_realtime add table eventos;
