/**
 * energyCalculator.js
 * ===================
 * Wrapper for backward compatibility
 * All energy analysis has been consolidated into energyAnalytics.js
 */

export {
    analyzeEnergyData,
    getEnergyStats,
    getEnergyByDate,
    getEnergyByClient,
    getDailyEnergy,
    getEnergyForClient
} from './energyAnalytics.js';