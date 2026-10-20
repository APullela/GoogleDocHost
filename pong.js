Arcade.register({
  id: 'pong',
  name: 'Pong',
  modes: [2],
  desc: 'Two paddles and a ball that gets quicker every time it\'s hit.',
  controls: [['P1', '{1.up} {1.down} to move'], ['P2', '{2.up} {2.down} to move']],
  options: [{ key: 'target', label: 'Points to win', def: 5, choices: [[3, '3'], [5, '5'], [7, '7'], [11, '11']] }],

  create(ctx) {
    const W = 900, H = 540, PW = 14, PH = 96, R = 9, PAD_SPEED = 540;
    const TARGET = ctx.opts.target;
    const { g } = ctx.canvas(W, H);
    const pads = [
      { seat: 1, x: 30, y: H / 2 - PH / 2, score: 0, color: ctx.P1, flash: 0 },
      { seat: 2, x: W - 30 - PW, y: H / 2 - PH / 2, score: 0, color: ctx.P2, flash: 0 },
    ];
    // speed multiplier, aim error in px, and how far across the ball must be before it reacts
    const BOT = [null, { spd: 0.5, err: 70, react: 0.6 }, { spd: 0.78, err: 34, react: 0.4 }, { spd: 1.1, err: 26, react: 0 }, { spd: 1.25, err: 22, react: 0 }][ctx.bot];
    let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    let serving = true, started = false, hits = 0, aimFor = -1, aimErr = 0;
    const trail = [];

    ctx.countdown().then(() => { started = true; serve(Math.random() < 0.5 ? 1 : -1); });
    ctx.loop((dt) => {
      if (started) update(dt);
      draw();
    });

    function serve(dir) {
      ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
      serving = true;
      hits++;
      ctx.after(700, () => {
        const a = Math.random() * 0.8 - 0.4;
        ball.vx = Math.cos(a) * 400 * dir;
        ball.vy = Math.sin(a) * 400;
        serving = false;
      });
    }

    // Where the ball will cross x, bouncing off the top and bottom walls.
    function predictY(x) {
      const t = (x - ball.x) / ball.vx;
      const span = H - 2 * R;
      let y = ball.y + ball.vy * t - R;
      y = ((y % (2 * span)) + 2 * span) % (2 * span);
      if (y > span) y = 2 * span - y;
      return y + R;
    }

    function botMove(p, dt) {
      let target = H / 2;
      if (!serving && ball.vx > 0 && ball.x > W * BOT.react) {
        if (aimFor !== hits) {
          aimFor = hits;
          aimErr = (Math.random() * 2 - 1) * BOT.err;
          // a Hard slip: line up just past the end of the paddle
          if (ctx.slip()) aimErr = (Math.random() < 0.5 ? -1 : 1) * (PH / 2 + R + 6 + Math.random() * 24);
        }
        target = predictY(p.x) + aimErr;
      }
      const diff = target - (p.y + PH / 2);
      const max = PAD_SPEED * BOT.spd * dt;
      if (Math.abs(diff) > 4) p.y += Math.max(-max, Math.min(max, diff));
    }

    function update(dt) {
      pads.forEach((p, i) => {
        if (i === 1 && ctx.bot) botMove(p, dt);
        else p.y += ((ctx.held(p.seat, 'down') ? 1 : 0) - (ctx.held(p.seat, 'up') ? 1 : 0)) * PAD_SPEED * dt;
        p.y = Math.max(0, Math.min(H - PH, p.y));
        p.flash = Math.max(0, p.flash - dt * 4);
      });
      if (serving) return;
      // sub-steps so a fast ball can't pass through a paddle
      const steps = Math.max(1, Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / 6));
      for (let i = 0; i < steps && !serving; i++) step(dt / steps);
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 12) trail.shift();
    }

    function step(dt) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.y < R) { ball.y = R; ball.vy = Math.abs(ball.vy); }
      if (ball.y > H - R) { ball.y = H - R; ball.vy = -Math.abs(ball.vy); }

      pads.forEach((p, i) => {
        const toward = i === 0 ? ball.vx < 0 : ball.vx > 0;
        if (!toward) return;
        if (ball.y + R > p.y && ball.y - R < p.y + PH && ball.x + R > p.x && ball.x - R < p.x + PW) {
          const rel = (ball.y - (p.y + PH / 2)) / (PH / 2);
          const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.06, 1150);
          const ang = Math.max(-1, Math.min(1, rel)) * 0.95;
          ball.vx = Math.cos(ang) * speed * (i === 0 ? 1 : -1);
          ball.vy = Math.sin(ang) * speed;
          ball.x = i === 0 ? p.x + PW + R : p.x - R;
          p.flash = 1;
          hits++;
          ctx.sfx.blip();
        }
      });

      if (ball.x < -R * 2) point(1);
      else if (ball.x > W + R * 2) point(0);
    }

    function point(i) {
      pads[i].score++;
      trail.length = 0;
      if (pads[i].score >= TARGET) {
        serving = true;
        ctx.win(i + 1, `${pads[0].score} to ${pads[1].score}.`);
        return;
      }
      serve(i === 0 ? 1 : -1); // serve toward whoever just lost the point
    }

    function draw() {
      g.fillStyle = '#0b0a18';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#2a2744';
      for (let y = 10; y < H; y += 30) g.fillRect(W / 2 - 2, y, 4, 16);

      g.font = Arcade.font(84, 'italic');
      g.textAlign = 'center';
      g.fillStyle = 'rgba(124,196,255,.3)';
      g.fillText(pads[0].score, W / 2 - 90, 100);
      g.fillStyle = 'rgba(255,143,107,.3)';
      g.fillText(pads[1].score, W / 2 + 90, 100);

      for (const p of pads) {
        g.shadowColor = p.color;
        g.shadowBlur = 6 + p.flash * 22;
        g.fillStyle = p.color;
        g.fillRect(p.x, p.y, PW, PH);
      }
      g.shadowBlur = 0;

      trail.forEach((t, k) => {
        g.fillStyle = `rgba(241,235,221,${(k / trail.length) * 0.22})`;
        g.beginPath();
        g.arc(t.x, t.y, R * (k / trail.length), 0, Math.PI * 2);
        g.fill();
      });
      g.fillStyle = '#f1ebdd';
      g.beginPath();
      g.arc(ball.x, ball.y, R, 0, Math.PI * 2);
      g.fill();
    }
  },
});
