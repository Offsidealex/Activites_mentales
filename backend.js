/* ============================================================
   Activités Mentales — écran de connexion (version autonome)
   ------------------------------------------------------------
   Aucun serveur : le code de classe est vérifié directement
   dans le navigateur. Il n'y a donc plus rien à « joindre »,
   et les élèves ne peuvent plus être bloqués par une panne
   de connexion.

   POUR CHANGER LE(S) CODE(S) : modifie la ligne CODES_VALIDES
   ci-dessous. Tu peux en mettre plusieurs, séparés par des
   virgules, ex : ["3PM2026", "TRPM2026"].
   La saisie est insensible à la casse (3pm2026 = 3PM2026).
   ============================================================ */

(function () {
  "use strict";

  // ---- CONFIGURATION -----------------------------------------
  const CODES_VALIDES = ["3PM2026"];   // code(s) attendu(s)
  const REDEMANDER_A_CHAQUE_FOIS = true; // true = redemande à chaque ouverture de la page
  // ------------------------------------------------------------

  function estCodeValide(saisie) {
    const c = (saisie || "").trim().toUpperCase();
    return CODES_VALIDES.some(function (v) {
      return v.trim().toUpperCase() === c;
    });
  }

  function demarrer() {
    // Ne pas ré-injecter deux fois
    if (document.getElementById("aml-overlay")) return;

    // Si on ne redemande pas à chaque fois et qu'une session existe déjà, on n'affiche rien
    if (!REDEMANDER_A_CHAQUE_FOIS) {
      try {
        var dejaCo = sessionStorage.getItem("am_eleve");
        if (dejaCo) { window.AM_ELEVE = JSON.parse(dejaCo); return; }
      } catch (e) {}
    }

    injecterStyles();

    var overlay = document.createElement("div");
    overlay.id = "aml-overlay";
    overlay.innerHTML =
      '<div class="aml-card" role="dialog" aria-label="Connexion">' +
        '<div class="aml-logo">🏫</div>' +
        '<div class="aml-title">Activités Mentales</div>' +
        '<div class="aml-sub">Lycée Denis Diderot</div>' +
        '<label class="aml-label" for="aml-prenom">Ton prénom</label>' +
        '<input id="aml-prenom" class="aml-input" type="text" placeholder="ex : Lucas" autocomplete="off" spellcheck="false">' +
        '<label class="aml-label" for="aml-code">Code de la classe</label>' +
        '<input id="aml-code" class="aml-input" type="text" placeholder="ex : 3PM2026" autocomplete="off" spellcheck="false">' +
        '<div id="aml-error" class="aml-error"></div>' +
        '<button id="aml-start" class="aml-btn" type="button">Commencer →</button>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden"; // bloque le défilement du fond

    var prenom = document.getElementById("aml-prenom");
    var code   = document.getElementById("aml-code");
    var erreur = document.getElementById("aml-error");
    var bouton = document.getElementById("aml-start");
    var carte  = overlay.querySelector(".aml-card");

    setTimeout(function () { prenom.focus(); }, 50);

    function valider() {
      var p = prenom.value.trim();
      erreur.textContent = "";

      if (!p) {
        erreur.textContent = "Indique ton prénom.";
        prenom.focus();
        secouer();
        return;
      }
      if (!estCodeValide(code.value)) {
        erreur.textContent = "Code de classe incorrect.";
        code.focus();
        code.select();
        secouer();
        return;
      }

      // Connexion réussie
      var eleve = { prenom: p, classe: code.value.trim().toUpperCase() };
      window.AM_ELEVE = eleve;               // accessible ailleurs si besoin
      try { sessionStorage.setItem("am_eleve", JSON.stringify(eleve)); } catch (e) {}

      document.body.style.overflow = "";     // rétablit le défilement
      overlay.remove();                      // on découvre l'appli
    }

    function secouer() {
      carte.classList.remove("aml-shake");
      // force le reflow pour rejouer l'animation
      void carte.offsetWidth;
      carte.classList.add("aml-shake");
    }

    bouton.addEventListener("click", valider);
    prenom.addEventListener("keydown", function (e) { if (e.key === "Enter") code.focus(); });
    code.addEventListener("keydown", function (e) { if (e.key === "Enter") valider(); });
  }

  function injecterStyles() {
    if (document.getElementById("aml-styles")) return;
    var s = document.createElement("style");
    s.id = "aml-styles";
    s.textContent = [
      "#aml-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:1.2rem;",
      "background:radial-gradient(1000px 600px at 50% -10%, #1a2744 0%, transparent 60%), #0e1626;",
      "font-family:'Open Sans','Segoe UI',system-ui,sans-serif;}",
      ".aml-card{width:100%;max-width:380px;background:#16203a;border:1px solid #26304d;border-radius:18px;",
      "box-shadow:0 24px 60px rgba(0,0,0,.45);padding:2rem 1.8rem 1.9rem;display:flex;flex-direction:column;}",
      ".aml-logo{font-size:2.4rem;text-align:center;line-height:1;margin-bottom:.5rem;}",
      ".aml-title{text-align:center;font-weight:800;font-size:1.6rem;color:#f43f5e;letter-spacing:.01em;}",
      ".aml-sub{text-align:center;font-size:.85rem;color:#93a1ba;margin-top:.15rem;margin-bottom:1.4rem;}",
      ".aml-label{font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#aab4c9;margin:0 0 .4rem 2px;}",
      ".aml-input{width:100%;padding:.75rem .9rem;margin-bottom:1.1rem;border-radius:11px;border:1px solid #2d3a5b;",
      "background:#1b2742;color:#e8edf6;font-size:1rem;outline:none;transition:border-color .15s,box-shadow .15s;}",
      ".aml-input::placeholder{color:#5f6f8c;}",
      ".aml-input:focus{border-color:#f43f5e;box-shadow:0 0 0 3px rgba(244,63,94,.22);}",
      ".aml-error{min-height:1.15rem;color:#fca5a5;font-size:.82rem;font-weight:600;text-align:center;margin:-.4rem 0 .6rem;}",
      ".aml-btn{width:100%;padding:.85rem;border:none;border-radius:11px;cursor:pointer;",
      "background:linear-gradient(180deg,#f43f5e,#e11d48);color:#fff;font-size:1.05rem;font-weight:800;",
      "letter-spacing:.02em;box-shadow:0 8px 20px rgba(225,29,72,.35);transition:transform .1s,filter .15s;}",
      ".aml-btn:hover{filter:brightness(1.06);}",
      ".aml-btn:active{transform:translateY(1px);}",
      "@keyframes aml-shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}",
      "30%,50%,70%{transform:translateX(-7px)}40%,60%{transform:translateX(7px)}}",
      ".aml-shake{animation:aml-shake .5s cubic-bezier(.36,.07,.19,.97) both;}"
    ].join("");
    document.head.appendChild(s);
  }

  // Le script est chargé avant le <body> : on attend que la page soit prête.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", demarrer);
  } else {
    demarrer();
  }
})();
