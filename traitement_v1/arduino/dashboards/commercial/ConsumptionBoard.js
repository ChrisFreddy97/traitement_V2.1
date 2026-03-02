// dashboards/commercial/ConsumptionBoard.js
import { database } from '../../arduinoCore.js';
import { FORFAIT_LIMITS } from '../../arduinoConstants.js';

export function renderConsumptionBoard() {
    const container = document.getElementById('consumptionBoard');
    if (!container) return;
    
    const clientsMap = database.commercialData?.clients;
    if (!clientsMap || clientsMap.size === 0) {
        container.innerHTML = '<p class="no-data">❌ Aucune donnée de consommation disponible</p>';
        return;
    }
    
    // ✅ FILTRE : élimine les fantômes (ID > 50 ou non numérique)
    const clients = Array.from(clientsMap.values()).filter(c => 
        typeof c.id === 'number' && c.id <= 50
    );
    
    if (clients.length === 0) {
        container.innerHTML = '<p class="no-data">❌ Aucun client valide trouvé</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">📊 ANALYSE DE CONSOMMATION PAR CLIENT</h3>
        
        <div class="client-tabs-container">
            <button class="client-tab-nav prev" id="prevConsumptionClient">◀</button>
            <div class="client-tabs" id="consumptionClientTabs"></div>
            <button class="client-tab-nav next" id="nextConsumptionClient">▶</button>
        </div>
        
        <div id="activeConsumptionClient" class="client-content"></div>
    `;
    
    renderConsumptionTabs(clients);
    renderConsumptionClient(clients[0]);
    attachConsumptionNavigation(clients);
}
function renderConsumptionTabs(clients) {
    const container = document.getElementById('consumptionClientTabs');
    if (!container) return;
    
    container.innerHTML = clients.map((client, index) => `
        <button class="client-tab ${index === 0 ? 'active' : ''}" data-index="${index}">
            Client ${client.id}
        </button>
    `).join('');
}

function renderConsumptionClient(client) {
    const container = document.getElementById('activeConsumptionClient');
    if (!container) return;
    
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
    
    container.innerHTML = `
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
        `;
}

function attachConsumptionNavigation(clients) {
    setTimeout(() => {
        const tabs = document.querySelectorAll('#consumptionClientTabs .client-tab');
        const container = document.getElementById('activeConsumptionClient');
        const prevBtn = document.getElementById('prevConsumptionClient');
        const nextBtn = document.getElementById('nextConsumptionClient');
        
        if (!tabs.length) return;
        
        let activeIndex = 0;
        
        function switchToClient(index) {
            if (index < 0 || index >= clients.length) return;
            activeIndex = index;
            
            tabs.forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
            });
            
            renderConsumptionClient(clients[index]);
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