// arduinoRender.js - VERSION CORRIGÉE
import { database } from './arduinoCore.js';
import { TABLE_TYPES } from './arduinoConstants.js';
import { getEventColor, handleCellClick } from './arduinoEvents.js';
import { generatePagination, attachPaginationEvents } from './arduinoPagination.js';
import { renderTechnicalDashboard } from './dashboards/technical/TechnicalDashboard.js';  
import { renderCommercialDashboard } from './dashboards/commercial/CommercialDashboard.js'; 
import { renderEventDashboard } from './dashboards/eventDashboard.js';
import { FORFAIT_NAMES } from './arduinoConstants.js';

// Variable globale pour suivre l'état d'affichage
window.tablesVisible = false;

// Fonction pour afficher/masquer les tableaux
window.toggleTablesContainer = function() {
    const container = document.getElementById('tablesContainer');
    const buttons = document.querySelectorAll('.toggle-tables-btn');
    
    window.tablesVisible = !window.tablesVisible;
    
    if (window.tablesVisible) {
        container.style.display = 'block';
        buttons.forEach(btn => {
            btn.innerHTML = '📋 Masquer les tableaux détaillés';
        });
    } else {
        container.style.display = 'none';
        buttons.forEach(btn => {
            btn.innerHTML = '📋 Afficher les tableaux détaillés';
        });
    }
};

export function renderByTab() {
    console.log("🟢 renderByTab() appelée");
    
    const currentTab = document.querySelector('.tab.active')?.dataset.tab || 'Technique';
    console.log("📌 Onglet actif:", currentTab);
    
    const visibleTableIndices = [];
    
    console.log("📊 database.tables:", database.tables?.length || 0, "tables trouvées");
    
    database.tables.forEach((table, idx) => {
        const tableTab = TABLE_TYPES[table.type]?.tab;
        console.log(`   Table ${idx}: type=${table.type}, tab=${tableTab}, correspond à ${currentTab}?`, tableTab === currentTab);
        
        if (TABLE_TYPES[table.type] && TABLE_TYPES[table.type].tab === currentTab) {
            visibleTableIndices.push(idx);
            console.log(`   ✅ Ajoutée à visibleTableIndices`);
        }
    });
    
    console.log("📋 visibleTableIndices final:", visibleTableIndices);

    // Vider les dashboards
    console.log("🧹 Vidage des dashboards...");
    document.getElementById('technicalDashboard').innerHTML = '';
    document.getElementById('commercialDashboard').innerHTML = '';
    const eventDashboard = document.getElementById('eventDashboard');
    if (eventDashboard) eventDashboard.innerHTML = '';

    // Rendre les dashboards
    console.log("🎨 Rendu du dashboard pour:", currentTab);
    if (currentTab === 'Technique') {
        console.log("   → Appel de renderTechnicalDashboard()");
        renderTechnicalDashboard();
    } else if (currentTab === 'Commercial') {
        console.log("   → Appel de renderCommercialDashboard()");
        renderCommercialDashboard();
    } else if (currentTab === 'Evenement') {
        console.log("   → Appel de renderEventDashboard()");
        renderEventDashboard();
    }
    
    // Afficher les tableaux avec délai
    console.log("⏳ Attente 100ms avant displayTables...");
    setTimeout(() => {
        console.log("🔄 Appel de displayTables avec:", visibleTableIndices);
        displayTables(visibleTableIndices);
        
        // Initialiser l'état des boutons
        const container = document.getElementById('tablesContainer');
        const buttons = document.querySelectorAll('.toggle-tables-btn');
        
        if (container) {
            // Par défaut, les tableaux sont masqués
            container.style.display = 'none';
            window.tablesVisible = false;
        }
        
        // Mettre à jour le texte des boutons s'ils existent
        buttons.forEach(btn => {
            btn.innerHTML = '📋 Afficher les tableaux détaillés';
        });
        
        console.log("✅ renderByTab() terminé");
    }, 100);
}

export function displayTables(visibleTableIndices) {
    console.log("🔍 displayTables() appelée avec indices:", visibleTableIndices);
    console.log("   database.pages:", database.pages?.length || 0);
    
    const container = document.getElementById('tablesContainer');
    console.log("   container trouvé?", !!container);
    if (!container) return;
    
    let html = '';

    visibleTableIndices.forEach(tableIdx => {
        const table = database.tables[tableIdx];
        const currentPageNum = database.currentPages[tableIdx] || 1;
        const info = TABLE_TYPES[table.type] || { name: table.type, icon: '📋' };
        const page = database.pages.find(p => p.tableIndex === tableIdx && p.pageNumber === currentPageNum);
        if (!page) return;

        const allHeaders = page.header.split(';').filter(h => h.trim() !== '');
        const headers = allHeaders.slice(1);
        
        // Identifier les colonnes clients pour les tables I et S
        const clientColumns = [];
        headers.forEach((header, index) => {
            const match = header.match(/Client (\d+)/i);
            if (match) clientColumns.push({ index, clientId: match[1], headerName: header });
        });

        // Identifier la colonne Forfait pour la table R
        const forfaitColumnIndex = headers.findIndex(h => h.toLowerCase().includes('forfait'));

        const headerHTML = '<table>\n<thead>\n<tr>\n' + headers.map(h => `<th>${h.trim()}</th>`).join('\n') + '\n</tr>\n</thead>\n';
        let bodyHTML = '<tbody>\n';

        page.rows.forEach(row => {
            const timestamp = row.cells[1];
            const date = timestamp.split(' ')[0];
            const cellsWithoutFirst = row.cells.slice(1);

            bodyHTML += '<tr>\n';
            cellsWithoutFirst.forEach((cell, cellIndex) => {
                const originalValue = cell.trim();
                const clientColumn = clientColumns.find(c => c.index === cellIndex);
                
                // Cas spécial : table de type R avec colonne Forfait
                if (table.type === 'R' && cellIndex === forfaitColumnIndex) {
                    const forfaitId = parseInt(originalValue);
                    const forfaitName = FORFAIT_NAMES[forfaitId] || `Forfait ${forfaitId}`;
                    bodyHTML += `<td><span class="forfait-badge">${forfaitName}</span></td>\n`;
                }
                // Cas tables I et S avec événements
                else if (clientColumn && (table.type === 'I' || table.type === 'S')) {
                    const key = `${date}_${clientColumn.clientId}`;
                    const event = database.eventMap.get(key);
                    const cellKey = `${table.id}_${clientColumn.clientId}_${timestamp}`;
                    const currentState = database.cellStateMap.get(cellKey) || 0;

                    if (event) {
                        let displayText = originalValue;
                        let className = 'cell-value';
                        switch (currentState) {
                            case 0: displayText = originalValue; className += ' cell-mode-value'; break;
                            case 1: displayText = event.type; className += ` cell-mode-event event-${event.type.replace(' ', '-')}`; break;
                            case 2: displayText = `${event.nbDep} dép.`; className += ' cell-mode-nbdep'; break;
                        }
                        bodyHTML += `<td class="event-cell">
                            <span onclick="window.handleCellClick('${table.id}', '${clientColumn.clientId}', '${timestamp}', this, '${originalValue}')" 
                                  class="${className}">${displayText}</span>
                            <span class="event-indicator" style="background:${getEventColor(event.type)};"></span>
                         </td>\n`;
                    } else {
                        bodyHTML += `<td>${originalValue}</td>\n`;
                    }
                } else {
                    bodyHTML += `<td>${originalValue}</td>\n`;
                }
            });
            bodyHTML += '</tr>\n';
        });
        
        bodyHTML += '</tbody>\n</table>';

        const paginationHTML = generatePagination(tableIdx, page);
        html += `
            <div class="table-block" data-table-id="${table.id}" data-table-index="${tableIdx}">
                <div class="table-header">
                    <div class="table-title">${info.icon} ${info.name} (Type ${table.type})</div>
                    <div class="table-badge">
                        ${page.totalRows} enregistrement(s) - Page ${currentPageNum}/${page.totalPages} - Lignes ${page.startRow} à ${page.endRow}
                    </div>
                </div>
                <div class="table-wrapper">
                    ${headerHTML}
                    ${bodyHTML}
                </div>
                ${paginationHTML}
            </div>`;
    });

    container.innerHTML = html;
    container.classList.add('show');
    attachPaginationEvents(renderByTab);
    console.log("✅ displayTables() terminé");
}