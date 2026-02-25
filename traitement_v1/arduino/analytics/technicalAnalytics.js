// analytics/technicalAnalytics.js
import { database } from '../arduinoCore.js';
import { VOLTAGE_NORMS } from '../arduinoConstants.js';

// ===========================================
// 1. FONCTIONS DE BASE (définies en premier)
// ===========================================

function calculateBaseStats(data) {
    console.log("📊 Calcul des stats de base...");
    
    const dailyStats = {};
    let globalMin = Infinity;
    let globalMax = -Infinity;
    let sumAvg = 0;
    let countAvg = 0;
    
    // Compter les clients
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
    
    // Analyser chaque ligne
    data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const tensionMin = parseFloat(cells[3]);
        const tensionMax = parseFloat(cells[4]);
        const tensionAvg = (tensionMin + tensionMax) / 2;
        
        if (!dailyStats[date]) {
            dailyStats[date] = { min: Infinity, max: -Infinity, sumAvg: 0, count: 0 };
        }
        dailyStats[date].min = Math.min(dailyStats[date].min, tensionMin);
        dailyStats[date].max = Math.max(dailyStats[date].max, tensionMax);
        dailyStats[date].sumAvg += tensionAvg;
        dailyStats[date].count++;
        
        globalMin = Math.min(globalMin, tensionMin);
        globalMax = Math.max(globalMax, tensionMax);
        sumAvg += tensionAvg;
        countAvg++;
    });
    
    const dates = Object.keys(dailyStats).sort();
    const chartData = {
        dates: dates,
        mins: dates.map(d => dailyStats[d].min),
        maxs: dates.map(d => dailyStats[d].max),
        avgs: dates.map(d => dailyStats[d].sumAvg / dailyStats[d].count)
    };
    
    const globalAvg = sumAvg / countAvg;
    
    // Déterminer le système
    let normSystem = '';
    if (globalAvg >= 22 && globalAvg <= 29) {
        normSystem = '24V';
    } else if (globalAvg >= 11 && globalAvg <= 15) {
        normSystem = '12V';
    }
    
    return {
        dailyStats,
        chartData,
        globalMin,
        globalMax,
        globalAvg,
        daysCount: dates.length,
        clientCount: clientSet.size || 'N/A',
        normSystem
    };
}

function calculateVariationsRapides(data, normSystem) {
    console.log("⚡ Calcul des variations rapides...");
    
    const seuilVariation = normSystem === '24V' ? 3.5 : 1.5;
    const variations = [];
    const variationsParJour = {};
    const chartData = { dates: [], max: [], avg: [] };
    
    const parDate = {};
    data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const heure = timestamp.split(' ')[1]?.substring(0, 5) || '00:00';
        const tensionMin = parseFloat(cells[3]);
        const tensionMax = parseFloat(cells[4]);
        const tensionAvg = (tensionMin + tensionMax) / 2;
        
        if (!parDate[date]) {
            parDate[date] = [];
        }
        parDate[date].push({ heure, tension: tensionAvg });
    });
    
    Object.entries(parDate).forEach(([date, mesures]) => {
        mesures.sort((a, b) => a.heure.localeCompare(b.heure));
        const variationsDuJour = [];
        
        for (let i = 1; i < mesures.length; i++) {
            const variation = Math.abs(mesures[i].tension - mesures[i-1].tension);
            
            if (variation >= seuilVariation) {
                variationsDuJour.push({
                    heureDebut: mesures[i-1].heure,
                    heureFin: mesures[i].heure,
                    variation: variation
                });
                
                variations.push({
                    date: date,
                    heureDebut: mesures[i-1].heure,
                    heureFin: mesures[i].heure,
                    variation: variation.toFixed(2),
                    type: variation > seuilVariation ? 'critique' : 'attention'
                });
            }
        }
        
        if (variationsDuJour.length > 0) {
            variationsParJour[date] = variationsDuJour;
            chartData.dates.push(date);
            chartData.max.push(Math.max(...variationsDuJour.map(v => v.variation)));
            chartData.avg.push(variationsDuJour.reduce((sum, v) => sum + v.variation, 0) / variationsDuJour.length);
        }
    });
    
    database.technicalData.variationsRapides = variations;
    database.technicalData.variationsParJour = variationsParJour;
    database.technicalData.variationsChart = chartData;
    console.log(`✅ ${variations.length} variations détectées`);
}

function calculateExceedances14V(dailyStats) {
    console.log("⚠️ Analyse des dépassements 14.2V...");
    
    const tensionTable = database.tables.find(t => t.type === 'T');
    const countByDate = {};
    const chartData = { dates: [], counts: [] };
    
    if (tensionTable) {
        tensionTable.data.forEach(row => {
            const cells = row.split(';');
            const date = cells[1].split(' ')[0];
            const tension = parseFloat(cells[4]); // tension max
            if (tension >= 14.2) {
                countByDate[date] = (countByDate[date] || 0) + 1;
            }
        });
    }
    
    // Préparer les données pour l'affichage
    const analyse14V = [];
    Object.entries(countByDate).forEach(([date, count]) => {
        let qualite, message;
        if (count >= 4) {
            qualite = "excellent";
            message = "Excellent - Charge optimale";
        } else if (count >= 2) {
            qualite = "bon";
            message = "Bon - Charge correcte";
        } else if (count === 1) {
            qualite = "mauvais";
            message = "Mauvais - Faible charge";
        } else {
            qualite = "critique";
            message = "Critique - Batterie défectueuse";
        }
        
        analyse14V.push({ date, count, qualite, message });
        chartData.dates.push(date);
        chartData.counts.push(count);
    });
    
    // Trier par date
    analyse14V.sort((a, b) => new Date(b.date) - new Date(a.date));
    chartData.dates.sort();
    chartData.counts = chartData.dates.map(d => countByDate[d]);
    
    database.technicalData.analyse14V = analyse14V;
    database.technicalData.chart14V = chartData;
    
    console.log(`✅ ${analyse14V.length} jours avec dépassements 14.2V`);
}

function calculateExtremesSummary(globalMin, globalMax) {
    console.log("📊 Calcul du résumé des extrêmes...");
    
    const tensionTable = database.tables.find(t => t.type === 'T');
    if (!tensionTable) return;
    
    const data = tensionTable.data;
    let maxEntry = null;
    let minEntry = null;
    
    data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const tensionMin = parseFloat(cells[3]);
        const tensionMax = parseFloat(cells[4]);
        
        if (tensionMax === globalMax) {
            maxEntry = {
                valeur: tensionMax,
                timestamp: timestamp,
                date: timestamp.split(' ')[0],
                heure: timestamp.split(' ')[1]?.substring(0,5) || '??'
            };
        }
        
        if (tensionMin === globalMin) {
            minEntry = {
                valeur: tensionMin,
                timestamp: timestamp,
                date: timestamp.split(' ')[0],
                heure: timestamp.split(' ')[1]?.substring(0,5) || '??'
            };
        }
    });
    
    database.technicalData.extremesSummary = { max: maxEntry, min: minEntry };
    console.log("✅ Extrêmes calculés");
}

function calculateVariationsSummary() {
    console.log("📊 Calcul du résumé des variations...");
    
    const variations = database.technicalData?.variationsRapides || [];
    
    const parDate = {};
    variations.forEach(v => {
        if (!parDate[v.date]) {
            parDate[v.date] = { date: v.date, count: 0, variations: [] };
        }
        parDate[v.date].count++;
        parDate[v.date].variations.push(v);
    });
    
    const joursCritiques = Object.values(parDate)
        .filter(j => j.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    
    const total = variations.length;
    const jours = Object.keys(parDate).length;
    
    database.technicalData.variationsSummary = {
        total: total,
        joursConcertnes: jours,
        moyenneParJour: jours > 0 ? (total / jours).toFixed(1) : 0,
        joursCritiques: joursCritiques,
        seuil: database.technicalData?.normSystem === '24V' ? 3.5 : 1.5
    };
    
    console.log("✅ Résumé variations calculé");
}

// ===========================================
// ANALYSE DE CONFORMITÉ
// ===========================================
function calculateConformity() {
    console.log("📊 Calcul de la conformité...");
    
    const tensionTable = database.tables.find(t => t.type === 'T');
    if (!tensionTable) return;
    
    const normSystem = database.technicalData.normSystem;
    const norms = VOLTAGE_NORMS[normSystem];
    const seuilVariation = normSystem === '24V' ? 3.5 : 1.5;
    
    const conformity = {
        totalJours: 0,
        joursConformes: 0,
        joursNonConformes: 0,
        pourcentageConformite: 0,
        causes: {
            surtension: new Set(),
            sousTension: new Set(),
            variation: new Set()
        },
        details: {}
    };
    
    // Grouper par date
    const parDate = {};
    tensionTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const tensionMin = parseFloat(cells[3]);
        const tensionMax = parseFloat(cells[4]);
        
        if (!parDate[date]) {
            parDate[date] = {
                min: Infinity,
                max: -Infinity,
                conformite: true,
                problems: []
            };
        }
        
        parDate[date].min = Math.min(parDate[date].min, tensionMin);
        parDate[date].max = Math.max(parDate[date].max, tensionMax);
    });
    
    // Analyser chaque jour
    Object.entries(parDate).forEach(([date, data]) => {
        conformity.totalJours++;
        let jourConforme = true;
        const problems = [];
        
        if (data.max > norms.max) {
            jourConforme = false;
            problems.push('surtension');
            conformity.causes.surtension.add(date);
        }
        if (data.min < norms.min) {
            jourConforme = false;
            problems.push('sous-tension');
            conformity.causes.sousTension.add(date);
        }
        
        const variationsJour = database.technicalData.variationsRapides?.filter(v => v.date === date) || [];
        if (variationsJour.length > 0) {
            const maxVar = Math.max(...variationsJour.map(v => parseFloat(v.variation)));
            if (maxVar >= seuilVariation) {
                jourConforme = false;
                problems.push('variation');
                conformity.causes.variation.add(date);
            }
        }
        
        if (jourConforme) {
            conformity.joursConformes++;
        } else {
            conformity.joursNonConformes++;
        }
        
        conformity.details[date] = {
            conforme: jourConforme,
            problems: problems,
            min: data.min,
            max: data.max
        };
    });
    
    conformity.pourcentageConformite = (conformity.joursConformes / conformity.totalJours * 100).toFixed(1);
    conformity.causes.surtension = Array.from(conformity.causes.surtension);
    conformity.causes.sousTension = Array.from(conformity.causes.sousTension);
    conformity.causes.variation = Array.from(conformity.causes.variation);
    
    database.technicalData.conformity = conformity;
    console.log("✅ Conformité calculée", conformity);
}

// ===========================================
// ANALYSE DES DÉLESTAGES (Événements)
// ===========================================
function analyzeLoadShedding() {
    console.log("⚡ Analyse des délestages...");
    
    const eventTable = database.tables.find(t => t.type === 'E');
    if (!eventTable) return;
    
    const loadShedding = {
        total: 0,
        parType: {
            partiel: 0,
            total: 0
        },
        parDate: {},
        parClient: {},
        calendrier: {},
        stats: {
            joursAvecDelestage: new Set(),
            clientsImpactes: new Set()
        }
    };
    
    eventTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const eventType = cells[2];
        const clientId = cells[3];
        
        if (eventType.includes('Delestage')) {
            loadShedding.total++;
            loadShedding.stats.joursAvecDelestage.add(date);
            if (clientId && clientId !== '0') {
                loadShedding.stats.clientsImpactes.add(clientId);
            }
            
            // Par type
            if (eventType === 'Delestage Partiel') {
                loadShedding.parType.partiel++;
            } else if (eventType === 'Delestage Total') {
                loadShedding.parType.total++;
            }
            
            // Par date
            if (!loadShedding.parDate[date]) {
                loadShedding.parDate[date] = {
                    partiel: 0,
                    total: 0,
                    clients: []
                };
            }
            if (eventType === 'Delestage Partiel') {
                loadShedding.parDate[date].partiel++;
            } else {
                loadShedding.parDate[date].total++;
            }
            if (clientId && clientId !== '0' && !loadShedding.parDate[date].clients.includes(clientId)) {
                loadShedding.parDate[date].clients.push(clientId);
            }
            
            // Par client
            if (!loadShedding.parClient[clientId]) {
                loadShedding.parClient[clientId] = { partiel: 0, total: 0, dates: [] };
            }
            if (eventType === 'Delestage Partiel') {
                loadShedding.parClient[clientId].partiel++;
            } else {
                loadShedding.parClient[clientId].total++;
            }
            if (!loadShedding.parClient[clientId].dates.includes(date)) {
                loadShedding.parClient[clientId].dates.push(date);
            }
        }
    });
    
    // Créer le calendrier
    const dates = Object.keys(loadShedding.parDate).sort();
    dates.forEach(date => {
        const [year, month, day] = date.split('-');
        if (!loadShedding.calendrier[year]) loadShedding.calendrier[year] = {};
        if (!loadShedding.calendrier[year][month]) loadShedding.calendrier[year][month] = {};
        
        loadShedding.calendrier[year][month][parseInt(day)] = {
            partiel: loadShedding.parDate[date].partiel,
            total: loadShedding.parDate[date].total,
            clients: loadShedding.parDate[date].clients.length
        };
    });
    
    loadShedding.stats.joursAvecDelestage = Array.from(loadShedding.stats.joursAvecDelestage);
    loadShedding.stats.clientsImpactes = Array.from(loadShedding.stats.clientsImpactes);
    
    database.technicalData.loadShedding = loadShedding;
    console.log("✅ Analyse délestage terminée", loadShedding);
}

// ===========================================
// 2. FONCTION PRINCIPALE (appelle toutes les autres)
// ===========================================

export function analyzeTechnicalData() {
    console.log("🔧 Analyse technique - Début");
    
    const tensionTable = database.tables.find(t => t.type === 'T');
    if (!tensionTable) {
        console.log("❌ Aucune table de tension trouvée");
        return;
    }
    
    const baseStats = calculateBaseStats(tensionTable.data);
    
    database.technicalData = {
        dailyStats: baseStats.chartData,
        globalMin: baseStats.globalMin,
        globalMax: baseStats.globalMax,
        globalAvg: baseStats.globalAvg,
        daysCount: baseStats.daysCount,
        clientCount: baseStats.clientCount,
        normSystem: baseStats.normSystem
    };
    
    calculateVariationsRapides(tensionTable.data, baseStats.normSystem);
    calculateExceedances14V(baseStats.dailyStats);
    calculateExtremesSummary(baseStats.globalMin, baseStats.globalMax);
    calculateVariationsSummary();
    calculateConformity();        
    analyzeLoadShedding();        
    
    console.log("✅ Analyse technique - Terminé", database.technicalData);
}

