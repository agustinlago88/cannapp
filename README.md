# 🌿 CannaSur AR — Calculadora & Asistente de Cultivo de Cannabis
### Optimizado para el Hemisferio Sur (Argentina) 🇦🇷

**CannaSur AR** es una Single Page Application (SPA) responsiva y *mobile-first* diseñada con estética moderna dark-mode botánico para cultivadores en Argentina. Funciona 100% en el cliente (Vanilla JavaScript + Tailwind CSS vía CDN) sin necesidad de backend, lista para desplegar en **Vercel**, **GitHub Pages**, **Netlify** o como PWA en tu smartphone.

---

## 🚀 Características Principales

### 1. 🧪 Calculadora de Fertilizantes (Mineral y Orgánica)
- **Ingreso preciso de agua:** Desde 0.5 L hasta 500 L con incrementos rápidos (+ / −) y presets habituales (1L, 2L, 5L, 10L, 20L, 50L).
- **Líneas y marcas argentinas e internacionales:**
  - **Top Crop** (Bio-mineral): Deeper Underground, Top Veg, Top Bloom, Big One, Top Candy, Top Bud.
  - **Namaste Nutrientes** (Orgánica): Amazonia Roots, Oro Negro, Trico+, Flora Booster.
  - **Kawsay Nutrientes** (Mineral): Base A, Base B, Vege, Bloom, K9. Incluye compensación automática (+20%) para coco/hidroponía.
  - **Advanced Nutrients** (Mineral pH Perfect): pH Perfect Micro, Grow, Bloom, Voodoo Juice, B-52, Big Bud, Bud Candy, Overdrive.
- **Etapas fenológicas:** Plántula (enraizamiento), Vegetativo, Transición (stretch/pre-flora), Floración temprana y Floración tardía (engorde/maduración).
- **Tabla dinámica:** Calcula mililitros (o gramos) exactos según el volumen de riego, dosis por litro y parámetros objetivos de **pH** y **Electroconductividad (EC)** para sustrato o coco.
- **Protocolo de mezcla:** Orden estricto de dilución para evitar precipitación de nutrientes y advertencia de lavado final de raíces.

### 2. 🏠☀️ Modo de Cultivo: Indoor vs. Outdoor (Hemisferio Sur)
- **Toggle segmentado:** Alterna al instante la lógica de cálculo y recomendaciones.
- **Outdoor (Fotoperiódicas en Buenos Aires / Argentina):**
  - **Línea de tiempo anual:**
    - 🌱 **Germinación:** Septiembre / Octubre
    - 🌿 **Crecimiento Vegetativo:** Noviembre – Enero
    - ⚡ **Pre-floración:** Febrero
    - 🌾 **Floración & Cosecha:** Marzo / Abril
  - Cálculo en tiempo real de **horas de luz solar (fotoperíodo)** por latitud geográfica y detector de día actual dentro de la temporada.
- **Indoor:**
  - Control semana a semana con selector de duración de vegetativo (2 a 8 semanas) y floración (7 a 12 semanas).
  - Indicador de cambio a 12/12, lavado de raíces y fecha estimada de corte.

### 3. 🌙 Calendario Lunar Agrícola 2026 / 2027
- **Motor astronómico integrado (Algoritmos de Jean Meeus):** Precisión de minutos para todas las fases lunares en Hora Oficial Argentina (UTC-3).
- **Visualización lunar auténtica para el Hemisferio Sur:**
  - En el sur, la luna creciente forma una **"C"** (iluminada a la izquierda) y la menguante una **"D"** (iluminada a la derecha).
- **Guía biodinámica de savia:**
  - 🌔 **Cuarto Creciente / Luna Llena:** Ascenso de savia. Germinación y fertilización foliar.
  - 🌘 **Cuarto Menguante:** Savia hacia las raíces. Trasplantes, esquejes y podas (apical, FIM, defoliación).
  - 🌑 **Luna Nueva:** Reposo. Cosecha (menor humedad en flores) y tratamiento de plagas de raíz.
- Calendario mensual navegable (2026 y 2027) con filtros por labor cultural y lista de eventos astronómicos exactos del mes.

### 4. 🛡️ Calendario Preventivo de Plagas (MIP)
- **Alertas y cronograma de aplicaciones:** Intervalos configurables de 10, 12 o 15 días.
- **Calculadora para pulverizador:** Calcula las dosis exactas para pulverizadores de 0.5 L, 1 L, 1.5 L, 2 L y mochilas de 5 L.
- **Protocolos biológicos específicos:**
  - 🌿 **Aceite de Neem + Jabón Potásico:** Emulsión preventiva contra trips, mosca blanca, pulgón y arañuela roja (con corte estricto antes del engorde floral).
  - 🐛 **Bacillus thuringiensis (Bt kurstaki):** Vital en Outdoor contra la oruga/isoca bolillera (*Helicoverpa*) y cogollera que causan pudrición de cogollos (*Botrytis*).

### 5. 📄 Exportación de Rutina (PDF & Imagen PNG)
- Generación en el cliente mediante **Canvas HD (1080px)** y **jsPDF**:
  - Exporta una ficha técnica profesional con el nombre del cultivo, etapa, tabla de fertilizantes, ventana lunar activa y cronograma de plagas.
  - Opción de descarga directa como archivo **PDF** o como imagen **PNG** de alta resolución (ideal para compartir por WhatsApp o imprimir).

---

## 🛠️ Tecnologías Utilizadas

- **HTML5 semántico** con estructura de vistas SPA.
- **Tailwind CSS (CDN)**: Paleta botánica oscura (`#060b08`), acentos verde esmeralda y lima.
- **Vanilla JavaScript (ES6+)**: Modularizado, reactivo y sin frameworks pesados.
- **jsPDF (CDN)**: Para renderizado e impresión de PDFs.
- **LocalStorage**: Persistencia automática de configuraciones, litros, marca e historial de aplicaciones.

---

## 📦 Despliegue en 1 Clic

### 1. Vercel
1. Instala la CLI de Vercel con `npm i -g vercel` o conecta este repositorio directamente en [vercel.com](https://vercel.com).
2. Como es un sitio estático puro, simplemente ejecuta:
   ```bash
   vercel
   ```
3. Acepta los valores por defecto (Root Directory `./`, Framework `Other`).

### 2. GitHub Pages
1. Sube los archivos (`index.html`, `styles.css`, `app.js`) a un repositorio en GitHub.
2. Ve a **Settings** → **Pages**.
3. En **Source**, selecciona `Deploy from a branch` → Rama `main` (o `master`) → Carpeta `/ (root)`.
4. Guarda y en un minuto tu app estará disponible en `https://<tu-usuario>.github.io/<tu-repo>/`.

### 3. Prueba Local
Puedes abrir directamente el archivo `index.html` con doble clic en cualquier navegador, o servirlo con cualquier servidor local:
```bash
# Con Python
python -m http.server 8080

# O con npx
npx serve .
```
Accede desde tu navegador en `http://localhost:8080`.

---

## ⚖️ Aviso Legal
Esta aplicación es una herramienta técnica agronómica para el cálculo de nutrientes y buenas prácticas de manejo integrado de plagas, orientada al cultivo legal y medicinal bajo el marco de la **Ley 27.350** y el programa **REPROCANN** de la República Argentina.
