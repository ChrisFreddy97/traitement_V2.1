// dashboards/commercial/EventsBoard.js
import { database } from '../../arduinoCore.js';

export function renderEventsBoard() {
    const container = document.getElementById('commercialEventsBoard');
    if (!container) return;
    
    const clientsMap = database.commercialData?.clients;
    if (!clientsMap) {
        container.innerHTML = '<p class="no-data">Aucune donnée</p>';
        return;
    }
    
    const clients = Array.from(clientsMap.values()).filter(c => typeof c.id === 'number' && c.id <= 20);
    
    container.innerHTML = `
        <h3 class="card-title">⚠️ ÉVÉNEMENTS PAR CLIENT</h3>
        
        <div class="client-tabs-container">
            <button class="client-tab-nav prev" id="prevEventsClient">◀</button>
            <div class="client-tabs" id="eventsClientTabs"></div>
            <button class="client-tab-nav next" id="nextEventsClient">▶</button>
        </div>
        
        <div id="activeEventsClient" class="client-content"></div>
    `;
    
    renderEventsTabs(clients);
    renderEventsClient(clients[0]);
    attachEventsNavigation(clients);
}

function renderEventsTabs(clients) {
    const container = document.getElementById('eventsClientTabs');
    if (!container) return;
    
    container.innerHTML = clients.map((client, index) => `
        <button class="client-tab ${index === 0 ? 'active' : ''}" data-index="${index}">
            Client ${client.id}
        </button>
    `).join('');
}

function renderEventsClient(client) {
    const container = document.getElementById('activeEventsClient');
    if (!container) return;
    
    // Filtrer les événements de ce client
    const events = client.events || [];
    
    const suspendE = events.filter(e => e.type === 'SuspendE').length;
    const suspendP = events.filter(e => e.type === 'SuspendP').length;
    const surcharge = events.filter(e => e.type === 'Surcharge').length;
    
    // Jours avec crédit nul pour ce client
    const zeroCreditDates = client.zeroCreditDates || [];
    const zeroCreditJours = zeroCreditDates.length;
    const zeroCreditPourcent = client.zeroCreditPercentage || 0;
    
    container.innerHTML = `
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

function attachEventsNavigation(clients) {
    setTimeout(() => {
        const tabs = document.querySelectorAll('#eventsClientTabs .client-tab');
        const container = document.getElementById('activeEventsClient');
        const prevBtn = document.getElementById('prevEventsClient');
        const nextBtn = document.getElementById('nextEventsClient');
        
        if (!tabs.length) return;
        
        let activeIndex = 0;
        
        function switchToClient(index) {
            if (index < 0 || index >= clients.length) return;
            activeIndex = index;
            
            tabs.forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
            });
            
            renderEventsClient(clients[index]);
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