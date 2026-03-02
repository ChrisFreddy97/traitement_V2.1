/**
 * dashboards/TechnicalDashboard.js (CONSOLIDÉ)
 * =============================================
 * Centralise tous les dashboards techniques
 * Réexporte les fonctions des modules individuels
 * 
 * À utiliser de: arduinoRender.js::renderByTab()
 * Ancien emplacement: dashboards/technical/TechnicalDashboard.js
 */

import { database } from '../arduinoCore.js';

// ==================== IMPORTS CONSOLIDÉS ====================
// Importer toutes les fonctions des boards individuels
import { renderCurrentBoard } from './technical/CurrentBoard.js';
import { renderEnergyBoard } from './technical/EnergyBoard.js';
import { renderExceedanceBoard } from './technical/ExceedanceBoard.js';
import { renderHighVoltageBoard } from './technical/HighVoltageBoard.js';
import { renderHourlyChart } from './technical/HourlyChart.js';
import { renderLoadSheddingBoard } from './technical/LoadSheddingBoard.js';

/**
 * FONCTION PRINCIPALE CONSOLIDÉE
 * Centralise le rendu de tous les boards techniques
 */
export function renderTechnicalDashboard() {
    const container = document.getElementById('technicalDashboard');
    if (!container) return;
    
    // Structure HTML consolidée
    const html = `
        <div class="section-title"><h2>⚡ I) MESURES ÉLECTRIQUES</h2></div>
        <div id="currentBoard" class="card"></div>
        <div id="energyBoard" class="card"></div>
        
        <div class="section-title"><h2>⚠️ II) ALERTES & DÉPASSEMENTS</h2></div>
        <div id="exceedanceBoard" class="card"></div>
        <div id="highVoltageBoard" class="card"></div>
        
        <div class="section-title"><h2>📊 III) GRAPHIQUES DÉTAILLÉS</h2></div>
        <div id="hourlyChartCard" class="card"></div>
        <div id="loadSheddingBoard" class="card"></div>
    `;
    
    container.innerHTML = html;
    
    // Appeler tous les renderers
    try {
        renderCurrentBoard();
        renderEnergyBoard();
        renderExceedanceBoard();
        renderHighVoltageBoard();
        renderHourlyChart();
        renderLoadSheddingBoard();
        console.log("✅ Dashboard technique consolidé rendu");
    } catch (e) {
        console.error("❌ Erreur rendu technique:", e);
        container.innerHTML = `<p class="no-data">Erreur: ${e.message}</p>`;
    }
}

// ==================== EXPORTS CONSOLIDÉS ====================
// Réexporter toutes les fonctions individuelles pour compatibilité

export {
    renderCurrentBoard,
    renderEnergyBoard,
    renderExceedanceBoard,
    renderHighVoltageBoard,
    renderHourlyChart,
    renderLoadSheddingBoard
};
