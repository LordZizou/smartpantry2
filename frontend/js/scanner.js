/**
 * scanner.js — Scanner barcode con fotocamera e lookup OpenFoodFacts
 * Usa la libreria html5-qrcode (caricata dal CDN nell'HTML)
 */

let html5QrCode     = null;  // Istanza scanner
let scannedProduct  = null;  // Prodotto trovato da barcode
let isScanning      = false; // Stato scanner

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
    initScanner();
    initManualInput();
    initAddForm();
});

/** Inizializza lo scanner QR/barcode */
function initScanner() {
    const startBtn = document.getElementById('btn-start-scan');
    const stopBtn  = document.getElementById('btn-stop-scan');

    startBtn?.addEventListener('click', startScanning);
    stopBtn?.addEventListener('click',  stopScanning);
}

/** Avvia la fotocamera e lo scanning */
async function startScanning() {
    const readerEl = document.getElementById('reader');
    if (!readerEl) return;

    setUiState('scanning');

    try {
        html5QrCode = new Html5Qrcode('reader');

        // Configurazione fotocamera — preferisci la fotocamera posteriore
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.7,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
            ]
        };

        await html5QrCode.start(
            { facingMode: 'environment' }, // fotocamera posteriore
            config,
            onBarcodeDetected,
            null // ignora errori di scanning parziali
        );

        isScanning = true;
    } catch (err) {
        console.error('Errore fotocamera:', err);
        showToast('Impossibile accedere alla fotocamera. Usa il barcode manuale.', 'warning');
        setUiState('idle');
    }
}

/** Ferma lo scanner */
async function stopScanning() {
    if (html5QrCode && isScanning) {
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (e) {
            // Ignora errori di stop
        }
        isScanning = false;
    }
    setUiState('idle');
}

/** Callback chiamata quando un barcode è rilevato */
async function onBarcodeDetected(barcode) {
    if (!isScanning) return;

    // Ferma lo scanner immediatamente dopo il rilevamento
    await stopScanning();

    // Feedback visivo
    showToast(`Barcode rilevato: ${barcode}`, 'info');
    await lookupBarcode(barcode);
}

/** Cerca un prodotto per barcode nel backend */
async function lookupBarcode(barcode) {
    if (!barcode?.trim()) return;

    setUiState('loading');
    document.getElementById('result-section').style.display = 'none';

    try {
        const res = await api.get(`/barcode/lookup.php?barcode=${encodeURIComponent(barcode.trim())}`);

        if (res.success) {
            scannedProduct = res.product;
            showProductPreview(res.product, barcode);
            setUiState('found');
            showToast('Prodotto trovato!', 'success');
        } else {
            // Prodotto non trovato — permetti inserimento manuale
            showNotFoundMessage(barcode);
            setUiState('not-found');
            showToast(res.message || 'Prodotto non trovato', 'warning');
        }
    } catch {
        showToast('Errore di connessione', 'error');
        setUiState('idle');
    }
}

/** Mostra l'anteprima del prodotto trovato */
function showProductPreview(product, barcode) {
    const section = document.getElementById('result-section');
    if (!section) return;

    section.style.display = 'block';
    section.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span>📦</span>
                <span class="card-title">Prodotto trovato</span>
            </div>
            <div class="card-body">
                <div class="product-preview">
                    ${product.image_url
                        ? `<img class="product-preview-img" src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" onerror="this.style.display='none'">`
                        : '<div style="width:80px;height:80px;background:var(--primary-bg);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0;">🥫</div>'
                    }
                    <div class="product-preview-info">
                        <h3>${escapeHtml(product.name)}</h3>
                        ${product.brand ? `<div class="brand">${escapeHtml(product.brand)}</div>` : ''}
                        <span class="badge badge-blue">${escapeHtml(barcode)}</span>
                    </div>
                </div>
                ${buildNutritionPreview(product)}
                <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--border);">
                <h4 style="margin-bottom: 1rem;">Aggiungi alla dispensa</h4>
                ${buildAddForm(product, barcode)}
            </div>
        </div>`;

    // Attiva il form di aggiunta
    section.querySelector('#form-scan-add')?.addEventListener('submit', handleScanAdd);
}

/** Costruisce i valori nutrizionali per l'anteprima */
function buildNutritionPreview(product) {
    if (!product.calories_per_100g) return '';
    return `
        <div class="nutrition-grid" style="margin-top: 1rem;">
            <div class="nutrition-item"><div class="nutrition-value">${product.calories_per_100g ?? '—'}</div><div class="nutrition-label">kcal/100g</div></div>
            <div class="nutrition-item"><div class="nutrition-value">${product.proteins_per_100g ?? '—'}</div><div class="nutrition-label">Proteine</div></div>
            <div class="nutrition-item"><div class="nutrition-value">${product.carbs_per_100g ?? '—'}</div><div class="nutrition-label">Carboidrati</div></div>
            <div class="nutrition-item"><div class="nutrition-value">${product.fats_per_100g ?? '—'}</div><div class="nutrition-label">Grassi</div></div>
        </div>`;
}

/** Costruisce il form rapido di aggiunta alla dispensa */
function buildAddForm(product, barcode) {
    return `
        <form id="form-scan-add">
            <input type="hidden" id="scan-barcode" value="${escapeHtml(barcode)}">
            <input type="hidden" id="scan-name" value="${escapeHtml(product.name)}">
            <input type="hidden" id="scan-brand" value="${escapeHtml(product.brand ?? '')}">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="scan-quantity">Quantità</label>
                    <input class="form-control" type="number" id="scan-quantity" value="1" min="0.1" step="0.1" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="scan-unit">Unità</label>
                    <select class="form-control" id="scan-unit">
                        <option value="pz">pezzi</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="l">l</option>
                        <option value="conf">conf.</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="scan-expiry">Data scadenza</label>
                <input class="form-control" type="date" id="scan-expiry">
            </div>
            <div class="form-group">
                <label class="form-label" for="scan-location">Posizione</label>
                <select class="form-control" id="scan-location">
                    <option value="">-- seleziona --</option>
                    <option value="dispensa">Dispensa</option>
                    <option value="frigo">Frigo</option>
                    <option value="freezer">Freezer</option>
                    <option value="cantina">Cantina</option>
                </select>
            </div>
            <div style="display:flex; gap: 0.75rem;">
                <button type="submit" class="btn btn-primary">✓ Aggiungi alla dispensa</button>
                <button type="button" class="btn btn-secondary" onclick="resetScanner()">✕ Annulla</button>
            </div>
        </form>`;
}

/** Gestisce l'invio del form di aggiunta dopo la scansione */
async function handleScanAdd(e) {
    e.preventDefault();
    const form = e.target;

    const data = {
        name:        form.querySelector('#scan-name').value,
        brand:       form.querySelector('#scan-brand').value    || null,
        barcode:     form.querySelector('#scan-barcode').value,
        quantity:    parseFloat(form.querySelector('#scan-quantity').value) || 1,
        unit:        form.querySelector('#scan-unit').value     || 'pz',
        expiry_date: form.querySelector('#scan-expiry').value   || null,
        location:    form.querySelector('#scan-location').value || null,
    };

    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Aggiungendo...'; }

    try {
        const res = await api.post('/pantry/add.php', data);
        if (res.success) {
            showToast('Prodotto aggiunto alla dispensa!', 'success');
            resetScanner();
        } else {
            showToast(res.message || 'Errore', 'error');
            if (btn) { btn.disabled = false; btn.textContent = '✓ Aggiungi alla dispensa'; }
        }
    } catch {
        showToast('Errore di connessione', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '✓ Aggiungi alla dispensa'; }
    }
}

/** Mostra il messaggio prodotto non trovato con form manuale */
function showNotFoundMessage(barcode) {
    const section = document.getElementById('result-section');
    if (!section) return;

    section.style.display = 'block';
    section.innerHTML = `
        <div class="alert alert-warning">
            <span class="alert-icon">⚠️</span>
            <div>
                <strong>Prodotto non trovato</strong> per il barcode <code>${escapeHtml(barcode)}</code>.
                Inserisci i dati manualmente.
            </div>
        </div>
        <div class="card">
            <div class="card-header"><span class="card-title">Inserimento manuale</span></div>
            <div class="card-body">
                ${buildAddForm({ name: '', brand: '' }, barcode)}
            </div>
        </div>`;

    // Rendi modificabile il campo nome nel form
    section.querySelector('#scan-name')?.removeAttribute('type');
    section.querySelector('#form-scan-add')?.addEventListener('submit', handleScanAdd);
}

/** Inizializza il campo di input manuale del barcode */
function initManualInput() {
    const form = document.getElementById('form-manual-barcode');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const barcode = document.getElementById('manual-barcode')?.value?.trim();
        if (barcode) await lookupBarcode(barcode);
    });
}

/** Resetta lo scanner alla schermata iniziale */
function resetScanner() {
    scannedProduct = null;
    const section = document.getElementById('result-section');
    if (section) section.style.display = 'none';
    const manualInput = document.getElementById('manual-barcode');
    if (manualInput) manualInput.value = '';
    setUiState('idle');
}

/** Aggiorna la UI in base allo stato corrente */
function setUiState(state) {
    const startBtn  = document.getElementById('btn-start-scan');
    const stopBtn   = document.getElementById('btn-stop-scan');
    const statusEl  = document.getElementById('scan-status');
    const loadingEl = document.getElementById('scan-loading');

    // Nasconde tutto per default
    if (stopBtn)  stopBtn.style.display  = 'none';
    if (loadingEl) loadingEl.style.display = 'none';

    switch (state) {
        case 'scanning':
            if (startBtn)  startBtn.style.display  = 'none';
            if (stopBtn)   stopBtn.style.display    = 'inline-flex';
            if (statusEl)  statusEl.textContent     = '🎥 Punta la fotocamera sul barcode…';
            break;
        case 'loading':
            if (startBtn)  startBtn.style.display   = 'none';
            if (loadingEl) loadingEl.style.display  = 'flex';
            if (statusEl)  statusEl.textContent     = '🔍 Ricerca prodotto in corso…';
            break;
        case 'found':
        case 'not-found':
            if (startBtn)  startBtn.style.display   = 'inline-flex';
            if (statusEl)  statusEl.textContent     = '';
            break;
        default: // idle
            if (startBtn)  startBtn.style.display   = 'inline-flex';
            if (statusEl)  statusEl.textContent     = '';
    }
}

function initAddForm() { /* placeholder */ }

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = '../index.html';
    });
}
