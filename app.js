/* ==========================================================================
   CannaSur AR — Calculadora & Asistente de Cultivo (Hemisferio Sur)
   Vanilla JS modularizado. Secciones:
     1. Constantes & datos (etapas, marcas, parámetros)
     2. Estado + persistencia (localStorage)
     3. Utilidades (fechas en hora Argentina, formato, DOM)
     4. Motor lunar astronómico (Meeus, cap. 49)
     5. Módulo Modo de Cultivo (Indoor / Outdoor)
     6. Módulo Calculadora de Fertilizantes
     7. Módulo Calendario Lunar
     8. Módulo Plagas (MIP preventivo)
     9. Módulo Configuración
    10. Módulo Exportación (PDF / PNG)
    11. Navegación + init
   ========================================================================== */
'use strict';

/* ==========================================================================
   1. CONSTANTES & DATOS
   ========================================================================== */
const TZ_OFFSET_MS = 3 * 3600 * 1000; // Argentina: UTC-3 todo el año
const DAY_MS = 86400000;
const STORAGE_KEY = 'cannasur-ar:v1';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const STAGE_ORDER = ['plantula', 'vegetativo', 'transicion', 'flora_temprana', 'flora_tardia'];
const STAGES = {
  plantula: { label: 'Plántula', emoji: '🌱', light: '18/6', desc: 'Raíces y primeras hojas verdaderas. Dosis suaves.' },
  vegetativo: { label: 'Vegetativo', emoji: '🌿', light: '18/6', desc: 'Estructura, tallos y ramas. Alta demanda de nitrógeno.' },
  transicion: { label: 'Transición', emoji: '⚡', light: '12/12 (sem 1-2)', desc: 'Stretch: la planta puede duplicar su altura. Cambio gradual a P-K.' },
  flora_temprana: { label: 'Floración temprana', emoji: '🌸', light: '12/12', desc: 'Formación de cogollos y pistilos. Fósforo + azúcares.' },
  flora_tardia: { label: 'Floración tardía', emoji: '💎', light: '12/12', desc: 'Engorde, resina y maduración de tricomas. Lavado final 7–14 días.' }
};

/* Parámetros objetivo por medio de cultivo (EC en mS/cm) */
const STAGE_PARAMS = {
  sustrato: {
    plantula: { ph: '6.0 – 6.5', ec: '0.4 – 0.8' },
    vegetativo: { ph: '6.0 – 6.5', ec: '0.8 – 1.3' },
    transicion: { ph: '6.2 – 6.5', ec: '1.2 – 1.6' },
    flora_temprana: { ph: '6.2 – 6.8', ec: '1.4 – 1.8' },
    flora_tardia: { ph: '6.3 – 6.8', ec: '1.4 – 1.9' }
  },
  coco: {
    plantula: { ph: '5.6 – 6.0', ec: '0.5 – 0.9' },
    vegetativo: { ph: '5.7 – 6.0', ec: '1.0 – 1.5' },
    transicion: { ph: '5.8 – 6.1', ec: '1.4 – 1.8' },
    flora_temprana: { ph: '5.8 – 6.2', ec: '1.6 – 2.0' },
    flora_tardia: { ph: '5.9 – 6.2', ec: '1.6 – 2.1' }
  }
};

/* Líneas de fertilizantes. Dosis en unidad/L (ml o g) según tablas orientativas
   de cada fabricante para tierra. `base: true` = se refuerza x1.2 en coco/hidro
   (solo líneas minerales). Editá estos valores libremente. */
const BRANDS = {
  topcrop: {
    name: 'Top Crop',
    type: 'Bio-mineral',
    icon: '🌿',
    mineral: false,
    mixOrder: 'Agua desclorada (reposada 24 h) → Deeper Underground → Top Veg / Top Bloom → Big One → Top Candy → Top Bud. Mezclá entre cada producto y medí el pH al final.',
    tip: 'Línea pensada para tierra. En coco empezá al 75% de la dosis.',
    products: [
      { name: 'Deeper Underground', role: 'Enraizante · húmicos', unit: 'ml', doses: { plantula: 1.5, vegetativo: 1, transicion: 0, flora_temprana: 0, flora_tardia: 0 }, note: 'Riegos iniciales y post-trasplante' },
      { name: 'Top Veg', role: 'Base de crecimiento (N)', unit: 'ml', doses: { plantula: 1, vegetativo: 3, transicion: 2, flora_temprana: 0, flora_tardia: 0 }, note: 'Subir progresivo de 2 a 4 ml/L' },
      { name: 'Top Bloom', role: 'Base de floración (P-K)', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 2, flora_temprana: 3, flora_tardia: 4 }, note: 'Retirar en el lavado final' },
      { name: 'Big One', role: 'Estimulante de floración', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 2, flora_temprana: 2, flora_tardia: 0 }, note: 'Riego o foliar en el cambio a 12/12' },
      { name: 'Top Candy', role: 'Azúcares · sabor y aroma', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 1, flora_temprana: 2, flora_tardia: 2 }, note: 'Constante toda la flora' },
      { name: 'Top Bud', role: 'Engorde PK', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 0, flora_temprana: 0, flora_tardia: 1 }, note: 'Últimas semanas antes del lavado' }
    ]
  },
  namaste: {
    name: 'Namaste',
    type: 'Orgánica',
    icon: '🍃',
    mineral: false,
    mixOrder: 'Agua sin cloro → disolvé los polvos (Amazonia Roots / Trico+) y dejá reposar 2–4 h para activar la microvida → sumá los líquidos (Oro Negro / Flora Booster). Evitá ácidos fuertes para corregir pH con microorganismos vivos.',
    tip: 'Aplicación semanal: intercalá riegos solo con agua sin cloro.',
    products: [
      { name: 'Amazonia Roots', role: 'Micorrizas + Trichoderma', unit: 'g', doses: { plantula: 1, vegetativo: 1, transicion: 0, flora_temprana: 0, flora_tardia: 0 }, note: 'También 1 cda. en el pozo al trasplantar' },
      { name: 'Oro Negro', role: 'Húmicos + algas · crecimiento', unit: 'ml', doses: { plantula: 1, vegetativo: 2, transicion: 2, flora_temprana: 0, flora_tardia: 0 }, note: 'Hasta las 2 primeras semanas de flora' },
      { name: 'Trico+', role: 'Melazas + yuca · resina', unit: 'g', doses: { plantula: 0, vegetativo: 0, transicion: 0, flora_temprana: 1, flora_tardia: 1 }, note: 'Reposar la mezcla antes de regar' },
      { name: 'Flora Booster', role: 'PK + aminoácidos · engorde', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 0, flora_temprana: 2, flora_tardia: 3 }, note: 'Desde sem 3-4 de flora · máx. 4 aplicaciones (g si es polvo)' }
    ]
  },
  kawsay: {
    name: 'Kawsay',
    type: 'Mineral',
    icon: '⚗️',
    mineral: true,
    mixOrder: 'Agua → Base A (mezclar) → Base B (mezclar) → Vege o Bloom → K9. Nunca juntes Base A y Base B concentradas: precipitan y se inutilizan.',
    tip: 'En coco/hidro las bases se refuerzan automáticamente (+20%).',
    products: [
      { name: 'Base A', role: 'Calcio + nitrógeno', unit: 'ml', base: true, doses: { plantula: 0.5, vegetativo: 1.5, transicion: 1.5, flora_temprana: 2, flora_tardia: 2 }, note: 'Siempre primero, bien disuelta' },
      { name: 'Base B', role: 'Magnesio + micronutrientes', unit: 'ml', base: true, doses: { plantula: 0.5, vegetativo: 1.5, transicion: 1.5, flora_temprana: 2, flora_tardia: 2 }, note: 'Después de la Base A' },
      { name: 'Vege', role: 'NPK de crecimiento', unit: 'ml', doses: { plantula: 0.5, vegetativo: 1.5, transicion: 1, flora_temprana: 0, flora_tardia: 0 }, note: 'Retirar al consolidar la flora' },
      { name: 'Bloom', role: 'Fósforo + potasio', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 1, flora_temprana: 2, flora_tardia: 2.5 }, note: 'Pico en el engorde' },
      { name: 'K9', role: 'Bioestimulante · terpenos', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 0, flora_temprana: 0.5, flora_tardia: 0.5 }, note: 'Inicio de flora, día 15-20 y refuerzo sem 6' }
    ]
  },
  advanced: {
    name: 'Advanced Nutrients',
    type: 'Mineral pH Perfect',
    icon: '🧬',
    mineral: true,
    mixOrder: 'Agua → pH Perfect Micro → Grow → Bloom → aditivos (Voodoo Juice, B-52, Big Bud, Bud Candy, Overdrive). pH Perfect autorregula entre 5.5–6.3, igual verificá con medidor.',
    tip: 'Bases 1:1:1. En coco/hidro se refuerzan automáticamente (+20%, tope 4 ml/L).',
    products: [
      { name: 'pH Perfect Micro', role: 'Base · micronutrientes', unit: 'ml', base: true, doses: { plantula: 1, vegetativo: 3, transicion: 4, flora_temprana: 4, flora_tardia: 4 }, note: 'Siempre primero' },
      { name: 'pH Perfect Grow', role: 'Base · nitrógeno', unit: 'ml', base: true, doses: { plantula: 1, vegetativo: 3, transicion: 4, flora_temprana: 4, flora_tardia: 4 }, note: 'Misma dosis que Micro' },
      { name: 'pH Perfect Bloom', role: 'Base · fósforo/potasio', unit: 'ml', base: true, doses: { plantula: 1, vegetativo: 3, transicion: 4, flora_temprana: 4, flora_tardia: 4 }, note: 'Misma dosis que Micro' },
      { name: 'Voodoo Juice', role: 'Microbios de raíz', unit: 'ml', doses: { plantula: 2, vegetativo: 2, transicion: 2, flora_temprana: 0, flora_tardia: 0 }, note: 'Sem 1-2 de veg y de flora' },
      { name: 'B-52', role: 'Vitaminas B · antiestrés', unit: 'ml', doses: { plantula: 0, vegetativo: 2, transicion: 2, flora_temprana: 2, flora_tardia: 0 }, note: 'Hasta la sem 6 de flora' },
      { name: 'Big Bud', role: 'Booster de floración', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 0, flora_temprana: 2, flora_tardia: 0 }, note: 'Sem 2-5 de flora' },
      { name: 'Bud Candy', role: 'Carbohidratos · sabor', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 2, flora_temprana: 2, flora_tardia: 2 }, note: 'Toda la flora' },
      { name: 'Overdrive', role: 'Finalizador', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 0, flora_temprana: 0, flora_tardia: 2 }, note: 'Últimas 2 semanas antes del lavado' }
    ]
  }
};

/* Latitudes de referencia para el cálculo del fotoperíodo */
const REGIONS = {
  amba: { label: 'Buenos Aires / AMBA', lat: -34.6, tip: '🌧️ <strong>AMBA / Litoral:</strong> clima húmedo. En marzo-abril las lluvias y rocíos elevan el riesgo de <em>Botrytis</em>: elegí genéticas de flora corta, podá para airear y priorizá Bt contra isocas desde enero. Heladas tardías posibles hasta mediados de octubre.' },
  centro: { label: 'Centro (Cba/SF/ER)', lat: -31.4, tip: '🌾 <strong>Centro:</strong> veranos calurosos con tormentas fuertes y granizo puntual. Tené malla antigranizo lista para febrero-marzo. Alta presión de isoca y chinche verde en zona agrícola: Bt cada 10 días en flora.' },
  cuyo: { label: 'Cuyo', lat: -32.9, tip: '☀️ <strong>Cuyo:</strong> clima árido y gran amplitud térmica (ideal para resina). Atención a la arañuela roja con calor seco: Neem + Jabón potásico cada 10 días en vegetativo y mojar el envés. Riego más frecuente; acolchado (mulch) recomendado.' },
  norte: { label: 'NOA / NEA', lat: -26.8, tip: '🌴 <strong>Norte:</strong> temporada más larga y días algo más cortos en verano: la flora se dispara antes. Humedad alta en el NEA: priorizá ventilación, Trichoderma en raíz y controles cada 10 días.' },
  patagonia: { label: 'Patagonia', lat: -40.8, tip: '🏔️ <strong>Patagonia:</strong> temporada corta, viento seco y heladas tempranas desde fines de marzo. Usá genéticas de flora rápida o autos, germiná en octubre bajo cobertura y planificá cosechar en marzo.' }
};

/* Categorías lunares agrícolas */
const LUNAR_CATS = {
  germinacion: {
    label: 'Cuarto Creciente / Luna Llena', task: 'Germinación & Foliares', icon: '🌱',
    chip: 'bg-lime-500/15 text-lime-300 border-lime-400/35',
    cell: 'bg-lime-500/10 border-lime-400/35',
    dot: 'bg-lime-400', hex: '#a3e635',
    why: 'La savia asciende y la luz nocturna aumenta: máxima actividad en la parte aérea.',
    tasks: ['Germinar semillas y sembrar', 'Fertilizantes foliares (algas, aminoácidos)', 'Riegos con abono de crecimiento']
  },
  podas: {
    label: 'Cuarto Menguante', task: 'Trasplantes, Podas & Esquejes', icon: '✂️',
    chip: 'bg-sky-500/15 text-sky-300 border-sky-400/35',
    cell: 'bg-sky-500/10 border-sky-400/35',
    dot: 'bg-sky-400', hex: '#38bdf8',
    why: 'La savia desciende hacia las raíces: menos sangrado, cicatrización rápida y mejor enraizamiento.',
    tasks: ['Trasplantes a maceta final o suelo', 'Poda apical / FIM y defoliación', 'Cortar esquejes de plantas madre']
  },
  cosecha: {
    label: 'Luna Nueva', task: 'Cosecha & Plagas de raíz', icon: '🌾',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-400/35',
    cell: 'bg-amber-500/10 border-amber-400/35',
    dot: 'bg-amber-400', hex: '#fbbf24',
    why: 'Menor retención de savia en la parte aérea: secado más parejo y menos riesgo de hongos.',
    tasks: ['Cosecha (corte) de plantas maduras', 'Control de plagas de raíz (larvas, mosquitas)', 'Descanso: sin podas ni trasplantes']
  },
  neutral_creciente: {
    label: 'Creciente joven', task: 'Mantenimiento', icon: '💧',
    chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25',
    cell: 'bg-botanic-950/60 border-emerald-500/10',
    dot: 'bg-emerald-500/60', hex: '#34d399',
    why: 'Savia empezando a subir. Buen momento para preparar la próxima ventana.',
    tasks: ['Riegos base', 'Preparar sustrato, macetas y semillas', 'Monitoreo de plagas con lupa']
  },
  neutral_menguante: {
    label: 'Gibosa menguante', task: 'Mantenimiento', icon: '💧',
    chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25',
    cell: 'bg-botanic-950/60 border-emerald-500/10',
    dot: 'bg-emerald-500/60', hex: '#34d399',
    why: 'Savia comenzando a descender. Favorece el trabajo radicular.',
    tasks: ['Riegos con enraizantes / microbiología', 'Afilar y desinfectar tijeras', 'Planificar podas del Cuarto Menguante']
  }
};

const PHASE_NAMES = { new: 'Luna Nueva', fq: 'Cuarto Creciente', full: 'Luna Llena', lq: 'Cuarto Menguante' };

/* Tratamientos preventivos (dosis por litro) */
const PEST_DOSES = { neem: 2, soap: 5, bt: 1 }; // ml/L, ml/L, g/L

/* ==========================================================================
   2. ESTADO + PERSISTENCIA
   ========================================================================== */
const DEFAULT_STATE = {
  mode: 'outdoor',
  liters: 5,
  brand: 'topcrop',
  stage: 'vegetativo',
  indoorWeek: 3,
  vegWeeks: 4,
  flowerWeeks: 9,
  cropName: '',
  region: 'amba',
  substrate: 'sustrato',
  doseFactor: 1,
  pestLast: null, // índice de día (AR)
  pestInterval: 12,
  sprayer: 1,
  lunarFilter: 'all'
};

let state = { ...DEFAULT_STATE };
const ui = { lunarYear: 2026, lunarMonth: 0, lunarSelectedDi: null };

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (e) { /* almacenamiento no disponible */ }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* noop */ }
}

/* ==========================================================================
   3. UTILIDADES
   ========================================================================== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Índice de día calendario en hora Argentina para un timestamp UTC. */
const arDayIndex = (ms) => Math.floor((ms - TZ_OFFSET_MS) / DAY_MS);
const diFromYMD = (y, m, d) => Math.floor(Date.UTC(y, m, d) / DAY_MS);
const todayDi = () => arDayIndex(Date.now());
function partsFromDi(di) {
  const d = new Date(di * DAY_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay() };
}
function arTime(ms) {
  const d = new Date(ms - TZ_OFFSET_MS);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}
function fmtDate(di, withDow = true) {
  const p = partsFromDi(di);
  return (withDow ? DOW_SHORT[p.dow] + ' ' : '') + p.d + ' ' + MONTHS_SHORT[p.m];
}
function fmtDateFull(di) {
  const p = partsFromDi(di);
  return String(p.d).padStart(2, '0') + '/' + String(p.m + 1).padStart(2, '0') + '/' + p.y;
}
function diToInput(di) {
  const p = partsFromDi(di);
  return p.y + '-' + String(p.m + 1).padStart(2, '0') + '-' + String(p.d).padStart(2, '0');
}
function inputToDi(v) {
  const [y, m, d] = v.split('-').map(Number);
  return diFromYMD(y, m - 1, d);
}
function fmtNum(v) {
  const digits = v < 1 ? 2 : v < 10 ? 1 : 0;
  return v.toLocaleString('es-AR', { maximumFractionDigits: digits });
}
function relDays(n) {
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? 'en ' + n + ' días' : 'hace ' + Math.abs(n) + ' días';
}

let toastTimer = null;
function toast(msg) {
  const el = $('app-toast');
  $('app-toast-text').textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translate(-50%, 6px)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, 0)';
  }, 2200);
}

/** Horas de luz (fotoperíodo) para una latitud y día del año. */
function dayLengthHours(lat, di) {
  const p = partsFromDi(di);
  const n = di - diFromYMD(p.y, 0, 1) + 1;
  const rad = Math.PI / 180;
  const decl = 23.44 * Math.sin(2 * Math.PI * (284 + n) / 365) * rad;
  const phi = lat * rad;
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  const H = Math.acos(Math.max(-1, Math.min(1, cosH))) / rad;
  return (2 * H) / 15;
}
const fmtHours = (h) => Math.floor(h) + ' h ' + String(Math.round((h % 1) * 60)).padStart(2, '0') + ' min';

/* ==========================================================================
   4. MOTOR LUNAR (Jean Meeus, Astronomical Algorithms, cap. 49)
   Precisión ~1-2 minutos. Horario convertido a H.O.A. (UTC-3).
   ========================================================================== */
const LunarEngine = (() => {
  const rad = Math.PI / 180;
  const sin = Math.sin, cos = Math.cos;
  const TYPES = ['new', 'fq', 'full', 'lq'];

  function phaseJDE(k, phase) {
    const kk = k + phase * 0.25;
    const T = kk / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    const jde = 2451550.09766 + 29.530588861 * kk + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
    const E = 1 - 0.002516 * T - 0.0000074 * T2;
    const M = (2.5534 + 29.1053567 * kk - 0.0000014 * T2 - 0.00000011 * T3) * rad;
    const Mp = (201.5643 + 385.81693528 * kk + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * rad;
    const F = (160.7108 + 390.67050284 * kk - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * rad;
    const Om = (124.7746 - 1.56375588 * kk + 0.0020672 * T2 + 0.00000215 * T3) * rad;
    let c;
    if (phase === 0 || phase === 2) {
      const a = phase === 0
        ? [-0.4072, 0.17241, 0.01608, 0.01039, 0.00739, -0.00514, 0.00208]
        : [-0.40614, 0.17302, 0.01614, 0.01043, 0.00734, -0.00515, 0.00209];
      c = a[0] * sin(Mp) + a[1] * E * sin(M) + a[2] * sin(2 * Mp) + a[3] * sin(2 * F)
        + a[4] * E * sin(Mp - M) + a[5] * E * sin(Mp + M) + a[6] * E * E * sin(2 * M)
        - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) + 0.00056 * E * sin(2 * Mp + M)
        - 0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F)
        - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(Om) - 0.00007 * sin(Mp + 2 * M)
        + 0.00004 * sin(2 * Mp - 2 * F) + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F)
        + 0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F) + 0.00003 * sin(Mp - M + 2 * F)
        - 0.00002 * sin(Mp - M - 2 * F) - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
    } else {
      c = -0.62801 * sin(Mp) + 0.17172 * E * sin(M) - 0.01183 * E * sin(Mp + M) + 0.00862 * sin(2 * Mp)
        + 0.00804 * sin(2 * F) + 0.00454 * E * sin(Mp - M) + 0.00204 * E * E * sin(2 * M)
        - 0.0018 * sin(Mp - 2 * F) - 0.0007 * sin(Mp + 2 * F) - 0.0004 * sin(3 * Mp)
        - 0.00034 * E * sin(2 * Mp - M) + 0.00032 * E * sin(M + 2 * F) + 0.00032 * E * sin(M - 2 * F)
        - 0.00028 * E * E * sin(Mp + 2 * M) + 0.00027 * E * sin(2 * Mp + M) - 0.00017 * sin(Om)
        - 0.00005 * sin(Mp - M - 2 * F) + 0.00004 * sin(2 * Mp + 2 * F) - 0.00004 * sin(Mp + M + 2 * F)
        + 0.00004 * sin(Mp - 2 * M) + 0.00003 * sin(Mp + M - 2 * F) + 0.00003 * sin(3 * M)
        + 0.00002 * sin(2 * Mp - 2 * F) + 0.00002 * sin(Mp - M + 2 * F) - 0.00002 * sin(3 * Mp + M);
      const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M)
        + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
      c += phase === 1 ? W : -W;
    }
    const A = [299.77 + 0.107408 * kk - 0.009173 * T2, 251.88 + 0.016321 * kk, 251.83 + 26.651886 * kk,
      349.42 + 36.412478 * kk, 84.66 + 18.206239 * kk, 141.74 + 53.303771 * kk, 207.14 + 2.453732 * kk,
      154.84 + 7.30686 * kk, 34.52 + 27.261239 * kk, 207.19 + 0.121824 * kk, 291.34 + 1.844379 * kk,
      161.72 + 24.198154 * kk, 239.56 + 25.513099 * kk, 331.55 + 3.592518 * kk];
    const AC = [325, 165, 164, 126, 110, 62, 60, 56, 47, 42, 40, 37, 35, 23];
    let pl = 0;
    for (let i = 0; i < 14; i++) pl += AC[i] * 1e-6 * sin(A[i] * rad);
    return jde + c + pl;
  }

  const DELTA_T_DAYS = 70 / 86400; // TT − UT aprox. 2026-2027
  const jdToMs = (jd) => (jd - 2440587.5) * DAY_MS;

  function buildEvents(fromYear, toYear) {
    const kStart = Math.floor((fromYear - 2000) * 12.3685) - 1;
    const kEnd = Math.ceil((toYear + 1 - 2000) * 12.3685) + 1;
    const out = [];
    for (let k = kStart; k <= kEnd; k++) {
      for (let p = 0; p < 4; p++) {
        const ms = jdToMs(phaseJDE(k, p) - DELTA_T_DAYS);
        out.push({ type: TYPES[p], ms, di: arDayIndex(ms) });
      }
    }
    return out.sort((a, b) => a.ms - b.ms);
  }

  // Cubrimos de 2025 a 2028 para que las ventanas de borde (dic/ene) funcionen.
  const events = buildEvents(2025, 2028);
  const byDi = new Map(events.map((e) => [e.di, e]));
  const news = events.filter((e) => e.type === 'new');

  function lastEventIndexOnOrBefore(di) {
    let lo = 0, hi = events.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (events[mid].di <= di) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  /** Información astronómica del día (al mediodía AR). */
  function info(di) {
    const ms = di * DAY_MS + TZ_OFFSET_MS + 12 * 3600 * 1000;
    let prev = news[0], next = news[news.length - 1];
    for (let i = 0; i < news.length - 1; i++) {
      if (news[i].ms <= ms && news[i + 1].ms > ms) { prev = news[i]; next = news[i + 1]; break; }
    }
    const frac = (ms - prev.ms) / (next.ms - prev.ms);
    const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
    const age = frac * ((next.ms - prev.ms) / DAY_MS);
    const exact = byDi.get(di) || null;
    let name;
    if (exact) name = PHASE_NAMES[exact.type];
    else if (frac < 0.25) name = 'Creciente cóncava';
    else if (frac < 0.5) name = 'Gibosa creciente';
    else if (frac < 0.75) name = 'Gibosa menguante';
    else name = 'Menguante convexa';
    return { frac, illum, age, waxing: frac < 0.5, exact, name, category: category(di) };
  }

  /** Clasificación agrícola del día. */
  function category(di) {
    // Ventana de Luna Nueva: 2 días antes hasta 1 día después
    for (const n of news) {
      if (di >= n.di - 2 && di <= n.di + 1) return 'cosecha';
      if (n.di - 2 > di) break;
    }
    const idx = lastEventIndexOnOrBefore(di);
    if (idx < 0) return 'neutral_creciente';
    const e = events[idx];
    if (e.type === 'fq') return 'germinacion';
    if (e.type === 'full') return di <= e.di + 2 ? 'germinacion' : 'neutral_menguante';
    if (e.type === 'lq') return 'podas';
    return 'neutral_creciente';
  }

  /** Ventana (actual o próxima) de una categoría a partir de un día. */
  function nextWindow(cat, fromDi, horizon = 60) {
    for (let d = fromDi; d < fromDi + horizon; d++) {
      if (category(d) === cat) {
        let start = d;
        if (d === fromDi) while (category(start - 1) === cat) start--;
        let end = d;
        while (category(end + 1) === cat) end++;
        return { start, end, active: start <= fromDi };
      }
    }
    return null;
  }

  const eventsInMonth = (y, m) => events.filter((e) => { const p = partsFromDi(e.di); return p.y === y && p.m === m; });
  const nextEventOfType = (type, fromDi) => events.find((e) => e.type === type && e.di >= fromDi) || null;

  return { events, info, category, nextWindow, eventsInMonth, nextEventOfType };
})();

/** SVG lunar orientado al Hemisferio Sur (creciente iluminada a la IZQUIERDA). */
function moonSVG(frac, size = 96, opts = {}) {
  const r = 45, cx = 50, cy = 50;
  const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
  const waxing = frac < 0.5;
  const litLeft = waxing; // Hemisferio Sur: "C" = Creciente, "D" = Decreciente
  const rx = Math.abs(Math.cos(2 * Math.PI * frac)) * r;
  const limbSweep = litLeft ? 0 : 1;
  const crescent = illum < 0.5;
  const termSweep = litLeft ? (crescent ? 1 : 0) : (crescent ? 0 : 1);
  const lit = illum < 0.015 ? '' :
    illum > 0.985 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#mg${opts.id || ''})"/>` :
      `<path d="M ${cx} ${cy - r} A ${r} ${r} 0 0 ${limbSweep} ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z" fill="url(#mg${opts.id || ''})"/>`;
  const craters = opts.mini ? '' : `
    <circle cx="35" cy="38" r="6" fill="#0f172a" opacity="0.10"/>
    <circle cx="62" cy="60" r="8" fill="#0f172a" opacity="0.09"/>
    <circle cx="58" cy="30" r="4" fill="#0f172a" opacity="0.10"/>
    <circle cx="40" cy="66" r="3.5" fill="#0f172a" opacity="0.10"/>`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <defs><radialGradient id="mg${opts.id || ''}" cx="40%" cy="38%" r="70%">
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#cbd5e1"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#1e293b" stroke="#334155" stroke-width="${opts.mini ? 3 : 1.2}"/>
    ${lit}${craters}
  </svg>`;
}

/* ==========================================================================
   5. MÓDULO MODO DE CULTIVO (INDOOR / OUTDOOR)
   ========================================================================== */
const OUTDOOR_PHASES = [
  { key: 'germ', label: 'Germinación', months: 'Sept / Oct', stage: 'plantula', from: [8, 1], to: [9, 31], bar: 'bg-lime-400', ring: 'border-lime-400/50', text: 'text-lime-300',
    tasks: 'Germiná en Cuarto Creciente. Protegé de heladas tardías (hasta mediados de oct. en AMBA). Aclimatá al sol de a poco.' },
  { key: 'veg', label: 'Crecimiento Vegetativo', months: 'Nov – Ene', stage: 'vegetativo', from: [10, 1], to: [0, 31], bar: 'bg-emerald-400', ring: 'border-emerald-400/50', text: 'text-emerald-300',
    tasks: 'Trasplante a maceta final o suelo, podas apicales y LST hasta mediados de enero. Más de 14 h de luz.' },
  { key: 'pre', label: 'Pre-floración', months: 'Febrero', stage: 'transicion', from: [1, 1], to: [1, 28], bar: 'bg-amber-400', ring: 'border-amber-400/50', text: 'text-amber-300',
    tasks: 'Los días bajan a ~13 h: aparecen pistilos y estira. Pasá a nutrición de floración. Última aplicación de Neem.' },
  { key: 'cos', label: 'Floración & Cosecha', months: 'Mar / Abr', stage: 'flora_tardia', from: [2, 1], to: [3, 30], bar: 'bg-fuchsia-400', ring: 'border-fuchsia-400/50', text: 'text-fuchsia-300',
    tasks: 'Engorde y maduración. Bt contra isocas y vigilá Botrytis con lluvias de otoño. Cosechá en Luna Nueva.' }
];

/** Etapa outdoor según el calendario (Buenos Aires / Argentina). */
function outdoorStageForDi(di) {
  const { m, d } = partsFromDi(di);
  if (m === 8 || m === 9) return 'plantula';
  if (m === 10 || m === 11 || m === 0) return 'vegetativo';
  if (m === 1) return 'transicion';
  if (m === 2) return d <= 20 ? 'flora_temprana' : 'flora_tardia';
  if (m === 3) return 'flora_tardia';
  return null; // mayo-agosto: fuera de temporada
}

const indoorTotalWeeks = () => 2 + state.vegWeeks + state.flowerWeeks;
function indoorStageForWeek(w) {
  if (w <= 2) return 'plantula';
  if (w <= 2 + state.vegWeeks) return 'vegetativo';
  const fw = w - 2 - state.vegWeeks;
  if (fw <= 2) return 'transicion';
  if (fw <= 5) return 'flora_temprana';
  if (fw <= state.flowerWeeks) return 'flora_tardia';
  return null;
}
const isFlushWeek = () => state.mode === 'indoor' && state.indoorWeek === indoorTotalWeeks();

/** Etapa estimada para cualquier fecha futura según el modo activo. */
function stageForDi(di) {
  if (state.mode === 'outdoor') return outdoorStageForDi(di);
  const w = state.indoorWeek + Math.floor((di - todayDi()) / 7);
  if (w < 1) return 'plantula';
  return indoorStageForWeek(w);
}

/** Sincroniza la etapa de la calculadora con la línea de tiempo. */
function syncStageFromTimeline() {
  const s = state.mode === 'outdoor' ? outdoorStageForDi(todayDi()) : indoorStageForWeek(state.indoorWeek);
  if (s) state.stage = s;
}

const ModeModule = {
  init() {
    document.querySelectorAll('[data-mode-btn]').forEach((btn) =>
      btn.addEventListener('click', () => this.setMode(btn.dataset.modeBtn)));
    $('header-mode-pill').addEventListener('click', () => this.setMode(state.mode === 'indoor' ? 'outdoor' : 'indoor'));

    // Delegación de eventos dentro de la línea de tiempo
    const cont = $('mode-timeline-container');
    cont.addEventListener('click', (e) => {
      const wk = e.target.closest('[data-week]');
      if (wk) { state.indoorWeek = Number(wk.dataset.week); syncStageFromTimeline(); App.refresh(); return; }
      const step = e.target.closest('[data-week-step]');
      if (step) {
        state.indoorWeek = Math.min(indoorTotalWeeks(), Math.max(1, state.indoorWeek + Number(step.dataset.weekStep)));
        syncStageFromTimeline(); App.refresh(); return;
      }
      const ph = e.target.closest('[data-outdoor-stage]');
      if (ph) { state.stage = ph.dataset.outdoorStage; App.refresh(); toast('Etapa aplicada a la calculadora'); return; }
      if (e.target.closest('[data-sync-today]')) { syncStageFromTimeline(); App.refresh(); toast('Etapa sincronizada con la fecha de hoy'); }
    });
    cont.addEventListener('change', (e) => {
      if (e.target.id === 'sel-veg-weeks') state.vegWeeks = Number(e.target.value);
      else if (e.target.id === 'sel-flower-weeks') state.flowerWeeks = Number(e.target.value);
      else return;
      state.indoorWeek = Math.min(state.indoorWeek, indoorTotalWeeks());
      syncStageFromTimeline(); App.refresh();
    });
  },

  setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    syncStageFromTimeline();
    App.refresh();
    toast(mode === 'indoor' ? '🏠 Modo Indoor: guiado por semanas' : '☀️ Modo Outdoor: calendario Hemisferio Sur');
  },

  render() {
    document.querySelectorAll('[data-mode-btn]').forEach((btn) => {
      const active = btn.dataset.modeBtn === state.mode;
      btn.className = 'mode-toggle-btn flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-bold transition ' +
        (active ? 'bg-gradient-to-r from-emerald-500 to-lime-500 text-botanic-950 shadow-lg shadow-emerald-500/20' : 'text-emerald-200/70 hover:text-emerald-100');
    });
    $('header-mode-label').textContent = state.mode === 'indoor' ? 'Indoor' : 'Outdoor AR';
    $('header-mode-dot').className = 'h-2 w-2 rounded-full ' + (state.mode === 'indoor' ? 'bg-sky-400' : 'bg-lime-400');
    $('mode-timeline-container').innerHTML = state.mode === 'outdoor' ? this.outdoorHTML() : this.indoorHTML();
  },

  outdoorHTML() {
    const today = todayDi();
    const p = partsFromDi(today);
    const seasonYear = p.m >= 8 ? p.y : p.y - 1; // la temporada arranca en septiembre
    const start = diFromYMD(seasonYear, 8, 1);
    const end = diFromYMD(seasonYear + 1, 3, 30);
    const inSeason = today >= start && today <= end;
    const pos = Math.max(0, Math.min(100, ((today - start) / (end - start)) * 100));
    const region = REGIONS[state.region];
    const hours = dayLengthHours(region.lat, today);
    const solstice = diFromYMD(p.m === 11 && p.d > 21 ? p.y + 1 : p.y, 11, 21);
    const trend = (today < diFromYMD(p.y, 11, 21) && p.m >= 6) ? 'Días alargándose hasta el solsticio del 21 dic' : 'Días acortándose: la floración se acerca';
    const currentStage = outdoorStageForDi(today);

    const segs = OUTDOOR_PHASES.map((ph) => {
      const fromY = ph.from[0] >= 8 ? seasonYear : seasonYear + 1;
      const toY = ph.to[0] >= 8 ? seasonYear : seasonYear + 1;
      const days = diFromYMD(toY, ph.to[0], ph.to[1]) - diFromYMD(fromY, ph.from[0], ph.from[1]) + 1;
      return `<div class="${ph.bar} h-full first:rounded-l-full last:rounded-r-full opacity-80" style="flex:${days}" title="${ph.label}"></div>`;
    }).join('');

    const monthLabels = ['Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr']
      .map((m) => `<span class="flex-1 text-center">${m}</span>`).join('');

    const cards = OUTDOOR_PHASES.map((ph) => {
      const fromY = ph.from[0] >= 8 ? seasonYear : seasonYear + 1;
      const toY = ph.to[0] >= 8 ? seasonYear : seasonYear + 1;
      const active = inSeason && today >= diFromYMD(fromY, ph.from[0], ph.from[1]) && today <= diFromYMD(toY, ph.to[0], ph.to[1]);
      return `<button type="button" data-outdoor-stage="${ph.stage}" class="text-left rounded-xl border p-3 transition hover:brightness-125 ${active ? ph.ring + ' bg-emerald-500/10 ring-1 ring-emerald-400/30' : 'border-emerald-500/15 bg-botanic-950/60'}">
        <div class="flex items-center justify-between gap-1">
          <span class="text-[10px] font-bold uppercase tracking-wider ${ph.text}">${ph.months}</span>
          ${active ? '<span class="rounded-full bg-emerald-400 px-1.5 py-0.5 text-[9px] font-extrabold text-botanic-950">AHORA</span>' : ''}
        </div>
        <div class="mt-0.5 text-sm font-bold text-white">${ph.label}</div>
        <p class="mt-1 text-[11px] leading-snug text-emerald-100/65">${ph.tasks}</p>
      </button>`;
    }).join('');

    return `
      <div class="rounded-xl border border-emerald-500/15 bg-botanic-950/50 p-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p class="text-xs text-emerald-100/80">📍 Fotoperiódicas · <strong>${region.label}</strong> · Temporada ${seasonYear}/${String(seasonYear + 1).slice(2)}</p>
          <div class="flex flex-wrap gap-1.5">
            <span class="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 font-mono text-[11px] font-semibold text-amber-200">☀️ ${fmtHours(hours)} de luz hoy</span>
            ${currentStage ? `<button type="button" data-sync-today="1" class="rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/25">↻ Usar etapa de hoy</button>` : ''}
          </div>
        </div>
        <div class="relative pt-5">
          ${inSeason ? `<div class="absolute top-0 -translate-x-1/2 flex flex-col items-center" style="left:${pos}%">
            <span class="rounded bg-white px-1.5 py-px text-[9px] font-extrabold text-botanic-950 whitespace-nowrap">HOY ${p.d}/${p.m + 1}</span>
            <span class="h-5 w-0.5 bg-white"></span></div>` : ''}
          <div class="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">${segs}</div>
          <div class="mt-1.5 flex text-[10px] font-semibold uppercase text-emerald-200/55">${monthLabels}</div>
        </div>
        ${inSeason ? `<p class="mt-2 text-[11px] text-emerald-200/60">${trend}.</p>` :
          `<p class="mt-3 rounded-lg border border-sky-400/25 bg-sky-500/10 p-2.5 text-xs text-sky-100">❄️ <strong>Fuera de temporada (may–ago):</strong> prepará el suelo con compost, seleccioná genéticas y hacé esquejes indoor. La germinación outdoor arranca en septiembre.</p>`}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">${cards}</div>`;
  },

  indoorHTML() {
    const total = indoorTotalWeeks();
    const w = state.indoorWeek;
    const stage = indoorStageForWeek(w) || 'flora_tardia';
    const st = STAGES[stage];
    const harvestDi = todayDi() + (total - w) * 7;
    const colorFor = (s) => ({
      plantula: 'border-lime-400/40 text-lime-300', vegetativo: 'border-emerald-400/40 text-emerald-300',
      transicion: 'border-amber-400/40 text-amber-300', flora_temprana: 'border-pink-400/40 text-pink-300',
      flora_tardia: 'border-fuchsia-400/40 text-fuchsia-300'
    }[s]);
    const chips = Array.from({ length: total }, (_, i) => {
      const n = i + 1;
      const s = indoorStageForWeek(n);
      const active = n === w;
      const flush = n === total;
      return `<button type="button" data-week="${n}" title="Semana ${n} · ${STAGES[s].label}${flush ? ' · Lavado' : ''}"
        class="shrink-0 flex flex-col items-center justify-center w-11 h-14 rounded-xl border text-xs font-bold transition ${active ? 'bg-gradient-to-b from-emerald-400 to-lime-400 text-botanic-950 border-transparent shadow-lg shadow-emerald-500/25' : colorFor(s) + ' bg-botanic-950/70 hover:bg-botanic-800'}">
        <span class="text-[9px] uppercase opacity-70">Sem</span><span class="font-mono text-sm">${n}</span><span class="text-[10px] leading-none">${flush ? '🚿' : STAGES[s].emoji}</span>
      </button>`;
    }).join('');
    const opt = (from, to, sel) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .map((v) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${v} semanas</option>`).join('');

    return `
      <div class="rounded-xl border border-emerald-500/15 bg-botanic-950/50 p-3.5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <button type="button" data-week-step="-1" class="h-9 w-9 rounded-lg border border-emerald-500/25 bg-botanic-950 font-bold text-emerald-300 hover:border-emerald-400" aria-label="Semana anterior">−</button>
            <div>
              <div class="text-sm font-extrabold text-white">Semana ${w} <span class="text-emerald-300/60 font-semibold">de ${total}</span></div>
              <div class="text-[11px] text-emerald-200/70">${st.emoji} ${st.label} · Luz ${st.light}</div>
            </div>
            <button type="button" data-week-step="1" class="h-9 w-9 rounded-lg border border-emerald-500/25 bg-botanic-950 font-bold text-emerald-300 hover:border-emerald-400" aria-label="Semana siguiente">+</button>
          </div>
          <div class="flex gap-2">
            <label class="text-[10px] font-bold uppercase tracking-wider text-emerald-200/60">Vege
              <select id="sel-veg-weeks" class="mt-0.5 block rounded-lg border border-emerald-500/25 bg-botanic-950 px-2 py-1 text-xs font-semibold text-white">${opt(2, 8, state.vegWeeks)}</select></label>
            <label class="text-[10px] font-bold uppercase tracking-wider text-emerald-200/60">Flora
              <select id="sel-flower-weeks" class="mt-0.5 block rounded-lg border border-emerald-500/25 bg-botanic-950 px-2 py-1 text-xs font-semibold text-white">${opt(7, 12, state.flowerWeeks)}</select></label>
          </div>
        </div>
        <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">${chips}</div>
        <div class="flex flex-wrap gap-2 text-[11px]">
          <span class="rounded-lg border border-emerald-500/20 bg-botanic-950 px-2 py-1 text-emerald-200/80">🗓️ Cosecha estimada: <strong class="text-white">${fmtDate(harvestDi)} ${partsFromDi(harvestDi).y}</strong></span>
          <span class="rounded-lg border border-emerald-500/20 bg-botanic-950 px-2 py-1 text-emerald-200/80">💡 Pasar a 12/12 en la semana <strong class="text-white">${3 + state.vegWeeks}</strong></span>
          <span class="rounded-lg border border-emerald-500/20 bg-botanic-950 px-2 py-1 text-emerald-200/80">🚿 Lavado de raíces: semana <strong class="text-white">${total}</strong></span>
        </div>
      </div>`;
  }
};

/* ==========================================================================
   6. MÓDULO CALCULADORA DE FERTILIZANTES
   ========================================================================== */
const CalculatorModule = {
  init() {
    const input = $('input-liters');
    input.value = state.liters;
    input.addEventListener('input', () => {
      const v = parseFloat(String(input.value).replace(',', '.'));
      if (!isNaN(v) && v > 0) { state.liters = Math.min(500, v); this.render(); saveState(); }
    });
    input.addEventListener('blur', () => { input.value = state.liters; });
    const step = (delta) => {
      state.liters = Math.max(0.5, Math.min(500, Math.round((state.liters + delta) * 2) / 2));
      input.value = state.liters; this.render(); saveState();
    };
    $('btn-liters-dec').addEventListener('click', () => step(-0.5));
    $('btn-liters-inc').addEventListener('click', () => step(0.5));
    document.querySelectorAll('.liter-preset-btn').forEach((b) => b.addEventListener('click', () => {
      state.liters = Number(b.dataset.liters); input.value = state.liters; this.render(); saveState();
    }));

    $('select-brand').addEventListener('change', (e) => { state.brand = e.target.value; App.refresh(); });
    $('brand-cards-grid').addEventListener('click', (e) => {
      const card = e.target.closest('[data-brand]');
      if (card) { state.brand = card.dataset.brand; App.refresh(); }
    });
    $('select-stage').addEventListener('change', (e) => { state.stage = e.target.value; App.refresh(); });
    $('stage-pills-container').addEventListener('click', (e) => {
      const pill = e.target.closest('[data-stage]');
      if (pill) { state.stage = pill.dataset.stage; App.refresh(); }
    });
  },

  /** Devuelve la receta calculada para el estado actual (usada también por export). */
  compute() {
    const brand = BRANDS[state.brand];
    const coco = state.substrate === 'coco';
    const rows = [], unused = [];
    brand.products.forEach((p) => {
      let dose = p.doses[state.stage] || 0;
      if (dose === 0) { unused.push(p.name); return; }
      if (coco && brand.mineral && p.base) dose = Math.min(dose * 1.2, 4);
      dose *= state.doseFactor;
      rows.push({ ...p, dosePerL: dose, total: dose * state.liters });
    });
    return { brand, rows, unused, params: STAGE_PARAMS[state.substrate][state.stage] };
  },

  render() {
    const { brand, rows, unused, params } = this.compute();
    const stage = STAGES[state.stage];

    // Marcas
    $('select-brand').value = state.brand;
    $('brand-cards-grid').innerHTML = Object.entries(BRANDS).map(([key, b]) => {
      const active = key === state.brand;
      return `<button type="button" data-brand="${key}" aria-pressed="${active}"
        class="text-left rounded-xl border p-2.5 transition ${active ? 'border-emerald-400/60 bg-emerald-500/15 ring-1 ring-emerald-400/30' : 'border-emerald-500/15 bg-botanic-950/70 hover:border-emerald-400/35'}">
        <div class="flex items-center justify-between"><span class="text-lg">${b.icon}</span>
          ${active ? '<span class="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>' : ''}</div>
        <div class="mt-1 text-sm font-bold text-white leading-tight">${b.name}</div>
        <div class="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/60">${b.type} · ${b.products.length} prod.</div>
      </button>`;
    }).join('');

    // Etapas
    $('select-stage').value = state.stage;
    $('stage-pills-container').innerHTML = STAGE_ORDER.map((s) => {
      const active = s === state.stage;
      return `<button type="button" data-stage="${s}" class="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${active ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200' : 'border-emerald-500/15 bg-botanic-950/60 text-emerald-200/60 hover:text-emerald-100'}">${STAGES[s].emoji} ${STAGES[s].label}</button>`;
    }).join('');

    // Encabezado de resultado
    $('calc-substrate-badge').textContent = state.substrate === 'coco' ? 'Coco / Hidro' : 'Sustrato';
    $('result-brand-type').textContent = brand.type;
    const intensity = $('result-intensity-badge');
    intensity.classList.toggle('hidden', state.doseFactor === 1);
    intensity.textContent = 'Dosis ' + Math.round(state.doseFactor * 100) + '%';
    $('result-title').textContent = `Receta ${brand.name} · ${stage.label}`;
    $('result-subtitle').textContent = `Dosis calculada para ${fmtNum(state.liters)} litros de agua de riego`;
    $('result-ph').textContent = params.ph;
    $('result-ec').textContent = params.ec;

    // Tabla
    $('fertilizer-table-body').innerHTML = rows.length ? rows.map((r, i) => `
      <tr class="hover:bg-emerald-500/5 transition">
        <td class="py-3 pl-3.5 pr-2">
          <div class="flex items-start gap-2">
            <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 font-mono text-[10px] font-bold text-emerald-300">${i + 1}</span>
            <div><div class="font-bold text-white leading-tight">${r.name}</div>
            <div class="text-[11px] text-emerald-200/55">${r.role}</div></div>
          </div>
        </td>
        <td class="py-3 px-2 text-right font-mono text-xs text-emerald-200/75 whitespace-nowrap">${fmtNum(r.dosePerL)} ${r.unit}/L</td>
        <td class="py-3 px-3 text-right whitespace-nowrap">
          <span class="font-mono text-lg font-extrabold text-emerald-300">${fmtNum(r.total)}</span>
          <span class="text-xs font-bold text-emerald-400/70">${r.unit}</span>
        </td>
        <td class="hidden sm:table-cell py-3 pl-2 pr-3.5 text-[11px] text-emerald-100/60">${r.note}</td>
      </tr>`).join('') :
      `<tr><td colspan="4" class="py-6 text-center text-sm text-emerald-200/60">Esta línea no tiene productos para la etapa seleccionada.</td></tr>`;

    // Protocolo de mezcla
    const totalMl = rows.filter((r) => r.unit === 'ml').reduce((a, r) => a + r.total, 0);
    const totalG = rows.filter((r) => r.unit === 'g').reduce((a, r) => a + r.total, 0);
    const syringe = rows.some((r) => r.total < 2) ? ' Usá jeringa de 1–5 ml para las dosis menores a 2 ml.' : '';
    $('mixing-protocol-box').innerHTML = `
      ${isFlushWeek() ? `<div class="rounded-lg border border-sky-400/35 bg-sky-500/10 p-2.5 text-sky-100"><strong>🚿 Semana de lavado de raíces:</strong> regá solo con agua con pH ajustado. Las cantidades quedan como referencia.</div>` : ''}
      <div class="flex flex-wrap gap-2">
        <span class="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-2 py-1 font-mono font-bold text-emerald-200">Σ ${fmtNum(totalMl)} ml${totalG ? ' + ' + fmtNum(totalG) + ' g' : ''}</span>
        <span class="rounded-lg bg-botanic-900 border border-emerald-500/15 px-2 py-1 text-emerald-200/75">${stage.emoji} ${stage.desc}</span>
      </div>
      <p><strong class="text-emerald-300">🧪 Orden de mezcla:</strong> ${brand.mixOrder}${syringe}</p>
      <p class="text-emerald-200/60">ℹ️ ${brand.tip}${unused.length ? ' · Sin uso en esta etapa: ' + unused.join(', ') + '.' : ''}</p>`;
  }
};

/* ==========================================================================
   7. MÓDULO CALENDARIO LUNAR
   ========================================================================== */
const LunarModule = {
  init() {
    const t = partsFromDi(todayDi());
    ui.lunarYear = Math.min(2027, Math.max(2026, t.y));
    ui.lunarMonth = (t.y < 2026) ? 0 : (t.y > 2027 ? 11 : t.m);
    ui.lunarSelectedDi = todayDi();

    $('select-lunar-month').addEventListener('change', (e) => { ui.lunarMonth = Number(e.target.value); this.render(); });
    $('select-lunar-year').addEventListener('change', (e) => { ui.lunarYear = Number(e.target.value); this.render(); });
    $('btn-lunar-prev').addEventListener('click', () => this.shiftMonth(-1));
    $('btn-lunar-next').addEventListener('click', () => this.shiftMonth(1));
    $('btn-lunar-today').addEventListener('click', () => {
      const p = partsFromDi(todayDi());
      ui.lunarSelectedDi = todayDi();
      if (p.y >= 2026 && p.y <= 2027) { ui.lunarYear = p.y; ui.lunarMonth = p.m; }
      this.render();
    });
    $('lunar-calendar-grid').addEventListener('click', (e) => {
      const cell = e.target.closest('[data-di]');
      if (cell) { ui.lunarSelectedDi = Number(cell.dataset.di); this.render(); }
    });
    $('lunar-filter-group').addEventListener('click', (e) => {
      const b = e.target.closest('[data-lunar-filter]');
      if (b) { state.lunarFilter = b.dataset.lunarFilter; saveState(); this.render(); }
    });
  },

  shiftMonth(delta) {
    let m = ui.lunarMonth + delta, y = ui.lunarYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    if (y < 2026 || y > 2027) return toast('Calendario disponible para 2026 – 2027');
    ui.lunarMonth = m; ui.lunarYear = y;
    this.render();
  },

  /** Sugerencia adaptada a la etapa del cultivo. */
  stageHint(cat, stage) {
    const H = {
      germinacion: { plantula: 'Ideal para germinar y aplicar foliares suaves de algas.', vegetativo: 'Foliar de aminoácidos/algas y riego con abono de crecimiento.', transicion: 'Último foliar antes de que se formen cogollos.', flora_temprana: 'Sin foliares sobre flores: solo riego con abono de floración.', flora_tardia: 'Sin foliares. Riego con PK y azúcares.' },
      podas: { plantula: 'Trasplante a maceta intermedia sin dañar el pan de raíces.', vegetativo: 'Poda apical/FIM, LST y esquejes de madres.', transicion: 'Lollipop (limpieza de bajos) y defoliación ligera.', flora_temprana: 'Defoliación ligera solo hasta la sem 3 de flora.', flora_tardia: 'Evitá podas: solo retirar hojas secas.' },
      cosecha: { plantula: 'Control de mosquita del sustrato (Bti / trampas amarillas).', vegetativo: 'Control de plagas de raíz y aireado del sustrato.', transicion: 'Revisá raíces y drenaje; sin podas.', flora_temprana: 'Control de raíz; dejá descansar la planta.', flora_tardia: '🌾 Ventana ideal de cosecha si los tricomas están lechosos/ámbar.' }
    };
    return (H[cat] && H[cat][stage]) || '';
  },

  render() {
    const today = todayDi();
    const sel = ui.lunarSelectedDi ?? today;
    const info = LunarEngine.info(sel);
    const cat = LUNAR_CATS[info.category];

    // Hero
    $('lunar-hero-svg').innerHTML = moonSVG(info.frac, 96, { id: 'hero' });
    $('lunar-selected-date-label').textContent = (sel === today ? 'Hoy · ' : '') + fmtDate(sel) + ' ' + partsFromDi(sel).y + ' · H.O.A.';
    $('lunar-phase-title').textContent = info.exact ? `${info.name} · ${arTime(info.exact.ms)} h` : info.name;
    $('lunar-phase-meta').textContent = `Iluminación ${Math.round(info.illum * 100)}% · Día ${Math.floor(info.age) + 1} del ciclo · ${info.waxing ? 'Creciente (C)' : 'Menguante (D)'}`;
    const hint = this.stageHint(info.category, state.stage);
    $('lunar-day-recommendation').innerHTML = `
      <div class="flex items-center gap-2"><span class="text-xl">${cat.icon}</span>
        <div><span class="inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${cat.chip}">${cat.label}</span>
        <div class="text-sm font-extrabold text-white">${cat.task}</div></div></div>
      <ul class="mt-2 space-y-0.5 text-xs text-emerald-100/80">${cat.tasks.map((t) => `<li>• ${t}</li>`).join('')}</ul>
      ${hint ? `<p class="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-[11px] text-emerald-200"><strong>Para tu cultivo (${STAGES[state.stage].label}):</strong> ${hint}</p>` : ''}`;

    // Tarjetas de ventanas próximas
    $('lunar-task-cards').innerHTML = ['germinacion', 'podas', 'cosecha'].map((key) => {
      const c = LUNAR_CATS[key];
      const w = LunarEngine.nextWindow(key, today);
      const evType = key === 'germinacion' ? 'fq' : key === 'podas' ? 'lq' : 'new';
      const ev = LunarEngine.nextEventOfType(evType, w ? w.start - 1 : today);
      const status = !w ? '' : w.active
        ? `<span class="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-extrabold text-botanic-950">ACTIVA · hasta ${fmtDate(w.end, false)}</span>`
        : `<span class="rounded-full border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-200">${relDays(w.start - today)}</span>`;
      return `<div class="glass-card rounded-2xl p-4 ${w && w.active ? 'ring-1 ring-emerald-400/40' : ''}">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2"><span class="flex h-10 w-10 items-center justify-center rounded-xl border text-lg ${c.chip}">${c.icon}</span>
            <div><div class="text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">${c.label}</div>
            <div class="text-sm font-extrabold text-white leading-tight">${c.task}</div></div></div>
          ${status}
        </div>
        ${w ? `<div class="mt-3 font-mono text-xs text-emerald-100"><span class="text-emerald-300/60">Ventana:</span> ${fmtDate(w.start)} → ${fmtDate(w.end)}</div>` : ''}
        ${ev ? `<div class="font-mono text-[11px] text-emerald-200/60">${PHASE_NAMES[ev.type]}: ${fmtDate(ev.di)} · ${arTime(ev.ms)} h</div>` : ''}
        <ul class="mt-2 space-y-0.5 text-xs text-emerald-100/75">${c.tasks.map((t) => `<li>• ${t}</li>`).join('')}</ul>
        <p class="mt-2 text-[11px] italic text-emerald-200/50">${c.why}</p>
        <p class="mt-2 text-[11px] text-emerald-200"><strong>Tu etapa:</strong> ${this.stageHint(key, state.stage)}</p>
      </div>`;
    }).join('');

    // Selectores
    $('select-lunar-month').value = String(ui.lunarMonth);
    $('select-lunar-year').value = String(ui.lunarYear);
    document.querySelectorAll('.lunar-filter-btn').forEach((b) => {
      const active = b.dataset.lunarFilter === state.lunarFilter;
      b.className = 'lunar-filter-btn shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition ' +
        (active ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100' : 'border-emerald-500/15 bg-botanic-950/60 text-emerald-200/60 hover:text-emerald-100');
    });

    // Grilla mensual (semana inicia lunes)
    const y = ui.lunarYear, m = ui.lunarMonth;
    const first = diFromYMD(y, m, 1);
    const daysInMonth = diFromYMD(m === 11 ? y + 1 : y, (m + 1) % 12, 1) - first;
    const lead = (partsFromDi(first).dow + 6) % 7;
    let html = '';
    for (let i = 0; i < lead; i++) html += '<div></div>';
    for (let d = 0; d < daysInMonth; d++) {
      const di = first + d;
      const inf = LunarEngine.info(di);
      const c = LUNAR_CATS[inf.category];
      const dim = state.lunarFilter !== 'all' && inf.category !== state.lunarFilter;
      const isToday = di === today, isSel = di === sel;
      html += `<button type="button" data-di="${di}" title="${inf.name} · ${c.task}"
        class="relative flex flex-col items-center justify-between rounded-lg border p-1 min-h-[3.6rem] sm:min-h-[4.4rem] transition hover:brightness-150 ${c.cell} ${dim ? 'opacity-25' : ''} ${isSel ? 'ring-2 ring-white/80' : isToday ? 'ring-2 ring-emerald-400' : ''}">
        <span class="self-start font-mono text-[11px] font-bold ${isToday ? 'text-emerald-300' : 'text-white/85'}">${d + 1}</span>
        <span class="block">${moonSVG(inf.frac, 18, { mini: true, id: 'c' + di })}</span>
        <span class="text-[9px] leading-none ${inf.exact ? 'font-extrabold text-white' : 'opacity-70'}">${inf.exact ? { new: 'NUEVA', fq: 'C. CREC', full: 'LLENA', lq: 'C. MENG' }[inf.exact.type] : c.icon}</span>
      </button>`;
    }
    $('lunar-calendar-grid').innerHTML = html;

    // Hitos exactos del mes
    $('lunar-month-exact-events').innerHTML = LunarEngine.eventsInMonth(y, m).map((e) => {
      const inf = LunarEngine.info(e.di);
      return `<button type="button" onclick="ui.lunarSelectedDi=${e.di};LunarModule.render()" class="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-botanic-950/70 p-2 text-left hover:border-emerald-400/40">
        ${moonSVG(inf.frac, 26, { mini: true, id: 'e' + e.di })}
        <div><div class="text-[11px] font-bold text-white">${PHASE_NAMES[e.type]}</div>
        <div class="font-mono text-[10px] text-emerald-200/65">${fmtDate(e.di)} · ${arTime(e.ms)} h</div></div>
      </button>`;
    }).join('');
  }
};

/* ==========================================================================
   8. MÓDULO PLAGAS (Manejo Integrado preventivo cada 10-15 días)
   ========================================================================== */
const TREATMENTS = {
  neem: { name: 'Aceite de Neem + Jabón Potásico', short: 'Neem + Potásico', icon: '🌿', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35', target: 'Trips, arañuela, pulgón, mosca blanca', protocol: 'Emulsionar el jabón primero, luego el Neem. Mojar envés.' },
  neem_soft: { name: 'Neem + Jabón Potásico (dosis 50%)', short: 'Neem suave', icon: '🌱', chip: 'bg-lime-500/15 text-lime-300 border-lime-400/35', target: 'Prevención general en plantines', protocol: 'Media dosis, pulverización fina y lejos de la luz.' },
  neem_last: { name: 'Neem + Jabón Potásico (última)', short: 'Neem (último)', icon: '⏳', chip: 'bg-amber-500/15 text-amber-300 border-amber-400/35', target: 'Trips y arañuela antes de flora', protocol: 'Última aplicación de aceites antes de formar cogollos.' },
  bt: { name: 'Bacillus thuringiensis (kurstaki)', short: 'Bt', icon: '🐛', chip: 'bg-sky-500/15 text-sky-300 border-sky-400/35', target: 'Orugas e isocas (Helicoverpa, Spodoptera)', protocol: 'Al atardecer (la luz UV lo degrada). Cubrir toda la planta.' },
  bt_late: { name: 'Bacillus thuringiensis (refuerzo flora)', short: 'Bt flora', icon: '🛡️', chip: 'bg-sky-500/15 text-sky-300 border-sky-400/35', target: 'Isocas dentro de cogollos (evita Botrytis)', protocol: 'Vital mar-abr. Suspender 7 días antes del corte.' },
  soap_low: { name: 'Jabón Potásico solo (hojas bajas)', short: 'Potásico', icon: '🧼', chip: 'bg-teal-500/15 text-teal-300 border-teal-400/35', target: 'Arañuela y trips focalizados', protocol: 'Solo envés de hojas grandes. No mojar flores.' },
  monitor: { name: 'Monitoreo sin pulverizar', short: 'Monitoreo', icon: '🔍', chip: 'bg-slate-500/15 text-slate-300 border-slate-400/35', target: 'Detección temprana', protocol: 'Trampas cromáticas amarillas/azules + lupa x30.' },
  none: { name: 'Fuera de ciclo', short: 'Descanso', icon: '🧹', chip: 'bg-slate-500/15 text-slate-300 border-slate-400/35', target: 'Limpieza del espacio', protocol: 'Desinfectar carpa/macetas y solarizar sustrato.' }
};

function treatmentFor(stage, n) {
  const outdoor = state.mode === 'outdoor';
  switch (stage) {
    case 'plantula': return 'neem_soft';
    case 'vegetativo': return outdoor && n % 2 === 1 ? 'bt' : 'neem';
    case 'transicion': return outdoor ? (n % 2 === 0 ? 'neem_last' : 'bt') : 'neem_last';
    case 'flora_temprana': return outdoor ? 'bt' : 'soap_low';
    case 'flora_tardia': return outdoor ? 'bt_late' : 'monitor';
    default: return 'none';
  }
}

/** Dosis de un tratamiento para el volumen del pulverizador. */
function treatmentDose(key, liters) {
  const L = liters;
  switch (key) {
    case 'neem': case 'neem_last': return `${fmtNum(PEST_DOSES.neem * L)} ml Neem + ${fmtNum(PEST_DOSES.soap * L)} ml Potásico`;
    case 'neem_soft': return `${fmtNum(PEST_DOSES.neem * L / 2)} ml Neem + ${fmtNum(PEST_DOSES.soap * L / 2)} ml Potásico`;
    case 'bt': case 'bt_late': return `${fmtNum(PEST_DOSES.bt * L)} g Bt`;
    case 'soap_low': return `${fmtNum(PEST_DOSES.soap * L)} ml Potásico`;
    default: return '—';
  }
}

const PestModule = {
  init() {
    if (state.pestLast == null) state.pestLast = todayDi();
    $('input-pest-last-date').value = diToInput(state.pestLast);
    $('select-pest-interval').value = String(state.pestInterval);
    $('select-sprayer-liters').value = String(state.sprayer);
    $('input-pest-last-date').addEventListener('change', (e) => {
      if (e.target.value) { state.pestLast = inputToDi(e.target.value); App.refresh(); }
    });
    $('select-pest-interval').addEventListener('change', (e) => { state.pestInterval = Number(e.target.value); App.refresh(); });
    $('select-sprayer-liters').addEventListener('change', (e) => { state.sprayer = Number(e.target.value); App.refresh(); });
    $('pest-alert-card').addEventListener('click', (e) => {
      if (e.target.closest('[data-mark-applied]')) {
        state.pestLast = todayDi();
        $('input-pest-last-date').value = diToInput(state.pestLast);
        App.refresh();
        toast('✅ Aplicación registrada hoy');
      }
    });
  },

  schedule(count = 6) {
    return Array.from({ length: count }, (_, i) => {
      const di = state.pestLast + state.pestInterval * (i + 1);
      const stage = stageForDi(di);
      const key = treatmentFor(stage, i);
      return { di, stage, key, t: TREATMENTS[key], dose: treatmentDose(key, state.sprayer) };
    });
  },

  render() {
    const today = todayDi();
    const next = this.schedule(1)[0];
    const diff = next.di - today;
    const overdue = diff < 0, due = diff <= 1;
    $('nav-pest-dot').classList.toggle('hidden', !due);

    const tone = overdue ? 'border-red-400/40 bg-red-500/10 text-red-200' : due ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
    const headline = overdue ? `⚠️ Aplicación atrasada ${Math.abs(diff)} días` : diff === 0 ? '🔔 Toca aplicar HOY' : diff === 1 ? '🔔 Aplicación mañana' : `Próxima aplicación ${relDays(diff)}`;
    $('pest-alert-card').innerHTML = `
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3.5">
          <div class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border ${tone}">
            <span class="font-mono text-xl font-extrabold leading-none">${Math.abs(diff)}</span>
            <span class="text-[9px] font-bold uppercase">${overdue ? 'atraso' : 'días'}</span>
          </div>
          <div>
            <span class="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Alerta Preventiva · cada ${state.pestInterval} días</span>
            <h2 class="text-lg font-extrabold text-white">${headline}</h2>
            <p class="text-xs text-emerald-100/75">${fmtDate(next.di)} · ${next.t.icon} <strong>${next.t.name}</strong> · ${next.dose} en ${fmtNum(state.sprayer)} L</p>
          </div>
        </div>
        <button type="button" data-mark-applied="1" class="shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 px-4 py-2.5 text-xs font-extrabold text-botanic-950 shadow-lg shadow-emerald-500/20 hover:brightness-110">✅ Marcar aplicada hoy</button>
      </div>`;

    // Fichas de biocontroles
    const L = state.sprayer;
    const stage = state.stage;
    const neemOk = ['plantula', 'vegetativo', 'transicion'].includes(stage);
    const outdoor = state.mode === 'outdoor';
    const badge = (ok, txt) => `<span class="rounded-full border px-2 py-0.5 text-[10px] font-bold ${ok ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' : 'border-red-400/40 bg-red-500/10 text-red-300'}">${txt}</span>`;
    $('pest-biocontrol-cards').innerHTML = `
      <div class="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div><span class="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Prevención general</span>
          <h3 class="text-base font-extrabold text-white">🌿 Aceite de Neem + Jabón Potásico</h3></div>
          ${badge(neemOk, neemOk ? 'Apto en tu etapa' : 'Suspender en flora')}
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-emerald-500/20 bg-botanic-950/80 p-2.5 text-center"><div class="text-[10px] font-bold uppercase text-emerald-300/60">Neem (${PEST_DOSES.neem} ml/L)</div><div class="font-mono text-xl font-extrabold text-emerald-300">${fmtNum(PEST_DOSES.neem * L)} ml</div></div>
          <div class="rounded-xl border border-emerald-500/20 bg-botanic-950/80 p-2.5 text-center"><div class="text-[10px] font-bold uppercase text-emerald-300/60">Potásico (${PEST_DOSES.soap} ml/L)</div><div class="font-mono text-xl font-extrabold text-lime-300">${fmtNum(PEST_DOSES.soap * L)} ml</div></div>
        </div>
        <ul class="space-y-1 text-xs text-emerald-100/80">
          <li>🎯 <strong>Objetivo:</strong> trips, arañuela roja, pulgón y mosca blanca.</li>
          <li>🧪 Disolvé el jabón en agua tibia y después sumá el Neem (el jabón lo emulsiona). Usar en el momento.</li>
          <li>📅 Cada ${state.pestInterval} días desde plántula hasta la <strong>semana 2 de floración</strong>.</li>
          <li>🚫 Nunca sobre cogollos formados: deja sabor y retiene humedad.</li>
        </ul>
      </div>
      <div class="glass-card rounded-2xl p-4 sm:p-5 space-y-3 ${outdoor && ['transicion', 'flora_temprana', 'flora_tardia'].includes(stage) ? 'ring-1 ring-sky-400/40' : ''}">
        <div class="flex items-start justify-between gap-2">
          <div><span class="text-[10px] font-bold uppercase tracking-widest text-sky-400">Orugas e isocas</span>
          <h3 class="text-base font-extrabold text-white">🐛 Bacillus thuringiensis</h3></div>
          ${badge(true, outdoor ? 'Vital en flora outdoor' : 'Apto todo el ciclo')}
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-sky-500/20 bg-botanic-950/80 p-2.5 text-center"><div class="text-[10px] font-bold uppercase text-sky-300/60">Bt (${PEST_DOSES.bt} g/L)</div><div class="font-mono text-xl font-extrabold text-sky-300">${fmtNum(PEST_DOSES.bt * L)} g</div></div>
          <div class="rounded-xl border border-sky-500/20 bg-botanic-950/80 p-2.5 text-center"><div class="text-[10px] font-bold uppercase text-sky-300/60">Volumen</div><div class="font-mono text-xl font-extrabold text-white">${fmtNum(L)} L</div></div>
        </div>
        <ul class="space-y-1 text-xs text-emerald-100/80">
          <li>🎯 <strong>Objetivo:</strong> isoca bolillera (<em>Helicoverpa</em>) y cogollera (<em>Spodoptera</em>) que pudren cogollos desde adentro.</li>
          <li>🌆 Siempre al atardecer: la luz UV lo inactiva en pocas horas. Repetir tras lluvias.</li>
          <li>📅 Outdoor: desde enero cada 7–10 días si ves polillas; resto del ciclo cada ${state.pestInterval} días.</li>
          <li>✅ Biológico, inocuo para personas y abejas. Cortar 7 días antes de cosechar.</li>
        </ul>
        <p class="text-[10px] text-emerald-200/45">Dosis orientativa para formulados en polvo mojable. Verificá la etiqueta de tu producto.</p>
      </div>`;

    // Cronograma
    const sched = this.schedule(6);
    $('pest-context-badge').textContent = `${outdoor ? '☀️ Outdoor' : '🏠 Indoor'} · ${STAGES[state.stage].label}`;
    $('pest-schedule-tbody').innerHTML = sched.map((s) => {
      const d = s.di - today;
      return `<tr class="hover:bg-emerald-500/5 ${d < 0 ? 'opacity-60' : ''}">
        <td class="py-2.5 pl-3.5 pr-2 whitespace-nowrap"><div class="font-mono font-bold text-white">${fmtDate(s.di)}</div>
          <div class="text-[10px] text-emerald-200/55">${relDays(d)} · ${s.stage ? STAGES[s.stage].emoji + ' ' + STAGES[s.stage].label : 'Fin de ciclo'}</div></td>
        <td class="py-2.5 px-2"><span class="inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ${s.t.chip}">${s.t.icon} ${s.t.short}</span>
          <div class="mt-0.5 font-mono text-[10px] text-emerald-200/65">${s.dose}</div></td>
        <td class="py-2.5 px-2 text-emerald-100/75">${s.t.target}</td>
        <td class="hidden sm:table-cell py-2.5 pl-2 pr-3.5 text-[11px] text-emerald-100/60">${s.t.protocol}</td>
      </tr>`;
    }).join('');
  }
};

/* ==========================================================================
   9. MÓDULO CONFIGURACIÓN
   ========================================================================== */
const ConfigModule = {
  init() {
    $('cfg-crop-name').value = state.cropName;
    $('cfg-region').value = state.region;
    $('cfg-substrate').value = state.substrate;
    $('cfg-dose-factor').value = String(state.doseFactor);
    $('cfg-crop-name').addEventListener('input', (e) => { state.cropName = e.target.value; saveState(); App.renderHeader(); });
    $('cfg-region').addEventListener('change', (e) => { state.region = e.target.value; App.refresh(); });
    $('cfg-substrate').addEventListener('change', (e) => { state.substrate = e.target.value; App.refresh(); });
    $('cfg-dose-factor').addEventListener('change', (e) => { state.doseFactor = Number(e.target.value); App.refresh(); });
    $('btn-copy-whatsapp').addEventListener('click', () => this.copySummary());
    $('btn-reset-app').addEventListener('click', () => {
      if (!confirm('¿Restablecer todos los valores? Se borrará tu configuración guardada en este dispositivo.')) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
      state = { ...DEFAULT_STATE, pestLast: todayDi() };
      syncStageFromTimeline();
      ConfigModule.init.call({ init() {} }); // no re-bindear eventos
      $('cfg-crop-name').value = ''; $('cfg-region').value = state.region;
      $('cfg-substrate').value = state.substrate; $('cfg-dose-factor').value = '1';
      $('input-liters').value = state.liters;
      $('input-pest-last-date').value = diToInput(state.pestLast);
      $('select-pest-interval').value = String(state.pestInterval);
      $('select-sprayer-liters').value = String(state.sprayer);
      App.refresh();
      toast('Valores de fábrica restablecidos');
    });
  },

  render() {
    $('cfg-regional-tip').innerHTML = REGIONS[state.region].tip;
  },

  summaryText() {
    const { brand, rows, params } = CalculatorModule.compute();
    const today = todayDi();
    const moon = LunarEngine.info(today);
    const lines = [
      `🌿 *CannaSur AR · Rutina de cultivo*${state.cropName ? ' — ' + state.cropName : ''}`,
      `${state.mode === 'outdoor' ? '☀️ Outdoor' : '🏠 Indoor (sem ' + state.indoorWeek + ')'} · ${REGIONS[state.region].label} · ${STAGES[state.stage].emoji} ${STAGES[state.stage].label}`,
      '',
      `🧪 *${brand.name}* para ${fmtNum(state.liters)} L (pH ${params.ph} · EC ${params.ec}):`,
      ...rows.map((r) => `• ${r.name}: ${fmtNum(r.total)} ${r.unit}`),
      '',
      `🌙 Hoy: ${moon.name} (${Math.round(moon.illum * 100)}%) → ${LUNAR_CATS[moon.category].task}`,
      '',
      `🛡️ Próximas aplicaciones (${fmtNum(state.sprayer)} L):`,
      ...PestModule.schedule(3).map((s) => `• ${fmtDate(s.di)}: ${s.t.short} — ${s.dose}`)
    ];
    return lines.join('\n');
  },

  async copySummary() {
    const text = this.summaryText();
    try {
      await navigator.clipboard.writeText(text);
      toast('📋 Resumen copiado al portapapeles');
    } catch (e) {
      prompt('Copiá el resumen:', text);
    }
  }
};

/* ==========================================================================
   10. MÓDULO EXPORTACIÓN (Canvas HD → PNG / PDF con jsPDF)
   ========================================================================== */
const ExportModule = {
  W: 1080,

  init() {
    document.querySelectorAll('[data-trigger-export], #btn-open-export').forEach((b) => b.addEventListener('click', () => this.open()));
    $('btn-close-export').addEventListener('click', () => this.close());
    $('export-modal').addEventListener('click', (e) => { if (e.target.id === 'export-modal') this.close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    $('btn-download-png').addEventListener('click', () => this.downloadPNG());
    $('btn-download-pdf').addEventListener('click', () => this.downloadPDF());
  },

  async open() {
    const m = $('export-modal');
    m.classList.remove('hidden'); m.classList.add('flex');
    try { await document.fonts.ready; } catch (e) { /* noop */ }
    this.renderCanvas();
  },
  close() {
    const m = $('export-modal');
    m.classList.add('hidden'); m.classList.remove('flex');
  },

  fileBase() { return 'rutina-cannasur-' + diToInput(todayDi()); },

  renderCanvas() {
    const canvas = $('routine-export-canvas');
    canvas.width = this.W; canvas.height = 4000;
    const h = this.draw(canvas.getContext('2d'));
    canvas.height = Math.ceil(h);
    this.draw(canvas.getContext('2d'));
    return canvas;
  },

  /** Dibuja la ficha completa. Devuelve la altura utilizada. */
  draw(ctx) {
    const W = this.W, P = 56, IW = W - P * 2;
    const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
    const MONO = '"JetBrains Mono", ui-monospace, monospace';
    const font = (size, weight = 600, mono = false) => `${weight} ${size}px ${mono ? MONO : SANS}`;
    const text = (s, x, y, size, color, weight = 600, align = 'left', mono = false) => {
      ctx.font = font(size, weight, mono); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
      ctx.fillText(s, x, y);
    };
    const wrapLines = (s, maxW, size, weight = 500) => {
      ctx.font = font(size, weight);
      const words = String(s).split(' '); const lines = []; let line = '';
      words.forEach((w) => {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
      });
      if (line) lines.push(line);
      return lines;
    };
    const rr = (x, y, w, h, r, fill, stroke) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
    };

    const { brand, rows, params } = CalculatorModule.compute();
    const today = todayDi();
    const moon = LunarEngine.info(today);
    const stage = STAGES[state.stage];

    // Fondo
    ctx.fillStyle = '#060b08'; ctx.fillRect(0, 0, W, ctx.canvas.height);
    const glow = ctx.createRadialGradient(150, 0, 0, 150, 0, 700);
    glow.addColorStop(0, 'rgba(16,185,129,0.22)'); glow.addColorStop(1, 'rgba(16,185,129,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 800);

    // Encabezado
    let y = 92;
    text('CANNASUR AR · HEMISFERIO SUR', P, y, 22, '#34d399', 800);
    y += 58; text('Rutina de Cultivo', P, y, 54, '#ffffff', 800);
    y += 44; text(state.cropName || 'Mi cultivo', P, y, 30, '#a7f3d0', 600);
    y += 42;
    const meta = `${state.mode === 'outdoor' ? '☀️ Outdoor' : '🏠 Indoor · Semana ' + state.indoorWeek + '/' + indoorTotalWeeks()}  ·  ${REGIONS[state.region].label}  ·  ${state.substrate === 'coco' ? 'Coco/Hidro' : 'Sustrato'}  ·  ${fmtDateFull(today)}`;
    text(meta, P, y, 22, 'rgba(209,250,229,0.7)', 500);
    y += 34;

    // Etapa
    rr(P, y, IW, 96, 22, 'rgba(16,185,129,0.14)', 'rgba(52,211,153,0.45)');
    text(`${stage.emoji}  Etapa: ${stage.label}`, P + 28, y + 44, 32, '#ffffff', 800);
    text(`Luz ${stage.light}  ·  ${stage.desc}`, P + 28, y + 78, 20, 'rgba(209,250,229,0.75)', 500);
    y += 124;

    // Receta
    const mixLines = wrapLines('Orden: ' + brand.mixOrder, IW - 56, 19);
    const recipeH = 150 + Math.max(rows.length, 1) * 62 + 24 + mixLines.length * 28 + (isFlushWeek() ? 40 : 0);
    rr(P, y, IW, recipeH, 26, '#0d1611', 'rgba(52,211,153,0.25)');
    let ry = y + 52;
    text(`🧪 Receta ${brand.name}`, P + 28, ry, 32, '#ffffff', 800);
    text(`pH ${params.ph}`, W - P - 28, ry - 6, 22, '#6ee7b7', 700, 'right', true);
    ry += 34;
    text(`${fmtNum(state.liters)} litros · Dosis ${Math.round(state.doseFactor * 100)}% · ${brand.type}`, P + 28, ry, 21, 'rgba(209,250,229,0.65)', 500);
    text(`EC ${params.ec}`, W - P - 28, ry - 4, 22, '#bef264', 700, 'right', true);
    ry += 30;
    ctx.fillStyle = 'rgba(52,211,153,0.2)'; ctx.fillRect(P + 28, ry, IW - 56, 2);
    ry += 4;
    if (!rows.length) { ry += 46; text('Sin productos para esta etapa.', P + 28, ry, 22, '#a7f3d0', 500); ry += 16; }
    rows.forEach((r, i) => {
      if (i % 2 === 0) rr(P + 16, ry + 6, IW - 32, 56, 12, 'rgba(16,185,129,0.06)');
      text(r.name, P + 34, ry + 34, 23, '#ffffff', 700);
      text(r.role, P + 34, ry + 55, 16, 'rgba(167,243,208,0.55)', 500);
      text(`${fmtNum(r.dosePerL)} ${r.unit}/L`, P + IW * 0.62, ry + 42, 20, 'rgba(209,250,229,0.7)', 600, 'right', true);
      text(`${fmtNum(r.total)} ${r.unit}`, W - P - 32, ry + 44, 32, '#34d399', 800, 'right', true);
      ry += 62;
    });
    ry += 16;
    if (isFlushWeek()) { text('🚿 Semana de lavado: regar solo con agua.', P + 28, ry + 10, 20, '#7dd3fc', 700); ry += 40; }
    mixLines.forEach((l) => { ry += 28; text(l, P + 28, ry - 6, 19, 'rgba(209,250,229,0.7)', 500); });
    y += recipeH + 28;

    // Lunar
    const wins = ['germinacion', 'podas', 'cosecha'].map((k) => ({ k, c: LUNAR_CATS[k], w: LunarEngine.nextWindow(k, today) }));
    const lunarH = 170 + wins.length * 72;
    rr(P, y, IW, lunarH, 26, '#0d1611', 'rgba(52,211,153,0.25)');
    // Luna dibujada (Hemisferio Sur)
    const img = new Image();
    const mcx = P + 80, mcy = y + 85, mr = 46;
    ctx.beginPath(); ctx.arc(mcx, mcy, mr, 0, Math.PI * 2); ctx.fillStyle = '#1e293b'; ctx.fill();
    this.drawMoon(ctx, mcx, mcy, mr, moon.frac);
    text('🌙 Calendario Lunar', P + 150, y + 62, 30, '#ffffff', 800);
    text(`Hoy: ${moon.name} · ${Math.round(moon.illum * 100)}% → ${LUNAR_CATS[moon.category].task}`, P + 150, y + 98, 21, '#a7f3d0', 600);
    text('Vista Hemisferio Sur · Hora Oficial Argentina', P + 150, y + 128, 17, 'rgba(167,243,208,0.5)', 500);
    let ly = y + 160;
    wins.forEach(({ c, w }) => {
      rr(P + 20, ly, IW - 40, 60, 14, 'rgba(255,255,255,0.03)');
      ctx.fillStyle = c.hex; ctx.fillRect(P + 20, ly + 10, 5, 40);
      text(`${c.icon}  ${c.task}`, P + 44, ly + 38, 22, '#ffffff', 700);
      const label = w ? `${w.active ? 'ACTIVA · ' : ''}${fmtDate(w.start)} → ${fmtDate(w.end)}` : '—';
      text(label, W - P - 40, ly + 38, 19, c.hex, 700, 'right', true);
      ly += 72;
    });
    y += lunarH + 28;

    // Plagas
    const sched = PestModule.schedule(4);
    const pestH = 120 + sched.length * 70;
    rr(P, y, IW, pestH, 26, '#0d1611', 'rgba(52,211,153,0.25)');
    text(`🛡️ Plan Preventivo · cada ${state.pestInterval} días`, P + 28, y + 54, 30, '#ffffff', 800);
    text(`Dosis para pulverizador de ${fmtNum(state.sprayer)} L · aplicar al atardecer, mojando el envés`, P + 28, y + 88, 19, 'rgba(209,250,229,0.6)', 500);
    let py = y + 112;
    sched.forEach((s) => {
      rr(P + 20, py, IW - 40, 60, 14, 'rgba(255,255,255,0.03)');
      text(fmtDate(s.di), P + 40, py + 38, 21, '#ffffff', 700, 'left', true);
      text(`${s.t.icon} ${s.t.short}`, P + 260, py + 38, 22, '#6ee7b7', 700);
      text(s.dose, W - P - 40, py + 38, 18, 'rgba(209,250,229,0.75)', 600, 'right', true);
      py += 70;
    });
    y += pestH + 34;

    // Pie
    text('Dosis orientativas según tablas de fabricantes. Verificá siempre la etiqueta y medí pH/EC.', W / 2, y, 17, 'rgba(167,243,208,0.45)', 500, 'center');
    y += 28;
    text('Generado con CannaSur AR · Cultivo responsable (Ley 27.350 · REPROCANN)', W / 2, y, 17, 'rgba(167,243,208,0.45)', 500, 'center');
    return y + 50;
  },

  /** Luna para canvas (iluminada a la izquierda cuando crece — Hemisferio Sur). */
  drawMoon(ctx, cx, cy, r, frac) {
    const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2;
    if (illum < 0.015) return;
    const litLeft = frac < 0.5;
    const rx = Math.abs(Math.cos(2 * Math.PI * frac)) * r;
    ctx.save();
    ctx.beginPath();
    // Limbo iluminado: semicircunferencia del lado iluminado
    if (litLeft) ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, true);
    else ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
    // Terminador (elipse) de abajo hacia arriba
    const crescent = illum < 0.5;
    const bulgeLeft = litLeft ? crescent : !crescent;
    ctx.ellipse(cx, cy, Math.max(rx, 0.01), r, 0, Math.PI / 2, -Math.PI / 2, !bulgeLeft ? true : false);
    ctx.closePath();
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 2, cx, cy, r * 1.3);
    g.addColorStop(0, '#f8fafc'); g.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  },

  downloadPNG() {
    const canvas = this.renderCanvas();
    canvas.toBlob((blob) => {
      if (!blob) return toast('No se pudo generar la imagen');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = this.fileBase() + '.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('🖼️ Imagen descargada');
    }, 'image/png');
  },

  downloadPDF() {
    const canvas = this.renderCanvas();
    if (!window.jspdf || !window.jspdf.jsPDF) return this.printFallback(canvas);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = 210, pageH = 297;
    const pxPerPage = Math.floor(canvas.width * (pageH / pageW));
    let offset = 0, page = 0;
    while (offset < canvas.height) {
      const sliceH = Math.min(pxPerPage, canvas.height - offset);
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width; tmp.height = sliceH;
      const tctx = tmp.getContext('2d');
      tctx.fillStyle = '#060b08'; tctx.fillRect(0, 0, tmp.width, tmp.height);
      tctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (page > 0) pdf.addPage();
      // Fondo oscuro de página completa para continuidad visual
      pdf.setFillColor(6, 11, 8); pdf.rect(0, 0, pageW, pageH, 'F');
      pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, sliceH * (pageW / canvas.width));
      offset += sliceH; page++;
    }
    pdf.setProperties({ title: 'Rutina CannaSur AR', subject: 'Plan de cultivo', creator: 'CannaSur AR' });
    pdf.save(this.fileBase() + '.pdf');
    toast('📄 PDF descargado');
  },

  /** Respaldo sin conexión: imprime la ficha (el usuario elige "Guardar como PDF"). */
  printFallback(canvas) {
    $('print-fallback-sheet').innerHTML = `<img src="${canvas.toDataURL('image/png')}" style="width:100%;max-width:720px;margin:0 auto;display:block" alt="Rutina de cultivo" />`;
    toast('Elegí "Guardar como PDF" en el diálogo de impresión');
    setTimeout(() => window.print(), 300);
  }
};

/* ==========================================================================
   11. NAVEGACIÓN + INIT
   ========================================================================== */
const NAV_SUBTITLES = {
  calculadora: 'Calculadora & Planificación',
  lunar: 'Calendario Lunar 2026 / 2027',
  plagas: 'Prevención Biológica de Plagas',
  config: 'Configuración del Cultivo'
};

const App = {
  currentView: 'calculadora',

  init() {
    loadState();
    if (state.pestLast == null) state.pestLast = todayDi();
    syncStageFromTimeline();

    document.querySelectorAll('[data-nav-target]').forEach((b) =>
      b.addEventListener('click', () => this.navigate(b.dataset.navTarget)));
    window.addEventListener('hashchange', () => this.navigate(location.hash.slice(1) || 'calculadora', false));

    ModeModule.init();
    CalculatorModule.init();
    LunarModule.init();
    PestModule.init();
    ConfigModule.init();
    ExportModule.init();

    this.refresh();
    const initial = location.hash.slice(1);
    if (NAV_SUBTITLES[initial]) this.navigate(initial, false);
  },

  navigate(view, pushHash = true) {
    if (!NAV_SUBTITLES[view]) return;
    this.currentView = view;
    document.querySelectorAll('.view-section').forEach((s) => s.classList.toggle('active', s.id === 'view-' + view));
    document.querySelectorAll('[data-nav-target]').forEach((b) => b.classList.toggle('active', b.dataset.navTarget === view));
    if (pushHash && location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    this.renderHeader();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderHeader() {
    const name = state.cropName ? state.cropName + ' · ' : '';
    $('header-subtitle').textContent = name + NAV_SUBTITLES[this.currentView] + ' · ' + STAGES[state.stage].label;
  },

  /** Re-renderiza todos los módulos y persiste el estado. */
  refresh() {
    saveState();
    ModeModule.render();
    CalculatorModule.render();
    LunarModule.render();
    PestModule.render();
    ConfigModule.render();
    this.renderHeader();
  }
};

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => App.init());
}
if (typeof module !== 'undefined') {
  module.exports = { LunarEngine, PHASE_NAMES, arTime, partsFromDi };
}
