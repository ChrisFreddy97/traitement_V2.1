// results.js - Version complète corrigée avec tableau combiné

// IMPORTS CORRIGÉS
import {
    analyzeEnergy,
    createEnergyAnalysisContent,
    initializeEnergyTabs,
    initializeAlertBadges,
    createDailyChart,
    calculateHourlyConsumption
} from './analyzer/energyAnalyzer.js';

// Import pour le tableau combiné
import {
    createCombinedTable,
    renderCombinedTable,
    updateGlobalSummary,
    loadCombinedTableCSS,
    waitForDataAndCreateCombinedTable
} from './combinedTable.js';

// section d'import pour l'analyse de la tension
import {
    createTensionAnalysisContent,
    initializeTensionTabs,
    initializeTensionAlertBadges,
    createTensionChart,
    initializeTensionCharts
} from './analyzer/tensionAnalyzer.js';

// Import pour l'analyse du crédit
import {
    createCreditAnalysisContent,
    initializeCreditTabs,
    initializeCreditAlertBadges
} from './analyzer/creditAnalyzer.js';

// Import pour l'analyse ENR
import {
    createENRAnalysisContent,
    initializeENRTabs,
    initializeENRAlertBadges
} from './analyzer/enrAnalyzer.js';

// Import pour l'analyse recharge
import {
    createRechargeAnalysisContent,
    initializeRechargeTabs
} from './analyzer/rechargeAnalyzer.js';

// Import pour l'analyse EC
import {
    createECAnalysisContent,
    initializeECTabs,
    initializeECAlertBadges
} from './analyzer/ecAnalyzer.js';

// État de l'application
let currentAnalysisData = null;

// Éléments DOM
let backToManagementBtn, nrDisplay, dateDisplay, tabBtns, tabPanes;
let loadingMessage, tabsContainer, errorContainer;
let tensionContent, enrContent, ecContent, rechargeContent;
let energySubTabs, energySubContent, creditSubTabs, creditSubContent;
let exportPdfBtn, exportDataBtn;

// ==================== INITIALISATION ====================

function initializeDOMElements() {
    console.log('🔍 Initialisation des éléments DOM...');

    backToManagementBtn = document.getElementById('back-to-management-btn');
    nrDisplay = document.getElementById('nr-display');
    dateDisplay = document.getElementById('date-display');
    loadingMessage = document.getElementById('loading-message');
    tabsContainer = document.getElementById('tabs-container');
    errorContainer = document.getElementById('error-container');
    exportPdfBtn = document.getElementById('export-pdf-btn');
    exportDataBtn = document.getElementById('export-data-btn');

    // Conteneurs de contenu principaux
    tensionContent = document.getElementById('tension-content');
    enrContent = document.getElementById('enr-content');
    ecContent = document.getElementById('ec-content');
    rechargeContent = document.getElementById('recharge-content');

    // Sous-onglets Énergie
    energySubTabs = document.getElementById('energy-sub-tabs');
    energySubContent = document.getElementById('energy-sub-content');

    // Sous-onglets Crédit
    creditSubTabs = document.getElementById('credit-sub-tabs');
    creditSubContent = document.getElementById('credit-sub-content');

    // Onglets principaux
    tabBtns = document.querySelectorAll('.tab-btn');
    tabPanes = document.querySelectorAll('.tab-pane');

    console.log('✅ Éléments DOM initialisés');
}

function initializeEventListeners() {
    console.log('🔗 Initialisation des événements...');

    // Bouton retour
    if (backToManagementBtn) {
        backToManagementBtn.addEventListener('click', () => {
            window.location.href = 'files.html';
        });
    }

    // Boutons d'export
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportToPDF);
    }

    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportToCSV);
    }

    // Gestion des onglets principaux
    if (tabBtns.length > 0) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                switchTab(tabId);
            });
        });
    }

    console.log('✅ Événements initialisés');
}

// ==================== GESTION DES DONNÉES ====================

function loadAnalysisData() {
    console.log('🔍 Chargement des données d\'analyse...');

    const urlParams = new URLSearchParams(window.location.search);
    const nr = urlParams.get('nr');

    console.log('📋 NR depuis l\'URL:', nr);

    if (!nr) {
        showError('Numéro de dossier non spécifié dans l\'URL');
        hideLoading();
        return;
    }

    try {
        const data = localStorage.getItem(`analysis_${nr}`);

        if (data) {
            console.log('✅ Données trouvées dans le localStorage');
            currentAnalysisData = JSON.parse(data);
            displayAnalysisData();
        } else {
            console.log('❌ Aucune donnée trouvée pour le NR:', nr);
            showError(`Aucune donnée trouvée pour le dossier ${nr}. Veuillez retourner à la page de gestion et créer un nouveau dossier.`);
        }
    } catch (error) {
        console.error('❌ Erreur lors du chargement des données:', error);
        showError('Erreur lors du chargement des données: ' + error.message);
    }

    hideLoading();
}

function displayAnalysisData() {
    if (!currentAnalysisData) {
        showError('Aucune donnée à afficher');
        return;
    }

    console.log('📊 Affichage des données d\'analyse:', currentAnalysisData);

    // Afficher les informations du dossier
    if (nrDisplay) nrDisplay.textContent = currentAnalysisData.nr;
    if (dateDisplay) dateDisplay.textContent = currentAnalysisData.date;

    // Afficher le contenu
    showContent();
    displayFilesSummary();
    
    // Charger le CSS pour le tableau combiné
    loadCombinedTableCSS();
    
    // Afficher le résumé global
    displayGlobalSummary();
    
    // Afficher le tableau combiné
    displayCombinedTable();
    
    // Charger l'onglet énergie par défaut
    loadTabContent('energy');
}

function displayGlobalSummary() {
    console.log('📋 Affichage du résumé global');
    
    const globalSummaryContainer = document.getElementById('global-summary-container');
    if (!globalSummaryContainer) {
        console.error('❌ Conteneur du résumé global non trouvé');
        return;
    }
    
    // Créer le résumé global
    updateGlobalSummary(currentAnalysisData, 'global-summary-container');
}

function displayCombinedTable() {
    console.log('📊 Affichage du tableau combiné');
    
    // Créer le conteneur pour le tableau combiné
    const tabsContainer = document.getElementById('tabs-container');
    if (!tabsContainer) {
        console.error('❌ Conteneur des onglets non trouvé');
        return;
    }
    
    // Insérer le tableau combiné avant les onglets
    const combinedTableHTML = `
        <div id="combined-table-container" class="combined-table-section">
            <div class="section-header">
                <h3>📊 Vue Combinée Énergie & Tension</h3>
                <p class="section-description">
                    Tableau horaire combinant les données d'énergie client et de tension. 
                    Seuls les clients existants sont affichés.
                </p>
            </div>
            <div id="combined-table-content"></div>
        </div>
    `;
    
    tabsContainer.insertAdjacentHTML('beforebegin', combinedTableHTML);
    
    // Utiliser la fonction qui attend les données
    waitForDataAndCreateCombinedTable(currentAnalysisData, 'combined-table-content');
    
    // Ajouter un style pour la section
    const style = document.createElement('style');
    style.textContent = `
        .combined-table-section {
            background: white;
            border-radius: 10px;
            padding: 25px;
            margin: 20px 0;
            box-shadow: 0 2px 15px rgba(0,0,0,0.08);
        }
        
        .combined-table-section .section-header {
            margin-bottom: 20px;
        }
        
        .combined-table-section h3 {
            color: #2d3748;
            margin: 0 0 10px 0;
            font-size: 20px;
        }
        
        .section-description {
            color: #718096;
            font-size: 14px;
            margin: 0;
            line-height: 1.5;
        }
        
        .tabs-container {
            margin-top: 30px;
        }
    `;
    document.head.appendChild(style);
}

// ==================== GESTION DES ONGLETS ====================

function switchTab(tabId) {
    // Retirer la classe active de tous les boutons et panneaux
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));

    // Ajouter la classe active au bouton et panneau sélectionnés
    const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
    const activePane = document.getElementById(`tab-${tabId}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.classList.add('active');

    // Charger le contenu de l'onglet
    loadTabContent(tabId);
}

function loadTabContent(tabId) {
    if (!currentAnalysisData) return;

    console.log(`📂 Chargement de l'onglet: ${tabId}`);
    const files = currentAnalysisData.files;

    switch (tabId) {
        case 'energy':
            const energyFiles = files.filter(f => f.type === 'énergie');
            console.log(`🔌 ${energyFiles.length} fichier(s) énergie trouvé(s)`);
            createClientSubTabs(energyFiles, 'energy');
            break;
        case 'credit':
            const creditFiles = files.filter(f => f.type === 'crédit');
            console.log(`💳 ${creditFiles.length} fichier(s) crédit trouvé(s)`);
            createClientSubTabs(creditFiles, 'credit');
            break;
        case 'tension':
            const tensionFiles = files.filter(f => f.type === 'tension');
            console.log(`⚡ ${tensionFiles.length} fichier(s) tension trouvé(s)`);
            displayTensionFiles(tensionFiles);
            break;
        case 'enr':
            const enrFiles = files.filter(f => f.type === 'ENR');
            console.log(`🌞 ${enrFiles.length} fichier(s) ENR trouvé(s)`);
            displayEnrFiles(enrFiles);
            break;
        case 'ec':
            const ecFiles = files.filter(f => f.type === 'EC');
            console.log(`🔋 ${ecFiles.length} fichier(s) EC trouvé(s)`);
            displayEcFiles(ecFiles);
            break;
        case 'recharge':
            const rechargeFiles = files.filter(f => f.type === 'recharge');
            console.log(`🔌 ${rechargeFiles.length} fichier(s) recharge trouvé(s)`);
            displayRechargeFiles(rechargeFiles);
            break;
    }
}

// ==================== GESTION DES DONNÉES ÉNERGIE MULTI-CLIENTS ====================

function getHourlyDataForFile(fileId) {
    // Essayer de récupérer depuis energyDataManager d'abord
    if (typeof energyDataManager !== 'undefined' && energyDataManager.getHourlyDataForFile) {
        // Chercher dans tous les clients
        const allClients = energyDataManager.clientData || new Map();
        for (let [clientId, clientMap] of allClients) {
            const data = energyDataManager.getHourlyDataForFile(clientId, fileId);
            if (data) return data;
        }
    }

    // Fallback: chercher dans window.energyResults
    if (window.energyResults && window.energyResults[fileId]) {
        const results = window.energyResults[fileId];
        if (results && results.length > 0) {
            // Calculer les données horaires à partir des résultats bruts
            return calculateHourlyConsumption(results);
        }
    }

    return null;
}

// ==================== CORRECTION DES SOUS-ONGLETS CLIENTS ====================

function createClientSubTabs(files, tabType) {
    console.log(`👥 Création des sous-onglets clients pour ${tabType}`);

    // Grouper les fichiers par client
    const filesByClient = {};
    files.forEach(file => {
        const clientName = file.client || 'Sans_Client';
        if (!filesByClient[clientName]) {
            filesByClient[clientName] = [];
        }
        filesByClient[clientName].push(file);
    });

    const clients = Object.keys(filesByClient);
    console.log(`📋 Clients trouvés pour ${tabType}:`, clients);

    const subTabsHeader = document.getElementById(`${tabType}-sub-tabs`);
    const subTabsContent = document.getElementById(`${tabType}-sub-content`);

    if (!subTabsHeader || !subTabsContent) {
        console.error(`❌ Éléments de sous-onglets non trouvés pour ${tabType}`);
        return;
    }

    // Vider les conteneurs
    subTabsHeader.innerHTML = '';
    subTabsContent.innerHTML = '';

    if (clients.length === 0) {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'sub-tab-pane active';
        contentDiv.id = `${tabType}-no-clients`;
        contentDiv.innerHTML = `
            <div class="no-clients-message">
                <h4>📋 Aucun client spécifique</h4>
                <p>Aucun client n'a été détecté dans les fichiers de type ${tabType}.</p>
            </div>
            ${createFilesContent(files, tabType)}
        `;
        subTabsContent.appendChild(contentDiv);
        return;
    }

    // Créer un sous-onglet pour CHAQUE client
    clients.forEach((client, index) => {
        const isActive = index === 0;
        const clientId = client.replace(/[^a-zA-Z0-9]/g, '_');

        // Bouton de sous-onglet
        const subTabBtn = document.createElement('button');
        subTabBtn.className = `sub-tab-btn ${isActive ? 'active' : ''}`;
        subTabBtn.setAttribute('data-client', clientId);
        subTabBtn.setAttribute('data-tab-type', tabType);
        subTabBtn.innerHTML = `👤 ${client}`;

        subTabBtn.addEventListener('click', function () {
            const allSubTabs = subTabsHeader.querySelectorAll('.sub-tab-btn');
            const allSubPanes = subTabsContent.querySelectorAll('.sub-tab-pane');

            allSubTabs.forEach(tab => tab.classList.remove('active'));
            allSubPanes.forEach(pane => pane.classList.remove('active'));

            this.classList.add('active');
            const subPane = document.getElementById(`${tabType}-client-${clientId}`);
            if (subPane) {
                subPane.classList.add('active');
                console.log(`✅ Onglet client ${clientId} activé`);
            }
        });

        subTabsHeader.appendChild(subTabBtn);

        // Contenu du sous-onglet
        const subTabPane = document.createElement('div');
        subTabPane.className = `sub-tab-pane ${isActive ? 'active' : ''}`;
        subTabPane.id = `${tabType}-client-${clientId}`;

        const clientFiles = filesByClient[client];
        const forfait = clientFiles[0]?.forfait || 'Non spécifié';

        subTabPane.innerHTML = `
            ${createFilesContent(clientFiles, tabType, clientId)}
        `;

        subTabsContent.appendChild(subTabPane);
    });

    console.log(`✅ Sous-onglets créés pour ${clients.length} clients`);
}

function createFilesContent(files, tabType, clientId = 'default') {
    if (files.length === 0) {
        return '<div class="no-data">Aucun fichier trouvé</div>';
    }

    if (tabType === 'credit') {
        console.log(`🎯 Création du contenu crédit pour ${files.length} fichiers`);
        const content = createCreditAnalysisContent(files);

        setTimeout(() => {
            console.log('💰 Initialisation des onglets crédit...');
            initializeCreditTabs();
            initializeCreditAlertBadges();
        }, 500);

        return content;
    }

    if (tabType === 'energy') {
        console.log(`🎯 Création du contenu énergie pour ${files.length} fichiers, client: ${clientId}`);

        const content = createEnergyAnalysisContent(files);

        // Marquer les sections avec l'ID du client
        setTimeout(() => {
            const sections = document.querySelectorAll('.energy-file-section');
            sections.forEach(section => {
                section.dataset.clientId = clientId;
            });
            console.log(`✅ Sections marquées pour client: ${clientId}`);
        }, 50);

        return content;
    }

    const filesHTML = files.map(file => createFileCardHTML(file)).join('');
    return `<div class="file-content">${filesHTML}</div>`;
}

// ==================== AFFICHAGE DES FICHIERS ====================

function displayTensionFiles(files) {
    console.log(`⚡ Affichage ${files.length} fichier(s) tension`);
    if (!tensionContent) return;

    tensionContent.innerHTML = '';

    if (files.length === 0) {
        tensionContent.innerHTML = '<div class="no-data">Aucun fichier tension trouvé</div>';
        return;
    }

    const content = createTensionAnalysisContent(files);
    tensionContent.innerHTML = content;

    // Initialisation avec délai pour permettre le rendu DOM
    setTimeout(() => {
        console.log('⚡ Initialisation des onglets tension...');
        initializeTensionTabs();
        initializeTensionAlertBadges();

        // Initialisation spécifique des graphiques
        if (typeof initializeTensionCharts === 'function') {
            setTimeout(() => {
                initializeTensionCharts();
            }, 1000);
        }
    }, 500);
}

function displayEnrFiles(files) {
    console.log(`🌞 Affichage ${files.length} fichier(s) ENR`);
    if (!enrContent) return;

    enrContent.innerHTML = '';

    if (files.length === 0) {
        enrContent.innerHTML = '<div class="no-data">Aucun fichier ENR trouvé</div>';
        return;
    }

    // Utiliser le système d'onglets similaire aux autres
    const content = createENRAnalysisContent(files);
    enrContent.innerHTML = content;

    // Initialisation avec délai
    setTimeout(() => {
        console.log('🌞 Initialisation des onglets ENR...');
        initializeENRTabs();
        initializeENRAlertBadges();
    }, 500);
}

function displayEcFiles(files) {
    console.log(`🔋 Affichage ${files.length} fichier(s) EC`);
    if (!ecContent) return;

    ecContent.innerHTML = '';

    if (files.length === 0) {
        ecContent.innerHTML = '<div class="no-data">Aucun fichier EC trouvé</div>';
        return;
    }

    const content = createECAnalysisContent(files);
    ecContent.innerHTML = content;

    setTimeout(() => {
        console.log('🔋 Initialisation des onglets EC...');
        initializeECTabs();
        initializeECAlertBadges();
    }, 500);
}

function displayRechargeFiles(files) {
    console.log(`🔌 Affichage ${files.length} fichier(s) recharge`);
    if (!rechargeContent) return;

    rechargeContent.innerHTML = '';

    if (files.length === 0) {
        rechargeContent.innerHTML = '<div class="no-data">Aucun fichier recharge trouvé</div>';
        return;
    }

    const content = createRechargeAnalysisContent(files);
    rechargeContent.innerHTML = content;

    setTimeout(() => {
        console.log('🔌 Initialisation des onglets recharge...');
        initializeRechargeTabs();
    }, 500);
}

function createFileCard(file) {
    const fileCard = document.createElement('div');
    fileCard.className = 'file-detail-card';
    fileCard.innerHTML = createFileCardHTML(file);
    return fileCard;
}

function createFileCardHTML(file) {
    return `
        <div class="file-detail-card">
            <div class="file-detail-header">
                <div class="file-detail-name">${file.name}</div>
                <div class="file-detail-type">${file.type}</div>
            </div>
            <div class="file-detail-info">
                ${file.client ? `<div class="file-detail-client">Client: ${file.client}</div>` : ''}
                ${file.forfait ? `<div class="file-detail-forfait">Forfait: ${file.forfait}</div>` : ''}
                <div class="file-size">Taille: ${formatFileSize(file.content.length)}</div>
            </div>
            <div class="file-detail-content">
                <div class="content-header">
                    <span>Contenu du fichier:</span>
                    <div class="content-controls">
                        <span class="content-length">${file.content.length} caractères</span>
                    </div>
                </div>
                <div class="content-wrapper">
                    <textarea class="file-content-textarea" readonly>${escapeHtml(file.content)}</textarea>
                </div>
            </div>
        </div>
    `;
}

// ==================== FONCTION DE RÉGÉNÉRATION DES DONNÉES ====================

function regenerateEnergyResults() {
    console.log('🔄 Régénération forcée de energyResults...');

    const energyFiles = currentAnalysisData?.files?.filter(f => f.type === 'énergie') || [];
    window.energyResults = {};

    energyFiles.forEach(file => {
        const results = analyzeEnergy(file.content);
        const clientId = file.client ? file.client.replace(/[^a-zA-Z0-9]/g, '_') : 'default';
        const fileKey = `${clientId}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

        window.energyResults[fileKey] = results;
        window.energyResults[file.name.replace(/[^a-zA-Z0-9]/g, '_')] = results;

        console.log(`💾 Stocké: ${fileKey} - ${results.length} enregistrements`);
    });

    console.log('✅ energyResults régénéré:', Object.keys(window.energyResults));
    return window.energyResults;
}

// ==================== UTILITAIRES ====================

function hideLoading() {
    if (loadingMessage) {
        loadingMessage.classList.add('hidden');
    }
}

function showContent() {
    if (tabsContainer) {
        tabsContainer.classList.remove('hidden');
    }
}

function displayFilesSummary() {
    console.log('📋 Résumé des fichiers:');
    const filesByType = {};

    currentAnalysisData.files.forEach(file => {
        if (!filesByType[file.type]) {
            filesByType[file.type] = [];
        }
        filesByType[file.type].push(file);
    });

    Object.keys(filesByType).forEach(type => {
        console.log(`- ${type}: ${filesByType[type].length} fichier(s)`);
    });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' octets';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showError(message) {
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <strong>❌ Erreur:</strong> ${message}
            <br><br>
            <button onclick="window.location.href='files.html'" class="btn btn-primary">
                Retour à la gestion des fichiers
            </button>
        </div>
    `;

    if (errorContainer) {
        errorContainer.appendChild(errorDiv);
    }
}

// ==================== EXPORT ====================

function exportToPDF() {
    console.log('📄 Export PDF en cours...');
    const element = document.querySelector('.results-main');
    const opt = {
        margin: 10,
        filename: `analyse_energie_${currentAnalysisData.nr}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
}

function exportToCSV() {
    console.log('📊 Export CSV en cours...');
    alert('Fonction d\'export CSV à implémenter');
}

// ==================== DEBUG UTILITIES ====================

function debugEnergyResults() {
    console.group('🔍 DEBUG energyResults');

    // S'assurer que energyResults existe
    window.energyResults = window.energyResults || {};

    const keys = Object.keys(window.energyResults);
    console.log(`📊 ${keys.length} clé(s) trouvée(s):`, keys);

    if (keys.length === 0) {
        console.warn('❌ energyResults est vide - régénération des données...');
        regenerateEnergyResults();
    } else {
        keys.forEach(key => {
            const data = window.energyResults[key];
            console.log(`📁 ${key}:`, {
                nbEnregistrements: data?.length || 0,
                premierEnregistrement: data?.[0],
                dates: data ? [...new Set(data.map(d => d.date))].slice(0, 3) : []
            });
        });
    }
    console.groupEnd();
}

function debugEnergyTabs() {
    console.log('🔍 Debug onglets énergie:');
    const tabs = document.querySelectorAll('.energy-tab');
    console.log(`📋 ${tabs.length} onglet(s) énergie trouvé(s)`);
    
    tabs.forEach(tab => {
        console.log(`- ${tab.dataset.tab} : ${tab.classList.contains('active') ? 'ACTIF' : 'inactif'}`);
    });
}

// ==================== INITIALISATION ====================

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Page résultats initialisée');

    initializeDOMElements();
    initializeEventListeners();
    loadAnalysisData();

    // Ajouter un délai supplémentaire pour l'initialisation des graphiques
    setTimeout(() => {
        console.log('🔧 Initialisation différée des graphiques...');
        debugEnergyResults();
    }, 2000);
});

// Exposer les fonctions globales
window.switchTab = switchTab;
window.debugEnergyResults = debugEnergyResults;
window.debugEnergyTabs = debugEnergyTabs;
window.regenerateEnergyResults = regenerateEnergyResults;