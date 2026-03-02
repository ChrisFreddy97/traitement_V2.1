// dashboards/commercial/RechargeHabitsBoard.js
import { database } from '../../arduinoCore.js';
import { FORFAIT_NAMES } from '../../arduinoConstants.js';

export function renderRechargeHabitsBoard() {
    const container = document.getElementById('rechargeHabitsBoard');
    if (!container) return;
    
    const clientsMap = database.commercialData?.clients;
    if (!clientsMap) {
        container.innerHTML = '<p class="no-data">Aucune donnée</p>';
        return;
    }
    
    const clients = Array.from(clientsMap.values()).filter(c => typeof c.id === 'number' && c.id <= 20);
    
    container.innerHTML = `
        <h3 class="card-title">💳 HABITUDES DE RECHARGE PAR CLIENT</h3>
        
        <div class="client-tabs-container">
            <button class="client-tab-nav prev" id="prevHabitsClient">◀</button>
            <div class="client-tabs" id="habitsClientTabs"></div>
            <button class="client-tab-nav next" id="nextHabitsClient">▶</button>
        </div>
        
        <div id="activeHabitsClient" class="client-content"></div>
    `;
    
    renderHabitsTabs(clients);
    renderHabitsClient(clients[0]);
    attachHabitsNavigation(clients);
}

function renderHabitsTabs(clients) {
    const container = document.getElementById('habitsClientTabs');
    if (!container) return;
    
    container.innerHTML = clients.map((client, index) => `
        <button class="client-tab ${index === 0 ? 'active' : ''}" data-index="${index}">
            Client ${client.id}
        </button>
    `).join('');
}

function renderHabitsClient(client) {
    const container = document.getElementById('activeHabitsClient');
    if (!container) return;
    
    const recharges = client.recharges || [];
    const creditPercentages = client.creditPercentages || {};
    const preferredCredit = client.preferredCredit;
    const preferredPercentage = client.preferredPercentage || 0;
    const forfaitName = client.forfaitName || 'Inconnu';
    
    // Distribution des montants
    const montants = Object.entries(creditPercentages)
        .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]));
    
    container.innerHTML = `
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

function attachHabitsNavigation(clients) {
    setTimeout(() => {
        const tabs = document.querySelectorAll('#habitsClientTabs .client-tab');
        const container = document.getElementById('activeHabitsClient');
        const prevBtn = document.getElementById('prevHabitsClient');
        const nextBtn = document.getElementById('nextHabitsClient');
        
        if (!tabs.length) return;
        
        let activeIndex = 0;
        
        function switchToClient(index) {
            if (index < 0 || index >= clients.length) return;
            activeIndex = index;
            
            tabs.forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
            });
            
            renderHabitsClient(clients[index]);
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