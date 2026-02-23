// dashboards/eventDashboard.js
export function renderEventDashboard() {
    const container = document.getElementById('eventDashboard');
    if (!container) return;
    
    // Structure vide pour l'instant
    const html = `
        <div class="event-dashboard">
            <div id="eventStatsContainer"></div>
            <div id="eventTableContainer"></div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Plus tard, on appellera:
    // renderEventStats();
    // renderEventTable();
}