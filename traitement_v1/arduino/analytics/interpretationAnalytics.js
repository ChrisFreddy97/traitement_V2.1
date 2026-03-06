/**
 * analytics/interpretationAnalytics.js
 * =====================================
 * Analyse des comportements clients
 */

import { database } from '../arduinoCore.js';

// ===========================================
// DÉTECTION DES CLIENTS ABSENTS/INACTIFS
// ===========================================

/**
 * Analyser le profil d'absence d'un client
 */
function analyzeAbsenceProfile(client) {
    const result = {
        isAbsent: false,
        type: 'active',
        confidence: 0,
        reasons: []
    };
    
    const aDesRecharges = (client.recharges?.length > 0);
    const aDesConso = (client.consommation?.journaliere?.length > 0);
    const consoMoyenne = client.consommation?.moyenne || 0;
    const consoMax = client.consommation?.max || 0;
    const joursSansConso = (client.consommation?.journaliere || []).filter(c => c.valeur < 0.1).length;
    const totalJours = client.consommation?.journaliere?.length || 1;
    const ratioSansConso = joursSansConso / totalJours;
    
    // Récupérer les dates des dernières activités
    const dernierRecharge = client.recharges?.slice(-1)[0]?.date;
    const derniereConso = client.consommation?.journaliere?.slice(-1)[0]?.date;
    const aujourdhui = new Date().toISOString().split('T')[0];
    
    // Calculer l'écart en jours depuis dernière activité
    let joursDepuisDerniereActivite = Infinity;
    if (dernierRecharge) {
        const diff = Math.floor((new Date(aujourdhui) - new Date(dernierRecharge)) / (1000 * 60 * 60 * 24));
        joursDepuisDerniereActivite = Math.min(joursDepuisDerniereActivite, diff);
    }
    if (derniereConso) {
        const diff = Math.floor((new Date(aujourdhui) - new Date(derniereConso)) / (1000 * 60 * 60 * 24));
        joursDepuisDerniereActivite = Math.min(joursDepuisDerniereActivite, diff);
    }
    
    // CAS 1: Vacances (courte durée)
    if (joursDepuisDerniereActivite > 7 && joursDepuisDerniereActivite < 30) {
        result.isAbsent = true;
        result.type = 'vacances';
        result.confidence = 0.7;
        result.reasons.push(`Dernière activité il y a ${joursDepuisDerniereActivite} jours`);
        return result;
    }
    
    // CAS 2: Absence prolongée / Déménagement
    if (joursDepuisDerniereActivite >= 30) {
        result.isAbsent = true;
        result.type = 'abandon';
        result.confidence = 0.85;
        result.reasons.push(`Aucune activité depuis ${joursDepuisDerniereActivite} jours`);
        return result;
    }
    
    // CAS 3: Compteur fantôme (données techniques mais pas de conso)
    if (aDesConso && consoMoyenne === 0 && joursSansConso === totalJours) {
        result.isAbsent = true;
        result.type = 'compteur_muet';
        result.confidence = 0.9;
        result.reasons.push('Compteur fonctionnel mais consommation nulle');
        return result;
    }
    
    // CAS 4: Très faible utilisation (personne âgée, local occasionnel)
    if (aDesConso && consoMoyenne < 50 && consoMax < 100) {
        result.isAbsent = false;
        result.type = 'faible_utilisation';
        result.confidence = 0.8;
        result.reasons.push('Consommation anormalement faible');
        return result;
    }
    
    // CAS 5: Absence avec recharge (prépayé qui part en vacances)
    if (aDesRecharges && !aDesConso && joursDepuisDerniereActivite > 14) {
        result.isAbsent = true;
        result.type = 'vacances_prepaye';
        result.confidence = 0.75;
        result.reasons.push('Crédit rechargé mais non consommé');
        return result;
    }
    
    return result;
}

// ===========================================
// ANALYSE DES SÉQUENCES (INCHANGÉE)
// ===========================================

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
 * Vérifier si une date est récente (< 7 jours)
 */
function isRecentDate(dateStr) {
    try {
        const date = new Date(dateStr);
        const today = new Date();
        const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
        return diffDays < 7;
    } catch (e) {
        return false;
    }
}

/**
 * Récupérer les données techniques pour un client
 */
function getTechnicalContextForDates(sequenceDates) {
    if (!database.technicalData) {
        return {
            hasData: false,
            loadShedding: { partiel: 0, total: 0, jours: [] },
            highVoltage: [],
            variations: [],
            conformity: { pourcentage: 100 }
        };
    }

    const tech = database.technicalData;
    
    const loadSheddingJours = (tech.loadShedding?.jours || []).filter(j => 
        sequenceDates.includes(j)
    );
    
    const highVoltagePendant = (tech.highVoltage || []).filter(h => 
        sequenceDates.includes(h.date)
    );
    
    const variationsPendant = (tech.variations || []).filter(v => 
        sequenceDates.includes(v.date)
    );
    
    return {
        hasData: true,
        loadShedding: {
            partiel: tech.loadShedding?.partiel || 0,
            total: tech.loadShedding?.total || 0,
            jours: loadSheddingJours
        },
        highVoltage: highVoltagePendant,
        variations: variationsPendant,
        conformity: tech.conformity || { pourcentage: 100 },
        exceedances: tech.exceedances || { min: 0, max: 0, variation: 0 }
    };
}

// ===========================================
// ANALYSE DES CAUSES (AMÉLIORÉE)
// ===========================================

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

    // ===========================================
    // NIVEAU 1: ANALYSE DU PROFIL D'ABSENCE
    // ===========================================
    const absenceProfile = analyzeAbsenceProfile(client);
    
    if (absenceProfile.isAbsent) {
        return {
            mainCause: absenceProfile.type,
            confidence: absenceProfile.confidence,
            evidence: absenceProfile.reasons.join(' - ')
        };
    }

    // Contexte technique
    const techContext = getTechnicalContextForDates(sequenceDates);

    // ===========================================
    // NIVEAU 2: PROBLÈMES TECHNIQUES
    // ===========================================

    if (techContext.loadShedding.jours.length > 0) {
        return {
            mainCause: 'technicalEvent',
            confidence: 0.98,
            evidence: `Délestage pendant ${techContext.loadShedding.jours.length} jour(s)`
        };
    }

    const highVoltageCritique = techContext.highVoltage.filter(h => h.qualite === 'critique');
    if (highVoltageCritique.length > 0) {
        return {
            mainCause: 'technicalEvent',
            confidence: 0.97,
            evidence: `${highVoltageCritique.length} jour(s) sans haute tension`
        };
    }

    const variationsGraves = techContext.variations.filter(v => 
        v.variation > (database.technicalData?.variationsSeuil * 1.5 || 3)
    );
    if (variationsGraves.length > 0) {
        return {
            mainCause: 'technicalEvent',
            confidence: 0.95,
            evidence: `${variationsGraves.length} variation(s) brutale(s) de tension`
        };
    }

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

    if (techContext.conformity.pourcentage < 70) {
        return {
            mainCause: 'technicalEvent',
            confidence: 0.85,
            evidence: `Réseau instable - ${techContext.conformity.pourcentage}% de conformité`
        };
    }

    // ===========================================
    // NIVEAU 3: PROBLÈMES COMMERCIAUX
    // ===========================================

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

    if (seqLength > 14) {
        return {
            mainCause: 'system',
            confidence: 0.72,
            evidence: `Séquence anormale: ${seqLength} jours`
        };
    }

    if ((client.recharges || []).length === 0 && seqLength === 1) {
        return {
            mainCause: 'noActivity',
            confidence: 0.60,
            evidence: `Compte inactif`
        };
    }

    return {
        mainCause: 'unknown',
        confidence: 0.40,
        evidence: 'Cause non déterminée'
    };
}

// ===========================================
// RECOMMANDATIONS (AVEC PROFILS D'ABSENCE)
// ===========================================

export function generateSequenceRecommendation(client, sequence, causeResult) {
    const cause = causeResult?.mainCause || 'unknown';
    const techContext = getTechnicalContextForDates(sequence.dates);

    const recommendations = {
        // Profils d'absence
        vacances: {
            priority: 'info',
            action: '🏠 Vérifier absence',
            message: `Client可能在 en vacances (${causeResult?.evidence || 'inactivité'})`
        },
        vacances_prepaye: {
            priority: 'info',
            action: '🏠 Contacter client',
            message: `Crédit rechargé mais non consommé - Client可能在 en vacances`
        },
        abandon: {
            priority: 'moyenne',
            action: '🚚 Vérifier installation',
            message: `Aucune activité depuis longtemps - Client可能在 déménagé`
        },
        compteur_muet: {
            priority: 'haute',
            action: '🔧 Diagnostiquer compteur',
            message: `Compteur fonctionnel mais consommation nulle - Vérifier installation`
        },
        faible_utilisation: {
            priority: 'basse',
            action: '👴 Vérifier besoins',
            message: `Consommation anormalement faible - Adapter forfait si nécessaire`
        },
        
        // Causes techniques
        technicalEvent: {
            priority: (() => {
                if (techContext.loadShedding.jours.length > 0) return 'urgente';
                if (techContext.highVoltage.some(h => h.qualite === 'critique')) return 'haute';
                return 'moyenne';
            })(),
            action: (() => {
                if (techContext.loadShedding.jours.length > 0) return '⚡ Délestage détecté';
                if (techContext.highVoltage.some(h => h.qualite === 'critique')) return '🔋 Surtension critique';
                return '⚡ Escalader tech';
            })(),
            message: (() => {
                const messages = [];
                if (techContext.loadShedding.jours.length > 0) {
                    messages.push(`${techContext.loadShedding.jours.length} délestage(s)`);
                }
                if (techContext.highVoltage.length > 0) {
                    const critique = techContext.highVoltage.filter(h => h.qualite === 'critique').length;
                    if (critique > 0) messages.push(`${critique} jour(s) sans tension`);
                }
                return messages.join(' - ') || 'Interruption technique';
            })()
        },
        
        // Causes commerciales
        noRecharge: {
            priority: sequence.duration > 3 ? 'urgente' : 'haute',
            action: '📞 Appeler client',
            message: `N'a pas rechargé depuis ${sequence.duration}j.`
        },
        highConsumption: {
            priority: 'haute',
            action: '💬 Proposer upgrade',
            message: `Consommation > forfait.`
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

// ===========================================
// FORMATAGE POUR AFFICHAGE
// ===========================================

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