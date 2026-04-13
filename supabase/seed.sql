-- ============================================================
--  AQUELES JOGOS — Seed de Palavras
--  Execute após o schema.sql
-- ============================================================

-- ─── Filmes e Séries (10 palavras) ───────────────────────────────────────

insert into palavras (categoria, palavra, dificuldade) values
  ('filmes e séries', 'Vingadores', 1),
  ('filmes e séries', 'Titanic', 1),
  ('filmes e séries', 'Homem-Aranha', 1),
  ('filmes e séries', 'Harry Potter', 2),
  ('filmes e séries', 'Stranger Things', 2),
  ('filmes e séries', 'La Casa de Papel', 2),
  ('filmes e séries', 'Round 6', 2),
  ('filmes e séries', 'Shrek', 1),
  ('filmes e séries', 'Divertidamente', 1),
  ('filmes e séries', 'De Volta para o Futuro', 3);

-- ─── Celebridades Brasileiras (10 palavras) ──────────────────────────────

insert into palavras (categoria, palavra, dificuldade) values
  ('celebridades', 'Neymar', 1),
  ('celebridades', 'Ivete Sangalo', 1),
  ('celebridades', 'Xuxa', 1),
  ('celebridades', 'Anitta', 1),
  ('celebridades', 'Lula', 2),
  ('celebridades', 'Pelé', 1),
  ('celebridades', 'Whindersson Nunes', 2),
  ('celebridades', 'MC Cabelinho', 2),
  ('celebridades', 'Gkay', 2),
  ('celebridades', 'Faustão', 2);

-- ─── Animais (10 palavras) ────────────────────────────────────────────────

insert into palavras (categoria, palavra, dificuldade) values
  ('animais', 'Elefante', 1),
  ('animais', 'Girafa', 1),
  ('animais', 'Tubarão', 1),
  ('animais', 'Pinguim', 1),
  ('animais', 'Camelo', 2),
  ('animais', 'Ornitorrinco', 3),
  ('animais', 'Axolote', 3),
  ('animais', 'Capivara', 2),
  ('animais', 'Lagarto', 2),
  ('animais', 'Flamingo', 2);
