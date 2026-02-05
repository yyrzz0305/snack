// global variables
let askButton;

// device motion
let accX = 0, accY = 0, accZ = 0;
let rrateX = 0, rrateY = 0, rrateZ = 0;

// device orientation
let rotateDegrees = 0;
let frontToBack = 0;  // beta
let leftToRight = 0;  // gamma

// permission state
let hasPermission = false;

// --- GAME ---
let cell = 18;            // grid size in px
let cols, rows;

let snake = [];           // array of {x,y} in grid coords
let snakeLen = 6;
let dir = { x: 1, y: 0 }; // current direction
let pendingDir = { x: 1, y: 0 }; // next direction (from tilt)
let moveEvery = 6;        // frames per move
let tick = 0;

let fruit = { x: 0, y: 0 };
let score = 0;
let gameOver = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CORNER);
  textFont("monospace");

  resetGame();

  // ---- SENSOR PART (kept in YOUR style) ----
  if (
    typeof DeviceMotionEvent.requestPermission === "function" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    // iOS 13+
    askButton = createButton("Permission");
    askButton.position(16, 16);
    askButton.mousePressed(handlePermissionButtonPressed);
  } else {
    // devices that don't require permission
    window.addEventListener("devicemotion", deviceMotionHandler, true);
    window.addEventListener("deviceorientation", deviceOrientationHandler, true);
    hasPermission = true;
  }
  // -----------------------------------------
}

function draw() {
  background(245);

  drawHUD();

  if (!hasPermission) {
    fill(0);
    textAlign(LEFT, TOP);
    textSize(14);
    text("Tap 'Permission' to enable motion/orientation.", 16, 70);
    // still show static game screen
  }

  if (gameOver) {
    drawGameOver();
    return;
  }

  // update direction from tilt (only when permission is on)
  if (hasPermission) updateDirFromTilt();

  // move snake on a grid
  tick++;
  if (tick % moveEvery === 0) {
    // apply pending direction safely
    setDirSafely(pendingDir.x, pendingDir.y);
    stepSnake();
  }

  drawFruit();
  drawSnake();
}

// ------------------- GAME -------------------

function resetGame() {
  cols = floor(width / cell);
  rows = floor(height / cell);

  snakeLen = 6;
  score = 0;
  gameOver = false;

  // start centered
  const sx = floor(cols / 2);
  const sy = floor(rows / 2);
  snake = [];
  for (let i = 0; i < snakeLen; i++) {
    snake.push({ x: sx - i, y: sy });
  }
  dir = { x: 1, y: 0 };
  pendingDir = { x: 1, y: 0 };

  spawnFruit();
}

function spawnFruit() {
  // pick an empty cell
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
      fruit.x = x;
      fruit.y = y;
      return;
    }
    tries++;
  }
}

function stepSnake() {
  const head = snake[0];
  const next = { x: head.x + dir.x, y: head.y + dir.y };

  // wall collision
  if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows) {
    gameOver = true;
    return;
  }

  // self collision
  for (let i = 0; i < snake.length; i++) {
    if (snake[i].x === next.x && snake[i].y === next.y) {
      gameOver = true;
      return;
    }
  }

  // move
  snake.unshift(next);

  // eat fruit
  if (next.x === fruit.x && next.y === fruit.y) {
    score++;
    snakeLen += 2;
    spawnFruit();
  }

  // trim
  while (snake.length > snakeLen) snake.pop();
}

function setDirSafely(nx, ny) {
  // prevent reversing into itself
  if (snake.length > 1) {
    const head = snake[0];
    const neck = snake[1];
    if (head.x + nx === neck.x && head.y + ny === neck.y) return;
  }
  dir.x = nx;
  dir.y = ny;
}

function updateDirFromTilt() {
  // Use YOUR orientation vars:
  // leftToRight = gamma, frontToBack = beta
  const g = leftToRight;
  const b = frontToBack;

  // deadzone to avoid jitter
  const threshold = 12;

  const ag = abs(g);
  const ab = abs(b);

  if (ag < threshold && ab < threshold) return;

  // choose dominant axis
  if (ag > ab) {
    // gamma: right positive
    pendingDir = g > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
  } else {
    // beta: tilt forward/back
    pendingDir = b > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  }
}

// ------------------- DRAW -------------------

function drawSnake() {
  noStroke();
  for (let i = 0; i < snake.length; i++) {
    const s = snake[i];
    if (i === 0) fill(30);
    else fill(80);
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

  if (!hasPermission) {
    text("Sensors OFF", 16, 54);
  } else {
    text("Sensors ON", 16, 54);
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
  if (gameOver) {
    resetGame();
  }
  return false;
}
function mousePressed() {
  if (gameOver) {
    resetGame();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resetGame(); // recalc grid based on new size
}

// ------------------- YOUR SENSOR CODE (UNCHANGED STYLE) -------------------

function handlePermissionButtonPressed() {
  DeviceMotionEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        hasPermission = true;
        window.addEventListener("devicemotion", deviceMotionHandler, true);
      }
    });

  DeviceOrientationEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        window.addEventListener("deviceorientation", deviceOrientationHandler, true);
      }
    })
    .catch(console.error);

  askButton.remove();
}

// https://developer.mozilla.org/en-US/docs/Web/API/Window/devicemotion_event
function deviceMotionHandler(event) {
  if (!event.acceleration || !event.rotationRate) {
    return;
  }

  accX = event.acceleration.x || 0;
  accY = event.acceleration.y || 0;
  accZ = event.acceleration.z || 0;

  rrateZ = event.rotationRate.alpha || 0;
  rrateX = event.rotationRate.beta || 0;
  rrateY = event.rotationRate.gamma || 0;
}

// https://developer.mozilla.org/en-US/docs/Web/API/Window/deviceorientation_event
function deviceOrientationHandler(event) {
  rotateDegrees = event.alpha || 0;
  frontToBack = event.beta || 0;
  leftToRight = event.gamma || 0;
}
