// analytics/commercialAnalytics.js
import { database } from '../arduinoCore.js';


export function analyzeCommercialData() {
    database.clientCreditData.clear();

    const creditTable = database.tables.find(t => t.type === 'S');
    if (!creditTable) return;

    const headers = creditTable.header.split(';').filter(h => h.trim() !== '');
    const clientColumns = [];

    headers.forEach((header, index) => {
        const match = header.match(/Client (\d+)/i);
        if (match) {
            clientColumns.push({ index, clientId: match[1] });
        }
    });

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

    database.clientCreditData.forEach(client => {
        client.averageCredit = client.count > 0 ? client.totalCredit / client.count : 0;
        client.zeroCreditDates.sort();
        client.zeroCreditPercentage = client.count > 0 ? ((client.zeroCreditDates.length / client.count) * 100) : 0;
        client.isOftenEmpty = client.zeroCreditPercentage >= 30;
        client.maxConsecutiveZeroDays = computeMaxConsecutiveDays(client.zeroCreditDates);
    });

    database.commercialData = {
        clients: Array.from(database.clientCreditData.values()),
        totalClients: database.clientCreditData.size
    };
}

// Fonction interne
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

            if (hasRecharge) {
                client.zeroCreditAfterRecharge++;
            }

            const key = `${date}_${client.id}`;
            if (eventMap.has(key)) {
                client.zeroCreditWithEvent++;
            }
        });

        client.zeroRechargeCorrelation =
            client.zeroCreditDates.length > 0
                ? client.zeroCreditAfterRecharge / client.zeroCreditDates.length
                : 0;

        client.zeroEventCorrelation =
            client.zeroCreditDates.length > 0
                ? client.zeroCreditWithEvent / client.zeroCreditDates.length
                : 0;

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

export function analyzeRechargeData(data) {
    const clients = {};
    const creditValues = [0, 1, 2, 3, 7, 30];

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

            creditValues.forEach(val => {
                clients[clientId].credits[val] = 0;
                clients[clientId].creditFrequency[val] = 0;
            });
        }

        if (clients[clientId].credits.hasOwnProperty(credit)) {
            clients[clientId].credits[credit]++;
        }

        clients[clientId].recharges.push({
            date,
            credit,
            forfait,
            idRecharge,
            codeCrypte
        });

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

    Object.keys(clients).forEach(clientId => {
        const client = clients[clientId];
        client.recharges.sort((a, b) => new Date(a.date) - new Date(b.date));

        creditValues.forEach(val => {
            if (!client.credits.hasOwnProperty(val)) client.credits[val] = 0;
        });

        const percentages = {};
        creditValues.forEach(val => {
            const pct = client.totalRecharges > 0 ? (client.credits[val] / client.totalRecharges * 100) : 0;
            percentages[val] = parseFloat(pct.toFixed(1));
            client.creditFrequency[val] = percentages[val];
        });
        client.creditPercentages = percentages;

        let maxCount = -1;
        let preferredCredit = null;
        creditValues.forEach(val => {
            if (client.credits[val] > maxCount) {
                maxCount = client.credits[val];
                preferredCredit = val;
            }
        });
        client.preferredCredit = preferredCredit;
        client.preferredCreditPercentage = percentages[preferredCredit] ?? 0;

        client.hasForfaitChange = Array.isArray(client.forfaitChanges) && client.forfaitChanges.length > 0;
        client.forfaitActuel = client.dernierForfait;
        client.forfaitInitial = client.recharges.length > 0 ? client.recharges[0].forfait : null;
        client.isStable = client.forfaitInitial === client.forfaitActuel;

        const totalCredit = client.recharges.reduce((sum, r) => sum + (parseFloat(r.credit) || 0), 0);
        const avgCredit = client.totalRecharges > 0 ? totalCredit / client.totalRecharges : 0;
        client.creditTotal = parseFloat(totalCredit.toFixed(2));
        client.creditMean = parseFloat(avgCredit.toFixed(2));
        client.creditMoyen = client.creditMean.toFixed(2);

        client.codesUniques = client.codesUtilises.size;

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

    const clientsWithChanges = clients.filter(c => c.hasForfaitChange).length;
    const totalChanges = clients.reduce((sum, c) => sum + c.forfaitChanges.length, 0);

    const forfaitRepartition = {};
    clients.forEach(c => {
        const f = c.forfaitActuel;
        forfaitRepartition[f] = (forfaitRepartition[f] || 0) + 1;
    });

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
/*
export function rechargeAnalytics(rechargeData) {
    const clientAnalytics = {};

    const validRecharges = rechargeData.filter(row => 
        row['Numero Client'] !== '0' && 
        row['Message'] === 'Recharge Reussie'
    );

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

        client.forfaitHistory.push({
            date: date,
            forfait: forfait,
            credit: credit
        });

        client.lastForfait = forfait;

        if (client.currentForfait !== forfait && !client.forfaitChangeDate) {
            client.forfaitChangeDate = date;
            client.ancienForfait = client.currentForfait;
            client.nouveauForfait = forfait;
        }
    });

    Object.values(clientAnalytics).forEach(client => {
        client.forfaitHistory.sort((a, b) => a.date - b.date);

        const percentages = {};
        Object.entries(client.creditTypes).forEach(([credit, count]) => {
            percentages[credit] = ((count / client.totalRecharges) * 100).toFixed(1);
        });
        client.creditPercentages = percentages;

        let maxCount = 0;
        Object.entries(client.creditTypes).forEach(([credit, count]) => {
            if (count > maxCount) {
                maxCount = count;
                client.preferredCredit = credit;
                client.preferredPercentage = ((maxCount / client.totalRecharges) * 100).toFixed(1);
            }
        });

        client.firstForfait = client.forfaitHistory[0]?.forfait;
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
*/