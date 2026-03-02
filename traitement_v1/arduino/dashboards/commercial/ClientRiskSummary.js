// dashboards/commercial/ClientRiskSummary.js
import { database } from '../../arduinoCore.js';

export function renderClientRiskSummary() {
    const container = document.getElementById('clientRiskSummary');
    if (!container) return;
    
    const clientsMap = database.commercialData?.clients;
    if (!clientsMap) return;
    
    const clients = Array.from(clientsMap.values());
    
    // Filtrer les clients à risque
    const risque = clients.filter(c => 
        c.technicalRefunds?.isAbnormal || 
        parseFloat(c.zeroCreditPercentage || 0) > 20 ||
        c.score?.valeur < 40
    ).slice(0, 5); // Top 5
    
    if (risque.length === 0) {
        container.innerHTML = '<p class="no-data">✅ Aucun client à risque</p>';
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">⚠️ CLIENTS NÉCESSITANT UNE ATTENTION</h3>
        <div class="risk-list">
            ${risque.map(client => `
                <div class="risk-item" onclick="showClientDetail('${client.id}')">
                    <span class="client-id">Client ${client.id}</span>
                    <span class="risk-reason">${client.score?.alerte || 'À surveiller'}</span>
                    <span class="risk-score ${client.score?.grade?.toLowerCase()}">
                        ${client.score?.emoji} ${client.score?.valeur}
                    </span>
                    <button class="btn-small">🔍 Voir détail</button>
                </div>
            `).join('')}
        </div>
        <p class="table-note">Cliquez sur un client pour voir le détail complet</p>
    `;
}