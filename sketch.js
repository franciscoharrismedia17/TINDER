// ====== RESOLUCIÓN INTERNA (portrait) ======
const WIDTH = 1080, HEIGHT = 1920;

// ====== ESTADOS ======
const STATES = { BEGIN: "BEGIN", PLAY1: "PLAY1", MATCH: "MATCH", PLAY2: "PLAY2" };
let state = STATES.BEGIN; // inicio

// ====== IMÁGENES ======
let beginImg, matchImg, imgAnne, imgEmily, imgLauren;

// ====== DECK ======
let profiles = [];      // [{name,img,isLaura}]
let cards = [];         // [Card]
let currentIndex = 0;
let lauraMatched = false; // Lauren sólo una vez

// ====== ESCALADO CSS / COORDS ======
let _cnv;
function fitCanvasCSS(){
  if(!_cnv) return;
  const vw = innerWidth, vh = innerHeight;
  const s = Math.min(vw/WIDTH, vh/HEIGHT);
  const st = _cnv.elt.style;
  st.width  = (WIDTH*s)  + "px";
  st.height = (HEIGHT*s) + "px";
}
function toCanvas(clientX,clientY){
  const r = _cnv.elt.getBoundingClientRect();
  return { x:(clientX-r.left)*(WIDTH/r.width), y:(clientY-r.top)*(HEIGHT/r.height) };
}

// ====== MATCH: swipe-right para cerrar ======
let matchSwipeX0 = null;

// ====== p5 ======
function preload(){
  beginImg  = loadImage("BEGIN.png");
  matchImg  = loadImage("match_n1_1.png", 
  () => console.log("MATCH cargó"),
  (e) => console.error("MATCH no cargó", e)
);
  imgAnne   = loadImage("Anne.png");
  imgEmily  = loadImage("Emily.png");
  imgLauren = loadImage("LAUREN.png"); // nombre exacto
}

function setup(){
  _cnv = createCanvas(WIDTH, HEIGHT);
  _cnv.parent(document.getElementById("app"));
  pixelDensity(1);
  fitCanvasCSS();

  // Orden fijo garantizado: Anne → Emily → Lauren
  profiles = [
    { name:"Anne",   img: imgAnne,   isLaura:false },
    { name:"Emily",  img: imgEmily,  isLaura:false },
    { name:"Lauren", img: imgLauren, isLaura:true  } // ← like aquí => MATCH
  ];
  rebuild();
}
function windowResized(){ fitCanvasCSS(); }

function rebuild(){
  cards = profiles.map(p => new Card(p));
  currentIndex = 0;
}

function draw(){
  background(0);

  if (state === STATES.BEGIN) {
    drawImageCover(beginImg, WIDTH/2, HEIGHT/2, WIDTH, HEIGHT);
    return;
  }

  if (state === STATES.PLAY1 || state === STATES.PLAY2) {
    if (cards.length === 0) {
      // seguridad: reponer (Lauren ya no vuelve en PLAY2)
      profiles = [
        { name:"Anne",  img: imgAnne,  isLaura:false },
        { name:"Emily", img: imgEmily, isLaura:false }
      ];
      rebuild();
    }
    if (currentIndex >= cards.length) currentIndex = 0; // loop
    cards[currentIndex].draw();
    return;
  }

if (state === STATES.MATCH) {
  background(0);
  if (matchImg && matchImg.width > 0 && matchImg.height > 0) {
    push();
    resetMatrix();      // limpia cualquier transform previa
    noTint();
    imageMode(CORNER);
    image(matchImg, 0, 0, WIDTH, HEIGHT);
    pop();
  } else {
    background(80, 0, 120);
    fill(255); textAlign(CENTER, CENTER); textSize(64);
    text("MATCH (imagen no cargó)", WIDTH/2, HEIGHT/2);
  }
  return;
}

// --- DEBUG OVERLAY ---
push();
noStroke();
fill(255);
textAlign(LEFT, TOP);
textSize(36);
const cardName = cards[currentIndex]?.data?.name || "-";
text(`state:${state}  idx:${currentIndex}  card:${cardName}`, 24, 24);
pop();

}

// ====== INPUT (SOLO SWIPE) ======
// Touch
function touchStarted(){
  if (!touches.length) return false;
  const p = toCanvas(touches[0].clientX, touches[0].clientY);

  if (state === STATES.BEGIN) { state = STATES.PLAY1; return false; }

  if (state === STATES.MATCH) { matchSwipeX0 = p.x; return false; }

  // PLAY1/PLAY2: comienza drag de la card
  cards[currentIndex]?.press(p.x, p.y);
  return false;
}
function touchMoved(){
  if (!touches.length) return false;
  const p = toCanvas(touches[0].clientX, touches[0].clientY);
  if (state === STATES.PLAY1 || state === STATES.PLAY2) {
    cards[currentIndex]?.drag(p.x, p.y);
  }
  return false;
}
function touchEnded(){
  if (state === STATES.MATCH) {
    // salir sólo si hubo swipe-right (≥ 120 px)
    if (matchSwipeX0 != null && _lastPointer) {
      const p = toCanvas(_lastPointer.clientX, _lastPointer.clientY);
      if (p.x - matchSwipeX0 >= 120) exitMatch();
    }
    matchSwipeX0 = null;
    return false;
  }

  if (state === STATES.PLAY1 || state === STATES.PLAY2) {
    cards[currentIndex]?.release();
  }
  return false;
}

// Mouse (desktop) — drag para swipe; sin clicks de atajo
let _lastPointer = null;
function mousePressed(e){
  _lastPointer = e;
  const p = toCanvas(e.clientX, e.clientY);
  if (state === STATES.BEGIN) { state = STATES.PLAY1; return false; }
  if (state === STATES.MATCH) { matchSwipeX0 = p.x; return false; }
  if (state === STATES.PLAY1 || state === STATES.PLAY2) cards[currentIndex]?.press(p.x, p.y);
  return false;
}
function mouseDragged(e){
  _lastPointer = e;
  const p = toCanvas(e.clientX, e.clientY);
  if (state === STATES.PLAY1 || state === STATES.PLAY2) cards[currentIndex]?.drag(p.x, p.y);
  return false;
}
function mouseReleased(e){
  _lastPointer = e;
  if (state === STATES.MATCH) {
    const p0 = matchSwipeX0;
    if (p0 != null) {
      const p = toCanvas(e.clientX, e.clientY);
      if (p.x - p0 >= 120) exitMatch(); // swipe derecha
    }
    matchSwipeX0 = null;
    return false;
  }
  if (state === STATES.PLAY1 || state === STATES.PLAY2) cards[currentIndex]?.release();
  return false;
}

function exitMatch(){
  if (!lauraMatched) {
    // primer match (Lauren) → pasar a nivel 2
    lauraMatched = true;
    profiles = profiles.filter(p => !p.isLaura); // quitar Lauren
    rebuild();
    state = STATES.PLAY2;
  } else {
    // (por si en el futuro hubiera más matches) — ahora no se usa.
    state = STATES.PLAY2;
  }
}

// ====== CARD ======
class Card{
  constructor(data){
    this.data = data;        // { name, img, isLaura }
    this.img  = data.img;

    this.x = WIDTH/2;
    this.y = HEIGHT/2;
    this.rot = 0;

    this.dragging = false;
    this.offX = 0;
    this.offY = 0;
  }

  draw(){
    push();
    translate(this.x, this.y);
    rotate(radians(this.rot));
    drawImageCover(this.img, 0, 0, WIDTH, HEIGHT);
    pop();
  }

  _inside(px,py){
    const dx = px - this.x, dy = py - this.y;
    const r  = radians(-this.rot);
    const rx = dx * cos(r) - dy * sin(r);
    const ry = dx * sin(r) + dy * cos(r);
    return abs(rx) <= WIDTH/2 && abs(ry) <= HEIGHT/2;
  }

  press(px,py){
    if (this._inside(px,py)) {
      this.dragging = true;
      this.offX = px - this.x;
      this.offY = py - this.y;
    }
  }

  drag(px,py){
    if (!this.dragging) return;
    this.x = px - this.offX;
    this.y = py - this.offY;
    this.rot = map(this.x - WIDTH/2, -220, 220, -12, 12, true);
  }

  release(){
    if (!this.dragging) return;
    this.dragging = false;

    const dx = this.x - WIDTH/2;
    const th = WIDTH * 0.25;

    if (dx > th) {
  // LIKE (derecha)
  this._flyOut(30);

  // --- detección robusta de Lauren ---
  const likedLaura =
      (this.data.isLaura === true) ||
      (this.img === imgLauren) ||
      ((this.data.name || "").toLowerCase().includes("laur"));

  if (state === STATES.PLAY1) {
    if (likedLaura && !lauraMatched) {
      console.log("→ ENTRO A MATCH (PLAY1, Lauren)");
      state = STATES.MATCH;
    } else {
      currentIndex++;
    }
  } else if (state === STATES.PLAY2) {
    // Nivel 2: NUNCA hay match — sólo avanzar
    currentIndex++;
  }
}

    else if (dx < -th) {
  this._flyOut(-30);
  currentIndex++;
} else {
  this._snapBack();
}
  }

  _flyOut(d){
    const s=this;
    const t=setInterval(()=>{
      s.x += d;
      s.rot += d * 0.10;
      if (s.x < -WIDTH || s.x > WIDTH*2) clearInterval(t);
    },16);
  }

  _snapBack(){
    const s=this;
    const t=setInterval(()=>{
      s.x = lerp(s.x, WIDTH/2, 0.22);
      s.y = lerp(s.y, HEIGHT/2, 0.22);
      s.rot *= 0.78;
      if (abs(s.x-WIDTH/2)<0.6 && abs(s.y-HEIGHT/2)<0.6 && abs(s.rot)<0.25){
        clearInterval(t); s.x=WIDTH/2; s.y=HEIGHT/2; s.rot=0;
      }
    },16);
  }
}

// ====== UTIL ======
function drawImageCover(img,cx,cy,w,h){
  if(!img) return;
  const iw=img.width, ih=img.height, tr=w/h, ir=iw/ih;
  let sw,sh; if(ir>tr){ sh=ih; sw=ih*tr; } else { sw=iw; sh=iw/tr; }
  const sx=(iw-sw)/2, sy=(ih-sh)/2;
  imageMode(CENTER);
  image(img, cx, cy, w, h, sx, sy, sw, sh);
}
