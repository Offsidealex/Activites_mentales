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
