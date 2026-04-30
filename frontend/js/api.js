/**
 * IL "PONTE" TRA SITO E SERVER (api.js)
 * 
 * Questo file contiene tutte le funzioni che permettono al sito web (quello che vede l'utente)
 * di parlare con il server (dove sono salvati i dati).
 * È come un cameriere che porta gli ordini dal tavolo alla cucina.
 */

// Calcoliamo dove si trova la cartella delle API in base a dove siamo nel sito
const API_BASE = new URL('../api', window.location.href).href.replace(/\/$/, '');

/**
 * DEFINIZIONE DELLE CATEGORIE
 * Qui decidiamo che aspetto hanno le categorie: quale icona usare, il colore dello sfondo e del testo.
 */
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

/**
 * FUNZIONE PER FARE UNA RICHIESTA AL SERVER
 * Questa è la funzione principale. Prende un indirizzo (endpoint) e i dati da inviare.
 */
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        credentials: 'include', // Dice al browser di "ricordarsi" chi siamo (tramite i cookie)
        headers: {
            'Content-Type': 'application/json' // Diciamo al server che gli stiamo mandando dati in formato JSON
        }
    };

    // Se dobbiamo inviare dei dati (e non stiamo solo leggendo), li trasformiamo in testo JSON
    if (body !== null && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    // Facciamo la chiamata vera e propria
    const response = await fetch(API_BASE + endpoint, options);
    const data     = await response.json();

    // Se il server ci dice che non siamo autorizzati (sessione scaduta), torniamo alla pagina di login
    if (response.status === 401 && !window.location.pathname.includes('index.html')) {
        window.location.href = 'index.html';
        return;
    }

    return data;
}

/**
 * SCORCIATOIE PER LE API
 * Invece di scrivere ogni volta apiCall(..., 'GET'), usiamo api.get(...)
 */
const api = {
    get:    (endpoint)        => apiCall(endpoint, 'GET'),
    post:   (endpoint, body)  => apiCall(endpoint, 'POST',   body),
    put:    (endpoint, body)  => apiCall(endpoint, 'PUT',    body),
    delete: (endpoint, body)  => apiCall(endpoint, 'DELETE', body),
};

/**
 * CONTROLLO ACCESSO
 * Questa funzione controlla se l'utente ha fatto il login. Se no, lo rimanda alla porta d'ingresso.
 */
async function requireLogin() {
    try {
        const res = await api.get('/auth/me.php');
        if (!res.success) {
            window.location.href = 'index.html';
            return null;
        }
        // Se l'utente è loggato, prepariamo anche il selettore per passare da dispensa personale a gruppo
        initContextSwitcher(res.user);
        return res.user;
    } catch {
        window.location.href = 'index.html';
        return null;
    }
}

/**
 * NOTIFICHE A COMPARSA (Toast)
 * Crea quei piccoli messaggi colorati che appaiono in basso per confermare un'azione (es: "Prodotto aggiunto!").
 */
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

    // Facciamo sparire il messaggio dopo qualche secondo
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * PULIZIA TESTO (Escape HTML)
 * Funzione di sicurezza: evita che testi strani o malevoli possano rompere il sito.
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
