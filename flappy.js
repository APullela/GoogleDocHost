Arcade.register({
  id: 'flappy',
  name: 'Flappy Duel',
  modes: [1, 2],
  desc: 'Two birds, the same pipes. The last one still flying wins.',
  controls: [['P1', '{1.up} to flap'], ['P2', '{2.up} to flap']],

  create(ctx) {
    const solo = ctx.players === 1;
    const W = 900, H = 540, GROUND = H - 48, R = 15, GAP = 165, PW = 72, SPACING = 290, FLAP = -430, GRAV = 1450;
    const { c, g } = ctx.canvas(W, H);
    const birds = [{ seat: 1, color: ctx.P1, x: solo ? 240 : 210, base: H / 2 - (solo ? 10 : 50) }];
    if (!solo) birds.push({ seat: 2, color: ctx.P2, x: 280, base: H / 2 + 30, bot: ctx.bot });
    birds.forEach((b) => Object.assign(b, { y: b.base, vy: 0, dead: false, cool: 0, think: 0, err: 0, lastPipe: null }));
    const pipes = [];
    let speed = 210, t = 0, passed = 0, groundX = 0, running = false;

    const addPipe = (x) => pipes.push({ x, top: 70 + Math.random() * (GROUND - 140 - GAP), scored: false });
    addPipe(W + 120);

    const flap = (b) => { b.vy = FLAP; };
    ctx.listen(window, 'keydown', (e) => {
      if (!running || e.repeat) return;
      for (const b of birds) if (!b.bot && (ctx.is(e, b.seat, 'up') || (solo && e.code === 'Space'))) flap(b);
    });
    if (solo) ctx.listen(c, 'pointerdown', () => running && flap(birds[0]));

    ctx.countdown().then(() => {
      running = true;
      birds.forEach(flap);
    });
    ctx.loop((dt) => {
      t += dt;
      if (running) update(dt);
      else birds.forEach((b, i) => (b.y = b.base + Math.sin(t * 4 + i) * 8));
      draw();
    });

    // The computer aims a little below the middle of the next gap and flaps
    // whenever it sinks under that line. Lower levels aim worse and react slower.
    function think(b, dt) {
      b.cool -= dt;
      b.think -= dt;
      if (b.think > 0) return;
      b.think = [0, 0.12, 0.05, 0, 0][b.bot];
      const p = pipes.find((pp) => pp.x + PW > b.x - R);
      if (!p) return;
      if (p !== b.lastPipe) {
        b.lastPipe = p;
        b.err = (Math.random() * 2 - 1) * [0, 40, 18, 4, 0][b.bot];
        // a Hard slip: aim well off the middle of this gap
        if (ctx.slip()) b.err = (Math.random() < 0.5 ? -1 : 1) * (38 + Math.random() * 12);
      }
      const target = p.top + GAP * 0.62 + b.err;
      if (b.y > target && b.vy > -60 && b.cool <= 0) {
        flap(b);
        b.cool = 0.16;
      }
    }

    function hits(cx, cy, r, x, y, w, h) {
      const nx = Math.max(x, Math.min(cx, x + w));
      const ny = Math.max(y, Math.min(cy, y + h));
      return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
    }

    function update(dt) {
      speed += 3 * dt;
      groundX = (groundX + speed * dt) % 24;
      for (const b of birds) {
        if (b.bot) think(b, dt);
        b.vy += GRAV * dt;
        b.y += b.vy * dt;
        if (b.y < R) { b.y = R; b.vy = 0; }
      }
      for (const p of pipes) p.x -= speed * dt;
      if (pipes[0].x < -PW) pipes.shift();
      const last = pipes[pipes.length - 1];
      if (last.x < W - SPACING) addPipe(last.x + SPACING);

      for (const p of pipes) {
        if (!p.scored && p.x + PW < birds[0].x - R) {
          p.scored = true;
          passed++;
          ctx.sfx.blip();
        }
      }

      for (const b of birds) {
        const r = R - 2;
        b.dead = b.y + r > GROUND || pipes.some((p) =>
          hits(b.x, b.y, r, p.x, 0, PW, p.top) ||
          hits(b.x, b.y, r, p.x, p.top + GAP, PW, GROUND - p.top - GAP));
      }
      if (solo) {
        if (birds[0].dead) {
          const rec = ctx.best(passed);
          ctx.end('Down you go', `${passed} pipes. Best: ${rec.best}${rec.fresh ? ', a new record' : ''}.`, 500, rec.fresh);
        }
        return;
      }
      const [a, bb] = birds;
      if (a.dead || bb.dead) ctx.win(a.dead && bb.dead ? 0 : a.dead ? 2 : 1, `${passed} pipes cleared.`, 500);
    }

    function drawBird(b, label) {
      const rot = running ? Math.max(-0.5, Math.min(1.2, b.vy / 600)) : 0;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(rot);
      g.fillStyle = b.color;
      g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)';
      const wing = Math.sin(t * 20) * 4;
      g.beginPath(); g.ellipse(-5, 3 + wing * (b.vy < 0 ? 1 : 0.2), 8, 5, -0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(6, -5, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0b0914';
      g.beginPath(); g.arc(b.dead ? 6 : 8, -5, 2.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8a25b';
      g.beginPath(); g.moveTo(12, -1); g.lineTo(22, 3); g.lineTo(12, 7); g.fill();
      g.restore();
      if (label) {
        g.font = Arcade.font(15, 'italic');
        g.textAlign = 'center';
        g.fillStyle = b.color;
        g.fillText(label, b.x, b.y - R - 8);
      }
    }

    function draw() {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#120f2a');
      sky.addColorStop(1, '#2a2148');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);

      g.fillStyle = 'rgba(255,255,255,.04)';
      for (let k = 0; k < 6; k++) {
        const x = ((k * 190 - t * 20) % (W + 200) + W + 200) % (W + 200) - 100;
        g.beginPath(); g.arc(x, GROUND - 10, 70 + (k % 3) * 25, Math.PI, 0); g.fill();
      }

      for (const p of pipes) {
        g.fillStyle = '#4b8a5a';
        g.fillRect(p.x, 0, PW, p.top);
        g.fillRect(p.x, p.top + GAP, PW, GROUND - p.top - GAP);
        g.fillStyle = '#5f9e6e';
        g.fillRect(p.x - 5, p.top - 22, PW + 10, 22);
        g.fillRect(p.x - 5, p.top + GAP, PW + 10, 22);
      }

      g.fillStyle = '#2e2620';
      g.fillRect(0, GROUND, W, H - GROUND);
      g.fillStyle = '#4b7a3d';
      g.fillRect(0, GROUND, W, 10);
      g.fillStyle = '#3d6531';
      for (let x = -groundX; x < W; x += 24) g.fillRect(x, GROUND, 12, 10);

      birds.forEach((b, i) => drawBird(b, solo ? '' : ctx.name(i + 1)));

      g.font = Arcade.font(64, 'italic');
      g.textAlign = 'center';
      g.fillStyle = 'rgba(241,235,221,.9)';
      g.fillText(passed, W / 2, 84);
    }
  },
});
