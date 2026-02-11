
// ==================== FICHIER PRINCIPAL (analyze.js) ====================

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

// ==================== CARD DONNÉES TECHNIQUES ====================

function createTechnicalDataCard() {
    const techniqueContent = document.getElementById('main-tab-content-technique');
    if (!techniqueContent) return;
    
    // Supprimer l'ancienne carte si elle existe
    const existingCard = document.getElementById('technical-data-card');
    if (existingCard) {
        existingCard.remove();
    }
    
    // Calculer les données techniques
    const techData = calculateTechnicalData();
    
    // Créer la carte
    const card = document.createElement('div');
    card.id = 'technical-data-card';
    card.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        margin-bottom: 20px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        animation: fadeIn 0.5s ease;
    `;
    
    // Header de la carte
    const cardHeader = document.createElement('div');
    cardHeader.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        color: white;
        padding: 15px 25px;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
        backdrop-filter: blur(10px);
    `;
    cardHeader.innerHTML = `🔧 DONNÉES TECHNIQUES DU NR-${escapeHtml(currentFolder.name)}`;
    
    card.appendChild(cardHeader);
    
    // Contenu de la carte
    const cardContent = document.createElement('div');
    cardContent.style.cssText = `
        padding: 20px 25px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        background: white;
    `;
    
    // Fonction pour créer un élément de donnée
    const createDataItem = (icon, label, value, subValue = '') => {
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        `;
        item.onmouseover = () => {
            item.style.transform = 'translateY(-2px)';
            item.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        };
        item.onmouseout = () => {
            item.style.transform = 'translateY(0)';
            item.style.boxShadow = 'none';
        };
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="font-size: 20px;">${icon}</div>
                <div style="font-size: 14px; color: #2c3e50; font-weight: 600;">${label}</div>
            </div>
            <div style="font-size: 22px; color: #3498db; font-weight: bold; margin-bottom: 4px;">
                ${value}
            </div>
            ${subValue ? `<div style="font-size: 12px; color: #7f8c8d; font-weight: 500;">${subValue}</div>` : ''}
        `;
        
        return item;
    };
    
    // Ajouter les éléments de données
    cardContent.appendChild(createDataItem('📅', 'Période', techData.period));
    cardContent.appendChild(createDataItem('👤', 'Nombre de clients', `${techData.clientCount} clients`));
    
    cardContent.appendChild(createDataItem(
        '⚡', 
        'Énergie Maximale', 
        `${techData.maxEnergy.value}`,
        techData.maxEnergy.date
    ));
    
    cardContent.appendChild(createDataItem(
        '📊', 
        'Tension Moyenne', 
        `${techData.avgTension.value}`,
        techData.tensionSystem
    ));
    
    cardContent.appendChild(createDataItem(
        '⬇️', 
        'Tension Minimale', 
        `${techData.minTension.value}`,
        techData.minTension.date
    ));
    
    cardContent.appendChild(createDataItem(
        '⬆️', 
        'Tension Maximale', 
        `${techData.maxTension.value}`,
        techData.maxTension.date
    ));
    
    card.appendChild(cardContent);
    
    // Footer de la carte
    const cardFooter = document.createElement('div');
    cardFooter.style.cssText = `
        padding: 12px 25px;
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.9);
        font-size: 11px;
        text-align: right;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    `;
    cardFooter.innerHTML = `Dernière mise à jour: ${new Date().toLocaleString()}`;
    
    card.appendChild(cardFooter);
    
    // Insérer la carte en premier dans l'onglet technique
    const techniqueGrid = techniqueContent.querySelector('div[style*="display: flex; flex-direction: column"]');
    if (techniqueGrid) {
        techniqueContent.insertBefore(card, techniqueGrid);
    } else {
        techniqueContent.insertBefore(card, techniqueContent.firstChild);
    }
}

function calculateTechnicalData() {
    // Utiliser les données filtrées si disponibles, sinon les données complètes
    const energyDataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    const tensionDataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    
    const data = {
        period: '',
        clientCount: 0,
        maxEnergy: { value: 0, date: '' },
        avgTension: { value: 0 },
        minTension: { value: 100, date: '' },
        maxTension: { value: 0, date: '' },
        tensionSystem: 'Système 12V'
    };
    
    // 1. Calculer la période - Compter les jours uniques dans les données TENSION
    if (tensionDataToUse.length > 0) {
        // Utiliser un Set pour stocker les dates uniques (sans l'heure)
        const uniqueDays = new Set();
        
        tensionDataToUse.forEach(row => {
            if (row['Date et Heure']) {
                try {
                    const dateTime = new Date(row['Date et Heure']);
                    if (!isNaN(dateTime.getTime())) {
                        // Extraire seulement la partie date (YYYY-MM-DD)
                        const dateOnly = dateTime.toISOString().split('T')[0];
                        uniqueDays.add(dateOnly);
                    }
                } catch (e) {
                    // Si la conversion échoue, essayer d'extraire manuellement
                    const dateStr = row['Date et Heure'];
                    if (dateStr && dateStr.includes(' ')) {
                        const datePart = dateStr.split(' ')[0];
                        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                            uniqueDays.add(datePart);
                        }
                    }
                }
            }
        });
        
        const numberOfDays = uniqueDays.size;
        
        if (numberOfDays > 0) {
            data.period = `${numberOfDays} jour${numberOfDays !== 1 ? 's' : ''}`;
        } else {
            data.period = 'Calcul en cours...';
        }
    } else {
        // Fallback: utiliser les données ENERGY si pas de TENSION
        if (energyDataToUse.length > 0) {
            const uniqueDays = new Set();
            
            energyDataToUse.forEach(row => {
                if (row['Date et Heure']) {
                    try {
                        const dateTime = new Date(row['Date et Heure']);
                        if (!isNaN(dateTime.getTime())) {
                            const dateOnly = dateTime.toISOString().split('T')[0];
                            uniqueDays.add(dateOnly);
                        }
                    } catch (e) {
                        const dateStr = row['Date et Heure'];
                        if (dateStr && dateStr.includes(' ')) {
                            const datePart = dateStr.split(' ')[0];
                            if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                                uniqueDays.add(datePart);
                            }
                        }
                    }
                }
            });
            
            const numberOfDays = uniqueDays.size;
            
            if (numberOfDays > 0) {
                data.period = `${numberOfDays} jour${numberOfDays !== 1 ? 's' : ''}`;
            } else {
                data.period = 'Calcul en cours...';
            }
        } else {
            data.period = 'Chargement...';
        }
    }
    
    // 2. Calculer le nombre de clients (colonnes Energie)
    if (energyDataToUse.length > 0) {
        const sampleRow = energyDataToUse[0];
        let clientCount = 0;
        
        for (let i = 1; i <= 6; i++) {
            const energyKey = `Energie${i}`;
            if (sampleRow.hasOwnProperty(energyKey)) {
                // Vérifier si cette colonne a des données dans les 100 premières lignes
                let hasData = false;
                const checkRows = Math.min(100, energyDataToUse.length);
                
                for (let j = 0; j < checkRows; j++) {
                    const cellValue = energyDataToUse[j][energyKey];
                    if (cellValue && 
                        cellValue.toString().trim() !== '' && 
                        cellValue.toString().trim() !== '0' &&
                        cellValue.toString().trim() !== '-') {
                        hasData = true;
                        break;
                    }
                }
                
                if (hasData) clientCount++;
            }
        }
        
        data.clientCount = clientCount;
    } else {
        data.clientCount = 'Chargement...';
    }
    
    // 3. Calculer l'énergie maximale
    if (energyDataToUse.length > 0) {
        let maxEnergyValue = 0;
        let maxEnergyDate = '';
        
        energyDataToUse.forEach(row => {
            for (let i = 1; i <= 6; i++) {
                const energyKey = `Energie${i}`;
                const cellValue = row[energyKey];
                
                if (cellValue && cellValue.toString().trim() !== '' && cellValue.toString().trim() !== '-') {
                    const energyValue = parseFloat(cellValue.toString().replace(',', '.'));
                    if (!isNaN(energyValue) && energyValue > maxEnergyValue) {
                        maxEnergyValue = energyValue;
                        maxEnergyDate = row['Date et Heure'];
                    }
                }
            }
        });
        
        if (maxEnergyValue > 0) {
            data.maxEnergy.value = maxEnergyValue.toFixed(2) + ' Wh';
            if (maxEnergyDate) {
                try {
                    const date = new Date(maxEnergyDate);
                    if (!isNaN(date.getTime())) {
                        data.maxEnergy.date = date.toLocaleDateString('fr-FR');
                    } else {
                        data.maxEnergy.date = maxEnergyDate.split(' ')[0];
                    }
                } catch (e) {
                    data.maxEnergy.date = maxEnergyDate.split(' ')[0];
                }
            }
        } else {
            data.maxEnergy.value = '0 Wh';
            data.maxEnergy.date = 'Non disponible';
        }
    } else {
        data.maxEnergy.value = '0 Wh';
        data.maxEnergy.date = 'Chargement...';
    }
    
    // 4. Calculer les statistiques de tension
    if (tensionDataToUse.length > 0) {
        let tensionSum = 0;
        let tensionCount = 0;
        let minTensionValue = 100;
        let maxTensionValue = 0;
        let minTensionDate = '';
        let maxTensionDate = '';
        
        tensionDataToUse.forEach(row => {
            // Tension moyenne
            const tMoyStr = row['T_moy'];
            if (tMoyStr && tMoyStr.toString().trim() !== '' && tMoyStr.toString().trim() !== '-') {
                const tMoy = parseFloat(tMoyStr.toString().replace(',', '.'));
                if (!isNaN(tMoy) && tMoy > 0) {
                    tensionSum += tMoy;
                    tensionCount++;
                }
            }
            
            // Tension minimale
            const tMinStr = row['T_min'];
            if (tMinStr && tMinStr.toString().trim() !== '' && tMinStr.toString().trim() !== '-') {
                const tMin = parseFloat(tMinStr.toString().replace(',', '.'));
                if (!isNaN(tMin) && tMin > 0 && tMin < minTensionValue) {
                    minTensionValue = tMin;
                    minTensionDate = row['Date et Heure'];
                }
            }
            
            // Tension maximale
            const tMaxStr = row['T_max'];
            if (tMaxStr && tMaxStr.toString().trim() !== '' && tMaxStr.toString().trim() !== '-') {
                const tMax = parseFloat(tMaxStr.toString().replace(',', '.'));
                if (!isNaN(tMax) && tMax > maxTensionValue) {
                    maxTensionValue = tMax;
                    maxTensionDate = row['Date et Heure'];
                }
            }
        });
        
        // Tension moyenne
        if (tensionCount > 0) {
            data.avgTension.value = (tensionSum / tensionCount).toFixed(2) + ' V';
            
            // Détecter le système de tension (12V ou 24V)
            const avgTension = parseFloat(data.avgTension.value);
            if (avgTension > 18) {
                data.tensionSystem = 'Système 24V';
            } else if (avgTension > 10) {
                data.tensionSystem = 'Système 12V';
            } else {
                data.tensionSystem = 'Système inconnu';
            }
        } else {
            data.avgTension.value = '0 V';
            data.tensionSystem = 'Données manquantes';
        }
        
        // Tension minimale
        if (minTensionValue < 100) {
            data.minTension.value = minTensionValue.toFixed(2) + ' V';
            if (minTensionDate) {
                try {
                    const date = new Date(minTensionDate);
                    if (!isNaN(date.getTime())) {
                        data.minTension.date = date.toLocaleDateString('fr-FR');
                    } else {
                        data.minTension.date = minTensionDate.split(' ')[0];
                    }
                } catch (e) {
                    data.minTension.date = minTensionDate.split(' ')[0];
                }
            }
        } else {
            data.minTension.value = '0 V';
            data.minTension.date = 'Non disponible';
        }
        
        // Tension maximale
        if (maxTensionValue > 0) {
            data.maxTension.value = maxTensionValue.toFixed(2) + ' V';
            if (maxTensionDate) {
                try {
                    const date = new Date(maxTensionDate);
                    if (!isNaN(date.getTime())) {
                        data.maxTension.date = date.toLocaleDateString('fr-FR');
                    } else {
                        data.maxTension.date = maxTensionDate.split(' ')[0];
                    }
                } catch (e) {
                    data.maxTension.date = maxTensionDate.split(' ')[0];
                }
            }
        } else {
            data.maxTension.value = '0 V';
            data.maxTension.date = 'Non disponible';
        }
    } else {
        data.avgTension.value = '0 V';
        data.tensionSystem = 'Chargement...';
        data.minTension.value = '0 V';
        data.minTension.date = 'Chargement...';
        data.maxTension.value = '0 V';
        data.maxTension.date = 'Chargement...';
    }
    
    return data;
}

// ==================== FONCTIONS D'ANALYSE DE STABILITÉ ====================
function analyzeTensionStability(tensionResults) {
    if (!tensionResults || !tensionResults.length) {
        return {
            stable: 0,
            unstable: 0,
            outOfLimits: 0,
            stabilityPercentage: 0,
            averageVariation: 0,
            days: 0,
            systemType: '12V',
            limits: getSystemLimits('12V')
        };
    }

    // Group by date for daily analysis
    const dailyData = {};
    tensionResults.forEach(item => {
        const date = item['Date et Heure'] ? item['Date et Heure'].split(' ')[0] : null;
        if (!date) return;
        
        if (!dailyData[date]) {
            dailyData[date] = {
                values: [],
                min: Infinity,
                max: -Infinity
            };
        }
        
        const tMoy = parseFloat(item['T_moy']) || 0;
        const tMin = parseFloat(item['T_min']) || 0;
        const tMax = parseFloat(item['T_max']) || 0;
        
        if (tMoy > 0) dailyData[date].values.push(tMoy);
        if (tMin > 0) dailyData[date].values.push(tMin);
        if (tMax > 0) dailyData[date].values.push(tMax);
        
        if (tMin > 0 && tMin < dailyData[date].min) {
            dailyData[date].min = tMin;
        }
        if (tMax > 0 && tMax > dailyData[date].max) {
            dailyData[date].max = tMax;
        }
    });

    // Detect system type
    const systemType = detectSystemType(tensionResults);
    const limits = getSystemLimits(systemType);

    let stableDays = 0;
    let unstableDays = 0;
    let outOfLimitsDays = 0;

    // Analyze each day
    Object.values(dailyData).forEach(day => {
        const variation = day.max - day.min;
        
        if (day.min < limits.min || day.max > limits.max) {
            outOfLimitsDays++;
        } else if (variation > limits.maxVariation) {
            unstableDays++;
        } else {
            stableDays++;
        }
    });

    // Calculate hourly variations
    const variations = [];
    for (let i = 1; i < tensionResults.length; i++) {
        const prevTMoy = parseFloat(tensionResults[i-1]['T_moy']) || 0;
        const currTMoy = parseFloat(tensionResults[i]['T_moy']) || 0;
        
        if (prevTMoy > 0 && currTMoy > 0) {
            const variation = Math.abs(currTMoy - prevTMoy);
            variations.push(variation);
        }
    }

    const averageVariation = variations.length > 0
        ? (variations.reduce((a, b) => a + b, 0) / variations.length).toFixed(3)
        : 0;

    const totalDays = Object.keys(dailyData).length;
    const stabilityPercentage = totalDays > 0
        ? Math.round((stableDays / totalDays) * 100)
        : 0;

    return {
        stable: stableDays,
        unstable: unstableDays,
        outOfLimits: outOfLimitsDays,
        stabilityPercentage,
        averageVariation: parseFloat(averageVariation),
        days: totalDays,
        systemType,
        limits
    };
}
// ==================== FONCTION D'ANALYSE DES DÉPASSEMENTS DE SEUIL ====================

function analyzeThresholdExceedances(tensionResults) {
    if (!tensionResults || !tensionResults.length) {
        return {
            daysWithExceedance: 0,
            totalExceedances: 0,
            totalHoursOutOfLimits: 0,
            exceedanceDays: [],
            systemType: '12V',
            limits: getSystemLimits('12V')
        };
    }

    // Détecter le type de système
    const systemType = detectSystemType(tensionResults);
    const limits = getSystemLimits(systemType);
    
    // Grouper les données par jour pour analyse
    const dailyData = {};
    
    tensionResults.forEach(item => {
        if (!item['Date et Heure']) return;
        
        const date = item['Date et Heure'].split(' ')[0];
        const time = item['Date et Heure'].split(' ')[1] || '';
        const tMin = parseFloat(item['T_min']) || 0;
        const tMax = parseFloat(item['T_max']) || 0;
        const tMoy = parseFloat(item['T_moy']) || 0;
        
        if (!dailyData[date]) {
            dailyData[date] = {
                date: date,
                records: [],
                minValues: [],
                maxValues: [],
                avgValues: [],
                minForDay: Infinity,
                maxForDay: -Infinity,
                avgForDay: 0,
                exceedanceCount: 0,
                hoursOutOfLimits: 0,
                isOutOfLimits: false
            };
        }
        
        // Ajouter cet enregistrement
        dailyData[date].records.push({
            time: time,
            tMin: tMin,
            tMax: tMax,
            tMoy: tMoy
        });
        
        // Collecter les valeurs pour analyse
        if (tMin > 0) dailyData[date].minValues.push(tMin);
        if (tMax > 0) dailyData[date].maxValues.push(tMax);
        if (tMoy > 0) dailyData[date].avgValues.push(tMoy);
        
        // Mettre à jour min/max du jour
        if (tMin > 0 && tMin < dailyData[date].minForDay) {
            dailyData[date].minForDay = tMin;
        }
        if (tMax > 0 && tMax > dailyData[date].maxForDay) {
            dailyData[date].maxForDay = tMax;
        }
        
        // Vérifier si cet enregistrement est hors limites
        if ((tMin > 0 && tMin < limits.min) || (tMax > 0 && tMax > limits.max)) {
            dailyData[date].exceedanceCount++;
            dailyData[date].isOutOfLimits = true;
            
            // Estimer les heures hors limites (1 enregistrement ≈ 1 heure si données horaires)
            // Ajustez selon la fréquence réelle de vos données
            dailyData[date].hoursOutOfLimits++;
        }
    });

    // Calculer les moyennes et préparer les résultats
    const exceedanceDays = [];
    let totalExceedances = 0;
    let totalHoursOutOfLimits = 0;
    let daysWithExceedance = 0;

    Object.keys(dailyData).sort().forEach(date => {
        const day = dailyData[date];
        
        // Calculer la moyenne du jour
        if (day.avgValues.length > 0) {
            day.avgForDay = day.avgValues.reduce((a, b) => a + b, 0) / day.avgValues.length;
        }
        
        // Calculer la variation journalière
        day.dailyVariation = day.maxForDay - day.minForDay;
        
        // Ne garder que les jours avec dépassement
        if (day.isOutOfLimits) {
            daysWithExceedance++;
            totalExceedances += day.exceedanceCount;
            totalHoursOutOfLimits += day.hoursOutOfLimits;
            
            // Formater les heures pour affichage
            let hourRange = '';
            if (day.records.length > 0) {
                const times = day.records
                    .filter(r => (r.tMin > 0 && r.tMin < limits.min) || (r.tMax > 0 && r.tMax > limits.max))
                    .map(r => r.time.split(':').slice(0, 2).join(':'));
                
                if (times.length > 0) {
                    const uniqueTimes = [...new Set(times)].sort();
                    if (uniqueTimes.length > 3) {
                        hourRange = `${uniqueTimes[0]} - ${uniqueTimes[uniqueTimes.length-1]}`;
                    } else {
                        hourRange = uniqueTimes.join(', ');
                    }
                }
            }
            
            // Trouver les valeurs exactes de dépassement
            let minOutOfLimit = null;
            let maxOutOfLimit = null;
            let minValue = null;
            let maxValue = null;
            
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
                formattedDate: new Date(day.date).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                }),
                dailyVariation: day.dailyVariation > 0 ? day.dailyVariation.toFixed(2) : '-',
                exceedanceCount: day.exceedanceCount,
                hoursOutOfLimits: day.hoursOutOfLimits,
                hourRange: hourRange,
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

    // Trier du plus récent au plus ancien
    exceedanceDays.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
        daysWithExceedance: daysWithExceedance,
        totalExceedances: totalExceedances,
        totalHoursOutOfLimits: totalHoursOutOfLimits,
        exceedanceDays: exceedanceDays,
        systemType: systemType,
        limits: limits,
        totalDays: Object.keys(dailyData).length
    };
}
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

function getTensionStatus(tensionMin, tensionMax, systemType) {
    const limits = getSystemLimits(systemType);

    if (tensionMin < limits.min || tensionMax > limits.max) {
        return {
            status: 'Hors limites',
            color: '#e53e3e',
            icon: '🔴',
            severity: 'danger'
        };
    }

    const variation = tensionMax - tensionMin;
    if (variation > limits.maxVariation) {
        return {
            status: 'Instable',
            color: '#d69e2e',
            icon: '🟡',
            severity: 'warning'
        };
    }

    return {
        status: 'Stable',
        color: '#38a169',
        icon: '✅',
        severity: 'success'
    };
}

// ==================== FONCTIONS D'ANALYSE COMMERCIALE ====================

function analyzeEnergyConsumption(energyData) {
    if (!energyData || energyData.length === 0) {
        return {
            clientCount: 0,
            daysTotal: 0,
            maxEnergyPerClient: {},
            averageConsumption: {},
            daysAboveThreshold: {}
        };
    }

    const results = {
        clientCount: 0,
        daysTotal: 0,
        maxEnergyPerClient: {},
        averageConsumption: {},
        daysAboveThreshold: {},
        dailyPeaks: {}
    };

    // Compter les clients avec des données
    const sampleRow = energyData[0];
    for (let i = 1; i <= 6; i++) {
        const energyKey = `Energie${i}`;
        if (sampleRow.hasOwnProperty(energyKey)) {
            let hasData = false;
            for (let j = 0; j < Math.min(100, energyData.length); j++) {
                const cellValue = energyData[j][energyKey];
                if (cellValue && cellValue.toString().trim() !== '' && 
                    cellValue.toString().trim() !== '0' &&
                    cellValue.toString().trim() !== '-') {
                    hasData = true;
                    break;
                }
            }
            if (hasData) results.clientCount++;
        }
    }

    // Group by date for daily analysis
    const dailyData = {};
    energyData.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const date = row['Date et Heure'].split(' ')[0];
        if (!dailyData[date]) {
            dailyData[date] = {};
        }
        
        for (let i = 1; i <= 6; i++) {
            const energyKey = `Energie${i}`;
            const cellValue = row[energyKey];
            
            if (cellValue && cellValue.toString().trim() !== '' && 
                cellValue.toString().trim() !== '-') {
                const energyValue = parseFloat(cellValue.toString().replace(',', '.'));
                
                if (!isNaN(energyValue)) {
                    if (!dailyData[date][energyKey]) {
                        dailyData[date][energyKey] = [];
                    }
                    dailyData[date][energyKey].push(energyValue);
                }
            }
        }
    });

    results.daysTotal = Object.keys(dailyData).length;

    // Calculate statistics per client
    for (let i = 1; i <= 6; i++) {
        const energyKey = `Energie${i}`;
        const clientData = [];
        
        Object.values(dailyData).forEach(day => {
            if (day[energyKey] && day[energyKey].length > 0) {
                const maxEnergy = Math.max(...day[energyKey]);
                clientData.push(maxEnergy);
            }
        });
        
        if (clientData.length > 0) {
            results.maxEnergyPerClient[energyKey] = Math.max(...clientData);
            results.averageConsumption[energyKey] = clientData.reduce((a, b) => a + b, 0) / clientData.length;
            
            // Forfait fictif - à adapter selon vos forfaits réels
            const forfaitLimit = 50; // Wh - exemple pour forfait ECO
            results.daysAboveThreshold[energyKey] = clientData.filter(value => value > forfaitLimit * 0.7).length;
        }
    }

    return results;
}

function analyzeCreditBehavior(creditData) {
    if (!creditData || creditData.length === 0) {
        return {
            totalDays: 0,
            zeroCreditDays: {},
            averageCredit: {},
            maxCredit: {},
            purchasePatterns: {}
        };
    }

    const results = {
        totalDays: 0,
        zeroCreditDays: {},
        averageCredit: {},
        maxCredit: {},
        purchasePatterns: {}
    };

    // Group by date for daily analysis
    const dailyData = {};
    creditData.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const date = row['Date et Heure'].split(' ')[0];
        if (!dailyData[date]) {
            dailyData[date] = {};
        }
        
        for (let i = 1; i <= 6; i++) {
            const creditKey = `Credit${i}`;
            const cellValue = row[creditKey];
            
            if (cellValue && cellValue.toString().trim() !== '' && 
                cellValue.toString().trim() !== '-') {
                const creditValue = parseFloat(cellValue.toString().replace(',', '.'));
                
                if (!isNaN(creditValue)) {
                    dailyData[date][creditKey] = creditValue;
                }
            }
        }
    });

    results.totalDays = Object.keys(dailyData).length;

    // Calculate statistics per client
    for (let i = 1; i <= 6; i++) {
        const creditKey = `Credit${i}`;
        const clientData = [];
        let zeroDays = 0;
        let previousCredit = null;
        const purchases = [];
        
        // Trier les dates pour analyser les évolutions
        const sortedDates = Object.keys(dailyData).sort();
        
        sortedDates.forEach(date => {
            const credit = dailyData[date][creditKey];
            if (credit !== undefined) {
                clientData.push(credit);
                
                if (credit === 0) zeroDays++;
                
                // Détecter les achats (passage de 0 à > 0)
                if (previousCredit === 0 && credit > 0) {
                    purchases.push({
                        date: date,
                        amount: credit
                    });
                }
                
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

// ==================== FONCTIONS D'AFFICHAGE DES ANALYSES ====================
function displayTensionStabilityAnalysis() {
    const techniqueContent = document.getElementById('main-tab-content-technique');
    if (!techniqueContent) return;
    
    // Supprimer l'ancienne analyse si elle existe
    const existingAnalysis = document.getElementById('tension-stability-analysis');
    if (existingAnalysis) {
        existingAnalysis.remove();
    }
    
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    if (dataToUse.length === 0) return;
    
    const stabilityData = analyzeTensionStability(dataToUse);
    const exceedanceData = analyzeThresholdExceedances(dataToUse);
    
    const analysisDiv = document.createElement('div');
    analysisDiv.id = 'tension-stability-analysis';
    analysisDiv.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        overflow: hidden;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 25px;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    header.innerHTML = `🔄 Analyse globale de la Tension`;
    analysisDiv.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.style.cssText = `padding: 20px;`;
    
    // ============ PREMIÈRE LIGNE : 4 CARTES STATISTIQUES ============
    const statsRow = document.createElement('div');
    statsRow.style.cssText = `
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
        margin-bottom: 25px;
    `;
    
    // Carte 1: Conformité globale (existante)
    const globalStabilityCard = document.createElement('div');
    globalStabilityCard.style.cssText = `
        background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%);
        padding: 16px;
        border-radius: 10px;
        border-left: 5px solid #22c55e;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        text-align: center;
    `;
    globalStabilityCard.innerHTML = `
        <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
            📊 Conformité
        </div>
        <div style="font-size: 32px; font-weight: 800; color: #22c55e; margin-bottom: 8px;">
            ${stabilityData.stabilityPercentage}%
        </div>
        <div style="font-size: 12px; color: #64748b;">
            ${stabilityData.days} jour${stabilityData.days !== 1 ? 's' : ''} analysés
        </div>
    `;
    statsRow.appendChild(globalStabilityCard);
    
    // Carte 2: Jours Stables
    const stableCard = document.createElement('div');
    stableCard.style.cssText = `
        background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%);
        padding: 16px;
        border-radius: 10px;
        border-left: 5px solid #22c55e;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        text-align: center;
    `;
    stableCard.innerHTML = `
        <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
            ✅ Jours Conforme
        </div>
        <div style="font-size: 28px; font-weight: 800; color: #22c55e; margin-bottom: 8px;">
            ${stabilityData.stable}
        </div>
        <div style="text-align: center; padding: 6px 12px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; font-size: 12px; color: #15803d; font-weight: 600;">
            ${stabilityData.days > 0 ? Math.round((stabilityData.stable / stabilityData.days) * 100) : 0}% des jours
        </div>
    `;
    statsRow.appendChild(stableCard);
    
    // Carte 3: Jours Instables
    const unstableCard = document.createElement('div');
    unstableCard.style.cssText = `
        background: linear-gradient(135deg, #fef3c7 0%, #ffffff 100%);
        padding: 16px;
        border-radius: 10px;
        border-left: 5px solid #f59e0b;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        text-align: center;
    `;
    unstableCard.innerHTML = `
        <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
            ⚠️ Jours Non Conforme
        </div>
        <div style="font-size: 28px; font-weight: 800; color: #f59e0b; margin-bottom: 8px;">
            ${stabilityData.unstable}
        </div>
        <div style="text-align: center; padding: 6px 12px; background: rgba(245, 158, 11, 0.1); border-radius: 6px; font-size: 12px; color: #92400e; font-weight: 600;">
            ${stabilityData.days > 0 ? Math.round((stabilityData.unstable / stabilityData.days) * 100) : 0}% des jours
        </div>
    `;
    statsRow.appendChild(unstableCard);
    
    // Carte 4: Jours d'Alerte (NOUVELLE CARTE)
    const alertDaysCard = document.createElement('div');
    alertDaysCard.style.cssText = `
        background: linear-gradient(135deg, #fee2e2 0%, #ffffff 100%);
        padding: 16px;
        border-radius: 10px;
        border-left: 5px solid #ef4444;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        text-align: center;
    `;
    alertDaysCard.innerHTML = `
        <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
            🚨 JOURS D'ALERTE
        </div>
        <div style="font-size: 32px; font-weight: 800; color: #ef4444; margin-bottom: 8px;">
            ${exceedanceData.daysWithExceedance} / ${stabilityData.days}
        </div>
        <div style="margin-top: 8px; font-size: 11px; color: #991b1b; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px;">
            Seuil ${exceedanceData.systemType}: ${exceedanceData.limits.min}V - ${exceedanceData.limits.max}V
        </div>
    `;
    statsRow.appendChild(alertDaysCard);
    
    content.appendChild(statsRow);
    
    // ============ TABLEAU DES JOURS AVEC DÉPASSEMENT ============
    if (exceedanceData.exceedanceDays.length > 0) {
        const exceedanceSection = document.createElement('div');
        exceedanceSection.style.cssText = `
            margin-bottom: 25px;
            border: 1px solid #fee2e2;
            border-radius: 10px;
            overflow: hidden;
        `;
        
        const exceedanceHeader = document.createElement('div');
        exceedanceHeader.style.cssText = `
            background: #fef2f2;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #fee2e2;
        `;
        exceedanceHeader.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">📅</span>
                <span style="font-weight: 700; color: #991b1b;">
                    JOURS AVEC DÉPASSEMENT DE SEUIL (${exceedanceData.exceedanceDays.length})
                </span>
            </div>
            <span style="font-size: 12px; color: #64748b;">
                Total: ${exceedanceData.totalExceedances} dépassement${exceedanceData.totalExceedances !== 1 ? 's' : ''}
            </span>
        `;
        
        const tableWrapper = document.createElement('div');
        tableWrapper.style.cssText = `
            overflow-x: auto;
            padding: 16px;
            background: white;
        `;
        
        let tableHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead style="background: #f1f5f9;">
                    <tr>
                        <th style="padding: 12px 8px; text-align: left; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Date</th>
                        <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Variation</th>
                        <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Heures alerte</th>
                        <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Min / Max</th>
                        <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Valeurs hors seuil</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        exceedanceData.exceedanceDays.forEach((day, index) => {
            // Déterminer la couleur de fond selon la gravité
            let rowBgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
            let severityColor = '#991b1b';
            
            // Mettre en évidence les jours avec beaucoup d'alertes
            if (day.hoursOutOfLimits >= 3) {
                rowBgColor = '#fff5f5';
            }
            
            // Formater les valeurs Min/Max avec indication de dépassement
            let minMaxDisplay = '';
            if (day.minValue !== '-' && parseFloat(day.minValue) < exceedanceData.limits.min) {
                minMaxDisplay += `<span style="color: #ef4444; font-weight: 700;">${day.minTension}V</span>`;
            } else {
                minMaxDisplay += `${day.minTension}V`;
            }
            minMaxDisplay += ` / `;
            if (day.maxValue !== '-' && parseFloat(day.maxValue) > exceedanceData.limits.max) {
                minMaxDisplay += `<span style="color: #ef4444; font-weight: 700;">${day.maxTension}V</span>`;
            } else {
                minMaxDisplay += `${day.maxTension}V`;
            }
            
            // Formater les valeurs hors seuil
            let exceedanceValues = [];
            if (day.minOutOfLimit !== '-') {
                exceedanceValues.push(`Min: ${day.minOutOfLimit}V`);
            }
            if (day.maxOutOfLimit !== '-') {
                exceedanceValues.push(`Max: ${day.maxOutOfLimit}V`);
            }
            const exceedanceText = exceedanceValues.length > 0 ? exceedanceValues.join(' • ') : '-';
            
            tableHTML += `
                <tr style="border-bottom: 1px solid #e2e8f0; background: ${rowBgColor};">
                    <td style="padding: 10px 8px; text-align: left; color: #1e293b; font-weight: 500;">
                        <div style="display: flex; flex-direction: column;">
                            <span>${day.formattedDate}</span>
                            <span style="font-size: 10px; color: #64748b;">${day.date}</span>
                        </div>
                    </td>
                    <td style="padding: 10px 8px; text-align: center; color: ${day.dailyVariation > exceedanceData.limits.maxVariation ? '#f59e0b' : '#1e293b'}; font-weight: ${day.dailyVariation > exceedanceData.limits.maxVariation ? '700' : '400'};">
                        ${day.dailyVariation}V
                    </td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <span style="background: ${day.hoursOutOfLimits > 0 ? 'rgba(239, 68, 68, 0.1)' : 'transparent'}; color: ${day.hoursOutOfLimits > 0 ? '#ef4444' : '#64748b'}; padding: 4px 8px; border-radius: 4px; font-weight: ${day.hoursOutOfLimits > 0 ? '600' : '400'};">
                            ${day.hoursOutOfLimits}h
                        </span>
                    </td>
                    <td style="padding: 10px 8px; text-align: center; color: #1e293b;">
                        ${minMaxDisplay}
                    </td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
                            ${exceedanceText}
                        </span>
                    </td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        tableWrapper.innerHTML = tableHTML;
        exceedanceSection.appendChild(exceedanceHeader);
        exceedanceSection.appendChild(tableWrapper);
        content.appendChild(exceedanceSection);
    } else {
        // Message si aucun dépassement
        const noExceedanceMsg = document.createElement('div');
        noExceedanceMsg.style.cssText = `
            margin-bottom: 25px;
            padding: 20px;
            background: #f0fff4;
            border: 1px solid #22c55e;
            border-radius: 10px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        `;
        noExceedanceMsg.innerHTML = `
            <span style="font-size: 24px;">✅</span>
            <div>
                <span style="font-weight: 700; color: #15803d;">Aucun dépassement de seuil détecté</span>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                    La tension est restée dans les limites ${exceedanceData.systemType} (${exceedanceData.limits.min}V - ${exceedanceData.limits.max}V) pendant toute la période
                </div>
            </div>
        `;
        content.appendChild(noExceedanceMsg);
    }
    
    // ============ CONCLUSION INTELLIGENTE ============
    const conclusionDiv = document.createElement('div');
    conclusionDiv.style.cssText = `
        background: ${stabilityData.stabilityPercentage >= 90 ? '#dcfce7' : 
                    stabilityData.stabilityPercentage >= 80 ? '#dbeafe' : 
                    stabilityData.stabilityPercentage >= 60 ? '#fef3c7' : '#fee2e2'};
        border: 2px solid ${stabilityData.stabilityPercentage >= 90 ? '#22c55e' : 
                          stabilityData.stabilityPercentage >= 80 ? '#3b82f6' : 
                          stabilityData.stabilityPercentage >= 60 ? '#f59e0b' : '#ef4444'};
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 15px;
    `;
    
    const conclusionIcon = stabilityData.stabilityPercentage >= 90 ? '✅' :
                         stabilityData.stabilityPercentage >= 80 ? '⚠️' :
                         stabilityData.stabilityPercentage >= 60 ? '🔴' : '🚫';
    
    const conclusionTitle = stabilityData.stabilityPercentage >= 90 ? 'EXCELLENTE' :
                          stabilityData.stabilityPercentage >= 80 ? 'SATISFAISANTE' :
                          stabilityData.stabilityPercentage >= 60 ? 'PRÉOCCUPANTE' : 'CRITIQUE';
    
    const stablePercent = stabilityData.days > 0 ? Math.round((stabilityData.stable/stabilityData.days)*100) : 0;
    
    let conclusionMessage = '';
    if (stabilityData.stabilityPercentage >= 90) {
        conclusionMessage = `La tension du système ${stabilityData.systemType} est <strong>excellente</strong> avec ${stablePercent}% de jours conformes. La variation moyenne de ${stabilityData.averageVariation} V/h est bien en dessous du seuil d'alerte. `;
        if (exceedanceData.daysWithExceedance > 0) {
            conclusionMessage += `<span style="color: #ef4444;">⚠️ ${exceedanceData.daysWithExceedance} jour${exceedanceData.daysWithExceedance !== 1 ? 's' : ''} présentent des dépassements ponctuels à surveiller.</span>`;
        } else {
            conclusionMessage += `Aucun dépassement de seuil détecté. L'installation électrique fonctionne de manière optimale.`;
        }
    } else if (stabilityData.stabilityPercentage >= 80) {
        conclusionMessage = `La tension est <strong>globalement stable</strong> (${stablePercent}% de jours conformes) mais présente des variations importantes certains jours. `;
        if (exceedanceData.daysWithExceedance > 0) {
            conclusionMessage += `<span style="color: #ef4444;">🚨 ${exceedanceData.daysWithExceedance} jour${exceedanceData.daysWithExceedance !== 1 ? 's' : ''} hors limites (${exceedanceData.totalHoursOutOfLimits}h).</span> Vérifier les périodes de ${exceedanceData.exceedanceDays[0]?.hourRange || 'forte consommation'}.`;
        }
    } else if (stabilityData.stabilityPercentage >= 60) {
        conclusionMessage = `La tension est <strong>préoccupante</strong> avec seulement ${stablePercent}% de jours conformes. `;
        if (exceedanceData.daysWithExceedance > 0) {
            conclusionMessage += `<span style="color: #ef4444; font-weight: 700;">${exceedanceData.daysWithExceedance} jour${exceedanceData.daysWithExceedance !== 1 ? 's' : ''} hors limites (${exceedanceData.totalHoursOutOfLimits}h).</span> Une vérification technique est recommandée en priorité.`;
        }
    } else {
        conclusionMessage = `⚠️ <strong>ALERTE CRITIQUE</strong> ⚠️ La tension est <strong>non conforme</strong> (${stablePercent}% de jours conformes seulement). `;
        if (exceedanceData.daysWithExceedance > 0) {
            conclusionMessage += `<span style="color: #ef4444; font-weight: 700;">${exceedanceData.daysWithExceedance} jour${exceedanceData.daysWithExceedance !== 1 ? 's' : ''} hors limites (${exceedanceData.totalHoursOutOfLimits}h).</span> <strong>Intervention technique URGENTE requise.</strong>`;
        }
    }
    
    conclusionDiv.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
            <span style="font-size: 24px; line-height: 1.2;">${conclusionIcon}</span>
            <div style="flex: 1;">
                <div style="font-weight: 700; color: ${stabilityData.stabilityPercentage >= 90 ? '#166534' : 
                                                      stabilityData.stabilityPercentage >= 80 ? '#1e40af' : 
                                                      stabilityData.stabilityPercentage >= 60 ? '#92400e' : '#991b1b'}; 
                          margin-bottom: 6px; font-size: 14px;">
                    ${conclusionTitle}
                </div>
                <div style="color: ${stabilityData.stabilityPercentage >= 90 ? '#166534' : 
                                   stabilityData.stabilityPercentage >= 80 ? '#1e40af' : 
                                   stabilityData.stabilityPercentage >= 60 ? '#92400e' : '#991b1b'}; 
                      font-size: 13px; line-height: 1.5;">
                    ${conclusionMessage}
                </div>
            </div>
        </div>
    `;
    
    content.appendChild(conclusionDiv);
    
    // ============ NORMES SYSTÈME ============
    const normsDiv = document.createElement('div');
    normsDiv.style.cssText = `
        background: #f8fafc;
        border-radius: 10px;
        padding: 16px;
        border: 1px solid #e2e8f0;
    `;
    
    normsDiv.innerHTML = `
        <div style="font-weight: 600; color: #2d3748; margin-bottom: 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
            <span>⚡</span> Normes Système ${stabilityData.systemType} - Seuils d'alerte
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
            <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #e53e3e;">
                <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Tension Min (alerte)</div>
                <div style="font-size: 18px; font-weight: 700; color: #e53e3e;">${stabilityData.limits.min}V</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #f59e0b;">
                <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Plage Idéale</div>
                <div style="font-size: 18px; font-weight: 700; color: #f59e0b;">${stabilityData.limits.ideal.min}V - ${stabilityData.limits.ideal.max}V</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #22c55e;">
                <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Tension Max (alerte)</div>
                <div style="font-size: 18px; font-weight: 700; color: #22c55e;">${stabilityData.limits.max}V</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #3b82f6;">
                <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Variation max</div>
                <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${stabilityData.limits.maxVariation}V</div>
            </div>
        </div>
        <div style="margin-top: 12px; padding: 10px; background: #fef2f2; border-radius: 6px; font-size: 11px; color: #991b1b; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px;">🚨</span>
            <span><strong>Dépassement de seuil détecté</strong> lorsque Tension < ${stabilityData.limits.min}V ou Tension > ${stabilityData.limits.max}V</span>
        </div>
    `;
    
    content.appendChild(normsDiv);
    analysisDiv.appendChild(content);
    
    // Insérer après la carte technique
    const technicalCard = document.getElementById('technical-data-card');
    if (technicalCard) {
        techniqueContent.insertBefore(analysisDiv, technicalCard.nextSibling);
    } else {
        techniqueContent.insertBefore(analysisDiv, techniqueContent.firstChild);
    }
}

function displayCommercialAnalysis() {
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    if (!commercialeContent) return;
    
    // Supprimer les anciennes analyses si elles existent
    const existingEnergyAnalysis = document.getElementById('energy-consumption-analysis');
    const existingCreditAnalysis = document.getElementById('credit-behavior-analysis');
    if (existingEnergyAnalysis) existingEnergyAnalysis.remove();
    if (existingCreditAnalysis) existingCreditAnalysis.remove();
    
    // Afficher l'analyse de consommation d'énergie
    if (combinedEnergyData.length > 0) {
        displayEnergyConsumptionAnalysis();
    }
    
    // Afficher l'analyse de comportement de crédit
    if (combinedSoldeData.length > 0) {
        displayCreditBehaviorAnalysis();
    }
}

function displayCreditBehaviorAnalysis() {
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    if (!commercialeContent) return;
    
    const creditDataToUse = combinedSoldeData;
    const creditData = analyzeCreditBehavior(creditDataToUse);
    
    const analysisDiv = document.createElement('div');
    analysisDiv.id = 'credit-behavior-analysis';
    analysisDiv.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        overflow: hidden;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        color: white;
        padding: 15px 25px;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    header.innerHTML = `💰 Analyse de Comportement de Crédit`;
    analysisDiv.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.style.cssText = `padding: 20px;`;
    
    // Summary stats
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 15px;
        margin-bottom: 25px;
    `;
    
    // Calculer les totaux
    let totalZeroDays = 0;
    let totalPurchases = 0;
    let totalClientsWithData = 0;
    
    for (let i = 1; i <= 6; i++) {
        const creditKey = `Credit${i}`;
        if (creditData.zeroCreditDays[creditKey] !== undefined) {
            totalZeroDays += creditData.zeroCreditDays[creditKey];
            totalPurchases += creditData.purchasePatterns[creditKey]?.length || 0;
            totalClientsWithData++;
        }
    }
    
    const avgZeroDays = totalClientsWithData > 0 ? Math.round(totalZeroDays / totalClientsWithData) : 0;
    
    summaryDiv.innerHTML = `
        <div style="background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #22c55e; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                Jours Analysés
            </div>
            <div style="font-size: 32px; font-weight: 800; color: #22c55e; margin-bottom: 8px;">
                ${creditData.totalDays}
            </div>
        </div>
        <div style="background: linear-gradient(135deg, #fed7d7 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #ef4444; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                Jours Sans Crédit
            </div>
            <div style="font-size: 32px; font-weight: 800; color: #ef4444; margin-bottom: 8px;">
                ${totalZeroDays}
            </div>
            <div style="font-size: 12px; color: #64748b;">
                ${avgZeroDays} jours/client en moyenne
            </div>
        </div>
        <div style="background: linear-gradient(135deg, #dbeafe 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                Achats Détectés
            </div>
            <div style="font-size: 32px; font-weight: 800; color: #3b82f6; margin-bottom: 8px;">
                ${totalPurchases}
            </div>
            <div style="font-size: 12px; color: #64748b;">
                recharges identifiées
            </div>
        </div>
    `;
    
    content.appendChild(summaryDiv);
    
    // Tableau détaillé par client
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
        overflow-x: auto;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
    `;
    
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead style="background: #f1f5f9;">
                <tr>
                    <th style="padding: 12px 8px; text-align: left; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Client</th>
                    <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Crédit Max (jours)</th>
                    <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Moyenne (jours)</th>
                    <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Jours à Zéro</th>
                    <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Nombre d'Achats</th>
                    <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Fiabilité</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (let i = 1; i <= 6; i++) {
        const creditKey = `Credit${i}`;
        const maxCredit = creditData.maxCredit[creditKey];
        const avgCredit = creditData.averageCredit[creditKey];
        const zeroDays = creditData.zeroCreditDays[creditKey];
        const purchases = creditData.purchasePatterns[creditKey];
        
        if (maxCredit !== undefined) {
            const purchaseCount = purchases ? purchases.length : 0;
            const reliabilityPercent = creditData.totalDays > 0 ? 
                Math.round(((creditData.totalDays - zeroDays) / creditData.totalDays) * 100) : 0;
            
            let reliability = '';
            let reliabilityColor = '';
            
            if (reliabilityPercent >= 90) {
                reliability = '✅ Excellent';
                reliabilityColor = '#22c55e';
            } else if (reliabilityPercent >= 70) {
                reliability = '👍 Bon';
                reliabilityColor = '#3b82f6';
            } else if (reliabilityPercent >= 50) {
                reliability = '⚠️ Moyen';
                reliabilityColor = '#f59e0b';
            } else {
                reliability = '🔴 Faible';
                reliabilityColor = '#ef4444';
            }
            
            tableHTML += `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${i % 2 === 0 ? '#fafbfc' : 'white'};">
                    <td style="padding: 10px 8px; color: #1e293b; font-weight: 500;">Client ${i}</td>
                    <td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 600;">${maxCredit.toFixed(0)}</td>
                    <td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 500;">${avgCredit.toFixed(1)}</td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <span style="background: rgba(239, 68, 68, 0.1); color: #991b1b; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
                            ${zeroDays} jour${zeroDays !== 1 ? 's' : ''}
                        </span>
                    </td>
                    <td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 500;">${purchaseCount}</td>
                    <td style="padding: 10px 8px; text-align: center; color: ${reliabilityColor}; font-weight: 600;">${reliability} (${reliabilityPercent}%)</td>
                </tr>
            `;
        }
    }
    
    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;
    content.appendChild(tableContainer);
    
    // Conclusion
    const conclusionDiv = document.createElement('div');
    conclusionDiv.style.cssText = `
        background: #f8fafc;
        border-radius: 10px;
        padding: 16px;
        margin-top: 20px;
        border: 1px solid #e2e8f0;
    `;
    
    const totalClients = Object.keys(creditData.averageCredit).length;
    const goodClients = Object.keys(creditData.averageCredit).filter(key => {
        const zeroDays = creditData.zeroCreditDays[key] || 0;
        const reliability = creditData.totalDays > 0 ? 
            Math.round(((creditData.totalDays - zeroDays) / creditData.totalDays) * 100) : 0;
        return reliability >= 70;
    }).length;
    
    conclusionDiv.innerHTML = `
        <div style="font-weight: 600; color: #2d3748; margin-bottom: 8px; font-size: 13px; display: flex; align-items: center; gap: 8px;">
            <span>📈</span> Synthèse de Fiabilité
        </div>
        <div style="color: #4b5563; font-size: 12px; line-height: 1.5;">
            ${totalClients} client${totalClients !== 1 ? 's' : ''} analysé${totalClients !== 1 ? 's' : ''} sur ${creditData.totalDays} jour${creditData.totalDays !== 1 ? 's' : ''}. 
            ${goodClients} client${goodClients !== 1 ? 's' : ''} (${totalClients > 0 ? Math.round((goodClients / totalClients) * 100) : 0}%) présentent une fiabilité de recharge satisfaisante.
            Les jours à crédit zéro indiquent des périodes de coupure potentielles nécessitant une attention particulière.
        </div>
    `;
    
    content.appendChild(conclusionDiv);
    analysisDiv.appendChild(content);
    
    // Insérer après l'analyse de consommation
    const energyAnalysis = document.getElementById('energy-consumption-analysis');
    if (energyAnalysis) {
        commercialeContent.insertBefore(analysisDiv, energyAnalysis.nextSibling);
    } else {
        commercialeContent.appendChild(analysisDiv);
    }
}

function displayEnergyConsumptionAnalysis() {
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    if (!commercialeContent) return;
    
    const energyDataToUse = combinedEnergyData;
    const consumptionData = analyzeEnergyConsumption(energyDataToUse);
    
    const analysisDiv = document.createElement('div');
    analysisDiv.id = 'energy-consumption-analysis';
    analysisDiv.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        overflow: hidden;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 25px;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    header.innerHTML = `💼 Analyse de Consommation d'Énergie`;
    analysisDiv.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.style.cssText = `padding: 20px;`;
    
    // Summary stats
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 25px;
    `;
    
    summaryDiv.innerHTML = `
        <div style="background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #22c55e; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                Clients Actifs
            </div>
            <div style="font-size: 32px; font-weight: 800; color: #22c55e; margin-bottom: 8px;">
                ${consumptionData.clientCount}
            </div>
            <div style="font-size: 12px; color: #64748b;">
                avec données d'énergie
            </div>
        </div>
        <div style="background: linear-gradient(135deg, #dbeafe 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                Jours Analysés
            </div>
            <div style="font-size: 32px; font-weight: 800; color: #3b82f6; margin-bottom: 8px;">
                ${consumptionData.daysTotal}
            </div>
            <div style="font-size: 12px; color: #64748b;">
                période complète
            </div>
        </div>
    `;
    
    content.appendChild(summaryDiv);
    
    // Tableau détaillé par client
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
        overflow-x: auto;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
    `;
    
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead style="background: #f1f5f9;">
                <tr>
                    <th style="padding: 12px 8px; text-align: left; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Client</th>
                    <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Énergie Max (Wh)</th>
                    <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Moyenne (Wh)</th>
                    <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Jours >70%</th>
                    <th style="padding: 12px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1;">Statut</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (let i = 1; i <= 6; i++) {
        const energyKey = `Energie${i}`;
        const maxEnergy = consumptionData.maxEnergyPerClient[energyKey];
        const avgEnergy = consumptionData.averageConsumption[energyKey];
        const daysAbove = consumptionData.daysAboveThreshold[energyKey];
        
        if (maxEnergy !== undefined) {
            const daysPercent = consumptionData.daysTotal > 0 ? 
                Math.round((daysAbove / consumptionData.daysTotal) * 100) : 0;
            
            let status = '';
            let statusColor = '';
            
            if (daysPercent >= 80) {
                status = '🔴 Critique';
                statusColor = '#ef4444';
            } else if (daysPercent >= 40) {
                status = '🟡 Moyen';
                statusColor = '#f59e0b';
            } else {
                status = '🟢 Bon';
                statusColor = '#22c55e';
            }
            
            tableHTML += `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${i % 2 === 0 ? '#fafbfc' : 'white'};">
                    <td style="padding: 10px 8px; color: #1e293b; font-weight: 500;">Client ${i}</td>
                    <td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 600;">${maxEnergy.toFixed(2)}</td>
                    <td style="padding: 10px 8px; text-align: center; color: #1e293b; font-weight: 500;">${avgEnergy.toFixed(2)}</td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <span style="background: rgba(245, 158, 11, 0.1); color: #92400e; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
                            ${daysAbove} jour${daysAbove !== 1 ? 's' : ''} (${daysPercent}%)
                        </span>
                    </td>
                    <td style="padding: 10px 8px; text-align: center; color: ${statusColor}; font-weight: 600;">${status}</td>
                </tr>
            `;
        }
    }
    
    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;
    content.appendChild(tableContainer);
    
    // Conclusion
    const conclusionDiv = document.createElement('div');
    conclusionDiv.style.cssText = `
        background: #f8fafc;
        border-radius: 10px;
        padding: 16px;
        margin-top: 20px;
        border: 1px solid #e2e8f0;
    `;
    
    conclusionDiv.innerHTML = `
        <div style="font-weight: 600; color: #2d3748; margin-bottom: 8px; font-size: 13px; display: flex; align-items: center; gap: 8px;">
            <span>📊</span> Synthèse de Consommation
        </div>
        <div style="color: #4b5563; font-size: 12px; line-height: 1.5;">
            ${consumptionData.clientCount} client${consumptionData.clientCount !== 1 ? 's' : ''} analysé${consumptionData.clientCount !== 1 ? 's' : ''} sur ${consumptionData.daysTotal} jour${consumptionData.daysTotal !== 1 ? 's' : ''}. 
            Les indicateurs montrent le nombre de jours où la consommation dépasse 70% du forfait de référence.
            Une consommation régulièrement élevée peut indiquer un forfait inadapté ou des habitudes de consommation à optimiser.
        </div>
    `;
    
    content.appendChild(conclusionDiv);
    analysisDiv.appendChild(content);
    
    // Insérer en premier dans le contenu commercial
    commercialeContent.insertBefore(analysisDiv, commercialeContent.firstChild);
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
    
    // 1. Appliquer les filtres aux données d'énergie
    if (combinedEnergyData.length > 0) {
        let filteredEnergy = combinedEnergyData;
        
        // Si des dates manuelles sont spécifiées
        if (filterStartDate || filterEndDate) {
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                
                let pass = true;
                
                if (filterStartDate) {
                    pass = pass && (rowDate >= filterStartDate);
                }
                
                if (filterEndDate) {
                    pass = pass && (rowDate <= filterEndDate);
                }
                
                return pass;
            });
        }
        
        // Si une période prédéfinie est sélectionnée
        else if (filterPeriod && filterPeriod !== 'all') {
            const now = new Date();
            let startDate = new Date(now);
            
            switch (filterPeriod) {
                case '5days':
                    startDate.setDate(now.getDate() - 5);
                    break;
                case '7days':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case '15days':
                    startDate.setDate(now.getDate() - 15);
                    break;
                case '30days':
                    startDate.setDate(now.getDate() - 30);
                    break;
                case '2months':
                    startDate.setMonth(now.getMonth() - 2);
                    break;
                case '3months':
                    startDate.setMonth(now.getMonth() - 3);
                    break;
                case '6months':
                    startDate.setMonth(now.getMonth() - 6);
                    break;
                case '1year':
                    startDate.setFullYear(now.getFullYear() - 1);
                    break;
            }
            
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate >= startDate && rowDate <= now;
            });
        }
        
        // Si un mois/année est spécifié
        else if (filterMonth && filterYear) {
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                
                return rowDate.getFullYear() === filterYear && 
                       (rowDate.getMonth() + 1) === filterMonth; // JavaScript months are 0-indexed
            });
        }
        
        // Si seulement l'année est spécifiée
        else if (filterYear && !filterMonth) {
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                
                return rowDate.getFullYear() === filterYear;
            });
        }
        
        // Si seulement le mois est spécifié (nécessite l'année actuelle)
        else if (filterMonth && !filterYear) {
            const currentYear = new Date().getFullYear();
            filteredEnergy = filteredEnergy.filter(row => {
                if (!row['Date et Heure']) return false;
                
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                
                return rowDate.getFullYear() === currentYear && 
                       (rowDate.getMonth() + 1) === filterMonth;
            });
        }
        
        filteredEnergyData = filteredEnergy;
        console.log(`✅ Données énergie filtrées: ${filteredEnergyData.length} lignes sur ${combinedEnergyData.length}`);
    }
    
    // 2. Appliquer les filtres aux données de tension (même logique)
    if (combinedTensionData.length > 0) {
        let filteredTension = combinedTensionData;
        
        // Si des dates manuelles sont spécifiées
        if (filterStartDate || filterEndDate) {
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                
                let pass = true;
                
                if (filterStartDate) {
                    pass = pass && (rowDate >= filterStartDate);
                }
                
                if (filterEndDate) {
                    pass = pass && (rowDate <= filterEndDate);
                }
                
                return pass;
            });
        }
        
        // Si une période prédéfinie est sélectionnée
        else if (filterPeriod && filterPeriod !== 'all') {
            const now = new Date();
            let startDate = new Date(now);
            
            switch (filterPeriod) {
                case '5days':
                    startDate.setDate(now.getDate() - 5);
                    break;
                case '7days':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case '15days':
                    startDate.setDate(now.getDate() - 15);
                    break;
                case '30days':
                    startDate.setDate(now.getDate() - 30);
                    break;
                case '2months':
                    startDate.setMonth(now.getMonth() - 2);
                    break;
                case '3months':
                    startDate.setMonth(now.getMonth() - 3);
                    break;
                case '6months':
                    startDate.setMonth(now.getMonth() - 6);
                    break;
                case '1year':
                    startDate.setFullYear(now.getFullYear() - 1);
                    break;
            }
            
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                
                const rowDate = new Date(row['Date et Heure']);
                return !isNaN(rowDate.getTime()) && rowDate >= startDate && rowDate <= now;
            });
        }
        
        // Si un mois/année est spécifié
        else if (filterMonth && filterYear) {
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                
                return rowDate.getFullYear() === filterYear && 
                       (rowDate.getMonth() + 1) === filterMonth;
            });
        }
        
        // Si seulement l'année est spécifiée
        else if (filterYear && !filterMonth) {
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                
                return rowDate.getFullYear() === filterYear;
            });
        }
        
        // Si seulement le mois est spécifié
        else if (filterMonth && !filterYear) {
            const currentYear = new Date().getFullYear();
            filteredTension = filteredTension.filter(row => {
                if (!row['Date et Heure']) return false;
                
                const rowDate = new Date(row['Date et Heure']);
                if (isNaN(rowDate.getTime())) return false;
                
                return rowDate.getFullYear() === currentYear && 
                       (rowDate.getMonth() + 1) === filterMonth;
            });
        }
        
        filteredTensionData = filteredTension;
        console.log(`✅ Données tension filtrées: ${filteredTensionData.length} lignes sur ${combinedTensionData.length}`);
    }
    
    // 3. Réinitialiser les paginations
    currentPageEnergy = 1;
    currentPageTension = 1;
    currentPageEvent = 1;
    currentPageSolde = 1;
    currentPageRecharge = 1;
    
    // 4. Mettre à jour l'affichage
    updateETCharts();
    updateEnergyTable();
    updateTensionTable();
    
    // 5. Mettre à jour la carte technique
    setTimeout(() => {
        createTechnicalDataCard();
    }, 300);
    
    // 6. Mettre à jour les analyses
    if (document.getElementById('main-tab-content-technique').classList.contains('active')) {
        displayTensionStabilityAnalysis();
    }
    if (document.getElementById('main-tab-content-commerciale').classList.contains('active')) {
        displayCommercialAnalysis();
    }
    if (document.getElementById('main-tab-content-evenement').classList.contains('active')) {
        displayEventAnalysis();
    }
}

function createFilterControls() {
    const tableContent = document.getElementById('combined-energy-table-content');
    if (!tableContent) return;
    
    // Détruire les anciens graphiques seulement s'ils existent
    if (typeof Chart !== 'undefined') {
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
    }
    
    // Supprimer les anciens conteneurs de graphiques
    const totalEnergyContainer = document.getElementById('total-energy-chart-container');
    if (totalEnergyContainer) totalEnergyContainer.remove();
    
    const tensionContainer = document.getElementById('tension-chart-container');
    if (tensionContainer) tensionContainer.remove();
    
    // Supprimer les anciens filtres s'ils existent
    const existingFilters = document.getElementById('et-filters-container');
    if (existingFilters) {
        existingFilters.remove();
    }
    
    // Créer le conteneur de filtres
    const filtersContainer = document.createElement('div');
    filtersContainer.id = 'et-filters-container';
    filtersContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        padding: 20px;
    `;
    
    const filtersHeader = document.createElement('div');
    filtersHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #e9ecef;
    `;
    
    filtersHeader.innerHTML = `
        <h3 style="margin: 0; color: #2c3e50; font-size: 18px; display: flex; align-items: center; gap: 10px;">
            🔍 Filtres de Date
        </h3>
        <div style="display: flex; gap: 10px;">
            <button id="reset-filters-btn" class="btn btn-secondary" style="padding: 8px 15px; font-size: 13px;">
                🔄 Réinitialiser
            </button>
            <button id="apply-filters-btn" class="btn btn-primary" style="padding: 8px 15px; font-size: 13px;">
                ✅ Appliquer
            </button>
        </div>
    `;
    
    filtersContainer.appendChild(filtersHeader);
    
    // Grille de filtres
    const filtersGrid = document.createElement('div');
    filtersGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
    `;
    
    // Filtre 1: Période prédéfinie
    const periodFilterDiv = document.createElement('div');
    periodFilterDiv.style.cssText = `
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
    `;
    
    periodFilterDiv.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50; font-size: 14px; font-weight: 600;">
            📅 Période Prédéfinie
        </h4>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <button class="period-btn ${filterPeriod === '5days' ? 'active' : ''}" data-period="5days">5 jours</button>
            <button class="period-btn ${filterPeriod === '7days' ? 'active' : ''}" data-period="7days">7 jours</button>
            <button class="period-btn ${filterPeriod === '15days' ? 'active' : ''}" data-period="15days">15 jours</button>
            <button class="period-btn ${filterPeriod === '30days' ? 'active' : ''}" data-period="30days">30 jours</button>
            <button class="period-btn ${filterPeriod === '2months' ? 'active' : ''}" data-period="2months">2 mois</button>
            <button class="period-btn ${filterPeriod === '3months' ? 'active' : ''}" data-period="3months">3 mois</button>
            <button class="period-btn ${filterPeriod === '6months' ? 'active' : ''}" data-period="6months">6 mois</button>
            <button class="period-btn ${filterPeriod === '1year' ? 'active' : ''}" data-period="1year">1 an</button>
            <button class="period-btn ${filterPeriod === 'all' ? 'active' : ''}" data-period="all">Tout</button>
        </div>
    `;
    
    filtersGrid.appendChild(periodFilterDiv);
    
    // Filtre 2: Sélection de dates
    const dateRangeFilterDiv = document.createElement('div');
    dateRangeFilterDiv.style.cssText = `
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
    `;
    
    // Obtenir les dates min et max des données
    let minDate = '';
    let maxDate = '';
    const allDates = [];
    
    if (combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            if (row['Date et Heure']) {
                const date = new Date(row['Date et Heure']);
                if (!isNaN(date.getTime())) {
                    allDates.push(date);
                }
            }
        });
    }
    if (combinedTensionData.length > 0) {
        combinedTensionData.forEach(row => {
            if (row['Date et Heure']) {
                const date = new Date(row['Date et Heure']);
                if (!isNaN(date.getTime())) {
                    allDates.push(date);
                }
            }
        });
    }
    
    if (allDates.length > 0) {
        minDate = new Date(Math.min(...allDates)).toISOString().split('T')[0];
        maxDate = new Date(Math.max(...allDates)).toISOString().split('T')[0];
    }
    
    dateRangeFilterDiv.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50; font-size: 14px; font-weight: 600;">
            📅 Sélection Manuelle
        </h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
                <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #495057;">
                    Date de début
                </label>
                <input type="date" id="start-date-input" 
                       style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;"
                       min="${minDate}" max="${maxDate}"
                       value="${filterStartDate ? filterStartDate.toISOString().split('T')[0] : ''}">
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #495057;">
                    Date de fin
                </label>
                <input type="date" id="end-date-input" 
                       style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;"
                       min="${minDate}" max="${maxDate}"
                       value="${filterEndDate ? filterEndDate.toISOString().split('T')[0] : ''}">
            </div>
        </div>
    `;
    
    filtersGrid.appendChild(dateRangeFilterDiv);
    
    // Filtre 3: Mois et Année
    const monthYearFilterDiv = document.createElement('div');
    monthYearFilterDiv.style.cssText = `
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
    `;
    
    // Extraire les années uniques des données
    const years = new Set();
    if (combinedEnergyData.length > 0) {
        combinedEnergyData.forEach(row => {
            if (row['Date et Heure']) {
                const date = new Date(row['Date et Heure']);
                if (!isNaN(date.getTime())) {
                    years.add(date.getFullYear());
                }
            }
        });
    }
    if (combinedTensionData.length > 0) {
        combinedTensionData.forEach(row => {
            if (row['Date et Heure']) {
                const date = new Date(row['Date et Heure']);
                if (!isNaN(date.getTime())) {
                    years.add(date.getFullYear());
                }
            }
        });
    }
    
    const yearsArray = Array.from(years).sort((a, b) => a - b);
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    
    monthYearFilterDiv.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50; font-size: 14px; font-weight: 600;">
            📅 Filtre par Mois/Année
        </h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
                <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #495057;">
                    Sélectionner l'année
                </label>
                <select id="year-filter-select" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
                    <option value="">Toutes les années</option>
                    ${yearsArray.map(year => `<option value="${year}" ${filterYear === year ? 'selected' : ''}>${year}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #495057;">
                    Sélectionner le mois
                </label>
                <select id="month-filter-select" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
                    <option value="">Tous les mois</option>
                    ${monthNames.map((month, index) => `<option value="${index + 1}" ${filterMonth === index + 1 ? 'selected' : ''}>${month}</option>`).join('')}
                </select>
            </div>
        </div>
        <div style="margin-top: 15px; font-size: 12px; color: #6c757d;">
            <p style="margin: 0;">📊 Données ENERGIE disponibles: ${combinedEnergyData.length} enregistrements</p>
            <p style="margin: 5px 0 0 0;">📊 Données TENSION disponibles: ${combinedTensionData.length} enregistrements</p>
            <p style="margin: 5px 0 0 0;">⏱️ Période: ${minDate} à ${maxDate}</p>
        </div>
    `;
    
    filtersGrid.appendChild(monthYearFilterDiv);
    filtersContainer.appendChild(filtersGrid);
    
    // Insérer les filtres au début du contenu énergie
    if (tableContent.firstChild) {
        tableContent.insertBefore(filtersContainer, tableContent.firstChild);
    } else {
        tableContent.appendChild(filtersContainer);
    }
    
    // Configurer les événements des filtres
    setupFilterEvents();
}

function setupFilterEvents() {
    // Boutons de période
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Retirer la classe active de tous les boutons
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
                b.style.cssText = `
                    padding: 10px;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    background: white;
                    color: #495057;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.3s;
                `;
            });
            
            // Ajouter la classe active au bouton cliqué
            this.classList.add('active');
            this.style.cssText = `
                padding: 10px;
                border: 2px solid #3498db;
                border-radius: 4px;
                background: #3498db;
                color: white;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
            `;
            
            filterPeriod = this.dataset.period;
            
            // Si on sélectionne une période, réinitialiser les autres filtres
            if (filterPeriod !== 'all') {
                document.getElementById('start-date-input').value = '';
                document.getElementById('end-date-input').value = '';
                document.getElementById('year-filter-select').value = '';
                document.getElementById('month-filter-select').value = '';
                filterStartDate = null;
                filterEndDate = null;
                filterMonth = null;
                filterYear = null;
            }
        });
    });
    
    // Bouton d'application des filtres
    document.getElementById('apply-filters-btn').addEventListener('click', function() {
        // Récupérer les dates manuelles
        const startDateInput = document.getElementById('start-date-input').value;
        const endDateInput = document.getElementById('end-date-input').value;
        
        // Récupérer les filtres mois/année
        const yearFilter = document.getElementById('year-filter-select').value;
        const monthFilter = document.getElementById('month-filter-select').value;
        
        // Traitement des dates manuelles
        if (startDateInput) {
            filterStartDate = new Date(startDateInput + 'T00:00:00');
        } else {
            filterStartDate = null;
        }
        
        if (endDateInput) {
            filterEndDate = new Date(endDateInput + 'T23:59:59');
        } else {
            filterEndDate = null;
        }
        
        // Traitement des filtres mois/année
        if (yearFilter && monthFilter) {
            filterYear = parseInt(yearFilter);
            filterMonth = parseInt(monthFilter);
            filterPeriod = 'all'; // Désactiver la période prédéfinie
            
            // Réinitialiser les boutons de période
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
                b.style.cssText = `
                    padding: 10px;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    background: white;
                    color: #495057;
                    cursor: pointer;
                    font-size: 12px;
                `;
            });
            document.querySelector('.period-btn[data-period="all"]').classList.add('active');
            document.querySelector('.period-btn[data-period="all"]').style.cssText = `
                padding: 10px;
                border: 2px solid #3498db;
                border-radius: 4px;
                background: #3498db;
                color: white;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
            `;
        } else if (yearFilter || monthFilter) {
            // Si un seul des deux est sélectionné, réinitialiser
            filterYear = null;
            filterMonth = null;
            document.getElementById('year-filter-select').value = '';
            document.getElementById('month-filter-select').value = '';
            alert('Veuillez sélectionner à la fois un mois et une année');
            return;
        } else {
            filterYear = null;
            filterMonth = null;
        }
        
        // Si on utilise les dates manuelles, désactiver la période prédéfinie
        if (startDateInput || endDateInput) {
            filterPeriod = 'all';
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
                b.style.cssText = `
                    padding: 10px;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    background: white;
                    color: #495057;
                    cursor: pointer;
                    font-size: 12px;
                `;
            });
            document.querySelector('.period-btn[data-period="all"]').classList.add('active');
            document.querySelector('.period-btn[data-period="all"]').style.cssText = `
                padding: 10px;
                border: 2px solid #3498db;
                border-radius: 4px;
                background: #3498db;
                color: white;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
            `;
        }
        
        applyDateFilters();
        showFilterMessage('Filtres appliqués');
    });
    
    // Bouton de réinitialisation
    document.getElementById('reset-filters-btn').addEventListener('click', function() {
        resetFilters();
    });
    
    // Mettre en forme les boutons de période
    document.querySelectorAll('.period-btn').forEach(btn => {
        if (btn.classList.contains('active')) {
            btn.style.cssText = `
                padding: 10px;
                border: 2px solid #3498db;
                border-radius: 4px;
                background: #3498db;
                color: white;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
            `;
        }
    });
}

function resetFilters() {
    filterStartDate = null;
    filterEndDate = null;
    filterPeriod = 'all';
    filterMonth = null;
    filterYear = null;
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
        b.style.cssText = `
            padding: 10px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background: white;
            color: #495057;
            cursor: pointer;
            font-size: 12px;
        `;
    });
    
    const allBtn = document.querySelector('.period-btn[data-period="all"]');
    if (allBtn) {
        allBtn.classList.add('active');
        allBtn.style.cssText = `
            padding: 10px;
            border: 2px solid #3498db;
            border-radius: 4px;
            background: #3498db;
            color: white;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
        `;
    }
    
    // Mettre à jour les graphiques et les tableaux
    updateETCharts();
    updateEnergyTable();
    updateTensionTable();
    showFilterMessage('Filtres réinitialisés');
}

function showFilterMessage(message = 'Filtres appliqués') {
    const oldMessage = document.getElementById('filter-message');
    if (oldMessage) oldMessage.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.id = 'filter-message';
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #27ae60;
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
    `;
    
    messageDiv.innerHTML = `<span>✅</span><span>${message}</span>`;
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
    }, 3000);
}

// ==================== ÉCRAN DE CHARGEMENT ====================

function showLoadingScreen() {
    const mainElement = document.querySelector('.analyze-main');
    mainElement.querySelectorAll('.main-tabs-container').forEach(el => {
        el.style.display = 'none';
    });
    
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.95);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    loadingScreen.innerHTML = `
        <div style="text-align: center; max-width: 600px; padding: 40px;">
            <div class="loading-spinner-large">
                <div class="spinner"></div>
            </div>
            <h2 style="color: #2c3e50; margin-top: 30px; margin-bottom: 20px;">📊 Analyse en cours...</h2>
            <p style="color: #7f8c8d; font-size: 16px; margin-bottom: 10px;">
                Chargement et analyse des fichiers du dossier
            </p>
            <p id="loading-folder-name" style="color: #3498db; font-weight: bold; font-size: 18px; margin-bottom: 30px;">
                ${escapeHtml(currentFolder.name)}
            </p>
            
            <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin-bottom: 20px; width: 100%;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #2c3e50; font-size: 14px;">Progression</span>
                    <span id="loading-percentage" style="color: #3498db; font-weight: bold; font-size: 14px;">0%</span>
                </div>
                <div style="background: #e9ecef; height: 10px; border-radius: 5px; overflow: hidden;">
                    <div id="loading-progress-bar" style="height: 100%; background: linear-gradient(90deg, #3498db, #2ecc71); width: 0%; transition: width 0.3s ease;"></div>
                </div>
                <div id="loading-status" style="color: #7f8c8d; font-size: 13px; margin-top: 10px; text-align: center;">
                    Initialisation...
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px; width: 100%;">
                <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; color: #2980b9; font-weight: bold;" id="loaded-files-count">0</div>
                    <div style="font-size: 12px; color: #7f8c8d;">Fichiers chargés</div>
                </div>
                <div style="background: #f0f8f0; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; color: #27ae60; font-weight: bold;" id="total-files-count">0</div>
                    <div style="font-size: 12px; color: #7f8c8d;">Fichiers au total</div>
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
        const progress = totalFilesToLoad > 0 ? Math.round((loadedFilesCount / totalFilesToLoad) * 100) : 0;
        
        progressBar.style.width = progress + '%';
        percentage.textContent = progress + '%';
        loadedCount.textContent = loadedFilesCount;
        totalCount.textContent = totalFilesToLoad;
        
        if (loadedFilesCount < totalFilesToLoad) {
            status.textContent = `Chargement du fichier ${loadedFilesCount + 1} sur ${totalFilesToLoad}...`;
        } else {
            status.textContent = 'Analyse des données et création des tableaux...';
        }
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
            if (loadingScreen.parentNode) {
                document.body.removeChild(loadingScreen);
            }
            
            const mainElement = document.querySelector('.analyze-main');
            mainElement.querySelectorAll('.main-tabs-container').forEach(el => {
                el.style.display = '';
            });
        }, 500);
    }
}

function setupEventListeners() {
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            sessionStorage.removeItem('analyzeFolder');
            window.location.href = 'folderUpload.html';
        });
    }
}

// ==================== INITIALISATION ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Page d\'analyse initialisée');
    initializeAnalyzePage();
});

// MODIFIER la fin de initializeAnalyzePage() - VERSION CORRIGÉE
async function initializeAnalyzePage() {
    const folderJSON = sessionStorage.getItem('analyzeFolder');
    
    if (!folderJSON) {
        showError('Aucun dossier sélectionné. Veuillez retourner et sélectionner un dossier.');
        return;
    }
    
    try {
        currentFolder = JSON.parse(folderJSON);
        folderStructure = currentFolder.structure;
        
        console.log('📂 Dossier chargé:', currentFolder.name);
        
        displayFolderInfo();
        
        // Réinitialiser les données
        energyData = [];
        tensionData = [];
        eventData = [];
        soldeData = [];
        rechargeData = [];
        combinedEnergyData = [];
        combinedTensionData = [];
        combinedEventData = [];
        combinedSoldeData = [];
        combinedRechargeData = [];
        filteredEnergyData = [];
        filteredTensionData = [];
        currentPageEnergy = 1;
        currentPageTension = 1;
        currentPageEvent = 1;
        currentPageSolde = 1;
        currentPageRecharge = 1;
        loadedFilesCount = 0;
        
        // Réinitialiser les filtres
        filterStartDate = null;
        filterEndDate = null;
        filterPeriod = 'all';
        filterMonth = null;
        filterYear = null;
        
        totalFilesToLoad = countTotalFiles(folderStructure);
        
        showLoadingScreen();
        createMainTabs();
        createCombinedTables();
        setupEventListeners();
        
        await loadFilesContent();
        
        // ✅ ATTENDRE QUE TOUTES LES DONNÉES SOIENT TRAITÉES
        setTimeout(() => {
            hideLoadingScreen();
            
            // ✅ CRÉER LA CARTE TECHNIQUE ICI - APRÈS CHARGEMENT COMPLET
            setTimeout(() => {
                createTechnicalDataCard();
                
                // Afficher l'analyse de stabilité de tension dans l'onglet technique
                if (document.getElementById('main-tab-content-technique')?.classList.contains('active')) {
                    setTimeout(() => {
                        displayTensionStabilityAnalysis();
                    }, 300);
                } else if (document.getElementById('main-tab-content-commerciale')?.classList.contains('active')) {
                    displayCommercialAnalysis();
                } else if (document.getElementById('main-tab-content-evenement')?.classList.contains('active')) {
                    displayEventAnalysis();
                }
            }, 300);
            
        }, 500);
        
        console.log('✅ Page d\'analyse prête');
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        showError('Erreur lors du chargement du dossier: ' + error.message);
        hideLoadingScreen();
    }
}

function countTotalFiles(structure) {
    let count = 0;
    
    if (structure.files && structure.files.length > 0) {
        count += structure.files.length;
    }
    
    if (structure.subdirs && structure.subdirs.length > 0) {
        structure.subdirs.forEach(subdir => {
            count += countTotalFiles(subdir);
        });
    }
    
    return count;
}

// ==================== AFFICHAGE INFORMATIONS ====================

function displayFolderInfo() {
    const titleEl = document.getElementById('folder-title');
    const subtitleEl = document.getElementById('folder-info-subtitle');
    
    titleEl.textContent = '📂 NR-' + escapeHtml(currentFolder.name);
    subtitleEl.textContent = 'Créé le ' + currentFolder.date;
}

// ==================== CRÉATION DES ONGLETS PRINCIPAUX ====================

function createMainTabs() {
    const mainElement = document.querySelector('.analyze-main');
    
    const mainTabsContainer = document.createElement('div');
    mainTabsContainer.className = 'main-tabs-container';
    mainTabsContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        margin-bottom: 20px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    `;
    
    const mainTabsHeader = document.createElement('div');
    mainTabsHeader.className = 'main-tabs-header';
    mainTabsHeader.style.cssText = `
        display: flex;
        background: #f8f9fa;
        border-bottom: 2px solid #e9ecef;
        padding: 0;
    `;
    
    // Onglet TECHNIQUE
    const techniqueTab = document.createElement('button');
    techniqueTab.id = 'main-tab-technique';
    techniqueTab.className = 'main-tab-btn active';
    techniqueTab.style.cssText = `
        flex: 1;
        padding: 18px 25px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    `;
    techniqueTab.innerHTML = '🔧 TECHNIQUE';
    techniqueTab.addEventListener('click', () => showMainTab('technique'));
    
    // Onglet COMMERCIALE
    const commercialeTab = document.createElement('button');
    commercialeTab.id = 'main-tab-commerciale';
    commercialeTab.className = 'main-tab-btn';
    commercialeTab.style.cssText = `
        flex: 1;
        padding: 18px 25px;
        background: #e9ecef;
        color: #6c757d;
        border: none;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    `;
    commercialeTab.innerHTML = '💰 COMMERCIALE';
    commercialeTab.addEventListener('click', () => showMainTab('commerciale'));
    
    // NOUVEL ONGLET : ÉVÉNEMENTS
    const evenementTab = document.createElement('button');
    evenementTab.id = 'main-tab-evenement';
    evenementTab.className = 'main-tab-btn';
    evenementTab.style.cssText = `
        flex: 1;
        padding: 18px 25px;
        background: #e9ecef;
        color: #6c757d;
        border: none;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    `;
    evenementTab.innerHTML = '⚠️ ÉVÉNEMENTS';
    evenementTab.addEventListener('click', () => showMainTab('evenement'));
    
    mainTabsHeader.appendChild(techniqueTab);
    mainTabsHeader.appendChild(commercialeTab);
    mainTabsHeader.appendChild(evenementTab);
    mainTabsContainer.appendChild(mainTabsHeader);
    
    const mainTabsContent = document.createElement('div');
    mainTabsContent.className = 'main-tabs-content';
    mainTabsContent.style.cssText = `padding: 0;`;
    
    const techniqueContent = document.createElement('div');
    techniqueContent.id = 'main-tab-content-technique';
    techniqueContent.className = 'main-tab-content active';
    techniqueContent.style.cssText = `padding: 0; display: block;`;
    
    const commercialeContent = document.createElement('div');
    commercialeContent.id = 'main-tab-content-commerciale';
    commercialeContent.className = 'main-tab-content';
    commercialeContent.style.cssText = `padding: 0; display: none;`;
    
    // NOUVEAU CONTENU : ÉVÉNEMENTS
    const evenementContent = document.createElement('div');
    evenementContent.id = 'main-tab-content-evenement';
    evenementContent.className = 'main-tab-content';
    evenementContent.style.cssText = `padding: 0; display: none;`;
    
    mainTabsContent.appendChild(techniqueContent);
    mainTabsContent.appendChild(commercialeContent);
    mainTabsContent.appendChild(evenementContent);
    mainTabsContainer.appendChild(mainTabsContent);
    
    // Supprimer l'ancien conteneur d'onglets s'il existe
    const existingTabsContainer = document.querySelector('.tabs-container');
    if (existingTabsContainer) {
        existingTabsContainer.remove();
    }
    
    mainElement.appendChild(mainTabsContainer);
}

function showMainTab(tabName) {
    // Mettre à jour les boutons d'onglets
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
    
    // Mettre à jour les contenus d'onglets
    document.querySelectorAll('.main-tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    const activeContent = document.getElementById(`main-tab-content-${tabName}`);
    if (activeContent) {
        activeContent.classList.add('active');
        activeContent.style.display = 'block';
        
        // Afficher les analyses appropriées selon l'onglet
        if (tabName === 'technique') {
            displayTensionStabilityAnalysis();
        } else if (tabName === 'commerciale') {
            displayCommercialAnalysis();
        } else if (tabName === 'evenement') {
            displayEventAnalysis();
        }
    }
    
    console.log(`📊 Onglet principal affiché: ${tabName}`);
}

// Fonction pour obtenir le dégradé de couleur selon l'onglet
function getTabGradient(tabName) {
    switch(tabName) {
        case 'technique':
            return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        case 'commerciale':
            return 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
        case 'evenement':
            return 'linear-gradient(135deg, #f39c12 0%, #d35400 100%)';
        default:
            return '#e9ecef';
    }
}

// ==================== CRÉATION DES TABLEAUX COMBINÉS ====================

function createCombinedTables() {
    // Onglet TECHNIQUE
    const techniqueContent = document.getElementById('main-tab-content-technique');
    const techniqueGrid = document.createElement('div');
    techniqueGrid.style.cssText = `display: flex; flex-direction: column; gap: 30px; padding: 20px;`;
    
    // Tableau ENERGIE (SÉPARÉ)
    const combinedEnergyContainer = document.createElement('div');
    combinedEnergyContainer.className = 'combined-table-container';
    combinedEnergyContainer.id = 'combined-energy-container';
    combinedEnergyContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        flex: 1;
    `;
    
    const energyTableHeader = document.createElement('div');
    energyTableHeader.style.cssText = `
        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
        color: white;
        padding: 15px 25px;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    energyTableHeader.innerHTML = `<span>⚡ Tableau ENERGIE (Clients)</span>`;
    combinedEnergyContainer.appendChild(energyTableHeader);
    
    const energyTableContent = document.createElement('div');
    energyTableContent.id = 'combined-energy-table-content';
    energyTableContent.style.padding = '20px';
    energyTableContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 10px; color: #7f8c8d;">Analyse des fichiers ENERGIE...</p>
        </div>
    `;
    
    combinedEnergyContainer.appendChild(energyTableContent);
    techniqueGrid.appendChild(combinedEnergyContainer);
    
    // Tableau TENSION (SÉPARÉ)
    const combinedTensionContainer = document.createElement('div');
    combinedTensionContainer.className = 'combined-table-container';
    combinedTensionContainer.id = 'combined-tension-container';
    combinedTensionContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        flex: 1;
    `;
    
    const tensionTableHeader = document.createElement('div');
    tensionTableHeader.style.cssText = `
        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        color: white;
        padding: 15px 25px;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    tensionTableHeader.innerHTML = `<span>📊 Tableau TENSION</span>`;
    combinedTensionContainer.appendChild(tensionTableHeader);
    
    const tensionTableContent = document.createElement('div');
    tensionTableContent.id = 'combined-tension-table-content';
    tensionTableContent.style.padding = '20px';
    tensionTableContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 10px; color: #7f8c8d;">Analyse des fichiers TENSION...</p>
        </div>
    `;
    
    combinedTensionContainer.appendChild(tensionTableContent);
    techniqueGrid.appendChild(combinedTensionContainer);
    
    techniqueContent.appendChild(techniqueGrid);
    
    // Onglet COMMERCIALE
    const commercialeContent = document.getElementById('main-tab-content-commerciale');
    const commercialeGrid = document.createElement('div');
    commercialeGrid.style.cssText = `display: flex; flex-direction: column; gap: 30px; padding: 20px;`;
    
    // Tableau SOLDE
    const combinedSoldeContainer = document.createElement('div');
    combinedSoldeContainer.className = 'combined-table-container';
    combinedSoldeContainer.id = 'combined-solde-container';
    combinedSoldeContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        flex: 1;
    `;
    
    const soldeTableHeader = document.createElement('div');
    soldeTableHeader.style.cssText = `
        background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
        color: white;
        padding: 15px 25px;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    soldeTableHeader.innerHTML = `<span>💰 Tableau SOLDE (Crédits)</span>`;
    combinedSoldeContainer.appendChild(soldeTableHeader);
    
    const soldeTableContent = document.createElement('div');
    soldeTableContent.id = 'combined-solde-table-content';
    soldeTableContent.style.padding = '20px';
    soldeTableContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 10px; color: #7f8c8d;">Analyse des fichiers SOLDE...</p>
        </div>
    `;
    
    combinedSoldeContainer.appendChild(soldeTableContent);
    commercialeGrid.appendChild(combinedSoldeContainer);
    
    // Tableau RECHARGE
    const combinedRechargeContainer = document.createElement('div');
    combinedRechargeContainer.className = 'combined-table-container';
    combinedRechargeContainer.id = 'combined-recharge-container';
    combinedRechargeContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        flex: 1;
    `;
    
    const rechargeTableHeader = document.createElement('div');
    rechargeTableHeader.style.cssText = `
        background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
        color: white;
        padding: 15px 25px;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    rechargeTableHeader.innerHTML = `<span>⚡ Tableau RECHARGE</span>`;
    combinedRechargeContainer.appendChild(rechargeTableHeader);
    
    const rechargeTableContent = document.createElement('div');
    rechargeTableContent.id = 'combined-recharge-table-content';
    rechargeTableContent.style.padding = '20px';
    rechargeTableContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 10px; color: #7f8c8d;">Analyse des fichiers RECHARGE...</p>
        </div>
    `;
    
    combinedRechargeContainer.appendChild(rechargeTableContent);
    commercialeGrid.appendChild(combinedRechargeContainer);
    
    commercialeContent.appendChild(commercialeGrid);
    
    // NOUVEL ONGLET : ÉVÉNEMENTS
    const evenementContent = document.getElementById('main-tab-content-evenement');
    const evenementGrid = document.createElement('div');
    evenementGrid.style.cssText = `display: flex; flex-direction: column; gap: 30px; padding: 20px;`;
    
    // Tableau des événements détaillés
    const combinedEventContainer = document.createElement('div');
    combinedEventContainer.className = 'combined-table-container';
    combinedEventContainer.id = 'combined-event-container';
    combinedEventContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        flex: 1;
    `;
    
    const eventTableHeader = document.createElement('div');
    eventTableHeader.style.cssText = `
        background: linear-gradient(135deg, #f39c12 0%, #d35400 100%);
        color: white;
        padding: 15px 25px;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    eventTableHeader.innerHTML = `<span>⚠️ Tableau détaillé des ÉVÉNEMENTS</span>`;
    combinedEventContainer.appendChild(eventTableHeader);
    
    const eventTableContent = document.createElement('div');
    eventTableContent.id = 'combined-event-table-content';
    eventTableContent.style.padding = '20px';
    eventTableContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 10px; color: #7f8c8d;">Analyse des fichiers ÉVÉNEMENTS...</p>
        </div>
    `;
    
    combinedEventContainer.appendChild(eventTableContent);
    evenementGrid.appendChild(combinedEventContainer);
    
    evenementContent.appendChild(evenementGrid);
}

// ==================== FONCTIONS DE GRAPHIQUES ====================

function createETCharts() {
    if (typeof Chart === 'undefined') {
        console.log('Chart.js pas encore chargé, nouvelle tentative...');
        setTimeout(() => createETCharts(), 500);
        return;
    }
    
    // Créer le graphique d'énergie
    createTotalEnergyChart();
    
    // Créer le graphique de tension après un court délai
    setTimeout(() => {
        createTensionChart();
    }, 100);
}

// Graphique du total d'énergie maximum
function createTotalEnergyChart() {
    const dataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    
    if (dataToUse.length === 0) {
        console.log('❌ Pas de données d\'énergie pour créer le graphique');
        return;
    }
    
    // Grouper les données par jour et calculer le total max d'énergie
    const dailyTotalEnergy = {};
    let maxEnergyDate = '';
    let maxEnergyValue = 0;
    
    dataToUse.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const date = row['Date et Heure'].split(' ')[0];
        
        if (!dailyTotalEnergy[date]) {
            dailyTotalEnergy[date] = {
                energie1: 0, energie2: 0, energie3: 0,
                energie4: 0, energie5: 0, energie6: 0
            };
        }
        
        for (let i = 1; i <= 6; i++) {
            const energyKey = `Energie${i}`;
            const energyValue = parseFloat(row[energyKey]) || 0;
            if (energyValue > dailyTotalEnergy[date][`energie${i}`]) {
                dailyTotalEnergy[date][`energie${i}`] = energyValue;
            }
        }
    });
    
    const dates = Object.keys(dailyTotalEnergy).sort();
    
    // Calculer le total d'énergie max par jour
    const totalEnergyData = dates.map(date => {
        let total = 0;
        for (let i = 1; i <= 6; i++) {
            total += dailyTotalEnergy[date][`energie${i}`] || 0;
        }
        
        // Trouver la date avec l'énergie maximale
        if (total > maxEnergyValue) {
            maxEnergyValue = total;
            maxEnergyDate = date;
        }
        
        return total;
    });
    
    // Définir les seuils des kits avec les nouvelles couleurs
    const kitThresholds = [
        { label: 'Kit 0', value: 250, color: '#FF6B6B' },    // Rouge
        { label: 'Kit 1', value: 360, color: '#FFA726' },    // Orange
        { label: 'Kit 2', value: 540, color: '#FFD93D' },    // Jaune
        { label: 'Kit 3', value: 720, color: '#4ECDC4' },    // Turquoise
        { label: 'Kit 4', value: 1080, color: '#667eea' }    // Bleu
    ];
    
    // Trouver l'énergie maximale dans les données (hors zéros)
    const nonZeroValues = totalEnergyData.filter(v => v && v > 0);
    const maxDataValue = nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 0;
    
    // DÉTERMINER LES KITS À AFFICHER DYNAMIQUEMENT
    let visibleKitThresholds = [];
    
    if (maxDataValue === 0) {
        // Aucune consommation : afficher seulement Kit 0
        visibleKitThresholds = [kitThresholds[0]];
    } else {
        // Trouver le plus petit kit qui dépasse la consommation max
        const relevantKits = kitThresholds.filter(kit => kit.value >= maxDataValue);
        
        if (relevantKits.length > 0) {
            // Afficher le kit trouvé + tous les kits inférieurs
            const maxKitIndex = kitThresholds.findIndex(kit => kit.value === relevantKits[0].value);
            visibleKitThresholds = kitThresholds.slice(0, maxKitIndex + 1);
            
            // Ajouter un kit supplémentaire si on est très proche du seuil supérieur
            if (maxKitIndex < kitThresholds.length - 1) {
                const nextKit = kitThresholds[maxKitIndex + 1];
                const ratio = maxDataValue / relevantKits[0].value;
                if (ratio > 0.8) { // Si on dépasse 80% du kit, montrer le suivant
                    visibleKitThresholds.push(nextKit);
                }
            }
        } else {
            // La consommation dépasse tous les kits : afficher tous les kits
            visibleKitThresholds = [...kitThresholds];
            // Ajouter une ligne spéciale pour la valeur max observée
            visibleKitThresholds.push({
                label: 'MAX',
                value: Math.ceil(maxDataValue / 100) * 100, // Arrondir à la centaine supérieure
                color: '#1f2933',
                dashed: true
            });
        }
    }
    
    // Si on a très peu de données, afficher au moins 2 kits pour l'échelle
    if (visibleKitThresholds.length < 2 && maxDataValue > 0) {
        const firstKitIndex = kitThresholds.findIndex(kit => kit.value >= maxDataValue);
        if (firstKitIndex > 0) {
            visibleKitThresholds.push(kitThresholds[firstKitIndex - 1]);
        }
    }
    
    // Trier par valeur croissante
    visibleKitThresholds.sort((a, b) => a.value - b.value);
    
    // Couleur des points selon le kit "adapté"
    const pointBackgroundColors = totalEnergyData.map(value => {
        if (value === 0 || value == null) {
            // Aucun kit consommé / pas de données : couleur neutre
            return '#CBD5E0';
        }
        
        // Trouver le premier kit dont la valeur est >= à l'énergie du jour
        const matchingKit = visibleKitThresholds.find(kit => value <= kit.value);
        
        if (matchingKit) {
            return matchingKit.color;
        }
        
        // Si la consommation dépasse le plus gros kit visible
        return '#1f2933';
    });
    
    // Déterminer un "kit recommandé" global pour la période
    let recommendedKit = null;
    if (nonZeroValues.length > 0) {
        const maxValue = Math.max(...nonZeroValues);
        recommendedKit = visibleKitThresholds.find(kit => maxValue <= kit.value) || null;
    }
    
    // Calculer l'échelle Y maximale pour avoir de la marge
    const maxVisibleKit = visibleKitThresholds[visibleKitThresholds.length - 1];
    const maxYValue = Math.max(
        maxDataValue * 1.2, // 20% de marge au-dessus des données
        maxVisibleKit.value * 1.1 // 10% au-dessus du plus haut kit
    );
    
    // Créer le conteneur du graphique
    const totalEnergyChartContainer = document.createElement('div');
    totalEnergyChartContainer.id = 'total-energy-chart-container';
    totalEnergyChartContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        overflow: hidden;
    `;
    
    const chartHeader = document.createElement('div');
    chartHeader.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 25px;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    chartHeader.innerHTML = '📊 Total Énergie Max par Jour & Dimensionnement Kit';
    
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = `padding: 20px;`;
    
    // Conteneur pour le résumé
    const summaryContainer = document.createElement('div');
    summaryContainer.id = 'total-energy-summary';
    summaryContainer.style.cssText = `margin-bottom: 20px;`;
    
    // Mettre à jour le texte de synthèse
    if (recommendedKit) {
        summaryContainer.innerHTML = `
            <div style="background: #f0f9ff; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <strong style="color: #1e40af;">📊 Analyse dimensionnement :</strong>
                <div style="margin-top: 8px; font-size: 13px; color: #374151;">
                    <strong>Kit recommandé :</strong> ${recommendedKit.label} (jusqu'à ${recommendedKit.value.toLocaleString('fr-FR')} Wh/jour)
                    <br>
                    <small style="color: #6b7280;">
                        ${visibleKitThresholds.length > 1 ? 
                            `Seuils affichés : ${visibleKitThresholds.map(k => k.label).join(', ')}` : 
                            `Seuil unique : ${visibleKitThresholds[0].label}`
                        }
                    </small>
                </div>
            </div>
        `;
    } else if (nonZeroValues.length === 0) {
        summaryContainer.innerHTML = `
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #94a3b8;">
                <strong style="color: #475569;">ℹ️ Information :</strong>
                <div style="margin-top: 8px; font-size: 13px; color: #64748b;">
                    Aucune consommation significative détectée. Le dimensionnement de kit n'est pas pertinent avec ces données.
                </div>
            </div>
        `;
    } else {
        summaryContainer.innerHTML = `
            <div style="background: #fef3c7; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <strong style="color: #92400e;">⚠️ Attention :</strong>
                <div style="margin-top: 8px; font-size: 13px; color: #92400e;">
                    La consommation dépasse le plus grand kit disponible (${maxVisibleKit.label}).
                    <br>
                    <small style="color: #b45309;">
                        ${visibleKitThresholds.length} seuil(s) affiché(s) sur ${kitThresholds.length} disponible(s)
                    </small>
                </div>
            </div>
        `;
    }
    
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `height: 350px; position: relative;`;
    
    totalEnergyChartContainer.appendChild(chartHeader);
    totalEnergyChartContainer.appendChild(chartWrapper);
    chartWrapper.appendChild(summaryContainer);
    chartWrapper.appendChild(canvasContainer);
    
    // Insérer le graphique au début du contenu énergie
    const energyTableContent = document.getElementById('combined-energy-table-content');
    
    // Conserver les filtres s'ils existent
    const filters = document.getElementById('et-filters-container');
    const existingChart = document.getElementById('total-energy-chart-container');
    
    if (existingChart) {
        existingChart.remove();
    }
    
    if (filters) {
        energyTableContent.insertBefore(totalEnergyChartContainer, filters.nextSibling);
    } else {
        energyTableContent.insertBefore(totalEnergyChartContainer, energyTableContent.firstChild);
    }
    
    // Créer le canvas pour le graphique
    const ctx = document.createElement('canvas');
    ctx.id = 'total-energy-chart-canvas';
    ctx.style.width = '100%';
    ctx.style.height = '100%';
    canvasContainer.appendChild(ctx);
    
    setTimeout(() => {
        if (typeof Chart === 'undefined') return;
        
        try {
            // Détruire le graphique existant s'il existe
            if (window.totalEnergyChartInstance) {
                window.totalEnergyChartInstance.destroy();
            }
            
            // Créer le graphique
            window.totalEnergyChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [
                        // Dataset principal - ligne d'énergie
                        {
                            label: 'Énergie Maximale Totale par Jour (Wh)',
                            data: totalEnergyData,
                            backgroundColor: 'rgba(102, 126, 234, 0.1)',
                            borderColor: '#667eea',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointBackgroundColor: pointBackgroundColors,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointHoverRadius: 7,
                            pointHoverBackgroundColor: '#764ba2',
                            pointHoverBorderColor: '#fff',
                            pointHoverBorderWidth: 3
                        },
                        // Dataset pour les lignes de seuils des kits (DYNAMIQUE)
                        ...visibleKitThresholds.map(kit => ({
                            label: kit.label,
                            data: dates.map(() => kit.value),
                            borderColor: kit.color,
                            borderWidth: kit.dashed ? 3 : 2.5,
                            borderDash: kit.dashed ? [10, 5] : [6, 4],
                            fill: false,
                            pointRadius: 0,
                            tension: 0
                        }))
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1000,
                        easing: 'easeInOutQuart'
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: maxYValue, // ÉCHELLE DYNAMIQUE
                            ticks: {
                                font: {
                                    size: 12,
                                    weight: '500'
                                },
                                color: '#718096',
                                callback: function (value) {
                                    return value.toLocaleString('fr-FR');
                                },
                                padding: 10
                            },
                            grid: {
                                color: 'rgba(102, 126, 234, 0.08)',
                                lineWidth: 1.5,
                                drawBorder: true,
                                borderDash: [5, 5]
                            },
                            border: {
                                display: false
                            },
                            title: {
                                display: true,
                                text: 'Énergie (Wh)',
                                font: {
                                    size: 13,
                                    weight: 'bold'
                                },
                                color: '#2c3e50',
                                padding: 12
                            }
                        },
                        x: {
                            ticks: {
                                font: {
                                    size: 12,
                                    weight: '500'
                                },
                                color: '#718096',
                                maxRotation: 45,
                                minRotation: 0,
                                padding: 8
                            },
                            grid: {
                                display: false,
                                drawBorder: false
                            },
                            border: {
                                display: true,
                                color: 'rgba(113, 128, 150, 0.2)'
                            },
                            title: {
                                display: true,
                                text: 'Dates',
                                font: {
                                    size: 13,
                                    weight: 'bold'
                                },
                                color: '#2c3e50',
                                padding: 12
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: {
                                    size: 13,
                                    weight: 'bold',
                                    family: "'Segoe UI', 'Helvetica Neue', sans-serif"
                                },
                                color: '#2c3e50',
                                padding: 15,
                                usePointStyle: true,
                                filter: function(item, chart) {
                                    // Afficher toutes les légendes
                                    return true;
                                }
                            },
                            onClick: function(e, legendItem, legend) {
                                const index = legendItem.datasetIndex;
                                const chart = legend.chart;
                                const meta = chart.getDatasetMeta(index);
                                
                                // Empêcher la désactivation des datasets de seuils
                                if (index === 0) {
                                    // Pour le dataset principal, on peut toggle
                                    meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                                } else {
                                    // Pour les seuils, on ne permet pas de les cacher
                                    return;
                                }
                                
                                chart.update();
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(45, 55, 72, 0.95)',
                            padding: 14,
                            titleFont: {
                                size: 15,
                                weight: 'bold',
                                color: '#fff'
                            },
                            bodyFont: {
                                size: 13,
                                color: '#e2e8f0'
                            },
                            cornerRadius: 8,
                            displayColors: true,
                            borderColor: 'rgba(102, 126, 234, 0.5)',
                            borderWidth: 1,
                            boxPadding: 8,
                            caretSize: 8,
                            callbacks: {
                                title: function(context) {
                                    if (context[0].datasetIndex === 0) {
                                        return '📊 ' + context[0].label;
                                    }
                                    const kitIndex = context[0].datasetIndex - 1;
                                    if (kitIndex < visibleKitThresholds.length) {
                                        const kit = visibleKitThresholds[kitIndex];
                                        return kit.dashed ? '🚨 ' + kit.label + ' - Consommation MAX' : '📏 ' + kit.label + ' - Seuil';
                                    }
                                    return 'Seuil';
                                },
                                label: function (context) {
                                    const datasetIndex = context.datasetIndex;
                                    const value = context.parsed.y.toLocaleString('fr-FR');
                                    
                                    if (datasetIndex === 0) {
                                        const date = context.label === maxEnergyDate ? ' ⚡ MAXIMUM' : '';
                                        return `${context.dataset.label}: ${value} Wh${date}`;
                                    } else {
                                        const kitIndex = datasetIndex - 1;
                                        if (kitIndex < visibleKitThresholds.length) {
                                            const kit = visibleKitThresholds[kitIndex];
                                            if (kit.dashed) {
                                                return `Seuil max recommandé: ${kit.value} Wh`;
                                            }
                                            return `Seuil ${kit.label}: ${kit.value} Wh`;
                                        }
                                        return `Seuil: ${value} Wh`;
                                    }
                                },
                                afterLabel: function(context) {
                                    const lines = [];
                                    
                                    // Message spécial pour le jour d'énergie maximale
                                    if (context.datasetIndex === 0 && context.label === maxEnergyDate) {
                                        lines.push('🏆 Énergie maximale enregistrée');
                                    }
                                    
                                    return lines;
                                }
                            }
                        }
                    }
                }
            });
            
            console.log(`📈 Graphique total énergie créé avec ${visibleKitThresholds.length} seuils de kits affichés: ${visibleKitThresholds.map(k => k.label).join(', ')}`);
            
        } catch (error) {
            console.error('Erreur lors de la création du graphique total énergie:', error);
        }
    }, 50);
}

// Graphique de tension utilisant les données du nouveau tableau de tension
function createTensionChart() {
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    
    if (dataToUse.length === 0) {
        console.log('❌ Pas de données de tension pour créer le graphique');
        return;
    }
    
    // Grouper les données par jour et calculer min, max, moyenne
    const dailyData = {};
    
    dataToUse.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const date = row['Date et Heure'].split(' ')[0];
        const tMin = parseFloat(row['T_min']) || 0;
        const tMoy = parseFloat(row['T_moy']) || 0;
        const tMax = parseFloat(row['T_max']) || 0;
        
        if (!dailyData[date]) {
            dailyData[date] = { 
                min: tMin, 
                max: tMax, 
                sumMoy: tMoy, 
                countMoy: 1,
                allMins: [tMin],
                allMaxs: [tMax]
            };
        } else {
            // Pour min: prendre le plus petit
            dailyData[date].allMins.push(tMin);
            dailyData[date].min = Math.min(dailyData[date].min, tMin);
            
            // Pour max: prendre le plus grand
            dailyData[date].allMaxs.push(tMax);
            dailyData[date].max = Math.max(dailyData[date].max, tMax);
            
            // Pour moyenne: accumuler pour calculer la moyenne plus tard
            dailyData[date].sumMoy += tMoy;
            dailyData[date].countMoy++;
        }
    });
    
    const dates = Object.keys(dailyData).sort();
    const minValues = dates.map(date => dailyData[date].min);
    const maxValues = dates.map(date => dailyData[date].max);
    const avgValues = dates.map(date => dailyData[date].sumMoy / dailyData[date].countMoy);
    
    // Créer le conteneur du graphique tension
    const tensionChartContainer = document.createElement('div');
    tensionChartContainer.id = 'tension-chart-container';
    tensionChartContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        overflow: hidden;
    `;
    
    const chartHeader = document.createElement('div');
    chartHeader.style.cssText = `
        background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        color: white;
        padding: 12px 25px;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    chartHeader.innerHTML = '📊 Tension - Min, Max et Moyenne par Jour (Données TENSION uniquement)';
    
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = `padding: 20px; height: 300px;`;
    
    tensionChartContainer.appendChild(chartHeader);
    tensionChartContainer.appendChild(chartWrapper);
    
    // Insérer le graphique au début du contenu tension
    const tensionTableContent = document.getElementById('combined-tension-table-content');
    
    // Supprimer l'ancien graphique s'il existe
    const existingChart = document.getElementById('tension-chart-container');
    if (existingChart) {
        existingChart.remove();
    }
    
    // Vérifier s'il y a déjà un contenu dans le tableau de tension
    if (tensionTableContent.children.length > 0) {
        // Insérer le graphique en premier
        tensionTableContent.insertBefore(tensionChartContainer, tensionTableContent.firstChild);
    } else {
        // Sinon, l'ajouter directement
        tensionTableContent.appendChild(tensionChartContainer);
    }
    
    // Créer le canvas pour le graphique
    const ctx = document.createElement('canvas');
    ctx.id = 'tension-chart-canvas';
    ctx.style.width = '100%';
    ctx.style.height = '100%';
    chartWrapper.appendChild(ctx);
    
    setTimeout(() => {
        if (typeof Chart === 'undefined') return;
        
        try {
            const existingChart = Chart.getChart(ctx);
            if (existingChart) existingChart.destroy();
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [
                        {
                            label: 'Tension Min',
                            data: minValues,
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4
                        },
                        {
                            label: 'Tension Moyenne',
                            data: avgValues,
                            borderColor: '#2ecc71',
                            backgroundColor: 'rgba(46, 204, 113, 0.1)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.4
                        },
                        {
                            label: 'Tension Max',
                            data: maxValues,
                            borderColor: '#e74c3c',
                            backgroundColor: 'rgba(231, 76, 60, 0.1)',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { font: { size: 11 } } },
                        tooltip: { 
                            mode: 'index', 
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += context.parsed.y.toFixed(2) + ' V';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Date', font: { size: 12, weight: 'bold' } },
                            ticks: { maxRotation: 45, font: { size: 10 } }
                        },
                        y: {
                            title: { display: true, text: 'Tension (V)', font: { size: 12, weight: 'bold' } },
                            ticks: { font: { size: 10 } }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Erreur lors de la création du graphique tension:', error);
        }
    }, 50);
}

function destroyETCharts() {
    // Supprimer le graphique d'énergie totale
    const totalEnergyContainer = document.getElementById('total-energy-chart-container');
    if (totalEnergyContainer) totalEnergyContainer.remove();
    
    // Supprimer le graphique de tension
    const tensionContainer = document.getElementById('tension-chart-container');
    if (tensionContainer) tensionContainer.remove();
    
    if (typeof Chart !== 'undefined') {
        // Détruire les chart instances
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
    }
}

function updateETCharts() {
    destroyETCharts();
    createETCharts();
    // Mettre à jour la carte technique quand les graphiques sont mis à jour
    createTechnicalDataCard();
}

// ==================== MISE À JOUR DES TABLEAUX ====================
function updateCombinedTables() {
    parseAndCombineData();
    updateEnergyTable();
    updateTensionTable();
    updateEventTable();
    updateSoldeTable();
    updateRechargeTable();
    
    // Vérifier et créer les graphiques après un délai
    setTimeout(() => {
        if (typeof Chart === 'undefined') {
            console.log('Chart.js pas disponible, nouvelle tentative dans 500ms');
            setTimeout(createETCharts, 500);
            return;
        }
        
        createETCharts();
        
        // ✅ NE PAS CRÉER LA CARTE TECHNIQUE ICI - ELLE SERA CRÉÉE DANS initializeAnalyzePage
    }, 500);
}

// Fonction pour mettre à jour le tableau ENERGIE
function updateEnergyTable() {
    const tableContent = document.getElementById('combined-energy-table-content');
    
    if (combinedEnergyData.length === 0) {
        tableContent.innerHTML = `
            <div class="empty-message">
                <div class="empty-icon">🔍</div>
                <p>Aucune donnée ENERGIE valide trouvée</p>
            </div>
        `;
        return;
    }
    
    // Utiliser les données filtrées pour le tableau
    const dataToUse = filteredEnergyData.length > 0 ? filteredEnergyData : combinedEnergyData;
    totalRowsEnergy = dataToUse.length;
    
    // Créer les contrôles de filtres si nécessaire
    if (!document.getElementById('et-filters-container')) {
        createFilterControls();
    }
    
    // Créer les graphiques si nécessaire
    setTimeout(() => {
        if (!document.getElementById('total-energy-chart-container') && typeof Chart !== 'undefined') {
            createTotalEnergyChart();
        }
    }, 100);
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls-div';
    controlsDiv.id = 'energy-controls-div';
    controlsDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 6px;
        flex-wrap: wrap;
        gap: 10px;
    `;
    
    const totalPages = Math.ceil(totalRowsEnergy / rowsPerPage);
    
    controlsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 14px; color: #2c3e50;">
                Affichage: <strong>${((currentPageEnergy - 1) * rowsPerPage + 1).toLocaleString()}</strong>
                à <strong>${Math.min(currentPageEnergy * rowsPerPage, totalRowsEnergy).toLocaleString()}</strong>
                sur <strong>${totalRowsEnergy.toLocaleString()}</strong> lignes
            </span>
            <span style="font-size: 12px; color: #27ae60; background: #e8f6ef; padding: 4px 8px; border-radius: 4px;">
                ${filteredEnergyData.length !== combinedEnergyData.length ? '🔍 FILTRÉ' : '📊 COMPLET'}
            </span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <button id="energy-first-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEnergy === 1 ? 'disabled' : ''}>
                ««
            </button>
            <button id="energy-prev-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEnergy === 1 ? 'disabled' : ''}>
                «
            </button>
            <span style="padding: 5px 15px; font-size: 13px; color: #2c3e50;">
                Page <strong>${currentPageEnergy}</strong> sur <strong>${totalPages}</strong>
            </span>
            <button id="energy-next-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEnergy === totalPages ? 'disabled' : ''}>
                »
            </button>
            <button id="energy-last-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEnergy === totalPages ? 'disabled' : ''}>
                »»
            </button>
        </div>
    `;
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'energy-table-wrapper';
    tableWrapper.style.cssText = `
        width: 100%;
        max-height: 600px;
        overflow: auto;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        position: relative;
    `;
    
    const table = document.createElement('table');
    table.id = 'combined-energy-data-table';
    table.className = 'combined-data-table';
    table.style.cssText = `width: 100%; border-collapse: collapse; font-size: 11px;`;
    
    const thead = document.createElement('thead');
    thead.style.cssText = `position: sticky; top: 0; z-index: 10; background: white;`;
    
    const headerRow = document.createElement('tr');
    
    const headers = [
        { name: 'Date et Heure', width: '160px', sticky: true },
        { name: 'Energie1', width: '75px' },
        { name: 'Energie2', width: '75px' },
        { name: 'Energie3', width: '75px' },
        { name: 'Energie4', width: '75px' },
        { name: 'Energie5', width: '75px' },
        { name: 'Energie6', width: '75px' }
    ];
    
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header.name;
        th.style.cssText = `
            padding: 10px 4px;
            text-align: ${index === 0 ? 'left' : 'center'};
            background: ${index === 0 ? '#2c3e50' : '#3498db'};
            color: white;
            border: 1px solid #dee2e6;
            font-weight: 600;
            white-space: nowrap;
            ${header.sticky ? 'position: sticky; left: 0; z-index: 11;' : ''}
            min-width: ${header.width};
            font-size: 10.5px;
        `;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Conserver uniquement les filtres et graphiques
    const filters = document.getElementById('et-filters-container');
    const totalEnergyChart = document.getElementById('total-energy-chart-container');
    
    tableContent.innerHTML = '';
    if (filters) tableContent.appendChild(filters);
    if (totalEnergyChart) tableContent.appendChild(totalEnergyChart);
    
    tableContent.appendChild(controlsDiv);
    tableContent.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    
    renderEnergyCurrentPage(dataToUse);
    setupEnergyTableControls(dataToUse);
    
    const footer = document.createElement('div');
    footer.style.cssText = `
        margin-top: 15px;
        font-size: 11px;
        color: #7f8c8d;
        text-align: center;
        padding: 10px;
        border-top: 1px solid #ecf0f1;
    `;
    footer.innerHTML = `
        <div>Tableau ENERGIE généré le ${new Date().toLocaleString()}</div>
        <div style="margin-top: 5px; font-size: 10px;">
            ${filteredEnergyData.length !== combinedEnergyData.length ? 
              `🔍 Filtre actif: ${filteredEnergyData.length} lignes sur ${combinedEnergyData.length} totales` : 
              '📊 Données complètes'}
        </div>
    `;
    tableContent.appendChild(footer);
}

function renderEnergyCurrentPage(dataToUse) {
    const table = document.getElementById('combined-energy-data-table');
    
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) oldTbody.remove();
    
    const tbody = document.createElement('tbody');
    const startIndex = (currentPageEnergy - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRowsEnergy);
    
    const renderBatch = (batchStart, batchEnd) => {
        const fragment = document.createDocumentFragment();
        
        for (let i = batchStart; i < batchEnd; i++) {
            const rowIndex = startIndex + i;
            const row = dataToUse[rowIndex];
            if (!row) continue;
            
            const tr = document.createElement('tr');
            tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
            
            const tdDate = document.createElement('td');
            tdDate.textContent = row['Date et Heure'] || '-';
            tdDate.style.cssText = `
                padding: 6px 4px;
                border: 1px solid #dee2e6;
                text-align: left;
                vertical-align: middle;
                white-space: nowrap;
                background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'};
                position: sticky;
                left: 0;
                z-index: 1;
                font-family: 'Courier New', monospace;
                font-size: 10px;
            `;
            tr.appendChild(tdDate);
            
            for (let j = 1; j <= 6; j++) {
                const energyKey = `Energie${j}`;
                const td = document.createElement('td');
                const value = row[energyKey] || '';
                
                if (value && value !== '') {
                    const numValue = parseFloat(value.replace(',', '.'));
                    td.textContent = isNaN(numValue) ? value : numValue.toFixed(2);
                    td.style.color = '#2980b9';
                } else {
                    td.textContent = '-';
                    td.style.color = '#95a5a6';
                    td.style.fontStyle = 'italic';
                }
                
                td.style.cssText = `
                    padding: 6px 4px;
                    border: 1px solid #dee2e6;
                    text-align: center;
                    vertical-align: middle;
                    white-space: nowrap;
                    font-size: 10px;
                `;
                tr.appendChild(td);
            }
            
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
    updateEnergyPaginationControls();
}

function setupEnergyTableControls(dataToUse) {
    const firstPageBtn = document.getElementById('energy-first-page-btn');
    const prevPageBtn = document.getElementById('energy-prev-page-btn');
    const nextPageBtn = document.getElementById('energy-next-page-btn');
    const lastPageBtn = document.getElementById('energy-last-page-btn');
    
    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', () => {
            currentPageEnergy = 1;
            renderEnergyCurrentPage(dataToUse);
        });
    }
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPageEnergy > 1) {
                currentPageEnergy--;
                renderEnergyCurrentPage(dataToUse);
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRowsEnergy / rowsPerPage);
            if (currentPageEnergy < totalPages) {
                currentPageEnergy++;
                renderEnergyCurrentPage(dataToUse);
            }
        });
    }
    
    if (lastPageBtn) {
        lastPageBtn.addEventListener('click', () => {
            currentPageEnergy = Math.ceil(totalRowsEnergy / rowsPerPage);
            renderEnergyCurrentPage(dataToUse);
        });
    }
}

function updateEnergyPaginationControls() {
    const totalPages = Math.ceil(totalRowsEnergy / rowsPerPage);
    
    const pageInfo = document.querySelector('#energy-controls-div span:nth-child(2)');
    if (pageInfo) {
        pageInfo.innerHTML = `Page <strong>${currentPageEnergy}</strong> sur <strong>${totalPages}</strong>`;
    }
    
    const linesInfo = document.querySelector('#energy-controls-div > div:first-child span');
    if (linesInfo) {
        linesInfo.innerHTML = `
            Affichage: <strong>${((currentPageEnergy - 1) * rowsPerPage + 1).toLocaleString()}</strong>
            à <strong>${Math.min(currentPageEnergy * rowsPerPage, totalRowsEnergy).toLocaleString()}</strong>
            sur <strong>${totalRowsEnergy.toLocaleString()}</strong> lignes
        `;
    }
    
    const firstPageBtn = document.getElementById('energy-first-page-btn');
    const prevPageBtn = document.getElementById('energy-prev-page-btn');
    const nextPageBtn = document.getElementById('energy-next-page-btn');
    const lastPageBtn = document.getElementById('energy-last-page-btn');
    
    if (firstPageBtn) firstPageBtn.disabled = currentPageEnergy === 1;
    if (prevPageBtn) prevPageBtn.disabled = currentPageEnergy === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPageEnergy === totalPages;
    if (lastPageBtn) lastPageBtn.disabled = currentPageEnergy === totalPages;
}

// Fonction pour mettre à jour le tableau TENSION
function updateTensionTable() {
    const tableContent = document.getElementById('combined-tension-table-content');
    
    if (combinedTensionData.length === 0) {
        tableContent.innerHTML = `
            <div class="empty-message">
                <div class="empty-icon">🔍</div>
                <p>Aucune donnée TENSION valide trouvée</p>
            </div>
        `;
        return;
    }
    
    // Utiliser les données filtrées pour le tableau
    const dataToUse = filteredTensionData.length > 0 ? filteredTensionData : combinedTensionData;
    totalRowsTension = dataToUse.length;
    
    // Créer les graphiques si nécessaire
    setTimeout(() => {
        if (!document.getElementById('tension-chart-container') && typeof Chart !== 'undefined') {
            createTensionChart();
        }
    }, 100);
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls-div';
    controlsDiv.id = 'tension-controls-div';
    controlsDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 6px;
        flex-wrap: wrap;
        gap: 10px;
    `;
    
    const totalPages = Math.ceil(totalRowsTension / rowsPerPage);
    
    controlsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 14px; color: #2c3e50;">
                Affichage: <strong>${((currentPageTension - 1) * rowsPerPage + 1).toLocaleString()}</strong>
                à <strong>${Math.min(currentPageTension * rowsPerPage, totalRowsTension).toLocaleString()}</strong>
                sur <strong>${totalRowsTension.toLocaleString()}</strong> lignes
            </span>
            <span style="font-size: 12px; color: #27ae60; background: #e8f6ef; padding: 4px 8px; border-radius: 4px;">
                ${filteredTensionData.length !== combinedTensionData.length ? '🔍 FILTRÉ' : '📊 COMPLET'}
            </span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <button id="tension-first-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageTension === 1 ? 'disabled' : ''}>
                ««
            </button>
            <button id="tension-prev-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageTension === 1 ? 'disabled' : ''}>
                «
            </button>
            <span style="padding: 5px 15px; font-size: 13px; color: #2c3e50;">
                Page <strong>${currentPageTension}</strong> sur <strong>${totalPages}</strong>
            </span>
            <button id="tension-next-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageTension === totalPages ? 'disabled' : ''}>
                »
            </button>
            <button id="tension-last-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageTension === totalPages ? 'disabled' : ''}>
                »»
            </button>
        </div>
    `;
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'tension-table-wrapper';
    tableWrapper.style.cssText = `
        width: 100%;
        max-height: 600px;
        overflow: auto;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        position: relative;
    `;
    
    const table = document.createElement('table');
    table.id = 'combined-tension-data-table';
    table.className = 'combined-data-table';
    table.style.cssText = `width: 100%; border-collapse: collapse; font-size: 11px;`;
    
    const thead = document.createElement('thead');
    thead.style.cssText = `position: sticky; top: 0; z-index: 10; background: white;`;
    
    const headerRow = document.createElement('tr');
    
    const headers = [
        { name: 'Date et Heure', width: '160px', sticky: true },
        { name: 'T_min', width: '75px' },
        { name: 'T_moy', width: '75px' },
        { name: 'T_max', width: '75px' }
    ];
    
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header.name;
        th.style.cssText = `
            padding: 10px 4px;
            text-align: ${index === 0 ? 'left' : 'center'};
            background: ${index === 0 ? '#2c3e50' : '#e74c3c'};
            color: white;
            border: 1px solid #dee2e6;
            font-weight: 600;
            white-space: nowrap;
            ${header.sticky ? 'position: sticky; left: 0; z-index: 11;' : ''}
            min-width: ${header.width};
            font-size: 10.5px;
        `;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Conserver uniquement les graphiques
    const tensionChart = document.getElementById('tension-chart-container');
    
    tableContent.innerHTML = '';
    if (tensionChart) tableContent.appendChild(tensionChart);
    
    tableContent.appendChild(controlsDiv);
    tableContent.appendChild(tableWrapper);
    tableWrapper.appendChild(table);
    
    renderTensionCurrentPage(dataToUse);
    setupTensionTableControls(dataToUse);
    
    const footer = document.createElement('div');
    footer.style.cssText = `
        margin-top: 15px;
        font-size: 11px;
        color: #7f8c8d;
        text-align: center;
        padding: 10px;
        border-top: 1px solid #ecf0f1;
    `;
    footer.innerHTML = `
        <div>Tableau TENSION généré le ${new Date().toLocaleString()}</div>
        <div style="margin-top: 5px; font-size: 10px;">
            ${filteredTensionData.length !== combinedTensionData.length ? 
              `🔍 Filtre actif: ${filteredTensionData.length} lignes sur ${combinedTensionData.length} totales` : 
              '📊 Données complètes'}
        </div>
    `;
    tableContent.appendChild(footer);
}

function renderTensionCurrentPage(dataToUse) {
    const table = document.getElementById('combined-tension-data-table');
    
    const oldTbody = table.querySelector('tbody');
    if (oldTbody) oldTbody.remove();
    
    const tbody = document.createElement('tbody');
    const startIndex = (currentPageTension - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRowsTension);
    
    const renderBatch = (batchStart, batchEnd) => {
        const fragment = document.createDocumentFragment();
        
        for (let i = batchStart; i < batchEnd; i++) {
            const rowIndex = startIndex + i;
            const row = dataToUse[rowIndex];
            if (!row) continue;
            
            const tr = document.createElement('tr');
            tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
            
            const tdDate = document.createElement('td');
            tdDate.textContent = row['Date et Heure'] || '-';
            tdDate.style.cssText = `
                padding: 6px 4px;
                border: 1px solid #dee2e6;
                text-align: left;
                vertical-align: middle;
                white-space: nowrap;
                background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'};
                position: sticky;
                left: 0;
                z-index: 1;
                font-family: 'Courier New', monospace;
                font-size: 10px;
            `;
            tr.appendChild(tdDate);
            
            ['T_min', 'T_moy', 'T_max'].forEach((key) => {
                const td = document.createElement('td');
                const value = row[key] || '';
                
                if (value && value !== '') {
                    const numValue = parseFloat(value.replace(',', '.'));
                    td.textContent = isNaN(numValue) ? value : numValue.toFixed(2);
                    td.style.color = '#c0392b';
                } else {
                    td.textContent = '-';
                    td.style.color = '#95a5a6';
                    td.style.fontStyle = 'italic';
                }
                
                td.style.cssText = `
                    padding: 6px 4px;
                    border: 1px solid #dee2e6;
                    text-align: center;
                    vertical-align: middle;
                    white-space: nowrap;
                    font-size: 10px;
                `;
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
    updateTensionPaginationControls();
}

function setupTensionTableControls(dataToUse) {
    const firstPageBtn = document.getElementById('tension-first-page-btn');
    const prevPageBtn = document.getElementById('tension-prev-page-btn');
    const nextPageBtn = document.getElementById('tension-next-page-btn');
    const lastPageBtn = document.getElementById('tension-last-page-btn');
    
    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', () => {
            currentPageTension = 1;
            renderTensionCurrentPage(dataToUse);
        });
    }
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPageTension > 1) {
                currentPageTension--;
                renderTensionCurrentPage(dataToUse);
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRowsTension / rowsPerPage);
            if (currentPageTension < totalPages) {
                currentPageTension++;
                renderTensionCurrentPage(dataToUse);
            }
        });
    }
    
    if (lastPageBtn) {
        lastPageBtn.addEventListener('click', () => {
            currentPageTension = Math.ceil(totalRowsTension / rowsPerPage);
            renderTensionCurrentPage(dataToUse);
        });
    }
}

function updateTensionPaginationControls() {
    const totalPages = Math.ceil(totalRowsTension / rowsPerPage);
    
    const pageInfo = document.querySelector('#tension-controls-div span:nth-child(2)');
    if (pageInfo) {
        pageInfo.innerHTML = `Page <strong>${currentPageTension}</strong> sur <strong>${totalPages}</strong>`;
    }
    
    const linesInfo = document.querySelector('#tension-controls-div > div:first-child span');
    if (linesInfo) {
        linesInfo.innerHTML = `
            Affichage: <strong>${((currentPageTension - 1) * rowsPerPage + 1).toLocaleString()}</strong>
            à <strong>${Math.min(currentPageTension * rowsPerPage, totalRowsTension).toLocaleString()}</strong>
            sur <strong>${totalRowsTension.toLocaleString()}</strong> lignes
        `;
    }
    
    const firstPageBtn = document.getElementById('tension-first-page-btn');
    const prevPageBtn = document.getElementById('tension-prev-page-btn');
    const nextPageBtn = document.getElementById('tension-next-page-btn');
    const lastPageBtn = document.getElementById('tension-last-page-btn');
    
    if (firstPageBtn) firstPageBtn.disabled = currentPageTension === 1;
    if (prevPageBtn) prevPageBtn.disabled = currentPageTension === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPageTension === totalPages;
    if (lastPageBtn) lastPageBtn.disabled = currentPageTension === totalPages;
}

// Fonction pour mettre à jour le tableau ÉVÉNEMENTS dans l'onglet ÉVÉNEMENTS
function updateEventTable() {
    const tableContent = document.getElementById('combined-event-table-content');
    if (!tableContent) return;
    
    if (combinedEventData.length === 0) {
        tableContent.innerHTML = `
            <div class="empty-message">
                <div class="empty-icon">⚠️</div>
                <p>Aucune donnée ÉVÉNEMENT valide trouvée</p>
            </div>
        `;
        return;
    }
    
    totalRowsEvent = combinedEventData.length;
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls-div';
    controlsDiv.id = 'event-controls-div';
    controlsDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 6px;
        flex-wrap: wrap;
        gap: 10px;
    `;
    
    const totalPages = Math.ceil(totalRowsEvent / rowsPerPage);
    
    controlsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 14px; color: #2c3e50;">
                Affichage: <strong>${((currentPageEvent - 1) * rowsPerPage + 1).toLocaleString()}</strong>
                à <strong>${Math.min(currentPageEvent * rowsPerPage, totalRowsEvent).toLocaleString()}</strong>
                sur <strong>${totalRowsEvent.toLocaleString()}</strong> lignes
            </span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <button id="event-first-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEvent === 1 ? 'disabled' : ''}>
                ««
            </button>
            <button id="event-prev-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEvent === 1 ? 'disabled' : ''}>
                «
            </button>
            <span style="padding: 5px 15px; font-size: 13px; color: #2c3e50;">
                Page <strong>${currentPageEvent}</strong> sur <strong>${totalPages}</strong>
            </span>
            <button id="event-next-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEvent === totalPages ? 'disabled' : ''}>
                »
            </button>
            <button id="event-last-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageEvent === totalPages ? 'disabled' : ''}>
                »»
            </button>
        </div>
    `;
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'event-table-wrapper';
    tableWrapper.style.cssText = `
        width: 100%;
        max-height: 600px;
        overflow: auto;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        position: relative;
    `;
    
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
        th.style.cssText = `
            padding: 10px 4px;
            text-align: ${index === 0 ? 'left' : 'center'};
            background: ${index === 0 ? '#f39c12' : '#d35400'};
            color: white;
            border: 1px solid #dee2e6;
            font-weight: 600;
            white-space: nowrap;
            ${header.sticky ? 'position: sticky; left: 0; z-index: 11;' : ''}
            min-width: ${header.width};
            font-size: 10.5px;
        `;
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
    footer.style.cssText = `
        margin-top: 15px;
        font-size: 11px;
        color: #7f8c8d;
        text-align: center;
        padding: 10px;
        border-top: 1px solid #ecf0f1;
    `;
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
    
    const renderBatch = (batchStart, batchEnd) => {
        const fragment = document.createDocumentFragment();
        
        for (let i = batchStart; i < batchEnd; i++) {
            const rowIndex = startIndex + i;
            const row = combinedEventData[rowIndex];
            if (!row) continue;
            
            const tr = document.createElement('tr');
            tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
            
            // Date et Heure
            const tdDate = document.createElement('td');
            tdDate.textContent = row['Date et Heure'] || '-';
            tdDate.style.cssText = `
                padding: 6px 4px;
                border: 1px solid #dee2e6;
                text-align: left;
                vertical-align: middle;
                white-space: nowrap;
                background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'};
                position: sticky;
                left: 0;
                z-index: 1;
                font-family: 'Courier New', monospace;
                font-size: 10px;
            `;
            tr.appendChild(tdDate);
            
            // Évènements
            const tdEvent = document.createElement('td');
            const eventValue = row['Évènements'] || '-';
            tdEvent.textContent = eventValue;
            
            let eventColor = '#2c3e50';
            let eventBackground = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
            
            if (eventValue.toLowerCase().includes('surcharge')) {
                eventColor = '#dc2626'; // Rouge plus foncé
                eventBackground = (i % 2 === 0) ? '#fee2e2' : '#fecaca';
            } else if (eventValue.toLowerCase().includes('démarrage')) {
                eventColor = '#059669'; // Vert émeraude
                eventBackground = (i % 2 === 0) ? '#d1fae5' : '#a7f3d0';
            } else if (eventValue.toLowerCase().includes('arrêt')) {
                eventColor = '#4b5563'; // Gris graphite
                eventBackground = (i % 2 === 0) ? '#f3f4f6' : '#e5e7eb';
            } else if (eventValue.toLowerCase().includes('suspendp')) {
                eventColor = '#7c3aed'; // Violet
                eventBackground = (i % 2 === 0) ? '#ede9fe' : '#ddd6fe';
            } else if (eventValue.toLowerCase().includes('suspende')) {
                eventColor = '#0ea5e9'; // Bleu ciel
                eventBackground = (i % 2 === 0) ? '#e0f2fe' : '#bae6fd';
            } else if (eventValue.toLowerCase().includes('delestagepartiel')) {
                eventColor = '#ea580c'; // Orange vif
                eventBackground = (i % 2 === 0) ? '#ffedd5' : '#fed7aa';
            } else if (eventValue.toLowerCase().includes('delestagetotal')) {
                eventColor = '#991b1b'; // Rouge bordeaux
                eventBackground = (i % 2 === 0) ? '#fef2f2' : '#fecaca';
            } else if (eventValue.toLowerCase().includes('maintenance')) {
                eventColor = '#6d28d9'; // Violet foncé
                eventBackground = (i % 2 === 0) ? '#f3e8ff' : '#e9d5ff';
            } else if (eventValue.toLowerCase().includes('erreur')) {
                eventColor = '#be123c'; // Rose foncé
                eventBackground = (i % 2 === 0) ? '#ffe4e6' : '#fecdd3';
            } else if (eventValue.toLowerCase().includes('alerte')) {
                eventColor = '#f59e0b'; // Jaune-orange
                eventBackground = (i % 2 === 0) ? '#fef3c7' : '#fde68a';
            } else if (eventValue.toLowerCase().includes('normal')) {
                eventColor = '#10b981'; // Vert
                eventBackground = (i % 2 === 0) ? '#d1fae5' : '#a7f3d0';
            }
            
            tdEvent.style.cssText = `
                padding: 6px 4px;
                border: 1px solid #dee2e6;
                text-align: left;
                vertical-align: middle;
                white-space: nowrap;
                font-size: 10px;
                font-weight: bold;
                color: ${eventColor};
                background: ${eventBackground};
            `;
            tr.appendChild(tdEvent);
            
            // Codes 1, 2, 3
            for (let j = 1; j <= 3; j++) {
                const codeKey = `Code ${j}`;
                const td = document.createElement('td');
                const value = row[codeKey] || '';
                
                if (value && value !== '') {
                    const numValue = parseFloat(value.replace(',', '.'));
                    
                    if (isNaN(numValue)) {
                        td.textContent = value;
                    } else {
                        if (Number.isInteger(numValue)) {
                            td.textContent = numValue.toString();
                        } else {
                            const stringValue = value.replace(',', '.');
                            if (stringValue.includes('.') && stringValue.endsWith('00')) {
                                td.textContent = Math.trunc(numValue).toString();
                            } else {
                                td.textContent = stringValue.replace(/\.?0+$/, '');
                            }
                        }
                    }
                    td.style.color = '#2980b9';
                    td.style.fontWeight = 'bold';
                } else {
                    td.textContent = '-';
                    td.style.color = '#95a5a6';
                    td.style.fontStyle = 'italic';
                }
                
                td.style.cssText = `
                    padding: 6px 4px;
                    border: 1px solid #dee2e6;
                    text-align: center;
                    vertical-align: middle;
                    white-space: nowrap;
                    font-size: 10px;
                    background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'};
                `;
                tr.appendChild(td);
            }
            
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
    updateEventPaginationControls();
}

function setupEventTableControls() {
    const firstPageBtn = document.getElementById('event-first-page-btn');
    const prevPageBtn = document.getElementById('event-prev-page-btn');
    const nextPageBtn = document.getElementById('event-next-page-btn');
    const lastPageBtn = document.getElementById('event-last-page-btn');
    
    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', () => {
            currentPageEvent = 1;
            renderEventCurrentPage();
        });
    }
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPageEvent > 1) {
                currentPageEvent--;
                renderEventCurrentPage();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRowsEvent / rowsPerPage);
            if (currentPageEvent < totalPages) {
                currentPageEvent++;
                renderEventCurrentPage();
            }
        });
    }
    
    if (lastPageBtn) {
        lastPageBtn.addEventListener('click', () => {
            currentPageEvent = Math.ceil(totalRowsEvent / rowsPerPage);
            renderEventCurrentPage();
        });
    }
}

function updateEventPaginationControls() {
    const totalPages = Math.ceil(totalRowsEvent / rowsPerPage);
    
    const pageInfo = document.querySelector('#event-controls-div span:nth-child(2)');
    if (pageInfo) {
        pageInfo.innerHTML = `Page <strong>${currentPageEvent}</strong> sur <strong>${totalPages}</strong>`;
    }
    
    const linesInfo = document.querySelector('#event-controls-div > div:first-child span');
    if (linesInfo) {
        linesInfo.innerHTML = `
            Affichage: <strong>${((currentPageEvent - 1) * rowsPerPage + 1).toLocaleString()}</strong>
            à <strong>${Math.min(currentPageEvent * rowsPerPage, totalRowsEvent).toLocaleString()}</strong>
            sur <strong>${totalRowsEvent.toLocaleString()}</strong> lignes
        `;
    }
    
    const firstPageBtn = document.getElementById('event-first-page-btn');
    const prevPageBtn = document.getElementById('event-prev-page-btn');
    const nextPageBtn = document.getElementById('event-next-page-btn');
    const lastPageBtn = document.getElementById('event-last-page-btn');
    
    if (firstPageBtn) firstPageBtn.disabled = currentPageEvent === 1;
    if (prevPageBtn) prevPageBtn.disabled = currentPageEvent === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPageEvent === totalPages;
    if (lastPageBtn) lastPageBtn.disabled = currentPageEvent === totalPages;
}

// Fonction pour mettre à jour le tableau SOLDE (simplifiée)
function updateSoldeTable() {
    const tableContent = document.getElementById('combined-solde-table-content');
    
    if (combinedSoldeData.length === 0) {
        tableContent.innerHTML = `
            <div class="empty-message">
                <div class="empty-icon">💰</div>
                <p>Aucune donnée SOLDE valide trouvée</p>
            </div>
        `;
        return;
    }
    
    totalRowsSolde = combinedSoldeData.length;
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls-div';
    controlsDiv.id = 'solde-controls-div';
    controlsDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 6px;
        flex-wrap: wrap;
        gap: 10px;
    `;
    
    const totalPages = Math.ceil(totalRowsSolde / rowsPerPage);
    
    controlsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 14px; color: #2c3e50;">
                Affichage: <strong>${((currentPageSolde - 1) * rowsPerPage + 1).toLocaleString()}</strong>
                à <strong>${Math.min(currentPageSolde * rowsPerPage, totalRowsSolde).toLocaleString()}</strong>
                sur <strong>${totalRowsSolde.toLocaleString()}</strong> lignes
            </span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <button id="solde-first-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageSolde === 1 ? 'disabled' : ''}>
                ««
            </button>
            <button id="solde-prev-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageSolde === 1 ? 'disabled' : ''}>
                «
            </button>
            <span style="padding: 5px 15px; font-size: 13px; color: #2c3e50;">
                Page <strong>${currentPageSolde}</strong> sur <strong>${totalPages}</strong>
            </span>
            <button id="solde-next-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageSolde === totalPages ? 'disabled' : ''}>
                »
            </button>
            <button id="solde-last-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageSolde === totalPages ? 'disabled' : ''}>
                »»
            </button>
        </div>
    `;
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'solde-table-wrapper';
    tableWrapper.style.cssText = `
        width: 100%;
        max-height: 600px;
        overflow: auto;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        position: relative;
    `;
    
    const table = document.createElement('table');
    table.id = 'combined-solde-data-table';
    table.className = 'combined-data-table';
    table.style.cssText = `width: 100%; border-collapse: collapse; font-size: 11px;`;
    
    const thead = document.createElement('thead');
    thead.style.cssText = `position: sticky; top: 0; z-index: 10; background: white;`;
    
    const headerRow = document.createElement('tr');
    
    const headers = [
        { name: 'Date et Heure', width: '160px', sticky: true },
        { name: 'Credit1', width: '80px' },
        { name: 'Credit2', width: '80px' },
        { name: 'Credit3', width: '80px' },
        { name: 'Credit4', width: '80px' },
        { name: 'Credit5', width: '80px' },
        { name: 'Credit6', width: '80px' }
    ];
    
    headers.forEach((header, index) => {
        const th = document.createElement('th');
        th.textContent = header.name;
        th.style.cssText = `
            padding: 10px 4px;
            text-align: ${index === 0 ? 'left' : 'center'};
            background: ${index === 0 ? '#27ae60' : '#2ecc71'};
            color: white;
            border: 1px solid #dee2e6;
            font-weight: 600;
            white-space: nowrap;
            ${header.sticky ? 'position: sticky; left: 0; z-index: 11;' : ''}
            min-width: ${header.width};
            font-size: 10.5px;
        `;
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
    footer.style.cssText = `
        margin-top: 15px;
        font-size: 11px;
        color: #7f8c8d;
        text-align: center;
        padding: 10px;
        border-top: 1px solid #ecf0f1;
    `;
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
    
    const renderBatch = (batchStart, batchEnd) => {
        const fragment = document.createDocumentFragment();
        
        for (let i = batchStart; i < batchEnd; i++) {
            const rowIndex = startIndex + i;
            const row = combinedSoldeData[rowIndex];
            if (!row) continue;
            
            const tr = document.createElement('tr');
            tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
            
            const tdDate = document.createElement('td');
            tdDate.textContent = row['Date et Heure'] || '-';
            tdDate.style.cssText = `
                padding: 6px 4px;
                border: 1px solid #dee2e6;
                text-align: left;
                vertical-align: middle;
                white-space: nowrap;
                background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'};
                position: sticky;
                left: 0;
                z-index: 1;
                font-family: 'Courier New', monospace;
                font-size: 10px;
            `;
            tr.appendChild(tdDate);
            
            for (let j = 1; j <= 6; j++) {
                const creditKey = `Credit${j}`;
                const td = document.createElement('td');
                const value = row[creditKey] || '';
                
                if (value && value !== '') {
                    const numValue = parseFloat(value.replace(',', '.'));
                    
                    if (isNaN(numValue)) {
                        td.textContent = value;
                    } else {
                        if (Number.isInteger(numValue)) {
                            td.textContent = numValue.toString();
                        } else {
                            const stringValue = value.replace(',', '.');
                            if (stringValue.includes('.') && stringValue.endsWith('00')) {
                                td.textContent = Math.trunc(numValue).toString();
                            } else {
                                td.textContent = stringValue.replace(/\.?0+$/, '');
                            }
                        }
                    }
                    td.style.color = '#27ae60';
                    td.style.fontWeight = 'bold';
                } else {
                    td.textContent = '-';
                    td.style.color = '#95a5a6';
                    td.style.fontStyle = 'italic';
                }
                
                td.style.cssText = `
                    padding: 6px 4px;
                    border: 1px solid #dee2e6;
                    text-align: center;
                    vertical-align: middle;
                    white-space: nowrap;
                    font-size: 10px;
                `;
                tr.appendChild(td);
            }
            
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
    updateSoldePaginationControls();
}

function setupSoldeTableControls() {
    const firstPageBtn = document.getElementById('solde-first-page-btn');
    const prevPageBtn = document.getElementById('solde-prev-page-btn');
    const nextPageBtn = document.getElementById('solde-next-page-btn');
    const lastPageBtn = document.getElementById('solde-last-page-btn');
    
    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', () => {
            currentPageSolde = 1;
            renderSoldeCurrentPage();
        });
    }
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPageSolde > 1) {
                currentPageSolde--;
                renderSoldeCurrentPage();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRowsSolde / rowsPerPage);
            if (currentPageSolde < totalPages) {
                currentPageSolde++;
                renderSoldeCurrentPage();
            }
        });
    }
    
    if (lastPageBtn) {
        lastPageBtn.addEventListener('click', () => {
            currentPageSolde = Math.ceil(totalRowsSolde / rowsPerPage);
            renderSoldeCurrentPage();
        });
    }
}

function updateSoldePaginationControls() {
    const totalPages = Math.ceil(totalRowsSolde / rowsPerPage);
    
    const pageInfo = document.querySelector('#solde-controls-div span:nth-child(2)');
    if (pageInfo) {
        pageInfo.innerHTML = `Page <strong>${currentPageSolde}</strong> sur <strong>${totalPages}</strong>`;
    }
    
    const linesInfo = document.querySelector('#solde-controls-div > div:first-child span');
    if (linesInfo) {
        linesInfo.innerHTML = `
            Affichage: <strong>${((currentPageSolde - 1) * rowsPerPage + 1).toLocaleString()}</strong>
            à <strong>${Math.min(currentPageSolde * rowsPerPage, totalRowsSolde).toLocaleString()}</strong>
            sur <strong>${totalRowsSolde.toLocaleString()}</strong> lignes
        `;
    }
    
    const firstPageBtn = document.getElementById('solde-first-page-btn');
    const prevPageBtn = document.getElementById('solde-prev-page-btn');
    const nextPageBtn = document.getElementById('solde-next-page-btn');
    const lastPageBtn = document.getElementById('solde-last-page-btn');
    
    if (firstPageBtn) firstPageBtn.disabled = currentPageSolde === 1;
    if (prevPageBtn) prevPageBtn.disabled = currentPageSolde === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPageSolde === totalPages;
    if (lastPageBtn) lastPageBtn.disabled = currentPageSolde === totalPages;
}

// Fonction pour mettre à jour le tableau RECHARGE (simplifiée)
function updateRechargeTable() {
    const tableContent = document.getElementById('combined-recharge-table-content');
    
    if (combinedRechargeData.length === 0) {
        tableContent.innerHTML = `
            <div class="empty-message">
                <div class="empty-icon">⚡</div>
                <p>Aucune donnée RECHARGE valide trouvée</p>
            </div>
        `;
        return;
    }
    
    totalRowsRecharge = combinedRechargeData.length;
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls-div';
    controlsDiv.id = 'recharge-controls-div';
    controlsDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 6px;
        flex-wrap: wrap;
        gap: 10px;
    `;
    
    const totalPages = Math.ceil(totalRowsRecharge / rowsPerPage);
    
    controlsDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 14px; color: #2c3e50;">
                Affichage: <strong>${((currentPageRecharge - 1) * rowsPerPage + 1).toLocaleString()}</strong>
                à <strong>${Math.min(currentPageRecharge * rowsPerPage, totalRowsRecharge).toLocaleString()}</strong>
                sur <strong>${totalRowsRecharge.toLocaleString()}</strong> lignes
            </span>
        </div>
        <div style="display: flex; align-items: center; gap: 5px;">
            <button id="recharge-first-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageRecharge === 1 ? 'disabled' : ''}>
                ««
            </button>
            <button id="recharge-prev-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageRecharge === 1 ? 'disabled' : ''}>
                «
            </button>
            <span style="padding: 5px 15px; font-size: 13px; color: #2c3e50;">
                Page <strong>${currentPageRecharge}</strong> sur <strong>${totalPages}</strong>
            </span>
            <button id="recharge-next-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageRecharge === totalPages ? 'disabled' : ''}>
                »
            </button>
            <button id="recharge-last-page-btn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;" ${currentPageRecharge === totalPages ? 'disabled' : ''}>
                »»
            </button>
        </div>
    `;
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'recharge-table-wrapper';
    tableWrapper.style.cssText = `
        width: 100%;
        max-height: 600px;
        overflow: auto;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        position: relative;
    `;
    
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
        th.style.cssText = `
            padding: 10px 4px;
            text-align: ${index === 0 ? 'left' : 'center'};
            background: ${index === 0 ? '#9b59b6' : '#8e44ad'};
            color: white;
            border: 1px solid #dee2e6;
            font-weight: 600;
            white-space: nowrap;
            ${header.sticky ? 'position: sticky; left: 0; z-index: 11;' : ''}
            min-width: ${header.width};
            font-size: 10.5px;
        `;
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
    footer.style.cssText = `
        margin-top: 15px;
        font-size: 11px;
        color: #7f8c8d;
        text-align: center;
        padding: 10px;
        border-top: 1px solid #ecf0f1;
    `;
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
    
    const renderBatch = (batchStart, batchEnd) => {
        const fragment = document.createDocumentFragment();
        
        for (let i = batchStart; i < batchEnd; i++) {
            const rowIndex = startIndex + i;
            const row = combinedRechargeData[rowIndex];
            if (!row) continue;
            
            const tr = document.createElement('tr');
            tr.style.backgroundColor = (i % 2 === 0) ? '#ffffff' : '#f8f9fa';
            
            // Date et Heure
            const tdDate = document.createElement('td');
            tdDate.textContent = row['Date et Heure'] || '-';
            tdDate.style.cssText = `
                padding: 6px 4px;
                border: 1px solid #dee2e6;
                text-align: left;
                vertical-align: middle;
                white-space: nowrap;
                background: ${(i % 2 === 0) ? '#ffffff' : '#f8f9fa'};
                position: sticky;
                left: 0;
                z-index: 1;
                font-family: 'Courier New', monospace;
                font-size: 10px;
            `;
            tr.appendChild(tdDate);
            
            // Code enregistrer
            const tdCode = document.createElement('td');
            tdCode.textContent = row['Code enregistrer'] || '-';
            tdCode.style.cssText = `
                padding: 6px 4px;
                border: 1px solid #dee2e6;
                text-align: center;
                vertical-align: middle;
                white-space: nowrap;
                font-size: 10px;
                font-family: 'Courier New', monospace;
                color: #2980b9;
            `;
            tr.appendChild(tdCode);
            
            // Type de code
            const tdType = document.createElement('td');
            const typeValue = row['Type de code'] || '-';
            tdType.textContent = typeValue;
            tdType.style.cssText = `
                padding: 6px 4px;
                border: 1px solid #dee2e6;
                text-align: center;
                vertical-align: middle;
                white-space: nowrap;
                font-size: 10px;
                color: #27ae60;
                font-weight: ${typeValue !== '-' ? 'bold' : 'normal'};
            `;
            tr.appendChild(tdType);
            
            // Status
            const tdStatus = document.createElement('td');
            const statusValue = row['Status'] || '-';
            tdStatus.textContent = statusValue;
            tdStatus.style.cssText = `
                padding: 6px 4px;
                border: 1px solid #dee2e6;
                text-align: center;
                vertical-align: middle;
                white-space: nowrap;
                font-size: 10px;
                color: ${statusValue.toLowerCase().includes('reussie') ? '#27ae60' : 
                        statusValue.toLowerCase().includes('echoue') ? '#e74c3c' : 
                        '#f39c12'};
                font-weight: bold;
            `;
            tr.appendChild(tdStatus);
            
            // Codes 1 à 4
            for (let j = 1; j <= 4; j++) {
                const codeKey = `Code ${j}`;
                const td = document.createElement('td');
                const value = row[codeKey] || '';
                
                if (value && value !== '') {
                    const numValue = parseFloat(value.replace(',', '.'));
                    
                    if (isNaN(numValue)) {
                        td.textContent = value;
                    } else {
                        if (Number.isInteger(numValue)) {
                            td.textContent = numValue.toString();
                        } else {
                            const stringValue = value.replace(',', '.');
                            if (stringValue.includes('.') && stringValue.endsWith('00')) {
                                td.textContent = Math.trunc(numValue).toString();
                            } else {
                                td.textContent = stringValue.replace(/\.?0+$/, '');
                            }
                        }
                    }
                    td.style.color = '#8e44ad';
                    td.style.fontWeight = 'bold';
                } else {
                    td.textContent = '-';
                    td.style.color = '#95a5a6';
                    td.style.fontStyle = 'italic';
                }
                
                td.style.cssText = `
                    padding: 6px 4px;
                    border: 1px solid #dee2e6;
                    text-align: center;
                    vertical-align: middle;
                    white-space: nowrap;
                    font-size: 10px;
                `;
                tr.appendChild(td);
            }
            
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
    updateRechargePaginationControls();
}

function setupRechargeTableControls() {
    const firstPageBtn = document.getElementById('recharge-first-page-btn');
    const prevPageBtn = document.getElementById('recharge-prev-page-btn');
    const nextPageBtn = document.getElementById('recharge-next-page-btn');
    const lastPageBtn = document.getElementById('recharge-last-page-btn');
    
    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', () => {
            currentPageRecharge = 1;
            renderRechargeCurrentPage();
        });
    }
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPageRecharge > 1) {
                currentPageRecharge--;
                renderRechargeCurrentPage();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(totalRowsRecharge / rowsPerPage);
            if (currentPageRecharge < totalPages) {
                currentPageRecharge++;
                renderRechargeCurrentPage();
            }
        });
    }
    
    if (lastPageBtn) {
        lastPageBtn.addEventListener('click', () => {
            currentPageRecharge = Math.ceil(totalRowsRecharge / rowsPerPage);
            renderRechargeCurrentPage();
        });
    }
}

function updateRechargePaginationControls() {
    const totalPages = Math.ceil(totalRowsRecharge / rowsPerPage);
    
    const pageInfo = document.querySelector('#recharge-controls-div span:nth-child(2)');
    if (pageInfo) {
        pageInfo.innerHTML = `Page <strong>${currentPageRecharge}</strong> sur <strong>${totalPages}</strong>`;
    }
    
    const linesInfo = document.querySelector('#recharge-controls-div > div:first-child span');
    if (linesInfo) {
        linesInfo.innerHTML = `
            Affichage: <strong>${((currentPageRecharge - 1) * rowsPerPage + 1).toLocaleString()}</strong>
            à <strong>${Math.min(currentPageRecharge * rowsPerPage, totalRowsRecharge).toLocaleString()}</strong>
            sur <strong>${totalRowsRecharge.toLocaleString()}</strong> lignes
        `;
    }
    
    const firstPageBtn = document.getElementById('recharge-first-page-btn');
    const prevPageBtn = document.getElementById('recharge-prev-page-btn');
    const nextPageBtn = document.getElementById('recharge-next-page-btn');
    const lastPageBtn = document.getElementById('recharge-last-page-btn');
    
    if (firstPageBtn) firstPageBtn.disabled = currentPageRecharge === 1;
    if (prevPageBtn) prevPageBtn.disabled = currentPageRecharge === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPageRecharge === totalPages;
    if (lastPageBtn) lastPageBtn.disabled = currentPageRecharge === totalPages;
}

// ==================== PARSING ET COMBINAISON DES DONNÉES ====================

function parseAndCombineData() {
    parseAndCombineEnergyData();
    parseAndCombineTensionData();
    parseAndCombineEventData();
    parseAndCombineSoldeData();
    parseAndCombineRechargeData();
}

function parseAndCombineEnergyData() {
    const dataMap = new Map();
    
    console.log(`📊 Analyse de ${energyData.length} fichiers ENERGIE...`);
    energyData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 8) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) {
                        dataMap.set(timestamp, {
                            'Date et Heure': timestamp,
                            'Energie1': '', 'Energie2': '', 'Energie3': '', 
                            'Energie4': '', 'Energie5': '', 'Energie6': ''
                        });
                    }
                    
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
    
    combinedEnergyData = Array.from(dataMap.values())
        .filter(row => row['Date et Heure'])
        .sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
    
    // Initialiser les données filtrées
    filteredEnergyData = combinedEnergyData;
    
    console.log(`✅ ${combinedEnergyData.length.toLocaleString()} lignes ENERGIE combinées`);
}

function parseAndCombineTensionData() {
    const dataMap = new Map();
    
    console.log(`📊 Analyse de ${tensionData.length} fichiers TENSION...`);
    tensionData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 5) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) {
                        dataMap.set(timestamp, {
                            'Date et Heure': timestamp,
                            'T_min': '', 'T_moy': '', 'T_max': ''
                        });
                    }
                    
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
        .sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
    
    // Initialiser les données filtrées
    filteredTensionData = combinedTensionData;
    
    console.log(`✅ ${combinedTensionData.length.toLocaleString()} lignes TENSION combinées`);
}

function parseAndCombineEventData() {
    const dataMap = new Map();
    
    console.log(`⚠️ Analyse de ${eventData.length} fichiers ÉVÉNEMENTS...`);
    eventData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 6) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) {
                        dataMap.set(timestamp, {
                            'Date et Heure': timestamp,
                            'Évènements': '',
                            'Code 1': '',
                            'Code 2': '',
                            'Code 3': ''
                        });
                    }
                    
                    const row = dataMap.get(timestamp);
                    row['Évènements'] = parts[2] ? parts[2].trim() : '';
                    row['Code 1'] = parts[3] ? parts[3].trim() : '';
                    row['Code 2'] = parts[4] ? parts[4].trim() : '';
                    row['Code 3'] = parts[5] ? parts[5].trim() : '';
                }
            }
        });
    });
    
    combinedEventData = Array.from(dataMap.values())
        .filter(row => row['Date et Heure'])
        .sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
    
    console.log(`✅ ${combinedEventData.length.toLocaleString()} lignes ÉVÉNEMENT combinées`);
}

function parseAndCombineSoldeData() {
    const dataMap = new Map();
    
    console.log(`💰 Analyse de ${soldeData.length} fichiers SOLDE...`);
    soldeData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 8) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) {
                        dataMap.set(timestamp, {
                            'Date et Heure': timestamp,
                            'Credit1': '', 'Credit2': '', 'Credit3': '', 'Credit4': '', 'Credit5': '', 'Credit6': ''
                        });
                    }
                    
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
    
    combinedSoldeData = Array.from(dataMap.values())
        .filter(row => row['Date et Heure'])
        .sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
    
    console.log(`✅ ${combinedSoldeData.length.toLocaleString()} lignes SOLDE combinées`);
}

function parseAndCombineRechargeData() {
    const dataMap = new Map();
    
    console.log(`⚡ Analyse de ${rechargeData.length} fichiers RECHARGE...`);
    rechargeData.forEach(file => {
        file.lines.forEach(line => {
            const parts = line.split(';');
            if (parts.length >= 10) {
                const timestamp = parts[1] ? parts[1].trim() : '';
                if (timestamp && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
                    if (!dataMap.has(timestamp)) {
                        dataMap.set(timestamp, {
                            'Date et Heure': timestamp,
                            'Code enregistrer': '',
                            'Type de code': '',
                            'Status': '',
                            'Code 1': '', 'Code 2': '', 'Code 3': '', 'Code 4': ''
                        });
                    }
                    
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
    
    combinedRechargeData = Array.from(dataMap.values())
        .filter(row => row['Date et Heure'])
        .sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
    
    console.log(`✅ ${combinedRechargeData.length.toLocaleString()} lignes RECHARGE combinées`);
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
            if (filename.toLowerCase().includes('energie')) {
                storeEnergyFile(filename, fullPath, result.content);
            } else if (filename.toLowerCase().includes('tens')) {
                storeTensionFile(filename, fullPath, result.content);
            } else if (filename.toLowerCase().includes('event')) {
                storeEventFile(filename, fullPath, result.content);
            } else if (filename.toLowerCase().includes('solde')) {
                storeSoldeFile(filename, fullPath, result.content);
            } else if (filename.toLowerCase().includes('recharge')) {
                storeRechargeFile(filename, fullPath, result.content);
            }
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
    
    energyData.push({
        filename: filename,
        path: fullPath,
        folder: folderPath || 'Racine',
        content: content,
        lines: lines,
        type: 'ENERGIE'
    });
    
    console.log(`✅ Fichier ENERGIE analysé: ${filename} (${lines.length} lignes valides)`);
    
    if (lines.length > 0) {
        updateCombinedTables();
    }
}

function storeTensionFile(filename, fullPath, content) {
    const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const lines = parseCSVContent(content, 'TENSION');
    
    tensionData.push({
        filename: filename,
        path: fullPath,
        folder: folderPath || 'Racine',
        content: content,
        lines: lines,
        type: 'TENSION'
    });
    
    console.log(`✅ Fichier TENSION analysé: ${filename} (${lines.length} lignes valides)`);
    
    if (lines.length > 0) {
        updateCombinedTables();
    }
}

function storeEventFile(filename, fullPath, content) {
    const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const lines = parseCSVContent(content, 'EVENT');
    
    eventData.push({
        filename: filename,
        path: fullPath,
        folder: folderPath || 'Racine',
        content: content,
        lines: lines,
        type: 'EVENT'
    });
    
    console.log(`⚠️ Fichier ÉVÉNEMENT analysé: ${filename} (${lines.length} lignes valides)`);
    
    if (lines.length > 0) {
        updateCombinedTables();
    }
}

function storeSoldeFile(filename, fullPath, content) {
    const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const lines = parseCSVContent(content, 'SOLDE');
    
    soldeData.push({
        filename: filename,
        path: fullPath,
        folder: folderPath || 'Racine',
        content: content,
        lines: lines,
        type: 'SOLDE'
    });
    
    console.log(`💰 Fichier SOLDE analysé: ${filename} (${lines.length} lignes valides)`);
    
    if (lines.length > 0) {
        updateCombinedTables();
    }
}

function storeRechargeFile(filename, fullPath, content) {
    const folderPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const lines = parseCSVContent(content, 'RECHARGE');
    
    rechargeData.push({
        filename: filename,
        path: fullPath,
        folder: folderPath || 'Racine',
        content: content,
        lines: lines,
        type: 'RECHARGE'
    });
    
    console.log(`⚡ Fichier RECHARGE analysé: ${filename} (${lines.length} lignes valides)`);
    
    if (lines.length > 0) {
        updateCombinedTables();
    }
}

// ==================== FONCTION D'ANALYSE D'ÉVÉNEMENTS PAR JOUR ====================
function analyzeEventsByDay() {
    if (combinedEventData.length === 0) {
        return [];
    }

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
                date: date,
                eventsByClient: {}, // Regrouper par client
                eventsByType: {}, // Événements groupés par type
                allEvents: [] // Tous les événements pour cette journée
            };
        }
        
        const day = eventsByDay[date];
        
        // Stocker l'événement complet
        day.allEvents.push({
            time: time,
            event: event,
            code1: row['Code 1'] || '',
            code2: row['Code 2'] || '',
            code3: row['Code 3'] || '',
            rawEvent: row['Évènements'] || ''
        });
        
        // Identifier le type d'événement
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
        
        // Extraire le numéro client (pour SuspendP et SuspendE)
        let clientNumber = '';
        if (eventType === 'SuspendP' || eventType === 'SuspendE') {
            clientNumber = row['Code 1'] || '';
            if (clientNumber && /^\d+$/.test(clientNumber.trim())) {
                clientNumber = clientNumber.trim();
            } else {
                clientNumber = 'N/A';
            }
        } else {
            clientNumber = 'Système'; // Pour les autres types d'événements
        }
        
        // Créer une clé unique client + type
        const clientTypeKey = `${clientNumber}_${eventType}`;
        
        // Initialiser les structures si elles n'existent pas
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
        
        // Ajouter l'événement au client spécifique
        const clientEventInfo = day.eventsByClient[clientNumber].eventsByType[eventType];
        clientEventInfo.count++;
        clientEventInfo.events.push({
            time: time,
            event: event
        });
        
        // Mettre à jour les heures de début/fin pour ce client
        if (!clientEventInfo.startTime || time < clientEventInfo.startTime) {
            clientEventInfo.startTime = time;
        }
        if (!clientEventInfo.endTime || time > clientEventInfo.endTime) {
            clientEventInfo.endTime = time;
        }
        
        // Ajouter l'événement au type global
        const typeEventInfo = day.eventsByType[eventType];
        typeEventInfo.count++;
        if (clientNumber !== 'Système' && clientNumber !== 'N/A') {
            typeEventInfo.clients.add(clientNumber);
        }
        typeEventInfo.events.push({
            time: time,
            event: event,
            client: clientNumber
        });
        
        // Mettre à jour les heures de début/fin pour ce type
        if (!typeEventInfo.startTime || time < typeEventInfo.startTime) {
            typeEventInfo.startTime = time;
        }
        if (!typeEventInfo.endTime || time > typeEventInfo.endTime) {
            typeEventInfo.endTime = time;
        }
    });

    // Convertir en format plat pour l'affichage dans le tableau
    const result = [];
    
    Object.keys(eventsByDay).sort().forEach(date => {
        const day = eventsByDay[date];
        const clients = Object.keys(day.eventsByClient).sort();
        
        // Pour chaque client, créer une ligne (SAUF les lignes TOTAL)
        clients.forEach(clientNumber => {
            // SAUTER la création de ligne TOTAL
            if (clientNumber === 'TOTAL') return;
            
            const clientData = day.eventsByClient[clientNumber];
            
            // Créer un objet pour chaque ligne client
            const row = {
                date: date,
                client: clientNumber,
                // Initialiser toutes les colonnes
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
            
            // Remplir les données pour chaque type d'événement pour ce client
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
        
        // SUPPRIMÉ: Ne pas ajouter de ligne TOTAL
        // Ancien code pour ajouter la ligne TOTAL a été supprimé
    });

    return result;
}

function calculateDuration(startTime, endTime) {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    // Si l'heure de fin est avant l'heure de début, c'est que l'événement passe minuit
    if (end < start) {
        end.setDate(end.getDate() + 1);
    }
    
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
        return `${diffHours}h${diffMinutes.toString().padStart(2, '0')}`;
    } else {
        return `${diffMinutes}min`;
    }
}

// ==================== FONCTIONS POUR L'ONGLET ÉVÉNEMENTS ====================

function displayEventAnalysis() {
    const evenementContent = document.getElementById('main-tab-content-evenement');
    if (!evenementContent) return;
    
    // Nettoyer l'onglet avant d'afficher
    evenementContent.innerHTML = '';
    
    const eventGrid = document.createElement('div');
    eventGrid.style.cssText = `display: flex; flex-direction: column; gap: 30px; padding: 20px;`;
    
    // 1. Carte de synthèse des événements
    if (combinedEventData.length > 0) {
        const summaryCard = createEventSummaryCard();
        eventGrid.appendChild(summaryCard);
    }
    
    // 2. Tableau journalier des événements (avec heures)
    if (combinedEventData.length > 0) {
        displayDailyEventsTableInEventTab(eventGrid);
    }
    
    // 3. Tableau détaillé des événements
    const existingTableContent = document.getElementById('combined-event-table-content');
    if (existingTableContent) {
        // Cloner le contenu du tableau
        const eventTableContainer = existingTableContent.cloneNode(true);
        eventTableContainer.style.cssText = '';
        eventGrid.appendChild(eventTableContainer);
    }
    
    evenementContent.appendChild(eventGrid);
    
    // Note: Les graphiques d'occurrences et de durée ont été supprimés comme demandé
    console.log('✅ Onglet ÉVÉNEMENTS affiché sans les graphiques d\'occurrences et de durée');
}

function createEventSummaryCard() {
    const dailyEvents = analyzeEventsByDay();
    const totals = dailyEvents.reduce((acc, day) => {
        acc.SuspendP += day.SuspendP;
        acc.SuspendE += day.SuspendE;
        acc.Surcharge += day.Surcharge;
        acc.DelestagePartiel += day.DelestagePartiel;
        acc.DelestageTotal += day.DelestageTotal;
        acc.Total += day.Total;
        return acc;
    }, { SuspendP: 0, SuspendE: 0, Surcharge: 0, DelestagePartiel: 0, DelestageTotal: 0, Total: 0 });
    
    // Collecter tous les clients uniques
    const allSuspendPClients = new Set();
    const allSuspendEClients = new Set();
    
    dailyEvents.forEach(day => {
        if (day.SuspendP_clients_str && day.SuspendP_clients_str !== '-') {
            day.SuspendP_clients_str.split(', ').forEach(client => {
                if (client.trim()) allSuspendPClients.add(client.trim());
            });
        }
        if (day.SuspendE_clients_str && day.SuspendE_clients_str !== '-') {
            day.SuspendE_clients_str.split(', ').forEach(client => {
                if (client.trim()) allSuspendEClients.add(client.trim());
            });
        }
    });
    
    const card = document.createElement('div');
    card.style.cssText = `
        background: linear-gradient(135deg, #f39c12 0%, #d35400 100%);
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    `;
    
    const cardHeader = document.createElement('div');
    cardHeader.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        color: white;
        padding: 15px 25px;
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
        backdrop-filter: blur(10px);
    `;
    cardHeader.innerHTML = `⚠️ SYNTHÈSE DES ÉVÉNEMENTS`;
    
    const cardContent = document.createElement('div');
    cardContent.style.cssText = `
        padding: 20px 25px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 15px;
        background: white;
    `;
    
    const createStatItem = (icon, label, value, color, bgColor, subText = '') => {
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 15px;
            background: ${bgColor};
            border-radius: 8px;
            border-left: 4px solid ${color};
            transition: transform 0.2s ease;
        `;
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div style="font-size: 20px;">${icon}</div>
                <div style="font-size: 14px; color: #2c3e50; font-weight: 600;">${label}</div>
            </div>
            <div style="font-size: 24px; color: ${color}; font-weight: bold; margin-bottom: 4px;">
                ${value}
            </div>
            ${subText ? `<div style="font-size: 11px; color: #64748b;">${subText}</div>` : ''}
        `;
        
        return item;
    };

    // Utilisez avec les clients
    cardContent.appendChild(createStatItem('⏸️', 'SuspendP', totals.SuspendP, '#7c3aed', '#f5f3ff', 
        `${allSuspendPClients.size} client${allSuspendPClients.size !== 1 ? 's' : ''}: ${Array.from(allSuspendPClients).join(', ')}`));
    
    cardContent.appendChild(createStatItem('⏸️', 'SuspendE', totals.SuspendE, '#0ea5e9', '#f0f9ff',
        `${allSuspendEClients.size} client${allSuspendEClients.size !== 1 ? 's' : ''}: ${Array.from(allSuspendEClients).join(', ')}`));
    
    cardContent.appendChild(createStatItem('⚡', 'Surcharge', totals.Surcharge, '#dc2626', '#fef2f2'));
    cardContent.appendChild(createStatItem('🔌', 'Delestage Partiel', totals.DelestagePartiel, '#ea580c', '#fff7ed'));
    cardContent.appendChild(createStatItem('🔋', 'Delestage Total', totals.DelestageTotal, '#991b1b', '#fef2f2'));
    cardContent.appendChild(createStatItem('▶️', 'Démarrage', totals.Démarrage || 0, '#059669', '#d1fae5'));
    cardContent.appendChild(createStatItem('📊', 'Total Événements', totals.Total, '#16a34a', '#f0fdf4'));
    
    card.appendChild(cardHeader);
    card.appendChild(cardContent);
    
    return card;
}

function displayDailyEventsTableInEventTab(eventGrid) {
    const dailyEvents = analyzeEventsByDay();
    
    if (dailyEvents.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.cssText = `
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        `;
        emptyMessage.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
            <h3 style="margin: 0 0 10px 0; color: #1e293b;">Aucun événement trouvé</h3>
            <p style="color: #64748b; margin: 0;">Aucun événement n'a été détecté dans les données analysées.</p>
        `;
        eventGrid.appendChild(emptyMessage);
        return;
    }
    
    // 1. Ajouter les statistiques
    const statsSection = addEventStatisticsSummary(dailyEvents);
    eventGrid.appendChild(statsSection);
    
    // 3. Ajouter le résumé par type
    const typeSummarySection = addEventTypeSummary(dailyEvents);
    eventGrid.appendChild(typeSummarySection);
    
    // 5. Ajouter le tableau principal
    const tableContainer = document.createElement('div');
    tableContainer.id = 'daily-events-table-container';
    tableContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #d35400 0%, #a04000 100%);
        color: white;
        padding: 15px 25px;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    header.innerHTML = `📊 Tableau Détaillé des Événements`;
    tableContainer.appendChild(header);
    
    const content = document.createElement('div');
    content.style.cssText = `padding: 20px;`;
    
    const mainTableWrapper = createMainEventsTable(dailyEvents);
    content.appendChild(mainTableWrapper);
    
    tableContainer.appendChild(content);
    eventGrid.appendChild(tableContainer);
}
function createDetailedEventTable(dailyEvents, eventType) {
    if (!dailyEvents || !Array.isArray(dailyEvents)) {
        console.error('dailyEvents is not defined or not an array');
        return null;
    }
    
    const eventTypeConfig = {
        'suspendp': { 
            label: 'SuspendP', 
            color: '#7c3aed',
            bgColor: '#f5f3ff',
            icon: '⏸️'
        },
        'suspende': { 
            label: 'SuspendE', 
            color: '#0ea5e9',
            bgColor: '#f0f9ff',
            icon: '⏸️'
        },
        'surcharge': { 
            label: 'Surcharge', 
            color: '#dc2626',
            bgColor: '#fef2f2',
            icon: '⚡'
        },
        'delestagepartiel': { 
            label: 'DelestagePartiel', 
            color: '#ea580c',
            bgColor: '#fff7ed',
            icon: '🔌'
        },
        'delestagetotal': { 
            label: 'DelestageTotal', 
            color: '#991b1b',
            bgColor: '#fef2f2',
            icon: '🔋'
        }
    };
    
    const config = eventTypeConfig[eventType];
    if (!config) {
        console.error(`Invalid event type: ${eventType}`);
        return null;
    }
    
    // Filtrer les jours qui ont des événements de ce type
    // IMPORTANT: dailyEvents est maintenant un tableau d'objets où chaque élément a une propriété client
    // On doit d'abord regrouper par date
    const eventsByDate = {};
    
    dailyEvents.forEach(row => {
        if (!row.date) return;
        
        const date = row.date;
        if (!eventsByDate[date]) {
            eventsByDate[date] = {
                date: date,
                [config.label]: 0,
                [`${config.label}_start`]: '-',
                [`${config.label}_end`]: '-',
                [`${config.label}_duration`]: '-',
                clients: new Set(),
                clientEvents: {} // Événements par client pour cette date
            };
        }
        
        // Vérifier si cet événement est du type recherché
        const eventCount = row[config.label] || 0;
        if (eventCount > 0) {
            eventsByDate[date][config.label] += eventCount;
            
            // Ajouter le client à la liste
            if (row.client && row.client !== 'TOTAL' && row.client !== 'Système' && row.client !== 'N/A') {
                eventsByDate[date].clients.add(row.client);
                
                // Stocker les informations spécifiques à ce client
                if (!eventsByDate[date].clientEvents[row.client]) {
                    eventsByDate[date].clientEvents[row.client] = {
                        count: eventCount,
                        start: row[`${config.label}_start`] || '-',
                        end: row[`${config.label}_end`] || '-',
                        duration: row[`${config.label}_duration`] || '-'
                    };
                }
            }
            
            // Mettre à jour les heures de début/fin pour cette date
            if (row[`${config.label}_start`] !== '-') {
                if (eventsByDate[date][`${config.label}_start`] === '-' || 
                    row[`${config.label}_start`] < eventsByDate[date][`${config.label}_start`]) {
                    eventsByDate[date][`${config.label}_start`] = row[`${config.label}_start`];
                }
            }
            
            if (row[`${config.label}_end`] !== '-') {
                if (eventsByDate[date][`${config.label}_end`] === '-' || 
                    row[`${config.label}_end`] > eventsByDate[date][`${config.label}_end`]) {
                    eventsByDate[date][`${config.label}_end`] = row[`${config.label}_end`];
                }
            }
        }
    });
    
    // Calculer la durée pour chaque date
    Object.values(eventsByDate).forEach(day => {
        if (day[`${config.label}_start`] !== '-' && day[`${config.label}_end`] !== '-') {
            day[`${config.label}_duration`] = calculateDuration(day[`${config.label}_start`], day[`${config.label}_end`]);
        }
    });
    
    const filteredDays = Object.values(eventsByDate).filter(day => day[config.label] > 0);
    
    const tableWrapper = document.createElement('div');
    tableWrapper.id = `${eventType}-table`;
    tableWrapper.className = 'detail-event-table';
    
    let tableHTML = `
        <div style="margin-bottom: 20px; padding: 15px; background: ${config.bgColor}; border-radius: 8px; border-left: 4px solid ${config.color};">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span style="font-size: 20px;">${config.icon}</span>
                <h3 style="margin: 0; color: ${config.color}; font-size: 16px;">Événements ${config.label}</h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px;">
                <div style="background: white; padding: 10px; border-radius: 6px;">
                    <div style="font-size: 11px; color: #64748b;">Jours avec événements</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${config.color};">${filteredDays.length}</div>
                </div>
                <div style="background: white; padding: 10px; border-radius: 6px;">
                    <div style="font-size: 11px; color: #64748b;">Total événements</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${config.color};">${filteredDays.reduce((sum, day) => sum + day[config.label], 0)}</div>
                </div>
                <div style="background: white; padding: 10px; border-radius: 6px;">
                    <div style="font-size: 11px; color: #64748b;">Clients concernés</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${config.color};">${new Set(filteredDays.flatMap(day => Array.from(day.clients))).size}</div>
                </div>
                <div style="background: white; padding: 10px; border-radius: 6px;">
                    <div style="font-size: 11px; color: #64748b;">Moyenne/jour</div>
                    <div style="font-size: 18px; font-weight: 700; color: ${config.color};">${filteredDays.length > 0 ? (filteredDays.reduce((sum, day) => sum + day[config.label], 0) / filteredDays.length).toFixed(1) : '0'}</div>
                </div>
            </div>
        </div>
    `;
    
    if (filteredDays.length > 0) {
        tableHTML += `
            <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead style="background: ${config.bgColor};">
                        <tr>
                            <th style="padding: 12px 8px; text-align: left; color: ${config.color}; font-weight: 600; border-bottom: 2px solid ${config.color};">
                                Date
                            </th>
                            <th style="padding: 12px 8px; text-align: center; color: ${config.color}; font-weight: 600; border-bottom: 2px solid ${config.color};">
                                Heure Début
                            </th>
                            <th style="padding: 12px 8px; text-align: center; color: ${config.color}; font-weight: 600; border-bottom: 2px solid ${config.color};">
                                Heure Fin
                            </th>
                            <th style="padding: 12px 8px; text-align: center; color: ${config.color}; font-weight: 600; border-bottom: 2px solid ${config.color};">
                                Durée
                            </th>
                            <th style="padding: 12px 8px; text-align: center; color: ${config.color}; font-weight: 600; border-bottom: 2px solid ${config.color};">
                                Nombre
                            </th>
                            <th style="padding: 12px 8px; text-align: center; color: ${config.color}; font-weight: 600; border-bottom: 2px solid ${config.color};">
                                Clients
                            </th>
                            <th style="padding: 12px 8px; text-align: center; color: ${config.color}; font-weight: 600; border-bottom: 2px solid ${config.color};">
                                Détails Clients
                            </th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Trier les dates
        const sortedDays = filteredDays.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        sortedDays.forEach((day, index) => {
            const dateObj = new Date(day.date);
            const formattedDate = dateObj.toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            const clientsList = Array.from(day.clients).sort((a, b) => parseInt(a) - parseInt(b));
            
            // Créer le détail des clients
            let clientsDetails = '';
            if (Object.keys(day.clientEvents).length > 0) {
                clientsDetails = Object.entries(day.clientEvents)
                    .sort(([clientA], [clientB]) => parseInt(clientA) - parseInt(clientB))
                    .map(([client, info]) => 
                        `Client ${client}: ${info.count} fois (${info.start} à ${info.end}, durée: ${info.duration})`
                    )
                    .join('<br>');
            }
            
            tableHTML += `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${index % 2 === 0 ? '#fafbfc' : 'white'};">
                    <td style="padding: 10px 8px; text-align: left; color: #1e293b; font-weight: 500;">
                        ${formattedDate}<br>
                        <small style="color: #64748b;">${day.date}</small>
                    </td>
                    <td style="padding: 10px 8px; text-align: center; color: ${config.color}; font-weight: 600;">
                        ${day[`${config.label}_start`]}
                    </td>
                    <td style="padding: 10px 8px; text-align: center; color: ${config.color}; font-weight: 600;">
                        ${day[`${config.label}_end`]}
                    </td>
                    <td style="padding: 10px 8px; text-align: center; color: ${config.color}; font-weight: 600;">
                        ${day[`${config.label}_duration`]}
                    </td>
                    <td style="padding: 10px 8px; text-align: center; color: ${config.color}; font-weight: 600;">
                        <span style="background: ${config.bgColor}; color: ${config.color}; padding: 4px 8px; border-radius: 4px; font-weight: 700;">
                            ${day[config.label]}
                        </span>
                    </td>
                    <td style="padding: 10px 8px; text-align: center; color: ${config.color}; font-weight: 600;">
                        ${clientsList.length > 0 ? clientsList.join(', ') : '-'}
                        ${clientsList.length > 0 ? `<br><small style="color: #64748b;">${clientsList.length} client${clientsList.length > 1 ? 's' : ''}</small>` : ''}
                    </td>
                    <td style="padding: 10px 8px; text-align: left; color: ${config.color}; font-size: 10px; max-width: 300px;">
                        ${clientsDetails || '-'}
                    </td>
                </tr>
            `;
        });
        
        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;
    } else {
        tableHTML += `
            <div style="text-align: center; padding: 40px; background: #f8fafc; border-radius: 8px;">
                <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                <div style="font-size: 14px; color: #64748b; font-weight: 600;">Aucun événement ${config.label} détecté</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 5px;">La période analysée ne contient pas d'événements de ce type</div>
            </div>
        `;
    }
    
    tableWrapper.innerHTML = tableHTML;
    return tableWrapper;
}

// Ajouter cette section AVANT le tableau principal
function addEventStatisticsSummary(dailyEvents) {
    const statsDiv = document.createElement('div');
    statsDiv.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        padding: 20px;
    `;
    
    // Calculer les statistiques
    const clientRows = dailyEvents.filter(d => d.client !== 'Système' && d.client !== 'N/A');
    const systemRows = dailyEvents.filter(d => d.client === 'Système' || d.client === 'N/A');
    
    const totalEvents = clientRows.reduce((sum, day) => sum + day.Total, 0);
    const totalClients = new Set(clientRows.map(d => d.client)).size;
    const totalDays = new Set(dailyEvents.map(d => d.date)).size;
    
    // Trouver le jour avec le plus d'événements
    const eventsByDate = {};
    dailyEvents.forEach(day => {
        if (!eventsByDate[day.date]) eventsByDate[day.date] = 0;
        eventsByDate[day.date] += day.Total;
    });
    
    const maxEventsDay = Object.entries(eventsByDate).reduce((max, [date, count]) => 
        count > max.count ? {date, count} : max, {date: '', count: 0});
    
    // Trouver le client avec le plus d'événements
    const eventsByClient = {};
    clientRows.forEach(row => {
        if (!eventsByClient[row.client]) eventsByClient[row.client] = 0;
        eventsByClient[row.client] += row.Total;
    });
    
    const maxEventsClient = Object.entries(eventsByClient).reduce((max, [client, count]) => 
        count > max.count ? {client, count} : max, {client: '', count: 0});
    
    statsDiv.innerHTML = `
        <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px; background: #f39c12; color: white; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">📊</span>
            <div>
                <h3 style="margin: 0; color: #1e293b; font-size: 16px;">Synthèse des Événements</h3>
                <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">Statistiques globales de la période analysée</p>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 15px; border-radius: 8px;">
                <div style="font-size: 11px; margin-bottom: 8px; opacity: 0.9;">Total Événements</div>
                <div style="font-size: 24px; font-weight: 700; margin-bottom: 5px;">${totalEvents}</div>
                <div style="font-size: 11px; opacity: 0.9;">sur ${totalDays} jour${totalDays !== 1 ? 's' : ''}</div>
            </div>
            
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px; border-radius: 8px;">
                <div style="font-size: 11px; margin-bottom: 8px; opacity: 0.9;">Clients Concernés</div>
                <div style="font-size: 24px; font-weight: 700; margin-bottom: 5px;">${totalClients}</div>
                <div style="font-size: 11px; opacity: 0.9;">avec événements</div>
            </div>
            
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 15px; border-radius: 8px;">
                <div style="font-size: 11px; margin-bottom: 8px; opacity: 0.9;">Jour le plus actif</div>
                <div style="font-size: 16px; font-weight: 700; margin-bottom: 5px;">${maxEventsDay.date || 'N/A'}</div>
                <div style="font-size: 11px; opacity: 0.9;">${maxEventsDay.count} événement${maxEventsDay.count !== 1 ? 's' : ''}</div>
            </div>
            
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 15px; border-radius: 8px;">
                <div style="font-size: 11px; margin-bottom: 8px; opacity: 0.9;">Client le plus actif</div>
                <div style="font-size: 16px; font-weight: 700; margin-bottom: 5px;">Client ${maxEventsClient.client || 'N/A'}</div>
                <div style="font-size: 11px; opacity: 0.9;">${maxEventsClient.count} événement${maxEventsClient.count !== 1 ? 's' : ''}</div>
            </div>
        </div>
        
        <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 4px solid #8b5cf6;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 14px;">💡</span>
                <span style="font-size: 12px; font-weight: 600; color: #1e293b;">Conseil d'analyse</span>
            </div>
            <div style="font-size: 11px; color: #475569; line-height: 1.4;">
                ${totalEvents > 0 ? 
                  `Sur ${totalDays} jour${totalDays !== 1 ? 's' : ''}, ${totalClients} client${totalClients !== 1 ? 's' : ''} ont eu des événements. 
                   Moyenne: ${(totalEvents/totalDays).toFixed(1)} événements/jour. 
                   ${maxEventsDay.count > 5 ? '⚠️ Attention: jour avec événements élevés détecté.' : '✅ Activité dans les normes.'}` 
                  : 'Aucun événement détecté durant la période analysée.'}
            </div>
        </div>
    `;
    
    return statsDiv;
}

function addEventTypeSummary(dailyEvents) {
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        padding: 20px;
    `;
    
    // Calculer les totaux par type
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
        
        // Collecter les clients pour ce type
        clientsByType[type.name] = new Set();
        dailyEvents.forEach(row => {
            if (row[type.name] > 0 && row.client !== 'Système' && row.client !== 'N/A') {
                clientsByType[type.name].add(row.client);
            }
        });
    });
    
    const totalEvents = Object.values(totals).reduce((a, b) => a + b, 0);
    
    summaryDiv.innerHTML = `
        <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px; background: #8b5cf6; color: white; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">📈</span>
            <div>
                <h3 style="margin: 0; color: #1e293b; font-size: 16px;">Répartition par Type d'Événement</h3>
                <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">Distribution des événements par catégorie</p>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            <!-- Graphique en camembert -->
            <div>
                <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 10px;">Répartition (%)</div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${eventTypes.map(type => {
                        const count = totals[type.name];
                        const percentage = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
                        const clientCount = clientsByType[type.name] ? clientsByType[type.name].size : 0;
                        
                        return `
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 16px; height: 16px; background: ${type.color}; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px;">
                                    ${type.icon}
                                </div>
                                <div style="flex: 1;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <span style="font-size: 12px; font-weight: 600; color: ${type.color};">${type.label}</span>
                                        <span style="font-size: 12px; font-weight: 700; color: #1e293b;">${count} événement${count !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                                        <div style="width: ${percentage}%; height: 100%; background: ${type.color}; border-radius: 3px;"></div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                                        <span style="font-size: 10px; color: #64748b;">${percentage}%</span>
                                        <span style="font-size: 10px; color: #64748b;">${clientCount} client${clientCount !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <!-- Légende et insights -->
            <div>
                <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 10px;">Analyse et Insights</div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <!-- Trouver le type le plus fréquent -->
                    ${(() => {
                        const mostFrequent = eventTypes.reduce((max, type) => 
                            totals[type.name] > totals[max.name] ? type : eventTypes[0]);
                        
                        return `
                            <div style="padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 4px solid ${mostFrequent.color};">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                    <span style="font-size: 14px;">🏆</span>
                                    <span style="font-size: 11px; font-weight: 600; color: ${mostFrequent.color};">Type le plus fréquent</span>
                                </div>
                                <div style="font-size: 11px; color: #475569;">
                                    <strong>${mostFrequent.label}</strong> représente ${Math.round((totals[mostFrequent.name] / totalEvents) * 100)}% des événements 
                                    (${totals[mostFrequent.name]} sur ${totalEvents})
                                </div>
                            </div>
                        `;
                    })()}
                    
                    <!-- Trouver les clients à problème -->
                    ${(() => {
                        const problematicClients = [];
                        dailyEvents.forEach(row => {
                            if (row.Total >= 3 && row.client !== 'Système' && row.client !== 'N/A') {
                                problematicClients.push({
                                    client: row.client,
                                    count: row.Total,
                                    types: eventTypes.filter(type => row[type.name] > 0).map(type => type.label)
                                });
                            }
                        });
                        
                        if (problematicClients.length > 0) {
                            const sortedClients = problematicClients.sort((a, b) => b.count - a.count).slice(0, 3);
                            
                            return `
                                <div style="padding: 12px; background: #fef2f2; border-radius: 6px; border-left: 4px solid #dc2626;">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                        <span style="font-size: 14px;">⚠️</span>
                                        <span style="font-size: 11px; font-weight: 600; color: #dc2626;">Clients à surveiller</span>
                                    </div>
                                    <div style="font-size: 11px; color: #475569;">
                                        ${sortedClients.map(client => 
                                            `<div style="margin-bottom: 4px;">
                                                • <strong>Client ${client.client}</strong>: ${client.count} événements 
                                                (${client.types.join(', ')})
                                            </div>`
                                        ).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        return '';
                    })()}
                    
                    <!-- Recommandation -->
                    <div style="padding: 12px; background: #f0f9ff; border-radius: 6px; border-left: 4px solid #0ea5e9;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                            <span style="font-size: 14px;">💡</span>
                            <span style="font-size: 11px; font-weight: 600; color: #0ea5e9;">Recommandation</span>
                        </div>
                        <div style="font-size: 11px; color: #475569;">
                            ${totalEvents === 0 ? '✅ Aucun événement détecté - système stable' :
                              totalEvents < 10 ? '✅ Activité normale - surveillance standard recommandée' :
                              totalEvents < 20 ? '⚠️ Activité modérée - surveillance rapprochée recommandée' :
                              '🚨 Activité élevée - investigation technique recommandée'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return summaryDiv;
}
function addSeverityIndicators(dailyEvents) {
    // Analyser la gravité des événements
    const severityAnalysis = {
        critical: 0,    // DelestageTotal, Surcharge multiple
        warning: 0,     // DelestagePartiel, SuspendP/E multiples
        info: 0,        // Événements isolés
        none: 0         // Aucun événement
    };
    
    dailyEvents.forEach(day => {
        // Calculer un score de gravité
        let severityScore = 0;
        
        // Points par type d'événement
        if (day.DelestageTotal > 0) severityScore += 3;
        if (day.Surcharge > 0) severityScore += 2;
        if (day.DelestagePartiel > 0) severityScore += 1;
        if (day.SuspendP > 1 || day.SuspendE > 1) severityScore += 1;
        
        // Classifier
        if (severityScore >= 3) severityAnalysis.critical++;
        else if (severityScore >= 1) severityAnalysis.warning++;
        else if (day.Total > 0) severityAnalysis.info++;
        else severityAnalysis.none++;
    });
    
    const severityDiv = document.createElement('div');
    severityDiv.style.cssText = `
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        padding: 20px;
    `;
    
    const totalDays = dailyEvents.length;
    
    return severityDiv;
}
function createMainEventsTable(dailyEvents) {
    const tableWrapper = document.createElement('div');
    tableWrapper.id = 'main-events-table';
    
    // Configuration des types d'événements
    const eventTypes = [
        { 
            name: 'SuspendP', 
            label: 'SuspendP',
            color: '#7c3aed', // Violet
            bgColor: '#f5f3ff',
            lightBg: 'rgba(124, 58, 237, 0.05)',
            icon: '⏸️',
            description: 'Suspension Puissance',
            hasClientColumn: true
        },
        { 
            name: 'SuspendE', 
            label: 'SuspendE',
            color: '#0ea5e9', // Bleu ciel
            bgColor: '#f0f9ff',
            lightBg: 'rgba(14, 165, 233, 0.05)',
            icon: '⏸️',
            description: 'Suspension Énergétique',
            hasClientColumn: true
        },
        { 
            name: 'Surcharge', 
            label: 'Surcharge',
            color: '#dc2626', // Rouge foncé
            bgColor: '#fef2f2',
            lightBg: 'rgba(220, 38, 38, 0.05)',
            icon: '⚡',
            description: 'Surcharge du système',
            hasClientColumn: false
        },
        { 
            name: 'DelestagePartiel', 
            label: 'Délestage Partiel',
            color: '#ea580c', // Orange vif
            bgColor: '#fff7ed',
            lightBg: 'rgba(234, 88, 12, 0.05)',
            icon: '🔌',
            description: 'Délestage partiel',
            hasClientColumn: false
        },
        { 
            name: 'DelestageTotal', 
            label: 'Délestage Total',
            color: '#991b1b', // Rouge bordeaux
            bgColor: '#fef2f2',
            lightBg: 'rgba(153, 27, 27, 0.05)',
            icon: '🔋',
            description: 'Délestage total',
            hasClientColumn: false
        }
    ];
    
    // En-tête du tableau
    let tableHTML = `
        <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead style="background: linear-gradient(135deg, #f39c12 0%, #d35400 100%);">
                    <tr>
                        <th style="padding: 12px 8px; text-align: left; color: white; font-weight: 600; position: sticky; left: 0; background: linear-gradient(135deg, #f39c12 0%, #d35400 100%); z-index: 10; min-width: 160px; border-right: 1px solid rgba(255,255,255,0.2);">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span>📅</span>
                                <span>Date / Client</span>
                            </div>
                        </th>
    `;
    
    // En-têtes pour chaque type d'événement
    eventTypes.forEach(eventType => {
        if (eventType.hasClientColumn) {
            tableHTML += `
                <th colspan="4" style="padding: 12px 8px; text-align: center; color: white; font-weight: 600; border-right: 1px solid rgba(255,255,255,0.2); min-width: 240px;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 14px;">${eventType.icon}</span>
                            <span>${eventType.label}</span>
                        </div>
                        <div style="font-size: 9px; opacity: 0.9; font-weight: normal;">${eventType.description}</div>
                    </div>
                </th>
            `;
        } else {
            tableHTML += `
                <th colspan="3" style="padding: 12px 8px; text-align: center; color: white; font-weight: 600; border-right: 1px solid rgba(255,255,255,0.2); min-width: 180px;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 14px;">${eventType.icon}</span>
                            <span>${eventType.label}</span>
                        </div>
                        <div style="font-size: 9px; opacity: 0.9; font-weight: normal;">${eventType.description}</div>
                    </div>
                </th>
            `;
        }
    });
    
    tableHTML += `
                        <th style="padding: 12px 8px; text-align: center; color: white; font-weight: 600; background: linear-gradient(135deg, #16a34a 0%, #059669 100%); min-width: 80px;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <span>📊</span>
                                <span>Total</span>
                            </div>
                        </th>
                    </tr>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 8px; background: #f8fafc; position: sticky; left: 0; z-index: 9; border-bottom: 1px solid #e2e8f0;"></th>
    `;
    
    // Sous-en-têtes
    eventTypes.forEach(eventType => {
        if (eventType.hasClientColumn) {
            tableHTML += `
                <th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                    Début
                </th>
                <th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                    Fin
                </th>
                <th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                    Durée
                </th>
                <th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                        <span>👤</span>
                        <span>Client(s)</span>
                    </div>
                </th>
            `;
        } else {
            tableHTML += `
                <th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                    Début
                </th>
                <th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                    Fin
                </th>
                <th style="padding: 8px; text-align: center; font-size: 10px; color: ${eventType.color}; background: ${eventType.bgColor}; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                    Durée
                </th>
            `;
        }
    });
    
    tableHTML += `
                        <th style="padding: 8px; text-align: center; font-size: 10px; color: #16a34a; background: #f0fdf4; font-weight: 600; border-bottom: 1px solid #e2e8f0;">
                            Événements
                        </th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Corps du tableau - SANS lignes TOTAL
    let rowIndex = 0;
    let currentDate = '';
    let dateGroupIndex = 0;
    
    dailyEvents.forEach((day, index) => {
        const dateObj = new Date(day.date);
        const formattedDate = dateObj.toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        
        // Déterminer si c'est une nouvelle date
        const isNewDate = day.date !== currentDate;
        if (isNewDate) {
            currentDate = day.date;
            dateGroupIndex++;
        }
        
        // Déterminer le type de ligne
        const isSystemRow = day.client === 'Système' || day.client === 'N/A';
        const isClientRow = !isSystemRow;
        
        // Déterminer la couleur de fond de la ligne
        let rowBgColor, rowBorderColor, rowTextColor;
        
        if (isSystemRow) {
            // Événements système
            rowBgColor = '#f8fafc';
            rowBorderColor = '#e2e8f0';
            rowTextColor = '#475569';
        } else if (isClientRow) {
            // Client spécifique - alterner les couleurs par groupe de date
            if (dateGroupIndex % 2 === 0) {
                rowBgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
            } else {
                rowBgColor = rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
            }
            rowBorderColor = '#e2e8f0';
            rowTextColor = '#1e293b';
        }
        
        // Ligne du tableau
        tableHTML += `
            <tr style="border-bottom: 1px solid ${rowBorderColor}; background: ${rowBgColor};">
                <!-- Colonne Date/Client -->
                <td style="padding: 12px 8px; text-align: left; color: ${rowTextColor}; font-weight: 500; white-space: nowrap; position: sticky; left: 0; background: ${rowBgColor}; z-index: 8; border-right: 1px solid ${rowBorderColor};">
        `;
        
        // Contenu de la colonne Date/Client
        if (isNewDate) {
            // Nouvelle date - afficher la date complète
            tableHTML += `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 14px;">📅</span>
                        <span style="font-weight: 600; font-size: 11px;">${formattedDate}</span>
                    </div>
                    <div style="font-size: 10px; color: #64748b; background: #f8fafc; padding: 2px 6px; border-radius: 3px; display: inline-block; width: fit-content;">
                        ${day.date}
                    </div>
                    ${isClientRow ? `
                        <div style="display: flex; align-items: center; gap: 4px; margin-top: 4px;">
                            <span style="font-size: 12px;">👤</span>
                            <span style="font-size: 11px; color: #3b82f6; font-weight: 600;">Client ${day.client}</span>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            // Même date - afficher seulement le client
            if (isClientRow) {
                tableHTML += `
                    <div style="display: flex; align-items: center; gap: 6px; padding-left: 8px;">
                        <span style="font-size: 12px;">👤</span>
                        <span style="font-size: 11px; color: #3b82f6; font-weight: 600;">Client ${day.client}</span>
                    </div>
                `;
            } else if (isSystemRow) {
                tableHTML += `
                    <div style="display: flex; align-items: center; gap: 6px; padding-left: 8px;">
                        <span style="font-size: 12px;">⚙️</span>
                        <span style="font-size: 11px; color: #64748b; font-weight: 500;">${day.client}</span>
                    </div>
                `;
            }
        }
        
        tableHTML += `</td>`;
        
        // Colonnes pour chaque type d'événement
        eventTypes.forEach(eventType => {
            const startTime = day[`${eventType.name}_start`] || '-';
            const endTime = day[`${eventType.name}_end`] || '-';
            const duration = day[`${eventType.name}_duration`] || '-';
            const count = day[eventType.name] || 0;
            const clients = eventType.hasClientColumn ? 
                (day[`${eventType.name}_clients_str`] || '-') : 
                '-';
            
            // Déterminer si l'événement a eu lieu pour cette ligne
            const hasEvent = count > 0;
            const hasClients = clients !== '-' && clients !== '' && clients !== 'Système' && clients !== 'N/A';
            
            // Style pour les cellules selon le type de ligne
            let cellStyle;
            
            if (hasEvent) {
                cellStyle = `
                    font-weight: 600;
                    background: ${eventType.lightBg};
                    color: ${eventType.color};
                    border-left: 2px solid ${eventType.color};
                `;
            } else {
                cellStyle = `
                    color: #94a5a6;
                    font-style: italic;
                    background: transparent;
                `;
            }
            
            // Cellules Début
            tableHTML += `
                <!-- ${eventType.label} - Début -->
                <td style="padding: 10px 8px; text-align: center; vertical-align: middle; ${cellStyle} border-right: 1px solid ${rowBorderColor};">
                    <div style="min-height: 20px; display: flex; align-items: center; justify-content: center;">
                        ${startTime}
                    </div>
                </td>
                <!-- ${eventType.label} - Fin -->
                <td style="padding: 10px 8px; text-align: center; vertical-align: middle; ${cellStyle} border-right: 1px solid ${rowBorderColor};">
                    <div style="min-height: 20px; display: flex; align-items: center; justify-content: center;">
                        ${endTime}
                    </div>
                </td>
                <!-- ${eventType.label} - Durée -->
                <td style="padding: 10px 8px; text-align: center; vertical-align: middle; ${cellStyle} border-right: 1px solid ${rowBorderColor};">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
                        <div style="min-height: 20px; display: flex; align-items: center; justify-content: center;">
                            ${duration}
                        </div>
                        ${hasEvent && duration !== '-' ? `
                            <div style="font-size: 9px; padding: 1px 5px; background: ${eventType.bgColor}; color: ${eventType.color}; border-radius: 3px; font-weight: 500;">
                                ${count} fois
                            </div>
                        ` : ''}
                    </div>
                </td>
            `;
            
            // Colonne Client supplémentaire pour SuspendP et SuspendE
            if (eventType.hasClientColumn) {
                tableHTML += `
                    <!-- ${eventType.label} - Client(s) -->
                    <td style="padding: 10px 8px; text-align: center; vertical-align: middle; ${cellStyle} border-right: 1px solid ${rowBorderColor};">
                        <div style="min-height: 20px; display: flex; align-items: center; justify-content: center;">
                `;
                
                if (hasClients) {
                    // Pour une ligne client spécifique: afficher le numéro client
                    tableHTML += `
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <div style="font-size: 12px; font-weight: 700; color: ${eventType.color};">
                                ${clients}
                            </div>
                            ${count > 0 ? `
                                <div style="font-size: 9px; color: #64748b; background: ${eventType.bgColor}; padding: 1px 6px; border-radius: 3px;">
                                    ${count} événement${count > 1 ? 's' : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                } else {
                    tableHTML += `-`;
                }
                
                tableHTML += `
                        </div>
                    </td>
                `;
            }
        });
        
        // Colonne Total
        const totalColor = day.Total > 0 ? '#16a34a' : '#64748b';
        const totalBgColor = day.Total > 0 ? 'rgba(22, 163, 74, 0.1)' : 'transparent';
        const totalBorderColor = day.Total > 0 ? '#16a34a' : 'transparent';
        
        tableHTML += `
                <!-- Total -->
                <td style="padding: 12px 8px; text-align: center; vertical-align: middle; color: ${totalColor}; font-weight: 600; background: ${totalBgColor}; border-left: 2px solid ${totalBorderColor};">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
                        <div style="font-size: 14px; font-weight: 700;">${day.Total}</div>
                        ${day.Total > 0 ? `
                            <div style="font-size: 9px; padding: 1px 6px; background: ${day.Total >= 5 ? '#fee2e2' : day.Total >= 3 ? '#fef3c7' : '#d1fae5'}; 
                                 color: ${day.Total >= 5 ? '#dc2626' : day.Total >= 3 ? '#d97706' : '#059669'}; 
                                 border-radius: 10px; font-weight: 500;">
                                ${day.Total >= 5 ? 'Élevé' : day.Total >= 3 ? 'Moyen' : 'Faible'}
                            </div>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
        
        rowIndex++;
    });
    
    // Pied de tableau avec résumé global
    if (dailyEvents.length > 0) {
        // Calculer les totaux globaux directement à partir des données clients
        const clientRows = dailyEvents.filter(d => d.client !== 'Système' && d.client !== 'N/A');
        
        const totalEvents = clientRows.reduce((sum, day) => sum + day.Total, 0);
        const totalClients = new Set(clientRows.map(d => d.client)).size;
        const totalDays = new Set(dailyEvents.map(d => d.date)).size;
        
        // Calculer les totaux par type directement
        const totalsByType = {};
        const clientsByType = {};
        
        eventTypes.forEach(eventType => {
            totalsByType[eventType.name] = clientRows.reduce((sum, day) => sum + (day[eventType.name] || 0), 0);
            
            // Collecter les clients par type
            clientsByType[eventType.name] = new Set();
            clientRows.forEach(row => {
                if (row[eventType.name] > 0 && row[`${eventType.name}_clients_str`] && 
                    row[`${eventType.name}_clients_str`] !== '-') {
                    clientsByType[eventType.name].add(row.client);
                }
            });
        });
        
        tableHTML += `
                    <tr style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white;">
                        <td style="padding: 15px 8px; text-align: left; font-weight: 600; position: sticky; left: 0; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); z-index: 8; border-right: 1px solid #334155;">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 16px;">📈</span>
                                    <span>SYNTHÈSE GLOBALE</span>
                                </div>
                                <div style="font-size: 10px; color: rgba(255,255,255,0.8);">
                                    ${totalDays} jour${totalDays !== 1 ? 's' : ''} analysé${totalDays !== 1 ? 's' : ''}
                                </div>
                            </div>
                        </td>
        `;
        
        // Colonnes pour chaque type d'événement dans le résumé
        eventTypes.forEach(eventType => {
            const totalForType = totalsByType[eventType.name] || 0;
            const clientsForType = clientsByType[eventType.name] ? clientsByType[eventType.name].size : 0;
            const percentage = totalEvents > 0 ? Math.round((totalForType / totalEvents) * 100) : 0;
            
            if (eventType.hasClientColumn) {
                tableHTML += `
                    <td colspan="4" style="padding: 15px 8px; text-align: center; vertical-align: middle; background: rgba(255,255,255,0.1); border-left: 2px solid ${eventType.color};">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 16px;">${eventType.icon}</span>
                                <span style="font-weight: 700; font-size: 14px;">${totalForType}</span>
                            </div>
                            <div style="font-size: 10px; color: rgba(255,255,255,0.9);">
                                ${clientsForType} client${clientsForType !== 1 ? 's' : ''}
                            </div>
                            ${percentage > 0 ? `
                                <div style="width: 100%; max-width: 100px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;">
                                    <div style="width: ${percentage}%; height: 100%; background: ${eventType.color}; border-radius: 2px;"></div>
                                </div>
                                <div style="font-size: 9px; color: rgba(255,255,255,0.8);">${percentage}% du total</div>
                            ` : ''}
                        </div>
                    </td>
                `;
            } else {
                tableHTML += `
                    <td colspan="3" style="padding: 15px 8px; text-align: center; vertical-align: middle; background: rgba(255,255,255,0.1); border-left: 2px solid ${eventType.color};">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 16px;">${eventType.icon}</span>
                                <span style="font-weight: 700; font-size: 14px;">${totalForType}</span>
                            </div>
                            ${percentage > 0 ? `
                                <div style="width: 100%; max-width: 100px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;">
                                    <div style="width: ${percentage}%; height: 100%; background: ${eventType.color}; border-radius: 2px;"></div>
                                </div>
                                <div style="font-size: 9px; color: rgba(255,255,255,0.8);">${percentage}% du total</div>
                            ` : ''}
                        </div>
                    </td>
                `;
            }
        });
        
        // Colonne Total général
        const avgEventsPerDay = totalDays > 0 ? (totalEvents / totalDays).toFixed(1) : 0;
        const avgEventsPerClient = totalClients > 0 ? (totalEvents / totalClients).toFixed(1) : 0;
        
        tableHTML += `
                        <td style="padding: 15px 8px; text-align: center; vertical-align: middle; background: rgba(34, 197, 94, 0.3); border-left: 2px solid #22c55e;">
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 18px;">📊</span>
                                    <span style="font-weight: 800; font-size: 16px;">${totalEvents}</span>
                                </div>
                                <div style="font-size: 10px; color: rgba(255,255,255,0.9);">
                                    ${totalClients} client${totalClients !== 1 ? 's' : ''}
                                </div>
                                <div style="font-size: 9px; color: rgba(255,255,255,0.8);">
                                    ${avgEventsPerDay}/jour • ${avgEventsPerClient}/client
                                </div>
                            </div>
                        </td>
                    </tr>
        `;
    }
    
    tableHTML += `
                </tbody>
            </table>
        </div>
        
        <!-- Légende des couleurs -->
        <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
                <span style="font-size: 16px; background: #f39c12; color: white; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">🎨</span>
                <div>
                    <div style="font-size: 12px; font-weight: 600; color: #1e293b;">Légende du tableau</div>
                    <div style="font-size: 10px; color: #64748b;">Types de lignes et signification</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #f8fafc; border-radius: 6px; border-left: 4px solid #3b82f6;">
                    <div style="width: 24px; height: 24px; background: #3b82f6; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                        👤
                    </div>
                    <div>
                        <div style="font-size: 11px; font-weight: 600; color: #3b82f6;">Ligne Client</div>
                        <div style="font-size: 10px; color: #64748b;">Événements pour un client spécifique</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #f8fafc; border-radius: 6px; border-left: 4px solid #94a3b8;">
                    <div style="width: 24px; height: 24px; background: #94a3b8; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                        ⚙️
                    </div>
                    <div>
                        <div style="font-size: 11px; font-weight: 600; color: #94a3b8;">Ligne Système</div>
                        <div style="font-size: 10px; color: #64748b;">Événements système (pas de client)</div>
                    </div>
                </div>
                ${eventTypes.map(eventType => `
                    <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: ${eventType.bgColor}; border-radius: 6px; border-left: 4px solid ${eventType.color};">
                        <div style="width: 24px; height: 24px; background: ${eventType.color}; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
                            ${eventType.icon}
                        </div>
                        <div>
                            <div style="font-size: 11px; font-weight: 600; color: ${eventType.color};">${eventType.label}</div>
                            <div style="font-size: 10px; color: #64748b;">${eventType.description}</div>
                            ${eventType.hasClientColumn ? `
                                <div style="font-size: 9px; color: ${eventType.color}; font-weight: 500; margin-top: 3px;">
                                    👤 Affiche le client concerné
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    tableWrapper.innerHTML = tableHTML;
    return tableWrapper;
}
// ==================== ANIMATIONS CSS ====================

// Ajouter ces styles dans votre fichier CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);