// arduinoEvents.js
import { database } from './arduinoCore.js';
import { EVENT_COLORS } from './arduinoConstants.js';

export function getEventColor(eventType) {
    return EVENT_COLORS[eventType] || '#999';
}

export function handleCellClick(tableId, clientId, timestamp, cellElement, originalValue) {
    const date = timestamp.split(' ')[0];
    const key = `${date}_${clientId}`;
    const event = database.eventMap.get(key);
    
    if (!event) {
        console.log(`⚠️ Aucun événement pour ${key}`);
        return;
    }

    const cellKey = `${tableId}_${clientId}_${timestamp}`;
    let currentState = database.cellStateMap.get(cellKey) || 0;
    currentState = (currentState + 1) % 3;
    database.cellStateMap.set(cellKey, currentState);

    let displayText = '';
    let className = 'cell-value';

    switch (currentState) {
        case 0:
            displayText = originalValue;
            className += ' cell-mode-value';
            break;
        case 1:
            displayText = event.type;
            className += ` cell-mode-event event-${event.type.replace(' ', '-')}`;
            break;
        case 2:
            displayText = `${event.nbDep} dépassement${event.nbDep > 1 ? 's' : ''}`;
            className += ' cell-mode-nbdep';
            break;
    }

    cellElement.textContent = displayText;
    cellElement.className = className;
}