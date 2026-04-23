/**
 * pantry.js — Gestione dispensa: due viste, categorie, modal con ricerca OF
 */

let allItems      = [];    // Cache locale prodotti
let editingItem   = null;  // Prodotto in modifica
let currentFilter = 'all'; // Filtro scadenza
let currentView   = 'expiry'; // 'expiry' | 'category'
let selectedProduct = null; // Prodotto OF selezionato nel wizard
let readOnly      = false;  // true se membro (non admin) in contesto gruppo

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    document.getElementById('sidebar-username').textContent = user.username;
    document.getElementById('sidebar-avatar').textContent   = user.username[0].toUpperCase();

    readOnly = user.active_context?.type === 'group' && user.active_context?.role === 'member';

    initSidebar();
    initLogout();
    initViewToggle();
    initSearchBar();
    initFilters();
    initAddWizard();
    initEditForm();
    populateCategorySelects();

    if (readOnly) {
        document.querySelector('.topbar-end .btn-primary')?.remove();
        const banner = document.createElement('div');
        banner.className = 'alert alert-info';
        banner.style.cssText = 'margin-bottom:1rem; font-size:0.88rem;';
        banner.innerHTML = '👁️ Stai visualizzando la dispensa del gruppo come <strong>membro</strong>. Solo gli admin possono aggiungere o modificare prodotti.';
        document.querySelector('.page-content')?.prepend(banner);
    }

    await loadPantry();
});

// ============================================================
// CARICAMENTO DATI
// ============================================================

async function loadPantry() {
    showLoader(true);
    try {
        const res = await api.get('/pantry/list.php');
        if (res.success) {
            allItems = res.items;
            updateStats(res.stats);
            renderCurrentView();
        } else {
            showToast(res.message || 'Errore nel caricamento', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    } finally {
        showLoader(false);
    }
}

function updateStats(stats) {
    setEl('stat-total',    stats.total    ?? 0);
    setEl('stat-expiring', stats.expiring ?? 0);
    setEl('stat-expired',  stats.expired  ?? 0);
}

// ============================================================
// VISTE: PER SCADENZA / PER CATEGORIA
// ============================================================

function initViewToggle() {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;

            // Mostra/nasconde filtri scadenza (solo utili in vista "expiry")
            const filters = document.getElementById('expiry-filters');
            if (filters) filters.style.display = currentView === 'expiry' ? 'flex' : 'none';

            renderCurrentView();
        });
    });
}

function renderCurrentView() {
    if (currentView === 'category') {
        renderByCategory();
    } else {
        renderByExpiry();
    }
}

// ---- Vista per scadenza ----

function renderByExpiry() {
    document.getElementById('pantry-grid').style.display   = 'grid';
    document.getElementById('category-view').style.display = 'none';

    let filtered = applyFilterAndSearch(allItems);

    const grid = document.getElementById('pantry-grid');
    if (!grid) return;

    if (filtered.length === 0) {
        grid.innerHTML = buildEmptyState();
        return;
    }

    grid.innerHTML = filtered.map(buildProductCard).join('');
    attachCardEvents(grid);
}

// ---- Vista per categoria ----

function renderByCategory() {
    document.getElementById('pantry-grid').style.display   = 'none';
    document.getElementById('category-view').style.display = 'block';

    const catView = document.getElementById('category-view');
    let items     = applySearchOnly(allItems); // nessun filtro scadenza nella vista categoria

    if (items.length === 0) {
        catView.innerHTML = buildEmptyState();
        return;
    }

    // Raggruppa per categoria
    const groups = {};
    for (const item of items) {
        const key = item.category || 'altro';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    }

    // Ordine di visualizzazione delle categorie (quelle presenti in cima)
    const order = ['latticini','verdura','frutta','carne','pesce','cereali','surgelati','bevande','condimenti','snack','conserve','altro'];
    const sortedKeys = [
        ...order.filter(k => groups[k]),
        ...Object.keys(groups).filter(k => !order.includes(k))
    ];

    catView.innerHTML = sortedKeys.map(key => {
        const cat   = getCategoryData(key);
        const items = groups[key];
        return `
            <div class="category-section">
                <div class="category-header cat-${key}"
                     style="background:${cat.bg}; color:${cat.text}; border-left-color:${cat.text};">
                    <span class="cat-icon">${cat.icon}</span>
                    <span>${cat.label}</span>
                    <span class="cat-count">${items.length} prodott${items.length === 1 ? 'o' : 'i'}</span>
                </div>
                <div class="pantry-grid">
                    ${items.map(buildProductCard).join('')}
                </div>
            </div>`;
    }).join('');

    attachCardEvents(catView);
}

// ---- Filtro + ricerca ----

function applyFilterAndSearch(items) {
    let filtered = applySearchOnly(items);

    if (currentFilter === 'expiring') filtered = filtered.filter(i => i.expiry_status === 'expiring');
    else if (currentFilter === 'expired') filtered = filtered.filter(i => i.expiry_status === 'expired');
    else if (currentFilter === 'ok') filtered = filtered.filter(i => i.expiry_status === 'ok');

    return filtered;
}

function applySearchOnly(items) {
    const q = document.getElementById('search-input')?.value?.toLowerCase() ?? '';
    if (!q) return items;
    return items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.brand ?? '').toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q)
    );
}

// ============================================================
// CARD PRODOTTO
// ============================================================

function buildProductCard(item) {
    const expiryBadge = getExpiryBadge(item.expiry_status, item.days_to_expiry, item.expiry_date);
    const catBadge    = buildCategoryBadge(item.category);
    const cat         = getCategoryData(item.category || 'altro');

    const cardClass = item.expiry_status === 'expired'  ? 'product-card expired'
                    : item.expiry_status === 'expiring' ? 'product-card expiring'
                    : 'product-card';

    const imageHtml = item.image_url
        ? `<img class="product-image" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}"
               loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\'product-image-placeholder\\' style=\\'background:${cat.bg}\\'>'+\\'${cat.icon}\\'+'</div>'">`
        : `<div class="product-image-placeholder" style="background:${cat.bg}; font-size:3rem;">${cat.icon}</div>`;

    const nutritionHtml = buildNutritionPanel(item);

    return `
        <div class="${cardClass}">
            <div class="product-card-stripe" style="background:${cat.text};"></div>
            ${imageHtml}
            <div class="product-body">
                <div class="product-name">${escapeHtml(item.name)}</div>
                ${item.brand ? `<div class="product-brand">${escapeHtml(item.brand)}</div>` : ''}
                <div class="product-meta">
                    <span class="product-qty">${item.quantity} ${escapeHtml(item.unit)}</span>
                    ${catBadge}
                    ${item.location ? `<span class="badge badge-blue">${escapeHtml(item.location)}</span>` : ''}
                    ${expiryBadge}
                </div>
                ${nutritionHtml}
                ${!readOnly ? `
                <div class="product-actions">
                    <button class="btn btn-outline btn-sm btn-edit" data-id="${item.id}">✏️ Modifica</button>
                    <button class="btn btn-danger btn-sm btn-delete" data-id="${item.id}" data-name="${escapeHtml(item.name)}">🗑️</button>
                </div>` : ''}
            </div>
        </div>`;
}

function attachCardEvents(container) {
    container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id)));
    });
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => confirmDelete(parseInt(btn.dataset.id), btn.dataset.name));
    });
}

function buildEmptyState() {
    return `<div class="empty-state" style="grid-column:1/-1;">
                <div class="empty-icon">📦</div>
                <h3>${allItems.length === 0 ? 'La dispensa è vuota' : 'Nessun risultato'}</h3>
                <p>${allItems.length === 0 ? 'Aggiungi il primo prodotto!' : 'Prova a modificare ricerca o filtri.'}</p>
                ${allItems.length === 0 && !readOnly
                    ? '<button class="btn btn-primary" onclick="openAddModal()" style="margin-top:0.5rem;">+ Aggiungi prodotto</button>'
                    : ''}
            </div>`;
}

// ============================================================
// MODAL ADD — WIZARD 2 STEP
// ============================================================

function openAddModal() {
    selectedProduct = null;
    goToStep(1);
    document.getElementById('of-search-input').value = '';
    document.getElementById('of-search-results').innerHTML = '';
    document.getElementById('of-search-results').classList.add('hidden');
    document.getElementById('of-search-loader').classList.add('hidden');
    openModal('modal-add');
    setTimeout(() => document.getElementById('of-search-input').focus(), 100);
}

function closeAddModal() {
    closeModal('modal-add');
    selectedProduct = null;
}

function goToStep(step) {
    const search  = document.getElementById('step-search');
    const details = document.getElementById('step-details');
    const dot1 = document.getElementById('step-dot-1');
    const dot2 = document.getElementById('step-dot-2');
    const line = document.getElementById('step-line-1');
    const titleEl = document.getElementById('modal-add-title');
    const iconEl  = document.getElementById('modal-add-icon');

    if (step === 1) {
        search.classList.remove('hidden');
        details.classList.add('hidden');
        dot1.className = 'step-dot active';
        dot2.className = 'step-dot';
        line.className = 'step-line';
        titleEl.textContent = 'Cerca prodotto';
        iconEl.textContent  = '🔍';
    } else {
        search.classList.add('hidden');
        details.classList.remove('hidden');
        dot1.className = 'step-dot done';
        dot1.textContent = '✓';
        dot2.className = 'step-dot active';
        line.className = 'step-line done';
        titleEl.textContent = 'Aggiungi alla dispensa';
        iconEl.textContent  = '📦';
    }
}

function initAddWizard() {
    // Ricerca OpenFoodFacts
    const searchBtn   = document.getElementById('btn-of-search');
    const searchInput = document.getElementById('of-search-input');

    searchBtn?.addEventListener('click', () => searchOpenFoodFacts());
    searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') searchOpenFoodFacts(); });

    // Inserimento manuale (fallback)
    document.getElementById('btn-manual-fallback')?.addEventListener('click', () => {
        selectedProduct = { name: '', brand: '', barcode: '', image_url: null, manual: true };
        showStep2Preview(selectedProduct);
        goToStep(2);
        // In modalità manuale rendi visibili i campi nome/marca
        document.getElementById('add-name').type  = 'text';
        document.getElementById('add-brand').type = 'text';
        document.getElementById('add-name').placeholder  = 'Nome prodotto *';
        document.getElementById('add-brand').placeholder = 'Marca (opzionale)';
    });

    // Torna allo step 1
    document.getElementById('btn-back-to-search')?.addEventListener('click', () => {
        selectedProduct = null;
        document.getElementById('add-name').type  = 'hidden';
        document.getElementById('add-brand').type = 'hidden';
        goToStep(1);
    });

    // Submit form aggiunta
    document.getElementById('form-add')?.addEventListener('submit', handleAddSubmit);
}

async function searchOpenFoodFacts() {
    const query = document.getElementById('of-search-input')?.value?.trim();
    if (!query) return;

    const loader  = document.getElementById('of-search-loader');
    const results = document.getElementById('of-search-results');
    const btn     = document.getElementById('btn-of-search');

    loader.classList.remove('hidden');
    results.classList.add('hidden');
    results.innerHTML = '';
    btn.disabled = true;
    btn.textContent = '…';

    try {
        const res = await api.get(`/barcode/search_by_name.php?name=${encodeURIComponent(query)}`);
        loader.classList.add('hidden');

        if (res.success && res.products.length > 0) {
            renderSearchResults(res.products, results);
            results.classList.remove('hidden');
        } else {
            results.innerHTML = `<div class="alert alert-warning" style="margin-top:0.5rem;">
                <span class="alert-icon">⚠️</span>
                <div>Nessun prodotto trovato per <strong>"${escapeHtml(query)}"</strong>. Prova con un termine diverso o usa l'inserimento manuale.</div>
            </div>`;
            results.classList.remove('hidden');
        }
    } catch {
        loader.classList.add('hidden');
        showToast('Errore durante la ricerca', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Cerca';
    }
}

function renderSearchResults(products, container) {
    container.innerHTML = `<p style="font-size:0.82rem; color:var(--text-light); margin-bottom:0.5rem;">
        ${products.length} prodott${products.length === 1 ? 'o' : 'i'} trovat${products.length === 1 ? 'o' : 'i'} — clicca per selezionare:
    </p>` + products.map((p, idx) => `
        <div class="product-result-item" data-idx="${idx}">
            ${p.image_url
                ? `<img class="product-result-img" src="${escapeHtml(p.image_url)}" alt="" onerror="this.style.display='none'">`
                : `<div class="product-result-placeholder">🥫</div>`}
            <div class="product-result-info">
                <div class="product-result-name">${escapeHtml(p.name)}</div>
                <div class="product-result-brand">${p.brand ? escapeHtml(p.brand) : 'Marca sconosciuta'}
                    ${p.calories_per_100g ? ` · ${p.calories_per_100g} kcal/100g` : ''}</div>
            </div>
            <span style="color:var(--primary); font-size:1.2rem;">›</span>
        </div>`
    ).join('');

    // Attacca click handler
    container.querySelectorAll('.product-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.idx);
            selectedProduct = products[idx];
            showStep2Preview(selectedProduct);
            goToStep(2);

            // Assicurati che nome e marca siano hidden (vengono dagli hidden fields)
            document.getElementById('add-name').type  = 'hidden';
            document.getElementById('add-brand').type = 'hidden';

            // Pre-seleziona categoria se deducibile
            preSelectCategory(selectedProduct);
        });
    });
}

function showStep2Preview(product) {
    const preview = document.getElementById('selected-preview');
    if (!preview) return;

    if (product.manual) {
        preview.innerHTML = `
            <div style="font-size:2rem;">✏️</div>
            <div>
                <h4>Inserimento manuale</h4>
                <p>Compila nome, marca e categoria manualmente.</p>
            </div>`;
        // Mostra i campi input per modalità manuale
        const nameField  = document.getElementById('add-name');
        const brandField = document.getElementById('add-brand');
        nameField.type   = 'text';
        brandField.type  = 'text';
        nameField.required = true;
        return;
    }

    // Popola hidden fields
    document.getElementById('add-name').value    = product.name    || '';
    document.getElementById('add-brand').value   = product.brand   || '';
    document.getElementById('add-barcode').value = product.barcode || '';

    const imgHtml = product.image_url
        ? `<img src="${escapeHtml(product.image_url)}" alt="" onerror="this.style.display='none'">`
        : `<div style="width:52px;height:52px;background:var(--green-100);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;">🥫</div>`;

    preview.innerHTML = `
        ${imgHtml}
        <div>
            <h4>${escapeHtml(product.name)}</h4>
            <p>${product.brand ? escapeHtml(product.brand) : ''}
               ${product.calories_per_100g ? ` · ${product.calories_per_100g} kcal/100g` : ''}</p>
        </div>`;

    // Azzera il form
    document.getElementById('form-add').reset();
    document.getElementById('add-name').value    = product.name    || '';
    document.getElementById('add-brand').value   = product.brand   || '';
    document.getElementById('add-barcode').value = product.barcode || '';
}

/** Tenta di pre-selezionare la categoria in base alla categoria OF */
function preSelectCategory(product) {
    const select = document.getElementById('add-category');
    if (!select || !product.of_category) return;

    const ofCat = product.of_category.toLowerCase();
    const map = {
        lait: 'latticini', milk: 'latticini', dairy: 'latticini', fromage: 'latticini', cheese: 'latticini', yogurt: 'latticini',
        vegetable: 'verdura', vegetables: 'verdura', legume: 'verdura', salad: 'verdura',
        fruit: 'frutta', fruits: 'frutta', frutta: 'frutta',
        meat: 'carne', chicken: 'carne', beef: 'carne', poultry: 'carne',
        fish: 'pesce', seafood: 'pesce',
        pasta: 'cereali', rice: 'cereali', bread: 'cereali', cereal: 'cereali', grain: 'cereali',
        frozen: 'surgelati', surgel: 'surgelati',
        beverage: 'bevande', drink: 'bevande', juice: 'bevande', water: 'bevande', soda: 'bevande',
        sauce: 'condimenti', oil: 'condimenti', vinegar: 'condimenti', spice: 'condimenti',
        snack: 'snack', biscuit: 'snack', cookie: 'snack', chocolate: 'snack', sweet: 'snack',
        canned: 'conserve', conserv: 'conserve', tinned: 'conserve',
    };

    for (const [keyword, cat] of Object.entries(map)) {
        if (ofCat.includes(keyword)) {
            select.value = cat;
            return;
        }
    }
}

async function handleAddSubmit(e) {
    e.preventDefault();

    const isManual = selectedProduct?.manual;

    const name     = isManual
        ? document.getElementById('add-name').value.trim()
        : document.getElementById('add-name').value;
    const brand    = document.getElementById('add-brand').value.trim() || null;
    const barcode  = document.getElementById('add-barcode').value.trim() || null;
    const category = document.getElementById('add-category').value;
    const quantity = parseFloat(document.getElementById('add-quantity').value) || 1;
    const unit     = document.getElementById('add-unit').value || 'pz';
    const expiry   = document.getElementById('add-expiry').value || null;
    const location = document.getElementById('add-location').value || null;
    const notes    = document.getElementById('add-notes').value.trim() || null;

    if (!name) { showToast('Il nome del prodotto è obbligatorio', 'warning'); return; }
    if (!category) { showToast('Seleziona una categoria', 'warning'); return; }

    const btn = document.getElementById('btn-add-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Aggiungendo…'; }

    try {
        const res = await api.post('/pantry/add.php', {
            name, brand, barcode, category, quantity, unit,
            expiry_date: expiry, location, notes,
            image_url:         selectedProduct?.image_url         ?? null,
            calories_per_100g: selectedProduct?.calories_per_100g ?? null,
            proteins_per_100g: selectedProduct?.proteins_per_100g ?? null,
            carbs_per_100g:    selectedProduct?.carbs_per_100g    ?? null,
            fats_per_100g:     selectedProduct?.fats_per_100g     ?? null,
            fiber_per_100g:    selectedProduct?.fiber_per_100g    ?? null,
            salt_per_100g:     selectedProduct?.salt_per_100g     ?? null,
        });

        if (res.success) {
            showToast('Prodotto aggiunto!', 'success');
            closeAddModal();
            await loadPantry();
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '✓ Aggiungi alla dispensa'; }
    }
}

// ============================================================
// MODAL EDIT
// ============================================================

function openEditModal(itemId) {
    editingItem = allItems.find(i => i.id === itemId);
    if (!editingItem) return;

    const form = document.getElementById('form-edit');
    form.querySelector('#edit-name').value     = editingItem.name         || '';
    form.querySelector('#edit-brand').value    = editingItem.brand        || '';
    form.querySelector('#edit-category').value = editingItem.category     || '';
    form.querySelector('#edit-quantity').value = editingItem.quantity     || 1;
    form.querySelector('#edit-unit').value     = editingItem.unit         || 'pz';
    form.querySelector('#edit-expiry').value   = editingItem.expiry_date  || '';
    form.querySelector('#edit-location').value = editingItem.location     || '';
    form.querySelector('#edit-notes').value    = editingItem.notes        || '';

    openModal('modal-edit');
}

function initEditForm() {
    document.getElementById('form-edit')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!editingItem) return;

        const form = document.getElementById('form-edit');
        const category = form.querySelector('#edit-category').value;
        if (!category) { showToast('Seleziona una categoria', 'warning'); return; }

        const data = {
            id:          editingItem.id,
            name:        form.querySelector('#edit-name').value.trim(),
            brand:       form.querySelector('#edit-brand').value.trim() || null,
            category,
            quantity:    parseFloat(form.querySelector('#edit-quantity').value) || 1,
            unit:        form.querySelector('#edit-unit').value,
            expiry_date: form.querySelector('#edit-expiry').value || null,
            location:    form.querySelector('#edit-location').value || null,
            notes:       form.querySelector('#edit-notes').value.trim() || null,
        };

        const btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

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
            if (btn) { btn.disabled = false; btn.textContent = '💾 Salva modifiche'; }
        }
    });
}

// ============================================================
// ELIMINA
// ============================================================

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

// ============================================================
// UTILITY
// ============================================================

function initSearchBar() {
    let timeout;
    document.getElementById('search-input')?.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => renderCurrentView(), 200);
    });
}

function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderCurrentView();
        });
    });
}

/** Popola i select categoria in add e edit modal */
function populateCategorySelects() {
    const options = buildCategoryOptions();
    document.getElementById('add-category').innerHTML  = '<option value="">— seleziona categoria —</option>' + options;
    document.getElementById('edit-category').innerHTML = '<option value="">— seleziona categoria —</option>' + options;
}

function showLoader(visible) {
    document.getElementById('list-loader').style.display  = visible ? 'flex'  : 'none';
    document.getElementById('pantry-grid').style.display  = visible ? 'none'  : (currentView === 'expiry' ? 'grid' : 'none');
    document.getElementById('category-view').style.display = visible ? 'none' : (currentView === 'category' ? 'block' : 'none');
}

function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = 'index.html';
    });
}
