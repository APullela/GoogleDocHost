Arcade.register({
  id: 'memory',
  name: 'Memory',
  modes: [2],
  desc: 'Turn over two cards. If they match you keep them and go again.',
  controls: [['How', 'click cards to turn them over, and take turns']],

  create(ctx) {
    const { el } = Arcade;
    // ︎ asks for the plain text glyph instead of an emoji picture
    const SYMBOLS = ['♠', '♥', '♦', '♣', '★', '☀', '☂', '♞', '♛', '✿', '☯', '⚓'].map((s) => s + '︎');
    const RED = new Set([SYMBOLS[1], SYMBOLS[2]]);
    const deck = [...SYMBOLS, ...SYMBOLS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    let turn = ctx.round % 2 ? 1 : 2;
    let open = [], lock = false, found = 0;
    const pts = [0, 0];
    const botTurn = () => ctx.bot && turn === 2;
    // what the computer remembers: card index -> symbol
    const memory = new Map();
    const recall = [0, 0.3, 0.65, 1, 1][ctx.bot];

    const board = el('div', 'mem');
    const cards = deck.map((sym, i) => {
      const b = el('button', 'mem-card',
        `<div class="mem-inner"><div class="mem-face mem-back"></div><div class="mem-face mem-front${RED.has(sym) ? ' red' : ''}">${sym}</div></div>`);
      b.addEventListener('click', () => !botTurn() && flip(i));
      board.appendChild(b);
      return { el: b, sym, matched: false };
    });
    ctx.stage.appendChild(board);
    status();

    function status() {
      ctx.status(`<b class="p${turn}">${ctx.name(turn)}</b> to play. Pairs: <span class="p1">${pts[0]}</span> to <span class="p2">${pts[1]}</span>`);
    }

    function flip(i) {
      const c = cards[i];
      if (lock || ctx.ended || c.matched || open.includes(i)) return;
      c.el.classList.add('up');
      if (ctx.bot && Math.random() < recall) memory.set(i, c.sym);
      open.push(i);
      if (open.length < 2) {
        if (botTurn()) ctx.after(650, botSecond);
        return;
      }

      const [a, b] = open.map((k) => cards[k]);
      if (a.sym === b.sym) {
        a.matched = b.matched = true;
        open.forEach((k) => memory.delete(k));
        a.el.classList.add('m' + turn);
        b.el.classList.add('m' + turn);
        pts[turn - 1]++;
        found++;
        open = [];
        ctx.sfx.pop();
        status();
        if (found === SYMBOLS.length) {
          const [p1, p2] = pts;
          ctx.win(p1 === p2 ? 0 : p1 > p2 ? 1 : 2, `${p1} pairs to ${p2}.`, 700);
        } else if (botTurn()) {
          ctx.after(700, botFirst);
        }
      } else {
        lock = true;
        ctx.after(900, () => {
          a.el.classList.remove('up');
          b.el.classList.remove('up');
          open = [];
          lock = false;
          turn = 3 - turn;
          status();
          if (botTurn()) ctx.after(600, botFirst);
        });
      }
    }

    // ----- computer -----
    const hidden = () => cards.map((c, i) => i).filter((i) => !cards[i].matched && !open.includes(i));
    const unknown = () => hidden().filter((i) => !memory.has(i));
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

    function knownPair() {
      const seen = new Map();
      for (const [i, sym] of memory) {
        if (cards[i].matched) continue;
        if (seen.has(sym)) return [seen.get(sym), i];
        seen.set(sym, i);
      }
      return null;
    }

    let plannedSecond = -1;
    function botFirst() {
      if (ctx.ended || !botTurn()) return;
      // a Hard slip: forget the pair it knows and turn over something new
      const pair = ctx.slip() ? null : knownPair();
      plannedSecond = pair ? pair[1] : -1;
      flip(pair ? pair[0] : rnd(unknown().length ? unknown() : hidden()));
    }

    function botSecond() {
      if (ctx.ended || !botTurn() || open.length !== 1) return;
      const first = open[0];
      let pickIdx = plannedSecond;
      if (pickIdx < 0 || pickIdx === first) {
        const sym = cards[first].sym;
        const match = [...memory].find(([i, s]) => s === sym && i !== first && !cards[i].matched);
        pickIdx = match ? match[0] : rnd(unknown().length ? unknown() : hidden());
      }
      plannedSecond = -1;
      flip(pickIdx);
    }

    if (botTurn()) ctx.after(800, botFirst);
  },
});
