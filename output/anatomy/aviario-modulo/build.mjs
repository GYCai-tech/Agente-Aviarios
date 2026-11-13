// Fig. 1 — Módulo de aviario industrial (cód. 10007) de 3 niveles, en isométrico.
// Cada grupo de piezas se resalta al pasar el ratón y la tarjeta muestra su dato
// de la ficha técnica. Unidades del mundo: 1 = 1 cm. x a lo largo de la nave,
// y a lo ancho, z hacia arriba.
//
//   node build.mjs           → aviario-modulo.html (oscuro)
//   node build.mjs --light   → aviario-modulo-light.html
//   node build.mjs --audit   → comprueba geometría y orden de pintado
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL = "file:///C:/Users/santiago.arce/.claude/skills/anatomy";
const k = await import(`${SKILL}/kit/iso-kit.mjs`);
const G = await import(`${SKILL}/kit/lathe.mjs`);
const A = await import(`${SKILL}/kit/audit.mjs`);
const { kitScript } = await import(`${SKILL}/scripts/inline-kit.mjs`);

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// ── Verdad: ficha técnica del módulo (backend/agentes/estudio.py) ────────────
const FICHA = {
  largo: 1.2, fondo: 3.3, capacidad: 144,
  supTotal: 11.216, supDisp: 9.1232,
  perchas: 18.1, nidal: 1.1781, comedero: 14.42, bebederos: 21,
};
const NORMA = { percha: 0.15, nidalAves: 120, comedero: 0.10, bebedero: 10, densidad: 9 };
const aves = {
  perchas: Math.floor(FICHA.perchas / NORMA.percha + 1e-9),          // 120
  nidal: Math.floor(FICHA.nidal * NORMA.nidalAves),                  // 141
  comedero: Math.floor(FICHA.comedero / NORMA.comedero + 1e-9),      // 144
  bebederos: FICHA.bebederos * NORMA.bebedero,                       // 210
};
const fmt = (n, d = 2) => n.toLocaleString("es-ES", { maximumFractionDigits: d });

const m2 = (n) => n.toFixed(2).replace(".", ",");
const PARTES = {
  estructura: { nombre: "Estructura", lectura: `${m2(FICHA.largo)} × ${m2(FICHA.fondo)} m · ${FICHA.capacidad} gallinas` },
  suelos: { nombre: "Suelos", lectura: `${fmt(FICHA.supDisp, 4)} m² utilizables` },
  perchas: { nombre: "Perchas", lectura: `${fmt(FICHA.perchas, 1)} m → ${aves.perchas} gallinas` },
  nidal: { nombre: "Nidal", lectura: `${fmt(FICHA.nidal, 4)} m² → ${aves.nidal} gallinas` },
  comedero: { nombre: "Comedero", lectura: `${fmt(FICHA.comedero)} m → ${aves.comedero} gallinas` },
  bebederos: { nombre: "Bebederos", lectura: `${FICHA.bebederos} uds → ${aves.bebederos} gallinas` },
};
const REPOSO = `${FICHA.capacidad} gal/módulo · limitan perchas: ${aves.perchas}`;

// ── Geometría ────────────────────────────────────────────────────────────────
const LARGO = 120, FONDO = 330, ALTO = 286;
const MARCO = 6;                                     // ancho del bastidor (tubo 6 × 6)
const X0 = MARCO, X1 = LARGO - MARCO;                 // tramo libre entre bastidores
const POSTES = [0, 106, 218, 324];                    // y de cada montante
const VANOS = [[6, 106], [112, 218], [224, 324]];      // huecos entre montantes
const NIV = [45, 125, 205];                           // cota superior de cada suelo
const TECHO = 280;

const SUELO = [                                       // tramos de rejilla por nivel
  [[6, 324]],
  [[6, 106], [224, 324]],
  [[6, 324]],
];
const NIDO = { y0: 116, y1: 210, z0: NIV[1], z1: 183 };
const CINTA = { y0: 210, y1: 217, z0: NIV[1] + 1, z1: NIV[1] + 4 };

const PERCHAS = [                                     // [y, z] · 5 + 4 + 6 barras de 1,20 m
  ...[40, 95, 165, 235, 290].map((y) => [y, 78]),
  ...[40, 80, 250, 290].map((y) => [y, 152]),
  ...[30, 80, 130, 180, 230, 280].map((y) => [y, 236]),
];
const PERCHA_R = 1.6;
const COMEDEROS = [                                   // [y, nivel] · 6 canales, acceso por ambos lados
  [62, 0], [268, 0], [62, 1], [268, 1], [112, 2], [212, 2],
];
const AGUA = [[140, 104], [94, 172], [221, 258]];     // [y, z] de cada línea de agua
const AGUA_TECHO = [NIDO.z0, NIV[2] - 2, TECHO - 6];  // cara inferior de lo que la sostiene
const PIES_X = [14, LARGO - 14];                      // patas de percha y colgadores
const NIPLES = 7;

const SUELO_BASE = { x: -26, y: -26, w: LARGO + 52, d: FONDO + 52, r: 6 };
const BASE_H = 12;

const extremos = [
  ...k.boxCorners(SUELO_BASE, -BASE_H, 0),
  [0, 0, ALTO], [LARGO, 0, ALTO], [0, FONDO, ALTO], [LARGO, FONDO, ALTO],
];
const WIDTH = 600, HEIGHT = 560;
const P = k.fitProjection(extremos, WIDTH, HEIGHT, { pad: 26, azimuth: 58 });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);

// ── Registro de piezas (orden de pintado medido por el audit) ────────────────
const R = A.recorder(P);
function put(part, name, centre, svg, shapes) {
  R.put({ at: centre, svg, part, name: R.nameFor(name), shapes: shapes.map((s) => R.solid(s)) });
}
const slabShape = (plan, z, h, name) => A.slab(plan, z, h, { name });
const mid = (plan, z, h) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];

function slabItem(part, name, plan, z, h, style, extra = "", steps = 3, bevel = 0.4) {
  const svg = S(k.slabOf(plan, z, h, P, steps, bevel), style) + extra;
  put(part, name, mid(plan, z, h), svg, [slabShape(plan, z, h, name)]);
}

// Base: losa de la nave, con regla de 3,30 m y placa de características
const base = [];
base.push(`<path class="iso-halo" d="${k.haloOf(SUELO_BASE, -BASE_H, BASE_H, P)}"/>`);
base.push(S(k.slabOf(SUELO_BASE, -BASE_H, BASE_H, P, 8, 1.4), { tone: "mid" }));
base.push(L(k.planOutline(k.insetPlan(SUELO_BASE, 6), 0, P), { tone: "lo" }));
const tornillos = k.corners(SUELO_BASE, 12);
base.push(L(tornillos.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
base.push(D(tornillos.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
const REGLA = { x: LARGO + 9, y: 0, w: 8, d: FONDO, r: 1 };
base.push(S(k.slabOf(REGLA, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(0, FONDO, 10, 5, REGLA.x + 0.8, 0.6, [2.2, 4.2], P, "y");
base.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
const PLACA = { x: LARGO + 4, y: FONDO + 6, w: 15, d: 12, r: 1 };
base.push(S(k.slabOf(PLACA, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
base.push(L(k.planOutline(k.insetPlan(PLACA, 1.4), 0.8, P, 3), { tone: "faint" }));
base.push(k.faceTextSvg(k.topMatrix([PLACA.x + 7.5, PLACA.y + 4.6], 0.8, P, "x"), "10007", { size: 2.6, tone: "lo", anchor: "middle" }));
for (const [y, w] of [[7.6, 10], [9.6, 7]]) {
  base.push(L(k.lineOnTop([PLACA.x + 2.6, PLACA.y + y], [PLACA.x + 2.6 + w, PLACA.y + y], 0.8, P), { tone: "lo", free: true }));
}
R.solid(A.slab(SUELO_BASE, -BASE_H, BASE_H, { name: "stand.losa", ground: true }));

// Estructura: dos bastidores (x = 0 y x = 114) con 4 montantes y travesaños
const travesanos = new Map();           // "x|vano|z" → true, para no repetir
function travesano(x, vano, zc, h = 6) {
  const key = `${x}|${vano}|${zc}`;
  if (travesanos.has(key)) return;
  travesanos.set(key, true);
  const [ya, yb] = VANOS[vano];
  const plan = { x, y: ya, w: MARCO, d: yb - ya, r: 0.6 };
  const z = zc - h;
  slabItem("estructura", "travesano", plan, z, h, { tone: "mid" },
    D([at([x + 3, ya + 4, zc]), at([x + 3, yb - 4, zc])], { size: 0.4, tone: "lo" }));
}


for (const x of [0, LARGO - MARCO]) {
  for (const y of POSTES) {
    const pie = { x: x - 3, y: y - 3, w: MARCO + 6, d: MARCO + 6, r: 1 };
    slabItem("estructura", "pie", pie, 0, 1.2, { tone: "lo" },
      D([at([pie.x + 2, pie.y + 2, 1.2]), at([pie.x + pie.w - 2, pie.y + pie.d - 2, 1.2])], { size: 0.45 }));
    const poste = { x, y, w: MARCO, d: MARCO, r: 0.8 };
    const costuras = L([NIV[0] - 6, NIV[1] - 6, NIV[2] - 6, TECHO - 6].map((z) => k.sideSeam(poste, z, P, 3)).join(""), { tone: "faint" });
    put("estructura", "montante", mid(poste, 1.2, ALTO - 1.2),
      S(k.slabOf(poste, 1.2, ALTO - 1.2, P, 3, 0.3), { tone: "mid", inner: costuras }),
      [slabShape(poste, 1.2, ALTO - 1.2, "montante")]);
    const tapa = { x: x - 0.6, y: y - 0.6, w: MARCO + 1.2, d: MARCO + 1.2, r: 1 };
    slabItem("estructura", "tapa", tapa, ALTO, 1.4, { tone: "mid" }, D([at([x + 3, y + 3, ALTO + 1.4])], { size: 0.45 }));
  }
  for (let v = 0; v < 3; v++) {
    travesano(x, v, NIV[0]); travesano(x, v, NIV[1]); travesano(x, v, NIV[2]); travesano(x, v, TECHO);
  }
}

// Larguero de techo a lo largo de la nave (x), sobre cada fila de montantes
for (const y of POSTES) {
  const plan = { x: X0, y, w: X1 - X0, d: MARCO, r: 0.6 };
  slabItem("estructura", "larguero", plan, TECHO - 6, 6, { tone: "mid" });
}

// Suelos de rejilla por nivel, con alambres de borde a borde
SUELO.forEach((tramos, n) => {
  for (const [ya, yb] of tramos) {
    const plan = { x: X0, y: ya, w: X1 - X0, d: yb - ya, r: 0.4 };
    const z = NIV[n] - 2;
    const alambres = [];
    for (let y = ya + 6; y < yb - 2; y += 6) alambres.push(k.lineOnTop([X0, y], [X1, y], NIV[n], P));
    for (let x = X0 + 12; x < X1 - 2; x += 12) alambres.push(k.lineOnTop([x, ya], [x, yb], NIV[n], P));
    slabItem("suelos", "rejilla", plan, z, 2, { tone: "hi" }, L(alambres.join(""), { tone: "faint" }), 2, 0);
  }
});

// Nidal: caja central del nivel 2, con techo, cortinillas y cinta de huevos
{
  const plan = { x: X0, y: NIDO.y0, w: X1 - X0, d: NIDO.y1 - NIDO.y0, r: 0.6 };
  const h = NIDO.z1 - NIDO.z0;
  const boca = { z0: NIDO.z0 + 12, z1: NIDO.z1 - 10 };
  const marcoBoca = k.segment([X0 + 6, NIDO.y1, boca.z0], [X1 - 6, NIDO.y1, boca.z0], P) +
    k.segment([X1 - 6, NIDO.y1, boca.z0], [X1 - 6, NIDO.y1, boca.z1], P) +
    k.segment([X1 - 6, NIDO.y1, boca.z1], [X0 + 6, NIDO.y1, boca.z1], P) +
    k.segment([X0 + 6, NIDO.y1, boca.z1], [X0 + 6, NIDO.y1, boca.z0], P);
  const tiras = [];
  for (let x = X0 + 12; x < X1 - 8; x += 6) tiras.push(k.segment([x, NIDO.y1, boca.z1], [x, NIDO.y1, boca.z0], P));
  const divisor = k.segment([LARGO / 2, NIDO.y1, NIDO.z0], [LARGO / 2, NIDO.y1, boca.z0], P);
  const inner = L(marcoBoca, { tone: "mid" }) + L(tiras.join(""), { tone: "lo" }) + L(divisor, { tone: "faint" });
  put("nidal", "nidal.caja", mid(plan, NIDO.z0, h),
    S(k.slabOf(plan, NIDO.z0, h, P, 3, 0.6), { tone: "hi", inner }), [slabShape(plan, NIDO.z0, h, "nidal.caja")]);
  const techo = { x: X0, y: NIDO.y0 - 3, w: X1 - X0, d: NIDO.y1 - NIDO.y0 + 6, r: 0.8 };
  slabItem("nidal", "nidal.techo", techo, NIDO.z1, 2.4, { tone: "hi" },
    L(k.lineOnTop([X0, (NIDO.y0 + NIDO.y1) / 2], [X1, (NIDO.y0 + NIDO.y1) / 2], NIDO.z1 + 2.4, P), { tone: "faint" }), 3, 0.5);
  const cinta = { x: X0, y: CINTA.y0, w: X1 - X0, d: CINTA.y1 - CINTA.y0, r: 0.6 };
  const huevos = [];
  for (let x = X0 + 10; x < X1 - 6; x += 16) huevos.push(at([x, (CINTA.y0 + CINTA.y1) / 2, CINTA.z1]));
  slabItem("nidal", "nidal.cinta", cinta, CINTA.z0, CINTA.z1 - CINTA.z0, { tone: "mid" },
    D(huevos, { size: 1.1, tone: "hi" }), 3, 0.3);
}

// Perchas: barras redondas a lo largo de x, apoyadas en los travesaños
for (const [y, z] of PERCHAS) {
  const F = G.frameAlong([0, y, z], [1, 0, 0]);
  const paths = G.disc(0, LARGO, PERCHA_R, F, P, { steps: 20 });   // continua en la fila: corte en x = 0 y x = 120
  put("perchas", "percha", [LARGO / 2, y, z], S(paths, { tone: "hi" }), [A.disc(F, 0, LARGO, PERCHA_R, { name: "percha" })]);
  // Patas: tubo de 1 cm desde el suelo del nivel hasta la cara inferior de la barra
  const suelo = NIV[PERCHAS.findIndex(([py, pz]) => py === y && pz === z) < 5 ? 0
    : PERCHAS.findIndex(([py, pz]) => py === y && pz === z) < 9 ? 1 : 2];
  for (const x of PIES_X) {
    const h = z - PERCHA_R - suelo;
    const pie = S(k.cylinder(x, y, 1.8, suelo, 0.8, P, 14), { tone: "mid" }) + S(k.cylinder(x, y, 0.9, suelo + 0.8, h - 0.8, P, 12), { tone: "mid", crease: "none" });
    put("perchas", "percha.pie", [x, y, suelo + h / 2], pie,
      [A.cylinder(x, y, 1.8, suelo, 0.8, { name: "percha.pie" }), A.cylinder(x, y, 0.9, suelo + 0.8, h - 0.8, { name: "percha.pie" })]);
  }
}

// Comederos: canal abierto con cadena de reparto
for (const [y, n] of COMEDEROS) {
  const plan = { x: X0, y: y - 5, w: X1 - X0, d: 10, r: 1.2 };
  const z = NIV[n];
  const interior = k.insetPlan(plan, 1.6);
  const extra = L(k.planOutline(interior, z + 6, P, 3), { tone: "lo" }) +
    L(k.lineOnTop([interior.x, y], [interior.x + interior.w, y], z + 6, P), { tone: "mid" });
  slabItem("comedero", "comedero", plan, z, 6, { tone: "hi" }, extra, 3, 0.4);
}

// Bebederos: línea de agua cuadrada con 7 tetinas colgando
AGUA.forEach(([y, z], n) => {
  // Continua en la fila, salvo si cae en la vertical de un montante: entonces termina contra él
  const enMontante = POSTES.some((py) => y + 1.5 > py && y - 1.5 < py + MARCO);
  const plan = enMontante ? { x: X0, y: y - 1.5, w: X1 - X0, d: 3, r: 0.6 } : { x: 0, y: y - 1.5, w: LARGO, d: 3, r: 0.6 };
  const zt = z - 1.5;
  for (const x of PIES_X) {                                       // colgadores hasta lo que hay encima
    const h = AGUA_TECHO[n] - (zt + 3);
    put("bebederos", "colgador", [x, y, zt + 3 + h / 2], S(k.cylinder(x, y, 0.6, zt + 3, h, P, 10), { tone: "mid", crease: "none" }),
      [A.cylinder(x, y, 0.6, zt + 3, h, { name: "colgador" })]);
  }
  slabItem("bebederos", "linea.agua", plan, zt, 3, { tone: "mid" }, "", 2, 0);
  const paso = (X1 - X0) / NIPLES;
  for (let i = 0; i < NIPLES; i++) {
    const x = X0 + paso * (i + 0.5);
    const cuerpo = S(k.cylinder(x, y, 1.1, zt - 4, 4, P, 14), { tone: "hi" });
    const copa = S(k.cylinder(x, y, 1.9, zt - 5.2, 1.2, P, 16), { tone: "hi" });
    put("bebederos", "tetina", [x, y, zt - 2.6], copa + cuerpo + D([at([x, y, zt - 5.2])], { size: 0.5, tone: "hi" }),
      [A.cylinder(x, y, 1.1, zt - 4, 4, { name: "tetina" }), A.cylinder(x, y, 1.9, zt - 5.2, 1.2, { name: "tetina.copa" })]);
  }
});

A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
A.auditOrExit(R, P, { crowd: [] });

const cuerpo = [base.join("")];
for (const item of R.items) cuerpo.push(`<g data-part="${item.part}">${item.svg}</g>`);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "Módulo de aviario industrial de 3 niveles: dos bastidores galvanizados, suelos de rejilla, un nidal central con cinta de huevos, perchas, comederos de canal y líneas de bebederos, sobre la losa de la nave con una regla de 3,30 m.",
  body: cuerpo,
});

const live = `
const PARTES = ${JSON.stringify(PARTES)};
const ORDEN = Object.keys(PARTES);
const REPOSO = ${JSON.stringify(REPOSO)};
const stage = document.querySelector(".iso-stage");
const readout = document.querySelector("[data-readout]");
const quieto = matchMedia("(prefers-reduced-motion: reduce)");
let actual = null, tour = 0, idle = 0, timer = 0, visible = false;
function marcar(parte) {
  if (parte === actual) return;
  actual = parte;
  stage.toggleAttribute("data-on", !!parte);
  for (const g of stage.querySelectorAll("[data-part]")) {
    const on = g.dataset.part === parte;
    g.classList.toggle("on", on);
    for (const s of g.querySelectorAll(".iso-solid")) s.toggleAttribute("data-lit", on);
  }
  const texto = parte ? PARTES[parte].nombre + " · " + PARTES[parte].lectura : REPOSO;
  if (readout.textContent !== texto) readout.textContent = texto;
  stage.setAttribute("aria-valuetext", texto);
}
function paso() {
  if (!visible || quieto.matches) return;
  marcar(ORDEN[tour % ORDEN.length]);
  tour++;
  timer = setTimeout(paso, 2600);
}
function pausa() {
  clearTimeout(timer); clearTimeout(idle);
  idle = setTimeout(() => { if (!stage.matches(":hover")) paso(); }, 4200);
}
stage.addEventListener("pointermove", (e) => {
  const g = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-part]");
  pausa();
  marcar(g && stage.contains(g) ? g.dataset.part : null);
});
stage.addEventListener("pointerleave", () => { marcar(null); pausa(); });
stage.addEventListener("keydown", (e) => {
  const i = actual ? ORDEN.indexOf(actual) : -1;
  let j = null;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % ORDEN.length;
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + ORDEN.length) % ORDEN.length;
  if (e.key === "Escape") { marcar(null); pausa(); return; }
  if (j === null) return;
  e.preventDefault(); pausa(); marcar(ORDEN[j]);
});
new IntersectionObserver((es) => {
  const antes = visible;
  visible = es[es.length - 1].isIntersecting;
  if (visible && !antes) { clearTimeout(timer); timer = setTimeout(paso, 900); }
  if (!visible) clearTimeout(timer);
}).observe(stage);
`;

const css = `<style>
.iso-stage [data-part]{transition:opacity .25s var(--anatomy-ease)}
.iso-stage[data-on] [data-part]:not(.on) .iso-line,
.iso-stage[data-on] [data-part]:not(.on) .iso-dots{opacity:.5}
.iso-stage [data-part].on .iso-line:not(.iso-edge):not(.iso-crease){stroke:var(--anatomy-hi)}
.iso-stage [data-part].on .iso-dots circle{opacity:.9}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-mid);outline-offset:4px;border-radius:6px}
@media (prefers-reduced-motion: reduce){.iso-stage [data-part]{transition:none}}
</style>`;

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Módulo de aviario · 3 niveles",
  hint: "Pasa el ratón por las piezas",
  readout: REPOSO,
  keys: [
    { mark: "lit", label: "Pieza resaltada: su dato de la ficha técnica aparece abajo a la derecha" },
    { mark: "raised", label: "5 + 4 + 6 perchas de 1,20 m, 6 comederos de doble acceso y 3 líneas de 7 bebederos" },
  ],
  caption:
    `Un módulo de 1,20 × 3,30 m aloja ${FICHA.capacidad} gallinas, pero sus ${fmt(FICHA.perchas, 1)} m de percha solo dan para ${aves.perchas} a 15 cm por ave: ` +
    `en un aviario de 3 niveles el límite lo marcan las perchas antes que el nidal (${aves.nidal}), el comedero (${aves.comedero}) o los bebederos (${aves.bebederos}).`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Módulo de aviario: flechas para recorrer las piezas" aria-valuemin="0" aria-valuemax="${Object.keys(PARTES).length}" aria-valuetext="${REPOSO}">${svg}</div>`,
});

const out = theme === "light" ? "aviario-modulo-light.html" : "aviario-modulo.html";
writeFileSync(join(HERE, out), k.pageHtml({ title: "Módulo de aviario", theme, body: css + plate, script: kitScript() + live }));
console.log("wrote", out, "·", R.items.length, "piezas");
