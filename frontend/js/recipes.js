/**
 * GESTIONE DELLE RICETTE (recipes.js)
 * 
 * Questo file gestisce la ricerca delle ricette. È collegato a un database esterno (Spoonacular)
 * che ci permette di trovare piatti deliziosi in base a quello che hai già in dispensa.
 */

// Una piccola memoria temporanea per non dover chiedere al server i dettagli della stessa ricetta più volte
let recipeCache = {}; 

/**
 * AVVIO DELLA PAGINA
 */
document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    // Scriviamo il nome utente e prepariamo i menu
    document.getElementById('sidebar-username').textContent = user.username;
    document.getElementById('sidebar-avatar').textContent   = user.username[0].toUpperCase();

    initSidebar();
    initLogout();
    initTabs(); // Attiviamo i tasti per passare da "Consigliate" a "Cerca"
    initControls();
    initSearchForm();
    
    // Carichiamo subito alcune ricette consigliate basate sulla tua dispensa
    await loadRecipes();
});

/**
 * CARICAMENTO RICETTE CONSIGLIATE
 * Chiede al server: "Cosa posso cucinare con quello che ho in dispensa?"
 */
async function loadRecipes(pantryOnly = false) {
    // Mostriamo un'animazione di caricamento
    showGrid(false);

    try {
        // Chiamiamo il nostro server (che a sua volta chiamerà Spoonacular)
        const params = `?pantry_only=${pantryOnly ? 1 : 0}&number=12`;
        const res    = await api.get('/recipes/suggest.php' + params);

        if (res.success) {
            // Se tutto va bene, disegniamo le ricette sullo schermo
            renderRecipes(res.recipes, 'recipes-grid');
            showStats(res); // Mostriamo quanti ingredienti hai già per queste ricette
        } else {
            showGridError('recipes-grid', res.message || 'Errore nel caricamento');
        }
    } catch {
        showGridError('recipes-grid', 'Errore di connessione al database delle ricette.');
    } finally {
        showGrid(true); // Nascondiamo l'animazione di caricamento
    }
}

/**
 * CREAZIONE DELLA "CARD" DELLA RICETTA
 * Disegna il quadratino con la foto del piatto, il tempo di preparazione e gli ingredienti.
 */
function buildRecipeCard(recipe) {
    // Se hai già molti ingredienti per questa ricetta, la barra di compatibilità sarà verde
    const compatClass = recipe.compatibility >= 80 ? 'high'
                      : recipe.compatibility >= 50 ? 'medium'
                      : 'low';

    // Se hai TUTTI gli ingredienti, mettiamo un bollino verde "Puoi farlo subito"
    const canMakeBadge = recipe.can_make_now
        ? `<span class="badge badge-green">✓ Puoi farlo subito</span>`
        : '';

    return `
        <div class="recipe-card ${recipe.can_make_now ? 'border-success' : ''}">
            <img class="recipe-image" src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title)}">
            <div class="recipe-body">
                <div class="recipe-title">${escapeHtml(recipe.title)}</div>
                <div style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">
                    ${canMakeBadge}
                    <span class="time-badge">⏱ ${recipe.ready_in_minutes} min</span>
                </div>
                
                <!-- Lista ingredienti che hai già -->
                <h4 class="available">✓ Hai già (${recipe.used_ingredients.length})</h4>
                <ul class="ingredient-list">
                    ${recipe.used_ingredients.slice(0, 3).map(i => `<li>${i.name}</li>`).join('')}
                </ul>

                <!-- Lista ingredienti che ti mancano -->
                ${recipe.missed_ingredients.length > 0 ? `
                    <h4 class="missing">✕ Ti mancano (${recipe.missed_ingredients.length})</h4>
                    <ul class="ingredient-list">
                        ${recipe.missed_ingredients.slice(0, 3).map(i => `<li>${i.name}</li>`).join('')}
                    </ul>
                ` : ''}

                <button class="btn btn-primary btn-block" onclick="openRecipeDetails(${recipe.id})">
                    Vedi Ricetta →
                </button>
            </div>
        </div>`;
}

/**
 * RICERCA MANUALE
 * Permette all'utente di cercare una ricetta specifica (es: "Carbonara")
 */
async function handleSearch() {
    const input = document.getElementById('search-query');
    const query = input?.value?.trim();
    
    if (!query) {
        showToast('Scrivi cosa vuoi mangiare!', 'warning');
        return;
    }

    // Chiamiamo l'API di ricerca
    const res = await api.get(`/recipes/search.php?query=${encodeURIComponent(query)}&number=12`);
    if (res.success) {
        renderRecipes(res.recipes, 'search-grid');
    }
}
