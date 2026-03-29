/**
 * recipes.js — Pagina suggerimenti ricette (Spoonacular)
 */

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
    initControls();
    await loadRecipes();
});

/** Carica le ricette suggerite dal backend */
async function loadRecipes(pantryOnly = false) {
    showLoading(true);
    document.getElementById('recipes-grid').innerHTML = '';
    document.getElementById('recipes-stats').style.display = 'none';

    try {
        const params = `?pantry_only=${pantryOnly ? 1 : 0}&number=12`;
        const res    = await api.get('/recipes/suggest.php' + params);

        if (res.success) {
            renderRecipes(res.recipes, res.pantry_items);
            showStats(res);
        } else {
            showError(res.message || 'Errore nel caricamento ricette');
        }
    } catch (err) {
        showError('Errore di connessione. Controlla che il server sia attivo.');
    } finally {
        showLoading(false);
    }
}

/** Renderizza la griglia di ricette */
function renderRecipes(recipes, pantryItems) {
    const grid = document.getElementById('recipes-grid');
    if (!grid) return;

    if (!recipes || recipes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1">
                <div class="empty-icon">🍽️</div>
                <h3>Nessuna ricetta trovata</h3>
                <p>Aggiungi più prodotti alla dispensa per ricevere suggerimenti!</p>
                <a href="pantry.html" class="btn btn-primary">Vai alla dispensa</a>
            </div>`;
        return;
    }

    grid.innerHTML = recipes.map(buildRecipeCard).join('');
}

/** Costruisce l'HTML di una card ricetta */
function buildRecipeCard(recipe) {
    const compatClass = recipe.compatibility >= 80 ? 'high'
                      : recipe.compatibility >= 50 ? 'medium'
                      : 'low';

    const imageHtml = recipe.image
        ? `<img class="recipe-image" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title)}" loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\'recipe-image-placeholder\\'>🍽️</div>'">`
        : `<div class="recipe-image-placeholder">🍽️</div>`;

    const canMakeBadge = recipe.can_make_now
        ? `<span class="badge badge-green">✓ Puoi farlo subito</span>`
        : '';

    // Lista ingredienti disponibili
    const availableHtml = recipe.used_ingredients.length > 0
        ? `<h4 class="available">✓ Hai già (${recipe.used_ingredients.length})</h4>
           <ul class="ingredient-list">
               ${recipe.used_ingredients.slice(0, 5).map(i =>
                   `<li class="ingredient-tag available">${escapeHtml(i.name)}</li>`
               ).join('')}
               ${recipe.used_ingredients.length > 5 ? `<li class="ingredient-tag">+${recipe.used_ingredients.length - 5}</li>` : ''}
           </ul>`
        : '';

    // Lista ingredienti mancanti
    const missingHtml = recipe.missed_ingredients.length > 0
        ? `<h4 class="missing">✕ Mancano (${recipe.missed_ingredients.length})</h4>
           <ul class="ingredient-list">
               ${recipe.missed_ingredients.slice(0, 4).map(i =>
                   `<li class="ingredient-tag missing">${escapeHtml(i.name)}</li>`
               ).join('')}
               ${recipe.missed_ingredients.length > 4 ? `<li class="ingredient-tag">+${recipe.missed_ingredients.length - 4}</li>` : ''}
           </ul>`
        : '';

    return `
        <div class="recipe-card ${recipe.can_make_now ? 'border-success' : ''}">
            ${imageHtml}
            <div class="recipe-body">
                <div class="recipe-title">${escapeHtml(recipe.title)}</div>
                <div style="margin-bottom: 0.5rem;">${canMakeBadge}</div>
                <div class="recipe-compatibility">
                    <div class="compatibility-bar">
                        <div class="compatibility-fill ${compatClass}" style="width: ${recipe.compatibility}%"></div>
                    </div>
                    <span class="compatibility-pct">${recipe.compatibility}%</span>
                </div>
                <div class="ingredients-section">
                    ${availableHtml}
                    ${missingHtml}
                </div>
            </div>
            <div class="recipe-footer">
                <a href="https://spoonacular.com/recipes/-${recipe.id}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="btn btn-primary btn-sm">🔗 Ricetta completa</a>
            </div>
        </div>`;
}

/** Mostra le statistiche sui risultati */
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
                <div class="stat-label">Ingredienti in dispensa</div>
            </div>
        </div>`;
}

/** Mostra un messaggio di errore */
function showError(message) {
    const grid = document.getElementById('recipes-grid');
    if (grid) {
        grid.innerHTML = `
            <div class="alert alert-danger" style="grid-column: 1/-1">
                <span class="alert-icon">❌</span>
                <div>${escapeHtml(message)}</div>
            </div>`;
    }
}

/** Mostra/nasconde il loader */
function showLoading(visible) {
    const loader = document.getElementById('recipes-loader');
    const grid   = document.getElementById('recipes-grid');
    if (loader) loader.style.display = visible ? 'flex' : 'none';
    if (grid)   grid.style.display   = visible ? 'none' : 'grid';
}

/** Inizializza i controlli (toggle solo dispensa, reload) */
function initControls() {
    const toggle = document.getElementById('toggle-pantry-only');
    toggle?.addEventListener('change', () => {
        loadRecipes(toggle.checked);
    });

    document.getElementById('btn-reload')?.addEventListener('click', () => {
        const toggle = document.getElementById('toggle-pantry-only');
        loadRecipes(toggle?.checked ?? false);
    });
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = '../index.html';
    });
}
