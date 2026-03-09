// analytics/technicalAnalytics.js
import { database } from '../arduinoCore.js';
import { VOLTAGE_NORMS, HIGH_VOLTAGE_THRESHOLD } from '../arduinoConstants.js';

// ===========================================
// ANALYSE TECHNIQUE PRINCIPALE
// ===========================================

export function analyzeTechnicalData() {
    console.log("🔧 Analyse technique - Début");
    
    const tensionTable = database.tables.find(t => t.type === 'T');
    if (!tensionTable) {
        console.log("❌ Aucune table de tension trouvée");
        return;
    }
    
    // Initialiser la structure de données
    database.technicalData = {
        raw: tensionTable.data,
        dailyStats: {},
        variations: [],
        exceedances: {},
        loadShedding: {
            partiel: 0,
            total: 0,
            parDate: {},
            jours: []
        },
        highVoltage: [],
        conformity: {
            totalJours: 0,
            conformes: 0,
            causes: { min: [], max: [], variation: [] }
        }
    };
    
    // Analyser ligne par ligne
    analyzeTensionData(tensionTable.data);
    analyzeVariations(tensionTable.data);
    analyzeHighVoltage();
    analyzeLoadShedding();
    calculateConformity();
    
    console.log("✅ Analyse technique terminée");
}

// ===========================================
// ANALYSE DES DONNÉES DE TENSION
// ===========================================

function analyzeTensionData(data) {
    const dailyStats = {};
    let globalMin = Infinity;
    let globalMax = -Infinity;
    let sumAvg = 0;
    let countAvg = 0;
    
    data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const tensionMin = parseFloat(cells[3]);
        const tensionMax = parseFloat(cells[4]);
        const tensionAvg = (tensionMin + tensionMax) / 2;
        
        if (!dailyStats[date]) {
            dailyStats[date] = { 
                min: Infinity, 
                max: -Infinity, 
                sumAvg: 0, 
                count: 0,
                values: []
            };
        }
        
        dailyStats[date].min = Math.min(dailyStats[date].min, tensionMin);
        dailyStats[date].max = Math.max(dailyStats[date].max, tensionMax);
        dailyStats[date].sumAvg += tensionAvg;
        dailyStats[date].count++;
        dailyStats[date].values.push({
            time: timestamp.split(' ')[1],
            min: tensionMin,
            max: tensionMax,
            avg: tensionAvg
        });
        
        globalMin = Math.min(globalMin, tensionMin);
        globalMax = Math.max(globalMax, tensionMax);
        sumAvg += tensionAvg;
        countAvg++;
    });
    
    // Compter les clients uniques
    const clientSet = new Set();
    database.tables.forEach(table => {
        if (table.type === 'I' || table.type === 'S') {
            const headers = table.header.split(';');
            headers.forEach(header => {
                const match = header.match(/Client (\d+)/i);
                if (match) clientSet.add(match[1]);
            });
        }
    });
    
    // Déterminer le système
    const globalAvg = sumAvg / countAvg;
    let normSystem = '12V';
    if (globalAvg >= 22 && globalAvg <= 29) normSystem = '24V';
    
    // Préparer les données pour les graphiques
    const dates = Object.keys(dailyStats).sort();
    const chartData = {
        dates: dates,
        mins: dates.map(d => dailyStats[d].min),
        maxs: dates.map(d => dailyStats[d].max),
        avgs: dates.map(d => dailyStats[d].sumAvg / dailyStats[d].count)
    };
    
    database.technicalData.dailyStats = dailyStats;
    database.technicalData.chartData = chartData;
    database.technicalData.globalMin = globalMin;
    database.technicalData.globalMax = globalMax;
    database.technicalData.globalAvg = globalAvg;
    database.technicalData.daysCount = dates.length;
    database.technicalData.clientCount = clientSet.size;
    database.technicalData.normSystem = normSystem;
}

// ===========================================
// ANALYSE DES VARIATIONS RAPIDES
// ===========================================

function analyzeVariations(data) {
    const normSystem = database.technicalData.normSystem;
    const seuil = VOLTAGE_NORMS[normSystem].variationSeuil;
    
    const variations = [];
    const parJour = {};
    
    // Grouper par date
    data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const heure = timestamp.split(' ')[1];
        const tensionAvg = (parseFloat(cells[3]) + parseFloat(cells[4])) / 2;
        
        if (!parJour[date]) parJour[date] = [];
        parJour[date].push({ heure, tension: tensionAvg });
    });
    
    // Détecter les variations
    Object.entries(parJour).forEach(([date, mesures]) => {
        mesures.sort((a, b) => a.heure.localeCompare(b.heure));
        
        for (let i = 1; i < mesures.length; i++) {
            const variation = Math.abs(mesures[i].tension - mesures[i-1].tension);
            
            if (variation >= seuil) {
                variations.push({
                    date,
                    heureDebut: mesures[i-1].heure,
                    heureFin: mesures[i].heure,
                    variation: parseFloat(variation.toFixed(2)),
                    seuil
                });
            }
        }
    });
    
    database.technicalData.variations = variations;
    database.technicalData.variationsSeuil = seuil;
}

// ===========================================
// ANALYSE DES HAUTES TENSIONS (≥14.2V / ≥28V)
// ===========================================

function analyzeHighVoltage() {
    const tensionTable = database.tables.find(t => t.type === 'T');
    if (!tensionTable) return;
    
    const normSystem = database.technicalData.normSystem;
    const seuil = HIGH_VOLTAGE_THRESHOLD[normSystem];
    const parDate = {};
    
    tensionTable.data.forEach(row => {
        const cells = row.split(';');
        const date = cells[1].split(' ')[0];
        const tensionMax = parseFloat(cells[4]);
        
        if (tensionMax >= seuil) {
            parDate[date] = (parDate[date] || 0) + 1;
        }
    });
    
    const highVoltage = Object.entries(parDate).map(([date, count]) => ({
        date,
        count,
        qualite: count >= 4 ? 'excellent' : count >= 2 ? 'bon' : count === 1 ? 'mauvais' : 'critique'
    }));
    
    database.technicalData.highVoltage = highVoltage.sort((a, b) => b.date.localeCompare(a.date));
    database.technicalData.highVoltageSeuil = seuil;
}

// ===========================================
// ANALYSE DES DÉLESTAGES
// ===========================================

function analyzeLoadShedding() {
    const eventTable = database.tables.find(t => t.type === 'E');
    if (!eventTable) return;
    
    const loadShedding = {
        partiel: 0,
        total: 0,
        jours: [],
        parDate: {}  // ← Sera enrichi
    };
    
    eventTable.data.forEach(row => {
        const cells = row.split(';');
        if (cells.length < 4) return;
        
        const eventType = cells[2];
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const time = timestamp.split(' ')[1];
        
        // ✅ NOUVEAU : Stocker les heures précises
        if (!loadShedding.parDate[date]) {
            loadShedding.parDate[date] = {
                partiel: 0,
                total: 0,
                evenements: []  // ← Liste des événements avec heures
            };
        }
        
        if (eventType === 'DelestagePartiel' || eventType === 'Delestage Partiel') {
            loadShedding.partiel++;
            loadShedding.parDate[date].partiel++;
            loadShedding.parDate[date].evenements.push({
                type: 'partiel',
                time: time,
                timestamp: timestamp
            });
            if (!loadShedding.jours.includes(date)) {
                loadShedding.jours.push(date);
            }
        } else if (eventType === 'DelestageTotal' || eventType === 'Delestage Total') {
            loadShedding.total++;
            loadShedding.parDate[date].total++;
            loadShedding.parDate[date].evenements.push({
                type: 'total',
                time: time,
                timestamp: timestamp
            });
            if (!loadShedding.jours.includes(date)) {
                loadShedding.jours.push(date);
            }
        }
    });
    
    // Trier les événements par heure pour chaque jour
    Object.values(loadShedding.parDate).forEach(jour => {
        jour.evenements.sort((a, b) => a.time.localeCompare(b.time));
    });
    
    database.technicalData.loadShedding = loadShedding;
}
// ===========================================
// ANALYSE DE CONFORMITÉ
// ===========================================

function calculateConformity() {
    const data = database.technicalData;
    if (!data.dailyStats) return;
    
    const normSystem = data.normSystem;
    const norms = VOLTAGE_NORMS[normSystem];
    const seuilVariation = norms.variationSeuil;
    
    const conformity = {
        totalJours: data.daysCount,
        conformes: 0,
        causes: { min: [], max: [], variation: [] }
    };
    
    Object.entries(data.dailyStats).forEach(([date, stats]) => {
        let conforme = true;
        
        if (stats.min < norms.min) {
            conforme = false;
            conformity.causes.min.push(date);
        }
        if (stats.max > norms.max) {
            conforme = false;
            conformity.causes.max.push(date);
        }
        
        const variationsJour = data.variations.filter(v => v.date === date);
        if (variationsJour.length > 0) {
            const maxVar = Math.max(...variationsJour.map(v => v.variation));
            if (maxVar >= seuilVariation) {
                conforme = false;
                conformity.causes.variation.push(date);
            }
        }
        
        if (conforme) conformity.conformes++;
    });
    
    conformity.pourcentage = ((conformity.conformes / conformity.totalJours) * 100).toFixed(1);
    
    // Compter les dépassements pour le tableau de bord II-2
    data.exceedances = {
        min: conformity.causes.min.length,
        max: conformity.causes.max.length,
        variation: conformity.causes.variation.length
    };
    
    data.conformity = conformity;
}