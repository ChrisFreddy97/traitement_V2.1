// analytics/commercialAnalytics.js
import { database } from '../arduinoCore.js';

// ===========================================
// FONCTIONS UTILITAIRES
// ===========================================

function computeMaxConsecutiveDays(dates) {
    if (dates.length === 0) return 0;
    let maxStreak = 1;
    let currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 1;
        }
    }
    return maxStreak;
}

function parseRechargeTable(rechargeTable) {
    if (!rechargeTable) return [];
    const headers = rechargeTable.header.split(';');
    return rechargeTable.data.map(row => {
        const cells = row.split(';');
        const obj = {};
        headers.forEach((header, index) => {
            const cleanHeader = header.trim();
            obj[cleanHeader] = cells[index]?.trim() || '';
        });
        return obj;
    });
}

// ===========================================
// ANALYSE DES CRÉDITS (TABLE S)
// ===========================================

function analyzeCreditData() {
    console.log("📊 Analyse des crédits (table S)");
    
    database.clientCreditData.clear();

    const creditTable = database.tables.find(t => t.type === 'S');
    if (!creditTable) {
        console.log("ℹ️ Aucune table de crédits");
        return null;
    }

    // Identifier les colonnes clients
    const headers = creditTable.header.split(';').filter(h => h.trim() !== '');
    const clientColumns = [];

    headers.forEach((header, index) => {
        const match = header.match(/Client (\d+)/i);
        if (match) {
            clientColumns.push({ index, clientId: match[1] });
        }
    });

    // Initialiser les données clients
    clientColumns.forEach(col => {
        database.clientCreditData.set(col.clientId, {
            id: col.clientId,
            credits: [],
            zeroCreditDates: [],
            totalCredit: 0,
            count: 0,
            maxCredit: 0
        });
    });

    // Parcourir les lignes
    creditTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];

        clientColumns.forEach(col => {
            const creditValue = parseFloat(cells[col.index]);
            if (!isNaN(creditValue)) {
                const client = database.clientCreditData.get(col.clientId);
                client.credits.push({ date, value: creditValue });
                client.totalCredit += creditValue;
                client.count++;
                client.maxCredit = Math.max(client.maxCredit, creditValue);
                if (creditValue === 0) {
                    client.zeroCreditDates.push(date);
                }
            }
        });
    });

    // Post-traitement
    database.clientCreditData.forEach(client => {
        client.averageCredit = client.count > 0 ? client.totalCredit / client.count : 0;
        client.zeroCreditDates.sort();
        client.zeroCreditPercentage = client.count > 0 ? (client.zeroCreditDates.length / client.count) * 100 : 0;
        client.isOftenEmpty = client.zeroCreditPercentage >= 30;
        client.maxConsecutiveZeroDays = computeMaxConsecutiveDays(client.zeroCreditDates);
    });

    const result = {
        clients: Array.from(database.clientCreditData.values()),
        totalClients: database.clientCreditData.size
    };

    database.commercialData = result;
    console.log(`✅ ${result.totalClients} clients analysés (crédits)`);
    return result;
}

// ===========================================
// ANALYSE DES RECHARGES (TABLE R)
// ===========================================

function analyzeRechargeData() {
    console.log("📊 Analyse des recharges (table R)");
    
    const rechargeTable = database.tables.find(t => t.type === 'R');
    if (!rechargeTable) {
        console.log("ℹ️ Aucune table de recharges");
        return null;
    }
    
    // Parser les données
    const rawData = parseRechargeTable(rechargeTable);
    
    // Filtrer les recharges valides
    const validRecharges = rawData.filter(row => 
        row['Numero Client'] && 
        row['Numero Client'] !== '0' && 
        row['Message'] === 'Recharge Reussie'
    );
    
    // Grouper par client
    const clientsMap = new Map();
    
    validRecharges.forEach(recharge => {
        const clientId = recharge['Numero Client'];
        const credit = parseFloat(recharge['Credit']);
        const forfait = parseFloat(recharge['Forfait']);
        const timestamp = recharge['TimeStamp'];
        
        if (!clientsMap.has(clientId)) {
            clientsMap.set(clientId, {
                id: clientId,
                recharges: [],
                credits: {},
                totalRecharges: 0
            });
        }
        
        const client = clientsMap.get(clientId);
        client.recharges.push({
            timestamp,
            date: timestamp.split(' ')[0],
            credit,
            forfait
        });
        client.credits[credit] = (client.credits[credit] || 0) + 1;
        client.totalRecharges++;
    });
    
    // Analyser chaque client
    const clients = [];
    
    clientsMap.forEach((client, clientId) => {
        // Trier par date
        client.recharges.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Détecter les changements de forfait
        const forfaitChanges = [];
        let dernierForfait = null;
        
        client.recharges.forEach(recharge => {
            if (dernierForfait !== null && recharge.forfait !== dernierForfait) {
                forfaitChanges.push({
                    date: recharge.date,
                    ancien: dernierForfait,
                    nouveau: recharge.forfait
                });
            }
            dernierForfait = recharge.forfait;
        });
        
        // Calculer les pourcentages de crédit
        const creditPercentages = {};
        Object.entries(client.credits).forEach(([credit, count]) => {
            creditPercentages[credit] = ((count / client.totalRecharges) * 100).toFixed(1);
        });
        
        // Crédit préféré
        let preferredCredit = null;
        let maxCount = 0;
        Object.entries(client.credits).forEach(([credit, count]) => {
            if (count > maxCount) {
                maxCount = count;
                preferredCredit = credit;
            }
        });
        
        // Dernières 5 recharges
        const dernieresRecharges = client.recharges.slice(-5).reverse();
        
        clients.push({
            id: clientId,
            totalRecharges: client.totalRecharges,
            recharges: client.recharges,
            forfaitChanges,
            creditPercentages,
            preferredCredit,
            preferredPercentage: creditPercentages[preferredCredit] || '0',
            dernieresRecharges,
            aChangeForfait: forfaitChanges.length > 0
        });
    });
    
    // Trier par ID
    clients.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    
    const result = {
        clients,
        summary: {
            totalClients: clients.length,
            totalRecharges: validRecharges.length,
            clientsWithChange: clients.filter(c => c.aChangeForfait).length
        }
    };
    
    database.rechargeAnalysis = result;
    console.log(`✅ ${result.summary.totalClients} clients analysés (recharges)`);
    return result;
}

// ===========================================
// FONCTION PRINCIPALE (appelée depuis arduinoMain.js)
// ===========================================

export function analyzeCommercialData() {
    console.log("💰 Analyse commerciale - Début");
    analyzeCreditData();
    analyzeRechargeData();
    console.log("💰 Analyse commerciale - Fin");
}

// ===========================================
// FONCTIONS COMPLÉMENTAIRES (gardées)
// ===========================================

export function enrichZeroCreditWithRechargeAndEvents(rechargeData) {
    const eventMap = database.eventMap;
    database.clientCreditData.forEach(client => {
        client.zeroCreditAfterRecharge = 0;
        client.zeroCreditWithEvent = 0;
        client.zeroCreditDates.forEach(date => {
            const hasRecharge = rechargeData.some(r =>
                r['Numero Client'] === client.id &&
                r['TimeStamp'].startsWith(date) &&
                r['Message'] === 'Recharge Reussie'
            );
            if (hasRecharge) client.zeroCreditAfterRecharge++;
            const key = `${date}_${client.id}`;
            if (eventMap.has(key)) client.zeroCreditWithEvent++;
        });
        client.zeroRechargeCorrelation = client.zeroCreditDates.length > 0 ? client.zeroCreditAfterRecharge / client.zeroCreditDates.length : 0;
        client.zeroEventCorrelation = client.zeroCreditDates.length > 0 ? client.zeroCreditWithEvent / client.zeroCreditDates.length : 0;
        client.alert = null;
        if (client.isOftenEmpty && client.zeroRechargeCorrelation < 0.5) {
            client.alert = "⚠️ Client souvent à sec sans recharge immédiate";
        } else if (client.maxConsecutiveZeroDays >= 3) {
            client.alert = "⚠️ Client bloqué plusieurs jours consécutifs";
        } else if (client.zeroEventCorrelation > 0.5) {
            client.alert = "⚠️ Crédit nul fréquemment associé à événements système";
        }
    });
}

export function getZeroCreditGlobalStats() {
    const clients = Array.from(database.clientCreditData.values());
    const totalZeroDays = clients.reduce((sum, c) => sum + c.zeroCreditDates.length, 0);
    const totalDays = clients.reduce((sum, c) => sum + c.count, 0);
    const clientsOftenEmpty = clients.filter(c => c.isOftenEmpty).length;
    return {
        totalClients: clients.length,
        totalZeroDays,
        globalZeroPercentage: totalDays > 0 ? (totalZeroDays / totalDays * 100) : 0,
        clientsOftenEmpty,
        clientsWithAlert: clients.filter(c => c.alert).length
    };
}