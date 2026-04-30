/**
 * PIANO PASTI E CALENDARIO (meals.js)
 * 
 * Questo file gestisce il calendario dei pasti. Ti permette di pianificare cosa mangiare
 * a colazione, pranzo e cena, e di generare automaticamente la lista della spesa.
 */

// Variabili per gestire il tempo e i dati
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // Il mese corrente (0 per Gennaio, 11 per Dicembre)
let selectedDate = null; // Il giorno che l'utente ha cliccato sul calendario
let mealsMap     = {}; // Una "mappa" che contiene tutti i pasti organizzati per data

/**
 * AVVIO DELLA PAGINA
 */
document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    // Carichiamo i pasti del mese attuale dal server
    await loadMonthMeals();
    // Disegniamo il calendario
    renderCalendar();

    // Di default, selezioniamo il giorno di oggi
    selectDate(formatDateLocal(new Date()));

    // Attiviamo i tasti per cambiare mese (Avanti/Indietro)
    document.getElementById('prev-month').addEventListener('click', async () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        await loadMonthMeals();
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', async () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        await loadMonthMeals();
        renderCalendar();
    });
});

/**
 * CARICAMENTO PASTI DAL SERVER
 * Chiede al database tutti i pasti pianificati tra il primo e l'ultimo giorno del mese.
 */
async function loadMonthMeals() {
    const m     = String(currentMonth + 1).padStart(2, '0');
    const start = `${currentYear}-${m}-01`;
    const last  = new Date(currentYear, currentMonth + 1, 0).getDate();
    const end   = `${currentYear}-${m}-${String(last).padStart(2, '0')}`;

    try {
        const res = await api.get(`/meals/list.php?start=${start}&end=${end}`);
        mealsMap = {}; // Puliamo la mappa vecchia
        if (res.success) {
            // Organizziamo i pasti ricevuti: se per il 10 Maggio ci sono 3 pasti, li mettiamo insieme
            for (const meal of res.meals) {
                if (!mealsMap[meal.date]) mealsMap[meal.date] = [];
                mealsMap[meal.date].push(meal);
            }
        }
    } catch(e) {
        console.error('Errore nel caricamento dei pasti');
    }
}

/**
 * DISEGNO DEL CALENDARIO
 * Crea la griglia dei giorni. Per ogni giorno, controlla se ci sono pasti e aggiunge dei pallini colorati.
 */
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = ''; // Puliamo il calendario vecchio

    // (Logica per calcolare i giorni vuoti all'inizio del mese e i numeri dei giorni...)
    
    // Per ogni giorno del mese:
    // 1. Creiamo il quadratino del giorno
    // 2. Se ci sono pasti (colazione, pranzo o cena), aggiungiamo un pallino colorato:
    //    - Giallo per Colazione
    //    - Verde per Pranzo
    //    - Blu per Cena
}

/**
 * GENERAZIONE LISTA DELLA SPESA
 * Prende le date scelte dall'utente e chiede al server di confrontare i pasti con la dispensa.
 */
async function generateShoppingList() {
    const start = document.getElementById('shop-start').value;
    const end   = document.getElementById('shop-end').value;

    const res = await api.get(`/shopping/generate.php?start=${start}&end=${end}`);
    if (res.success) {
        // Mostriamo all'utente cosa ha già e cosa deve comprare
        renderShoppingResults(res.available, res.missing);
    }
}
