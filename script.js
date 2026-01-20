// Selektori
let dom_replay = document.querySelector("#replay");
let dom_start = document.querySelector("#start");
let dom_score = document.querySelector("#score");
let dom_canvas = document.querySelector("#game");
let CTX = dom_canvas.getContext("2d");

// Modal elementi
const modal = document.getElementById("game-over-modal");
const closeModalBtn = document.getElementById("close-modal");
const finalScore = document.getElementById("final-score");

const W = (dom_canvas.width = 400);
const H = (dom_canvas.height = 400);

let snake,
  food,
  currentHue,
  cells = 20,
  cellSize,
  isGameOver = false,
  score = 0,
  maxScore = window.localStorage.getItem("maxScore") || 0,
  particles = [],
  splashingParticleCount = 20,
  requestID;

// 🎨 Teme
const themes = {
  golden: { head: "#FFD700", tail: "#b8860b", glow: "rgba(255,215,0,.6)" },
  neon: { head: "#0ff", tail: "#f0f", glow: "rgba(0,255,255,.6)" },
  retro: { head: "#0f0", tail: "#ff0", glow: "rgba(0,255,0,.6)" },
  matrix: { head: "#0f0", tail: "#030", glow: "rgba(0,255,0,.6)" }
};
let currentTheme = themes.golden;

// Helpers
let helpers = {
  Vec: class {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { this.x += v.x; this.y += v.y; return this; }
  },
  isCollision(v1, v2) { return v1.x == v2.x && v1.y == v2.y; },
  garbageCollector() { particles = particles.filter(p => p.size > 0); },
  drawGrid() {
    CTX.lineWidth = 1.1;
    CTX.strokeStyle = "#232332";
    for (let i = 1; i < cells; i++) {
      let f = (W / cells) * i;
      CTX.beginPath(); CTX.moveTo(f, 0); CTX.lineTo(f, H); CTX.stroke();
      CTX.beginPath(); CTX.moveTo(0, f); CTX.lineTo(W, f); CTX.stroke();
    }
  },
  randHue() { return ~~(Math.random() * 360); }
};

// Kontrole
let KEY = {
  ArrowUp: false, ArrowRight: false, ArrowDown: false, ArrowLeft: false,
  resetState() { this.ArrowUp = this.ArrowRight = this.ArrowDown = this.ArrowLeft = false; },
  listen() {
    addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" && this.ArrowDown) return;
      if (e.key === "ArrowDown" && this.ArrowUp) return;
      if (e.key === "ArrowLeft" && this.ArrowRight) return;
      if (e.key === "ArrowRight" && this.ArrowLeft) return;
      this[e.key] = true;
      Object.keys(this).forEach(k => { if (k !== e.key && k !== "listen" && k !== "resetState") this[k] = false; });
    }, false);
  }
};

// Snake klasa
class Snake {
  constructor() {
    this.pos = new helpers.Vec(W / 2, H / 2);
    this.size = W / cells;
    this.dir = new helpers.Vec(this.size, 0);
    this.color = currentTheme.head;
    this.history = [];
    this.total = 1;
    this.delay = 8;
    this.glow = currentTheme.glow;
    this.pulseStep = 0;
  }
  draw() {
    let { x, y } = this.pos;
    this.pulseStep += 0.1;
    let pulse = 20 + Math.sin(this.pulseStep) * 10;
    CTX.fillStyle = this.color;
    CTX.shadowBlur = pulse;
    CTX.shadowColor = this.glow;
    CTX.fillRect(x, y, this.size, this.size);
    CTX.shadowBlur = 0;
    if (this.total >= 2) {
      for (let i = 0; i < this.history.length - 1; i++) {
        let { x, y } = this.history[i];
        CTX.fillStyle = currentTheme.tail;
        CTX.shadowBlur = pulse / 2;
        CTX.shadowColor = this.glow;
        CTX.fillRect(x, y, this.size, this.size);
        CTX.shadowBlur = 0;
      }
    }
  }
  walls() {
    let { x, y } = this.pos;
    if (x + cellSize > W) this.pos.x = 0;
    if (y + cellSize > H) this.pos.y = 0;
    if (y < 0) this.pos.y = H - cellSize;
    if (x < 0) this.pos.x = W - cellSize;
  }
  controlls() {
    let dir = this.size;
    if (KEY.ArrowUp) this.dir = new helpers.Vec(0, -dir);
    if (KEY.ArrowDown) this.dir = new helpers.Vec(0, dir);
    if (KEY.ArrowLeft) this.dir = new helpers.Vec(-dir, 0);
    if (KEY.ArrowRight) this.dir = new helpers.Vec(dir, 0);
  }
  selfCollision() {
    for (let p of this.history) if (helpers.isCollision(this.pos, p)) isGameOver = true;
  }
  update() {
    this.walls(); this.draw(); this.controlls();
    if (!this.delay--) {
      if (helpers.isCollision(this.pos, food.pos)) {
        incrementScore(); particleSplash(); food.spawn(); this.total++;
        this.glow = "rgba(255,215,0,1)";
        setTimeout(() => this.glow = currentTheme.glow, 300);
      }
      this.history[this.total - 1] = new helpers.Vec(this.pos.x, this.pos.y);
      for (let i = 0; i < this.total - 1; i++) this.history[i] = this.history[i + 1];
      this.pos.add(this.dir); this.delay = 5;
      if (this.total > 3) this.selfCollision();
    }
  }
}

// Food klasa
class Food {
  constructor() { this.size = W / cells; this.spawn(); }
  draw() {
    let { x, y } = this.pos;
    CTX.shadowBlur = 20; CTX.shadowColor = this.color;
    CTX.fillStyle = this.color; CTX.fillRect(x, y, this.size, this.size);
    CTX.shadowBlur = 0;
  }
  spawn() {
    let randX = ~~(Math.random() * cells) * this.size;
    let randY = ~~(Math.random() * cells) * this.size;
    for (let path of snake.history) if (helpers.isCollision(new helpers.Vec(randX, randY), path)) return this.spawn();
    this.color = `hsl(${helpers.randHue()}, 100%, 50%)`;
    this.pos = new helpers.Vec(randX, randY);
  }
}

// Particle klasa
class Particle {
  constructor(pos, color, size, vel) {
    this.pos = pos; this.color = color; this.size = Math.abs(size / 2);
    this.vel = vel; this.ttl = 0; this.gravity = -0.2;
  }
  draw() { if (this.size > 0) CTX.fillStyle = this.color, CTX.fillRect(this.pos.x, this.pos.y, this.size, this.size); }
  update() { this.draw(); this.size -= 0.3; this.ttl++; this.pos.add(this.vel); this.vel.y -= this.gravity; }
}

// Resize
function resizeCanvas() {
  const wrapperWidth = document.querySelector("#game-wrapper").offsetWidth;
  const size = Math.min(wrapperWidth - 20, 400);
  dom_canvas.width = size; dom_canvas.height = size; cellSize = size / cells;
}
window.addEventListener("resize", () => { resizeCanvas(); reset(); });

// Tema
function setTheme(name) { currentTheme = themes[name]; snake.color = currentTheme.head; snake.glow = currentTheme.glow; }
document.querySelectorAll("#snake-colors button").forEach(btn => btn.addEventListener("click", () => setTheme(btn.getAttribute("data-theme"))));

// Score
function incrementScore() {
  score++;
  dom_score.innerText = score.toString().padStart(2, "0");
  dom_score.classList.add("pulse");
  setTimeout(() => dom_score.classList.remove("pulse"), 300);

  let scores = JSON.parse(localStorage.getItem("scores")) || [];
  scores.push(score);
  scores.sort((a, b) => b - a);
  scores = scores.slice(0, 5);
    localStorage.setItem("scores", JSON.stringify(scores));
  updateLeaderboard();
}

function particleSplash() {
  for (let i = 0; i < splashingParticleCount; i++) {
    let vel = new helpers.Vec(Math.random() * 6 - 3, Math.random() * 6 - 3);
    let position = new helpers.Vec(food.pos.x, food.pos.y);
    particles.push(new Particle(position, "#FFD700", food.size, vel));
  }
}

// 🏆 Leaderboard
function saveScore(score) {
  let scores = JSON.parse(localStorage.getItem("scores")) || [];
  scores.push(score);
  scores.sort((a, b) => b - a);
  scores = scores.slice(0, 5);
  localStorage.setItem("scores", JSON.stringify(scores));
  updateLeaderboard();
}

function updateLeaderboard() {
  let scores = JSON.parse(localStorage.getItem("scores")) || [];
  const list = document.getElementById("scores-list");
  if (!list) return;
  list.innerHTML = "";

  scores.forEach((s, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="place">${i + 1}.</span> <span class="score">${s}</span>`;
    list.appendChild(li);
  });
}

// Game Over sa modalom
function gameOver() {
  saveScore(score);
  finalScore.innerText = `"Svaki pad je prilika za novi rast." \n SCORE: ${score}`;
  modal.classList.remove("hidden");
}

// Reset igre
function reset() {
  dom_score.innerText = "00";
  score = 0;
  snake = new Snake();
  food = new Food();   // 👉 napravi novi food objekat
  KEY.resetState();
  isGameOver = false;
  cancelAnimationFrame(requestID);
  loop();
}

// Clear canvas
function clear() { CTX.clearRect(0, 0, W, H); }

// Loop
function loop() {
  clear();
  if (!isGameOver) {
    requestID = requestAnimationFrame(loop);
    helpers.drawGrid();
    snake.update();
    food.draw();
    for (let p of particles) p.update();
    helpers.garbageCollector();
  } else {
    clear();
    gameOver();
  }
}

// Inicijalizacija
function initialize() {
  CTX.imageSmoothingEnabled = false;
  KEY.listen();
  cellSize = W / cells;
  snake = new Snake();
  food = new Food();
  resizeCanvas();
  updateLeaderboard();
  loop();
}

// START dugme pokreće igru
dom_start.addEventListener("click", () => {
  initialize();
  dom_start.disabled = true; // da ne možeš ponovo da klikneš
});

// RESTART dugme
dom_replay.addEventListener("click", reset, false);

// Modal zatvaranje
closeModalBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
  reset();
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.add("hidden");
    reset();
  }
});

// ✅ Touch kontrole (sa proverom da igra radi)
document.querySelectorAll(".control-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!snake) return; // 👉 ako igra nije pokrenuta, ignoriši klik

    const dir = btn.getAttribute("data-dir");
    let step = snake.size;

    if (dir === "up" && !KEY.ArrowDown) {
      KEY.resetState();
      KEY.ArrowUp = true;
      snake.dir = new helpers.Vec(0, -step);
    }
    if (dir === "down" && !KEY.ArrowUp) {
      KEY.resetState();
      KEY.ArrowDown = true;
      snake.dir = new helpers.Vec(0, step);
    }
    if (dir === "left" && !KEY.ArrowRight) {
      KEY.resetState();
      KEY.ArrowLeft = true;
      snake.dir = new helpers.Vec(-step, 0);
    }
    if (dir === "right" && !KEY.ArrowLeft) {
      KEY.resetState();
      KEY.ArrowRight = true;
      snake.dir = new helpers.Vec(step, 0);
    }
  });
});