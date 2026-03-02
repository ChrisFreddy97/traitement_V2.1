// dashboards/technical/EnergyBoard.js
import { database } from '../../arduinoCore.js';
import { getEnergyStats } from '../../analytics/energyAnalytics.js';

export function renderEnergyBoard() {
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
