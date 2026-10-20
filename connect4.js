Arcade.register({
  id: 'connect4',
  name: 'Connect Four',
  modes: [2],
  desc: 'Drop discs. Four in a row wins, across, down or slanted.',
  controls: [['How', 'click a column, or press <kbd>1</kbd> to <kbd>7</kbd>']],

  create(ctx) {
    const { el } = Arcade;
    const COLS = 7, ROWS = 6, ORDER = [3, 2, 4, 1, 5, 0, 6];
    let turn = ctx.round % 2 ? 1 : 2;
    let busy = false, moves = 0, hovered = -1;
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const botTurn = () => ctx.bot && turn === 2;

    const board = el('div', 'c4');
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      cells.push([]);
      for (let c = 0; c < COLS; c++) {
        const cell = el('div', 'c4-cell');
        cell.addEventListener('click', () => !botTurn() && drop(c));
        cell.addEventListener('mouseenter', () => highlight(c));
        board.appendChild(cell);
        cells[r].push(cell);
      }
    }
    board.addEventListener('mouseleave', () => highlight(-1));
    ctx.stage.appendChild(board);

    ctx.listen(window, 'keydown', (e) => {
      const m = /^(Digit|Numpad)([1-7])$/.exec(e.code);
      if (m && !botTurn()) drop(+m[2] - 1);
    });

    nextTurn();

    function highlight(c) {
      hovered = c;
      board.style.setProperty('--tint', turn === 1 ? ctx.P1 : ctx.P2);
      for (let r = 0; r < ROWS; r++) {
        for (let k = 0; k < COLS; k++) cells[r][k].classList.toggle('hl', k === c && !ctx.ended && !botTurn());
      }
    }

    function nextTurn() {
      ctx.status(`<b class="p${turn}">${ctx.name(turn)}</b> to drop${botTurn() ? ', thinking' : ''}`);
      highlight(hovered);
      if (botTurn()) ctx.after(450, () => drop(botMove()));
    }

    const lowest = (c) => {
      for (let r = ROWS - 1; r >= 0; r--) if (!grid[r][c]) return r;
      return -1;
    };

    function drop(c) {
      if (busy || ctx.ended) return;
      const r = lowest(c);
      if (r < 0) return;
      grid[r][c] = turn;
      moves++;
      const disc = el('div', 'disc p' + turn);
      disc.style.setProperty('--fall', r + 1);
      cells[r][c].appendChild(disc);
      busy = true;
      ctx.after(380, () => {
        busy = false;
        ctx.sfx.pop();
        const line = winLine(r, c);
        if (line) {
          line.forEach(([rr, cc]) => cells[rr][cc].firstChild.classList.add('win'));
          highlight(-1);
          ctx.status('');
          ctx.win(turn, 'Four in a row.', 900);
        } else if (moves === ROWS * COLS) {
          ctx.win(0, 'The board filled up.', 600);
        } else {
          turn = 3 - turn;
          nextTurn();
        }
      });
    }

    function winLine(r, c) {
      const p = grid[r][c];
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const line = [[r, c]];
        for (const sign of [1, -1]) {
          let rr = r + dr * sign, cc = c + dc * sign;
          while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] === p) {
            line.push([rr, cc]);
            rr += dr * sign;
            cc += dc * sign;
          }
        }
        if (line.length >= 4) return line;
      }
      return null;
    }

    // ----- computer: negamax with alpha-beta pruning -----
    function evaluate(p) {
      let score = 0;
      const o = 3 - p;
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][3] === p) score += 3;
        else if (grid[r][3] === o) score -= 3;
      }
      const windowScore = (cells4) => {
        let mine = 0, theirs = 0;
        for (const v of cells4) { if (v === p) mine++; else if (v === o) theirs++; }
        if (mine && theirs) return 0;
        if (mine === 3) return 6;
        if (mine === 2) return 2;
        if (theirs === 3) return -5;
        if (theirs === 2) return -2;
        return 0;
      };
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (c + 3 < COLS) score += windowScore([grid[r][c], grid[r][c + 1], grid[r][c + 2], grid[r][c + 3]]);
          if (r + 3 < ROWS) score += windowScore([grid[r][c], grid[r + 1][c], grid[r + 2][c], grid[r + 3][c]]);
          if (r + 3 < ROWS && c + 3 < COLS) score += windowScore([grid[r][c], grid[r + 1][c + 1], grid[r + 2][c + 2], grid[r + 3][c + 3]]);
          if (r + 3 < ROWS && c - 3 >= 0) score += windowScore([grid[r][c], grid[r + 1][c - 1], grid[r + 2][c - 2], grid[r + 3][c - 3]]);
        }
      }
      return score;
    }

    function negamax(depth, alpha, beta, p) {
      if (depth === 0) return evaluate(p);
      let best = -Infinity, any = false;
      for (const c of ORDER) {
        const r = lowest(c);
        if (r < 0) continue;
        any = true;
        grid[r][c] = p;
        const v = winLine(r, c) ? 100000 + depth : -negamax(depth - 1, -beta, -alpha, 3 - p);
        grid[r][c] = 0;
        if (v > best) best = v;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return any ? best : 0;
    }

    function botMove() {
      const valid = ORDER.filter((c) => lowest(c) >= 0);
      if (ctx.bot === 1 && Math.random() < 0.4) return valid[Math.floor(Math.random() * valid.length)];
      const depth = [0, 2, 4, 7, 7][ctx.bot];
      const slip = ctx.slip();
      const scored = [];
      for (const c of valid) {
        const r = lowest(c);
        grid[r][c] = 2;
        // a slip needs an honest score for every column, so only prune when not slipping
        const beta = slip || !scored.length ? Infinity : -Math.max(...scored.map((x) => x[0]));
        const v = winLine(r, c) ? 1e6 : -negamax(depth - 1, -Infinity, beta, 1);
        grid[r][c] = 0;
        scored.push([v, c]);
      }
      scored.sort((a, b) => b[0] - a[0]);
      return slip && scored.length > 1 ? scored[1][1] : scored[0][1];
    }
  },
});
