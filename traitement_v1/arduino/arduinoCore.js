// arduinoCore.js


export const database = {
    tables: [],
    pages: [],
    currentPages: {},
    technicalData: null,
    commercialData: null,
    eventMap: new Map(),
    cellStateMap: new Map(),
    clientCreditData: new Map(),
    energyPerClient: {},
    rawTables: []  
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

// ------------------- Lecture fichier (Compatible Electron + Navigateur) -------------------
export async function readFileAsync(file) {
    try {
        // En Electron: utiliser l'API sécurisée
        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.readFile) {
            return await window.electronAPI.readFile(file.path || file);
        }
        
        // En navigateur: FileReader classique
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Erreur de lecture'));
            reader.readAsText(file);
        });
    } catch (error) {
        console.error('❌ Erreur lecture fichier:', error);
        throw new Error(`Impossible de lire le fichier: ${error.message}`);
    }
}

export function extractClientId(fullId, nanoreseau) {
    if (!fullId) return null;
    
    const str = String(fullId);
    const lastChar = str.slice(-1);
    
    // Si c'est un nombre à un chiffre, parfait
    if (!isNaN(parseInt(lastChar))) {
        return parseInt(lastChar, 10);
    }
    
    // Fallback: dernier groupe de chiffres
    const match = str.match(/(\d+)$/);
    if (match) {
        return parseInt(match[1], 10);
    }
    
    return null;
}

// ===========================================
// FONCTION BRIDGE (énergie → commercial)
// ===========================================
export function linkEnergyToCommercial() {
    if (!database.energyData || !database.commercialData?.clients) {
        console.log("⚠️ energyData ou commercialData.clients manquant");
        return false;
    }
    
    let clientsLinked = 0;
    const energyPerClient = database.energyData.parClient || {};
    
    database.commercialData.clients.forEach(client => {
        const numericId = typeof client.id === 'string' ? parseInt(client.id, 10) : client.id;
        const clientEnergy = energyPerClient[numericId] || [];
        
        if (clientEnergy.length > 0) {
            // Grouper par jour
            const parJour = {};
            clientEnergy.forEach(point => {
                if (!parJour[point.date]) {
                    parJour[point.date] = { total: 0, points: [] };
                }
                parJour[point.date].total += point.energie;
                parJour[point.date].points.push(point);
            });
            
            const consommationJournaliere = Object.entries(parJour)
                .map(([date, data]) => ({
                    date,
                    valeur: parseFloat(data.total.toFixed(2)),
                    nbPoints: data.points.length
                }))
                .sort((a, b) => a.date.localeCompare(b.date));
            
            client.consommation = {
                journaliere: consommationJournaliere,
                max: Math.max(...consommationJournaliere.map(c => c.valeur), 0),
                moyenne: consommationJournaliere.length > 0 
                    ? (consommationJournaliere.reduce((s, c) => s + c.valeur, 0) / consommationJournaliere.length).toFixed(2)
                    : 0,
                joursSans: consommationJournaliere.filter(c => c.valeur < 0.1).length
            };
            clientsLinked++;
        } else {
            // Données par défaut si pas d'énergie
            client.consommation = {
                journaliere: [],
                max: 0,
                moyenne: 0,
                joursSans: 0
            };
        }
    });
    
    console.log(`✅ Énergie liée à ${clientsLinked}/${database.commercialData.clients.size} clients`);
    return clientsLinked > 0;
}

