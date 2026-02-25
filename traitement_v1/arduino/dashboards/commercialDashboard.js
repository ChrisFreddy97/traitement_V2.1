// dashboards/commercialDashboard.js
import { database } from '../arduinoCore.js';
import { FORFAIT_NAMES } from '../arduinoConstants.js';


// ===========================================
// FONCTION PRINCIPALE
// ===========================================
export function renderCommercialDashboard() {
    const container = document.getElementById('commercialDashboard');
    if (!database.commercialData) {
        if (container) container.innerHTML = '';
        return;
    }

    const hasRecharge = database.rechargeAnalysis?.clients?.length > 0;

    // UNIQUEMENT DES CONTENEURS VIDES
    const html = `
        <!-- Grand titre -->
        <div class="section-title">
            <h2>💰 DONNÉES COMMERCIALES</h2>
        </div>
        
        <!-- Section Crédits -->
        <div id="creditSection" class="section-card"></div>
        
        <!-- Calendrier des événements -->
        <div id="calendarSection" class="section-card card-dark"></div>
        
        <!-- Section Recharges -->
        <div id="rechargeSection" class="section-card"></div>
    `;

    container.innerHTML = html;

    // Remplir les sections
    renderCreditSection();
    renderCalendarSection();
    
    if (hasRecharge) {
        renderRechargeSection();
    } else {
        // Si pas de recharges, masquer la section
        const rechargeSection = document.getElementById('rechargeSection');
        if (rechargeSection) rechargeSection.style.display = 'none';
    }
}

// ===========================================
// SECTION CRÉDITS
// ===========================================
function renderCreditSection() {
    const container = document.getElementById('creditSection');
    if (!container) return;
    
    const clients = database.commercialData.clients;
    if (!clients || clients.length === 0) {
        container.innerHTML = '<p class="no-data">Aucun client</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="section-card-title">💰 Crédits (jours à 0)</h3>
        <div class="client-tabs-container">
            <button class="client-tab-nav prev" id="prevCreditClient">◀</button>
            <div class="client-tabs" id="creditClientTabs"></div>
            <button class="client-tab-nav next" id="nextCreditClient">▶</button>
        </div>
        <div id="activeCreditClientContainer"></div>
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
    const container = document.getElementById('activeCreditClientContainer');
    if (!container) return;
    
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

function attachCreditNavigation(clients) {
    setTimeout(() => {
        const tabs = document.querySelectorAll('#creditClientTabs .client-tab');
        const container = document.getElementById('activeCreditClientContainer');
        const prevBtn = document.getElementById('prevCreditClient');
        const nextBtn = document.getElementById('nextCreditClient');
        
        if (!tabs.length || !container) return;
        
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
            
            renderCreditClient(clients[index]);
        }
        
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => switchToClient(index));
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

// ===========================================
// SECTION CALENDRIER
// ===========================================
function renderCalendarSection() {
    const container = document.getElementById('calendarSection');
    if (!container) return;
    
    const eventTable = database.tables.find(t => t.type === 'E');
    if (!eventTable || eventTable.data.length === 0) {
        container.innerHTML = `
            <h3 class="section-card-title">📅 Calendrier des événements</h3>
            <p class="no-data">Aucun événement détecté</p>
        `;
        return;
    }

    // Extraire les événements
    const events = [];
    eventTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const eventType = cells[2];
        const clientId = cells[3];
        
        events.push({ date, type: eventType, clientId });
    });

    // Trier par date
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Générer le calendrier
    const calendarHtml = generateCalendar(events);
    
    container.innerHTML = `
        <h3 class="section-card-title">📅 Calendrier des événements</h3>
        <div class="horizontal-calendar">
            ${calendarHtml}
        </div>
        <div class="event-legend">
            <span class="legend-item"><span class="dot" style="background: #ff9800;"></span> SuspendP</span>
            <span class="legend-item"><span class="dot" style="background: #9c27b0;"></span> SuspendE</span>
            <span class="legend-item"><span class="dot" style="background: #f44336;"></span> Surcharge</span>
            <span class="legend-item"><span class="dot" style="background: #ffeb3b;"></span> Delestage Partiel</span>
            <span class="legend-item"><span class="dot" style="background: #000000;"></span> Delestage Total</span>
        </div>
    `;
}

// ===========================================
// SECTION RECHARGES
// ===========================================
function renderRechargeSection() {
    const container = document.getElementById('rechargeSection');
    if (!container) return;
    
    const clients = database.rechargeAnalysis?.clients;
    if (!clients || clients.length === 0) return;
    
    container.innerHTML = `
        <h3 class="section-card-title">💳 Recharges (forfaits)</h3>
        <div class="client-tabs-container">
            <button class="client-tab-nav prev" id="prevRechargeClient">◀</button>
            <div class="client-tabs" id="rechargeClientTabs"></div>
            <button class="client-tab-nav next" id="nextRechargeClient">▶</button>
        </div>
        <div id="activeRechargeClientContainer"></div>
    `;
    
    renderRechargeTabs(clients);
    renderRechargeClient(clients[0]);
    attachRechargeNavigation(clients);
}

function renderRechargeTabs(clients) {
    const container = document.getElementById('rechargeClientTabs');
    if (!container) return;
    
    container.innerHTML = clients.map((client, index) => `
        <button class="client-tab ${index === 0 ? 'active' : ''}" data-index="${index}">
            Client ${client.id}
        </button>
    `).join('');
}
// ===========================================
// RENDER RECHARGE CLIENT (VERSION COMPLÈTE)
// ===========================================
function renderRechargeClient(client) {
    const container = document.getElementById('activeRechargeClientContainer');
    if (!container) return;
    
    const changes = client.forfaitChanges || [];
    const recent = client.dernieresRecharges || [];
    const creditData = client.creditPercentages || {};
    const hasCreditData = Object.keys(creditData).length > 0;
    const chartId = `creditChart_${client.id}`;
    
    // Noms des forfaits
    const forfaitDisplay = client.forfaitName || `Forfait ${client.forfaitActuel}`;
    const consoStatus = client.consoStatus || '';
    const consoColor = client.consoColor || '#999';
    
    // Préparer les changements de forfait avec les noms
    const changesHtml = changes.map(c => {
        const ancienNom = FORFAIT_NAMES[c.ancien] || `Forfait ${c.ancien}`;
        const nouveauNom = FORFAIT_NAMES[c.nouveau] || `Forfait ${c.nouveau}`;
        return `
            <div class="change-item-mini">
                <span class="change-date">${c.date}</span>
                <span class="change-old">${ancienNom}</span>
                <span class="change-arrow">→</span>
                <span class="change-new">${nouveauNom}</span>
            </div>
        `;
    }).join('');
    
    // Dernières recharges avec le nom du forfait
    const recentHtml = recent.map(r => {
        const forfaitNom = FORFAIT_NAMES[r.forfait] || `Forfait ${r.forfait}`;
        return `
            <div class="recent-item-mini">
                <span class="recent-date">${r.date}</span>
                <span class="recent-credit">${r.credit}</span>
                <span class="recent-forfait">${forfaitNom}</span>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">💳</span>
                <span class="client-id">Client ${client.id}</span>
                <span class="client-badge">${client.totalRecharges} recharges</span>
            </div>
            
            <!-- STATS AVEC FORFAIT -->
            <div class="client-stats">
                <div class="stat">
                    <div class="stat-label">Forfait</div>
                    <div class="stat-value">${forfaitDisplay}</div>
                    <div class="stat-percent" style="color: ${consoColor}">${consoStatus}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Total recharges</div>
                    <div class="stat-value">${client.totalRecharges}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Changements</div>
                    <div class="stat-value">${changes.length}</div>
                </div>
            </div>
            
            <!-- DEUX MINI-CARTES CÔTE À CÔTE -->
            <div class="row-2cols" style="margin: 15px 0;">
                <!-- Carte gauche : Répartition des achats -->
                <div class="mini-card" style="padding: 15px;">
                    <div class="mini-card-header">📊 Répartition</div>
                    ${hasCreditData ? `
                        <div style="height: 120px;">
                            <canvas id="${chartId}"></canvas>
                        </div>
                        <div class="credit-legend-mini">
                            ${Object.entries(creditData).map(([credit, percent]) => `
                                <div class="legend-item-mini">
                                    <span class="legend-color" style="background: ${getColorForCredit(credit)}; width: 10px; height: 10px;"></span>
                                    <span class="legend-label">${credit}j</span>
                                    <span class="legend-percent">${percent}%</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="no-data" style="padding: 20px;">Aucune donnée</p>'}
                </div>
                
                <!-- Carte droite : Dernières recharges AVEC NOMS DE FORFAIT -->
                <div class="mini-card" style="padding: 15px; max-height: 200px; overflow-y: auto;">
                    <div class="mini-card-header">📋 Dernières recharges</div>
                    ${recent.length > 0 ? recentHtml : '<p class="no-data" style="padding: 20px;">Aucune recharge</p>'}
                </div>
            </div>
            
            <!-- CHANGEMENTS DE FORFAIT AVEC NOMS -->
            ${changes.length > 0 ? `
                <div class="changes-section" style="margin-top: 15px;">
                    <h4>🔄 Changements de forfait</h4>
                    <div class="changes-list">
                        ${changesHtml}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    // Créer le graphique si nécessaire
    if (hasCreditData) {
        setTimeout(() => createCreditChart(chartId, creditData), 100);
    }
}

function attachRechargeNavigation(clients) {
    setTimeout(() => {
        const tabs = document.querySelectorAll('#rechargeClientTabs .client-tab');
        const container = document.getElementById('activeRechargeClientContainer');
        const prevBtn = document.getElementById('prevRechargeClient');
        const nextBtn = document.getElementById('nextRechargeClient');
        
        if (!tabs.length || !container) return;
        
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
            
            renderRechargeClient(clients[index]);
        }
        
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => switchToClient(index));
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
// ===========================================
// RENDER RECHARGE CLIENT
// ===========================================

// ===========================================
// FONCTIONS UTILITAIRES
// ===========================================
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

function createCreditChart(canvasId, creditData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    if (window.creditCharts && window.creditCharts[canvasId]) {
        window.creditCharts[canvasId].destroy();
    }
    
    const labels = Object.keys(creditData).map(c => ``); // Pas de labels, on les met à côté
    const data = Object.values(creditData).map(v => parseFloat(v));
    const colors = Object.keys(creditData).map(c => getColorForCredit(c));
    
    if (!window.creditCharts) window.creditCharts = {};
    
    window.creditCharts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.raw.toFixed(1)}%`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    display: false  // Cacher l'axe X pour gagner de la place
                },
                y: {
                    display: false,  // Cacher l'axe Y
                    grid: { display: false }
                }
            }
        }
    });
}
function generateCalendar(events) {
    // Grouper par mois
    const byMonth = {};
    events.forEach(e => {
        const [year, month] = e.date.split('-');
        const key = `${year}-${month}`;
        if (!byMonth[key]) byMonth[key] = {};
        const day = parseInt(e.date.split('-')[2]);
        if (!byMonth[key][day]) byMonth[key][day] = [];
        byMonth[key][day].push(e);
    });
    
    const months = Object.keys(byMonth).sort().slice(-3);
    
    return months.map(monthKey => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(year, month-1, 1).toLocaleString('fr-FR', { month: 'long' });
        const daysInMonth = new Date(year, month, 0).getDate();
        const firstDay = new Date(year, month-1, 1).getDay();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        
        let days = '';
        for (let i = 0; i < startOffset; i++) days += '<div class="calendar-day empty"></div>';
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dayEvents = byMonth[monthKey]?.[d] || [];
            const colors = [];
            dayEvents.forEach(e => {
                let color = '';
                if (e.type === 'SuspendP') color = '#ff9800';
                else if (e.type === 'SuspendE') color = '#9c27b0';
                else if (e.type === 'Surcharge') color = '#f44336';
                else if (e.type === 'Delestage Partiel') color = '#ffeb3b';
                else if (e.type === 'Delestage Total') color = '#000000';
                if (color && !colors.includes(color)) colors.push(color);
            });
            
            days += `
                <div class="calendar-day" title="${dayEvents.length} événement(s)">
                    <span class="day-number">${d}</span>
                    <div class="event-indicators">
                        ${colors.map(c => `<span class="event-dot" style="background: ${c};"></span>`).join('')}
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="calendar-month-card">
                <div class="month-title">${monthName} ${year}</div>
                <div class="calendar-weekdays">
                    <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                </div>
                <div class="calendar-days">${days}</div>
            </div>
        `;
    }).join('');
}