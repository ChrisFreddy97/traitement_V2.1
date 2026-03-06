// dashboards/technical/TechnicalDashboard.js
import { database } from '../../arduinoCore.js';
import { VOLTAGE_NORMS } from '../../arduinoConstants.js';
import { getEnergyStats, parseIntensiteForTable, parseTensionForTable, alignData } from '../../analytics/energyAnalytics.js';

// ===========================================
// MANAGER DE GRAPHIQUES (ÉVITE LES FUITES MEMOIRE)
// ===========================================

const chartManager = {
    instances: {},
    create: function(canvasId, config) {
        // Détruire ancien chart si existant
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

    // HTML statique des cartes
    container.innerHTML = `
        <div class="section-title"><h2>🔧DONNÉES TECHNIQUES</h2></div>
        <div id="infoCard" class="card"></div>

        <div class="section-title"><h2>📊ANALYSE GÉNÉRALE DE LA TENSION</h2></div>
        <div id="conformityContainer" class="card"></div>
        <div id="normsCard" class="card"></div>
        <div id="loadSheddingBoard" class="card"></div>
        <div id="highVoltageBoard" class="card"></div>
        <div id="dailyChartCard" class="card"></div>
        <div id="hourlyChartCard" class="card"></div>

        <div class="section-title"><h2>⚡ANALYSE ÉNERGIE</h2></div>
        <div id="energyBoard" class="card"></div>
        <div id="combinedEnergyTable" class="card"></div>
        `;

    // RENDER DES CARTES
    renderInfoCard();
    renderConformityCard();
    renderNormsCard();
    renderLoadSheddingBoard();
    renderHighVoltageBoard();
    renderDailyChart();
    renderHourlyChart();
    renderEnergyBoard();
    renderCombinedEnergyTable();
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

    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent || 'N/A';

    container.innerHTML = `
        <div class="info-grid">
            <div class="info-item"><span class="info-label">📅 Période</span><span class="info-value">${data.daysCount || 0} jours</span><span class="info-sub">${data.chartData?.dates[0] || '??'} au ${data.chartData?.dates[data.daysCount-1] || '??'}</span></div>
            <div class="info-item"><span class="info-label">👥 Clients</span><span class="info-value">${data.clientCount || 0}</span></div>
            <div class="info-item"><span class="info-label">⚡ Tension moyenne</span><span class="info-value">${data.globalAvg?.toFixed(2) || 0} V</span></div>
            <div class="info-item"><span class="info-label">⬇️ Tension minimale</span><span class="info-value min">${data.globalMin?.toFixed(2) || 0} V</span></div>
            <div class="info-item"><span class="info-label">⬆️ Tension maximale</span><span class="info-value max">${data.globalMax?.toFixed(2) || 0} V</span></div>
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

    // Fonction pour afficher TOUS les jours dans une zone scrollable
    const renderAllDays = (days, type) => {
        if (!days || days.length === 0) return `<p class="no-days">Aucun jour</p>`;
        return `
            <div class="days-scrollable">
                ${days.map(d => `<span class="day-badge ${type}">${d}</span>`).join('')}
            </div>
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
                    ${renderAllDays(data.causes.max, 'surtension')}
                </div>
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⬇️</span>
                        <span class="cause-label">Sous-tension (<${norms.min}V)</span>
                        <span class="cause-count">${data.causes.min.length} jours</span>
                    </div>
                    ${renderAllDays(data.causes.min, 'soustension')}
                </div>
                <div class="cause-card">
                    <div class="cause-header">
                        <span class="cause-icon">⚡</span>
                        <span class="cause-label">Variation (>${norms.variationSeuil}V/h)</span>
                        <span class="cause-count">${data.causes.variation.length} jours</span>
                    </div>
                    ${renderAllDays(data.causes.variation, 'variation')}
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
    
    // Calculs
    const joursAvecDelestage = data.jours.length;
    const pourcentageJours = ((joursAvecDelestage / totalJours) * 100).toFixed(1);
    const totalEvenements = data.partiel + data.total;
    const moyenneParJour = joursAvecDelestage > 0 ? (totalEvenements / joursAvecDelestage).toFixed(1) : 0;
    
    // Déterminer le niveau de sévérité (pour le badge)
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
    
    // Trier les jours
    const joursTries = [...data.jours].sort((a, b) => new Date(b) - new Date(a));
    
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
            
            <!-- Indicateur global élégant -->
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
            
            <!-- Répartition partiel/total -->
            <div style="margin-bottom: 2rem;">
                <h4 style="margin-bottom: 1rem; color: var(--dark); font-size: 1rem;">🔸 Répartition des événements</h4>
                <div style="display: flex; gap: 2rem; align-items: center;">
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span style="color: #ff9800;">🔸 Délestage partiel</span>
                            <span style="font-weight: 600;">${data.partiel} (${((data.partiel/totalEvenements)*100).toFixed(1)}%)</span>
                        </div>
                        <div style="height: 8px; background: var(--gray-200); border-radius: 100px; overflow: hidden; margin-bottom: 1rem;">
                            <div style="width: ${(data.partiel/totalEvenements)*100}%; height: 100%; background: linear-gradient(90deg, #ff9800, #f57c00);"></div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span style="color: #f44336;">🔴 Délestage total</span>
                            <span style="font-weight: 600;">${data.total} (${((data.total/totalEvenements)*100).toFixed(1)}%)</span>
                        </div>
                        <div style="height: 8px; background: var(--gray-200); border-radius: 100px; overflow: hidden;">
                            <div style="width: ${(data.total/totalEvenements)*100}%; height: 100%; background: linear-gradient(90deg, #f44336, #d32f2f);"></div>
                        </div>
                    </div>
                    
                    <div style="width: 120px; height: 120px; position: relative;">
                        <canvas id="loadSheddingDonut" width="120" height="120"></canvas>
                    </div>
                </div>
            </div>
            
            <!-- Liste des jours avec DÉTAIL -->
            <div style="margin-top: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h4 style="color: var(--dark); font-size: 1rem; margin: 0;">📅 Jours avec délestage</h4>
                    <span style="background: ${severityBg}; color: ${severityColor}; padding: 0.25rem 0.75rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600;">
                        ${joursAvecDelestage} jour(s)
                    </span>
                </div>
                
                ${joursAvecDelestage > 0 ? `
                    <div style="max-height: 300px; overflow-y: auto; border-radius: var(--radius-lg); background: var(--gray-50); padding: 1rem;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead style="position: sticky; top: 0; background: var(--gray-50);">
                                <tr>
                                    <th style="text-align: left; padding: 0.5rem; color: var(--gray-600); font-weight: 600;">Date</th>
                                    <th style="text-align: center; padding: 0.5rem; color: var(--gray-600); font-weight: 600;">Partiels</th>
                                    <th style="text-align: center; padding: 0.5rem; color: var(--gray-600); font-weight: 600;">Totaux</th>
                                    <th style="text-align: center; padding: 0.5rem; color: var(--gray-600); font-weight: 600;">Total</th>
                                    <th style="text-align: left; padding: 0.5rem; color: var(--gray-600); font-weight: 600;">Intensité</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${joursTries.map(date => {
                                    const partielJour = data.parDate?.[date]?.partiel || 0;
                                    const totalJour = data.parDate?.[date]?.total || 0;
                                    const totalEvJour = partielJour + totalJour;
                                    
                                    let intensityColor = '';
                                    let intensityText = '';
                                    if (totalEvJour > 20) {
                                        intensityColor = '#f72585';
                                        intensityText = '🔴 Critique';
                                    } else if (totalEvJour > 10) {
                                        intensityColor = '#f44336';
                                        intensityText = '🟠 Élevée';
                                    } else if (totalEvJour > 5) {
                                        intensityColor = '#ff9800';
                                        intensityText = '🟡 Moyenne';
                                    } else {
                                        intensityColor = '#4caf50';
                                        intensityText = '🟢 Faible';
                                    }
                                    
                                    return `
                                        <tr style="border-bottom: 1px solid var(--gray-200);">
                                            <td style="padding: 0.75rem 0.5rem; font-weight: 600;">${date}</td>
                                            <td style="padding: 0.75rem 0.5rem; text-align: center; color: #ff9800;">${partielJour}</td>
                                            <td style="padding: 0.75rem 0.5rem; text-align: center; color: #f44336;">${totalJour}</td>
                                            <td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 700;">${totalEvJour}</td>
                                            <td style="padding: 0.75rem 0.5rem;">
                                                <span style="background: ${intensityColor}20; color: ${intensityColor}; padding: 0.25rem 0.75rem; border-radius: 100px; font-size: 0.8rem; font-weight: 600;">
                                                    ${intensityText}
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p style="text-align: center; padding: 2rem; color: var(--gray-400);">Aucun délestage détecté</p>'}
            </div>
            
            <!-- Interprétation -->
            <div style="margin-top: 2rem; padding: 1.5rem; background: linear-gradient(145deg, var(--gray-50), white); border-radius: var(--radius-lg); border-left: 4px solid ${severityColor};">
                <div style="display: flex; gap: 1rem; align-items: flex-start;">
                    <span style="font-size: 2rem;">${severityLevel === 'critical' ? '🔴' : severityLevel === 'high' ? '🟠' : severityLevel === 'medium' ? '🟡' : '🟢'}</span>
                    <div>
                        <h4 style="margin: 0 0 0.5rem 0; color: ${severityColor};">Analyse de la situation</h4>
                        <p style="margin: 0; color: var(--gray-700); line-height: 1.6;">
                            ${getInterpretationMessage(pourcentageJours, moyenneParJour, data.partiel, data.total)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Petit graphique donut (optionnel)
    createLoadSheddingDonut(data.partiel, data.total);
}

function createLoadSheddingDonut(partiel, total) {
    setTimeout(() => {
        const canvas = document.getElementById('loadSheddingDonut');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const totalEvents = partiel + total;
        
        if (totalEvents === 0) {
            ctx.font = '10px Arial';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Aucun', 60, 60);
            return;
        }
        
        const partielAngle = (partiel / totalEvents) * 2 * Math.PI;
        
        ctx.clearRect(0, 0, 120, 120);
        
        // Fond
        ctx.beginPath();
        ctx.arc(60, 60, 50, 0, 2 * Math.PI);
        ctx.fillStyle = '#f0f0f0';
        ctx.fill();
        
        // Partiel (orange)
        ctx.beginPath();
        ctx.moveTo(60, 60);
        ctx.arc(60, 60, 50, 0, partielAngle);
        ctx.closePath();
        ctx.fillStyle = '#ff9800';
        ctx.fill();
        
        // Total (rouge)
        ctx.beginPath();
        ctx.moveTo(60, 60);
        ctx.arc(60, 60, 50, partielAngle, 2 * Math.PI);
        ctx.closePath();
        ctx.fillStyle = '#f44336';
        ctx.fill();
        
        // Centre blanc
        ctx.beginPath();
        ctx.arc(60, 60, 25, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
        
        // Texte
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(totalEvents, 60, 60);
    }, 100);
}

function getInterpretationMessage(pourcentageJours, moyenneParJour, partiel, total) {
    if (pourcentageJours >= 30) {
        return `Le réseau est très instable avec ${pourcentageJours}% des jours touchés. 
                En moyenne ${moyenneParJour} délestages par jour (${total} totaux, ${partiel} partiels). 
                Une intervention technique urgente est nécessaire pour rétablir la qualité de service.`;
    } else if (pourcentageJours >= 15) {
        return `Les délestages sont fréquents (${pourcentageJours}% des jours). 
                Avec ${moyenneParJour} événements par jour en moyenne, le réseau montre des signes de fragilité.
                Une analyse technique est recommandée.`;
    } else if (pourcentageJours >= 5) {
        return `Quelques délestages ont été détectés (${pourcentageJours}% des jours).
                C'est acceptable mais à surveiller. La moyenne de ${moyenneParJour} événements par jour reste modérée.`;
    } else {
        return `Le réseau est stable avec seulement ${pourcentageJours}% des jours touchés.
                La qualité de service est bonne. Continuer la surveillance.`;
    }
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

    // Fonction pour afficher TOUS les jours dans une zone scrollable
    const renderAllDays = (days) => {
        if (!days || days.length === 0) return `<p class="no-days">Aucun jour</p>`;
        
        return `
            <div class="days-scrollable">
                ${days.map(d => `<span class="day-badge">${d}</span>`).join('')}
            </div>
        `;
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

        <!-- LISTE COMPLÈTE DES JOURS AVEC DÉPASSEMENT -->
        <div class="days-list-section">
            <h4 class="section-subtitle">📅 Jours avec dépassement (${totalJours} jours)</h4>
            ${renderAllDays(hvData.map(d => d.date).sort().reverse())}
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
    const referenceLine = { label:`Seuil excellent (4x/jour)`, data:Array(dates.length).fill(4), borderColor:'#4CAF50', borderWidth:2, borderDash:[5,5], pointRadius:0, fill:false, tension:0 };
    chartManager.create('highVoltageChart',{
        type:'line',
        data:{labels:dates,datasets:[{label:`Nombre ≥${seuil}V`,data:counts,borderColor:'#FF9800',backgroundColor:'rgba(255,152,0,0.1)',borderWidth:3,tension:0.3,pointBackgroundColor:counts.map(c=>c>=4?'#4CAF50':c>=2?'#FFD700':c===1?'#FF9800':'#F44336'),pointRadius:5,pointHoverRadius:8,fill:true},referenceLine]},
        options:{responsive:true,maintainAspectRatio:false}
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
    const norms = VOLTAGE_NORMS[database.technicalData.normSystem || '12V'];
    const labels = data.dates;
    const datasets = [
        { label:'Tension min', data:data.mins, borderColor:'#64b5f6',pointRadius:4,fill:false },
        { label:'Tension max', data:data.maxs, borderColor:'#ffb74d',pointRadius:4,fill:false },
        { label:'Tension moyenne', data:data.avgs, borderColor:'#4CAF50',pointRadius:0,fill:false },
        { label:'Seuil min', data:Array(labels.length).fill(norms.min), borderColor:'#f44336', borderDash:[5,5], pointRadius:0, fill:false },
        { label:'Seuil max', data:Array(labels.length).fill(norms.max), borderColor:'#ff9800', borderDash:[5,5], pointRadius:0, fill:false },
        { label:'Plage idéale', data:Array(labels.length).fill((norms.min+norms.max)/2), borderColor:'#4CAF50', borderDash:[5,5], pointRadius:0, fill:false }
    ];

    chartManager.create('dailyTensionChart',{
        type:'line',
        data:{labels,datasets},
        options:{responsive:true,maintainAspectRatio:false}
    });
}

// ===========================================
// II-7) HOURLY CHART
// ===========================================

function renderHourlyChart(selectedDate = null) {
    const container = document.getElementById('hourlyChartCard');
    if (!container) return;

    const table = database.tables?.find(t=>t.type==='T');
    if (!table) { container.innerHTML='<p class="no-data">Données horaires indisponibles</p>'; return; }

    const day = selectedDate || table.data[0]?.split(';')[1].split(' ')[0];
    const dayData = table.data.filter(r=>r.split(';')[1].startsWith(day));
    if (dayData.length===0) { container.innerHTML='<p class="no-data">Aucune donnée pour ce jour</p>'; return; }

    const hours = dayData.map(r=>r.split(';')[1].split(' ')[1].substring(0,5));
    const tensions = dayData.map(r=>parseFloat(r.split(';')[4]));
    const norms = VOLTAGE_NORMS[database.technicalData.normSystem || '12V'];

    container.innerHTML = `<h3 class="card-title">⏱ TENSIONS HORAIRES - ${day}</h3><div style="height:300px;width:100%"><canvas id="hourlyTensionChart"></canvas></div>`;

    chartManager.destroy('hourlyTensionChart');
    requestAnimationFrame(()=>{
        chartManager.create('hourlyTensionChart',{
            type:'line',
            data:{
                labels:hours,
                datasets:[
                    { label:`Tension - ${day}`, data:tensions, borderColor:'#ff9800', fill:true, pointRadius:5 },
                    { label:'Seuil min', data:Array(hours.length).fill(norms.min), borderColor:'#f44336', borderDash:[5,5], pointRadius:0, fill:false },
                    { label:'Seuil max', data:Array(hours.length).fill(norms.max), borderColor:'#ff9800', borderDash:[5,5], pointRadius:0, fill:false },
                    { label:'Plage idéale', data:Array(hours.length).fill((norms.min+norms.max)/2), borderColor:'#4CAF50', borderDash:[3,3], pointRadius:0, fill:false }
                ]
            },
            options:{responsive:true,maintainAspectRatio:false}
        });
    });
}

// ===========================================
// III) ÉNERGIE
// ===========================================

function renderCombinedEnergyTable() {
    const container = document.getElementById('combinedEnergyTable');
    if (!container) return;
    
    // 1. Récupérer les tables
    const tensionTable = database.tables.find(t => t.type === 'T');
    const intensiteTable = database.tables.find(t => t.type === 'I');
    
    if (!tensionTable || !intensiteTable) {
        container.innerHTML = '<p class="no-data">Données insuffisantes</p>';
        return;
    }
    
    // 2. Parser les données
    const tensions = parseTensionForTable(tensionTable);
    const intensites = parseIntensiteForTable(intensiteTable);
    
    // 3. Aligner par timestamp
    const combinedData = alignData(tensions, intensites);
    
    // 4. Générer le HTML
    let html = '<h3 class="card-title">📋 TABLEAU COMBINÉ ÉNERGIE</h3>';
    html += '<div class="table-wrapper"><table><thead><tr>';
    html += '<th>Date</th><th>Heure</th><th>Tension inst</th>';
    
    // En-têtes pour chaque client
    const clientIds = Object.keys(intensites[0]?.parClient || {});
    clientIds.forEach(id => {
        html += `<th>Client ${id}</th>`;
    });
    
    html += '<th>Somme I</th><th>Énergie totale (Wh)</th>';
    html += '</tr></thead><tbody>';
    
    // Lignes de données
    combinedData.slice(-50).forEach(row => { // 50 dernières lignes
        html += '<tr>';
        html += `<td>${row.date}</td>`;
        html += `<td>${row.time}</td>`;
        html += `<td>${row.tension.toFixed(2)}</td>`;
        
        let sommeI = 0;
        clientIds.forEach(id => {
            const val = row.intensites[id] || 0;
            sommeI += val;
            html += `<td>${val.toFixed(2)}</td>`;
        });
        
        html += `<td>${sommeI.toFixed(2)}</td>`;
        html += `<td>${row.energie.toFixed(2)}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function renderEnergyBoard() {
    const container = document.getElementById('energyBoard');
    if (!container) return;
    
    const energyStats = getEnergyStats();
    const energyData = database.energyData?.parDate || {};
    const dates = Object.keys(energyData).sort().slice(-7);
    const maxDisplayValue = Math.max(...dates.map(d => energyData[d]?.total || 0), 1);
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <span class="card-title">⚡ BILAN ÉNERGÉTIQUE</span>
            </div>
            
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">ÉNERGIE MAX</span>
                    <span class="stat-number warning">${energyStats.max}</span>
                    <span class="stat-unit">Wh</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">ÉNERGIE MIN</span>
                    <span class="stat-number info">${energyStats.min}</span>
                    <span class="stat-unit">Wh</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">ÉNERGIE MOY</span>
                    <span class="stat-number success">${energyStats.avg}</span>
                    <span class="stat-unit">Wh</span>
                </div>
            </div>
            
            <div class="chart-mini">
                <div class="chart-header">
                    <span>📊 Derniers 7 jours</span>
                    <span class="total-value">Total: ${(Object.values(energyData).reduce((s, d) => s + (d.total || 0), 0)).toFixed(2)} Wh</span>
                </div>
                <div class="bars-container" style="height: 100px;">
                    ${dates.map(date => {
                        const value = energyData[date]?.total || 0;
                        const height = (value / maxDisplayValue) * 100;
                        return `
                            <div class="bar-wrapper">
                                <div class="bar" style="height: ${height}%;"></div>
                                <span class="bar-label">${date.slice(-2)}</span>
                                <span class="bar-value">${value.toFixed(1)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}
