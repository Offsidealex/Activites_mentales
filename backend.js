/* Activités Mentales - client d'authentification élève.
   Les mots de passe sont traités uniquement par Supabase Auth. */
(function () {
  "use strict";

  const SUPABASE_URL = "https://hxfdlujpedxuumqfewvn.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmRsdWpwZWR4dXVtcWZld3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjcyMzAsImV4cCI6MjA5NzcwMzIzMH0.mM0xBhLGWG3vDgE06bEla8b4BhH7v6dvZ-BWn4ZOP0Q";
  const CLASS_NAMES = ["3PM", "2TNE1", "2TNE2", "2TNE3", "2REMI1", "2REMI2", "1CAP", "UPE2A"];
  let currentEleve = null;
  let authSession = null;

  function saveSession(session, eleve) {
    authSession = session;
    currentEleve = eleve;
    sessionStorage.setItem("am_auth_session", JSON.stringify(session));
    sessionStorage.setItem("am_eleve", JSON.stringify(eleve));
  }

  function loadEleve() {
    if (currentEleve) return currentEleve;
    try {
      const session = JSON.parse(sessionStorage.getItem("am_auth_session"));
      const eleve = JSON.parse(sessionStorage.getItem("am_eleve"));
      if (session && eleve && session.expires_at * 1000 > Date.now()) {
        authSession = session;
        currentEleve = eleve;
      }
    } catch (e) {}
    return currentEleve;
  }

  async function studentAuth(action, pseudo, classe, password) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/student-auth`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ action, pseudo, classe, password })
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || "Connexion impossible.");
    saveSession(result.session, result.eleve);
    await loadMenuScores();
    document.dispatchEvent(new Event("am:login"));
  }

  async function sbQuery(table, method, body, params) {
    const eleve = loadEleve();
    if (!eleve || !authSession) throw new Error("Connexion élève requise.");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params || ""}`, {
      method: method || "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${authSession.access_token}`,
        "Content-Type": "application/json",
        Prefer: method === "POST" ? "return=representation" : ""
      },
      body: body ? JSON.stringify(body) : null
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async function sendSession(data) {
    const eleve = loadEleve();
    if (!eleve) return null;
    try {
      const sessions = await sbQuery("sessions", "POST", {
        eleve_id: eleve.id,
        exercice: data.exercice,
        score: data.score,
        nb_questions: data.nb_questions,
        duree_totale_ms: data.duree_totale_ms || null
      }, "?select=id");
      if (data.reponses && data.reponses.length) {
        await sbQuery("reponses", "POST", data.reponses.map(function (reponse) {
          return { ...reponse, session_id: sessions[0].id, temps_ms: reponse.temps_ms || null };
        }));
      }
      document.dispatchEvent(new Event("am:session-saved"));
      return sessions[0].id;
    } catch (error) {
      console.error("[AM] Enregistrement impossible :", error);
      return null;
    }
  }

  function loadLocalScores() {
    try { return JSON.parse(localStorage.getItem("am_best_scores") || "{}"); }
    catch (e) { return {}; }
  }

  function saveScore(exercice, score, nbQuestions) {
    if (!exercice || !nbQuestions) return;
    const scores = loadLocalScores();
    const pct = Math.round(score / nbQuestions * 100);
    if (!scores[exercice] || pct > scores[exercice].pct) {
      scores[exercice] = { score: score, nb_questions: nbQuestions, pct: pct };
      localStorage.setItem("am_best_scores", JSON.stringify(scores));
    }
  }

  function renderScores(best) {
    document.querySelectorAll(".card[data-module]").forEach(function (card) {
      const result = best[card.dataset.module];
      if (!result) return;
      card.querySelector(".score-badge").innerHTML = `<span style="color:var(--muted);font-weight:700;font-size:.7rem">Meilleur</span><span style="color:var(--accent);font-weight:800;font-size:.78rem">${result.score}/${result.nb_questions} ${result.pct}%</span>`;
    });
  }

  async function loadMenuScores() {
    const localBest = loadLocalScores();
    renderScores(localBest);
    const eleve = loadEleve();
    if (!eleve || !authSession) return;
    try {
      const sessions = await sbQuery("sessions", "GET", null, `?eleve_id=eq.${eleve.id}&select=exercice,score,nb_questions`);
      const best = {};
      sessions.forEach(function (session) {
        const pct = Math.round(session.score / session.nb_questions * 100);
        if (!best[session.exercice] || pct > best[session.exercice].pct) best[session.exercice] = { ...session, pct };
      });
      renderScores({ ...localBest, ...best });
    } catch (error) {
      console.warn("[AM] Scores indisponibles :", error);
    }
  }

  function openLogin() {
    if (document.getElementById("aml-overlay")) return;
    const options = CLASS_NAMES.map(function (classe) { return `<option value="${classe}">${classe}</option>`; }).join("");
    const overlay = document.createElement("div");
    overlay.id = "aml-overlay";
    overlay.innerHTML = `<div class="aml-card" role="dialog" aria-modal="true" aria-labelledby="aml-title">
      <button class="aml-close" type="button" aria-label="Fermer">×</button>
      <div class="aml-logo">🏫</div><h2 id="aml-title">Connexion élève</h2>
      <p class="aml-sub">Connecte-toi ou crée ton compte.</p>
      <label for="aml-pseudo">Pseudo</label><input id="aml-pseudo" maxlength="30" autocomplete="username" placeholder="ex : alexis.r">
      <label for="aml-class">Classe</label><select id="aml-class">${options}</select>
      <label for="aml-password">Mot de passe</label><input id="aml-password" type="password" minlength="8" autocomplete="current-password" placeholder="8 caractères minimum">
      <p id="aml-error" class="aml-error"></p>
      <button id="aml-login" class="aml-primary" type="button">Se connecter</button>
      <button id="aml-register" class="aml-secondary" type="button">Créer mon compte</button>
    </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    const pseudo = overlay.querySelector("#aml-pseudo");
    const password = overlay.querySelector("#aml-password");
    const error = overlay.querySelector("#aml-error");
    const buttons = overlay.querySelectorAll("button");

    async function submit(action) {
      error.textContent = "";
      buttons.forEach(function (button) { button.disabled = true; });
      try {
        await studentAuth(action, pseudo.value.trim(), overlay.querySelector("#aml-class").value, password.value);
        document.body.style.overflow = "";
        overlay.remove();
      } catch (exception) {
        error.textContent = exception.message;
        buttons.forEach(function (button) { button.disabled = false; });
      }
    }

    overlay.querySelector(".aml-close").onclick = function () { document.body.style.overflow = ""; overlay.remove(); };
    overlay.querySelector("#aml-login").onclick = function () { submit("login"); };
    overlay.querySelector("#aml-register").onclick = function () { submit("register"); };
    password.addEventListener("keydown", function (event) { if (event.key === "Enter") submit("login"); });
    pseudo.focus();
  }


  // Espace personnel élève : seules les sessions du compte authentifié sont lues (RLS).
  function escapeText(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function updateStudentHeader() {
    const button = document.querySelector(".login-btn");
    if (!button) return;
    const eleve = loadEleve();
    button.textContent = eleve ? "👤 " + (eleve.prenom || "Mon espace") + " · Mes résultats" : "Connexion";
    button.onclick = eleve ? openStudentDrawer : openLogin;
    button.setAttribute("aria-label", eleve ? "Ouvrir mon tableau de bord" : "Connexion élève");
  }
  function closeStudentDrawer() {
    document.getElementById("am-student-shade")?.remove();
    document.getElementById("am-student-drawer")?.remove();
    document.body.style.overflow = "";
  }
  function logoutStudent() {
    closeStudentDrawer();
    authSession = null;
    currentEleve = null;
    sessionStorage.removeItem("am_auth_session");
    sessionStorage.removeItem("am_eleve");
    updateStudentHeader();
    document.dispatchEvent(new Event("am:logout"));
  }
  async function refreshStudentDrawer() {
    const content = document.getElementById("am-student-results");
    const eleve = loadEleve();
    if (!content || !eleve) return;
    content.textContent = "Chargement de tes résultats…";
    try {
      const sessions = await sbQuery("sessions", "GET", null,
        "?eleve_id=eq." + encodeURIComponent(eleve.id) +
        "&select=exercice,score,nb_questions,created_at&order=created_at.desc&limit=200");
      if (!document.getElementById("am-student-results")) return;
      if (!sessions.length) {
        content.innerHTML = '<p class="am-empty">Aucun résultat pour le moment. Termine un exercice pour voir ta progression ici !</p>';
        return;
      }
      const valid = sessions.filter(x => Number(x.nb_questions) > 0);
      const total = valid.length;
      const average = total ? Math.round(valid.reduce((sum,x) => sum + 100 * Number(x.score) / Number(x.nb_questions),0) / total) : 0;
      const best = {};
      valid.forEach(x => {
        const percent = Math.round(100 * Number(x.score) / Number(x.nb_questions));
        if (!best[x.exercice] || percent > best[x.exercice].percent) best[x.exercice] = {percent, score:x.score, questions:x.nb_questions};
      });
      const items = Object.entries(best).sort((a,b) => a[0].localeCompare(b[0],"fr"));
      content.innerHTML = '<div class="am-stats"><div><strong>' + total + '</strong><span>Séries réalisées</span></div><div><strong>' + average + '%</strong><span>Réussite moyenne</span></div><div><strong>' + items.length + '</strong><span>Exercices pratiqués</span></div></div>' +
        '<h3>Mes meilleurs scores</h3>' + items.map(([name,v]) =>
          '<div class="am-result"><div><strong>' + escapeText(name) + '</strong><small>' + v.score + '/' + v.questions + ' · Meilleur score</small></div><b>' + v.percent + '%</b><div class="am-progress"><span style="width:' + Math.max(0,Math.min(100,v.percent)) + '%"></span></div></div>'
        ).join("") +
        '<h3>Mes dernières séances</h3>' + sessions.slice(0,12).map(x => {
          const date = x.created_at ? new Date(x.created_at).toLocaleDateString("fr-FR") : "";
          return '<div class="am-history"><span>' + escapeText(x.exercice) + '<small>' + escapeText(date) + '</small></span><strong>' + Number(x.score) + '/' + Number(x.nb_questions) + '</strong></div>';
        }).join("");
    } catch(error) {
      content.textContent = "Impossible de charger les résultats. Réessaie plus tard.";
      console.warn("[AM] Tableau de bord :",error);
    }
  }
  function openStudentDrawer() {
    const eleve = loadEleve();
    if (!eleve) { openLogin(); return; }
    if (document.getElementById("am-student-drawer")) return;
    const shade = document.createElement("div");
    shade.id = "am-student-shade";
    const drawer = document.createElement("aside");
    drawer.id = "am-student-drawer";
    drawer.setAttribute("role","dialog");
    drawer.setAttribute("aria-modal","true");
    drawer.setAttribute("aria-label","Mes résultats");
    drawer.innerHTML = '<div class="am-drawer-head"><div><small>MON ESPACE ÉLÈVE</small><h2>Bonjour, ' + escapeText(eleve.prenom || "élève") + ' 👋</h2><p>Classe : ' + escapeText(eleve.classe || "") + '</p></div><button id="am-close-drawer" aria-label="Fermer">×</button></div><div id="am-student-results" aria-live="polite"></div><div class="am-drawer-footer"><button id="am-refresh-drawer">↻ Actualiser</button><button id="am-logout">Se déconnecter</button></div>';
    document.body.append(shade,drawer);
    document.body.style.overflow = "hidden";
    shade.onclick = closeStudentDrawer;
    drawer.querySelector("#am-close-drawer").onclick = closeStudentDrawer;
    drawer.querySelector("#am-refresh-drawer").onclick = refreshStudentDrawer;
    drawer.querySelector("#am-logout").onclick = logoutStudent;
    refreshStudentDrawer();
  }
  function initStudentSpace() {
    updateStudentHeader();
    document.addEventListener("am:login",updateStudentHeader);
    document.addEventListener("am:session-saved",() => {
      if (document.getElementById("am-student-drawer")) refreshStudentDrawer();
    });
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `#aml-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(15,23,42,.72);font-family:'Open Sans',sans-serif}.aml-card{position:relative;width:min(100%,400px);display:flex;flex-direction:column;gap:.45rem;padding:2rem;background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.3)}.aml-card h2{text-align:center;color:#0f172a}.aml-logo{text-align:center;font-size:2rem}.aml-sub{text-align:center;color:#64748b;margin:0 0 .8rem}.aml-card label{font-weight:800;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:#334155}.aml-card input,.aml-card select{padding:.75rem;border:1px solid #cbd5e1;border-radius:10px;font:inherit}.aml-primary,.aml-secondary{padding:.8rem;border-radius:10px;font:inherit;font-weight:800;cursor:pointer}.aml-primary{margin-top:.6rem;border:0;background:#1d4ed8;color:#fff}.aml-secondary{border:1px solid #1d4ed8;background:#fff;color:#1d4ed8}.aml-close{position:absolute;right:.7rem;top:.45rem;border:0;background:transparent;font-size:1.7rem;cursor:pointer;color:#64748b}.aml-error{min-height:1.2rem;color:#b91c1c;text-align:center;font-size:.82rem;font-weight:700}`;
    style.textContent += `#am-student-shade{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99996}#am-student-drawer{position:fixed;right:0;top:0;bottom:0;width:min(100%,440px);background:#f8fafc;z-index:99997;box-shadow:-15px 0 45px #0f172a30;display:flex;flex-direction:column;font-family:'Open Sans',sans-serif;color:#0f172a;animation:am-slide .2s ease-out}@keyframes am-slide{from{transform:translateX(100%)}to{transform:translateX(0)}}.am-drawer-head{background:#1d4ed8;color:white;padding:26px 24px;display:flex;justify-content:space-between;gap:10px}.am-drawer-head small{font-weight:800;letter-spacing:.12em;opacity:.85}.am-drawer-head h2{font-size:1.45rem;margin:10px 0 4px}.am-drawer-head p{opacity:.85}.am-drawer-head button{align-self:start;border:0;background:#ffffff2c;color:white;border-radius:10px;font-size:1.6rem;padding:2px 12px;cursor:pointer}#am-student-results{padding:22px;overflow-y:auto;flex:1}.am-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.am-stats>div{background:white;border:1px solid #dbe4f1;border-radius:12px;padding:12px 6px;text-align:center}.am-stats strong{display:block;color:#1d4ed8;font-size:1.4rem}.am-stats span{font-size:.67rem;color:#64748b}.am-result,.am-history{background:white;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin:9px 0;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.am-result strong,.am-history span{font-size:.85rem}.am-result small,.am-history small{display:block;font-size:.7rem;color:#64748b;margin-top:4px}.am-result b{color:#1d4ed8}.am-progress{width:100%;height:7px;background:#e2e8f0;border-radius:8px;overflow:hidden}.am-progress span{display:block;height:100%;background:#2563eb}#am-student-results h3{margin:24px 0 12px;font-size:1rem}.am-drawer-footer{display:flex;gap:10px;padding:16px 22px;background:white;border-top:1px solid #e2e8f0}.am-drawer-footer button{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:12px 4px;background:white;cursor:pointer;font-weight:700}.am-drawer-footer #am-logout{color:#b91c1c}.am-empty{background:white;border-radius:12px;padding:20px;line-height:1.6;color:#64748b}`;
    document.head.appendChild(style);
  }

  injectStyles();
  window.loadEleve = loadEleve;
  window.AM = { currentEleve: loadEleve, sendSession, loadMenuScores, openLogin, saveScore, openStudentDrawer, logoutStudent };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ loadMenuScores(); initStudentSpace(); });
  else { loadMenuScores(); initStudentSpace(); }
})();
