# Discord API — Perfil estilo Zany

API Node.js que busca informações de perfil do Discord (boost, nitro, insígnias, embed pronto) usando `discord.js-selfbot-v13`.

## Rotas

| Rota | Descrição |
|------|-----------|
| `GET /` | Status e lista de rotas |
| `GET /user/:userId` | Perfil completo (recomendado) |
| `GET /userProfileCard/:userId` | Mesmo perfil |
| `GET /userFullInfo/:userId` | Perfil + presença/atividades |

**Query params:** `guildId`, `views`

## Local

```bash
cp .env.example .env
# Edite o .env com seus tokens
npm install
npm start
```

Acesse: `http://localhost:3000/user/ID_DO_USUARIO`

## Subir no GitHub

```powershell
# 1. Crie repo vazio em https://github.com/new (nome: discordapi)
# 2. Edite push-github.ps1 com seu username
# 3. Execute:
.\push-github.ps1
```

Ou manualmente:

```bash
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/discordapi.git
git push -u origin main
```

## Deploy no Render (grátis)

1. Faça fork ou suba este repo no GitHub
2. Acesse [render.com](https://render.com) → **New +** → **Blueprint**
3. Conecte o repositório GitHub
4. O Render detecta o `render.yaml` automaticamente
5. Configure as variáveis secretas no painel:
   - `DISCORD_TOKEN` — token da conta (selfbot)
   - `GUILD_ID` — ID do servidor
   - `DISCORD_BOT_TOKEN` — opcional
6. Clique em **Apply** e aguarde o deploy

URL final: `https://discordapi.onrender.com/user/ID`

> **Nota:** O plano grátis do Render coloca o serviço em sleep após inatividade (~15 min). A primeira requisição pode demorar ~30s para acordar.

## Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DISCORD_TOKEN` | Sim | Token da conta de usuário |
| `GUILD_ID` | Sim | ID do servidor padrão |
| `DISCORD_BOT_TOKEN` | Não | Token de bot (rota básica) |
| `PORT` | Não | Render define automaticamente |
| `BOOST_EMOJI_1`…`9` | Não | Emojis customizados por nível |

## Aviso

Selfbots violam os Termos de Serviço do Discord. Use por sua conta e risco.
