let COLS = 3;
let ROWS = 4;
const IMAGE_SRC = "puzzle.jpg"; // replace this file with your portrait photo

// Cubic bezier segments (unit space) forming one jigsaw edge knob.
// u: along the edge (0..1), v: perpendicular offset (multiplied by tab size * sign)
const SEGS = [
  [0.20, 0.00, 0.34, 0.04, 0.40, -0.02],
  [0.46, -0.08, 0.30, -0.17, 0.43, -0.22],
  [0.50, -0.26, 0.56, -0.26, 0.57, -0.22],
  [0.70, -0.17, 0.54, -0.08, 0.60, -0.02],
  [0.66, 0.04, 0.80, 0.00, 1.00, 0.00],
];

let lastSrc = null;
let timerInterval = null;
let startTime = 0;
let solved = false;
let pieces = [];      // {el,row,col,locked,traySlot}
let layout = null;    // {bl,bt,bw,bh,cw,ch,pad,T}
let trayEl = null;
let traySlots = [];   // {x,y,occupied}

/* ---------- image ---------- */
function loadImage() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.src);
    img.onerror = () => resolve(makeFallbackImage());
    img.src = IMAGE_SRC;
  });
}

function makeFallbackImage() {
  const c = document.createElement("canvas");
  c.width = 600; c.height = 800;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 600, 800);
  grad.addColorStop(0, "#ff9a6b");
  grad.addColorStop(0.5, "#c86dd7");
  grad.addColorStop(1, "#3023ae");
  g.fillStyle = grad;
  g.fillRect(0, 0, 600, 800);
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = "bold 44px sans-serif";
  g.textAlign = "center";
  g.fillText("DoCW", 300, 380);
  g.font = "28px sans-serif";
  g.fillText("add puzzle.jpg", 300, 430);
  return c.toDataURL();
}

/* ---------- jigsaw geometry ---------- */
function edgeSegmentsH(sx, sy, ex, sign, reversed) {
  if (!sign) return [[sx, sy, sx, sy, ex, sy]];
  const T = layout.T;
  const segs = SEGS.map((s) => [
    sx + s[0] * (ex - sx), sy + s[1] * T * sign,
    sx + s[2] * (ex - sx), sy + s[3] * T * sign,
    sx + s[4] * (ex - sx), sy + s[5] * T * sign,
  ]);
  return reversed ? reverseSegs(segs, sx, sy) : segs;
}

function edgeSegmentsV(sx, sy, ey, sign, reversed) {
  if (!sign) return [[sx, sy, sx, sy, sx, ey]];
  const T = layout.T;
  const segs = SEGS.map((s) => [
    sx + s[1] * T * sign, sy + s[0] * (ey - sy),
    sx + s[3] * T * sign, sy + s[2] * (ey - sy),
    sx + s[5] * T * sign, sy + s[4] * (ey - sy),
  ]);
  return reversed ? reverseSegs(segs, sx, sy) : segs;
}

function reverseSegs(segs, sx, sy) {
  const pts = [sx, sy, ...segs.flat()];
  const out = [];
  for (let i = segs.length - 1; i >= 0; i--) {
    const e = i * 6;
    out.push([pts[e + 4], pts[e + 5], pts[e + 2], pts[e + 3], pts[e], pts[e + 1]]);
  }
  return out;
}

function piecePath(row, col, cw, ch, hE, vE) {
  let d = `M 0 0 `;
  const topS = row === 0 ? 0 : hE[row][col];
  const botS = row === ROWS - 1 ? 0 : hE[row + 1][col];
  const leftS = col === 0 ? 0 : vE[row][col - 1];
  const rightS = col === COLS - 1 ? 0 : vE[row][col];

  edgeSegmentsH(0, 0, cw, topS, false).forEach(
    (s) => { d += `C ${s[0]} ${s[1]} ${s[2]} ${s[3]} ${s[4]} ${s[5]} `; });
  edgeSegmentsV(cw, 0, ch, rightS, false).forEach(
    (s) => { d += `C ${s[0]} ${s[1]} ${s[2]} ${s[3]} ${s[4]} ${s[5]} `; });
  edgeSegmentsH(cw, ch, 0, botS, true).forEach(
    (s) => { d += `C ${s[0]} ${s[1]} ${s[2]} ${s[3]} ${s[4]} ${s[5]} `; });
  edgeSegmentsV(0, ch, 0, leftS, true).forEach(
    (s) => { d += `C ${s[0]} ${s[1]} ${s[2]} ${s[3]} ${s[4]} ${s[5]} `; });
  return d + "Z";
}

/* ---------- game build ---------- */
async function startGame() {
  const src = await loadImage();
  solved = false;
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("win-screen").classList.add("hidden");
  hintBtn.classList.remove("hidden", "active");
  buildGame(src);
  startTimer();
}

function computeLayout(area) {
  const W = area.clientWidth, H = area.clientHeight;
  // board takes upper ~55% of the play field; tray lives below it
  const ch = Math.max(36, Math.round(H * 0.55 / ROWS));
  const cw = Math.max(36, Math.round(Math.min(ch * COLS / ROWS, W * 0.88 / COLS)));
  const bw = cw * COLS, bh = ch * ROWS;
  return {
    bw, bh, cw, ch,
    bl: Math.round((W - bw) / 2),
    bt: Math.round(Math.max(8, H * 0.02)),
    T: 0.8 * Math.min(cw, ch),
  };
}

function buildGame(src, keepState) {
  lastSrc = src;
  const area = document.getElementById("game-area");
  area.innerHTML = "";
  layout = computeLayout(area);
  layout.pad = Math.ceil(layout.T * 0.28);

  // empty template with a subtle grid (no hints of the picture)
  const frame = document.createElement("div");
  frame.id = "board-frame";
  frame.style.left = layout.bl + "px";
  frame.style.top = layout.bt + "px";
  frame.style.width = layout.bw + "px";
  frame.style.height = layout.bh + "px";
  frame.style.setProperty("--cols", COLS);
  frame.style.setProperty("--rows", ROWS);
  area.appendChild(frame);

  // ghost hint image (hidden unless toggled)
  const ghost = document.createElement("img");
  ghost.id = "ghost-img";
  ghost.src = src;
  ghost.alt = "";
  ghost.draggable = false;
  frame.appendChild(ghost);

  // random tab/blank directions for inner edges
  // (border edges stay flat: corners have 2 inner engravings,
  //  boundary pieces 3, middle pieces all 4)
  const hE = [], vE = [];
  for (let r = 0; r <= ROWS; r++) {
    hE[r] = [];
    for (let c = 0; c < COLS; c++)
      hE[r][c] = r === 0 || r === ROWS ? 0 : (Math.random() < 0.5 ? 1 : -1);
  }
  for (let r = 0; r < ROWS; r++) {
    vE[r] = [];
    for (let c = 0; c <= COLS; c++)
      vE[r][c] = c === 0 || c === COLS ? 0 : (Math.random() < 0.5 ? 1 : -1);
  }

  const oldPieces = keepState ? pieces : null;
  pieces = [];
  const pw = layout.cw + layout.pad * 2;
  const ph = layout.ch + layout.pad * 2;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const prev = oldPieces?.find((p) => p.row === r && p.col === c);
      const locked = prev ? prev.locked : false;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", pw);
      svg.setAttribute("height", ph);
      svg.classList.add("piece");

      const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clip.id = `clip-${r}-${c}-${Math.random().toString(36).slice(2, 7)}`;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", piecePath(r, c, layout.cw, layout.ch, hE, vE));
      path.setAttribute("transform", `translate(${layout.pad},${layout.pad})`);
      clip.appendChild(path);
      svg.appendChild(clip);

      const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
      img.setAttribute("href", src);
      img.setAttribute("width", layout.bw);
      img.setAttribute("height", layout.bh);
      img.setAttribute("x", layout.pad - c * layout.cw);
      img.setAttribute("y", layout.pad - r * layout.ch);
      img.setAttribute("clip-path", `url(#${clip.id})`);
      img.setAttribute("preserveAspectRatio", "none");
      svg.appendChild(img);

      const piece = { el: svg, row: r, col: c, locked, traySlot: null };
      pieces.push(piece);
      if (locked) {
        area.appendChild(svg);
        placeAtHome(piece);
      }
      attachDrag(piece);
    }
  }

  buildTray(area);
}

/* ---------- tray (two ordered columns below the template) ---------- */
function buildTray(area) {
  const trayTop = layout.bt + layout.bh + 10;
  trayEl = document.createElement("div");
  trayEl.id = "tray";
  trayEl.style.top = trayTop + "px";
  area.appendChild(trayEl);

  const pw = layout.cw + layout.pad * 2;
  const ph = layout.ch + layout.pad * 2;
  const gap = 10;

  const loose = pieces.filter((p) => !p.locked);
  // jumbled assignment into neat slots
  const order = loose.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  traySlots = loose.map((_, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const totalW = 2 * pw + gap;
    const startX = Math.max(6, Math.floor((trayEl.clientWidth - totalW) / 2));
    return { x: startX + col * (pw + gap), y: 8 + row * (ph + gap), occupied: false };
  });

  // spacer gives the tray its scrollable height
  const rows = Math.ceil(loose.length / 2);
  const spacer = document.createElement("div");
  spacer.style.height = (rows * (ph + gap) + 16) + "px";
  trayEl.appendChild(spacer);

  order.forEach((pieceIdx, slotIdx) => placeInTray(loose[pieceIdx], slotIdx));
}

function slotGeom(i) {
  const pw = layout.cw + layout.pad * 2;
  const ph = layout.ch + layout.pad * 2;
  const gap = 10;
  const col = i % 2, row = Math.floor(i / 2);
  const totalW = 2 * pw + gap;
  const startX = Math.max(6, Math.floor((trayEl.clientWidth - totalW) / 2));
  return { x: startX + col * (pw + gap), y: 8 + row * (ph + gap) };
}

function placeInTray(p, slotIdx) {
  const s = slotIdx ?? traySlots.findIndex((t) => !t.occupied);
  if (s < 0) return;
  traySlots[s].occupied = true;
  p.traySlot = s;
  const g = slotGeom(s);
  trayEl.appendChild(p.el);
  p.el.classList.remove("locked", "dragging");
  p.el.style.transition = "";
  p.el.style.zIndex = 5;
  p.el.style.left = g.x + "px";
  p.el.style.top = g.y + "px";
}

function freeTraySlot(p) {
  if (p.traySlot != null && traySlots[p.traySlot]) traySlots[p.traySlot].occupied = false;
  p.traySlot = null;
}

function returnToTray(p) {
  const area = document.getElementById("game-area");
  const el = p.el;
  const areaRect = area.getBoundingClientRect();
  const trayRect = trayEl.getBoundingClientRect();

  // current visual position expressed in tray content coordinates
  const curX = parseFloat(el.style.left) + areaRect.left - trayRect.left;
  const curY = parseFloat(el.style.top) + areaRect.top - trayRect.top + trayEl.scrollTop;

  const s = traySlots.findIndex((t) => !t.occupied);
  if (s < 0) { placeInTray(p, undefined); return; }
  traySlots[s].occupied = true;
  p.traySlot = s;
  const g = slotGeom(s);

  trayEl.appendChild(el);
  el.classList.remove("dragging");
  el.style.transition = "none";
  el.style.left = curX + "px";
  el.style.top = curY + "px";
  el.style.zIndex = 50;

  requestAnimationFrame(() => {
    el.style.transition = "left 0.28s ease, top 0.28s ease";
    el.style.left = g.x + "px";
    el.style.top = g.y + "px";
    setTimeout(() => { el.style.transition = ""; }, 320);
    el.style.zIndex = 5;
  });
}

/* ---------- positioning ---------- */
function homeX(p) { return layout.bl + p.col * layout.cw - layout.pad; }
function homeY(p) { return layout.bt + p.row * layout.ch - layout.pad; }

function placeAtHome(p, animate) {
  p.locked = true;
  freeTraySlot(p);
  p.el.classList.add("locked");
  if (animate) {
    const el = p.el;
    el.style.transition = "left 0.18s ease-out, top 0.18s ease-out";
    requestAnimationFrame(() => {
      el.style.left = homeX(p) + "px";
      el.style.top = homeY(p) + "px";
      setTimeout(() => { el.style.transition = ""; }, 220);
    });
  } else {
    p.el.style.left = homeX(p) + "px";
    p.el.style.top = homeY(p) + "px";
  }
  p.el.style.zIndex = 1;
}

/* ---------- dragging ---------- */
function attachDrag(p) {
  const el = p.el;
  el.addEventListener("pointerdown", (e) => {
    if (p.locked || solved) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    el.style.zIndex = 100;

    const area = document.getElementById("game-area");
    const pw = layout.cw + layout.pad * 2;
    const ph = layout.ch + layout.pad * 2;

    let ox, oy;
    if (el.parentElement === trayEl) {
      // lift the piece out of the scrollable tray into the play field
      const areaRect = area.getBoundingClientRect();
      const trayRect = trayEl.getBoundingClientRect();
      const lx = parseFloat(el.style.left), ly = parseFloat(el.style.top);
      ox = trayRect.left + lx - areaRect.left;
      oy = trayRect.top + ly - trayEl.scrollTop - areaRect.top;
      freeTraySlot(p);
      area.appendChild(el);
    } else {
      ox = parseFloat(el.style.left);
      oy = parseFloat(el.style.top);
    }
    el.style.transition = "none";
    el.style.left = ox + "px";
    el.style.top = oy + "px";

    const startX = e.clientX, startY = e.clientY;

    const move = (ev) => {
      let nx = ox + ev.clientX - startX;
      let ny = oy + ev.clientY - startY;
      nx = Math.max(-pw * 0.3, Math.min(nx, area.clientWidth - pw * 0.7));
      ny = Math.max(-ph * 0.3, Math.min(ny, area.clientHeight - ph * 0.7));
      el.style.left = nx + "px";
      el.style.top = ny + "px";
    };

    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.classList.remove("dragging");
      const dx = parseFloat(el.style.left) - homeX(p);
      const dy = parseFloat(el.style.top) - homeY(p);
      const snapDist = Math.min(layout.cw, layout.ch) * 0.38;
      if (Math.hypot(dx, dy) < snapDist) {
        placeAtHome(p, true);
        el.classList.add("pop");
        setTimeout(() => el.classList.remove("pop"), 320);
        checkWin();
      } else {
        returnToTray(p);
      }
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  });
}

function checkWin() {
  if (pieces.every((p) => p.locked)) {
    solved = true;
    stopTimer();
    document.getElementById("final-time").textContent =
      document.getElementById("timer").textContent;
    setTimeout(() => {
      document.getElementById("win-screen").classList.remove("hidden");
    }, 500);
  }
}

/* ---------- timer ---------- */
function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function startTimer() {
  startTime = Date.now();
  clearInterval(timerInterval);
  const t = document.getElementById("timer");
  t.textContent = "00:00";
  timerInterval = setInterval(() => {
    t.textContent = formatTime(Date.now() - startTime);
  }, 250);
}
function stopTimer() {
  clearInterval(timerInterval);
  document.getElementById("timer").textContent = formatTime(Date.now() - startTime);
}

/* ---------- events ---------- */
document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("again-btn").addEventListener("click", startGame);

document.querySelectorAll(".diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    COLS = Number(btn.dataset.cols);
    ROWS = Number(btn.dataset.rows);
  });
});

const hintBtn = document.getElementById("hint-btn");
hintBtn.addEventListener("click", () => {
  const ghost = document.getElementById("ghost-img");
  if (!ghost) return;
  const on = ghost.classList.toggle("visible");
  hintBtn.classList.toggle("active", on);
});

window.addEventListener("resize", () => {
  if (!layout || solved || !lastSrc) return;
  buildGame(lastSrc, true);
});

document.addEventListener("contextmenu", (e) => {
  if (e.target.closest(".piece")) e.preventDefault();
});
