Arcade.register({
  id: 'simon',
  name: 'Simon',
  modes: [1],
  desc: 'Watch the pattern, then play it back. It gets one longer every round.',
  controls: [['How', 'click the pads, or press <kbd>Q</kbd> <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> (laid out like the pads)']],

  create(ctx) {
    const { el } = Arcade;
    const TONES = [329.63, 261.63, 220, 164.81];
    const KEYS = { KeyQ: 0, KeyW: 1, KeyA: 2, KeyS: 3 };
    const seq = [];
    let pos = 0, listening = false;

    const wrap = el('div', 'simon');
    const pads = TONES.map((_, i) => {
      const p = el('button', 'simon-pad');
      p.addEventListener('pointerdown', (e) => { e.preventDefault(); press(i); });
      wrap.appendChild(p);
      return p;
    });
    const mid = el('div', 'simon-mid', '<div><b>0</b><span>watch</span></div>');
    wrap.appendChild(mid);
    ctx.stage.appendChild(wrap);

    ctx.listen(window, 'keydown', (e) => {
      if (!e.repeat && e.code in KEYS) press(KEYS[e.code]);
    });

    const label = (n, text) => (mid.innerHTML = `<div><b>${n}</b><span>${text}</span></div>`);

    function light(i, ms) {
      pads[i].classList.add('lit');
      Arcade.tone(TONES[i], ms / 1000, 'triangle', 0.12);
      ctx.after(ms, () => pads[i].classList.remove('lit'));
    }

    function nextRound() {
      seq.push(Math.floor(Math.random() * 4));
      pos = 0;
      listening = false;
      label(seq.length, 'watch');
      const gap = Math.max(260, 620 - seq.length * 25);
      seq.forEach((i, k) => ctx.after(600 + k * gap, () => light(i, gap * 0.7)));
      ctx.after(600 + seq.length * gap, () => {
        listening = true;
        label(seq.length, 'your turn');
      });
    }

    function press(i) {
      if (!listening || ctx.ended) return;
      if (seq[pos] !== i) {
        listening = false;
        pads[seq[pos]].classList.add('lit');
        const n = seq.length - 1;
        const rec = ctx.best(n);
        ctx.end('Wrong pad', `You remembered ${n} in a row. Best: ${rec.best}${rec.fresh ? ', a new record' : ''}.`, 700, rec.fresh);
        return;
      }
      light(i, 220);
      pos++;
      if (pos === seq.length) {
        listening = false;
        label(seq.length, 'good');
        ctx.after(700, nextRound);
      }
    }

    ctx.status('');
    ctx.after(400, nextRound);
  },
});
