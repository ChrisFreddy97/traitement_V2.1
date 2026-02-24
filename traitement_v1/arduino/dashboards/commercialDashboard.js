// dashboards/commercialDashboard.js
import { database } from '../arduinoCore.js';

export function renderCommercialDashboard() {
    const container = document.getElementById('commercialDashboard');
    if (!database.commercialData) {
        if (container) container.innerHTML = '';
        return;
    }

    const hasRecharge = database.rechargeAnalysis && database.rechargeAnalysis.clients.length > 0;

    const html = `
        <div class="mode-selector">
            <button class="mode-btn active" data-mode="credit">💰 Crédits (jours à 0)</button>
            ${hasRecharge ? '<button class="mode-btn" data-mode="recharge">💳 Recharges (forfaits)</button>' : ''}
        </div>
        
        <div class="client-tabs-container">
            <button class="client-tab-nav prev" id="prevClient">◀</button>
            <div class="client-tabs" id="clientTabs"></div>
            <button class="client-tab-nav next" id="nextClient">▶</button>
        </div>
        
        <div id="activeClientContainer"></div>
    `;

    container.innerHTML = html;

    // Mode par défaut: crédits
    showCreditMode();

    // Gestionnaires pour les boutons de mode
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            if (e.target.dataset.mode === 'credit') {
                showCreditMode();
            } else {
                showRechargeMode();
            }
        });
    });
}

function showCreditMode() {
    const clients = database.commercialData.clients;
    if (!clients || clients.length === 0) return;
    
    renderClientTabs(clients);
    renderCreditClient(clients[0]);
    attachClientNavigation(clients, 'credit');
}

function showRechargeMode() {
    const clients = database.rechargeAnalysis.clients;
    if (!clients || clients.length === 0) return;
    
    renderClientTabs(clients);
    renderRechargeClient(clients[0]);
    attachClientNavigation(clients, 'recharge');
}

function renderClientTabs(clients) {
    const container = document.getElementById('clientTabs');
    if (!container || !clients) return;
    
    container.innerHTML = clients.map((client, index) => `
        <button class="client-tab ${index === 0 ? 'active' : ''}" data-index="${index}">
            Client ${client.id}
        </button>
    `).join('');
}

function renderCreditClient(client) {
    const container = document.getElementById('activeClientContainer');
    if (!container || !client) return;
    
    const zeroCount = client.zeroCreditDates?.length || 0;
    const zeroList = client.zeroCreditDates?.map(date => 
        `<div class="zero-item">${date}</div>`
    ).join('') || '';
    
    container.innerHTML = `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">💰</span>
                <span class="client-id">Client ${client.id}</span>
                <span class="client-badge ${zeroCount > 0 ? 'badge-warning' : 'badge-success'}">
                    ${zeroCount} jour(s) à 0
                </span>
            </div>
            
            <div class="client-stats">
                <div class="stat">
                    <div class="stat-label">Crédit moyen</div>
                    <div class="stat-value">${client.averageCredit?.toFixed(2) || '0'}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Crédit max</div>
                    <div class="stat-value">${client.maxCredit || '0'}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">% jours à 0</div>
                    <div class="stat-value">${client.zeroCreditPercentage?.toFixed(1) || '0'}%</div>
                </div>
            </div>
            
            <div class="zero-section">
                <h4>📅 Jours sans crédit</h4>
                ${zeroCount > 0 ? 
                    `<div class="zero-list">${zeroList}</div>` : 
                    '<p class="no-data">✅ Aucun jour sans crédit</p>'
                }
            </div>
        </div>
    `;
}

function renderRechargeClient(client) {
    const container = document.getElementById('activeClientContainer');
    if (!container || !client) {
        container.innerHTML = '<div class="loading-spinner">Chargement...</div>';
        return;
    }
    
    const changes = client.forfaitChanges || [];
    const recent = client.dernieresRecharges || [];
    
    const changesHtml = changes.map(c => `
        <div class="change-item">
            <span class="change-date">${c.date}</span>
            <span class="change-old">Forfait ${c.ancien}</span>
            <span class="change-arrow">→</span>
            <span class="change-new">Forfait ${c.nouveau}</span>
        </div>
    `).join('');
    
    const recentHtml = recent.map(r => `
        <div class="recent-item">
            <span class="recent-date">${r.date}</span>
            <span class="recent-credit">${r.credit}</span>
            <span class="recent-forfait">Forfait ${r.forfait}</span>
        </div>
    `).join('');
    
    const creditData = client.creditPercentages || {};
    const hasCreditData = Object.keys(creditData).length > 0;
    const chartId = `creditChart_${client.id}`;
    
    container.innerHTML = `
        <div class="client-card">
            <!-- En-tête -->
            <div class="client-header">
                <span class="client-icon">💳</span>
                <span class="client-id">Client ${client.id}</span>
                <span class="client-badge">${client.totalRecharges} recharges</span>
            </div>
            
            <!-- Stats principales (3 colonnes) -->
            <div class="client-stats">
                <div class="stat">
                    <div class="stat-label">Crédit + acheté</div>
                    <div class="stat-value">${client.preferredCredit || 'N/A'}</div>
                    <div class="stat-percent">${client.preferredPercentage || '0'}%</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Total recharges</div>
                    <div class="stat-value">${client.totalRecharges}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Changements forfait</div>
                    <div class="stat-value">${changes.length}</div>
                </div>
            </div>
            
            <!-- Changements de forfait (si existent) -->
            ${changes.length > 0 ? `
                <div class="changes-section">
                    <h4>🔄 Changements de forfait</h4>
                    <div class="changes-list">${changesHtml}</div>
                </div>
            ` : ''}
            
            <!-- Section à 2 colonnes : Répartition + Dernières recharges -->
            <div class="client-two-columns">
                <!-- Colonne gauche : Répartition des achats -->
                <div class="credit-distribution">
                    <h4>📊 Répartition des achats</h4>
                    ${hasCreditData ? `
                        <div class="chart-container-small">
                            <canvas id="${chartId}"></canvas>
                        </div>
                        <div class="credit-legend">
                            ${Object.entries(creditData).map(([credit, percent]) => `
                                <div class="legend-item">
                                    <span class="legend-color" style="background: ${getColorForCredit(credit)}"></span>
                                    <span class="legend-label">Crédit ${credit}</span>
                                    <span class="legend-percent">${percent}%</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="no-data">Aucune donnée de crédit</p>'}
                </div>
                
                <!-- Colonne droite : Dernières recharges -->
                <div class="recent-section">
                    <h4>📋 Dernières recharges</h4>
                    <div class="recent-list">
                        ${recentHtml || '<p class="no-data">Aucune recharge</p>'}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if (hasCreditData) {
        setTimeout(() => {
            createCreditChart(chartId, creditData);
        }, 100);
    }
}

// Fonction pour obtenir une couleur par type de crédit
function getColorForCredit(credit) {
    const colors = {
        '1': '#FF6384',
        '2': '#36A2EB',
        '3': '#FFCE56',
        '7': '#4BC0C0',
        '30': '#9966FF',
        '0': '#E7E9ED'
    };
    return colors[credit] || '#999999';
}

// Fonction pour créer le graphique circulaire
function createCreditChart(canvasId, creditData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const labels = Object.keys(creditData).map(c => `Crédit ${c}`);
    const data = Object.values(creditData).map(v => parseFloat(v));
    const colors = Object.keys(creditData).map(c => getColorForCredit(c));
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `${context.label}: ${context.raw}%`;
                        }
                    }
                }
            },
            layout: {
                padding: 0
            }
        }
    });
}
function attachClientNavigation(clients, mode) {
    setTimeout(() => {
        const tabs = document.querySelectorAll('.client-tab');
        const container = document.getElementById('activeClientContainer');
        const prevBtn = document.getElementById('prevClient');
        const nextBtn = document.getElementById('nextClient');
        
        if (!tabs.length || !container || !clients) return;
        
        let activeIndex = 0;
        
        function switchToClient(index) {
            if (index < 0 || index >= clients.length) return;
            activeIndex = index;
            
            tabs.forEach((tab, i) => {
                if (i === index) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
            
            const client = clients[index];
            if (mode === 'credit') {
                renderCreditClient(client);
            } else {
                renderRechargeClient(client);
            }
        }
        
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                switchToClient(index);
            });
        });
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                const newIndex = activeIndex > 0 ? activeIndex - 1 : clients.length - 1;
                switchToClient(newIndex);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const newIndex = activeIndex < clients.length - 1 ? activeIndex + 1 : 0;
                switchToClient(newIndex);
            });
        }
    }, 100);
}