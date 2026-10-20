Arcade.register({
  id: 'ttt',
  name: 'Tic-Tac-Toe',
  modes: [2],
  desc: 'Noughts and crosses. Who goes first swaps every game.',
  controls: [['How', 'click a square, or use the number pad <kbd>1</kbd> to <kbd>9</kbd>']],

  create(ctx) {
    const { el } = Arcade;
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const NUMPAD = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };
    let turn = ctx.round % 2 ? 1 : 2;
    const cells = Array(9).fill(0);
    const botTurn = () => ctx.bot && turn === 2;

    const board = el('div', 'ttt');
    const els = cells.map((_, i) => {
      const b = el('button', 'ttt-cell');
      b.addEventListener('click', () => !botTurn() && play(i));
      board.appendChild(b);
      return b;
    });
    ctx.stage.appendChild(board);

    ctx.listen(window, 'keydown', (e) => {
      const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
      if (m && !botTurn()) play(NUMPAD[m[2]]);
    });
    nextTurn();

    function nextTurn() {
      ctx.status(`<b class="p${turn}">${ctx.name(turn)} (${turn === 1 ? 'X' : 'O'})</b> to move`);
      if (botTurn()) ctx.after(500, () => play(botMove()));
    }

    const winner = (b) => {
      for (const l of LINES) if (b[l[0]] && l.every((k) => b[k] === b[l[0]])) return b[l[0]];
      return 0;
    };

    function play(i) {
      if (cells[i] || ctx.ended) return;
      cells[i] = turn;
      els[i].textContent = turn === 1 ? 'X' : 'O';
      els[i].classList.add('p' + turn);
      ctx.sfx.pop();
      const line = LINES.find((l) => l.every((k) => cells[k] === turn));
      if (line) {
        line.forEach((k) => els[k].classList.add('win'));
        ctx.status('');
        ctx.win(turn, 'Three in a row.', 800);
      } else if (cells.every(Boolean)) {
        ctx.status('');
        ctx.win(0, 'Nobody got three.', 600);
      } else {
        turn = 3 - turn;
        nextTurn();
      }
    }

    // ----- computer -----
    function minimax(b, p) {
      const w = winner(b);
      if (w) return w === 2 ? 10 : -10;
      if (b.every(Boolean)) return 0;
      let best = p === 2 ? -Infinity : Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i]) continue;
        b[i] = p;
        const v = minimax(b, 3 - p) * 0.9;
        b[i] = 0;
        best = p === 2 ? Math.max(best, v) : Math.min(best, v);
      }
      return best;
    }

    function botMove() {
      const open = cells.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      const rnd = () => open[Math.floor(Math.random() * open.length)];
      const finishing = (p) => open.find((i) => { cells[i] = p; const w = winner(cells) === p; cells[i] = 0; return w; });
      if (ctx.bot === 1) {
        const win = finishing(2);
        return win !== undefined && Math.random() < 0.6 ? win : rnd();
      }
      if (ctx.bot === 2) {
        const win = finishing(2);
        if (win !== undefined) return win;
        const block = finishing(1);
        if (block !== undefined && Math.random() < 0.85) return block;
        if (!cells[4] && Math.random() < 0.6) return 4;
        return rnd();
      }
      const scored = open.map((i) => {
        cells[i] = 2;
        const v = minimax(cells, 1) + Math.random() * 0.01;
        cells[i] = 0;
        return [v, i];
      }).sort((a, b) => b[0] - a[0]);
      // Hard sometimes plays its second-best square; Impossible never does
      return ctx.slip() && scored.length > 1 ? scored[1][1] : scored[0][1];
    }
  },
});
