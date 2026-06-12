const express = require('express');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// État en mémoire du prototype de serveur
const serverState = {
  uptimeStart: Date.now(),
  requestCount: 0,
  simulatedLatency: 0,
  maintenanceMode: false,
  logs: [],
  maxLogs: 50
};

// Lancement de SurrealDB en arrière-plan
console.log("Démarrage de SurrealDB...");
const surrealProcess = spawn('/home/richard/.surrealdb/surreal', [
  'start',
  '--user', 'root',
  '--pass', 'root',
  '--bind', '127.0.0.1:8000',
  'surrealkv://surreal.db'
]);

surrealProcess.stdout.on('data', (data) => {
  // Optionnel : décommenter pour débogage
  // console.log(`[SurrealDB]: ${data}`);
});

surrealProcess.stderr.on('data', (data) => {
  // Optionnel : décommenter pour débogage
  // console.error(`[SurrealDB Err]: ${data}`);
});

// Arrêter SurrealDB quand le processus Node se termine
const cleanup = () => {
  console.log("Arrêt de SurrealDB...");
  surrealProcess.kill();
};
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit();
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit();
});

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
}, 12000);

// Analyseur de corps JSON
app.use(express.json());

// Helper pour exécuter des requêtes SurrealQL via l'API REST
async function querySurreal(sql, ns = 'test', db = 'test') {
  try {
    const response = await fetch('http://127.0.0.1:8000/sql', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from('root:root').toString('base64'),
        'surreal-ns': ns,
        'surreal-db': db,
        'Accept': 'application/json',
        'Content-Type': 'text/plain'
      },
      body: sql
    });
    if (!response.ok) {
      throw new Error(`Erreur HTTP SurrealDB : ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Erreur de requête SurrealDB : ${error.message}`);
    throw error;
  }
}

// Fonction de hachage SHA-256 pour les mots de passe
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Initialisation de la base de données SurrealDB
async function initSurreal() {
  const maxRetries = 15;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // 1. Définir le namespace
      await fetch('http://127.0.0.1:8000/sql', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from('root:root').toString('base64'),
          'Accept': 'application/json',
          'Content-Type': 'text/plain'
        },
        body: 'DEFINE NAMESPACE test;'
      });

      // 2. Définir la base de données
      await fetch('http://127.0.0.1:8000/sql', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from('root:root').toString('base64'),
          'surreal-ns': 'test',
          'Accept': 'application/json',
          'Content-Type': 'text/plain'
        },
        body: 'DEFINE DATABASE test;'
      });

      // 3. Vérifier et créer l'admin par défaut
      const res = await querySurreal("SELECT * FROM user WHERE username = 'admin';");
      let createAdmin = false;
      if (res && res[0]) {
        if (res[0].status === 'ERR' && String(res[0].result).includes('does not exist')) {
          createAdmin = true;
        } else if (res[0].status === 'OK' && res[0].result.length === 0) {
          createAdmin = true;
        }
      }
      if (createAdmin) {
        const passHash = hashPassword('admin');
        await querySurreal(`CREATE user:admin SET username = 'admin', password = '${passHash}', name = 'Administrateur', role = 'admin', createdAt = time::now();`);
        addLog('info', 'Compte administrateur initialisé avec succès (admin:admin)', 'security');
      }

      addLog('info', 'Connexion et initialisation de SurrealDB réussies', 'system');
      break;
    } catch (err) {
      attempt++;
      console.log(`En attente de démarrage de SurrealDB... (Tentative ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (attempt === maxRetries) {
    addLog('error', 'Impossible de se connecter à SurrealDB après plusieurs tentatives', 'system');
  }
}

// Lancer l'initialisation de SurrealDB
initSurreal();

// Session store en mémoire (token -> user data)
const sessions = new Map();

// Middleware d'authentification
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé', message: 'Token manquant ou invalide.' });
  }
  const token = authHeader.substring(7);
  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Non autorisé', message: 'Session expirée ou invalide.' });
  }
  req.user = session;
  next();
}

// Middleware pour vérifier le rôle admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Interdit', message: 'Droits administrateur requis.' });
  }
  next();
}

// Middleware pour simuler la latence et compter les requêtes
app.use((req, res, next) => {
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

  if (isApi) {
    addLog('info', `Requête reçue : ${req.method} ${req.url}`, 'api');
  }

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
  const isAdminApi = req.url.startsWith('/api/status') || req.url.startsWith('/api/settings') || req.url.startsWith('/api/logs') || req.url.startsWith('/api/admin/');
  const isAuthApi = req.url.startsWith('/api/auth/');
  const isStaticFile = !req.url.startsWith('/api/');

  if (serverState.maintenanceMode && !isAdminApi && !isAuthApi && !isStaticFile) {
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

// --- ROUTES API D'AUTHENTIFICATION ---

// 1. Inscription (Register)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Champs manquants', message: 'Veuillez remplir tous les champs.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Vérifier si l'utilisateur existe déjà
    const checkRes = await querySurreal(`SELECT * FROM user WHERE username = '${cleanUsername}';`);
    if (checkRes[0] && checkRes[0].result && checkRes[0].result.length > 0) {
      return res.status(400).json({ error: 'Existe déjà', message: 'Cet identifiant est déjà utilisé.' });
    }

    const passHash = hashPassword(password);
    const escapedName = name.replace(/'/g, "\\'");

    // Insérer dans SurrealDB
    const insertRes = await querySurreal(`CREATE user SET username = '${cleanUsername}', password = '${passHash}', name = '${escapedName}', role = 'user', createdAt = time::now();`);

    if (insertRes[0] && insertRes[0].status === 'ERR') {
      throw new Error(insertRes[0].result);
    }

    // Générer une session
    const token = crypto.randomBytes(32).toString('hex');
    const userData = { username: cleanUsername, name: name, role: 'user' };
    sessions.set(token, userData);

    addLog('info', `Nouvel utilisateur inscrit : ${cleanUsername}`, 'security');

    res.json({
      message: 'Inscription réussie',
      token,
      user: userData
    });
  } catch (err) {
    addLog('error', `Erreur d'inscription : ${err.message}`, 'security');
    res.status(500).json({ error: 'Erreur serveur', message: err.message });
  }
});

// 2. Connexion (Login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Champs manquants', message: 'Identifiant et mot de passe requis.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const passHash = hashPassword(password);

    const searchRes = await querySurreal(`SELECT * FROM user WHERE username = '${cleanUsername}';`);
    if (searchRes[0] && searchRes[0].result && searchRes[0].result.length > 0) {
      const user = searchRes[0].result[0];
      if (user.password === passHash) {
        const token = crypto.randomBytes(32).toString('hex');
        const userData = { username: user.username, name: user.name, role: user.role };
        sessions.set(token, userData);

        addLog('info', `Utilisateur connecté : ${cleanUsername} (${user.role})`, 'security');

        return res.json({
          message: 'Connexion réussie',
          token,
          user: userData
        });
      }
    }

    addLog('warn', `Tentative de connexion échouée pour : ${cleanUsername}`, 'security');
    res.status(400).json({ error: 'Identifiants incorrects', message: 'Identifiant ou mot de passe incorrect.' });
  } catch (err) {
    addLog('error', `Erreur de connexion : ${err.message}`, 'security');
    res.status(500).json({ error: 'Erreur serveur', message: err.message });
  }
});

// 3. Déconnexion (Logout)
app.post('/api/auth/logout', authenticate, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader.substring(7);
  sessions.delete(token);
  addLog('info', `Utilisateur déconnecté : ${req.user.username}`, 'security');
  res.json({ message: 'Déconnexion réussie' });
});

// 4. Récupérer le profil connecté (Me)
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});


// --- ROUTES API SYSTÈME ET ADMINISTRATION (Protégées) ---

// 1. Statut et métriques du serveur (tous les utilisateurs connectés)
app.get('/api/status', authenticate, (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

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

// 2. Modifier la configuration (Admin seulement)
app.post('/api/settings', authenticate, requireAdmin, (req, res) => {
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

// 3. Obtenir les logs (Admin seulement)
app.get('/api/logs', authenticate, requireAdmin, (req, res) => {
  res.json(serverState.logs);
});

// 4. Liste de tous les utilisateurs (Admin seulement)
app.get('/api/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const usersRes = await querySurreal("SELECT id, username, name, role, createdAt FROM user ORDER BY createdAt DESC;");
    if (usersRes[0] && usersRes[0].status === 'OK') {
      res.json(usersRes[0].result);
    } else {
      res.status(500).json({ error: 'Erreur base de données', message: usersRes[0].result });
    }
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur', message: err.message });
  }
});

// 5. Exécution SurrealQL en direct (Admin seulement)
app.post('/api/admin/query', authenticate, requireAdmin, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Requête manquante', message: 'Veuillez saisir une requête SurrealQL.' });
    }

    const queryRes = await querySurreal(query);
    addLog('info', `Console SurrealQL : Exécution de "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`, 'system');
    res.json(queryRes);
  } catch (err) {
    res.status(500).json({ error: 'Erreur SurrealQL', message: err.message });
  }
});

// 6. Déclencher une erreur simulée (Admin seulement)
app.get('/api/trigger-error', authenticate, requireAdmin, (req, res) => {
  addLog('error', 'Erreur critique déclenchée manuellement par l\'utilisateur', 'system');
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Une erreur interne simulée s\'est produite sur le serveur.',
    timestamp: new Date().toISOString()
  });
});

// 7. Endpoint de test classique
app.get('/api/test-endpoint', (req, res) => {
  res.json({
    success: true,
    message: 'Hello World ! Le prototype de serveur web fonctionne parfaitement.',
    timestamp: new Date().toISOString()
  });
});

// Démarrer le serveur Express
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 SERVEUR PROTOTYPE DÉMARRÉ`);
  console.log(`🔗 Interface d'administration : http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
