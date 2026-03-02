// dashboards/commercial/ForfaitChangesBoard.js
import { database } from '../../arduinoCore.js';
import { FORFAIT_NAMES } from '../../arduinoConstants.js';

export function renderForfaitChangesBoard() {
    const container = document.getElementById('forfaitChangesBoard');
    if (!container) return;
    
    const clientsMap = database.commercialData?.clients;
    if (!clientsMap) {
        container.innerHTML = '<p class="no-data">Aucune donnée</p>';
        return;
    }
    
    const clients = Array.from(clientsMap.values()).filter(c => typeof c.id === 'number' && c.id <= 20);
    container.innerHTML = `
        <h3 class="card-title">🔄 CHANGEMENTS DE FORFAIT PAR CLIENT</h3>
        
        <div class="client-tabs-container">
            <button class="client-tab-nav prev" id="prevForfaitClient">◀</button>
            <div class="client-tabs" id="forfaitClientTabs"></div>
            <button class="client-tab-nav next" id="nextForfaitClient">▶</button>
        </div>
        
        <div id="activeForfaitClient" class="client-content"></div>
    `;
    
    renderForfaitTabs(clients);
    renderForfaitClient(clients[0]);
    attachForfaitNavigation(clients);
}

function renderForfaitTabs(clients) {
    const container = document.getElementById('forfaitClientTabs');
    if (!container) return;
    
    container.innerHTML = clients.map((client, index) => `
        <button class="client-tab ${index === 0 ? 'active' : ''}" data-index="${index}">
            Client ${client.id}
        </button>
    `).join('');
}

function renderForfaitClient(client) {
    const container = document.getElementById('activeForfaitClient');
    if (!container) return;
    
    const changes = client.forfaitChanges || [];
    const forfaitActuel = FORFAIT_NAMES[client.forfaitActuel] || `Forfait ${client.forfaitActuel}`;    
    container.innerHTML = `
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

function attachForfaitNavigation(clients) {
    setTimeout(() => {
        const tabs = document.querySelectorAll('#forfaitClientTabs .client-tab');
        const container = document.getElementById('activeForfaitClient');
        const prevBtn = document.getElementById('prevForfaitClient');
        const nextBtn = document.getElementById('nextForfaitClient');
        
        if (!tabs.length) return;
        
        let activeIndex = 0;
        
        function switchToClient(index) {
            if (index < 0 || index >= clients.length) return;
            activeIndex = index;
            
            tabs.forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
            });
            
            renderForfaitClient(clients[index]);
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