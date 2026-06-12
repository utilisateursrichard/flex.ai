// Configuration & Variables globales
let activeLogLevelFilter = 'all';
let systemSpecsLoaded = false;
let logCacheJson = '';

// Références DOM
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const uptimeValue = document.getElementById('uptime-value');
const cpuValue = document.getElementById('cpu-value');
const cpuCircle = document.getElementById('cpu-circle');
const ramPercentage = document.getElementById('ram-percentage');
const ramDetails = document.getElementById('ram-details');
const ramProgress = document.getElementById('ram-progress');
const heapUsage = document.getElementById('heap-usage');
const requestCount = document.getElementById('request-count');
const latencyValue = document.getElementById('latency-value');
const latencyBadge = document.getElementById('latency-badge');
const systemSpecs = document.getElementById('system-specs');

const configForm = document.getElementById('config-form');
const latencyRange = document.getElementById('latency-range');
const latencySliderVal = document.getElementById('latency-slider-val');
const maintenanceToggle = document.getElementById('maintenance-toggle');

const btnTestOk = document.getElementById('btn-test-ok');
const btnTestError = document.getElementById('btn-test-error');
const jsonViewer = document.getElementById('json-viewer');

const logsConsole = document.getElementById('logs-console');
const btnClearLogs = document.getElementById('btn-clear-logs');
const filterButtons = document.querySelectorAll('.filter-btn');

// Initialiser le cercle de progression CPU
const radius = cpuCircle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;
cpuCircle.style.strokeDasharray = `${circumference} ${circumference}`;
cpuCircle.style.strokeDashoffset = circumference;

function setCpuProgress(percent) {
  const offset = circumference - (percent / 100 * circumference);
  cpuCircle.style.strokeDashoffset = offset;
  cpuValue.textContent = `${percent}%`;
}

// Formater l'uptime en HH:MM:SS
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Formater la taille des octets
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Récupérer le statut du serveur
async function fetchServerStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Erreur HTTP');
    const data = await res.json();

    // Mettre à jour le statut en ligne/maintenance
    if (data.status === 'online') {
      statusIndicator.className = 'status-badge status-online';
      statusText.textContent = 'EN LIGNE';
    } else {
      statusIndicator.className = 'status-badge status-maintenance';
      statusText.textContent = 'MAINTENANCE';
    }

    // Uptime
    uptimeValue.textContent = formatUptime(data.uptime);

    // CPU
    setCpuProgress(data.simulatedCpu);

    // RAM
    const totalMem = data.system.memory.total;
    const usedMem = data.system.memory.used;
    const usedPercent = Math.round((usedMem / totalMem) * 100);
    ramPercentage.textContent = `${usedPercent}%`;
    ramDetails.textContent = `${formatBytes(usedMem, 1)} / ${formatBytes(totalMem, 1)}`;
    ramProgress.style.width = `${usedPercent}%`;
    heapUsage.textContent = `Processus Node.js : ${formatBytes(data.system.memory.processUsed, 2)}`;

    // Requêtes
    requestCount.textContent = data.requestCount;

    // Latence active
    const latency = data.simulatedLatency;
    latencyValue.textContent = `${latency}ms`;
    if (latency === 0) {
      latencyBadge.className = 'badge-pill pill-green';
      latencyBadge.textContent = 'INSTANTANÉ';
    } else if (latency <= 500) {
      latencyBadge.className = 'badge-pill pill-orange';
      latencyBadge.textContent = 'MODÉRÉ';
    } else {
      latencyBadge.className = 'badge-pill pill-red';
      latencyBadge.textContent = 'TRÈS LENT';
    }

    // Charger les specs système une seule fois
    if (!systemSpecsLoaded) {
      const sys = data.system;
      systemSpecs.textContent = `OS: ${sys.platform} (${sys.arch}) | CPU: ${sys.cpuCount} Cores`;
      // Synchroniser le formulaire au premier chargement
      latencyRange.value = latency;
      latencySliderVal.textContent = `${latency}ms`;
      maintenanceToggle.checked = data.maintenanceMode;
      systemSpecsLoaded = true;
    }

  } catch (err) {
    console.error('Erreur lors de la récupération du statut:', err);
    statusIndicator.className = 'status-badge status-maintenance';
    statusText.textContent = 'HORS LIGNE';
    uptimeValue.textContent = '--:--:--';
    setCpuProgress(0);
  }
}

// Récupérer les logs
async function fetchLogs() {
  try {
    const res = await fetch('/api/logs');
    if (!res.ok) throw new Error('Erreur de logs');
    const logs = await res.json();
    
    // Comparer avec le cache pour éviter les re-renders inutiles
    const logsJsonString = JSON.stringify(logs);
    if (logsJsonString === logCacheJson) return;
    logCacheJson = logsJsonString;

    renderLogs(logs);
  } catch (err) {
    console.error('Erreur lors de la récupération des logs:', err);
  }
}

// Afficher les logs dans la console
function renderLogs(logs) {
  const isScrolledToBottom = logsConsole.scrollHeight - logsConsole.clientHeight <= logsConsole.scrollTop + 10;
  
  logsConsole.innerHTML = '';
  
  const filteredLogs = logs.filter(log => {
    if (activeLogLevelFilter === 'all') return true;
    return log.level === activeLogLevelFilter;
  });

  if (filteredLogs.length === 0) {
    logsConsole.innerHTML = `<div style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Aucun log disponible pour ce filtre.</div>`;
    return;
  }

  filteredLogs.forEach(log => {
    const timeStr = new Date(log.timestamp).toLocaleTimeString();
    
    const line = document.createElement('div');
    line.className = 'log-line';
    
    line.innerHTML = `
      <span class="log-time">[${timeStr}]</span>
      <span class="log-level level-${log.level}">${log.level}</span>
      <span class="log-msg">${escapeHTML(log.message)}</span>
      <span class="log-source">${log.source}</span>
    `;
    
    logsConsole.appendChild(line);
  });

  // Défilement automatique vers le bas si l'utilisateur était déjà en bas
  if (isScrolledToBottom) {
    logsConsole.scrollTop = logsConsole.scrollHeight;
  }
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Mettre à jour l'affichage du slider en direct
latencyRange.addEventListener('input', (e) => {
  latencySliderVal.textContent = `${e.target.value}ms`;
});

// Enregistrer la configuration du serveur
configForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const latency = parseInt(latencyRange.value);
  const maintenance = maintenanceToggle.checked;
  
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latency, maintenance })
    });
    
    const data = await res.json();
    
    // Afficher le retour dans le visualiseur JSON
    showJsonResponse({
      action: 'Mise à jour de la configuration',
      status: res.status,
      response: data
    });
    
    // Forcer la mise à jour immédiate des métriques
    fetchServerStatus();
    fetchLogs();
  } catch (err) {
    showJsonResponse({ error: 'Échec de la configuration', details: err.message });
  }
});

// Afficher les réponses d'API dans la console interactive
function showJsonResponse(data) {
  jsonViewer.textContent = JSON.stringify(data, null, 2);
  jsonViewer.scrollTop = 0;
}

// Tester un endpoint
async function testEndpoint(url, name) {
  jsonViewer.textContent = `Appel de ${url} en cours...`;
  const startTime = performance.now();
  
  try {
    const res = await fetch(url);
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    let body;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    
    const headers = {};
    res.headers.forEach((val, key) => {
      headers[key] = val;
    });

    showJsonResponse({
      request: {
        endpoint: url,
        method: 'GET',
        simulatedLatency: `${latencyRange.value}ms`
      },
      response: {
        status: `${res.status} ${res.statusText}`,
        time: `${duration}ms`,
        headers: {
          'content-type': headers['content-type'],
          'connection': headers['connection']
        },
        body: body
      }
    });

    // Mettre à jour immédiatement
    fetchServerStatus();
    fetchLogs();

  } catch (err) {
    showJsonResponse({
      error: `Échec du test sur ${name}`,
      message: err.message
    });
  }
}

// Actions de test
btnTestOk.addEventListener('click', () => {
  testEndpoint('/api/test-endpoint', '/api/test-endpoint');
});

btnTestError.addEventListener('click', () => {
  testEndpoint('/api/trigger-error', '/api/trigger-error');
});

// Vider localement l'historique dans l'interface
btnClearLogs.addEventListener('click', () => {
  logsConsole.innerHTML = `<div style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Historique de la console vidé.</div>`;
  logCacheJson = '[]';
});

// Filtres de niveau de logs
filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLogLevelFilter = btn.getAttribute('data-level');
    
    // Forcer le re-rendu immédiat des logs
    try {
      const logs = JSON.parse(logCacheJson || '[]');
      renderLogs(logs);
    } catch (e) {
      fetchLogs();
    }
  });
});

// Démarrer les boucles de mise à jour périodiques
fetchServerStatus();
fetchLogs();

setInterval(fetchServerStatus, 1500);
setInterval(fetchLogs, 2500);
