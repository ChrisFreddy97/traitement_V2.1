// dashboards/technical/HighVoltageBoard.js
import { database } from '../../arduinoCore.js';
import { VOLTAGE_NORMS, HIGH_VOLTAGE_THRESHOLD } from '../../arduinoConstants.js';

export function renderHighVoltageBoard() {
    const container = document.getElementById('highVoltageBoard');
    if (!container) return;
    
    const technicalData = database.technicalData || {};
    const highVoltageEvents = (technicalData.highVoltage || []).filter(e => e && e.valeur !== undefined && e.valeur !== null);
    const normSystem = technicalData.normSystem || '12V';
    const norms = VOLTAGE_NORMS[normSystem];
    const threshold = HIGH_VOLTAGE_THRESHOLD || 14;
    
    if (!highVoltageEvents || highVoltageEvents.length === 0) {
        container.innerHTML = `
            <h3 class="card-title">⚡ SURTENSION DÉTECTÉE</h3>
            <p class="no-data">✅ Aucun dépassement de ${threshold}V détecté</p>
        `;
        return;
    }
    
    // Grouper par date avec sécurité
    const parDate = {};
    highVoltageEvents.forEach(event => {
        const eventDate = event.date || 'Inconnue';
        if (!parDate[eventDate]) {
            parDate[eventDate] = [];
        }
        parDate[eventDate].push(event);
    });
    
    // Statistiques avec vérification
    const totalDays = Object.keys(parDate).length;
    const validValues = highVoltageEvents.map(e => e.valeur).filter(v => typeof v === 'number');
    const maxValue = validValues.length > 0 ? Math.max(...validValues) : 0;
    const avgValue = validValues.length > 0 ? validValues.reduce((s, v) => s + v, 0) / validValues.length : 0;
    
    container.innerHTML = `
        <h3 class="card-title">⚡ SURTENSION DÉTECTÉE</h3>
        
        <!-- Stats principales -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
            <div style="background: linear-gradient(145deg, #15202b, #0f1a24); padding: 15px; border-radius: 8px; border-left: 4px solid #f44336;">
                <div style="color: #aaa; font-size: 0.9em; margin-bottom: 5px;">JOURS AVEC SURTENSION</div>
                <div style="font-size: 2em; font-weight: bold; color: #f44336;">${totalDays}</div>
                <div style="color: #666; font-size: 0.8em;">Au-delà de ${threshold}V</div>
            </div>
            
            <div style="background: linear-gradient(145deg, #15202b, #0f1a24); padding: 15px; border-radius: 8px; border-left: 4px solid #ff6f00;">
                <div style="color: #aaa; font-size: 0.9em; margin-bottom: 5px;">VALEUR MAX</div>
                <div style="font-size: 2em; font-weight: bold; color: #ff6f00;">${maxValue.toFixed(1)}</div>
                <div style="color: #666; font-size: 0.8em;">Surtension maximale</div>
            </div>
            
            <div style="background: linear-gradient(145deg, #15202b, #0f1a24); padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">
                <div style="color: #aaa; font-size: 0.9em; margin-bottom: 5px;">VALEUR MOY</div>
                <div style="font-size: 2em; font-weight: bold; color: #ff9800;">${avgValue.toFixed(1)}</div>
                <div style="color: #666; font-size: 0.8em;">Moyenne des pics</div>
            </div>
        </div>
        
        <!-- Norme et seuils -->
        <div style="background: #0f151f; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #aaa;">🔴 Seuil critique (Surtension)</span>
                    <span style="color: #f44336; font-weight: bold;">${threshold}V</span>
                </div>
                <div style="font-size: 0.8em; color: #666;">Tension à ne pas dépasser</div>
            </div>
            
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #aaa;">✅ Norme recommandée</span>
                    <span style="color: #4CAF50; font-weight: bold;">${norms.min}V - ${norms.max}V</span>
                </div>
                <div style="font-size: 0.8em; color: #666;">Plage optimale pour la stabilité</div>
            </div>
        </div>
        
        <!-- Liste des événements -->
        <div style="background: #0f151f; padding: 15px; border-radius: 8px;">
            <div style="color: #aaa; margin-bottom: 10px; font-weight: bold;">📋 Détail des surtensions</div>
            <div style="max-height: 250px; overflow-y: auto;">
                ${Object.entries(parDate).map(([date, events]) => `
                    <div style="border-bottom: 1px solid #2a3a4a; padding: 10px 0;">
                        <div style="color: #ff9800; font-weight: bold; margin-bottom: 5px;">${date}</div>
                        <div style="margin-left: 10px;">
                            ${events.map(e => {
                                const valeur = e && e.valeur !== undefined && e.valeur !== null ? parseFloat(e.valeur).toFixed(1) : 'N/A';
                                const temps = e && e.temps ? `à ${e.temps}` : '';
                                return `
                                <div style="font-size: 0.9em; color: #aaa;">
                                    <span style="color: #f44336;">${valeur}V</span> 
                                    ${temps}
                                </div>
                            `}).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <!-- Alerte -->
        <div style="margin-top: 15px; background: #4a2a2a; padding: 12px; border-radius: 8px; border-left: 4px solid #f44336;">
            <div style="color: #ff9800; font-weight: bold;">⚠️ ATTENTION</div>
            <div style="color: #ccc; font-size: 0.9em; margin-top: 5px;">
                ${totalDays > 5 ? '🔴 Nombreuses surtensions détectées - Vérifier les équipements' : 
                  totalDays > 0 ? '🟠 Surtensions occasionnelles - À surveiller' : '✅ Aucun problème'}
            </div>
        </div>    `;
}