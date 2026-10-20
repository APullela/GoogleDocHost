Arcade.register({
  id: 'mines',
  name: 'Minesweeper',
  modes: [1, 2],
  desc: 'The old one. Or two of you take turns on the same board, and whoever finds a mine loses.',
  controls: [
    ['Click', 'open a square'],
    ['Right-click', 'plant a flag, or switch on flag mode'],
    ['Tip', 'click a number whose flags are all placed to clear around it'],
  ],
  options: [{
    key: 'board', label: 'Board', def: 'easy',
    choices: [['easy', '9 by 9'], ['medium', '16 by 16'], ['hard', '30 by 16']],
  }],

  create(ctx) {
    const { el } = Arcade;
    const BOARDS = {
      easy: { label: 'Small', rows: 9, cols: 9, mines: 10 },
      medium: { label: 'Medium', rows: 16, cols: 16, mines: 40 },
      hard: { label: 'Large', rows: 16, cols: 30, mines: 99 },
    };
    const B = BOARDS[ctx.opts.board] || BOARDS.easy;
    const { rows, cols, mines } = B;
    const versus = ctx.players === 2;
    const N = rows * cols;

    const cells = Array.from({ length: N }, (_, i) => ({
      i, r: Math.floor(i / cols), c: i % cols, mine: false, n: 0, open: false, flag: false, by: 0,
    }));
    let placed = false, opened = 0, flags = 0, flagMode = false, t0 = 0, t1 = 0;
    let turn = versus ? (ctx.round % 2 ? 1 : 2) : 1;
    const pts = [0, 0];
    const botTurn = () => ctx.bot && turn === 2;

    const wrap = el('div', 'ms');
    const bar = el('div', 'ms-bar');
    const info = el('div', 'ms-info');
    const flagBtn = el('button', 'btn small', 'Flag mode');
    flagBtn.addEventListener('click', () => { flagMode = !flagMode; flagBtn.classList.toggle('on', flagMode); });
    bar.append(info, flagBtn);

    const board = el('div', 'ms-board');
    board.style.gridTemplateColumns = `repeat(${cols}, var(--cs))`;
    board.style.setProperty('--cs', `min(36px, calc((100vw - 64px) / ${cols}), calc((100dvh - 300px) / ${rows}))`);
    cells.forEach((c) => {
      c.el = el('div', 'ms-cell');
      c.el.dataset.i = c.i;
      board.appendChild(c.el);
    });
    wrap.append(bar, board);
    ctx.stage.appendChild(wrap);

    const cellFrom = (e) => {
      const t = e.target.closest('.ms-cell');
      return t ? cells[+t.dataset.i] : null;
    };
    board.addEventListener('click', (e) => {
      const c = cellFrom(e);
      if (!c) return;
      const kind = flagMode && !c.open ? 'flag' : 'open';
      if (kind === 'open' && botTurn()) return;
      act(c, kind);
    });
    board.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const c = cellFrom(e);
      if (c) act(c, 'flag');
    });

    ctx.every(250, () => { if (!ctx.ended && !versus) refresh(); });
    refresh();
    if (botTurn()) ctx.after(700, botPlay);

    function neighbors(c) {
      const out = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = c.r + dr, cc = c.c + dc;
          if ((dr || dc) && r >= 0 && r < rows && cc >= 0 && cc < cols) out.push(cells[r * cols + cc]);
        }
      }
      return out;
    }

    // Mines go down on the first click, so the first click is always safe.
    function place(first) {
      const banned = new Set([first.i, ...neighbors(first).map((n) => n.i)]);
      let k = 0;
      while (k < mines) {
        const c = cells[Math.floor(Math.random() * N)];
        if (c.mine || banned.has(c.i)) continue;
        c.mine = true;
        k++;
      }
      cells.forEach((c) => (c.n = neighbors(c).filter((n) => n.mine).length));
      placed = true;
      t0 = performance.now();
    }

    function act(c, kind) {
      if (ctx.ended) return;
      if (kind === 'flag') {
        if (c.open) return;
        c.flag = !c.flag;
        flags += c.flag ? 1 : -1;
        paint(c);
        refresh();
        return;
      }
      if (c.flag) return;
      if (c.open) {
        if (!c.n) return;
        const nb = neighbors(c);
        if (nb.filter((n) => n.flag).length !== c.n) return;
        const targets = nb.filter((n) => !n.open && !n.flag);
        if (!targets.length) return;
        const bad = targets.find((t) => t.mine);
        if (bad) return boom(bad);
        targets.forEach(reveal);
        return afterMove();
      }
      if (!placed) place(c);
      if (c.mine) return boom(c);
      reveal(c);
      afterMove();
    }

    function reveal(start) {
      const stack = [start];
      while (stack.length) {
        const c = stack.pop();
        if (c.open || c.flag) continue;
        c.open = true;
        c.by = turn;
        opened++;
        if (versus) pts[turn - 1]++;
        paint(c);
        if (c.n === 0) neighbors(c).forEach((n) => { if (!n.open && !n.mine) stack.push(n); });
      }
    }

    function afterMove() {
      if (opened === N - mines) {
        t1 = performance.now();
        showMines(false);
        if (versus) {
          const [a, b] = pts;
          ctx.win(a === b ? 0 : a > b ? 1 : 2, `Board cleared. Squares opened: ${a} to ${b}.`, 500);
        } else {
          const rec = ctx.best(elapsed(), true);
          ctx.end('Cleared', `${elapsed()} seconds on the ${B.label.toLowerCase()} board. Best: ${rec.best}s${rec.fresh ? ', a new record' : ''}.`, 500, true);
        }
        refresh();
        return;
      }
      if (versus) turn = 3 - turn;
      refresh();
      if (botTurn()) ctx.after(650, botPlay);
    }

    function boom(c) {
      t1 = performance.now();
      c.open = true;
      paint(c);
      c.el.classList.add('boom');
      showMines(true);
      if (versus) ctx.win(3 - turn, `${ctx.name(turn)} found a mine.`, 900);
      else ctx.end('Boom', 'You found a mine.', 900);
      refresh();
    }

    function showMines(lost) {
      for (const c of cells) {
        if (c.mine && !c.open && !c.flag) { c.el.textContent = lost ? '✱' : '⚑'; c.el.classList.add(lost ? 'mine' : 'flag'); }
        if (lost && c.flag && !c.mine) c.el.textContent = '✕';
      }
    }

    function paint(c) {
      const e = c.el;
      e.className = 'ms-cell';
      e.textContent = '';
      if (c.open) {
        e.classList.add('open');
        if (versus) e.classList.add('by' + c.by);
        if (c.mine) { e.textContent = '✱'; e.classList.add('mine'); }
        else if (c.n) { e.textContent = c.n; e.classList.add('n' + c.n); }
      } else if (c.flag) {
        e.textContent = '⚑';
        e.classList.add('flag');
      }
    }

    function elapsed() {
      if (!placed) return 0;
      return Math.floor(((t1 || performance.now()) - t0) / 1000);
    }

    function refresh() {
      if (versus) {
        info.innerHTML = `<span class="p1">${ctx.name(1)} ${pts[0]}</span> &middot; <span class="p2">${ctx.name(2)} ${pts[1]}</span> &middot; ${mines - flags} mines`;
        ctx.status(ctx.ended ? '' : `<b class="p${turn}">${ctx.name(turn)}</b> opens a square${botTurn() ? '...' : ''}`);
      } else {
        info.textContent = `${mines - flags} mines left, ${elapsed()}s`;
        ctx.status('');
      }
    }

    // ----- computer -----
    // Works out squares that must be safe (or must be mines) from the numbers
    // showing. Hard also compares overlapping numbers and, when nothing is
    // certain, picks the square least likely to hide a mine.
    function deduce(deep) {
      const mine = new Set(), safe = new Set();
      const frontier = cells.filter((c) => c.open && c.n);
      const facts = () => frontier.map((c) => {
        const nb = neighbors(c).filter((n) => !n.open);
        const m = nb.filter((n) => mine.has(n)).length;
        return { u: nb.filter((n) => !mine.has(n) && !safe.has(n)), rem: c.n - m };
      }).filter((f) => f.u.length);
      let changed = true;
      while (changed) {
        changed = false;
        const fs = facts();
        for (const f of fs) {
          if (f.rem === 0) f.u.forEach((n) => { if (!safe.has(n)) { safe.add(n); changed = true; } });
          else if (f.rem === f.u.length) f.u.forEach((n) => { if (!mine.has(n)) { mine.add(n); changed = true; } });
        }
        if (!changed && deep) {
          for (const a of fs) {
            for (const b of fs) {
              if (a === b || a.u.length >= b.u.length || !a.u.every((n) => b.u.includes(n))) continue;
              const diff = b.u.filter((n) => !a.u.includes(n));
              const remDiff = b.rem - a.rem;
              if (remDiff === 0) diff.forEach((n) => { if (!safe.has(n)) { safe.add(n); changed = true; } });
              else if (remDiff === diff.length) diff.forEach((n) => { if (!mine.has(n)) { mine.add(n); changed = true; } });
            }
          }
        }
      }
      return { mine, safe, facts: facts() };
    }

    function botPick() {
      const closed = cells.filter((c) => !c.open && !c.flag);
      const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
      if (!placed) return cells[(rows >> 1) * cols + (cols >> 1)];
      if (ctx.bot === 1 && Math.random() < 0.5) return rnd(closed);
      const { mine, safe, facts } = deduce(ctx.bot >= 3);
      const sure = [...safe].filter((c) => !c.flag);
      // a Hard slip: skip the square it knows is safe and take its best guess instead
      const slip = ctx.slip();
      if (sure.length && !slip) return rnd(sure);
      const maybe = closed.filter((c) => !mine.has(c) && !(slip && safe.has(c)));
      if (ctx.bot >= 3 && maybe.length) {
        const unknownCount = Math.max(1, cells.filter((c) => !c.open).length - mine.size);
        const density = (mines - mine.size) / unknownCount;
        let best = maybe[0], bp = Infinity;
        for (const c of maybe) {
          let p = density;
          for (const f of facts) if (f.u.includes(c)) p = Math.max(p === density ? 0 : p, f.rem / f.u.length);
          if (p < bp) { bp = p; best = c; }
        }
        return best;
      }
      return rnd(maybe.length ? maybe : closed);
    }

    function botPlay() {
      if (ctx.ended || !botTurn()) return;
      const c = botPick();
      if (c) return act(c, 'open');
      turn = 1; // every closed square is flagged, so pass
      refresh();
    }
  },
});
