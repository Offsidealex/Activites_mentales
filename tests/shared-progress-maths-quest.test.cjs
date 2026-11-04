// Régression : une réussite remontée depuis Maths Quest doit aussi déverrouiller
// le module suivant, sans se limiter à afficher le badge « Meilleur ».
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

async function verifyImportedScore({ played_at, exercice, module_key, expectedUnlocked, failProgressEndpoint = false }) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      sessionStorage.setItem('am_eleve', JSON.stringify({
        id: '00000000-0000-4000-8000-000000000001',
        prenom: 'Élève virtuel', classe: '3PM'
      }));
      sessionStorage.setItem('am_auth_session', JSON.stringify({
        access_token: 'test-token', refresh_token: 'test-refresh',
        expires_at: 4102444800
      }));
    });
    const row = { exercice, module_key, score: 9, nb_questions: 10, played_at };
    await page.route('https://hxfdlujpedxuumqfewvn.supabase.co/rest/v1/sessions*', route => {
      if (failProgressEndpoint && route.request().url().includes('played_at=gte.')) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Test de repli"}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row]) });
    });
    await page.goto(pathToFileURL(resolve(__dirname, '..', 'index.html')).href);
    await page.waitForFunction(() => window.AM?.isProgressReady());
    await page.waitForFunction(() => document.querySelector('.card[data-key="add_rel"]')?.querySelector('.score-badge')?.textContent.includes('9/10'));
    await page.waitForFunction(() => {
      const card = document.querySelector('.card[data-key="mult_rel"]');
      return card && (window.AM.getProgress().add_rel === 90 ||
        window.AM.getProgress()['Addition de relatifs'] === 90 ||
        card.getAttribute('aria-disabled') === 'true');
    });
    // L'attente de synchronisation ci-dessus couvre aussi l'absence de succès
    // dans le test des anciennes séances.
    assert.equal(await page.locator('.card[data-key="mult_rel"]').getAttribute('aria-disabled'),
      String(!expectedUnlocked));
    if (expectedUnlocked) {
      await page.reload();
      await page.waitForFunction(() => window.AM?.isProgressReady());
      assert.equal(await page.locator('.card[data-key="mult_rel"]').getAttribute('aria-disabled'), 'false');
    }
  } finally {
    await browser.close();
  }
}

test('MQ 9/10 : réussite récente au titre historique débloque même si la requête progression échoue', { timeout: 60000 }, async () => {
  await verifyImportedScore({
    played_at: '2026-11-04T09:00:00Z',
    exercice: 'Addition de relatifs',
    module_key: 'add_rel',
    expectedUnlocked: true,
    failProgressEndpoint: true
  });
});

test('MQ 9/10 : identifiant stable débloque malgré un titre renommé', { timeout: 60000 }, async () => {
  await verifyImportedScore({
    played_at: '2026-11-04T09:00:00Z',
    exercice: 'Ancien intitulé de relatifs',
    module_key: 'add_rel',
    expectedUnlocked: true
  });
});

test('Ancienne séance : badge visible mais niveau suivant verrouillé', { timeout: 60000 }, async () => {
  await verifyImportedScore({
    played_at: '2026-10-01T09:00:00Z',
    exercice: 'Addition de relatifs',
    module_key: 'add_rel',
    expectedUnlocked: false
  });
});
