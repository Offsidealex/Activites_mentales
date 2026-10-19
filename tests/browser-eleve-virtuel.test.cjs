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
