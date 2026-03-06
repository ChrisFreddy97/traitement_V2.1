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
    // FONCTION UTILITAIRE INTÉGRÉE
    // ===========================================
    function hasRecentActivity(client) {
        const today = new Date();
        
        // Dernière recharge (30 jours)
        const lastRecharge = client.recharges?.slice(-1)[0]?.date;
        if (lastRecharge) {
            const days = Math.floor((today - new Date(lastRecharge)) / (1000*60*60*24));
            if (days < 30) return true;
        }
        
        // Dernière consommation (30 jours)
        const lastConso = client.consommation?.journaliere?.slice(-1)[0]?.date;
        if (lastConso) {
            const days = Math.floor((today - new Date(lastConso)) / (1000*60*60*24));
            if (days < 30) return true;
        }
        
        // Dernier événement (30 jours)
        const lastEvent = client.events?.slice(-1)[0]?.date;
        if (lastEvent) {
            const days = Math.floor((today - new Date(lastEvent)) / (1000*60*60*24));
            if (days < 30) return true;
        }
        
        return false;
    }

    function isGhostClient(client) {
        const aDesRecharges = (client.recharges?.length > 0);
        const aDesConso = (client.consommation?.journaliere?.length > 0);
        const aDesEvents = (client.events?.length > 0);
        const aDesCredits = (client.credits?.length > 0);
        
        if (!aDesRecharges && !aDesConso && !aDesEvents && !aDesCredits) {
            return true;
        }
        
        const consoToutesNulles = (client.consommation?.journaliere?.every(c => c.valeur === 0) ?? true);
        const creditsTousNuls = (client.credits?.every(c => c.value === 0) ?? true);
        
        return (aDesConso && consoToutesNulles) || (aDesCredits && creditsTousNuls);
    }

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
            conformity: tech.conformity || { pourcentage: 100 }
        };
    }

    // ===========================================
    // CONTEXTE TECHNIQUE
    // ===========================================
    const techContext = getTechnicalContextForDates(sequenceDates);

    // ===========================================
    // NIVEAU 1: CLIENT FANTÔME (PAS DE DONNÉES)
    // ===========================================
    if (isGhostClient(client)) {
        return {
            mainCause: 'ghost_client',
            confidence: 0.99,
            evidence: 'Aucune donnée - Client inexistant'
        };
    }

    // ===========================================
    // NIVEAU 2: PROBLÈMES TECHNIQUES MAJEURS
    // ===========================================
    if (techContext.loadShedding.jours.length > 0) {
        return {
            mainCause: 'technicalEvent',
            confidence: 0.98,
            evidence: `Délestage pendant ${techContext.loadShedding.jours.length} jour(s)`
        };
    }

    const technicalEvents = (client.events || []).filter(e => 
        e.date >= seqStart && e.date <= seqEnd &&
        (e.type.includes('Suspend') || e.type.includes('Delest') || 
         e.type.includes('Maintenance') || e.type.includes('Coupure'))
    );

    if (technicalEvents.length > 0) {
        return {
            mainCause: 'technicalEvent',
            confidence: 0.95,
            evidence: `${technicalEvents.length} interruption(s) technique(s)`
        };
    }

    // ===========================================
    // NIVEAU 3: CLIENT ACTIF (A DES DONNÉES RÉCENTES)
    // ===========================================
    const clientActif = hasRecentActivity(client);
    
    if (clientActif) {
        // Priorité aux causes commerciales
        const rechargesInSeq = (client.recharges || []).filter(r =>
            r.date >= seqStart && r.date <= seqEnd
        );
        
        if (rechargesInSeq.length === 0) {
            return {
                mainCause: 'noRecharge',
                confidence: 0.95,
                evidence: `Pas de recharge pendant ${seqLength} jour(s)`
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
    }

    // ===========================================
    // NIVEAU 4: CAUSES D'ABSENCE (CLIENT INACTIF)
    // ===========================================
    if (!clientActif) {
        if (seqLength < 7) {
            return {
                mainCause: 'vacances',
                confidence: 0.7,
                evidence: `Courte absence: ${seqLength} jours`
            };
        }
        
        if (seqLength > 30) {
            return {
                mainCause: 'abandon',
                confidence: 0.9,
                evidence: `Absence prolongée: ${seqLength} jours`
            };
        }
        
        return {
            mainCause: 'vacances',
            confidence: 0.8,
            evidence: `Absence de ${seqLength} jours`
        };
    }

    // Fallback
    return {
        mainCause: 'unknown',
        confidence: 0.4,
        evidence: 'Cause non déterminée'
    };
}
// ===========================================
// RECOMMANDATIONS (AVEC PROFILS D'ABSENCE)
// ===========================================

export function generateSequenceRecommendation(client, sequence, causeResult) {
    const cause = causeResult?.mainCause || 'unknown';
    const seqLength = sequence.duration;
    
    function hasRecentActivity(client) {
        const today = new Date();
        
        const lastRecharge = client.recharges?.slice(-1)[0]?.date;
        if (lastRecharge) {
            const days = Math.floor((today - new Date(lastRecharge)) / (1000*60*60*24));
            if (days < 30) return true;
        }
        
        const lastConso = client.consommation?.journaliere?.slice(-1)[0]?.date;
        if (lastConso) {
            const days = Math.floor((today - new Date(lastConso)) / (1000*60*60*24));
            if (days < 30) return true;
        }
        
        return false;
    }
    
    const clientActif = hasRecentActivity(client);

    const recommendations = {
        // ===========================================
        // CAUSES COMMERCIALES (POUR CLIENTS ACTIFS)
        // ===========================================
        noRecharge: {
            priority: seqLength > 3 ? 'urgente' : 'haute',
            action: '📞 Appeler client',
            message: `N'a pas rechargé depuis ${seqLength}j - Proposer une recharge`
        },
        highConsumption: {
            priority: 'haute',
            action: '💬 Proposer upgrade forfait',
            message: `Consommation supérieure au forfait - Adapter le forfait`
        },
        insufficientForfait: {
            priority: 'haute',
            action: '📈 Augmenter forfait',
            message: `Forfait insuffisant pour la consommation réelle`
        },
        payment: {
            priority: 'haute',
            action: '💳 Mettre à jour paiement',
            message: `Recharges échouées - Vérifier moyen de paiement`
        },
        overload: {
            priority: 'moyenne',
            action: '⚠️ Vérifier équipement',
            message: `Consommation anormalement élevée - Diagnostic technique`
        },

        // ===========================================
        // CAUSES TECHNIQUES
        // ===========================================
        technicalEvent: {
            priority: (() => {
                if (seqLength > 3) return 'urgente';
                return 'haute';
            })(),
            action: '⚡ Escalader équipe technique',
            message: `Problème technique détecté - Vérifier installation`
        },

        // ===========================================
        // CAUSES D'ABSENCE (POUR CLIENTS INACTIFS)
        // ===========================================
        vacances: {
            priority: 'info',
            action: '🏠 Aucune action',
            message: `Client en vacances - Pas de consommation`
        },
        abandon: {
            priority: 'moyenne',
            action: '🚚 Vérifier présence client',
            message: `Inactivité prolongée - Risque de déménagement ou abandon`
        },

        // ===========================================
        // CAS PARTICULIERS
        // ===========================================
        ghost_client: {
            priority: 'info',
            action: '👻 Visite terrain',
            message: `Client sans données - Vérifier existence du compteur`
        },
        system: {
            priority: 'basse',
            action: '🔧 À investiguer',
            message: `Anomalie système - Log à analyser`
        },
        noActivity: {
            priority: 'basse',
            action: '📱 Relancer client',
            message: `Compte inactif - Proposer activation`
        },
        unknown: {
            priority: 'moyenne',
            action: '🔍 Analyser dossier',
            message: `Cause incertaine - Investigation nécessaire`
        }
    };

    // Ajustement pour clients actifs avec courte absence
    if (clientActif && cause === 'vacances') {
        return {
            priority: 'basse',
            action: '📱 SMS de rappel',
            message: `Client actif mais inactif depuis ${seqLength}j - Relance légère`
        };
    }

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
