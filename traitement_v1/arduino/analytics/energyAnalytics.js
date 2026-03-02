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
    const tensions = parseTensionData(tensionTable);
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
    
    // Aligner et calculer l'énergie
    const energyData = [];
    const PAS_TEMPS = 10/60; // 10 minutes en heures
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent;
    
    // Pour chaque pas de temps dans intensités (toutes les 10min)
    intensites.forEach(intensitePoint => {
        const timestamp = intensitePoint.timestamp;
        const date = timestamp.split(' ')[0];
        
        // Trouver la tension correspondante (la plus proche dans le temps)
        const tensionPoint = findClosestTension(tensions, timestamp);
        
        if (tensionPoint && intensitePoint.parClient) {
            // Calculer l'énergie pour chaque client
            Object.entries(intensitePoint.parClient).forEach(([clientId, intensite]) => {
                // Extraire le vrai ID client via la fonction centralisée
                const vraiClientId = extractClientId(clientId, nanoreseau);
                const tension = tensionPoint.parClient[clientId] || tensionPoint.moyenne;
                
                if (tension && intensite > 0) {
                    const puissance = tension * intensite; // Watts
                    const energie = puissance * PAS_TEMPS; // Wattheures
                    
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
    // Agréger par jour pour les bilans journaliers
    const parJour = {};
    const parClient = {};
    
    energyData.forEach(point => {
        if (point.clientId === 'total') return;
        
        // Par jour
        if (!parJour[point.date]) {
            parJour[point.date] = { total: 0, parClient: {} };
        }
        parJour[point.date].total += point.energie;
        
        // Par client
        if (!parClient[point.clientId]) {
            parClient[point.clientId] = [];
        }
        parClient[point.clientId].push(point);
        
        // Par jour et par client
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
    
    energyData.forEach(point => {
        if (point.clientId === 'total') return;
        
        // Par jour
        if (!parJour[point.date]) {
            parJour[point.date] = {
                total: 0,
                parClient: {}
            };
        }
        parJour[point.date].total += point.energie;
        
        // Par client
        if (!parClient[point.clientId]) {
            parClient[point.clientId] = [];
        }
        parClient[point.clientId].push(point);
        
        // Par jour et par client
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
    
    console.log(`✅ Énergie calculée pour ${Object.keys(parClient).length} clients`);
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
    // Trouver la tension la plus proche dans le temps
    // Les tensions sont horaires, les intensités sont aux 10min
    const targetTime = new Date(timestamp).getTime();
    
    let closest = null;
    let minDiff = Infinity;
    
    tensions.forEach(t => {
        const tTime = new Date(t.timestamp).getTime();
        const diff = Math.abs(targetTime - tTime);
        
        if (diff < minDiff && diff < 3600000) { // Moins d'1h d'écart
            minDiff = diff;
            closest = t;
        }
    });
    
    return closest;
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

