// dashboards/commercial/CommercialDashboard.js
import { database } from '../../arduinoCore.js';
import { renderKPIDashboard } from './KPIDashboard.js';
import { renderConsumptionBoard } from './ConsumptionBoard.js';
import { renderEventsBoard } from './EventsBoard.js';
import { renderForfaitChangesBoard } from './ForfaitChangesBoard.js';
import { renderCreditBoard } from './CreditBoard.js';
import { renderRechargeHabitsBoard } from './RechargeHabitsBoard.js';
import { renderBalanceBoard } from './BalanceBoard.js';
import { generateClientsCSV, generateClientDetailsCSV, generateClientPDFHTML, exportCSVElectron, exportPDFElectron } from '../../commercialUtils.js'; // NOUVEAU

export function renderCommercialDashboard() {
    const container = document.getElementById('commercialDashboard');
    if (!container) return;
    
    // Structure EXIGÉE PAR LE CHEF + AMÉLIORATIONS UI/UX
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
        
    `;
    
    container.innerHTML = html;
    
    // Rendre les stats globales (exigences chef)
    renderKPIDashboard();
    renderConsumptionBoard();
    renderEventsBoard();
    renderForfaitChangesBoard();
    renderCreditBoard();
    renderRechargeHabitsBoard();
    renderBalanceBoard();
}

// Rendre accessible la fonction de détail
window.showClientDetail = (clientId) => {
    document.getElementById('clientDetailView').style.display = 'block';
    // Importer dynamiquement pour éviter les dépendances circulaires
    import('./ClientDetail.js').then(module => {
        module.renderClientDetail(clientId);
    });
};