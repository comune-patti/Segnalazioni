// ═══════════════════════════════════════════════════════════
//  app.js — Logica principale SegnalaOra
// ═══════════════════════════════════════════════════════════

// ─── STATE ───────────────────────────────────────────────
const state = {
  currentScreen: 'home',
  gps: null,
  gpsAddress: null,
  photoBase64: null,
  selectedCat: null,
  deviceId: null,
  reports: [],           // cache segnalazioni dal server
};

// Genera/recupera device ID anonimo
function getDeviceId() {
  let id = sessionStorage.getItem('segnala_device');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substr(2, 12);
    sessionStorage.setItem('segnala_device', id);
  }
  return id;
}
state.deviceId = getDeviceId();

// ─── CLOCK ───────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.getHours().toString().padStart(2,'0') + ':' +
    now.getMinutes().toString().padStart(2,'0');
}
updateClock();
setInterval(updateClock, 10000);

// ─── SCREEN NAVIGATION ───────────────────────────────────
function goScreen(name, direction = 'forward') {
  const current = document.getElementById('screen-' + state.currentScreen);
  const next    = document.getElementById('screen-' + name);
  if (!next) return;

  current.classList.remove('active');
  next.classList.remove('slide-in', 'slide-back');
  next.classList.add('active');

  // animation
  void next.offsetWidth; // reflow
  next.classList.add(direction === 'forward' ? 'slide-in' : 'slide-back');

  state.currentScreen = name;

  // On navigate to screens, trigger loads
  if (name === 'home') loadHomeReports();
  if (name === 'mine') loadMyReports();
  if (name === 'report') initReportScreen();
}

// ─── TOAST ───────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ─── GPS ─────────────────────────────────────────────────
async function getGPS() {
  const strip = document.getElementById('gps-strip');
  const txt   = document.getElementById('gps-text');
  strip.className = 'gps-strip loading';
  txt.textContent = 'Rilevamento posizione...';

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      txt.textContent = 'GPS non disponibile';
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        state.gps = { lat, lng };

        // Reverse geocoding via Nominatim (gratuito, no API key)
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=it`
          );
          const d = await r.json();
          const road  = d.address.road || d.address.pedestrian || '';
          const hn    = d.address.house_number ? ' ' + d.address.house_number : '';
          const city  = d.address.city || d.address.town || d.address.village || '';
          state.gpsAddress = (road + hn + (city ? ', ' + city : '')) || `${lat}, ${lng}`;
        } catch {
          state.gpsAddress = `${lat}, ${lng}`;
        }

        strip.className = 'gps-strip';
        txt.textContent = state.gpsAddress;
        const badge = document.getElementById('gps-badge');
        if (badge) badge.textContent = '📍 ' + state.gpsAddress;
        resolve(state.gps);
      },
      () => {
        txt.textContent = 'Posizione non disponibile — inserisci manualmente';
        strip.className = 'gps-strip loading';
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// ─── REPORT SCREEN INIT ──────────────────────────────────
function initReportScreen() {
  // Reset form
  state.photoBase64  = null;
  state.selectedCat  = null;
  document.getElementById('camera-area').className = 'camera-area';
  document.getElementById('note-input').value = '';
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('send-btn').disabled = false;
  document.getElementById('send-btn').textContent = '📤 INVIA SEGNALAZIONE';

  // Start GPS
  getGPS();
}

// ─── PHOTO ───────────────────────────────────────────────
function triggerPhoto() {
  document.getElementById('photo-input').click();
}

function handlePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const base64 = ev.target.result;
    state.photoBase64 = base64;

    // Show preview
    document.getElementById('photo-img').src = base64;
    document.getElementById('camera-area').classList.add('has-photo');

    // Update GPS badge
    const badge = document.getElementById('gps-badge');
    badge.textContent = state.gpsAddress ? '📍 ' + state.gpsAddress : '📍 GPS...';
  };
  reader.readAsDataURL(file);
}

// ─── CATEGORY ────────────────────────────────────────────
function selectCat(btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.selectedCat = btn.dataset.cat;
}

// ─── SUBMIT ──────────────────────────────────────────────
async function submitReport() {
  if (!state.selectedCat) {
    showToast('⚠️ Seleziona una categoria', 'error');
    return;
  }

  const btn = document.getElementById('send-btn');
  btn.disabled  = true;
  btn.innerHTML = '<span style="animation:spin 0.8s linear infinite;display:inline-block;border:3px solid #0d1117;border-top-color:#0d1117aa;border-radius:50%;width:20px;height:20px;"></span> Invio in corso...';

  const payload = {
    action:    'submit',
    deviceId:  state.deviceId,
    categoria: state.selectedCat,
    note:      document.getElementById('note-input').value.trim(),
    lat:       state.gps?.lat || '',
    lng:       state.gps?.lng || '',
    indirizzo: state.gpsAddress || '',
    foto:      state.photoBase64 || '',   // base64 — Apps Script la salva su Drive
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.status === 'ok') {
      // Populate success screen
      document.getElementById('ticket-id').textContent   = '#' + data.id;
      document.getElementById('ticket-cat').textContent  = state.selectedCat;
      document.getElementById('ticket-addr').textContent = state.gpsAddress || 'N/A';
      document.getElementById('ticket-date').textContent =
        new Date().toLocaleDateString('it-IT', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });

      // Save locally for "Le mie"
      const mine = JSON.parse(sessionStorage.getItem('my_reports') || '[]');
      mine.unshift({ id: data.id, cat: state.selectedCat, addr: state.gpsAddress, date: new Date().toISOString(), status: 'Aperta' });
      sessionStorage.setItem('my_reports', JSON.stringify(mine.slice(0, 50)));

      goScreen('success', 'forward');
    } else {
      throw new Error(data.message || 'Errore server');
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Errore invio. Riprova tra poco.', 'error');
    btn.disabled  = false;
    btn.innerHTML = '📤 INVIA SEGNALAZIONE';
  }
}

// ─── LOAD REPORTS ────────────────────────────────────────
async function loadHomeReports() {
  const el = document.getElementById('home-list');
  el.innerHTML = '<div class="spinner"></div>';

  try {
    const res  = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=list&limit=${CONFIG.HOME_LIMIT}`);
    const data = await res.json();

    if (data.status === 'ok') {
      state.reports = data.rows;
      updateStats(data.stats);
      renderReportList(el, data.rows);
    } else {
      el.innerHTML = '<div class="empty-state"><span class="big">🌐</span>Impossibile caricare i dati.<br>Controlla la connessione.</div>';
    }
  } catch {
    el.innerHTML = '<div class="empty-state"><span class="big">🌐</span>Impossibile caricare i dati.<br>Controlla la connessione.</div>';
  }
}

async function loadMyReports() {
  const el = document.getElementById('mine-list');
  el.innerHTML = '<div class="spinner"></div>';

  // Mostra segnalazioni salvate in sessione (inviate da questo device)
  const mine = JSON.parse(sessionStorage.getItem('my_reports') || '[]');

  if (mine.length === 0) {
    el.innerHTML = '<div class="empty-state"><span class="big">📭</span>Non hai ancora inviato segnalazioni.<br>Toccca 📸 per iniziare!</div>';
    return;
  }

  // Se il server supporta filtro per device, usa quello
  if (!CONFIG.SOLO_MIE) {
    try {
      const res  = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=list&deviceId=${state.deviceId}`);
      const data = await res.json();
      if (data.status === 'ok') { renderReportList(el, data.rows); return; }
    } catch {}
  }

  // Fallback: lista dalla sessione
  renderReportList(el, mine.map(r => ({
    id: r.id, categoria: r.cat, indirizzo: r.addr,
    timestamp: r.date, stato: r.status,
  })));
}

function updateStats(stats) {
  if (!stats) return;
  document.getElementById('stat-open').textContent = stats.aperte  ?? '–';
  document.getElementById('stat-wip').textContent  = stats.incorso ?? '–';
  document.getElementById('stat-done').textContent = stats.risolte ?? '–';
}

// ─── RENDER LIST ─────────────────────────────────────────
const CAT_EMOJI = {
  'Buche/Asfalto': '🕳️', 'Illuminazione': '💡', 'Rifiuti': '🗑️',
  'Verde pubblico': '🌳', 'Vandalismi': '🚧', 'Segnaletica': '🚦',
  'Marciapiedi': '🧱', 'Acqua/Fognature': '💧', 'Altro': '📌',
};

const STATUS_BADGE = {
  'Aperta':     'badge-red',
  'In corso':   'badge-yellow',
  'Risolta':    'badge-green',
};

function renderReportList(container, rows) {
  if (!rows || rows.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="big">✨</span>Nessuna segnalazione ancora.<br>Sii il primo!</div>';
    return;
  }

  container.innerHTML = rows.map(r => {
    const emoji = CAT_EMOJI[r.categoria] || '📌';
    const stato = r.stato || 'Aperta';
    const bclass = STATUS_BADGE[stato] || 'badge-red';
    const when   = timeAgo(r.timestamp);
    const addr   = r.indirizzo ? r.indirizzo.split(',')[0] : 'Posizione non disponibile';

    return `
      <div class="report-card">
        <div class="r-thumb">${emoji}</div>
        <div class="r-info">
          <div class="r-title">${r.categoria}</div>
          <div class="r-meta">${addr} • ${when}</div>
        </div>
        <div class="badge ${bclass}">${stato}</div>
      </div>`;
  }).join('');
}

// ─── TIME AGO ────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'adesso';
  if (diff < 3600)  return Math.floor(diff/60) + 'm fa';
  if (diff < 86400) return Math.floor(diff/3600) + 'h fa';
  return Math.floor(diff/86400) + 'g fa';
}

// ─── INIT ─────────────────────────────────────────────────
loadHomeReports();
