// --- CONFIGURATION & ÉTAT GLOBAL ---
let currentUser = null;
let systemSpecsLoaded = false;
let logCacheJson = '';
let statusIntervalId = null;
let logsIntervalId = null;

// --- RÉFÉRENCES DOM ---

// Écrans
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');

// Formulaires d'Auth
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authAlert = document.getElementById('auth-alert');
const goToRegister = document.getElementById('go-to-register');
const goToLogin = document.getElementById('go-to-login');

// Inputs Auth
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const registerNameInput = document.getElementById('register-name');
const registerUsernameInput = document.getElementById('register-username');
const registerPasswordInput = document.getElementById('register-password');

// Informations Utilisateur
const userDisplayName = document.getElementById('user-display-name');
const userRoleBadge = document.getElementById('user-role-badge');
const avatarChar = document.getElementById('avatar-char');
const btnLogout = document.getElementById('btn-logout');

// Éléments du Dashboard
const uptimeValue = document.getElementById('uptime-value');
const cpuValue = document.getElementById('cpu-value');
const cpuCircle = document.getElementById('cpu-circle');
const ramPercentage = document.getElementById('ram-percentage');
const ramDetails = document.getElementById('ram-details');
const ramProgress = document.getElementById('ram-progress');
const requestCount = document.getElementById('request-count');
const dbStatusText = document.getElementById('db-status-text');
const systemSpecs = document.getElementById('system-specs');

// Panels selon le rôle
const adminPanel = document.getElementById('admin-panel');
const userPanel = document.getElementById('user-panel');

// Éléments Admin
const usersCount = document.getElementById('users-count');
const usersTableBody = document.getElementById('users-table-body');
const surrealQueryInput = document.getElementById('surreal-query-input');
const btnRunQuery = document.getElementById('btn-run-query');
const surrealConsoleOutput = document.getElementById('surreal-console-output');
const presetButtons = document.querySelectorAll('.btn-preset');
const logsConsole = document.getElementById('logs-console');
const logFilterButtons = document.querySelectorAll('.filter-btn');

// Éléments Standard User
const welcomeUserName = document.getElementById('welcome-user-name');
const userLatencyVal = document.getElementById('user-latency-val');

// --- INITIALISATION DU GRAPH CPU (Cercle SVG) ---
let circumference = 0;
if (cpuCircle) {
  const radius = cpuCircle.r.baseVal.value;
  circumference = radius * 2 * Math.PI;
  cpuCircle.style.strokeDasharray = `${circumference} ${circumference}`;
  cpuCircle.style.strokeDashoffset = circumference;
}

function setCpuProgress(percent) {
  if (!cpuCircle || !cpuValue) return;
  const offset = circumference - (percent / 100 * circumference);
  cpuCircle.style.strokeDashoffset = offset;
  cpuValue.textContent = `${percent}%`;
}

// --- UTILS ET FORMATAGE ---

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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

// --- GESTION DES NOTIFICATIONS D'AUTH ---
function showAlert(message, type = 'error') {
  authAlert.textContent = message;
  authAlert.className = `alert-box ${type}`;
  setTimeout(() => {
    authAlert.className = 'alert-box hide';
  }, 5000);
}

// --- BASCULE DE VUES (Login vs Register) ---
goToRegister.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hide');
  registerForm.classList.remove('hide');
  authAlert.className = 'alert-box hide';
});

goToLogin.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.add('hide');
  loginForm.classList.remove('hide');
  authAlert.className = 'alert-box hide';
});

// --- GESTION ROUTING / ÉTAT DE SESSION ---
async function checkAuthSession() {
  const token = localStorage.getItem('token');
  if (!token) {
    showAuthView();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      showDashboardView();
    } else {
      localStorage.removeItem('token');
      showAuthView();
    }
  } catch (err) {
    console.error('Erreur session:', err);
    showAuthView();
  }
}

function showAuthView() {
  stopIntervals();
  currentUser = null;
  dashboardScreen.classList.add('hide');
  authScreen.classList.remove('hide');
}

function showDashboardView() {
  authScreen.classList.add('hide');
  dashboardScreen.classList.remove('hide');

  // Mettre à jour les infos utilisateur dans le header
  userDisplayName.textContent = currentUser.name;
  userRoleBadge.textContent = currentUser.role;
  userRoleBadge.className = `user-role-badge ${currentUser.role}`;
  avatarChar.textContent = currentUser.name.charAt(0);

  // Basculer l'affichage selon le rôle
  if (currentUser.role === 'admin') {
    adminPanel.classList.remove('hide');
    userPanel.classList.add('hide');
    loadAdminData();
    startAdminIntervals();
  } else {
    adminPanel.classList.add('hide');
    userPanel.classList.remove('hide');
    welcomeUserName.textContent = currentUser.name;
    startUserIntervals();
  }
}

function stopIntervals() {
  if (statusIntervalId) clearInterval(statusIntervalId);
  if (logsIntervalId) clearInterval(logsIntervalId);
  statusIntervalId = null;
  logsIntervalId = null;
  systemSpecsLoaded = false;
  logCacheJson = '';
}

// --- FORMULAIRES API INTERACTION ---

// Connexion
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = loginUsernameInput.value;
  const password = loginPasswordInput.value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('token', data.token);
      currentUser = data.user;
      loginUsernameInput.value = '';
      loginPasswordInput.value = '';
      showDashboardView();
    } else {
      showAlert(data.message || 'Échec de la connexion.');
    }
  } catch (err) {
    showAlert('Une erreur réseau s\'est produite.');
  }
});

// Inscription
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = registerNameInput.value;
  const username = registerUsernameInput.value;
  const password = registerPasswordInput.value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password })
    });
    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('token', data.token);
      currentUser = data.user;
      registerNameInput.value = '';
      registerUsernameInput.value = '';
      registerPasswordInput.value = '';
      registerForm.classList.add('hide');
      loginForm.classList.remove('hide');
      showDashboardView();
    } else {
      showAlert(data.message || 'Échec de l\'inscription.');
    }
  } catch (err) {
    showAlert('Une erreur réseau s\'est produite.');
  }
});

// Déconnexion
btnLogout.addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getHeaders()
    });
  } catch (err) {
    console.error('Erreur lors du logout:', err);
  } finally {
    localStorage.removeItem('token');
    showAuthView();
  }
});

// --- RENSEIGNER LES MÈTRIQUES EN TEMPS RÉEL ---

async function fetchStatus() {
  try {
    const res = await fetch('/api/status', {
      headers: getHeaders()
    });
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('token');
        showAuthView();
        return;
      }
      throw new Error('Erreur statut');
    }
    const data = await res.json();

    // Mettre à jour l'Uptime
    uptimeValue.textContent = formatUptime(data.uptime);

    // Mettre à jour le CPU
    setCpuProgress(data.simulatedCpu);

    // Mettre à jour la RAM
    const totalMem = data.system.memory.total;
    const usedMem = data.system.memory.used;
    const usedPercent = Math.round((usedMem / totalMem) * 100);
    ramPercentage.textContent = `${usedPercent}%`;
    ramDetails.textContent = `${formatBytes(usedMem, 1)} / ${formatBytes(totalMem, 1)}`;
    ramProgress.style.width = `${usedPercent}%`;

    // Requêtes
    requestCount.textContent = data.requestCount;

    // Latence utilisateur
    if (userLatencyVal) {
      userLatencyVal.textContent = `${data.simulatedLatency}ms`;
    }

    // Charger les specs système une seule fois
    if (!systemSpecsLoaded) {
      const sys = data.system;
      systemSpecs.textContent = `OS: ${sys.platform} (${sys.arch}) | CPU: ${sys.cpuCount} Cores`;
      systemSpecsLoaded = true;
    }

    dbStatusText.textContent = 'EN LIGNE';
    dbStatusText.className = 'status-online-text';

  } catch (err) {
    console.error('Erreur fetchStatus:', err);
    dbStatusText.textContent = 'HORS LIGNE';
    dbStatusText.className = 'text-red';
  }
}

// --- INTERVALLES ---
function startUserIntervals() {
  fetchStatus();
  statusIntervalId = setInterval(fetchStatus, 2000);
}

function startAdminIntervals() {
  fetchStatus();
  fetchLogs();
  statusIntervalId = setInterval(fetchStatus, 1500);
  logsIntervalId = setInterval(fetchLogs, 2500);
}

// --- DONNÉES SPÉCIFIQUES ADMIN ---

async function loadAdminData() {
  // Charger la liste des utilisateurs
  try {
    const res = await fetch('/api/admin/users', { headers: getHeaders() });
    if (res.ok) {
      const users = await res.json();
      usersCount.textContent = users.length;
      renderUsersTable(users);
    }
  } catch (err) {
    console.error('Erreur chargement utilisateurs admin:', err);
  }
}

function renderUsersTable(users) {
  usersTableBody.innerHTML = '';
  users.forEach(u => {
    const row = document.createElement('tr');
    
    // Formater la date de création
    let createdDate = 'N/A';
    if (u.createdAt) {
      createdDate = new Date(u.createdAt).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    row.innerHTML = `
      <td style="font-weight: 600;">${escapeHTML(u.name)}</td>
      <td class="font-mono text-cyan" style="font-size: 0.8rem;">${escapeHTML(u.username)}</td>
      <td><span class="pill-badge" style="background: ${u.role === 'admin' ? 'rgba(245,158,11,0.1)' : 'rgba(6,182,212,0.1)'}; color: ${u.role === 'admin' ? 'var(--warning)' : 'var(--secondary)'}; border-color: transparent;">${u.role}</span></td>
      <td style="color: var(--text-muted); font-size: 0.8rem;">${createdDate}</td>
    `;
    usersTableBody.appendChild(row);
  });
}

// Console SurrealQL
btnRunQuery.addEventListener('click', executeSurrealQuery);

async function executeSurrealQuery() {
  const query = surrealQueryInput.value.trim();
  if (!query) return;

  surrealConsoleOutput.textContent = 'Exécution de la requête en cours...';
  
  try {
    const res = await fetch('/api/admin/query', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    
    surrealConsoleOutput.textContent = JSON.stringify(data, null, 2);
    surrealConsoleOutput.scrollTop = 0;
    
    // Si la requête modifie des données, recharger la liste des utilisateurs
    if (query.toUpperCase().includes('CREATE') || query.toUpperCase().includes('UPDATE') || query.toUpperCase().includes('DELETE') || query.toUpperCase().includes('INSERT')) {
      loadAdminData();
    }
  } catch (err) {
    surrealConsoleOutput.textContent = `Erreur de communication : ${err.message}`;
  }
}

// Preset Queries de la console SurrealQL
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const query = btn.getAttribute('data-query');
    surrealQueryInput.value = query;
    executeSurrealQuery();
  });
});

// Renseigner les logs
let activeLogLevelFilter = 'all';

async function fetchLogs() {
  try {
    const res = await fetch('/api/logs', { headers: getHeaders() });
    if (!res.ok) return;
    const logs = await res.json();
    
    // Éviter de re-render si aucun nouveau log
    const logsJsonString = JSON.stringify(logs);
    if (logsJsonString === logCacheJson) return;
    logCacheJson = logsJsonString;

    renderLogs(logs);
  } catch (err) {
    console.error('Erreur logs:', err);
  }
}

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

  if (isScrolledToBottom) {
    logsConsole.scrollTop = logsConsole.scrollHeight;
  }
}

// Filtres de logs
logFilterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    logFilterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLogLevelFilter = btn.getAttribute('data-level');
    
    try {
      const logs = JSON.parse(logCacheJson || '[]');
      renderLogs(logs);
    } catch (e) {
      fetchLogs();
    }
  });
});

// --- Lancement au chargement de la page ---
checkAuthSession();
