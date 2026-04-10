/**
 * recipes.js — Ricette consigliate + ricerca per nome
 */

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    const usernameEl = document.getElementById('sidebar-username');
    if (usernameEl) usernameEl.textContent = user.username;
    const avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) avatarEl.textContent = user.username[0].toUpperCase();

    initSidebar();
    initLogout();
    initTabs();
    initControls();
    initSearchForm();
    await loadRecipes();
});

// ============================================================
// TAB
// ============================================================

function initTabs() {
    document.querySelectorAll('.pill-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.pill-tab').forEach(b => b.classList.toggle('active', b === btn));
            document.getElementById('section-suggested').style.display = tab === 'suggested' ? 'block' : 'none';
            document.getElementById('section-search').style.display    = tab === 'search'    ? 'block' : 'none';
        });
    });
}

// ============================================================
// RICETTE CONSIGLIATE
// ============================================================

async function loadRecipes(pantryOnly = false) {
    showGrid(false);
    document.getElementById('recipes-stats').style.display = 'none';

    try {
        const params = `?pantry_only=${pantryOnly ? 1 : 0}&number=12`;
        const res    = await api.get('/recipes/suggest.php' + params);

        if (res.success) {
            renderRecipes(res.recipes, 'recipes-grid');
            showStats(res);
        } else {
            showGridError('recipes-grid', res.message || 'Errore nel caricamento ricette');
        }
    } catch {
        showGridError('recipes-grid', 'Errore di connessione. Verifica che il server sia attivo.');
    } finally {
        showGrid(true);
    }
}

function showStats(data) {
    const statsEl = document.getElementById('recipes-stats');
    if (!statsEl) return;
    statsEl.style.display = 'flex';
    statsEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon green">🍽️</div>
            <div class="stat-info">
                <div class="stat-value">${data.total_found}</div>
                <div class="stat-label">Ricette trovate</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon blue">✓</div>
            <div class="stat-info">
                <div class="stat-value">${data.can_make_now}</div>
                <div class="stat-label">Puoi fare subito</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon yellow">🥕</div>
            <div class="stat-info">
                <div class="stat-value">${data.pantry_items?.length ?? 0}</div>
                <div class="stat-label">Ingredienti usati</div>
            </div>
        </div>`;
}

function showGrid(visible) {
    const loader = document.getElementById('recipes-loader');
    const grid   = document.getElementById('recipes-grid');
    if (loader) loader.style.display = visible ? 'none' : 'block';
    if (grid)   grid.style.display   = visible ? 'grid' : 'none';
}

function initControls() {
    document.getElementById('toggle-pantry-only')?.addEventListener('change', e => {
        loadRecipes(e.target.checked);
    });
    document.getElementById('btn-reload')?.addEventListener('click', () => {
        const toggle = document.getElementById('toggle-pantry-only');
        loadRecipes(toggle?.checked ?? false);
    });
}

// ============================================================
// RICERCA RICETTE PER NOME
// ============================================================

function initSearchForm() {
    document.getElementById('btn-search')?.addEventListener('click', handleSearch);

    document.getElementById('search-query')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleSearch();
    });
}

/** Avvia la ricerca dal form */
async function handleSearch() {
    const input = document.getElementById('search-query');
    const query = input?.value?.trim();
    if (!query) {
        input?.focus();
        showToast('Inserisci un termine di ricerca', 'warning');
        return;
    }
    await searchRecipes(query);
}

/** Ricerca rapida tramite chip suggeriti */
function quickSearch(query) {
    const input = document.getElementById('search-query');
    if (input) input.value = query;
    searchRecipes(query);
}

/** Effettua la ricerca e renderizza i risultati */
async function searchRecipes(query) {
    // Mostra sezione ricerca
    document.querySelectorAll('.pill-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'search'));
    document.getElementById('section-suggested').style.display = 'none';
    document.getElementById('section-search').style.display    = 'block';

    // Nascondi suggerimenti e mostra loader
    document.getElementById('search-suggestions').style.display = 'none';
    document.getElementById('search-info').style.display        = 'none';
    document.getElementById('search-loader').style.display      = 'flex';
    document.getElementById('search-grid').innerHTML             = '';

    const btn = document.getElementById('btn-search');
    if (btn) { btn.disabled = true; btn.textContent = 'Ricerca…'; }

    try {
        const res = await api.get(`/recipes/search.php?query=${encodeURIComponent(query)}&number=12`);

        document.getElementById('search-loader').style.display = 'none';

        if (res.success) {
            renderRecipes(res.recipes, 'search-grid');
            showSearchInfo(query, res.total_found, res.can_make_now);
        } else {
            showGridError('search-grid', res.message || 'Nessun risultato');
        }
    } catch {
        document.getElementById('search-loader').style.display = 'none';
        showGridError('search-grid', 'Errore di connessione. Controlla che il server sia attivo.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Cerca'; }
    }
}

/** Mostra info sui risultati di ricerca */
function showSearchInfo(query, total, canMakeNow) {
    const infoEl = document.getElementById('search-info');
    const labelEl = document.getElementById('search-query-label');
    const countEl = document.getElementById('search-count');

    if (infoEl && labelEl && countEl) {
        infoEl.style.display = 'flex';
        labelEl.textContent  = `"${query}"`;
        countEl.innerHTML    = `— ${total} risultat${total === 1 ? 'o' : 'i'}${
            canMakeNow > 0 ? ` · <span style="color:var(--success)">✓ ${canMakeNow} fattibil${canMakeNow === 1 ? 'e' : 'i'} subito</span>` : ''
        }`;
    }
}

// ============================================================
// RENDERING CARD RICETTE (condiviso tra suggerite e ricerca)
// ============================================================

function renderRecipes(recipes, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    if (!recipes || recipes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <div class="empty-icon">🍽️</div>
                <h3>Nessuna ricetta trovata</h3>
                <p>Prova con un termine diverso o aggiungi più prodotti alla dispensa.</p>
                <a href="pantry.html" class="btn btn-primary" style="margin-top:0.5rem;">Vai alla dispensa</a>
            </div>`;
        return;
    }

    grid.innerHTML = recipes.map(buildRecipeCard).join('');
}

function buildRecipeCard(recipe) {
    const compatClass = recipe.compatibility >= 80 ? 'high'
                      : recipe.compatibility >= 50 ? 'medium'
                      : 'low';

    const imageHtml = recipe.image
        ? `<img class="recipe-image" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title)}" loading="lazy"
               onerror="this.parentNode.innerHTML='<div class=\\'recipe-image-placeholder\\'>🍽️</div>'">`
        : `<div class="recipe-image-placeholder">🍽️</div>`;

    const canMakeBadge = recipe.can_make_now
        ? `<span class="badge badge-green">✓ Puoi farlo subito</span>`
        : '';

    const timeBadge = recipe.ready_in_minutes
        ? `<span class="time-badge">⏱ ${recipe.ready_in_minutes} min</span>`
        : '';

    // Lista ingredienti disponibili (max 5)
    const availableHtml = recipe.used_ingredients?.length > 0
        ? `<h4 class="available">✓ Hai già (${recipe.used_ingredients.length})</h4>
           <ul class="ingredient-list">
               ${recipe.used_ingredients.slice(0, 5).map(i =>
                   `<li class="ingredient-tag available" title="${escapeHtml(`${i.amount} ${i.unit}`)}">
                        ${escapeHtml(i.name)}
                    </li>`
               ).join('')}
               ${recipe.used_ingredients.length > 5
                   ? `<li class="ingredient-tag">+${recipe.used_ingredients.length - 5} altri</li>`
                   : ''}
           </ul>`
        : '';

    // Lista ingredienti mancanti (max 4)
    const missingHtml = recipe.missed_ingredients?.length > 0
        ? `<h4 class="missing">✕ Mancano (${recipe.missed_ingredients.length})</h4>
           <ul class="ingredient-list">
               ${recipe.missed_ingredients.slice(0, 4).map(i =>
                   `<li class="ingredient-tag missing" title="${escapeHtml(`${i.amount} ${i.unit}`)}">
                        ${escapeHtml(i.name)}
                    </li>`
               ).join('')}
               ${recipe.missed_ingredients.length > 4
                   ? `<li class="ingredient-tag">+${recipe.missed_ingredients.length - 4} altri</li>`
                   : ''}
           </ul>`
        : '';

    // Niente ingredienti conosciuti: mostra avviso
    const noIngredients = !recipe.used_ingredients?.length && !recipe.missed_ingredients?.length
        ? `<p style="font-size:0.82rem; color:var(--text-muted); padding:0.5rem 0;">
               Ingredienti non disponibili per questa ricetta.
           </p>`
        : '';

    return `
        <div class="recipe-card ${recipe.can_make_now ? 'border-success' : ''}">
            ${imageHtml}
            <div class="recipe-body">
                <div class="recipe-title">${escapeHtml(recipe.title)}</div>
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; flex-wrap:wrap;">
                    ${canMakeBadge}
                    ${timeBadge}
                </div>
                <div class="recipe-compatibility">
                    <div class="compatibility-bar">
                        <div class="compatibility-fill ${compatClass}" style="width:${recipe.compatibility}%"></div>
                    </div>
                    <span class="compatibility-pct">${recipe.compatibility}%</span>
                </div>
                <div class="ingredients-section">
                    ${availableHtml}
                    ${missingHtml}
                    ${noIngredients}
                </div>
            </div>
            <div class="recipe-footer">
                <a href="https://spoonacular.com/recipes/-${recipe.id}"
                   target="_blank" rel="noopener noreferrer"
                   class="btn btn-primary btn-sm">🔗 Ricetta completa</a>
                ${recipe.source_url
                    ? `<a href="${escapeHtml(recipe.source_url)}" target="_blank" rel="noopener noreferrer"
                          class="btn btn-secondary btn-sm">Sorgente</a>`
                    : ''}
            </div>
        </div>`;
}

// ---- Utility ----

function showGridError(gridId, message) {
    const grid = document.getElementById(gridId);
    if (grid) {
        grid.innerHTML = `
            <div class="alert alert-danger" style="grid-column:1/-1;">
                <span class="alert-icon">❌</span>
                <div>${escapeHtml(message)}</div>
            </div>`;
    }
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = '../index.html';
    });
}
