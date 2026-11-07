/* ==========================================================================
   CannaSur — Bitácora de Cultivo & Notas de Jardín
   Estética Apple-Like: minimalista, orgánica, blanco y negro.
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
  el.style.transform = 'translate(-50%, 6px)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, 0)';
  }, 2200);
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
   3. GESTOR DE ALMACENAMIENTO OFFLINE (IndexedDB + Fallback)
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

  /* Semilla inicial demo amigable */
  async seedIfEmpty() {
    const plants = await this.getPlants();
    if (plants.length > 0) return;

    const germDate = new Date(Date.now() - 38 * DAY_MS).toISOString().split('T')[0];
    const demoPlant = {
      id: 'demo-plant-1',
      name: 'Gorilla Glue #4',
      strain: 'Gorilla Glue #4 (Feminizada)',
      type: 'fotoperiodica',
      medium: 'sustrato',
      germDate: germDate,
      stage: 'vegetativo',
      createdAt: new Date().toISOString()
    };
    await this.savePlant(demoPlant);

    const logs = [
      {
        id: 'log-1',
        plantId: demoPlant.id,
        type: 'transplante',
        dateTime: new Date(Date.now() - 36 * DAY_MS).toISOString(),
        notes: 'Semilla germinada con vigor en servilleta húmeda. Pasada con cuidado a maceta inicial de 1L con sustrato liviano.',
        metrics: { potSize: '1 L' }
      },
      {
        id: 'log-2',
        plantId: demoPlant.id,
        type: 'riego_nutrientes',
        dateTime: new Date(Date.now() - 15 * DAY_MS).toISOString(),
        notes: 'Primer riego nutricional con micorrizas y estimulante radicular. El cepellón de raíces colonizó todo el fondo.',
        metrics: { liters: 1.5, ph: 6.2, ec: 0.9, products: 'Amazonia Roots 1g/L + Deeper Underground' }
      },
      {
        id: 'log-3',
        plantId: demoPlant.id,
        type: 'poda',
        dateTime: new Date(Date.now() - 7 * DAY_MS).toISOString(),
        notes: 'Poda apical en el 4to nudo para abrir la copa y generar múltiples ramas principales. Cicatrizó en 24 horas.',
        metrics: { pruneType: 'Poda Apical' }
      },
      {
        id: 'log-4',
        plantId: demoPlant.id,
        type: 'foliar',
        dateTime: new Date(Date.now() - 2 * DAY_MS).toISOString(),
        notes: 'Pulverización foliar preventiva al caer el sol: Aceite de Neem + Jabón Potásico en ambas caras de las hojas.',
        metrics: { foliarType: 'Aceite de Neem + Jabón Potásico', liters: 1.0 }
      }
    ];

    for (const log of logs) {
      await this.saveLog(log);
    }
  }
};

/* ==========================================================================
   4. MÓDULO GROWLOGS (BITÁCORA TIPO APPLE NOTES / JOURNAL)
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

    $('btn-top-new-plant').addEventListener('click', () => this.openPlantModal());
    $('btn-empty-add-plant')?.addEventListener('click', () => this.openPlantModal());
    $('btn-load-demo-plant')?.addEventListener('click', async () => {
      await Storage.seedIfEmpty();
      await this.loadPlants();
      showToast('🌱 Planta de ejemplo cargada');
    });

    $('btn-back-to-plants').addEventListener('click', () => this.showDashboard());
    $('btn-edit-plant-info').addEventListener('click', () => {
      const plant = this.plants.find((p) => p.id === this.activePlantId);
      if (plant) this.openPlantModal(plant);
    });

    $('btn-delete-plant').addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta planta y todas sus notas de la bitácora?')) return;
      await Storage.deletePlant(this.activePlantId);
      this.activePlantId = null;
      await this.loadPlants();
      this.showDashboard();
      showToast('Planta eliminada');
    });

    // Segmented filters de plantas
    $('plants-stage-filters').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-plant-filter]');
      if (!btn) return;
      this.activeFilter = btn.dataset.plantFilter;
      document.querySelectorAll('#plants-stage-filters button').forEach((b) => {
        b.classList.toggle('active', b === btn);
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
        b.className = act ? 'badge-mono badge-mono-inverted cursor-pointer' : 'badge-mono cursor-pointer';
      });
      this.renderTimeline();
    });

    // Accesos directos rápidos
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
        this.pendingPhotoData = await compressImage(file, 960, 0.78);
        $('log-photo-preview-img').src = this.pendingPhotoData;
        $('log-photo-preview-box').classList.remove('hidden');
      } catch {
        showToast('No se pudo procesar la foto');
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
        showToast('Error con la foto de portada');
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
    await this.renderPlantsGrid();
  },

  updateStats() {
    $('stat-total-plants').textContent = this.plants.length;
    $('stat-veg-plants').textContent = this.plants.filter((p) => p.stage === 'vegetativo' || p.stage === 'plantula').length;
    $('stat-flower-plants').textContent = this.plants.filter((p) => p.stage === 'floracion' || p.stage === 'transicion').length;
  },

  async renderPlantsGrid() {
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
      grid.innerHTML = `<div class="col-span-full ios-card p-6 text-center text-xs text-neutral-400">No hay plantas en etapa ${this.activeFilter}.</div>`;
      return;
    }

    const cardsHtml = await Promise.all(filtered.map(async (p) => {
      const days = daysDiff(p.germDate, todayDateStr());
      const weeks = Math.max(1, Math.floor(days / 7) + 1);
      const st = STAGES[p.stage] || STAGES.vegetativo;
      const logs = await Storage.getLogsByPlant(p.id);
      const lastLog = logs[0];

      return `
        <div class="ios-card ios-card-press p-4 flex flex-col justify-between cursor-pointer space-y-3" onclick="GrowlogsModule.openPlantDetail('${p.id}')">
          <div class="space-y-3">
            <!-- Fila Superior: Foto/Avatar + Nombre -->
            <div class="flex items-center gap-3">
              <div class="h-14 w-14 shrink-0 rounded-2xl bg-neutral-900 border border-white/10 overflow-hidden flex items-center justify-center">
                ${p.coverPhoto
                  ? `<img src="${p.coverPhoto}" alt="${esc(p.name)}" class="h-full w-full object-cover" />`
                  : `<span class="text-2xl">${st.emoji}</span>`}
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-bold text-white tracking-tight leading-tight truncate">${esc(p.name)}</h3>
                <p class="text-xs text-neutral-400 truncate mt-0.5">${esc(p.strain || 'Genética personalizada')}</p>
                <div class="flex items-center gap-1.5 mt-1.5">
                  <span class="badge-mono font-mono text-[10px]">Día ${days}</span>
                  <span class="badge-mono text-[10px] text-neutral-300">Sem ${weeks}</span>
                  <span class="${st.badgeClass} text-[10px]">${st.label}</span>
                </div>
              </div>
            </div>

            <!-- Última Nota Registrada (Estilo Apple Notes Snippet) -->
            <div class="rounded-xl bg-neutral-950 p-2.5 border border-white/[0.04] text-[11px] text-neutral-400">
              ${lastLog
                ? `<div class="flex items-center justify-between text-[10px] text-neutral-500 mb-0.5 font-mono">
                     <span>${LOG_TYPES[lastLog.type]?.icon || '📝'} ${LOG_TYPES[lastLog.type]?.label || 'Nota'}</span>
                     <span>${timeAgo(lastLog.dateTime)}</span>
                   </div>
                   <p class="text-neutral-300 line-clamp-2 leading-relaxed">"${esc(lastLog.notes || 'Entrada registrada')}"</p>`
                : `<p class="italic text-neutral-500">Sin notas aún. Toca para empezar su bitácora.</p>`}
            </div>
          </div>

          <!-- Pie sutil -->
          <div class="flex items-center justify-between pt-1 text-[11px] text-neutral-400 font-medium">
            <span>${p.medium} · ${p.type}</span>
            <span class="text-white text-xs">Abrir bitácora →</span>
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
    $('top-bar-subtext').textContent = 'Bitácora de Plantas';
    this.renderPlantsGrid();
  },

  renderPlantHero(plant) {
    const days = daysDiff(plant.germDate, todayDateStr());
    const weeks = Math.max(1, Math.floor(days / 7) + 1);
    const st = STAGES[plant.stage] || STAGES.vegetativo;

    $('plant-hero-card').innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="h-16 w-16 shrink-0 rounded-2xl bg-neutral-900 border border-white/10 overflow-hidden flex items-center justify-center">
            ${plant.coverPhoto
              ? `<img src="${plant.coverPhoto}" alt="${esc(plant.name)}" class="h-full w-full object-cover cursor-pointer" onclick="GrowlogsModule.openLightbox('${plant.coverPhoto}', '${esc(plant.name)}')">`
              : `<span class="text-3xl">${st.emoji}</span>`}
          </div>

          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-extrabold text-white tracking-tight">${esc(plant.name)}</h2>
              <span class="${st.badgeClass} text-[10px]">${st.label}</span>
            </div>
            <p class="text-xs text-neutral-400 mt-0.5">${esc(plant.strain || 'Variedad de jardín')} · <span class="capitalize">${plant.type}</span></p>
            <div class="flex items-center gap-2 mt-2 font-mono text-xs">
              <span class="text-white font-bold">Día ${days}</span>
              <span class="text-neutral-600">·</span>
              <span class="text-neutral-300">Semana ${weeks}</span>
              <span class="text-neutral-600">·</span>
              <span class="text-neutral-400 font-sans">${plant.medium}</span>
            </div>
          </div>
        </div>

        <!-- Selector de Etapa Estilo iOS -->
        <div class="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-xl border border-white/[0.08]">
          <span class="text-[11px] font-semibold text-neutral-400 uppercase">Etapa:</span>
          <select id="quick-change-stage" class="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer">
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
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    container.innerHTML = logs.map((log) => {
      const t = LOG_TYPES[log.type] || LOG_TYPES.nota_foto;
      const dayAtLog = plant ? daysDiff(plant.germDate, log.dateTime.split('T')[0]) : null;

      // Métricas limpias en blanco y negro
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
      }

      return `
        <div class="journal-entry-card space-y-2.5">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2">
                <span class="badge-mono">${t.icon} ${t.label}</span>
                ${dayAtLog != null ? `<span class="badge-mono text-[10px] font-mono">Día ${dayAtLog}</span>` : ''}
              </div>
              <div class="text-[11px] text-neutral-400 mt-1 font-mono">
                ${formatPrettyDate(log.dateTime)} <span class="text-neutral-500">(${timeAgo(log.dateTime)})</span>
              </div>
            </div>

            <button type="button" onclick="GrowlogsModule.deleteLogEntry('${log.id}')"
              class="text-neutral-500 hover:text-white p-1 text-xs transition" title="Eliminar entrada">
              ✕
            </button>
          </div>

          ${metricsBadges ? `<div class="flex flex-wrap gap-1 text-[11px] pt-0.5">${metricsBadges}</div>` : ''}

          ${log.notes ? `<p class="text-xs text-neutral-200 leading-relaxed whitespace-pre-line">${esc(log.notes)}</p>` : ''}

          ${log.photo ? `
            <div class="pt-1">
              <img src="${log.photo}" alt="Foto de bitácora"
                onclick="GrowlogsModule.openLightbox('${log.photo}', '${esc(t.label)} · Día ${dayAtLog}')"
                class="h-32 sm:h-40 w-auto object-cover rounded-xl border border-white/10 cursor-pointer hover:border-white/30 transition shadow-sm" />
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
    showToast('Entrada eliminada');
  },

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
      btn.className = `log-type-btn rounded-xl border p-2 text-center text-xs font-semibold transition ${
        active
          ? 'bg-white text-black border-white shadow'
          : 'bg-neutral-900 border-white/[0.08] text-neutral-400 hover:text-white'
      }`;
    });

    const dyn = $('dynamic-log-fields');
    if (type === 'riego_agua') {
      dyn.innerHTML = `
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">Litros</label>
            <input id="log-liters" type="number" step="0.25" value="2.0" class="ios-input w-full font-mono text-xs" required />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">pH</label>
            <input id="log-ph" type="number" step="0.1" placeholder="6.2" class="ios-input w-full font-mono text-xs" />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">EC</label>
            <input id="log-ec" type="number" step="0.1" placeholder="0.4" class="ios-input w-full font-mono text-xs" />
          </div>
        </div>
      `;
    } else if (type === 'riego_nutrientes') {
      dyn.innerHTML = `
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">Litros</label>
            <input id="log-liters" type="number" step="0.25" value="2.0" class="ios-input w-full font-mono text-xs" required />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">pH</label>
            <input id="log-ph" type="number" step="0.1" placeholder="6.2" class="ios-input w-full font-mono text-xs" />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">EC</label>
            <input id="log-ec" type="number" step="0.1" placeholder="1.2" class="ios-input w-full font-mono text-xs" />
          </div>
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">Productos de la Mezcla</label>
          <input id="log-products" type="text" placeholder="Ej: Top Bloom 3ml/L + Top Candy 2ml/L" class="ios-input w-full text-xs" />
        </div>
      `;
    } else if (type === 'foliar') {
      dyn.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">Tratamiento Foliar</label>
            <select id="log-foliar-type" class="ios-input w-full text-xs">
              <option value="Aceite de Neem + Jabón Potásico">🌿 Neem + Jabón Potásico</option>
              <option value="Bacillus thuringiensis (Bt)">🐛 Bacillus thuringiensis</option>
              <option value="Jabón Potásico solo">🧼 Jabón Potásico solo</option>
              <option value="Bioestimulante (Algas)">🍃 Algas / Bioestimulante</option>
              <option value="Otro tratamiento">🧪 Otro tratamiento</option>
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">Volumen</label>
            <input id="log-liters" type="number" step="0.5" value="1.0" class="ios-input w-full font-mono text-xs" />
          </div>
        </div>
      `;
    } else if (type === 'poda') {
      dyn.innerHTML = `
        <div>
          <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">Tipo de Intervención</label>
          <select id="log-prune-type" class="ios-input w-full text-xs">
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
            <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">Nueva Maceta</label>
            <input id="log-pot-size" type="text" placeholder="Ej: 15 L Geotextil" class="ios-input w-full text-xs" />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-neutral-400 mb-1 uppercase">Sustrato</label>
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
   5. MÓDULO RIEGO & NUTRIENTES (CALCULADORA MINIMALISTA)
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
            <span class="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Outdoor Hemisferio Sur</span>
            <span class="font-mono text-[11px] text-neutral-400">Buenos Aires / Argentina</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
            <div class="rounded-xl bg-neutral-900 border border-white/[0.06] p-2">
              <span class="text-[9px] uppercase font-bold text-neutral-400 block">Sept / Oct</span>
              <strong class="text-white text-xs block">🌱 Germinación</strong>
            </div>
            <div class="rounded-xl bg-neutral-900 border border-white/[0.06] p-2">
              <span class="text-[9px] uppercase font-bold text-neutral-400 block">Nov – Ene</span>
              <strong class="text-white text-xs block">🌿 Vegetativo</strong>
            </div>
            <div class="rounded-xl bg-neutral-900 border border-white/[0.06] p-2">
              <span class="text-[9px] uppercase font-bold text-neutral-400 block">Febrero</span>
              <strong class="text-white text-xs block">⚡ Pre-flora</strong>
            </div>
            <div class="rounded-xl bg-neutral-900 border border-white/[0.06] p-2">
              <span class="text-[9px] uppercase font-bold text-neutral-400 block">Mar / Abr</span>
              <strong class="text-white text-xs block">💎 Cosecha</strong>
            </div>
          </div>
        </div>
      `;
    } else {
      cont.innerHTML = `
        <div class="ios-card p-3.5 text-xs space-y-1 text-neutral-300">
          <span class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Modo Indoor (Semanas)</span>
          <p>Fotoperíodo <strong>18/6</strong> para crecimiento y <strong>12/12</strong> para inducir la floración.</p>
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
            active ? 'border-white bg-white text-black font-bold' : 'border-white/[0.08] bg-neutral-900 text-neutral-400 hover:text-white'
          }">
          <div class="text-xs leading-tight">${b.name}</div>
          <div class="text-[10px] opacity-75">${b.type}</div>
        </button>
      `;
    }).join('');

    const brandData = BRANDS[this.brand];
    $('result-title').textContent = `${brandData.name} · ${STAGES[this.stage].label}`;
    $('result-subtitle').textContent = `Dosis calculadas para ${this.liters} litros de agua`;

    const tbody = $('fertilizer-table-body');
    const rows = brandData.products.filter((p) => p.doses[this.stage] > 0);

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-neutral-500">Sin productos para esta etapa.</td></tr>`;
    } else {
      tbody.innerHTML = rows.map((p) => {
        const dose = p.doses[this.stage];
        const total = (dose * this.liters).toFixed(1);
        return `
          <tr class="hover:bg-white/[0.02]">
            <td class="py-2 pr-2 text-white font-medium">${p.name} <span class="text-[10px] text-neutral-500 block">${p.role}</span></td>
            <td class="py-2 px-2 text-right font-mono text-neutral-400">${dose} ${p.unit}/L</td>
            <td class="py-2 pl-2 text-right font-mono font-bold text-white">${total} ${p.unit}</td>
          </tr>
        `;
      }).join('');
    }

    $('mixing-protocol-box').innerHTML = `
      Mezclá bien cada producto en el agua antes de incorporar el siguiente. Medí y ajustá el pH al final.
    `;
  }
};

/* ==========================================================================
   6. MÓDULO CALENDARIO LUNAR (POÉTICO & MINIMALISTA)
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
    // Luna monocromática y limpia orientada al hemisferio sur
    $('lunar-hero-svg').innerHTML = `
      <svg viewBox="0 0 100 100" class="h-16 w-16">
        <circle cx="50" cy="50" r="44" fill="#141416" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
        <path d="M 50 6 A 44 44 0 0 0 50 94 A 12 44 0 0 1 50 6" fill="#ffffff"/>
      </svg>
    `;

    $('lunar-phase-title').textContent = 'Cuarto Menguante';
    $('lunar-phase-meta').textContent = 'Descenso de savia hacia las raíces';

    $('lunar-day-recommendation').innerHTML = `
      <span class="badge-mono text-[10px]">Labores recomendadas</span>
      <p class="text-white font-semibold text-xs mt-1">Podas, Trasplantes y Esquejes</p>
      <p class="text-neutral-400 text-[11px] mt-0.5">La savia desciende: menor estrés por herida y cicatrización óptima.</p>
    `;

    $('lunar-task-cards').innerHTML = `
      <div class="ios-card p-3 space-y-1 text-xs">
        <span class="text-white font-bold">🌱 Creciente / Llena</span>
        <p class="text-neutral-300">Germinación &amp; Foliares</p>
        <p class="text-[11px] text-neutral-500">Savia en ramas y hojas.</p>
      </div>
      <div class="ios-card p-3 space-y-1 text-xs border-white/20">
        <span class="text-white font-bold">✂️ Cuarto Menguante</span>
        <p class="text-neutral-300">Podas &amp; Trasplantes</p>
        <p class="text-[11px] text-neutral-500">Savia en raíces.</p>
      </div>
      <div class="ios-card p-3 space-y-1 text-xs">
        <span class="text-white font-bold">🌾 Luna Nueva</span>
        <p class="text-neutral-300">Cosecha &amp; Reposo</p>
        <p class="text-[11px] text-neutral-500">Menor humedad interna.</p>
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
        <div class="ios-card p-1 text-center min-h-[2.8rem] flex flex-col justify-between ${isKey ? 'border-white/30 bg-white/5' : ''}">
          <span class="text-[11px] font-mono font-medium text-neutral-300">${d}</span>
          <span class="text-[9px] text-white">${d === 9 ? '🌑' : d === 17 ? '🌓' : d === 24 ? '🌕' : '·'}</span>
        </div>
      `;
    }
    grid.innerHTML = cells;
  }
};

/* ==========================================================================
   7. MÓDULO CUIDADOS & PREVENCIÓN (MIP)
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
          <span class="badge-mono text-[10px]">Prevención Activa</span>
          <h3 class="text-base font-bold text-white mt-1">Próxima aplicación sugerida en 5 días</h3>
          <p class="text-xs text-neutral-400">Rutina cada ${interval} días al atardecer.</p>
        </div>
        <span class="text-2xl">🛡️</span>
      </div>
    `;

    $('pest-biocontrol-cards').innerHTML = `
      <div class="ios-card p-4 space-y-2 text-xs">
        <div class="flex items-center justify-between">
          <strong class="text-white text-sm">🌿 Aceite de Neem + Jabón Potásico</strong>
          <span class="badge-mono text-[10px]">Vegetativo</span>
        </div>
        <p class="text-neutral-400">Dosis para tu pulverizador de <strong>${liters} L</strong>:</p>
        <div class="flex gap-2 font-mono">
          <span class="badge-mono text-white">${(2 * liters).toFixed(1)} ml Neem</span>
          <span class="badge-mono text-white">${(5 * liters).toFixed(1)} ml Potásico</span>
        </div>
        <p class="text-neutral-400 text-[11px] mt-1">Previene trips, arañuela y mosca blanca. Aplicar en el envés de las hojas.</p>
      </div>

      <div class="ios-card p-4 space-y-2 text-xs">
        <div class="flex items-center justify-between">
          <strong class="text-white text-sm">🐛 Bacillus thuringiensis (Bt)</strong>
          <span class="badge-mono text-[10px]">Floración Outdoor</span>
        </div>
        <p class="text-neutral-400">Dosis para tu pulverizador de <strong>${liters} L</strong>:</p>
        <div class="font-mono">
          <span class="badge-mono text-white">${(1 * liters).toFixed(1)} g Bt en polvo</span>
        </div>
        <p class="text-neutral-400 text-[11px] mt-1">Control biológico de orugas e isocas que dañan los cogollos desde adentro.</p>
      </div>
    `;
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
      showToast('Copia JSON descargada');
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
        showToast('Copia restaurada con éxito');
      } catch {
        showToast('Archivo no válido');
      }
    });

    $('btn-reset-app').addEventListener('click', () => {
      if (!confirm('¿Restablecer todo a valores de fábrica? Se borrarán tus plantas locales.')) return;
      localStorage.clear();
      indexedDB.deleteDatabase(DB_NAME);
      location.reload();
    });

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
      a.download = `cannasur-resumen-${todayDateStr()}.png`;
      a.click();
      showToast('Imagen guardada');
    });

    $('btn-download-pdf').addEventListener('click', () => {
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
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');

    // Fondo monocromático profundo
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, 800, 1000);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px -apple-system, sans-serif';
    ctx.fillText('CannaSur — Resumen de Bitácora', 40, 60);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '15px monospace';
    ctx.fillText(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 40, 95);

    ctx.fillStyle = '#141416';
    ctx.fillRect(40, 120, 720, 180);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.fillText('🌱 Plantas en Seguimiento:', 60, 160);

    ctx.font = '15px -apple-system, sans-serif';
    ctx.fillStyle = '#d4d4d8';
    let y = 195;
    GrowlogsModule.plants.slice(0, 4).forEach((p) => {
      const days = daysDiff(p.germDate, todayDateStr());
      ctx.fillText(`• ${p.name} (${p.strain || p.type}) — Día ${days} (${STAGES[p.stage].label})`, 60, y);
      y += 28;
    });

    ctx.fillStyle = '#141416';
    ctx.fillRect(40, 330, 720, 220);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px -apple-system, sans-serif';
    ctx.fillText('💧 Riego y Nutrición Calculada:', 60, 370);

    ctx.fillStyle = '#d4d4d8';
    ctx.font = '15px -apple-system, sans-serif';
    ctx.fillText(`Línea: ${BRANDS[CalculatorModule.brand].name} · Etapa: ${STAGES[CalculatorModule.stage].label}`, 60, 405);
    ctx.fillText(`Volumen: ${CalculatorModule.liters} Litros`, 60, 435);
  }
};

/* ==========================================================================
   9. NAVEGACIÓN PRINCIPAL SPA (APPLE TAB BAR)
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

    if (viewId === 'growlogs' && !GrowlogsModule.activePlantId) {
      GrowlogsModule.showDashboard();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
