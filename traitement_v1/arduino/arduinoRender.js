// arduinoRender.js
import { database } from './arduinoCore.js';
import { TABLE_TYPES } from './arduinoConstants.js';
import { getEventColor, handleCellClick } from './arduinoEvents.js';
import { generatePagination, attachPaginationEvents } from './arduinoPagination.js';
import { renderTechnicalDashboard } from './dashboards/technicalDashboard.js';
import { renderCommercialDashboard } from './dashboards/commercialDashboard.js';
import { renderEventDashboard } from './dashboards/eventDashboard.js';

// Rendre handleCellClick accessible globalement si nécessaire (déjà fait dans arduinoMain.js)
// window.handleCellClick = handleCellClick; // déjà fait dans main

export function renderByTab() {
    const currentTab = document.querySelector('.tab.active')?.dataset.tab || 'Technique';
    const visibleTableIndices = [];
    database.tables.forEach((table, idx) => {
        if (TABLE_TYPES[table.type] && TABLE_TYPES[table.type].tab === currentTab) {
            visibleTableIndices.push(idx);
        }
    });

    if (currentTab === 'Technique') {
        renderTechnicalDashboard();
        document.getElementById('commercialDashboard').innerHTML = '';
        const eventDashboard = document.getElementById('eventDashboard');
        if (eventDashboard) eventDashboard.innerHTML = '';
    } else if (currentTab === 'Commercial') {
        renderCommercialDashboard();
        document.getElementById('technicalDashboard').innerHTML = '';
        const eventDashboard = document.getElementById('eventDashboard');
        if (eventDashboard) eventDashboard.innerHTML = '';
    } else if (currentTab === 'Evenement') {
        renderEventDashboard();
        document.getElementById('technicalDashboard').innerHTML = '';
        document.getElementById('commercialDashboard').innerHTML = '';
    }
    displayTables(visibleTableIndices);
}

export function displayTables(visibleTableIndices) {
    const container = document.getElementById('tablesContainer');
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

        const headerHTML = '<tr>' + headers.map(h => `<th>${h.trim()}</th>`).join('') + '</tr>';
        let bodyHTML = '';

        page.rows.forEach(row => {
            const timestamp = row.cells[1];
            const date = timestamp.split(' ')[0];
            const cellsWithoutFirst = row.cells.slice(1);

            bodyHTML += '<tr>';
            cellsWithoutFirst.forEach((cell, cellIndex) => {
                const originalValue = cell.trim();
                const clientColumn = clientColumns.find(c => c.index === cellIndex);
                if (clientColumn && (table.type === 'I' || table.type === 'S')) {
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
                        </td>`;
                    } else {
                        bodyHTML += `<td>${originalValue}</td>`;
                    }
                } else {
                    bodyHTML += `<td>${originalValue}</td>`;
                }
            });
            bodyHTML += '</tr>';
        });

        const paginationHTML = generatePagination(tableIdx, page);
        html += `
            <div class="table-block" data-table-id="${table.id}" data-table-index="${tableIdx}">
                <div class="table-header">
                    <div class="table-title">${info.icon} ${info.name} (Type ${table.type})</div>
                    <div class="table-badge">
                        ${page.totalRows} enregistrement(s) - Page ${currentPageNum}/${page.totalPages} - Lignes ${page.startRow} à ${page.endRow}
                    </div>
                </div>
                <div class="table-wrapper"><table><thead>${headerHTML}</thead><tbody>${bodyHTML}</tbody></table></div>
                ${paginationHTML}
            </div>`;
    });

    container.innerHTML = html;
    container.classList.add('show');
    attachPaginationEvents(renderByTab);
}