// =====================================================================
// CONSTANTS
// =====================================================================
const ROWS = 7;
const COLS = 11;
const SQRT3 = Math.sqrt(3);

// Layout — recomputed on start and resize
let hexSize = 38;
let canvasW = 800;
let canvasH = 428;
let offsetX  = hexSize * SQRT3 / 2 + 5;
let offsetY  = hexSize + 5;

function computeLayout() {
  const main      = document.getElementById('game-main');
  const sidePanel = document.getElementById('side-panel');
  if (!main || !sidePanel) return;

  const gap    = parseInt(getComputedStyle(main).gap) || 16;
  const availW = main.clientWidth  - sidePanel.offsetWidth - gap;
  const availH = main.clientHeight;

  // How large can a hex be to fit COLS×ROWS grid in availW×availH?
  const sizeFromW = (availW - 10) / (SQRT3 * (COLS + 1));
  const sizeFromH = (availH - 10) / (1.5 * ROWS + 0.5);
  hexSize = Math.max(8, Math.floor(Math.min(sizeFromW, sizeFromH)));

  canvasW = Math.ceil(hexSize * SQRT3 * (COLS + 1) + 10);
  canvasH = Math.ceil(hexSize * (1.5 * ROWS + 0.5) + 10);
  offsetX = hexSize * SQRT3 / 2 + 5;
  offsetY = hexSize + 5;
}

// Axial direction vectors (pointy-top hex)
const DIRS = {
  E:  { dq:+1, dr: 0 },
  NE: { dq:+1, dr:-1 },
  NW: { dq: 0, dr:-1 },
  W:  { dq:-1, dr: 0 },
  SW: { dq:-1, dr:+1 },
  SE: { dq: 0, dr:+1 },
};
const DIR_NAMES = ['E', 'NE', 'NW', 'W', 'SW', 'SE'];
const REVERSE   = { E:'W', W:'E', NE:'SW', SW:'NE', NW:'SE', SE:'NW' };

const PLAYER_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1'];
const PLAYER_LABELS = ['1', '2', '3', '4', '5', '6'];

// =====================================================================
// PRESET MAPS
// Each map: 7×11 array; 0=grass, 1=tree.
// Cols 0-1 always grass (starting area), col 10 always grass (goal).
// Maps are vertically symmetric for fairness.
// =====================================================================
const PRESET_MAPS = {
  easy: [
    // E1: var=0.000 — perfectly balanced (mean 11 steps)
    [[0,0,0,0,0,0,1,0,1,0,0],[0,0,0,0,1,0,0,0,0,1,0],[0,0,0,0,0,0,0,1,1,0,0],[0,0,1,0,0,0,0,0,0,1,0],[0,0,0,0,0,0,0,1,1,0,0],[0,0,0,1,0,0,0,1,0,0,0],[0,0,0,0,0,1,1,0,0,0,0]],
    // E2: var=0.245 — scattered open (mean 11.4 steps)
    [[0,0,0,0,0,0,0,0,1,1,0],[0,0,0,0,0,1,0,0,1,0,0],[0,0,1,0,0,0,1,0,0,0,0],[0,0,0,0,0,0,1,0,1,0,0],[0,0,0,0,1,0,0,0,0,1,0],[0,0,0,0,0,0,1,0,0,1,0],[0,0,0,0,0,0,1,1,0,0,0]],
    // E3: var=0.408 — diagonal spread (mean 11.1 steps)
    [[0,0,1,0,0,0,0,1,0,0,0],[0,0,0,0,1,0,0,0,1,0,0],[0,0,1,0,1,0,0,0,0,1,0],[0,0,1,0,1,0,0,0,0,1,0],[0,0,0,1,0,1,0,0,0,0,0],[0,0,0,0,0,0,1,0,0,1,0],[0,0,0,0,0,0,0,0,1,1,0]],
  ],
  medium: [
    // M1: var=0.122 — nearly balanced (mean 11.1 steps)
    [[0,0,0,0,1,0,0,1,0,1,0],[0,0,0,0,0,0,1,1,1,0,0],[0,0,0,0,0,0,0,1,1,1,0],[0,0,0,0,1,0,0,1,0,1,0],[0,0,0,0,1,1,1,0,0,0,0],[0,0,1,0,0,0,0,1,1,0,0],[0,0,0,0,1,1,1,0,0,0,0]],
    // M2: var=0.408 — angled forest (mean 12.1 steps)
    [[0,0,0,1,1,0,0,0,1,0,0],[0,0,1,1,0,0,0,1,0,0,0],[0,0,0,1,1,0,1,0,0,0,0],[0,0,0,0,0,1,0,0,1,1,0],[0,0,0,1,0,1,0,0,1,0,0],[0,0,1,0,0,1,1,1,0,1,0],[0,0,0,0,1,0,1,0,1,0,0]],
    // M3: var=0.408 — staggered patches (mean 12.1 steps)
    [[0,0,0,0,1,1,0,1,0,0,0],[0,0,1,1,0,1,0,0,1,0,0],[0,0,1,0,0,0,0,0,1,1,0],[0,0,0,1,1,1,0,0,0,1,0],[0,0,0,0,1,0,0,1,1,0,0],[0,0,1,0,1,0,0,0,0,1,0],[0,0,1,0,1,0,0,1,0,0,0]],
  ],
  hard: [
    // H1: var=0.122 — dense but balanced (mean 12.9 steps)
    [[0,0,0,0,1,0,1,1,1,0,0],[0,0,1,0,1,1,1,0,0,0,0],[0,0,1,0,0,0,1,0,1,1,0],[0,0,0,0,1,0,0,1,1,1,0],[0,0,0,0,1,0,0,1,1,1,0],[0,0,1,0,0,1,0,1,0,1,0],[0,0,0,0,1,1,0,0,1,1,0]],
    // H2: var=0.408 — dense angled (mean 14.1 steps)
    [[0,0,0,1,1,1,0,0,1,1,0],[0,0,1,1,0,0,1,0,1,0,0],[0,0,1,0,0,1,1,1,0,1,0],[0,0,0,0,1,1,1,0,0,1,0],[0,0,0,1,0,1,1,1,0,0,0],[0,0,1,1,0,0,1,0,0,1,0],[0,0,1,0,1,0,1,0,0,1,0]],
    // H3: var=0.490 — maze-like (mean 12.7 steps)
    [[0,0,1,0,0,0,1,1,1,0,0],[0,0,1,1,1,1,0,0,0,0,0],[0,0,0,0,0,1,1,1,0,1,0],[0,0,1,0,0,1,1,1,0,0,0],[0,0,1,1,0,0,1,1,0,0,0],[0,0,1,1,1,0,0,0,0,1,0],[0,0,1,1,1,0,0,1,0,0,0]],
  ],
};

// =====================================================================
// SETUP STATE
// =====================================================================
let selectedNumPlayers = 2;
let playerTypes = ['human', 'ai']; // per-player: 'human' | 'ai'
let selectedDifficulty = 'medium';
let selectedMapIdx = -1; // -1 = random generated, 0-2 = preset

// =====================================================================
// GAME STATE
// =====================================================================
let board = [];       // board[row][col] = 'grass' | 'tree'
let players = [];     // { row, col, color, label }
let numPlayers = 0;
let currentPlayer = 0;
let diceValue = 0;
let phase = 'setup'; // setup | roll | direction | animating | win
let displayPos = []; // { row, col } used for rendering (updated during animation)
let animPixels = []; // { x, y } pixel-level override during smooth animation
let flashCells = [];
let collisionFlash = null;
let hoveredHex = null;
let canvasDice = null; // { value, rolling } — large dice drawn on canvas during roll
let aiPaused   = false;

// =====================================================================
// HEX MATH
// =====================================================================
function offsetToAxial(row, col) {
  return { q: col - Math.floor(row / 2), r: row };
}

function axialToOffset(q, r) {
  return { row: r, col: q + Math.floor(r / 2) };
}

function hexToPixel(row, col) {
  const { q, r } = offsetToAxial(row, col);
  return {
    x: hexSize * SQRT3 * (q + r / 2) + offsetX,
    y: hexSize * 1.5 * r + offsetY,
  };
}

function getNeighbor(row, col, dirName) {
  const { q, r } = offsetToAxial(row, col);
  const { dq, dr } = DIRS[dirName];
  return axialToOffset(q + dq, r + dr);
}

function isValid(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function pixelToHex(px, py) {
  const r_frac = (py - offsetY) / (hexSize * 1.5);
  const q_frac = (px - offsetX) / (hexSize * SQRT3) - r_frac / 2;
  const s_frac = -q_frac - r_frac;
  let rq = Math.round(q_frac), rr = Math.round(r_frac), rs = Math.round(s_frac);
  const dq = Math.abs(rq - q_frac), dr = Math.abs(rr - r_frac), ds = Math.abs(rs - s_frac);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds)        rr = -rq - rs;
  return axialToOffset(rq, rr);
}

// Returns the direction name if (toRow,toCol) is a direct neighbor, else null.
function getDirToNeighbor(fromRow, fromCol, toRow, toCol) {
  const from = offsetToAxial(fromRow, fromCol);
  const to   = offsetToAxial(toRow,   toCol);
  const dq = to.q - from.q, dr = to.r - from.r;
  return DIR_NAMES.find(d => DIRS[d].dq === dq && DIRS[d].dr === dr) ?? null;
}

// =====================================================================
// BOARD GENERATION
// =====================================================================
function generateBoard(np, difficulty = 'medium') {
  const treeChance  = { easy: 0.22, medium: 0.30, hard: 0.40 }[difficulty] ?? 0.30;
  const minPerRow   = { easy: 2,    medium: 3,     hard: 4    }[difficulty] ?? 3;

  let b;
  let attempts = 0;
  do {
    b = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, (_, c) => {
        // First 2 cols and goal col are always grass
        if (c <= 1 || c === COLS - 1) return 'grass';
        return Math.random() < treeChance ? 'tree' : 'grass';
      })
    );

    // Enforce minimum trees per interior row
    for (let r = 0; r < ROWS; r++) {
      const interior = b[r].slice(2, COLS - 1);
      let count = interior.filter(v => v === 'tree').length;
      if (count < minPerRow) {
        const candidates = [];
        for (let c = 2; c < COLS - 1; c++) {
          if (b[r][c] === 'grass') candidates.push(c);
        }
        shuffleArray(candidates);
        for (let i = 0; i < Math.min(minPerRow - count, candidates.length); i++) {
          b[r][candidates[i]] = 'tree';
        }
      }
    }

    // Guarantee enough starting grass cells for all players
    const leftGrass = [];
    for (let r = 0; r < ROWS; r++) if (b[r][0] === 'grass') leftGrass.push(r);
    while (leftGrass.length < np) {
      const r = Math.floor(Math.random() * ROWS);
      if (b[r][0] === 'tree') { b[r][0] = 'grass'; leftGrass.push(r); }
    }

    attempts++;
    if (attempts > 200) {
      const mid = Math.floor(ROWS / 2);
      for (let c = 0; c < COLS; c++) b[mid][c] = 'grass';
    }
  } while (!hasPath(b));
  return b;
}

function hasPath(b) {
  const visited = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  const queue = [];
  for (let r = 0; r < ROWS; r++) {
    if (b[r][0] === 'grass') { visited[r][0] = true; queue.push([r, 0]); }
  }
  while (queue.length > 0) {
    const [row, col] = queue.shift();
    if (col === COLS - 1) return true;
    for (const d of DIR_NAMES) {
      const { row: nr, col: nc } = getNeighbor(row, col, d);
      if (isValid(nr, nc) && !visited[nr][nc] && b[nr][nc] === 'grass') {
        visited[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
  }
  return false;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// =====================================================================
// GAME INITIALIZATION
// =====================================================================
function startGame() {
  numPlayers = selectedNumPlayers;
  saveSetup();

  if (selectedMapIdx >= 0 && PRESET_MAPS[selectedDifficulty]) {
    const raw = PRESET_MAPS[selectedDifficulty][selectedMapIdx];
    board = raw.map(row => row.map(v => v ? 'tree' : 'grass'));
    // Patch preset map if not enough starting rows
    const startGrass = [];
    for (let r = 0; r < ROWS; r++) if (board[r][0] === 'grass') startGrass.push(r);
    while (startGrass.length < numPlayers) {
      const r = Math.floor(Math.random() * ROWS);
      if (board[r][0] === 'tree') { board[r][0] = 'grass'; startGrass.push(r); }
    }
  } else {
    board = generateBoard(numPlayers, selectedDifficulty);
  }

  const leftGrass = [];
  for (let r = 0; r < ROWS; r++) if (board[r][0] === 'grass') leftGrass.push(r);
  shuffleArray(leftGrass);

  players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push({ row: leftGrass[i], col: 0, color: PLAYER_COLORS[i], label: PLAYER_LABELS[i] });
  }

  displayPos = players.map(p => ({ row: p.row, col: p.col }));
  animPixels = new Array(numPlayers).fill(null);
  flashCells = [];
  collisionFlash = null;
  canvasDice = null;
  aiPaused = false;

  currentPlayer = 0;
  diceValue = 0;
  phase = 'roll';

  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';

  computeLayout();
  const canvas = document.getElementById('gameCanvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  setupCanvasEvents();

  updateUI();
  render();
  setTimeout(rollDice, 600);
}

let canvasEventsAttached = false;

function setupCanvasEvents() {
  if (canvasEventsAttached) return;
  canvasEventsAttached = true;
  const canvas = document.getElementById('gameCanvas');

  function hexUnderPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return pixelToHex(
      (clientX - rect.left) * (canvasW / rect.width),
      (clientY - rect.top)  * (canvasH / rect.height)
    );
  }

  canvas.addEventListener('mousemove', e => {
    if (phase !== 'direction') { hoveredHex = null; canvas.style.cursor = 'default'; render(); return; }
    const hex = hexUnderPointer(e.clientX, e.clientY);
    const panda = displayPos[currentPlayer];
    const dir = getDirToNeighbor(panda.row, panda.col, hex.row, hex.col);
    hoveredHex = dir ? hex : null;
    canvas.style.cursor = dir ? 'pointer' : 'default';
    render();
  });

  canvas.addEventListener('mouseleave', () => {
    hoveredHex = null;
    canvas.style.cursor = 'default';
    render();
  });

  canvas.addEventListener('click', e => {
    if (phase !== 'direction' || playerTypes[currentPlayer] === 'ai') return;
    const hex = hexUnderPointer(e.clientX, e.clientY);
    const panda = displayPos[currentPlayer];
    const dir = getDirToNeighbor(panda.row, panda.col, hex.row, hex.col);
    if (dir) chooseDir(dir);
  });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (phase !== 'direction' || playerTypes[currentPlayer] === 'ai') return;
    const touch = e.changedTouches[0];
    const hex = hexUnderPointer(touch.clientX, touch.clientY);
    const panda = displayPos[currentPlayer];
    const dir = getDirToNeighbor(panda.row, panda.col, hex.row, hex.col);
    if (dir) {
      hoveredHex = hex;
      render();
      setTimeout(() => { hoveredHex = null; chooseDir(dir); }, 80);
    }
  }, { passive: false });
}

// =====================================================================
// UI UPDATES
// =====================================================================
function updateUI() {
  const p = players[currentPlayer];
  const turnPanda = document.getElementById('turn-panda');
  turnPanda.textContent = `Panda ${p.label}`;
  turnPanda.style.color = p.color;

  const isAITurn = playerTypes[currentPlayer] === 'ai';
  const phaseInfo = document.getElementById('phase-info');
  if (phase === 'roll') phaseInfo.textContent = 'Roll the dice to begin your move';
  else if (phase === 'direction') phaseInfo.textContent = isAITurn ? `Rolled ${diceValue} — AI is thinking…` : `Rolled ${diceValue} — choose a direction`;
  else if (phase === 'animating') phaseInfo.textContent = 'Moving…';

  document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.disabled = (phase !== 'direction') || isAITurn;
  });

  const list = document.getElementById('player-list');
  list.innerHTML = '';
  players.forEach((pl, i) => {
    const row = document.createElement('div');
    row.className = 'player-row' + (i === currentPlayer && phase !== 'win' ? ' active' : '');
    if (pl.col === COLS - 1) row.className += ' winner';
    const typeIcon = playerTypes[i] === 'ai' ? ' 🤖' : '';
    row.innerHTML = `
      <div class="player-dot" style="background:${pl.color}"></div>
      <div class="player-name">Panda ${pl.label}${typeIcon}</div>
      <div class="player-pos">col ${pl.col + 1}/${COLS}</div>
    `;
    list.appendChild(row);
  });

  const diceInline = document.getElementById('dice-inline');
  if (diceInline) {
    diceInline.innerHTML = diceValue > 0
      ? renderDiceSVG(diceValue)
      : '<span style="font-size:1rem;color:#81c784;padding:0 4px">?</span>';
  }
}

function diceDots(n) {
  const dotPos = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  };
  return dotPos[n].map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="8" fill="#e8f5e9"/>`
  ).join('');
}

function renderDiceSVG(n, size = 36) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100">${diceDots(n)}</svg>`;
}

function renderDiceSVGFlex(n) {
  return `<svg width="100%" height="100%" viewBox="0 0 100 100">${diceDots(n)}</svg>`;
}

function addLog(msg, highlight = false) {
  const list = document.getElementById('log-list');
  const entry = document.createElement('div');
  entry.className = 'log-entry' + (highlight ? ' highlight' : '');
  entry.textContent = msg;
  list.prepend(entry);
  while (list.children.length > 20) list.removeChild(list.lastChild);
}

// =====================================================================
// MOVEMENT SIMULATION
// =====================================================================
function simulateMove(startPlayerIdx, dirName, steps) {
  const events = [];
  const simPos = players.map(p => ({ row: p.row, col: p.col }));

  function getPandaAt(row, col, excludeIdx) {
    return simPos.findIndex((p, i) => i !== excludeIdx && p.row === row && p.col === col);
  }

  function doSim(pIdx, dir, stepsLeft, inChain = new Set()) {
    inChain.add(pIdx);
    let bounced = false;
    let safetyCount = 0;

    while (stepsLeft > 0 && safetyCount < 100) {
      safetyCount++;
      const pos = simPos[pIdx];
      const next = getNeighbor(pos.row, pos.col, dir);
      const blocked = !isValid(next.row, next.col) || board[next.row][next.col] === 'tree';

      if (blocked) {
        if (bounced) {
          events.push({ type: 'stuck', player: pIdx });
          return;
        }
        dir = REVERSE[dir];
        bounced = true;
        events.push({ type: 'bounce', player: pIdx, newDir: dir, wallPos: next });
      } else {
        const otherIdx = getPandaAt(next.row, next.col, pIdx);
        if (otherIdx !== -1) {
          if (inChain.has(otherIdx)) {
            // Circular collision chain — treat the blocking panda as a wall
            if (bounced) { events.push({ type: 'stuck', player: pIdx }); return; }
            dir = REVERSE[dir];
            bounced = true;
            events.push({ type: 'bounce', player: pIdx, newDir: dir, wallPos: next });
          } else {
            events.push({ type: 'collision', player: pIdx, other: otherIdx, stepsLeft });
            doSim(otherIdx, dir, stepsLeft, inChain);
            return;
          }
        } else {
          simPos[pIdx] = { ...next };
          events.push({ type: 'move', player: pIdx, to: { ...next } });
          stepsLeft--;
          bounced = false;
        }
      }
    }
  }

  doSim(startPlayerIdx, dirName, steps);
  return { events, finalPos: simPos };
}

// =====================================================================
// ANIMATION
// =====================================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

async function animateMove(pIdx, fromRow, fromCol, toRow, toCol) {
  const from = hexToPixel(fromRow, fromCol);
  const to   = hexToPixel(toRow, toCol);
  const DURATION = 220;
  const start = performance.now();

  await new Promise(resolve => {
    function frame() {
      const t = Math.min((performance.now() - start) / DURATION, 1);
      const e = easeInOut(t);
      animPixels[pIdx] = { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) };
      render();
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        animPixels[pIdx] = null;
        displayPos[pIdx] = { row: toRow, col: toCol };
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

async function flashCell(row, col, times = 2) {
  for (let i = 0; i < times; i++) {
    flashCells.push({ row, col });
    render();
    await sleep(100);
    flashCells = flashCells.filter(f => !(f.row === row && f.col === col));
    render();
    await sleep(60);
  }
}

async function playEvents(events, finalPos) {
  hoveredHex = null;
  phase = 'animating';
  updateUI();

  for (const ev of events) {
    if (ev.type === 'move') {
      const from = displayPos[ev.player];
      await animateMove(ev.player, from.row, from.col, ev.to.row, ev.to.col);

    } else if (ev.type === 'bounce') {
      if (ev.wallPos && isValid(ev.wallPos.row, ev.wallPos.col)) {
        await flashCell(ev.wallPos.row, ev.wallPos.col);
      } else {
        await sleep(160);
      }

    } else if (ev.type === 'collision') {
      const posA = displayPos[ev.player];
      const posB = displayPos[ev.other];
      collisionFlash = [hexToPixel(posA.row, posA.col), hexToPixel(posB.row, posB.col)];
      render();
      await sleep(220);
      collisionFlash = null;
      render();
      addLog(
        `💥 Panda ${players[ev.player].label} hit Panda ${players[ev.other].label}! ${ev.stepsLeft} steps transferred.`,
        true
      );

    } else if (ev.type === 'stuck') {
      addLog(`🛑 Panda ${players[ev.player].label} is stuck!`);
      await sleep(150);
    }
  }

  // Commit final positions
  finalPos.forEach((pos, i) => {
    players[i].row = pos.row;
    players[i].col = pos.col;
    displayPos[i] = { row: pos.row, col: pos.col };
  });

  // Check win condition
  const winner = players.findIndex(p => p.col === COLS - 1);
  if (winner !== -1) {
    phase = 'win';
    render();
    await sleep(600);
    showWin(winner);
    return;
  }

  currentPlayer = (currentPlayer + 1) % numPlayers;
  diceValue = 0;
  phase = 'roll';
  updateUI();
  updatePauseButton();
  render();
  setTimeout(rollDice, 600);
}

// =====================================================================
// GAME ACTIONS
// =====================================================================
function rollDice() {
  if (phase !== 'roll') return;
  if (aiPaused && playerTypes[currentPlayer] === 'ai') return;

  // Keep header dice showing ? until the fly animation lands
  const diceEl = document.getElementById('dice-inline');
  if (diceEl) diceEl.innerHTML = '<span style="font-size:1rem;color:#81c784;padding:0 4px">?</span>';

  canvasDice = { value: Math.floor(Math.random() * 6) + 1, rolling: true };
  render();

  let count = 0;
  const interval = setInterval(() => {
    if (phase !== 'roll') { clearInterval(interval); canvasDice = null; return; }
    canvasDice.value = Math.floor(Math.random() * 6) + 1;
    render();
    count++;
    if (count >= 8) {
      clearInterval(interval);
      diceValue = Math.floor(Math.random() * 6) + 1;
      canvasDice = { value: diceValue, rolling: false };
      render();
      addLog(`🎲 Panda ${players[currentPlayer].label} rolled ${diceValue}`);
      setTimeout(flyDiceToHeader, 1000);
    }
  }, 65);
}

function flyDiceToHeader() {
  if (phase !== 'roll') { canvasDice = null; return; }

  const canvas  = document.getElementById('gameCanvas');
  const diceEl  = document.getElementById('dice-inline');
  if (!canvas || !diceEl) { canvasDice = null; finishRoll(); return; }

  const cRect  = canvas.getBoundingClientRect();
  const dRect  = diceEl.getBoundingClientRect();
  const scale  = cRect.width / canvasW;
  const fromS  = hexSize * 1.2 * 2 * scale;     // CSS-pixel side of canvas dice
  const fromX  = cRect.left + cRect.width  / 2;  // canvas centre in viewport coords
  const fromY  = cRect.top  + cRect.height / 2;
  const toS    = dRect.width;
  const toX    = dRect.left + toS / 2;
  const toY    = dRect.top  + toS / 2;

  const fly = document.createElement('div');
  fly.style.cssText = `
    position:fixed; z-index:9999; pointer-events:none;
    width:${fromS}px; height:${fromS}px;
    left:${fromX - fromS / 2}px; top:${fromY - fromS / 2}px;
    border-radius:${fromS * 0.09}px;
    border:${Math.max(2, Math.round(fromS * 0.03))}px solid #4caf50;
    background:#1a3a1a;
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 8px 32px rgba(0,0,0,0.65);
    overflow:hidden;
    transition:left .45s cubic-bezier(.4,0,.2,1),
               top .45s cubic-bezier(.4,0,.2,1),
               width .45s cubic-bezier(.4,0,.2,1),
               height .45s cubic-bezier(.4,0,.2,1),
               border-radius .45s ease,
               opacity .12s ease .36s;
  `;
  fly.innerHTML = renderDiceSVGFlex(diceValue);
  document.body.appendChild(fly);

  canvasDice = null;
  render();

  // Double-rAF ensures initial styles are committed before transition fires
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fly.style.left         = `${toX - toS / 2}px`;
    fly.style.top          = `${toY - toS / 2}px`;
    fly.style.width        = `${toS}px`;
    fly.style.height       = `${toS}px`;
    fly.style.borderRadius = '8px';
    fly.style.opacity      = '0';
  }));

  setTimeout(() => { fly.remove(); finishRoll(); }, 520);
}

function finishRoll() {
  phase = 'direction';
  updateUI();
  // Small pop animation on the header dice when it appears
  const diceEl = document.getElementById('dice-inline');
  if (diceEl) {
    diceEl.classList.remove('dice-pop');
    void diceEl.offsetWidth;
    diceEl.classList.add('dice-pop');
    setTimeout(() => diceEl.classList.remove('dice-pop'), 350);
  }
  render();
  if (playerTypes[currentPlayer] === 'ai') setTimeout(aiChooseDir, 700);
}

async function chooseDir(dirName) {
  if (phase !== 'direction') return;
  addLog(`➡ Panda ${players[currentPlayer].label} moves ${dirName} (${diceValue} steps)`);
  const { events, finalPos } = simulateMove(currentPlayer, dirName, diceValue);
  await playEvents(events, finalPos);
}

function resetGame() {
  hoveredHex = null;
  flashCells = [];
  collisionFlash = null;
  canvasDice = null;
  aiPaused = false;
  phase = 'setup';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('setup-screen').style.display = 'flex';
  renderPlayerConfig();
  document.getElementById('player-config').style.display = 'flex';
}

function showWin(winnerIdx) {
  const p = players[winnerIdx];
  document.getElementById('win-name').textContent = `Panda ${p.label}`;
  document.getElementById('win-name').style.color = p.color;
  document.getElementById('win-screen').style.display = 'flex';
  document.getElementById('game-screen').style.display = 'none';
}

// =====================================================================
// RENDERING
// =====================================================================
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawDiceFace(ctx, cx, cy, s, value) {
  const dotPositions = {
    1: [[0,    0   ]],
    2: [[-0.4,-0.4 ], [ 0.4, 0.4]],
    3: [[-0.4,-0.4 ], [ 0,   0  ], [ 0.4, 0.4]],
    4: [[-0.4,-0.4 ], [ 0.4,-0.4], [-0.4, 0.4], [ 0.4, 0.4]],
    5: [[-0.4,-0.4 ], [ 0.4,-0.4], [ 0,   0  ], [-0.4, 0.4], [ 0.4, 0.4]],
    6: [[-0.4,-0.4 ], [ 0.4,-0.4], [-0.4, 0  ], [ 0.4, 0  ], [-0.4, 0.4], [ 0.4, 0.4]],
  };

  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur  = s * 0.5;
  roundRectPath(ctx, cx - s, cy - s, s * 2, s * 2, s * 0.18);
  ctx.fillStyle = '#1a3a1a';
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth   = Math.max(1.5, s * 0.06);
  ctx.stroke();

  ctx.fillStyle = '#e8f5e9';
  for (const [dx, dy] of dotPositions[value]) {
    ctx.beginPath();
    ctx.arc(cx + dx * s, cy + dy * s, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCanvasDice(ctx, value) {
  drawDiceFace(ctx, canvasW / 2, canvasH / 2, hexSize * 1.2, value);
}

function drawHex(ctx, cx, cy, size, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i + 30); // pointy-top
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawDirectionArrow(ctx, fromX, fromY, toX, toY) {
  const dx = toX - fromX, dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / dist, ny = dy / dist;

  const headLen = hexSize * 0.42;
  const lineW   = Math.max(2, hexSize * 0.09);
  const angle   = Math.atan2(dy, dx);

  // Tip lands exactly at target hex center; shaft stops at the triangle base
  const tipX     = toX;
  const tipY     = toY;
  const shaftX0  = fromX + nx * hexSize * 0.68;
  const shaftY0  = fromY + ny * hexSize * 0.68;
  const shaftX1  = tipX  - nx * headLen;   // ends at arrowhead base → round cap hidden
  const shaftY1  = tipY  - ny * headLen;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur  = 8;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(shaftX0, shaftY0);
  ctx.lineTo(shaftX1, shaftY1);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = lineW;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Arrowhead triangle (tip at hex center)
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - headLen * Math.cos(angle - Math.PI / 6), tipY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(tipX - headLen * Math.cos(angle + Math.PI / 6), tipY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Mini dice beside shaft midpoint showing the rolled value
  if (diceValue > 0) {
    const mx = (shaftX0 + shaftX1) / 2 + (-ny) * hexSize * 0.56;
    const my = (shaftY0 + shaftY1) / 2 + ( nx) * hexSize * 0.56;
    drawDiceFace(ctx, mx, my, hexSize * 0.40, diceValue);
  }

  ctx.restore();
}

function drawPanda(ctx, x, y, color, size, isActive) {
  if (isActive) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = isActive ? '#ffffff' : 'rgba(0,0,0,0.4)';
  ctx.lineWidth = isActive ? 2.5 : 1.5;
  ctx.stroke();

  ctx.font = `${Math.round(size * 0.7)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐼', x, y);
}

function render() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#0d1f0d';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const flashSet = new Set(flashCells.map(f => `${f.row},${f.col}`));

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const { x, y } = hexToPixel(row, col);
      const isTree  = board[row][col] === 'tree';
      const isStart = col === 0;
      const isGoal  = col === COLS - 1;
      const isFlash = flashSet.has(`${row},${col}`);

      let fill, stroke;
      if (isFlash)       { fill = '#ff7043'; stroke = '#ff3d00'; }
      else if (isTree)   { fill = '#1a3a1a'; stroke = '#2a5a2a'; }
      else if (isStart)  { fill = '#2a5a2a'; stroke = '#4caf50'; }
      else if (isGoal)   { fill = '#4a3a10'; stroke = '#ffd54f'; }
      else               { fill = '#2a5236'; stroke = '#3a7a4a'; }

      drawHex(ctx, x, y, hexSize - 1, fill, stroke);

      if (isTree) {
        ctx.font = `${Math.round(hexSize * 0.78)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌲', x, y);
      }
    }
  }

  if (collisionFlash) {
    for (const { x, y } of collisionFlash) {
      ctx.beginPath();
      ctx.arc(x, y, hexSize * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,235,59,0.4)';
      ctx.fill();
    }
  }

  for (let i = 0; i < players.length; i++) {
    let px, py;
    if (animPixels[i]) {
      px = animPixels[i].x;
      py = animPixels[i].y;
    } else {
      const dp = displayPos[i];
      const { x, y } = hexToPixel(dp.row, dp.col);
      px = x; py = y;
    }
    const isActive = (i === currentPlayer) && (phase === 'roll' || phase === 'direction');
    drawPanda(ctx, px, py, players[i].color, hexSize, isActive);

    ctx.font = `bold ${Math.round(hexSize * 0.28)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(players[i].label, px + hexSize * 0.38, py - hexSize * 0.35);
  }

  // Direction selection: drawn last so highlights and arrow appear above pandas
  if (phase === 'direction' && players.length > 0) {
    const pandaPos = displayPos[currentPlayer];
    const pandaPx  = hexToPixel(pandaPos.row, pandaPos.col);

    for (const dirName of DIR_NAMES) {
      const nb = getNeighbor(pandaPos.row, pandaPos.col, dirName);
      if (!isValid(nb.row, nb.col)) continue;
      const { x, y } = hexToPixel(nb.row, nb.col);
      const isHovered = hoveredHex && hoveredHex.row === nb.row && hoveredHex.col === nb.col;

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 180 * (60 * i + 30);
        const hx = x + (hexSize - 1) * Math.cos(a);
        const hy = y + (hexSize - 1) * Math.sin(a);
        if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fillStyle   = isHovered ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)';
      ctx.strokeStyle = isHovered ? 'rgba(255,255,255,1.0)'  : 'rgba(255,255,255,0.5)';
      ctx.lineWidth   = isHovered ? 2.5 : 1.5;
      ctx.fill();
      ctx.stroke();
    }

    if (hoveredHex) {
      const dir = getDirToNeighbor(pandaPos.row, pandaPos.col, hoveredHex.row, hoveredHex.col);
      if (dir) {
        const tgt = hexToPixel(hoveredHex.row, hoveredHex.col);
        drawDirectionArrow(ctx, pandaPx.x, pandaPx.y, tgt.x, tgt.y);
      }
    }
  }

  // Large dice overlay during roll phase — drawn last, on top of everything
  if (canvasDice) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    if (canvasDice.rolling) {
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.rotate((Math.random() - 0.5) * 0.07);
      ctx.translate(-canvasW / 2, -canvasH / 2);
    }
    drawCanvasDice(ctx, canvasDice.value);
    ctx.restore();
  }
}

// =====================================================================
// SETUP / PLAYER CONFIG
// =====================================================================
function selectNumPlayers(n) {
  selectedNumPlayers = n;
  while (playerTypes.length < n) playerTypes.push('ai');
  playerTypes = playerTypes.slice(0, n);
  renderPlayerConfig();
  document.getElementById('player-config').style.display = 'flex';
}

function renderPlayerConfig() {
  document.querySelectorAll('.player-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.textContent) === selectedNumPlayers);
  });

  const list = document.getElementById('player-type-list');
  list.innerHTML = '';
  for (let i = 0; i < selectedNumPlayers; i++) {
    const type = playerTypes[i];
    const row = document.createElement('div');
    row.className = 'player-type-row';
    row.innerHTML = `
      <div class="player-dot-setup" style="background:${PLAYER_COLORS[i]}"></div>
      <span class="player-type-name">Panda ${PLAYER_LABELS[i]}</span>
      <div class="type-toggle">
        <button class="type-btn${type === 'human' ? ' active' : ''}" onclick="setPlayerType(${i},'human')">👤 Human</button>
        <button class="type-btn${type === 'ai'    ? ' active' : ''}" onclick="setPlayerType(${i},'ai')">🤖 AI</button>
      </div>
    `;
    list.appendChild(row);
  }

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.diff === selectedDifficulty);
  });

  document.querySelectorAll('.map-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.mapidx) === selectedMapIdx);
  });
}

function setPlayerType(idx, type) {
  playerTypes[idx] = type;
  renderPlayerConfig();
}

function selectDifficulty(d) {
  selectedDifficulty = d;
  renderPlayerConfig();
}

function selectMap(idx) {
  selectedMapIdx = idx;
  renderPlayerConfig();
}

function saveSetup() {
  try {
    localStorage.setItem('pandas-setup', JSON.stringify({
      numPlayers: selectedNumPlayers,
      playerTypes,
      difficulty: selectedDifficulty,
      mapIdx: selectedMapIdx,
    }));
  } catch (e) {}
}

function loadSetup() {
  try {
    const saved = JSON.parse(localStorage.getItem('pandas-setup'));
    if (saved && Number.isInteger(saved.numPlayers) && saved.numPlayers >= 2 && saved.numPlayers <= 6) {
      selectedNumPlayers = saved.numPlayers;
      const types = saved.playerTypes;
      if (Array.isArray(types) && types.length === selectedNumPlayers &&
          types.every(t => t === 'human' || t === 'ai')) {
        playerTypes = types;
      } else {
        playerTypes = Array.from({ length: selectedNumPlayers }, (_, i) => i === 0 ? 'human' : 'ai');
      }
      if (['easy','medium','hard'].includes(saved.difficulty)) selectedDifficulty = saved.difficulty;
      if ([-1,0,1,2].includes(saved.mapIdx)) selectedMapIdx = saved.mapIdx;
      renderPlayerConfig();
      document.getElementById('player-config').style.display = 'flex';
    }
  } catch (e) {}
}

// =====================================================================
// AI
// =====================================================================
function scoreMove(pIdx, dirName) {
  const { events, finalPos } = simulateMove(pIdx, dirName, diceValue);
  let score = 0;

  // Own column progress (primary objective)
  score += (finalPos[pIdx].col - players[pIdx].col) * 10;

  // Win instantly
  if (finalPos[pIdx].col === COLS - 1) score += 200;

  // Stuck (bounced twice, no progress)
  if (events.some(e => e.type === 'stuck' && e.player === pIdx)) score -= 8;

  // Penalise advancing opponents
  for (let i = 0; i < players.length; i++) {
    if (i === pIdx) continue;
    const adv = finalPos[i].col - players[i].col;
    if (adv > 0) score -= adv * 4;
    if (finalPos[i].col === COLS - 1) score -= 200;
  }

  // Small noise so equal-score directions don't always resolve the same way
  score += (Math.random() - 0.5) * 1.5;
  return score;
}

function toggleAIPause() {
  aiPaused = !aiPaused;
  updatePauseButton();
  if (!aiPaused) {
    if (phase === 'roll' && playerTypes[currentPlayer] === 'ai') {
      setTimeout(rollDice, 300);
    } else if (phase === 'direction' && playerTypes[currentPlayer] === 'ai') {
      setTimeout(aiChooseDir, 300);
    }
  }
}

function updatePauseButton() {
  const btn = document.getElementById('pause-btn');
  if (!btn) return;
  const hasAI = players.length > 0 && playerTypes.some(t => t === 'ai');
  btn.disabled = !hasAI;
  btn.textContent = aiPaused ? '▶ Play' : '⏸ Pause';
  btn.classList.toggle('paused', aiPaused);
}

function aiChooseDir() {
  if (phase !== 'direction') return;
  if (aiPaused) return;
  let bestScore = -Infinity;
  let bestDir = DIR_NAMES[0];
  const shuffled = [...DIR_NAMES].sort(() => Math.random() - 0.5);
  for (const dir of shuffled) {
    const s = scoreMove(currentPlayer, dir);
    if (s > bestScore) { bestScore = s; bestDir = dir; }
  }
  chooseDir(bestDir);
}

// =====================================================================
// KEYBOARD SHORTCUTS
// =====================================================================
document.addEventListener('keydown', e => {
  const keyDirMap = {
    ArrowRight: 'E',  ArrowLeft: 'W',
    KeyQ: 'NW', KeyW: 'NE', KeyA: 'SW', KeyS: 'SE',
    Numpad6: 'E', Numpad4: 'W', Numpad9: 'NE', Numpad7: 'NW', Numpad1: 'SW', Numpad3: 'SE',
  };
  if (phase === 'direction' && playerTypes[currentPlayer] !== 'ai' && keyDirMap[e.code]) {
    e.preventDefault();
    chooseDir(keyDirMap[e.code]);
  }
});

window.addEventListener('resize', () => {
  if (phase === 'setup' || phase === 'win') return;
  computeLayout();
  const canvas = document.getElementById('gameCanvas');
  canvas.width  = canvasW;
  canvas.height = canvasH;
  render();
});

loadSetup();
