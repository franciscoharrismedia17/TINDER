const WIDTH = 1080;
const HEIGHT = 1920;

const STATES = {
  BEGIN: "BEGIN",
  PLAY1: "PLAY1",
  MATCH: "MATCH",
  PLAY2: "PLAY2"
};

let currentState = STATES.BEGIN;

let canvas;
let imgBegin;
let imgAnne;
let imgEmily;
let imgLauren;
let imgMatch;

let initialProfiles = [];
let deck = [];
let currentCardIndex = 0;
let activeCard = null;
let lauraMatched = false;
let matchSwipeActive = false;
let matchSwipeStartX = 0;

let lastPointerX = WIDTH / 2;
let lastPointerY = HEIGHT / 2;
let touchInProgress = false;

function preload() {
  imgBegin = loadImage("BEGIN.png");
  imgAnne = loadImage("Anne.png");
  imgEmily = loadImage("Emily.png");
  imgLauren = loadImage("LAUREN.png");
  imgMatch = loadImage("match_n1_1.png");
}

function setup() {
  pixelDensity(1);
  canvas = createCanvas(WIDTH, HEIGHT);
  canvas.parent("app");
  imageMode(CENTER);
  textFont("Helvetica Neue, Arial, sans-serif");
  textSize(36);
  noStroke();
  fitCanvasCSS();

  initialProfiles = [
    { name: "Anne", img: imgAnne, isLaura: false },
    { name: "Emily", img: imgEmily, isLaura: false },
    { name: "Lauren", img: imgLauren, isLaura: true }
  ];
}

function windowResized() {
  fitCanvasCSS();
}

function fitCanvasCSS() {
  if (!canvas) return;
  const scale = Math.min(windowWidth / WIDTH, windowHeight / HEIGHT);
  const styledWidth = `${WIDTH * scale}px`;
  const styledHeight = `${HEIGHT * scale}px`;
  const element = canvas.elt;
  element.style.width = styledWidth;
  element.style.height = styledHeight;
  const container = document.getElementById("app");
  if (container) {
    container.style.width = styledWidth;
    container.style.height = styledHeight;
  }
}

function draw() {
  background(0);
  noTint();

  if (currentState === STATES.BEGIN) {
    drawImageCover(imgBegin, WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT);
  } else if (currentState === STATES.PLAY1 || currentState === STATES.PLAY2) {
    if (activeCard) {
      activeCard.update();
      activeCard.draw();
      if (activeCard.isFinished()) {
        activeCard = null;
        handleFinishedCard();
      }
    }
  } else if (currentState === STATES.MATCH) {
    resetMatrix();
    noTint();
    imageMode(CORNER);
    image(imgMatch, 0, 0, WIDTH, HEIGHT);
    imageMode(CENTER);
  }

  drawDebugOverlay();
}

function drawDebugOverlay() {
  push();
  resetMatrix();
  const hasCard = Boolean(activeCard);
  const name = hasCard ? (activeCard.data.name || "-") : "-";
  const indexText = hasCard ? currentCardIndex : "-";
  fill(255);
  textAlign(LEFT, TOP);
  text(`state: ${currentState}\nindex: ${indexText}\nname: ${name}`, 24, 24);
  pop();
}

function startPlay1() {
  currentState = STATES.PLAY1;
  deck = [initialProfiles[0], initialProfiles[1], initialProfiles[2]];
  currentCardIndex = 0;
  activeCard = new Card(deck[currentCardIndex]);
}

function startPlay2() {
  currentState = STATES.PLAY2;
  deck = [initialProfiles[0], initialProfiles[1]];
  currentCardIndex = 0;
  activeCard = new Card(deck[currentCardIndex]);
}

function enterMatch() {
  console.log("Entrando a MATCH");
  currentState = STATES.MATCH;
  activeCard = null;
  matchSwipeActive = false;
  matchSwipeStartX = 0;
}

function exitMatch() {
  console.log("Saliendo de MATCH → PLAY2");
  lauraMatched = true;
  startPlay2();
}

function handleFinishedCard() {
  if (currentState === STATES.PLAY1 || currentState === STATES.PLAY2) {
    advanceToNextCard();
  }
}

function advanceToNextCard() {
  if (!deck || deck.length === 0) {
    activeCard = null;
    return;
  }
  currentCardIndex = (currentCardIndex + 1) % deck.length;
  activeCard = new Card(deck[currentCardIndex]);
}

function isLauraCard(data) {
  if (!data) return false;
  if (data.isLaura === true) return true;
  if (data.img === imgLauren) return true;
  const name = (data.name || "").toLowerCase();
  return name.includes("laur");
}

function handlePointerDown(x, y) {
  lastPointerX = x;
  lastPointerY = y;

  if (currentState === STATES.BEGIN) {
    lauraMatched = false;
    startPlay1();
    return;
  }

  if (currentState === STATES.MATCH) {
    matchSwipeActive = true;
    matchSwipeStartX = x;
    return;
  }

  if ((currentState === STATES.PLAY1 || currentState === STATES.PLAY2) && activeCard && activeCard.canInteract()) {
    activeCard.startDrag(x, y);
  }
}

function handlePointerMove(x, y) {
  lastPointerX = x;
  lastPointerY = y;

  if ((currentState === STATES.PLAY1 || currentState === STATES.PLAY2) && activeCard) {
    activeCard.drag(x, y);
  }
}

function handlePointerUp(x, y) {
  lastPointerX = x;
  lastPointerY = y;

  if (currentState === STATES.MATCH) {
    if (matchSwipeActive) {
      const dx = x - matchSwipeStartX;
      if (dx >= 120) {
        exitMatch();
      }
      matchSwipeActive = false;
      matchSwipeStartX = 0;
    }
    return;
  }

  if ((currentState === STATES.PLAY1 || currentState === STATES.PLAY2) && activeCard) {
    const outcome = activeCard.computeOutcome();
    if (outcome === "like") {
      console.log("LIKE en", activeCard?.data?.name, "state:", currentState);
    }
    if (
      outcome === "like" &&
      currentState === STATES.PLAY1 &&
      !lauraMatched &&
      isLauraCard(activeCard.data)
    ) {
      activeCard.cancelForImmediateMatch();
      enterMatch();
      return;
    }
    activeCard.release(outcome);
  }
}

function touchStarted() {
  if (!touches.length) return false;
  touchInProgress = true;
  const t = touches[0];
  const p = getCanvasCoords(t.clientX, t.clientY);
  handlePointerDown(p.x, p.y);
  return false;
}

function touchMoved() {
  if (!touches.length) return false;
  const t = touches[0];
  const p = getCanvasCoords(t.clientX, t.clientY);
  handlePointerMove(p.x, p.y);
  return false;
}

function touchEnded() {
  const t = touches.length ? touches[0] : null;
  if (t) {
    const p = getCanvasCoords(t.clientX, t.clientY);
    handlePointerUp(p.x, p.y);
  } else {
    handlePointerUp(lastPointerX, lastPointerY);
  }
  touchInProgress = touches.length > 0;
  return false;
}

function mousePressed(event) {
  if (touchInProgress) return false;
  const p = getCanvasCoords(event.clientX, event.clientY);
  handlePointerDown(p.x, p.y);
  return false;
}

function mouseDragged(event) {
  if (touchInProgress) return false;
  const p = getCanvasCoords(event.clientX, event.clientY);
  handlePointerMove(p.x, p.y);
  return false;
}

function mouseReleased(event) {
  if (touchInProgress) return false;
  const p = getCanvasCoords(event.clientX, event.clientY);
  handlePointerUp(p.x, p.y);
  return false;
}

function getCanvasCoords(clientX, clientY) {
  const rect = canvas.elt.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * WIDTH;
  const y = ((clientY - rect.top) / rect.height) * HEIGHT;
  return { x, y };
}

class Card {
  constructor(data) {
    this.data = data;
    this.homeX = WIDTH / 2;
    this.homeY = HEIGHT / 2;
    this.x = this.homeX;
    this.y = this.homeY;
    this.rotation = 0;
    this.dragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.flying = false;
    this.flyVelocityX = 0;
    this.flyVelocityY = 0;
    this.flyRotationSpeed = 0;
    this.returning = false;
    this.done = false;
  }

  canInteract() {
    return !this.flying;
  }

  startDrag(px, py) {
    if (!this.canInteract()) return;
    this.dragging = true;
    this.returning = false;
    this.done = false;
    this.dragOffsetX = px - this.x;
    this.dragOffsetY = py - this.y;
  }

  drag(px, py) {
    if (!this.dragging) return;
    this.x = px - this.dragOffsetX;
    this.y = py - this.dragOffsetY;
    const dx = this.x - this.homeX;
    this.rotation = constrain(dx / (WIDTH * 0.9), -0.3, 0.3);
  }

  release(forcedOutcome = null) {
    if (!this.dragging) {
      return forcedOutcome || "none";
    }
    this.dragging = false;
    const outcome = forcedOutcome || this.computeOutcome();
    if (outcome === "like") {
      this.startFlyOut("right");
      return "like";
    }
    if (outcome === "dislike") {
      this.startFlyOut("left");
      return "dislike";
    }
    this.startReturn();
    return "none";
  }

  computeOutcome() {
    const dx = this.x - this.homeX;
    const threshold = WIDTH * 0.25;
    if (dx > threshold) return "like";
    if (dx < -threshold) return "dislike";
    return "none";
  }

  cancelForImmediateMatch() {
    this.dragging = false;
    this.flying = false;
    this.returning = false;
    this.done = true;
    this.x = this.homeX;
    this.y = this.homeY;
    this.rotation = 0;
  }

  startReturn() {
    this.returning = true;
    this.done = false;
  }

  startFlyOut(direction) {
    this.flying = true;
    this.returning = false;
    this.done = false;
    const dir = direction === "right" ? 1 : -1;
    this.flyVelocityX = dir * 55;
    this.flyVelocityY = (this.y - this.homeY) * 0.08 + dir * 6;
    this.flyRotationSpeed = dir * 0.08;
  }

  update() {
    if (this.dragging) {
      return;
    }
    if (this.flying) {
      this.x += this.flyVelocityX;
      this.y += this.flyVelocityY;
      this.rotation += this.flyRotationSpeed;
      if (this.x > WIDTH * 1.6 || this.x < -WIDTH * 0.6) {
        this.flying = false;
        this.done = true;
      }
      return;
    }
    if (this.returning) {
      this.x = lerp(this.x, this.homeX, 0.25);
      this.y = lerp(this.y, this.homeY, 0.25);
      this.rotation = lerp(this.rotation, 0, 0.2);
      if (abs(this.x - this.homeX) < 0.5 && abs(this.y - this.homeY) < 0.5 && abs(this.rotation) < 0.01) {
        this.x = this.homeX;
        this.y = this.homeY;
        this.rotation = 0;
        this.returning = false;
      }
      return;
    }
    this.x = lerp(this.x, this.homeX, 0.1);
    this.y = lerp(this.y, this.homeY, 0.1);
    this.rotation = lerp(this.rotation, 0, 0.1);
  }

  draw() {
    if (!this.data || !this.data.img) return;
    push();
    translate(this.x, this.y);
    rotate(this.rotation);
    drawImageCover(this.data.img, 0, 0, WIDTH * 1.08, HEIGHT * 1.08);
    pop();
  }

  isFinished() {
    return this.done;
  }
}

function drawImageCover(img, cx, cy, w, h) {
  if (!img) return;
  const imgRatio = img.width / img.height;
  const destRatio = w / h;
  let sw;
  let sh;
  if (imgRatio > destRatio) {
    sh = img.height;
    sw = sh * destRatio;
  } else {
    sw = img.width;
    sh = sw / destRatio;
  }
  const sx = (img.width - sw) * 0.5;
  const sy = (img.height - sh) * 0.5;
  imageMode(CENTER);
  image(img, cx, cy, w, h, sx, sy, sw, sh);
}
