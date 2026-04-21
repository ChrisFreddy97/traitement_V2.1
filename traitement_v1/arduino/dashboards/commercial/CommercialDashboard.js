// dashboards/commercial/CommercialDashboard.js
import { database } from '../../arduinoCore.js';
import { FORFAIT_LIMITS, FORFAIT_NAMES } from '../../arduinoConstants.js';

// ===========================================
// STYLES CENTRALISÉS
// ===========================================
const STYLES = {
    colors: {
        primary: '#9f7aea',
        primaryDark: '#805ad5',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#0ea5e9',
        infoDark: '#0284c7',
        blue: '#3b82f6',
        blueDark: '#2563eb',
        gray: '#64748b',
        grayLight: '#94a3b8',
        grayBg: '#f8fafc',
        border: '#e2e8f0',
        borderDark: '#cbd5e1',
        text: '#334155',
        textDark: '#1e293b'
    },
    gradients: {
        creditNul: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        puissance: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        energie: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
        creditRecharge: 'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)',
        solde: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)'
    },
    borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        full: '30px'
    },
    spacing: {
        xs: '8px',
        sm: '10px',
        md: '12px',
        lg: '15px',
        xl: '20px'
    }
};

// ===========================================
// FONCTIONS UTILITAIRES
// ===========================================

/**
 * Formate une date au format jj/mm/aaaa
 */
function formatDateToFrench(dateInput) {
    if (!dateInput) return '-';
    
    try {
        let date;
        if (dateInput instanceof Date) {
            date = dateInput;
        } else if (typeof dateInput === 'string') {
            const cleanDate = dateInput.split('T')[0];
            date = new Date(cleanDate);
        } else {
            return '-';
        }
        
        if (isNaN(date.getTime())) return '-';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    } catch {
        return '-';
    }
}

/**
 * Formate une date courte (jj/mm/aa)
 */
function formatDateShort(dateInput) {
    const fullDate = formatDateToFrench(dateInput);
    if (fullDate === '-') return '-';
    const parts = fullDate.split('/');
    return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
}

/**
 * Retourne la couleur en fonction du nombre de jours
 */
function getDaysColor(days) {
    if (days >= 30) return STYLES.colors.success;
    if (days >= 20) return '#84cc16';
    if (days >= 15) return '#eab308';
    if (days >= 10) return STYLES.colors.warning;
    if (days >= 7) return STYLES.colors.danger;
    if (days >= 5) return '#ec4899';
    if (days >= 3) return '#8b5cf6';
    if (days === 2) return '#60a5fa';
    return STYLES.colors.grayLight;
}

/**
 * Vérifie si un client est fantôme
 */
function isGhostClient(client) {
    const hasRecharges = (client.recharges?.length ?? 0) > 0;
    const hasConso = (client.consommation?.journaliere?.length ?? 0) > 0;
    const hasEvents = (client.events?.length ?? 0) > 0;
    const hasCredits = (client.credits?.length ?? 0) > 0;
    
    if (!hasRecharges && !hasConso && !hasEvents && !hasCredits) return true;
    
    const allConsoZero = client.consommation?.journaliere?.every(c => c.valeur === 0) ?? true;
    const allCreditsZero = client.credits?.every(c => c.value === 0) ?? true;
    
    return (hasConso && allConsoZero) || (hasCredits && allCreditsZero);
}

// ===========================================
// TRAITEMENT DES DONNÉES (CACHE)
// ===========================================

const dataCache = new Map();

function getCachedData(client, key, computeFn) {
    const cacheKey = `${client.id}_${key}_${client.forfaitChanges?.length ?? 0}_${client.consommation?.journaliere?.length ?? 0}`;
    
    if (dataCache.has(cacheKey)) {
        return dataCache.get(cacheKey);
    }
    
    const result = computeFn(client);
    dataCache.set(cacheKey, result);
    return result;
}

function clearCache() {
    dataCache.clear();
}

// ===========================================
// TRAITEMENT DES DONNÉES FORFAIT
// ===========================================

function buildForfaitHistory(client) {
    const changes = client.forfaitChanges ?? [];
    const consoJournaliere = client.consommation?.journaliere ?? [];
    const firstDate = consoJournaliere.length > 0 ? consoJournaliere[0].date : '2024-01-01';
    const history = [];
    
    if (changes.length === 0) {
        history.push({
            forfait: client.forfaitName || 'ECO',
            code: client.forfaitActuel || 1,
            startDate: firstDate,
            endDate: null,
            isCurrent: true
        });
        return history;
    }
    
    const sortedChanges = [...changes].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    history.push({
        forfait: FORFAIT_NAMES[sortedChanges[0].ancien] || `Forfait ${sortedChanges[0].ancien}`,
        code: sortedChanges[0].ancien,
        startDate: firstDate,
        endDate: sortedChanges[0].date,
        isCurrent: false
    });
    
    for (let i = 0; i < sortedChanges.length; i++) {
        const change = sortedChanges[i];
        const nextChange = sortedChanges[i + 1];
        
        history.push({
            forfait: FORFAIT_NAMES[change.nouveau] || `Forfait ${change.nouveau}`,
            code: change.nouveau,
            startDate: change.date,
            endDate: nextChange?.date ?? null,
            isCurrent: !nextChange
        });
    }
    
    return history;
}

function computeForfaitStats(client, forfaitHistory) {
    const consoJournaliere = client.consommation?.journaliere ?? [];
    const events = client.events ?? [];
    
    const suspendEDates = new Set(
        events.filter(e => e.type === 'SuspendE' && e.date)
              .map(e => e.date.split('T')[0])
    );
    
    return forfaitHistory.map((forfait, index, array) => {
        const forfaitMax = FORFAIT_LIMITS[forfait.forfait]?.max || 100;
        const seuil85 = forfaitMax * 0.85;
        const seuil115 = forfaitMax * 1.15;
        
        const daysInPeriod = [];
        const daysWithConso = [];
        
        for (const day of consoJournaliere) {
            const dayDate = day.date;
            if (!dayDate) continue;
            
            const inPeriod = forfait.endDate 
                ? (dayDate >= forfait.startDate && dayDate <= forfait.endDate)
                : (dayDate >= forfait.startDate);
            
            if (inPeriod) {
                daysInPeriod.push(day);
                if (day.valeur > 0) daysWithConso.push(day);
            }
        }
        
        const maxEnergy = daysWithConso.length > 0 
            ? Math.max(...daysWithConso.map(d => d.valeur)).toFixed(1) : 0;
        
        const avgEnergy = daysWithConso.length > 0 
            ? (daysWithConso.reduce((sum, d) => sum + d.valeur, 0) / daysWithConso.length).toFixed(1) : 0;
        
        const daysBelow85 = daysWithConso.filter(d => d.valeur <= seuil85).length;
        const daysInTolerance = daysWithConso.filter(d => d.valeur > seuil85 && d.valeur <= seuil115).length;
        const daysAbove115 = daysWithConso.filter(d => {
            const dateStr = d.date.split('T')[0];
            return d.valeur > seuil115 || suspendEDates.has(dateStr);
        }).length;
        
        let changeText = index === 0 
            ? '<span style="color: #64748b;">Premier forfait</span>'
            : `
                <span style="background: #f97315; color: white; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-right: 5px;">
                    ${array[index-1].forfait}
                </span>
                →
                <span style="background: #22c55e; color: white; padding: 4px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-left: 5px;">
                    ${forfait.forfait}
                </span>
            `;
        
        return {
            ...forfait,
            changeText,
            totalDays: daysInPeriod.length,
            daysWithConso: daysWithConso.length,
            daysWithoutConso: daysInPeriod.length - daysWithConso.length,
            maxEnergy,
            avgEnergy,
            daysBelow85,
            daysInTolerance,
            daysAbove115,
            percentBelow85: daysWithConso.length > 0 ? ((daysBelow85 / daysWithConso.length) * 100).toFixed(1) : 0,
            percentInTolerance: daysWithConso.length > 0 ? ((daysInTolerance / daysWithConso.length) * 100).toFixed(1) : 0,
            percentAbove115: daysWithConso.length > 0 ? ((daysAbove115 / daysWithConso.length) * 100).toFixed(1) : 0,
            forfaitMax,
            seuil85,
            seuil115,
            suspendECount: suspendEDates.size
        };
    });
}

// ===========================================
// TRAITEMENT DES DONNÉES CRÉDIT
// ===========================================


function processCreditStreaks(credits, zeroCreditDates) {
    const creditByDate = new Map();
    
    credits.forEach(c => {
        if (c.date) {
            const dateStr = c.date.split('T')[0];
            creditByDate.set(dateStr, c.value ?? 0);
        }
    });
    
    zeroCreditDates.forEach(date => {
        const dateStr = date.split('T')[0];
        creditByDate.set(dateStr, 0);
    });
    
    const sortedEntries = Array.from(creditByDate.entries())
        .map(([date, value]) => ({ date, dateObj: new Date(date), value }))
        .sort((a, b) => a.dateObj - b.dateObj);
    
    const consecutiveGroups = [];
    let currentGroup = [];
    
    for (let i = 0; i < sortedEntries.length; i++) {
        const record = sortedEntries[i];
        
        if (record.value === 0) {
            if (currentGroup.length === 0) {
                currentGroup = [record];
            } else {
                const prevDate = sortedEntries[i-1].dateObj;
                const dayDiff = Math.round((record.dateObj - prevDate) / (1000 * 60 * 60 * 24));
                
                if (dayDiff === 1 && sortedEntries[i-1].value === 0) {
                    currentGroup.push(record);
                } else {
                    if (currentGroup.length > 1) consecutiveGroups.push([...currentGroup]);
                    currentGroup = [record];
                }
            }
        } else {
            if (currentGroup.length > 1) consecutiveGroups.push([...currentGroup]);
            currentGroup = [];
        }
    }
    
    if (currentGroup.length > 1) consecutiveGroups.push(currentGroup);
    
    return {
        hasData: consecutiveGroups.length > 0,
        consecutiveDays: consecutiveGroups
    };
}

function processRechargeData(recharges) {
    if (!recharges?.length) {
        return { hasData: false, purchaseDays: [], totalRecharges: 0 };
    }
    
    const purchaseDays = recharges
        .map(r => ({ date: r.date, days: r.credit ?? 0, status: r.status || 'Réussie' }))
        .filter(item => item.days > 0);
    
    const daysCountMap = new Map();
    purchaseDays.forEach(item => {
        daysCountMap.set(item.days, (daysCountMap.get(item.days) || 0) + 1);
    });
    
    const sortedDays = Array.from(daysCountMap.entries()).sort((a, b) => b[0] - a[0]);
    
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
        purchaseDays,
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

// ===========================================
// COMPOSANTS UI RÉUTILISABLES
// ===========================================

function renderBadge(text, color, isCurrent = false) {
    const bgColor = isCurrent ? `${color}20` : `${color}20`;
    const textColor = isCurrent ? color : color;
    return `<span class="client-badge" style="background: ${bgColor}; color: ${textColor};">${text}${isCurrent ? ' (actuel)' : ''}</span>`;
}

function renderProgressBar(percentages, labels, colors) {
    return `
        <div class="unified-progress-bar" style="height: 40px; margin-bottom: 10px; display: flex;">
            ${percentages.map((pct, idx) => `
                <div class="progress-segment" 
                     style="width: ${pct}%; height: 100%; background: ${colors[idx]}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.2);" 
                     title="${labels[idx]}">
                    ${pct > 8 ? pct + '%' : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function renderGhostCard(title, clientId, message) {
    return `
        <h3 class="card-title">${title} - Client ${clientId}</h3>
        <div class="client-card ghost">
            <div class="client-header">
                <span class="client-icon">👻</span>
                <span class="client-id">Client ${clientId}</span>
                <span class="client-badge ghost">Client fantôme</span>
            </div>
            <div class="message-container">
                <p class="client-message ghost">👻 ${message}</p>
            </div>
        </div>
    `;
}

// ===========================================
// RENDU DES BOARDS
// ===========================================

// Variables globales
let activeClientId = null;
let clientsList = [];

export function renderCommercialDashboard() {
    const container = document.getElementById('commercialDashboard');
    if (!container) return;
    
    clientsList = Array.from(database.commercialData?.clients?.values() ?? [])
        .filter(c => typeof c.id === 'number' && c.id <= 50);
    
    activeClientId = clientsList.length > 0 ? clientsList[0].id : null;
    
    container.innerHTML = `
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
        
        <button class="toggle-tables-btn" onclick="window.toggleTablesContainer?.()">
            📋 Afficher les tableaux détaillés
        </button>
    `;
    
    renderGlobalClientTabs();
    renderAllBoards();
    attachGlobalNavigation();
}

function renderGlobalClientTabs() {
    const container = document.getElementById('globalClientTabs');
    if (!container || clientsList.length === 0) return;
    
    container.innerHTML = clientsList.map(client => {
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
            tabs.forEach(tab => {
                tab.classList.toggle('active', parseInt(tab.dataset.clientId) === activeClientId);
            });
            renderAllBoards();
        }
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => switchToClient(tab.dataset.clientId));
        });
        
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

function renderAllBoards() {
    renderConsumptionBoard();
    renderEventsBoard();
    renderCreditBoard();
}

// ===========================================
// RENDU CONSOMMATION BOARD
// ===========================================

function renderConsumptionBoard() {
    const container = document.getElementById('consumptionBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<div class="error-message show">❌ Aucun client sélectionné</div>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<div class="error-message show">❌ Client non trouvé</div>';
        return;
    }
    
    if (isGhostClient(client)) {
        container.innerHTML = renderGhostCard('📋 HISTORIQUE FORFAITS & CONSOMMATION', client.id, 'Aucune donnée de consommation ou forfait disponible.');
        return;
    }
    
    const forfaitHistory = buildForfaitHistory(client);
    const forfaitStats = computeForfaitStats(client, forfaitHistory);
    
    // Calcul du nombre total de jours pour l'affichage
    const totalDays = forfaitStats.reduce((sum, stat) => sum + stat.totalDays, 0);
    
    // EN-TÊTE À LA RENDERINFOCARD (exactement le même style)
    let html = `
        <div style="background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <!-- En-tête style carte (copié de renderInfoCard) -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 18px;">📋</span>
                    <span style="font-weight: 600;">HISTORIQUE FORFAITS & CONSOMMATION</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px;">👤 Client ${client.id}</span>
                    <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px;">📊 ${totalDays} jours</span>
                </div>
            </div>
    `;
    
    if (forfaitStats.length > 0) {
        // Contenu principal (tableau + détails)
        html += `<div style="padding: 20px;">`;
        
        // Tableau des forfaits
        html += `
            <div class="table-wrapper" style="margin-bottom: 25px;">
                <table class="table-details">
                    <thead>
                        <tr>
                            <th>Forfait</th>
                            <th>Changement</th>
                            <th>Jours totaux</th>
                            <th>Jours avec conso</th>
                            <th>Jours sans conso</th>
                            <th>Énergie max</th>
                            <th>Énergie moy</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${forfaitStats.map((stat, idx) => {
                            const badgeClass = stat.isCurrent ? 'badge-excellent' : 'badge-extreme';
                            return `
                                <tr>
                                    <td class="text-center"><span class="badge ${badgeClass}">${stat.forfait}</span></td>
                                    <td class="text-center" style="white-space: nowrap;">${stat.changeText}</td>
                                    <td class="text-center" style="font-weight: 600;">${stat.totalDays}</td>
                                    <td class="text-center" style="font-weight: 600; color: var(--success);">${stat.daysWithConso}</td>
                                    <td class="text-center" style="font-weight: 600; color: var(--gray-600);">${stat.daysWithoutConso}</td>
                                    <td class="text-center">${stat.maxEnergy} Wh</td>
                                    <td class="text-center">${stat.avgEnergy} Wh</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Détails par forfait
        forfaitStats.forEach((stat, index) => {
            const startDate = formatDateToFrench(stat.startDate);
            const endDate = stat.endDate ? formatDateToFrench(stat.endDate) : 'Présent';
            const badgeClass = stat.isCurrent ? 'badge-excellent' : 'badge-extreme';
            const cardBg = index % 2 === 0 ? '#ffffff' : '#fafbfc';
            const borderColor = stat.isCurrent ? 'var(--success)' : 'var(--primary)';
            
            html += `
                <div class="stat-box" style="margin-bottom: 20px; background: ${cardBg}; border-left: 4px solid ${borderColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <span class="badge ${badgeClass}">${stat.forfait}</span>
                            <span class="tag small">📅 ${startDate} → ${endDate}</span>
                        </div>
                        <span class="tag">📊 ${stat.daysWithConso} jours avec conso</span>
                    </div>
                    
                    <div class="unified-progress-bar">
                        ${stat.percentBelow85 > 0 ? `<div class="progress-segment success" style="width: ${stat.percentBelow85}%;"></div>` : ''}
                        ${stat.percentInTolerance > 0 ? `<div class="progress-segment warning" style="width: ${stat.percentInTolerance}%;"></div>` : ''}
                        ${stat.percentAbove115 > 0 ? `<div class="progress-segment danger" style="width: ${stat.percentAbove115}%;"></div>` : ''}
                    </div>
                    
                    <div class="progress-legend">
                        <div class="legend-item">
                            <span class="legend-dot success"></span>
                            <span class="legend-label">≤${stat.seuil85.toFixed(0)}Wh :</span>
                            <span class="legend-value">${stat.daysBelow85}j (${stat.percentBelow85}%)</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot warning"></span>
                            <span class="legend-label">${stat.seuil85.toFixed(0)}-${stat.seuil115.toFixed(0)}Wh :</span>
                            <span class="legend-value">${stat.daysInTolerance}j (${stat.percentInTolerance}%)</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot danger"></span>
                            <span class="legend-label">>${stat.seuil115.toFixed(0)}Wh :</span>
                            <span class="legend-value">${stat.daysAbove115}j (${stat.percentAbove115}%)</span>
                        </div>
                    </div>
                    
                    <div class="progress-footer">
                        <span class="total-days">📅 Total : ${stat.totalDays} jours</span>
                        <span class="detail-counts">⚡ Moyenne : ${stat.avgEnergy} Wh | Max : ${stat.maxEnergy} Wh</span>
                    </div>
                </div>
            `;
        });
        
        if (forfaitStats[0]?.suspendECount > 0) {
            html += `
                <div class="message-container" style="background: #fee2e2; border-left: 4px solid var(--danger);">
                    <div class="client-message danger" style="background: transparent;">
                        ⚠️ ${forfaitStats[0].suspendECount} jour(s) avec SuspendE détecté(s) (comptés dans la zone rouge)
                    </div>
                </div>
            `;
        }
        
        html += `</div>`; // fermeture padding
    } else {
        html += '<div class="info-section show" style="margin: 20px;">📭 Aucune donnée de consommation disponible</div>';
    }
    
    html += `</div>`; // fermeture de la carte principale
    container.innerHTML = html;
}

// ===========================================
// RENDU EVENTS BOARD
// ===========================================

function renderEventsBoard() {
    const container = document.getElementById('commercialEventsBoard');
    if (!container) return;
    
    if (!activeClientId) {
        container.innerHTML = '<div class="error-message show">❌ Aucun client sélectionné</div>';
        return;
    }
    
    const client = clientsList.find(c => c.id === activeClientId);
    if (!client) {
        container.innerHTML = '<div class="error-message show">❌ Client non trouvé</div>';
        return;
    }
    
    if (isGhostClient(client)) {
        container.innerHTML = renderGhostCard('⚠️ ÉVÉNEMENTS', client.id, 'Aucun événement enregistré pour ce client.');
        return;
    }
    
    container.innerHTML = renderEventsClient(client);
}

function renderEventsClient(client) {
    const events = client.events ?? [];
    const zeroCreditDates = client.zeroCreditDates ?? [];
    const totalDays = client.consommation?.journaliere?.length ?? client.credits?.length ?? zeroCreditDates.length ?? 1;
    
    const eventsMap = new Map();
    
    events.forEach(event => {
        if (!event.date) return;
        const dateStr = event.date.split('T')[0];
        const hour = event.date.includes('T') ? event.date.split('T')[1]?.substring(0,5) : '';
        
        if (!eventsMap.has(dateStr)) {
            eventsMap.set(dateStr, {
                date: dateStr,
                dateObj: new Date(event.date),
                SuspendE: 0, SuspendE_start: '', SuspendE_end: '', SuspendE_duration: '',
                SuspendP: 0, SuspendP_start: '', SuspendP_end: '', SuspendP_duration: '',
                CreditNul: 0
            });
        }
        
        const dayData = eventsMap.get(dateStr);
        
        if (event.type === 'SuspendE') {
            dayData.SuspendE++;
            if (!dayData.SuspendE_start) dayData.SuspendE_start = hour;
            dayData.SuspendE_end = hour;
            dayData.SuspendE_duration = dayData.SuspendE > 1 ? `${dayData.SuspendE} évts` : '-';
        }
        
        if (event.type === 'SuspendP') {
            dayData.SuspendP++;
            if (!dayData.SuspendP_start) dayData.SuspendP_start = hour;
            dayData.SuspendP_end = hour;
            dayData.SuspendP_duration = dayData.SuspendP > 1 ? `${dayData.SuspendP} évts` : '-';
        }
    });
    
    zeroCreditDates.forEach(date => {
        const dateStr = date.split('T')[0];
        if (!eventsMap.has(dateStr)) {
            eventsMap.set(dateStr, {
                date: dateStr, dateObj: new Date(date),
                SuspendE: 0, SuspendE_start: '', SuspendE_end: '', SuspendE_duration: '',
                SuspendP: 0, SuspendP_start: '', SuspendP_end: '', SuspendP_duration: '',
                CreditNul: 1
            });
        } else {
            eventsMap.get(dateStr).CreditNul = 1;
        }
    });
    
    const eventsByDay = Array.from(eventsMap.values());
    
    const daysWithCreditNul = new Set(eventsByDay.filter(d => d.CreditNul > 0).map(d => d.date));
    const daysWithSuspendP = new Set(eventsByDay.filter(d => d.SuspendP > 0).map(d => d.date));
    const daysWithSuspendE = new Set(eventsByDay.filter(d => d.SuspendE > 0).map(d => d.date));
    
    const totalEvents = events.length + zeroCreditDates.length;
    const hasAnyEvent = daysWithCreditNul.size > 0 || daysWithSuspendP.size > 0 || daysWithSuspendE.size > 0;
    
    // ✅ CONDITION : si aucun événement (toutes les valeurs à 0)
    if (!hasAnyEvent || totalEvents === 0) {
        return `
            <div style="background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 18px;">⚠️</span>
                        <span style="font-weight: 600;">ÉVÉNEMENTS - Client ${client.id}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px;">📊 0 signalements</span>
                    </div>
                </div>
                <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                    <span style="font-size: 48px; display: block; margin-bottom: 16px;">✅</span>
                    <h3 style="margin: 0 0 8px 0; color: #1e293b;">Aucun événement</h3>
                    <p style="margin: 0; font-size: 14px;">Aucun événement enregistré pour ce client</p>
                </div>
            </div>
        `;
    }
    
    // Sinon, afficher le dashboard complet avec l'en-tête style renderInfoCard
    const percentCreditNul = ((daysWithCreditNul.size / totalDays) * 100).toFixed(1);
    const percentSuspendP = ((daysWithSuspendP.size / totalDays) * 100).toFixed(1);
    const percentSuspendE = ((daysWithSuspendE.size / totalDays) * 100).toFixed(1);
    
    let html = `
        <div style="background: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <!-- En-tête style renderInfoCard -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 18px;">⚠️</span>
                    <span style="font-weight: 600;">ÉVÉNEMENTS - Client ${client.id}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px;">📊 ${totalEvents} signalements</span>
                    <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 11px;">📅 ${totalDays} jours</span>
                </div>
            </div>
            
            <div style="padding: 20px;">
                <!-- 3 stats cards -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
                    ${renderStatCard('💰', 'CRÉDIT NUL', daysWithCreditNul.size, percentCreditNul, 'linear-gradient(135deg, #f59e0b, #d97706)')}
                    ${renderStatCard('📈', 'PUISSANCE', daysWithSuspendP.size, percentSuspendP, 'linear-gradient(135deg, #3b82f6, #2563eb)')}
                    ${renderStatCard('🔋', 'ÉNERGIE', daysWithSuspendE.size, percentSuspendE, 'linear-gradient(135deg, #06b6d4, #0891b2)')}
                </div>
                
                <!-- Résumé rapide -->
                <div style="background: #f8fafc; border-radius: 12px; padding: 12px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; border: 1px solid #e2e8f0;">
                    <span>📅 ${totalDays} jours analysés</span>
                    <span>📊 ${eventsByDay.length} jours avec événements</span>
                    <span>⚡ ${totalEvents} signalements</span>
                </div>
    `;
    
    if (eventsByDay.length > 0) {
        const toggleId = `toggle-events-${client.id}`;
        const tableId = `events-table-${client.id}`;
        
        html += `
            <button id="${toggleId}" style="width: 100%; padding: 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; color: #1e293b; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px;">
                <span style="font-size: 16px;">🔽</span> Afficher le tableau détaillé
            </button>
            
            <div id="${tableId}" style="display: none; border: 2px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 20px; max-height: 350px; overflow-y: auto; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 900px;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th rowspan="2" style="padding: 16px 8px; text-align: left; border-right: 2px solid #cbd5e1; background: #f1f5f9; font-size: 14px; position: sticky; left: 0; z-index: 11;">📅 DATE</th>
                            <th colspan="3" style="padding: 12px 8px; text-align: center; background: #3b82f6; color: white; border-right: 2px solid #2563eb;">📈 PUISSANCE DÉPASSÉE</th>
                            <th colspan="1" style="padding: 12px 8px; text-align: center; background: #f59e0b; color: white; border-right: 2px solid #d97706;">💰 CRÉDIT NUL</th>
                            <th colspan="3" style="padding: 12px 8px; text-align: center; background: #06b6d4; color: white;">🔋 ÉNERGIE ÉPUISÉE</th>
                        </tr>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 8px 8px; text-align: center;">Début</th>
                            <th style="padding: 8px 8px; text-align: center;">Fin</th>
                            <th style="padding: 8px 8px; text-align: center; border-right: 2px solid #cbd5e1;">Durée</th>
                            <th style="padding: 8px 8px; text-align: center; border-right: 2px solid #cbd5e1;">Signalement</th>
                            <th style="padding: 8px 8px; text-align: center;">Début</th>
                            <th style="padding: 8px 8px; text-align: center;">Fin</th>
                            <th style="padding: 8px 8px; text-align: center;">Durée</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${eventsByDay.sort((a, b) => b.dateObj - a.dateObj).map((day, idx) => {
                            const bgColor = idx % 2 === 0 ? '#ffffff' : '#fafbfc';
                            return `
                                <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
                                    <td style="padding: 12px 8px; font-weight: 600; border-right: 2px solid #e2e8f0; position: sticky; left: 0; background: ${bgColor};">${formatDateToFrench(day.date)}</td>
                                    <td style="padding: 8px 8px; text-align: center; ${day.SuspendP > 0 ? `background: #3b82f610; font-weight: 600; color: #2563eb;` : `color: #94a3b8;`}">${day.SuspendP_start || '-'}</td>
                                    <td style="padding: 8px 8px; text-align: center; ${day.SuspendP > 0 ? `background: #3b82f610; font-weight: 600; color: #2563eb;` : `color: #94a3b8;`}">${day.SuspendP_end || '-'}</td>
                                    <td style="padding: 8px 8px; text-align: center; border-right: 2px solid #e2e8f0; ${day.SuspendP > 0 ? `background: #3b82f620; font-weight: 700; color: #2563eb;` : `color: #94a3b8;`}">${day.SuspendP_duration || '-'}</td>
                                    <td style="padding: 8px 8px; text-align: center; border-right: 2px solid #e2e8f0; ${day.CreditNul > 0 ? `background: #f59e0b; color: white; font-weight: 700;` : `background: #f1f5f9; color: #94a3b8;`}">${day.CreditNul > 0 ? '⚠️ CRÉDIT NUL' : '✓ Normal'}</td>
                                    <td style="padding: 8px 8px; text-align: center; ${day.SuspendE > 0 ? `background: #06b6d410; font-weight: 600; color: #0891b2;` : `color: #94a3b8;`}">${day.SuspendE_start || '-'}</td>
                                    <td style="padding: 8px 8px; text-align: center; ${day.SuspendE > 0 ? `background: #06b6d410; font-weight: 600; color: #0891b2;` : `color: #94a3b8;`}">${day.SuspendE_end || '-'}</td>
                                    <td style="padding: 8px 8px; text-align: center; ${day.SuspendE > 0 ? `background: #06b6d420; font-weight: 700; color: #0891b2;` : `color: #94a3b8;`}">${day.SuspendE_duration || '-'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 20px; padding: 12px 24px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; font-size: 12px;">
                <span><span style="color: #3b82f6;">⬤</span> Puissance dépassée (SuspendP)</span>
                <span><span style="color: #f59e0b;">⬤</span> Crédit nul</span>
                <span><span style="color: #06b6d4;">⬤</span> Énergie épuisée (SuspendE)</span>
            </div>
        `;
    }
    
    html += `</div></div>`; // fermeture padding + carte
    return html;
}

function renderStatCard(icon, label, value, percent, gradient) {
    return `
        <div style="background: ${gradient}; border-radius: 12px; padding: 12px; color: white;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 20px;">${icon}</span>
                <span style="font-size: 12px; font-weight: 600; opacity: 0.9;">${label}</span>
            </div>
            <div style="font-size: 28px; font-weight: 800; margin-bottom: 4px;">${value}</div>
            <div style="font-size: 11px; opacity: 0.9;">jour(s) concerné(s)</div>
            <div style="margin-top: 8px; background: rgba(255,255,255,0.2); height: 4px; border-radius: 2px; overflow: hidden;">
                <div style="width: ${percent}%; height: 100%; background: white; border-radius: 2px;"></div>
            </div>
            <div style="margin-top: 5px; font-size: 11px; font-weight: 600;">${percent}%</div>
        </div>
    `;
}

// ===========================================
// RENDU CREDIT BOARD
// ===========================================

function renderCreditBoard() {
    destroyCreditChart(); 
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
        container.innerHTML = renderGhostCard('💰 CRÉDIT & RECHARGES', client.id, 'Aucune donnée de crédit ou recharge disponible.');
        return;
    }
    
    const credits = client.credits ?? [];
    const recharges = client.recharges ?? [];
    const zeroCreditDates = client.zeroCreditDates ?? [];
    
    const streaksData = processCreditStreaks(credits, zeroCreditDates);
    const rechargeData = processRechargeData(recharges);
    
    let html = `
        <div class="client-card" style="padding: 0; overflow: hidden;">
            <div style="background: ${STYLES.gradients.creditRecharge}; color: white; padding: ${STYLES.spacing.sm} 18px; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">💰</span>
                <span>Crédit & Recharges - Client ${client.id}</span>
            </div>
            <div style="padding: ${STYLES.spacing.lg};">

    `;

    html += renderCreditEvolutionChart(credits, client.id);
    html += renderMonthlyCreditAnalysis(credits, zeroCreditDates);
    const summaryHTML = renderCreditSummaryDashboard(credits, zeroCreditDates);
    
    
    if (rechargeData.hasData) {
        html += renderRechargeHabits(rechargeData);
    }
    
    const toggleId = `toggle-credit-${client.id}`;
    const detailsId = `credit-details-${client.id}`;
    
    html += `
        <button id="${toggleId}" style="width: 100%; padding: 8px; margin-top: ${STYLES.spacing.md}; background: #f1f5f9; border: 1px solid ${STYLES.colors.borderDark}; border-radius: ${STYLES.borderRadius.sm}; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
            <span style="font-size:14px;">🔽</span> Afficher les détails
        </button>
        
        <div id="${detailsId}" style="display: none; margin-top: ${STYLES.spacing.lg};">
    `;
    
    if (rechargeData.hasData) {
        html += renderRechargeTable(rechargeData);
    }
    
    if (credits.length > 0) {
        html += renderSoldeTable(credits);
    }
    
    html += `
            </div>
        </div>
    </div>`;
    
    container.innerHTML = html;
    // Créer le graphique après le rendu
    requestAnimationFrame(() => {
        initCreditChart();
    });
    
    setTimeout(() => {
        const toggleBtn = document.getElementById(toggleId);
        const detailsDiv = document.getElementById(detailsId);
        if (toggleBtn && detailsDiv) {
            toggleBtn.onclick = () => {
                const isHidden = detailsDiv.style.display === 'none';
                detailsDiv.style.display = isHidden ? 'block' : 'none';
                toggleBtn.innerHTML = isHidden 
                    ? '<span style="font-size:14px;">🔼</span> Masquer les détails'
                    : '<span style="font-size:14px;">🔽</span> Afficher les détails';
            };
        }
    }, 100);
}

function renderStreaksCard(streaksData) {
    if (!streaksData.hasData) {
        return `
            <div style="background: white; border-radius: ${STYLES.borderRadius.md}; margin-bottom: ${STYLES.spacing.md}; overflow: hidden; border: 1px solid ${STYLES.colors.border};">
                <div style="padding: ${STYLES.spacing.sm}; text-align: center; color: ${STYLES.colors.gray}; background: ${STYLES.colors.grayBg}; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 11px;">
                    <span style="font-size: 14px;">🔗</span>
                    <span>Aucune série >1 jour sans crédit</span>
                </div>
            </div>
        `;
    }
    
    const significantStreaks = streaksData.consecutiveDays.filter(group => group.length > 1);
    
    if (significantStreaks.length === 0) {
        return `
            <div style="background: white; border-radius: ${STYLES.borderRadius.md}; margin-bottom: ${STYLES.spacing.md}; overflow: hidden; border: 1px solid ${STYLES.colors.border};">
                <div style="padding: ${STYLES.spacing.sm}; text-align: center; color: ${STYLES.colors.gray}; background: ${STYLES.colors.grayBg}; display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 11px;">
                    <span style="font-size: 14px;">🔗</span>
                    <span>Aucune série >1 jour sans crédit</span>
                </div>
            </div>
        `;
    }
    
    const longestStreak = Math.max(...significantStreaks.map(g => g.length));
    
    const streaksHTML = significantStreaks.map((group, idx) => {
        const isLongest = group.length === longestStreak;
        return `
            <div style="background: white; padding: ${STYLES.spacing.xs} ${STYLES.spacing.sm}; border-radius: ${STYLES.borderRadius.sm}; border-left: 3px solid ${isLongest ? STYLES.colors.danger : '#f97316'}; min-width: 140px; flex: 1 1 auto; border: 1px solid ${STYLES.colors.border}; font-size: 11px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
                    <span style="color: ${STYLES.colors.gray};">#${idx+1}</span>
                    ${isLongest ? '<span style="background: #ef4444; color: white; padding: 1px 6px; border-radius: 10px; font-size: 8px;">MAX</span>' : ''}
                </div>
                <div style="font-weight: 700; color: ${isLongest ? STYLES.colors.danger : '#f97316'}; font-size: 16px;">${group.length} jours</div>
                <div style="color: #475569;">${formatDateShort(group[0].date)} → ${formatDateShort(group[group.length-1].date)}</div>
            </div>
        `;
    }).join('');
    
    return `
        <div style="background: white; border-radius: ${STYLES.borderRadius.md}; margin-bottom: ${STYLES.spacing.md}; overflow: hidden; border: 1px solid ${STYLES.colors.border};">
            <div style="padding: ${STYLES.spacing.md};">
                <div style="display: flex; align-items: center; gap: 5px; margin-bottom: ${STYLES.spacing.sm};">
                    <span style="font-size: 16px;">🔗</span>
                    <span style="font-weight: 600; font-size: 13px;">Séries sans crédit (>1 jour)</span>
                    <span style="margin-left: auto; background: ${STYLES.colors.border}; padding: 2px 8px; border-radius: ${STYLES.borderRadius.md}; font-size: 10px;">${significantStreaks.length}</span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">${streaksHTML}</div>
            </div>
        </div>
    `;
}

function renderRechargeHabits(rechargeData) {
    const totalPurchases = rechargeData.totalRecharges;
    const sortedDays = rechargeData.sortedDays;
    const intervals = rechargeData.intervals;
    
    let mainHabit = { days: 0, count: 0, percentage: 0 };
    sortedDays.forEach(([days, count]) => {
        if (count > mainHabit.count) {
            mainHabit = { days, count, percentage: ((count / totalPurchases) * 100).toFixed(1) };
        }
    });
    
    const intervalList = [
        { name: 'Jours', value: intervals.jours.count, percent: intervals.jours.percent, color: '#f97316', range: '1-6j' },
        { name: 'Semaine', value: intervals.semaine.count, percent: intervals.semaine.percent, color: '#3b82f6', range: '7-28j' },
        { name: 'Mois', value: intervals.mois.count, percent: intervals.mois.percent, color: '#22c55e', range: '>28j' }
    ];
    
    const mainInterval = intervalList.reduce((max, interval) => interval.value > max.value ? interval : max);
    
    const habitBarHTML = sortedDays.map(([days, count]) => {
        const percentage = ((count / totalPurchases) * 100).toFixed(1);
        return `<div style="width: ${percentage}%; height: 100%; background: ${getDaysColor(days)}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white;" title="${days} jours : ${count} recharge(s) (${percentage}%)">${percentage > 8 ? percentage + '%' : ''}</div>`;
    }).join('');
    
    return `
        <div style="margin-top: ${STYLES.spacing.sm};">
            <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 8px;">
                <span style="font-size: 14px;">📈</span>
                <span style="font-weight: 600; font-size: 12px;">Habitude de recharge</span>
            </div>
            <div style="height: 36px; background: #f1f5f9; border-radius: 18px; overflow: hidden; display: flex; margin-bottom: 10px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                ${habitBarHTML}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: ${STYLES.spacing.md}; justify-content: space-around; margin-bottom: 8px;">
                ${intervalList.map(interval => {
                    const isMain = interval.name === mainInterval.name;
                    return `
                        <div style="display: flex; align-items: center; gap: 5px; ${isMain ? `background: #f1f5f9; padding: 3px 10px; border-radius: 20px;` : ''}">
                            <div style="width: 14px; height: 14px; background: ${interval.color}; border-radius: 3px;"></div>
                            <span style="font-size: 11px;"><strong>${interval.name}</strong> ${interval.range}: ${interval.value}x (${interval.percent}%)</span>
                            ${isMain ? '<span style="font-size: 14px;">👑</span>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="background: #f1f5f9; padding: 6px 10px; border-radius: ${STYLES.borderRadius.sm}; font-size: 11px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px;">🏆</span>
                <span><strong>Intervalle principal :</strong> <span style="background: ${mainInterval.color}20; color: ${mainInterval.color}; padding: 2px 12px; border-radius: 20px; font-weight: 700;">${mainInterval.name}</span> (${mainInterval.percent}%, ${mainInterval.range})</span>
            </div>
        </div>
    `;
}

function renderRechargeTable(rechargeData) {
    const sortedData = [...rechargeData.rawData].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return `
        <div style="border: 2px solid ${STYLES.colors.border}; border-radius: ${STYLES.borderRadius.xl}; overflow: hidden; margin-bottom: 20px;">
            <div style="background: ${STYLES.gradients.creditRecharge}; color: white; padding: ${STYLES.spacing.lg} ${STYLES.spacing.xl}; font-size: 16px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                <span style="display: flex; align-items: center; gap: ${STYLES.spacing.sm};">
                    <span style="font-size: 20px;">⚡</span>
                    Historique des recharges
                </span>
                <span style="background: rgba(255,255,255,0.2); padding: 5px ${STYLES.spacing.lg}; border-radius: ${STYLES.borderRadius.full}; font-size: 13px;">${rechargeData.totalRecharges} opération(s)</span>
            </div>
            <div style="max-height: 350px; overflow-y: auto; overflow-x: auto; background: white;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 700px;">
                    <thead style="position: sticky; top: 0; background: ${STYLES.colors.grayBg}; z-index: 10;">
                        <tr style="border-bottom: 2px solid ${STYLES.colors.border};">
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: left;">Date</th>
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">Jours rechargés</th>
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedData.map((row, idx) => {
                            const statusColor = row.status?.toLowerCase().includes('reussie') ? STYLES.colors.success : 
                                               row.status?.toLowerCase().includes('echoue') ? STYLES.colors.danger : STYLES.colors.warning;
                            const bgColor = idx % 2 === 0 ? '#ffffff' : '#fafbfc';
                            return `
                                <tr style="border-bottom: 1px solid ${STYLES.colors.border}; background: ${bgColor};">
                                    <td style="padding: ${STYLES.spacing.sm}; white-space: nowrap;">${formatDateToFrench(row.date)}</td>
                                    <td style="padding: ${STYLES.spacing.sm}; text-align: center; font-weight: 600; color: #f97316;">${row.credit ?? 0}</td>
                                    <td style="padding: ${STYLES.spacing.sm}; text-align: center;"><span style="background: ${statusColor}20; color: ${statusColor}; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 11px;">${row.status || 'Réussie'}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderSoldeTable(credits) {
    const sortedData = [...credits].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return `
        <div style="border: 2px solid ${STYLES.colors.border}; border-radius: ${STYLES.borderRadius.xl}; overflow: hidden;">
            <div style="background: ${STYLES.gradients.solde}; color: white; padding: ${STYLES.spacing.lg} ${STYLES.spacing.xl}; font-size: 16px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                <span style="display: flex; align-items: center; gap: ${STYLES.spacing.sm};">
                    <span style="font-size: 20px;">💰</span>
                    Historique des soldes (crédits)
                </span>
                <span style="background: rgba(255,255,255,0.2); padding: 5px ${STYLES.spacing.lg}; border-radius: ${STYLES.borderRadius.full}; font-size: 13px;">${credits.length} relevé(s)</span>
            </div>
            <div style="max-height: 350px; overflow-y: auto; overflow-x: auto; background: white;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 400px;">
                    <thead style="position: sticky; top: 0; background: ${STYLES.colors.grayBg}; z-index: 10;">
                        <tr style="border-bottom: 2px solid ${STYLES.colors.border};">
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: left;">Date</th>
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">Crédit (jours)</th>
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedData.map((row, idx) => {
                            const value = row.value ?? 0;
                            const bgColor = idx % 2 === 0 ? '#ffffff' : '#fafbfc';
                            return `
                                <tr style="border-bottom: 1px solid ${STYLES.colors.border}; background: ${bgColor};">
                                    <td style="padding: ${STYLES.spacing.sm}; white-space: nowrap;">${formatDateToFrench(row.date)}</td>
                                    <td style="padding: ${STYLES.spacing.sm}; text-align: center; font-weight: 600; color: ${value === 0 ? STYLES.colors.danger : '#48bb78'};">${value}</td>
                                    <td style="padding: ${STYLES.spacing.sm}; text-align: center;">${value === 0 ? '<span style="background: #ef444420; color: #ef4444; padding: 3px 10px; border-radius: 20px; font-size: 11px;">Sans crédit</span>' : '<span style="background: #48bb7820; color: #48bb78; padding: 3px 10px; border-radius: 20px; font-size: 11px;">Crédit disponible</span>'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Exposer la fonction de détail
window.showClientDetail = (clientId) => {
    const detailView = document.getElementById('clientDetailView');
    if (detailView) {
        detailView.style.display = 'block';
        import('./ClientDetail.js').then(module => {
            module.renderClientDetail(clientId);
        });
    }
};

// ===========================================
// GRAPHIQUE ÉVOLUTION DU CRÉDIT (VERSION BARRES AVEC COULEURS PAR MOIS)
// ===========================================

let currentCreditChart = null;
let currentCreditChartClientId = null;

function renderCreditEvolutionChart(credits, clientId) {
    if (!credits || credits.length === 0) {
        return `
            <div style="background: white; border-radius: ${STYLES.borderRadius.md}; margin-bottom: ${STYLES.spacing.md}; padding: ${STYLES.spacing.xl}; text-align: center; color: ${STYLES.colors.gray}; border: 1px solid ${STYLES.colors.border};">
                📊 Aucune donnée de crédit disponible
            </div>
        `;
    }
    
    // Traiter les données : regrouper par date
    const creditByDate = new Map();
    credits.forEach(c => {
        if (c.date) {
            const dateStr = c.date.split('T')[0];
            creditByDate.set(dateStr, c.value ?? 0);
        }
    });
    
    // Convertir en tableau trié
    const sortedData = Array.from(creditByDate.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
    
    // Extraire les années disponibles
    const years = [...new Set(sortedData.map(d => parseInt(d.date.split('-')[0])))].sort((a, b) => b - a);
    const currentYear = years[0];
    
    const chartId = `credit-chart-${clientId}`;
    const filterId = `credit-chart-filter-${clientId}`;
    
    // Générer les options du filtre
    const yearOptions = years.map(year => 
        `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`
    ).join('');
    
    // Stocker les données pour la création différée
    window.__pendingCreditChart = {
        chartId: chartId,
        filterId: filterId,
        allData: sortedData,
        years: years,
        clientId: clientId
    };
    
    return `
        <div style="background: white; border-radius: ${STYLES.borderRadius.md}; margin-bottom: ${STYLES.spacing.md}; overflow: hidden; border: 1px solid ${STYLES.colors.border};">
            <div style="padding: ${STYLES.spacing.md};">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${STYLES.spacing.lg}; flex-wrap: wrap; gap: ${STYLES.spacing.sm};">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px;">📊</span>
                        <span style="font-weight: 600; font-size: 13px;">Évolution du crédit (jours) - Graphique à barres</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 12px; color: ${STYLES.colors.gray};">Année :</label>
                        <select id="${filterId}" style="padding: 4px 8px; border-radius: ${STYLES.borderRadius.sm}; border: 1px solid ${STYLES.colors.border}; font-size: 12px; background: white; cursor: pointer;">
                            ${yearOptions}
                        </select>
                    </div>
                </div>
                <div style="position: relative; width: 100%; height: 300px; min-height: 300px;">
                    <canvas id="${chartId}" style="width: 100%; height: 100%;"></canvas>
                </div>
            </div>
        </div>
    `;
}

function initCreditChart() {
    if (!window.__pendingCreditChart) return;
    
    const { chartId, filterId, allData, clientId } = window.__pendingCreditChart;
    const canvas = document.getElementById(chartId);
    const filterSelect = document.getElementById(filterId);
    const container = canvas?.parentElement;
    
    if (!canvas || !container) {
        setTimeout(initCreditChart, 50);
        return;
    }
    
    // FORCER les dimensions du conteneur et du canvas
    const rect = container.getBoundingClientRect();
    const width = rect.width || 600;
    const height = 300;
    
    canvas.style.width = '100%';
    canvas.style.height = '300px';
    canvas.width = width;
    canvas.height = height;
    
    // Palette de couleurs pour les mois (dégradé du violet au rose)
    const monthColors = {
        1: '#8b5cf6',  // Janvier - Violet
        2: '#FF0000',  // Février - Violet clair
        3: '#008000',  // Mars - Lavande
        4: '#0000FF',  // Avril - Rose violet
        5: '#f472b6',  // Mai - Rose
        6: '#fb7185',  // Juin - Rose saumon
        7: '#FF8C00',  // Juillet - Orange
        8: '#FF00FF',  // Août - Jaune orange
        9: '#00CED1',  // Septembre - Jaune
        10: '#8B4513', // Octobre - Vert lime
        11: '#808080', // Novembre - Vert
        12: '#FFD700'  // Décembre - Cyan
    };
    
    function getMonthColor(month) {
        return monthColors[month] || '#9f7aea';
    }
    
    function filterDataByYear(year) {
        return allData.filter(d => parseInt(d.date.split('-')[0]) === year);
    }
    
    function formatDateLabel(dateStr) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}`;
    }
    
    function getMonthFromDate(dateStr) {
        return parseInt(dateStr.split('-')[1]);
    }
    
    // Générer un tableau de couleurs basé sur les mois des données
    function generateBackgroundColors(data) {
        return data.map(d => {
            const month = getMonthFromDate(d.date);
            const color = getMonthColor(month);
            return color + '80'; // 50% d'opacité (hex 80 = 128/255)
        });
    }
    
    function generateBorderColors(data) {
        return data.map(d => {
            const month = getMonthFromDate(d.date);
            return getMonthColor(month);
        });
    }
    
    function renderChart(year) {
        const filtered = filterDataByYear(year);
        if (filtered.length === 0) return;
        
        const labels = filtered.map(d => formatDateLabel(d.date));
        const values = filtered.map(d => d.value);
        const backgroundColors = generateBackgroundColors(filtered);
        const borderColors = generateBorderColors(filtered);
        
        const maxValue = Math.max(...values, 1);
        const yMax = Math.ceil(maxValue * 1.1);
        
        if (currentCreditChart && currentCreditChartClientId === clientId) {
            currentCreditChart.destroy();
        }
        
        currentCreditChart = new Chart(canvas, {
            type: 'bar',  // ← CHANGEMENT ICI : bar au lieu de line
            data: {
                labels: labels,
                datasets: [{
                    label: 'Crédit (jours)',
                    data: values,
                    backgroundColor: backgroundColors,  // Couleurs différentes par mois
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 6,  // Coins arrondis pour les barres
                    barPercentage: 0.7,  // Largeur des barres
                    categoryPercentage: 0.8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            font: { size: 11 },
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `💰 ${context.raw} jour(s)`;
                            },
                            title: function(context) {
                                const index = context[0].dataIndex;
                                const dateStr = filtered[index].date;
                                const [year, month, day] = dateStr.split('-');
                                const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                                return `${day} ${monthNames[parseInt(month)-1]} ${year}`;
                            },
                            afterTitle: function(context) {
                                const index = context[0].dataIndex;
                                const month = getMonthFromDate(filtered[index].date);
                                const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                                return `📅 ${monthNames[month-1]}`;
                            }
                        },
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: yMax,
                        title: {
                            display: true,
                            text: 'Jours de crédit',
                            font: { size: 11 },
                            color: '#64748b'
                        },
                        ticks: {
                            stepSize: Math.ceil(yMax / 5),
                            callback: function(value) {
                                return value + 'j';
                            },
                            font: { size: 10 }
                        },
                        grid: {
                            color: '#e9ecef'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date (jj/mm)',
                            font: { size: 11 },
                            color: '#64748b'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 8,
                            font: { size: 9 }
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                }
            }
        });
        
        currentCreditChartClientId = clientId;
    }
    
    const initialYear = parseInt(filterSelect?.value || allData[0]?.date.split('-')[0]);
    renderChart(initialYear);
    
    if (filterSelect) {
        // Supprimer l'ancien listener pour éviter les doublons
        const newFilter = filterSelect.cloneNode(true);
        filterSelect.parentNode.replaceChild(newFilter, filterSelect);
        
        newFilter.addEventListener('change', function() {
            renderChart(parseInt(this.value));
        });
    }
}

function destroyCreditChart() {
    if (currentCreditChart) {
        currentCreditChart.destroy();
        currentCreditChart = null;
        currentCreditChartClientId = null;
    }
    window.__pendingCreditChart = null;
}


// ===========================================
// ANALYSE MENSUELLE DU CRÉDIT
// ===========================================

function renderMonthlyCreditAnalysis(credits, zeroCreditDates) {
    if (!credits || credits.length === 0) {
        return `
            <div style="background: white; border-radius: ${STYLES.borderRadius.md}; margin-bottom: ${STYLES.spacing.md}; overflow: hidden; border: 1px solid ${STYLES.colors.border};">
                <div style="padding: ${STYLES.spacing.md}; text-align: center; color: ${STYLES.colors.gray};">
                    <span style="font-size: 14px;">📊</span>
                    <span>Aucune donnée de crédit disponible pour l'analyse mensuelle</span>
                </div>
            </div>
        `;
    }
    
    // 1. Construire un Map jour par jour avec les valeurs de crédit
    const creditByDate = new Map();
    
    credits.forEach(c => {
        if (c.date) {
            const dateStr = c.date.split('T')[0];
            creditByDate.set(dateStr, c.value ?? 0);
        }
    });
    
    // Ajouter les jours sans crédit (valeur 0)
    zeroCreditDates.forEach(date => {
        const dateStr = date.split('T')[0];
        creditByDate.set(dateStr, 0);
    });
    
    // 2. Grouper par mois et analyser
    const monthlyData = new Map();
    
    creditByDate.forEach((value, dateStr) => {
        const [year, month, day] = dateStr.split('-');
        const monthKey = `${year}-${month}`;
        
        if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, {
                year: parseInt(year),
                month: parseInt(month),
                days: [],
                totalDays: 0,
                zeroDays: 0,
                maxCredit: 0,
                sumCredit: 0
            });
        }
        
        const monthData = monthlyData.get(monthKey);
        monthData.days.push({ date: dateStr, value });
        monthData.totalDays++;
        
        if (value === 0) {
            monthData.zeroDays++;
        }
        
        if (value > monthData.maxCredit) {
            monthData.maxCredit = value;
        }
        
        monthData.sumCredit += value;
    });
    
    // 3. Calculer les stats par mois et trier par date décroissante
    const sortedMonths = Array.from(monthlyData.values())
        .map(month => {
            const avgCredit = month.sumCredit / month.totalDays;
            const percentZeroDays = (month.zeroDays / month.totalDays) * 100;
            const availabilityRate = 100 - percentZeroDays;
            
            return {
                ...month,
                avgCredit: avgCredit,
                percentZeroDays: percentZeroDays,
                availabilityRate: availabilityRate
            };
        })
        .sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });
    
    if (sortedMonths.length === 0) {
        return `
            <div style="background: white; border-radius: ${STYLES.borderRadius.md}; margin-bottom: ${STYLES.spacing.md}; overflow: hidden; border: 1px solid ${STYLES.colors.border};">
                <div style="padding: ${STYLES.spacing.md}; text-align: center; color: ${STYLES.colors.gray};">
                    <span>⚠️ Aucune donnée mensuelle disponible</span>
                </div>
            </div>
        `;
    }
    
    // 4. Fonction pour obtenir l'icône et la couleur selon le taux de disponibilité
    function getAvailabilityStatus(rate, zeroPercent) {
        if (zeroPercent === 0) {
            return { icon: '✅', color: '#22c55e', bgOpacity: '20', label: 'Parfait' };
        } else if (rate >= 95) {
            return { icon: '🟢', color: '#22c55e', bgOpacity: '20', label: 'Excellent' };
        } else if (rate >= 80) {
            return { icon: '⚠️', color: '#f59e0b', bgOpacity: '20', label: 'Attention' };
        } else {
            return { icon: '🔴', color: '#ef4444', bgOpacity: '20', label: 'Critique' };
        }
    }
    
    // 5. Générer le HTML du tableau
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    
    const rowsHTML = sortedMonths.map(month => {
        const monthName = monthNames[month.month - 1];
        const percentZeroDays = month.percentZeroDays.toFixed(1);
        const availabilityRate = month.availabilityRate.toFixed(1);
        const status = getAvailabilityStatus(month.availabilityRate, month.zeroDays);
        
        return `
            <tr style="border-bottom: 1px solid ${STYLES.colors.border};">
                <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; font-weight: 600;">
                    ${monthName} ${month.year}
                </td>
                <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">
                    ${month.totalDays}
                    <span style="font-size: 10px; color: ${STYLES.colors.gray};"> (100%)</span>
                </td>
                <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">
                    ${month.zeroDays}
                    <span style="font-size: 10px; color: ${STYLES.colors.gray};"> (${percentZeroDays}%)</span>
                </td>
                <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">
                    <span style="display: inline-flex; align-items: center; gap: 6px; background: ${status.color}${status.bgOpacity}; color: ${status.color}; font-weight: 600; padding: 4px 10px; border-radius: 20px; font-size: 12px;">
                        ${status.icon} ${availabilityRate}%
                    </span>
                </td>
                <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center; font-weight: 600; color: ${STYLES.colors.primary};">
                    ${month.maxCredit}
                </td>
                <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">
                    ${month.avgCredit.toFixed(1)}
                </td>
            </tr>
        `;
    }).join('');
    
    // Calcul des totaux généraux
    const totalDays = sortedMonths.reduce((sum, m) => sum + m.totalDays, 0);
    const totalZeroDays = sortedMonths.reduce((sum, m) => sum + m.zeroDays, 0);
    const totalAvailabilityRate = totalDays > 0 ? ((totalDays - totalZeroDays) / totalDays * 100).toFixed(1) : 0;
    const totalZeroPercent = totalDays > 0 ? (totalZeroDays / totalDays * 100).toFixed(1) : 0;
    const overallMaxCredit = Math.max(...sortedMonths.map(m => m.maxCredit), 0);
    const overallAvgCredit = sortedMonths.reduce((sum, m) => sum + (m.avgCredit * m.totalDays), 0) / totalDays;
    const totalStatus = getAvailabilityStatus(parseFloat(totalAvailabilityRate), totalZeroDays);
    
    return `
        <div style="background: white; border-radius: ${STYLES.borderRadius.md}; margin-bottom: ${STYLES.spacing.md}; overflow: hidden; border: 1px solid ${STYLES.colors.border};">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: ${STYLES.spacing.sm} ${STYLES.spacing.lg};">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">📅</span>
                    <span style="font-weight: 600; font-size: 14px;">Analyse mensuelle du crédit</span>
                </div>
            </div>
            
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; min-width: 700px;">
                    <thead style="background: ${STYLES.colors.grayBg}; border-bottom: 2px solid ${STYLES.colors.border};">
                        <tr>
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: left;">Mois</th>
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">Jours analysés</th>
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">Jours sans crédit</th>
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">Taux de disponibilité</th>
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">Crédit max</th>
                            <th style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">Crédit moyen</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                    <tfoot style="background: ${STYLES.colors.grayBg}; border-top: 2px solid ${STYLES.colors.border}; font-weight: 600;">
                        <tr>
                            <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: left;">📊 TOTAL</td>
                            <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">${totalDays}</td>
                            <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">${totalZeroDays} <span style="font-size: 10px; color: ${STYLES.colors.gray};"> (${totalZeroPercent}%)</span></td>
                            <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">
                                <span style="display: inline-flex; align-items: center; gap: 6px; background: ${totalStatus.color}${totalStatus.bgOpacity}; color: ${totalStatus.color}; font-weight: 600; padding: 4px 10px; border-radius: 20px; font-size: 12px;">
                                    ${totalStatus.icon} ${totalAvailabilityRate}%
                                </span>
                            </td>
                            <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center; color: ${STYLES.colors.primary};">${overallMaxCredit}</td>
                            <td style="padding: ${STYLES.spacing.md} ${STYLES.spacing.sm}; text-align: center;">${overallAvgCredit.toFixed(1)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div style="padding: ${STYLES.spacing.sm} ${STYLES.spacing.lg}; background: ${STYLES.colors.grayBg}; font-size: 11px; color: ${STYLES.colors.gray}; border-top: 1px solid ${STYLES.colors.border}; display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">
                <span><span style="color: #22c55e;">✅</span> 0% sans crédit</span>
                <span><span style="color: #f59e0b;">⚠️</span> 1-20% sans crédit</span>
                <span><span style="color: #ef4444;">🔴</span> >20% sans crédit</span>
            </div>
        </div>
    `;
}
// ===========================================
// TABLEAU DE BORD RÉCAPITULATIF CRÉDIT
// ===========================================

function renderCreditSummaryDashboard(credits, zeroCreditDates) {
    if (!credits || credits.length === 0) {
        return null;
    }
    
    // 1. Construire le Map jour par jour
    const creditByDate = new Map();
    
    credits.forEach(c => {
        if (c.date) {
            const dateStr = c.date.split('T')[0];
            creditByDate.set(dateStr, c.value ?? 0);
        }
    });
    
    zeroCreditDates.forEach(date => {
        const dateStr = date.split('T')[0];
        creditByDate.set(dateStr, 0);
    });
    
    // 2. Trier les dates
    const sortedDates = Array.from(creditByDate.keys()).sort();
    
    if (sortedDates.length === 0) return null;
    
    const firstDate = sortedDates[0];
    const lastDate = sortedDates[sortedDates.length - 1];
    const totalDays = sortedDates.length;
    
    // 3. Compter les jours sans crédit
    let zeroCreditDays = 0;
    creditByDate.forEach(value => {
        if (value === 0) zeroCreditDays++;
    });
    
    // 4. Calculer la disponibilité moyenne (tous les jours)
    let totalCredit = 0;
    creditByDate.forEach(value => {
        totalCredit += value;
    });
    const avgCredit = totalCredit / totalDays;
    
    // 5. Calculer le taux de disponibilité (jours avec crédit > 0)
    const daysWithCredit = totalDays - zeroCreditDays;
    const availabilityRate = (daysWithCredit / totalDays) * 100;
    
    // 6. Formater la période
    const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };
    
    // 7. Déterminer la couleur et l'icône selon le taux
    let availabilityIcon = '✅';
    let availabilityColor = STYLES.colors.success;
    if (zeroCreditDays === 0) {
        availabilityIcon = '✅';
        availabilityColor = '#22c55e';
    } else if (availabilityRate >= 95) {
        availabilityIcon = '🟢';
        availabilityColor = '#22c55e';
    } else if (availabilityRate >= 80) {
        availabilityIcon = '⚠️';
        availabilityColor = '#f59e0b';
    } else {
        availabilityIcon = '🔴';
        availabilityColor = '#ef4444';
    }
    
    return `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: ${STYLES.spacing.md}; margin-bottom: ${STYLES.spacing.lg};">
            <!-- Carte 1 : Période observée -->
            <div style="background: white; border-radius: ${STYLES.borderRadius.md}; padding: ${STYLES.spacing.lg}; border: 1px solid ${STYLES.colors.border}; text-align: center;">
                <div style="font-size: 28px; margin-bottom: 8px;">📅</div>
                <div style="font-size: 12px; color: ${STYLES.colors.gray}; margin-bottom: 4px;">Période observée</div>
                <div style="font-size: 14px; font-weight: 600; color: ${STYLES.colors.textDark};">${formatDate(firstDate)} → ${formatDate(lastDate)}</div>
                <div style="font-size: 11px; color: ${STYLES.colors.gray}; margin-top: 4px;">${totalDays} jours</div>
            </div>
            
            <!-- Carte 2 : Disponibilité crédit -->
            <div style="background: white; border-radius: ${STYLES.borderRadius.md}; padding: ${STYLES.spacing.lg}; border: 1px solid ${STYLES.colors.border}; text-align: center;">
                <div style="font-size: 28px; margin-bottom: 8px;">${availabilityIcon}</div>
                <div style="font-size: 12px; color: ${STYLES.colors.gray}; margin-bottom: 4px;">Disponibilité crédit</div>
                <div style="font-size: 24px; font-weight: 700; color: ${availabilityColor};">${availabilityRate.toFixed(1)}%</div>
                <div style="font-size: 11px; color: ${STYLES.colors.gray}; margin-top: 4px;">${daysWithCredit} jours avec crédit</div>
            </div>
            
            <!-- Carte 3 : Jours sans crédit -->
            <div style="background: white; border-radius: ${STYLES.borderRadius.md}; padding: ${STYLES.spacing.lg}; border: 1px solid ${STYLES.colors.border}; text-align: center;">
                <div style="font-size: 28px; margin-bottom: 8px;">⚠️</div>
                <div style="font-size: 12px; color: ${STYLES.colors.gray}; margin-bottom: 4px;">Jours sans crédit</div>
                <div style="font-size: 24px; font-weight: 700; color: ${zeroCreditDays > 0 ? STYLES.colors.danger : STYLES.colors.success};">${zeroCreditDays}</div>
                <div style="font-size: 11px; color: ${STYLES.colors.gray}; margin-top: 4px;">${((zeroCreditDays / totalDays) * 100).toFixed(1)}% du total</div>
            </div>
            
            <!-- Carte 4 : Moyenne du crédit -->
            <div style="background: white; border-radius: ${STYLES.borderRadius.md}; padding: ${STYLES.spacing.lg}; border: 1px solid ${STYLES.colors.border}; text-align: center;">
                <div style="font-size: 28px; margin-bottom: 8px;">💰</div>
                <div style="font-size: 12px; color: ${STYLES.colors.gray}; margin-bottom: 4px;">Crédit moyen</div>
                <div style="font-size: 24px; font-weight: 700; color: ${STYLES.colors.primary};">${avgCredit.toFixed(1)}</div>
                <div style="font-size: 11px; color: ${STYLES.colors.gray}; margin-top: 4px;">jours disponibles</div>
            </div>
        </div>
    `;
}