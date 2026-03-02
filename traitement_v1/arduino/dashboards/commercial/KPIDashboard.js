/**
 * dashboards/commercial/KPIDashboard.js
 * Dashboard KPI global pour équipe commerciale
 */

import { database } from '../../arduinoCore.js';

export function renderKPIDashboard() {
    const container = document.getElementById('kpiDashboard');
    if (!container) return;
    
    const clients = Array.from(database.commercialData?.clients || [])
        .filter(c => typeof c.id === 'number' && c.id <= 50);
    
    if (clients.length === 0) {
        container.innerHTML = '<p class="no-data">Aucun client disponible</p>';
        return;
    }
    
    // Calcul des KPI
    const kpis = calculateKPIs(clients);
    
    container.innerHTML = `
        <h3 class="card-title">📊 KPI GLOBAUX</h3>
        
        <!-- Grille 4 colonnes KPI -->
        <div class="kpi-grid">
            <div class="kpi-card kpi-primary">
                <div class="kpi-icon">👥</div>
                <div class="kpi-label">Total Clients</div>
                <div class="kpi-value">${clients.length}</div>
                <div class="kpi-sub">actifs</div>
            </div>
            
            <div class="kpi-card kpi-success">
                <div class="kpi-icon">⭐</div>
                <div class="kpi-label">Score Moyen</div>
                <div class="kpi-value">${kpis.averageScore.toFixed(1)}</div>
                <div class="kpi-sub">/ 100</div>
            </div>
            
            <div class="kpi-card kpi-warning">
                <div class="kpi-icon">⚠️</div>
                <div class="kpi-label">Clients à Risque</div>
                <div class="kpi-value">${kpis.atRiskCount}</div>
                <div class="kpi-sub">${kpis.atRiskPercent.toFixed(1)}%</div>
            </div>
            
            <div class="kpi-card kpi-info">
                <div class="kpi-icon">⚡</div>
                <div class="kpi-label">Conso Moyenne</div>
                <div class="kpi-value">${kpis.avgConsumption.toFixed(0)}</div>
                <div class="kpi-sub">Wh/jour</div>
            </div>
        </div>
        
        <!-- Distribution par profil -->
        <div class="kpi-distribution">
            <h4>Distribution Profils Clients</h4>
            <div class="profile-bars">
                ${['A', 'B', 'C', 'D'].map(grade => {
                    const count = kpis.profileDistribution[grade] || 0;
                    const percent = clients.length > 0 ? ((count / clients.length) * 100).toFixed(1) : 0;
                    return `
                        <div class="profile-bar">
                            <div class="profile-label">Profil ${grade}</div>
                            <div class="profile-bar-container">
                                <div class="profile-bar-fill grade-${grade}" style="width: ${percent}%"></div>
                            </div>
                            <div class="profile-count">${count} (${percent}%)</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <!-- Recommandations principales -->
        <div class="kpi-recommendations">
            <h4>🎯 Actions Prioritaires</h4>
            <ul class="action-list">
                ${kpis.atRiskCount > 0 ? `<li class="action-danger">Contacter <strong>${kpis.atRiskCount}</strong> clients à risque</li>` : ''}
                ${kpis.zeroCreditCount > 0 ? `<li class="action-warning">Suivre <strong>${kpis.zeroCreditCount}</strong> clients sans crédit régulièrement</li>` : ''}
                ${kpis.highConsumption > 0 ? `<li class="action-info">Étudier <strong>${kpis.highConsumption}</strong> dépassements de forfait</li>` : ''}
            </ul>
        </div>
    `;
}

function calculateKPIs(clients) {
    const totalClients = clients.length;
    
    // Scores
    const scores = clients.map(c => c.score?.valeur || 0);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    // Clients à risque (score < 40)
    const atRiskCount = clients.filter(c => c.score?.valeur < 40).length;
    const atRiskPercent = totalClients > 0 ? (atRiskCount / totalClients) * 100 : 0;
    
    // Consommation moyenne
    const consumptions = clients
        .map(c => c.consommation?.moyenne || 0)
        .filter(v => v > 0);
    const avgConsumption = consumptions.length > 0 
        ? consumptions.reduce((a, b) => a + b, 0) / consumptions.length 
        : 0;
    
    // Distribution par profil
    const profileDistribution = {
        A: clients.filter(c => c.score?.grade === 'A').length,
        B: clients.filter(c => c.score?.grade === 'B').length,
        C: clients.filter(c => c.score?.grade === 'C').length,
        D: clients.filter(c => c.score?.grade === 'D').length
    };
    
    // Clients sans crédit
    const zeroCreditCount = clients.filter(c => (c.zeroCreditPercentage || 0) > 30).length;
    
    // Dépassement de forfait
    const highConsumption = clients.filter(c => {
        const conso = c.consommation?.moyenne || 0;
        const max = c.consommation?.max || 0;
        return max > (c.forfaitActuel ? 120 : 100); // Plus de 20% au-dessus
    }).length;
    
    return {
        totalClients,
        averageScore,
        atRiskCount,
        atRiskPercent,
        avgConsumption,
        profileDistribution,
        zeroCreditCount,
        highConsumption
    };
}
