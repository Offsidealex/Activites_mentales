const { test, expect } = require('@playwright/test');

test.describe('Élève virtuel UPE2A', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      // Les tests invités ne doivent jamais envoyer de données à Supabase.
      window.addEventListener('DOMContentLoaded', () => {
        if (window.AM) {
          window.AM.currentEleve = () => null;
          window.AM.sendSession = () => { throw new Error('Envoi invité interdit'); };
        }
      });
    });
    await page.goto('/upe2a.html');
    await expect(page.locator('#screen-menu')).toBeVisible();
  });

  test('l’invité voit les exercices et peut changer de session', async ({ page }) => {
    await expect(page.locator('#menu-name')).toContainText('Invité');
    await page.getByRole('button', { name: 'Changer' }).click();
    await expect(page.locator('#screen-menu')).toBeVisible();
    await expect(page.locator('#menu-name')).toContainText('Invité');
  });

  test('une session invitée neuve ne récupère pas les scores d’une autre', async ({ page }) => {
    const first = await page.evaluate(() => user.guestId);
    expect(first).toBeTruthy();
    await page.evaluate(() => saveSession({ student_name: user.name, class_id: user.classId, guest_id: user.guestId, exercise_type: 'additions', level: 1, score: 10, total: 10 }));
    await expect.poll(() => page.evaluate(() => getStudentSessions(user.name, user.classId).length)).toBe(1);
    await page.getByRole('button', { name: 'Changer' }).click();
    const second = await page.evaluate(() => user.guestId);
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect(await page.evaluate(() => getStudentSessions(user.name, user.classId).length)).toBe(0);
  });

  test('8/10 débloque le niveau suivant même après suppression de l’historique', async ({ page }) => {
    await expect(page.evaluate(() => levelUnlocked('additions', '2'))).resolves.toBe(false);
    await page.evaluate(() => { earnUnlock('additions', 1); localStorage.removeItem('upe2a_sessions'); });
    await expect(page.evaluate(() => levelUnlocked('additions', '2'))).resolves.toBe(true);
  });

  test('6/10 ne débloque pas le niveau suivant', async ({ page }) => {
    await page.evaluate(() => saveSession({ student_name: user.name, class_id: user.classId, guest_id: user.guestId, exercise_type: 'additions', level: 1, score: 6, total: 10 }));
    await expect(page.evaluate(() => levelUnlocked('additions', '2'))).resolves.toBe(false);
  });

  test('un stockage plein ne bloque pas l’enregistrement du résultat à l’écran', async ({ page }) => {
    await page.evaluate(() => {
      quiz = { score: 8, questions: Array.from({ length: 10 }, () => ({})), type: 'additions', level: 1 };
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
      try { finishQuiz(); } finally { Storage.prototype.setItem = original; }
    });
    await expect(page.locator('#result-score')).toHaveText('8');
    await expect(page.locator('#result-total')).toHaveText('10');
  });
});
