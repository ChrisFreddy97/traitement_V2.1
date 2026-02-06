// congel.js - Gestion des relevés congélateur avec système d'analyse

// Variables globales pour l'analyse
let currentReleve = null;
let parsedData = [];
let filteredData = [];
let originalData = [];
let currentPage = 1;
const rowsPerPage = 15;
let sortColumn = null;
let sortDirection = 'asc';
let currentChart = null;

// Stockage des relevés
let releves = JSON.parse(localStorage.getItem('congelReleves')) || [];

// Éléments DOM
const uploadForm = document.getElementById('upload-form');
const nrNumberInput = document.getElementById('nr-number');
const forfaitTypeSelect = document.getElementById('forfait-type');
const releveFileInput = document.getElementById('releve-file');
const fileNameSpan = document.getElementById('file-name');
const browseBtn = document.getElementById('browse-btn');
const relevesList = document.getElementById('releves-list');
const noRelevesMessage = document.getElementById('no-releves-message');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const logoutBtn = document.getElementById('logout-btn');
const userDisplay = document.getElementById('user-id-display');

// Éléments du modal
const detailsModal = document.getElementById('details-modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const downloadBtn = document.getElementById('download-btn');

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    displayCurrentUser();
    updateRelevesList();
    
    releveFileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            fileNameSpan.textContent = this.files[0].name;
        } else {
            fileNameSpan.textContent = 'Sélectionner un fichier';
        }
    });
    
    browseBtn.addEventListener('click', function() {
        releveFileInput.click();
    });
    
    uploadForm.addEventListener('submit', handleFormSubmit);
    
    searchInput.addEventListener('input', updateRelevesList);
    clearSearchBtn.addEventListener('click', function() {
        searchInput.value = '';
        updateRelevesList();
    });
    
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });
    
    detailsModal.addEventListener('click', function(e) {
        if (e.target === detailsModal) {
            closeModal();
        }
    });
    
    downloadBtn.addEventListener('click', function() {
        if (currentReleve) {
            downloadReleve(currentReleve.id);
        }
    });
});

// Afficher l'utilisateur connecté
function displayCurrentUser() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && userDisplay) {
        userDisplay.textContent = `Connecté en tant que : ${currentUser.username} (${getRoleLabel(currentUser.role)})`;
    }
}

function getRoleLabel(role) {
    switch(role) {
        case 'admin': return 'Administrateur';
        case 'user': return 'Utilisateur';
        case 'viewer': return 'Observateur';
        default: return role;
    }
}

// Gérer la soumission du formulaire
function handleFormSubmit(e) {
    e.preventDefault();
    
    const nrNumber = nrNumberInput.value.trim();
    const forfaitType = forfaitTypeSelect.value;
    const file = releveFileInput.files[0];
    
    if (!nrNumber) {
        alert('Veuillez saisir un numéro NR');
        return;
    }
    
    if (!forfaitType) {
        alert('Veuillez sélectionner un type de forfait');
        return;
    }
    
    if (!file) {
        alert('Veuillez sélectionner un fichier de relevé');
        return;
    }
    
    if (!file.name.toLowerCase().endsWith('.txt')) {
        alert('Veuillez sélectionner un fichier .txt');
        return;
    }
    
    const newReleve = {
        id: generateId(),
        nrNumber: nrNumber,
        forfaitType: forfaitType,
        fileName: file.name,
        fileSize: file.size,
        dateAdded: new Date().toISOString(),
        status: 'Analysé',
        data: null
    };
    
    const reader = new FileReader();
    reader.onload = function(e) {
        newReleve.data = e.target.result;
        
        releves.unshift(newReleve);
        localStorage.setItem('congelReleves', JSON.stringify(releves));
        
        updateRelevesList();
        uploadForm.reset();
        fileNameSpan.textContent = 'Sélectionner un fichier';
        
        alert('Relevé ajouté avec succès!');
    };
    reader.readAsText(file);
}

function generateId() {
    return 'rel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Mettre à jour la liste des relevés
function updateRelevesList() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    let filteredReleves = releves;
    if (searchTerm) {
        filteredReleves = releves.filter(releve => 
            releve.nrNumber.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filteredReleves.length === 0) {
        relevesList.innerHTML = '';
        noRelevesMessage.classList.remove('hidden');
    } else {
        noRelevesMessage.classList.add('hidden');
        
        relevesList.innerHTML = filteredReleves.map(releve => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${releve.nrNumber}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${releve.forfaitType}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(releve.dateAdded)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        ${releve.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="viewReleveDetails('${releve.id}')" class="text-blue-600 hover:text-blue-900 mr-3">Voir</button>
                    <button onclick="deleteReleve('${releve.id}')" class="text-red-600 hover:text-red-900">Supprimer</button>
                </td>
            </tr>
        `).join('');
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Afficher les détails d'un relevé dans le modal avec analyse
function viewReleveDetails(id) {
    const releve = releves.find(r => r.id === id);
    if (!releve) return;
    
    currentReleve = releve;
    
    modalTitle.textContent = `Détails du relevé ${releve.nrNumber}`; 
    
    modalContent.innerHTML = `
        <div class="space-y-6">
            <!-- Informations générales -->
            <div>
                <h4 class="font-bold text-lg mb-3 text-gray-800">Informations générales</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <div class="flex justify-between border-b pb-1">
                            <span class="font-medium text-gray-700">NR:</span>
                            <span class="text-gray-900">${releve.nrNumber}</span>
                        </div>
                        <div class="flex justify-between border-b pb-1">
                            <span class="font-medium text-gray-700">Type de forfait:</span>
                            <span class="text-gray-900">${releve.forfaitType}</span>
                        </div>
                        <div class="flex justify-between border-b pb-1">
                            <span class="font-medium text-gray-700">Date d'ajout:</span>
                            <span class="text-gray-900">${formatDate(releve.dateAdded)}</span>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex justify-between border-b pb-1">
                            <span class="font-medium text-gray-700">Fichier:</span>
                            <span class="text-gray-900">${releve.fileName}</span>
                        </div>
                        <div class="flex justify-between border-b pb-1">
                            <span class="font-medium text-gray-700">Taille:</span>
                            <span class="text-gray-900">${formatFileSize(releve.fileSize)}</span>
                        </div>
                        <div class="flex justify-between border-b pb-1">
                            <span class="font-medium text-gray-700">Statut:</span>
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">${releve.status}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Données du relevé -->
            <div>
                <h4 class="font-bold text-lg mb-3 text-gray-800">Données du relevé</h4>
                <div class="bg-gray-100 p-4 rounded-lg">
                    <div class="text-xs font-mono overflow-auto max-h-40 whitespace-pre-wrap">
                        ${releve.data ? releve.data.substring(0, 1000) + (releve.data.length > 1000 ? '...' : '') : 'Aucune donnée disponible'}
                    </div>
                </div>
            </div>
            
            <!-- Section Analyse -->
            <div>
                <div class="flex justify-between items-center mb-4">
                    <h4 class="font-bold text-lg text-gray-800">Analyse du relevé</h4>
                    <button onclick="analyzeReleve()" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
                        <i class="bi bi-graph-up mr-2"></i>Lancer l'analyse
                    </button>
                </div>
                <div id="analysis-section" class="hidden">
                    <!-- Les onglets d'analyse seront injectés ici -->
                </div>
            </div>
        </div>
    `;
    
    detailsModal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

// Fermer le modal
function closeModal() {
    detailsModal.classList.remove('open');
    document.body.style.overflow = '';
    currentReleve = null;
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

// Supprimer un relevé
function deleteReleve(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce relevé ?')) {
        releves = releves.filter(releve => releve.id !== id);
        localStorage.setItem('congelReleves', JSON.stringify(releves));
        updateRelevesList();
        
        if (currentReleve && currentReleve.id === id) {
            closeModal();
        }
    }
}

// Télécharger un relevé
function downloadReleve(id) {
    const releve = releves.find(r => r.id === id);
    if (releve && releve.data) {
        const blob = new Blob([releve.data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = releve.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } else {
        alert('Aucune donnée disponible pour ce relevé');
    }
}

// ============================================================================
// FONCTIONS D'ANALYSE
// ============================================================================

/**
 * Fonction pour convertir la valeur de la température en nombre.
 */
function getNumericTemperature(value) {
    const tempMap = {
        '30': 30, '29': 29, '28': 28, '27': 27,
        '26': 26, '25': 25, '24': 24, '23': 23,
        '22': 22, '21': 21, '20': 20, '19': 19,
        '18': 18, '17': 17, '16': 16, '15': 15,
        '14': 14, '13': 13, '12': 12, '11': 11,
        '10': 10, '09': 9, '08': 8, '07': 7,
        '06': 6, '05': 5, '04': 4, '03': 3,
        '02': 2, '01': 1, '00': 0,
        'FF': -1, 'FE': -2, 'FD': -3, 'FC': -4,
        'FB': -5, 'FA': -6, 'F9': -7, 'F8': -8,
        'F7': -9, 'F6': -10, 'F5': -11, 'F4': -12,
        'F3': -13, 'F2': -14, 'F1': -15
    };
    return tempMap[value] !== undefined ? tempMap[value] : null;
}

/**
 * Fonction pour corriger uniquement les températures égales à 25°C
 * en les remplaçant par la valeur précédente
 */
function correct25DegreesTemperatures(data) {
    if (data.length <= 1) return data;
    
    const correctedData = [data[0]]; // Garder la première entrée (N/A)
    let correctionCount = 0;
    
    for (let i = 1; i < data.length; i++) {
        const currentEntry = {...data[i]};
        const currentTemp = currentEntry.temperature;
        
        // Vérifier si la température est exactement 25°C
        if (currentTemp === 25) {
            // Chercher la température précédente (immédiatement avant)
            const previousIndex = i - 1;
            if (previousIndex >= 0) {
                const previousTemp = data[previousIndex].temperature;
                if (previousTemp !== null && previousTemp !== 25) {
                    currentEntry.temperature = previousTemp;
                    currentEntry.corrected = true; // Marquer comme corrigé
                    currentEntry.originalTemp = 25; // Garder la valeur originale
                    correctionCount++;
                    console.log(`Température 25°C corrigée: ${data[i].dateString} ${data[i].timeString} - 25°C → ${previousTemp}°C`);
                }
            }
        }
        
        correctedData.push(currentEntry);
    }
    
    if (correctionCount > 0) {
        console.log(`${correctionCount} température(s) de 25°C corrigée(s)`);
    }
    
    return correctedData;
}

/**
 * Fonction principale pour analyser le contenu d'un fichier.
 */
function analyzeReleve() {
    if (!currentReleve || !currentReleve.data) {
        alert('Aucun contenu de relevé à analyser.');
        return;
    }

    // Année du relevé pour le filtrage
    const releveDate = new Date(currentReleve.dateAdded);
    const releveYear = releveDate.getFullYear();
    if (isNaN(releveYear)) {
        alert('Année de relevé invalide.');
        return;
    }

    // Filtrer les lignes 'FF' avant d'analyser les données
    const filteredContent = currentReleve.data.split('\n').filter(line => !line.trim().startsWith('FF')).join('\n');

    // Analyser toutes les données
    parsedData = parseLogDataNew(filteredContent);

    const validStates = ['01', '02', '03', '04', '05', '06', '07'];

    // Filtrer les blocs invalides et les dates de l'année du relevé
    let tempFilteredData = parsedData.filter((entry, index) => {
        // Le premier bloc de 16 paires est toujours considéré comme valide
        if (index === 0) {
            return true;
        }

        // Pour les autres blocs (7 paires), vérifier la validité de la date, de l'année et de l'état
        const pairs = entry.split(' ');
        if (pairs.length < 7) {
            return false;
        }

        const day = Number(pairs[0]);
        const month = Number(pairs[1]);
        const year = pairs[2];
        const state = pairs[6];

        const isValidDate = day >= 1 && day <= 31 && month >= 1 && month <= 12;
        const entryYear = Number(`20${year}`);
        const isValidState = validStates.includes(state);

        return isValidDate && (entryYear === releveYear) && isValidState;
    }).map(entry => {
        const pairs = entry.split(' ');
        const day = pairs[0];
        const month = pairs[1];
        const year = pairs[2];
        const hour = pairs[3];
        const minute = pairs[4];
        const temperature = pairs[5];
        const state = pairs[6];

        const fullDate = new Date(`20${year}`, Number(month) - 1, Number(day), Number(hour), Number(minute));

        return {
            date: fullDate,
            dateString: `${day}/${month}/20${year}`,
            timeString: `${hour}:${minute}`,
            temperature: getNumericTemperature(temperature),
            state: state
        };
    });

    // CORRECTION SPÉCIFIQUE DES TEMPÉRATURES 25°C
    tempFilteredData = correct25DegreesTemperatures(tempFilteredData);

    originalData = tempFilteredData.slice();
    filteredData = tempFilteredData.slice();

    if (filteredData.length <= 1) {
        alert('Aucune donnée valide pour l\'année de relevé trouvée.');
        return;
    }

    // Afficher la section d'analyse
    const analysisSection = document.getElementById('analysis-section');
    analysisSection.classList.remove('hidden');

    // Rendre l'interface d'analyse
    renderAnalysisUI();

    // Appliquer les filtres initiaux
    applyFilters();

    alert('Analyse du relevé terminée avec succès.');
}

/**
 * Fonction pour créer et afficher l'interface d'analyse avec les onglets.
 */
function renderAnalysisUI() {
    const analysisSection = document.getElementById('analysis-section');
    analysisSection.innerHTML = `
        <div class="analysis-tabs">
            <button class="analysis-tab active" onclick="switchTab('detailed')">Données Détaillées</button>
            <button class="analysis-tab" onclick="switchTab('daily-summary')">Résumé Journalier</button>
            <button class="analysis-tab" onclick="switchTab('daily-diagnostic')">Diagnostic Quotidien</button>
            <button class="analysis-tab" onclick="switchTab('graph-evolution')">Graphique d'évolution</button>
        </div>
        
        <div id="analysisSummary" class="mb-4"></div>
        
        <div id="detailed" class="tab-content active">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label for="startDateFilter" class="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                    <input type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" id="startDateFilter">
                </div>
                <div>
                    <label for="endDateFilter" class="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                    <input type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" id="endDateFilter">
                </div>
            </div>
            <div class="flex gap-2 mb-4">
                <button class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600" onclick="applyFilters()">Filtrer</button>
                <button class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600" onclick="clearFilters()">Effacer</button>
                <button class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600" onclick="exportToExcel()">
                    <i class="bi bi-file-earmark-excel mr-1"></i>Exporter Excel
                </button>
            </div>
            <div id="analysisResults"></div>
        </div>
        
        <div id="daily-summary" class="tab-content">
            <div id="dailySummaryResults"></div>
        </div>
        
        <div id="daily-diagnostic" class="tab-content">
            <div id="dailyDiagnosticResults"></div>
        </div>
        
        <div id="graph-evolution" class="tab-content">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label for="graphDate" class="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <select class="w-full px-3 py-2 border border-gray-300 rounded-lg" id="graphDate">
                        <option value="">Sélectionnez une date</option>
                    </select>
                </div>
                <div>
                    <label for="chartType" class="block text-sm font-medium text-gray-700 mb-1">Type de graphique</label>
                    <select class="w-full px-3 py-2 border border-gray-300 rounded-lg" id="chartType">
                        <option value="line">Ligne</option>
                    </select>
                </div>
                <div class="flex items-end">
                    <button class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600" onclick="renderEvolutionGraph()">
                        Générer le graphique
                    </button>
                </div>
            </div>
            <div class="relative" style="height: 400px;">
                <canvas id="evolutionChart"></canvas>
            </div>
            <div id="chartMessage" class="mt-3"></div>
        </div>
    `;

    // Mettre à jour la liste des dates après le rendu
    setTimeout(updateDateList, 100);
}


// Fonction pour changer d'onglet
function switchTab(tabName) {
    // Désactiver tous les onglets
    document.querySelectorAll('.analysis-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activer l'onglet sélectionné
    document.querySelector(`.analysis-tab[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    // Charger le contenu de l'onglet
    if (tabName === 'daily-summary') {
        calculateAndDisplayDailySummary();
    } else if (tabName === 'daily-diagnostic') {
        calculateAndDisplayDailyDiagnostic();
    } else if (tabName === 'graph-evolution') {
        renderEvolutionGraph();
    }
}

/**
 * Fonction pour appliquer les filtres de date et mettre à jour le tableau.
 */
function applyFilters() {
    const startDate = document.getElementById('startDateFilter').value;
    const endDate = document.getElementById('endDateFilter').value;

    let tempFilteredData = originalData.slice(1);
    let dataForDisplay = [];

    if (startDate) {
        const start = new Date(startDate);
        tempFilteredData = tempFilteredData.filter(entry => entry.date >= start);
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        tempFilteredData = tempFilteredData.filter(entry => entry.date <= end);
    }

    if (originalData.length > 0) {
        dataForDisplay.push(originalData[0]);
    }
    dataForDisplay = dataForDisplay.concat(tempFilteredData);
    
    filteredData = dataForDisplay;

    if (sortColumn) {
        sortData(sortColumn, true);
    } else {
        renderTablePage(1);
    }

    calculateAndDisplaySummary();
    
    // Mettre à jour la liste des dates pour le graphique
    updateDateList();
}

function clearFilters() {
    document.getElementById('startDateFilter').value = '';
    document.getElementById('endDateFilter').value = '';
    
    // Réinitialiser les données filtrées à partir des données originales
    filteredData = originalData.slice();
    
    // Réinitialiser le tri
    sortColumn = null;
    sortDirection = 'asc';
    
    renderTablePage(1);
    calculateAndDisplaySummary();
}

/**
 * Fonction pour calculer et afficher la température moyenne, min et max.
 */
function calculateAndDisplaySummary() {
    // Exclure la première entrée qui est un bloc de données N/A
    const temperatures = filteredData.slice(1).map(entry => entry.temperature).filter(temp => !isNaN(temp));

    const summaryDiv = document.getElementById('analysisSummary');

    if (temperatures.length === 0) {
        summaryDiv.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p class="text-yellow-800">Aucune donnée de température valide pour la période sélectionnée.</p>
            </div>
        `;
        return;
    }

    const minTemp = Math.min(...temperatures);
    const maxTemp = Math.max(...temperatures);
    const sum = temperatures.reduce((a, b) => a + b, 0);
    const avgTemp = (sum / temperatures.length).toFixed(2);

    summaryDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <h5 class="font-semibold text-blue-800">Température Moyenne</h5>
                <p class="text-2xl font-bold text-blue-600">${avgTemp}°C</p>
            </div>
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <h5 class="font-semibold text-green-800">Température Minimale</h5>
                <p class="text-2xl font-bold text-green-600">${minTemp}°C</p>
            </div>
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <h5 class="font-semibold text-red-800">Température Maximale</h5>
                <p class="text-2xl font-bold text-red-600">${maxTemp}°C</p>
            </div>
        </div>
    `;
}

/**
 * Fonction pour trier les données du tableau.
 */
function sortData(column, isReapply = false) {
    if (sortColumn === column && !isReapply) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortDirection = 'asc';
    }
    sortColumn = column;
    
    const dataToSort = filteredData.slice(1);
    
    dataToSort.sort((a, b) => {
        let aVal, bVal;
        
        if (column === 'date') {
            aVal = a.date.getTime();
            bVal = b.date.getTime();
        } else if (column === 'time') {
            const aTime = a.timeString.split(':').map(Number);
            const bTime = b.timeString.split(':').map(Number);
            aVal = aTime[0] * 60 + aTime[1];
            bVal = bTime[0] * 60 + bTime[1];
        } else if (column === 'temp') {
            aVal = a.temperature;
            bVal = b.temperature;
        }
        
        if (sortDirection === 'asc') {
            return aVal - bVal;
        } else {
            return bVal - aVal;
        }
    });
    
    // Conserver le premier bloc et concaténer les données triées
    filteredData = [filteredData[0]].concat(dataToSort);
    renderTablePage(1);
}

/**
 * Fonction pour rendre une page spécifique du tableau avec la pagination.
 */
function renderTablePage(page, event) {
    if (event) {
        event.preventDefault();
    }

    currentPage = page;
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const dataForPage = filteredData.slice(start, end);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    const analysisResultsDiv = document.getElementById('analysisResults');

    // Construire le tableau HTML
    let tableHtml = `
        <div class="table-responsive overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 bg-white rounded-lg overflow-hidden">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onclick="sortData('date')">
                            Date ${sortColumn === 'date' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onclick="sortData('time')">
                            Heure ${sortColumn === 'time' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onclick="sortData('temp')">
                            Température ${sortColumn === 'temp' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">État</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;

    // Remplir le tableau avec les données de la page
    dataForPage.forEach((entry, index) => {
        let datePart = entry.dateString;
        let timePart = entry.timeString;
        let temperaturePart = convertTemperature(entry.temperature);
        let statePart = entry.state;

        // Gérer le cas spécial du premier bloc de données sur la première page
        if (currentPage === 1 && index === 0) {
            datePart = 'N/A';
            timePart = 'N/A';
            temperaturePart = 'N/A';
            statePart = 'N/A';
        }

        // Afficher un indicateur si la température a été corrigée
        if (entry.corrected) {
            temperaturePart = `<span class="text-blue-600 relative" title="Corrigée: 25°C → ${entry.temperature}°C">
                ${convertTemperature(entry.temperature)}
                <span class="absolute -top-1 -right-1 text-xs text-orange-500">●</span>
            </span>`;
        }

        tableHtml += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${datePart}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${timePart}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${temperaturePart}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${statePart}</td>
            </tr>
        `;
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    // Construire la pagination
    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml = `
            <div class="flex justify-center items-center space-x-2 mt-4">
                <button class="px-3 py-1 bg-gray-300 rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-400'}" 
                    ${currentPage === 1 ? 'disabled' : ''} onclick="renderTablePage(${currentPage - 1}, event)">
                    Précédent
                </button>
                <span class="text-sm text-gray-600">Page ${currentPage} sur ${totalPages}</span>
                <button class="px-3 py-1 bg-gray-300 rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-400'}" 
                    ${currentPage === totalPages ? 'disabled' : ''} onclick="renderTablePage(${currentPage + 1}, event)">
                    Suivant
                </button>
            </div>
        `;
    }

    analysisResultsDiv.innerHTML = tableHtml + paginationHtml;
}

/**
 * Fonction pour calculer et afficher un résumé journalier.
 */
function calculateAndDisplayDailySummary() {
    const dailyData = {};

    // Agréger les données par jour, en ignorant la première entrée
    filteredData.slice(1).forEach(entry => {
        const dateKey = entry.dateString;
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = {
                temperatures: [],
                states: new Set(),
                entries: [],
                date: dateKey
            };
        }
        if (entry.temperature !== null) {
            dailyData[dateKey].temperatures.push(entry.temperature);
        }
        dailyData[dateKey].states.add(entry.state);
        dailyData[dateKey].entries.push(entry);
    });

    // Calculer la moyenne, la min et le max pour chaque jour
    const summaryList = Object.values(dailyData).map(day => {
        const temps = day.temperatures;
        const avgTemp = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : 'N/A';
        const minTemp = temps.length > 0 ? Math.min(...temps) : 'N/A';
        const maxTemp = temps.length > 0 ? Math.max(...temps) : 'N/A';
        const hasStateChange = day.states.size > 1;

        let suddenChangeInfo = null;
        let fromState = null;
        let toState = null;

        if (hasStateChange) {
            for (let i = 1; i < day.entries.length; i++) {
                if (day.entries[i].state !== day.entries[i - 1].state) {
                    suddenChangeInfo = day.entries[i].timeString;
                    fromState = day.entries[i - 1].state;
                    toState = day.entries[i].state;
                    break;
                }
            }
        }

        return {
            date: day.date,
            avgTemp: avgTemp,
            minTemp: minTemp,
            maxTemp: maxTemp,
            hasStateChange: hasStateChange,
            suddenChangeTime: suddenChangeInfo,
            fromState: fromState,
            toState: toState
        };
    });

    const dailySummaryResultsDiv = document.getElementById('dailySummaryResults');

    if (summaryList.length === 0) {
        dailySummaryResultsDiv.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4"><p class="text-yellow-800">Aucune donnée de température valide pour le résumé journalier.</p></div>`;
        return;
    }

    let tableHtml = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 bg-white rounded-lg overflow-hidden">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Température Moyenne</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Température Minimale</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Température Maximale</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;

    summaryList.forEach(day => {
        const avgTempDisplay = typeof day.avgTemp === 'number' ? `${day.avgTemp}°C` : 'N/A';
        const minTempDisplay = typeof day.minTemp === 'number' ? `${day.minTemp}°C` : 'N/A';
        const maxTempDisplay = typeof day.maxTemp === 'number' ? `${day.maxTemp}°C` : 'N/A';

        tableHtml += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${day.date}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${avgTempDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${minTempDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${maxTempDisplay}</td>
            </tr>
        `;
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    // Ajouter les alertes de changement d'état
    let alertHtml = '';
    summaryList.forEach(day => {
        if (day.hasStateChange) {
            alertHtml += `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                    <div class="flex items-center">
                        <div class="text-yellow-800">
                            <strong>Changement d'état détecté le ${day.date}</strong> à ${day.suddenChangeTime}, 
                            passant de l'état ${day.fromState} à l'état ${day.toState}.
                        </div>
                    </div>
                </div>
            `;
        }
    });

    dailySummaryResultsDiv.innerHTML = tableHtml + alertHtml;
}

/**
 * Fonction pour calculer et afficher le diagnostic quotidien.
 */
function calculateAndDisplayDailyDiagnostic() {
    const dailyData = {};
    const forfait = currentReleve.forfaitType;
    const targetTemp = getForfaitTargetTemperature(forfait);

    // Agréger les températures par jour, en ignorant la première entrée
    filteredData.slice(1).forEach(entry => {
        const dateKey = entry.dateString;
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = {
                temperatures: []
            };
        }
        if (entry.temperature !== null) {
            dailyData[dateKey].temperatures.push(entry.temperature);
        }
    });

    // Diagnostiquer chaque jour
    const diagnosticList = Object.keys(dailyData).map(dateKey => {
        const temps = dailyData[dateKey].temperatures;
        let diagnostic = 'Non spécifié';
        let minTemp = temps.length > 0 ? Math.min(...temps) : 'N/A';

        if (targetTemp !== null) {
            const hasReachedTarget = temps.some(temp => temp <= targetTemp);
            if (hasReachedTarget) {
                diagnostic = 'Atteint la cible';
            } else {
                diagnostic = 'N\'a pas atteint la cible';
            }
        }

        return {
            date: dateKey,
            minTemp: minTemp,
            diagnostic: diagnostic
        };
    });

    const dailyDiagnosticResultsDiv = document.getElementById('dailyDiagnosticResults');
    if (diagnosticList.length === 0) {
        dailyDiagnosticResultsDiv.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4"><p class="text-yellow-800">Aucune donnée pour le diagnostic quotidien.</p></div>`;
        return;
    }

    let tableHtml = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 bg-white rounded-lg overflow-hidden">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Température Minimale</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diagnostic</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;

    diagnosticList.forEach(day => {
        const minTempDisplay = typeof day.minTemp === 'number' ? `${day.minTemp}°C` : 'N/A';
        let diagnosticColor = 'text-yellow-600';
        if (day.diagnostic === 'Atteint la cible') {
            diagnosticColor = 'text-green-600';
        } else if (day.diagnostic === 'N\'a pas atteint la cible') {
            diagnosticColor = 'text-red-600';
        }

        tableHtml += `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${day.date}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${minTempDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${diagnosticColor} font-medium">${day.diagnostic}</td>
            </tr>
        `;
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    dailyDiagnosticResultsDiv.innerHTML = tableHtml;
}

/**
 * Fonction pour obtenir la température cible en fonction du forfait.
 */
function getForfaitTargetTemperature(forfait) {
    if (forfait.includes('-10°C')) {
        return -10;
    } else if (forfait.includes('-5°C')) {
        return -5;
    }
    return null;
}

/**
 * Fonction pour convertir la valeur de la température en °C.
 */
function convertTemperature(value) {
    if (typeof value === 'number') {
        return `${value}°C`;
    }
    const temperatureMap = {
        '30': '30°C', '29': '29°C', '28': '28°C', '27': '27°C',
        '26': '26°C', '25': '25°C', '24': '24°C', '23': '23°C',
        '22': '22°C', '21': '21°C', '20': '20°C', '19': '19°C',
        '18': '18°C', '17': '17°C', '16': '16°C', '15': '15°C',
        '14': '14°C', '13': '13°C', '12': '12°C', '11': '11°C',
        '10': '10°C', '09': '9°C', '08': '8°C', '07': '7°C',
        '06': '6°C', '05': '5°C', '04': '4°C', '03': '3°C',
        '02': '2°C', '01': '1°C', '00': '0°C',
        'FF': '-1°C', 'FE': '-2°C', 'FD': '-3°C', 'FC': '-4°C',
        'FB': '-5°C', 'FA': '-6°C', 'F9': '-7°C', 'F8': '-8°C',
        'F7': '-9°C', 'F6': '-10°C', 'F5': '-11°C', 'F4': '-12°C',
        'F3': '-13°C', 'F2': '-14°C', 'F1': '-15°C'
    };
    return temperatureMap[value] || 'N/A';
}

/**
 * Fonction d'analyse qui implémente la nouvelle logique de blocs et de paires.
 */
function parseLogDataNew(logContent) {
    const data = [];
    const allPairs = logContent.trim().split(/\s+/);
    let index = 0;

    // Logique pour le premier bloc (16 paires)
    if (allPairs.length >= 16) {
        data.push(allPairs.slice(index, index + 16).join(' '));
        index += 16;
    } else {
        // Si le fichier est trop court, on ne peut rien faire d'autre.
        return data;
    }

    // Logique pour les blocs suivants
    while (index < allPairs.length) {
        let numPairsToTake;
        const currentBlockStart = allPairs.slice(index, index + 3).join(' '); // Vérifier les 3 premières paires

        if (currentBlockStart.startsWith('00 35 6A')) {
            numPairsToTake = 17;
        } else if (currentBlockStart.startsWith('00 3F')) {
            numPairsToTake = 9;
        } else if (allPairs[index] === 'FF') {
            numPairsToTake = 1;
        } else if (allPairs[index] === '35' && allPairs[index + 1] === '69') {
            numPairsToTake = 8;
        } else {
            numPairsToTake = 7;
        }

        // S'assurer qu'on ne prend pas plus de paires qu'il n'y en a
        const blockEndIndex = Math.min(index + numPairsToTake, allPairs.length);
        const block = allPairs.slice(index, blockEndIndex);

        // Si le bloc est vide, c'est la fin de l'analyse
        if (block.length === 0) {
            break;
        }

        data.push(block.join(' '));
        index += numPairsToTake;
    }

    return data;
}

/**
 * Fonction pour générer et afficher le graphique d'évolution avec améliorations des infobulles.
 */
/**
 * Fonction pour générer et afficher le graphique d'évolution avec améliorations des infobulles.
 */
function renderEvolutionGraph() {
    const selectedDate = document.getElementById('graphDate').value;
    const chartType = document.getElementById('chartType').value;
    const canvas = document.getElementById('evolutionChart');
    const chartMessage = document.getElementById('chartMessage');

    if (!canvas) {
        console.error("L'élément canvas 'evolutionChart' est introuvable.");
        return;
    }
    const ctx = canvas.getContext('2d');

    if (!selectedDate) {
        chartMessage.textContent = 'Veuillez sélectionner une date.';
        chartMessage.className = 'text-red-600';
        return;
    }

    // Filtrer les données pour la date sélectionnée
    const selectedDateData = filteredData.slice(1).filter(entry => {
        const entryDate = new Date(entry.date);
        const selected = new Date(selectedDate);
        return entryDate.toDateString() === selected.toDateString() && entry.temperature !== null;
    });

    if (selectedDateData.length === 0) {
        chartMessage.textContent = 'Aucune donnée disponible pour la date sélectionnée.';
        chartMessage.className = 'text-yellow-600';
        if (currentChart) {
            currentChart.destroy();
            currentChart = null;
        }
        return;
    }

    // Trier les données par heure
    selectedDateData.sort((a, b) => {
        const timeA = a.timeString.split(':').map(Number);
        const timeB = b.timeString.split(':').map(Number);
        return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });

    // Préparer les données pour le graphique
    const labels = selectedDateData.map(entry => entry.timeString);
    const temperatures = selectedDateData.map(entry => entry.temperature);
    const states = selectedDateData.map(entry => entry.state);
    
    // Déterminer les températures cibles selon les états
    const targetTemperatures = states.map(state => {
        switch(state) {
            case '03': return -15;
            case '04': return -10;
            case '05': return -5;
            default: return null;
        }
    });

    // Détruire l'ancien graphique
    if (currentChart) {
        try {
            currentChart.destroy();
        } catch (error) {
            console.error('Erreur lors de la destruction du graphique précédent :', error);
        }
        currentChart = null;
    }

    // Créer le nouveau graphique avec améliorations
    try {
        // Configuration des datasets - UNIQUEMENT la température réelle
        const datasets = [{
            label: 'Température (°C)',
            data: temperatures,
            backgroundColor: chartType === 'bar' ? 'rgba(54, 162, 235, 0.5)' : 'rgba(54, 162, 235, 0.1)',
            borderColor: 'rgb(54, 162, 235)',
            borderWidth: 2,
            fill: chartType === 'line',
            tension: 0.4,
            pointBackgroundColor: function(context) {
                const index = context.dataIndex;
                const temp = temperatures[index];
                const targetTemp = targetTemperatures[index];
                
                // Colorer les points selon si la température atteint la cible
                if (targetTemp !== null && temp <= targetTemp) {
                    return 'rgb(75, 192, 192)'; // Vert - objectif atteint
                } else if (targetTemp !== null && temp > targetTemp) {
                    return 'rgb(255, 99, 132)'; // Rouge - objectif non atteint
                }
                return 'rgb(54, 162, 235)'; // Bleu - pas de cible définie
            },
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
        }];

        // SUPPRIMÉ : Ajout de la ligne pour la température cible -5°C
        // On ne veut plus afficher cette ligne sur le graphique

        currentChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Température (°C)'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Heure'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Température: ${context.parsed.y}°C`;
                            },
                            afterLabel: function(context) {
                                const index = context.dataIndex;
                                const state = states[index];
                                const targetTemp = targetTemperatures[index];
                                
                                let tooltipText = `État: ${state}`;
                                
                                if (targetTemp !== null) {
                                    const temp = temperatures[index];
                                    const status = temp <= targetTemp ? '✓ Atteinte' : '✗ Non atteinte';
                                    tooltipText += `\nCible: ${targetTemp}°C (${status})`;
                                }
                                
                                return tooltipText;
                            },
                            footer: function(context) {
                                const index = context[0].dataIndex;
                                const targetTemp = targetTemperatures[index];
                                
                                if (targetTemp !== null) {
                                    const temp = temperatures[index];
                                    if (temp > targetTemp) {
                                        return `Écart: +${(temp - targetTemp).toFixed(1)}°C`;
                                    } else if (temp < targetTemp) {
                                        return `Écart: ${(temp - targetTemp).toFixed(1)}°C`;
                                    } else {
                                        return 'Objectif parfaitement atteint';
                                    }
                                }
                                return null;
                            }
                        },
                        displayColors: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                hover: {
                    animationDuration: 0
                }
            }
        });
        
        // Afficher les statistiques de la journée avec informations sur les objectifs
        const minTemp = Math.min(...temperatures);
        const maxTemp = Math.max(...temperatures);
        const avgTemp = (temperatures.reduce((a, b) => a + b, 0) / temperatures.length).toFixed(2);
        
        // Calculer le pourcentage d'atteinte des objectifs
        let objectivesStats = '';
        const stateTargets = {
            '03': { target: -15, count: 0, reached: 0 },
            '04': { target: -10, count: 0, reached: 0 },
            '05': { target: -5, count: 0, reached: 0 }
        };
        
        states.forEach((state, index) => {
            if (stateTargets[state]) {
                stateTargets[state].count++;
                if (temperatures[index] <= stateTargets[state].target) {
                    stateTargets[state].reached++;
                }
            }
        });
        
        Object.keys(stateTargets).forEach(state => {
            if (stateTargets[state].count > 0) {
                const percentage = ((stateTargets[state].reached / stateTargets[state].count) * 100).toFixed(1);
                objectivesStats += `
                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                        <div class="text-sm text-purple-600">Objectif ${stateTargets[state].target}°C (État ${state})</div>
                        <div class="text-lg font-bold text-purple-700">${percentage}%</div>
                        <div class="text-xs text-purple-500">${stateTargets[state].reached}/${stateTargets[state].count} mesures</div>
                    </div>
                `;
            }
        });
        
        chartMessage.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                        <div class="text-sm text-blue-600">Moyenne</div>
                        <div class="text-lg font-bold text-blue-700">${avgTemp}°C</div>
                    </div>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                        <div class="text-sm text-green-600">Minimum</div>
                        <div class="text-lg font-bold text-green-700">${minTemp}°C</div>
                    </div>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                        <div class="text-sm text-red-600">Maximum</div>
                        <div class="text-lg font-bold text-red-700">${maxTemp}°C</div>
                    </div>
                </div>
                ${objectivesStats ? `
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h5 class="font-semibold text-gray-800 mb-2 text-center">Atteinte des objectifs</h5>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        ${objectivesStats}
                    </div>
                </div>
                ` : ''}
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                    <div class="text-sm text-yellow-700">
                        <strong>Légende des points :</strong> 
                        <span class="inline-flex items-center ml-2"><span class="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1"></span>Pas de cible</span>
                        <span class="inline-flex items-center ml-2"><span class="inline-block w-3 h-3 bg-green-500 rounded-full mr-1"></span>Cible atteinte</span>
                        <span class="inline-flex items-center ml-2"><span class="inline-block w-3 h-3 bg-red-500 rounded-full mr-1"></span>Cible non atteinte</span>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Erreur lors de la création du graphique :', error);
        chartMessage.textContent = 'Erreur lors de la génération du graphique.';
        chartMessage.className = 'text-red-600';
    }
}

function updateDateList() {
    const dateSelect = document.getElementById('graphDate');
    if (!dateSelect) return;
    
    // Récupérer toutes les dates uniques
    const uniqueDates = [...new Set(filteredData.slice(1).map(entry => {
        const date = new Date(entry.date);
        return date.toISOString().split('T')[0]; // Format YYYY-MM-DD
    }))].sort();
    
    // Vider et remplir la liste
    dateSelect.innerHTML = '<option value="">Sélectionnez une date</option>';
    uniqueDates.forEach(date => {
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('fr-FR');
        dateSelect.innerHTML += `<option value="${date}">${formattedDate}</option>`;
    });
    
    // Sélectionner la dernière date par défaut
    if (uniqueDates.length > 0) {
        dateSelect.value = uniqueDates[uniqueDates.length - 1];
    }
}

/**
 * Fonction pour exporter les données du tableau détaillé en fichier Excel.
 */
function exportToExcel() {
    const tableData = filteredData.slice(1); // Exclure le premier bloc 'N/A'
    const headers = ['Date', 'Heure', 'Température', 'État'];
    
    // Ajoutez le BOM UTF-8 au début du contenu CSV
    let csvContent = '\uFEFF' + headers.join(';') + '\n';
    
    tableData.forEach(row => {
        const formattedTemp = typeof row.temperature === 'number' ? `${row.temperature}°C` : 'N/A';
        const rowData = [
            row.dateString,
            row.timeString,
            formattedTemp,
            row.state
        ].join(';');
        csvContent += rowData + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `releve_${currentReleve.nrNumber}_${formatDate(currentReleve.dateAdded).replace(/[/:\\]/g, '_')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert('Votre navigateur ne supporte pas l\'exportation directe de fichiers.');
    }
}

// Fonctions globales
window.viewReleveDetails = viewReleveDetails;
window.deleteReleve = deleteReleve;
window.closeModal = closeModal;
window.analyzeReleve = analyzeReleve;
window.switchTab = switchTab;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.sortData = sortData;
window.renderTablePage = renderTablePage;
window.calculateAndDisplayDailySummary = calculateAndDisplayDailySummary;
window.calculateAndDisplayDailyDiagnostic = calculateAndDisplayDailyDiagnostic;
window.renderEvolutionGraph = renderEvolutionGraph;
window.exportToExcel = exportToExcel;