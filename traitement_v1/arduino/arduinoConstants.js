// arduinoConstants.js

// ===========================================
// TYPES DE TABLES
// ===========================================
export const TABLE_TYPES = {
    'I': { name: 'Intensité', color: '#4CAF50', icon: '⚡', tab: 'Technique' },
    'T': { name: 'Tension', color: '#9C27B0', icon: '🔋', tab: 'Technique' },
    'R': { name: 'Recharges', color: '#FF9800', icon: '💳', tab: 'Commercial' },
    'S': { name: 'Évolution crédit', color: '#2196F3', icon: '💰', tab: 'Commercial' },
    'E': { name: 'Événements', color: '#F44336', icon: '🔔', tab: 'Evenement' }
};

// ===========================================
// ÉVÉNEMENTS
// ===========================================
export const EVENT_TYPES = ['SuspendP', 'SuspendE', 'Surcharge', 'Delestage Partiel', 'Delestage Total'];

export const EVENT_COLORS = {
    'SuspendP': '#ff9800',
    'SuspendE': '#9c27b0',
    'Surcharge': '#f44336',
    'Delestage Partiel': '#ffeb3b',
    'Delestage Total': '#000000'
};

// ===========================================
// PAGINATION
// ===========================================
export const ROWS_PER_PAGE = 50;

// ===========================================
// NORMES DE TENSION
// ===========================================
export const VOLTAGE_NORMS = {
    '24V': { min: 22, ideal: '24-29', max: 31, alert: '3V / Heure' },
    '12V': { min: 11, ideal: '12-14.5', max: 15, alert: '1.5V / Heure' }
};

// ===========================================
// FORFAITS - Noms commerciaux
// ===========================================
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

// ===========================================
// FORFAITS - Limites de consommation
// ===========================================
export const FORFAIT_LIMITS = {
    "ECO": { max: 50, heures: 5, tolerance: 15 }, // 15% de tolérance
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

// ===========================================
// FONCTIONS UTILITAIRES POUR LES FORFAITS
// ===========================================

/**
 * Retourne le nom commercial d'un forfait à partir de son ID
 */
export function getForfaitName(forfaitId) {
    return FORFAIT_NAMES[forfaitId] || `Forfait ${forfaitId}`;
}

/**
 * Retourne les limites d'un forfait à partir de son nom
 */
export function getForfaitLimits(forfaitName) {
    return FORFAIT_LIMITS[forfaitName] || null;
}

/**
 * Évalue le statut de consommation d'un client
 * Retourne { status, color, message }
 */
export function evaluateConsumptionStatus(forfaitId, consommation) {
    const forfaitName = getForfaitName(forfaitId);
    const limits = FORFAIT_LIMITS[forfaitName];
    
    if (!limits) {
        return {
            status: 'unknown',
            color: '#999',
            message: 'Forfait non référencé'
        };
    }
    
    const ratio = (consommation / limits.max) * 100;
    
    if (consommation > limits.max) {
        return {
            status: 'depassement',
            color: '#f44336',
            message: `🔴 Dépassement (${ratio.toFixed(0)}% de la limite)`
        };
    } else if (consommation > limits.max * (1 - limits.tolerance/100)) {
        return {
            status: 'limite',
            color: '#ff9800',
            message: `🟠 Limite (${ratio.toFixed(0)}% de la limite)`
        };
    } else {
        return {
            status: 'ok',
            color: '#4CAF50',
            message: `✅ OK (${ratio.toFixed(0)}% de la limite)`
        };
    }
}