// arduinoRender.js
import { database } from './arduinoCore.js';
import { TABLE_TYPES, VOLTAGE_NORMS } from './arduinoConstants.js';
import { getEventColor, handleCellClick } from './arduinoEvents.js';
import { generatePagination, attachPaginationEvents } from './arduinoPagination.js';


// Variable pour stocker la référence du graphique Chart.js
let tensionChartInstance = null;

export function renderTechnicalDashboard() {
    const container = document.getElementById('technicalDashboard');
    if (!database.technicalData || document.querySelector('.tab.active')?.dataset.tab !== 'Technique') {
        if (container) container.innerHTML = '';
        return;
    }

    const data = database.technicalData;
    
    // Déterminer quelle norme afficher en fonction de la tension moyenne
    let normSystem = '';
    let normData = null;
    
    if (data.globalAvg >= 22 && data.globalAvg <= 29) {
        normSystem = '24V';
        normData = VOLTAGE_NORMS['24V'];
    } else if (data.globalAvg >= 11 && data.globalAvg <= 15) {
        normSystem = '12V';
        normData = VOLTAGE_NORMS['12V'];
    }

    const html = `
        <div class="technical-dashboard">
            <div class="technical-title"><span>⚡ Analyse des Tensions</span></div>
            <div class="stats-container">
                <div class="stat-card">
                    <div class="stat-label">📅 Période</div>
                    <div class="stat-value">${data.daysCount}</div>
                    <div class="stat-unit">jours</div>
                    <div class="stat-sub">du ${data.dailyStats.dates[0]} au ${data.dailyStats.dates[data.dailyStats.dates.length-1]}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">👥 Nombre de clients</div>
                    <div class="stat-value">${data.clientCount}</div>
                    <div class="stat-sub">clients actifs</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">📊 Tension moyenne</div>
                    <div class="stat-value">${data.globalAvg.toFixed(2)} V</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">⬇️ Tension minimale</div>
                    <div class="stat-value" style="color:#64b5f6;">${data.globalMin.toFixed(2)} V</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">⬆️ Tension maximale</div>
                    <div class="stat-value" style="color:#ffb74d;">${data.globalMax.toFixed(2)} V</div>
                </div>
            </div>
            
            <div class="chart-container">
                <div class="chart-title"><span>📈 Évolution journalière des tensions</span></div>
                <div class="chart-wrapper"><canvas id="tensionChart"></canvas></div>
            </div>
            
            ${normData ? `
            <div class="norms-container">
                <div class="norm-card">
                    <div class="norm-header"><span style="font-size:1.5em;">🔋</span><h3>Normes Système ${normSystem}</h3></div>
                    <div class="norm-grid">
                        <div class="norm-item"><span class="norm-label">Tension minimale</span><span class="norm-value">${normData.min}V</span></div>
                        <div class="norm-item"><span class="norm-label">Plage idéale</span><span class="norm-value norm-range">${normData.ideal}V</span></div>
                        <div class="norm-item"><span class="norm-label">Tension maximale</span><span class="norm-value">${normData.max}V</span></div>
                        <div class="norm-item"><span class="norm-label">Seuil d'alerte</span><span class="norm-value alert-threshold">${normData.alert}</span></div>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    container.innerHTML = html;
    setTimeout(() => createTensionChart(data.dailyStats), 100);
}


function createTensionChart(dailyStats) {
    const ctx = document.getElementById('tensionChart');
    if (!ctx) return;
    if (tensionChartInstance) tensionChartInstance.destroy();
    tensionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dailyStats.dates,
            datasets: [
                { label: 'Tension minimale du jour', data: dailyStats.mins, borderColor: '#42a5f5', backgroundColor: 'rgba(66,165,245,0.1)', borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.3 },
                { label: 'Tension maximale du jour', data: dailyStats.maxs, borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.1)', borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.3 },
                { label: 'Tension moyenne du jour', data: dailyStats.avgs, borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)', borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.3, borderDash: [5,5] }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Tensions journalières', font: { size: 16, weight: 'bold' }, padding: 20 },
                legend: { display: true, position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                tooltip: { mode: 'index', intersect: false, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}V` } }
            },
            scales: {
                y: { beginAtZero: false, title: { display: true, text: 'Tension (V)', font: { weight: 'bold' } }, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { title: { display: true, text: 'Date', font: { weight: 'bold' } }, grid: { display: false } }
            }
        }
    });
}

export function renderCommercialDashboard() {
    const container = document.getElementById('commercialDashboard');
    if (!database.commercialData || document.querySelector('.tab.active')?.dataset.tab !== 'Commercial') {
        if (container) container.innerHTML = '';
        return;
    }

    const data = database.commercialData;
    
    let html = `
        <div class="commercial-dashboard">
            <div class="technical-title">
                <span>💰 Analyse Crédit Clients</span>
                <span style="font-size:0.7em; opacity:0.8;">${data.clientCount} clients analysés</span>
            </div>
            
            <!-- Onglets par client -->
            <div class="client-tabs-container">
                <button class="client-tab-nav prev" id="prevClient">◀</button>
                <div class="client-tabs" id="clientTabs">
                    ${data.clients.map((client, index) => `
                        <button class="client-tab ${index === 0 ? 'active' : ''}" data-client-id="${client.id}" data-index="${index}">
                            Client ${client.id}
                        </button>
                    `).join('')}
                </div>
                <button class="client-tab-nav next" id="nextClient">▶</button>
            </div>
            
            <!-- Conteneur pour le client actif -->
            <div id="activeClientContainer">
                ${renderClientCard(data.clients[0])}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    attachClientTabEvents(data.clients);
}

function renderClientCard(client) {
    const avgCredit = client.averageCredit.toFixed(2);
    const zeroCount = client.zeroCreditDates.length;
    
    return `
        <div class="client-card active-client">
            <div class="client-header-large">
                <span style="font-size:2em;">👤</span>
                <div>
                    <div class="client-name-large">Client ${client.id}</div>
                    <div class="client-subtitle">Détail des crédits et jours sans crédit</div>
                </div>
                <span class="client-badge ${zeroCount > 0 ? 'badge-warning' : 'badge-success'}">
                    ${zeroCount > 0 ? `${zeroCount} jour(s) sans crédit` : 'Aucun jour sans crédit'}
                </span>
            </div>
            
            <div class="client-stats-grid-large">
                <div class="stat-card-client">
                    <div class="stat-label">💶 Crédit moyen</div>
                    <div class="stat-value-large">${avgCredit} <span class="stat-unit">€</span></div>
                </div>
                <div class="stat-card-client">
                    <div class="stat-label">📈 Crédit maximum</div>
                    <div class="stat-value-large" style="color:#ffb74d;">${client.maxCredit} <span class="stat-unit">€</span></div>
                </div>
                <div class="stat-card-client">
                    <div class="stat-label">📊 Total jours à zéro</div>
                    <div class="stat-value-large ${zeroCount > 0 ? 'text-danger' : 'text-success'}">${zeroCount}</div>
                </div>
            </div>
            
            <div class="zero-credit-section">
                <div class="section-title">
                    <span>📅 Historique des jours sans crédit</span>
                    <span class="section-count">${zeroCount} enregistrement(s)</span>
                </div>
                
                <div class="zero-credit-timeline">
                    ${zeroCount > 0 ? 
                        client.zeroCreditDates.map(date => `
                            <div class="timeline-item">
                                <div class="timeline-date">${date}</div>
                                <div class="timeline-badge">0 crédit</div>
                            </div>
                        `).join('') 
                        : 
                        '<div class="no-data">✅ Aucun jour sans crédit enregistré</div>'
                    }
                </div>
            </div>
            
            <div class="client-meta-info">
                <div>Dernière mise à jour: ${new Date().toLocaleDateString('fr-FR')}</div>
            </div>
        </div>
    `;
}

function attachClientTabEvents(clients) {
    const tabs = document.querySelectorAll('.client-tab');
    const container = document.getElementById('activeClientContainer');
    const prevBtn = document.getElementById('prevClient');
    const nextBtn = document.getElementById('nextClient');
    
    let activeIndex = 0;
    
    function switchToClient(index) {
        // Mettre à jour l'index actif
        activeIndex = index;
        
        // Mettre à jour les classes des onglets
        tabs.forEach((tab, i) => {
            if (i === index) {
                tab.classList.add('active');
                // Scroll l'onglet dans la vue
                tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Afficher le client correspondant
        container.innerHTML = renderClientCard(clients[index]);
    }
    
    // Événements sur les onglets
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => switchToClient(index));
    });
    
    // Navigation précédent/suivant
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            const newIndex = activeIndex > 0 ? activeIndex - 1 : clients.length - 1;
            switchToClient(newIndex);
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const newIndex = activeIndex < clients.length - 1 ? activeIndex + 1 : 0;
            switchToClient(newIndex);
        });
    }
    
    // Navigation au clavier
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevBtn?.click();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextBtn?.click();
        }
    });
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
    } else if (currentTab === 'Commercial') {
        renderCommercialDashboard();
        document.getElementById('technicalDashboard').innerHTML = '';
    } else {
        document.getElementById('technicalDashboard').innerHTML = '';
        document.getElementById('commercialDashboard').innerHTML = '';
    }
    displayTables(visibleTableIndices);
}

export function createLegend() {
    const types = [...new Set(database.tables.map(t => t.type))].sort();
    let html = '<strong style="margin-right:15px;">Types de données :</strong>';
    types.forEach(type => {
        const info = TABLE_TYPES[type] || { name: type, color: '#999', icon: '📋' };
        html += `<div class="legend-item"><div class="legend-badge type-${type}" style="background:${info.color};">${type}</div><span>${info.icon} ${info.name}</span></div>`;
    });
    document.getElementById('typeLegend').innerHTML = html;
}