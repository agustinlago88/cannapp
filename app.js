/* ==========================================================================
   CannaSur AR — Bitácora de Cultivo (Growlogs) & Asistente Offline
   Inspirado en "Grow with Jane": minimalista, offline-first y táctil.
   ========================================================================== */
'use strict';

/* ==========================================================================
   1. CONSTANTES & CONFIGURACIONES GLOBALES
   ========================================================================== */
const TZ_OFFSET_MS = 3 * 3600 * 1000; // Argentina UTC-3
const DAY_MS = 86400000;
const DB_NAME = 'CannaSurDB';
const DB_VERSION = 1;

const STAGES = {
  plantula: { label: 'Plántula', emoji: '🌱', badgeClass: 'stage-badge-plantula', desc: 'Enraizamiento y primeras hojas verdaderas' },
  vegetativo: { label: 'Vegetativo', emoji: '🌿', badgeClass: 'stage-badge-vegetativo', desc: 'Crecimiento de ramas y follaje' },
  transicion: { label: 'Transición', emoji: '⚡', badgeClass: 'stage-badge-transicion', desc: 'Pre-floración y estiramiento (stretch)' },
  floracion: { label: 'Floración', emoji: '🌸', badgeClass: 'stage-badge-floracion', desc: 'Formación y engorde de cogollos' },
  cosecha: { label: 'Cosecha', emoji: '💎', badgeClass: 'stage-badge-cosecha', desc: 'Maduración de tricomas y secado' }
};

const LOG_TYPES = {
  riego_agua: { label: 'Riego con Agua', icon: '💧', color: 'text-cyan-300', border: 'border-cyan-400/40', bg: 'bg-cyan-500/15' },
  riego_nutrientes: { label: 'Riego con Nutrientes', icon: '🧪', color: 'text-emerald-300', border: 'border-emerald-400/40', bg: 'bg-emerald-500/15' },
  foliar: { label: 'Aplicación Foliar', icon: '🌿', color: 'text-lime-300', border: 'border-lime-400/40', bg: 'bg-lime-500/15' },
  poda: { label: 'Poda / LST', icon: '✂️', color: 'text-purple-300', border: 'border-purple-400/40', bg: 'bg-purple-500/15' },
  transplante: { label: 'Transplante', icon: '🪴', color: 'text-amber-300', border: 'border-amber-400/40', bg: 'bg-amber-500/15' },
  cambio_etapa: { label: 'Cambio de Etapa', icon: '🌸', color: 'text-pink-300', border: 'border-pink-400/40', bg: 'bg-pink-500/15' },
  nota_foto: { label: 'Foto / Nota', icon: '📷', color: 'text-sky-300', border: 'border-sky-400/40', bg: 'bg-sky-500/15' }
};

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
  $('app-toast-text').textContent = msg;
  el.style.opacity = '1';
  el.style.transform = 'translate(-50%, 8px)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, 0)';
  }, 2300);
}

/* Redimensionar y comprimir imágenes vía Canvas (mantiene la app rápida y ligera) */
function compressImage(file, maxWidth = 1000, quality = 0.78) {
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
   3. GESTOR DE ALMACENAMIENTO OFFLINE (IndexedDB con fallback a localStorage)
   ========================================================================== */
const Storage = {
  db: null,

  async init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB no soportado, usando localStorage');
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
      req.onerror = () => {
        console.warn('Fallo al abrir IndexedDB, usando localStorage');
        resolve();
      };
    });
  },

  /* Plantas */
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
        // Borrar logs asociados
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

  /* Logs / Eventos */
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

  /* Semilla inicial para pruebas inmediatas si la base está vacía */
  async seedIfEmpty() {
    const plants = await this.getPlants();
    if (plants.length > 0) return;

    const germDate = new Date(Date.now() - 36 * DAY_MS).toISOString().split('T')[0];
    const demoPlant = {
      id: 'demo-plant-1',
      name: 'Gorilla Glue #4',
      strain: 'Gorilla Glue #4 (Feminizada)',
      type: 'fotoperiodica',
      medium: 'sustrato',
      germDate: germDate,
      stage: 'vegetativo',
      stageDate: germDate,
      createdAt: new Date().toISOString()
    };
    await this.savePlant(demoPlant);

    const logs = [
      {
        id: 'log-1',
        plantId: demoPlant.id,
        type: 'transplante',
        dateTime: new Date(Date.now() - 34 * DAY_MS).toISOString(),
        notes: 'Semilla germinada con éxito en servilleta. Trasplante a maceta de 1L con sustrato liviano.',
        metrics: { potSize: '1 L' }
      },
      {
        id: 'log-2',
        plantId: demoPlant.id,
        type: 'riego_nutrientes',
        dateTime: new Date(Date.now() - 14 * DAY_MS).toISOString(),
        notes: 'Primer riego nutricional con Amazonia Roots (micorrizas) y Deeper Underground para estimular el cepellón de raíces.',
        metrics: { liters: 1.5, ph: 6.2, ec: 0.9, products: 'Amazonia 1g/L + Deeper Underground 1.5ml/L' }
      },
      {
        id: 'log-3',
        plantId: demoPlant.id,
        type: 'poda',
        dateTime: new Date(Date.now() - 6 * DAY_MS).toISOString(),
        notes: 'Poda apical en el 4to nudo para fomentar ramificación lateral. Excelente cicatrización y vigor.',
        metrics: { pruneType: 'Poda Apical' }
      },
      {
        id: 'log-4',
        plantId: demoPlant.id,
        type: 'foliar',
        dateTime: new Date(Date.now() - 2 * DAY_MS).toISOString(),
        notes: 'Aplicación foliar preventiva al atardecer: Aceite de Neem + Jabón Potásico en el envés de las hojas.',
        metrics: { foliarType: 'Aceite de Neem + Jabón Potásico', liters: 1.0 }
      }
    ];

    for (const log of logs) {
      await this.saveLog(log);
    }
  }
};

/* ==========================================================================
   4. MÓDULO GROWLOGS (BITÁCORA DE PLANTAS)
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

    // Eventos del Dashboard
    $('btn-top-new-plant').addEventListener('click', () => this.openPlantModal());
    $('btn-empty-add-plant')?.addEventListener('click', () => this.openPlantModal());
    $('btn-load-demo-plant')?.addEventListener('click', async () => {
      await Storage.seedIfEmpty();
      await this.loadPlants();
      showToast('🌱 Planta demo cargada');
    });

    $('btn-back-to-plants').addEventListener('click', () => this.showDashboard());
    $('btn-edit-plant-info').addEventListener('click', () => {
      const plant = this.plants.find((p) => p.id === this.activePlantId);
      if (plant) this.openPlantModal(plant);
    });

    $('btn-delete-plant').addEventListener('click', async () => {
      if (!confirm('¿Estás seguro de eliminar esta planta y todo su historial de eventos?')) return;
      await Storage.deletePlant(this.activePlantId);
      this.activePlantId = null;
      await this.loadPlants();
      this.showDashboard();
      showToast('🗑️ Planta eliminada');
    });

    // Filtros de etapas de plantas
    $('plants-stage-filters').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-plant-filter]');
      if (!btn) return;
      this.activeFilter = btn.dataset.plantFilter;
      document.querySelectorAll('#plants-stage-filters button').forEach((b) => {
        const act = b === btn;
        b.className = act
          ? 'rounded-lg px-2.5 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
          : 'rounded-lg px-2.5 py-1 text-xs font-semibold bg-canna-900 text-slate-400 hover:text-white border border-emerald-500/10';
      });
      this.renderPlantsGrid();
    });

    // Filtros de Timeline
    $('timeline-filters').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-timeline-filter]');
      if (!btn) return;
      this.activeTimelineFilter = btn.dataset.timelineFilter;
      document.querySelectorAll('#timeline-filters button').forEach((b) => {
        const act = b === btn;
        b.className = act
          ? 'rounded-lg px-2.5 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          : 'rounded-lg px-2.5 py-1 text-xs font-semibold bg-canna-900 text-slate-400 hover:text-white border border-emerald-500/10';
      });
      this.renderTimeline();
    });

    // Accesos rápidos de registro
    document.querySelectorAll('[data-quick-log]').forEach((b) => {
      b.addEventListener('click', () => this.openLogModal(b.dataset.quickLog));
    });
    $('btn-open-full-log').addEventListener('click', () => this.openLogModal('riego_agua'));

    // Modal de Registro
    $('btn-close-log-modal').addEventListener('click', () => this.closeLogModal());
    $('form-log-entry').addEventListener('submit', (e) => this.handleLogSubmit(e));

    $('log-type-selector').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      this.setLogModalType(btn.dataset.type);
    });

    // Subida de Foto en Log
    $('input-log-photo').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        this.pendingPhotoData = await compressImage(file, 900, 0.78);
        $('log-photo-preview-img').src = this.pendingPhotoData;
        $('log-photo-preview-box').classList.remove('hidden');
      } catch (err) {
        showToast('Error al procesar imagen');
      }
    });
    $('btn-remove-log-photo').addEventListener('click', () => {
      this.pendingPhotoData = null;
      $('input-log-photo').value = '';
      $('log-photo-preview-box').classList.add('hidden');
    });

    // Modal de Planta
    $('btn-close-plant-modal').addEventListener('click', () => this.closePlantModal());
    $('form-plant').addEventListener('submit', (e) => this.handlePlantSubmit(e));

    $('input-plant-cover-photo').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const photo = await compressImage(file, 800, 0.75);
        $('plant-cover-preview-img').src = photo;
        $('plant-cover-preview-box').classList.remove('hidden');
        $('input-plant-cover-photo').dataset.base64 = photo;
      } catch {
        showToast('Error al procesar foto de portada');
      }
    });
    $('btn-remove-plant-cover').addEventListener('click', () => {
      delete $('input-plant-cover-photo').dataset.base64;
      $('input-plant-cover-photo').value = '';
      $('plant-cover-preview-box').classList.add('hidden');
    });

    // Lightbox
    $('btn-close-lightbox').addEventListener('click', () => $('lightbox-modal').classList.add('hidden'));
    $('lightbox-modal').addEventListener('click', (e) => {
      if (e.target.id === 'lightbox-modal') $('lightbox-modal').classList.add('hidden');
    });
  },

  async loadPlants() {
    this.plants = await Storage.getPlants();
    this.updateStats();
    this.renderPlantsGrid();
  },

  updateStats() {
    $('stat-total-plants').textContent = this.plants.length;
    $('stat-veg-plants').textContent = this.plants.filter((p) => p.stage === 'vegetativo' || p.stage === 'plantula').length;
    $('stat-flower-plants').textContent = this.plants.filter((p) => p.stage === 'floracion' || p.stage === 'transicion').length;
  },

  renderPlantsGrid() {
    const grid = $('plants-grid');
    const empty = $('plants-empty-state');

    let filtered = this.plants;
    if (this.activeFilter !== 'all') {
      filtered = this.plants.filter((p) => p.stage === this.activeFilter);
    }

    if (this.plants.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="col-span-full app-card p-6 text-center text-xs text-slate-400">No hay plantas en etapa ${this.activeFilter}.</div>`;
      return;
    }

    grid.innerHTML = filtered.map((p) => {
      const days = daysDiff(p.germDate, todayDateStr());
      const weeks = Math.max(1, Math.floor(days / 7) + 1);
      const st = STAGES[p.stage] || STAGES.vegetativo;

      return `
        <div class="app-card overflow-hidden flex flex-col justify-between hover:border-emerald-500/40 transition cursor-pointer group" onclick="GrowlogsModule.openPlantDetail('${p.id}')">
          <div>
            <!-- Portada o Cabecera Visual -->
            <div class="relative h-28 w-full bg-canna-950 flex items-center justify-center overflow-hidden border-b border-emerald-500/10">
              ${p.coverPhoto
                ? `<img src="${p.coverPhoto}" alt="${esc(p.name)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />`
                : `<div class="flex flex-col items-center justify-center text-slate-600 group-hover:text-emerald-400 transition">
                     <span class="text-3xl">${st.emoji}</span>
                     <span class="text-[10px] uppercase font-bold tracking-widest mt-1 text-slate-500">${p.type}</span>
                   </div>`}
              <div class="absolute top-2 left-2 flex items-center gap-1.5">
                <span class="rounded-md px-2 py-0.5 text-[10px] font-bold ${st.badgeClass}">${st.label}</span>
              </div>
              <div class="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-mono font-bold text-white backdrop-blur-sm border border-white/10">
                Día ${days} <span class="text-emerald-400 font-semibold">(Sem ${weeks})</span>
              </div>
            </div>

            <!-- Detalles -->
            <div class="p-3.5 space-y-1.5">
              <h3 class="text-base font-extrabold text-white group-hover:text-emerald-300 transition truncate">${esc(p.name)}</h3>
              <p class="text-xs text-slate-400 truncate">${esc(p.strain || 'Genética sin especificar')}</p>
              <div class="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                <span class="rounded bg-canna-900 border border-emerald-500/10 px-1.5 py-0.5">🌱 Germinó: ${p.germDate}</span>
                <span class="rounded bg-canna-900 border border-emerald-500/10 px-1.5 py-0.5">${p.medium}</span>
              </div>
            </div>
          </div>

          <!-- Pie de tarjeta táctil -->
          <div class="px-3.5 pb-3 pt-1 border-t border-emerald-500/10 flex items-center justify-between text-xs text-emerald-400 font-semibold">
            <span>Ver Bitácora &amp; Eventos</span>
            <span class="group-hover:translate-x-1 transition">→</span>
          </div>
        </div>
      `;
    }).join('');
  },

  async openPlantDetail(plantId) {
    this.activePlantId = plantId;
    const plant = this.plants.find((p) => p.id === plantId);
    if (!plant) return;

    $('growlogs-dashboard-container').classList.add('hidden');
    $('growlogs-detail-container').classList.remove('hidden');
    $('top-bar-subtext').textContent = `${plant.name} · Bitácora`;

    this.renderPlantHero(plant);
    await this.renderTimeline();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  showDashboard() {
    this.activePlantId = null;
    $('growlogs-detail-container').classList.add('hidden');
    $('growlogs-dashboard-container').classList.remove('hidden');
    $('top-bar-subtext').textContent = 'Bitácora de Plantas · Offline';
    this.renderPlantsGrid();
  },

  renderPlantHero(plant) {
    const days = daysDiff(plant.germDate, todayDateStr());
    const weeks = Math.max(1, Math.floor(days / 7) + 1);
    const st = STAGES[plant.stage] || STAGES.vegetativo;

    $('plant-hero-card').innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="h-16 w-16 shrink-0 rounded-2xl bg-canna-950 border border-emerald-500/20 overflow-hidden flex items-center justify-center">
            ${plant.coverPhoto
              ? `<img src="${plant.coverPhoto}" alt="${esc(plant.name)}" class="h-full w-full object-cover cursor-pointer" onclick="GrowlogsModule.openLightbox('${plant.coverPhoto}', '${esc(plant.name)}')">`
              : `<span class="text-2xl">${st.emoji}</span>`}
          </div>

          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-extrabold text-white leading-tight">${esc(plant.name)}</h2>
              <span class="rounded-md px-2 py-0.5 text-[10px] font-bold ${st.badgeClass}">${st.label}</span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">${esc(plant.strain || 'Variedad personalizada')} · <span class="capitalize">${plant.type}</span></p>
            <div class="flex items-center gap-2 mt-1.5 font-mono text-xs">
              <span class="text-emerald-300 font-bold">Día ${days}</span>
              <span class="text-slate-500">|</span>
              <span class="text-slate-300">Semana ${weeks}</span>
              <span class="text-slate-500">|</span>
              <span class="text-slate-400 font-sans">${plant.medium}</span>
            </div>
          </div>
        </div>

        <!-- Selector Rápido de Cambio de Etapa -->
        <div class="flex items-center gap-2 bg-canna-950 p-2 rounded-xl border border-emerald-500/15">
          <label for="quick-change-stage" class="text-[11px] font-bold text-slate-400 uppercase">Etapa:</label>
          <select id="quick-change-stage" class="bg-transparent text-xs font-bold text-emerald-300 focus:outline-none cursor-pointer">
            <option value="plantula" ${plant.stage === 'plantula' ? 'selected' : ''}>🌱 Plántula</option>
            <option value="vegetativo" ${plant.stage === 'vegetativo' ? 'selected' : ''}>🌿 Vegetativo</option>
            <option value="transicion" ${plant.stage === 'transicion' ? 'selected' : ''}>⚡ Transición</option>
            <option value="floracion" ${plant.stage === 'floracion' ? 'selected' : ''}>🌸 Floración</option>
            <option value="cosecha" ${plant.stage === 'cosecha' ? 'selected' : ''}>💎 Cosecha</option>
          </select>
        </div>
      </div>
    `;

    $('quick-change-stage').addEventListener('change', async (e) => {
      const newStage = e.target.value;
      if (newStage === plant.stage) return;
      plant.stage = newStage;
      await Storage.savePlant(plant);

      // Registrar evento de cambio de etapa automáticamente
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
      showToast(`🌸 Etapa actualizada a ${STAGES[newStage].label}`);
    });
  },

  async renderTimeline() {
    if (!this.activePlantId) return;
    const plant = this.plants.find((p) => p.id === this.activePlantId);
    let logs = await Storage.getLogsByPlant(this.activePlantId);

    $('timeline-count-badge').textContent = `${logs.length} ${logs.length === 1 ? 'evento' : 'eventos'}`;

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
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    container.innerHTML = logs.map((log) => {
      const t = LOG_TYPES[log.type] || LOG_TYPES.nota_foto;
      const dayAtLog = plant ? daysDiff(plant.germDate, log.dateTime.split('T')[0]) : null;

      // Métricas formateadas si existen
      let metricsBadges = '';
      if (log.metrics) {
        const m = log.metrics;
        if (m.liters) metricsBadges += `<span class="rounded bg-canna-950 border border-cyan-500/20 px-2 py-0.5 text-cyan-300 font-mono">${m.liters} L agua</span>`;
        if (m.ph) metricsBadges += `<span class="rounded bg-canna-950 border border-emerald-500/20 px-2 py-0.5 text-emerald-300 font-mono">pH ${m.ph}</span>`;
        if (m.ec) metricsBadges += `<span class="rounded bg-canna-950 border border-lime-500/20 px-2 py-0.5 text-lime-300 font-mono">EC ${m.ec}</span>`;
        if (m.products) metricsBadges += `<span class="rounded bg-canna-950 border border-emerald-500/20 px-2 py-0.5 text-slate-300">${esc(m.products)}</span>`;
        if (m.foliarType) metricsBadges += `<span class="rounded bg-canna-950 border border-lime-500/20 px-2 py-0.5 text-lime-300">${esc(m.foliarType)}</span>`;
        if (m.pruneType) metricsBadges += `<span class="rounded bg-canna-950 border border-purple-500/20 px-2 py-0.5 text-purple-300">${esc(m.pruneType)}</span>`;
        if (m.potSize) metricsBadges += `<span class="rounded bg-canna-950 border border-amber-500/20 px-2 py-0.5 text-amber-300">Maceta ${esc(m.potSize)}</span>`;
      }

      return `
        <div class="timeline-node">
          <div class="timeline-pin ${t.border}">
            <span>${t.icon}</span>
          </div>

          <div class="app-card p-3.5 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-white">${t.label}</span>
                  ${dayAtLog != null ? `<span class="rounded bg-canna-950 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-400 border border-emerald-500/20">Día ${dayAtLog}</span>` : ''}
                </div>
                <div class="font-mono text-[11px] text-slate-400 mt-0.5">
                  ${formatPrettyDate(log.dateTime)} <span class="text-slate-500">(${timeAgo(log.dateTime)})</span>
                </div>
              </div>

              <button type="button" onclick="GrowlogsModule.deleteLogEntry('${log.id}')"
                class="text-slate-500 hover:text-red-400 p-1 text-xs transition" title="Eliminar este evento">
                ✕
              </button>
            </div>

            ${metricsBadges ? `<div class="flex flex-wrap gap-1.5 text-[11px] pt-1">${metricsBadges}</div>` : ''}

            ${log.notes ? `<p class="text-xs text-slate-200 leading-relaxed whitespace-pre-line">${esc(log.notes)}</p>` : ''}

            ${log.photo ? `
              <div class="pt-1">
                <img src="${log.photo}" alt="Foto del evento"
                  onclick="GrowlogsModule.openLightbox('${log.photo}', '${esc(t.label)} · Día ${dayAtLog}')"
                  class="h-28 w-44 object-cover rounded-xl border border-emerald-500/20 cursor-pointer hover:border-emerald-400 transition" />
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  async deleteLogEntry(logId) {
    if (!confirm('¿Eliminar este registro de la bitácora?')) return;
    await Storage.deleteLog(logId);
    await this.renderTimeline();
    showToast('Registro eliminado');
  },

  /* Formulario Modal de Evento */
  openLogModal(initialType = 'riego_agua') {
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
      btn.className = `log-type-btn rounded-xl border p-2 text-center text-xs font-bold transition ${
        active
          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
          : 'bg-canna-950 border-emerald-500/10 text-slate-400 hover:text-white'
      }`;
    });

    const dyn = $('dynamic-log-fields');
    if (type === 'riego_agua') {
      dyn.innerHTML = `
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Litros de Agua</label>
            <input id="log-liters" type="number" step="0.25" value="2.0" class="touch-input w-full font-mono text-xs" required />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">pH (Opcional)</label>
            <input id="log-ph" type="number" step="0.1" placeholder="6.2" class="touch-input w-full font-mono text-xs" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">EC (Opcional)</label>
            <input id="log-ec" type="number" step="0.1" placeholder="0.4" class="touch-input w-full font-mono text-xs" />
          </div>
        </div>
      `;
    } else if (type === 'riego_nutrientes') {
      dyn.innerHTML = `
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Litros</label>
            <input id="log-liters" type="number" step="0.25" value="2.0" class="touch-input w-full font-mono text-xs" required />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">pH Entrada</label>
            <input id="log-ph" type="number" step="0.1" placeholder="6.2" class="touch-input w-full font-mono text-xs" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">EC (mS/cm)</label>
            <input id="log-ec" type="number" step="0.1" placeholder="1.2" class="touch-input w-full font-mono text-xs" />
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Productos y Dosis</label>
          <input id="log-products" type="text" placeholder="Ej: Top Bloom 3ml/L + Top Candy 2ml/L" class="touch-input w-full text-xs" />
        </div>
      `;
    } else if (type === 'foliar') {
      dyn.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Tratamiento Foliar</label>
            <select id="log-foliar-type" class="touch-input w-full text-xs">
              <option value="Aceite de Neem + Jabón Potásico">🌿 Neem + Jabón Potásico</option>
              <option value="Bacillus thuringiensis (Bt)">🐛 Bacillus thuringiensis</option>
              <option value="Jabón Potásico solo">🧼 Jabón Potásico solo</option>
              <option value="Bioestimulante foliar (Algas / Aminoácidos)">🍃 Algas / Bioestimulante</option>
              <option value="Otro foliar">🧪 Otro tratamiento</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Volumen Pulverizador</label>
            <input id="log-liters" type="number" step="0.5" value="1.0" class="touch-input w-full font-mono text-xs" />
          </div>
        </div>
      `;
    } else if (type === 'poda') {
      dyn.innerHTML = `
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Tipo de Intervención</label>
          <select id="log-prune-type" class="touch-input w-full text-xs">
            <option value="Poda Apical">Poda Apical (Corte del ápice central)</option>
            <option value="Poda FIM">Poda FIM (80% del brote)</option>
            <option value="Defoliación de bajos (Lollipop)">Defoliación de bajos (Lollipop)</option>
            <option value="LST (Low Stress Training)">LST / Guiado de ramas</option>
            <option value="Corte de esquejes">Corte de esquejes</option>
          </select>
        </div>
      `;
    } else if (type === 'transplante') {
      dyn.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Nueva Maceta</label>
            <input id="log-pot-size" type="text" placeholder="Ej: 15 L Geotextil" class="touch-input w-full text-xs" />
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Sustrato / Enraizante</label>
            <input id="log-substrate" type="text" placeholder="Ej: Growmix + Micorrizas" class="touch-input w-full text-xs" />
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

    const metrics = {};
    if ($('log-liters')) metrics.liters = parseFloat($('log-liters').value) || undefined;
    if ($('log-ph')) metrics.ph = parseFloat($('log-ph').value) || undefined;
    if ($('log-ec')) metrics.ec = parseFloat($('log-ec').value) || undefined;
    if ($('log-products')) metrics.products = $('log-products').value.trim() || undefined;
    if ($('log-foliar-type')) metrics.foliarType = $('log-foliar-type').value;
    if ($('log-prune-type')) metrics.pruneType = $('log-prune-type').value;
    if ($('log-pot-size')) metrics.potSize = $('log-pot-size').value.trim() || undefined;

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
    await this.renderTimeline();
    showToast('✅ Evento registrado en bitácora');
  },

  /* Formulario de Planta */
  openPlantModal(editPlant = null) {
    $('input-plant-id').value = editPlant ? editPlant.id : '';
    $('modal-plant-title').textContent = editPlant ? 'Editar Planta' : 'Nueva Planta';
    $('input-plant-name').value = editPlant ? editPlant.name : '';
    $('input-plant-strain').value = editPlant ? editPlant.strain : '';
    $('select-plant-type').value = editPlant ? editPlant.type : 'fotoperiodica';
    $('select-plant-medium').value = editPlant ? editPlant.medium : 'sustrato';
    $('input-plant-germ-date').value = editPlant ? editPlant.germDate : todayDateStr();
    $('select-plant-stage').value = editPlant ? editPlant.stage : 'vegetativo';

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
    const germDate = $('input-plant-germ-date').value;
    const stage = $('select-plant-stage').value;
    const coverPhoto = $('input-plant-cover-photo').dataset.base64 || undefined;

    const plant = {
      id,
      name,
      strain,
      type,
      medium,
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
    showToast(id === $('input-plant-id').value ? 'Planta actualizada' : '🌱 Planta creada con éxito');
  },

  openLightbox(src, caption) {
    $('lightbox-img').src = src;
    $('lightbox-caption').textContent = caption || '';
    $('lightbox-modal').classList.remove('hidden');
    $('lightbox-modal').classList.add('flex');
  }
};

/* ==========================================================================
   5. MÓDULO CALCULADORA DE FERTILIZANTES & MODO DE CULTIVO
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
      { name: 'pH Perfect Micro', role: 'Base Micronutrientes', unit: 'ml', doses: { plantula: 1, vegetativo: 3, transicion: 4, flora_temprana: 4, flora_tardia: 4 } },
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
        this.renderMode();
      });
    });

    // Botón para transferir la receta calculada directamente a la bitácora
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

      // Obtener resumen de productos
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
    document.querySelectorAll('[data-mode-btn]').forEach((btn) => {
      const active = btn.dataset.modeBtn === this.mode;
      btn.className = `mode-toggle-btn rounded-lg py-1.5 px-3 text-xs font-bold transition ${
        active ? 'bg-emerald-500 text-black shadow' : 'text-slate-400 hover:text-white'
      }`;
    });

    const cont = $('mode-timeline-container');
    if (this.mode === 'outdoor') {
      cont.innerHTML = `
        <div class="rounded-xl border border-emerald-500/15 bg-canna-950 p-3 text-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-amber-400">Outdoor Hemisferio Sur (Argentina)</span>
            <span class="font-mono text-[11px] text-slate-400">Fotoperiódicas en Buenos Aires</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div class="rounded-lg bg-canna-900 border border-lime-500/20 p-2">
              <span class="text-[9px] uppercase font-bold text-lime-400 block">Sept / Oct</span>
              <strong class="text-white text-xs block">🌱 Germinación</strong>
              <p class="text-[10px] text-slate-400 mt-0.5">Inicio en Cuarto Creciente</p>
            </div>
            <div class="rounded-lg bg-canna-900 border border-emerald-500/20 p-2">
              <span class="text-[9px] uppercase font-bold text-emerald-400 block">Nov – Ene</span>
              <strong class="text-white text-xs block">🌿 Vegetativo</strong>
              <p class="text-[10px] text-slate-400 mt-0.5">&gt; 14 h de sol · Podas</p>
            </div>
            <div class="rounded-lg bg-canna-900 border border-amber-500/20 p-2">
              <span class="text-[9px] uppercase font-bold text-amber-400 block">Febrero</span>
              <strong class="text-white text-xs block">⚡ Pre-floración</strong>
              <p class="text-[10px] text-slate-400 mt-0.5">Stretch y primeros pistilos</p>
            </div>
            <div class="rounded-lg bg-canna-900 border border-pink-500/20 p-2">
              <span class="text-[9px] uppercase font-bold text-pink-400 block">Mar / Abr</span>
              <strong class="text-white text-xs block">💎 Cosecha</strong>
              <p class="text-[10px] text-slate-400 mt-0.5">Engorde · Corte en Luna Nueva</p>
            </div>
          </div>
        </div>
      `;
    } else {
      cont.innerHTML = `
        <div class="rounded-xl border border-emerald-500/15 bg-canna-950 p-3 text-xs space-y-1.5">
          <span class="text-[10px] font-bold uppercase tracking-wider text-sky-400">Modo Indoor (Semanas)</span>
          <p class="text-slate-300">Controlá el fotoperíodo artificial: <strong>18/6</strong> para crecimiento vegetativo (4 a 6 semanas) y cambiá a <strong>12/12</strong> para inducir la floración (8 a 10 semanas).</p>
        </div>
      `;
    }
  },

  render() {
    // Renderizado de tarjetas de marcas
    $('brand-cards-grid').innerHTML = Object.entries(BRANDS).map(([k, b]) => {
      const active = k === this.brand;
      return `
        <button type="button" data-brand="${k}"
          class="rounded-xl border p-2.5 text-left transition ${
            active ? 'border-emerald-400 bg-emerald-500/15 text-white' : 'border-emerald-500/10 bg-canna-950 text-slate-400 hover:text-white'
          }">
          <div class="font-bold text-xs">${b.name}</div>
          <div class="text-[10px] text-slate-500">${b.type}</div>
        </button>
      `;
    }).join('');

    const brandData = BRANDS[this.brand];
    $('result-title').textContent = `Receta ${brandData.name} · ${STAGES[this.stage].label}`;
    $('result-subtitle').textContent = `Cálculo para ${this.liters} litros de agua`;

    const tbody = $('fertilizer-table-body');
    const rows = brandData.products.filter((p) => p.doses[this.stage] > 0);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-500">Sin productos para esta etapa.</td></tr>`;
    } else {
      tbody.innerHTML = rows.map((p) => {
        const dose = p.doses[this.stage];
        const total = (dose * this.liters).toFixed(1);
        return `
          <tr class="hover:bg-emerald-500/5">
            <td class="py-2 pl-3 pr-2 font-bold text-white">${p.name} <span class="text-[10px] font-normal text-slate-500 block">${p.role}</span></td>
            <td class="py-2 px-2 text-right font-mono text-slate-400">${dose} ${p.unit}/L</td>
            <td class="py-2 px-3 text-right font-mono font-bold text-emerald-300">${total} ${p.unit}</td>
          </tr>
        `;
      }).join('');
    }

    $('mixing-protocol-box').innerHTML = `
      <p>💡 <strong>Orden de dilución:</strong> Agregá primero los aditivos/bases al agua y mezclá bien antes de medir el pH. Ajustá el pH entre <strong>5.8 y 6.2</strong> en vegetativo y <strong>6.2 a 6.8</strong> en floración.</p>
    `;
  }
};

/* ==========================================================================
   6. MÓDULO CALENDARIO LUNAR 2026/2027 (HEMISFERIO SUR)
   ========================================================================== */
const LunarModule = {
  year: 2026,
  month: 10, // Noviembre

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
        <circle cx="50" cy="50" r="45" fill="#0f1512" stroke="#34d399" stroke-width="2"/>
        <path d="M 50 5 A 45 45 0 0 0 50 95 A 15 45 0 0 1 50 5" fill="#34d399"/>
      </svg>
    `;

    $('lunar-phase-title').textContent = 'Cuarto Menguante (Descenso de Savia)';
    $('lunar-phase-meta').textContent = 'Fase óptima para labores de raíz, esquejes y podas';

    $('lunar-day-recommendation').innerHTML = `
      <div class="space-y-1">
        <span class="rounded bg-sky-500/15 border border-sky-400/30 px-2 py-0.5 text-[10px] font-bold text-sky-300">✂️ Labores de la Fase</span>
        <p class="text-slate-300 font-semibold mt-1">Trasplantes, Podas Apicales y Esquejes</p>
        <p class="text-slate-400 text-[11px]">La savia desciende hacia las raíces: menor estrés por corte y cicatrización acelerada.</p>
      </div>
    `;

    $('lunar-task-cards').innerHTML = `
      <div class="app-card p-3 space-y-1 text-xs">
        <span class="text-lime-400 font-bold">🌱 Cuarto Creciente / Llena</span>
        <p class="text-slate-300">Germinación &amp; Riegos Foliares</p>
        <p class="text-[11px] text-slate-500">Savia en ascenso hacia ramas y hojas superiores.</p>
      </div>
      <div class="app-card p-3 space-y-1 text-xs border-sky-400/30">
        <span class="text-sky-300 font-bold">✂️ Cuarto Menguante</span>
        <p class="text-slate-300">Trasplantes &amp; Podas</p>
        <p class="text-[11px] text-slate-500">Savia concentrada en la raíz; mínimo sangrado.</p>
      </div>
      <div class="app-card p-3 space-y-1 text-xs">
        <span class="text-amber-400 font-bold">🌾 Luna Nueva</span>
        <p class="text-slate-300">Cosecha &amp; Reposo</p>
        <p class="text-[11px] text-slate-500">Menor humedad interna en cogollos para un secado óptimo.</p>
      </div>
    `;

    // Grilla del mes simple y limpia
    const grid = $('lunar-calendar-grid');
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();
    const firstDay = (new Date(this.year, this.month, 1).getDay() + 6) % 7;

    let cells = '';
    for (let i = 0; i < firstDay; i++) cells += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const isSpecial = d === 9 || d === 17 || d === 24;
      cells += `
        <div class="app-card p-1 text-center min-h-[2.8rem] flex flex-col justify-between ${isSpecial ? 'border-emerald-400/40 bg-emerald-500/10' : ''}">
          <span class="text-[11px] font-mono font-bold text-slate-300">${d}</span>
          <span class="text-[9px] text-emerald-400">${d === 9 ? '🌑' : d === 17 ? '🌓' : d === 24 ? '🌕' : '·'}</span>
        </div>
      `;
    }
    grid.innerHTML = cells;
  }
};

/* ==========================================================================
   7. MÓDULO PREVENCIÓN DE PLAGAS (MIP)
   ========================================================================== */
const PestModule = {
  init() {
    $('input-pest-last-date').value = todayDateStr();
    $('input-pest-last-date').addEventListener('change', () => this.render());
    $('select-pest-interval').addEventListener('change', () => this.render());
    $('select-sprayer-liters').addEventListener('change', () => this.render());
    this.render();
  },

  render() {
    const liters = parseFloat($('select-sprayer-liters').value) || 1;
    const interval = parseInt($('select-pest-interval').value) || 12;

    $('pest-alert-card').innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Protección Foliar Preventiva</span>
          <h3 class="text-base font-bold text-white mt-0.5">Próxima Aplicación Sugerida: En 5 días</h3>
          <p class="text-xs text-slate-400">Protocolo regular cada ${interval} días al atardecer.</p>
        </div>
        <span class="text-2xl">🛡️</span>
      </div>
    `;

    $('pest-biocontrol-cards').innerHTML = `
      <div class="app-card p-4 space-y-2 text-xs">
        <div class="flex items-center justify-between">
          <strong class="text-white text-sm">🌿 Aceite de Neem + Jabón Potásico</strong>
          <span class="rounded bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-[10px] font-bold">Vegetativo &amp; Pre-flora</span>
        </div>
        <p class="text-slate-300">Para tu pulverizador de <strong>${liters} L</strong>:</p>
        <div class="flex gap-2 font-mono">
          <span class="rounded bg-canna-950 px-2 py-1 border border-emerald-500/20 text-emerald-300 font-bold">${(2 * liters).toFixed(1)} ml Neem</span>
          <span class="rounded bg-canna-950 px-2 py-1 border border-lime-500/20 text-lime-300 font-bold">${(5 * liters).toFixed(1)} ml Potásico</span>
        </div>
        <p class="text-slate-400 text-[11px] mt-1">Prevención de trips, mosca blanca y arañuela roja. Cortar al formarse los primeros cogollos.</p>
      </div>

      <div class="app-card p-4 space-y-2 text-xs">
        <div class="flex items-center justify-between">
          <strong class="text-white text-sm">🐛 Bacillus thuringiensis (Bt)</strong>
          <span class="rounded bg-sky-500/15 text-sky-300 px-2 py-0.5 text-[10px] font-bold">Vital en Floración Outdoor</span>
        </div>
        <p class="text-slate-300">Para tu pulverizador de <strong>${liters} L</strong>:</p>
        <div class="font-mono">
          <span class="rounded bg-canna-950 px-2 py-1 border border-sky-500/20 text-sky-300 font-bold">${(1 * liters).toFixed(1)} g Bt en polvo</span>
        </div>
        <p class="text-slate-400 text-[11px] mt-1">Control biológico de orugas e isocas que pudren los cogollos desde adentro (Botrytis). Aplicar al atardecer.</p>
      </div>
    `;

    $('pest-schedule-tbody').innerHTML = [
      { date: '12 Nov', bio: 'Neem + Potásico', pest: 'Trips y Arañuela', mode: 'Foliar envés' },
      { date: '24 Nov', bio: 'Neem + Potásico', pest: 'Prevención general', mode: 'Foliar envés' },
      { date: '06 Dic', bio: 'Bacillus thuringiensis', pest: 'Orugas / Isocas', mode: 'Pulverizar al atardecer' },
      { date: '18 Dic', bio: 'Bacillus thuringiensis', pest: 'Refuerzo cogollos', mode: 'Sin sol directo' }
    ].map((r) => `
      <tr class="hover:bg-emerald-500/5">
        <td class="py-2 pl-3 pr-2 font-mono text-slate-300 font-bold">${r.date}</td>
        <td class="py-2 px-2 text-emerald-300 font-semibold">${r.bio}</td>
        <td class="py-2 px-2 text-slate-400">${r.pest}</td>
        <td class="hidden sm:table-cell py-2 pl-2 pr-3 text-slate-500">${r.mode}</td>
      </tr>
    `).join('');
  }
};

/* ==========================================================================
   8. MÓDULO EXPORTACIÓN & BACKUP OFFLINE
   ========================================================================== */
const BackupModule = {
  init() {
    $('btn-backup-export').addEventListener('click', async () => {
      const plants = await Storage.getPlants();
      const logs = await Storage.getAllLogs();
      const data = { version: 1, exportedAt: new Date().toISOString(), plants, logs };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cannasur-bitacora-${todayDateStr()}.json`;
      a.click();
      showToast('📥 Copia de seguridad descargada');
    });

    $('input-backup-import').addEventListener('change', async (e) => {
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
        showToast('📤 Copia de seguridad restaurada');
      } catch {
        showToast('Archivo de respaldo no válido');
      }
    });

    $('btn-reset-app').addEventListener('click', () => {
      if (!confirm('¿Restablecer todo a valores de fábrica? Se borrarán tus plantas y registros locales.')) return;
      localStorage.clear();
      indexedDB.deleteDatabase(DB_NAME);
      location.reload();
    });

    // Exportar Canvas Ficha
    $('btn-open-export').addEventListener('click', () => {
      $('export-modal').classList.remove('hidden');
      $('export-modal').classList.add('flex');
      this.drawCanvas();
    });
    $('btn-close-export').addEventListener('click', () => {
      $('export-modal').classList.add('hidden');
      $('export-modal').classList.remove('flex');
    });

    $('btn-download-png').addEventListener('click', () => {
      const canvas = $('routine-export-canvas');
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `cannasur-ficha-${todayDateStr()}.png`;
      a.click();
      showToast('🖼️ Imagen guardada');
    });

    $('btn-download-pdf').addEventListener('click', () => {
      const canvas = $('routine-export-canvas');
      if (window.jspdf && window.jspdf.jsPDF) {
        const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 10, 10, 190, 240);
        pdf.save(`cannasur-reporte-${todayDateStr()}.pdf`);
        showToast('📄 PDF guardado');
      } else {
        window.print();
      }
    });
  },

  drawCanvas() {
    const canvas = $('routine-export-canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#080c0a';
    ctx.fillRect(0, 0, 800, 1000);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('CannaSur AR — Reporte de Cultivo', 40, 60);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';
    ctx.fillText(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 40, 95);

    ctx.fillStyle = '#101713';
    ctx.fillRect(40, 120, 720, 160);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('🌿 Plantas en Seguimiento:', 60, 160);

    ctx.font = '16px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    let y = 195;
    GrowlogsModule.plants.slice(0, 3).forEach((p) => {
      const days = daysDiff(p.germDate, todayDateStr());
      ctx.fillText(`• ${p.name} (${p.strain || p.type}) — Día ${days} (${STAGES[p.stage].label})`, 60, y);
      y += 28;
    });

    ctx.fillStyle = '#101713';
    ctx.fillRect(40, 310, 720, 240);
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('🧪 Calculadora de Nutrición Activa:', 60, 350);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`Marca: ${BRANDS[CalculatorModule.brand].name} · Etapa: ${STAGES[CalculatorModule.stage].label}`, 60, 385);
    ctx.fillText(`Volumen: ${CalculatorModule.liters} Litros de agua`, 60, 415);
  }
};

/* ==========================================================================
   9. NAVEGACIÓN PRINCIPAL
   ========================================================================== */
const App = {
  currentView: 'growlogs',

  async init() {
    await Storage.init();
    await GrowlogsModule.init();
    CalculatorModule.init();
    LunarModule.init();
    PestModule.init();
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

    // Si vuelve a growlogs y había una planta abierta, mantiene o vuelve al dashboard
    if (viewId === 'growlogs' && !GrowlogsModule.activePlantId) {
      GrowlogsModule.showDashboard();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
