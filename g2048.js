Arcade.register({
  id: '2048',
  name: '2048',
  modes: [1],
  desc: 'Slide the tiles. Two of the same number merge into one.',
  controls: [['How', '{1.up} {1.left} {1.down} {1.right}, or swipe']],

  create(ctx) {
    const { el } = Arcade;
    let grid = Array(16).fill(0);
    let score = 0, reached = false;
    const boardEl = el('div', 't48');
    const tiles = grid.map(() => {
      const t = el('div', 't48-cell');
      boardEl.appendChild(t);
      return t;
    });
    ctx.stage.appendChild(boardEl);

    const DIRS = { left: 'L', right: 'R', up: 'U', down: 'D' };
    ctx.listen(window, 'keydown', (e) => {
      const a = Object.keys(DIRS).find((k) => ctx.is(e, 1, k));
      const d = a && DIRS[a];
      if (d) { e.preventDefault(); move(d); }
    });
    let sx = 0, sy = 0;
    ctx.listen(boardEl, 'pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    ctx.listen(boardEl, 'pointerup', (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
    });

    const fresh = new Set(), merged = new Set();
    add(); add();
    render();

    function add() {
      const empty = grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      if (!empty.length) return;
      const i = empty[Math.floor(Math.random() * empty.length)];
      grid[i] = Math.random() < 0.9 ? 2 : 4;
      fresh.add(i);
    }

    // index of the k-th cell along line `line`, read in the direction of the move
    function idx(d, line, k) {
      if (d === 'L') return line * 4 + k;
      if (d === 'R') return line * 4 + (3 - k);
      if (d === 'U') return k * 4 + line;
      return (3 - k) * 4 + line;
    }

    function move(d) {
      if (ctx.ended) return;
      let moved = false;
      fresh.clear();
      merged.clear();
      for (let line = 0; line < 4; line++) {
        const vals = [];
        for (let k = 0; k < 4; k++) if (grid[idx(d, line, k)]) vals.push(grid[idx(d, line, k)]);
        const out = [];
        const mergedAt = [];
        for (let k = 0; k < vals.length; k++) {
          if (k + 1 < vals.length && vals[k] === vals[k + 1]) {
            out.push(vals[k] * 2);
            score += vals[k] * 2;
            mergedAt.push(out.length - 1);
            k++;
          } else out.push(vals[k]);
        }
        for (let k = 0; k < 4; k++) {
          const i = idx(d, line, k);
          const v = out[k] || 0;
          if (grid[i] !== v) moved = true;
          grid[i] = v;
        }
        mergedAt.forEach((k) => merged.add(idx(d, line, k)));
      }
      if (!moved) return;
      add();
      if (merged.size) ctx.sfx.blip();
      render();
      if (!reached && grid.some((v) => v >= 2048)) {
        reached = true;
        ctx.status('2048. You can keep going.');
      }
      if (!canMove()) {
        const rec = ctx.best(score);
        ctx.end('No moves left', `Score ${score}. Highest tile ${Math.max(...grid)}. Best: ${rec.best}${rec.fresh ? ', a new record' : ''}.`, 600, rec.fresh);
      }
    }

    function canMove() {
      for (let i = 0; i < 16; i++) {
        if (!grid[i]) return true;
        if (i % 4 < 3 && grid[i] === grid[i + 1]) return true;
        if (i < 12 && grid[i] === grid[i + 4]) return true;
      }
      return false;
    }

    function render() {
      grid.forEach((v, i) => {
        const t = tiles[i];
        t.className = 't48-cell' + (v ? ' v' + Math.min(v, 2048) : '') + (v > 2048 ? ' big' : '') +
          (fresh.has(i) ? ' new' : '') + (merged.has(i) ? ' merged' : '');
        t.textContent = v || '';
      });
      if (!reached) ctx.status(`Score ${score}`);
      else ctx.status(`Score ${score}. Past 2048 now.`);
    }
  },
});
