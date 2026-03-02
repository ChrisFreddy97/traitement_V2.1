// dashboards/technical/CurrentBoard.js
import { database } from '../../arduinoCore.js';

export function renderCurrentBoard() {
    const container = document.getElementById('currentBoard');
    if (!container) return;
    
    const intensiteTable = database.tables.find(t => t.type === 'I');
    if (!intensiteTable) {
        container.innerHTML = '<p class="no-data">Aucune donnée d\'intensité disponible</p>';
        return;
    }
    
    // Analyser les données d'intensité
    const data = intensiteTable.data;
    const valeurs = [];
    const parJour = {};
    
    data.forEach(row => {
        const cells = row.split(';');
        const timestamp = cells[1];
        const date = timestamp.split(' ')[0];
        const valeursLigne = cells.slice(2).map(Number).filter(v => !isNaN(v));
        const moyenne = valeursLigne.reduce((s, v) => s + v, 0) / (valeursLigne.length || 1);
        
        valeurs.push(moyenne);
        
        if (!parJour[date]) parJour[date] = [];
        parJour[date].push(moyenne);
    });
    
    const max = Math.max(...valeurs);
    const min = Math.min(...valeurs);
    const avg = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
    
    container.innerHTML = `
        <h3 class="card-title">📈 ANALYSE INTENSITÉ</h3>
        
        <!-- Stats principales -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
            <div style="background: #15202b; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.8em; color: #aaa;">INTENSITÉ MAX</div>
                <div style="font-size: 2em; font-weight: bold; color: #ffb74d;">${max.toFixed(2)}</div>
                <div style="font-size: 0.8em; color: #666;">A</div>
            </div>
            <div style="background: #15202b; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.8em; color: #aaa;">INTENSITÉ MIN</div>
                <div style="font-size: 2em; font-weight: bold; color: #64b5f6;">${min.toFixed(2)}</div>
                <div style="font-size: 0.8em; color: #666;">A</div>
            </div>
            <div style="background: #15202b; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.8em; color: #aaa;">INTENSITÉ MOY</div>
                <div style="font-size: 2em; font-weight: bold; color: #4CAF50;">${avg.toFixed(2)}</div>
                <div style="font-size: 0.8em; color: #666;">A</div>
            </div>
        </div>
        
        <!-- Analyse par jour -->
        <div style="background: #0f151f; padding: 15px; border-radius: 8px;">
            <div style="color: #aaa; margin-bottom: 10px;">📊 Moyenne par jour</div>
            <div style="display: flex; gap: 5px; height: 80px; align-items: flex-end;">
                ${Object.entries(parJour).slice(-7).map(([date, vals]) => {
                    const moyJour = vals.reduce((s, v) => s + v, 0) / vals.length;
                    const height = (moyJour / max) * 80;
                    return `
                        <div style="flex:1; text-align: center;">
                            <div style="width: 100%; height: ${height}px; background: #64b5f6; border-radius: 3px 3px 0 0;"></div>
                            <div style="font-size: 0.6em; color: #aaa;">${date.slice(-2)}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}