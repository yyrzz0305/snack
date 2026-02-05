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

  // helper: draw one pixel block inside a cell
  function pxCell(x, y, s, col) {
    fill(col);
    rect(x, y, s, s);
  }

  // Determine heading from dir
  const heading =
    dir.x === 1 ? "R" :
    dir.x === -1 ? "L" :
    dir.y === 1 ? "D" : "U";

  // colors
  const bodyCol = color(168, 108, 60);  // dachshund brown
  const darkCol = color(110, 70, 40);   // darker outline
  const earCol  = color(90, 55, 30);    // ear
  const faceCol = color(200, 150, 95);  // muzzle highlight
  const noseCol = color(30);            // nose
  const eyeCol  = color(0);

  // draw from tail to head so head overlays
  for (let i = snake.length - 1; i >= 0; i--) {
    const s = snake[i];
    const x0 = s.x * cell;
    const y0 = s.y * cell;

    // pixel size within each cell (4x4 or 5x5 look)
    const p = max(3, floor(cell / 6)); // auto scale with cell
    const pad = floor((cell - p * 5) / 2); // center a 5x5 pixel sprite
    const ox = x0 + pad;
    const oy = y0 + pad;

    // BODY segment (simple rounded-ish 5x5 block)
    // (Head/tail will override below)
    fill(bodyCol);
    rect(x0 + 2, y0 + 2, cell - 4, cell - 4, 4);

    // add a darker "back" stripe
    fill(darkCol);
    rect(x0 + 3, y0 + 3, cell - 6, max(3, floor((cell - 6) * 0.25)), 3);

    // Tail (last segment)
    if (i === snake.length - 1) {
      // tail direction: away from previous
      let tdx = 0, tdy = 0;
      if (snake.length > 1) {
        const prev = snake[i - 1];
        tdx = s.x - prev.x;
        tdy = s.y - prev.y;
      } else {
        tdx = -dir.x; tdy = -dir.y;
      }

      fill(darkCol);
      // small tail nub on edge
      if (tdx === 1) rect(x0 + cell - 4, y0 + cell / 2 - 2, 3, 4, 2);
      else if (tdx === -1) rect(x0 + 1, y0 + cell / 2 - 2, 3, 4, 2);
      else if (tdy === 1) rect(x0 + cell / 2 - 2, y0 + cell - 4, 4, 3, 2);
      else if (tdy === -1) rect(x0 + cell / 2 - 2, y0 + 1, 4, 3, 2);
      continue;
    }

    // Head (first segment)
    if (i === 0) {
      // head base
      fill(bodyCol);
      rect(x0 + 1, y0 + 1, cell - 2, cell - 2, 6);

      // muzzle + nose depending on heading
      if (heading === "R") {
        fill(faceCol);
        rect(x0 + cell - 8, y0 + cell / 2 - 4, 7, 8, 3);
        fill(noseCol);
        rect(x0 + cell - 3, y0 + cell / 2 - 1, 2, 2);

        // eye + ear
        fill(eyeCol);
        rect(x0 + cell - 12, y0 + cell / 2 - 3, 2, 2);
        fill(earCol);
        rect(x0 + cell - 14, y0 + 3, 4, 6, 2);
      } else if (heading === "L") {
        fill(faceCol);
        rect(x0 + 1, y0 + cell / 2 - 4, 7, 8, 3);
        fill(noseCol);
        rect(x0 + 1, y0 + cell / 2 - 1, 2, 2);

        fill(eyeCol);
        rect(x0 + 10, y0 + cell / 2 - 3, 2, 2);
        fill(earCol);
        rect(x0 + 10, y0 + 3, 4, 6, 2);
      } else if (heading === "D") {
        fill(faceCol);
        rect(x0 + cell / 2 - 4, y0 + cell - 8, 8, 7, 3);
        fill(noseCol);
        rect(x0 + cell / 2 - 1, y0 + cell - 3, 2, 2);

        fill(eyeCol);
        rect(x0 + cell / 2 - 3, y0 + cell - 12, 2, 2);
        fill(earCol);
        rect(x0 + 3, y0 + cell - 14, 6, 4, 2);
      } else { // "U"
        fill(faceCol);
        rect(x0 + cell / 2 - 4, y0 + 1, 8, 7, 3);
        fill(noseCol);
        rect(x0 + cell / 2 - 1, y0 + 1, 2, 2);

        fill(eyeCol);
        rect(x0 + cell / 2 - 3, y0 + 10, 2, 2);
        fill(earCol);
        rect(x0 + 3, y0 + 10, 6, 4, 2);
      }

      continue;
    }

    // Legs hint (every other body segment)
    if (i % 2 === 0) {
      fill(darkCol);
      // little feet pixels
      rect(x0 + 4, y0 + cell - 4, 4, 3, 2);
      rect(x0 + cell - 8, y0 + cell - 4, 4, 3, 2);
    }
  }
}

function drawFruit() {
  noStroke();

  const kibbleCol = color(120, 75, 40);   // brown kibble
  const highlight = color(155, 105, 65);  // lighter spot

  const cx = fruit.x * cell + cell / 2;
  const cy = fruit.y * cell + cell / 2;

  // base kibble
  fill(kibbleCol);
  ellipse(cx, cy, cell * 0.6, cell * 0.5);

  // small highlight
  fill(highlight);
  ellipse(cx - cell * 0.12, cy - cell * 0.1, cell * 0.18, cell * 0.14);

  // tiny “crumb” dots to make it feel like kibble
  fill(kibbleCol);
  rect(cx + cell * 0.15, cy + cell * 0.05, max(2, cell * 0.08), max(2, cell * 0.08), 1);
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
