// ==================== VARIABLES GLOBALES ====================

let uploadedFolders = [];
let currentSelectedFolder = null;
let folderStructure = null;
let selectedFiles = new Set();
let detectedNrNumber = null;

// Éléments DOM
let openUploadModalBtn, uploadFolderModal, closeModal, cancelUploadModalBtn;
let selectFolderBtn, selectedFolderInfo, folderAnalysisSection;
let folderNameInput, validateUploadBtn; // RETIRÉ: folderDescriptionInput 
let foldersListDiv, noFoldersMessage, folderSearchInput;
let subfolderCountEl, fileCountEl, selectedFilesCountEl, folderTreeEl;
let progressContainer, progressFill, progressText;
let folderDetailsModal, closeDetailsModal, closeDetailsBtn, deleteFolderBtn;
let detailsFolderName, detailsDate, detailsFileCount, detailsSize, detailsFileList; // RETIRÉ: detailsDescription
let selectAllFilesBtn, deselectAllFilesBtn, selectLastThreeBtn;
let nrExtractionInfo, detectedNrEl, useDetectedNrBtn;
let nrConfirmationModal, confirmNrYesBtn, confirmNrNoBtn, confirmationNrNumberEl;

const ALLOWED_DATA_DIRS = ['ENERGIE', 'EVENT', 'INT', 'RECHARGE', 'SOLDE', 'TENS'];

// Gestion confirmation NR (une seule confirmation par valeur)
let nrConfirmedValue = null; // ex: "NR1234"
let pendingUploadAfterNrConfirm = false;
let pendingNrValue = null; // ex: "NR1234"

// ==================== INITIALISATION ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Module Upload Dossier initialisé');
    initializeApp();
});

function initializeApp() {
    initializeDOMElements();
    setupEventListeners();
    loadUploadedFolders();
    updateStats();
    console.log('✅ Application Upload Dossier prête');
}

function initializeDOMElements() {
    // Modal elements
    openUploadModalBtn = document.getElementById('open-upload-modal-btn');
    uploadFolderModal = document.getElementById('upload-folder-modal');
    closeModal = uploadFolderModal.querySelector('.close');
    cancelUploadModalBtn = document.getElementById('cancel-upload-modal-btn');
    
    // Upload section
    selectFolderBtn = document.getElementById('select-folder-btn');
    selectedFolderInfo = document.getElementById('selected-folder-info');
    folderAnalysisSection = document.getElementById('folder-analysis-section');
    
    // Form inputs
    folderNameInput = document.getElementById('folder-name-input');
    validateUploadBtn = document.getElementById('validate-upload-btn');
    
    // Folder list
    foldersListDiv = document.getElementById('folders-list');
    noFoldersMessage = document.getElementById('no-folders-message');
    folderSearchInput = document.getElementById('folder-search');
    
    // Analysis elements
    subfolderCountEl = document.getElementById('subfolder-count');
    fileCountEl = document.getElementById('file-count');
    selectedFilesCountEl = document.getElementById('selected-files-count');
    folderTreeEl = document.getElementById('folder-tree');
    
    // Progress
    progressContainer = document.getElementById('progress-container');
    progressFill = document.getElementById('progress-fill');
    progressText = document.getElementById('progress-text');
    
    // Selection buttons
    selectAllFilesBtn = document.getElementById('select-all-files-btn');
    deselectAllFilesBtn = document.getElementById('deselect-all-files-btn');
    selectLastThreeBtn = document.getElementById('select-last-three-btn');
    
    // NR extraction elements
    nrExtractionInfo = document.getElementById('nr-extraction-info');
    detectedNrEl = document.getElementById('detected-nr');
    useDetectedNrBtn = document.getElementById('use-detected-nr-btn');
    
    // NR confirmation modal
    nrConfirmationModal = document.getElementById('nr-confirmation-modal');
    confirmNrYesBtn = document.getElementById('confirm-nr-yes');
    confirmNrNoBtn = document.getElementById('confirm-nr-no');
    confirmationNrNumberEl = document.getElementById('confirmation-nr-number');
    
    // Details modal
    folderDetailsModal = document.getElementById('folder-details-modal');
    closeDetailsModal = folderDetailsModal.querySelector('.close-details');
    deleteFolderBtn = document.getElementById('delete-folder-btn');
    detailsFolderName = document.getElementById('details-folder-name');
    detailsDate = document.getElementById('details-date');
    detailsFileCount = document.getElementById('details-file-count');
    detailsSize = document.getElementById('details-size');
    detailsFileList = document.getElementById('details-file-list');
    
    // Back button
    const backBtn = document.getElementById('back-to-home-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
}
function setupEventListeners() {
    // Modal
    openUploadModalBtn.addEventListener('click', openUploadModal);
    closeModal.addEventListener('click', closeUploadModal);
    cancelUploadModalBtn.addEventListener('click', closeUploadModal);
    uploadFolderModal.addEventListener('click', (e) => {
        if (e.target === uploadFolderModal) closeUploadModal();
    });
    
    // Upload
    selectFolderBtn.addEventListener('click', selectFolder);
    folderNameInput.addEventListener('input', () => {
        // Si l'utilisateur modifie le NR, on invalide la confirmation précédente
        nrConfirmedValue = null;
        validateForm();
    });
    validateUploadBtn.addEventListener('click', uploadFolder);
    
    // Selection buttons
    selectAllFilesBtn.addEventListener('click', selectAllFiles);
    deselectAllFilesBtn.addEventListener('click', deselectAllFiles);
    selectLastThreeBtn.addEventListener('click', selectLastThreeFiles);
    
    // NR buttons
    useDetectedNrBtn.addEventListener('click', useDetectedNr);
    confirmNrYesBtn.addEventListener('click', confirmNrYes);
    confirmNrNoBtn.addEventListener('click', confirmNrNo);
    
    // Search
    folderSearchInput.addEventListener('input', filterFoldersList);
    
    // Details modal
    closeDetailsModal.addEventListener('click', closeFolderDetailsModal);
    folderDetailsModal.addEventListener('click', (e) => {
        if (e.target === folderDetailsModal) closeFolderDetailsModal();
    });
    deleteFolderBtn.addEventListener('click', deleteFolder);
    
    // Close details button
    const closeDetailsBtn = document.querySelector('.close-details-btn');
    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', closeFolderDetailsModal);
    }
}

// ==================== MODAL UPLOAD ====================

function openUploadModal() {
    uploadFolderModal.classList.remove('hidden');
    resetUploadForm();
}

function closeUploadModal() {
    uploadFolderModal.classList.add('hidden');
    resetUploadForm();
}

function resetUploadForm() {
    currentSelectedFolder = null;
    folderStructure = null;
    selectedFiles.clear();
    detectedNrNumber = null;
    nrConfirmedValue = null;
    pendingUploadAfterNrConfirm = false;
    pendingNrValue = null;
    selectedFolderInfo.innerHTML = '';
    folderAnalysisSection.classList.remove('show');
    folderNameInput.value = '';
    validateUploadBtn.disabled = true;
    progressContainer.classList.remove('show');
    selectedFilesCountEl.textContent = '0';
    nrExtractionInfo.style.display = 'none';
}

// ==================== EXTRACTION DU NR ====================

function extractNrFromFolderName(folderPath) {
    const folderName = folderPath.split(/[\\/]/).pop();
    
    console.log('📁 Nom du dossier analysé:', folderName);
    
    const nrRegex = /NR(\d{1,4})/i;
    const match = folderName.match(nrRegex);
    
    if (match) {
        const nrNumber = match[1];
        console.log('✅ NR détecté:', nrNumber);
        return {
            success: true,
            nrNumber: nrNumber,
            fullMatch: match[0]
        };
    }
    
    const alternativeRegexes = [
        /(\d{1,4})NR/i,
        /NR[_-]?(\d{1,4})/i,
        /(\d{1,4})[_-]?NR/i,
        /^(\d{1,4})$/
    ];
    
    for (const regex of alternativeRegexes) {
        const altMatch = folderName.match(regex);
        if (altMatch) {
            const nrNumber = altMatch[1] || altMatch[0];
            console.log('✅ NR détecté (format alternatif):', nrNumber);
            return {
                success: true,
                nrNumber: nrNumber,
                fullMatch: altMatch[0]
            };
        }
    }
    
    console.log('❌ Aucun NR détecté dans:', folderName);
    return {
        success: false,
        error: 'Aucun format NR détecté dans le nom du dossier'
    };
}

function displayDetectedNr(nrInfo) {
    detectedNrNumber = nrInfo.nrNumber;
    detectedNrEl.textContent = `NR${nrInfo.nrNumber}`;
    nrExtractionInfo.style.display = 'block';
    
    folderNameInput.value = `NR${nrInfo.nrNumber}`;
    
    validateForm();
    
    setTimeout(() => {
        showNrConfirmationModal(nrInfo.nrNumber);
    }, 500);
}

function useDetectedNr() {
    if (detectedNrNumber) {
        folderNameInput.value = `NR${detectedNrNumber}`;
        validateForm();
        showSuccessMessage(`N°NR ${detectedNrNumber} appliqué`);
    }
}

// ==================== MODAL DE CONFIRMATION NR ====================

function showNrConfirmationModal(nrNumber) {
    confirmationNrNumberEl.textContent = nrNumber;
    nrConfirmationModal.classList.remove('hidden');
}

function closeNrConfirmationModal() {
    nrConfirmationModal.classList.add('hidden');
}

function confirmNrYes() {
    const current = normalizeNrInput(folderNameInput.value);
    console.log('✅ Utilisateur a confirmé le NR:', current);
    closeNrConfirmationModal();
    nrConfirmedValue = current;

    // Si on était en train de valider un upload, on continue directement
    if (pendingUploadAfterNrConfirm) {
        pendingUploadAfterNrConfirm = false;
        const nrToUse = pendingNrValue || current;
        pendingNrValue = null;
        void uploadFolderCore(nrToUse);
        return;
    }

    const nrNumber = current.replace(/NR/i, '');
    showSuccessMessage(`N°NR ${nrNumber} confirmé`);
}

function confirmNrNo() {
    console.log('❌ Utilisateur veut modifier le NR');
    closeNrConfirmationModal();
    nrConfirmedValue = null;
    pendingUploadAfterNrConfirm = false;
    pendingNrValue = null;
    folderNameInput.focus();
    folderNameInput.select();
}

// ==================== SÉLECTION DOSSIER ====================

async function selectFolder() {
    try {
        console.log('📂 Sélection d\'un dossier...');
        
        const result = await window.electronAPI.selectFolder();
        
        if (!result.success) {
            showErrorMessage(result.error || 'Erreur lors de la sélection');
            return;
        }
        
        const folderPath = result.folderPath;
        console.log('✅ Dossier sélectionné:', folderPath);
        
        const nrResult = extractNrFromFolderName(folderPath);
        
        await readFolderStructure(folderPath);
        
        currentSelectedFolder = folderPath;
        displaySelectedFolder();
        
        if (nrResult.success) {
            displayDetectedNr(nrResult);
        } else {
            showWarningMessage(`Aucun NR détecté dans le nom du dossier. Veuillez saisir manuellement le N°NR. Format attendu: "NR" suivi de chiffres (ex: NR3125)`);
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        showErrorMessage(error.message);
    }
}

async function readFolderStructure(folderPath) {
    try {
        console.log('📂 Lecture de la structure du dossier...');
        
        const result = await window.electronAPI.uploadFolderStructure(folderPath);
        
        if (!result.success) {
            throw new Error(result.error || 'Erreur lors de la lecture du dossier');
        }
        
        folderStructure = result.structure;
        
        await addFileDatesToStructure(folderStructure, folderPath);
        
        console.log('✅ Structure lue avec dates');
        
        displayFolderAnalysis(result);
        
    } catch (error) {
        console.error('❌ Erreur lecture:', error);
        throw error;
    }
}

async function addFileDatesToStructure(structure, basePath) {
  if (structure.files && structure.files.length > 0) {
    structure.filesWithDates = await Promise.all(
      structure.files.map(async (filename) => {
        try {
          const filePath = `${basePath}/${filename}`;
          const dateResult = await window.electronAPI.getFileDate(filePath);
          
          return {
            name: filename,
            date: dateResult.success ? dateResult.date : 'Date inconnue',
            timestamp: dateResult.success ? new Date(dateResult.date).getTime() : 0
          };
        } catch (error) {
          console.warn(`⚠️ Erreur lecture date pour ${filename}:`, error.message);
          return {
            name: filename,
            date: 'Date inconnue',
            timestamp: 0
          };
        }
      })
    );
    
    // Tri: par numéro croissant (ENERGIE2 < ENERGIE10), puis fallback
    structure.filesWithDates.sort((a, b) => compareDataFilenames(a.name, b.name));
  }
  
  if (structure.subdirs && structure.subdirs.length > 0) {
    for (const subdir of structure.subdirs) {
      const subdirPath = `${basePath}/${subdir.name}`;
      await addFileDatesToStructure(subdir, subdirPath);
    }
  }
}

function parseDataFilename(filename) {
  const m = String(filename).match(/^(ENERGIE|EVENT|INT|RECHARGE|SOLDE|TENS)\s*(\d+)\.txt$/i);
  if (!m) return null;
  return { type: m[1].toUpperCase(), num: Number(m[2]) };
}

function compareDataFilenames(aName, bName) {
  const a = parseDataFilename(aName);
  const b = parseDataFilename(bName);

  // Si on est bien sur des fichiers typés, on trie numériquement croissant
  if (a && b && a.type === b.type) {
    const diff = a.num - b.num;
    if (diff !== 0) return diff;
  }

  // Sinon, tri "naturel" (ENERGIE2 < ENERGIE10) + insensitive
  return String(aName).localeCompare(String(bName), 'fr-FR', { numeric: true, sensitivity: 'base' });
}

function buildFileIndexFromStructure(structure, basePath) {
  const index = new Map();

  function walk(node, currentPath) {
    if (node?.filesWithDates?.length) {
      for (const f of node.filesWithDates) {
        const absPath = `${currentPath}/${f.name}`;
        index.set(absPath, {
          name: f.name,
          date: f.date,
          timestamp: f.timestamp
        });
      }
    }

    if (node?.subdirs?.length) {
      for (const sub of node.subdirs) {
        walk(sub, `${currentPath}/${sub.name}`);
      }
    }
  }

  walk(structure, basePath);
  return index;
}

function displaySelectedFolder() {
    const folderName = currentSelectedFolder.split('\\').pop();
    selectedFolderInfo.innerHTML = `
        <div class="success-message">
            ✅ Dossier sélectionné: <strong>${folderName}</strong><br>
            <small>${currentSelectedFolder}</small>
        </div>
    `;
}

function displayFolderAnalysis(analysisData) {
    subfolderCountEl.textContent = analysisData.totalSubfolders;
    fileCountEl.textContent = analysisData.totalFiles;
    selectedFilesCountEl.textContent = '0';
    
    displayFolderTreeWithCheckboxes(folderStructure, currentSelectedFolder);
    
    folderAnalysisSection.classList.add('show');

    // Par défaut: sélectionner tous les fichiers automatiquement (sans popup)
    selectAllFiles({ silent: true });
    
    validateForm();
}

function displayFolderTreeWithCheckboxes(structure, basePath, indent = '') {
    let html = '';

    const allowedFoldersSet = new Set(ALLOWED_DATA_DIRS);
    
    function renderSubdir(subdir, path, level = 0) {
        if (!allowedFoldersSet.has(String(subdir.name).toUpperCase())) {
            return;
        }
        
        const currentPath = path ? `${path}/${subdir.name}` : subdir.name;
        
        html += `<div class="tree-folder-item">`;
        html += `<div class="tree-folder-header">`;
        html += `<span>📁 ${subdir.name}</span>`;
        html += `<span class="tree-folder-name"></span>`;
        
        if (subdir.filesWithDates && subdir.filesWithDates.length > 0) {
            html += `<label class="checkbox-container folder-checkbox">
                <input type="checkbox" class="folder-select-all" data-folder-path="${currentPath}">
                <span class="checkmark"></span>
                <span style="margin-left: 5px; font-size: 11px;">Tout sélectionner</span>
            </label>`;
        }
        
        html += `</div>`;
        
        if (subdir.filesWithDates && subdir.filesWithDates.length > 0) {
            html += `<div class="tree-files-list">`;
            
            subdir.filesWithDates.forEach((file) => {
                const filePath = `${currentPath}/${file.name}`;
                const displayPath = filePath.replace(basePath + '/', '');
                const formattedDate = file.date !== 'Date inconnue' 
                    ? new Date(file.date).toLocaleDateString('fr-FR') 
                    : 'Date inconnue';
                
                html += `<div class="tree-file-item">`;
                html += `<label class="checkbox-container file-checkbox">
                    <input type="checkbox" class="file-select" 
                           data-file-path="${filePath}" 
                           data-display-path="${displayPath}">
                    <span class="checkmark"></span>
                </label>`;
                html += `<span class="file-name">📄 ${file.name}</span>`;
                html += `<span class="file-date">${formattedDate}</span>`;
                html += `</div>`;
            });
            
            html += `</div>`;
        } else {
            html += `<div class="no-files-message">Aucun fichier .txt</div>`;
        }
        
        if (subdir.subdirs && subdir.subdirs.length > 0) {
            subdir.subdirs.forEach(subsubdir => {
                renderSubdir(subsubdir, currentPath, level + 1);
            });
        }
        
        html += `</div>`;
    }
    
    if (structure.subdirs && structure.subdirs.length > 0) {
        const filteredSubdirs = structure.subdirs.filter(subdir =>
            allowedFoldersSet.has(String(subdir.name).toUpperCase())
        );
        
        filteredSubdirs.forEach(subdir => {
            renderSubdir(subdir, basePath);
        });
    }
    
    folderTreeEl.innerHTML = html;
    
    addCheckboxEventListeners();
}

function addCheckboxEventListeners() {
    const fileCheckboxes = document.querySelectorAll('.file-select');
    fileCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const filePath = this.dataset.filePath;
            const displayPath = this.dataset.displayPath;
            
            if (this.checked) {
                selectedFiles.add({
                    path: filePath,
                    displayPath: displayPath
                });
            } else {
                for (const file of selectedFiles) {
                    if (file.path === filePath) {
                        selectedFiles.delete(file);
                        break;
                    }
                }
            }
            
            updateSelectedFilesCount();
            validateForm();
            updateFolderCheckboxes();
        });
    });
    
    const folderCheckboxes = document.querySelectorAll('.folder-select-all');
    folderCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const folderPath = this.dataset.folderPath;
            const folderItem = this.closest('.tree-folder-item');
            const fileCheckboxesInFolder = folderItem.querySelectorAll('.file-select');
            
            fileCheckboxesInFolder.forEach(fileCheckbox => {
                const filePath = fileCheckbox.dataset.filePath;
                const displayPath = fileCheckbox.dataset.displayPath;
                
                if (this.checked) {
                    fileCheckbox.checked = true;
                    selectedFiles.add({
                        path: filePath,
                        displayPath: displayPath
                    });
                } else {
                    fileCheckbox.checked = false;
                    for (const file of selectedFiles) {
                        if (file.path === filePath) {
                            selectedFiles.delete(file);
                            break;
                        }
                    }
                }
            });
            
            updateSelectedFilesCount();
            validateForm();
        });
    });
}

// ==================== SÉLECTION DE FICHIERS ====================

function selectAllFiles(options = {}) {
    const { silent = false } = options;
    const fileCheckboxes = document.querySelectorAll('.file-select');
    fileCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
        const filePath = checkbox.dataset.filePath;
        const displayPath = checkbox.dataset.displayPath;
        
        let alreadySelected = false;
        for (const file of selectedFiles) {
            if (file.path === filePath) {
                alreadySelected = true;
                break;
            }
        }
        
        if (!alreadySelected) {
            selectedFiles.add({
                path: filePath,
                displayPath: displayPath
            });
        }
    });
    
    const folderCheckboxes = document.querySelectorAll('.folder-select-all');
    folderCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    updateSelectedFilesCount();
    validateForm();
    if (!silent) {
        showSuccessMessage(`${selectedFiles.size} fichiers sélectionnés`);
    }
}

function deselectAllFiles() {
    const fileCheckboxes = document.querySelectorAll('.file-select');
    fileCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    const folderCheckboxes = document.querySelectorAll('.folder-select-all');
    folderCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    selectedFiles.clear();
    updateSelectedFilesCount();
    validateForm();
    showSuccessMessage('Tous les fichiers désélectionnés');
}

function selectLastThreeFiles() {
    deselectAllFiles();
    
    const allowedFoldersSet = new Set(ALLOWED_DATA_DIRS);
    
    function selectLastThreeInStructure(structure) {
        if (!allowedFoldersSet.has(String(structure.name).toUpperCase())) {
            return;
        }
        
        if (structure.filesWithDates && structure.filesWithDates.length > 0) {
            const lastThreeFiles = structure.filesWithDates.slice(-3);
            
            console.log(`Dans ${structure.name}, sélection des 3 derniers fichiers:`, 
                lastThreeFiles.map(f => f.name));
            
            lastThreeFiles.forEach(file => {
                const folderName = structure.name === folderStructure.name ? '' : structure.name;
                const filePath = folderName ? 
                    `${currentSelectedFolder}/${folderName}/${file.name}` :
                    `${currentSelectedFolder}/${file.name}`;
                
                const checkbox = document.querySelector(`.file-select[data-file-path*="${file.name}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                    selectedFiles.add({
                        path: checkbox.dataset.filePath,
                        displayPath: checkbox.dataset.displayPath
                    });
                }
            });
        }
        
        if (structure.subdirs && structure.subdirs.length > 0) {
            structure.subdirs.forEach(subdir => {
                if (!systemFolders.includes(subdir.name)) {
                    selectLastThreeInStructure(subdir);
                }
            });
        }
    }
    
    selectLastThreeInStructure(folderStructure);
    
    updateSelectedFilesCount();
    updateFolderCheckboxes();
    validateForm();
    showSuccessMessage(`Les 3 derniers fichiers de chaque dossier ont été sélectionnés (${selectedFiles.size} fichiers)`);
}

function updateFolderCheckboxes() {
    const folderItems = document.querySelectorAll('.tree-folder-item');
    
    folderItems.forEach(folderItem => {
        const folderCheckbox = folderItem.querySelector('.folder-select-all');
        if (!folderCheckbox) return;
        
        const fileCheckboxesInFolder = folderItem.querySelectorAll('.file-select');
        if (fileCheckboxesInFolder.length === 0) return;
        
        let selectedCount = 0;
        fileCheckboxesInFolder.forEach(checkbox => {
            if (checkbox.checked) selectedCount++;
        });
        
        if (selectedCount === 0) {
            folderCheckbox.checked = false;
            folderCheckbox.indeterminate = false;
        } else if (selectedCount === fileCheckboxesInFolder.length) {
            folderCheckbox.checked = true;
            folderCheckbox.indeterminate = false;
        } else {
            folderCheckbox.checked = false;
            folderCheckbox.indeterminate = true;
        }
    });
}

function updateSelectedFilesCount() {
    selectedFilesCountEl.textContent = selectedFiles.size;
}

// ==================== VALIDATION FORMULAIRE ====================

function validateForm() {
    const nrValue = folderNameInput.value.trim();
    const hasValidNr = validateNrFormat(nrValue);
    const hasFolder = currentSelectedFolder !== null;
    const hasSelectedFiles = selectedFiles.size > 0;
    
    validateUploadBtn.disabled = !(hasValidNr && hasFolder && hasSelectedFiles);
    
    const hint = document.getElementById('upload-validation-hint');
    if (!hasValidNr) {
        hint.textContent = 'Format NR incorrect. Utilisez "NR" suivi de 1 à 4 chiffres (ex: NR3125)';
        hint.style.color = '#e74c3c';
    } else if (!hasFolder) {
        hint.textContent = 'Veuillez sélectionner un dossier';
        hint.style.color = '#e74c3c';
    } else if (!hasSelectedFiles) {
        hint.textContent = 'Veuillez sélectionner au moins un fichier';
        hint.style.color = '#e74c3c';
    } else {
        hint.textContent = `Prêt à uploader ${selectedFiles.size} fichier(s)! 🚀`;
        hint.style.color = '#27ae60';
    }
}

function validateNrFormat(nrValue) {
    const nrRegex = /^NR\s*\d{1,4}$/i;
    return nrRegex.test(String(nrValue || '').trim());
}

function normalizeNrInput(nrValue) {
    const v = String(nrValue || '').trim();
    const m = v.match(/^NR\s*(\d{1,4})$/i);
    if (!m) return v.toUpperCase();
    return `NR${m[1]}`;
}

// ==================== UPLOAD DOSSIER ====================

async function uploadFolder() {
    try {
        if (!currentSelectedFolder || !folderNameInput.value.trim() || selectedFiles.size === 0) {
            showErrorMessage('Veuillez remplir tous les champs obligatoires et sélectionner des fichiers');
            return;
        }
        
        const nrRaw = folderNameInput.value.trim();
        if (!validateNrFormat(nrRaw)) {
            showErrorMessage('Format NR incorrect. Utilisez "NR" suivi de 1 à 4 chiffres (ex: NR3125)');
            return;
        }

        const nrValue = normalizeNrInput(nrRaw);
        folderNameInput.value = nrValue; // normaliser visuellement (NR 1234 -> NR1234)
        
        // Une seule confirmation: si pas encore confirmé (ou NR changé), on affiche le modal puis on reprend l'upload
        if (!nrConfirmedValue || nrConfirmedValue !== nrValue) {
            pendingUploadAfterNrConfirm = true;
            pendingNrValue = nrValue;
            showNrConfirmationModal(nrValue.replace(/NR/i, ''));
            return;
        }

        await uploadFolderCore(nrValue);
        
    } catch (error) {
        console.error('❌ Erreur upload:', error);
        progressContainer.classList.remove('show');
        showErrorMessage('Erreur lors de l\'upload: ' + error.message);
    }
}

async function uploadFolderCore(nrValue) {
    console.log('📤 Début de l\'upload...');
    console.log(`📄 ${selectedFiles.size} fichiers à uploader`);
    console.log(`🔢 N°NR: ${nrValue}`);

    const nrNumber = nrValue.replace(/NR/i, '');
    const filesCount = selectedFiles.size;

    const filteredStructure = filterStructureToSelectedFiles(folderStructure, selectedFiles);

    // Enrichir + trier la liste des fichiers sélectionnés
    const fileIndex = buildFileIndexFromStructure(folderStructure, currentSelectedFolder);
    const selectedFilesSorted = Array.from(selectedFiles)
      .map((f) => {
        const meta = fileIndex.get(f.path);
        return {
          ...f,
          date: meta?.date ?? null,
          timestamp: meta?.timestamp ?? 0
        };
      })
      .sort((a, b) => {
        const aName = String(a.displayPath || a.path || '').split(/[\\/]/).pop();
        const bName = String(b.displayPath || b.path || '').split(/[\\/]/).pop();
        return compareDataFilenames(aName, bName);
      });

    const folderData = {
        name: nrValue, // normalisé (NR1234)
        folderPath: currentSelectedFolder,
        selectedFiles: selectedFilesSorted,
        structure: filteredStructure,
        date: new Date().toLocaleString('fr-FR'),
        totalFiles: filesCount,
        totalSize: await calculateTotalSize(),
        id: generateID()
    };

    progressContainer.classList.add('show');
    progressFill.style.width = '0%';
    progressText.textContent = 'Préparation de l\'upload...';

    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress > 90) progress = 90;
        updateProgress(progress);
    }, 300);

    const result = await window.electronAPI.uploadSelectedFiles(folderData);

    clearInterval(progressInterval);

    if (!result.success) {
        throw new Error(result.error || 'Erreur lors de l\'upload');
    }

    updateProgress(100);
    progressText.textContent = '✅ Upload réussi!';

    const storageKey = `upload_folder_${folderData.id}`;
    localStorage.setItem(storageKey, JSON.stringify(folderData));

    setTimeout(() => {
        closeUploadModal();
        loadUploadedFolders();
        updateStats();
        showSuccessMessage(`${filesCount} fichiers uploadés avec succès sous le N°NR ${nrNumber}! 🎉`);
    }, 1000);

    console.log('✅ Upload réussi');
}

function filterStructureToSelectedFiles(structure, selectedFilesSet) {
    const selectedPaths = Array.from(selectedFilesSet).map(file => file.path);
    
    function filterSubdir(subdir) {
        const filtered = {
            name: subdir.name,
            files: [],
            filesWithDates: [],
            subdirs: []
        };
        
        if (subdir.filesWithDates && subdir.filesWithDates.length > 0) {
            filtered.filesWithDates = subdir.filesWithDates.filter(file => {
                const filePath = `${currentSelectedFolder}/${subdir.name}/${file.name}`;
                return selectedPaths.some(selectedPath => 
                    selectedPath.includes(file.name) || 
                    selectedPath === filePath
                );
            });
            
            filtered.files = filtered.filesWithDates.map(file => file.name);
        }
        
        if (subdir.subdirs && subdir.subdirs.length > 0) {
            filtered.subdirs = subdir.subdirs
                .map(filterSubdir)
                .filter(sub => sub.files.length > 0 || sub.subdirs.length > 0);
        }
        
        return filtered;
    }
    
    const filteredRoot = {
        name: structure.name,
        files: [],
        filesWithDates: [],
        subdirs: []
    };
    
    if (structure.filesWithDates && structure.filesWithDates.length > 0) {
        filteredRoot.filesWithDates = structure.filesWithDates.filter(file => {
            const filePath = `${currentSelectedFolder}/${file.name}`;
            return selectedPaths.some(selectedPath => 
                selectedPath.includes(file.name) || 
                selectedPath === filePath
            );
        });
        filteredRoot.files = filteredRoot.filesWithDates.map(file => file.name);
    }
    
    if (structure.subdirs && structure.subdirs.length > 0) {
        filteredRoot.subdirs = structure.subdirs
            .map(filterSubdir)
            .filter(sub => sub.files.length > 0 || sub.subdirs.length > 0);
    }
    
    return filteredRoot;
}

async function calculateTotalSize() {
    try {
        let totalSize = 0;
        const sizePromises = Array.from(selectedFiles).map(async (file) => {
            const result = await window.electronAPI.getFileSize(file.path);
            if (result.success) {
                return result.size;
            }
            return 0;
        });
        
        const sizes = await Promise.all(sizePromises);
        totalSize = sizes.reduce((sum, size) => sum + size, 0);
        
        return formatBytes(totalSize);
    } catch (error) {
        console.error('Erreur calcul taille:', error);
        return '0 Bytes';
    }
}

function updateProgress(percent) {
    progressFill.style.width = percent + '%';
    progressText.textContent = `Upload en cours... ${Math.round(percent)}%`;
}

// ==================== DOSSIERS SAUVEGARDÉS ====================

function loadUploadedFolders() {
    console.log('📂 Chargement des dossiers uploadés...');
    
    uploadedFolders = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('upload_folder_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                uploadedFolders.push(data);
            } catch (error) {
                console.error('❌ Erreur lors du chargement:', key, error);
            }
        }
    }
    
    console.log('📋 Dossiers trouvés:', uploadedFolders.length);
    
    uploadedFolders.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    displayFoldersList();
}

function displayFoldersList() {
    foldersListDiv.innerHTML = '';
    
    if (uploadedFolders.length === 0) {
        noFoldersMessage.style.display = 'block';
        return;
    }
    
    noFoldersMessage.style.display = 'none';
    
    uploadedFolders.forEach((folder) => {
        const folderRow = createFolderRow(folder);
        foldersListDiv.appendChild(folderRow);
    });
    
    // Ajouter les écouteurs d'événements APRÈS avoir ajouté les lignes au DOM
    addTableEventListeners();
}
function addTableEventListeners() {
    // Écouteurs pour les boutons Analyser
    document.querySelectorAll('.analyze-folder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const folderId = btn.dataset.folderId;
            const folder = uploadedFolders.find(f => f.id === folderId);
            if (folder) {
                openAnalyzeFolder(folder);
            } else {
                console.error('Dossier non trouvé:', folderId);
                showErrorMessage('Dossier non trouvé');
            }
        });
    });
    
    // Écouteurs pour les boutons Supprimer
    document.querySelectorAll('.delete-folder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const folderId = btn.dataset.folderId;
            if (folderId) {
                confirmDeleteFolder(folderId);
            } else {
                console.error('ID de dossier manquant');
                showErrorMessage('Erreur: ID de dossier manquant');
            }
        });
    });
}
function createFolderRow(folder) {
    const row = document.createElement('tr');
    row.className = 'folder-row';
    
    const nrNumber = folder.name.replace(/NR/i, '');
    const fileText = folder.totalFiles === 1 ? 'fichier' : 'fichiers';
    
    // Formatage de la date
    let displayDate = folder.date;
    try {
        const dateObj = new Date(folder.date);
        if (!isNaN(dateObj.getTime())) {
            displayDate = dateObj.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    } catch (e) {
        // Garder la date originale en cas d'erreur
    }
    
    row.innerHTML = `
        <td class="folder-name-cell">
            <span class="folder-icon">📁</span>
            <span class="folder-name">NR${nrNumber}</span>
        </td>
        <td class="folder-files-cell">
            ${folder.totalFiles} ${fileText}
        </td>
        <td class="folder-date-cell">
            ${displayDate}
        </td>
        <td class="folder-actions-cell">
            <button class="btn btn-primary btn-small analyze-folder-btn" data-folder-id="${folder.id}" title="Analyser ce dossier">
                📊 Analyser
            </button>
            <button class="btn btn-danger btn-small delete-folder-btn" data-folder-id="${folder.id}" title="Supprimer ce dossier">
                🗑️ Supprimer
            </button>
        </td>
    `;
    
    return row;
}

function createFolderCard(folder) {
    const folderCard = document.createElement('div');
    folderCard.className = 'folder-card';
    
    const fileText = folder.totalFiles === 1 ? 'fichier' : 'fichiers';
    const nrNumber = folder.name.replace(/NR/i, '');
    
    // CARTE SIMPLIFIÉE - PAS DE DESCRIPTION
    folderCard.innerHTML = `
        <div class="folder-header">
            <div class="folder-main-info">
                <div class="folder-icon">📂</div>
                <div class="folder-info">
                    <div class="folder-name">NR${nrNumber}</div>
                    <div class="folder-details">
                        <div class="folder-date">${folder.date}</div>
                        <div class="folder-stats">${folder.totalFiles} ${fileText} - ${folder.totalSize}</div>
                    </div>
                </div>
            </div>
            <div class="folder-actions">
                <button class="btn btn-primary btn-small view-details-btn">
                    👁️ Détails
                </button>
                <button class="btn btn-info btn-small analyze-folder-btn">
                    📊 Analyser
                </button>
                <button class="btn btn-danger btn-small delete-folder-btn">
                    🗑️ Supprimer
                </button>
            </div>
        </div>
    `;
    
    folderCard.querySelector('.view-details-btn').addEventListener('click', () => {
        showFolderDetails(folder);
    });
    
    folderCard.querySelector('.analyze-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openAnalyzeFolder(folder);
    });
    
    folderCard.querySelector('.delete-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteFolder(folder.id);
    });
    
    return folderCard;
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
    
    if (!hasVisibleItems && searchTerm) {
        noFoldersMessage.style.display = 'block';
        noFoldersMessage.innerHTML = `<p>Aucun dossier trouvé pour "${searchTerm}"</p>`;
    } else if (!searchTerm) {
        noFoldersMessage.style.display = uploadedFolders.length === 0 ? 'block' : 'none';
    }
}

// ==================== DÉTAILS DOSSIER ====================

function showFolderDetails(folder) {
    const nrNumber = folder.name.replace(/NR/i, '');
    detailsFolderName.textContent = `NR${nrNumber}`;
    detailsDate.textContent = folder.date;
    detailsFileCount.textContent = folder.totalFiles;
    detailsSize.textContent = folder.totalSize;
    
    displaySelectedFilesInDetails(folder.selectedFiles);
    
    deleteFolderBtn.dataset.folderId = folder.id;
    
    folderDetailsModal.classList.remove('hidden');
}

function displaySelectedFilesInDetails(selectedFiles) {
    let html = '';
    
    if (selectedFiles && selectedFiles.length > 0) {
        const sorted = [...selectedFiles].sort((a, b) => {
            // Si les displayPath sont du type ENERGIE12.txt, EVENT3.txt, etc, on trie numériquement
            const aName = String(a.displayPath || a.path || '');
            const bName = String(b.displayPath || b.path || '');
            return compareDataFilenames(aName.split(/[\\/]/).pop(), bName.split(/[\\/]/).pop());
        });
        
        sorted.forEach(file => {
            html += `
                <div class="file-item">
                    📄 ${escapeHtml(file.displayPath)}
                    <div class="file-item-path">${escapeHtml(file.path)}</div>
                </div>
            `;
        });
    } else {
        html = '<p>Aucun fichier sélectionné</p>';
    }
    
    detailsFileList.innerHTML = html;
}

function closeFolderDetailsModal() {
    folderDetailsModal.classList.add('hidden');
}

// ==================== SUPPRESSION ====================
function confirmDeleteFolder(folderId) {
    console.log('🗑️ Tentative de suppression du dossier:', folderId);
    
    // Trouver le dossier pour afficher son nom dans la confirmation
    const folder = uploadedFolders.find(f => f.id === folderId);
    const folderName = folder ? folder.name : 'ce dossier';
    
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${folderName} ? Cette action est irréversible.`)) {
        deleteFolderById(folderId);
    }
}
// Nouvelle fonction pour supprimer par ID
function deleteFolderById(folderId) {
    console.log('🗑️ Suppression du dossier:', folderId);
    
    try {
        // Supprimer du localStorage
        const key = `upload_folder_${folderId}`;
        localStorage.removeItem(key);
        
        // Mettre à jour la liste des dossiers
        loadUploadedFolders();
        
        // Mettre à jour les statistiques
        updateStats();
        
        // Fermer le modal de détails s'il est ouvert
        if (folderDetailsModal && !folderDetailsModal.classList.contains('hidden')) {
            closeFolderDetailsModal();
        }
        
        showSuccessMessage('Dossier supprimé avec succès');
        console.log('✅ Dossier supprimé avec succès');
        
    } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error);
        showErrorMessage('Erreur lors de la suppression du dossier: ' + error.message);
    }
}
function deleteFolder() {
    const folderId = deleteFolderBtn.dataset.folderId;
    if (folderId) {
        deleteFolderById(folderId);
    }
}

// ==================== STATISTIQUES ====================

function updateStats() {
    const totalFoldersCount = document.getElementById('total-folders-count');
    const totalFilesCount = document.getElementById('total-files-count');
    
    let totalFiles = 0;
    uploadedFolders.forEach(folder => {
        totalFiles += folder.totalFiles || 0;
    });
    
    totalFoldersCount.textContent = uploadedFolders.length;
    totalFilesCount.textContent = totalFiles;
}

// ==================== UTILITAIRES ====================

function generateID() {
    return 'folder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showErrorMessage(message) {
    console.error('❌', message);
    alert('❌ Erreur: ' + message);
}

function showSuccessMessage(message) {
    console.log('✅', message);
    alert('✅ ' + message);
}

function showWarningMessage(message) {
    console.warn('⚠️', message);
    alert('⚠️ Attention: ' + message);
}

// ==================== ANALYSE DOSSIER ====================

function openAnalyzeFolder(folder) {
    sessionStorage.setItem('analyzeFolder', JSON.stringify(folder));
    window.location.href = 'analyzeFolder.html';
}

// ==================== FONCTION POUR OUVRIR LA PAGE ARDUINO ====================

function openArduinoPage() {
    console.log('🔧 Ouverture de la page Arduino IDE...');
    window.location.href = 'arduino/arduino.html';
}
