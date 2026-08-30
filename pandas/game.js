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
function generateBoard(np) {
  let b;
  let attempts = 0;
  do {
    b = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        if (c === 0 || c === COLS - 1) return Math.random() < 0.15 ? 'tree' : 'grass';
        return Math.random() < 0.33 ? 'tree' : 'grass';
      })
    );
    // Guarantee enough starting grass cells for all players
    const leftGrass = [];
    for (let r = 0; r < ROWS; r++) if (b[r][0] === 'grass') leftGrass.push(r);
    while (leftGrass.length < np) {
      const r = Math.floor(Math.random() * ROWS);
      if (b[r][0] === 'tree') { b[r][0] = 'grass'; leftGrass.push(r); }
    }
    attempts++;
    if (attempts > 200) {
      // Fallback: carve a guaranteed corridor
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
function startGame(np) {
  numPlayers = np;
  board = generateBoard(np);

  const leftGrass = [];
  for (let r = 0; r < ROWS; r++) if (board[r][0] === 'grass') leftGrass.push(r);
  shuffleArray(leftGrass);

  players = [];
  for (let i = 0; i < np; i++) {
    players.push({ row: leftGrass[i], col: 0, color: PLAYER_COLORS[i], label: PLAYER_LABELS[i] });
  }

  displayPos = players.map(p => ({ row: p.row, col: p.col }));
  animPixels = new Array(np).fill(null);
  flashCells = [];
  collisionFlash = null;

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
    if (phase !== 'direction') return;
    const hex = hexUnderPointer(e.clientX, e.clientY);
    const panda = displayPos[currentPlayer];
    const dir = getDirToNeighbor(panda.row, panda.col, hex.row, hex.col);
    if (dir) chooseDir(dir);
  });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (phase !== 'direction') return;
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

  const phaseInfo = document.getElementById('phase-info');
  if (phase === 'roll') phaseInfo.textContent = 'Roll the dice to begin your move';
  else if (phase === 'direction') phaseInfo.textContent = `Rolled ${diceValue} — choose a direction`;
  else if (phase === 'animating') phaseInfo.textContent = 'Moving…';

  document.querySelectorAll('.dir-btn').forEach(btn => {
    btn.disabled = (phase !== 'direction');
  });

  const list = document.getElementById('player-list');
  list.innerHTML = '';
  players.forEach((pl, i) => {
    const row = document.createElement('div');
    row.className = 'player-row' + (i === currentPlayer && phase !== 'win' ? ' active' : '');
    if (pl.col === COLS - 1) row.className += ' winner';
    row.innerHTML = `
      <div class="player-dot" style="background:${pl.color}"></div>
      <div class="player-name">Panda ${pl.label}</div>
      <div class="player-pos">col ${pl.col + 1}/${COLS}</div>
    `;
    list.appendChild(row);
  });

  const diceContainer = document.getElementById('dice-display');
  diceContainer.innerHTML = diceValue > 0
    ? renderDiceSVG(diceValue)
    : '<span style="font-size:2rem;color:#81c784">?</span>';
}

function renderDiceSVG(n) {
  const dotPos = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  };
  const dots = dotPos[n].map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="8" fill="#e8f5e9"/>`
  ).join('');
  return `<svg width="70" height="70" viewBox="0 0 100 100">${dots}</svg>`;
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

  function doSim(pIdx, dir, stepsLeft) {
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
          events.push({ type: 'collision', player: pIdx, other: otherIdx, stepsLeft });
          doSim(otherIdx, dir, stepsLeft);
          return;
        }
        simPos[pIdx] = { ...next };
        events.push({ type: 'move', player: pIdx, to: { ...next } });
        stepsLeft--;
        bounced = false;
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
  render();
  setTimeout(rollDice, 600);
}

// =====================================================================
// GAME ACTIONS
// =====================================================================
function rollDice() {
  if (phase !== 'roll') return;
  const d = document.getElementById('dice-display');
  d.classList.add('rolling');
  setTimeout(() => d.classList.remove('rolling'), 420);

  let count = 0;
  const interval = setInterval(() => {
    d.innerHTML = renderDiceSVG(Math.floor(Math.random() * 6) + 1);
    count++;
    if (count >= 6) {
      clearInterval(interval);
      diceValue = Math.floor(Math.random() * 6) + 1;
      d.innerHTML = renderDiceSVG(diceValue);
      phase = 'direction';
      addLog(`🎲 Panda ${players[currentPlayer].label} rolled ${diceValue}`);
      updateUI();
      render();
    }
  }, 60);
}

async function chooseDir(dirName) {
  if (phase !== 'direction') return;
  addLog(`➡ Panda ${players[currentPlayer].label} moves ${dirName} (${diceValue} steps)`);
  const { events, finalPos } = simulateMove(currentPlayer, dirName, diceValue);
  await playEvents(events, finalPos);
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

  // Dice step count — badge beside shaft midpoint (offset perpendicular to arrow)
  if (diceValue > 0) {
    const mx   = (shaftX0 + shaftX1) / 2 + (-ny) * hexSize * 0.38;
    const my   = (shaftY0 + shaftY1) / 2 + ( nx) * hexSize * 0.38;
    const r    = Math.round(hexSize * 0.32);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();
    ctx.font = `bold ${Math.round(hexSize * 0.48)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(String(diceValue), mx, my);
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
  if (phase === 'direction' && keyDirMap[e.code]) {
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
