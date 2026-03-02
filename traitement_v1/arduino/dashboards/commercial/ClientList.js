// dashboards/commercial/ClientList.js
import { getClientList, getUrgentRecommendations } from '../../analytics/commercialAnalytics.js';
import { renderClientDetail } from './ClientDetail.js';

export function renderClientList() {
    const container = document.getElementById('commercialDashboard');
    if (!container) return;
    
    const clients = getClientList();
    
    // Stats rapides
    const urgent = getUrgentRecommendations();
    const total = clients.length;
    const excellent = clients.filter(c => c.score?.grade === 'EXCELLENT').length;
    const fragile = clients.filter(c => c.score?.grade === 'FRAGILE').length;
    const critique = clients.filter(c => c.score?.grade === 'CRITIQUE').length;
    
    container.innerHTML = `
        <div class="section-title">
            <h2>💰 CLIENTS</h2>
            <div class="client-stats-badges">
                <span class="stat-badge badge-excellent">${excellent} 💎</span>
                <span class="stat-badge badge-bon">${total-excellent-fragile-critique} 🟢</span>
                <span class="stat-badge badge-warning">${fragile} 🟠</span>
                <span class="stat-badge badge-critique">${critique} 🔴</span>
            </div>
        </div>
        
        <!-- URGENCES -->
        ${urgent.length > 0 ? `
            <div class="urgent-section">
                <h3 class="urgent-title">🔴 URGENT - ${urgent.length} clients à contacter</h3>
                <div class="urgent-list">
                    ${urgent.map(u => `
                        <div class="urgent-item" onclick="selectClient('${u.clientId}')">
                            <span class="client-id">Client ${u.clientId}</span>
                            <span class="client-reason">${u.actions[0]?.message || 'Action requise'}</span>
                            <button class="btn-small">📞 Appeler</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <!-- LISTE TOUS CLIENTS -->
        <div class="client-grid">
            ${clients.map(client => `
                <div class="client-card-compact" onclick="selectClient('${client.id}')">
                    <div class="card-header">
                        <span class="client-id-large">Client ${client.id}</span>
                        <span class="client-score ${client.score?.grade?.toLowerCase()}">
                            ${client.score?.emoji} ${client.score?.valeur}
                        </span>
                    </div>
                    
                    <div class="card-body">
                        <div class="info-row">
                            <span>📊 Forfait</span>
                            <span class="value">${client.forfaitName || 'N/A'}</span>
                        </div>
                        <div class="info-row">
                            <span>⚡ Conso</span>
                            <span class="value ${client.consumptionAnalysis?.couleur}">
                                ${client.consumptionAnalysis?.ratio || '0%'}
                            </span>
                        </div>
                        <div class="info-row">
                            <span>💰 Crédit moy</span>
                            <span class="value">${client.averageCredit || '0'}</span>
                        </div>
                    </div>
                    
                    <div class="card-footer">
                        ${client.technicalRefunds?.isAbnormal ? '<span class="badge-warning">⚠️ Remboursements</span>' : ''}
                        ${client.zeroCreditPercentage > 10 ? '<span class="badge-warning">📅 Jour(s) sans crédit</span>' : ''}
                        ${(client.forfaitChanges?.length || 0) > 1 ? '<span class="badge-info">🔄 Changements</span>' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <!-- Conteneur pour le détail (caché par défaut) -->
        <div id="clientDetailContainer" style="display: none;"></div>
    `;
    
    // Rendre selectClient accessible globalement
    window.selectClient = (clientId) => {
        renderClientDetail(clientId);
    };
}