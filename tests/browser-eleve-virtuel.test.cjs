// Premier élève virtuel : véritable navigateur Chromium, sans compte ni données élèves.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

test('élève virtuel : termine les 10 équations du niveau 10 dans le navigateur', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'index.html')).href);
    const card = page.locator('.card[data-module="Équations — Niveau 10"]');
    await card.waitFor({ state: 'visible' });
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
  assert.equal(await levels.nth(1).isDisabled(), true);
  await levels.first().click();
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
  assert.equal(await levels.nth(1).isDisabled(), score / total < .8);
  const guest = await page.evaluate(() => user.guestId);
  await page.reload();
  assert.equal(await page.evaluate(() => user.guestId), guest);
  await page.evaluate(name => window[name](), menu);
  assert.equal(await levels.nth(1).isDisabled(), score / total < .8);
  if (score / total >= .8) {
    await levels.nth(1).click();
    await page.locator('#screen-quiz:not(.hidden)').waitFor();
    assert.equal(await page.evaluate(() => String(quiz.level)), String(secondLevel));
  }
}

for (const scenario of [
  { label: 'soustractions avec saisie', menu: 'showSoustractionsLevels', firstLevel: 3, secondLevel: 4, total: 10, score: 8, answerMode: 'input', preUnlock: ['soustractions', 3] },
  { label: 'mesures', menu: 'showMesuresLevels', firstLevel: 1, secondLevel: 2, total: 8, score: 7, answerMode: 'qcm' },
  { label: 'monnaie', menu: 'showMonnaieLevels', firstLevel: 1, secondLevel: 2, total: 6, score: 5, answerMode: 'money' },
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
