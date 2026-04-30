/**
 * MAPPA DEI SUPERMERCATI (supermercati.js)
 * 
 * Questo file gestisce la mappa interattiva che mostra i negozi di alimentari vicini a te.
 * Utilizza la posizione GPS del tuo telefono/computer e un database mondiale di mappe (OpenStreetMap).
 */

let map            = null; // Qui memorizziamo la mappa vera e propria
let userPos        = null; // Qui salviamo le tue coordinate (latitudine e longitudine)
let currentRadius  = 1500; // Il raggio di ricerca predefinito è di 1.5 km

/**
 * AVVIO DELLA PAGINA
 */
document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    // Prepariamo la grafica laterale
    initSidebar();
    initLogout();
    initRadiusButtons(); // Attiviamo i pulsanti per cambiare il raggio (500m, 1km, ecc.)
    
    // Chiediamo al browser: "Dove si trova l'utente in questo momento?"
    requestLocation();
});

/**
 * GEOLOCALIZZAZIONE
 * Chiede il permesso all'utente di accedere alla sua posizione GPS.
 */
function requestLocation() {
    if (!navigator.geolocation) {
        setStatus('❌', 'Il tuo browser non supporta la geolocalizzazione.', 'error');
        return;
    }

    setStatus('⏳', 'Sto cercando la tua posizione…');

    navigator.geolocation.getCurrentPosition(
        onLocationSuccess, // Se l'utente accetta e la posizione viene trovata
        onLocationError,   // Se c'è un errore o l'utente rifiuta
        { timeout: 12000, enableHighAccuracy: false }
    );
}

/**
 * INIZIALIZZAZIONE DELLA MAPPA
 * Una volta trovata la posizione, disegniamo la mappa sullo schermo.
 */
function initLeafletMap() {
    const container = document.getElementById('map-container');
    container.innerHTML = ''; // Puliamo il caricamento

    // Creiamo la mappa centrata sulla tua posizione
    map = L.map('map-container').setView([userPos.lat, userPos.lon], 15);

    // Carichiamo i "pezzi" della mappa (le immagini delle strade)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Mettiamo un pallino verde dove ti trovi tu
    L.marker([userPos.lat, userPos.lon]).addTo(map)
        .bindPopup('<b>📍 Sei qui</b>').openPopup();

    // Iniziamo a cercare i negozi intorno a te
    loadNearbyStores();
}

/**
 * RICERCA NEGOZI (Overpass API)
 * Interroga un servizio esterno per trovare tutti i negozi taggati come "supermercato" o "alimentari".
 */
async function loadNearbyStores() {
    // Questa è una "domanda" tecnica inviata al database delle mappe
    const query = `
        [out:json];
        (
          node["shop"~"supermarket|grocery|food"](around:${currentRadius},${userPos.lat},${userPos.lon});
        );
        out body;
    `.trim();

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
        });

        const data = await response.json();
        // Una volta ricevuti i negozi, li disegniamo sulla mappa e creiamo la lista testuale
        renderStores(data.elements || []);
    } catch (err) {
        showToast('Errore nel trovare i negozi vicini', 'error');
    }
}

/**
 * MOSTRA I NEGOZI
 * Prende l'elenco dei negozi trovati e crea i segnaposti sulla mappa e la lista sotto.
 */
function renderStores(stores) {
    const list = document.getElementById('stores-list');
    list.innerHTML = ''; // Puliamo la lista precedente

    stores.forEach(s => {
        // Per ogni negozio, mettiamo un'icona sulla mappa
        const lat = s.lat || s.center?.lat;
        const lon = s.lon || s.center?.lon;
        
        if (lat && lon) {
            L.marker([lat, lon]).addTo(map)
                .bindPopup(`<b>${s.tags.name || 'Negozio'}</b>`);
            
            // Aggiungiamo il negozio alla lista scritta con un pulsante per aprire Google Maps
            const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
            list.innerHTML += `
                <div class="store-row">
                    <span>🛒 ${s.tags.name || 'Supermercato'}</span>
                    <a href="${gmapsUrl}" target="_blank" class="btn btn-sm">Apri Maps →</a>
                </div>`;
        }
    });
}
