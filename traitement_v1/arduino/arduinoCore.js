// arduinoCore.js
export const database = {
    tables: [],
    pages: [],
    currentPages: {},
    technicalData: null,
    commercialData: null,
    eventMap: new Map(),
    cellStateMap: new Map(),
    clientCreditData: new Map()
};

// ------------------- Gestion du loader -------------------
export function showLoader() {
    const loader = document.getElementById('loaderContainer');
    const upload = document.querySelector('.upload-section');
    if (loader) loader.classList.add('show');
    if (upload) {
        upload.style.opacity = '0.5';
        upload.style.pointerEvents = 'none';
    }
}

export function hideLoader() {
    const loader = document.getElementById('loaderContainer');
    const upload = document.querySelector('.upload-section');
    const progress = document.getElementById('progressFill');
    if (loader) loader.classList.remove('show');
    if (upload) {
        upload.style.opacity = '1';
        upload.style.pointerEvents = 'auto';
    }
    if (progress) progress.style.width = '0%';
}

export function simulateProgress() {
    let progress = 0;
    const progressFill = document.getElementById('progressFill');
    const loaderText = document.getElementById('loaderText');
    if (!progressFill || !loaderText) return;
    const interval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 10 + 5;
            progressFill.style.width = Math.min(progress, 90) + '%';
            if (progress < 50) loaderText.textContent = 'Lecture du fichier...';
            else if (progress < 80) loaderText.textContent = 'Analyse des données...';
            else loaderText.textContent = 'Création des pages...';
        }
    }, 200);
    setTimeout(() => {
        clearInterval(interval);
        progressFill.style.width = '100%';
        loaderText.textContent = 'Terminé !';
    }, 1500);
}

// ------------------- Gestion des erreurs -------------------
export function showError(msg) {
    const errorEl = document.getElementById('errorMessage');
    const infoEl = document.getElementById('infoSection');
    const tablesEl = document.getElementById('tablesContainer');
    if (errorEl) {
        errorEl.textContent = '⚠️ ' + msg;
        errorEl.classList.add('show');
    }
    if (infoEl) infoEl.classList.remove('show');
    if (tablesEl) tablesEl.classList.remove('show');
}

export function hideError() {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) errorEl.classList.remove('show');
}

// ------------------- Lecture fichier -------------------
export function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Erreur de lecture'));
        reader.readAsText(file);
    });
}