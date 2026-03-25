// dashboards/commercial/CommercialDashboard.js
import { database } from '../../arduinoCore.js';
import { FORFAIT_LIMITS } from '../../arduinoConstants.js';
import { FORFAIT_NAMES } from '../../arduinoConstants.js';
import {renderFilterPanel}from '../technical/TechnicalDashboard.js';

// Variable globale pour suivre le client actif
let activeClientId = null;
let clientsList = [];

export function renderCommercialDashboard() {
    const container = document.getElementById('commercialDashboard');
    if (!container) return;
    
    // Récupérer la liste des clients une fois pour toutes
    clientsList = Array.from(database.commercialData?.clients?.values() || [])
        .filter(c => typeof c.id === 'number' && c.id <= 50);
    
    // Définir le premier client comme actif par défaut
    activeClientId = clientsList.length > 0 ? clientsList[0].id : null;
    
    // Structure avec onglet client en haut
    const html = `
        <!-- Onglet client global en haut -->
        <div class="global-client-tabs-container">
            <h3>👥 Sélection client</h3>
            <div class="client-tabs-header">
                <button class="client-tab-nav prev" id="prevGlobalClient">◀</button>
                <div class="client-tabs" id="globalClientTabs"></div>
                <button class="client-tab-nav next" id="nextGlobalClient">▶</button>
            </div>
        </div>
        
        <div class="section-title"><h2>💰 ANALYSE DE CONSOMMATION</h2></div>
        <div id="consumptionBoard" class="card"></div>
        
        <div class="section-title"><h2>💳 ANALYSE CRÉDIT ET RECHARGE</h2></div>
        <div id="commercialEventsBoard" class="card"></div>
        
        <div class="section-title"><h2>📊 SOLDE ET RECHARGE</h2></div>
        <div id="creditBoard" class="card"></div>
                
        <!-- 👉 BOUTON POUR AFFICHER LES TABLEAUX -->
        <button class="toggle-tables-btn" onclick="toggleTablesContainer()">
            📋 Afficher les tableaux détaillés
        </button>
        `;
    
    container.innerHTML = html;
    
    // Rendre l'onglet client global
    renderGlobalClientTabs();
    
    // Rendre tous les boards avec le client actif
    renderAllBoards();
    
    // Attacher la navigation globale
    attachGlobalNavigation();
}

function renderGlobalClientTabs() {
    const container = document.getElementById('globalClientTabs');
    if (!container || clientsList.length === 0) return;
    
    container.innerHTML = clientsList.map(client => {
        // Vérifier si c'est un client fantôme pour le style de l'onglet
        const isGhost = isGhostClient(client);
        return `
            <button class="client-tab ${client.id === activeClientId ? 'active' : ''} ${isGhost ? 'ghost-client' : ''}" 
                    data-client-id="${client.id}" 
                    title="${isGhost ? '👻 Client fantôme - Aucune donnée' : ''}">
                Client ${client.id} ${isGhost ? '👻' : ''}
            </button>
        `;
    }).join('');
}

function attachGlobalNavigation() {
    setTimeout(() => {
        const tabs = document.querySelectorAll('#globalClientTabs .client-tab');
        const prevBtn = document.getElementById('prevGlobalClient');
        const nextBtn = document.getElementById('nextGlobalClient');
        
        if (!tabs.length) return;
        
        function switchToClient(clientId) {
            activeClientId = parseInt(clientId);
            
            // Mettre à jour les classes actives des onglets
            tabs.forEach(tab => {
                tab.classList.toggle('active', parseInt(tab.dataset.clientId) === activeClientId);
            });
            
            // Re-rendre tous les boards avec le nouveau client
            renderAllBoards();
        }
        
        // Ajouter les événements de clic sur les onglets
        tabs.forEach(tab => {
            tab.addEventListener('click', () => switchToClient(tab.dataset.clientId));
        });
        
        // Navigation précédent/suivant
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                const currentIndex = clientsList.findIndex(c => c.id === activeClientId);
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : clientsList.length - 1;
                switchToClient(clientsList[prevIndex].id);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const currentIndex = clientsList.findIndex(c => c.id === activeClientId);
                const nextIndex = currentIndex < clientsList.length - 1 ? currentIndex + 1 : 0;
                switchToClient(clientsList[nextIndex].id);
            });
        }
    }, 100);
}

// ===========================================
// FONCTIONS UTILITAIRES
// ===========================================

/**
 * Détecter si un client est fantôme
 */
function isGhostClient(client) {
    const aDesRecharges = (client.recharges?.length > 0);
    const aDesConso = (client.consommation?.journaliere?.length > 0);
    const aDesEvents = (client.events?.length > 0);
    const aDesCredits = (client.credits?.length > 0);
    
    if (!aDesRecharges && !aDesConso && !aDesEvents && !aDesCredits) {
        return true;
    }
    
    const consoToutesNulles = (client.consommation?.journaliere?.every(c => c.valeur === 0) ?? true);
    const creditsTousNuls = (client.credits?.every(c => c.value === 0) ?? true);
    
    return (aDesConso && consoToutesNulles) || (aDesCredits && creditsTousNuls);
}





function renderAllBoards() {
    // Rendre tous les boards avec le client actif
    renderConsumptionBoard();
    renderEventsBoard();
    renderCreditBoard();
}

// Rendre accessible la fonction de détail
window.showClientDetail = (clientId) => {
    document.getElementById('clientDetailView').style.display = 'block';
    import('./ClientDetail.js').then(module => {
        module.renderClientDetail(clientId);
    });
};

function renderConsumptionBoard() {
    const container = document.getElementById('consumptionBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<p class="no-data">❌ Aucun client sélectionné</p>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<p class="no-data">❌ Client non trouvé</p>';
        return;
    }
    
    // Si client fantôme
    if (isGhostClient(client)) {
        container.innerHTML = `
            <h3 class="card-title">📋 HISTORIQUE FORFAITS & CONSOMMATION - Client ${client.id}</h3>
            <div class="client-card ghost">
                <div class="client-header">
                    <span class="client-icon">👻</span>
                    <span class="client-id">Client ${client.id}</span>
                    <span class="client-badge ghost">Client fantôme</span>
                </div>
                <div class="message-container">
                    <p class="client-message ghost">👻 Aucune donnée de consommation ou forfait disponible.</p>
                </div>
            </div>
        `;
        return;
    }
    
    // ===== CONSTRUCTION DE L'HISTORIQUE DES FORFAITS =====
    const forfaitHistory = [];
    const changes = client.forfaitChanges || [];
    const consoJournaliere = client.consommation?.journaliere || []; // ✅ Contient TOUS les jours (0 inclus)
    const events = client.events || [];
    
    // Récupérer les dates de SuspendE pour ce client
    const suspendEDates = new Set();
    events.forEach(e => {
        if (e.type === 'SuspendE' && e.date) {
            suspendEDates.add(e.date.split('T')[0]);
        }
    });
    
    // Construire l'historique des forfaits à partir des changements
    if (changes.length === 0) {
        const premiereDate = consoJournaliere.length > 0 
            ? consoJournaliere[0].date 
            : '2024-01-01';
        
        forfaitHistory.push({
            forfait: client.forfaitName || 'ECO',
            code: client.forfaitActuel || 1,
            startDate: premiereDate,
            endDate: null,
            isCurrent: true
        });
    } else {
        const sortedChanges = [...changes].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        const premiereDate = consoJournaliere.length > 0 
            ? consoJournaliere[0].date 
            : '2024-01-01';
        
        forfaitHistory.push({
            forfait: FORFAIT_NAMES[sortedChanges[0].ancien] || `Forfait ${sortedChanges[0].ancien}`,
            code: sortedChanges[0].ancien,
            startDate: premiereDate,
            endDate: sortedChanges[0].date,
            isCurrent: false
        });
        
        for (let i = 0; i < sortedChanges.length; i++) {
            const change = sortedChanges[i];
            const nextChange = sortedChanges[i + 1];
            
            forfaitHistory.push({
                forfait: FORFAIT_NAMES[change.nouveau] || `Forfait ${change.nouveau}`,
                code: change.nouveau,
                startDate: change.date,
                endDate: nextChange ? nextChange.date : null,
                isCurrent: !nextChange
            });
        }
    }
    
    // ===== ANALYSER LA CONSO POUR CHAQUE PÉRIODE =====
    const forfaitStats = forfaitHistory.map((forfait, index, array) => {
        const allDaysInPeriod = [];
        const daysWithConsumption = [];
        const forfaitMax = FORFAIT_LIMITS[forfait.forfait]?.max || 100;
        const seuil85 = forfaitMax * 0.85;
        const seuil115 = forfaitMax * 1.15;
        
        // ✅ Parcourir TOUS les jours (avec et sans conso)
        consoJournaliere.forEach(day => {
            const dayDate = day.date;
            if (!dayDate) return;
            
            let inPeriod = false;
            if (forfait.endDate) {
                if (dayDate >= forfait.startDate && dayDate <= forfait.endDate) {
                    inPeriod = true;
                }
            } else {
                if (dayDate >= forfait.startDate) {
                    inPeriod = true;
                }
            }
            
            if (inPeriod) {
                allDaysInPeriod.push(day); // ✅ On garde TOUS les jours de la période
                if (day.valeur > 0) {
                    daysWithConsumption.push(day);
                }
            }
        });
        
        // Stats sur les jours avec conso
        const maxEnergy = daysWithConsumption.length > 0 
            ? Math.max(...daysWithConsumption.map(d => d.valeur)).toFixed(1)
            : 0;
        
        const avgEnergy = daysWithConsumption.length > 0 
            ? (daysWithConsumption.reduce((sum, d) => sum + d.valeur, 0) / daysWithConsumption.length).toFixed(1)
            : 0;
        
        // Répartition par seuils (uniquement sur les jours avec conso)
        const daysBelow85 = daysWithConsumption.filter(d => d.valeur <= seuil85).length;
        const daysInTolerance = daysWithConsumption.filter(d => d.valeur > seuil85 && d.valeur <= seuil115).length;
        const daysAbove115 = daysWithConsumption.filter(d => {
            const dateStr = d.date.split('T')[0];
            return d.valeur > seuil115 || suspendEDates.has(dateStr);
        }).length;
        
        // Calcul du changement pour l'affichage
        let changeText = '';
        if (index === 0) {
            changeText = '<span style="color: #64748b;">Premier forfait</span>';
        } else {
            const previousForfait = array[index-1].forfait;
            changeText = `
                <span style="background: #f97315; color: white; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-right: 5px;">
                    ${previousForfait}
                </span>
                →
                <span style="background: #22c55e; color: white; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-left: 5px;">
                    ${forfait.forfait}
                </span>
            `;
        }
        
        return {
            ...forfait,
            changeText,
            totalDays: allDaysInPeriod.length,                    // ✅ Tous les jours de la période
            daysWithConso: daysWithConsumption.length,             // ✅ Jours avec conso
            daysWithoutConso: allDaysInPeriod.length - daysWithConsumption.length, // ✅ Jours sans conso
            maxEnergy,
            avgEnergy,
            daysBelow85,
            daysInTolerance,
            daysAbove115,
            percentBelow85: daysWithConsumption.length > 0 ? ((daysBelow85 / daysWithConsumption.length) * 100).toFixed(1) : 0,
            percentInTolerance: daysWithConsumption.length > 0 ? ((daysInTolerance / daysWithConsumption.length) * 100).toFixed(1) : 0,
            percentAbove115: daysWithConsumption.length > 0 ? ((daysAbove115 / daysWithConsumption.length) * 100).toFixed(1) : 0,
            forfaitMax,
            seuil85,
            seuil115
        };
    });
    
    // ===== RENDU HTML =====
    let html = `
        <h3 class="card-title">📋 HISTORIQUE FORFAITS & CONSOMMATION - Client ${client.id}</h3>
        <div class="client-card">
    `;
    
    if (forfaitStats.length > 0) {
        // TABLEAU RÉCAPITULATIF
        html += `
            <div style="overflow-x: auto; margin-bottom: 25px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1100px;">
                    <thead style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <tr>
                            <th style="padding: 12px 10px; text-align: center;">Forfait</th>
                            <th style="padding: 12px 10px; text-align: center;">Changement</th>
                            <th style="padding: 12px 10px; text-align: center;">Jours totaux</th>
                            <th style="padding: 12px 10px; text-align: center;">Jours avec conso</th>
                            <th style="padding: 12px 10px; text-align: center;">Jours sans conso</th>
                            <th style="padding: 12px 10px; text-align: center;">Énergie max</th>
                            <th style="padding: 12px 10px; text-align: center;">Énergie moy</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        forfaitStats.forEach((stat, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
            
            html += `
                <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                    <td style="padding: 12px 10px; text-align: center;">
                        <span class="client-badge" style="background: ${stat.isCurrent ? '#22c55e20' : '#9f7aea20'}; color: ${stat.isCurrent ? '#22c55e' : '#9f7aea'};">
                            ${stat.forfait}
                            ${stat.isCurrent ? ' (actuel)' : ''}
                        </span>
                    </td>
                    <td style="padding: 12px 10px; text-align: center; white-space: nowrap;">
                        ${stat.changeText}
                    </td>
                    <td style="padding: 12px 10px; text-align: center; font-weight: 600;">${stat.totalDays}</td>
                    <td style="padding: 12px 10px; text-align: center; font-weight: 600; color: #22c55e;">${stat.daysWithConso}</td>
                    <td style="padding: 12px 10px; text-align: center; font-weight: 600; color: #64748b;">${stat.daysWithoutConso}</td>
                    <td style="padding: 12px 10px; text-align: center;">${stat.maxEnergy} Wh</td>
                    <td style="padding: 12px 10px; text-align: center;">${stat.avgEnergy} Wh</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        // BARRES DE PROGRESSION PAR PÉRIODE
        forfaitStats.forEach(stat => {
            const startDate = new Date(stat.startDate).toLocaleDateString('fr-FR');
            const endDate = stat.endDate 
                ? new Date(stat.endDate).toLocaleDateString('fr-FR') 
                : 'Présent';
            
            html += `
                <div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <div>
                            <span class="client-badge" style="background: ${stat.isCurrent ? '#22c55e' : '#9f7aea'}; color: white; margin-right: 10px;">
                                ${stat.forfait}
                            </span>
                            <span style="font-size: 12px; color: #64748b;">${startDate} → ${endDate}</span>
                        </div>
                        <span style="font-size: 12px;">${stat.daysWithConso} jours avec conso</span>
                    </div>
                    
                    <!-- Barre de progression -->
                    <div class="unified-progress-bar" style="height: 40px; margin-bottom: 10px; display: flex;">
                        <div class="progress-segment success" style="width: ${stat.percentBelow85}%; height: 100%; background: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.2);" 
                             title="≤85% : ${stat.daysBelow85} jours">
                            ${stat.percentBelow85 > 8 ? stat.percentBelow85 + '%' : ''}
                        </div>
                        <div class="progress-segment warning" style="width: ${stat.percentInTolerance}%; height: 100%; background: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.2);"
                             title="85-115% : ${stat.daysInTolerance} jours">
                            ${stat.percentInTolerance > 8 ? stat.percentInTolerance + '%' : ''}
                        </div>
                        <div class="progress-segment danger" style="width: ${stat.percentAbove115}%; height: 100%; background: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.2);"
                             title=">115% : ${stat.daysAbove115} jours">
                            ${stat.percentAbove115 > 8 ? stat.percentAbove115 + '%' : ''}
                        </div>
                    </div>
                    
                    <!-- Légende -->
                    <div class="progress-legend" style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">
                        <div class="legend-item" style="display: flex; align-items: center; gap: 5px;">
                            <span class="legend-dot success" style="width: 12px; height: 12px; background: #22c55e; border-radius: 3px;"></span>
                            <span style="font-size: 12px;">≤${stat.seuil85.toFixed(0)}Wh: ${stat.daysBelow85}j (${stat.percentBelow85}%)</span>
                        </div>
                        <div class="legend-item" style="display: flex; align-items: center; gap: 5px;">
                            <span class="legend-dot warning" style="width: 12px; height: 12px; background: #f59e0b; border-radius: 3px;"></span>
                            <span style="font-size: 12px;">${stat.seuil85.toFixed(0)}-${stat.seuil115.toFixed(0)}Wh: ${stat.daysInTolerance}j (${stat.percentInTolerance}%)</span>
                        </div>
                        <div class="legend-item" style="display: flex; align-items: center; gap: 5px;">
                            <span class="legend-dot danger" style="width: 12px; height: 12px; background: #ef4444; border-radius: 3px;"></span>
                            <span style="font-size: 12px;">>${stat.seuil115.toFixed(0)}Wh: ${stat.daysAbove115}j (${stat.percentAbove115}%)</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        // Note sur les SuspendE
        if (suspendEDates.size > 0) {
            html += `
                <div class="info-note" style="margin-top: 15px; padding: 10px; background: #fee2e2; border-radius: 8px; font-size: 12px;">
                    ⚠️ ${suspendEDates.size} jour(s) avec SuspendE détecté(s) (comptés dans la zone rouge)
                </div>
            `;
        }
    } else {
        html += '<p class="no-data">Aucune donnée de consommation disponible</p>';
    }
    
    html += `</div>`;
    container.innerHTML = html;
}

function renderEventsBoard() {
    const container = document.getElementById('commercialEventsBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<p class="no-data">❌ Aucun client sélectionné</p>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<p class="no-data">❌ Client non trouvé</p>';
        return;
    }
    
    // Si client fantôme, afficher un message spécifique
    if (isGhostClient(client)) {
        container.innerHTML = `
            <h3 class="card-title">⚠️ ÉVÉNEMENTS - Client ${client.id}</h3>
            <div class="client-card ghost">
                <div class="client-header">
                    <span class="client-icon">👻</span>
                    <span class="client-id">Client ${client.id}</span>
                    <span class="client-badge ghost">Client fantôme</span>
                </div>
                <div class="message-container">
                    <p class="client-message ghost">👻 Aucun événement enregistré pour ce client.</p>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <h3 class="card-title">⚠️ ÉVÉNEMENTS - Client ${client.id}</h3>
        ${renderEventsClient(client)}
    `;
}

function renderEventsClient(client) {
    const events = client.events || [];
    const zeroCreditDates = client.zeroCreditDates || [];
    
    // Récupérer le nombre total de jours analysés (si disponible)
    const totalDays = client.consommation?.journaliere?.length || 
                     client.credits?.length || 
                     zeroCreditDates.length || 
                     1;
    
    // Regrouper les événements par jour (comme dans le nouveau code)
    const eventsByDay = [];
    const eventsMap = new Map();
    
    // Traiter les événements SuspendE et SuspendP
    events.forEach(event => {
        if (!event.date) return;
        const dateStr = event.date.split('T')[0];
        const hour = event.date.includes('T') ? event.date.split('T')[1]?.substring(0,5) : '';
        
        if (!eventsMap.has(dateStr)) {
            eventsMap.set(dateStr, {
                date: dateStr,
                dateObj: new Date(event.date),
                SuspendE: 0,
                SuspendE_start: '',
                SuspendE_end: '',
                SuspendE_duration: '',
                SuspendP: 0,
                SuspendP_start: '',
                SuspendP_end: '',
                SuspendP_duration: '',
                CreditNul: 0
            });
        }
        
        const dayData = eventsMap.get(dateStr);
        
        if (event.type === 'SuspendE') {
            dayData.SuspendE++;
            if (!dayData.SuspendE_start) dayData.SuspendE_start = hour;
            dayData.SuspendE_end = hour;
            // Calcul approximatif de la durée (si plusieurs événements)
            if (dayData.SuspendE > 1) {
                dayData.SuspendE_duration = `${dayData.SuspendE} évts`;
            } else {
                dayData.SuspendE_duration = '-';
            }
        }
        
        if (event.type === 'SuspendP') {
            dayData.SuspendP++;
            if (!dayData.SuspendP_start) dayData.SuspendP_start = hour;
            dayData.SuspendP_end = hour;
            if (dayData.SuspendP > 1) {
                dayData.SuspendP_duration = `${dayData.SuspendP} évts`;
            } else {
                dayData.SuspendP_duration = '-';
            }
        }
    });
    
    // Ajouter les jours avec crédit nul
    zeroCreditDates.forEach(date => {
        const dateStr = date.split('T')[0];
        if (!eventsMap.has(dateStr)) {
            eventsMap.set(dateStr, {
                date: dateStr,
                dateObj: new Date(date),
                SuspendE: 0,
                SuspendE_start: '',
                SuspendE_end: '',
                SuspendE_duration: '',
                SuspendP: 0,
                SuspendP_start: '',
                SuspendP_end: '',
                SuspendP_duration: '',
                CreditNul: 1
            });
        } else {
            eventsMap.get(dateStr).CreditNul = 1;
        }
    });
    
    // Convertir la Map en array
    eventsMap.forEach(dayData => eventsByDay.push(dayData));
    
    // Statistiques
    const daysWithCreditNul = new Set();
    const daysWithSuspendP = new Set();
    const daysWithSuspendE = new Set();
    
    eventsByDay.forEach(day => {
        if (day.CreditNul > 0) daysWithCreditNul.add(day.date);
        if (day.SuspendP > 0) daysWithSuspendP.add(day.date);
        if (day.SuspendE > 0) daysWithSuspendE.add(day.date);
    });
    
    const percentCreditNul = ((daysWithCreditNul.size / totalDays) * 100).toFixed(1);
    const percentSuspendP = ((daysWithSuspendP.size / totalDays) * 100).toFixed(1);
    const percentSuspendE = ((daysWithSuspendE.size / totalDays) * 100).toFixed(1);
    
    // Génération du HTML avec le nouveau look
    let html = `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">⚠️</span>
                <span class="client-id">Événements - Client ${client.id}</span>
                <span class="client-badge">${events.length + zeroCreditDates.length} signalements</span>
            </div>
            
            <!-- Statistiques sous forme de cartes -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
                <!-- Crédit nul -->
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 10px; padding: 12px; color: white;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 20px;">💰</span>
                        <span style="font-size: 12px; font-weight: 600; opacity: 0.9;">CRÉDIT NUL</span>
                    </div>
                    <div style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${daysWithCreditNul.size}</div>
                    <div style="font-size: 11px; opacity: 0.9;">jour(s) concerné(s)</div>
                    <div style="margin-top: 8px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${percentCreditNul}%; height: 100%; background: white; border-radius: 2px;"></div>
                    </div>
                    <div style="margin-top: 5px; font-size: 11px; font-weight: 600;">${percentCreditNul}%</div>
                </div>
                
                <!-- Puissance dépassée -->
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 10px; padding: 12px; color: white;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 20px;">📈</span>
                        <span style="font-size: 12px; font-weight: 600; opacity: 0.9;">PUISSANCE</span>
                    </div>
                    <div style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${daysWithSuspendP.size}</div>
                    <div style="font-size: 11px; opacity: 0.9;">jour(s) concerné(s)</div>
                    <div style="margin-top: 8px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${percentSuspendP}%; height: 100%; background: white; border-radius: 2px;"></div>
                    </div>
                    <div style="margin-top: 5px; font-size: 11px; font-weight: 600;">${percentSuspendP}%</div>
                </div>
                
                <!-- Énergie épuisée -->
                <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); border-radius: 10px; padding: 12px; color: white;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 20px;">🔋</span>
                        <span style="font-size: 12px; font-weight: 600; opacity: 0.9;">ÉNERGIE</span>
                    </div>
                    <div style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${daysWithSuspendE.size}</div>
                    <div style="font-size: 11px; opacity: 0.9;">jour(s) concerné(s)</div>
                    <div style="margin-top: 8px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${percentSuspendE}%; height: 100%; background: white; border-radius: 2px;"></div>
                    </div>
                    <div style="margin-top: 5px; font-size: 11px; font-weight: 600;">${percentSuspendE}%</div>
                </div>
            </div>
            
            <!-- Info période -->
            <div style="background: #f8fafc; border-radius: 8px; padding: 10px 15px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; border: 1px solid #e2e8f0;">
                <span>📅 ${totalDays} jours analysés</span>
                <span>📊 ${eventsByDay.length} jours avec événements</span>
                <span>⚡ ${events.length + zeroCreditDates.length} signalements</span>
            </div>
    `;
    
    // Bouton toggle si il y a des événements
    if (eventsByDay.length > 0) {
        const toggleId = `toggle-events-${client.id}`;
        const tableId = `events-table-${client.id}`;
        
        html += `
            <button id="${toggleId}" style="width: 100%; padding: 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; color: #334155; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 15px;">
                <span style="font-size: 16px;">🔽</span>
                <span>Afficher le tableau détaillé</span>
            </button>
            
            <div id="${tableId}" style="display: none; border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 15px; max-height: 350px; overflow-y: auto; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 900px;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th rowspan="2" style="padding: 15px 10px; text-align: left; border-right: 2px solid #cbd5e1; background: #f1f5f9; font-size: 14px; position: sticky; left: 0; z-index: 11;">📅 DATE</th>
                            <th colspan="3" style="padding: 12px 10px; text-align: center; background: #3b82f6; color: white; border-right: 2px solid #2563eb;">📈 PUISSANCE DÉPASSÉE</th>
                            <th colspan="1" style="padding: 12px 10px; text-align: center; background: #f59e0b; color: white; border-right: 2px solid #d97706;">💰 CRÉDIT NUL</th>
                            <th colspan="3" style="padding: 12px 10px; text-align: center; background: #0ea5e9; color: white;">🔋 ÉNERGIE ÉPUISÉE</th>
                        </tr>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1;">Début</th>
                            <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1;">Fin</th>
                            <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1; border-right: 2px solid #cbd5e1;">Durée</th>
                            <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1; border-right: 2px solid #cbd5e1;">Signalement</th>
                            <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1;">Début</th>
                            <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1;">Fin</th>
                            <th style="padding: 10px 8px; text-align: center; border-bottom: 1px solid #cbd5e1;">Durée</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Trier par date décroissante
        eventsByDay.sort((a, b) => new Date(b.dateObj) - new Date(a.dateObj));
        
        eventsByDay.forEach((day, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
            const formattedDate = new Date(day.date).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
            
            html += `
                <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                    <td style="padding: 12px 10px; font-weight: 600; border-right: 2px solid #e2e8f0; position: sticky; left: 0; background: ${bgColor};">
                        ${formattedDate}
                    </td>
                    
                    <!-- SuspendP -->
                    <td style="padding: 10px 8px; text-align: center; ${day.SuspendP > 0 ? 'background: #3b82f610; font-weight: 600; color: #2563eb;' : 'color: #94a3b8;'}">
                        ${day.SuspendP_start || '-'}
                    </td>
                    <td style="padding: 10px 8px; text-align: center; ${day.SuspendP > 0 ? 'background: #3b82f610; font-weight: 600; color: #2563eb;' : 'color: #94a3b8;'}">
                        ${day.SuspendP_end || '-'}
                    </td>
                    <td style="padding: 10px 8px; text-align: center; border-right: 2px solid #e2e8f0; ${day.SuspendP > 0 ? 'background: #3b82f620; font-weight: 700; color: #2563eb;' : 'color: #94a3b8;'}">
                        ${day.SuspendP_duration || '-'}
                    </td>
                    
                    <!-- Crédit Nul -->
                    <td style="padding: 10px 8px; text-align: center; border-right: 2px solid #e2e8f0; ${day.CreditNul > 0 ? 'background: #f59e0b; color: white; font-weight: 700;' : 'background: #f1f5f9; color: #94a3b8;'}">
                        ${day.CreditNul > 0 ? '⚠️ CRÉDIT NUL' : '✓ Normal'}
                    </td>
                    
                    <!-- SuspendE -->
                    <td style="padding: 10px 8px; text-align: center; ${day.SuspendE > 0 ? 'background: #0ea5e910; font-weight: 600; color: #0284c7;' : 'color: #94a3b8;'}">
                        ${day.SuspendE_start || '-'}
                    </td>
                    <td style="padding: 10px 8px; text-align: center; ${day.SuspendE > 0 ? 'background: #0ea5e910; font-weight: 600; color: #0284c7;' : 'color: #94a3b8;'}">
                        ${day.SuspendE_end || '-'}
                    </td>
                    <td style="padding: 10px 8px; text-align: center; ${day.SuspendE > 0 ? 'background: #0ea5e920; font-weight: 700; color: #0284c7;' : 'color: #94a3b8;'}">
                        ${day.SuspendE_duration || '-'}
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            
            <!-- Légende -->
            <div style="margin-top: 15px; padding: 12px 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; font-size: 12px;">
                <span><span style="color:#3b82f6;">⬤</span> Puissance dépassée (SuspendP)</span>
                <span><span style="color:#f59e0b;">⬤</span> Crédit nul</span>
                <span><span style="color:#0ea5e9;">⬤</span> Énergie épuisée (SuspendE)</span>
            </div>
        `;
    } else {
        html += `
            <div style="text-align: center; padding: 40px; color: #94a3b8; background: #f8fafc; border-radius: 12px;">
                <span style="font-size: 48px; display: block; margin-bottom: 15px;">✅</span>
                <h3 style="margin: 0 0 10px 0; color: #1e293b;">Aucun événement</h3>
                <p style="margin: 0; font-size: 14px;">Aucun événement pour ce client</p>
            </div>
        `;
    }
    
    html += `</div>`;
    
    // Ajouter le script pour le toggle après le rendu
    setTimeout(() => {
        const toggleBtn = document.getElementById(`toggle-events-${client.id}`);
        const table = document.getElementById(`events-table-${client.id}`);
        if (toggleBtn && table) {
            toggleBtn.addEventListener('click', () => {
                if (table.style.display === 'none') {
                    table.style.display = 'block';
                    toggleBtn.innerHTML = `<span style="font-size:16px;">🔼</span><span>Masquer le tableau</span>`;
                } else {
                    table.style.display = 'none';
                    toggleBtn.innerHTML = `<span style="font-size:16px;">🔽</span><span>Afficher le tableau détaillé</span>`;
                }
            });
        }
    }, 100);
    
    return html;
}

function renderCreditBoard() {
    const container = document.getElementById('creditBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<p class="no-data">❌ Aucun client sélectionné</p>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<p class="no-data">❌ Client non trouvé</p>';
        return;
    }
    
    if (isGhostClient(client)) {
        container.innerHTML = `
            <h3 class="card-title">💰 CRÉDIT & RECHARGES - Client ${client.id}</h3>
            <div class="client-card ghost">
                <div class="client-header">
                    <span class="client-icon">👻</span>
                    <span class="client-id">Client ${client.id}</span>
                    <span class="client-badge ghost">Client fantôme</span>
                </div>
                <div class="message-container">
                    <p class="client-message ghost">👻 Aucune donnée de crédit ou recharge disponible.</p>
                </div>
            </div>
        `;
        return;
    }
    
    // ===== RÉCUPÉRATION DES DONNÉES =====
    const credits = client.credits || [];
    const recharges = client.recharges || [];
    const zeroCreditDates = client.zeroCreditDates || [];
    
    // Traitement des données pour les séries sans crédit
    const streaksData = processCreditStreaks(credits, zeroCreditDates);
    
    // Traitement des données de recharge
    const rechargeData = processRechargeData(recharges);
    
    // ===== CONSTRUCTION DU HTML =====
    let html = `
        <h3 class="card-title">💰 CRÉDIT & RECHARGES - Client ${client.id}</h3>
        <div class="client-card" style="padding: 0; overflow: hidden;">
            <!-- En-tête violet -->
            <div style="background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%); color: white; padding: 10px 18px; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">💰</span>
                <span>Crédit & Recharges - Client ${client.id}</span>
            </div>
            
            <div style="padding: 15px;">
    `;
    
    // ===== 1. CARTE DES SÉRIES SANS CRÉDIT =====
    html += createStreaksCardHTML(streaksData);
    
    // ===== 2. ANALYSE DES HABITUDES DE RECHARGE =====
    if (rechargeData.hasData) {
        html += createRechargeHabitsHTML(rechargeData);
    }
    
    // ===== 3. BOUTON TOGGLE =====
    const toggleId = `toggle-credit-${client.id}`;
    const detailsId = `credit-details-${client.id}`;
    
    html += `
        <button id="${toggleId}" style="width: 100%; padding: 8px; margin-top: 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
            <span style="font-size:14px;">🔽</span> Afficher les détails
        </button>
        
        <div id="${detailsId}" style="display: none; margin-top: 15px;">
    `;
    
    // ===== 4. TABLEAUX DÉTAILS =====
    if (rechargeData.hasData) {
        html += createRechargeTableHTML(rechargeData, client.id);
    }
    
    if (credits.length > 0) {
        html += createSoldeTableHTML(credits, client.id);
    }
    
    html += `
            </div>
        </div>
    </div>`;
    
    container.innerHTML = html;
    
    // ===== ATTACHER L'ÉVÉNEMENT AU BOUTON =====
    setTimeout(() => {
        const toggleBtn = document.getElementById(toggleId);
        const detailsDiv = document.getElementById(detailsId);
        if (toggleBtn && detailsDiv) {
            toggleBtn.addEventListener('click', () => {
                if (detailsDiv.style.display === 'none') {
                    detailsDiv.style.display = 'block';
                    toggleBtn.innerHTML = `<span style="font-size:14px;">🔼</span> Masquer les détails`;
                } else {
                    detailsDiv.style.display = 'none';
                    toggleBtn.innerHTML = `<span style="font-size:14px;">🔽</span> Afficher les détails`;
                }
            });
        }
    }, 100);
}

// ===== FONCTIONS DE TRAITEMENT DES DONNÉES =====

function processCreditStreaks(credits, zeroCreditDates) {
    // Construire un tableau jour par jour avec les valeurs de crédit
    const creditByDate = new Map();
    
    // D'abord, ajouter tous les credits
    credits.forEach(c => {
        if (c.date) {
            const dateStr = c.date.split('T')[0];
            creditByDate.set(dateStr, c.value || 0);
        }
    });
    
    // Marquer les jours sans crédit (zeroCreditDates)
    zeroCreditDates.forEach(date => {
        const dateStr = date.split('T')[0];
        creditByDate.set(dateStr, 0);
    });
    
    // Convertir en tableau trié
    const sortedEntries = Array.from(creditByDate.entries())
        .map(([date, value]) => ({
            date,
            dateObj: new Date(date),
            value
        }))
        .sort((a, b) => a.dateObj - b.dateObj);
    
    // Détecter les séries consécutives de jours à 0
    const consecutiveGroups = [];
    let currentGroup = [];
    
    sortedEntries.forEach((record, index) => {
        if (record.value === 0) {
            if (index === 0) {
                currentGroup = [record];
            } else {
                const prevDate = sortedEntries[index-1].dateObj;
                const currDate = record.dateObj;
                const dayDiff = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
                
                if (dayDiff === 1 && sortedEntries[index-1].value === 0) {
                    currentGroup.push(record);
                } else {
                    if (currentGroup.length > 1) {
                        consecutiveGroups.push([...currentGroup]);
                    }
                    currentGroup = [record];
                }
            }
        }
    });
    
    if (currentGroup.length > 1) {
        consecutiveGroups.push(currentGroup);
    }
    
    return {
        hasData: consecutiveGroups.length > 0,
        consecutiveDays: consecutiveGroups
    };
}

function processRechargeData(recharges) {
    if (!recharges || recharges.length === 0) {
        return { hasData: false, purchaseDays: [], totalRecharges: 0 };
    }
    
    const purchaseDays = recharges.map(r => ({
        date: r.date,
        days: r.credit || 0,
        status: r.status || 'Réussie'
    })).filter(item => item.days > 0);
    
    // Compter les occurrences par nombre de jours
    const daysCountMap = new Map();
    purchaseDays.forEach(item => {
        const days = item.days;
        daysCountMap.set(days, (daysCountMap.get(days) || 0) + 1);
    });
    
    const sortedDays = Array.from(daysCountMap.entries()).sort((a, b) => b[0] - a[0]);
    
    // Répartition par intervalles
    let intervalJours = 0, intervalSemaine = 0, intervalMois = 0;
    purchaseDays.forEach(item => {
        const days = item.days;
        if (days >= 1 && days <= 6) intervalJours++;
        else if (days >= 7 && days <= 28) intervalSemaine++;
        else if (days >= 29) intervalMois++;
    });
    
    const total = purchaseDays.length;
    
    return {
        hasData: true,
        totalRecharges: recharges.length,
        purchaseDays: purchaseDays,
        rawData: recharges,
        daysCountMap,
        sortedDays,
        intervals: {
            jours: { count: intervalJours, percent: ((intervalJours / total) * 100).toFixed(1) },
            semaine: { count: intervalSemaine, percent: ((intervalSemaine / total) * 100).toFixed(1) },
            mois: { count: intervalMois, percent: ((intervalMois / total) * 100).toFixed(1) }
        }
    };
}

// ===== FONCTIONS DE RENDU HTML =====

function createStreaksCardHTML(streaksData) {
    if (!streaksData.hasData) {
        return `
            <div style="background: white; border-radius: 8px; margin-bottom: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
                <div style="padding: 10px; text-align: center; color: #64748b; background: #f8fafc; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 11px;">
                    <span style="font-size: 14px;">🔗</span>
                    <span>Aucune série >1 jour sans crédit</span>
                </div>
            </div>
        `;
    }
    
    const significantStreaks = streaksData.consecutiveDays.filter(group => group.length > 1);
    
    if (significantStreaks.length === 0) {
        return `
            <div style="background: white; border-radius: 8px; margin-bottom: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
                <div style="padding: 10px; text-align: center; color: #64748b; background: #f8fafc; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 11px;">
                    <span style="font-size: 14px;">🔗</span>
                    <span>Aucune série >1 jour sans crédit</span>
                </div>
            </div>
        `;
    }
    
    let longestStreak = 0;
    significantStreaks.forEach(group => {
        if (group.length > longestStreak) longestStreak = group.length;
    });
    
    const streaksHTML = significantStreaks.map((group, idx) => {
        const start = new Date(group[0].date).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit'
        });
        const end = new Date(group[group.length - 1].date).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit'
        });
        const isLongest = group.length === longestStreak;
        
        return `
            <div style="background: white; padding: 8px 10px; border-radius: 6px; border-left: 3px solid ${isLongest ? '#ef4444' : '#f97316'}; min-width: 140px; flex: 1 1 auto; border: 1px solid #e2e8f0; font-size: 11px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
                    <span style="color: #64748b;">#${idx+1}</span>
                    ${isLongest ? '<span style="background: #ef4444; color: white; padding: 1px 6px; border-radius: 10px; font-size: 8px;">MAX</span>' : ''}
                </div>
                <div style="font-weight: 700; color: ${isLongest ? '#ef4444' : '#f97316'}; font-size: 16px;">${group.length} jours</div>
                <div style="color: #475569;">${start} → ${end}</div>
            </div>
        `;
    }).join('');
    
    return `
        <div style="background: white; border-radius: 8px; margin-bottom: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
            <div style="padding: 12px;">
                <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 10px;">
                    <span style="font-size: 16px;">🔗</span>
                    <span style="font-weight: 600; font-size: 13px;">Séries sans crédit (>1 jour)</span>
                    <span style="margin-left: auto; background: #e2e8f0; padding: 2px 8px; border-radius: 12px; font-size: 10px;">
                        ${significantStreaks.length}
                    </span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${streaksHTML}
                </div>
            </div>
        </div>
    `;
}

function createRechargeHabitsHTML(rechargeData) {
    const totalPurchases = rechargeData.totalRecharges;
    const sortedDays = rechargeData.sortedDays;
    const intervals = rechargeData.intervals;
    
    // Déterminer l'habitude principale
    let mainHabit = { days: 0, count: 0, percentage: 0 };
    sortedDays.forEach(([days, count]) => {
        if (count > mainHabit.count) {
            mainHabit = { days, count, percentage: ((count / totalPurchases) * 100).toFixed(1) };
        }
    });
    
    // Déterminer l'intervalle principal
    const intervalList = [
        { name: 'Jours', value: intervals.jours.count, percent: intervals.jours.percent, color: '#f97316', range: '1-6j' },
        { name: 'Semaine', value: intervals.semaine.count, percent: intervals.semaine.percent, color: '#3b82f6', range: '7-28j' },
        { name: 'Mois', value: intervals.mois.count, percent: intervals.mois.percent, color: '#22c55e', range: '>28j' }
    ];
    
    const mainInterval = intervalList.reduce((max, interval) => 
        interval.value > max.value ? interval : max
    );
    
    // Barre des habitudes
    const habitBarHTML = sortedDays.map(([days, count]) => {
        const percentage = ((count / totalPurchases) * 100).toFixed(1);
        const bgColor = getDaysColor(days);
        
        return `
            <div style="width: ${percentage}%; height: 100%; background: ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white;" 
                title="${days} jours : ${count} recharge(s) (${percentage}%)">
                ${percentage > 8 ? percentage + '%' : ''}
            </div>
        `;
    }).join('');
    
    // Légende des habitudes
    const habitLegendHTML = sortedDays.map(([days, count]) => {
        const percentage = ((count / totalPurchases) * 100).toFixed(1);
        const bgColor = getDaysColor(days);
        const isMain = days === mainHabit.days;
        
        return `
            <div style="display: flex; align-items: center; gap: 5px; ${isMain ? 'background: #f1f5f9; padding: 2px 8px; border-radius: 16px; border: 1px solid #cbd5e1;' : ''}">
                <div style="width: 12px; height: 12px; background: ${bgColor}; border-radius: 3px;"></div>
                <span style="font-size: 11px; color: #334155;">
                    <strong>${days}j</strong>
                    <span style="color: #64748b;"> ${count}x</span>
                    <span style="color: #475569; font-weight: 600;"> ${percentage}%</span>
                    ${isMain ? '<span style="margin-left: 4px; font-size: 12px;">👑</span>' : ''}
                </span>
            </div>
        `;
    }).join('');
    
    // Barre des intervalles
    const intervalBarHTML = `
        <div style="width: ${intervals.jours.percent}%; height: 100%; background: #f97316; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white;" 
            title="1-6 jours : ${intervals.jours.count} recharge(s) (${intervals.jours.percent}%)">
            ${intervals.jours.percent > 8 ? intervals.jours.percent + '%' : ''}
        </div>
        <div style="width: ${intervals.semaine.percent}%; height: 100%; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white;" 
            title="7-28 jours : ${intervals.semaine.count} recharge(s) (${intervals.semaine.percent}%)">
            ${intervals.semaine.percent > 8 ? intervals.semaine.percent + '%' : ''}
        </div>
        <div style="width: ${intervals.mois.percent}%; height: 100%; background: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white;" 
            title=">28 jours : ${intervals.mois.count} recharge(s) (${intervals.mois.percent}%)">
            ${intervals.mois.percent > 8 ? intervals.mois.percent + '%' : ''}
        </div>
    `;
    
    // Légende des intervalles
    const intervalLegendHTML = intervalList.map(interval => {
        const isMain = interval.name === mainInterval.name;
        return `
            <div style="display: flex; align-items: center; gap: 5px; ${isMain ? 'background: #f1f5f9; padding: 3px 10px; border-radius: 20px;' : ''}">
                <div style="width: 14px; height: 14px; background: ${interval.color}; border-radius: 3px;"></div>
                <span style="font-size: 11px;"><strong>${interval.name}</strong> ${interval.range}: ${interval.value}x (${interval.percent}%)</span>
                ${isMain ? '<span style="font-size: 14px;">👑</span>' : ''}
            </div>
        `;
    }).join('');
    
    return `
        <div style="background: #f8fafc; border-radius: 8px; padding: 12px; margin-top: 12px; border: 1px solid #e2e8f0;">
            <!-- Habitude de recharge -->
            <div style="margin-bottom: 15px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span style="font-size: 16px;">📊</span>
                        <span style="font-weight: 600; font-size: 13px;">Habitudes de recharge</span>
                    </div>
                    <span style="background: #e2e8f0; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600;">
                        ${totalPurchases} recharges
                    </span>
                </div>
                
                <!-- Barre de progression -->
                <div style="height: 36px; background: #f1f5f9; border-radius: 18px; overflow: hidden; display: flex; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                    ${habitBarHTML}
                </div>
                
                <!-- Légende -->
                <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 5px; padding: 5px; background: #f8fafc; border-radius: 6px;">
                    ${habitLegendHTML}
                </div>
                
                <!-- Indication habitude principale -->
                <div style="background: #f1f5f9; padding: 6px 10px; border-radius: 6px; font-size: 11px; color: #334155; display: flex; align-items: center; gap: 8px; border-left: 3px solid #9f7aea;">
                    <span style="font-size: 14px;">👉</span>
                    <span><strong>Habitude principale :</strong> <span style="background: #9f7aea20; color: #7e22ce; padding: 2px 10px; border-radius: 20px; font-weight: 700;">${mainHabit.days} jours</span> (${mainHabit.percentage}% des recharges)</span>
                </div>
            </div>
            
            <!-- Séparateur -->
            <div style="height: 1px; background: #e2e8f0; margin: 10px 0;"></div>
            
            <!-- Répartition par intervalles -->
            <div style="margin-top: 10px;">
                <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 8px;">
                    <span style="font-size: 14px;">📈</span>
                    <span style="font-weight: 600; font-size: 12px;">Répartition par intervalle</span>
                </div>
                
                <div style="height: 36px; background: #f1f5f9; border-radius: 18px; overflow: hidden; display: flex; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                    ${intervalBarHTML}
                </div>
                
                <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-around; margin-bottom: 8px;">
                    ${intervalLegendHTML}
                </div>
                
                <div style="background: #f1f5f9; padding: 6px 10px; border-radius: 6px; font-size: 11px; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 14px;">🏆</span>
                    <span><strong>Intervalle principal :</strong> <span style="background: ${mainInterval.color}20; color: ${mainInterval.color}; padding: 2px 12px; border-radius: 20px; font-weight: 700;">${mainInterval.name}</span> (${mainInterval.percent}%, ${mainInterval.range})</span>
                </div>
            </div>
        </div>
    `;
}

function createRechargeTableHTML(rechargeData, clientId) {
    const sortedData = [...rechargeData.rawData].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    let rowsHTML = '';
    sortedData.forEach((row, index) => {
        const date = row.date || '-';
        const days = row.credit || 0;
        const status = row.status || 'Réussie';
        
        const statusColor = status.toLowerCase().includes('reussie') ? '#22c55e' : 
                           status.toLowerCase().includes('echoue') ? '#ef4444' : '#f59e0b';
        
        const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
        
        rowsHTML += `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                <td style="padding: 10px; white-space: nowrap;">${date}</td>
                <td style="padding: 10px; text-align: center; font-weight: 600; color: #f97316;">${days}</td>
                <td style="padding: 10px; text-align: center;">
                    <span style="background: ${statusColor}20; color: ${statusColor}; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 11px;">
                        ${status}
                    </span>
                </td>
            </tr>
        `;
    });
    
    return `
        <div style="border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
            <div style="background: linear-gradient(135deg, #9f7aea 0%, #805ad5 100%); color: white; padding: 15px 20px; font-size: 16px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                <span style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">⚡</span>
                    Historique des recharges
                </span>
                <span style="background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 30px; font-size: 13px;">
                    ${rechargeData.totalRecharges} opération(s)
                </span>
            </div>
            <div style="max-height: 350px; overflow-y: auto; overflow-x: auto; background: white;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 700px;">
                    <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10;">
                        <tr style="border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 12px 10px; text-align: left;">Date</th>
                            <th style="padding: 12px 10px; text-align: center;">Jours rechargés</th>
                            <th style="padding: 12px 10px; text-align: center;">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function createSoldeTableHTML(credits, clientId) {
    const sortedData = [...credits].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let rowsHTML = '';
    sortedData.forEach((row, index) => {
        const date = row.date || '-';
        const value = row.value || 0;
        const bgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
        
        rowsHTML += `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                <td style="padding: 10px; white-space: nowrap;">${date}</td>
                <td style="padding: 10px; text-align: center; font-weight: 600; color: ${value === 0 ? '#ef4444' : '#48bb78'};">${value}</td>
                <td style="padding: 10px; text-align: center;">
                    ${value === 0 ? 
                        '<span style="background: #ef444420; color: #ef4444; padding: 3px 10px; border-radius: 20px; font-size: 11px;">Sans crédit</span>' : 
                        '<span style="background: #48bb7820; color: #48bb78; padding: 3px 10px; border-radius: 20px; font-size: 11px;">Crédit disponible</span>'}
                </td>
            </tr>
        `;
    });
    
    return `
        <div style="border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 15px 20px; font-size: 16px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                <span style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">💰</span>
                    Historique des soldes (crédits)
                </span>
                <span style="background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 30px; font-size: 13px;">
                    ${credits.length} relevé(s)
                </span>
            </div>
            <div style="max-height: 350px; overflow-y: auto; overflow-x: auto; background: white;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 400px;">
                    <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10;">
                        <tr style="border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 12px 10px; text-align: left;">Date</th>
                            <th style="padding: 12px 10px; text-align: center;">Crédit (jours)</th>
                            <th style="padding: 12px 10px; text-align: center;">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function getDaysColor(days) {
    if (days >= 30) return '#22c55e';      // Vert
    if (days >= 20) return '#84cc16';      // Vert clair
    if (days >= 15) return '#eab308';      // Jaune
    if (days >= 10) return '#f97316';      // Orange
    if (days >= 7) return '#ef4444';       // Rouge
    if (days >= 5) return '#ec4899';       // Rose
    if (days >= 3) return '#8b5cf6';       // Violet
    if (days === 2) return '#60a5fa';       // Bleu clair pour 2j
    return '#94a3b8';                        // Gris clair pour 1j
}
