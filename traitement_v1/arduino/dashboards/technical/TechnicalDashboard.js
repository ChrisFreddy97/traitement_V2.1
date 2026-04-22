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
        
        <div id="infoCard" class="card"></div>

        <div class="section-title"><h2>📊 ANALYSE GÉNÉRALE DE LA TENSION</h2></div>
        <div id="conformityContainer" class="card"></div>
        <div id="dailyChartCard" class="card"></div>
        <div id="hourlyChartCard" class="card"></div>
        <div id="highVoltageBoard" class="card"></div>
        <div id="normsCard" class="card"></div>
        <div id="loadSheddingBoard" class="card"></div>

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
// FILTRE - STYLE MODERNE
// ===========================================

export function renderFilterPanel() {
    const currentFilter = getCurrentFilter();
    const availableDates = getAvailableDates();
    const dateOptions = availableDates.map(date => {
        const formatted = new Date(date).toLocaleDateString('fr-FR');
        return `<option value="${date}" ${currentFilter.startDate && new Date(currentFilter.startDate).toDateString() === new Date(date).toDateString() ? 'selected' : ''}>${formatted}</option>`;
    }).join('');
    
    const years = getAvailableYears();
    
    return `
        <div style="background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <!-- En-tête avec toggle -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="window.toggleFilterPanelModern()">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 18px;">🎯</span>
                    <span style="font-weight: 600;">Filtrer les données</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span id="filterActiveBadge" style="display: ${hasActiveFilter(currentFilter) ? 'inline-flex' : 'none'}; background: #ef4444; color: white; padding: 2px 8px; border-radius: 20px; font-size: 10px;">Filtre actif</span>
                    <span id="filterToggleIcon" style="font-size: 1rem; transition: transform 0.2s;">▼</span>
                </div>
            </div>
            
            <!-- Contenu du filtre -->
            <div id="filterContentModern" style="display: block; padding: 20px;">
                <!-- Résumé du filtre actif -->
                <div id="filterSummary" style="background: #f8fafc; padding: 10px 15px; border-radius: 10px; margin-bottom: 20px; font-size: 13px; color: #475569; border-left: 4px solid #f59e0b;">
                    ${getFilterSummaryText(currentFilter)}
                </div>

                <!-- Grille des filtres -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                    
                    <!-- Section Période rapide -->
                    <div style="background: #f8fafc; border-radius: 12px; padding: 15px; border: 1px solid #e2e8f0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <span style="font-size: 16px;">⚡</span>
                            <span style="font-weight: 600; font-size: 13px; color: #1e293b;">Période rapide</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                            <button class="filter-chip" data-period="7days" onclick="window.applyFilterPeriod('7days')" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${currentFilter.period === '7days' ? '#f59e0b' : 'white'}; color: ${currentFilter.period === '7days' ? 'white' : '#1e293b'}; font-size: 11px; cursor: pointer; transition: all 0.2s;">7jours</button>
                            <button class="filter-chip" data-period="15days" onclick="window.applyFilterPeriod('15days')" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${currentFilter.period === '15days' ? '#f59e0b' : 'white'}; color: ${currentFilter.period === '15days' ? 'white' : '#1e293b'}; font-size: 11px; cursor: pointer;">15jours</button>
                            <button class="filter-chip" data-period="30days" onclick="window.applyFilterPeriod('30days')" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${currentFilter.period === '30days' ? '#f59e0b' : 'white'}; color: ${currentFilter.period === '30days' ? 'white' : '#1e293b'}; font-size: 11px; cursor: pointer;">30jours</button>
                            <button class="filter-chip" data-period="2months" onclick="window.applyFilterPeriod('2months')" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${currentFilter.period === '2months' ? '#f59e0b' : 'white'}; color: ${currentFilter.period === '2months' ? 'white' : '#1e293b'}; font-size: 11px; cursor: pointer;">2mois</button>
                            <button class="filter-chip" data-period="3months" onclick="window.applyFilterPeriod('3months')" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${currentFilter.period === '3months' ? '#f59e0b' : 'white'}; color: ${currentFilter.period === '3months' ? 'white' : '#1e293b'}; font-size: 11px; cursor: pointer;">3mois</button>
                            <button class="filter-chip" data-period="6months" onclick="window.applyFilterPeriod('6months')" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${currentFilter.period === '6months' ? '#f59e0b' : 'white'}; color: ${currentFilter.period === '6months' ? 'white' : '#1e293b'}; font-size: 11px; cursor: pointer;">6mois</button>
                            <button class="filter-chip" data-period="1year" onclick="window.applyFilterPeriod('1year')" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${currentFilter.period === '1year' ? '#f59e0b' : 'white'}; color: ${currentFilter.period === '1year' ? 'white' : '#1e293b'}; font-size: 11px; cursor: pointer;">1année</button>
                            <button class="filter-chip" data-period="all" onclick="window.applyFilterPeriod('all')" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: ${currentFilter.period === 'all' ? '#f59e0b' : 'white'}; color: ${currentFilter.period === 'all' ? 'white' : '#1e293b'}; font-size: 11px; cursor: pointer;">Tout</button>
                        </div>
                    </div>
                    
                    <!-- Section Mois spécifique -->
                    <div style="background: #f8fafc; border-radius: 12px; padding: 15px; border: 1px solid #e2e8f0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <span style="font-size: 16px;">📅</span>
                            <span style="font-weight: 600; font-size: 13px; color: #1e293b;">Mois spécifique</span>
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <select id="filterMonthSelect" style="flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; background: white;">
                                <option value="">Mois</option>
                                ${['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((m, i) => `<option value="${i+1}" ${currentFilter.month === i+1 ? 'selected' : ''}>${m}</option>`).join('')}
                            </select>
                            <select id="filterYearSelect" style="flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; background: white;">
                                <option value="">Année</option>
                                ${years.map(y => `<option value="${y}" ${currentFilter.year === y ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                            <button class="filter-btn-primary" onclick="window.applyFilterMonthYear()" style="padding: 8px 16px; background: #f59e0b; border: none; border-radius: 8px; color: white; font-size: 12px; cursor: pointer;">▶ Appliquer</button>
                        </div>
                    </div>
                    
                    <!-- Section Dates personnalisées -->
                    <div style="background: #f8fafc; border-radius: 12px; padding: 15px; border: 1px solid #e2e8f0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <span style="font-size: 16px;">📆</span>
                            <span style="font-weight: 600; font-size: 13px; color: #1e293b;">Dates personnalisées</span>
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                            <select id="filterStartDateSelect" style="flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; background: white;">
                                <option value="">Du</option>
                                ${dateOptions}
                            </select>
                            <span style="color: #64748b;">→</span>
                            <select id="filterEndDateSelect" style="flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; background: white;">
                                <option value="">Au</option>
                                ${dateOptions}
                            </select>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 12px;">
                            <button class="filter-btn-primary" onclick="window.applyFilterCustomDates()" style="flex: 1; padding: 8px; background: #f59e0b; border: none; border-radius: 8px; color: white; font-size: 12px; cursor: pointer;">✓ Appliquer</button>
                            <button class="filter-btn-secondary" onclick="window.clearFilter()" style="flex: 1; padding: 8px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; color: #475569; font-size: 12px; cursor: pointer;">⟳ Réinitialiser</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Fonction globale pour toggler le panneau de filtre
window.toggleFilterPanelModern = function() {
    const content = document.getElementById('filterContentModern');
    const toggleIcon = document.getElementById('filterToggleIcon');
    if (content && toggleIcon) {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggleIcon.style.transform = 'rotate(0deg)';
            toggleIcon.textContent = '▼';
        } else {
            content.style.display = 'none';
            toggleIcon.style.transform = 'rotate(-90deg)';
            toggleIcon.textContent = '▶';
        }
    }
};

// Remplacer l'ancienne fonction toggleFilterPanel
window.toggleFilterPanel = window.toggleFilterPanelModern;

// Mettre à jour refreshFilterUI pour le nouveau style
const originalRefreshFilterUI = window.refreshFilterUI;

window.refreshFilterUI = function() {
    if (originalRefreshFilterUI) originalRefreshFilterUI();
    
    setTimeout(() => {
        const filter = getCurrentFilter();
        
        // Mettre à jour le badge
        const badge = document.getElementById('filterActiveBadge');
        if (badge) {
            badge.style.display = hasActiveFilter(filter) ? 'inline-flex' : 'none';
        }
        
        // Mettre à jour le résumé
        const summary = document.getElementById('filterSummary');
        if (summary) {
            summary.innerHTML = getFilterSummaryText(filter);
        }
        
        // Mettre à jour les styles des boutons période
        document.querySelectorAll('.filter-chip[data-period]').forEach(btn => {
            const period = btn.getAttribute('data-period');
            if (filter.period === period) {
                btn.style.background = '#f59e0b';
                btn.style.color = 'white';
                btn.style.borderColor = '#f59e0b';
            } else {
                btn.style.background = 'white';
                btn.style.color = '#1e293b';
                btn.style.borderColor = '#e2e8f0';
            }
        });
        
        // Mettre à jour les selects
        const monthSelect = document.getElementById('filterMonthSelect');
        const yearSelect = document.getElementById('filterYearSelect');
        const startSelect = document.getElementById('filterStartDateSelect');
        const endSelect = document.getElementById('filterEndDateSelect');
        
        if (monthSelect) monthSelect.value = filter.month || '';
        if (yearSelect) yearSelect.value = filter.year || '';
        if (startSelect && filter.startDate) startSelect.value = new Date(filter.startDate).toISOString().split('T')[0];
        if (endSelect && filter.endDate) endSelect.value = new Date(filter.endDate).toISOString().split('T')[0];
    }, 50);
};

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
// I) INFO CARD - MODIFIÉ POUR ÊTRE IDENTIQUE AU CODE 1
// ===========================================

function renderInfoCard() {
    const container = document.getElementById('infoCard');
    if (!container) return;
    
    const existingCard = document.getElementById('technical-data-card');
    if (existingCard) existingCard.remove();
    
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
        const startDate = chartData.dates[0];
        const endDate = chartData.dates[chartData.dates.length - 1];
        actualDateRange = `${formatFrenchDate(startDate)} → ${formatFrenchDate(endDate)}`;
    }
    
    const normSystem = data.normSystem || '12V';
    const norms = VOLTAGE_NORMS[normSystem];
    
    let tensionColor = 'white';
    let tensionStatusIcon = '✅';
    let tensionStatusText = 'Normal';
    
    if (data.globalAvg) {
        if (data.globalAvg >= norms.min && data.globalAvg <= norms.max) {
            tensionColor = '#22c55e';
            tensionStatusIcon = '✅';
            tensionStatusText = 'Normal';
        } else if (data.globalAvg < norms.min) {
            tensionColor = '#ef4444';
            tensionStatusIcon = '⚠️';
            tensionStatusText = 'Sous-tension';
        } else {
            tensionColor = '#f59e0b';
            tensionStatusIcon = '⚠️';
            tensionStatusText = 'Surtension';
        }
    }
    
    const isMinOutOfLimit = data.globalMin < norms.min;
    const isMaxOutOfLimit = data.globalMax > norms.max;
    
    const card = document.createElement('div');
    card.id = 'technical-data-card';
    card.style.cssText = `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden; animation: fadeIn 0.5s ease; color: white; margin-bottom: 20px;`;
    
    const cardHeader = document.createElement('div');
    cardHeader.style.cssText = `background: rgba(255, 255, 255, 0.15); color: white; padding: 15px 25px; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px; backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255, 255, 255, 0.2);`;
    cardHeader.innerHTML = `👥 DONNÉES TECHNIQUES DU DOSSIER`;
    card.appendChild(cardHeader);
    
    const statsHeader = document.createElement('div');
    statsHeader.style.cssText = `display: flex; align-items: center; gap: 30px; padding: 20px 25px 10px 25px; color: white; border-bottom: 1px solid rgba(255, 255, 255, 0.15);`;
    statsHeader.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 22px;">📅</span><span style="font-size: 16px; font-weight: 600;">${data.daysCount || 0} jour${data.daysCount !== 1 ? 's' : ''}</span></div>
        <div style="display: flex; align-items: center; gap: 10px;"><span style="font-size: 22px;">👤</span><span style="font-size: 16px; font-weight: 600;">${data.clientCount || 0} client${data.clientCount !== 1 ? 's' : ''}</span></div>
        <div style="display: flex; align-items: center; gap: 10px; margin-left: auto;"><span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">🔋 ${normSystem}</span></div>
    `;
    card.appendChild(statsHeader);
    
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `padding: 5px 25px 20px 25px;`;
    const table = document.createElement('table');
    table.style.cssText = `width: 100%; border-collapse: collapse; color: white; font-size: 14px;`;
    
    let tbodyHTML = `
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0; width: 40%;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">⚡</span><span style="font-weight: 600;">Énergie Maximale</span></div></td><td style="padding: 12px 0; width: 30%; font-weight: 700; color: white;">${maxEnergy.toFixed(0)} Wh</td><td style="padding: 12px 0; width: 30%; text-align: right; color: rgba(255,255,255,0.8);">${maxEnergyDate !== '—' ? formatFrenchDate(maxEnergyDate) : '—'}</td></tr>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">📊</span><span style="font-weight: 600;">Énergie Moyenne</span></div></td><td style="padding: 12px 0; font-weight: 700;">${avgEnergy.toFixed(0)} Wh</td><td style="padding: 12px 0; text-align: right; color: rgba(255,255,255,0.8);">sur ${data.daysCount || 0} jour${data.daysCount !== 1 ? 's' : ''}</td></tr>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">📊</span><span style="font-weight: 600;">Tension Moyenne</span></div></td><td style="padding: 12px 0; font-weight: 700; color: ${tensionColor};">${data.globalAvg?.toFixed(1) || 0} V ${tensionStatusIcon}</td><td style="padding: 12px 0; text-align: right;"><span style="background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 13px;">${normSystem}</span></td></tr>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">⬇️</span><span style="font-weight: 600;">Tension Minimale</span></div></td><td style="padding: 12px 0; font-weight: 700; color: ${isMinOutOfLimit ? '#ffb3b3' : 'white'};">${data.globalMin?.toFixed(1) || 0} V ${isMinOutOfLimit ? '⚠️' : ''}</td><td style="padding: 12px 0; text-align: right; color: rgba(255,255,255,0.8);">seuil: ${norms.min}V</td></tr>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">⬆️</span><span style="font-weight: 600;">Tension Maximale</span></div></td><td style="padding: 12px 0; font-weight: 700; color: ${isMaxOutOfLimit ? '#ffb3b3' : 'white'};">${data.globalMax?.toFixed(1) || 0} V ${isMaxOutOfLimit ? '⚠️' : ''}</td><td style="padding: 12px 0; text-align: right; color: rgba(255,255,255,0.8);">seuil: ${norms.max}V</td></tr>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);"><td style="padding: 12px 0;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 18px;">📏</span><span style="font-weight: 600;">Variation Max/Jour</span></div></td><td style="padding: 12px 0; font-weight: 700; color: white;">${data.maxDailyVariation?.toFixed(2) || 0} V</td><td style="padding: 12px 0; text-align: right;"><span style="background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 13px;">Seuil: ${norms.maxVariation || 0.5} V/h</span></td></tr>
    `;
    
    table.innerHTML = `<tbody>${tbodyHTML}</tbody>`;
    tableContainer.appendChild(table);
    card.appendChild(tableContainer);
    
    container.innerHTML = '';
    container.appendChild(card);
}

/*
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
    
    // Déterminer la couleur de la tension moyenne
    const normSystem = data.normSystem || '12V';
    const norms = VOLTAGE_NORMS[normSystem];
    let tensionColorClass = '';
    let tensionStatus = '';
    
    if (data.globalAvg) {
        if (data.globalAvg >= norms.min && data.globalAvg <= norms.max) {
            tensionColorClass = '#22c55e';
            tensionStatus = '✅ Normal';
        } else if (data.globalAvg < norms.min) {
            tensionColorClass = '#ef4444';
            tensionStatus = '⚠️ Sous-tension';
        } else {
            tensionColorClass = '#f59e0b';
            tensionStatus = '⚠️ Surtension';
        }
    }
    
    container.innerHTML = `
        <div style="background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <!-- En-tête style carte -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 18px;">ℹ️</span>
                    <span style="font-weight: 600;">INFORMATIONS GÉNÉRALES</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px;">🔋 ${normSystem}</span>
                    <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px;">📊 ${data.daysCount || 0} jours</span>
                </div>
            </div>
            
            <!-- Grille des informations -->
            <div style="padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px;">
                <!-- Période -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 12px; border-left: 4px solid #3b82f6;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📅 Période</div>
                    <div style="font-size: 20px; font-weight: 700; color: #1e293b;">${data.daysCount || 0} j</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 4px;">${actualDateRange}</div>
                </div>
                
                <!-- Clients -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 12px; border-left: 4px solid #8b5cf6;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">👥 Clients</div>
                    <div style="font-size: 24px; font-weight: 800; color: #8b5cf6;">${data.clientCount || 0}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 4px;">actifs</div>
                </div>
                
                <!-- Tension moyenne -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 12px; border-left: 4px solid ${tensionColorClass || '#3b82f6'};">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⚡ Tension moyenne</div>
                    <div style="font-size: 24px; font-weight: 800; color: ${tensionColorClass || '#3b82f6'};">${data.globalAvg?.toFixed(1) || 0} <span style="font-size: 12px;">V</span></div>
                    <div style="font-size: 10px; color: ${tensionColorClass || '#64748b'}; margin-top: 4px;">${tensionStatus}</div>
                </div>
                
                <!-- Tension minimale -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 12px; border-left: 4px solid #ef4444;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬇️ Tension minimale</div>
                    <div style="font-size: 20px; font-weight: 700; color: #ef4444;">${data.globalMin?.toFixed(1) || 0} <span style="font-size: 11px;">V</span></div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 4px;">seuil: ${norms.min}V</div>
                </div>
                
                <!-- Tension maximale -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 12px; border-left: 4px solid #f59e0b;">
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬆️ Tension maximale</div>
                    <div style="font-size: 20px; font-weight: 700; color: #f59e0b;">${data.globalMax?.toFixed(1) || 0} <span style="font-size: 11px;">V</span></div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 4px;">seuil: ${norms.max}V</div>
                </div>
                
                <!-- Énergie maximale -->
                <div style="background: linear-gradient(135deg, #fff7ed, #fffbeb); border-radius: 12px; padding: 12px; border-left: 4px solid #f59e0b;">
                    <div style="font-size: 11px; color: #d97706; margin-bottom: 4px;">⚡ Énergie maximale</div>
                    <div style="font-size: 20px; font-weight: 800; color: #f59e0b;">${maxEnergy.toFixed(0)} <span style="font-size: 11px;">Wh</span></div>
                    <div style="font-size: 10px; color: #d97706; margin-top: 4px;">${maxEnergyDate}</div>
                </div>
                
                <!-- Énergie moyenne -->
                <div style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius: 12px; padding: 12px; border-left: 4px solid #22c55e;">
                    <div style="font-size: 11px; color: #15803d; margin-bottom: 4px;">📊 Énergie moyenne</div>
                    <div style="font-size: 20px; font-weight: 800; color: #22c55e;">${avgEnergy.toFixed(0)} <span style="font-size: 11px;">Wh</span></div>
                    <div style="font-size: 10px; color: #15803d; margin-top: 4px;">par jour</div>
                </div>
            </div>
        </div>
    `;
}
*/
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
    const percentClass = data.pourcentage >= 80 ? '#22c55e' : '#f59e0b';
    
    // ✅ Calcul des variations dépassées
    const variationDays = data.causes?.variation?.length || 0;
    const pourcentageVariation = ((variationDays / data.totalJours) * 100).toFixed(1);
    const variationClass = pourcentageVariation < 20 ? '#22c55e' : '#f59e0b';

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
                    <td style="padding: 12px 8px;">${date}</td>
                    <td style="padding: 12px 8px; text-align: center;">${valeur} V</td>
                </tr>
            `;
        }).join('');
        return `
            <div style="max-height: 300px; overflow-y: auto; margin-top: 10px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead style="position: sticky; top: 0; background: #f1f5f9;">
                        <tr>
                            <th style="padding: 12px 8px; text-align: left; color: #475569;">Date</th>
                            <th style="padding: 12px 8px; text-align: center; color: #475569;">Valeur (V)</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    };

    // Générer un ID unique pour les détails à cacher
    const detailsId = `conformity-details-${Date.now()}`;
    
    // Filtrer les causes qui ont des données
    const activeCauses = [];
    if (data.causes.max.length > 0) {
        activeCauses.push({
            icon: '⬆️',
            label: `Surtension (>${norms.max}V)`,
            count: data.causes.max.length,
            color: '#991b1b',
            bgColor: '#fef2f2',
            borderColor: '#fee2e2',
            data: data.causes.max,
            dataType: 'max'
        });
    }
    if (data.causes.min.length > 0) {
        activeCauses.push({
            icon: '⬇️',
            label: `Sous-tension (<${norms.min}V)`,
            count: data.causes.min.length,
            color: '#991b1b',
            bgColor: '#fef2f2',
            borderColor: '#fee2e2',
            data: data.causes.min,
            dataType: 'min'
        });
    }
    if (variationDays > 0) {
        activeCauses.push({
            icon: '⚡',
            label: `Variation (>${norms.variationSeuil}V/h)`,
            count: variationDays,
            color: '#92400e',
            bgColor: '#fffbeb',
            borderColor: '#fef3c7',
            data: data.causes.variation,
            dataType: 'avg'
        });
    }

    // Générer le HTML des causes actives
    let causesHtml = '';
    if (activeCauses.length > 0) {
        const gridCols = activeCauses.length === 1 ? '1fr' : (activeCauses.length === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)');
        causesHtml = `
            <div style="display: grid; grid-template-columns: ${gridCols}; gap: 15px; margin-top: 20px;">
                ${activeCauses.map(cause => `
                    <div style="border: 1px solid ${cause.borderColor}; border-radius: 10px; overflow: hidden;">
                        <div style="background: ${cause.bgColor}; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${cause.borderColor};">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 18px;">${cause.icon}</span>
                                <span style="font-weight: 700; color: ${cause.color};">${cause.label}</span>
                            </div>
                            <span style="background: ${cause.bgColor}; color: ${cause.color === '#991b1b' ? '#dc2626' : '#d97706'}; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 12px;">${cause.count} jours</span>
                        </div>
                        <div style="padding: 12px;">
                            ${generateDetailsTable(cause.data, cause.dataType)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Statistiques 3 cartes (toujours visibles) -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <!-- Carte Jours conformes -->
                <div style="background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #22c55e; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
                    <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">✅ Jours conformes</div>
                    <div style="font-size: 32px; font-weight: 800; color: ${percentClass}; margin-bottom: 8px;">${data.pourcentage}%</div>
                    <div style="font-size: 12px; color: #64748b;">${data.conformes}/${data.totalJours} jours</div>
                    <div style="margin-top: 8px; padding: 6px 12px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; font-size: 12px; color: #15803d;">Seuils: ${norms.min}V - ${norms.max}V</div>
                </div>
                
                <!-- Carte Jours non conformes -->
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #f59e0b; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
                    <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">⚠️ Jours non conformes</div>
                    <div style="font-size: 32px; font-weight: 800; color: #f59e0b; margin-bottom: 8px;">${pourcentageNonConforme}%</div>
                    <div style="font-size: 12px; color: #64748b;">${nonConformes}/${data.totalJours} jours</div>
                    <div style="margin-top: 8px; padding: 6px 12px; background: rgba(245, 158, 11, 0.1); border-radius: 6px; font-size: 12px; color: #92400e;">Hors limites</div>
                </div>
                
                <!-- Carte Variations dépassées -->
                <div style="background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #3b82f6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center;">
                    <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">📈 Variations > ${norms.variationSeuil}V/h</div>
                    <div style="font-size: 32px; font-weight: 800; color: ${variationClass}; margin-bottom: 8px;">${pourcentageVariation}%</div>
                    <div style="font-size: 12px; color: #64748b;">${variationDays}/${data.totalJours} jours</div>
                    <div style="margin-top: 8px; padding: 6px 12px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; font-size: 12px; color: #1e40af;">Seuil: ${norms.variationSeuil}V/h</div>
                </div>
            </div>
            
            <!-- En-tête avec flèche pour afficher/masquer les détails -->
            ${activeCauses.length > 0 ? `
                <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 8px 0; border-top: 1px solid #e2e8f0; margin-top: 10px;" onclick="
                    const details = document.getElementById('${detailsId}');
                    const toggle = this.querySelector('.details-toggle');
                    if (details.style.display === 'none') {
                        details.style.display = 'block';
                        toggle.style.transform = 'rotate(180deg)';
                    } else {
                        details.style.display = 'none';
                        toggle.style.transform = 'rotate(0deg)';
                    }
                ">
                    <div style="font-weight: 600; color: #2d3748; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
                        <span>📋</span> Détails des non-conformités
                    </div>
                    <span class="details-toggle" style="font-size: 1.2rem; transition: transform 0.2s;">▼</span>
                </div>
                
                <!-- Détails cachés par défaut -->
                <div id="${detailsId}" style="display: none;">
                    ${causesHtml}
                </div>
            ` : `
                <div style="padding: 20px; background: #f0fff4; border: 1px solid #22c55e; border-radius: 10px; text-align: center; margin-top: 10px;">
                    <span style="font-size: 24px;">✅</span>
                    <div><span style="font-weight: 700; color: #15803d;">Aucune non-conformité détectée</span></div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">La tension est restée dans les limites pendant toute la période</div>
                </div>
            `}
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
        container.innerHTML = '<div style="background: #f8fafc; border-radius: 10px; padding: 16px;"><div style="font-weight: 600; margin-bottom: 8px;">🔋 Normes système</div><p style="margin: 0;">Non déterminé</p></div>'; 
        return; 
    }
    
    // Générer un ID unique pour le contenu à cacher
    const normsContentId = `norms-content-${Date.now()}`;
    
    container.innerHTML = `
        <div style="background: #f8fafc; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 16px;" onclick="
                const content = document.getElementById('${normsContentId}');
                const toggle = this.querySelector('.norms-toggle');
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    toggle.style.transform = 'rotate(180deg)';
                } else {
                    content.style.display = 'none';
                    toggle.style.transform = 'rotate(0deg)';
                }
            ">
                <div style="font-weight: 600; color: #2d3748; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
                    <span>🔋</span> Normes Système ${normSystem}
                </div>
                <span class="norms-toggle" style="font-size: 1.2rem; transition: transform 0.2s;">▼</span>
            </div>
            <div id="${normsContentId}" style="display: none; border-top: 1px solid #e2e8f0;">
                <div style="padding: 16px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #e53e3e;">
                            <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Tension minimale</div>
                            <div style="font-size: 18px; font-weight: 700; color: #e53e3e;">${normData.min}V</div>
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #f59e0b;">
                            <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Plage idéale</div>
                            <div style="font-size: 18px; font-weight: 700; color: #f59e0b;">${normData.ideal}V</div>
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #22c55e;">
                            <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Tension maximale</div>
                            <div style="font-size: 18px; font-weight: 700; color: #22c55e;">${normData.max}V</div>
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #3b82f6;">
                            <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Seuil d'alerte</div>
                            <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${normData.alert}</div>
                        </div>
                    </div>
                    <div style="margin-top: 12px; padding: 10px; background: #fef2f2; border-radius: 6px; font-size: 11px; color: #991b1b; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px;">🚨</span>
                        <span><strong>Dépassement de seuil détecté</strong> lorsque Tension < ${normData.min}V ou Tension > ${normData.max}V</span>
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

    // Catégories de qualité
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

    // Fonction pour obtenir la couleur selon le compteur
    const getCountColor = (count) => {
        if (count >= 8) return '#a855f7';
        if (count >= 4) return '#22c55e';
        if (count >= 2) return '#eab308';
        if (count === 1) return '#f97316';
        return '#ef4444';
    };
    
    // Fonction pour obtenir le label selon le compteur
    const getCountLabel = (count) => {
        if (count >= 8) return 'EXTRÊME';
        if (count >= 4) return 'EXCELLENT';
        if (count >= 2) return 'BON';
        if (count === 1) return 'MAUVAIS';
        return 'CRITIQUE';
    };

    // Générer le tableau de détails
    const generateDetailsRows = () => {
        return hvData.map(d => {
            const heurePic = hourlyData[d.date]?.hourAtMax || '—';
            const countColor = getCountColor(d.count);
            const countLabel = getCountLabel(d.count);
            
            // Déterminer la couleur de fond selon le nombre d'atteintes
            let bgColor = '#fee2e2';
            let textColor = '#991b1b';
            if (d.count >= 8) { bgColor = '#f3e8ff'; textColor = '#6b21a5'; }
            else if (d.count >= 4) { bgColor = '#dcfce7'; textColor = '#166534'; }
            else if (d.count >= 2) { bgColor = '#fef9c3'; textColor = '#854d0e'; }
            else if (d.count === 1) { bgColor = '#ffedd5'; textColor = '#9a3412'; }
            
            return `
                <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                    <td style="padding: 10px 8px;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 600; color: ${textColor};">${d.date}</span>
                            <span style="font-size: 9px; color: ${textColor}80;">${new Date(d.date).toLocaleDateString('fr-FR')}</span>
                        </div>
                    </td>
                    <td style="padding: 10px 8px; text-align: center;">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span style="font-size: 20px; font-weight: 800; color: ${countColor};">${d.count}</span>
                            <span style="font-size: 9px; color: ${textColor}80;">${countLabel}</span>
                        </div>
                    </td>
                    <td style="padding: 10px 8px; text-align: center; font-family: monospace; color: ${textColor};">${heurePic}</td>
                </tr>
            `;
        }).join('');
    };

    // Variable pour l'état d'affichage des détails (globale)
    if (typeof window.highVoltageDetailsVisible === 'undefined') {
        window.highVoltageDetailsVisible = false;
    }

    // ID unique pour les détails
    const detailsId = `highvoltage-details-${Date.now()}`;

    container.innerHTML = `
        <div style="background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04); overflow: hidden; border: 1px solid #e2e8f0;">
            <!-- En-tête -->
            <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 18px;">⚡</span>
                    <span style="font-weight: 600;">Tensions ≥ ${seuil}V (Système ${normSystem})</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 20px; font-size: 11px;">
                        📊 ${totalJours} jour(s) analysé(s)
                    </span>
                    <span style="background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 20px; font-size: 11px;">
                        ⚡ ${hvData.reduce((sum, d) => sum + d.count, 0)} dépassement(s)
                    </span>
                </div>
            </div>

            <!-- Légende -->
            <div style="padding: 10px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; font-size: 11px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 14px; height: 14px; background: #a855f7; border-radius: 3px;"></div>
                    <span style="color: #6b21a5;"><strong>≥8</strong> (Extrême)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 14px; height: 14px; background: #22c55e; border-radius: 3px;"></div>
                    <span style="color: #166534;"><strong>4-7</strong> (Excellent)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 14px; height: 14px; background: #eab308; border-radius: 3px;"></div>
                    <span style="color: #854d0e;"><strong>2-3</strong> (Bon)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 14px; height: 14px; background: #f97316; border-radius: 3px;"></div>
                    <span style="color: #9a3412;"><strong>1</strong> (Mauvais)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 14px; height: 14px; background: #ef4444; border-radius: 3px;"></div>
                    <span style="color: #991b1b;"><strong>0</strong> (Critique)</span>
                </div>
            </div>

            <!-- Dashboard des statistiques -->
            <div style="padding: 15px 20px; background: #f8fafc; display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;">
                <!-- EXTRÊME -->
                <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #a855f7; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 18px;">🔴</span>
                        <span style="font-size: 12px; font-weight: 600; color: #6b21a5;">EXTRÊME</span>
                    </div>
                    <div style="font-size: 24px; font-weight: 800; color: #a855f7; margin-bottom: 5px;">${stats.extreme}</div>
                    <div style="font-size: 11px; color: #64748b;">${pourcentages.extreme}% des jours</div>
                    <div style="margin-top: 8px; width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${pourcentages.extreme}%; height: 100%; background: #a855f7;"></div>
                    </div>
                    <div style="margin-top: 6px; font-size: 10px; color: #64748b;">≥8 dépassements/jour</div>
                </div>
                <!-- EXCELLENT -->
                <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #22c55e; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 18px;">⭐</span>
                        <span style="font-size: 12px; font-weight: 600; color: #166534;">EXCELLENT</span>
                    </div>
                    <div style="font-size: 24px; font-weight: 800; color: #22c55e; margin-bottom: 5px;">${stats.excellent}</div>
                    <div style="font-size: 11px; color: #64748b;">${pourcentages.excellent}% des jours</div>
                    <div style="margin-top: 8px; width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${pourcentages.excellent}%; height: 100%; background: #22c55e;"></div>
                    </div>
                    <div style="margin-top: 6px; font-size: 10px; color: #64748b;">4-7 dépassements/jour</div>
                </div>
                <!-- BON -->
                <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #eab308; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 18px;">👍</span>
                        <span style="font-size: 12px; font-weight: 600; color: #854d0e;">BON</span>
                    </div>
                    <div style="font-size: 24px; font-weight: 800; color: #eab308; margin-bottom: 5px;">${stats.bon}</div>
                    <div style="font-size: 11px; color: #64748b;">${pourcentages.bon}% des jours</div>
                    <div style="margin-top: 8px; width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${pourcentages.bon}%; height: 100%; background: #eab308;"></div>
                    </div>
                    <div style="margin-top: 6px; font-size: 10px; color: #64748b;">2-3 dépassements/jour</div>
                </div>
                <!-- MAUVAIS -->
                <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #f97316; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 18px;">⚠️</span>
                        <span style="font-size: 12px; font-weight: 600; color: #9a3412;">MAUVAIS</span>
                    </div>
                    <div style="font-size: 24px; font-weight: 800; color: #f97316; margin-bottom: 5px;">${stats.mauvais}</div>
                    <div style="font-size: 11px; color: #64748b;">${pourcentages.mauvais}% des jours</div>
                    <div style="margin-top: 8px; width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${pourcentages.mauvais}%; height: 100%; background: #f97316;"></div>
                    </div>
                    <div style="margin-top: 6px; font-size: 10px; color: #64748b;">1 dépassement/jour</div>
                </div>
                <!-- CRITIQUE -->
                <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #ef4444; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 18px;">🔴</span>
                        <span style="font-size: 12px; font-weight: 600; color: #991b1b;">CRITIQUE</span>
                    </div>
                    <div style="font-size: 24px; font-weight: 800; color: #ef4444; margin-bottom: 5px;">${stats.critique}</div>
                    <div style="font-size: 11px; color: #64748b;">${pourcentages.critique}% des jours</div>
                    <div style="margin-top: 8px; width: 100%; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${pourcentages.critique}%; height: 100%; background: #ef4444;"></div>
                    </div>
                    <div style="margin-top: 6px; font-size: 10px; color: #64748b;">0 dépassement/jour</div>
                </div>
            </div>

            <!-- En-tête des détails avec bouton toggle -->
            <div style="padding: 10px 20px; background: white; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                <div style="font-size: 13px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">📋</span> Détails des jours avec dépassements
                </div>
                <button type="button" id="toggle-${detailsId}" style="padding: 8px 14px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f1f5f9; color: #0f172a; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;">
                    <span style="font-size: 14px;">🔽</span> Voir plus de détails
                </button>
            </div>

            <!-- Tableau des détails (caché par défaut) -->
            <div id="${detailsId}" style="display: none;">
                <div style="max-height: 400px; overflow-y: auto; overflow-x: auto; scrollbar-width: thin;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 500px;">
                        <thead style="position: sticky; top: 0; z-index: 10; background: white;">
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                                <th style="padding: 10px 8px; text-align: left; font-weight: 600; color: #334155;">📅 Date</th>
                                <th style="padding: 10px 8px; text-align: center; font-weight: 600; color: #334155;">⚡ Atteintes</th>
                                <th style="padding: 10px 8px; text-align: center; font-weight: 600; color: #334155;">⏰ Heure du pic</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${generateDetailsRows()}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Graphique -->
            <div style="padding: 20px 25px; background: white; border-top: 1px solid #e2e8f0; height: 450px; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 15px; flex-shrink: 0;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-size: 16px; font-weight: 700; color: #0f172a;">📈 Évolution quotidienne des dépassements</span>
                        <span style="background: #e2e8f0; padding: 6px 16px; border-radius: 30px; font-size: 12px; font-weight: 600; color: #334155;">${totalJours} jours analysés</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 14px; height: 14px; background: #a855f7; border-radius: 3px;"></div>
                            <span style="font-size: 11px; color: #6b21a5;">≥8 (Extrême)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 14px; height: 14px; background: #22c55e; border-radius: 3px;"></div>
                            <span style="font-size: 11px; color: #166534;">4-7 (Excellent)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 14px; height: 14px; background: #eab308; border-radius: 3px;"></div>
                            <span style="font-size: 11px; color: #854d0e;">2-3 (Bon)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 14px; height: 14px; background: #f97316; border-radius: 3px;"></div>
                            <span style="font-size: 11px; color: #9a3412;">1 (Mauvais)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 14px; height: 14px; background: #ef4444; border-radius: 3px;"></div>
                            <span style="font-size: 11px; color: #991b1b;">0 (Critique)</span>
                        </div>
                    </div>
                </div>
                <div style="height: 320px; position: relative;">
                    <canvas id="highVoltageChart"></canvas>
                </div>
            </div>
        </div>
    `;

    // Gestion du toggle
    const toggleBtn = document.getElementById(`toggle-${detailsId}`);
    const detailsDiv = document.getElementById(detailsId);
    if (toggleBtn && detailsDiv) {
        toggleBtn.onclick = () => {
            window.highVoltageDetailsVisible = !window.highVoltageDetailsVisible;
            detailsDiv.style.display = window.highVoltageDetailsVisible ? 'block' : 'none';
            toggleBtn.innerHTML = window.highVoltageDetailsVisible
                ? `<span style="font-size:14px;">🔼</span> Masquer les détails`
                : `<span style="font-size:14px;">🔽</span> Voir plus de détails`;
        };
    }

    // Création du graphique
    chartManager.destroy('highVoltageChart');
    requestAnimationFrame(() => {
        createHighVoltageChart(hvData.map(d => d.date).sort(), hvData.map(d => d.count), seuil);
    });
}

function createHighVoltageChart(dates, counts, seuil) {
    const ctx = document.getElementById('highVoltageChart')?.getContext('2d');
    if (!ctx) return;
    
    const getPointColor = (count) => {
        if (count >= 8) return '#a855f7';
        if (count >= 4) return '#22c55e';
        if (count >= 2) return '#eab308';
        if (count === 1) return '#f97316';
        return '#ef4444';
    };
    
    // Calculer le maximum pour l'échelle Y
    const maxCount = Math.max(...counts);
    const yMax = Math.max(10, maxCount + 3);
    
    requestAnimationFrame(() => {
        chartManager.create('highVoltageChart', {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: `Dépassements par jour (≥${seuil}V)`,
                    data: counts,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.05)',
                    borderWidth: 3,
                    pointRadius: 7,
                    pointHoverRadius: 11,
                    pointBackgroundColor: counts.map(c => getPointColor(c)),
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2.5,
                    pointHoverBackgroundColor: counts.map(c => getPointColor(c)),
                    pointHoverBorderColor: '#0f172a',
                    pointHoverBorderWidth: 3,
                    fill: false,
                    tension: 0.2,
                    order: 1
                }, {
                    label: 'Seuil excellent (4x/jour)',
                    data: Array(dates.length).fill(4),
                    borderColor: '#22c55e',
                    borderWidth: 4,
                    borderDash: [10, 8],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 0
                }, {
                    label: 'Seuil extrême (8x/jour)',
                    data: Array(dates.length).fill(8),
                    borderColor: '#a855f7',
                    borderWidth: 4,
                    borderDash: [10, 8],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { size: 12, weight: '600' },
                            usePointStyle: true,
                            boxWidth: 18,
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.98)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                let level = '';
                                if (value >= 8) level = '🔴 EXTRÊME';
                                else if (value >= 4) level = '🟢 EXCELLENT';
                                else if (value >= 2) level = '🟡 BON';
                                else if (value === 1) level = '🟠 MAUVAIS';
                                else level = '⚫ CRITIQUE';
                                return [`${value} dépassement(s)`, `Niveau: ${level}`];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: yMax,
                        grid: { color: 'rgba(100, 116, 139, 0.15)' },
                        title: { display: true, text: 'NOMBRE DE DÉPASSEMENTS', font: { size: 12, weight: '700' }, color: '#0f172a' },
                        ticks: { stepSize: 1, font: { size: 11 }, callback: (value) => value + 'x' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 } },
                        title: { display: true, text: 'DATE', font: { size: 12, weight: '700' }, color: '#0f172a' }
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
    
    // 🔁 Récupération des données ORIGINALE
    const data = database.technicalData?.chartData;
    if (!data) { 
        container.innerHTML = '<p class="no-data">Données insuffisantes</p>'; 
        return; 
    }
    
    // ✅ Utilisation de VOLTAGE_NORMS (déjà défini dans votre code)
    const normSystem = database.technicalData?.normSystem || '12V';
    const norms = VOLTAGE_NORMS[normSystem];
    
    // Compter les dépassements approximatifs
    let exceedanceCount = 0;
    if (data.mins) {
        exceedanceCount += data.mins.filter(v => v < norms.min).length;
    }
    if (data.maxs) {
        exceedanceCount += data.maxs.filter(v => v > norms.max).length;
    }
    if (data.avgs) {
        exceedanceCount += data.avgs.filter(v => v < norms.min || v > norms.max).length;
    }
    
    container.innerHTML = `
        <div style="background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden; margin-bottom: 20px;">
            <!-- En-tête style carte -->
            <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 18px;">📈</span>
                    <span style="font-weight: 600;">ÉVOLUTION JOURNALIÈRE DES TENSIONS</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px;">🔋 ${normSystem}</span>
                    <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px;">📊 ${norms.min}V - ${norms.max}V</span>
                    ${exceedanceCount > 0 ? `<span style="background: rgba(239,68,68,0.4); padding: 4px 12px; border-radius: 20px; font-size: 11px;">⚠️ ${exceedanceCount} dépassement(s)</span>` : ''}
                </div>
            </div>
            <!-- Légende simplifiée -->
            <div style="padding: 10px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; font-size: 11px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 20px; height: 3px; background: #3b82f6;"></div>
                    <span style="color: #1e40af;">Minimale</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 20px; height: 3px; background: #22c55e;"></div>
                    <span style="color: #166534;">Moyenne</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 20px; height: 3px; background: #f97316;"></div>
                    <span style="color: #9a3412;">Maximale</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="width: 20px; height: 2px; background: #ef4444; border-style: dashed;"></div>
                    <span style="color: #991b1b;">Seuils (${norms.min}V - ${norms.max}V)</span>
                </div>
            </div>
            <!-- Graphique -->
            <div style="padding: 20px; height: 380px;">
                <canvas id="dailyTensionChart"></canvas>
            </div>
        </div>
    `;
    
    // Création du graphique ORIGINAL
    chartManager.destroy('dailyTensionChart');
    requestAnimationFrame(() => createDailyTensionChart(data));
}

// ✅ Fonction avec SEUILS COLORÉS EN ROUGE (comme dans le sample)
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
                    { 
                        label: 'Tension minimale', 
                        data: data.mins, 
                        borderColor: '#3b82f6',  // Bleu
                        borderWidth: 2, 
                        pointRadius: 4, 
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: 'white',
                        pointBorderWidth: 1.5,
                        tension: 0.2,
                        fill: false
                    },
                    { 
                        label: 'Tension maximale', 
                        data: data.maxs, 
                        borderColor: '#f97316',  // Orange
                        borderWidth: 2, 
                        pointRadius: 4, 
                        pointBackgroundColor: '#f97316',
                        pointBorderColor: 'white',
                        pointBorderWidth: 1.5,
                        tension: 0.2,
                        fill: false
                    },
                    { 
                        label: 'Tension moyenne', 
                        data: data.avgs, 
                        borderColor: '#22c55e',  // Vert
                        borderWidth: 2.5, 
                        pointRadius: 5, 
                        pointBackgroundColor: '#22c55e',
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        tension: 0.2,
                        fill: false
                    },
                    { 
                        label: 'Seuil minimal', 
                        data: Array(data.dates.length).fill(norms.min), 
                        borderColor: '#ef4444',  // 🔴 ROUGE
                        borderWidth: 2, 
                        borderDash: [8, 6], 
                        pointRadius: 0,
                        fill: false,
                        tension: 0
                    },
                    { 
                        label: 'Seuil maximal', 
                        data: Array(data.dates.length).fill(norms.max), 
                        borderColor: '#ef4444',  // 🔴 ROUGE
                        borderWidth: 2, 
                        borderDash: [8, 6], 
                        pointRadius: 0,
                        fill: false,
                        tension: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { 
                        position: 'top', 
                        labels: { 
                            font: { size: 11, weight: '600' },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 15
                        } 
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                let value = context.parsed.y.toFixed(2);
                                let isExceeding = false;
                                
                                if (label === 'Tension minimale' && parseFloat(value) < norms.min) isExceeding = true;
                                if (label === 'Tension maximale' && parseFloat(value) > norms.max) isExceeding = true;
                                if (label === 'Tension moyenne' && (parseFloat(value) < norms.min || parseFloat(value) > norms.max)) isExceeding = true;
                                
                                if (label === 'Seuil minimal' || label === 'Seuil maximal') return null;
                                
                                return `${isExceeding ? '⚠️' : '✅'} ${label}: ${value} V`;
                            }
                        }
                    }
                },
                scales: { 
                    y: { 
                        grid: { color: '#e9ecef' },
                        title: { display: true, text: 'Tension (Volts)', font: { size: 11, weight: 'bold' } },
                        ticks: { font: { size: 10 } }
                    }, 
                    x: { 
                        grid: { display: false },
                        ticks: { maxRotation: 45, minRotation: 45, font: { size: 9 } },
                        title: { display: true, text: 'Date', font: { size: 11, weight: 'bold' } }
                    } 
                }
            }
        });
    });
}

// ===========================================
// II-7) HOURLY CHART - FORMAT FRANÇAIS (jj/mm/aaaa)
// ===========================================

let chartStartIndex = 0, chartEndIndex = 0, allDates = [], allTensionData = [];

function formatFrenchDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function renderHourlyChart(selectedDate = null) {
    const container = document.getElementById('hourlyChartCard');
    if (!container) return;
    
    const table = database.tables?.find(t => t.type === 'T');
    if (!table) { 
        container.innerHTML = '<p class="no-data">Données horaires indisponibles</p>'; 
        return; 
    }
    
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
    
    const data = database.technicalData;
    let normSystem = '12V';
    if (data && data.globalAvg) {
        if (data.globalAvg >= 22 && data.globalAvg <= 29) { 
            normSystem = '24V'; 
        } else if (data.globalAvg >= 11 && data.globalAvg <= 15) { 
            normSystem = '12V'; 
        }
    }
    const limits = VOLTAGE_NORMS[normSystem];
    
    let minValue = Infinity;
    let maxValue = -Infinity;
    for (let i = chartStartIndex; i <= chartEndIndex; i++) {
        const dayData = allTensionData[i];
        if (dayData) {
            dayData.forEach(point => {
                if (point.tension > 0) {
                    minValue = Math.min(minValue, point.tension);
                    maxValue = Math.max(maxValue, point.tension);
                }
            });
        }
    }
    
    const margin = 1.5;
    const showMinThreshold = minValue < (limits.min + margin);
    const showMaxThreshold = maxValue > (limits.max - margin);
    
    let yMin, yMax;
    if (normSystem === '12V') {
        if (showMinThreshold && showMaxThreshold) {
            yMin = Math.min(10, minValue - 1);
            yMax = Math.max(16, maxValue + 1);
        } else if (showMinThreshold) {
            yMin = Math.min(10, minValue - 1);
            yMax = Math.max(14, maxValue + 1);
        } else if (showMaxThreshold) {
            yMin = Math.min(11, minValue - 1);
            yMax = Math.max(16, maxValue + 1);
        } else {
            yMin = minValue - 1;
            yMax = maxValue + 1;
        }
    } else {
        if (showMinThreshold && showMaxThreshold) {
            yMin = Math.min(20, minValue - 1);
            yMax = Math.max(30, maxValue + 1);
        } else if (showMinThreshold) {
            yMin = Math.min(20, minValue - 1);
            yMax = Math.max(28, maxValue + 1);
        } else if (showMaxThreshold) {
            yMin = Math.min(22, minValue - 1);
            yMax = Math.max(30, maxValue + 1);
        } else {
            yMin = minValue - 1;
            yMax = maxValue + 1;
        }
    }
    yMin = Math.floor(yMin * 2) / 2;
    yMax = Math.ceil(yMax * 2) / 2;
    
    let totalPoints = 0;
    for (let i = chartStartIndex; i <= chartEndIndex; i++) {
        totalPoints += allTensionData[i]?.length || 0;
    }
    
    const daysCount = chartEndIndex - chartStartIndex + 1;
    
    const thresholdBadges = [];
    if (showMinThreshold) thresholdBadges.push(`⬇️ Min ${limits.min}V`);
    if (showMaxThreshold) thresholdBadges.push(`⬆️ Max ${limits.max}V`);
    
    const startDateFrench = formatFrenchDate(allDates[chartStartIndex]);
    const endDateFrench = formatFrenchDate(allDates[chartEndIndex]);
    
    container.innerHTML = `
        <div style="background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <div style="background: #f8fafc; padding: 10px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <div style="background: #3b82f6; color: white; padding: 6px 15px; border-radius: 30px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">📅</span>
                    <span>${startDateFrench} → ${endDateFrench}</span>
                    <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px;">${daysCount}j · ${totalPoints} points</span>
                </div>
            </div>
            
            <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 15px 25px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 20px;">📊</span>
                    <span style="font-weight: 700;">ÉVOLUTION HORAIRE DE LA TENSION MOYENNE</span>
                    ${thresholdBadges.length > 0 ? `
                        <span style="font-size: 11px; background: rgba(239, 68, 68, 0.2); color: #fee2e2; padding: 4px 12px; border-radius: 20px;">
                            Seuils: ${thresholdBadges.join(' · ')}
                        </span>
                    ` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">${totalPoints} points</span>
                    <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">Système ${normSystem}</span>
                    <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">Échelle: ${yMin.toFixed(1)}V - ${yMax.toFixed(1)}V</span>
                </div>
            </div>
            
            <div style="padding: 15px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 180px;">
                        <label style="display: block; font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 6px;">📅 DATE DE DÉBUT</label>
                        <select id="startDateSelect" style="width: 100%; padding: 10px 14px; border: 2px solid #e2e8f0; border-radius: 10px; background: white; font-size: 13px; cursor: pointer;">
                            ${allDates.map((d, i) => `<option value="${i}" ${i === chartStartIndex ? 'selected' : ''}>${formatFrenchDate(d)}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 180px;">
                        <label style="display: block; font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 6px;">📅 DATE DE FIN</label>
                        <select id="endDateSelect" style="width: 100%; padding: 10px 14px; border: 2px solid #e2e8f0; border-radius: 10px; background: white; font-size: 13px; cursor: pointer;">
                            ${allDates.map((d, i) => `<option value="${i}" ${i === chartEndIndex ? 'selected' : ''}>${formatFrenchDate(d)}</option>`).join('')}
                        </select>
                    </div>
                    <button id="applyDateBtn" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; border: none; padding: 10px 28px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(239,68,68,0.3);">
                        APPLIQUER
                    </button>
                </div>
            </div>
            
            <div style="padding: 20px; height: 450px;">
                <div style="height: 380px; position: relative;">
                    <canvas id="hourlyTensionChart"></canvas>
                </div>
            </div>
        </div>
    `;
    
    attachDateSelectors();
    updateHourlyChartData(yMin, yMax, limits, normSystem, showMinThreshold, showMaxThreshold);
}

function updateHourlyChartData(yMin, yMax, limits, normSystem, showMinThreshold, showMaxThreshold) {
    const labels = [];
    const tensions = [];
    const dayInfo = [];
    
    const selectedDays = [];
    for (let i = chartStartIndex; i <= chartEndIndex; i++) {
        selectedDays.push({
            date: allDates[i],
            data: allTensionData[i]
        });
    }
    
    selectedDays.forEach((day, dayIdx) => {
        day.data.forEach(point => {
            const dateFrench = formatFrenchDate(day.date);
            const datetime = `${dateFrench} ${point.hour}`;
            labels.push(datetime);
            tensions.push(point.tension);
            dayInfo.push({ 
                date: day.date,
                dateFrench: dateFrench,
                hour: point.hour,
                hasData: true
            });
        });
    });
    
    const colorPalette = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
    ];
    
    const datasets = [];
    
    selectedDays.forEach((day, idx) => {
        const color = colorPalette[idx % colorPalette.length];
        const dayPoints = [];
        
        day.data.forEach(point => {
            const dateFrench = formatFrenchDate(day.date);
            const datetime = `${dateFrench} ${point.hour}`;
            const pos = labels.indexOf(datetime);
            if (pos !== -1) {
                dayPoints.push({ pos, value: point.tension });
            }
        });
        
        const dataArray = new Array(labels.length).fill(null);
        dayPoints.forEach(p => { dataArray[p.pos] = p.value; });
        
        datasets.push({
            label: formatFrenchDate(day.date),
            data: dataArray,
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: dayPoints.map(p => 
                p.value < limits.min || p.value > limits.max ? '#ef4444' : color
            ),
            pointBorderColor: 'white',
            pointBorderWidth: 1.5,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: false,
            order: 1
        });
    });
    
    const thresholdDatasets = [];
    if (showMinThreshold) {
        thresholdDatasets.push({
            label: `Seuil Min ${normSystem}`,
            data: Array(labels.length).fill(limits.min),
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [8, 6],
            pointRadius: 0,
            fill: false,
            order: 2
        });
    }
    if (showMaxThreshold) {
        thresholdDatasets.push({
            label: `Seuil Max ${normSystem}`,
            data: Array(labels.length).fill(limits.max),
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [8, 6],
            pointRadius: 0,
            fill: false,
            order: 2
        });
    }
    
    const config = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [...thresholdDatasets, ...datasets]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeInOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 11, weight: 'bold' },
                        color: '#1e293b',
                        usePointStyle: true,
                        padding: 15,
                        filter: item => !item.text.includes('Seuil')
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: (context) => context[0].label,
                        label: (context) => {
                            const value = context.parsed.y;
                            if (value === null) return null;
                            const isExceeding = (value < limits.min || value > limits.max);
                            const icon = isExceeding ? '🔴' : '✅';
                            return `${icon} ${context.dataset.label}: ${value.toFixed(2)} V`;
                        },
                        afterLabel: (context) => {
                            const value = context.parsed.y;
                            if (value === null) return null;
                            if (value < limits.min) return `⬇️ Sous seuil minimum (${limits.min}V)`;
                            if (value > limits.max) return `⬆️ Au-dessus seuil maximum (${limits.max}V)`;
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: yMin,
                    max: yMax,
                    grid: {
                        color: function(context) {
                            const value = context.tick.value;
                            if (showMinThreshold && Math.abs(value - limits.min) < 0.1) return 'rgba(239, 68, 68, 0.5)';
                            if (showMaxThreshold && Math.abs(value - limits.max) < 0.1) return 'rgba(239, 68, 68, 0.5)';
                            return 'rgba(0, 0, 0, 0.06)';
                        },
                        lineWidth: function(context) {
                            const value = context.tick.value;
                            if ((showMinThreshold && Math.abs(value - limits.min) < 0.1) ||
                                (showMaxThreshold && Math.abs(value - limits.max) < 0.1)) return 2;
                            return 1;
                        }
                    },
                    title: {
                        display: true,
                        text: 'Tension (Volts)',
                        font: { size: 12, weight: 'bold' },
                        color: '#475569'
                    },
                    ticks: {
                        font: { size: 11 },
                        color: '#64748b',
                        stepSize: (yMax - yMin) / 6,
                        callback: value => value.toFixed(1) + 'V'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 10 },
                        color: '#64748b',
                        maxRotation: 45,
                        minRotation: 30,
                        maxTicksLimit: 20,
                        callback: function(val, index) {
                            if (index % Math.floor(labels.length / 15) === 0) {
                                return this.getLabelForValue(val);
                            }
                            return '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date et Heure',
                        font: { size: 12, weight: 'bold' },
                        color: '#475569',
                        padding: { top: 10 }
                    }
                }
            }
        }
    };
    
    if (chartManager.instances['hourlyTensionChart']) {
        chartManager.destroy('hourlyTensionChart');
    }
    
    requestAnimationFrame(() => {
        const canvas = document.getElementById('hourlyTensionChart');
        if (canvas) {
            chartManager.create('hourlyTensionChart', config);
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
            option.textContent = formatFrenchDate(allDates[i]);
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
            renderHourlyChart();
        }
    });
}

/*
// ===========================================
// II-7) HOURLY CHART - MODIFIÉ POUR ÊTRE IDENTIQUE AU CODE 1
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
    
    // Détection dynamique du système
    const data = database.technicalData;
    let normSystem = '12V';
    if (data && data.globalAvg) {
        if (data.globalAvg >= 22 && data.globalAvg <= 29) { 
            normSystem = '24V'; 
        } else if (data.globalAvg >= 11 && data.globalAvg <= 15) { 
            normSystem = '12V'; 
        }
    }
    const limits = VOLTAGE_NORMS[normSystem];
    
    // Analyser les données pour ajuster dynamiquement les seuils
    let minValue = Infinity;
    let maxValue = -Infinity;
    for (let i = chartStartIndex; i <= chartEndIndex; i++) {
        const dayData = allTensionData[i];
        if (dayData) {
            dayData.forEach(point => {
                if (point.tension > 0) {
                    minValue = Math.min(minValue, point.tension);
                    maxValue = Math.max(maxValue, point.tension);
                }
            });
        }
    }
    
    const margin = 1.5;
    const showMinThreshold = minValue < (limits.min + margin);
    const showMaxThreshold = maxValue > (limits.max - margin);
    
    // Calculer l'échelle Y dynamique
    let yMin, yMax;
    if (normSystem === '12V') {
        if (showMinThreshold && showMaxThreshold) {
            yMin = Math.min(10, minValue - 1);
            yMax = Math.max(16, maxValue + 1);
        } else if (showMinThreshold) {
            yMin = Math.min(10, minValue - 1);
            yMax = Math.max(14, maxValue + 1);
        } else if (showMaxThreshold) {
            yMin = Math.min(11, minValue - 1);
            yMax = Math.max(16, maxValue + 1);
        } else {
            yMin = minValue - 1;
            yMax = maxValue + 1;
        }
    } else {
        if (showMinThreshold && showMaxThreshold) {
            yMin = Math.min(20, minValue - 1);
            yMax = Math.max(30, maxValue + 1);
        } else if (showMinThreshold) {
            yMin = Math.min(20, minValue - 1);
            yMax = Math.max(28, maxValue + 1);
        } else if (showMaxThreshold) {
            yMin = Math.min(22, minValue - 1);
            yMax = Math.max(30, maxValue + 1);
        } else {
            yMin = minValue - 1;
            yMax = maxValue + 1;
        }
    }
    yMin = Math.floor(yMin * 2) / 2;
    yMax = Math.ceil(yMax * 2) / 2;
    
    // Compter les points
    let totalPoints = 0;
    for (let i = chartStartIndex; i <= chartEndIndex; i++) {
        totalPoints += allTensionData[i]?.length || 0;
    }
    
    const daysCount = chartEndIndex - chartStartIndex + 1;
    
    // Badges seuils
    const thresholdBadges = [];
    if (showMinThreshold) thresholdBadges.push(`⬇️ Min ${limits.min}V`);
    if (showMaxThreshold) thresholdBadges.push(`⬆️ Max ${limits.max}V`);
    
    container.innerHTML = `
        <div style="background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <!-- Badge de période -->
            <div style="background: #f8fafc; padding: 10px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <div style="background: #3b82f6; color: white; padding: 6px 15px; border-radius: 30px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">📅</span>
                    <span>${allDates[chartStartIndex]} → ${allDates[chartEndIndex]}</span>
                    <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px;">${daysCount}j · ${totalPoints} points</span>
                </div>
            </div>
            
            <!-- En-tête principal -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 15px 25px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 20px;">📊</span>
                    <span style="font-weight: 700;">ÉVOLUTION HORAIRE DE LA TENSION MOYENNE</span>
                    ${thresholdBadges.length > 0 ? `
                        <span style="font-size: 11px; background: rgba(239, 68, 68, 0.2); color: #fee2e2; padding: 4px 12px; border-radius: 20px;">
                            Seuils: ${thresholdBadges.join(' · ')}
                        </span>
                    ` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">${totalPoints} points</span>
                    <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">Système ${normSystem}</span>
                    <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">Échelle: ${yMin.toFixed(1)}V - ${yMax.toFixed(1)}V</span>
                </div>
            </div>
            
            <!-- Filtres de dates -->
            <div style="padding: 15px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 180px;">
                        <label style="display: block; font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 6px;">📅 DATE DE DÉBUT</label>
                        <select id="startDateSelect" style="width: 100%; padding: 10px 14px; border: 2px solid #e2e8f0; border-radius: 10px; background: white; font-size: 13px; cursor: pointer;">
                            ${allDates.map((d, i) => `<option value="${i}" ${i === chartStartIndex ? 'selected' : ''}>${d}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 180px;">
                        <label style="display: block; font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 6px;">📅 DATE DE FIN</label>
                        <select id="endDateSelect" style="width: 100%; padding: 10px 14px; border: 2px solid #e2e8f0; border-radius: 10px; background: white; font-size: 13px; cursor: pointer;">
                            ${allDates.map((d, i) => `<option value="${i}" ${i === chartEndIndex ? 'selected' : ''}>${d}</option>`).join('')}
                        </select>
                    </div>
                    <button id="applyDateBtn" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; border: none; padding: 10px 28px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(239,68,68,0.3);">
                        APPLIQUER
                    </button>
                </div>
            </div>
            
            <!-- Graphique -->
            <div style="padding: 20px; height: 450px;">
                <div style="height: 380px; position: relative;">
                    <canvas id="hourlyTensionChart"></canvas>
                </div>
            </div>
        </div>
    `;
    
    attachDateSelectors();
    updateHourlyChartData(yMin, yMax, limits, normSystem, showMinThreshold, showMaxThreshold);
}

function updateHourlyChartData(yMin, yMax, limits, normSystem, showMinThreshold, showMaxThreshold) {
    const labels = [];
    const tensions = [];
    const dayInfo = [];
    
    // Déterminer tous les jours de la plage
    const selectedDays = [];
    for (let i = chartStartIndex; i <= chartEndIndex; i++) {
        selectedDays.push({
            date: allDates[i],
            data: allTensionData[i]
        });
    }
    
    // Pour chaque jour, créer les points existants (pas forcément 24h)
    selectedDays.forEach((day, dayIdx) => {
        day.data.forEach(point => {
            const datetime = `${day.date} ${point.hour}`;
            labels.push(datetime);
            tensions.push(point.tension);
            dayInfo.push({ 
                date: day.date, 
                hour: point.hour,
                hasData: true
            });
        });
    });
    
    // Créer les datasets : un dataset par jour (comme dans code 1)
    const colorPalette = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
    ];
    
    const datasets = [];
    const dateGroups = {};
    
    selectedDays.forEach((day, idx) => {
        const color = colorPalette[idx % colorPalette.length];
        const dayPoints = [];
        const dayIndices = [];
        
        day.data.forEach(point => {
            const datetime = `${day.date} ${point.hour}`;
            const pos = labels.indexOf(datetime);
            if (pos !== -1) {
                dayPoints.push({ pos, value: point.tension });
                dayIndices.push(pos);
            }
        });
        
        const dataArray = new Array(labels.length).fill(null);
        dayPoints.forEach(p => { dataArray[p.pos] = p.value; });
        
        datasets.push({
            label: day.date,
            data: dataArray,
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: dayPoints.map(p => 
                p.value < limits.min || p.value > limits.max ? '#ef4444' : color
            ),
            pointBorderColor: 'white',
            pointBorderWidth: 1.5,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: false,
            order: 1
        });
    });
    
    // Datasets des seuils
    const thresholdDatasets = [];
    if (showMinThreshold) {
        thresholdDatasets.push({
            label: `Seuil Min ${normSystem}`,
            data: Array(labels.length).fill(limits.min),
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [8, 6],
            pointRadius: 0,
            fill: false,
            order: 2
        });
    }
    if (showMaxThreshold) {
        thresholdDatasets.push({
            label: `Seuil Max ${normSystem}`,
            data: Array(labels.length).fill(limits.max),
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [8, 6],
            pointRadius: 0,
            fill: false,
            order: 2
        });
    }
    
    const config = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [...thresholdDatasets, ...datasets]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeInOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 11, weight: 'bold' },
                        color: '#1e293b',
                        usePointStyle: true,
                        padding: 15,
                        filter: item => !item.text.includes('Seuil')
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: (context) => context[0].label,
                        label: (context) => {
                            const value = context.parsed.y;
                            if (value === null) return null;
                            const isExceeding = (value < limits.min || value > limits.max);
                            const icon = isExceeding ? '🔴' : '✅';
                            return `${icon} ${context.dataset.label}: ${value.toFixed(2)} V`;
                        },
                        afterLabel: (context) => {
                            const value = context.parsed.y;
                            if (value === null) return null;
                            if (value < limits.min) return `⬇️ Sous seuil minimum (${limits.min}V)`;
                            if (value > limits.max) return `⬆️ Au-dessus seuil maximum (${limits.max}V)`;
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: yMin,
                    max: yMax,
                    grid: {
                        color: function(context) {
                            const value = context.tick.value;
                            if (showMinThreshold && Math.abs(value - limits.min) < 0.1) return 'rgba(239, 68, 68, 0.5)';
                            if (showMaxThreshold && Math.abs(value - limits.max) < 0.1) return 'rgba(239, 68, 68, 0.5)';
                            return 'rgba(0, 0, 0, 0.06)';
                        },
                        lineWidth: function(context) {
                            const value = context.tick.value;
                            if ((showMinThreshold && Math.abs(value - limits.min) < 0.1) ||
                                (showMaxThreshold && Math.abs(value - limits.max) < 0.1)) return 2;
                            return 1;
                        }
                    },
                    title: {
                        display: true,
                        text: 'Tension (Volts)',
                        font: { size: 12, weight: 'bold' },
                        color: '#475569'
                    },
                    ticks: {
                        font: { size: 11 },
                        color: '#64748b',
                        stepSize: (yMax - yMin) / 6,
                        callback: value => value.toFixed(1) + 'V'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 10 },
                        color: '#64748b',
                        maxRotation: 45,
                        minRotation: 30,
                        maxTicksLimit: 20,
                        callback: function(val, index) {
                            if (index % Math.floor(labels.length / 15) === 0) {
                                return this.getLabelForValue(val);
                            }
                            return '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date et Heure',
                        font: { size: 12, weight: 'bold' },
                        color: '#475569',
                        padding: { top: 10 }
                    }
                }
            }
        }
    };
    
    if (chartManager.instances['hourlyTensionChart']) {
        chartManager.destroy('hourlyTensionChart');
    }
    
    requestAnimationFrame(() => {
        const canvas = document.getElementById('hourlyTensionChart');
        if (canvas) {
            chartManager.create('hourlyTensionChart', config);
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
            renderHourlyChart();
        }
    });
}
*/

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
        { id: 0, label: 'Kit 0', max: 250, color: '#ff941b', description: 'Très basse consommation' },
        { id: 1, label: 'Kit 1', max: 360, color: '#8d1bff', description: 'Consommation faible' },
        { id: 2, label: 'Kit 2', max: 540, color: '#fcd129', description: 'Consommation modérée' },
        { id: 3, label: 'Kit 3', max: 720, color: '#39ff4a', description: 'Consommation élevée' },
        { id: 4, label: 'Kit 4', max: 1080, color: '#667eea', description: 'Très haute consommation' },
        { id: 5, label: 'Kit 4+', max: Infinity, color: '#dc2626', description: 'Consommation extrême' }
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
    
    // Trouver le kit max atteint pour la couleur dominante
    let maxKitReached = null;
    let maxEnergyValue = 0;
    dailyValues.forEach(energy => {
        if (energy > maxEnergyValue) {
            maxEnergyValue = energy;
            for (let i = 0; i < tousLesSeuils.length; i++) {
                if (energy <= tousLesSeuils[i].max) {
                    maxKitReached = tousLesSeuils[i].label;
                    break;
                }
            }
            if (!maxKitReached) maxKitReached = 'Kit 4+';
        }
    });
    const dominantKitInfo = maxKitReached === 'Kit 4+' ? { color: '#dc2626' } : tousLesSeuils.find(k => k.label === maxKitReached);
    const dominantColor = dominantKitInfo?.color || '#667eea';
    
    // Générer un ID unique pour les détails
    const detailsId = `client-details-${Date.now()}`;
    
    // ✅ Barre de progression cumulative (style identique à createTotalEnergyChart)
    const renderCumulativeBar = () => {
        let cumulativePercent = 0;
        return visibleSeuils.map(kit => {
            cumulativePercent = kit.percentage;
            return `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="width: 16px; height: 16px; background: ${kit.color}; border-radius: 4px; box-shadow: 0 2px 6px ${kit.color}80;"></span>
                                <span style="font-weight: 600; font-size: 15px; color: #1e293b;">${kit.label}</span>
                            </div>
                            <span style="font-size: 13px; color: #475569; background: #f1f5f9; padding: 4px 14px; border-radius: 30px;">📅 ${kit.jours} jour${kit.jours !== 1 ? 's' : ''}</span>
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 8px;">
                            <span style="font-weight: 900; font-size: 22px; color: ${kit.color};">${cumulativePercent.toFixed(1)}%</span>
                            <span style="font-size: 12px; color: #64748b;">cumulé</span>
                        </div>
                    </div>
                    <div style="position: relative; width: 100%; height: 12px; background: #edf2f7; border-radius: 8px; overflow: hidden; margin-top: 6px; box-shadow: inset 0 1px 4px rgba(0,0,0,0.05);">
                        <div style="width: ${cumulativePercent}%; height: 100%; background: ${kit.color}; border-radius: 8px; transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 0 12px ${kit.color}80;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <span style="font-size: 12px; color: #475569;">
                            <span style="font-weight: 600;">${kit.label}</span> (≤${kit.max}Wh)
                        </span>
                        <span style="font-size: 12px; color: #64748b;">${kit.jours}/${totalJours} jours</span>
                    </div>
                </div>
            `;
        }).join('');
    };
    
    container.innerHTML = `
        <div style="background: white; border-radius: 16px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <!-- En-tête style carte -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 25px; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 12px;">
                <span>🏭</span>
                CONSOMMATION TOTALE
            </div>
            
            <!-- Graphique -->
            <div style="padding: 24px;">
                <div style="margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h4 style="margin: 0; font-size: 16px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 20px;">📈</span>
                            <span style="font-weight: 700;">Évolution de la consommation</span>
                        </h4>
                        <span style="font-size: 12px; color: #64748b; background: #f1f5f9; padding: 4px 12px; border-radius: 30px;">${totalJours} jours analysés</span>
                    </div>
                    <div style="height: 350px; position: relative;">
                        <canvas id="clientTrendChart"></canvas>
                    </div>
                </div>
            </div>
            
            <!-- Section dimensionnement / répartition par kit -->
            <div style="margin: 0 24px 24px 24px; background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                <div style="background: linear-gradient(135deg, ${dominantColor}10 0%, white 100%); padding: 20px 24px; border-bottom: 3px solid ${dominantColor}; display: flex; align-items: center; gap: 20px;">
                    <div style="width: 56px; height: 56px; background: ${dominantColor}; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px ${dominantColor}60;">
                        <span style="font-size: 28px; color: white;">📊</span>
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 8px; flex-wrap: wrap;">
                            <span style="font-size: 14px; color: #475569; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;">Répartition par kit</span>
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;">
                            <span style="font-size: 14px; color: #475569; background: white; padding: 6px 14px; border-radius: 40px; border: 1px solid ${dominantColor}20; font-weight: 600;">
                                Pic: <span style="font-weight: 800; color: ${dominantColor};">${Math.round(maxEnergyValue)} Wh</span> (${maxKitReached || 'N/A'})
                            </span>
                            <span style="font-size: 12px; color: #64748b; background: #f8fafc; padding: 6px 14px; border-radius: 40px; border: 1px solid #e2e8f0;">
                                ${totalJours} jours
                            </span>
                        </div>
                    </div>
                </div>
                
                <div style="padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h5 style="margin: 0; font-size: 16px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 20px;">📊</span>
                            <span style="font-weight: 700;">Répartition détaillée par kit</span>
                        </h5>
                        <span style="font-size: 12px; color: #475569; background: #f8fafc; padding: 6px 16px; border-radius: 40px; border: 1px solid #e2e8f0;">📋 ${totalJours} jours de consommation</span>
                    </div>
                    ${renderCumulativeBar()}
                </div>
            </div>
            
            <!-- ✅ Bouton Voir détail (toggle) -->
            <div style="padding: 0 24px 24px 24px;">
                <button id="toggle-${detailsId}" style="width: 100%; padding: 12px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; font-weight: 600; font-size: 13px; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
                    <span style="font-size: 14px;">📋</span> Voir le détail par client
                    <span style="font-size: 12px;">▼</span>
                </button>
            </div>
            
            <!-- Tableau des détails (caché par défaut) -->
            <div id="${detailsId}" style="display: none; padding: 0 24px 24px 24px;">
                <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e9ecef; border-radius: 12px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                        <thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 10;">
                            <tr>
                                <th style="padding: 12px; text-align: left;">Date</th>
                                ${clientAnalyticsInstance.processedClients.map(id => `<th style="padding: 12px; text-align: right;">Client ${id}</th>`).join('')}
                                <th style="padding: 12px; text-align: right; background: #e9ecef;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clientAnalyticsInstance.processedDates.map((date, idx) => {
                                let rowTotal = 0;
                                const isEven = idx % 2 === 0;
                                return `
                                    <tr style="background: ${isEven ? '#ffffff' : '#f8f9fa'};">
                                        <td style="padding: 8px 12px; font-weight: 500;">${date}</td>
                                        ${clientAnalyticsInstance.processedClients.map(id => {
                                            const val = clientAnalyticsInstance.clientDaily[date][id] || 0;
                                            rowTotal += val;
                                            return `<td style="padding: 8px 12px; text-align: right;">${val.toFixed(0)}</td>`;
                                        }).join('')}
                                        <td style="padding: 8px 12px; text-align: right; font-weight: 700; background: #f1f3f5;">${rowTotal.toFixed(0)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    // ✅ Gestion du toggle (affichage/masquage des détails)
    const toggleBtn = document.getElementById(`toggle-${detailsId}`);
    const detailsDiv = document.getElementById(detailsId);
    if (toggleBtn && detailsDiv) {
        toggleBtn.onclick = () => {
            const isVisible = detailsDiv.style.display !== 'none';
            detailsDiv.style.display = isVisible ? 'none' : 'block';
            toggleBtn.innerHTML = isVisible 
                ? `<span style="font-size: 14px;">📋</span> Voir le détail par client <span style="font-size: 12px;">▼</span>`
                : `<span style="font-size: 14px;">📋</span> Masquer le détail par client <span style="font-size: 12px;">▲</span>`;
        };
    }
}

function createClientTrendChart() {
    const ctx = document.getElementById('clientTrendChart')?.getContext('2d');
    if (!ctx) return;
    
    const profile = clientAnalyticsInstance.getSiteProfile();
    const dates = clientAnalyticsInstance.processedDates;
    const dailyValues = profile.history.map(d => d.consumption);
    const totalJours = dailyValues.length;
    
    const tousLesKits = [
        { label: 'Kit 0', value: 250, color: '#FF6B6B' },
        { label: 'Kit 1', value: 360, color: '#FFA726' },
        { label: 'Kit 2', value: 540, color: '#FFD93D' },
        { label: 'Kit 3', value: 720, color: '#4ECDC4' },
        { label: 'Kit 4', value: 1080, color: '#667eea' }
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
    const maxDataValue = Math.max(...dailyValues.filter(v => v > 0));
    
    // Ajuster pour afficher le kit suivant si nécessaire
    let finalVisibleKits = [...visibleKits];
    if (maxDataValue > visibleKits[visibleKits.length - 1]?.value) {
        const nextKitIndex = tousLesKits.findIndex(k => k.value === visibleKits[visibleKits.length - 1]?.value) + 1;
        if (nextKitIndex < tousLesKits.length) {
            finalVisibleKits.push(tousLesKits[nextKitIndex]);
        }
    }
    
    const kitDatasets = finalVisibleKits.map(kit => ({
        label: kit.label,
        data: Array(dates.length).fill(kit.value),
        borderColor: kit.color,
        borderWidth: 2.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        order: 2
    }));
    
    const pointBackgroundColors = dailyValues.map(value => {
        if (value === 0 || value == null) return '#CBD5E0';
        const matchingKit = finalVisibleKits.find(kit => value <= kit.value);
        return matchingKit ? matchingKit.color : '#1f2933';
    });
    
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
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.05)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 7,
                        pointBackgroundColor: pointBackgroundColors,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHoverBackgroundColor: '#764ba2',
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 3,
                        order: 1
                    },
                    ...kitDatasets
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 1000, easing: 'easeInOutQuart' },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { size: 13, weight: 'bold' },
                            color: '#2c3e50',
                            padding: 15,
                            usePointStyle: true,
                            filter: (item) => item.text !== 'Consommation'
                        },
                        onClick: function(e, legendItem, legend) {
                            if (legendItem.datasetIndex === 0) {
                                const meta = legend.chart.getDatasetMeta(legendItem.datasetIndex);
                                meta.hidden = meta.hidden === null ? !legend.chart.data.datasets[legendItem.datasetIndex].hidden : null;
                                legend.chart.update();
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(45, 55, 72, 0.95)',
                        padding: 14,
                        titleFont: { size: 15, weight: 'bold', color: '#fff' },
                        bodyFont: { size: 13, color: '#e2e8f0' },
                        cornerRadius: 8,
                        displayColors: true,
                        borderColor: 'rgba(102, 126, 234, 0.5)',
                        borderWidth: 1,
                        caretSize: 8,
                        callbacks: {
                            title: (items) => {
                                const date = dates[items[0].dataIndex];
                                return '📊 ' + new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                            },
                            label: (context) => {
                                if (context.dataset.label === 'Consommation') {
                                    const value = context.raw;
                                    const idx = context.dataIndex;
                                    const date = dates[idx];
                                    
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
                            },
                            afterLabel: function(context) {
                                if (context.dataset.label === 'Consommation') {
                                    const value = context.raw;
                                    const maxValue = Math.max(...dailyValues);
                                    if (value === maxValue && maxValue > 0) {
                                        return '🏆 Consommation maximale enregistrée';
                                    }
                                }
                                return null;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { 
                            font: { size: 12, weight: '500' }, 
                            color: '#718096',
                            callback: value => value.toLocaleString('fr-FR') + ' Wh',
                            padding: 10
                        },
                        grid: { color: 'rgba(102, 126, 234, 0.08)', lineWidth: 1.5, borderDash: [5, 5] },
                        border: { display: false },
                        title: { display: true, text: 'Consommation (Wh)', font: { size: 13, weight: 'bold' }, color: '#2c3e50', padding: 12 }
                    },
                    x: {
                        ticks: { 
                            font: { size: 12, weight: '500' }, 
                            color: '#718096',
                            maxRotation: 45,
                            minRotation: 0,
                            padding: 8
                        },
                        grid: { display: false, drawBorder: false },
                        border: { display: true, color: 'rgba(113, 128, 150, 0.2)' },
                        title: { display: true, text: 'Dates', font: { size: 13, weight: 'bold' }, color: '#2c3e50', padding: 12 }
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
// RENDER DU CYCLE DE CONSOMMATION
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
    
    // 🔥 1. MOYENNE PAR INTERVALLE (déjà dispo)
    const moyenneIntervalle = averageStats.avg;
    
    // 🔥 2. JOUR / NUIT avec pourcentages basés sur l'énergie TOTALE (Wh)
    let totalEnergyDay = 0;
    let totalEnergyNight = 0;
    for (let i = currentManager.startIndex; i <= currentManager.endIndex; i++) {
        const hours = currentManager.allHoursData[i]?.hours || [];
        hours.forEach(hour => {
            if (hour.hour >= 6 && hour.hour < 18) {
                totalEnergyDay += hour.value;
            } else {
                totalEnergyNight += hour.value;
            }
        });
    }
    const totalEnergyAll = totalEnergyDay + totalEnergyNight;
    const dayPercent = totalEnergyAll > 0 ? (totalEnergyDay / totalEnergyAll * 100) : 0;
    const nightPercent = totalEnergyAll > 0 ? (totalEnergyNight / totalEnergyAll * 100) : 0;
    
    // 🔥 3. MOYENNE 22h-23h (heure spécifique)
    let hour22Total = 0;
    let hour22Count = 0;
    let hour23Total = 0;
    let hour23Count = 0;
    for (let i = currentManager.startIndex; i <= currentManager.endIndex; i++) {
        const hours = currentManager.allHoursData[i]?.hours || [];
        hours.forEach(hour => {
            if (hour.hour === 22) {
                hour22Total += hour.value;
                hour22Count++;
            }
            if (hour.hour === 23) {
                hour23Total += hour.value;
                hour23Count++;
            }
        });
    }
    const avg22_23 = (hour22Total + hour23Total) / (hour22Count + hour23Count) || 0;
    
    // 🔥 4. MAX OBSERVÉ
    let maxObservedValue = 0;
    let maxObservedDate = '';
    let maxObservedHour = '';
    for (let i = currentManager.startIndex; i <= currentManager.endIndex; i++) {
        const date = currentManager.allDates[i];
        const hours = currentManager.allHoursData[i]?.hours || [];
        hours.forEach(hour => {
            if (hour.value > maxObservedValue) {
                maxObservedValue = hour.value;
                maxObservedDate = date;
                maxObservedHour = hour.label;
            }
        });
    }
    
    // 🔥 5. MOYENNE DES MAX QUOTIDIENS
    let dailyMaxSum = 0;
    let dailyMaxCount = 0;
    for (let i = currentManager.startIndex; i <= currentManager.endIndex; i++) {
        const hours = currentManager.allHoursData[i]?.hours || [];
        let dayMax = 0;
        hours.forEach(hour => {
            if (hour.value > dayMax) dayMax = hour.value;
        });
        if (dayMax > 0) {
            dailyMaxSum += dayMax;
            dailyMaxCount++;
        }
    }
    const moyenneDesMax = dailyMaxCount > 0 ? (dailyMaxSum / dailyMaxCount) : 0;
    
    const chartContentId = `cycle-chart-content-${Date.now()}`;
    
    container.innerHTML = `
        <div style="background: white; border-radius: 16px; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <!-- En-tête -->
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 15px 25px; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 20px;">⚡</span>
                    <span>CYCLE DE CONSOMMATION</span>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">
                        ${dates.count} JOUR${dates.count > 1 ? 'S' : ''}
                    </span>
                </div>
            </div>
            
            <!-- Badge période -->
            <div style="background: #f8fafc; padding: 10px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <div style="background: #f59e0b; color: white; padding: 6px 15px; border-radius: 30px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">📅</span>
                    <span>${formatFrenchDate(dates.start)} → ${formatFrenchDate(dates.end)}</span>
                </div>
            </div>
            
            <!-- 🔥 6 INDICATEURS SUR UNE SEULE LIGNE -->
            <div style="padding: 20px 24px 0 24px;">
                <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 20px;">
                    
                    <!-- 1. Moyenne par intervalle -->
                    <div style="background: linear-gradient(135deg, #fef3c7, #fffbeb); border-radius: 12px; padding: 12px; text-align: center; border-left: 4px solid #f59e0b;">
                        <div style="font-size: 10px; color: #d97706; font-weight: 600;">📊 MOYENNE INTERVALLE</div>
                        <div style="font-size: 22px; font-weight: 800; color: #f59e0b;">${moyenneIntervalle.toFixed(1)} <span style="font-size: 10px;">Wh/h</span></div>
                    </div>
                    
                    <!-- 2. Jour -->
                    <div style="background: linear-gradient(135deg, #fff7ed, #fffbeb); border-radius: 12px; padding: 12px; text-align: center; border-left: 4px solid #f59e0b;">
                        <div style="font-size: 10px; color: #d97706; font-weight: 600;">🌅 JOUR (6h-18h)</div>
                        <div style="font-size: 22px; font-weight: 800; color: #f59e0b;">${dayNightAverages.day.toFixed(1)} <span style="font-size: 10px;">Wh/h</span></div>
                        <div style="font-size: 11px; font-weight: 600; color: #f59e0b;">${dayPercent.toFixed(1)}%</div>
                        <div style="margin-top: 4px; background: #e2e8f0; border-radius: 20px; height: 4px; overflow: hidden;">
                            <div style="width: ${dayPercent}%; background: #f59e0b; height: 100%;"></div>
                        </div>
                    </div>
                    
                    <!-- 3. Nuit -->
                    <div style="background: linear-gradient(135deg, #eff6ff, #f0f9ff); border-radius: 12px; padding: 12px; text-align: center; border-left: 4px solid #3b82f6;">
                        <div style="font-size: 10px; color: #2563eb; font-weight: 600;">🌙 NUIT (18h-6h)</div>
                        <div style="font-size: 22px; font-weight: 800; color: #3b82f6;">${dayNightAverages.night.toFixed(1)} <span style="font-size: 10px;">Wh/h</span></div>
                        <div style="font-size: 11px; font-weight: 600; color: #3b82f6;">${nightPercent.toFixed(1)}%</div>
                        <div style="margin-top: 4px; background: #e2e8f0; border-radius: 20px; height: 4px; overflow: hidden;">
                            <div style="width: ${nightPercent}%; background: #3b82f6; height: 100%;"></div>
                        </div>
                    </div>
                    
                    <!-- 4. Moyenne 22h-23h -->
                    <div style="background: linear-gradient(135deg, #fce7f3, #fdf2f8); border-radius: 12px; padding: 12px; text-align: center; border-left: 4px solid #ec4899;">
                        <div style="font-size: 10px; color: #db2777; font-weight: 600;">📅 22h-23h</div>
                        <div style="font-size: 22px; font-weight: 800; color: #ec4899;">${avg22_23.toFixed(1)} <span style="font-size: 10px;">Wh/h</span></div>
                    </div>
                    
                    <!-- 5. Max observé -->
                    <div style="background: linear-gradient(135deg, #fee2e2, #fef2f2); border-radius: 12px; padding: 12px; text-align: center; border-left: 4px solid #ef4444;">
                        <div style="font-size: 10px; color: #dc2626; font-weight: 600;">🔥 MAX OBSERVÉ</div>
                        <div style="font-size: 22px; font-weight: 800; color: #ef4444;">${maxObservedValue.toFixed(1)} <span style="font-size: 10px;">Wh/h</span></div>
                        <div style="font-size: 9px; color: #64748b;">${formatFrenchDate(maxObservedDate)} ${maxObservedHour}</div>
                    </div>
                    
                    <!-- 6. Moyenne des max -->
                    <div style="background: linear-gradient(135deg, #e0f2fe, #f0f9ff); border-radius: 12px; padding: 12px; text-align: center; border-left: 4px solid #0ea5e9;">
                        <div style="font-size: 10px; color: #0284c7; font-weight: 600;">📈 MOYENNE DES MAX</div>
                        <div style="font-size: 22px; font-weight: 800; color: #0ea5e9;">${moyenneDesMax.toFixed(1)} <span style="font-size: 10px;">Wh/h</span></div>
                    </div>
                </div>
            </div>
            
            <!-- Filtres -->
            <div style="padding: 0 24px 20px 24px;">
                <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 180px;">
                        <label style="display: block; font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 6px;">📅 DATE DE DÉBUT</label>
                        <select id="cycleStartSelect" style="width: 100%; padding: 10px 14px; border: 2px solid #e2e8f0; border-radius: 10px; background: white; font-size: 13px; cursor: pointer;">
                            ${currentManager.allDates.map((d,i)=>`<option value="${i}" ${i===currentManager.startIndex?'selected':''}>${formatFrenchDate(d)}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 180px;">
                        <label style="display: block; font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 6px;">📅 DATE DE FIN</label>
                        <select id="cycleEndSelect" style="width: 100%; padding: 10px 14px; border: 2px solid #e2e8f0; border-radius: 10px; background: white; font-size: 13px; cursor: pointer;">
                            ${currentManager.allDates.map((d,i)=>`<option value="${i}" ${i===currentManager.endIndex?'selected':''}>${formatFrenchDate(d)}</option>`).join('')}
                        </select>
                    </div>
                    <button id="cycleApplyBtn" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; padding: 10px 28px; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(245,158,11,0.3);">
                        APPLIQUER
                    </button>
                </div>
            </div>
            
            <!-- Section CONSOMMATION CUMULÉE (toggle) -->
            <div style="padding: 0 24px 0 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; cursor: pointer;" onclick="toggleCycleChart('${chartContentId}', this)">
                    <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                        <span>📈</span>
                        CONSOMMATION CUMULÉE
                    </h4>
                    <span class="cycle-chart-toggle" style="font-size: 1rem; transition: transform 0.2s; color: #f59e0b;">▶</span>
                </div>
                <div id="${chartContentId}" style="display: none;">
                    <div style="height: 350px; position: relative;">
                        <canvas id="dailyEnergyCycleChart"></canvas>
                    </div>
                </div>
            </div>
            
            <!-- Section MOYENNES HORAIRES -->
            <div style="padding: 20px 24px 24px 24px;">
                <h4 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #1e293b;">📊 MOYENNES HORAIRES</h4>
                <div style="height: 300px; position: relative;">
                    <canvas id="hourlyAverageChart"></canvas>
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
            // Forcer le redimensionnement du graphique après l'affichage
            setTimeout(() => {
                const chart = chartManager.instances['dailyEnergyCycleChart'];
                if (chart && chart.resize) chart.resize();
            }, 100);
        } else {
            content.style.display = 'none';
            if (toggleIcon) {
                toggleIcon.style.transform = 'rotate(0deg)';
                toggleIcon.innerHTML = '▶';
            }
        }
    }
};

function updateAverageChart() {
    if (!currentManager) return;
    const ctx = document.getElementById('hourlyAverageChart')?.getContext('2d');
    if (!ctx) return;
    
    // 🔥 ÉTAPE 1 : Construire les données comme dans hourlyChart (un dataset par jour)
    const datasets = [];
    const allLabels = [];
    const allTimestamps = [];
    const dayStartPositions = [];
    
    // Palette de couleurs identique à hourlyChart
    const colorPalette = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
    ];
    
    // Parcourir chaque jour de la plage sélectionnée
    for (let i = currentManager.startIndex; i <= currentManager.endIndex; i++) {
        const date = currentManager.allDates[i];
        const dayData = currentManager.allHoursData[i];
        
        // Créer les points pour ce jour (moyennes horaires)
        const dayPoints = [];
        dayData.hours.forEach((hour, hourIdx) => {
            // Pour les moyennes, on prend la valeur horaire (value) pas le cumul
            if (hour.value > 0 || true) {  // Garder toutes les heures pour l'axe X
                const timestamp = new Date(`${date}T${hour.label.padStart(2, '0')}:00:00`).getTime();
                const label = `${date} ${hour.label}`;
                dayPoints.push({
                    timestamp: timestamp,
                    label: label,
                    value: hour.value  // Valeur horaire (Wh)
                });
            }
        });
        
        if (dayPoints.length === 0) continue;
        
        // Ajouter les labels uniques dans l'ordre global
        dayPoints.forEach(point => {
            if (!allLabels.includes(point.label)) {
                allLabels.push(point.label);
                allTimestamps.push(point.timestamp);
            }
        });
        
        const color = colorPalette[(i - currentManager.startIndex) % colorPalette.length];
        
        // Mémoriser la position du début du jour
        if (dayPoints.length > 0) {
            dayStartPositions.push({
                date: date,
                position: allLabels.length - dayPoints.length
            });
        }
        
        datasets.push({
            label: date,
            data: dayPoints.map(p => p.value),
            borderColor: color,
            backgroundColor: `${color}20`,  // Même couleur avec opacité pour le remplissage
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: dayPoints.map(() => color),
            pointBorderColor: 'white',
            pointBorderWidth: 1.5,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: true,                     // Remplissage activé
            order: 1,
            _timestamps: dayPoints.map(p => p.timestamp),
            _points: dayPoints
        });
    }
    
    // 🔥 ÉTAPE 2 : Trier tous les labels par timestamp
    const sortedPairs = allLabels.map((label, index) => ({
        label: label,
        timestamp: allTimestamps[index]
    })).sort((a, b) => a.timestamp - b.timestamp);
    
    const finalLabels = sortedPairs.map(p => p.label);
    
    // 🔥 ÉTAPE 3 : Réorganiser les données de chaque dataset
    datasets.forEach(dataset => {
        const reorderedData = [];
        sortedPairs.forEach(pair => {
            const matchingPoint = dataset._points.find(p => p.label === pair.label);
            reorderedData.push(matchingPoint ? matchingPoint.value : null);
        });
        dataset.data = reorderedData;
        
        // Recolorier les points
        dataset.pointBackgroundColor = reorderedData.map((value, idx) => {
            if (value === null) return 'transparent';
            return dataset.borderColor;
        });
        
        delete dataset._points;
        delete dataset._timestamps;
    });
    
    // 🔥 ÉTAPE 4 : Plugin pour afficher les dates en bas
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
                const labelIndex = finalLabels.findIndex(label => label.startsWith(pos.date));
                if (labelIndex !== -1) {
                    const x = scales.x.getPixelForValue(labelIndex);
                    if (x >= chartArea.left && x <= chartArea.right) {
                        const [year, month, day] = pos.date.split('-');
                        ctx.fillText(`${day}/${month}/${year}`, x, chartArea.bottom + 18);
                    }
                }
            });
            ctx.restore();
        }
    };
    
    const config = {
        type: 'line',  // On passe en line pour avoir le remplissage (comme pour le cumulé)
        data: {
            labels: finalLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeInOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 11, weight: 'bold' },
                        color: '#1e293b',
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: (context) => context[0].label,
                        label: (context) => {
                            const value = context.parsed.y;
                            if (value === null) return null;
                            return `⚡ ${value.toFixed(1)} Wh/h`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.06)' },
                    title: {
                        display: true,
                        text: 'Moyenne (Wh/h)',
                        font: { size: 12, weight: 'bold' },
                        color: '#475569'
                    },
                    ticks: {
                        font: { size: 11 },
                        color: '#64748b'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 10 },
                        color: '#64748b',
                        maxRotation: 45,
                        minRotation: 30,
                        maxTicksLimit: 20,
                        callback: function(val, index) {
                            const label = finalLabels[index];
                            if (label && index % Math.floor(finalLabels.length / 15) === 0) {
                                const [, hour] = label.split(' ');
                                if (hour === '00:00' || hour === '06:00' || hour === '12:00' || hour === '18:00') {
                                    return hour;
                                }
                                return label.split(' ')[1];
                            }
                            return '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date et Heure',
                        font: { size: 12, weight: 'bold' },
                        color: '#475569',
                        padding: { top: 10 }
                    }
                }
            }
        },
        plugins: [dateLabelPlugin]
    };
    
    chartManager.destroy('hourlyAverageChart');
    requestAnimationFrame(() => {
        chartManager.create('hourlyAverageChart', config);
    });
}

function updateCycleChart() {
    if (!currentManager) return;
    const ctx = document.getElementById('dailyEnergyCycleChart')?.getContext('2d');
    if (!ctx) return;
    
    // 🔥 ÉTAPE 1 : Construire les données comme dans hourlyChart
    // Un dataset par jour, avec des points uniquement aux heures où on a des données
    const datasets = [];
    const allLabels = [];
    const allTimestamps = [];
    const dayStartPositions = [];
    
    // Parcourir chaque jour de la plage sélectionnée
    for (let i = currentManager.startIndex; i <= currentManager.endIndex; i++) {
        const date = currentManager.allDates[i];
        const dayData = currentManager.allHoursData[i];
        
        // Créer les points pour ce jour avec leurs timestamps
        const dayPoints = [];
        dayData.hours.forEach((hour, hourIdx) => {
            if (hour.value > 0 || hour.cumul > 0) {  // Garder les points avec données
                const timestamp = new Date(`${date}T${hour.label.padStart(2, '0')}:00:00`).getTime();
                const label = `${date} ${hour.label}`;
                dayPoints.push({
                    timestamp: timestamp,
                    label: label,
                    value: hour.cumul  // Valeur cumulée
                });
            }
        });
        
        if (dayPoints.length === 0) continue;
        
        // Ajouter les labels uniques dans l'ordre global
        dayPoints.forEach(point => {
            if (!allLabels.includes(point.label)) {
                allLabels.push(point.label);
                allTimestamps.push(point.timestamp);
            }
        });
        
        // Couleur basée sur l'index du jour (comme hourlyChart)
        const colorPalette = [
            '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
            '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
        ];
        const color = colorPalette[(i - currentManager.startIndex) % colorPalette.length];
        
        // Mémoriser la position du début du jour pour les labels
        if (dayPoints.length > 0) {
            dayStartPositions.push({
                date: date,
                position: allLabels.length - dayPoints.length
            });
        }
        
        datasets.push({
            label: date,
            data: dayPoints.map(p => p.value),
            borderColor: color,
            backgroundColor: `${color}20`,   // 20 = environ 12% d'opacité
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: dayPoints.map(() => color),
            pointBorderColor: 'white',
            pointBorderWidth: 1.5,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: true,                      // ← active le remplissage
            order: 1,
            _timestamps: dayPoints.map(p => p.timestamp),
            _points: dayPoints
        });
    }
    
    // 🔥 ÉTAPE 2 : Trier tous les labels par timestamp
    const sortedPairs = allLabels.map((label, index) => ({
        label: label,
        timestamp: allTimestamps[index]
    })).sort((a, b) => a.timestamp - b.timestamp);
    
    const finalLabels = sortedPairs.map(p => p.label);
    
    // 🔥 ÉTAPE 3 : Réorganiser les données de chaque dataset dans l'ordre global
    datasets.forEach(dataset => {
        const reorderedData = [];
        sortedPairs.forEach(pair => {
            const matchingPoint = dataset._points.find(p => p.label === pair.label);
            reorderedData.push(matchingPoint ? matchingPoint.value : null);
        });
        dataset.data = reorderedData;
        
        // Recolorier les points
        dataset.pointBackgroundColor = reorderedData.map((value, idx) => {
            if (value === null) return 'transparent';
            return dataset.borderColor;
        });
        
        delete dataset._points;
        delete dataset._timestamps;
    });
    
    // 🔥 ÉTAPE 4 : Plugin pour afficher les dates en bas (comme hourlyChart)
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
                // Trouver l'index approximatif dans les labels finaux
                const labelIndex = finalLabels.findIndex(label => label.startsWith(pos.date));
                if (labelIndex !== -1) {
                    const x = scales.x.getPixelForValue(labelIndex);
                    if (x >= chartArea.left && x <= chartArea.right) {
                        const [year, month, day] = pos.date.split('-');
                        ctx.fillText(`${day}/${month}/${year}`, x, chartArea.bottom + 18);
                    }
                }
            });
            ctx.restore();
        }
    };
    
    const config = {
        type: 'line',
        data: {
            labels: finalLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeInOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 11, weight: 'bold' },
                        color: '#1e293b',
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: (context) => context[0].label,
                        label: (context) => {
                            const value = context.parsed.y;
                            if (value === null) return null;
                            const breakdown = getClientBreakdownAtDateTime(context.label);
                            if (breakdown && Object.keys(breakdown.clients).length > 0) {
                                const clientLines = Object.entries(breakdown.clients)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([clientId, val]) => {
                                        const percent = (val / breakdown.total * 100).toFixed(1);
                                        return `  Client ${clientId}: ${val.toFixed(0)} Wh (${percent}%)`;
                                    });
                                return [`⚡ Total: ${value.toFixed(0)} Wh`, `──────────────`, ...clientLines];
                            }
                            return `⚡ ${value.toFixed(0)} Wh`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.06)' },
                    title: {
                        display: true,
                        text: 'Wh cumulés',
                        font: { size: 12, weight: 'bold' },
                        color: '#475569'
                    },
                    ticks: {
                        font: { size: 11 },
                        color: '#64748b'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 10 },
                        color: '#64748b',
                        maxRotation: 45,
                        minRotation: 30,
                        maxTicksLimit: 20,
                        callback: function(val, index) {
                            const label = finalLabels[index];
                            if (label && index % Math.floor(finalLabels.length / 15) === 0) {
                                const [, hour] = label.split(' ');
                                if (hour === '00:00' || hour === '06:00' || hour === '12:00' || hour === '18:00') {
                                    return hour;
                                }
                                return label.split(' ')[1];
                            }
                            return '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date et Heure',
                        font: { size: 12, weight: 'bold' },
                        color: '#475569',
                        padding: { top: 10 }
                    }
                }
            }
        },
        plugins: [dateLabelPlugin]
    };
    
    chartManager.destroy('dailyEnergyCycleChart');
    requestAnimationFrame(() => {
        chartManager.create('dailyEnergyCycleChart', config);
    });
}

/*
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
    
    // Plugin pour afficher les dates en bas (style identique)
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
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245,158,11,0.05)',
                borderWidth: 2.5, 
                pointRadius: 2, 
                pointHoverRadius: 6,
                pointBackgroundColor: '#f59e0b',
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
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 8,
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
                            const total = ctx.raw;
                            
                            // Récupérer la répartition par client
                            const breakdown = getClientBreakdownAtDateTime(data.labels[idx]);
                            
                            if (breakdown && Object.keys(breakdown.clients).length > 0) {
                                const clientLines = Object.entries(breakdown.clients)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([clientId, value]) => {
                                        const percent = (value / breakdown.total * 100).toFixed(1);
                                        return `  Client ${clientId}: ${value.toFixed(0)} Wh (${percent}%)`;
                                    });
                                
                                return [
                                    `⚡ Total: ${total.toFixed(0)} Wh`,
                                    `──────────────`,
                                    ...clientLines
                                ];
                            }
                            
                            return `⚡ ${total.toFixed(0)} Wh`;
                        }
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    grid: { color: 'rgba(245,158,11,0.1)' },
                    title: { display: true, text: 'Wh cumulés', font: { size: 10, weight: 'bold' }, color: '#475569' }
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
                        color: '#64748b'
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
    
    // Palette de couleurs pour les barres (dégradé de orange)
    const barColors = averages.map((_, idx) => {
        const intensity = 0.5 + (idx % 24) / 48;
        return `rgba(245, 158, 11, ${intensity})`;
    });
    
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
                    backgroundColor: barColors,
                    borderColor: '#f59e0b',
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
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleFont: { size: 12, weight: 'bold' },
                        bodyFont: { size: 11 },
                        padding: 10,
                        cornerRadius: 8,
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
                                return `⚡ ${value.toFixed(1)} Wh/h`;
                            }
                        }
                    },
                    legend: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        title: { display: true, text: 'Moyenne (Wh/h)', font: { size: 10, weight: 'bold' }, color: '#475569' },
                        grid: { color: 'rgba(245,158,11,0.1)' },
                        ticks: { font: { size: 10 } }
                    },
                    x: {
                        title: { display: true, text: 'Heure', font: { size: 10, weight: 'bold' }, color: '#475569' },
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
*/
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
            const allDataPoints = currentManager.getAllDataPoints ? currentManager.getAllDataPoints() : [];
            
            // Mettre à jour l'affichage de la plage
            const badgeContainer = document.querySelector('#energyCycleBoard [style*="background: #f8fafc; padding: 10px 20px"]');
            if (badgeContainer) {
                const periodBadge = badgeContainer.querySelector('[style*="background: #f59e0b"]');
                if (periodBadge) {
                    periodBadge.innerHTML = `
                        <span style="font-size: 16px;">📅</span>
                        <span>${dates.start} → ${dates.end}</span>
                        <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px;">
                            ${dates.count}j · ${allDataPoints.length} points
                        </span>
                    `;
                }
            }
            
            // Mettre à jour l'en-tête
            const header = document.querySelector('#energyCycleBoard [style*="background: linear-gradient(135deg, #f59e0b"]');
            if (header) {
                const badges = header.querySelectorAll('[style*="background: rgba(255,255,255,0.2)"]');
                if (badges[0]) badges[0].innerHTML = `${dates.count} JOUR${dates.count > 1 ? 'S' : ''}`;
            }
            
            // Mettre à jour les statistiques
            const statsDiv = document.querySelector('#energyCycleBoard [style*="background: #f8fafc; border-top: 1px solid #e2e8f0; display: grid"]');
            if (statsDiv) {
                statsDiv.innerHTML = `
                    <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📊 MOYENNE HORAIRE</div>
                        <div style="font-size: 18px; font-weight: 700; color: #f59e0b;">${averageStats.avg.toFixed(1)} <span style="font-size: 11px;">Wh/h</span></div>
                        <div style="font-size: 10px; color: #475569;">sur ${dates.count} jours</div>
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #ef4444;">
                        <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">⬆️ MAXIMUM HORAIRE</div>
                        <div style="font-size: 18px; font-weight: 700; color: #ef4444;">${averageStats.max.toFixed(1)} <span style="font-size: 11px;">Wh/h</span></div>
                        <div style="font-size: 10px; color: #475569;">pic enregistré</div>
                    </div>
                    <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                        <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">📈 TOTAL</div>
                        <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${(averageStats.avg * 24 * dates.count).toFixed(0)} <span style="font-size: 11px;">Wh</span></div>
                        <div style="font-size: 10px; color: #475569;">énergie cumulée</div>
                    </div>
                `;
            }
            
            // Mettre à jour les périodes Jour/Nuit
            const periodStats = document.querySelector('#energyCycleBoard [style*="border-top: 1px solid #e2e8f0;"]:last-child');
            if (periodStats) {
                periodStats.innerHTML = `
                    <h4 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #1e293b;">🌓 MOYENNES PAR PÉRIODE</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div style="background: linear-gradient(135deg, #fff7ed, #fffbeb); border-radius: 12px; padding: 16px; border-left: 4px solid #f59e0b;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 2rem;">☀️</span>
                                <div>
                                    <div style="font-size: 11px; color: #f59e0b; font-weight: 600; text-transform: uppercase;">JOUR (6h-18h)</div>
                                    <div style="font-size: 20px; font-weight: 700; color: #f59e0b;">${dayNightAverages.day.toFixed(1)} <span style="font-size: 11px;">Wh/h</span></div>
                                    <div style="font-size: 10px; color: #64748b;">moyenne horaire</div>
                                </div>
                            </div>
                        </div>
                        <div style="background: linear-gradient(135deg, #eff6ff, #f0f9ff); border-radius: 12px; padding: 16px; border-left: 4px solid #3b82f6;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 2rem;">🌙</span>
                                <div>
                                    <div style="font-size: 11px; color: #3b82f6; font-weight: 600; text-transform: uppercase;">NUIT (18h-6h)</div>
                                    <div style="font-size: 20px; font-weight: 700; color: #3b82f6;">${dayNightAverages.night.toFixed(1)} <span style="font-size: 11px;">Wh/h</span></div>
                                    <div style="font-size: 10px; color: #64748b;">moyenne horaire</div>
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
