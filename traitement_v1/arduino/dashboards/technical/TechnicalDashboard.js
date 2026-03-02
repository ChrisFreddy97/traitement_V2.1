// dashboards/technical/TechnicalDashboard.js
import { database } from '../../arduinoCore.js';
import { VOLTAGE_NORMS } from '../../arduinoConstants.js';
import { getEnergyStats } from '../../analytics/energyAnalytics.js';
import { renderEnergyBoard } from './EnergyBoard.js';
import { renderCurrentBoard } from './CurrentBoard.js';

// ===========================================
// GESTIONNAIRE DE GRAPHIQUES (ÉVITE LES FUITES MÉMOIRE)
// ===========================================

const chartManager = {
    // Ici on stocke tous nos graphiques
    instances: {},
    
    // Méthode pour créer ou mettre à jour un graphique
    create: function(canvasId, config) {
        console.log(`📊 Création du graphique: ${canvasId}`);
        
        // 1. Si un graphique existe déjà avec cet ID, on le détruit
        if (this.instances[canvasId]) {
            console.log(`   → Ancien graphique trouvé, destruction...`);
            this.instances[canvasId].destroy();
            delete this.instances[canvasId];
        }
        
        // 2. On récupère le canvas dans le DOM
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`   → Canvas ${canvasId} non trouvé`);
            return null;
        }
        
        // 3. On crée le nouveau graphique
        console.log(`   → Nouveau graphique créé`);
        this.instances[canvasId] = new Chart(canvas, config);
        
        return this.instances[canvasId];
    },
    
    // Méthode pour détruire un graphique spécifique
    destroy: function(canvasId) {
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
            delete this.instances[canvasId];
            console.log(`✅ Graphique ${canvasId} détruit`);
        }
    },
    
    // Méthode pour détruire TOUS les graphiques
    destroyAll: function() {
        Object.keys(this.instances).forEach(id => {
            this.instances[id].destroy();
            delete this.instances[id];
        });
        console.log(`✅ Tous les graphiques détruits`);
    }
};

// helper pour appliquer certains styles dépendants de données
function applyDynamicStyles() {
    document.querySelectorAll('.progress-fill').forEach(el => {
        const p = el.dataset.percent;
        if (p !== undefined) el.style.width = p + '%';
    });
    document.querySelectorAll('.voltage-bar').forEach(el => {
        const h = el.dataset.height;
        const c = el.dataset.color;
        if (h !== undefined) el.style.height = h + 'px';
        if (c) el.style.background = c;
    });
}

// ===========================================
// DASHBOARD TECHNIQUE PRINCIPAL
// ===========================================

export function renderTechnicalDashboard() {
    const container = document.getElementById('technicalDashboard');
    if (!container) return;
    
    // Vérifier qu'on est sur le bon onglet
    if (document.querySelector('.tab.active')?.dataset.tab !== 'Technique') {
        container.innerHTML = '';
        return;
    }
    
    // CONSTRUCTION DU HTML avec tous les conteneurs vides
    const html = `
        <!-- I) DONNÉES TECHNIQUES -->
        <div class="section-title"><h2>🔧 I) DONNÉES TECHNIQUES</h2></div>
        <div id="infoCard" class="card"></div>
        
        <!-- II) ANALYSE GÉNÉRALE DE LA TENSION -->
        <div class="section-title"><h2>📊 II) ANALYSE GÉNÉRALE DE LA TENSION</h2></div>
        
        <!-- 1) Analyse conformité -->
        <div id="conformityContainer" class="card"></div>
        <!-- 1bis) Normes système (NOUVELLE CARTE) -->
        <div id="normsCard" class="card"></div>
        
        <!-- 2) Tableau de bord dépassements (min, max, variation) -->
        <div id="exceedanceBoard" class="card"></div>
        
        <!-- 3) Délestages -->
        <div id="loadSheddingBoard" class="card"></div>
        
        <!-- 4) ≥14.2V / ≥28V -->
        <div id="highVoltageBoard" class="card"></div>
        
        <!-- 5) Courbe Tmin/max journalière -->
        <div id="dailyChartCard" class="card"></div>
        
        <!-- 6) Évolution horaire -->
        <div id="hourlyChartCard" class="card"></div>
        
        <!-- III) ANALYSE ÉNERGIE -->
        <div class="section-title"><h2>⚡ III) ANALYSE ÉNERGIE</h2></div>
        <div id="energyBoard" class="card"></div>
        <div id="energyTable" class="card"></div>
       `;
    
    container.innerHTML = html;
    
    // REMPLIR CHAQUE CARTE DANS L'ORDRE
    renderInfoCard();                // I
    renderConformityCard();          // II-1
    renderNormsCard();
    renderExceedanceBoard();         // II-2
    renderLoadSheddingBoard();       // II-3
    renderHighVoltageBoard();        // II-4
    renderDailyChart();              // II-5
    renderHourlyChart();             // II-6
    renderEnergyBoard();             // III
    renderEnergyTable();             // III 
}

// ===========================================
// I) DONNÉES TECHNIQUES
// ===========================================

function renderInfoCard() {
    const container = document.getElementById('infoCard');
    if (!container) return;
    
    const data = database.technicalData;
    if (!data) {
        container.innerHTML = '<p class="no-data">Aucune donnée technique</p>';
        return;
    }
    
    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent || 'N/A';
    
    container.innerHTML = `
        <h3 class="card-title">📋 INFORMATIONS RÉSEAU</h3>
        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">🔌 NANORÉSEAU</span>
                <span class="info-value">${nanoreseau}</span>
            </div>
            <div class="info-item">
                <span class="info-label">📅 Période</span>
                <span class="info-value">${data.daysCount || 0} jours</span>
                <span class="info-sub">${data.chartData?.dates[0] || '??'} au ${data.chartData?.dates[data.daysCount-1] || '??'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">👥 Clients</span>
                <span class="info-value">${data.clientCount || 0}</span>
            </div>
            <div class="info-item">
                <span class="info-label">⚡ Tension moyenne</span>
                <span class="info-value">${data.globalAvg?.toFixed(2) || 0} V</span>
            </div>
            <div class="info-item">
                <span class="info-label">⬇️ Tension minimale</span>
                <span class="info-value min">${data.globalMin?.toFixed(2) || 0} V</span>
            </div>
            <div class="info-item">
                <span class="info-label">⬆️ Tension maximale</span>
                <span class="info-value max">${data.globalMax?.toFixed(2) || 0} V</span>
            </div>
        </div>
    `;
}

// ===========================================
// II-1) ANALYSE CONFORMITÉ
// ===========================================

function renderConformityCard() {
    const container = document.getElementById('conformityContainer');
    if (!container) return;
    
    const data = database.technicalData?.conformity;
    if (!data) {
        container.innerHTML = '<p class="no-data">Données de conformité non disponibles</p>';
        return;
    }
    
    const nonConformes = data.totalJours - data.conformes;
    const pourcentageNonConforme = (100 - parseFloat(data.pourcentage)).toFixed(1);
    const percentClass = data.pourcentage >= 80 ? 'color-success' : 'color-warning';
    
    // Calcul du fonctionnement idéal
    const joursIdeaux = data.totalJours - (data.causes.max.length + data.causes.min.length + data.causes.variation.length);
    const pourcentageIdeal = ((joursIdeaux / data.totalJours) * 100).toFixed(1);
    
    container.innerHTML = `
        <h3 class="card-title">📊 CONFORMITÉ DU SYSTÈME</h3>
        
        <!-- Indicateurs principaux -->
        <div class="grid-3 gap-15 mb-20">
            <div class="stat-card text-center">
                <div class="stat-label">✅ Jours conformes</div>
                <div class="stat-value ${percentClass}">${data.pourcentage}%</div>
                <div class="stat-detail">${data.conformes}/${data.totalJours} jours</div>
            </div>
            
            <div class="stat-card text-center">
                <div class="stat-label">⚠️ Jours non conformes</div>
                <div class="stat-value color-danger">${pourcentageNonConforme}%</div>
                <div class="stat-detail">${nonConformes}/${data.totalJours} jours</div>
            </div>
            
            <div class="stat-card text-center">
                <div class="stat-label">💚 Fonctionnement idéal</div>
                <div class="stat-value color-success">${pourcentageIdeal}%</div>
                <div class="stat-detail">${joursIdeaux}/${data.totalJours} jours</div>
            </div>
        </div>
        
        <!-- Détail des causes -->
        <div class="mt-20">
            <h4 class="section-subtitle">🔍 Causes de non-conformité</h4>
            <div class="grid-3 gap-15">
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⬆️</span>
                        <span class="cause-label">Surtension</span>
                    </div>
                    <div class="cause-value color-danger">${data.causes.max.length}</div>
                    <div class="cause-detail">jours</div>
                </div>
                
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⬇️</span>
                        <span class="cause-label">Sous-tension</span>
                    </div>
                    <div class="cause-value color-danger">${data.causes.min.length}</div>
                    <div class="cause-detail">jours</div>
                </div>
                
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⚡</span>
                        <span class="cause-label">Variation</span>
                    </div>
                    <div class="cause-value color-danger">${data.causes.variation.length}</div>
                    <div class="cause-detail">jours</div>
                </div>
            </div>
        </div>
    `;
}

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

// ====*=======================================
// II-2) TABLEAU DE BORD DÉPASSEMENTS
// ===========================================

function renderExceedanceBoard() {
    const container = document.getElementById('exceedanceBoard');
    if (!container) return;
    
    const data = database.technicalData;
    if (!data) return;
    
    const normSystem = data.normSystem || '12V';
    const norms = VOLTAGE_NORMS[normSystem];
    const exceedances = data.exceedances || { min: 0, max: 0, variation: 0 };
    
    const minClass = exceedances.min > 0 ? 'color-danger' : 'color-success';
    const maxClass = exceedances.max > 0 ? 'color-danger' : 'color-success';
    const varClass = exceedances.variation > 0 ? 'color-danger' : 'color-success';
    
    container.innerHTML = `
        <h3 class="card-title">📊 DÉPASSEMENTS</h3>
        <div class="grid-3 gap-15">
            <div class="exceedance-card gradient-bg">
                <div class="icon-large color-min">⬇️</div>
                <div class="text-center">
                    <span class="stat-large ${minClass}">${exceedances.min}</span>
                    <span class="color-gray"> jours</span>
                </div>
                <div class="text-center color-gray font-small">sous ${norms.min}V</div>
            </div>
            <div class="exceedance-card gradient-bg">
                <div class="icon-large color-max">⬆️</div>
                <div class="text-center">
                    <span class="stat-large ${maxClass}">${exceedances.max}</span>
                    <span class="color-gray"> jours</span>
                </div>
                <div class="text-center color-gray font-small">> ${norms.max}V</div>
            </div>
            <div class="exceedance-card gradient-bg">
                <div class="icon-large color-warning">⚡</div>
                <div class="text-center">
                    <span class="stat-large ${varClass}">${exceedances.variation}</span>
                    <span class="color-gray"> jours</span>
                </div>
                <div class="text-center color-gray font-small">variations critiques</div>
            </div>
        </div>
        <div class="mt-10 text-right color-grey font-tiny">
            Seuil variation: ${norms.variationSeuil}V/h
        </div>
    `;
}

// ===========================================
// II-3) DÉLESTAGES
// ===========================================

function renderLoadSheddingBoard() {
    const container = document.getElementById('loadSheddingBoard');
    if (!container) return;
    
    const loadShedding = database.technicalData?.loadShedding || {
        partiel: 0,
        total: 0,
        jours: []
    };
    
    const total = loadShedding.partiel + loadShedding.total;
    const partielPercent = total > 0 ? ((loadShedding.partiel / total) * 100).toFixed(1) : 0;
    const totalPercent = total > 0 ? ((loadShedding.total / total) * 100).toFixed(1) : 0;
    
    container.innerHTML = `
        <h3 class="card-title">⚡ DÉLESTAGES</h3>
        
        <!-- Stats principales -->
        <div class="flex gap-20 mb-20">
            <div class="flex-1 text-center p-20 bg-dark radius-8">
                <div class="font-xlarge color-warning">${total}</div>
                <div class="color-gray">Total événements</div>
            </div>
            <div class="flex-2 flex-col gap-15 p-10">
                <!-- Barre partiel -->
                <div>
                    <div class="flex justify-space-between mb-5">
                        <span class="color-max">🔸 Délestage partiel</span>
                        <span class="color-white">${loadShedding.partiel} (${partielPercent}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill warning" data-percent="${partielPercent}"></div>
                    </div>
                </div>
                <!-- Barre total -->
                <div>
                    <div class="flex justify-space-between mb-5">
                        <span class="color-danger">🔴 Délestage total</span>
                        <span class="color-white">${loadShedding.total} (${totalPercent}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill danger" data-percent="${totalPercent}"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Jours concernés -->
        <div class="bg-darker p-15 radius-8">
            <div class="flex justify-space-between align-center">
                <span class="color-gray">📅 Jours avec délestage</span>
                <span class="stat-large color-warning">${loadShedding.jours.length}</span>
            </div>
            ${loadShedding.jours.length > 0 ? `
                <div class="mt-10 flex flex-wrap gap-5">
                    ${loadShedding.jours.slice(0, 7).map(date => `
                        <span class="tag small">
                            ${date}
                        </span>
                    `).join('')}
                    ${loadShedding.jours.length > 7 ? `<span class="color-gray">+${loadShedding.jours.length-7} autres</span>` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

// ===========================================
// II-4) ≥14.2V / ≥28V
// ===========================================
function renderHighVoltageBoard() {
    const container = document.getElementById('highVoltageBoard');
    if (!container) return;
    
    const data = database.technicalData;
    if (!data) return;
    
    const normSystem = data.normSystem || '12V';
    const seuil = normSystem === '24V' ? 28 : 14.2;
    const highVoltage = data.highVoltage || [];
    
    const excellent = highVoltage.filter(d => d.qualite === 'excellent').length;
    const bon = highVoltage.filter(d => d.qualite === 'bon').length;
    const mauvais = highVoltage.filter(d => d.qualite === 'mauvais').length;
    const critique = highVoltage.filter(d => d.qualite === 'critique').length;
    
    // ✅ CORRECTION : Prendre TOUS les jours, triés par date
    const allDays = [...highVoltage].sort((a, b) => a.date.localeCompare(b.date));
    const chartDates = allDays.map(d => d.date);
    const chartCounts = allDays.map(d => d.count);
    
    container.innerHTML = `
        <h3 class="card-title">🔋 TENSION HAUTE (≥${seuil}V)</h3>
        
        <!-- Stats en carte -->
        <div class="stats-grid-4">
            <div class="stat-card excellent">
                <div class="stat-value">${excellent}</div>
                <div class="stat-label">EXCELLENT</div>
                <div class="stat-sub">≥4x/jour</div>
            </div>
            <div class="stat-card bon">
                <div class="stat-value">${bon}</div>
                <div class="stat-label">BON</div>
                <div class="stat-sub">2-3x/jour</div>
            </div>
            <div class="stat-card mauvais">
                <div class="stat-value">${mauvais}</div>
                <div class="stat-label">MAUVAIS</div>
                <div class="stat-sub">1x/jour</div>
            </div>
            <div class="stat-card critique">
                <div class="stat-value">${critique}</div>
                <div class="stat-label">CRITIQUE</div>
                <div class="stat-sub">0x/jour</div>
            </div>
        </div>
        
        <!-- GRAPHE - TOUS les jours -->
        <div class="chart-container">
            <div class="chart-header">
                <span>📊 Évolution des dépassements (${highVoltage.length} jours)</span>
            </div>
            <div class="chart-wrapper">
                <canvas id="highVoltageChart"></canvas>
            </div>
        </div>
    `;
    
    // Nettoyer l'ancien graphique
    chartManager.destroy('highVoltageChart');
    
    // Créer le nouveau graphique avec TOUTES les données
    setTimeout(() => {
        createHighVoltageChart(chartDates, chartCounts, seuil);
    }, 100);
}

function createHighVoltageChart(dates, counts, seuil) {
    const canvas = document.getElementById('highVoltageChart');
    if (!canvas) return;
    
    // Ligne de référence à 4 (seuil excellent)
    const referenceLine = {
        label: `Seuil excellent (4x/jour)`,
        data: Array(dates.length).fill(4),
        borderColor: '#4CAF50',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    const config = {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: `Nombre de fois ≥${seuil}V`,
                    data: counts,
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    pointBackgroundColor: counts.map(c => 
                        c >= 4 ? '#4CAF50' : 
                        c >= 2 ? '#FFD700' : 
                        c === 1 ? '#FF9800' : '#F44336'
                    ),
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    fill: true
                },
                referenceLine
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true,
                    labels: { color: '#fff', font: { size: 12, weight: 'bold' } }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#ff9800',
                    bodyColor: '#fff',
                    borderColor: '#ff9800',
                    borderWidth: 2,
                    padding: 12,
                    titleFont: { weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Nombre de fois par jour',
                        color: '#fff',
                        font: { weight: 'bold' }
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#fff', font: { weight: 'bold' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        color: '#fff',
                        font: { weight: 'bold' },
                        maxRotation: 45
                    }
                }
            }
        }
    };
    
    // ✅ Utilisation du chartManager
    chartManager.create('highVoltageChart', config);
}
// ===========================================
// II-5) COURBE TENSION JOURNALIÈRE
// ===========================================

function renderDailyChart() {
    const container = document.getElementById('dailyChartCard');
    if (!container) return;
    
    const data = database.technicalData?.chartData;
    if (!data) {
        container.innerHTML = '<p class="no-data">Données insuffisantes pour le graphique</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">📈 ÉVOLUTION JOURNALIÈRE DES TENSIONS</h3>
        <div style="height: 300px; width: 100%; background: #1a2535; border-radius: 8px; padding: 15px;">
            <canvas id="dailyTensionChart" style="width:100%; height:100%;"></canvas>
        </div>
    `;
    
    // Créer le graphique après insertion
    setTimeout(() => createDailyTensionChart(data), 100);
}

function createDailyTensionChart(data) {
    const normSystem = database.technicalData?.normSystem || '12V';
    const norms = VOLTAGE_NORMS[normSystem];
    
    // Créer les lignes de seuil pour toute la période
    const nbJours = data.dates.length;
    
    const minLine = {
        label: `Seuil min (${norms.min}V)`,
        data: Array(nbJours).fill(norms.min),
        borderColor: '#f44336',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    const maxLine = {
        label: `Seuil max (${norms.max}V)`,
        data: Array(nbJours).fill(norms.max),
        borderColor: '#ff9800',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    // Valeur idéale (milieu de la plage)
    const idealValue = (norms.min + norms.max) / 2;
    const idealLine = {
        label: `Plage idéale (${norms.ideal}V)`,
        data: Array(nbJours).fill(idealValue),
        borderColor: '#4CAF50',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    const chartConfig = {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: 'Tension min',
                    data: data.mins,
                    borderColor: '#64b5f6',
                    backgroundColor: 'rgba(100, 181, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointBackgroundColor: data.mins.map(v => 
                        v < norms.min ? '#f44336' : '#64b5f6'
                    ),
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Tension max',
                    data: data.maxs,
                    borderColor: '#ffb74d',
                    backgroundColor: 'rgba(255, 183, 77, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointBackgroundColor: data.maxs.map(v => 
                        v > norms.max ? '#f44336' : '#ffb74d'
                    ),
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Tension moyenne',
                    data: data.avgs,
                    borderColor: '#4CAF50',
                    backgroundColor : 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointBackgroundColor: data.avgs.map(v => 
                        v < norms.min || v > norms.max ? '#f44336' : '#4CAF50'
                    ),
                    pointRadius: 0
                },
                minLine,
                maxLine,
                idealLine
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: true,
                    labels: { color: '#aaa' }
                },
                tooltip: {
                    backgroundColor: '#1e2a3a',
                    titleColor: '#ff9800',
                    bodyColor: '#aaa',
                    borderColor: '#d4a373',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.dataset.label.includes('Seuil')) {
                                return `${ctx.dataset.label}: ${ctx.parsed.y}V`;
                            }
                            if (ctx.dataset.label.includes('Plage')) {
                                return `${ctx.dataset.label}`;
                            }
                            
                            let text = `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}V`;
                            
                            // Ajouter une indication si hors norme
                            if (ctx.dataset.label === 'Tension min' && ctx.parsed.y < norms.min) {
                                text += ' 🔴 Sous-tension';
                            } else if (ctx.dataset.label === 'Tension max' && ctx.parsed.y > norms.max) {
                                text += ' 🔴 Surtension';
                            }
                            
                            return text;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    grid: { color: '#2a3a4a' }, 
                    ticks: { color: '#aaa' },
                    title: {
                        display: true,
                        text: 'Tension (V)',
                        color: '#aaa'
                    },
                    min: Math.min(norms.min - 1, ...data.mins, ...data.avgs) - 1,
                    max: Math.max(norms.max + 1, ...data.maxs, ...data.avgs) + 1
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#aaa', maxRotation: 45 }
                }
            }
        }
    };
    
    chartManager.create('dailyTensionChart', chartConfig);
}

// ===========================================
// II-6) ÉVOLUTION HORAIRE
// ===========================================

function renderHourlyChart() {
    const container = document.getElementById('hourlyChartCard');
    if (!container) return;
    
    // Récupérer tous les jours disponibles
    const tensionTable = database.tables.find(t => t.type === 'T');
    if (!tensionTable) return;
    
    // Extraire tous les jours uniques
    const jours = new Set();
    tensionTable.data.forEach(row => {
        const date = row.split(';')[1].split(' ')[0];
        jours.add(date);
    });
    
    const joursList = Array.from(jours).sort().reverse(); // Du plus récent au plus ancien
    const defaultJour = joursList[0] || ''; // Dernier jour par défaut
    
    container.innerHTML = `
        <h3 class="card-title">⏱️ ÉVOLUTION HORAIRE</h3>
        
        <!-- Sélecteur de jour -->
        <div class="day-selector">
            <label for="hourlyDaySelect">📅 Sélectionner un jour :</label>
            <select id="hourlyDaySelect" class="day-select">
                ${joursList.map(jour => `
                    <option value="${jour}" ${jour === defaultJour ? 'selected' : ''}>${jour}</option>
                `).join('')}
            </select>
        </div>
        
        <div style="height: 250px; width: 100%; background: #1a2535; border-radius: 8px; padding: 15px; margin-top: 15px;">
            <canvas id="hourlyTensionChart" style="width:100%; height:100%;"></canvas>
        </div>
    `;
    
    // Graphique initial avec le dernier jour
    loadHourlyData(defaultJour);
    
    // Événement changement de jour
    document.getElementById('hourlyDaySelect').addEventListener('change', (e) => {
        loadHourlyData(e.target.value);
    });
}

function loadHourlyData(selectedDate) {
    const tensionTable = database.tables.find(t => t.type === 'T');
    if (!tensionTable) return;
    
    // Déterminer le système (12V ou 24V)
    const normSystem = database.technicalData?.normSystem || '12V';
    const norms = VOLTAGE_NORMS[normSystem];
    
    // Filtrer les données pour le jour sélectionné
    const dayData = tensionTable.data.filter(row => {
        return row.split(';')[1].startsWith(selectedDate);
    });
    
    if (dayData.length === 0) return;
    
    const hours = dayData.map(row => row.split(';')[1].split(' ')[1].substring(0,5));
    const tensions = dayData.map(row => parseFloat(row.split(';')[4])); // Tension max
    
    // Lignes de seuil
    const minLine = {
        label: `Seuil min (${norms.min}V)`,
        data: Array(hours.length).fill(norms.min),
        borderColor: '#f44336',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    const maxLine = {
        label: `Seuil max (${norms.max}V)`,
        data: Array(hours.length).fill(norms.max),
        borderColor: '#ff9800',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    // Ligne idéale (milieu de la plage)
    const idealValue = (norms.min + norms.max) / 2;
    const idealLine = {
        label: `Plage idéale (${norms.ideal}V)`,
        data: Array(hours.length).fill(idealValue),
        borderColor: '#4CAF50',
        borderWidth: 1,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
        tension: 0
    };
    
    const chartConfig = {
        type: 'line',
        data: {
            labels: hours,
            datasets: [
                {
                    label: `Tension (V) - ${selectedDate}`,
                    data: tensions,
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: tensions.map(t => {
                        if (t > norms.max) return '#f44336';      // Surtension
                        if (t < norms.min) return '#f44336';      // Sous-tension
                        if (t >= norms.min && t <= norms.max) return '#4CAF50'; // OK
                        return '#ff9800';
                    }),
                    pointRadius: 5,
                    pointHoverRadius: 8
                },
                minLine,
                maxLine,
                idealLine
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: true,
                    labels: { color: '#aaa' }
                },
                tooltip: {
                    backgroundColor: '#1e2a3a',
                    titleColor: '#ff9800',
                    bodyColor: '#aaa',
                    borderColor: '#d4a373',
                    borderWidth: 1,
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.dataset.label.includes('Seuil')) {
                                return `${ctx.dataset.label}: ${ctx.parsed.y}V`;
                            }
                            if (ctx.dataset.label.includes('Plage')) {
                                return `${ctx.dataset.label}`;
                            }
                            
                            let text = `${ctx.parsed.y}V`;
                            if (ctx.parsed.y > norms.max) text += ' 🔴 Surtension';
                            else if (ctx.parsed.y < norms.min) text += ' 🔴 Sous-tension';
                            else text += ' ✅ Normal';
                            return text;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    grid: { color: '#2a3a4a' }, 
                    ticks: { color: '#aaa' },
                    title: {
                        display: true,
                        text: 'Tension (V)',
                        color: '#aaa'
                    },
                    min: Math.min(norms.min - 1, ...tensions) - 1,
                    max: Math.max(norms.max + 1, ...tensions) + 1
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#aaa', maxRotation: 45 }
                }
            }
        }
    };
    
    chartManager.create('hourlyTensionChart', chartConfig);
}

// ===========================================
// RENDER ENERGY TABLE (manquante)
// ===========================================
function renderEnergyTable() {
    const container = document.getElementById('energyTable');
    if (!container) return;
    
    const energyData = database.energyData?.parDate || {};
    const dates = Object.keys(energyData).sort().slice(-10);
    
    let html = '<h3 class="card-title">📋 DÉTAIL ÉNERGIE (10 derniers jours)</h3>';
    html += '<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Énergie totale (Wh)</th></tr></thead><tbody>';
    
    dates.forEach(date => {
        const total = energyData[date]?.total || 0;
        html += `<tr><td>${date}</td><td>${total.toFixed(2)}</td></tr>`;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

