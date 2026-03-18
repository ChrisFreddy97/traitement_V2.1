// dashboards/technical/TechnicalDashboard.js
import { database } from '../../arduinoCore.js';
import { VOLTAGE_NORMS } from '../../arduinoConstants.js';
import { getEnergyStats, parseIntensiteForTable, parseTensionForTable, alignData } from '../../analytics/energyAnalytics.js';

// ===========================================
// STYLE UNIFIÉ POUR TOUS LES GRAPHIQUES
// ===========================================

const CHART_STYLE = {
    colors: {
        primary: '#3b82f6',     // Donnée principale (bleu)
        secondary: '#f59e0b',   // Donnée secondaire (orange)
        min: '#64748b',         // Minimum (gris)
        max: '#ef4444',         // Maximum (rouge)
        avg: '#10b981',         // Moyenne (vert)
        threshold: '#94a3b8',   // Seuils (gris clair)
        reference: '#6b7280',   // Lignes de référence (gris foncé)
        excellent: '#22c55e',   // Excellent (vert vif)
        bon: '#eab308',         // Bon (jaune)
        mauvais: '#f97316',     // Mauvais (orange)
        critique: '#ef4444'     // Critique (rouge)
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
// MANAGER DE GRAPHIQUES (ÉVITE LES FUITES MEMOIRE)
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
// RENDER DASHBOARD PRINCIPAL
// ===========================================

export function renderTechnicalDashboard() {
    const container = document.getElementById('technicalDashboard');
    if (!container) return;

    if (document.querySelector('.tab.active')?.dataset.tab !== 'Technique') {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `        
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
        <div id="energyBoard" class="card"></div>
        <div id="energyCycleBoard" class="card"></div>
        <div id="combinedEnergyTable" class="card"></div>

    `;


    // Vos render existants
    renderInfoCard();
    renderConformityCard();
    renderNormsCard();
    renderLoadSheddingBoard();
    renderHighVoltageBoard();
    renderDailyChart();
    renderHourlyChart();
    renderEnergyBoard();
    renderCombinedEnergyTable();
    renderDailyEnergyCycle();
}

// ===========================================
// FONCTIONS UTILITAIRES POUR LES BOUTONS DE DÉTAIL
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
    
    // ===== RÉCUPÉRER LES STATS ÉNERGIE =====
    let maxEnergy = 0;
    let maxEnergyDate = '—';
    let avgEnergy = 0;
    
    const energyData = database.energyData?.parDate || {};
    const entries = Object.entries(energyData);
    
    if (entries.length > 0) {
        // Trouver le max et sa date
        let maxEntry = entries[0];
        entries.forEach(([date, data]) => {
            if (data.total > maxEntry[1].total) {
                maxEntry = [date, data];
            }
        });
        
        maxEnergy = maxEntry[1].total || 0;
        maxEnergyDate = maxEntry[0];
        
        // Calculer la moyenne
        const values = entries.map(([_, d]) => d.total || 0);
        avgEnergy = values.reduce((a, b) => a + b, 0) / values.length;
    }
    
    container.innerHTML = `
        <div class="info-grid" style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between;">
            <!-- Période -->
            <div class="info-item" style="flex: 1; min-width: 120px;">
                <span class="info-label">📅 Période</span>
                <span class="info-value">${data.daysCount || 0} j</span>
                <span class="info-sub">${data.chartData?.dates[0] || '??'}</span>
            </div>
            
            <!-- Clients -->
            <div class="info-item" style="flex: 1; min-width: 80px;">
                <span class="info-label">👥 Clients</span>
                <span class="info-value">${data.clientCount || 0}</span>
            </div>
            
            <!-- Tension moyenne -->
            <div class="info-item" style="flex: 1; min-width: 100px;">
                <span class="info-label">⚡ Tension moy</span>
                <span class="info-value">${data.globalAvg?.toFixed(1) || 0} V</span>
            </div>
            
            <!-- Tension min -->
            <div class="info-item" style="flex: 1; min-width: 90px;">
                <span class="info-label">⬇️ Min</span>
                <span class="info-value min">${data.globalMin?.toFixed(1) || 0} V</span>
            </div>
            
            <!-- Tension max -->
            <div class="info-item" style="flex: 1; min-width: 90px;">
                <span class="info-label">⬆️ Max</span>
                <span class="info-value max">${data.globalMax?.toFixed(1) || 0} V</span>
            </div>
            
            <!-- Énergie max + date -->
            <div class="info-item" style="flex: 1; min-width: 140px; background: #fff3e0; border-radius: 8px; padding: 5px 10px;">
                <span class="info-label">⚡ Énergie max</span>
                <span class="info-value warning">${maxEnergy.toFixed(0)} Wh</span>
                <span class="info-sub" style="font-size: 0.7rem;">${maxEnergyDate}</span>
            </div>
            
            <!-- Énergie moyenne -->
            <div class="info-item" style="flex: 1; min-width: 100px;">
                <span class="info-label">📊 Énergie moy</span>
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

    // Récupérer les valeurs de tension pour chaque jour
    const chartData = database.technicalData?.chartData;
    const tensionValues = {};
    if (chartData && chartData.dates) {
        chartData.dates.forEach((date, idx) => {
            tensionValues[date] = {
                min: chartData.mins[idx],
                max: chartData.maxs[idx],
                avg: chartData.avgs[idx]
            };
        });
    }

    // Fonction pour générer le tableau de détails avec valeurs
    const generateDetailsTable = (days, type, seuil) => {
        if (!days || days.length === 0) return '<p>Aucune donnée</p>';
        
        const rows = days.map(date => {
            const values = tensionValues[date] || { min: 'N/A', max: 'N/A', avg: 'N/A' };
            const valeur = type === 'max' ? values.max : (type === 'min' ? values.min : values.avg);
            return `
                <tr>
                    <td>${date}</td>
                    <td>${valeur} V</td>
                    <td><button class="chart-link" onclick="scrollToHourlyChart('${date}')">📈 Voir</button></td>
                </tr>
            `;
        }).join('');
        
        return `
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead><tr><th>Date</th><th>Valeur (V)</th><th></th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };

    container.innerHTML = `
        <h3 class="card-title">📊 CONFORMITÉ DU SYSTÈME</h3>
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
            <h4 class="section-subtitle">🔍 Causes de non-conformité</h4>
            <div class="grid-3 gap-15">
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⬆️</span>
                        <span class="cause-label">Surtension (>${norms.max}V)</span>
                        <span class="cause-count">${data.causes.max.length} jours</span>
                    </div>
                    ${createDetailButton('surtension-details', 'Voir détails')}
                    <div id="surtension-details" style="display:none; margin-top:10px;">
                        ${generateDetailsTable(data.causes.max, 'max', norms.max)}
                    </div>
                </div>
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⬇️</span>
                        <span class="cause-label">Sous-tension (<${norms.min}V)</span>
                        <span class="cause-count">${data.causes.min.length} jours</span>
                    </div>
                    ${createDetailButton('soustension-details', 'Voir détails')}
                    <div id="soustension-details" style="display:none; margin-top:10px;">
                        ${generateDetailsTable(data.causes.min, 'min', norms.min)}
                    </div>
                </div>
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⚡</span>
                        <span class="cause-label">Variation (>${norms.variationSeuil}V/h)</span>
                        <span class="cause-count">${data.causes.variation.length} jours</span>
                    </div>
                    ${createDetailButton('variation-details', 'Voir détails')}
                    <div id="variation-details" style="display:none; margin-top:10px;">
                        ${generateDetailsTable(data.causes.variation, 'avg', norms.variationSeuil)}
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
    let normSystem = '', normData = null;

    if (data.globalAvg >= 22 && data.globalAvg <= 29) { normSystem = '24V'; normData = VOLTAGE_NORMS['24V']; }
    else if (data.globalAvg >= 11 && data.globalAvg <= 15) { normSystem = '12V'; normData = VOLTAGE_NORMS['12V']; }

    if (!normData) {
        container.innerHTML = '<h3 class="card-title">🔋 Normes système</h3><p>Non déterminé</p>';
        return;
    }

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
    
    const data = database.technicalData?.loadShedding || { partiel:0, total:0, jours:[] };
    const totalJours = database.technicalData?.daysCount || 1;
    
    const joursAvecDelestage = data.jours.length;
    const pourcentageJours = ((joursAvecDelestage / totalJours) * 100).toFixed(1);
    const totalEvenements = data.partiel + data.total;
    const moyenneParJour = joursAvecDelestage > 0 ? (totalEvenements / joursAvecDelestage).toFixed(1) : 0;
    
    const partielPercent = totalEvenements > 0 ? (data.partiel / totalEvenements) * 100 : 0;
    const totalPercent = totalEvenements > 0 ? (data.total / totalEvenements) * 100 : 0;
    
    let severityLevel = 'low';
    let severityMessage = '';
    let severityColor = '';
    let severityBg = '';
    
    if (pourcentageJours >= 30) {
        severityLevel = 'critical';
        severityMessage = 'CRITIQUE';
        severityColor = '#f72585';
        severityBg = 'rgba(247, 37, 133, 0.1)';
    } else if (pourcentageJours >= 15) {
        severityLevel = 'high';
        severityMessage = 'ÉLEVÉ';
        severityColor = '#f44336';
        severityBg = 'rgba(244, 67, 54, 0.1)';
    } else if (pourcentageJours >= 5) {
        severityLevel = 'medium';
        severityMessage = 'MODÉRÉ';
        severityColor = '#ff9800';
        severityBg = 'rgba(255, 152, 0, 0.1)';
    } else {
        severityLevel = 'low';
        severityMessage = 'NORMAL';
        severityColor = '#4caf50';
        severityBg = 'rgba(76, 175, 80, 0.1)';
    }
    
    const joursTries = [...data.jours].sort((a, b) => new Date(b) - new Date(a));
    
    // Fonction pour regrouper les heures identiques
    const groupHeures = (heures) => {
        const compteur = {};
        heures.forEach(h => {
            compteur[h] = (compteur[h] || 0) + 1;
        });
        return Object.entries(compteur)
            .map(([heure, count]) => count > 1 ? `${heure} (x${count})` : heure)
            .join(' · ');
    };
    
    // Générer le tableau de détails avec heures groupées
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
                    <td>${date}</td>
                    <td>${partielJour}</td>
                    <td>${totalJour}</td>
                    <td>${totalEvJour}</td>
                    <td>${heuresTexte}</td>
                    <td><button class="chart-link" onclick="scrollToHourlyChart('${date}')">📈</button></td>
                </tr>
            `;
        }).join('');
    };
    
    container.innerHTML = `
        <div class="card load-shedding-card" style="border-left: 4px solid ${severityColor};">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 class="card-title" style="margin: 0;">
                    ⚡ ANALYSE DES DÉLESTAGES
                </h3>
                <span class="severity-badge" style="background: ${severityColor}; color: white; padding: 0.25rem 1rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600;">
                    NIVEAU ${severityMessage}
                </span>
            </div>
            
            <div class="global-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div class="stat-box" style="background: ${severityBg}; padding: 1rem; border-radius: var(--radius-lg); text-align: center; border: 1px solid ${severityColor}30;">
                    <div style="font-size: 0.8rem; color: var(--gray-600); text-transform: uppercase; letter-spacing: 0.5px;">Jours touchés</div>
                    <div style="font-size: 2rem; font-weight: 700; color: ${severityColor};">${joursAvecDelestage}</div>
                    <div style="font-size: 0.8rem; color: var(--gray-500);">sur ${totalJours} jours</div>
                </div>
                
                <div class="stat-box" style="background: ${severityBg}; padding: 1rem; border-radius: var(--radius-lg); text-align: center; border: 1px solid ${severityColor}30;">
                    <div style="font-size: 0.8rem; color: var(--gray-600); text-transform: uppercase; letter-spacing: 0.5px;">Total événements</div>
                    <div style="font-size: 2rem; font-weight: 700; color: ${severityColor};">${totalEvenements}</div>
                    <div style="font-size: 0.8rem; color: var(--gray-500);">Ø ${moyenneParJour}/jour</div>
                </div>
                
                <div class="stat-box" style="background: ${severityBg}; padding: 1rem; border-radius: var(--radius-lg); text-align: center; border: 1px solid ${severityColor}30;">
                    <div style="font-size: 0.8rem; color: var(--gray-600); text-transform: uppercase; letter-spacing: 0.5px;">Proportion</div>
                    <div style="font-size: 2rem; font-weight: 700; color: ${severityColor};">${pourcentageJours}%</div>
                    <div style="font-size: 0.8rem; color: var(--gray-500);">des jours analysés</div>
                </div>
            </div>
            
            <div style="margin-bottom: 2rem;">
                <h4 style="margin-bottom: 1rem; color: var(--dark); font-size: 1rem;">🔸 Répartition partielle vs totale</h4>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="width: 12px; height: 12px; background: #ff9800; border-radius: 3px; display: inline-block;"></span>
                        <span style="font-weight: 500;">Délestages partiels</span>
                    </div>
                    <div>
                        <span style="font-weight: 600;">${data.partiel}</span>
                        <span style="color: var(--gray-500); margin-left: 0.5rem;">(${partielPercent.toFixed(1)}%)</span>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="width: 12px; height: 12px; background: #f44336; border-radius: 3px; display: inline-block;"></span>
                        <span style="font-weight: 500;">Délestages totaux</span>
                    </div>
                    <div>
                        <span style="font-weight: 600;">${data.total}</span>
                        <span style="color: var(--gray-500); margin-left: 0.5rem;">(${totalPercent.toFixed(1)}%)</span>
                    </div>
                </div>
                
                <div style="margin: 1.5rem 0;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.9rem; color: var(--gray-600);">Partiel</span>
                        <div style="flex: 1; height: 30px; background: #f0f0f0; border-radius: 100px; overflow: hidden; display: flex;">
                            <div style="width: ${partielPercent}%; height: 100%; background: linear-gradient(90deg, #ffb74d, #ff9800); display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; color: white; font-size: 0.8rem; font-weight: 600;">
                                ${partielPercent > 8 ? partielPercent.toFixed(0)+'%' : ''}
                            </div>
                            <div style="width: ${totalPercent}%; height: 100%; background: linear-gradient(90deg, #f44336, #d32f2f); display: flex; align-items: center; padding-left: 10px; color: white; font-size: 0.8rem; font-weight: 600;">
                                ${totalPercent > 8 ? totalPercent.toFixed(0)+'%' : ''}
                            </div>
                        </div>
                        <span style="font-size: 0.9rem; color: var(--gray-600);">Total</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-top: 0.25rem;">
                        <span style="font-size: 0.8rem; color: #ff9800;">${data.partiel} événements partiels</span>
                        <span style="font-size: 0.8rem; color: #f44336;">${data.total} événements totaux</span>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="color: var(--dark); font-size: 1rem; margin: 0;">📋 DÉTAIL DES DÉLESTAGES PAR JOUR</h4>
                    <span style="background: ${severityBg}; color: ${severityColor}; padding: 0.25rem 0.75rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600;">
                        ${joursAvecDelestage} jour(s)
                    </span>
                </div>
                
                ${createDetailButton('loadshedding-details', 'Afficher le tableau détaillé')}
                
                <div id="loadshedding-details" style="display:none; margin-top:15px;">
                    ${joursAvecDelestage > 0 ? `
                        <div style="max-height: 400px; overflow-y: auto; border-radius: var(--radius-lg); border: 1px solid var(--gray-200);">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                                <thead style="position: sticky; top: 0; background: var(--gray-100); z-index: 1;">
                                    <tr>
                                        <th style="padding: 0.75rem 1rem; text-align: left;">Date</th>
                                        <th style="padding: 0.75rem 1rem; text-align: center;">Partiels</th>
                                        <th style="padding: 0.75rem 1rem; text-align: center;">Totaux</th>
                                        <th style="padding: 0.75rem 1rem; text-align: center;">Fréquence</th>
                                        <th style="padding: 0.75rem 1rem; text-align: left;">Heures</th>
                                        <th style="padding: 0.75rem 1rem; text-align: center;"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${generateDetailsRows()}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p style="text-align: center; padding: 2rem; color: var(--gray-400);">Aucun délestage détecté</p>'}
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

    const normSystem = data.normSystem||'12V';
    const seuil = normSystem==='24V'?28:14;
    const hvData = data.highVoltage||[];
    const totalJours = hvData.length || 1;

    const stats = {excellent:0,bon:0,mauvais:0,critique:0};
    hvData.forEach(d=>stats[d.qualite]++);

    const pourcentages = {
        excellent: ((stats.excellent / totalJours) * 100).toFixed(1),
        bon: ((stats.bon / totalJours) * 100).toFixed(1),
        mauvais: ((stats.mauvais / totalJours) * 100).toFixed(1),
        critique: ((stats.critique / totalJours) * 100).toFixed(1)
    };

    // Récupérer les valeurs de tension pour enrichir les détails
    const chartData = database.technicalData?.chartData;
    const tensionValues = {};
    if (chartData && chartData.dates) {
        chartData.dates.forEach((date, idx) => {
            tensionValues[date] = chartData.maxs[idx];
        });
    }

    // Générer le tableau de détails avec valeurs
    const generateDetailsRows = () => {
        return hvData.map(d => {
            const valeur = tensionValues[d.date] || 'N/A';
            return `
                <tr>
                    <td>${d.date}</td>
                    <td>${d.count}</td>
                    <td>${valeur} V</td>
                    <td>${d.qualite}</td>
                    <td><button class="chart-link" onclick="scrollToHourlyChart('${d.date}')">📈</button></td>
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
                            <th style="padding:10px;">Date</th>
                            <th style="padding:10px;">Compteur</th>
                            <th style="padding:10px;">Valeur max</th>
                            <th style="padding:10px;">Qualité</th>
                            <th style="padding:10px;"></th>
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
    requestAnimationFrame(()=>{
        createHighVoltageChart(hvData.map(d=>d.date).sort(), hvData.map(d=>d.count), seuil);
    });
}
function createHighVoltageChart(dates, counts, seuil) {
    chartManager.destroy('highVoltageChart');
    
    const ctx = document.getElementById('highVoltageChart')?.getContext('2d');
    if (!ctx) return;
    
    requestAnimationFrame(() => {
        chartManager.create('highVoltageChart', {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Dépassements par jour',
                        data: counts,
                        borderColor: CHART_STYLE.colors.secondary,
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        borderWidth: 2,
                        tension: 0.2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: counts.map(c => 
                            c >= 4 ? CHART_STYLE.colors.excellent :
                            c >= 2 ? CHART_STYLE.colors.bon :
                            c === 1 ? CHART_STYLE.colors.mauvais : 
                            CHART_STYLE.colors.critique
                        ),
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        fill: true,
                        order: 1
                    },
                    {
                        label: 'Seuil excellent (4x/jour)',
                        data: Array(dates.length).fill(4),
                        borderColor: CHART_STYLE.colors.reference,
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false,
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: CHART_STYLE.legend,
                    tooltip: CHART_STYLE.tooltip
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: CHART_STYLE.grid,
                        title: {
                            display: true,
                            text: 'Nombre de dépassements',
                            font: CHART_STYLE.fonts
                        },
                        ticks: {
                            stepSize: 1,
                            font: CHART_STYLE.fonts
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: CHART_STYLE.fonts
                        }
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
    if (!data) { container.innerHTML='<p class="no-data">Données insuffisantes pour le graphique</p>'; return; }

    container.innerHTML = `<h3 class="card-title">📈 ÉVOLUTION JOURNALIÈRE DES TENSIONS</h3><div style="height:300px;width:100%"><canvas id="dailyTensionChart"></canvas></div>`;

    chartManager.destroy('dailyTensionChart');
    requestAnimationFrame(()=>createDailyTensionChart(data));
}

function createDailyTensionChart(data) {
    chartManager.destroy('dailyTensionChart');
    
    const ctx = document.getElementById('dailyTensionChart')?.getContext('2d');
    if (!ctx) return;
    
    const norms = VOLTAGE_NORMS[database.technicalData.normSystem || '12V'];
    const labels = data.dates;
    
    requestAnimationFrame(() => {
        chartManager.create('dailyTensionChart', {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Tension minimale',
                        data: data.mins,
                        borderColor: CHART_STYLE.colors.min,
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: CHART_STYLE.colors.min,
                        pointBorderColor: 'white',
                        pointBorderWidth: 1,
                        tension: 0.2,
                        order: 1
                    },
                    {
                        label: 'Tension maximale',
                        data: data.maxs,
                        borderColor: CHART_STYLE.colors.max,
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                        pointBackgroundColor: CHART_STYLE.colors.max,
                        pointBorderColor: 'white',
                        pointBorderWidth: 1,
                        tension: 0.2,
                        order: 1
                    },
                    {
                        label: 'Tension moyenne',
                        data: data.avgs,
                        borderColor: CHART_STYLE.colors.avg,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.2,
                        order: 1
                    },
                    {
                        label: 'Seuil minimal',
                        data: Array(labels.length).fill(norms.min),
                        borderColor: CHART_STYLE.colors.threshold,
                        borderWidth: 1,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false,
                        order: 2
                    },
                    {
                        label: 'Seuil maximal',
                        data: Array(labels.length).fill(norms.max),
                        borderColor: CHART_STYLE.colors.threshold,
                        borderWidth: 1,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false,
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: CHART_STYLE.legend,
                    tooltip: CHART_STYLE.tooltip
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: CHART_STYLE.grid,
                        title: {
                            display: true,
                            text: 'Tension (V)',
                            font: CHART_STYLE.fonts
                        },
                        ticks: {
                            font: CHART_STYLE.fonts
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: CHART_STYLE.fonts
                        }
                    }
                }
            }
        });
    });
}


// ===========================================
// II-7) HOURLY CHART AVEC SÉLECTEURS + JAUGE
// ===========================================

let chartStartIndex = 0;
let chartEndIndex = 0;
let allDates = [];
let allTensionData = [];

export function renderHourlyChart(selectedDate = null) {
    const container = document.getElementById('hourlyChartCard');
    if (!container) return;

    const table = database.tables?.find(t => t.type === 'T');
    if (!table) { 
        container.innerHTML = '<p class="no-data">Données horaires indisponibles</p>'; 
        return; 
    }

    if (allDates.length === 0) {
        // Déterminer les 7 derniers jours disponibles (sans charger toute la période)
        let targetDates = (database.technicalData?.chartData?.dates || []).slice(-7);
        if (!targetDates || targetDates.length === 0) {
            // Fallback : extraire les dates depuis la table T, puis garder les 7 dernières
            const dateSet = new Set();
            for (const row of table.data) {
                const cells = row.split(';');
                const datetime = cells[1];
                const date = datetime?.split(' ')?.[0];
                if (date) dateSet.add(date);
            }
            targetDates = Array.from(dateSet).sort().slice(-7);
        }
        const targetSet = new Set(targetDates);

        const dateMap = new Map();
        table.data.forEach(row => {
            const cells = row.split(';');
            const datetime = cells[1];
            const date = datetime.split(' ')[0];

            // Pour la perf : ne préparer que les 7 derniers jours
            if (!targetSet.has(date)) return;
            
            if (!dateMap.has(date)) {
                dateMap.set(date, []);
            }
            dateMap.get(date).push({
                datetime,
                hour: datetime.split(' ')[1].substring(0,5),
                tension: parseFloat(cells[4]),
            });
        });
        
        allDates = Array.from(dateMap.keys()).sort();
        allTensionData = allDates.map(date => dateMap.get(date));
    }
    
    if (allDates.length === 0) {
        container.innerHTML = '<p class="no-data">Aucune donnée disponible</p>';
        return;
    }
    
    // Si une date spécifique est demandée (clic depuis un tableau)
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

    container.innerHTML = `
        <div style="padding: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 class="card-title" style="margin:0;">⏱ TENSIONS HORAIRES</h3>
                <span style="background: #3b82f6; color: white; padding: 4px 16px; border-radius: 100px; font-size: 13px; font-weight: 600;">
                    ${daysCount} jour${daysCount > 1 ? 's' : ''}
                </span>
            </div>
            
            <div style="display: flex; gap: 15px; margin-bottom: 25px; background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
                <div style="flex: 1;">
                    <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 5px; font-weight: 600;">📅 DATE DE DÉBUT</label>
                    <select id="startDateSelect" style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; font-weight: 500; background: white;">
                        ${allDates.map((date, index) => `
                            <option value="${index}" ${index === chartStartIndex ? 'selected' : ''}>
                                ${date}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div style="flex: 1;">
                    <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 5px; font-weight: 600;">📅 DATE DE FIN</label>
                    <select id="endDateSelect" style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 14px; font-weight: 500; background: white;">
                        ${allDates.map((date, index) => `
                            <option value="${index}" ${index === chartEndIndex ? 'selected' : ''}>
                                ${date}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div style="display: flex; align-items: flex-end;">
                    <button id="applyDateBtn" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px;">
                        APPLIQUER
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 25px; padding: 0 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: #475569;">
                    <span>${allDates[0]}</span>
                    <span style="font-weight: 600; color: #3b82f6; background: #dbeafe; padding: 2px 12px; border-radius: 100px;" id="jaugeRange">
                        ${allDates[chartStartIndex]} → ${allDates[chartEndIndex]}
                    </span>
                    <span>${allDates[allDates.length-1]}</span>
                </div>
                
                <div id="filterTrack" style="position: relative; width: 100%; height: 30px; background: #e2e8f0; border-radius: 15px; cursor: pointer;">
                    <div id="filterSelection" style="position: absolute; height: 30px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 15px; box-shadow: 0 2px 8px rgba(59,130,246,0.3); border: 2px solid white; box-sizing: border-box; cursor: grab; left: ${(chartStartIndex/allDates.length)*100}%; width: ${(daysCount/allDates.length)*100}%;">
                        <div class="filter-handle left" style="position: absolute; width: 8px; height: 26px; background: white; top: 0; left: -4px; cursor: ew-resize; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                        <div class="filter-handle right" style="position: absolute; width: 8px; height: 26px; background: white; top: 0; right: -4px; cursor: ew-resize; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 9px; color: #94a3b8;">
                    <span>|</span><span>|</span><span>|</span><span>|</span><span>|</span><span>|</span><span>|</span><span>|</span><span>|</span><span>|</span>
                </div>
            </div>
            
            <div style="height: 300px; width: 100%; margin-top: 10px;">
                <canvas id="hourlyTensionChart"></canvas>
            </div>
        </div>
    `;

    updateChartData();
    attachFilterEvents();
    attachDateSelectors();
}

function updateChartData() {
    const labels = [];
    const tensions = [];
    
    for (let i = chartStartIndex; i <= chartEndIndex; i++) {
        const dayData = allTensionData[i];
        dayData.forEach(point => {
            labels.push(point.hour);
            tensions.push(point.tension);
        });
    }
    
    const norms = VOLTAGE_NORMS[database.technicalData?.normSystem || '12V'];
    
    chartManager.destroy('hourlyTensionChart');
    requestAnimationFrame(() => {
        chartManager.create('hourlyTensionChart', {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: `Tension (${allDates[chartStartIndex]} → ${allDates[chartEndIndex]})`,
                        data: tensions,
                        borderColor: CHART_STYLE.colors.primary,
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        borderWidth: 2,
                        tension: 0.2,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        pointBackgroundColor: CHART_STYLE.colors.primary,
                        pointBorderColor: 'white',
                        pointBorderWidth: 1,
                        fill: true,
                        order: 1
                    },
                    {
                        label: 'Seuil minimal',
                        data: Array(labels.length).fill(norms.min),
                        borderColor: CHART_STYLE.colors.threshold,
                        borderWidth: 1,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false,
                        order: 2
                    },
                    {
                        label: 'Seuil maximal',
                        data: Array(labels.length).fill(norms.max),
                        borderColor: CHART_STYLE.colors.threshold,
                        borderWidth: 1,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false,
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: CHART_STYLE.legend,
                    tooltip: CHART_STYLE.tooltip
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: CHART_STYLE.grid,
                        title: {
                            display: true,
                            text: 'Tension (V)',
                            font: CHART_STYLE.fonts
                        },
                        ticks: {
                            font: CHART_STYLE.fonts
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: CHART_STYLE.fonts
                        }
                    }
                }
            }
        });
    });
    
    const jaugeRange = document.getElementById('jaugeRange');
    if (jaugeRange) {
        jaugeRange.textContent = `${allDates[chartStartIndex]} → ${allDates[chartEndIndex]}`;
    }
    
    const startSelect = document.getElementById('startDateSelect');
    const endSelect = document.getElementById('endDateSelect');
    if (startSelect) startSelect.value = chartStartIndex;
    if (endSelect) endSelect.value = chartEndIndex;
}


function attachFilterEvents() {
    const track = document.getElementById('filterTrack');
    const selection = document.getElementById('filterSelection');
    const leftHandle = document.querySelector('.filter-handle.left');
    const rightHandle = document.querySelector('.filter-handle.right');
    
    if (!track || !selection) return;
    
    let isDragging = false;
    let isResizingLeft = false;
    let isResizingRight = false;
    let startX = 0;
    let startLeft = 0;
    let startRight = 0;
    
    function getMousePercent(e) {
        const rect = track.getBoundingClientRect();
        const x = e.clientX - rect.left;
        return Math.max(0, Math.min(1, x / rect.width));
    }
    
    function updateFromPercents(leftPercent, rightPercent) {
        let newStart = Math.floor(leftPercent * allDates.length);
        let newEnd = Math.floor(rightPercent * allDates.length) - 1;
        
        newStart = Math.max(0, Math.min(allDates.length - 1, newStart));
        newEnd = Math.max(0, Math.min(allDates.length - 1, newEnd));
        
        const range = newEnd - newStart + 1;
        if (range > 7) {
            if (isResizingLeft) {
                newStart = newEnd - 6;
            } else if (isResizingRight) {
                newEnd = newStart + 6;
            } else {
                newEnd = newStart + 6;
            }
        }
        
        if (newStart >= 0 && newEnd < allDates.length && newStart <= newEnd) {
            chartStartIndex = newStart;
            chartEndIndex = newEnd;
            
            selection.style.left = (chartStartIndex / allDates.length) * 100 + '%';
            selection.style.width = ((chartEndIndex - chartStartIndex + 1) / allDates.length) * 100 + '%';
            
            updateChartData();
        }
    }
    
    selection.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('filter-handle')) return;
        
        isDragging = true;
        startX = getMousePercent(e);
        startLeft = chartStartIndex / allDates.length;
        startRight = (chartEndIndex + 1) / allDates.length;
        selection.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    leftHandle?.addEventListener('mousedown', (e) => {
        isResizingLeft = true;
        startX = getMousePercent(e);
        startLeft = chartStartIndex / allDates.length;
        e.preventDefault();
    });
    
    rightHandle?.addEventListener('mousedown', (e) => {
        isResizingRight = true;
        startX = getMousePercent(e);
        startRight = (chartEndIndex + 1) / allDates.length;
        e.preventDefault();
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isDragging && !isResizingLeft && !isResizingRight) return;
        
        const currentX = getMousePercent(e);
        const delta = currentX - startX;
        
        if (isDragging) {
            let newLeft = startLeft + delta;
            let newRight = startRight + delta;
            
            if (newLeft >= 0 && newRight <= 1) {
                updateFromPercents(newLeft, newRight);
            }
        } else if (isResizingLeft) {
            let newLeft = startLeft + delta;
            updateFromPercents(newLeft, (chartEndIndex + 1) / allDates.length);
        } else if (isResizingRight) {
            let newRight = startRight + delta;
            updateFromPercents(chartStartIndex / allDates.length, newRight);
        }
    });
    
    window.addEventListener('mouseup', () => {
        isDragging = false;
        isResizingLeft = false;
        isResizingRight = false;
        selection.style.cursor = 'grab';
    });
}

function attachDateSelectors() {
    const startSelect = document.getElementById('startDateSelect');
    const endSelect = document.getElementById('endDateSelect');
    const applyBtn = document.getElementById('applyDateBtn');
    
    if (!startSelect || !endSelect || !applyBtn) return;
    
    function updateEndDateOptions() {
        const startIdx = parseInt(startSelect.value);
        const currentEndIdx = parseInt(endSelect.value);
        
        endSelect.innerHTML = '';
        
        const maxEndIdx = Math.min(startIdx + 6, allDates.length - 1);
        
        for (let i = startIdx; i <= maxEndIdx; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = allDates[i];
            if (i === currentEndIdx || (i === startIdx && currentEndIdx < startIdx)) {
                option.selected = true;
            }
            endSelect.appendChild(option);
        }
        
        if (currentEndIdx < startIdx || currentEndIdx > maxEndIdx) {
            endSelect.value = maxEndIdx;
        }
    }
    
    updateEndDateOptions();
    
    startSelect.addEventListener('change', updateEndDateOptions);
    
    applyBtn.addEventListener('click', () => {
        const newStart = parseInt(startSelect.value);
        const newEnd = parseInt(endSelect.value);
        
        chartStartIndex = newStart;
        chartEndIndex = newEnd;
        
        const selection = document.getElementById('filterSelection');
        if (selection) {
            selection.style.left = (chartStartIndex / allDates.length) * 100 + '%';
            selection.style.width = ((chartEndIndex - chartStartIndex + 1) / allDates.length) * 100 + '%';
        }
        
        updateChartData();
    });
}

// ===========================================
// III) ÉNERGIE
// ===========================================

function renderCombinedEnergyTable() {
    const container = document.getElementById('combinedEnergyTable');
    if (!container) return;
    
    const tensionTable = database.tables.find(t => t.type === 'T');
    const intensiteTable = database.tables.find(t => t.type === 'I');
    
    if (!tensionTable || !intensiteTable) {
        container.innerHTML = '<p class="no-data">Données insuffisantes</p>';
        return;
    }
    
    const tensions = parseTensionForTable(tensionTable);
    const intensites = parseIntensiteForTable(intensiteTable);
    const combinedData = alignData(tensions, intensites);
    
    if (!combinedData || combinedData.length === 0) {
        container.innerHTML = '<p class="no-data">Aucune donnée combinée</p>';
        return;
    }
    
    const dailyEnergy = {};
    const clientIds = new Set();
    
    combinedData.forEach(row => {
        const date = row.date;
        
        if (!dailyEnergy[date]) {
            dailyEnergy[date] = {
                total: 0,
                clients: {}
            };
        }
        
        const tension = row.tension;
        
        Object.entries(row.intensites).forEach(([clientId, intensite]) => {
            if (intensite === 0) return;
            
            clientIds.add(clientId);
            
            const energieHeure = tension * intensite * 1;
            
            if (!dailyEnergy[date].clients[clientId]) {
                dailyEnergy[date].clients[clientId] = 0;
            }
            dailyEnergy[date].clients[clientId] += energieHeure;
            dailyEnergy[date].total += energieHeure;
        });
    });
    
    const sortedClients = Array.from(clientIds).sort((a, b) => parseInt(a) - parseInt(b));
    const sortedDates = Object.keys(dailyEnergy).sort((a, b) => new Date(b) - new Date(a));
    
    container.innerHTML = `
        <h3 class="card-title">📊 CONSOMMATION JOURNALIÈRE PAR CLIENT</h3>
        <div style="margin-bottom: 0.5rem; font-size:0.8rem; color:var(--gray-500);">${sortedDates.length} jours analysés</div>
        ${createDetailButton('energy-table-details', 'Afficher le tableau détaillé')}
        <div id="energy-table-details" style="display:none; margin-top:15px;">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            ${sortedClients.map(id => `<th>Client ${id}<br><span style="font-weight:normal;font-size:0.7rem;">Wh</span></th>`).join('')}
                            <th>Total<br><span style="font-weight:normal;font-size:0.7rem;">Wh</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedDates.map(date => {
                            const jour = dailyEnergy[date];
                            let sommeJour = 0;
                            return `
                                <tr>
                                    <td style="font-weight: 600;">${date}</td>
                                    ${sortedClients.map(id => {
                                        const val = jour.clients[id] || 0;
                                        sommeJour += val;
                                        return `<td style="text-align: right;">${val.toFixed(0)}</td>`;
                                    }).join('')}
                                    <td style="text-align: right; font-weight: 700; background: var(--gray-100);">${sommeJour.toFixed(0)}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${sortedDates.length > 0 ? `
                            <tr style="border-top: 2px solid var(--gray-400); background: var(--gray-50);">
                                <td style="font-weight: 600;">MOYENNE</td>
                                ${sortedClients.map(id => {
                                    let sommeClient = 0;
                                    sortedDates.forEach(date => {
                                        sommeClient += dailyEnergy[date].clients[id] || 0;
                                    });
                                    const moyenneClient = sommeClient / sortedDates.length;
                                    return `<td style="text-align: right; font-weight: 600;">${moyenneClient.toFixed(0)}</td>`;
                                }).join('')}
                                <td style="text-align: right; font-weight: 700;">${(sortedClients.reduce((acc, id) => {
                                    let sommeClient = 0;
                                    sortedDates.forEach(date => {
                                        sommeClient += dailyEnergy[date].clients[id] || 0;
                                    });
                                    return acc + (sommeClient / sortedDates.length);
                                }, 0)).toFixed(0)}</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ===========================================
// BILAN ÉNERGÉTIQUE AVEC ÉVOLUTION TEMPORELLE
// ===========================================

function renderEnergyBoard() {
    const container = document.getElementById('energyBoard');
    if (!container) return;
    
    const energyStats = getEnergyStats();
    const energyData = database.energyData?.parDate || {};
    
    // ===== RÉCUPÉRER TOUTES LES DATES DISPONIBLES =====
    const sortedDates = Object.keys(energyData)
        .sort((a, b) => new Date(a) - new Date(b));  // Pas de limite !
    
    const totalDays = sortedDates.length;
    const values = sortedDates.map(date => energyData[date]?.total || 0);
    const maxValue = Math.max(...values, 1);
    
    // Format des dates pour l'affichage
    const labels = sortedDates.map(date => {
        const d = new Date(date);
        return `${d.getDate()}/${d.getMonth()+1}`;
    });
    
    // Adapter l'affichage si trop de dates
    // On veut environ 20 dates sur l'axe X pour lisibilité
    const step = totalDays > 30 ? Math.ceil(totalDays / 15) : 1;
    
    // ===== CALCUL DES STATISTIQUES TEMPORELLES =====
    let totalEnergy = 0;
    let daysWithData = 0;
    values.forEach(v => {
        if (v > 0) {
            totalEnergy += v;
            daysWithData++;
        }
    });
    const avgDaily = daysWithData > 0 ? totalEnergy / daysWithData : 0;
    
    // Trouver le jour avec le max
    const maxIndex = values.indexOf(maxValue);
    const maxDate = maxIndex >= 0 ? sortedDates[maxIndex] : null;
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span class="card-title">⚡ BILAN ÉNERGÉTIQUE</span>
                <span style="background: #e2e8f0; padding: 4px 12px; border-radius: 100px; font-size: 0.8rem;">
                    ${totalDays} jours analysés
                </span>
            </div>
            
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">ÉNERGIE MAX</span>
                    <span class="stat-number warning">${energyStats.max}</span>
                    <span class="stat-unit">Wh</span>
                    ${maxDate ? `<div style="font-size: 0.7rem; color: #64748b;">le ${maxDate}</div>` : ''}
                </div>
                <div class="stat-item">
                    <span class="stat-label">ÉNERGIE MIN</span>
                    <span class="stat-number info">${energyStats.min}</span>
                    <span class="stat-unit">Wh</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">MOYENNE</span>
                    <span class="stat-number success">${energyStats.avg}</span>
                    <span class="stat-unit">Wh</span>
                </div>
            </div>
            
            <!-- Moyenne journalière -->
            <div style="margin: 10px 0; padding: 8px 12px; background: #f8fafc; border-radius: 8px; display: flex; justify-content: space-between; font-size: 0.85rem;">
                <span>📊 Moyenne journalière</span>
                <span style="font-weight: 600;">${avgDaily.toFixed(0)} Wh/jour</span>
            </div>
            
            <!-- Graphique d'évolution -->
            <div style="margin-top: 20px; height: 120px;">
                <canvas id="energyTrendChart"></canvas>
            </div>
            
            ${createDetailButton('energy-trend-details', '📊 Voir le détail jour par jour')}
            <div id="energy-trend-details" style="display: none; margin-top: 15px;">
                <div style="max-height: 350px; overflow-y: auto; border: 1px solid var(--gray-200); border-radius: var(--radius-lg);">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead style="position: sticky; top: 0; background: var(--gray-100);">
                            <tr>
                                <th style="padding: 10px; text-align: left;">Date</th>
                                <th style="padding: 10px; text-align: right;">Énergie (Wh)</th>
                                <th style="padding: 10px; text-align: right;">Variation</th>
                                <th style="padding: 10px; text-align: right;">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedDates.map((date, i) => {
                                const val = energyData[date]?.total || 0;
                                const prevVal = i > 0 ? energyData[sortedDates[i-1]]?.total || 0 : val;
                                const variation = i > 0 ? val - prevVal : 0;
                                const varClass = variation > 0 ? 'color-danger' : variation < 0 ? 'color-success' : '';
                                const percent = i > 0 && prevVal > 0 ? ((variation / prevVal) * 100).toFixed(1) : '—';
                                
                                return `
                                    <tr>
                                        <td style="padding: 8px 10px;">${date}</td>
                                        <td style="padding: 8px 10px; text-align: right; font-weight: 500;">${val.toFixed(0)}</td>
                                        <td style="padding: 8px 10px; text-align: right; ${varClass};">
                                            ${i > 0 ? (variation > 0 ? '+' : '') + variation.toFixed(0) : '—'}
                                        </td>
                                        <td style="padding: 8px 10px; text-align: right; ${varClass};">
                                            ${percent !== '—' ? (variation > 0 ? '+' : '') + percent + '%' : '—'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    // ===== CRÉER LE GRAPHIQUE DE TENDANCE =====
    chartManager.destroy('energyTrendChart');
    requestAnimationFrame(() => {
        chartManager.create('energyTrendChart', {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Énergie (Wh)',
                    data: values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    pointBackgroundColor: values.map(v => 
                        v === maxValue ? '#ef4444' : '#3b82f6'
                    )
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const date = sortedDates[context.dataIndex];
                                return [`${date}: ${context.raw.toFixed(0)} Wh`];
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: '#e2e8f0' },
                        title: { display: true, text: 'Wh' }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { 
                            maxRotation: 45,
                            callback: (val, idx) => idx % step === 0 ? labels[idx] : ''
                        }
                    }
                },
                elements: { point: { radius: 2 } }
            }
        });
    });
}

// ===========================================
// ENERGY CYCLE MANAGER (État centralisé)
// ===========================================

class EnergyCycleManager {
    constructor(energyData) {
        this.rawData = energyData;
        this.allDates = [];
        this.allHoursData = []; // { date, hours: [{ hour, cumul, value }] }
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
            
            const date = point.date;
            const hourMatch = point.timestamp.match(/\d{4}-\d{2}-\d{2} (\d{2}):\d{2}:\d{2}/);
            if (!hourMatch) return;
            
            const hour = parseInt(hourMatch[1]);
            
            if (!dateMap.has(date)) {
                dateMap.set(date, []);
            }
            dateMap.get(date).push({ hour, energie: point.energie });
        });
        
        this.allDates = Array.from(dateMap.keys()).sort();
        this.allHoursData = this.allDates.map(date => {
            const points = dateMap.get(date);
            const hours = [];
            let cumul = 0;
            
            points.sort((a, b) => a.hour - b.hour);
            
            for (let h = 0; h < 24; h++) {
                const hourPoints = points.filter(p => p.hour === h);
                const whHour = hourPoints.reduce((sum, p) => sum + p.energie, 0);
                cumul += whHour;
                
                hours.push({
                    hour: h,
                    label: `${h}h`.padStart(3, '0'),
                    cumul: cumul,
                    value: whHour
                });
            }
            
            return { date, hours };
        });
    }
    
    initIndices() {
        if (this.allDates.length === 0) return;
        this.endIndex = this.allDates.length - 1;
        this.startIndex = Math.max(0, this.endIndex - (this.maxDaysRange - 1));
    }
    
    setRange(start, end) {
        if (start < 0 || end >= this.allDates.length || start > end) return false;
        if (end - start + 1 > this.maxDaysRange) return false;
        
        this.startIndex = start;
        this.endIndex = end;
        return true;
    }
    
    setRangeFromPercents(leftPercent, rightPercent) {
        const newStart = Math.floor(leftPercent * this.allDates.length);
        let newEnd = Math.floor(rightPercent * this.allDates.length) - 1;
        
        newEnd = Math.min(this.allDates.length - 1, Math.max(newStart, newEnd));
        
        // Forcer la limite à 7 jours
        if (newEnd - newStart + 1 > this.maxDaysRange) {
            newEnd = newStart + this.maxDaysRange - 1;
        }
        
        return this.setRange(newStart, newEnd);
    }
    
    // ===== GETTERS POUR LES DONNÉES =====
    
    getCurrentDates() {
        return {
            start: this.allDates[this.startIndex],
            end: this.allDates[this.endIndex],
            all: this.allDates,
            count: this.endIndex - this.startIndex + 1
        };
    }
    
    getChartData() {
        const labels = [];
        const cumulValues = [];
        const hourlyValues = [];
        
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            const dayData = this.allHoursData[i];
            dayData.hours.forEach(h => {
                labels.push(`${dayData.date} ${h.label}`);
                cumulValues.push(h.cumul);
                hourlyValues.push(h.value);
            });
        }
        
        return { labels, cumulValues, hourlyValues };
    }
    
    getVariations() {
        const { hourlyValues } = this.getChartData();
        const variations = [];
        
        for (let i = 1; i < hourlyValues.length; i++) {
            variations.push(hourlyValues[i] - hourlyValues[i-1]);
        }
        
        if (variations.length === 0) {
            return { avg: 0, max: 0, min: 0, maxHour: '—', minHour: '—' };
        }
        
        const avg = variations.reduce((a, b) => a + b, 0) / variations.length;
        const max = Math.max(...variations);
        const min = Math.min(...variations);
        
        // Trouver les heures des extrêmes
        const maxIdx = variations.indexOf(max);
        const minIdx = variations.indexOf(min);
        
        return {
            avg,
            max,
            min,
            maxHour: this.formatHourRange(maxIdx),
            minHour: this.formatHourRange(minIdx)
        };
    }
    
    formatHourRange(index) {
        const { labels } = this.getChartData();
        if (!labels || index < 0 || index + 1 >= labels.length) return '—';
        return `${labels[index]} → ${labels[index + 1]}`;
    }
    
    getDayNightStats() {
        let dayTotal = 0, nightTotal = 0;
        let dayCount = 0, nightCount = 0;
        
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            const dayData = this.allHoursData[i];
            let daySum = 0, nightSum = 0;
            
            dayData.hours.forEach(h => {
                if (h.hour >= 6 && h.hour < 18) {
                    daySum += h.value;
                } else {
                    nightSum += h.value;
                }
            });
            
            dayTotal += daySum;
            nightTotal += nightSum;
            dayCount++;
            nightCount++;
        }
        
        const total = dayTotal + nightTotal;
        
        return {
            day: {
                total: dayTotal,
                avg: dayCount > 0 ? dayTotal / dayCount : 0,
                percent: total > 0 ? (dayTotal / total) * 100 : 0
            },
            night: {
                total: nightTotal,
                avg: nightCount > 0 ? nightTotal / nightCount : 0,
                percent: total > 0 ? (nightTotal / total) * 100 : 0
            }
        };
    }
    
    getAmplitudeBands(hourlyValues) {
        const minValues = [];
        const maxValues = [];
        
        for (let i = 0; i < hourlyValues.length; i++) {
            const start = Math.max(0, i - 1);
            const end = Math.min(hourlyValues.length - 1, i + 1);
            const slice = hourlyValues.slice(start, end + 1);
            minValues.push(Math.min(...slice));
            maxValues.push(Math.max(...slice));
        }
        
        return maxValues.map((max, i) => [minValues[i], max]);
    }
}

// ===========================================
// COMPOSANT UI (sans état, juste du rendu)
// ===========================================


let currentManager = null;

export function renderDailyEnergyCycle() {
    const container = document.getElementById('energyCycleBoard');
    if (!container) return;
    
    const energyData = database.energyData;
    if (!energyData?.data?.length) {
        container.innerHTML = '<p class="no-data">Aucune donnée énergie disponible</p>';
        return;
    }
    
    if (!currentManager || currentManager.rawData !== energyData) {
        currentManager = new EnergyCycleManager(energyData);
    }
    
    if (currentManager.allDates.length === 0) {
        container.innerHTML = '<p class="no-data">Aucune donnée disponible</p>';
        return;
    }
    
    renderCycleUI(container);
    updateCycleChart();
    attachCycleEvents();
}

function renderCycleUI(container) {
    const dates = currentManager.getCurrentDates();
    const variations = currentManager.getVariations();
    const dayNight = currentManager.getDayNightStats();
    
    container.innerHTML = `
        <div class="card" style="padding: 0;">
            <!-- HEADER avec titre et badge -->
            <div style="padding: 20px 24px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.3rem;">⚡</span>
                    CYCLE DE CONSOMMATION QUOTIDIEN
                </h3>
                <span style="background: #e9ecef; color: #495057; padding: 4px 12px; border-radius: 100px; font-size: 0.75rem; font-weight: 600;">
                    ${dates.count} JOURS SÉLECTIONNÉS
                </span>
            </div>

            <!-- PANEL DE CONTRÔLE - Style comme l'autre dashboard -->
            <div style="padding: 20px 24px; background: #f8f9fa; border-bottom: 1px solid #e9ecef;">
                <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;">
                    
                    <!-- Date de début -->
                    <div style="flex: 1; min-width: 200px;">
                        <label style="display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6c757d; margin-bottom: 6px;">
                            📅 DATE DE DÉBUT
                        </label>
                        <select id="cycleStartSelect" style="width: 100%; padding: 10px 14px; border: 2px solid #dee2e6; border-radius: 12px; font-size: 0.9rem; font-weight: 500; background: white; cursor: pointer; transition: all 0.2s;">
                            ${currentManager.allDates.map((date, i) => `
                                <option value="${i}" ${i === currentManager.startIndex ? 'selected' : ''}>
                                    ${date}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <!-- Date de fin -->
                    <div style="flex: 1; min-width: 200px;">
                        <label style="display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6c757d; margin-bottom: 6px;">
                            📅 DATE DE FIN
                        </label>
                        <select id="cycleEndSelect" style="width: 100%; padding: 10px 14px; border: 2px solid #dee2e6; border-radius: 12px; font-size: 0.9rem; font-weight: 500; background: white; cursor: pointer;">
                            ${currentManager.allDates.map((date, i) => `
                                <option value="${i}" ${i === currentManager.endIndex ? 'selected' : ''}>
                                    ${date}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <!-- Bouton appliquer -->
                    <button id="cycleApplyBtn" style="background: #3b82f6; color: white; border: none; padding: 10px 28px; border-radius: 12px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 6px rgba(59,130,246,0.25);">
                        APPLIQUER
                    </button>
                </div>
            </div>

            <!-- JAUGE INTERACTIVE - Style épuré -->
            <div style="padding: 24px 24px 16px 24px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.75rem; color: #6c757d;">
                    <span>${currentManager.allDates[0]}</span>
                    <span id="cycleJaugeRange" style="font-weight: 600; color: #3b82f6; background: #e9ecef; padding: 4px 16px; border-radius: 100px; font-size: 0.7rem;">
                        ${dates.start} → ${dates.end}
                    </span>
                    <span>${currentManager.allDates[currentManager.allDates.length-1]}</span>
                </div>
                
                <div id="cycleTrack" style="position: relative; width: 100%; height: 36px; background: #e9ecef; border-radius: 18px; cursor: pointer; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                    <div id="cycleSelection" style="position: absolute; height: 36px; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 18px; border: 3px solid white; box-shadow: 0 4px 12px rgba(59,130,246,0.3); left: ${(currentManager.startIndex/currentManager.allDates.length)*100}%; width: ${(dates.count/currentManager.allDates.length)*100}%;">
                        <div class="gauge-handle left" style="position: absolute; width: 12px; height: 30px; background: white; left: -6px; top: 0; border-radius: 20px; cursor: ew-resize; box-shadow: 0 2px 8px rgba(0,0,0,0.15);"></div>
                        <div class="gauge-handle right" style="position: absolute; width: 12px; height: 30px; background: white; right: -6px; top: 0; border-radius: 20px; cursor: ew-resize; box-shadow: 0 2px 8px rgba(0,0,0,0.15);"></div>
                    </div>
                </div>
                
                <!-- Mini repères de dates -->
                <div style="display: flex; justify-content: space-between; margin-top: 8px; padding: 0 4px;">
                    ${currentManager.allDates.map((date, i) => {
                        if (i % Math.ceil(currentManager.allDates.length / 10) === 0) {
                            return `<span style="font-size: 0.6rem; color: #adb5bd;">${date.slice(5)}</span>`;
                        }
                        return '<span></span>';
                    }).join('')}
                </div>
            </div>

            <!-- STATS CARD - Variations (comme l'autre dashboard) -->
            <div style="padding: 16px 24px;">
                <h4 style="margin: 0 0 16px 0; font-size: 0.85rem; font-weight: 600; color: #495057; display: flex; align-items: center; gap: 6px;">
                    <span style="color: #3b82f6;">📊</span>
                    VARIATIONS HORAIRES
                </h4>
                
                <div id="variationStats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                    ${renderVariationStats(variations)}
                </div>
            </div>

            <!-- STATS CARD - Jour/Nuit avec design épuré -->
            <div style="padding: 16px 24px;">
                <h4 style="margin: 0 0 16px 0; font-size: 0.85rem; font-weight: 600; color: #495057; display: flex; align-items: center; gap: 6px;">
                    <span style="color: #3b82f6;">⏱</span>
                    CONSOMMATION MOYENNE
                </h4>
                
                <div id="dayNightStats" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    ${renderDayNightStats(dayNight)}
                </div>
            </div>

            <!-- GRAPHIQUE avec padding -->
            <div style="padding: 16px 24px 24px 24px;">
                <div style="height: 280px; width: 100%;">
                    <canvas id="dailyEnergyCycleChart"></canvas>
                </div>
            </div>
        </div>
    `;
}

function renderVariationStats(v) {
    return `
        <div style="background: #f8f9fa; border-radius: 16px; padding: 16px; border: 1px solid #e9ecef;">
            <div style="font-size: 0.7rem; color: #6c757d; margin-bottom: 4px;">MOYENNE</div>
            <div style="font-size: 1.6rem; font-weight: 700; color: #3b82f6; line-height: 1.2;">${v.avg.toFixed(1)}</div>
            <div style="font-size: 0.7rem; color: #6c757d;">Wh</div>
        </div>
        <div style="background: #f8f9fa; border-radius: 16px; padding: 16px; border: 1px solid #e9ecef;">
            <div style="font-size: 0.7rem; color: #6c757d; margin-bottom: 4px;">MAX</div>
            <div style="font-size: 1.6rem; font-weight: 700; color: #ef4444; line-height: 1.2;">+${v.max.toFixed(1)}</div>
            <div style="font-size: 0.65rem; color: #6c757d; margin-top: 6px;">${v.maxHour}</div>
        </div>
        <div style="background: #f8f9fa; border-radius: 16px; padding: 16px; border: 1px solid #e9ecef;">
            <div style="font-size: 0.7rem; color: #6c757d; margin-bottom: 4px;">MIN</div>
            <div style="font-size: 1.6rem; font-weight: 700; color: #22c55e; line-height: 1.2;">${v.min.toFixed(1)}</div>
            <div style="font-size: 0.65rem; color: #6c757d; margin-top: 6px;">${v.minHour}</div>
        </div>
    `;
}

function renderDayNightStats(dn) {
    return `
        <div style="background: linear-gradient(135deg, #fff3e0, #fff9f0); border-radius: 16px; padding: 16px; border-left: 4px solid #f59e0b;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 2rem; line-height: 1;">☀️</span>
                <div>
                    <div style="font-size: 0.7rem; color: #f59e0b; font-weight: 600; margin-bottom: 2px;">JOUR (6h-17h)</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: #1e293b;">${dn.day.avg.toFixed(0)} <span style="font-size: 0.8rem; font-weight: 400; color: #6c757d;">Wh/j</span></div>
                    <div style="font-size: 0.7rem; color: #6c757d;">${dn.day.percent.toFixed(1)}% du total</div>
                </div>
            </div>
        </div>
        <div style="background: linear-gradient(135deg, #e8f0fe, #f0f4ff); border-radius: 16px; padding: 16px; border-left: 4px solid #3b82f6;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 2rem; line-height: 1;">🌙</span>
                <div>
                    <div style="font-size: 0.7rem; color: #3b82f6; font-weight: 600; margin-bottom: 2px;">NUIT (18h-5h)</div>
                    <div style="font-size: 1.4rem; font-weight: 700; color: #1e293b;">${dn.night.avg.toFixed(0)} <span style="font-size: 0.8rem; font-weight: 400; color: #6c757d;">Wh/j</span></div>
                    <div style="font-size: 0.7rem; color: #6c757d;">${dn.night.percent.toFixed(1)}% du total</div>
                </div>
            </div>
        </div>
    `;
}

// ===========================================
// MISE À JOUR DU GRAPHIQUE ET DES STATS
// ===========================================

function updateCycleChart() {
    if (!currentManager) return;
    
    const chartData = currentManager.getChartData();
    const ctx = document.getElementById('dailyEnergyCycleChart')?.getContext('2d');
    if (!ctx) return;
    
    // Calcul de l'amplitude pour les barres
    const amplitudeData = [];
    for (let i = 0; i < chartData.hourlyValues.length; i++) {
        const start = Math.max(0, i - 1);
        const end = Math.min(chartData.hourlyValues.length - 1, i + 1);
        const slice = chartData.hourlyValues.slice(start, end + 1);
        amplitudeData.push([Math.min(...slice), Math.max(...slice)]);
    }
    
    chartManager.destroy('dailyEnergyCycleChart');
    
    requestAnimationFrame(() => {
        chartManager.create('dailyEnergyCycleChart', {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Amplitude',
                        data: amplitudeData,
                        type: 'bar',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        borderColor: 'transparent',
                        barPercentage: 0.9,
                        categoryPercentage: 0.95,
                        order: 2
                    },
                    {
                        label: 'Consommation cumulée',
                        data: chartData.cumulValues,
                        borderColor: '#3b82f6',
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        tension: 0.2,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        fill: false,
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                if (context.dataset.label === 'Amplitude') {
                                    const [min, max] = context.raw;
                                    return [
                                        `Min: ${min.toFixed(0)} Wh`,
                                        `Max: ${max.toFixed(0)} Wh`
                                    ];
                                }
                                return `Cumul: ${context.raw.toFixed(0)} Wh`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#e9ecef', drawBorder: false },
                        title: {
                            display: true,
                            text: 'Wh',
                            color: '#6c757d',
                            font: { size: 10, weight: 500 }
                        },
                        ticks: { font: { size: 9 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: { size: 8 },
                            callback: (val, idx) => {
                                if (idx % 12 === 0) {
                                    const label = chartData.labels[idx];
                                    return label ? label.split(' ')[1] : '';
                                }
                                return '';
                            }
                        }
                    }
                }
            }
        });
    });
    
    updateStatsDisplay();
}

function updateStatsDisplay() {
    if (!currentManager) return;
    
    const jaugeRange = document.getElementById('cycleJaugeRange');
    const dates = currentManager.getCurrentDates();
    if (jaugeRange) {
        jaugeRange.textContent = `${dates.start} → ${dates.end}`;
    }
    
    const variationContainer = document.getElementById('variationStats');
    if (variationContainer) {
        variationContainer.innerHTML = renderVariationStats(currentManager.getVariations());
    }
    
    const dayNightContainer = document.getElementById('dayNightStats');
    if (dayNightContainer) {
        dayNightContainer.innerHTML = renderDayNightStats(currentManager.getDayNightStats());
    }
}

// ===========================================
// GESTIONNAIRE D'ÉVÉNEMENTS (avec cleanup)
// ===========================================

let dragState = null;

function attachCycleEvents() {
    cleanupDragEvents();
    
    const startSelect = document.getElementById('cycleStartSelect');
    const endSelect = document.getElementById('cycleEndSelect');
    const applyBtn = document.getElementById('cycleApplyBtn');
    const track = document.getElementById('cycleTrack');
    const selection = document.getElementById('cycleSelection');
    
    if (!startSelect || !endSelect || !applyBtn || !track || !selection) return;
    
    const leftHandle = selection.querySelector('.gauge-handle.left');
    const rightHandle = selection.querySelector('.gauge-handle.right');
    
    // Update end select options based on start
    function updateEndOptions() {
        const startIdx = parseInt(startSelect.value);
        const maxEnd = Math.min(startIdx + 6, currentManager.allDates.length - 1);
        
        endSelect.innerHTML = '';
        for (let i = startIdx; i <= maxEnd; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = currentManager.allDates[i];
            if (i === currentManager.endIndex) option.selected = true;
            endSelect.appendChild(option);
        }
    }
    
    startSelect.addEventListener('change', updateEndOptions);
    updateEndOptions();
    
    // Apply button
    applyBtn.addEventListener('click', () => {
        const newStart = parseInt(startSelect.value);
        const newEnd = parseInt(endSelect.value);
        
        if (currentManager.setRange(newStart, newEnd)) {
            selection.style.left = (currentManager.startIndex / currentManager.allDates.length) * 100 + '%';
            selection.style.width = ((currentManager.endIndex - currentManager.startIndex + 1) / currentManager.allDates.length) * 100 + '%';
            updateCycleChart();
        }
    });
    
    // Gauge events
    function getMousePercent(e) {
        const rect = track.getBoundingClientRect();
        return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    }
    
    function onMouseMove(e) {
        if (!dragState) return;
        
        const currentX = getMousePercent(e);
        const delta = currentX - dragState.startX;
        
        if (dragState.type === 'drag') {
            const newLeft = dragState.startLeft + delta;
            const newRight = dragState.startRight + delta;
            if (newLeft >= 0 && newRight <= 1) {
                if (currentManager.setRangeFromPercents(newLeft, newRight)) {
                    selection.style.left = (currentManager.startIndex / currentManager.allDates.length) * 100 + '%';
                    selection.style.width = ((currentManager.endIndex - currentManager.startIndex + 1) / currentManager.allDates.length) * 100 + '%';
                    updateCycleChart();
                }
            }
        } else if (dragState.type === 'resize-left') {
            const newLeft = dragState.startLeft + delta;
            if (currentManager.setRangeFromPercents(newLeft, (currentManager.endIndex + 1) / currentManager.allDates.length)) {
                selection.style.left = (currentManager.startIndex / currentManager.allDates.length) * 100 + '%';
                selection.style.width = ((currentManager.endIndex - currentManager.startIndex + 1) / currentManager.allDates.length) * 100 + '%';
                updateCycleChart();
            }
        } else if (dragState.type === 'resize-right') {
            const newRight = dragState.startRight + delta;
            if (currentManager.setRangeFromPercents(currentManager.startIndex / currentManager.allDates.length, newRight)) {
                selection.style.width = ((currentManager.endIndex - currentManager.startIndex + 1) / currentManager.allDates.length) * 100 + '%';
                updateCycleChart();
            }
        }
    }
    
    function onMouseUp() {
        if (dragState) {
            dragState = null;
            selection.style.cursor = 'grab';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
    }
    
    selection.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('gauge-handle')) return;
        
        dragState = {
            type: 'drag',
            startX: getMousePercent(e),
            startLeft: currentManager.startIndex / currentManager.allDates.length,
            startRight: (currentManager.endIndex + 1) / currentManager.allDates.length
        };
        selection.style.cursor = 'grabbing';
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });
    
    leftHandle?.addEventListener('mousedown', (e) => {
        dragState = {
            type: 'resize-left',
            startX: getMousePercent(e),
            startLeft: currentManager.startIndex / currentManager.allDates.length
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });
    
    rightHandle?.addEventListener('mousedown', (e) => {
        dragState = {
            type: 'resize-right',
            startX: getMousePercent(e),
            startRight: (currentManager.endIndex + 1) / currentManager.allDates.length
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });
}

function cleanupDragEvents() {
    if (dragState) {
        window.removeEventListener('mousemove', dragState.onMouseMove);
        window.removeEventListener('mouseup', dragState.onMouseUp);
        dragState = null;
    }
}

export function destroyEnergyCycle() {
    cleanupDragEvents();
    chartManager.destroy('dailyEnergyCycleChart');
    currentManager = null;
}
