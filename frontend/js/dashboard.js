/**
 * dashboard.js — Pagina home: statistiche generali della dispensa
 */

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    // Popola il nome utente
    const usernameEl = document.getElementById('sidebar-username');
    if (usernameEl) usernameEl.textContent = user.username;
    const avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) avatarEl.textContent = user.username[0].toUpperCase();

    document.getElementById('welcome-name').textContent = user.username;

    initSidebar();
    initLogout();
    await loadDashboard();
});

/** Carica dati per la dashboard */
async function loadDashboard() {
    try {
        const [userRes, pantryRes] = await Promise.all([
            api.get('/auth/me.php'),
            api.get('/pantry/list.php')
        ]);

        if (userRes.success) {
            renderStats(userRes.user.stats, pantryRes.success ? pantryRes.stats : null);
        }

        if (pantryRes.success) {
            renderExpiringList(pantryRes.items);
        }
    } catch {
        showToast('Errore nel caricamento dei dati', 'error');
    }
}

/** Renderizza le statistiche */
function renderStats(userStats, pantryStats) {
    const stats = pantryStats ?? userStats;

    setEl('stat-total',    stats.total    ?? 0);
    setEl('stat-expiring', stats.expiring ?? 0);
    setEl('stat-expired',  stats.expired  ?? 0);
    setEl('stat-ok',       stats.ok       ?? 0);
}

/** Renderizza la lista prodotti in scadenza nella dashboard */
function renderExpiringList(items) {
    const list = document.getElementById('expiring-list');
    if (!list) return;

    // Filtra solo i prodotti in scadenza o scaduti con data
    const critical = items
        .filter(i => i.expiry_status === 'expired' || i.expiry_status === 'expiring')
        .slice(0, 8);

    if (critical.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="padding: 2rem;">
                <div class="empty-icon" style="font-size: 2rem;">✅</div>
                <p>Nessun prodotto in scadenza imminente.</p>
            </div>`;
        return;
    }

    list.innerHTML = critical.map(item => {
        const badge = item.expiry_status === 'expired'
            ? `<span class="badge badge-expired">Scaduto</span>`
            : `<span class="badge badge-expiring">Scade in ${item.days_to_expiry} giorni</span>`;

        return `
            <div style="display: flex; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid var(--border-light); gap: 0.75rem;">
                <span style="font-size: 1.5rem;">🥫</span>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.9rem;">${escapeHtml(item.name)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-light);">${formatDate(item.expiry_date)}</div>
                </div>
                ${badge}
            </div>`;
    }).join('');
}

/** Renderizza ultimi prodotti aggiunti */
function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = '../index.html';
    });
}
