/* =========================================================
   sinr — sketch.js (p5.js)
   - Canvas: 440 x 956
   - Desktop: Lead Gen (UNA pantalla) con 4 campos + SUBMIT
   - Lead gen embebido tanto en desktop como en mobile cuando falta lead
   - Tutorial (2 pantallas) -> Niveles 1..3 (matches) -> vuelve a L1
   - Swipe: DERECHA = LIKE (umbral igual), IZQUIERDA = DISLIKE
   - Match: igual que card + tap tercio inferior para cerrar
   - Timer (solo PLAY): DS-DIGII.TTF, si llega a 0 => MATCH3
   - Audio: música loop, sfx de botón, swipes y matches (L1/L2 match.wav, L3 matchl3.mp3)
   ========================================================= */

const WIDTH = 440;
const HEIGHT = 956;

// === HEADLINE knobs (editables a mano o con teclado) ===
const HEAD = {
  top: 120,     // Y del centro del header (mover arriba/abajo)
  height: 220,  // alto visible del header (recorte)
  offsetX: 0,   // corrimiento horizontal (+ derecha / - izquierda)
};
const FORM = {
  centerX: -550,  // 440 / 2 → centrado
  top: 400,      // primer input, justo debajo del logo
  gap: 70,       // separación entre inputs
  width: 280,    // ancho razonable para que no toque bordes
  btnY: 700,     // botón más abajo
  btnW: 200      // ancho del botón
};

const STATES = {
  BEGIN: "BEGIN",
  LEAD_DESK: "LEAD_DESK",
  TUTORIAL1: "TUTORIAL1",
  TUTORIAL2: "TUTORIAL2",
  PLAY1: "PLAY1",
  MATCH1: "MATCH1",
  PLAY2: "PLAY2",
  MATCH2: "MATCH2",
  PLAY3: "PLAY3",
  MATCH3: "MATCH3",
};

const LEAD_STORAGE_KEY = "leadData";
let SWIPE_THRESHOLD = WIDTH * 0.25; // ← ahora let

const SWIPE_LEFT  = -1; // DISLIKE
const SWIPE_RIGHT =  1; // LIKE
const SWIPE_NONE  =  0;

const DEFAULT_LEVEL_TIMER = 45;
const LEAD_ENDPOINT = "https://script.google.com/macros/s/AKfycbwphoerOCsTZY8zO9sPrIm3jflR6dcPomfJCf1Xb3_gj90Ekzb1QOOEL0vHy5TdnoJO/exec";

/* ---------- Assets ---------- */
let canvas;
let digitalFont;
let imgBegin;
let imgLeadHeader; // usamos solo el headline de una imagen

let tutorialImages = [];
let matchImages = {};

/* ---------- Audio ---------- */
// KNOBS (podés cambiarlos)
let MASTER_GAIN = 0.9;
let MUSIC_GAIN  = 0.6;
let SFX_GAIN    = 0.9;

let SFX = {
  music: null,     // music.wav (loop)
  btn: null,       // Button.wav
  like: null,      // like.wav  (swipe derecha)
  dislike: null,   // dislike.mp3 (swipe izquierda)
  match12: null,   // match.wav  (L1/L2)
  match3: null,    // matchl3.mp3 (L3) -> stop música
};
let audioPrimed = false;
let musicStarted = false;
// ---- Audio shims/guards (por si p5.sound no cargó aún) ----
const HAS_P5_SOUND =
  typeof window !== 'undefined' &&
  typeof window.masterVolume === 'function' &&
  typeof window.getAudioContext === 'function';

function safeMasterVolume(v){
  if (typeof window.masterVolume === 'function') window.masterVolume(v);
}

function safeSoundFormats(){
  if (typeof window.soundFormats === 'function') window.soundFormats.apply(null, arguments);
}

function safeLoadSound(path){
  return (typeof window.loadSound === 'function') ? loadSound(path) : null;
}


function ensureAudioContext(){
  if (audioPrimed) return;
  const ac = (window.getAudioContext && window.getAudioContext()) || null;
  if (ac && ac.state !== "running") {
    try { ac.resume(); } catch(e){}
  }
  audioPrimed = true;
}

function startMusic(){
  if (!SFX.music) return;
  if (!SFX.music.isPlaying()) {
    SFX.music.setLoop(true);
    SFX.music.setVolume(MUSIC_GAIN);
    SFX.music.play();
    musicStarted = true;
  } else {
    SFX.music.setVolume(MUSIC_GAIN);
  }
}
function stopMusic(){ if (SFX.music && SFX.music.isPlaying()) SFX.music.stop(); }

function playSfx(key){
  const snd = SFX[key];
  if (!snd) return;
  try { snd.stop(); } catch(e){}
  snd.setVolume(SFX_GAIN);
  snd.play();
}
function stopAllSfx(){
  Object.keys(SFX).forEach(key => {
    const snd = SFX[key];
    if (snd && typeof snd.stop === 'function') {
      try { snd.stop(); } catch(e){}
    }
  });
}


// Exponer “knobs” para ajustar en runtime (consola: audio.setMusic(0.3), etc.)
function setMasterGain(v){ MASTER_GAIN = constrain(v,0,1); masterVolume(MASTER_GAIN); }
function setMusicGain(v){ MUSIC_GAIN = constrain(v,0,1); if (SFX.music && SFX.music.isPlaying()) SFX.music.setVolume(MUSIC_GAIN); }
function setSfxGain(v){ SFX_GAIN = constrain(v,0,1); }
window.audio = { setMaster: setMasterGain, setMusic: setMusicGain, setSfx: setSfxGain };

/* ---------- Cartas ---------- */
const CARD_DEFS = [
  { id: "profile1",  name: "Profile 1",  file: "Profile_1.png" },
  { id: "profile2",  name: "Profile 2",  file: "Profile_2.png" },
  { id: "profile3",  name: "Profile 3",  file: "Profile_3.png" },
  { id: "profile4",  name: "Profile 4",  file: "Profile_4.png" },
  { id: "profile5",  name: "Profile 5",  file: "Profile_5.png" },
  { id: "profile6",  name: "Profile 6",  file: "Profile_6.png" },
  { id: "profile7",  name: "Profile 7",  file: "Profile_7.png" },
  { id: "profile8",  name: "Profile 8",  file: "Profile_8.png" },
  { id: "profile9",  name: "Profile 9",  file: "Profile_9.png" },
  { id: "profile10", name: "Profile 10", file: "Profile_10.png" },
  { id: "lauren",    name: "LAUREN",     file: "LAUREN.png", matchKey: "lauren" },
  { id: "tracy",     name: "TRACY",      file: "TRACY.png",  matchKey: "tracy" },
  { id: "angela",    name: "ANGELA",     file: "ANGELA.png", matchKey: "angela" },
];
let cardCatalog = {};

const LEVELS = [
  { playState: STATES.PLAY1, matchState: STATES.MATCH1, specialId: "lauren", matchImgKey: "matchL1" },
  { playState: STATES.PLAY2, matchState: STATES.MATCH2, specialId: "tracy",  matchImgKey: "matchL2" },
  { playState: STATES.PLAY3, matchState: STATES.MATCH3, specialId: "angela", matchImgKey: "matchL3" },
];

let levelProgress = [];
let currentState = STATES.BEGIN;
let currentLevelIndex = 0;
let currentMatchLevel = -1;

/* ---------- Mazo ---------- */
let deck = [];
let currentCardIndex = 0;
let activeCard = null;

/* ---------- Timer ---------- */
let timerSeconds = DEFAULT_LEVEL_TIMER;
let timerRunning = false;
let lastTimerUpdate = 0;
const TIMER_POS = { x: WIDTH/2, y: 20 };

/* ---------- Lead Desktop (1 pantalla: 4 inputs + botón) ---------- */
let storedLeadData = null;
let leadSubmitting = false;
let leadData = { firstName:"", lastName:"", email:"", phone:"" };

let elFirst=null, elLast=null, elEmail=null, elPhone=null, elBtn=null;
let leadWrapEl=null, leadFormEl=null;
let leadMobileCleanup=null;
let leadMobileActive=false;
let leadMobileRaf=null;

/* ---------- Input tracking ---------- */
let touchInProgress = false;
let lastPointerX = WIDTH/2;
let lastPointerY = HEIGHT/2;
let pointerDownX = WIDTH/2;
let pointerDownY = HEIGHT/2;
let pointerDownTime = 0;

/* =====================
   Carga de recursos
   ===================== */
function preload() {
  imgBegin = loadImage("BEGIN.png");

  // Usamos el headline de tu lead anterior (podés cambiar por otra, p.ej. LEAD_HEAD.png)
  imgLeadHeader = loadImage("LEAD_G 1.png");

  tutorialImages = [ loadImage("TUTORIAL_L1b.png"), loadImage("TUTORIAL_L1c.png") ];
  matchImages.matchL1 = loadImage("MATCH_L1.png");
  matchImages.matchL2 = loadImage("MATCH_L2.png");
  matchImages.matchL3 = loadImage("MATCH_L3.png");
  digitalFont = loadFont("DS-DIGII.TTF");

  CARD_DEFS.forEach(def => {
    const img = loadImage(def.file);
    cardCatalog[def.id] = { id:def.id, name:def.name, img, matchKey:def.matchKey || null };
  });

  // ---------- AUDIO ----------
  safeSoundFormats('mp3','wav','ogg');
SFX.music   = safeLoadSound('music.wav');
SFX.btn     = safeLoadSound('Button.wav');
SFX.like    = safeLoadSound('like.wav');
SFX.dislike = safeLoadSound('dislike.mp3');
SFX.match12 = safeLoadSound('match.wav');
SFX.match3  = safeLoadSound('matchl3.mp3');
}

/* =====================
   Setup & Resize
   ===================== */
function setup() {
  storedLeadData = loadStoredLead();

  pixelDensity(1);
  canvas = createCanvas(WIDTH, HEIGHT);
  canvas.parent("app");
  canvas.elt.addEventListener("touchcancel", onTouchCancel, { passive:false });
  imageMode(CENTER);
  noStroke();
  fitCanvasCSS();
  SWIPE_THRESHOLD = WIDTH * (isMobileDevice() ? 0.18 : 0.25);


  levelProgress = LEVELS.map(() => ({ matched:false }));
  currentState = STATES.BEGIN;

  purgeLeadDom(); // limpieza por si el preview deja restos

  // AUDIO init
  safeMasterVolume(MASTER_GAIN);
}

function windowResized(){ fitCanvasCSS(); positionLeadUI(); }
function fitCanvasCSS() {
  if (!canvas) return;
  const scale = Math.min(windowWidth/WIDTH, windowHeight/HEIGHT);
  const w = `${WIDTH*scale}px`, h = `${HEIGHT*scale}px`;
  canvas.elt.style.width = w; canvas.elt.style.height = h;
  const container = document.getElementById("app");
  if (container) { container.style.width = w; container.style.height = h; container.style.position = "relative"; }
}

/* =====================
   Draw loop
   ===================== */
function draw() {
  background(0);
  noTint();

  updateTimer();

  switch (currentState) {
    case STATES.BEGIN:
      drawImageExact(imgBegin);
      break;
    case STATES.LEAD_DESK:
      drawLeadScreen();
      break;
    case STATES.TUTORIAL1:
      drawImageExact(tutorialImages[0]);
      break;
    case STATES.TUTORIAL2:
      drawImageExact(tutorialImages[1]);
      break;
    case STATES.PLAY1:
    case STATES.PLAY2:
    case STATES.PLAY3:
      drawPlayState();
      break;
    case STATES.MATCH1:
    case STATES.MATCH2:
    case STATES.MATCH3:
      drawMatchState();
      break;
  }

  if (shouldShowTimer()) drawTimer();
}

/* =====================
   Lead: pantalla única
   ===================== */
function drawLeadScreen(){
  if (!imgLeadHeader) { background(0); return; }

  const HEAD_H   = HEAD.height;
  const HEAD_TOP = HEAD.top;

  // recorte solo de la franja superior del PNG
  const cropH = imgLeadHeader.height * (HEAD_H / HEIGHT);

  imageMode(CENTER);
  image(
    imgLeadHeader,
    WIDTH/2 + HEAD.offsetX, HEAD_TOP,   // <- podés mover X con offsetX
    WIDTH, HEAD_H,
    0, 0, imgLeadHeader.width, cropH
  );

  // “zona inputs” pintada de negro
  noStroke(); fill(0);
  rect(0, HEAD_TOP + HEAD_H/2, WIDTH, HEIGHT - (HEAD_TOP + HEAD_H/2));
}

function enterLeadDesktop(){
  currentState = STATES.LEAD_DESK;
  leadData = storedLeadData ? { ...storedLeadData } : { firstName:"", lastName:"", email:"", phone:"" };

  touchInProgress = false;

  // el canvas no captura clicks mientras está el lead
  canvas.elt.style.zIndex = "0";
  canvas.elt.style.pointerEvents = "none";

  purgeLeadDom();
  createLeadUI();
  positionLeadUI();
  setupLeadMobileBehaviour();

  // foco al primero una sola vez
  if (elFirst){
    elFirst.setAttribute("autocomplete","given-name");
    elFirst.setAttribute("autocapitalize","words");
    const focusFirst = () => {
      if (!elFirst) return;
      try { elFirst.focus({ preventScroll: false }); }
      catch(e){ elFirst.focus(); }
    };
    focusFirst();
    setTimeout(focusFirst, 60);
  }
  if (elPhone) elPhone.setAttribute("inputmode","tel");
  if (elEmail) elEmail.setAttribute("inputmode","email");

  // evita que p5 reciba teclas/clicks desde inputs
  [elFirst, elLast, elEmail, elPhone, elBtn].forEach(el=>{
    if (!el) return;
    ["mousedown","touchstart","keydown","keyup","keypress"].forEach(ev=>{
      el.addEventListener(ev, e => e.stopPropagation());
    });
  });
}

function exitLeadDesktopAndGoTutorial(){
  destroyLeadUI();
  purgeLeadDom();
  // restaurar canvas
  canvas.elt.style.pointerEvents = "auto";
  startTutorialFlow();
}

function createLeadUI(){
  const c = document.getElementById("app");
  if (!c) return;

  leadWrapEl = document.createElement("div");
  leadWrapEl.id = "leadWrap";
  Object.assign(leadWrapEl.style, {
    position: "absolute",
    inset: "0",
  });
  c.appendChild(leadWrapEl);

  leadFormEl = document.createElement("div");
  leadFormEl.id = "leadForm";
  Object.assign(leadFormEl.style, {
    position: "absolute",
    inset: "0",
  });
  leadWrapEl.appendChild(leadFormEl);

  const mkInput = (id, type, placeholder) => {
    const el = document.createElement("input");
    el.id = id;
    el.type = type;
    el.placeholder = placeholder;
    Object.assign(el.style, {
      position:"absolute",
      zIndex:"1000",
      pointerEvents:"auto",
      fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      fontSize:"16px",
      color:"#fff",
      background:"transparent",
      border:"none",
      borderBottom:"2px solid #fff",
      outline:"none",
      padding:"6px 10px",
      boxSizing:"border-box",
      zIndex:4,
    });
    leadFormEl.appendChild(el);
    return el;
  };

  elFirst = mkInput("lead-first", "text", "first name");
  elLast  = mkInput("lead-last",  "text", "last name");
  elEmail = mkInput("lead-email", "email","email address");
  elPhone = mkInput("lead-phone", "tel",  "phone number");

  elFirst.value = leadData.firstName || "";
  elLast.value  = leadData.lastName  || "";
  elEmail.value = leadData.email     || "";
  elPhone.value = leadData.phone     || "";

  elBtn = document.createElement("button");
  elBtn.id = "lead-submit";
  elBtn.textContent = "SUBMIT";
  Object.assign(elBtn.style, {
    position:"absolute",
    border:"none",
    padding:"12px 18px",
    color:"#fff",
    fontWeight:"700",
    fontSize:"18px",
    borderRadius:"22px",
    background:"linear-gradient(90deg,#ff6a7a,#c61c0c)",
    boxShadow:"0 6px 20px rgba(0,0,0,.25)",
    cursor:"pointer",
    zIndex:5,
  });
  elBtn.addEventListener("click", () => { ensureAudioContext(); playSfx('btn'); onLeadSubmit(); });
  leadFormEl.appendChild(elBtn);
}

function destroyLeadUI(){
  cleanupLeadMobileBehaviour();
  elFirst=elLast=elEmail=elPhone=elBtn=null;
  if (leadWrapEl) {
    leadWrapEl.remove();
    leadWrapEl=null;
    leadFormEl=null;
  }
}

function purgeLeadDom(){
  const c = document.getElementById("app");
  if (!c) return;
  const keep = new Set(["leadWrap","leadForm","lead-first","lead-last","lead-email","lead-phone","lead-submit"]);
  Array.from(c.querySelectorAll("input,button")).forEach(el=>{
    if (!keep.has(el.id)) {
      const pos = getComputedStyle(el).position;
      if (pos === "absolute") el.remove();
    }
  });
}
function positionLeadUI(){
  if (!canvas) return;
  if (isMobileDevice() && leadMobileActive) return;
  const r = canvas.elt.getBoundingClientRect();

  // helpers para convertir coords de canvas -> pantalla
  const px = (x) => r.left + (x / WIDTH)  * r.width;
  const py = (y) => r.top  + (y / HEIGHT) * r.height;
  const pw = (w) => (w / WIDTH) * r.width;

  // centramos el bloque por su centro (robusto en cualquier escala)
  const inputW = FORM.width;
  const leftX  = FORM.centerX - inputW/2;   // alineado al centro
  const xPx    = px(leftX);
  const wPx    = pw(inputW);

  // posiciones Y
  const y1 = FORM.top;
  const y2 = y1 + FORM.gap;
  const y3 = y2 + FORM.gap;
  const y4 = y3 + FORM.gap;

  const place = (el, y) => {
    if (!el) return;
    el.style.left   = `${xPx}px`;
    el.style.top    = `${py(y)}px`;
    el.style.width  = `${wPx}px`;
    el.style.height = `${Math.max(28, (32/WIDTH)*r.width)}px`;
  };

  place(elFirst, y1);
  place(elLast,  y2);
  place(elEmail, y3);
  place(elPhone, y4);

  if (elBtn){
    const btnLeftPx = px(FORM.centerX - FORM.btnW/2);
    elBtn.style.left  = `${btnLeftPx}px`;
    elBtn.style.top   = `${py(FORM.btnY)}px`;
    elBtn.style.width = `${pw(FORM.btnW)}px`;
  }
}



function requestLeadMobileReframe(){
  if (!isMobileDevice() || !leadWrapEl) return;
  if (leadMobileRaf !== null) cancelAnimationFrame(leadMobileRaf);
  leadMobileRaf = requestAnimationFrame(()=>{
    leadMobileRaf = null;
    reframeLeadForMobile();
  });
}

function reframeLeadForMobile(){
  if (!isMobileDevice() || !leadWrapEl) return;
  const viewport = window.visualViewport || null;
  const vw = viewport ? viewport.width : window.innerWidth;
  const vh = viewport ? viewport.height : window.innerHeight;
  const offsetTop = viewport ? viewport.offsetTop : 0;
  const offsetLeft = viewport ? viewport.offsetLeft : 0;
  let width = Math.max(200, vw - 24);
  width = Math.min(width, 420);
  width = Math.min(width, vw);

  leadMobileActive = true;
  leadWrapEl.classList.add("lead-mobile");
  Object.assign(leadWrapEl.style, {
    position: "fixed",
    left: `${offsetLeft}px`,
    top: `${offsetTop}px`,
    width: `${vw}px`,
    height: `${vh}px`,
    padding: "12px 12px 24px",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    overflowY: "auto",
    pointerEvents: "auto",
    gap: "0",
  });

  if (leadFormEl) {
    Object.assign(leadFormEl.style, {
      position: "relative",
      inset: "",
      pointerEvents: "auto",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      alignItems: "stretch",
      width: `${width}px`,
      maxWidth: "420px",
      margin: "0 auto",
      padding: "0",
    });
  }

  const inputs = [elFirst, elLast, elEmail, elPhone];
  inputs.forEach(el => {
    if (!el) return;
    Object.assign(el.style, {
      position: "relative",
      left: "",
      top: "",
      width: "100%",
      height: "",
    });
  });

  if (elBtn) {
    Object.assign(elBtn.style, {
      position: "relative",
      left: "",
      top: "",
      width: "100%",
    });
  }

  const contentHeight = leadFormEl ? leadFormEl.offsetHeight : 0;
  let paddingTop = 12;
  if (contentHeight && contentHeight + 24 < vh) {
    paddingTop = Math.max(12, (vh - contentHeight) / 2);
  }
  leadWrapEl.style.paddingTop = `${paddingTop}px`;

  const active = document.activeElement;
  if (active && leadWrapEl.contains(active)) {
    const activeRect = active.getBoundingClientRect();
    const visibleTop = offsetTop + 16;
    const visibleBottom = offsetTop + vh - 16;
    if (activeRect.bottom > visibleBottom) {
      leadWrapEl.scrollTop += activeRect.bottom - visibleBottom;
    } else if (activeRect.top < visibleTop) {
      leadWrapEl.scrollTop += activeRect.top - visibleTop;
    }
  }
}

function setupLeadMobileBehaviour(){
  if (!isMobileDevice() || !leadWrapEl) return;
  if (leadMobileCleanup) leadMobileCleanup();

  const viewport = window.visualViewport || null;
  const focusHandler = () => requestLeadMobileReframe();
  const blurHandler = () => { setTimeout(requestLeadMobileReframe, 50); };
  const elements = [elFirst, elLast, elEmail, elPhone, elBtn].filter(Boolean);
  elements.forEach(el => {
    el.addEventListener("focus", focusHandler);
    el.addEventListener("blur", blurHandler);
  });

  const viewportHandler = () => requestLeadMobileReframe();
  if (viewport) {
    viewport.addEventListener("resize", viewportHandler);
    viewport.addEventListener("scroll", viewportHandler);
  }
  window.addEventListener("resize", viewportHandler);
  window.addEventListener("orientationchange", viewportHandler);

  requestLeadMobileReframe();
  setTimeout(requestLeadMobileReframe, 120);

  leadMobileCleanup = () => {
    if (leadMobileRaf !== null) { cancelAnimationFrame(leadMobileRaf); leadMobileRaf = null; }
    elements.forEach(el => {
      el.removeEventListener("focus", focusHandler);
      el.removeEventListener("blur", blurHandler);
    });
    if (viewport) {
      viewport.removeEventListener("resize", viewportHandler);
      viewport.removeEventListener("scroll", viewportHandler);
    }
    window.removeEventListener("resize", viewportHandler);
    window.removeEventListener("orientationchange", viewportHandler);

    if (leadMobileActive) {
      leadMobileActive = false;
      if (leadWrapEl) {
        leadWrapEl.classList.remove("lead-mobile");
        Object.assign(leadWrapEl.style, {
          position: "absolute",
          inset: "0",
          pointerEvents: "",
          left: "",
          top: "",
          width: "",
          height: "",
          padding: "",
          boxSizing: "",
          display: "",
          justifyContent: "",
          alignItems: "",
          overflowY: "",
          gap: "",
        });
        leadWrapEl.scrollTop = 0;
      }
      if (leadFormEl) {
        Object.assign(leadFormEl.style, {
          position: "absolute",
          inset: "0",
          pointerEvents: "",
          display: "",
          flexDirection: "",
          gap: "",
          alignItems: "",
          width: "",
          maxWidth: "",
          margin: "",
          padding: "",
        });
      }
      [elFirst, elLast, elEmail, elPhone].forEach(el => {
        if (!el) return;
        Object.assign(el.style, {
          position: "absolute",
          left: "",
          top: "",
          width: "",
          height: "",
        });
      });
      if (elBtn) {
        Object.assign(elBtn.style, {
          position: "absolute",
          left: "",
          top: "",
          width: "",
        });
      }
      if (canvas) positionLeadUI();
    }
  };
}

function cleanupLeadMobileBehaviour(){
  if (leadMobileCleanup) {
    leadMobileCleanup();
    leadMobileCleanup = null;
  }
}

function isLeadTouch(e){
  if (currentState !== STATES.LEAD_DESK) return false;
  if (!leadWrapEl) return true;
  if (e && typeof e.composedPath === "function") {
    const path = e.composedPath();
    if (Array.isArray(path) && path.includes(leadWrapEl)) return true;
  }
  const target = e && (e.target || null);
  if (!target) return true;
  if (target === window || target === document) return true;
  if (typeof target === "object" && target !== null && "nodeType" in target) {
    return leadWrapEl.contains(target);
  }
  return true;
}

function onLeadSubmit(){
  if (leadSubmitting) return;
  const trim = s => (s||"").trim();

  leadData = {
    firstName: trim(elFirst?.value),
    lastName:  trim(elLast?.value),
    email:     trim(elEmail?.value),
    phone:     trim(elPhone?.value),
  };

  const mark = (el, bad) => { if (el) el.style.borderBottomColor = bad ? "#ff6060" : "#ffffff"; };

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadData.email.toLowerCase());
  const phoneOk = /^\+?\d[\d\s\-()]{5,}$/.test(leadData.phone);

  mark(elFirst, !leadData.firstName);
  mark(elLast,  !leadData.lastName);
  mark(elEmail, !emailOk);
  mark(elPhone, !phoneOk);

  if (!leadData.firstName || !leadData.lastName || !emailOk || !phoneOk) return;

  [elFirst, elLast, elEmail, elPhone].forEach(el => { if (el && typeof el.blur === "function") el.blur(); });
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    try { document.activeElement.blur(); } catch(e){}
  }

  leadSubmitting = true;
  if (elBtn){ elBtn.disabled = true; elBtn.style.opacity = "0.75"; elBtn.textContent = "sending…"; }

  try { localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(leadData)); } catch(e){}

  const payload = {
    first: leadData.firstName,
    last:  leadData.lastName,
    email: leadData.email,
    phone: leadData.phone,
    platform: isMobileDevice() ? "mobile" : "desktop",
    userAgent: navigator.userAgent || ""
  };

  sendLeadToSheet(payload).finally(()=>{
    exitLeadDesktopAndGoTutorial();
  });
}

/* =====================
   Envío a Google Sheets
   ===================== */
async function sendLeadToSheet(payload){
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 10000);
  try{
    const body = new URLSearchParams(payload); // sin headers → sin preflight
    const res = await fetch(LEAD_ENDPOINT, { method:'POST', body, signal:controller.signal });
    clearTimeout(timeout);
    let data = null; try { data = await res.json(); } catch { data = { ok: res.ok }; }
    return { ok: !!(data && data.ok), data, status: res.status };
  } catch (err){
    clearTimeout(timeout);
    return { ok:false, error:String(err?.message||err) };
  }
}

/* =====================
   Tutorial & Niveles
   ===================== */
function startTutorialFlow(){ currentState = STATES.TUTORIAL1; activeCard = null; }

function startLevel(levelIndex){
  currentLevelIndex = levelIndex % LEVELS.length;
  buildDeckForCurrentLevel();
  currentCardIndex = 0;
  activeCard = deck.length ? new Card(deck[currentCardIndex]) : null;
  currentState = LEVELS[currentLevelIndex].playState;
  startTimer(DEFAULT_LEVEL_TIMER);

  // música si aún no empezó (tras interacción)
  if (audioPrimed && !musicStarted) startMusic();
}

function buildDeckForCurrentLevel(){
  const profiles = Object.values(cardCatalog)
    .filter(d => !d.matchKey)
    .map(d => createCardData(d.id))
    .filter(c => c && c.img);
  shuffleInPlace(profiles);

  const specialId = LEVELS[currentLevelIndex].specialId;
  const special = createCardData(specialId);

  const mixed = profiles.slice();
  if (special && special.img) {
    const at = floor(random(mixed.length + 1));
    mixed.splice(at, 0, special);
  }
  deck = mixed;
}

function enterMatch(levelIndex){
  stopTimer();
  currentMatchLevel = levelIndex;
  currentState = LEVELS[levelIndex].matchState;

  // SFX de match por nivel
  if (levelIndex === 2) {
    // L3: se detiene la música, y suena matchl3
    stopMusic();
    playSfx('match3');
  } else {
    playSfx('match12'); // L1 y L2
  }

  const img = getCurrentMatchImage();
  activeCard = new Card({ name:`MATCH_${levelIndex+1}`, img, isMatchCard:true });
}

function exitMatch(){
  if (currentMatchLevel < 0) return;
  levelProgress[currentMatchLevel].matched = true;
  const next = currentMatchLevel + 1;
  currentMatchLevel = -1;

  if (next < LEVELS.length) {
    startLevel(next);
  } else {
    // reinicia ciclo a L1; si querés que vuelva a sonar música luego del L3:
    musicStarted = false; // para que startLevel la reencienda si hay interacción previa
    startLevel(0);
  }
}

function getCurrentMatchImage(){
  if (currentMatchLevel < 0) return null;
  return matchImages[LEVELS[currentMatchLevel].matchImgKey] || null;
}

/* =====================
   Play / Match render
   ===================== */
function drawPlayState(){
  if (!activeCard && deck.length) activeCard = new Card(deck[currentCardIndex]);
  if (activeCard) {
    activeCard.update();
    activeCard.draw();
    if (activeCard.isFinished()) {
      activeCard = null;
      advanceToNextCard();
    }
  }
}

function drawMatchState(){
  if (activeCard) {
    activeCard.update();
    activeCard.draw();
    if (activeCard.isFinished()) {
      activeCard = null;
      exitMatch();
    }
  } else {
    const img = getCurrentMatchImage();
    drawImageExact(img);
  }
}

/* =====================
   Timer
   ===================== */
function shouldShowTimer(){
  return (currentState === STATES.PLAY1 || currentState === STATES.PLAY2 || currentState === STATES.PLAY3) && timerSeconds > 0;
}
function startTimer(sec){ timerSeconds = sec; lastTimerUpdate = millis(); timerRunning = true; }
function stopTimer(){ timerRunning = false; }

function updateTimer(){
  if (!timerRunning) return;
  const now = millis();
  const dt = (now - lastTimerUpdate) / 1000;
  lastTimerUpdate = now;
  timerSeconds = Math.max(timerSeconds - dt, 0);
  if (timerSeconds <= 0) {
    timerRunning = false;
    currentLevelIndex = 2;
    enterMatch(2); // acá también se detiene música por la lógica de enterMatch(2)
  }
}

function drawTimer(){
  push();
  resetMatrix();
  textFont(digitalFont);
  textAlign(CENTER, TOP);
  textSize(46);
  const m = Math.floor(Math.max(0, timerSeconds) / 60);
  const s = Math.floor(Math.max(0, timerSeconds) % 60);
  const t = `${m}:${s.toString().padStart(2,"0")}`;
  fill(0,0,0,130); text(t, TIMER_POS.x+2, TIMER_POS.y+2);
  fill(255);       text(t, TIMER_POS.x,   TIMER_POS.y);
  pop();
}

/* =====================
   Input & Gestos
   ===================== */
function onSwipe(dir){
  if (!activeCard) return;
  if (dir === SWIPE_RIGHT) { handleLike(); return; }
  if (dir === SWIPE_LEFT)  { handleDislike(); return; }
  handleNeutral();
}

function handleLike(){
  if (!activeCard) return;
  if (isLevel3Angela()) {
    triggerBlock();
    return;
  }
  playSfx('like');
  const level = LEVELS[currentLevelIndex] || null;
  const progress = levelProgress[currentLevelIndex] || null;
  const specId = level ? level.specialId : null;
  if (specId && activeCard.data && activeCard.data.id === specId && !(progress && progress.matched)) {
    activeCard.cancelForImmediateMatch();
    enterMatch(currentLevelIndex);
    return;
  }
  activeCard.release(SWIPE_RIGHT);
}

function handleDislike(){
  if (!activeCard) return;
  if (isLevel3Angela()) {
    triggerBlock();
    return;
  }
  playSfx('dislike');
  activeCard.release(SWIPE_LEFT);
}

function handleNeutral(){
  if (!activeCard) return;
  activeCard.release(SWIPE_NONE);
}

function isLevel3Angela(){
  if (!activeCard || !activeCard.data) return false;
  const level = LEVELS[currentLevelIndex] || null;
  if (!level || level.specialId !== 'angela') return false;
  if (currentState !== level.playState) return false;
  const data = activeCard.data;
  if (data.id === 'angela') return true;
  if (data.matchKey === 'angela') return true;
  return typeof data.name === 'string' && data.name.toUpperCase() === 'ANGELA';
}

function triggerBlock(){
  stopAllSfx();
  musicStarted = false;
  if (activeCard) {
    activeCard.cancelForImmediateMatch();
  }
  fullGameResetAfterBlock();
  startLevel(0);
}

function fullGameResetAfterBlock(){
  stopTimer();
  timerSeconds = DEFAULT_LEVEL_TIMER;
  timerRunning = false;
  lastTimerUpdate = millis();

  levelProgress = LEVELS.map(() => ({ matched:false }));
  currentLevelIndex = 0;
  currentMatchLevel = -1;

  deck = [];
  currentCardIndex = 0;
  activeCard = null;

  touchInProgress = false;
  lastPointerX = WIDTH/2;
  lastPointerY = HEIGHT/2;
  pointerDownX = WIDTH/2;
  pointerDownY = HEIGHT/2;
  pointerDownTime = 0;

  currentState = STATES.BEGIN;
}

function handlePointerDown(x, y){
  ensureAudioContext(); // desbloquea audio al primer toque

  // 🔊 arranca música en el primer toque del usuario y queda en loop
  if (!musicStarted && SFX.music) {
    SFX.music.setLoop(true);
    SFX.music.setVolume(MUSIC_GAIN);
    SFX.music.play();
    musicStarted = true;
  }

  lastPointerX=x; lastPointerY=y; pointerDownX=x; pointerDownY=y;
  pointerDownTime = millis();

  if (currentState === STATES.BEGIN) {
    playSfx('btn');
    if (shouldShowLeadDesktop()) enterLeadDesktop();
    else startTutorialFlow();
    return;
  }

  if (currentState === STATES.LEAD_DESK) return;

  if (currentState === STATES.TUTORIAL1) { playSfx('btn'); currentState = STATES.TUTORIAL2; return; }
  if (currentState === STATES.TUTORIAL2) { playSfx('btn'); startLevel(0); return; }

  if ((isPlayState(currentState) || isMatchState(currentState)) && activeCard && activeCard.canInteract()) {
    activeCard.startDrag(x, y);
  }
}

function handlePointerMove(x, y){
  lastPointerX=x; lastPointerY=y;
  if ((isPlayState(currentState) || isMatchState(currentState)) && activeCard) {
    activeCard.drag(x, y);
  }
}

function handlePointerUp(x, y){
  lastPointerX=x; lastPointerY=y;

  if (isMatchState(currentState) && activeCard) {
    const moved = Math.hypot(x-pointerDownX, y-pointerDownY);
    const isTap = moved < 10;
    if (isTap && y >= HEIGHT*(2/3)) { activeCard = null; exitMatch(); return; }
    const outcome = activeCard.computeOutcome();
    activeCard.release(outcome);
    return;
  }
  if (isPlayState(currentState) && activeCard) {
    let dir = activeCard.computeOutcome();

    // --- Fallback para mobile: gesto corto/rápido decide ---
    if (dir === SWIPE_NONE && (touchInProgress || isMobileDevice())) {
      const dx   = x - pointerDownX;
      const dist = Math.abs(dx);
      const dur  = max(0.001, (millis() - pointerDownTime) / 1000); // seg
      const speed = dist / dur; // px/seg

      // si casi llegó al umbral o fue un "flick" rápido, forzamos decisión
      if (dist > WIDTH * 0.14 || speed > 280) {
        dir = (dx > 0) ? SWIPE_RIGHT : SWIPE_LEFT;
      }
    }
    // -------------------------------------------------------

    onSwipe(dir);
    return;
  }
}


/* p5 wrappers */
function mousePressed(e){ if (touchInProgress) return false; const p=getCanvasCoords(e.clientX,e.clientY); handlePointerDown(p.x,p.y); return false; }
function mouseDragged(e){ if (touchInProgress) return false; const p=getCanvasCoords(e.clientX,e.clientY); handlePointerMove(p.x,p.y); return false; }
function mouseReleased(e){ if (touchInProgress) return false; const p=getCanvasCoords(e.clientX,e.clientY); handlePointerUp(p.x,p.y); return false; }
function touchStarted(e){
  if (isLeadTouch(e)) return true;
  const fallback = (typeof touches !== "undefined" && Array.isArray(touches) && touches.length) ? touches : null;
  const list = (e && e.touches && e.touches.length) ? e.touches : fallback;
  if (!list || !list.length) return false;
  touchInProgress = true;
  const t = list[0];
  const p = getCanvasCoords(t.clientX, t.clientY);
  handlePointerDown(p.x, p.y);
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  return false;
}
function touchMoved(e){
  if (isLeadTouch(e)) return true;
  const fallback = (typeof touches !== "undefined" && Array.isArray(touches) && touches.length) ? touches : null;
  const list = (e && e.touches && e.touches.length) ? e.touches : fallback;
  if (!list || !list.length) return false;
  const t = list[0];
  const p = getCanvasCoords(t.clientX, t.clientY);
  handlePointerMove(p.x, p.y);
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  return false;
}
function touchEnded(e){
  if (isLeadTouch(e)) return true;
  const fallback = (typeof touches !== "undefined" && Array.isArray(touches) && touches.length) ? touches : null;
  const list = (e && e.changedTouches && e.changedTouches.length) ? e.changedTouches : fallback;
  const t = list && list.length ? list[0] : null;
  if (t){
    const p = getCanvasCoords(t.clientX, t.clientY);
    handlePointerUp(p.x, p.y);
  } else {
    handlePointerUp(lastPointerX, lastPointerY);
  }
  touchInProgress = (typeof touches !== "undefined" && Array.isArray(touches) && touches.length > 0);
  if (e && typeof e.preventDefault === "function") e.preventDefault();
  return false;
}
function onTouchCancel(e){
  const list = (e && e.changedTouches && e.changedTouches.length) ? e.changedTouches : null;
  const t = list && list.length ? list[0] : null;
  if (t){
    const p = getCanvasCoords(t.clientX, t.clientY);
    handlePointerUp(p.x, p.y);
  } else {
    handlePointerUp(lastPointerX, lastPointerY);
  }
  touchInProgress = false;
  if (e && typeof e.preventDefault === "function") e.preventDefault();
}

function getCanvasCoords(clientX, clientY){
  const r = canvas.elt.getBoundingClientRect();
  const x = ((clientX - r.left)/r.width) * WIDTH;
  const y = ((clientY - r.top) /r.height) * HEIGHT;
  return { x, y };
}

/* =====================
   Helpers de estado
   ===================== */
function isPlayState(s){ return s===STATES.PLAY1 || s===STATES.PLAY2 || s===STATES.PLAY3; }
function isMatchState(s){ return s===STATES.MATCH1 || s===STATES.MATCH2 || s===STATES.MATCH3; }
function shouldShowLeadDesktop(){
  const force = /[?&](lead|forceLead|leadgen)=1/.test(location.search);
  return force || !storedLeadData;
}
function loadStoredLead(){
  try { const raw = localStorage.getItem(LEAD_STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function isMobileDevice(){
  const ua = navigator.userAgent || "";
  const touch = (navigator.maxTouchPoints||0) > 0;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua) || (touch && /Macintosh/.test(ua));
}

/* =====================
   Mazo & Cartas
   ===================== */
function createCardData(id){
  const base = cardCatalog[id];
  if (!base) return null;
  return { id: base.id, name: base.name, img: base.img, matchKey: base.matchKey || null };
}
function shuffleInPlace(arr){
  for (let i=arr.length-1; i>0; i--){
    const j = floor(random(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function advanceToNextCard(){
  if (!deck.length) { activeCard = null; return; }
  currentCardIndex = (currentCardIndex + 1) % deck.length;
  activeCard = new Card(deck[currentCardIndex]);
}

/* =====================
   Card
   ===================== */
class Card {
  constructor(data){
    this.data = data;
    this.homeX = WIDTH/2;
    this.homeY = HEIGHT/2;
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
  canInteract(){ return !this.flying; }
  startDrag(px, py){
    if (!this.canInteract()) return;
    this.dragging = true; this.returning = false; this.done = false;
    this.dragOffsetX = px - this.x; this.dragOffsetY = py - this.y;
  }
  drag(px, py){
    if (!this.dragging) return;
    this.x = px - this.dragOffsetX;
    this.y = py - this.dragOffsetY;
    const dx = this.x - this.homeX;
    this.rotation = constrain(dx / (WIDTH * 0.9), -0.35, 0.35);
  }
  computeOutcome(){
    const dx = this.x - this.homeX;
    if (dx >  SWIPE_THRESHOLD) return SWIPE_RIGHT; // DERECHA = LIKE
    if (dx < -SWIPE_THRESHOLD) return SWIPE_LEFT;  // IZQUIERDA = DISLIKE
    return SWIPE_NONE;
  }
  release(forced=null){
    const hasForced = typeof forced === 'number';
    if (!this.dragging && !hasForced) return SWIPE_NONE;
    this.dragging = false;
    const out = hasForced ? forced : this.computeOutcome();
    if (out === SWIPE_RIGHT) { this.startFlyOut(SWIPE_RIGHT); return SWIPE_RIGHT; }
    if (out === SWIPE_LEFT)  { this.startFlyOut(SWIPE_LEFT);  return SWIPE_LEFT; }
    this.startReturn();
    return SWIPE_NONE;
  }
  cancelForImmediateMatch(){
    this.dragging=false; this.flying=false; this.returning=false;
    this.done=true; this.x=this.homeX; this.y=this.homeY; this.rotation=0;
  }
  startReturn(){ this.returning = true; this.done = false; }
  startFlyOut(direction){
    this.flying = true; this.returning = false; this.done = false;
    const dir = direction === SWIPE_RIGHT ? 1 : -1;
    this.flyVelocityX = dir * 55;
    this.flyVelocityY = (this.y - this.homeY) * 0.08 + dir * 6;
    this.flyRotationSpeed = dir * 0.08;
  }
  update(){
    if (this.dragging) return;
    if (this.flying){
      this.x += this.flyVelocityX;
      this.y += this.flyVelocityY;
      this.rotation += this.flyRotationSpeed;
      if (this.x > WIDTH*1.6 || this.x < -WIDTH*0.6) {
        this.flying = false; this.done = true;
      }
      return;
    }
    if (this.returning){
      this.x = lerp(this.x, this.homeX, 0.22);
      this.y = lerp(this.y, this.homeY, 0.22);
      this.rotation = lerp(this.rotation, 0, 0.22);
      if (abs(this.x-this.homeX)<0.5 && abs(this.y-this.homeY)<0.5 && abs(this.rotation)<0.01){
        this.x=this.homeX; this.y=this.homeY; this.rotation=0; this.returning=false;
      }
      return;
    }
    this.x = lerp(this.x, this.homeX, 0.08);
    this.y = lerp(this.y, this.homeY, 0.08);
    this.rotation = lerp(this.rotation, 0, 0.08);
  }
  draw(){
    if (!this.data || !this.data.img) return;
    push(); translate(this.x, this.y); rotate(this.rotation); imageMode(CENTER);
    image(this.data.img, 0, 0); // PNGs exactos a 440x956
    pop();
  }
  isFinished(){ return this.done; }
}

/* =====================
   Utils
   ===================== */
function drawImageExact(img){
  if (!img) return;
  imageMode(CENTER);
  image(img, WIDTH/2, HEIGHT/2);
}
