# Aqueles Jogos — Setup Guide

## 1. Instalar dependências

```bash
cd aqueles-jogos
npm install
```

## 2. Configurar Supabase

### Criar projeto
1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Clique em **New Project**, escolha um nome e senha
3. Aguarde o projeto ser criado (~1 minuto)

### Executar o schema
1. No painel do Supabase, vá em **SQL Editor**
2. Cole e execute o conteúdo de `supabase/schema.sql`
3. Cole e execute o conteúdo de `supabase/seed.sql`

### Habilitar Realtime
1. Vá em **Database > Replication** (ou **Realtime**)
2. Habilite as tabelas: `salas`, `jogadores`, `rodadas`, `eventos`

### Copiar as chaves
1. Vá em **Settings > API**
2. Copie a **Project URL** e a **anon public key**

## 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 4. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## 5. Build para produção

```bash
npm run build
npm start
```

## 6. Deploy na Vercel

### Via CLI
```bash
npm i -g vercel
vercel
```

### Via GitHub
1. Faça push do código para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com) e importe o repositório
3. Configure as variáveis de ambiente no painel da Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (URL do seu deploy, ex: `https://aquelesjogos.vercel.app`)
4. Clique em **Deploy**

## Estrutura de URLs

| URL | Descrição |
|-----|-----------|
| `/` | Hub de jogos (Home) |
| `/lobby` | Criar ou entrar em sala |
| `/lobby?aba=entrar` | Direto para entrar em sala |
| `/lobby?codigo=AJ-XXXX` | Entrar com código pré-preenchido |
| `/sala/AJ-XXXX` | Sala de espera |
| `/jogo/adivinhe-palavras/AJ-XXXX` | Jogo em andamento |
| `/jogo/adivinhe-palavras/AJ-XXXX/placar` | Placar para TV (QR Code) |

## Dicas para as gravações

- **Host** cria a sala pelo `/lobby` e compartilha o código
- **Jogadores** escaneiam o QR Code ou digitam o código
- **Placar na TV**: abra `/jogo/adivinhe-palavras/AJ-XXXX/placar` no telão
- O placar atualiza em tempo real sem precisar recarregar
