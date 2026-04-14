-- ============================================================
--  AQUELES JOGOS — Seed de Palavras v2
--  Com dicas pré-definidas para o bot (modo 1v1)
-- ============================================================

-- ─── Filmes e Séries ──────────────────────────────────────────────────────
insert into palavras (categoria, palavra, dicas, dificuldade) values
  ('filmes e séries', 'Vingadores', ARRAY['herói','Marvel','Tony','guerra','super'], 1),
  ('filmes e séries', 'Titanic', ARRAY['navio','gelo','afundou','Leo','amor'], 1),
  ('filmes e séries', 'Homem-Aranha', ARRAY['teia','NY','Peter','aranha','máscara'], 1),
  ('filmes e séries', 'Harry Potter', ARRAY['magia','bruxo','Hogwarts','varinha','escola'], 2),
  ('filmes e séries', 'Stranger Things', ARRAY['Netflix','criança','monstro','anos80','portal'], 2),
  ('filmes e séries', 'La Casa de Papel', ARRAY['máscara','banco','Dalí','roubo','espanhol'], 2),
  ('filmes e séries', 'Round 6', ARRAY['jogo','coreano','morte','boneca','Netflix'], 2),
  ('filmes e séries', 'Shrek', ARRAY['ogro','burro','princesa','pântano','animado'], 1),
  ('filmes e séries', 'Divertidamente', ARRAY['emoção','cabeça','alegria','pixar','sentimento'], 1),
  ('filmes e séries', 'De Volta para o Futuro', ARRAY['DeLorean','tempo','Doc','88','1985'], 3);

-- ─── Celebridades Brasileiras ─────────────────────────────────────────────
insert into palavras (categoria, palavra, dicas, dificuldade) values
  ('celebridades', 'Neymar', ARRAY['futebol','PSG','Brasil','ginga','Santos'], 1),
  ('celebridades', 'Ivete Sangalo', ARRAY['axé','Bahia','carnaval','cantora','Bloco'], 1),
  ('celebridades', 'Xuxa', ARRAY['loira','apresentadora','Globo','crianças','Paquita'], 1),
  ('celebridades', 'Anitta', ARRAY['funk','Rio','cantora','Girl','Baile'], 1),
  ('celebridades', 'Pelé', ARRAY['Rei','Santos','gol','Copa','lenda'], 1),
  ('celebridades', 'Whindersson Nunes', ARRAY['youtuber','Nordeste','humor','viral','Piauí'], 2),
  ('celebridades', 'MC Cabelinho', ARRAY['funk','carioca','rap','tatuagem','música'], 2),
  ('celebridades', 'Gkay', ARRAY['influencer','festança','comédia','Fortaleza','TikTok'], 2),
  ('celebridades', 'Faustão', ARRAY['domingo','Globo','apresentador','plateia','gordo'], 2),
  ('celebridades', 'Lexa', ARRAY['funk','MC','cantora','dança','Rio'], 2);

-- ─── Animais ─────────────────────────────────────────────────────────────
insert into palavras (categoria, palavra, dicas, dificuldade) values
  ('animais', 'Elefante', ARRAY['tromba','África','grande','cinza','barulho'], 1),
  ('animais', 'Girafa', ARRAY['pescoço','África','savana','manchas','alto'], 1),
  ('animais', 'Tubarão', ARRAY['dente','oceano','medo','nada','predador'], 1),
  ('animais', 'Pinguim', ARRAY['gelo','Antártida','preto','branco','nada'], 1),
  ('animais', 'Capivara', ARRAY['Brasil','roedor','rio','manso','internet'], 2),
  ('animais', 'Ornitorrinco', ARRAY['bico','pato','ovíparo','veneno','Austrália'], 3),
  ('animais', 'Axolote', ARRAY['salamandra','México','regenera','fofo','aquático'], 3),
  ('animais', 'Camelo', ARRAY['deserto','corcova','árabe','sede','areia'], 2),
  ('animais', 'Flamingo', ARRAY['rosa','perna','ave','lagoa','cuba'], 2),
  ('animais', 'Lagarto', ARRAY['réptil','sol','escama','cauda','língua'], 2);
