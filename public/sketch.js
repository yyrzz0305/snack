// Snake eats fruit (mobile sensors) - p5.js

let askButton;

// device motion (optional use)
let accX = 0, accY = 0, accZ = 0;

// device orientation
let frontToBack = 0;  // beta
let leftToRight = 0;  // gamma

// game
let snake = [];
let snakeLen = 8;
let head;
let dir = { x: 1, y: 0 }; // moving direction
let cell = 16;           // grid size
let speed = 6;           // frames per move (bigger = slower)
let tick = 0;
let score = 0;
let gameOver = false;

let fruit;

function setup() {
  createCanvas(400, 400);
  rectMode(CORNER);
  textFont("monospace");

  // init snake in center
  const cols = floor(width / cell);
  const rows = floor(height / cell);
  head = { x: floor(cols / 2), y: floor(rows / 2) };
  snake = [];
  for (let i = 0; i < snakeLen; i++) {
    snake.push({ x: head.x - i, y: head.y });
  }

  spawnFruit();

  // Permission handling (iOS 13+)
  if (
    typeof DeviceMotionEvent?.requestPermission === "function" &&
    typeof DeviceOrientationEvent?.requestPermission === "function"
  ) {
    askButton = createButton("Permission");
    askButton.position(10, 10);
    askButton.size(120, 40);
    askButton.mousePressed(handlePermissionButtonPressed);
  } else {
    window.addEventListener("devicemotion", deviceMotionHandler, true);
    window.addEventListener("deviceorientation", deviceTurnedHandler, true);
  }
}

function draw() {
  background(245);

  drawUI();

  if (gameOver) {
    drawGameOver();
    return;
  }

  // update direction from tilt
  updateDirFromTilt();

  // fruit drifting a bit (continuous pos)
  updateFruitDrift();

  // snake step on a grid
  tick++;
  if (tick % speed === 0) {
    stepSnake();
  }

  drawFruit();
  drawSnake();
}

// ---------- UI ----------
function drawUI() {
  fill(20);
  textSize(14);
  text(`Score: ${score}`, 10, height - 12);

  // debug tilt
  textSize(12);
  text(`tilt gamma(LR): ${leftToRight.toFixed(1)}`, 10, 70);
  text(`tilt beta(FB):  ${frontToBack.toFixed(1)}`, 10, 90);
}

// ---------- Controls ----------
function updateDirFromTilt() {
  // gamma: left(-) to right(+)
  // beta:  front-to-back (screen toward you is +)
  // Use thresholds to avoid jitter.
  const g = leftToRight;
  const b = frontToBack;

  // choose the stronger axis
  const absG = abs(g);
  const absB = abs(b);

  const threshold = 12; // tilt sensitivity

  if (absG < threshold && absB < threshold) return;

  if (absG > absB) {
    // left/right
    if (g > threshold) setDir(1, 0);
    else if (g < -threshold) setDir(-1, 0);
  } else {
    // front/back (screen tilt)
    if (b > threshold) setDir(0, 1);
    else if (b < -threshold) setDir(0, -1);
  }
}

function setDir(x, y) {
  // prevent reversing into itself
  if (snake.length > 1) {
    const nextX = snake[0].x + x;
    const nextY = snake[0].y + y;
    if (nextX === snake[1].x && nextY === snake[1].y) return;
  }
  dir.x = x;
  dir.y = y;
}

// ---------- Game logic ----------
function stepSnake() {
  const cols = floor(width / cell);
  const rows = floor(height / cell);

  const newHead = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // wall collision
  if (newHead.x < 0 || newHead.x >= cols || newHead.y < 0 || newHead.y >= rows) {
    gameOver = true;
    return;
  }

  // self collision
  for (let i = 0; i < snake.length; i++) {
    if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
      gameOver = true;
      return;
    }
  }

  // move
  snake.unshift(newHead);

  // check fruit eaten (fruit has float position, compare to grid cell)
  const fruitCellX = floor(fruit.x);
  const fruitCellY = floor(fruit.y);

  if (newHead.x === fruitCellX && newHead.y === fruitCellY) {
    score += 1;
    snakeLen += 3;
    spawnFruit();
  }

  // trim
  while (snake.length > snakeLen) snake.pop();
}

function spawnFruit() {
  const cols = floor(width / cell);
  const rows = floor(height / cell);

  // find empty cell
  let tries = 0;
  while (tries < 2000) {
    const x = floor(random(cols));
    const y = floor(random(rows));
    let ok = true;
    for (const s of snake) {
      if (s.x === x && s.y === y) {
        ok = false;
        break;
      }
    }
    if (ok) {
      fruit = {
        x: x + 0.0, // float for drifting
        y: y + 0.0,
        vx: random(-0.03, 0.03),
        vy: random(-0.03, 0.03),
      };
      return;
    }
    tries++;
  }
}

function updateFruitDrift() {
  if (!fruit) return;

  const cols = floor(width / cell);
  const rows = floor(height / cell);

  // drift
  fruit.x += fruit.vx;
  fruit.y += fruit.vy;

  // bounce softly in bounds
  if (fruit.x < 0) { fruit.x = 0; fruit.vx *= -1; }
  if (fruit.y < 0) { fruit.y = 0; fruit.vy *= -1; }
  if (fruit.x > cols - 0.01) { fruit.x = cols - 0.01; fruit.vx *= -1; }
  if (fruit.y > rows - 0.01) { fruit.y = rows - 0.01; fruit.vy *= -1; }
}

// ---------- Drawing ----------
function drawSnake() {
  noStroke();
  for (let i = 0; i < snake.length; i++) {
    const s = snake[i];
    if (i === 0) fill(30);      // head
    else fill(80);              // body
    rect(s.x * cell, s.y * cell, cell, cell, 4);
  }
}

function drawFruit() {
  const fx = floor(fruit.x) * cell;
  const fy = floor(fruit.y) * cell;
  noStroke();
  fill(220, 60, 60);
  ellipse(fx + cell / 2, fy + cell / 2, cell * 0.8, cell * 0.8);
}

function drawGameOver() {
  fill(0, 180);
  rect(0, 0, width, height);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(24);
  text("GAME OVER", width / 2, height / 2 - 20);
  textSize(14);
  text("Tap to restart", width / 2, height / 2 + 16);
}

// tap to restart
function touchStarted() {
  if (gameOver) restartGame();
  return false;
}
function mousePressed() {
  if (gameOver) restartGame();
}

function restartGame() {
  score = 0;
  gameOver = false;
  snakeLen = 8;

  const cols = floor(width / cell);
  const rows = floor(height / cell);
  head = { x: floor(cols / 2), y: floor(rows / 2) };
  snake = [];
  for (let i = 0; i < snakeLen; i++) {
    snake.push({ x: head.x - i, y: head.y });
  }
  dir = { x: 1, y: 0 };
  spawnFruit();
}

// ---------- Permissions + Sensors ----------
// simplified DESKTOP vs. MOBILE DETECTION
  isMobileDevice = checkMobileDevice();

  // iOS permission handling
  if (
    typeof DeviceMotionEvent.requestPermission === "function" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    //add a button for permissions
    askButton = createButton("Enable Motion Sensors");
    askButton.parent("sketch-container");
    askButton.id("permission-button"); // to add special styling for this button in style.css
    askButton.mousePressed(handlePermissionButtonPressed);
  } else {
    // Android / non-permission devices
    window.addEventListener("devicemotion", deviceMotionHandler, true);
    window.addEventListener("deviceorientation", deviceOrientationHandler, true);
    hasPermission = true;
  }


function deviceMotionHandler(event) {
  if (!event.acceleration) return;
  accX = event.acceleration.x || 0;
  accY = event.acceleration.y || 0;
  accZ = event.acceleration.z || 0;
}

function deviceTurnedHandler(event) {
  frontToBack = event.beta ?? 0;
  leftToRight = event.gamma ?? 0;
}
