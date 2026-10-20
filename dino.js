Arcade.register({
  id: 'dino',
  name: 'Dino Duel',
  modes: [1, 2, 4],
  desc: 'The Chrome dinosaur, but up to four of them. Same cacti, same birds. Last one running wins.',
  controls: [
    ['P1', '{1.up} jump, {1.down} duck'],
    ['P2', '{2.up} jump, {2.down} duck'],
    ['P3', '{3.up} jump, {3.down} duck'],
    ['P4', '{4.up} jump, {4.down} duck'],
  ],

  create(ctx) {
    const n = ctx.players;
    const solo = n === 1;
    const W = n === 4 ? 1300 : 900, LANE = 260, H = LANE * n, GROUND = LANE - 44, DX = 90;
    const { g } = ctx.canvas(W, H);
    const rand = (a, b) => a + Math.random() * (b - a);

    const players = Array.from({ length: n }, (_, i) => ({
      seat: i + 1,
      color: ctx.COLORS[i + 1],
      bot: ctx.seatBot(i + 1),
      ai: {},
      plans: new WeakMap(),
      y: 0, vy: 0, duck: false, dead: false, out: 0,
    }));
    const clouds = Array.from({ length: Math.round(W / 150) }, () => ({ x: rand(0, W), y: rand(30, 120), s: rand(0.6, 1.2) }));
    let obstacles = [];
    let speed = 430, dist = 0, anim = 0, nextGap = 0, running = false;
    const fallen = []; // seats in the order they crashed

    ctx.countdown().then(() => (running = true));
    ctx.loop((dt) => {
      if (running) update(dt);
      draw();
    });

    const held = (p, which) => (p.bot ? p.ai[which] : ctx.held(p.seat, which));

    function spawn() {
      if (dist > 2500 && Math.random() < 0.3) {
        const low = Math.random() < 0.5; // low birds get jumped, high ones ducked
        obstacles.push({ type: 'bird', x: W + 20, w: 42, h: 24, b: low ? 14 : 36 });
      } else {
        const k = 1 + Math.floor(Math.random() * 3);
        obstacles.push({ type: 'cactus', x: W + 20, w: k * 16 + (k - 1) * 4, h: rand(34, 52), b: 0, n: k });
      }
      nextGap = speed * rand(0.8, 1.6) + 120;
    }

    // Each computer dino decides once per obstacle when to react. Easy and
    // Medium are sloppy; Hard is exact except for its occasional slip, when
    // it reacts noticeably early or late; Impossible never slips.
    function plan(p) {
      const spread = [0, 0.11, 0.06, 0.008, 0][p.bot];
      const miss = [0, 0.1, 0.035, 0, 0][p.bot];
      let at = 0.2 + (Math.random() * 2 - 1) * spread;
      if (ctx.slip(p.seat)) at += (Math.random() < 0.5 ? -1 : 1) * rand(0.13, 0.2);
      return { at, miss: Math.random() < miss };
    }

    function think(p) {
      p.ai = { up: false, down: false };
      const o = obstacles.find((ob) => ob.x + ob.w > DX - 2);
      if (!o) return;
      if (!p.plans.has(o)) p.plans.set(o, plan(p));
      const pl = p.plans.get(o);
      if (pl.miss) return;
      const d = o.x - (DX + 38);
      if (o.type === 'bird' && o.b > 20) p.ai.down = d < speed * pl.at + 30;
      else p.ai.up = d < speed * pl.at;
    }

    function hitbox(p) {
      return p.duck ? { x: DX, w: 56, y: p.y, h: 26 } : { x: DX + 4, w: 34, y: p.y, h: 46 };
    }

    function update(dt) {
      speed += 9 * dt;
      dist += speed * dt;
      anim += dt;
      const alive = players.filter((p) => !p.dead);

      for (const p of alive) {
        if (p.bot) think(p);
        const grounded = p.y <= 0;
        const down = held(p, 'down');
        if (grounded && held(p, 'up')) p.vy = 800;
        p.duck = grounded && down;
        p.vy -= (down && !grounded ? 5200 : 2500) * dt; // holding down mid-air drops you fast
        p.y += p.vy * dt;
        if (p.y <= 0) { p.y = 0; p.vy = 0; }
      }

      for (const o of obstacles) o.x -= speed * dt;
      obstacles = obstacles.filter((o) => o.x + o.w > -40);
      const last = obstacles[obstacles.length - 1];
      if (!last || W + 20 - last.x >= nextGap) spawn();

      for (const c of clouds) {
        c.x -= speed * 0.12 * c.s * dt;
        if (c.x < -80) { c.x = W + rand(0, 200); c.y = rand(30, 120); }
      }

      const m = Math.floor(dist / 10);
      const crashed = alive.filter((p) => {
        const b = hitbox(p);
        return obstacles.some((o) => b.x < o.x + o.w - 3 && b.x + b.w > o.x + 3 && b.y < o.b + o.h - 3 && b.y + b.h > o.b + 3);
      });
      crashed.forEach((p) => { p.dead = true; p.out = m; fallen.push(p.seat); });
      if (crashed.length) ctx.sfx.pop();

      if (solo) {
        if (players[0].dead) {
          const rec = ctx.best(m);
          ctx.end('You tripped', `${m} metres. Best: ${rec.best}${rec.fresh ? ', a new record' : ''}.`, 500, rec.fresh);
        }
        return;
      }
      const left = players.filter((p) => !p.dead);
      if (left.length === 1) {
        const order = fallen.slice().reverse().map((s) => ctx.name(s));
        ctx.win(left[0].seat, n === 4 ? `${m} metres. Then ${order.join(', then ')}.` : `${m} metres in.`, 500);
      } else if (left.length === 0) {
        ctx.win(0, crashed.length === n ? 'Everyone went down together.' : 'The last ones fell at the same moment.', 500);
      }
    }

    function drawCloud(x, y, s) {
      g.beginPath();
      g.ellipse(x, y, 34 * s, 10 * s, 0, 0, Math.PI * 2);
      g.ellipse(x + 14 * s, y - 7 * s, 18 * s, 10 * s, 0, 0, Math.PI * 2);
      g.fill();
    }

    function drawObstacle(o) {
      const top = GROUND - o.b - o.h;
      if (o.type === 'cactus') {
        g.fillStyle = '#5f9e6e';
        for (let k = 0; k < o.n; k++) {
          const x = o.x + k * 20;
          g.beginPath();
          g.roundRect(x + 3, top, 10, o.h, 4);
          g.fill();
          g.fillRect(x, top + o.h * 0.35, 3, o.h * 0.25);
          g.fillRect(x + 13, top + o.h * 0.25, 3, o.h * 0.25);
        }
      } else {
        const flap = Math.floor(anim * 8) % 2;
        g.fillStyle = '#e8e2d2';
        g.fillRect(o.x + 8, top + 8, 28, 10);
        g.fillRect(o.x, top + 8, 10, 6);
        g.fillRect(o.x + 14, flap ? top : top + 16, 12, 8);
        g.fillStyle = '#0b0914';
        g.fillRect(o.x + 10, top + 9, 3, 3);
      }
    }

    function drawDino(p) {
      const x = DX, yb = GROUND - p.y;
      const step = Math.floor(anim * 12) % 2;
      const walking = p.y <= 0 && running && !p.dead;
      g.fillStyle = p.dead ? '#5b566b' : p.color;
      let ex, ey;
      if (p.duck) {
        g.fillRect(x, yb - 26, 40, 16);
        g.fillRect(x + 34, yb - 28, 24, 14);
        g.fillRect(x - 6, yb - 24, 8, 6);
        g.fillRect(x + 8, yb - 10, 6, walking && step ? 6 : 10);
        g.fillRect(x + 24, yb - 10, 6, walking && !step ? 6 : 10);
        ex = x + 48; ey = yb - 25;
      } else {
        g.fillRect(x + 18, yb - 46, 22, 16);
        g.fillRect(x + 4, yb - 34, 24, 22);
        g.fillRect(x - 4, yb - 30, 8, 10);
        g.fillRect(x + 28, yb - 26, 6, 3);
        g.fillRect(x + 8, yb - 12, 6, walking && step ? 7 : 12);
        g.fillRect(x + 20, yb - 12, 6, walking && !step ? 7 : 12);
        ex = x + 32; ey = yb - 42;
      }
      g.fillStyle = '#0b0914';
      if (p.dead) {
        g.strokeStyle = '#0b0914';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(ex - 1, ey - 1); g.lineTo(ex + 5, ey + 5);
        g.moveTo(ex + 5, ey - 1); g.lineTo(ex - 1, ey + 5);
        g.stroke();
      } else {
        g.fillRect(ex, ey, 4, 4);
      }
    }

    const BG = ['#0e1424', '#191326', '#0f1a1a', '#1a170f'];
    function draw() {
      players.forEach((p, i) => {
        g.save();
        g.translate(0, i * LANE);
        g.fillStyle = BG[i];
        g.fillRect(0, 0, W, LANE);

        g.fillStyle = 'rgba(255,255,255,.05)';
        for (const c of clouds) drawCloud(c.x, c.y, c.s);

        g.fillStyle = '#4a4660';
        g.fillRect(0, GROUND, W, 2);
        g.fillStyle = '#2c2a40';
        for (let k = 0; k < 40; k++) {
          const x = (((k * 97 - dist) % W) + W) % W;
          g.fillRect(x, GROUND + 8 + ((k * 13) % 24), 3 + (k % 3) * 2, 2);
        }

        obstacles.forEach(drawObstacle);
        drawDino(p);

        g.font = Arcade.font(n === 4 ? 26 : 19, 'italic');
        g.textAlign = 'left';
        g.fillStyle = p.color;
        g.fillText(solo ? '' : ctx.name(i + 1) + (p.dead ? `, out at ${p.out} m` : ''), 16, n === 4 ? 36 : 30);
        g.fillStyle = '#b3ab9c';
        g.textAlign = 'right';
        g.font = Arcade.font(n === 4 ? 26 : 19);
        g.fillText(String(Math.floor(dist / 10)).padStart(5, '0'), W - 16, n === 4 ? 36 : 30);
        if (p.dead && n === 4) {
          g.fillStyle = 'rgba(5,4,12,.45)';
          g.fillRect(0, 0, W, LANE);
        }
        g.restore();
      });
      g.fillStyle = '#05040c';
      for (let i = 1; i < n; i++) g.fillRect(0, i * LANE - 2, W, 4);
    }
  },
});
