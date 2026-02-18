// arduinoMain.js
import { database, showLoader, hideLoader, simulateProgress, showError, hideError, readFileAsync } from './arduinoCore.js';
import { parseRawTables, buildDatabase } from './arduinoParser.js';
import { analyzeTechnicalData, analyzeCommercialData, buildEventMap } from './arduinoAnalytics.js';
import { handleCellClick } from './arduinoEvents.js';
import { renderByTab} from './arduinoRender.js';

// Rendre handleCellClick accessible globalement pour les attributs onclick
window.handleCellClick = handleCellClick;

// Éléments DOM
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const fileName = document.getElementById('fileName');
const nanoreseauValue = document.getElementById('nanoreseauValue');

// ---- Gestionnaire de fichier ----
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

        const rawTables = parseRawTables(content);
        if (rawTables.length === 0) {
            showError('Aucune donnée valide');
            return;
        }

        buildDatabase(rawTables);
        analyzeTechnicalData();
        analyzeCommercialData();
        buildEventMap();

        renderByTab();
        document.getElementById('infoSection').classList.add('show');
        hideError();
    } catch (err) {
        showError('Erreur lors de l\'analyse: ' + err.message);
        console.error(err);
    } finally {
        hideLoader();
    }
}

// ---- Écouteurs d'événements ----
fileInput.addEventListener('change', handleFileSelect);

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

// ---- Onglets ----
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderByTab();
        document.getElementById('tablesContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});