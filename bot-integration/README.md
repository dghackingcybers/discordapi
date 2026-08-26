# Integração no seu bot (CommonJS)

Copie os arquivos desta pasta para o seu projeto de bot:

```
bot-integration/utils/userinfo.js      →  seu-bot/utils/userinfo.js
bot-integration/utils/avatarHistory.js →  seu-bot/utils/avatarHistory.js
bot-integration/commands/userinfo.js     →  seu-bot/commands/userinfo.js
```

## 1. Config (`config.js`)

Adicione:

```js
apiUrl: process.env.API_URL || 'https://discordapi-jzd1.onrender.com',
guildId: process.env.GUILD_ID || '1173357091721851001',
```

## 2. Emojis do servidor (Render + .env da API)

Configure no **Render → discordapi → Environment**:

```env
BOOST_EMOJI_1=<:nome:ID>
...
BOOST_EMOJI_9=<:nome:ID>
NITRO_EMOJI_1=<:nome:ID>
...
NITRO_EMOJI_8=<:nome:ID>
```

A API monta o embed com esses emojis. O bot só consome a API.

## 3. Handler de menus (interactionCreate)

No seu `interactionCreate`:

```js
const userinfoCmd = require('./commands/userinfo');

client.on('interactionCreate', async (interaction) => {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'ui_member' || interaction.customId.startsWith('ui_more:')) {
      return userinfoCmd.handleUserinfoSelect(interaction);
    }
  }

  // ... resto dos seus handlers
});
```

## 4. Intents

Ative **Server Members Intent** no Developer Portal.

## 5. Node 18+

O `fetch` nativo é usado para chamar a API.
