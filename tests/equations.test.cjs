// Dependency-free unit tests. Command: node --test tests/equations.test.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

function loadCatalogue(seed = 1) {
  // Run the complete application script, including menu construction. Theme and
  // external backend scripts are unrelated to the changed equation catalogue.
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]).filter(source => source.includes('const MODULES ='));
  assert.equal(scripts.length, 1, 'expected one application script');
  const element = () => ({
    children: [], dataset: {}, style: { setProperty() {} },
    appendChild(child) { this.children.push(child); },
  });
  const sections = element();
  const math = Object.create(Math);
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const context = vm.createContext({
    Math: math,
    document: {
      createElement: element,
      getElementById(id) {
        assert.equal(id, 'sections', 'only menu construction should access the DOM');
        return sections;
      },
    },
  });
  vm.runInContext(scripts[0], context, { filename: 'index.html', timeout: 1000 });
  return {
    evaluate: source => vm.runInContext(source, context, { timeout: 1000 }),
    sections,
  };
}

function assertValidQuestions(questions) {
  assert.equal(questions.length, 10);
  assert.equal(new Set(questions.map(q => q.html)).size, 10, 'no repeated equations');
  for (const { html: equation, ans } of questions) {
    const parts = equation.match(/^(\d+,\d+)x \+ (\d+(?:,\d+)?) = (-?\d+(?:,\d+)?)$/);
    assert.ok(parts, `French decimal notation: ${equation}`);
    const [a, b, c] = parts.slice(1).map(value => Number(value.replace(',', '.')));
    assert.ok(Number.isInteger(ans) && ans >= -7 && ans <= 7, `integer solution: ${ans}`);
    assert.ok(a >= 0.2 && a <= 0.8, `nonzero decimal coefficient: ${a}`);
    assert.ok(b >= 0.3 && b <= 1.1, `constant: ${b}`);
    // Compare exact hundredths to avoid making the test sensitive to binary
    // floating-point representation of decimal coefficients.
    assert.equal(Math.round(a * 100) * ans + Math.round(b * 100), Math.round(c * 100), equation);
  }
}

test('the equation catalogue contains exactly levels 1–10 without obsolete cards', () => {
  const app = loadCatalogue();
  const keys = Array.from(app.evaluate(`Object.keys(MODULES).filter(key => MODULES[key].group === 'Équations')`));
  assert.deepEqual(keys, Array.from({ length: 10 }, (_, i) => `eq_niv${i + 1}`));
  for (const key of ['eq_produit', 'eq_parentheses', 'eq_deux_membres', 'veq']) {
    assert.equal(app.evaluate(`Object.hasOwn(MODULES, '${key}')`), false, key);
  }
  const cards = app.sections.children.flatMap(section => section.children)
    .filter(card => card.dataset.module?.startsWith('Équations — Niveau'));
  assert.deepEqual(cards.map(card => card.dataset.module),
    Array.from({ length: 10 }, (_, i) => `Équations — Niveau ${i + 1}`));
});

test('level 10 uses the decimal answer contract and a 60 second timer', () => {
  const app = loadCatalogue();
  const metadata = JSON.parse(app.evaluate(`JSON.stringify({
    title: MODULES.eq_niv10.title, ansType: MODULES.eq_niv10.ansType,
    tol: MODULES.eq_niv10.tol, time: MODULES.eq_niv10.time,
    smallFont: MODULES.eq_niv10.smallFont
  })`));
  assert.deepEqual(metadata, {
    title: 'Équations — Niveau 10', ansType: 'decimal', tol: 0.001, time: 60, smallFont: true,
  });
});

test('level 10 generates ten distinct, correctly solved equations across seeded shuffles', () => {
  for (const seed of [1, 7, 42, 123, 65535]) {
    const app = loadCatalogue(seed);
    for (let round = 0; round < 3; round++) {
      assertValidQuestions(app.evaluate('MODULES.eq_niv10.gen()'));
    }
  }
});

test('level 10 handles negative, zero, and positive solutions and rounded decimal results', () => {
  const app = loadCatalogue();
  // Choose successive portions of the pool through the shuffle boundary so
  // boundary coverage does not depend on which questions random sampling picks.
  app.evaluate('globalThis.offset = 0; shuffle = pool => { const first = pool.splice(0, offset); pool.push(...first); };');
  const all = [];
  for (const offset of [0, 10, 20, 30, 40]) {
    app.evaluate(`offset = ${offset}`);
    const questions = app.evaluate('MODULES.eq_niv10.gen()');
    assertValidQuestions(questions);
    all.push(...questions);
  }
  assert.ok(all.some(q => q.ans === -7), 'lowest solution');
  assert.ok(all.some(q => q.ans === 7), 'highest solution');
  assert.ok(all.some(q => q.ans === 0), 'zero solution');
  assert.ok(all.some(q => q.html.endsWith(' = 0')), 'zero right-hand side');
  assert.ok(all.some(q => q.html.includes(' = -')), 'negative right-hand side');
  assert.ok(all.some(q => q.html.startsWith('0,2x')), 'lowest coefficient');
  assert.ok(all.some(q => q.html.startsWith('0,8x')), 'highest coefficient');
});

test('level 10 returns a new question set on replay without mutating previous results', () => {
  const app = loadCatalogue(42);
  const first = app.evaluate('MODULES.eq_niv10.gen()');
  const before = JSON.stringify(first);
  const second = app.evaluate('MODULES.eq_niv10.gen()');
  assert.notStrictEqual(first, second);
  assert.equal(JSON.stringify(first), before);
  assert.notDeepEqual(second.map(q => q.html), first.map(q => q.html));
  assertValidQuestions(second);
});

test('level 10 remains valid at both boundaries of the shuffle random input', () => {
  for (const random of [0, 1 - Number.EPSILON]) {
    const app = loadCatalogue();
    app.evaluate(`Math.random = () => ${random}`);
    assertValidQuestions(app.evaluate('MODULES.eq_niv10.gen()'));
  }
});

test('mutating a question from one series cannot change a replayed series', () => {
  const app = loadCatalogue();
  // Repeat the same shuffle so the replay includes the mutated question.
  app.evaluate('Math.random = () => 0; globalThis.first = MODULES.eq_niv10.gen();');
  const first = app.evaluate('first');
  const originalEquation = first[0].html;
  const originalAnswer = first[0].ans;
  first[0].html = 'corrupted equation';
  first[0].ans = 999;

  const replay = app.evaluate('MODULES.eq_niv10.gen()');
  assert.notStrictEqual(replay[0], first[0]);
  assert.equal(replay[0].html, originalEquation);
  assert.equal(replay[0].ans, originalAnswer);
  assertValidQuestions(replay);
});
