// dashboards/technical/TechnicalDashboard.js
import { database } from '../../arduinoCore.js';
import { VOLTAGE_NORMS, KitDefinitions } from '../../arduinoConstants.js';
import { getEnergyStats, parseIntensiteForTable, parseTensionForTable, alignData } from '../../analytics/energyAnalytics.js';
import { getCurrentFilter } from '../../arduinoMain.js';

// ===========================================
// STYLE UNIFIÉ POUR TOUS LES GRAPHIQUES
// ===========================================

const CHART_STYLE = {
    colors: {
        primary: '#3b82f6',
        secondary: '#f59e0b',
        min: '#64748b',
        max: '#ef4444',
        avg: '#10b981',
        threshold: '#94a3b8',
        reference: '#6b7280',
        excellent: '#22c55e',
        bon: '#eab308',
        mauvais: '#f97316',
        critique: '#ef4444'
    },
    
    fonts: {
        family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        size: 11,
        weight: 400
    },
    
    grid: {
        color: '#e9ecef',
        borderDash: [3, 3],
        drawBorder: false
    },
    
    tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#f8fafc',
        titleFont: { size: 12, weight: 600 },
        bodyColor: '#cbd5e1',
        bodyFont: { size: 11 },
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        boxPadding: 4
    },
    
    legend: {
        labels: {
            font: { size: 11 },
            usePointStyle: true,
            boxWidth: 8,
            pointStyle: 'circle'
        },
        position: 'top',
        align: 'center'
    }
};

// ===========================================
// MANAGER DE GRAPHIQUES
// ===========================================

const chartManager = {
    instances: {},
    create: function(canvasId, config) {
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
            delete this.instances[canvasId];
        }
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        this.instances[canvasId] = new Chart(canvas, config);
        return this.instances[canvasId];
    },
    destroy: function(canvasId) {
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
            delete this.instances[canvasId];
        }
    },
    destroyAll: function() {
        Object.keys(this.instances).forEach(id => this.destroy(id));
    }
};

// ===========================================
// renderTechnicalDashboard
// ===========================================

export function renderTechnicalDashboard() {
    const container = document.getElementById('technicalDashboard');
    if (!container) return;

    if (document.querySelector('.tab.active')?.dataset.tab !== 'Technique') {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `        
        ${renderFilterPanel()}
        
        <div class="section-title"><h2>🔧 DONNÉES TECHNIQUES</h2></div>
        <div id="infoCard" class="card"></div>

        <div class="section-title"><h2>📊 ANALYSE GÉNÉRALE DE LA TENSION</h2></div>
        <div id="conformityContainer" class="card"></div>
        <div id="normsCard" class="card"></div>
        <div id="loadSheddingBoard" class="card"></div>
        <div id="highVoltageBoard" class="card"></div>
        <div id="dailyChartCard" class="card"></div>
        <div id="hourlyChartCard" class="card"></div>

        <div class="section-title"><h2>⚡ ANALYSE ÉNERGIE</h2></div>
        <div id="clientConsumptionBoard" class="card"></div>
        <div id="energyCycleBoard" class="card"></div>
    `;
    
    renderInfoCard();
    renderConformityCard();
    renderNormsCard();
    renderLoadSheddingBoard();
    renderHighVoltageBoard();
    renderDailyChart();
    renderHourlyChart();
    renderClientConsumptionBoard();
    renderDailyEnergyCycle();
    
    setTimeout(() => {
        if (window.refreshFilterUI) window.refreshFilterUI();
    }, 150);
}

// ===========================================
// FONCTIONS UTILITAIRES
// ===========================================

function createDetailButton(targetId, label = "Voir détails") {
    const buttonId = `btn-${targetId}-${Date.now()}`;
    
    setTimeout(() => {
        const btn = document.getElementById(buttonId);
        const target = document.getElementById(targetId);
        if (btn && target) {
            btn.addEventListener('click', () => {
                if (target.style.display === 'none' || target.style.display === '') {
                    target.style.display = 'block';
                    btn.textContent = 'Masquer détails';
                } else {
                    target.style.display = 'none';
                    btn.textContent = label;
                }
            });
        }
    }, 100);
    
    return `<button id="${buttonId}" class="detail-btn">${label}</button>`;
}

// ===========================================
// FILTRE
// ===========================================

function getAvailableDates() {
    const dates = new Set();
    const tensionTable = database.tables?.find(t => t.type === 'T');
    if (tensionTable) {
        tensionTable.data.forEach(row => {
            const timestamp = row.split(';')[1];
            if (timestamp) {
                const date = timestamp.split(' ')[0];
                dates.add(date);
            }
        });
    }
    return Array.from(dates).sort();
}

function getAvailableYears() {
    const years = new Set();
    getAvailableDates().forEach(date => {
        years.add(new Date(date).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
}

function hasActiveFilter(filter) {
    return filter.period !== 'all' || 
           filter.startDate || 
           filter.endDate || 
           filter.month || 
           filter.year;
}

function getFilterSummaryText(filter) {
    if (filter.startDate && filter.endDate) {
        const start = new Date(filter.startDate).toLocaleDateString('fr-FR');
        const end = new Date(filter.endDate).toLocaleDateString('fr-FR');
        return `📅 Du ${start} au ${end}`;
    }
    if (filter.month && filter.year) {
        const monthName = new Date(2000, filter.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });
        return `📅 ${monthName} ${filter.year}`;
    }
    if (filter.year) {
        return `📅 Année ${filter.year}`;
    }
    if (filter.period && filter.period !== 'all') {
        const periodMap = {
            '7days': '7 derniers jours',
            '15days': '15 derniers jours',
            '30days': '30 derniers jours',
            '2months': '2 derniers mois',
            '3months': '3 derniers mois',
            '6months': '6 derniers mois',
            '1year': '1 dernière année'
        };
        return `📅 ${periodMap[filter.period] || filter.period}`;
    }
    return '📊 Toutes les données';
}

function formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getLastDateFromData() {
    const dates = getAvailableDates();
    if (dates.length === 0) return new Date();
    return new Date(dates[dates.length - 1]);
}

export function renderFilterPanel() {
    const currentFilter = getCurrentFilter();
    const availableDates = getAvailableDates();
    const dateOptions = availableDates.map(date => {
        const formatted = new Date(date).toLocaleDateString('fr-FR');
        return `<option value="${date}" ${currentFilter.startDate && new Date(currentFilter.startDate).toDateString() === new Date(date).toDateString() ? 'selected' : ''}>${formatted}</option>`;
    }).join('');
    
    return `
        <div class="filter-panel">
            <div class="filter-header" onclick="window.toggleFilterPanel()">
                <span class="filter-icon">🔍</span>
                <span class="filter-title">Filtres</span>
                <span class="filter-badge" id="filterActiveBadge" style="display: ${hasActiveFilter(currentFilter) ? 'inline-block' : 'none'};">Actif</span>
                <span class="filter-toggle">▼</span>
            </div>
            
            <div class="filter-content" id="filterContent">
                <div class="filter-row">
                    <div class="filter-label">Période rapide</div>
                    <div class="filter-options">
                        <button class="filter-btn ${currentFilter.period === '7days' ? 'active' : ''}" data-period="7days" onclick="window.applyFilterPeriod('7days')">7 jours</button>
                        <button class="filter-btn ${currentFilter.period === '15days' ? 'active' : ''}" data-period="15days" onclick="window.applyFilterPeriod('15days')">15 jours</button>
                        <button class="filter-btn ${currentFilter.period === '30days' ? 'active' : ''}" data-period="30days" onclick="window.applyFilterPeriod('30days')">30 jours</button>
                        <button class="filter-btn ${currentFilter.period === '2months' ? 'active' : ''}" data-period="2months" onclick="window.applyFilterPeriod('2months')">2 mois</button>
                        <button class="filter-btn ${currentFilter.period === '3months' ? 'active' : ''}" data-period="3months" onclick="window.applyFilterPeriod('3months')">3 mois</button>
                        <button class="filter-btn ${currentFilter.period === '6months' ? 'active' : ''}" data-period="6months" onclick="window.applyFilterPeriod('6months')">6 mois</button>
                        <button class="filter-btn ${currentFilter.period === '1year' ? 'active' : ''}" data-period="1year" onclick="window.applyFilterPeriod('1year')">1 an</button>
                        <button class="filter-btn ${currentFilter.period === 'all' ? 'active' : ''}" data-period="all" onclick="window.applyFilterPeriod('all')">Tout</button>
                    </div>
                </div>
                
                <div class="filter-row">
                    <div class="filter-label">Mois spécifique</div>
                    <div class="filter-options">
                        <select class="filter-select" id="filterMonthSelect">
                            <option value="">-- Mois --</option>
                            ${Array.from({length: 12}, (_, i) => {
                                const monthNum = i + 1;
                                const monthName = new Date(2000, i, 1).toLocaleDateString('fr-FR', { month: 'long' });
                                return `<option value="${monthNum}" ${currentFilter.month === monthNum ? 'selected' : ''}>${monthName}</option>`;
                            }).join('')}
                        </select>
                        <select class="filter-select" id="filterYearSelect">
                            <option value="">-- Année --</option>
                            ${getAvailableYears().map(year => `<option value="${year}" ${currentFilter.year === year ? 'selected' : ''}>${year}</option>`).join('')}
                        </select>
                        <button class="filter-btn filter-btn-primary" onclick="window.applyFilterMonthYear()">Appliquer</button>
                    </div>
                </div>
                
                <div class="filter-row">
                    <div class="filter-label">Dates personnalisées</div>
                    <div class="filter-options">
                        <div class="filter-date-group">
                            <span>Du</span>
                            <select class="filter-date-select" id="filterStartDateSelect">
                                <option value="">-- Sélectionner --</option>
                                ${dateOptions}
                            </select>
                        </div>
                        <div class="filter-date-group">
                            <span>Au</span>
                            <select class="filter-date-select" id="filterEndDateSelect">
                                <option value="">-- Sélectionner --</option>
                                ${dateOptions}
                            </select>
                        </div>
                        <button class="filter-btn filter-btn-primary" onclick="window.applyFilterCustomDates()">Appliquer</button>
                        <button class="filter-btn" onclick="window.clearFilter()">Réinitialiser</button>
                    </div>
                </div>
                
                <div class="filter-summary" id="filterSummary">
                    ${getFilterSummaryText(currentFilter)}
                </div>
            </div>
        </div>
    `;
}

// ===========================================
// FONCTIONS GLOBALES DU FILTRE
// ===========================================

window.applyFilterPeriod = function(period) {
    import('../../arduinoMain.js').then(module => {
        module.applyFilter({ period, startDate: null, endDate: null, month: null, year: null });
    });
};

window.applyFilterMonthYear = function() {
    const month = document.getElementById('filterMonthSelect')?.value;
    const year = document.getElementById('filterYearSelect')?.value;
    if (!month || !year) { alert('Veuillez sélectionner un mois et une année'); return; }
    import('../../arduinoMain.js').then(module => {
        module.applyFilter({ period: null, startDate: null, endDate: null, month: parseInt(month), year: parseInt(year) });
    });
};

window.applyFilterCustomDates = function() {
    const start = document.getElementById('filterStartDateSelect')?.value;
    const end = document.getElementById('filterEndDateSelect')?.value;
    if (!start && !end) { alert('Veuillez sélectionner au moins une date'); return; }
    if (start && end && new Date(start) > new Date(end)) { alert('La date de début doit être antérieure'); return; }
    import('../../arduinoMain.js').then(module => {
        module.applyFilter({ period: null, startDate: start ? new Date(start) : null, endDate: end ? new Date(end) : null, month: null, year: null });
    });
};

window.clearFilter = function() {
    import('../../arduinoMain.js').then(module => {
        module.applyFilter({ period: 'all', startDate: null, endDate: null, month: null, year: null });
    });
};

window.toggleFilterPanel = function() {
    const content = document.getElementById('filterContent');
    const toggle = document.querySelector('.filter-toggle');
    if (content && toggle) {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggle.textContent = '▼';
        } else {
            content.style.display = 'none';
            toggle.textContent = '▶';
        }
    }
};

export function refreshFilterUI() {
    setTimeout(() => {
        const filter = getCurrentFilter();
        document.querySelectorAll('.filter-btn[data-period]').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-period') === filter.period);
        });
        const monthSelect = document.getElementById('filterMonthSelect');
        const yearSelect = document.getElementById('filterYearSelect');
        if (monthSelect) monthSelect.value = filter.month || '';
        if (yearSelect) yearSelect.value = filter.year || '';
        
        const startSelect = document.getElementById('filterStartDateSelect');
        const endSelect = document.getElementById('filterEndDateSelect');
        if (startSelect && filter.startDate) startSelect.value = new Date(filter.startDate).toISOString().split('T')[0];
        else if (startSelect) startSelect.value = '';
        if (endSelect && filter.endDate) endSelect.value = new Date(filter.endDate).toISOString().split('T')[0];
        else if (endSelect) endSelect.value = '';
        
        const summary = document.getElementById('filterSummary');
        if (summary) summary.innerHTML = getFilterSummaryText(filter);
        
        const badge = document.getElementById('filterActiveBadge');
        if (badge) badge.style.display = hasActiveFilter(filter) ? 'inline-block' : 'none';
    }, 100);
}

window.refreshFilterUI = refreshFilterUI;

// ===========================================
// I) INFO CARD
// ===========================================

function renderInfoCard() {
    const container = document.getElementById('infoCard');
    if (!container) return;
    
    const data = database.technicalData;
    if (!data) {
        container.innerHTML = '<p class="no-data">Aucune donnée technique</p>';
        return;
    }
    
    let maxEnergy = 0, maxEnergyDate = '—', avgEnergy = 0;
    const energyData = database.energyData?.parDate || {};
    const entries = Object.entries(energyData);
    
    if (entries.length > 0) {
        let maxEntry = entries[0];
        entries.forEach(([date, d]) => { if (d.total > maxEntry[1].total) maxEntry = [date, d]; });
        maxEnergy = maxEntry[1].total || 0;
        maxEnergyDate = maxEntry[0];
        avgEnergy = entries.reduce((sum, [_, d]) => sum + (d.total || 0), 0) / entries.length;
    }
    
    const chartData = database.technicalData?.chartData;
    let actualDateRange = '—';
    if (chartData?.dates?.length) {
        actualDateRange = `${chartData.dates[0]} → ${chartData.dates[chartData.dates.length - 1]}`;
    }
    
    container.innerHTML = `
        <div class="info-grid" style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between;">
            <div class="info-item" style="flex: 1; min-width: 120px;">
                <span class="info-label">📅 Période</span>
                <span class="info-value">${data.daysCount || 0} j</span>
                <span class="info-sub">${actualDateRange}</span>
            </div>
            <div class="info-item" style="flex: 1; min-width: 80px;">
                <span class="info-label">👥 Clients</span>
                <span class="info-value">${data.clientCount || 0}</span>
            </div>
            <div class="info-item" style="flex: 1; min-width: 100px;">
                <span class="info-label">⚡ Tension moyenne</span>
                <span class="info-value">${data.globalAvg?.toFixed(1) || 0} V</span>
            </div>
            <div class="info-item" style="flex: 1; min-width: 90px;">
                <span class="info-label">⬇️ Tension minimale</span>
                <span class="info-value min">${data.globalMin?.toFixed(1) || 0} V</span>
            </div>
            <div class="info-item" style="flex: 1; min-width: 90px;">
                <span class="info-label">⬆️ Tension maximale</span>
                <span class="info-value max">${data.globalMax?.toFixed(1) || 0} V</span>
            </div>
            <div class="info-item" style="flex: 1; min-width: 140px; background: #fff3e0; border-radius: 8px; padding: 5px 10px;">
                <span class="info-label">⚡ Énergie maximale</span>
                <span class="info-value warning">${maxEnergy.toFixed(0)} Wh</span>
                <span class="info-sub" style="font-size: 0.7rem;">${maxEnergyDate}</span>
            </div>
            <div class="info-item" style="flex: 1; min-width: 100px;">
                <span class="info-label">📊 Énergie moyenne</span>
                <span class="info-value success">${avgEnergy.toFixed(0)} Wh</span>
                <span class="info-sub">/jour</span>
            </div>
        </div>
    `;
}

// ===========================================
// II-1) CONFORMITY CARD
// ===========================================

function renderConformityCard() {
    const container = document.getElementById('conformityContainer');
    if (!container) return;
    const data = database.technicalData?.conformity;
    if (!data) {
        container.innerHTML = '<p class="no-data">Données de conformité non disponibles</p>';
        return;
    }

    const normSystem = database.technicalData?.normSystem || '12V';
    const norms = VOLTAGE_NORMS[normSystem];
    const nonConformes = data.totalJours - data.conformes;
    const pourcentageNonConforme = (100 - parseFloat(data.pourcentage)).toFixed(1);
    const percentClass = data.pourcentage >= 80 ? 'color-success' : 'color-warning';

    const chartData = database.technicalData?.chartData;
    const tensionValues = {};
    if (chartData?.dates) {
        chartData.dates.forEach((date, idx) => {
            tensionValues[date] = { min: chartData.mins[idx], max: chartData.maxs[idx], avg: chartData.avgs[idx] };
        });
    }

    const generateDetailsTable = (days, type) => {
        if (!days?.length) return '<p>Aucune donnée</p>';
        const rows = days.map(date => {
            const values = tensionValues[date] || { min: 'N/A', max: 'N/A', avg: 'N/A' };
            const valeur = type === 'max' ? values.max : (type === 'min' ? values.min : values.avg);
            return `<tr><td>${date}</td><td>${valeur} V</td></tr>`;
        }).join('');
        return `<table style="width:100%; border-collapse:collapse; font-size:12px;"><thead><tr><th>Date</th><th>Valeur (V)</th></tr></thead><tbody>${rows}</tbody></table>`;
    };

    container.innerHTML = `
        <h3 class="card-title">📊 CONFORMITÉ</h3>
        <div class="grid-2 gap-15 mb-20">
            <div class="stat-card text-center">
                <div class="stat-label">✅ Jours conformes</div>
                <div class="stat-value ${percentClass}">${data.pourcentage}%</div>
                <div class="stat-detail">${data.conformes}/${data.totalJours} jours</div>
                <div class="stat-norm">Seuils: ${norms.min}V - ${norms.max}V</div>
            </div>
            <div class="stat-card text-center">
                <div class="stat-label">⚠️ Jours non conformes</div>
                <div class="stat-value color-danger">${pourcentageNonConforme}%</div>
                <div class="stat-detail">${nonConformes}/${data.totalJours} jours</div>
                <div class="stat-norm">Hors limites</div>
            </div>
        </div>
        <div class="mt-20">
            <div class="grid-3 gap-15">
                <div class="cause-card">
                    <div class="cause-header"><span class="cause-icon">⬆️</span><span class="cause-label">Surtension (>${norms.max}V)</span><span class="cause-count">${data.causes.max.length} jours</span></div>
                    ${createDetailButton('surtension-details', 'Voir détails')}
                    <div id="surtension-details" style="display:none; margin-top:10px;">${generateDetailsTable(data.causes.max, 'max')}</div>
                </div>
                <div class="cause-card">
                    <div class="cause-header"><span class="cause-icon">⬇️</span><span class="cause-label">Sous-tension (<${norms.min}V)</span><span class="cause-count">${data.causes.min.length} jours</span></div>
                    ${createDetailButton('soustension-details', 'Voir détails')}
                    <div id="soustension-details" style="display:none; margin-top:10px;">${generateDetailsTable(data.causes.min, 'min')}</div>
                </div>
                <div class="cause-card">
                    <div class="cause-header"><span class="cause-icon">⚡</span><span class="cause-label">Variation (>${norms.variationSeuil}V/h)</span><span class="cause-count">${data.causes.variation.length} jours</span></div>
                    ${createDetailButton('variation-details', 'Voir détails')}
                    <div id="variation-details" style="display:none; margin-top:10px;">${generateDetailsTable(data.causes.variation, 'avg')}</div>
                </div>
            </div>
        </div>
    `;
}

// ===========================================
// II-2) NORMS CARD
// ===========================================

function renderNormsCard() {
    const container = document.getElementById('normsCard');
    if (!container) return;
    const data = database.technicalData;
    let normData = null, normSystem = '';
    if (data.globalAvg >= 22 && data.globalAvg <= 29) { normSystem = '24V'; normData = VOLTAGE_NORMS['24V']; }
    else if (data.globalAvg >= 11 && data.globalAvg <= 15) { normSystem = '12V'; normData = VOLTAGE_NORMS['12V']; }
    if (!normData) { container.innerHTML = '<h3 class="card-title">🔋 Normes système</h3><p>Non déterminé</p>'; return; }
    container.innerHTML = `
        <h3 class="card-title">🔋 Normes Système ${normSystem}</h3>
        <div class="norms-grid">
            <div class="norm-item"><span class="norm-label">Tension minimale</span><span class="norm-value">${normData.min}V</span></div>
            <div class="norm-item"><span class="norm-label">Plage idéale</span><span class="norm-value norm-range">${normData.ideal}V</span></div>
            <div class="norm-item"><span class="norm-label">Tension maximale</span><span class="norm-value">${normData.max}V</span></div>
            <div class="norm-item"><span class="norm-label">Seuil d'alerte</span><span class="norm-value alert-threshold">${normData.alert}</span></div>
        </div>
    `;
}

// ===========================================
// II-4) LOAD SHEDDING BOARD
// ===========================================

function renderLoadSheddingBoard() {
    const container = document.getElementById('loadSheddingBoard');
    if (!container) return;
    
    const data = database.technicalData?.loadShedding || { partiel: 0, total: 0, jours: [] };
    const totalJours = database.technicalData?.daysCount || 1;
    
    const joursAvecDelestage = data.jours.length;
    const totalEvenements = data.partiel + data.total;
    
    // ✅ SI AUCUN DÉLESTAGE DÉTECTÉ
    if (totalEvenements === 0 && joursAvecDelestage === 0) {
        container.innerHTML = `
            <div class="card load-shedding-card" style="border-left: 4px solid #4caf50;">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 class="card-title" style="margin: 0;">
                        ⚡ ANALYSE DES DÉLESTAGES
                    </h3>
                </div>
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">✅</div>
                    <div style="font-size: 1.2rem; font-weight: 600; color: #4caf50;">Pas de délestage détecté</div>
                    <div style="font-size: 0.9rem; color: #6c757d; margin-top: 8px;">Aucun événement de délestage sur la période analysée</div>
                </div>
            </div>
        `;
        return;
    }
    
    // ===== SI DES DÉLESTAGES EXISTENT, AFFICHAGE NORMAL =====
    
    const pourcentageJours = ((joursAvecDelestage / totalJours) * 100).toFixed(1);
    const moyenneParJour = joursAvecDelestage > 0 ? (totalEvenements / joursAvecDelestage).toFixed(1) : 0;
    
    const partielPercent = totalEvenements > 0 ? (data.partiel / totalEvenements) * 100 : 0;
    const totalPercent = totalEvenements > 0 ? (data.total / totalEvenements) * 100 : 0;
    
    // ✅ PLUS D'INDICATEUR "NORMAL" OU "DANGER" EN HAUT
    const joursTries = [...data.jours].sort((a, b) => new Date(b) - new Date(a));
    
    const groupHeures = (heures) => {
        const compteur = {};
        heures.forEach(h => {
            compteur[h] = (compteur[h] || 0) + 1;
        });
        return Object.entries(compteur)
            .map(([heure, count]) => count > 1 ? `${heure} (x${count})` : heure)
            .join(' · ');
    };
    
    const generateDetailsRows = () => {
        return joursTries.map(date => {
            const jourData = data.parDate?.[date] || { partiel: 0, total: 0, evenements: [] };
            const partielJour = jourData.partiel || 0;
            const totalJour = jourData.total || 0;
            const totalEvJour = partielJour + totalJour;
            
            const heures = jourData.evenements?.map(e => {
                const [hour, minute] = e.time.split(':');
                return `${hour}h${minute}`;
            }) || [];
            
            heures.sort();
            const heuresTexte = heures.length > 0 ? groupHeures(heures) : '—';
            
            return `
                <tr>
                    <td style="padding: 0.75rem 1rem;">${date}</td>
                    <td style="padding: 0.75rem 1rem; text-align: center;">${partielJour}</td>
                    <td style="padding: 0.75rem 1rem; text-align: center;">${totalJour}</td>
                    <td style="padding: 0.75rem 1rem; text-align: center;">${totalEvJour}</td>
                    <td style="padding: 0.75rem 1rem;">${heuresTexte}</td>
                </tr>
            `;
        }).join('');
    };
    
    container.innerHTML = `
        <div class="card load-shedding-card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 class="card-title" style="margin: 0;">
                    ⚡ ANALYSE DES DÉLESTAGES
                </h3>
            </div>
            
            <div class="global-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="stat-box" style="background: #f8f9fa; padding: 1rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 0.8rem; color: #6c757d;">Jours touchés</div>
                    <div style="font-size: 2rem; font-weight: 700; color: #f97316;">${joursAvecDelestage}</div>
                    <div style="font-size: 0.8rem; color: #6c757d;">sur ${totalJours} jours</div>
                </div>
                
                <div class="stat-box" style="background: #f8f9fa; padding: 1rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 0.8rem; color: #6c757d;">Total événements</div>
                    <div style="font-size: 2rem; font-weight: 700; color: #f97316;">${totalEvenements}</div>
                    <div style="font-size: 0.8rem; color: #6c757d;">Ø ${moyenneParJour}/jour</div>
                </div>
                
                <div class="stat-box" style="background: #f8f9fa; padding: 1rem; border-radius: 12px; text-align: center;">
                    <div style="font-size: 0.8rem; color: #6c757d;">Proportion</div>
                    <div style="font-size: 2rem; font-weight: 700; color: #f97316;">${pourcentageJours}%</div>
                    <div style="font-size: 0.8rem; color: #6c757d;">des jours analysés</div>
                </div>
            </div>
            
            <div style="margin-bottom: 2rem;">
                <h4 style="margin-bottom: 1rem; color: #1e293b; font-size: 1rem;">🔸 Répartition partielle vs totale</h4>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="width: 12px; height: 12px; background: #ff9800; border-radius: 3px; display: inline-block;"></span>
                        <span style="font-weight: 500;">Délestages partiels</span>
                    </div>
                    <div>
                        <span style="font-weight: 600;">${data.partiel}</span>
                        <span style="color: #6c757d; margin-left: 0.5rem;">(${partielPercent.toFixed(1)}%)</span>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="width: 12px; height: 12px; background: #f44336; border-radius: 3px; display: inline-block;"></span>
                        <span style="font-weight: 500;">Délestages totaux</span>
                    </div>
                    <div>
                        <span style="font-weight: 600;">${data.total}</span>
                        <span style="color: #6c757d; margin-left: 0.5rem;">(${totalPercent.toFixed(1)}%)</span>
                    </div>
                </div>
                
                <div style="margin: 1.5rem 0;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.9rem; color: #6c757d;">Partiel</span>
                        <div style="flex: 1; height: 30px; background: #f0f0f0; border-radius: 100px; overflow: hidden; display: flex;">
                            <div style="width: ${partielPercent}%; height: 100%; background: linear-gradient(90deg, #ffb74d, #ff9800); display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; color: white; font-size: 0.8rem; font-weight: 600;">
                                ${partielPercent > 8 ? partielPercent.toFixed(0) + '%' : ''}
                            </div>
                            <div style="width: ${totalPercent}%; height: 100%; background: linear-gradient(90deg, #f44336, #d32f2f); display: flex; align-items: center; padding-left: 10px; color: white; font-size: 0.8rem; font-weight: 600;">
                                ${totalPercent > 8 ? totalPercent.toFixed(0) + '%' : ''}
                            </div>
                        </div>
                        <span style="font-size: 0.9rem; color: #6c757d;">Total</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-top: 0.25rem;">
                        <span style="font-size: 0.8rem; color: #ff9800;">${data.partiel} événements partiels</span>
                        <span style="font-size: 0.8rem; color: #f44336;">${data.total} événements totaux</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <span style="background: #f8f9fa; color: #f97316; padding: 0.25rem 0.75rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600;">
                        ${joursAvecDelestage} jour(s) touché(s)
                    </span>
                </div>
                
                ${createDetailButton('loadshedding-details', 'Afficher le tableau détaillé')}
                
                <div id="loadshedding-details" style="display:none; margin-top:15px;">
                    <div style="max-height: 400px; overflow-y: auto; border-radius: 12px; border: 1px solid #e9ecef;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 1;">
                                <tr>
                                    <th style="padding: 0.75rem 1rem; text-align: left;">Date</th>
                                    <th style="padding: 0.75rem 1rem; text-align: center;">Partiels</th>
                                    <th style="padding: 0.75rem 1rem; text-align: center;">Totaux</th>
                                    <th style="padding: 0.75rem 1rem; text-align: center;">Fréquence</th>
                                    <th style="padding: 0.75rem 1rem; text-align: left;">Heures</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateDetailsRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ===========================================
// II-5) HIGH VOLTAGE BOARD
// ===========================================

function renderHighVoltageBoard() {
    const container = document.getElementById('highVoltageBoard');
    if (!container) return;
    const data = database.technicalData;
    if (!data) return;

    const normSystem = data.normSystem || '12V';
    const seuil = normSystem === '24V' ? 28 : 14;
    const hvData = data.highVoltage || [];
    const totalJours = hvData.length || 1;

    const stats = { excellent: 0, bon: 0, mauvais: 0, critique: 0 };
    hvData.forEach(d => stats[d.qualite]++);

    const pourcentages = {
        excellent: ((stats.excellent / totalJours) * 100).toFixed(1),
        bon: ((stats.bon / totalJours) * 100).toFixed(1),
        mauvais: ((stats.mauvais / totalJours) * 100).toFixed(1),
        critique: ((stats.critique / totalJours) * 100).toFixed(1)
    };

    // ✅ Récupérer les données horaires pour trouver l'heure du pic
    const table = database.tables?.find(t => t.type === 'T');
    const hourlyData = {};
    
    if (table) {
        table.data.forEach(row => {
            const cells = row.split(';');
            const timestamp = cells[1];
            const tension = parseFloat(cells[4]);
            if (timestamp && !isNaN(tension)) {
                const date = timestamp.split(' ')[0];
                const hour = timestamp.split(' ')[1]?.substring(0, 5);
                if (!hourlyData[date]) hourlyData[date] = { maxTension: 0, hourAtMax: '—' };
                if (tension > hourlyData[date].maxTension) {
                    hourlyData[date].maxTension = tension;
                    hourlyData[date].hourAtMax = hour;
                }
            }
        });
    }

    // ✅ Générer le tableau de détails avec heure du pic
    const generateDetailsRows = () => {
        return hvData.map(d => {
            const heurePic = hourlyData[d.date]?.hourAtMax || '—';
            return `
                <tr>
                    <td style="padding: 10px;">${d.date}</td>
                    <td style="padding: 10px; text-align: center;">${d.count}</td>
                    <td style="padding: 10px; text-align: center;">${heurePic}</td>
                </tr>
            `;
        }).join('');
    };

    container.innerHTML = `
        <h3 class="card-title">🔋 TENSION HAUTE (≥${seuil}V)</h3>
        
        <div class="stats-grid-4">
            <div class="stat-card excellent">
                <div class="stat-value">${stats.excellent}</div>
                <div class="stat-label">EXCELLENT</div>
                <div class="stat-sub">${pourcentages.excellent}% des jours</div>
                <div class="stat-detail">≥4x/jour</div>
            </div>
            <div class="stat-card bon">
                <div class="stat-value">${stats.bon}</div>
                <div class="stat-label">BON</div>
                <div class="stat-sub">${pourcentages.bon}% des jours</div>
                <div class="stat-detail">2-3x/jour</div>
            </div>
            <div class="stat-card mauvais">
                <div class="stat-value">${stats.mauvais}</div>
                <div class="stat-label">MAUVAIS</div>
                <div class="stat-sub">${pourcentages.mauvais}% des jours</div>
                <div class="stat-detail">1x/jour</div>
            </div>
            <div class="stat-card critique">
                <div class="stat-value">${stats.critique}</div>
                <div class="stat-label">CRITIQUE</div>
                <div class="stat-sub">${pourcentages.critique}% des jours</div>
                <div class="stat-detail">0x/jour</div>
            </div>
        </div>

        ${createDetailButton('highvoltage-details', 'Voir le détail des jours')}
        
        <div id="highvoltage-details" style="display:none; margin:15px 0;">
            <div style="max-height:300px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead style="position:sticky; top:0; background:#f1f5f9;">
                        <tr>
                            <th style="padding:10px; text-align:left;">Date</th>
                            <th style="padding:10px; text-align:center;">Compteur</th>
                            <th style="padding:10px; text-align:center;">Heure du pic</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateDetailsRows()}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="chart-container">
            <div class="chart-header">
                <span>📊 Évolution sur ${totalJours} jours</span>
            </div>
            <div class="chart-wrapper">
                <canvas id="highVoltageChart"></canvas>
            </div>
        </div>
    `;

    chartManager.destroy('highVoltageChart');
    requestAnimationFrame(() => {
        createHighVoltageChart(hvData.map(d => d.date).sort(), hvData.map(d => d.count), seuil);
    });
}

function createHighVoltageChart(dates, counts, seuil) {
    const ctx = document.getElementById('highVoltageChart')?.getContext('2d');
    if (!ctx) return;
    requestAnimationFrame(() => {
        chartManager.create('highVoltageChart', {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Dépassements par jour',
                    data: counts,
                    borderColor: CHART_STYLE.colors.secondary,
                    backgroundColor: 'rgba(245, 158, 11, 0.05)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: counts.map(c => c >= 4 ? CHART_STYLE.colors.excellent : c >= 2 ? CHART_STYLE.colors.bon : c === 1 ? CHART_STYLE.colors.mauvais : CHART_STYLE.colors.critique),
                    fill: true
                }, {
                    label: 'Seuil excellent (4x/jour)',
                    data: Array(dates.length).fill(4),
                    borderColor: CHART_STYLE.colors.reference,
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: CHART_STYLE.legend, tooltip: CHART_STYLE.tooltip },
                scales: { y: { beginAtZero: true, grid: CHART_STYLE.grid }, x: { grid: { display: false } } }
            }
        });
    });
}

// ===========================================
// II-6) DAILY CHART
// ===========================================

function renderDailyChart() {
    const container = document.getElementById('dailyChartCard');
    if (!container) return;
    const data = database.technicalData?.chartData;
    if (!data) { container.innerHTML = '<p class="no-data">Données insuffisantes</p>'; return; }
    container.innerHTML = `<h3 class="card-title">📈 ÉVOLUTION JOURNALIÈRE DES TENSIONS</h3><div style="height:300px"><canvas id="dailyTensionChart"></canvas></div>`;
    chartManager.destroy('dailyTensionChart');
    requestAnimationFrame(() => createDailyTensionChart(data));
}

function createDailyTensionChart(data) {
    const ctx = document.getElementById('dailyTensionChart')?.getContext('2d');
    if (!ctx) return;
    const norms = VOLTAGE_NORMS[database.technicalData?.normSystem || '12V'];
    requestAnimationFrame(() => {
        chartManager.create('dailyTensionChart', {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [
                    { label: 'Tension minimale', data: data.mins, borderColor: CHART_STYLE.colors.min, borderWidth: 1.5, pointRadius: 3, tension: 0.2 },
                    { label: 'Tension maximale', data: data.maxs, borderColor: CHART_STYLE.colors.max, borderWidth: 1.5, pointRadius: 3, tension: 0.2 },
                    { label: 'Tension moyenne', data: data.avgs, borderColor: CHART_STYLE.colors.avg, borderWidth: 2, pointRadius: 0, tension: 0.2 },
                    { label: 'Seuil minimal', data: Array(data.dates.length).fill(norms.min), borderColor: CHART_STYLE.colors.threshold, borderWidth: 1, borderDash: [4, 4], pointRadius: 0 },
                    { label: 'Seuil maximal', data: Array(data.dates.length).fill(norms.max), borderColor: CHART_STYLE.colors.threshold, borderWidth: 1, borderDash: [4, 4], pointRadius: 0 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: CHART_STYLE.legend, tooltip: CHART_STYLE.tooltip },
                scales: { y: { grid: CHART_STYLE.grid }, x: { grid: { display: false } } }
            }
        });
    });
}

// ===========================================
// II-7) HOURLY CHART
// ===========================================

let chartStartIndex = 0, chartEndIndex = 0, allDates = [], allTensionData = [];

function renderHourlyChart(selectedDate = null) {
    const container = document.getElementById('hourlyChartCard');
    if (!container) return;
    
    const table = database.tables?.find(t => t.type === 'T');
    if (!table) { 
        container.innerHTML = '<p class="no-data">Données horaires indisponibles</p>'; 
        return; 
    }
    
    // Initialisation des données si vide
    if (allDates.length === 0) {
        const dateMap = new Map();
        table.data.forEach(row => {
            const cells = row.split(';');
            const datetime = cells[1];
            const date = datetime.split(' ')[0];
            if (!dateMap.has(date)) dateMap.set(date, []);
            dateMap.get(date).push({
                hour: datetime.split(' ')[1].substring(0, 5),
                hourNum: parseInt(datetime.split(' ')[1].substring(0, 2)),
                tension: parseFloat(cells[4])
            });
        });
        allDates = Array.from(dateMap.keys()).sort();
        allTensionData = allDates.map(date => dateMap.get(date));
    }
    
    if (allDates.length === 0) { 
        container.innerHTML = '<p class="no-data">Aucune donnée</p>'; 
        return; 
    }
    
    // Gestion de la sélection initiale
    if (selectedDate) {
        const idx = allDates.indexOf(selectedDate);
        if (idx !== -1) { 
            chartStartIndex = idx; 
            chartEndIndex = idx; 
        }
    } else if (chartEndIndex === 0) { 
        chartEndIndex = allDates.length - 1; 
        chartStartIndex = Math.max(0, chartEndIndex - 6); 
    }
    
    const norms = VOLTAGE_NORMS[database.technicalData?.normSystem || '12V'];
    const daysCount = chartEndIndex - chartStartIndex + 1;
    
    // Construction du HTML avec le même style que energy cycle
    container.innerHTML = `
        <div class="hourly-card" style="background:white; border-radius:24px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <div class="hourly-header" style="padding:20px 24px; border-bottom:1px solid #e9ecef;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap; gap:12px;">
                    <h3 style="margin:0; display: flex; align-items: center; gap: 8px; font-size:1.25rem;">
                        <span>⏱️</span>
                        TENSIONS HORAIRES
                    </h3>
                    <div class="range-badge" style="background:#e9ecef; padding:6px 14px; border-radius:40px; font-size:0.75rem; font-weight:500;">
                        ${daysCount} JOUR${daysCount > 1 ? 'S' : ''}
                    </div>
                </div>
                <div class="range-text" style="margin-top:8px; font-size:0.8rem; color:#6c757d;">
                    ${allDates[chartStartIndex]} → ${allDates[chartEndIndex]}
                </div>
            </div>
            
            <div class="hourly-filters" style="padding:20px 24px; background:#f8f9fa; border-bottom:1px solid #e9ecef;">
                <div style="display:flex; gap:16px; align-items: flex-end; flex-wrap: wrap;">
                    <div style="flex:1; min-width:180px;">
                        <label style="display:block; font-size:0.7rem; font-weight:600; margin-bottom:6px;">📅 DATE DE DÉBUT</label>
                        <select id="startDateSelect" class="date-select" style="width:100%; padding:10px 14px; border:2px solid #dee2e6; border-radius:12px; background:white; font-size:0.85rem;">
                            ${allDates.map((d, i) => `<option value="${i}" ${i === chartStartIndex ? 'selected' : ''}>${d}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1; min-width:180px;">
                        <label style="display:block; font-size:0.7rem; font-weight:600; margin-bottom:6px;">📅 DATE DE FIN</label>
                        <select id="endDateSelect" class="date-select" style="width:100%; padding:10px 14px; border:2px solid #dee2e6; border-radius:12px; background:white; font-size:0.85rem;">
                            ${allDates.map((d, i) => `<option value="${i}" ${i === chartEndIndex ? 'selected' : ''}>${d}</option>`).join('')}
                        </select>
                    </div>
                    <button id="applyDateBtn" class="apply-btn" style="background:#3b82f6; color:white; border:none; padding:10px 28px; border-radius:12px; font-weight:600; cursor:pointer;">
                        APPLIQUER
                    </button>
                </div>
            </div>
            
            <div class="hourly-chart-section" style="padding:24px;">
                <div style="height:350px;">
                    <canvas id="hourlyTensionChart"></canvas>
                </div>
            </div>
        </div>
    `;
    
    // Attacher les événements
    attachDateSelectors();
    
    // Afficher le graphique
    updateHourlyChartData();
}

function attachDateSelectors() {
    const startSelect = document.getElementById('startDateSelect');
    const endSelect = document.getElementById('endDateSelect');
    const applyBtn = document.getElementById('applyDateBtn');
    
    if (!startSelect || !endSelect || !applyBtn) return;
    
    const updateEndOptions = () => {
        const startIdx = parseInt(startSelect.value);
        const maxEnd = Math.min(startIdx + 6, allDates.length - 1);
        
        const currentEndIdx = parseInt(endSelect.value);
        
        endSelect.innerHTML = '';
        for (let i = startIdx; i <= maxEnd; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = allDates[i];
            if (i === currentEndIdx && currentEndIdx >= startIdx && currentEndIdx <= maxEnd) {
                option.selected = true;
            }
            endSelect.appendChild(option);
        }
        
        if (parseInt(endSelect.value) < startIdx || parseInt(endSelect.value) > maxEnd) {
            endSelect.value = maxEnd;
        }
    };
    
    startSelect.addEventListener('change', updateEndOptions);
    updateEndOptions();
    
    applyBtn.addEventListener('click', () => {
        const newStart = parseInt(startSelect.value);
        const newEnd = parseInt(endSelect.value);
        
        if (newStart <= newEnd) {
            chartStartIndex = newStart;
            chartEndIndex = newEnd;
            
            // Mettre à jour l'en-tête
            const daysCount = chartEndIndex - chartStartIndex + 1;
            const header = document.querySelector('#hourlyChartCard .hourly-header');
            if (header) {
                const badge = header.querySelector('.range-badge');
                const rangeText = header.querySelector('.range-text');
                if (badge) badge.innerHTML = `${daysCount} JOUR${daysCount > 1 ? 'S' : ''}`;
                if (rangeText) rangeText.innerHTML = `${allDates[chartStartIndex]} → ${allDates[chartEndIndex]}`;
            }
            
            updateHourlyChartData();
        }
    });
}

function updateHourlyChartData() {
    const labels = [];
    const tensions = [];
    const dayInfo = [];
    
    // Construire les données pour la plage sélectionnée
    for (let i = chartStartIndex; i <= chartEndIndex; i++) {
        const dayPoints = allTensionData[i];
        dayPoints.forEach(point => {
            labels.push(`${allDates[i]} ${point.hour}`);
            tensions.push(point.tension);
            dayInfo.push({ date: allDates[i], hour: point.hour, dayIndex: i });
        });
    }
    
    const norms = VOLTAGE_NORMS[database.technicalData?.normSystem || '12V'];
    
    // Plugin pour colorer le fond des jours
    const dayBackgroundPlugin = {
        id: 'dayBackground',
        beforeDatasetsDraw(chart) {
            const { ctx, chartArea, scales, data } = chart;
            if (!scales.x || !data.labels.length) return;
            
            const labels = data.labels;
            let currentDay = '';
            let dayStartIndex = 0;
            const daySegments = [];
            
            // Détecter les changements de jour
            labels.forEach((label, idx) => {
                const dayKey = label.split(' ')[0];
                if (currentDay === '') {
                    currentDay = dayKey;
                    dayStartIndex = idx;
                } else if (dayKey !== currentDay) {
                    const startX = scales.x.getPixelForValue(dayStartIndex);
                    const endX = scales.x.getPixelForValue(idx - 0.5);
                    daySegments.push({ day: currentDay, startX, endX });
                    currentDay = dayKey;
                    dayStartIndex = idx;
                }
            });
            
            // Dernier jour
            if (currentDay) {
                const startX = scales.x.getPixelForValue(dayStartIndex);
                const endX = chartArea.right;
                daySegments.push({ day: currentDay, startX, endX });
            }
            
            // Dessiner les fonds colorés
            ctx.save();
            daySegments.forEach((segment, i) => {
                const dayNum = parseInt(segment.day.split('-')[2]) || i;
                const isEven = dayNum % 2 === 0;
                ctx.fillStyle = isEven ? '#fef7e0' : '#ffffff';
                ctx.fillRect(
                    Math.max(chartArea.left, segment.startX),
                    chartArea.top,
                    Math.min(segment.endX, chartArea.right) - Math.max(chartArea.left, segment.startX),
                    chartArea.bottom - chartArea.top
                );
            });
            
            // Lignes de séparation verticales
            ctx.beginPath();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 6]);
            daySegments.forEach((segment, i) => {
                if (i > 0 && segment.startX > chartArea.left && segment.startX < chartArea.right) {
                    ctx.beginPath();
                    ctx.moveTo(segment.startX, chartArea.top);
                    ctx.lineTo(segment.startX, chartArea.bottom);
                    ctx.stroke();
                }
            });
            ctx.restore();
        }
    };
    
    // Calculer la marge automatique
    const minTension = Math.min(...tensions);
    const maxTension = Math.max(...tensions);
    const padding = (maxTension - minTension) * 0.1; // 10% de marge
    
    const config = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Tension',
                    data: tensions,
                    borderColor: '#3b82f6',
                    borderWidth: 2.5,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#3b82f6',
                    tension: 0.2,
                    fill: false
                },
                {
                    label: 'Seuil minimal',
                    data: Array(labels.length).fill(norms.min),
                    borderColor: '#94a3b8',
                    borderWidth: 1.5,
                    borderDash: [6, 6],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Seuil maximal',
                    data: Array(labels.length).fill(norms.max),
                    borderColor: '#94a3b8',
                    borderWidth: 1.5,
                    borderDash: [6, 6],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const idx = items[0].dataIndex;
                            if (dayInfo[idx]) {
                                return `${dayInfo[idx].date} ${dayInfo[idx].hour}`;
                            }
                            return labels[idx];
                        }
                    }
                },
                legend: {
                    display: false  // Supprimer la légende pour plus d'espace
                }
            },
            scales: {
                y: {
                    // ✅ Supprimer min/max fixes, laisser Chart.js calculer automatiquement
                    // Optionnel : ajouter une petite marge pour mieux voir
                    suggestedMin: minTension - padding,
                    suggestedMax: maxTension + padding,
                    grid: { color: '#e9ecef' },
                    title: { display: true, text: 'Tension (V)', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 12,
                        callback: (val, idx) => {
                            const label = labels[idx];
                            if (label && label.includes(' ')) {
                                const [, hour] = label.split(' ');
                                if (idx % 3 === 0) return hour;
                            }
                            return '';
                        }
                    }
                }
            }
        },
        plugins: [dayBackgroundPlugin]
    };
    
    chartManager.destroy('hourlyTensionChart');
    requestAnimationFrame(() => {
        const ctx = document.getElementById('hourlyTensionChart')?.getContext('2d');
        if (ctx) {
            chartManager.create('hourlyTensionChart', config);
        }
    });
}
// ===========================================
// III) ÉNERGIE - CLIENT ANALYTICS
// ===========================================

class ClientEnergyAnalytics {
    constructor(energyData) {
        this.rawData = energyData;
        this.processedDates = [];
        this.processedClients = [];
        this.clientDaily = {};
        this.siteDaily = {};
        this.clientStatistics = {};
        this.siteStatistics = {};
        this.allPoints = []; // ✅ NOUVEAU : stocker tous les points de consommation
        this.processData();
    }
    
    processData() {
        if (!this.rawData?.data) return;
        const dailyMap = new Map(), siteMap = new Map(), clientSet = new Set();
        
        // ✅ NOUVEAU : collecter tous les points pour la distribution cumulative
        this.allPoints = [];
        
        this.rawData.data.forEach(point => {
            if (!point.timestamp || !point.energie || !point.clientId) return;
            const date = point.date, clientId = point.clientId, energie = point.energie;
            
            // ✅ Ajouter chaque point à la collection
            this.allPoints.push({
                date: date,
                clientId: clientId,
                energie: energie,
                timestamp: point.timestamp
            });
            
            clientSet.add(clientId);
            if (!dailyMap.has(date)) dailyMap.set(date, new Map());
            const dayMap = dailyMap.get(date);
            dayMap.set(clientId, (dayMap.get(clientId) || 0) + energie);
            siteMap.set(date, (siteMap.get(date) || 0) + energie);
        });
        
        this.processedClients = Array.from(clientSet).sort((a,b) => parseInt(a) - parseInt(b));
        this.processedDates = Array.from(dailyMap.keys()).sort();
        this.clientDaily = {};
        this.processedDates.forEach(date => {
            this.clientDaily[date] = {};
            const dayMap = dailyMap.get(date);
            this.processedClients.forEach(clientId => this.clientDaily[date][clientId] = dayMap.get(clientId) || 0);
        });
        this.siteDaily = {};
        this.processedDates.forEach(date => this.siteDaily[date] = siteMap.get(date) || 0);
        this.calculateClientStats();
        this.calculateSiteStats();
    }
    
    // ✅ NOUVELLE MÉTHODE : distribution cumulative des points
    getKitDistributionCumulative() {
        if (!this.allPoints.length) return [];
        
        const seuils = [
            { id: 0, label: 'Kit 0', max: 250, color: '#22c55e' },
            { id: 1, label: 'Kit 1', max: 360, color: '#eab308' },
            { id: 2, label: 'Kit 2', max: 540, color: '#f97316' },
            { id: 3, label: 'Kit 3', max: 720, color: '#ef4444' },
            { id: 4, label: 'Kit 4', max: 1080, color: '#8b5cf6' }
        ];
        
        const totalPoints = this.allPoints.length;
        const result = [];
        
        for (const seuil of seuils) {
            const count = this.allPoints.filter(p => p.energie <= seuil.max).length;
            result.push({
                id: seuil.id,
                label: seuil.label,
                max: seuil.max,
                color: seuil.color,
                count: count,
                percentage: (count / totalPoints) * 100
            });
        }
        
        return result;
    }
    
    // ✅ NOUVELLE MÉTHODE : version non cumulative (pour l'affichage des barres)
    getKitDistributionSimple() {
        if (!this.allPoints.length) return [];
        
        const seuils = [
            { id: 0, label: 'Kit 0', min: 0, max: 250 },
            { id: 1, label: 'Kit 1', min: 251, max: 360 },
            { id: 2, label: 'Kit 2', min: 361, max: 540 },
            { id: 3, label: 'Kit 3', min: 541, max: 720 },
            { id: 4, label: 'Kit 4', min: 721, max: 1080 }
        ];
        
        const totalPoints = this.allPoints.length;
        const distribution = [];
        
        for (const seuil of seuils) {
            const count = this.allPoints.filter(p => p.energie >= seuil.min && p.energie <= seuil.max).length;
            distribution.push({
                id: seuil.id,
                label: seuil.label,
                min: seuil.min,
                max: seuil.max,
                count: count,
                percentage: (count / totalPoints) * 100
            });
        }
        
        // Points > Kit 4
        const overCount = this.allPoints.filter(p => p.energie > 1080).length;
        distribution.push({
            id: 5,
            label: '> Kit 4',
            min: 1081,
            max: Infinity,
            count: overCount,
            percentage: (overCount / totalPoints) * 100
        });
        
        return distribution;
    }
    
    calculatePercentile(values, p) {
        if (!values.length) return 0;
        const sorted = [...values].sort((a,b) => a-b);
        return sorted[Math.min(Math.ceil(p/100 * sorted.length) - 1, sorted.length - 1)];
    }
    
    recommendKit(values) {
        const valid = values.filter(v => v > 0);
        if (!valid.length) return { id: 0, label: 'Kit 0', capacity: 250, confidence: 0 };
        const total = valid.length;
        const dep = { s250: valid.filter(v=>v>250).length, s360: valid.filter(v=>v>360).length, s540: valid.filter(v=>v>540).length, s720: valid.filter(v=>v>720).length, s1080: valid.filter(v=>v>1080).length };
        let tech = 0;
        if (dep.s1080/total > 0.2) return { id: null, label: 'Aucun kit adapté', capacity: null, message: 'Contacter le commercial' };
        if (dep.s720/total > 0.2) tech = 4;
        else if (dep.s540/total > 0.2) tech = 3;
        else if (dep.s360/total > 0.2) tech = 2;
        else if (dep.s250/total > 0.2) tech = 1;
        const caps = [250,360,540,720,1080], costs = [100,200,300,500,800];
        let best = 0, bestCost = Infinity;
        for (let i=0; i<=4; i++) {
            const cap = caps[i];
            const overCost = valid.filter(v=>v>cap).length * 30;
            let waste = 0;
            valid.forEach(v => { if (v < cap * 0.7) waste += (cap - v) * 0.05; });
            const totalCost = costs[i] + overCost + waste;
            if (totalCost < bestCost) { bestCost = totalCost; best = i; }
        }
        const final = Math.max(best, tech);
        const p95 = this.calculatePercentile(valid, 95);
        return { id: final, label: `Kit ${final}`, capacity: caps[final], required: Math.ceil(Math.max(p95, Math.max(...valid)*0.9) * 1.1), confidence: 95 };
    }
    
    calculateSiteStats() {
        const values = this.processedDates.map(d => this.siteDaily[d] || 0).filter(v=>v>0);
        this.siteStatistics = {
            average: values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0,
            maximum: Math.max(...this.processedDates.map(d=>this.siteDaily[d]||0), 0),
            percentile95: this.calculatePercentile(values, 95),
            activeDays: values.length,
            recommendation: this.recommendKit(values),
            totalEnergy: values.reduce((a,b)=>a+b,0)
        };
    }
    
    calculateClientStats() {
        this.processedClients.forEach(id => {
            const values = this.processedDates.map(d => this.clientDaily[d][id] || 0).filter(v=>v>0);
            this.clientStatistics[id] = {
                average: values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0,
                maximum: Math.max(...this.processedDates.map(d=>this.clientDaily[d][id]||0), 0),
                total: values.reduce((a,b)=>a+b,0),
                percentage: this.siteStatistics.totalEnergy ? (values.reduce((a,b)=>a+b,0)/this.siteStatistics.totalEnergy)*100 : 0,
                activeDays: values.length
            };
        });
    }
    
    getSiteProfile() { return { history: this.processedDates.map(d=>({ date:d, consumption:this.siteDaily[d]||0 })), stats: this.siteStatistics }; }
    getClientProfile(id) { return { id, history: this.processedDates.map(d=>({ date:d, consumption:this.clientDaily[d][id]||0 })), stats: this.clientStatistics[id] }; }
    getAllClientProfiles() { return this.processedClients.map(id => this.getClientProfile(id)); }
    getDateRange() { return { start: this.processedDates[0], end: this.processedDates[this.processedDates.length-1], total: this.processedDates.length }; }
}

let clientAnalyticsInstance = null;

export function renderClientConsumptionBoard() {
    const container = document.getElementById('clientConsumptionBoard');
    if (!container) return;
    const energyData = database.energyData;
    if (!energyData?.data?.length) { container.innerHTML = '<p class="no-data">Aucune donnée client</p>'; return; }
    if (!clientAnalyticsInstance || clientAnalyticsInstance.rawData !== energyData) clientAnalyticsInstance = new ClientEnergyAnalytics(energyData);
    renderClientBoardUI(container);
    createClientTrendChart();
}

function renderClientBoardUI(container) {
    const profile = clientAnalyticsInstance.getSiteProfile();
    const clients = clientAnalyticsInstance.getAllClientProfiles();
    const range = clientAnalyticsInstance.getDateRange();
    const stats = profile.stats;
    
    // Récupérer les valeurs de consommation de chaque point du graphique
    const dailyValues = profile.history.map(d => d.consumption);
    const totalJours = dailyValues.length;
    
    const seuils = [
        { id: 0, label: 'Kit 0', max: 250, color: '#94a3b8' },
        { id: 1, label: 'Kit 1', max: 360, color: '#22c55e' },
        { id: 2, label: 'Kit 2', max: 540, color: '#eab308' },
        { id: 3, label: 'Kit 3', max: 720, color: '#f97316' },
        { id: 4, label: 'Kit 4', max: 1080, color: '#ef4444' }
    ];
    
    // Calculer le nombre de jours ≤ chaque seuil
    const cumulative = [];
    for (const seuil of seuils) {
        const joursCouverts = dailyValues.filter(v => v <= seuil.max).length;
        const pourcentage = (joursCouverts / totalJours) * 100;
        cumulative.push({
            ...seuil,
            jours: joursCouverts,
            percentage: pourcentage
        });
    }
    
    // Générer les barres avec pourcentage DANS la barre
    const renderBars = () => {
        return cumulative.map(kit => {
            const percent = kit.percentage;
            const showLabel = percent > 12; // Afficher le texte seulement si la barre est assez large
            
            return `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <span style="display: inline-block; width: 12px; height: 12px; background: ${kit.color}; border-radius: 2px;"></span>
                        <span style="font-weight: 500;">${kit.label} (≤${kit.max}Wh)</span>
                    </div>
                    <div style="background: #e9ecef; border-radius: 8px; height: 36px; overflow: hidden; position: relative;">
                        <div style="width: ${percent}%; height: 100%; background: ${kit.color}; border-radius: 8px; display: flex; align-items: center; justify-content: flex-end; padding-right: ${showLabel ? '10px' : '0'};">
                            ${showLabel ? `<span style="color: white; font-size: 0.75rem; font-weight: 600;">${percent.toFixed(1)}%</span>` : ''}
                        </div>
                        ${!showLabel ? `<span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 0.7rem; color: #6c757d;">${percent.toFixed(1)}%</span>` : ''}
                    </div>
                    <div style="font-size: 0.7rem; color: #6c757d; margin-top: 4px;">
                        ${kit.jours} jours sur ${totalJours}
                    </div>
                </div>
            `;
        }).join('');
    };
    
    container.innerHTML = `
        <div class="card" style="padding:0;">
            <div style="padding:20px 24px; border-bottom:1px solid #e9ecef;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin:0; display: flex; align-items: center; gap: 8px;">
                        <span>🏭</span>
                        CONSOMMATION TOTALE DU SITE
                    </h3>
                    <span style="background:#e9ecef; padding:4px 12px; border-radius:100px; font-size:0.75rem;">
                        ${range.total} JOURS • ${clients.length} CLIENTS
                    </span>
                </div>
            </div>
            
            <!-- Légende des couleurs des kits -->
            <div style="padding:12px 24px; background:#f8f9fa; border-bottom:1px solid #e9ecef; display: flex; gap: 20px; flex-wrap: wrap;">
                ${seuils.map(kit => `
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="width: 12px; height: 12px; background: ${kit.color}; border-radius: 2px;"></span>
                        <span style="font-size: 0.7rem;">${kit.label}</span>
                    </div>
                `).join('')}
            </div>
            
            <div style="padding:24px;">
                <div style="height:300px;">
                    <canvas id="clientTrendChart"></canvas>
                </div>
            </div>
            
            <div style="padding:20px 24px; background:#f8f9fa; border-top:1px solid #e9ecef;">
                <h4 style="margin:0 0 16px 0; font-size:0.9rem; font-weight:600;">
                    📊 DISTRIBUTION CUMULATIVE DES CONSOMMATIONS
                </h4>
                <div style="font-size:0.7rem; color:#6c757d; margin-bottom: 16px;">
                    Pourcentage de jours couverts par chaque kit (cumulé)
                </div>
                ${renderBars()}
            </div>
            
            ${createDetailButton('clientDetailTable', '📋 AFFICHER LE DÉTAIL CLIENT')}
            
            <div id="clientDetailTable" style="display:none; padding:0 24px 24px 24px;">
                <div style="max-height:400px; overflow-y:auto; border:1px solid #e9ecef; border-radius:12px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                        <thead style="position:sticky; top:0; background:#f8f9fa;">
                            <tr>
                                <th style="padding:12px; text-align:left;">Date</th>
                                ${clientAnalyticsInstance.processedClients.map(id => `<th style="padding:12px; text-align:right;">Client ${id}</th>`).join('')}
                                <th style="padding:12px; text-align:right; background:#e9ecef;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clientAnalyticsInstance.processedDates.map(date => {
                                let rowTotal = 0;
                                return `
                                    <tr>
                                        <td style="padding:8px 12px; font-weight:500;">${date}</td>
                                        ${clientAnalyticsInstance.processedClients.map(id => {
                                            const val = clientAnalyticsInstance.clientDaily[date][id] || 0;
                                            rowTotal += val;
                                            return `<td style="padding:8px 12px; text-align:right;">${val.toFixed(0)}</td>`;
                                        }).join('')}
                                        <td style="padding:8px 12px; text-align:right; font-weight:700; background:#f1f3f5;">${rowTotal.toFixed(0)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function createClientTrendChart() {
    const ctx = document.getElementById('clientTrendChart')?.getContext('2d');
    if (!ctx) return;
    
    const profile = clientAnalyticsInstance.getSiteProfile();
    const dates = clientAnalyticsInstance.processedDates;
    const maxConsumption = Math.max(...profile.history.map(d => d.consumption), 0);
    
    // ✅ Définir les seuils des kits
    const kitThresholds = [
        { label: 'Kit 0 (250Wh)', value: 250, color: '#22c55e' },
        { label: 'Kit 1 (360Wh)', value: 360, color: '#eab308' },
        { label: 'Kit 2 (540Wh)', value: 540, color: '#f97316' },
        { label: 'Kit 3 (720Wh)', value: 720, color: '#ef4444' },
        { label: 'Kit 4 (1080Wh)', value: 1080, color: '#8b5cf6' }
    ];
    
    // ✅ Filtrer les seuils : ne garder que ceux qui sont dans la plage des données
    const visibleThresholds = kitThresholds.filter(threshold => threshold.value <= maxConsumption * 1.2);
    
    // ✅ Créer les datasets des lignes de seuils (seulement les visibles)
    const thresholdDatasets = visibleThresholds.map(threshold => ({
        label: threshold.label,
        data: Array(dates.length).fill(threshold.value),
        borderColor: threshold.color,
        borderWidth: 1.5,
        borderDash: [6, 6],
        pointRadius: 0,
        fill: false,
        order: 2
    }));
    
    chartManager.destroy('clientTrendChart');
    
    requestAnimationFrame(() => {
        chartManager.create('clientTrendChart', {
            type: 'line',
            data: {
                labels: dates.map(d => d.slice(5)),
                datasets: [
                    // Courbe de consommation (au premier plan)
                    {
                        label: 'Consommation totale',
                        data: profile.history.map(d => d.consumption),
                        borderColor: '#1e293b',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        borderWidth: 3,
                        tension: 0.2,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        fill: false,
                        order: 1
                    },
                    // Lignes des kits (en arrière-plan)
                    ...thresholdDatasets
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'top',
                        labels: { 
                            font: { size: 10 }, 
                            usePointStyle: true,
                            filter: (item) => item.text !== 'Consommation totale' // Optionnel
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                if (context.dataset.label === 'Consommation totale') {
                                    const value = context.raw;
                                    let kit = '';
                                    if (value <= 250) kit = 'Kit 0';
                                    else if (value <= 360) kit = 'Kit 1';
                                    else if (value <= 540) kit = 'Kit 2';
                                    else if (value <= 720) kit = 'Kit 3';
                                    else if (value <= 1080) kit = 'Kit 4';
                                    else kit = '> Kit 4';
                                    return [`Consommation: ${value.toFixed(0)} Wh`, `Seuil: ${kit}`];
                                }
                                return `${context.dataset.label}: ${context.raw} Wh`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#e9ecef' },
                        title: { display: true, text: 'Consommation (Wh)', font: { size: 10 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { maxRotation: 45, font: { size: 9 } }
                    }
                }
            }
        });
    });
}

export function destroyClientBoard() { chartManager.destroy('clientTrendChart'); clientAnalyticsInstance = null; }


// ===========================================
// ENERGY CYCLE MANAGER
// ===========================================

class EnergyCycleManager {
    constructor(energyData) {
        this.rawData = energyData;
        this.allDates = [];
        this.allHoursData = [];
        this.startIndex = 0;
        this.endIndex = 0;
        this.maxDaysRange = 7;
        this.prepareData();
        this.initIndices();
    }
    
    prepareData() {
        if (!this.rawData?.data) return;
        const dateMap = new Map();
        this.rawData.data.forEach(point => {
            if (!point.timestamp || !point.energie) return;
            const match = point.timestamp.match(/\d{4}-\d{2}-\d{2} (\d{2}):\d{2}:\d{2}/);
            if (!match) return;
            const hour = parseInt(match[1]);
            if (!dateMap.has(point.date)) dateMap.set(point.date, []);
            dateMap.get(point.date).push({ hour, energie: point.energie });
        });
        this.allDates = Array.from(dateMap.keys()).sort();
        this.allHoursData = this.allDates.map(date => {
            const points = dateMap.get(date);
            const hours = [];
            let cumul = 0;
            points.sort((a,b) => a.hour - b.hour);
            for (let h = 0; h < 24; h++) {
                const wh = points.filter(p => p.hour === h).reduce((s,p) => s + p.energie, 0);
                cumul += wh;
                hours.push({ hour: h, label: `${h}h`, cumul, value: wh });
            }
            return { date, hours };
        });
    }
    
    initIndices() { 
        if (this.allDates.length) { 
            this.endIndex = this.allDates.length - 1; 
            this.startIndex = Math.max(0, this.endIndex - (this.maxDaysRange - 1)); 
        } 
    }
    
    setRange(start, end) { 
        if (start < 0 || end >= this.allDates.length || start > end || end - start + 1 > this.maxDaysRange) return false; 
        this.startIndex = start; 
        this.endIndex = end; 
        return true; 
    }
    
    getCurrentDates() { 
        return { 
            start: this.allDates[this.startIndex], 
            end: this.allDates[this.endIndex], 
            count: this.endIndex - this.startIndex + 1 
        }; 
    }
    
    getChartData() {
        const labels = [], cumul = [], hourly = [];
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            this.allHoursData[i].hours.forEach(h => { 
                labels.push(`${this.allDates[i]} ${h.label}`); 
                cumul.push(h.cumul); 
                hourly.push(h.value); 
            });
        }
        return { labels, cumulValues: cumul, hourlyValues: hourly };
    }
    
    getHourlyAverages() {
        const { labels, cumulValues } = this.getChartData();
        const averages = [];
        const avgLabels = [];
        const avgDayInfo = [];
        
        for (let i = 1; i < cumulValues.length; i++) {
            const avg = (cumulValues[i] + cumulValues[i-1]) / 2;
            averages.push(avg);
            avgLabels.push(labels[i]);
            
            const [date, hour] = labels[i].split(' ');
            avgDayInfo.push({ date, hour, average: avg });
        }
        
        return { averages, labels: avgLabels, dayInfo: avgDayInfo };
    }
    
    getAverageStats() {
        const { averages } = this.getHourlyAverages();
        if (averages.length === 0) return { avg: 0, max: 0 };
        
        return {
            avg: averages.reduce((a,b) => a + b, 0) / averages.length,
            max: Math.max(...averages)
        };
    }
    
    getDayNightAverages() {
        const { averages, dayInfo } = this.getHourlyAverages();
        let daySum = 0, nightSum = 0;
        let dayCount = 0, nightCount = 0;
        
        dayInfo.forEach((info, idx) => {
            const hourNum = parseInt(info.hour.replace('h', ''));
            if (hourNum >= 6 && hourNum <= 17) {
                daySum += averages[idx];
                dayCount++;
            } else {
                nightSum += averages[idx];
                nightCount++;
            }
        });
        
        return {
            day: dayCount > 0 ? daySum / dayCount : 0,
            night: nightCount > 0 ? nightSum / nightCount : 0
        };
    }
    
    getDayNightStats() {
        let dayTotal = 0, nightTotal = 0;
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            let daySum = 0, nightSum = 0;
            this.allHoursData[i].hours.forEach(h => { 
                if (h.hour >= 6 && h.hour < 18) daySum += h.value; 
                else nightSum += h.value; 
            });
            dayTotal += daySum; 
            nightTotal += nightSum;
        }
        const total = dayTotal + nightTotal;
        const count = this.endIndex - this.startIndex + 1;
        return { 
            day: { avg: dayTotal / count, percent: total ? (dayTotal / total) * 100 : 0 }, 
            night: { avg: nightTotal / count, percent: total ? (nightTotal / total) * 100 : 0 } 
        };
    }
}

let currentManager = null;

// ===========================================
// STYLE UNIFIÉ
// ===========================================

const UNIFIED_STYLE = {
    colors: {
        primary: '#3b82f6',
        grid: '#e9ecef',
        success: '#22c55e',
        warning: '#f59e0b'
    },
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
};

// ===========================================
// PLUGIN FONDS COLORÉS POUR LINE CHART (CUMULÉ)
// ===========================================

const dayBackgroundPlugin = {
    id: 'dayBackground',
    beforeDatasetsDraw(chart) {
        const { ctx, chartArea, scales, data } = chart;
        if (!scales.x || !data.labels.length) return;
        
        const labels = data.labels;
        let currentDay = '';
        let dayStartIndex = 0;
        const daySegments = [];
        
        labels.forEach((label, idx) => {
            const dayKey = label.split(' ')[0];
            if (currentDay === '') {
                currentDay = dayKey;
                dayStartIndex = idx;
            } else if (dayKey !== currentDay) {
                const startX = scales.x.getPixelForValue(dayStartIndex);
                const endX = scales.x.getPixelForValue(idx - 0.5);
                if (startX && endX) daySegments.push({ day: currentDay, startX, endX });
                currentDay = dayKey;
                dayStartIndex = idx;
            }
        });
        
        if (currentDay) {
            const startX = scales.x.getPixelForValue(dayStartIndex);
            const endX = chartArea.right;
            if (startX) daySegments.push({ day: currentDay, startX, endX });
        }
        
        ctx.save();
        daySegments.forEach((segment, i) => {
            const dayNum = parseInt(segment.day.split('-')[2]) || i;
            const isEven = dayNum % 2 === 0;
            ctx.fillStyle = isEven ? '#fef7e0' : '#ffffff';
            ctx.fillRect(
                Math.max(chartArea.left, segment.startX),
                chartArea.top,
                Math.min(segment.endX, chartArea.right) - Math.max(chartArea.left, segment.startX),
                chartArea.bottom - chartArea.top
            );
        });
        
        ctx.beginPath();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        daySegments.forEach((segment, i) => {
            if (i > 0 && segment.startX > chartArea.left && segment.startX < chartArea.right) {
                ctx.beginPath();
                ctx.moveTo(segment.startX, chartArea.top);
                ctx.lineTo(segment.startX, chartArea.bottom);
                ctx.stroke();
            }
        });
        ctx.restore();
    }
};

// ===========================================
// PLUGIN FONDS COLORÉS POUR BAR CHART (MOYENNES)
// ===========================================

const dayBackgroundBarPlugin = {
    id: 'dayBackgroundBar',
    beforeDatasetsDraw(chart) {
        const { ctx, chartArea, scales, data } = chart;
        if (!scales.x || !data.labels.length || !currentManager) return;
        
        const daySegments = [];
        let currentDay = '';
        let dayStartIndex = 0;
        let labelIndex = 0;
        
        for (let i = currentManager.startIndex; i <= currentManager.endIndex; i++) {
            const date = currentManager.allDates[i];
            const hourCount = 23;
            
            if (currentDay === '') {
                currentDay = date;
                dayStartIndex = labelIndex;
            } else if (date !== currentDay) {
                const startX = scales.x.getPixelForValue(dayStartIndex);
                const endX = scales.x.getPixelForValue(labelIndex - 0.5);
                if (startX && endX) daySegments.push({ day: currentDay, startX, endX });
                currentDay = date;
                dayStartIndex = labelIndex;
            }
            labelIndex += hourCount;
        }
        
        if (currentDay) {
            const startX = scales.x.getPixelForValue(dayStartIndex);
            const endX = chartArea.right;
            if (startX) daySegments.push({ day: currentDay, startX, endX });
        }
        
        ctx.save();
        daySegments.forEach((segment, i) => {
            const dayNum = parseInt(segment.day.split('-')[2]) || i;
            const isEven = dayNum % 2 === 0;
            ctx.fillStyle = isEven ? '#fef7e0' : '#ffffff';
            ctx.fillRect(
                Math.max(chartArea.left, segment.startX),
                chartArea.top,
                Math.min(segment.endX, chartArea.right) - Math.max(chartArea.left, segment.startX),
                chartArea.bottom - chartArea.top
            );
        });
        
        ctx.beginPath();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        daySegments.forEach((segment, i) => {
            if (i > 0 && segment.startX > chartArea.left && segment.startX < chartArea.right) {
                ctx.beginPath();
                ctx.moveTo(segment.startX, chartArea.top);
                ctx.lineTo(segment.startX, chartArea.bottom);
                ctx.stroke();
            }
        });
        ctx.restore();
    }
};

// ===========================================
// RENDER PRINCIPAL
// ===========================================

export function renderDailyEnergyCycle() {
    const container = document.getElementById('energyCycleBoard');
    if (!container) return;
    
    const energyData = database.energyData;
    if (!energyData?.data?.length) { 
        container.innerHTML = '<p class="no-data">Aucune donnée énergie</p>'; 
        return; 
    }
    
    if (!currentManager || currentManager.rawData !== energyData) {
        currentManager = new EnergyCycleManager(energyData);
    }
    
    if (!currentManager.allDates.length) { 
        container.innerHTML = '<p class="no-data">Aucune donnée</p>'; 
        return; 
    }
    
    renderCycleUI(container);
    updateCycleChart();
    updateAverageChart();
    attachCycleEvents();
}

function renderCycleUI(container) {
    const dates = currentManager.getCurrentDates();
    const averageStats = currentManager.getAverageStats();
    const dayNightAverages = currentManager.getDayNightAverages();
    
    container.innerHTML = `
        <div class="cycle-card" style="background:white; border-radius:24px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            <div class="cycle-header" style="padding:20px 24px; border-bottom:1px solid #e9ecef;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap; gap:12px;">
                    <h3 style="margin:0; display: flex; align-items: center; gap: 8px; font-size:1.25rem;">
                        <span>⚡</span>
                        CYCLE DE CONSOMMATION
                    </h3>
                    <div class="range-badge" style="background:#e9ecef; padding:6px 14px; border-radius:40px; font-size:0.75rem; font-weight:500;">
                        ${dates.count} JOUR${dates.count > 1 ? 'S' : ''}
                    </div>
                </div>
                <div class="range-text" style="margin-top:8px; font-size:0.8rem; color:#6c757d;">
                    ${dates.start} → ${dates.end}
                </div>
            </div>
            
            <div class="cycle-filters" style="padding:20px 24px; background:#f8f9fa; border-bottom:1px solid #e9ecef;">
                <div style="display:flex; gap:16px; align-items: flex-end; flex-wrap: wrap;">
                    <div style="flex:1; min-width:180px;">
                        <label style="display:block; font-size:0.7rem; font-weight:600; margin-bottom:6px;">📅 DATE DE DÉBUT</label>
                        <select id="cycleStartSelect" class="date-select" style="width:100%; padding:10px 14px; border:2px solid #dee2e6; border-radius:12px; background:white; font-size:0.85rem;">
                            ${currentManager.allDates.map((d,i)=>`<option value="${i}" ${i===currentManager.startIndex?'selected':''}>${d}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1; min-width:180px;">
                        <label style="display:block; font-size:0.7rem; font-weight:600; margin-bottom:6px;">📅 DATE DE FIN</label>
                        <select id="cycleEndSelect" class="date-select" style="width:100%; padding:10px 14px; border:2px solid #dee2e6; border-radius:12px; background:white; font-size:0.85rem;">
                            ${currentManager.allDates.map((d,i)=>`<option value="${i}" ${i===currentManager.endIndex?'selected':''}>${d}</option>`).join('')}
                        </select>
                    </div>
                    <button id="cycleApplyBtn" class="apply-btn" style="background:#3b82f6; color:white; border:none; padding:10px 28px; border-radius:12px; font-weight:600; cursor:pointer;">
                        APPLIQUER
                    </button>
                </div>
            </div>
            
            <div class="cycle-chart-section" style="padding:24px;">
                <h4 style="margin:0 0 16px 0; font-size:0.85rem; font-weight:600;">📈 CONSOMMATION CUMULÉE</h4>
                <div style="height:300px;">
                    <canvas id="dailyEnergyCycleChart"></canvas>
                </div>
            </div>
            
            <div class="cycle-chart-section" style="padding:0 24px 24px 24px;">
                <h4 style="margin:0 0 16px 0; font-size:0.85rem; font-weight:600;">📊 MOYENNES HORAIRES</h4>
                <div style="height:220px;">
                    <canvas id="hourlyAverageChart"></canvas>
                </div>
            </div>
            
            <div class="cycle-stats" style="padding:16px 24px; background:#f8f9fa; border-top:1px solid #e9ecef;">
                <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:16px;">
                    <div style="text-align:center;">
                        <div style="font-size:0.7rem; color:#6c757d;">MOYENNE HORAIRE</div>
                        <div style="font-size:1.4rem; font-weight:700; color:#3b82f6;">${averageStats.avg.toFixed(1)} <span style="font-size:0.8rem;">Wh</span></div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.7rem; color:#6c757d;">MAX HORAIRE</div>
                        <div style="font-size:1.4rem; font-weight:700; color:#f59e0b;">${averageStats.max.toFixed(1)} <span style="font-size:0.8rem;">Wh</span></div>
                    </div>
                </div>
            </div>
            
            <div class="cycle-period-stats" style="padding:16px 24px 24px; border-top:1px solid #e9ecef;">
                <h4 style="margin:0 0 16px 0; font-size:0.85rem; font-weight:600;">🌓 MOYENNES PAR PÉRIODE</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                    <div style="background:linear-gradient(135deg, #fff3e0, #fff9f0); border-radius:16px; padding:16px; border-left:4px solid #f59e0b;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span style="font-size:2rem;">☀️</span>
                            <div>
                                <div style="font-size:0.7rem; color:#f59e0b; font-weight:600;">JOUR (6h-17h)</div>
                                <div style="font-size:1.4rem; font-weight:700; color:#f59e0b;">${dayNightAverages.day.toFixed(1)} <span style="font-size:0.8rem;">Wh</span></div>
                                <div style="font-size:0.7rem; color:#6c757d;">moyenne horaire</div>
                            </div>
                        </div>
                    </div>
                    <div style="background:linear-gradient(135deg, #e8f0fe, #f0f4ff); border-radius:16px; padding:16px; border-left:4px solid #3b82f6;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span style="font-size:2rem;">🌙</span>
                            <div>
                                <div style="font-size:0.7rem; color:#3b82f6; font-weight:600;">NUIT (18h-5h)</div>
                                <div style="font-size:1.4rem; font-weight:700; color:#3b82f6;">${dayNightAverages.night.toFixed(1)} <span style="font-size:0.8rem;">Wh</span></div>
                                <div style="font-size:0.7rem; color:#6c757d;">moyenne horaire</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function updateCycleChart() {
    if (!currentManager) return;
    const data = currentManager.getChartData();
    const ctx = document.getElementById('dailyEnergyCycleChart')?.getContext('2d');
    if (!ctx) return;
    
    const dayInfo = [];
    data.labels.forEach((label, idx) => {
        const [date, hour] = label.split(' ');
        dayInfo.push({ date, hour, index: idx });
    });
    
    const config = {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{ 
                data: data.cumulValues, 
                borderColor: UNIFIED_STYLE.colors.primary, 
                backgroundColor: 'rgba(59,130,246,0.05)',
                borderWidth: 2.5, 
                pointRadius: 2, 
                pointHoverRadius: 5,
                pointBackgroundColor: UNIFIED_STYLE.colors.primary,
                fill: true,
                tension: 0.2
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: {
                // ✅ Désactiver complètement la légende
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const idx = items[0].dataIndex;
                            if (dayInfo[idx]) {
                                return `${dayInfo[idx].date} ${dayInfo[idx].hour}`;
                            }
                            return data.labels[idx];
                        },
                        label: (ctx) => `${ctx.raw.toFixed(0)} Wh`
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    grid: { color: UNIFIED_STYLE.colors.grid },
                    title: { display: true, text: 'Wh cumulés', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        maxRotation: 45, 
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 12,
                        callback: (val, idx) => {
                            const label = data.labels[idx];
                            if (label && label.includes(' ')) {
                                const [, hour] = label.split(' ');
                                if (idx % 3 === 0) return hour;
                            }
                            return '';
                        }
                    }
                }
            } 
        },
        plugins: [dayBackgroundPlugin]
    };
    
    chartManager.destroy('dailyEnergyCycleChart');
    requestAnimationFrame(() => {
        chartManager.create('dailyEnergyCycleChart', config);
    });
}
function updateAverageChart() {
    if (!currentManager) return;
    const { averages, labels, dayInfo } = currentManager.getHourlyAverages();
    const ctx = document.getElementById('hourlyAverageChart')?.getContext('2d');
    if (!ctx) return;
    
    chartManager.destroy('hourlyAverageChart');
    requestAnimationFrame(() => {
        chartManager.create('hourlyAverageChart', {
            type: 'bar',
            data: {
                labels: labels.map(label => {
                    const [, hour] = label.split(' ');
                    return hour;
                }),
                datasets: [{
                    label: 'Moyenne horaire (Wh)',
                    data: averages,
                    backgroundColor: UNIFIED_STYLE.colors.success,
                    borderColor: 'white',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const idx = items[0].dataIndex;
                                if (dayInfo[idx]) {
                                    return `${dayInfo[idx].date} ${dayInfo[idx].hour}`;
                                }
                                return labels[idx];
                            },
                            label: (ctx) => {
                                const value = ctx.raw;
                                return `${value.toFixed(1)} Wh (moyenne)`;
                            }
                        }
                    },
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        title: { display: true, text: 'Moyenne (Wh)', font: { size: 10 } },
                        grid: { color: UNIFIED_STYLE.colors.grid }
                    },
                    x: {
                        title: { display: true, text: 'Heure', font: { size: 10 } },
                        ticks: { 
                            maxRotation: 45, 
                            minRotation: 45, 
                            autoSkip: true, 
                            maxTicksLimit: 12
                        }
                    }
                }
            },
            plugins: [dayBackgroundBarPlugin]
        });
    });
}

function attachCycleEvents() {
    const startSelect = document.getElementById('cycleStartSelect');
    const endSelect = document.getElementById('cycleEndSelect');
    const applyBtn = document.getElementById('cycleApplyBtn');
    if (!startSelect || !endSelect || !applyBtn) return;
    
    const updateEndOptions = () => {
        const startIdx = parseInt(startSelect.value);
        const maxEnd = Math.min(startIdx + 6, currentManager.allDates.length - 1);
        endSelect.innerHTML = '';
        for (let i = startIdx; i <= maxEnd; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = currentManager.allDates[i];
            if (i === currentManager.endIndex && i >= startIdx && i <= maxEnd) {
                option.selected = true;
            }
            endSelect.appendChild(option);
        }
        if (parseInt(endSelect.value) > maxEnd) {
            endSelect.value = maxEnd;
        }
    };
    
    startSelect.addEventListener('change', updateEndOptions);
    updateEndOptions();
    
    applyBtn.addEventListener('click', () => {
        const newStart = parseInt(startSelect.value);
        const newEnd = parseInt(endSelect.value);
        
        if (currentManager.setRange(newStart, newEnd)) {
            updateCycleChart();
            updateAverageChart();
            
            const averageStats = currentManager.getAverageStats();
            const dayNightAverages = currentManager.getDayNightAverages();
            const dates = currentManager.getCurrentDates();
            
            const header = document.querySelector('#energyCycleBoard .cycle-header');
            if (header) {
                const badge = header.querySelector('.range-badge');
                const rangeText = header.querySelector('.range-text');
                if (badge) badge.innerHTML = `${dates.count} JOUR${dates.count > 1 ? 'S' : ''}`;
                if (rangeText) rangeText.innerHTML = `${dates.start} → ${dates.end}`;
            }
            
            const statsDiv = document.querySelector('#energyCycleBoard .cycle-stats');
            if (statsDiv) {
                statsDiv.innerHTML = `
                    <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:16px;">
                        <div style="text-align:center;">
                            <div style="font-size:0.7rem; color:#6c757d;">MOYENNE HORAIRE</div>
                            <div style="font-size:1.4rem; font-weight:700; color:#3b82f6;">${averageStats.avg.toFixed(1)} <span style="font-size:0.8rem;">Wh</span></div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:0.7rem; color:#6c757d;">MAX HORAIRE</div>
                            <div style="font-size:1.4rem; font-weight:700; color:#f59e0b;">${averageStats.max.toFixed(1)} <span style="font-size:0.8rem;">Wh</span></div>
                        </div>
                    </div>
                `;
            }
            
            const periodStats = document.querySelector('#energyCycleBoard .cycle-period-stats');
            if (periodStats) {
                periodStats.innerHTML = `
                    <h4 style="margin:0 0 16px 0; font-size:0.85rem; font-weight:600;">🌓 MOYENNES PAR PÉRIODE</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                        <div style="background:linear-gradient(135deg, #fff3e0, #fff9f0); border-radius:16px; padding:16px; border-left:4px solid #f59e0b;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="font-size:2rem;">☀️</span>
                                <div>
                                    <div style="font-size:0.7rem; color:#f59e0b; font-weight:600;">JOUR (6h-17h)</div>
                                    <div style="font-size:1.4rem; font-weight:700; color:#f59e0b;">${dayNightAverages.day.toFixed(1)} <span style="font-size:0.8rem;">Wh</span></div>
                                    <div style="font-size:0.7rem; color:#6c757d;">moyenne horaire</div>
                                </div>
                            </div>
                        </div>
                        <div style="background:linear-gradient(135deg, #e8f0fe, #f0f4ff); border-radius:16px; padding:16px; border-left:4px solid #3b82f6;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="font-size:2rem;">🌙</span>
                                <div>
                                    <div style="font-size:0.7rem; color:#3b82f6; font-weight:600;">NUIT (18h-5h)</div>
                                    <div style="font-size:1.4rem; font-weight:700; color:#3b82f6;">${dayNightAverages.night.toFixed(1)} <span style="font-size:0.8rem;">Wh</span></div>
                                    <div style="font-size:0.7rem; color:#6c757d;">moyenne horaire</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    });
}

export function destroyEnergyCycle() { 
    chartManager.destroy('dailyEnergyCycleChart');
    chartManager.destroy('hourlyAverageChart');
    currentManager = null; 
}