// analysis.js - Utilisation du NanorParser

const urlParams = new URLSearchParams(window.location.search);
const nr = urlParams.get('nr');

let folderData = null;
let currentType = null;
let currentSubIndex = null;
let filesByType = {};
let parser = null;
let currentTopTab = 'technique';

// Ordre d'affichage des types
const typeOrder = ['énergie', 'crédit', 'tension', 'recharge', 'EC', 'EvNR'];

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('nr-display').textContent = nr ? ` ${nr}` : '';
    parser = new NanorParser();
    loadData();
});

function loadData() {
    if (!nr) {
        showError('Aucun numéro NR spécifié');
        return;
    }
    
    try {
        const key = `analysis_${nr}`;
        const data = localStorage.getItem(key);
        
        if (!data) {
            showError(`Aucune donnée trouvée pour NR${nr}`);
            return;
        }
        
        folderData = JSON.parse(data);
        console.log('Données chargées:', folderData);
        
        processFilesWithParser();
        organizeFilesByType();
        computeAndDisplayDailyEnergy();
        displayTabs();
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('analysis-content').style.display = 'block';
        
    } catch (error) {
        console.error('Erreur:', error);
        showError('Erreur: ' + error.message);
    }
}

function processFilesWithParser() {
    const files = folderData.files || [];
    
    for (const file of files) {
        const fileName = file.name;
        const fileContent = file.content || '';
        
        try {
            const parsedData = parser.parseFile(fileName, fileContent);
            file.parsedData = parsedData;
            console.log(`✅ Fichier ${fileName} parsé: ${parsedData.length} entrées`);
        } catch (error) {
            console.error(`❌ Erreur parsing ${fileName}:`, error);
            file.parsedData = [];
        }
    }
}

function organizeFilesByType() {
    const files = folderData.files || [];
    
    filesByType = {
        'énergie': [],
        'crédit': [],
        'tension': [],
        'recharge': [],
        'EC': [],
        'EvNR': [],
        'autre': []
    };
    
    console.log('🔍 Organisation des fichiers par type...');
    
    for (const file of files) {
        let type = 'autre';
        const fileName = file.name;
        
        if (fileName.startsWith('E') && !fileName.startsWith('EC_') && !fileName.startsWith('EvNR_')) {
            type = 'énergie';
            const clientMatch = fileName.match(/^E(\d+)_/);
            if (clientMatch) file.client = clientMatch[1];
        }
        else if (fileName.startsWith('C')) {
            type = 'crédit';
            const clientMatch = fileName.match(/^C(\d+)_/);
            if (clientMatch) file.client = clientMatch[1];
        }
        else if (fileName.startsWith('T_')) type = 'tension';
        else if (fileName.startsWith('R_')) type = 'recharge';
        else if (fileName.startsWith('EC_')) type = 'EC';
        else if (fileName.startsWith('EvNR_')) type = 'EvNR';
        
        filesByType[type].push(file);
    }
    
    // Trier les clients par numéro
    for (const type of ['énergie', 'crédit']) {
        filesByType[type].sort((a, b) => {
            const numA = parseInt(a.client) || 0;
            const numB = parseInt(b.client) || 0;
            return numA - numB;
        });
    }
    
    // Supprimer les types vides
    for (const type in filesByType) {
        if (filesByType[type].length === 0) {
            delete filesByType[type];
        }
    }
}

function displayTabs() {
    const types = Object.keys(filesByType);
    
    if (types.length === 0) {
        document.getElementById('type-tabs').innerHTML = '<div class="no-data">Aucun fichier à afficher</div>';
        return;
    }
    
    types.sort((a, b) => {
        const indexA = typeOrder.indexOf(a);
        const indexB = typeOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });
    
    let typeHtml = '';
    const typeIcons = {
        'énergie': '🔋', 'crédit': '💰', 'tension': '⚡',
        'recharge': '🔄', 'EC': '🔌', 'EvNR': '📋', 'autre': '📄'
    };
    const typeClasses = {
        'EC': 'ec', 'EvNR': 'evnr'
    };
    
    for (const type of types) {
        const icon = typeIcons[type] || '📄';
        const count = filesByType[type].length;
        const extraClass = typeClasses[type] || '';
        typeHtml += `
            <button class="type-tab ${extraClass}" onclick="selectType('${type}')">
                ${icon} ${type.toUpperCase()} (${count})
            </button>
        `;
    }
    
    document.getElementById('type-tabs').innerHTML = typeHtml;
    
    if (types.length > 0) {
        selectType(types[0]);
    }
}

function selectType(type) {
    currentType = type;
    currentSubIndex = 0;
    
    document.querySelectorAll('.type-tab').forEach(tab => {
        if (tab.textContent.includes(type.toUpperCase())) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    const files = filesByType[type] || [];
    
    if (files.length === 0) {
        document.getElementById('client-subtabs').innerHTML = '';
        document.getElementById('content-display').innerHTML = '<div class="no-data">Aucune donnée</div>';
        return;
    }
    
    if ((type === 'énergie' || type === 'crédit') && files.length > 1) {
        let clientHtml = '';
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isActive = i === 0 ? 'active' : '';
            clientHtml += `
                <button class="client-tab ${isActive}" onclick="selectSubItem(${i})">
                    👤 Client ${file.client}
                </button>
            `;
        }
        document.getElementById('client-subtabs').innerHTML = clientHtml;
        displayContent(files[0], 0);
    } else {
        document.getElementById('client-subtabs').innerHTML = '';
        displayContent(files[0], 0);
    }
}

function selectSubItem(index) {
    const files = filesByType[currentType] || [];
    if (index >= files.length) return;
    currentSubIndex = index;
    
    document.querySelectorAll('.client-tab').forEach((tab, i) => {
        if (i === index) tab.classList.add('active');
        else tab.classList.remove('active');
    });
    
    displayContent(files[index], index);
}

function displayContent(file, index) {
    const header = document.getElementById('content-header');
    let headerText = `📄 ${file.name}`;
    if (file.client && (currentType === 'énergie' || currentType === 'crédit')) {
        headerText += ` - Client ${file.client}`;
    }
    header.innerHTML = headerText;
    
    const contentDiv = document.getElementById('content-display');
    
    if (!file.parsedData || file.parsedData.length === 0) {
        contentDiv.innerHTML = '<div class="no-data">Aucune donnée décodée</div>';
        return;
    }
    
    const data = file.parsedData;
    let tableHtml = '<div class="table-container"><table class="data-table"><thead><tr>';
    
    const firstRow = data[0];
    let columns = Object.keys(firstRow);
    
    // Filtrer les colonnes à supprimer
    const columnsToRemove = ['hexVal', 'type', 'hexCourant', 'valeurBrute'];
    columns = columns.filter(col => !columnsToRemove.includes(col));
    
    // Noms des colonnes en français avec unités adaptées
    const columnNames = {
        'date': 'Date',
        'time': 'Heure',
        'intVal': currentType === 'énergie' ? 'Énergie (Wh)' : (currentType === 'crédit' ? 'Crédit (Jours)' : 'Valeur'),
        'tension': 'Tension (V)',
        'etatNR': 'État NR',
        'tBatt': 'Tension batterie',
        'isEvent': 'Événement',
        'clientNum': 'Client',
        'etatClient': 'État client',
        'courant': 'Courant (A)',
        'isClientEvent': 'Événement client',
        'typeCode': 'Type recharge',
        'idRecharge': 'ID recharge',
        'data1': 'Données',
        'isRecharge': 'Recharge',
        'isRechargeEvent': 'Événement recharge'
    };
    
    for (const col of columns) {
        let colName = columnNames[col] || col;
        tableHtml += `<th>${colName}</th>`;
    }
    tableHtml += '<tr></thead><tbody>';
    
    for (const row of data) {
        tableHtml += '<tr>';
        for (const col of columns) {
            let value = row[col];
            if (value === undefined || value === null) value = '-';
            if (typeof value === 'boolean') value = value ? 'Oui' : 'Non';
            tableHtml += `<td>${value}</td>`;
        }
        tableHtml += '</tr>';
    }
    
    tableHtml += '</tbody></table></div>';
    contentDiv.innerHTML = tableHtml;
}

// ==================== GESTION DES ONGLETS DE LA CARTE DU HAUT ====================

function switchTopTab(tabName) {
    currentTopTab = tabName;
    
    document.querySelectorAll('.top-tab').forEach(tab => {
        if (tab.textContent.toLowerCase().includes(tabName.toLowerCase())) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    document.getElementById('technique-content').style.display = 'none';
    document.getElementById('commerciale-content').style.display = 'none';
    document.getElementById(`${tabName}-content`).style.display = 'block';
    if (tabName === 'technique') {
        computeAndDisplayDailyEnergy();
    }
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    const errorDiv = document.getElementById('error-message');
    errorDiv.innerHTML = `
        <strong>❌ Erreur</strong><br>
        ${message}<br><br>
        <a href="nanoConnect.html" class="back-btn">← Retour</a>
    `;
    errorDiv.style.display = 'block';
}

// Calculer et afficher le tableau journalier d'énergie dans l'onglet technique
function computeAndDisplayDailyEnergy() {
    const energyFiles = filesByType['énergie'] || [];
    if (energyFiles.length === 0) {
        document.getElementById('technique-empty').style.display = 'block';
        document.getElementById('daily-energy-container').style.display = 'none';
        document.getElementById('daily-tension-container').style.display = 'none';
        return;
    }

    const dailyStats = {};
    const clientSet = new Set();

    for (const file of energyFiles) {
        const client = file.client || '0';
        clientSet.add(client);
        const rows = file.parsedData || [];

        for (const row of rows) {
            const dateStr = row.date || row.day || null;
            if (!dateStr) continue;
            const dayKey = normalizeDateKey(dateStr);
            if (!dayKey) continue;

            if (!dailyStats[dayKey]) {
                dailyStats[dayKey] = {
                    clients: {},
                    tensionMin: null,
                    tensionMax: null,
                    tensionSum: 0,
                    tensionCount: 0,
                    total: 0
                };
            }

            const stats = dailyStats[dayKey];
            const energyVal = Number(row.intVal || row.intValue || row.energy || 0) || 0;
            const tensionVal = Number(row.tension || row.voltage || 0) || 0;

            if (!stats.clients[client] || energyVal > stats.clients[client]) {
                stats.clients[client] = energyVal;
            }

            if (tensionVal) {
                stats.tensionMin = stats.tensionMin === null ? tensionVal : Math.min(stats.tensionMin, tensionVal);
                stats.tensionMax = stats.tensionMax === null ? tensionVal : Math.max(stats.tensionMax, tensionVal);
                stats.tensionSum += tensionVal;
                stats.tensionCount += 1;
            }
        }
    }

    const days = Object.keys(dailyStats).sort();
    if (days.length === 0) {
        document.getElementById('technique-empty').style.display = 'block';
        document.getElementById('daily-energy-container').style.display = 'none';
        document.getElementById('daily-tension-container').style.display = 'none';
        return;
    }

    const clients = Array.from(clientSet).sort((a,b)=>Number(a)-Number(b));

    const energyHeader = document.getElementById('daily-energy-header');
    const energyBody = document.getElementById('daily-energy-body');
    energyHeader.innerHTML = '<th>Date</th>' + clients.map(c => `<th>Client ${c} (Wh)</th>`).join('') + '<th>Consommation totale (Wh)</th>';
    energyBody.innerHTML = '';

    for (const dayKey of days) {
        const stats = dailyStats[dayKey];
        let rowHtml = `<tr><td>${dayKey}</td>`;
        let dailyTotal = 0;
        for (const client of clients) {
            const value = stats.clients[client] || 0;
            dailyTotal += value;
            rowHtml += `<td>${value}</td>`;
        }
        rowHtml += `<td>${dailyTotal}</td></tr>`;
        energyBody.insertAdjacentHTML('beforeend', rowHtml);
    }

    document.getElementById('daily-energy-container').style.display = 'block';

    const tensionBody = document.getElementById('daily-tension-body');
    tensionBody.innerHTML = '';
    for (const dayKey of days) {
        const stats = dailyStats[dayKey];
        const avg = stats.tensionCount > 0 ? (stats.tensionSum / stats.tensionCount).toFixed(2) : 0;
        tensionBody.insertAdjacentHTML('beforeend', `
            <tr>
                <td>${dayKey}</td>
                <td>${stats.tensionMin !== null ? stats.tensionMin : '-'}</td>
                <td>${stats.tensionMax !== null ? stats.tensionMax : '-'}</td>
                <td>${avg}</td>
            </tr>
        `);
    }
    document.getElementById('daily-tension-container').style.display = 'block';
    document.getElementById('technique-empty').style.display = 'none';
}

function normalizeDateKey(dateStr) {
    if (!dateStr) return null;
    const isoMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    const frMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (frMatch) {
        return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`;
    }

    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    return null;
}

// recalculer quand on affiche l'onglet technique
