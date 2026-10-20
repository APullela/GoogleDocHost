Arcade.register({
  id: 'breakout',
  name: 'Breakout',
  modes: [1],
  desc: 'Knock out every brick without letting the ball past you. Three balls.',
  controls: [['How', 'move the mouse, or {1.left} and {1.right}. <kbd>Space</kbd>, {1.up} or a click launches the ball']],

  create(ctx) {
    const W = 900, H = 600, PW = 120, PH = 14, PY = H - 46, R = 8;
    const BC = 12, BR = 6, BW = 68, BH = 22, GAP = 5, TOP = 74;
    const LEFT = (W - (BC * BW + (BC - 1) * GAP)) / 2;
    const COLORS = ['#d6534a', '#e57d5a', '#e8a25b', '#e6c46e', '#5f9e6e', '#7cc4ff'];
    const { c, g } = ctx.canvas(W, H);

    let px = W / 2 - PW / 2, lives = 3, score = 0, level = 1, bricks = [], ball, stuck = true, running = false;
    build();
    resetBall();

    ctx.listen(c, 'pointermove', (e) => {
      const r = c.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * W - PW / 2;
    });
    const launch = () => {
      if (!running || !stuck) return;
      stuck = false;
      const a = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
      const s = 380 + level * 30;
      ball.vx = Math.cos(a) * s;
      ball.vy = Math.sin(a) * s;
    };
    ctx.listen(c, 'pointerdown', launch);
    ctx.listen(window, 'keydown', (e) => { if (e.code === 'Space' || ctx.is(e, 1, 'up') || ctx.is(e, 1, 'action')) launch(); });

    ctx.countdown().then(() => (running = true));
    ctx.loop((dt) => {
      if (running) update(dt);
      draw();
    });
    status();

    function build() {
      bricks = [];
      for (let r = 0; r < BR; r++) {
        for (let k = 0; k < BC; k++) {
          bricks.push({ x: LEFT + k * (BW + GAP), y: TOP + r * (BH + GAP), color: COLORS[r], pts: (BR - r) * 10, alive: true });
        }
      }
    }
    function resetBall() {
      stuck = true;
      ball = { x: px + PW / 2, y: PY - R - 1, vx: 0, vy: 0 };
    }
    function status() {
      ctx.status(`Score ${score}. Level ${level}. Balls left: ${lives}.${stuck && running ? ' Space or click to launch.' : ''}`);
    }

    function update(dt) {
      const dir = (ctx.held(1, 'right') ? 1 : 0) - (ctx.held(1, 'left') ? 1 : 0);
      px += dir * 640 * dt;
      px = Math.max(0, Math.min(W - PW, px));
      if (stuck) {
        ball.x = px + PW / 2;
        ball.y = PY - R - 1;
        return;
      }
      const steps = Math.max(1, Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / 5));
      for (let i = 0; i < steps && !stuck; i++) step(dt / steps);
    }

    function step(dt) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - R) { ball.x = W - R; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); }

      if (ball.vy > 0 && ball.y + R >= PY && ball.y + R <= PY + PH + 6 && ball.x > px - R && ball.x < px + PW + R) {
        const rel = (ball.x - (px + PW / 2)) / (PW / 2);
        const s = Math.hypot(ball.vx, ball.vy);
        const a = -Math.PI / 2 + Math.max(-1, Math.min(1, rel)) * 1.05;
        ball.vx = Math.cos(a) * s;
        ball.vy = Math.sin(a) * s;
        ball.y = PY - R;
        ctx.sfx.blip();
      }

      for (const b of bricks) {
        if (!b.alive) continue;
        if (ball.x + R < b.x || ball.x - R > b.x + BW || ball.y + R < b.y || ball.y - R > b.y + BH) continue;
        b.alive = false;
        score += b.pts;
        ctx.sfx.pop();
        // bounce off whichever side the ball is least deep into
        const ox = Math.min(ball.x + R - b.x, b.x + BW - (ball.x - R));
        const oy = Math.min(ball.y + R - b.y, b.y + BH - (ball.y - R));
        if (ox < oy) ball.vx = -ball.vx;
        else ball.vy = -ball.vy;
        ball.vx *= 1.004;
        ball.vy *= 1.004;
        status();
        break;
      }

      if (!bricks.some((b) => b.alive)) {
        level++;
        build();
        resetBall();
        status();
        return;
      }

      if (ball.y - R > H) {
        lives--;
        if (lives <= 0) {
          const rec = ctx.best(score);
          ctx.end('Out of balls', `Score ${score}, level ${level}. Best: ${rec.best}${rec.fresh ? ', a new record' : ''}.`, 300, rec.fresh);
          return;
        }
        resetBall();
        status();
      }
    }

    function draw() {
      g.fillStyle = '#0b0a18';
      g.fillRect(0, 0, W, H);
      for (const b of bricks) {
        if (!b.alive) continue;
        g.fillStyle = b.color;
        g.fillRect(b.x, b.y, BW, BH);
        g.fillStyle = 'rgba(0,0,0,.18)';
        g.fillRect(b.x, b.y + BH - 4, BW, 4);
      }
      g.fillStyle = '#f1ebdd';
      g.fillRect(px, PY, PW, PH);
      g.beginPath();
      g.arc(ball.x, ball.y, R, 0, Math.PI * 2);
      g.fill();

      g.font = Arcade.font(22, 'italic');
      g.textAlign = 'left';
      g.fillStyle = '#b3ab9c';
      g.fillText(`Score ${score}`, 20, 40);
      g.textAlign = 'right';
      g.fillText(`Level ${level}   ` + '●'.repeat(Math.max(0, lives)), W - 20, 40);
    }
  },
});
