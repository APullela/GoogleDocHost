Arcade.register({
  id: 'whack',
  name: 'Whack-a-Mole',
  modes: [1],
  desc: 'Thirty seconds. Hit whatever comes up. The gold ones are worth three.',
  controls: [['How', 'click the moles, or use the number pad <kbd>1</kbd> to <kbd>9</kbd>']],

  create(ctx) {
    const { el } = Arcade;
    const TIME = 30;
    const NUMPAD = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };
    let score = 0, left = TIME, running = false, misses = 0;

    const wrap = el('div', 'whack');
    const holes = Array.from({ length: 9 }, (_, i) => {
      const h = el('button', 'hole', '<div class="mole"></div>');
      h.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(i); });
      wrap.appendChild(h);
      return { el: h, up: false, gold: false, timer: 0 };
    });
    ctx.stage.appendChild(wrap);

    ctx.listen(window, 'keydown', (e) => {
      const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
      if (m) hit(NUMPAD[m[2]]);
    });

    status();
    ctx.countdown().then(() => {
      running = true;
      const start = performance.now();
      ctx.every(100, () => {
        if (ctx.ended) return;
        left = Math.max(0, TIME - (performance.now() - start) / 1000);
        status();
        if (left <= 0) finish();
      });
      spawnLoop();
    });

    function status() {
      ctx.status(`Score ${score}. ${Math.ceil(left)} seconds left.`);
    }

    function spawnLoop() {
      if (ctx.ended || left <= 0) return;
      const progress = 1 - left / TIME;
      const howMany = progress > 0.5 && Math.random() < 0.35 ? 2 : 1;
      for (let k = 0; k < howMany; k++) popUp(progress);
      ctx.after(650 - progress * 300 + Math.random() * 200, spawnLoop);
    }

    function popUp(progress) {
      const free = holes.filter((h) => !h.up);
      if (!free.length) return;
      const h = free[Math.floor(Math.random() * free.length)];
      h.up = true;
      h.gold = Math.random() < 0.12;
      h.el.className = 'hole up' + (h.gold ? ' gold' : '');
      const stay = (h.gold ? 650 : 1000) - progress * 400;
      h.timer = ctx.after(stay, () => down(h, true));
    }

    function down(h, escaped) {
      if (!h.up) return;
      h.up = false;
      if (escaped) misses++;
      h.el.className = 'hole';
    }

    function hit(i) {
      if (!running || ctx.ended) return;
      const h = holes[i];
      if (!h.up) return;
      clearTimeout(h.timer);
      score += h.gold ? 3 : 1;
      ctx.sfx.pop();
      h.el.classList.add('bonk');
      h.up = false;
      ctx.after(120, () => { if (!h.up) h.el.className = 'hole'; });
      status();
    }

    function finish() {
      holes.forEach((h) => down(h, false));
      const rec = ctx.best(score);
      ctx.end("Time's up", `${score} points, ${misses} got away. Best: ${rec.best}${rec.fresh ? ', a new record' : ''}.`, 300, rec.fresh);
    }
  },
});
