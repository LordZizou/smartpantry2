/**
 * pantry.js — Gestione dispensa (lista, aggiunta, modifica, eliminazione)
 */

let allItems     = [];   // Cache locale di tutti i prodotti
let editingItem  = null; // Prodotto in modifica
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    // Popola il nome utente nella sidebar
    const usernameEl = document.getElementById('sidebar-username');
    if (usernameEl) usernameEl.textContent = user.username;
    const avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) avatarEl.textContent = user.username[0].toUpperCase();

    initSidebar();
    initLogout();
    initSearchBar();
    initFilters();
    initAddForm();
    initEditForm();
    await loadPantry();
});

/** Carica e visualizza tutti i prodotti della dispensa */
async function loadPantry() {
    showListLoading(true);
    try {
        const res = await api.get('/pantry/list.php');
        if (res.success) {
            allItems = res.items;
            updateStats(res.stats);
            renderItems(allItems);
        } else {
            showToast(res.message || 'Errore nel caricamento', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    } finally {
        showListLoading(false);
    }
}

/** Aggiorna le statistiche in cima alla pagina */
function updateStats(stats) {
    setEl('stat-total',    stats.total    ?? 0);
    setEl('stat-expiring', stats.expiring ?? 0);
    setEl('stat-expired',  stats.expired  ?? 0);
}

/** Renderizza la griglia di prodotti applicando il filtro e la ricerca attivi */
function renderItems(items) {
    const grid = document.getElementById('pantry-grid');
    if (!grid) return;

    // Applica filtro attivo
    let filtered = items;
    if (currentFilter === 'expiring') {
        filtered = items.filter(i => i.expiry_status === 'expiring');
    } else if (currentFilter === 'expired') {
        filtered = items.filter(i => i.expiry_status === 'expired');
    } else if (currentFilter === 'ok') {
        filtered = items.filter(i => i.expiry_status === 'ok');
    }

    // Applica ricerca testuale
    const searchVal = document.getElementById('search-input')?.value?.toLowerCase() ?? '';
    if (searchVal) {
        filtered = filtered.filter(i =>
            i.name.toLowerCase().includes(searchVal) ||
            (i.brand ?? '').toLowerCase().includes(searchVal)
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1">
                <div class="empty-icon">📦</div>
                <h3>Nessun prodotto trovato</h3>
                <p>${allItems.length === 0
                    ? 'La tua dispensa è vuota. Aggiungi il primo prodotto!'
                    : 'Prova a modificare la ricerca o i filtri.'}
                </p>
                ${allItems.length === 0 ? '<button class="btn btn-primary" onclick="openModal(\'modal-add\')">+ Aggiungi prodotto</button>' : ''}
            </div>`;
        return;
    }

    grid.innerHTML = filtered.map(buildProductCard).join('');

    // Attacca gli event listener ai bottoni delle card
    grid.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id)));
    });

    grid.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => confirmDelete(parseInt(btn.dataset.id), btn.dataset.name));
    });
}

/** Costruisce l'HTML di una card prodotto */
function buildProductCard(item) {
    const expiryBadge   = getExpiryBadge(item.expiry_status, item.days_to_expiry, item.expiry_date);
    const cardClass     = item.expiry_status === 'expired'  ? 'product-card expired'
                        : item.expiry_status === 'expiring' ? 'product-card expiring'
                        : 'product-card';

    const imageHtml = item.image_url
        ? `<img class="product-image" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\'product-image-placeholder\\'>🥫</div>'">`
        : `<div class="product-image-placeholder">🥫</div>`;

    const nutritionHtml = item.calories_per_100g
        ? `<div class="nutrition-grid" style="margin-top: 0.5rem;">
               <div class="nutrition-item"><div class="nutrition-value">${item.calories_per_100g}</div><div class="nutrition-label">kcal</div></div>
               <div class="nutrition-item"><div class="nutrition-value">${item.proteins_per_100g ?? '—'}</div><div class="nutrition-label">proteine</div></div>
               <div class="nutrition-item"><div class="nutrition-value">${item.carbs_per_100g ?? '—'}</div><div class="nutrition-label">carboidrati</div></div>
               <div class="nutrition-item"><div class="nutrition-value">${item.fats_per_100g ?? '—'}</div><div class="nutrition-label">grassi</div></div>
           </div>`
        : '';

    return `
        <div class="${cardClass}">
            ${imageHtml}
            <div class="product-body">
                <div class="product-name">${escapeHtml(item.name)}</div>
                ${item.brand ? `<div class="product-brand">${escapeHtml(item.brand)}</div>` : ''}
                <div class="product-meta">
                    <span class="product-qty">Qtà: ${item.quantity} ${escapeHtml(item.unit)}</span>
                    ${item.location ? `<span class="badge badge-blue">${escapeHtml(item.location)}</span>` : ''}
                    ${expiryBadge}
                </div>
                ${nutritionHtml}
                <div class="product-actions">
                    <button class="btn btn-outline btn-sm btn-edit" data-id="${item.id}">✏️ Modifica</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${item.id}" data-name="${escapeHtml(item.name)}">🗑️ Elimina</button>
                </div>
            </div>
        </div>`;
}

/** Inizializza la barra di ricerca */
function initSearchBar() {
    const input = document.getElementById('search-input');
    if (!input) return;
    let timeout;
    input.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => renderItems(allItems), 200);
    });
}

/** Inizializza i pulsanti filtro */
function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderItems(allItems);
        });
    });
}

/** Inizializza il form di aggiunta prodotto */
function initAddForm() {
    const form = document.getElementById('form-add');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = getFormData(form);
        if (!data.name) { showToast('Il nome è obbligatorio', 'warning'); return; }

        const btn = form.querySelector('button[type="submit"]');
        setButtonState(btn, true, 'Aggiungendo...');

        try {
            const res = await api.post('/pantry/add.php', data);
            if (res.success) {
                showToast('Prodotto aggiunto!', 'success');
                closeModal('modal-add');
                form.reset();
                await loadPantry();
            } else {
                showToast(res.message || 'Errore', 'error');
            }
        } catch {
            showToast('Errore di connessione', 'error');
        } finally {
            setButtonState(btn, false, '+ Aggiungi');
        }
    });
}

/** Apre il modal di modifica con i dati del prodotto */
function openEditModal(itemId) {
    editingItem = allItems.find(i => i.id === itemId);
    if (!editingItem) return;

    const form = document.getElementById('form-edit');
    if (!form) return;

    // Popola il form con i dati esistenti
    form.querySelector('#edit-name').value        = editingItem.name     || '';
    form.querySelector('#edit-brand').value       = editingItem.brand    || '';
    form.querySelector('#edit-quantity').value    = editingItem.quantity || 1;
    form.querySelector('#edit-unit').value        = editingItem.unit     || 'pz';
    form.querySelector('#edit-expiry').value      = editingItem.expiry_date || '';
    form.querySelector('#edit-location').value    = editingItem.location || '';
    form.querySelector('#edit-notes').value       = editingItem.notes    || '';

    openModal('modal-edit');
}

/** Inizializza il form di modifica prodotto */
function initEditForm() {
    const form = document.getElementById('form-edit');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!editingItem) return;

        const data = { id: editingItem.id, ...getFormData(form, 'edit-') };
        if (!data.name) { showToast('Il nome è obbligatorio', 'warning'); return; }

        const btn = form.querySelector('button[type="submit"]');
        setButtonState(btn, true, 'Salvando...');

        try {
            const res = await api.put('/pantry/update.php', data);
            if (res.success) {
                showToast('Prodotto aggiornato!', 'success');
                closeModal('modal-edit');
                editingItem = null;
                await loadPantry();
            } else {
                showToast(res.message || 'Errore', 'error');
            }
        } catch {
            showToast('Errore di connessione', 'error');
        } finally {
            setButtonState(btn, false, '💾 Salva');
        }
    });
}

/** Chiede conferma ed elimina un prodotto */
function confirmDelete(itemId, itemName) {
    if (!confirm(`Eliminare "${itemName}" dalla dispensa?`)) return;
    deleteItem(itemId);
}

async function deleteItem(itemId) {
    try {
        const res = await api.delete('/pantry/delete.php', { id: itemId });
        if (res.success) {
            showToast('Prodotto eliminato', 'success');
            await loadPantry();
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

/** Legge i dati dal form in un oggetto */
function getFormData(form, prefix = '') {
    const get = id => form.querySelector(`#${prefix}${id}`)?.value?.trim() ?? '';
    return {
        name:        get('name'),
        brand:       get('brand')    || null,
        quantity:    parseFloat(get('quantity')) || 1,
        unit:        get('unit')     || 'pz',
        expiry_date: get('expiry')   || null,
        location:    get('location') || null,
        notes:       get('notes')    || null,
    };
}

/** Mostra/nasconde il loading nella griglia */
function showListLoading(visible) {
    const loader = document.getElementById('list-loader');
    const grid   = document.getElementById('pantry-grid');
    if (loader) loader.style.display = visible ? 'flex' : 'none';
    if (grid)   grid.style.display   = visible ? 'none' : 'grid';
}

/** Imposta il testo del bottone e il disabled */
function setButtonState(btn, disabled, text) {
    if (!btn) return;
    btn.disabled    = disabled;
    btn.textContent = text;
}

/** Imposta il contenuto testuale di un elemento per ID */
function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/** Inizializza il bottone logout */
function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = '../index.html';
    });
}
