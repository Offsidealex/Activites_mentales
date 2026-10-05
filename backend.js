/* Activités Mentales - client d'authentification élève.
   Les mots de passe sont traités uniquement par Supabase Auth. */
(function () {
  "use strict";

  const SUPABASE_URL = "https://hxfdlujpedxuumqfewvn.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmRsdWpwZWR4dXVtcWZld3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjcyMzAsImV4cCI6MjA5NzcwMzIzMH0.mM0xBhLGWG3vDgE06bEla8b4BhH7v6dvZ-BWn4ZOP0Q";
  const CLASS_NAMES = ["3PM", "2TNE1", "2TNE2", "2TNE3", "2REMI1", "2REMI2", "1CAP"];
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
      return sessions[0].id;
    } catch (error) {
      console.error("[AM] Enregistrement impossible :", error);
      return null;
    }
  }

  async function loadMenuScores() {
    const eleve = loadEleve();
    if (!eleve || !authSession) return;
    try {
      const sessions = await sbQuery("sessions", "GET", null, `?eleve_id=eq.${eleve.id}&select=exercice,score,nb_questions`);
      const best = {};
      sessions.forEach(function (session) {
        const pct = Math.round(session.score / session.nb_questions * 100);
        if (!best[session.exercice] || pct > best[session.exercice].pct) best[session.exercice] = { ...session, pct };
      });
      document.querySelectorAll(".card[data-module]").forEach(function (card) {
        const result = best[card.dataset.module];
        if (!result) return;
        card.querySelector(".score-badge").innerHTML = `<span style="color:var(--muted);font-weight:700;font-size:.7rem">Meilleur</span><span style="color:var(--accent);font-weight:800;font-size:.78rem">${result.score}/${result.nb_questions} ${result.pct}%</span>`;
      });
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

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `#aml-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;background:rgba(15,23,42,.72);font-family:'Open Sans',sans-serif}.aml-card{position:relative;width:min(100%,400px);display:flex;flex-direction:column;gap:.45rem;padding:2rem;background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.3)}.aml-card h2{text-align:center;color:#0f172a}.aml-logo{text-align:center;font-size:2rem}.aml-sub{text-align:center;color:#64748b;margin:0 0 .8rem}.aml-card label{font-weight:800;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:#334155}.aml-card input,.aml-card select{padding:.75rem;border:1px solid #cbd5e1;border-radius:10px;font:inherit}.aml-primary,.aml-secondary{padding:.8rem;border-radius:10px;font:inherit;font-weight:800;cursor:pointer}.aml-primary{margin-top:.6rem;border:0;background:#1d4ed8;color:#fff}.aml-secondary{border:1px solid #1d4ed8;background:#fff;color:#1d4ed8}.aml-close{position:absolute;right:.7rem;top:.45rem;border:0;background:transparent;font-size:1.7rem;cursor:pointer;color:#64748b}.aml-error{min-height:1.2rem;color:#b91c1c;text-align:center;font-size:.82rem;font-weight:700}`;
    document.head.appendChild(style);
  }

  injectStyles();
  window.loadEleve = loadEleve;
  window.AM = { currentEleve: loadEleve, sendSession, loadMenuScores, openLogin };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadMenuScores);
  else loadMenuScores();
})();
