try { process.loadEnvFile(); } catch (e) {}
const express = require('express');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const crypto = require('crypto');
const argon2 = require('argon2');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration de la base de données SurrealDB
const DB_HOST = process.env.SURREAL_HOST || '127.0.0.1';
const DB_PORT = process.env.SURREAL_PORT || '8000';
const DB_URL = `http://${DB_HOST}:${DB_PORT}`;

// État en mémoire du prototype de serveur
const serverState = {
  uptimeStart: Date.now(),
  requestCount: 0,
  simulatedLatency: 0,
  maintenanceMode: false,
  logs: [],
  maxLogs: 50
};

// Lancement de SurrealDB en arrière-plan (si locale)
let surrealProcess = null;
if (process.env.SURREAL_EXTERNAL === 'true') {
  console.log(`Utilisation d'une instance SurrealDB externe sur ${DB_URL}`);
} else {
  console.log("Démarrage de SurrealDB...");
  surrealProcess = spawn('/home/richard/.surrealdb/surreal', [
    'start',
    '--user', 'root',
    '--pass', 'root',
    '--bind', `${DB_HOST}:${DB_PORT}`,
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
}

// Arrêter SurrealDB quand le processus Node se termine
const cleanup = () => {
  if (surrealProcess) {
    console.log("Arrêt de SurrealDB...");
    surrealProcess.kill();
  }
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
    const response = await fetch(`${DB_URL}/sql`, {
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

// Fonction de hachage SHA-256 héritée pour les mots de passe
function hashPasswordSHA256(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Fonction de hachage moderne Argon2id avec sel/pepper issu du fichier .env
async function hashPasswordArgon2(password) {
  const pepper = process.env.SALT || '';
  return await argon2.hash(password + pepper);
}

// Fonction de vérification de mot de passe avec compatibilité descendante et mise à jour automatique
async function verifyPassword(user, password) {
  const storedHash = user.password;
  const pepper = process.env.SALT || '';
  
  if (storedHash && storedHash.startsWith('$argon2id$')) {
    // Hash moderne Argon2id
    return await argon2.verify(storedHash, password + pepper);
  } else {
    // Hash hérité SHA-256
    const legacyHash = hashPasswordSHA256(password);
    if (storedHash === legacyHash) {
      // Authentification correcte ! On met à niveau vers Argon2id de façon asynchrone
      try {
        const newHash = await hashPasswordArgon2(password);
        await querySurreal(`UPDATE ${user.id} SET password = '${newHash}';`);
        addLog('info', `Mot de passe de l'utilisateur ${user.username} mis à niveau vers Argon2id`, 'security');
      } catch (err) {
        addLog('error', `Échec de la mise à niveau vers Argon2id pour ${user.username} : ${err.message}`, 'security');
      }
      return true;
    }
    return false;
  }
}

// Initialisation de la base de données SurrealDB
async function initSurreal() {
  const maxRetries = 15;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // 1. Définir le namespace
      await fetch(`${DB_URL}/sql`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from('root:root').toString('base64'),
          'Accept': 'application/json',
          'Content-Type': 'text/plain'
        },
        body: 'DEFINE NAMESPACE test;'
      });

      // 2. Définir la base de données
      await fetch(`${DB_URL}/sql`, {
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
        const passHash = await hashPasswordArgon2('admin');
        await querySurreal(`CREATE user:admin SET username = 'admin', password = '${passHash}', name = 'Administrateur', role = 'admin', createdAt = time::now();`);
        addLog('info', 'Compte administrateur initialisé avec succès (admin:admin) avec Argon2id', 'security');
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

// Middleware d'authentification
async function authenticate(req, res, next) {
  const token = getCookie(req, 'token');
  if (!token) {
    return res.status(401).json({ error: 'Non autorisé', message: 'Token manquant ou invalide.' });
  }
  try {
    const sessionRes = await querySurreal(`SELECT user.username AS username, user.name AS name, user.role AS role, user.demo AS demo FROM session:${token};`);
    if (!sessionRes[0] || sessionRes[0].status === 'ERR' || !sessionRes[0].result || sessionRes[0].result.length === 0) {
      return res.status(401).json({ error: 'Non autorisé', message: 'Session expirée ou invalide.' });
    }
    req.user = sessionRes[0].result[0];
    next();
  } catch (err) {
    console.error('Erreur d\'authentification base de données :', err);
    return res.status(401).json({ error: 'Non autorisé', message: 'Session expirée ou invalide.' });
  }
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

// Fonction utilitaire pour extraire les cookies
function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const parts = cookie.split('=');
    const k = parts[0] ? parts[0].trim() : '';
    const v = parts[1] ? parts[1].trim() : '';
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  return cookies[name] || null;
}

// Route sécurisée pour /chat (inaccessible si non connecté)
app.get('/chat', async (req, res) => {
  const token = getCookie(req, 'token');
  if (!token) {
    addLog('warn', `Accès refusé à /chat (token cookie absent)`, 'security');
    return res.redirect('/?error=unauthorized');
  }
  try {
    const sessionRes = await querySurreal(`SELECT user.username AS username, user.name AS name, user.role AS role FROM session:${token};`);
    if (!sessionRes[0] || sessionRes[0].status === 'ERR' || !sessionRes[0].result || sessionRes[0].result.length === 0) {
      addLog('warn', `Accès refusé à /chat (session invalide ou expirée)`, 'security');
      return res.redirect('/?error=unauthorized');
    }
    res.sendFile(path.join(__dirname, 'private', 'chat.html'));
  } catch (err) {
    addLog('error', `Erreur lors de la vérification de session pour /chat : ${err.message}`, 'security');
    return res.redirect('/?error=unauthorized');
  }
});

// Redirection de /chat.html vers /chat pour éviter l'erreur "Cannot GET /chat.html"
app.get('/chat.html', (req, res) => {
  res.redirect('/chat');
});

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, 'public')));

// --- ROUTES API D'AUTHENTIFICATION ---

// 1. Inscription (Register)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, name, demo } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Champs manquants', message: 'Veuillez remplir tous les champs.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Vérifier si l'utilisateur existe déjà
    const checkRes = await querySurreal(`SELECT * FROM user WHERE username = '${cleanUsername}';`);
    if (checkRes[0] && checkRes[0].result && checkRes[0].result.length > 0) {
      return res.status(400).json({ error: 'Existe déjà', message: 'Cet identifiant est déjà utilisé.' });
    }

    const passHash = await hashPasswordArgon2(password);
    const escapedName = name.replace(/'/g, "\\'");
    const demoVal = demo === true;

    // Insérer dans SurrealDB
    const insertRes = await querySurreal(`CREATE user SET username = '${cleanUsername}', password = '${passHash}', name = '${escapedName}', role = 'user', demo = ${demoVal}, createdAt = time::now();`);

    if (insertRes[0] && insertRes[0].status === 'ERR') {
      throw new Error(insertRes[0].result);
    }

    const createdUser = insertRes[0].result[0];
    const userId = createdUser.id;

    // Générer une session
    const token = crypto.randomBytes(32).toString('hex');
    const userData = { username: cleanUsername, name: name, role: 'user', demo: demoVal };

    // Stocker la session dans SurrealDB
    await querySurreal(`CREATE session:${token} SET user = ${userId}, createdAt = time::now();`);

    addLog('info', `Nouvel utilisateur inscrit : ${cleanUsername}`, 'security');

    // Définir le cookie sécurisé HttpOnly
    const isProduction = req.headers['x-forwarded-proto'] === 'https';
    const secureFlag = isProduction ? '; Secure' : '';
    res.setHeader('Set-Cookie', `token=${token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict${secureFlag}`);

    res.json({
      message: 'Inscription réussie',
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

    const searchRes = await querySurreal(`SELECT * FROM user WHERE username = '${cleanUsername}';`);
    if (searchRes[0] && searchRes[0].result && searchRes[0].result.length > 0) {
      const user = searchRes[0].result[0];
      const isValid = await verifyPassword(user, password);
      if (isValid) {
        const token = crypto.randomBytes(32).toString('hex');
        const userData = { username: user.username, name: user.name, role: user.role };

        // Stocker la session dans SurrealDB
        await querySurreal(`CREATE session:${token} SET user = ${user.id}, createdAt = time::now();`);

        addLog('info', `Utilisateur connecté : ${cleanUsername} (${user.role})`, 'security');

        // Définir le cookie sécurisé HttpOnly
        const isProduction = req.headers['x-forwarded-proto'] === 'https';
        const secureFlag = isProduction ? '; Secure' : '';
        res.setHeader('Set-Cookie', `token=${token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict${secureFlag}`);

        return res.json({
          message: 'Connexion réussie',
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
app.post('/api/auth/logout', authenticate, async (req, res) => {
  const token = getCookie(req, 'token');
  if (token) {
    try {
      await querySurreal(`DELETE session:${token};`);
    } catch (err) {
      console.error('Erreur suppression session database:', err);
    }
  }
  addLog('info', `Utilisateur déconnecté : ${req.user.username}`, 'security');
  
  // Supprimer le cookie
  res.setHeader('Set-Cookie', 'token=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
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

// --- API DE CHAT POUR LE MODE DÉMO ---

// 1. Liste des modèles d'IA disponibles
app.get('/api/models', authenticate, (req, res) => {
  try {
    const configIA = require('./ia/config');
    const models = configIA.MODELS.map(m => ({
      name: m.name,
      displayName: m.displayName,
      provider: m.provider,
      description: m.description
    }));
    res.json(models);
  } catch (err) {
    console.error('Erreur chargement modèles IA:', err);
    res.status(500).json({ error: 'Impossible de charger les modèles d\'IA' });
  }
});

// 2. Envoi de message (Demo ou Normal)
app.post('/api/chat/send', authenticate, async (req, res) => {
  const { message, history, modelName } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message requis' });
  }

  const demoActive = req.user.demo === true;

  if (demoActive) {
    try {
      const configIA = require('./ia/config');
      const utilsIA = require('./ia/utils');

      // Choisir un modèle par défaut si aucun n'est spécifié ou disponible
      const selectedModelName = modelName || (configIA.MODELS[0] && configIA.MODELS[0].name) || 'gemini-3-flash-preview';

      // Trouver le modèle et son provider
      const modelConfig = configIA.MODELS.find(m => m.name === selectedModelName);
      if (!modelConfig) {
        return res.status(400).json({ error: 'Modèle non trouvé dans la configuration' });
      }

      const provider = modelConfig.provider;
      let replyText = '';
      let thoughtsText = '';

      if (provider === 'gemini') {
        // Formater l'historique au format attendu par Gemini :
        // [{ role: 'user'|'model', parts: [{ text: string }] }]
        const geminiHistory = (history || []).map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        const geminiRes = await utilsIA.queryGemini(message, selectedModelName, [], false, geminiHistory);
        if (geminiRes) {
          replyText = typeof geminiRes === 'object' ? (geminiRes.text || '') : geminiRes;
          thoughtsText = typeof geminiRes === 'object' ? (geminiRes.thoughts || '') : '';
        } else {
          throw new Error('Le modèle Gemini n\'a pas renvoyé de réponse');
        }
      } else {
        // Pour Groq, SambaNova, Cerebras, GitHub Models, ils attendent un tableau de messages :
        // [{ role: 'system'|'user'|'assistant', content: string }]
        const messages = [
          { role: 'system', content: 'Tu es Flex.ai, un assistant virtuel intelligent et utile.' }
        ];

        if (history && Array.isArray(history)) {
          history.forEach(msg => {
            messages.push({
              role: msg.role, // 'user' ou 'assistant' (OpenAI standard)
              content: msg.content
            });
          });
        }

        messages.push({
          role: 'user',
          content: message
        });

        if (provider === 'groq') {
          const groqRes = await utilsIA.queryGroq(messages, [], false, selectedModelName);
          if (groqRes && groqRes.content) {
            replyText = groqRes.content;
          } else {
            throw new Error('Le modèle Groq n\'a pas renvoyé de réponse');
          }
        } else if (provider === 'github') {
          const githubRes = await utilsIA.queryGithub(messages, selectedModelName);
          if (githubRes) {
            replyText = githubRes;
          } else {
            throw new Error('Le modèle GitHub n\'a pas renvoyé de réponse');
          }
        } else if (provider === 'sambanova') {
          const sambaRes = await utilsIA.querySambaNova(messages, selectedModelName);
          if (sambaRes) {
            replyText = sambaRes;
          } else {
            throw new Error('Le modèle SambaNova n\'a pas renvoyé de réponse');
          }
        } else if (provider === 'cerebras') {
          const cerebrasRes = await utilsIA.queryCerebras(messages, selectedModelName);
          if (cerebrasRes) {
            replyText = cerebrasRes;
          } else {
            throw new Error('Le modèle Cerebras n\'a pas renvoyé de réponse');
          }
        } else {
          throw new Error(`Fournisseur ${provider} non supporté`);
        }
      }

      // Extraction de <think>...</think> si présent dans la réponse pour l'isoler
      const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
      const thinkMatch = replyText.match(thinkRegex);
      if (thinkMatch) {
        thoughtsText = thinkMatch[1].trim();
        replyText = replyText.replace(thinkRegex, '').trim();
      }

      res.json({
        reply: replyText,
        thoughts: thoughtsText,
        modelUsed: selectedModelName
      });
    } catch (err) {
      console.error('Erreur Mode Démo IA:', err);
      res.status(500).json({ error: 'Erreur lors de l\'appel à l\'IA', message: err.message });
    }
  } else {
    // Mode normal : Simulation d'une réponse après 800ms
    setTimeout(() => {
      res.json({
        reply: "Ceci est une réponse de démonstration (placeholder). Créez un compte avec le Mode Démo activé pour parler à des modèles réels."
      });
    }, 800);
  }
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
