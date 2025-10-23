/* === LEAD GEN (Mobile): si no hay lead guardado, redirigir al form === */
(function(){
  const UA = navigator.userAgent || "";
  const touch = (navigator.maxTouchPoints || 0) > 0;
  const isIPhone  = /iPhone|iPod/i.test(UA);
  const isAndroid = /Android/i.test(UA);
  const isIPad    = /iPad/i.test(UA) || (touch && /Macintosh/.test(UA));
  const IS_MOBILE = isIPhone || isAndroid || isIPad;

  // Solo móviles (en desktop corremos lead in-canvas)
  if (!IS_MOBILE) return;

  const hasLead = (() => {
    try {
      const d = JSON.parse(localStorage.getItem("leadgenData") || "{}");
      return !!d.email && typeof d.email === "string" && d.email.includes("@");
    } catch { return false; }
  })();

  if (!hasLead) {
    try { sessionStorage.setItem("postReturnTarget", location.href); } catch(e){}
    location.replace("form.html?return=" + encodeURIComponent(location.href));
    throw new Error("Lead gen required (mobile). Redirecting to form.html");
  }
})();

/* === Google Apps Script endpoint (envío a Google Sheets) === */
const LEAD_ENDPOINT = "https://script.google.com/macros/s/AKfycbzlK0quklwpJsXgjsAi76Sb67ZLTaMe6UdryKCfXTuuJ8-eWMGe3OfHAYRxFUZaZHc-/exec";

/* === Juego base === */
const WIDTH = 440;
const HEIGHT = 956;

const STATES = {
  BEGIN: "BEGIN",
  DESK_LEAD: "DESK_LEAD",
  TUTORIAL: "TUTORIAL",
  PLAY: "PLAY",
  MATCH: "MATCH",
};

let currentState = STATES.BEGIN;
let canvas;

const ASSET_BASE = "";

// imágenes cargadas
const IMAGES = {};
let fontDigital;

// Pantallas
const BEGIN_NAME = "BEGIN.png";
const TUTORIAL_FILES = ["TUTORIAL_L1b.png", "TUTORIAL_L1c.png"];

// Profiles (asegurate nombres exactos)
const PROFILE_FILES = [
  "Profile_1.png","Profile_2.png","Profile_3.png","Profile_4.png","Profile_5.png",
  "Profile_6.png","Profile_7.png","Profile_8.png","Profile_9.png","Profile_10.png",
];

// Specials + match screens
const SPECIALS = [
  { key: "LAUREN", file: "LAUREN.png", matchFile: "MATCH_L1.png" },
  { key: "TRACY",  file: "TRACY.png",  matchFile: "MATCH_L2.png" },
  { key: "ANGELA", file: "ANGELA.png", matchFile: "MATCH_L3.png" },
];

// Desktop lead: **CANDIDATOS** por paso (por si tus nombres tienen espacios/underscores)
const DESK_LEAD_CANDIDATES = [
  ["LEAD GEN SCREEN 1.png", "LEAD_G 1.png", "LEAD_G_1.png"],
  ["LEAD GEN SCREEN 2.png", "LEAD_G 2.png", "LEAD_G_2.png"],
  ["LEAD GEN SCREEN 3.png", "LEAD_G 3.png", "LEAD_G_3.png"],
  ["LEAD GEN SCREEN 4.png", "LEAD_G 4.png", "LEAD_G_4.png"]
];
function getDeskLeadFile(step){
  const list = DESK_LEAD_CANDIDATES[step] || [];
  for (const f of list) if (IMAGES[f]) return f;
  return null;
}

// Flow
let tutorialIndex = 0;
let currentLevelIndex = 0;
let currentMatchImg = null;

// Mazo
let deck = [];
let currentCardIndex = 0;
let activeCard = null;

// Input
let lastPointerX = WIDTH / 2;
let lastPointerY = HEIGHT / 2;
let pointerDownX = WIDTH / 2;
let pointerDownY = HEIGHT / 2;
let touchInProgress = false;

// Timer (solo PLAY)
const TIMER_START_SECONDS = 30;
let timerRemaining = TIMER_START_SECONDS;
let timerRunning = false;
const TIMER_POS = { x: WIDTH / 2, y: 88 };

// Desktop lead state
let isMobile = false;
let deskLeadStep = 0; // 0..3
let leadInputs = {};
let leadData = { phoneCode: "+1", phone: "", first: "", last: "", email: "" };
let leadSending = false;

/* ---------- Carga ---------- */
function preload() {
  fontDigital = loadFont("DS-DIGII.TTF");

  const load = (file) =>
    loadImage(ASSET_BASE + file,
      (img) => (IMAGES[file] = img),
      () => { console.error("No pude cargar", file); IMAGES[file] = null; }
    );

  // Básicos
  load(BEGIN_NAME);
  for (const f of TUTORIAL_FILES) load(f);
  for (const f of PROFILE_FILES) load(f);
  for (const s of SPECIALS) { load(s.file); load(s.matchFile); }

  // Desktop lead: cargar TODOS los candidatos
  for (const group of DESK_LEAD_CANDIDATES) for (const f of group) load(f);
}

/* ---------- Setup / resize ---------- */
function setup() {
  pixelDensity(1);
  canvas = createCanvas(WIDTH, HEIGHT);
  canvas.parent("app");
  imageMode(CENTER);
  noStroke();
  fitCanvasCSS();

  const UA = navigator.userAgent || "";
  const touch = (navigator.maxTouchPoints || 0) > 0;
  const isIPhone  = /iPhone|iPod/i.test(UA);
  const isAndroid = /Android/i.test(UA);
  const isIPad    = /iPad/i.test(UA) || (touch && /Macintosh/.test(UA));
  isMobile = isIPhone || isAndroid || isIPad;
}

function windowResized() { fitCanvasCSS(); positionLeadUI(); }
function fitCanvasCSS() {
  if (!canvas) return;
  const scale = Math.min(windowWidth / WIDTH, windowHeight / HEIGHT);
  const styledWidth = `${WIDTH * scale}px`;
  const styledHeight = `${HEIGHT * scale}px`;
  const el = canvas.elt;
  el.style.width = styledWidth;
  el.style.height = styledHeight;
  const container = document.getElementById("app");
  if (container) {
    container.style.width = styledWidth;
    container.style.height = styledHeight;
    container.style.position = "relative"; // overlay inputs
  }
}

/* ---------- Draw ---------- */
function draw() {
  background(0);
  noTint();

  // Timer solo en PLAY
  if (currentState === STATES.PLAY && timerRunning) {
    timerRemaining -= (deltaTime || 16.67) / 1000;
    if (timerRemaining <= 0) {
      timerRemaining = 0;
      timerRunning = false;
      forceFinalMatch();
      return;
    }
  }

  if (currentState === STATES.BEGIN) {
    imageMode(CORNER);
    IMAGES[BEGIN_NAME] && image(IMAGES[BEGIN_NAME], 0, 0);
    imageMode(CENTER);
  } else if (currentState === STATES.DESK_LEAD) {
    imageMode(CORNER);
    const file = getDeskLeadFile(deskLeadStep);
    IMAGES[file] && image(IMAGES[file], 0, 0);
    imageMode(CENTER);
  } else if (
    currentState === STATES.TUTORIAL ||
    currentState === STATES.PLAY ||
    currentState === STATES.MATCH
  ) {
    if (activeCard) {
      activeCard.update();
      activeCard.draw();

      if (activeCard.isFinished()) {
        activeCard = null;
        if (currentState === STATES.TUTORIAL) {
          tutorialIndex++;
          if (tutorialIndex < TUTORIAL_FILES.length) {
            const nextFile = TUTORIAL_FILES[tutorialIndex];
            activeCard = new Card({ name: `TUT_${tutorialIndex}`, img: IMAGES[nextFile] });
          } else {
            startLevel(0);
          }
        } else if (currentState === STATES.MATCH) {
          exitMatch();
        } else if (currentState === STATES.PLAY) {
          advanceToNextCard();
        }
      }
    }
  }

  if (currentState === STATES.PLAY) drawTimer();
}

/* ---------- Timer ---------- */
function drawTimer() {
  push();
  resetMatrix();
  textFont(fontDigital);
  textAlign(CENTER, TOP);
  textSize(48);
  fill(0, 0, 0, 120);
  text(formatMMSS(timerRemaining), TIMER_POS.x + 1, TIMER_POS.y + 1);
  fill(255);
  text(formatMMSS(timerRemaining), TIMER_POS.x, TIMER_POS.y);
  pop();
}
function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ---------- Flow ---------- */
function enterTutorial() {
  currentState = STATES.TUTORIAL;
  timerRunning = false;
  tutorialIndex = 0;
  const file = TUTORIAL_FILES[0];
  activeCard = new Card({ name: "TUT_0", img: IMAGES[file] });
}

function startLevel(levelIndex) {
  currentLevelIndex = levelIndex % SPECIALS.length;
  buildDeckForCurrentLevel();
  currentCardIndex = 0;
  currentState = STATES.PLAY;
  activeCard = new Card(deck[currentCardIndex]);
  timerRemaining = TIMER_START_SECONDS;
  timerRunning = true;
}

function buildDeckForCurrentLevel() {
  const profiles = PROFILE_FILES
    .filter((f) => !!IMAGES[f]) // solo los que existen
    .map((f) => ({ name: f, img: IMAGES[f], isSpecial: false }));

  shuffleInPlace(profiles);

  const spec = SPECIALS[currentLevelIndex];
  const specialCard = { name: spec.key, img: IMAGES[spec.file], isSpecial: true };

  const mixed = profiles.slice();
  if (specialCard.img) {
    const insertAt = floor(random(mixed.length + 1));
    mixed.splice(insertAt, 0, specialCard);
  }

  // Blindaje
  deck = mixed.filter(c => c && c.img);
  currentMatchImg = IMAGES[spec.matchFile] || null;
}

function enterMatch() {
  currentState = STATES.MATCH;
  timerRunning = false; // no corre en match
  activeCard = new Card({ name: `MATCH_L${currentLevelIndex + 1}`, img: currentMatchImg });
}

function exitMatch() {
  const nextLevel = (currentLevelIndex + 1) % SPECIALS.length;
  startLevel(nextLevel);
}

function forceFinalMatch() {
  currentState = STATES.MATCH;
  currentLevelIndex = 2; // ANGELA
  timerRunning = false;
  currentMatchImg = IMAGES["MATCH_L3.png"];
  activeCard = new Card({ name: "MATCH_L3", img: currentMatchImg });
}

function advanceToNextCard() {
  if (!deck || deck.length === 0) { activeCard = null; return; }
  currentCardIndex = (currentCardIndex + 1) % deck.length;
  activeCard = new Card(deck[currentCardIndex]);
}

function isSpecialCard(data) {
  if (!data) return false;
  return data.isSpecial === true || SPECIALS.some(s => s.key === data.name);
}
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    // SWAP CORRECTO (esto arregla la “pantalla negra”)
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ---------- Desktop Lead: flujo ---------- */
function enterDesktopLead() {
  currentState = STATES.DESK_LEAD;
  deskLeadStep = 0;
  leadSending = false;
  createLeadUI();
  showLeadStep(0);
}
function exitDesktopLead() {
  destroyLeadUI();
  // Enviar al Sheets y luego entrar al tutorial (no bloquea el juego)
  submitDesktopLead().finally(() => {
    enterTutorial();
  });
}

/* ---------- Desktop Lead: envío ---------- */
async function submitDesktopLead() {
  const phoneOk = /^\+?\d{1,4}$/.test((leadData.phoneCode||"").trim()) &&
                  /^\d{5,}$/.test((leadData.phone||"").replace(/\D/g,""));
  const firstOk = !!(leadData.first||"").trim();
  const lastOk  = !!(leadData.last||"").trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((leadData.email||"").trim().toLowerCase());
  if (!phoneOk || !firstOk || !lastOk || !emailOk) return;

  try {
    localStorage.setItem("leadgenData", JSON.stringify({
      first: leadData.first.trim(),
      last:  leadData.last.trim(),
      email: leadData.email.trim().toLowerCase(),
      phone: `${(leadData.phoneCode||"").trim()} ${(leadData.phone||"").trim()}`,
      ts: Date.now()
    }));
  } catch {}

  const info = detectPlatform();
  const payload = {
    first: leadData.first.trim(),
    last:  leadData.last.trim(),
    email: leadData.email.trim().toLowerCase(),
    phone: `${(leadData.phoneCode||"").trim()} ${(leadData.phone||"").trim()}`,
    platform: info.platform,
    userAgent: info.userAgent
  };
  await sendLeadToSheet(payload);
}

function detectPlatform(){
  const ua = navigator.userAgent || '';
  const isMob = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua)
    || (window.matchMedia && window.matchMedia('(max-width: 850px)').matches);
  return { platform: isMob ? 'mobile' : 'desktop', userAgent: ua };
}
async function sendLeadToSheet(payload){
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 10000);
  try{
    const body = new URLSearchParams(payload);
    const res = await fetch(LEAD_ENDPOINT, { method:'POST', body, signal:controller.signal });
    clearTimeout(timeout);
    let data = null;
    try { data = await res.json(); } catch { data = { ok: res.ok }; }
    return { ok: !!(data && data.ok), data, status: res.status };
  } catch (err){
    clearTimeout(timeout);
    return { ok:false, error: String(err?.message||err) };
  }
}

/* ---------- Desktop Lead UI (DOM) ---------- */
function createLeadUI() {
  const container = document.getElementById("app");
  const mk = (tag) => {
    const el = document.createElement(tag);
    el.style.position = "absolute";
    el.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    el.style.fontSize = "18px";
    el.style.color = "#fff";
    el.style.background = "transparent";
    el.style.border = "none";
    el.style.borderBottom = "2px solid #bbb";
    el.style.outline = "none";
    el.style.padding = "6px 8px";
    el.style.boxSizing = "border-box";
    el.style.zIndex = 5;
    container.appendChild(el);
    return el;
  };

  // step 0: teléfono
  leadInputs.code = mk("input");
  leadInputs.code.type = "text";
  leadInputs.code.value = leadData.phoneCode || "+1";
  leadInputs.code.placeholder = "+1";
  leadInputs.code.maxLength = 4;
  leadInputs.code.style.width = "80px";

  leadInputs.phone = mk("input");
  leadInputs.phone.type = "tel";
  leadInputs.phone.placeholder = "phone number";
  leadInputs.phone.value = leadData.phone || "";
  leadInputs.phone.style.width = "220px";
  leadInputs.phone.inputMode = "numeric";

  // step 1
  leadInputs.first = mk("input");
  leadInputs.first.type = "text";
  leadInputs.first.placeholder = "first name";
  leadInputs.first.value = leadData.first || "";

  // step 2
  leadInputs.last = mk("input");
  leadInputs.last.type = "text";
  leadInputs.last.placeholder = "last name";
  leadInputs.last.value = leadData.last || "";

  // step 3
  leadInputs.email = mk("input");
  leadInputs.email.type = "email";
  leadInputs.email.placeholder = "email address";
  leadInputs.email.value = leadData.email || "";

  // botón
  leadInputs.btn = document.createElement("button");
  leadInputs.btn.textContent = "confirm";
  leadInputs.btn.style.position = "absolute";
  leadInputs.btn.style.border = "none";
  leadInputs.btn.style.padding = "16px 28px";
  leadInputs.btn.style.color = "#fff";
  leadInputs.btn.style.fontWeight = "700";
  leadInputs.btn.style.borderRadius = "28px";
  leadInputs.btn.style.background = "linear-gradient(90deg,#ff6a7a,#c61c0c)";
  leadInputs.btn.style.boxShadow = "0 6px 20px rgba(0,0,0,.25)";
  leadInputs.btn.style.cursor = "pointer";
  leadInputs.btn.style.zIndex = 6;
  container.appendChild(leadInputs.btn);

  leadInputs.btn.addEventListener("click", onConfirmLeadStep);

  positionLeadUI();
  showLeadStep(deskLeadStep);
}

function destroyLeadUI() {
  Object.values(leadInputs).forEach(el => el && el.remove());
  leadInputs = {};
}

function positionLeadUI() {
  if (!document.getElementById("app")) return;
  const place = (el, x, y, w=320) => {
    if (!el) return;
    el.style.left = `${(x / WIDTH) * 100}%`;
    el.style.top  = `${(y / HEIGHT) * 100}%`;
    el.style.width = `${(w / WIDTH) * 100}%`;
  };

  // botón centrado
  const btnWidth = 300;
  const btnX = (WIDTH - btnWidth) / 2;
  const btnY = 760;
  place(leadInputs.btn, btnX, btnY, btnWidth);

  // step 0: code + phone
  place(leadInputs.code, 60, 520, 80);
  place(leadInputs.phone, 160, 520, 260);

  // step 1: first
  place(leadInputs.first, 60, 520, 360);

  // step 2: last
  place(leadInputs.last, 60, 520, 360);

  // step 3: email
  place(leadInputs.email, 60, 520, 360);
}

function showLeadStep(step) {
  deskLeadStep = Math.max(0, Math.min(3, step));
  const show = (el, vis) => { if (!el) return; el.style.display = vis ? "block" : "none"; };

  show(leadInputs.code,  deskLeadStep === 0);
  show(leadInputs.phone, deskLeadStep === 0);

  show(leadInputs.first, deskLeadStep === 1);
  show(leadInputs.last,  deskLeadStep === 2);
  show(leadInputs.email, deskLeadStep === 3);
}

function onConfirmLeadStep() {
  if (leadSending) return;

  if (deskLeadStep === 0) {
    leadData.phoneCode = (leadInputs.code.value || "").trim() || "+1";
    leadData.phone     = (leadInputs.phone.value || "").trim();
    const ok = /^\+?\d{1,4}$/.test(leadData.phoneCode) && /^\d{5,}$/.test(leadData.phone.replace(/\D/g,""));
    if (!ok) { shake(leadInputs.phone); return; }
    showLeadStep(1);
  } else if (deskLeadStep === 1) {
    leadData.first = (leadInputs.first.value || "").trim();
    if (!leadData.first) { shake(leadInputs.first); return; }
    showLeadStep(2);
  } else if (deskLeadStep === 2) {
    leadData.last = (leadInputs.last.value || "").trim();
    if (!leadData.last) { shake(leadInputs.last); return; }
    showLeadStep(3);
  } else if (deskLeadStep === 3) {
    leadData.email = (leadInputs.email.value || "").trim().toLowerCase();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadData.email);
    if (!ok) { shake(leadInputs.email); return; }

    leadSending = true;
    leadInputs.btn.disabled = true;
    leadInputs.btn.style.opacity = "0.75";
    leadInputs.btn.textContent = "sending…";

    exitDesktopLead(); // hace submit y entra al tutorial
  }
}
function shake(el){
  el.style.transition = "transform .08s";
  el.style.transform = "translateX(6px)";
  setTimeout(()=>{ el.style.transform = "translateX(-6px)"; }, 80);
  setTimeout(()=>{ el.style.transform = "translateX(0)"; }, 160);
}

/* ---------- Punteros ---------- */
function handlePointerDown(x, y) {
  lastPointerX = x; lastPointerY = y; pointerDownX = x; pointerDownY = y;

  if (currentState === STATES.BEGIN) {
    if (isMobile) {
      enterTutorial(); // en mobile ya se resolvió el lead con form.html
    } else {
      let hasLead = false;
      try { hasLead = !!JSON.parse(localStorage.getItem("leadgenData") || "{}").email; } catch {}
      if (!hasLead) enterDesktopLead(); else enterTutorial();
    }
    return;
  }

  if (
    (currentState === STATES.DESK_LEAD ||
     currentState === STATES.TUTORIAL ||
     currentState === STATES.PLAY ||
     currentState === STATES.MATCH) &&
    activeCard && activeCard.canInteract()
  ) { activeCard.startDrag(x, y); }
}
function handlePointerMove(x, y) {
  lastPointerX = x; lastPointerY = y;
  if ((currentState === STATES.TUTORIAL || currentState === STATES.PLAY || currentState === STATES.MATCH) && activeCard) {
    activeCard.drag(x, y);
  }
}
function handlePointerUp(x, y) {
  lastPointerX = x; lastPointerY = y;

  if (currentState === STATES.DESK_LEAD) return;

  // Tutorial: tap abajo avanza
  if (currentState === STATES.TUTORIAL && activeCard) {
    const moved = Math.hypot(x - pointerDownX, y - pointerDownY);
    const isTap = moved < 8;
    if (isTap && y >= HEIGHT * (2 / 3)) { activeCard.release("like"); return; }
    const outcomeTut = activeCard.computeOutcome(); activeCard.release(outcomeTut); return;
  }

  // Match: tap abajo cierra
  if (currentState === STATES.MATCH && activeCard) {
    const moved = Math.hypot(x - pointerDownX, y - pointerDownY);
    const isTap = moved < 8;
    if (isTap && y >= HEIGHT * (2 / 3)) { activeCard = null; exitMatch(); return; }
  }

  // Play/Match swipe
  if ((currentState === STATES.PLAY || currentState === STATES.MATCH) && activeCard) {
    const outcome = activeCard.computeOutcome();
    if (currentState === STATES.PLAY && outcome === "like") {
      if (isSpecialCard(activeCard.data)) { activeCard.cancelForImmediateMatch(); enterMatch(); return; }
    }
    activeCard.release(outcome);
  }
}

/* ---------- p5 wrappers ---------- */
function touchStarted() { if (!touches.length) return false; touchInProgress = true; const t = touches[0]; const p = getCanvasCoords(t.clientX, t.clientY); handlePointerDown(p.x, p.y); return false; }
function touchMoved() { if (!touches.length) return false; const t = touches[0]; const p = getCanvasCoords(t.clientX, t.clientY); handlePointerMove(p.x, p.y); return false; }
function touchEnded() { const t = touches.length ? touches[0] : null; if (t) { const p = getCanvasCoords(t.clientX, t.clientY); handlePointerUp(p.x, p.y); } else { handlePointerUp(lastPointerX, lastPointerY); } touchInProgress = touches.length > 0; return false; }
function mousePressed(e) { if (touchInProgress) return false; const p = getCanvasCoords(e.clientX, e.clientY); handlePointerDown(p.x, p.y); return false; }
function mouseDragged(e) { if (touchInProgress) return false; const p = getCanvasCoords(e.clientX, e.clientY); handlePointerMove(p.x, p.y); return false; }
function mouseReleased(e) { if (touchInProgress) return false; const p = getCanvasCoords(e.clientX, e.clientY); handlePointerUp(p.x, p.y); return false; }

function getCanvasCoords(clientX, clientY) {
  const rect = canvas.elt.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * WIDTH;
  const y = ((clientY - rect.top) / rect.height) * HEIGHT;
  return { x, y };
}

/* ---------- Card ---------- */
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
  canInteract() { return !this.flying; }
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
      if (forcedOutcome === "like") this.startFlyOut("left");
      else if (forcedOutcome === "dislike") this.startFlyOut("right");
      return forcedOutcome || "none";
    }
    this.dragging = false;
    const outcome = forcedOutcome || this.computeOutcome();
    if (outcome === "like") { this.startFlyOut("left"); return "like"; }
    if (outcome === "dislike") { this.startFlyOut("right"); return "dislike"; }
    this.startReturn(); return "none";
  }
  computeOutcome() {
    const dx = this.x - this.homeX;
    const threshold = WIDTH * 0.25;
    if (dx < -threshold) return "like";     // izquierda = like
    if (dx > threshold) return "dislike";   // derecha   = dislike
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
  startReturn() { this.returning = true; this.done = false; }
  startFlyOut(direction) {
    this.flying = true; this.returning = false; this.done = false;
    const dir = direction === "right" ? 1 : -1;
    this.flyVelocityX = dir * 55;
    this.flyVelocityY = (this.y - this.homeY) * 0.08 + dir * 6;
    this.flyRotationSpeed = dir * 0.08;
  }
  update() {
    if (this.dragging) return;
    if (this.flying) {
      this.x += this.flyVelocityX;
      this.y += this.flyVelocityY;
      this.rotation += this.flyRotationSpeed;
      if (this.x > WIDTH * 1.6 || this.x < -WIDTH * 0.6) {
        this.flying = false; this.done = true;
      }
      return;
    }
    if (this.returning) {
      this.x = lerp(this.x, this.homeX, 0.25);
      this.y = lerp(this.y, this.homeY, 0.25);
      this.rotation = lerp(this.rotation, 0, 0.2);
      if (abs(this.x - this.homeX) < 0.5 && abs(this.y - this.homeY) < 0.5 && abs(this.rotation) < 0.01) {
        this.x = this.homeX; this.y = this.homeY; this.rotation = 0; this.returning = false;
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
    imageMode(CENTER);
    image(this.data.img, 0, 0); // PNGs tamaño exacto → sin escala
    pop();
  }
  isFinished() { return this.done; }
}

/* === Input adapters p5 === */
function touchStarted() { if (!touches.length) return false; touchInProgress = true; const t = touches[0]; const p = getCanvasCoords(t.clientX, t.clientY); handlePointerDown(p.x, p.y); return false; }
function touchMoved() { if (!touches.length) return false; const t = touches[0]; const p = getCanvasCoords(t.clientX, t.clientY); handlePointerMove(p.x, p.y); return false; }
function touchEnded() { const t = touches.length ? touches[0] : null; if (t) { const p = getCanvasCoords(t.clientX, t.clientY); handlePointerUp(p.x, p.y); } else { handlePointerUp(lastPointerX, lastPointerY); } touchInProgress = touches.length > 0; return false; }
function mousePressed(e) { if (touchInProgress) return false; const p = getCanvasCoords(e.clientX, e.clientY); handlePointerDown(p.x, p.y); return false; }
function mouseDragged(e) { if (touchInProgress) return false; const p = getCanvasCoords(e.clientX, e.clientY); handlePointerMove(p.x, p.y); return false; }
function mouseReleased(e) { if (touchInProgress) return false; const p = getCanvasCoords(e.clientX, e.clientY); handlePointerUp(p.x, p.y); return false; }

function getCanvasCoords(clientX, clientY) {
  const rect = canvas.elt.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * WIDTH;
  const y = ((clientY - rect.top) / rect.height) * HEIGHT;
  return { x, y };
}
