// dashboards/commercial/CommercialDashboard.js
import { database } from '../../arduinoCore.js';
import { FORFAIT_LIMITS } from '../../arduinoConstants.js';
import { FORFAIT_NAMES } from '../../arduinoConstants.js';
import { 
    analyzeZeroCreditSequences, 
    analyzeCreditZeroCauses, 
    generateSequenceRecommendation,
    formatSequenceForDisplay,
} from '../../analytics/interpretationAnalytics.js';

// Variable globale pour suivre le client actif
let activeClientId = null;
let clientsList = [];

export function renderCommercialDashboard() {
    const container = document.getElementById('commercialDashboard');
    if (!container) return;
    
    // Récupérer la liste des clients une fois pour toutes
    clientsList = Array.from(database.commercialData?.clients?.values() || [])
        .filter(c => typeof c.id === 'number' && c.id <= 50);
    
    // Définir le premier client comme actif par défaut
    activeClientId = clientsList.length > 0 ? clientsList[0].id : null;
    
    // Structure avec onglet client en haut
    const html = `
        <!-- Onglet client global en haut -->
        <div class="global-client-tabs-container">
            <h3>👥 Sélection client</h3>
            <div class="client-tabs-header">
                <button class="client-tab-nav prev" id="prevGlobalClient">◀</button>
                <div class="client-tabs" id="globalClientTabs"></div>
                <button class="client-tab-nav next" id="nextGlobalClient">▶</button>
            </div>
        </div>
        
        <div class="section-title"><h2>💰 I) ANALYSE DE CONSOMMATION</h2></div>
        <div id="consumptionBoard" class="card"></div>
        <div id="commercialEventsBoard" class="card"></div>
        <div id="forfaitChangesBoard" class="card"></div>
        
        <div class="section-title"><h2>💳 II) ANALYSE CRÉDIT ET RECHARGE</h2></div>
        <div id="creditBoard" class="card"></div>
        <div id="rechargeHabitsBoard" class="card"></div>
        
        <div class="section-title"><h2>📊 III) SOLDE ET RECHARGE</h2></div>
        <div id="balanceBoard" class="card"></div>
    `;
    
    container.innerHTML = html;
    
    // Rendre l'onglet client global
    renderGlobalClientTabs();
    
    // Rendre tous les boards avec le client actif
    renderAllBoards();
    
    // Attacher la navigation globale
    attachGlobalNavigation();
}

function renderGlobalClientTabs() {
    const container = document.getElementById('globalClientTabs');
    if (!container || clientsList.length === 0) return;
    
    container.innerHTML = clientsList.map(client => `
        <button class="client-tab ${client.id === activeClientId ? 'active' : ''}" data-client-id="${client.id}">
            Client ${client.id}
        </button>
    `).join('');
}

function attachGlobalNavigation() {
    setTimeout(() => {
        const tabs = document.querySelectorAll('#globalClientTabs .client-tab');
        const prevBtn = document.getElementById('prevGlobalClient');
        const nextBtn = document.getElementById('nextGlobalClient');
        
        if (!tabs.length) return;
        
        function switchToClient(clientId) {
            activeClientId = parseInt(clientId);
            
            // Mettre à jour les classes actives des onglets
            tabs.forEach(tab => {
                tab.classList.toggle('active', parseInt(tab.dataset.clientId) === activeClientId);
            });
            
            // Re-rendre tous les boards avec le nouveau client
            renderAllBoards();
        }
        
        // Ajouter les événements de clic sur les onglets
        tabs.forEach(tab => {
            tab.addEventListener('click', () => switchToClient(tab.dataset.clientId));
        });
        
        // Navigation précédent/suivant
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                const currentIndex = clientsList.findIndex(c => c.id === activeClientId);
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : clientsList.length - 1;
                switchToClient(clientsList[prevIndex].id);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const currentIndex = clientsList.findIndex(c => c.id === activeClientId);
                const nextIndex = currentIndex < clientsList.length - 1 ? currentIndex + 1 : 0;
                switchToClient(clientsList[nextIndex].id);
            });
        }
    }, 100);
}

function renderAllBoards() {
    // Rendre tous les boards avec le client actif
    renderKPIDashboard();
    renderConsumptionBoard();
    renderEventsBoard();
    renderForfaitChangesBoard();
    renderCreditBoard();
    renderRechargeHabitsBoard();
    renderBalanceBoard();
}

// Rendre accessible la fonction de détail
window.showClientDetail = (clientId) => {
    document.getElementById('clientDetailView').style.display = 'block';
    import('./ClientDetail.js').then(module => {
        module.renderClientDetail(clientId);
    });
};

function renderKPIDashboard() {
    const container = document.getElementById('kpiDashboard');
    if (!container) return;
    
    // Filtrer pour n'avoir que les clients valides
    const clients = clientsList;
    
    if (clients.length === 0) {
        container.innerHTML = '<p class="no-data">Aucun client disponible</p>';
        return;
    }
    
    // Calcul des KPI
    const kpis = calculateKPIs(clients);
    
    container.innerHTML = `
        <h3 class="card-title">📊 KPI GLOBAUX</h3>
        
        <!-- Grille 4 colonnes KPI -->
        <div class="kpi-grid">
            <div class="kpi-card kpi-primary">
                <div class="kpi-icon">👥</div>
                <div class="kpi-label">Total Clients</div>
                <div class="kpi-value">${clients.length}</div>
                <div class="kpi-sub">actifs</div>
            </div>
            
            <div class="kpi-card kpi-success">
                <div class="kpi-icon">⭐</div>
                <div class="kpi-label">Score Moyen</div>
                <div class="kpi-value">${kpis.averageScore.toFixed(1)}</div>
                <div class="kpi-sub">/ 100</div>
            </div>
            
            <div class="kpi-card kpi-warning">
                <div class="kpi-icon">⚠️</div>
                <div class="kpi-label">Clients à Risque</div>
                <div class="kpi-value">${kpis.atRiskCount}</div>
                <div class="kpi-sub">${kpis.atRiskPercent.toFixed(1)}%</div>
            </div>
            
            <div class="kpi-card kpi-info">
                <div class="kpi-icon">⚡</div>
                <div class="kpi-label">Conso Moyenne</div>
                <div class="kpi-value">${kpis.avgConsumption.toFixed(0)}</div>
                <div class="kpi-sub">Wh/jour</div>
            </div>
        </div>
        
        <!-- Distribution par profil -->
        <div class="kpi-distribution">
            <h4>Distribution Profils Clients</h4>
            <div class="profile-bars">
                ${['A', 'B', 'C', 'D'].map(grade => {
                    const count = kpis.profileDistribution[grade] || 0;
                    const percent = clients.length > 0 ? ((count / clients.length) * 100).toFixed(1) : 0;
                    return `
                        <div class="profile-bar">
                            <div class="profile-label">Profil ${grade}</div>
                            <div class="profile-bar-container">
                                <div class="profile-bar-fill grade-${grade}" style="width: ${percent}%"></div>
                            </div>
                            <div class="profile-count">${count} (${percent}%)</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <!-- Recommandations principales -->
        <div class="kpi-recommendations">
            <h4>🎯 Actions Prioritaires</h4>
            <ul class="action-list">
                ${kpis.atRiskCount > 0 ? `<li class="action-danger">Contacter <strong>${kpis.atRiskCount}</strong> clients à risque</li>` : ''}
                ${kpis.zeroCreditCount > 0 ? `<li class="action-warning">Suivre <strong>${kpis.zeroCreditCount}</strong> clients sans crédit régulièrement</li>` : ''}
                ${kpis.highConsumption > 0 ? `<li class="action-info">Étudier <strong>${kpis.highConsumption}</strong> dépassements de forfait</li>` : ''}
            </ul>
        </div>
    `;
}

function calculateKPIs(clients) {
    const totalClients = clients.length;
    
    // Scores
    const scores = clients.map(c => c.score?.valeur || 0);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    // Clients à risque (score < 40)
    const atRiskCount = clients.filter(c => c.score?.valeur < 40).length;
    const atRiskPercent = totalClients > 0 ? (atRiskCount / totalClients) * 100 : 0;
    
    // Consommation moyenne
    const consumptions = clients
        .map(c => c.consommation?.moyenne || 0)
        .filter(v => v > 0);
    const avgConsumption = consumptions.length > 0 
        ? consumptions.reduce((a, b) => a + b, 0) / consumptions.length 
        : 0;
    
    // Distribution par profil
    const profileDistribution = {
        A: clients.filter(c => c.score?.grade === 'A').length,
        B: clients.filter(c => c.score?.grade === 'B').length,
        C: clients.filter(c => c.score?.grade === 'C').length,
        D: clients.filter(c => c.score?.grade === 'D').length
    };
    
    // Clients sans crédit
    const zeroCreditCount = clients.filter(c => (c.zeroCreditPercentage || 0) > 30).length;
    
    // Dépassement de forfait
    const highConsumption = clients.filter(c => {
        const conso = c.consommation?.moyenne || 0;
        const max = c.consommation?.max || 0;
        return max > (c.forfaitActuel ? 120 : 100);
    }).length;
    
    return {
        totalClients,
        averageScore,
        atRiskCount,
        atRiskPercent,
        avgConsumption,
        profileDistribution,
        zeroCreditCount,
        highConsumption
    };
}

function renderConsumptionBoard() {
    const container = document.getElementById('consumptionBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<p class="no-data">❌ Aucun client sélectionné</p>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<p class="no-data">❌ Client non trouvé</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">📊 ANALYSE DE CONSOMMATION - Client ${client.id}</h3>
        ${renderConsumptionClient(client)}
    `;
}

function renderConsumptionClient(client) {
    // Récupérer la conso du client
    const conso = client.consommation?.journaliere || [];
    const forfaitName = client.forfaitName;
    const forfaitMax = FORFAIT_LIMITS[forfaitName]?.max || 1;
    
    // Calculer les stats demandées par le chef
    const energieMax = Math.max(...conso.map(c => c.valeur), 0);
    const energieMoy = conso.length > 0 
        ? (conso.reduce((s, c) => s + c.valeur, 0) / conso.length).toFixed(2)
        : 0;
    const joursSans = conso.filter(c => c.valeur < 0.1).length;
    
    let joursDepasse90 = 0;
    let joursNormal = 0;
    let joursTolerance = 0;
    let joursHorsTolerance = 0;
    
    conso.forEach(jour => {
        const ratio = (jour.valeur / forfaitMax) * 100;
        if (ratio > 114) joursHorsTolerance++;
        else if (ratio > 100) joursTolerance++;
        else if (ratio > 90) joursDepasse90++;
        else joursNormal++;
    });
    
    const totalJours = conso.length;
    const normalPercent = totalJours > 0 ? ((joursNormal / totalJours) * 100).toFixed(1) : 0;
    const tolerancePercent = totalJours > 0 ? ((joursTolerance / totalJours) * 100).toFixed(1) : 0;
    const horsTolerancePercent = totalJours > 0 ? ((joursHorsTolerance / totalJours) * 100).toFixed(1) : 0;
    
    return `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">⚡</span>
                <span class="client-id">Client ${client.id}</span>
                <span class="client-badge">Forfait: ${forfaitName}</span>
            </div>
            
            <!-- Stats principales (demandées par le chef) -->
            <div class="stats-grid-4">
                <div class="stat-item">
                    <span class="stat-label">⚡ Énergie max</span>
                    <span class="stat-value">${energieMax.toFixed(2)} Wh</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">📊 Énergie moy</span>
                    <span class="stat-value">${energieMoy} Wh</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">📅 Jour(s) sans</span>
                    <span class="stat-value ${joursSans > 0 ? 'warning' : ''}">${joursSans}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">📈 Jour(s) >90%</span>
                    <span class="stat-value">${joursDepasse90}</span>
                </div>
            </div>
            

            <!-- Répartition en pourcentages avec détails -->
            <div class="distribution-section">
                <h4>Répartition de la consommation</h4>
                
                <div class="percent-bar">
                    <div class="bar-label">
                        <span class="label-with-icon">✅ taux de consommation normale</span>
                        <span class="percentage-value">${normalPercent}%</span>
                    </div>
                    <div class="bar-detail">
                        <span class="detail-count">${joursNormal} jour(s) sur ${totalJours}</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill success" style="width: ${normalPercent}%"></div>
                    </div>
                </div>
                
                <div class="percent-bar">
                    <div class="bar-label">
                        <span class="label-with-icon">🟠 taux de consommation dans la Tolérance</span>
                        <span class="percentage-value">${tolerancePercent}%</span>
                    </div>
                    <div class="bar-detail">
                        <span class="detail-count">${joursTolerance} jour(s) sur ${totalJours}</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill warning" style="width: ${tolerancePercent}%"></div>
                    </div>
                </div>
                
                <div class="percent-bar">
                    <div class="bar-label">
                        <span class="label-with-icon">🔴 taux de consommation hors tolérance</span>
                        <span class="percentage-value">${horsTolerancePercent}%</span>
                    </div>
                    <div class="bar-detail">
                        <span class="detail-count">${joursHorsTolerance} jour(s) sur ${totalJours}</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill danger" style="width: ${horsTolerancePercent}%"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderEventsBoard() {
    const container = document.getElementById('commercialEventsBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<p class="no-data">❌ Aucun client sélectionné</p>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<p class="no-data">❌ Client non trouvé</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">⚠️ ÉVÉNEMENTS - Client ${client.id}</h3>
        ${renderEventsClient(client)}
    `;
}

function renderEventsClient(client) {
    // Filtrer les événements de ce client
    const events = client.events || [];
    
    const suspendE = events.filter(e => e.type === 'SuspendE').length;
    const suspendP = events.filter(e => e.type === 'SuspendP').length;
    const surcharge = events.filter(e => e.type === 'Surcharge').length;
    
    // Jours avec crédit nul pour ce client
    const zeroCreditDates = client.zeroCreditDates || [];
    const zeroCreditJours = zeroCreditDates.length;
    const zeroCreditPourcent = client.zeroCreditPercentage || 0;
    
    return `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">⚠️</span>
                <span class="client-id">Client ${client.id}</span>
                <span class="client-badge">${events.length} événements</span>
            </div>
            
            <!-- Stats événements -->
            <div class="stats-grid-4">
                <div class="stat-item">
                    <span class="stat-label">🔮 SuspendE</span>
                    <span class="stat-value">${suspendE}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">💰 SuspendP</span>
                    <span class="stat-value">${suspendP}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">⚡ Surcharge</span>
                    <span class="stat-value">${surcharge}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">📅 Crédit nul</span>
                    <span class="stat-value">${zeroCreditJours} jour(s)</span>
                </div>
            </div>
            
            <!-- Détail crédit nul -->
            <div class="detail-section">
                <h4>📊 Analyse crédit nul</h4>
                <div class="info-row">
                    <span>Jour(s) sans crédit:</span>
                    <span class="value">${zeroCreditJours}</span>
                </div>
                <div class="info-row">
                    <span>Pourcentage:</span>
                    <span class="value ${zeroCreditPourcent > 20 ? 'warning' : ''}">${zeroCreditPourcent}%</span>
                </div>
                ${zeroCreditJours > 0 ? `
                    <div class="zero-list-small">
                        ${zeroCreditDates.slice(0, 5).map(d => 
                            `<span class="zero-badge">${d}</span>`
                        ).join('')}
                        ${zeroCreditJours > 5 ? `<span class="more">+${zeroCreditJours-5}</span>` : ''}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderForfaitChangesBoard() {
    const container = document.getElementById('forfaitChangesBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<p class="no-data">❌ Aucun client sélectionné</p>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<p class="no-data">❌ Client non trouvé</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">🔄 CHANGEMENTS DE FORFAIT - Client ${client.id}</h3>
        ${renderForfaitClient(client)}
    `;
}

function renderForfaitClient(client) {
    const changes = client.forfaitChanges || [];
    const forfaitActuel = FORFAIT_NAMES[client.forfaitActuel] || `Forfait ${client.forfaitActuel}`;    
    return `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">🔄</span>
                <span class="client-id">Client ${client.id}</span>
                <span class="client-badge">${changes.length} changements</span>
            </div>
            
            <!-- Forfait actuel -->
            <div class="current-forfait">
                <span class="label">Forfait actuel:</span>
                <span class="value">${forfaitActuel}</span>
            </div>
            
            <!-- Historique des changements -->
            ${changes.length > 0 ? `
                <h4>📋 Historique</h4>
                <div class="changes-timeline">
                    ${changes.map(change => {
                        const ancien = FORFAIT_NAMES[change.ancien] || `Forfait ${change.ancien}`;
                        const nouveau = FORFAIT_NAMES[change.nouveau] || `Forfait ${change.nouveau}`;
                        return `
                            <div class="change-item">
                                <span class="change-date">${change.date}</span>
                                <span class="change-old">${ancien}</span>
                                <span class="change-arrow">→</span>
                                <span class="change-new">${nouveau}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : '<p class="no-data">Aucun changement de forfait</p>'}
            
            <!-- Indicateur de stabilité -->
            <div class="stability-indicator">
                <span class="label">Stabilité:</span>
                <span class="value ${changes.length > 2 ? 'warning' : 'success'}">
                    ${changes.length === 0 ? '✅ Stable' : 
                      changes.length === 1 ? '🟡 Peu de changements' : 
                      '🔴 Instable'}
                </span>
            </div>
        </div>
    `;
}

function renderRechargeHabitsBoard() {
    const container = document.getElementById('rechargeHabitsBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<p class="no-data">❌ Aucun client sélectionné</p>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<p class="no-data">❌ Client non trouvé</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">💳 HABITUDES DE RECHARGE - Client ${client.id}</h3>
        ${renderHabitsClient(client)}
    `;
}

function renderHabitsClient(client) {
    const recharges = client.recharges || [];
    const creditPercentages = client.creditPercentages || {};
    const preferredCredit = client.preferredCredit;
    const preferredPercentage = client.preferredPercentage || 0;
    const forfaitName = client.forfaitName || 'Inconnu';
    
    // Distribution des montants
    const montants = Object.entries(creditPercentages)
        .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
    
    return `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">💳</span>
                <span class="client-id">Client ${client.id}</span>
                <span class="client-badge">${recharges.length} recharges</span>
            </div>
            
            <div class="stats-grid-3">
                <div class="stat-item">
                    <span class="stat-label">📊 Forfait</span>
                    <span class="stat-value">${forfaitName}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">💎 Crédit souvent utilisé</span>
                    <span class="stat-value">${preferredCredit || 'N/A'} jour(s)</span>
                    <span class="stat-detail">${preferredPercentage}% des recharges</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">💰 Crédit moyen</span>
                    <span class="stat-value">${client.creditMoyen || 0} </span>
                </div>
            </div>
            
            <h4>📊 Distribution des crédits</h4>
            <div class="credit-distribution">
                ${montants.map(([montant, pourcentage]) => `
                    <div class="percent-bar">
                        <div class="bar-label">
                            <span>${montant} jour(s)</span>
                            <span>${pourcentage}%</span>
                        </div>
                        <div class="bar-container">
                            <div class="bar-fill" style="width: ${pourcentage}%; background: #4CAF50;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <h4>⏱️ Dernières recharges</h4>
            <div class="recent-list">
                ${recharges.slice(-5).reverse().map(r => `
                    <div class="recharge-item">
                        <span class="recharge-date">${r.date}</span>
                        <span class="recharge-amount">${r.credit} jour(s)</span>
                        <span class="recharge-forfait">${FORFAIT_NAMES[r.forfait] || r.forfait}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderCreditBoard() {
    const container = document.getElementById('creditBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<p class="no-data">❌ Aucun client sélectionné</p>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<p class="no-data">❌ Client non trouvé</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">💰 ANALYSE CRÉDIT - Client ${client.id}</h3>
        ${renderCreditClient(client)}
    `;
}

function renderCreditClient(client) {
    const zeroCount = client.zeroCreditDates?.length || 0;
    const zeroPercent = client.zeroCreditPercentage || 0;
    const creditMoyen = client.averageCredit || 0;
    const creditMax = client.maxCredit || 0;
    const totalRecharges = client.totalRecharges || 0;
    
    // Analyser les séquences
    const sequences = analyzeZeroCreditSequences(client.zeroCreditDates || []);
    
    return `
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
                <!-- ANALYSE DES SÉQUENCES CONSÉCUTIVES -->
                <div class="sequences-section">
                    <h4>🔍 Analyse des séquences sans crédit</h4>
                    ${renderSequencesAnalysis(sequences, client)}
                </div>
            ` : ''}
        </div>
    `;
}

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

function renderCauseTextSummary(causeResult) {
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

function renderBalanceBoard() {
    const container = document.getElementById('balanceBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<p class="no-data">❌ Aucun client sélectionné</p>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<p class="no-data">❌ Client non trouvé</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">📊 SOLDE & RECHARGE - Client ${client.id}</h3>
        ${renderBalanceClient(client)}
    `;
}

function renderBalanceClient(client) {
    // Données
    const dernierCredit = client.credits?.slice(-1)[0]?.value || 0;
    const credits = client.credits || [];
    const joursAnalyses = client.count || credits.length;
    const joursSansCredit = client.zeroCreditDates?.length || 0;
    const maxCredit = client.maxCredit || 0;
    const totalRecharges = client.totalRecharges || 0;
    
    // Pourcentage jours sans crédit
    const pourcentageSans = joursAnalyses > 0 
        ? ((joursSansCredit / joursAnalyses) * 100).toFixed(1) 
        : 0;
    
    // Message sur les jours sans crédit
    let messageJoursSans = "";
    if (joursSansCredit === 0) {
        messageJoursSans = "✅ Ce client n'a jamais été à découvert.";
    } else if (pourcentageSans < 10) {
        messageJoursSans = `⚠️ Ce client a eu ${joursSansCredit} jour(s) sans crédit sur ${joursAnalyses} jours analysés (${pourcentageSans}%), ce qui reste acceptable.`;
    } else {
        messageJoursSans = `🔴 Ce client a eu ${joursSansCredit} jour(s) sans crédit sur ${joursAnalyses} jours analysés (${pourcentageSans}%). Une attention particulière est recommandée.`;
    }
    
    // Message sur le crédit max
    let messageCreditMax = `💳 Son plus gros crédit était de ${maxCredit} jour(s).`;
    
    // Message sur les recharges
    let messageRecharges = "";
    if (totalRecharges === 0) {
        messageRecharges = "📱 Aucune recharge enregistrée.";
    } else if (totalRecharges < 5) {
        messageRecharges = `📱 Il a effectué ${totalRecharges} recharge(s) seulement.`;
    } else {
        messageRecharges = `📱 Il recharge régulièrement (${totalRecharges} fois).`;
    }
    
    // Message sur le crédit préféré
    const creditPrefere = client.preferredCredit || "non déterminé";
    const pourcentagePref = client.preferredPercentage || 0;
    let messageCreditPref = "";
    if (creditPrefere !== "non déterminé") {
        messageCreditPref = `📊 Il recharge généralement pour ${creditPrefere} jour(s) (${pourcentagePref}% des recharges).`;
    }
    
    // Message sur les forfaits
    let messageForfaits = "";
    const forfaitActuel = client.forfaitName || "inconnu";
    const changements = client.forfaitChanges || [];
    
    if (changements.length === 0) {
        messageForfaits = `📦 Forfait actuel : ${forfaitActuel} (aucun changement).`;
    } else {
        const historique = changements.map(c => 
            `${FORFAIT_NAMES[c.ancien] || c.ancien} → ${FORFAIT_NAMES[c.nouveau] || c.nouveau}`
        ).join(", ");
        messageForfaits = `📦 Forfaits utilisés : ${historique} (actuel : ${forfaitActuel}).`;
    }
    
    // Score
    const scoreMsg = client.score?.alerte 
        ? `🏷️ ${client.score.alerte}`
        : "🏷️ Profil standard";
    
    return `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">📊</span>
                <span class="client-id">Synthèse client ${client.id}</span>
                <span class="client-badge">${scoreMsg}</span>
            </div>
            
            <div class="message-container">
                <p class="client-message">${messageJoursSans}</p>
                <p class="client-message">${messageRecharges}</p>
                <p class="client-message">${messageCreditPref}</p>
                <p class="client-message">${messageForfaits}</p>
                <p class="client-message">${messageCreditMax}</p>
            </div>
            
            ${client.score?.raisons?.length > 0 ? `
                <div class="alert-section">
                    <h4>🔔 Alertes</h4>
                    <ul>
                        ${client.score.raisons.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${client.recommendations?.actions?.length > 0 ? `
                <div class="recommendation-section">
                    <h4>💡 Recommandation</h4>
                    <p class="recommendation-text">
                        ${client.recommendations.actions[0]?.message || "Aucune recommandation"}
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}

// Supprimer toutes les fonctions de navigation et de rendu des onglets individuels
// (renderConsumptionTabs, renderEventsTabs, renderForfaitTabs, renderHabitsTabs, renderCreditTabs, renderBalanceTabs)
// et leurs fonctions attach* correspondantes