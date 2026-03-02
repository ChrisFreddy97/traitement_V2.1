/**
 * creditAnalyzer.js
 * ================
 * Wrapper de compatibilité réexportant les fonctions
 * de analytics/interpretationAnalytics.js
 */

export {
    analyzeZeroCreditSequences,
    analyzeCreditZeroCauses,
    generateSequenceRecommendation,
    formatSequenceForDisplay,
    isRecentDate
} from './analytics/interpretationAnalytics.js';

