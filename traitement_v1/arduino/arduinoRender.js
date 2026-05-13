// arduinoRender.js - VERSION AVEC STYLES TABLEAUX UNIQUEMENT
import { database } from './arduinoCore.js';
import { TABLE_TYPES } from './arduinoConstants.js';
import { getEventColor, handleCellClick } from './arduinoEvents.js';
import { generatePagination, attachPaginationEvents } from './arduinoPagination.js';
import { renderTechnicalDashboard } from './dashboards/technical/TechnicalDashboard.js';  
import { renderCommercialDashboard } from './dashboards/commercial/CommercialDashboard.js'; 
import { renderEventDashboard } from './dashboards/eventDashboard.js';
import { FORFAIT_NAMES } from './arduinoConstants.js';

// Injection des styles pour les tableaux uniquement
const injectTableStyles = () => {
    const styleId = 'arduino-table-styles';
    if (document.getElementById(styleId)) return;
    
    const styles = `
        /* ========== STYLES DES TABLEAUX ========== */
        
        /* Conteneur principal des tableaux */
        #tablesContainer {
            background: transparent;
            margin-top: 20px;
        }
        
        /* Bloc individuel de tableau */
        .table-block {
            background: white;
            border-radius: 16px;
            margin-bottom: 30px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            border: 1px solid rgba(102, 126, 234, 0.1);
        }
        
        /* En-tête du tableau */
        .table-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            border-bottom: 3px solid rgba(255, 255, 255, 0.2);
        }
        
        .table-title {
            font-size: 18px;
            font-weight: 700;
            color: white;
            display: flex;
            align-items: center;
            gap: 10px;
            letter-spacing: -0.3px;
        }
        
        .table-title::before {
            content: '📊';
            font-size: 20px;
        }
        
        .table-badge {
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            padding: 6px 14px;
            border-radius: 40px;
            font-size: 12px;
            font-weight: 600;
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        /* Wrapper du tableau avec scroll horizontal */
        .table-wrapper {
            overflow-x: auto;
            overflow-y: visible;
            margin: 0;
            background: white;
        }
        
        /* Style du tableau */
        .table-wrapper table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            min-width: 600px;
        }
        
        /* En-tête du tableau */
        .table-wrapper thead tr {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-bottom: 2px solid #e2e8f0;
        }
        
        .table-wrapper th {
            padding: 14px 12px;
            text-align: left;
            font-weight: 700;
            color: #1e293b;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e2e8f0;
            background: #f8fafc;
        }
        
        .table-wrapper th:first-child {
            padding-left: 20px;
        }
        
        .table-wrapper th:last-child {
            padding-right: 20px;
        }
        
        /* Corps du tableau */
        .table-wrapper tbody tr {
            border-bottom: 1px solid #f1f5f9;
        }
        
        .table-wrapper tbody tr:hover {
            background: linear-gradient(90deg, #fefce8 0%, #fef9c3 100%);
        }
        
        .table-wrapper td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
            font-size: 13px;
            vertical-align: middle;
        }
        
        .table-wrapper td:first-child {
            padding-left: 20px;
            font-weight: 600;
            color: #1e293b;
        }
        
        .table-wrapper td:last-child {
            padding-right: 20px;
        }
        
        /* Style des cellules d'événements */
        .event-cell {
            position: relative;
            cursor: pointer;
        }
        
        .cell-value {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            cursor: pointer;
        }
        
        .cell-value:hover {
            background: rgba(102, 126, 234, 0.1);
        }
        
        .cell-mode-event {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 12px;
            display: inline-block;
        }
        
        .cell-mode-nbdep {
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
            color: #1e293b;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 12px;
            display: inline-block;
        }
        
        /* Indicateur d'événement */
        .event-indicator {
            position: absolute;
            top: 50%;
            right: 8px;
            transform: translateY(-50%);
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        
        /* Badges forfait */
        .forfait-badge {
            background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            display: inline-block;
            letter-spacing: 0.5px;
        }
        
        .forfait-badge[data-forfait="2"] {
            background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
            color: #1e293b;
        }
        
        .forfait-badge[data-forfait="3"] {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }
        
        /* Pagination */
        .pagination-container {
            background: #f8fafc;
            padding: 16px 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 12px;
            border-top: 1px solid #e2e8f0;
        }
        
        .pagination-btn {
            background: white;
            border: 1px solid #e2e8f0;
            padding: 8px 14px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            color: #475569;
            font-size: 13px;
        }
        
        .pagination-btn:hover:not(:disabled) {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-color: transparent;
        }
        
        .pagination-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        
        .page-numbers {
            display: flex;
            gap: 6px;
            align-items: center;
        }
        
        .page-number {
            background: white;
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            color: #475569;
            min-width: 36px;
            text-align: center;
        }
        
        .page-number:hover:not(.active) {
            background: #f1f5f9;
            border-color: #cbd5e1;
        }
        
        .page-number.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-color: transparent;
        }
        
        .page-ellipsis {
            padding: 8px 4px;
            color: #94a3b8;
            font-weight: 500;
        }
        
        /* Scrollbar */
        .table-wrapper::-webkit-scrollbar {
            height: 8px;
        }
        
        .table-wrapper::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 10px;
        }
        
        .table-wrapper::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .table-header {
                flex-direction: column;
                align-items: flex-start;
                padding: 16px;
            }
            
            .table-title {
                font-size: 16px;
            }
            
            .table-badge {
                font-size: 11px;
            }
            
            .table-wrapper th,
            .table-wrapper td {
                padding: 10px 8px;
                font-size: 11px;
            }
            
            .pagination-container {
                flex-wrap: wrap;
                padding: 12px;
            }
            
            .page-numbers {
                order: 3;
                width: 100%;
                justify-content: center;
                margin-top: 8px;
            }
        }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
};

// Variable globale pour suivre l'état d'affichage
window.tablesVisible = false;
let toggleButton = null;

// Fonction pour afficher/masquer les tableaux
window.toggleTablesContainer = function() {
    const container = document.getElementById('tablesContainer');
    
    window.tablesVisible = !window.tablesVisible;
    
    if (window.tablesVisible) {
        container.style.display = 'block';
        if (toggleButton) toggleButton.innerHTML = '📋 Masquer les tableaux détaillés';
    } else {
        container.style.display = 'none';
        if (toggleButton) toggleButton.innerHTML = '📋 Afficher les tableaux détaillés';
    }
};

// Fonction pour créer ou mettre à jour le bouton
function updateToggleButton() {
    const container = document.getElementById('toggleButtonContainer');
    if (!container) return;
    
    if (toggleButton && toggleButton.parentNode) {
        toggleButton.remove();
    }
    
    toggleButton = document.createElement('button');
    toggleButton.className = 'toggle-tables-btn';
    toggleButton.innerHTML = window.tablesVisible ? '📋 Masquer les tableaux détaillés' : '📋 Afficher les tableaux détaillés';
    toggleButton.onclick = window.toggleTablesContainer;
    
    container.appendChild(toggleButton);
}

export function renderByTab() {
    console.log("🟢 renderByTab() appelée");
    
    injectTableStyles();
    
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

    document.getElementById('technicalDashboard').innerHTML = '';
    document.getElementById('commercialDashboard').innerHTML = '';
    const eventDashboard = document.getElementById('eventDashboard');
    if (eventDashboard) eventDashboard.innerHTML = '';

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
    
    updateToggleButton();
    
    console.log("⏳ Attente 100ms avant displayTables...");
    setTimeout(() => {
        console.log("🔄 Appel de displayTables avec:", visibleTableIndices);
        displayTables(visibleTableIndices);
        
        const container = document.getElementById('tablesContainer');
        if (container) {
            container.style.display = 'none';
            window.tablesVisible = false;
            if (toggleButton) toggleButton.innerHTML = '📋 Afficher les tableaux détaillés';
        }
        
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
        
        const clientColumns = [];
        headers.forEach((header, index) => {
            const match = header.match(/Client (\d+)/i);
            if (match) clientColumns.push({ index, clientId: match[1], headerName: header });
        });

        const forfaitColumnIndex = headers.findIndex(h => h.toLowerCase().includes('forfait'));

        const headerHTML = '<thead>\n<tr>\n' + headers.map(h => `<th>${h.trim()}</th>`).join('\n') + '\n</tr>\n</thead>\n';
        let bodyHTML = '<tbody>\n';

        page.rows.forEach(row => {
            const timestamp = row.cells[1];
            const date = timestamp.split(' ')[0];
            const cellsWithoutFirst = row.cells.slice(1);

            bodyHTML += '<tr>\n';
            cellsWithoutFirst.forEach((cell, cellIndex) => {
                const originalValue = cell.trim();
                const clientColumn = clientColumns.find(c => c.index === cellIndex);
                
                if (table.type === 'R' && cellIndex === forfaitColumnIndex) {
                    const forfaitId = parseInt(originalValue);
                    const forfaitName = FORFAIT_NAMES[forfaitId] || `Forfait ${forfaitId}`;
                    bodyHTML += `<td><span class="forfait-badge" data-forfait="${forfaitId}">${forfaitName}</span></td>\n`;
                }
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
        
        bodyHTML += '</tbody>\n';

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
                    <table>
                        ${headerHTML}
                        ${bodyHTML}
                    </table>
                </div>
                ${paginationHTML}
            </div>`;
    });

    container.innerHTML = html;
    container.classList.add('show');
    attachPaginationEvents(renderByTab);
    console.log("✅ displayTables() terminé");
}