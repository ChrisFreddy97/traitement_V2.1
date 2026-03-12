// ==================== VARIABLES GLOBALES ====================
let currentFolder = null;
let folderStructure = null;
let energyData = [];
let tensionData = [];
let eventData = [];
let soldeData = [];
let rechargeData = [];
let combinedEnergyData = [];
let combinedTensionData = [];
let combinedEventData = [];
let combinedSoldeData = [];
let combinedRechargeData = [];
let filteredEnergyData = [];
let filteredTensionData = [];
let currentPageEnergy = 1;
let currentPageTension = 1;
let currentPageEvent = 1;
let currentPageSolde = 1;
let currentPageRecharge = 1;
let rowsPerPage = 1000;
let totalRowsEnergy = 0;
let totalRowsTension = 0;
let totalRowsEvent = 0;
let totalRowsSolde = 0;
let totalRowsRecharge = 0;
let totalFilesToLoad = 0;
let loadedFilesCount = 0;

// Variables pour les filtres
let filterStartDate = null;
let filterEndDate = null;
let filterPeriod = 'all';
let filterMonth = null;
let filterYear = null;

// ==================== DICTIONNAIRE DES FORFAITS ====================
const FORFAIT_NAMES = {
    1: "ECO",
    2: "ECLAIRAGE",
    3: "ECLAIRAGE +",
    4: "MULTIMEDIA",
    5: "MULTIMEDIA +",
    6: "PRENIUM",
    7: "Eclairage + PREF",
    8: "Eclairage Public 5h",
    9: "Eclairage Public Pref",
    12: "CONGEL",
    14: "FRIGO",
    16: "CSB",
    17: "CSB Congel",
    32: "CONGEL -5°C",
    34: "CONGEL -10°C"
};

// Fonction utilitaire pour obtenir le nom du forfait
function getForfaitName(code) {
    const numCode = parseInt(code);
    return FORFAIT_NAMES[numCode] || `Forfait ${code}`; // Retourne le nom ou "Forfait X" si non trouvé
}
// ==================== LIMITES DE CONSOMMATION PAR FORFAIT ====================
const FORFAIT_LIMITS = {
    "ECO": { max: 50, heures: 5, tolerance: 15 }, // 15% de tolérance
    "ECLAIRAGE": { max: 90, heures: 5, tolerance: 15 },
    "ECLAIRAGE +": { max: 150, heures: 5, tolerance: 15 },
    "MULTIMEDIA": { max: 210, heures: 5, tolerance: 15 },
    "MULTIMEDIA +": { max: 210, heures: 5, tolerance: 15 },
    "ECLAIRAGE PUBLIC": { max: 150, heures: 11, tolerance: 15 },
    "Eclairage Public 5h": { max: 150, heures: 5, tolerance: 15 },
    "Eclairage Public Pref": { max: 150, heures: 11, tolerance: 15 },
    "Eclairage + PREF": { max: 150, heures: 11, tolerance: 15 },
    "CONGEL": { max: 1250, heures: 24, tolerance: 15 },
    "CONGEL -5°C": { max: 1250, heures: 24, tolerance: 15 },
    "CONGEL -10°C": { max: 1250, heures: 24, tolerance: 15 },
    "FRIGO": { max: 500, heures: 24, tolerance: 15 },
    "PRENIUM": { max: 500, heures: 24, tolerance: 15 },
    "CSB": { max: 1250, heures: 24, tolerance: 15 },
    "CSB Congel": { max: 1250, heures: 24, tolerance: 15 }
};

// Ajouter les alias pour les noms qui peuvent varier
const FORFAIT_ALIAS = {
    "FREEZER 1": "CONGEL",
    "FREEZER 3": "CONGEL"
};
function getForfaitLimits(forfaitName) {
    // Vérifier les alias d'abord
    if (FORFAIT_ALIAS[forfaitName]) {
        forfaitName = FORFAIT_ALIAS[forfaitName];
    }
    return FORFAIT_LIMITS[forfaitName] || { max: 0, heures: 0 };
}

// ==================== UTILITAIRES ====================

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showError(message) {
    const main = document.querySelector('.analyze-main');
    if (main) {
        main.innerHTML = `
            <div class="error-message">
                <strong>❌ Erreur:</strong> ${escapeHtml(message)}
            </div>
            <button class="btn btn-secondary" onclick="window.location.href='folderUpload.html'">
                ← Retour
            </button>
        `;
    }
}

function parseCSVContent(content, type) {
    const lines = content.split('\n');
    const parsedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === '') continue;
        
        if (type === 'ENERGIE' && trimmed.startsWith('C;')) {
            parsedLines.push(trimmed);
        } else if (type === 'TENSION' && trimmed.startsWith('T;')) {
            parsedLines.push(trimmed);
        } else if (type === 'EVENT' && trimmed.startsWith('E;')) {
            parsedLines.push(trimmed);
        } else if (type === 'SOLDE' && trimmed.startsWith('S;')) {
            parsedLines.push(trimmed);
        } else if (type === 'RECHARGE' && trimmed.startsWith('R;')) {
            parsedLines.push(trimmed);
        }
    }
    
    return parsedLines;
}

// ==================== FONCTIONS D'ANALYSE SYSTÈME ====================

function detectSystemType(tensionResults) {
    if (!tensionResults || tensionResults.length === 0) return '12V';
    const tensions = [];
    tensionResults.forEach(item => {
        const tMoy = parseFloat(item['T_moy']) || 0;
        const tMax = parseFloat(item['T_max']) || 0;
        if (tMoy > 0) tensions.push(tMoy);
        if (tMax > 0) tensions.push(tMax);
    });
    if (tensions.length === 0) return '12V';
    const avgTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;
    const maxTension = Math.max(...tensions);
    return (maxTension > 20 || avgTension > 18) ? '24V' : '12V';
}

function getSystemLimits(systemType) {
    if (systemType === '24V') {
        return {
            min: 22,
            max: 31,
            ideal: { min: 24, max: 29 },
            normal: 28,
            maxVariation: 5,
            alertThreshold: 3
        };
    } else {
        return {
            min: 11,
            max: 15,
            ideal: { min: 12, max: 14.5 },
            normal: 14,
            maxVariation: 2.5,
            alertThreshold: 1.5
        };
    }
}

// ==================== CALCULS TECHNIQUES ====================

function calculateMaxDailyVariation(tensionData) {
    if (!tensionData || tensionData.length === 0) {
        return { value: 0, date: 'Non disponible' };
    }
    const dailyData = {};
    tensionData.forEach(row => {
        if (!row['Date et Heure']) return;
        const date = row['Date et Heure'].split(' ')[0];
        const tMin = parseFloat(row['T_min']) || 0;
        const tMax = parseFloat(row['T_max']) || 0;
        if (tMin > 0 && tMax > 0) {
            if (!dailyData[date]) {
                dailyData[date] = {
                    min: tMin,
                    max: tMax,
                    variation: tMax - tMin
                };
            } else {
                dailyData[date].min = Math.min(dailyData[date].min, tMin);
                dailyData[date].max = Math.max(dailyData[date].max, tMax);
                dailyData[date].variation = dailyData[date].max - dailyData[date].min;
            }
        }
    });
    let maxVariation = 0;
    let maxVariationDate = '';
    Object.entries(dailyData).forEach(([date, data]) => {
        if (data.variation > maxVariation) {
            maxVariation = data.variation;
            maxVariationDate = date;
        }
    });
    return {
        value: maxVariation.toFixed(2),
        date: maxVariationDate ? new Date(maxVariationDate).toLocaleDateString('fr-FR') : 'Non disponible'
    };
}

function calculateTechnicalData() {
    const energyDataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    const tensionDataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    
    const data = {
        period: '',
        totalDays: 0,
        clientCount: 0,
        maxEnergy: { value: 0, date: '' },
        avgEnergy: { value: 0 },
        avgTension: { value: 0 },
        minTension: { value: 100, date: '' },
        maxTension: { value: 0, date: '' },
        tensionSystem: 'Système 12V'
    };
    
    // Calcul des jours uniques
    if (tensionDataToUse.length > 0 || energyDataToUse.length > 0) {
        const uniqueDays = new Set();
        tensionDataToUse.forEach(row => {
            if (row['Date et Heure']) {
                const dateStr = row['Date et Heure'].split(' ')[0];
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) uniqueDays.add(dateStr);
            }
        });
        if (uniqueDays.size === 0) {
            energyDataToUse.forEach(row => {
                if (row['Date et Heure']) {
                    const dateStr = row['Date et Heure'].split(' ')[0];
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) uniqueDays.add(dateStr);
                }
            });
        }
        data.totalDays = uniqueDays.size;
        data.period = uniqueDays.size > 0 ? `${uniqueDays.size} jour${uniqueDays.size !== 1 ? 's' : ''}` : 'Données en cours...';
    }
    
    // Calcul du nombre de clients
    if (energyDataToUse.length > 0) {
        let clientCount = 0;
        for (let i = 1; i <= 6; i++) {
            const energyKey = `Energie${i}`;
            let hasData = false;
            const checkRows = Math.min(100, energyDataToUse.length);
            for (let j = 0; j < checkRows; j++) {
                const cellValue = energyDataToUse[j][energyKey];
                if (cellValue && cellValue.toString().trim() !== '' && 
                    cellValue.toString().trim() !== '0' && cellValue.toString().trim() !== '-') {
                    hasData = true;
                    break;
                }
            }
            if (hasData) clientCount++;
        }
        data.clientCount = clientCount > 0 ? clientCount : '0';
    }
    
    // Calcul de l'énergie
    if (energyDataToUse.length > 0) {
        let maxEnergyValue = 0;
        let maxEnergyDate = '';
        const dailyMaxEnergy = {};
        
        energyDataToUse.forEach(row => {
            if (!row['Date et Heure']) return;
            const date = row['Date et Heure'].split(' ')[0];
            if (!dailyMaxEnergy[date]) dailyMaxEnergy[date] = 0;
            
            let dailyTotal = 0;
            for (let i = 1; i <= 6; i++) {
                const energyKey = `Energie${i}`;
                const cellValue = row[energyKey];
                if (cellValue && cellValue.toString().trim() !== '' && cellValue.toString().trim() !== '-') {
                    const energyValue = parseFloat(cellValue.toString().replace(',', '.'));
                    if (!isNaN(energyValue)) dailyTotal += energyValue;
                }
            }
            if (dailyTotal > dailyMaxEnergy[date]) dailyMaxEnergy[date] = dailyTotal;
            if (dailyTotal > maxEnergyValue) {
                maxEnergyValue = dailyTotal;
                maxEnergyDate = row['Date et Heure'];
            }
        });
        
        const dailyMaxValues = Object.values(dailyMaxEnergy).filter(v => v > 0);
        if (maxEnergyValue > 0) {
            data.maxEnergy.value = maxEnergyValue.toFixed(2) + ' Wh';
            data.maxEnergy.date = maxEnergyDate ? maxEnergyDate.split(' ')[0].split('-').reverse().join('/') : 'Non disponible';
        }
        if (dailyMaxValues.length > 0) {
            data.avgEnergy.value = (dailyMaxValues.reduce((a, b) => a + b, 0) / dailyMaxValues.length).toFixed(2) + ' Wh';
        }
    }
    
    // Calcul de la tension
    if (tensionDataToUse.length > 0) {
        let tensionSum = 0;
        let tensionCount = 0;
        let minTensionValue = 100;
        let maxTensionValue = 0;
        let minTensionDate = '';
        let maxTensionDate = '';
        
        tensionDataToUse.forEach(row => {
            const tMoyStr = row['T_moy'];
            if (tMoyStr && tMoyStr.toString().trim() !== '' && tMoyStr.toString().trim() !== '-') {
                const tMoy = parseFloat(tMoyStr.toString().replace(',', '.'));
                if (!isNaN(tMoy) && tMoy > 0) {
                    tensionSum += tMoy;
                    tensionCount++;
                }
            }
            const tMinStr = row['T_min'];
            if (tMinStr && tMinStr.toString().trim() !== '' && tMinStr.toString().trim() !== '-') {
                const tMin = parseFloat(tMinStr.toString().replace(',', '.'));
                if (!isNaN(tMin) && tMin > 0 && tMin < minTensionValue) {
                    minTensionValue = tMin;
                    minTensionDate = row['Date et Heure'];
                }
            }
            const tMaxStr = row['T_max'];
            if (tMaxStr && tMaxStr.toString().trim() !== '' && tMaxStr.toString().trim() !== '-') {
                const tMax = parseFloat(tMaxStr.toString().replace(',', '.'));
                if (!isNaN(tMax) && tMax > maxTensionValue) {
                    maxTensionValue = tMax;
                    maxTensionDate = row['Date et Heure'];
                }
            }
        });
        
        if (tensionCount > 0) {
            const avgTension = tensionSum / tensionCount;
            data.avgTension.value = avgTension.toFixed(2) + ' V';
            data.tensionSystem = avgTension > 20 ? 'Système 24V' : avgTension > 10 ? 'Système 12V' : 'Système inconnu';
        }
        if (minTensionValue < 100) {
            data.minTension.value = minTensionValue.toFixed(2) + ' V';
            data.minTension.date = minTensionDate ? minTensionDate.split(' ')[0].split('-').reverse().join('/') : 'Non disponible';
        }
        if (maxTensionValue > 0) {
            data.maxTension.value = maxTensionValue.toFixed(2) + ' V';
            data.maxTension.date = maxTensionDate ? maxTensionDate.split(' ')[0].split('-').reverse().join('/') : 'Non disponible';
        }
    }
    return data;
}

// ==================== ANALYSE STABILITÉ TENSION ====================

function analyzeTensionStability(tensionResults) {
    if (!tensionResults || !tensionResults.length) {
        return {
            stable: 0, unstable: 0, outOfLimits: 0,
            stabilityPercentage: 0, averageVariation: 0,
            days: 0, systemType: '12V', limits: getSystemLimits('12V')
        };
    }
    const dailyData = {};
    tensionResults.forEach(item => {
        const date = item['Date et Heure'] ? item['Date et Heure'].split(' ')[0] : null;
        if (!date) return;
        if (!dailyData[date]) {
            dailyData[date] = { values: [], min: Infinity, max: -Infinity };
        }
        const tMoy = parseFloat(item['T_moy']) || 0;
        const tMin = parseFloat(item['T_min']) || 0;
        const tMax = parseFloat(item['T_max']) || 0;
        if (tMoy > 0) dailyData[date].values.push(tMoy);
        if (tMin > 0) dailyData[date].values.push(tMin);
        if (tMax > 0) dailyData[date].values.push(tMax);
        if (tMin > 0 && tMin < dailyData[date].min) dailyData[date].min = tMin;
        if (tMax > 0 && tMax > dailyData[date].max) dailyData[date].max = tMax;
    });
    const systemType = detectSystemType(tensionResults);
    const limits = getSystemLimits(systemType);
    let stableDays = 0, unstableDays = 0, outOfLimitsDays = 0;
    
    Object.values(dailyData).forEach(day => {
        const variation = day.max - day.min;
        if (day.min < limits.min || day.max > limits.max) outOfLimitsDays++;
        else if (variation > limits.maxVariation) unstableDays++;
        else stableDays++;
    });
    
    const variations = [];
    for (let i = 1; i < tensionResults.length; i++) {
        const prevTMoy = parseFloat(tensionResults[i-1]['T_moy']) || 0;
        const currTMoy = parseFloat(tensionResults[i]['T_moy']) || 0;
        if (prevTMoy > 0 && currTMoy > 0) variations.push(Math.abs(currTMoy - prevTMoy));
    }
    const averageVariation = variations.length > 0 ? (variations.reduce((a, b) => a + b, 0) / variations.length).toFixed(3) : 0;
    const totalDays = Object.keys(dailyData).length;
    const stabilityPercentage = totalDays > 0 ? Math.round((stableDays / totalDays) * 100) : 0;
    
    return { stable: stableDays, unstable: unstableDays, outOfLimits: outOfLimitsDays,
        stabilityPercentage, averageVariation: parseFloat(averageVariation),
        days: totalDays, systemType, limits };
}

function analyzeThresholdExceedances(tensionResults) {
    if (!tensionResults || !tensionResults.length) {
        return {
            daysWithExceedance: 0, totalExceedances: 0, totalHoursOutOfLimits: 0,
            exceedanceDays: [], systemType: '12V', limits: getSystemLimits('12V'), totalDays: 0
        };
    }
    const systemType = detectSystemType(tensionResults);
    const limits = getSystemLimits(systemType);
    const dailyData = {};
    
    tensionResults.forEach(item => {
        if (!item['Date et Heure']) return;
        const date = item['Date et Heure'].split(' ')[0];
        const time = item['Date et Heure'].split(' ')[1] || '';
        const tMin = parseFloat(item['T_min']) || 0;
        const tMax = parseFloat(item['T_max']) || 0;
        const tMoy = parseFloat(item['T_moy']) || 0;
        
        if (!dailyData[date]) {
            dailyData[date] = { date, records: [], minValues: [], maxValues: [], avgValues: [],
                minForDay: Infinity, maxForDay: -Infinity, avgForDay: 0,
                exceedanceCount: 0, hoursOutOfLimits: 0, isOutOfLimits: false };
        }
        dailyData[date].records.push({ time, tMin, tMax, tMoy });
        if (tMin > 0) dailyData[date].minValues.push(tMin);
        if (tMax > 0) dailyData[date].maxValues.push(tMax);
        if (tMoy > 0) dailyData[date].avgValues.push(tMoy);
        if (tMin > 0 && tMin < dailyData[date].minForDay) dailyData[date].minForDay = tMin;
        if (tMax > 0 && tMax > dailyData[date].maxForDay) dailyData[date].maxForDay = tMax;
        
        if ((tMin > 0 && tMin < limits.min) || (tMax > 0 && tMax > limits.max)) {
            dailyData[date].exceedanceCount++;
            dailyData[date].isOutOfLimits = true;
            dailyData[date].hoursOutOfLimits++;
        }
    });
    
    const exceedanceDays = [];
    let totalExceedances = 0, totalHoursOutOfLimits = 0, daysWithExceedance = 0;
    
    Object.keys(dailyData).sort().forEach(date => {
        const day = dailyData[date];
        if (day.avgValues.length > 0) day.avgForDay = day.avgValues.reduce((a, b) => a + b, 0) / day.avgValues.length;
        day.dailyVariation = day.maxForDay - day.minForDay;
        
        if (day.isOutOfLimits) {
            daysWithExceedance++;
            totalExceedances += day.exceedanceCount;
            totalHoursOutOfLimits += day.hoursOutOfLimits;
            
            let hourRange = '';
            if (day.records.length > 0) {
                const times = day.records
                    .filter(r => (r.tMin > 0 && r.tMin < limits.min) || (r.tMax > 0 && r.tMax > limits.max))
                    .map(r => r.time.split(':').slice(0, 2).join(':'));
                if (times.length > 0) {
                    const uniqueTimes = [...new Set(times)].sort();
                    hourRange = uniqueTimes.length > 3 ? `${uniqueTimes[0]} - ${uniqueTimes[uniqueTimes.length-1]}` : uniqueTimes.join(', ');
                }
            }
            
            let minOutOfLimit = null, maxOutOfLimit = null, minValue = null, maxValue = null;
            day.records.forEach(r => {
                if (r.tMin > 0 && r.tMin < limits.min) {
                    if (minOutOfLimit === null || r.tMin < minOutOfLimit) {
                        minOutOfLimit = r.tMin;
                        minValue = r.tMin;
                    }
                }
                if (r.tMax > 0 && r.tMax > limits.max) {
                    if (maxOutOfLimit === null || r.tMax > maxOutOfLimit) {
                        maxOutOfLimit = r.tMax;
                        maxValue = r.tMax;
                    }
                }
            });
            
            exceedanceDays.push({
                date: day.date,
                formattedDate: new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                dailyVariation: day.dailyVariation > 0 ? day.dailyVariation.toFixed(2) : '-',
                exceedanceCount: day.exceedanceCount,
                hoursOutOfLimits: day.hoursOutOfLimits,
                hourRange,
                minValue: minValue !== null ? minValue.toFixed(2) : '-',
                maxValue: maxValue !== null ? maxValue.toFixed(2) : '-',
                minOutOfLimit: minOutOfLimit !== null ? minOutOfLimit.toFixed(2) : '-',
                maxOutOfLimit: maxOutOfLimit !== null ? maxOutOfLimit.toFixed(2) : '-',
                minTension: day.minForDay !== Infinity ? day.minForDay.toFixed(2) : '-',
                maxTension: day.maxForDay !== -Infinity ? day.maxForDay.toFixed(2) : '-',
                avgTension: day.avgForDay.toFixed(2)
            });
        }
    });
    
    exceedanceDays.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { daysWithExceedance, totalExceedances, totalHoursOutOfLimits,
        exceedanceDays, systemType, limits, totalDays: Object.keys(dailyData).length };
}

// ==================== ANALYSE COMMERCIALE ====================

function analyzeEnergyConsumption(energyData) {
    if (!energyData || energyData.length === 0) {
        return { clientCount: 0, daysTotal: 0, maxEnergyPerClient: {}, averageConsumption: {}, daysAboveThreshold: {} };
    }
    const results = { clientCount: 0, daysTotal: 0, maxEnergyPerClient: {}, averageConsumption: {}, daysAboveThreshold: {} };
    const sampleRow = energyData[0];
    for (let i = 1; i <= 6; i++) {
        const energyKey = `Energie${i}`;
        if (sampleRow.hasOwnProperty(energyKey)) {
            let hasData = false;
            for (let j = 0; j < Math.min(100, energyData.length); j++) {
                const cellValue = energyData[j][energyKey];
                if (cellValue && cellValue.toString().trim() !== '' && 
                    cellValue.toString().trim() !== '0' && cellValue.toString().trim() !== '-') {
                    hasData = true; break;
                }
            }
            if (hasData) results.clientCount++;
        }
    }
    const dailyData = {};
    energyData.forEach(row => {
        if (!row['Date et Heure']) return;
        const date = row['Date et Heure'].split(' ')[0];
        if (!dailyData[date]) dailyData[date] = {};
        for (let i = 1; i <= 6; i++) {
            const energyKey = `Energie${i}`;
            const cellValue = row[energyKey];
            if (cellValue && cellValue.toString().trim() !== '' && cellValue.toString().trim() !== '-') {
                const energyValue = parseFloat(cellValue.toString().replace(',', '.'));
                if (!isNaN(energyValue)) {
                    if (!dailyData[date][energyKey]) dailyData[date][energyKey] = [];
                    dailyData[date][energyKey].push(energyValue);
                }
            }
        }
    });
    results.daysTotal = Object.keys(dailyData).length;
    
    for (let i = 1; i <= 6; i++) {
        const energyKey = `Energie${i}`;
        const clientData = [];
        Object.values(dailyData).forEach(day => {
            if (day[energyKey] && day[energyKey].length > 0) {
                clientData.push(Math.max(...day[energyKey]));
            }
        });
        if (clientData.length > 0) {
            results.maxEnergyPerClient[energyKey] = Math.max(...clientData);
            results.averageConsumption[energyKey] = clientData.reduce((a, b) => a + b, 0) / clientData.length;
            results.daysAboveThreshold[energyKey] = clientData.filter(value => value > 50 * 0.7).length;
        }
    }
    return results;
}

function analyzeCreditBehavior(creditData) {
    if (!creditData || creditData.length === 0) {
        return { totalDays: 0, zeroCreditDays: {}, averageCredit: {}, maxCredit: {}, purchasePatterns: {} };
    }
    const results = { totalDays: 0, zeroCreditDays: {}, averageCredit: {}, maxCredit: {}, purchasePatterns: {} };
    const dailyData = {};
    creditData.forEach(row => {
        if (!row['Date et Heure']) return;
        const date = row['Date et Heure'].split(' ')[0];
        if (!dailyData[date]) dailyData[date] = {};
        for (let i = 1; i <= 6; i++) {
            const creditKey = `Credit${i}`;
            const cellValue = row[creditKey];
            if (cellValue && cellValue.toString().trim() !== '' && cellValue.toString().trim() !== '-') {
                const creditValue = parseFloat(cellValue.toString().replace(',', '.'));
                if (!isNaN(creditValue)) dailyData[date][creditKey] = creditValue;
            }
        }
    });
    results.totalDays = Object.keys(dailyData).length;
    
    for (let i = 1; i <= 6; i++) {
        const creditKey = `Credit${i}`;
        const clientData = [];
        let zeroDays = 0, previousCredit = null;
        const purchases = [];
        const sortedDates = Object.keys(dailyData).sort();
        
        sortedDates.forEach(date => {
            const credit = dailyData[date][creditKey];
            if (credit !== undefined) {
                clientData.push(credit);
                if (credit === 0) zeroDays++;
                if (previousCredit === 0 && credit > 0) purchases.push({ date, amount: credit });
                previousCredit = credit;
            }
        });
        if (clientData.length > 0) {
            results.zeroCreditDays[creditKey] = zeroDays;
            results.averageCredit[creditKey] = clientData.reduce((a, b) => a + b, 0) / clientData.length;
            results.maxCredit[creditKey] = Math.max(...clientData);
            results.purchasePatterns[creditKey] = purchases;
        }
    }
    return results;
}
function analyzeConsumptionWithForfaitHistory(clientNumber) {
    if (!combinedEnergyData || combinedEnergyData.length === 0) {
        return {
            clientNumber: clientNumber,
            hasData: false,
            totalDays: 0,
            daysAbove90Percent: 0,
            daysBelow90Percent: 0,
            daysInTolerance: 0,
            daysAboveTolerance: 0,
            consumptionByForfait: {},
            forfaitHistory: [],
            forfaitComparisons: []
        };
    }
    
    // Récupérer l'historique des forfaits du client (Code 4)
    const forfaitHistory = [];
    if (combinedRechargeData && combinedRechargeData.length > 0) {
        const clientRecharges = combinedRechargeData
            .filter(row => row['Code 1']?.toString().trim() === clientNumber.toString())
            .sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
        
        clientRecharges.forEach((recharge, index) => {
            const date = new Date(recharge['Date et Heure']);
            const code4 = parseInt(recharge['Code 4']);
            const forfaitName = getForfaitName(code4);
            
            if (index === 0) {
                // Premier forfait connu
                forfaitHistory.push({
                    forfait: forfaitName,
                    forfaitCode: code4,
                    startDate: date,
                    endDate: null,
                    isCurrent: true
                });
            } else if (code4 !== parseInt(clientRecharges[index-1]['Code 4'])) {
                // Changement de forfait
                // Clôturer l'ancien forfait
                forfaitHistory[forfaitHistory.length - 1].endDate = date;
                forfaitHistory[forfaitHistory.length - 1].isCurrent = false;
                
                // Ajouter le nouveau forfait
                forfaitHistory.push({
                    forfait: forfaitName,
                    forfaitCode: code4,
                    startDate: date,
                    endDate: null,
                    isCurrent: true
                });
            }
        });
    }
    
    // Si pas d'historique de forfait, on ne peut pas analyser
    if (forfaitHistory.length === 0) {
        return {
            clientNumber: clientNumber,
            hasData: false,
            totalDays: 0,
            daysAbove90Percent: 0,
            daysBelow90Percent: 0,
            daysInTolerance: 0,
            daysAboveTolerance: 0,
            consumptionByForfait: {},
            forfaitHistory: [],
            forfaitComparisons: []
        };
    }
    
    // Analyser la consommation jour par jour
    const consumptionByDay = {};
    const energyKey = `Energie${clientNumber}`;
    
    combinedEnergyData.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const dateTime = new Date(row['Date et Heure']);
        const dateStr = dateTime.toISOString().split('T')[0];
        const value = parseFloat(row[energyKey]) || 0;
        
        if (!consumptionByDay[dateStr]) {
            consumptionByDay[dateStr] = {
                date: dateStr,
                dateObj: dateTime,
                total: 0,
                count: 0
            };
        }
        
        if (value > 0) {
            consumptionByDay[dateStr].total = Math.max(consumptionByDay[dateStr].total, value);
            consumptionByDay[dateStr].count++;
        }
    });
    
    // Pour chaque jour, trouver le forfait applicable
    const daysAnalysis = [];
    let daysAbove90Percent = 0;
    let daysBelow90Percent = 0;
    let daysInTolerance = 0;
    let daysAboveTolerance = 0;
    const consumptionByForfait = {};
    
    Object.values(consumptionByDay).forEach(day => {
        if (day.total === 0) return;
        
        // Trouver le forfait actif ce jour-là
        let activeForfait = null;
        let activeForfaitCode = null;
        for (let i = forfaitHistory.length - 1; i >= 0; i--) {
            const forfait = forfaitHistory[i];
            if (!forfait.startDate) continue;
            
            const startDate = new Date(forfait.startDate);
            startDate.setHours(0, 0, 0, 0);
            
            if (forfait.endDate) {
                const endDate = new Date(forfait.endDate);
                endDate.setHours(23, 59, 59, 999);
                
                if (day.dateObj >= startDate && day.dateObj <= endDate) {
                    activeForfait = forfait.forfait;
                    activeForfaitCode = forfait.forfaitCode;
                    break;
                }
            } else {
                // Forfait actuel (pas de date de fin)
                if (day.dateObj >= startDate) {
                    activeForfait = forfait.forfait;
                    activeForfaitCode = forfait.forfaitCode;
                    break;
                }
            }
        }
        
        if (!activeForfait) return;
        
        // Obtenir les limites du forfait avec tolérance
        const limits = getForfaitLimits(activeForfait);
        if (limits.max === 0) return;
        
        // Calculer les seuils avec tolérance
        const baseMax = limits.max;
        const tolerancePercent = limits.tolerance || 15; // 15% par défaut
        const toleranceValue = baseMax * (tolerancePercent / 100);
        const maxWithTolerance = baseMax + toleranceValue;
        
        // Seuil d'alerte à 90% du max de base (comme avant)
        const alertThreshold = baseMax * 0.9;
        
        // Calculer les pourcentages
        const percentOfBase = (day.total / baseMax) * 100;
        const percentOfTotal = (day.total / maxWithTolerance) * 100;
        
        // Déterminer les statuts
        const isAbove90 = day.total > alertThreshold;
        const isInTolerance = day.total > baseMax && day.total <= maxWithTolerance;
        const isAboveTolerance = day.total > maxWithTolerance;
        
        if (isAbove90) daysAbove90Percent++;
        else daysBelow90Percent++;
        
        if (isInTolerance) daysInTolerance++;
        if (isAboveTolerance) daysAboveTolerance++;
        
        // Stocker par forfait
        if (!consumptionByForfait[activeForfait]) {
            consumptionByForfait[activeForfait] = {
                forfait: activeForfait,
                forfaitCode: activeForfaitCode,
                limits: limits,
                baseMax: baseMax,
                maxWithTolerance: maxWithTolerance,
                tolerancePercent: tolerancePercent,
                totalDays: 0,
                daysAbove90: 0,
                daysInTolerance: 0,
                daysAboveTolerance: 0,
                daysBelow90: 0,
                maxConsumption: 0,
                avgConsumption: 0,
                totalConsumption: 0,
                startDate: day.dateObj,
                endDate: day.dateObj
            };
        }
        
        const stats = consumptionByForfait[activeForfait];
        stats.totalDays++;
        if (isAbove90) stats.daysAbove90++;
        if (isInTolerance) stats.daysInTolerance++;
        if (isAboveTolerance) stats.daysAboveTolerance++;
        stats.maxConsumption = Math.max(stats.maxConsumption, day.total);
        stats.totalConsumption += day.total;
        stats.startDate = new Date(Math.min(stats.startDate, day.dateObj));
        stats.endDate = new Date(Math.max(stats.endDate, day.dateObj));
        
        daysAnalysis.push({
            date: day.date,
            dateObj: day.dateObj,
            consumption: day.total,
            forfait: activeForfait,
            baseMax: baseMax,
            maxWithTolerance: maxWithTolerance,
            percentOfBase: percentOfBase.toFixed(1),
            percentOfTotal: percentOfTotal.toFixed(1),
            isAbove90: isAbove90,
            isInTolerance: isInTolerance,
            isAboveTolerance: isAboveTolerance,
            toleranceUsed: isInTolerance ? ((day.total - baseMax) / toleranceValue * 100).toFixed(1) : 0
        });
    });
    
    // Calculer les moyennes et pourcentages par forfait
    Object.keys(consumptionByForfait).forEach(key => {
        const stats = consumptionByForfait[key];
        stats.avgConsumption = stats.totalDays > 0 ? 
            (stats.totalConsumption / stats.totalDays).toFixed(1) : 0;
        stats.percentAbove90 = stats.totalDays > 0 ? 
            ((stats.daysAbove90 / stats.totalDays) * 100).toFixed(1) : 0;
        stats.percentInTolerance = stats.totalDays > 0 ? 
            ((stats.daysInTolerance / stats.totalDays) * 100).toFixed(1) : 0;
        stats.percentAboveTolerance = stats.totalDays > 0 ? 
            ((stats.daysAboveTolerance / stats.totalDays) * 100).toFixed(1) : 0;
        stats.percentOK = stats.totalDays > 0 ? 
            (((stats.totalDays - stats.daysAbove90) / stats.totalDays) * 100).toFixed(1) : 0;
    });
    
    // ANALYSE COMPARATIVE AVANT/APRÈS CHANGEMENT DE FORFAIT
    const forfaitComparisons = [];
    
    for (let i = 1; i < forfaitHistory.length; i++) {
        const oldForfait = forfaitHistory[i-1];
        const newForfait = forfaitHistory[i];
        
        // Récupérer les stats de consommation pour l'ancien et nouveau forfait
        const oldStats = consumptionByForfait[oldForfait.forfait];
        const newStats = consumptionByForfait[newForfait.forfait];
        
        if (oldStats && newStats) {
            // Calculer les différences
            const diffAbove90 = newStats.percentAbove90 - oldStats.percentAbove90;
            const diffInTolerance = newStats.percentInTolerance - oldStats.percentInTolerance;
            const diffAboveTolerance = newStats.percentAboveTolerance - oldStats.percentAboveTolerance;
            
            // Amélioration = baisse des dépassements de tolérance
            const improvement = diffAboveTolerance < 0;
            const reductionValue = oldStats.percentAboveTolerance - newStats.percentAboveTolerance;
            const percentReduction = oldStats.percentAboveTolerance > 0 ? 
                ((reductionValue / oldStats.percentAboveTolerance) * 100).toFixed(1) : 0;
            
            let status = '';
            let statusColor = '';
            let statusIcon = '';
            
            // Déterminer le statut basé sur les dépassements de tolérance
            if (newStats.percentAboveTolerance === 0) {
                status = '✅ PARFAIT - Plus aucun dépassement de tolérance';
                statusColor = '#22c55e';
                statusIcon = '🎉';
            } else if (improvement) {
                if (reductionValue >= 20) {
                    status = `✅ FORTE AMÉLIORATION - Baisse de ${reductionValue.toFixed(1)} points des dépassements`;
                    statusColor = '#22c55e';
                    statusIcon = '📉';
                } else if (reductionValue >= 10) {
                    status = `🟡 AMÉLIORATION MODÉRÉE - Baisse de ${reductionValue.toFixed(1)} points`;
                    statusColor = '#eab308';
                    statusIcon = '📊';
                } else {
                    status = `🟠 LÉGÈRE AMÉLIORATION - Baisse de ${reductionValue.toFixed(1)} points`;
                    statusColor = '#f97316';
                    statusIcon = '➡️';
                }
            } else if (diffAboveTolerance > 0) {
                if (diffAboveTolerance >= 20) {
                    status = `🔴 FORTE AGGRAVATION - Hausse de ${diffAboveTolerance.toFixed(1)} points des dépassements`;
                    statusColor = '#ef4444';
                    statusIcon = '📈';
                } else if (diffAboveTolerance >= 10) {
                    status = `🟠 AGGRAVATION MODÉRÉE - Hausse de ${diffAboveTolerance.toFixed(1)} points`;
                    statusColor = '#f97316';
                    statusIcon = '⚠️';
                } else {
                    status = `🟡 LÉGÈRE AGGRAVATION - Hausse de ${diffAboveTolerance.toFixed(1)} points`;
                    statusColor = '#eab308';
                    statusIcon = '📊';
                }
            } else {
                status = '⚪ STABLE - Pas de changement significatif';
                statusColor = '#94a3b8';
                statusIcon = '➡️';
            }
            
            // Déterminer si le client est encore problématique
            const stillProblematic = newStats.percentAboveTolerance > 20 || newStats.percentAbove90 > 40;
            
            forfaitComparisons.push({
                oldForfait: oldForfait.forfait,
                newForfait: newForfait.forfait,
                changeDate: newForfait.startDate,
                oldStats: {
                    days: oldStats.totalDays,
                    above90: oldStats.daysAbove90,
                    percentAbove90: oldStats.percentAbove90,
                    inTolerance: oldStats.daysInTolerance,
                    percentInTolerance: oldStats.percentInTolerance,
                    aboveTolerance: oldStats.daysAboveTolerance,
                    percentAboveTolerance: oldStats.percentAboveTolerance,
                    maxConsumption: oldStats.maxConsumption,
                    avgConsumption: oldStats.avgConsumption,
                    baseMax: oldStats.baseMax,
                    maxWithTolerance: oldStats.maxWithTolerance
                },
                newStats: {
                    days: newStats.totalDays,
                    above90: newStats.daysAbove90,
                    percentAbove90: newStats.percentAbove90,
                    inTolerance: newStats.daysInTolerance,
                    percentInTolerance: newStats.percentInTolerance,
                    aboveTolerance: newStats.daysAboveTolerance,
                    percentAboveTolerance: newStats.percentAboveTolerance,
                    maxConsumption: newStats.maxConsumption,
                    avgConsumption: newStats.avgConsumption,
                    baseMax: newStats.baseMax,
                    maxWithTolerance: newStats.maxWithTolerance
                },
                improvement: improvement,
                diffAbove90: diffAbove90.toFixed(1),
                diffInTolerance: diffInTolerance.toFixed(1),
                diffAboveTolerance: diffAboveTolerance.toFixed(1),
                percentReduction: percentReduction,
                status: status,
                statusColor: statusColor,
                statusIcon: statusIcon,
                stillProblematic: stillProblematic
            });
        }
    }
    
    // Analyser la situation actuelle
    const currentForfait = forfaitHistory.find(f => f.isCurrent);
    const currentStats = currentForfait ? consumptionByForfait[currentForfait.forfait] : null;
    
    let currentSituation = '';
    let currentSituationColor = '';
    
    if (currentStats) {
        if (currentStats.percentAboveTolerance === 0) {
            currentSituation = '✅ Excellent - Aucun dépassement de tolérance';
            currentSituationColor = '#22c55e';
        } else if (currentStats.percentAboveTolerance < 10) {
            currentSituation = '🟢 Bon - Moins de 10% de jours au-dessus de la tolérance';
            currentSituationColor = '#22c55e';
        } else if (currentStats.percentAboveTolerance < 20) {
            currentSituation = '🟡 Moyen - Entre 10% et 20% de jours au-dessus de la tolérance';
            currentSituationColor = '#eab308';
        } else if (currentStats.percentAboveTolerance < 30) {
            currentSituation = '🟠 Préoccupant - Entre 20% et 30% de jours au-dessus de la tolérance';
            currentSituationColor = '#f97316';
        } else {
            currentSituation = '🔴 Critique - Plus de 30% de jours au-dessus de la tolérance';
            currentSituationColor = '#ef4444';
        }
    }
    
    return {
        clientNumber: clientNumber,
        hasData: true,
        totalDays: daysAnalysis.length,
        daysAbove90Percent: daysAbove90Percent,
        daysBelow90Percent: daysBelow90Percent,
        daysInTolerance: daysInTolerance,
        daysAboveTolerance: daysAboveTolerance,
        percentAbove90: daysAnalysis.length > 0 ? 
            ((daysAbove90Percent / daysAnalysis.length) * 100).toFixed(1) : 0,
        percentInTolerance: daysAnalysis.length > 0 ? 
            ((daysInTolerance / daysAnalysis.length) * 100).toFixed(1) : 0,
        percentAboveTolerance: daysAnalysis.length > 0 ? 
            ((daysAboveTolerance / daysAnalysis.length) * 100).toFixed(1) : 0,
        consumptionByForfait: consumptionByForfait,
        forfaitHistory: forfaitHistory,
        forfaitComparisons: forfaitComparisons,
        currentForfait: currentForfait,
        currentStats: currentStats,
        currentSituation: currentSituation,
        currentSituationColor: currentSituationColor,
        daysAnalysis: daysAnalysis.sort((a, b) => b.dateObj - a.dateObj).slice(0, 30)
    };
}
// ==================== ANALYSE DES RECHARGES PAR CLIENT ====================
function analyzeRechargeData(clientNumber) {
    if (!combinedRechargeData || combinedRechargeData.length === 0) {
        return {
            clientNumber: clientNumber,
            hasData: false,
            purchaseDays: [],
            averagePurchaseDays: 0,
            code4Values: [],
            code4ValuesWithNames: [],
            code4Changes: [],
            currentCode4: null,
            currentCode4Name: null
        };
    }
    
    // Filtrer les recharges pour ce client (Code 1 = numéro client)
    const clientRecharges = combinedRechargeData
        .filter(row => {
            const code1 = row['Code 1'] ? row['Code 1'].toString().trim() : '';
            return code1 === clientNumber.toString();
        })
        .sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
    
    if (clientRecharges.length === 0) {
        return {
            clientNumber: clientNumber,
            hasData: false,
            purchaseDays: [],
            averagePurchaseDays: 0,
            code4Values: [],
            code4ValuesWithNames: [],
            code4Changes: [],
            currentCode4: null,
            currentCode4Name: null
        };
    }
    
    // Analyser les jours d'achat (Code 3)
    const purchaseDays = [];
    const code4Values = new Set();
    const code4ValuesWithNames = [];
    const code4Timeline = [];
    
    clientRecharges.forEach((row, index) => {
        const date = row['Date et Heure'];
        const code3 = row['Code 3'] ? parseInt(row['Code 3'].toString().trim()) : 0;
        const code4 = row['Code 4'] ? parseInt(row['Code 4'].toString().trim()) : null;
        const status = row['Status'] || '';
        const type = row['Type de code'] || '';
        
        // Collecter les jours d'achat (Code 3)
        if (code3 > 0) {
            purchaseDays.push({
                date: date,
                days: code3,
                status: status,
                type: type
            });
        }
        
        // Collecter les valeurs uniques de Code 4
        if (code4 !== null && !isNaN(code4)) {
            code4Values.add(code4);
        }
        
        // Suivre l'évolution du Code 4 dans le temps
        if (code4 !== null && !isNaN(code4)) {
            code4Timeline.push({
                date: date,
                value: code4,
                name: getForfaitName(code4),
                formattedDate: new Date(date).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                }),
                time: date.split(' ')[1]?.substring(0, 5) || ''
            });
        }
    });
    
    // Créer le tableau des valeurs avec noms
    const sortedCode4Values = Array.from(code4Values).sort((a, b) => a - b);
    sortedCode4Values.forEach(value => {
        code4ValuesWithNames.push({
            code: value,
            name: getForfaitName(value)
        });
    });
    
    // Calculer la moyenne des jours d'achat
    const totalPurchaseDays = purchaseDays.reduce((sum, item) => sum + item.days, 0);
    const averagePurchaseDays = purchaseDays.length > 0 
        ? (totalPurchaseDays / purchaseDays.length).toFixed(1) 
        : 0;
    
    // Détecter les changements de Code 4
    const code4Changes = [];
    let lastCode4 = null;
    
    code4Timeline.forEach((item, index) => {
        if (lastCode4 === null) {
            // Premier relevé
            code4Changes.push({
                date: item.date,
                formattedDate: item.formattedDate,
                time: item.time,
                oldValue: null,
                oldName: null,
                newValue: item.value,
                newName: item.name,
                type: 'initial'
            });
        } else if (item.value !== lastCode4) {
            // Changement détecté
            code4Changes.push({
                date: item.date,
                formattedDate: item.formattedDate,
                time: item.time,
                oldValue: lastCode4,
                oldName: getForfaitName(lastCode4),
                newValue: item.value,
                newName: item.name,
                type: 'change'
            });
        }
        lastCode4 = item.value;
    });
    
    return {
        clientNumber: clientNumber,
        hasData: true,
        totalRecharges: clientRecharges.length,
        purchaseDays: purchaseDays,
        averagePurchaseDays: averagePurchaseDays,
        totalPurchaseDays: totalPurchaseDays,
        code4Values: sortedCode4Values,
        code4ValuesWithNames: code4ValuesWithNames,
        code4Timeline: code4Timeline,
        code4Changes: code4Changes,
        currentCode4: code4Timeline.length > 0 ? code4Timeline[code4Timeline.length - 1].value : null,
        currentCode4Name: code4Timeline.length > 0 ? code4Timeline[code4Timeline.length - 1].name : null,
        firstRecharge: clientRecharges[0]['Date et Heure'],
        lastRecharge: clientRecharges[clientRecharges.length - 1]['Date et Heure']
    };
}
// ==================== ANALYSE DES JOURS SANS CRÉDIT ====================
function analyzeDaysWithoutCredit(clientNumber) {
    if (!combinedSoldeData || combinedSoldeData.length === 0) {
        return {
            clientNumber: clientNumber,
            hasData: false,
            daysWithoutCredit: [],
            totalDaysWithoutCredit: 0,
            consecutiveDays: [],
            longestStreak: 0,
            currentStreak: 0,
            lastCreditDate: null
        };
    }
    
    const creditKey = `Credit${clientNumber}`;
    const daysData = [];
    let previousDate = null;
    let previousValue = null;
    let currentStreak = 0;
    let longestStreak = 0;
    let currentStreakDates = [];
    let longestStreakDates = [];
    
    // Filtrer et trier les données par date
    const clientData = combinedSoldeData
        .filter(row => {
            const value = row[creditKey];
            return value && value.toString().trim() !== '' && value.toString().trim() !== '-';
        })
        .map(row => ({
            dateTime: row['Date et Heure'],
            date: row['Date et Heure'].split(' ')[0],
            time: row['Date et Heure'].split(' ')[1],
            value: parseFloat(row[creditKey]) || 0
        }))
        .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
    
    if (clientData.length === 0) {
        return {
            clientNumber: clientNumber,
            hasData: false,
            daysWithoutCredit: [],
            totalDaysWithoutCredit: 0,
            consecutiveDays: [],
            longestStreak: 0,
            currentStreak: 0,
            lastCreditDate: null
        };
    }
    
    // Analyser jour par jour pour détecter les jours sans crédit
    const daysWithoutCredit = [];
    const consecutiveGroups = [];
    let currentGroup = [];
    
    clientData.forEach((record, index) => {
        const date = record.date;
        const value = record.value;
        
        // Si c'est un jour sans crédit (valeur = 0)
        if (value === 0) {
            daysWithoutCredit.push({
                date: date,
                formattedDate: new Date(date).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                }),
                time: record.time,
                value: 0
            });
            
            // Gestion des jours consécutifs
            if (previousDate) {
                const prevDate = new Date(previousDate);
                const currDate = new Date(date);
                const dayDiff = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
                
                if (dayDiff === 1) {
                    // Jour consécutif
                    currentGroup.push(record);
                } else {
                    // Fin d'une série
                    if (currentGroup.length > 0) {
                        consecutiveGroups.push([...currentGroup]);
                        if (currentGroup.length > longestStreak) {
                            longestStreak = currentGroup.length;
                            longestStreakDates = [...currentGroup];
                        }
                    }
                    currentGroup = [record];
                }
            } else {
                currentGroup = [record];
            }
        }
        
        previousDate = date;
        previousValue = value;
    });
    
    // Ajouter le dernier groupe
    if (currentGroup.length > 0) {
        consecutiveGroups.push([...currentGroup]);
        if (currentGroup.length > longestStreak) {
            longestStreak = currentGroup.length;
            longestStreakDates = [...currentGroup];
        }
    }
    
    // Calculer la série actuelle (en cours)
    const lastRecord = clientData[clientData.length - 1];
    let currentStreakDays = 0;
    let currentStreakStart = null;
    
    if (lastRecord && lastRecord.value === 0) {
        // Vérifier si les derniers jours sont sans crédit
        const today = new Date().toISOString().split('T')[0];
        let checkDate = new Date(lastRecord.date);
        let streakCount = 0;
        
        while (streakCount < 30) { // Limiter à 30 jours pour éviter les boucles infinies
            const dateStr = checkDate.toISOString().split('T')[0];
            const recordForDate = clientData.find(r => r.date === dateStr);
            
            if (recordForDate && recordForDate.value === 0) {
                streakCount++;
                if (streakCount === 1) currentStreakStart = dateStr;
            } else {
                break;
            }
            
            checkDate.setDate(checkDate.getDate() - 1);
        }
        
        currentStreakDays = streakCount;
    }
    
    return {
        clientNumber: clientNumber,
        hasData: daysWithoutCredit.length > 0,
        daysWithoutCredit: daysWithoutCredit.sort((a, b) => new Date(b.date) - new Date(a.date)),
        totalDaysWithoutCredit: daysWithoutCredit.length,
        consecutiveDays: consecutiveGroups,
        longestStreak: longestStreak,
        longestStreakDates: longestStreakDates,
        currentStreak: currentStreakDays,
        currentStreakStart: currentStreakStart,
        lastCreditDate: clientData[clientData.length - 1]?.value > 0 ? clientData[clientData.length - 1].date : null,
        totalDays: clientData.length
    };
}

// ==================== FONCTIONS DE FILTRAGE ====================
function applyDateFilters() {
    console.log('🔍 Application des filtres de date...', {
        period: filterPeriod,
        startDate: filterStartDate,
        endDate: filterEndDate,
        month: filterMonth,
        year: filterYear
    });
    
    // Trouver la date la plus récente dans les données
    let lastDate = null;
    const allDates = [];
    
    // Collecter toutes les dates des données d'énergie
    if (combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            if (row['Date et Heure']) {
                const date = new Date(row['Date et Heure'].split(' ')[0]);
                if (!isNaN(date.getTime())) allDates.push(date);
            }
        });
    }
    
    // Collecter toutes les dates des données de tension
    if (combinedTensionData.length > 0) {
        combinedTensionData.forEach(row => {
            if (row['Date et Heure']) {
                const date = new Date(row['Date et Heure'].split(' ')[0]);
                if (!isNaN(date.getTime())) allDates.push(date);
            }
        });
    }
    
    // Trouver la date la plus récente
    if (allDates.length > 0) {
        lastDate = new Date(Math.max(...allDates));
        console.log('📅 Date la plus récente dans les données:', lastDate.toLocaleDateString('fr-FR'));
    }
    
    // 1. Appliquer les filtres aux données d'énergie
    if (combinedEnergyData.length > 0) {
        let filteredEnergy = [...combinedEnergyData];
        let filterApplied = false;
        let filterDescription = '';
        
        // Si des dates manuelles sont spécifiées
        if (filterStartDate || filterEndDate) {
            filterApplied = true;
            filterDescription = `Du ${filterStartDate?.toLocaleDateString('fr-FR') || 'début'} au ${filterEndDate?.toLocaleDateString('fr-FR') || 'fin'}`;
            
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                
                let pass = true;
                if (filterStartDate) pass = pass && (rowDate >= filterStartDate);
                if (filterEndDate) pass = pass && (rowDate <= filterEndDate);
                return pass;
            });
        }
        // Si une période prédéfinie est sélectionnée et qu'on a une dernière date
        else if (filterPeriod && filterPeriod !== 'all' && lastDate) {
            filterApplied = true;
            
            // Créer une copie de la dernière date pour le calcul
            let startDate = new Date(lastDate);
            
            // Soustraire la période appropriée
            switch (filterPeriod) {
                case '5days':
                    startDate.setDate(lastDate.getDate() - 5);
                    filterDescription = `5 derniers jours (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '7days':
                    startDate.setDate(lastDate.getDate() - 7);
                    filterDescription = `7 derniers jours (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '15days':
                    startDate.setDate(lastDate.getDate() - 15);
                    filterDescription = `15 derniers jours (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '30days':
                    startDate.setDate(lastDate.getDate() - 30);
                    filterDescription = `30 derniers jours (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '2months':
                    startDate.setMonth(lastDate.getMonth() - 2);
                    filterDescription = `2 derniers mois (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '3months':
                    startDate.setMonth(lastDate.getMonth() - 3);
                    filterDescription = `3 derniers mois (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '6months':
                    startDate.setMonth(lastDate.getMonth() - 6);
                    filterDescription = `6 derniers mois (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '1year':
                    startDate.setFullYear(lastDate.getFullYear() - 1);
                    filterDescription = `1 dernière année (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
            }
            
            // Ajouter 1 jour à la date de fin pour inclure le dernier jour complet
            const endDate = new Date(lastDate);
            endDate.setHours(23, 59, 59, 999);
            
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate >= startDate && rowDate <= endDate;
            });
        }
        // Si un mois/année est spécifié
        else if (filterMonth && filterYear) {
            filterApplied = true;
            filterDescription = `Mois de ${filterMonth}/${filterYear}`;
            
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && 
                       rowDate.getFullYear() === filterYear && 
                       (rowDate.getMonth() + 1) === filterMonth;
            });
        }
        // Si seulement l'année est spécifiée
        else if (filterYear && !filterMonth) {
            filterApplied = true;
            filterDescription = `Année ${filterYear}`;
            
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate.getFullYear() === filterYear;
            });
        }
        // Si seulement le mois est spécifié
        else if (filterMonth && !filterYear) {
            const currentYear = new Date().getFullYear();
            filterApplied = true;
            filterDescription = `Mois de ${filterMonth}/${currentYear}`;
            
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && 
                       rowDate.getFullYear() === currentYear && 
                       (rowDate.getMonth() + 1) === filterMonth;
            });
        }
        
        filteredEnergyData = filteredEnergy;
        
        // Vérifier si le filtre a retourné des résultats
        if (filterApplied && filteredEnergyData.length === 0) {
            showWarningMessage(`⚠️ Aucune donnée d'énergie trouvée pour ${filterDescription}`);
        } else if (filterApplied) {
            console.log(`✅ Données énergie filtrées: ${filteredEnergyData.length} lignes sur ${combinedEnergyData.length} - ${filterDescription}`);
        }
    }
    
    // 2. Appliquer les filtres aux données de tension (même logique)
    if (combinedTensionData.length > 0) {
        let filteredTension = [...combinedTensionData];
        let filterApplied = false;
        let filterDescription = '';
        
        if (filterStartDate || filterEndDate) {
            filterApplied = true;
            filterDescription = `Du ${filterStartDate?.toLocaleDateString('fr-FR') || 'début'} au ${filterEndDate?.toLocaleDateString('fr-FR') || 'fin'}`;
            
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                
                let pass = true;
                if (filterStartDate) pass = pass && (rowDate >= filterStartDate);
                if (filterEndDate) pass = pass && (rowDate <= filterEndDate);
                return pass;
            });
        }
        else if (filterPeriod && filterPeriod !== 'all' && lastDate) {
            filterApplied = true;
            
            let startDate = new Date(lastDate);
            
            switch (filterPeriod) {
                case '5days':
                    startDate.setDate(lastDate.getDate() - 5);
                    filterDescription = `5 derniers jours (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '7days':
                    startDate.setDate(lastDate.getDate() - 7);
                    filterDescription = `7 derniers jours (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '15days':
                    startDate.setDate(lastDate.getDate() - 15);
                    filterDescription = `15 derniers jours (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '30days':
                    startDate.setDate(lastDate.getDate() - 30);
                    filterDescription = `30 derniers jours (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '2months':
                    startDate.setMonth(lastDate.getMonth() - 2);
                    filterDescription = `2 derniers mois (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '3months':
                    startDate.setMonth(lastDate.getMonth() - 3);
                    filterDescription = `3 derniers mois (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '6months':
                    startDate.setMonth(lastDate.getMonth() - 6);
                    filterDescription = `6 derniers mois (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
                case '1year':
                    startDate.setFullYear(lastDate.getFullYear() - 1);
                    filterDescription = `1 dernière année (du ${startDate.toLocaleDateString('fr-FR')} au ${lastDate.toLocaleDateString('fr-FR')})`;
                    break;
            }
            
            const endDate = new Date(lastDate);
            endDate.setHours(23, 59, 59, 999);
            
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate >= startDate && rowDate <= endDate;
            });
        }
        else if (filterMonth && filterYear) {
            filterApplied = true;
            filterDescription = `Mois de ${filterMonth}/${filterYear}`;
            
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && 
                       rowDate.getFullYear() === filterYear && 
                       (rowDate.getMonth() + 1) === filterMonth;
            });
        }
        else if (filterYear && !filterMonth) {
            filterApplied = true;
            filterDescription = `Année ${filterYear}`;
            
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate.getFullYear() === filterYear;
            });
        }
        else if (filterMonth && !filterYear) {
            const currentYear = new Date().getFullYear();
            filterApplied = true;
            filterDescription = `Mois de ${filterMonth}/${currentYear}`;
            
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && 
                       rowDate.getFullYear() === currentYear && 
                       (rowDate.getMonth() + 1) === filterMonth;
            });
        }
        
        filteredTensionData = filteredTension;
        
        // Vérifier si le filtre a retourné des résultats
        if (filterApplied && filteredTensionData.length === 0) {
            showWarningMessage(`⚠️ Aucune donnée de tension trouvée pour ${filterDescription}`);
        } else if (filterApplied) {
            console.log(`✅ Données tension filtrées: ${filteredTensionData.length} lignes sur ${combinedTensionData.length} - ${filterDescription}`);
        }
    }
    // Après avoir appliqué les filtres, montrer un message plus détaillé

    // 3. Si aucun filtre n'est appliqué, réinitialiser les données filtrées
    if (!filterStartDate && !filterEndDate && (!filterPeriod || filterPeriod === 'all') && !filterMonth && !filterYear) {
        filteredEnergyData = combinedEnergyData;
        filteredTensionData = combinedTensionData;
    }
    
    // 4. Réinitialiser les paginations
    currentPageEnergy = 1;
    currentPageTension = 1;
    currentPageEvent = 1;
    currentPageSolde = 1;
    currentPageRecharge = 1;
    
    // 5. Mettre à jour tous les éléments avec les nouvelles données filtrées
    updateEnergyTable();
    updateTensionTable();
    
    setTimeout(() => {
        updateETCharts();
    }, 100);
    
    setTimeout(() => {
        createTechnicalDataCard();
    }, 300);
    
    setTimeout(() => {
        if (document.getElementById('main-tab-content-technique')?.classList.contains('active')) {
            displayTensionStabilityAnalysis();
            displayEnergyAnalysis();
            createVoltageThresholdTable();
        }
        if (document.getElementById('main-tab-content-commerciale')?.classList.contains('active')) {
            displayCommercialAnalysis();
        }
        if (document.getElementById('main-tab-content-evenement')?.classList.contains('active')) {
            displayEventAnalysis();
        }
    }, 400);
    
    console.log('✅ Tous les éléments mis à jour avec les filtres appliqués');
}
function showWarningMessage(message) {
    const oldMessage = document.getElementById('warning-message');
    if (oldMessage) oldMessage.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.id = 'warning-message';
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f39c12;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.5s ease;
        max-width: 400px;
    `;
    
    messageDiv.innerHTML = `<span>⚠️</span><span>${message}</span>`;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOut 0.5s ease forwards';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    document.body.removeChild(messageDiv);
                }
            }, 500);
        }
    }, 5000); // Afficher pendant 5 secondes
}

function resetFilters() {
    filterStartDate = null;
    filterEndDate = null;
    filterPeriod = 'all';
    filterMonth = null;
    filterYear = null;
    
    // ✅ Réinitialiser les données filtrées
    filteredEnergyData = combinedEnergyData;
    filteredTensionData = combinedTensionData;
    
    // Réinitialiser les champs
    const startDateInput = document.getElementById('start-date-input');
    const endDateInput = document.getElementById('end-date-input');
    const yearFilterSelect = document.getElementById('year-filter-select');
    const monthFilterSelect = document.getElementById('month-filter-select');
    
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    if (yearFilterSelect) yearFilterSelect.value = '';
    if (monthFilterSelect) monthFilterSelect.value = '';
    
    // Réinitialiser les boutons de période
    document.querySelectorAll('.period-btn').forEach(b => {
        b.classList.remove('active');
        b.style.cssText = `padding: 10px; border: 1px solid #dee2e6; border-radius: 4px; background: white; color: #495057; cursor: pointer; font-size: 12px;`;
    });
    
    const allBtn = document.querySelector('.period-btn[data-period="all"]');
    if (allBtn) {
        allBtn.classList.add('active');
        allBtn.style.cssText = `padding: 10px; border: 2px solid #3498db; border-radius: 4px; background: #3498db; color: white; cursor: pointer; font-size: 12px; font-weight: bold;`;
    }
    
    // ✅ Mettre à jour tous les éléments
    updateEnergyTable();
    updateTensionTable();
    updateETCharts();
    createTechnicalDataCard();
    
    showFilterMessage('Filtres réinitialisés');
}

function showFilterMessage(message = 'Filtres appliqués') {
    const oldMessage = document.getElementById('filter-message');
    if (oldMessage) oldMessage.remove();
    const messageDiv = document.createElement('div');
    messageDiv.id = 'filter-message';
    messageDiv.style.cssText = `position: fixed; top: 20px; right: 20px; background: #27ae60; color: white; padding: 15px 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 1000; font-weight: 600; display: flex; align-items: center; gap: 10px; animation: slideIn 0.5s ease;`;
    messageDiv.innerHTML = `<span>✅</span><span>${message}</span>`;
    document.body.appendChild(messageDiv);
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOut 0.5s ease forwards';
            setTimeout(() => { if (messageDiv.parentNode) document.body.removeChild(messageDiv); }, 500);
        }
    }, 3000);
}

// ==================== CRÉATION DES FILTRES (CARD 1) ====================

function createFilterControls() {
    const filtersContainerParent = document.getElementById('card-filters-content');
    if (!filtersContainerParent) return;
    
    const existingFilters = document.getElementById('et-filters-container');
    if (existingFilters) existingFilters.remove();
    
    const filtersContainer = document.createElement('div');
    filtersContainer.id = 'et-filters-container';
    filtersContainer.style.cssText = `background: white; border-radius: 12px; padding: 20px; animation: fadeIn 0.3s ease;`;
    
    const filtersHeader = document.createElement('div');
    filtersHeader.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e9ecef;`;
    filtersHeader.innerHTML = `
        <h3 style="margin: 0; color: #2c3e50; font-size: 18px; display: flex; align-items: center; gap: 10px;">🔍 Filtres de Date</h3>
        <div style="display: flex; gap: 10px;">
            <button id="reset-filters-btn" class="btn btn-secondary" style="padding: 8px 15px; font-size: 13px;">🔄 Réinitialiser</button>
            <button id="apply-filters-btn" class="btn btn-primary" style="padding: 8px 15px; font-size: 13px;">✅ Appliquer</button>
        </div>
    `;
    filtersContainer.appendChild(filtersHeader);
    
    const filtersGrid = document.createElement('div');
    filtersGrid.style.cssText = `display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;`;
    
    // Filtre période prédéfinie
    const periodFilterDiv = document.createElement('div');
    periodFilterDiv.style.cssText = `background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef;`;
    const isActive5 = filterPeriod === '5days'; const isActive7 = filterPeriod === '7days'; const isActive15 = filterPeriod === '15days';
    const isActive30 = filterPeriod === '30days'; const isActive2m = filterPeriod === '2months'; const isActive3m = filterPeriod === '3months';
    const isActive6m = filterPeriod === '6months'; const isActive1y = filterPeriod === '1year'; const isActiveAll = filterPeriod === 'all' || !filterPeriod;
    
    periodFilterDiv.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50; font-size: 14px; font-weight: 600;">📅 Période Prédéfinie</h4>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
            <button class="period-btn ${isActive5 ? 'active' : ''}" data-period="5days" style="padding: 10px; border: ${isActive5 ? '2px solid #3498db' : '1px solid #dee2e6'}; border-radius: 4px; background: ${isActive5 ? '#3498db' : 'white'}; color: ${isActive5 ? 'white' : '#495057'}; cursor: pointer; font-size: 12px; ${isActive5 ? 'font-weight: bold;' : ''} transition: all 0.2s;">5 jours</button>
            <button class="period-btn ${isActive7 ? 'active' : ''}" data-period="7days" style="padding: 10px; border: ${isActive7 ? '2px solid #3498db' : '1px solid #dee2e6'}; border-radius: 4px; background: ${isActive7 ? '#3498db' : 'white'}; color: ${isActive7 ? 'white' : '#495057'}; cursor: pointer; font-size: 12px; ${isActive7 ? 'font-weight: bold;' : ''}">7 jours</button>
            <button class="period-btn ${isActive15 ? 'active' : ''}" data-period="15days" style="padding: 10px; border: ${isActive15 ? '2px solid #3498db' : '1px solid #dee2e6'}; border-radius: 4px; background: ${isActive15 ? '#3498db' : 'white'}; color: ${isActive15 ? 'white' : '#495057'}; cursor: pointer; font-size: 12px; ${isActive15 ? 'font-weight: bold;' : ''}">15 jours</button>
            <button class="period-btn ${isActive30 ? 'active' : ''}" data-period="30days" style="padding: 10px; border: ${isActive30 ? '2px solid #3498db' : '1px solid #dee2e6'}; border-radius: 4px; background: ${isActive30 ? '#3498db' : 'white'}; color: ${isActive30 ? 'white' : '#495057'}; cursor: pointer; font-size: 12px; ${isActive30 ? 'font-weight: bold;' : ''}">30 jours</button>
            <button class="period-btn ${isActive2m ? 'active' : ''}" data-period="2months" style="padding: 10px; border: ${isActive2m ? '2px solid #3498db' : '1px solid #dee2e6'}; border-radius: 4px; background: ${isActive2m ? '#3498db' : 'white'}; color: ${isActive2m ? 'white' : '#495057'}; cursor: pointer; font-size: 12px; ${isActive2m ? 'font-weight: bold;' : ''}">2 mois</button>
            <button class="period-btn ${isActive3m ? 'active' : ''}" data-period="3months" style="padding: 10px; border: ${isActive3m ? '2px solid #3498db' : '1px solid #dee2e6'}; border-radius: 4px; background: ${isActive3m ? '#3498db' : 'white'}; color: ${isActive3m ? 'white' : '#495057'}; cursor: pointer; font-size: 12px; ${isActive3m ? 'font-weight: bold;' : ''}">3 mois</button>
            <button class="period-btn ${isActive6m ? 'active' : ''}" data-period="6months" style="padding: 10px; border: ${isActive6m ? '2px solid #3498db' : '1px solid #dee2e6'}; border-radius: 4px; background: ${isActive6m ? '#3498db' : 'white'}; color: ${isActive6m ? 'white' : '#495057'}; cursor: pointer; font-size: 12px; ${isActive6m ? 'font-weight: bold;' : ''}">6 mois</button>
            <button class="period-btn ${isActive1y ? 'active' : ''}" data-period="1year" style="padding: 10px; border: ${isActive1y ? '2px solid #3498db' : '1px solid #dee2e6'}; border-radius: 4px; background: ${isActive1y ? '#3498db' : 'white'}; color: ${isActive1y ? 'white' : '#495057'}; cursor: pointer; font-size: 12px; ${isActive1y ? 'font-weight: bold;' : ''}">1 an</button>
            <button class="period-btn ${isActiveAll ? 'active' : ''}" data-period="all" style="padding: 10px; border: ${isActiveAll ? '2px solid #3498db' : '1px solid #dee2e6'}; border-radius: 4px; background: ${isActiveAll ? '#3498db' : 'white'}; color: ${isActiveAll ? 'white' : '#495057'}; cursor: pointer; font-size: 12px; ${isActiveAll ? 'font-weight: bold;' : ''}">Tout</button>
        </div>
    `;
    filtersGrid.appendChild(periodFilterDiv);
    
    // Filtre sélection manuelle
    const dateRangeFilterDiv = document.createElement('div');
    dateRangeFilterDiv.style.cssText = `background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef;`;
    let minDate = '', maxDate = ''; const allDates = [];
    if (combinedEnergyData?.length > 0) combinedEnergyData.forEach(row => { if (row['Date et Heure']) { const d = new Date(row['Date et Heure']); if (!isNaN(d.getTime())) allDates.push(d); } });
    if (combinedTensionData?.length > 0) combinedTensionData.forEach(row => { if (row['Date et Heure']) { const d = new Date(row['Date et Heure']); if (!isNaN(d.getTime())) allDates.push(d); } });
    if (allDates.length > 0) {
        minDate = new Date(Math.min(...allDates)).toISOString().split('T')[0];
        maxDate = new Date(Math.max(...allDates)).toISOString().split('T')[0];
    }
    const startDateValue = filterStartDate ? filterStartDate.toISOString().split('T')[0] : '';
    const endDateValue = filterEndDate ? filterEndDate.toISOString().split('T')[0] : '';
    
    dateRangeFilterDiv.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50; font-size: 14px; font-weight: 600;">📅 Sélection Manuelle</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div><label style="display: block; margin-bottom: 5px; font-size: 13px; color: #495057; font-weight: 500;">Date de début</label>
                <input type="date" id="start-date-input" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;" min="${minDate}" max="${maxDate}" value="${startDateValue}"></div>
            <div><label style="display: block; margin-bottom: 5px; font-size: 13px; color: #495057; font-weight: 500;">Date de fin</label>
                <input type="date" id="end-date-input" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;" min="${minDate}" max="${maxDate}" value="${endDateValue}"></div>
        </div>
        <div style="margin-top: 12px; font-size: 11px; color: #6c757d; display: flex; justify-content: space-between;">
            <span>📅 Du ${minDate || '...'} au ${maxDate || '...'}</span>
            <span>${allDates.length} enregistrements</span>
        </div>
    `;
    filtersGrid.appendChild(dateRangeFilterDiv);
    
    // Filtre mois/année
    const monthYearFilterDiv = document.createElement('div');
    monthYearFilterDiv.style.cssText = `background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef;`;
    const years = new Set();
    if (combinedEnergyData?.length > 0) combinedEnergyData.forEach(row => { if (row['Date et Heure']) { const d = new Date(row['Date et Heure']); if (!isNaN(d.getTime())) years.add(d.getFullYear()); } });
    if (combinedTensionData?.length > 0) combinedTensionData.forEach(row => { if (row['Date et Heure']) { const d = new Date(row['Date et Heure']); if (!isNaN(d.getTime())) years.add(d.getFullYear()); } });
    const yearsArray = Array.from(years).sort((a, b) => b - a);
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    let yearOptions = '<option value="">Toutes les années</option>';
    yearsArray.forEach(year => { yearOptions += `<option value="${year}" ${filterYear === year ? 'selected' : ''}>${year}</option>`; });
    let monthOptions = '<option value="">Tous les mois</option>';
    monthNames.forEach((month, index) => { monthOptions += `<option value="${index + 1}" ${filterMonth === index + 1 ? 'selected' : ''}>${month}</option>`; });
    
    monthYearFilterDiv.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50; font-size: 14px; font-weight: 600;">📅 Filtre par Mois/Année</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div><label style="display: block; margin-bottom: 5px; font-size: 13px; color: #495057; font-weight: 500;">Année</label>
                <select id="year-filter-select" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">${yearOptions}</select></div>
            <div><label style="display: block; margin-bottom: 5px; font-size: 13px; color: #495057; font-weight: 500;">Mois</label>
                <select id="month-filter-select" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px;">${monthOptions}</select></div>
        </div>
        <div style="margin-top: 15px; font-size: 11px; color: #6c757d; background: #e9ecef; padding: 8px 12px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between;"><span>⚡ Énergie: ${combinedEnergyData.length} lignes</span><span>📊 Tension: ${combinedTensionData.length} lignes</span></div>
        </div>
    `;
    filtersGrid.appendChild(monthYearFilterDiv);
    filtersContainer.appendChild(filtersGrid);
    filtersContainerParent.appendChild(filtersContainer);
    setupFilterEvents();
}

function setupFilterEvents() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
                b.style.cssText = `padding: 10px; border: 1px solid #dee2e6; border-radius: 4px; background: white; color: #495057; cursor: pointer; font-size: 12px; transition: all 0.3s;`;
            });
            this.classList.add('active');
            this.style.cssText = `padding: 10px; border: 2px solid #3498db; border-radius: 4px; background: #3498db; color: white; cursor: pointer; font-size: 12px; font-weight: bold;`;
            filterPeriod = this.dataset.period;
            if (filterPeriod !== 'all') {
                document.getElementById('start-date-input').value = '';
                document.getElementById('end-date-input').value = '';
                document.getElementById('year-filter-select').value = '';
                document.getElementById('month-filter-select').value = '';
                filterStartDate = null; filterEndDate = null; filterMonth = null; filterYear = null;
            }
        });
    });
    
    document.getElementById('apply-filters-btn').addEventListener('click', function() {
        const startDateInput = document.getElementById('start-date-input').value;
        const endDateInput = document.getElementById('end-date-input').value;
        const yearFilter = document.getElementById('year-filter-select').value;
        const monthFilter = document.getElementById('month-filter-select').value;
        
        filterStartDate = startDateInput ? new Date(startDateInput + 'T00:00:00') : null;
        filterEndDate = endDateInput ? new Date(endDateInput + 'T23:59:59') : null;
        
        if (yearFilter && monthFilter) {
            filterYear = parseInt(yearFilter); filterMonth = parseInt(monthFilter); filterPeriod = 'all';
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
                b.style.cssText = `padding: 10px; border: 1px solid #dee2e6; border-radius: 4px; background: white; color: #495057; cursor: pointer; font-size: 12px;`;
            });
            document.querySelector('.period-btn[data-period="all"]').classList.add('active');
            document.querySelector('.period-btn[data-period="all"]').style.cssText = `padding: 10px; border: 2px solid #3498db; border-radius: 4px; background: #3498db; color: white; cursor: pointer; font-size: 12px; font-weight: bold;`;
        } else if (yearFilter || monthFilter) {
            filterYear = null; filterMonth = null;
            document.getElementById('year-filter-select').value = '';
            document.getElementById('month-filter-select').value = '';
            alert('Veuillez sélectionner à la fois un mois et une année');
            return;
        } else { filterYear = null; filterMonth = null; }
        
        if (startDateInput || endDateInput) {
            filterPeriod = 'all';
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
                b.style.cssText = `padding: 10px; border: 1px solid #dee2e6; border-radius: 4px; background: white; color: #495057; cursor: pointer; font-size: 12px;`;
            });
            document.querySelector('.period-btn[data-period="all"]').classList.add('active');
            document.querySelector('.period-btn[data-period="all"]').style.cssText = `padding: 10px; border: 2px solid #3498db; border-radius: 4px; background: #3498db; color: white; cursor: pointer; font-size: 12px; font-weight: bold;`;
        }
        applyDateFilters();
        showFilterMessage('Filtres appliqués');
    });
    
    document.getElementById('reset-filters-btn').addEventListener('click', resetFilters);
    
    document.querySelectorAll('.period-btn').forEach(btn => {
        if (btn.classList.contains('active')) {
            btn.style.cssText = `padding: 10px; border: 2px solid #3498db; border-radius: 4px; background: #3498db; color: white; cursor: pointer; font-size: 12px; font-weight: bold;`;
        }
    });
}

// ==================== CARD 2 : DONNÉES TECHNIQUES ====================

function createTechnicalDataCard() {
    const cardContent = document.getElementById('card-technical-data-content');
    if (!cardContent) return;
    
    const existingCard = document.getElementById('technical-data-card');
    if (existingCard) existingCard.remove();
    
    const techData = calculateTechnicalData();
    const systemType = detectSystemType(filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData);
    const limits = getSystemLimits(systemType);
    const maxDailyVariation = calculateMaxDailyVariation(filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData);
    
    const energyDataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    const tensionDataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    const daysToUse = techData.totalDays;
    const clientsCount = techData.clientCount;
    
    const card = document.createElement('div');
    card.id = 'technical-data-card';
    card.style.cssText = `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden; animation: fadeIn 0.5s ease; color: white;`;
    
    const cardHeader = document.createElement('div');
    cardHeader.style.cssText = `background: rgba(255, 255, 255, 0.15); color: white; padding: 15px 25px; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px; backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255, 255, 255, 0.2);`;
    cardHeader.innerHTML = `👥 DONNÉES TECHNIQUES DU ${escapeHtml(currentFolder.name)}`;
    card.appendChild(cardHeader);
    
    if (filteredEnergyData.length !== combinedEnergyData.length || filteredTensionData.length !== combinedTensionData.length) {
        const filterBadge = document.createElement('div');
        filterBadge.style.cssText = `margin: 15px 25px 0 25px; padding: 10px 15px; background: rgba(59, 130, 246, 0.3); border-radius: 6px; border-left: 4px solid #3b82f6; display: flex; align-items: center; gap: 10px; font-size: 13px; color: white; backdrop-filter: blur(5px);`;
        let filterInfo = '';
        if (filterPeriod && filterPeriod !== 'all') {
            const periodNames = { '5days': '5 jours', '7days': '7 jours', '15days': '15 jours', '30days': '30 jours', '2months': '2 mois', '3months': '3 mois', '6months': '6 mois', '1year': '1 an' };
            filterInfo = `Filtre actif: ${periodNames[filterPeriod] || filterPeriod}`;
        } else if (filterStartDate || filterEndDate) {
            const start = filterStartDate ? filterStartDate.toLocaleDateString('fr-FR') : 'début';
            const end = filterEndDate ? filterEndDate.toLocaleDateString('fr-FR') : 'fin';
            filterInfo = `Filtre actif: ${start} → ${end}`;
        } else if (filterMonth && filterYear) filterInfo = `Filtre actif: ${filterMonth}/01/${filterYear}`;
        else filterInfo = 'Filtre actif';
        filterBadge.innerHTML = `<span style="font-size: 14px;">🔍</span><span style="font-weight: 500;">${filterInfo}</span>`;
        card.appendChild(filterBadge);
    }
    
    const statsHeader = document.createElement('div');
    statsHeader.style.cssText = `display: flex; align-items: center; gap: 30px; padding: 20px 25px 10px 25px; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.15);`;
    statsHeader.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 22px;">📅</span><span style="font-size: 16px; font-weight: 600;">${daysToUse} jour${daysToUse !== 1 ? 's' : ''}</span></div>
        <div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 22px;">👤</span><span style="font-size: 16px; font-weight: 600;">${clientsCount} client${clientsCount !== 1 ? 's' : ''}</span></div>
        ${filteredEnergyData.length !== combinedEnergyData.length ? `<div style="display: flex; align-items: center; gap: 10px; margin-left: auto;"><span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">⚡ ${filteredEnergyData.length} lignes</span><span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">📊 ${filteredTensionData.length} lignes</span></div>` : ''}
    `;
    card.appendChild(statsHeader);
    
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `padding: 5px 25px 20px 25px;`;
    const table = document.createElement('table');
    table.style.cssText = `width: 100%; border-collapse: collapse; color: white; font-size: 14px;`;
    
    const isMinOutOfLimit = parseFloat(techData.minTension.value) < limits.min;
    const isMaxOutOfLimit = parseFloat(techData.maxTension.value) > limits.max;
    const isVariationOutOfLimit = parseFloat(maxDailyVariation.value) > limits.maxVariation;
    
    let tbodyHTML = `
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0; width: 40%;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">⚡</span><span style="font-weight: 600;">Énergie Maximale</span></div></td><td style="padding: 12px 0; width: 30%; font-weight: 700; color: white;">${techData.maxEnergy.value}</td><td style="padding: 12px 0; width: 30%; text-align: right; color: rgba(255,255,255,0.8);">${techData.maxEnergy.date}</td></tr>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">📊</span><span style="font-weight: 600;">Énergie Moyenne</span></div></td><td style="padding: 12px 0; font-weight: 700;">${techData.avgEnergy.value || '0 Wh'}</td><td style="padding: 12px 0; text-align: right; color: rgba(255,255,255,0.8);">sur ${daysToUse} jour${daysToUse !== 1 ? 's' : ''}</td></tr>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">📊</span><span style="font-weight: 600;">Tension Moyenne</span></div></td><td style="padding: 12px 0; font-weight: 700;">${techData.avgTension.value}</td><td style="padding: 12px 0; text-align: right;"><span style="background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 13px;">${techData.tensionSystem}</span></td></tr>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">⬇️</span><span style="font-weight: 600;">Tension Minimale</span></div></td><td style="padding: 12px 0; font-weight: 700; color: ${isMinOutOfLimit ? '#ffb3b3' : 'white'};">${techData.minTension.value} ${isMinOutOfLimit ? '⚠️' : ''}</td><td style="padding: 12px 0; text-align: right; color: rgba(255,255,255,0.8);">${techData.minTension.date}</td></tr>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">⬆️</span><span style="font-weight: 600;">Tension Maximale</span></div></td><td style="padding: 12px 0; font-weight: 700; color: ${isMaxOutOfLimit ? '#ffb3b3' : 'white'};">${techData.maxTension.value} ${isMaxOutOfLimit ? '⚠️' : ''}</td><td style="padding: 12px 0; text-align: right; color: rgba(255,255,255,0.8);">${techData.maxTension.date}</td></tr>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">📏</span><span style="font-weight: 600;">Variation Max/Jour</span></div></td><td style="padding: 12px 0; font-weight: 700; color: ${isVariationOutOfLimit ? '#ffb3b3' : 'white'};">${maxDailyVariation.value} V ${isVariationOutOfLimit ? '⚠️' : ''}</td><td style="padding: 12px 0; text-align: right;"><span style="background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 13px;">Seuil: ${limits.maxVariation} V/h</span></td></tr>
    `;
    table.innerHTML = `<tbody>${tbodyHTML}</tbody>`;
    tableContainer.appendChild(table);
    card.appendChild(tableContainer);
    cardContent.appendChild(card);
}

// ==================== CARD 3 : ANALYSE TOTALE TENSION ====================

function createTensionAnalysisContent() {
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    if (dataToUse.length === 0) return null;
    
    const stabilityData = analyzeTensionStability(dataToUse);
    const exceedanceData = analyzeThresholdExceedances(dataToUse);
    
    const analysisDiv = document.createElement('div');
    analysisDiv.style.cssText = `display: flex; flex-direction: column; gap: 20px;`;
    
    // Statistiques 4 cartes
    const statsRow = document.createElement('div');
    statsRow.style.cssText = `display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;`;
    statsRow.innerHTML = `
        <div style="background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #22c55e; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">📊 Conformité</div>
            <div style="font-size: 32px; font-weight: 800; color: #22c55e; margin-bottom: 8px;">${stabilityData.stabilityPercentage}%</div>
            <div style="font-size: 12px; color: #64748b;">${stabilityData.days} jour${stabilityData.days !== 1 ? 's' : ''} analysés</div>
        </div>
        <div style="background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #22c55e; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">✅ Jours Conforme</div>
            <div style="font-size: 28px; font-weight: 800; color: #22c55e; margin-bottom: 8px;">${stabilityData.stable}</div>
            <div style="text-align: center; padding: 6px 12px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; font-size: 12px; color: #15803d; font-weight: 600;">${stabilityData.days > 0 ? Math.round((stabilityData.stable / stabilityData.days) * 100) : 0}% des jours</div>
        </div>
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #f59e0b; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">⚠️ Jours Non Conforme</div>
            <div style="font-size: 28px; font-weight: 800; color: #f59e0b; margin-bottom: 8px;">${stabilityData.unstable}</div>
            <div style="text-align: center; padding: 6px 12px; background: rgba(245, 158, 11, 0.1); border-radius: 6px; font-size: 12px; color: #92400e; font-weight: 600;">${stabilityData.days > 0 ? Math.round((stabilityData.unstable / stabilityData.days) * 100) : 0}% des jours</div>
        </div>
        <div style="background: linear-gradient(135deg, #fee2e2 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #ef4444; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">🚨 JOURS D'ALERTE</div>
            <div style="font-size: 32px; font-weight: 800; color: #ef4444; margin-bottom: 8px;">${exceedanceData.daysWithExceedance} / ${stabilityData.days}</div>
            <div style="margin-top: 8px; font-size: 11px; color: #991b1b; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px;">Seuil ${exceedanceData.systemType}: ${exceedanceData.limits.min}V - ${exceedanceData.limits.max}V</div>
        </div>
    `;
    analysisDiv.appendChild(statsRow);
    
    // Tableau des dépassements
    if (exceedanceData.exceedanceDays.length > 0) {
        const exceedanceSection = document.createElement('div');
        exceedanceSection.style.cssText = `border: 1px solid #fee2e2; border-radius: 10px; overflow: hidden;`;
        const exceedanceHeader = document.createElement('div');
        exceedanceHeader.style.cssText = `background: #fef2f2; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fee2e2;`;
        exceedanceHeader.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 18px;">📅</span><span style="font-weight: 700; color: #991b1b;">JOURS AVEC DÉPASSEMENT DE SEUIL (${exceedanceData.exceedanceDays.length})</span></div><span style="font-size: 12px; color: #64748b;">Total: ${exceedanceData.totalExceedances} dépassement${exceedanceData.totalExceedances !== 1 ? 's' : ''}</span>`;
        
        const tableWrapper = document.createElement('div');
        tableWrapper.style.cssText = `overflow-x: auto; padding: 16px; background: white;`;
        let tableHTML = `<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><thead style="background: #f1f5f9;"><tr><th style="padding: 12px 8px; text-align: left; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Date</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Variation</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Heures alerte</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Min / Max</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Valeurs hors seuil</th></tr></thead><tbody>`;
        
        exceedanceData.exceedanceDays.forEach((day, index) => {
            let rowBgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
            if (day.hoursOutOfLimits >= 3) rowBgColor = '#fff5f5';
            let minMaxDisplay = `${day.minTension}V / ${day.maxTension}V`;
            if (day.minValue !== '-' && parseFloat(day.minValue) < exceedanceData.limits.min) minMaxDisplay = `<span style="color: #ef4444; font-weight: 700;">${day.minTension}V</span> / ${day.maxTension}V`;
            if (day.maxValue !== '-' && parseFloat(day.maxValue) > exceedanceData.limits.max) minMaxDisplay = `${day.minTension}V / <span style="color: #ef4444; font-weight: 700;">${day.maxTension}V</span>`;
            let exceedanceValues = [];
            if (day.minOutOfLimit !== '-') exceedanceValues.push(`Min: ${day.minOutOfLimit}V`);
            if (day.maxOutOfLimit !== '-') exceedanceValues.push(`Max: ${day.maxOutOfLimit}V`);
            const exceedanceText = exceedanceValues.length > 0 ? exceedanceValues.join(' • ') : '-';
            
            tableHTML += `<tr style="border-bottom: 1px solid #e2e8f0; background: ${rowBgColor};"><td style="padding: 10px 8px; text-align: left; color: #1e293b; font-weight: 500;"><div style="display: flex; flex-direction: column;"><span>${day.formattedDate}</span><span style="font-size: 10px; color: #64748b;">${day.date}</span></div></td><td style="padding: 10px 8px; text-align: center; color: ${day.dailyVariation > exceedanceData.limits.maxVariation ? '#f59e0b' : '#1e293b'}; font-weight: ${day.dailyVariation > exceedanceData.limits.maxVariation ? '700' : '400'};">${day.dailyVariation}V</td><td style="padding: 10px 8px; text-align: center;"><span style="background: ${day.hoursOutOfLimits > 0 ? 'rgba(239, 68, 68, 0.1)' : 'transparent'}; color: ${day.hoursOutOfLimits > 0 ? '#ef4444' : '#64748b'}; padding: 4px 8px; border-radius: 4px; font-weight: ${day.hoursOutOfLimits > 0 ? '600' : '400'};">${day.hoursOutOfLimits}h</span></td><td style="padding: 10px 8px; text-align: center; color: #1e293b;">${minMaxDisplay}</td><td style="padding: 10px 8px; text-align: center;"><span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 4px 8px; border-radius: 4px; font-weight: 600;">${exceedanceText}</span></td></tr>`;
        });
        tableHTML += `</tbody></table>`;
        tableWrapper.innerHTML = tableHTML;
        exceedanceSection.appendChild(exceedanceHeader);
        exceedanceSection.appendChild(tableWrapper);
        analysisDiv.appendChild(exceedanceSection);
    } else {
        const noExceedanceMsg = document.createElement('div');
        noExceedanceMsg.style.cssText = `padding: 20px; background: #f0fff4; border: 1px solid #22c55e; border-radius: 10px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 10px;`;
        noExceedanceMsg.innerHTML = `<span style="font-size: 24px;">✅</span><div><span style="font-weight: 700; color: #15803d;">Aucun dépassement de seuil détecté</span><div style="font-size: 12px; color: #64748b; margin-top: 4px;">La tension est restée dans les limites ${exceedanceData.systemType} (${exceedanceData.limits.min}V - ${exceedanceData.limits.max}V) pendant toute la période</div></div>`;
        analysisDiv.appendChild(noExceedanceMsg);
    }
    
    // Conclusion
    const stablePercent = stabilityData.days > 0 ? Math.round((stabilityData.stable/stabilityData.days)*100) : 0;
    let conclusionMessage = '';
    if (stabilityData.stabilityPercentage >= 90) conclusionMessage = `La tension du système ${stabilityData.systemType} est <strong>excellente</strong> avec ${stablePercent}% de jours conformes. La variation moyenne de ${stabilityData.averageVariation} V/h est bien en dessous du seuil d'alerte. `;
    else if (stabilityData.stabilityPercentage >= 80) conclusionMessage = `La tension est <strong>globalement stable</strong> (${stablePercent}% de jours conformes) mais présente des variations importantes certains jours. `;
    else if (stabilityData.stabilityPercentage >= 60) conclusionMessage = `La tension est <strong>préoccupante</strong> avec seulement ${stablePercent}% de jours conformes. `;
    else conclusionMessage = `⚠️ <strong>ALERTE CRITIQUE</strong> ⚠️ La tension est <strong>non conforme</strong> (${stablePercent}% de jours conformes seulement). `;
    
    if (exceedanceData.daysWithExceedance > 0) {
        conclusionMessage += `<span style="color: #ef4444;">🚨 ${exceedanceData.daysWithExceedance} jour${exceedanceData.daysWithExceedance !== 1 ? 's' : ''} hors limites (${exceedanceData.totalHoursOutOfLimits}h).</span> `;
        if (stabilityData.stabilityPercentage < 60) conclusionMessage += `<strong>Intervention technique URGENTE requise.</strong>`;
    }
    
    const conclusionDiv = document.createElement('div');
    conclusionDiv.style.cssText = `background: ${stabilityData.stabilityPercentage >= 90 ? '#dcfce7' : stabilityData.stabilityPercentage >= 80 ? '#dbeafe' : stabilityData.stabilityPercentage >= 60 ? '#fef3c7' : '#fee2e2'}; border: 2px solid ${stabilityData.stabilityPercentage >= 90 ? '#22c55e' : stabilityData.stabilityPercentage >= 80 ? '#3b82f6' : stabilityData.stabilityPercentage >= 60 ? '#f59e0b' : '#ef4444'}; border-radius: 10px; padding: 16px;`;
    conclusionDiv.innerHTML = `<div style="display: flex; align-items: flex-start; gap: 12px;"><span style="font-size: 24px; line-height: 1.2;">${stabilityData.stabilityPercentage >= 90 ? '✅' : stabilityData.stabilityPercentage >= 80 ? '⚠️' : stabilityData.stabilityPercentage >= 60 ? '🔴' : '🚫'}</span><div style="flex: 1;"><div style="font-weight: 700; color: ${stabilityData.stabilityPercentage >= 90 ? '#166534' : stabilityData.stabilityPercentage >= 80 ? '#1e40af' : stabilityData.stabilityPercentage >= 60 ? '#92400e' : '#991b1b'}; margin-bottom: 6px; font-size: 14px;">${stabilityData.stabilityPercentage >= 90 ? 'EXCELLENTE' : stabilityData.stabilityPercentage >= 80 ? 'SATISFAISANTE' : stabilityData.stabilityPercentage >= 60 ? 'PRÉOCCUPANTE' : 'CRITIQUE'}</div><div style="color: ${stabilityData.stabilityPercentage >= 90 ? '#166534' : stabilityData.stabilityPercentage >= 80 ? '#1e40af' : stabilityData.stabilityPercentage >= 60 ? '#92400e' : '#991b1b'}; font-size: 13px; line-height: 1.5;">${conclusionMessage}</div></div></div>`;
    analysisDiv.appendChild(conclusionDiv);
    
    // Normes système
    const normsDiv = document.createElement('div');
    normsDiv.style.cssText = `background: #f8fafc; border-radius: 10px; padding: 16px; border: 1px solid #e2e8f0;`;
    normsDiv.innerHTML = `
        <div style="font-weight: 600; color: #2d3748; margin-bottom: 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;"><span>⚡</span> Normes Système ${stabilityData.systemType} - Seuils d'alerte</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
            <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #e53e3e;"><div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Tension Min (alerte)</div><div style="font-size: 18px; font-weight: 700; color: #e53e3e;">${stabilityData.limits.min}V</div></div>
            <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #f59e0b;"><div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Plage Idéale</div><div style="font-size: 18px; font-weight: 700; color: #f59e0b;">${stabilityData.limits.ideal.min}V - ${stabilityData.limits.ideal.max}V</div></div>
            <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #22c55e;"><div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Tension Max (alerte)</div><div style="font-size: 18px; font-weight: 700; color: #22c55e;">${stabilityData.limits.max}V</div></div>
            <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #3b82f6;"><div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Variation max</div><div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${stabilityData.limits.maxVariation}V</div></div>
        </div>
        <div style="margin-top: 12px; padding: 10px; background: #fef2f2; border-radius: 6px; font-size: 11px; color: #991b1b; display: flex; align-items: center; gap: 8px;"><span style="font-size: 14px;">🚨</span><span><strong>Dépassement de seuil détecté</strong> lorsque Tension < ${stabilityData.limits.min}V ou Tension > ${stabilityData.limits.max}V</span></div>
    `;
    analysisDiv.appendChild(normsDiv);
    
    return analysisDiv;
}

function displayTensionStabilityAnalysis() {
    const cardContent = document.getElementById('card-tension-analysis-content');
    if (!cardContent) return;
    
    cardContent.innerHTML = '';
    
    const cardTitle = document.createElement('h3');
    cardTitle.style.cssText = `margin: 0 0 15px 0; color: #1e293b; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;`;
    cardTitle.innerHTML = `<span style="font-size: 24px;">🔄</span> ANALYSE TOTALE DE LA TENSION`;
    cardContent.appendChild(cardTitle);
    
    // Contenu de l'analyse existante
    const analysisContent = createTensionAnalysisContent();
    if (analysisContent) cardContent.appendChild(analysisContent);
    
    // ✅ TABLEAU DES DÉPASSEMENTS À 14.0V/28V
    // const voltageThresholdContainer = document.createElement('div');
    // voltageThresholdContainer.id = 'voltage-threshold-table-container';
    // voltageThresholdContainer.style.cssText = `
    //     margin: 20px 0;
    //     width: 100%;
    // `;
    // cardContent.appendChild(voltageThresholdContainer);
    
    // Créer le tableau des dépassements de tension
    createVoltageThresholdTable(); // <-- Vérifiez que cette fonction est bien appelée
    
    // Graphique tension (min, max, moyenne)
    const chartContainer1 = document.createElement('div');
    chartContainer1.id = 'tension-chart-placeholder';
    chartContainer1.style.cssText = `margin-top: 25px;`;
    cardContent.appendChild(chartContainer1);
    
    // Graphique tension horaire
    const chartContainer2 = document.createElement('div');
    chartContainer2.id = 'hourly-tension-chart-placeholder';
    chartContainer2.style.cssText = `margin-top: 25px;`;
    cardContent.appendChild(chartContainer2);
    
    setTimeout(() => {
        createTensionChart();
        createDateSelectorForHourlyTension();
        createHourlyTensionChart('all');
    }, 100);
}
function analyzeDelestageEvents() {
    if (combinedEventData.length === 0) {
        return { 
            allEvents: [], 
            eventsByDay: [], 
            totalEvents: 0, 
            totalPartiel: 0, 
            totalTotal: 0,
            totalDuration: '0h'
        };
    }
    
    const eventsByDayMap = new Map();
    let totalDurationMinutes = 0;
    
    combinedEventData.forEach(row => {
        if (!row['Date et Heure'] || !row['Évènements']) return;
        
        const event = row['Évènements'].trim();
        
        // Vérifier si c'est un événement de délestage
        if (event.includes('DelestagePartiel') || event.includes('DelestageTotal')) {
            const dateTime = new Date(row['Date et Heure']);
            if (isNaN(dateTime.getTime())) return;
            
            const dateStr = dateTime.toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
            const dateKey = dateTime.toISOString().split('T')[0];
            const time = dateTime.toLocaleTimeString('fr-FR', {
                hour: '2-digit', minute: '2-digit'
            });
            
            const eventType = event.includes('DelestagePartiel') ? 'Délestage Partiel' : 'Délestage Total';
            
            // Initialiser le jour si nécessaire
            if (!eventsByDayMap.has(dateKey)) {
                eventsByDayMap.set(dateKey, {
                    date: dateStr,
                    dateObj: dateKey,
                    partiel: [],
                    total: [],
                    hasBoth: false,
                    events: []
                });
            }
            
            const dayData = eventsByDayMap.get(dateKey);
            
            // Chercher s'il y a déjà un événement du même type pour calculer début/fin
            const existingEvents = dayData.events.filter(e => e.type === eventType);
            
            if (existingEvents.length === 0) {
                // Premier événement de ce type pour cette journée
                dayData.events.push({
                    type: eventType,
                    start: time,
                    end: time,
                    count: 1,
                    times: [time]
                });
            } else {
                // Mettre à jour l'événement existant
                const lastEvent = existingEvents[existingEvents.length - 1];
                lastEvent.end = time;
                lastEvent.count++;
                lastEvent.times.push(time);
                
                // Calculer la durée entre le premier et le dernier
                const startTime = lastEvent.times[0];
                const endTime = lastEvent.times[lastEvent.times.length - 1];
                
                const start = new Date(`2000-01-01T${startTime}`);
                const end = new Date(`2000-01-01T${endTime}`);
                if (end < start) end.setDate(end.getDate() + 1);
                
                const diffMs = end - start;
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                
                lastEvent.duration = diffHours > 0 ? 
                    `${diffHours}h${diffMinutes.toString().padStart(2, '0')}` : 
                    `${diffMinutes}min`;
                
                totalDurationMinutes += diffMs / (1000 * 60);
            }
            
            // Ajouter aux listes spécifiques
            if (eventType === 'Délestage Partiel') {
                // Mettre à jour la liste partiel
                const existingPartiel = dayData.partiel.find(p => p.start === time);
                if (!existingPartiel) {
                    dayData.partiel.push({
                        start: time,
                        end: time,
                        duration: '-',
                        count: 1
                    });
                }
            } else {
                const existingTotal = dayData.total.find(t => t.start === time);
                if (!existingTotal) {
                    dayData.total.push({
                        start: time,
                        end: time,
                        duration: '-',
                        count: 1
                    });
                }
            }
        }
    });
    
    // Traiter chaque jour pour calculer les durées finales
    const eventsByDay = [];
    let totalPartiel = 0;
    let totalTotal = 0;
    
    eventsByDayMap.forEach((day, dateKey) => {
        // Traiter les événements partiels
        if (day.partiel.length > 0) {
            day.partiel.sort((a, b) => a.start.localeCompare(b.start));
            // Si plusieurs événements, prendre le premier début et dernière fin
            if (day.partiel.length > 1) {
                const first = day.partiel[0];
                const last = day.partiel[day.partiel.length - 1];
                
                const start = new Date(`2000-01-01T${first.start}`);
                const end = new Date(`2000-01-01T${last.end}`);
                if (end < start) end.setDate(end.getDate() + 1);
                
                const diffMs = end - start;
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                
                day.partiel = [{
                    start: first.start,
                    end: last.end,
                    duration: diffHours > 0 ? `${diffHours}h${diffMinutes.toString().padStart(2, '0')}` : `${diffMinutes}min`,
                    count: day.partiel.length
                }];
            }
            totalPartiel += day.partiel.reduce((sum, p) => sum + (p.count || 1), 0);
        }
        
        // Traiter les événements totaux
        if (day.total.length > 0) {
            day.total.sort((a, b) => a.start.localeCompare(b.start));
            if (day.total.length > 1) {
                const first = day.total[0];
                const last = day.total[day.total.length - 1];
                
                const start = new Date(`2000-01-01T${first.start}`);
                const end = new Date(`2000-01-01T${last.end}`);
                if (end < start) end.setDate(end.getDate() + 1);
                
                const diffMs = end - start;
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                
                day.total = [{
                    start: first.start,
                    end: last.end,
                    duration: diffHours > 0 ? `${diffHours}h${diffMinutes.toString().padStart(2, '0')}` : `${diffMinutes}min`,
                    count: day.total.length
                }];
            }
            totalTotal += day.total.reduce((sum, t) => sum + (t.count || 1), 0);
        }
        
        day.hasBoth = day.partiel.length > 0 && day.total.length > 0;
        eventsByDay.push(day);
    });
    
    // Trier par date décroissante
    eventsByDay.sort((a, b) => new Date(b.dateObj) - new Date(a.dateObj));
    
    // Formater la durée totale
    const totalHours = Math.floor(totalDurationMinutes / 60);
    const totalMins = Math.floor(totalDurationMinutes % 60);
    const totalDuration = totalHours > 0 ? 
        `${totalHours}h${totalMins > 0 ? totalMins + 'min' : ''}` : 
        `${totalMins}min`;
    
    return {
        eventsByDay: eventsByDay,
        totalEvents: totalPartiel + totalTotal,
        totalPartiel: totalPartiel,
        totalTotal: totalTotal,
        totalDuration: totalDuration || '0h'
    };
}
function createDelestageEventsTable() {
    const container = document.createElement('div');
    container.id = 'delestage-events-table-container';
    container.style.cssText = `
        margin-top: 25px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        border: 1px solid #e2e8f0;
    `;
    
    const delestageData = analyzeDelestageEvents();
    
    // ✅ Calculer le nombre total de jours avec diagnostic (données)
    const totalDiagnosticDays = new Set();
    
    // Récupérer tous les jours des données d'énergie
    if (combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            if (row['Date et Heure']) {
                const date = row['Date et Heure'].split(' ')[0];
                totalDiagnosticDays.add(date);
            }
        });
    }
    
    // Récupérer tous les jours des données de tension
    if (combinedTensionData.length > 0) {
        combinedTensionData.forEach(row => {
            if (row['Date et Heure']) {
                const date = row['Date et Heure'].split(' ')[0];
                totalDiagnosticDays.add(date);
            }
        });
    }
    
    const totalDays = totalDiagnosticDays.size;
    
    // Vérifier si des données existent
    if (!delestageData || delestageData.totalEvents === 0) {
        const noData = document.createElement('div');
        noData.style.cssText = `
            padding: 60px;
            text-align: center;
            color: #64748b;
            background: #f8fafc;
        `;
        noData.innerHTML = `
            <span style="font-size: 64px; display: block; margin-bottom: 20px;">✅</span>
            <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 20px;">Aucun événement de délestage</h3>
            <p style="margin: 0; color: #64748b; font-size: 14px;">Aucun délestage (partiel ou total) n'a été enregistré sur ${totalDays} jour(s) de diagnostic.</p>
        `;
        container.appendChild(noData);
        return container;
    }
    
    // Calculer les statistiques pour les pourcentages
    const daysWithPartiel = delestageData.eventsByDay.filter(day => day.partiel.length > 0).length;
    const daysWithTotal = delestageData.eventsByDay.filter(day => day.total.length > 0).length;
    const daysWithBoth = delestageData.eventsByDay.filter(day => day.partiel.length > 0 && day.total.length > 0).length;
    
    // ✅ POURCENTAGES PAR RAPPORT AU NOMBRE TOTAL DE JOURS DE DIAGNOSTIC
    const percentPartiel = totalDays > 0 ? ((daysWithPartiel / totalDays) * 100).toFixed(1) : 0;
    const percentTotal = totalDays > 0 ? ((daysWithTotal / totalDays) * 100).toFixed(1) : 0;
    const percentBoth = totalDays > 0 ? ((daysWithBoth / totalDays) * 100).toFixed(1) : 0;
    
    // En-tête
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
        color: white;
        padding: 15px 25px;
        font-size: 16px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 15px;
    `;
    
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">🔌</span>
            <span>Événements de Délestage - Analyse détaillée</span>
        </div>
        <div style="display: flex; align-items: center; gap: 15px;">
            <span style="background: rgba(255,255,255,0.15); padding: 6px 16px; border-radius: 30px; font-size: 12px; font-weight: 600;">
                📅 ${totalDays} jour(s) de diagnostic
            </span>
            <span style="background: #ea580c80; padding: 6px 16px; border-radius: 30px; font-size: 12px; font-weight: 600;">
                🔌 Partiel: ${delestageData.totalPartiel}
            </span>
            <span style="background: #991b1b80; padding: 6px 16px; border-radius: 30px; font-size: 12px; font-weight: 600;">
                🔋 Total: ${delestageData.totalTotal}
            </span>
        </div>
    `;
    
    container.appendChild(header);
    
    // ✅ CARTES DE POURCENTAGES
    const statsCards = document.createElement('div');
    statsCards.style.cssText = `
        padding: 20px 25px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
    `;
    
    statsCards.innerHTML = `
        <!-- Délestage Partiel -->
        <div style="background: white; padding: 15px; border-radius: 12px; border-left: 5px solid #ea580c; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 13px; color: #ea580c; font-weight: 700;">🔌 DÉLESTAGE PARTIEL</span>
                <span style="background: #ea580c20; color: #ea580c; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;">${delestageData.totalPartiel} fois</span>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-size: 12px; color: #64748b;">Jours concernés</span>
                    <span style="font-weight: 700; color: #1e293b;">${daysWithPartiel} / ${totalDays}</span>
                </div>
                <div style="width: 100%; height: 10px; background: #e2e8f0; border-radius: 6px; overflow: hidden;">
                    <div style="width: ${percentPartiel}%; height: 100%; background: #ea580c; border-radius: 6px;"></div>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <span style="font-size: 24px; font-weight: 800; color: #ea580c;">${percentPartiel}%</span>
                <span style="font-size: 11px; color: #64748b;">des jours de diagnostic</span>
            </div>
        </div>
        
        <!-- Délestage Total -->
        <div style="background: white; padding: 15px; border-radius: 12px; border-left: 5px solid #991b1b; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 13px; color: #991b1b; font-weight: 700;">🔋 DÉLESTAGE TOTAL</span>
                <span style="background: #991b1b20; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;">${delestageData.totalTotal} fois</span>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-size: 12px; color: #64748b;">Jours concernés</span>
                    <span style="font-weight: 700; color: #1e293b;">${daysWithTotal} / ${totalDays}</span>
                </div>
                <div style="width: 100%; height: 10px; background: #e2e8f0; border-radius: 6px; overflow: hidden;">
                    <div style="width: ${percentTotal}%; height: 100%; background: #991b1b; border-radius: 6px;"></div>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <span style="font-size: 24px; font-weight: 800; color: #991b1b;">${percentTotal}%</span>
                <span style="font-size: 11px; color: #64748b;">des jours de diagnostic</span>
            </div>
        </div>
        
        <!-- Synthèse -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 15px; border-radius: 12px; color: white;">
            <div style="font-size: 13px; font-weight: 700; margin-bottom: 15px; opacity: 0.9;">📊 SYNTHÈSE</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                    <div style="font-size: 11px; opacity: 0.8;">Jours diagnostic</div>
                    <div style="font-size: 28px; font-weight: 800;">${totalDays}</div>
                </div>
                <div>
                    <div style="font-size: 11px; opacity: 0.8;">Jours avec dél.</div>
                    <div style="font-size: 28px; font-weight: 800;">${delestageData.eventsByDay.length}</div>
                </div>
                <div>
                    <div style="font-size: 11px; opacity: 0.8;">Taux d'occurrence</div>
                    <div style="font-size: 20px; font-weight: 700;">${totalDays > 0 ? ((delestageData.eventsByDay.length / totalDays) * 100).toFixed(1) : 0}%</div>
                </div>
                <div>
                    <div style="font-size: 11px; opacity: 0.8;">Dernier</div>
                    <div style="font-size: 14px; font-weight: 600;">${delestageData.eventsByDay[0]?.date || '-'}</div>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(statsCards);
    
    // Légende
    const legend = document.createElement('div');
    legend.style.cssText = `
        padding: 12px 25px;
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 25px;
        flex-wrap: wrap;
        font-size: 12px;
    `;
    
    legend.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 14px; height: 14px; background: #ea580c; border-radius: 4px;"></div>
            <span style="color: #9a3412; font-weight: 600;">🔌 Délestage Partiel</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 14px; height: 14px; background: #991b1b; border-radius: 4px;"></div>
            <span style="color: #7f1d1d; font-weight: 600;">🔋 Délestage Total</span>
        </div>
        <div style="margin-left: auto; background: white; padding: 4px 12px; border-radius: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <span style="color: #475569;">⏱️ Durée = heure de fin - heure de début</span>
        </div>
    `;
    
    container.appendChild(legend);
    
    // Tableau avec hauteur fixe de 350px
    const tableWrapper = document.createElement('div');
    tableWrapper.style.cssText = `
        max-height: 350px;
        overflow-y: auto;
        overflow-x: auto;
        position: relative;
        scrollbar-width: thin;
        background: white;
    `;
    
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 1000px;">
            <thead style="position: sticky; top: 0; z-index: 20; background: white;">
                <tr style="background: #334155; color: white;">
                    <th style="padding: 14px 10px; text-align: left; border-bottom: 3px solid #1e293b; position: sticky; left: 0; background: #334155; color: white; font-weight: 700;">📅 DATE</th>
                    <th style="padding: 14px 10px; text-align: center; border-bottom: 3px solid #1e293b; background: #334155; color: white; font-weight: 700;" colspan="3">🔌 DÉLESTAGE PARTIEL</th>
                    <th style="padding: 14px 10px; text-align: center; border-bottom: 3px solid #1e293b; background: #334155; color: white; font-weight: 700;" colspan="3">🔋 DÉLESTAGE TOTAL</th>
                </tr>
                <tr style="background: #f1f5f9;">
                    <th style="padding: 12px 10px; text-align: left; border-bottom: 2px solid #cbd5e1; position: sticky; left: 0; background: #f1f5f9;"></th>
                    <th style="padding: 12px 10px; text-align: center; border-bottom: 2px solid #cbd5e1; background: #f1f5f9;">Début</th>
                    <th style="padding: 12px 10px; text-align: center; border-bottom: 2px solid #cbd5e1; background: #f1f5f9;">Fin</th>
                    <th style="padding: 12px 10px; text-align: center; border-bottom: 2px solid #cbd5e1; background: #f1f5f9;">Durée</th>
                    <th style="padding: 12px 10px; text-align: center; border-bottom: 2px solid #cbd5e1; background: #f1f5f9;">Début</th>
                    <th style="padding: 12px 10px; text-align: center; border-bottom: 2px solid #cbd5e1; background: #f1f5f9;">Fin</th>
                    <th style="padding: 12px 10px; text-align: center; border-bottom: 2px solid #cbd5e1; background: #f1f5f9;">Durée</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Grouper les événements par jour
    delestageData.eventsByDay.forEach((day, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
        const rowSpan = Math.max(1, day.partiel.length, day.total.length);
        
        // Première ligne pour ce jour
        tableHTML += `<tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">`;
        
        // Date (avec rowSpan)
        tableHTML += `
            <td style="padding: 12px 10px; position: sticky; left: 0; background: ${bgColor}; font-weight: 700; border-right: 1px solid #e2e8f0;" rowspan="${rowSpan}">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 13px;">${day.date}</span>
                    <span style="font-size: 9px; color: #64748b; margin-top: 2px;">${day.dateObj}</span>
                </div>
            </td>
        `;
        
        // Délestage Partiel - première occurrence
        if (day.partiel.length > 0) {
            const p = day.partiel[0];
            tableHTML += `
                <td style="padding: 12px 10px; text-align: center; background: #ea580c10; color: #9a3412; font-weight: 600; font-family: monospace;">${p.start}</td>
                <td style="padding: 12px 10px; text-align: center; background: #ea580c10; color: #9a3412; font-weight: 600; font-family: monospace;">${p.end}</td>
                <td style="padding: 12px 10px; text-align: center; background: #ea580c20; color: #ea580c; font-weight: 700; font-family: monospace;">${p.duration} ${p.count > 1 ? `<span style="background: white; padding: 2px 6px; border-radius: 12px; font-size: 9px; margin-left: 4px;">${p.count}x</span>` : ''}</td>
            `;
        } else {
            tableHTML += `
                <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
                <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
                <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
            `;
        }
        
        // Délestage Total - première occurrence
        if (day.total.length > 0) {
            const t = day.total[0];
            tableHTML += `
                <td style="padding: 12px 10px; text-align: center; background: #991b1b10; color: #7f1d1d; font-weight: 600; font-family: monospace;">${t.start}</td>
                <td style="padding: 12px 10px; text-align: center; background: #991b1b10; color: #7f1d1d; font-weight: 600; font-family: monospace;">${t.end}</td>
                <td style="padding: 12px 10px; text-align: center; background: #991b1b20; color: #991b1b; font-weight: 700; font-family: monospace;">${t.duration} ${t.count > 1 ? `<span style="background: white; padding: 2px 6px; border-radius: 12px; font-size: 9px; margin-left: 4px;">${t.count}x</span>` : ''}</td>
            `;
        } else {
            tableHTML += `
                <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
                <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
                <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
            `;
        }
        
        tableHTML += `</tr>`;
        
        // Lignes supplémentaires pour les événements multiples dans la même journée
        const maxEvents = Math.max(day.partiel.length, day.total.length);
        for (let i = 1; i < maxEvents; i++) {
            tableHTML += `<tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">`;
            
            // Partiel (si existe)
            if (i < day.partiel.length) {
                const p = day.partiel[i];
                tableHTML += `
                    <td style="padding: 12px 10px; text-align: center; background: #ea580c10; color: #9a3412; font-weight: 600; font-family: monospace;">${p.start}</td>
                    <td style="padding: 12px 10px; text-align: center; background: #ea580c10; color: #9a3412; font-weight: 600; font-family: monospace;">${p.end}</td>
                    <td style="padding: 12px 10px; text-align: center; background: #ea580c20; color: #ea580c; font-weight: 700; font-family: monospace;">${p.duration} ${p.count > 1 ? `<span style="background: white; padding: 2px 6px; border-radius: 12px; font-size: 9px; margin-left: 4px;">${p.count}x</span>` : ''}</td>
                `;
            } else {
                tableHTML += `
                    <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
                    <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
                    <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
                `;
            }
            
            // Total (si existe)
            if (i < day.total.length) {
                const t = day.total[i];
                tableHTML += `
                    <td style="padding: 12px 10px; text-align: center; background: #991b1b10; color: #7f1d1d; font-weight: 600; font-family: monospace;">${t.start}</td>
                    <td style="padding: 12px 10px; text-align: center; background: #991b1b10; color: #7f1d1d; font-weight: 600; font-family: monospace;">${t.end}</td>
                    <td style="padding: 12px 10px; text-align: center; background: #991b1b20; color: #991b1b; font-weight: 700; font-family: monospace;">${t.duration} ${t.count > 1 ? `<span style="background: white; padding: 2px 6px; border-radius: 12px; font-size: 9px; margin-left: 4px;">${t.count}x</span>` : ''}</td>
                `;
            } else {
                tableHTML += `
                    <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
                    <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
                    <td style="padding: 12px 10px; text-align: center; color: #cbd5e1; font-style: italic;">-</td>
                `;
            }
            
            tableHTML += `</tr>`;
        }
    });
    
    // Ligne de total
    tableHTML += `
        <tr style="background: #1e293b; color: white; font-weight: 700; position: sticky; bottom: 0; z-index: 15;">
            <td style="padding: 14px 10px; text-align: left; background: #1e293b; position: sticky; left: 0;">TOTAL GÉNÉRAL</td>
            <td style="padding: 14px 10px; text-align: center; background: #1e293b;" colspan="3">
                <span style="background: #ea580c; padding: 6px 16px; border-radius: 30px; font-size: 12px;">
                    ${delestageData.totalPartiel} événement(s)
                </span>
            </td>
            <td style="padding: 14px 10px; text-align: center; background: #1e293b;" colspan="3">
                <span style="background: #991b1b; padding: 6px 16px; border-radius: 30px; font-size: 12px;">
                    ${delestageData.totalTotal} événement(s)
                </span>
            </td>
        </tr>
    `;
    
    tableHTML += `</tbody></table>`;
    tableWrapper.innerHTML = tableHTML;
    container.appendChild(tableWrapper);
    
    // Pied de tableau avec statistiques
    const footer = document.createElement('div');
    footer.style.cssText = `
        padding: 15px 25px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: #475569;
        flex-wrap: wrap;
        gap: 15px;
    `;
    
    footer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px;">
            <span>📊 <strong>${delestageData.eventsByDay.length}</strong> jour(s) avec délestages</span>
            <span>⏱️ Durée totale: <strong>${delestageData.totalDuration}</strong></span>
        </div>
        <div style="display: flex; align-items: center; gap: 20px;">
            <span>🔌 Partiel: <strong style="color: #ea580c;">${delestageData.totalPartiel}</strong> fois</span>
            <span>🔋 Total: <strong style="color: #991b1b;">${delestageData.totalTotal}</strong> fois</span>
        </div>
    `;
    
    container.appendChild(footer);
    
    return container;
}
// ==================== CARD 4 : ANALYSE TOTALE ÉNERGIE ====================
function displayEnergyAnalysis() {
    const cardContent = document.getElementById('card-energy-analysis-content');
    if (!cardContent) return;
    
    cardContent.innerHTML = '';
    
    const cardTitle = document.createElement('h3');
    cardTitle.style.cssText = `margin: 0 0 15px 0; color: #1e293b; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0;`;
    cardTitle.innerHTML = `<span style="font-size: 24px;">⚡</span> ANALYSE TOTALE D'ÉNERGIE`;
    cardContent.appendChild(cardTitle);
    
    const chartContainer1 = document.createElement('div');
    chartContainer1.id = 'total-energy-chart-placeholder';
    chartContainer1.style.cssText = `margin-bottom: 25px;`;
    cardContent.appendChild(chartContainer1);
    
    const chartContainer2 = document.createElement('div');
    chartContainer2.id = 'hourly-energy-chart-placeholder';
    chartContainer2.style.cssText = `margin-top: 0;`;
    cardContent.appendChild(chartContainer2);
    
    setTimeout(() => {
        createTotalEnergyChart();
        createDateSelectorForHourlyEnergy(); // 👈 AJOUTER CETTE LIGNE
        createHourlyEnergyChart('all');
    }, 100);
}
// ==================== GRAPHIQUES TENSION ====================
function createTensionChart() {
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    if (dataToUse.length === 0) return;
    
    const container = document.getElementById('tension-chart-placeholder');
    if (!container) return;
    container.innerHTML = '';
    
    const systemType = detectSystemType(dataToUse);
    const limits = getSystemLimits(systemType);
    
    // FORCED SCALES - MODIFY THIS SECTION
    let yMin, yMax;
    if (systemType === '12V') {
        // Force scale to 10V - 16V for 12V systems
        yMin = 10;
        yMax = 16;
    } else {
        // Force scale to 20V - 30V for 24V systems
        yMin = 20;
        yMax = 30;
    }
    
    // Rest of the function continues with data processing...
    const dailyData = {};
    const pointsExceedingLimits = { min: [], max: [], avg: [] };
    
    dataToUse.forEach(row => {
        if (!row['Date et Heure']) return;
        const date = row['Date et Heure'].split(' ')[0];
        const tMin = parseFloat(row['T_min']) || 0;
        const tMoy = parseFloat(row['T_moy']) || 0;
        const tMax = parseFloat(row['T_max']) || 0;
        
        if (tMin > 0 && tMin < limits.min) pointsExceedingLimits.min.push({ date, value: tMin });
        if (tMax > 0 && tMax > limits.max) pointsExceedingLimits.max.push({ date, value: tMax });
        if (tMoy > 0 && (tMoy < limits.min || tMoy > limits.max)) pointsExceedingLimits.avg.push({ date, value: tMoy });
        
        if (!dailyData[date]) {
            dailyData[date] = { min: tMin, max: tMax, sumMoy: tMoy, countMoy: 1, allMins: [tMin], allMaxs: [tMax] };
        } else {
            dailyData[date].allMins.push(tMin);
            dailyData[date].min = Math.min(dailyData[date].min, tMin);
            dailyData[date].allMaxs.push(tMax);
            dailyData[date].max = Math.max(dailyData[date].max, tMax);
            dailyData[date].sumMoy += tMoy;
            dailyData[date].countMoy++;
        }
    });
    
    const dates = Object.keys(dailyData).sort();
    const minValues = dates.map(date => dailyData[date].min);
    const maxValues = dates.map(date => dailyData[date].max);
    const avgValues = dates.map(date => dailyData[date].sumMoy / dailyData[date].countMoy);
    
    const pointBackgroundColorsMin = minValues.map(v => v > 0 && (v < limits.min || v > limits.max) ? '#ef4444' : '#3b82f6');
    const pointBackgroundColorsMax = maxValues.map(v => v > 0 && (v > limits.max || v < limits.min) ? '#ef4444' : '#ef4444');
    const pointBackgroundColorsAvg = avgValues.map(v => v > 0 && (v < limits.min || v > limits.max) ? '#ef4444' : '#10b981');
    
    // ... (rest of the chart creation code remains the same)
    
    const exceedanceCount = { total: pointsExceedingLimits.min.length + pointsExceedingLimits.max.length + pointsExceedingLimits.avg.length };
    
    const chartContainer = document.createElement('div');
    chartContainer.style.cssText = `background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden;`;
    
    const chartHeader = document.createElement('div');
    chartHeader.style.cssText = `background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 15px 25px; font-size: 16px; font-weight: 600; display: flex; justify-content: space-between; align-items: center;`;
    chartHeader.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;"><span>📊</span><span>Tension - Min, Max et Moyenne par Jour</span></div>
        <div style="display: flex; align-items: center; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; background: rgba(255,255,255,0.2); padding: 5px 12px; border-radius: 20px;"><span style="display: inline-block; width: 12px; height: 12px; background: ${systemType === '12V' ? '#f97316' : '#eab308'}; border-radius: 2px;"></span><span>Système <strong>${systemType}</strong></span></div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; background: rgba(255,255,255,0.2); padding: 5px 12px; border-radius: 20px;"><span>📊 Plage: ${yMin}V - ${yMax}V</span></div>
            ${exceedanceCount.total > 0 ? `<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; background: rgba(239, 68, 68, 0.3); padding: 5px 12px; border-radius: 20px;"><span style="display: inline-block; width: 12px; height: 12px; background: #ef4444; border-radius: 50%;"></span><span>⚠️ ${exceedanceCount.total} dépassement(s)</span></div>` : ''}
        </div>
    `;
    
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = `padding: 20px; height: 400px;`;
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `height: 330px; position: relative; margin-top: 10px;`;
    
    chartContainer.appendChild(chartHeader);
    chartWrapper.appendChild(canvasContainer);
    chartContainer.appendChild(chartWrapper);
    container.appendChild(chartContainer);
    
    const ctx = document.createElement('canvas');
    ctx.id = 'tension-chart-canvas';
    ctx.style.width = '100%';
    ctx.style.height = '100%';
    canvasContainer.appendChild(ctx);
    
    setTimeout(() => {
        if (typeof Chart === 'undefined') return;
        try {
            const existingChart = Chart.getChart(ctx);
            if (existingChart) existingChart.destroy();
            
            const thresholdDatasets = [
                { label: '', data: dates.map(() => limits.min), borderColor: '#ef4444', borderWidth: 2, borderDash: [8, 6], pointRadius: 0, pointHoverRadius: 0, fill: false, tension: 0, order: 4 },
                { label: '', data: dates.map(() => limits.max), borderColor: '#ef4444', borderWidth: 2, borderDash: [8, 6], pointRadius: 0, pointHoverRadius: 0, fill: false, tension: 0, order: 4 }
            ];
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [
                        ...thresholdDatasets,
                        { label: 'Tension Maximale', data: maxValues, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: pointBackgroundColorsMax, pointBorderColor: 'white', pointBorderWidth: 1.5, pointHoverRadius: 6, pointHoverBackgroundColor: '#b91c1c', tension: 0.3, fill: false, order: 1 },
                        { label: 'Tension Moyenne', data: avgValues, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderWidth: 3, pointRadius: 4, pointBackgroundColor: pointBackgroundColorsAvg, pointBorderColor: 'white', pointBorderWidth: 2, pointHoverRadius: 7, pointHoverBackgroundColor: '#1e3a8a', tension: 0.3, fill: false, order: 2 },
                        { label: 'Tension Minimale', data: minValues, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: pointBackgroundColorsMin, pointBorderColor: 'white', pointBorderWidth: 1.5, pointHoverRadius: 6, pointHoverBackgroundColor: '#047857', tension: 0.3, fill: false, order: 3 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { position: 'top', labels: { font: { size: 12, weight: 'bold' }, usePointStyle: true, pointStyle: 'circle', padding: 20, filter: item => item.text !== '' } },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)', titleFont: { size: 13, weight: 'bold' }, bodyFont: { size: 12 }, padding: 12, cornerRadius: 8,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    let value = context.parsed.y.toFixed(2);
                                    const isExceeding = (label.includes('Minimale') && parseFloat(value) < limits.min) || (label.includes('Maximale') && parseFloat(value) > limits.max) || (label.includes('Moyenne') && (parseFloat(value) < limits.min || parseFloat(value) > limits.max));
                                    return `${isExceeding ? '🔴' : '✅'} ${label}: ${value} V${isExceeding ? ' ⚠️ HORS LIMITES' : ''}`;
                                },
                                afterLabel: function(context) {
                                    const value = context.parsed.y;
                                    if (value < limits.min) return `⬇️ Sous seuil minimum (${limits.min}V)`;
                                    if (value > limits.max) return `⬆️ Au-dessus seuil maximum (${limits.max}V)`;
                                    return '';
                                }
                            }
                        }
                    },
                    scales: {
                        x: { title: { display: true, text: 'Date', font: { size: 13, weight: 'bold' } }, ticks: { maxRotation: 45, font: { size: 11 } }, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                        y: {
                            title: { display: true, text: 'Tension (Volts)', font: { size: 13, weight: 'bold' } },
                            ticks: { font: { size: 11, weight: '500' }, stepSize: systemType === '12V' ? 1 : 2, callback: function(value) { return value + 'V'; } },
                            min: yMin, 
                            max: yMax,
                            grid: {
                                color: function(context) { 
                                    const v = context.tick.value; 
                                    if (v === limits.min || v === limits.max) return 'rgba(239, 68, 68, 0.3)'; 
                                    return 'rgba(0, 0, 0, 0.06)'; 
                                },
                                lineWidth: ctx => [limits.min, limits.max].includes(ctx.tick.value) ? 2 : 1,
                                borderDash: ctx => [limits.min, limits.max].includes(ctx.tick.value) ? [8, 6] : []
                            }
                        }
                    }
                }
            });
        } catch (error) { console.error('Erreur graphique tension:', error); }
    }, 50);
}

function createHourlyTensionChart(selectedDate = 'all') {
    const container = document.getElementById('hourly-tension-chart-placeholder');
    if (!container) return;
    
    // Sauvegarder le sélecteur existant
    const existingSelector = document.getElementById('hourly-tension-date-selector');
    
    // Vider le conteneur mais garder le sélecteur
    container.innerHTML = '';
    if (existingSelector) container.appendChild(existingSelector);
    
    // Récupérer les données à utiliser (respecte les filtres globaux)
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    if (dataToUse.length === 0) {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">📊 Aucune donnée de tension disponible</div>';
        return;
    }
    
    // Filtrer par date si nécessaire (s'ajoute aux filtres globaux)
    let filteredData = dataToUse;
    let selectedDateFormatted = '';
    let activeFilters = [];
    
    // Ajouter le filtre global
    if (filterPeriod && filterPeriod !== 'all') {
        const periodNames = {
            '5days': '5 jours', '7days': '7 jours', '15days': '15 jours',
            '30days': '30 jours', '2months': '2 mois', '3months': '3 mois',
            '6months': '6 mois', '1year': '1 an'
        };
        activeFilters.push(`Filtre global: ${periodNames[filterPeriod]}`);
    } else if (filterStartDate || filterEndDate) {
        const start = filterStartDate ? filterStartDate.toLocaleDateString('fr-FR') : 'début';
        const end = filterEndDate ? filterEndDate.toLocaleDateString('fr-FR') : 'fin';
        activeFilters.push(`Filtre global: ${start} → ${end}`);
    } else if (filterMonth && filterYear) {
        activeFilters.push(`Filtre global: ${filterMonth}/${filterYear}`);
    }
    
    // Appliquer le filtre de date spécifique au graphique
    if (selectedDate && selectedDate !== 'all') {
        filteredData = dataToUse.filter(row => {
            if (!row['Date et Heure']) return false;
            const rowDate = row['Date et Heure'].split(' ')[0];
            return rowDate === selectedDate;
        });
        
        const dateObj = new Date(selectedDate);
        selectedDateFormatted = dateObj.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        if (filteredData.length === 0) {
            const noDataMsg = document.createElement('div');
            noDataMsg.style.cssText = `
                padding: 40px;
                text-align: center;
                background: #f8fafc;
                border-radius: 8px;
                color: #64748b;
                font-size: 14px;
                margin-top: 20px;
            `;
            noDataMsg.innerHTML = `📅 Aucune donnée horaire pour le ${selectedDateFormatted}<br><small>Veuillez choisir une autre date dans le sélecteur ci-dessus</small>`;
            container.appendChild(noDataMsg);
            return;
        }
    }
    
    // Détecter le système de tension
    const systemType = detectSystemType(filteredData);
    const limits = getSystemLimits(systemType);
    
    // ===== FORCER L'ÉCHELLE POUR LE GRAPHIQUE HORAIRE =====
    let yMin, yMax;
    if (systemType === '12V') {
        // Forcer l'échelle à 10V - 16V pour les systèmes 12V
        yMin = 10;
        yMax = 16;
    } else {
        // Forcer l'échelle à 20V - 30V pour les systèmes 24V
        yMin = 20;
        yMax = 30;
    }
    
    // Grouper les données par heure
    const hourlyData = {};
    
    filteredData.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const dateTime = new Date(row['Date et Heure']);
        if (isNaN(dateTime.getTime())) return;
        
        const hourKey = dateTime.getHours().toString().padStart(2, '0') + ':00';
        const hourLabel = `${dateTime.getHours().toString().padStart(2, '0')}h00`;
        const fullDate = dateTime.toLocaleDateString('fr-FR');
        const fullDateTime = dateTime.toLocaleString('fr-FR');
        
        if (!hourlyData[hourKey]) {
            hourlyData[hourKey] = {
                label: hourLabel,
                fullDate: fullDate,
                fullDateTime: fullDateTime,
                t_min_sum: 0,
                t_moy_sum: 0,
                t_max_sum: 0,
                count: 0,
                dateTime: dateTime,
                t_min: Infinity,
                t_max: -Infinity,
                t_min_values: [],
                t_moy_values: [],
                t_max_values: []
            };
        }
        
        const tMin = parseFloat(row['T_min']) || 0;
        const tMoy = parseFloat(row['T_moy']) || 0;
        const tMax = parseFloat(row['T_max']) || 0;
        
        if (tMin > 0) {
            hourlyData[hourKey].t_min_sum += tMin;
            hourlyData[hourKey].t_min = Math.min(hourlyData[hourKey].t_min, tMin);
            hourlyData[hourKey].t_min_values.push(tMin);
        }
        if (tMoy > 0) {
            hourlyData[hourKey].t_moy_sum += tMoy;
            hourlyData[hourKey].t_moy_values.push(tMoy);
        }
        if (tMax > 0) {
            hourlyData[hourKey].t_max_sum += tMax;
            hourlyData[hourKey].t_max = Math.max(hourlyData[hourKey].t_max, tMax);
            hourlyData[hourKey].t_max_values.push(tMax);
        }
        
        hourlyData[hourKey].count++;
    });
    
    // Trier par heure
    const sortedHours = Object.keys(hourlyData).sort((a, b) => {
        const hourA = parseInt(a.split(':')[0]);
        const hourB = parseInt(b.split(':')[0]);
        return hourA - hourB;
    }).map(key => ({
        ...hourlyData[key],
        key,
        t_min_avg: hourlyData[key].count > 0 ? hourlyData[key].t_min_sum / hourlyData[key].count : 0,
        t_moy_avg: hourlyData[key].count > 0 ? hourlyData[key].t_moy_sum / hourlyData[key].count : 0,
        t_max_avg: hourlyData[key].count > 0 ? hourlyData[key].t_max_sum / hourlyData[key].count : 0,
        t_min_abs: hourlyData[key].t_min !== Infinity ? hourlyData[key].t_min : 0,
        t_max_abs: hourlyData[key].t_max !== -Infinity ? hourlyData[key].t_max : 0
    }));
    
    // Préparer les données pour le graphique
    const hourlyTension = sortedHours.map(h => ({
        label: h.label,
        fullDate: h.fullDate,
        fullDateTime: h.fullDateTime,
        t_min: h.t_min_avg,
        t_moy: h.t_moy_avg,
        t_max: h.t_max_avg,
        t_min_abs: h.t_min_abs,
        t_max_abs: h.t_max_abs,
        hour: parseInt(h.label),
        count: h.count,
        t_min_values: h.t_min_values,
        t_moy_values: h.t_moy_values,
        t_max_values: h.t_max_values
    }));
    
    // Créer le conteneur du graphique
    const chartContainer = document.createElement('div');
    chartContainer.id = 'hourly-tension-chart-container';
    chartContainer.style.cssText = `
        background: white;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        border: 1px solid #e2e8f0;
        margin-top: 15px;
    `;
    
    // ===== BADGE DE DATE =====
    const badgeContainer = document.createElement('div');
    badgeContainer.style.cssText = `
        background: #f8fafc;
        padding: 10px 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 15px;
        flex-wrap: wrap;
    `;
    
    // Badge pour la date sélectionnée
    const dateBadge = document.createElement('div');
    dateBadge.style.cssText = `
        background: ${selectedDate && selectedDate !== 'all' ? '#3b82f6' : '#94a3b8'};
        color: white;
        padding: 6px 15px;
        border-radius: 30px;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    `;
    
    if (selectedDate && selectedDate !== 'all') {
        dateBadge.innerHTML = `
            <span style="font-size: 16px;">📅</span>
            <span>${selectedDateFormatted}</span>
            <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px; margin-left: 5px;">
                ${hourlyTension.length}h
            </span>
        `;
    } else {
        const uniqueDays = new Set(hourlyTension.map(h => h.fullDate)).size;
        dateBadge.innerHTML = `
            <span style="font-size: 16px;">📊</span>
            <span>Premier jours du relève</span>
        `;
    }
    
    // Badges pour les filtres globaux
    const globalFiltersBadge = document.createElement('div');
    globalFiltersBadge.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-left: auto;
    `;
    
    if (activeFilters.length > 0) {
        activeFilters.forEach(filter => {
            const filterChip = document.createElement('span');
            filterChip.style.cssText = `
                background: #e2e8f0;
                color: #475569;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 5px;
            `;
            filterChip.innerHTML = `<span style="font-size: 12px;">🔍</span> ${filter}`;
            globalFiltersBadge.appendChild(filterChip);
        });
    }
    
    // Bouton retour à toutes les dates
    if (selectedDate && selectedDate !== 'all') {
        const backToAllBtn = document.createElement('button');
        backToAllBtn.style.cssText = `
            background: white;
            border: 1px solid #cbd5e1;
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 11px;
            color: #475569;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: all 0.2s;
        `;
        backToAllBtn.innerHTML = `<span style="font-size: 14px;">↺</span> Toutes les dates`;
        backToAllBtn.onmouseover = () => { backToAllBtn.style.background = '#f1f5f9'; };
        backToAllBtn.onmouseout = () => { backToAllBtn.style.background = 'white'; };
        backToAllBtn.onclick = () => {
            const selector = document.getElementById('hourly-tension-date-filter');
            if (selector) {
                selector.value = 'all';
                updateHourlyTensionChartWithDateFilter('all');
            }
        };
        globalFiltersBadge.appendChild(backToAllBtn);
    }
    
    badgeContainer.appendChild(dateBadge);
    if (globalFiltersBadge.children.length > 0) {
        badgeContainer.appendChild(globalFiltersBadge);
    }
    
    // En-tête principal
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
        color: white;
        padding: 15px 25px;
        font-size: 16px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
    `;
    
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span style="font-size: 20px;">📊</span>
            <span>ÉVOLUTION HORAIRE DE LA TENSION (Min, Moy, Max)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
            <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">
                ${hourlyTension.length} heures
            </span>
            <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">
                Système ${systemType} • Échelle forcée ${yMin}V-${yMax}V
            </span>
        </div>
    `;
    
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = `padding: 20px; height: 350px; position: relative;`;
    
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        height: 280px;
        position: relative;
        margin-bottom: 10px;
    `;
    
    // Assemblage
    chartContainer.appendChild(badgeContainer);
    chartContainer.appendChild(header);
    chartWrapper.appendChild(canvasContainer);
    chartContainer.appendChild(chartWrapper);
    container.appendChild(chartContainer);
    
    // Créer le canvas
    const ctx = document.createElement('canvas');
    ctx.id = 'hourly-tension-chart-canvas';
    ctx.style.width = '100%';
    ctx.style.height = '100%';
    canvasContainer.appendChild(ctx);
    
    // Créer le graphique avec Chart.js
    setTimeout(() => {
        if (typeof Chart === 'undefined') {
            console.log('Chart.js non disponible');
            return;
        }
        
        try {
            const existingChart = Chart.getChart(ctx);
            if (existingChart) existingChart.destroy();
            
            // Labels pour l'axe X (heures)
            const labels = hourlyTension.map(h => h.label);
            
            // Lignes des seuils
            const thresholdDatasets = [
                {
                    label: `Seuil Min ${systemType}`,
                    data: hourlyTension.map(() => limits.min),
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderDash: [8, 6],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 4
                },
                {
                    label: `Seuil Max ${systemType}`,
                    data: hourlyTension.map(() => limits.max),
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderDash: [8, 6],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 4
                }
            ];
            
            // Couleurs des points selon les dépassements
            const tMaxColors = hourlyTension.map(h => h.t_max > limits.max ? '#ef4444' : '#ef4444');
            const tMoyColors = hourlyTension.map(h => 
                h.t_moy < limits.min || h.t_moy > limits.max ? '#ef4444' : '#3b82f6'
            );
            const tMinColors = hourlyTension.map(h => h.t_min < limits.min ? '#ef4444' : '#10b981');
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        ...thresholdDatasets,
                        {
                            label: 'Tension Maximale',
                            data: hourlyTension.map(h => h.t_max),
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)',
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointBackgroundColor: tMaxColors,
                            pointBorderColor: 'white',
                            pointBorderWidth: 1.5,
                            pointHoverRadius: 7,
                            pointHoverBackgroundColor: '#b91c1c',
                            tension: 0.3,
                            fill: false,
                            order: 1
                        },
                        {
                            label: 'Tension Moyenne',
                            data: hourlyTension.map(h => h.t_moy),
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.05)',
                            borderWidth: 3,
                            pointRadius: 5,
                            pointBackgroundColor: tMoyColors,
                            pointBorderColor: 'white',
                            pointBorderWidth: 2,
                            pointHoverRadius: 8,
                            pointHoverBackgroundColor: '#1e3a8a',
                            tension: 0.3,
                            fill: false,
                            order: 2
                        },
                        {
                            label: 'Tension Minimale',
                            data: hourlyTension.map(h => h.t_min),
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.05)',
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointBackgroundColor: tMinColors,
                            pointBorderColor: 'white',
                            pointBorderWidth: 1.5,
                            pointHoverRadius: 7,
                            pointHoverBackgroundColor: '#047857',
                            tension: 0.3,
                            fill: false,
                            order: 3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 800,
                        easing: 'easeInOutQuart'
                    },
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 11, weight: 'bold' },
                                color: '#1e293b',
                                usePointStyle: true,
                                padding: 15,
                                filter: function(item) {
                                    return !item.text.includes('Seuil');
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleFont: { size: 13, weight: 'bold' },
                            bodyFont: { size: 12 },
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                                title: function(context) {
                                    const hourData = hourlyTension[context[0].dataIndex];
                                    if (selectedDate && selectedDate !== 'all') {
                                        return `${hourData.fullDate} • ${hourData.label}`;
                                    }
                                    return `${hourData.fullDateTime}`;
                                },
                                label: function(context) {
                                    const datasetLabel = context.dataset.label || '';
                                    const value = context.parsed.y.toFixed(2);
                                    const hourData = hourlyTension[context.dataIndex];
                                    
                                    let icon = '✅';
                                    let extraInfo = '';
                                    
                                    if (datasetLabel.includes('Maximale')) {
                                        if (parseFloat(value) > limits.max) {
                                            icon = '🔴';
                                            extraInfo = ` (max: ${hourData.t_max_abs.toFixed(2)}V)`;
                                        }
                                    } else if (datasetLabel.includes('Minimale')) {
                                        if (parseFloat(value) < limits.min) {
                                            icon = '🔴';
                                            extraInfo = ` (min: ${hourData.t_min_abs.toFixed(2)}V)`;
                                        }
                                    } else if (datasetLabel.includes('Moyenne')) {
                                        if (parseFloat(value) < limits.min || parseFloat(value) > limits.max) {
                                            icon = '⚠️';
                                        }
                                    }
                                    
                                    return `${icon} ${datasetLabel}: ${value} V${extraInfo}`;
                                },
                                afterLabel: function(context) {
                                    const value = context.parsed.y;
                                    const hourData = hourlyTension[context.dataIndex];
                                    
                                    if (value < limits.min) {
                                        return `⬇️ Sous seuil minimum (${limits.min}V) - Min absolu: ${hourData.t_min_abs.toFixed(2)}V`;
                                    }
                                    if (value > limits.max) {
                                        return `⬆️ Au-dessus seuil maximum (${limits.max}V) - Max absolu: ${hourData.t_max_abs.toFixed(2)}V`;
                                    }
                                    if (hourData.count > 1) {
                                        return `📊 Basé sur ${hourData.count} mesure${hourData.count > 1 ? 's' : ''}`;
                                    }
                                    return '';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            min: yMin,
                            max: yMax,
                            grid: {
                                color: function(context) {
                                    const value = context.tick.value;
                                    if (value === limits.min || value === limits.max) {
                                        return 'rgba(239, 68, 68, 0.3)';
                                    }
                                    return 'rgba(0, 0, 0, 0.06)';
                                },
                                lineWidth: function(context) {
                                    const value = context.tick.value;
                                    return (value === limits.min || value === limits.max) ? 2 : 1;
                                }
                            },
                            title: {
                                display: true,
                                text: 'Tension (Volts)',
                                font: { size: 12, weight: 'bold' },
                                color: '#475569'
                            },
                            ticks: {
                                font: { size: 11 },
                                color: '#64748b',
                                stepSize: systemType === '12V' ? 1 : 2,
                                callback: function(value) {
                                    if (value === limits.min || value === limits.max) {
                                        return `⚠️ ${value}V`;
                                    }
                                    return value + 'V';
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                font: { size: 10 },
                                color: '#64748b',
                                maxRotation: 45,
                                minRotation: 45,
                                maxTicksLimit: 24
                            },
                            title: {
                                display: true,
                                text: 'Heure',
                                font: { size: 12, weight: 'bold' },
                                color: '#475569',
                                padding: { top: 10 }
                            }
                        }
                    }
                }
            });
            
            console.log(`✅ Graphique tension horaire créé avec ${hourlyTension.length} heures (échelle forcée ${yMin}V-${yMax}V)`);
            
            // Ajouter le résumé statistique
            if (hourlyTension && hourlyTension.length > 0) {
                addHourlyTensionSummary(chartContainer, hourlyTension, systemType, limits, selectedDate, selectedDateFormatted);
            }
            
        } catch (error) {
            console.error('❌ Erreur création graphique tension horaire:', error);
        }
    }, 150);
}

// Fonction pour ajouter le résumé statistique
function addHourlyTensionSummary(container, hourlyData, systemType, limits, selectedDate, selectedDateFormatted) {
    const oldSummary = document.getElementById('hourly-tension-summary');
    if (oldSummary) oldSummary.remove();
    
    if (hourlyData.length === 0) return;
    
    // Calculer les statistiques
    const validMoy = hourlyData.map(h => h.t_moy).filter(v => v > 0);
    const validMin = hourlyData.map(h => h.t_min).filter(v => v > 0);
    const validMax = hourlyData.map(h => h.t_max).filter(v => v > 0);
    
    const avgTension = validMoy.length > 0 ? 
        validMoy.reduce((a, b) => a + b, 0) / validMoy.length : 0;
    
    const minTension = validMin.length > 0 ? Math.min(...validMin) : 0;
    const minTensionHour = hourlyData.find(h => h.t_min === minTension);
    
    const maxTension = validMax.length > 0 ? Math.max(...validMax) : 0;
    const maxTensionHour = hourlyData.find(h => h.t_max === maxTension);
    
    // Compter les dépassements
    const exceedances = hourlyData.filter(h => 
        h.t_min < limits.min || h.t_max > limits.max || 
        h.t_moy < limits.min || h.t_moy > limits.max
    ).length;
    
    const exceedancePercent = hourlyData.length > 0 ? 
        Math.round((exceedances / hourlyData.length) * 100) : 0;
    
    // Déterminer la période
    let periodText = '';
    if (selectedDate && selectedDate !== 'all') {
        periodText = selectedDateFormatted;
    } else {
        const dates = hourlyData.map(h => h.fullDate);
        const uniqueDates = [...new Set(dates)];
        if (uniqueDates.length === 1) {
            periodText = uniqueDates[0];
        } else {
            periodText = `${uniqueDates.length} jours`;
        }
    }
    
    const summary = document.createElement('div');
    summary.id = 'hourly-tension-summary';
    summary.style.cssText = `
        padding: 16px 20px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
    `;
    
    summary.innerHTML = `
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📊 Tension moyenne</div>
            <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${avgTension.toFixed(2)} V</div>
            <div style="font-size: 10px; color: #475569;">Système ${systemType}</div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #10b981;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬇️ Minimum absolu</div>
            <div style="font-size: 18px; font-weight: 700; color: ${minTension < limits.min ? '#ef4444' : '#10b981'};">${minTension.toFixed(2)} V</div>
            <div style="font-size: 10px; color: #475569;">
                ${minTensionHour ? minTensionHour.label : '-'}
                ${minTension < limits.min ? ' ⚠️' : ''}
            </div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #ef4444;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬆️ Maximum absolu</div>
            <div style="font-size: 18px; font-weight: 700; color: ${maxTension > limits.max ? '#ef4444' : '#ef4444'};">${maxTension.toFixed(2)} V</div>
            <div style="font-size: 10px; color: #475569;">
                ${maxTensionHour ? maxTensionHour.label : '-'}
                ${maxTension > limits.max ? ' ⚠️' : ''}
            </div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⚠️ Dépassements</div>
            <div style="font-size: 18px; font-weight: 700; color: #8b5cf6;">${exceedances} heure${exceedances !== 1 ? 's' : ''}</div>
            <div style="font-size: 10px; color: #475569;">
                ${exceedancePercent}% du temps • ${periodText}
            </div>
        </div>
    `;
    
    container.appendChild(summary);
}

function addHourlyTensionSummary(container, hourlyData, systemType, limits, selectedDate, selectedDateFormatted) {
    const oldSummary = document.getElementById('hourly-tension-summary');
    if (oldSummary) oldSummary.remove();
    
    if (!hourlyData || hourlyData.length === 0) return;
    
    // Calculer les statistiques
    const validMoy = hourlyData.map(h => h.t_moy).filter(v => v && v > 0);
    const validMin = hourlyData.map(h => h.t_min).filter(v => v && v > 0);
    const validMax = hourlyData.map(h => h.t_max).filter(v => v && v > 0);
    
    const avgTension = validMoy.length > 0 ? 
        validMoy.reduce((a, b) => a + b, 0) / validMoy.length : 0;
    
    const minTension = validMin.length > 0 ? Math.min(...validMin) : 0;
    const minTensionHour = hourlyData.find(h => h.t_min === minTension);
    
    const maxTension = validMax.length > 0 ? Math.max(...validMax) : 0;
    const maxTensionHour = hourlyData.find(h => h.t_max === maxTension);
    
    // Compter les dépassements
    const exceedances = hourlyData.filter(h => 
        (h.t_min && h.t_min < limits.min) || 
        (h.t_max && h.t_max > limits.max) || 
        (h.t_moy && (h.t_moy < limits.min || h.t_moy > limits.max))
    ).length;
    
    const exceedancePercent = hourlyData.length > 0 ? 
        Math.round((exceedances / hourlyData.length) * 100) : 0;
    
    // Déterminer la période
    let periodText = '';
    if (selectedDate && selectedDate !== 'all') {
        periodText = selectedDateFormatted || selectedDate;
    } else {
        const dates = hourlyData.map(h => h.fullDate).filter(d => d);
        const uniqueDates = [...new Set(dates)];
        if (uniqueDates.length === 1) {
            periodText = uniqueDates[0];
        } else if (uniqueDates.length > 1) {
            periodText = `${uniqueDates.length} jours`;
        } else {
            periodText = 'Période analysée';
        }
    }
    
    // Formater l'affichage des heures avec vérification de sécurité
    const minHourText = minTensionHour && minTensionHour.label ? minTensionHour.label : '-';
    const maxHourText = maxTensionHour && maxTensionHour.label ? maxTensionHour.label : '-';
    
    const summary = document.createElement('div');
    summary.id = 'hourly-tension-summary';
    summary.style.cssText = `
        padding: 16px 20px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
    `;
    
    summary.innerHTML = `
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📊 Tension moyenne</div>
            <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${avgTension.toFixed(2)} V</div>
            <div style="font-size: 10px; color: #475569;">Système ${systemType}</div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #10b981;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬇️ Minimum absolu</div>
            <div style="font-size: 18px; font-weight: 700; color: ${minTension < limits.min ? '#ef4444' : '#10b981'};">${minTension.toFixed(2)} V</div>
            <div style="font-size: 10px; color: #475569;">
                ${minHourText}
                ${minTension < limits.min ? ' ⚠️' : ''}
            </div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #ef4444;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬆️ Maximum absolu</div>
            <div style="font-size: 18px; font-weight: 700; color: ${maxTension > limits.max ? '#ef4444' : '#ef4444'};">${maxTension.toFixed(2)} V</div>
            <div style="font-size: 10px; color: #475569;">
                ${maxHourText}
                ${maxTension > limits.max ? ' ⚠️' : ''}
            </div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⚠️ Dépassements</div>
            <div style="font-size: 18px; font-weight: 700; color: #8b5cf6;">${exceedances} heure${exceedances !== 1 ? 's' : ''}</div>
            <div style="font-size: 10px; color: #475569;">
                ${exceedancePercent}% du temps • ${periodText}
            </div>
        </div>
    `;
    
    container.appendChild(summary);
}

function createDateSelectorForHourlyTension() {
    const container = document.getElementById('hourly-tension-chart-placeholder');
    if (!container) return;
    
    // Récupérer les données filtrées (respecte les filtres globaux)
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    if (dataToUse.length === 0) return;
    
    // Extraire toutes les dates uniques des données filtrées
    const uniqueDates = new Set();
    dataToUse.forEach(row => {
        if (row['Date et Heure']) {
            const date = row['Date et Heure'].split(' ')[0];
            uniqueDates.add(date);
        }
    });
    
    // Trier les dates (de la plus récente à la plus ancienne)
    const sortedDates = Array.from(uniqueDates).sort((a, b) => new Date(b) - new Date(a));
    
    // Créer le conteneur du sélecteur
    const selectorContainer = document.createElement('div');
    selectorContainer.id = 'hourly-tension-date-selector';
    selectorContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 15px;
        padding: 12px 15px;
        background: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        flex-wrap: wrap;
    `;
    
    // Label avec indication du filtre global
    const label = document.createElement('span');
    label.style.cssText = `
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 6px;
    `;
    label.innerHTML = `<span style="font-size: 16px;">🔍</span> Filtrer par date :`;
    
    // Sélecteur déroulant
    const select = document.createElement('select');
    select.id = 'hourly-tension-date-filter';
    select.style.cssText = `
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 13px;
        color: #1e293b;
        background: white;
        cursor: pointer;
        min-width: 250px;
        outline: none;
        transition: border-color 0.2s;
    `;
    
    // Option par défaut
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    defaultOption.textContent = `Toutes les dates`;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
    
    // Ajouter chaque date
    sortedDates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        // Compter le nombre de relevés pour cette date
        const countForDate = dataToUse.filter(row => {
            return row['Date et Heure'] && row['Date et Heure'].split(' ')[0] === date;
        }).length;
        
        option.textContent = `${formattedDate} (${countForDate} relevés)`;
        select.appendChild(option);
    });
    
    // Bouton pour réinitialiser
    const resetBtn = document.createElement('button');
    resetBtn.id = 'reset-hourly-tension-date';
    resetBtn.style.cssText = `
        padding: 6px 12px;
        background: #e2e8f0;
        border: none;
        border-radius: 4px;
        color: #475569;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.2s;
    `;
    resetBtn.innerHTML = `<span>↺</span> Réinitialiser`;
    resetBtn.onmouseover = () => { resetBtn.style.background = '#cbd5e1'; };
    resetBtn.onmouseout = () => { resetBtn.style.background = '#e2e8f0'; };
    
    // Indicateur de filtre global
    let globalFilterText = '';
    if (filterPeriod && filterPeriod !== 'all') {
        const periodNames = {
            '5days': '5j', '7days': '7j', '15days': '15j',
            '30days': '30j', '2months': '2m', '3months': '3m',
            '6months': '6m', '1year': '1a'
        };
        globalFilterText = `Filtre global: ${periodNames[filterPeriod]}`;
    } else if (filterStartDate || filterEndDate) {
        globalFilterText = 'Filtre dates manuelles';
    } else if (filterMonth && filterYear) {
        globalFilterText = `Filtre: ${filterMonth}/${filterYear}`;
    }
    
    const globalFilterBadge = document.createElement('span');
    if (globalFilterText) {
        globalFilterBadge.style.cssText = `
            padding: 4px 10px;
            background: #3b82f6;
            color: white;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 500;
            margin-left: auto;
        `;
        globalFilterBadge.textContent = globalFilterText;
    } else {
        globalFilterBadge.style.cssText = `
            padding: 4px 10px;
            background: #e2e8f0;
            color: #475569;
            border-radius: 20px;
            font-size: 11px;
            margin-left: auto;
        `;
        globalFilterBadge.textContent = `${sortedDates.length} dates disponibles`;
    }
    
    // Assembler
    selectorContainer.appendChild(label);
    selectorContainer.appendChild(select);
    selectorContainer.appendChild(resetBtn);
    selectorContainer.appendChild(globalFilterBadge);
    
    // Supprimer l'ancien sélecteur et ajouter le nouveau
    const existingSelector = document.getElementById('hourly-tension-date-selector');
    if (existingSelector) existingSelector.remove();
    
    container.insertBefore(selectorContainer, container.firstChild);
    
    // Ajouter les événements
    select.addEventListener('change', function() {
        const selectedDate = this.value;
        updateHourlyTensionChartWithDateFilter(selectedDate);
    });
    
    resetBtn.addEventListener('click', function() {
        select.value = 'all';
        updateHourlyTensionChartWithDateFilter('all');
    });
}
function updateHourlyTensionChartWithDateFilter(selectedDate) {
    const container = document.getElementById('hourly-tension-chart-placeholder');
    if (!container) return;
    
    // Sauvegarder l'état du sélecteur
    const currentSelector = document.getElementById('hourly-tension-date-selector');
    
    // Recréer le graphique avec la date sélectionnée
    container.innerHTML = '';
    if (currentSelector) container.appendChild(currentSelector);
    
    // Recréer le graphique (il utilisera automatiquement filteredTensionData)
    createHourlyTensionChart(selectedDate);
    
    // Mettre à jour la valeur du sélecteur si nécessaire
    const selector = document.getElementById('hourly-tension-date-filter');
    if (selector) {
        selector.value = selectedDate;
    }
}

function updateHourlyTensionSummary(container, stats, systemType, limits, selectedDate) {
    const oldSummary = document.getElementById('hourly-tension-summary');
    if (oldSummary) oldSummary.remove();
    
    if (stats.totalHours === 0) return;
    
    const summary = document.createElement('div');
    summary.id = 'hourly-tension-summary';
    summary.style.cssText = `padding: 16px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;`;
    
    let dateInfo = '';
    if (selectedDate && selectedDate !== 'all') {
        const dateObj = new Date(selectedDate);
        dateInfo = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } else {
        dateInfo = 'Toutes les dates';
    }
    
    summary.innerHTML = `
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📊 Tension moyenne</div>
            <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${stats.avgTension.toFixed(2)} V</div>
            <div style="font-size: 10px; color: #475569;">Système ${systemType}</div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #10b981;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬇️ Minimum</div>
            <div style="font-size: 18px; font-weight: 700; color: ${stats.minTension < limits.min ? '#ef4444' : '#10b981'};">${stats.minTension.toFixed(2)} V</div>
            <div style="font-size: 10px; color: #475569;">${stats.minTension < limits.min ? '⚠️ Sous seuil' : 'Normal'}</div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #ef4444;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬆️ Maximum</div>
            <div style="font-size: 18px; font-weight: 700; color: ${stats.maxTension > limits.max ? '#ef4444' : '#ef4444'};">${stats.maxTension.toFixed(2)} V</div>
            <div style="font-size: 10px; color: #475569;">${stats.maxTension > limits.max ? '⚠️ Au-dessus seuil' : 'Normal'}</div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⚠️ Dépassements</div>
            <div style="font-size: 18px; font-weight: 700; color: #8b5cf6;">${stats.exceedances}</div>
            <div style="font-size: 10px; color: #475569;">${dateInfo}</div>
        </div>
    `;
    
    container.appendChild(summary);
}
// ==================== GRAPHIQUES ÉNERGIE ====================

function createTotalEnergyChart() {
    const dataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    if (dataToUse.length === 0) return;
    
    const container = document.getElementById('total-energy-chart-placeholder');
    if (!container) return;
    container.innerHTML = '';
    
    const dailyTotalEnergy = {};
    let maxEnergyDate = '', maxEnergyValue = 0;
    
    dataToUse.forEach(row => {
        if (!row['Date et Heure']) return;
        const date = row['Date et Heure'].split(' ')[0];
        if (!dailyTotalEnergy[date]) dailyTotalEnergy[date] = { energie1: 0, energie2: 0, energie3: 0, energie4: 0, energie5: 0, energie6: 0 };
        for (let i = 1; i <= 6; i++) {
            const energyKey = `Energie${i}`;
            const energyValue = parseFloat(row[energyKey]) || 0;
            if (energyValue > dailyTotalEnergy[date][`energie${i}`]) dailyTotalEnergy[date][`energie${i}`] = energyValue;
        }
    });
    
    const dates = Object.keys(dailyTotalEnergy).sort();
    const totalEnergyData = dates.map(date => {
        let total = 0;
        for (let i = 1; i <= 6; i++) total += dailyTotalEnergy[date][`energie${i}`] || 0;
        if (total > maxEnergyValue) { maxEnergyValue = total; maxEnergyDate = date; }
        return total;
    });
    
    const kitThresholds = [
        { label: 'Kit 0', value: 250, color: '#FF6B6B' },
        { label: 'Kit 1', value: 360, color: '#FFA726' },
        { label: 'Kit 2', value: 540, color: '#FFD93D' },
        { label: 'Kit 3', value: 720, color: '#4ECDC4' },
        { label: 'Kit 4', value: 1080, color: '#667eea' }
    ];
    
    const daysWithConsumption = totalEnergyData.filter(v => v && v > 0);
    const totalDays = daysWithConsumption.length;
    const distribution = { 'Kit 0': 0, 'Kit 1': 0, 'Kit 2': 0, 'Kit 3': 0, 'Kit 4': 0, 'Kit 4+': 0 };
    const percentages = {};
    let totalEnergySum = 0, maxEnergy = 0, maxKitReached = null;
    
    daysWithConsumption.forEach(energy => {
        totalEnergySum += energy;
        if (energy > maxEnergy) maxEnergy = energy;
        let kitForDay = null;
        for (let i = 0; i < kitThresholds.length; i++) {
            if (energy <= kitThresholds[i].value) { kitForDay = kitThresholds[i].label; break; }
        }
        if (!kitForDay) kitForDay = 'Kit 4+';
        distribution[kitForDay] = (distribution[kitForDay] || 0) + 1;
        if (energy === maxEnergy) maxKitReached = kitForDay;
    });
    
    Object.keys(distribution).forEach(kit => percentages[kit] = totalDays > 0 ? Math.round((distribution[kit] / totalDays) * 100) : 0);
    
    // ===== NOUVELLE LOGIQUE DE RECOMMANDATION =====
    let recommendedKit = null;
    let recommendedKitPercentage = 0;
    
    // Trier les kits par leur pourcentage (du plus élevé au plus bas)
    const sortedKits = Object.entries(distribution)
        .map(([kit, count]) => ({ 
            kit, 
            count, 
            percentage: totalDays > 0 ? (count / totalDays) * 100 : 0 
        }))
        .sort((a, b) => b.percentage - a.percentage);
    
    // Trouver le kit le plus gros (celui avec la plus haute valeur seuil) qui dépasse 20%
    // Trier les kits par valeur seuil (Kit 4+ > Kit 4 > Kit 3 > Kit 2 > Kit 1 > Kit 0)
    const kitValueOrder = {
        'Kit 4+': 9999, // Valeur très élevée pour Kit 4+
        'Kit 4': 1080,
        'Kit 3': 720,
        'Kit 2': 540,
        'Kit 1': 360,
        'Kit 0': 250
    };
    
    // Filtrer les kits qui ont un pourcentage >= 20%
    const kitsAbove20 = sortedKits.filter(k => k.percentage >= 20);
    
    if (kitsAbove20.length > 0) {
        // Prendre le plus gros kit (avec la plus haute valeur seuil) parmi ceux >= 20%
        recommendedKit = kitsAbove20.sort((a, b) => {
            const valueA = kitValueOrder[a.kit] || 0;
            const valueB = kitValueOrder[b.kit] || 0;
            return valueB - valueA; // Tri décroissant
        })[0].kit;
        recommendedKitPercentage = percentages[recommendedKit];
    } else {
        // Si aucun kit ne dépasse 20%, prendre celui avec le plus grand pourcentage
        recommendedKit = sortedKits[0].kit;
        recommendedKitPercentage = percentages[recommendedKit];
    }
    
    const averageEnergy = totalDays > 0 ? Math.round(totalEnergySum / totalDays) : 0;
    const nonZeroValues = totalEnergyData.filter(v => v && v > 0);
    const maxDataValue = nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 0;
    
    let visibleKitThresholds = [];
    if (maxDataValue === 0) visibleKitThresholds = [kitThresholds[0]];
    else {
        const relevantKits = kitThresholds.filter(kit => kit.value >= maxDataValue);
        if (relevantKits.length > 0) {
            const maxKitIndex = kitThresholds.findIndex(kit => kit.value === relevantKits[0].value);
            visibleKitThresholds = kitThresholds.slice(0, maxKitIndex + 1);
            if (maxKitIndex < kitThresholds.length - 1 && maxDataValue / relevantKits[0].value > 0.8) {
                visibleKitThresholds.push(kitThresholds[maxKitIndex + 1]);
            }
        } else {
            visibleKitThresholds = [...kitThresholds];
            visibleKitThresholds.push({ label: 'MAX', value: Math.ceil(maxDataValue / 100) * 100, color: '#1f2933', dashed: true });
        }
    }
    visibleKitThresholds.sort((a, b) => a.value - b.value);
    
    const pointBackgroundColors = totalEnergyData.map(value => {
        if (value === 0 || value == null) return '#CBD5E0';
        const matchingKit = visibleKitThresholds.find(kit => value <= kit.value);
        return matchingKit ? matchingKit.color : '#1f2933';
    });
    
    const recommendedKitInfo = recommendedKit ? kitThresholds.find(k => k.label === recommendedKit.replace('+', '')) : null;
    const dominantColor = recommendedKitInfo ? recommendedKitInfo.color : (recommendedKit === 'Kit 4+' ? '#dc2626' : '#667eea');
    
    // ... (le reste du code pour créer le graphique reste inchangé)
    
    const chartContainer = document.createElement('div');
    chartContainer.id = 'total-energy-chart-container';
    chartContainer.style.cssText = `background: white; border-radius: 16px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0;`;
    
    const chartHeader = document.createElement('div');
    chartHeader.style.cssText = `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 25px; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 12px;`;
    chartHeader.innerHTML = '📊 Total Énergie Max par Jour & Analyse Dimensionnement';
    
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = `padding: 24px;`;
    
    const graphContainer = document.createElement('div');
    graphContainer.style.cssText = `margin-bottom: 30px;`;
    const graphTitle = document.createElement('div');
    graphTitle.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;`;
    graphTitle.innerHTML = `<h4 style="margin: 0; font-size: 16px; color: #0f172a; display: flex; align-items: center; gap: 8px;"><span style="font-size: 20px;">📈</span><span style="font-weight: 700;">Évolution de l'énergie maximale par jour</span></h4><span style="font-size: 12px; color: #64748b; background: #f1f5f9; padding: 4px 12px; border-radius: 30px;">${dates.length} jours analysés</span>`;
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `height: 350px; position: relative; margin-bottom: 10px;`;
    
    graphContainer.appendChild(graphTitle);
    graphContainer.appendChild(canvasContainer);
    
    const dimensioningSection = document.createElement('div');
    dimensioningSection.style.cssText = `margin-top: 30px; background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);`;
    
    const dimHeader = document.createElement('div');
    dimHeader.style.cssText = `background: linear-gradient(135deg, ${dominantColor}10 0%, white 100%); padding: 20px 24px; border-bottom: 3px solid ${dominantColor}; display: flex; align-items: center; gap: 20px;`;
    
    // Calculer le nombre de jours pour le kit recommandé
    const recommendedKitCount = distribution[recommendedKit] || 0;
    
    dimHeader.innerHTML = `
        <div style="width: 56px; height: 56px; background: ${dominantColor}; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px ${dominantColor}60;"><span style="font-size: 28px; color: white;">🎯</span></div>
        <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 8px; flex-wrap: wrap;">
                <span style="font-size: 14px; color: #475569; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;">Dimensionnement recommandé</span>
                <span style="background: ${dominantColor}; color: white; padding: 5px 18px; border-radius: 40px; font-size: 13px; font-weight: 700; box-shadow: 0 4px 10px ${dominantColor}60;">🏆 ${recommendedKitPercentage}% DU TEMPS</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 20px; flex-wrap: wrap;">
                <span style="font-size: 32px; font-weight: 900; color: ${dominantColor}; line-height: 1;">${recommendedKit || 'Non déterminé'}</span>
                ${recommendedKitInfo ? `<span style="font-size: 16px; color: #475569; background: white; padding: 6px 20px; border-radius: 40px; border: 2px solid ${dominantColor}30; font-weight: 600;">⚡ ${recommendedKitInfo.value.toLocaleString('fr-FR')} Wh/jour</span>` : recommendedKit === 'Kit 4+' ? `<span style="font-size: 16px; color: #475569; background: white; padding: 6px 20px; border-radius: 40px; border: 2px solid #dc262630; font-weight: 600;">⚡ >1080 Wh/jour</span>` : ''}
            </div>
            <div style="margin-top: 12px; font-size: 14px; color: #475569; background: white; padding: 10px 16px; border-radius: 10px; border: 1px solid ${dominantColor}20;">
                <span style="font-weight: 600; color: ${dominantColor};">${recommendedKit}</span> est adapté pour <span style="font-weight: 800; color: ${dominantColor};">${recommendedKitPercentage}% du temps</span> (${recommendedKitCount} jours sur ${totalDays})
            </div>
        </div>
    `;
    
    const progressBarsContainer = document.createElement('div');
    progressBarsContainer.style.cssText = `padding: 24px;`;
    const repartitionTitle = document.createElement('div');
    repartitionTitle.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;`;
    repartitionTitle.innerHTML = `<h5 style="margin: 0; font-size: 16px; color: #0f172a; display: flex; align-items: center; gap: 8px;"><span style="font-size: 20px;">📊</span><span style="font-weight: 700;">Répartition détaillée par kit</span></h5><span style="font-size: 12px; color: #475569; background: #f8fafc; padding: 6px 16px; border-radius: 40px; border: 1px solid #e2e8f0;">📋 ${totalDays} jours de consommation</span>`;
    progressBarsContainer.appendChild(repartitionTitle);
    
    const kitOrder = ['Kit 0', 'Kit 1', 'Kit 2', 'Kit 3', 'Kit 4', 'Kit 4+'];
    kitOrder.forEach(kitLabel => {
        const percentage = percentages[kitLabel] || 0;
        const count = distribution[kitLabel] || 0;
        if (percentage === 0 && count === 0) return;
        const kitInfo = kitLabel === 'Kit 4+' ? { color: '#dc2626', label: 'Kit 4+' } : kitThresholds.find(k => k.label === kitLabel);
        const isRecommended = recommendedKit === kitLabel;
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `margin-bottom: 20px; ${isRecommended ? 'background: ' + dominantColor + '08; padding: 14px; border-radius: 12px; border-left: 5px solid ' + dominantColor + ';' : ''}`;
        progressBar.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 10px;"><span style="width: 16px; height: 16px; background: ${kitInfo.color}; border-radius: 4px; box-shadow: 0 2px 6px ${kitInfo.color}80;"></span><span style="font-weight: ${isRecommended ? '800' : '600'}; font-size: 15px; color: ${isRecommended ? dominantColor : '#1e293b'};">${kitLabel}</span></div>
                    <span style="font-size: 13px; color: #475569; background: #f1f5f9; padding: 4px 14px; border-radius: 30px;">📅 ${count} jour${count !== 1 ? 's' : ''}</span>
                    ${isRecommended ? `<span style="background: ${dominantColor}; color: white; padding: 4px 16px; border-radius: 30px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px ${dominantColor}60;">⭐ RECOMMANDÉ</span>` : ''}
                </div>
                <div style="display: flex; align-items: baseline; gap: 8px;"><span style="font-weight: 900; font-size: 22px; color: ${kitInfo.color};">${percentage}%</span><span style="font-size: 12px; color: #64748b;">du temps</span></div>
            </div>
            <div style="position: relative; width: 100%; height: 12px; background: #edf2f7; border-radius: 8px; overflow: hidden; margin-top: 6px; box-shadow: inset 0 1px 4px rgba(0,0,0,0.05);"><div style="width: ${percentage}%; height: 100%; background: ${kitInfo.color}; border-radius: 8px; transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 0 12px ${kitInfo.color}80;"></div></div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;"><span style="font-size: 12px; color: #475569;"><span style="font-weight: 600;">${kitLabel}</span> correspond à <span style="font-weight: 700; color: ${kitInfo.color};">${percentage}% du temps</span>${isRecommended ? ' ⭐ (recommandé)' : ''}</span><span style="font-size: 12px; color: #64748b;">${count}/${totalDays} jours</span></div>
        `;
        progressBarsContainer.appendChild(progressBar);
    });
    
    const summaryExplanation = document.createElement('div');
    summaryExplanation.style.cssText = `margin: 0 24px 24px 24px; padding: 16px 20px; background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); border-radius: 14px; border-left: 6px solid ${dominantColor}; border-right: 1px solid #e2e8f0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; font-size: 13.5px;`;
    
    // Message explicatif personnalisé
    let explicationMessage = '';
    if (kitsAbove20.length > 0) {
        const plusGrosKit = kitsAbove20.sort((a, b) => kitValueOrder[b.kit] - kitValueOrder[a.kit])[0].kit;
        explicationMessage = `Le <strong style="color: ${dominantColor};">${recommendedKit}</strong> est recommandé car il est le plus gros kit dépassant les 20% (${recommendedKitPercentage}% du temps).`;
    } else {
        explicationMessage = `Aucun kit ne dépasse 20% du temps. Le <strong style="color: ${dominantColor};">${recommendedKit}</strong> est recommandé car il a le pourcentage le plus élevé (${recommendedKitPercentage}% du temps).`;
    }
    
    summaryExplanation.innerHTML = `<div style="display: flex; align-items: flex-start; gap: 14px;"><span style="font-size: 20px; color: ${dominantColor};">📌</span><div style="flex: 1;"><span style="font-weight: 700; color: ${dominantColor};">En résumé :</span><span style="color: #334155;"> ${explicationMessage} Le pic à <strong>${Math.round(maxEnergy)} Wh</strong> (${maxKitReached}) n'est présent que <strong>${percentages[maxKitReached] || 0}% du temps</strong>.</span></div></div>`;
    
    dimensioningSection.appendChild(dimHeader);
    dimensioningSection.appendChild(progressBarsContainer);
    dimensioningSection.appendChild(summaryExplanation);
    
    chartWrapper.appendChild(graphContainer);
    chartWrapper.appendChild(dimensioningSection);
    chartContainer.appendChild(chartHeader);
    chartContainer.appendChild(chartWrapper);
    container.appendChild(chartContainer);
    
    const ctx = document.createElement('canvas');
    ctx.id = 'total-energy-chart-canvas';
    ctx.style.width = '100%';
    ctx.style.height = '100%';
    canvasContainer.appendChild(ctx);
    
    setTimeout(() => {
        if (typeof Chart === 'undefined') return;
        try {
            if (window.totalEnergyChartInstance) window.totalEnergyChartInstance.destroy();
            const maxVisibleKit = visibleKitThresholds[visibleKitThresholds.length - 1];
            const maxYValue = Math.max(maxDataValue * 1.2, maxVisibleKit.value * 1.1);
            
            window.totalEnergyChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [
                        { label: 'Énergie Maximale Totale par Jour (Wh)', data: totalEnergyData, backgroundColor: 'rgba(102, 126, 234, 0.1)', borderColor: '#667eea', borderWidth: 3, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: pointBackgroundColors, pointBorderColor: '#fff', pointBorderWidth: 2, pointHoverRadius: 7, pointHoverBackgroundColor: '#764ba2', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 3 },
                        ...visibleKitThresholds.map(kit => ({ label: kit.label, data: dates.map(() => kit.value), borderColor: kit.color, borderWidth: kit.dashed ? 3 : 2.5, borderDash: kit.dashed ? [10, 5] : [6, 4], fill: false, pointRadius: 0, tension: 0 }))
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 1000, easing: 'easeInOutQuart' },
                    scales: {
                        y: { beginAtZero: true, max: maxYValue, ticks: { font: { size: 12, weight: '500' }, color: '#718096', callback: value => value.toLocaleString('fr-FR'), padding: 10 }, grid: { color: 'rgba(102, 126, 234, 0.08)', lineWidth: 1.5, borderDash: [5, 5] }, border: { display: false }, title: { display: true, text: 'Énergie (Wh)', font: { size: 13, weight: 'bold' }, color: '#2c3e50', padding: 12 } },
                        x: { ticks: { font: { size: 12, weight: '500' }, color: '#718096', maxRotation: 45, minRotation: 0, padding: 8 }, grid: { display: false, drawBorder: false }, border: { display: true, color: 'rgba(113, 128, 150, 0.2)' }, title: { display: true, text: 'Dates', font: { size: 13, weight: 'bold' }, color: '#2c3e50', padding: 12 } }
                    },
                    plugins: {
                        legend: { display: true, position: 'top', labels: { font: { size: 13, weight: 'bold' }, color: '#2c3e50', padding: 15, usePointStyle: true }, onClick: function(e, legendItem, legend) { if (legendItem.datasetIndex === 0) { const meta = legend.chart.getDatasetMeta(legendItem.datasetIndex); meta.hidden = meta.hidden === null ? !legend.chart.data.datasets[legendItem.datasetIndex].hidden : null; legend.chart.update(); } } },
                        tooltip: {
                            backgroundColor: 'rgba(45, 55, 72, 0.95)', padding: 14, titleFont: { size: 15, weight: 'bold', color: '#fff' }, bodyFont: { size: 13, color: '#e2e8f0' }, cornerRadius: 8, displayColors: true, borderColor: 'rgba(102, 126, 234, 0.5)', borderWidth: 1, boxPadding: 8, caretSize: 8,
                            callbacks: {
                                title: function(context) { if (context[0].datasetIndex === 0) return '📊 ' + context[0].label; const kitIndex = context[0].datasetIndex - 1; if (kitIndex < visibleKitThresholds.length) { const kit = visibleKitThresholds[kitIndex]; return kit.dashed ? '🚨 ' + kit.label + ' - Consommation MAX' : '📏 ' + kit.label + ' - Seuil'; } return 'Seuil'; },
                                label: function(context) {
                                    const datasetIndex = context.datasetIndex;
                                    const value = context.parsed.y.toLocaleString('fr-FR');
                                    if (datasetIndex === 0) { const date = context.label === maxEnergyDate ? ' ⚡ MAXIMUM' : ''; return `${context.dataset.label}: ${value} Wh${date}`; } 
                                    else { const kitIndex = datasetIndex - 1; if (kitIndex < visibleKitThresholds.length) { const kit = visibleKitThresholds[kitIndex]; return kit.dashed ? `Seuil max recommandé: ${kit.value} Wh` : `Seuil ${kit.label}: ${kit.value} Wh`; } return `Seuil: ${value} Wh`; }
                                },
                                afterLabel: function(context) { if (context.datasetIndex === 0 && context.label === maxEnergyDate) return '🏆 Énergie maximale enregistrée'; return null; }
                            }
                        }
                    }
                }
            });
        } catch (error) { console.error('Erreur lors de la création du graphique total énergie:', error); }
    }, 50);
}

function createHourlyEnergyChart(selectedDate = 'all') {
    const container = document.getElementById('hourly-energy-chart-placeholder');
    if (!container) return;
    
    // Sauvegarder le sélecteur existant
    const existingSelector = document.getElementById('hourly-energy-date-selector');
    
    // Vider le conteneur mais garder le sélecteur
    container.innerHTML = '';
    if (existingSelector) container.appendChild(existingSelector);
    
    // Récupérer les données à utiliser (respecte les filtres globaux)
    const dataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    if (dataToUse.length === 0) {
        container.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">⚡ Aucune donnée d\'énergie disponible</div>';
        return;
    }
    
    // Variables pour les filtres
    let filteredData = dataToUse;
    let selectedDateFormatted = '';
    let activeFilters = [];
    
    // Ajouter le filtre global
    if (filterPeriod && filterPeriod !== 'all') {
        const periodNames = {
            '5days': '5 jours', '7days': '7 jours', '15days': '15 jours',
            '30days': '30 jours', '2months': '2 mois', '3months': '3 mois',
            '6months': '6 mois', '1year': '1 an'
        };
        activeFilters.push(`Filtre global: ${periodNames[filterPeriod]}`);
    } else if (filterStartDate || filterEndDate) {
        const start = filterStartDate ? filterStartDate.toLocaleDateString('fr-FR') : 'début';
        const end = filterEndDate ? filterEndDate.toLocaleDateString('fr-FR') : 'fin';
        activeFilters.push(`Filtre global: ${start} → ${end}`);
    } else if (filterMonth && filterYear) {
        activeFilters.push(`Filtre global: ${filterMonth}/${filterYear}`);
    }
    
    // Appliquer le filtre de date spécifique
    if (selectedDate && selectedDate !== 'all') {
        filteredData = dataToUse.filter(row => {
            if (!row['Date et Heure']) return false;
            const rowDate = row['Date et Heure'].split(' ')[0];
            return rowDate === selectedDate;
        });
        
        const dateObj = new Date(selectedDate);
        selectedDateFormatted = dateObj.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        if (filteredData.length === 0) {
            const noDataMsg = document.createElement('div');
            noDataMsg.style.cssText = `
                padding: 40px;
                text-align: center;
                background: #f8fafc;
                border-radius: 8px;
                color: #64748b;
                font-size: 14px;
                margin-top: 20px;
            `;
            noDataMsg.innerHTML = `📅 Aucune donnée horaire pour le ${selectedDateFormatted}<br><small>Veuillez choisir une autre date</small>`;
            container.appendChild(noDataMsg);
            return;
        }
    }
    
    // Grouper les données par heure
    const hourlyData = {};
    
    filteredData.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const dateTime = new Date(row['Date et Heure']);
        if (isNaN(dateTime.getTime())) return;
        
        const hourKey = dateTime.getHours().toString().padStart(2, '0') + ':00';
        const hourLabel = `${dateTime.getHours().toString().padStart(2, '0')}h00`;
        const fullDate = dateTime.toLocaleDateString('fr-FR');
        const fullDateTime = dateTime.toLocaleString('fr-FR');
        
        if (!hourlyData[hourKey]) {
            hourlyData[hourKey] = {
                label: hourLabel,
                fullDate: fullDate,
                fullDateTime: fullDateTime,
                total: 0,
                count: 0,
                dateTime: dateTime,
                values: []
            };
        }
        
        // Sommer l'énergie des 6 clients
        let hourTotal = 0;
        for (let i = 1; i <= 6; i++) {
            const energyKey = `Energie${i}`;
            const cellValue = row[energyKey];
            
            if (cellValue && cellValue.toString().trim() !== '' && cellValue.toString().trim() !== '-') {
                const energyValue = parseFloat(cellValue.toString().replace(',', '.'));
                if (!isNaN(energyValue)) {
                    hourTotal += energyValue;
                }
            }
        }
        
        if (hourTotal > 0) {
            hourlyData[hourKey].total += hourTotal;
            hourlyData[hourKey].count++;
            hourlyData[hourKey].values.push(hourTotal);
        }
    });
    
    // Trier par heure
    const sortedHours = Object.keys(hourlyData).sort((a, b) => {
        const hourA = parseInt(a.split(':')[0]);
        const hourB = parseInt(b.split(':')[0]);
        return hourA - hourB;
    }).map(key => ({
        ...hourlyData[key],
        key,
        value: hourlyData[key].count > 0 ? hourlyData[key].total / hourlyData[key].count : 0
    }));
    
    // Préparer les données pour le graphique
    const hourlyTotals = sortedHours.map(h => ({
        label: h.label,
        fullDate: h.fullDate,
        fullDateTime: h.fullDateTime,
        value: h.value,
        count: h.count,
        hour: parseInt(h.label),
        date: h.dateTime
    }));
    
    const maxValue = Math.max(...hourlyTotals.map(h => h.value), 0);
    const yMax = Math.ceil(maxValue * 1.15);
    
    // Créer le conteneur du graphique
    const chartContainer = document.createElement('div');
    chartContainer.id = 'hourly-energy-chart-container';
    chartContainer.style.cssText = `
        background: white;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        border: 1px solid #e2e8f0;
        margin-top: 15px;
    `;
    
    // ===== BADGE DE DATE =====
    const badgeContainer = document.createElement('div');
    badgeContainer.style.cssText = `
        background: #f8fafc;
        padding: 10px 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 15px;
        flex-wrap: wrap;
    `;
    
    // Badge pour la date sélectionnée
    const dateBadge = document.createElement('div');
    dateBadge.style.cssText = `
        background: ${selectedDate && selectedDate !== 'all' ? '#f59e0b' : '#94a3b8'};
        color: white;
        padding: 6px 15px;
        border-radius: 30px;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    `;
    
    if (selectedDate && selectedDate !== 'all') {
        dateBadge.innerHTML = `
            <span style="font-size: 16px;">📅</span>
            <span>${selectedDateFormatted}</span>
            <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px; margin-left: 5px;">
                ${hourlyTotals.length}h
            </span>
        `;
    } else {
        const uniqueDays = new Set(hourlyTotals.map(h => h.fullDate)).size;
        dateBadge.innerHTML = `
            <span style="font-size: 16px;">📊</span>
            <span>Premier jours du relève</span>
        `;
    }
    
    // Badges pour les filtres globaux
    const globalFiltersBadge = document.createElement('div');
    globalFiltersBadge.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-left: auto;
    `;
    
    if (activeFilters.length > 0) {
        activeFilters.forEach(filter => {
            const filterChip = document.createElement('span');
            filterChip.style.cssText = `
                background: #e2e8f0;
                color: #475569;
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 5px;
            `;
            filterChip.innerHTML = `<span style="font-size: 12px;">🔍</span> ${filter}`;
            globalFiltersBadge.appendChild(filterChip);
        });
    }
    
    // Bouton retour à toutes les dates
    if (selectedDate && selectedDate !== 'all') {
        const backToAllBtn = document.createElement('button');
        backToAllBtn.style.cssText = `
            background: white;
            border: 1px solid #cbd5e1;
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 11px;
            color: #475569;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: all 0.2s;
        `;
        backToAllBtn.innerHTML = `<span style="font-size: 14px;">↺</span> Toutes les dates`;
        backToAllBtn.onmouseover = () => { backToAllBtn.style.background = '#f1f5f9'; };
        backToAllBtn.onmouseout = () => { backToAllBtn.style.background = 'white'; };
        backToAllBtn.onclick = () => {
            const selector = document.getElementById('hourly-energy-date-filter');
            if (selector) {
                selector.value = 'all';
                updateHourlyEnergyChartWithDateFilter('all');
            }
        };
        globalFiltersBadge.appendChild(backToAllBtn);
    }
    
    badgeContainer.appendChild(dateBadge);
    if (globalFiltersBadge.children.length > 0) {
        badgeContainer.appendChild(globalFiltersBadge);
    }
    
    // En-tête principal
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        padding: 15px 25px;
        font-size: 16px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
    `;
    
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span style="font-size: 20px;">⏰</span>
            <span>ÉNERGIE TOTALE PAR HEURE (Somme des 6 clients)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
            <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">
                ${hourlyTotals.length} heures
            </span>
            <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">
                Max: ${maxValue.toFixed(2)} Wh
            </span>
        </div>
    `;
    
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = `padding: 20px; height: 350px; position: relative;`;
    
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        height: 280px;
        position: relative;
        margin-bottom: 10px;
    `;
    
    // Assemblage
    chartContainer.appendChild(badgeContainer);
    chartContainer.appendChild(header);
    chartWrapper.appendChild(canvasContainer);
    chartContainer.appendChild(chartWrapper);
    container.appendChild(chartContainer);
    
    // Créer le canvas
    const ctx = document.createElement('canvas');
    ctx.id = 'hourly-energy-chart-canvas';
    ctx.style.width = '100%';
    ctx.style.height = '100%';
    canvasContainer.appendChild(ctx);
    
    // Créer le graphique avec Chart.js
    setTimeout(() => {
        if (typeof Chart === 'undefined') {
            console.log('Chart.js non disponible');
            return;
        }
        
        try {
            const existingChart = Chart.getChart(ctx);
            if (existingChart) existingChart.destroy();
            
            // Limiter le nombre de points pour la lisibilité
            let displayData = hourlyTotals;
            if (hourlyTotals.length > 50) {
                displayData = hourlyTotals.filter((_, index) => index % 2 === 0);
            }
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: displayData.map(h => h.label),
                    datasets: [{
                        label: 'Énergie Totale (Wh)',
                        data: displayData.map(h => h.value),
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderColor: '#f59e0b',
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        pointHoverRadius: 7,
                        pointHoverBackgroundColor: '#d97706',
                        pointHoverBorderColor: 'white',
                        pointHoverBorderWidth: 3,
                        tension: 0.3,
                        fill: true,
                        spanGaps: false,
                        order: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 800,
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 12, weight: 'bold' },
                                color: '#1e293b',
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleFont: { size: 13, weight: 'bold' },
                            bodyFont: { size: 12 },
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                                title: function(context) {
                                    const hourData = displayData[context[0].dataIndex];
                                    if (selectedDate && selectedDate !== 'all') {
                                        return `${hourData.fullDate} • ${hourData.label}`;
                                    }
                                    return `${hourData.fullDateTime}`;
                                },
                                label: function(context) {
                                    const value = context.parsed.y;
                                    const hourData = displayData[context.dataIndex];
                                    return `⚡ Énergie totale: ${value.toFixed(2)} Wh${hourData.count > 1 ? ` (moyenne de ${hourData.count} relevés)` : ''}`;
                                },
                                afterLabel: function(context) {
                                    const hourData = displayData[context.dataIndex];
                                    if (hourData.count > 1) {
                                        return `📊 Basé sur ${hourData.count} mesures dans cette heure`;
                                    }
                                    return '';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: yMax,
                            grid: {
                                color: 'rgba(245, 158, 11, 0.1)',
                                lineWidth: 1,
                                drawBorder: true
                            },
                            title: {
                                display: true,
                                text: 'Énergie (Wh)',
                                font: { size: 12, weight: 'bold' },
                                color: '#475569'
                            },
                            ticks: {
                                font: { size: 11 },
                                color: '#64748b',
                                callback: value => value.toFixed(0) + ' Wh'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                font: { size: 10 },
                                color: '#64748b',
                                maxRotation: 45,
                                minRotation: 45,
                                maxTicksLimit: 15
                            },
                            title: {
                                display: true,
                                text: 'Heure',
                                font: { size: 12, weight: 'bold' },
                                color: '#475569',
                                padding: { top: 10 }
                            }
                        }
                    }
                }
            });

            // ✅ AJOUTER LE NOUVEAU GRAPHIQUE DES DIFFÉRENCES ICI
            // Créer le conteneur pour le graphique des différences
            const differenceChartContainer = document.createElement('div');
            differenceChartContainer.id = 'hourly-energy-difference-chart-placeholder';
            differenceChartContainer.style.cssText = `
                margin-top: 20px;
                width: 100%;
            `;
            container.appendChild(differenceChartContainer);
            
            // Créer le graphique des différences
            createHourlyEnergyDifferenceChart(hourlyTotals, selectedDate);
            
            console.log(`✅ Graphique énergie horaire créé avec ${hourlyTotals.length} heures`);
            
            // Ajouter le résumé statistique
            if (hourlyTotals && hourlyTotals.length > 0) {
                addHourlyEnergySummary(chartContainer, hourlyTotals, maxValue, selectedDate, selectedDateFormatted);
            }
            
        } catch (error) {
            console.error('❌ Erreur création graphique énergie horaire:', error);
        }
    }, 100);
}
// ==================== ANALYSE DES DIFFÉRENCES HORAIRES D'ÉNERGIE ====================

function analyzeHourlyEnergyDifferences(hourlyData) {
    if (!hourlyData || hourlyData.length < 2) {
        return { differences: [], maxDiff: 0, avgDiff: 0 };
    }
    
    const differences = [];
    let maxDiff = 0;
    let totalDiff = 0;
    
    for (let i = 1; i < hourlyData.length; i++) {
        const prev = hourlyData[i-1];
        const curr = hourlyData[i];
        const diff = Math.max(0, curr.value - prev.value); // Différence positive seulement
        
        differences.push({
            hour: curr.label,
            prevHour: prev.label,
            prevValue: prev.value,
            currValue: curr.value,
            difference: diff,
            startHour: prev.hour,
            endHour: curr.hour
        });
        
        if (diff > maxDiff) maxDiff = diff;
        totalDiff += diff;
    }
    
    return {
        differences: differences,
        maxDiff: maxDiff,
        avgDiff: differences.length > 0 ? totalDiff / differences.length : 0,
        totalDiff: totalDiff
    };
}
function createHourlyEnergyDifferenceChart(hourlyData, selectedDate = 'all') {
    const container = document.getElementById('hourly-energy-difference-chart-placeholder');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!hourlyData || hourlyData.length < 2) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px;">
                📊 Données insuffisantes pour calculer les différences horaires
            </div>
        `;
        return;
    }
    
    // Analyser les différences
    const diffAnalysis = analyzeHourlyEnergyDifferences(hourlyData);
    
    // Créer la carte
    const card = document.createElement('div');
    card.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
        overflow: hidden;
        border: 1px solid #e2e8f0;
        margin-top: 20px;
    `;
    
    // En-tête
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        color: white;
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
    `;
    
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">📊</span>
            <span>Consommation par tranche horaire (différence entre heures)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 20px; font-size: 11px;">
                📈 Max: ${diffAnalysis.maxDiff.toFixed(2)} Wh
            </span>
            <span style="background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 20px; font-size: 11px;">
                📊 Moy: ${diffAnalysis.avgDiff.toFixed(2)} Wh
            </span>
        </div>
    `;
    
    card.appendChild(header);
    
    // Conteneur du graphique
    const chartContainer = document.createElement('div');
    chartContainer.style.cssText = `
        padding: 15px 20px;
        height: 300px;
        position: relative;
    `;
    
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        height: 250px;
        position: relative;
    `;
    
    const canvas = document.createElement('canvas');
    canvas.id = 'hourly-energy-difference-chart-canvas';
    canvas.style.cssText = `
        width: 100%;
        height: 100%;
        display: block;
    `;
    
    canvasContainer.appendChild(canvas);
    chartContainer.appendChild(canvasContainer);
    card.appendChild(chartContainer);
    
    // Légende explicative
    const legend = document.createElement('div');
    legend.style.cssText = `
        padding: 10px 20px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
        font-size: 11px;
    `;
    
    legend.innerHTML = `
        <div style="display: flex; align-items: center; gap: 5px;">
            <div style="width: 16px; height: 16px; background: #f97316; border-radius: 4px;"></div>
            <span>Consommation sur la tranche horaire</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">Ex: 1h → 2h = 13Wh</span>
            <span>signifie consommation entre 1h et 2h</span>
        </div>
    `;
    
    card.appendChild(legend);
    
    // Tableau récapitulatif des différences (optionnel, en bas)
    if (diffAnalysis.differences.length > 0) {
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = `
            padding: 15px 20px;
            border-top: 1px solid #e2e8f0;
            max-height: 200px;
            overflow-y: auto;
        `;
        
        let tableHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead style="position: sticky; top: 0; background: #f1f5f9;">
                    <tr>
                        <th style="padding: 8px; text-align: left;">Tranche horaire</th>
                        <th style="padding: 8px; text-align: right;">Valeur début (Wh)</th>
                        <th style="padding: 8px; text-align: right;">Valeur fin (Wh)</th>
                        <th style="padding: 8px; text-align: right;">Consommation (Wh)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        diffAnalysis.differences.forEach((diff, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
            tableHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                    <td style="padding: 6px 8px;">${diff.prevHour} → ${diff.hour}</td>
                    <td style="padding: 6px 8px; text-align: right;">${diff.prevValue.toFixed(2)}</td>
                    <td style="padding: 6px 8px; text-align: right;">${diff.currValue.toFixed(2)}</td>
                    <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #f97316;">${diff.difference.toFixed(2)}</td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        tableContainer.innerHTML = tableHTML;
        card.appendChild(tableContainer);
    }
    
    container.appendChild(card);
    
    // Créer le graphique en barres
    setTimeout(() => {
        createHourlyEnergyDifferenceChartCanvas(diffAnalysis.differences, selectedDate);
    }, 100);
}
function createHourlyEnergyDifferenceChartCanvas(differences, selectedDate) {
    const canvas = document.getElementById('hourly-energy-difference-chart-canvas');
    if (!canvas) return;
    
    // Détruire l'ancien graphique
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    
    // Préparer les données
    const labels = differences.map(d => `${d.prevHour} → ${d.hour}`);
    const values = differences.map(d => d.difference);
    
    // Couleurs (dégradé du orange clair au orange foncé selon l'importance)
    const maxValue = Math.max(...values, 0.1);
    const colors = values.map(v => {
        const intensity = Math.min(0.9, 0.4 + (v / maxValue) * 0.5);
        return `rgba(249, 115, 22, ${intensity})`;
    });
    
    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Consommation sur la tranche (Wh)',
                data: values,
                backgroundColor: colors,
                borderColor: '#c2410c',
                borderWidth: 1,
                borderRadius: 6,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.98)',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            const index = context.dataIndex;
                            const diff = differences[index];
                            return [
                                `⚡ Consommation: ${value.toFixed(2)} Wh`,
                                `📊 ${diff.prevValue.toFixed(2)} Wh → ${diff.currValue.toFixed(2)} Wh`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: { size: 10 },
                        color: '#475569',
                        callback: value => value.toFixed(0) + ' Wh'
                    },
                    grid: {
                        color: 'rgba(249, 115, 22, 0.1)'
                    },
                    title: {
                        display: true,
                        text: 'Consommation (Wh)',
                        font: { size: 11, weight: '600' },
                        color: '#334155'
                    }
                },
                x: {
                    ticks: {
                        font: { size: 9 },
                        color: '#64748b',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Tranche horaire',
                        font: { size: 11, weight: '600' },
                        color: '#334155',
                        padding: { top: 10 }
                    }
                }
            }
        }
    });
}
function addHourlyEnergySummary(container, hourlyData, maxValue, selectedDate, selectedDateFormatted) {
    const oldSummary = document.getElementById('hourly-energy-summary');
    if (oldSummary) oldSummary.remove();
    
    if (!hourlyData || hourlyData.length === 0) return;
    
    // Calculer les statistiques
    const values = hourlyData.map(h => h.value).filter(v => v > 0);
    
    if (values.length === 0) return;
    
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    const maxHour = hourlyData.reduce((max, h) => h.value > max.value ? h : max, { value: 0 });
    const minValue = Math.min(...values);
    const minHour = hourlyData.find(h => h.value === minValue);
    
    // Calculer la distribution par tranches horaires
    const morningHours = hourlyData.filter(h => {
        const hour = h.hour;
        return hour >= 6 && hour < 12;
    });
    const afternoonHours = hourlyData.filter(h => {
        const hour = h.hour;
        return hour >= 12 && hour < 18;
    });
    const eveningHours = hourlyData.filter(h => {
        const hour = h.hour;
        return hour >= 18 && hour < 22;
    });
    const nightHours = hourlyData.filter(h => {
        const hour = h.hour;
        return hour >= 22 || hour < 6;
    });
    
    const avgMorning = morningHours.length > 0 ? 
        morningHours.reduce((sum, h) => sum + h.value, 0) / morningHours.length : 0;
    const avgAfternoon = afternoonHours.length > 0 ? 
        afternoonHours.reduce((sum, h) => sum + h.value, 0) / afternoonHours.length : 0;
    const avgEvening = eveningHours.length > 0 ? 
        eveningHours.reduce((sum, h) => sum + h.value, 0) / eveningHours.length : 0;
    const avgNight = nightHours.length > 0 ? 
        nightHours.reduce((sum, h) => sum + h.value, 0) / nightHours.length : 0;
    
    // Déterminer la période
    let periodText = '';
    if (selectedDate && selectedDate !== 'all') {
        periodText = selectedDateFormatted;
    } else {
        const dates = hourlyData.map(h => h.fullDate).filter(d => d);
        const uniqueDates = [...new Set(dates)];
        if (uniqueDates.length === 1) {
            periodText = uniqueDates[0];
        } else {
            periodText = `${uniqueDates.length} jours`;
        }
    }
    
    const summary = document.createElement('div');
    summary.id = 'hourly-energy-summary';
    summary.style.cssText = `
        padding: 16px 20px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
    `;
    
    summary.innerHTML = `
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📊 Moyenne horaire</div>
            <div style="font-size: 18px; font-weight: 700; color: #f59e0b;">${avgValue.toFixed(2)} Wh</div>
            <div style="font-size: 10px; color: #475569;">sur ${values.length} heures • ${periodText}</div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #ef4444;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬆️Max de consommation</div>
            <div style="font-size: 18px; font-weight: 700; color: #ef4444;">${maxHour.value.toFixed(2)} Wh</div>
            <div style="font-size: 10px; color: #475569;">${maxHour.hour ? `${maxHour.hour}h` : '-'}</div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬇️ Minimum horaire</div>
            <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${minValue.toFixed(2)} Wh</div>
            <div style="font-size: 10px; color: #475569;">${minHour?.hour ? `${minHour.hour}h` : '-'}</div>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⏰ Répartition</div>
            <div style="font-size: 13px; font-weight: 600; color: #8b5cf6;">
                ${avgMorning > 0 ? `Matin: ${avgMorning.toFixed(1)}` : ''} Wh
            </div>
            <div style="font-size: 10px; color: #475569;">
                ${avgAfternoon > 0 ? `Après-midi: ${avgAfternoon.toFixed(1)} Wh • ` : ''}
                Soir: ${avgEvening.toFixed(1)} Wh • Nuit: ${avgNight.toFixed(1)} Wh
            </div>
        </div>
    `;
    
    container.appendChild(summary);
}
function createDateSelectorForHourlyEnergy() {
    const container = document.getElementById('hourly-energy-chart-placeholder');
    if (!container) return;
    
    // Récupérer les données filtrées (respecte les filtres globaux)
    const dataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    if (dataToUse.length === 0) return;
    
    // Extraire toutes les dates uniques des données filtrées
    const uniqueDates = new Set();
    dataToUse.forEach(row => {
        if (row['Date et Heure']) {
            const date = row['Date et Heure'].split(' ')[0];
            uniqueDates.add(date);
        }
    });
    
    // Trier les dates (de la plus récente à la plus ancienne)
    const sortedDates = Array.from(uniqueDates).sort((a, b) => new Date(b) - new Date(a));
    
    // Créer le conteneur du sélecteur
    const selectorContainer = document.createElement('div');
    selectorContainer.id = 'hourly-energy-date-selector';
    selectorContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 15px;
        padding: 12px 15px;
        background: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        flex-wrap: wrap;
    `;
    
    // Label
    const label = document.createElement('span');
    label.style.cssText = `
        font-size: 13px;
        font-weight: 600;
        color: #475569;
        display: flex;
        align-items: center;
        gap: 6px;
    `;
    label.innerHTML = `<span style="font-size: 16px;">🔍</span> Filtrer par date :`;
    
    // Sélecteur déroulant
    const select = document.createElement('select');
    select.id = 'hourly-energy-date-filter';
    select.style.cssText = `
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 13px;
        color: #1e293b;
        background: white;
        cursor: pointer;
        min-width: 250px;
        outline: none;
        transition: border-color 0.2s;
    `;
    
    // Option par défaut
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    defaultOption.textContent = `Toutes les dates`;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
    
    // Ajouter chaque date
    sortedDates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        
        const dateObj = new Date(date);
        const formattedDate = dateObj.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        
        // Compter le nombre de relevés pour cette date
        const countForDate = dataToUse.filter(row => {
            return row['Date et Heure'] && row['Date et Heure'].split(' ')[0] === date;
        }).length;
        
        option.textContent = `${formattedDate} (${countForDate} relevés)`;
        select.appendChild(option);
    });
    
    // Bouton pour réinitialiser
    const resetBtn = document.createElement('button');
    resetBtn.id = 'reset-hourly-energy-date';
    resetBtn.style.cssText = `
        padding: 6px 12px;
        background: #e2e8f0;
        border: none;
        border-radius: 4px;
        color: #475569;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.2s;
    `;
    resetBtn.innerHTML = `<span>↺</span> Réinitialiser`;
    resetBtn.onmouseover = () => { resetBtn.style.background = '#cbd5e1'; };
    resetBtn.onmouseout = () => { resetBtn.style.background = '#e2e8f0'; };
    
    // Indicateur de filtre global
    let globalFilterText = '';
    if (filterPeriod && filterPeriod !== 'all') {
        const periodNames = {
            '5days': '5j', '7days': '7j', '15days': '15j',
            '30days': '30j', '2months': '2m', '3months': '3m',
            '6months': '6m', '1year': '1a'
        };
        globalFilterText = `Filtre global: ${periodNames[filterPeriod]}`;
    } else if (filterStartDate || filterEndDate) {
        globalFilterText = 'Filtre dates manuelles';
    } else if (filterMonth && filterYear) {
        globalFilterText = `Filtre: ${filterMonth}/${filterYear}`;
    }
    
    const globalFilterBadge = document.createElement('span');
    if (globalFilterText) {
        globalFilterBadge.style.cssText = `
            padding: 4px 10px;
            background: #f59e0b;
            color: white;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 500;
            margin-left: auto;
        `;
        globalFilterBadge.textContent = globalFilterText;
    } else {
        globalFilterBadge.style.cssText = `
            padding: 4px 10px;
            background: #e2e8f0;
            color: #475569;
            border-radius: 20px;
            font-size: 11px;
            margin-left: auto;
        `;
        globalFilterBadge.textContent = `${sortedDates.length} dates disponibles`;
    }
    
    // Assembler
    selectorContainer.appendChild(label);
    selectorContainer.appendChild(select);
    selectorContainer.appendChild(resetBtn);
    selectorContainer.appendChild(globalFilterBadge);
    
    // Supprimer l'ancien sélecteur et ajouter le nouveau
    const existingSelector = document.getElementById('hourly-energy-date-selector');
    if (existingSelector) existingSelector.remove();
    
    container.insertBefore(selectorContainer, container.firstChild);
    
    // Ajouter les événements
    select.addEventListener('change', function() {
        const selectedDate = this.value;
        updateHourlyEnergyChartWithDateFilter(selectedDate);
    });
    
    resetBtn.addEventListener('click', function() {
        select.value = 'all';
        updateHourlyEnergyChartWithDateFilter('all');
    });
}
function updateHourlyEnergyChartWithDateFilter(selectedDate) {
    const container = document.getElementById('hourly-energy-chart-placeholder');
    if (!container) return;
    
    // Sauvegarder l'état du sélecteur
    const currentSelector = document.getElementById('hourly-energy-date-selector');
    
    // Recréer le graphique avec la date sélectionnée
    container.innerHTML = '';
    if (currentSelector) container.appendChild(currentSelector);
    
    // Recréer le graphique principal
    createHourlyEnergyChart(selectedDate);
    
    // Le graphique des différences sera automatiquement recréé
    // car il est appelé à la fin de createHourlyEnergyChart()
    
    // Mettre à jour la valeur du sélecteur
    const selector = document.getElementById('hourly-energy-date-filter');
    if (selector) {
        selector.value = selectedDate;
    }
}

// ==================== MISE À JOUR DES TABLEAUX ====================
function updateETCharts() {
    // Détruire les instances existantes des graphiques
    if (typeof Chart !== 'undefined') {
        // Graphique énergie des kits
        const energyCanvas = document.getElementById('total-energy-chart-canvas');
        if (energyCanvas) {
            const energyChart = Chart.getChart(energyCanvas);
            if (energyChart) energyChart.destroy();
        }
        
        // Graphique tension
        const tensionCanvas = document.getElementById('tension-chart-canvas');
        if (tensionCanvas) {
            const tensionChart = Chart.getChart(tensionCanvas);
            if (tensionChart) tensionChart.destroy();
        }
        
        // Graphique énergie horaire
        const hourlyEnergyCanvas = document.getElementById('hourly-energy-chart-canvas');
        if (hourlyEnergyCanvas) {
            const hourlyEnergyChart = Chart.getChart(hourlyEnergyCanvas);
            if (hourlyEnergyChart) hourlyEnergyChart.destroy();
        }
        
        // Graphique tension horaire
        const hourlyTensionCanvas = document.getElementById('hourly-tension-chart-canvas');
        if (hourlyTensionCanvas) {
            const hourlyTensionChart = Chart.getChart(hourlyTensionCanvas);
            if (hourlyTensionChart) hourlyTensionChart.destroy();
        }
    }
    
    // Recréer tous les graphiques avec les données filtrées
    setTimeout(() => {
        createTotalEnergyChart();
        createHourlyEnergyChart();
        createTensionChart();
        createHourlyTensionChart();
    }, 50);
    
    // Mettre à jour la carte technique
    createTechnicalDataCard();
}

// ==================== TABLEAU ENERGIE (CARD 5) ====================

function updateEnergyTable() {
    const tableContent = document.getElementById('combined-energy-table-content');
    if (!tableContent) return;
    
    if (combinedEnergyData.length === 0) {
        tableContent.innerHTML = `<div class="empty-message"><div class="empty-icon">🔍</div><p>Aucune donnée ENERGIE valide trouvée</p></div>`;
        return;
    }
    
    const dataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    totalRowsEnergy = dataToUse.length;
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls-div';
    controlsDiv.id = 'energy-controls-div';
    controlsDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px; flex-wrap: wrap; gap: 10px;`;
    
    const totalPages = Math.ceil(totalRowsEnergy / rowsPerPage);
    controlsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 14px; color: #2c3e50;">Affichage: <strong>${((currentPageEnergy - 1) * rowsPerPage + 1).toLocaleString()}</strong> à <strong>${Math.min(currentPageEnergy * rowsPerPage, totalRowsEnergy).toLocaleString()}</strong> sur <strong>${totalRowsEnergy.toLocaleString()}</strong> lignes</span>
            <span style="font-size: 12px; color: #27ae60; background: #e8f6ef; padding: 4px 8px; border-radius: 4px;">${filteredEnergyData.length !== combinedEnergyData.length ? '🔍 FILTRÉ' : '📊 COMPLET'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <button id="energy-first-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEnergy === 1 ? 'disabled' : ''}>««</button>
            <button id="energy-prev-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEnergy === 1 ? 'disabled' : ''}>«</button>
            <span style="padding: 5px 15px; font-size: 13px; color: #2c3e50;">Page <strong>${currentPageEnergy}</strong> sur <strong>${totalPages}</strong></span>
            <button id="energy-next-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEnergy === totalPages ? 'disabled' : ''}>»</button>
            <button id="energy-last-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEnergy === totalPages ? 'disabled' : ''}>»»</button>
        </div>
    `;
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'energy-table-wrapper';
    tableWrapper.style.cssText = `width: 100%; max-height: 600px; overflow: auto; border: 1px solid #dee2e6; border-radius: 8px; position: relative;`;
    
    const table = document.createElement('table');
    table.id = 'combined-energy-data-table';
    table.className = 'combined-data-table';
    table.style.cssText = `width: 100%; border-collapse: collapse; font-size: 11px;`;
    
    const thead = document.createElement('thead');
    thead.style.cssText = `position: sticky; top: 0; z-index: 10; background: white;`;
    const headerRow = document.createElement('tr');
    const headers = [
        { name: 'Date et Heure', width: '160px', sticky: true },
        { name: 'Energie1', width: '75px' }, { name: 'Energie2', width: '75px' },
        { name: 'Energie3', width: '75px' }, { name: 'Energie4', width: '75px' },
        { name: 'Energie5', width: '75px' }, { name: 'Energie6', width: '75px' }
    ];
    
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header.name;
        th.style.cssText = `padding: 10px 4px; text-align: ${index === 0 ? 'left' : 'center'}; background: ${index === 0 ? '#2c3e50' : '#3498db'}; color: white; border: 1px solid #dee2e6; font-weight: 600; white-space: nowrap; ${header.sticky ? 'position: sticky; left: 0; z-index: 11;' : ''} min-width: ${header.width}; font-size: 10.5px;`;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    tableContent.innerHTML = '';
    tableContent.appendChild(controlsDiv);
    tableContent.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    
    renderEnergyCurrentPage(dataToUse);
    setupEnergyTableControls(dataToUse);
    
    const footer = document.createElement('div');
    footer.style.cssText = `margin-top: 15px; font-size: 11px; color: #7f8c8d; text-align: center; padding: 10px; border-top: 1px solid #ecf0f1;`;
    footer.innerHTML = `<div>Tableau ENERGIE généré le ${new Date().toLocaleString()}</div><div style="margin-top: 5px; font-size: 10px;">${filteredEnergyData.length !== combinedEnergyData.length ? `🔍 Filtre actif: ${filteredEnergyData.length} lignes sur ${combinedEnergyData.length} totales` : '📊 Données complètes'}</div>`;
    tableContent.appendChild(footer);
}

function renderEnergyCurrentPage(dataToUse) {
    const table = document.getElementById('combined-energy-data-table');
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) oldTbody.remove();
    
    const tbody = document.createElement('tbody');
    const startIndex = (currentPageEnergy - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRowsEnergy);
    
    for (let i = 0; i < (endIndex - startIndex); i++) {
        const rowIndex = startIndex + i;
        const row = dataToUse[rowIndex];
        if (!row) continue;
        
        const tr = document.createElement('tr');
        tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
        
        const tdDate = document.createElement('td');
        tdDate.textContent = row['Date et Heure'] || '-';
        tdDate.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: left; vertical-align: middle; white-space: nowrap; background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'}; position: sticky; left: 0; z-index: 1; font-family: 'Courier New', monospace; font-size: 10px;`;
        tr.appendChild(tdDate);
        
        for (let j = 1; j <= 6; j++) {
            const energyKey = `Energie${j}`;
            const td = document.createElement('td');
            const value = row[energyKey] || '';
            if (value && value !== '') {
                const numValue = parseFloat(value.replace(',', '.'));
                td.textContent = isNaN(numValue) ? value : numValue.toFixed(2);
                td.style.color = '#2980b9';
            } else { td.textContent = '-'; td.style.color = '#95a5a6'; td.style.fontStyle = 'italic'; }
            td.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: center; vertical-align: middle; white-space: nowrap; font-size: 10px;`;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    updateEnergyPaginationControls();
}

function setupEnergyTableControls(dataToUse) {
    const firstPageBtn = document.getElementById('energy-first-page-btn');
    const prevPageBtn = document.getElementById('energy-prev-page-btn');
    const nextPageBtn = document.getElementById('energy-next-page-btn');
    const lastPageBtn = document.getElementById('energy-last-page-btn');
    
    if (firstPageBtn) firstPageBtn.addEventListener('click', () => { currentPageEnergy = 1; renderEnergyCurrentPage(dataToUse); });
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPageEnergy > 1) { currentPageEnergy--; renderEnergyCurrentPage(dataToUse); } });
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => { const totalPages = Math.ceil(totalRowsEnergy / rowsPerPage); if (currentPageEnergy < totalPages) { currentPageEnergy++; renderEnergyCurrentPage(dataToUse); } });
    if (lastPageBtn) lastPageBtn.addEventListener('click', () => { currentPageEnergy = Math.ceil(totalRowsEnergy / rowsPerPage); renderEnergyCurrentPage(dataToUse); });
}

function updateEnergyPaginationControls() {
    const totalPages = Math.ceil(totalRowsEnergy / rowsPerPage);
    const pageInfo = document.querySelector('#energy-controls-div span:nth-child(2)');
    if (pageInfo) pageInfo.innerHTML = `Page <strong>${currentPageEnergy}</strong> sur <strong>${totalPages}</strong>`;
    const linesInfo = document.querySelector('#energy-controls-div > div:first-child span');
    if (linesInfo) linesInfo.innerHTML = `Affichage: <strong>${((currentPageEnergy - 1) * rowsPerPage + 1).toLocaleString()}</strong> à <strong>${Math.min(currentPageEnergy * rowsPerPage, totalRowsEnergy).toLocaleString()}</strong> sur <strong>${totalRowsEnergy.toLocaleString()}</strong> lignes`;
    const firstPageBtn = document.getElementById('energy-first-page-btn');
    const prevPageBtn = document.getElementById('energy-prev-page-btn');
    const nextPageBtn = document.getElementById('energy-next-page-btn');
    const lastPageBtn = document.getElementById('energy-last-page-btn');
    if (firstPageBtn) firstPageBtn.disabled = currentPageEnergy === 1;
    if (prevPageBtn) prevPageBtn.disabled = currentPageEnergy === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPageEnergy === totalPages;
    if (lastPageBtn) lastPageBtn.disabled = currentPageEnergy === totalPages;
}

// ==================== TABLEAU TENSION (CARD 6) ====================

function updateTensionTable() {
    const tableContent = document.getElementById('combined-tension-table-content');
    if (!tableContent) return;
    
    if (combinedTensionData.length === 0) {
        tableContent.innerHTML = `<div class="empty-message"><div class="empty-icon">🔍</div><p>Aucune donnée TENSION valide trouvée</p></div>`;
        return;
    }
    
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    totalRowsTension = dataToUse.length;
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls-div';
    controlsDiv.id = 'tension-controls-div';
    controlsDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px; flex-wrap: wrap; gap: 10px;`;
    
    const totalPages = Math.ceil(totalRowsTension / rowsPerPage);
    controlsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 14px; color: #2c3e50;">Affichage: <strong>${((currentPageTension - 1) * rowsPerPage + 1).toLocaleString()}</strong> à <strong>${Math.min(currentPageTension * rowsPerPage, totalRowsTension).toLocaleString()}</strong> sur <strong>${totalRowsTension.toLocaleString()}</strong> lignes</span>
            <span style="font-size: 12px; color: #27ae60; background: #e8f6ef; padding: 4px 8px; border-radius: 4px;">${filteredTensionData.length !== combinedTensionData.length ? '🔍 FILTRÉ' : '📊 COMPLET'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <button id="tension-first-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageTension === 1 ? 'disabled' : ''}>««</button>
            <button id="tension-prev-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageTension === 1 ? 'disabled' : ''}>«</button>
            <span style="padding: 5px 15px; font-size: 13px; color: #2c3e50;">Page <strong>${currentPageTension}</strong> sur <strong>${totalPages}</strong></span>
            <button id="tension-next-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageTension === totalPages ? 'disabled' : ''}>»</button>
            <button id="tension-last-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageTension === totalPages ? 'disabled' : ''}>»»</button>
        </div>
    `;
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'tension-table-wrapper';
    tableWrapper.style.cssText = `width: 100%; max-height: 600px; overflow: auto; border: 1px solid #dee2e6; border-radius: 8px; position: relative;`;
    
    const table = document.createElement('table');
    table.id = 'combined-tension-data-table';
    table.className = 'combined-data-table';
    table.style.cssText = `width: 100%; border-collapse: collapse; font-size: 11px;`;
    
    const thead = document.createElement('thead');
    thead.style.cssText = `position: sticky; top: 0; z-index: 10; background: white;`;
    const headerRow = document.createElement('tr');
    const headers = [
        { name: 'Date et Heure', width: '160px', sticky: true },
        { name: 'T_min', width: '75px' }, { name: 'T_moy', width: '75px' }, { name: 'T_max', width: '75px' }
    ];
    
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header.name;
        th.style.cssText = `padding: 10px 4px; text-align: ${index === 0 ? 'left' : 'center'}; background: ${index === 0 ? '#2c3e50' : '#e74c3c'}; color: white; border: 1px solid #dee2e6; font-weight: 600; white-space: nowrap; ${header.sticky ? 'position: sticky; left: 0; z-index: 11;' : ''} min-width: ${header.width}; font-size: 10.5px;`;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    tableContent.innerHTML = '';
    tableContent.appendChild(controlsDiv);
    tableContent.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    
    renderTensionCurrentPage(dataToUse);
    setupTensionTableControls(dataToUse);
    
    const footer = document.createElement('div');
    footer.style.cssText = `margin-top: 15px; font-size: 11px; color: #7f8c8d; text-align: center; padding: 10px; border-top: 1px solid #ecf0f1;`;
    footer.innerHTML = `<div>Tableau TENSION généré le ${new Date().toLocaleString()}</div><div style="margin-top: 5px; font-size: 10px;">${filteredTensionData.length !== combinedTensionData.length ? `🔍 Filtre actif: ${filteredTensionData.length} lignes sur ${combinedTensionData.length} totales` : '📊 Données complètes'}</div>`;
    tableContent.appendChild(footer);
}

function renderTensionCurrentPage(dataToUse) {
    const table = document.getElementById('combined-tension-data-table');
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) oldTbody.remove();
    
    const tbody = document.createElement('tbody');
    const startIndex = (currentPageTension - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRowsTension);
    
    for (let i = 0; i < (endIndex - startIndex); i++) {
        const rowIndex = startIndex + i;
        const row = dataToUse[rowIndex];
        if (!row) continue;
        
        const tr = document.createElement('tr');
        tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
        
        const tdDate = document.createElement('td');
        tdDate.textContent = row['Date et Heure'] || '-';
        tdDate.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: left; vertical-align: middle; white-space: nowrap; background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'}; position: sticky; left: 0; z-index: 1; font-family: 'Courier New', monospace; font-size: 10px;`;
        tr.appendChild(tdDate);
        
        ['T_min', 'T_moy', 'T_max'].forEach((key) => {
            const td = document.createElement('td');
            const value = row[key] || '';
            if (value && value !== '') {
                const numValue = parseFloat(value.replace(',', '.'));
                td.textContent = isNaN(numValue) ? value : numValue.toFixed(2);
                td.style.color = '#c0392b';
            } else { td.textContent = '-'; td.style.color = '#95a5a6'; td.style.fontStyle = 'italic'; }
            td.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: center; vertical-align: middle; white-space: nowrap; font-size: 10px;`;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    updateTensionPaginationControls();
}

function setupTensionTableControls(dataToUse) {
    const firstPageBtn = document.getElementById('tension-first-page-btn');
    const prevPageBtn = document.getElementById('tension-prev-page-btn');
    const nextPageBtn = document.getElementById('tension-next-page-btn');
    const lastPageBtn = document.getElementById('tension-last-page-btn');
    
    if (firstPageBtn) firstPageBtn.addEventListener('click', () => { currentPageTension = 1; renderTensionCurrentPage(dataToUse); });
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPageTension > 1) { currentPageTension--; renderTensionCurrentPage(dataToUse); } });
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => { const totalPages = Math.ceil(totalRowsTension / rowsPerPage); if (currentPageTension < totalPages) { currentPageTension++; renderTensionCurrentPage(dataToUse); } });
    if (lastPageBtn) lastPageBtn.addEventListener('click', () => { currentPageTension = Math.ceil(totalRowsTension / rowsPerPage); renderTensionCurrentPage(dataToUse); });
}

function updateTensionPaginationControls() {
    const totalPages = Math.ceil(totalRowsTension / rowsPerPage);
    const pageInfo = document.querySelector('#tension-controls-div span:nth-child(2)');
    if (pageInfo) pageInfo.innerHTML = `Page <strong>${currentPageTension}</strong> sur <strong>${totalPages}</strong>`;
    const linesInfo = document.querySelector('#tension-controls-div > div:first-child span');
    if (linesInfo) linesInfo.innerHTML = `Affichage: <strong>${((currentPageTension - 1) * rowsPerPage + 1).toLocaleString()}</strong> à <strong>${Math.min(currentPageTension * rowsPerPage, totalRowsTension).toLocaleString()}</strong> sur <strong>${totalRowsTension.toLocaleString()}</strong> lignes`;
    const firstPageBtn = document.getElementById('tension-first-page-btn');
    const prevPageBtn = document.getElementById('tension-prev-page-btn');
    const nextPageBtn = document.getElementById('tension-next-page-btn');
    const lastPageBtn = document.getElementById('tension-last-page-btn');
    if (firstPageBtn) firstPageBtn.disabled = currentPageTension === 1;
    if (prevPageBtn) prevPageBtn.disabled = currentPageTension === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPageTension === totalPages;
    if (lastPageBtn) lastPageBtn.disabled = currentPageTension === totalPages;
}

// ==================== AUTRES ONGLETS (COMMERCIALE, ÉVÉNEMENTS) ====================
// Ces fonctions sont conservées mais non modifiées dans cette version
// Elles sont appelées par les onglets correspondants

function displayCommercialAnalysis() {
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    if (!commercialeContent) return;
    
    const existingEnergyAnalysis = document.getElementById('energy-consumption-analysis');
    const existingCreditAnalysis = document.getElementById('credit-behavior-analysis');
    if (existingEnergyAnalysis) existingEnergyAnalysis.remove();
    if (existingCreditAnalysis) existingCreditAnalysis.remove();
    
    if (combinedEnergyData.length > 0) displayEnergyConsumptionAnalysis();
    if (combinedSoldeData.length > 0) displayCreditBehaviorAnalysis();
}

function displayEnergyConsumptionAnalysis() {
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    if (!commercialeContent) return;
    
    const energyDataToUse = combinedEnergyData;
    const consumptionData = analyzeEnergyConsumption(energyDataToUse);
    
    const analysisDiv = document.createElement('div');
    analysisDiv.id = 'energy-consumption-analysis';
    analysisDiv.style.cssText = `background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); margin-bottom: 20px; overflow: hidden;`;
    const header = document.createElement('div');
    header.style.cssText = `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 25px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 10px;`;
    header.innerHTML = `💼 Analyse de Consommation d'Énergie`;
    analysisDiv.appendChild(header);
    
    const content = document.createElement('div');
    content.style.cssText = `padding: 20px;`;
    
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = `display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;`;
    summaryDiv.innerHTML = `
        <div style="background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #22c55e; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Clients Actifs</div>
            <div style="font-size: 32px; font-weight: 800; color: #22c55e; margin-bottom: 8px;">${consumptionData.clientCount}</div>
            <div style="font-size: 12px; color: #64748b;">avec données d'énergie</div>
        </div>
        <div style="background: linear-gradient(135deg, #dbeafe 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Jours Analysés</div>
            <div style="font-size: 32px; font-weight: 800; color: #3b82f6; margin-bottom: 8px;">${consumptionData.daysTotal}</div>
            <div style="font-size: 12px; color: #64748b;">période complète</div>
        </div>
    `;
    content.appendChild(summaryDiv);
    
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;`;
    let tableHTML = `<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><thead style="background: #f1f5f9;"><tr><th style="padding: 12px 8px; text-align: left; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Client</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Énergie Max (Wh)</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Moyenne (Wh)</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Jours >70%</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Statut</th></tr></thead><tbody>`;
    
    for (let i = 1; i <= 6; i++) {
        const energyKey = `Energie${i}`;
        const maxEnergy = consumptionData.maxEnergyPerClient[energyKey];
        const avgEnergy = consumptionData.averageConsumption[energyKey];
        const daysAbove = consumptionData.daysAboveThreshold[energyKey];
        if (maxEnergy !== undefined) {
            const daysPercent = consumptionData.daysTotal > 0 ? Math.round((daysAbove / consumptionData.daysTotal) * 100) : 0;
            let status = daysPercent >= 80 ? '🔴 Critique' : daysPercent >= 40 ? '🟡 Moyen' : '🟢 Bon';
            let statusColor = daysPercent >= 80 ? '#ef4444' : daysPercent >= 40 ? '#f59e0b' : '#22c55e';
            tableHTML += `<tr style="border-bottom: 1px solid #f1f5f9; background: ${i % 2 === 0 ? '#fafbfc' : 'white'};"><td style="padding: 10px 8px; color: #1e293b; font-weight: 500;">Client ${i}</td><td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 600;">${maxEnergy.toFixed(2)}</td><td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 500;">${avgEnergy.toFixed(2)}</td><td style="padding: 10px 8px; text-align: center;"><span style="background: rgba(245, 158, 11, 0.1); color: #92400e; padding: 4px 8px; border-radius: 4px; font-weight: 600;">${daysAbove} jour${daysAbove !== 1 ? 's' : ''} (${daysPercent}%)</span></td><td style="padding: 10px 8px; text-align: center; color: ${statusColor}; font-weight: 600;">${status}</td></tr>`;
        }
    }
    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;
    content.appendChild(tableContainer);
    
    const conclusionDiv = document.createElement('div');
    conclusionDiv.style.cssText = `background: #f8fafc; border-radius: 10px; padding: 16px; margin-top: 20px; border: 1px solid #e2e8f0;`;
    conclusionDiv.innerHTML = `<div style="font-weight: 600; color: #2d3748; margin-bottom: 8px; font-size: 13px; display: flex; align-items: center; gap: 8px;"><span>📊</span> Synthèse de Consommation</div><div style="color: #4b5563; font-size: 12px; line-height: 1.5;">${consumptionData.clientCount} client${consumptionData.clientCount !== 1 ? 's' : ''} analysé${consumptionData.clientCount !== 1 ? 's' : ''} sur ${consumptionData.daysTotal} jour${consumptionData.daysTotal !== 1 ? 's' : ''}. Les indicateurs montrent le nombre de jours où la consommation dépasse 70% du forfait de référence. Une consommation régulièrement élevée peut indiquer un forfait inadapté ou des habitudes de consommation à optimiser.</div>`;
    content.appendChild(conclusionDiv);
    analysisDiv.appendChild(content);
    commercialeContent.insertBefore(analysisDiv, commercialeContent.firstChild);
}

function displayCreditBehaviorAnalysis() {
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    if (!commercialeContent) return;
    
    const creditDataToUse = combinedSoldeData;
    const creditData = analyzeCreditBehavior(creditDataToUse);
    
    const analysisDiv = document.createElement('div');
    analysisDiv.id = 'credit-behavior-analysis';
    analysisDiv.style.cssText = `background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); margin-bottom: 20px; overflow: hidden;`;
    const header = document.createElement('div');
    header.style.cssText = `background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 15px 25px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 10px;`;
    header.innerHTML = `💰 Analyse de Comportement de Crédit`;
    analysisDiv.appendChild(header);
    
    const content = document.createElement('div');
    content.style.cssText = `padding: 20px;`;
    
    let totalZeroDays = 0, totalPurchases = 0, totalClientsWithData = 0;
    for (let i = 1; i <= 6; i++) {
        const creditKey = `Credit${i}`;
        if (creditData.zeroCreditDays[creditKey] !== undefined) {
            totalZeroDays += creditData.zeroCreditDays[creditKey];
            totalPurchases += creditData.purchasePatterns[creditKey]?.length || 0;
            totalClientsWithData++;
        }
    }
    const avgZeroDays = totalClientsWithData > 0 ? Math.round(totalZeroDays / totalClientsWithData) : 0;
    
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = `display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px;`;
    summaryDiv.innerHTML = `
        <div style="background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #22c55e; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Jours Analysés</div>
            <div style="font-size: 32px; font-weight: 800; color: #22c55e; margin-bottom: 8px;">${creditData.totalDays}</div>
        </div>
        <div style="background: linear-gradient(135deg, #fed7d7 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #ef4444; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Jours Sans Crédit</div>
            <div style="font-size: 32px; font-weight: 800; color: #ef4444; margin-bottom: 8px;">${totalZeroDays}</div>
            <div style="font-size: 12px; color: #64748b;">${avgZeroDays} jours/client en moyenne</div>
        </div>
        <div style="background: linear-gradient(135deg, #dbeafe 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Achats Détectés</div>
            <div style="font-size: 32px; font-weight: 800; color: #3b82f6; margin-bottom: 8px;">${totalPurchases}</div>
            <div style="font-size: 12px; color: #64748b;">recharges identifiées</div>
        </div>
    `;
    content.appendChild(summaryDiv);
    
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;`;
    let tableHTML = `<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><thead style="background: #f1f5f9;"><tr><th style="padding: 12px 8px; text-align: left; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Client</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Crédit Max (jours)</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Moyenne (jours)</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Jours à Zéro</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Nombre d'Achats</th><th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Fiabilité</th></tr></thead><tbody>`;
    
    for (let i = 1; i <= 6; i++) {
        const creditKey = `Credit${i}`;
        const maxCredit = creditData.maxCredit[creditKey];
        const avgCredit = creditData.averageCredit[creditKey];
        const zeroDays = creditData.zeroCreditDays[creditKey];
        const purchases = creditData.purchasePatterns[creditKey];
        if (maxCredit !== undefined) {
            const purchaseCount = purchases ? purchases.length : 0;
            const reliabilityPercent = creditData.totalDays > 0 ? Math.round(((creditData.totalDays - zeroDays) / creditData.totalDays) * 100) : 0;
            let reliability = reliabilityPercent >= 90 ? '✅ Excellent' : reliabilityPercent >= 70 ? '👍 Bon' : reliabilityPercent >= 50 ? '⚠️ Moyen' : '🔴 Faible';
            let reliabilityColor = reliabilityPercent >= 90 ? '#22c55e' : reliabilityPercent >= 70 ? '#3b82f6' : reliabilityPercent >= 50 ? '#f59e0b' : '#ef4444';
            tableHTML += `<tr style="border-bottom: 1px solid #f1f5f9; background: ${i % 2 === 0 ? '#fafbfc' : 'white'};"><td style="padding: 10px 8px; color: #1e293b; font-weight: 500;">Client ${i}</td><td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 600;">${maxCredit.toFixed(0)}</td><td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 500;">${avgCredit.toFixed(1)}</td><td style="padding: 10px 8px; text-align: center;"><span style="background: rgba(239, 68, 68, 0.1); color: #991b1b; padding: 4px 8px; border-radius: 4px; font-weight: 600;">${zeroDays} jour${zeroDays !== 1 ? 's' : ''}</span></td><td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 500;">${purchaseCount}</td><td style="padding: 10px 8px; text-align: center; color: ${reliabilityColor}; font-weight: 600;">${reliability} (${reliabilityPercent}%)</td></tr>`;
        }
    }
    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;
    content.appendChild(tableContainer);
    
    const totalClients = Object.keys(creditData.averageCredit).length;
    const goodClients = Object.keys(creditData.averageCredit).filter(key => { const zeroDays = creditData.zeroCreditDays[key] || 0; const reliability = creditData.totalDays > 0 ? Math.round(((creditData.totalDays - zeroDays) / creditData.totalDays) * 100) : 0; return reliability >= 70; }).length;
    
    const conclusionDiv = document.createElement('div');
    conclusionDiv.style.cssText = `background: #f8fafc; border-radius: 10px; padding: 16px; margin-top: 20px; border: 1px solid #e2e8f0;`;
    conclusionDiv.innerHTML = `<div style="font-weight: 600; color: #2d3748; margin-bottom: 8px; font-size: 13px; display: flex; align-items: center; gap: 8px;"><span>📈</span> Synthèse de Fiabilité</div><div style="color: #4b5563; font-size: 12px; line-height: 1.5;">${totalClients} client${totalClients !== 1 ? 's' : ''} analysé${totalClients !== 1 ? 's' : ''} sur ${creditData.totalDays} jour${creditData.totalDays !== 1 ? 's' : ''}. ${goodClients} client${goodClients !== 1 ? 's' : ''} (${totalClients > 0 ? Math.round((goodClients / totalClients) * 100) : 0}%) présentent une fiabilité de recharge satisfaisante. Les jours à crédit zéro indiquent des périodes de coupure potentielles nécessitant une attention particulière.</div>`;
    content.appendChild(conclusionDiv);
    analysisDiv.appendChild(content);
    
    const energyAnalysis = document.getElementById('energy-consumption-analysis');
    if (energyAnalysis) commercialeContent.insertBefore(analysisDiv, energyAnalysis.nextSibling);
    else commercialeContent.appendChild(analysisDiv);
}

function displayEventAnalysis() {
    const evenementContent = document.getElementById('main-tab-content-evenement');
    if (!evenementContent) return;
    evenementContent.innerHTML = '';
    
    const eventGrid = document.createElement('div');
    eventGrid.style.cssText = `display: flex; flex-direction: column; gap: 30px; padding: 20px;`;
    
    if (combinedEventData.length > 0) {
        const summaryCard = createEventSummaryCard();
        eventGrid.appendChild(summaryCard);
        displayDailyEventsTableInEventTab(eventGrid);
        const existingTableContent = document.getElementById('combined-event-table-content');
        if (existingTableContent) {
            const eventTableContainer = existingTableContent.cloneNode(true);
            eventTableContainer.style.cssText = '';
            eventGrid.appendChild(eventTableContainer);
        }
    }
    evenementContent.appendChild(eventGrid);
}

function createEventSummaryCard() {
    const dailyEvents = analyzeEventsByDay();
    
    const totals = dailyEvents.reduce((acc, day) => {
        acc.SuspendP += day.SuspendP || 0;
        acc.SuspendE += day.SuspendE || 0;
        acc.Surcharge += day.Surcharge || 0;
        acc.DelestagePartiel += day.DelestagePartiel || 0;
        acc.DelestageTotal += day.DelestageTotal || 0;
        acc.Total += day.Total || 0;
        return acc;
    }, { SuspendP: 0, SuspendE: 0, Surcharge: 0, DelestagePartiel: 0, DelestageTotal: 0, Total: 0 });
    
    // Collecter les clients uniques pour SuspendP et SuspendE
    const allSuspendPClients = new Set();
    const allSuspendEClients = new Set();
    
    dailyEvents.forEach(day => {
        // Pour SuspendP, le client est déjà extrait
        if (day.SuspendP > 0 && day.client !== 'Système' && day.client !== 'N/A') {
            allSuspendPClients.add(day.client);
        }
        // Pour SuspendE
        if (day.SuspendE > 0 && day.client !== 'Système' && day.client !== 'N/A') {
            allSuspendEClients.add(day.client);
        }
    });
    
    const card = document.createElement('div');
    card.style.cssText = `background: linear-gradient(135deg, #f39c12 0%, #d35400 100%); border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden;`;
    
    const cardHeader = document.createElement('div');
    cardHeader.style.cssText = `background: rgba(255, 255, 255, 0.1); color: white; padding: 15px 25px; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px; backdrop-filter: blur(10px);`;
    cardHeader.innerHTML = `⚠️ SYNTHÈSE DES ÉVÉNEMENTS`;
    
    const cardContent = document.createElement('div');
    cardContent.style.cssText = `padding: 20px 25px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; background: white;`;
    
    cardContent.appendChild(createStatItem('⏸️', 'SuspendP', totals.SuspendP, '#7c3aed', '#f5f3ff', 
        `${allSuspendPClients.size} client${allSuspendPClients.size !== 1 ? 's' : ''}: ${Array.from(allSuspendPClients).sort().join(', ')}`));
    
    cardContent.appendChild(createStatItem('⏸️', 'SuspendE', totals.SuspendE, '#0ea5e9', '#f0f9ff', 
        `${allSuspendEClients.size} client${allSuspendEClients.size !== 1 ? 's' : ''}: ${Array.from(allSuspendEClients).sort().join(', ')}`));
    
    cardContent.appendChild(createStatItem('⚡', 'Surcharge', totals.Surcharge, '#dc2626', '#fef2f2'));
    cardContent.appendChild(createStatItem('🔌', 'Delestage Partiel', totals.DelestagePartiel, '#ea580c', '#fff7ed'));
    cardContent.appendChild(createStatItem('🔋', 'Delestage Total', totals.DelestageTotal, '#991b1b', '#fef2f2'));
    cardContent.appendChild(createStatItem('📊', 'Total Événements', totals.Total, '#16a34a', '#f0fdf4'));
    
    card.appendChild(cardHeader);
    card.appendChild(cardContent);
    return card;
}

function createStatItem(icon, label, value, color, bgColor, subText = '') {
    const item = document.createElement('div');
    item.style.cssText = `padding: 15px; background: ${bgColor}; border-radius: 8px; border-left: 4px solid ${color}; transition: transform 0.2s ease;`;
    item.innerHTML = `<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;"><div style="font-size: 20px;">${icon}</div><div style="font-size: 14px; color: #2c3e50; font-weight: 600;">${label}</div></div><div style="font-size: 24px; color: ${color}; font-weight: bold; margin-bottom: 4px;">${value}</div>${subText ? `<div style="font-size: 11px; color: #64748b;">${subText}</div>` : ''}`;
    return item;
}

function displayDailyEventsTableInEventTab(eventGrid) {
    const dailyEvents = analyzeEventsByDay();
    if (dailyEvents.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.cssText = `text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);`;
        emptyMessage.innerHTML = `<div style="font-size: 48px; margin-bottom: 15px;">📭</div><h3 style="margin: 0 0 10px 0; color: #1e293b;">Aucun événement trouvé</h3><p style="color: #64748b; margin: 0;">Aucun événement n'a été détecté dans les données analysées.</p>`;
        eventGrid.appendChild(emptyMessage);
        return;
    }
    const statsSection = addEventStatisticsSummary(dailyEvents);
    eventGrid.appendChild(statsSection);
    const typeSummarySection = addEventTypeSummary(dailyEvents);
    eventGrid.appendChild(typeSummarySection);
    const tableContainer = document.createElement('div');
    tableContainer.id = 'daily-events-table-container';
    tableContainer.style.cssText = `background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden;`;
    const header = document.createElement('div');
    header.style.cssText = `background: linear-gradient(135deg, #d35400 0%, #a04000 100%); color: white; padding: 15px 25px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 10px;`;
    header.innerHTML = `📊 Tableau Détaillé des Événements`;
    tableContainer.appendChild(header);
    const content = document.createElement('div');
    content.style.cssText = `padding: 20px;`;
    const mainTableWrapper = createMainEventsTable(dailyEvents);
    content.appendChild(mainTableWrapper);
    tableContainer.appendChild(content);
    eventGrid.appendChild(tableContainer);
}

function addEventStatisticsSummary(dailyEvents) {
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = `background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); margin-bottom: 20px; padding: 20px;`;
    const clientRows = dailyEvents.filter(d => d.client !== 'Système' && d.client !== 'N/A');
    const totalEvents = clientRows.reduce((sum, day) => sum + day.Total, 0);
    const totalClients = new Set(clientRows.map(d => d.client)).size;
    const totalDays = new Set(dailyEvents.map(d => d.date)).size;
    const eventsByDate = {};
    dailyEvents.forEach(day => { if (!eventsByDate[day.date]) eventsByDate[day.date] = 0; eventsByDate[day.date] += day.Total; });
    const maxEventsDay = Object.entries(eventsByDate).reduce((max, [date, count]) => count > max.count ? {date, count} : max, {date: '', count: 0});
    const eventsByClient = {};
    clientRows.forEach(row => { if (!eventsByClient[row.client]) eventsByClient[row.client] = 0; eventsByClient[row.client] += row.Total; });
    const maxEventsClient = Object.entries(eventsByClient).reduce((max, [client, count]) => count > max.count ? {client, count} : max, {client: '', count: 0});
    
    statsDiv.innerHTML = `
        <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;"><span style="font-size: 20px; background: #f39c12; color: white; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">📊</span><div><h3 style="margin: 0; color: #1e293b; font-size: 16px;">Synthèse des Événements</h3><p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">Statistiques globales de la période analysée</p></div></div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px; border-radius: 8px;"><div style="font-size: 11px; margin-bottom: 8px; opacity: 0.9;">Total Événements</div><div style="font-size: 24px; font-weight: 700; margin-bottom: 5px;">${totalEvents}</div><div style="font-size: 11px; opacity: 0.9;">sur ${totalDays} jour${totalDays !== 1 ? 's' : ''}</div></div>
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px; border-radius: 8px;"><div style="font-size: 11px; margin-bottom: 8px; opacity: 0.9;">Clients Concernés</div><div style="font-size: 24px; font-weight: 700; margin-bottom: 5px;">${totalClients}</div><div style="font-size: 11px; opacity: 0.9;">avec événements</div></div>
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 15px; border-radius: 8px;"><div style="font-size: 11px; margin-bottom: 8px; opacity: 0.9;">Jour le plus actif</div><div style="font-size: 16px; font-weight: 700; margin-bottom: 5px;">${maxEventsDay.date || 'N/A'}</div><div style="font-size: 11px; opacity: 0.9;">${maxEventsDay.count} événement${maxEventsDay.count !== 1 ? 's' : ''}</div></div>
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 15px; border-radius: 8px;"><div style="font-size: 11px; margin-bottom: 8px; opacity: 0.9;">Client le plus actif</div><div style="font-size: 16px; font-weight: 700; margin-bottom: 5px;">Client ${maxEventsClient.client || 'N/A'}</div><div style="font-size: 11px; opacity: 0.9;">${maxEventsClient.count} événement${maxEventsClient.count !== 1 ? 's' : ''}</div></div>
        </div>
        <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 4px solid #8b5cf6;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;"><span style="font-size: 14px;">💡</span><span style="font-size: 12px; font-weight: 600; color: #1e293b;">Conseil d'analyse</span></div><div style="font-size: 11px; color: #475569; line-height: 1.4;">${totalEvents > 0 ? `Sur ${totalDays} jour${totalDays !== 1 ? 's' : ''}, ${totalClients} client${totalClients !== 1 ? 's' : ''} ont eu des événements. Moyenne: ${(totalEvents/totalDays).toFixed(1)} événements/jour. ${maxEventsDay.count > 5 ? '⚠️ Attention: jour avec événements élevés détecté.' : '✅ Activité dans les normes.'}` : 'Aucun événement détecté durant la période analysée.'}</div></div>
    `;
    return statsDiv;
}

function addEventTypeSummary(dailyEvents) {
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = `background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); margin-bottom: 20px; padding: 20px;`;
    const eventTypes = [
        { name: 'SuspendP', label: 'SuspendP', color: '#7c3aed', icon: '⏸️' },
        { name: 'SuspendE', label: 'SuspendE', color: '#0ea5e9', icon: '⏸️' },
        { name: 'Surcharge', label: 'Surcharge', color: '#dc2626', icon: '⚡' },
        { name: 'DelestagePartiel', label: 'Délestage Partiel', color: '#ea580c', icon: '🔌' },
        { name: 'DelestageTotal', label: 'Délestage Total', color: '#991b1b', icon: '🔋' }
    ];
    const totals = {};
    const clientsByType = {};
    eventTypes.forEach(type => {
        totals[type.name] = dailyEvents.reduce((sum, day) => sum + (day[type.name] || 0), 0);
        clientsByType[type.name] = new Set();
        dailyEvents.forEach(row => { if (row[type.name] > 0 && row.client !== 'Système' && row.client !== 'N/A') clientsByType[type.name].add(row.client); });
    });
    const totalEvents = Object.values(totals).reduce((a, b) => a + b, 0);
    
    summaryDiv.innerHTML = `
        <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;"><span style="font-size: 20px; background: #8b5cf6; color: white; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">📈</span><div><h3 style="margin: 0; color: #1e293b; font-size: 16px;">Répartition par Type d'Événement</h3><p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">Distribution des événements par catégorie</p></div></div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            <div><div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 10px;">Répartition (%)</div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${eventTypes.map(type => { const count = totals[type.name]; const percentage = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0; const clientCount = clientsByType[type.name] ? clientsByType[type.name].size : 0; return `<div style="display: flex; align-items: center; gap: 10px;"><div style="width: 16px; height: 16px; background: ${type.color}; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px;">${type.icon}</div><div style="flex: 1;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;"><span style="font-size: 12px; font-weight: 600; color: ${type.color};">${type.label}</span><span style="font-size: 12px; font-weight: 700; color: #1e293b;">${count} événement${count !== 1 ? 's' : ''}</span></div><div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;"><div style="width: ${percentage}%; height: 100%; background: ${type.color}; border-radius: 3px;"></div></div><div style="display: flex; justify-content: space-between; margin-top: 4px;"><span style="font-size: 10px; color: #64748b;">${percentage}%</span><span style="font-size: 10px; color: #64748b;">${clientCount} client${clientCount !== 1 ? 's' : ''}</span></div></div></div>`; }).join('')}
            </div></div>
            <div><div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 10px;">Analyse et Insights</div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${(() => { const mostFrequent = eventTypes.reduce((max, type) => totals[type.name] > totals[max.name] ? type : eventTypes[0]); return `<div style="padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 4px solid ${mostFrequent.color};"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><span style="font-size: 14px;">🏆</span><span style="font-size: 11px; font-weight: 600; color: ${mostFrequent.color};">Type le plus fréquent</span></div><div style="font-size: 11px; color: #475569;"><strong>${mostFrequent.label}</strong> représente ${Math.round((totals[mostFrequent.name] / totalEvents) * 100)}% des événements (${totals[mostFrequent.name]} sur ${totalEvents})</div></div>`; })()}
                ${(() => { const problematicClients = []; dailyEvents.forEach(row => { if (row.Total >= 3 && row.client !== 'Système' && row.client !== 'N/A') problematicClients.push({ client: row.client, count: row.Total, types: eventTypes.filter(type => row[type.name] > 0).map(type => type.label) }); }); if (problematicClients.length > 0) { const sortedClients = problematicClients.sort((a, b) => b.count - a.count).slice(0, 3); return `<div style="padding: 12px; background: #fef2f2; border-radius: 6px; border-left: 4px solid #dc2626;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><span style="font-size: 14px;">⚠️</span><span style="font-size: 11px; font-weight: 600; color: #dc2626;">Clients à surveiller</span></div><div style="font-size: 11px; color: #475569;">${sortedClients.map(client => `<div style="margin-bottom: 4px;">• <strong>Client ${client.client}</strong>: ${client.count} événements (${client.types.join(', ')})</div>`).join('')}</div></div>`; } return ''; })()}
                <div style="padding: 12px; background: #f0f9ff; border-radius: 6px; border-left: 4px solid #0ea5e9;"><div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><span style="font-size: 14px;">💡</span><span style="font-size: 11px; font-weight: 600; color: #0ea5e9;">Recommandation</span></div><div style="font-size: 11px; color: #475569;">${totalEvents === 0 ? '✅ Aucun événement détecté - système stable' : totalEvents < 10 ? '✅ Activité normale - surveillance standard recommandée' : totalEvents < 20 ? '⚠️ Activité modérée - surveillance rapprochée recommandée' : '🚨 Activité élevée - investigation technique recommandée'}</div></div>
            </div></div>
        </div>
    `;
    return summaryDiv;
}

function createMainEventsTable(dailyEvents) {
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'main-events-table';
    const eventTypes = [
        { name: 'SuspendP', label: 'SuspendP', color: '#7c3aed', bgColor: '#f5f3ff', lightBg: 'rgba(124, 58, 237, 0.05)', icon: '⏸️', description: 'Suspension Puissance', hasClientColumn: true },
        { name: 'SuspendE', label: 'SuspendE', color: '#0ea5e9', bgColor: '#f0f9ff', lightBg: 'rgba(14, 165, 233, 0.05)', icon: '⏸️', description: 'Suspension Énergétique', hasClientColumn: true },
        { name: 'Surcharge', label: 'Surcharge', color: '#dc2626', bgColor: '#fef2f2', lightBg: 'rgba(220, 38, 38, 0.05)', icon: '⚡', description: 'Surcharge du système', hasClientColumn: false },
        { name: 'DelestagePartiel', label: 'Délestage Partiel', color: '#ea580c', bgColor: '#fff7ed', lightBg: 'rgba(234, 88, 12, 0.05)', icon: '🔌', description: 'Délestage partiel', hasClientColumn: false },
        { name: 'DelestageTotal', label: 'Délestage Total', color: '#991b1b', bgColor: '#fef2f2', lightBg: 'rgba(153, 27, 27, 0.05)', icon: '🔋', description: 'Délestage total', hasClientColumn: false }
    ];
    
    let tableHTML = `<div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"><table style="width: 100%; border-collapse: collapse; font-size: 11px;"><thead style="background: linear-gradient(135deg, #f39c12 0%, #d35400 100%);"><tr><th style="padding: 12px 8px; text-align: left; color: white; font-weight: 600; position: sticky; left: 0; background: linear-gradient(135deg, #f39c12 0%, #d35400 100%); z-index: 10; min-width: 160px; border-right: 1px solid rgba(255,255,255,0.2);"><div style="display: flex; align-items: center; gap: 8px;"><span>📅</span><span>Date / Client</span></div></th>`;
    eventTypes.forEach(eventType => {
        if (eventType.hasClientColumn) tableHTML += `<th colspan="4" style="padding: 12px 8px; text-align: center; color: white; font-weight: 600; border-right: 1px solid rgba(255,255,255,0.2); min-width: 240px;"><div style="display: flex; flex-direction: column; align-items: center; gap: 3px;"><div style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">${eventType.icon}</span><span>${eventType.label}</span></div><div style="font-size: 9px; opacity: 0.9; font-weight: normal;">${eventType.description}</div></div></th>`;
        else tableHTML += `<th colspan="3" style="padding: 12px 8px; text-align: center; color: white; font-weight: 600; border-right: 1px solid rgba(255,255,255,0.2); min-width: 180px;"><div style="display: flex; flex-direction: column; align-items: center; gap: 3px;"><div style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">${eventType.icon}</span><span>${eventType.label}</span></div><div style="font-size: 9px; opacity: 0.9; font-weight: normal;">${eventType.description}</div></div></th>`;
    });
    tableHTML += `<th style="padding: 12px 8px; text-align: center; color: white; font-weight: 600; background: linear-gradient(135deg, #16a34a 0%, #059669 100%); min-width: 80px;"><div style="display: flex; align-items: center; justify-content: center; gap: 6px;"><span>📊</span><span>Total</span></div></th></tr><tr style="background: #f8fafc;"><th style="padding: 8px; background: #f8fafc; position: sticky; left: 0; z-index: 9; border-bottom: 1px solid #e2e8f0;"></th>`;
    eventTypes.forEach(eventType => {
        if (eventType.hasClientColumn) tableHTML += `<th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Début</th><th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Fin</th><th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Durée</th><th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;"><div style="display: flex; align-items: center; justify-content: center; gap: 3px;"><span>👤</span><span>Client(s)</span></div></th>`;
        else tableHTML += `<th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Début</th><th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Fin</th><th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Durée</th>`;
    });
    tableHTML += `<th style="padding: 8px; text-align: center; font-size: 10px; color: #16a34a; background: #f0fdf4; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Événements</th></tr></thead><tbody>`;
    
    let rowIndex = 0, currentDate = '', dateGroupIndex = 0;
    dailyEvents.forEach((day, index) => {
        const dateObj = new Date(day.date);
        const formattedDate = dateObj.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
        const isNewDate = day.date !== currentDate;
        if (isNewDate) { currentDate = day.date; dateGroupIndex++; }
        const isSystemRow = day.client === 'Système' || day.client === 'N/A';
        const isClientRow = !isSystemRow;
        let rowBgColor, rowBorderColor, rowTextColor;
        if (isSystemRow) { rowBgColor = '#f8fafc'; rowBorderColor = '#e2e8f0'; rowTextColor = '#475569'; }
        else { if (dateGroupIndex % 2 === 0) rowBgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc'; else rowBgColor = rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff'; rowBorderColor = '#e2e8f0'; rowTextColor = '#1e293b'; }
        
        tableHTML += `<tr style="border-bottom: 1px solid ${rowBorderColor}; background: ${rowBgColor};"><td style="padding: 12px 8px; text-align: left; color: ${rowTextColor}; font-weight: 500; white-space: nowrap; position: sticky; left: 0; background: ${rowBgColor}; z-index: 8; border-right: 1px solid ${rowBorderColor};">`;
        if (isNewDate) {
            tableHTML += `<div style="display: flex; flex-direction: column; gap: 4px;"><div style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 14px;">📅</span><span style="font-weight: 600; font-size: 11px;">${formattedDate}</span></div><div style="font-size: 10px; color: #64748b; background: #f8fafc; padding: 2px 6px; border-radius: 3px; display: inline-block; width: fit-content;">${day.date}</div>${isClientRow ? `<div style="display: flex; align-items: center; gap: 4px; margin-top: 4px;"><span style="font-size: 12px;">👤</span><span style="font-size: 11px; color: #3b82f6; font-weight: 600;">Client ${day.client}</span></div>` : ''}</div>`;
        } else {
            if (isClientRow) tableHTML += `<div style="display: flex; align-items: center; gap: 6px; padding-left: 8px;"><span style="font-size: 12px;">👤</span><span style="font-size: 11px; color: #3b82f6; font-weight: 600;">Client ${day.client}</span></div>`;
            else if (isSystemRow) tableHTML += `<div style="display: flex; align-items: center; gap: 6px; padding-left: 8px;"><span style="font-size: 12px;">⚙️</span><span style="font-size: 11px; color: #64748b; font-weight: 500;">${day.client}</span></div>`;
        }
        tableHTML += `</td>`;
        
        eventTypes.forEach(eventType => {
            const startTime = day[`${eventType.name}_start`] || '-';
            const endTime = day[`${eventType.name}_end`] || '-';
            const duration = day[`${eventType.name}_duration`] || '-';
            const count = day[eventType.name] || 0;
            const clients = eventType.hasClientColumn ? (day[`${eventType.name}_clients_str`] || '-') : '-';
            const hasEvent = count > 0;
            const cellStyle = hasEvent ? `font-weight: 600; background: ${eventType.lightBg}; color: ${eventType.color}; border-left: 2px solid ${eventType.color};` : `color: #94a5a6; font-style: italic; background: transparent;`;
            
            tableHTML += `<td style="padding: 10px 8px; text-align: center; vertical-align: middle; ${cellStyle} border-right: 1px solid ${rowBorderColor};"><div style="min-height: 20px; display: flex; align-items: center; justify-content: center;">${startTime}</div></td><td style="padding: 10px 8px; text-align: center; vertical-align: middle; ${cellStyle} border-right: 1px solid ${rowBorderColor};"><div style="min-height: 20px; display: flex; align-items: center; justify-content: center;">${endTime}</div></td><td style="padding: 10px 8px; text-align: center; vertical-align: middle; ${cellStyle} border-right: 1px solid ${rowBorderColor};"><div style="display: flex; flex-direction: column; align-items: center; gap: 3px;"><div style="min-height: 20px; display: flex; align-items: center; justify-content: center;">${duration}</div>${hasEvent && duration !== '-' ? `<div style="font-size: 9px; padding: 1px 5px; background: ${eventType.bgColor}; color: ${eventType.color}; border-radius: 3px; font-weight: 500;">${count} fois</div>` : ''}</div></td>`;
            if (eventType.hasClientColumn) {
                tableHTML += `<td style="padding: 10px 8px; text-align: center; vertical-align: middle; ${cellStyle} border-right: 1px solid ${rowBorderColor};"><div style="min-height: 20px; display: flex; align-items: center; justify-content: center;">`;
                if (hasEvent && clients !== '-' && clients !== 'Système' && clients !== 'N/A') tableHTML += `<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;"><div style="font-size: 12px; font-weight: 700; color: ${eventType.color};">${clients}</div>${count > 0 ? `<div style="font-size: 9px; color: #64748b; background: ${eventType.bgColor}; padding: 1px 6px; border-radius: 3px;">${count} événement${count > 1 ? 's' : ''}</div>` : ''}</div>`;
                else tableHTML += `-`;
                tableHTML += `</div></td>`;
            }
        });
        
        const totalColor = day.Total > 0 ? '#16a34a' : '#64748b';
        const totalBgColor = day.Total > 0 ? 'rgba(22, 163, 74, 0.1)' : 'transparent';
        tableHTML += `<td style="padding: 12px 8px; text-align: center; vertical-align: middle; color: ${totalColor}; font-weight: 600; background: ${totalBgColor}; border-left: 2px solid ${day.Total > 0 ? '#16a34a' : 'transparent'};"><div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;"><div style="font-size: 14px; font-weight: 700;">${day.Total}</div>${day.Total > 0 ? `<div style="font-size: 9px; padding: 1px 6px; background: ${day.Total >= 5 ? '#fee2e2' : day.Total >= 3 ? '#fef3c7' : '#d1fae5'}; color: ${day.Total >= 5 ? '#dc2626' : day.Total >= 3 ? '#d97706' : '#059669'}; border-radius: 10px; font-weight: 500;">${day.Total >= 5 ? 'Élevé' : day.Total >= 3 ? 'Moyen' : 'Faible'}</div>` : ''}</div></td></tr>`;
        rowIndex++;
    });
    
    const clientRows = dailyEvents.filter(d => d.client !== 'Système' && d.client !== 'N/A');
    const totalEvents = clientRows.reduce((sum, day) => sum + day.Total, 0);
    const totalClients = new Set(clientRows.map(d => d.client)).size;
    const totalDays = new Set(dailyEvents.map(d => d.date)).size;
    const totalsByType = {};
    const clientsByType = {};
    eventTypes.forEach(eventType => {
        totalsByType[eventType.name] = clientRows.reduce((sum, day) => sum + (day[eventType.name] || 0), 0);
        clientsByType[eventType.name] = new Set();
        clientRows.forEach(row => { if (row[eventType.name] > 0 && row[`${eventType.name}_clients_str`] && row[`${eventType.name}_clients_str`] !== '-') clientsByType[eventType.name].add(row.client); });
    });
    const avgEventsPerDay = totalDays > 0 ? (totalEvents / totalDays).toFixed(1) : 0;
    const avgEventsPerClient = totalClients > 0 ? (totalEvents / totalClients).toFixed(1) : 0;
    
    tableHTML += `<tr style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white;"><td style="padding: 15px 8px; text-align: left; font-weight: 600; position: sticky; left: 0; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); z-index: 8; border-right: 1px solid #334155;"><div style="display: flex; flex-direction: column; gap: 4px;"><div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 16px;">📈</span><span>SYNTHÈSE GLOBALE</span></div><div style="font-size: 10px; color: rgba(255,255,255,0.8);">${totalDays} jour${totalDays !== 1 ? 's' : ''} analysé${totalDays !== 1 ? 's' : ''}</div></div></td>`;
    eventTypes.forEach(eventType => {
        const totalForType = totalsByType[eventType.name] || 0;
        const clientsForType = clientsByType[eventType.name] ? clientsByType[eventType.name].size : 0;
        const percentage = totalEvents > 0 ? Math.round((totalForType / totalEvents) * 100) : 0;
        if (eventType.hasClientColumn) tableHTML += `<td colspan="4" style="padding: 15px 8px; text-align: center; vertical-align: middle; background: rgba(255,255,255,0.1); border-left: 2px solid ${eventType.color};"><div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 16px;">${eventType.icon}</span><span style="font-weight: 700; font-size: 14px;">${totalForType}</span></div><div style="font-size: 10px; color: rgba(255,255,255,0.9);">${clientsForType} client${clientsForType !== 1 ? 's' : ''}</div>${percentage > 0 ? `<div style="width: 100%; max-width: 100px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;"><div style="width: ${percentage}%; height: 100%; background: ${eventType.color}; border-radius: 2px;"></div></div><div style="font-size: 9px; color: rgba(255,255,255,0.8);">${percentage}% du total</div>` : ''}</div></td>`;
        else tableHTML += `<td colspan="3" style="padding: 15px 8px; text-align: center; vertical-align: middle; background: rgba(255,255,255,0.1); border-left: 2px solid ${eventType.color};"><div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 16px;">${eventType.icon}</span><span style="font-weight: 700; font-size: 14px;">${totalForType}</span></div>${percentage > 0 ? `<div style="width: 100%; max-width: 100px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;"><div style="width: ${percentage}%; height: 100%; background: ${eventType.color}; border-radius: 2px;"></div></div><div style="font-size: 9px; color: rgba(255,255,255,0.8);">${percentage}% du total</div>` : ''}</div></td>`;
    });
    tableHTML += `<td style="padding: 15px 8px; text-align: center; vertical-align: middle; background: rgba(34, 197, 94, 0.3); border-left: 2px solid #22c55e;"><div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 18px;">📊</span><span style="font-weight: 800; font-size: 16px;">${totalEvents}</span></div><div style="font-size: 10px; color: rgba(255,255,255,0.9);">${totalClients} client${totalClients !== 1 ? 's' : ''}</div><div style="font-size: 9px; color: rgba(255,255,255,0.8);">${avgEventsPerDay}/jour • ${avgEventsPerClient}/client</div></div></td></tr></tbody></table></div>`;
    
    tableHTML += `<div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;"><div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;"><span style="font-size: 16px; background: #f39c12; color: white; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">🎨</span><div><div style="font-size: 12px; font-weight: 600; color: #1e293b;">Légende du tableau</div><div style="font-size: 10px; color: #64748b;">Types de lignes et signification</div></div></div><div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;"><div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #f8fafc; border-radius: 6px; border-left: 4px solid #3b82f6;"><div style="width: 24px; height: 24px; background: #3b82f6; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">👤</div><div><div style="font-size: 11px; font-weight: 600; color: #3b82f6;">Ligne Client</div><div style="font-size: 10px; color: #64748b;">Événements pour un client spécifique</div></div></div><div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #f8fafc; border-radius: 6px; border-left: 4px solid #94a3b8;"><div style="width: 24px; height: 24px; background: #94a3b8; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">⚙️</div><div><div style="font-size: 11px; font-weight: 600; color: #94a3b8;">Ligne Système</div><div style="font-size: 10px; color: #64748b;">Événements système (pas de client)</div></div></div>${eventTypes.map(eventType => `<div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: ${eventType.bgColor}; border-radius: 6px; border-left: 4px solid ${eventType.color};"><div style="width: 24px; height: 24px; background: ${eventType.color}; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">${eventType.icon}</div><div><div style="font-size: 11px; font-weight: 600; color: ${eventType.color};">${eventType.label}</div><div style="font-size: 10px; color: #64748b;">${eventType.description}</div>${eventType.hasClientColumn ? `<div style="font-size: 9px; color: ${eventType.color}; font-weight: 500; margin-top: 3px;">👤 Affiche le client concerné</div>` : ''}</div></div>`).join('')}</div></div>`;
    tableWrapper.innerHTML = tableHTML;
    return tableWrapper;
}

function analyzeEventsByDay() {
    if (combinedEventData.length === 0) return [];
    
    const eventsByDay = {};
    
    combinedEventData.forEach(row => {
        if (!row['Date et Heure'] || !row['Évènements']) return;
        
        const dateTime = new Date(row['Date et Heure']);
        if (isNaN(dateTime.getTime())) return;
        
        const date = dateTime.toISOString().split('T')[0];
        const time = dateTime.toTimeString().split(' ')[0];
        const event = row['Évènements'].trim();
        
        if (!eventsByDay[date]) {
            eventsByDay[date] = { 
                date, 
                eventsByClient: {}, 
                eventsByType: {}, 
                allEvents: [] 
            };
        }
        
        const day = eventsByDay[date];
        day.allEvents.push({ time, event, code1: row['Code 1'] || '', code2: row['Code 2'] || '', code3: row['Code 3'] || '', rawEvent: row['Évènements'] || '' });
        
        // Déterminer le type d'événement
        let eventType = '';
        if (event.includes('SuspendP')) eventType = 'SuspendP';
        else if (event.includes('SuspendE')) eventType = 'SuspendE';
        else if (event.includes('Surcharge')) eventType = 'Surcharge';
        else if (event.includes('DelestagePartiel')) eventType = 'DelestagePartiel';
        else if (event.includes('DelestageTotal')) eventType = 'DelestageTotal';
        else if (event.includes('Démarrage')) eventType = 'Démarrage';
        else if (event.includes('Arrêt')) eventType = 'Arrêt';
        else if (event.includes('Normal')) eventType = 'Normal';
        else eventType = 'Autre';
        
        // Déterminer le numéro du client
        let clientNumber = 'Système';
        
        // Pour SuspendP et SuspendE, extraire le dernier chiffre du Code 1
        if (eventType === 'SuspendP' || eventType === 'SuspendE') {
            const code1 = row['Code 1'] || '';
            if (code1 && /^\d+$/.test(code1.trim())) {
                // Prendre le dernier chiffre du numéro
                const lastDigit = code1.trim().slice(-1);
                clientNumber = lastDigit;
            } else {
                clientNumber = 'N/A';
            }
        }
        
        const clientTypeKey = `${clientNumber}_${eventType}`;
        
        // Initialiser les structures de données pour ce client
        if (!day.eventsByClient[clientNumber]) {
            day.eventsByClient[clientNumber] = { 
                client: clientNumber, 
                eventsByType: {}, 
                allEvents: [] 
            };
        }
        
        if (!day.eventsByClient[clientNumber].eventsByType[eventType]) {
            day.eventsByClient[clientNumber].eventsByType[eventType] = { 
                count: 0, 
                startTime: null, 
                endTime: null, 
                events: [] 
            };
        }
        
        if (!day.eventsByType[eventType]) {
            day.eventsByType[eventType] = { 
                count: 0, 
                clients: new Set(), 
                startTime: null, 
                endTime: null, 
                events: [] 
            };
        }
        
        // Ajouter l'événement pour ce client
        const clientEventInfo = day.eventsByClient[clientNumber].eventsByType[eventType];
        clientEventInfo.count++;
        clientEventInfo.events.push({ time, event });
        
        if (!clientEventInfo.startTime || time < clientEventInfo.startTime) {
            clientEventInfo.startTime = time;
        }
        if (!clientEventInfo.endTime || time > clientEventInfo.endTime) {
            clientEventInfo.endTime = time;
        }
        
        // Ajouter l'événement pour le type global
        const typeEventInfo = day.eventsByType[eventType];
        typeEventInfo.count++;
        if (clientNumber !== 'Système' && clientNumber !== 'N/A') {
            typeEventInfo.clients.add(clientNumber);
        }
        typeEventInfo.events.push({ time, event, client: clientNumber });
        
        if (!typeEventInfo.startTime || time < typeEventInfo.startTime) {
            typeEventInfo.startTime = time;
        }
        if (!typeEventInfo.endTime || time > typeEventInfo.endTime) {
            typeEventInfo.endTime = time;
        }
    });
    
    const result = [];
    
    Object.keys(eventsByDay).sort().forEach(date => {
        const day = eventsByDay[date];
        const clients = Object.keys(day.eventsByClient).sort();
        
        clients.forEach(clientNumber => {
            if (clientNumber === 'TOTAL') return;
            
            const clientData = day.eventsByClient[clientNumber];
            
            const row = {
                date,
                client: clientNumber,
                SuspendP: 0, 
                SuspendP_start: '-', 
                SuspendP_end: '-', 
                SuspendP_duration: '-', 
                SuspendP_clients_str: clientNumber === 'Système' || clientNumber === 'N/A' ? '-' : clientNumber,
                
                SuspendE: 0, 
                SuspendE_start: '-', 
                SuspendE_end: '-', 
                SuspendE_duration: '-', 
                SuspendE_clients_str: clientNumber === 'Système' || clientNumber === 'N/A' ? '-' : clientNumber,
                
                Surcharge: 0, 
                Surcharge_start: '-', 
                Surcharge_end: '-', 
                Surcharge_duration: '-',
                
                DelestagePartiel: 0, 
                DelestagePartiel_start: '-', 
                DelestagePartiel_end: '-', 
                DelestagePartiel_duration: '-',
                
                DelestageTotal: 0, 
                DelestageTotal_start: '-', 
                DelestageTotal_end: '-', 
                DelestageTotal_duration: '-',
                
                Total: 0
            };
            
            Object.keys(clientData.eventsByType).forEach(eventType => {
                const eventInfo = clientData.eventsByType[eventType];
                
                if (eventType === 'SuspendP') {
                    row.SuspendP = eventInfo.count;
                    if (eventInfo.startTime && eventInfo.endTime) {
                        row.SuspendP_start = eventInfo.startTime.substring(0, 5);
                        row.SuspendP_end = eventInfo.endTime.substring(0, 5);
                        row.SuspendP_duration = calculateDuration(eventInfo.startTime, eventInfo.endTime);
                    }
                } else if (eventType === 'SuspendE') {
                    row.SuspendE = eventInfo.count;
                    if (eventInfo.startTime && eventInfo.endTime) {
                        row.SuspendE_start = eventInfo.startTime.substring(0, 5);
                        row.SuspendE_end = eventInfo.endTime.substring(0, 5);
                        row.SuspendE_duration = calculateDuration(eventInfo.startTime, eventInfo.endTime);
                    }
                } else if (eventType === 'Surcharge') {
                    row.Surcharge = eventInfo.count;
                    if (eventInfo.startTime && eventInfo.endTime) {
                        row.Surcharge_start = eventInfo.startTime.substring(0, 5);
                        row.Surcharge_end = eventInfo.endTime.substring(0, 5);
                        row.Surcharge_duration = calculateDuration(eventInfo.startTime, eventInfo.endTime);
                    }
                } else if (eventType === 'DelestagePartiel') {
                    row.DelestagePartiel = eventInfo.count;
                    if (eventInfo.startTime && eventInfo.endTime) {
                        row.DelestagePartiel_start = eventInfo.startTime.substring(0, 5);
                        row.DelestagePartiel_end = eventInfo.endTime.substring(0, 5);
                        row.DelestagePartiel_duration = calculateDuration(eventInfo.startTime, eventInfo.endTime);
                    }
                } else if (eventType === 'DelestageTotal') {
                    row.DelestageTotal = eventInfo.count;
                    if (eventInfo.startTime && eventInfo.endTime) {
                        row.DelestageTotal_start = eventInfo.startTime.substring(0, 5);
                        row.DelestageTotal_end = eventInfo.endTime.substring(0, 5);
                        row.DelestageTotal_duration = calculateDuration(eventInfo.startTime, eventInfo.endTime);
                    }
                }
                
                row.Total += eventInfo.count;
            });
            
            result.push(row);
        });
    });
    
    return result;
}
function getEventsByClient(clientNumber) {
    const dailyEvents = analyzeEventsByDay();
    
    // Convertir clientNumber en string pour la comparaison
    const clientStr = clientNumber.toString();
    
    // Filtrer les événements pour ce client uniquement
    const clientEvents = dailyEvents.filter(event => 
        event.client === clientStr || 
        (event.client !== 'Système' && event.client !== 'N/A' && event.client === clientStr)
    );
    
    // Filtrer aussi les événements système qui concernent ce client
    // (dans le cas où certains événements système sont liés à des clients)
    const systemEventsForClient = dailyEvents.filter(event => 
        event.client === 'Système' && 
        (event.SuspendP_clients_str === clientStr || event.SuspendE_clients_str === clientStr)
    );
    
    return [...clientEvents, ...systemEventsForClient];
}

function calculateDuration(startTime, endTime) {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    if (end < start) end.setDate(end.getDate() + 1);
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return diffHours > 0 ? `${diffHours}h${diffMinutes.toString().padStart(2, '0')}` : `${diffMinutes}min`;
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
            if (filename.toLowerCase().includes('energie')) storeEnergyFile(filename, fullPath, result.content);
            else if (filename.toLowerCase().includes('tens')) storeTensionFile(filename, fullPath, result.content);
            else if (filename.toLowerCase().includes('event')) storeEventFile(filename, fullPath, result.content);
            else if (filename.toLowerCase().includes('solde')) storeSoldeFile(filename, fullPath, result.content);
            else if (filename.toLowerCase().includes('recharge')) storeRechargeFile(filename, fullPath, result.content);
        }
    } catch (error) {
        console.error('❌ Erreur lors de la lecture du fichier:', filename, error);
        loadedFilesCount++;
        updateLoadingProgress();
    }
}

function storeEnergyFile(filename, fullPath, content) {
    const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const lines = parseCSVContent(content, 'ENERGIE');
    energyData.push({ filename, path: fullPath, folder: folderPath || 'Racine', content, lines, type: 'ENERGIE' });
    if (lines.length > 0) updateCombinedTables();
}

function storeTensionFile(filename, fullPath, content) {
    const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const lines = parseCSVContent(content, 'TENSION');
    tensionData.push({ filename, path: fullPath, folder: folderPath || 'Racine', content, lines, type: 'TENSION' });
    if (lines.length > 0) updateCombinedTables();
}

function storeEventFile(filename, fullPath, content) {
    const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const lines = parseCSVContent(content, 'EVENT');
    eventData.push({ filename, path: fullPath, folder: folderPath || 'Racine', content, lines, type: 'EVENT' });
    if (lines.length > 0) updateCombinedTables();
}

function storeSoldeFile(filename, fullPath, content) {
    const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const lines = parseCSVContent(content, 'SOLDE');
    soldeData.push({ filename, path: fullPath, folder: folderPath || 'Racine', content, lines, type: 'SOLDE' });
    if (lines.length > 0) updateCombinedTables();
}

function storeRechargeFile(filename, fullPath, content) {
    const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const lines = parseCSVContent(content, 'RECHARGE');
    rechargeData.push({ filename, path: fullPath, folder: folderPath || 'Racine', content, lines, type: 'RECHARGE' });
    if (lines.length > 0) updateCombinedTables();
}

function parseAndCombineData() {
    parseAndCombineEnergyData();
    parseAndCombineTensionData();
    parseAndCombineEventData();
    parseAndCombineSoldeData();
    parseAndCombineRechargeData();
}

function parseAndCombineEnergyData() {
    const dataMap = new Map();
    energyData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 8) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) dataMap.set(timestamp, { 'Date et Heure': timestamp, 'Energie1': '', 'Energie2': '', 'Energie3': '', 'Energie4': '', 'Energie5': '', 'Energie6': '' });
                    const row = dataMap.get(timestamp);
                    row['Energie1'] = parts[2] ? parts[2].trim() : '';
                    row['Energie2'] = parts[3] ? parts[3].trim() : '';
                    row['Energie3'] = parts[4] ? parts[4].trim() : '';
                    row['Energie4'] = parts[5] ? parts[5].trim() : '';
                    row['Energie5'] = parts[6] ? parts[6].trim() : '';
                    row['Energie6'] = parts[7] ? parts[7].trim() : '';
                }
            }
        });
    });
    combinedEnergyData = Array.from(dataMap.values()).filter(row => row['Date et Heure']).sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
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
                    if (!dataMap.has(timestamp)) dataMap.set(timestamp, { 'Date et Heure': timestamp, 'T_min': '', 'T_moy': '', 'T_max': '' });
                    const row = dataMap.get(timestamp);
                    row['T_min'] = parts[2] ? parts[2].trim() : '';
                    row['T_moy'] = parts[3] ? parts[3].trim() : '';
                    row['T_max'] = parts[4] ? parts[4].trim() : '';
                }
            }
        });
    });
    combinedTensionData = Array.from(dataMap.values()).filter(row => row['Date et Heure']).sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
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
                    if (!dataMap.has(timestamp)) dataMap.set(timestamp, { 'Date et Heure': timestamp, 'Évènements': '', 'Code 1': '', 'Code 2': '', 'Code 3': '' });
                    const row = dataMap.get(timestamp);
                    row['Évènements'] = parts[2] ? parts[2].trim() : '';
                    row['Code 1'] = parts[3] ? parts[3].trim() : '';
                    row['Code 2'] = parts[4] ? parts[4].trim() : '';
                    row['Code 3'] = parts[5] ? parts[5].trim() : '';
                }
            }
        });
    });
    combinedEventData = Array.from(dataMap.values()).filter(row => row['Date et Heure']).sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
}

function parseAndCombineSoldeData() {
    const dataMap = new Map();
    soldeData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 8) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) dataMap.set(timestamp, { 'Date et Heure': timestamp, 'Credit1': '', 'Credit2': '', 'Credit3': '', 'Credit4': '', 'Credit5': '', 'Credit6': '' });
                    const row = dataMap.get(timestamp);
                    row['Credit1'] = parts[2] ? parts[2].trim() : '';
                    row['Credit2'] = parts[3] ? parts[3].trim() : '';
                    row['Credit3'] = parts[4] ? parts[4].trim() : '';
                    row['Credit4'] = parts[5] ? parts[5].trim() : '';
                    row['Credit5'] = parts[6] ? parts[6].trim() : '';
                    row['Credit6'] = parts[7] ? parts[7].trim() : '';
                }
            }
        });
    });
    combinedSoldeData = Array.from(dataMap.values()).filter(row => row['Date et Heure']).sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
}

function parseAndCombineRechargeData() {
    const dataMap = new Map();
    rechargeData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 10) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) dataMap.set(timestamp, { 'Date et Heure': timestamp, 'Code enregistrer': '', 'Type de code': '', 'Status': '', 'Code 1': '', 'Code 2': '', 'Code 3': '', 'Code 4': '' });
                    const row = dataMap.get(timestamp);
                    row['Code enregistrer'] = parts[2] ? parts[2].trim() : '';
                    row['Type de code'] = parts[3] ? parts[3].trim() : '';
                    row['Status'] = parts[4] ? parts[4].trim() : '';
                    row['Code 1'] = parts[5] ? parts[5].trim() : '';
                    row['Code 2'] = parts[6] ? parts[6].trim() : '';
                    row['Code 3'] = parts[7] ? parts[7].trim() : '';
                    row['Code 4'] = parts[8] ? parts[8].trim() : '';
                }
            }
        });
    });
    combinedRechargeData = Array.from(dataMap.values()).filter(row => row['Date et Heure']).sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
}

function updateCombinedTables() {
    parseAndCombineData();
    updateEnergyTable();
    updateTensionTable();
    updateEventTable();
    updateSoldeTable();
    updateRechargeTable();
    setTimeout(() => {
        if (typeof Chart === 'undefined') { setTimeout(createETCharts, 500); return; }
        updateETCharts();
    }, 500);
}

function updateEventTable() {
    const tableContent = document.getElementById('combined-event-table-content');
    if (!tableContent) return;
    if (combinedEventData.length === 0) {
        tableContent.innerHTML = `<div class="empty-message"><div class="empty-icon">⚠️</div><p>Aucune donnée ÉVÉNEMENT valide trouvée</p></div>`;
        return;
    }
    totalRowsEvent = combinedEventData.length;
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls-div';
    controlsDiv.id = 'event-controls-div';
    controlsDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px; flex-wrap: wrap; gap: 10px;`;
    const totalPages = Math.ceil(totalRowsEvent / rowsPerPage);
    controlsDiv.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 14px; color: #2c3e50;">Affichage: <strong>${((currentPageEvent - 1) * rowsPerPage + 1).toLocaleString()}</strong> à <strong>${Math.min(currentPageEvent * rowsPerPage, totalRowsEvent).toLocaleString()}</strong> sur <strong>${totalRowsEvent.toLocaleString()}</strong> lignes</span></div><div style="display: flex; align-items: center; gap: 5px;"><button id="event-first-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEvent === 1 ? 'disabled' : ''}>««</button><button id="event-prev-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEvent === 1 ? 'disabled' : ''}>«</button><span style="padding: 5px 15px; font-size: 13px; color: #2c3e50;">Page <strong>${currentPageEvent}</strong> sur <strong>${totalPages}</strong></span><button id="event-next-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEvent === totalPages ? 'disabled' : ''}>»</button><button id="event-last-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEvent === totalPages ? 'disabled' : ''}>»»</button></div>`;
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'event-table-wrapper';
    tableWrapper.style.cssText = `width: 100%; max-height: 600px; overflow: auto; border: 1px solid #dee2e6; border-radius: 8px; position: relative;`;
    const table = document.createElement('table');
    table.id = 'combined-event-data-table';
    table.className = 'combined-data-table';
    table.style.cssText = `width: 100%; border-collapse: collapse; font-size: 11px;`;
    const thead = document.createElement('thead');
    thead.style.cssText = `position: sticky; top: 0; z-index: 10; background: white;`;
    const headerRow = document.createElement('tr');
    const headers = [
        { name: 'Date et Heure', width: '160px', sticky: true },
        { name: 'Évènements', width: '200px' },
        { name: 'Code 1', width: '100px' },
        { name: 'Code 2', width: '100px' },
        { name: 'Code 3', width: '100px' }
    ];
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header.name;
        th.style.cssText = `padding: 10px 4px; text-align: ${index === 0 ? 'left' : 'center'}; background: ${index === 0 ? '#f39c12' : '#d35400'}; color: white; border: 1px solid #dee2e6; font-weight: 600; white-space: nowrap; ${header.sticky ? 'position: sticky; left: 0; z-index: 11;' : ''} min-width: ${header.width}; font-size: 10.5px;`;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    tableContent.innerHTML = '';
    tableContent.appendChild(controlsDiv);
    tableContent.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    renderEventCurrentPage();
    setupEventTableControls();
    const footer = document.createElement('div');
    footer.style.cssText = `margin-top: 15px; font-size: 11px; color: #7f8c8d; text-align: center; padding: 10px; border-top: 1px solid #ecf0f1;`;
    footer.innerHTML = `<div>Tableau des ÉVÉNEMENTS généré le ${new Date().toLocaleString()}</div>`;
    tableContent.appendChild(footer);
}

function renderEventCurrentPage() {
    const table = document.getElementById('combined-event-data-table');
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) oldTbody.remove();
    const tbody = document.createElement('tbody');
    const startIndex = (currentPageEvent - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRowsEvent);
    for (let i = 0; i < (endIndex - startIndex); i++) {
        const rowIndex = startIndex + i;
        const row = combinedEventData[rowIndex];
        if (!row) continue;
        const tr = document.createElement('tr');
        tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
        const tdDate = document.createElement('td');
        tdDate.textContent = row['Date et Heure'] || '-';
        tdDate.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: left; vertical-align: middle; white-space: nowrap; background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'}; position: sticky; left: 0; z-index: 1; font-family: 'Courier New', monospace; font-size: 10px;`;
        tr.appendChild(tdDate);
        const tdEvent = document.createElement('td');
        const eventValue = row['Évènements'] || '-';
        tdEvent.textContent = eventValue;
        let eventColor = '#2c3e50', eventBackground = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
        if (eventValue.toLowerCase().includes('surcharge')) { eventColor = '#dc2626'; eventBackground = (i % 2 === 0) ? '#fee2e2' : '#fecaca'; }
        else if (eventValue.toLowerCase().includes('démarrage')) { eventColor = '#059669'; eventBackground = (i % 2 === 0) ? '#d1fae5' : '#a7f3d0'; }
        else if (eventValue.toLowerCase().includes('arrêt')) { eventColor = '#4b5563'; eventBackground = (i % 2 === 0) ? '#f3f4f6' : '#e5e7eb'; }
        else if (eventValue.toLowerCase().includes('suspendp')) { eventColor = '#7c3aed'; eventBackground = (i % 2 === 0) ? '#ede9fe' : '#ddd6fe'; }
        else if (eventValue.toLowerCase().includes('suspende')) { eventColor = '#0ea5e9'; eventBackground = (i % 2 === 0) ? '#e0f2fe' : '#bae6fd'; }
        else if (eventValue.toLowerCase().includes('delestagepartiel')) { eventColor = '#ea580c'; eventBackground = (i % 2 === 0) ? '#ffedd5' : '#fed7aa'; }
        else if (eventValue.toLowerCase().includes('delestagetotal')) { eventColor = '#991b1b'; eventBackground = (i % 2 === 0) ? '#fef2f2' : '#fecaca'; }
        tdEvent.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: left; vertical-align: middle; white-space: nowrap; font-size: 10px; font-weight: bold; color: ${eventColor}; background: ${eventBackground};`;
        tr.appendChild(tdEvent);
        for (let j = 1; j <= 3; j++) {
            const codeKey = `Code ${j}`;
            const td = document.createElement('td');
            const value = row[codeKey] || '';
            if (value && value !== '') {
                const numValue = parseFloat(value.replace(',', '.'));
                if (isNaN(numValue)) td.textContent = value;
                else { if (Number.isInteger(numValue)) td.textContent = numValue.toString(); else { const stringValue = value.replace(',', '.'); if (stringValue.includes('.') && stringValue.endsWith('00')) td.textContent = Math.trunc(numValue).toString(); else td.textContent = stringValue.replace(/\.?0+$/, ''); } }
                td.style.color = '#2980b9'; td.style.fontWeight = 'bold';
            } else { td.textContent = '-'; td.style.color = '#95a5a6'; td.style.fontStyle = 'italic'; }
            td.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: center; vertical-align: middle; white-space: nowrap; font-size: 10px; background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'};`;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    updateEventPaginationControls();
}

function setupEventTableControls() {
    const firstPageBtn = document.getElementById('event-first-page-btn');
    const prevPageBtn = document.getElementById('event-prev-page-btn');
    const nextPageBtn = document.getElementById('event-next-page-btn');
    const lastPageBtn = document.getElementById('event-last-page-btn');
    if (firstPageBtn) firstPageBtn.addEventListener('click', () => { currentPageEvent = 1; renderEventCurrentPage(); });
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPageEvent > 1) { currentPageEvent--; renderEventCurrentPage(); } });
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => { const totalPages = Math.ceil(totalRowsEvent / rowsPerPage); if (currentPageEvent < totalPages) { currentPageEvent++; renderEventCurrentPage(); } });
    if (lastPageBtn) lastPageBtn.addEventListener('click', () => { currentPageEvent = Math.ceil(totalRowsEvent / rowsPerPage); renderEventCurrentPage(); });
}

function updateEventPaginationControls() {
    const totalPages = Math.ceil(totalRowsEvent / rowsPerPage);
    const pageInfo = document.querySelector('#event-controls-div span:nth-child(2)');
    if (pageInfo) pageInfo.innerHTML = `Page <strong>${currentPageEvent}</strong> sur <strong>${totalPages}</strong>`;
    const linesInfo = document.querySelector('#event-controls-div > div:first-child span');
    if (linesInfo) linesInfo.innerHTML = `Affichage: <strong>${((currentPageEvent - 1) * rowsPerPage + 1).toLocaleString()}</strong> à <strong>${Math.min(currentPageEvent * rowsPerPage, totalRowsEvent).toLocaleString()}</strong> sur <strong>${totalRowsEvent.toLocaleString()}</strong> lignes`;
    const firstPageBtn = document.getElementById('event-first-page-btn');
    const prevPageBtn = document.getElementById('event-prev-page-btn');
    const nextPageBtn = document.getElementById('event-next-page-btn');
    const lastPageBtn = document.getElementById('event-last-page-btn');
    if (firstPageBtn) firstPageBtn.disabled = currentPageEvent === 1;
    if (prevPageBtn) prevPageBtn.disabled = currentPageEvent === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPageEvent === totalPages;
    if (lastPageBtn) lastPageBtn.disabled = currentPageEvent === totalPages;
}

function updateSoldeTable() {
    const tableContent = document.getElementById('combined-solde-table-content');
    if (!tableContent) return;
    if (combinedSoldeData.length === 0) {
        tableContent.innerHTML = `<div class="empty-message"><div class="empty-icon">💰</div><p>Aucune donnée SOLDE valide trouvée</p></div>`;
        return;
    }
    totalRowsSolde = combinedSoldeData.length;
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls-div';
    controlsDiv.id = 'solde-controls-div';
    controlsDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px; flex-wrap: wrap; gap: 10px;`;
    const totalPages = Math.ceil(totalRowsSolde / rowsPerPage);
    controlsDiv.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 14px; color: #2c3e50;">Affichage: <strong>${((currentPageSolde - 1) * rowsPerPage + 1).toLocaleString()}</strong> à <strong>${Math.min(currentPageSolde * rowsPerPage, totalRowsSolde).toLocaleString()}</strong> sur <strong>${totalRowsSolde.toLocaleString()}</strong> lignes</span></div><div style="display: flex; align-items: center; gap: 5px;"><button id="solde-first-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageSolde === 1 ? 'disabled' : ''}>««</button><button id="solde-prev-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageSolde === 1 ? 'disabled' : ''}>«</button><span style="padding: 5px 15px; font-size: 13px; color: #2c3e50;">Page <strong>${currentPageSolde}</strong> sur <strong>${totalPages}</strong></span><button id="solde-next-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageSolde === totalPages ? 'disabled' : ''}>»</button><button id="solde-last-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageSolde === totalPages ? 'disabled' : ''}>»»</button></div>`;
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'solde-table-wrapper';
    tableWrapper.style.cssText = `width: 100%; max-height: 600px; overflow: auto; border: 1px solid #dee2e6; border-radius: 8px; position: relative;`;
    const table = document.createElement('table');
    table.id = 'combined-solde-data-table';
    table.className = 'combined-data-table';
    table.style.cssText = `width: 100%; border-collapse: collapse; font-size: 11px;`;
    const thead = document.createElement('thead');
    thead.style.cssText = `position: sticky; top: 0; z-index: 10; background: white;`;
    const headerRow = document.createElement('tr');
    const headers = [
        { name: 'Date et Heure', width: '160px', sticky: true },
        { name: 'Credit1', width: '80px' }, { name: 'Credit2', width: '80px' },
        { name: 'Credit3', width: '80px' }, { name: 'Credit4', width: '80px' },
        { name: 'Credit5', width: '80px' }, { name: 'Credit6', width: '80px' }
    ];
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header.name;
        th.style.cssText = `padding: 10px 4px; text-align: ${index === 0 ? 'left' : 'center'}; background: ${index === 0 ? '#27ae60' : '#2ecc71'}; color: white; border: 1px solid #dee2e6; font-weight: 600; white-space: nowrap; ${header.sticky ? 'position: sticky; left: 0; z-index: 11;' : ''} min-width: ${header.width}; font-size: 10.5px;`;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    tableContent.innerHTML = '';
    tableContent.appendChild(controlsDiv);
    tableContent.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    renderSoldeCurrentPage();
    setupSoldeTableControls();
    const footer = document.createElement('div');
    footer.style.cssText = `margin-top: 15px; font-size: 11px; color: #7f8c8d; text-align: center; padding: 10px; border-top: 1px solid #ecf0f1;`;
    footer.innerHTML = `<div>Tableau SOLDE généré le ${new Date().toLocaleString()}</div>`;
    tableContent.appendChild(footer);
}

function renderSoldeCurrentPage() {
    const table = document.getElementById('combined-solde-data-table');
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) oldTbody.remove();
    const tbody = document.createElement('tbody');
    const startIndex = (currentPageSolde - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRowsSolde);
    for (let i = 0; i < (endIndex - startIndex); i++) {
        const rowIndex = startIndex + i;
        const row = combinedSoldeData[rowIndex];
        if (!row) continue;
        const tr = document.createElement('tr');
        tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
        const tdDate = document.createElement('td');
        tdDate.textContent = row['Date et Heure'] || '-';
        tdDate.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: left; vertical-align: middle; white-space: nowrap; background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'}; position: sticky; left: 0; z-index: 1; font-family: 'Courier New', monospace; font-size: 10px;`;
        tr.appendChild(tdDate);
        for (let j = 1; j <= 6; j++) {
            const creditKey = `Credit${j}`;
            const td = document.createElement('td');
            const value = row[creditKey] || '';
            if (value && value !== '') {
                const numValue = parseFloat(value.replace(',', '.'));
                if (isNaN(numValue)) td.textContent = value;
                else { if (Number.isInteger(numValue)) td.textContent = numValue.toString(); else { const stringValue = value.replace(',', '.'); if (stringValue.includes('.') && stringValue.endsWith('00')) td.textContent = Math.trunc(numValue).toString(); else td.textContent = stringValue.replace(/\.?0+$/, ''); } }
                td.style.color = '#27ae60'; td.style.fontWeight = 'bold';
            } else { td.textContent = '-'; td.style.color = '#95a5a6'; td.style.fontStyle = 'italic'; }
            td.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: center; vertical-align: middle; white-space: nowrap; font-size: 10px;`;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    updateSoldePaginationControls();
}

function setupSoldeTableControls() {
    const firstPageBtn = document.getElementById('solde-first-page-btn');
    const prevPageBtn = document.getElementById('solde-prev-page-btn');
    const nextPageBtn = document.getElementById('solde-next-page-btn');
    const lastPageBtn = document.getElementById('solde-last-page-btn');
    if (firstPageBtn) firstPageBtn.addEventListener('click', () => { currentPageSolde = 1; renderSoldeCurrentPage(); });
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPageSolde > 1) { currentPageSolde--; renderSoldeCurrentPage(); } });
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => { const totalPages = Math.ceil(totalRowsSolde / rowsPerPage); if (currentPageSolde < totalPages) { currentPageSolde++; renderSoldeCurrentPage(); } });
    if (lastPageBtn) lastPageBtn.addEventListener('click', () => { currentPageSolde = Math.ceil(totalRowsSolde / rowsPerPage); renderSoldeCurrentPage(); });
}

function updateSoldePaginationControls() {
    const totalPages = Math.ceil(totalRowsSolde / rowsPerPage);
    const pageInfo = document.querySelector('#solde-controls-div span:nth-child(2)');
    if (pageInfo) pageInfo.innerHTML = `Page <strong>${currentPageSolde}</strong> sur <strong>${totalPages}</strong>`;
    const linesInfo = document.querySelector('#solde-controls-div > div:first-child span');
    if (linesInfo) linesInfo.innerHTML = `Affichage: <strong>${((currentPageSolde - 1) * rowsPerPage + 1).toLocaleString()}</strong> à <strong>${Math.min(currentPageSolde * rowsPerPage, totalRowsSolde).toLocaleString()}</strong> sur <strong>${totalRowsSolde.toLocaleString()}</strong> lignes`;
    const firstPageBtn = document.getElementById('solde-first-page-btn');
    const prevPageBtn = document.getElementById('solde-prev-page-btn');
    const nextPageBtn = document.getElementById('solde-next-page-btn');
    const lastPageBtn = document.getElementById('solde-last-page-btn');
    if (firstPageBtn) firstPageBtn.disabled = currentPageSolde === 1;
    if (prevPageBtn) prevPageBtn.disabled = currentPageSolde === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPageSolde === totalPages;
    if (lastPageBtn) lastPageBtn.disabled = currentPageSolde === totalPages;
}

function updateRechargeTable() {
    const tableContent = document.getElementById('combined-recharge-table-content');
    if (!tableContent) return;
    if (combinedRechargeData.length === 0) {
        tableContent.innerHTML = `<div class="empty-message"><div class="empty-icon">⚡</div><p>Aucune donnée RECHARGE valide trouvée</p></div>`;
        return;
    }
    totalRowsRecharge = combinedRechargeData.length;
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls-div';
    controlsDiv.id = 'recharge-controls-div';
    controlsDiv.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px; flex-wrap: wrap; gap: 10px;`;
    const totalPages = Math.ceil(totalRowsRecharge / rowsPerPage);
    controlsDiv.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 14px; color: #2c3e50;">Affichage: <strong>${((currentPageRecharge - 1) * rowsPerPage + 1).toLocaleString()}</strong> à <strong>${Math.min(currentPageRecharge * rowsPerPage, totalRowsRecharge).toLocaleString()}</strong> sur <strong>${totalRowsRecharge.toLocaleString()}</strong> lignes</span></div><div style="display: flex; align-items: center; gap: 5px;"><button id="recharge-first-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageRecharge === 1 ? 'disabled' : ''}>««</button><button id="recharge-prev-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageRecharge === 1 ? 'disabled' : ''}>«</button><span style="padding: 5px 15px; font-size: 13px; color: #2c3e50;">Page <strong>${currentPageRecharge}</strong> sur <strong>${totalPages}</strong></span><button id="recharge-next-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageRecharge === totalPages ? 'disabled' : ''}>»</button><button id="recharge-last-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageRecharge === totalPages ? 'disabled' : ''}>»»</button></div>`;
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'recharge-table-wrapper';
    tableWrapper.style.cssText = `width: 100%; max-height: 600px; overflow: auto; border: 1px solid #dee2e6; border-radius: 8px; position: relative;`;
    const table = document.createElement('table');
    table.id = 'combined-recharge-data-table';
    table.className = 'combined-data-table';
    table.style.cssText = `width: 100%; border-collapse: collapse; font-size: 11px;`;
    const thead = document.createElement('thead');
    thead.style.cssText = `position: sticky; top: 0; z-index: 10; background: white;`;
    const headerRow = document.createElement('tr');
    const headers = [
        { name: 'Date et Heure', width: '160px', sticky: true },
        { name: 'Code enregistrer', width: '140px' },
        { name: 'Type de code', width: '120px' },
        { name: 'Status', width: '100px' },
        { name: 'Code 1', width: '80px' },
        { name: 'Code 2', width: '80px' },
        { name: 'Code 3', width: '80px' },
        { name: 'Code 4', width: '80px' }
    ];
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header.name;
        th.style.cssText = `padding: 10px 4px; text-align: ${index === 0 ? 'left' : 'center'}; background: ${index === 0 ? '#9b59b6' : '#8e44ad'}; color: white; border: 1px solid #dee2e6; font-weight: 600; white-space: nowrap; ${header.sticky ? 'position: sticky; left: 0; z-index: 11;' : ''} min-width: ${header.width}; font-size: 10.5px;`;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    tableContent.innerHTML = '';
    tableContent.appendChild(controlsDiv);
    tableContent.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    renderRechargeCurrentPage();
    setupRechargeTableControls();
    const footer = document.createElement('div');
    footer.style.cssText = `margin-top: 15px; font-size: 11px; color: #7f8c8d; text-align: center; padding: 10px; border-top: 1px solid #ecf0f1;`;
    footer.innerHTML = `<div>Tableau RECHARGE généré le ${new Date().toLocaleString()}</div>`;
    tableContent.appendChild(footer);
}

function renderRechargeCurrentPage() {
    const table = document.getElementById('combined-recharge-data-table');
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) oldTbody.remove();
    const tbody = document.createElement('tbody');
    const startIndex = (currentPageRecharge - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRowsRecharge);
    for (let i = 0; i < (endIndex - startIndex); i++) {
        const rowIndex = startIndex + i;
        const row = combinedRechargeData[rowIndex];
        if (!row) continue;
        const tr = document.createElement('tr');
        tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
        const tdDate = document.createElement('td');
        tdDate.textContent = row['Date et Heure'] || '-';
        tdDate.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: left; vertical-align: middle; white-space: nowrap; background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'}; position: sticky; left: 0; z-index: 1; font-family: 'Courier New', monospace; font-size: 10px;`;
        tr.appendChild(tdDate);
        const tdCode = document.createElement('td');
        tdCode.textContent = row['Code enregistrer'] || '-';
        tdCode.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: center; vertical-align: middle; white-space: nowrap; font-size: 10px; font-family: 'Courier New', monospace; color: #2980b9;`;
        tr.appendChild(tdCode);
        const tdType = document.createElement('td');
        const typeValue = row['Type de code'] || '-';
        tdType.textContent = typeValue;
        tdType.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: center; vertical-align: middle; white-space: nowrap; font-size: 10px; color: #27ae60; font-weight: ${typeValue !== '-' ? 'bold' : 'normal'};`;
        tr.appendChild(tdType);
        const tdStatus = document.createElement('td');
        const statusValue = row['Status'] || '-';
        tdStatus.textContent = statusValue;
        tdStatus.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: center; vertical-align: middle; white-space: nowrap; font-size: 10px; color: ${statusValue.toLowerCase().includes('reussie') ? '#27ae60' : statusValue.toLowerCase().includes('echoue') ? '#e74c3c' : '#f39c12'}; font-weight: bold;`;
        tr.appendChild(tdStatus);
        for (let j = 1; j <= 4; j++) {
            const codeKey = `Code ${j}`;
            const td = document.createElement('td');
            const value = row[codeKey] || '';
            if (value && value !== '') {
                const numValue = parseFloat(value.replace(',', '.'));
                if (isNaN(numValue)) td.textContent = value;
                else { if (Number.isInteger(numValue)) td.textContent = numValue.toString(); else { const stringValue = value.replace(',', '.'); if (stringValue.includes('.') && stringValue.endsWith('00')) td.textContent = Math.trunc(numValue).toString(); else td.textContent = stringValue.replace(/\.?0+$/, ''); } }
                td.style.color = '#8e44ad'; td.style.fontWeight = 'bold';
            } else { td.textContent = '-'; td.style.color = '#95a5a6'; td.style.fontStyle = 'italic'; }
            td.style.cssText = `padding: 6px 4px; border: 1px solid #dee2e6; text-align: center; vertical-align: middle; white-space: nowrap; font-size: 10px;`;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    updateRechargePaginationControls();
}

function setupRechargeTableControls() {
    const firstPageBtn = document.getElementById('recharge-first-page-btn');
    const prevPageBtn = document.getElementById('recharge-prev-page-btn');
    const nextPageBtn = document.getElementById('recharge-next-page-btn');
    const lastPageBtn = document.getElementById('recharge-last-page-btn');
    if (firstPageBtn) firstPageBtn.addEventListener('click', () => { currentPageRecharge = 1; renderRechargeCurrentPage(); });
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (currentPageRecharge > 1) { currentPageRecharge--; renderRechargeCurrentPage(); } });
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => { const totalPages = Math.ceil(totalRowsRecharge / rowsPerPage); if (currentPageRecharge < totalPages) { currentPageRecharge++; renderRechargeCurrentPage(); } });
    if (lastPageBtn) lastPageBtn.addEventListener('click', () => { currentPageRecharge = Math.ceil(totalRowsRecharge / rowsPerPage); renderRechargeCurrentPage(); });
}

function updateRechargePaginationControls() {
    const totalPages = Math.ceil(totalRowsRecharge / rowsPerPage);
    const pageInfo = document.querySelector('#recharge-controls-div span:nth-child(2)');
    if (pageInfo) pageInfo.innerHTML = `Page <strong>${currentPageRecharge}</strong> sur <strong>${totalPages}</strong>`;
    const linesInfo = document.querySelector('#recharge-controls-div > div:first-child span');
    if (linesInfo) linesInfo.innerHTML = `Affichage: <strong>${((currentPageRecharge - 1) * rowsPerPage + 1).toLocaleString()}</strong> à <strong>${Math.min(currentPageRecharge * rowsPerPage, totalRowsRecharge).toLocaleString()}</strong> sur <strong>${totalRowsRecharge.toLocaleString()}</strong> lignes`;
    const firstPageBtn = document.getElementById('recharge-first-page-btn');
    const prevPageBtn = document.getElementById('recharge-prev-page-btn');
    const nextPageBtn = document.getElementById('recharge-next-page-btn');
    const lastPageBtn = document.getElementById('recharge-last-page-btn');
    if (firstPageBtn) firstPageBtn.disabled = currentPageRecharge === 1;
    if (prevPageBtn) prevPageBtn.disabled = currentPageRecharge === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPageRecharge === totalPages;
    if (lastPageBtn) lastPageBtn.disabled = currentPageRecharge === totalPages;
}

// ==================== ÉCRAN DE CHARGEMENT ====================

function showLoadingScreen() {
    const mainElement = document.querySelector('.analyze-main');
    mainElement.querySelectorAll('.main-tabs-container').forEach(el => el.style.display = 'none');
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.style.cssText = `position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255, 255, 255, 0.95); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1000;`;
    loadingScreen.innerHTML = `
        <div style="text-align: center; max-width: 600px; padding: 40px;">
            <div class="loading-spinner-large"><div class="spinner"></div></div>
            <h2 style="color: #2c3e50; margin-top: 30px; margin-bottom: 20px;">📊 Analyse en cours...</h2>
            <p style="color: #7f8c8d; font-size: 16px; margin-bottom: 10px;">Chargement et analyse des fichiers du dossier</p>
            <p id="loading-folder-name" style="color: #3498db; font-weight: bold; font-size: 18px; margin-bottom: 30px;">${escapeHtml(currentFolder.name)}</p>
            <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin-bottom: 20px; width: 100%;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;"><span style="color: #2c3e50; font-size: 14px;">Progression</span><span id="loading-percentage" style="color: #3498db; font-weight: bold; font-size: 14px;">0%</span></div>
                <div style="background: #e9ecef; height: 10px; border-radius: 5px; overflow: hidden;"><div id="loading-progress-bar" style="height: 100%; background: linear-gradient(90deg, #3498db, #2ecc71); width: 0%; transition: width 0.3s ease;"></div></div>
                <div id="loading-status" style="color: #7f8c8d; font-size: 13px; margin-top: 10px; text-align: center;">Initialisation...</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px; width: 100%;">
                <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; text-align: center;"><div style="font-size: 24px; color: #2980b9; font-weight: bold;" id="loaded-files-count">0</div><div style="font-size: 12px; color: #7f8c8d;">Fichiers chargés</div></div>
                <div style="background: #f0f8f0; padding: 15px; border-radius: 8px; text-align: center;"><div style="font-size: 24px; color: #27ae60; font-weight: bold;" id="total-files-count">0</div><div style="font-size: 12px; color: #7f8c8d;">Fichiers au total</div></div>
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
        const progress = totalFilesToLoad > 0 ? Math.round((loadedFilesCount / totalFilesToLoad) * 100) : 0;
        progressBar.style.width = progress + '%';
        percentage.textContent = progress + '%';
        loadedCount.textContent = loadedFilesCount;
        totalCount.textContent = totalFilesToLoad;
        status.textContent = loadedFilesCount < totalFilesToLoad ? `Chargement du fichier ${loadedFilesCount + 1} sur ${totalFilesToLoad}...` : 'Analyse des données et création des tableaux...';
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
            mainElement.querySelectorAll('.main-tabs-container').forEach(el => el.style.display = '');
        }, 500);
    }
}

function setupEventListeners() {
    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.addEventListener('click', () => { sessionStorage.removeItem('analyzeFolder'); window.location.href = 'folderUpload.html'; });
}

// ==================== INITIALISATION ====================

document.addEventListener('DOMContentLoaded', function() { initializeAnalyzePage(); });

async function initializeAnalyzePage() {
    const folderJSON = sessionStorage.getItem('analyzeFolder');
    if (!folderJSON) { showError('Aucun dossier sélectionné. Veuillez retourner et sélectionner un dossier.'); return; }
    try {
        currentFolder = JSON.parse(folderJSON);
        folderStructure = currentFolder.structure;
        displayFolderInfo();
        energyData = []; tensionData = []; eventData = []; soldeData = []; rechargeData = [];
        combinedEnergyData = []; combinedTensionData = []; combinedEventData = []; combinedSoldeData = []; combinedRechargeData = [];
        filteredEnergyData = []; filteredTensionData = [];
        currentPageEnergy = 1; currentPageTension = 1; currentPageEvent = 1; currentPageSolde = 1; currentPageRecharge = 1;
        loadedFilesCount = 0; filterStartDate = null; filterEndDate = null; filterPeriod = 'all'; filterMonth = null; filterYear = null;
        totalFilesToLoad = countTotalFiles(folderStructure);
        showLoadingScreen();
        createMainTabs();
        createCombinedTables();
        setupEventListeners();
        await loadFilesContent();
        setTimeout(() => {
            hideLoadingScreen();
            setTimeout(() => {
                createFilterControls(); // CARD 1
                createTechnicalDataCard(); // CARD 2
                if (document.getElementById('main-tab-content-technique')?.classList.contains('active')) {
                    setTimeout(() => { displayTensionStabilityAnalysis(); displayEnergyAnalysis(); }, 300);
                } else if (document.getElementById('main-tab-content-commerciale')?.classList.contains('active')) { displayCommercialAnalysis(); }
                else if (document.getElementById('main-tab-content-evenement')?.classList.contains('active')) { displayEventAnalysis(); }
            }, 300);
        }, 500);
    } catch (error) { console.error('❌ Erreur:', error); showError('Erreur lors du chargement du dossier: ' + error.message); hideLoadingScreen(); }
}

function countTotalFiles(structure) {
    let count = 0;
    if (structure.files && structure.files.length > 0) count += structure.files.length;
    if (structure.subdirs && structure.subdirs.length > 0) structure.subdirs.forEach(subdir => { count += countTotalFiles(subdir); });
    return count;
}

function displayFolderInfo() {
    const titleEl = document.getElementById('folder-title');
    const subtitleEl = document.getElementById('folder-info-subtitle');
    
    // Plus besoin d'ajouter des classes, tout est déjà dans le HTML
    titleEl.textContent = '📂 Relèves-' + escapeHtml(currentFolder.name);
    subtitleEl.textContent = 'Créé le ' + currentFolder.date;
    
    // Le badge est déjà dans le HTML, pas besoin de l'ajouter
}

// ==================== CRÉATION DES ONGLETS PRINCIPAUX ====================
function createMainTabs() {
    const mainElement = document.querySelector('.analyze-main');
    const mainTabsContainer = document.createElement('div');
    mainTabsContainer.className = 'main-tabs-container';
    mainTabsContainer.style.cssText = `background: white; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden;`;
    
    // Onglets principaux (TECHNIQUE, COMMERCIALE et FRAUDE)
    const mainTabsHeader = document.createElement('div');
    mainTabsHeader.className = 'main-tabs-header';
    mainTabsHeader.style.cssText = `display: flex; background: #f8f9fa; border-bottom: 2px solid #e9ecef; padding: 0;`;
    
    // Onglet TECHNIQUE
    const techniqueTab = document.createElement('button');
    techniqueTab.id = 'main-tab-technique';
    techniqueTab.className = 'main-tab-btn active';
    techniqueTab.style.cssText = `flex: 1; padding: 18px 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 10px;`;
    techniqueTab.innerHTML = '🔧 TECHNIQUE';
    techniqueTab.addEventListener('click', () => showMainTab('technique'));
    
    // Onglet COMMERCIALE
    const commercialeTab = document.createElement('button');
    commercialeTab.id = 'main-tab-commerciale';
    commercialeTab.className = 'main-tab-btn';
    commercialeTab.style.cssText = `flex: 1; padding: 18px 25px; background: #e9ecef; color: #6c757d; border: none; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 10px;`;
    commercialeTab.innerHTML = '💰 COMMERCIALE';
    commercialeTab.addEventListener('click', () => showMainTab('commerciale'));
    
    // ✅ NOUVEL ONGLET FRAUDE
    const fraudeTab = document.createElement('button');
    fraudeTab.id = 'main-tab-fraude';
    fraudeTab.className = 'main-tab-btn';
    fraudeTab.style.cssText = `flex: 1; padding: 18px 25px; background: #e9ecef; color: #6c757d; border: none; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 10px;`;
    fraudeTab.innerHTML = '🔍 FRAUDE';
    fraudeTab.addEventListener('click', () => showMainTab('fraude'));
    
    mainTabsHeader.appendChild(techniqueTab);
    mainTabsHeader.appendChild(commercialeTab);
    mainTabsHeader.appendChild(fraudeTab);
    mainTabsContainer.appendChild(mainTabsHeader);
    
    // Contenu des onglets
    const mainTabsContent = document.createElement('div');
    mainTabsContent.className = 'main-tabs-content';
    mainTabsContent.style.cssText = `padding: 0;`;
    
    // Contenu TECHNIQUE
    const techniqueContent = document.createElement('div');
    techniqueContent.id = 'main-tab-content-technique';
    techniqueContent.className = 'main-tab-content active';
    techniqueContent.style.cssText = `padding: 0; display: block;`;
    
    // Contenu COMMERCIALE
    const commercialeContent = document.createElement('div');
    commercialeContent.id = 'main-tab-content-commerciale';
    commercialeContent.className = 'main-tab-content';
    commercialeContent.style.cssText = `padding: 0; display: none;`;
    
    // ✅ NOUVEAU CONTENU FRAUDE
    const fraudeContent = document.createElement('div');
    fraudeContent.id = 'main-tab-content-fraude';
    fraudeContent.className = 'main-tab-content';
    fraudeContent.style.cssText = `padding: 0; display: none;`;
    
    mainTabsContent.appendChild(techniqueContent);
    mainTabsContent.appendChild(commercialeContent);
    mainTabsContent.appendChild(fraudeContent);
    mainTabsContainer.appendChild(mainTabsContent);
    
    // Supprimer l'ancien conteneur d'onglets s'il existe
    const existingTabsContainer = document.querySelector('.tabs-container');
    if (existingTabsContainer) existingTabsContainer.remove();
    
    mainElement.appendChild(mainTabsContainer);
}

function showMainTab(tabName) {
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.id === `main-tab-${tabName}`) {
            btn.style.background = getTabGradient(tabName);
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
            displayTensionStabilityAnalysis();
            displayEnergyAnalysis();
        } else if (tabName === 'commerciale') {
            createClientSubTabs();
            setTimeout(() => {
                const activeClients = detectActiveClients();
                if (activeClients.length > 0) {
                    showClientTab(activeClients[0]);
                }
            }, 100);
        } else if (tabName === 'fraude') {
            displayFraudeAnalysis();
        }
    }
}

function getTabGradient(tabName) {
    switch(tabName) {
        case 'technique': return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        case 'commerciale': return 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
        case 'fraude': return 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)';
        default: return '#e9ecef';
    }
}

function displayCommercialEventsAnalysis() {
    const eventContent = document.getElementById('commercial-events-content');
    if (!eventContent) return;
    
    eventContent.innerHTML = '';
    
    if (combinedEventData.length === 0) {
        eventContent.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                <h3 style="margin: 0 0 10px 0; color: #1e293b;">Aucun événement trouvé</h3>
                <p style="color: #64748b; margin: 0;">Aucun événement n'a été détecté dans les données analysées.</p>
            </div>
        `;
        return;
    }
    
    // Afficher la carte de synthèse
    const summaryCard = createEventSummaryCard();
    eventContent.appendChild(summaryCard);
    
    // Afficher les statistiques
    const dailyEvents = analyzeEventsByDay();
    const statsSection = addEventStatisticsSummary(dailyEvents);
    eventContent.appendChild(statsSection);
    
    // Afficher la répartition par type
    const typeSummary = addEventTypeSummary(dailyEvents);
    eventContent.appendChild(typeSummary);
    
    // Afficher le tableau détaillé
    const tableWrapper = document.createElement('div');
    tableWrapper.style.cssText = `
        margin-top: 20px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
    `;
    
    const tableHeader = document.createElement('div');
    tableHeader.style.cssText = `
        background: #f1f5f9;
        padding: 10px 15px;
        font-weight: 600;
        color: #334155;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e2e8f0;
    `;
    tableHeader.innerHTML = `
        <span>📋 Tableau détaillé des événements</span>
        <span style="font-size: 11px; color: #64748b;">${dailyEvents.length} entrée(s)</span>
    `;
    
    const mainTable = createMainEventsTable(dailyEvents);
    tableWrapper.appendChild(tableHeader);
    tableWrapper.appendChild(mainTable);
    eventContent.appendChild(tableWrapper);
}

function getTabGradient(tabName) {
    switch(tabName) {
        case 'technique': return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        case 'commerciale': return 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
        case 'evenement': return 'linear-gradient(135deg, #f39c12 0%, #d35400 100%)';
        default: return '#e9ecef';
    }
}

function generateCommercialSummary(clientNumber) {
    const energyKey = `Energie${clientNumber}`;
    const creditKey = `Credit${clientNumber}`;
    
    // Récupérer le forfait du client en PREMIER
    const rechargeAnalysis = analyzeRechargeData(clientNumber);
    const currentForfait = rechargeAnalysis.currentCode4Name || 'ECO';
    const forfaitLimits = getForfaitLimits(currentForfait);
    const forfaitMax = forfaitLimits.max || 500;
    
    // Maintenant on peut utiliser forfaitMax
    const overQuotaData = getOverQuotaDays(clientNumber, forfaitMax);
    const daysOverQuotaList = overQuotaData.days;
    const maxOverQuota = overQuotaData.maxOverQuota;
    const avgOverQuota = overQuotaData.avgOverQuota;
    
    // ===== 1. ANALYSE DE LA CONSOMMATION =====
    let totalDays = 0;
    let maxConsumption = 0;
    let daysAbove70Percent = 0;
    let daysAbove90Percent = 0;
    let daysOverQuota = 0;
    let maxEnergyDate = '';
    
    // Analyser les données d'énergie - Par JOUR (pas par ligne)
    const consumptionByDay = {}; // Stocker la conso max par jour
    const allDates = new Set();
    
    if (combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            if (!row['Date et Heure']) return;
            const date = row['Date et Heure'].split(' ')[0];
            allDates.add(date);
            
            const value = row[energyKey];
            if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                const energyValue = parseFloat(value.toString().replace(',', '.'));
                if (!isNaN(energyValue) && energyValue > 0) {
                    if (!consumptionByDay[date] || energyValue > consumptionByDay[date]) {
                        consumptionByDay[date] = energyValue;
                    }
                    
                    // Mettre à jour le max et sa date
                    if (energyValue > maxConsumption) {
                        maxConsumption = energyValue;
                        maxEnergyDate = date; // Stocker la date du max
                    }
                }
            }
        });
    }
    
    // Formater la date pour l'affichage
    const formattedMaxEnergyDate = maxEnergyDate ? new Date(maxEnergyDate.split('/').reverse().join('-')).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }) : 'N/A';
    
    totalDays = allDates.size;
    const totalDaysWithConsumption = Object.keys(consumptionByDay).length;
    
    // Calculer la consommation totale (somme des max par jour)
    const totalConsumption = Object.values(consumptionByDay).reduce((sum, val) => sum + val, 0);
    
    // Calculer les métriques basées sur les JOURS
    Object.values(consumptionByDay).forEach(energyValue => {
        if (energyValue > forfaitMax) {
            daysOverQuota++;
        }
        
        const percentOfForfait = (energyValue / forfaitMax) * 100;
        if (percentOfForfait > 70) daysAbove70Percent++;
        if (percentOfForfait > 90) daysAbove90Percent++;
    });
    
    const percentActive = totalDays > 0 ? Math.round((totalDaysWithConsumption / totalDays) * 100) : 0;
    const avgConsumption = totalDaysWithConsumption > 0 ? 
        Math.round(totalConsumption / totalDaysWithConsumption) : 0;
    const percentOfForfait = forfaitMax > 0 ? 
        Math.round((avgConsumption / forfaitMax) * 100) : 0;
    
    // Calcul correct du pourcentage de dépassement
    const percentDaysOverQuota = totalDaysWithConsumption > 0 ? 
        Math.round((daysOverQuota / totalDaysWithConsumption) * 100) : 0;
    
    // ===== 2. ANALYSE DU CRÉDIT =====
    let zeroCreditDays = 0;
    let creditDays = 0;
    let totalCredit = 0;
    let creditStatus = 'excellent';
    let creditColor = '#22c55e';
    let avgCredit = 0;
    let creditText = '';

    if (combinedSoldeData.length > 0) {
        // Analyser par JOUR UNIQUE pour le crédit
        const creditByDay = {}; // Un objet pour stocker UNE valeur par jour
        const allCreditDates = new Set(); // Pour compter les jours uniques
        
        combinedSoldeData.forEach(row => {
            if (!row['Date et Heure']) return;
            const date = row['Date et Heure'].split(' ')[0];
            allCreditDates.add(date); // Ajouter la date au Set
            
            const value = row[creditKey];
            if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                const creditValue = parseFloat(value.toString().replace(',', '.'));
                if (!isNaN(creditValue)) {
                    // Pour chaque jour, on garde la dernière valeur (ou la plus récente)
                    // Si plusieurs relevés dans la même journée, on prend le dernier
                    creditByDay[date] = creditValue;
                }
            }
        });
        
        // ✅ ICI : creditDays = nombre de JOURS UNIQUES avec données
        creditDays = allCreditDates.size;
        
        // Calculer les statistiques sur les jours uniques
        Object.values(creditByDay).forEach(creditValue => {
            totalCredit += creditValue;
            if (creditValue === 0) {
                zeroCreditDays++;
            }
        });
        
        if (creditDays > 0) {
            avgCredit = Math.round(totalCredit / creditDays);
            const zeroPercent = Math.round((zeroCreditDays / creditDays) * 100);
            
            if (zeroPercent === 0) {
                creditStatus = 'excellent';
                creditColor = '#22c55e';
                creditText = `${avgCredit} jours en moyenne, aucun jour sans crédit`;
            } else if (zeroPercent < 10) {
                creditStatus = 'bon';
                creditColor = '#3b82f6';
                creditText = `${avgCredit} jours en moyenne, ${zeroPercent}% de jours sans crédit`;
            } else if (zeroPercent < 20) {
                creditStatus = 'moyen';
                creditColor = '#f59e0b';
                creditText = `${zeroPercent}% des jours sans crédit`;
            } else {
                creditStatus = 'fragile';
                creditColor = '#ef4444';
                creditText = `${zeroPercent}% des jours sans crédit - risque d'interruption`;
            }
        }
    }
    
    // ===== 3. ANALYSE DES ÉVÉNEMENTS =====
    let hasSuspensions = false;
    let hasSurcharge = false;
    let eventsText = '';
    
    if (combinedEventData.length > 0) {
        const clientEvents = combinedEventData.filter(row => {
            const code1 = row['Code 1'] || '';
            return code1.toString().trim() === clientNumber.toString();
        });
        
        hasSuspensions = clientEvents.some(row => {
            const event = row['Évènements'] || '';
            return event.includes('SuspendP') || event.includes('SuspendE');
        });
        
        hasSurcharge = clientEvents.some(row => {
            const event = row['Évènements'] || '';
            return event.includes('Surcharge');
        });
        
        if (hasSuspensions) eventsText = 'A subi des coupures de service';
        else if (hasSurcharge) eventsText = 'Surcharges détectées';
        else eventsText = 'Aucun événement particulier détecté';
    }
    
    // ===== 4. ANALYSE DE LA TENDANCE RÉCENTE (7 derniers jours) =====
    const last7Days = [];
    const allDatesArray = Array.from(allDates).sort((a, b) => {
        const [da, ma, ya] = a.split('/');
        const [db, mb, yb] = b.split('/');
        return new Date(ya, ma-1, da) - new Date(yb, mb-1, db);
    });
    
    const last7Dates = allDatesArray.slice(-7);
    
    last7Dates.forEach(date => {
        const energyValue = consumptionByDay[date] || 0;
        let status = 'inactif';
        
        if (energyValue > 0) {
            status = energyValue > forfaitMax * 0.8 ? 'critique' : 'normal';
        }
        
        last7Days.push({
            date,
            value: energyValue,
            status
        });
    });
}
function getOverQuotaDays(clientNumber, forfaitMax) {
    const energyKey = `Energie${clientNumber}`;
    const overQuotaDays = [];
    let maxOverQuota = 0;
    let totalOverQuota = 0;
    
    if (combinedEnergyData.length > 0) {
        // Utiliser un objet pour ne garder que le max par jour
        const dailyMax = {};
        
        combinedEnergyData.forEach(row => {
            if (!row['Date et Heure']) return;
            const date = row['Date et Heure'].split(' ')[0];
            const value = row[energyKey];
            
            if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                const energyValue = parseFloat(value.toString().replace(',', '.'));
                if (!isNaN(energyValue) && energyValue > forfaitMax) {
                    // Garder la valeur max pour chaque jour
                    if (!dailyMax[date] || energyValue > dailyMax[date]) {
                        dailyMax[date] = energyValue;
                    }
                }
            }
        });
        
        // Convertir en tableau et trier
        Object.entries(dailyMax).forEach(([date, value]) => {
            const percent = Math.round((value / forfaitMax) * 100);
            overQuotaDays.push({
                date: new Date(date.split('/').reverse().join('-')).toLocaleDateString('fr-FR'),
                consumption: value,
                percent: percent
            });
            
            if (value > maxOverQuota) maxOverQuota = value;
            totalOverQuota += value;
        });
        
        // Trier par date (plus récent en premier)
        overQuotaDays.sort((a, b) => new Date(b.date.split('/').reverse().join('-')) - new Date(a.date.split('/').reverse().join('-')));
    }
    
    return {
        days: overQuotaDays,
        maxOverQuota: maxOverQuota,
        avgOverQuota: overQuotaDays.length > 0 ? Math.round(totalOverQuota / overQuotaDays.length) : 0
    };
}
// Fonction pour calculer la plus longue période sans activité
function calculateLongestInactiveStreak(clientNumber) {
    const energyKey = `Energie${clientNumber}`;
    const activeDays = new Set();
    const allDates = [];
    
    if (combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            if (!row['Date et Heure']) return;
            const date = row['Date et Heure'].split(' ')[0];
            allDates.push(date);
            
            const value = row[energyKey];
            if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                const energyValue = parseFloat(value.toString().replace(',', '.'));
                if (!isNaN(energyValue) && energyValue > 0) {
                    activeDays.add(date);
                }
            }
        });
    }
    
    // Trier les dates
    const sortedDates = [...new Set(allDates)].sort((a, b) => {
        const [da, ma, ya] = a.split('/');
        const [db, mb, yb] = b.split('/');
        return new Date(ya, ma-1, da) - new Date(yb, mb-1, db);
    });
    
    let longestStreak = 0;
    let currentStreak = 0;
    
    sortedDates.forEach(date => {
        if (!activeDays.has(date)) {
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });
    
    return longestStreak;
}

// Fonction pour déterminer le rythme d'utilisation
function calculateUsageFrequency(clientNumber, activeDays, totalDays) {
    if (totalDays === 0) return 'Non défini';
    
    const ratio = activeDays / totalDays;
    
    if (ratio >= 0.8) return 'Quotidien';
    if (ratio >= 0.5) return 'Régulier (3-4j/semaine)';
    if (ratio >= 0.2) return 'Occasionnel (1-2j/semaine)';
    return 'Sporadique';
}
// Fonction utilitaire pour calculer la moyenne de consommation du NR
function calculateAverageNRConsumption() {
    let totalAvg = 0;
    let clientCount = 0;
    
    Object.keys(allResultsByClient || {}).forEach(clientId => {
        const clientData = allResultsByClient[clientId];
        if (clientData && clientData.energyDailyData && clientData.energyDailyData.length > 0) {
            const clientAvg = clientData.energyDailyData.reduce((sum, day) => sum + (day.energieMax || 0), 0) / clientData.energyDailyData.length;
            totalAvg += clientAvg;
            clientCount++;
        }
    });
    
    return clientCount > 0 ? Math.round(totalAvg / clientCount) : 0;
}

function createClientSubTabs() {
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    if (!commercialeContent) return;
    
    // Vider le contenu existant
    commercialeContent.innerHTML = '';
    
    // Créer le conteneur des sous-onglets
    const subTabsContainer = document.createElement('div');
    subTabsContainer.className = 'client-sub-tabs-container';
    subTabsContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        margin-bottom: 20px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        overflow: hidden;
    `;
    
    // En-tête des sous-onglets
    const subTabsHeader = document.createElement('div');
    subTabsHeader.className = 'client-sub-tabs-header';
    subTabsHeader.style.cssText = `
        display: flex;
        background: #f8fafc;
        border-bottom: 2px solid #e2e8f0;
        padding: 0;
        overflow-x: auto;
    `;
    
    // Déterminer quels clients ont des données
    const activeClients = detectActiveClients();
    
    // ✅ SUPPRIMER LE BOUTON "Tous les clients"
    // Ne plus ajouter le bouton "Tous les clients"
    
    // Boutons pour chaque client actif
    for (let i = 1; i <= 6; i++) {
        if (activeClients.includes(i)) {
            const clientTab = document.createElement('button');
            clientTab.id = `client-tab-${i}`;
            clientTab.className = 'client-sub-tab';
            clientTab.dataset.client = i;
            clientTab.style.cssText = `
                padding: 12px 25px;
                background: #e9ecef;
                color: #4a5568;
                border: none;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                min-width: 100px;
            `;
            clientTab.innerHTML = `<span>👤</span> Client ${i}`;
            clientTab.addEventListener('click', () => showClientTab(i));
            subTabsHeader.appendChild(clientTab);
        }
    }
    
    // Si aucun client actif, ajouter un message
    if (activeClients.length === 0) {
        const noClientMsg = document.createElement('div');
        noClientMsg.style.cssText = `
            padding: 12px 25px;
            color: #94a3b8;
            font-style: italic;
            width: 100%;
            text-align: center;
        `;
        noClientMsg.textContent = 'Aucun client avec données disponibles';
        subTabsHeader.appendChild(noClientMsg);
    }
    
    subTabsContainer.appendChild(subTabsHeader);
    
    // Contenu des sous-onglets
    const subTabsContent = document.createElement('div');
    subTabsContent.id = 'client-sub-tabs-content';
    subTabsContent.className = 'client-sub-tabs-content';
    subTabsContent.style.cssText = `padding: 20px;`;
    
    subTabsContainer.appendChild(subTabsContent);
    commercialeContent.appendChild(subTabsContainer);
    
    // ✅ NE PAS APPELER showClientTab() ICI
    // La sélection se fera depuis showMainTab() avec un délai
}
function detectActiveClients() {
    const activeClients = [];
    
    // Vérifier dans les données d'énergie
    if (combinedEnergyData.length > 0) {
        for (let i = 1; i <= 6; i++) {
            const energyKey = `Energie${i}`;
            let hasData = false;
            
            // Vérifier les 100 premières lignes
            for (let j = 0; j < Math.min(100, combinedEnergyData.length); j++) {
                const value = combinedEnergyData[j][energyKey];
                if (value && value.toString().trim() !== '' && 
                    value.toString().trim() !== '0' && value.toString().trim() !== '-') {
                    hasData = true;
                    break;
                }
            }
            
            if (hasData && !activeClients.includes(i)) {
                activeClients.push(i);
            }
        }
    }
    
    // Vérifier dans les données de solde
    if (combinedSoldeData.length > 0) {
        for (let i = 1; i <= 6; i++) {
            const creditKey = `Credit${i}`;
            let hasData = false;
            
            for (let j = 0; j < Math.min(100, combinedSoldeData.length); j++) {
                const value = combinedSoldeData[j][creditKey];
                if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                    hasData = true;
                    break;
                }
            }
            
            if (hasData && !activeClients.includes(i)) {
                activeClients.push(i);
            }
        }
    }
    
    return activeClients.sort((a, b) => a - b);
}
function showClientTab(clientNumber) {
    // Mettre à jour les boutons
    document.querySelectorAll('.client-sub-tab').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.client === String(clientNumber)) {
            btn.style.background = 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)';
            btn.style.color = 'white';
        } else {
            btn.style.background = '#e9ecef';
            btn.style.color = '#4a5568';
        }
    });
    
    const contentDiv = document.getElementById('client-sub-tabs-content');
    contentDiv.innerHTML = '';
    
    // Afficher les analyses pour un client spécifique (toujours clientNumber est un nombre)
    displayClientCommercialAnalysis(contentDiv, parseInt(clientNumber));
}
function displayClientCommercialAnalysis(container, clientNumber) {
    // En-tête avec informations du client
    const clientHeader = document.createElement('div');
    clientHeader.style.cssText = `
        background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
        color: white;
        padding: 20px 25px;
        border-radius: 12px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 20px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    `;
    
    // Récupérer le forfait actuel du client
    const rechargeAnalysis = analyzeRechargeData(clientNumber);
    const currentForfait = rechargeAnalysis.currentCode4Name || 'ECO';
    const forfaitLimits = getForfaitLimits(currentForfait);
    const forfaitMax = forfaitLimits.max || 50;
    
    // Déterminer si le client est actif
    let isActive = false;
    if (combinedEnergyData && combinedEnergyData.length > 0) {
        const energyKey = `Energie${clientNumber}`;
        for (let i = 0; i < Math.min(50, combinedEnergyData.length); i++) {
            const value = combinedEnergyData[i][energyKey];
            if (value && parseFloat(value) > 0) {
                isActive = true;
                break;
            }
        }
    }
    
    clientHeader.innerHTML = `
        <div style="width: 60px; height: 60px; background: white; border-radius: 30px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 30px;">👤</span>
        </div>
        <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <h2 style="margin: 0; font-size: 24px; font-weight: 700;">Client ${clientNumber}</h2>
                <span style="background: ${isActive ? '#22c55e' : '#94a3b8'}; padding: 4px 15px; border-radius: 30px; font-size: 14px; font-weight: 600;">
                    ${isActive ? 'Actif' : 'Inactif'}
                </span>
                <span style="background: rgba(255,255,255,0.2); padding: 4px 15px; border-radius: 30px; font-size: 14px;">
                    ${currentForfait} · ${forfaitMax}Wh
                </span>
            </div>
        </div>
    `;
    container.appendChild(clientHeader);
    
    // ===== CONSTRUIRE L'HISTORIQUE DES FORFAITS AVEC ANALYSE =====
    const forfaitHistory = [];
    const energyKey = `Energie${clientNumber}`;
    
    // 1. Récupérer l'historique des forfaits depuis les recharges
    if (combinedRechargeData && combinedRechargeData.length > 0) {
        const clientRecharges = combinedRechargeData
            .filter(row => row['Code 1']?.toString().trim() === clientNumber.toString())
            .sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
        
        clientRecharges.forEach((recharge, index) => {
            const date = new Date(recharge['Date et Heure']);
            const code4 = parseInt(recharge['Code 4']);
            const forfaitName = getForfaitName(code4);
            
            if (index === 0) {
                // Premier forfait
                forfaitHistory.push({
                    forfait: forfaitName,
                    code: code4,
                    startDate: date,
                    endDate: null,
                    isCurrent: true
                });
            } else if (code4 !== parseInt(clientRecharges[index-1]['Code 4'])) {
                // Changement de forfait
                forfaitHistory[forfaitHistory.length - 1].endDate = date;
                forfaitHistory[forfaitHistory.length - 1].isCurrent = false;
                
                forfaitHistory.push({
                    forfait: forfaitName,
                    code: code4,
                    startDate: date,
                    endDate: null,
                    isCurrent: true
                });
            }
        });
    }
    
    // Si pas d'historique, créer un forfait par défaut
    if (forfaitHistory.length === 0) {
        let oldestDate = new Date();
        if (combinedEnergyData && combinedEnergyData.length > 0) {
            combinedEnergyData.forEach(row => {
                if (row['Date et Heure']) {
                    const date = new Date(row['Date et Heure']);
                    if (date < oldestDate) oldestDate = date;
                }
            });
        }
        
        forfaitHistory.push({
            forfait: 'ECO',
            code: 1,
            startDate: oldestDate,
            endDate: null,
            isCurrent: true
        });
    }
    
    // 2. Analyser les jours pour chaque forfait
    const consumptionByDay = {};
    
    if (combinedEnergyData && combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            if (!row['Date et Heure']) return;
            
            const dateTime = new Date(row['Date et Heure']);
            const dateStr = dateTime.toISOString().split('T')[0];
            const value = parseFloat(row[energyKey]) || 0;
            
            if (!consumptionByDay[dateStr]) {
                consumptionByDay[dateStr] = {
                    date: dateStr,
                    dateObj: dateTime,
                    total: 0,
                    hasData: false
                };
            }
            
            if (value > 0) {
                consumptionByDay[dateStr].total = Math.max(consumptionByDay[dateStr].total, value);
                consumptionByDay[dateStr].hasData = true;
            }
        });
    }
    
    // 3. Récupérer les événements SuspendE pour ce client
    const suspendEDates = new Set();
    if (combinedEventData && combinedEventData.length > 0) {
        combinedEventData.forEach(row => {
            if (!row['Date et Heure'] || !row['Évènements']) return;
            
            const event = row['Évènements'].trim();
            const code1 = row['Code 1']?.toString().trim() || '';
            
            if (event.includes('SuspendE') && code1.slice(-1) === clientNumber.toString()) {
                const eventDate = new Date(row['Date et Heure']).toISOString().split('T')[0];
                suspendEDates.add(eventDate);
            }
        });
    }
    
    // 4. Calculer les statistiques pour chaque forfait
    const forfaitStats = [];
    
    forfaitHistory.sort((a, b) => a.startDate - b.startDate);
    
    forfaitHistory.forEach((forfait, index) => {
        // Filtrer les jours dans la période du forfait
        const daysInPeriod = [];
        
        Object.values(consumptionByDay).forEach(day => {
            const dayDate = day.dateObj;
            let inPeriod = false;
            
            if (forfait.endDate) {
                if (dayDate >= forfait.startDate && dayDate <= forfait.endDate) {
                    inPeriod = true;
                }
            } else {
                if (dayDate >= forfait.startDate) {
                    inPeriod = true;
                }
            }
            
            if (inPeriod) {
                daysInPeriod.push(day);
            }
        });
        
        const totalDays = daysInPeriod.length;
        const daysWithConsumption = daysInPeriod.filter(day => day.total > 0).length;
        const daysWithoutConsumption = totalDays - daysWithConsumption;
        
        // Calculer l'énergie max et moyenne
        let maxEnergy = 0;
        let totalEnergy = 0;
        let maxEnergyDate = null;
        
        daysInPeriod.forEach(day => {
            if (day.total > maxEnergy) {
                maxEnergy = day.total;
                maxEnergyDate = day.dateObj;
            }
            totalEnergy += day.total;
        });
        
        const avgEnergy = daysWithConsumption > 0 ? (totalEnergy / daysWithConsumption).toFixed(1) : 0;
        
        // Calculer la répartition par seuils
        const baseMax = getForfaitLimits(forfait.forfait).max || 90;
        const seuil85 = baseMax * 0.85;
        const maxWithTolerance = baseMax * 1.15;
        
        const daysWithConsumptionOnly = daysInPeriod.filter(day => day.total > 0);
        
        // Jours hors tolérance = jours avec SuspendE dans cette période
        const daysAbove115 = daysWithConsumptionOnly.filter(day => 
            suspendEDates.has(day.date)
        ).length;
        
        const daysBelow85 = daysWithConsumptionOnly.filter(day => 
            day.total <= seuil85 && !suspendEDates.has(day.date)
        ).length;
        
        const daysInTolerance = daysWithConsumptionOnly.filter(day => 
            day.total > seuil85 && day.total <= maxWithTolerance && !suspendEDates.has(day.date)
        ).length;
        
        const percentBelow85 = daysWithConsumptionOnly.length > 0 ? 
            ((daysBelow85 / daysWithConsumptionOnly.length) * 100).toFixed(1) : 0;
        const percentInTolerance = daysWithConsumptionOnly.length > 0 ? 
            ((daysInTolerance / daysWithConsumptionOnly.length) * 100).toFixed(1) : 0;
        const percentAbove115 = daysWithConsumptionOnly.length > 0 ? 
            ((daysAbove115 / daysWithConsumptionOnly.length) * 100).toFixed(1) : 0;
        
        forfaitStats.push({
            ...forfait,
            totalDays,
            daysWithConsumption,
            daysWithoutConsumption,
            maxEnergy: maxEnergy.toFixed(1),
            maxEnergyDate: maxEnergyDate ? maxEnergyDate.toLocaleDateString('fr-FR') : '-',
            avgEnergy,
            // Données pour la barre de progression
            daysBelow85,
            daysInTolerance,
            daysAbove115,
            percentBelow85,
            percentInTolerance,
            percentAbove115,
            baseMax,
            maxWithTolerance,
            seuil85,
            daysWithConsumptionOnly: daysWithConsumptionOnly.length
        });
    });
    
    // 5. Afficher l'historique enrichi avec les barres de progression
    if (forfaitStats.length > 0) {
        const historyCard = document.createElement('div');
        historyCard.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 25px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        `;
        
        historyCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 20px; color: white;">📋</span>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">Historique des forfaits et consommation</h3>
                    <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${forfaitStats.length} forfait(s) · Analyse détaillée par période</p>
                </div>
            </div>
            
            <div style="overflow-x: auto; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1200px;">
                    <thead style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <tr>
                            <th style="padding: 12px 15px; text-align: left; color: #475569; font-weight: 600;">Période</th>
                            <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600;">Forfait</th>
                            <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600;">Changement</th>
                            <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600; background: #f1f5f9;">📅 Jours totaux</th>
                            <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600; background: #f1f5f9;">✅ Jours avec conso</th>
                            <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600; background: #f1f5f9;">⭕ Jours sans conso</th>
                            <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600; background: #ede9fe;">⚡ Énergie max</th>
                            <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600; background: #ede9fe;">📊 Énergie moy</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${forfaitStats.map((stat, index) => {
                            const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
                            const isFirst = index === 0;
                            
                            const startDateStr = stat.startDate.toLocaleDateString('fr-FR');
                            const endDateStr = stat.endDate ? stat.endDate.toLocaleDateString('fr-FR') : 'Présent';
                            
                            let changeText = '';
                            if (isFirst) {
                                changeText = '<span style="color: #64748b;">Premier forfait</span>';
                            } else {
                                changeText = `
                                    <span style="background: #f97315; color: white; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-right: 5px;">
                                        ${forfaitStats[index-1].forfait}
                                    </span>
                                    →
                                    <span style="background: #22c55e; color: white; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-left: 5px;">
                                        ${stat.forfait}
                                    </span>
                                `;
                            }
                            
                            return `
                                <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                                    <td style="padding: 12px 15px; white-space: nowrap;">
                                        <strong>${startDateStr}</strong> → <strong>${endDateStr}</strong>
                                        ${stat.isCurrent ? '<span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; margin-left: 8px;">ACTUEL</span>' : ''}
                                    </td>
                                    <td style="padding: 12px 15px; text-align: center;">
                                        <span style="background: ${stat.isCurrent ? '#22c55e20' : '#9f7aea20'}; color: ${stat.isCurrent ? '#22c55e' : '#9f7aea'}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                                            ${stat.forfait}
                                        </span>
                                    </td>
                                    <td style="padding: 12px 15px; text-align: center; white-space: nowrap;">
                                        ${changeText}
                                    </td>
                                    <td style="padding: 12px 15px; text-align: center; font-weight: 600; background: #f8fafc;">
                                        ${stat.totalDays}
                                    </td>
                                    <td style="padding: 12px 15px; text-align: center; font-weight: 600; color: #22c55e; background: #f8fafc;">
                                        ${stat.daysWithConsumption}
                                        ${stat.totalDays > 0 ? `<span style="font-size: 11px; color: #64748b; margin-left: 4px;">(${Math.round(stat.daysWithConsumption/stat.totalDays*100)}%)</span>` : ''}
                                    </td>
                                    <td style="padding: 12px 15px; text-align: center; font-weight: 600; color: #64748b; background: #f8fafc;">
                                        ${stat.daysWithoutConsumption}
                                        ${stat.totalDays > 0 ? `<span style="font-size: 11px; color: #64748b; margin-left: 4px;">(${Math.round(stat.daysWithoutConsumption/stat.totalDays*100)}%)</span>` : ''}
                                    </td>
                                    <td style="padding: 12px 15px; text-align: center; font-weight: 600; color: #7c3aed; background: #f5f3ff;">
                                        <div>${stat.maxEnergy} Wh</div>
                                        <div style="font-size: 10px; color: #6b21a5;">${stat.maxEnergyDate}</div>
                                    </td>
                                    <td style="padding: 12px 15px; text-align: center; font-weight: 600; color: #7c3aed; background: #f5f3ff;">
                                        ${stat.avgEnergy} Wh
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <!-- Barres de progression pour chaque forfait -->
            <div style="margin-top: 15px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
                    <span style="font-size: 18px;">📊</span>
                    <span style="font-weight: 600; color: #1e293b;">Répartition par rapport au forfait (seuils 85% et 115%)</span>
                </div>
                
                ${forfaitStats.map((stat, index) => {
                    const startDateStr = stat.startDate.toLocaleDateString('fr-FR');
                    const endDateStr = stat.endDate ? stat.endDate.toLocaleDateString('fr-FR') : 'Présent';
                    
                    return `
                        <div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="font-weight: 600; color: ${stat.isCurrent ? '#22c55e' : '#9f7aea'};">${stat.forfait}</span>
                                    <span style="font-size: 11px; color: #64748b;">${startDateStr} → ${endDateStr}</span>
                                </div>
                                <span style="font-size: 12px; background: white; padding: 4px 12px; border-radius: 20px; border: 1px solid #e2e8f0;">
                                    ${stat.daysWithConsumptionOnly} jours avec conso
                                </span>
                            </div>
                            
                            <!-- Barre de progression -->
                            <div style="background: #f1f5f9; border-radius: 30px; height: 40px; overflow: hidden; display: flex; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 10px;">
                                <div style="width: ${stat.percentBelow85}%; height: 100%; background: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: white;">
                                    ${stat.percentBelow85 > 5 ? stat.percentBelow85 + '%' : ''}
                                </div>
                                <div style="width: ${stat.percentInTolerance}%; height: 100%; background: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: white;">
                                    ${stat.percentInTolerance > 5 ? stat.percentInTolerance + '%' : ''}
                                </div>
                                <div style="width: ${stat.percentAbove115}%; height: 100%; background: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: white;">
                                    ${stat.percentAbove115 > 5 ? stat.percentAbove115 + '%' : ''}
                                </div>
                            </div>
                            
                            <!-- Légende compacte -->
                            <div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: space-between; font-size: 11px;">
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <div style="width: 12px; height: 12px; background: #22c55e; border-radius: 3px;"></div>
                                    <span><strong>${stat.daysBelow85} jours</strong> ≤${stat.seuil85.toFixed(0)}Wh · ${stat.percentBelow85}%</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <div style="width: 12px; height: 12px; background: #f59e0b; border-radius: 3px;"></div>
                                    <span><strong>${stat.daysInTolerance} jours</strong> ${stat.seuil85.toFixed(0)}-${stat.maxWithTolerance.toFixed(0)}Wh · ${stat.percentInTolerance}%</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <div style="width: 12px; height: 12px; background: #ef4444; border-radius: 3px;"></div>
                                    <span><strong>${stat.daysAbove115} jours</strong> >${stat.maxWithTolerance.toFixed(0)}Wh · ${stat.percentAbove115}%</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div style="margin-top: 15px; padding: 15px; background: #f1f5f9; border-radius: 8px; font-size: 12px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; color: #475569;">
                    <span style="font-size: 14px;">📌</span>
                    <span><strong>Légende des seuils de consommation :</strong></span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-around;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 16px; height: 16px; background: #22c55e; border-radius: 4px;"></div>
                        <span><strong>Normal</strong> (0-85% du forfait)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 16px; height: 16px; background: #f59e0b; border-radius: 4px;"></div>
                        <span><strong>Tolérance</strong> (85-115% du forfait)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 16px; height: 16px; background: #ef4444; border-radius: 4px;"></div>
                        <span><strong>Hors tolérance</strong> (>115% du forfait) = SuspendE</span>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(historyCard);
    }
    
    // Statistiques rapides du client
    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 25px;
    `;
    
    const clientStats = calculateClientStats(clientNumber);
    container.appendChild(statsGrid);
    
    // ✅ TABLEAU DES ÉVÉNEMENTS (entre consommation et crédit)
    if (combinedEventData.length > 0 || combinedSoldeData.length > 0) {
        const eventsTable = createClientEventsTable(clientNumber);
        container.appendChild(eventsTable);
    }

    // Analyse de crédit avec données de recharge
    if (combinedSoldeData.length > 0 || combinedRechargeData.length > 0) {
        const creditAnalysis = createClientCreditAnalysis(clientNumber);
        container.appendChild(creditAnalysis);
    }
    
    setTimeout(() => {
        drawGauges(clientNumber);
    }, 200);
}
function drawGauges(clientNumber) {
    console.log(`🔄 Dessin des jauges pour le client ${clientNumber}`);
    
    // Récupérer les données du client
    const energyKey = `Energie${clientNumber}`;
    
    // Récupérer le forfait du client
    let forfaitMax = 500; // Valeur par défaut
    let forfaitName = 'ECO';
    try {
        const rechargeAnalysis = typeof analyzeRechargeData === 'function' ? 
            analyzeRechargeData(clientNumber) : null;
        if (rechargeAnalysis && rechargeAnalysis.currentCode4Name) {
            forfaitName = rechargeAnalysis.currentCode4Name;
            const limits = getForfaitLimits(rechargeAnalysis.currentCode4Name);
            forfaitMax = limits.max || 500;
        }
    } catch (e) {
        console.log('⚠️ Impossible de récupérer le forfait, utilisation de la valeur par défaut');
    }
    
    // Calculer le seuil de tolérance (115% du forfait)
    const forfaitMaxAvecTolerance = forfaitMax * 1.15;
    
    // Analyser les données d'énergie
    const consumptionByDay = {};
    
    if (combinedEnergyData && combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            if (!row['Date et Heure']) return;
            const date = row['Date et Heure'].split(' ')[0];
            const value = row[energyKey];
            
            if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                const energyValue = parseFloat(value.toString().replace(',', '.'));
                if (!isNaN(energyValue) && energyValue > 0) {
                    if (!consumptionByDay[date] || energyValue > consumptionByDay[date]) {
                        consumptionByDay[date] = energyValue;
                    }
                }
            }
        });
    }
    
    // Convertir en tableau pour analyse
    const dailyValues = Object.values(consumptionByDay);
    
    if (dailyValues.length === 0) {
        console.log('⚠️ Aucune donnée de consommation pour les jauges');
        return;
    }
    
    // Calculer les pourcentages avec les nouveaux seuils
    const joursDansLimites = dailyValues.filter(v => v > 0 && v <= forfaitMax).length; // 0-100% du forfait (pour la jauge, on garde 100% comme limite normale)
    const joursDansTolerance = dailyValues.filter(v => v > forfaitMax && v <= forfaitMaxAvecTolerance).length; // 100-115%
    const joursHorsTolerance = dailyValues.filter(v => v > forfaitMaxAvecTolerance).length; // >115%
    
    const total = joursDansLimites + joursDansTolerance + joursHorsTolerance;
    
    // Pour les jauges, on utilise des pourcentages basés sur 100% (forfait max)
    // Mais on garde les couleurs selon les catégories
    const pourcentLimites = total > 0 ? Math.round((joursDansLimites / total) * 100) : 0;
    const pourcentTolerance = total > 0 ? Math.round((joursDansTolerance / total) * 100) : 0;
    const pourcentHorsTolerance = total > 0 ? Math.round((joursHorsTolerance / total) * 100) : 0;
    
    console.log(`📊 Statistiques pour client ${clientNumber}:`, {
        total,
        joursDansLimites,
        pourcentLimites,
        joursDansTolerance,
        pourcentTolerance,
        joursHorsTolerance,
        pourcentHorsTolerance,
        forfaitMax,
        forfaitMaxAvecTolerance
    });

    // Dessiner les jauges
    setTimeout(() => {
        // Jauge limites (verte) - Jours dans les limites normales (0-100%)
        const canvasLimits = document.getElementById(`gauge-${clientNumber}-limits`);
        if (canvasLimits) {
            const ctx = canvasLimits.getContext('2d');
            const centerX = 50;
            const centerY = 50;
            const radius = 40;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (pourcentLimites / 100) * 2 * Math.PI;

            // Effacer le canvas
            ctx.clearRect(0, 0, 100, 100);
            
            // Fond
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 10;
            ctx.stroke();

            // Progression
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.strokeStyle = '#22c55e'; // Vert success
            ctx.lineWidth = 10;
            ctx.stroke();

            // Texte
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#22c55e';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pourcentLimites + '%', centerX, centerY);
            
            // Petit texte descriptif
            ctx.font = 'bold 8px Arial';
            ctx.fillStyle = '#166534';
            ctx.fillText('Normal', centerX, centerY + 20);
        } else {
            console.log(`⚠️ Canvas gauge-${clientNumber}-limits non trouvé`);
        }

        // Jauge tolérance (orange) - Jours dans la tolérance (100-115%)
        const canvasTolerance = document.getElementById(`gauge-${clientNumber}-tolerance`);
        if (canvasTolerance) {
            const ctx = canvasTolerance.getContext('2d');
            const centerX = 50;
            const centerY = 50;
            const radius = 40;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (pourcentTolerance / 100) * 2 * Math.PI;

            ctx.clearRect(0, 0, 100, 100);
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 10;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.strokeStyle = '#f59e0b'; // Orange warning
            ctx.lineWidth = 10;
            ctx.stroke();

            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#f59e0b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pourcentTolerance + '%', centerX, centerY);
            
            ctx.font = 'bold 8px Arial';
            ctx.fillStyle = '#92400e';
            ctx.fillText('Tolérance', centerX, centerY + 20);
        }

        // Jauge hors tolérance (rouge) - Jours hors tolérance (>115%)
        const canvasHors = document.getElementById(`gauge-${clientNumber}-hors`);
        if (canvasHors) {
            const ctx = canvasHors.getContext('2d');
            const centerX = 50;
            const centerY = 50;
            const radius = 40;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (pourcentHorsTolerance / 100) * 2 * Math.PI;

            ctx.clearRect(0, 0, 100, 100);
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 10;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.strokeStyle = '#ef4444'; // Rouge danger
            ctx.lineWidth = 10;
            ctx.stroke();

            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#ef4444';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pourcentHorsTolerance + '%', centerX, centerY);
            
            ctx.font = 'bold 8px Arial';
            ctx.fillStyle = '#991b1b';
            ctx.fillText('Hors tolérance', centerX, centerY + 20);
        }
        
        // Ajouter une légende sous les jauges
        const gaugesContainer = document.querySelector(`#gauge-${clientNumber}-limits`)?.parentNode;
        if (gaugesContainer && !document.getElementById(`gauge-legend-${clientNumber}`)) {
            const legend = document.createElement('div');
            legend.id = `gauge-legend-${clientNumber}`;
            legend.style.cssText = `
                margin-top: 15px;
                padding: 10px;
                background: #f8fafc;
                border-radius: 8px;
                font-size: 11px;
                display: flex;
                justify-content: space-around;
                border: 1px solid #e2e8f0;
            `;
            legend.innerHTML = `
                <div><span style="color: #22c55e; font-weight: 700;">Vert:</span> ≤${forfaitMax}Wh (0-100%)</div>
                <div><span style="color: #f59e0b; font-weight: 700;">Orange:</span> ${forfaitMax}-${forfaitMaxAvecTolerance.toFixed(0)}Wh (100-115%)</div>
                <div><span style="color: #ef4444; font-weight: 700;">Rouge:</span> >${forfaitMaxAvecTolerance.toFixed(0)}Wh (>115%)</div>
            `;
            gaugesContainer.appendChild(legend);
        }
    }, 300);
}
function createClientHourlyEnergyChart(clientId) {
    return `
        <div class="client-hourly-chart-container" data-chart-id="client-${clientId}" data-client-id="${clientId}" 
             style="background:white; border-radius:16px; border:2px solid #e2e8f0; margin:20px 0; padding:20px; box-shadow:0 8px 20px rgba(0,0,0,0.05);">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:15px;">
                <div style="width:44px; height:44px; background:linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); border-radius:12px; display:flex; align-items:center; justify-content:center;">
                    <span style="font-size:24px; color:white;">⏰</span>
                </div>
                <div>
                    <h4 style="margin:0; font-size:18px; font-weight:700; color:#0f172a;">Profil Horaire de Consommation</h4>
                    <div style="font-size:12px; color:#64748b; margin-top:4px;">
                        Analyse des habitudes de consommation par heure
                    </div>
                </div>
            </div>
            <div style="width:100%; height:250px; background: #f8fafc; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                <span style="color: #94a3b8;">Graphique en cours de développement</span>
            </div>
        </div>
    `;
}
// ==================== TABLEAU DES ÉVÉNEMENTS POUR CLIENT ====================
function createClientEventsTable(clientNumber) {
    const container = document.createElement('div');
    container.className = 'client-events-table';
    container.style.cssText = `
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        margin-bottom: 25px;
        overflow: hidden;
        border: 2px solid #e2e8f0;
    `;
    
    // En-tête
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        color: white;
        padding: 15px 25px;
        font-size: 18px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    header.innerHTML = `
        <span style="font-size: 24px;">⚠️</span>
        <span>Événements - Client ${clientNumber.toString().padStart(2, '0')}</span>
    `;
    container.appendChild(header);
    
    const content = document.createElement('div');
    content.style.cssText = `padding: 20px;`;
    
    // Calculer le nombre total de jours de diagnostic pour ce client
    const totalDiagnosticDays = getTotalDiagnosticDaysForClient(clientNumber);
    
    // Récupérer les événements pour ce client
    const eventsByDay = getEventsForClientGroupedByDay(clientNumber);
    
    if (eventsByDay.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #94a3b8; background: #f8fafc; border-radius: 12px;">
                <span style="font-size: 48px; display: block; margin-bottom: 15px;">✅</span>
                <h3 style="margin: 0 0 10px 0; color: #1e293b;">Aucun événement</h3>
                <p style="margin: 0; font-size: 14px;">Aucun événement pour ce client</p>
                <p style="margin-top: 10px; font-size: 12px; color: #64748b;">Sur ${totalDiagnosticDays} jour(s) de diagnostic</p>
            </div>
        `;
        container.appendChild(content);
        return container;
    }
    
    // Calculer les statistiques
    const daysWithCreditNul = new Set();
    const daysWithSuspendP = new Set();
    const daysWithSuspendE = new Set();
    
    eventsByDay.forEach(day => {
        if (day.CreditNul > 0) daysWithCreditNul.add(day.date);
        if (day.SuspendP > 0) daysWithSuspendP.add(day.date);
        if (day.SuspendE > 0) daysWithSuspendE.add(day.date);
    });
    
    // Calculer les pourcentages
    const percentCreditNul = totalDiagnosticDays > 0 ? 
        ((daysWithCreditNul.size / totalDiagnosticDays) * 100).toFixed(1) : 0;
    const percentSuspendP = totalDiagnosticDays > 0 ? 
        ((daysWithSuspendP.size / totalDiagnosticDays) * 100).toFixed(1) : 0;
    const percentSuspendE = totalDiagnosticDays > 0 ? 
        ((daysWithSuspendE.size / totalDiagnosticDays) * 100).toFixed(1) : 0;
    
    // ✅ TABLEAU DE BORD COMPACT (cartes plus petites)
    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 20px;
    `;
    
    statsGrid.innerHTML = `
        <!-- Crédit nul -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 10px; padding: 12px; color: white;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 20px;">💰</span>
                <span style="font-size: 12px; font-weight: 600; opacity: 0.9;">CRÉDIT NUL</span>
            </div>
            <div style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${daysWithCreditNul.size}</div>
            <div style="font-size: 11px; opacity: 0.9;">jour(s) concerné(s)</div>
            <div style="margin-top: 8px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;">
                <div style="width: ${percentCreditNul}%; height: 100%; background: white; border-radius: 2px;"></div>
            </div>
            <div style="margin-top: 5px; font-size: 11px; font-weight: 600;">${percentCreditNul}%</div>
        </div>
        
        <!-- Puissance dépassée -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; padding: 12px; color: white;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 20px;">📈</span>
                <span style="font-size: 12px; font-weight: 600; opacity: 0.9;">PUISSANCE</span>
            </div>
            <div style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${daysWithSuspendP.size}</div>
            <div style="font-size: 11px; opacity: 0.9;">jour(s) concerné(s)</div>
            <div style="margin-top: 8px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;">
                <div style="width: ${percentSuspendP}%; height: 100%; background: white; border-radius: 2px;"></div>
            </div>
            <div style="margin-top: 5px; font-size: 11px; font-weight: 600;">${percentSuspendP}%</div>
        </div>
        
        <!-- Énergie épuisée -->
        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-radius: 10px; padding: 12px; color: white;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 20px;">🔋</span>
                <span style="font-size: 12px; font-weight: 600; opacity: 0.9;">ÉNERGIE</span>
            </div>
            <div style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${daysWithSuspendE.size}</div>
            <div style="font-size: 11px; opacity: 0.9;">jour(s) concerné(s)</div>
            <div style="margin-top: 8px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;">
                <div style="width: ${percentSuspendE}%; height: 100%; background: white; border-radius: 2px;"></div>
            </div>
            <div style="margin-top: 5px; font-size: 11px; font-weight: 600;">${percentSuspendE}%</div>
        </div>
    `;
    
    content.appendChild(statsGrid);
    
    // ✅ Informations période compactes
    const periodInfo = document.createElement('div');
    periodInfo.style.cssText = `
        background: #f8fafc;
        border-radius: 8px;
        padding: 10px 15px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        border: 1px solid #e2e8f0;
    `;
    periodInfo.innerHTML = `
        <span>📅 ${totalDiagnosticDays} jours analysés</span>
        <span>📊 ${new Set(eventsByDay.map(d => d.date)).size} jours avec événements</span>
        <span>⚡ ${eventsByDay.reduce((sum, d) => sum + d.SuspendP + d.SuspendE + d.CreditNul, 0)} événements</span>
    `;
    content.appendChild(periodInfo);
    
    // ✅ Bouton Plus de détails
    const toggleBtn = document.createElement('button');
    toggleBtn.id = `toggle-events-${clientNumber}`;
    toggleBtn.style.cssText = `
        width: 100%;
        padding: 12px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        color: #334155;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 15px;
    `;
    toggleBtn.innerHTML = `
        <span style="font-size: 16px;">🔽</span>
        <span>Afficher le tableau détaillé</span>
    `;
    content.appendChild(toggleBtn);
    
    // ✅ TABLEAU (gardé exactement comme avant)
    const tableWrapper = document.createElement('div');
    tableWrapper.id = `events-table-${clientNumber}`;
    tableWrapper.style.cssText = `
        display: none;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 15px;
        max-height: 350px;
        overflow-y: auto;
        overflow-x: auto;
        scrollbar-width: thin;
        position: relative;
    `;
    
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 900px;">
            <thead style="position: sticky; top: 0; z-index: 10;">
                <tr>
                    <th rowspan="2" style="padding: 15px 10px; text-align: left; border-right: 2px solid #cbd5e1; background: #f1f5f9; font-size: 14px; position: sticky; left: 0; z-index: 11;">📅 DATE</th>
                    <th colspan="3" style="padding: 12px 10px; text-align: center; background: #3b82f6; color: white; border-right: 2px solid #2563eb;">📈 PUISSANCE DÉPASSÉE</th>
                    <th colspan="1" style="padding: 12px 10px; text-align: center; background: #f59e0b; color: white; border-right: 2px solid #d97706;">💰 CRÉDIT NUL</th>
                    <th colspan="3" style="padding: 12px 10px; text-align: center; background: #0ea5e9; color: white;">🔋 ÉNERGIE ÉPUISÉE</th>
                </tr>
                <tr style="background: #f1f5f9;">
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1;">Début</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1;">Fin</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1; border-right: 2px solid #cbd5e1;">Durée</th>
                    
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1; border-right: 2px solid #cbd5e1;">Signalement</th>
                    
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1;">Début</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1;">Fin</th>
                    <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1;">Durée</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    eventsByDay.sort((a, b) => new Date(b.dateObj) - new Date(a.dateObj));
    
    eventsByDay.forEach((day, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
        
        tableHTML += `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                <td style="padding: 12px 10px; font-weight: 600; border-right: 2px solid #e2e8f0; position: sticky; left: 0; background: ${bgColor};">
                    ${new Date(day.date).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric'
                    })}
                </td>
                
                <!-- SuspendP -->
                <td style="padding: 10px 8px; text-align: center; ${day.SuspendP > 0 ? 'background: #3b82f610; font-weight: 600; color: #2563eb;' : 'color: #94a3b8;'}">
                    ${day.SuspendP_start || '-'}
                </td>
                <td style="padding: 10px 8px; text-align: center; ${day.SuspendP > 0 ? 'background: #3b82f610; font-weight: 600; color: #2563eb;' : 'color: #94a3b8;'}">
                    ${day.SuspendP_end || '-'}
                </td>
                <td style="padding: 10px 8px; text-align: center; border-right: 2px solid #e2e8f0; ${day.SuspendP > 0 ? 'background: #3b82f620; font-weight: 700; color: #2563eb;' : 'color: #94a3b8;'}">
                    ${day.SuspendP_duration || '-'}
                </td>
                
                <!-- Crédit Nul -->
                <td style="padding: 10px 8px; text-align: center; border-right: 2px solid #e2e8f0; ${day.CreditNul > 0 ? 'background: #f59e0b; color: white; font-weight: 700;' : 'background: #f1f5f9; color: #94a3b8;'}">
                    ${day.CreditNul > 0 ? '⚠️ CRÉDIT NUL' : '✓ Normal'}
                </td>
                
                <!-- SuspendE -->
                <td style="padding: 10px 8px; text-align: center; ${day.SuspendE > 0 ? 'background: #0ea5e910; font-weight: 600; color: #0284c7;' : 'color: #94a3b8;'}">
                    ${day.SuspendE_start || '-'}
                </td>
                <td style="padding: 10px 8px; text-align: center; ${day.SuspendE > 0 ? 'background: #0ea5e910; font-weight: 600; color: #0284c7;' : 'color: #94a3b8;'}">
                    ${day.SuspendE_end || '-'}
                </td>
                <td style="padding: 10px 8px; text-align: center; ${day.SuspendE > 0 ? 'background: #0ea5e920; font-weight: 700; color: #0284c7;' : 'color: #94a3b8;'}">
                    ${day.SuspendE_duration || '-'}
                </td>
            </tr>
        `;
    });
    
    tableHTML += `</tbody></table>`;
    tableWrapper.innerHTML = tableHTML;
    content.appendChild(tableWrapper);
    
    // Légende
    const legend = document.createElement('div');
    legend.style.cssText = `
        margin-top: 15px;
        padding: 12px 20px;
        background: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
        font-size: 12px;
    `;
    
    legend.innerHTML = `
        <span><span style="color:#3b82f6;">⬤</span> Puissance dépassée</span>
        <span><span style="color:#f59e0b;">⬤</span> Crédit nul</span>
        <span><span style="color:#0ea5e9;">⬤</span> Énergie épuisée</span>
    `;
    content.appendChild(legend);
    
    container.appendChild(content);
    
    // Événement bouton
    setTimeout(() => {
        const btn = document.getElementById(`toggle-events-${clientNumber}`);
        const table = document.getElementById(`events-table-${clientNumber}`);
        if (btn && table) {
            btn.addEventListener('click', () => {
                if (table.style.display === 'none') {
                    table.style.display = 'block';
                    btn.innerHTML = `<span style="font-size:16px;">🔼</span><span>Masquer le tableau</span>`;
                } else {
                    table.style.display = 'none';
                    btn.innerHTML = `<span style="font-size:16px;">🔽</span><span>Afficher le tableau détaillé</span>`;
                }
            });
        }
    }, 100);
    
    return container;
}

// Fonction pour calculer le nombre total de jours de diagnostic pour un client
function getTotalDiagnosticDaysForClient(clientNumber) {
    const totalDays = new Set();
    
    // Jours avec données d'énergie
    if (combinedEnergyData.length > 0) {
        const energyKey = `Energie${clientNumber}`;
        combinedEnergyData.forEach(row => {
            if (row['Date et Heure']) {
                const value = row[energyKey];
                if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                    const date = row['Date et Heure'].split(' ')[0];
                    totalDays.add(date);
                }
            }
        });
    }
    
    // Jours avec données de solde
    if (combinedSoldeData.length > 0) {
        const creditKey = `Credit${clientNumber}`;
        combinedSoldeData.forEach(row => {
            if (row['Date et Heure']) {
                const value = row[creditKey];
                if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                    const date = row['Date et Heure'].split(' ')[0];
                    totalDays.add(date);
                }
            }
        });
    }
    
    return totalDays.size;
}
// Fonction pour récupérer les événements groupés par jour
function getEventsForClientGroupedByDay(clientNumber, forfaitStartDate = null, forfaitEndDate = null) {
    const eventsByDay = {};
    const clientStr = clientNumber.toString();
    
    combinedEventData.forEach(row => {
        if (!row['Date et Heure'] || !row['Évènements']) return;
        
        const dateTime = row['Date et Heure'];
        const [date, time] = dateTime.split(' ');
        const event = row['Évènements'].trim();
        const code1 = row['Code 1']?.toString().trim() || '';
        
        // Filtrer par période si spécifiée
        if (forfaitStartDate || forfaitEndDate) {
            const eventDateObj = new Date(date);
            if (forfaitStartDate && eventDateObj < forfaitStartDate) return;
            if (forfaitEndDate && eventDateObj > forfaitEndDate) return;
        }
        
        // Initialiser le jour si nécessaire
        if (!eventsByDay[date]) {
            eventsByDay[date] = {
                date: date,
                dateObj: new Date(date),
                SuspendP: 0, SuspendP_start: null, SuspendP_end: null, SuspendP_duration: '-',
                SuspendE: 0, SuspendE_start: null, SuspendE_end: null, SuspendE_duration: '-',
                CreditNul: 0, CreditNul_start: null, CreditNul_end: null, CreditNul_duration: '-'
            };
        }
        
        const day = eventsByDay[date];
        
        // Déterminer le type d'événement
        if (event.includes('SuspendP')) {
            if (code1 && code1.slice(-1) === clientStr) {
                day.SuspendP++;
                if (!day.SuspendP_start || time < day.SuspendP_start) day.SuspendP_start = time.substring(0, 5);
                if (!day.SuspendP_end || time > day.SuspendP_end) day.SuspendP_end = time.substring(0, 5);
            }
        }
        else if (event.includes('SuspendE')) {
            if (code1 && code1.slice(-1) === clientStr) {
                day.SuspendE++;
                if (!day.SuspendE_start || time < day.SuspendE_start) day.SuspendE_start = time.substring(0, 5);
                if (!day.SuspendE_end || time > day.SuspendE_end) day.SuspendE_end = time.substring(0, 5);
            }
        }
        // SUPPRESSION DU BLOC "Surcharge"
    });
    
    // Ajouter les données de crédit nul
    if (combinedSoldeData && combinedSoldeData.length > 0) {
        const creditKey = `Credit${clientNumber}`;
        
        combinedSoldeData.forEach(row => {
            if (!row['Date et Heure']) return;
            
            const dateTime = row['Date et Heure'];
            const [date, time] = dateTime.split(' ');
            const value = parseFloat(row[creditKey]) || 0;
            
            // Filtrer par période si spécifiée
            if (forfaitStartDate || forfaitEndDate) {
                const creditDateObj = new Date(date);
                if (forfaitStartDate && creditDateObj < forfaitStartDate) return;
                if (forfaitEndDate && creditDateObj > forfaitEndDate) return;
            }
            
            if (value === 0) {
                if (!eventsByDay[date]) {
                    eventsByDay[date] = {
                        date: date,
                        dateObj: new Date(date),
                        SuspendP: 0, SuspendP_start: null, SuspendP_end: null, SuspendP_duration: '-',
                        SuspendE: 0, SuspendE_start: null, SuspendE_end: null, SuspendE_duration: '-',
                        CreditNul: 0, CreditNul_start: null, CreditNul_end: null, CreditNul_duration: '-'
                    };
                }
                
                const day = eventsByDay[date];
                day.CreditNul++;
                if (!day.CreditNul_start || time < day.CreditNul_start) day.CreditNul_start = time.substring(0, 5);
                if (!day.CreditNul_end || time > day.CreditNul_end) day.CreditNul_end = time.substring(0, 5);
            }
        });
    }
    
    // Calculer les durées
    Object.values(eventsByDay).forEach(day => {
        if (day.SuspendP_start && day.SuspendP_end) {
            day.SuspendP_duration = calculateDuration(day.SuspendP_start, day.SuspendP_end);
        }
        if (day.SuspendE_start && day.SuspendE_end) {
            day.SuspendE_duration = calculateDuration(day.SuspendE_start, day.SuspendE_end);
        }
        if (day.CreditNul_start && day.CreditNul_end) {
            day.CreditNul_duration = calculateDuration(day.CreditNul_start, day.CreditNul_end);
        }
    });
    
    return Object.values(eventsByDay);
}
// Fonction utilitaire pour récupérer les événements d'un client
function getEventsForClient(clientNumber) {
    const events = [];
    const clientStr = clientNumber.toString();
    
    combinedEventData.forEach(row => {
        if (!row['Date et Heure'] || !row['Évènements']) return;
        
        const event = row['Évènements'].trim();
        const code1 = row['Code 1']?.toString().trim() || '';
        const code2 = row['Code 2']?.toString().trim() || '';
        const code3 = row['Code 3']?.toString().trim() || '';
        
        // Vérifier si c'est un événement qui nous intéresse
        if (event.includes('SuspendP') || event.includes('SuspendE') || event.includes('Surcharge')) {
            
            // Déterminer si cet événement concerne ce client
            let concerneClient = false;
            
            // Pour SuspendP et SuspendE, le client est dans le dernier chiffre du Code 1
            if (event.includes('SuspendP') || event.includes('SuspendE')) {
                if (code1 && code1.slice(-1) === clientStr) {
                    concerneClient = true;
                }
            }
            // Pour Surcharge, c'est système (pas de client spécifique)
            else if (event.includes('Surcharge')) {
                // On peut soit l'afficher pour tous les clients, soit pour un client spécifique
                // Ici on l'affiche pour le client actuel
                concerneClient = true;
            }
            
            if (concerneClient) {
                const dateTime = row['Date et Heure'];
                const [date, time] = dateTime.split(' ');
                
                let type = '';
                if (event.includes('SuspendP')) type = 'SuspendP';
                else if (event.includes('SuspendE')) type = 'SuspendE';
                else if (event.includes('Surcharge')) type = 'Surcharge';
                
                events.push({
                    dateTime,
                    date: new Date(date).toLocaleDateString('fr-FR'),
                    time: time.substring(0, 5),
                    rawEvent: event,
                    type,
                    code1,
                    code2,
                    code3
                });
            }
        }
    });
    
    return events;
}

function calculateClientStats(clientNumber) {
    const energyKey = `Energie${clientNumber}`;
    const creditKey = `Credit${clientNumber}`;
    
    let maxEnergy = 0;
    let totalEnergy = 0;
    let energyCount = 0;
    let totalCredit = 0;
    let creditCount = 0;
    let zeroCreditDays = 0;
    
    // Statistiques d'énergie
    if (combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            const value = row[energyKey];
            if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                const energyValue = parseFloat(value.toString().replace(',', '.'));
                if (!isNaN(energyValue)) {
                    maxEnergy = Math.max(maxEnergy, energyValue);
                    totalEnergy += energyValue;
                    energyCount++;
                }
            }
        });
    }
    
    // Statistiques de crédit
    if (combinedSoldeData.length > 0) {
        combinedSoldeData.forEach(row => {
            const value = row[creditKey];
            if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                const creditValue = parseFloat(value.toString().replace(',', '.'));
                if (!isNaN(creditValue)) {
                    totalCredit += creditValue;
                    creditCount++;
                    if (creditValue === 0) zeroCreditDays++;
                }
            }
        });
    }
    
    return {
        maxEnergy: maxEnergy.toFixed(2),
        avgEnergy: energyCount > 0 ? (totalEnergy / energyCount).toFixed(2) : '0.00',
        avgCredit: creditCount > 0 ? (totalCredit / creditCount).toFixed(2) : '0',
        zeroCreditDays: zeroCreditDays
    };
}

function calculateTotalEnergy() {
    let total = 0;
    if (combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            for (let i = 1; i <= 6; i++) {
                const value = row[`Energie${i}`];
                if (value && value.toString().trim() !== '' && value.toString().trim() !== '-') {
                    const energyValue = parseFloat(value.toString().replace(',', '.'));
                    if (!isNaN(energyValue)) total += energyValue;
                }
            }
        });
    }
    return total.toFixed(2);
}

function calculateTotalRecharges() {
    return combinedRechargeData.length;
}
function createSoldeTableForClient(clientNumber) {
    const container = document.createElement('div');
    container.className = 'client-solde-table';
    container.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        overflow: hidden;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        color: white;
        padding: 15px 20px;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    header.innerHTML = `<span>💰 Historique SOLDE - Client ${clientNumber}</span>`;
    container.appendChild(header);
    
    const content = document.createElement('div');
    content.style.cssText = `padding: 20px;`;
    
    // Filtrer les données
    let filteredData = combinedSoldeData;
    if (clientNumber !== 'all') {
        const creditKey = `Credit${clientNumber}`;
        filteredData = combinedSoldeData.filter(row => {
            const value = row[creditKey];
            return value && value.toString().trim() !== '' && value.toString().trim() !== '-';
        });
    }
    
    if (filteredData.length === 0) {
        content.innerHTML = `<div style="text-align: center; padding: 40px; color: #94a3b8;">Aucune donnée SOLDE disponible</div>`;
        container.appendChild(content);
        return container;
    }
    
    // ✅ TABLEAU AVEC HAUTEUR FIXE DE 350px ET DÉFILEMENT
    const tableWrapper = document.createElement('div');
    tableWrapper.style.cssText = `
        max-height: 350px;
        overflow-y: auto;
        overflow-x: auto;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        position: relative;
        scrollbar-width: thin;
    `;
    
    let tableHTML = `<table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 800px;">`;
    
    // En-tête fixe
    tableHTML += `<thead style="position: sticky; top: 0; z-index: 10; background: white;">`;
    tableHTML += `<tr style="background: #f7fafc;">`;
    tableHTML += `<th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; position: sticky; left: 0; background: #f7fafc;">Date et Heure</th>`;
    
    if (clientNumber === 'all') {
        for (let i = 1; i <= 6; i++) {
            tableHTML += `<th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Credit${i}</th>`;
        }
    } else {
        tableHTML += `<th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Credit ${clientNumber}</th>`;
    }
    
    tableHTML += `</tr></thead><tbody>`;
    
    // Trier par date décroissante (plus récent en premier)
    const sortedData = [...filteredData].sort((a, b) => 
        new Date(b['Date et Heure']) - new Date(a['Date et Heure'])
    );
    
    sortedData.forEach((row, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
        tableHTML += `<tr style="border-bottom: 1px solid #edf2f7; background: ${bgColor};">`;
        
        // Date avec fond fixe pour la première colonne
        tableHTML += `<td style="padding: 10px 12px; position: sticky; left: 0; background: ${bgColor};">${row['Date et Heure'] || '-'}</td>`;
        
        if (clientNumber === 'all') {
            for (let i = 1; i <= 6; i++) {
                const value = row[`Credit${i}`] || '-';
                const isPositive = value !== '-' && parseFloat(value) > 0;
                tableHTML += `<td style="padding: 10px 12px; text-align: center; ${isPositive ? 'color: #48bb78; font-weight: 600;' : 'color: #a0aec0;'}">${value}</td>`;
            }
        } else {
            const value = row[`Credit${clientNumber}`] || '-';
            const isPositive = value !== '-' && parseFloat(value) > 0;
            tableHTML += `<td style="padding: 10px 12px; text-align: center; ${isPositive ? 'color: #48bb78; font-weight: 600;' : 'color: #a0aec0;'}">${value}</td>`;
        }
        
        tableHTML += `</tr>`;
    });
    
    tableHTML += `</tbody></table>`;
    tableWrapper.innerHTML = tableHTML;
    content.appendChild(tableWrapper);
    
    // Indicateur de nombre de lignes
    const infoRow = document.createElement('div');
    infoRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
        font-size: 11px;
        color: #64748b;
    `;
    infoRow.innerHTML = `
        <span>📋 ${filteredData.length} enregistrement(s) de solde</span>
        <span>⬆️ Dernier: ${sortedData[0]?.['Date et Heure'] || 'N/A'}</span>
    `;
    content.appendChild(infoRow);
    
    container.appendChild(content);
    return container;
}
function createRechargeTableForClient(clientNumber) {
    const container = document.createElement('div');
    container.className = 'client-recharge-table';
    container.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        overflow: hidden;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%);
        color: white;
        padding: 15px 20px;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    header.innerHTML = `<span>⚡ Historique RECHARGE - Client ${clientNumber}</span>`;
    container.appendChild(header);
    
    const content = document.createElement('div');
    content.style.cssText = `padding: 20px;`;
    
    // Filtrer les données par client (basé sur Code 1)
    let filteredData = combinedRechargeData;
    if (clientNumber !== 'all') {
        filteredData = combinedRechargeData.filter(row => {
            const code1 = row['Code 1'] || '';
            return code1.toString().trim() === clientNumber.toString();
        });
    }
    
    if (filteredData.length === 0) {
        content.innerHTML = `<div style="text-align: center; padding: 40px; color: #94a3b8;">Aucune donnée RECHARGE disponible pour ce client</div>`;
        container.appendChild(content);
        return container;
    }
    
    // ✅ TABLEAU AVEC HAUTEUR FIXE DE 350px ET DÉFILEMENT
    const tableWrapper = document.createElement('div');
    tableWrapper.style.cssText = `
        max-height: 350px;
        overflow-y: auto;
        overflow-x: auto;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        position: relative;
        scrollbar-width: thin;
    `;
    
    let tableHTML = `<table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 1000px;">`;
    
    // En-tête fixe
    tableHTML += `<thead style="position: sticky; top: 0; z-index: 10; background: white;">`;
    tableHTML += `<tr style="background: #f7fafc;">`;
    tableHTML += `<th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; position: sticky; left: 0; background: #f7fafc;">Date et Heure</th>`;
    tableHTML += `<th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Code</th>`;
    tableHTML += `<th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Type</th>`;
    tableHTML += `<th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Statut</th>`;
    tableHTML += `<th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Code 1</th>`;
    tableHTML += `<th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Code 2</th>`;
    tableHTML += `<th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Code 3</th>`;
    tableHTML += `<th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Code 4</th>`;
    tableHTML += `</tr></thead><tbody>`;
    
    // Trier par date décroissante
    const sortedData = [...filteredData].sort((a, b) => 
        new Date(b['Date et Heure']) - new Date(a['Date et Heure'])
    );
    
    sortedData.forEach((row, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
        const statusColor = row['Status']?.toLowerCase().includes('reussie') ? '#48bb78' : 
                           row['Status']?.toLowerCase().includes('echoue') ? '#f56565' : '#ed8936';
        
        tableHTML += `<tr style="border-bottom: 1px solid #edf2f7; background: ${bgColor};">`;
        tableHTML += `<td style="padding: 10px 12px; position: sticky; left: 0; background: ${bgColor};">${row['Date et Heure'] || '-'}</td>`;
        tableHTML += `<td style="padding: 10px 12px; text-align: center; font-family: monospace;">${row['Code enregistrer'] || '-'}</td>`;
        tableHTML += `<td style="padding: 10px 12px; text-align: center;">${row['Type de code'] || '-'}</td>`;
        tableHTML += `<td style="padding: 10px 12px; text-align: center; color: ${statusColor}; font-weight: 600;">${row['Status'] || '-'}</td>`;
        tableHTML += `<td style="padding: 10px 12px; text-align: center; font-family: monospace; ${row['Code 1'] === String(clientNumber) ? 'background: #fef3c7; font-weight: 700;' : ''}">${row['Code 1'] || '-'}</td>`;
        tableHTML += `<td style="padding: 10px 12px; text-align: center; font-family: monospace;">${row['Code 2'] || '-'}</td>`;
        tableHTML += `<td style="padding: 10px 12px; text-align: center; font-family: monospace;">${row['Code 3'] || '-'}</td>`;
        tableHTML += `<td style="padding: 10px 12px; text-align: center; font-family: monospace;">${row['Code 4'] || '-'}</td>`;
        tableHTML += `</tr>`;
    });
    
    tableHTML += `</tbody></table>`;
    tableWrapper.innerHTML = tableHTML;
    content.appendChild(tableWrapper);
    
    // Indicateur de nombre de lignes
    const infoRow = document.createElement('div');
    infoRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
        font-size: 11px;
        color: #64748b;
    `;
    infoRow.innerHTML = `
        <span>📋 ${filteredData.length} recharge(s)</span>
        <span>⬆️ Dernière: ${sortedData[0]?.['Date et Heure'] || 'N/A'}</span>
    `;
    content.appendChild(infoRow);
    
    container.appendChild(content);
    return container;
}

//=================ANALYSE CONSOMMATION===============================
function createClientEnergyAnalysis(clientNumber) {
    const analysisDiv = document.createElement('div');
    analysisDiv.style.cssText = `
        background: white;
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        margin-bottom: 25px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        color: white;
        padding: 20px 25px;
        font-size: 20px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 15px;
    `;
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <span style="font-size: 28px;">📊</span>
            <span>ANALYSE CONSOMMATION DU CLIENT ${clientNumber}</span>
        </div>
    `;
    analysisDiv.appendChild(header);
    
    const content = document.createElement('div');
    content.style.cssText = `padding: 25px;`;
    
    // Récupérer les données du client
    const energyKey = `Energie${clientNumber}`;
    
    // ===== 1. CONSTRUIRE L'HISTORIQUE DES FORFAITS À PARTIR DES RECHARGES =====
    const forfaitHistory = [];
    
    if (combinedRechargeData && combinedRechargeData.length > 0) {
        const clientRecharges = combinedRechargeData
            .filter(row => row['Code 1']?.toString().trim() === clientNumber.toString())
            .sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
        
        clientRecharges.forEach((recharge, index) => {
            const date = new Date(recharge['Date et Heure']);
            const code4 = parseInt(recharge['Code 4']);
            const forfaitName = getForfaitName(code4);
            
            if (index === 0) {
                // Premier forfait connu
                forfaitHistory.push({
                    forfait: forfaitName,
                    forfaitCode: code4,
                    startDate: date,
                    endDate: null,
                    isCurrent: true
                });
            } else if (code4 !== parseInt(clientRecharges[index-1]['Code 4'])) {
                // Changement de forfait
                forfaitHistory[forfaitHistory.length - 1].endDate = date;
                forfaitHistory[forfaitHistory.length - 1].isCurrent = false;
                
                forfaitHistory.push({
                    forfait: forfaitName,
                    forfaitCode: code4,
                    startDate: date,
                    endDate: null,
                    isCurrent: true
                });
            }
        });
    }
    
    // Si pas d'historique de forfait, on prend la date la plus ancienne des données
    if (forfaitHistory.length === 0) {
        let oldestDate = new Date();
        if (combinedEnergyData && combinedEnergyData.length > 0) {
            combinedEnergyData.forEach(row => {
                if (row['Date et Heure']) {
                    const date = new Date(row['Date et Heure']);
                    if (date < oldestDate) oldestDate = date;
                }
            });
        }
        
        forfaitHistory.push({
            forfait: 'ECO',
            forfaitCode: 1,
            startDate: oldestDate,
            endDate: null,
            isCurrent: true
        });
    }
    
    // ===== 2. ANALYSER LA CONSOMMATION JOUR PAR JOUR =====
    const consumptionByDay = {};
    
    if (combinedEnergyData && combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            if (!row['Date et Heure']) return;
            
            const dateTime = new Date(row['Date et Heure']);
            const dateStr = dateTime.toISOString().split('T')[0];
            
            const value = parseFloat(row[energyKey]) || 0;
            
            if (!consumptionByDay[dateStr]) {
                consumptionByDay[dateStr] = {
                    date: dateStr,
                    dateObj: dateTime,
                    total: 0,
                    hasData: false
                };
            }
            
            if (value > 0) {
                consumptionByDay[dateStr].total = Math.max(consumptionByDay[dateStr].total, value);
                consumptionByDay[dateStr].hasData = true;
            }
        });
    }
    
    // ===== 3. POUR CHAQUE FORFAIT, ANALYSER LES JOURS CORRESPONDANTS =====
    forfaitHistory.sort((a, b) => a.startDate - b.startDate);
    
    forfaitHistory.forEach((forfait) => {
        const isCurrent = forfait.isCurrent;
        const forfaitLimits = getForfaitLimits(forfait.forfait);
        const baseMax = forfaitLimits.max || 90;
        const maxWithTolerance = baseMax * 1.15; // 115%
        const seuil85 = baseMax * 0.85; // 85%
        
        // Filtrer les jours pour ce forfait
        const daysInPeriod = [];
        
        Object.values(consumptionByDay).forEach(day => {
            const dayDate = day.dateObj;
            
            // Vérifier si le jour est dans la période du forfait
            let inPeriod = false;
            
            if (forfait.endDate) {
                // Forfait avec date de fin
                if (dayDate >= forfait.startDate && dayDate <= forfait.endDate) {
                    inPeriod = true;
                }
            } else {
                // Forfait actuel (pas de date de fin)
                if (dayDate >= forfait.startDate) {
                    inPeriod = true;
                }
            }
            
            if (inPeriod) {
                daysInPeriod.push({
                    date: day.date,
                    dateObj: dayDate,
                    consumption: day.total,
                    hasData: day.hasData
                });
            }
        });
        
        // Trier par date
        daysInPeriod.sort((a, b) => a.dateObj - b.dateObj);
        
        if (daysInPeriod.length === 0) return;
        
        // ===== STATISTIQUES PRINCIPALES =====
        const totalDays = daysInPeriod.length; // Nombre total de jours avec données dans la période
        
        // Compter les jours AVEC consommation (>0)
        const daysWithConsumption = daysInPeriod.filter(day => day.consumption > 0).length;
        const daysWithoutConsumption = totalDays - daysWithConsumption;
        
        // Pourcentages
        const percentWithoutConsumption = totalDays > 0 ? 
            ((daysWithoutConsumption / totalDays) * 100).toFixed(1) : 0;
        const percentWithConsumption = totalDays > 0 ? 
            ((daysWithConsumption / totalDays) * 100).toFixed(1) : 0;
        
        // Énergie max et sa date
        let maxConsumption = 0;
        let maxConsumptionDate = null;
        daysInPeriod.forEach(day => {
            if (day.consumption > maxConsumption) {
                maxConsumption = day.consumption;
                maxConsumptionDate = day.dateObj;
            }
        });
        
        // Énergie totale et moyenne (sur les jours avec consommation uniquement)
        const totalConsumption = daysInPeriod.reduce((sum, day) => sum + day.consumption, 0);
        const avgConsumption = daysWithConsumption > 0 ? 
            (totalConsumption / daysWithConsumption).toFixed(1) : 0;
        
        // ===== ANALYSE DES ÉVÉNEMENTS ÉNERGIE ÉPUISÉE (SuspendE) =====
        let daysWithSuspendE = 0;
        const suspendEDates = new Set();

        if (combinedEventData && combinedEventData.length > 0) {
            combinedEventData.forEach(row => {
                if (!row['Date et Heure'] || !row['Évènements']) return;
                
                const event = row['Évènements'].trim();
                const code1 = row['Code 1']?.toString().trim() || '';
                
                // Vérifier si c'est un SuspendE pour ce client
                if (event.includes('SuspendE') && code1.slice(-1) === clientNumber.toString()) {
                    const eventDateTime = new Date(row['Date et Heure']);
                    const eventDateStr = eventDateTime.toISOString().split('T')[0];
                    
                    // Vérifier si cette date est dans la période du forfait
                    let inPeriod = false;
                    
                    // Convertir les dates en timestamp pour comparaison précise
                    const eventTime = eventDateTime.getTime();
                    const startTime = forfait.startDate.getTime();
                    
                    if (forfait.endDate) {
                        // Forfait avec date de fin
                        const endTime = forfait.endDate.getTime();
                        if (eventTime >= startTime && eventTime <= endTime) {
                            inPeriod = true;
                        }
                    } else {
                        // Forfait actuel
                        if (eventTime >= startTime) {
                            inPeriod = true;
                        }
                    }
                    
                    if (inPeriod) {
                        suspendEDates.add(eventDateStr);
                    }
                }
            });
            
            daysWithSuspendE = suspendEDates.size;
        }

        // Débogage - à supprimer après vérification
        if (daysWithSuspendE > 0) {
            console.log(`Client ${clientNumber} - Forfait ${forfait.forfait}:`, {
                start: forfait.startDate.toLocaleDateString('fr-FR'),
                end: forfait.endDate ? forfait.endDate.toLocaleDateString('fr-FR') : 'Présent',
                suspendEDates: Array.from(suspendEDates).sort(),
                count: daysWithSuspendE
            });
        }

        // ===== ANALYSE PAR SEUILS =====
        const daysWithConsumptionOnly = daysInPeriod.filter(day => day.consumption > 0);

        // Les jours hors tolérance sont exactement les jours avec SuspendE
        const daysAbove115 = daysWithSuspendE;

        // Les autres jours sont répartis entre ≤85% et 85-115%
        const daysBelow85 = daysWithConsumptionOnly.filter(day => 
            day.consumption <= seuil85 && !suspendEDates.has(day.date)
        ).length;

        const daysInTolerance = daysWithConsumptionOnly.filter(day => 
            day.consumption > seuil85 && day.consumption <= maxWithTolerance && !suspendEDates.has(day.date)
        ).length;

        // Calcul des pourcentages
        const percentBelow85 = daysWithConsumptionOnly.length > 0 ? 
            ((daysBelow85 / daysWithConsumptionOnly.length) * 100).toFixed(1) : 0;

        const percentInTolerance = daysWithConsumptionOnly.length > 0 ? 
            ((daysInTolerance / daysWithConsumptionOnly.length) * 100).toFixed(1) : 0;

        const percentAbove115 = daysWithConsumptionOnly.length > 0 ? 
            ((daysAbove115 / daysWithConsumptionOnly.length) * 100).toFixed(1) : 0;

        const percentSuspendE = daysWithConsumptionOnly.length > 0 ? 
            ((daysWithSuspendE / daysWithConsumptionOnly.length) * 100).toFixed(1) : 0;

        // Vérification
        const totalCheck = daysBelow85 + daysInTolerance + daysAbove115;
        if (totalCheck !== daysWithConsumptionOnly.length) {
            console.warn(`⚠️ Incohérence pour client ${clientNumber}, forfait ${forfait.forfait}:`, {
                daysBelow85,
                daysInTolerance,
                daysAbove115,
                total: daysWithConsumptionOnly.length,
                calculé: totalCheck,
                suspendEDates: Array.from(suspendEDates)
            });
        }
        
        // Formater les dates
        const startDateStr = forfait.startDate.toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const endDateStr = forfait.endDate ? forfait.endDate.toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }) : 'Présent';
        
        // ===== CONSTRUCTION DE LA CARTE =====
        const forfaitCard = document.createElement('div');
        forfaitCard.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 25px;
            border: 2px solid ${isCurrent ? '#22c55e' : '#e2e8f0'};
            box-shadow: ${isCurrent ? '0 8px 20px rgba(34, 197, 94, 0.15)' : '0 4px 12px rgba(0,0,0,0.05)'};
            position: relative;
        `;
        
        // Badge "ACTUEL"
        if (isCurrent) {
            const currentBadge = document.createElement('div');
            currentBadge.style.cssText = `
                position: absolute;
                top: -10px;
                right: 20px;
                background: #22c55e;
                color: white;
                padding: 5px 20px;
                border-radius: 30px;
                font-weight: 700;
                font-size: 14px;
                box-shadow: 0 4px 10px rgba(34, 197, 94, 0.3);
            `;
            currentBadge.textContent = '✅ FORFAIT ACTUEL';
            forfaitCard.appendChild(currentBadge);
        }
        
        // En-tête
        const forfaitHeader = document.createElement('div');
        forfaitHeader.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e2e8f0;
            flex-wrap: wrap;
            gap: 15px;
        `;
        
        forfaitHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="background: ${isCurrent ? '#22c55e' : '#9f7aea'}; width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 24px; color: white;">📦</span>
                </div>
                <div>
                    <div style="font-size: 20px; font-weight: 800; color: ${isCurrent ? '#22c55e' : '#9f7aea'};">${forfait.forfait}</div>
                    <div style="font-size: 13px; color: #64748b;">Code ${forfait.forfaitCode} · Limite: ${baseMax}Wh · Tolérance: ${maxWithTolerance.toFixed(0)}Wh (115%)</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="background: #f1f5f9; padding: 8px 16px; border-radius: 30px; font-size: 13px;">
                    📅 ${startDateStr} → ${endDateStr}
                </span>
                <span style="background: #f1f5f9; padding: 8px 16px; border-radius: 30px; font-size: 13px;">
                    📊 ${totalDays} jours de données
                </span>
            </div>
        `;
        
        forfaitCard.appendChild(forfaitHeader);
        
        // Ligne 1 : Énergie max et moyenne
        const row1 = document.createElement('div');
        row1.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        `;
        
        row1.innerHTML = `
            <!-- Énergie max -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 18px; color: white;">
                <div style="font-size: 13px; opacity: 0.9; margin-bottom: 8px;">⚡ Énergie max (Wh)</div>
                <div style="font-size: 32px; font-weight: 800; margin-bottom: 5px;">${maxConsumption.toFixed(1)}</div>
                <div style="font-size: 12px; opacity: 0.8;">le ${maxConsumptionDate ? maxConsumptionDate.toLocaleDateString('fr-FR') : '-'}</div>
            </div>
            
            <!-- Énergie moyenne -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 16px; padding: 18px; color: white;">
                <div style="font-size: 13px; opacity: 0.9; margin-bottom: 8px;">📊 Énergie moyenne (Wh)</div>
                <div style="font-size: 32px; font-weight: 800; margin-bottom: 5px;">${avgConsumption}</div>
                <div style="font-size: 12px; opacity: 0.8;">sur ${daysWithConsumption} jours avec conso</div>
            </div>
        `;
        
        forfaitCard.appendChild(row1);
        
        // Titre répartition
        const repartitionTitle = document.createElement('div');
        repartitionTitle.style.cssText = `
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin: 20px 0 15px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        repartitionTitle.innerHTML = `
            <span style="font-size: 20px;">📈</span>
            <span>Répartition par rapport au forfait (seuils 85% et 115%)</span>
        `;
        forfaitCard.appendChild(repartitionTitle);
        
        // Ligne 3 : Les 3 catégories de consommation
        const row3 = document.createElement('div');
        row3.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        `;
        
        row3.innerHTML = `
            <!-- ≤85% du forfait (Normal) -->
            <div style="background: #f0fdf4; border-radius: 16px; padding: 18px; border: 2px solid #22c55e;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <div style="width: 32px; height: 32px; background: #22c55e; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 18px; color: white;">✅</span>
                    </div>
                    <span style="font-size: 14px; font-weight: 600; color: #166534;">Normal (≤85%)</span>
                </div>
                <div style="font-size: 32px; font-weight: 800; color: #22c55e; margin-bottom: 5px;">${daysBelow85}</div>
                <div style="font-size: 14px; color: #166534; margin-bottom: 10px;">jours</div>
                <div style="background: #dcfce7; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #166534;">
                    ${percentBelow85}% des jours avec conso
                </div>
            </div>
            
            <!-- 85-115% du forfait (Tolérance) -->
            <div style="background: #fef3c7; border-radius: 16px; padding: 18px; border: 2px solid #f59e0b;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <div style="width: 32px; height: 32px; background: #f59e0b; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 18px; color: white;">⚠️</span>
                    </div>
                    <span style="font-size: 14px; font-weight: 600; color: #92400e;">Tolérance (85-115%)</span>
                </div>
                <div style="font-size: 32px; font-weight: 800; color: #f59e0b; margin-bottom: 5px;">${daysInTolerance}</div>
                <div style="font-size: 14px; color: #92400e; margin-bottom: 10px;">jours</div>
                <div style="background: #fed7aa; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #92400e;">
                    ${percentInTolerance}% des jours avec conso
                </div>
            </div>
            
            <!-- ≥115% du forfait (Hors tolérance) -->
            <div style="background: #fee2e2; border-radius: 16px; padding: 18px; border: 2px solid #ef4444;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <div style="width: 32px; height: 32px; background: #ef4444; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 18px; color: white;">🔴</span>
                    </div>
                    <span style="font-size: 14px; font-weight: 600; color: #991b1b;">Hors tolérance (≥115%)</span>
                </div>
                <div style="font-size: 32px; font-weight: 800; color: #ef4444; margin-bottom: 5px;">${daysAbove115}</div>
                <div style="font-size: 14px; color: #991b1b; margin-bottom: 10px;">jours</div>
                <div style="background: #fecaca; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #991b1b;">
                    ${percentAbove115}% des jours avec conso
                </div>
            </div>
        `;
        
        forfaitCard.appendChild(row3);
        
        // Ligne 4 : Événements énergie épuisée
        const row4 = document.createElement('div');
        row4.style.cssText = `
            margin-top: 15px;
            padding: 18px;
            background: ${daysWithSuspendE > 0 ? '#fee2e2' : '#f8fafc'};
            border-radius: 12px;
            border: 2px solid ${daysWithSuspendE > 0 ? '#ef4444' : '#e2e8f0'};
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;
        
        // Barre de progression
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            margin-top: 20px;
            padding: 15px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        `;
        
        progressBar.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #64748b;">
                <span>Répartition sur ${daysWithConsumption} jours avec consommation</span>
                <span>Seuils: 85% (${seuil85.toFixed(0)}Wh) et 115% (${maxWithTolerance.toFixed(0)}Wh)</span>
            </div>
            
            <!-- Barre de progression avec 3 segments -->
            <div style="background: #f1f5f9; border-radius: 30px; height: 40px; overflow: hidden; display: flex; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 15px;">
                <!-- Normal (≤85%) -->
                <div style="width: ${percentBelow85}%; height: 100%; background: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white;">
                    ${percentBelow85 > 5 ? percentBelow85 + '%' : ''}
                </div>
                <!-- Tolérance (85-115%) -->
                <div style="width: ${percentInTolerance}%; height: 100%; background: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white;">
                    ${percentInTolerance > 5 ? percentInTolerance + '%' : ''}
                </div>
                <!-- Hors tolérance (>115%) -->
                <div style="width: ${percentAbove115}%; height: 100%; background: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white;">
                    ${percentAbove115 > 5 ? percentAbove115 + '%' : ''}
                </div>
            </div>
            
            <!-- Légende détaillée -->
            <div style="display: flex; flex-wrap: wrap; gap: 15px; justify-content: space-between; margin-top: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 16px; height: 16px; background: #22c55e; border-radius: 4px;"></span>
                    <span style="font-size: 12px; color: #166534;">
                        <strong>${daysBelow85} jours</strong> (≤${seuil85.toFixed(0)}Wh) · ${percentBelow85}%
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 16px; height: 16px; background: #f59e0b; border-radius: 4px;"></span>
                    <span style="font-size: 12px; color: #92400e;">
                        <strong>${daysInTolerance} jours</strong> (${seuil85.toFixed(0)}-${maxWithTolerance.toFixed(0)}Wh) · ${percentInTolerance}%
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 16px; height: 16px; background: #ef4444; border-radius: 4px;"></span>
                    <span style="font-size: 12px; color: #991b1b;">
                        <strong>${daysAbove115} jours</strong> (>${maxWithTolerance.toFixed(0)}Wh) · ${percentAbove115}%
                    </span>
                </div>
            </div>
        `;
        
        forfaitCard.appendChild(progressBar);
        
        content.appendChild(forfaitCard);
    });
    
    analysisDiv.appendChild(content);
    return analysisDiv;
}
// Fonction pour dessiner les cercles de progression
function drawEnergyGauges(clientNumber, limits, tolerance, out) {
    // Jauge limites (verte)
    const canvasLimits = document.getElementById(`gauge-limits-${clientNumber}`);
    if (canvasLimits) {
        const ctx = canvasLimits.getContext('2d');
        const centerX = 60;
        const centerY = 60;
        const radius = 50;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (limits / 100) * 2 * Math.PI;

        ctx.clearRect(0, 0, 120, 120);
        
        // Fond
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 12;
        ctx.stroke();

        // Progression
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 12;
        ctx.stroke();
    }

    // Jauge tolérance (orange)
    const canvasTolerance = document.getElementById(`gauge-tolerance-${clientNumber}`);
    if (canvasTolerance) {
        const ctx = canvasTolerance.getContext('2d');
        const centerX = 60;
        const centerY = 60;
        const radius = 50;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (tolerance / 100) * 2 * Math.PI;

        ctx.clearRect(0, 0, 120, 120);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 12;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 12;
        ctx.stroke();
    }

    // Jauge hors tolérance (rouge)
    const canvasOut = document.getElementById(`gauge-out-${clientNumber}`);
    if (canvasOut) {
        const ctx = canvasOut.getContext('2d');
        const centerX = 60;
        const centerY = 60;
        const radius = 50;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (out / 100) * 2 * Math.PI;

        ctx.clearRect(0, 0, 120, 120);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 12;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 12;
        ctx.stroke();
    }
}

//============================ANALYSE CREDIT ET RECHARGE=========================
function createClientCreditAnalysis(clientNumber) {
    const analysisDiv = document.createElement('div');
    analysisDiv.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        margin-bottom: 20px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
    `;
    
    // En-tête compact
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%);
        color: white;
        padding: 10px 18px;
        font-size: 15px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    header.innerHTML = `💰 Crédit & Recharges - Client ${clientNumber}`;
    analysisDiv.appendChild(header);
    
    const content = document.createElement('div');
    content.style.cssText = `padding: 15px;`;

    // Analyser les données de solde
    const creditData = combinedSoldeData.map(row => ({
        date: row['Date et Heure'],
        value: parseFloat(row[`Credit${clientNumber}`]) || 0
    })).filter(d => !isNaN(d.value) && d.value !== null);
    
    // Analyser les données de recharge
    const rechargeAnalysis = analyzeRechargeData(clientNumber);
    
    if (creditData.length === 0 && !rechargeAnalysis.hasData) {
        content.innerHTML = `<div style="text-align: center; padding: 25px; color: #94a3b8;">Aucune donnée</div>`;
    } else {
        
        // === SÉRIES CONSÉCUTIVES SANS CRÉDIT ===
        const streaksCard = createDaysWithoutCreditCard(clientNumber);
        content.appendChild(streaksCard);
        
        // === HABITUDES DE RECHARGE ===
        if (rechargeAnalysis.hasData && rechargeAnalysis.purchaseDays.length > 0) {
            const totalPurchases = rechargeAnalysis.purchaseDays.length;
            
            // 1. HABITUDE DE RECHARGE (par nombre de jours spécifiques)
            const daysCountMap = new Map();
            rechargeAnalysis.purchaseDays.forEach(item => {
                const days = item.days;
                daysCountMap.set(days, (daysCountMap.get(days) || 0) + 1);
            });
            
            const sortedDays = Array.from(daysCountMap.entries()).sort((a, b) => b[0] - a[0]);
            
            let mainHabit = { days: 0, count: 0, percentage: 0 };
            sortedDays.forEach(([days, count]) => {
                if (count > mainHabit.count) {
                    mainHabit = { days, count, percentage: (count / totalPurchases * 100).toFixed(1) };
                }
            });
            
            // 2. RÉPARTITION PAR INTERVALLES
            let intervalJours = 0;      // 1-6 jours
            let intervalSemaine = 0;    // 7-29 jours
            let intervalMois = 0;        // >=30 jours
            
            rechargeAnalysis.purchaseDays.forEach(item => {
                const days = item.days;
                if (days >= 1 && days <= 6) intervalJours++;
                else if (days >= 7 && days <= 28) intervalSemaine++;
                else if (days >= 29) intervalMois++;
            });
            
            const percentJours = totalPurchases > 0 ? (intervalJours / totalPurchases * 100).toFixed(1) : 0;
            const percentSemaine = totalPurchases > 0 ? (intervalSemaine / totalPurchases * 100).toFixed(1) : 0;
            const percentMois = totalPurchases > 0 ? (intervalMois / totalPurchases * 100).toFixed(1) : 0;
            
            const intervals = [
                { name: 'Jours', value: intervalJours, percent: percentJours, color: '#f97316', range: '1-6j' },
                { name: 'Semaine', value: intervalSemaine, percent: percentSemaine, color: '#3b82f6', range: '7-28j' },
                { name: 'Mois', value: intervalMois, percent: percentMois, color: '#22c55e', range: '>28j' }
            ];
            
            const mainInterval = intervals.reduce((max, interval) => 
                interval.value > max.value ? interval : max
            );
            
            const habitSection = document.createElement('div');
            habitSection.style.cssText = `
                background: #f8fafc;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                border: 1px solid #e2e8f0;
            `;
            
            // Construction de la barre d'habitude (détail par jour)
            let habitBarHTML = '';
            let habitLegendHTML = '';
            
            sortedDays.forEach(([days, count]) => {
                const percentage = (count / totalPurchases * 100).toFixed(1);
                const isMain = days === mainHabit.days;
                
                let bgColor = '';
                if (days >= 30) bgColor = '#22c55e';
                else if (days >= 20) bgColor = '#84cc16';
                else if (days >= 15) bgColor = '#eab308';
                else if (days >= 10) bgColor = '#f97316';
                else if (days >= 7) bgColor = '#ef4444';
                else if (days >= 5) bgColor = '#ec4899';
                else if (days >= 3) bgColor = '#8b5cf6';
                else bgColor = '#94a3b8';
                
                habitBarHTML += `
                    <div style="width: ${percentage}%; height: 100%; background: ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: white; position: relative;" title="${days}j : ${percentage}%">
                        ${percentage > 8 ? percentage + '%' : ''}
                        ${isMain ? '<span style="position: absolute; top: -6px; font-size: 12px;">⭐</span>' : ''}
                    </div>
                `;
                
                habitLegendHTML += `
                    <span style="display: flex; align-items: center; gap: 3px; font-size: 9px;">
                        <span style="width: 8px; height: 8px; background: ${bgColor}; border-radius: 2px;"></span>
                        ${days}j ${percentage}%${isMain ? ' ⭐' : ''}
                    </span>
                `;
            });
            
            habitSection.innerHTML = `
                <!-- Habitude de recharge (détail) -->
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span style="font-size: 16px;">📊</span>
                            <span style="font-weight: 600; font-size: 13px;">Habitudes de recharge</span>
                        </div>
                        <span style="background: #e2e8f0; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600;">
                            ${totalPurchases} recharges
                        </span>
                    </div>
                    
                    <!-- Barre de progression avec tooltips -->
                    <div style="height: 36px; background: #f1f5f9; border-radius: 18px; overflow: hidden; display: flex; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                        ${sortedDays.map(([days, count]) => {
                            const percentage = (count / totalPurchases * 100).toFixed(1);
                            const isMain = days === mainHabit.days;
                            
                            let bgColor = '';
                            if (days >= 30) bgColor = '#22c55e';
                            else if (days >= 20) bgColor = '#84cc16';
                            else if (days >= 15) bgColor = '#eab308';
                            else if (days >= 10) bgColor = '#f97316';
                            else if (days >= 7) bgColor = '#ef4444';
                            else if (days >= 5) bgColor = '#ec4899';
                            else if (days >= 3) bgColor = '#8b5cf6';
                            else bgColor = '#94a3b8';
                            
                            // Ajouter un effet de bordure pour l'habitude principale
                            const borderStyle = isMain ? 'border: 2px solid #00000040; box-sizing: border-box;' : '';
                            
                            return `
                                <div style="width: ${percentage}%; height: 100%; background: ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; ${borderStyle} transition: all 0.2s;" 
                                    title="${days} jours : ${count} recharge(s) (${percentage}%)"
                                    onmouseover="this.style.opacity='0.9'"
                                    onmouseout="this.style.opacity='1'">
                                    ${percentage > 8 ? percentage + '%' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <!-- Légende améliorée avec indicateur principal -->
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 5px; padding: 5px; background: #f8fafc; border-radius: 6px;">
                        ${sortedDays.map(([days, count]) => {
                            const percentage = (count / totalPurchases * 100).toFixed(1);
                            const isMain = days === mainHabit.days;
                            
                            let bgColor = '';
                            if (days >= 30) bgColor = '#22c55e';
                            else if (days >= 20) bgColor = '#84cc16';
                            else if (days >= 15) bgColor = '#eab308';
                            else if (days >= 10) bgColor = '#f97316';
                            else if (days >= 7) bgColor = '#ef4444';
                            else if (days >= 5) bgColor = '#ec4899';
                            else if (days >= 3) bgColor = '#8b5cf6';
                            else bgColor = '#94a3b8';
                            
                            return `
                                <div style="display: flex; align-items: center; gap: 5px; ${isMain ? 'background: #f1f5f9; padding: 2px 8px; border-radius: 16px; border: 1px solid #cbd5e1;' : ''}">
                                    <div style="width: 12px; height: 12px; background: ${bgColor}; border-radius: 3px; ${isMain ? 'box-shadow: 0 0 0 2px white, 0 0 0 3px ' + bgColor + ';' : ''}"></div>
                                    <span style="font-size: 11px; color: #334155;">
                                        <strong>${days}j</strong>
                                        <span style="color: #64748b;"> ${count}x</span>
                                        <span style="color: #475569; font-weight: 600;"> ${percentage}%</span>
                                        ${isMain ? '<span style="margin-left: 4px; font-size: 12px;">👑</span>' : ''}
                                    </span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <!-- Indication visuelle de l'habitude principale -->
                    <div style="background: #f1f5f9; padding: 6px 10px; border-radius: 6px; font-size: 11px; color: #334155; display: flex; align-items: center; gap: 8px; border-left: 3px solid #9f7aea;">
                        <span style="font-size: 14px;">👉</span>
                        <span><strong>Habitude principale :</strong> <span style="background: #9f7aea20; color: #7e22ce; padding: 2px 10px; border-radius: 20px; font-weight: 700;">${mainHabit.days} jours</span> (${mainHabit.percentage}% des recharges)</span>
                    </div>
                </div>
                
                <!-- Séparateur -->
                <div style="height: 1px; background: #e2e8f0; margin: 10px 0;"></div>
                
                <!-- Répartition par intervalles -->
                <div style="margin-top: 10px;">
                    <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 8px;">
                        <span style="font-size: 14px;">📈</span>
                        <span style="font-weight: 600; font-size: 12px;">Répartition par intervalle</span>
                    </div>
                    
                    <div style="height: 36px; background: #f1f5f9; border-radius: 18px; overflow: hidden; display: flex; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="width: ${percentJours}%; height: 100%; background: #f97316; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; transition: all 0.2s;" 
                            title="1-6 jours : ${intervalJours} recharge(s) (${percentJours}%)"
                            onmouseover="this.style.opacity='0.9'"
                            onmouseout="this.style.opacity='1'">
                            ${percentJours > 8 ? percentJours + '%' : ''}
                        </div>
                        <div style="width: ${percentSemaine}%; height: 100%; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; transition: all 0.2s;" 
                            title="7-29 jours : ${intervalSemaine} recharge(s) (${percentSemaine}%)"
                            onmouseover="this.style.opacity='0.9'"
                            onmouseout="this.style.opacity='1'">
                            ${percentSemaine > 8 ? percentSemaine + '%' : ''}
                        </div>
                        <div style="width: ${percentMois}%; height: 100%; background: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; transition: all 0.2s;" 
                            title="≥30 jours : ${intervalMois} recharge(s) (${percentMois}%)"
                            onmouseover="this.style.opacity='0.9'"
                            onmouseout="this.style.opacity='1'">
                            ${percentMois > 8 ? percentMois + '%' : ''}
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-around; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 5px; ${mainInterval.name === 'Jours' ? 'background: #f1f5f9; padding: 3px 10px; border-radius: 20px;' : ''}">
                            <div style="width: 14px; height: 14px; background: #f97316; border-radius: 3px; ${mainInterval.name === 'Jours' ? 'box-shadow: 0 0 0 2px white, 0 0 0 3px #f97316;' : ''}"></div>
                            <span style="font-size: 11px;"><strong>Jours</strong> 1-6j: ${intervalJours}x (${percentJours}%)</span>
                            ${mainInterval.name === 'Jours' ? '<span style="font-size: 14px;">👑</span>' : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; ${mainInterval.name === 'Semaine' ? 'background: #f1f5f9; padding: 3px 10px; border-radius: 20px;' : ''}">
                            <div style="width: 14px; height: 14px; background: #3b82f6; border-radius: 3px; ${mainInterval.name === 'Semaine' ? 'box-shadow: 0 0 0 2px white, 0 0 0 3px #3b82f6;' : ''}"></div>
                            <span style="font-size: 11px;"><strong>Semaine</strong> 7-28j: ${intervalSemaine}x (${percentSemaine}%)</span>
                            ${mainInterval.name === 'Semaine' ? '<span style="font-size: 14px;">👑</span>' : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; ${mainInterval.name === 'Mois' ? 'background: #f1f5f9; padding: 3px 10px; border-radius: 20px;' : ''}">
                            <div style="width: 14px; height: 14px; background: #22c55e; border-radius: 3px; ${mainInterval.name === 'Mois' ? 'box-shadow: 0 0 0 2px white, 0 0 0 3px #22c55e;' : ''}"></div>
                            <span style="font-size: 11px;"><strong>Mois</strong> >28j: ${intervalMois}x (${percentMois}%)</span>
                            ${mainInterval.name === 'Mois' ? '<span style="font-size: 14px;">👑</span>' : ''}
                        </div>
                    </div>
                    
                    <div style="background: #f1f5f9; padding: 6px 10px; border-radius: 6px; font-size: 11px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px;">🏆</span>
                        <span><strong>Intervalle principal :</strong> <span style="background: ${mainInterval.color}20; color: ${mainInterval.color}; padding: 2px 12px; border-radius: 20px; font-weight: 700;">${mainInterval.name}</span> (${mainInterval.percent}%, ${mainInterval.range})</span>
                    </div>
                </div>
                
                <!-- Bouton -->
                <button id="toggle-credit-${clientNumber}" style="width:100%; padding:8px; margin-top:12px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;">
                    <span style="font-size:14px;">🔽</span> Afficher les détails
                </button>
            `;
            
            content.appendChild(habitSection);
            
            // === TABLEAUX DÉTAILS (cachés) - VERSION ORIGINALE RESTAURÉE ===
            const detailsContainer = document.createElement('div');
            detailsContainer.id = `credit-details-${clientNumber}`;
            detailsContainer.style.cssText = `display: none; margin-top: 15px;`;
            
            // Tableau des recharges - Version originale
            if (rechargeAnalysis.hasData) {
                const rechargeTable = document.createElement('div');
                rechargeTable.style.cssText = `
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    overflow: hidden;
                    margin-bottom: 20px;
                `;
                
                const tableHeader = document.createElement('div');
                tableHeader.style.cssText = `
                    background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%);
                    color: white;
                    padding: 15px 20px;
                    font-size: 16px;
                    font-weight: 700;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                `;
                tableHeader.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 20px;">⚡</span>
                        Historique des recharges
                    </span>
                    <span style="background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 30px; font-size: 13px;">
                        ${rechargeAnalysis.totalRecharges} opération(s)
                    </span>
                `;
                
                const tableWrapper = document.createElement('div');
                tableWrapper.style.cssText = `
                    max-height: 350px;
                    overflow-y: auto;
                    overflow-x: auto;
                    background: white;
                `;
                
                let tableHTML = `
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 700px;">
                        <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10;">
                            <tr style="border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px 10px; text-align: left;">Date</th>
                                <th style="padding: 12px 10px; text-align: center;">Code 3 (jours)</th>
                                <th style="padding: 12px 10px; text-align: center;">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                const sortedRecharges = [...combinedRechargeData]
                    .filter(row => row['Code 1']?.toString().trim() === clientNumber.toString())
                    .sort((a, b) => new Date(b['Date et Heure']) - new Date(a['Date et Heure']));
                
                sortedRecharges.forEach((row, index) => {
                    const date = row['Date et Heure'] || '-';
                    const code3 = row['Code 3'] || '-';
                    const status = row['Status'] || '-';
                    
                    const statusColor = status.toLowerCase().includes('reussie') ? '#22c55e' : 
                                    status.toLowerCase().includes('echoue') ? '#ef4444' : '#f59e0b';
                    
                    const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
                    
                    tableHTML += `
                        <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                            <td style="padding: 10px; white-space: nowrap;">${date}</td>
                            <td style="padding: 10px; text-align: center; font-weight: 600; color: #f97316;">${code3}</td>
                            <td style="padding: 10px; text-align: center;">
                                <span style="background: ${statusColor}20; color: ${statusColor}; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 11px;">
                                    ${status}
                                </span>
                            </td>
                        </tr>
                    `;
                });
                
                tableHTML += `</tbody></table>`;
                tableWrapper.innerHTML = tableHTML;
                rechargeTable.appendChild(tableHeader);
                rechargeTable.appendChild(tableWrapper);
                detailsContainer.appendChild(rechargeTable);
            }
            
            // Tableau des soldes - Version originale
            if (creditData.length > 0) {
                const soldeTable = document.createElement('div');
                soldeTable.style.cssText = `
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    overflow: hidden;
                    margin-bottom: 20px;
                `;
                
                const soldeHeader = document.createElement('div');
                soldeHeader.style.cssText = `
                    background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                    color: white;
                    padding: 15px 20px;
                    font-size: 16px;
                    font-weight: 700;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                `;
                soldeHeader.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 20px;">💰</span>
                        Historique des soldes (crédits)
                    </span>
                    <span style="background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 30px; font-size: 13px;">
                        ${creditData.length} relevé(s)
                    </span>
                `;
                
                const soldeWrapper = document.createElement('div');
                soldeWrapper.style.cssText = `
                    max-height: 350px;
                    overflow-y: auto;
                    overflow-x: auto;
                    background: white;
                `;
                
                const clientSoldeData = [...combinedSoldeData]
                    .filter(row => row[`Credit${clientNumber}`] && row[`Credit${clientNumber}`].toString().trim() !== '')
                    .sort((a, b) => new Date(b['Date et Heure']) - new Date(a['Date et Heure']));
                
                let soldeHTML = `
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 400px;">
                        <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10;">
                            <tr style="border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px 10px; text-align: left;">Date</th>
                                <th style="padding: 12px 10px; text-align: center;">Crédit (jours)</th>
                                <th style="padding: 12px 10px; text-align: center;">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                clientSoldeData.forEach((row, index) => {
                    const date = row['Date et Heure'] || '-';
                    const value = parseFloat(row[`Credit${clientNumber}`]) || 0;
                    const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
                    
                    soldeHTML += `
                        <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                            <td style="padding: 10px; white-space: nowrap;">${date}</td>
                            <td style="padding: 10px; text-align: center; font-weight: 600; color: ${value === 0 ? '#ef4444' : '#48bb78'};">${value}</td>
                            <td style="padding: 10px; text-align: center;">
                                ${value === 0 ? 
                                    '<span style="background: #ef444420; color: #ef4444; padding: 3px 10px; border-radius: 20px; font-size: 11px;">Sans crédit</span>' : 
                                    '<span style="background: #48bb7820; color: #48bb78; padding: 3px 10px; border-radius: 20px; font-size: 11px;">Crédit disponible</span>'}
                            </td>
                        </tr>
                    `;
                });
                
                soldeHTML += `</tbody></table>`;
                soldeWrapper.innerHTML = soldeHTML;
                soldeTable.appendChild(soldeHeader);
                soldeTable.appendChild(soldeWrapper);
                detailsContainer.appendChild(soldeTable);
            }
            
            content.appendChild(detailsContainer);
            
            // Événement bouton
            setTimeout(() => {
                const btn = document.getElementById(`toggle-credit-${clientNumber}`);
                const details = document.getElementById(`credit-details-${clientNumber}`);
                if (btn && details) {
                    btn.addEventListener('click', () => {
                        if (details.style.display === 'none') {
                            details.style.display = 'block';
                            btn.innerHTML = `<span style="font-size:14px;">🔼</span> Masquer les détails`;
                        } else {
                            details.style.display = 'none';
                            btn.innerHTML = `<span style="font-size:14px;">🔽</span> Afficher les détails`;
                        }
                    });
                }
            }, 100);
        }
    }
    
    analysisDiv.appendChild(content);
    return analysisDiv;
}
// ==================== CARTE DES JOURS SANS CRÉDIT ====================
function createDaysWithoutCreditCard(clientNumber) {
    const analysis = analyzeDaysWithoutCredit(clientNumber);
    
    const card = document.createElement('div');
    card.style.cssText = `
        background: white;
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
    `;
    
    if (!analysis.hasData || analysis.consecutiveDays.filter(group => group.length > 1).length === 0) {
        const noData = document.createElement('div');
        noData.style.cssText = `
            padding: 10px;
            text-align: center;
            color: #64748b;
            background: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            font-size: 11px;
        `;
        noData.innerHTML = `
            <span style="font-size: 14px;">🔗</span>
            <span>Aucune série >1 jour sans crédit</span>
        `;
        card.appendChild(noData);
        return card;
    }
    
    const content = document.createElement('div');
    content.style.cssText = `padding: 12px;`;
    
    const significantStreaks = analysis.consecutiveDays.filter(group => group.length > 1);
    
    if (significantStreaks.length > 0) {
        const streaksSection = document.createElement('div');
        streaksSection.innerHTML = `
            <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 10px;">
                <span style="font-size: 16px;">🔗</span>
                <span style="font-weight: 600; font-size: 13px;">Séries sans crédit (>1 jour)</span>
                <span style="margin-left: auto; background: #e2e8f0; padding: 2px 8px; border-radius: 12px; font-size: 10px;">
                    ${significantStreaks.length}
                </span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${significantStreaks.map((group, idx) => {
                    const start = new Date(group[0].date).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit'
                    });
                    const end = new Date(group[group.length - 1].date).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit'
                    });
                    const isLongest = group.length === analysis.longestStreak;
                    
                    return `
                        <div style="background: white; padding: 8px 10px; border-radius: 6px; border-left: 3px solid ${isLongest ? '#ef4444' : '#f97316'}; min-width: 140px; flex: 1 1 auto; border: 1px solid #e2e8f0; font-size: 11px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
                                <span style="color: #64748b;">#${idx+1}</span>
                                ${isLongest ? '<span style="background: #ef4444; color: white; padding: 1px 6px; border-radius: 10px; font-size: 8px;">MAX</span>' : ''}
                            </div>
                            <div style="font-weight: 700; color: ${isLongest ? '#ef4444' : '#f97316'}; font-size: 16px;">${group.length} jours</div>
                            <div style="color: #475569;">${start} → ${end}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        content.appendChild(streaksSection);
    }
    
    card.appendChild(content);
    return card;
}
// ==================== ANALYSE DES DÉPASSEMENTS DE TENSION À 14.0V/28V ====================
function analyzeVoltageThresholdExceedances(tensionData, systemType = null) {
    if (!tensionData || tensionData.length === 0) {
        return { threshold: 0, days: [] };
    }
    
    // Déterminer le système si non fourni
    if (!systemType) {
        systemType = detectSystemType(tensionData);
    }
    
    // Définir le seuil selon le système
    const threshold = systemType === '24V' ? 28.0 : 14.0;
    
    // Organiser les données par jour
    const dailyData = {};
    
    tensionData.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const dateTimeStr = row['Date et Heure'];
        const [date, time] = dateTimeStr.split(' ');
        if (!date || !time) return;
        
        // Récupérer les valeurs de tension
        const tMoy = parseFloat(row['T_moy']) || 0;
        const tMax = parseFloat(row['T_max']) || 0;
        
        if (!dailyData[date]) {
            dailyData[date] = {
                date: date,
                formattedDate: new Date(date).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                }),
                exceedances: [], // Stocker chaque dépassement avec heure et valeur
                count: 0,
                maxValue: 0
            };
        }
        
        // Vérifier les dépassements (utiliser T_moy ou T_max selon disponibilité)
        let exceededValue = null;
        let exceededTime = null;
        
        if (tMoy >= threshold) {
            exceededValue = tMoy;
            exceededTime = time;
        } else if (tMax >= threshold) {
            exceededValue = tMax;
            exceededTime = time;
        }
        
        if (exceededValue !== null) {
            dailyData[date].exceedances.push({
                time: time,
                value: exceededValue,
                timeFormatted: time.substring(0, 5) // HH:MM
            });
            dailyData[date].count++;
            dailyData[date].maxValue = Math.max(dailyData[date].maxValue, exceededValue);
        }
    });
    
    // Convertir en tableau et trier par date (plus récente en premier)
    const days = Object.values(dailyData)
        .map(day => ({
            ...day,
            // Trier les dépassements par heure
            exceedances: day.exceedances.sort((a, b) => a.time.localeCompare(b.time))
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return {
        threshold: threshold,
        systemType: systemType,
        days: days,
        totalDaysWithExceedance: days.filter(d => d.count > 0).length,
        totalExceedances: days.reduce((sum, day) => sum + day.count, 0)
    };
}

function createVoltageThresholdTable() {
    const container = document.getElementById('voltage-threshold-table-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Récupérer les données avec les filtres globaux
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    if (dataToUse.length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px;">
                📊 Aucune donnée de tension disponible
            </div>
        `;
        return;
    }
    
    // Analyser les dépassements
    const analysis = analyzeVoltageThresholdExceedances(dataToUse);
    
    // Créer la carte
    const card = document.createElement('div');
    card.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
        overflow: hidden;
        border: 1px solid #e2e8f0;
        margin-bottom: 20px;
    `;
    
    // En-tête de la carte
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        color: white;
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
    `;
    
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">⚡</span>
            <span>Tensions ≥ ${analysis.threshold}V (Système ${analysis.systemType})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 20px; font-size: 11px;">
                📊 ${analysis.totalDaysWithExceedance} jour(s) concerné(s)
            </span>
            <span style="background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 20px; font-size: 11px;">
                ⚡ ${analysis.totalExceedances} dépassement(s)
            </span>
        </div>
    `;
    
    card.appendChild(header);
    
    // Légende des couleurs
    const legend = document.createElement('div');
    legend.style.cssText = `
        padding: 10px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
        font-size: 11px;
    `;
    
    legend.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 14px; height: 14px; background: #22c55e; border-radius: 3px;"></div>
            <span style="color: #166534;"><strong>≥4</strong> atteintes</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 14px; height: 14px; background: #eab308; border-radius: 3px;"></div>
            <span style="color: #854d0e;"><strong>3</strong> atteintes</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 14px; height: 14px; background: #f97316; border-radius: 3px;"></div>
            <span style="color: #9a3412;"><strong>2</strong> atteintes</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 14px; height: 14px; background: #f59e0b; border-radius: 3px;"></div>
            <span style="color: #92400e;"><strong>1</strong> atteinte</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 14px; height: 14px; background: #ef4444; border-radius: 3px;"></div>
            <span style="color: #991b1b;"><strong>0</strong> atteinte</span>
        </div>
    `;
    
    card.appendChild(legend);
    
    // Conteneur du tableau avec hauteur fixe et scroll
    const tableWrapper = document.createElement('div');
    tableWrapper.style.cssText = `
        max-height: 350px;
        overflow-y: auto;
        overflow-x: auto;
        position: relative;
        scrollbar-width: thin;
    `;
    
    // Créer le tableau
    const table = document.createElement('table');
    table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        min-width: 700px;
    `;
    
    // En-tête du tableau (fixe)
    const thead = document.createElement('thead');
    thead.style.cssText = `
        position: sticky;
        top: 0;
        z-index: 10;
        background: white;
    `;
    
    const headerRow = document.createElement('tr');
    headerRow.style.cssText = `
        background: #f1f5f9;
        border-bottom: 2px solid #cbd5e1;
    `;
    
    const headers = [
        { text: '📅 Date', width: '120px' },
        { text: `⚡ Atteintes ≥${analysis.threshold}V`, width: '100px', align: 'center' },
        { text: '🔍 Heures d\'atteinte', width: 'auto' }
    ];
    
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header.text;
        th.style.cssText = `
            padding: 10px 8px;
            text-align: ${header.align || 'left'};
            font-weight: 600;
            color: #334155;
            background: #f1f5f9;
            border-bottom: 2px solid #cbd5e1;
            white-space: nowrap;
            min-width: ${header.width};
        `;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Corps du tableau
    const tbody = document.createElement('tbody');
    
    // Récupérer tous les jours uniques des données
    const allDates = new Set();
    dataToUse.forEach(row => {
        if (row['Date et Heure']) {
            const date = row['Date et Heure'].split(' ')[0];
            allDates.add(date);
        }
    });
    
    // Créer un map pour faciliter l'accès
    const exceedanceMap = {};
    analysis.days.forEach(day => {
        exceedanceMap[day.date] = day;
    });
    
    // Trier les dates (plus récente en premier)
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(b) - new Date(a));
    
    sortedDates.forEach((date, index) => {
        const dayData = exceedanceMap[date] || {
            date: date,
            formattedDate: new Date(date).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            }),
            count: 0,
            exceedances: []
        };
        
        // Déterminer la couleur de fond selon le nombre d'atteintes
        let bgColor = '#fee2e2'; // Rouge
        let textColor = '#991b1b';
        
        if (dayData.count >= 4) {
            bgColor = '#dcfce7'; // Vert
            textColor = '#166534';
        } else if (dayData.count === 3) {
            bgColor = '#fef9c3'; // Jaune
            textColor = '#854d0e';
        } else if (dayData.count === 2) {
            bgColor = '#ffedd5'; // Orange
            textColor = '#9a3412';
        } else if (dayData.count === 1) {
            bgColor = '#fef3c7'; // Jaune clair
            textColor = '#92400e';
        }
        
        const tr = document.createElement('tr');
        tr.style.cssText = `
            border-bottom: 1px solid #e2e8f0;
            background: ${bgColor};
        `;
        
        // Date
        const tdDate = document.createElement('td');
        tdDate.style.cssText = `
            padding: 10px 8px;
            font-weight: 500;
            color: ${textColor};
            white-space: nowrap;
        `;
        tdDate.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 600;">${dayData.formattedDate}</span>
                <span style="font-size: 9px; color: ${textColor}80;">${date}</span>
            </div>
        `;
        tr.appendChild(tdDate);
        
        // Nombre d'atteintes
        const tdCount = document.createElement('td');
        tdCount.style.cssText = `
            padding: 10px 8px;
            text-align: center;
            font-weight: 700;
            color: ${textColor};
        `;
        
        let statusIcon = '';
        if (dayData.count >= 4) statusIcon = '⭐ Excellente';
        else if (dayData.count === 3) statusIcon = '👍 Très bien';
        else if (dayData.count === 2) statusIcon = '🟡 Correct';
        else if (dayData.count === 1) statusIcon = '⚠️ Faible';
        else statusIcon = '🔴 Nulle';
        
        tdCount.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center;">
                <span style="font-size: 20px; font-weight: 800;">${dayData.count}</span>
                <span style="font-size: 9px; color: ${textColor}80;">${statusIcon}</span>
            </div>
        `;
        tr.appendChild(tdCount);
        
        // Heures d'atteinte
        const tdHours = document.createElement('td');
        tdHours.style.cssText = `
            padding: 10px 8px;
            color: ${textColor};
        `;
        
        if (dayData.count > 0) {
            const hoursHtml = dayData.exceedances.map(ex => {
                return `
                    <span style="display: inline-block; background: white; padding: 3px 10px; border-radius: 16px; margin: 0 4px 4px 0; border: 1px solid ${textColor}30; font-size: 11px; font-weight: 500;">
                        <strong>${ex.timeFormatted}</strong> 
                        <span style="color: ${ex.value >= analysis.threshold + 1 ? '#ef4444' : textColor};">${ex.value.toFixed(1)}V</span>
                    </span>
                `;
            }).join('');
            
            tdHours.innerHTML = `<div style="display: flex; flex-wrap: wrap; gap: 4px;">${hoursHtml}</div>`;
        } else {
            tdHours.innerHTML = `
                <span style="color: #991b1b; font-style: italic; font-size: 11px; display: flex; align-items: center; gap: 4px;">
                    <span>⏱️</span> Aucune atteinte
                </span>
            `;
        }
        
        tr.appendChild(tdHours);
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    card.appendChild(tableWrapper);
    
    // ✅ AJOUT DU GRAPHIQUE EN COURBE
    const chartContainer = document.createElement('div');
    chartContainer.id = 'voltage-threshold-chart';
    chartContainer.style.cssText = `
        padding: 20px 25px;
        background: white;
        border-top: 1px solid #e2e8f0;
        height: 480px; /* Hauteur ajustée pour l'info supplémentaire */
        position: relative;
        display: flex;
        flex-direction: column;
    `;
    
    const chartTitle = document.createElement('div');
    chartTitle.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        flex-wrap: wrap;
        gap: 15px;
        flex-shrink: 0;
    `;
    chartTitle.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <span style="font-size: 16px; font-weight: 700; color: #0f172a;">
                📈 Évolution quotidienne des atteintes
            </span>
            <span style="background: #e2e8f0; padding: 6px 16px; border-radius: 30px; font-size: 12px; font-weight: 600; color: #334155;">
                ${analysis.days.length} jours analysés
            </span>
        </div>
        <div style="display: flex; align-items: center; gap: 20px;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 14px; height: 14px; background: #22c55e; border-radius: 3px;"></div>
                <span style="font-size: 11px; color: #166534; font-weight: 500;">≥4 (Bon)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 14px; height: 14px; background: #eab308; border-radius: 3px;"></div>
                <span style="font-size: 11px; color: #854d0e; font-weight: 500;">2-3 (Moyen)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 14px; height: 14px; background: #f97316; border-radius: 3px;"></div>
                <span style="font-size: 11px; color: #9a3412; font-weight: 500;">1 (Faible)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 14px; height: 14px; background: #ef4444; border-radius: 3px;"></div>
                <span style="font-size: 11px; color: #991b1b; font-weight: 500;">0 (Critique)</span>
            </div>
        </div>
    `;
    chartContainer.appendChild(chartTitle);
    
    // Conteneur du canvas - prend la majorité de l'espace
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        height: 320px; /* Hauteur du graphique */
        position: relative;
        margin-bottom: 10px;
        flex-shrink: 0;
    `;
    
    const canvas = document.createElement('canvas');
    canvas.id = 'voltage-threshold-chart-canvas';
    canvas.style.cssText = `
        width: 100%;
        height: 100%;
        display: block;
    `;
    
    canvasContainer.appendChild(canvas);
    chartContainer.appendChild(canvasContainer);
    
    // ✅ INFORMATION SUR LA LIGNE VERTE (juste après le graphique)
    const chartInfo = document.createElement('div');
    chartInfo.style.cssText = `
        margin: 5px 0 0 0;
        padding: 10px 15px;
        background: #f0f9ff;
        border-radius: 10px;
        font-size: 11px;
        color: #0369a1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border: 1px solid #7dd3fc;
        flex-shrink: 0;
    `;
    chartInfo.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="background: #22c55e; width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">📏</span>
            <span><strong style="color: #166534;">Ligne verte pointillée</strong> = Seuil recommandé (4 atteintes)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 15px;">
            <span>⬆️ <strong style="color: #166534;">Au-dessus</strong> = ✅ Conforme</span>
            <span>⬇️ <strong style="color: #991b1b;">En-dessous</strong> = ⚠️ Non conforme</span>
        </div>
    `;
    chartContainer.appendChild(chartInfo);
    
    card.appendChild(chartContainer);
    
    // ========== NOUVEAU FOOTER AVEC CARTES INDIVIDUELLES ==========
    // 👇 CE CODE EST PLACÉ ICI - APRÈS LE GRAPHIQUE, AVANT LA FIN DE LA FONCTION
    
    // Calculer les statistiques par catégorie
    const excellent = analysis.days.filter(d => d.count >= 4).length;
    const tresBien = analysis.days.filter(d => d.count === 3).length;
    const correct = analysis.days.filter(d => d.count === 2).length;
    const faible = analysis.days.filter(d => d.count === 1).length;
    const nulle = analysis.days.filter(d => d.count === 0).length;

    const totalJours = analysis.days.length;

    // Créer le footer avec les cartes individuelles
    const footer = document.createElement('div');
    footer.style.cssText = `
        padding: 15px 20px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
    `;

    footer.innerHTML = `
        <!-- Excellente (≥4) -->
        <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #22c55e; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 18px;">⭐</span>
                <span style="font-size: 12px; font-weight: 600; color: #166534;">EXCELLENTE</span>
            </div>
            <div style="font-size: 24px; font-weight: 800; color: #22c55e; margin-bottom: 5px;">${excellent}</div>
            <div style="font-size: 11px; color: #64748b;">${totalJours > 0 ? ((excellent/totalJours*100).toFixed(1)) : 0}% des jours</div>
            <div style="margin-top: 8px; width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                <div style="width: ${totalJours > 0 ? (excellent/totalJours*100) : 0}%; height: 100%; background: #22c55e;"></div>
            </div>
        </div>
        
        <!-- Très bien (3) -->
        <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #eab308; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 18px;">👍</span>
                <span style="font-size: 12px; font-weight: 600; color: #854d0e;">TRÈS BIEN</span>
            </div>
            <div style="font-size: 24px; font-weight: 800; color: #eab308; margin-bottom: 5px;">${tresBien}</div>
            <div style="font-size: 11px; color: #64748b;">${totalJours > 0 ? ((tresBien/totalJours*100).toFixed(1)) : 0}% des jours</div>
            <div style="margin-top: 8px; width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                <div style="width: ${totalJours > 0 ? (tresBien/totalJours*100) : 0}%; height: 100%; background: #eab308;"></div>
            </div>
        </div>
        
        <!-- Correct (2) -->
        <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #f97316; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 18px;">🟡</span>
                <span style="font-size: 12px; font-weight: 600; color: #9a3412;">CORRECT</span>
            </div>
            <div style="font-size: 24px; font-weight: 800; color: #f97316; margin-bottom: 5px;">${correct}</div>
            <div style="font-size: 11px; color: #64748b;">${totalJours > 0 ? ((correct/totalJours*100).toFixed(1)) : 0}% des jours</div>
            <div style="margin-top: 8px; width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                <div style="width: ${totalJours > 0 ? (correct/totalJours*100) : 0}%; height: 100%; background: #f97316;"></div>
            </div>
        </div>
        
        <!-- Faible (1) -->
        <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #f59e0b; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 18px;">⚠️</span>
                <span style="font-size: 12px; font-weight: 600; color: #92400e;">FAIBLE</span>
            </div>
            <div style="font-size: 24px; font-weight: 800; color: #f59e0b; margin-bottom: 5px;">${faible}</div>
            <div style="font-size: 11px; color: #64748b;">${totalJours > 0 ? ((faible/totalJours*100).toFixed(1)) : 0}% des jours</div>
            <div style="margin-top: 8px; width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                <div style="width: ${totalJours > 0 ? (faible/totalJours*100) : 0}%; height: 100%; background: #f59e0b;"></div>
            </div>
        </div>
        
        <!-- Nulle (0) -->
        <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #ef4444; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 18px;">🔴</span>
                <span style="font-size: 12px; font-weight: 600; color: #991b1b;">NULLE</span>
            </div>
            <div style="font-size: 24px; font-weight: 800; color: #ef4444; margin-bottom: 5px;">${nulle}</div>
            <div style="font-size: 11px; color: #64748b;">${totalJours > 0 ? ((nulle/totalJours*100).toFixed(1)) : 0}% des jours</div>
            <div style="margin-top: 8px; width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                <div style="width: ${totalJours > 0 ? (nulle/totalJours*100) : 0}%; height: 100%; background: #ef4444;"></div>
            </div>
        </div>
    `;

    card.appendChild(footer);
    
    // Ajouter la carte au container
    container.appendChild(card);
    
    // Créer le graphique avec un délai pour que le canvas soit prêt
    setTimeout(() => {
        createVoltageThresholdChart(
            analysis.days.map(d => d.formattedDate).reverse(), 
            analysis.days.map(d => d.count).reverse(), 
            analysis.days.map(d => {
                if (d.count >= 4) return '#22c55e';
                if (d.count === 3) return '#eab308';
                if (d.count === 2) return '#f97316';
                if (d.count === 1) return '#f59e0b';
                return '#ef4444';
            }).reverse(), 
            analysis.threshold
        );
    }, 100);
}

function createVoltageThresholdChart(dates, counts, colors, threshold) {
    const canvas = document.getElementById('voltage-threshold-chart-canvas');
    if (!canvas) return;
    
    // Détruire l'ancien graphique s'il existe
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    
    // Créer un dataset pour la ligne de seuil à 4
    const thresholdLineData = Array(dates.length).fill(4);
    
    // Calculer le maximum pour l'échelle Y (avec une marge confortable)
    const maxCount = Math.max(...counts);
    const yMax = Math.max(10, maxCount + 3); // Minimum 10, ou max + 3
    
    new Chart(canvas, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: `Nombre d'atteintes ≥ ${threshold}V`,
                    data: counts,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.05)',
                    borderWidth: 3,
                    pointRadius: 7,
                    pointBackgroundColor: colors,
                    pointBorderColor: 'white',
                    pointBorderWidth: 2.5,
                    pointHoverRadius: 11,
                    pointHoverBackgroundColor: colors.map(c => c),
                    pointHoverBorderColor: '#0f172a',
                    pointHoverBorderWidth: 3,
                    tension: 0.2,
                    fill: false,
                    order: 1,
                    spanGaps: true
                },
                {
                    label: 'Seuil recommandé (4 atteintes)',
                    data: thresholdLineData,
                    borderColor: '#22c55e',
                    borderWidth: 4,
                    borderDash: [10, 8],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 0,
                    backgroundColor: 'transparent'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeInOutQuart'
            },
            layout: {
                padding: {
                    top: 20,
                    bottom: 20,
                    left: 10,
                    right: 20
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 12, weight: '600' },
                        color: '#1e293b',
                        boxWidth: 18,
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.98)',
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: true,
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label || '';
                            const value = context.parsed.y;
                            
                            if (datasetLabel.includes('Seuil')) {
                                return `📏 Seuil minimum: 4 atteintes`;
                            }
                            
                            let status = '';
                            
                            if (value >= 4) {
                                status = '✅ CONFORME';
                            } else if (value >= 2) {
                                status = '⚠️ MOYEN';
                            } else if (value === 1) {
                                status = '🔴 FAIBLE';
                            } else {
                                status = '⛔ CRITIQUE';
                            }
                            
                            return [
                                `⚡ ${value} atteinte${value !== 1 ? 's' : ''}`,
                                `📊 Statut: ${status}`
                            ];
                        },
                        afterLabel: function(context) {
                            if (!context.dataset.label.includes('Seuil')) {
                                const value = context.parsed.y;
                                const date = context.label;
                                if (value < 4) {
                                    const diff = 4 - value;
                                    return [
                                        `⬇️ ${diff} atteinte${diff !== 1 ? 's' : ''} sous le seuil`,
                                        `📅 ${date}`
                                    ];
                                } else {
                                    return [
                                        `✅ Au-dessus du seuil`,
                                        `📅 ${date}`
                                    ];
                                }
                            }
                            return null;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: yMax,
                    ticks: {
                        stepSize: 1,
                        font: { size: 11, weight: '500' },
                        color: '#334155',
                        padding: 8,
                        callback: function(value) {
                            return value + ' atteinte' + (value !== 1 ? 's' : '');
                        }
                    },
                    grid: {
                        color: function(context) {
                            if (context.tick.value === 4) {
                                return '#22c55e'; // Ligne de seuil en vert
                            }
                            return 'rgba(100, 116, 139, 0.15)';
                        },
                        lineWidth: function(context) {
                            if (context.tick.value === 4) {
                                return 2.5;
                            }
                            return 1;
                        },
                        tickLength: 10
                    },
                    title: {
                        display: true,
                        text: 'NOMBRE D\'ATTEINTES',
                        font: { size: 12, weight: '700' },
                        color: '#0f172a',
                        padding: { top: 15, bottom: 10 }
                    }
                },
                x: {
                    ticks: {
                        font: { size: 10, weight: '500' },
                        color: '#475569',
                        maxRotation: 45,
                        minRotation: 45,
                        maxTicksLimit: 15,
                        padding: 5
                    },
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'DATE',
                        font: { size: 12, weight: '700' },
                        color: '#0f172a',
                        padding: { top: 15, bottom: 5 }
                    }
                }
            }
        }
    });
}
function analyzeVoltageThresholdExceedances(tensionData) {
    if (!tensionData || tensionData.length === 0) {
        return { threshold: 0, days: [] };
    }
    
    // Déterminer le système
    const systemType = detectSystemType(tensionData);
    
    // Définir le seuil selon le système
    const threshold = systemType === '24V' ? 28.0 : 14.0;
    
    // Organiser les données par jour
    const dailyData = {};
    
    tensionData.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const dateTimeStr = row['Date et Heure'];
        const [date, time] = dateTimeStr.split(' ');
        if (!date || !time) return;
        
        // Récupérer les valeurs de tension
        const tMoy = parseFloat(row['T_moy']) || 0;
        const tMax = parseFloat(row['T_max']) || 0;
        
        if (!dailyData[date]) {
            dailyData[date] = {
                date: date,
                formattedDate: new Date(date).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                }),
                exceedances: [],
                count: 0,
                maxValue: 0
            };
        }
        
        // Vérifier les dépassements
        let exceededValue = null;
        let exceededTime = null;
        
        if (tMoy >= threshold) {
            exceededValue = tMoy;
            exceededTime = time;
        } else if (tMax >= threshold) {
            exceededValue = tMax;
            exceededTime = time;
        }
        
        if (exceededValue !== null) {
            dailyData[date].exceedances.push({
                time: time,
                value: exceededValue,
                timeFormatted: time.substring(0, 5)
            });
            dailyData[date].count++;
            dailyData[date].maxValue = Math.max(dailyData[date].maxValue, exceededValue);
        }
    });
    
    // Convertir en tableau et trier par date
    const days = Object.values(dailyData)
        .map(day => ({
            ...day,
            exceedances: day.exceedances.sort((a, b) => a.time.localeCompare(b.time))
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return {
        threshold: threshold,
        systemType: systemType,
        days: days,
        totalDaysWithExceedance: days.filter(d => d.count > 0).length,
        totalExceedances: days.reduce((sum, day) => sum + day.count, 0)
    };
}
// ==================== CRÉATION DES TABLEAUX COMBINÉS (STRUCTURE DES CARDS) ====================
function createCombinedTables() {
    const techniqueContent = document.getElementById('main-tab-content-technique');
    if (techniqueContent) {
        techniqueContent.innerHTML = '';
        const techniqueGrid = document.createElement('div');
        techniqueGrid.style.cssText = `display: flex; flex-direction: column; gap: 25px; padding: 20px;`;
        
        // CARD 1 : FILTRES
        const cardFilters = document.createElement('div');
        cardFilters.id = 'card-filters';
        cardFilters.className = 'dashboard-card';
        cardFilters.style.cssText = `background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0;`;
        const cardFiltersContent = document.createElement('div');
        cardFiltersContent.id = 'card-filters-content';
        cardFiltersContent.style.cssText = `padding: 0;`;
        cardFilters.appendChild(cardFiltersContent);
        techniqueGrid.appendChild(cardFilters);
        
        // CARD 2 : DONNÉES TECHNIQUES
        const cardTechData = document.createElement('div');
        cardTechData.id = 'card-technical-data';
        cardTechData.className = 'dashboard-card';
        cardTechData.style.cssText = `background: transparent; border-radius: 16px; overflow: hidden;`;
        const cardTechDataContent = document.createElement('div');
        cardTechDataContent.id = 'card-technical-data-content';
        cardTechDataContent.style.cssText = `padding: 0;`;
        cardTechData.appendChild(cardTechDataContent);
        techniqueGrid.appendChild(cardTechData);
        
        // CARD 3 : ANALYSE TOTALE TENSION
        const cardTensionAnalysis = document.createElement('div');
        cardTensionAnalysis.id = 'card-tension-analysis';
        cardTensionAnalysis.className = 'dashboard-card';
        cardTensionAnalysis.style.cssText = `background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0;`;
        const cardTensionAnalysisContent = document.createElement('div');
        cardTensionAnalysisContent.id = 'card-tension-analysis-content';
        cardTensionAnalysisContent.style.cssText = `padding: 20px; display: flex; flex-direction: column; gap: 25px;`;
        cardTensionAnalysis.appendChild(cardTensionAnalysisContent);
        techniqueGrid.appendChild(cardTensionAnalysis);

        // ✅ NOUVELLE CARD : TABLEAU DES DÉPASSEMENTS DE TENSION À 14.0V/28V
        const cardVoltageThreshold = document.createElement('div');
        cardVoltageThreshold.id = 'card-voltage-threshold';
        cardVoltageThreshold.className = 'dashboard-card';
        cardVoltageThreshold.style.cssText = `
            background: white; 
            border-radius: 16px; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); 
            overflow: hidden; 
            border: 1px solid #e2e8f0; 
            margin-top: 10px;
            min-height: 650px; /* 👈 AJOUTEZ CETTE LIGNE */
        `;
        const cardVoltageThresholdContent = document.createElement('div');
        cardVoltageThresholdContent.id = 'voltage-threshold-table-container';
        cardVoltageThresholdContent.style.cssText = `padding: 0;`;
        cardVoltageThreshold.appendChild(cardVoltageThresholdContent);
        techniqueGrid.appendChild(cardVoltageThreshold);
        
        // CARD 4 : ANALYSE TOTALE ÉNERGIE
        const cardEnergyAnalysis = document.createElement('div');
        cardEnergyAnalysis.id = 'card-energy-analysis';
        cardEnergyAnalysis.className = 'dashboard-card';
        cardEnergyAnalysis.style.cssText = `background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0;`;
        const cardEnergyAnalysisContent = document.createElement('div');
        cardEnergyAnalysisContent.id = 'card-energy-analysis-content';
        cardEnergyAnalysisContent.style.cssText = `padding: 20px; display: flex; flex-direction: column; gap: 25px;`;
        cardEnergyAnalysis.appendChild(cardEnergyAnalysisContent);
        techniqueGrid.appendChild(cardEnergyAnalysis);
        
        // CARD 5 : TABLEAU ENERGIE
        const cardEnergyTable = document.createElement('div');
        cardEnergyTable.id = 'combined-energy-container';
        cardEnergyTable.className = 'combined-table-container dashboard-card';
        cardEnergyTable.style.cssText = `background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0;`;
        const cardEnergyTableContent = document.createElement('div');
        cardEnergyTableContent.id = 'combined-energy-table-content';
        cardEnergyTableContent.style.cssText = `padding: 0;`;
        cardEnergyTable.appendChild(cardEnergyTableContent);
        techniqueGrid.appendChild(cardEnergyTable);
        
        // CARD 6 : TABLEAU TENSION
        const cardTensionTable = document.createElement('div');
        cardTensionTable.id = 'combined-tension-container';
        cardTensionTable.className = 'combined-table-container dashboard-card';
        cardTensionTable.style.cssText = `background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0;`;
        const cardTensionTableContent = document.createElement('div');
        cardTensionTableContent.id = 'combined-tension-table-content';
        cardTensionTableContent.style.cssText = `padding: 0;`;
        cardTensionTable.appendChild(cardTensionTableContent);
        techniqueGrid.appendChild(cardTensionTable);
        
        techniqueContent.appendChild(techniqueGrid);
    }
    
    // Onglet COMMERCIALE
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    if (commercialeContent) {
        commercialeContent.innerHTML = '';
        const commercialeGrid = document.createElement('div');
        commercialeGrid.style.cssText = `display: flex; flex-direction: column; gap: 30px; padding: 20px;`;
        
        const combinedSoldeContainer = document.createElement('div');
        combinedSoldeContainer.className = 'combined-table-container';
        combinedSoldeContainer.id = 'combined-solde-container';
        combinedSoldeContainer.style.cssText = `background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden; flex: 1;`;
        const soldeTableHeader = document.createElement('div');
        soldeTableHeader.style.cssText = `background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 15px 25px; font-size: 18px; font-weight: 600; display: flex; justify-content: space-between; align-items: center;`;
        soldeTableHeader.innerHTML = `<span>💰 Tableau SOLDE (Crédits)</span>`;
        const soldeTableContent = document.createElement('div');
        soldeTableContent.id = 'combined-solde-table-content';
        soldeTableContent.style.padding = '20px';
        soldeTableContent.innerHTML = `<div class="loading"><div class="spinner"></div><p style="margin-top: 10px; color: #7f8c8d;">Analyse des fichiers SOLDE...</p></div>`;
        combinedSoldeContainer.appendChild(soldeTableHeader);
        combinedSoldeContainer.appendChild(soldeTableContent);
        commercialeGrid.appendChild(combinedSoldeContainer);
        
        const combinedRechargeContainer = document.createElement('div');
        combinedRechargeContainer.className = 'combined-table-container';
        combinedRechargeContainer.id = 'combined-recharge-container';
        combinedRechargeContainer.style.cssText = `background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden; flex: 1;`;
        const rechargeTableHeader = document.createElement('div');
        rechargeTableHeader.style.cssText = `background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); color: white; padding: 15px 25px; font-size: 18px; font-weight: 600; display: flex; justify-content: space-between; align-items: center;`;
        rechargeTableHeader.innerHTML = `<span>⚡ Tableau RECHARGE</span>`;
        const rechargeTableContent = document.createElement('div');
        rechargeTableContent.id = 'combined-recharge-table-content';
        rechargeTableContent.style.padding = '20px';
        rechargeTableContent.innerHTML = `<div class="loading"><div class="spinner"></div><p style="margin-top: 10px; color: #7f8c8d;">Analyse des fichiers RECHARGE...</p></div>`;
        combinedRechargeContainer.appendChild(rechargeTableHeader);
        combinedRechargeContainer.appendChild(rechargeTableContent);
        commercialeGrid.appendChild(combinedRechargeContainer);
        commercialeContent.appendChild(commercialeGrid);
    }
    
    // Onglet ÉVÉNEMENTS
    const evenementContent = document.getElementById('main-tab-content-evenement');
    if (evenementContent) {
        evenementContent.innerHTML = '';
        const evenementGrid = document.createElement('div');
        evenementGrid.style.cssText = `display: flex; flex-direction: column; gap: 30px; padding: 20px;`;
        
        const combinedEventContainer = document.createElement('div');
        combinedEventContainer.className = 'combined-table-container';
        combinedEventContainer.id = 'combined-event-container';
        combinedEventContainer.style.cssText = `background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden; flex: 1;`;
        const eventTableHeader = document.createElement('div');
        eventTableHeader.style.cssText = `background: linear-gradient(135deg, #f39c12 0%, #d35400 100%); color: white; padding: 15px 25px; font-size: 18px; font-weight: 600; display: flex; justify-content: space-between; align-items: center;`;
        eventTableHeader.innerHTML = `<span>⚠️ Tableau détaillé des ÉVÉNEMENTS</span>`;
        const eventTableContent = document.createElement('div');
        eventTableContent.id = 'combined-event-table-content';
        eventTableContent.style.padding = '20px';
        eventTableContent.innerHTML = `<div class="loading"><div class="spinner"></div><p style="margin-top: 10px; color: #7f8c8d;">Analyse des fichiers ÉVÉNEMENTS...</p></div>`;
        combinedEventContainer.appendChild(eventTableHeader);
        combinedEventContainer.appendChild(eventTableContent);
        evenementGrid.appendChild(combinedEventContainer);
        evenementContent.appendChild(evenementGrid);
    }

    //✅ ONGLETS FRAUDE
    const fraudeContent = document.getElementById('main-tab-content-fraude');
    if (fraudeContent) {
        fraudeContent.innerHTML = '';
        const fraudeGrid = document.createElement('div');
        fraudeGrid.style.cssText = `display: flex; flex-direction: column; gap: 30px; padding: 20px;`;
        
        // Le contenu sera généré dynamiquement par displayFraudeAnalysis()
        
        fraudeContent.appendChild(fraudeGrid);
    }
}


// ==================== ANALYSE DES CHUTES DE TENSION (24h/24) ====================
function analyzeTensionDrops() {
    const results = {
        drops: [],
        criticalDrops: [],
        summary: {
            totalDrops: 0,
            totalCritical: 0,
            worstDrop: null,
            worstDay: null,
            dropsByHour: Array(24).fill(0) // Pour voir les heures les plus critiques
        }
    };
    
    if (combinedTensionData.length === 0) return results;
    
    // Détecter le système de tension
    const systemType = detectSystemType(combinedTensionData);
    const limits = getSystemLimits(systemType);
    
    // Seuil critique : chute de 30% ou plus
    const criticalThreshold = limits.normal * 0.3;
    
    // Organiser toutes les données par ordre chronologique
    const tensionPoints = [];
    
    combinedTensionData.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const dateTime = new Date(row['Date et Heure']);
        const tMin = parseFloat(row['T_min']) || 0;
        const tMoy = parseFloat(row['T_moy']) || 0;
        
        if (tMin > 0) {
            tensionPoints.push({
                datetime: row['Date et Heure'],
                date: row['Date et Heure'].split(' ')[0],
                time: row['Date et Heure'].split(' ')[1],
                hour: dateTime.getHours(),
                tMin: tMin,
                tMoy: tMoy
            });
        }
    });
    
    // Trier par date/heure
    tensionPoints.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    
    if (tensionPoints.length < 2) return results;
    
    // Analyser les chutes entre points consécutifs
    for (let i = 1; i < tensionPoints.length; i++) {
        const prev = tensionPoints[i-1];
        const curr = tensionPoints[i];
        
        // Calculer la chute
        const drop = prev.tMin - curr.tMin;
        
        // Ne garder que les chutes (pas les montées)
        if (drop <= 0) continue;
        
        // Calculer le temps écoulé
        const timeDiff = getTimeDifferenceMinutes(prev.time, curr.time, prev.date, curr.date);
        
        // Chute significative : > 1.5V en moins de 2 heures
        // (on élargit à 2h pour la journée car les relevés peuvent être plus espacés)
        if (drop > 1.5 && timeDiff < 120) {
            const dropInfo = {
                date: curr.date,
                time: curr.time,
                fromValue: prev.tMin.toFixed(2),
                toValue: curr.tMin.toFixed(2),
                drop: drop.toFixed(2),
                duration: timeDiff,
                fromHour: prev.hour,
                toHour: curr.hour,
                fromTime: prev.time,
                period: getPeriodOfDay(curr.hour), // Matin, Après-midi, Soir, Nuit
                isCritical: drop > criticalThreshold
            };
            
            results.drops.push(dropInfo);
            results.summary.dropsByHour[curr.hour]++;
            
            if (drop > criticalThreshold) {
                results.criticalDrops.push(dropInfo);
            }
            
            // Mettre à jour le pire drop
            if (!results.summary.worstDrop || drop > parseFloat(results.summary.worstDrop.drop)) {
                results.summary.worstDrop = dropInfo;
            }
        }
    }
    
    // Compter les chutes par jour
    const dropsByDay = {};
    results.drops.forEach(drop => {
        if (!dropsByDay[drop.date]) dropsByDay[drop.date] = 0;
        dropsByDay[drop.date]++;
    });
    
    // Trouver le pire jour
    let maxDrops = 0;
    Object.keys(dropsByDay).forEach(date => {
        if (dropsByDay[date] > maxDrops) {
            maxDrops = dropsByDay[date];
            results.summary.worstDay = date;
        }
    });
    
    results.summary.totalDrops = results.drops.length;
    results.summary.totalCritical = results.criticalDrops.length;
    
    return results;
}

// Fonction utilitaire pour obtenir la période de la journée
function getPeriodOfDay(hour) {
    if (hour >= 5 && hour < 12) return '🌅 Matin';
    if (hour >= 12 && hour < 18) return '☀️ Après-midi';
    if (hour >= 18 && hour < 22) return '🌆 Soir';
    return '🌙 Nuit';
}

// Version améliorée de getTimeDifferenceMinutes qui gère les changements de jour
function getTimeDifferenceMinutes(time1, time2, date1, date2) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    
    let minutes1 = h1 * 60 + m1;
    let minutes2 = h2 * 60 + m2;
    
    // Si les dates sont différentes, ajouter 24h
    if (date1 !== date2) {
        minutes2 += 24 * 60;
    }
    
    return minutes2 - minutes1;
}
// ==================== AFFICHAGE DANS L'ONGLET FRAUDE ====================

function displayFraudeAnalysis() {
    const fraudeContent = document.getElementById('main-tab-content-fraude');
    if (!fraudeContent) return;
    
    fraudeContent.innerHTML = '';
    
    // Créer le conteneur principal
    const fraudeContainer = document.createElement('div');
    fraudeContainer.style.cssText = `
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
    `;
    
    // Titre
    const title = document.createElement('h2');
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #1e293b;
        font-size: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    title.innerHTML = `🔍 Analyse des Chutes de Tension (24h/24) - ${escapeHtml(currentFolder.name)}`;
    fraudeContainer.appendChild(title);
    
    // Lancer l'analyse
    const analysis = analyzeTensionDrops();
    
    // Détecter le système de tension pour afficher les seuils
    const systemType = detectSystemType(combinedTensionData);
    const limits = getSystemLimits(systemType);
    
    // Carte de synthèse
    const summaryCard = document.createElement('div');
    summaryCard.style.cssText = `
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-radius: 12px;
        padding: 20px;
        color: white;
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
    `;
    
    summaryCard.innerHTML = `
        <div>
            <div style="font-size: 12px; opacity: 0.8;">Chutes détectées</div>
            <div style="font-size: 32px; font-weight: 700;">${analysis.summary.totalDrops}</div>
        </div>
        <div>
            <div style="font-size: 12px; opacity: 0.8;">Chutes critiques</div>
            <div style="font-size: 32px; font-weight: 700; color: #ef4444;">${analysis.summary.totalCritical}</div>
        </div>
        <div>
            <div style="font-size: 12px; opacity: 0.8;">Pire chute</div>
            <div style="font-size: 20px; font-weight: 700;">${analysis.summary.worstDrop ? analysis.summary.worstDrop.drop + ' V' : '0 V'}</div>
        </div>
        <div>
            <div style="font-size: 12px; opacity: 0.8;">Jour le plus actif</div>
            <div style="font-size: 16px; font-weight: 700;">${analysis.summary.worstDay ? new Date(analysis.summary.worstDay).toLocaleDateString('fr-FR') : 'Aucun'}</div>
        </div>
    `;
    
    fraudeContainer.appendChild(summaryCard);
    
    // Informations sur le système
    const systemCard = document.createElement('div');
    systemCard.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 15px 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
        border: 1px solid #e2e8f0;
    `;
    
    systemCard.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">⚡</span>
            <div>
                <div style="font-size: 12px; color: #64748b;">Système détecté</div>
                <div style="font-weight: 700; color: #1e293b;">${systemType}</div>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">📊</span>
            <div>
                <div style="font-size: 12px; color: #64748b;">Tension normale</div>
                <div style="font-weight: 700; color: #1e293b;">${limits.normal} V</div>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">⚠️</span>
            <div>
                <div style="font-size: 12px; color: #64748b;">Seuil critique (-30%)</div>
                <div style="font-weight: 700; color: #ef4444;">${(limits.normal * 0.3).toFixed(1)} V</div>
            </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-left: auto;">
            <span style="font-size: 20px;">📅</span>
            <div>
                <div style="font-size: 12px; color: #64748b;">Période analysée</div>
                <div style="font-weight: 700; color: #1e293b;">24h/24</div>
            </div>
        </div>
    `;
    
    fraudeContainer.appendChild(systemCard);
    
    // Graphique de répartition horaire (simple)
    const chartCard = document.createElement('div');
    chartCard.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        border: 1px solid #e2e8f0;
    `;
    
    chartCard.innerHTML = `<h3 style="margin: 0 0 15px 0; font-size: 16px;">📊 Répartition des chutes par heure</h3>`;
    
    const chartBars = document.createElement('div');
    chartBars.style.cssText = `display: flex; align-items: flex-end; gap: 2px; height: 150px;`;
    
    const maxValue = Math.max(...analysis.summary.dropsByHour, 1);
    
    for (let hour = 0; hour < 24; hour++) {
        const count = analysis.summary.dropsByHour[hour];
        const height = count > 0 ? (count / maxValue) * 100 : 0;
        const period = getPeriodOfDay(hour);
        
        let barColor = '#3b82f6';
        if (period.includes('Nuit')) barColor = '#1e293b';
        if (period.includes('Soir')) barColor = '#f97316';
        if (period.includes('Matin')) barColor = '#22c55e';
        
        chartBars.innerHTML += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                <div style="width: 100%; background: ${barColor}20; border-radius: 4px 4px 0 0; height: ${height}%; min-height: ${count > 0 ? '4px' : '0'}; position: relative;">
                    ${count > 0 ? `<div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 10px; background: ${barColor}; color: white; padding: 2px 4px; border-radius: 4px;">${count}</div>` : ''}
                </div>
                <div style="font-size: 9px; margin-top: 5px; color: #64748b;">${hour}h</div>
            </div>
        `;
    }
    
    chartCard.appendChild(chartBars);
    
    // Légende des périodes
    const legend = document.createElement('div');
    legend.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 20px;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #e2e8f0;
        font-size: 11px;
    `;
    legend.innerHTML = `
        <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 12px; height: 12px; background: #22c55e; border-radius: 3px;"></div>Matin (5h-12h)</div>
        <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 3px;"></div>Après-midi (12h-18h)</div>
        <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 12px; height: 12px; background: #f97316; border-radius: 3px;"></div>Soir (18h-22h)</div>
        <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 12px; height: 12px; background: #1e293b; border-radius: 3px;"></div>Nuit (22h-5h)</div>
    `;
    chartCard.appendChild(legend);
    
    fraudeContainer.appendChild(chartCard);
    
    // Tableau des chutes
    if (analysis.drops.length > 0) {
        const dropsCard = document.createElement('div');
        dropsCard.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        `;
        
        const dropsHeader = document.createElement('div');
        dropsHeader.style.cssText = `
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            padding: 15px 20px;
            font-size: 16px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        dropsHeader.innerHTML = `
            <span>📉 Détail des chutes de tension</span>
            <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                ${analysis.drops.length} chute(s)
            </span>
        `;
        dropsCard.appendChild(dropsHeader);
        
        const dropsContent = document.createElement('div');
        dropsContent.style.cssText = `padding: 20px; max-height: 500px; overflow-y: auto;`;
        
        let dropsHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead style="position: sticky; top: 0; background: #f1f5f9;">
                    <tr>
                        <th style="padding: 10px; text-align: left;">Date</th>
                        <th style="padding: 10px; text-align: center;">Période</th>
                        <th style="padding: 10px; text-align: center;">Chute (V)</th>
                        <th style="padding: 10px; text-align: center;">Tension</th>
                        <th style="padding: 10px; text-align: center;">Durée</th>
                        <th style="padding: 10px; text-align: center;">Horaire</th>
                        <th style="padding: 10px; text-align: center;">Statut</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        analysis.drops.forEach((drop, index) => {
            const isCritical = drop.isCritical;
            const rowColor = isCritical ? '#fef2f2' : (index % 2 === 0 ? '#ffffff' : '#fafbfc');
            const statusText = isCritical ? 'CRITIQUE' : 'Significatif';
            const statusColor = isCritical ? '#ef4444' : '#3b82f6';
            
            dropsHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0; background: ${rowColor};">
                    <td style="padding: 10px;">${new Date(drop.date).toLocaleDateString('fr-FR')}</td>
                    <td style="padding: 10px; text-align: center;">${drop.period}</td>
                    <td style="padding: 10px; text-align: center; font-weight: 700; color: ${statusColor};">${drop.drop} V</td>
                    <td style="padding: 10px; text-align: center;">${drop.fromValue} → ${drop.toValue} V</td>
                    <td style="padding: 10px; text-align: center;">${drop.duration} min</td>
                    <td style="padding: 10px; text-align center;">${drop.fromTime} → ${drop.time}</td>
                    <td style="padding: 10px; text-align: center;">
                        <span style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 8px; border-radius: 12px; font-weight: 600;">
                            ${statusText}
                        </span>
                    </td>
                </tr>
            `;
        });
        
        dropsHTML += `</tbody></table>`;
        dropsContent.innerHTML = dropsHTML;
        dropsCard.appendChild(dropsContent);
        
        // Ajouter une légende
        const legend2 = document.createElement('div');
        legend2.style.cssText = `
            padding: 10px 20px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 20px;
            font-size: 11px;
            flex-wrap: wrap;
        `;
        legend2.innerHTML = `
            <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 3px;"></div>
                <span>Chute significative (>1.5V en <2h)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 12px; height: 12px; background: #ef4444; border-radius: 3px;"></div>
                <span>Chute critique (>${(limits.normal * 0.3).toFixed(1)}V)</span>
            </div>
            <div style="margin-left: auto; background: #e2e8f0; padding: 4px 8px; border-radius: 4px;">
                ${combinedTensionData.length} relevés analysés
            </div>
        `;
        dropsCard.appendChild(legend2);
        
        fraudeContainer.appendChild(dropsCard);
    } else {
        const noDataCard = document.createElement('div');
        noDataCard.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            color: #64748b;
            border: 1px solid #e2e8f0;
        `;
        noDataCard.innerHTML = `
            <span style="font-size: 48px; display: block; margin-bottom: 20px;">📊</span>
            <h3 style="margin: 0 0 10px 0; color: #1e293b;">Aucune chute de tension détectée</h3>
            <p style="margin: 0;">Aucune chute significative (>1.5V) n'a été enregistrée sur l'ensemble des relevés.</p>
            <p style="margin-top: 10px; font-size: 11px;">${combinedTensionData.length} relevés analysés</p>
        `;
        fraudeContainer.appendChild(noDataCard);
    }
    
    fraudeContent.appendChild(fraudeContainer);
}
////////////////////////////////////////////////////////////////////////////
// AJOUTER LES STYLES CSS
function addCommercialStyles() {
    if (document.querySelector('#commercial-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'commercial-styles';
    styles.textContent = `
        .commercial-summary-card {
            animation: slideIn 0.5s ease;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .commercial-summary-card:hover {
            box-shadow: 0 15px 35px rgba(0,0,0,0.12) !important;
            transition: box-shadow 0.3s ease;
        }
        
        @media (max-width: 768px) {
            .commercial-summary-card > div:first-child {
                flex-direction: column;
                text-align: center;
            }
            
            .commercial-summary-card > div:nth-child(2) {
                grid-template-columns: repeat(2, 1fr) !important;
            }
            
            .commercial-summary-card > div:nth-child(3) {
                grid-template-columns: 1fr !important;
            }
        }
    `;
    
    document.head.appendChild(styles);
}
// Appeler au chargement
document.addEventListener('DOMContentLoaded', addCommercialStyles);
// ==================== ANIMATIONS CSS ====================
// Ajouter ces styles CSS au début du fichier ou dans la section des styles
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(style);