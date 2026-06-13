// --- GESTION DU THÈME ---
const btnThemeToggle = document.getElementById('btn-theme-toggle');

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    if (btnThemeToggle) btnThemeToggle.textContent = '🌙';
  } else {
    document.body.classList.remove('dark-theme');
    if (btnThemeToggle) btnThemeToggle.textContent = '☀️';
  }
}

initTheme();

if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    btnThemeToggle.textContent = isDark ? '🌙' : '☀️';
  });
}

// --- CONFIGURATION & ÉTAT GLOBAL ---
let currentUser = null;
let systemSpecsLoaded = false;
let logCacheJson = '';
let statusIntervalId = null;
let logsIntervalId = null;

// --- RÉFÉRENCES DOM ---
const dashboardScreen = document.getElementById('dashboard-screen');

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

// Éléments Standard User (Chatbot & Sidebar)
const sidebarMenu = document.getElementById('sidebar-menu');
const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
const btnSidebarClose = document.getElementById('btn-sidebar-close');
const btnNewChat = document.getElementById('btn-new-chat');
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingsModal = document.getElementById('settings-modal');

const chatContainer = document.getElementById('chat-container');
const chatWelcome = document.getElementById('chat-welcome');
const chatUserName = document.getElementById('chat-user-name');
const chatGreeting = document.getElementById('chat-greeting');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
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
  return {
    'Content-Type': 'application/json'
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

// --- GESTION ROUTING / ÉTAT DE SESSION ---
async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      showDashboardView();
    } else {
      handleInvalidSession();
    }
  } catch (err) {
    console.error('Erreur session:', err);
    handleInvalidSession();
  }
}

function handleInvalidSession() {
  window.location.replace('/');
}

function getRandomGreeting(name) {
  const hour = new Date().getHours();
  const escapedName = escapeHTML(name);
  const nameSpan = `<span id="chat-user-name">${escapedName}</span>`;
  let greetings = [];

  switch (hour) {
    case 0:
      greetings = [
        `Que puis-je faire pour vous en ce début de nuit, ${nameSpan} ?`,
        `Besoin d'un coup de pouce nocturne, ${nameSpan} ?`,
        `Bienvenue, ${nameSpan}. Une idée à explorer ce soir ?`,
        `À votre écoute pour cette fin de journée, ${nameSpan}.`
      ];
      break;
    case 1:
      greetings = [
        `Une inspiration nocturne, ${nameSpan} ? Je vous écoute.`,
        `Besoin d'aide sur un sujet précis, ${nameSpan} ?`,
        `Ravi de vous retrouver, ${nameSpan}. Que faisons-nous ?`,
        `À votre écoute, ${nameSpan}. Comment puis-je vous aider ?`
      ];
      break;
    case 2:
      greetings = [
        `Besoin d'un éclaircissement au calme, ${nameSpan} ?`,
        `À votre entière disposition, ${nameSpan}.`,
        `Une question ou un projet à aborder, ${nameSpan} ?`,
        `Ravi de vous accompagner ce soir, ${nameSpan}.`
      ];
      break;
    case 3:
      greetings = [
        `Au calme pour réfléchir, ${nameSpan} ? Je vous écoute.`,
        `Besoin de structurer vos idées, ${nameSpan} ?`,
        `Un sujet dont vous aimeriez discuter, ${nameSpan} ?`,
        `Que puis-je faire pour vous en cette heure calme, ${nameSpan} ?`
      ];
      break;
    case 4:
      greetings = [
        `Toujours à votre écoute, ${nameSpan}. Que souhaitez-vous faire ?`,
        `Une recherche ou un projet à creuser, ${nameSpan} ?`,
        `Besoin d'un assistant pour vous accompagner, ${nameSpan} ?`,
        `Bonjour ou bonsoir, ${nameSpan} ! Comment puis-je vous aider ?`
      ];
      break;
    case 5:
      greetings = [
        `Bonjour matinal, ${nameSpan}. Prêt à démarrer ?`,
        `Bonjour, ${nameSpan}. Une nouvelle journée s'ouvre à nous.`,
        `Ravi de vous retrouver de bon matin, ${nameSpan}.`,
        `Bonjour, ${nameSpan}. Que planifions-nous aujourd'hui ?`
      ];
      break;
    case 6:
      greetings = [
        `Bonjour, ${nameSpan}. Prêt pour un nouveau départ ?`,
        `Très bon début de journée, ${nameSpan}.`,
        `Bonjour, ${nameSpan}. En quoi puis-je vous accompagner ce matin ?`,
        `Ravi de vous accueillir ce matin, ${nameSpan}.`
      ];
      break;
    case 7:
      greetings = [
        `Bonjour, ${nameSpan}. Passez une agréable matinée.`,
        `Bonjour, ${nameSpan}. Prêt pour les projets du jour ?`,
        `Ravi de vous retrouver ce matin, ${nameSpan}.`,
        `Que puis-je faire pour vous en ce début de journée, ${nameSpan} ?`
      ];
      break;
    case 8:
      greetings = [
        `Bonjour, ${nameSpan}. Excellente matinée à vous !`,
        `Bonjour, ${nameSpan}. Par quoi commençons-nous ?`,
        `Ravi de vous retrouver, ${nameSpan}. Prêt pour aujourd'hui ?`,
        `Comment puis-je vous aider ce matin, ${nameSpan} ?`
      ];
      break;
    case 9:
      greetings = [
        `Bonjour, ${nameSpan}. J'espère que votre matinée commence bien.`,
        `Bonjour, ${nameSpan}. À votre service pour ce matin.`,
        `Ravi de vous revoir, ${nameSpan}. Quel est le programme ?`,
        `Que puis-je faire pour vous aujourd'hui, ${nameSpan} ?`
      ];
      break;
    case 10:
      greetings = [
        `Bonjour, ${nameSpan}. Comment se déroule votre matinée ?`,
        `Bonjour, ${nameSpan}. Toujours à votre écoute.`,
        `Besoin d'un coup de main pour vos projets, ${nameSpan} ?`,
        `Ravi de vous retrouver ce matin, ${nameSpan}.`
      ];
      break;
    case 11:
      greetings = [
        `Bonjour, ${nameSpan}. Que faisons-nous en cette fin de matinée ?`,
        `Bonjour, ${nameSpan}. Comment puis-je vous aider à avancer ?`,
        `Ravi de vous retrouver, ${nameSpan}. Une question à me poser ?`,
        'Que puis-je faire pour vous en cette fin de matinée?'
      ];
      break;
    case 12:
      greetings = [
        `Bonjour, ${nameSpan}. Un projet à aborder en ce milieu de journée ?`,
        `Bonjour, ${nameSpan}. Comment puis-je vous aider à midi ?`,
        `Ravi de vous retrouver pour le déjeuner, ${nameSpan}.`,
        `Que puis-je faire pour vous à cette heure-ci, ${nameSpan} ?`
      ];
      break;
    case 13:
      greetings = [
        `Bonjour, ${nameSpan}. Bon début d'après-midi !`,
        `Bonjour, ${nameSpan}. On poursuit nos projets ?`,
        `Ravi de vous retrouver cet après-midi, ${nameSpan}.`,
        `Comment puis-je vous être utile en ce début d'après-midi, ${nameSpan} ?`
      ];
      break;
    case 14:
      greetings = [
        `Bonjour, ${nameSpan}. Que faisons-nous cet après-midi ?`,
        `Bonjour, ${nameSpan}. Besoin d'aide ou de conseils ?`,
        `Ravi de vous retrouver, ${nameSpan}. À votre écoute.`,
        `Un nouveau sujet à explorer cet après-midi, ${nameSpan} ?`
      ];
      break;
    case 15:
      greetings = [
        `Bonjour, ${nameSpan}. Comment se passe votre après-midi ?`,
        `Bonjour, ${nameSpan}. Que souhaitez-vous accomplir ?`,
        `Ravi de vous accompagner cet après-midi, ${nameSpan}.`,
        `Besoin d'un coup de main à 15h, ${nameSpan} ?`
      ];
      break;
    case 16:
      greetings = [
        `Bonjour, ${nameSpan}. Une question pour cet après-midi ?`,
        `Bonjour, ${nameSpan}. Comment puis-je vous assister ?`,
        `Ravi de vous retrouver, ${nameSpan}. Toujours à votre écoute.`,
        `Que puis-je faire pour vous en cette fin d'après-midi, ${nameSpan} ?`
      ];
      break;
    case 17:
      greetings = [
        `Bonjour, ${nameSpan}. Passez une agréable fin d'après-midi.`,
        `Bonjour, ${nameSpan}. Que faisons-nous avant la soirée ?`,
        `Ravi de vous retrouver, ${nameSpan}. Un dernier point à voir ?`,
        `Comment puis-je vous aider en cette fin de journée, ${nameSpan} ?`
      ];
      break;
    case 18:
      greetings = [
        `Bonsoir, ${nameSpan}. Comment s'est passée votre journée ?`,
        `Bonsoir, ${nameSpan}. À votre service ce soir.`,
        `Ravi de vous retrouver pour ce début de soirée, ${nameSpan}.`,
        `Une idée ou un sujet à aborder ce soir, ${nameSpan} ?`
      ];
      break;
    case 19:
      greetings = [
        `Bonsoir, ${nameSpan}. J'espère que vous passez une agréable soirée.`,
        `Bonsoir, ${nameSpan}. Que faisons-nous ensemble ce soir ?`,
        `Ravi de vous retrouver, ${nameSpan}. Comment puis-je vous aider ?`,
        `Toujours disponible pour vous, ${nameSpan}.`
      ];
      break;
    case 20:
      greetings = [
        `Bonsoir, ${nameSpan}. Une question ou une idée ce soir ?`,
        `Bonsoir, ${nameSpan}. Que puis-je faire pour vous ?`,
        `Ravi de vous retrouver ce soir, ${nameSpan}.`,
        `À votre écoute pour cette fin de journée, ${nameSpan}.`
      ];
      break;
    case 21:
      greetings = [
        `Bonsoir, ${nameSpan}. Comment puis-je vous aider ce soir ?`,
        `Bonsoir, ${nameSpan}. Prêt pour un moment d'échange ?`,
        `Ravi de vous retrouver à 21h, ${nameSpan}.`,
        `Toujours à vos côtés pour répondre à vos questions, ${nameSpan}.`
      ];
      break;
    case 22:
      greetings = [
        `Bonsoir, ${nameSpan}. Que pouvons-nous explorer ce soir ?`,
        `Bonsoir, ${nameSpan}. Besoin d'un éclaircissement avant la nuit ?`,
        `Ravi de vous retrouver, ${nameSpan}. À votre service.`,
        `Une dernière question pour aujourd'hui, ${nameSpan} ?`
      ];
      break;
    case 23:
      greetings = [
        `Bonsoir, ${nameSpan}. Que puis-je faire pour vous en cette fin de journée ?`,
        `Bonsoir, ${nameSpan}. Besoin d'aide sur un dernier sujet ?`,
        `Ravi de vous retrouver ce soir, ${nameSpan}.`,
        `À votre écoute avant la fin de la journée, ${nameSpan}.`
      ];
      break;
    default:
      greetings = [`Bonjour, ${nameSpan}`];
  }

  const randomIndex = Math.floor(Math.random() * greetings.length);
  return greetings[randomIndex];
}

function showDashboardView() {
  // Mettre à jour les infos utilisateur dans le header
  if (userDisplayName) userDisplayName.textContent = currentUser.name;
  if (userRoleBadge) {
    userRoleBadge.textContent = currentUser.role;
    userRoleBadge.className = `user-role-badge ${currentUser.role}`;
  }
  if (avatarChar) avatarChar.textContent = currentUser.name.charAt(0);

  // Personnaliser le header selon le rôle
  const headerLogoBadge = document.querySelector('.header-logo h1 span');
  const headerSubtitle = document.getElementById('header-subtitle');

  if (currentUser.role === 'admin') {
    if (headerLogoBadge) headerLogoBadge.textContent = 'Engine';
    if (headerSubtitle) headerSubtitle.innerHTML = 'Base de données active : <span class="accent-text">SurrealDB</span>';
    if (adminPanel) adminPanel.classList.remove('hide');
    if (userPanel) userPanel.classList.add('hide');

    // Masquer le bouton de la sidebar pour l'admin
    if (btnSidebarToggle) btnSidebarToggle.classList.add('hide');
    if (sidebarMenu) sidebarMenu.classList.add('hide-sidebar');

    loadAdminData();
    startAdminIntervals();
  } else {
    if (headerLogoBadge) headerLogoBadge.textContent = 'Zone de chat';
    if (headerSubtitle) headerSubtitle.textContent = 'Votre espace personnel intelligent';
    if (adminPanel) adminPanel.classList.add('hide');
    if (userPanel) userPanel.classList.remove('hide');

    // Afficher le bouton de la sidebar uniquement pour les utilisateurs normaux
    if (btnSidebarToggle) btnSidebarToggle.classList.remove('hide');

    // Déterminer le message de bienvenue selon l'heure (salutations aléatoires et riches)
    if (chatGreeting) {
      chatGreeting.innerHTML = getRandomGreeting(currentUser.name);
    }

    // Réinitialiser l'interface de chat
    resetChatInterface();

    // Charger une seule fois le statut pour les specs système (sécurisé)
    fetchStatus();
  }
}

function resetChatInterface() {
  if (chatMessages) {
    chatMessages.innerHTML = '';
    chatMessages.classList.add('hide');
  }
  if (chatWelcome) {
    chatWelcome.classList.remove('hide');
  }
  if (chatContainer) {
    chatContainer.classList.remove('has-messages');
  }
  if (chatInput) {
    chatInput.value = '';
  }
  if (sidebarMenu) {
    sidebarMenu.classList.add('hide-sidebar');
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

// Déconnexion
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getHeaders()
      });
    } catch (err) {
      console.error('Erreur lors du logout:', err);
    } finally {
      handleInvalidSession();
    }
  });
}

// --- RENSEIGNER LES MÈTRIQUES EN TEMPS RÉEL (Admin uniquement) ---
async function fetchStatus() {
  try {
    const res = await fetch('/api/status', {
      headers: getHeaders()
    });
    if (!res.ok) {
      if (res.status === 401) {
        handleInvalidSession();
        return;
      }
      throw new Error('Erreur statut');
    }
    const data = await res.json();

    // Mettre à jour l'Uptime
    if (uptimeValue) uptimeValue.textContent = formatUptime(data.uptime);

    // Mettre à jour le CPU
    if (cpuCircle && cpuValue) setCpuProgress(data.simulatedCpu);

    // Mettre à jour la RAM
    if (ramPercentage && ramDetails && ramProgress) {
      const totalMem = data.system.memory.total;
      const usedMem = data.system.memory.used;
      const usedPercent = Math.round((usedMem / totalMem) * 100);
      ramPercentage.textContent = `${usedPercent}%`;
      ramDetails.textContent = `${formatBytes(usedMem, 1)} / ${formatBytes(totalMem, 1)}`;
      ramProgress.style.width = `${usedPercent}%`;
    }

    // Requêtes
    if (requestCount) requestCount.textContent = data.requestCount;

    // Latence utilisateur
    if (userLatencyVal) {
      userLatencyVal.textContent = `${data.simulatedLatency}ms`;
    }

    // Charger les specs système une seule fois
    if (!systemSpecsLoaded && systemSpecs) {
      const sys = data.system;
      systemSpecs.textContent = `OS: ${sys.platform} (${sys.arch}) | CPU: ${sys.cpuCount} Cores`;
      systemSpecsLoaded = true;
    }

    if (dbStatusText) {
      dbStatusText.textContent = 'EN LIGNE';
      dbStatusText.className = 'status-online-text';
    }

  } catch (err) {
    console.error('Erreur fetchStatus:', err);
    if (dbStatusText) {
      dbStatusText.textContent = 'HORS LIGNE';
      dbStatusText.className = 'text-red';
    }
  }
}

// --- INTERVALLES ---
function startAdminIntervals() {
  fetchStatus();
  fetchLogs();
  statusIntervalId = setInterval(fetchStatus, 1500);
  logsIntervalId = setInterval(fetchLogs, 2500);
}

// --- DONNÉES SPÉCIFIQUES ADMIN ---
async function loadAdminData() {
  try {
    const res = await fetch('/api/admin/users', { headers: getHeaders() });
    if (res.ok) {
      const users = await res.json();
      if (usersCount) usersCount.textContent = users.length;
      renderUsersTable(users);
    }
  } catch (err) {
    console.error('Erreur chargement utilisateurs admin:', err);
  }
}

function renderUsersTable(users) {
  if (!usersTableBody) return;
  usersTableBody.innerHTML = '';
  users.forEach(u => {
    const row = document.createElement('tr');

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
if (btnRunQuery) {
  btnRunQuery.addEventListener('click', executeSurrealQuery);
}

async function executeSurrealQuery() {
  if (!surrealQueryInput || !surrealConsoleOutput) return;
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

    if (query.toUpperCase().includes('CREATE') || query.toUpperCase().includes('UPDATE') || query.toUpperCase().includes('DELETE') || query.toUpperCase().includes('INSERT')) {
      loadAdminData();
    }
  } catch (err) {
    surrealConsoleOutput.textContent = `Erreur de communication : ${err.message}`;
  }
}

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const query = btn.getAttribute('data-query');
    if (surrealQueryInput) {
      surrealQueryInput.value = query;
      executeSurrealQuery();
    }
  });
});

// Logs
let activeLogLevelFilter = 'all';

async function fetchLogs() {
  try {
    const res = await fetch('/api/logs', { headers: getHeaders() });
    if (!res.ok) return;
    const logs = await res.json();

    const logsJsonString = JSON.stringify(logs);
    if (logsJsonString === logCacheJson) return;
    logCacheJson = logsJsonString;

    renderLogs(logs);
  } catch (err) {
    console.error('Erreur logs:', err);
  }
}

function renderLogs(logs) {
  if (!logsConsole) return;
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

// --- ÉVÉNEMENTS CHATBOT ET SIDEBAR ---

// Toggle de la Sidebar
if (btnSidebarToggle) {
  btnSidebarToggle.addEventListener('click', () => {
    if (sidebarMenu) sidebarMenu.classList.toggle('hide-sidebar');
  });
}

if (btnSidebarClose) {
  btnSidebarClose.addEventListener('click', () => {
    if (sidebarMenu) sidebarMenu.classList.add('hide-sidebar');
  });
}

// Nouvelle conversation
if (btnNewChat) {
  btnNewChat.addEventListener('click', () => {
    resetChatInterface();
  });
}

// Modale des paramètres (placeholders)
if (btnOpenSettings) {
  btnOpenSettings.addEventListener('click', () => {
    if (settingsModal) settingsModal.classList.remove('hide');
  });
}

if (btnCloseSettings) {
  btnCloseSettings.addEventListener('click', () => {
    if (settingsModal) settingsModal.classList.add('hide');
  });
}

if (btnSaveSettings) {
  btnSaveSettings.addEventListener('click', () => {
    if (settingsModal) settingsModal.classList.add('hide');
  });
}

if (settingsModal) {
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hide');
    }
  });
}

// TODO : lier le chat avec SurrealDB pour enregistrer et charger l'historique des conversations
// Soumission du formulaire de chat
if (chatForm) {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    // Si premier message, transitionner l'interface
    if (chatMessages && chatMessages.classList.contains('hide')) {
      if (chatWelcome) chatWelcome.classList.add('hide');
      chatMessages.classList.remove('hide');
      if (chatContainer) chatContainer.classList.add('has-messages');
    }

    // Message de l'utilisateur
    appendChatMessage('Vous', messageText, 'user');
    chatInput.value = '';

    // TODO : remplacer la réponse placeholder par l'appel API à l'IA avec SurrealDB
    // Simulation d'une réponse de bot après un court délai
    setTimeout(() => {
      appendChatMessage('Flex.ai', 'Ceci est une réponse de démonstration (placeholder).', 'bot');
    }, 800);
  });
}

function appendChatMessage(sender, text, type) {
  if (!chatMessages) return;
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${type}`;
  messageDiv.innerHTML = `
    <span class="chat-message-sender">${escapeHTML(sender)}</span>
    <p>${escapeHTML(text)}</p>
  `;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Lancement au chargement de la page
checkAuthSession();
