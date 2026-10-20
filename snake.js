Arcade.register({
  id: 'snake',
  name: 'Snake Duel',
  modes: [1, 2],
  desc: 'Two snakes in one box. Eat, grow, and keep out of each other\'s way.',
  controls: [['P1', '{1.up} {1.left} {1.down} {1.right} to steer'], ['P2', '{2.up} {2.left} {2.down} {2.right} to steer']],
  options: [{ key: 'target', label: 'Length to win', def: 15, when: (s) => s.players === 2, choices: [[10, '10'], [15, '15'], [25, '25']] }],

  create(ctx) {
    const solo = ctx.players === 1;
    const C = 28, COLS = 32, ROWS = 20, W = C * COLS, H = C * ROWS;
    const TARGET = ctx.opts.target || 15;
    let STEP = solo ? 0.12 : 0.11;
    const { g } = ctx.canvas(W, H);
    function steering(p) {
      const m = {};
      [['up', [0, -1]], ['down', [0, 1]], ['left', [-1, 0]], ['right', [1, 0]]].forEach(([a, d]) => ctx.codes(p, a).forEach((c) => (m[c] = d)));
      return m;
    }
    let slipPending = false;
    if (ctx.bot === 3) ctx.every(2000, () => { if (ctx.slip()) slipPending = true; });
    const mk = (color, x, y, dx, map) => ({
      color, map, dx, dy: 0, q: [],
      body: [{ x, y }, { x: x - dx, y }, { x: x - 2 * dx, y }],
    });
    const snakes = solo
      ? [mk(ctx.P1, 6, ROWS >> 1, 1, steering(1))]
      : [mk(ctx.P1, 5, 5, 1, steering(1)), mk(ctx.P2, COLS - 6, ROWS - 6, -1, ctx.bot ? {} : steering(2))];
    const apples = [];
    const same = (a) => (b) => a.x === b.x && a.y === b.y;
    for (let i = 0; i < (solo ? 1 : 3); i++) placeApple();

    let running = false, acc = 0;

    ctx.listen(window, 'keydown', (e) => {
      for (const s of snakes) {
        const d = s.map[e.code];
        if (d && s.q.length < 3) s.q.push(d);
      }
    });
    ctx.countdown().then(() => {
      running = true;
      snakes.forEach((s) => (s.q = s.q.slice(-1)));
    });
    ctx.loop((dt) => {
      if (running) {
        acc += dt;
        while (acc >= STEP && !ctx.ended) { acc -= STEP; step(); }
      }
      draw();
    });
    status();

    function placeApple() {
      for (let tries = 0; tries < 800; tries++) {
        const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
        if (apples.some(same(p)) || snakes.some((s) => s.body.some(same(p)))) continue;
        apples.push(p);
        return;
      }
    }

    // ----- computer snake -----
    const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
    function blockedMap(self) {
      const m = new Uint8Array(COLS * ROWS);
      for (const s of snakes) {
        s.body.forEach((p, k) => {
          if (!(s === self && k === s.body.length - 1)) m[p.y * COLS + p.x] = 1; // own tail moves away
        });
      }
      return m;
    }
    function area(m, sx, sy) {
      const seen = new Uint8Array(COLS * ROWS);
      const stack = [[sx, sy]];
      seen[sy * COLS + sx] = 1;
      let n = 0;
      while (stack.length && n < 400) {
        const [x, y] = stack.pop();
        n++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, j = ny * COLS + nx;
          if (inside(nx, ny) && !m[j] && !seen[j]) { seen[j] = 1; stack.push([nx, ny]); }
        }
      }
      return n;
    }
    function pathToApple(m, h) {
      const prev = new Int32Array(COLS * ROWS).fill(-1);
      const start = h.y * COLS + h.x;
      prev[start] = start;
      const q = [start];
      for (let qi = 0; qi < q.length; qi++) {
        const i = q[qi], x = i % COLS, y = (i / COLS) | 0;
        if (i !== start && apples.some((a) => a.x === x && a.y === y)) {
          let cur = i;
          while (prev[cur] !== start) cur = prev[cur];
          return [(cur % COLS) - h.x, ((cur / COLS) | 0) - h.y];
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, j = ny * COLS + nx;
          if (inside(nx, ny) && !m[j] && prev[j] === -1) { prev[j] = i; q.push(j); }
        }
      }
      return null;
    }
    function botDir(s, o) {
      const h = s.body[0];
      const m = blockedMap(s);
      const dirs = [[s.dx, s.dy], [-s.dy, s.dx], [s.dy, -s.dx]];
      const ok = ([dx, dy]) => inside(h.x + dx, h.y + dy) && !m[(h.y + dy) * COLS + h.x + dx];
      const safe = dirs.filter(ok);
      if (!safe.length) return dirs[0];
      const nearApple = (d) => Math.min(...apples.map((a) => Math.abs(a.x - h.x - d[0]) + Math.abs(a.y - h.y - d[1])));
      if (ctx.bot === 1) {
        if (Math.random() < 0.15) return safe[Math.floor(Math.random() * safe.length)];
        return safe.slice().sort((a, b) => nearApple(a) - nearApple(b))[0];
      }
      const roomy = (d) => area(m, h.x + d[0], h.y + d[1]);
      const nearHead = (d) => {
        const oh = o.body[0];
        return Math.abs(oh.x - h.x - d[0]) + Math.abs(oh.y - h.y - d[1]) <= 1;
      };
      const path = pathToApple(m, h);
      let choice = path && safe.find((d) => d[0] === path[0] && d[1] === path[1]);
      if (slipPending && safe.length > 1) {
        slipPending = false;
        const others = safe.filter((d) => d !== choice).sort((a, b) => roomy(b) - roomy(a));
        return others[0];
      }
      if (ctx.bot >= 3) {
        const good = safe.filter((d) => roomy(d) >= s.body.length + 2 && !nearHead(d));
        if (!choice || !good.includes(choice)) {
          const pool = good.length ? good : safe;
          choice = pool.slice().sort((a, b) => roomy(b) - roomy(a) || nearApple(a) - nearApple(b))[0];
        }
      }
      return choice || safe.slice().sort((a, b) => roomy(b) - roomy(a))[0];
    }

    function step() {
      if (ctx.bot) snakes[1].q = [botDir(snakes[1], snakes[0])];
      for (const s of snakes) {
        while (s.q.length) {
          const [dx, dy] = s.q.shift();
          if ((dx === -s.dx && dy === -s.dy) || (dx === s.dx && dy === s.dy)) continue;
          s.dx = dx; s.dy = dy;
          break;
        }
        const head = { x: s.body[0].x + s.dx, y: s.body[0].y + s.dy };
        s.ate = apples.findIndex(same(head));
        s.next = [head, ...(s.ate >= 0 ? s.body : s.body.slice(0, -1))];
      }

      const dead = snakes.map((s, i) => {
        const h = s.next[0];
        if (!inside(h.x, h.y)) return true;
        if (s.next.slice(1).some(same(h))) return true;
        return !solo && snakes[1 - i].next.some(same(h));
      });

      const eaten = new Set();
      for (const s of snakes) {
        s.body = s.next;
        if (s.ate >= 0) eaten.add(s.ate);
      }
      [...eaten].sort((a, b) => b - a).forEach((i) => apples.splice(i, 1));
      eaten.forEach(() => placeApple());
      if (eaten.size) {
        ctx.sfx.pop();
        if (solo) STEP = Math.max(0.06, STEP * 0.98);
      }
      status();

      if (solo) {
        if (dead[0]) {
          const len = snakes[0].body.length;
          const rec = ctx.best(len);
          ctx.end('Crashed', `Length ${len}. Best: ${rec.best}${rec.fresh ? ', a new record' : ''}.`, 500, rec.fresh);
        }
        return;
      }
      const [a, b] = snakes.map((s) => s.body.length);
      if (dead[0] || dead[1]) {
        if (dead[0] && dead[1]) ctx.win(a === b ? 0 : a > b ? 1 : 2, 'Both crashed, so the longer snake takes it.', 600);
        else ctx.win(dead[0] ? 2 : 1, `${ctx.name(dead[0] ? 1 : 2)} crashed.`, 600);
      } else if (a >= TARGET || b >= TARGET) {
        ctx.win(a === b ? 0 : a > b ? 1 : 2, `Reached length ${TARGET}.`, 300);
      }
    }

    function status() {
      if (solo) ctx.status(`Length ${snakes[0].body.length}`);
      else ctx.status(`Length: <span class="p1">${ctx.name(1)} ${snakes[0].body.length}</span>, <span class="p2">${ctx.name(2)} ${snakes[1].body.length}</span>. First to ${TARGET}.`);
    }

    function draw() {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          g.fillStyle = (x + y) % 2 ? '#0e0c1d' : '#121025';
          g.fillRect(x * C, y * C, C, C);
        }
      }
      for (const a of apples) {
        const cx = a.x * C + C / 2, cy = a.y * C + C / 2 + 1;
        g.fillStyle = '#d8453c';
        g.beginPath(); g.arc(cx, cy, C * 0.34, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#5f9e6e';
        g.fillRect(cx - 1, cy - C * 0.5, 3, 7);
      }

      for (const s of snakes) {
        s.body.forEach((p, k) => {
          g.fillStyle = s.color;
          g.globalAlpha = k === 0 ? 1 : 0.9 - (k / s.body.length) * 0.4;
          g.beginPath();
          g.roundRect(p.x * C + 2, p.y * C + 2, C - 4, C - 4, k === 0 ? 9 : 5);
          g.fill();
        });
        g.globalAlpha = 1;
        const h = s.body[0];
        const cx = h.x * C + C / 2, cy = h.y * C + C / 2;
        const px = -s.dy, py = s.dx;
        for (const side of [-1, 1]) {
          const ex = cx + s.dx * 5 + px * 6 * side, ey = cy + s.dy * 5 + py * 6 * side;
          g.fillStyle = '#fff';
          g.beginPath(); g.arc(ex, ey, 4, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#0b0914';
          g.beginPath(); g.arc(ex + s.dx * 1.5, ey + s.dy * 1.5, 2, 0, Math.PI * 2); g.fill();
        }
      }
    }
  },
});
