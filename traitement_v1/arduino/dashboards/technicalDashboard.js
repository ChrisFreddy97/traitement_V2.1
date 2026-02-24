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
            <h3>📈 ANALYSE DE LA STABILITÉ</h3>
        </div>
        
        <!-- 3 mini-cartes -->
        <div class="row-3cols">
            <div id="variationsMiniCard" class="mini-card"></div>
            <div id="exceedanceMiniCard" class="mini-card"></div>
            <div id="loadSheddingMiniCard" class="mini-card coming-soon"></div>
        </div>
        
        <!-- Onglets -->
        <div class="tech-tabs-container">
            <div class="tech-tabs">
                <button class="tech-tab active" data-tab="variations">⚡ Variations</button>
                <button class="tech-tab" data-tab="exceedance">🔋 14.2V</button>
                <button class="tech-tab" data-tab="loadshed">⚡ Délestage</button>
            </div>
            <div id="techTabContent" class="tech-tab-content"></div>
        </div>
    `;

    container.innerHTML = html;

    // Remplir les cartes
    renderInfoCard();
    renderNormsCard();
    renderChartCard();
    renderVariationsMiniCard();
    renderExceedanceMiniCard();
    renderLoadSheddingMiniCard();
    
    // Afficher le premier onglet
    showTechTab('variations');
    
    // Gérer les clics sur les onglets
    document.querySelectorAll('.tech-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tech-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            showTechTab(e.target.dataset.tab);
        });
    });
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
                <span class="info-label">🔢 NANORÉSEAU N°</span>
                <span class="info-value">${nanoreseau}</span>
            </div>
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
// GESTION DES ONGLETS
// ===========================================
function showTechTab(tabName) {
    const container = document.getElementById('techTabContent');
    if (!container) return;
    
    switch(tabName) {
        case 'variations':
            container.innerHTML = renderVariationsTab();
            break;
        case 'exceedance':
            container.innerHTML = renderExceedanceTab();
            break;
        case 'loadshed':
            container.innerHTML = renderLoadSheddingTab();
            break;
        default:
            container.innerHTML = '';
    }
}

// ===========================================
// ONGLET 1: VARIATIONS RAPIDES (détaillé)
// ===========================================
function renderVariationsTab() {
    const variations = database.technicalData?.variationsRapides || [];
    const chartData = database.technicalData?.variationsChart;
    const seuil = database.technicalData?.normSystem === '24V' ? 3.5 : 1.5;
    
    if (variations.length === 0) {
        return `
            <div class="tab-content">
                <p class="no-data">Aucune variation détectée (seuil: ${seuil}V/h)</p>
            </div>
        `;
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
    
    // Programmer la création du graphique après l'insertion
    setTimeout(() => {
        if (chartData) {
            createVariationsChart(chartData);
        }
    }, 100);
    
    return html;
}
// ===========================================
// ONGLET 2: DÉPASSEMENTS 14.2V (détaillé)
// ===========================================
function renderExceedanceTab() {
    const data = database.technicalData?.analyse14V || [];
    const chartData = database.technicalData?.chart14V;
    
    if (data.length === 0) {
        return `
            <div class="tab-content">
                <p class="no-data">Aucune donnée de dépassement 14.2V</p>
            </div>
        `;
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
    
    // Programmer la création du graphique après l'insertion
    setTimeout(() => {
        if (chartData) {
            create14VChart(chartData);
        }
    }, 100);
    
    return html;
}

// ===========================================
// ONGLET 3: DÉLESTAGE (en cours)
// ===========================================
function renderLoadSheddingTab() {
    return `
        <div class="tab-content coming-soon">
            <h4>⚡ Analyse du délestage</h4>
            <div class="coming-soon-content">
                <p>🚧 Fonctionnalité en cours de développement</p>
                <small>Bientôt disponible</small>
            </div>
        </div>
    `;
}

// ===========================================
// GRAPHIQUE PRINCIPAL
// ===========================================
function createTensionChart(dailyStats) {
    const ctx = document.getElementById('tensionChart');
    if (!ctx) return;
    
    if (tensionChartInstance) tensionChartInstance.destroy();
    
    tensionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dailyStats.dates,
            datasets: [
                { label: 'Tension minimale', data: dailyStats.mins, borderColor: '#42a5f5', borderWidth: 2, tension: 0.3 },
                { label: 'Tension maximale', data: dailyStats.maxs, borderColor: '#ff9800', borderWidth: 2, tension: 0.3 },
                { label: 'Tension moyenne', data: dailyStats.avgs, borderColor: '#4caf50', borderWidth: 2, borderDash: [5,5], tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
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
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.dates,
            datasets: [{
                label: 'Nombre de fois ≥14.2V',
                data: chartData.counts,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                pointBackgroundColor: chartData.counts.map(c => 
                    c >= 4 ? '#4CAF50' : c >= 2 ? '#FFD700' : c === 1 ? '#FF8C00' : '#F44336'
                ),
                pointRadius: 5,
                pointHoverRadius: 8,
                fill: true
            }]
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

function createVariationsChart(chartData) {
    const ctx = document.getElementById('variationsChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.dates,
            datasets: [
                { label: 'Variation max (V)', data: chartData.max, borderColor: '#f44336', tension: 0.3 },
                { label: 'Variation moyenne (V)', data: chartData.avg, borderColor: '#ff9800', borderDash: [5,5], tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { title: { display: true, text: 'Variation (V)' } } }
        }
    });
}