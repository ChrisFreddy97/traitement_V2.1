// analytics/energyAnalytics.js
import { database, extractClientId } from '../arduinoCore.js';

// ===========================================
// ANALYSE ÉNERGIE PRINCIPALE
// ===========================================

export function analyzeEnergyData() {
    console.log("⚡ Analyse énergie - Début");
    
    const tensionTable = database.tables.find(t => t.type === 'T');
    const intensiteTable = database.tables.find(t => t.type === 'I');
    
    if (!tensionTable && !intensiteTable) {
        console.log("❌ Tables T et I manquantes : impossible de calculer l'énergie");
        database.energyData = { 
            source: 'none', 
            data: [], 
            parClient: {}, 
            parDate: {},
            stats: { max: 0, min: 0, avg: 0, total: 0 } 
        };
        return;
    }
    
    if (!tensionTable || !intensiteTable) {
        console.warn("⚠️ Une des tables (T ou I) manque : données d'énergie incomplètes");
        database.energyData = { 
            source: 'partial', 
            data: [], 
            parClient: {}, 
            parDate: {},
            stats: { max: 0, min: 0, avg: 0, total: 0 } 
        };
        return;
    }
    
    console.log(`📊 Calcul de l'énergie à partir de T(${tensionTable.data.length}) et I(${intensiteTable.data.length})`);
    calculateEnergyFromTI(tensionTable, intensiteTable);
    
    console.log("✅ Analyse énergie terminée");
    console.log(`📊 Énergie calculée : ${Object.keys(database.energyData.parClient || {}).length} clients traitées`);
}

// ===========================================
// CAS UNIQUE : CALCUL À PARTIR DE TENSION ET INTENSITÉ
// ===========================================

function calculateEnergyFromTI(tensionTable, intensiteTable) {
    // parser et indexer tensions
    let tensions = parseTensionData(tensionTable);
    if (tensions.length > 1) {
        tensions.sort((a, b) => a.timestampMs - b.timestampMs);
    }

    const intensites = parseIntensiteData(intensiteTable);

    if (tensions.length === 0 || intensites.length === 0) {
        console.warn("⚠️ Pas de données de tension ou d'intensité");
        database.energyData = {
            source: 'empty',
            data: [],
            parClient: {},
            parDate: {},
            stats: { max: 0, min: 0, avg: 0, total: 0 }
        };
        return;
    }

    // build lookup structures
    const tensionMap = new Map(tensions.map(t => [t.timestamp, t]));
    const sortedTimes = tensions.map(t => t.timestampMs);

    const energyData = [];
    const PAS_TEMPS = 10 / 60; // 10 minutes en heures
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent;

    intensites.forEach(intensitePoint => {
        const timestamp = intensitePoint.timestamp;
        const date = timestamp.split(' ')[0];

        let tensionPoint = tensionMap.get(timestamp);
        if (!tensionPoint) {
            // recherche binaire sur le tableau trié
            const targetMs = new Date(timestamp).getTime();
            let lo = 0, hi = sortedTimes.length - 1;
            let closestIdx = -1;
            let minDiff = Infinity;
            while (lo <= hi) {
                const mid = Math.floor((lo + hi) / 2);
                const diff = sortedTimes[mid] - targetMs;
                if (Math.abs(diff) < minDiff) {
                    minDiff = Math.abs(diff);
                    closestIdx = mid;
                }
                if (diff === 0) break;
                if (diff < 0) lo = mid + 1;
                else hi = mid - 1;
            }
            if (minDiff < 3600000 && closestIdx !== -1) {
                tensionPoint = tensions[closestIdx];
            }
        }

        if (tensionPoint && intensitePoint.parClient) {
            Object.entries(intensitePoint.parClient).forEach(([clientId, intensite]) => {
                const vraiClientId = extractClientId(clientId, nanoreseau);
                const tension = tensionPoint.parClient[clientId] || tensionPoint.moyenne;
                if (tension && intensite > 0) {
                    const puissance = tension * intensite;
                    const energie = puissance * PAS_TEMPS;
                    energyData.push({
                        clientId: vraiClientId,
                        originalId: clientId,
                        timestamp,
                        date,
                        tension,
                        intensite,
                        puissance,
                        energie: parseFloat(energie.toFixed(3))
                    });
                }
            });
        }
    });

    console.log(`✅ ${energyData.length} points d'énergie calculés`);
    const parJour = {};
    const parClient = {};

    energyData.forEach(point => {
        if (point.clientId === 'total') return;
        if (!parJour[point.date]) {
            parJour[point.date] = { total: 0, parClient: {} };
        }
        parJour[point.date].total += point.energie;
        if (!parClient[point.clientId]) {
            parClient[point.clientId] = [];
        }
        parClient[point.clientId].push(point);
        if (!parJour[point.date].parClient[point.clientId]) {
            parJour[point.date].parClient[point.clientId] = 0;
        }
        parJour[point.date].parClient[point.clientId] += point.energie;
    });

    database.energyData = {
        source: 'calculated',
        data: energyData,
        parClient: parClient,
        parDate: parJour,
        stats: calculateEnergyStats(energyData)
    };

    console.log(`✅ Énergie liée à ${Object.keys(parClient).length} clients`);
}

// ===========================================
// FONCTIONS UTILITAIRES
// ===========================================

function parseTensionData(tensionTable) {
    const result = [];
    const headers = tensionTable.header.split(';');
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent;
    
    // Identifier les colonnes clients dans la table T (s'il y en a)
    const clientColumns = [];
    headers.forEach((header, index) => {
        const match = header.match(/Client (\d+)/i);
        if (match) {
            const fullId = match[1];
            const vraiId = extractClientId(fullId, nanoreseau);
            clientColumns.push({ index, clientId: vraiId });
        }
    });
    
    tensionTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const tensionInst = parseFloat(cells[2]) || 0;
        const tensionMin = parseFloat(cells[3]) || 0;
        const tensionMax = parseFloat(cells[4]) || 0;
        
        const point = {
            timestamp,
            // numeric time to speed comparisons/searches
            timestampMs: new Date(timestamp).getTime(),
            instant: tensionInst,
            min: tensionMin,
            max: tensionMax,
            moyenne: (tensionMin + tensionMax) / 2,
            parClient: {}
        };
        
        // S'il y a des colonnes client, les extraire
        clientColumns.forEach(col => {
            const val = parseFloat(cells[col.index]) || 0;
            if (val > 0) point.parClient[col.clientId] = val;
        });
        
        result.push(point);
    });
    
    return result;
}

function parseIntensiteData(intensiteTable) {
    const result = [];
    const headers = intensiteTable.header.split(';');
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent;
    
    // Identifier les colonnes clients
    const clientColumns = [];
    headers.forEach((header, index) => {
        const match = header.match(/Client (\d+)/i);
        if (match) {
            const fullId = match[1];
            const vraiId = extractClientId(fullId, nanoreseau);
            clientColumns.push({ index, clientId: vraiId });
        }
    });
    
    intensiteTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        
        const point = {
            timestamp,
            parClient: {}
        };
        
        clientColumns.forEach(col => {
            const val = parseFloat(cells[col.index]) || 0;
            if (val > 0) point.parClient[col.clientId] = val;
        });
        
        result.push(point);
    });
    
    return result;
}

function findClosestTension(tensions, timestamp) {
    // Supposé que `tensions` est trié par timestampMs.
    const targetMs = new Date(timestamp).getTime();
    if (tensions.length === 0) return null;

    let lo = 0, hi = tensions.length - 1;
    let closest = null;
    let minDiff = Infinity;

    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const t = tensions[mid];
        const diff = t.timestampMs - targetMs;
        const absDiff = Math.abs(diff);

        if (absDiff < minDiff) {
            minDiff = absDiff;
            closest = t;
        }
        if (diff === 0) break;
        if (diff < 0) lo = mid + 1;
        else hi = mid - 1;
    }

    return minDiff < 3600000 ? closest : null;
}

function groupByClient(data) {
    const result = {};
    
    data.forEach(point => {
        if (point.clientId && point.clientId !== 'total') {
            if (!result[point.clientId]) result[point.clientId] = [];
            result[point.clientId].push(point);
        }
    });
    
    return result;
}

function groupByDate(data) {
    const result = {};
    
    data.forEach(point => {
        if (!result[point.date]) result[point.date] = [];
        result[point.date].push(point);
    });
    
    return result;
}

function calculateEnergyStats(data) {
    if (data.length === 0) {
        return { max: 0, min: 0, avg: 0, total: 0 };
    }
    
    const valeurs = data.map(d => d.energie).filter(v => !isNaN(v) && v > 0);
    
    if (valeurs.length === 0) {
        return { max: 0, min: 0, avg: 0, total: 0 };
    }
    
    const max = Math.max(...valeurs);
    const min = Math.min(...valeurs);
    const total = valeurs.reduce((s, v) => s + v, 0);
    const avg = total / valeurs.length;
    
    return {
        max: parseFloat(max.toFixed(2)),
        min: parseFloat(min.toFixed(2)),
        avg: parseFloat(avg.toFixed(2)),
        total: parseFloat(total.toFixed(2))
    };
}

// ===========================================
// FONCTIONS D'EXPORT POUR LES DASHBOARDS
// ===========================================

export function getEnergyStats() {
    return database.energyData?.stats || { max: 0, min: 0, avg: 0 };
}

export function getEnergyByDate(date) {
    return database.energyData?.parDate[date] || [];
}

export function getEnergyByClient(clientId) {
    return database.energyData?.parClient[clientId] || [];
}

export function getDailyEnergy(date) {
    const points = database.energyData?.parDate[date] || [];
    const total = points.reduce((s, p) => s + (p.energie || 0), 0);
    return parseFloat(total.toFixed(2));
}

/**
 * ============================================================================
 * ALTERNATIVE ENERGY CALCULATION (from energyCalculator.js consolidation)
 * ============================================================================
 * Alternative approach supporting direct calculation with energyPerClient
 * structure - kept for backward compatibility
 */

export function getEnergyForClient(clientId) {
    // Use energyData if available (primary source), otherwise energyPerClient
    if (database.energyData?.parClient?.[clientId]) {
        return database.energyData.parClient[clientId];
    }
    
    return database.energyPerClient?.[clientId] || {
        journaliere: [],
        max: 0,
        min: 0,
        moyenne: 0,
        total: 0
    };
}


export function parseTensionForTable(tensionTable) {
    const result = [];
    tensionTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        result.push({
            timestamp,
            date: timestamp.split(' ')[0],
            time: timestamp.split(' ')[1].substring(0,5),
            instant: parseFloat(cells[2]) || 0
        });
    });
    return result;
}

export function parseIntensiteForTable(intensiteTable) {
    const result = [];
    const headers = intensiteTable.header.split(';');
    
    // Identifier les colonnes clients
    const clientColumns = [];
    headers.forEach((header, index) => {
        const match = header.match(/Client (\d+)/i);
        if (match) clientColumns.push({ index, clientId: match[1] });
    });
    
    intensiteTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const parClient = {};
        
        clientColumns.forEach(col => {
            parClient[col.clientId] = parseFloat(cells[col.index]) || 0;
        });
        
        result.push({
            timestamp,
            date: timestamp.split(' ')[0],
            time: timestamp.split(' ')[1].substring(0,5),
            parClient
        });
    });
    
    return result;
}

export function alignData(tensions, intensites) {
    const result = [];
    const PAS_TEMPS = 10/60;
    
    intensites.forEach(intens => {
        // Trouver la tension correspondante (même heure ou plus proche)
        const tension = tensions.find(t => t.timestamp === intens.timestamp) || 
                       findClosestTension(tensions, intens.timestamp);
        
        if (tension) {
            const sommeI = Object.values(intens.parClient).reduce((s, v) => s + v, 0);
            const energie = (tension.instant || 12) * sommeI * PAS_TEMPS;
            
            result.push({
                date: intens.date,
                time: intens.time,
                tension: tension.instant,
                intensites: intens.parClient,
                sommeI,
                energie
            });
        }
    });
    
    return result.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}