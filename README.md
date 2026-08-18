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
cd c:\Users\Saddam57\Downloads\discordapi
.\push-github.ps1
```

## Deploy no Render (grátis)

1. Acesse [render.com](https://render.com) → **New +** → **Blueprint**
2. Conecte o repositório `dghackingcybers/discordapi`
3. O Render detecta o `render.yaml` automaticamente
4. Configure as variáveis secretas no painel:
   - `DISCORD_TOKEN` — token da conta (selfbot)
   - `GUILD_ID` — ID do servidor
   - `DISCORD_BOT_TOKEN` — opcional
5. Clique em **Apply** e aguarde o deploy

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

## Bot Discord (/userinfo)

Comando slash com embed estilo Zany + menus dropdown, usando a API do Render.

### 1. Ative no Discord Developer Portal

- [discord.com/developers/applications](https://discord.com/developers/applications)
- Seu bot → **Bot** → ative **Message Content Intent** (se necessário)
- **OAuth2** → URL Generator → scopes: `bot`, `applications.commands`
- Permissão: **Send Messages**, **Embed Links**
- Ative **Server Members Intent** (para listar membros no menu)

### 2. Configure o `.env`

```env
DISCORD_BOT_TOKEN=token_do_bot
CLIENT_ID=id_do_bot
GUILD_ID=id_do_servidor
API_URL=https://discordapi-jzd1.onrender.com
```

### 3. Registre o comando e inicie o bot

```bash
npm run deploy-commands
npm run bot
```

### 4. Use no Discord

```
/userinfo
/userinfo usuario:@membro
```

Menus disponíveis:
- **Mais informações** → Avatar, Banner, Boost, Nitro, Bio
- **Ver outros membros** → troca o perfil exibido

---

## Aviso

Selfbots violam os Termos de Serviço do Discord. Use por sua conta e risco.
