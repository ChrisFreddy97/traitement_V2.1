// arduinoMain.js
import { database, showLoader, hideLoader, simulateProgress, showError, hideError, readFileAsync, linkEnergyToCommercial } from './arduinoCore.js';
import { parseRawTables, buildDatabase } from './arduinoParser.js';
import { analyzeTechnicalData } from './analytics/technicalAnalytics.js';
import { analyzeCommercialData } from './analytics/commercialAnalytics.js';
import { analyzeEnergyData } from './analytics/energyAnalytics.js';
import { buildEventMap } from './analytics/eventAnalytics.js';
import { handleCellClick } from './arduinoEvents.js';
import { renderByTab } from './arduinoRender.js';



// ===========================================
// VARIABLE GLOBALE
// ===========================================
let currentFilter = {
    period: 'all',
    startDate: null,
    endDate: null,
    month: null,
    year: null
};

// ============================================
// DÉTECTION PLATEFORME
// ============================================

function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();      // Info navigateur
    const width = window.innerWidth;                    // Largeur écran
    
    // 1. Electron (logiciel desktop)
    if (ua.includes('electron')) {
        return 'electron';
    }
    
    // 2. Mobile (téléphone)
    if (width <= 768 || 'ontouchstart' in window) {
        return 'mobile';
    }
    
    // 3. Tablette
    if (width <= 1024) {
        return 'tablet';
    }
    
    // 4. Web (desktop par défaut)
    return 'web';
}

// Appliquer la classe détectée
document.documentElement.classList.add(detectPlatform());

// Mettre à jour si la fenêtre change de taille
window.addEventListener('resize', () => {
    // Enlever les anciennes classes
    document.documentElement.classList.remove('electron', 'mobile', 'tablet', 'web');
    // Ajouter la nouvelle
    document.documentElement.classList.add(detectPlatform());
});


// Rendre handleCellClick accessible globalement
window.handleCellClick = handleCellClick;

// ===========================================
// INITIALISATION ELECTRON & NAVIGATION
// ===========================================

// Gestion du bouton de retour (compatible Electron)
function initializeBackButton() {
    const backButton = document.getElementById('backButton');
    if (!backButton) return;

    backButton.addEventListener('click', () => {
        // Electron: utiliser l'API sécurisée
        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.goBack) {
            window.electronAPI.goBack();
        } else {
            // Fallback navigateur
            window.history.back();
        }
    });
}

// Initialiser au chargement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBackButton);
} else {
    initializeBackButton();
}

// ===========================================
// INITIALISATION
// ===========================================

const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const fileName = document.getElementById('fileName');
const nanoreseauValue = document.getElementById('nanoreseauValue');

// ===========================================
// GESTIONNAIRE PRINCIPAL D'IMPORT
// ===========================================

async function handleFileSelect() {
    const file = fileInput.files[0];
    if (!file) return;

    fileName.textContent = `📄 ${file.name}`;
    showLoader();
    simulateProgress();

    try {
        const content = await readFileAsync(file);

        const nanoreseauMatch = content.match(/<#NANORESEAU:(\d+)>/);
        if (!nanoreseauMatch) {
            showError('Numéro NANORESEAU non trouvé');
            return;
        }
        nanoreseauValue.textContent = nanoreseauMatch[1];

        // 1. Parser les tables brutes
        const rawTables = parseRawTables(content);
        
        // 2. STOCKER LES TABLES BRUTES
        database.rawTables = JSON.parse(JSON.stringify(rawTables)); // Copie profonde
        
        // 3. Appliquer le filtre par défaut
        const tablesToUse = filterTablesByDate(rawTables, currentFilter);
        
        // 4. Build database avec les tables filtrées
        buildDatabase(tablesToUse);
        
        // 5. Analyses
        console.log("🚀 Lancement des analyses...");
        
        buildEventMap();
        const eventCount = database.eventMap.size;
        console.log(`✅ Étape 1/5 : ${eventCount} événements chargés`);
        
        analyzeTechnicalData();
        const hasTechData = database.technicalData && database.technicalData.daysCount > 0;
        console.log(`✅ Étape 2/5 : Analyse technique - ${hasTechData ? database.technicalData.daysCount + ' jours' : 'INCOMPLÈTE'}`);
        
        analyzeEnergyData();
        const energyClients = Object.keys(database.energyData?.parClient || {}).length;
        console.log(`✅ Étape 3/5 : Analyse énergie - ${energyClients} clients ou 0 si incomplète`);
        
        analyzeCommercialData();
        const commercialClients = database.commercialData?.clients?.size || 0;
        console.log(`✅ Étape 4/5 : Analyse commerciale - ${commercialClients} clients analysés`);
        
        const energyLinked = linkEnergyToCommercial();
        if (!energyLinked && energyClients > 0) {
            console.warn("⚠️ Attention : données énergétiques perte lors de la liaison");
        } else if (energyClients === 0) {
            console.log("ℹ️ Aucune donnée énergétique à lier (normal si tables T/I manquent)");
        }
        console.log(`✅ Étape 5/5 : Liaison énergie-clients - ${energyLinked ? 'Réussie' : 'N/A'}`);
        
        renderByTab();
        
        document.getElementById('infoSection').classList.add('show');
        hideError();
        
        console.log("✅ ==========================================");
        console.log("✅ TOUTES LES ANALYSES TERMINÉES AVEC SUCCÈS");
        console.log("✅ ==========================================");

    } catch (err) {
        showError('Erreur lors de l\'analyse: ' + err.message);
        console.error(err);
    } finally {
        hideLoader();
    }
}
// ===========================================
// ÉVÉNEMENTS D'IMPORT
// ===========================================

fileInput.addEventListener('change', handleFileSelect);

// Drag & Drop
uploadSection.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadSection.classList.add('dragover');
});

uploadSection.addEventListener('dragleave', () => {
    uploadSection.classList.remove('dragover');
});

uploadSection.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadSection.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFileSelect();
    }
});

// ===========================================
// GESTION DES ONGLETS
// ===========================================

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Mise à jour des onglets actifs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Rendu selon l'onglet sélectionné
        renderByTab();
        
        // Scroll vers les tableaux
        document.getElementById('tablesContainer').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    });
});

// ===========================================
// HELPER POUR RE-RENDU (utilisé par la pagination)
// ===========================================

window.refreshCurrentTab = function() {
    renderByTab();
};

console.log("✅ ArduinoMain initialisé - Prêt pour l'import");

// ===========================================
// FONCTION DE FILTRAGE CORRIGÉE (avec dates basées sur les données)
// ===========================================
export function applyFilter(newFilter) {
    // ===== 1. CRÉER UNE COPIE DU FILTRE =====
    let filterToApply = { ...newFilter };
    
    // ===== 2. RÉCUPÉRER LES DATES DISPONIBLES =====
    let lastAvailableDate = new Date();
    
    if (database.technicalData?.dailyStats) {
        const availableDates = Object.keys(database.technicalData.dailyStats).sort();
        if (availableDates.length > 0) {
            lastAvailableDate = new Date(availableDates[availableDates.length - 1]);
            console.log(`📅 Dernière date disponible: ${lastAvailableDate.toLocaleDateString()}`);
        }
    }
    
    // ===== 3. TRADUIRE LA PÉRIODE EN DATES (basées sur la dernière date dispo) =====
    if (filterToApply.period && filterToApply.period !== 'all') {
        const endDate = new Date(lastAvailableDate); // Fin = dernière date dispo
        const startDate = new Date(lastAvailableDate);
        
        switch(filterToApply.period) {
            case '7days':
                startDate.setDate(lastAvailableDate.getDate() - 7);
                break;
            case '15days':
                startDate.setDate(lastAvailableDate.getDate() - 15);
                break;
            case '30days':
                startDate.setDate(lastAvailableDate.getDate() - 30);
                break;
            case '2months':
                startDate.setMonth(lastAvailableDate.getMonth() - 2);
                break;
            case '3months':
                startDate.setMonth(lastAvailableDate.getMonth() - 3);
                break;
            case '6months':
                startDate.setMonth(lastAvailableDate.getMonth() - 6);
                break;
            case '1year':
                startDate.setFullYear(lastAvailableDate.getFullYear() - 1);
                break;
        }
        
        // Remplacer period par de vraies dates
        filterToApply = {
            period: null,
            startDate: startDate,
            endDate: endDate,
            month: null,
            year: null
        };
        
        console.log(`📅 Période "${newFilter.period}" traduite en dates:`, 
                    startDate.toLocaleDateString(), '→', endDate.toLocaleDateString());
    }
    
    // ===== 4. APPLIQUER LE FILTRE =====
    if (!database.rawTables || database.rawTables.length === 0) {
        console.warn("Pas de données brutes disponibles");
        return;
    }
    
    showLoader();
    
    setTimeout(() => {
        // Filtrer les tables brutes
        const filteredTables = filterTablesByDate(database.rawTables, filterToApply);
        
        // Reconstruire la database avec les tables filtrées
        buildDatabase(filteredTables);
        
        // Relancer les analyses
        buildEventMap();
        analyzeTechnicalData();
        analyzeEnergyData();
        analyzeCommercialData();
        linkEnergyToCommercial();
        
        // Re-rendre
        renderByTab();
        
        hideLoader();
    }, 50);
}

// ===========================================
// FONCTION DE FILTRAGE PAR DATE (inchangée)
// ===========================================
function filterTablesByDate(tables, filter) {
    // Si pas de filtre actif, retourner toutes les tables
    if (!filter.startDate && !filter.endDate && !filter.month && !filter.year) {
        return tables;
    }
    
    // Créer une copie profonde des tables
    const filteredTables = JSON.parse(JSON.stringify(tables));
    
    // Filtrer chaque table
    filteredTables.forEach(table => {
        if (table.type === 'T' || table.type === 'I') {
            table.data = table.data.filter(row => {
                const cells = row.split(';');
                const timestamp = cells[1];
                if (!timestamp) return false;
                
                // Extraire la date (sans l'heure) - COMME DANS analyzeTensionData
                const dateStr = timestamp.split(' ')[0];
                const rowDate = new Date(dateStr);
                rowDate.setHours(0, 0, 0, 0);
                
                // Appliquer les filtres
                if (filter.startDate) {
                    const start = new Date(filter.startDate);
                    start.setHours(0, 0, 0, 0);
                    if (rowDate < start) return false;
                }
                
                if (filter.endDate) {
                    const end = new Date(filter.endDate);
                    end.setHours(0, 0, 0, 0);
                    if (rowDate > end) return false;
                }
                
                if (filter.month && filter.year) {
                    if (rowDate.getMonth() + 1 !== filter.month || 
                        rowDate.getFullYear() !== filter.year) return false;
                } else if (filter.year && !filter.month) {
                    if (rowDate.getFullYear() !== filter.year) return false;
                }
                
                return true;
            });
        }
    });
    
    return filteredTables;
}