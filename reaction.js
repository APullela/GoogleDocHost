Arcade.register({
  id: 'reaction',
  name: 'Quick Draw',
  modes: [2],
  desc: 'Wait for green, then hit your key. Go early and the point goes to the other side.',
  controls: [['P1', '{1.action}, or tap the left half'], ['P2', '{2.action}, or tap the right half']],
  options: [{ key: 'target', label: 'First to', def: 5, choices: [[3, '3'], [5, '5'], [7, '7']] }],

  create(ctx) {
    const { el } = Arcade;
    const TARGET = ctx.opts.target;
    const pts = [0, 0];
    const best = [Infinity, Infinity];
    let state = 'idle', goAt = 0, timer = 0, botTimer = 0;

    const wrap = el('div', 'rx');
    const sides = [1, 2].map((p) => {
      const side = el('button', 'rx-side p' + p, `
        <div class="rx-label">${ctx.name(p)}</div>
        <div class="rx-pts">0</div>
        <div class="rx-key">${p === 2 && ctx.bot ? '<span class="rx-best">the computer</span>' : ctx.kbd(p, 'action')}</div>
        <div class="rx-best rx-rec">best &ndash;</div>`);
      side.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!(p === 2 && ctx.bot)) press(p - 1);
      });
      wrap.appendChild(side);
      return side;
    });
    const signal = el('div', 'rx-signal', 'Get ready');
    wrap.appendChild(signal);
    ctx.stage.appendChild(wrap);

    ctx.listen(window, 'keydown', (e) => {
      if (e.repeat) return;
      if (ctx.is(e, 1, 'action')) press(0);
      else if (ctx.is(e, 2, 'action') && !ctx.bot) press(1);
    });
    ctx.status(`First to ${TARGET}.`);
    ctx.countdown().then(round);

    function show(cls, html) {
      signal.className = 'rx-signal ' + cls;
      signal.innerHTML = html;
    }

    function round() {
      state = 'wait';
      show('wait', 'Wait for green');
      const wait = 1200 + Math.random() * 3300;
      timer = ctx.after(wait, () => {
        state = 'go';
        goAt = performance.now();
        show('go', 'Go');
        ctx.sfx.go();
        if (ctx.bot) {
          const [lo, hi] = [null, [380, 560], [260, 380], [175, 215], [120, 135]][ctx.bot];
          // a Hard slip: it looks away for a moment and reacts late
          const late = ctx.slip() ? 160 + Math.random() * 120 : 0;
          botTimer = ctx.after(lo + Math.random() * (hi - lo) + late, () => press(1));
        }
      });
      // the computer occasionally jumps the gun too
      if (ctx.bot && Math.random() < [0, 0.1, 0.04, 0, 0][ctx.bot]) {
        botTimer = ctx.after(Math.random() * wait * 0.9, () => press(1));
      }
    }

    function press(i) {
      if (ctx.ended) return;
      if (state === 'wait') {
        clearTimeout(timer);
        clearTimeout(botTimer);
        state = 'done';
        award(1 - i, `<span><b class="p${i + 1}">${ctx.name(i + 1)}</b><br>went too early</span>`);
      } else if (state === 'go') {
        clearTimeout(botTimer);
        const ms = Math.round(performance.now() - goAt);
        state = 'done';
        best[i] = Math.min(best[i], ms);
        award(i, `<span><b class="p${i + 1}">${ctx.name(i + 1)}</b><br>${ms} ms</span>`);
      }
    }

    function award(i, msg) {
      pts[i]++;
      show('', msg);
      sides.forEach((side, k) => {
        side.querySelector('.rx-pts').textContent = pts[k];
        side.querySelector('.rx-rec').textContent = best[k] < Infinity ? `best ${best[k]} ms` : 'best –';
      });
      sides[i].classList.remove('hit');
      void sides[i].offsetWidth;
      sides[i].classList.add('hit');
      if (pts[i] >= TARGET) ctx.win(i + 1, `${pts[0]} to ${pts[1]}.`, 1000);
      else ctx.after(1700, round);
    }
  },
});
