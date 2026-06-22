// ============================================
// backend.js — Patch Activités Mentales
// À inclure dans index.html :
//   <script src="backend.js"></script>
// AVANT le script principal du site
// ============================================

// ⚙️ CONFIG — remplace par tes vraies valeurs Supabase
const SUPABASE_URL = 'https://hxfdlujpedxuumqfewvn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmRsdWpwZWR4dXVtcWZld3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjcyMzAsImV4cCI6MjA5NzcwMzIzMH0.mM0xBhLGWG3vDgE06bEla8b4BhH7v6dvZ-BWn4ZOP0Q'; // clé publique anon

// ============================================
// STATE ÉLÈVE (persisté en sessionStorage)
// ============================================

let currentEleve = null; // { id, prenom, classe_id }

function saveEleve(eleve) {
  currentEleve = eleve;
  sessionStorage.setItem('am_eleve', JSON.stringify(eleve));
}

function loadEleve() {
  const stored = sessionStorage.getItem('am_eleve');
  if (stored) currentEleve = JSON.parse(stored);
  return currentEleve;
}

// ============================================
// API Supabase — helpers génériques
// ============================================

async function sbQuery(table, method = 'GET', body = null, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    method,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${err}`);
  }
  return method === 'DELETE' ? null : res.json();
}

// ============================================
// LOGIN ÉLÈVE
// ============================================

/**
 * Vérifie le code classe, crée l'élève si besoin, retourne son objet.
 * @param {string} prenom
 * @param {string} codeClasse
 * @returns {Promise<{id, prenom, classe_id}|null>}
 */
async function loginEleve(prenom, codeClasse) {
  prenom = prenom.trim();
  codeClasse = codeClasse.trim().toUpperCase();

  // 1. Vérifier que la classe existe
  const classes = await sbQuery('classes', 'GET', null, `?code=eq.${codeClasse}&select=id,nom`);
  if (!classes || classes.length === 0) {
    return { error: 'Code classe incorrect.' };
  }
  const classeId = classes[0].id;

  // 2. Chercher l'élève existant
  const existing = await sbQuery('eleves', 'GET', null,
    `?prenom=ilike.${encodeURIComponent(prenom)}&classe_id=eq.${classeId}&select=id,prenom,classe_id`);

  if (existing && existing.length > 0) {
    saveEleve(existing[0]);
    return existing[0];
  }

  // 3. Créer l'élève
  const created = await sbQuery('eleves', 'POST',
    { prenom, classe_id: classeId },
    '?select=id,prenom,classe_id'
  );
  if (created && created.length > 0) {
    saveEleve(created[0]);
    return created[0];
  }

  return { error: 'Impossible de créer le compte élève.' };
}

// ============================================
// ENVOI D'UNE SESSION
// ============================================

/**
 * Enregistre une série complète dans Supabase.
 * @param {object} data
 *   - exercice: string
 *   - score: number
 *   - nb_questions: number
 *   - duree_totale_ms: number
 *   - reponses: [{numero_question, enonce, reponse_eleve, correct, temps_ms}]
 */
async function sendSession(data) {
  if (!currentEleve) {
    console.warn('[AM] Pas d\'élève connecté, session non enregistrée.');
    return null;
  }

  try {
    // 1. Créer la session
    const sessions = await sbQuery('sessions', 'POST', {
      eleve_id: currentEleve.id,
      exercice: data.exercice,
      score: data.score,
      nb_questions: data.nb_questions,
      duree_totale_ms: data.duree_totale_ms || null
    }, '?select=id');

    if (!sessions || sessions.length === 0) return null;
    const sessionId = sessions[0].id;

    // 2. Insérer les réponses détaillées (si fournies)
    if (data.reponses && data.reponses.length > 0) {
      const reponsesPayload = data.reponses.map(r => ({
        session_id: sessionId,
        numero_question: r.numero_question,
        enonce: r.enonce || null,
        reponse_eleve: r.reponse_eleve || null,
        correct: r.correct,
        temps_ms: r.temps_ms || null
      }));
      await sbQuery('reponses', 'POST', reponsesPayload, '');
    }

    console.log('[AM] Session enregistrée:', sessionId);
    return sessionId;

  } catch (e) {
    console.error('[AM] Erreur envoi session:', e);
    return null;
  }
}

// ============================================
// ÉCRAN DE LOGIN — injection dans le DOM
// ============================================

function injectLoginScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'am-login-overlay';
  overlay.innerHTML = `
    <div id="am-login-box">
      <div id="am-login-logo">🏫</div>
      <h2>Activités Mentales</h2>
      <p>Lycée Denis Diderot</p>
      <div class="am-field">
        <label for="am-prenom">Ton prénom</label>
        <input type="text" id="am-prenom" placeholder="ex : Lucas" autocomplete="off" />
      </div>
      <div class="am-field">
        <label for="am-code">Code de la classe</label>
        <input type="text" id="am-code" placeholder="ex : 3PM2026" autocomplete="off" />
      </div>
      <button id="am-login-btn">Commencer →</button>
      <p id="am-login-error"></p>
    </div>
  `;

  // Styles injectés inline pour ne pas dépendre d'un CSS externe
  const style = document.createElement('style');
  style.textContent = `
    #am-login-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: #1a1a2e;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    #am-login-box {
      background: #16213e;
      border: 1px solid #0f3460;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      max-width: 360px; width: 90%;
      text-align: center;
      color: #e0e0e0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    #am-login-logo { font-size: 2.5rem; margin-bottom: 0.5rem; }
    #am-login-box h2 { margin: 0; font-size: 1.4rem; color: #e94560; font-weight: 700; }
    #am-login-box p { margin: 0.2rem 0 1.5rem; font-size: 0.85rem; color: #888; }
    .am-field { text-align: left; margin-bottom: 1rem; }
    .am-field label { display: block; font-size: 0.8rem; color: #aaa; margin-bottom: 0.3rem; letter-spacing: 0.05em; text-transform: uppercase; }
    .am-field input {
      width: 100%; box-sizing: border-box;
      padding: 0.7rem 1rem;
      background: #0f3460; border: 1px solid #1a4a80;
      border-radius: 8px; color: #fff; font-size: 1rem;
      outline: none; transition: border-color 0.2s;
    }
    .am-field input:focus { border-color: #e94560; }
    #am-login-btn {
      margin-top: 0.5rem; width: 100%;
      padding: 0.8rem;
      background: #e94560; border: none; border-radius: 8px;
      color: #fff; font-size: 1rem; font-weight: 700;
      cursor: pointer; transition: background 0.2s;
    }
    #am-login-btn:hover { background: #c73650; }
    #am-login-btn:disabled { background: #555; cursor: default; }
    #am-login-error { color: #e94560; font-size: 0.85rem; min-height: 1.2em; margin-top: 0.8rem; }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  // Gestion du bouton
  const btn = document.getElementById('am-login-btn');
  const errEl = document.getElementById('am-login-error');

  async function doLogin() {
    const prenom = document.getElementById('am-prenom').value.trim();
    const code   = document.getElementById('am-code').value.trim();

    if (!prenom || !code) {
      errEl.textContent = 'Remplis les deux champs.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Connexion…';
    errEl.textContent = '';

    const result = await loginEleve(prenom, code);

    if (result && result.error) {
      errEl.textContent = result.error;
      btn.disabled = false;
      btn.textContent = 'Commencer →';
    } else if (result && result.id) {
      // Succès — on retire l'overlay
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s';
      setTimeout(() => overlay.remove(), 300);
    }
  }

  btn.addEventListener('click', doLogin);
  document.getElementById('am-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
}

// ============================================
// INIT — au chargement de la page
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  if (!loadEleve()) {
    injectLoginScreen();
  }
  // Expose les fonctions globalement pour le site principal
  window.AM = { sendSession, currentEleve: () => currentEleve };
});
