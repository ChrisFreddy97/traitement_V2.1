/**
 * dashboards/CommercialDashboard.js (CONSOLIDÉ)
 * ============================================
 * Centralise tous les dashboards commerciaux
 * Réexporte les fonctions des modules individuels
 * 
 * À utiliser de: arduinoRender.js::renderByTab()
 * Ancien emplacement: dashboards/commercial/CommercialDashboard.js
 */

import { database } from '../arduinoCore.js';

// ==================== IMPORTS CONSOLIDÉS ====================
// Importer toutes les fonctions des boards individuels
import { renderKPIDashboard } from './commercial/KPIDashboard.js';
import { renderConsumptionBoard } from './commercial/ConsumptionBoard.js';
import { renderEventsBoard } from './commercial/EventsBoard.js';
import { renderForfaitChangesBoard } from './commercial/ForfaitChangesBoard.js';
import { renderCreditBoard } from './commercial/CreditBoard.js';
import { renderRechargeHabitsBoard } from './commercial/RechargeHabitsBoard.js';
import { renderBalanceBoard } from './commercial/BalanceBoard.js';
import { renderClientDetail } from './commercial/ClientDetail.js';
import { renderClientList } from './commercial/ClientList.js';
import { renderClientRiskSummary } from './commercial/ClientRiskSummary.js';

/**
 * FONCTION PRINCIPALE CONSOLIDÉE
 * Centralise le rendu de tous les boards commerciaux
 */
export function renderCommercialDashboard() {
    const container = document.getElementById('commercialDashboard');
    if (!container) return;
    
    // Structure HTML consolidée
    const html = `        
        <div class="section-title"><h2>💰 I) ANALYSE DE CONSOMMATION</h2></div>
        <div id="consumptionBoard" class="card"></div>
        <div id="commercialEventsBoard" class="card"></div>
        <div id="forfaitChangesBoard" class="card"></div>
        
        <div class="section-title"><h2>💳 II) ANALYSE CRÉDIT ET RECHARGE</h2></div>
        <div id="creditBoard" class="card"></div>
        <div id="rechargeHabitsBoard" class="card"></div>
        
        <div class="section-title"><h2>📊 III) SOLDE ET RECHARGE</h2></div>
        <div id="balanceBoard" class="card"></div>
        
        <div id="kpiDashboard" class="card"></div>
    `;
    
    container.innerHTML = html;
    
    // Appeler tous les renderers
    try {
        renderKPIDashboard();
        renderConsumptionBoard();
        renderEventsBoard();
        renderForfaitChangesBoard();
        renderCreditBoard();
        renderRechargeHabitsBoard();
        renderBalanceBoard();
        console.log("✅ Dashboard commercial consolidé rendu");
    } catch (e) {
        console.error("❌ Erreur rendu commercial:", e);
        container.innerHTML = `<p class="no-data">Erreur: ${e.message}</p>`;
    }
}

/**
 * Faire accessible le détail client (fonction globale)
 */
window.showClientDetail = (clientId) => {
    const detailView = document.getElementById('clientDetailView');
    if (detailView) {
        detailView.style.display = 'block';
        renderClientDetail(clientId);
    }
};

// ==================== EXPORTS CONSOLIDÉS ====================
// Réexporter toutes les fonctions individuelles pour compatibilité

export {
    renderKPIDashboard,
    renderConsumptionBoard,
    renderEventsBoard,
    renderForfaitChangesBoard,
    renderCreditBoard,
    renderRechargeHabitsBoard,
    renderBalanceBoard,
    renderClientDetail,
    renderClientList,
    renderClientRiskSummary
};
