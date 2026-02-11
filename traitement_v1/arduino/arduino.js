// ===== CONSTANTES ET CONFIGURATION =====
const tableTypes = {
    'I': { name: 'Intensité', color: '#4CAF50', icon: '⚡', tab: 'Technique' },
    'T': { name: 'Tension', color: '#9C27B0', icon: '🔋', tab: 'Technique' },
    'R': { name: 'Recharges', color: '#FF9800', icon: '💳', tab: 'Commercial' },
    'S': { name: 'Évolution crédit', color: '#2196F3', icon: '💰', tab: 'Commercial' },
    'E': { name: 'Événements', color: '#F44336', icon: '🔔', tab: 'Evenement' }
};

const ROWS_PER_PAGE = 50;

// ===== ÉTAT GLOBAL DE L'APPLICATION =====
let database = {
    tables: [],
    pages: [],
    currentPages: {}
};

let currentTab = 'Technique';

// ===== DOM ELEMENTS =====
const elements = {
    fileInput: document.getElementById('fileInput'),
    fileName: document.getElementById('fileName'),
    uploadSection: document.getElementById('uploadSection'),
    infoSection: document.getElementById('infoSection'),
    tablesContainer: document.getElementById('tablesContainer'),
    errorMessage: document.getElementById('errorMessage'),
    nanoreseauValue: document.getElementById('nanoreseauValue'),
    typeLegend: document.getElementById('typeLegend'),
    summaryGrid: document.getElementById('summaryGrid'),
    loaderContainer: document.getElementById('loaderContainer'),
    loaderText: document.getElementById('loaderText'),
    progressFill: document.getElementById('progressFill'),
    tabs: document.querySelectorAll('.tab')
};

// ===== INITIALISATION =====
function init() {
    // Événements des onglets
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            renderByTab();
            elements.tablesContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // Événements d'upload
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.uploadSection.addEventListener('dragover', handleDragOver);
    elements.uploadSection.addEventListener('dragleave', handleDragLeave);
    elements.uploadSection.addEventListener('drop', handleDrop);
}

// ===== GESTIONNAIRES D'ÉVÉNEMENTS UPLOAD =====
function handleDragOver(e) {
    e.preventDefault();
    elements.uploadSection.classList.add('dragover');
}

function handleDragLeave() {
    elements.uploadSection.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadSection.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        elements.fileInput.files = files;
        handleFileSelect();
    }
}

// ===== GESTION DES FICHIERS =====
async function handleFileSelect() {
    const file = elements.fileInput.files[0];
    if (!file) return;

    elements.fileName.textContent = `📄 ${file.name}`;
    showLoader();
    simulateProgress();

    try {
        const content = await readFileAsync(file);
        await parseFileContent(content);
    } catch (err) {
        showError('Erreur lors de la lecture du fichier: ' + err.message);
        console.error(err);
    } finally {
        hideLoader();
    }
}

function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Erreur de lecture'));
        reader.readAsText(file);
    });
}

// ===== ANALYSE DU CONTENU =====
async function parseFileContent(content) {
    try {
        hideError();

        const nanoreseauMatch = content.match(/<#NANORESEAU:(\d+)>/);
        if (!nanoreseauMatch) {
            showError('Numéro NANORESEAU non trouvé');
            return;
        }
        elements.nanoreseauValue.textContent = nanoreseauMatch[1];

        const rawTables = parseRawTables(content);
        if (rawTables.length === 0) {
            showError('Aucune donnée valide');
            return;
        }

        buildDatabase(rawTables);
        createLegend();
        renderByTab();
        elements.infoSection.classList.add('show');
    } catch (err) {
        showError('Erreur lors de l\'analyse: ' + err.message);
        console.error(err);
    }
}

function parseRawTables(content) {
    const lines = content.split('\n');
    const tables = [];
    let currentHeader = null;
    let currentType = null;
    let currentData = [];
    let currentIndex = 0;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.match(/^<?Type;/i)) {
            if (currentHeader && currentData.length > 0) {
                tables.push({
                    id: `table_${currentIndex++}`,
                    type: currentType,
                    header: currentHeader,
                    data: [...currentData]
                });
            }
            currentHeader = line.replace(/^</, '').replace(/>$/, '');
            currentType = null;
            currentData = [];
            continue;
        }

        const dataMatch = line.match(/^([A-Z]);/);
        if (dataMatch && currentHeader) {
            const type = dataMatch[1];
            if (currentType && type !== currentType && currentData.length > 0) {
                tables.push({
                    id: `table_${currentIndex++}`,
                    type: currentType,
                    header: currentHeader,
                    data: [...currentData]
                });
                currentData = [];
            }
            currentType = type;
            currentData.push(line);
        }
    }

    if (currentHeader && currentData.length > 0) {
        tables.push({
            id: `table_${currentIndex++}`,
            type: currentType,
            header: currentHeader,
            data: currentData
        });
    }

    return tables;
}

// ===== CONSTRUCTION DE LA BASE DE DONNÉES =====
function buildDatabase(rawTables) {
    database.tables = rawTables;
    database.pages = [];
    database.currentPages = {};

    let pageIndex = 0;

    rawTables.forEach((table, tableIdx) => {
        const totalRows = table.data.length;
        const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);

        database.currentPages[tableIdx] = 1;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const startIdx = (pageNum - 1) * ROWS_PER_PAGE;
            const endIdx = Math.min(startIdx + ROWS_PER_PAGE, totalRows);
            const pageData = table.data.slice(startIdx, endIdx);

            const pageRows = pageData.map((row, rowIdx) => {
                return {
                    id: `row_${tableIdx}_${pageNum}_${rowIdx + startIdx}`,
                    content: row,
                    cells: row.split(';')
                };
            });

            database.pages.push({
                id: `page_${pageIndex++}`,
                tableId: table.id,
                tableIndex: tableIdx,
                pageNumber: pageNum,
                startRow: startIdx + 1,
                endRow: endIdx,
                totalRows: totalRows,
                totalPages: totalPages,
                rows: pageRows,
                header: table.header,
                type: table.type
            });
        }
    });
}

// ===== RENDU =====
function renderByTab() {
    const visibleTableIndices = [];
    database.tables.forEach((table, idx) => {
        if (tableTypes[table.type] && tableTypes[table.type].tab === currentTab) {
            visibleTableIndices.push(idx);
        }
    });

    createSummary(visibleTableIndices);
    displayTables(visibleTableIndices);
}

function createSummary(visibleTableIndices) {
    const summary = {};

    visibleTableIndices.forEach(tableIdx => {
        const table = database.tables[tableIdx];
        summary[table.type] = (summary[table.type] || 0) + table.data.length;
    });

    let html = '';
    Object.keys(summary).sort().forEach(type => {
        const info = tableTypes[type] || { name: type, icon: '📋' };
        html += `<div class="summary-item">
                    <div class="summary-item-label">${info.icon} ${info.name}</div>
                    <div class="summary-item-value">${summary[type]}</div>
                </div>`;
    });
    elements.summaryGrid.innerHTML = html;
}

function createLegend() {
    const types = [...new Set(database.tables.map(t => t.type))].sort();
    let html = '<strong style="margin-right:15px;">Types de données :</strong>';
    
    types.forEach(type => {
        const info = tableTypes[type] || { name: type, color: '#999', icon: '📋' };
        html += `<div class="legend-item">
                    <div class="legend-badge type-${type}" style="background:${info.color};">${type}</div>
                    <span>${info.icon} ${info.name}</span>
                </div>`;
    });
    
    elements.typeLegend.innerHTML = html;
}

function displayTables(visibleTableIndices) {
    let html = '';

    visibleTableIndices.forEach(tableIdx => {
        const table = database.tables[tableIdx];
        const currentPageNum = database.currentPages[tableIdx] || 1;
        const info = tableTypes[table.type] || { name: table.type, icon: '📋' };

        const page = database.pages.find(p =>
            p.tableIndex === tableIdx && p.pageNumber === currentPageNum
        );

        if (!page) return;

        // Filtrer l'en-tête pour enlever la colonne "Type"
        const headers = page.header.split(';')
            .filter(h => h.trim() !== '' && !h.match(/^<?Type$/i));

        let headerHTML = '<tr>' + headers.map(h => `<th>${h.trim()}</th>`).join('') + '</tr>';

        // Filtrer les lignes pour enlever la première colonne
        let bodyHTML = '';
        page.rows.forEach(row => {
            const cellsWithoutType = row.cells.slice(1);
            bodyHTML += '<tr>' + cellsWithoutType.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
        });

        const paginationHTML = generatePagination(tableIdx, page);

        html += `
            <div class="table-block" data-table-id="${table.id}" data-table-index="${tableIdx}">
                <div class="table-header">
                    <div class="table-title">${info.icon} ${info.name} (Type ${table.type})</div>
                    <div class="table-badge">
                        ${page.totalRows} enregistrement(s) - 
                        Page ${currentPageNum}/${page.totalPages} - 
                        Lignes ${page.startRow} à ${page.endRow}
                    </div>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>${headerHTML}</thead>
                        <tbody>${bodyHTML}</tbody>
                    </table>
                </div>
                ${paginationHTML}
            </div>`;
    });

    elements.tablesContainer.innerHTML = html;
    elements.tablesContainer.classList.add('show');
    attachPaginationEvents();
}

function generatePagination(tableIdx, page) {
    if (page.totalPages <= 1) return '';

    return `
        <div class="pagination" data-table-index="${tableIdx}">
            <button class="pagination-button" data-action="first" ${page.pageNumber === 1 ? 'disabled' : ''}>
                ⏮️
            </button>
            <button class="pagination-button" data-action="prev" ${page.pageNumber === 1 ? 'disabled' : ''}>
                ◀️
            </button>
            
            <div class="pagination-info">
                Page <input type="number" class="pagination-input" 
                    value="${page.pageNumber}" 
                    min="1" 
                    max="${page.totalPages}"
                    data-table-index="${tableIdx}"> 
                / ${page.totalPages}
            </div>
            
            <button class="pagination-button" data-action="next" ${page.pageNumber === page.totalPages ? 'disabled' : ''}>
                ▶️
            </button>
            <button class="pagination-button" data-action="last" ${page.pageNumber === page.totalPages ? 'disabled' : ''}>
                ⏭️
            </button>
        </div>
    `;
}

// ===== PAGINATION =====
function attachPaginationEvents() {
    document.querySelectorAll('.pagination-button').forEach(button => {
        button.removeEventListener('click', handlePaginationClick);
        button.addEventListener('click', handlePaginationClick);
    });

    document.querySelectorAll('.pagination-input').forEach(input => {
        input.removeEventListener('change', handlePageInputChange);
        input.addEventListener('change', handlePageInputChange);
        input.removeEventListener('keypress', handlePageInputKeypress);
        input.addEventListener('keypress', handlePageInputKeypress);
    });
}

function handlePaginationClick(e) {
    const button = e.currentTarget;
    const paginationDiv = button.closest('.pagination');
    if (!paginationDiv) return;

    const tableIndex = parseInt(paginationDiv.dataset.tableIndex);
    const action = button.dataset.action;
    const table = database.tables[tableIndex];

    if (!table) return;

    const currentPage = database.currentPages[tableIndex] || 1;
    const totalPages = Math.ceil(table.data.length / ROWS_PER_PAGE);
    let newPage = currentPage;

    switch (action) {
        case 'first': newPage = 1; break;
        case 'prev': newPage = Math.max(1, currentPage - 1); break;
        case 'next': newPage = Math.min(totalPages, currentPage + 1); break;
        case 'last': newPage = totalPages; break;
    }

    if (newPage !== currentPage) {
        database.currentPages[tableIndex] = newPage;
        renderByTab();

        setTimeout(() => {
            const tableBlock = document.querySelector(`.table-block[data-table-index="${tableIndex}"] .table-wrapper`);
            if (tableBlock) tableBlock.scrollTop = 0;
        }, 50);
    }
}

function handlePageInputChange(e) {
    const input = e.currentTarget;
    const paginationDiv = input.closest('.pagination');
    if (!paginationDiv) return;

    const tableIndex = parseInt(paginationDiv.dataset.tableIndex);
    const table = database.tables[tableIndex];
    if (!table) return;

    const totalPages = Math.ceil(table.data.length / ROWS_PER_PAGE);
    let newPage = parseInt(input.value);

    if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
        database.currentPages[tableIndex] = newPage;
        renderByTab();

        setTimeout(() => {
            const tableBlock = document.querySelector(`.table-block[data-table-index="${tableIndex}"] .table-wrapper`);
            if (tableBlock) tableBlock.scrollTop = 0;
        }, 50);
    } else {
        input.value = database.currentPages[tableIndex] || 1;
    }
}

function handlePageInputKeypress(e) {
    if (e.key === 'Enter') {
        e.currentTarget.dispatchEvent(new Event('change'));
    }
}

// ===== LOADER =====
function showLoader() {
    elements.loaderContainer.classList.add('show');
    elements.uploadSection.style.opacity = '0.5';
    elements.uploadSection.style.pointerEvents = 'none';
}

function hideLoader() {
    elements.loaderContainer.classList.remove('show');
    elements.uploadSection.style.opacity = '1';
    elements.uploadSection.style.pointerEvents = 'auto';
    elements.progressFill.style.width = '0%';
}

function simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 10 + 5;
            elements.progressFill.style.width = Math.min(progress, 90) + '%';

            if (progress < 50) elements.loaderText.textContent = 'Lecture du fichier...';
            else if (progress < 80) elements.loaderText.textContent = 'Analyse des données...';
            else elements.loaderText.textContent = 'Création des pages...';
        } else {
            clearInterval(interval);
        }
    }, 200);

    setTimeout(() => {
        clearInterval(interval);
        elements.progressFill.style.width = '100%';
        elements.loaderText.textContent = 'Terminé !';
    }, 1500);
}

// ===== GESTION DES ERREURS =====
function showError(msg) {
    elements.errorMessage.textContent = '⚠️ ' + msg;
    elements.errorMessage.classList.add('show');
    elements.infoSection.classList.remove('show');
    elements.tablesContainer.classList.remove('show');
}

function hideError() {
    elements.errorMessage.classList.remove('show');
}

// ===== UTILITAIRES =====
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ===== DÉMARRAGE =====
document.addEventListener('DOMContentLoaded', init);