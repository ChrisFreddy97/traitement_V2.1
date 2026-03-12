// arduinoConstants.js
// ===========================================
// CONFIGURATION PRINCIPALE
// ===========================================

// Types de tables
export const TABLE_TYPES = {
    'I': { name: 'Intensité', color: '#4CAF50', icon: '⚡', tab: 'Technique' },
    'T': { name: 'Tension', color: '#9C27B0', icon: '🔋', tab: 'Technique' },
    'R': { name: 'Recharges', color: '#FF9800', icon: '💳', tab: 'Commercial' },
    'S': { name: 'Évolution crédit', color: '#2196F3', icon: '💰', tab: 'Commercial' },
    'E': { name: 'Événements', color: '#F44336', icon: '🔔', tab: 'Evenement' }
};

// Normes de tension
export const VOLTAGE_NORMS = {
    '24V': { min: 22, ideal: '24-29', max: 31, variationSeuil: 3.5, alert: '3V / Heure' },
    '12V': { min: 11, ideal: '12-14.5', max: 15, variationSeuil: 1.5, alert: '1.5V / Heure' }
};

// Seuils pour tension haute
export const HIGH_VOLTAGE_THRESHOLD = {
    '24V': 28,
    '12V': 14
};

// Événements
export const EVENT_TYPES = ['SuspendP', 'SuspendE', 'Surcharge', 'Delestage Partiel', 'Delestage Total'];
export const EVENT_COLORS = {
    'SuspendP': '#ff9800',
    'SuspendE': '#9c27b0',
    'Surcharge': '#f44336',
    'Delestage Partiel': '#ffeb3b',
    'Delestage Total': '#000000'
};

// Forfaits
export const FORFAIT_NAMES = {
    1: "ECO",
    2: "ECLAIRAGE",
    3: "ECLAIRAGE +",
    4: "MULTIMEDIA",
    5: "MULTIMEDIA +",
    6: "PRENIUM",
    7: "Eclairage + PREF",
    8: "Eclairage Public 5h",
    9: "Eclairage Public Pref",
    12: "CONGEL",
    14: "FRIGO",
    16: "CSB",
    17: "CSB Congel",
    32: "CONGEL -5°C",
    34: "CONGEL -10°C"
};

export const FORFAIT_LIMITS = {
    "ECO": { max: 50, heures: 5, tolerance: 15 },
    "ECLAIRAGE": { max: 90, heures: 5, tolerance: 15 },
    "ECLAIRAGE +": { max: 150, heures: 5, tolerance: 15 },
    "MULTIMEDIA": { max: 210, heures: 5, tolerance: 15 },
    "MULTIMEDIA +": { max: 210, heures: 5, tolerance: 15 },
    "Eclairage Public 5h": { max: 150, heures: 5, tolerance: 15 },
    "Eclairage Public Pref": { max: 150, heures: 11, tolerance: 15 },
    "Eclairage + PREF": { max: 150, heures: 11, tolerance: 15 },
    "CONGEL": { max: 1250, heures: 24, tolerance: 15 },
    "CONGEL -5°C": { max: 1250, heures: 24, tolerance: 15 },
    "CONGEL -10°C": { max: 1250, heures: 24, tolerance: 15 },
    "FRIGO": { max: 500, heures: 24, tolerance: 15 },
    "PRENIUM": { max: 500, heures: 24, tolerance: 15 },
    "CSB": { max: 1250, heures: 24, tolerance: 15 },
    "CSB Congel": { max: 1250, heures: 24, tolerance: 15 }
};

// Seuils de consommation (pour I-1 commercial)
export const CONSUMPTION_THRESHOLDS = {
    NORMAL_MAX: 90,        // 90% du forfait
    TOLERANCE_MAX: 114,     // 100% + 14% de tolérance
    TOLERANCE_RATE: 14      // 14% de tolérance
};

// Pagination
export const ROWS_PER_PAGE = 50;

// ===========================================
// FONCTIONS UTILITAIRES
// ===========================================

export function getForfaitName(forfaitId) {
    return FORFAIT_NAMES[forfaitId] || `Forfait ${forfaitId}`;
}

export function getForfaitLimits(forfaitName) {
    return FORFAIT_LIMITS[forfaitName] || null;
}

export function getConsumptionStatus(consumption, maxLimit) {
    if (!maxLimit) return { status: 'unknown', color: '#999', label: 'Inconnu' };
    
    const ratio = (consumption / maxLimit) * 100;
    
    if (ratio > CONSUMPTION_THRESHOLDS.TOLERANCE_MAX) {
        return { 
            status: 'depasse', 
            color: '#f44336', 
            label: '🔴 Dépassement critique',
            percent: ratio.toFixed(1)
        };
    } else if (ratio > CONSUMPTION_THRESHOLDS.NORMAL_MAX) {
        return { 
            status: 'tolerance', 
            color: '#ff9800', 
            label: '🟠 Zone tolérance',
            percent: ratio.toFixed(1)
        };
    } else {
        return { 
            status: 'normal', 
            color: '#4CAF50', 
            label: '✅ Normal',
            percent: ratio.toFixed(1)
        };
    }
}