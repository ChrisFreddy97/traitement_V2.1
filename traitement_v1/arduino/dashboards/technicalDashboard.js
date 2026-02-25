// dashboards/technicalDashboard.js
import { database } from '../arduinoCore.js';
import { VOLTAGE_NORMS } from '../arduinoConstants.js';

let tensionChartInstance = null;

// ===========================================
// FONCTION PRINCIPALE
// ===========================================
export function renderTechnicalDashboard() {
    const container = document.getElementById('technicalDashboard');
    if (!database.technicalData || document.querySelector('.tab.active')?.dataset.tab !== 'Technique') {
        if (container) container.innerHTML = '';
        return;
    }

    const html = `
        <!-- Grand titre -->
        <div class="section-title">
            <h2>📊 DONNÉES TECHNIQUES</h2>
        </div>
        
        <!-- Carte Informations (en haut) -->
        <div id="infoCard" class="card"></div>
        
        <!-- Carte Normes Système (en bas) -->
        <div id="normsCard" class="card"></div>
        
        <!-- Graphique principal -->
        <div id="chartCard" class="card"></div>
        
        <!-- Sous-titre Analyse stabilité -->
        <div class="subsection-title">

        <!--Je veux que monter ça ici pour faire une sorte de tra>
        <div id="loadSheddingTab" class="card"></div>

            <h3>📈 ANALYSE DE LA STABILITÉ</h3>
        </div>
        
        <div id="variationsMiniCard" class="card"></div>
        <div id="variationsTab" class="card"></div>
                
        <div id="exceedanceMiniCard" class="card"></div>
        <div id="exceedanceTab" class="card"></div>    
        <div id="conformityContainer" class="card"></div>
    `;

    container.innerHTML = html;

    // Remplir les cartes
    renderInfoCard();
    renderNormsCard();
    renderChartCard();
    renderVariationsMiniCard();
    renderExceedanceMiniCard();
    renderLoadSheddingMiniCard();
    renderConformityCard();
    renderChartCard();
    renderVariationsTab();
    renderExceedanceTab();
    renderLoadSheddingTab();
    


}

// ===========================================
// CARTE INFORMATIONS (avec NANORÉSEAU N°)
// ===========================================
function renderInfoCard() {
    const container = document.getElementById('infoCard');
    if (!container) return;
    
    const data = database.technicalData;
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent || 'N/A';
    
    container.innerHTML = `
        <h3 class="card-title">📋 Informations</h3>
        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">📅 Période</span>
                <span class="info-value">${data.daysCount} jours</span>
                <span class="info-sub">du ${data.dailyStats.dates[0]} au ${data.dailyStats.dates[data.dailyStats.dates.length-1]}</span>
            </div>
            <div class="info-item">
                <span class="info-label">👥 Clients actifs</span>
                <span class="info-value">${data.clientCount}</span>
            </div>
            <div class="info-item">
                <span class="info-label">📊 Tension moyenne</span>
                <span class="info-value">${data.globalAvg.toFixed(2)} V</span>
            </div>
            <div class="info-item">
                <span class="info-label">⬇️ Tension minimale</span>
                <span class="info-value" style="color:#64b5f6;">${data.globalMin.toFixed(2)} V</span>
            </div>
            <div class="info-item">
                <span class="info-label">⬆️ Tension maximale</span>
                <span class="info-value" style="color:#ffb74d;">${data.globalMax.toFixed(2)} V</span>
            </div>
        </div>
    `;
}

// ===========================================
// CARTE NORMES SYSTÈME
// ===========================================
function renderNormsCard() {
    const container = document.getElementById('normsCard');
    if (!container) return;
    
    const data = database.technicalData;
    
    let normSystem = '';
    let normData = null;
    if (data.globalAvg >= 22 && data.globalAvg <= 29) {
        normSystem = '24V';
        normData = VOLTAGE_NORMS['24V'];
    } else if (data.globalAvg >= 11 && data.globalAvg <= 15) {
        normSystem = '12V';
        normData = VOLTAGE_NORMS['12V'];
    }
    
    if (!normData) {
        container.innerHTML = '<h3 class="card-title">🔋 Normes système</h3><p>Non déterminé</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">🔋 Normes Système ${normSystem}</h3>
        <div class="norms-grid">
            <div class="norm-item">
                <span class="norm-label">Tension minimale</span>
                <span class="norm-value">${normData.min}V</span>
            </div>
            <div class="norm-item">
                <span class="norm-label">Plage idéale</span>
                <span class="norm-value norm-range">${normData.ideal}V</span>
            </div>
            <div class="norm-item">
                <span class="norm-label">Tension maximale</span>
                <span class="norm-value">${normData.max}V</span>
            </div>
            <div class="norm-item">
                <span class="norm-label">Seuil d'alerte</span>
                <span class="norm-value alert-threshold">${normData.alert}</span>
            </div>
        </div>
    `;
}

// ===========================================
// GRAPHIQUE PRINCIPAL
// ===========================================
function renderChartCard() {
    const container = document.getElementById('chartCard');
    if (!container) return;
    
    const data = database.technicalData;
    
    container.innerHTML = `
        <h3 class="card-title">📈 Évolution journalière des tensions</h3>
        <div class="chart-wrapper">
            <canvas id="tensionChart"></canvas>
        </div>
    `;
    
    createTensionChart(data.dailyStats);
}

// ===========================================
// MINI-CARTES (3 en haut des onglets)
// ===========================================
function renderVariationsMiniCard() {
    const container = document.getElementById('variationsMiniCard');
    if (!container) return;
    
    const variations = database.technicalData?.variationsRapides || [];
    const total = variations.length;
    const jours = new Set(variations.map(v => v.date)).size;
    
    container.innerHTML = `
        <div class="mini-card-header">⚡ Variations</div>
        <div class="mini-card-value">${total}</div>
        <div class="mini-card-label">variations totales</div>
        <div class="mini-card-sub">${jours} jours concernés</div>
    `;
}

function renderExceedanceMiniCard() {
    const container = document.getElementById('exceedanceMiniCard');
    if (!container) return;
    
    const data = database.technicalData?.analyse14V || [];
    const excellent = data.filter(d => d.qualite === 'excellent').length;
    
    container.innerHTML = `
        <div class="mini-card-header">🔋 ≥14.2V</div>
        <div class="mini-card-value">${excellent}</div>
        <div class="mini-card-label">jours excellents</div>
        <div class="mini-card-sub">${data.length} jours analysés</div>
    `;
}

function renderLoadSheddingMiniCard() {
    const container = document.getElementById('loadSheddingMiniCard');
    if (!container) return;
    
    container.innerHTML = `
        <div class="mini-card-header">⚡ Délestage</div>
        <div class="mini-card-value">🚧</div>
        <div class="mini-card-label">en cours</div>
        <div class="mini-card-sub">bientôt disponible</div>
    `;
}

// ===========================================
// GRAPHIQUE PRINCIPAL
// ===========================================
function createTensionChart(dailyStats) {
    const ctx = document.getElementById('tensionChart');
    if (!ctx) return;
    
    if (tensionChartInstance) tensionChartInstance.destroy();
    
    // Déterminer les seuils selon le système
    const normSystem = database.technicalData?.normSystem || '12V';
    const norms = VOLTAGE_NORMS[normSystem];
    
    // Créer des datasets pour les lignes de seuil
    const minLine = {
        label: `Seuil min (${norms.min}V)`,
        data: Array(dailyStats.dates.length).fill(norms.min),
        borderColor: '#f44336',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    const maxLine = {
        label: `Seuil max (${norms.max}V)`,
        data: Array(dailyStats.dates.length).fill(norms.max),
        borderColor: '#ff9800',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    tensionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dailyStats.dates,
            datasets: [
                { 
                    label: 'Tension minimale', 
                    data: dailyStats.mins, 
                    borderColor: '#42a5f5', 
                    borderWidth: 2, 
                    tension: 0.3,
                    pointBackgroundColor: dailyStats.mins.map(v => v < norms.min ? '#f44336' : '#42a5f5')
                },
                { 
                    label: 'Tension maximale', 
                    data: dailyStats.maxs, 
                    borderColor: '#ff9800', 
                    borderWidth: 2, 
                    tension: 0.3,
                    pointBackgroundColor: dailyStats.maxs.map(v => v > norms.max ? '#f44336' : '#ff9800')
                },
                { 
                    label: 'Tension moyenne', 
                    data: dailyStats.avgs, 
                    borderColor: '#4caf50', 
                    borderWidth: 2, 
                    borderDash: [5,5], 
                    tension: 0.3 
                },
                minLine,  // Ligne seuil min
                maxLine   // Ligne seuil max
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            let label = ctx.dataset.label || '';
                            if (label.includes('Seuil')) {
                                return `${label}: ${ctx.parsed.y}V`;
                            }
                            return `${label}: ${ctx.parsed.y.toFixed(2)}V`;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: false, 
                    title: { display: true, text: 'Tension (V)' }
                }
            }
        }
    });
}

// ===========================================
// GRAPHIQUES SPÉCIFIQUES
// ===========================================

function create14VChart(chartData) {
    const ctx = document.getElementById('chart14V');
    if (!ctx) return;
    
    // ✅ Ligne de référence à 4 (AJOUTÉE SANS RIEN MODIFIER D'AUTRE)
    const referenceLine = {
        label: 'Seuil excellent (4x/jour)',
        data: Array(chartData.dates.length).fill(4),
        borderColor: '#4CAF50',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.dates,
            datasets: [
                { // ⚠️ Ton code original inchangé
                    label: 'Nombre de fois ≥14.2V',
                    data: chartData.counts,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    pointBackgroundColor: chartData.counts.map(c => 
                        c >= 4 ? '#4CAF50' : c >= 2 ? '#FFD700' : c === 1 ? '#FF9800' : '#F44336'
                    ),
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    fill: true
                },
                referenceLine // ✅ Ligne ajoutée
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y} fois`
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: 'Nombre de fois' },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: { 
                    grid: { display: false }
                }
            }
        }
    });
}

function createVariationsFrequencyChart() {
    const ctx = document.getElementById('variationsChart');
    if (!ctx) return;
    
    // Préparer les données de fréquence
    const variations = database.technicalData?.variationsRapides || [];
    const seuil = database.technicalData?.normSystem === '24V' ? 3.5 : 1.5;
    
    // Compter par date
    const freqParJour = {};
    variations.forEach(v => {
        freqParJour[v.date] = (freqParJour[v.date] || 0) + 1;
    });
    
    const dates = Object.keys(freqParJour).sort();
    const counts = dates.map(d => freqParJour[d]);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Nombre de variations par jour',
                data: counts,
                backgroundColor: counts.map(c => 
                    c >= 3 ? '#f44336' : 
                    c === 2 ? '#ff9800' : 
                    '#4CAF50'
                ),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            let text = `${ctx.parsed.y} variation(s)`;
                            if (ctx.parsed.y >= 3) text += ' 🔴 Critiques';
                            else if (ctx.parsed.y === 2) text += ' 🟠 Attention';
                            return text;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: 'Nombre de variations' },
                    max: Math.max(...counts, 5)
                }
            }
        }
    });
}

function renderConformityCard() {
    const container = document.getElementById('conformityContainer');
    if (!container) return;
    
    const data = database.technicalData?.conformity;
    if (!data) return;
    
    container.innerHTML = `
        <h3>📊 Conformité du système</h3>
        <p>${data.pourcentageConformite}% de jours conformes (${data.joursConformes}/${data.totalJours})</p>
        <p>🔴 Surtensions: ${data.causes.surtension.length} jours</p>
        <p>🔻 Sous-tensions: ${data.causes.sousTension.length} jours</p>
        <p>⚡ Variations: ${data.causes.variation.length} jours</p>
    `;
}


// ===========================================
// COULEURS DES ÉVÉNEMENTS
// ===========================================
function getEventColor(eventType) {
    const colors = {
        'SuspendP': '#ff9800',
        'SuspendE': '#9c27b0',
        'Surcharge': '#f44336',
        'Delestage Partiel': '#ffeb3b',
        'Delestage Total': '#000000'
    };
    return colors[eventType] || '#999';
}



// ===========================================
// NAVIGATION CLIENTS POUR LES ÉVÉNEMENTS
// ===========================================
function attachEventClientNavigation(events, clients) {
    const tabs = document.querySelectorAll('#eventClientTabs .client-tab');
    const container = document.getElementById('eventListContainer');
    const prevBtn = document.getElementById('prevEventClient');
    const nextBtn = document.getElementById('nextEventClient');
    
    if (!tabs.length || !container) return;
    
    let activeIndex = 0;
    
    function switchToClient(index) {
        if (index < 0 || index >= tabs.length) return;
        
        activeIndex = index;
        
        tabs.forEach((tab, i) => {
            if (i === index) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        const clientId = tabs[index].dataset.client;
        container.innerHTML = renderEventList(events, clientId);
    }
    
    // Attacher les événements aux tabs
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            switchToClient(index);
        });
    });
    
    // Boutons précédent/suivant
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            const newIndex = activeIndex > 0 ? activeIndex - 1 : tabs.length - 1;
            switchToClient(newIndex);
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const newIndex = activeIndex < tabs.length - 1 ? activeIndex + 1 : 0;
            switchToClient(newIndex);
        });
    }
}

// ===========================================
// LISTE DES ÉVÉNEMENTS (avec filtre client)
// ===========================================
function renderEventList(events, clientFilter = 'all') {
    const filtered = clientFilter === 'all' 
        ? events 
        : events.filter(e => e.clientId === clientFilter);
    
    if (filtered.length === 0) {
        return '<p class="no-data">Aucun événement pour ce client</p>';
    }
    
    const rows = filtered.slice(0, 20).map(e => `
        <tr>
            <td>${e.date}</td>
            <td>${e.timestamp.split(' ')[1]}</td>
            <td><span class="event-badge" style="background: ${getEventColor(e.type)}">${e.type}</span></td>
            <td>Client ${e.clientId || 'N/A'}</td>
            <td>${e.valeur || '-'}</td>
        </tr>
    `).join('');
    
    return `
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Heure</th>
                        <th>Type</th>
                        <th>Client</th>
                        <th>Valeur</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            ${filtered.length > 20 ? `<p class="table-note">... et ${filtered.length - 20} autres</p>` : ''}
        </div>
    `;
}
function generateHorizontalCalendar(events) {
    // Grouper les événements par mois
    const eventsByMonth = {};
    events.forEach(e => {
        const [year, month] = e.date.split('-');
        const key = `${year}-${month}`;
        if (!eventsByMonth[key]) {
            eventsByMonth[key] = {};
        }
        const day = parseInt(e.date.split('-')[2]);
        if (!eventsByMonth[key][day]) {
            eventsByMonth[key][day] = [];
        }
        eventsByMonth[key][day].push(e);
    });
    
    // Obtenir les 3 derniers mois
    const months = Object.keys(eventsByMonth).sort().slice(-3);
    
    return months.map(monthKey => {
        const [year, month] = monthKey.split('-');
        const date = new Date(year, month-1, 1);
        const monthName = date.toLocaleString('fr-FR', { month: 'long' });
        const daysInMonth = new Date(year, month, 0).getDate();
        const firstDay = new Date(year, month-1, 1).getDay();
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
        
        let days = '';
        for (let i = 0; i < adjustedFirstDay; i++) {
            days += '<div class="calendar-day empty"></div>';
        }
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dayEvents = eventsByMonth[monthKey]?.[d] || [];
            let eventIndicators = '';
            let eventTypes = [];
            
            dayEvents.forEach(e => {
                let color = '';
                if (e.type === 'SuspendP') color = '#ff9800';
                else if (e.type === 'SuspendE') color = '#9c27b0';
                else if (e.type === 'Surcharge') color = '#f44336';
                else if (e.type === 'Delestage Partiel') color = '#ffeb3b';
                else if (e.type === 'Delestage Total') color = '#000000';
                
                if (!eventTypes.includes(e.type)) {
                    eventTypes.push(e.type);
                    eventIndicators += `<span class="event-dot" style="background: ${color};" title="${e.type}"></span>`;
                }
            });
            
            days += `
                <div class="calendar-day" title="${dayEvents.length} événement(s)">
                    <span class="day-number">${d}</span>
                    <div class="event-indicators">${eventIndicators}</div>
                </div>
            `;
        }
        
        return `
            <div class="calendar-month-card">
                <div class="month-title">${monthName} ${year}</div>
                <div class="calendar-weekdays">
                    <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                </div>
                <div class="calendar-days">
                    ${days}
                </div>
            </div>
        `;
    }).join('');
}


// ===========================================
// ONGLET 1: VARIATIONS RAPIDES (détaillé)
// ===========================================
function renderVariationsTab() {
    const container = document.getElementById('variationsTab');
    if (!container) return;
    
    const variations = database.technicalData?.variationsRapides || [];
    const chartData = database.technicalData?.variationsChart;
    const seuil = database.technicalData?.normSystem === '24V' ? 3.5 : 1.5;
    
    if (variations.length === 0) {
        container.innerHTML = `
            <div class="tab-content">
                <p class="no-data">Aucune variation détectée (seuil: ${seuil}V/h)</p>
            </div>
        `;
        return;
    }
    
    // Grouper par date
    const parJour = {};
    variations.forEach(v => {
        if (!parJour[v.date]) parJour[v.date] = [];
        parJour[v.date].push(v);
    });
    
    const tableRows = Object.entries(parJour).map(([date, vars]) => {
        const maxVar = Math.max(...vars.map(v => parseFloat(v.variation)));
        return `
            <tr>
                <td><strong>${date}</strong></td>
                <td>${vars.length}</td>
                <td>${maxVar.toFixed(2)} V</td>
                <td>${vars.map(v => v.heureDebut).slice(0,3).join(', ')}${vars.length > 3 ? '...' : ''}</td>
            </tr>
        `;
    }).join('');
    
    // Construction du HTML avec le graphique
    let html = `
        <div class="tab-content">
            <h4>⚡ Détail des variations</h4>
    `;
    
    if (chartData && chartData.dates && chartData.dates.length > 0) {
        html += `
            <div class="chart-container-small" style="margin-bottom: 20px;">
                <canvas id="variationsChart"></canvas>
            </div>
        `;
    }
    
    html += `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Nombre</th>
                            <th>Max variation</th>
                            <th>Heures</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>
    `;
    
    // Assigner le HTML au conteneur
    container.innerHTML = html;
    
    // Programmer la création du graphique après l'insertion
    setTimeout(() => {
        if (chartData) {
            createVariationsFrequencyChart();
        }
    }, 100);
}

function renderExceedanceTab() {
    const container = document.getElementById('exceedanceTab');
    if (!container) return;
    
    const data = database.technicalData?.analyse14V || [];
    const chartData = database.technicalData?.chart14V;
    
    if (data.length === 0) {
        container.innerHTML = `
            <div class="tab-content">
                <p class="no-data">Aucune donnée de dépassement 14.2V</p>
            </div>
        `;
        return;
    }
    
    const tableRows = data.slice(0, 15).map(jour => `
        <tr>
            <td>${jour.date}</td>
            <td class="count-${jour.qualite}"><strong>${jour.count}x</strong></td>
            <td><span class="badge-${jour.qualite}">${jour.message}</span></td>
        </tr>
    `).join('');
    
    // Construction du HTML avec le graphique
    let html = `
        <div class="tab-content">
            <h4>🔋 Détail des dépassements 14.2V</h4>
    `;
    
    if (chartData && chartData.dates && chartData.dates.length > 0) {
        html += `
            <div class="chart-container-small" style="margin-bottom: 20px;">
                <canvas id="chart14V"></canvas>
            </div>
        `;
    }
    
    html += `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Fois ≥14.2V</th>
                            <th>Statut</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
                ${data.length > 15 ? `<p class="table-note">... et ${data.length - 15} autres jours</p>` : ''}
            </div>
        </div>
    `;
    
    // Assigner le HTML au conteneur
    container.innerHTML = html;
    
    // Programmer la création du graphique après l'insertion
    setTimeout(() => {
        if (chartData) {
            create14VChart(chartData);
        }
    }, 100);
}

function renderLoadSheddingTab() {
    const container = document.getElementById('loadSheddingTab');
    if (!container) return;
    
    const eventTable = database.tables.find(t => t.type === 'E');
    if (!eventTable || eventTable.data.length === 0) {
        container.innerHTML = `
            <div class="tab-content">
                <h4>⚡ Événements système</h4>
                <p class="no-data">Aucun événement détecté</p>
            </div>
        `;
        return;
    }

    // Extraire tous les événements
    const events = [];
    const clientsSet = new Set();
    
    eventTable.data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const eventType = cells[2];
        const clientId = cells[3];
        const valeur = cells[4];
        
        events.push({
            date,
            timestamp,
            type: eventType,
            clientId,
            valeur
        });
        
        if (clientId && clientId !== '0') {
            clientsSet.add(clientId);
        }
    });

    // Trier par date
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Obtenir la liste des clients
    const clients = Array.from(clientsSet).sort((a,b) => parseInt(a) - parseInt(b));
    
    // Préparer le calendrier horizontal (3 mois visibles)
    const calendarHtml = generateHorizontalCalendar(events);

    // Générer le HTML
    const html = `
        <div class="tab-content">
            <h4>⚡ Calendrier des événements</h4>
            
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
            
            <div class="client-tabs-container" style="margin-top: 20px;">
                <button class="client-tab-nav prev" id="prevEventClient">◀</button>
                <div class="client-tabs" id="eventClientTabs">
                    <button class="client-tab active" data-client="all">Tous les clients</button>
                    ${clients.map(c => `
                        <button class="client-tab" data-client="${c}">Client ${c}</button>
                    `).join('')}
                </div>
                <button class="client-tab-nav next" id="nextEventClient">▶</button>
            </div>
            
            <div id="eventListContainer">
                ${renderEventList(events)}
            </div>
        </div>
    `;
    
    // Assigner le HTML au conteneur
    container.innerHTML = html;
    
    // Attacher les événements après injection du HTML
    setTimeout(() => {
        attachEventClientNavigation(events, clients);
    }, 100);
}