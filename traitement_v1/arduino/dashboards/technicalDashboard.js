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
        <div id="techStatsContainer"></div>
        <div id="techNormsContainer"></div>
        <div id="extremesSummaryContainer" class="resume-row"></div>
        <div id="exceedanceContainer"></div>
        <div id="variationsContainer"></div>
        <div id="criticalExceedancesContainer"></div>
        <div id="techChartContainer"></div>
    `;

    container.innerHTML = html;

    renderTechStatsCard();
    renderTechChartCard();
    renderTechNormsCard();
    renderExtremesSummaryCard();
    renderExceedanceCard();
    renderVariationsCard();
    renderCriticalExceedancesCard();
}

// ===========================================
// CARTES PRINCIPALES
// ===========================================

function renderTechStatsCard() {
    const container = document.getElementById('techStatsContainer');
    if (!container) return;
    
    const data = database.technicalData;
    
    container.innerHTML = `
        <div class="stats-container">
            <div class="stat-card">
                <div class="stat-label">📅 Période</div>
                <div class="stat-value">${data.daysCount}</div>
                <div class="stat-unit">jours</div>
                <div class="stat-sub">du ${data.dailyStats.dates[0]} au ${data.dailyStats.dates[data.dailyStats.dates.length-1]}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">👥 Nombre de clients</div>
                <div class="stat-value">${data.clientCount}</div>
                <div class="stat-sub">clients actifs</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">📊 Tension moyenne</div>
                <div class="stat-value">${data.globalAvg.toFixed(2)} V</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">⬇️ Tension minimale</div>
                <div class="stat-value" style="color:#64b5f6;">${data.globalMin.toFixed(2)} V</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">⬆️ Tension maximale</div>
                <div class="stat-value" style="color:#ffb74d;">${data.globalMax.toFixed(2)} V</div>
            </div>
        </div>
    `;
}

function renderTechChartCard() {
    const container = document.getElementById('techChartContainer');
    if (!container) return;
    
    const data = database.technicalData;
    
    container.innerHTML = `
        <div class="chart-container">
            <div class="chart-title"><span>📈 Évolution journalière des tensions</span></div>
            <div class="chart-wrapper"><canvas id="tensionChart"></canvas></div>
        </div>
    `;
    
    createTensionChart(data.dailyStats);
}

function renderTechNormsCard() {
    const container = document.getElementById('techNormsContainer');
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
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div class="norms-container">
            <div class="norm-card">
                <div class="norm-header"><span style="font-size:1.5em;">🔋</span><h3>Normes Système ${normSystem}</h3></div>
                <div class="norm-grid">
                    <div class="norm-item"><span class="norm-label">Tension minimale</span><span class="norm-value">${normData.min}V</span></div>
                    <div class="norm-item"><span class="norm-label">Plage idéale</span><span class="norm-value norm-range">${normData.ideal}V</span></div>
                    <div class="norm-item"><span class="norm-label">Tension maximale</span><span class="norm-value">${normData.max}V</span></div>
                    <div class="norm-item"><span class="norm-label">Seuil d'alerte</span><span class="norm-value alert-threshold">${normData.alert}</span></div>
                </div>
            </div>
        </div>
    `;
}

// ===========================================
// CARTES DE RÉSUMÉ
// ===========================================

function renderExtremesSummaryCard() {
    const container = document.getElementById('extremesSummaryContainer');
    if (!container) return;
    
    const data = database.technicalData?.extremesSummary;
    if (!data || !data.max || !data.min) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div class="resume-card">
            <div class="card-header">
                <span class="card-icon">🏆</span>
                <h3>Records de la période</h3>
            </div>
            <div class="extremes-grid">
                <div class="extreme-item">
                    <div class="extreme-label">🔺 Tension maximale</div>
                    <div class="extreme-value">${data.max.valeur} V</div>
                    <div class="extreme-detail">${data.max.date} à ${data.max.heure}</div>
                </div>
                <div class="extreme-item">
                    <div class="extreme-label">🔻 Tension minimale</div>
                    <div class="extreme-value">${data.min.valeur} V</div>
                    <div class="extreme-detail">${data.min.date} à ${data.min.heure}</div>
                </div>
            </div>
        </div>
    `;
}

function renderCriticalExceedancesCard() {
    const container = document.getElementById('criticalExceedancesContainer');
    if (!container) return;
    
    const data = database.technicalData?.criticalExceedances;
    const normSystem = database.technicalData?.normSystem;
    const norms = VOLTAGE_NORMS[normSystem];
    
    if (!data || (data.surtensions.length === 0 && data.sousTensions.length === 0)) {
        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">✅</span>
                    <h3>Aucun dépassement des seuils critiques</h3>
                </div>
                <p>Seuils : ${norms?.min}V - ${norms?.max}V</p>
            </div>
        `;
        return;
    }

    // Stats globales
    const totalSurtensions = data.stats.totalSurtensions;
    const totalSousTensions = data.stats.totalSousTensions;
    const joursSurtension = data.stats.joursAvecSurtension.size;
    const joursSousTension = data.stats.joursAvecSousTension.size;

    // Tableau combiné des dépassements
    const allExceedances = [
        ...data.surtensions.map(e => ({ ...e, type: 'surtension' })),
        ...data.sousTensions.map(e => ({ ...e, type: 'sousTension' }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    let tableRows = '';
    allExceedances.slice(0, 20).forEach(e => {
        const rowClass = e.type === 'surtension' ? 'row-danger' : 'row-warning';
        tableRows += `
            <tr class="${rowClass}">
                <td>${e.date}</td>
                <td>${e.heure}</td>
                <td>${e.type === 'surtension' ? '🔺 Surtension' : '🔻 Sous-tension'}</td>
                <td>${e.valeur.toFixed(2)}V</td>
                <td>${e.message}</td>
            </tr>
        `;
    });

    // Fréquences (pour graphique éventuel)
    const freqSurtension = data.frequences.surtension;
    const freqSousTension = data.frequences.sousTension;

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span class="card-icon">⚠️</span>
                <h3>Dépassements des seuils critiques (${norms?.min}V - ${norms?.max}V)</h3>
            </div>
            
            <div class="critical-stats">
                <div class="stat-critical surtension">
                    <span class="stat-icon">🔺</span>
                    <div>
                        <span class="stat-value">${totalSurtensions}</span>
                        <span class="stat-label">surtensions</span>
                        <span class="stat-detail">sur ${joursSurtension} jours</span>
                    </div>
                </div>
                <div class="stat-critical sousTension">
                    <span class="stat-icon">🔻</span>
                    <div>
                        <span class="stat-value">${totalSousTensions}</span>
                        <span class="stat-label">sous-tensions</span>
                        <span class="stat-detail">sur ${joursSousTension} jours</span>
                    </div>
                </div>
            </div>
            
            ${freqSurtension.length > 0 ? `
                <div class="frequence-section">
                    <h4>Fréquence des surtensions par jour</h4>
                    <div class="frequence-list">
                        ${freqSurtension.map(f => `
                            <div class="frequence-item">
                                <span>${f.date}</span>
                                <span class="badge">${f.count}x</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${freqSousTension.length > 0 ? `
                <div class="frequence-section">
                    <h4>Fréquence des sous-tensions par jour</h4>
                    <div class="frequence-list">
                        ${freqSousTension.map(f => `
                            <div class="frequence-item">
                                <span>${f.date}</span>
                                <span class="badge">${f.count}x</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Heure</th>
                            <th>Type</th>
                            <th>Valeur</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
                ${allExceedances.length > 20 ? `<p class="table-note">... et ${allExceedances.length - 20} autres</p>` : ''}
            </div>
        </div>
    `;
}

// ===========================================
// CARTE DES DÉPASSEMENTS 14.2V (avec graphique)
// ===========================================

function renderExceedanceCard() {
    const container = document.getElementById('exceedanceContainer');
    if (!container) return;
    
    const data = database.technicalData?.analyse14V;
    const chartData = database.technicalData?.chart14V;
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p>Aucune donnée de dépassement 14.2V</p>';
        return;
    }

    const excellent = data.filter(d => d.qualite === 'excellent').length;
    const bon = data.filter(d => d.qualite === 'bon').length;
    const mauvais = data.filter(d => d.qualite === 'mauvais').length;
    const critique = data.filter(d => d.qualite === 'critique').length;

    let tableRows = '';
    data.slice(0, 10).forEach(jour => {
        tableRows += `
            <tr>
                <td>${jour.date}</td>
                <td class="count-${jour.qualite}"><strong>${jour.count}x</strong></td>
                <td><span class="badge-${jour.qualite}">${jour.message}</span></td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span class="card-icon">⚡</span>
                <h3>Fréquence d'atteinte de 14.2V (80% charge)</h3>
            </div>
            
            <div class="stats-mini">
                <div class="stat-mini excellent">
                    <span class="stat-emoji">🌟</span>
                    <span class="stat-number">${excellent}</span>
                    <span class="stat-label">Excellent</span>
                </div>
                <div class="stat-mini bon">
                    <span class="stat-emoji">👍</span>
                    <span class="stat-number">${bon}</span>
                    <span class="stat-label">Bon</span>
                </div>
                <div class="stat-mini mauvais">
                    <span class="stat-emoji">⚠️</span>
                    <span class="stat-number">${mauvais}</span>
                    <span class="stat-label">Mauvais</span>
                </div>
                <div class="stat-mini critique">
                    <span class="stat-emoji">🔴</span>
                    <span class="stat-number">${critique}</span>
                    <span class="stat-label">Critique</span>
                </div>
            </div>
            
            <div style="height: 200px; margin: 10px 0;">  <!-- ← margin réduit de 20px à 10px -->
                <canvas id="chart14V"></canvas>
            </div>
            
            <div class="table-wrapper" style="margin-top: 5px;">  <!-- ← margin-top ajouté -->
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
                ${data.length > 10 ? `<p style="text-align: center; margin-top: 5px; color: #666;">... et ${data.length - 10} autres jours</p>` : ''}
            </div>
            
            <div class="legend-grid" style="margin-top: 10px;">  <!-- ← margin-top réduit -->
                <div class="legend-item"><span class="legend-color excellent"></span> ≥4 : Excellent</div>
                <div class="legend-item"><span class="legend-color bon"></span> 2-3 : Bon</div>
                <div class="legend-item"><span class="legend-color mauvais"></span> 1 : Mauvais</div>
                <div class="legend-item"><span class="legend-color critique"></span> 0 : Critique</div>
            </div>
        </div>
    `;
    
    if (chartData) {
        setTimeout(() => create14VChart(chartData), 100);
    }
}
// ===========================================
// CARTE DES VARIATIONS (avec graphique)
// ===========================================

function renderVariationsCard() {
    const container = document.getElementById('variationsContainer');
    if (!container) return;
    
    const variations = database.technicalData?.variationsRapides;
    const chartData = database.technicalData?.variationsChart;
    const seuil = database.technicalData?.normSystem === '24V' ? 3.5 : 1.5;
    
    if (!variations || variations.length === 0) {
        container.innerHTML = `
            <div class="card">
                <h3>⚡ Variations rapides</h3>
                <p>Aucune variation détectée (seuil: ${seuil}V/h)</p>
            </div>
        `;
        return;
    }

    const parJour = database.technicalData?.variationsParJour || {};

    let tableRows = '';
    Object.entries(parJour).forEach(([date, vars]) => {
        const maxVar = Math.max(...vars.map(v => v.variation));
        tableRows += `
            <tr>
                <td>${date}</td>
                <td>${vars.length}</td>
                <td>${maxVar.toFixed(2)}V</td>
                <td>${vars.slice(0,2).map(v => v.heureDebut).join(', ')}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span class="card-icon">📊</span>
                <h3>Variations rapides (seuil: ${seuil}V/h)</h3>
            </div>
            
            <div style="height:200px; margin:20px 0;">
                <canvas id="variationsChart"></canvas>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>Date</th><th>Nombre</th><th>Max</th><th>Heures</th></tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        </div>
    `;
    
    if (chartData) {
        createVariationsChart(chartData);
    }
}

// ===========================================
// GRAPHIQUES
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
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: false, title: { display: true, text: 'Tension (V)' } } }
        }
    });
}

function create14VChart(chartData) {
    const ctx = document.getElementById('chart14V');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',  // ← Changé de 'bar' à 'line'
        data: {
            labels: chartData.dates,
            datasets: [{
                label: 'Nombre de fois ≥14.2V',
                data: chartData.counts,
                borderColor: '#4CAF50',      // Couleur de la ligne
                backgroundColor: 'rgba(76, 175, 80, 0.1)', // Remplissage léger
                borderWidth: 3,
                tension: 0.3,                 // Courbe légèrement arrondie
                pointBackgroundColor: chartData.counts.map(c => 
                    c >= 4 ? '#4CAF50' : c >= 2 ? '#2196F3' : c === 1 ? '#FF9800' : '#F44336'
                ),
                pointRadius: 5,
                pointHoverRadius: 8,
                fill: true                     // Remplir sous la courbe
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