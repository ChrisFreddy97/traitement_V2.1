// dashboards/commercial/CreditBoard.js
import { database } from '../../arduinoCore.js';
import { 
    analyzeZeroCreditSequences, 
    analyzeCreditZeroCauses, 
    generateSequenceRecommendation,
    formatSequenceForDisplay 
} from '../../creditAnalyzer.js';

export function renderCreditBoard() {
    const container = document.getElementById('creditBoard');
    if (!container) return;
    
    const clientsMap = database.commercialData?.clients;
    if (!clientsMap) {
        container.innerHTML = '<p class="no-data">Aucune donnée</p>';
        return;
    }
    
    const clients = Array.from(clientsMap.values()).filter(c => typeof c.id === 'number' && c.id <= 20); // Filtrer les fantômes
    
    container.innerHTML = `
        <h3 class="card-title">💰 CRÉDITS PAR CLIENT</h3>
        
        <div class="client-tabs-container">
            <button class="client-tab-nav prev" id="prevCreditClient">◀</button>
            <div class="client-tabs" id="creditClientTabs"></div>
            <button class="client-tab-nav next" id="nextCreditClient">▶</button>
        </div>
        
        <div id="activeCreditClient" class="client-content"></div>
    `;
    
    renderCreditTabs(clients);
    renderCreditClient(clients[0]);
    attachCreditNavigation(clients);
}

function renderCreditTabs(clients) {
    const container = document.getElementById('creditClientTabs');
    if (!container) return;
    
    container.innerHTML = clients.map((client, index) => `
        <button class="client-tab ${index === 0 ? 'active' : ''}" data-index="${index}">
            Client ${client.id}
        </button>
    `).join('');
}

function renderCreditClient(client) {
    const container = document.getElementById('activeCreditClient');
    if (!container) return;
    
    const zeroCount = client.zeroCreditDates?.length || 0;
    const zeroPercent = client.zeroCreditPercentage || 0;
    const creditMoyen = client.averageCredit || 0;
    const creditMax = client.maxCredit || 0;
    const totalRecharges = client.totalRecharges || 0;
    
    // ===== NOUVEAU: Analyser les séquences =====
    const sequences = analyzeZeroCreditSequences(client.zeroCreditDates || []);
    
    container.innerHTML = `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">💰</span>
                <span class="client-id">Client ${client.id}</span>
                <span class="client-badge ${zeroCount > 0 ? 'badge-warning' : 'badge-success'}">
                    ${zeroCount} jour(s) sans crédit
                </span>
            </div>
            
            <div class="credit-summary">
                <div class="summary-item">
                    ${zeroCount === 0 ? 
                        '✅ <strong>Bon client</strong> - Recharge régulièrement son crédit. Aucun problème détecté.' :
                        zeroCount <= 2 ? 
                            '⚠️ <strong>À surveiller</strong> - ' + zeroCount + ' jour(s) sans crédit. Peut être un oubli.' :
                            '🔴 <strong>À traiter!</strong> - ' + zeroCount + ' jour(s) sans crédit (' + zeroPercent + '%). Risque de perte client.'
                    }
                </div>
            </div>
            
            ${zeroCount > 0 ? `
                <!-- NOUVEAU: ANALYSE DES SÉQUENCES CONSÉCUTIVES -->
                <div class="sequences-section">
                    <h4>🔍 Analyse des séquences sans crédit</h4>
                    ${renderSequencesAnalysis(sequences, client)}
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Afficher l'analyse détaillée des séquences
 */
function renderSequencesAnalysis(sequences, client) {
    if (sequences.length === 0) return '<p class="no-data">Aucune séquence</p>';

    return `
        <div class="sequences-grid">
            ${sequences.map((seq, idx) => {
                const causes = analyzeCreditZeroCauses(client, seq.dates);
                const displayInfo = formatSequenceForDisplay(seq, causes);
                const recommendation = generateSequenceRecommendation(client, seq, causes);
                
                return `
                    <div class="sequence-card severity-${displayInfo.severity}">
                        <!-- Header séquence -->
                        <div class="sequence-header">
                            <span class="sequence-badge ${displayInfo.isRecent ? 'recent' : ''}">
                                ${displayInfo.isRecent ? '🔴 RÉCENT' : ''}
                                ${displayInfo.label}
                            </span>
                            <span class="severity-icon">${getSeverityIcon(displayInfo.severity)}</span>
                        </div>
                        
                        <!-- Dates de la séquence -->
                        <div class="sequence-dates">
                            <div class="date-range">
                                <span class="label">Du:</span>
                                <span class="date">${seq.startDate}</span>
                            </div>
                            ${seq.startDate !== seq.endDate ? `
                                <div class="date-range">
                                    <span class="label">Au:</span>
                                    <span class="date">${seq.endDate}</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <!-- Causes et Action (simplifié) -->
                        <div class="causes-section-simple">
                            <div class="cause-summary">
                                ${renderCauseTextSummary(causes)}
                            </div>
                            <div class="recommendation ${recommendation.priority}">
                                <div class="rec-action-text">${recommendation.action}</div>
                                <div class="rec-message">${recommendation.message}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Résumé textuel UNE SEULE CAUSE CERTAINE (simplifié)
 */
function renderCauseTextSummary(causeResult) {
    // causeResult = {mainCause, confidence, evidence}
    const cause = causeResult?.mainCause || 'unknown';
    const confidence = ((causeResult?.confidence || 0) * 100).toFixed(0);

    const causes = {
        noRecharge: {
            emoji: '📵',
            name: 'Pas de recharge',
            text: `Client n'a pas rechargé son crédit.`
        },
        highConsumption: {
            emoji: '⚡',
            name: 'Consommation élevée',
            text: `Client consomme plus que son forfait.`
        },
        technicalEvent: {
            emoji: '⚠️',
            name: 'Interruption technique',
            text: `Coupure ou maintenance détectée.`
        },
        insufficientForfait: {
            emoji: '📦',
            name: 'Forfait insuffisant',
            text: `Forfait trop petit pour la consommation réelle.`
        },
        payment: {
            emoji: '💳',
            name: 'Problème de paiement',
            text: `Recharges échouées. Problème banque/carte.`
        },
        overload: {
            emoji: '🔥',
            name: 'Surcharge anormale',
            text: `Consommation anormalement élevée sur équipement.`
        },
        system: {
            emoji: '🔧',
            name: 'Anomalie système',
            text: `Séquence longue. Possible bug système.`
        },
        noActivity: {
            emoji: '🕳️',
            name: 'Compte inactif',
            text: `Aucune activité recharge enregistrée.`
        },
        unknown: {
            emoji: '❓',
            name: 'À investiguer',
            text: `Cause incertaine.`
        }
    };

    const info = causes[cause] || causes.unknown;
    return `<p class="cause-main"><strong>${info.emoji} ${info.name}:</strong> ${info.text}</p>`;
}

function getSeverityIcon(severity) {
    const icons = {
        critical: '🔴',
        warning: '🟠',
        info: '🔵'
    };
    return icons[severity] || '⚪';
}

function getPriorityBadge(priority) {
    const badges = {
        urgente: '🔴 URGENTE - Appeler immédiatement',
        haute: '🟠 HAUTE - À traiter aujourd\'hui',
        moyenne: '🟡 MOYENNE - Suivi cette semaine',
        basse: '🟢 BASSE - À monitorer'
    };
    return badges[priority] || '⚪ À analyser';
}

function attachCreditNavigation(clients) {
    setTimeout(() => {
        const tabs = document.querySelectorAll('#creditClientTabs .client-tab');
        const container = document.getElementById('activeCreditClient');
        const prevBtn = document.getElementById('prevCreditClient');
        const nextBtn = document.getElementById('nextCreditClient');
        
        if (!tabs.length) return;
        
        let activeIndex = 0;
        
        function switchToClient(index) {
            if (index < 0 || index >= clients.length) return;
            activeIndex = index;
            
            tabs.forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
            });
            
            renderCreditClient(clients[index]);
        }
        
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => switchToClient(index));
        });
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                switchToClient(activeIndex > 0 ? activeIndex - 1 : clients.length - 1);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                switchToClient(activeIndex < clients.length - 1 ? activeIndex + 1 : 0);
            });
        }
    }, 100);
}