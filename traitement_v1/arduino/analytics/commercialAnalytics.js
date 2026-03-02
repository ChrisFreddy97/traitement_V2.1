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
    console.log("💰 Analyse commerciale - Début");
    
    // Initialiser la structure principale
    database.commercialData = { 
        clients: new Map(),
        events: { 
            suspendE: 0, 
            suspendP: 0, 
            surcharge: 0, 
            creditNul: { total: 0, jours: new Set(), pourcentage: 0 } 
        },
        recharges: { parMontant: {}, total: 0 },
        consommation: { globale: { max: 0, min: 0, moyenne: 0, joursSans: 0 } }
    };
    
    // Analyses
    analyzeCreditData();
    analyzeRechargeData();
    analyzeCommercialEvents();
    analyzeTechnicalRefunds();
    analyzeConsumptionVsForfait();
    calculateClientScore();
    generateRecommendations();
    prepareAllClients();
    calculateConsumptionStats();
    
    console.log("💰 Analyse commerciale terminée");
}

// ===========================================
// ANALYSE DES CRÉDITS (Table S)
// ===========================================

function analyzeCreditData() {
    console.log("📊 Analyse des crédits (table S)");
    
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent;
    const clients = database.commercialData.clients;

    const creditTable = database.tables.find(t => t.type === 'S');
    if (!creditTable) {
        console.log("ℹ️ Aucune table de crédits");
        return;
    }

    const headers = creditTable.header.split(';').filter(h => h.trim() !== '');
    const clientColumns = [];

    headers.forEach((header, index) => {
        const match = header.match(/Client (\d+)/i);
        if (match) {
            const fullId = match[1];
            const vraiId = extractClientId(fullId, nanoreseau);
            clientColumns.push({ 
                index, 
                fullId: fullId,
                clientId: vraiId 
            });
        }
    });

    // Initialiser les données clients
    clientColumns.forEach(col => {
        if (!clients.has(col.clientId)) {
            clients.set(col.clientId, {
                id: col.clientId,
                fullId: col.fullId,
                credits: [],
                zeroCreditDates: [],
                totalCredit: 0,
                count: 0,
                maxCredit: 0,
                recharges: [],
                forfaitChanges: [],
                events: []
            });
        }
    });

    // Parcourir les lignes
    creditTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];

        clientColumns.forEach(col => {
            const creditValue = parseFloat(cells[col.index]);
            if (!isNaN(creditValue)) {
                const client = clients.get(col.clientId);
                if (client) {
                    client.credits.push({ date, value: creditValue });
                    client.totalCredit += creditValue;
                    client.count++;
                    client.maxCredit = Math.max(client.maxCredit, creditValue);
                    
                    if (creditValue === 0) {
                        client.zeroCreditDates.push(date);
                        database.commercialData.events.creditNul.total++;
                        database.commercialData.events.creditNul.jours.add(date);
                    }
                }
            }
        });
    });

    // Post-traitement
    clients.forEach(client => {
        client.averageCredit = client.count > 0 ? (client.totalCredit / client.count).toFixed(2) : 0;
        client.zeroCreditDates.sort();
        client.zeroCreditPercentage = client.count > 0 
            ? ((client.zeroCreditDates.length / client.count) * 100).toFixed(1) 
            : 0;
    });

    database.commercialData.events.creditNul.pourcentage = 
        ((database.commercialData.events.creditNul.total / (clientColumns.length * creditTable.data.length)) * 100).toFixed(1);
}

// ===========================================
// ANALYSE DES RECHARGES (Table R)
// ===========================================

function analyzeRechargeData() {
    console.log("💰 Analyse des recharges - Début");
    
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent;
    const clients = database.commercialData.clients;
    
    const rechargeTable = database.tables.find(t => t.type === 'R');
    if (!rechargeTable) {
        console.log("ℹ️ Aucune table de recharge");
        return;
    }
    
    const headers = rechargeTable.header.split(';');
    const clientIdx = headers.findIndex(h => h.includes('Numero Client'));
    const creditIdx = headers.findIndex(h => h.includes('Credit'));
    const forfaitIdx = headers.findIndex(h => h.includes('Forfait'));
    const messageIdx = headers.findIndex(h => h.includes('Message'));
    const timestampIdx = 1;
    
    const validRecharges = [];
    const failedRecharges = [];
    
    rechargeTable.data.forEach(row => {
        const cells = row.split(';');
        const message = cells[messageIdx];
        
        const fullClientId = cells[clientIdx];
        if (!fullClientId || fullClientId === '0') return;
        
        const vraiClientId = extractClientId(fullClientId, nanoreseau);
        const rechargeData = {
            clientId: vraiClientId,
            fullClientId,
            credit: parseFloat(cells[creditIdx]) || 0,
            forfait: parseFloat(cells[forfaitIdx]) || 0,
            timestamp: cells[timestampIdx],
            date: cells[timestampIdx].split(' ')[0],
            message: message
        };
        
        if (message === 'Recharge Reussie') {
            validRecharges.push(rechargeData);
        } else {
            // Capturer les recharges échouées
            failedRecharges.push(rechargeData);
        }
    });
    
    // Grouper par client
    const rechargesParClient = new Map();
    const rechargesEcheesParClient = new Map();
    
    validRecharges.forEach(recharge => {
        const clientId = recharge.clientId;
        
        if (!rechargesParClient.has(clientId)) {
            rechargesParClient.set(clientId, {
                recharges: [],
                credits: {},
                totalRecharges: 0,
                forfaitActuel: recharge.forfait
            });
        }
        
        const clientData = rechargesParClient.get(clientId);
        clientData.recharges.push({
            timestamp: recharge.timestamp,
            date: recharge.date,
            credit: recharge.credit,
            forfait: recharge.forfait
        });
        clientData.credits[recharge.credit] = (clientData.credits[recharge.credit] || 0) + 1;
        clientData.totalRecharges++;
        clientData.forfaitActuel = recharge.forfait;
    });

    // Grouper les recharges échouées par client
    failedRecharges.forEach(recharge => {
        const clientId = recharge.clientId;
        
        if (!rechargesEcheesParClient.has(clientId)) {
            rechargesEcheesParClient.set(clientId, []);
        }
        
        rechargesEcheesParClient.get(clientId).push({
            date: recharge.date,
            timestamp: recharge.timestamp,
            message: recharge.message
        });
    });
    
    // Transférer aux clients principaux
    rechargesParClient.forEach((data, clientId) => {
        if (!clients.has(clientId)) {
            clients.set(clientId, {
                id: clientId,
                recharges: [],
                credits: [],
                zeroCreditDates: [],
                events: []
            });
        }
        
        const client = clients.get(clientId);
        
        // Trier par date
        data.recharges.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Détecter les changements de forfait
        const forfaitChanges = [];
        let dernierForfait = null;
        
        data.recharges.forEach(recharge => {
            if (dernierForfait !== null && recharge.forfait !== dernierForfait) {
                forfaitChanges.push({
                    date: recharge.date,
                    ancien: dernierForfait,
                    nouveau: recharge.forfait
                });
            }
            dernierForfait = recharge.forfait;
        });
        
        // Calculer les pourcentages de crédit
        const creditPercentages = {};
        Object.entries(data.credits).forEach(([credit, count]) => {
            creditPercentages[credit] = ((count / data.totalRecharges) * 100).toFixed(1);
        });
        
        // Crédit préféré
        let preferredCredit = null;
        let maxCount = 0;
        Object.entries(data.credits).forEach(([credit, count]) => {
            if (count > maxCount) {
                maxCount = count;
                preferredCredit = credit;
            }
        });
        
        // Dernières 5 recharges
        const dernieresRecharges = data.recharges.slice(-5).reverse();
        
        // Calculer le crédit moyen
        const creditMoyen = data.recharges.reduce((sum, r) => sum + r.credit, 0) / data.totalRecharges;
        
        // Ajouter les infos de forfait
        const forfaitName = FORFAIT_NAMES[data.forfaitActuel] || `Forfait ${data.forfaitActuel}`;
        let consoStatus = '';
        let consoColor = '#999';
        
        const limits = FORFAIT_LIMITS[forfaitName];
        if (limits) {
            const ratio = (creditMoyen / limits.max) * 100;
            
            if (creditMoyen > limits.max) {
                consoStatus = '🔴 Dépassement';
                consoColor = '#f44336';
            } else if (creditMoyen > limits.max * (1 - limits.tolerance/100)) {
                consoStatus = '🟠 Limite';
                consoColor = '#ff9800';
            } else {
                consoStatus = '✅ OK';
                consoColor = '#4CAF50';
            }
        }
        
        // Mettre à jour le client
        client.recharges = data.recharges;
        client.creditPercentages = creditPercentages;
        client.totalRecharges = data.totalRecharges;
        client.forfaitChanges = forfaitChanges;
        client.preferredCredit = preferredCredit;
        client.preferredPercentage = creditPercentages[preferredCredit] || '0';
        client.dernieresRecharges = dernieresRecharges;
        client.aChangeForfait = forfaitChanges.length > 0;
        client.creditMoyen = creditMoyen.toFixed(2);
        client.forfaitActuel = data.forfaitActuel;
        client.forfaitName = forfaitName;
        client.consoStatus = consoStatus;
        client.consoColor = consoColor;
        
        // Ajouter les recharges échouées si existe
        client.failedRecharges = rechargesEcheesParClient.get(clientId) || [];
    });
    
    database.commercialData.recharges = {
        total: validRecharges.length,
        parMontant: validRecharges.reduce((acc, r) => {
            acc[r.credit] = (acc[r.credit] || 0) + 1;
            return acc;
        }, {})
    };
    
    console.log(`✅ ${clients.size} clients analysés (recharges)`);
}

// ===========================================
// ANALYSE DES ÉVÉNEMENTS COMMERCIAUX
// ===========================================

function analyzeCommercialEvents() {
    console.log("📊 Analyse des événements commerciaux...");
    
    const eventTable = database.tables.find(t => t.type === 'E');
    if (!eventTable) return;
    
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent;
    const clients = database.commercialData.clients;
    
    eventTable.data.forEach(row => {
        const cells = row.split(';');
        if (cells.length < 4) return;
        
        const eventType = cells[2];
        const fullClientId = cells[3];
        
        if (!fullClientId || fullClientId === '0') return;
        
        const vraiClientId = extractClientId(fullClientId, nanoreseau);
        
        const event = {
            date: cells[1].split(' ')[0],
            type: eventType,
            valeur: cells[4] || ''
        };
        
        // Mettre à jour les compteurs globaux
        if (eventType === 'SuspendE') database.commercialData.events.suspendE++;
        else if (eventType === 'SuspendP') database.commercialData.events.suspendP++;
        else if (eventType === 'Surcharge') database.commercialData.events.surcharge++;
        
        // Lier l'événement au client
        if (vraiClientId) {
            if (!clients.has(vraiClientId)) {
                clients.set(vraiClientId, {
                    id: vraiClientId,
                    fullId: fullClientId,
                    events: [],
                    recharges: [],
                    credits: [],
                    zeroCreditDates: []
                });
            }
            
            const client = clients.get(vraiClientId);
            if (!client.events) client.events = [];
            client.events.push(event);
        }
    });
    
    console.log("✅ Analyse des événements terminée");
}

// ===========================================
// ANALYSE DES REMBOURSEMENTS TECHNIQUES
// ===========================================

function analyzeTechnicalRefunds() {
    console.log("🔍 Analyse des remboursements techniques...");
    
    const clients = database.commercialData?.clients;
    if (!clients) return;
    
    clients.forEach(client => {
        const remboursements = client.credits?.filter(c => [2,3,4].includes(c.value)) || [];
        const totalCredits = client.credits?.length || 1;
        
        client.technicalRefunds = {
            count: remboursements.length,
            dates: remboursements.map(r => r.date),
            percentage: ((remboursements.length / totalCredits) * 100).toFixed(1),
            isAbnormal: remboursements.length >= 3,
            alert: remboursements.length >= 3 ? "⚠️ Remboursements techniques fréquents" : null,
            byType: {
                2: remboursements.filter(r => r.value === 2).length,
                3: remboursements.filter(r => r.value === 3).length,
                4: remboursements.filter(r => r.value === 4).length
            }
        };
    });
    
    console.log("✅ Analyse remboursements terminée");
}

// ===========================================
// ANALYSE CONSOMMATION VS FORFAIT
// ===========================================

function analyzeConsumptionVsForfait() {
    console.log("📊 Analyse consommation vs forfait...");
    
    const clients = database.commercialData?.clients;
    if (!clients) return;
    
    clients.forEach(client => {
        const consoMoyenne = parseFloat(client.consommation?.moyenne) || 0;
        const forfaitName = client.forfaitName;
        const limits = FORFAIT_LIMITS[forfaitName];
        const forfaitMax = limits?.max || 1;
        
        const ratio = (consoMoyenne / forfaitMax) * 100;
        
        let adequation = "NON DÉTERMINÉ";
        let recommandation = "";
        let couleur = "#999";
        
        if (ratio > 90) {
            adequation = "SOUS-DIMENSIONNÉ";
            recommandation = "📈 Passer au forfait supérieur";
            couleur = "#f44336";
        } else if (ratio > 70) {
            adequation = "ADAPTÉ (forte utilisation)";
            recommandation = "👍 Forfait bien choisi";
            couleur = "#ff9800";
        } else if (ratio > 30) {
            adequation = "ADAPTÉ";
            recommandation = "✅ Forfait adapté";
            couleur = "#4CAF50";
        } else if (ratio > 0) {
            adequation = "SUR-DIMENSIONNÉ";
            recommandation = "📉 Proposer forfait économique";
            couleur = "#2196F3";
        }
        
        client.consumptionAnalysis = {
            consoMoyenne: consoMoyenne.toFixed(2),
            forfaitMax: forfaitMax,
            ratio: ratio.toFixed(1) + "%",
            adequation: adequation,
            recommandation: recommandation,
            couleur: couleur
        };
    });
}

// ===========================================
// CALCUL DU SCORE CLIENT
// ===========================================

function calculateClientScore() {
    console.log("🏆 Calcul des scores clients...");
    
    const clients = database.commercialData?.clients;
    if (!clients) return;
    
    clients.forEach(client => {
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
        
        let grade = "";
        let emoji = "";
        if (score >= 80) {
            grade = "EXCELLENT";
            emoji = "💎";
        } else if (score >= 60) {
            grade = "BON";
            emoji = "🟢";
        } else if (score >= 40) {
            grade = "FRAGILE";
            emoji = "🟠";
        } else {
            grade = "CRITIQUE";
            emoji = "🔴";
        }
        
        client.score = {
            valeur: score,
            grade: grade,
            emoji: emoji,
            raisons: raisons,
            alerte: raisons.length > 0 ? raisons.join(", ") : "Aucune anomalie"
        };
    });
}

// ===========================================
// GÉNÉRATION DES RECOMMANDATIONS
// ===========================================

function generateRecommendations() {
    console.log("💡 Génération des recommandations...");
    
    const clients = database.commercialData?.clients;
    if (!clients) return;
    
    const recommendations = [];
    
    clients.forEach(client => {
        const clientRec = {
            clientId: client.id,
            urgent: false,
            actions: [],
            synthese: {
                credit: null,
                recharge: null,
                forfait: null
            }
        };
        
        // ===== SYNTHÈSE CRÉDIT =====
        const totalJours = client.credits?.length || 0;
        const zeroCount = client.zeroCreditDates?.length || 0;
        const creditMax = client.maxCredit || 0;
        
        if (totalJours > 0) {
            clientRec.synthese.credit = `📅 Ce client a eu ${zeroCount} jour(s) sans crédit sur ${totalJours} jours analysés, avec un crédit maximum de ${creditMax.toFixed(2)} jours.`;
        }
        
        // ===== SYNTHÈSE RECHARGE =====
        const totalRecharges = client.totalRecharges || 0;
        const prefCredit = client.preferredCredit;
        const prefPercent = client.preferredPercentage;
        
        if (totalRecharges > 0 && prefCredit) {
            clientRec.synthese.recharge = `📱 Il recharge généralement pour ${prefCredit} jours (${prefPercent}% des ${totalRecharges} recharges).`;
        }
        
        // ===== SYNTHÈSE FORFAIT =====
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
        
        // ===== RECOMMANDATIONS SPÉCIFIQUES =====
        
        // Consommation vs forfait
        if (client.consumptionAnalysis) {
            const consoMoyenne = client.consumptionAnalysis.consoMoyenne;
            const forfaitMax = client.consumptionAnalysis.forfaitMax;
            const ratio = client.consumptionAnalysis.ratio;
            
            if (client.consumptionAnalysis.adequation === "SOUS-DIMENSIONNÉ") {
                clientRec.actions.push({
                    type: "upsell",
                    message: `⚡ Consommation moyenne de ${consoMoyenne} Wh (${ratio}) pour un forfait max de ${forfaitMax} Wh. Proposer forfait supérieur.`,
                    priorite: "haute"
                });
                clientRec.urgent = true;
            } else if (client.consumptionAnalysis.adequation === "SUR-DIMENSIONNÉ") {
                clientRec.actions.push({
                    type: "downsell",
                    message: `📉 Consommation moyenne de ${consoMoyenne} Wh (${ratio}) pour un forfait max de ${forfaitMax} Wh. Proposer forfait économique.`,
                    priorite: "moyenne"
                });
            }
        }
        
        // Remboursements techniques
        if (client.technicalRefunds?.isAbnormal) {
            const rembCount = client.technicalRefunds.count;
            const rembDetails = Object.entries(client.technicalRefunds.byType)
                .filter(([_, count]) => count > 0)
                .map(([type, count]) => `${count}x pour ${type} jours`)
                .join(', ');
            
            clientRec.actions.push({
                type: "technical",
                message: `🔧 ${rembCount} remboursements techniques détectés (${rembDetails}). Vérifier équipement client.`,
                priorite: "haute"
            });
            clientRec.urgent = true;
        }
        
        // Jours sans crédit
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
        
        // Changements de forfait
        const changes = client.forfaitChanges?.length || 0;
        if (changes > 2) {
            clientRec.actions.push({
                type: "stability",
                message: `🔄 ${changes} changements de forfait détectés. Contacter pour stabiliser.`,
                priorite: "basse"
            });
        }
        
        // Score bas
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
        
        // Stocker les recommandations
        if (clientRec.actions.length > 0 || clientRec.synthese.credit || clientRec.synthese.recharge || clientRec.synthese.forfait) {
            recommendations.push(clientRec);
        }
        
        client.recommendations = clientRec;
    });
    
    // Trier par urgence
    database.commercialData.recommendations = recommendations.sort((a, b) => {
        if (a.urgent && !b.urgent) return -1;
        if (!a.urgent && b.urgent) return 1;
        return 0;
    });
    
    console.log(`✅ ${recommendations.length} clients avec recommandations`);
}

// ===========================================
// CALCUL DES STATISTIQUES DE CONSOMMATION
// ===========================================

function calculateConsumptionStats() {
    console.log("📊 Calcul des stats de consommation...");
    
    const clients = database.commercialData?.clients;
    if (!clients) return;
    
    let totalConso = 0;
    let countConso = 0;
    let maxConso = 0;
    let minConso = Infinity;
    let joursSansConso = 0;
    
    clients.forEach(client => {
        const conso = client.consommation?.journaliere || [];
        
        if (conso.length > 0) {
            const clientMax = Math.max(...conso.map(c => c.valeur));
            const clientMoy = conso.reduce((s, c) => s + c.valeur, 0) / conso.length;
            const clientJoursSans = conso.filter(c => c.valeur < 0.1).length;
            
            maxConso = Math.max(maxConso, clientMax);
            minConso = Math.min(minConso, clientMoy);
            totalConso += clientMoy;
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
    
    console.log("✅ Stats consommation calculées");
}

// ===========================================
// PRÉPARATION CENTRALISÉE DES CLIENTS
// ===========================================

function prepareAllClients() {
    console.log("🛠️ Préparation centralisée des clients...");
    
    const clients = database.commercialData?.clients;
    if (!clients) return;
    
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent;
    
    clients.forEach(client => {
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
        
        client.technicalRefunds = client.technicalRefunds || { 
            count: 0, 
            isAbnormal: false,
            byType: { 2:0, 3:0, 4:0 }
        };
        
        client.consumptionAnalysis = client.consumptionAnalysis || {
            consoMoyenne: "0",
            forfaitMax: 1,
            ratio: "0%",
            adequation: "NON DÉTERMINÉ",
            recommandation: "",
            couleur: "#999"
        };
        
        client.score = client.score || {
            valeur: 50,
            grade: "NON DÉTERMINÉ",
            emoji: "❓",
            raisons: [],
            alerte: ""
        };
        
        client.recommendations = client.recommendations || { actions: [] };
        
        if (typeof client.id === 'string' && client.id.length > 3) {
            const extracted = extractClientId(client.id, nanoreseau);
            client.id = extracted;
        }
    });
    
    console.log(`✅ ${clients.size} clients préparés`);
}

// ===========================================
// FONCTIONS D'EXPORT
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
    return database.commercialData?.recommendations?.filter(r => r.urgent) || [];
}

export function getClientById(clientId) {
    const clients = database.commercialData?.clients;
    if (!clients) return null;
    return clients.get(clientId) || null;
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
    if (!energyData || !database.commercialData) return;
    
    const clients = database.commercialData.clients;
    let totalConso = 0;
    let countConso = 0;
    let maxConso = 0;
    let minConso = Infinity;
    let joursSansConso = 0;
    
    clients.forEach(client => {
        const consoJournaliere = energyData[client.id] || [];
        
        client.consommation.journaliere = consoJournaliere;
        
        if (consoJournaliere.length > 0) {
            const clientMax = Math.max(...consoJournaliere.map(c => c.valeur));
            const clientMoy = consoJournaliere.reduce((s, c) => s + c.valeur, 0) / consoJournaliere.length;
            const clientJoursSans = consoJournaliere.filter(c => c.valeur < 0.1).length;
            
            client.consommation.max = clientMax;
            client.consommation.moyenne = clientMoy;
            client.consommation.joursSans = clientJoursSans;
            
            maxConso = Math.max(maxConso, clientMax);
            minConso = Math.min(minConso, clientMoy);
            totalConso += clientMoy;
            countConso++;
            joursSansConso += clientJoursSans;
            
            if (client.forfaitActuel) {
                const forfaitName = FORFAIT_NAMES[client.forfaitActuel];
                const limits = FORFAIT_LIMITS[forfaitName];
                
                if (limits) {
                    consoJournaliere.forEach(jour => {
                        const ratio = (jour.valeur / limits.max) * 100;
                        
                        if (ratio > CONSUMPTION_THRESHOLDS.TOLERANCE_MAX) {
                            client.consommation.stats.depasse++;
                        } else if (ratio > CONSUMPTION_THRESHOLDS.NORMAL_MAX) {
                            client.consommation.stats.tolerance++;
                        } else {
                            client.consommation.stats.normal++;
                        }
                    });
                }
            }
        }
    });
    
    database.commercialData.consommation.globale = {
        max: maxConso,
        min: minConso === Infinity ? 0 : minConso,
        moyenne: countConso > 0 ? (totalConso / countConso).toFixed(2) : 0,
        joursSans: joursSansConso
    };
}