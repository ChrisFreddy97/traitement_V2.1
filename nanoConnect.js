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
    "PRENIUM",
    "CONGEL -10°C",
    "Eclairage Public 11h"
];

// Types de fichiers
const FILE_TYPES = {
    CREDIT: 'crédit',
    ENERGY: 'énergie',
    TENSION: 'tension',
    RECHARGE: 'recharge',
    EC: 'EC',
    EVNR: 'EvNR',
    FORFAIT: 'forfait'
};

// État de l'application
let currentFolder = null;
let currentFiles = [];
let currentFolderData = {
    nr: '',
    dateDebut: '',
    dateFin: '',
    forfaits: new Map() // Map client -> forfait (stocké avec numéro sans zéro)
};
let savedFolders = [];

// Éléments DOM
let extendedModal, closeModal, cancelModalBtn;
let selectFolderBtn, selectedFolderDiv, filesSection, filesListDiv;
let validateBtn, validationHint;
let backToHomeBtn, foldersListDiv, noFoldersMessage, folderSearchInput;
let extractedInfo, extractedDetails;
let forfaitInfo, forfaitDetails;
let filesSummary, summaryStats;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Système étendu initialisé');
    initializeApp();
});

function initializeApp() {
    initializeDOMElements();
    setupEventListeners();
    loadSavedFolders();
    console.log('✅ Système étendu prêt');
}

function initializeDOMElements() {
    // Modal elements
    extendedModal = document.getElementById('extended-modal');
    closeModal = document.querySelector('.close');
    cancelModalBtn = document.getElementById('cancel-modal-btn');
    
    // Form elements
    selectFolderBtn = document.getElementById('select-extended-folder-btn');
    selectedFolderDiv = document.getElementById('selected-folder');
    filesSection = document.getElementById('files-section');
    filesListDiv = document.getElementById('files-list');
    
    // Validation
    validateBtn = document.getElementById('validate-btn');
    validationHint = document.getElementById('validation-hint');
    
    // Main page elements
    backToHomeBtn = document.getElementById('back-to-home-btn');
    foldersListDiv = document.getElementById('folders-list');
    noFoldersMessage = document.getElementById('no-folders-message');
    folderSearchInput = document.getElementById('folder-search');
    
    // Info elements
    extractedInfo = document.getElementById('extracted-info');
    extractedDetails = document.getElementById('extracted-details');
    forfaitInfo = document.getElementById('forfait-info');
    forfaitDetails = document.getElementById('forfait-details');
    filesSummary = document.getElementById('files-summary');
    summaryStats = document.getElementById('summary-stats');

    console.log('✅ Éléments DOM initialisés');
}

function setupEventListeners() {
    // Modal events
    document.getElementById('import-extended-btn').addEventListener('click', openExtendedModal);
    closeModal.addEventListener('click', closeExtendedModal);
    cancelModalBtn.addEventListener('click', closeExtendedModal);
    
    // Form events
    selectFolderBtn.addEventListener('click', selectFolder);
    validateBtn.addEventListener('click', confirmFolderCreation);
    
    // Main page events
    backToHomeBtn.addEventListener('click', () => window.location.href = 'home.html');
    folderSearchInput.addEventListener('input', filterFoldersList);

    // Close modal when clicking outside
    extendedModal.addEventListener('click', (e) => {
        if (e.target === extendedModal) {
            closeExtendedModal();
        }
    });
}

// ==================== GESTION DU MODAL ====================

function openExtendedModal() {
    console.log('📋 Ouverture du modal système étendu');
    extendedModal.classList.remove('hidden');
    resetModalForm();
}

function closeExtendedModal() {
    console.log('🔒 Fermeture du modal');
    extendedModal.classList.add('hidden');
    resetModalForm();
}

function resetModalForm() {
    currentFolder = null;
    currentFiles = [];
    currentFolderData = {
        nr: '',
        dateDebut: '',
        dateFin: '',
        forfaits: new Map()
    };
    
    selectedFolderDiv.textContent = '';
    filesSection.classList.add('hidden');
    extractedInfo.classList.add('hidden');
    forfaitInfo.classList.add('hidden');
    filesSummary.classList.add('hidden');
    
    validateBtn.disabled = true;
    validationHint.innerHTML = `
        <div class="format-instruction">
            <strong>📝 Instructions:</strong><br>
            Sélectionnez un dossier au format <code>NR{numéro}_{jjMMyy}_{jjMMyy}</code><br>
            Exemple: <code>NR3599_070526_050626</code>
        </div>
    `;
    validationHint.classList.remove('warning');
    validationHint.classList.remove('success');
}

// ==================== EXTRACTION DES INFORMATIONS ====================

function extractFolderInfo(folderPath) {
    const folderName = folderPath.split(/[\\/]/).pop();
    console.log('🔍 Extraction des infos du dossier:', folderName);
    
    // Format: NR3599_070526_050626
    const match = folderName.match(/^NR(\d+)_(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
    
    if (!match) {
        return null;
    }
    
    const nr = match[1];
    const dateDebut = `${match[2]}/${match[3]}/${match[4]}`;
    const dateFin = `${match[5]}/${match[6]}/${match[7]}`;
    
    console.log(`✅ Extraits: NR=${nr}, Début=${dateDebut}, Fin=${dateFin}`);
    
    return { nr, dateDebut, dateFin, folderName };
}

function displayExtractedInfo(info) {
    extractedDetails.innerHTML = `
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            <div><strong>📌 Numéro NR:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px;">${info.nr}</code></div>
            <div><strong>📅 Date de début:</strong> ${info.dateDebut}</div>
            <div><strong>📅 Date de fin:</strong> ${info.dateFin}</div>
            <div><strong>📁 Nom du dossier:</strong> <code>${info.folderName}</code></div>
        </div>
    `;
    extractedInfo.classList.remove('hidden');
}

// ==================== SÉLECTION ET TRAITEMENT ====================

async function selectFolder() {
    try {
        console.log('🔍 Sélection du dossier...');
        
        const result = await window.electronAPI.selectFolder();
        
        if (result.success && result.folderPath) {
            await processSelectedFolder(result.folderPath);
        } else {
            showNotification(result.error || 'Aucun dossier sélectionné', 'error');
        }
    } catch (error) {
        console.error('❌ Erreur:', error);
        showNotification('Erreur: ' + error.message, 'error');
    }
}

async function processSelectedFolder(folderPath) {
    currentFolder = folderPath;
    selectedFolderDiv.innerHTML = `<strong>Dossier sélectionné:</strong> ${folderPath}`;
    
    // Extraire les informations
    const folderInfo = extractFolderInfo(folderPath);
    
    if (!folderInfo) {
        showNotification('❌ Format de dossier incorrect!', 'error');
        validationHint.innerHTML = `
            <div class="format-instruction warning">
                <strong>⚠️ Format incorrect!</strong><br>
                Format attendu: <code>NR{numéro}_{jjMMyy}_{jjMMyy}</code><br>
                Exemple: <code>NR3599_070526_050626</code>
            </div>
        `;
        validationHint.classList.add('warning');
        filesSection.classList.add('hidden');
        return;
    }
    
    // Stocker les informations
    currentFolderData = {
        nr: folderInfo.nr,
        dateDebut: folderInfo.dateDebut,
        dateFin: folderInfo.dateFin,
        forfaits: new Map()
    };
    
    // Afficher les infos extraites
    displayExtractedInfo(folderInfo);
    
    // Vérifier si le NR existe déjà
    const nrExists = savedFolders.some(folder => folder.nr === folderInfo.nr);
    if (nrExists) {
        showNotification(`⚠️ Attention: NR${folderInfo.nr} existe déjà!`, 'warning');
    }
    
    // Lire les fichiers
    try {
        const result = await window.electronAPI.readFolder(folderPath);
        
        if (result.success) {
            currentFiles = result.files;
            console.log('📄 Fichiers lus:', currentFiles.length);
            
            // Analyser les fichiers
            await analyzeFiles();
            
            // Afficher les fichiers
            displayFiles();
            displayFilesSummary();
            
            filesSection.classList.remove('hidden');
            updateValidationState();
        } else {
            throw new Error(result.error || 'Erreur lors de la lecture');
        }
    } catch (error) {
        console.error('❌ Erreur:', error);
        showNotification('Erreur: ' + error.message, 'error');
    }
}

// ==================== ANALYSE DES FICHIERS ====================

async function analyzeFiles() {
    console.log('🔄 Analyse des fichiers...');
    
    // Chercher et traiter le fichier de forfaits
    const forfaitFileName = `forfait_NR${currentFolderData.nr}.txt`;
    const forfaitFile = currentFiles.find(f => f.name === forfaitFileName);
    
    if (forfaitFile) {
        parseForfaitFile(forfaitFile.content);
        displayForfaitInfo();
    } else {
        console.log('⚠️ Aucun fichier de forfait trouvé');
    }
    
    // Analyser chaque fichier
    for (const file of currentFiles) {
        if (file.name === forfaitFileName) {
            file.type = FILE_TYPES.FORFAIT;
            continue;
        }
        
        analyzeFileName(file);
    }
}

function parseForfaitFile(content) {
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
        // Format: "Client 1: ECO" ou "Client 01: ECLAIRAGE"
        const match = line.match(/Client\s+(\d+)\s*:\s*(.+)/i);
        if (match) {
            let clientNum = match[1];
            // Enlever les zéros non significatifs (01 -> 1)
            clientNum = String(parseInt(clientNum, 10));
            const forfait = match[2].trim();
            
            // Vérifier si le forfait est valide
            if (FORFAITS.includes(forfait)) {
                currentFolderData.forfaits.set(clientNum, forfait);
                console.log(`📋 Client ${clientNum} -> Forfait: ${forfait}`);
            } else {
                console.warn(`⚠️ Forfait invalide pour client ${clientNum}: ${forfait}`);
            }
        }
    }
}

function displayForfaitInfo() {
    if (currentFolderData.forfaits.size === 0) {
        forfaitDetails.innerHTML = '<div style="color: #f44336;">⚠️ Aucun forfait trouvé dans le fichier</div>';
        forfaitInfo.classList.remove('hidden');
        return;
    }
    
    let html = '<div style="display: flex; flex-wrap: wrap; gap: 12px;">';
    // Trier les clients par numéro
    const sortedClients = Array.from(currentFolderData.forfaits.keys()).sort((a, b) => parseInt(a) - parseInt(b));
    for (const client of sortedClients) {
        const forfait = currentFolderData.forfaits.get(client);
        html += `
            <div class="client-forfait-card">
                <strong>👤 Client ${client}</strong>
                <span style="color: #4caf50;">→</span>
                <span style="background: #4caf50; color: white; padding: 2px 10px; border-radius: 15px; font-size: 12px;">${forfait}</span>
            </div>
        `;
    }
    html += '</div>';
    
    forfaitDetails.innerHTML = html;
    forfaitInfo.classList.remove('hidden');
}

function normalizeClientNumber(clientStr) {
    // Convertit "01" en "1", "02" en "2", etc.
    return String(parseInt(clientStr, 10));
}

function analyzeFileName(file) {
    const fileName = file.name;
    
    if (!fileName.endsWith('.txt')) return;
    
    const baseName = fileName.slice(0, -4);
    
    // Crédit client: C01_070526_050626.txt
    let match = baseName.match(/^C(\d+)_\d{6}_\d{6}$/);
    if (match) {
        file.type = FILE_TYPES.CREDIT;
        // Normaliser le numéro client (01 -> 1)
        const clientRaw = match[1];
        const clientNormalized = normalizeClientNumber(clientRaw);
        file.client = clientNormalized;
        file.forfait = currentFolderData.forfaits.get(clientNormalized) || '';
        console.log(`✅ Crédit client ${clientNormalized} (raw: ${clientRaw}) - Forfait: ${file.forfait || 'non défini'}`);
        return;
    }
    
    // Énergie client: E01_070526_050626.txt
    match = baseName.match(/^E(\d+)_\d{6}_\d{6}$/);
    if (match) {
        file.type = FILE_TYPES.ENERGY;
        const clientRaw = match[1];
        const clientNormalized = normalizeClientNumber(clientRaw);
        file.client = clientNormalized;
        file.forfait = currentFolderData.forfaits.get(clientNormalized) || '';
        console.log(`✅ Énergie client ${clientNormalized} (raw: ${clientRaw}) - Forfait: ${file.forfait || 'non défini'}`);
        return;
    }
    
    // Événement Client: EC_070526_050626.txt
    if (baseName.match(/^EC_\d{6}_\d{6}$/)) {
        file.type = FILE_TYPES.EC;
        console.log(`✅ EC détecté`);
        return;
    }
    
    // Événement NR: EvNR_070526_050626.txt
    if (baseName.match(/^EvNR_\d{6}_\d{6}$/)) {
        file.type = FILE_TYPES.EVNR;
        console.log(`✅ EvNR détecté`);
        return;
    }
    
    // Recharge: R_070526_050626.txt
    if (baseName.match(/^R_\d{6}_\d{6}$/)) {
        file.type = FILE_TYPES.RECHARGE;
        console.log(`✅ Recharge détecté`);
        return;
    }
    
    // Tension: T_070526_050626.txt
    if (baseName.match(/^T_\d{6}_\d{6}$/)) {
        file.type = FILE_TYPES.TENSION;
        console.log(`✅ Tension détecté`);
        return;
    }
    
    file.type = 'inconnu';
    console.log(`❌ Type non reconnu: ${fileName}`);
}

// ==================== AFFICHAGE ====================

function displayFiles() {
    filesListDiv.innerHTML = '';
    
    const validFiles = currentFiles.filter(f => f.type !== FILE_TYPES.FORFAIT && f.type !== 'inconnu');
    const unknownFiles = currentFiles.filter(f => f.type === 'inconnu' && f.name !== `forfait_NR${currentFolderData.nr}.txt`);
    
    const filesByType = {
        [FILE_TYPES.ENERGY]: validFiles.filter(f => f.type === FILE_TYPES.ENERGY),
        [FILE_TYPES.CREDIT]: validFiles.filter(f => f.type === FILE_TYPES.CREDIT),
        [FILE_TYPES.TENSION]: validFiles.filter(f => f.type === FILE_TYPES.TENSION),
        [FILE_TYPES.RECHARGE]: validFiles.filter(f => f.type === FILE_TYPES.RECHARGE),
        [FILE_TYPES.EC]: validFiles.filter(f => f.type === FILE_TYPES.EC),
        [FILE_TYPES.EVNR]: validFiles.filter(f => f.type === FILE_TYPES.EVNR)
    };
    
    Object.entries(filesByType).forEach(([type, typeFiles]) => {
        if (typeFiles.length > 0) {
            const typeHeader = document.createElement('div');
            typeHeader.className = 'type-header';
            
            let icon = '📄';
            if (type === FILE_TYPES.ENERGY) icon = '🔋';
            else if (type === FILE_TYPES.CREDIT) icon = '💰';
            else if (type === FILE_TYPES.TENSION) icon = '⚡';
            else if (type === FILE_TYPES.RECHARGE) icon = '🔄';
            else if (type === FILE_TYPES.EC) icon = '🔌';
            else if (type === FILE_TYPES.EVNR) icon = '📋';
            
            typeHeader.innerHTML = `<h4>${icon} ${type.toUpperCase()} (${typeFiles.length})</h4>`;
            filesListDiv.appendChild(typeHeader);
            
            typeFiles.forEach(file => {
                const fileCard = document.createElement('div');
                fileCard.className = `file-card ${file.type}`;
                
                let forfaitHtml = '';
                if (file.forfait) {
                    forfaitHtml = `<div class="file-forfait"><strong>Forfait:</strong> ${file.forfait} <span class="badge-auto">auto</span></div>`;
                }
                
                fileCard.innerHTML = `
                    <div class="file-name">📄 ${file.name}</div>
                    ${file.client ? `<div class="file-client"><strong>Client:</strong> ${file.client}</div>` : ''}
                    ${forfaitHtml}
                    <div class="file-details">
                        <div class="file-size">${formatFileSize(file.size)}</div>
                    </div>
                `;
                
                filesListDiv.appendChild(fileCard);
            });
        }
    });
    
    if (unknownFiles.length > 0) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'warning-message';
        warningDiv.innerHTML = `
            <div class="warning-content">
                <strong>⚠️ Attention:</strong> ${unknownFiles.length} fichier(s) ignoré(s)
            </div>
        `;
        filesListDiv.appendChild(warningDiv);
    }
}

function displayFilesSummary() {
    const validFiles = currentFiles.filter(f => f.type !== FILE_TYPES.FORFAIT && f.type !== 'inconnu');
    
    const stats = {
        [FILE_TYPES.ENERGY]: validFiles.filter(f => f.type === FILE_TYPES.ENERGY).length,
        [FILE_TYPES.CREDIT]: validFiles.filter(f => f.type === FILE_TYPES.CREDIT).length,
        [FILE_TYPES.TENSION]: validFiles.filter(f => f.type === FILE_TYPES.TENSION).length,
        [FILE_TYPES.RECHARGE]: validFiles.filter(f => f.type === FILE_TYPES.RECHARGE).length,
        [FILE_TYPES.EC]: validFiles.filter(f => f.type === FILE_TYPES.EC).length,
        [FILE_TYPES.EVNR]: validFiles.filter(f => f.type === FILE_TYPES.EVNR).length
    };
    
    let html = '';
    if (stats[FILE_TYPES.ENERGY] > 0) html += `<div class="stat-item">🔋 Énergie: ${stats[FILE_TYPES.ENERGY]}</div>`;
    if (stats[FILE_TYPES.CREDIT] > 0) html += `<div class="stat-item">💰 Crédit: ${stats[FILE_TYPES.CREDIT]}</div>`;
    if (stats[FILE_TYPES.TENSION] > 0) html += `<div class="stat-item">⚡ Tension: ${stats[FILE_TYPES.TENSION]}</div>`;
    if (stats[FILE_TYPES.RECHARGE] > 0) html += `<div class="stat-item">🔄 Recharge: ${stats[FILE_TYPES.RECHARGE]}</div>`;
    if (stats[FILE_TYPES.EC] > 0) html += `<div class="stat-item">🔌 EC: ${stats[FILE_TYPES.EC]}</div>`;
    if (stats[FILE_TYPES.EVNR] > 0) html += `<div class="stat-item">📋 EvNR: ${stats[FILE_TYPES.EVNR]}</div>`;
    
    if (html) {
        summaryStats.innerHTML = html;
        filesSummary.classList.remove('hidden');
    } else {
        filesSummary.classList.add('hidden');
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' octets';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

// ==================== VALIDATION ====================

function updateValidationState() {
    const validFiles = currentFiles.filter(f => f.type !== FILE_TYPES.FORFAIT && f.type !== 'inconnu');
    const hasValidFile = validFiles.length > 0;
    
    // Vérifier l'unicité des fichiers
    const tensionFiles = currentFiles.filter(f => f.type === FILE_TYPES.TENSION);
    const rechargeFiles = currentFiles.filter(f => f.type === FILE_TYPES.RECHARGE);
    const ecFiles = currentFiles.filter(f => f.type === FILE_TYPES.EC);
    const evnrFiles = currentFiles.filter(f => f.type === FILE_TYPES.EVNR);
    
    const hasUniqueTension = tensionFiles.length <= 1;
    const hasUniqueRecharge = rechargeFiles.length <= 1;
    const hasUniqueEC = ecFiles.length <= 1;
    const hasUniqueEvNR = evnrFiles.length <= 1;
    
    // Récupérer les clients présents dans les fichiers
    const clientsInFiles = new Set();
    for (const file of validFiles) {
        if (file.client) {
            clientsInFiles.add(file.client);
        }
    }
    
    // Vérifier que tous les clients présents dans les fichiers ont un forfait
    let allClientsHaveForfait = true;
    const missingClients = [];
    for (const client of clientsInFiles) {
        if (!currentFolderData.forfaits.has(client)) {
            allClientsHaveForfait = false;
            missingClients.push(client);
        }
    }
    
    let problems = [];
    let successes = [];
    
    if (!currentFolderData.nr) {
        problems.push("❌ Numéro NR non détecté");
    } else {
        successes.push(`✅ Numéro NR: ${currentFolderData.nr}`);
    }
    
    if (!currentFolderData.dateDebut || !currentFolderData.dateFin) {
        problems.push("❌ Période non détectée");
    } else {
        successes.push(`✅ Période: ${currentFolderData.dateDebut} → ${currentFolderData.dateFin}`);
    }
    
    if (!hasValidFile) {
        problems.push("❌ Au moins un fichier valide requis");
    } else {
        successes.push(`✅ ${validFiles.length} fichier(s) valide(s)`);
    }
    
    if (!hasUniqueTension) problems.push(`❌ Fichier tension doit être unique (${tensionFiles.length} trouvés)`);
    if (!hasUniqueRecharge) problems.push(`❌ Fichier recharge doit être unique (${rechargeFiles.length} trouvés)`);
    if (!hasUniqueEC) problems.push(`❌ Fichier EC doit être unique (${ecFiles.length} trouvés)`);
    if (!hasUniqueEvNR) problems.push(`❌ Fichier EvNR doit être unique (${evnrFiles.length} trouvés)`);
    
    // Vérification des forfaits
    if (clientsInFiles.size > 0) {
        if (!allClientsHaveForfait) {
            problems.push(`❌ Clients sans forfait dans le fichier: ${missingClients.join(', ')}`);
            problems.push(`💡 Vérifiez que le fichier forfait_NR${currentFolderData.nr}.txt contient ces clients`);
        } else {
            successes.push(`✅ ${clientsInFiles.size} client(s) avec forfait (auto)`);
        }
    }
    
    if (currentFolderData.forfaits.size === 0 && clientsInFiles.size > 0) {
        problems.push(`❌ Aucun forfait chargé - fichier forfait_NR${currentFolderData.nr}.txt manquant ou invalide`);
    } else if (currentFolderData.forfaits.size > 0) {
        successes.push(`✅ ${currentFolderData.forfaits.size} forfait(s) chargé(s) depuis le fichier`);
    }
    
    validationHint.innerHTML = `<div class="validation-summary">${[...problems, ...successes].join('<br>')}</div>`;
    
    if (problems.length > 0) {
        validationHint.classList.add('warning');
        validationHint.classList.remove('success');
    } else {
        validationHint.classList.remove('warning');
        validationHint.classList.add('success');
    }
    
    // La validation est réussie si tous les clients ont un forfait
    const isValid = hasValidFile && 
                    hasUniqueTension && 
                    hasUniqueRecharge && 
                    hasUniqueEC && 
                    hasUniqueEvNR && 
                    currentFolderData.nr !== '' &&
                    (clientsInFiles.size === 0 || (allClientsHaveForfait && currentFolderData.forfaits.size > 0));
    
    validateBtn.disabled = !isValid;
    
    if (validateBtn.disabled) {
        validateBtn.classList.add('btn-warning');
        validateBtn.classList.remove('btn-success');
        validateBtn.textContent = 'Créer le dossier';
    } else {
        validateBtn.classList.remove('btn-warning');
        validateBtn.classList.add('btn-success');
        validateBtn.textContent = `Créer le dossier NR${currentFolderData.nr}`;
    }
}

// ==================== CRÉATION ====================

async function confirmFolderCreation() {
    if (!currentFolderData.nr || validateBtn.disabled) {
        showNotification('Veuillez corriger les problèmes avant de créer', 'error');
        return;
    }
    
    const isConfirmed = await askFinalConfirmation();
    if (!isConfirmed) return;
    
    const validFiles = currentFiles.filter(f => f.type !== FILE_TYPES.FORFAIT && f.type !== 'inconnu');
    
    // Date d'ajout au moment de la création
    const now = new Date();
    const dateAdded = now.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const folderData = {
        nr: currentFolderData.nr,
        date: new Date().toLocaleString('fr-FR'),
        dateAdded: dateAdded,  // Nouvelle propriété pour la date d'ajout
        timestamp: now.getTime(), // Pour le tri
        files: validFiles,
        folderPath: currentFolder,
        importFormat: 'extended',
        periode: {
            debut: currentFolderData.dateDebut,
            fin: currentFolderData.dateFin
        },
        forfaits: Object.fromEntries(currentFolderData.forfaits)
    };
    
    try {
        const storageKey = `analysis_${currentFolderData.nr}`;
        localStorage.setItem(storageKey, JSON.stringify(folderData));
        
        const newFolder = {
            nr: currentFolderData.nr,
            date: folderData.date,
            dateAdded: dateAdded,
            timestamp: now.getTime(),
            filesCount: validFiles.length,
            folderPath: currentFolder,
            periode: folderData.periode
        };
        
        savedFolders = savedFolders.filter(f => f.nr !== currentFolderData.nr);
        savedFolders.unshift(newFolder);
        
        displayFoldersList();
        closeExtendedModal();
        showNotification(`✅ Dossier NR${currentFolderData.nr} créé avec succès !`, 'success');
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        showNotification('Erreur: ' + error.message, 'error');
    }
}

function askFinalConfirmation() {
    return new Promise((resolve) => {
        const validFiles = currentFiles.filter(f => f.type !== FILE_TYPES.FORFAIT && f.type !== 'inconnu');
        const types = [...new Set(validFiles.map(f => f.type))];
        
        let forfaitsHtml = '';
        if (currentFolderData.forfaits.size > 0) {
            forfaitsHtml = '<li>📋 Forfaits chargés: ' + currentFolderData.forfaits.size + ' client(s)</li>';
        }
        
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay';
        confirmModal.innerHTML = `
            <div class="modal confirm-modal final-confirm">
                <div class="modal-header">
                    <h3>Confirmation - Système Étendu</h3>
                </div>
                <div class="modal-body">
                    <div class="confirm-content">
                        <p>Création du dossier <strong>NR${currentFolderData.nr}</strong></p>
                        <div class="creation-summary">
                            <ul>
                                <li>📅 Période: ${currentFolderData.dateDebut} → ${currentFolderData.dateFin}</li>
                                <li>📄 Fichiers: ${validFiles.length}</li>
                                <li>⚡ Types: ${types.join(', ')}</li>
                                ${forfaitsHtml}
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="confirm-final-yes" class="btn btn-success">✅ Confirmer</button>
                    <button id="confirm-final-no" class="btn btn-danger">❌ Annuler</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmModal);
        
        confirmModal.querySelector('#confirm-final-yes').onclick = () => {
            document.body.removeChild(confirmModal);
            resolve(true);
        };
        confirmModal.querySelector('#confirm-final-no').onclick = () => {
            document.body.removeChild(confirmModal);
            resolve(false);
        };
        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) {
                document.body.removeChild(confirmModal);
                resolve(false);
            }
        };
    });
}

// ==================== GESTION DES DOSSIERS ====================

function loadSavedFolders() {
    savedFolders = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('analysis_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data.importFormat === 'extended' || data.periode) {
                    savedFolders.push({
                        nr: data.nr,
                        date: data.date,
                        dateAdded: data.dateAdded || data.date, // Pour compatibilité avec anciens dossiers
                        timestamp: data.timestamp || new Date(data.date).getTime(),
                        filesCount: data.files ? data.files.length : 0,
                        folderPath: data.folderPath || 'Non spécifié',
                        periode: data.periode || null
                    });
                }
            } catch (error) {
                console.error('❌ Erreur:', error);
            }
        }
    }
    
    displayFoldersList();
}

function formatDateAdded(dateAdded) {
    if (!dateAdded) return '-';
    
    // Si c'est déjà une chaîne formatée
    if (typeof dateAdded === 'string' && dateAdded.includes('/')) {
        return dateAdded;
    }
    
    // Sinon, formater
    try {
        const date = new Date(dateAdded);
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateAdded;
    }
}

function displayFoldersList() {
    foldersListDiv.innerHTML = '';
    
    if (savedFolders.length === 0) {
        noFoldersMessage.style.display = 'block';
        return;
    }
    
    noFoldersMessage.style.display = 'none';
    // Trier par timestamp (plus récent en premier)
    savedFolders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    for (const folder of savedFolders) {
        const row = document.createElement('tr');
        
        let periodeHtml = '';
        
        const formattedDateAdded = formatDateAdded(folder.dateAdded);
        
        row.innerHTML = `
            <td>
                <span class="folder-icon">📁</span>
                <span class="folder-name">NR${folder.nr}</span>
                ${periodeHtml}
            </td>
            <td>${folder.periode ? `${folder.periode.debut} → ${folder.periode.fin}` : '-'}</td>
            <td>${folder.filesCount} fichier(s)</td>
            <td class="date-added">${folder.date || '-'}</td>
            <td class="date-added">${formattedDateAdded}</td>
            <td class="folder-actions-cell">
                <button class="btn btn-primary btn-small analyze-btn" data-nr="${folder.nr}">📊 Analyser</button>
                <button class="btn btn-danger btn-small delete-btn" data-nr="${folder.nr}">🗑️ Supprimer</button>
            </td>
        `;
        
        foldersListDiv.appendChild(row);
    }
    
    document.querySelectorAll('.analyze-btn').forEach(btn => {
        btn.addEventListener('click', () => analyzeExistingFolder(btn.dataset.nr));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteFolder(btn.dataset.nr));
    });
}

function filterFoldersList() {
    const searchTerm = folderSearchInput.value.toLowerCase().trim();
    const rows = foldersListDiv.querySelectorAll('tr');
    
    let visible = 0;
    for (const row of rows) {
        const nrText = row.querySelector('.folder-name')?.textContent.toLowerCase() || '';
        const isVisible = nrText.includes(searchTerm);
        row.style.display = isVisible ? '' : 'none';
        if (isVisible) visible++;
    }
    
    noFoldersMessage.style.display = visible === 0 && savedFolders.length > 0 ? 'block' : 'none';
}

function deleteFolder(nr) {
    if (confirm(`Supprimer définitivement NR${nr} ?`)) {
        localStorage.removeItem(`analysis_${nr}`);
        loadSavedFolders();
        showNotification(`Dossier NR${nr} supprimé`, 'success');
    }
}

function analyzeExistingFolder(nr) {
    window.location.href = `nanoConnectAnalysis.html?nr=${nr}`;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.opacity = '1', 100);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}