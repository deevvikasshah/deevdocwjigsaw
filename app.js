const COLS = 3;
const ROWS = 4;
const IMAGE_SRC = "puzzle.jpg"; // replace this file with your portrait photo

const board = document.getElementById("board");
const timerEl = document.getElementById("timer");
const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const winScreen = document.getElementById("win-screen");
const finalTimeEl = document.getElementById("final-time");

let pieces = [];        // piece elements in slot order
let selected = null;    // currently selected piece element
let startTime = 0;
let timerInterval = null;
let solved = false;

// Fallback image if puzzle.jpg is missing
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

function loadImage() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.src);
    img.onerror = () => resolve(makeFallbackImage());
    img.src = IMAGE_SRC;
  });
}

function shuffle(arr) {
  // Fisher-Yates, then guarantee not already solved
  do {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  } while (arr.every((v, i) => v === i));
  return arr;
}

function buildBoard(src) {
  board.innerHTML = "";
  pieces = [];
  selected = null;
  solved = false;

  const order = shuffle([...Array(COLS * ROWS).keys()]);

  order.forEach((pieceIndex, slotIndex) => {
    const p = document.createElement("div");
    p.className = "piece";
    p.dataset.piece = pieceIndex;
    p.style.backgroundImage = `url(${src})`;
    const col = pieceIndex % COLS;
    const row = Math.floor(pieceIndex / COLS);
    p.style.backgroundPosition =
      `${(col * 100) / (COLS - 1)}% ${(row * 100) / (ROWS - 1)}%`;
    p.addEventListener("pointerdown", onPieceTap);
    board.appendChild(p);
    pieces.push(p);
  });
}

function onPieceTap(e) {
  if (solved) return;
  e.preventDefault();
  const piece = e.currentTarget;

  if (!selected) {
    selected = piece;
    piece.classList.add("selected");
    return;
  }

  if (selected === piece) {
    piece.classList.remove("selected");
    selected = null;
    return;
  }

  swapPieces(selected, piece);
  selected.classList.remove("selected");
  selected = null;
  checkWin();
}

function swapPieces(a, b) {
  const ia = pieces.indexOf(a);
  const ib = pieces.indexOf(b);
  [pieces[ia], pieces[ib]] = [pieces[ib], pieces[ia]];

  // Swap DOM positions
  const marker = document.createElement("div");
  board.insertBefore(marker, a);
  board.insertBefore(a, b);
  board.insertBefore(b, marker);
  marker.remove();

  a.classList.add("pop");
  b.classList.add("pop");
  setTimeout(() => { a.classList.remove("pop"); b.classList.remove("pop"); }, 260);
  updateCorrectMarks();
}

function updateCorrectMarks() {
  pieces.forEach((p, slot) => {
    p.classList.toggle("correct", Number(p.dataset.piece) === slot);
  });
}

function checkWin() {
  if (pieces.every((p, slot) => Number(p.dataset.piece) === slot)) {
    solved = true;
    stopTimer();
    finalTimeEl.textContent = timerEl.textContent;
    setTimeout(() => {
      gameScreen.classList.add("hidden");
      winScreen.classList.remove("hidden");
    }, 450);
  }
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    timerEl.textContent = formatTime(Date.now() - startTime);
  }, 250);
  timerEl.textContent = "00:00";
}

function stopTimer() {
  clearInterval(timerInterval);
  timerEl.textContent = formatTime(Date.now() - startTime);
}

async function startGame() {
  const src = await loadImage();
  buildBoard(src);
  startScreen.classList.add("hidden");
  winScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  startTimer();
}

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("again-btn").addEventListener("click", startGame);

// Prevent page scroll/zoom interfering with taps on the board
board.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
