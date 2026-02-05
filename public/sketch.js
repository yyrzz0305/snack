// ====== GYRO SNAKE (p5.js) ======
// iPhone: tap button to request permission
// Control: tilt phone (beta/gamma) to steer
// Includes: robust iOS permission handling + calibration button + anti-jitter
// ===============================

// ------------------ GLOBALS ------------------
let askButton;
let calibButton;

// Device motion
let accX = 0, accY = 0, accZ = 0;
let rrateX = 0, rrateY = 0, rrateZ = 0;

// Device orientation
let rotateDegrees = 0; // alpha
let frontToBack = 0;   // beta
let leftToRight = 0;   // gamma

let hasPermission = false;
let isMobileDevice = true;

// Calibration (zero offsets)
let zeroBeta = 0;
let zeroGamma = 0;
let hasCalibrated = false;

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

// ------------------ SETUP / DRAW ------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CORNER);
  textFont("monospace");

  isMobileDevice = checkMobileDevice();
  resetGame();

  setupSensorUI();
}

function draw() {
  background(245);

  drawHUD();

  // Desktop note
  if (!isMobileDevice) {
    fill(0);
    textAlign(LEFT, TOP);
    textSize(14);
    text("Desktop: use arrow keys. Mobile: tilt phone to play.", 16, 92);
  }

  // Waiting permission note
  if (!hasPermission && isMobileDevice) {
    fill(0);
    textAlign(LEFT, TOP);
    textSize(14);
    text("Tap 'Enable Motion Sensors' to allow sensor access (iOS needs permission).", 16, 92);
  }

  if (gameOver) {
    drawGameOver();
    return;
  }

  // Update direction from tilt
  if (hasPermission) updateDirFromTilt();

  // Move snake on grid
  tick++;
  if (tick % moveEvery === 0) {
    setDirSafely(pendingDir.x, pendingDir.y);
    stepSnake();
  }

  drawFruit();
  drawSnake();
}

// ------------------ SENSOR UI ------------------
function setupSensorUI() {
  const needsIOSPermission =
    typeof DeviceMotionEvent?.requestPermission === "function" ||
    typeof DeviceOrientationEvent?.requestPermission === "function";

  if (needsIOSPermission) {
    askButton = createButton("Enable Motion Sensors");
    styleTopButton(askButton, 16, 16);
    askButton.id("permission-button");
    askButton.mousePressed(handlePermissionButtonPressed);
  } else {
    // Android / non-permission devices
    window.addEventListener("devicemotion", deviceMotionHandler, true);
    window.addEventListener("deviceorientation", deviceOrientationHandler, true);
    hasPermission = true;
  }

  // Calibration button (works after sensors start)
  calibButton = createButton("Calibrate (hold phone neutral)");
  styleTopButton(calibButton, 16, 60);
  calibButton.mousePressed(() => {
    zeroBeta = frontToBack;
    zeroGamma = leftToRight;
    hasCalibrated = true;
  });
}

function styleTopButton(btn, x, y) {
  btn.position(x, y);
  btn.style("position", "fixed");
  btn.style("z-index", "9999");
  btn.style("padding", "12px 16px");
  btn.style("font-size", "16px");
  btn.style("border", "1px solid #222");
  btn.style("border-radius", "10px");
  btn.style("background", "#fff");
}

// iOS permission request (robust, sequential await)
async function handlePermissionButtonPressed() {
  try {
    // Motion
    if (typeof DeviceMotionEvent?.requestPermission === "function") {
      const r1 = await DeviceMotionEvent.requestPermission();
      if (r1 === "granted") {
        window.addEventListener("devicemotion", deviceMotionHandler, true);
      }
    } else {
      window.addEventListener("devicemotion", deviceMotionHandler, true);
    }

    // Orientation
    if (typeof DeviceOrientationEvent?.requestPermission === "function") {
      const r2 = await DeviceOrientationEvent.requestPermission();
      if (r2 === "granted") {
        window.addEventListener("deviceorientation", deviceOrientationHandler, true);
      }
    } else {
      window.addEventListener("deviceorientation", deviceOrientationHandler, true);
    }

    // Snake control mainly needs orientation, but we treat success as permission enabled
    hasPermission = true;
    askButton?.remove();
  } catch (e) {
    console.error(e);
  }
}

// ------------------ SENSOR HANDLERS ------------------
function deviceMotionHandler(event) {
  // iOS sometimes gives null values; keep your strict style (no accelIncludingGravity fallback)
  if (!event.acceleration || !event.rotationRate) return;

  accX = event.acceleration.x || 0;
  accY = event.acceleration.y || 0;
  accZ = event.acceleration.z || 0;

  rrateZ = event.rotationRate.alpha || 0;
  rrateX = event.rotationRate.beta || 0;
  rrateY = event.rotationRate.gamma || 0;
}

function deviceOrientationHandler(event) {
  rotateDegrees = event.alpha || 0;
  frontToBack = event.beta || 0;
  leftToRight = event.gamma || 0;
}

// ------------------ GAME ------------------
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

// ------------------ GYRO CONTROL ------------------
// Basic portrait/landscape compensation so it feels consistent
function getScreenAngle() {
  const a = (screen.orientation && typeof screen.orientation.angle === "number")
    ? screen.orientation.angle
    : (typeof window.orientation === "number" ? window.orientation : 0);
  return a || 0;
}

function updateDirFromTilt() {
  const now = millis();
  if (now - lastDirChangeMs < DIR_COOLDOWN_MS) return;

  // apply calibration offsets
  let b = frontToBack - (hasCalibrated ? zeroBeta : 0);  // beta
  let g = leftToRight - (hasCalibrated ? zeroGamma : 0); // gamma

  // compensate screen rotation
  const angle = getScreenAngle();
  if (angle === 90 || angle === -270) {
    const tmp = b;
    b = -g;
    g = tmp;
  } else if (angle === -90 || angle === 270) {
    const tmp = b;
    b = g;
    g = -tmp;
  } else if (angle === 180 || angle === -180) {
    b = -b;
    g = -g;
  }

  const ab = abs(b);
  const ag = abs(g);
  if (ab < TILT_THRESHOLD && ag < TILT_THRESHOLD) return;

  // choose dominant axis
  if (ag > ab) {
    pendingDir = g > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
  } else {
    pendingDir = b > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  }

  lastDirChangeMs = now;
}

// ------------------ DRAW ------------------
function drawSnake() {
  noStroke();

  // Determine heading from dir
  const heading =
    dir.x === 1 ? "R" :
    dir.x === -1 ? "L" :
    dir.y === 1 ? "D" : "U";

  // colors
  const bodyCol = color(168, 108, 60);
  const darkCol = color(110, 70, 40);
  const earCol  = color(90, 55, 30);
  const faceCol = color(200, 150, 95);
  const noseCol = color(30);
  const eyeCol  = color(0);

  // draw from tail to head so head overlays
  for (let i = snake.length - 1; i >= 0; i--) {
    const s = snake[i];
    const x0 = s.x * cell;
    const y0 = s.y * cell;

    // BODY segment
    fill(bodyCol);
    rect(x0 + 2, y0 + 2, cell - 4, cell - 4, 4);

    // darker stripe
    fill(darkCol);
    rect(x0 + 3, y0 + 3, cell - 6, max(3, floor((cell - 6) * 0.25)), 3);

    // Tail
    if (i === snake.length - 1) {
      let tdx = 0, tdy = 0;
      if (snake.length > 1) {
        const prev = snake[i - 1];
        tdx = s.x - prev.x;
        tdy = s.y - prev.y;
      } else {
        tdx = -dir.x; tdy = -dir.y;
      }
      fill(darkCol);
      if (tdx === 1) rect(x0 + cell - 4, y0 + cell / 2 - 2, 3, 4, 2);
      else if (tdx === -1) rect(x0 + 1, y0 + cell / 2 - 2, 3, 4, 2);
      else if (tdy === 1) rect(x0 + cell / 2 - 2, y0 + cell - 4, 4, 3, 2);
      else if (tdy === -1) rect(x0 + cell / 2 - 2, y0 + 1, 4, 3, 2);
      continue;
    }

    // Head
    if (i === 0) {
      fill(bodyCol);
      rect(x0 + 1, y0 + 1, cell - 2, cell - 2, 6);

      if (heading === "R") {
        fill(faceCol); rect(x0 + cell - 8, y0 + cell / 2 - 4, 7, 8, 3);
        fill(noseCol); rect(x0 + cell - 3, y0 + cell / 2 - 1, 2, 2);
        fill(eyeCol);  rect(x0 + cell - 12, y0 + cell / 2 - 3, 2, 2);
        fill(earCol);  rect(x0 + cell - 14, y0 + 3, 4, 6, 2);
      } else if (heading === "L") {
        fill(faceCol); rect(x0 + 1, y0 + cell / 2 - 4, 7, 8, 3);
        fill(noseCol); rect(x0 + 1, y0 + cell / 2 - 1, 2, 2);
        fill(eyeCol);  rect(x0 + 10, y0 + cell / 2 - 3, 2, 2);
        fill(earCol);  rect(x0 + 10, y0 + 3, 4, 6, 2);
      } else if (heading === "D") {
        fill(faceCol); rect(x0 + cell / 2 - 4, y0 + cell - 8, 8, 7, 3);
        fill(noseCol); rect(x0 + cell / 2 - 1, y0 + cell - 3, 2, 2);
        fill(eyeCol);  rect(x0 + cell / 2 - 3, y0 + cell - 12, 2, 2);
        fill(earCol);  rect(x0 + 3, y0 + cell - 14, 6, 4, 2);
      } else {
        fill(faceCol); rect(x0 + cell / 2 - 4, y0 + 1, 8, 7, 3);
        fill(noseCol); rect(x0 + cell / 2 - 1, y0 + 1, 2, 2);
        fill(eyeCol);  rect(x0 + cell / 2 - 3, y0 + 10, 2, 2);
        fill(earCol);  rect(x0 + 3, y0 + 10, 6, 4, 2);
      }
      continue;
    }

    // Legs hint
    if (i % 2 === 0) {
      fill(darkCol);
      rect(x0 + 4, y0 + cell - 4, 4, 3, 2);
      rect(x0 + cell - 8, y0 + cell - 4, 4, 3, 2);
    }
  }
}

function drawFruit() {
  noStroke();

  const kibbleCol = color(120, 75, 40);
  const highlight = color(155, 105, 65);

  const cx = fruit.x * cell + cell / 2;
  const cy = fruit.y * cell + cell / 2;

  fill(kibbleCol);
  ellipse(cx, cy, cell * 0.6, cell * 0.5);

  fill(highlight);
  ellipse(cx - cell * 0.12, cy - cell * 0.1, cell * 0.18, cell * 0.14);

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

  textSize(12);
  text(hasCalibrated ? "Calibrated: YES" : "Calibrated: NO", 16, 70);
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

// ------------------ INPUT / RESIZE ------------------
function touchStarted() {
  if (gameOver) resetGame();
  return false;
}

function mousePressed() {
  if (gameOver) resetGame();
}

function keyPressed() {
  // Desktop fallback
  if (keyCode === LEFT_ARROW) pendingDir = { x: -1, y: 0 };
  if (keyCode === RIGHT_ARROW) pendingDir = { x: 1, y: 0 };
  if (keyCode === UP_ARROW) pendingDir = { x: 0, y: -1 };
  if (keyCode === DOWN_ARROW) pendingDir = { x: 0, y: 1 };
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  resetGame();
}

// ------------------ UTILS ------------------
function checkMobileDevice() {
  const ua = navigator.userAgent || "";
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
}
