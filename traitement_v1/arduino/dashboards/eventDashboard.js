// dashboards/event/EventDashboard.js
import { database } from '../arduinoCore.js';

export function renderEventDashboard() {
    const container = document.getElementById('eventDashboard');
    if (!container) return;
    
    const eventMap = database.eventMap;
    if (!eventMap || eventMap.size === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 3em; margin-bottom: 10px;">📋</div>
                <p style="color: #aaa;">Aucun événement enregistré</p>
            </div>
        `;
        return;
    }
    

    // Grouper les événements par date
    const events = Array.from(eventMap.values());
    const eventsByDate = {};
    
    events.forEach(event => {
        if (!eventsByDate[event.date]) {
            eventsByDate[event.date] = [];
        }
        eventsByDate[event.date].push(event);
    });
    
    // Trier les dates (plus récent en premier)
    const sortedDates = Object.keys(eventsByDate).sort().reverse();
    
    // Compter les types d'événements
    const eventTypes = {};
    events.forEach(event => {
        eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    });
    
    // Mapper les couleurs par type d'événement
    const typeColors = {
        'SuspendE': '#f44336',
        'SuspendP': '#ff9800',
        'Surcharge': '#ff5722',
        'CoupeCharge': '#e91e63',
        'Delestage': '#ff9800',
        'Maintenance': '#2196f3',
        'Maintenance_Défaut': '#2196f3',
        'Défaut': '#f44336'
    };
    
    let html = `
        <h3 class="card-title">📋 ÉVÉNEMENTS DÉTAILLÉS</h3>
        
        <!-- Statistiques globales -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 25px;">
            <div style="background: linear-gradient(135deg, #1a2535, #0f151f); padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
                <div style="color: #aaa; font-size: 0.9em;">📊 Total</div>
                <div style="font-size: 2em; font-weight: bold; color: #2196f3;">${events.length}</div>
                <div style="color: #666; font-size: 0.8em;">événements</div>
            </div>
            ${Object.entries(eventTypes).slice(0, 4).map(([type, count]) => `
                <div style="background: linear-gradient(135deg, #1a2535, #0f151f); padding: 15px; border-radius: 8px; border-left: 4px solid ${typeColors[type] || '#999'};">
                    <div style="color: #aaa; font-size: 0.9em;">⚡ ${type}</div>
                    <div style="font-size: 2em; font-weight: bold; color: ${typeColors[type] || '#999'};">${count}</div>
                    <div style="color: #666; font-size: 0.8em;">fois</div>
                </div>
            `).join('')}
        </div>
        
        <!-- Événements groupés par date -->
        <div style="background: #0f151f; border-radius: 8px; overflow: hidden;">
    `;
    
    sortedDates.forEach((date, idx) => {
        const dateEvents = eventsByDate[date];
        const isExpanded = idx === 0; // Première date expansée par défaut
        const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        html += `
            <div style="border-bottom: 1px solid #2a3a4a;">
                <div style="background: linear-gradient(90deg, #1a2535, #0f151f); padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none';">
                    <div>
                        <div style="font-weight: bold; color: #fff; margin-bottom: 3px;">📅 ${dateLabel}</div>
                        <div style="font-size: 0.9em; color: #aaa;">${dateEvents.length} événement${dateEvents.length > 1 ? 's' : ''}</div>
                    </div>
                    <span style="color: #2196f3; font-size: 1.2em;">▼</span>
                </div>
                
                <div style="display: ${isExpanded ? 'block' : 'none'}; padding: 15px; background: #0f151f;">
                    ${dateEvents.map((event, i) => `
                        <div style="background: rgba(33, 150, 243, 0.05); border-left: 3px solid ${typeColors[event.type] || '#999'}; padding: 10px 12px; margin-bottom: ${i < dateEvents.length - 1 ? '10px' : '0'}; border-radius: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <span style="font-weight: bold; color: ${typeColors[event.type] || '#fff'};">⚡ ${event.type}</span>
                                <span style="color: #666; font-size: 0.85em;">${event.timestamp || event.date}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #aaa;">Client <strong style="color: #fff;">#${event.clientId}</strong></span>
                                <span style="background: ${typeColors[event.type] || '#999'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold;">${event.valeur || 'N/A'}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    html += `
        </div>
        
        <!-- Résumé -->
        <div style="margin-top: 15px; background: #0f151f; padding: 15px; border-radius: 8px; border-left: 4px solid #4CAF50;">
            <div style="font-weight: bold; color: #4CAF50; margin-bottom: 5px;">ℹ️ Résumé</div>
            <div style="color: #aaa; font-size: 0.9em;">
                ${sortedDates.length} jour${sortedDates.length > 1 ? 's' : ''} avec événements | 
                ${events.length} événement${events.length > 1 ? 's' : ''} au total | 
                Période: ${sortedDates[sortedDates.length - 1]} à ${sortedDates[0]}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}