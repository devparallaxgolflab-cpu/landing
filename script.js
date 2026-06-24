'use strict';

// ─── HUD Canvas ──────────────────────────────────────────────────
const canvas = document.getElementById('hud');
const ctx    = canvas.getContext('2d');

const GOLD  = [201, 168, 76];
const WHITE = [248, 248, 246];
function rgba([r, g, b], a) { return `rgba(${r},${g},${b},${a})`; }

let W = 0, H = 0;
let mouse       = { x: 0, y: 0 };
let smoothMouse = { x: 0, y: 0 };
let ballT = 0, ballDir = 1;
let spinAngle = 0;
let lastTime  = 0;
let hudStarted = false;

function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  if (!hudStarted) {
    mouse.x = smoothMouse.x = W / 2;
    mouse.y = smoothMouse.y = H / 2;
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('touchmove', e => {
  if (e.touches.length) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
}, { passive: true });

function lerp(a, b, t) { return a + (b - a) * t; }

function arcPoints() {
  return {
    p0: { x: W * 0.18, y: H * 0.80 },
    p1: { x: W * 0.40, y: H * 0.52 },
    p2: { x: W * 0.74, y: H * 0.36 }
  };
}
function qb(t, p0, p1, p2) {
  const m = 1 - t;
  return { x: m*m*p0.x + 2*m*t*p1.x + t*t*p2.x, y: m*m*p0.y + 2*m*t*p1.y + t*t*p2.y };
}

function drawGrid(ox, oy) {
  const sp = 68;
  ctx.strokeStyle = rgba(GOLD, 0.055);
  ctx.lineWidth   = 0.5;
  ctx.setLineDash([]);
  for (let x = (ox % sp) - sp; x < W + sp; x += sp) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = (oy % sp) - sp; y < H + sp; y += sp) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawCorners() {
  const sz = 26, m = 26;
  ctx.strokeStyle = rgba(GOLD, 0.5);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  [[m, m, 1, 1], [W-m, m, -1, 1], [m, H-m, 1, -1], [W-m, H-m, -1, -1]].forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x + dx * sz, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * sz);
    ctx.stroke();
  });
}

function drawArc({ p0, p1, p2 }) {
  ctx.strokeStyle = rgba(GOLD, 0.18);
  ctx.lineWidth   = 1;
  ctx.setLineDash([5, 9]);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = rgba(GOLD, 0.4);
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.arc(p2.x, p2.y, 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = rgba(GOLD, 0.55);
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(([nx, ny]) => {
    ctx.beginPath();
    ctx.moveTo(p2.x + nx * 13, p2.y + ny * 13);
    ctx.lineTo(p2.x + nx * 18, p2.y + ny * 18);
    ctx.stroke();
  });

  ctx.fillStyle = rgba(GOLD, 0.3);
  ctx.beginPath();
  ctx.arc(p0.x, p0.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawBall(ap) {
  const pos = qb(ballT, ap.p0, ap.p1, ap.p2);

  // Trail
  for (let i = 5; i >= 1; i--) {
    const tt = ballT - i * 0.045 * ballDir;
    if (tt < 0 || tt > 1) continue;
    const tp = qb(tt, ap.p0, ap.p1, ap.p2);
    ctx.fillStyle = rgba(GOLD, (1 - i / 6) * 0.2);
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, 3.5 - i * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Halo
  const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 22);
  g.addColorStop(0, rgba(GOLD, 0.55));
  g.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
  ctx.fill();

  // Ball
  ctx.fillStyle = rgba(WHITE, 0.92);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Spin ring 1
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(spinAngle);
  ctx.strokeStyle = rgba(GOLD, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 6.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Spin ring 2
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(-spinAngle * 0.6 + 1.1);
  ctx.strokeStyle = rgba(GOLD, 0.22);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLabels() {
  if (W < 768) return;
  ctx.font = '300 9.5px "DM Sans", system-ui, sans-serif';
  const m = 26 + 36, lh = 17;

  [['BREAK ANGLE', '2.3°'], ['FACE ANGLE', '−0.8°'], ['IMPACT', 'CENTRE']].forEach(([l, v], i) => {
    ctx.fillStyle = rgba(GOLD, 0.2);
    ctx.fillText(l, m, m + i * lh);
    ctx.fillStyle = rgba(WHITE, 0.2);
    ctx.fillText(v, m + 88, m + i * lh);
  });

  [['BALL SPEED', '4.2 m/s'], ['SPIN RATE', '312 rpm'], ['LINE', 'OPTIMAL']].forEach(([l, v], i) => {
    const y = H - m - (2 - i) * lh;
    ctx.fillStyle = rgba(GOLD, 0.2);
    ctx.fillText(l, W - m - 155, y);
    ctx.fillStyle = rgba(WHITE, 0.2);
    ctx.fillText(v, W - m - 55, y);
  });

  // Scan line
  const scanY = ((Date.now() / 6000) % 1) * H;
  const sg = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
  sg.addColorStop(0, rgba(GOLD, 0));
  sg.addColorStop(0.5, rgba(GOLD, 0.035));
  sg.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = sg;
  ctx.fillRect(0, scanY - 40, W, 80);
}

function animateHUD(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  if (!hudStarted) {
    hudStarted = true;
    canvas.classList.add('visible');
  }

  smoothMouse.x = lerp(smoothMouse.x, mouse.x, 0.035);
  smoothMouse.y = lerp(smoothMouse.y, mouse.y, 0.035);

  const ox = (smoothMouse.x / W - 0.5) * 45;
  const oy = (smoothMouse.y / H - 0.5) * 35;

  ballT += dt * 0.22 * ballDir;
  if (ballT >= 1) { ballT = 1; ballDir = -1; }
  if (ballT <= 0) { ballT = 0; ballDir =  1; }
  spinAngle += dt * 1.8;

  ctx.clearRect(0, 0, W, H);

  const ap = arcPoints();
  drawGrid(ox, oy);
  drawArc(ap);
  drawBall(ap);
  drawCorners();
  drawLabels();

  requestAnimationFrame(animateHUD);
}

document.fonts.ready.then(() => requestAnimationFrame(animateHUD));

// ─── HUD fade on scroll (hero only) ─────────────────────────────
const hero = document.getElementById('hero');
function updateHudOpacity() {
  if (!hero) return;
  const heroH  = hero.offsetHeight;
  const scrollY = window.scrollY;
  // Fade out over the bottom third of the hero
  const fadeStart = heroH * 0.55;
  const fadeEnd   = heroH * 0.9;
  let alpha = 1;
  if (scrollY > fadeStart) {
    alpha = Math.max(0, 1 - (scrollY - fadeStart) / (fadeEnd - fadeStart));
  }
  canvas.style.opacity = alpha;
}
window.addEventListener('scroll', updateHudOpacity, { passive: true });

// ─── Scroll reveal observer ───────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ─── Parallax on aerial image ─────────────────────────────────────
const pxSection = document.getElementById('gallery');
const pxImg     = document.getElementById('parallaxImg');
if (pxSection && pxImg) {
  function parallaxScroll() {
    const rect = pxSection.getBoundingClientRect();
    const vh   = window.innerHeight;
    if (rect.bottom < 0 || rect.top > vh) return;
    const progress = (vh - rect.top) / (vh + rect.height);
    const offset   = (progress - 0.5) * 90;
    pxImg.style.transform = `translateY(${offset}px)`;
  }
  window.addEventListener('scroll', parallaxScroll, { passive: true });
  parallaxScroll();
}

// ─── Form submission ──────────────────────────────────────────────
function handleForm(formId, successId) {
  const form    = document.getElementById(formId);
  const success = document.getElementById(successId);
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.textContent = '...';
    btn.disabled = true;

    // Dev placeholder — swap YOUR_FORM_ID in the action attribute
    if (form.action.includes('YOUR_FORM_ID')) {
      form.hidden = true;
      success.hidden = false;
      return;
    }

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        form.hidden = true;
        success.hidden = false;
      } else {
        btn.textContent = btn.dataset.label || 'Try again';
        btn.disabled = false;
      }
    } catch {
      form.submit();
    }
  });
}

handleForm('heroForm', 'heroSuccess');
handleForm('wlForm',   'wlSuccess');
