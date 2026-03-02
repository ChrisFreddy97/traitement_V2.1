// arduinoMain.js
import { database, showLoader, hideLoader, simulateProgress, showError, hideError, readFileAsync, linkEnergyToCommercial } from './arduinoCore.js';
import { parseRawTables, buildDatabase } from './arduinoParser.js';
import { analyzeTechnicalData } from './analytics/technicalAnalytics.js';
import { analyzeCommercialData } from './analytics/commercialAnalytics.js';
import { analyzeEnergyData } from './analytics/energyAnalytics.js';
import { buildEventMap } from './analytics/eventAnalytics.js';
import { handleCellClick } from './arduinoEvents.js';
import { renderByTab } from './arduinoRender.js';


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
        // Lecture du fichier
        const content = await readFileAsync(file);

        // Extraction du numéro NANORESEAU
        const nanoreseauMatch = content.match(/<#NANORESEAU:(\d+)>/);
        if (!nanoreseauMatch) {
            showError('Numéro NANORESEAU non trouvé');
            return;
        }
        nanoreseauValue.textContent = nanoreseauMatch[1];

        // Parsing des tables brutes
        const rawTables = parseRawTables(content);
        if (rawTables.length === 0) {
            showError('Aucune donnée valide');
            return;
        }

        // Construction de la base de données
        buildDatabase(rawTables);
        
        // ANALYSES - Dans l'ordre logique et dépendances
        console.log("🚀 Lancement des analyses...");
        
        // 1. Événements (nécessaires pour les autres analyses)
        buildEventMap();
        const eventCount = database.eventMap.size;
        console.log(`✅ Étape 1/5 : ${eventCount} événements chargés`);
        
        // 2. Analyses techniques
        analyzeTechnicalData();
        const hasTechData = database.technicalData && database.technicalData.daysCount > 0;
        console.log(`✅ Étape 2/5 : Analyse technique - ${hasTechData ? database.technicalData.daysCount + ' jours' : 'INCOMPLÈTE'}`);
        
        // 3. Analyses énergie (dépend de T et I)
        analyzeEnergyData();
        const energyClients = Object.keys(database.energyData?.parClient || {}).length;
        console.log(`✅ Étape 3/5 : Analyse énergie - ${energyClients} clients ou 0 si incomplète`);
        
        // 4. Analyses commerciales (dépend des événements et va utiliser énergie)
        analyzeCommercialData();
        const commercialClients = database.commercialData?.clients?.size || 0;
        console.log(`✅ Étape 4/5 : Analyse commerciale - ${commercialClients} clients analysés`);
        
        // 5. CRITICAL: Lier l'énergie aux clients commerciaux
        const energyLinked = linkEnergyToCommercial();
        if (!energyLinked && energyClients > 0) {
            console.warn("⚠️ Attention : données énergétiques perte lors de la liaison");
        } else if (energyClients === 0) {
            console.log("ℹ️ Aucune donnée énergétique à lier (normal si tables T/I manquent)");
        }
        console.log(`✅ Étape 5/5 : Liaison énergie-clients - ${energyLinked ? 'Réussie' : 'N/A'}`);
        
        // Rendu final
        renderByTab();
        
        // Afficher les sections
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