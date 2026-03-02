// dashboards/commercial/ClientDetail.js
import { database } from '../../arduinoCore.js';
import { FORFAIT_NAMES } from '../../arduinoConstants.js';

export function renderClientDetail(clientId) {
    const container = document.getElementById('clientDetailContainer');
    const listContainer = document.querySelector('.client-grid');
    const urgentSection = document.querySelector('.urgent-section');
    
    // Cacher la liste, montrer le détail
    if (listContainer) listContainer.style.display = 'none';
    if (urgentSection) urgentSection.style.display = 'none';
    container.style.display = 'block';
    
    const client = database.commercialData?.clients?.get(clientId);
    if (!client) return;
    
    // Préparer les données
    const creditsParType = {};
    client.credits?.forEach(c => {
        creditsParType[c.value] = (creditsParType[c.value] || 0) + 1;
    });
    
    const remboursements = client.technicalRefunds?.byType || {};
    
    container.innerHTML = `
        <div class="client-detail">
            <button class="back-button" onclick="backToClientList()">← Retour à la liste</button>
            
            <div class="detail-header">
                <h2>Client ${client.id}</h2>
                <span class="client-score-large ${client.score?.grade?.toLowerCase()}">
                    ${client.score?.emoji} ${client.score?.grade} (${client.score?.valeur}/100)
                </span>
            </div>
            
            <!-- ALERTES PRINCIPALES -->
            ${client.score?.raisons?.length > 0 ? `
                <div class="alert-section">
                    <h3>⚠️ Points d'attention</h3>
                    <ul>
                        ${client.score.raisons.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <!-- GRILLE INFOS CLÉS -->
            <div class="info-grid-3">
                <div class="info-card">
                    <div class="info-icon">📊</div>
                    <div class="info-content">
                        <span class="info-label">Forfait actuel</span>
                        <span class="info-value-large">${client.forfaitName || 'N/A'}</span>
                        <span class="info-sub">${client.consumptionAnalysis?.adequation || ''}</span>
                    </div>
                </div>
                
                <div class="info-card">
                    <div class="info-icon">⚡</div>
                    <div class="info-content">
                        <span class="info-label">Consommation</span>
                        <span class="info-value-large">${client.consumptionAnalysis?.consoMoyenne || 0} Wh</span>
                        <span class="info-sub">${client.consumptionAnalysis?.ratio || '0%'} du forfait</span>
                    </div>
                </div>
                
                <div class="info-card">
                    <div class="info-icon">💰</div>
                    <div class="info-content">
                        <span class="info-label">Crédit moyen</span>
                        <span class="info-value-large">${client.averageCredit || 0}</span>
                        <span class="info-sub">Max: ${client.maxCredit || 0}</span>
                    </div>
                </div>
            </div>
            
            <!-- DEUX COLONNES -->
            <div class="two-columns">
                <!-- Colonne gauche : Crédits -->
                <div class="column">
                    <h3>📅 Distribution des crédits</h3>
                    <div class="credit-bars">
                        ${Object.entries(creditsParType)
                            .sort((a,b) => a[0] - b[0])
                            .map(([credit, count]) => {
                                const total = client.credits?.length || 1;
                                const percent = (count / total * 100).toFixed(1);
                                const isAnomaly = [2,3,4].includes(parseInt(credit));
                                return `
                                    <div class="credit-bar-item ${isAnomaly ? 'anomaly' : ''}">
                                        <div class="credit-label">
                                            <span>${credit} jour${credit > 1 ? 's' : ''}</span>
                                            <span>${count}x (${percent}%)</span>
                                        </div>
                                        <div class="bar-container">
                                            <div class="bar-fill" style="width: ${percent}%; background: ${isAnomaly ? '#f44336' : '#4CAF50'};"></div>
                                        </div>
                                        ${isAnomaly ? '<span class="anomaly-badge">⚠️ Remboursement technique</span>' : ''}
                                    </div>
                                `;
                            }).join('')}
                    </div>
                    
                    <!-- Jours sans crédit -->
                    ${client.zeroCreditDates?.length > 0 ? `
                        <div class="zero-credit-section">
                            <h4>📆 Jour(s) sans crédit (${client.zeroCreditDates.length})</h4>
                            <div class="zero-list">
                                ${client.zeroCreditDates.slice(-10).map(date => 
                                    `<span class="zero-badge">${date}</span>`
                                ).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Colonne droite : Recharges et Forfaits -->
                <div class="column">
                    <h3>💳 Historique des recharges</h3>
                    <div class="recharge-timeline">
                        ${client.recharges?.slice(0, 10).map(r => `
                            <div class="recharge-item">
                                <span class="recharge-date">${r.date}</span>
                                <span class="recharge-amount">${r.credit} €</span>
                                <span class="recharge-forfait">${FORFAIT_NAMES[r.forfait] || r.forfait}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- Changements de forfait -->
                    ${client.forfaitChanges?.length > 0 ? `
                        <h3 style="margin-top: 20px;">🔄 Changements de forfait</h3>
                        <div class="changes-timeline">
                            ${client.forfaitChanges.map(c => `
                                <div class="change-item">
                                    <span class="change-date">${c.date}</span>
                                    <span class="change-old">${FORFAIT_NAMES[c.ancien] || c.ancien}</span>
                                    <span class="change-arrow">→</span>
                                    <span class="change-new">${FORFAIT_NAMES[c.nouveau] || c.nouveau}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- RECOMMANDATIONS -->
            ${client.recommendations?.actions?.length > 0 ? `
                <div class="recommendations-section">
                    <h3>💡 Actions recommandées</h3>
                    <div class="actions-list">
                        ${client.recommendations.actions.map(action => `
                            <div class="action-item ${action.priorite}">
                                <span class="action-icon">
                                    ${action.priorite === 'urgente' ? '🔴' : 
                                      action.priorite === 'haute' ? '🟠' : 
                                      action.priorite === 'moyenne' ? '🟡' : '🔵'}
                                </span>
                                <span class="action-text">${action.message}</span>
                                <button class="btn-action">✅ Marquer fait</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

// Fonction pour revenir à la liste
window.backToClientList = () => {
    const container = document.getElementById('clientDetailContainer');
    const listContainer = document.querySelector('.client-grid');
    const urgentSection = document.querySelector('.urgent-section');
    
    container.style.display = 'none';
    if (listContainer) listContainer.style.display = 'grid';
    if (urgentSection) urgentSection.style.display = 'block';
};