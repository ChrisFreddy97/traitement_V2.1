// analytics/eventAnalytics.js
import { database } from '../arduinoCore.js';

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