# ClipAI

Transforme vídeos longos em clipes virais com IA. Powered by GPT-4o + Whisper + FFmpeg.

## Como funciona

1. Faça upload de um vídeo (MP4, WebM, MOV, AVI) ou cole um link do YouTube
2. A IA transcreve o áudio com Whisper e analisa os melhores momentos com GPT-4o
3. Selecione os clipes sugeridos e baixe em formato vertical (9:16) com legendas automáticas

## Stack

- **Frontend/Backend:** Next.js 14 (App Router)
- **Transcrição:** OpenAI Whisper
- **Análise viral:** GPT-4o
- **Processamento de vídeo:** FFmpeg via fluent-ffmpeg
- **Download YouTube:** yt-dlp
- **Deploy:** Vercel

## Setup local

### Pré-requisitos

- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) instalado e no PATH (para links do YouTube)
- Chave da API OpenAI

### Instalação

```bash
git clone https://github.com/SEU_USUARIO/clipai.git
cd clipai
npm install
cp .env.example .env.local
```

Edite `.env.local` e adicione sua chave OpenAI:

```
OPENAI_API_KEY=sk-...
```

### Rodar localmente

```bash
npm run dev
```

Acesse `http://localhost:3000`

## Deploy na Vercel

### 1. Criar repositório no GitHub

```bash
git init
git add .
git commit -m "feat: initial ClipAI setup"
git remote add origin https://github.com/SEU_USUARIO/clipai.git
git push -u origin main
```

### 2. Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **"Add New Project"**
3. Importe o repositório `clipai`
4. Em **Environment Variables**, adicione:
   - `OPENAI_API_KEY` = sua chave da OpenAI
5. Clique em **Deploy**

> **Nota:** O plano gratuito da Vercel tem limite de 10s por função serverless. Para vídeos longos, use o plano Pro (timeout de 300s) ou rode localmente.

### Alternativa: Cloudflare Pages

```bash
npm install -g wrangler
wrangler pages deploy .next
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `OPENAI_API_KEY` | Sim | Chave da API OpenAI |
| `TMP_DIR` | Não | Diretório para arquivos temporários |

## Limitações

- Vídeos precisam ter pelo menos 1 minuto de duração
- Tamanho máximo de upload: 500MB
- Links do YouTube requerem `yt-dlp` instalado no servidor
- Na Vercel free tier, funções têm timeout de 10s (use Pro para vídeos longos)

## Custo estimado por análise

| Serviço | Custo |
|---------|-------|
| Whisper (transcrição) | ~$0.006/min de áudio |
| GPT-4o (análise) | ~$0.01 por análise |
| **Total** | **~$0.02 por vídeo** |
