
const WIDTH = 1080;
const HEIGHT = 1920;

const STATES = {
  BEGIN: "BEGIN",
  LEAD_GEN: "LEAD_GEN",
  TUTORIAL1: "TUTORIAL1",
  TUTORIAL2: "TUTORIAL2",
  PLAY1: "PLAY1",
  MATCH1: "MATCH1",
  PLAY2: "PLAY2",
  MATCH2: "MATCH2",
  PLAY3: "PLAY3",
  MATCH3: "MATCH3",
  FREEPLAY: "FREEPLAY",
};

const LEAD_STORAGE_KEY = "leadData";
const MATCH_EXIT_SWIPE_THRESHOLD = 120;
const SWIPE_THRESHOLD = WIDTH * 0.25;
const DEFAULT_LEVEL_TIMER = 60;
const LEAD_ENDPOINT = "https://script.google.com/macros/s/AKfycbzlK0quklwpJsXgjsAi76Sb67ZLTaMe6UdryKCfXTuuJ8-eWMGe3OfHAYRxFUZaZHc-/exec";

let canvas;
let defaultFont;
let digitalFont;

let imgBegin;
let leadGenImages = [];
let tutorialImages = [];
let matchImages = {};

const CARD_DEFS = [
  { id: "profile1", name: "Profile 1", file: "Profile_1.png" },
  { id: "profile2", name: "Profile 2", file: "Profile_2.png" },
  { id: "profile3", name: "Profile 3", file: "Profile_3.png" },
  { id: "profile4", name: "Profile 4", file: "Profile_4.png" },
  { id: "profile5", name: "Profile 5", file: "Profile_5.png" },
  { id: "profile6", name: "Profile 6", file: "Profile_6.png" },
  { id: "profile7", name: "Profile 7", file: "Profile_7.png" },
  { id: "profile8", name: "Profile 8", file: "Profile_8.png" },
  { id: "profile9", name: "Profile 9", file: "Profile_9.png" },
  { id: "profile10", name: "Profile 10", file: "Profile_10.png" },
  { id: "lauren", name: "Lauren", file: "LAUREN.png", matchKey: "lauren" },
  { id: "tracy", name: "Tracy", file: "TRACY.png", matchKey: "tracy" },
  { id: "angela", name: "Angela", file: "ANGELA.png", matchKey: "angela" },
];

let cardCatalog = {};

const LEVEL_CONFIGS = [
  {
    playState: STATES.PLAY1,
    matchState: STATES.MATCH1,
    matchKey: "lauren",
    matchImageId: "matchL1",
    deck: ["profile1", "profile2", "profile3", "lauren", "profile4", "profile5"],
    timer: DEFAULT_LEVEL_TIMER,
  },
  {
    playState: STATES.PLAY2,
    matchState: STATES.MATCH2,
    matchKey: "tracy",
    matchImageId: "matchL2",
    deck: ["profile6", "profile7", "profile8", "tracy", "profile9", "profile10"],
    timer: DEFAULT_LEVEL_TIMER,
  },
  {
    playState: STATES.PLAY3,
    matchState: STATES.MATCH3,
    matchKey: "angela",
    matchImageId: "matchL3",
    deck: ["profile1", "profile4", "profile7", "angela", "profile3", "profile9"],
    timer: DEFAULT_LEVEL_TIMER,
  },
];

let levelProgress = [];
let currentLevelIndex = 0;
let currentState = STATES.BEGIN;
let currentMatchLevel = -1;

let deck = [];
let currentCardIndex = 0;
let activeCard = null;

let timerSeconds = DEFAULT_LEVEL_TIMER;
let timerRunning = false;
let lastTimerUpdate = 0;

let matchSwipeActive = false;
let matchSwipeStartX = 0;

let leadScreens = [];
let leadScreenIndex = 0;
let leadInputElements = [];
let leadButtonElement = null;
let leadCollectedData = {};
let leadSubmitting = false;
let storedLeadData = null;

let lastPointerX = WIDTH / 2;
let lastPointerY = HEIGHT / 2;
let touchInProgress = false;

function preload() {
  imgBegin = loadImage("BEGIN.png");
  leadGenImages = [
    loadImage("LEAD GEN SCREEN 1.png"),
    loadImage("LEAD GEN SCREEN 2.png"),
    loadImage("LEAD GEN SCREEN 3.png"),
    loadImage("LEAD GEN SCREEN 4.png"),
  ];
  tutorialImages = [
    loadImage("TUTORIAL_L1b.png"),
    loadImage("TUTORIAL_L1c.png"),
  ];
  matchImages.matchL1 = loadImage("MATCH_L1.png");
  matchImages.matchL2 = loadImage("MATCH_L2.png");
  matchImages.matchL3 = loadImage("MATCH_L3.png");
  defaultFont = "Helvetica Neue, Arial, sans-serif";
  digitalFont = loadFont("DS-DIGII.TTF");

  CARD_DEFS.forEach((def) => {
    const img = loadImage(def.file);
    cardCatalog[def.id] = {
      id: def.id,
      name: def.name,
      img,
      matchKey: def.matchKey || null,
    };
  });
}

function setup() {
  storedLeadData = loadStoredLead();
  if (isMobileDevice() && !storedLeadData) {
    window.location.href = "form.html";
    noLoop();
    return;
  }

  pixelDensity(1);
  canvas = createCanvas(WIDTH, HEIGHT);
  canvas.parent("app");
  imageMode(CENTER);
  textFont(defaultFont);
  noStroke();
  fitCanvasCSS();

  initializeLeadScreens();
  levelProgress = LEVEL_CONFIGS.map(() => ({ matched: false }));
  currentState = STATES.BEGIN;
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
  updateLeadDomPositions();
}

function draw() {
  background(0);
  noTint();
  updateTimer();

  switch (currentState) {
    case STATES.BEGIN:
      drawImageCover(imgBegin, WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT);
      break;
    case STATES.LEAD_GEN:
      drawLeadGenScreen();
      break;
    case STATES.TUTORIAL1:
      drawTutorialScreen(0);
      break;
    case STATES.TUTORIAL2:
      drawTutorialScreen(1);
      break;
    case STATES.PLAY1:
    case STATES.PLAY2:
    case STATES.PLAY3:
    case STATES.FREEPLAY:
      drawPlayState();
      break;
    case STATES.MATCH1:
    case STATES.MATCH2:
    case STATES.MATCH3:
      drawMatchState();
      break;
    default:
      drawImageCover(imgBegin, WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT);
  }

  if (shouldShowTimer()) {
    drawTimer();
  }

  drawDebugOverlay();
}

function drawLeadGenScreen() {
  const img = leadGenImages[leadScreenIndex];
  if (img) {
    drawImageCover(img, WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT);
  }
}

function drawTutorialScreen(index) {
  const img = tutorialImages[index];
  if (img) {
    drawImageCover(img, WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT);
  }
}

function drawPlayState() {
  if (!activeCard && deck.length > 0) {
    activeCard = new Card(deck[currentCardIndex]);
  }

  if (activeCard) {
    activeCard.update();
    activeCard.draw();
    if (activeCard.isFinished()) {
      activeCard = null;
      advanceToNextCard();
    }
  }
}

function drawMatchState() {
  resetMatrix();
  imageMode(CORNER);
  noTint();
  const matchImage = getCurrentMatchImage();
  if (matchImage) {
    image(matchImage, 0, 0, WIDTH, HEIGHT);
  } else {
    background(0);
  }
  imageMode(CENTER);
}

function drawTimer() {
  push();
  resetMatrix();
  textAlign(CENTER, TOP);
  textFont(digitalFont || defaultFont);
  fill(255);
  const minutes = floor(max(timerSeconds, 0) / 60);
  const seconds = floor(max(timerSeconds, 0) % 60);
  const display = nf(minutes, 2) + ":" + nf(seconds, 2);
  textSize(96);
  text(display, WIDTH / 2, 64);
  textFont(defaultFont);
  pop();
}

function drawDebugOverlay() {
  push();
  resetMatrix();
  fill(255);
  textFont(defaultFont);
  textSize(32);
  textAlign(LEFT, TOP);
  const cardName = activeCard ? activeCard.data.name : "-";
  const debugText = `state: ${currentState}\nindex: ${activeCard ? currentCardIndex : "-"}\nname: ${cardName}`;
  text(debugText, 24, 24);
  pop();
}

function updateTimer() {
  if (!timerRunning) return;
  const now = millis();
  const delta = (now - lastTimerUpdate) / 1000;
  lastTimerUpdate = now;
  timerSeconds = max(timerSeconds - delta, 0);
  if (timerSeconds <= 0) {
    timerRunning = false;
  }
}

function shouldShowTimer() {
  return (
    (currentState === STATES.PLAY1 ||
      currentState === STATES.PLAY2 ||
      currentState === STATES.PLAY3 ||
      currentState === STATES.FREEPLAY) &&
    timerSeconds > 0
  );
}

function startTimer(seconds) {
  timerSeconds = seconds;
  lastTimerUpdate = millis();
  timerRunning = true;
}

function stopTimer() {
  timerRunning = false;
}

function initializeLeadScreens() {
  leadScreens = [
    {
      fields: [
        { key: "phone", placeholder: "Phone number", type: "tel" },
      ],
      buttonLabel: "Next",
    },
    {
      fields: [
        { key: "firstName", placeholder: "First name", type: "text" },
      ],
      buttonLabel: "Next",
    },
    {
      fields: [
        { key: "lastName", placeholder: "Last name", type: "text" },
      ],
      buttonLabel: "Next",
    },
    {
      fields: [
        { key: "email", placeholder: "Email", type: "email" },
      ],
      buttonLabel: "Submit",
    },
  ];
}

function startLeadGenFlow() {
  currentState = STATES.LEAD_GEN;
  leadCollectedData = storedLeadData ? { ...storedLeadData } : {};
  leadScreenIndex = 0;
  buildLeadDom();
}

function buildLeadDom() {
  destroyLeadInputs();
  const screen = leadScreens[leadScreenIndex];
  if (!screen) return;
  leadInputElements = screen.fields.map((field) => {
    const input = createInput(leadCollectedData[field.key] || "");
    input.attribute("placeholder", field.placeholder);
    input.attribute("type", field.type || "text");
    input.addClass("lead-input");
    input.style("padding", "16px");
    input.style("font-size", "24px");
    input.style("border", "2px solid #ffffff");
    input.style("border-radius", "12px");
    input.style("background", "rgba(0,0,0,0.4)");
    input.style("color", "#ffffff");
    return input;
  });

  leadButtonElement = createButton(screen.buttonLabel);
  leadButtonElement.addClass("lead-button");
  leadButtonElement.style("padding", "16px 24px");
  leadButtonElement.style("font-size", "28px");
  leadButtonElement.style("border", "none");
  leadButtonElement.style("border-radius", "16px");
  leadButtonElement.style("background", "#ff3b70");
  leadButtonElement.style("color", "#fff");
  leadButtonElement.mousePressed(handleLeadAdvance);
  updateLeadDomPositions();
}

function handleLeadAdvance() {
  if (leadSubmitting) return;
  const screen = leadScreens[leadScreenIndex];
  if (!screen) return;
  let hasError = false;
  screen.fields.forEach((field, idx) => {
    const value = (leadInputElements[idx].value() || "").trim();
    leadCollectedData[field.key] = value;
    if (!value) {
      hasError = true;
      leadInputElements[idx].style("border", "2px solid #ff4b4b");
    } else {
      leadInputElements[idx].style("border", "2px solid #ffffff");
    }
  });
  if (hasError) return;

  if (leadScreenIndex === leadScreens.length - 1) {
    submitLeadData();
  } else {
    leadScreenIndex += 1;
    buildLeadDom();
  }
}

function submitLeadData() {
  leadSubmitting = true;
  leadButtonElement.attribute("disabled", true);
  leadButtonElement.style("opacity", "0.6");

  try {
    localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(leadCollectedData));
    storedLeadData = { ...leadCollectedData };
  } catch (err) {
    console.error("Error storing lead data", err);
  }

  fetch(LEAD_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(leadCollectedData),
    mode: "cors",
  })
    .catch((error) => {
      console.error("Lead submission failed", error);
    })
    .finally(() => {
      leadSubmitting = false;
      destroyLeadInputs();
      startTutorialFlow();
    });
}

function destroyLeadInputs() {
  leadInputElements.forEach((el) => el.remove());
  leadInputElements = [];
  if (leadButtonElement) {
    leadButtonElement.remove();
    leadButtonElement = null;
  }
}

function updateLeadDomPositions() {
  if (!canvas) return;
  if (!leadInputElements.length && !leadButtonElement) return;
  const rect = canvas.elt.getBoundingClientRect();
  const scaleY = rect.height / HEIGHT;
  const inputWidth = rect.width * 0.7;
  leadInputElements.forEach((input, idx) => {
    const x = rect.left + rect.width * 0.15;
    const y = rect.top + rect.height * 0.6 + idx * (80 * scaleY);
    input.position(x, y);
    input.size(inputWidth, 56 * scaleY);
  });
  if (leadButtonElement) {
    const x = rect.left + rect.width * 0.3;
    const y = rect.top + rect.height * 0.8;
    leadButtonElement.position(x, y);
    leadButtonElement.size(rect.width * 0.4, 64 * scaleY);
  }
}

function startTutorialFlow() {
  currentState = STATES.TUTORIAL1;
}

function startLevel(levelIndex) {
  currentLevelIndex = levelIndex;
  const level = LEVEL_CONFIGS[levelIndex];
  deck = buildDeckForLevel(levelIndex);
  currentCardIndex = 0;
  activeCard = deck.length ? new Card(deck[currentCardIndex]) : null;
  currentState = level.playState;
  startTimer(level.timer || DEFAULT_LEVEL_TIMER);
}

function startFreePlay() {
  const freePlayDeckIds = CARD_DEFS.filter((def) => !def.matchKey).map((def) => def.id);
  deck = freePlayDeckIds.map((id) => createCardDataFromCatalog(id));
  deck = shuffleDeck(deck);
  currentCardIndex = 0;
  activeCard = deck.length ? new Card(deck[currentCardIndex]) : null;
  currentState = STATES.FREEPLAY;
  startTimer(DEFAULT_LEVEL_TIMER);
}

function buildDeckForLevel(levelIndex) {
  const level = LEVEL_CONFIGS[levelIndex];
  if (!level) return [];
  let ids = level.deck.slice();
  if (levelProgress[levelIndex] && levelProgress[levelIndex].matched) {
    ids = ids.filter((id) => cardCatalog[id].matchKey !== level.matchKey);
  }
  const cards = ids.map((id) => createCardDataFromCatalog(id));
  return shuffleDeck(cards);
}

function createCardDataFromCatalog(id) {
  const base = cardCatalog[id];
  return {
    id: base.id,
    name: base.name,
    img: base.img,
    matchKey: base.matchKey || null,
  };
}

function shuffleDeck(cards) {
  const arr = cards.map((card) => ({ ...card }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

function advanceToNextCard() {
  if (!deck.length) {
    activeCard = null;
    return;
  }
  currentCardIndex = (currentCardIndex + 1) % deck.length;
  activeCard = new Card(deck[currentCardIndex]);
}

function enterMatch(levelIndex) {
  console.log("Entrando a MATCH");
  console.log("Entrando a MATCH nivel", levelIndex + 1);
  stopTimer();
  currentMatchLevel = levelIndex;
  const level = LEVEL_CONFIGS[levelIndex];
  currentState = level.matchState;
  activeCard = null;
  matchSwipeActive = false;
  matchSwipeStartX = 0;
}

function exitMatch() {
  if (currentMatchLevel < 0) return;
  console.log("Saliendo de MATCH → PLAY2");
  console.log("Saliendo de MATCH → siguiente fase");
  if (levelProgress[currentMatchLevel]) {
    levelProgress[currentMatchLevel].matched = true;
  }
  if (currentMatchLevel < LEVEL_CONFIGS.length - 1) {
    startLevel(currentMatchLevel + 1);
  } else {
    startFreePlay();
  }
  currentMatchLevel = -1;
}

function getCurrentMatchImage() {
  if (currentMatchLevel < 0) return null;
  const level = LEVEL_CONFIGS[currentMatchLevel];
  if (!level) return null;
  return matchImages[level.matchImageId] || null;
}

function handlePointerDown(x, y) {
  lastPointerX = x;
  lastPointerY = y;

  if (currentState === STATES.BEGIN) {
    if (shouldShowLeadGen()) {
      startLeadGenFlow();
    } else {
      startTutorialFlow();
    }
    return;
  }

  if (currentState === STATES.LEAD_GEN) {
    return;
  }

  if (currentState === STATES.TUTORIAL1) {
    currentState = STATES.TUTORIAL2;
    return;
  }

  if (currentState === STATES.TUTORIAL2) {
    startLevel(0);
    return;
  }

  if (isMatchState(currentState)) {
    matchSwipeActive = true;
    matchSwipeStartX = x;
    return;
  }

  if (isPlayState(currentState) && activeCard && activeCard.canInteract()) {
    activeCard.startDrag(x, y);
  }
}

function handlePointerMove(x, y) {
  lastPointerX = x;
  lastPointerY = y;

  if (isPlayState(currentState) && activeCard) {
    activeCard.drag(x, y);
  }
}

function handlePointerUp(x, y) {
  lastPointerX = x;
  lastPointerY = y;

  if (isMatchState(currentState)) {
    if (matchSwipeActive) {
      const dx = x - matchSwipeStartX;
      if (dx >= MATCH_EXIT_SWIPE_THRESHOLD) {
        exitMatch();
      }
      matchSwipeActive = false;
      matchSwipeStartX = 0;
    }
    return;
  }

  if (isPlayState(currentState) && activeCard) {
    const outcome = activeCard.computeOutcome();
    if (outcome === "like") {
      console.log("LIKE en", activeCard.data.name, "state:", currentState);
    }
    const level = LEVEL_CONFIGS[currentLevelIndex];
    const shouldMatch =
      outcome === "like" &&
      level &&
      activeCard.data.matchKey &&
      activeCard.data.matchKey === level.matchKey &&
      !levelProgress[currentLevelIndex].matched;
    if (shouldMatch) {
      activeCard.cancelForImmediateMatch();
      enterMatch(currentLevelIndex);
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

function isPlayState(state) {
  return (
    state === STATES.PLAY1 ||
    state === STATES.PLAY2 ||
    state === STATES.PLAY3 ||
    state === STATES.FREEPLAY
  );
}

function isMatchState(state) {
  return state === STATES.MATCH1 || state === STATES.MATCH2 || state === STATES.MATCH3;
}

function shouldShowLeadGen() {
  return !isMobileDevice() && !storedLeadData;
}

function loadStoredLead() {
  try {
    const raw = localStorage.getItem(LEAD_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading stored lead", err);
    return null;
  }
}

function isMobileDevice() {
  const ua = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
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
    this.rotation = constrain(dx / (WIDTH * 0.9), -0.35, 0.35);
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
    if (dx > SWIPE_THRESHOLD) return "like";
    if (dx < -SWIPE_THRESHOLD) return "dislike";
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
      this.x = lerp(this.x, this.homeX, 0.2);
      this.y = lerp(this.y, this.homeY, 0.2);
      this.rotation = lerp(this.rotation, 0, 0.2);
      if (
        abs(this.x - this.homeX) < 0.5 &&
        abs(this.y - this.homeY) < 0.5 &&
        abs(this.rotation) < 0.01
      ) {
        this.x = this.homeX;
        this.y = this.homeY;
        this.rotation = 0;
        this.returning = false;
      }
      return;
    }
    this.x = lerp(this.x, this.homeX, 0.15);
    this.y = lerp(this.y, this.homeY, 0.15);
    this.rotation = lerp(this.rotation, 0, 0.15);
  }

  draw() {
    if (!this.data || !this.data.img) return;
    push();
    translate(this.x, this.y);
    rotate(this.rotation);
    drawImageCover(this.data.img, 0, 0, WIDTH * 1.05, HEIGHT * 1.05);
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
