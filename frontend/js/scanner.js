/**
 * SCANSIONE E AGGIUNTA PRODOTTI (scanner.js)
 * 
 * Questo file gestisce la fotocamera per scansionare i codici a barre.
 * Se non hai il codice a barre, ti permette anche di cercare un prodotto scrivendo il suo nome.
 */

let html5QrCode   = null; // Il "motore" che gestisce la fotocamera
let isScanning    = false; // Ci dice se la fotocamera è accesa o spenta

/**
 * AVVIO DELLA PAGINA
 */
document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireLogin();
    if (!user) return;

    // Se l'utente è un semplice "membro" del gruppo, non può aggiungere prodotti.
    // Gli mostriamo un messaggio gentile e lo rimandiamo indietro.
    const readOnly = user.active_context?.type === 'group' && user.active_context?.role === 'member';
    if (readOnly) {
        document.querySelector('.page-content').innerHTML = `
            <div class="alert alert-info">
                <strong>Accesso limitato</strong><br>
                Solo gli amministratori del gruppo possono aggiungere nuovi prodotti.
            </div>`;
        return;
    }

    // Attiviamo i tasti per scegliere tra "Scansiona" e "Cerca per nome"
    initScannerTabs();
    initBarcodeScanner();
});

/**
 * ACCENSIONE FOTOCAMERA
 */
async function startScanning() {
    try {
        html5QrCode = new Html5Qrcode('reader'); // Prepariamo il lettore nel quadratino "reader"
        const config = {
            fps: 10, // Controlla il codice 10 volte al secondo
            qrbox: { width: 260, height: 160 } // Il rettangolo dove l'utente deve puntare il codice
        };

        // Accendiamo la fotocamera posteriore (facingMode: environment)
        await html5QrCode.start({ facingMode: 'environment' }, config, onBarcodeDetected);
        isScanning = true;
    } catch {
        showToast('Non riesco ad accedere alla fotocamera. Hai dato il permesso?', 'warning');
    }
}

/**
 * COSA SUCCEDE QUANDO VIENE LETTO UN CODICE
 */
async function onBarcodeDetected(barcode) {
    if (!isScanning) return;
    
    // 1. Spegniamo subito la fotocamera per risparmiare batteria
    await stopScanning();
    
    // 2. Facciamo un suono o una notifica
    showToast(`Codice letto: ${barcode}`, 'info');
    
    // 3. Chiediamo al server: "Che prodotto è questo?"
    await lookupBarcode(barcode);
}

/**
 * RICERCA DEL PRODOTTO
 */
async function lookupBarcode(barcode) {
    try {
        const res = await api.get(`/barcode/lookup.php?barcode=${encodeURIComponent(barcode)}`);

        if (res.success) {
            // Se lo troviamo, mostriamo i dettagli (nome, foto, marca)
            showProductResult(res.product, barcode, 'barcode');
            showToast('Prodotto riconosciuto!', 'success');
        } else {
            // Se non lo troviamo, invitiamo l'utente a cercarlo per nome
            showBarcodeNotFound(barcode);
        }
    } catch {
        showToast('Errore nella ricerca del prodotto', 'error');
    }
}

/**
 * RICERCA PER NOME
 * Se il codice a barre non funziona, l'utente può scrivere "Pasta Barilla"
 */
async function searchByName() {
    const query = document.getElementById('name-search-input')?.value?.trim();
    if (!query) return;

    // Chiediamo a OpenFoodFacts di darci una lista di prodotti che corrispondono al nome
    const res = await api.get(`/barcode/search_by_name.php?name=${encodeURIComponent(query)}`);
    if (res.success && res.products.length > 0) {
        // Mostriamo la lista dei risultati così l'utente può scegliere quello giusto
        renderNameResults(res.products);
    }
}
