/**
 * analytics/interpretationAnalytics.js (NOUVEAU)
 * ================================================
 * Rassemble les logiques d'interprétation et d'analyse des crédits
 * Consolidé depuis creditAnalyzer.js et futures analyses
 */

import { database } from '../arduinoCore.js';

/**
 * Analyser les séquences de jours sans crédit
 * @param {Array} zeroCreditDates - Array de dates
 * @returns {Array} Séquences groupées
 */
export function analyzeZeroCreditSequences(zeroCreditDates) {
    if (!Array.isArray(zeroCreditDates) || zeroCreditDates.length === 0) {
        return [];
    }

    const sortedDates = zeroCreditDates.slice().sort();
    const sequences = [];
    let currentSequence = [sortedDates[0]];

    for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(sortedDates[i]);
        const dayDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

        if (dayDiff === 1) {
            currentSequence.push(sortedDates[i]);
        } else {
            sequences.push({
                startDate: currentSequence[0],
                endDate: currentSequence[currentSequence.length - 1],
                duration: currentSequence.length,
                dates: currentSequence,
                isRecent: isRecentDate(currentSequence[currentSequence.length - 1])
            });
            currentSequence = [sortedDates[i]];
        }
    }

    if (currentSequence.length > 0) {
        sequences.push({
            startDate: currentSequence[0],
            endDate: currentSequence[currentSequence.length - 1],
            duration: currentSequence.length,
            dates: currentSequence,
            isRecent: isRecentDate(currentSequence[currentSequence.length - 1])
        });
    }

    return sequences.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
}

/**
 * Identifier la CAUSE CERTAINE du crédit zéro
 */
export function analyzeCreditZeroCauses(client, sequenceDates) {
    if (!client || !sequenceDates || sequenceDates.length === 0) {
        return {
            mainCause: 'system',
            confidence: 0.5,
            evidence: 'Données insuffisantes'
        };
    }

    const seqStart = sequenceDates[0];
    const seqEnd = sequenceDates[sequenceDates.length - 1];
    const seqLength = sequenceDates.length;

    // Événement technique?
    const technicalEvents = (client.events || []).filter(e => 
        e.date >= seqStart && e.date <= seqEnd &&
        (e.type.includes('Suspend') || e.type.includes('Delest') || 
         e.type.includes('Maintenance') || e.type.includes('Coupure') || e.type.includes('Défaut'))
    );

    if (technicalEvents.length > 0) {
        return {
            mainCause: 'technicalEvent',
            confidence: 0.95,
            evidence: `${technicalEvents.length} interruption(s) technique(s)`
        };
    }

    // Pas de recharge?
    const rechargesInSeq = (client.recharges || []).filter(r =>
        r.date >= seqStart && r.date <= seqEnd
    );
    const rechargesAfter = (client.recharges || []).filter(r =>
        new Date(r.date) > new Date(seqEnd)
    );

    if (rechargesInSeq.length === 0 && rechargesAfter.length > 0) {
        return {
            mainCause: 'noRecharge',
            confidence: 0.95,
            evidence: `Pas de recharge durant la séquence`
        };
    }

    // Consommation élevée?
    const consumptionInSeq = (client.consommation?.journaliere || []).filter(c =>
        sequenceDates.includes(c.date)
    );

    if (consumptionInSeq.length > 0) {
        const totalConsumed = consumptionInSeq.reduce((s, c) => s + c.valeur, 0);
        const avgDaily = totalConsumed / consumptionInSeq.length;
        const forfaitMax = client.consommation?.max || 0;

        if (forfaitMax > 0 && avgDaily > forfaitMax * 0.8) {
            return {
                mainCause: 'highConsumption',
                confidence: 0.9,
                evidence: `Consommation: ${avgDaily.toFixed(0)} Wh/jour`
            };
        }
    }

    //  Forfait insuffisant?
    const allConsumption = (client.consommation?.journaliere || []);
    if (allConsumption.length > 0 && client.consommation?.max) {
        const avgAllTime = allConsumption.reduce((s, c) => s + c.valeur, 0) / allConsumption.length;
        const forfaitMax = client.consommation.max;
        const exceedPercent = ((avgAllTime / forfaitMax) - 1) * 100;

        if (exceedPercent > 20) {
            return {
                mainCause: 'insufficientForfait',
                confidence: 0.85,
                evidence: `Forfait insuffisant: +${exceedPercent.toFixed(0)}%`
            };
        }
    }

    // Recharge échouée?
    const failedRecharges = (client.failedRecharges || []).filter(r =>
        r.date >= seqStart && r.date <= seqEnd
    );

    if (failedRecharges.length > 0) {
        return {
            mainCause: 'payment',
            confidence: 0.88,
            evidence: `${failedRecharges.length} recharge(s) échouée(s)`
        };
    }

    // Surcharge anormale?
    if (consumptionInSeq.length > 0) {
        const maxDailyConsumption = Math.max(...consumptionInSeq.map(c => c.valeur));
        const avgDaily = consumptionInSeq.reduce((s, c) => s + c.valeur, 0) / consumptionInSeq.length;

        if (maxDailyConsumption > avgDaily * 3) {
            return {
                mainCause: 'overload',
                confidence: 0.80,
                evidence: `Pic anormal: ${maxDailyConsumption.toFixed(0)} Wh`
            };
        }
    }

    // Séquence très longue?
    if (seqLength > 14) {
        return {
            mainCause: 'system',
            confidence: 0.72,
            evidence: `Séquence anormale: ${seqLength} jours`
        };
    }

    // Compte inactif?
    if ((client.recharges || []).length === 0 && seqLength === 1) {
        return {
            mainCause: 'noActivity',
            confidence: 0.60,
            evidence: `Compte inactif`
        };
    }

    // Fallback
    return {
        mainCause: 'unknown',
        confidence: 0.40,
        evidence: 'Cause non déterminée'
    };
}

/**
 * Générer une recommandation d'action
 */
export function generateSequenceRecommendation(client, sequence, causeResult) {
    const cause = causeResult.mainCause || 'noRecharge';

    const recommendations = {
        noRecharge: {
            priority: sequence.duration > 3 ? 'urgente' : 'haute',
            action: '📞 Appeler client',
            message: `N'a pas recharger depuis ${sequence.duration}j.`
        },
        highConsumption: {
            priority: 'haute',
            action: '💬 Proposer upgrade',
            message: `Consommation > forfait.`
        },
        technicalEvent: {
            priority: 'moyenne',
            action: '⚡ Escalader tech',
            message: `Interruption technique.`
        },
        insufficientForfait: {
            priority: 'haute',
            action: '📈 Upgrade forfait',
            message: `Forfait insuffisant.`
        },
        payment: {
            priority: 'haute',
            action: '💳 Vérifier paiement',
            message: `Recharges échouées.`
        },
        overload: {
            priority: 'moyenne',
            action: '⚠️ Vérifier équipement',
            message: `Consommation anormale.`
        },
        system: {
            priority: 'basse',
            action: '🔧 À investiguer',
            message: `Anomalie système.`
        },
        noActivity: {
            priority: 'basse',
            action: '📱 Relancer',
            message: `Compte inactif.`
        },
        unknown: {
            priority: 'moyenne',
            action: '🔍 Analyser',
            message: `Cause incertaine.`
        }
    };

    return recommendations[cause] || recommendations.unknown;
}

/**
 * Formatter une séquence pour affichage
 */
export function formatSequenceForDisplay(sequence, causeResult) {
    const duration = sequence.duration;
    let severity = 'info';

    if (duration >= 5) severity = 'critical';
    else if (duration >= 3) severity = 'warning';

    const durationLabel = duration === 1 ? '1 jour' : `${duration} jours`;

    return {
        label: durationLabel,
        severity: severity,
        isRecent: sequence.isRecent
    };
}

/**
 * Vérifier si une date est récente (< 7 jours)
 */
export function isRecentDate(dateStr) {
    try {
        const date = new Date(dateStr);
        const today = new Date();
        const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
        return diffDays < 7;
    } catch (e) {
        return false;
    }
}
