// analytics/commercialAnalytics.js
import { database, extractClientId } from '../arduinoCore.js';
import { 
    FORFAIT_NAMES, 
    FORFAIT_LIMITS, 
    CONSUMPTION_THRESHOLDS
} from '../arduinoConstants.js';

// ===========================================
// ANALYSE COMMERCIALE PRINCIPALE
// ===========================================

export function analyzeCommercialData() {
    console.time("💰 Analyse commerciale");
    
    // Initialisation
    database.commercialData = { 
        clients: new Map(),
        events: { 
            suspendE: 0, 
            suspendP: 0, 
            surcharge: 0, 
            creditNul: { total: 0, jours: new Set(), pourcentage: 0 } 
        },
        recharges: { parMontant: {}, total: 0 },
        consommation: { globale: { max: 0, min: 0, moyenne: 0, joursSans: 0 } },
        recommendations: []
    };
    
    const tables = database.tables;
    const commercialData = database.commercialData;
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent;
    
    if (!tables) {
        console.timeEnd("💰 Analyse commerciale");
        return;
    }
    
    // Récupération des tables (une seule fois)
    const creditTable = tables.find(t => t.type === 'S');
    const rechargeTable = tables.find(t => t.type === 'R');
    const eventTable = tables.find(t => t.type === 'E');
    
    // Analyses
    if (creditTable) analyzeCreditData(creditTable, commercialData, nanoreseau);
    if (rechargeTable) analyzeRechargeData(rechargeTable, commercialData, nanoreseau);
    if (eventTable) analyzeCommercialEvents(eventTable, commercialData, nanoreseau);
    
    // Post-traitement unique
    postProcessClients(commercialData.clients, commercialData);
    
    console.timeEnd("💰 Analyse commerciale");
}

// ===========================================
// ANALYSE DES CRÉDITS (Table S)
// ===========================================

function analyzeCreditData(creditTable, commercialData, nanoreseau) {
    const clients = commercialData.clients;
    const events = commercialData.events;
    
    // ✅ Transformation en tableau
    const headers = creditTable.header.split(';').filter(h => h.trim() !== '');
    const clientColumns = [];
    
    // Identification des colonnes clients
    for (let i = 0; i < headers.length; i++) {
        const match = headers[i]?.match(/Client (\d+)/i);
        if (match) {
            const fullId = match[1];
            const vraiId = extractClientId(fullId, nanoreseau);
            clientColumns.push({ index: i, fullId, clientId: vraiId });
            
            if (!clients.has(vraiId)) {
                clients.set(vraiId, createEmptyClient(vraiId, fullId));
            }
        }
    }
    
    if (clientColumns.length === 0) return;
    
    const rows = creditTable.data;
    const rowCount = rows.length;
    const colCount = clientColumns.length;
    
    // Cache pour accès rapide
    const clientCache = [];
    for (let c = 0; c < colCount; c++) {
        clientCache.push(clients.get(clientColumns[c].clientId));
    }
    
    // Parcours unique des données
    for (let r = 0; r < rowCount; r++) {
        const cells = rows[r].split(';');
        const date = cells[1]?.split(' ')[0] || '';
        
        for (let c = 0; c < colCount; c++) {
            const creditValue = parseFloat(cells[clientColumns[c].index]);
            
            if (!isNaN(creditValue)) {
                const client = clientCache[c];
                
                client.credits.push({ date, value: creditValue });
                client.totalCredit += creditValue;
                client.maxCredit = Math.max(client.maxCredit, creditValue);
                
                if (creditValue === 0) {
                    client.zeroCreditDates.push(date);
                    events.creditNul.total++;
                    events.creditNul.jours.add(date);
                }
            }
        }
    }
    
    // Mise à jour des moyennes
    for (let c = 0; c < colCount; c++) {
        const client = clientCache[c];
        const count = client.credits.length;
        client.count = count;
        client.averageCredit = count > 0 ? (client.totalCredit / count).toFixed(2) : 0;
        client.zeroCreditDates.sort();
        client.zeroCreditPercentage = count > 0 
            ? ((client.zeroCreditDates.length / count) * 100).toFixed(1) 
            : 0;
    }
    
    const totalCells = colCount * rowCount;
    events.creditNul.pourcentage = totalCells > 0 
        ? ((events.creditNul.total / totalCells) * 100).toFixed(1) 
        : 0;
}

// ===========================================
// ANALYSE DES RECHARGES (Table R)
// ===========================================

function analyzeRechargeData(rechargeTable, commercialData, nanoreseau) {
    const clients = commercialData.clients;
    
    // ✅ Transformation en tableau (CORRIGÉ)
    const headers = rechargeTable.header.split(';').filter(h => h.trim() !== '');
    
    const idxClient = headers.findIndex(h => h.includes('Numero Client'));
    const idxCredit = headers.findIndex(h => h.includes('Credit'));
    const idxForfait = headers.findIndex(h => h.includes('Forfait'));
    const idxMessage = headers.findIndex(h => h.includes('Message'));
    const idxTimestamp = 1;
    
    if (idxClient === -1) return;
    
    const rows = rechargeTable.data;
    const rowCount = rows.length;
    
    // Maps temporaires
    const rechargesParClient = new Map();
    const echecsParClient = new Map();
    const statsMontants = {};
    let totalReussies = 0;
    
    for (let r = 0; r < rowCount; r++) {
        const cells = rows[r].split(';');
        const fullClientId = cells[idxClient];
        
        if (!fullClientId || fullClientId === '0') continue;
        
        const vraiClientId = extractClientId(fullClientId, nanoreseau);
        const credit = parseFloat(cells[idxCredit]) || 0;
        const forfait = parseFloat(cells[idxForfait]) || 0;
        const message = cells[idxMessage];
        const date = cells[idxTimestamp]?.split(' ')[0] || '';
        
        statsMontants[credit] = (statsMontants[credit] || 0) + 1;
        
        if (message === 'Recharge Reussie') {
            totalReussies++;
            
            if (!rechargesParClient.has(vraiClientId)) {
                rechargesParClient.set(vraiClientId, {
                    recharges: [],
                    credits: {},
                    totalRecharges: 0,
                    forfaitActuel: forfait
                });
            }
            
            const clientData = rechargesParClient.get(vraiClientId);
            clientData.recharges.push({ 
                timestamp: cells[idxTimestamp], 
                date, 
                credit, 
                forfait 
            });
            clientData.credits[credit] = (clientData.credits[credit] || 0) + 1;
            clientData.totalRecharges++;
            clientData.forfaitActuel = forfait;
            
        } else {
            if (!echecsParClient.has(vraiClientId)) {
                echecsParClient.set(vraiClientId, []);
            }
            echecsParClient.get(vraiClientId).push({ 
                date, 
                timestamp: cells[idxTimestamp], 
                message 
            });
        }
    }
    
    // Intégration aux clients
    rechargesParClient.forEach((data, clientId) => {
        let client = clients.get(clientId);
        if (!client) {
            client = createEmptyClient(clientId, null);
            clients.set(clientId, client);
        }
        
        // Tri
        data.recharges.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        
        // Détection changements de forfait
        const forfaitChanges = [];
        let dernierForfait = null;
        
        for (let i = 0; i < data.recharges.length; i++) {
            const r = data.recharges[i];
            if (dernierForfait !== null && r.forfait !== dernierForfait) {
                forfaitChanges.push({
                    date: r.date,
                    ancien: dernierForfait,
                    nouveau: r.forfait
                });
            }
            dernierForfait = r.forfait;
        }
        
        // Calcul des pourcentages
        const creditPercentages = {};
        let preferredCredit = null;
        let maxCount = 0;
        
        for (const credit in data.credits) {
            const count = data.credits[credit];
            creditPercentages[credit] = ((count / data.totalRecharges) * 100).toFixed(1);
            if (count > maxCount) {
                maxCount = count;
                preferredCredit = credit;
            }
        }
        
        // Crédit moyen
        let sumCredit = 0;
        for (let i = 0; i < data.recharges.length; i++) {
            sumCredit += data.recharges[i].credit;
        }
        const creditMoyen = sumCredit / data.totalRecharges;
        
        const forfaitName = FORFAIT_NAMES[data.forfaitActuel] || `Forfait ${data.forfaitActuel}`;
        
        // Mise à jour
        client.recharges = data.recharges;
        client.creditPercentages = creditPercentages;
        client.totalRecharges = data.totalRecharges;
        client.forfaitChanges = forfaitChanges;
        client.preferredCredit = preferredCredit;
        client.preferredPercentage = creditPercentages[preferredCredit] || '0';
        client.creditMoyen = creditMoyen.toFixed(2);
        client.forfaitActuel = data.forfaitActuel;
        client.forfaitName = forfaitName;
        client.failedRecharges = echecsParClient.get(clientId) || [];
        client.aChangeForfait = forfaitChanges.length > 0;
    });
    
    commercialData.recharges = {
        total: totalReussies,
        parMontant: statsMontants
    };
}

// ===========================================
// ANALYSE DES ÉVÉNEMENTS
// ===========================================

function analyzeCommercialEvents(eventTable, commercialData, nanoreseau) {
    const clients = commercialData.clients;
    const events = commercialData.events;
    const rows = eventTable.data;
    
    for (let r = 0; r < rows.length; r++) {
        const cells = rows[r].split(';');
        if (cells.length < 4) continue;
        
        const eventType = cells[2];
        const fullClientId = cells[3];
        
        if (!fullClientId || fullClientId === '0') continue;
        
        const vraiClientId = extractClientId(fullClientId, nanoreseau);
        
        if (eventType === 'SuspendE') events.suspendE++;
        else if (eventType === 'SuspendP') events.suspendP++;
        else if (eventType === 'Surcharge') events.surcharge++;
        
        let client = clients.get(vraiClientId);
        if (!client) {
            client = createEmptyClient(vraiClientId, fullClientId);
            clients.set(vraiClientId, client);
        }
        
        if (!client.events) client.events = [];
        client.events.push({
            date: cells[1]?.split(' ')[0] || '',
            type: eventType,
            valeur: cells[4] || ''
        });
    }
}

// ===========================================
// POST-TRAITEMENT CLIENTS (UNE SEULE PASSE)
// ===========================================

function postProcessClients(clients, commercialData) {
    let totalConso = 0;
    let countConso = 0;
    let maxConsoGlobal = 0;
    let minConsoGlobal = Infinity;
    let joursSansConsoTotal = 0;
    
    // Récupérer les recommandations pour le tri final
    const allRecommendations = [];
    
    clients.forEach(client => {
        // Initialisations
        client.credits = client.credits || [];
        client.zeroCreditDates = client.zeroCreditDates || [];
        client.recharges = client.recharges || [];
        client.forfaitChanges = client.forfaitChanges || [];
        client.events = client.events || [];
        client.consommation = client.consommation || { 
            journaliere: [], 
            max: 0, 
            moyenne: 0, 
            joursSans: 0,
            stats: { normal: 0, tolerance: 0, depasse: 0 }
        };
        
        // Analyses
        analyzeTechnicalRefunds(client);
        analyzeConsumptionVsForfait(client);
        calculateClientScore(client);
        const clientRec = generateClientRecommendations(client);
        
        if (clientRec) allRecommendations.push(clientRec);
        
        // Stats conso globales
        const conso = client.consommation?.journaliere || [];
        if (conso.length > 0) {
            let clientMax = 0;
            let clientSum = 0;
            let clientJoursSans = 0;
            
            for (let i = 0; i < conso.length; i++) {
                const val = conso[i].valeur;
                clientSum += val;
                if (val > clientMax) clientMax = val;
                if (val < 0.1) clientJoursSans++;
            }
            
            const clientMoy = clientSum / conso.length;
            
            client.consommation.max = clientMax;
            client.consommation.moyenne = clientMoy;
            client.consommation.joursSans = clientJoursSans;
            
            maxConsoGlobal = Math.max(maxConsoGlobal, clientMax);
            minConsoGlobal = Math.min(minConsoGlobal, clientMoy);
            totalConso += clientMoy;
            countConso++;
            joursSansConsoTotal += clientJoursSans;
            
            // Stats par seuils
            if (client.forfaitActuel && FORFAIT_LIMITS) {
                const forfaitName = FORFAIT_NAMES[client.forfaitActuel];
                const limits = FORFAIT_LIMITS[forfaitName];
                
                if (limits && CONSUMPTION_THRESHOLDS) {
                    const stats = { normal: 0, tolerance: 0, depasse: 0 };
                    for (let i = 0; i < conso.length; i++) {
                        const ratio = (conso[i].valeur / limits.max) * 100;
                        
                        if (ratio > CONSUMPTION_THRESHOLDS.TOLERANCE_MAX) {
                            stats.depasse++;
                        } else if (ratio > CONSUMPTION_THRESHOLDS.NORMAL_MAX) {
                            stats.tolerance++;
                        } else {
                            stats.normal++;
                        }
                    }
                    client.consommation.stats = stats;
                }
            }
        }
        
        // Nettoyage ID
        if (typeof client.id === 'string' && client.id.length > 3) {
            client.id = extractClientId(client.id, null);
        }
    });
    
    // Stats globales
    commercialData.consommation.globale = {
        max: maxConsoGlobal,
        min: minConsoGlobal === Infinity ? 0 : minConsoGlobal,
        moyenne: countConso > 0 ? (totalConso / countConso).toFixed(2) : 0,
        joursSans: joursSansConsoTotal
    };
    
    // Trier les recommandations
    commercialData.recommendations = allRecommendations.sort((a, b) => {
        if (a.urgent && !b.urgent) return -1;
        if (!a.urgent && b.urgent) return 1;
        return 0;
    });
}

// ===========================================
// FONCTIONS SPÉCIALISÉES
// ===========================================

function createEmptyClient(id, fullId) {
    return {
        id,
        fullId,
        credits: [],
        zeroCreditDates: [],
        recharges: [],
        forfaitChanges: [],
        events: [],
        totalCredit: 0,
        count: 0,
        maxCredit: 0,
        consommation: { 
            journaliere: [], 
            max: 0, 
            moyenne: 0, 
            joursSans: 0,
            stats: { normal: 0, tolerance: 0, depasse: 0 }
        }
    };
}

function analyzeTechnicalRefunds(client) {
    const credits = client.credits || [];
    const remboursements = [];
    const byType = { 2: 0, 3: 0, 4: 0 };
    
    for (let i = 0; i < credits.length; i++) {
        const val = credits[i].value;
        if (val === 2 || val === 3 || val === 4) {
            remboursements.push(credits[i]);
            byType[val]++;
        }
    }
    
    const count = remboursements.length;
    const totalCredits = credits.length || 1;
    
    client.technicalRefunds = {
        count,
        dates: remboursements.map(r => r.date),
        percentage: ((count / totalCredits) * 100).toFixed(1),
        isAbnormal: count >= 3,
        alert: count >= 3 ? "⚠️ Remboursements techniques fréquents" : null,
        byType
    };
}

function analyzeConsumptionVsForfait(client) {
    const consoMoyenne = parseFloat(client.consommation?.moyenne) || 0;
    const forfaitName = client.forfaitName;
    const limits = FORFAIT_LIMITS?.[forfaitName];
    const forfaitMax = limits?.max || 1;
    
    // ✅ Récupérer les données journalières
    const consoJournaliere = client.consommation?.journaliere || [];
    
    // ✅ Calculer le pourcentage de jours où la conso > forfaitMax
    const joursDepassement = consoJournaliere.filter(j => j.valeur > forfaitMax).length;
    const totalJours = consoJournaliere.length || 1;
    const pourcentageDepassement = ((joursDepassement / totalJours) * 100).toFixed(1);
    
    // Ratio moyen
    const ratio = (consoMoyenne / forfaitMax) * 100;
    
    // Déterminer l'adéquation avec les nouveaux critères
    let adequation = "NON DÉTERMINÉ";
    let recommandation = "";
    let couleur = "#999";
    let priorite = "basse";
    
    // Cas 1: Fort dépassement fréquent (>20% des jours)
    if (pourcentageDepassement > 20) {
        adequation = "FORFAIT CRITIQUE";
        recommandation = "🔴 URGENT: Passer au forfait supérieur immédiatement";
        couleur = "#f44336";
        priorite = "urgente";
    }
    // Cas 2: Ratio élevé + dépassements occasionnels
    else if (ratio > 90 && pourcentageDepassement > 5) {
        adequation = "SOUS-DIMENSIONNÉ";
        recommandation = "📈 Passer au forfait supérieur (dépassements fréquents)";
        couleur = "#ff9800";
        priorite = "haute";
    }
    // Cas 3: Ratio élevé sans dépassement
    else if (ratio > 90) {
        adequation = "LIMITE";
        recommandation = "⚠️ Surveiller - Proche de la limite";
        couleur = "#ffc107";
        priorite = "moyenne";
    }
    // Cas 4: Ratio moyen
    else if (ratio > 70) {
        adequation = "ADAPTÉ";
        recommandation = "✅ Forfait bien choisi";
        couleur = "#4CAF50";
        priorite = "basse";
    }
    // Cas 5: Ratio faible
    else if (ratio > 30) {
        adequation = "SUR-DIMENSIONNÉ";
        recommandation = "📉 Envisager forfait économique";
        couleur = "#2196F3";
        priorite = "basse";
    }
    // Cas 6: Très faible consommation
    else {
        adequation = "TRÈS SUR-DIMENSIONNÉ";
        recommandation = "📉 Proposer petit forfait";
        couleur = "#9C27B0";
        priorite = "info";
    }
    
    client.consumptionAnalysis = {
        consoMoyenne: consoMoyenne.toFixed(2),
        forfaitMax,
        ratio: ratio.toFixed(1) + "%",
        joursDepassement,
        pourcentageDepassement: pourcentageDepassement + "%",
        adequation,
        recommandation,
        couleur,
        priorite
    };
}

function calculateClientScore(client) {
    let score = 100;
    const raisons = [];
    
    if (client.technicalRefunds?.isAbnormal) {
        score -= 30;
        raisons.push("Remboursements fréquents");
    }
    
    const zeroPercent = parseFloat(client.zeroCreditPercentage || 0);
    if (zeroPercent > 20) {
        score -= 20;
        raisons.push("Trop de jours sans crédit");
    } else if (zeroPercent > 10) {
        score -= 10;
        raisons.push("Quelques jours sans crédit");
    }
    
    const changes = client.forfaitChanges?.length || 0;
    if (changes > 3) {
        score -= 20;
        raisons.push("Instabilité (changements forfait)");
    } else if (changes > 1) {
        score -= 10;
        raisons.push("Quelques changements de forfait");
    }
    
    if (client.consumptionAnalysis) {
        const ratio = parseFloat(client.consumptionAnalysis.ratio);
        if (ratio >= 30 && ratio <= 70) {
            score += 10;
            raisons.push("Consommation idéale");
        }
    }
    
    const recharges = client.totalRecharges || 0;
    if (recharges > 20) {
        score += 15;
        raisons.push("Client fidèle");
    } else if (recharges > 10) {
        score += 10;
        raisons.push("Client régulier");
    }
    
    score = Math.max(0, Math.min(100, score));
    
    let grade = "", emoji = "";
    if (score >= 80) {
        grade = "EXCELLENT"; emoji = "💎";
    } else if (score >= 60) {
        grade = "BON"; emoji = "🟢";
    } else if (score >= 40) {
        grade = "FRAGILE"; emoji = "🟠";
    } else {
        grade = "CRITIQUE"; emoji = "🔴";
    }
    
    client.score = {
        valeur: score,
        grade,
        emoji,
        raisons,
        alerte: raisons.length > 0 ? raisons.join(", ") : "Aucune anomalie"
    };
}

function generateClientRecommendations(client) {
    const clientRec = {
        clientId: client.id,
        urgent: false,
        actions: [],
        synthese: { credit: null, recharge: null, forfait: null }
    };
    
    const totalJours = client.credits?.length || 0;
    const zeroCount = client.zeroCreditDates?.length || 0;
    const creditMax = client.maxCredit || 0;
    
    if (totalJours > 0) {
        clientRec.synthese.credit = `📅 Ce client a eu ${zeroCount} jour(s) sans crédit sur ${totalJours} jours analysés, avec un crédit maximum de ${creditMax.toFixed(2)} jours.`;
    }
    
    const totalRecharges = client.totalRecharges || 0;
    const prefCredit = client.preferredCredit;
    const prefPercent = client.preferredPercentage;
    
    if (totalRecharges > 0 && prefCredit) {
        clientRec.synthese.recharge = `📱 Il recharge généralement pour ${prefCredit} jours (${prefPercent}% des ${totalRecharges} recharges).`;
    }
    
    const forfaitChanges = client.forfaitChanges || [];
    const forfaitActuel = client.forfaitName || 'Inconnu';
    
    if (forfaitChanges.length > 0) {
        const evolution = forfaitChanges.map(c => {
            const ancien = FORFAIT_NAMES[c.ancien] || `Forfait ${c.ancien}`;
            const nouveau = FORFAIT_NAMES[c.nouveau] || `Forfait ${c.nouveau}`;
            return `${ancien} → ${nouveau}`;
        }).join(' → ');
        clientRec.synthese.forfait = `📦 Forfaits utilisés : ${evolution} (actuel : ${forfaitActuel}).`;
    } else {
        clientRec.synthese.forfait = `📦 Forfait actuel : ${forfaitActuel} (aucun changement).`;
    }
    
    // Actions
    if (client.consumptionAnalysis?.adequation === "SOUS-DIMENSIONNÉ") {
        clientRec.actions.push({
            type: "upsell",
            message: `⚡ Consommation moyenne de ${client.consumptionAnalysis.consoMoyenne} Wh (${client.consumptionAnalysis.ratio}) pour un forfait max de ${client.consumptionAnalysis.forfaitMax} Wh. Proposer forfait supérieur.`,
            priorite: "haute"
        });
        clientRec.urgent = true;
    } else if (client.consumptionAnalysis?.adequation === "SUR-DIMENSIONNÉ") {
        clientRec.actions.push({
            type: "downsell",
            message: `📉 Consommation moyenne de ${client.consumptionAnalysis.consoMoyenne} Wh (${client.consumptionAnalysis.ratio}) pour un forfait max de ${client.consumptionAnalysis.forfaitMax} Wh. Proposer forfait économique.`,
            priorite: "moyenne"
        });
    }
    
    if (client.technicalRefunds?.isAbnormal) {
        const details = Object.entries(client.technicalRefunds.byType)
            .filter(([_, count]) => count > 0)
            .map(([type, count]) => `${count}x pour ${type} jours`)
            .join(', ');
        
        clientRec.actions.push({
            type: "technical",
            message: `🔧 ${client.technicalRefunds.count} remboursements techniques détectés (${details}). Vérifier équipement client.`,
            priorite: "haute"
        });
        clientRec.urgent = true;
    }
    
    const zeroPercent = parseFloat(client.zeroCreditPercentage || 0);
    if (zeroPercent > 20) {
        clientRec.actions.push({
            type: "credit",
            message: `⚠️ ${zeroPercent}% de jours sans crédit (${zeroCount} jours). Proposer alerte de crédit faible.`,
            priorite: "moyenne"
        });
    } else if (zeroPercent > 10) {
        clientRec.actions.push({
            type: "credit",
            message: `📊 ${zeroPercent}% de jours sans crédit (${zeroCount} jours). À surveiller.`,
            priorite: "basse"
        });
    }
    
    if (client.score?.valeur < 40) {
        clientRec.actions.push({
            type: "urgent",
            message: `🔴 Score client de ${client.score.valeur}/100. APPEL PRIORITAIRE - Client à risque de départ.`,
            priorite: "urgente"
        });
        clientRec.urgent = true;
    } else if (client.score?.valeur < 60) {
        clientRec.actions.push({
            type: "warning",
            message: `🟠 Score client de ${client.score.valeur}/100. Client fragile, à contacter.`,
            priorite: "moyenne"
        });
    }
    
    client.recommendations = clientRec;
    return clientRec;
}

// ===========================================
// FONCTIONS D'EXPORT (INCHANGÉES)
// ===========================================

export function getClientList() {
    const clients = database.commercialData?.clients;
    if (!clients) return [];
    
    return Array.from(clients.values()).map(client => ({
        ...client,
        technicalRefunds: client.technicalRefunds || { count: 0, isAbnormal: false },
        consumptionAnalysis: client.consumptionAnalysis || { adequation: "INCONNU", recommandation: "" },
        score: client.score || { valeur: 0, grade: "INCONNU", emoji: "❓" },
        recommendations: client.recommendations || { actions: [] }
    }));
}

export function getUrgentRecommendations() {
    const recommendations = database.commercialData?.recommendations;
    return recommendations?.filter(r => r.urgent) || [];
}

export function getClientById(clientId) {
    return database.commercialData?.clients?.get(clientId) || null;
}

export function getRechargeStats() {
    const data = database.commercialData?.recharges;
    if (!data) return null;
    
    const montants = Object.entries(data.parMontant)
        .sort((a, b) => b[1] - a[1])
        .map(([montant, count]) => ({
            montant,
            count,
            pourcentage: ((count / data.total) * 100).toFixed(1)
        }));
    
    return {
        total: data.total,
        montants,
        preferred: montants[0] || null
    };
}

export function getEventStats() {
    return database.commercialData?.events || {
        suspendE: 0,
        suspendP: 0,
        surcharge: 0,
        creditNul: { total: 0, jours: new Set(), pourcentage: 0 }
    };
}

export function calculateConsumptionFromEnergy(energyData) {
    if (!energyData || !database.commercialData?.clients) return;
    
    const clients = database.commercialData.clients;
    let totalConso = 0;
    let countConso = 0;
    let maxConso = 0;
    let minConso = Infinity;
    let joursSansConso = 0;
    
    clients.forEach(client => {
        const rawData = energyData[client.id] || [];
        
        // ✅ On garde TOUS les jours, y compris ceux à 0
        const consoJournaliere = [];
        const joursAvecConso = [];
        
        for (let i = 0; i < rawData.length; i++) {
            const jour = rawData[i];
            consoJournaliere.push(jour); // On garde tout, même si valeur = 0
            
            if (jour.valeur > 0) {
                joursAvecConso.push(jour);
            }
        }
        
        client.consommation.journaliere = consoJournaliere; // ✅ TOUS les jours
        
        if (consoJournaliere.length > 0) {
            let clientMax = 0;
            let clientSum = 0;
            let clientJoursSans = 0;
            
            // Stats sur TOUS les jours
            for (let i = 0; i < consoJournaliere.length; i++) {
                const val = consoJournaliere[i].valeur;
                if (val > 0) {
                    clientSum += val;
                }
                if (val > clientMax) clientMax = val;
                if (val < 0.1) clientJoursSans++;
            }
            
            const clientMoy = joursAvecConso.length > 0 
                ? clientSum / joursAvecConso.length 
                : 0;
            
            client.consommation.max = clientMax;
            client.consommation.moyenne = clientMoy;
            client.consommation.joursSans = clientJoursSans;
            client.consommation.totalJours = consoJournaliere.length;
            
            maxConso = Math.max(maxConso, clientMax);
            minConso = Math.min(minConso, clientMoy || Infinity);
            totalConso += clientMoy || 0;
            countConso++;
            joursSansConso += clientJoursSans;
        }
    });
    
    database.commercialData.consommation.globale = {
        max: maxConso,
        min: minConso === Infinity ? 0 : minConso,
        moyenne: countConso > 0 ? (totalConso / countConso).toFixed(2) : 0,
        joursSans: joursSansConso
    };
}