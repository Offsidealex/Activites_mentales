// Dependency-free tests of the real inline script, with browser/backend edges
// replaced locally. Command: node --test tests/upe2a.test.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { describe, test, mock } = require('node:test');
const vm = require('node:vm');

const html = readFileSync(join(__dirname, '..', 'upe2a.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/.test(match[1])).map(match => match[2]);
assert.equal(scripts.length, 1, 'expected one UPE2A application script');

// Explicit cases keep the intended progression independent of LEVEL_SEQUENCES.
const activities = [
  { type: 'additions', levels: [1, 2, 3, 4], menu: 'showAdditionsLevels', start: 'startAdditionsQuiz', count: 10 },
  { type: 'soustractions', levels: [1, 2, 3, 4], menu: 'showSoustractionsLevels', start: 'startSoustractionsQuiz', count: 10 },
  { type: 'nombres', levels: [10, 20, 100, 1000], menu: 'showNombresLevels', start: 'startNombresQuiz', count: 10 },
  { type: 'magic', levels: [1, 2, 3, 4], menu: 'showCarresMagiquesLevels', start: 'startCarreMagique' },
  { type: 'heure', levels: [1, 2, 3], menu: 'showHeureLevels', start: 'startHeureQuiz', count: 8 },
  { type: 'geo', levels: [1, 2, 3], menu: 'showGeoLevels', start: 'startGeoQuiz', count: 8 },
  { type: 'mesures', levels: [1, 2, 3, 4], menu: 'showMesuresLevels', start: 'startMesuresQuiz', count: 8 },
  { type: 'monnaie', levels: [1, 2, 3], menu: 'showMonnaieLevels', start: 'startMonnaieQuiz', count: 6 },
];
const student = { prenom: 'Ana Maria', classe: 'UPE2A' };

function loadApp({ eleve = null, backend = true, storage = new Map(), crypto = undefined, storageUnavailable = false } = {}) {
  const elements = new Map();
  const state = { readError: storageUnavailable, writeError: storageUnavailable };
  const localStorage = {
    getItem: mock.fn(key => {
      if (state.readError) throw new Error('storage access denied');
      return storage.get(key) ?? null;
    }),
    setItem: mock.fn((key, value) => {
      if (state.writeError) throw new Error('storage quota exceeded');
      storage.set(key, String(value));
    }),
    removeItem: mock.fn(key => storage.delete(key)),
  };
  function element(id, className = '') {
    const classes = new Set(className.split(/\s+/).filter(Boolean));
    let content = '';
    return {
      id, value: '', textContent: '', disabled: false, title: '', style: {}, buttons: [],
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle(name, force = !classes.has(name)) {
          if (force) classes.add(name); else classes.delete(name);
          return force;
        },
      },
      addEventListener() {},
      insertAdjacentHTML(position, markup) {
        assert.equal(position, 'beforeend');
        content += markup;
      },
      get innerHTML() { return content; },
      set innerHTML(markup) {
        content = markup;
        // Only the dynamically rendered buttons/inputs needed by these tests
        // are modelled; this fixture is not intended to emulate a full DOM.
        this.buttons = [...markup.matchAll(/<button\b[^>]*>/g)].map((_, i) => element(`${id}-button-${i}`));
        for (const match of markup.matchAll(/<input\b[^>]*\bid="([^"]+)"/g)) {
          elements.set(match[1], element(match[1]));
        }
      },
    };
  }
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    elements.set(match[1], element(match[1], match[0].match(/class="([^"]*)"/)?.[1]));
  }
  const getElement = id => {
    assert.ok(elements.has(id), `unknown element: ${id}`);
    return elements.get(id);
  };
  let guestNumber = 0;
  let seed = 42;
  const math = Object.create(Math);
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const AM = backend ? {
    currentEleve: mock.fn(() => eleve), sendSession: mock.fn(), logoutStudent: mock.fn(),
  } : undefined;
  const sandbox = {
    AM, Math: math, localStorage,
    crypto: crypto === undefined ? { randomUUID: mock.fn(() => `guest-${++guestNumber}`) } : crypto,
    alert: mock.fn(), console: { warn: mock.fn() }, location: { replace: mock.fn() },
    document: {
      getElementById: getElement,
      querySelectorAll(selector) {
        assert.equal(selector, '#levels-list button');
        return getElement('levels-list').buttons;
      },
    },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  const evaluate = source => vm.runInContext(source, context, { timeout: 1000 });
  vm.runInContext(scripts[0], context, { filename: 'upe2a.html', timeout: 1000 });
  // Question rendering is unchanged by the PR. Keep real navigation, quiz
  // generation, guards, persistence, and results while isolating that renderer.
  context.renderQuestion = mock.fn();
  return {
    evaluate, getElement, storage, state, localStorage, AM,
    alerts: sandbox.alert, warnings: sandbox.console.warn, redirects: sandbox.location.replace,
    read: source => JSON.parse(JSON.stringify(evaluate(source))),
    put: (key, value) => storage.set(key, JSON.stringify(value)),
  };
}

function session(overrides = {}) {
  return {
    student_name: student.prenom, class_id: student.classe,
    exercise_type: 'additions', level: '1', score: 8, total: 10, ...overrides,
  };
}

function finish(app, { score = 8, total = 10, type = 'additions', level = '1' } = {}) {
  app.evaluate(`quiz = { score: ${score}, questions: Array(${total}).fill({}),
    type: ${JSON.stringify(type)}, level: ${JSON.stringify(level)} }; finishQuiz();`);
}

function solveMagicSquare(app) {
  app.evaluate(`startCarreMagique(1);
    for (const [r,c] of magicHiddenCells) {
      document.getElementById('mc-'+r+'-'+c).value = String(currentMagicSquare[r][c]);
    }
    checkCarreMagique();`);
  assert.equal(app.getElement('magic-check-btn').disabled, true, 'solution was accepted');
  assert.equal(app.evaluate('getSessions()[0].score'), 1, 'success was recorded');
}

describe('guest access and identity', () => {
  test('opens the menu as a guest without backend or login redirection', () => {
    const app = loadApp({ backend: false });
    assert.deepEqual(app.read('user'), {
      name: 'Invité', classId: 'INVITE', className: 'Parcours libre', guestId: 'guest-1',
    });
    assert.equal(app.getElement('screen-menu').classList.contains('hidden'), false);
    assert.equal(app.getElement('screen-login').classList.contains('hidden'), true);
    assert.equal(app.getElement('menu-name').textContent, 'Invité');
    assert.equal(app.redirects.mock.callCount(), 0);
    assert.equal(app.storage.has('upe2a_user'), false);
  });

  test('guest scores and unlocks survive page reload and change rotates identity', () => {
    const storage = new Map();
    const first = loadApp({ storage });
    finish(first, { score: 8 });
    const guestId = first.evaluate('user.guestId');
    const reloaded = loadApp({ storage });
    assert.equal(reloaded.evaluate('user.guestId'), guestId);
    assert.equal(reloaded.evaluate("levelUnlocked('additions', 2)"), true);
    assert.equal(reloaded.evaluate('getStudentSessions(user.name,user.classId).length'), 1);
    reloaded.evaluate('logout()');
    assert.notEqual(reloaded.evaluate('user.guestId'), guestId);
    assert.equal(reloaded.evaluate("levelUnlocked('additions', 2)"), false);
    assert.equal(reloaded.evaluate('getStudentSessions(user.name,user.classId).length'), 0);
  });

  test('does not restore stale local student data when backend authentication is absent', () => {
    const storage = new Map([['upe2a_user', JSON.stringify({ name: 'Old student', classId: 'UPE2A' })]]);
    const app = loadApp({ storage });
    assert.equal(app.evaluate('user.classId'), 'INVITE');
  });

  test('guest startup and quiz results work when browser storage is completely unavailable', () => {
    const app = loadApp({ backend: false, storageUnavailable: true });
    assert.equal(app.evaluate('user.classId'), 'INVITE');
    assert.equal(app.getElement('screen-menu').classList.contains('hidden'), false);
    assert.doesNotThrow(() => finish(app));
    assert.equal(app.getElement('screen-result').classList.contains('hidden'), false);
    assert.equal(app.getElement('result-score').textContent, 8);
    assert.equal(app.warnings.mock.callCount(), 2);
  });

  test('uses a fresh UUID for each guest and scopes progression to that UUID', () => {
    const app = loadApp();
    const first = app.read('newGuest()');
    const second = app.read('newGuest()');
    assert.notEqual(first.guestId, second.guestId);
    assert.equal(app.evaluate('progressionKey(user)'), 'guest:guest-1');
  });

  for (const crypto of [null, {}]) {
    test(`creates distinct fallback IDs when ${crypto === null ? 'crypto is unavailable' : 'randomUUID is unavailable'}`, () => {
      const app = loadApp({ crypto });
      const first = app.read('newGuest()');
      const second = app.read('newGuest()');
      assert.match(first.guestId, /^\d+-[a-z0-9]+$/);
      assert.notEqual(first.guestId, second.guestId);
    });
  }

  for (const [eleve, expected] of [
    [student, { name: 'Ana Maria', classId: 'UPE2A' }],
    [{ pseudo: 'Pseudonyme', classe: 'MATHS1' }, { name: 'Pseudonyme', classId: 'MATHS1' }],
    [{}, { name: 'Élève', classId: 'UPE2A' }],
  ]) {
    test(`keeps an authenticated student on the menu: ${expected.name}`, () => {
      const app = loadApp({ eleve });
      assert.deepEqual(app.read('user'), expected);
      assert.equal(app.getElement('menu-name').textContent, expected.name.split(' ')[0]);
      assert.equal(app.evaluate('progressionKey(user)'), `student:${expected.classId}:${expected.name}`);
      assert.equal(app.redirects.mock.callCount(), 0);
    });
  }

  for (const backend of [true, false]) {
    test(`logout creates a new guest and returns to the menu (backend ${backend})`, () => {
      const app = loadApp({ backend, eleve: student });
      app.put('upe2a_user', { name: 'Ana Maria', classId: 'UPE2A' });
      app.put('upe2a_sessions', [session()]);
      app.getElement('input-name').value = 'Ana Maria';
      app.evaluate('logout()');
      const firstId = app.evaluate('user.guestId');
      app.evaluate('logout()');
      assert.notEqual(app.evaluate('user.guestId'), firstId);
      assert.equal(app.evaluate('user.classId'), 'INVITE');
      assert.equal(app.storage.has('upe2a_user'), false);
      assert.equal(app.getElement('input-name').value, '');
      assert.equal(app.getElement('screen-menu').classList.contains('hidden'), false);
      assert.equal(app.getElement('screen-login').classList.contains('hidden'), true);
      assert.equal(app.evaluate('getSessions().length'), 1, 'history is retained');
      if (backend) assert.equal(app.AM.logoutStudent.mock.callCount(), 2);
    });
  }
});

describe('local history and profile isolation', () => {
  test('guest history excludes other guests, old unscoped records, and students', () => {
    const app = loadApp();
    const own = session({ student_name: 'Invité', class_id: 'INVITE', guest_id: 'guest-1' });
    app.put('upe2a_sessions', [own,
      // Keep historical identities separate from the fixture's next UUID on logout.
      { ...own, guest_id: 'historical-guest' }, { ...own, guest_id: undefined },
      { ...own, class_id: 'UPE2A' }, { ...own, student_name: 'Someone else' },
    ]);
    assert.deepEqual(app.read("getStudentSessions(user.name, user.classId)"), [own]);
    assert.equal(app.evaluate("levelUnlocked('additions', 2)"), true);
    app.evaluate('logout()');
    assert.equal(app.evaluate('getStudentSessions(user.name, user.classId).length'), 0);
    assert.equal(app.evaluate("levelUnlocked('additions', 2)"), false);
    assert.ok(!app.getElement('score-summary').innerHTML.includes('8/10'));
  });

  test('student history requires both matching name and class', () => {
    const app = loadApp({ eleve: student });
    const own = session();
    app.put('upe2a_sessions', [own,
      session({ student_name: 'Ben' }), session({ class_id: 'MATHS1' }),
      session({ student_name: 'Invité', class_id: 'INVITE', guest_id: 'guest-1' }),
    ]);
    assert.deepEqual(app.read('getStudentSessions(user.name, user.classId)'), [own]);
  });

  for (const key of ['upe2a_unlocks', 'upe2a_sessions']) {
    test(`${key} tolerates missing, null, malformed, and inaccessible storage`, () => {
      const app = loadApp();
      const getter = key === 'upe2a_unlocks' ? 'getUnlocks()' : 'getSessions()';
      const expected = key === 'upe2a_unlocks' ? {} : [];
      for (const raw of [undefined, 'null', '{broken json']) {
        if (raw === undefined) app.storage.delete(key); else app.storage.set(key, raw);
        assert.deepEqual(app.read(getter), expected);
      }
      app.state.readError = true;
      assert.deepEqual(app.read(getter), expected);
      assert.equal(app.evaluate("levelUnlocked('additions', 2)"), false);
    });
  }

  test('saveSession prepends a timestamped result and caps history at 200 without losing fields', () => {
    const app = loadApp();
    app.put('upe2a_sessions', Array.from({ length: 200 }, (_, i) => session({ marker: i })));
    app.evaluate(`saveSession({student_name:'Invité',class_id:'INVITE',guest_id:'guest-1',
      exercise_type:'additions',level:'1',score:8,total:10})`);
    const history = app.read('getSessions()');
    const { completed_at, ...result } = history[0];
    assert.deepEqual(result, session({ student_name: 'Invité', class_id: 'INVITE', guest_id: 'guest-1' }));
    assert.equal(new Date(completed_at).toISOString(), completed_at);
    assert.equal(history.length, 200);
    assert.equal(history[1].marker, 0);
    assert.equal(history.at(-1).marker, 198);
  });

  test('saveSession catches storage write failures without destroying stored history', () => {
    const app = loadApp();
    app.put('upe2a_sessions', [session()]);
    const before = app.storage.get('upe2a_sessions');
    app.state.writeError = true;
    assert.doesNotThrow(() => app.evaluate('saveSession({score: 1, total: 1})'));
    assert.equal(app.storage.get('upe2a_sessions'), before);
    assert.equal(app.warnings.mock.callCount(), 1);
  });
});

describe('80 percent progression', () => {
  for (const { type, levels } of activities) {
    test(`${type}: only the first level is initially open`, () => {
      const app = loadApp({ eleve: student });
      assert.equal(app.evaluate(`levelUnlocked('${type}', ${levels[0]})`), true);
      for (const level of levels.slice(1)) {
        assert.equal(app.evaluate(`levelUnlocked('${type}', ${level})`), false, `level ${level}`);
      }
    });

    test(`${type}: a pass unlocks only the immediate successor, accepting numeric and string levels`, () => {
      const app = loadApp({ eleve: student });
      for (let i = 1; i < levels.length; i++) {
        for (const previous of [levels[i - 1], String(levels[i - 1])]) {
          app.put('upe2a_sessions', [session({ exercise_type: type, level: previous })]);
          assert.equal(app.evaluate(`levelUnlocked('${type}', ${levels[i]})`), true);
          assert.equal(app.evaluate(`levelUnlocked('${type}', '${levels[i]}')`), true);
          if (i + 1 < levels.length) {
            assert.equal(app.evaluate(`levelUnlocked('${type}', ${levels[i + 1]})`), false);
          }
        }
      }
    });
  }

  for (const [score, total, expected] of [
    [8, 10, true], [4, 5, true], [16, 20, true], ['8', '10', true], [10, 10, true],
    [7, 10, false], [7, 9, false], [79, 100, false], [799, 1000, false],
    [0, 10, false], [0, 0, false], [1, 0, false], [8, -10, false],
    ['invalid', 10, false], [8, 'invalid', false],
  ]) {
    test(`${score}/${total} ${expected ? 'unlocks' : 'does not unlock'} the next level`, () => {
      const app = loadApp({ eleve: student });
      for (const { type, levels } of activities) {
        app.put('upe2a_sessions', [session({ exercise_type: type, level: levels[0], score, total })]);
        assert.equal(app.evaluate(`levelUnlocked('${type}', ${levels[1]})`), expected, type);
      }
    });
  }

  test('ignores passing results for another activity, level, student, or class', () => {
    const app = loadApp({ eleve: student });
    for (const wrong of [
      { exercise_type: 'soustractions' }, { level: '2' },
      { student_name: 'Ben' }, { class_id: 'MATHS1' },
    ]) {
      app.put('upe2a_sessions', [session(wrong)]);
      assert.equal(app.evaluate("levelUnlocked('additions', 2)"), false, JSON.stringify(wrong));
    }
  });

  test('a later failed attempt does not revoke a historical pass', () => {
    const app = loadApp({ eleve: student });
    app.put('upe2a_sessions', [session({ score: 0 }), session()]);
    assert.equal(app.evaluate("levelUnlocked('additions', 2)"), true);
  });

  test('unsequenced activities such as multiplication tables remain open', () => {
    const app = loadApp();
    for (const level of ['2_A', '10_B', '0_C']) {
      assert.equal(app.evaluate(`levelUnlocked('tables', '${level}')`), true);
    }
  });

  test('persisted unlocks remain open with no matching history and stay isolated by profile and activity', () => {
    const app = loadApp({ eleve: student });
    app.put('upe2a_unlocks', {
      'student:UPE2A:Ana Maria': { additions: ['2'] },
      'student:UPE2A:Ben': { additions: ['3'] },
      'student:MATHS1:Ana Maria': { additions: ['4'] },
      'guest:guest-1': { soustractions: ['2'] },
    });
    assert.equal(app.evaluate("levelUnlocked('additions', 2)"), true);
    assert.equal(app.evaluate("levelUnlocked('additions', 3)"), false);
    assert.equal(app.evaluate("levelUnlocked('additions', 4)"), false);
    assert.equal(app.evaluate("levelUnlocked('soustractions', 2)"), false);
    app.evaluate('user = newGuest()');
    assert.equal(app.evaluate("levelUnlocked('soustractions', 2)"), true);
    assert.equal(app.evaluate("levelUnlocked('additions', 2)"), false);
    app.evaluate('user = newGuest()');
    assert.equal(app.evaluate("levelUnlocked('soustractions', 2)"), false);
  });

  test('earned unlocks are deduplicated and preserve other activities and profiles', () => {
    const app = loadApp({ eleve: student });
    app.put('upe2a_unlocks', { 'student:UPE2A:Ben': { additions: ['2'] } });
    for (const { type, levels } of activities) {
      app.evaluate(`earnUnlock('${type}', ${levels[0]}); earnUnlock('${type}', '${levels[0]}')`);
    }
    const unlocks = app.read('getUnlocks()');
    assert.deepEqual(unlocks['student:UPE2A:Ben'], { additions: ['2'] });
    for (const { type, levels } of activities) {
      assert.deepEqual(unlocks['student:UPE2A:Ana Maria'][type], [String(levels[1])]);
    }
  });

  test('the final level and unsequenced activities do not create extra unlocks', () => {
    const app = loadApp({ eleve: student });
    for (const { type, levels } of activities) app.evaluate(`earnUnlock('${type}', ${levels.at(-1)})`);
    app.evaluate("earnUnlock('tables', '2_A')");
    assert.equal(app.localStorage.setItem.mock.callCount(), 0);
    assert.deepEqual(app.read('getUnlocks()'), {});
  });

  test('earning a level recovers malformed unlock JSON and catches write failures', () => {
    const app = loadApp({ eleve: student });
    app.storage.set('upe2a_unlocks', '{broken');
    app.evaluate("earnUnlock('additions', 1)");
    assert.equal(app.evaluate("levelUnlocked('additions', 2)"), true);
    app.state.writeError = true;
    assert.doesNotThrow(() => app.evaluate("earnUnlock('additions', 2)"));
    assert.equal(app.evaluate("levelUnlocked('additions', 3)"), false);
    assert.equal(app.warnings.mock.callCount(), 1);
  });

  test('a passing result still unlocks after history eviction and a student reload', () => {
    const app = loadApp({ eleve: student });
    finish(app);
    app.evaluate(`for (let i = 0; i < 200; i++) saveSession({student_name: user.name,
      class_id: user.classId, exercise_type:'tables',level:'2_A',score:0,total:10})`);
    assert.equal(app.evaluate("getSessions().some(s => s.exercise_type === 'additions')"), false);
    const reloaded = loadApp({ eleve: student, storage: app.storage });
    assert.equal(reloaded.evaluate("levelUnlocked('additions', 2)"), true);
  });
});

describe('visible locks and direct quiz launch guards', () => {
  for (const { type, levels, menu, start, count } of activities) {
    test(`${type}: renders locked buttons and rebuilds the menu after unlocking`, () => {
      const app = loadApp({ eleve: student });
      app.evaluate(`${menu}()`);
      const buttons = app.getElement('levels-list').buttons;
      assert.equal(buttons.length, levels.length);
      assert.equal(buttons[0].disabled, false);
      assert.equal(app.getElement('screen-levels').classList.contains('hidden'), false);
      for (const button of buttons.slice(1)) {
        assert.equal(button.disabled, true);
        assert.equal(button.classList.contains('opacity-50'), true);
        assert.equal(button.classList.contains('cursor-not-allowed'), true);
        assert.match(button.title, /80 %/);
        assert.match(button.innerHTML, /🔒/);
      }
      app.evaluate(`earnUnlock('${type}', ${levels[0]}); showMenu(); ${menu}()`);
      const rebuilt = app.getElement('levels-list').buttons;
      assert.equal(rebuilt[1].disabled, false);
      assert.equal(rebuilt[1].classList.contains('opacity-50'), false);
      assert.equal(rebuilt[1].innerHTML.includes('🔒'), false);
      assert.equal(rebuilt[2].disabled, true);
    });

    test(`${type}: a direct call cannot start a locked level or change quiz state`, () => {
      const app = loadApp({ eleve: student });
      const before = app.read('[quiz,lastQuizConfig,currentMagicLevel,currentHeureLevel,currentGeoLevel,currentMesureLevel]');
      app.evaluate(`${start}(${levels[1]})`);
      assert.deepEqual(app.read('[quiz,lastQuizConfig,currentMagicLevel,currentHeureLevel,currentGeoLevel,currentMesureLevel]'), before);
      assert.equal(app.alerts.mock.callCount(), 1);
      assert.match(app.alerts.mock.calls[0].arguments[0], /80 %/);
      assert.equal(app.getElement('screen-menu').classList.contains('hidden'), false);
      assert.equal(app.localStorage.setItem.mock.callCount(), 0);
    });

    test(`${type}: first and newly unlocked levels can start`, () => {
      const app = loadApp({ eleve: student });
      for (const level of levels.slice(0, 2)) {
        app.evaluate(`${start}(${level})`);
        if (type === 'magic') {
          assert.equal(app.evaluate('currentMagicLevel'), level);
          assert.equal(app.getElement('screen-magic').classList.contains('hidden'), false);
        } else {
          assert.equal(app.evaluate('quiz.type'), type);
          assert.equal(app.evaluate('quiz.level'), String(level));
          assert.equal(app.evaluate('quiz.questions.length'), count);
          assert.equal(app.getElement('screen-quiz').classList.contains('hidden'), false);
        }
        app.put('upe2a_sessions', [session({ exercise_type: type, level: String(levels[0]) })]);
      }
      assert.equal(app.alerts.mock.callCount(), 0);
    });
  }

  test('updateLevelLocks tolerates fewer rendered buttons than level entries', () => {
    const app = loadApp();
    app.getElement('levels-list').innerHTML = '<button>First level</button>';
    assert.doesNotThrow(() => app.evaluate("updateLevelLocks('additions', ['1','2','3','4'])"));
  });

  test('requireUnlocked alerts only for locked levels', () => {
    const app = loadApp();
    assert.equal(app.evaluate("requireUnlocked('additions', 1)"), true);
    assert.equal(app.alerts.mock.callCount(), 0);
    assert.equal(app.evaluate("requireUnlocked('additions', 2)"), false);
    assert.equal(app.alerts.mock.callCount(), 1);
  });

  for (const mode of ['A', 'B', 'C']) {
    test(`multiplication mode ${mode} remains launchable without prior scores`, () => {
      const app = loadApp();
      app.evaluate(`startTablesQuiz(2, '${mode}')`);
      assert.equal(app.evaluate('quiz.type'), 'tables');
      assert.equal(app.evaluate('quiz.level'), `2_${mode}`);
      assert.equal(app.alerts.mock.callCount(), 0);
      assert.deepEqual(app.read('getUnlocks()'), {});
    });
  }
});

describe('quiz completion', () => {
  test('guest results stay local even if the backend still reports an authenticated student', () => {
    const app = loadApp({ eleve: student });
    app.evaluate('user = newGuest()');
    app.AM.currentEleve.mock.resetCalls();
    finish(app);
    assert.equal(app.AM.currentEleve.mock.callCount(), 0);
    assert.equal(app.AM.sendSession.mock.callCount(), 0);
    assert.equal(app.evaluate('getSessions()[0].guest_id'), app.evaluate('user.guestId'));
    assert.equal(app.evaluate("levelUnlocked('additions', 2)"), true);
    assert.equal(app.getElement('result-score').textContent, 8);
    assert.equal(app.getElement('result-total').textContent, 10);
    assert.equal(app.getElement('screen-result').classList.contains('hidden'), false);
    app.evaluate('showMenu()');
    assert.ok(app.getElement('score-summary').innerHTML.includes('8/10'));
  });

  test('student completion preserves local identity and sends the expected backend payload', () => {
    const app = loadApp({ eleve: student });
    finish(app);
    const history = app.read('getSessions()');
    assert.equal(history[0].student_name, student.prenom);
    assert.equal(history[0].class_id, student.classe);
    assert.equal(history[0].guest_id, null);
    assert.equal(app.AM.sendSession.mock.callCount(), 1);
    const payload = app.AM.sendSession.mock.calls[0].arguments[0];
    assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
      exercice: 'UPE2A | additions | Niveau 1', score: 8, nb_questions: 10,
      duree_totale_ms: null, reponses: [],
    });
  });

  test('does not send student results when backend authentication has expired', () => {
    const app = loadApp({ eleve: student });
    app.AM.currentEleve.mock.mockImplementation(() => null);
    finish(app);
    assert.equal(app.AM.sendSession.mock.callCount(), 0);
    assert.equal(app.evaluate('getSessions().length'), 1);
  });

  for (const [score, total, unlock] of [[8, 10, true], [7, 10, false], [4, 5, true], [0, 0, false]]) {
    test(`completion at ${score}/${total} ${unlock ? 'persists' : 'does not persist'} an unlock`, () => {
      const app = loadApp({ eleve: student });
      finish(app, { score, total });
      assert.equal(app.storage.has('upe2a_unlocks'), unlock);
      assert.equal(app.evaluate("levelUnlocked('additions', 2)"), unlock);
    });
  }

  test('guest completion without a backend succeeds despite storage write failures', () => {
    const app = loadApp({ backend: false });
    app.state.writeError = true;
    assert.doesNotThrow(() => finish(app));
    assert.equal(app.getElement('screen-result').classList.contains('hidden'), false);
    assert.equal(app.getElement('result-score').textContent, 8);
    assert.equal(app.storage.size, 0);
    assert.equal(app.warnings.mock.callCount(), 2, 'unlock and history failures are caught');
  });

  test('table results do not grant sequenced activity unlocks', () => {
    const app = loadApp();
    finish(app, { score: 10, type: 'tables', level: '2_A' });
    assert.deepEqual(app.read('getUnlocks()'), {});
    assert.equal(app.evaluate('getSessions()[0].exercise_type'), 'tables');
  });

  test('a guest can unlock magic-square level 2 after solving level 1', () => {
    const app = loadApp();
    solveMagicSquare(app);
    assert.equal(app.evaluate("levelUnlocked('magic', 2)"), true);
  });

  test('a student magic-square unlock survives history eviction', () => {
    const app = loadApp({ eleve: student });
    solveMagicSquare(app);
    assert.equal(app.evaluate("levelUnlocked('magic', 2)"), true, 'history initially unlocks level 2');
    app.evaluate(`for (let i = 0; i < 200; i++) saveSession({student_name: user.name,
      class_id: user.classId, exercise_type:'tables',level:'2_A',score:0,total:10})`);
    assert.equal(app.evaluate("getSessions().some(s => s.exercise_type === 'magic')"), false);
    assert.equal(app.evaluate("levelUnlocked('magic', 2)"), true);
  });
});

describe('independent persistence failures and absent identity', () => {
  test('a saved unlock survives a failed history write and a student reload', () => {
    const app = loadApp({ eleve: student });
    app.localStorage.setItem.mock.mockImplementation((key, value) => {
      if (key === 'upe2a_sessions') throw new Error('history quota exceeded');
      app.storage.set(key, String(value));
    });

    assert.doesNotThrow(() => finish(app));
    assert.equal(app.warnings.mock.callCount(), 1);
    assert.equal(app.storage.has('upe2a_sessions'), false);
    assert.equal(app.evaluate("levelUnlocked('additions', 2)"), true);
    assert.equal(app.getElement('screen-result').classList.contains('hidden'), false);

    const reloaded = loadApp({ eleve: student, storage: app.storage });
    assert.equal(reloaded.evaluate("levelUnlocked('additions', 2)"), true);
  });

  test('passing history still unlocks a level when the unlock write fails', () => {
    const app = loadApp({ eleve: student });
    app.localStorage.setItem.mock.mockImplementation((key, value) => {
      if (key === 'upe2a_unlocks') throw new Error('unlock quota exceeded');
      app.storage.set(key, String(value));
    });

    assert.doesNotThrow(() => finish(app));
    assert.equal(app.warnings.mock.callCount(), 1);
    assert.equal(app.storage.has('upe2a_unlocks'), false);
    assert.equal(app.evaluate('getSessions().length'), 1);
    assert.equal(app.evaluate("levelUnlocked('additions', 2)"), true);
    assert.equal(app.getElement('screen-result').classList.contains('hidden'), false);
  });

  test('guest history cannot be read without an active user', () => {
    const app = loadApp();
    app.put('upe2a_sessions', [session({
      student_name: 'Invité', class_id: 'INVITE', guest_id: app.evaluate('user.guestId'),
    })]);
    app.evaluate('user = null');
    assert.deepEqual(app.read("getStudentSessions('Invité', 'INVITE')"), []);
  });

  test('logout still creates an isolated guest when the backend has no logout method', () => {
    const app = loadApp();
    const previous = app.evaluate('user.guestId');
    delete app.AM.logoutStudent;
    assert.doesNotThrow(() => app.evaluate('logout()'));
    assert.equal(app.evaluate('user.classId'), 'INVITE');
    assert.notEqual(app.evaluate('user.guestId'), previous);
    assert.equal(app.getElement('screen-menu').classList.contains('hidden'), false);
  });
});
