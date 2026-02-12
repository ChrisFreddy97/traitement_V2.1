// arduinoConstants.js
export const TABLE_TYPES = {
    'I': { name: 'Intensité', color: '#4CAF50', icon: '⚡', tab: 'Technique' },
    'T': { name: 'Tension', color: '#9C27B0', icon: '🔋', tab: 'Technique' },
    'R': { name: 'Recharges', color: '#FF9800', icon: '💳', tab: 'Commercial' },
    'S': { name: 'Évolution crédit', color: '#2196F3', icon: '💰', tab: 'Commercial' },
    'E': { name: 'Événements', color: '#F44336', icon: '🔔', tab: 'Evenement' }
};

export const EVENT_TYPES = ['SuspendP', 'SuspendE', 'Surcharge', 'Delestage Partiel', 'Delestage Total'];

export const ROWS_PER_PAGE = 50;

export const VOLTAGE_NORMS = {
    '24V': { min: 22, ideal: '24-29', max: 31, alert: '3V / Heure' },
    '12V': { min: 11, ideal: '12-14.5', max: 15, alert: '1.5V / Heure' }
};

export const EVENT_COLORS = {
    'SuspendP': '#ff9800',
    'SuspendE': '#9c27b0',
    'Surcharge': '#f44336',
    'Delestage Partiel': '#ffeb3b',
    'Delestage Total': '#000000'
};