// The arcade shell: menu, per-game setup, face-off series, the random reel,
// settings (names, keys, sound), and the round lifecycle every game plugs into.
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('duel:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem('duel:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
    },
  };

  const games = [];
  const COLORS = [null, '#7cc4ff', '#ff8f6b', '#93d68b', '#e6c46e'];
  const Arcade = {
    P1: COLORS[1],
    P2: COLORS[2],
    COLORS,
    font: (px, style = '') => `${style} ${px}px "Times New Roman", Times, serif`,
    el, store, esc,
    register: (g) => games.push(g),
    init,
  };
  window.Arcade = Arcade;

  // ---------- preferences and key bindings ----------
  const DEFAULT_KEYS = {
    1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'KeyF' },
    2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'KeyJ' },
    3: { up: 'KeyT', down: 'KeyG' },
    4: { up: 'KeyI', down: 'KeyK' },
  };
  const ACTION_NAMES = { up: 'Up / jump', down: 'Down / duck', left: 'Left', right: 'Right', action: 'Action' };

  const prefs = Object.assign(
    { p1: 'Player 1', p2: 'Player 2', p3: 'Player 3', p4: 'Player 4', sound: true, motion: 'full', countdown: true },
    store.get('prefs', {})
  );
  function loadKeys(saved) {
    const k = {};
    for (const p of [1, 2, 3, 4]) k[p] = Object.assign({}, DEFAULT_KEYS[p], (saved || {})[p] || {});
    return k;
  }
  prefs.keys = loadKeys(prefs.keys);
  const savePrefs = () => store.set('prefs', prefs);

  function keyLabel(code) {
    if (!code) return '?';
    const arrows = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
    if (arrows[code]) return arrows[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'num ' + code.slice(6);
    const named = {
      Space: 'Space', ShiftLeft: 'left Shift', ShiftRight: 'right Shift', ControlLeft: 'left Ctrl', ControlRight: 'right Ctrl',
      AltLeft: 'left Option', AltRight: 'right Option', MetaLeft: 'left Cmd', MetaRight: 'right Cmd', Semicolon: ';', Quote: "'",
      Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=',
      Backquote: '`', Tab: 'Tab', Backspace: 'Delete', CapsLock: 'Caps Lock',
    };
    return named[code] || code;
  }
  const kbd = (code) => `<kbd>${esc(keyLabel(code))}</kbd>`;

  // Which seats in a setup are played by the computer, and how well.
  function seatLevel(s, p) {
    if (!s) return 0;
    if (s.players === 2 && s.opponent === 'bot' && p === 2) return s.level;
    if (s.players === 4 && p > 4 - (s.bots || 0)) return s.level;
    return 0;
  }

  // Key codes for a player's action. Playing alone, both players' keys work.
  function codesFor(s, p, action) {
    const own = prefs.keys[p] && prefs.keys[p][action];
    const list = own ? [own] : [];
    if (s && s.players === 1 && p === 1) {
      const alt = prefs.keys[2][action];
      if (alt && alt !== own) list.push(alt);
    }
    return list;
  }

  // ---------- sound ----------
  let audio = null;
  function tone(freq, dur = 0.08, type = 'square', vol = 0.05, when = 0) {
    if (!prefs.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime + when;
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* no audio */ }
  }
  const sfx = {
    tick: () => tone(700, 0.035, 'square', 0.025),
    land: () => [523, 659, 784].forEach((f, i) => tone(f, 0.2, 'triangle', 0.08, i * 0.09)),
    count: () => tone(440, 0.12, 'sine', 0.08),
    go: () => tone(880, 0.2, 'sine', 0.08),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.07, i * 0.09)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.035, i * 0.13)),
    blip: () => tone(520, 0.05, 'square', 0.035),
    pop: () => tone(300, 0.07, 'triangle', 0.07),
    step: () => [392, 523].forEach((f, i) => tone(f, 0.14, 'triangle', 0.07, i * 0.1)),
    fanfare: () => [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.12)),
  };
  Arcade.tone = tone;
  Arcade.sfx = sfx;

  // ---------- state ----------
  const keys = new Set();
  const sessionWins = {};
  const rounds = {};
  let screen = 'menu';
  let session = null;  // the running round
  let current = null;  // { game, setup }
  let fo = null;       // face-off in progress
  let primary = null;  // what Enter does on the current screen
  let primaryTimer = 0;
  let reelTimer = 0;
  let capture = null;  // key-binding capture in the settings screen

  function setPrimary(fn, delay = 0) {
    clearTimeout(primaryTimer);
    primary = null;
    if (!fn) return;
    if (delay) primaryTimer = setTimeout(() => (primary = fn), delay);
    else primary = fn;
  }

  const ALWAYS_BLOCKED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
  const bound = () => new Set(Object.values(prefs.keys).flatMap((k) => Object.values(k)));

  // Runs first, so a key being bound in settings never reaches the games.
  addEventListener('keydown', (e) => {
    if (!capture) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code !== 'Escape' && e.code !== 'Enter') {
      prefs.keys[capture.p][capture.action] = e.code;
      savePrefs();
    }
    const done = capture.done;
    capture = null;
    done();
  }, true);

  addEventListener('keydown', (e) => {
    if (e.target.matches && e.target.matches('input')) {
      if (e.code === 'Enter') e.target.blur();
      return;
    }
    keys.add(e.code);
    if (screen === 'game' && (ALWAYS_BLOCKED.has(e.code) || bound().has(e.code))) e.preventDefault();
    if (e.code === 'Escape') return back();
    if ((e.code === 'Enter' || (e.code === 'Space' && screen === 'game')) && primary) {
      e.preventDefault();
      const fn = primary;
      setPrimary(null);
      fn();
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  // Buttons must not keep focus, or Space would press them again mid-game.
  addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (b) b.blur();
  });

  function back() {
    if (!$('#settings').classList.contains('hidden')) return closeSettings();
    if (screen === 'menu') return;
    if (screen === 'game' && fo && !confirm('Leave the face-off? The series will be lost.')) return;
    showMenu();
  }

  function show(id) {
    if (id !== 'game') stopRound();
    clearTimeout(reelTimer);
    setPrimary(null);
    screen = id;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
    document.body.classList.toggle('playing', id === 'game');
    window.scrollTo(0, 0);
  }

  function showMenu() {
    fo = null;
    show('menu');
  }

  function name(p) {
    const s = current && current.setup;
    if (seatLevel(s, p)) return s.players === 4 ? `Computer ${p}` : 'Computer';
    return prefs['p' + p] || `Player ${p}`;
  }

  const picture = (g) => (Arcade.art && Arcade.art[g.id]) || '';
  const LEVELS = [[1, 'Easy'], [2, 'Medium'], [3, 'Hard'], [4, 'Impossible']];

  // ---------- menu ----------
  function init() {
    applyPrefs();
    initSky();
    $('#btn-faceoff').addEventListener('click', openFaceoffSetup);
    $('#btn-random').addEventListener('click', randomGame);
    $('#btn-settings').addEventListener('click', openSettings);
    $('#back').addEventListener('click', back);
    $('#restart').addEventListener('click', () => startRound());

    const two = games.filter((g) => g.modes.includes(2));
    const one = games.filter((g) => !g.modes.includes(2));
    [...two, ...one].forEach((g, i) => (g.num = String(i + 1).padStart(2, '0')));
    const card = (g) => {
      const meta = { 1: 'one', 2: 'two', '1,2': 'one or two', '1,2,4': 'one, two or four' }[g.modes.join(',')];
      const b = el('button', 'card', `
        <div class="pic">${picture(g)}</div>
        <div class="card-body">
          <span class="num">${g.num}</span><span class="name">${g.name}</span><span class="meta">${meta}</span>
          <span class="desc">${g.desc}</span>
        </div>`);
      b.addEventListener('click', () => openSetup(g));
      return b;
    };
    two.forEach((g) => $('#list-2p').appendChild(card(g)));
    one.forEach((g) => $('#list-1p').appendChild(card(g)));
  }

  // ---------- option widgets ----------
  function seg(label, choices, value, onPick) {
    const wrap = el('div', 'seg');
    wrap.appendChild(el('span', 'seg-label', label));
    const opts = el('div', 'seg-opts');
    for (const [v, text] of choices) {
      const b = el('button', 'seg-btn' + (v === value ? ' on' : ''), text);
      b.addEventListener('click', () => onPick(v));
      opts.appendChild(b);
    }
    wrap.appendChild(opts);
    return wrap;
  }

  function nameField(label, key) {
    const wrap = el('div', 'seg');
    wrap.appendChild(el('span', 'seg-label', label));
    const input = el('input');
    input.type = 'text';
    input.maxLength = 16;
    input.value = prefs[key];
    input.addEventListener('input', () => {
      prefs[key] = input.value.trim() || 'Player ' + key.slice(1);
      savePrefs();
    });
    wrap.appendChild(input);
    return wrap;
  }

  function controlsHTML(g, s) {
    const all = typeof g.controls === 'function' ? g.controls(s) : g.controls;
    const rows = all.filter(([who]) => {
      const m = /^P(\d)$/.exec(who);
      if (!m) return true;
      const p = +m[1];
      return p <= s.players && !seatLevel(s, p) && (s.players !== 1 || p === 1);
    });
    const fill = (txt) => txt.replace(/\{(\d)\.(\w+)\}/g, (_, p, a) => codesFor(s, +p, a).map(kbd).join(' or '));
    return '<dl class="how">' + rows.map(([who, txt]) => {
      const m = /^P(\d)$/.exec(who);
      const label = m ? (s.players === 1 ? 'You' : esc(prefs['p' + m[1]])) : who;
      return `<div><dt class="${m ? 'p' + m[1] : ''}">${label}</dt><dd>${fill(txt)}</dd></div>`;
    }).join('') + '</dl>';
  }

  // ---------- setup ----------
  function defaultSetup(g) {
    const opts = {};
    (g.options || []).forEach((o) => (opts[o.key] = o.def));
    return { players: g.modes.includes(2) ? 2 : 1, opponent: 'friend', level: 2, bots: 0, opts };
  }

  function getSetup(g) {
    const d = defaultSetup(g);
    const saved = store.get('setup:' + g.id, {});
    const s = Object.assign({}, d, saved);
    s.opts = Object.assign({}, d.opts, saved.opts || {});
    if (!g.modes.includes(s.players)) s.players = g.modes[0];
    if (s.level > 4) s.level = 3;
    return s;
  }

  function openSetup(g) {
    fo = null;
    const s = getSetup(g);
    const box = $('#setup');
    const go = () => { store.set('setup:' + g.id, s); startGame(g, s); };
    const render = () => {
      box.innerHTML = '';
      const sheet = el('div', 'sheet', `<div class="sheet-head"><div class="pic">${picture(g)}</div>
        <div><p class="kicker">no. ${g.num}</p><h1>${g.name}</h1></div></div><p class="lede">${g.desc}</p>`);
      const groups = el('div', 'groups');
      if (g.modes.length > 1) {
        const words = { 1: 'One', 2: 'Two', 4: 'Four' };
        groups.appendChild(seg('Players', g.modes.map((m) => [m, words[m]]), s.players, (v) => { s.players = v; render(); }));
      }
      if (s.players === 2) {
        groups.appendChild(seg('Against', [['friend', 'A friend'], ['bot', 'The computer']], s.opponent, (v) => { s.opponent = v; render(); }));
        if (s.opponent === 'bot') groups.appendChild(seg('Difficulty', LEVELS, s.level, (v) => { s.level = v; render(); }));
      }
      if (s.players === 4) {
        groups.appendChild(seg('Computers', [[0, 'None'], [1, 'One'], [2, 'Two'], [3, 'Three']], s.bots, (v) => { s.bots = v; render(); }));
        if (s.bots) groups.appendChild(seg('Difficulty', LEVELS, s.level, (v) => { s.level = v; render(); }));
      }
      (g.options || []).filter((o) => !o.when || o.when(s)).forEach((o) => {
        groups.appendChild(seg(o.label, o.choices, s.opts[o.key], (v) => { s.opts[o.key] = v; render(); }));
      });
      sheet.appendChild(groups);
      sheet.insertAdjacentHTML('beforeend', '<h3 class="minor">How to play</h3>' + controlsHTML(g, s) +
        '<p class="hint">Keys can be changed in Settings.</p>');
      const row = el('div', 'btn-row');
      const start = el('button', 'btn solid', 'Start');
      const backBtn = el('button', 'btn', 'Back');
      start.addEventListener('click', go);
      backBtn.addEventListener('click', showMenu);
      row.append(start, backBtn);
      sheet.appendChild(row);
      box.appendChild(sheet);
    };
    render();
    show('setup');
    setPrimary(go);
  }

  // ---------- random game ----------
  function randomGame() {
    fo = null;
    const chosen = pick(games);
    reel({
      pool: games,
      chosen,
      label: 'Random game',
      buttons: [
        ['Play', () => startGame(chosen, getSetup(chosen))],
        ['Change setup', () => openSetup(chosen)],
        ['Spin again', randomGame],
      ],
      setup: getSetup(chosen),
    });
  }

  // ---------- the reel ----------
  function reel({ pool, chosen, label, top, wait = 0, buttons, setup }) {
    show('roulette');
    $('#rl-label').textContent = label;
    const topBox = $('#rl-top');
    topBox.innerHTML = '';
    if (top) topBox.appendChild(top);
    const after = $('#rl-after');
    after.classList.add('hidden');
    const box = $('#rl-reel');
    box.classList.remove('landed');
    const n = pool.length;
    const target = pool.indexOf(chosen);
    let i = Math.floor(Math.random() * n);
    let steps = n === 1 ? 0 : 22 + ((((target - i - 22) % n) + n) % n);
    let delay = 45;
    const nameAt = (k) => (n < 2 ? '&nbsp;' : pool[((k % n) + n) % n].name);
    const draw = () => {
      box.innerHTML = `<div class="rl-side">${nameAt(i - 1)}</div><div class="rl-cur">${pool[i].name}</div><div class="rl-side">${nameAt(i + 1)}</div>`;
    };
    const land = () => {
      box.classList.add('landed');
      sfx.land();
      after.innerHTML = `<div class="rl-pic pic">${picture(chosen)}</div><p class="lede">${chosen.desc}</p>${controlsHTML(chosen, setup)}`;
      const row = el('div', 'btn-row');
      buttons.forEach(([text, fn], k) => {
        const b = el('button', k ? 'btn' : 'btn solid', text);
        b.addEventListener('click', fn);
        row.appendChild(b);
      });
      after.appendChild(row);
      after.classList.remove('hidden');
      setPrimary(buttons[0][1], 300);
    };
    const tick = () => {
      if (steps <= 0) return land();
      i = (i + 1) % n;
      steps--;
      draw();
      sfx.tick();
      box.classList.remove('roll');
      void box.offsetWidth;
      box.classList.add('roll');
      delay *= 1.075;
      reelTimer = setTimeout(tick, delay);
    };
    draw();
    reelTimer = setTimeout(tick, wait + delay);
  }

  // ---------- face-off series ----------
  const duelGames = () => games.filter((g) => g.modes.includes(2));
  const CUP = `<svg viewBox="0 0 80 80" aria-hidden="true"><g stroke="#1b1530" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <path d="M22 14h36v14c0 13-8 22-18 22S22 41 22 28z" fill="#e6c46e"/>
    <path d="M22 20H12c0 10 5 16 12 17M58 20h10c0 10-5 16-12 17" fill="none"/>
    <path d="M34 50h12l2 10H32z" fill="#e6c46e"/><rect x="24" y="60" width="32" height="9" rx="2" fill="#a0724f"/>
    <path d="M31 20q0 12 6 18" stroke="#fff6d8" stroke-width="2.5" fill="none"/></g></svg>`;

  function openFaceoffSetup() {
    fo = null;
    const s = Object.assign(
      { rounds: 5, opponent: 'friend', level: 2, pool: duelGames().map((g) => g.id), repeats: false, early: true, ties: 'sudden', draws: 'replay' },
      store.get('faceoff', {})
    );
    s.pool = s.pool.filter((id) => games.some((g) => g.id === id));
    if (s.level > 4) s.level = 3;
    const box = $('#fo-setup');
    const go = () => {
      if (!s.pool.length) return;
      store.set('faceoff', s);
      beginFaceoff(s);
    };
    const render = () => {
      box.innerHTML = '';
      const sheet = el('div', 'sheet', `<p class="kicker">a series</p><h1>Face-Off</h1>
        <p class="lede">The reel picks a game and you play it. Win enough games and your flag reaches the cup.</p>`);
      const groups = el('div', 'groups');
      groups.appendChild(seg('Best of', [3, 5, 7, 9, 11].map((n) => [n, String(n)]), s.rounds, (v) => { s.rounds = v; render(); }));
      groups.appendChild(seg('Against', [['friend', 'A friend'], ['bot', 'The computer']], s.opponent, (v) => { s.opponent = v; render(); }));
      if (s.opponent === 'bot') groups.appendChild(seg('Difficulty', LEVELS, s.level, (v) => { s.level = v; render(); }));
      groups.appendChild(nameField('Player one', 'p1'));
      if (s.opponent === 'friend') groups.appendChild(nameField('Player two', 'p2'));
      groups.appendChild(seg('Repeats', [[false, 'Each game once'], [true, 'Allowed']], s.repeats, (v) => { s.repeats = v; render(); }));
      groups.appendChild(seg('A drawn game', [['replay', 'Gets replayed'], ['nothing', 'Counts for nobody']], s.draws, (v) => { s.draws = v; render(); }));
      groups.appendChild(seg('Stop early', [[true, 'Once someone reaches the cup'], [false, 'Play every game']], s.early, (v) => { s.early = v; render(); }));
      groups.appendChild(seg('Tied at the end', [['sudden', 'Sudden death'], ['draw', 'Call it a draw']], s.ties, (v) => { s.ties = v; render(); }));

      const poolWrap = el('div', 'seg');
      poolWrap.appendChild(el('span', 'seg-label', 'In the reel'));
      const pool = el('div', 'pool');
      duelGames().forEach((g) => {
        const on = s.pool.includes(g.id);
        const b = el('button', 'seg-btn' + (on ? ' on' : ''), g.name);
        b.addEventListener('click', () => {
          s.pool = on ? s.pool.filter((id) => id !== g.id) : [...s.pool, g.id];
          render();
        });
        pool.appendChild(b);
      });
      poolWrap.appendChild(pool);
      groups.appendChild(poolWrap);
      sheet.appendChild(groups);

      if (!s.pool.length) sheet.appendChild(el('p', 'warn', 'Put at least one game in the reel.'));
      const row = el('div', 'btn-row');
      const start = el('button', 'btn solid', 'Begin');
      start.disabled = !s.pool.length;
      const backBtn = el('button', 'btn', 'Back');
      start.addEventListener('click', go);
      backBtn.addEventListener('click', showMenu);
      row.append(start, backBtn);
      sheet.appendChild(row);
      box.appendChild(sheet);
    };
    render();
    show('fo-setup');
    setPrimary(go);
  }

  function foSetup(g) {
    return Object.assign(defaultSetup(g), { players: 2, opponent: fo.opponent, level: fo.level });
  }

  function beginFaceoff(s) {
    fo = Object.assign({}, s, { score: [0, 0], shown: [0, 0], history: [], replay: null, sudden: false });
    current = { game: duelGames()[0], setup: foSetup(duelGames()[0]) };
    nextFaceoffGame();
  }

  const winsNeeded = () => Math.floor(fo.rounds / 2) + 1;

  function seriesNote() {
    const [a, b] = fo.score;
    const K = winsNeeded();
    if (a >= K || b >= K) return `${esc(name(a > b ? 1 : 2))} reaches the cup.`;
    if (fo.sudden) return 'Sudden death. The next win takes it.';
    if (a === K - 1 && b === K - 1) return 'Both one win away.';
    if (a === K - 1) return `Match point, ${esc(name(1))}.`;
    if (b === K - 1) return `Match point, ${esc(name(2))}.`;
    if (a === b) return a ? `All square at ${a} each.` : 'Nothing in it yet.';
    return `${esc(name(a > b ? 1 : 2))} leads ${Math.max(a, b)} to ${Math.min(a, b)}.`;
  }

  // The series board: each player's flag climbs a row of steps toward the cup.
  function seriesBoard(final = false) {
    const K = winsNeeded();
    const flagPos = (w) => (w >= K ? 46 : w === 0 ? 1 : ((w - 0.5) / K) * 42);
    const steps = (p) => Array.from({ length: K }, (_, k) => `<i class="step" data-p="${p}" data-k="${k + 1}"></i>`).join('');
    const board = el('div', 'series' + (final ? ' final' : ''));
    const total = Math.max(fo.rounds, fo.history.length + (final ? 0 : 1));
    const slots = Array.from({ length: total }, (_, k) => {
      const h = fo.history[k];
      if (h) return `<li class="${h.winner ? 'w' + h.winner : 'draw'}"><span>${k + 1}</span>${h.name}</li>`;
      if (!final && k === fo.history.length) return `<li class="now"><span>${k + 1}</span>up next</li>`;
      return `<li><span>${k + 1}</span>&nbsp;</li>`;
    }).join('');
    board.innerHTML = `
      <p class="series-title">best of ${fo.rounds}, first to ${K}</p>
      <div class="track">
        <div class="lane l1"><span class="who p1">${esc(name(1))}</span><div class="steps">${steps(1)}</div></div>
        <div class="cup">${CUP}</div>
        <div class="lane l2"><div class="steps">${steps(2)}</div><span class="who p2">${esc(name(2))}</span></div>
        <div class="flag f1" style="left:${flagPos(fo.shown[0])}%"></div>
        <div class="flag f2" style="right:${flagPos(fo.shown[1])}%"></div>
      </div>
      <p class="series-note">${seriesNote()}</p>
      <ol class="slots">${slots}</ol>`;
    const paint = (score, fresh) => {
      board.querySelectorAll('.step').forEach((st) => {
        const p = +st.dataset.p, k = +st.dataset.k;
        const on = score[p - 1] >= k;
        st.classList.toggle('on', on);
        if (on && fresh && k > fo.shown[p - 1]) st.classList.add('pop');
      });
      board.querySelector('.f1').style.left = flagPos(score[0]) + '%';
      board.querySelector('.f2').style.right = flagPos(score[1]) + '%';
    };
    paint(fo.shown, false);
    const moved = fo.score[0] !== fo.shown[0] || fo.score[1] !== fo.shown[1];
    if (moved) {
      setTimeout(() => { paint(fo.score, true); sfx.step(); }, 450);
    }
    fo.shown = fo.score.slice();
    board.moved = moved;
    return board;
  }

  function nextFaceoffGame() {
    const pool = games.filter((g) => fo.pool.includes(g.id));
    let chosen;
    if (fo.replay) {
      chosen = fo.replay;
      fo.replay = null;
    } else {
      let candidates = pool;
      if (!fo.repeats) {
        const unused = pool.filter((g) => !fo.history.some((h) => h.id === g.id));
        if (unused.length) candidates = unused;
      }
      const last = fo.history[fo.history.length - 1];
      if (candidates.length > 1 && last) candidates = candidates.filter((g) => g.id !== last.id);
      chosen = pick(candidates);
    }
    const setup = foSetup(chosen);
    current = { game: chosen, setup };
    const board = seriesBoard();
    reel({
      pool,
      chosen,
      label: fo.sudden ? 'sudden death' : `game ${fo.history.length + 1}`,
      top: board,
      wait: board.moved ? 1700 : 500,
      setup,
      buttons: [['Play', () => startGame(chosen, setup)], ['Quit the series', showMenu]],
    });
  }

  function faceoffRoundEnd(winner, msg) {
    const g = current.game;
    let title;
    if (winner === 0 && fo.draws === 'replay') {
      fo.replay = g;
      title = 'A draw. Play it again.';
    } else {
      fo.history.push({ id: g.id, name: g.name, winner });
      if (winner) fo.score[winner - 1]++;
      title = winner ? `${esc(name(winner))} takes ${g.name}` : 'A draw. Nobody moves.';
    }
    renderScore();
    const done = !fo.replay && decided();
    (winner === 2 && current.setup.opponent === 'bot') ? sfx.lose() : sfx.win();
    const next = done ? showFinal : nextFaceoffGame;
    const [a, b] = fo.score;
    showPanel(`<h2 class="${winner ? 'p' + winner : ''}">${title}</h2>${msg ? `<p>${msg}</p>` : ''}
      <p class="standings"><span class="p1">${esc(name(1))}</span> <b>${a}</b> &ndash; <b>${b}</b> <span class="p2">${esc(name(2))}</span></p>`,
      [[done ? 'See the result' : 'On to the next game', next], ['Quit', showMenu]]);
    setPrimary(next, 450);
  }

  function decided() {
    const [a, b] = fo.score;
    if (fo.sudden) return a !== b;
    const left = fo.rounds - fo.history.length;
    if (fo.early && (a >= winsNeeded() || b >= winsNeeded() || Math.abs(a - b) > left)) return true;
    if (left > 0) return false;
    if (a === b && fo.ties === 'sudden') {
      fo.sudden = true;
      return false;
    }
    return true;
  }

  function showFinal() {
    const [a, b] = fo.score;
    const w = a === b ? 0 : a > b ? 1 : 2;
    const box = $('#final');
    box.innerHTML = `<div class="sheet center">
      <p class="kicker">the series is over</p>
      <h1 class="${w ? 'p' + w : ''}">${w ? esc(name(w)) : 'Nobody'}</h1>
      ${w ? '<div class="stamp">Champion</div>' : '<div class="stamp grey">Drawn</div>'}
      <div class="final-board"></div>
      <div class="btn-row center"></div></div>`;
    if (w) fo.score[w - 1] = Math.max(fo.score[w - 1], winsNeeded()); // let the winner's flag reach the cup
    box.querySelector('.final-board').appendChild(seriesBoard(true));
    fo.score = [a, b];
    const row = box.querySelector('.btn-row');
    const settings = Object.assign({}, fo);
    [['Rematch', () => beginFaceoff(settings)], ['New face-off', openFaceoffSetup], ['Menu', showMenu]].forEach(([t, fn], k) => {
      const btn = el('button', k ? 'btn' : 'btn solid', t);
      btn.addEventListener('click', fn);
      row.appendChild(btn);
    });
    show('final');
    if (w) setTimeout(sfx.fanfare, 500);
    setPrimary(() => beginFaceoff(settings), 400);
  }

  // ---------- settings ----------
  function applyPrefs() {
    document.body.classList.remove('motion-full', 'motion-calm', 'motion-off');
    document.body.classList.add('motion-' + prefs.motion);
  }

  function keyTable(render) {
    const wrap = el('div', 'keys');
    const counts = {};
    Object.values(prefs.keys).forEach((k) => Object.values(k).forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
    let html = '<table><thead><tr><th></th>' + [1, 2, 3, 4].map((p) => `<th class="p${p}">${esc(prefs['p' + p])}</th>`).join('') + '</tr></thead><tbody>';
    for (const [action, label] of Object.entries(ACTION_NAMES)) {
      html += `<tr><th>${label}</th>`;
      for (const p of [1, 2, 3, 4]) {
        const code = prefs.keys[p][action];
        if (code === undefined) { html += '<td class="na">&ndash;</td>'; continue; }
        const dup = counts[code] > 1;
        html += `<td><button class="keycap${dup ? ' dup' : ''}" data-p="${p}" data-a="${action}">${esc(keyLabel(code))}</button></td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('.keycap').forEach((b) => {
      b.addEventListener('click', () => {
        wrap.querySelectorAll('.keycap.listening').forEach((x) => x.classList.remove('listening'));
        b.classList.add('listening');
        b.textContent = 'press a key';
        capture = { p: +b.dataset.p, action: b.dataset.a, done: render };
      });
    });
    const dup = Object.values(counts).some((n) => n > 1);
    const note = el('p', 'hint', dup
      ? 'Keys marked in red are used twice. That is fine if the two never play the same game, otherwise change one.'
      : 'Click a key, then press the one you want. Esc cancels. Players three and four only play four-player Dino.');
    wrap.appendChild(note);
    const reset = el('button', 'btn small', 'Reset keys');
    reset.addEventListener('click', () => { prefs.keys = loadKeys({}); savePrefs(); render(); });
    wrap.appendChild(reset);
    return wrap;
  }

  function openSettings() {
    const box = $('#settings');
    const render = () => {
      box.innerHTML = '';
      const sheet = el('div', 'sheet', '<h1>Settings</h1>');
      const groups = el('div', 'groups');
      [1, 2, 3, 4].forEach((p) => groups.appendChild(nameField(['', 'Player one', 'Player two', 'Player three', 'Player four'][p], 'p' + p)));
      groups.appendChild(seg('Sound', [[true, 'On'], [false, 'Off']], prefs.sound, (v) => { prefs.sound = v; savePrefs(); render(); }));
      groups.appendChild(seg('Background', [['full', 'Moving'], ['calm', 'Slow'], ['off', 'Still']], prefs.motion, (v) => { prefs.motion = v; savePrefs(); applyPrefs(); render(); }));
      groups.appendChild(seg('Countdown', [[true, '3, 2, 1'], [false, 'Start at once']], prefs.countdown, (v) => { prefs.countdown = v; savePrefs(); render(); }));
      sheet.appendChild(groups);
      sheet.insertAdjacentHTML('beforeend', '<h3 class="minor">Keys</h3>');
      sheet.appendChild(keyTable(render));
      const row = el('div', 'btn-row');
      const done = el('button', 'btn solid', 'Done');
      done.addEventListener('click', closeSettings);
      row.appendChild(done);
      sheet.appendChild(row);
      box.appendChild(sheet);
    };
    render();
    box.classList.remove('hidden');
  }

  function closeSettings() {
    capture = null;
    $('#settings').classList.add('hidden');
  }

  // ---------- background ----------
  // Two spiral galaxies made of a few thousand faint dots, turning very slowly.
  const GALAXIES = [
    { fx: 0.12, fy: 0.2, size: 0.3, tilt: -0.55, squash: 0.42, spin: 1, core: [255, 238, 225], arm: [205, 165, 235] },
    { fx: 0.88, fy: 0.82, size: 0.34, tilt: 0.45, squash: 0.5, spin: -1, core: [238, 246, 255], arm: [140, 190, 230] },
  ];
  function makeGalaxy(spec) {
    const dots = [];
    for (let k = 0; k < 1400; k++) {
      const halo = Math.random() < 0.22;
      const t = halo ? Math.random() * 0.75 : Math.pow(Math.random(), 0.85);
      const arm = Math.random() < 0.5 ? 0 : Math.PI;
      const a = halo ? Math.random() * Math.PI * 2 : arm + t * 2.7 * Math.PI + (Math.random() - 0.5) * (0.35 + t * 0.5);
      const mix = Math.min(1, t * 1.6);
      const col = spec.core.map((v, i) => Math.round(v + (spec.arm[i] - v) * mix));
      const alpha = (halo ? 0.25 : 0.55) * (1 - t * 0.65) * (0.5 + Math.random() * 0.5);
      dots.push({ a, r: t + (Math.random() - 0.5) * 0.04, s: Math.random() < 0.06 ? 1.7 : 1, fill: `rgba(${col.join(',')},${alpha.toFixed(3)})` });
    }
    return Object.assign({ dots }, spec);
  }
  const galaxies = GALAXIES.map(makeGalaxy);

  function drawGalaxy(g, gx, w, h, dpr, time) {
    const R = Math.min(w, h) * gx.size;
    const cx = w * gx.fx, cy = h * gx.fy;
    const rot = time * 0.01 * gx.spin; // about one turn every ten minutes
    const ct = Math.cos(gx.tilt), st = Math.sin(gx.tilt);
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.22);
    glow.addColorStop(0, `rgba(${gx.core.join(',')},.30)`);
    glow.addColorStop(1, `rgba(${gx.core.join(',')},0)`);
    g.fillStyle = glow;
    g.fillRect(cx - R, cy - R, R * 2, R * 2);
    for (const d of gx.dots) {
      const th = d.a + rot;
      const x = Math.cos(th) * d.r * R;
      const y = Math.sin(th) * d.r * R * gx.squash;
      g.fillStyle = d.fill;
      g.fillRect(cx + x * ct - y * st, cy + x * st + y * ct, d.s * dpr, d.s * dpr);
    }
  }

  function initSky() {
    const c = $('#stars');
    const g = c.getContext('2d');
    let stars = [];
    let drewStill = false;
    let dpr = 1;
    let skyTime = 0, lastFrame = performance.now();
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
      const count = Math.round((innerWidth * innerHeight) / 4200);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        r: (Math.random() ** 2 * 1.4 + 0.35) * dpr,
        p: Math.random() * Math.PI * 2,
        s: 0.6 + Math.random() * 2.4,
        warm: Math.random() < 0.15,
      }));
      drewStill = false;
    };
    resize();
    addEventListener('resize', resize);
    const draw = (t) => {
      requestAnimationFrame(draw);
      const still = prefs.motion === 'off' || document.body.classList.contains('playing');
      if (still && drewStill) return;
      drewStill = still;
      const speed = prefs.motion === 'calm' ? 0.35 : 1;
      g.clearRect(0, 0, c.width, c.height);
      if (!still) skyTime += Math.min(0.1, (t - lastFrame) / 1000) * speed;
      lastFrame = t;
      for (const gx of galaxies) drawGalaxy(g, gx, c.width, c.height, dpr, skyTime);
      for (const s of stars) {
        g.globalAlpha = still ? 0.6 : 0.25 + 0.75 * Math.abs(Math.sin(s.p + skyTime * s.s));
        g.fillStyle = s.warm ? '#ffd9b0' : '#ffffff';
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    };
    requestAnimationFrame(draw);
  }

  // ---------- running a game ----------
  function renderScore() {
    const sb = $('#scoreboard');
    const s = current.setup;
    sb.classList.toggle('hidden', s.players < 2);
    if (s.players < 2) return;
    const w = fo ? fo.score : sessionWins[current.game.id];
    if (s.players === 4) {
      sb.innerHTML = [1, 2, 3, 4].map((p) => `<span class="p${p}">${esc(name(p))}</span> <b>${w[p - 1]}</b>`).join(' &middot; ');
    } else {
      sb.innerHTML = `<span class="p1">${esc(name(1))}</span> <b>${w[0]}</b> &ndash; <b>${w[1]}</b> <span class="p2">${esc(name(2))}</span>`;
    }
    sb.title = fo ? 'Face-off score' : 'Games won this session';
  }

  function startGame(g, s) {
    current = { game: g, setup: s };
    sessionWins[g.id] = sessionWins[g.id] || [0, 0, 0, 0];
    $('#game-title').textContent = g.name;
    $('#controls').innerHTML = controlsHTML(g, s);
    $('#fo-tag').textContent = fo ? (fo.sudden ? 'sudden death' : `face-off, game ${fo.history.length + 1}`) : '';
    $('#restart').classList.toggle('hidden', !!fo);
    show('game');
    startRound();
  }

  const overlay = () => $('#overlay');
  function hideOverlay() {
    overlay().className = 'overlay hidden';
    overlay().innerHTML = '';
  }

  function showPanel(html, buttons) {
    const o = overlay();
    o.className = 'overlay';
    o.innerHTML = `<div class="panel">${html}<div class="btn-row center"></div><small>Enter to carry on, Esc for the menu</small></div>`;
    const row = o.querySelector('.btn-row');
    buttons.forEach(([text, fn], k) => {
      const b = el('button', k ? 'btn' : 'btn solid', text);
      b.addEventListener('click', fn);
      row.appendChild(b);
    });
  }

  function startRound() {
    stopRound();
    const { game: g, setup: s } = current;
    const stage = $('#stage');
    stage.innerHTML = '';
    hideOverlay();
    setPrimary(null);
    const cleanups = [];
    let ended = false;
    const slips = {};
    rounds[g.id] = (rounds[g.id] || 0) + 1;

    const ctx = {
      stage,
      keys,
      sfx,
      P1: COLORS[1],
      P2: COLORS[2],
      COLORS,
      players: s.players,
      bot: seatLevel(s, 2),        // level of the computer in seat two (two-player games)
      seatBot: (p) => seatLevel(s, p),
      opts: s.opts,
      round: rounds[g.id],         // odd/even, used to alternate who starts
      name,
      get ended() { return ended; },
      // ----- keys -----
      codes: (p, action) => codesFor(s, p, action),
      held: (p, action) => codesFor(s, p, action).some((c) => keys.has(c)),
      is: (e, p, action) => codesFor(s, p, action).includes(e.code),
      kbd: (p, action) => codesFor(s, p, action).map(kbd).join(' or '),
      // ----- computer mistakes -----
      // Hard plays like Impossible, but each decision has a 0.5% chance of
      // going wrong, and it is certain to go wrong at least once every five.
      slip(seat = 2) {
        if (seatLevel(s, seat) !== 3) return false;
        slips[seat] = (slips[seat] || 0) + 1;
        if (Math.random() < 0.005 || slips[seat] >= 5) {
          slips[seat] = 0;
          return true;
        }
        return false;
      },
      // ----- lifecycle helpers -----
      listen(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        cleanups.push(() => target.removeEventListener(type, fn, opts));
      },
      // fn(dt) runs every animation frame until the round ends
      loop(fn) {
        let last = performance.now();
        let id;
        const frame = (t) => {
          const dt = Math.min(0.05, (t - last) / 1000);
          last = t;
          if (!ended) fn(dt);
          id = requestAnimationFrame(frame);
        };
        id = requestAnimationFrame(frame);
        cleanups.push(() => cancelAnimationFrame(id));
      },
      after(ms, fn) {
        const id = setTimeout(fn, ms);
        cleanups.push(() => clearTimeout(id));
        return id;
      },
      every(ms, fn) {
        const id = setInterval(fn, ms);
        cleanups.push(() => clearInterval(id));
        return id;
      },
      canvas(w, h) {
        const c = el('canvas');
        c.width = w;
        c.height = h;
        stage.appendChild(c);
        return { c, g: c.getContext('2d') };
      },
      status(html) { $('#status').innerHTML = html || ''; },
      countdown() {
        if (!prefs.countdown) return Promise.resolve();
        return new Promise((resolve) => {
          let n = 3;
          const next = () => {
            if (n === 0) { hideOverlay(); sfx.go(); resolve(); return; }
            overlay().className = 'overlay count';
            overlay().innerHTML = `<div class="count-num">${n--}</div>`;
            sfx.count();
            ctx.after(620, next);
          };
          next();
        });
      },
      // Solo high scores, kept per game and per option set.
      best(score, lowerIsBetter = false) {
        const k = 'best:' + g.id + ':' + JSON.stringify(s.opts);
        const prev = store.get(k, null);
        const fresh = prev == null || (lowerIsBetter ? score < prev : score > prev);
        if (fresh) store.set(k, score);
        return { best: fresh ? score : prev, fresh: fresh && prev != null };
      },
      // p = the winning seat, or 0 for a draw
      win(p, msg = '', delay = 0) {
        if (ended) return;
        ended = true;
        if (p && !fo) sessionWins[g.id][p - 1]++;
        ctx.after(delay, () => {
          if (fo) return faceoffRoundEnd(p, msg);
          renderScore();
          (p && seatLevel(s, p)) ? sfx.lose() : sfx.win();
          const title = p ? `${esc(name(p))} wins` : 'A draw';
          showPanel(`<h2 class="${p ? 'p' + p : ''}">${title}</h2>${msg ? `<p>${msg}</p>` : ''}`,
            [['Play again', startRound], ['Change setup', () => openSetup(g)], ['Menu', showMenu]]);
          setPrimary(startRound, 450);
        });
      },
      // end of a solo game
      end(title, msg = '', delay = 0, good = false) {
        if (ended) return;
        ended = true;
        ctx.after(delay, () => {
          good ? sfx.win() : sfx.lose();
          showPanel(`<h2>${title}</h2>${msg ? `<p>${msg}</p>` : ''}`,
            [['Play again', startRound], ['Change setup', () => openSetup(g)], ['Menu', showMenu]]);
          setPrimary(startRound, 450);
        });
      },
    };

    session = { cleanups };
    ctx.status('');
    renderScore();
    g.create(ctx);
  }

  function stopRound() {
    if (!session) return;
    session.cleanups.forEach((f) => f());
    session = null;
    hideOverlay();
    $('#status').innerHTML = '';
  }
})();
