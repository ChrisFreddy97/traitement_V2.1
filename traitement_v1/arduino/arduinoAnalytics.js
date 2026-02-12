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