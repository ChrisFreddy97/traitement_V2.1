// arduinoAnalytics.js
import { database } from './arduinoCore.js';

export function analyzeTechnicalData() {
    const tensionTable = database.tables.find(t => t.type === 'T');
    if (!tensionTable) return;

    const data = tensionTable.data;
    const dailyStats = {};
    let globalMin = Infinity;
    let globalMax = -Infinity;
    let sumAvg = 0;
    let countAvg = 0;
    let globalminDate = '';
    let globalMaxDate = '';

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
        globalminDate = globalMin === tensionMin ? date : globalminDate;
        globalMax = Math.max(globalMax, tensionMax);
        globalMaxDate = globalMax === tensionMax ? date : globalMaxDate;
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
    const clientCount = clientSet.size;

    database.technicalData = {
        dailyStats: chartData,
        globalMin, globalMax, globalAvg,
        daysCount: dates.length,
        clientCount: clientCount || 'N/A'
    };
}

export function analyzeCommercialData() {
    database.clientCreditData.clear();

    const creditTable = database.tables.find(t => t.type === 'S');
    if (!creditTable) return;

    const headers = creditTable.header.split(';').filter(h => h.trim() !== '');
    const clientColumns = [];

    headers.forEach((header, index) => {
        const match = header.match(/Client (\d+)/i);
        if (match) {
            clientColumns.push({ index, clientId: match[1], headerName: header });
        }
    });

    clientColumns.forEach(col => {
        database.clientCreditData.set(col.clientId, {
            credits: [],
            zeroCreditDates: [],
            totalCredit: 0,
            count: 0,
            maxCredit: 0
        });
    });

    creditTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];

        clientColumns.forEach(col => {
            const creditValue = parseFloat(cells[col.index]);
            if (!isNaN(creditValue)) {
                const clientData = database.clientCreditData.get(col.clientId);
                clientData.credits.push({ date, value: creditValue });
                clientData.totalCredit += creditValue;
                clientData.count++;
                if (creditValue > clientData.maxCredit) clientData.maxCredit = creditValue;
                if (creditValue === 0) clientData.zeroCreditDates.push(date);
            }
        });
    });

    database.clientCreditData.forEach((data, clientId) => {
        data.averageCredit = data.count > 0 ? data.totalCredit / data.count : 0;
        data.zeroCreditDates.sort();
    });

    database.commercialData = {
        clientCount: database.clientCreditData.size,
        clients: Array.from(database.clientCreditData.entries()).map(([id, data]) => ({ id, ...data }))
    };
}


export function analyzeRechargeData(data) {
    const clients = {};
    
    // Valeurs possibles de crédit
    const creditValues = [0, 1, 2, 3, 7, 30];
    
    // Filtrer les lignes valides
    const validRows = data.filter(row => 
        row['Numero Client'] && 
        row['Numero Client'] !== '0' && 
        row.Credit && 
        row.Message === 'Recharge Reussie'
    );
    
    validRows.forEach(row => {
        const clientId = row['Numero Client'];
        const credit = parseFloat(row.Credit);
        const forfait = parseFloat(row.Forfait);
        const date = row.TimeStamp;
        const codeCrypte = row['Code crypte'];
        const idRecharge = row['ID recharge'];
        
        if (!clients[clientId]) {
            clients[clientId] = {
                id: clientId,
                totalRecharges: 0,
                credits: {},
                forfaits: [],
                recharges: [],
                creditFrequency: {},
                forfaitChanges: [],
                codesUtilises: new Set(),
                dernierCredit: null,
                dernierForfait: null,
                dateDerniereRecharge: null
            };
            
            // Initialiser les compteurs de crédit
            creditValues.forEach(val => {
                clients[clientId].credits[val] = 0;
                clients[clientId].creditFrequency[val] = 0;
            });
        }
        
        // Compter les recharges par type de crédit
        if (clients[clientId].credits.hasOwnProperty(credit)) {
            clients[clientId].credits[credit]++;
        }
        
        // Enregistrer la recharge
        clients[clientId].recharges.push({
            date,
            credit,
            forfait,
            idRecharge,
            codeCrypte
        });
        
        // Détection changement de forfait
        const dernierForfait = clients[clientId].dernierForfait;
        if (dernierForfait !== null && dernierForfait !== forfait) {
            clients[clientId].forfaitChanges.push({
                date: date,
                ancienForfait: dernierForfait,
                nouveauForfait: forfait
            });
        }
        
        clients[clientId].dernierForfait = forfait;
        clients[clientId].dernierCredit = credit;
        clients[clientId].dateDerniereRecharge = date;
        clients[clientId].codesUtilises.add(codeCrypte);
        clients[clientId].totalRecharges++;
    });
    
    // Calculer les pourcentages pour chaque client
    Object.keys(clients).forEach(clientId => {
        const client = clients[clientId];
        client.recharges.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calcul des fréquences en pourcentage
        creditValues.forEach(val => {
            client.creditFrequency[val] = client.totalRecharges > 0 
                ? (client.credits[val] / client.totalRecharges * 100).toFixed(1)
                : 0;
        });
        
        // Déterminer le crédit préféré
        let maxCount = 0;
        let preferredCredit = null;
        creditValues.forEach(val => {
            if (client.credits[val] > maxCount) {
                maxCount = client.credits[val];
                preferredCredit = val;
            }
        });
        client.preferredCredit = preferredCredit;
        client.preferredCreditPercentage = client.creditFrequency[preferredCredit];
        
        // Déterminer la stabilité du forfait
        client.hasForfaitChange = client.forfaitChanges.length > 0;
        client.forfaitActuel = client.dernierForfait;
        client.forfaitInitial = client.recharges.length > 0 ? client.recharges[0].forfait : null;
        client.isStable = client.forfaitInitial === client.forfaitActuel;
        
        // Statistiques supplémentaires
        client.creditMoyen = (client.recharges.reduce((sum, r) => sum + r.credit, 0) / client.totalRecharges).toFixed(2);
        client.creditTotal = client.recharges.reduce((sum, r) => sum + r.credit, 0);
        client.codesUniques = client.codesUtilises.size;
        
        // Période d'activité
        if (client.recharges.length > 0) {
            client.premiereRecharge = client.recharges[0].date;
            client.derniereRecharge = client.recharges[client.recharges.length - 1].date;
        }
    });
    
    return {
        clients: Object.values(clients),
        totalClients: Object.keys(clients).length,
        totalRecharges: validRows.length,
        creditValues: creditValues
    };
}

export function getClientStats(client) {
    return {
        id: client.id,
        totalRecharges: client.totalRecharges,
        creditMoyen: client.creditMoyen,
        creditTotal: client.creditTotal,
        preferredCredit: client.preferredCredit,
        preferredPercentage: client.preferredCreditPercentage,
        forfaitActuel: client.forfaitActuel,
        forfaitInitial: client.forfaitInitial,
        hasForfaitChange: client.hasForfaitChange,
        forfaitChanges: client.forfaitChanges,
        isStable: client.isStable,
        codesUniques: client.codesUniques
    };
}

export function getGlobalStats(analyticsData) {
    const clients = analyticsData.clients;
    
    // Statistiques globales
    const clientsWithChanges = clients.filter(c => c.hasForfaitChange).length;
    const totalChanges = clients.reduce((sum, c) => sum + c.forfaitChanges.length, 0);
    
    // Répartition des forfaits actuels
    const forfaitRepartition = {};
    clients.forEach(c => {
        const f = c.forfaitActuel;
        forfaitRepartition[f] = (forfaitRepartition[f] || 0) + 1;
    });
    
    // Répartition des crédits préférés
    const creditRepartition = {};
    clients.forEach(c => {
        const pref = c.preferredCredit;
        creditRepartition[pref] = (creditRepartition[pref] || 0) + 1;
    });
    
    return {
        totalClients: clients.length,
        totalRecharges: analyticsData.totalRecharges,
        clientsWithChanges,
        totalChanges,
        forfaitRepartition,
        creditRepartition,
        pourcentageStables: ((clients.length - clientsWithChanges) / clients.length * 100).toFixed(1)
    };
}

// arduinoAnalytics.js
export function rechargeAnalytics(rechargeData) {
    // Structure pour stocker les analyses par client
    const clientAnalytics = {};
    
    // 1. Filtrer et traiter les données
    const validRecharges = rechargeData.filter(row => 
        row['Numero Client'] !== '0' && 
        row['Message'] === 'Recharge Reussie'
    );
    
    // 2. Analyser chaque recharge
    validRecharges.forEach(recharge => {
        const clientId = recharge['Numero Client'];
        const credit = parseInt(recharge['Credit']);
        const forfait = parseInt(recharge['Forfait']);
        const date = new Date(recharge['TimeStamp']);
        
        if (!clientAnalytics[clientId]) {
            clientAnalytics[clientId] = {
                clientId: clientId,
                totalRecharges: 0,
                creditTypes: {},
                forfaitHistory: [],
                currentForfait: forfait,
                forfaitChangeDate: null,
                firstForfait: forfait,
                lastForfait: forfait
            };
        }
        
        const client = clientAnalytics[clientId];
        client.totalRecharges++;
        client.creditTypes[credit] = (client.creditTypes[credit] || 0) + 1;
        
        // Historique des forfaits
        client.forfaitHistory.push({
            date: date,
            forfait: forfait,
            credit: credit
        });
        
        // Mettre à jour le dernier forfait
        client.lastForfait = forfait;
        
        // Détecter changement de forfait
        if (client.currentForfait !== forfait && !client.forfaitChangeDate) {
            client.forfaitChangeDate = date;
            client.ancienForfait = client.currentForfait;
            client.nouveauForfait = forfait;
        }
    });
    
    // 3. Calculer les pourcentages
    Object.values(clientAnalytics).forEach(client => {
        // Trier par date
        client.forfaitHistory.sort((a, b) => a.date - b.date);
        
        // Calculer les pourcentages
        const percentages = {};
        Object.entries(client.creditTypes).forEach(([credit, count]) => {
            percentages[credit] = ((count / client.totalRecharges) * 100).toFixed(1);
        });
        client.creditPercentages = percentages;
        
        // Crédit préféré
        let maxCount = 0;
        Object.entries(client.creditTypes).forEach(([credit, count]) => {
            if (count > maxCount) {
                maxCount = count;
                client.preferredCredit = credit;
                client.preferredPercentage = ((maxCount / client.totalRecharges) * 100).toFixed(1);
            }
        });
        
        // Premier forfait
        client.firstForfait = client.forfaitHistory[0]?.forfait;
        
        // Vérifier s'il y a eu changement
        client.hasForfaitChange = client.forfaitHistory.length > 1 && 
            new Set(client.forfaitHistory.map(f => f.forfait)).size > 1;
    });
    
    return {
        clients: Object.values(clientAnalytics),
        summary: {
            totalClients: Object.keys(clientAnalytics).length,
            totalRecharges: validRecharges.length,
            clientsWithChange: Object.values(clientAnalytics).filter(c => c.hasForfaitChange).length
        }
    };
}

export function buildEventMap() {
    database.eventMap.clear();
    database.cellStateMap.clear();

    const eventTable = database.tables.find(t => t.type === 'E');
    if (!eventTable) {
        console.log("ℹ️ Aucune table d'événements trouvée");
        return;
    }

    eventTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const eventType = cells[2];
        const clientId = cells[3];
        const valeur = cells[4];
        const nbDep = parseInt(cells[5]) || 1;

        const key = `${date}_${clientId}`;
        database.eventMap.set(key, { type: eventType, valeur, nbDep, timestamp, clientId, date });
    });
}