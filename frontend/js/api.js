/**
 * api.js — Utility per le chiamate alle API del backend
 * Wrapper attorno a fetch() con gestione errori centralizzata
 */

// Base URL del backend — si adatta automaticamente in base all'origine
const API_BASE = window.location.origin + '/smartpantry2/api';

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

// ---- Sidebar mobile ----

function initSidebar() {
    const hamburger = document.getElementById('hamburger');
    const sidebar   = document.getElementById('sidebar');
    const overlay   = document.getElementById('sidebar-overlay');

    if (!hamburger || !sidebar) return;

    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay?.classList.toggle('active');
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    });
}
