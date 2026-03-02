// dashboards/technical/ExceedanceBoard.js
import { database } from '../../arduinoCore.js';
import { VOLTAGE_NORMS } from '../../arduinoConstants.js';

export function renderExceedanceBoard() {
    const container = document.getElementById('exceedanceBoard');
    if (!container) return;
    
    const data = database.technicalData;
    if (!data) return;
    
    const normSystem = data.normSystem || '12V';
    const norms = VOLTAGE_NORMS[normSystem];
    const exceedances = data.exceedances || { min: 0, max: 0, variation: 0 };
    
    container.innerHTML = `
        <h3 class="card-title">📊 DÉPASSEMENTS</h3>
        
        <!-- Cartes des dépassements -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
            <!-- Sous-tension -->
            <div style="background: linear-gradient(145deg, #15202b, #0f1a24); padding: 15px; border-radius: 8px; border-left: 4px solid #64b5f6;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #64b5f6; font-size: 2em;">⬇️</span>
                    <span style="font-size: 2em; font-weight: bold; color: ${exceedances.min > 0 ? '#f44336' : '#4CAF50'}">
                        ${exceedances.min}
                    </span>
                </div>
                <div style="color: #aaa; font-size: 0.9em;">Jours sous ${norms.min}V</div>
                <div style="margin-top: 5px; font-size: 0.7em; color: #666;">
                    Seuil mini: ${norms.min}V
                </div>
            </div>
            
            <!-- Surtension -->
            <div style="background: linear-gradient(145deg, #15202b, #0f1a24); padding: 15px; border-radius: 8px; border-left: 4px solid #ffb74d;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #ffb74d; font-size: 2em;">⬆️</span>
                    <span style="font-size: 2em; font-weight: bold; color: ${exceedances.max > 0 ? '#f44336' : '#4CAF50'}">
                        ${exceedances.max}
                    </span>
                </div>
                <div style="color: #aaa; font-size: 0.9em;">Jours > ${norms.max}V</div>
                <div style="margin-top: 5px; font-size: 0.7em; color: #666;">
                    Seuil max: ${norms.max}V
                </div>
            </div>
            
            <!-- Variation -->
            <div style="background: linear-gradient(145deg, #15202b, #0f1a24); padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #ff9800; font-size: 2em;">⚡</span>
                    <span style="font-size: 2em; font-weight: bold; color: ${exceedances.variation > 0 ? '#f44336' : '#4CAF50'}">
                        ${exceedances.variation}
                    </span>
                </div>
                <div style="color: #aaa; font-size: 0.9em;">Jours variations</div>
                <div style="margin-top: 5px; font-size: 0.7em; color: #666;">
                    Seuil: ${norms.variationSeuil}V/h
                </div>
            </div>
        </div>
        
        <!-- Indicateur de santé -->
        <div style="background: #0f151f; padding: 15px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #aaa;">📊 TAUX DE CONFORMITÉ</span>
                <span style="font-size: 1.5em; font-weight: bold; color: ${data.conformity?.pourcentage >= 80 ? '#4CAF50' : '#ff9800'}">
                    ${data.conformity?.pourcentage || 0}%
                </span>
            </div>
            <div style="margin-top: 10px; width: 100%; height: 10px; background: #1e2a3a; border-radius: 5px; overflow: hidden;">
                <div style="width: ${data.conformity?.pourcentage || 0}%; height: 100%; background: linear-gradient(90deg, #4CAF50, #ff9800, #f44336); border-radius: 5px;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 5px; color: #666; font-size: 0.7em;">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
            </div>
        </div>
    `;
}