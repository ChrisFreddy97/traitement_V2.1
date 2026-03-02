// dashboards/technical/LoadSheddingBoard.js
import { database } from '../../arduinoCore.js';

export function renderLoadSheddingBoard() {
    const container = document.getElementById('loadSheddingBoard');
    if (!container) return;
    
    const loadShedding = database.technicalData?.loadShedding || {
        partiel: 0,
        total: 0,
        jours: []
    };
    
    const total = loadShedding.partiel + loadShedding.total;
    const partielPercent = total > 0 ? ((loadShedding.partiel / total) * 100).toFixed(1) : 0;
    const totalPercent = total > 0 ? ((loadShedding.total / total) * 100).toFixed(1) : 0;
    
    // Grouper les jours par mois pour l'affichage
    const mois = {};
    loadShedding.jours.forEach(date => {
        const [year, month] = date.split('-');
        const key = `${year}-${month}`;
        if (!mois[key]) mois[key] = [];
        mois[key].push(parseInt(date.split('-')[2]));
    });
    
    container.innerHTML = `
        <h3 class="card-title">⚡ ÉVÉNEMENTS DE DÉLESTAGE</h3>
        
        <!-- Stats principales -->
        <div style="display: flex; gap: 20px; margin-bottom: 25px;">
            <div style="flex:1; text-align: center; padding: 20px; background: linear-gradient(145deg, #15202b, #0f1a24); border-radius: 8px;">
                <div style="font-size: 2.5em; font-weight: bold; color: #ff9800;">${total}</div>
                <div style="color: #aaa;">Total</div>
            </div>
            <div style="flex:2;">
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #ffb74d;">🔸 Partiel</span>
                        <span style="color: #fff;">${loadShedding.partiel} (${partielPercent}%)</span>
                    </div>
                    <div style="width: 100%; height: 25px; background: #1e2a3a; border-radius: 12px; overflow: hidden;">
                        <div style="width: ${partielPercent}%; height: 100%; background: #ff9800; border-radius: 12px;"></div>
                    </div>
                </div>
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: #f44336;">🔴 Total</span>
                        <span style="color: #fff;">${loadShedding.total} (${totalPercent}%)</span>
                    </div>
                    <div style="width: 100%; height: 25px; background: #1e2a3a; border-radius: 12px; overflow: hidden;">
                        <div style="width: ${totalPercent}%; height: 100%; background: #f44336; border-radius: 12px;"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Calendrier des délestages -->
        <div style="background: #0f151f; padding: 15px; border-radius: 8px;">
            <div style="color: #aaa; margin-bottom: 15px;">📅 Jours avec délestage</div>
            <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                ${Object.entries(mois).map(([moisKey, jours]) => {
                    const [year, month] = moisKey.split('-');
                    const monthName = new Date(year, month-1, 1).toLocaleString('fr', { month: 'long' });
                    return `
                        <div style="min-width: 150px;">
                            <div style="color: #ff9800; margin-bottom: 5px;">${monthName} ${year}</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 3px;">
                                ${jours.sort((a,b) => a-b).map(j => `
                                    <span style="background: #1e2a3a; color: #ffb74d; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">
                                        ${j}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <!-- Impact clients -->
        <div style="margin-top: 15px; background: #0f151f; padding: 10px; border-radius: 8px; text-align: center; color: #666;">
            ⚠️ ${loadShedding.jours.length} jours concernés sur ${database.technicalData?.daysCount || 0} jours d'analyse
        </div>
    `;
}