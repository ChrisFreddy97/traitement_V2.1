// dashboards/commercial/BalanceBoard.js
import { database } from '../../arduinoCore.js';
import { FORFAIT_NAMES } from '../../arduinoConstants.js';

export function renderBalanceBoard() {
    const container = document.getElementById('balanceBoard');
    if (!container) return;
    
    const clientsMap = database.commercialData?.clients;
    if (!clientsMap) {
        container.innerHTML = '<p class="no-data">Aucune donnée</p>';
        return;
    }
    
    const clients = Array.from(clientsMap.values()).filter(c => typeof c.id === 'number' && c.id <= 20);
    
    container.innerHTML = `
        <h3 class="card-title">📊 SOLDE & RECHARGE PAR CLIENT</h3>
        
        <div class="client-tabs-container">
            <button class="client-tab-nav prev" id="prevBalanceClient">◀</button>
            <div class="client-tabs" id="balanceClientTabs"></div>
            <button class="client-tab-nav next" id="nextBalanceClient">▶</button>
        </div>
        
        <div id="activeBalanceClient" class="client-content"></div>
    `;
    
    renderBalanceTabs(clients);
    renderBalanceClient(clients[0]);
    attachBalanceNavigation(clients);
}

function renderBalanceTabs(clients) {
    const container = document.getElementById('balanceClientTabs');
    if (!container) return;
    
    container.innerHTML = clients.map((client, index) => `
        <button class="client-tab ${index === 0 ? 'active' : ''}" data-index="${index}">
            Client ${client.id}
        </button>
    `).join('');
}

function renderBalanceClient(client) {
    const container = document.getElementById('activeBalanceClient');
    if (!container) return;
    
    // Données
    const dernierCredit = client.credits?.slice(-1)[0]?.value || 0;
    const credits = client.credits || [];
    const joursAnalyses = client.count || credits.length;
    const joursSansCredit = client.zeroCreditDates?.length || 0;
    const maxCredit = client.maxCredit || 0;
    const totalRecharges = client.totalRecharges || 0;
    
    // Pourcentage jours sans crédit
    const pourcentageSans = joursAnalyses > 0 
        ? ((joursSansCredit / joursAnalyses) * 100).toFixed(1) 
        : 0;
    
    // Message sur les jours sans crédit
    let messageJoursSans = "";
    if (joursSansCredit === 0) {
        messageJoursSans = "✅ Ce client n'a jamais été à découvert.";
    } else if (pourcentageSans < 10) {
        messageJoursSans = `⚠️ Ce client a eu ${joursSansCredit} jour(s) sans crédit sur ${joursAnalyses} jours analysés (${pourcentageSans}%), ce qui reste acceptable.`;
    } else {
        messageJoursSans = `🔴 Ce client a eu ${joursSansCredit} jour(s) sans crédit sur ${joursAnalyses} jours analysés (${pourcentageSans}%). Une attention particulière est recommandée.`;
    }
    
    // Message sur le crédit max
    let messageCreditMax = `💳 Son plus gros crédit était de ${maxCredit} jour(s).`;
    
    // Message sur les recharges
    let messageRecharges = "";
    if (totalRecharges === 0) {
        messageRecharges = "📱 Aucune recharge enregistrée.";
    } else if (totalRecharges < 5) {
        messageRecharges = `📱 Il a effectué ${totalRecharges} recharge(s) seulement.`;
    } else {
        messageRecharges = `📱 Il recharge régulièrement (${totalRecharges} fois).`;
    }
    
    // Message sur le crédit préféré
    const creditPrefere = client.preferredCredit || "non déterminé";
    const pourcentagePref = client.preferredPercentage || 0;
    let messageCreditPref = "";
    if (creditPrefere !== "non déterminé") {
        messageCreditPref = `📊 Il recharge généralement pour ${creditPrefere} jour(s) (${pourcentagePref}% des recharges).`;
    }
    
    // Message sur les forfaits
    let messageForfaits = "";
    const forfaitActuel = client.forfaitName || "inconnu";
    const changements = client.forfaitChanges || [];
    
    if (changements.length === 0) {
        messageForfaits = `📦 Forfait actuel : ${forfaitActuel} (aucun changement).`;
    } else {
        const historique = changements.map(c => 
            `${FORFAIT_NAMES[c.ancien] || c.ancien} → ${FORFAIT_NAMES[c.nouveau] || c.nouveau}`
        ).join(", ");
        messageForfaits = `📦 Forfaits utilisés : ${historique} (actuel : ${forfaitActuel}).`;
    }
    
    // Score
    const scoreMsg = client.score?.alerte 
        ? `🏷️ ${client.score.alerte}`
        : "🏷️ Profil standard";
    
    container.innerHTML = `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">📊</span>
                <span class="client-id">Synthèse client ${client.id}</span>
                <span class="client-badge">${scoreMsg}</span>
            </div>
            
            <div class="message-container">
                <p class="client-message">${messageJoursSans}</p>
                <p class="client-message">${messageRecharges}</p>
                <p class="client-message">${messageCreditPref}</p>
                <p class="client-message">${messageForfaits}</p>
                <p class="client-message">${messageCreditMax}</p>
            </div>
            
            ${client.score?.raisons?.length > 0 ? `
                <div class="alert-section">
                    <h4>🔔 Alertes</h4>
                    <ul>
                        ${client.score.raisons.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${client.recommendations?.actions?.length > 0 ? `
                <div class="recommendation-section">
                    <h4>💡 Recommandation</h4>
                    <p class="recommendation-text">
                        ${client.recommendations.actions[0]?.message || "Aucune recommandation"}
                    </p>
                </div>
            ` : ''}
        </div>
    `;
}

function attachBalanceNavigation(clients) {
    setTimeout(() => {
        const tabs = document.querySelectorAll('#balanceClientTabs .client-tab');
        const container = document.getElementById('activeBalanceClient');
        const prevBtn = document.getElementById('prevBalanceClient');
        const nextBtn = document.getElementById('nextBalanceClient');
        
        if (!tabs.length) return;
        
        let activeIndex = 0;
        
        function switchToClient(index) {
            if (index < 0 || index >= clients.length) return;
            activeIndex = index;
            
            tabs.forEach((tab, i) => {
                tab.classList.toggle('active', i === index);
            });
            
            renderBalanceClient(clients[index]);
        }
        
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => switchToClient(index));
        });
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                switchToClient(activeIndex > 0 ? activeIndex - 1 : clients.length - 1);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                switchToClient(activeIndex < clients.length - 1 ? activeIndex + 1 : 0);
            });
        }
    }, 100);
}