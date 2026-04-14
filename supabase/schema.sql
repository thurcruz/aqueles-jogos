-- ============================================================
--  AQUELES JOGOS — Schema v2
--  Execute no SQL Editor do Supabase
-- ============================================================

-- Salas de jogo
create table if not exists salas (
  id uuid default gen_random_uuid() primary key,
  codigo text unique not null,
  status text default 'aguardando' check (status in ('aguardando', 'jogando', 'encerrada')),
  host_id text not null,
  jogo text default 'adivinhe-palavras',
  -- config: { modo: '1v1'|'2v2', num_palavras: 5..10 }
  config jsonb default '{"modo": "2v2", "num_palavras": 7}',
  palavra_atual_idx int default 0,
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

-- Palavras do jogo (com dicas pré-definidas para o modo 1v1 bot)
create table if not exists palavras (
  id uuid default gen_random_uuid() primary key,
  categoria text not null,
  palavra text not null,
  dicas text[] default '{}',   -- dicas do bot para modo 1v1
  dificuldade int default 1 check (dificuldade in (1, 2, 3))
);

-- Eventos em tempo real (dicas, acertos, próxima palavra, etc.)
create table if not exists eventos (
  id uuid default gen_random_uuid() primary key,
  sala_id uuid references salas(id) on delete cascade,
  tipo text not null check (tipo in (
    'iniciar', 'dica', 'dica_bot', 'palpite',
    'acertou', 'passou', 'proxima_palavra', 'fim'
  )),
  payload jsonb default '{}',
  criado_em timestamp with time zone default now()
);

-- ─── Índices ──────────────────────────────────────────────────────────────
create index if not exists idx_salas_codigo on salas(codigo);
create index if not exists idx_jogadores_sala_id on jogadores(sala_id);
create index if not exists idx_eventos_sala_id on eventos(sala_id);
create index if not exists idx_eventos_tipo on eventos(tipo);
create index if not exists idx_palavras_categoria on palavras(categoria);

-- ─── Row Level Security ───────────────────────────────────────────────────
alter table salas enable row level security;
alter table jogadores enable row level security;
alter table palavras enable row level security;
alter table eventos enable row level security;

create policy "Salas públicas"    on salas    for all using (true) with check (true);
create policy "Jogadores públicos" on jogadores for all using (true) with check (true);
create policy "Palavras públicas"  on palavras  for select using (true);
create policy "Eventos públicos"   on eventos   for all using (true) with check (true);

-- ─── Habilitar Realtime ───────────────────────────────────────────────────
alter publication supabase_realtime add table salas;
alter publication supabase_realtime add table jogadores;
alter publication supabase_realtime add table eventos;
