function fetchUserData(userId) {
  console.log(`🔍 Buscando dados do usuário ID: ${userId}`);

  fetch(`/userFullInfo/${userId}`)
    .then(response => response.json())
    .then(data => {
      if (data.error || !data.success) {
        console.error("Erro ao buscar dados:", data.error);
        document.getElementById("user-info").innerHTML = `<p style="color: red;">Erro: ${data.error}</p>`;
        return;
      }

      const user = data.data.discord_user;
      const activities = data.data.activities;
      const presence = {
        status: data.data.discord_status,
        web: data.data.active_on_discord_web,
        desktop: data.data.active_on_discord_desktop,
        mobile: data.data.active_on_discord_mobile,
      };

      const userInfoContainer = document.getElementById("user-info");

      let html = `
        <div class="user-card">
          <h2>${user.username}#${user.discriminator}</h2>
          <img src="${user.avatar}" alt="Avatar" style="width: 120px; height: 120px; border-radius: 10px; box-shadow: 0 0 8px #0003;" />

          <p><strong>Nome global:</strong> ${user.global_name}</p>
          <p><strong>Nome de exibição:</strong> ${user.display_name}</p>
          <p><strong>Status:</strong> ${presence.status}</p>
          <p><strong>Plataformas:</strong>
            ${presence.web ? "🟢 Web " : ""}
            ${presence.desktop ? "💻 Desktop " : ""}
            ${presence.mobile ? "📱 Mobile " : ""}
            ${!presence.web && !presence.desktop && !presence.mobile ? "❌ Offline" : ""}
          </p>
          <p><strong>Nitro:</strong> ${user.nitro_status}</p>
          <p><strong>Boost:</strong> ${user.boost_status}</p>
          <p><strong>Boost desde:</strong> ${user.boost_since || "Nenhuma data"}</p>
        </div>
      `;

      if (activities.length > 0) {
        html += `<h3>🎮 Atividades em execução:</h3>`;
        activities.forEach((act, i) => {
          html += `
            <div class="activity">
              <p><strong>${i + 1}. ${act.name}</strong></p>
              <p>Tipo: ${act.type}</p>
              <p>Estado: ${act.state || "Nenhum"}</p>
              <p>Detalhes: ${act.details || "Nenhum"}</p>
              ${act.assets?.large_image ? `<img src="${act.assets.large_image}" style="max-height: 100px;">` : ""}
            </div>
          `;
        });
      } else {
        html += `<p><em>Sem atividades no momento.</em></p>`;
      }

      userInfoContainer.innerHTML = html;
    })
    .catch(error => {
      console.error("Erro ao buscar dados do usuário:", error);
      document.getElementById("user-info").innerHTML = `<p style="color: red;">Erro de conexão com servidor.</p>`;
    });
}

// ID de exemplo
const userId = '233287596812402689';
fetchUserData(userId);
