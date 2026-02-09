// Constantes
const FORFAITS = [
    "ECO", 
    "ECLAIRAGE", 
    "ECLAIRAGE +", 
    "MULTIMEDIA", 
    "MULTIMEDIA +", 
    "ECLAIRAGE PUBLIC", 
    "CONGEL",
    "FREEZER 1",
    "FREEZER 3", 
    "PRENIUM"
];

// État de l'application
let currentFolder = null;
let currentFiles = [];
let selectedNR = '';
let savedFolders = [];
let folderColors = new Map();

// Éléments DOM
let openAddModalBtn, addFolderModal, closeModal, cancelModalBtn;
let selectFolderBtn, selectedFolderDiv, filesSection, filesListDiv, nrInput;
let clientsSection, clientsListDiv, validateBtn, validationHint;
let backToHomeBtn, foldersListSection, foldersListDiv, noFoldersMessage, folderSearchInput;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Application de gestion de fichiers initialisée');
    initializeApp();
});

function initializeApp() {
    initializeDOMElements();
    setupEventListeners();
    loadSavedFolders();
    console.log('✅ Application initialisée avec succès');
}

function initializeDOMElements() {
    // Modal elements
    openAddModalBtn = document.getElementById('open-add-modal-btn');
    addFolderModal = document.getElementById('add-folder-modal');
    closeModal = document.querySelector('.close');
    cancelModalBtn = document.getElementById('cancel-modal-btn');
    
    // Form elements
    selectFolderBtn = document.getElementById('select-folder-btn');
    selectedFolderDiv = document.getElementById('selected-folder');
    filesSection = document.getElementById('files-section');
    filesListDiv = document.getElementById('files-list');
    nrInput = document.getElementById('nr-input');
    clientsSection = document.getElementById('clients-section');
    clientsListDiv = document.getElementById('clients-list');
    validateBtn = document.getElementById('validate-btn');
    validationHint = document.getElementById('validation-hint');
    
    // Main page elements
    backToHomeBtn = document.getElementById('back-to-home-btn'); 
    foldersListSection = document.getElementById('folders-list-section');
    foldersListDiv = document.getElementById('folders-list');
    noFoldersMessage = document.getElementById('no-folders-message');
    folderSearchInput = document.getElementById('folder-search');

    console.log('✅ Éléments DOM initialisés');
}

function setupEventListeners() {
    // Modal events
    openAddModalBtn.addEventListener('click', openAddModal); 
    closeModal.addEventListener('click', closeAddModal);
    cancelModalBtn.addEventListener('click', closeAddModal);
    
    // Form events
    selectFolderBtn.addEventListener('click', selectFolder);
    nrInput.addEventListener('input', updateValidationState);
    validateBtn.addEventListener('click', confirmFolderCreation);
    
    // Main page events
    backToHomeBtn.addEventListener('click', () => window.location.href = 'home.html');
    folderSearchInput.addEventListener('input', filterFoldersList);

    // Close modal when clicking outside
    addFolderModal.addEventListener('click', (e) => {
        if (e.target === addFolderModal) {
            closeAddModal();
        }
    });

    console.log('✅ Événements configurés');
}

// Gestion du modal
function openAddModal() {
    console.log('📋 Ouverture du modal d\'ajout');
    addFolderModal.classList.remove('hidden');
    resetModalForm();
}

function closeAddModal() {
    console.log('🔒 Fermeture du modal d\'ajout');
    addFolderModal.classList.add('hidden');
    resetModalForm();
}

function resetModalForm() {
    currentFolder = null;
    currentFiles = [];
    selectedNR = '';
    
    selectedFolderDiv.textContent = '';
    filesSection.classList.add('hidden');
    clientsSection.classList.add('hidden');
    nrInput.value = '';
    validateBtn.disabled = true;
    validateBtn.textContent = 'Créer le dossier';
    validationHint.innerHTML = `
        <div class="format-instruction">
            <strong>📝 Format requis pour le nom du dossier:</strong><br>
            <code>NRX</code> (ex: NR1)<br>
            <code>NRXX</code> (ex: NR23)<br>
            <code>NRXXX</code> (ex: NR456)<br>
            <code>NRXXXX</code> (ex: NR7890)<br><br>
            <small>Le numéro après "NR" sera automatiquement extrait et placé dans le champ "Numéro NR"</small>
        </div>
    `;
    validationHint.classList.remove('warning');
    validationHint.classList.remove('success');
}

// Fonctions principales
function loadSavedFolders() {
    console.log('📂 Chargement des dossiers sauvegardés...');
    
    savedFolders = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('analysis_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                savedFolders.push({
                    nr: data.nr,
                    date: data.date,
                    filesCount: data.files ? data.files.length : 0,
                    folderPath: data.folderPath || 'Non spécifié'
                });
            } catch (error) {
                console.error('❌ Erreur lors du chargement du dossier:', key, error);
            }
        }
    }
    
    console.log('📋 Dossiers trouvés:', savedFolders.length);
    displayFoldersList();
}

function displayFoldersList() {
    console.log('🎨 Affichage de la liste des dossiers...');
    
    foldersListDiv.innerHTML = '';
    
    if (savedFolders.length === 0) {
        noFoldersMessage.style.display = 'block';
        return;
    }
    
    noFoldersMessage.style.display = 'none';
    
    // Trier par date (plus récent en premier)
    savedFolders.sort((a, b) => new Date(b.date) - new Date(a.date));
    updateFolderColors();
    
    savedFolders.forEach((folder, index) => {
        const folderCard = createFolderCard(folder);
        if (index === 0) {
            folderCard.classList.add('new-folder');
        }
        foldersListDiv.appendChild(folderCard);
    });
}

function createFolderCard(folder) {
    const folderCard = document.createElement('div');
    folderCard.className = 'folder-card';
    
    // Appliquer la couleur si le nom est en double
    const backgroundColor = folderColors.get(folder.nr);
    if (backgroundColor) {
        folderCard.style.borderLeft = `4px solid ${darkenColor(backgroundColor, 30)}`;
        folderCard.style.background = `linear-gradient(135deg, ${lightenColor(backgroundColor, 95)} 0%, ${lightenColor(backgroundColor, 90)} 100%)`;
    }
    
    folderCard.innerHTML = `
        <div class="folder-header">
            <div class="folder-main-info">
                <div class="folder-icon">📁</div>
                <div class="folder-info">
                    <div class="folder-name">Dossier NR${folder.nr}</div>
                    <div class="folder-details">
                        <div class="folder-date">${folder.date}</div>
                        <div class="folder-stats">${folder.filesCount} fichier(s)</div>
                    </div>
                </div>
            </div>
            <div class="folder-actions">
                <button class="btn btn-primary btn-small analyze-folder-btn" data-nr="${folder.nr}">
                    📊 Analyser
                </button>
                <button class="btn btn-warning btn-small advanced-folder-btn" data-nr="${folder.nr}">
                    📈 Avancée
                </button>
                <button class="btn btn-danger btn-small delete-folder-btn" data-nr="${folder.nr}">
                    🗑️ Supprimer
                </button>
            </div>
        </div>
    `;
    
    // Événements
    folderCard.querySelector('.analyze-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        analyzeExistingFolder(folder.nr);
    });
    
    folderCard.querySelector('.advanced-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openAdvancedAnalysis(folder.nr);
    });
    
    folderCard.querySelector('.delete-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFolder(folder.nr);
    });
    
    return folderCard;
}

function updateFolderColors() {
    folderColors.clear();
    const nameCount = new Map();
    
    // Compter les occurrences
    savedFolders.forEach(folder => {
        const count = nameCount.get(folder.nr) || 0;
        nameCount.set(folder.nr, count + 1);
    });
    
    // Assigner des couleurs aux doublons
    const colors = ['#ff6b6b', '#51cf66', '#339af0', '#cc5de8', '#ff922b'];
    let colorIndex = 0;
    
    nameCount.forEach((count, nr) => {
        if (count > 1) {
            folderColors.set(nr, colors[colorIndex % colors.length]);
            colorIndex++;
        }
    });
}

function darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return "#" + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

function lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

function filterFoldersList() {
    const searchTerm = folderSearchInput.value.toLowerCase().trim();
    const folderCards = foldersListDiv.querySelectorAll('.folder-card');
    
    let hasVisibleItems = false;
    
    folderCards.forEach(card => {
        const folderName = card.querySelector('.folder-name').textContent.toLowerCase();
        const isVisible = folderName.includes(searchTerm);
        card.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) hasVisibleItems = true;
    });
    
    noFoldersMessage.style.display = hasVisibleItems || !searchTerm ? 'none' : 'block';
    
    if (!hasVisibleItems && searchTerm) {
        noFoldersMessage.innerHTML = `
            <p>Aucun dossier trouvé pour "${searchTerm}"</p>
            <p>Vérifiez le terme de recherche ou créez un nouveau dossier</p>
        `;
    }
}

function deleteFolder(nr) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le dossier NR${nr} ? Cette action est irréversible.`)) {
        try {
            localStorage.removeItem(`analysis_${nr}`);
            savedFolders = savedFolders.filter(folder => folder.nr !== nr);
            displayFoldersList();
            showNotification(`Dossier NR${nr} supprimé avec succès`, 'success');
        } catch (error) {
            console.error('❌ Erreur lors de la suppression:', error);
            showNotification('Erreur lors de la suppression du dossier', 'error');
        }
    }
}

// Gestion des dossiers
async function selectFolder() {
    try {
        console.log('🔍 Sélection du dossier en cours...');
        
        const result = await window.electronAPI.selectFolder();
        
        if (result.success && result.folderPath) {
            await processSelectedFolder(result.folderPath);
        } else {
            showNotification(result.error || 'Aucun dossier sélectionné', 'error');
        }
    } catch (error) {
        console.error('❌ Erreur lors de la sélection:', error);
        showNotification('Erreur lors de la sélection du dossier: ' + error.message, 'error');
    }
}

async function processSelectedFolder(folderPath) {
    currentFolder = folderPath;
    selectedFolderDiv.textContent = `Dossier sélectionné: ${folderPath}`;
    
    // Extraire le numéro NR du nom du dossier
    const folderName = folderPath.split(/[\\/]/).pop(); // Prendre le dernier segment du chemin
    console.log('📁 Nom du dossier:', folderName);
    
    // Valider le format NR
    const nrMatch = folderName.match(/^NR(\d{1,4})$/i);
    
    if (!nrMatch) {
        showNotification('❌ Format de dossier incorrect! Le dossier doit être au format "NRX", "NRXX", "NRXXX" ou "NRXXXX" (ex: NR1, NR23, NR456, NR7890)', 'error');
        
        validationHint.innerHTML = `
            <div class="format-instruction warning">
                <strong>⚠️ Format de dossier incorrect!</strong><br>
                Nom du dossier détecté: <code>${folderName}</code><br><br>
                <strong>Format requis:</strong><br>
                <code>NRX</code> (ex: NR1)<br>
                <code>NRXX</code> (ex: NR23)<br>
                <code>NRXXX</code> (ex: NR456)<br>
                <code>NRXXXX</code> (ex: NR7890)<br><br>
                <small>Veuillez renommer votre dossier selon ce format, puis sélectionnez-le à nouveau.</small>
            </div>
        `;
        validationHint.classList.add('warning');
        
        // Réinitialiser
        currentFolder = null;
        selectedFolderDiv.textContent = '';
        filesSection.classList.add('hidden');
        clientsSection.classList.add('hidden');
        return;
    }
    
    // Extraire le numéro
    const extractedNR = nrMatch[1];
    console.log('🔢 Numéro NR extrait:', extractedNR);
    
    // Vérifier si ce numéro existe déjà
    const nrExists = savedFolders.some(folder => folder.nr === extractedNR);
    if (nrExists) {
        showNotification(`⚠️ Attention: Le numéro NR${extractedNR} existe déjà!`, 'warning');
        validationHint.innerHTML = `<div class="warning">⚠️ Le numéro NR${extractedNR} existe déjà dans la base de données. Si vous continuez, les données existantes seront écrasées.</div>`;
        validationHint.classList.add('warning');
    }
    
    // Remplir automatiquement le champ NR
    nrInput.value = extractedNR;
    selectedNR = extractedNR;
    
    // Demander confirmation à l'utilisateur
    const isConfirmed = await askNRConfirmation(extractedNR);
    
    if (!isConfirmed) {
        // Réinitialiser si l'utilisateur annule
        currentFolder = null;
        selectedFolderDiv.textContent = '';
        nrInput.value = '';
        selectedNR = '';
        validationHint.innerHTML = `
            <div class="format-instruction">
                <strong>📝 Format requis pour le nom du dossier:</strong><br>
                <code>NRX</code> (ex: NR1)<br>
                <code>NRXX</code> (ex: NR23)<br>
                <code>NRXXX</code> (ex: NR456)<br>
                <code>NRXXXX</code> (ex: NR7890)<br><br>
                <small>Le numéro après "NR" sera automatiquement extrait et placé dans le champ "Numéro NR"</small>
            </div>
        `;
        validationHint.classList.remove('warning');
        return;
    }
    
    console.log('📖 Lecture des fichiers...');
    
    try {
        const result = await window.electronAPI.readFolder(folderPath);
        
        if (result.success) {
            currentFiles = result.files;
            console.log('📄 Fichiers lus:', currentFiles.length);
            
            // Analyser les fichiers
            currentFiles = analyzeFiles(currentFiles);
            
            // Afficher les résultats
            displayFiles(currentFiles);
            
            // Montrer la section fichiers
            filesSection.classList.remove('hidden');
            
            // Mettre à jour la validation
            updateValidationState();
        } else {
            throw new Error(result.error || 'Erreur lors de la lecture des fichiers');
        }
    } catch (error) {
        console.error('❌ Erreur lors de la lecture des fichiers:', error);
        showNotification('Erreur lors de la lecture des fichiers: ' + error.message, 'error');
    }
}

// Fonction pour demander confirmation du numéro NR
function askNRConfirmation(nr) {
    return new Promise((resolve) => {
        // Créer une modal de confirmation
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay';
        confirmModal.innerHTML = `
            <div class="modal confirm-modal">
                <div class="modal-header">
                    <h3>Confirmation du numéro NR</h3>
                </div>
                <div class="modal-body">
                    <div class="confirm-content">
                        <p>Le dossier sélectionné est au format <strong>NR${nr}</strong>.</p>
                        <p>Le numéro <strong>${nr}</strong> a été extrait automatiquement.</p>
                        <div class="confirmation-question">
                            <p><strong>Est-ce bien le numéro NR que vous souhaitez utiliser ?</strong></p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="confirm-nr-yes" class="btn btn-success">
                        Oui, c'est le bon numéro
                    </button>
                    <button id="confirm-nr-no" class="btn btn-danger">
                        Non, annuler
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmModal);
        
        // Gérer les événements
        confirmModal.querySelector('#confirm-nr-yes').addEventListener('click', () => {
            document.body.removeChild(confirmModal);
            resolve(true);
        });
        
        confirmModal.querySelector('#confirm-nr-no').addEventListener('click', () => {
            document.body.removeChild(confirmModal);
            resolve(false);
        });
        
        // Fermer en cliquant en dehors
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                document.body.removeChild(confirmModal);
                resolve(false);
            }
        });
    });
}

function analyzeFiles(files) {
    console.log('🔄 Analyse des fichiers...');
    return files.map(file => {
        console.log(`📄 Analyse: ${file.name}`);
        
        const lines = file.content.split('\n');
        const firstLine = lines[0]?.trim();
        const secondLine = lines[1]?.trim();
        
        let type = 'inconnu';
        let client = null;
        
        if (firstLine) {
            // Nettoyer la ligne des espaces multiples
            const cleanLine = firstLine.replace(/\s+/g, ' ');
            const bytes = cleanLine.split(' ').filter(byte => byte.length > 0);
            
            console.log(`🔍 Ligne analysée: "${cleanLine}"`);
            console.log(`🔍 Octets: ${bytes.join(' ')}`);
            
            // Vérifier les différents patterns
            if (bytes.length >= 2) {
                const byte1 = bytes[0];
                const byte2 = bytes[1];
                const byte3 = bytes[2];
                const byte4 = bytes[3];
                
                // Pattern 1: "13 A0 XX" (énergie avec client)
                if (byte1 === '13' && byte2 === 'A0' && isValidClientByte(byte3)) {
                    type = 'énergie';
                    client = byte3;
                    console.log(`✅ Pattern 1: ${type} - Client: ${client}`);
                }
                // Pattern 2: "A0 XX" (énergie directe avec client)
                else if (byte1 === 'A0' && isValidClientByte(byte2)) {
                    type = 'énergie';
                    client = byte2;
                    console.log(`✅ Pattern 2: ${type} - Client: ${client}`);
                }
                // Pattern 3: "13 B0 XX" (crédit avec client)
                else if (byte1 === '13' && byte2 === 'B0' && isValidClientByte(byte3)) {
                    type = 'crédit';
                    client = byte3;
                    console.log(`✅ Pattern 3: ${type} - Client: ${client}`);
                }
                // Pattern 4: "B0 XX" (crédit directe avec client)
                else if (byte1 === 'B0' && isValidClientByte(byte2)) {
                    type = 'crédit';
                    client = byte2;
                    console.log(`✅ Pattern 4: ${type} - Client: ${client}`);
                }
                // Pattern 5: "13 C0 XX" (tension - XX = FF ou 01-06)
                else if (byte1 === '13' && byte2 === 'C0' && (byte3 === 'FF' || isValidParameterByte(byte3))) {
                    type = 'tension';
                    console.log(`✅ Pattern 5: ${type} - Paramètre: ${byte3}`);
                }
                // Pattern 6: "C0 XX" (tension directe - XX peut être FF ou 01-06)
                else if (byte1 === 'C0' && (byte2 === 'FF' || isValidParameterByte(byte2))) {
                    type = 'tension';
                    console.log(`✅ Pattern 6: ${type} - Paramètre: ${byte2}`);
                }
                // Pattern 7: "13 D0 XX" (ENR - XX = FF ou 01-06)
                else if (byte1 === '13' && byte2 === 'D0' && (byte3 === 'FF' || isValidParameterByte(byte3))) {
                    type = 'ENR';
                    console.log(`✅ Pattern 7: ${type} - Paramètre: ${byte3}`);
                }
                // Pattern 8: "D0 XX" (ENR directe - XX peut être FF ou 01-06)
                else if (byte1 === 'D0' && (byte2 === 'FF' || isValidParameterByte(byte2))) {
                    type = 'ENR';
                    console.log(`✅ Pattern 8: ${type} - Paramètre: ${byte2}`);
                }
                // Pattern 9: "13 E0 XX" (EC - XX = FF ou 01-06)
                else if (byte1 === '13' && byte2 === 'E0' && (byte3 === 'FF' || isValidParameterByte(byte3))) {
                    type = 'EC';
                    console.log(`✅ Pattern 9: ${type} - Paramètre: ${byte3}`);
                }
                // Pattern 10: "E0 XX" (EC directe - XX peut être FF ou 01-06)
                else if (byte1 === 'E0' && (byte2 === 'FF' || isValidParameterByte(byte2))) {
                    type = 'EC';
                    console.log(`✅ Pattern 10: ${type} - Paramètre: ${byte2}`);
                }
                // Pattern 11: "13 F0 XX" (recharge - XX = FF ou 01-06)
                else if (byte1 === '13' && byte2 === 'F0' && (byte3 === 'FF' || isValidParameterByte(byte3))) {
                    type = 'recharge';
                    console.log(`✅ Pattern 11: ${type} - Paramètre: ${byte3}`);
                }
                // Pattern 12: "F0 XX" (recharge directe - XX peut être FF ou 01-06)
                else if (byte1 === 'F0' && (byte2 === 'FF' || isValidParameterByte(byte2))) {
                    type = 'recharge';
                    console.log(`✅ Pattern 12: ${type} - Paramètre: ${byte2}`);
                }
                // Pattern 13: "13 C0" peut être sur deux lignes
                else if (byte1 === '13' && bytes.length === 1 && secondLine) {
                    const secondBytes = secondLine.replace(/\s+/g, ' ').split(' ').filter(b => b.length > 0);
                    if (secondBytes.length >= 2 && secondBytes[0] === 'C0' && 
                        (secondBytes[1] === 'FF' || isValidParameterByte(secondBytes[1]))) {
                        type = 'tension';
                        console.log(`✅ Pattern 13 (2 lignes): ${type} - Paramètre: ${secondBytes[1]}`);
                    }
                }
                // Pattern 14: "13 D0" peut être sur deux lignes
                else if (byte1 === '13' && bytes.length === 1 && secondLine) {
                    const secondBytes = secondLine.replace(/\s+/g, ' ').split(' ').filter(b => b.length > 0);
                    if (secondBytes.length >= 2 && secondBytes[0] === 'D0' && 
                        (secondBytes[1] === 'FF' || isValidParameterByte(secondBytes[1]))) {
                        type = 'ENR';
                        console.log(`✅ Pattern 14 (2 lignes): ${type} - Paramètre: ${secondBytes[1]}`);
                    }
                }
                // Pattern 15: "13 E0" peut être sur deux lignes
                else if (byte1 === '13' && bytes.length === 1 && secondLine) {
                    const secondBytes = secondLine.replace(/\s+/g, ' ').split(' ').filter(b => b.length > 0);
                    if (secondBytes.length >= 2 && secondBytes[0] === 'E0' && 
                        (secondBytes[1] === 'FF' || isValidParameterByte(secondBytes[1]))) {
                        type = 'EC';
                        console.log(`✅ Pattern 15 (2 lignes): ${type} - Paramètre: ${secondBytes[1]}`);
                    }
                }
                // Pattern 16: "13 F0" peut être sur deux lignes
                else if (byte1 === '13' && bytes.length === 1 && secondLine) {
                    const secondBytes = secondLine.replace(/\s+/g, ' ').split(' ').filter(b => b.length > 0);
                    if (secondBytes.length >= 2 && secondBytes[0] === 'F0' && 
                        (secondBytes[1] === 'FF' || isValidParameterByte(secondBytes[1]))) {
                        type = 'recharge';
                        console.log(`✅ Pattern 16 (2 lignes): ${type} - Paramètre: ${secondBytes[1]}`);
                    }
                }
                // Pattern 17: "13 A0" peut être sur deux lignes
                else if (byte1 === '13' && bytes.length === 1 && secondLine) {
                    const secondBytes = secondLine.replace(/\s+/g, ' ').split(' ').filter(b => b.length > 0);
                    if (secondBytes.length >= 2 && secondBytes[0] === 'A0' && isValidClientByte(secondBytes[1])) {
                        type = 'énergie';
                        client = secondBytes[1];
                        console.log(`✅ Pattern 17 (2 lignes): ${type} - Client: ${client}`);
                    }
                }
                // Pattern 18: "13 B0" peut être sur deux lignes
                else if (byte1 === '13' && bytes.length === 1 && secondLine) {
                    const secondBytes = secondLine.replace(/\s+/g, ' ').split(' ').filter(b => b.length > 0);
                    if (secondBytes.length >= 2 && secondBytes[0] === 'B0' && isValidClientByte(secondBytes[1])) {
                        type = 'crédit';
                        client = secondBytes[1];
                        console.log(`✅ Pattern 18 (2 lignes): ${type} - Client: ${client}`);
                    }
                }
                else {
                    console.log(`❌ Aucun pattern reconnu pour ${file.name}`);
                }
            } else {
                console.log(`❌ Ligne trop courte pour analyse: ${cleanLine}`);
            }
        } else {
            console.log(`❌ Fichier vide ou première ligne manquante: ${file.name}`);
        }
        
        console.log(`📊 Résultat final: ${type} ${client ? '(Client: ' + client + ')' : ''}`);
        
        return {
            ...file,
            type,
            client,
            forfait: null
        };
    });
}

// Fonction utilitaire pour valider les octets de client
function isValidClientByte(byte) {
    if (!byte) return false;
    
    // Vérifier si c'est un octet valide (01 à 06 ou 01 à FF pour les clients étendus)
    const byteValue = parseInt(byte, 16);
    return !isNaN(byteValue) && byteValue >= 0x01 && byteValue <= 0xFF && 
           byte.length === 2 && /^[0-9A-Fa-f]{2}$/.test(byte);
}

// Fonction utilitaire pour valider les octets de paramètre (FF ou 01-06)
function isValidParameterByte(byte) {
    if (!byte) return false;
    return byte === '01' || byte === '02' || byte === '03' || byte === '04' || byte === '05' || byte === '06' ||
           byte === 'FF';
}

function displayFiles(files) {
    console.log('🎨 Affichage des fichiers...');
    filesListDiv.innerHTML = '';
    
    const unknownFiles = files.filter(file => file.type === 'inconnu');
    
    // Grouper les fichiers par type pour un affichage organisé
    const filesByType = {
        'énergie': files.filter(file => file.type === 'énergie'),
        'crédit': files.filter(file => file.type === 'crédit'),
        'tension': files.filter(file => file.type === 'tension'),
        'ENR': files.filter(file => file.type === 'ENR'),
        'EC': files.filter(file => file.type === 'EC'),
        'recharge': files.filter(file => file.type === 'recharge'),
        'inconnu': unknownFiles
    }; 
    
    // Afficher les fichiers par catégorie
    Object.entries(filesByType).forEach(([type, typeFiles]) => {
        if (typeFiles.length > 0) {
            const typeHeader = document.createElement('div');
            typeHeader.className = 'type-header';
            
            let icon = '📄';
            if (type === 'énergie') icon = '🔋';
            else if (type === 'crédit') icon = '💰';
            else if (type === 'tension') icon = '⚡';
            else if (type === 'ENR') icon = '📊';
            else if (type === 'EC') icon = '🔌';
            else if (type === 'recharge') icon = '🔄';
            else if (type === 'inconnu') icon = '❓';
            
            typeHeader.innerHTML = `<h4>${icon} ${type.toUpperCase()} (${typeFiles.length})</h4>`;
            filesListDiv.appendChild(typeHeader);
            
            typeFiles.forEach(file => {
                const fileCard = document.createElement('div');
                fileCard.className = `file-card ${file.type} ${file.type === 'inconnu' ? 'unknown' : 'known'}`;
                
                let clientInfo = '';
                if (file.client) {
                    clientInfo = `<div class="file-client"><strong>Client:</strong> ${file.client}</div>`;
                }
                
                fileCard.innerHTML = `
                    <div class="file-name">${file.name}</div>
                    ${clientInfo}
                    <div class="file-details">
                        <div class="file-type">Type: <strong>${file.type}</strong></div>
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                `;
                
                filesListDiv.appendChild(fileCard);
            });
        }
    });
    
    // Avertissement pour fichiers inconnus
    if (unknownFiles.length > 0) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'warning-message';
        warningDiv.innerHTML = `
            <div class="warning-content">
                <strong>⚠️ Attention:</strong> ${unknownFiles.length} fichier(s) avec un type non reconnu.
                Ces fichiers ne seront pas pris en compte dans l'analyse.
                <div class="warning-tip">
                    <small>Conseil: Vérifiez que les fichiers commencent par l'un des patterns suivants:
                    <br>• "13 A0 XX" ou "A0 XX" (énergie client XX)
                    <br>• "13 B0 XX" ou "B0 XX" (crédit client XX)
                    <br>• "13 C0 XX" ou "C0 XX" (tension - XX = FF ou 01-06)
                    <br>• "13 D0 XX" ou "D0 XX" (ENR - XX = FF ou 01-06)
                    <br>• "13 E0 XX" ou "E0 XX" (EC - XX = FF ou 01-06)
                    <br>• "13 F0 XX" ou "F0 XX" (recharge - XX = FF ou 01-06)
                    <br>où XX = 01, 02, 03, 04, 05, 06 ou FF</small>
                </div>
            </div>
        `;
        filesListDiv.parentNode.insertBefore(warningDiv, filesListDiv.nextSibling);
    }
    
    // Configuration des clients (seulement pour fichiers avec client)
    const filesWithClient = files.filter(file => file.client);
    console.log(`👥 Clients détectés:`, filesWithClient.map(c => c.client));
    
    if (filesWithClient.length > 0) {
        displayClientsConfiguration(filesWithClient);
        clientsSection.classList.remove('hidden');
    } else {
        clientsSection.classList.add('hidden');
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' octets';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

function displayClientsConfiguration(clients) {
    console.log('⚙️ Configuration des clients...');
    clientsListDiv.innerHTML = '';
    
    const clientsMap = new Map();
    clients.forEach(file => {
        if (!clientsMap.has(file.client)) {
            clientsMap.set(file.client, []);
        }
        clientsMap.get(file.client).push(file);
    });
    
    // Trier les clients par numéro
    const sortedClients = Array.from(clientsMap.keys()).sort((a, b) => {
        const aNum = parseInt(a, 16);
        const bNum = parseInt(b, 16);
        return aNum - bNum;
    });
    
    sortedClients.forEach(client => {
        const files = clientsMap.get(client);
        const energyFiles = files.filter(f => f.type === 'énergie');
        const creditFiles = files.filter(f => f.type === 'crédit');
        
        const clientConfig = document.createElement('div');
        clientConfig.className = 'client-config';
        
        clientConfig.innerHTML = `
            <div class="client-header">
                <h4>👤 Client ${client}</h4>
                <div class="client-stats">
                    <span class="stat-energy">🔋 ${energyFiles.length}</span>
                    <span class="stat-credit">💰 ${creditFiles.length}</span>
                </div>
            </div>
            <div class="forfait-config">
                <label>Forfait:</label>
                <select class="forfait-select" data-client="${client}">
                    <option value="">Sélectionnez un forfait</option>
                    ${FORFAITS.map(forfait => `<option value="${forfait}">${forfait}</option>`).join('')}
                </select>
            </div>
        `;
        
        const select = clientConfig.querySelector('.forfait-select');
        select.addEventListener('change', (e) => {
            const selectedForfait = e.target.value;
            console.log(`🎯 Forfait sélectionné pour client ${client}: ${selectedForfait}`);
            
            // Mettre à jour les fichiers
            currentFiles.forEach(file => {
                if (file.client === client) {
                    file.forfait = selectedForfait;
                }
            });
            
            updateValidationState();
            
            // Feedback visuel
            if (selectedForfait) {
                clientConfig.classList.add('forfait-selected');
            } else {
                clientConfig.classList.remove('forfait-selected');
            }
        });
        
        clientsListDiv.appendChild(clientConfig);
    });
}

function updateValidationState() {
    selectedNR = nrInput.value.trim();
    console.log(`🔍 Validation - NR: "${selectedNR}"`);
    
    // Vérifications
    const hasEnergy = currentFiles.some(file => file.type === 'énergie');
    const hasCredit = currentFiles.some(file => file.type === 'crédit');
    const hasTension = currentFiles.some(file => file.type === 'tension');
    const hasENR = currentFiles.some(file => file.type === 'ENR');
    const hasEC = currentFiles.some(file => file.type === 'EC');
    const hasRecharge = currentFiles.some(file => file.type === 'recharge');
    
    // Vérifier s'il y a AU MOINS UN fichier valide
    const hasAtLeastOneValidFile = hasEnergy || hasCredit || hasTension || hasENR || hasEC || hasRecharge;
    
    const tensionFiles = currentFiles.filter(file => file.type === 'tension');
    const enrFiles = currentFiles.filter(file => file.type === 'ENR');
    const ecFiles = currentFiles.filter(file => file.type === 'EC');
    const rechargeFiles = currentFiles.filter(file => file.type === 'recharge');
    
    const hasUniqueTension = tensionFiles.length <= 1;
    const hasUniqueENR = enrFiles.length <= 1;
    const hasUniqueEC = ecFiles.length <= 1;
    const hasUniqueRecharge = rechargeFiles.length <= 1;
    
    const clientsWithFiles = currentFiles.filter(file => file.client);
    const allClientsHaveForfait = clientsWithFiles.every(file => file.forfait);
    
    // Mettre à jour le message d'aide
    let problems = [];
    let successes = [];
    
    if (!hasAtLeastOneValidFile) {
        problems.push("❌ Au moins un fichier valide requis (énergie, crédit, tension, ENR, EC ou recharge)");
    } else {
        // Afficher les types de fichiers détectés
        const detectedTypes = [];
        if (hasEnergy) detectedTypes.push(`énergie (${currentFiles.filter(f => f.type === 'énergie').length})`);
        if (hasCredit) detectedTypes.push(`crédit (${currentFiles.filter(f => f.type === 'crédit').length})`);
        if (hasTension) detectedTypes.push(`tension (${tensionFiles.length})`);
        if (hasENR) detectedTypes.push(`ENR (${enrFiles.length})`);
        if (hasEC) detectedTypes.push(`EC (${ecFiles.length})`);
        if (hasRecharge) detectedTypes.push(`recharge (${rechargeFiles.length})`);
        
        successes.push(`✅ Types détectés: ${detectedTypes.join(', ')}`);
    }
    
    if (!hasUniqueTension) problems.push(`❌ Fichier tension doit être unique (${tensionFiles.length} trouvés)`);
    else if (hasTension) successes.push(`✅ Fichier tension: ${tensionFiles.length} (OK)`);
    
    if (!hasUniqueENR) problems.push(`❌ Fichier ENR doit être unique (${enrFiles.length} trouvés)`);
    else if (hasENR) successes.push(`✅ Fichier ENR: ${enrFiles.length} (OK)`);
    
    if (!hasUniqueEC) problems.push(`❌ Fichier EC doit être unique (${ecFiles.length} trouvés)`);
    else if (hasEC) successes.push(`✅ Fichier EC: ${ecFiles.length} (OK)`);
    
    if (!hasUniqueRecharge) problems.push(`❌ Fichier recharge doit être unique (${rechargeFiles.length} trouvés)`);
    else if (hasRecharge) successes.push(`✅ Fichier recharge: ${rechargeFiles.length} (OK)`);
    
    // Vérifier les forfaits seulement s'il y a des clients
    if (clientsWithFiles.length > 0) {
        if (!allClientsHaveForfait) {
            const missingForfaitClients = clientsWithFiles
                .filter(file => !file.forfait)
                .map(file => file.client)
                .filter((value, index, self) => self.indexOf(value) === index);
            
            problems.push(`❌ Clients sans forfait: ${missingForfaitClients.join(', ')}`);
        } else {
            const clientsWithForfait = [...new Set(clientsWithFiles.map(f => f.client))];
            successes.push(`✅ Tous les clients ont un forfait (${clientsWithForfait.length} client(s))`);
        }
    }
    
    if (!selectedNR) problems.push("❌ Numéro NR requis");
    else {
        // Vérifier que le NR correspond au nom du dossier
        const folderName = currentFolder ? currentFolder.split(/[\\/]/).pop() : '';
        const nrMatch = folderName.match(/^NR(\d{1,4})$/i);
        
        if (nrMatch && nrMatch[1] === selectedNR) {
            successes.push(`✅ Numéro NR: ${selectedNR} (correspond au dossier ${folderName})`);
        } else if (currentFolder) {
            problems.push(`❌ Numéro NR ${selectedNR} ne correspond pas au nom du dossier (${folderName})`);
        } else {
            successes.push(`✅ Numéro NR: ${selectedNR}`);
        }
    }
    
    // Afficher tous les messages
    const allMessages = [...problems, ...successes];
    validationHint.innerHTML = `
        <div class="validation-summary">
            ${allMessages.join('<br>')}
        </div>
    `;
    
    if (problems.length > 0) {
        validationHint.classList.add('warning');
        validationHint.classList.remove('success');
    } else {
        validationHint.classList.remove('warning');
        validationHint.classList.add('success');
    }
    
    console.log('📊 État de validation:', {
        hasAtLeastOneValidFile,
        hasEnergy,
        hasCredit,
        hasTension,
        hasENR,
        hasEC,
        hasRecharge,
        hasUniqueTension,
        hasUniqueENR,
        hasUniqueEC,
        hasUniqueRecharge,
        allClientsHaveForfait,
        hasNR: selectedNR !== ''
    });
    
    // Validation finale
    const isValid = hasAtLeastOneValidFile && 
                   hasUniqueTension && 
                   hasUniqueENR && 
                   hasUniqueEC && 
                   hasUniqueRecharge && 
                   (clientsWithFiles.length === 0 || allClientsHaveForfait) && 
                   selectedNR !== '' &&
                   currentFolder !== null;
    
    validateBtn.disabled = !isValid;
    
    if (validateBtn.disabled) {
        validateBtn.title = "Critères non remplis";
        validateBtn.classList.add('btn-warning');
        validateBtn.classList.remove('btn-success');
        validateBtn.textContent = 'Créer le dossier';
    } else {
        validateBtn.title = "Cliquez pour créer le dossier";
        validateBtn.classList.remove('btn-warning');
        validateBtn.classList.add('btn-success');
        validateBtn.textContent = `Créer le dossier NR${selectedNR}`;
    }
}

// FONCTION PRINCIPALE - Création directe du dossier
async function confirmFolderCreation() {
    console.log('🚀 CRÉATION DIRECTE DU DOSSIER...');
    
    if (!selectedNR || selectedNR.trim() === '') {
        console.error('❌ NR vide!');
        showNotification('Le numéro NR est requis', 'error');
        return;
    }
    
    // Vérification finale (au cas où le bouton serait cliqué malgré tout)
    if (validateBtn.disabled) {
        console.error('❌ Validation échouée - bouton désactivé');
        showNotification('Veuillez corriger les problèmes avant de créer le dossier', 'error');
        return;
    }
    
    // Demander confirmation finale
    const isConfirmed = await askFinalConfirmation(selectedNR);
    if (!isConfirmed) {
        return;
    }
    
    const folderData = {
        nr: selectedNR,
        date: new Date().toLocaleString('fr-FR'),
        files: currentFiles,
        folderPath: currentFolder || 'Dossier sélectionné'
    };
    
    console.log('💾 Création du dossier avec données:', folderData);
    
    try {
        // Sauvegarde localStorage
        console.log('💾 Sauvegarde localStorage...');
        const storageKey = `analysis_${selectedNR}`;
        localStorage.setItem(storageKey, JSON.stringify(folderData));
        
        // Vérification
        const savedData = localStorage.getItem(storageKey);
        if (!savedData) {
            throw new Error('Échec de la sauvegarde localStorage');
        }
        
        console.log('✅ Sauvegarde localStorage réussie');
        
        // Mettre à jour l'état
        const newFolder = {
            nr: selectedNR,
            date: folderData.date,
            filesCount: currentFiles.length,
            folderPath: folderData.folderPath
        };
        
        // Supprimer l'ancien s'il existe
        savedFolders = savedFolders.filter(f => f.nr !== selectedNR);
        savedFolders.unshift(newFolder);
        
        // METTRE À JOUR LA LISTE DES DOSSIERS IMMÉDIATEMENT
        displayFoldersList();
        
        // Fermer le modal et afficher notification
        closeAddModal();
        showNotification(`✅ Dossier NR${selectedNR} créé avec succès !`, 'success');
        
    } catch (error) {
        console.error('❌ ERREUR création dossier:', error);
        showNotification('Erreur: ' + error.message, 'error');
    }
}

// Fonction pour demander confirmation finale
function askFinalConfirmation(nr) {
    return new Promise((resolve) => {
        // Créer une modal de confirmation finale
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay';
        confirmModal.innerHTML = `
            <div class="modal confirm-modal final-confirm">
                <div class="modal-header">
                    <h3>Confirmation finale</h3>
                </div>
                <div class="modal-body">
                    <div class="confirm-content">
                        <p>Vous êtes sur le point de créer le dossier <strong>NR${nr}</strong>.</p>
                        <div class="creation-summary">
                            <p><strong>Récapitulatif:</strong></p>
                            <ul>
                                <li>📁 Dossier: ${currentFolder ? currentFolder.split(/[\\/]/).pop() : 'Non spécifié'}</li>
                                <li>📄 Fichiers: ${currentFiles.length}</li>
                                <li>👥 Clients: ${[...new Set(currentFiles.filter(f => f.client).map(f => f.client))].length}</li>
                                <li>⚡ Types: ${[...new Set(currentFiles.filter(f => f.type !== 'inconnu').map(f => f.type))].join(', ')}</li>
                            </ul>
                        </div>
                        <div class="confirmation-question">
                            <p><strong>Confirmez-vous la création du dossier NR${nr} ?</strong></p>
                            <p class="warning-text"><small>⚠️ Si un dossier avec ce numéro existe déjà, il sera écrasé.</small></p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="confirm-final-yes" class="btn btn-success">
                        ✅ Oui, créer le dossier
                    </button>
                    <button id="confirm-final-no" class="btn btn-danger">
                        ❌ Non, annuler
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmModal);
        
        // Gérer les événements
        confirmModal.querySelector('#confirm-final-yes').addEventListener('click', () => {
            document.body.removeChild(confirmModal);
            resolve(true);
        });
        
        confirmModal.querySelector('#confirm-final-no').addEventListener('click', () => {
            document.body.removeChild(confirmModal);
            resolve(false);
        });
        
        // Fermer en cliquant en dehors
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                document.body.removeChild(confirmModal);
                resolve(false);
            }
        });
    });
}

function analyzeExistingFolder(nr) {
    console.log('📊 Analyse dossier existant:', nr);
    window.location.href = `results.html?nr=${nr}`;
}

function openAdvancedAnalysis(nr) {
    console.log('📈 Ouverture de l\'analyse avancée pour le dossier:', nr);
    
    try {
        // Vérifier si les données existent
        const data = localStorage.getItem(`analysis_${nr}`);
        if (!data) {
            showNotification(`Dossier ${nr} introuvable dans le stockage`, 'error');
            return;
        }
        
        // Charger les données
        const folderData = JSON.parse(data);
        
        // Vérifier qu'il y a des données à analyser
        if (!folderData.files || folderData.files.length === 0) {
            showNotification(`Le dossier ${nr} ne contient aucun fichier`, 'error');
            return;
        }
        
        console.log(`✅ Données chargées pour ${nr}:`, {
            fichiers: folderData.files.length,
            types: [...new Set(folderData.files.map(f => f.type))]
        });
        
        // Rediriger vers la page tableau-horaire.html avec le NR en paramètre
        window.location.href = `tableau-horaire.html?nr=${nr}`;
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'ouverture de l\'analyse avancée:', error);
        showNotification(`Erreur: ${error.message}`, 'error');
    }
}

// Fonctions utilitaires
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animation d'apparition
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 100);
    
    // Disparition après 3 secondes
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}