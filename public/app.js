// --- GESTION DU THÈME (Clair par défaut, Sombre sur option) ---
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

// --- RÉFÉRENCES DOM ---
const authScreen = document.getElementById('auth-screen');
const landingPageScreen = document.getElementById('landing-page-screen');

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
const registerDemoMode = document.getElementById('register-demo-mode');

// Landing Page et Modale
const btnOpenLogin = document.getElementById('btn-open-login');
const btnCloseAuth = document.getElementById('btn-close-auth');
const btnHeroStart = document.getElementById('btn-hero-start');



function showAlert(message, type = 'error') {
  if (authAlert) {
    authAlert.textContent = message;
    authAlert.className = `alert-box ${type}`;
    setTimeout(() => {
      authAlert.className = 'alert-box hide';
    }, 5000);
  }
}

// --- BASCULE DE VUES (Login vs Register) ---
if (goToRegister) {
  goToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hide');
    registerForm.classList.remove('hide');
    if (authAlert) authAlert.className = 'alert-box hide';
  });
}

if (goToLogin) {
  goToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hide');
    loginForm.classList.remove('hide');
    if (authAlert) authAlert.className = 'alert-box hide';
  });
}

// --- FORMULAIRES API INTERACTION ---

// Connexion
if (loginForm) {
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
        loginUsernameInput.value = '';
        loginPasswordInput.value = '';
        window.location.href = '/chat';
      } else {
        showAlert(data.message || 'Échec de la connexion.');
      }
    } catch (err) {
      showAlert('Une erreur réseau s\'est produite.');
    }
  });
}

// Inscription
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = registerNameInput.value;
    const username = registerUsernameInput.value;
    const password = registerPasswordInput.value;
    const demo = registerDemoMode ? registerDemoMode.checked : false;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password, demo })
      });
      const data = await res.json();

      if (res.ok) {
        registerNameInput.value = '';
        registerUsernameInput.value = '';
        registerPasswordInput.value = '';
        if (registerDemoMode) registerDemoMode.checked = false;
        registerForm.classList.add('hide');
        loginForm.classList.remove('hide');
        window.location.href = '/chat';
      } else {
        showAlert(data.message || 'Échec de l\'inscription.');
      }
    } catch (err) {
      showAlert('Une erreur réseau s\'est produite.');
    }
  });
}

// --- ÉVÉNEMENTS LANDING PAGE & MODALE ---
if (btnOpenLogin) {
  btnOpenLogin.addEventListener('click', () => {
    authScreen.classList.remove('hide');
  });
}

if (btnHeroStart) {
  btnHeroStart.addEventListener('click', () => {
    authScreen.classList.remove('hide');
  });
}

if (btnCloseAuth) {
  btnCloseAuth.addEventListener('click', () => {
    authScreen.classList.add('hide');
  });
}

if (authScreen) {
  authScreen.addEventListener('click', (e) => {
    if (e.target === authScreen) {
      authScreen.classList.add('hide');
    }
  });
}

document.querySelectorAll('.btn-pricing-select').forEach(btn => {
  btn.addEventListener('click', () => {
    authScreen.classList.remove('hide');
  });
});

// --- GESTION ROUTING / ÉTAT DE SESSION ---
async function checkAuthSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      window.location.href = '/chat';
    }
  } catch (err) {
    console.error('Erreur session:', err);
  }
}

// Lancement au chargement de la page
checkAuthSession();
