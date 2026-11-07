/* ==========================================================================
   CannaSur — Bitácora de Cultivo & Asistente Agronómico
   Estética: Fondo verde amarillento claro blancuzco, letra negra botánica,
   tarjetas blancas orgánicas, máxima legibilidad y tipografía refinada.
   Guía agronómica de salud, indicadores visuales de deficiencias,
   recordatorios de ciclo, calculadora de riego y botón de reinicio demo.
   ========================================================================== */
'use strict';

/* ==========================================================================
   1. CONSTANTES & CONFIGURACIONES GLOBALES
   ========================================================================== */
const DAY_MS = 86400000;
const DB_NAME = 'CannaSurDB';
const DB_VERSION = 1;

const STAGES = {
  plantula: { label: 'Plántula', emoji: '🌱', badgeClass: 'badge-mono', desc: 'Enraizamiento y primeras hojas verdaderas' },
  vegetativo: { label: 'Vegetativo', emoji: '🌿', badgeClass: 'badge-mono', desc: 'Crecimiento de ramas y follaje' },
  transicion: { label: 'Transición', emoji: '⚡', badgeClass: 'badge-mono', desc: 'Pre-floración y estiramiento (stretch)' },
  floracion: { label: 'Floración', emoji: '🌸', badgeClass: 'stage-badge-floracion', desc: 'Formación y engorde de cogollos' },
  cosecha: { label: 'Cosecha', emoji: '💎', badgeClass: 'badge-mono', desc: 'Maduración de tricomas y secado' }
};

/* Estados de Salud de la Planta (Inspirados en manuales agronómicos) */
const HEALTH_STATES = {
  optima: { label: 'Óptima y Vigorosa', emoji: '🟢', badgeClass: 'health-badge-optima', desc: 'Follaje verde parejo, turgente y sin manchas' },
  carencia_n: { label: 'Carencia de Nitrógeno (N)', emoji: '🟡', badgeClass: 'health-badge-carencia', desc: 'Hojas viejas amarilleando de abajo hacia arriba' },
  carencia_p: { label: 'Carencia de Fósforo (P)', emoji: '🟡', badgeClass: 'health-badge-carencia', desc: 'Hojas verde oscuras con manchas bronce y tallos rojos' },
  carencia_k: { label: 'Carencia de Potasio (K)', emoji: '🟡', badgeClass: 'health-badge-carencia', desc: 'Bordes aserrados secos y quemados hacia arriba' },
  carencia_mg: { label: 'Carencia de Magnesio (Mg)', emoji: '🟡', badgeClass: 'health-badge-carencia', desc: 'Clorosis internodal en hojas medias (venas verdes)' },
  carencia_ca: { label: 'Carencia de Calcio (Ca)', emoji: '🟡', badgeClass: 'health-badge-carencia', desc: 'Puntos necróticos de óxido en brotes y hojas nuevas' },
  exceso_garra: { label: 'Hoja en Garra (Exceso N)', emoji: '🔴', badgeClass: 'health-badge-exceso', desc: 'Puntas curvadas hacia abajo en gancho / garra de águila' },
  sobre_riego: { label: 'Exceso de Riego', emoji: '💧', badgeClass: 'health-badge-riego', desc: 'Hojas caídas pero pesadas, hinchadas y abultadas' },
  falta_riego: { label: 'Sedienta (Sub-riego)', emoji: '🥀', badgeClass: 'health-badge-sed', desc: 'Hojas y tallos marchitos, flácidos y sin turgencia' },
  estres_calor: { label: 'Estrés Calor / Luz', emoji: '☀️', badgeClass: 'health-badge-estres', desc: 'Hojas plegadas en forma de taco o canoa hacia arriba' },
  plaga: { label: 'Alerta de Plagas', emoji: '🦟', badgeClass: 'health-badge-plaga', desc: 'Picaduras plateadas de trips, arañuela o mosca' },
  recuperacion: { label: 'En Recuperación', emoji: '🌱', badgeClass: 'health-badge-recuperacion', desc: 'Superando trasplante o estrés controlado' }
};

const LOG_TYPES = {
  riego_agua: { label: 'Riego con Agua', icon: '💧', badge: 'badge-mono' },
  riego_nutrientes: { label: 'Riego con Nutrientes', icon: '🧪', badge: 'badge-mono' },
  foliar: { label: 'Aplicación Foliar', icon: '🌿', badge: 'badge-mono' },
  poda: { label: 'Poda / Entrenamiento', icon: '✂️', badge: 'badge-mono' },
  transplante: { label: 'Transplante', icon: '🪴', badge: 'badge-mono' },
  cambio_etapa: { label: 'Cambio de Etapa', icon: '🌸', badge: 'stage-badge-floracion' },
  nota_foto: { label: 'Nota / Foto', icon: '📷', badge: 'badge-mono' }
};

/* ==========================================================================
   ILUSTRACIONES VECTORIALES AGRONÓMICAS DE ALTA PRECISIÓN (SVG)
   ========================================================================== */
const SVG_LEAVES = {
  // Hoja Sana Óptima: Verde vibrante, nervaduras limpias, turgencia perfecta
  optima: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leafOptima" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#4ade80"/>
          <stop offset="100%" stop-color="#15803d"/>
        </linearGradient>
      </defs>
      <path d="M 100 15 C 108 40, 114 70, 100 100 C 86 70, 92 40, 100 15 Z" fill="url(#leafOptima)" stroke="#16a34a" stroke-width="1.2"/>
      <path d="M 100 100 C 120 75, 148 55, 160 40 C 146 68, 126 86, 100 100 Z" fill="url(#leafOptima)" opacity="0.95"/>
      <path d="M 100 100 C 80 75, 52 55, 40 40 C 54 68, 74 86, 100 100 Z" fill="url(#leafOptima)" opacity="0.95"/>
      <path d="M 100 100 C 125 90, 160 85, 175 75 C 155 95, 128 102, 100 100 Z" fill="url(#leafOptima)" opacity="0.9"/>
      <path d="M 100 100 C 75 90, 40 85, 25 75 C 45 95, 72 102, 100 100 Z" fill="url(#leafOptima)" opacity="0.9"/>
      <line x1="100" y1="100" x2="100" y2="125" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
      <line x1="100" y1="20" x2="100" y2="100" stroke="#86efac" stroke-width="1" opacity="0.7"/>
    </svg>
  `,

  // Carencia de Nitrógeno: Hojas inferiores amarillas, nervaduras desvanecidas
  carencia_n: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leafNitrogen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="60%" stop-color="#facc15"/>
          <stop offset="100%" stop-color="#ca8a04"/>
        </linearGradient>
      </defs>
      <path d="M 100 15 C 108 40, 114 70, 100 100 C 86 70, 92 40, 100 15 Z" fill="url(#leafNitrogen)"/>
      <path d="M 100 100 C 120 75, 148 55, 160 40 C 146 68, 126 86, 100 100 Z" fill="url(#leafNitrogen)"/>
      <path d="M 100 100 C 80 75, 52 55, 40 40 C 54 68, 74 86, 100 100 Z" fill="url(#leafNitrogen)"/>
      <path d="M 100 100 C 125 90, 160 85, 175 75 C 155 95, 128 102, 100 100 Z" fill="url(#leafNitrogen)"/>
      <path d="M 100 100 C 75 90, 40 85, 25 75 C 45 95, 72 102, 100 100 Z" fill="url(#leafNitrogen)"/>
      <polygon points="100,15 103,24 97,24" fill="#a16207"/>
      <polygon points="160,40 152,44 156,49" fill="#a16207"/>
      <polygon points="40,40 48,44 44,49" fill="#a16207"/>
      <line x1="100" y1="100" x2="100" y2="125" stroke="#eab308" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `,

  // Toxicidad de Nitrógeno / Hoja en Garra: Verde petróleo oscuro, curvada hacia abajo en anzuelo
  exceso_garra: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leafClaw" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#064e3b"/>
          <stop offset="100%" stop-color="#022c22"/>
        </linearGradient>
      </defs>
      <path d="M 100 18 C 114 42, 118 72, 100 100 C 82 72, 86 42, 100 18 Z" fill="url(#leafClaw)" stroke="#14532d" stroke-width="1.2"/>
      <path d="M 100 18 Q 106 10 98 6 Q 92 10 97 18 Z" fill="#022c22"/>
      <path d="M 100 100 C 122 75, 146 62, 155 52 C 158 56, 146 75, 100 100 Z" fill="url(#leafClaw)"/>
      <path d="M 100 100 C 78 75, 54 62, 45 52 C 42 56, 54 75, 100 100 Z" fill="url(#leafClaw)"/>
      <path d="M 155 52 Q 163 56 160 63 Q 152 61 155 52 Z" fill="#022c22"/>
      <path d="M 45 52 Q 37 56 40 63 Q 48 61 45 52 Z" fill="#022c22"/>
      <line x1="100" y1="100" x2="100" y2="125" stroke="#064e3b" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `,

  // Carencia de Fósforo: Hojas verde azuladas con manchas cobrizas y tallo púrpura
  carencia_p: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leafPhos" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#14342b"/>
          <stop offset="100%" stop-color="#092019"/>
        </linearGradient>
      </defs>
      <path d="M 100 15 C 108 40, 114 70, 100 100 C 86 70, 92 40, 100 15 Z" fill="url(#leafPhos)"/>
      <path d="M 100 100 C 120 75, 148 55, 160 40 C 146 68, 126 86, 100 100 Z" fill="url(#leafPhos)"/>
      <path d="M 100 100 C 80 75, 52 55, 40 40 C 54 68, 74 86, 100 100 Z" fill="url(#leafPhos)"/>
      <circle cx="102" cy="45" r="5" fill="#a16207" opacity="0.9"/>
      <circle cx="95" cy="65" r="6" fill="#7e22ce" opacity="0.85"/>
      <circle cx="135" cy="62" r="5" fill="#b45309" opacity="0.9"/>
      <circle cx="65" cy="62" r="5" fill="#7e22ce" opacity="0.85"/>
      <line x1="100" y1="100" x2="100" y2="125" stroke="#9333ea" stroke-width="3.5" stroke-linecap="round"/>
    </svg>
  `,

  // Carencia de Potasio: Bordes serrados quemados y doblados hacia arriba
  carencia_k: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <path d="M 100 15 C 108 40, 114 70, 100 100 C 86 70, 92 40, 100 15 Z" fill="#15803d"/>
      <path d="M 100 100 C 120 75, 148 55, 160 40 C 146 68, 126 86, 100 100 Z" fill="#15803d"/>
      <path d="M 100 100 C 80 75, 52 55, 40 40 C 54 68, 74 86, 100 100 Z" fill="#15803d"/>
      <path d="M 100 15 C 108 35, 112 55, 107 75" fill="none" stroke="#ea580c" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M 100 15 C 92 35, 88 55, 93 75" fill="none" stroke="#ea580c" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M 160 40 C 144 58, 130 72, 118 84" fill="none" stroke="#ea580c" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M 40 40 C 56 58, 70 72, 82 84" fill="none" stroke="#ea580c" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="100" y1="100" x2="100" y2="125" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `,

  // Carencia de Magnesio: Clorosis internodal (venas verdes, tejido entremedio amarillo)
  carencia_mg: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <path d="M 100 15 C 108 40, 114 70, 100 100 C 86 70, 92 40, 100 15 Z" fill="#fde047"/>
      <path d="M 100 100 C 120 75, 148 55, 160 40 C 146 68, 126 86, 100 100 Z" fill="#fde047"/>
      <path d="M 100 100 C 80 75, 52 55, 40 40 C 54 68, 74 86, 100 100 Z" fill="#fde047"/>
      <line x1="100" y1="20" x2="100" y2="100" stroke="#15803d" stroke-width="2.8"/>
      <line x1="100" y1="40" x2="108" y2="35" stroke="#15803d" stroke-width="1.6"/>
      <line x1="100" y1="40" x2="92" y2="35" stroke="#15803d" stroke-width="1.6"/>
      <line x1="100" y1="60" x2="110" y2="52" stroke="#15803d" stroke-width="1.6"/>
      <line x1="100" y1="60" x2="90" y2="52" stroke="#15803d" stroke-width="1.6"/>
      <line x1="100" y1="100" x2="148" y2="50" stroke="#15803d" stroke-width="2.2"/>
      <line x1="100" y1="100" x2="52" y2="50" stroke="#15803d" stroke-width="2.2"/>
      <line x1="100" y1="100" x2="100" y2="125" stroke="#15803d" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `,

  // Carencia de Calcio: Brotes nuevos con motas de óxido y deformaciones
  carencia_ca: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <path d="M 100 18 C 109 40, 115 70, 100 100 C 85 70, 91 40, 100 18 Z" fill="#86efac"/>
      <path d="M 100 100 C 120 75, 148 55, 158 42 C 144 68, 126 86, 100 100 Z" fill="#86efac"/>
      <path d="M 100 100 C 80 75, 52 55, 42 42 C 56 68, 74 86, 100 100 Z" fill="#86efac"/>
      <circle cx="102" cy="38" r="2.5" fill="#b45309"/>
      <circle cx="96" cy="46" r="3" fill="#9a3412"/>
      <circle cx="105" cy="58" r="3.5" fill="#b45309"/>
      <circle cx="130" cy="56" r="3" fill="#9a3412"/>
      <circle cx="70" cy="56" r="3" fill="#b45309"/>
      <line x1="100" y1="100" x2="100" y2="125" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `,

  // Exceso de Riego: Hojas hinchadas, pesadas y convexas curvadas hacia abajo
  sobre_riego: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leafWaterlog" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#22c55e"/>
          <stop offset="100%" stop-color="#14532d"/>
        </linearGradient>
      </defs>
      <path d="M 100 35 C 112 55, 116 85, 100 105 C 84 85, 88 55, 100 35 Z" fill="url(#leafWaterlog)"/>
      <path d="M 100 105 C 124 95, 155 92, 165 80 C 148 105, 126 110, 100 105 Z" fill="url(#leafWaterlog)"/>
      <path d="M 100 105 C 76 95, 45 92, 35 80 C 52 105, 74 110, 100 105 Z" fill="url(#leafWaterlog)"/>
      <circle cx="100" cy="30" r="3" fill="#0284c7" opacity="0.8"/>
      <circle cx="168" cy="78" r="2.5" fill="#0284c7" opacity="0.8"/>
      <circle cx="32" cy="78" r="2.5" fill="#0284c7" opacity="0.8"/>
      <line x1="100" y1="105" x2="100" y2="125" stroke="#15803d" stroke-width="3.5" stroke-linecap="round"/>
    </svg>
  `,

  // Falta de Riego / Sedienta: Hoja marchita, papelosa, flácida y desmayada
  falta_riego: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <g opacity="0.75" transform="rotate(8, 100, 100)">
        <path d="M 100 45 C 105 65, 108 90, 100 110 C 92 90, 95 65, 100 45 Z" fill="#84cc16"/>
        <path d="M 100 110 C 115 100, 138 98, 148 90 C 132 110, 118 114, 100 110 Z" fill="#84cc16"/>
        <path d="M 100 110 C 85 100, 62 98, 52 90 C 68 110, 82 114, 100 110 Z" fill="#84cc16"/>
        <line x1="100" y1="55" x2="100" y2="110" stroke="#4d7c0f" stroke-width="1.2" stroke-dasharray="2,2"/>
        <line x1="100" y1="110" x2="100" y2="128" stroke="#65a30d" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    </svg>
  `,

  // Estrés por Calor / Exceso de Luz: Hojas plegadas hacia arriba en forma de taco
  estres_calor: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <path d="M 100 15 C 105 40, 107 70, 100 100 C 93 70, 95 40, 100 15 Z" fill="#15803d"/>
      <path d="M 100 15 C 103 40, 104 70, 100 100 Z" fill="#4ade80" opacity="0.5"/>
      <path d="M 100 100 C 115 75, 138 58, 150 45 C 140 68, 122 84, 100 100 Z" fill="#15803d"/>
      <path d="M 100 100 C 85 75, 62 58, 50 45 C 60 68, 78 84, 100 100 Z" fill="#15803d"/>
      <line x1="100" y1="100" x2="100" y2="125" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
      <circle cx="100" cy="10" r="4" fill="#facc15" opacity="0.8"/>
    </svg>
  `,

  // Plagas (Trips / Arañuela): Manchas plateadas y excrementos puntiformes
  plagas: `
    <svg viewBox="0 0 200 130" class="w-full h-32 object-contain" xmlns="http://www.w3.org/2000/svg">
      <path d="M 100 15 C 108 40, 114 70, 100 100 C 86 70, 92 40, 100 15 Z" fill="#22c55e"/>
      <path d="M 100 100 C 120 75, 148 55, 160 40 C 146 68, 126 86, 100 100 Z" fill="#22c55e"/>
      <path d="M 100 100 C 80 75, 52 55, 40 40 C 54 68, 74 86, 100 100 Z" fill="#22c55e"/>
      <ellipse cx="102" cy="45" rx="5" ry="2" fill="#cbd5e1" opacity="0.9" transform="rotate(-15, 102, 45)"/>
      <ellipse cx="96" cy="62" rx="6" ry="2.5" fill="#cbd5e1" opacity="0.9" transform="rotate(20, 96, 62)"/>
      <ellipse cx="132" cy="60" rx="5" ry="2" fill="#cbd5e1" opacity="0.9"/>
      <ellipse cx="68" cy="60" rx="5" ry="2" fill="#cbd5e1" opacity="0.9"/>
      <circle cx="105" cy="43" r="1.3" fill="#1e293b"/>
      <circle cx="98" cy="65" r="1.3" fill="#1e293b"/>
      <circle cx="135" cy="58" r="1.3" fill="#1e293b"/>
      <circle cx="65" cy="58" r="1.3" fill="#1e293b"/>
      <line x1="100" y1="100" x2="100" y2="125" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `
};

/* ==========================================================================
   GUÍA VISUAL DE DIAGNÓSTICO AGRONÓMICO (Sin marcas comerciales)
   ========================================================================== */
const DIAGNOSTIC_GUIDE = [
  {
    id: 'carencia_n',
    category: 'carencias',
    title: 'Carencia de Nitrógeno (N)',
    severity: '🟡 Moderada',
    badgeClass: 'health-badge-carencia',
    location: 'Hojas viejas e inferiores (Nutriente móvil)',
    svg: SVG_LEAVES.carencia_n,
    symptoms: 'Amarilleo parejo y gradual que comienza en las hojas más viejas de la parte baja. La planta transloca el nitrógeno hacia los brotes nuevos superiores. Si no se trata, las hojas se vuelven completamente amarillas, se secan y caen.',
    causes: 'Sustrato pobre en materia orgánica, dosis nutricional insuficiente para la velocidad de crecimiento vegetativo, o pH de riego fuera de rango (pH < 6.0 o pH > 7.0) que bloquea la absorción.',
    solution: '1. Regular el pH del agua de riego a 6.2 – 6.5.\n2. Aplicar un riego con nutrientes ricos en nitrógeno orgánico (humus de lombriz líquido, harina de sangre o enmienda nitrogenada equilibrada).\n3. En casos avanzados, pulverización foliar suave en vegetativo para asimilación rápida por estomas.'
  },
  {
    id: 'exceso_garra',
    category: 'excesos',
    title: 'Toxicidad de Nitrógeno / Hoja en Garra',
    severity: '🔴 Crítica',
    badgeClass: 'health-badge-exceso',
    location: 'Hojas medias y superiores',
    svg: SVG_LEAVES.exceso_garra,
    symptoms: 'Follaje verde petróleo extremadamente oscuro con textura cerosa. Las puntas de las hojas se curvan violentamente hacia abajo formando un gancho o "garra de águila". Ramas rígidas y retraso en el inicio de la floración.',
    causes: 'Sobredosificación de fertilizantes ricos en nitrógeno o acumulación excesiva de sales en el sustrato por falta de drenaje adecuado en los riegos.',
    solution: '1. Suspender inmediatamente todo aporte de nutrientes con nitrógeno.\n2. Realizar un lavado de raíces (flush) con agua desclorada y pH calibrado a 6.3, utilizando 2 a 3 veces el volumen de la maceta.\n3. Reanudar la fertilización 5 a 7 días después a un 40% de la dosis habitual.'
  },
  {
    id: 'carencia_p',
    category: 'carencias',
    title: 'Carencia de Fósforo (P)',
    severity: '🟡 Moderada',
    badgeClass: 'health-badge-carencia',
    location: 'Hojas adultas y pecíolos',
    svg: SVG_LEAVES.carencia_p,
    symptoms: 'Hojas de un tono verde azulado oscuro opaco. Aparición de manchas necróticas circulares de color bronce, cobre o púrpura. Pecíolos y tallos se tornan de color rojo vino o violáceo. Crecimiento lento y cogollos pequeños.',
    causes: 'Temperaturas de sustrato inferiores a 15°C (el frío congela la absorción de P), pH descalibrado en floración (debe estar entre 6.3 y 6.8), o demanda no cubierta en pre-floración y engorde.',
    solution: '1. Asegurar temperatura radicular adecuada (> 18°C).\n2. Corregir pH a 6.5 en suelo.\n3. Aplicar enmiendas fosforadas (harina de huesos, guano de murciélago para flora o base mineral rica en PK).'
  },
  {
    id: 'carencia_k',
    category: 'carencias',
    title: 'Carencia de Potasio (K)',
    severity: '🟡 Moderada',
    badgeClass: 'health-badge-carencia',
    location: 'Bordes aserrados de hojas medias',
    svg: SVG_LEAVES.carencia_k,
    symptoms: 'Los bordes aserrados y las puntas de las hojas se vuelven amarillos y luego se secan como si estuviesen quemados por fuego. Los bordes se curvan hacia arriba. Disminuye la resistencia a la sequía y la densidad de resina.',
    causes: 'Exceso de sodio, calcio o magnesio en el agua que compite con el potasio; pH de sustrato demasiado ácido (< 6.0); o consumo masivo durante las semanas 4 a 8 de floración.',
    solution: '1. Calibrar pH entre 6.4 y 6.8.\n2. Incorporar melaza de caña sin azufre, té de ceniza vegetal limpia o fertilizante PK orgánico/mineral equilibrado.\n3. Lavar raíces suavemente si hay sospecha de bloqueo por sales.'
  },
  {
    id: 'carencia_mg',
    category: 'carencias',
    title: 'Carencia de Magnesio (Mg)',
    severity: '🟡 Moderada',
    badgeClass: 'health-badge-carencia',
    location: 'Hojas medias (Nutriente móvil)',
    svg: SVG_LEAVES.carencia_mg,
    symptoms: 'Clorosis internodal típica: las nervaduras principales y secundarias se mantienen de un verde oscuro nítido, mientras que el tejido entre las venas se torna amarillo brillante o dorado. Muy frecuente bajo iluminación LED de alta potencia.',
    causes: 'Uso de agua de ósmosis o agua muy blanda sin mineralización; pH inferior a 6.2; o exceso de potasio o calcio que bloquea el magnesio.',
    solution: '1. Regular pH del sustrato a 6.3 – 6.6.\n2. Pulverizar de forma foliar sales de Epsom (sulfato de magnesio) a razón de 2g/L con agua tibia al apagar luces.\n3. Incorporar en el riego un suplemento de Calcio-Magnesio (Cal-Mag).'
  },
  {
    id: 'carencia_ca',
    category: 'carencias',
    title: 'Carencia de Calcio (Ca)',
    severity: '🟡 Moderada',
    badgeClass: 'health-badge-carencia',
    location: 'Brotes apicales y hojas jóvenes (Nutriente inmóvil)',
    svg: SVG_LEAVES.carencia_ca,
    symptoms: 'Aparición de pequeñas pecas o motas necróticas de color marrón óxido dispersas por las hojas superiores y brotes tiernos. Las hojas nuevas nacen deformes, retorcidas o con puntas atrofiadas.',
    causes: 'Transpiración deficiente por exceso de humedad relativa (> 75%), sustrato ácido con pH < 6.0, o aguas blandas desmineralizadas.',
    solution: '1. Bajar la humedad relativa en el espacio de cultivo para reactivar el flujo de transpiración que transporta el calcio.\n2. Ajustar pH a 6.4 – 6.7.\n3. Aportar harina de dolomita, cal viva apagada en compost o suplemento equilibrado de Cal-Mag.'
  },
  {
    id: 'sobre_riego',
    category: 'riego',
    title: 'Exceso de Riego (Asfixia Radicular)',
    severity: '💧 Alerta de Manejo',
    badgeClass: 'health-badge-riego',
    location: 'Toda la planta',
    svg: SVG_LEAVES.sobre_riego,
    symptoms: 'Toda la planta se arquea hacia abajo, pero a diferencia de la falta de agua, las hojas están turgentes, pesadas, hinchadas y abultadas (llenas de líquido). La maceta pesa mucho y el sustrato permanece empapado días enteros.',
    causes: 'Regar con demasiada frecuencia sin permitir que el sustrato se seque y se oxigene (falta del ciclo seco-húmedo), maceta sin orificios de drenaje limpios o sustrato demasiado arcilloso.',
    solution: '1. Suspender por completo el riego hasta que la maceta se sienta liviana como una pluma al levantarla.\n2. Mejorar la ventilación e intracción de aire en la zona de macetas.\n3. A futuro, aplicar la regla del 10% al 15% del volumen de la maceta y espaciar los riegos cada 2 a 3 días.'
  },
  {
    id: 'falta_riego',
    category: 'riego',
    title: 'Falta de Riego (Deshidratación / Sed)',
    severity: '🥀 Alerta de Manejo',
    badgeClass: 'health-badge-sed',
    location: 'Toda la planta',
    svg: SVG_LEAVES.falta_riego,
    symptoms: 'Hojas y tallos completamente flácidos, caídos y sin fuerza celular. Las hojas tienen textura delgada y papelosa, perdiendo todo brillo. La maceta no tiene peso alguno y la tierra se separa del borde de la maceta.',
    causes: 'Período prolongado sin riego, calor ambiental extremo o tamaño de maceta demasiado pequeño para una planta grande con alta transpiración.',
    solution: '1. Regar de inmediato y de forma lenta y pausada para que el sustrato seco absorba el agua sin que escurra directamente por los costados.\n2. Utilizar un volumen correspondiente al 15% de la maceta.\n3. La planta recuperará su turgencia natural en 2 a 4 horas.'
  },
  {
    id: 'estres_calor',
    category: 'riego',
    title: 'Estrés Térmico / Exceso de Luz (Taco)',
    severity: '☀️ Moderada',
    badgeClass: 'health-badge-estres',
    location: 'Hojas superiores más cercanas a la luz',
    svg: SVG_LEAVES.estres_calor,
    symptoms: 'Los bordes de los foliolos se pliegan longitudinalmente hacia arriba adoptando la forma de una canoa o "taco mexicano". Las puntas de las hojas apuntan hacia arriba para reducir la superficie expuesta a la radiación.',
    causes: 'Lámpara LED o sodio demasiado cerca de la copa de la planta, temperaturas en el dosel superiores a 30°C o mala disipación de calor.',
    solution: '1. Aumentar la distancia entre la fuente de luz y las puntas de la planta (elevar 10 a 20 cm).\n2. Regular la potencia del dimmer si es LED.\n3. Mejorar la extracción de aire y agregar un ventilador oscilante dirigido entre la lámpara y las copas.'
  },
  {
    id: 'plagas',
    category: 'plagas',
    title: 'Plagas Comunes (Trips / Arañuela)',
    severity: '🦟 Alerta de Manejo',
    badgeClass: 'health-badge-plaga',
    location: 'Haz y envés de las hojas',
    svg: SVG_LEAVES.plagas,
    symptoms: 'Trips: Manchas plateadas brillantes con aspecto de raspadura en la cara superior de la hoja con diminutos puntitos negros (heces). Arañuela roja: Micropunteado amarillento denso; en etapas avanzadas genera finas telas de araña.',
    causes: 'Ambiente cálido y seco con escasa ventilación, falta de pulverizaciones preventivas periódicas o introducción de clones/esquejes sin cuarentena previa.',
    solution: '1. Pulverizar de forma exhaustiva con Aceite de Neem (2ml/L) emulsionado con Jabón Potásico (5ml/L) en ambas caras de las hojas al caer el sol.\n2. Repetir cada 3 a 4 días en caso de plaga activa durante 3 aplicaciones.\n3. Si hay orugas o isocas en floración, aplicar Bacillus thuringiensis (1g/L).'
  }
];

/* ==========================================================================
   GUÍA VISUAL DE MADURACIÓN DE TRICOMAS (PUNTO DE COSECHA)
   ========================================================================== */
const TRICHOMES_GUIDE = [
  {
    id: 'transparentes',
    title: '1. Transparentes / Cristalinos',
    status: 'Inmaduro · No Cortar',
    badgeClass: 'badge-mono',
    desc: 'Cabezas glandulares completamente diáfanas como vidrio transparente.',
    effect: 'Efecto débil, taquicárdico o nulo. Los cannabinoides principales (THC) aún no han sintetizado su pico molecular.',
    svg: `
      <svg viewBox="0 0 100 110" class="h-24 w-full object-contain" xmlns="http://www.w3.org/2000/svg">
        <path d="M 50 100 Q 52 60 50 42" stroke="rgba(45,65,35,0.3)" stroke-width="6" stroke-linecap="round" fill="none"/>
        <circle cx="50" cy="36" r="18" fill="rgba(255,255,255,0.7)" stroke="rgba(45,65,35,0.4)" stroke-width="2"/>
        <ellipse cx="44" cy="30" rx="6" ry="3" fill="#ffffff" opacity="0.9"/>
      </svg>
    `
  },
  {
    id: 'lechosos',
    title: '2. Lechosos / Nublados',
    status: 'Pico Máximo de THC',
    badgeClass: 'badge-mono-inverted',
    desc: 'Cabezas glandulares de color blanco tiza opaco y lechoso.',
    effect: 'Pico máximo de concentración de THC. Efecto cerebral, eufórico, lúcido y estimulante. Ideal para sativas y cosechas activas.',
    svg: `
      <svg viewBox="0 0 100 110" class="h-24 w-full object-contain" xmlns="http://www.w3.org/2000/svg">
        <path d="M 50 100 Q 52 60 50 42" stroke="#52644e" stroke-width="6" stroke-linecap="round" fill="none"/>
        <circle cx="50" cy="36" r="18" fill="#ffffff" stroke="#2d4123" stroke-width="2.5" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.15))"/>
        <ellipse cx="44" cy="30" rx="5" ry="2.5" fill="#e2ecd6" opacity="0.8"/>
      </svg>
    `
  },
  {
    id: 'ambar',
    title: '3. Ámbar / Dorados',
    status: 'Maduro · Efecto Corporal',
    badgeClass: 'health-badge-carencia',
    desc: 'Cabezas glandulares teñidas de tono ámbar caramelo o miel dorada.',
    effect: 'Degradación natural de THC hacia CBN. Proporciona un efecto narcótico, analgésico, sedante y relajante muscular profundo.',
    svg: `
      <svg viewBox="0 0 100 110" class="h-24 w-full object-contain" xmlns="http://www.w3.org/2000/svg">
        <path d="M 50 100 Q 52 60 50 42" stroke="#b45309" stroke-width="6" stroke-linecap="round" fill="none"/>
        <circle cx="50" cy="36" r="18" fill="#d97706" stroke="#b45309" stroke-width="2.5" filter="drop-shadow(0 2px 6px rgba(180,83,9,0.25))"/>
        <ellipse cx="44" cy="30" rx="5" ry="2.5" fill="#fef08a" opacity="0.8"/>
      </svg>
    `
  }
];

/* ==========================================================================
   2. UTILIDADES DE FECHA, FORMATO Y DOM
   ========================================================================== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function nowLocalDateTime() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function todayDateStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function daysDiff(d1Str, d2Str) {
  const t1 = new Date(d1Str).setHours(0, 0, 0, 0);
  const t2 = new Date(d2Str).setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((t2 - t1) / DAY_MS));
}

function formatPrettyDate(dateIsoStr) {
  if (!dateIsoStr) return '—';
  const d = new Date(dateIsoStr);
  const day = d.getDate();
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${months[d.getMonth()]}, ${hours}:${mins} hs`;
}

function timeAgo(dateIsoStr) {
  if (!dateIsoStr) return '';
  const diffMs = Date.now() - new Date(dateIsoStr).getTime();
  const diffHours = Math.floor(diffMs / (3600 * 1000));
  const diffDays = Math.floor(diffMs / DAY_MS);
  if (diffHours < 1) return 'hace un momento';
  if (diffHours < 24) return `hace ${diffHours} h`;
  if (diffDays === 1) return 'ayer';
  if (diffDays < 30) return `hace ${diffDays} días`;
  return `hace ${Math.floor(diffDays / 7)} sem`;
}

let toastTimer = null;
function showToast(msg) {
  const el = $('app-toast');
  if (!el) return;
  $('app-toast-text').textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translate(-50%, 6px)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, 0)';
  }, 2400);
}

function compressImage(file, maxWidth = 960, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ==========================================================================
   3. GESTOR DE ALMACENAMIENTO OFFLINE (IndexedDB + Fallback LocalStorage)
   ========================================================================== */
const Storage = {
  db: null,

  async init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve();
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('plants')) {
          db.createObjectStore('plants', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('plantId', 'plantId', { unique: false });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = () => resolve();
    });
  },

  async getPlants() {
    if (this.db) {
      return new Promise((res) => {
        const tx = this.db.transaction('plants', 'readonly');
        const req = tx.objectStore('plants').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });
    }
    try {
      return JSON.parse(localStorage.getItem('cannasur_plants') || '[]');
    } catch { return []; }
  },

  async savePlant(plant) {
    if (this.db) {
      return new Promise((res, rej) => {
        const tx = this.db.transaction('plants', 'readwrite');
        const req = tx.objectStore('plants').put(plant);
        req.onsuccess = () => res(plant);
        req.onerror = rej;
      });
    }
    const plants = await this.getPlants();
    const idx = plants.findIndex((p) => p.id === plant.id);
    if (idx >= 0) plants[idx] = plant; else plants.unshift(plant);
    localStorage.setItem('cannasur_plants', JSON.stringify(plants));
    return plant;
  },

  async deletePlant(plantId) {
    if (this.db) {
      return new Promise((res) => {
        const tx = this.db.transaction(['plants', 'logs'], 'readwrite');
        tx.objectStore('plants').delete(plantId);
        const logStore = tx.objectStore('logs');
        const index = logStore.index('plantId');
        const req = index.openCursor(IDBKeyRange.only(plantId));
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            logStore.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
        tx.oncomplete = () => res();
      });
    }
    let plants = await this.getPlants();
    plants = plants.filter((p) => p.id !== plantId);
    localStorage.setItem('cannasur_plants', JSON.stringify(plants));
    let logs = await this.getAllLogs();
    logs = logs.filter((l) => l.plantId !== plantId);
    localStorage.setItem('cannasur_logs', JSON.stringify(logs));
  },

  async getAllLogs() {
    if (this.db) {
      return new Promise((res) => {
        const tx = this.db.transaction('logs', 'readonly');
        const req = tx.objectStore('logs').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });
    }
    try {
      return JSON.parse(localStorage.getItem('cannasur_logs') || '[]');
    } catch { return []; }
  },

  async getLogsByPlant(plantId) {
    if (this.db) {
      return new Promise((res) => {
        const tx = this.db.transaction('logs', 'readonly');
        const index = tx.objectStore('logs').index('plantId');
        const req = index.getAll(plantId);
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
          res(list);
        };
        req.onerror = () => res([]);
      });
    }
    const all = await this.getAllLogs();
    const list = all.filter((l) => l.plantId === plantId);
    list.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
    return list;
  },

  async saveLog(log) {
    if (this.db) {
      return new Promise((res, rej) => {
        const tx = this.db.transaction('logs', 'readwrite');
        const req = tx.objectStore('logs').put(log);
        req.onsuccess = () => res(log);
        req.onerror = rej;
      });
    }
    const logs = await this.getAllLogs();
    const idx = logs.findIndex((l) => l.id === log.id);
    if (idx >= 0) logs[idx] = log; else logs.unshift(log);
    localStorage.setItem('cannasur_logs', JSON.stringify(logs));
    return log;
  },

  async deleteLog(logId) {
    if (this.db) {
      return new Promise((res) => {
        const tx = this.db.transaction('logs', 'readwrite');
        tx.objectStore('logs').delete(logId);
        tx.oncomplete = () => res();
      });
    }
    let logs = await this.getAllLogs();
    logs = logs.filter((l) => l.id !== logId);
    localStorage.setItem('cannasur_logs', JSON.stringify(logs));
  },

  /* Reinicia toda la app y genera un cultivo de ejemplo completo */
  async resetToDemo() {
    const existingPlants = await this.getPlants();
    for (const p of existingPlants) {
      await this.deletePlant(p.id);
    }
    const allLogs = await this.getAllLogs();
    for (const l of allLogs) {
      await this.deleteLog(l.id);
    }

    // Planta 1: Gorilla Glue #4 en Vegetativo (Maceta 15L, Salud Óptima)
    const germVeg = new Date(Date.now() - 42 * DAY_MS).toISOString().split('T')[0];
    const plant1 = {
      id: 'demo-plant-1',
      name: 'Gorilla Glue #4',
      strain: 'Gorilla Glue #4 (Feminizada)',
      type: 'fotoperiodica',
      medium: 'sustrato',
      potLiters: 15,
      cycleDays: 140,
      healthStatus: 'optima',
      germDate: germVeg,
      stage: 'vegetativo',
      createdAt: new Date().toISOString()
    };
    await this.savePlant(plant1);

    // Planta 2: Tangie Auto en Floración (Maceta 11L, Carencia P con tratamiento)
    const germFlora = new Date(Date.now() - 56 * DAY_MS).toISOString().split('T')[0];
    const plant2 = {
      id: 'demo-plant-2',
      name: 'Tangie Auto',
      strain: 'Tangie (Automática / Sativa)',
      type: 'automatica',
      medium: 'sustrato',
      potLiters: 11,
      cycleDays: 80,
      healthStatus: 'carencia_p',
      germDate: germFlora,
      stage: 'floracion',
      createdAt: new Date().toISOString()
    };
    await this.savePlant(plant2);

    // Logs de demostración para Planta 1
    const logs1 = [
      {
        id: 'log-1',
        plantId: plant1.id,
        type: 'transplante',
        dateTime: new Date(Date.now() - 40 * DAY_MS).toISOString(),
        notes: 'Semilla germinada con gran vigor en servilleta húmeda. Trasplante a maceta de enraizamiento inicial con sustrato liviano.',
        metrics: { potSize: '1 L' }
      },
      {
        id: 'log-2',
        plantId: plant1.id,
        type: 'transplante',
        dateTime: new Date(Date.now() - 25 * DAY_MS).toISOString(),
        notes: 'Trasplante definitivo a maceta geotextil de 15L. Micorrizas espolvoreadas directo en el cepellón para colonización rápida.',
        metrics: { potSize: '15 L' }
      },
      {
        id: 'log-3',
        plantId: plant1.id,
        type: 'riego_nutrientes',
        dateTime: new Date(Date.now() - 14 * DAY_MS).toISOString(),
        notes: 'Riego vegetativo vigoroso con base rica en nitrógeno y bioestimulante de algas. Respuesta foliar excelente.',
        metrics: { liters: 2.2, ph: 6.3, ec: 1.1, products: 'Base Crecimiento (N) 3ml/L + Algas' }
      },
      {
        id: 'log-4',
        plantId: plant1.id,
        type: 'poda',
        dateTime: new Date(Date.now() - 6 * DAY_MS).toISOString(),
        notes: 'Poda apical en el 4to nudo para promover 4 ramas principales bien equilibradas. Cicatrizó en 24 horas sin estrés.',
        metrics: { pruneType: 'Poda Apical' }
      },
      {
        id: 'log-5',
        plantId: plant1.id,
        type: 'foliar',
        dateTime: new Date(Date.now() - 1 * DAY_MS).toISOString(),
        notes: 'Pulverización foliar preventiva al atardecer: Aceite de Neem + Jabón Potásico emulsionado en ambas caras.',
        metrics: { foliarType: 'Aceite de Neem + Jabón Potásico', liters: 1.0 }
      }
    ];

    // Logs de demostración para Planta 2
    const logs2 = [
      {
        id: 'log-6',
        plantId: plant2.id,
        type: 'cambio_etapa',
        dateTime: new Date(Date.now() - 32 * DAY_MS).toISOString(),
        notes: 'Aparición de primeros pistilos blancos en todos los nudos. Comienza el período de floración.',
        metrics: { stage: 'floracion' }
      },
      {
        id: 'log-7',
        plantId: plant2.id,
        type: 'riego_nutrientes',
        dateTime: new Date(Date.now() - 10 * DAY_MS).toISOString(),
        notes: 'Riego con base de floración y melaza de caña. Formación de cálices y tricomas en los cogollos principales.',
        metrics: { liters: 1.6, ph: 6.5, ec: 1.3, products: 'Base Floración (PK) + Melazas' }
      },
      {
        id: 'log-8',
        plantId: plant2.id,
        type: 'nota_foto',
        dateTime: new Date(Date.now() - 3 * DAY_MS).toISOString(),
        notes: '🩺 Diagnóstico visual: Hojas adultas con manchas bronce/violáceas y pecíolos rojizos. Protocolo aplicado: enmienda rica en fósforo y pH regulado a 6.5.',
        metrics: { healthUpdate: 'carencia_p' }
      }
    ];

    for (const l of [...logs1, ...logs2]) {
      await this.saveLog(l);
    }
  },

  async seedIfEmpty() {
    const plants = await this.getPlants();
    if (plants.length > 0) return;
    await this.resetToDemo();
  }
};

/* ==========================================================================
   4. MÓDULO RECORDATORIOS & NOTIFICACIONES HASTA EL FIN DEL CICLO
   ========================================================================== */
const RemindersModule = {
  activeReminders: [],
  scheduleExpanded: false,

  async init() {
    $('btn-toggle-cycle-schedule')?.addEventListener('click', () => {
      this.scheduleExpanded = !this.scheduleExpanded;
      const dd = $('cycle-schedule-dropdown');
      const arrow = $('cycle-schedule-arrow');
      if (dd) dd.classList.toggle('hidden', !this.scheduleExpanded);
      if (arrow) arrow.textContent = this.scheduleExpanded ? '▴' : '▾';
      if (this.scheduleExpanded) {
        this.renderCycleSchedule();
      }
    });

    $('btn-toggle-notifications')?.addEventListener('click', () => this.requestNotificationPermission());
    $('btn-enable-web-notif')?.addEventListener('click', () => this.requestNotificationPermission());

    this.checkNotificationStatus();
    await this.renderReminders();
  },

  checkNotificationStatus() {
    if (!('Notification' in window)) {
      $('notif-bell-icon').textContent = '🔔';
      $('web-notif-permission-banner')?.classList.add('hidden');
      return;
    }
    if (Notification.permission === 'granted') {
      $('notif-bell-icon').textContent = '🔔';
      $('notif-status-text').textContent = 'Activas';
      $('btn-toggle-notifications')?.classList.add('border-[#2d4123]/30');
      $('web-notif-permission-banner')?.classList.add('hidden');
    } else if (Notification.permission === 'denied') {
      $('notif-bell-icon').textContent = '🔕';
      $('notif-status-text').textContent = 'Silenciadas';
      $('web-notif-permission-banner')?.classList.add('hidden');
    } else {
      $('notif-bell-icon').textContent = '🔔';
      $('notif-status-text').textContent = 'Activar';
      $('web-notif-permission-banner')?.classList.remove('hidden');
    }
  },

  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      showToast('Tu navegador no soporta notificaciones de sistema');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      this.checkNotificationStatus();
      if (perm === 'granted') {
        showToast('🔔 Notificaciones de cultivo activadas');
        new Notification('CannaSur — Recordatorios Activos', {
          body: 'Te avisaremos cuando toque regar, fertilizar o aplicar preventivos.',
          icon: 'favicon.ico'
        });
      } else {
        showToast('Notificaciones rechazadas en navegador');
      }
    } catch {
      showToast('Error al solicitar permiso');
    }
  },

  async calculatePlantReminders(plant) {
    const logs = await Storage.getLogsByPlant(plant.id);
    const pot = plant.potLiters || 15;
    const minWater = (pot * 0.1).toFixed(1);
    const maxWater = (pot * 0.15).toFixed(1);
    const defWater = (pot * 0.15).toFixed(1);
    const reminders = [];

    // 1. RIEGO CON AGUA / NUTRIENTES
    const lastWater = logs.find((l) => l.type === 'riego_agua' || l.type === 'riego_nutrientes');
    const daysSinceWater = lastWater ? daysDiff(lastWater.dateTime.split('T')[0], todayDateStr()) : 99;

    if (daysSinceWater >= 3) {
      reminders.push({
        id: `rem-water-${plant.id}`,
        plantId: plant.id,
        plantName: plant.name,
        type: 'riego_agua',
        priority: 'urgent',
        badge: '💧 Urgente',
        badgeClass: 'health-badge-critica',
        title: `Riego pendiente para ${plant.name}`,
        desc: `Han pasado ${daysSinceWater} días desde el último riego. Riego sugerido para maceta de ${pot} L: ~${minWater} a ${maxWater} L.`,
        actionText: 'Regar',
        defaultLiters: defWater
      });
    } else if (daysSinceWater === 2) {
      reminders.push({
        id: `rem-water-${plant.id}`,
        plantId: plant.id,
        plantName: plant.name,
        type: 'riego_agua',
        priority: 'today',
        badge: '💧 Toca Hoy',
        badgeClass: 'health-badge-riego',
        title: `Riego de hoy: ${plant.name}`,
        desc: `Sustrato en ciclo seco-húmedo óptimo. Preparar ~${minWater} a ${maxWater} L de agua declorada con pH 6.2 - 6.5.`,
        actionText: 'Regar',
        defaultLiters: defWater
      });
    }

    // 2. FERTILIZACIÓN SEMANAL
    if (plant.stage !== 'cosecha' && plant.stage !== 'plantula') {
      const lastNutr = logs.find((l) => l.type === 'riego_nutrientes');
      const daysSinceNutr = lastNutr ? daysDiff(lastNutr.dateTime.split('T')[0], todayDateStr()) : 99;
      if (daysSinceNutr >= 6) {
        reminders.push({
          id: `rem-nutr-${plant.id}`,
          plantId: plant.id,
          plantName: plant.name,
          type: 'riego_nutrientes',
          priority: 'today',
          badge: '🧪 Nutrición',
          badgeClass: 'badge-mono-inverted',
          title: `Fertilización sugerida: ${plant.name}`,
          desc: `Último aporte hace ${daysSinceNutr} días. Dosis calculada para ${pot} L de maceta (~${defWater} L de solución nutritiva).`,
          actionText: 'Nutrir',
          defaultLiters: defWater
        });
      }
    }

    // 3. PREVENCIÓN FOLIAR (MIP) CADA 10 A 12 DÍAS
    if (plant.stage !== 'cosecha') {
      const lastFoliar = logs.find((l) => l.type === 'foliar');
      const daysSinceFoliar = lastFoliar ? daysDiff(lastFoliar.dateTime.split('T')[0], todayDateStr()) : 99;
      if (daysSinceFoliar >= 11) {
        const product = plant.stage === 'floracion' ? 'Bacillus thuringiensis (Bt)' : 'Aceite de Neem + Jabón Potásico';
        reminders.push({
          id: `rem-foliar-${plant.id}`,
          plantId: plant.id,
          plantName: plant.name,
          type: 'foliar',
          priority: 'today',
          badge: '🌿 Preventivo',
          badgeClass: 'health-badge-recuperacion',
          title: `Pulverización foliar: ${plant.name}`,
          desc: `Han pasado ${daysSinceFoliar} días. Aplicar ${product} en el envés al atardecer para blindar contra plagas.`,
          actionText: 'Foliar',
          defaultLiters: 1.0,
          foliarProduct: product
        });
      }
    }

    // 4. HITOS DEL FIN DEL CICLO (Lavado de raíces y Cosecha)
    const cycleDays = plant.cycleDays || (plant.type === 'automatica' ? 80 : 140);
    const daysLived = daysDiff(plant.germDate, todayDateStr());
    const daysRemaining = cycleDays - daysLived;

    if (daysRemaining <= 12 && daysRemaining > 0 && plant.stage === 'floracion') {
      reminders.push({
        id: `rem-flush-${plant.id}`,
        plantId: plant.id,
        plantName: plant.name,
        type: 'riego_agua',
        priority: 'urgent',
        badge: '🚿 Lavado Raíces',
        badgeClass: 'health-badge-alerta',
        title: `Lavado de raíces previo a cosecha: ${plant.name}`,
        desc: `Faltan aproximadamente ${daysRemaining} días para el corte estimado. Regar solo con agua limpia sin abonos.`,
        actionText: 'Registrar Lavado',
        defaultLiters: (pot * 0.25).toFixed(1)
      });
    } else if (daysRemaining <= 0) {
      reminders.push({
        id: `rem-harvest-${plant.id}`,
        plantId: plant.id,
        plantName: plant.name,
        type: 'nota_foto',
        priority: 'urgent',
        badge: '💎 Cosecha',
        badgeClass: 'stage-badge-floracion',
        title: `Cosecha estimada alcanzada: ${plant.name}`,
        desc: `Día ${daysLived} de ${cycleDays}. Inspeccionar tricomas con lupa de 60x para verificar maduración ámbar.`,
        actionText: 'Inspeccionar',
        defaultLiters: 0
      });
    }

    return reminders;
  },

  async renderReminders() {
    const listEl = $('reminders-active-list');
    const badgeEl = $('reminders-count-badge');
    if (!listEl) return;

    const plants = await Storage.getPlants();
    let all = [];

    for (const p of plants) {
      const pRems = await this.calculatePlantReminders(p);
      all = all.concat(pRems);
    }

    this.activeReminders = all;
    if (badgeEl) {
      badgeEl.textContent = all.length > 0 ? `${all.length} pendientes` : 'Al día';
    }

    if (all.length === 0) {
      listEl.innerHTML = `
        <div class="rounded-xl bg-[#edf2e2] border border-[#2d4123]/10 p-3 text-center text-xs text-[#384933] font-medium">
          <span class="text-sm">✨</span> Todas tus plantas están hidratadas y al día. Buen cultivo.
        </div>
      `;
      return;
    }

    listEl.innerHTML = all.map((rem) => {
      const plant = plants.find((p) => p.id === rem.plantId);
      const health = HEALTH_STATES[plant?.healthStatus] || HEALTH_STATES.optima;

      return `
        <div class="rounded-xl bg-[#edf2e2] border border-[#2d4123]/12 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition hover:border-[#2d4123]/25">
          <div class="flex items-start gap-2.5 min-w-0">
            <!-- Botón Checkbox Apple Reminders -->
            <button type="button" class="reminder-checkbox mt-0.5 shrink-0"
              title="Marcar como realizado"
              onclick="RemindersModule.quickComplete('${rem.id}')">
            </button>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="${rem.badgeClass} text-[10px] !py-0.5 !px-2">${rem.badge}</span>
                <span class="font-bold text-xs text-[#121e10] truncate">${esc(rem.plantName)}</span>
                <span class="${health.badgeClass} text-[9px] !py-0 !px-1.5">${health.emoji} ${health.label.split(' ')[0]}</span>
              </div>
              <p class="text-[11px] text-[#384933] mt-1 leading-snug font-medium">${esc(rem.desc)}</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-1.5 shrink-0">
            <button type="button" class="ios-btn ios-btn-secondary text-[11px] !py-1 !px-3 !min-h-[2rem] font-semibold"
              onclick="RemindersModule.openReminderModal('${rem.id}')">
              ${rem.actionText} →
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async quickComplete(reminderId) {
    const rem = this.activeReminders.find((r) => r.id === reminderId);
    if (!rem) return;

    const plant = GrowlogsModule.plants.find((p) => p.id === rem.plantId);
    const pot = plant?.potLiters || 15;

    await Storage.saveLog({
      id: 'log-' + Date.now(),
      plantId: rem.plantId,
      type: rem.type,
      dateTime: new Date().toISOString(),
      notes: `Procedimiento completado desde recordatorio del ciclo: ${rem.title}.`,
      metrics: {
        liters: rem.defaultLiters ? parseFloat(rem.defaultLiters) : undefined,
        products: rem.type === 'riego_nutrientes' ? 'Solución nutritiva balanceada' : undefined,
        foliarType: rem.foliarProduct || undefined,
        potSize: `${pot} L`
      }
    });

    showToast(`✓ Completado: ${rem.title}`);
    await GrowlogsModule.loadPlants();
    await this.renderReminders();
  },

  openReminderModal(reminderId) {
    const rem = this.activeReminders.find((r) => r.id === reminderId);
    if (!rem) return;

    GrowlogsModule.activePlantId = rem.plantId;
    GrowlogsModule.openLogModal(rem.type);

    setTimeout(() => {
      if ($('log-liters') && rem.defaultLiters) $('log-liters').value = rem.defaultLiters;
      if ($('log-products') && rem.type === 'riego_nutrientes') $('log-products').value = 'Riego nutricional semanal';
      if ($('log-foliar-type') && rem.foliarProduct) $('log-foliar-type').value = rem.foliarProduct;
      if ($('input-log-notes')) $('input-log-notes').value = `Registro completado según cronograma del ciclo: ${rem.title}.`;
    }, 60);
  },

  renderCycleSchedule() {
    const container = $('cycle-schedule-timeline');
    const plantNameEl = $('cycle-plant-selected-name');
    if (!container) return;

    const activePlant = GrowlogsModule.activePlantId
      ? GrowlogsModule.plants.find((p) => p.id === GrowlogsModule.activePlantId)
      : GrowlogsModule.plants[0];

    if (!activePlant) {
      container.innerHTML = `<p class="text-[#5c6f56] italic">No hay plantas creadas para proyectar el ciclo.</p>`;
      return;
    }

    if (plantNameEl) plantNameEl.textContent = `${activePlant.name} (${activePlant.type})`;

    const germDate = activePlant.germDate;
    const daysLived = daysDiff(germDate, todayDateStr());
    const currentWeek = Math.max(1, Math.floor(daysLived / 7) + 1);
    const pot = activePlant.potLiters || 15;

    const weeksPlan = [
      { w: 'Sem 1-2', days: 'Días 1-14', title: '🌱 Plántula & Enraizamiento', desc: 'Riegos mínimos (~5% sustrato). Estimulante radicular y micorrizas.' },
      { w: 'Sem 3-4', days: 'Días 15-28', title: '🌿 Vegetativo Temprano', desc: `Riego regular al 10-15% (${(pot * 0.1).toFixed(1)} a ${(pot * 0.15).toFixed(1)} L). Primeras podas LST / apical.` },
      { w: 'Sem 5-7', days: 'Días 29-49', title: '🌿 Vegetativo Pleno & MIP', desc: 'Pulverización preventiva Neem + Potásico cada 10-12 días. Aporte de Nitrógeno.' },
      { w: 'Sem 8-9', days: 'Días 50-63', title: '⚡ Transición & Pre-floración', desc: 'Estiramiento (stretch). Cambio a fotoperíodo 12/12 si es indoor. Fósforo/Potasio inicial.' },
      { w: 'Sem 10-12', days: 'Días 64-84', title: '🌸 Floración Plena & Engorde', desc: 'Formación de cálices y resina. Control de orugas con Bacillus thuringiensis.' },
      { w: 'Sem 13-14', days: 'Días 85-98', title: '💎 Maduración de Tricomas', desc: 'Melazas, azúcares y potasio. Seguimiento de tricomas con lupa 60x.' },
      { w: 'Final', days: 'Últimos 10 días', title: '🚿 Lavado de Raíces (Flush)', desc: 'Agua sola sin nutrientes para eliminar sales. Hojas comienzan a amarillear naturalmente.' },
      { w: 'Corte', days: 'Día estimado', title: '🌑 Cosecha & Secado', desc: 'Corte en Luna Menguante o Luna Nueva. Secado a 18-20°C y 55-60% HR en oscuridad total.' }
    ];

    container.innerHTML = weeksPlan.map((step, idx) => {
      const isPast = (idx + 1) * 2 < currentWeek;
      const isCurrent = Math.abs((idx + 1) * 2 - currentWeek) <= 1;

      return `
        <div class="rounded-xl border p-2.5 transition ${
          isCurrent
            ? 'bg-white border-[#2d4123]/30 text-[#121e10] shadow-sm font-semibold'
            : isPast
            ? 'bg-[#edf2e2]/60 border-[#2d4123]/10 text-[#5c6f56]'
            : 'bg-[#edf2e2] border-[#2d4123]/10 text-[#384933]'
        }">
          <div class="flex items-center justify-between text-[11px] mb-1">
            <span class="font-bold flex items-center gap-1.5">
              <span>${isPast ? '✓' : isCurrent ? '📍' : '○'}</span>
              <span>${step.title}</span>
            </span>
            <span class="font-mono text-[10px] text-[#5c6f56]">${step.w} · ${step.days}</span>
          </div>
          <p class="text-[11px] text-[#384933] pl-4 leading-relaxed font-normal">${step.desc}</p>
        </div>
      `;
    }).join('');
  }
};

/* ==========================================================================
   5. MÓDULO GROWLOGS (BITÁCORA TIPO APPLE NOTES / JOURNAL)
   ========================================================================== */
const GrowlogsModule = {
  plants: [],
  activePlantId: null,
  activeFilter: 'all',
  activeTimelineFilter: 'all',
  pendingPhotoData: null,

  async init() {
    await Storage.seedIfEmpty();
    await this.loadPlants();

    $('btn-top-new-plant')?.addEventListener('click', () => this.openPlantModal());
    $('btn-empty-add-plant')?.addEventListener('click', () => this.openPlantModal());

    // Botones de reinicio / carga de demostración
    const triggerDemoReset = async () => {
      if (!confirm('¿Cargar la versión de demostración? Se restaurarán 2 plantas de ejemplo con bitácora completa, riegos y recordatorios.')) return;
      await Storage.resetToDemo();
      await this.loadPlants();
      this.showDashboard();
      App.navigate('growlogs');
      showToast('🌱 Versión de demostración cargada');
    };

    $('btn-top-reset-demo')?.addEventListener('click', triggerDemoReset);
    $('btn-config-reset-demo')?.addEventListener('click', triggerDemoReset);
    $('btn-load-demo-plant')?.addEventListener('click', triggerDemoReset);

    $('btn-back-to-plants')?.addEventListener('click', () => this.showDashboard());
    $('btn-edit-plant-info')?.addEventListener('click', () => {
      const plant = this.plants.find((p) => p.id === this.activePlantId);
      if (plant) this.openPlantModal(plant);
    });

    $('btn-delete-plant')?.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta planta y todas sus notas de la bitácora?')) return;
      await Storage.deletePlant(this.activePlantId);
      this.activePlantId = null;
      await this.loadPlants();
      this.showDashboard();
      showToast('Planta eliminada');
    });

    // Segmented filters de plantas
    $('plants-stage-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-plant-filter]');
      if (!btn) return;
      this.activeFilter = btn.dataset.plantFilter;
      document.querySelectorAll('#plants-stage-filters button').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      this.renderPlantsGrid();
    });

    // Filtros de Timeline
    $('timeline-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-timeline-filter]');
      if (!btn) return;
      this.activeTimelineFilter = btn.dataset.timelineFilter;
      document.querySelectorAll('#timeline-filters button').forEach((b) => {
        const act = b === btn;
        b.className = act ? 'badge-mono badge-mono-inverted cursor-pointer' : 'badge-mono cursor-pointer';
      });
      this.renderTimeline();
    });

    // Accesos directos rápidos
    document.querySelectorAll('[data-quick-log]').forEach((b) => {
      b.addEventListener('click', () => this.openLogModal(b.dataset.quickLog));
    });
    $('btn-open-full-log')?.addEventListener('click', () => this.openLogModal('riego_agua'));

    // Modal de Registro
    $('btn-close-log-modal')?.addEventListener('click', () => this.closeLogModal());
    $('form-log-entry')?.addEventListener('submit', (e) => this.handleLogSubmit(e));

    $('log-type-selector')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      this.setLogModalType(btn.dataset.type);
    });

    // Subida de Foto en Log
    $('input-log-photo')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        this.pendingPhotoData = await compressImage(file, 960, 0.78);
        $('log-photo-preview-img').src = this.pendingPhotoData;
        $('log-photo-preview-box').classList.remove('hidden');
      } catch {
        showToast('No se pudo procesar la foto');
      }
    });
    $('btn-remove-log-photo')?.addEventListener('click', () => {
      this.pendingPhotoData = null;
      $('input-log-photo').value = '';
      $('log-photo-preview-box').classList.add('hidden');
    });

    // Modal de Planta
    $('btn-close-plant-modal')?.addEventListener('click', () => this.closePlantModal());
    $('form-plant')?.addEventListener('submit', (e) => this.handlePlantSubmit(e));

    $('input-plant-cover-photo')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const photo = await compressImage(file, 800, 0.75);
        $('plant-cover-preview-img').src = photo;
        $('plant-cover-preview-box').classList.remove('hidden');
        $('input-plant-cover-photo').dataset.base64 = photo;
      } catch {
        showToast('Error con la foto de portada');
      }
    });
    $('btn-remove-plant-cover')?.addEventListener('click', () => {
      delete $('input-plant-cover-photo').dataset.base64;
      $('input-plant-cover-photo').value = '';
      $('plant-cover-preview-box').classList.add('hidden');
    });

    // Control de tamaño de maceta y cálculo de riego en formulario de planta
    const updatePlantPotHint = () => {
      const pot = parseFloat($('input-plant-pot')?.value) || 15;
      const minR = (pot * 0.1).toFixed(1);
      const maxR = (pot * 0.15).toFixed(1);
      if ($('plant-pot-hint')) $('plant-pot-hint').textContent = `Riego sugerido: ~${minR} - ${maxR} L`;
    };
    $('input-plant-pot')?.addEventListener('input', updatePlantPotHint);
    $('plant-pot-presets')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pot]');
      if (!btn) return;
      $('input-plant-pot').value = btn.dataset.pot;
      updatePlantPotHint();
    });

    // Lightbox
    $('btn-close-lightbox')?.addEventListener('click', () => $('lightbox-modal').classList.add('hidden'));
    $('lightbox-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox-modal') $('lightbox-modal').classList.add('hidden');
    });
  },

  async loadPlants() {
    this.plants = await Storage.getPlants();
    this.updateStats();
    await this.renderPlantsGrid();
    await RemindersModule.renderReminders();
  },

  updateStats() {
    if ($('stat-total-plants')) $('stat-total-plants').textContent = this.plants.length;
    if ($('stat-veg-plants')) $('stat-veg-plants').textContent = this.plants.filter((p) => p.stage === 'vegetativo' || p.stage === 'plantula').length;
    if ($('stat-flower-plants')) $('stat-flower-plants').textContent = this.plants.filter((p) => p.stage === 'floracion' || p.stage === 'transicion').length;
  },

  async renderPlantsGrid() {
    const grid = $('plants-grid');
    const empty = $('plants-empty-state');
    if (!grid) return;

    let filtered = this.plants;
    if (this.activeFilter !== 'all') {
      filtered = this.plants.filter((p) => p.stage === this.activeFilter);
    }

    if (this.plants.length === 0) {
      grid.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="col-span-full ios-card p-6 text-center text-xs text-[#5c6f56]">No hay plantas en etapa ${this.activeFilter}.</div>`;
      return;
    }

    const cardsHtml = await Promise.all(filtered.map(async (p) => {
      const days = daysDiff(p.germDate, todayDateStr());
      const weeks = Math.max(1, Math.floor(days / 7) + 1);
      const st = STAGES[p.stage] || STAGES.vegetativo;
      const pot = p.potLiters || 15;
      const minWater = (pot * 0.1).toFixed(1);
      const maxWater = (pot * 0.15).toFixed(1);
      const health = HEALTH_STATES[p.healthStatus] || HEALTH_STATES.optima;
      const logs = await Storage.getLogsByPlant(p.id);
      const lastLog = logs[0];

      return `
        <div class="ios-card ios-card-press p-4 flex flex-col justify-between cursor-pointer space-y-3" onclick="GrowlogsModule.openPlantDetail('${p.id}')">
          <div class="space-y-3">
            <!-- Fila Superior: Avatar + Nombre + Estado -->
            <div class="flex items-center gap-3">
              <div class="h-14 w-14 shrink-0 rounded-2xl bg-[#edf2e2] border border-[#2d4123]/15 overflow-hidden flex items-center justify-center">
                ${p.coverPhoto
                  ? `<img src="${p.coverPhoto}" alt="${esc(p.name)}" class="h-full w-full object-cover" />`
                  : `<span class="text-2xl">${st.emoji}</span>`}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-1">
                  <h3 class="text-base font-bold text-[#121e10] tracking-tight leading-tight truncate">${esc(p.name)}</h3>
                  <span class="${health.badgeClass} text-[9px] !py-0.5 !px-2 shrink-0 rounded-full">${health.emoji} ${health.label.split(' ')[0]}</span>
                </div>
                <p class="text-xs text-[#5c6f56] truncate mt-0.5 font-medium">${esc(p.strain || 'Genética personalizada')}</p>
                <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span class="badge-mono font-mono text-[10px]">Día ${days}</span>
                  <span class="badge-mono text-[10px] text-[#384933]">Sem ${weeks}</span>
                  <span class="${st.badgeClass} text-[10px]">${st.label}</span>
                  <span class="badge-mono text-[10px] text-[#384933]">🪴 ${pot} L</span>
                  <span class="badge-mono text-[10px] text-[#121e10] font-mono font-bold">💧 ~${minWater}–${maxWater} L</span>
                </div>
              </div>
            </div>

            <!-- Última Nota Registrada (Snippet estilo Libreta Apple) -->
            <div class="rounded-xl bg-[#edf2e2] p-2.5 border border-[#2d4123]/10 text-[11px] text-[#384933]">
              ${lastLog
                ? `<div class="flex items-center justify-between text-[10px] text-[#5c6f56] mb-0.5 font-mono font-semibold">
                     <span>${LOG_TYPES[lastLog.type]?.icon || '📝'} ${LOG_TYPES[lastLog.type]?.label || 'Nota'}</span>
                     <span>${timeAgo(lastLog.dateTime)}</span>
                   </div>
                   <p class="text-[#121e10] line-clamp-2 leading-relaxed font-medium">"${esc(lastLog.notes || 'Entrada registrada')}"</p>`
                : `<p class="italic text-[#6d8066]">Sin notas aún. Toca para empezar su bitácora.</p>`}
            </div>
          </div>

          <!-- Pie de tarjeta -->
          <div class="flex items-center justify-between pt-1 text-[11px] text-[#5c6f56] font-semibold border-t border-[#2d4123]/10">
            <span>${p.medium} · ${p.type}</span>
            <span class="text-[#121e10] text-xs font-bold">Abrir bitácora →</span>
          </div>
        </div>
      `;
    }));

    grid.innerHTML = cardsHtml.join('');
  },

  async openPlantDetail(plantId) {
    this.activePlantId = plantId;
    const plant = this.plants.find((p) => p.id === plantId);
    if (!plant) return;

    $('growlogs-dashboard-container')?.classList.add('hidden');
    $('growlogs-detail-container')?.classList.remove('hidden');
    $('top-bar-subtext').textContent = `${plant.name} · Bitácora`;

    this.renderPlantHero(plant);
    await this.renderTimeline();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  showDashboard() {
    this.activePlantId = null;
    $('growlogs-detail-container')?.classList.add('hidden');
    $('growlogs-dashboard-container')?.classList.remove('hidden');
    $('top-bar-subtext').textContent = 'Bitácora de Plantas';
    this.renderPlantsGrid();
  },

  renderPlantHero(plant) {
    const days = daysDiff(plant.germDate, todayDateStr());
    const weeks = Math.max(1, Math.floor(days / 7) + 1);
    const st = STAGES[plant.stage] || STAGES.vegetativo;
    const pot = plant.potLiters || 15;
    const minWater = (pot * 0.1).toFixed(1);
    const maxWater = (pot * 0.15).toFixed(1);
    const health = HEALTH_STATES[plant.healthStatus] || HEALTH_STATES.optima;
    const cycleDays = plant.cycleDays || (plant.type === 'automatica' ? 80 : 140);
    const progressPct = Math.min(100, Math.round((days / cycleDays) * 100));

    $('plant-hero-card').innerHTML = `
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="h-16 w-16 shrink-0 rounded-2xl bg-[#edf2e2] border border-[#2d4123]/15 overflow-hidden flex items-center justify-center shadow-sm">
              ${plant.coverPhoto
                ? `<img src="${plant.coverPhoto}" alt="${esc(plant.name)}" class="h-full w-full object-cover cursor-pointer" onclick="GrowlogsModule.openLightbox('${plant.coverPhoto}', '${esc(plant.name)}')">`
                : `<span class="text-3xl">${st.emoji}</span>`}
            </div>

            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="text-xl font-extrabold text-[#121e10] tracking-tight">${esc(plant.name)}</h2>
                <span class="${st.badgeClass} text-[10px]">${st.label}</span>
                <span class="${health.badgeClass} text-[10px] rounded-full !px-2.5">${health.emoji} ${health.label}</span>
              </div>
              <p class="text-xs text-[#5c6f56] mt-0.5 font-medium">${esc(plant.strain || 'Variedad de jardín')} · <span class="capitalize">${plant.type}</span></p>
              <div class="flex items-center gap-2 mt-2 font-mono text-xs flex-wrap font-semibold">
                <span class="text-[#121e10] font-bold">Día ${days}</span>
                <span class="text-[#889980]">·</span>
                <span class="text-[#384933]">Semana ${weeks}</span>
                <span class="text-[#889980]">·</span>
                <span class="text-[#5c6f56] font-sans">${plant.medium}</span>
                <span class="text-[#889980]">·</span>
                <span class="text-[#121e10]">🪴 Maceta ${pot} L</span>
                <span class="text-[#889980]">·</span>
                <span class="text-[#384933] font-sans">💧 Riego: ~${minWater}–${maxWater} L</span>
              </div>
            </div>
          </div>

          <!-- Acciones Rápidas de Salud y Etapa -->
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="ios-btn ios-btn-secondary text-xs !py-1.5 !px-3 !min-h-[2.1rem] font-bold"
              onclick="App.navigate('plagas')">
              <span>🩺 Diagnosticar</span>
            </button>
            <div class="flex items-center gap-2 bg-[#edf2e2] px-3 py-1.5 rounded-xl border border-[#2d4123]/15">
              <span class="text-[11px] font-bold text-[#384933] uppercase">Etapa:</span>
              <select id="quick-change-stage" class="bg-transparent text-xs font-bold text-[#121e10] focus:outline-none cursor-pointer">
                <option value="plantula" ${plant.stage === 'plantula' ? 'selected' : ''}>🌱 Plántula</option>
                <option value="vegetativo" ${plant.stage === 'vegetativo' ? 'selected' : ''}>🌿 Vegetativo</option>
                <option value="transicion" ${plant.stage === 'transicion' ? 'selected' : ''}>⚡ Transición</option>
                <option value="floracion" ${plant.stage === 'floracion' ? 'selected' : ''}>🌸 Floración</option>
                <option value="cosecha" ${plant.stage === 'cosecha' ? 'selected' : ''}>💎 Cosecha</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Barra de Progreso del Ciclo hasta Cosecha -->
        <div class="rounded-xl bg-[#edf2e2] p-3 border border-[#2d4123]/12 space-y-1.5">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-[#384933] font-semibold">Ciclo de vida: Día ${days} de ~${cycleDays} (${progressPct}%)</span>
            <span class="font-mono text-[#121e10] font-bold">${Math.max(0, cycleDays - days)} días para cosecha</span>
          </div>
          <div class="w-full bg-[#dce6d1] rounded-full h-2.5 overflow-hidden border border-[#2d4123]/10">
            <div class="bg-[#182e14] h-full rounded-full transition-all duration-300" style="width: ${progressPct}%"></div>
          </div>
        </div>
      </div>
    `;

    $('quick-change-stage')?.addEventListener('change', async (e) => {
      const newStage = e.target.value;
      if (newStage === plant.stage) return;
      plant.stage = newStage;
      await Storage.savePlant(plant);

      await Storage.saveLog({
        id: 'log-' + Date.now(),
        plantId: plant.id,
        type: 'cambio_etapa',
        dateTime: new Date().toISOString(),
        notes: `Cambio de etapa fenológica a ${STAGES[newStage].label}.`,
        metrics: { stage: newStage }
      });

      this.renderPlantHero(plant);
      await this.renderTimeline();
      await RemindersModule.renderReminders();
      showToast(`Etapa: ${STAGES[newStage].label}`);
    });
  },

  async renderTimeline() {
    if (!this.activePlantId) return;
    const plant = this.plants.find((p) => p.id === this.activePlantId);
    let logs = await Storage.getLogsByPlant(this.activePlantId);

    $('timeline-count-badge').textContent = `${logs.length} ${logs.length === 1 ? 'nota' : 'notas'}`;

    if (this.activeTimelineFilter === 'riegos') {
      logs = logs.filter((l) => l.type === 'riego_agua' || l.type === 'riego_nutrientes');
    } else if (this.activeTimelineFilter === 'foliar') {
      logs = logs.filter((l) => l.type === 'foliar');
    } else if (this.activeTimelineFilter === 'manejo') {
      logs = logs.filter((l) => l.type === 'poda' || l.type === 'transplante' || l.type === 'cambio_etapa');
    } else if (this.activeTimelineFilter === 'fotos') {
      logs = logs.filter((l) => !!l.photo || l.type === 'nota_foto');
    }

    const container = $('plant-timeline-container');
    const empty = $('timeline-empty-state');

    if (logs.length === 0) {
      container.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

    container.innerHTML = logs.map((log) => {
      const t = LOG_TYPES[log.type] || LOG_TYPES.nota_foto;
      const dayAtLog = plant ? daysDiff(plant.germDate, log.dateTime.split('T')[0]) : null;

      let metricsBadges = '';
      if (log.metrics) {
        const m = log.metrics;
        if (m.liters) metricsBadges += `<span class="badge-mono font-mono text-[10px]">${m.liters} L agua</span>`;
        if (m.ph) metricsBadges += `<span class="badge-mono font-mono text-[10px]">pH ${m.ph}</span>`;
        if (m.ec) metricsBadges += `<span class="badge-mono font-mono text-[10px]">EC ${m.ec}</span>`;
        if (m.products) metricsBadges += `<span class="badge-mono text-[10px]">${esc(m.products)}</span>`;
        if (m.foliarType) metricsBadges += `<span class="badge-mono text-[10px]">${esc(m.foliarType)}</span>`;
        if (m.pruneType) metricsBadges += `<span class="badge-mono text-[10px]">${esc(m.pruneType)}</span>`;
        if (m.potSize) metricsBadges += `<span class="badge-mono text-[10px]">Maceta ${esc(m.potSize)}</span>`;
        if (m.healthUpdate) {
          const hState = HEALTH_STATES[m.healthUpdate];
          if (hState) metricsBadges += `<span class="${hState.badgeClass} text-[10px] rounded-full !px-2">${hState.emoji} ${hState.label}</span>`;
        }
      }

      return `
        <div class="journal-entry-card space-y-2.5">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="badge-mono">${t.icon} ${t.label}</span>
                ${dayAtLog != null ? `<span class="badge-mono text-[10px] font-mono">Día ${dayAtLog}</span>` : ''}
              </div>
              <div class="text-[11px] text-[#5c6f56] mt-1 font-mono font-semibold">
                ${formatPrettyDate(log.dateTime)} <span class="text-[#7d9178]">(${timeAgo(log.dateTime)})</span>
              </div>
            </div>

            <button type="button" onclick="GrowlogsModule.deleteLogEntry('${log.id}')"
              class="text-[#7d9178] hover:text-[#121e10] p-1 text-xs transition" title="Eliminar entrada">
              ✕
            </button>
          </div>

          ${metricsBadges ? `<div class="flex flex-wrap gap-1 text-[11px] pt-0.5">${metricsBadges}</div>` : ''}

          ${log.notes ? `<p class="text-xs text-[#121e10] leading-relaxed whitespace-pre-line font-medium">${esc(log.notes)}</p>` : ''}

          ${log.photo ? `
            <div class="pt-1">
              <img src="${log.photo}" alt="Foto de bitácora"
                onclick="GrowlogsModule.openLightbox('${log.photo}', '${esc(t.label)} · Día ${dayAtLog}')"
                class="h-32 sm:h-40 w-auto object-cover rounded-xl border border-[#2d4123]/15 cursor-pointer hover:border-[#2d4123]/35 transition shadow-sm" />
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  async deleteLogEntry(logId) {
    if (!confirm('¿Eliminar esta entrada de la bitácora?')) return;
    await Storage.deleteLog(logId);
    await this.renderTimeline();
    await RemindersModule.renderReminders();
    showToast('Entrada eliminada');
  },

  openLogModal(initialType = 'riego_agua') {
    if (!this.activePlantId && this.plants.length > 0) {
      this.activePlantId = this.plants[0].id;
    }
    if (!this.activePlantId) {
      showToast('Seleccioná una planta primero');
      return;
    }
    const plant = this.plants.find((p) => p.id === this.activePlantId);
    $('modal-log-plant-badge').textContent = plant ? `${plant.name} · ${STAGES[plant.stage].label}` : 'Registro';
    $('input-log-datetime').value = nowLocalDateTime();
    this.pendingPhotoData = null;
    $('input-log-photo').value = '';
    $('log-photo-preview-box').classList.add('hidden');
    $('input-log-notes').value = '';
    if ($('input-log-health-update')) $('input-log-health-update').value = 'keep';

    this.setLogModalType(initialType);
    $('modal-log-entry').classList.remove('hidden');
    $('modal-log-entry').classList.add('flex');
  },

  closeLogModal() {
    $('modal-log-entry').classList.add('hidden');
    $('modal-log-entry').classList.remove('flex');
  },

  setLogModalType(type) {
    $('input-log-type').value = type;
    document.querySelectorAll('.log-type-btn').forEach((btn) => {
      const active = btn.dataset.type === type;
      btn.className = `log-type-btn rounded-xl border p-2 text-center text-xs font-semibold transition ${
        active
          ? 'bg-[#182e14] text-white border-[#182e14] shadow-sm'
          : 'bg-[#edf2e2] border-[#2d4123]/15 text-[#384933] hover:text-[#121e10]'
      }`;
    });

    const dyn = $('dynamic-log-fields');
    const activePlant = this.plants.find((p) => p.id === this.activePlantId);
    const pot = activePlant?.potLiters || 15;
    const defWater = (pot * 0.15).toFixed(1);
    const minWater = (pot * 0.1).toFixed(1);
    const maxWater = (pot * 0.15).toFixed(1);

    if (type === 'riego_agua') {
      dyn.innerHTML = `
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">Litros</label>
            <input id="log-liters" type="number" step="0.25" value="${defWater}" class="ios-input w-full font-mono text-xs" required />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">pH</label>
            <input id="log-ph" type="number" step="0.1" placeholder="6.3" class="ios-input w-full font-mono text-xs" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">EC</label>
            <input id="log-ec" type="number" step="0.1" placeholder="0.4" class="ios-input w-full font-mono text-xs" />
          </div>
        </div>
        <p class="text-[10px] text-[#5c6f56] mt-1 font-medium">💡 Riego promedio para maceta de ${pot} L: <strong>~${minWater} a ${maxWater} L</strong> (10% a 15% del sustrato).</p>
      `;
    } else if (type === 'riego_nutrientes') {
      dyn.innerHTML = `
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">Litros</label>
            <input id="log-liters" type="number" step="0.25" value="${defWater}" class="ios-input w-full font-mono text-xs" required />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">pH</label>
            <input id="log-ph" type="number" step="0.1" placeholder="6.4" class="ios-input w-full font-mono text-xs" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">EC</label>
            <input id="log-ec" type="number" step="0.1" placeholder="1.2" class="ios-input w-full font-mono text-xs" />
          </div>
        </div>
        <p class="text-[10px] text-[#5c6f56] mt-1 font-medium">💡 Riego promedio para maceta de ${pot} L: <strong>~${minWater} a ${maxWater} L</strong> (10% a 15% del sustrato).</p>
        <div>
          <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">Productos de la Mezcla</label>
          <input id="log-products" type="text" placeholder="Ej: Fertilizante base + Melaza / Bioestimulante" class="ios-input w-full text-xs" />
        </div>
      `;
    } else if (type === 'foliar') {
      dyn.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">Tratamiento Foliar</label>
            <select id="log-foliar-type" class="ios-input w-full text-xs font-semibold">
              <option value="Aceite de Neem + Jabón Potásico">🌿 Neem + Jabón Potásico</option>
              <option value="Bacillus thuringiensis (Bt)">🐛 Bacillus thuringiensis</option>
              <option value="Jabón Potásico solo">🧼 Jabón Potásico solo</option>
              <option value="Bioestimulante (Algas)">🍃 Algas / Bioestimulante</option>
              <option value="Otro tratamiento">🧪 Otro tratamiento</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">Volumen</label>
            <input id="log-liters" type="number" step="0.5" value="1.0" class="ios-input w-full font-mono text-xs" />
          </div>
        </div>
      `;
    } else if (type === 'poda') {
      dyn.innerHTML = `
        <div>
          <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">Tipo de Intervención</label>
          <select id="log-prune-type" class="ios-input w-full text-xs font-semibold">
            <option value="Poda Apical">Poda Apical (Ápice principal)</option>
            <option value="Poda FIM">Poda FIM</option>
            <option value="Defoliación de bajos (Lollipop)">Defoliación de bajos (Lollipop)</option>
            <option value="LST (Low Stress Training)">LST / Guiado de ramas</option>
            <option value="Esquejes">Corte de esquejes</option>
          </select>
        </div>
      `;
    } else if (type === 'transplante') {
      dyn.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">Nueva Maceta</label>
            <input id="log-pot-size" type="text" placeholder="Ej: 15 L Geotextil" class="ios-input w-full text-xs" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-[#121e10] mb-1 uppercase">Sustrato</label>
            <input id="log-substrate" type="text" placeholder="Ej: Growmix + Micorrizas" class="ios-input w-full text-xs" />
          </div>
        </div>
      `;
    } else {
      dyn.innerHTML = '';
    }
  },

  async handleLogSubmit(e) {
    e.preventDefault();
    if (!this.activePlantId) return;

    const type = $('input-log-type').value;
    const dateTime = $('input-log-datetime').value;
    const notes = $('input-log-notes').value.trim();
    const healthUpdate = $('input-log-health-update')?.value;

    const metrics = {};
    if ($('log-liters')) metrics.liters = parseFloat($('log-liters').value) || undefined;
    if ($('log-ph')) metrics.ph = parseFloat($('log-ph').value) || undefined;
    if ($('log-ec')) metrics.ec = parseFloat($('log-ec').value) || undefined;
    if ($('log-products')) metrics.products = $('log-products').value.trim() || undefined;
    if ($('log-foliar-type')) metrics.foliarType = $('log-foliar-type').value;
    if ($('log-prune-type')) metrics.pruneType = $('log-prune-type').value;
    if ($('log-pot-size')) metrics.potSize = $('log-pot-size').value.trim() || undefined;

    if (healthUpdate && healthUpdate !== 'keep') {
      metrics.healthUpdate = healthUpdate;
      const plant = this.plants.find((p) => p.id === this.activePlantId);
      if (plant) {
        plant.healthStatus = healthUpdate;
        await Storage.savePlant(plant);
      }
    }

    const newLog = {
      id: 'log-' + Date.now(),
      plantId: this.activePlantId,
      type,
      dateTime: new Date(dateTime).toISOString(),
      notes,
      metrics,
      photo: this.pendingPhotoData || undefined
    };

    await Storage.saveLog(newLog);
    this.closeLogModal();
    await this.loadPlants();
    await this.renderTimeline();
    showToast('Entrada guardada en la bitácora');
  },

  openPlantModal(editPlant = null) {
    $('input-plant-id').value = editPlant ? editPlant.id : '';
    $('modal-plant-title').textContent = editPlant ? 'Editar Planta' : 'Nueva Planta';
    $('input-plant-name').value = editPlant ? editPlant.name : '';
    $('input-plant-strain').value = editPlant ? editPlant.strain : '';
    $('select-plant-type').value = editPlant ? editPlant.type : 'fotoperiodica';
    $('select-plant-medium').value = editPlant ? editPlant.medium : 'sustrato';
    $('input-plant-germ-date').value = editPlant ? editPlant.germDate : todayDateStr();
    $('select-plant-stage').value = editPlant ? editPlant.stage : 'vegetativo';
    if ($('select-plant-health')) $('select-plant-health').value = editPlant ? (editPlant.healthStatus || 'optima') : 'optima';
    if ($('input-plant-cycle-days')) $('input-plant-cycle-days').value = editPlant ? (editPlant.cycleDays || 140) : 140;

    const pot = editPlant?.potLiters || 15;
    $('input-plant-pot').value = pot;
    if ($('plant-pot-hint')) $('plant-pot-hint').textContent = `Riego sugerido: ~${(pot * 0.1).toFixed(1)} - ${(pot * 0.15).toFixed(1)} L`;

    if (editPlant && editPlant.coverPhoto) {
      $('plant-cover-preview-img').src = editPlant.coverPhoto;
      $('plant-cover-preview-box').classList.remove('hidden');
      $('input-plant-cover-photo').dataset.base64 = editPlant.coverPhoto;
    } else {
      $('plant-cover-preview-box').classList.add('hidden');
      delete $('input-plant-cover-photo').dataset.base64;
    }

    $('modal-plant-form').classList.remove('hidden');
    $('modal-plant-form').classList.add('flex');
  },

  closePlantModal() {
    $('modal-plant-form').classList.add('hidden');
    $('modal-plant-form').classList.remove('flex');
  },

  async handlePlantSubmit(e) {
    e.preventDefault();
    const id = $('input-plant-id').value || 'plant-' + Date.now();
    const name = $('input-plant-name').value.trim();
    const strain = $('input-plant-strain').value.trim();
    const type = $('select-plant-type').value;
    const medium = $('select-plant-medium').value;
    const potLiters = parseFloat($('input-plant-pot').value) || 15;
    const germDate = $('input-plant-germ-date').value;
    const stage = $('select-plant-stage').value;
    const healthStatus = $('select-plant-health')?.value || 'optima';
    const cycleDays = parseInt($('input-plant-cycle-days')?.value) || (type === 'automatica' ? 80 : 140);
    const coverPhoto = $('input-plant-cover-photo').dataset.base64 || undefined;

    const plant = {
      id,
      name,
      strain,
      type,
      medium,
      potLiters,
      cycleDays,
      healthStatus,
      germDate,
      stage,
      coverPhoto,
      createdAt: new Date().toISOString()
    };

    await Storage.savePlant(plant);
    this.closePlantModal();
    await this.loadPlants();

    if (this.activePlantId === id) {
      this.renderPlantHero(plant);
    }
    showToast(id === $('input-plant-id').value ? 'Planta actualizada' : 'Planta guardada');
  },

  openLightbox(src, caption) {
    $('lightbox-img').src = src;
    $('lightbox-caption').textContent = caption || '';
    $('lightbox-modal').classList.remove('hidden');
    $('lightbox-modal').classList.add('flex');
  }
};

/* ==========================================================================
   6. MÓDULO RIEGO & NUTRIENTES (CALCULADORA MINIMALISTA)
   ========================================================================== */
const BRANDS = {
  topcrop: {
    name: 'Top Crop',
    type: 'Bio-mineral',
    products: [
      { name: 'Deeper Underground', role: 'Enraizante', unit: 'ml', doses: { plantula: 1.5, vegetativo: 1, transicion: 0, flora_temprana: 0, flora_tardia: 0 } },
      { name: 'Top Veg', role: 'Base Crecimiento (N)', unit: 'ml', doses: { plantula: 1, vegetativo: 3, transicion: 2, flora_temprana: 0, flora_tardia: 0 } },
      { name: 'Top Bloom', role: 'Base Floración (P-K)', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 2, flora_temprana: 3, flora_tardia: 4 } },
      { name: 'Big One', role: 'Bioestimulante', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 2, flora_temprana: 2, flora_tardia: 0 } },
      { name: 'Top Candy', role: 'Azúcares & Resina', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 1, flora_temprana: 2, flora_tardia: 2 } },
      { name: 'Top Bud', role: 'Engorde PK', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 0, flora_temprana: 0, flora_tardia: 1 } }
    ]
  },
  namaste: {
    name: 'Namaste',
    type: 'Orgánica',
    products: [
      { name: 'Amazonia Roots', role: 'Micorrizas & Tricodermas', unit: 'g', doses: { plantula: 1, vegetativo: 1, transicion: 0, flora_temprana: 0, flora_tardia: 0 } },
      { name: 'Oro Negro', role: 'Húmicos & Crecimiento', unit: 'ml', doses: { plantula: 1, vegetativo: 2, transicion: 2, flora_temprana: 0, flora_tardia: 0 } },
      { name: 'Trico+', role: 'Melazas & Resina', unit: 'g', doses: { plantula: 0, vegetativo: 0, transicion: 0, flora_temprana: 1, flora_tardia: 1 } },
      { name: 'Flora Booster', role: 'PK Potenciador', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 0, flora_temprana: 2, flora_tardia: 3 } }
    ]
  },
  kawsay: {
    name: 'Kawsay',
    type: 'Mineral',
    products: [
      { name: 'Base A', role: 'Calcio + Nitrógeno', unit: 'ml', doses: { plantula: 0.5, vegetativo: 1.5, transicion: 1.5, flora_temprana: 2, flora_tardia: 2 } },
      { name: 'Base B', role: 'Magnesio + Micros', unit: 'ml', doses: { plantula: 0.5, vegetativo: 1.5, transicion: 1.5, flora_temprana: 2, flora_tardia: 2 } },
      { name: 'Vege', role: 'NPK Vegetativo', unit: 'ml', doses: { plantula: 0.5, vegetativo: 1.5, transicion: 1, flora_temprana: 0, flora_tardia: 0 } },
      { name: 'Bloom', role: 'Fósforo + Potasio', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 1, flora_temprana: 2, flora_tardia: 2.5 } }
    ]
  },
  advanced: {
    name: 'Advanced Nutrients',
    type: 'pH Perfect Mineral',
    products: [
      { name: 'pH Perfect Micro', role: 'Base Micros', unit: 'ml', doses: { plantula: 1, vegetativo: 3, transicion: 4, flora_temprana: 4, flora_tardia: 4 } },
      { name: 'pH Perfect Grow', role: 'Base Nitrógeno', unit: 'ml', doses: { plantula: 1, vegetativo: 3, transicion: 4, flora_temprana: 4, flora_tardia: 4 } },
      { name: 'pH Perfect Bloom', role: 'Base Fósforo/Potasio', unit: 'ml', doses: { plantula: 1, vegetativo: 3, transicion: 4, flora_temprana: 4, flora_tardia: 4 } },
      { name: 'Big Bud', role: 'Booster de Flores', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 0, flora_temprana: 2, flora_tardia: 0 } },
      { name: 'Bud Candy', role: 'Carbohidratos', unit: 'ml', doses: { plantula: 0, vegetativo: 0, transicion: 2, flora_temprana: 2, flora_tardia: 2 } }
    ]
  }
};

const CalculatorModule = {
  liters: 5,
  brand: 'topcrop',
  stage: 'vegetativo',
  mode: 'outdoor',

  init() {
    $('input-liters').value = this.liters;
    $('input-liters').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (!isNaN(v) && v > 0) {
        this.liters = v;
        this.render();
      }
    });

    $('btn-liters-dec').addEventListener('click', () => {
      this.liters = Math.max(0.5, this.liters - 0.5);
      $('input-liters').value = this.liters;
      this.render();
    });
    $('btn-liters-inc').addEventListener('click', () => {
      this.liters = Math.min(500, this.liters + 0.5);
      $('input-liters').value = this.liters;
      this.render();
    });

    document.querySelectorAll('.liter-preset-btn').forEach((b) => {
      b.addEventListener('click', () => {
        this.liters = Number(b.dataset.liters);
        $('input-liters').value = this.liters;
        this.render();
      });
    });

    // Cálculo interactivo de riego promedio según maceta (10% - 15%)
    const updatePotIrrigationCalc = () => {
      const pot = parseFloat($('calc-pot-size')?.value) || 15;
      const qty = parseInt($('calc-plants-qty')?.value) || 1;
      const single = (pot * 0.15).toFixed(2);
      const total = (pot * 0.15 * qty).toFixed(1);
      if ($('calc-pot-single-vol')) $('calc-pot-single-vol').textContent = `${single} L`;
      if ($('calc-pot-total-vol')) $('calc-pot-total-vol').textContent = `${total} L`;
    };

    $('calc-pot-size')?.addEventListener('input', updatePotIrrigationCalc);
    $('calc-plants-qty')?.addEventListener('input', updatePotIrrigationCalc);

    $('btn-apply-pot-irrigation')?.addEventListener('click', () => {
      const pot = parseFloat($('calc-pot-size')?.value) || 15;
      const qty = parseInt($('calc-plants-qty')?.value) || 1;
      const total = parseFloat((pot * 0.15 * qty).toFixed(1));
      this.liters = total;
      $('input-liters').value = this.liters;
      this.render();
      showToast(`💧 Riego calculado: ${total} L (${qty} maceta(s) de ${pot} L)`);
    });

    updatePotIrrigationCalc();

    $('brand-cards-grid').addEventListener('click', (e) => {
      const card = e.target.closest('[data-brand]');
      if (!card) return;
      this.brand = card.dataset.brand;
      this.render();
    });

    $('select-stage').addEventListener('change', (e) => {
      this.stage = e.target.value;
      this.render();
    });

    document.querySelectorAll('[data-mode-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.modeBtn;
        document.querySelectorAll('[data-mode-btn]').forEach((b) => b.classList.toggle('active', b === btn));
        this.renderMode();
      });
    });

    $('btn-calc-log-to-plant').addEventListener('click', () => {
      if (!GrowlogsModule.plants.length) {
        showToast('No tenés plantas creadas');
        return;
      }
      const plant = GrowlogsModule.activePlantId
        ? GrowlogsModule.plants.find((p) => p.id === GrowlogsModule.activePlantId)
        : GrowlogsModule.plants[0];

      if (!plant) return;
      GrowlogsModule.activePlantId = plant.id;

      const brandData = BRANDS[this.brand];
      const prods = brandData.products
        .filter((p) => p.doses[this.stage] > 0)
        .map((p) => `${p.name} (${(p.doses[this.stage] * this.liters).toFixed(1)}${p.unit})`)
        .join(' + ');

      GrowlogsModule.openLogModal('riego_nutrientes');
      setTimeout(() => {
        if ($('log-liters')) $('log-liters').value = this.liters;
        if ($('log-products')) $('log-products').value = prods;
      }, 50);
    });

    this.renderMode();
    this.render();
  },

  renderMode() {
    const cont = $('mode-timeline-container');
    if (this.mode === 'outdoor') {
      cont.innerHTML = `
        <div class="ios-card p-3.5 text-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#384933]">Outdoor Hemisferio Sur</span>
            <span class="font-mono text-[11px] text-[#5c6f56] font-semibold">Buenos Aires / Argentina</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
            <div class="rounded-xl bg-[#edf2e2] border border-[#2d4123]/10 p-2">
              <span class="text-[9px] uppercase font-bold text-[#5c6f56] block">Sept / Oct</span>
              <strong class="text-[#121e10] text-xs block font-bold">🌱 Germinación</strong>
            </div>
            <div class="rounded-xl bg-[#edf2e2] border border-[#2d4123]/10 p-2">
              <span class="text-[9px] uppercase font-bold text-[#5c6f56] block">Nov – Ene</span>
              <strong class="text-[#121e10] text-xs block font-bold">🌿 Vegetativo</strong>
            </div>
            <div class="rounded-xl bg-[#edf2e2] border border-[#2d4123]/10 p-2">
              <span class="text-[9px] uppercase font-bold text-[#5c6f56] block">Febrero</span>
              <strong class="text-[#121e10] text-xs block font-bold">⚡ Pre-flora</strong>
            </div>
            <div class="rounded-xl bg-[#edf2e2] border border-[#2d4123]/10 p-2">
              <span class="text-[9px] uppercase font-bold text-[#5c6f56] block">Mar / Abr</span>
              <strong class="text-[#121e10] text-xs block font-bold">💎 Cosecha</strong>
            </div>
          </div>
        </div>
      `;
    } else {
      cont.innerHTML = `
        <div class="ios-card p-3.5 text-xs space-y-1 text-[#384933]">
          <span class="text-[10px] font-bold uppercase tracking-wider text-[#121e10] block">Modo Indoor (Semanas)</span>
          <p>Fotoperíodo <strong>18/6</strong> para crecimiento vegetativo y <strong>12/12</strong> para inducir y sostener la floración.</p>
        </div>
      `;
    }
  },

  render() {
    $('brand-cards-grid').innerHTML = Object.entries(BRANDS).map(([k, b]) => {
      const active = k === this.brand;
      return `
        <button type="button" data-brand="${k}"
          class="rounded-xl border p-2.5 text-left transition ${
            active ? 'border-[#182e14] bg-[#182e14] text-white font-bold shadow-sm' : 'border-[#2d4123]/15 bg-[#edf2e2] text-[#384933] hover:text-[#121e10]'
          }">
          <div class="text-xs leading-tight font-bold">${b.name}</div>
          <div class="text-[10px] opacity-80 font-medium">${b.type}</div>
        </button>
      `;
    }).join('');

    const brandData = BRANDS[this.brand];
    $('result-title').textContent = `${brandData.name} · ${STAGES[this.stage].label}`;
    $('result-subtitle').textContent = `Dosis calculadas para ${this.liters} litros de agua`;

    const tbody = $('fertilizer-table-body');
    const rows = brandData.products.filter((p) => p.doses[this.stage] > 0);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-[#5c6f56] italic">Sin productos para esta etapa.</td></tr>`;
    } else {
      tbody.innerHTML = rows.map((p) => {
        const dose = p.doses[this.stage];
        const total = (dose * this.liters).toFixed(1);
        return `
          <tr class="hover:bg-[#2d4123]/5">
            <td class="py-2 pr-2 text-[#121e10] font-bold">${p.name} <span class="text-[10px] text-[#5c6f56] block font-normal">${p.role}</span></td>
            <td class="py-2 px-2 text-right font-mono text-[#384933] font-semibold">${dose} ${p.unit}/L</td>
            <td class="py-2 pl-2 text-right font-mono font-bold text-[#182e14]">${total} ${p.unit}</td>
          </tr>
        `;
      }).join('');
    }

    $('mixing-protocol-box').innerHTML = `
      Mezclá bien cada producto en el agua antes de incorporar el siguiente. Medí y ajustá el pH al final (6.0 a 6.5 en veg / 6.3 a 6.8 en flora).
    `;
  }
};

/* ==========================================================================
   7. MÓDULO CALENDARIO LUNAR (POÉTICO & MINIMALISTA)
   ========================================================================== */
const LunarModule = {
  year: 2026,
  month: 10,

  init() {
    const selM = $('select-lunar-month');
    const selY = $('select-lunar-year');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    selM.innerHTML = months.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    selY.innerHTML = `<option value="2026">2026</option><option value="2027">2027</option>`;

    selM.value = this.month;
    selY.value = this.year;

    selM.addEventListener('change', (e) => { this.month = Number(e.target.value); this.render(); });
    selY.addEventListener('change', (e) => { this.year = Number(e.target.value); this.render(); });

    $('btn-lunar-prev').addEventListener('click', () => {
      this.month--;
      if (this.month < 0) { this.month = 11; this.year--; }
      if (this.year < 2026) { this.year = 2026; this.month = 0; }
      selM.value = this.month; selY.value = this.year;
      this.render();
    });

    $('btn-lunar-next').addEventListener('click', () => {
      this.month++;
      if (this.month > 11) { this.month = 0; this.year++; }
      if (this.year > 2027) { this.year = 2027; this.month = 11; }
      selM.value = this.month; selY.value = this.year;
      this.render();
    });

    this.render();
  },

  render() {
    $('lunar-hero-svg').innerHTML = `
      <svg viewBox="0 0 100 100" class="h-16 w-16">
        <circle cx="50" cy="50" r="44" fill="#ffffff" stroke="rgba(45,65,35,0.2)" stroke-width="2"/>
        <path d="M 50 6 A 44 44 0 0 0 50 94 A 12 44 0 0 1 50 6" fill="#182e14"/>
      </svg>
    `;

    $('lunar-phase-title').textContent = 'Cuarto Menguante';
    $('lunar-phase-meta').textContent = 'Descenso de savia hacia las raíces';

    $('lunar-day-recommendation').innerHTML = `
      <span class="badge-mono text-[10px]">Labores recomendadas</span>
      <p class="text-[#121e10] font-bold text-xs mt-1">Podas, Trasplantes y Esquejes</p>
      <p class="text-[#384933] text-[11px] mt-0.5">La savia desciende: menor estrés por herida y cicatrización celular rápida.</p>
    `;

    $('lunar-task-cards').innerHTML = `
      <div class="ios-card p-3 space-y-1 text-xs">
        <span class="text-[#121e10] font-bold">🌱 Creciente / Llena</span>
        <p class="text-[#384933] font-medium">Germinación &amp; Foliares</p>
        <p class="text-[11px] text-[#5c6f56]">Savia en ramas y hojas.</p>
      </div>
      <div class="ios-card p-3 space-y-1 text-xs border-[#2d4123]/25 bg-[#f9fbf5]">
        <span class="text-[#121e10] font-bold">✂️ Cuarto Menguante</span>
        <p class="text-[#384933] font-medium">Podas &amp; Trasplantes</p>
        <p class="text-[11px] text-[#5c6f56]">Savia en raíces.</p>
      </div>
      <div class="ios-card p-3 space-y-1 text-xs">
        <span class="text-[#121e10] font-bold">🌾 Luna Nueva</span>
        <p class="text-[#384933] font-medium">Cosecha &amp; Reposo</p>
        <p class="text-[11px] text-[#5c6f56]">Menor humedad interna.</p>
      </div>
    `;

    const grid = $('lunar-calendar-grid');
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();
    const firstDay = (new Date(this.year, this.month, 1).getDay() + 6) % 7;

    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const isKey = d === 9 || d === 17 || d === 24;
      cells += `
        <div class="ios-card p-1 text-center min-h-[2.8rem] flex flex-col justify-between ${isKey ? 'border-[#182e14] bg-[#edf2e2]' : ''}">
          <span class="text-[11px] font-mono font-bold text-[#121e10]">${d}</span>
          <span class="text-[9px] text-[#121e10]">${d === 9 ? '🌑' : d === 17 ? '🌓' : d === 24 ? '🌕' : '·'}</span>
        </div>
      `;
    }
    grid.innerHTML = cells;
  }
};

/* ==========================================================================
   8. MÓDULO SALUD, DIAGNÓSTICO & PREVENCIÓN (MIP + TRICOMAS)
   ========================================================================== */
const DiagnosticModule = {
  activeSubview: 'diagnostico',
  activeCategory: 'all',

  init() {
    // Segmented switcher de Salud
    $('health-subview-segmented')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-health-subview]');
      if (!btn) return;
      this.activeSubview = btn.dataset.healthSubview;
      document.querySelectorAll('#health-subview-segmented button').forEach((b) => b.classList.toggle('active', b === btn));
      this.switchSubview(this.activeSubview);
    });

    // Filtros de categoría de diagnóstico
    $('diagnostic-category-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-diag-cat]');
      if (!btn) return;
      this.activeCategory = btn.dataset.diagCat;
      document.querySelectorAll('#diagnostic-category-filters button').forEach((b) => {
        b.className = b === btn ? 'badge-mono badge-mono-inverted cursor-pointer' : 'badge-mono cursor-pointer';
      });
      this.renderDiagnosticCards();
    });

    // MIP inputs
    $('input-pest-last-date')?.addEventListener('change', () => this.renderMip());
    $('select-pest-interval')?.addEventListener('change', () => this.renderMip());
    $('select-sprayer-liters')?.addEventListener('change', () => this.renderMip());

    if ($('input-pest-last-date')) $('input-pest-last-date').value = todayDateStr();

    this.renderDiagnosticCards();
    this.renderMip();
    this.renderTrichomes();
  },

  switchSubview(view) {
    $('subview-health-diagnostico')?.classList.toggle('hidden', view !== 'diagnostico');
    $('subview-health-mip')?.classList.toggle('hidden', view !== 'mip');
    $('subview-health-tricomas')?.classList.toggle('hidden', view !== 'tricomas');
  },

  renderDiagnosticCards() {
    const grid = $('diagnostic-cards-grid');
    if (!grid) return;

    let items = DIAGNOSTIC_GUIDE;
    if (this.activeCategory !== 'all') {
      items = items.filter((d) => d.category === this.activeCategory);
    }

    grid.innerHTML = items.map((diag) => {
      return `
        <div class="diagnostic-card flex flex-col justify-between">
          <div class="space-y-3">
            <!-- Ilustración Vectorial Superior -->
            <div class="diagnostic-svg-wrap p-2 flex items-center justify-center">
              ${diag.svg}
            </div>

            <!-- Cabecera de la Ficha -->
            <div class="px-4 pt-1 space-y-1">
              <div class="flex items-center justify-between gap-2">
                <span class="${diag.badgeClass} text-[10px] !py-0.5 !px-2.5 rounded-full">${diag.severity}</span>
                <span class="text-[10px] font-mono text-[#5c6f56] font-bold capitalize">${diag.category}</span>
              </div>
              <h3 class="text-base font-bold text-[#121e10] tracking-tight">${esc(diag.title)}</h3>
              <p class="text-[11px] text-[#5c6f56] flex items-center gap-1 font-medium">
                <span>📍</span>
                <span>${esc(diag.location)}</span>
              </p>
            </div>

            <!-- Síntomas & Diagnóstico Agronómico -->
            <div class="px-4 text-xs space-y-2 text-[#384933]">
              <p class="leading-relaxed text-[11px] text-[#384933] font-medium">${esc(diag.symptoms)}</p>
              <div class="rounded-xl bg-[#edf2e2] p-2.5 border border-[#2d4123]/10 space-y-1 text-[11px]">
                <strong class="text-[#121e10] block text-[10px] uppercase font-bold tracking-wider">Causa Principal:</strong>
                <p class="text-[#384933] leading-snug">${esc(diag.causes)}</p>
              </div>
              <div class="rounded-xl bg-[#edf2e2] border border-[#2d4123]/15 p-2.5 space-y-1 text-[11px]">
                <strong class="text-[#121e10] block text-[10px] uppercase font-bold tracking-wider">Protocolo de Corrección:</strong>
                <p class="text-[#121e10] whitespace-pre-line leading-relaxed font-medium">${esc(diag.solution)}</p>
              </div>
            </div>
          </div>

          <!-- Botón de Asignación a Planta Activa -->
          <div class="p-4 pt-3 border-t border-[#2d4123]/10 mt-3">
            <button type="button" class="ios-btn ios-btn-secondary w-full text-xs !py-2 font-bold"
              onclick="DiagnosticModule.assignToActivePlant('${diag.id}')">
              <span>Asignar diagnóstico a mi planta</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async assignToActivePlant(diagId) {
    if (!GrowlogsModule.plants.length) {
      showToast('No tenés plantas creadas');
      return;
    }
    const plant = GrowlogsModule.activePlantId
      ? GrowlogsModule.plants.find((p) => p.id === GrowlogsModule.activePlantId)
      : GrowlogsModule.plants[0];

    if (!plant) return;
    const diag = DIAGNOSTIC_GUIDE.find((d) => d.id === diagId);
    if (!diag) return;

    plant.healthStatus = diagId;
    await Storage.savePlant(plant);

    // Registra automáticamente en la bitácora
    await Storage.saveLog({
      id: 'log-' + Date.now(),
      plantId: plant.id,
      type: 'nota_foto',
      dateTime: new Date().toISOString(),
      notes: `🩺 Diagnóstico visual aplicado: ${diag.title}.\nUbicación: ${diag.location}.\nProtocolo: ${diag.solution.split('\n')[0]}`,
      metrics: {
        healthUpdate: diagId
      }
    });

    await GrowlogsModule.loadPlants();
    if (GrowlogsModule.activePlantId === plant.id) {
      GrowlogsModule.renderPlantHero(plant);
      await GrowlogsModule.renderTimeline();
    }
    showToast(`✓ Salud de ${plant.name}: ${diag.title}`);
  },

  renderMip() {
    const liters = parseFloat($('select-sprayer-liters')?.value) || 1;
    const interval = parseInt($('select-pest-interval')?.value) || 12;

    if ($('pest-alert-card')) {
      $('pest-alert-card').innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <div>
            <span class="badge-mono text-[10px]">Prevención Activa MIP</span>
            <h3 class="text-base font-bold text-[#121e10] mt-1">Rutina biológica cada ${interval} días</h3>
            <p class="text-xs text-[#5c6f56]">Pulverizar con pulverizador de ${liters} L al caer el sol o al apagar las luces.</p>
          </div>
          <span class="text-2xl">🛡️</span>
        </div>
      `;
    }

    if ($('pest-biocontrol-cards')) {
      $('pest-biocontrol-cards').innerHTML = `
        <div class="ios-card p-4 space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <strong class="text-[#121e10] text-sm font-bold">🌿 Aceite de Neem + Jabón Potásico</strong>
            <span class="badge-mono text-[10px]">Vegetativo</span>
          </div>
          <p class="text-[#5c6f56]">Dosis para tu pulverizador de <strong>${liters} L</strong>:</p>
          <div class="flex gap-2 font-mono">
            <span class="badge-mono text-[#121e10] font-bold">${(2 * liters).toFixed(1)} ml Neem</span>
            <span class="badge-mono text-[#121e10] font-bold">${(5 * liters).toFixed(1)} ml Jabón Potásico</span>
          </div>
          <p class="text-[#384933] text-[11px] mt-1 leading-relaxed">
            Emulsionar primero el jabón potásico en agua tibia y luego incorporar el neem. Aplicar en haz y envés de las hojas. Previene trips, arañuela y mosca blanca.
          </p>
        </div>

        <div class="ios-card p-4 space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <strong class="text-[#121e10] text-sm font-bold">🐛 Bacillus thuringiensis (Bt)</strong>
            <span class="badge-mono text-[10px]">Floración Outdoor</span>
          </div>
          <p class="text-[#5c6f56]">Dosis para tu pulverizador de <strong>${liters} L</strong>:</p>
          <div class="font-mono">
            <span class="badge-mono text-[#121e10] font-bold">${(1 * liters).toFixed(1)} g Bt en polvo</span>
          </div>
          <p class="text-[#384933] text-[11px] mt-1 leading-relaxed">
            Bacteria benéfica que actúa por ingestión contra orugas e isocas. Vital en exterior para evitar que las orugas perforen los cogollos y causen pudrición (botrytis).
          </p>
        </div>
      `;
    }
  },

  renderTrichomes() {
    const grid = $('trichomes-stages-grid');
    if (!grid) return;

    grid.innerHTML = TRICHOMES_GUIDE.map((t) => {
      return `
        <div class="ios-card p-4 space-y-3 flex flex-col justify-between">
          <div class="space-y-2">
            <div class="rounded-xl bg-[#edf2e2] p-2 border border-[#2d4123]/10">
              ${t.svg}
            </div>
            <div>
              <span class="${t.badgeClass} text-[10px] !py-0.5 !px-2.5 rounded-full font-bold">${t.status}</span>
              <h4 class="text-sm font-bold text-[#121e10] mt-1">${t.title}</h4>
              <p class="text-[11px] text-[#5c6f56] mt-0.5 font-medium">${t.desc}</p>
            </div>
            <p class="text-[11px] text-[#384933] leading-relaxed font-medium">${t.effect}</p>
          </div>
        </div>
      `;
    }).join('');
  }
};

/* ==========================================================================
   9. MÓDULO EXPORTACIÓN & BACKUP OFFLINE
   ========================================================================== */
const BackupModule = {
  init() {
    $('btn-backup-export')?.addEventListener('click', async () => {
      const plants = await Storage.getPlants();
      const logs = await Storage.getAllLogs();
      const data = { version: 1, exportedAt: new Date().toISOString(), plants, logs };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cannasur-bitacora-${todayDateStr()}.json`;
      a.click();
      showToast('Copia JSON descargada');
    });

    $('input-backup-import')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.plants && Array.isArray(data.plants)) {
          for (const p of data.plants) await Storage.savePlant(p);
        }
        if (data.logs && Array.isArray(data.logs)) {
          for (const l of data.logs) await Storage.saveLog(l);
        }
        await GrowlogsModule.loadPlants();
        showToast('Copia restaurada con éxito');
      } catch {
        showToast('Archivo no válido');
      }
    });

    $('btn-reset-app')?.addEventListener('click', async () => {
      if (!confirm('¿Restablecer todo a valores de fábrica? Se borrarán tus datos locales.')) return;
      localStorage.clear();
      if (window.indexedDB) {
        indexedDB.deleteDatabase(DB_NAME);
      }
      location.reload();
    });

    $('btn-open-export')?.addEventListener('click', () => {
      $('export-modal').classList.remove('hidden');
      $('export-modal').classList.add('flex');
      this.drawCanvas();
    });
    $('btn-close-export')?.addEventListener('click', () => {
      $('export-modal').classList.add('hidden');
      $('export-modal').classList.remove('flex');
    });

    $('btn-download-png')?.addEventListener('click', () => {
      const canvas = $('routine-export-canvas');
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `cannasur-resumen-${todayDateStr()}.png`;
      a.click();
      showToast('Imagen guardada');
    });

    $('btn-download-pdf')?.addEventListener('click', () => {
      const canvas = $('routine-export-canvas');
      if (window.jspdf && window.jspdf.jsPDF) {
        const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 10, 10, 190, 240);
        pdf.save(`cannasur-reporte-${todayDateStr()}.pdf`);
        showToast('PDF guardado');
      } else {
        window.print();
      }
    });
  },

  drawCanvas() {
    const canvas = $('routine-export-canvas');
    if (!canvas) return;
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');

    // Fondo verde amarillento claro blancuzco
    ctx.fillStyle = '#f4f6ec';
    ctx.fillRect(0, 0, 800, 1000);

    ctx.fillStyle = '#121e10';
    ctx.font = 'bold 28px -apple-system, sans-serif';
    ctx.fillText('CannaSur — Resumen de Bitácora & Cultivo', 40, 60);

    ctx.fillStyle = '#5c6f56';
    ctx.font = '15px monospace';
    ctx.fillText(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 40, 95);

    // Tarjeta 1
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(40, 120, 720, 200);

    ctx.fillStyle = '#121e10';
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.fillText('🌱 Plantas en Seguimiento:', 60, 160);

    ctx.font = '15px -apple-system, sans-serif';
    ctx.fillStyle = '#384933';
    let y = 195;
    GrowlogsModule.plants.slice(0, 4).forEach((p) => {
      const days = daysDiff(p.germDate, todayDateStr());
      const health = HEALTH_STATES[p.healthStatus] || HEALTH_STATES.optima;
      ctx.fillText(`• ${p.name} (${p.strain || p.type}) — Día ${days} (${STAGES[p.stage].label}) [${health.label}]`, 60, y);
      y += 28;
    });

    // Tarjeta 2
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(40, 350, 720, 220);
    ctx.fillStyle = '#121e10';
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.fillText('💧 Riego y Nutrición Calculada:', 60, 390);

    ctx.fillStyle = '#384933';
    ctx.font = '15px -apple-system, sans-serif';
    ctx.fillText(`Línea: ${BRANDS[CalculatorModule.brand].name} · Etapa: ${STAGES[CalculatorModule.stage].label}`, 60, 425);
    ctx.fillText(`Volumen: ${CalculatorModule.liters} Litros`, 60, 455);
  }
};

/* ==========================================================================
   10. NAVEGACIÓN PRINCIPAL SPA (APPLE TAB BAR)
   ========================================================================== */
const App = {
  currentView: 'growlogs',

  async init() {
    await Storage.init();
    await GrowlogsModule.init();
    await RemindersModule.init();
    CalculatorModule.init();
    LunarModule.init();
    DiagnosticModule.init();
    BackupModule.init();

    document.querySelectorAll('[data-nav-target]').forEach((btn) => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.navTarget));
    });

    const hash = location.hash.replace('#', '');
    if (hash && $(`view-${hash}`)) this.navigate(hash, false);
  },

  navigate(viewId, pushHash = true) {
    this.currentView = viewId;
    document.querySelectorAll('.app-view').forEach((v) => {
      v.classList.toggle('active', v.id === `view-${viewId}`);
    });

    document.querySelectorAll('[data-nav-target]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.navTarget === viewId);
    });

    if (pushHash) history.replaceState(null, '', `#${viewId}`);

    if (viewId === 'growlogs' && !GrowlogsModule.activePlantId) {
      GrowlogsModule.showDashboard();
    }

    if (viewId === 'calculadora') {
      const activePlant = GrowlogsModule.plants.find((p) => p.id === GrowlogsModule.activePlantId) || GrowlogsModule.plants[0];
      if (activePlant && activePlant.potLiters && $('calc-pot-size')) {
        $('calc-pot-size').value = activePlant.potLiters;
        const qty = parseInt($('calc-plants-qty')?.value) || 1;
        const single = (activePlant.potLiters * 0.15).toFixed(2);
        const total = (activePlant.potLiters * 0.15 * qty).toFixed(1);
        if ($('calc-pot-single-vol')) $('calc-pot-single-vol').textContent = `${single} L`;
        if ($('calc-pot-total-vol')) $('calc-pot-total-vol').textContent = `${total} L`;
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
