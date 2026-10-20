Arcade.register({
  id: 'tron',
  name: 'Light Cycles',
  modes: [2],
  desc: 'Your bike leaves a wall behind it. Make the other bike run into something first.',
  controls: [['P1', '{1.up} {1.left} {1.down} {1.right} to steer'], ['P2', '{2.up} {2.left} {2.down} {2.right} to steer']],

  create(ctx) {
    const C = 10, COLS = 90, ROWS = 54, W = COLS * C, H = ROWS * C, STEP = 0.042;
    const { g } = ctx.canvas(W, H);
    const grid = new Uint8Array(COLS * ROWS);
    function steering(p) {
      const m = {};
      [['up', [0, -1]], ['down', [0, 1]], ['left', [-1, 0]], ['right', [1, 0]]].forEach(([a, d]) => ctx.codes(p, a).forEach((c) => (m[c] = d)));
      return m;
    }
    // Hard gets one chance to slip every couple of seconds; a slip means taking
    // its second-best turn the next time it has a real choice.
    let slipPending = false;
    if (ctx.bot === 3) ctx.every(2000, () => { if (ctx.slip()) slipPending = true; });
    const colors = [null, ctx.P1, ctx.P2];
    const bikes = [
      { id: 1, x: 12, y: ROWS >> 1, dx: 1, dy: 0, q: [], map: steering(1) },
      { id: 2, x: COLS - 13, y: ROWS >> 1, dx: -1, dy: 0, q: [], map: ctx.bot ? {} : steering(2) },
    ];
    bikes.forEach((b) => (grid[b.y * COLS + b.x] = b.id));
    let running = false, acc = 0;
    const crashes = [];

    ctx.listen(window, 'keydown', (e) => {
      for (const b of bikes) {
        const d = b.map[e.code];
        if (d && b.q.length < 3) b.q.push(d);
      }
    });
    ctx.countdown().then(() => {
      running = true;
      bikes.forEach((b) => (b.q = b.q.slice(-1)));
    });
    ctx.loop((dt) => {
      if (running) {
        acc += dt;
        while (acc >= STEP && !ctx.ended) { acc -= STEP; step(); }
      }
      draw();
    });

    // ----- computer rider -----
    const free = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !grid[y * COLS + x];
    const queue = new Int32Array(COLS * ROWS);
    const distA = new Int32Array(COLS * ROWS);
    const distB = new Int32Array(COLS * ROWS);

    // Breadth-first distances from (sx, sy) over empty cells; -1 means unreachable.
    function bfs(sx, sy, dist) {
      dist.fill(-1);
      let head = 0, tail = 0;
      dist[sy * COLS + sx] = 0;
      queue[tail++] = sy * COLS + sx;
      let count = 0;
      while (head < tail) {
        const i = queue[head++];
        const x = i % COLS, y = (i / COLS) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!free(nx, ny)) continue;
          const j = ny * COLS + nx;
          if (dist[j] !== -1) continue;
          dist[j] = dist[i] + 1;
          queue[tail++] = j;
          count++;
        }
      }
      return count;
    }

    function botDir(b, o) {
      const dirs = [[b.dx, b.dy], [-b.dy, b.dx], [b.dy, -b.dx]]; // straight, then the two turns
      const safe = dirs.filter(([dx, dy]) => free(b.x + dx, b.y + dy));
      if (!safe.length) return dirs[0];
      if (ctx.bot === 1) {
        if (free(b.x + b.dx, b.y + b.dy) && Math.random() < 0.92) return dirs[0];
        return safe[Math.floor(Math.random() * safe.length)];
      }
      const scored = [];
      for (const d of safe) {
        const nx = b.x + d[0], ny = b.y + d[1];
        grid[ny * COLS + nx] = 9;
        let score = bfs(nx, ny, distA);
        if (ctx.bot >= 3) {
          // count the cells this bike would reach before the other one
          bfs(o.x, o.y, distB);
          let mine = 0;
          for (let i = 0; i < distA.length; i++) {
            if (distA[i] > 0 && (distB[i] === -1 || distA[i] < distB[i])) mine++;
          }
          score = mine * 2 + score * 0.25;
        }
        grid[ny * COLS + nx] = 0;
        if (nx === o.x + o.dx && ny === o.y + o.dy) score -= 5000; // don't meet head on
        if (d === dirs[0]) score += 0.5;
        scored.push([score, d]);
      }
      scored.sort((a, b) => b[0] - a[0]);
      if (slipPending && scored.length > 1 && scored[1][0] > -1000) {
        slipPending = false;
        return scored[1][1];
      }
      return scored[0][1];
    }

    function step() {
      if (ctx.bot) bikes[1].q = [botDir(bikes[1], bikes[0])];
      for (const b of bikes) {
        while (b.q.length) {
          const [dx, dy] = b.q.shift();
          if ((dx === -b.dx && dy === -b.dy) || (dx === b.dx && dy === b.dy)) continue;
          b.dx = dx; b.dy = dy;
          break;
        }
        b.nx = b.x + b.dx;
        b.ny = b.y + b.dy;
      }
      const crashed = bikes.map((b) => !free(b.nx, b.ny));
      if (bikes[0].nx === bikes[1].nx && bikes[0].ny === bikes[1].ny) crashed[0] = crashed[1] = true;

      bikes.forEach((b, i) => {
        b.x = b.nx; b.y = b.ny;
        if (crashed[i]) crashes.push({ x: b.x, y: b.y, color: colors[b.id] });
        else grid[b.y * COLS + b.x] = b.id;
      });

      if (crashed[0] || crashed[1]) {
        const both = crashed[0] && crashed[1];
        ctx.win(both ? 0 : crashed[0] ? 2 : 1, both ? 'Both bikes went at once.' : `${ctx.name(crashed[0] ? 1 : 2)} hit a wall.`, 600);
      }
    }

    function draw() {
      g.fillStyle = '#07060f';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(140,120,220,.09)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = 0; x <= W; x += C * 5) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
      for (let y = 0; y <= H; y += C * 5) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
      g.stroke();

      g.globalAlpha = 0.75;
      for (let i = 0; i < grid.length; i++) {
        const v = grid[i];
        if (!v) continue;
        g.fillStyle = colors[v];
        g.fillRect((i % COLS) * C + 1, Math.floor(i / COLS) * C + 1, C - 2, C - 2);
      }
      g.globalAlpha = 1;

      for (const b of bikes) {
        g.shadowColor = colors[b.id];
        g.shadowBlur = 16;
        g.fillStyle = '#fff';
        g.fillRect(b.x * C, b.y * C, C, C);
      }
      g.shadowBlur = 0;

      for (const c of crashes) {
        g.strokeStyle = c.color;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(c.x * C + C / 2, c.y * C + C / 2, 18, 0, Math.PI * 2);
        g.stroke();
      }
    }
  },
});
