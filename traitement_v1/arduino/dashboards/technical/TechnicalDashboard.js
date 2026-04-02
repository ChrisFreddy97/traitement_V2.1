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

function getFirstAvailableDate() {
    const dates = getAvailableDates();
    return dates.length > 0 ? dates[0] : null;
}

function getLastAvailableDate() {
    const dates = getAvailableDates();
    return dates.length > 0 ? dates[dates.length - 1] : null;
}

function getAvailableYears() {
    const years = new Set();
    getAvailableDates().forEach(date => {
        years.add(new Date(date).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
}

function hasActiveFilter(filter) {
    return (filter.period && filter.period !== 'all') || 
           filter.startDate || 
           filter.endDate || 
           filter.month || 
           filter.year;
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR');
}

function getFilterSummaryText(filter) {
    // Dates personnalisées
    if (filter.startDate && filter.endDate) {
        const start = formatDisplayDate(filter.startDate);
        const end = formatDisplayDate(filter.endDate);
        
        return `📅 Du ${start} au ${end}`;
    }
    
    // Mois/année spécifique
    if (filter.month && filter.year) {
        const monthName = new Date(2000, filter.month - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });
        return `📅 ${monthName} ${filter.year}`;
    }
    
    // Année seule
    if (filter.year) {
        return `📅 Année ${filter.year}`;
    }
    
    // Période prédéfinie
    if (filter.period && filter.period !== 'all') {
        const lastDate = getLastAvailableDate();
        if (lastDate) {
            const endDate = new Date(lastDate);
            const startDate = new Date(lastDate);
            
            switch(filter.period) {
                case '7days':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case '15days':
                    startDate.setDate(endDate.getDate() - 15);
                    break;
                case '30days':
                    startDate.setDate(endDate.getDate() - 30);
                    break;
                case '2months':
                    startDate.setMonth(endDate.getMonth() - 2);
                    break;
                case '3months':
                    startDate.setMonth(endDate.getMonth() - 3);
                    break;
                case '6months':
                    startDate.setMonth(endDate.getMonth() - 6);
                    break;
                case '1year':
                    startDate.setFullYear(endDate.getFullYear() - 1);
                    break;
            }
            
            return `📅 Du ${formatDisplayDate(startDate)} au ${formatDisplayDate(endDate)}`;
        }
        
        // Fallback si pas de dates
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
    
    const firstDate = getFirstAvailableDate();
    const lastDate = getLastAvailableDate();
    
    if (firstDate && lastDate) {
        return `📅 Du ${formatDisplayDate(firstDate)} au ${formatDisplayDate(lastDate)}`;
    }
    
    return `📅 Aucune donnée disponible`;
}

function formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
                <div class="filter-header-left">
                    <span class="filter-icon">🎯</span>
                    <span class="filter-title">Filtrer les données</span>
                </div>
                <div class="filter-header-right">
                    <span class="filter-badge" id="filterActiveBadge" style="display: ${hasActiveFilter(currentFilter) ? 'inline-flex' : 'none'};">Filtre actif</span>
                    <span class="filter-toggle">▼</span>
                </div>
            </div>
            
            <div class="filter-content" id="filterContent">
                <!-- Résumé du filtre actif -->
                <div class="filter-summary" id="filterSummary">
                    ${getFilterSummaryText(currentFilter)}
                </div>

                <!-- Section Période rapide -->
                <div class="filter-section">
                    <div class="filter-section-header">
                        <span class="filter-section-icon">⚡</span>
                        <span class="filter-section-title">Période rapide</span>
                    </div>
                    <div class="filter-options-grid">
                        <button class="filter-chip ${currentFilter.period === '7days' ? 'active' : ''}" data-period="7days" onclick="window.applyFilterPeriod('7days')">7 jours</button>
                        <button class="filter-chip ${currentFilter.period === '15days' ? 'active' : ''}" data-period="15days" onclick="window.applyFilterPeriod('15days')">15 jours</button>
                        <button class="filter-chip ${currentFilter.period === '30days' ? 'active' : ''}" data-period="30days" onclick="window.applyFilterPeriod('30days')">30 jours</button>
                        <button class="filter-chip ${currentFilter.period === '2months' ? 'active' : ''}" data-period="2months" onclick="window.applyFilterPeriod('2months')">2 mois</button>
                        <button class="filter-chip ${currentFilter.period === '3months' ? 'active' : ''}" data-period="3months" onclick="window.applyFilterPeriod('3months')">3 mois</button>
                        <button class="filter-chip ${currentFilter.period === '6months' ? 'active' : ''}" data-period="6months" onclick="window.applyFilterPeriod('6months')">6 mois</button>
                        <button class="filter-chip ${currentFilter.period === '1year' ? 'active' : ''}" data-period="1year" onclick="window.applyFilterPeriod('1year')">1 an</button>
                        <button class="filter-chip ${currentFilter.period === 'all' ? 'active' : ''}" data-period="all" onclick="window.applyFilterPeriod('all')">Toutes</button>
                    </div>
                </div>
                
                <!-- Section Mois spécifique -->
                <div class="filter-section">
                    <div class="filter-section-header">
                        <span class="filter-section-icon">📅</span>
                        <span class="filter-section-title">Mois spécifique</span>
                    </div>
                    <div class="filter-controls-group">
                        <select class="filter-select" id="filterMonthSelect">
                            <option value="">Sélectionner un mois</option>
                            ${Array.from({length: 12}, (_, i) => {
                                const monthNum = i + 1;
                                const monthName = new Date(2000, i, 1).toLocaleDateString('fr-FR', { month: 'long' });
                                return `<option value="${monthNum}" ${currentFilter.month === monthNum ? 'selected' : ''}>${monthName}</option>`;
                            }).join('')}
                        </select>
                        <select class="filter-select" id="filterYearSelect">
                            <option value="">Sélectionner une année</option>
                            ${getAvailableYears().map(year => `<option value="${year}" ${currentFilter.year === year ? 'selected' : ''}>${year}</option>`).join('')}
                        </select>
                        <button class="filter-btn-primary" onclick="window.applyFilterMonthYear()">
                            <span>▶</span> Appliquer
                        </button>
                    </div>
                </div>
                
                <!-- Section Dates personnalisées -->
                <div class="filter-section">
                    <div class="filter-section-header">
                        <span class="filter-section-icon">📆</span>
                        <span class="filter-section-title">Dates personnalisées</span>
                    </div>
                    <div class="filter-controls-group">
                        <div class="filter-date-range">
                            <div class="filter-date-box">
                                <span class="date-label">Du</span>
                                <select class="filter-date-select" id="filterStartDateSelect">
                                    <option value="">Choisir une date</option>
                                    ${dateOptions}
                                </select>
                            </div>
                            <span class="date-separator">→</span>
                            <div class="filter-date-box">
                                <span class="date-label">Au</span>
                                <select class="filter-date-select" id="filterEndDateSelect">
                                    <option value="">Choisir une date</option>
                                    ${dateOptions}
                                </select>
                            </div>
                        </div>
                        <div class="filter-actions">
                            <button class="filter-btn-primary" onclick="window.applyFilterCustomDates()">
                                <span>✓</span> Appliquer
                            </button>
                            <button class="filter-btn-secondary" onclick="window.clearFilter()">
                                <span>⟳</span> Réinitialiser
                            </button>
                        </div>
                    </div>
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
    
    // ✅ Calcul des variations dépassées
    const variationDays = data.causes?.variation?.length || 0;
    const pourcentageVariation = ((variationDays / data.totalJours) * 100).toFixed(1);
    const variationClass = pourcentageVariation < 20 ? 'color-success' : 'color-warning';

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
            return `
                <tr>
                    <td style="padding: 0.75rem 1rem;">${date}</td>
                    <td style="padding: 0.75rem 1rem; text-align: center;">${valeur} V</td>
                </tr>
            `;
        }).join('');
        return `
            <div style="max-height: 300px; overflow-y: auto; margin-top: 10px; border: 1px solid #e9ecef; border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead style="position: sticky; top: 0; background: #f8f9fa;">
                        <tr>
                            <th style="padding: 0.75rem 1rem; text-align: left;">Date</th>
                            <th style="padding: 0.75rem 1rem; text-align: center;">Valeur (V)</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    };

    container.innerHTML = `
        <h3 class="card-title">📊 CONFORMITÉ</h3>
        <div class="grid-3 gap-15 mb-20">
            <!-- Carte Jours conformes -->
            <div class="stat-card text-center">
                <div class="stat-label">✅ Jours conformes</div>
                <div class="stat-value ${percentClass}">${data.pourcentage}%</div>
                <div class="stat-detail">${data.conformes}/${data.totalJours} jours</div>
                <div class="stat-norm">Seuils: ${norms.min}V - ${norms.max}V</div>
            </div>
            
            <!-- Carte Jours non conformes -->
            <div class="stat-card text-center">
                <div class="stat-label">⚠️ Jours non conformes</div>
                <div class="stat-value color-danger">${pourcentageNonConforme}%</div>
                <div class="stat-detail">${nonConformes}/${data.totalJours} jours</div>
                <div class="stat-norm">Hors limites</div>
            </div>
            
            <!-- ✅ Carte Variations dépassées -->
            <div class="stat-card text-center">
                <div class="stat-label">📈 Variations > ${norms.variationSeuil}V/h</div>
                <div class="stat-value ${variationClass}">${pourcentageVariation}%</div>
                <div class="stat-detail">${variationDays}/${data.totalJours} jours</div>
                <div class="stat-norm">Seuil: ${norms.variationSeuil}V/h</div>
            </div>
        </div>
        
        <div class="mt-20">
            <div class="grid-3 gap-15">
                <!-- Carte Surtension -->
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⬆️</span>
                        <span class="cause-label">Surtension (>${norms.max}V)</span>
                        <span class="cause-count">${data.causes.max.length} jours</span>
                    </div>
                    ${data.causes.max.length > 0 ? createDetailButton('surtension-details', 'Voir détails') : ''}
                    <div id="surtension-details" style="display:none; margin-top:10px;">
                        ${generateDetailsTable(data.causes.max, 'max')}
                    </div>
                </div>
                
                <!-- Carte Sous-tension -->
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⬇️</span>
                        <span class="cause-label">Sous-tension (<${norms.min}V)</span>
                        <span class="cause-count">${data.causes.min.length} jours</span>
                    </div>
                    ${data.causes.min.length > 0 ? createDetailButton('soustension-details', 'Voir détails') : ''}
                    <div id="soustension-details" style="display:none; margin-top:10px;">
                        ${generateDetailsTable(data.causes.min, 'min')}
                    </div>
                </div>
                
                <!-- ✅ Carte Variation -->
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⚡</span>
                        <span class="cause-label">Variation (>${norms.variationSeuil}V/h)</span>
                        <span class="cause-count">${variationDays} jours</span>
                    </div>
                    ${variationDays > 0 ? createDetailButton('variation-details', 'Voir détails') : ''}
                    <div id="variation-details" style="display:none; margin-top:10px;">
                        ${generateDetailsTable(data.causes.variation, 'avg')}
                    </div>
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
    
    // ✅ Générer un ID unique pour le contenu à cacher
    const normsContentId = `norms-content-${Date.now()}`;
    
    container.innerHTML = `
        <div class="norms-card-wrapper">
            <div class="norms-card-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleNormsContent('${normsContentId}', this)">
                <h3 class="card-title" style="margin: 0;">🔋 Normes Système ${normSystem}</h3>
                <span class="norms-toggle" style="font-size: 1.2rem; transition: transform 0.2s;">▼</span>
            </div>
            <div id="${normsContentId}" class="norms-card-content" style="display: none; margin-top: 1rem;">
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
            </div>
        </div>
    `;
}

// ✅ Fonction globale pour toggler le contenu
window.toggleNormsContent = function(contentId, headerElement) {
    const content = document.getElementById(contentId);
    const toggleIcon = headerElement.querySelector('.norms-toggle');
    
    if (content) {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            if (toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
        } else {
            content.style.display = 'none';
            if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';
        }
    }
};

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

    // ✅ Ajout de la catégorie "extreme" (≥8 dépassements)
    const stats = { excellent: 0, bon: 0, mauvais: 0, critique: 0, extreme: 0 };
    hvData.forEach(d => {
        if (d.count >= 8) stats.extreme++;
        else stats[d.qualite]++;
    });

    const pourcentages = {
        excellent: ((stats.excellent / totalJours) * 100).toFixed(1),
        bon: ((stats.bon / totalJours) * 100).toFixed(1),
        mauvais: ((stats.mauvais / totalJours) * 100).toFixed(1),
        critique: ((stats.critique / totalJours) * 100).toFixed(1),
        extreme: ((stats.extreme / totalJours) * 100).toFixed(1)
    };

    // Récupérer les données horaires pour trouver l'heure du pic
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

    // ✅ Fonction pour obtenir la couleur selon le compteur
    const getCountColor = (count) => {
        if (count >= 8) return '#a855f7';      // Violet pour extrême
        if (count >= 4) return '#22c55e';      // Vert pour excellent
        if (count >= 2) return '#eab308';      // Jaune pour bon
        if (count === 1) return '#f97316';     // Orange pour mauvais
        return '#ef4444';                       // Rouge pour critique
    };
    
    // ✅ Fonction pour obtenir le label selon le compteur
    const getCountLabel = (count) => {
        if (count >= 8) return 'EXTRÊME';
        if (count >= 4) return 'EXCELLENT';
        if (count >= 2) return 'BON';
        if (count === 1) return 'MAUVAIS';
        return 'CRITIQUE';
    };

    // ✅ Générer le tableau de détails avec code couleur
    const generateDetailsRows = () => {
        return hvData.map(d => {
            const heurePic = hourlyData[d.date]?.hourAtMax || '—';
            const countColor = getCountColor(d.count);
            const countLabel = getCountLabel(d.count);
            
            return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px;">${d.date}</td>
                    <td style="padding: 10px; text-align: center;">
                        <span style="display: inline-block; background: ${countColor}20; color: ${countColor}; font-weight: 600; padding: 4px 10px; border-radius: 20px;">
                            ${d.count}
                        </span>
                    </td>
                    <td style="padding: 10px; text-align: center; font-family: monospace;">${heurePic}</td>
                    <td style="padding: 10px; text-align: center;">
                        <span style="background: ${countColor}15; color: ${countColor}; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;">
                            ${countLabel}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    };

    container.innerHTML = `
        <h3 class="card-title">🔋 TENSION HAUTE (≥${seuil}V)</h3>
        
        <div class="stats-grid-5" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px;">
            <!-- EXTRÊME (≥8x) -->
            <div class="stat-card" style="background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: white;">
                <div class="stat-value" style="font-size: 1.8rem; font-weight: 700;">${stats.extreme}</div>
                <div class="stat-label" style="font-size: 0.7rem;">EXTRÊME</div>
                <div class="stat-sub" style="font-size: 0.65rem;">${pourcentages.extreme}% des jours</div>
                <div class="stat-detail" style="font-size: 0.6rem;">≥8x/jour</div>
            </div>
            
            <!-- EXCELLENT (≥4x) -->
            <div class="stat-card" style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white;">
                <div class="stat-value" style="font-size: 1.8rem; font-weight: 700;">${stats.excellent}</div>
                <div class="stat-label" style="font-size: 0.7rem;">EXCELLENT</div>
                <div class="stat-sub" style="font-size: 0.65rem;">${pourcentages.excellent}% des jours</div>
                <div class="stat-detail" style="font-size: 0.6rem;">4-7x/jour</div>
            </div>
            
            <!-- BON (2-3x) -->
            <div class="stat-card" style="background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%); color: white;">
                <div class="stat-value" style="font-size: 1.8rem; font-weight: 700;">${stats.bon}</div>
                <div class="stat-label" style="font-size: 0.7rem;">BON</div>
                <div class="stat-sub" style="font-size: 0.65rem;">${pourcentages.bon}% des jours</div>
                <div class="stat-detail" style="font-size: 0.6rem;">2-3x/jour</div>
            </div>
            
            <!-- MAUVAIS (1x) -->
            <div class="stat-card" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white;">
                <div class="stat-value" style="font-size: 1.8rem; font-weight: 700;">${stats.mauvais}</div>
                <div class="stat-label" style="font-size: 0.7rem;">MAUVAIS</div>
                <div class="stat-sub" style="font-size: 0.65rem;">${pourcentages.mauvais}% des jours</div>
                <div class="stat-detail" style="font-size: 0.6rem;">1x/jour</div>
            </div>
            
            <!-- CRITIQUE (0x) -->
            <div class="stat-card" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                <div class="stat-value" style="font-size: 1.8rem; font-weight: 700;">${stats.critique}</div>
                <div class="stat-label" style="font-size: 0.7rem;">CRITIQUE</div>
                <div class="stat-sub" style="font-size: 0.65rem;">${pourcentages.critique}% des jours</div>
                <div class="stat-detail" style="font-size: 0.6rem;">0x/jour</div>
            </div>
        </div>

        ${createDetailButton('highvoltage-details', '📋 Voir le détail des jours')}
        
        <div id="highvoltage-details" style="display:none; margin:15px 0;">
            <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                    <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 10;">
                        <tr>
                            <th style="padding: 12px 16px; text-align: left;">📅 Date</th>
                            <th style="padding: 12px 16px; text-align: center;">📊 Compteur</th>
                            <th style="padding: 12px 16px; text-align: center;">⏰ Heure du pic</th>
                            <th style="padding: 12px 16px; text-align: center;">🏷️ Niveau</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateDetailsRows()}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="chart-container" style="margin-top: 20px;">
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
    
    // ✅ Couleurs pour les points selon le compteur
    const getPointColor = (count) => {
        if (count >= 8) return '#a855f7';   // Violet
        if (count >= 4) return '#22c55e';   // Vert
        if (count >= 2) return '#eab308';   // Jaune
        if (count === 1) return '#f97316';  // Orange
        return '#ef4444';                    // Rouge
    };
    
    requestAnimationFrame(() => {
        chartManager.create('highVoltageChart', {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Dépassements par jour',
                    data: counts,
                    borderColor: '#cbd5e1',
                    backgroundColor: 'rgba(203, 213, 225, 0.1)',
                    borderWidth: 1.5,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: counts.map(c => getPointColor(c)),
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.2
                }, {
                    label: 'Seuil excellent (4x/jour)',
                    data: Array(dates.length).fill(4),
                    borderColor: '#22c55e',
                    borderWidth: 1.5,
                    borderDash: [8, 4],
                    pointRadius: 0,
                    fill: false
                }, {
                    label: 'Seuil extrême (8x/jour)',
                    data: Array(dates.length).fill(8),
                    borderColor: '#a855f7',
                    borderWidth: 1.5,
                    borderDash: [8, 4],
                    pointRadius: 0,
                    fill: false
                }]
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
                            boxWidth: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                let level = '';
                                if (value >= 8) level = '🔴 EXTRÊME';
                                else if (value >= 4) level = '🟢 EXCELLENT';
                                else if (value >= 2) level = '🟡 BON';
                                else if (value === 1) level = '🟠 MAUVAIS';
                                else level = '⚫ CRITIQUE';
                                return [`${value} dépassement(s)`, level];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#e9ecef' },
                        title: { display: true, text: 'Nombre de dépassements', font: { size: 10 } },
                        ticks: { stepSize: 1, font: { size: 9 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { maxRotation: 45, minRotation: 45, font: { size: 9 } }
                    }
                }
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
        // Par défaut : 7 derniers jours
        chartEndIndex = allDates.length - 1;
        chartStartIndex = Math.max(0, chartEndIndex - 6);
    }
    
    const norms = VOLTAGE_NORMS[database.technicalData?.normSystem || '12V'];
    const daysCount = chartEndIndex - chartStartIndex + 1;
    
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
    
    attachDateSelectors();
    updateHourlyChartData();
}

function updateHourlyChartData() {
    const labels = [];
    const tensions = [];
    const dayInfo = [];
    const dayStartPositions = [];
    
    // ✅ ÉTAPE 1 : Déterminer tous les jours de la plage
    const selectedDays = [];
    for (let i = chartStartIndex; i <= chartEndIndex; i++) {
        selectedDays.push({
            date: allDates[i],
            data: allTensionData[i]
        });
    }
    
    // ✅ ÉTAPE 2 : Pour chaque jour, créer 24 points (0h à 23h)
    selectedDays.forEach((day, dayIdx) => {
        // Créer un Map des heures disponibles
        const hourMap = new Map();
        day.data.forEach(point => {
            hourMap.set(point.hour, point.tension);
        });
        
        // Parcourir les 24 heures
        for (let h = 0; h < 24; h++) {
            const hourStr = `${h.toString().padStart(2, '0')}:00`;
            const tension = hourMap.get(hourStr);
            
            labels.push(hourStr);
            tensions.push(tension !== undefined ? tension : null); // null si donnée manquante
            dayInfo.push({ 
                date: day.date, 
                hour: hourStr, 
                dayIndex: chartStartIndex + dayIdx,
                hasData: tension !== undefined
            });
            
            // Enregistrer la position du premier point de chaque jour
            if (h === 0) {
                dayStartPositions.push({
                    date: day.date,
                    position: labels.length - 1
                });
            }
        }
    });
    
    const norms = VOLTAGE_NORMS[database.technicalData?.normSystem || '12V'];
    
    // ✅ ÉTAPE 3 : Calculer la marge sur les valeurs existantes (ignorer null)
    const validTensions = tensions.filter(t => t !== null);
    const minTension = Math.min(...validTensions);
    const maxTension = Math.max(...validTensions);
    const padding = (maxTension - minTension) * 0.1;
    
    // Plugin pour colorer le fond des jours et ajouter les labels de dates
    const dayBackgroundPlugin = {
        id: 'dayBackground',
        beforeDatasetsDraw(chart) {
            const { ctx, chartArea, scales, data } = chart;
            if (!scales.x || !data.labels.length) return;
            
            const labels = data.labels;
            let currentDay = '';
            let dayStartIndex = 0;
            const daySegments = [];
            
            // Détecter les changements de jour (tous les 24 points)
            for (let i = 0; i < labels.length; i += 24) {
                const dayIdx = Math.floor(i / 24);
                if (dayIdx < selectedDays.length) {
                    const dayKey = selectedDays[dayIdx].date;
                    const startX = scales.x.getPixelForValue(i);
                    const endX = (i + 24 < labels.length) 
                        ? scales.x.getPixelForValue(i + 23.5)
                        : chartArea.right;
                    
                    if (startX && endX) {
                        daySegments.push({ day: dayKey, startX, endX, index: dayIdx });
                    }
                }
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
        },
        afterDatasetsDraw(chart) {
            // Ajouter les labels de dates en bas du graphique
            const { ctx, chartArea, scales } = chart;
            if (!scales.x) return;
            
            ctx.save();
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#495057';
            ctx.textAlign = 'center';
            
            dayStartPositions.forEach(pos => {
                const x = scales.x.getPixelForValue(pos.position);
                if (x >= chartArea.left && x <= chartArea.right) {
                    const [year, month, day] = pos.date.split('-');
                    const dateLabel = `${day}/${month}`;
                    ctx.fillText(dateLabel, x, chartArea.bottom + 18);
                }
            });
            ctx.restore();
        }
    };
    
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
                    fill: false,
                    spanGaps: true  // ✅ Permet de connecter les points même avec des null
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
                                const hasData = dayInfo[idx].hasData;
                                const dataStatus = hasData ? '' : ' (donnée manquante)';
                                return `${dayInfo[idx].date} ${dayInfo[idx].hour}${dataStatus}`;
                            }
                            return labels[idx];
                        },
                        label: (ctx) => {
                            if (ctx.raw === null) return 'Donnée non disponible';
                            return `${ctx.raw.toFixed(1)} V`;
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            layout: {
                padding: {
                    bottom: 25
                }
            },
            scales: {
                y: {
                    suggestedMin: minTension - padding,
                    suggestedMax: maxTension + padding,
                    grid: { color: '#e9ecef' },
                    title: { 
                        display: true, 
                        text: 'Tension (V)', 
                        font: { size: 10, weight: 'normal' },
                        color: '#6c757d'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        callback: (val, idx) => {
                            const hour = labels[idx];
                            // Afficher toutes les 6 heures (0h, 6h, 12h, 18h)
                            if (hour && (hour === '00:00' || hour === '06:00' || hour === '12:00' || hour === '18:00')) {
                                return hour;
                            }
                            return '';
                        },
                        autoSkip: true,
                        maxTicksLimit: 8,
                        font: { size: 9 },
                        color: '#6c757d'
                    }
                }
            }
        },
        plugins: [dayBackgroundPlugin]
    };
    
    // Nettoyer l'instance existante avant d'en créer une nouvelle
    if (chartManager.instances['hourlyTensionChart']) {
        chartManager.destroy('hourlyTensionChart');
    }
    
    requestAnimationFrame(() => {
        const canvas = document.getElementById('hourlyTensionChart');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                chartManager.create('hourlyTensionChart', config);
            }
        }
    });
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

// ===========================================
// III) ÉNERGIE - CLIENT ANALYTICS (UI/UX CORRIGÉE)
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
        this.processData();
    }
    
    processData() {
        if (!this.rawData?.data) return;
        const dailyMap = new Map(), siteMap = new Map(), clientSet = new Set();
        
        this.rawData.data.forEach(point => {
            if (!point.timestamp || !point.energie || !point.clientId) return;
            const date = point.date, clientId = point.clientId, energie = point.energie;
            
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
    
    calculatePercentile(values, p) {
        if (!values.length) return 0;
        const sorted = [...values].sort((a,b) => a-b);
        return sorted[Math.min(Math.ceil(p/100 * sorted.length) - 1, sorted.length - 1)];
    }
    
    calculateSiteStats() {
        const values = this.processedDates.map(d => this.siteDaily[d] || 0).filter(v=>v>0);
        this.siteStatistics = {
            average: values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0,
            maximum: Math.max(...this.processedDates.map(d=>this.siteDaily[d]||0), 0),
            percentile95: this.calculatePercentile(values, 95),
            activeDays: values.length,
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
    
    // ✅ NOUVELLE MÉTHODE : obtenir la répartition par client pour une date donnée
    getClientBreakdownForDate(date) {
        const breakdown = {};
        this.processedClients.forEach(clientId => {
            const value = this.clientDaily[date]?.[clientId] || 0;
            if (value > 0) {
                breakdown[clientId] = value;
            }
        });
        const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
        return { total, clients: breakdown };
    }
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
    
    const dailyValues = profile.history.map(d => d.consumption);
    const totalJours = dailyValues.length;
    
    const tousLesSeuils = [
        { id: 0, label: 'Kit 0', max: 250, color: '#94a3b8', description: 'Très basse consommation' },
        { id: 1, label: 'Kit 1', max: 360, color: '#22c55e', description: 'Consommation faible' },
        { id: 2, label: 'Kit 2', max: 540, color: '#eab308', description: 'Consommation modérée' },
        { id: 3, label: 'Kit 3', max: 720, color: '#f97316', description: 'Consommation élevée' },
        { id: 4, label: 'Kit 4', max: 1080, color: '#ef4444', description: 'Très haute consommation' }
    ];
    
    // Calculer les pourcentages cumulés
    const cumulative = [];
    let stopIndex = tousLesSeuils.length;
    
    for (let i = 0; i < tousLesSeuils.length; i++) {
        const seuil = tousLesSeuils[i];
        const joursCouverts = dailyValues.filter(v => v <= seuil.max).length;
        const pourcentage = (joursCouverts / totalJours) * 100;
        
        cumulative.push({
            ...seuil,
            jours: joursCouverts,
            percentage: pourcentage
        });
        
        if (pourcentage >= 99.9 && stopIndex === tousLesSeuils.length) {
            stopIndex = i + 1;
        }
    }
    
    const visibleSeuils = cumulative.slice(0, stopIndex);
    const lastKit = visibleSeuils[visibleSeuils.length - 1];
    const isComplete = lastKit && lastKit.percentage >= 99.9;
    
    // ✅ Barre de progression cumulative
    const renderCumulativeBar = () => {
        let cumulativePercent = 0;
        return visibleSeuils.map(kit => {
            cumulativePercent = kit.percentage;
            const isLast = kit.id === visibleSeuils[visibleSeuils.length - 1].id;
            
            return `
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="display: inline-block; width: 10px; height: 10px; background: ${kit.color}; border-radius: 2px;"></span>
                            <span style="font-size: 0.7rem; font-weight: 500;">${kit.label}</span>
                            <span style="font-size: 0.65rem; color: #6c757d;">(≤${kit.max}Wh)</span>
                        </div>
                        <span style="font-size: 0.7rem; font-weight: 600; color: ${kit.color};">${kit.percentage.toFixed(1)}%</span>
                    </div>
                    <div style="background: #e9ecef; border-radius: 20px; height: 8px; overflow: hidden;">
                        <div style="width: ${cumulativePercent}%; height: 100%; background: ${kit.color}; border-radius: 20px;"></div>
                    </div>
                    <div style="font-size: 0.6rem; color: #6c757d; margin-top: 2px;">
                        ${kit.jours} jours (cumulé)
                    </div>
                </div>
            `;
        }).join('');
    };
    
    const renderBars = () => {
        return visibleSeuils.map(kit => {
            const percent = kit.percentage;
            const isLast = kit.id === visibleSeuils[visibleSeuils.length - 1].id;
            const showLabel = percent > 12;
            
            return `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <span style="display: inline-block; width: 12px; height: 12px; background: ${kit.color}; border-radius: 2px;"></span>
                        <span style="font-weight: 500;">${kit.label} (≤${kit.max}Wh)</span>
                        <span style="margin-left: auto; font-size: 0.75rem; font-weight: 600; color: ${kit.color};">${percent.toFixed(1)}%</span>
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
                    ${isLast && !isComplete ? `
                        <div style="margin-top: 8px; padding: 6px 10px; background: #fef3c7; border-radius: 8px; font-size: 0.7rem; color: #92400e;">
                            ⚠️ ${(100 - percent).toFixed(1)}% des jours dépassent ce kit
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    };
    
    container.innerHTML = `
        <div class="card" style="padding:0;">
            <div style="padding:20px 24px; border-bottom:1px solid #e9ecef;">
                <h3 style="margin:0; display: flex; align-items: center; gap: 8px;">
                    <span>🏭</span>
                    CONSOMMATION TOTALE
                </h3>
            </div>
            
            <div style="padding:24px;">
                <div style="height:320px;">
                    <canvas id="clientTrendChart"></canvas>
                </div>
            </div>
            
            <div style="padding:12px 24px; background:#f8f9fa; border-bottom:1px solid #e9ecef; display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
                ${visibleSeuils.map(kit => `
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="width: 12px; height: 12px; background: ${kit.color}; border-radius: 2px;"></span>
                        <span style="font-size: 0.7rem;">${kit.label}</span>
                    </div>
                `).join('')}
                ${stopIndex < tousLesSeuils.length ? `
                    <div style="display: flex; align-items: center; gap: 6px; opacity: 0.5;">
                        <span style="width: 12px; height: 12px; background: #cbd5e1; border-radius: 2px;"></span>
                        <span style="font-size: 0.7rem;">Kit ${stopIndex}+ (100% atteint)</span>
                    </div>
                ` : ''}
            </div>
            
            <!-- ✅ Barre de progression cumulative -->
            <div style="padding:16px 24px; background:#ffffff; border-bottom:1px solid #e9ecef;">
                <h4 style="margin:0 0 12px 0; font-size:0.8rem; font-weight:600;">📊 COUVERTURE CUMULÉE PAR KIT</h4>
                ${renderCumulativeBar()}
            </div>
            
            ${createDetailButton('clientDetailTable', '📋 Voir le détail par client')}
            
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
                            ${clientAnalyticsInstance.processedDates.map((date, idx) => {
                                let rowTotal = 0;
                                const isEven = idx % 2 === 0;
                                return `
                                    <tr style="background: ${isEven ? '#ffffff' : '#f8f9fa'};">
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
    const dailyValues = profile.history.map(d => d.consumption);
    const totalJours = dailyValues.length;
    
    const tousLesKits = [
        { label: 'Kit 0 (250Wh)', value: 250, color: '#94a3b8' },
        { label: 'Kit 1 (360Wh)', value: 360, color: '#22c55e' },
        { label: 'Kit 2 (540Wh)', value: 540, color: '#eab308' },
        { label: 'Kit 3 (720Wh)', value: 720, color: '#f97316' },
        { label: 'Kit 4 (1080Wh)', value: 1080, color: '#ef4444' }
    ];
    
    // Trouver le premier kit qui atteint 100%
    let stopIndex = tousLesKits.length;
    for (let i = 0; i < tousLesKits.length; i++) {
        const kit = tousLesKits[i];
        const joursCouverts = dailyValues.filter(v => v <= kit.value).length;
        const pourcentage = (joursCouverts / totalJours) * 100;
        if (pourcentage >= 99.9 && stopIndex === tousLesKits.length) {
            stopIndex = i + 1;
        }
    }
    
    const visibleKits = tousLesKits.slice(0, stopIndex);
    
    const kitDatasets = visibleKits.map(kit => ({
        label: kit.label,
        data: Array(dates.length).fill(kit.value),
        borderColor: kit.color,
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        order: 2
    }));
    
    chartManager.destroy('clientTrendChart');
    
    requestAnimationFrame(() => {
        chartManager.create('clientTrendChart', {
            type: 'line',
            data: {
                labels: dates.map(d => {
                    const date = new Date(d);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                }),
                datasets: [
                    {
                        label: 'Consommation',
                        data: profile.history.map(d => d.consumption),
                        borderColor: '#1e293b',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        borderWidth: 2.5,
                        tension: 0.2,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: (ctx) => {
                            const value = ctx.raw;
                            if (value <= 250) return '#94a3b8';
                            if (value <= 360) return '#22c55e';
                            if (value <= 540) return '#eab308';
                            if (value <= 720) return '#f97316';
                            if (value <= 1080) return '#ef4444';
                            return '#dc2626';
                        },
                        pointBorderColor: '#fff',
                        pointBorderWidth: 1.5,
                        fill: false,
                        order: 1
                    },
                    ...kitDatasets
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
                            filter: (item) => item.text !== 'Consommation'
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            title: (items) => {
                                const date = dates[items[0].dataIndex];
                                return new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                            },
                            label: (context) => {
                                if (context.dataset.label === 'Consommation') {
                                    const value = context.raw;
                                    const idx = context.dataIndex;
                                    const date = dates[idx];
                                    
                                    // ✅ Récupérer la répartition par client
                                    const breakdown = clientAnalyticsInstance.getClientBreakdownForDate(date);
                                    
                                    let kit = '';
                                    if (value <= 250) kit = 'Kit 0';
                                    else if (value <= 360) kit = 'Kit 1';
                                    else if (value <= 540) kit = 'Kit 2';
                                    else if (value <= 720) kit = 'Kit 3';
                                    else if (value <= 1080) kit = 'Kit 4';
                                    else kit = '> Kit 4';
                                    
                                    const lines = [`📊 Total: ${value.toFixed(0)} Wh`, `🎯 ${kit}`];
                                    
                                    if (breakdown.total > 0 && Object.keys(breakdown.clients).length > 0) {
                                        lines.push(`──────────────`);
                                        const sortedClients = Object.entries(breakdown.clients)
                                            .sort((a, b) => b[1] - a[1]);
                                        
                                        sortedClients.forEach(([clientId, val]) => {
                                            const percent = (val / breakdown.total * 100).toFixed(1);
                                            lines.push(`  Client ${clientId}: ${val.toFixed(0)} Wh (${percent}%)`);
                                        });
                                    }
                                    
                                    return lines;
                                }
                                return null;
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

export function destroyClientBoard() { 
    chartManager.destroy('clientTrendChart'); 
    clientAnalyticsInstance = null; 
}
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
        const { labels, hourlyValues } = this.getChartData();
        const averages = [];
        const avgLabels = [];
        const avgDayInfo = [];
        
        for (let i = 0; i < hourlyValues.length; i++) {
            averages.push(hourlyValues[i]);
            avgLabels.push(labels[i]);
            
            const [date, hour] = labels[i].split(' ');
            avgDayInfo.push({ date, hour, average: hourlyValues[i] });
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
            day: { avg: dayTotal / count, percent: total ? (dayTotal / (total*12)) * 100 : 0 }, 
            night: { avg: nightTotal / count, percent: total ? (nightTotal / (total*12)) * 100 : 0 } 
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
// FONCTION POUR OBTENIR LA RÉPARTITION PAR CLIENT
// ===========================================

function getClientBreakdownAtDateTime(dateTimeStr) {
    const [date, hourStr] = dateTimeStr.split(' ');
    const hour = parseInt(hourStr.replace('h', ''));
    
    const energyData = database.energyData;
    if (!energyData?.data) return null;
    
    // Récupérer tous les points pour cette date et cette heure
    const points = energyData.data.filter(point => {
        if (!point.timestamp) return false;
        const pointDate = point.timestamp.split(' ')[0];
        const pointHour = parseInt(point.timestamp.split(' ')[1]?.substring(0, 2));
        return pointDate === date && pointHour === hour;
    });
    
    if (points.length === 0) return null;
    
    // Regrouper par client
    const clientBreakdown = {};
    points.forEach(point => {
        const clientId = point.clientId;
        const energie = point.energie || 0;
        clientBreakdown[clientId] = (clientBreakdown[clientId] || 0) + energie;
    });
    
    return {
        total: points.reduce((sum, p) => sum + (p.energie || 0), 0),
        clients: clientBreakdown
    };
}

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
    
    // Générer un ID unique pour le contenu à cacher
    const chartContentId = `cycle-chart-content-${Date.now()}`;
    
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
            
            <!-- Section CONSOMMATION CUMULÉE avec bouton toggle -->
            <div class="cycle-chart-section" style="padding:24px 24px 0 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; cursor: pointer;" onclick="toggleCycleChart('${chartContentId}', this)">
                    <h4 style="margin:0; font-size:0.85rem; font-weight:600; display: flex; align-items: center; gap: 8px;">
                        <span>📈</span>
                        CONSOMMATION CUMULÉE
                    </h4>
                    <span class="cycle-chart-toggle" style="font-size: 1rem; transition: transform 0.2s;">▶</span>
                </div>
                <div id="${chartContentId}" style="display: none;">
                    <div style="height:300px;">
                        <canvas id="dailyEnergyCycleChart"></canvas>
                    </div>
                </div>
            </div>
            
            <div class="cycle-chart-section" style="padding:24px;">
                <h4 style="margin:0 0 16px 0; font-size:0.85rem; font-weight:600;">📊 MOYENNES HORAIRES</h4>
                <div style="height:220px;">
                    <canvas id="hourlyAverageChart"></canvas>
                </div>
            </div>
            
            <div class="cycle-stats" style="padding:16px 24px; background:#f8f9fa; border-top:1px solid #e9ecef;">
                <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:16px;">
                    <div style="text-align:center;">
                        <div style="font-size:0.7rem; color:#6c757d;">MOYENNE HORAIRE</div>
                        <div style="font-size:1.4rem; font-weight:700; color:#3b82f6;">${averageStats.avg.toFixed(1)} <span style="font-size:0.8rem;">Wh/h</span></div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.7rem; color:#6c757d;">MAXIMUM HORAIRE</div>
                        <div style="font-size:1.4rem; font-weight:700; color:#f59e0b;">${averageStats.max.toFixed(1)} <span style="font-size:0.8rem;">Wh/h</span></div>
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
                                <div style="font-size:0.7rem; color:#f59e0b; font-weight:600;">JOUR (6h-18h)</div>
                                <div style="font-size:1.4rem; font-weight:700; color:#f59e0b;">${dayNightAverages.day.toFixed(1)} <span style="font-size:0.8rem;">Wh/h</span></div>
                                <div style="font-size:0.7rem; color:#6c757d;">moyenne horaire</div>
                            </div>
                        </div>
                    </div>
                    <div style="background:linear-gradient(135deg, #e8f0fe, #f0f4ff); border-radius:16px; padding:16px; border-left:4px solid #3b82f6;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span style="font-size:2rem;">🌙</span>
                            <div>
                                <div style="font-size:0.7rem; color:#3b82f6; font-weight:600;">NUIT (18h-6h)</div>
                                <div style="font-size:1.4rem; font-weight:700; color:#3b82f6;">${dayNightAverages.night.toFixed(1)} <span style="font-size:0.8rem;">Wh/h</span></div>
                                <div style="font-size:0.7rem; color:#6c757d;">moyenne horaire</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ✅ Fonction globale pour toggler le graphique
window.toggleCycleChart = function(contentId, headerElement) {
    const content = document.getElementById(contentId);
    const toggleIcon = headerElement.querySelector('.cycle-chart-toggle');
    
    if (content) {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            if (toggleIcon) {
                toggleIcon.style.transform = 'rotate(90deg)';
                toggleIcon.innerHTML = '▼';
            }
        } else {
            content.style.display = 'none';
            if (toggleIcon) {
                toggleIcon.style.transform = 'rotate(0deg)';
                toggleIcon.innerHTML = '▶';
            }
        }
    }
};

function updateCycleChart() {
    if (!currentManager) return;
    const data = currentManager.getChartData();
    const ctx = document.getElementById('dailyEnergyCycleChart')?.getContext('2d');
    if (!ctx) return;
    
    const dayInfo = [];
    const dayStartPositions = [];
    
    // Enrichir dayInfo avec les positions des débuts de jour
    data.labels.forEach((label, idx) => {
        const [date, hour] = label.split(' ');
        dayInfo.push({ date, hour, index: idx });
        
        // Détecter le début de chaque jour (00:00)
        if (hour === '00:00') {
            dayStartPositions.push({
                date: date,
                position: idx
            });
        }
    });
    
    // Plugin pour afficher les dates en bas
    const dateLabelPlugin = {
        id: 'dateLabels',
        afterDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            if (!scales.x) return;
            
            ctx.save();
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#495057';
            ctx.textAlign = 'center';
            
            dayStartPositions.forEach(pos => {
                const x = scales.x.getPixelForValue(pos.position);
                if (x >= chartArea.left && x <= chartArea.right) {
                    const [year, month, day] = pos.date.split('-');
                    const dateLabel = `${day}/${month}`;
                    ctx.fillText(dateLabel, x, chartArea.bottom + 20);
                }
            });
            ctx.restore();
        }
    };
    
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
                pointHoverRadius: 6,
                pointBackgroundColor: UNIFIED_STYLE.colors.primary,
                fill: true,
                tension: 0.2
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: {
                padding: {
                    bottom: 30
                }
            },
            plugins: {
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
                        label: (ctx) => {
                            const idx = ctx.dataIndex;
                            const label = data.labels[idx];
                            const total = ctx.raw;
                            
                            // Récupérer la répartition par client
                            const breakdown = getClientBreakdownAtDateTime(label);
                            
                            if (breakdown && Object.keys(breakdown.clients).length > 0) {
                                const clientLines = Object.entries(breakdown.clients)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([clientId, value]) => {
                                        const percent = (value / breakdown.total * 100).toFixed(1);
                                        return `  Client ${clientId}: ${value.toFixed(0)} Wh (${percent}%)`;
                                    });
                                
                                return [
                                    `Total: ${total.toFixed(0)} Wh`,
                                    `──────────────`,
                                    ...clientLines
                                ];
                            }
                            
                            return `${total.toFixed(0)} Wh`;
                        }
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
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 12,
                        callback: (val, idx) => {
                            const label = data.labels[idx];
                            if (label && label.includes(' ')) {
                                const [, hour] = label.split(' ');
                                if (hour === '00:00' || hour === '06:00' || hour === '12:00' || hour === '18:00') {
                                    return hour;
                                }
                            }
                            return '';
                        },
                        font: { size: 9 },
                        color: '#6c757d'
                    }
                }
            } 
        },
        plugins: [dayBackgroundPlugin, dateLabelPlugin]
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
    
    const dayStartPositions = [];
    
    // Détecter les débuts de jour (premier point de chaque jour)
    let currentDate = '';
    labels.forEach((label, idx) => {
        const [date, hour] = label.split(' ');
        if (date !== currentDate) {
            currentDate = date;
            dayStartPositions.push({
                date: date,
                position: idx
            });
        }
    });
    
    // Plugin pour afficher les dates en bas
    const dateLabelPlugin = {
        id: 'dateLabels',
        afterDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            if (!scales.x) return;
            
            ctx.save();
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#495057';
            ctx.textAlign = 'center';
            
            dayStartPositions.forEach(pos => {
                const x = scales.x.getPixelForValue(pos.position);
                if (x >= chartArea.left && x <= chartArea.right) {
                    const [year, month, day] = pos.date.split('-');
                    const dateLabel = `${day}/${month}`;
                    ctx.fillText(dateLabel, x, chartArea.bottom + 20);
                }
            });
            ctx.restore();
        }
    };
    
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
                    label: 'Moyenne horaire (Wh/h)',
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
                layout: {
                    padding: {
                        bottom: 30
                    }
                },
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
                                return `${value.toFixed(1)} Wh/h`;
                            }
                        }
                    },
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        title: { display: true, text: 'Moyenne (Wh/h)', font: { size: 10 } },
                        grid: { color: UNIFIED_STYLE.colors.grid }
                    },
                    x: {
                        title: { display: true, text: 'Heure', font: { size: 10 } },
                        ticks: { 
                            maxRotation: 0,
                            autoSkip: true, 
                            maxTicksLimit: 12,
                            callback: (val, idx) => {
                                const hour = labels[idx]?.split(' ')[1];
                                if (hour === '00:00' || hour === '03:00' || hour === '06:00' || hour === '09:00' || 
                                    hour === '12:00' || hour === '15:00' || hour === '18:00' || hour === '21:00') {
                                    return hour;
                                }
                                return '';
                            },
                            font: { size: 9 }
                        }
                    }
                }
            },
            plugins: [dayBackgroundBarPlugin, dateLabelPlugin]
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
                            <div style="font-size:1.4rem; font-weight:700; color:#3b82f6;">${averageStats.avg.toFixed(1)} <span style="font-size:0.8rem;">Wh/h</span></div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:0.7rem; color:#6c757d;">MAX HORAIRE</div>
                            <div style="font-size:1.4rem; font-weight:700; color:#f59e0b;">${averageStats.max.toFixed(1)} <span style="font-size:0.8rem;">Wh/h</span></div>
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
                                    <div style="font-size:1.4rem; font-weight:700; color:#f59e0b;">${dayNightAverages.day.toFixed(1)} <span style="font-size:0.8rem;">Wh/h</span></div>
                                    <div style="font-size:0.7rem; color:#6c757d;">moyenne horaire</div>
                                </div>
                            </div>
                        </div>
                        <div style="background:linear-gradient(135deg, #e8f0fe, #f0f4ff); border-radius:16px; padding:16px; border-left:4px solid #3b82f6;">
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span style="font-size:2rem;">🌙</span>
                                <div>
                                    <div style="font-size:0.7rem; color:#3b82f6; font-weight:600;">NUIT (18h-5h)</div>
                                    <div style="font-size:1.4rem; font-weight:700; color:#3b82f6;">${dayNightAverages.night.toFixed(1)} <span style="font-size:0.8rem;">Wh/h</span></div>
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