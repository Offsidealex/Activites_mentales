// Premier élève virtuel : véritable navigateur Chromium, sans compte ni données élèves.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');


test('progression site : 7/10 verrouille, 8/10 debloque et persiste apres rechargement', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'index.html')).href);
    await page.waitForFunction(() => window.AM?.isProgressReady());
    const first = page.locator('.card[data-key="add_rel"]');
    const second = page.locator('.card[data-key="mult_rel"]');
    assert.equal(await first.getAttribute('aria-disabled'), 'false');
    assert.equal(await second.getAttribute('aria-disabled'), 'true');
    await second.evaluate(el => el.click());
    assert.equal(await page.locator('#s-quiz.active').count(), 0, 'un niveau verrouille ne peut pas demarrer');
    await page.evaluate(() => window.AM.recordProgress('Addition de relatifs', 7, 10));
    assert.equal(await second.getAttribute('aria-disabled'), 'true');
    await page.evaluate(() => window.AM.recordProgress('Addition de relatifs', 8, 10));
    assert.equal(await second.getAttribute('aria-disabled'), 'false');
    await page.reload();
    await page.waitForFunction(() => window.AM?.isProgressReady());
    assert.equal(await page.locator('.card[data-key="mult_rel"]').getAttribute('aria-disabled'), 'false');
    assert.equal(await page.locator('.card[data-key="sub_rel"]').getAttribute('aria-disabled'), 'true');
    assert.equal(await page.locator('.card[data-key="mult"]').getAttribute('aria-disabled'), 'false', 'tables libres');
  } finally { await browser.close(); }
});

test('progression site : les anciens meilleurs scores ne debloquent pas les niveaux', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('am_best_scores', JSON.stringify({
        'Addition de relatifs': { score: 10, nb_questions: 10, pct: 100 }
      }));
    });
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'index.html')).href);
    await page.waitForFunction(() => window.AM?.isProgressReady());
    assert.equal(await page.locator('.card[data-key="mult_rel"]').getAttribute('aria-disabled'), 'true');
  } finally { await browser.close(); }
});

test('élève virtuel : termine les 10 équations du niveau 10 dans le navigateur', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'index.html')).href);
    const card = page.locator('.card[data-module="Équations — Niveau 10"]');
    await card.waitFor({ state: 'visible' });
    // Le test du niveau 10 prépare les neuf niveaux préalables comme déjà réussis.
    await page.waitForFunction(() => window.AM?.isProgressReady());
    await page.evaluate(() => {
      for (let n = 1; n <= 9; n++) window.AM.recordProgress('Équations — Niveau ' + n, 8, 10);
    });
    await card.click();
    await page.locator('#s-quiz.active').waitFor();
    for (let i = 0; i < 10; i++) {
      await page.locator('#q-label').getByText(`Question ${i + 1} / 10`).waitFor();
      // Le corrigé interne sert uniquement d'oracle de test ; la réponse est saisie
      // dans le vrai champ et validée avec le vrai bouton de l'interface.
      const answer = await page.evaluate(() => questions[cur].ans);
      await page.locator('#ans').fill(String(answer));
      await page.locator('#btn-v').click();
      await page.locator('#feedback.good').waitFor();
    }
    await page.locator('#s-results.active').waitFor({ timeout: 10000 });
    assert.equal((await page.locator('#sr-score').textContent()).trim(), '10/10');
    assert.equal((await page.locator('#sr-pct').textContent()).trim(), '100 %');
    assert.equal(await page.locator('#recap .rrow').count(), 10);
  } finally {
    await browser.close();
  }
});


async function openAdditions(page) {
  await page.evaluate(() => showAdditionsLevels());
  await page.locator('#screen-levels:not(.hidden)').waitFor();
  return page.locator('#levels-list button');
}

async function completeAdditions(page, correctCount) {
  const buttons = await openAdditions(page);
  assert.equal(await buttons.nth(1).isDisabled(), true, 'niveau 2 initially locked');
  await buttons.first().click();
  await page.locator('#screen-quiz:not(.hidden)').waitFor();
  for (let i = 0; i < 10; i++) {
    await page.waitForFunction(expected => quiz.current === expected, i);
    const index = await page.evaluate(shouldPass => {
      const q = quiz.questions[quiz.current];
      return q.choices.findIndex(choice => choice.isCorrect === shouldPass);
    }, i < correctCount);
    assert.ok(index >= 0, 'QCM has a suitable answer');
    await page.locator('#q-choices .choice-btn').nth(index).click();
    await page.locator('#q-next:not(.hidden)').click();
  }
  await page.locator('#screen-result:not(.hidden)').waitFor();
  assert.equal((await page.locator('#result-score').textContent()).trim(), String(correctCount));
  assert.equal((await page.locator('#result-total').textContent()).trim(), '10');
  await openAdditions(page);
  return page.locator('#levels-list button').nth(1).isDisabled();
}

test('élève virtuel UPE2A : 70 % ne débloque pas le niveau 2', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'upe2a.html')).href);
    assert.equal(await completeAdditions(page, 7), true);
  } finally { await browser.close(); }
});

test('élève virtuel UPE2A : 80 % débloque le niveau 2 après rechargement', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'upe2a.html')).href);
    assert.equal(await completeAdditions(page, 8), false);
    const guestId = await page.evaluate(() => user.guestId);
    await page.reload();
    assert.equal(await page.evaluate(() => user.guestId), guestId, 'same guest after reload');
    const buttons = await openAdditions(page);
    assert.equal(await buttons.nth(1).isDisabled(), false, 'level 2 remains unlocked');
    await buttons.nth(1).click();
    await page.locator('#screen-quiz:not(.hidden)').waitFor();
    assert.equal(await page.evaluate(() => quiz.level), '2');
  } finally { await browser.close(); }
});


async function completeUpe2aQcm(page, { menu, firstLevel, nextLevel, score }) {
  await page.evaluate(menuName => window[menuName](), menu);
  const levels = page.locator('#levels-list button');
  assert.equal(await levels.nth(1).isDisabled(), true, 'second level starts locked');
  await levels.first().click();
  await page.locator('#screen-quiz:not(.hidden)').waitFor();
  assert.equal(await page.evaluate(() => String(quiz.level)), String(firstLevel));
  for (let i = 0; i < 10; i++) {
    await page.waitForFunction(expected => quiz.current === expected, i);
    const answerIndex = await page.evaluate(pass => {
      const question = quiz.questions[quiz.current];
      return question.choices.findIndex(option => option.isCorrect === pass);
    }, i < score);
    assert.ok(answerIndex >= 0, 'question must offer correct and incorrect answers');
    await page.locator('#q-choices .choice-btn').nth(answerIndex).click();
    await page.locator('#q-next:not(.hidden)').click();
  }
  await page.locator('#screen-result:not(.hidden)').waitFor();
  assert.equal((await page.locator('#result-score').textContent()).trim(), String(score));
  await page.evaluate(menuName => window[menuName](), menu);
  assert.equal(await levels.nth(1).isDisabled(), score < 8, '80 percent threshold');
  const guestId = await page.evaluate(() => user.guestId);
  await page.reload();
  assert.equal(await page.evaluate(() => user.guestId), guestId, 'guest identity persists');
  await page.evaluate(menuName => window[menuName](), menu);
  assert.equal(await levels.nth(1).isDisabled(), score < 8, 'level state persists');
  if (score >= 8) {
    await levels.nth(1).click();
    await page.locator('#screen-quiz:not(.hidden)').waitFor();
    assert.equal(await page.evaluate(() => String(quiz.level)), String(nextLevel));
  }
}

for (const scenario of [
  { label: 'soustractions', menu: 'showSoustractionsLevels', firstLevel: 1, nextLevel: 2 },
  { label: 'nombres en français', menu: 'showNombresLevels', firstLevel: 10, nextLevel: 20 },
]) {
  for (const score of [7, 8]) {
    test(`élève virtuel UPE2A : ${scenario.label}, ${score}/10 et persistance`, { timeout: 60000 }, async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(pathToFileURL(resolve(__dirname, '..', 'upe2a.html')).href);
        await completeUpe2aQcm(page, { ...scenario, score });
      } finally { await browser.close(); }
    });
  }
}


async function runUpe2aScenario(page, { menu, firstLevel, secondLevel, total, score, answerMode }) {
  await page.evaluate(name => window[name](), menu);
  const levels = page.locator('#levels-list button');
  const startIndex = firstLevel === 3 ? 2 : 0;
  const nextIndex = startIndex + 1;
  assert.equal(await levels.nth(nextIndex).isDisabled(), true);
  await levels.nth(startIndex).click();
  await page.locator('#screen-quiz:not(.hidden)').waitFor();
  assert.equal(await page.evaluate(() => String(quiz.level)), String(firstLevel));
  for (let i = 0; i < total; i++) {
    await page.waitForFunction(expected => quiz.current === expected, i);
    const correct = i < score;
    if (answerMode === 'input') {
      const answer = await page.evaluate(pass => {
        const expected = quiz.questions[quiz.current].correctAnswer;
        return pass ? String(expected) : String(Number(expected) + 10000);
      }, correct);
      await page.locator('#q-input').fill(answer);
      await page.locator('#q-validate-btn').click();
    } else if (answerMode === 'money') {
      const coins = await page.evaluate(pass => {
        const target = quiz.questions[quiz.current].correctAnswer;
        if (!pass) return [];
        const denominations = [...COINS].filter(c => document.getElementById('coin-' + c.val)).map(c => c.val).sort((a,b) => b-a);
        const chosen = [];
        let remaining = target;
        for (const val of denominations) {
          while (remaining >= val) { chosen.push(val); remaining -= val; }
        }
        if (remaining !== 0) throw new Error('Target cannot be formed with available coins');
        return chosen;
      }, correct);
      for (const coin of coins) await page.locator('#coin-' + coin).click();
      await page.locator('#q-monnaie-btn').click();
    } else {
      const index = await page.evaluate(pass => quiz.questions[quiz.current].choices.findIndex(c => c.isCorrect === pass), correct);
      assert.ok(index >= 0);
      await page.locator('#q-choices .choice-btn').nth(index).click();
    }
    await page.locator('#q-next:not(.hidden)').click();
  }
  await page.locator('#screen-result:not(.hidden)').waitFor();
  assert.equal((await page.locator('#result-score').textContent()).trim(), String(score));
  await page.evaluate(name => window[name](), menu);
  assert.equal(await levels.nth(nextIndex).isDisabled(), score / total < .8);
  const guest = await page.evaluate(() => user.guestId);
  await page.reload();
  assert.equal(await page.evaluate(() => user.guestId), guest);
  await page.evaluate(name => window[name](), menu);
  assert.equal(await levels.nth(nextIndex).isDisabled(), score / total < .8);
  if (score / total >= .8) {
    await levels.nth(nextIndex).click();
    await page.locator('#screen-quiz:not(.hidden)').waitFor();
    assert.equal(await page.evaluate(() => String(quiz.level)), String(secondLevel));
  }
}

for (const scenario of [
  { label: 'soustractions avec saisie', menu: 'showSoustractionsLevels', firstLevel: 3, secondLevel: 4, total: 10, score: 8, answerMode: 'input', preUnlock: ['soustractions', 3] },
  { label: 'mesures', menu: 'showMesuresLevels', firstLevel: 1, secondLevel: 2, total: 8, score: 7, answerMode: 'qcm' },
  { label: 'mesures sous le seuil', menu: 'showMesuresLevels', firstLevel: 1, secondLevel: 2, total: 8, score: 6, answerMode: 'qcm' },
  { label: 'monnaie', menu: 'showMonnaieLevels', firstLevel: 1, secondLevel: 2, total: 6, score: 5, answerMode: 'money' },
  { label: 'monnaie sous le seuil', menu: 'showMonnaieLevels', firstLevel: 1, secondLevel: 2, total: 6, score: 4, answerMode: 'money' },
]) {
  test(`élève virtuel UPE2A : ${scenario.label} et progression`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(resolve(__dirname, '..', 'upe2a.html')).href);
      if (scenario.preUnlock) {
        await page.evaluate(([type, level]) => {
          // Prepare prerequisites using the real progression storage, not a bypass of the lock guard.
          const sequence = LEVEL_SEQUENCES[type];
          for (const previous of sequence.slice(0, sequence.indexOf(String(level)))) earnUnlock(type, previous);
        }, scenario.preUnlock);
      }
      await runUpe2aScenario(page, scenario);
    } finally { await browser.close(); }
  });
}


async function completeUpe2aActivity(page, { label, start, menu, level, total, correctCount }) {
  if (menu) await page.locator('[onclick="' + menu + '()"]').click();
  if (start) {
    const mode = { table: 'A', 'table-numbers': 'B', 'table-letters': 'C' }[start];
    await page.locator('#screen-menu:not(.hidden)').getByText('Tables', { exact: true }).click();
    await page.locator('#screen-levels:not(.hidden)').getByRole('button', { name: '×4', exact: true }).click();
    const modeLabel = { A: 'Niveau A — QCM', B: 'Niveau B — Saisie chiffres', C: 'Niveau C — Saisie en lettres' }[mode];
    await page.locator('#screen-levels:not(.hidden) #levels-list').getByRole('button', { name: new RegExp('^' + modeLabel) }).click();
  } else {
    const levels = page.locator('#levels-list button');
    assert.equal(await levels.nth(1).isDisabled(), true);
    await levels.first().click();
  }
  await page.locator('#screen-quiz:not(.hidden)').waitFor();
  assert.equal(await page.evaluate(() => String(quiz.level)), String(level));
  assert.equal(await page.evaluate(() => quiz.questions.length), total);
  for (let i = 0; i < total; i++) {
    await page.waitForFunction(index => quiz.current === index, i);
    const correct = i < correctCount;
    const qType = await page.evaluate(() => quiz.questions[quiz.current].type);
    if (qType === 'qcm_heure') assert.equal(await page.locator('#q-visual svg').count(), 1);
    if (qType === 'qcm_geo') assert.equal(await page.locator('#q-visual svg').count(), 1);
    if (start) {
      const statement = (await page.locator('#q-question').innerText()).trim();
      const match = statement.match(new RegExp('([0-9]+) *× *([0-9]+)'));
      assert.ok(match, 'visible multiplication question: ' + statement);
      assert.equal(Number(match[1]), 4);
      const expected = Number(match[1]) * Number(match[2]);
      const french = { 4:'quatre',8:'huit',12:'douze',16:'seize',20:'vingt',24:'vingt-quatre',28:'vingt-huit',32:'trente-deux',36:'trente-six',40:'quarante' };
      if (qType.startsWith('qcm')) {
        const options = page.locator('#q-choices .choice-btn');
        const labels = (await options.allTextContents()).map(x => x.trim());
        const idx = labels.findIndex(x => correct ? x === String(expected) : x !== String(expected));
        assert.ok(idx >= 0, 'independent QCM answer exists');
        await options.nth(idx).click();
      } else {
        const answer = correct ? (qType === 'input_letters' ? french[expected] : String(expected)) : (qType === 'input_letters' ? 'réponse incorrecte' : String(expected + 10000));
        assert.ok(answer, 'independent fixture exists');
        await page.locator('#q-input').fill(answer);
        await page.locator('#q-validate-btn').click();
      }
    } else if (qType.startsWith('qcm')) {
      const idx = await page.evaluate(pass => quiz.questions[quiz.current].choices.findIndex(c => c.isCorrect === pass), correct);
      assert.ok(idx >= 0);
      await page.locator('#q-choices .choice-btn').nth(idx).click();
    } else {
      const answer = await page.evaluate(pass => {
        const expected = quiz.questions[quiz.current].correctAnswer;
        return pass ? String(expected) : quiz.questions[quiz.current].type === 'input_num' ? String(Number(expected) + 10000) : 'réponse volontairement incorrecte';
      }, correct);
      await page.locator('#q-input').fill(answer);
      await page.locator('#q-validate-btn').click();
    }
    await page.locator('#q-next:not(.hidden)').click();
  }
  await page.locator('#screen-result:not(.hidden)').waitFor();
  assert.equal((await page.locator('#result-score').textContent()).trim(), String(correctCount), label);
  if (menu) {
    await page.locator('#screen-result button[onclick="showMenu()"]') .click();
    await page.locator('[onclick="' + menu + '()"]').click();
    assert.equal(await page.locator('#levels-list button').nth(1).isDisabled(), correctCount / total < .8);
    const guest = await page.evaluate(() => user.guestId);
    await page.reload();
    assert.equal(await page.evaluate(() => user.guestId), guest);
    await page.locator('[onclick="' + menu + '()"]').click();
    assert.equal(await page.locator('#levels-list button').nth(1).isDisabled(), correctCount / total < .8);
  }
}

for (const scenario of [
  { label: 'heure, 75 %', menu: 'showHeureLevels', level: 1, total: 8, correctCount: 6 },
  { label: 'heure, 87,5 %', menu: 'showHeureLevels', level: 1, total: 8, correctCount: 7 },
  { label: 'géométrie, 75 %', menu: 'showGeoLevels', level: 1, total: 8, correctCount: 6 },
  { label: 'géométrie, 87,5 %', menu: 'showGeoLevels', level: 1, total: 8, correctCount: 7 },
  { label: 'tables de multiplication, QCM', start: 'table', level: '4_A', total: 10, correctCount: 8 },
  { label: 'tables de multiplication, chiffres', start: 'table-numbers', level: '4_B', total: 10, correctCount: 8 },
  { label: 'tables de multiplication, lettres', start: 'table-letters', level: '4_C', total: 10, correctCount: 8 },
]) {
  test(`élève virtuel UPE2A : ${scenario.label}`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(resolve(__dirname, '..', 'upe2a.html')).href);
      await completeUpe2aActivity(page, scenario);
    } finally { await browser.close(); }
  });
}


test('TEST-IA : connexion et seance sauvegardee dans Supabase (optionnel)', { timeout: 90000 }, async (t) => {
  const pseudo = process.env.AM_TEST_STUDENT_PSEUDO;
  const password = process.env.AM_TEST_STUDENT_PASSWORD;
  if (!pseudo || !password) return t.skip('Secrets du compte TEST-IA non configures');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'index.html')).href);
    await page.waitForFunction(() => window.AM?.isProgressReady());
    const eleve = await page.evaluate(async ({ pseudo, password }) =>
      window.AM.loginTestStudent(pseudo, password), { pseudo, password });
    assert.equal(eleve.prenom.toLowerCase(), pseudo.toLowerCase());
    assert.equal(eleve.classe, 'TEST-IA');
    const exercice = 'TEST-IA verification ' + Date.now();
    const sessionId = await page.evaluate(async ({ exercice }) =>
      window.AM.sendSession({ exercice, score: 8, nb_questions: 10, duree_totale_ms: 42000 }), { exercice });
    assert.ok(sessionId, 'la seance doit etre enregistree dans Supabase');
    const saved = await page.evaluate(async ({ sessionId }) => {
      const session = JSON.parse(sessionStorage.getItem('am_auth_session'));
      const response = await fetch('https://hxfdlujpedxuumqfewvn.supabase.co/rest/v1/sessions?id=eq.' +
        encodeURIComponent(sessionId) + '&select=id,exercice,score,nb_questions,duree_totale_ms', {
        headers: {
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4ZmRsdWpwZWR4dXVtcWZld3ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMjcyMzAsImV4cCI6MjA5NzcwMzIzMH0.mM0xBhLGWG3vDgE06bEla8b4BhH7v6dvZ-BWn4ZOP0Q',
          Authorization: 'Bearer ' + session.access_token
        }
      });
      if (!response.ok) throw new Error('Lecture de controle refusee : ' + response.status);
      return response.json();
    }, { sessionId });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].exercice, exercice);
    assert.equal(saved[0].score, 8);
    assert.equal(saved[0].nb_questions, 10);
    assert.equal(saved[0].duree_totale_ms, 42000);
  } finally { await browser.close(); }
});

test('audit complet : tous les modules génèrent des questions et affichent leur premier exercice', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'index.html')).href);
    await page.waitForFunction(() => window.AM?.isProgressReady());
    const modules = await page.evaluate(() => Object.keys(MODULES));
    assert.ok(modules.length >= 20, 'le catalogue doit contenir au moins 20 modules');
    for (const key of modules) {
      try {
        const result = await page.evaluate(key => {
          const m = MODULES[key];
          for (let run = 0; run < 3; run++) {
            const qs = m.gen();
            if (!Array.isArray(qs) || qs.length !== 10) throw new Error('nombre de questions : ' + qs?.length);
            for (const [i, q] of qs.entries()) {
              if (!q || typeof q.html !== 'string' || !q.html.trim()) throw new Error('énoncé manquant question ' + (i + 1));
              if (q.ans === undefined || q.ans === null) throw new Error('réponse absente question ' + (i + 1));
              if (typeof q.ans === 'number' && !Number.isFinite(q.ans)) throw new Error('réponse non finie question ' + (i + 1));
              if (m.ansType === 'fraction' && (!Number.isFinite(q.ans.n) || !Number.isFinite(q.ans.d) || q.ans.d === 0)) throw new Error('fraction invalide question ' + (i + 1));
            }
          }
          CM = m; CMKey = key; CM.key = key;
          questions = m.gen(); cur = 0; good = 0; log = []; totalAnswerMs = 0;
          show('s-quiz'); loadQ();
          return { title: m.title, label: document.getElementById('q-label').textContent,
            operation: document.getElementById('operation').textContent };
        }, key);
        assert.match(result.label, /Question 1 \/ 10/);
        assert.ok(result.operation.trim(), 'énoncé affiché');
        await page.evaluate(() => clearInterval(tInt));
      } catch (error) {
        failures.push({ module: key, error: String(error.message || error) });
      }
    }
    console.log('AUDIT MODULES:', JSON.stringify({ tested: modules.length, failures }, null, 2));
    assert.deepEqual(failures, [], 'certains modules échouent : voir AUDIT MODULES dans les logs');
  } finally {
    await browser.close();
  }
});

test('TEST-IA : parcours de tous les modules avec sauvegarde Supabase', { timeout: 1200000 }, async (t) => {
  const pseudo = process.env.AM_TEST_STUDENT_PSEUDO;
  const password = process.env.AM_TEST_STUDENT_PASSWORD;
  if (!pseudo || !password) return t.skip('Compte TEST-IA non configuré');
  const browser = await chromium.launch({ headless: true });
  const report = [];
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'index.html')).href);
    await page.waitForFunction(() => window.AM?.isProgressReady());
    await page.evaluate(async credentials => window.AM.loginTestStudent(credentials.pseudo, credentials.password), { pseudo, password });
    const modules = await page.evaluate(() => Object.keys(MODULES));
    for (const key of modules) {
      try {
        const result = await page.evaluate(async key => {
          const m = MODULES[key];
          // Les niveaux verrouillés sont préparés via le mécanisme de progression
          // habituel. Le test ne modifie pas les résultats d'autres élèves.
          const levels = PROGRESSION_GROUPS[m.group] || [];
          const index = levels.indexOf(key);
          for (let n = 0; n < index; n++) {
            window.AM.recordProgress(MODULES[levels[n]].title, 8, 10);
          }
          if (!isModuleUnlocked(key)) throw new Error('niveau verrouillé');
          launchQuiz(key);
          const title = m.title;
          const originalSend = window.AM.sendSession;
          let saved;
          window.AM.sendSession = (...args) => {
            saved = Promise.resolve(originalSend(...args));
            return saved;
          };
          try {
            for (let i = 0; i < questions.length; i++) {
              const q = questions[cur];
              if (m.ansType === 'fraction') {
                document.getElementById('ans-n').value = String(q.ans.n);
                document.getElementById('ans-d').value = String(q.ans.d);
                valider();
              } else if (m.ansType === 'text') {
                document.getElementById('ans-txt').value = String(q.ans);
                valider();
              } else if (m.ansType === 'yesno') {
                process(null, null, String(q.ans), false);
              } else {
                document.getElementById('ans').value = String(q.ans);
                valider();
              }
              if (!done) throw new Error('réponse non validée à la question ' + (i + 1));
              // La transition normale attend 1,4 s ; accélérer seulement
              // cette animation, sans contourner la validation de réponse.
              clearInterval(tInt);
              if (i < questions.length - 1) { cur++; loadQ(); }
            }
            showResults();
            if (!saved) throw new Error('enregistrement non demandé');
            const sessionId = await saved;
            if (!sessionId) throw new Error('Supabase ne confirme pas la sauvegarde');
            return { title, score: good, total: questions.length, sessionId };
          } finally {
            window.AM.sendSession = originalSend;
            clearInterval(tInt);
          }
        }, key);
        report.push({ key, ...result, status: 'OK' });
      } catch (error) {
        report.push({ key, status: 'ERROR', error: String(error.message || error) });
      }
    }
    const errors = report.filter(x => x.status !== 'OK');
    console.log('TEST-IA PARCOURS COMPLET:', JSON.stringify({
      total: report.length, successful: report.length - errors.length, errors,
      scores: report.map(x => ({ module: x.key, score: x.score, status: x.status }))
    }, null, 2));
    assert.equal(report.length, modules.length, 'tous les modules doivent être testés');
    assert.deepEqual(errors, [], 'certains exercices ou enregistrements Supabase ont échoué');
  } finally {
    await browser.close();
  }
});

test('audit erreurs élève : mauvaise réponse, champ vide et cas limites sur chaque module', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'index.html')).href);
    await page.waitForFunction(() => window.AM?.isProgressReady());
    const keys = await page.evaluate(() => Object.keys(MODULES));
    for (const key of keys) {
      try {
        const result = await page.evaluate(key => {
          const m = MODULES[key];
          const init = () => {
            CM = m; CMKey = key; CM.key = key;
            questions = m.gen(); cur = 0; good = 0; log = []; totalAnswerMs = 0;
            show('s-quiz'); loadQ(); clearInterval(tInt);
          };
          // Un champ vide ne doit pas valider la question.
          init();
          if (m.ansType !== 'yesno') {
            valider();
            if (done || good !== 0) throw new Error('champ vide accepté');
          }
          // Une réponse erronée doit être rejetée, sans attribuer de point.
          init();
          const q = questions[0];
          if (m.ansType === 'fraction') {
            const n = q.ans.n, d = q.ans.d;
            document.getElementById('ans-n').value = String(n + d);
            document.getElementById('ans-d').value = String(d);
            valider();
          } else if (m.ansType === 'yesno') {
            process(null, null, String(q.ans).toLowerCase() === 'oui' ? 'non' : 'oui', false);
          } else if (m.ansType === 'text') {
            document.getElementById('ans-txt').value = 'réponse volontairement incorrecte';
            valider();
          } else {
            document.getElementById('ans').value = String(Number(q.ans) + 100000);
            valider();
          }
          if (!done) throw new Error('réponse non traitée');
          if (good !== 0 || !document.getElementById('feedback').classList.contains('bad')) {
            throw new Error('réponse incorrecte acceptée');
          }
          // Les saisies impossibles et fractions à dénominateur nul sont refusées.
          if (m.ansType === 'fraction') {
            init();
            document.getElementById('ans-n').value = String(questions[0].ans.n);
            document.getElementById('ans-d').value = '0';
            valider();
            if (good !== 0) throw new Error('division par zéro acceptée');
          }
          // L'expiration du temps doit être considérée comme une erreur.
          init();
          process(null, null, null, true);
          if (good !== 0 || !done) throw new Error('expiration du temps mal traitée');
          clearInterval(tInt);
          return { title: m.title };
        }, key);
        assert.ok(result.title);
      } catch (error) {
        failures.push({ module: key, error: String(error.message || error) });
      }
    }
    console.log('AUDIT ERREURS ÉLÈVE:', JSON.stringify({ modules: keys.length, failures }, null, 2));
    assert.deepEqual(failures, [], 'erreurs de validation détectées dans certains modules');
  } finally {
    await browser.close();
  }
});

test('audit mathématique indépendant : recalcul des opérations et statistiques', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [], coverage = {};
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'index.html')).href);
    const result = await page.evaluate(() => {
      const checks = {
        mult: html => { const m = html.match(/(\d+)\s*×\s*(\d+)/); return m ? +m[1] * +m[2] : null; },
        mult10: html => { const m = html.replace(/\s/g,'').replace(/,/g,'.').match(/^([\d.]+)×([\d.]+)$/); return m ? +m[1] * +m[2] : null; },
        div10: html => { const m = html.replace(/\s/g,'').replace(/,/g,'.').match(/^([\d.]+)÷([\d.]+)$/); return m ? +m[1] / +m[2] : null; },
        etendue: html => { const a = html.replace(/[{}]/g,'').split(';').map(x => Number(x.trim().replace(/\s/g,'').replace(',','.'))); return a.length > 1 && a.every(Number.isFinite) ? Math.max(...a)-Math.min(...a) : null; },
        moyenne: html => { const a = html.replace(/[{}]/g,'').split(';').map(x => Number(x.trim().replace(/\s/g,'').replace(',','.'))); return a.length > 1 && a.every(Number.isFinite) ? a.reduce((x,y)=>x+y,0)/a.length : null; },
        mediane: html => { const a = html.replace(/[{}]/g,'').split(';').map(x => Number(x.trim().replace(/\s/g,'').replace(',','.'))).sort((x,y)=>x-y); return a.length > 1 && a.every(Number.isFinite) ? (a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2 : null; },
        pct_simples: html => { const m=html.replace(/\s/g,'').replace(/,/g,'.').match(/^([\d.]+)%de([\d.]+)$/); return m ? +m[1]*+m[2]/100 : null; },
        geo_perimetre: html => { const m=html.match(/longueur (\d+) cm, largeur (\d+) cm/); return m ? 2*(+m[1]+ +m[2]) : null; },
        geo_aire: html => { const m=html.match(/base (\d+) cm, hauteur (\d+) cm/); return m ? +m[1]*+m[2]/2 : null; },
        geo_angles: html => { const m=html.match(/(complémentaire|supplémentaire) de (\d+)°/); return m ? (m[1]==='complémentaire'?90:180)- +m[2] : null; },
        pyth_cote: html => { const m=html.match(/hypoténuse (\d+) cm, un côté (\d+) cm/); return m ? Math.sqrt(+m[1]**2 - +m[2]**2) : null; }
      };
      const failures=[], coverage={};
      for (const [key, fn] of Object.entries(checks)) {
        const mod=MODULES[key];
        if (!mod) { failures.push({module:key,issue:'module absent'});continue; }
        let checked=0, unsupported=0;
        for(let iteration=0;iteration<12;iteration++) {
          for(const q of mod.gen()) {
            const expected=fn(q.html.replace(/<[^>]+>/g,''));
            if(expected===null || !Number.isFinite(expected)) {unsupported++;continue;}
            checked++;
            if(typeof q.ans!=='number'||Math.abs(q.ans-expected)>0.011) {
              failures.push({module:key,enonce:q.html,annonce:q.ans,calcule:expected});
            }
          }
        }
        coverage[key]={checked,unsupported};
        if(checked===0) failures.push({module:key,issue:'aucune question recalculée'});
      }
      return {failures,coverage};
    });
    failures.push(...result.failures);
    Object.assign(coverage,result.coverage);
    console.log('AUDIT MATHÉMATIQUE INDÉPENDANT:',JSON.stringify({coverage,failures},null,2));
    assert.deepEqual(failures,[], 'des réponses mathématiques sont incorrectes');
  } finally { await browser.close(); }
});
