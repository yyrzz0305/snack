let askButton;

// Device motion
let accX = 0, accY = 0, accZ = 0;
let rrateX = 0, rrateY = 0, rrateZ = 0;

// Device orientation
let rotateDegrees = 0; // alpha
let frontToBack = 0;   // beta
let leftToRight = 0;   // gamma

let hasPermission = false;
let isMobileDevice = true;

// --- GAME ---
let cell = 18;
let cols, rows;

let snake = [];
let snakeLen = 6;
let dir = { x: 1, y: 0 };
let pendingDir = { x: 1, y: 0 };

let moveEvery = 6;
let tick = 0;

let fruit = { x: 0, y: 0 };
let score = 0;
let gameOver = false;

// Anti jitter
let lastDirChangeMs = 0;
const DIR_COOLDOWN_MS = 140;
const TILT_THRESHOLD = 12;

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CORNER);
  textFont("monospace");

  isMobileDevice = checkMobileDevice();
  resetGame();

  // SENSOR PART
  if (
    typeof DeviceMotionEvent?.requestPermission === "function" &&
    typeof DeviceOrientationEvent?.requestPermission === "function"
  ) {
    askButton = createButton("Enable Motion Sensors");
    askButton.position(16, 16);
    askButton.id("permission-button");
    askButton.mousePressed(handlePermissionButtonPressed);
  } else {
    window.addEventListener("devicemotion", deviceMotionHandler, true);
    window.addEventListener("deviceorientation", deviceOrientationHandler, true);
    hasPermission = true;
  }
}

function draw() {
  background(245);

  drawHUD();

  if (!isMobileDevice) {
    fill(0);
    textAlign(LEFT, TOP);
    textSize(14);
    text("Desktop: use arrow keys. Mobile: tilt phone to play.", 16, 70);
  }

  if (!hasPermission && isMobileDevice) {
    fill(0);
    textAlign(LEFT, TOP);
    textSize(14);
    text("Tap the button to allow motion sensors (iOS needs permission).", 16, 70);
  }

  if (gameOver) {
    drawGameOver();
    return;
  }

  // Mobile: update dir from tilt
  if (hasPermission) {
    updateDirFromTilt();
  }

  // Desktop fallback
  if (!isMobileDevice) {
    // keep pendingDir from keyboard
  }

  tick++;
  if (tick % moveEvery === 0) {
    setDirSafely(pendingDir.x, pendingDir.y);
    stepSnake();
  }

  drawFruit();
  drawSnake();
}

// GAME

function resetGame() {
  cols = max(10, floor(width / cell));
  rows = max(10, floor(height / cell));

  snakeLen = 6;
  score = 0;
  gameOver = false;
  tick = 0;

  const sx = floor(cols / 2);
  const sy = floor(rows / 2);
  snake = [];
  for (let i = 0; i < snakeLen; i++) snake.push({ x: sx - i, y: sy });

  dir = { x: 1, y: 0 };
  pendingDir = { x: 1, y: 0 };

  spawnFruit();
}

function spawnFruit() {
  let tries = 0;
  while (tries < 3000) {
    const x = floor(random(cols));
    const y = floor(random(rows));
    let ok = true;
    for (const s of snake) {
      if (s.x === x && s.y === y) { ok = false; break; }
    }
    if (ok) { fruit.x = x; fruit.y = y; return; }
    tries++;
  }
}

function stepSnake() {
  const head = snake[0];
  const next = { x: head.x + dir.x, y: head.y + dir.y };

  if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows) {
    gameOver = true;
    return;
  }
  for (let i = 0; i < snake.length; i++) {
    if (snake[i].x === next.x && snake[i].y === next.y) {
      gameOver = true;
      return;
    }
  }

  snake.unshift(next);

  if (next.x === fruit.x && next.y === fruit.y) {
    score++;
    snakeLen += 2;
    spawnFruit();
  }

  while (snake.length > snakeLen) snake.pop();
}

function setDirSafely(nx, ny) {
  if (snake.length > 1) {
    const head = snake[0];
    const neck = snake[1];
    if (head.x + nx === neck.x && head.y + ny === neck.y) return;
  }
  dir.x = nx;
  dir.y = ny;
}

// Basic portrait/landscape compensation so it feels consistent
function getScreenAngle() {
  // Some browsers support screen.orientation.angle, some use window.orientation
  const a = (screen.orientation && typeof screen.orientation.angle === "number")
    ? screen.orientation.angle
    : (typeof window.orientation === "number" ? window.orientation : 0);
  return a || 0;
}

function updateDirFromTilt() {
  const now = millis();
  if (now - lastDirChangeMs < DIR_COOLDOWN_MS) return;

  // raw values
  let b = frontToBack;  // beta
  let g = leftToRight;  // gamma

  // compensate rotation
  const angle = getScreenAngle();
  // angle can be 0, 90, 180, 270 (or -90)
  if (angle === 90 || angle === -270) {
    // rotated right: swap axes
    const tmp = b;
    b = -g;
    g = tmp;
  } else if (angle === -90 || angle === 270) {
    // rotated left: swap axes
    const tmp = b;
    b = g;
    g = -tmp;
  } else if (angle === 180 || angle === -180) {
    // upside down: invert both
    b = -b;
    g = -g;
  }

  const ab = abs(b);
  const ag = abs(g);
  if (ab < TILT_THRESHOLD && ag < TILT_THRESHOLD) return;

  // dominant axis
  if (ag > ab) {
    // gamma: right positive
    pendingDir = g > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
  } else {
    // beta: forward positive (down on screen)
    pendingDir = b > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  }

  lastDirChangeMs = now;
}

//  DRAW

function drawSnake() {
  noStroke();
  for (let i = 0; i < snake.length; i++) {
    const s = snake[i];
    fill(i === 0 ? 30 : 80);
    rect(s.x * cell, s.y * cell, cell, cell);
  }
}

function drawFruit() {
  noStroke();
  fill(220, 60, 60);
  const x = fruit.x * cell + cell / 2;
  const y = fruit.y * cell + cell / 2;
  ellipse(x, y, cell * 0.75, cell * 0.75);
}

function drawHUD() {
  fill(0);
  textAlign(LEFT, TOP);
  textSize(14);
  text(`Score: ${score}`, 16, 16);

  textSize(12);
  text(`beta: ${frontToBack.toFixed(1)}  gamma: ${leftToRight.toFixed(1)}`, 16, 38);

  text(hasPermission ? "Sensors ON" : "Sensors OFF", 16, 54);

  if (!isMobileDevice) {
    text("Arrow keys to steer (desktop fallback).", 16, 88);
  }
}

function drawGameOver() {
  fill(0, 160);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(26);
  text("GAME OVER", width / 2, height / 2 - 20);

  textSize(14);
  text(`Score: ${score}`, width / 2, height / 2 + 10);
  text("Tap to restart", width / 2, height / 2 + 34);
}

// restart
function touchStarted() {
  if (gameOver) resetGame();
  return false;
}
function mousePressed() {
  if (gameOver) resetGame();
}

// Desktop keyboard fallback
function keyPressed() {
  if (keyCode === LEFT_ARROW) pendingDir = { x: -1, y: 0 };
  if (keyCode === RIGHT_ARROW) pendingDir = { x: 1, y: 0 };
  if (keyCode === UP_ARROW) pendingDir = { x: 0, y: -1 };
  if (keyCode === DOWN_ARROW) pendingDir = { x: 0, y: 1 };
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resetGame();
}

// SENSOR CODE

function handlePermissionButtonPressed() {
  DeviceMotionEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        hasPermission = true;
        window.addEventListener("devicemotion", deviceMotionHandler, true);
      }
    })
    .catch(console.error);

  DeviceOrientationEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        window.addEventListener("deviceorientation", deviceOrientationHandler, true);
      }
    })
    .catch(console.error);

  askButton?.remove();
}

// devicemotion
function deviceMotionHandler(event) {
  if (!event.acceleration || !event.rotationRate) return;

  accX = event.acceleration.x || 0;
  accY = event.acceleration.y || 0;
  accZ = event.acceleration.z || 0;

  rrateZ = event.rotationRate.alpha || 0;
  rrateX = event.rotationRate.beta || 0;
  rrateY = event.rotationRate.gamma || 0;
}

// deviceorientation
function deviceOrientationHandler(event) {
  rotateDegrees = event.alpha || 0;
  frontToBack = event.beta || 0;
  leftToRight = event.gamma || 0;
}

// Simple UA check
function checkMobileDevice() {
  const ua = navigator.userAgent || "";
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
}
