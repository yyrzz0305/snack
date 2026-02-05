// Create connection to Node.js Server
const socket = io();

let canvas;

let randomX;
let randomY;

let me; // for storing my socket.id
let experienceState = {
  users: {}            // socket.id -> movement data
};

// Permission button (iOS)
let askButton;
let isMobileDevice = true;
let hasPermission = false;

// Device motion
let accX = 0;
let accY = 0;
let accZ = 0;
let rrateX = 0;
let rrateY = 0;
let rrateZ = 0;

// Device orientation
let rotateDegrees = 0;
let frontToBack = 0;
let leftToRight = 0;

// throttle device motion sending
let lastSent = 0;
const SEND_RATE = 30; // ms (~33 fps)


// ======================
// SNAKE GAME VARIABLES
// ======================
let cell = 18;           // size of each grid cell (px)
let cols, rows;

let snake = [];          // array of {x,y} in grid coords
let snakeLen = 6;

let dir = { x: 1, y: 0 };        // current direction
let nextDir = { x: 1, y: 0 };    // direction from tilt
let tick = 0;
let moveEvery = 6;       // move snake every N frames

let fruit = { x: 0, y: 0 };
let score = 0;
let gameOver = false;

// tilt control
let tiltThreshold = 12;  // deadzone
// ======================


function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("sketch-container"); 

  //random position used for visualisation
  randomX = random(50,width-50);
  randomY = random(50,height-50);

  rectMode(CENTER);
  angleMode(DEGREES);
  //text styling
  textSize(16);
  textWrap(WORD);

  // simplified DESKTOP vs. MOBILE DETECTION
  isMobileDevice = checkMobileDevice();

  // init snake game grid
  initSnakeGame();

  // iOS permission handling  (=== YOUR CODE STYLE, UNCHANGED ===)
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
}

function draw() {
  background(240);

  // draw movers for everyone (your original multi-user visualisation)
  for (let id in experienceState.users) {
    if (experienceState.users[id].deviceMoves) {
      drawOthers(id);
    }
  }

  // DESKTOP MESSAGE 
  if (!isMobileDevice) {
    displayDesktopMessage();
    return;
  }

  // WAITING FOR PERMISSION 
  if (!hasPermission) {
    displayPermissionMessage();
    return;
  }

  // ======================
  // SNAKE GAME RUNS HERE
  // ======================
  runSnakeGame();

  // still send your data to server (guard for safety)
  emitData();
}



// --------------------
// Your multi-user drawing (unchanged)
// --------------------
function drawOthers(id){
  let u = experienceState.users[id];
  let motion = u.motionData;
  if (!motion) return;

  let rectHeight = map(motion.orientation.beta, -90,90,0,height);//front to back is beta

  fill(0,0,255,100);// slightly transparent
  push();
  rectMode(CORNER);
  noStroke();
  rect(motion.screenPosition.x,0,40,rectHeight);
  pop();
}


// ======================
// SNAKE GAME FUNCTIONS
// ======================
function initSnakeGame() {
  cols = floor(width / cell);
  rows = floor(height / cell);

  snakeLen = 6;
  score = 0;
  gameOver = false;
  tick = 0;

  let sx = floor(cols / 2);
  let sy = floor(rows / 2);

  snake = [];
  for (let i = 0; i < snakeLen; i++) {
    snake.push({ x: sx - i, y: sy });
  }

  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };

  spawnFruit();
}

function spawnFruit() {
  let tries = 0;
  while (tries < 2000) {
    let x = floor(random(cols));
    let y = floor(random(rows));
    let ok = true;

    for (let s of snake) {
      if (s.x === x && s.y === y) { ok = false; break; }
    }

    if (ok) {
      fruit.x = x;
      fruit.y = y;
      return;
    }
    tries++;
  }
}

function runSnakeGame() {
  // HUD
  drawSnakeHUD();

  if (gameOver) {
    drawSnakeGameOver();
    return;
  }

  // update direction from tilt (beta/gamma)
  updateSnakeDirFromTilt();

  // step movement
  tick++;
  if (tick % moveEvery === 0) {
    applyDirSafely(nextDir.x, nextDir.y);
    stepSnake();
  }

  // draw
  drawFruit();
  drawSnake();
}

function drawSnakeHUD() {
  fill(0);
  textAlign(LEFT, TOP);
  textSize(14);
  text(`Score: ${score}`, 10, 10);

  // small debug to ensure sensors are changing
  textSize(12);
  text(`beta: ${frontToBack.toFixed(1)}  gamma: ${leftToRight.toFixed(1)}`, 10, 30);

  // optional instruction
  textSize(12);
  text("Tilt to move. Tap to restart when game over.", 10, 50);
}

function updateSnakeDirFromTilt() {
  let g = leftToRight;   // gamma (L/R)
  let b = frontToBack;   // beta (F/B)

  let ag = abs(g);
  let ab = abs(b);

  // deadzone
  if (ag < tiltThreshold && ab < tiltThreshold) return;

  // dominant axis
  if (ag > ab) {
    // right positive
    if (g > tiltThreshold) nextDir = { x: 1, y: 0 };
    else if (g < -tiltThreshold) nextDir = { x: -1, y: 0 };
  } else {
    // forward/back
    if (b > tiltThreshold) nextDir = { x: 0, y: 1 };
    else if (b < -tiltThreshold) nextDir = { x: 0, y: -1 };
  }
}

function applyDirSafely(nx, ny) {
  // prevent reversing into neck
  if (snake.length > 1) {
    let head = snake[0];
    let neck = snake[1];
    if (head.x + nx === neck.x && head.y + ny === neck.y) return;
  }
  dir.x = nx;
  dir.y = ny;
}

function stepSnake() {
  let head = snake[0];
  let next = { x: head.x + dir.x, y: head.y + dir.y };

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

  snake.unshift(next);

  // eat fruit
  if (next.x === fruit.x && next.y === fruit.y) {
    score++;
    snakeLen += 2;
    spawnFruit();
  }

  while (snake.length > snakeLen) snake.pop();
}

function drawSnake() {
  noStroke();

  // background grid feel (subtle)
  push();
  stroke(230);
  strokeWeight(1);
  for (let x = 0; x < width; x += cell) line(x, 0, x, height);
  for (let y = 0; y < height; y += cell) line(0, y, width, y);
  pop();

  // snake
  for (let i = 0; i < snake.length; i++) {
    let s = snake[i];
    if (i === 0) fill(30);
    else fill(80);

    rect(s.x * cell, s.y * cell, cell, cell);
  }
}

function drawFruit() {
  noStroke();
  fill(220, 60, 60);
  ellipse(fruit.x * cell + cell / 2, fruit.y * cell + cell / 2, cell * 0.75);
}

function drawSnakeGameOver() {
  fill(0, 160);
  rectMode(CORNER);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(28);
  text("GAME OVER", width / 2, height / 2 - 20);

  textSize(14);
  text(`Score: ${score}`, width / 2, height / 2 + 12);
  text("Tap to restart", width / 2, height / 2 + 36);

  rectMode(CENTER);
}

function touchStarted() {
  if (gameOver) {
    initSnakeGame();
  }
  return false;
}

function mousePressed() {
  if (gameOver) {
    initSnakeGame();
  }
}



// SEND DATA TO SERVER (kept, but safe-guarded)
function emitData(){
  // throttle
  let now = millis();
  if (now - lastSent < SEND_RATE){
    return;
  } 
  lastSent = now;

  let myMotionData = {
    screenPosition: { 
      x: randomX,
      y: randomY
    },
    acceleration: {
      x: accX,
      y: accY,
      z: accZ,
    },
    rotationRate: {
      alpha: rrateZ,
      beta: rrateX,
      gamma: rrateY,
    },
    orientation: {
      alpha: rotateDegrees,
      beta: frontToBack,
      gamma: leftToRight,
    }
  };

  // update experience state in my browser (guard)
  if (me && experienceState.users[me]) {
    experienceState.users[me].deviceMoves = true;
    experienceState.users[me].motionData = myMotionData;
  }

  socket.emit("motionData", myMotionData);
}

//not mobile message
function displayDesktopMessage() {
  fill(0);
  textAlign(CENTER);
  let message = "This is a mobile experience. Please also open this URL on your phone’s browser.";
  text(message, width / 2, 30, width);//4th parameter to get text to wrap to new line if wider than canvas
}

function displayPermissionMessage() {
  fill(0);
  textAlign(CENTER);
  let message = "Waiting for motion sensor permission, click the button to allow.";
  text(message, width / 2, 30, width);//4th parameter to get text to wrap to new line if wider than canvas
}

// --------------------
// Socket events
// --------------------

// initial full state
socket.on("init", (data) => {
  me = data.id;
  experienceState = data.state;
  console.log(experienceState);
});

// someone joined
socket.on("userJoined", (data) => {
  experienceState.users[data.id] = data.user;
});

// someone left
socket.on("userLeft", (id) => {
  delete experienceState.users[id];
});

// someone moved
socket.on("userMoved", (data) => {
  let id = data.id;
  if (experienceState.users[id]) {
    experienceState.users[id].deviceMoves = data.deviceMoves;
    experienceState.users[id].motionData = data.motion;
  }
});

// --------------------
// Permission handling (=== YOUR CODE, UNCHANGED ===)
// --------------------
function handlePermissionButtonPressed() {
  DeviceMotionEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        //permission granted
        hasPermission = true;

        window.addEventListener(
          "devicemotion",
          deviceMotionHandler,
          true
        );
      }
    })
    .catch(console.error);

  DeviceOrientationEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        window.addEventListener(
          "deviceorientation",
          deviceOrientationHandler,
          true
        );
      }
    })
    .catch(console.error);

  askButton.remove();
}

// --------------------
// Window Resize
// --------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initSnakeGame();
}

// --------------------
// Sensor handlers (=== YOUR CODE, UNCHANGED ===)
// --------------------
// https://developer.mozilla.org/en-US/docs/Web/API/Window/devicemotion_event
function deviceMotionHandler(event) {
  if (!event.acceleration || !event.rotationRate){
    return;
  }

  //acceleration in meters per second
  accX = event.acceleration.x || 0;
  accY = event.acceleration.y || 0;
  accZ = event.acceleration.z || 0;

  //degrees per second
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

// --------------------
// Mobile Device Check
// --------------------
function checkMobileDevice() {
  let userAgent = navigator.userAgent;
  let mobileRegex = /Mobi|Android|iPhone|iPad|iPod/i;
  return mobileRegex.test(userAgent);
}
