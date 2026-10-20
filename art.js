// Little ink-and-colour drawings for each game, shown on its menu box and setup page.
(function () {
  const INK = '#1b1530';
  const BLUE = '#5aa9ec', CORAL = '#f0805e', GREEN = '#6fbf73', YELLOW = '#f2c94c', RED = '#e5534b', CREAM = '#fffaf0';
  const wrap = (inner) =>
    `<svg viewBox="0 0 160 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<g fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
  const text = (x, y, size, color, s) =>
    `<text x="${x}" y="${y}" font-family="Times New Roman, Times, serif" font-size="${size}" font-weight="700" fill="${color}" stroke="none" text-anchor="middle">${s}</text>`;

  const art = {};

  art.dino = wrap(`
    <path d="M10 86H150"/>
    <path d="M14 32h14M10 42h16M16 52h10" stroke-width="2.5" opacity=".4"/>
    <ellipse cx="128" cy="20" rx="14" ry="6" fill="#fff" stroke-width="2.5"/>
    <rect x="94" y="58" width="10" height="14" rx="5" fill="${GREEN}"/>
    <rect x="117" y="54" width="10" height="14" rx="5" fill="${GREEN}"/>
    <rect x="104" y="48" width="13" height="38" rx="6.5" fill="${GREEN}"/>
    <rect x="46" y="58" width="7" height="14" rx="3.5" fill="${BLUE}"/>
    <rect x="60" y="58" width="7" height="14" rx="3.5" fill="${BLUE}"/>
    <path d="M44 48 L22 40 L42 62 Z" fill="${BLUE}"/>
    <ellipse cx="56" cy="52" rx="17" ry="13" fill="${BLUE}"/>
    <rect x="60" y="24" width="28" height="20" rx="9" fill="${BLUE}"/>
    <circle cx="79" cy="32" r="3" fill="${INK}" stroke="none"/><circle cx="80" cy="31" r="1" fill="#fff" stroke="none"/>
    <path d="M74 39h9M68 54l7 2"/>`);

  art.pong = wrap(`
    <rect x="8" y="8" width="144" height="84" rx="8" fill="#2b2752"/>
    <path d="M80 15v70" stroke="${CREAM}" stroke-width="2.5" stroke-dasharray="6 7"/>
    <rect x="20" y="24" width="10" height="32" rx="5" fill="${BLUE}"/>
    <rect x="130" y="46" width="10" height="32" rx="5" fill="${CORAL}"/>
    <path d="M36 42 L88 56" stroke="${CREAM}" stroke-width="2.5" stroke-dasharray="2 7" opacity=".6"/>
    <circle cx="98" cy="58" r="7" fill="${CREAM}"/>
    <path d="M110 50l5-4M112 60h6" stroke="${CREAM}" stroke-width="2.5"/>`);

  art.tron = wrap(`
    <rect x="8" y="8" width="144" height="84" rx="8" fill="#16142e"/>
    <path d="M8 36H152M8 64H152M44 8V92M80 8V92M116 8V92" stroke="#3b3670" stroke-width="1.5"/>
    <path d="M18 78H58V40H96" stroke="${BLUE}" stroke-width="6"/>
    <path d="M142 22H114V66H88" stroke="${CORAL}" stroke-width="6"/>
    <rect x="95" y="33" width="15" height="14" rx="5" fill="#cfe8ff"/>
    <rect x="73" y="59" width="15" height="14" rx="5" fill="#ffd9cc"/>`);

  art.snake = wrap(`
    <path d="M20 74 C 20 50, 56 48, 58 64 S 92 86, 96 60 S 110 34, 122 38" stroke="${INK}" stroke-width="18"/>
    <path d="M20 74 C 20 50, 56 48, 58 64 S 92 86, 96 60 S 110 34, 122 38" stroke="${BLUE}" stroke-width="11"/>
    <path d="M30 62l4 3M54 58l4 3M84 74l4-2M100 48l4-1" stroke="#2f7fc4" stroke-width="2.5"/>
    <path d="M138 42h9l3-3M147 42l3 3" stroke="${RED}" stroke-width="2.5"/>
    <ellipse cx="127" cy="39" rx="13" ry="10" fill="${BLUE}"/>
    <circle cx="129" cy="34" r="3.5" fill="#fff" stroke-width="2"/><circle cx="130" cy="34" r="1.4" fill="${INK}" stroke="none"/>
    <circle cx="40" cy="27" r="11" fill="${RED}"/>
    <path d="M40 16q1-6 5-8"/><ellipse cx="48" cy="12" rx="5.5" ry="3" fill="${GREEN}" stroke-width="2"/>
    <path d="M35 23q2-3 5-3" stroke="#fff" stroke-width="2"/>`);

  art.flappy = wrap(`
    <rect x="98" y="-6" width="30" height="36" fill="${GREEN}"/><rect x="94" y="24" width="38" height="11" rx="2" fill="${GREEN}"/>
    <rect x="98" y="70" width="30" height="36" fill="${GREEN}"/><rect x="94" y="64" width="38" height="11" rx="2" fill="${GREEN}"/>
    <path d="M18 44h10M14 54h12M20 64h8" stroke-width="2.5" opacity=".4"/>
    <circle cx="58" cy="52" r="18" fill="${YELLOW}"/>
    <ellipse cx="49" cy="57" rx="9" ry="6" fill="#fff" transform="rotate(-20 49 57)"/>
    <circle cx="65" cy="45" r="6.5" fill="#fff"/><circle cx="67" cy="45" r="2.6" fill="${INK}" stroke="none"/>
    <path d="M73 52 l13 3 l-13 6 z" fill="${CORAL}"/>`);

  art.connect4 = (() => {
    let holes = '';
    const fills = [
      [0, 0, 0, 0],
      [0, CORAL, BLUE, 0],
      [BLUE, CORAL, BLUE, CORAL],
    ];
    fills.forEach((row, r) => row.forEach((f, c) => {
      holes += `<circle cx="${46 + c * 23}" cy="${46 + r * 17}" r="7.5" fill="${f || '#16142e'}"/>`;
    }));
    return wrap(`
      <path d="M118 8v6M130 8v6" stroke-width="2.5" opacity=".5"/>
      <circle cx="115" cy="22" r="7.5" fill="${CORAL}"/>
      <path d="M34 92v6M126 92v6"/>
      <rect x="30" y="34" width="100" height="58" rx="6" fill="#3a4fb0"/>${holes}`);
  })();

  art.ttt = wrap(`
    <path d="M64 14q-3 36 1 74M98 12q3 38-1 76M30 40q52-4 102 2M28 66q54 3 104-2" stroke-width="3.5"/>
    <path d="M38 20l16 13M54 20l-16 13" stroke="#3d8fd1" stroke-width="5"/>
    <circle cx="81" cy="53" r="9" stroke="#e8704c" stroke-width="5"/>
    <circle cx="116" cy="27" r="8" stroke="#e8704c" stroke-width="5"/>
    <path d="M108 72l15 13M123 72l-15 13" stroke="#3d8fd1" stroke-width="5"/>`);

  art.memory = wrap(`
    <g transform="rotate(-10 56 52)">
      <rect x="34" y="22" width="44" height="60" rx="6" fill="#3a3470"/>
      <rect x="40" y="28" width="32" height="48" rx="3" stroke="${CREAM}" stroke-width="2"/>
      <path d="M46 36l20 32M66 36l-20 32" stroke="${CREAM}" stroke-width="1.5" opacity=".5"/>
    </g>
    <g transform="rotate(8 104 50)">
      <rect x="82" y="20" width="44" height="60" rx="6" fill="${CREAM}"/>
      <path d="M104 63C90 53 92 40 99 40c3 0 5 3 5 5 0-2 2-5 5-5 7 0 9 13-5 23z" fill="${RED}" stroke-width="2.5"/>
    </g>
    <path d="M138 16v10M133 21h10M22 70v8M18 74h8" stroke-width="2.5"/>`);

  art.reaction = wrap(`
    <rect x="72" y="8" width="16" height="10" rx="3" fill="${YELLOW}"/>
    <path d="M80 18v6M104 28l6-6"/>
    <circle cx="80" cy="56" r="32" fill="${CREAM}"/>
    <path d="M80 30v5M80 77v5M54 56h5M101 56h5" stroke-width="2.5"/>
    <path d="M80 56L94 40" stroke-width="4"/>
    <circle cx="80" cy="56" r="3.5" fill="${INK}"/>
    <path d="M132 28l-12 22h10l-8 22 20-28h-10l8-16z" fill="${YELLOW}"/>
    <circle cx="28" cy="54" r="12" fill="${GREEN}"/>
    <path d="M24 49q3-3 7-2" stroke="#fff" stroke-width="2"/>`);

  art.mines = (() => {
    const S = 22, X = 36, Y = 17;
    const tile = (c, r, open, extra = '', fill) =>
      `<rect x="${X + c * S}" y="${Y + r * S}" width="${S}" height="${S}" rx="3" fill="${fill || (open ? CREAM : '#b9b0dc')}" stroke-width="2.5"/>` + extra;
    const cx = (c) => X + c * S + S / 2, cy = (r) => Y + r * S + S / 2;
    let s = '';
    s += tile(0, 0, true, text(cx(0), cy(0) + 6, 17, '#3d8fd1', '1'));
    s += tile(1, 0, true);
    s += tile(2, 0, true, text(cx(2), cy(0) + 6, 17, '#3d8fd1', '1'));
    s += tile(3, 0, false, `<path d="M${cx(3) - 3} ${cy(0) + 7}V${cy(0) - 7}" stroke-width="2.5"/><path d="M${cx(3) - 3} ${cy(0) - 7}l9 4-9 4z" fill="${RED}" stroke-width="2"/>`);
    s += tile(0, 1, true, text(cx(0), cy(1) + 6, 17, '#3d8fd1', '1'));
    s += tile(1, 1, true, text(cx(1), cy(1) + 6, 17, '#3f9b5b', '2'));
    s += tile(2, 1, false);
    s += tile(3, 1, false);
    s += tile(0, 2, false);
    s += tile(1, 2, true, `<path d="M${cx(1) - 9} ${cy(2)}h18M${cx(1)} ${cy(2) - 9}v18M${cx(1) - 6} ${cy(2) - 6}l12 12M${cx(1) + 6} ${cy(2) - 6}l-12 12" stroke-width="2.5"/>
      <circle cx="${cx(1)}" cy="${cy(2)}" r="6" fill="${INK}"/><circle cx="${cx(1) - 2}" cy="${cy(2) - 2}" r="1.6" fill="#fff" stroke="none"/>`, RED);
    s += tile(2, 2, false);
    s += tile(3, 2, false);
    return wrap(s);
  })();

  art['2048'] = (() => {
    const tiles = [[42, 12, '#efe7d6', INK, '2', 24], [82, 12, '#e9dcbc', INK, '4', 24], [42, 52, '#e8a25b', '#fff', '8', 24], [82, 52, '#2bb3a3', '#fff', '2048', 13]];
    return wrap(`<rect x="38" y="8" width="84" height="84" rx="8" fill="#bdb2a0"/>` +
      tiles.map(([x, y, bg, fg, v, size]) =>
        `<rect x="${x}" y="${y}" width="36" height="36" rx="5" fill="${bg}" stroke-width="2.5"/>${text(x + 18, y + 18 + size * 0.35, size, fg, v)}`).join('') +
      `<path d="M128 30l10 0M128 50h14M128 70h10" stroke-width="2.5" opacity=".4"/>`);
  })();

  art.breakout = (() => {
    const colors = [RED, CORAL, YELLOW];
    const gone = new Set(['1,2', '2,3', '2,4', '1,4']);
    let b = '';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        if (gone.has(r + ',' + c)) continue;
        b += `<rect x="${16 + c * 22}" y="${12 + r * 12}" width="20" height="10" rx="2" fill="${colors[r]}" stroke-width="2.5"/>`;
      }
    }
    return wrap(b + `
      <path d="M80 82 L100 54" stroke-width="2.5" stroke-dasharray="2 6" opacity=".5"/>
      <circle cx="104" cy="49" r="5.5" fill="#fff"/>
      <rect x="60" y="82" width="40" height="9" rx="4.5" fill="${BLUE}"/>`);
  })();

  art.simon = wrap(`
    <path d="M76 48V12A36 36 0 0 0 40 48Z" fill="#8fe39a"/>
    <path d="M84 48H120A36 36 0 0 0 84 12Z" fill="${RED}"/>
    <path d="M76 56H40A36 36 0 0 0 76 92Z" fill="${YELLOW}"/>
    <path d="M84 56V92A36 36 0 0 0 120 56Z" fill="#4a90d9"/>
    <circle cx="80" cy="52" r="13" fill="${INK}"/>
    <path d="M28 20l-6-5M24 30h-8M34 12l-3-7" stroke-width="2.5"/>
    <path d="M128 76q8 0 10-8M134 84q10-2 12-12" stroke-width="2.5" opacity=".5"/>`);

  art.whack = wrap(`
    <ellipse cx="70" cy="80" rx="40" ry="11" fill="#3a2a1e"/>
    <path d="M46 82V58a24 24 0 0 1 48 0V82Z" fill="#a0724f"/>
    <ellipse cx="70" cy="70" rx="12" ry="10" fill="#d9b48f" stroke="none"/>
    <circle cx="62" cy="52" r="3" fill="${INK}" stroke="none"/><circle cx="78" cy="52" r="3" fill="${INK}" stroke="none"/>
    <ellipse cx="70" cy="61" rx="5" ry="4" fill="#e79aa0" stroke-width="2.5"/>
    <rect x="67" y="65" width="6" height="5" fill="#fff" stroke-width="2"/>
    <path d="M30 80a40 11 0 0 0 80 0" fill="#3a2a1e"/>
    <path d="M98 30l2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1z" fill="${YELLOW}" stroke-width="2"/>
    <g transform="rotate(-28 128 44)">
      <rect x="124" y="36" width="8" height="48" rx="3" fill="#c9a07a"/>
      <rect x="106" y="16" width="44" height="22" rx="6" fill="${RED}"/>
    </g>`);

  window.Arcade.art = art;
})();
