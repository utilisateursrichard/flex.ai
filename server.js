const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// État en mémoire du prototype de serveur
const serverState = {
  uptimeStart: Date.now(),
  requestCount: 0,
  simulatedLatency: 0, // en millisecondes ?
  maintenanceMode: false,
  logs: [],
  maxLogs: 50
};

// Fonction pour ajouter un log dans l'historique
function addLog(level, message, source = 'system') {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level, // 'info' | 'warn' | 'error'
    message,
    source // 'system' | 'api' | 'security'
  };
  serverState.logs.unshift(logEntry);
  if (serverState.logs.length > serverState.maxLogs) {
    serverState.logs.pop();
  }
  console.log(`[${logEntry.timestamp}] [${level.toUpperCase()}] ${message}`);
}

// Ajouter quelques logs initiaux
addLog('info', 'Démarrage du système de journalisation...', 'system');
addLog('info', `Serveur configuré pour écouter sur le port ${PORT}`, 'system');
addLog('info', 'Initialisation du prototype de serveur web terminée', 'system');

// Générer des logs système périodiques pour simuler de l'activité
setInterval(() => {
  const random = Math.random();
  if (random < 0.05) {
    addLog('error', 'Échec de connexion temporaire à la base de données simulée', 'system');
  } else if (random < 0.15) {
    addLog('warn', `Utilisation de la mémoire élevée : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, 'system');
  } else if (random < 0.35) {
    const tasks = ['Nettoyage du cache terminé', 'Indexation des fichiers en cours', 'Vérification de l\'intégrité du système effectuée', 'Sauvegarde automatique réussie'];
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    addLog('info', task, 'system');
  }
}, 8000);

// Analyseur de corps JSON
app.use(express.json());

// Middleware pour simuler la latence et compter les requêtes
app.use((req, res, next) => {
  // Ignorer les requêtes de fichiers statiques (images, css, js) des métriques principales
  const isApi = req.url.startsWith('/api/');

  if (isApi) {
    serverState.requestCount++;
  }

  const applyLatencyAndNext = () => {
    if (isApi && serverState.simulatedLatency > 0) {
      setTimeout(next, serverState.simulatedLatency);
    } else {
      next();
    }
  };

  // Enregistrer le log d'accès API
  if (isApi) {
    addLog('info', `Requête reçue : ${req.method} ${req.url}`, 'api');
  }

  // Intercepter la fin de la réponse pour journaliser le statut
  res.on('finish', () => {
    if (isApi) {
      const level = res.statusCode >= 400 ? 'error' : (res.statusCode >= 300 ? 'warn' : 'info');
      addLog(level, `Réponse envoyée : ${req.method} ${req.url} -> Statut ${res.statusCode}`, 'api');
    }
  });

  applyLatencyAndNext();
});

// Middleware pour gérer le mode maintenance
app.use((req, res, next) => {
  // On autorise toujours les requêtes vers l'API d'administration et les fichiers statiques
  const isAdminApi = req.url.startsWith('/api/status') || req.url.startsWith('/api/settings') || req.url.startsWith('/api/logs');
  const isStaticFile = !req.url.startsWith('/api/');

  if (serverState.maintenanceMode && !isAdminApi && !isStaticFile) {
    addLog('warn', `Accès bloqué par le mode maintenance : ${req.method} ${req.url}`, 'security');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Le serveur est actuellement en cours de maintenance. Veuillez réessayer plus tard.',
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, 'public')));

// --- ROUTES API ---

// 1. Statut et métriques du serveur
app.get('/api/status', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // Utilisation CPU simulée fluctuant de manière réaliste
  const baseCpu = serverState.maintenanceMode ? 2 : 12;
  const simulatedCpu = Math.min(100, Math.max(1, Math.round(baseCpu + (Math.sin(Date.now() / 5000) * 8) + (Math.random() * 5))));

  res.json({
    status: serverState.maintenanceMode ? 'maintenance' : 'online',
    uptime: Math.floor((Date.now() - serverState.uptimeStart) / 1000),
    requestCount: serverState.requestCount,
    simulatedLatency: serverState.simulatedLatency,
    maintenanceMode: serverState.maintenanceMode,
    system: {
      platform: os.platform(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        processUsed: process.memoryUsage().heapUsed
      }
    },
    simulatedCpu
  });
});

// 2. Modifier la configuration
app.post('/api/settings', (req, res) => {
  const { latency, maintenance } = req.body;

  if (typeof latency === 'number' && latency >= 0 && latency <= 5000) {
    serverState.simulatedLatency = latency;
    addLog('info', `Configuration mise à jour : latence réglée à ${latency}ms`, 'system');
  }

  if (typeof maintenance === 'boolean') {
    serverState.maintenanceMode = maintenance;
    const actionStr = maintenance ? 'ACTIVÉ' : 'DÉSACTIVÉ';
    addLog('warn', `Configuration mise à jour : mode maintenance ${actionStr}`, 'system');
  }

  res.json({
    message: 'Configuration mise à jour avec succès',
    simulatedLatency: serverState.simulatedLatency,
    maintenanceMode: serverState.maintenanceMode
  });
});

// 3. Obtenir les logs
app.get('/api/logs', (req, res) => {
  res.json(serverState.logs);
});

// 4. Déclencher une erreur simulée (500 Internal Server Error)
app.get('/api/trigger-error', (req, res) => {
  addLog('error', 'Erreur critique déclenchée manuellement par l\'utilisateur', 'system');
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Une erreur interne simulée s\'est produite sur le serveur.',
    timestamp: new Date().toISOString()
  });
});

// 5. Un endpoint de test classique
app.get('/api/test-endpoint', (req, res) => {
  res.json({
    success: true,
    message: 'Hello World ! Le prototype de serveur web fonctionne parfaitement.',
    timestamp: new Date().toISOString()
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 SERVEUR PROTOTYPE DÉMARRÉ`);
  console.log(`🔗 Interface d'administration : http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
