// ==================== FICHIER PRINCIPAL OPTIMISÉ ====================

// ==================== VARIABLES GLOBALES ====================
let currentFolder = null;
let folderStructure = null;
let energyData = [], tensionData = [], eventData = [], soldeData = [], rechargeData = [];
let combinedEnergyData = [], combinedTensionData = [], combinedEventData = [], combinedSoldeData = [], combinedRechargeData = [];
let filteredEnergyData = [], filteredTensionData = [];
let currentPageEnergy = 1, currentPageTension = 1, currentPageEvent = 1, currentPageSolde = 1, currentPageRecharge = 1;
let rowsPerPage = 1000;
let totalRowsEnergy = 0, totalRowsTension = 0, totalRowsEvent = 0, totalRowsSolde = 0, totalRowsRecharge = 0;
let totalFilesToLoad = 0, loadedFilesCount = 0;
let filterStartDate = null, filterEndDate = null, filterPeriod = 'all', filterMonth = null, filterYear = null;

// ==================== FONCTIONS UTILITAIRES ====================
function escapeHtml(text) {
    if (!text) return '';
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showError(message) {
    const main = document.querySelector('.analyze-main');
    if (main) main.innerHTML = `<div class="error-message"><strong>❌ Erreur:</strong> ${escapeHtml(message)}</div>
        <button class="btn btn-secondary" onclick="window.location.href='folderUpload.html'">← Retour</button>`;
}

function parseCSVContent(content, type) {
    const lines = content.split('\n');
    const parsedLines = [];
    const prefixes = {'ENERGIE':'C;','TENSION':'T;','EVENT':'E;','SOLDE':'S;','RECHARGE':'R;'};
    
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === '') continue;
        if (prefixes[type] && trimmed.startsWith(prefixes[type])) parsedLines.push(trimmed);
    }
    return parsedLines;
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'});
    } catch { return 'N/A'; }
}

function showMessage(message, type = 'success') {
    const oldMsg = document.getElementById('filter-message');
    if (oldMsg) oldMsg.remove();
    
    const msgDiv = document.createElement('div');
    msgDiv.id = 'filter-message';
    msgDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: ${type === 'success' ? '#22c55e' : '#ef4444'};
        color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 10000; font-weight: 600; display: flex; align-items: center; gap: 10px;
        animation: slideIn 0.3s ease, slideOut 0.3s ease 2.7s forwards;
    `;
    msgDiv.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
    document.body.appendChild(msgDiv);
    setTimeout(() => { if(msgDiv.parentNode) msgDiv.remove(); }, 3000);
}

// ==================== CARD DONNÉES TECHNIQUES ====================
function createTechnicalDataCard() {
    const techniqueContent = document.getElementById('main-tab-content-technique');
    if (!techniqueContent) return;
    
    const existingCard = document.getElementById('technical-data-card');
    if (existingCard) existingCard.remove();
    
    const techData = calculateTechnicalData();
    const card = document.createElement('div');
    card.id = 'technical-data-card';
    card.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;
        margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden; animation: fadeIn 0.5s ease;
    `;
    
    card.innerHTML = `
        <div style="background: rgba(255,255,255,0.1); color: white; padding: 15px 25px; font-size: 18px;
            font-weight: 600; display: flex; align-items: center; gap: 10px; backdrop-filter: blur(10px);">
            🔧 DONNÉES TECHNIQUES DU NR-${escapeHtml(currentFolder.name)}
        </div>
        <div style="padding: 20px 25px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px; background: white;" id="tech-card-content"></div>
        <div style="padding: 12px 25px; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9);
            font-size: 11px; text-align: right; border-top: 1px solid rgba(255,255,255,0.1);">
            Dernière mise à jour: ${new Date().toLocaleString()}
        </div>
    `;
    
    const createDataItem = (icon, label, value, subValue = '') => {
        return `<div style="padding:15px; background:#f8f9fa; border-radius:8px; border:1px solid #e9ecef;
            transition:transform 0.2s ease, box-shadow 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)';
            this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='translateY(0)';
            this.style.boxShadow='none'">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <div style="font-size:20px;">${icon}</div>
                <div style="font-size:14px; color:#2c3e50; font-weight:600;">${label}</div>
            </div>
            <div style="font-size:22px; color:#3498db; font-weight:bold; margin-bottom:4px;">${value}</div>
            ${subValue ? `<div style="font-size:12px; color:#7f8c8d; font-weight:500;">${subValue}</div>` : ''}
        </div>`;
    };
    
    const content = card.querySelector('#tech-card-content');
    content.innerHTML = 
        createDataItem('📅', 'Période', techData.period) +
        createDataItem('👤', 'Nombre de clients', `${techData.clientCount} clients`) +
        createDataItem('⚡', 'Énergie Maximale', `${techData.maxEnergy.value}`, techData.maxEnergy.date) +
        createDataItem('📊', 'Tension Moyenne', `${techData.avgTension.value}`, techData.tensionSystem) +
        createDataItem('⬇️', 'Tension Minimale', `${techData.minTension.value}`, techData.minTension.date) +
        createDataItem('⬆️', 'Tension Maximale', `${techData.maxTension.value}`, techData.maxTension.date);
    
    const techniqueGrid = techniqueContent.querySelector('div[style*="display: flex; flex-direction: column"]');
    if (techniqueGrid) techniqueContent.insertBefore(card, techniqueGrid);
    else techniqueContent.insertBefore(card, techniqueContent.firstChild);
}

function calculateTechnicalData() {
    const energyDataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    const tensionDataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    
    const data = {
        period: '', clientCount: 0, maxEnergy: { value: 0, date: '' }, avgTension: { value: 0 },
        minTension: { value: 100, date: '' }, maxTension: { value: 0, date: '' }, tensionSystem: 'Système 12V'
    };
    
    // Calcul période
    let allDates = [];
    if (energyDataToUse.length > 0 || tensionDataToUse.length > 0) {
        [...energyDataToUse, ...tensionDataToUse].forEach(row => {
            if (row['Date et Heure']) {
                const date = new Date(row['Date et Heure']);
                if (!isNaN(date.getTime())) allDates.push(date);
            }
        });
        if (allDates.length > 0) {
            const minDate = new Date(Math.min(...allDates));
            const maxDate = new Date(Math.max(...allDates));
            const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
            const periods = {5:'5 jours',7:'7 jours',15:'15 jours',30:'30 jours',60:'2 mois',90:'3 mois',180:'6 mois',365:'1 an'};
            data.period = periods[Object.keys(periods).find(p => daysDiff <= p)] || `${Math.ceil(daysDiff/30)} mois`;
        } else data.period = 'Calcul en cours...';
    } else data.period = 'Chargement...';
    
    // Nombre de clients
    if (energyDataToUse.length > 0) {
        const sampleRow = energyDataToUse[0];
        data.clientCount = [1,2,3,4,5,6].reduce((count, i) => {
            const key = `Energie${i}`;
            if (!sampleRow.hasOwnProperty(key)) return count;
            const hasData = energyDataToUse.slice(0, Math.min(100, energyDataToUse.length))
                .some(row => row[key] && row[key].toString().trim() && row[key].toString().trim() !== '0' && row[key].toString().trim() !== '-');
            return hasData ? count + 1 : count;
        }, 0);
    }
    
    // Énergie maximale
    if (energyDataToUse.length > 0) {
        let maxEnergyValue = 0, maxEnergyDate = '';
        energyDataToUse.forEach(row => {
            for (let i = 1; i <= 6; i++) {
                const val = parseFloat(row[`Energie${i}`]) || 0;
                if (val > maxEnergyValue) { maxEnergyValue = val; maxEnergyDate = row['Date et Heure']; }
            }
        });
        data.maxEnergy.value = maxEnergyValue > 0 ? maxEnergyValue.toFixed(2) + ' Wh' : '0 Wh';
        data.maxEnergy.date = maxEnergyDate ? formatDisplayDate(maxEnergyDate) : 'Non disponible';
    }
    
    // Statistiques tension
    if (tensionDataToUse.length > 0) {
        let tensionSum = 0, tensionCount = 0, minTensionValue = 100, maxTensionValue = 0, minTensionDate = '', maxTensionDate = '';
        tensionDataToUse.forEach(row => {
            const tMoy = parseFloat(row['T_moy']) || 0, tMin = parseFloat(row['T_min']) || 0, tMax = parseFloat(row['T_max']) || 0;
            if (tMoy > 0) { tensionSum += tMoy; tensionCount++; }
            if (tMin > 0 && tMin < minTensionValue) { minTensionValue = tMin; minTensionDate = row['Date et Heure']; }
            if (tMax > 0 && tMax > maxTensionValue) { maxTensionValue = tMax; maxTensionDate = row['Date et Heure']; }
        });
        data.avgTension.value = tensionCount > 0 ? (tensionSum/tensionCount).toFixed(2) + ' V' : '0 V';
        const avg = parseFloat(data.avgTension.value);
        data.tensionSystem = avg > 18 ? 'Système 24V' : avg > 10 ? 'Système 12V' : 'Système inconnu';
        data.minTension.value = minTensionValue < 100 ? minTensionValue.toFixed(2) + ' V' : '0 V';
        data.minTension.date = minTensionDate ? formatDisplayDate(minTensionDate) : 'Non disponible';
        data.maxTension.value = maxTensionValue > 0 ? maxTensionValue.toFixed(2) + ' V' : '0 V';
        data.maxTension.date = maxTensionDate ? formatDisplayDate(maxTensionDate) : 'Non disponible';
    }
    
    return data;
}

// ==================== ANALYSE DE STABILITÉ ====================
function analyzeTensionStability(tensionResults) {
    if (!tensionResults || !tensionResults.length) return {
        stable: 0, unstable: 0, outOfLimits: 0, stabilityPercentage: 0, averageVariation: 0,
        days: 0, systemType: '12V', limits: getSystemLimits('12V')
    };

    // Détection système
    const tensions = tensionResults.reduce((arr, item) => {
        const tMoy = parseFloat(item['T_moy']) || 0, tMax = parseFloat(item['T_max']) || 0;
        if (tMoy > 0) arr.push(tMoy); if (tMax > 0) arr.push(tMax);
        return arr;
    }, []);
    const systemType = tensions.length > 0 ? (Math.max(...tensions) > 20 || (tensions.reduce((a,b)=>a+b,0)/tensions.length) > 18 ? '24V' : '12V') : '12V';
    const limits = getSystemLimits(systemType);

    // Analyse quotidienne
    const dailyData = {};
    tensionResults.forEach(item => {
        const date = item['Date et Heure'] ? item['Date et Heure'].split(' ')[0] : null;
        if (!date) return;
        if (!dailyData[date]) dailyData[date] = { values: [], min: Infinity, max: -Infinity };
        const tMoy = parseFloat(item['T_moy']) || 0, tMin = parseFloat(item['T_min']) || 0, tMax = parseFloat(item['T_max']) || 0;
        if (tMoy > 0) dailyData[date].values.push(tMoy);
        if (tMin > 0 && tMin < dailyData[date].min) dailyData[date].min = tMin;
        if (tMax > 0 && tMax > dailyData[date].max) dailyData[date].max = tMax;
    });

    let stableDays = 0, unstableDays = 0, outOfLimitsDays = 0;
    Object.values(dailyData).forEach(day => {
        const variation = day.max - day.min;
        if (day.min < limits.min || day.max > limits.max) outOfLimitsDays++;
        else if (variation > limits.maxVariation) unstableDays++;
        else stableDays++;
    });

    // Variation horaire
    const variations = [];
    for (let i = 1; i < tensionResults.length; i++) {
        const prev = parseFloat(tensionResults[i-1]['T_moy']) || 0, curr = parseFloat(tensionResults[i]['T_moy']) || 0;
        if (prev > 0 && curr > 0) variations.push(Math.abs(curr - prev));
    }
    const averageVariation = variations.length > 0 ? (variations.reduce((a,b)=>a+b,0)/variations.length).toFixed(3) : 0;
    const totalDays = Object.keys(dailyData).length;
    
    return {
        stable: stableDays, unstable: unstableDays, outOfLimits: outOfLimitsDays,
        stabilityPercentage: totalDays > 0 ? Math.round((stableDays/totalDays)*100) : 0,
        averageVariation: parseFloat(averageVariation), days: totalDays, systemType, limits
    };
}

function getSystemLimits(systemType) {
    return systemType === '24V' ? {
        min: 21.4, max: 31.5, ideal: { min: 24, max: 29 }, normal: 28, maxVariation: 5, alertThreshold: 3
    } : {
        min: 10.7, max: 15.6, ideal: { min: 12, max: 14.5 }, normal: 14, maxVariation: 2.5, alertThreshold: 1.5
    };
}

// ==================== ANALYSE COMMERCIALE ====================
function analyzeEnergyConsumption(energyData) {
    if (!energyData || energyData.length === 0) return {
        clientCount: 0, daysTotal: 0, maxEnergyPerClient: {}, averageConsumption: {}, daysAboveThreshold: {}
    };

    const results = { clientCount: 0, daysTotal: 0, maxEnergyPerClient: {}, averageConsumption: {}, daysAboveThreshold: {} };
    const sampleRow = energyData[0];
    
    // Compter clients avec données
    for (let i = 1; i <= 6; i++) {
        const key = `Energie${i}`;
        if (sampleRow.hasOwnProperty(key)) {
            const hasData = energyData.slice(0, Math.min(100, energyData.length))
                .some(row => row[key] && row[key].toString().trim() && row[key].toString().trim() !== '0' && row[key].toString().trim() !== '-');
            if (hasData) results.clientCount++;
        }
    }

    // Analyse quotidienne
    const dailyData = {};
    energyData.forEach(row => {
        if (!row['Date et Heure']) return;
        const date = row['Date et Heure'].split(' ')[0];
        if (!dailyData[date]) dailyData[date] = {};
        for (let i = 1; i <= 6; i++) {
            const key = `Energie${i}`, val = parseFloat(row[key]) || 0;
            if (!isNaN(val)) {
                if (!dailyData[date][key]) dailyData[date][key] = [];
                dailyData[date][key].push(val);
            }
        }
    });

    results.daysTotal = Object.keys(dailyData).length;
    for (let i = 1; i <= 6; i++) {
        const key = `Energie${i}`, clientData = [];
        Object.values(dailyData).forEach(day => {
            if (day[key] && day[key].length > 0) clientData.push(Math.max(...day[key]));
        });
        if (clientData.length > 0) {
            results.maxEnergyPerClient[key] = Math.max(...clientData);
            results.averageConsumption[key] = clientData.reduce((a,b)=>a+b,0)/clientData.length;
            results.daysAboveThreshold[key] = clientData.filter(v => v > 35).length; // 70% de 50Wh
        }
    }
    
    return results;
}

function analyzeCreditBehavior(creditData) {
    if (!creditData || creditData.length === 0) return {
        totalDays: 0, zeroCreditDays: {}, averageCredit: {}, maxCredit: {}, purchasePatterns: {}
    };

    const results = { totalDays: 0, zeroCreditDays: {}, averageCredit: {}, maxCredit: {}, purchasePatterns: {} };
    const dailyData = {};
    
    creditData.forEach(row => {
        if (!row['Date et Heure']) return;
        const date = row['Date et Heure'].split(' ')[0];
        if (!dailyData[date]) dailyData[date] = {};
        for (let i = 1; i <= 6; i++) {
            const key = `Credit${i}`, val = parseFloat(row[key]) || 0;
            if (!isNaN(val)) dailyData[date][key] = val;
        }
    });

    results.totalDays = Object.keys(dailyData).length;
    const sortedDates = Object.keys(dailyData).sort();
    
    for (let i = 1; i <= 6; i++) {
        const key = `Credit${i}`, clientData = [], purchases = [];
        let zeroDays = 0, previousCredit = null;
        
        sortedDates.forEach(date => {
            const credit = dailyData[date][key];
            if (credit !== undefined) {
                clientData.push(credit);
                if (credit === 0) zeroDays++;
                if (previousCredit === 0 && credit > 0) purchases.push({ date, amount: credit });
                previousCredit = credit;
            }
        });
        
        if (clientData.length > 0) {
            results.zeroCreditDays[key] = zeroDays;
            results.averageCredit[key] = clientData.reduce((a,b)=>a+b,0)/clientData.length;
            results.maxCredit[key] = Math.max(...clientData);
            results.purchasePatterns[key] = purchases;
        }
    }
    
    return results;
}

// ==================== AFFICHAGE DES ANALYSES ====================
function displayTensionStabilityAnalysis() {
    const techniqueContent = document.getElementById('main-tab-content-technique');
    if (!techniqueContent) return;
    
    if (!document.getElementById('et-filters-container')) createFilterControls();
    
    const existingAnalysis = document.getElementById('tension-stability-analysis');
    if (existingAnalysis) existingAnalysis.remove();
    
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    
    if (dataToUse.length === 0) {
        const noDataDiv = document.createElement('div');
        noDataDiv.id = 'tension-stability-analysis';
        noDataDiv.style.cssText = `
            background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            margin: 20px 0; padding: 40px; text-align: center;
        `;
        noDataDiv.innerHTML = `
            <div style="font-size:60px; margin-bottom:20px; color:#95a5a6;">📊</div>
            <h3 style="color:#2c3e50; margin-bottom:15px; font-size:18px;">Aucune donnée TENSION disponible</h3>
            <p style="color:#7f8c8d; margin-bottom:20px; font-size:14px;">
                ${combinedTensionData.length === 0 ? 'Aucune donnée de tension n\'a été trouvée.' : 
                  'Les filtres actuels ne retournent aucune donnée.'}
            </p>
            ${combinedTensionData.length > 0 ? 
                `<div style="margin-top:20px;">
                    <button id="reset-filters-analysis-btn" class="btn btn-primary" style="padding:10px 20px;">
                        🔄 Réinitialiser les filtres
                    </button>
                </div>` : ''}
        `;
        
        const filters = document.getElementById('et-filters-container');
        if (filters) filters.insertAdjacentElement('afterend', noDataDiv);
        else techniqueContent.appendChild(noDataDiv);
        
        const resetBtn = document.getElementById('reset-filters-analysis-btn');
        if (resetBtn) resetBtn.addEventListener('click', resetFilters);
        return;
    }
    
    const stabilityData = analyzeTensionStability(dataToUse);
    const isFiltered = filteredTensionData.length !== combinedTensionData.length;
    
    const analysisDiv = document.createElement('div');
    analysisDiv.id = 'tension-stability-analysis';
    analysisDiv.style.cssText = `
        background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        margin-bottom: 20px; overflow: hidden; animation: fadeIn 0.5s ease;
    `;
    
    analysisDiv.innerHTML = `
        <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:15px 25px;
            font-size:16px; font-weight:600; display:flex; align-items:center; gap:10px;">
            🔄 Analyse de Stabilité de Tension 
            <span style="font-size:12px; background:rgba(255,255,255,0.3); padding:4px 10px; border-radius:12px;">
                ${isFiltered ? `🔍 FILTRÉ (${filteredTensionData.length}/${combinedTensionData.length} lignes)` : '📊 COMPLET'}
            </span>
        </div>
        <div style="padding:20px;" id="stability-content"></div>
    `;
    
    const content = analysisDiv.querySelector('#stability-content');
    
    // Stats résumé
    content.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:15px; margin-bottom:25px;">
            <div style="background:linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding:16px; border-radius:10px;
                border-left:5px solid #22c55e; box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
                <div style="font-size:11px; color:#718096; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                    Stabilité Globale
                </div>
                <div style="font-size:32px; font-weight:800; color:#22c55e; margin-bottom:8px;">
                    ${stabilityData.stabilityPercentage}%
                </div>
                <div style="font-size:12px; color:#64748b;">${stabilityData.days} jour${stabilityData.days !== 1 ? 's' : ''} analysés</div>
            </div>
            <div style="background:linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding:16px; border-radius:10px;
                border-left:5px solid #22c55e; box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
                <div style="font-size:11px; color:#718096; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                    Jours Stables
                </div>
                <div style="font-size:28px; font-weight:800; color:#22c55e; margin-bottom:8px;">${stabilityData.stable}</div>
                <div style="text-align:center; padding:6px 12px; background:rgba(34,197,94,0.1); border-radius:6px;
                    font-size:12px; color:#15803d; font-weight:600;">
                    ${stabilityData.days > 0 ? Math.round((stabilityData.stable/stabilityData.days)*100) : 0}% des jours
                </div>
            </div>
            <div style="background:linear-gradient(135deg, #fef3c7 0%, #ffffff 100%); padding:16px; border-radius:10px;
                border-left:5px solid #f59e0b; box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
                <div style="font-size:11px; color:#718096; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                    Jours Instables
                </div>
                <div style="font-size:28px; font-weight:800; color:#f59e0b; margin-bottom:8px;">${stabilityData.unstable}</div>
                <div style="text-align:center; padding:6px 12px; background:rgba(245,158,11,0.1); border-radius:6px;
                    font-size:12px; color:#92400e; font-weight:600;">
                    ${stabilityData.days > 0 ? Math.round((stabilityData.unstable/stabilityData.days)*100) : 0}% des jours
                </div>
            </div>
            <div style="background:linear-gradient(135deg, #fee2e2 0%, #ffffff 100%); padding:16px; border-radius:10px;
                border-left:5px solid #ef4444; box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
                <div style="font-size:11px; color:#718096; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                    Hors Limites
                </div>
                <div style="font-size:28px; font-weight:800; color:#ef4444; margin-bottom:8px;">${stabilityData.outOfLimits}</div>
                <div style="text-align:center; padding:6px 12px; background:rgba(239,68,68,0.1); border-radius:6px;
                    font-size:12px; color:#991b1b; font-weight:600;">
                    ${stabilityData.days > 0 ? Math.round((stabilityData.outOfLimits/stabilityData.days)*100) : 0}% des jours
                </div>
            </div>
        </div>
    `;
    
    // Conclusion intelligente
    const stablePercent = stabilityData.days > 0 ? Math.round((stabilityData.stable/stabilityData.days)*100) : 0;
    let conclusion = '', recommendations = '', icon = '', title = '', color = '';
    
    if (stabilityData.stabilityPercentage >= 90) {
        title = 'EXCELLENTE STABILITÉ'; icon = '✅'; color = '#166534';
        conclusion = `La tension du système ${stabilityData.systemType} est <strong>excellente</strong> avec ${stablePercent}% de jours stables.`;
        recommendations = 'L\'installation électrique fonctionne de manière optimale. Aucune action requise.';
    } else if (stabilityData.stabilityPercentage >= 80) {
        title = 'STABILITÉ SATISFAISANTE'; icon = '⚠️'; color = '#1e40af';
        conclusion = `La tension est <strong>globalement stable</strong> (${stablePercent}% de jours stables) mais présente des variations importantes certains jours.`;
        recommendations = `Surveillez la variation moyenne de ${stabilityData.averageVariation.toFixed(2)} V/h.`;
    } else if (stabilityData.stabilityPercentage >= 60) {
        title = 'STABILITÉ PRÉOCCUPANTE'; icon = '🔴'; color = '#92400e';
        conclusion = `La tension est <strong>préoccupante</strong> avec seulement ${stablePercent}% de jours stables.`;
        recommendations = `${stabilityData.outOfLimits > 0 ? `${stabilityData.outOfLimits} jour${stabilityData.outOfLimits !== 1 ? 's' : ''} hors limites. ` : ''}Une vérification technique est recommandée.`;
    } else {
        title = 'STABILITÉ CRITIQUE'; icon = '🚫'; color = '#991b1b';
        conclusion = `La tension est <strong>critiquement instable</strong> (${stablePercent}% de jours stables seulement).`;
        recommendations = `${stabilityData.outOfLimits > 0 ? `${stabilityData.outOfLimits} jour${stabilityData.outOfLimits !== 1 ? 's' : ''} présentent des tensions hors limites. ` : ''}<strong>Intervention technique urgente requise.</strong>`;
    }
    
    content.innerHTML += `
        <div style="background:${stabilityData.stabilityPercentage >= 90 ? '#dcfce7' : 
                         stabilityData.stabilityPercentage >= 80 ? '#dbeafe' : 
                         stabilityData.stabilityPercentage >= 60 ? '#fef3c7' : '#fee2e2'};
            border:2px solid ${stabilityData.stabilityPercentage >= 90 ? '#22c55e' : 
                              stabilityData.stabilityPercentage >= 80 ? '#3b82f6' : 
                              stabilityData.stabilityPercentage >= 60 ? '#f59e0b' : '#ef4444'};
            border-radius:10px; padding:16px; margin-bottom:15px;">
            <div style="display:flex; align-items:flex-start; gap:12px;">
                <span style="font-size:24px; line-height:1.2;">${icon}</span>
                <div style="flex:1;">
                    <div style="font-weight:700; color:${color}; margin-bottom:6px; font-size:14px;">${title}</div>
                    <div style="color:${color}; font-size:13px; line-height:1.5; margin-bottom:8px;">${conclusion}</div>
                    <div style="color:#4b5563; font-size:12px; line-height:1.5; padding:8px; background:rgba(255,255,255,0.5); border-radius:4px;">
                        <strong>📋 Recommandation :</strong> ${recommendations}
                    </div>
                </div>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px;
            background:linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); border-radius:10px; border:1px solid #e2e8f0; margin-top:10px;">
            <div style="font-size:12px; color:#64748b; display:flex; align-items:center; gap:8px;">
                <span>📊</span><span>Données basées sur les mesures filtrées</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button id="export-analysis-btn" class="btn btn-secondary" style="padding:8px 15px; font-size:12px;">📥 Exporter l'analyse</button>
                <button id="refresh-analysis-btn" class="btn btn-primary" style="padding:8px 15px; font-size:12px;">🔄 Rafraîchir</button>
            </div>
        </div>
    `;
    
    const filters = document.getElementById('et-filters-container');
    if (filters) filters.insertAdjacentElement('afterend', analysisDiv);
    else techniqueContent.appendChild(analysisDiv);
    
    document.getElementById('export-analysis-btn').addEventListener('click', () => exportTensionAnalysis(stabilityData, dataToUse));
    document.getElementById('refresh-analysis-btn').addEventListener('click', () => {
        analysisDiv.remove();
        displayTensionStabilityAnalysis();
    });
}

function displayCommercialAnalysis() {
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    if (!commercialeContent) return;
    
    // Supprimer analyses existantes
    ['energy-consumption-analysis', 'credit-behavior-analysis'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    
    // Afficher analyses si données disponibles
    if (combinedEnergyData.length > 0) displayEnergyAnalysis();
    if (combinedSoldeData.length > 0) displayCreditAnalysis();
}

function displayEnergyAnalysis() {
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    const consumptionData = analyzeEnergyConsumption(combinedEnergyData);
    
    const analysisDiv = document.createElement('div');
    analysisDiv.id = 'energy-consumption-analysis';
    analysisDiv.style.cssText = `
        background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        margin-bottom: 20px; overflow: hidden;
    `;
    
    analysisDiv.innerHTML = `
        <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:15px 25px;
            font-size:16px; font-weight:600; display:flex; align-items:center; gap:10px;">
            💼 Analyse de Consommation d'Énergie
        </div>
        <div style="padding:20px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:25px;">
                <div style="background:linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding:16px; border-radius:10px;
                    border-left:5px solid #22c55e; box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
                    <div style="font-size:11px; color:#718096; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                        Clients Actifs
                    </div>
                    <div style="font-size:32px; font-weight:800; color:#22c55e; margin-bottom:8px;">${consumptionData.clientCount}</div>
                    <div style="font-size:12px; color:#64748b;">avec données d'énergie</div>
                </div>
                <div style="background:linear-gradient(135deg, #dbeafe 0%, #ffffff 100%); padding:16px; border-radius:10px;
                    border-left:5px solid #3b82f6; box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
                    <div style="font-size:11px; color:#718096; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                        Jours Analysés
                    </div>
                    <div style="font-size:32px; font-weight:800; color:#3b82f6; margin-bottom:8px;">${consumptionData.daysTotal}</div>
                    <div style="font-size:12px; color:#64748b;">période complète</div>
                </div>
            </div>
            <div style="overflow-x:auto; border:1px solid #e2e8f0; border-radius:8px;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead style="background:#f1f5f9;">
                        <tr>
                            <th style="padding:12px 8px; text-align:left; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Client</th>
                            <th style="padding:12px 8px; text-align:center; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Énergie Max (Wh)</th>
                            <th style="padding:12px 8px; text-align:center; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Moyenne (Wh)</th>
                            <th style="padding:12px 8px; text-align:center; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Jours >70%</th>
                            <th style="padding:12px 8px; text-align:center; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Statut</th>
                        </tr>
                    </thead>
                    <tbody id="energy-table-body"></tbody>
                </table>
            </div>
        </div>
    `;
    
    const tbody = analysisDiv.querySelector('#energy-table-body');
    for (let i = 1; i <= 6; i++) {
        const key = `Energie${i}`, maxEnergy = consumptionData.maxEnergyPerClient[key];
        if (maxEnergy !== undefined) {
            const avgEnergy = consumptionData.averageConsumption[key] || 0;
            const daysAbove = consumptionData.daysAboveThreshold[key] || 0;
            const daysPercent = consumptionData.daysTotal > 0 ? Math.round((daysAbove/consumptionData.daysTotal)*100) : 0;
            let status = '', statusColor = '';
            if (daysPercent >= 80) { status = '🔴 Critique'; statusColor = '#ef4444'; }
            else if (daysPercent >= 40) { status = '🟡 Moyen'; statusColor = '#f59e0b'; }
            else { status = '🟢 Bon'; statusColor = '#22c55e'; }
            
            tbody.innerHTML += `
                <tr style="border-bottom:1px solid #f1f5f9; background:${i%2===0?'#fafbfc':'white'};">
                    <td style="padding:10px 8px; color:#1e293b; font-weight:500;">Client ${i}</td>
                    <td style="padding:10px 8px; text-align:center; color:#1e293b; font-weight:600;">${maxEnergy.toFixed(2)}</td>
                    <td style="padding:10px 8px; text-align:center; color:#1e293b; font-weight:500;">${avgEnergy.toFixed(2)}</td>
                    <td style="padding:10px 8px; text-align:center;">
                        <span style="background:rgba(245,158,11,0.1); color:#92400e; padding:4px 8px; border-radius:4px; font-weight:600;">
                            ${daysAbove} jour${daysAbove!==1?'s':''} (${daysPercent}%)
                        </span>
                    </td>
                    <td style="padding:10px 8px; text-align:center; color:${statusColor}; font-weight:600;">${status}</td>
                </tr>
            `;
        }
    }
    
    commercialeContent.insertBefore(analysisDiv, commercialeContent.firstChild);
}

function displayCreditAnalysis() {
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    const creditData = analyzeCreditBehavior(combinedSoldeData);
    
    const analysisDiv = document.createElement('div');
    analysisDiv.id = 'credit-behavior-analysis';
    analysisDiv.style.cssText = `
        background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        margin-bottom: 20px; overflow: hidden;
    `;
    
    // Calcul totaux
    let totalZeroDays = 0, totalPurchases = 0, totalClientsWithData = 0;
    for (let i = 1; i <= 6; i++) {
        const key = `Credit${i}`;
        if (creditData.zeroCreditDays[key] !== undefined) {
            totalZeroDays += creditData.zeroCreditDays[key];
            totalPurchases += creditData.purchasePatterns[key]?.length || 0;
            totalClientsWithData++;
        }
    }
    const avgZeroDays = totalClientsWithData > 0 ? Math.round(totalZeroDays/totalClientsWithData) : 0;
    
    analysisDiv.innerHTML = `
        <div style="background:linear-gradient(135deg, #48bb78 0%, #38a169 100%); color:white; padding:15px 25px;
            font-size:16px; font-weight:600; display:flex; align-items:center; gap:10px;">
            💰 Analyse de Comportement de Crédit
        </div>
        <div style="padding:20px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:15px; margin-bottom:25px;">
                <div style="background:linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding:16px; border-radius:10px;
                    border-left:5px solid #22c55e; box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
                    <div style="font-size:11px; color:#718096; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                        Jours Analysés
                    </div>
                    <div style="font-size:32px; font-weight:800; color:#22c55e; margin-bottom:8px;">${creditData.totalDays}</div>
                </div>
                <div style="background:linear-gradient(135deg, #fed7d7 0%, #ffffff 100%); padding:16px; border-radius:10px;
                    border-left:5px solid #ef4444; box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
                    <div style="font-size:11px; color:#718096; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                        Jours Sans Crédit
                    </div>
                    <div style="font-size:32px; font-weight:800; color:#ef4444; margin-bottom:8px;">${totalZeroDays}</div>
                    <div style="font-size:12px; color:#64748b;">${avgZeroDays} jours/client en moyenne</div>
                </div>
                <div style="background:linear-gradient(135deg, #dbeafe 0%, #ffffff 100%); padding:16px; border-radius:10px;
                    border-left:5px solid #3b82f6; box-shadow:0 2px 8px rgba(0,0,0,0.06); text-align:center;">
                    <div style="font-size:11px; color:#718096; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                        Achats Détectés
                    </div>
                    <div style="font-size:32px; font-weight:800; color:#3b82f6; margin-bottom:8px;">${totalPurchases}</div>
                    <div style="font-size:12px; color:#64748b;">recharges identifiées</div>
                </div>
            </div>
            <div style="overflow-x:auto; border:1px solid #e2e8f0; border-radius:8px;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead style="background:#f1f5f9;">
                        <tr>
                            <th style="padding:12px 8px; text-align:left; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Client</th>
                            <th style="padding:12px 8px; text-align:center; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Crédit Max (jours)</th>
                            <th style="padding:12px 8px; text-align:center; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Moyenne (jours)</th>
                            <th style="padding:12px 8px; text-align:center; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Jours à Zéro</th>
                            <th style="padding:12px 8px; text-align:center; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Nombre d'Achats</th>
                            <th style="padding:12px 8px; text-align:center; color:#475569; font-weight:600; border-bottom:2px solid #cbd5e1;">Fiabilité</th>
                        </tr>
                    </thead>
                    <tbody id="credit-table-body"></tbody>
                </table>
            </div>
        </div>
    `;
    
    const tbody = analysisDiv.querySelector('#credit-table-body');
    for (let i = 1; i <= 6; i++) {
        const key = `Credit${i}`, maxCredit = creditData.maxCredit[key];
        if (maxCredit !== undefined) {
            const avgCredit = creditData.averageCredit[key] || 0;
            const zeroDays = creditData.zeroCreditDays[key] || 0;
            const purchases = creditData.purchasePatterns[key] || [];
            const purchaseCount = purchases.length;
            const reliabilityPercent = creditData.totalDays > 0 ? Math.round(((creditData.totalDays-zeroDays)/creditData.totalDays)*100) : 0;
            let reliability = '', reliabilityColor = '';
            if (reliabilityPercent >= 90) { reliability = '✅ Excellent'; reliabilityColor = '#22c55e'; }
            else if (reliabilityPercent >= 70) { reliability = '👍 Bon'; reliabilityColor = '#3b82f6'; }
            else if (reliabilityPercent >= 50) { reliability = '⚠️ Moyen'; reliabilityColor = '#f59e0b'; }
            else { reliability = '🔴 Faible'; reliabilityColor = '#ef4444'; }
            
            tbody.innerHTML += `
                <tr style="border-bottom:1px solid #f1f5f9; background:${i%2===0?'#fafbfc':'white'};">
                    <td style="padding:10px 8px; color:#1e293b; font-weight:500;">Client ${i}</td>
                    <td style="padding:10px 8px; text-align:center; color:#1e293b; font-weight:600;">${maxCredit.toFixed(0)}</td>
                    <td style="padding:10px 8px; text-align:center; color:#1e293b; font-weight:500;">${avgCredit.toFixed(1)}</td>
                    <td style="padding:10px 8px; text-align:center;">
                        <span style="background:rgba(239,68,68,0.1); color:#991b1b; padding:4px 8px; border-radius:4px; font-weight:600;">
                            ${zeroDays} jour${zeroDays!==1?'s':''}
                        </span>
                    </td>
                    <td style="padding:10px 8px; text-align:center; color:#1e293b; font-weight:500;">${purchaseCount}</td>
                    <td style="padding:10px 8px; text-align:center; color:${reliabilityColor}; font-weight:600;">${reliability} (${reliabilityPercent}%)</td>
                </tr>
            `;
        }
    }
    
    const energyAnalysis = document.getElementById('energy-consumption-analysis');
    if (energyAnalysis) commercialeContent.insertBefore(analysisDiv, energyAnalysis.nextSibling);
    else commercialeContent.appendChild(analysisDiv);
}

// ==================== FONCTIONS DE FILTRAGE ====================
function applyDateFilters() {
    console.log('🔍 Application des filtres de date...', {period:filterPeriod, startDate:filterStartDate, endDate:filterEndDate, month:filterMonth, year:filterYear});
    
    filteredEnergyData = combinedEnergyData;
    filteredTensionData = combinedTensionData;
    
    // Appliquer filtres énergie
    if (combinedEnergyData.length > 0) {
        let filteredEnergy = combinedEnergyData;
        
        if (filterPeriod && filterPeriod !== 'all') {
            const now = new Date();
            let startDate = new Date(now);
            const periods = {
                '5days': () => startDate.setDate(now.getDate()-5), '7days': () => startDate.setDate(now.getDate()-7),
                '15days': () => startDate.setDate(now.getDate()-15), '30days': () => startDate.setDate(now.getDate()-30),
                '2months': () => startDate.setMonth(now.getMonth()-2), '3months': () => startDate.setMonth(now.getMonth()-3),
                '6months': () => startDate.setMonth(now.getMonth()-6), '1year': () => startDate.setFullYear(now.getFullYear()-1)
            };
            if (periods[filterPeriod]) periods[filterPeriod]();
            
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate >= startDate && rowDate <= now;
            });
        }
        else if (filterStartDate || filterEndDate) {
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                let pass = true;
                if (filterStartDate) {
                    const start = new Date(filterStartDate); start.setHours(0,0,0,0);
                    pass = pass && (rowDate >= start);
                }
                if (filterEndDate) {
                    const end = new Date(filterEndDate); end.setHours(23,59,59,999);
                    pass = pass && (rowDate <= end);
                }
                return pass;
            });
        }
        else if (filterMonth && filterYear) {
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate.getFullYear() === filterYear && (rowDate.getMonth()+1) === filterMonth;
            });
        }
        else if (filterYear && !filterMonth) {
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate.getFullYear() === filterYear;
            });
        }
        else if (filterMonth && !filterYear) {
            const currentYear = new Date().getFullYear();
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate.getFullYear() === currentYear && (rowDate.getMonth()+1) === filterMonth;
            });
        }
        
        filteredEnergyData = filteredEnergy;
    }
    
    // Appliquer mêmes filtres tension
    if (combinedTensionData.length > 0) {
        let filteredTension = combinedTensionData;
        
        if (filterPeriod && filterPeriod !== 'all') {
            const now = new Date();
            let startDate = new Date(now);
            const periods = {
                '5days': () => startDate.setDate(now.getDate()-5), '7days': () => startDate.setDate(now.getDate()-7),
                '15days': () => startDate.setDate(now.getDate()-15), '30days': () => startDate.setDate(now.getDate()-30),
                '2months': () => startDate.setMonth(now.getMonth()-2), '3months': () => startDate.setMonth(now.getMonth()-3),
                '6months': () => startDate.setMonth(now.getMonth()-6), '1year': () => startDate.setFullYear(now.getFullYear()-1)
            };
            if (periods[filterPeriod]) periods[filterPeriod]();
            
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate >= startDate && rowDate <= now;
            });
        }
        else if (filterStartDate || filterEndDate) {
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                let pass = true;
                if (filterStartDate) {
                    const start = new Date(filterStartDate); start.setHours(0,0,0,0);
                    pass = pass && (rowDate >= start);
                }
                if (filterEndDate) {
                    const end = new Date(filterEndDate); end.setHours(23,59,59,999);
                    pass = pass && (rowDate <= end);
                }
                return pass;
            });
        }
        else if (filterMonth && filterYear) {
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate.getFullYear() === filterYear && (rowDate.getMonth()+1) === filterMonth;
            });
        }
        else if (filterYear && !filterMonth) {
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate.getFullYear() === filterYear;
            });
        }
        else if (filterMonth && !filterYear) {
            const currentYear = new Date().getFullYear();
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate.getFullYear() === currentYear && (rowDate.getMonth()+1) === filterMonth;
            });
        }
        
        filteredTensionData = filteredTension;
    }
    
    // Réinitialiser pagination
    currentPageEnergy = currentPageTension = currentPageEvent = currentPageSolde = currentPageRecharge = 1;
    
    // Mettre à jour l'affichage
    updateETCharts();
    updateEnergyTable();
    updateTensionTable();
    createTechnicalDataCard();
    
    if (document.getElementById('main-tab-content-technique').classList.contains('active')) {
        displayTensionStabilityAnalysis();
    }
    if (document.getElementById('main-tab-content-commerciale').classList.contains('active')) {
        displayCommercialAnalysis();
    }
}

function createFilterControls() {
    // Supprimer anciens filtres
    const existingFilters = document.getElementById('et-filters-container');
    if (existingFilters) existingFilters.remove();
    
    const techniqueContent = document.getElementById('main-tab-content-technique');
    if (!techniqueContent) return;
    
    // Obtenir dates min/max
    let minDate = '', maxDate = '';
    const allDates = [];
    [combinedTensionData, combinedEnergyData, combinedSoldeData, combinedEventData, combinedRechargeData].forEach(dataset => {
        if (dataset && dataset.length > 0) {
            dataset.forEach(row => {
                if (row['Date et Heure']) {
                    const date = new Date(row['Date et Heure']);
                    if (!isNaN(date.getTime())) allDates.push(date);
                }
            });
        }
    });
    
    if (allDates.length > 0) {
        minDate = new Date(Math.min(...allDates)).toISOString().split('T')[0];
        maxDate = new Date(Math.max(...allDates)).toISOString().split('T')[0];
    } else {
        const today = new Date(), oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear()-1);
        minDate = oneYearAgo.toISOString().split('T')[0];
        maxDate = today.toISOString().split('T')[0];
    }
    
    const filtersContainer = document.createElement('div');
    filtersContainer.id = 'et-filters-container';
    filtersContainer.style.cssText = `
        background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        margin-bottom: 20px; padding: 20px;
    `;
    
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const yearsSet = new Set();
    [combinedTensionData, combinedEnergyData, combinedSoldeData, combinedEventData, combinedRechargeData].forEach(dataset => {
        if (dataset && dataset.length > 0) {
            dataset.forEach(row => {
                if (row['Date et Heure']) {
                    const date = new Date(row['Date et Heure']);
                    if (!isNaN(date.getTime())) yearsSet.add(date.getFullYear());
                }
            });
        }
    });
    if (yearsSet.size === 0) {
        const currentYear = new Date().getFullYear();
        yearsSet.add(currentYear);
        yearsSet.add(currentYear-1);
    }
    const yearsArray = Array.from(yearsSet).sort((a,b) => b-a);
    
    filtersContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; padding-bottom:15px; border-bottom:2px solid #e9ecef;">
            <h3 style="margin:0; color:#2c3e50; font-size:18px; display:flex; align-items:center; gap:10px;">
                🔍 Filtres de Date
                <span style="font-size:12px; color:#3498db; background:#e8f4fd; padding:4px 8px; border-radius:4px;">Onglet Technique</span>
            </h3>
            <div style="display:flex; gap:10px;">
                <button id="reset-filters-btn" class="btn btn-secondary" style="padding:8px 15px; font-size:13px;">🔄 Réinitialiser</button>
                <button id="apply-filters-btn" class="btn btn-primary" style="padding:8px 15px; font-size:13px;">✅ Appliquer</button>
            </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
            <div style="background:#f8f9fa; padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; margin-bottom:15px; color:#2c3e50; font-size:14px; font-weight:600;">📅 Période Prédéfinie</h4>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;" id="period-buttons"></div>
            </div>
            <div style="background:#f8f9fa; padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; margin-bottom:15px; color:#2c3e50; font-size:14px; font-weight:600;">📅 Sélection Manuelle</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div>
                        <label style="display:block; margin-bottom:5px; font-size:13px; color:#495057;">Date de début</label>
                        <input type="date" id="start-date-input" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px;"
                            min="${minDate}" max="${maxDate}" value="${filterStartDate?filterStartDate.toISOString().split('T')[0]:''}">
                        <div style="font-size:11px; color:#6c757d; margin-top:4px;">${formatDisplayDate(minDate)}</div>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-size:13px; color:#495057;">Date de fin</label>
                        <input type="date" id="end-date-input" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px;"
                            min="${minDate}" max="${maxDate}" value="${filterEndDate?filterEndDate.toISOString().split('T')[0]:''}">
                        <div style="font-size:11px; color:#6c757d; margin-top:4px;">${formatDisplayDate(maxDate)}</div>
                    </div>
                </div>
            </div>
            <div style="background:#f8f9fa; padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; margin-bottom:15px; color:#2c3e50; font-size:14px; font-weight:600;">📅 Filtre par Mois/Année</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div>
                        <label style="display:block; margin-bottom:5px; font-size:13px; color:#495057;">Sélectionner l'année</label>
                        <select id="year-filter-select" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px;">
                            <option value="">Toutes les années</option>
                            ${yearsArray.map(year => `<option value="${year}" ${filterYear===year?'selected':''}>${year}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-size:13px; color:#495057;">Sélectionner le mois</label>
                        <select id="month-filter-select" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px;">
                            <option value="">Tous les mois</option>
                            ${monthNames.map((month,idx) => `<option value="${idx+1}" ${filterMonth===idx+1?'selected':''}>${month}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        </div>
        <div style="margin-top:20px; padding:15px; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius:8px; color:white;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:12px; opacity:0.9; margin-bottom:4px;">📊 État du filtrage</div>
                    <div style="font-size:18px; font-weight:600;">${(filteredTensionData.length+filteredEnergyData.length)!==(combinedTensionData.length+combinedEnergyData.length)?'🔍 FILTRAGE ACTIF':'📊 DONNÉES COMPLÈTES'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:28px; font-weight:700;">${(filteredTensionData.length+filteredEnergyData.length).toLocaleString()}</div>
                    <div style="font-size:11px; opacity:0.8;">/${(combinedTensionData.length+combinedEnergyData.length).toLocaleString()} enregistrements</div>
                </div>
            </div>
        </div>
    `;
    
    const periodButtons = filtersContainer.querySelector('#period-buttons');
    ['5days','7days','15days','30days','2months','3months','6months','1year','all'].forEach(period => {
        const btn = document.createElement('button');
        btn.className = 'period-btn';
        btn.dataset.period = period;
        btn.textContent = period === 'all' ? 'Tout' : period.replace('days',' jours').replace('months',' mois').replace('1year','1 an');
        btn.style.cssText = `padding:10px; border:1px solid #dee2e6; border-radius:4px; background:white; color:#495057;
            cursor:pointer; font-size:12px; transition:all 0.3s;`;
        if (filterPeriod === period) {
            btn.classList.add('active');
            btn.style.cssText = `padding:10px; border:2px solid #3498db; border-radius:4px; background:#3498db;
                color:white; cursor:pointer; font-size:12px; font-weight:bold;`;
        }
        periodButtons.appendChild(btn);
    });
    
    // Insérer dans l'onglet technique
    const technicalCard = document.getElementById('technical-data-card');
    const stabilityAnalysis = document.getElementById('tension-stability-analysis');
    if (technicalCard) techniqueContent.insertBefore(filtersContainer, technicalCard);
    else if (stabilityAnalysis) techniqueContent.insertBefore(filtersContainer, stabilityAnalysis);
    else techniqueContent.insertBefore(filtersContainer, techniqueContent.firstChild);
    
    setupFilterEvents();
}

function setupFilterEvents() {
    // Boutons période
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
                b.style.cssText = `padding:10px; border:1px solid #dee2e6; border-radius:4px; background:white;
                    color:#495057; cursor:pointer; font-size:12px;`;
            });
            this.classList.add('active');
            this.style.cssText = `padding:10px; border:2px solid #3498db; border-radius:4px; background:#3498db;
                color:white; cursor:pointer; font-size:12px; font-weight:bold;`;
            filterPeriod = this.dataset.period;
            if (filterPeriod !== 'all') {
                document.getElementById('start-date-input').value = '';
                document.getElementById('end-date-input').value = '';
                document.getElementById('year-filter-select').value = '';
                document.getElementById('month-filter-select').value = '';
                filterStartDate = filterEndDate = filterMonth = filterYear = null;
            }
        });
    });
    
    // Appliquer filtres
    document.getElementById('apply-filters-btn').addEventListener('click', function() {
        const startDateInput = document.getElementById('start-date-input').value;
        const endDateInput = document.getElementById('end-date-input').value;
        const yearFilter = document.getElementById('year-filter-select').value;
        const monthFilter = document.getElementById('month-filter-select').value;
        
        if (startDateInput) filterStartDate = new Date(startDateInput + 'T00:00:00');
        else filterStartDate = null;
        if (endDateInput) filterEndDate = new Date(endDateInput + 'T23:59:59');
        else filterEndDate = null;
        
        if (yearFilter && monthFilter) {
            filterYear = parseInt(yearFilter);
            filterMonth = parseInt(monthFilter);
            filterPeriod = 'all';
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.period-btn[data-period="all"]').classList.add('active');
        } else if (yearFilter || monthFilter) {
            filterYear = filterMonth = null;
            document.getElementById('year-filter-select').value = '';
            document.getElementById('month-filter-select').value = '';
            alert('Veuillez sélectionner à la fois un mois et une année');
            return;
        } else {
            filterYear = filterMonth = null;
        }
        
        if (startDateInput || endDateInput) {
            filterPeriod = 'all';
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.period-btn[data-period="all"]').classList.add('active');
        }
        
        applyDateFilters();
        showMessage('Filtres appliqués');
    });
    
    // Réinitialiser
    document.getElementById('reset-filters-btn').addEventListener('click', resetFilters);
}

function resetFilters() {
    filterStartDate = filterEndDate = null;
    filterPeriod = 'all';
    filterMonth = filterYear = null;
    filteredEnergyData = combinedEnergyData;
    filteredTensionData = combinedTensionData;
    
    const startDateInput = document.getElementById('start-date-input');
    const endDateInput = document.getElementById('end-date-input');
    const yearFilterSelect = document.getElementById('year-filter-select');
    const monthFilterSelect = document.getElementById('month-filter-select');
    
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    if (yearFilterSelect) yearFilterSelect.value = '';
    if (monthFilterSelect) monthFilterSelect.value = '';
    
    document.querySelectorAll('.period-btn').forEach(b => {
        b.classList.remove('active');
        b.style.cssText = `padding:10px; border:1px solid #dee2e6; border-radius:4px; background:white;
            color:#495057; cursor:pointer; font-size:12px;`;
    });
    
    const allBtn = document.querySelector('.period-btn[data-period="all"]');
    if (allBtn) {
        allBtn.classList.add('active');
        allBtn.style.cssText = `padding:10px; border:2px solid #3498db; border-radius:4px; background:#3498db;
            color:white; cursor:pointer; font-size:12px; font-weight:bold;`;
    }
    
    updateETCharts();
    updateEnergyTable();
    updateTensionTable();
    createTechnicalDataCard();
    
    if (document.getElementById('main-tab-content-technique').classList.contains('active')) {
        const existingAnalysis = document.getElementById('tension-stability-analysis');
        if (existingAnalysis) existingAnalysis.remove();
        displayTensionStabilityAnalysis();
    }
    
    showMessage('Filtres réinitialisés');
}

// ==================== ÉCRAN DE CHARGEMENT ====================
function showLoadingScreen() {
    const mainElement = document.querySelector('.analyze-main');
    mainElement.querySelectorAll('.main-tabs-container').forEach(el => { el.style.display = 'none'; });
    
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.style.cssText = `
        position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.95);
        display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:1000;
    `;
    
    loadingScreen.innerHTML = `
        <div style="text-align:center; max-width:600px; padding:40px;">
            <div class="loading-spinner-large"><div class="spinner"></div></div>
            <h2 style="color:#2c3e50; margin-top:30px; margin-bottom:20px;">📊 Analyse en cours...</h2>
            <p style="color:#7f8c8d; font-size:16px; margin-bottom:10px;">Chargement et analyse des fichiers du dossier</p>
            <p id="loading-folder-name" style="color:#3498db; font-weight:bold; font-size:18px; margin-bottom:30px;">
                ${escapeHtml(currentFolder.name)}
            </p>
            <div style="background:#f8f9fa; border-radius:10px; padding:20px; margin-bottom:20px; width:100%;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span style="color:#2c3e50; font-size:14px;">Progression</span>
                    <span id="loading-percentage" style="color:#3498db; font-weight:bold; font-size:14px;">0%</span>
                </div>
                <div style="background:#e9ecef; height:10px; border-radius:5px; overflow:hidden;">
                    <div id="loading-progress-bar" style="height:100%; background:linear-gradient(90deg, #3498db, #2ecc71); width:0%; transition:width 0.3s ease;"></div>
                </div>
                <div id="loading-status" style="color:#7f8c8d; font-size:13px; margin-top:10px; text-align:center;">Initialisation...</div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:15px; margin-top:20px; width:100%;">
                <div style="background:#e8f4fd; padding:15px; border-radius:8px; text-align:center;">
                    <div style="font-size:24px; color:#2980b9; font-weight:bold;" id="loaded-files-count">0</div>
                    <div style="font-size:12px; color:#7f8c8d;">Fichiers chargés</div>
                </div>
                <div style="background:#f0f8f0; padding:15px; border-radius:8px; text-align:center;">
                    <div style="font-size:24px; color:#27ae60; font-weight:bold;" id="total-files-count">0</div>
                    <div style="font-size:12px; color:#7f8c8d;">Fichiers au total</div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(loadingScreen);
}

function updateLoadingProgress() {
    const progressBar = document.getElementById('loading-progress-bar');
    const percentage = document.getElementById('loading-percentage');
    const loadedCount = document.getElementById('loaded-files-count');
    const totalCount = document.getElementById('total-files-count');
    const status = document.getElementById('loading-status');
    
    if (progressBar && percentage && loadedCount && totalCount && status) {
        const progress = totalFilesToLoad > 0 ? Math.round((loadedFilesCount/totalFilesToLoad)*100) : 0;
        progressBar.style.width = progress + '%';
        percentage.textContent = progress + '%';
        loadedCount.textContent = loadedFilesCount;
        totalCount.textContent = totalFilesToLoad;
        status.textContent = loadedFilesCount < totalFilesToLoad ? 
            `Chargement du fichier ${loadedFilesCount+1} sur ${totalFilesToLoad}...` : 
            'Analyse des données et création des tableaux...';
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            if (loadingScreen.parentNode) document.body.removeChild(loadingScreen);
            const mainElement = document.querySelector('.analyze-main');
            mainElement.querySelectorAll('.main-tabs-container').forEach(el => { el.style.display = ''; });
        }, 500);
    }
}

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Page d\'analyse initialisée');
    initializeAnalyzePage();
});

async function initializeAnalyzePage() {
    const folderJSON = sessionStorage.getItem('analyzeFolder');
    if (!folderJSON) { showError('Aucun dossier sélectionné'); return; }
    
    try {
        currentFolder = JSON.parse(folderJSON);
        folderStructure = currentFolder.structure;
        displayFolderInfo();
        
        // Réinitialiser données
        energyData = []; tensionData = []; eventData = []; soldeData = []; rechargeData = [];
        combinedEnergyData = []; combinedTensionData = []; combinedEventData = []; combinedSoldeData = []; combinedRechargeData = [];
        filteredEnergyData = []; filteredTensionData = [];
        currentPageEnergy = currentPageTension = currentPageEvent = currentPageSolde = currentPageRecharge = 1;
        loadedFilesCount = 0;
        filterStartDate = filterEndDate = null; filterPeriod = 'all'; filterMonth = filterYear = null;
        
        // Compter fichiers
        totalFilesToLoad = 0;
        const countFiles = (structure) => {
            if (structure.files && structure.files.length > 0) totalFilesToLoad += structure.files.length;
            if (structure.subdirs && structure.subdirs.length > 0) structure.subdirs.forEach(subdir => countFiles(subdir));
        };
        countFiles(folderStructure);
        
        showLoadingScreen();
        createMainTabs();
        createCombinedTables();
        setupEventListeners();
        await loadFilesContent();
        
        setTimeout(() => {
            hideLoadingScreen();
            createTechnicalDataCard();
            if (document.getElementById('main-tab-content-technique').classList.contains('active')) {
                displayTensionStabilityAnalysis();
            }
        }, 500);
        
        console.log('✅ Page d\'analyse prête');
    } catch (error) {
        console.error('❌ Erreur:', error);
        showError('Erreur lors du chargement du dossier: ' + error.message);
        hideLoadingScreen();
    }
}

function displayFolderInfo() {
    const titleEl = document.getElementById('folder-title');
    const subtitleEl = document.getElementById('folder-info-subtitle');
    titleEl.textContent = '📂 NR-' + escapeHtml(currentFolder.name);
    subtitleEl.textContent = 'Créé le ' + currentFolder.date;
}

function setupEventListeners() {
    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.addEventListener('click', () => {
        sessionStorage.removeItem('analyzeFolder');
        window.location.href = 'folderUpload.html';
    });
}

// ==================== ONGLETS PRINCIPAUX ====================
function createMainTabs() {
    const mainElement = document.querySelector('.analyze-main');
    const existingTabsContainer = document.querySelector('.tabs-container');
    if (existingTabsContainer) existingTabsContainer.remove();
    
    const mainTabsContainer = document.createElement('div');
    mainTabsContainer.className = 'main-tabs-container';
    mainTabsContainer.style.cssText = `
        background: white; border-radius: 12px; margin-bottom: 20px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden;
    `;
    
    mainTabsContainer.innerHTML = `
        <div class="main-tabs-header" style="display:flex; background:#f8f9fa; border-bottom:2px solid #e9ecef; padding:0;">
            <button id="main-tab-technique" class="main-tab-btn active" style="flex:1; padding:18px 25px;
                background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; border:none;
                font-size:16px; font-weight:600; cursor:pointer; transition:all 0.3s ease; display:flex;
                align-items:center; justify-content:center; gap:10px;">🔧 TECHNIQUE</button>
            <button id="main-tab-commerciale" class="main-tab-btn" style="flex:1; padding:18px 25px;
                background:#e9ecef; color:#6c757d; border:none; font-size:16px; font-weight:600; cursor:pointer;
                transition:all 0.3s ease; display:flex; align-items:center; justify-content:center; gap:10px;">💰 COMMERCIALE</button>
        </div>
        <div class="main-tabs-content" style="padding:0;">
            <div id="main-tab-content-technique" class="main-tab-content active" style="padding:0; display:block;"></div>
            <div id="main-tab-content-commerciale" class="main-tab-content" style="padding:0; display:none;"></div>
        </div>
    `;
    
    mainElement.appendChild(mainTabsContainer);
    
    document.getElementById('main-tab-technique').addEventListener('click', () => showMainTab('technique'));
    document.getElementById('main-tab-commerciale').addEventListener('click', () => showMainTab('commerciale'));
}

function showMainTab(tabName) {
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.id === `main-tab-${tabName}`) {
            btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            btn.style.color = 'white';
        } else {
            btn.style.background = '#e9ecef';
            btn.style.color = '#6c757d';
        }
    });
    
    document.querySelectorAll('.main-tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    const activeContent = document.getElementById(`main-tab-content-${tabName}`);
    if (activeContent) {
        activeContent.classList.add('active');
        activeContent.style.display = 'block';
        if (tabName === 'technique') {
            if (!document.getElementById('et-filters-container')) createFilterControls();
            displayTensionStabilityAnalysis();
        } else if (tabName === 'commerciale') {
            displayCommercialAnalysis();
        }
    }
}

// ==================== TABLEAUX COMBINÉS ====================
function createCombinedTables() {
    // Onglet TECHNIQUE
    const techniqueContent = document.getElementById('main-tab-content-technique');
    const techniqueGrid = document.createElement('div');
    techniqueGrid.style.cssText = `display:flex; flex-direction:column; gap:30px; padding:20px;`;
    
    ['ENERGIE','TENSION','EVENT'].forEach((type, idx) => {
        const colors = [['#3498db','#2980b9'],['#e74c3c','#c0392b'],['#f39c12','#d35400']];
        const container = document.createElement('div');
        container.id = `combined-${type.toLowerCase()}-container`;
        container.style.cssText = `
            background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1); overflow:hidden; flex:1;
        `;
        container.innerHTML = `
            <div style="background:linear-gradient(135deg, ${colors[idx][0]} 0%, ${colors[idx][1]} 100%);
                color:white; padding:15px 25px; font-size:18px; font-weight:600; display:flex;
                justify-content:space-between; align-items:center;">
                <span>${type==='ENERGIE'?'⚡':type==='TENSION'?'📊':'⚠️'} Tableau ${type}${type==='ENERGIE'?' (Clients)':type==='EVENT'?' des ÉVÉNEMENTS':''}</span>
            </div>
            <div id="combined-${type.toLowerCase()}-table-content" style="padding:20px;">
                <div class="loading"><div class="spinner"></div>
                <p style="margin-top:10px; color:#7f8c8d;">Analyse des fichiers ${type}...</p></div>
            </div>
        `;
        techniqueGrid.appendChild(container);
    });
    techniqueContent.appendChild(techniqueGrid);
    
    // Onglet COMMERCIALE
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    const commercialeGrid = document.createElement('div');
    commercialeGrid.style.cssText = `display:flex; flex-direction:column; gap:30px; padding:20px;`;
    
    ['SOLDE','RECHARGE'].forEach((type, idx) => {
        const colors = [['#27ae60','#2ecc71'],['#9b59b6','#8e44ad']];
        const container = document.createElement('div');
        container.id = `combined-${type.toLowerCase()}-container`;
        container.style.cssText = `
            background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1); overflow:hidden; flex:1;
        `;
        container.innerHTML = `
            <div style="background:linear-gradient(135deg, ${colors[idx][0]} 0%, ${colors[idx][1]} 100%);
                color:white; padding:15px 25px; font-size:18px; font-weight:600; display:flex;
                justify-content:space-between; align-items:center;">
                <span>${type==='SOLDE'?'💰':'⚡'} Tableau ${type}${type==='SOLDE'?' (Crédits)':''}</span>
            </div>
            <div id="combined-${type.toLowerCase()}-table-content" style="padding:20px;">
                <div class="loading"><div class="spinner"></div>
                <p style="margin-top:10px; color:#7f8c8d;">Analyse des fichiers ${type}...</p></div>
            </div>
        `;
        commercialeGrid.appendChild(container);
    });
    commercialeContent.appendChild(commercialeGrid);
}

// ==================== GRAPHIQUES ====================
function createTotalEnergyChart() {
    const dataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    if (dataToUse.length === 0) return;
    
    const dailyTotalEnergy = {};
    dataToUse.forEach(row => {
        if (!row['Date et Heure']) return;
        const date = row['Date et Heure'].split(' ')[0];
        if (!dailyTotalEnergy[date]) dailyTotalEnergy[date] = [0,0,0,0,0,0];
        for (let i = 1; i <= 6; i++) {
            const val = parseFloat(row[`Energie${i}`]) || 0;
            if (val > dailyTotalEnergy[date][i-1]) dailyTotalEnergy[date][i-1] = val;
        }
    });
    
    const dates = Object.keys(dailyTotalEnergy).sort();
    const totalEnergyData = dates.map(date => dailyTotalEnergy[date].reduce((a,b) => a+b, 0));
    
    // Créer conteneur graphique
    const existingChart = document.getElementById('total-energy-chart-container');
    if (existingChart) existingChart.remove();
    
    const energyTableContent = document.getElementById('combined-energy-table-content');
    const filters = document.getElementById('et-filters-container');
    
    const chartContainer = document.createElement('div');
    chartContainer.id = 'total-energy-chart-container';
    chartContainer.style.cssText = `
        background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1); margin-bottom:20px; overflow:hidden;
    `;
    chartContainer.innerHTML = `
        <div style="background:linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color:white; padding:12px 25px;
            font-size:16px; font-weight:600; display:flex; align-items:center; gap:10px;">
            📊 Total Énergie Max par Jour (Tous Clients)
        </div>
        <div style="padding:20px; height:300px;"><canvas id="total-energy-chart-canvas" style="width:100%; height:100%;"></canvas></div>
    `;
    
    if (filters) energyTableContent.insertBefore(chartContainer, filters.nextSibling);
    else energyTableContent.insertBefore(chartContainer, energyTableContent.firstChild);
    
    setTimeout(() => {
        if (typeof Chart === 'undefined') return;
        const ctx = document.getElementById('total-energy-chart-canvas');
        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy();
        
        new Chart(ctx, {
            type: 'bar',
            data: { labels: dates, datasets: [{
                label: 'Total Énergie Max (Wh)', data: totalEnergyData,
                backgroundColor: 'rgba(46, 204, 113, 0.6)', borderColor: 'rgba(39, 174, 96, 1)', borderWidth: 1, borderRadius: 4
            }]},
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
                scales: {
                    x: { title: { display: true, text: 'Date', font: { size: 12, weight: 'bold' } }, ticks: { maxRotation: 45, font: { size: 10 } } },
                    y: { title: { display: true, text: 'Énergie Totale Max (Wh)', font: { size: 12, weight: 'bold' } }, ticks: { font: { size: 10 } }, beginAtZero: true }
                }
            }
        });
    }, 50);
}

function createTensionChart() {
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    if (dataToUse.length === 0) return;
    
    const dailyData = {};
    dataToUse.forEach(row => {
        if (!row['Date et Heure']) return;
        const date = row['Date et Heure'].split(' ')[0];
        const tMin = parseFloat(row['T_min']) || 0, tMoy = parseFloat(row['T_moy']) || 0, tMax = parseFloat(row['T_max']) || 0;
        if (!dailyData[date]) dailyData[date] = { min: tMin, max: tMax, sumMoy: tMoy, countMoy: 1 };
        else {
            if (tMin > 0 && tMin < dailyData[date].min) dailyData[date].min = tMin;
            if (tMax > 0 && tMax > dailyData[date].max) dailyData[date].max = tMax;
            dailyData[date].sumMoy += tMoy; dailyData[date].countMoy++;
        }
    });
    
    const dates = Object.keys(dailyData).sort();
    const minValues = dates.map(date => dailyData[date].min);
    const maxValues = dates.map(date => dailyData[date].max);
    const avgValues = dates.map(date => dailyData[date].sumMoy / dailyData[date].countMoy);
    
    const existingChart = document.getElementById('tension-chart-container');
    if (existingChart) existingChart.remove();
    
    const tensionTableContent = document.getElementById('combined-tension-table-content');
    const chartContainer = document.createElement('div');
    chartContainer.id = 'tension-chart-container';
    chartContainer.style.cssText = `
        background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1); margin-bottom:20px; overflow:hidden;
    `;
    chartContainer.innerHTML = `
        <div style="background:linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color:white; padding:12px 25px;
            font-size:16px; font-weight:600; display:flex; align-items:center; gap:10px;">
            📊 Tension - Min, Max et Moyenne par Jour
        </div>
        <div style="padding:20px; height:300px;"><canvas id="tension-chart-canvas" style="width:100%; height:100%;"></canvas></div>
    `;
    
    if (tensionTableContent.children.length > 0) tensionTableContent.insertBefore(chartContainer, tensionTableContent.firstChild);
    else tensionTableContent.appendChild(chartContainer);
    
    setTimeout(() => {
        if (typeof Chart === 'undefined') return;
        const ctx = document.getElementById('tension-chart-canvas');
        const existingChart = Chart.getChart(ctx);
        if (existingChart) existingChart.destroy();
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    { label: 'Tension Min', data: minValues, borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', borderWidth: 2, fill: false, tension: 0.4 },
                    { label: 'Tension Moyenne', data: avgValues, borderColor: '#2ecc71', backgroundColor: 'rgba(46,204,113,0.1)', borderWidth: 3, fill: false, tension: 0.4 },
                    { label: 'Tension Max', data: maxValues, borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', borderWidth: 2, fill: false, tension: 0.4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
                scales: {
                    x: { title: { display: true, text: 'Date', font: { size: 12, weight: 'bold' } }, ticks: { maxRotation: 45, font: { size: 10 } } },
                    y: { title: { display: true, text: 'Tension (V)', font: { size: 12, weight: 'bold' } }, ticks: { font: { size: 10 } } }
                }
            }
        });
    }, 50);
}

function updateETCharts() {
    const totalEnergyCanvas = document.getElementById('total-energy-chart-canvas');
    if (totalEnergyCanvas) {
        const totalEnergyChart = Chart.getChart(totalEnergyCanvas);
        if (totalEnergyChart) totalEnergyChart.destroy();
    }
    const tensionCanvas = document.getElementById('tension-chart-canvas');
    if (tensionCanvas) {
        const tensionChart = Chart.getChart(tensionCanvas);
        if (tensionChart) tensionChart.destroy();
    }
    
    const totalEnergyContainer = document.getElementById('total-energy-chart-container');
    if (totalEnergyContainer) totalEnergyContainer.remove();
    const tensionContainer = document.getElementById('tension-chart-container');
    if (tensionContainer) tensionContainer.remove();
    
    createTotalEnergyChart();
    createTensionChart();
    createTechnicalDataCard();
}

// ==================== MISE À JOUR DES TABLEAUX ====================
function updateEnergyTable() {
    const tableContent = document.getElementById('combined-energy-table-content');
    if (combinedEnergyData.length === 0) {
        tableContent.innerHTML = `<div class="empty-message"><div class="empty-icon">🔍</div><p>Aucune donnée ENERGIE valide trouvée</p></div>`;
        return;
    }
    
    const dataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    totalRowsEnergy = dataToUse.length;
    
    if (!document.getElementById('et-filters-container')) createFilterControls();
    setTimeout(() => { if (!document.getElementById('total-energy-chart-container') && typeof Chart !== 'undefined') createTotalEnergyChart(); }, 100);
    
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'energy-controls-div';
    controlsDiv.style.cssText = `
        display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;
        padding:10px; background:#f8f9fa; border-radius:6px; flex-wrap:wrap; gap:10px;
    `;
    
    const totalPages = Math.ceil(totalRowsEnergy / rowsPerPage);
    controlsDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:14px; color:#2c3e50;">
                Affichage: <strong>${((currentPageEnergy-1)*rowsPerPage+1).toLocaleString()}</strong>
                à <strong>${Math.min(currentPageEnergy*rowsPerPage, totalRowsEnergy).toLocaleString()}</strong>
                sur <strong>${totalRowsEnergy.toLocaleString()}</strong> lignes
            </span>
            <span style="font-size:12px; color:#27ae60; background:#e8f6ef; padding:4px 8px; border-radius:4px;">
                ${filteredEnergyData.length !== combinedEnergyData.length ? '🔍 FILTRÉ' : '📊 COMPLET'}
            </span>
        </div>
        <div style="display:flex; align-items:center; gap:5px;">
            <button id="energy-first-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPageEnergy===1?'disabled':''}>««</button>
            <button id="energy-prev-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPageEnergy===1?'disabled':''}>«</button>
            <span style="padding:5px 15px; font-size:13px; color:#2c3e50;">Page <strong>${currentPageEnergy}</strong> sur <strong>${totalPages}</strong></span>
            <button id="energy-next-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPageEnergy===totalPages?'disabled':''}>»</button>
            <button id="energy-last-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPageEnergy===totalPages?'disabled':''}>»»</button>
        </div>
    `;
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'energy-table-wrapper';
    tableWrapper.style.cssText = `
        width:100%; max-height:600px; overflow:auto; border:1px solid #dee2e6; border-radius:8px; position:relative;
    `;
    
    const table = document.createElement('table');
    table.id = 'combined-energy-data-table';
    table.className = 'combined-data-table';
    table.style.cssText = `width:100%; border-collapse:collapse; font-size:11px;`;
    
    const headers = ['Date et Heure','Energie1','Energie2','Energie3','Energie4','Energie5','Energie6'];
    let theadHTML = `<thead style="position:sticky; top:0; z-index:10; background:white;"><tr>`;
    headers.forEach((header, idx) => {
        theadHTML += `<th style="padding:10px 4px; text-align:${idx===0?'left':'center'}; background:${idx===0?'#2c3e50':'#3498db'};
            color:white; border:1px solid #dee2e6; font-weight:600; white-space:nowrap; ${idx===0?'position:sticky; left:0; z-index:11;':''}
            min-width:${idx===0?'160px':'75px'}; font-size:10.5px;">${header}</th>`;
    });
    theadHTML += `</tr></thead>`;
    table.innerHTML = theadHTML;
    
    const filters = document.getElementById('et-filters-container');
    const totalEnergyChart = document.getElementById('total-energy-chart-container');
    tableContent.innerHTML = '';
    if (filters) tableContent.appendChild(filters);
    if (totalEnergyChart) tableContent.appendChild(totalEnergyChart);
    tableContent.appendChild(controlsDiv);
    tableContent.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    
    renderTablePage('energy', dataToUse);
    setupTableControls('energy', dataToUse);
    
    tableContent.innerHTML += `
        <div style="margin-top:15px; font-size:11px; color:#7f8c8d; text-align:center; padding:10px; border-top:1px solid #ecf0f1;">
            <div>Tableau ENERGIE généré le ${new Date().toLocaleString()}</div>
            <div style="margin-top:5px; font-size:10px;">
                ${filteredEnergyData.length !== combinedEnergyData.length ? 
                  `🔍 Filtre actif: ${filteredEnergyData.length} lignes sur ${combinedEnergyData.length} totales` : 
                  '📊 Données complètes'}
            </div>
        </div>
    `;
}

function updateTensionTable() {
    const tableContent = document.getElementById('combined-tension-table-content');
    if (combinedTensionData.length === 0) {
        tableContent.innerHTML = `<div class="empty-message"><div class="empty-icon">🔍</div><p>Aucune donnée TENSION valide trouvée</p></div>`;
        return;
    }
    
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    totalRowsTension = dataToUse.length;
    
    setTimeout(() => { if (!document.getElementById('tension-chart-container') && typeof Chart !== 'undefined') createTensionChart(); }, 100);
    
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'tension-controls-div';
    controlsDiv.style.cssText = `
        display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;
        padding:10px; background:#f8f9fa; border-radius:6px; flex-wrap:wrap; gap:10px;
    `;
    
    const totalPages = Math.ceil(totalRowsTension / rowsPerPage);
    controlsDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:14px; color:#2c3e50;">
                Affichage: <strong>${((currentPageTension-1)*rowsPerPage+1).toLocaleString()}</strong>
                à <strong>${Math.min(currentPageTension*rowsPerPage, totalRowsTension).toLocaleString()}</strong>
                sur <strong>${totalRowsTension.toLocaleString()}</strong> lignes
            </span>
            <span style="font-size:12px; color:#27ae60; background:#e8f6ef; padding:4px 8px; border-radius:4px;">
                ${filteredTensionData.length !== combinedTensionData.length ? '🔍 FILTRÉ' : '📊 COMPLET'}
            </span>
        </div>
        <div style="display:flex; align-items:center; gap:5px;">
            <button id="tension-first-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPageTension===1?'disabled':''}>««</button>
            <button id="tension-prev-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPageTension===1?'disabled':''}>«</button>
            <span style="padding:5px 15px; font-size:13px; color:#2c3e50;">Page <strong>${currentPageTension}</strong> sur <strong>${totalPages}</strong></span>
            <button id="tension-next-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPageTension===totalPages?'disabled':''}>»</button>
            <button id="tension-last-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPageTension===totalPages?'disabled':''}>»»</button>
        </div>
    `;
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'tension-table-wrapper';
    tableWrapper.style.cssText = `
        width:100%; max-height:600px; overflow:auto; border:1px solid #dee2e6; border-radius:8px; position:relative;
    `;
    
    const table = document.createElement('table');
    table.id = 'combined-tension-data-table';
    table.className = 'combined-data-table';
    table.style.cssText = `width:100%; border-collapse:collapse; font-size:11px;`;
    
    const headers = ['Date et Heure','T_min','T_moy','T_max'];
    let theadHTML = `<thead style="position:sticky; top:0; z-index:10; background:white;"><tr>`;
    headers.forEach((header, idx) => {
        theadHTML += `<th style="padding:10px 4px; text-align:${idx===0?'left':'center'}; background:${idx===0?'#2c3e50':'#e74c3c'};
            color:white; border:1px solid #dee2e6; font-weight:600; white-space:nowrap; ${idx===0?'position:sticky; left:0; z-index:11;':''}
            min-width:${idx===0?'160px':'75px'}; font-size:10.5px;">${header}</th>`;
    });
    theadHTML += `</tr></thead>`;
    table.innerHTML = theadHTML;
    
    const tensionChart = document.getElementById('tension-chart-container');
    tableContent.innerHTML = '';
    if (tensionChart) tableContent.appendChild(tensionChart);
    tableContent.appendChild(controlsDiv);
    tableContent.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    
    renderTablePage('tension', dataToUse);
    setupTableControls('tension', dataToUse);
    
    tableContent.innerHTML += `
        <div style="margin-top:15px; font-size:11px; color:#7f8c8d; text-align:center; padding:10px; border-top:1px solid #ecf0f1;">
            <div>Tableau TENSION généré le ${new Date().toLocaleString()}</div>
            <div style="margin-top:5px; font-size:10px;">
                ${filteredTensionData.length !== combinedTensionData.length ? 
                  `🔍 Filtre actif: ${filteredTensionData.length} lignes sur ${combinedTensionData.length} totales` : 
                  '📊 Données complètes'}
            </div>
        </div>
    `;
}

// Fonction générique pour rendre les pages de tableaux
function renderTablePage(type, dataToUse) {
    const table = document.getElementById(`combined-${type}-data-table`);
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) oldTbody.remove();
    
    const tbody = document.createElement('tbody');
    const currentPage = eval(`currentPage${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const totalRows = eval(`totalRows${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
    
    const columns = {
        'energy': ['Date et Heure','Energie1','Energie2','Energie3','Energie4','Energie5','Energie6'],
        'tension': ['Date et Heure','T_min','T_moy','T_max'],
        'event': ['Date et Heure','Évènements','Code 1','Code 2','Code 3'],
        'solde': ['Date et Heure','Credit1','Credit2','Credit3','Credit4','Credit5','Credit6'],
        'recharge': ['Date et Heure','Code enregistrer','Type de code','Status','Code 1','Code 2','Code 3','Code 4']
    };
    
    const renderBatch = (batchStart, batchEnd) => {
        const fragment = document.createDocumentFragment();
        
        for (let i = batchStart; i < batchEnd; i++) {
            const rowIndex = startIndex + i;
            const row = dataToUse[rowIndex];
            if (!row) continue;
            
            const tr = document.createElement('tr');
            tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
            
            columns[type].forEach((col, colIdx) => {
                const td = document.createElement('td');
                const value = row[col] || '';
                
                if (col === 'Date et Heure') {
                    td.textContent = value || '-';
                    td.style.cssText = `
                        padding:6px 4px; border:1px solid #dee2e6; text-align:left; vertical-align:middle;
                        white-space:nowrap; background:${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'};
                        position:sticky; left:0; z-index:1; font-family:'Courier New', monospace; font-size:10px;
                    `;
                } else {
                    if (value && value !== '' && value !== '-') {
                        const numValue = parseFloat(value.replace(',', '.'));
                        td.textContent = isNaN(numValue) ? value : numValue.toFixed(2);
                        if (type === 'energy') td.style.color = '#2980b9';
                        else if (type === 'tension') td.style.color = '#c0392b';
                        else if (type === 'solde') { td.style.color = '#27ae60'; td.style.fontWeight = 'bold'; }
                        else if (type === 'recharge' && col.startsWith('Code ')) { td.style.color = '#8e44ad'; td.style.fontWeight = 'bold'; }
                        else if (type === 'event' && col === 'Évènements') {
                            if (value.toLowerCase().includes('surcharge')) td.style.color = '#e74c3c';
                            else if (value.toLowerCase().includes('panne')) td.style.color = '#d35400';
                            else if (value.toLowerCase().includes('démarrage')) td.style.color = '#27ae60';
                            else if (value.toLowerCase().includes('arrêt')) td.style.color = '#7f8c8d';
                            td.style.fontWeight = 'bold';
                        }
                    } else {
                        td.textContent = '-';
                        td.style.color = '#95a5a6';
                        td.style.fontStyle = 'italic';
                    }
                    
                    td.style.cssText = `
                        padding:6px 4px; border:1px solid #dee2e6; text-align:center; vertical-align:middle;
                        white-space:nowrap; font-size:10px;
                    `;
                    
                    if (type === 'event' && col === 'Évènements') {
                        td.style.textAlign = 'left';
                        if (value.toLowerCase().includes('surcharge')) td.style.background = (i % 2 === 0) ? '#fdeded' : '#fbd5d5';
                        else if (value.toLowerCase().includes('panne')) td.style.background = (i % 2 === 0) ? '#fef5e7' : '#fde8bd';
                        else if (value.toLowerCase().includes('démarrage')) td.style.background = (i % 2 === 0) ? '#e8f6ef' : '#d4efdf';
                        else if (value.toLowerCase().includes('arrêt')) td.style.background = (i % 2 === 0) ? '#f2f4f4' : '#e5e8e8';
                    }
                }
                
                tr.appendChild(td);
            });
            
            fragment.appendChild(tr);
        }
        
        tbody.appendChild(fragment);
        
        if (batchEnd < (endIndex - startIndex)) {
            setTimeout(() => {
                renderBatch(batchEnd, Math.min(batchEnd + 100, endIndex - startIndex));
            }, 0);
        } else {
            table.appendChild(tbody);
        }
    };
    
    renderBatch(0, Math.min(100, endIndex - startIndex));
    updatePaginationControls(type);
}

function setupTableControls(type, dataToUse) {
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    document.getElementById(`${type}-first-page-btn`).addEventListener('click', () => {
        eval(`currentPage${capitalizedType} = 1`);
        renderTablePage(type, dataToUse);
    });
    
    document.getElementById(`${type}-prev-page-btn`).addEventListener('click', () => {
        if (eval(`currentPage${capitalizedType}`) > 1) {
            eval(`currentPage${capitalizedType}--`);
            renderTablePage(type, dataToUse);
        }
    });
    
    document.getElementById(`${type}-next-page-btn`).addEventListener('click', () => {
        const totalPages = Math.ceil(eval(`totalRows${capitalizedType}`) / rowsPerPage);
        if (eval(`currentPage${capitalizedType}`) < totalPages) {
            eval(`currentPage${capitalizedType}++`);
            renderTablePage(type, dataToUse);
        }
    });
    
    document.getElementById(`${type}-last-page-btn`).addEventListener('click', () => {
        eval(`currentPage${capitalizedType} = Math.ceil(eval('totalRows' + capitalizedType) / rowsPerPage)`);
        renderTablePage(type, dataToUse);
    });
}

function updatePaginationControls(type) {
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    const totalPages = Math.ceil(eval(`totalRows${capitalizedType}`) / rowsPerPage);
    const currentPage = eval(`currentPage${capitalizedType}`);
    
    const pageInfo = document.querySelector(`#${type}-controls-div span:nth-child(2)`);
    if (pageInfo) pageInfo.innerHTML = `Page <strong>${currentPage}</strong> sur <strong>${totalPages}</strong>`;
    
    document.getElementById(`${type}-first-page-btn`).disabled = currentPage === 1;
    document.getElementById(`${type}-prev-page-btn`).disabled = currentPage === 1;
    document.getElementById(`${type}-next-page-btn`).disabled = currentPage === totalPages;
    document.getElementById(`${type}-last-page-btn`).disabled = currentPage === totalPages;
}

// Mêmes fonctions pour event, solde, recharge (simplifiées)
function updateEventTable() { updateGenericTable('event', combinedEventData, '#f39c12', '#d35400'); }
function updateSoldeTable() { updateGenericTable('solde', combinedSoldeData, '#27ae60', '#2ecc71'); }
function updateRechargeTable() { updateGenericTable('recharge', combinedRechargeData, '#9b59b6', '#8e44ad'); }

function updateGenericTable(type, data, color1, color2) {
    const tableContent = document.getElementById(`combined-${type}-table-content`);
    if (data.length === 0) {
        tableContent.innerHTML = `<div class="empty-message"><div class="empty-icon">${type==='event'?'⚠️':type==='solde'?'💰':'⚡'}</div><p>Aucune donnée ${type.toUpperCase()} valide trouvée</p></div>`;
        return;
    }
    
    eval(`totalRows${type.charAt(0).toUpperCase() + type.slice(1)} = data.length`);
    
    const controlsDiv = document.createElement('div');
    controlsDiv.id = `${type}-controls-div`;
    controlsDiv.style.cssText = `
        display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;
        padding:10px; background:#f8f9fa; border-radius:6px; flex-wrap:wrap; gap:10px;
    `;
    
    const totalPages = Math.ceil(eval(`totalRows${type.charAt(0).toUpperCase() + type.slice(1)}`) / rowsPerPage);
    const currentPage = eval(`currentPage${type.charAt(0).toUpperCase() + type.slice(1)}`);
    
    controlsDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:14px; color:#2c3e50;">
                Affichage: <strong>${((currentPage-1)*rowsPerPage+1).toLocaleString()}</strong>
                à <strong>${Math.min(currentPage*rowsPerPage, eval('totalRows' + type.charAt(0).toUpperCase() + type.slice(1))).toLocaleString()}</strong>
                sur <strong>${eval('totalRows' + type.charAt(0).toUpperCase() + type.slice(1)).toLocaleString()}</strong> lignes
            </span>
        </div>
        <div style="display:flex; align-items:center; gap:5px;">
            <button id="${type}-first-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPage===1?'disabled':''}>««</button>
            <button id="${type}-prev-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12xx;" ${currentPage===1?'disabled':''}>«</button>
            <span style="padding:5px 15px; font-size:13px; color:#2c3e50;">Page <strong>${currentPage}</strong> sur <strong>${totalPages}</strong></span>
            <button id="${type}-next-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPage===totalPages?'disabled':''}>»</button>
            <button id="${type}-last-page-btn" class="btn btn-secondary" style="padding:5px 10px; font-size:12px;" ${currentPage===totalPages?'disabled':''}>»»</button>
        </div>
    `;
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = `${type}-table-wrapper`;
    tableWrapper.style.cssText = `
        width:100%; max-height:600px; overflow:auto; border:1px solid #dee2e6; border-radius:8px; position:relative;
    `;
    
    const table = document.createElement('table');
    table.id = `combined-${type}-data-table`;
    table.className = 'combined-data-table';
    table.style.cssText = `width:100%; border-collapse:collapse; font-size:11px;`;
    
    tableContent.innerHTML = '';
    tableContent.appendChild(controlsDiv);
    tableContent.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    
    renderTablePage(type, data);
    setupTableControls(type, data);
    
    tableContent.innerHTML += `
        <div style="margin-top:15px; font-size:11px; color:#7f8c8d; text-align:center; padding:10px; border-top:1px solid #ecf0f1;">
            <div>Tableau ${type.toUpperCase()} généré le ${new Date().toLocaleString()}</div>
        </div>
    `;
}

// ==================== PARSING ET COMBINAISON DES DONNÉES ====================
function parseAndCombineData() {
    parseAndCombineEnergyData();
    parseAndCombineTensionData();
    parseAndCombineEventData();
    parseAndCombineSoldeData();
    parseAndCombineRechargeData();
    
    setTimeout(() => { createTechnicalDataCard(); }, 100);
}

function parseAndCombineEnergyData() {
    const dataMap = new Map();
    energyData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 8) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) dataMap.set(timestamp, {
                        'Date et Heure': timestamp,
                        'Energie1':'','Energie2':'','Energie3':'','Energie4':'','Energie5':'','Energie6':''
                    });
                    const row = dataMap.get(timestamp);
                    for (let i = 2; i <= 7; i++) row[`Energie${i-1}`] = parts[i] ? parts[i].trim() : '';
                }
            }
        });
    });
    
    combinedEnergyData = Array.from(dataMap.values())
        .filter(row => row['Date et Heure'])
        .sort((a,b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
    filteredEnergyData = combinedEnergyData;
}

function parseAndCombineTensionData() {
    const dataMap = new Map();
    tensionData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 5) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) dataMap.set(timestamp, {
                        'Date et Heure': timestamp, 'T_min':'', 'T_moy':'', 'T_max':''
                    });
                    const row = dataMap.get(timestamp);
                    row['T_min'] = parts[2] ? parts[2].trim() : '';
                    row['T_moy'] = parts[3] ? parts[3].trim() : '';
                    row['T_max'] = parts[4] ? parts[4].trim() : '';
                }
            }
        });
    });
    
    combinedTensionData = Array.from(dataMap.values())
        .filter(row => row['Date et Heure'])
        .sort((a,b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
    filteredTensionData = combinedTensionData;
}

function parseAndCombineEventData() {
    const dataMap = new Map();
    eventData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 6) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) dataMap.set(timestamp, {
                        'Date et Heure': timestamp, 'Évènements':'', 'Code 1':'', 'Code 2':'', 'Code 3':''
                    });
                    const row = dataMap.get(timestamp);
                    row['Évènements'] = parts[2] ? parts[2].trim() : '';
                    for (let i = 3; i <= 5; i++) row[`Code ${i-2}`] = parts[i] ? parts[i].trim() : '';
                }
            }
        });
    });
    
    combinedEventData = Array.from(dataMap.values())
        .filter(row => row['Date et Heure'])
        .sort((a,b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
}

function parseAndCombineSoldeData() {
    const dataMap = new Map();
    soldeData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 8) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) dataMap.set(timestamp, {
                        'Date et Heure': timestamp,
                        'Credit1':'','Credit2':'','Credit3':'','Credit4':'','Credit5':'','Credit6':''
                    });
                    const row = dataMap.get(timestamp);
                    for (let i = 2; i <= 7; i++) row[`Credit${i-1}`] = parts[i] ? parts[i].trim() : '';
                }
            }
        });
    });
    
    combinedSoldeData = Array.from(dataMap.values())
        .filter(row => row['Date et Heure'])
        .sort((a,b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
}

function parseAndCombineRechargeData() {
    const dataMap = new Map();
    rechargeData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 10) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) dataMap.set(timestamp, {
                        'Date et Heure': timestamp, 'Code enregistrer':'', 'Type de code':'', 'Status':'',
                        'Code 1':'','Code 2':'','Code 3':'','Code 4':''
                    });
                    const row = dataMap.get(timestamp);
                    row['Code enregistrer'] = parts[2] ? parts[2].trim() : '';
                    row['Type de code'] = parts[3] ? parts[3].trim() : '';
                    row['Status'] = parts[4] ? parts[4].trim() : '';
                    for (let i = 5; i <= 8; i++) row[`Code ${i-4}`] = parts[i] ? parts[i].trim() : '';
                }
            }
        });
    });
    
    combinedRechargeData = Array.from(dataMap.values())
        .filter(row => row['Date et Heure'])
        .sort((a,b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
}

// ==================== CHARGEMENT DES FICHIERS ====================
async function loadFilesContent() {
    await loadFilesFromStructure(folderStructure, '');
}

async function loadFilesFromStructure(structure, parentPath) {
    if (structure.files && structure.files.length > 0) {
        for (const filename of structure.files) {
            const fullPath = parentPath ? parentPath + '/' + filename : filename;
            await loadFileContent(filename, fullPath);
        }
    }
    
    if (structure.subdirs && structure.subdirs.length > 0) {
        for (const subdir of structure.subdirs) {
            const newPath = parentPath ? parentPath + '/' + subdir.name : subdir.name;
            await loadFilesFromStructure(subdir, newPath);
        }
    }
}

async function loadFileContent(filename, fullPath) {
    try {
        const filePath = currentFolder.folderPath + '\\' + fullPath;
        const result = await window.electronAPI.readFileContent(filePath);
        
        loadedFilesCount++;
        updateLoadingProgress();
        
        if (result.success) {
            const type = filename.toLowerCase().includes('energie') ? 'ENERGIE' :
                        filename.toLowerCase().includes('tens') ? 'TENSION' :
                        filename.toLowerCase().includes('event') ? 'EVENT' :
                        filename.toLowerCase().includes('solde') ? 'SOLDE' :
                        filename.toLowerCase().includes('recharge') ? 'RECHARGE' : null;
            
            if (type) {
                const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
                const lines = parseCSVContent(result.content, type);
                
                const fileData = {
                    filename, path: fullPath, folder: folderPath || 'Racine',
                    content: result.content, lines, type
                };
                
                eval(`${type.toLowerCase()}Data.push(fileData)`);
                
                if (lines.length > 0) {
                    parseAndCombineData();
                    eval(`update${type === 'ENERGIE' ? 'Energy' : type === 'TENSION' ? 'Tension' : 
                          type === 'EVENT' ? 'Event' : type === 'SOLDE' ? 'Solde' : 'Recharge'}Table()`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Erreur lors de la lecture:', filename, error);
        loadedFilesCount++;
        updateLoadingProgress();
    }
}

// ==================== EXPORT ANALYSE ====================
function exportTensionAnalysis(stabilityData, rawData) {
    try {
        const exportData = {
            metadata: {
                generated: new Date().toISOString(),
                folder: currentFolder.name,
                systemType: stabilityData.systemType,
                period: stabilityData.days + ' jours',
                totalRecords: rawData.length
            },
            summary: {
                stabilityPercentage: stabilityData.stabilityPercentage + '%',
                stableDays: stabilityData.stable,
                unstableDays: stabilityData.unstable,
                outOfLimitsDays: stabilityData.outOfLimits,
                averageVariation: stabilityData.averageVariation + ' V/h'
            },
            limits: stabilityData.limits,
            recommendation: stabilityData.stabilityPercentage >= 90 ? 
                "La stabilité de tension est excellente. Aucune action requise." :
                stabilityData.stabilityPercentage >= 80 ? 
                "Stabilité satisfaisante. Surveiller régulièrement les variations." :
                stabilityData.stabilityPercentage >= 60 ? 
                "Stabilité préoccupante. Vérification technique recommandée." :
                "Stabilité critique. Intervention technique urgente requise."
        };
        
        const jsonContent = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analyse_tension_NR-${currentFolder.name}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('✅ Analyse exportée avec succès');
    } catch (error) {
        console.error('Erreur exportation:', error);
        showMessage('❌ Erreur lors de l\'exportation', 'error');
    }
}

// ==================== ANIMATIONS CSS ====================
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes slideIn { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
    @keyframes slideOut { from { transform:translateX(0); opacity:1; } to { transform:translateX(100%); opacity:0; } }
`;
document.head.appendChild(style);