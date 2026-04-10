/**
 * api.js — Utility per le chiamate alle API del backend
 * Wrapper attorno a fetch() con gestione errori centralizzata
 */

// Base URL del backend — si adatta automaticamente in base all'origine
const API_BASE = window.location.origin + '/smartpantry2/api';

// ---- Definizione categorie prodotti (icona, colori, etichetta) ----
const CATEGORIES = {
    latticini:  { icon: '🧀', bg: '#fff8e1', border: '#ffe082', text: '#c56a00', label: 'Latticini' },
    verdura:    { icon: '🥦', bg: '#e8f5e9', border: '#a5d6a7', text: '#2e7d32', label: 'Verdura' },
    frutta:     { icon: '🍎', bg: '#fce4ec', border: '#f48fb1', text: '#ad1457', label: 'Frutta' },
    carne:      { icon: '🥩', bg: '#fbe9e7', border: '#ffab91', text: '#bf360c', label: 'Carne' },
    pesce:      { icon: '🐟', bg: '#e3f2fd', border: '#90caf9', text: '#1565c0', label: 'Pesce' },
    cereali:    { icon: '🌾', bg: '#fff3e0', border: '#ffcc80', text: '#e65100', label: 'Cereali & Pasta' },
    surgelati:  { icon: '🧊', bg: '#e8eaf6', border: '#9fa8da', text: '#283593', label: 'Surgelati' },
    bevande:    { icon: '🥤', bg: '#e1f5fe', border: '#81d4fa', text: '#0277bd', label: 'Bevande' },
    condimenti: { icon: '🧂', bg: '#f3e5f5', border: '#ce93d8', text: '#6a1b9a', label: 'Condimenti' },
    snack:      { icon: '🍿', bg: '#fbe9e7', border: '#ef9a9a', text: '#c62828', label: 'Snack & Dolci' },
    conserve:   { icon: '🥫', bg: '#f1f8e9', border: '#c5e1a5', text: '#33691e', label: 'Conserve' },
    altro:      { icon: '📦', bg: '#f5f5f5', border: '#e0e0e0', text: '#546e7a', label: 'Altro' },
};

/** Restituisce i dati categoria (o 'altro' come fallback) */
function getCategoryData(key) {
    return CATEGORIES[key] || CATEGORIES['altro'];
}

/** Genera l'HTML del badge categoria */
function buildCategoryBadge(category) {
    if (!category) return '';
    const cat = getCategoryData(category);
    return `<span class="cat-badge cat-${category}"
                  style="background:${cat.bg}; color:${cat.text}; border:1px solid ${cat.border};">
                ${cat.icon} ${cat.label}
            </span>`;
}

/** Genera le opzioni HTML per il select categoria */
function buildCategoryOptions(selected = '') {
    return Object.entries(CATEGORIES).map(([key, cat]) =>
        `<option value="${key}" ${key === selected ? 'selected' : ''}>${cat.icon} ${cat.label}</option>`
    ).join('');
}

/**
 * Effettua una chiamata API generica.
 * @param {string} endpoint — es. '/auth/login.php'
 * @param {string} method   — GET, POST, PUT, DELETE
 * @param {object} body     — dati da inviare (opzionale)
 * @returns {Promise<object>} — risposta JSON parsata
 */
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        credentials: 'include', // necessario per inviare i cookie di sessione
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body !== null && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(API_BASE + endpoint, options);
    const data     = await response.json();

    // Reindirizza al login se la sessione è scaduta
    if (response.status === 401 && !window.location.pathname.includes('index.html')) {
        window.location.href = '../index.html';
        return;
    }

    return data;
}

// ---- Shortcut per i metodi HTTP ----

const api = {
    get:    (endpoint)        => apiCall(endpoint, 'GET'),
    post:   (endpoint, body)  => apiCall(endpoint, 'POST',   body),
    put:    (endpoint, body)  => apiCall(endpoint, 'PUT',    body),
    delete: (endpoint, body)  => apiCall(endpoint, 'DELETE', body),
};

// ---- Gestione sessione ----

/**
 * Recupera i dati dell'utente corrente.
 * Restituisce null se non loggato.
 */
async function getCurrentUser() {
    try {
        const res = await api.get('/auth/me.php');
        return res.success ? res.user : null;
    } catch {
        return null;
    }
}

/**
 * Controlla se l'utente è loggato.
 * Se non lo è, reindirizza al login.
 */
async function requireLogin() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = '../index.html';
        return null;
    }
    return user;
}

// ---- Toast notifiche ----

function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    // Rimuovi il toast dopo la durata specificata
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ---- Utility HTML ----

/**
 * Sanitizza una stringa per l'inserimento sicuro nel DOM.
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Formatta una data ISO (YYYY-MM-DD) in formato italiano (GG/MM/AAAA).
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

/**
 * Restituisce il testo del badge in base allo stato di scadenza.
 */
function getExpiryBadge(expiryStatus, daysToExpiry, expiryDate) {
    if (!expiryDate) return '';

    if (expiryStatus === 'expired') {
        return `<span class="badge badge-expired">Scaduto</span>`;
    }
    if (expiryStatus === 'expiring') {
        return `<span class="badge badge-expiring">Scade in ${daysToExpiry} giorni</span>`;
    }
    return `<span class="badge badge-ok">Scade il ${formatDate(expiryDate)}</span>`;
}

// ---- Modal ----

function openModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (overlay) overlay.classList.add('active');
}

function closeModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (overlay) overlay.classList.remove('active');
}

// Chiudi modal cliccando sull'overlay
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// ---- Drawer navigazione ----

function initSidebar() {
    initDrawer();
}

function initDrawer() {
    const hamburger = document.getElementById('hamburger');
    const drawer    = document.getElementById('drawer');
    const overlay   = document.getElementById('drawer-overlay');
    const closeBtn  = document.getElementById('drawer-close');

    if (!hamburger || !drawer) return;

    function openDrawer() {
        drawer.classList.add('open');
        overlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        drawer.classList.remove('open');
        overlay?.classList.remove('active');
        document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', openDrawer);
    closeBtn?.addEventListener('click', closeDrawer);
    overlay?.addEventListener('click', closeDrawer);

    // Chiudi il drawer con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDrawer();
    });
}
