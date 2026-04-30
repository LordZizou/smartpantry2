/**
 * LA PAGINA PRINCIPALE (dashboard.js)
 * 
 * Questo file gestisce la "Home" del sito. Qui l'utente vede un riassunto di tutto:
 * quanti prodotti ha, cosa sta per scadere e alcuni consigli su cosa cucinare.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Controlliamo chi è l'utente e diamogli il benvenuto
    const user = await requireLogin();
    if (!user) return;

    // Scriviamo il nome dell'utente e la data di oggi sulla pagina
    document.getElementById('welcome-name').textContent = user.username;
    document.getElementById('dashboard-date').textContent = new Date().toLocaleDateString('it-IT', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // 2. Carichiamo tutte le informazioni contemporaneamente (dispensa, ricette e grafici)
    const [pantryRes] = await Promise.all([
        api.get('/pantry/list.php'),
        loadRecipesPreview(), // Piccola anteprima delle ricette
        loadCharts()          // I grafici colorati
    ]);

    if (pantryRes.success) {
        // Aggiorniamo i numerini magici (totale prodotti, scaduti, ecc.)
        renderStats(pantryRes.stats);
        // Mostriamo le "nuvolette" (chip) con i nomi degli ingredienti che hai
        renderIngredients(pantryRes.items);
        // Mostriamo la lista rossa dei prodotti che stanno per scadere
        renderExpiringList(pantryRes.items);
    }
});

/**
 * I NUMERINI IN ALTO
 */
function renderStats(stats) {
    document.getElementById('stat-total').textContent    = stats.total    ?? 0;
    document.getElementById('stat-expiring').textContent = stats.expiring ?? 0;
    document.getElementById('stat-expired').textContent  = stats.expired  ?? 0;
}

/**
 * LA LISTA DELLE SCADENZE
 * Questa funzione crea una lista dei prodotti più "critici" (quelli già scaduti o quasi).
 */
function renderExpiringList(items) {
    const list = document.getElementById('expiring-list');
    
    // Filtriamo i prodotti: teniamo solo quelli che hanno problemi di scadenza
    const critical = items.filter(i => i.expiry_status === 'expired' || i.expiry_status === 'expiring');

    if (critical.length === 0) {
        list.innerHTML = '<p>Ottimo! Non hai nulla in scadenza.</p>';
        return;
    }

    // Per ogni prodotto critico, creiamo una riga con un'icona di avviso
    list.innerHTML = critical.slice(0, 5).map(item => `
        <div class="expiry-row">
            <span>${item.expiry_status === 'expired' ? '❌' : '⚠️'}</span>
            <div>
                <strong>${item.name}</strong><br>
                <small>Scade il: ${formatDate(item.expiry_date)}</small>
            </div>
        </div>
    `).join('');
}

/**
 * I GRAFICI COLORATI (Chart.js)
 * Questa funzione trasforma i numeri della dispensa in grafici a torta e a barre.
 */
function renderCategoryChart(categories) {
    const canvas = document.getElementById('chart-categories');
    
    // Usiamo una libreria esterna (Chart.js) per disegnare un grafico a "ciambella"
    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: categories.map(c => c.category), // I nomi delle categorie
            datasets: [{
                data: categories.map(c => c.count), // Quanti prodotti ci sono per categoria
                backgroundColor: ['#ffe082', '#a5d6a7', '#f48fb1', '#ffab91'] // Colori pastello
            }]
        }
    });
}
