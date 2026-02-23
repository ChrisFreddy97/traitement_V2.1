// dashboards/commercialDashboard.js
import { database } from '../arduinoCore.js';

export function renderCommercialDashboard() {
    const container = document.getElementById('commercialDashboard');
    if (!database.commercialData || document.querySelector('.tab.active')?.dataset.tab !== 'Commercial') {
        if (container) container.innerHTML = '';
        return;
    }

    // Étape 1: Uniquement des conteneurs vides
    const html = `
        <!-- Titre du dashboard -->
        <div id="commercialTitleContainer"></div>
        
        <!-- Navigation des clients -->
        <div id="commercialNavContainer"></div>
        
        <!-- Carte du client actif -->
        <div id="activeClientContainer"></div>
    `;

    // Étape 2: Mettre le HTML dans la page
    container.innerHTML = html;

    // Étape 3: Appeler toutes les cartes APRÈS
    renderCommercialTitle();
    renderCommercialNavigation();
    renderActiveClient();
}

// CARTE: Titre du dashboard
function renderCommercialTitle() {
    const container = document.getElementById('commercialTitleContainer');
    if (!container) return;

    const data = database.commercialData;
    const rechargeAnalysis = database.rechargeAnalysis;
    const clients = rechargeAnalysis ? rechargeAnalysis.clients : data.clients;

    container.innerHTML = `
        <div class="technical-title">
            <span>${rechargeAnalysis ? '💳 Analyse Recharges Clients' : '💰 Analyse Crédit Clients'}</span>
            <span style="font-size:0.7em; opacity:0.8;">${clients.length} clients analysés</span>
        </div>
    `;
}

// CARTE: Navigation (tabs + boutons)
function renderCommercialNavigation() {
    const container = document.getElementById('commercialNavContainer');
    if (!container) return;

    const data = database.commercialData;
    const rechargeAnalysis = database.rechargeAnalysis;
    const clients = rechargeAnalysis ? rechargeAnalysis.clients : data.clients;

    container.innerHTML = `
        <div class="client-tabs-container">
            <button class="client-tab-nav prev" id="prevClient">◀</button>
            <div class="client-tabs" id="clientTabs"></div>
            <button class="client-tab-nav next" id="nextClient">▶</button>
        </div>
    `;

    // Remplir les tabs
    renderClientTabs(clients, rechargeAnalysis);
    
    // Attacher la navigation (les événements)
    attachClientNavigation(clients, rechargeAnalysis);
}

// Fonction interne pour les tabs
function renderClientTabs(clients, rechargeAnalysis) {
    const container = document.getElementById('clientTabs');
    if (!container) return;
    
    container.innerHTML = clients.map((client, index) => `
        <button class="client-tab ${index === 0 ? 'active' : ''}" data-client-id="${client.id}" data-index="${index}">
            Client ${client.id}
        </button>
    `).join('');
}

// CARTE: Client actif
function renderActiveClient() {
    const container = document.getElementById('activeClientContainer');
    if (!container) return;

    const data = database.commercialData;
    const rechargeAnalysis = database.rechargeAnalysis;
    const clients = rechargeAnalysis ? rechargeAnalysis.clients : data.clients;
    
    if (!clients || clients.length === 0) {
        container.innerHTML = '<div>Aucun client</div>';
        return;
    }

    // Récupérer l'index actif depuis l'onglet actif
    const activeTab = document.querySelector('.client-tab.active');
    const activeIndex = activeTab ? parseInt(activeTab.dataset.index) : 0;
    const client = clients[activeIndex];

    container.innerHTML = rechargeAnalysis ? 
        renderRechargeClientCard(client) : 
        renderClientCard(client);
}

// Fonction pour la carte d'un client (recharge)
function renderRechargeClientCard(client) {
    const total = client.totalRecharges || 0;
    const creditTotal = client.creditTotal || 0;
    const creditMoyen = client.creditMoyen || '0.00';
    const preferred = client.preferredCredit ?? 'N/A';
    const preferredPct = client.preferredPercentage ?? '0';
    const codesUniques = client.codesUniques || 0;
    const premiere = client.premiereRecharge || 'N/A';
    const derniere = client.derniereRecharge || 'N/A';

    const creditFreqHtml = client.creditPercentages ? 
        Object.entries(client.creditPercentages).map(([c,p]) => 
            `<div class="credit-freq-item">Crédit ${c}: <strong>${p}%</strong></div>`
        ).join('') : '';

    return `
        <div class="client-card recharge-client">
            <div class="client-header-large">
                <span style="font-size:2em;">💳</span>
                <div>
                    <div class="client-name-large">Client ${client.clientId || client.id}</div>
                    <div class="client-subtitle">Recharges: ${total} — Crédit total: ${creditTotal}</div>
                </div>
                <span class="client-badge">Préféré: ${preferred} (${preferredPct}%)</span>
            </div>

            <div class="client-stats-grid-large">
                <div class="stat-card-client">
                    <div class="stat-label">🔁 Total recharges</div>
                    <div class="stat-value-large">${total}</div>
                </div>
                <div class="stat-card-client">
                    <div class="stat-label">💶 Crédit moyen</div>
                    <div class="stat-value-large">${creditMoyen}</div>
                </div>
                <div class="stat-card-client">
                    <div class="stat-label">🔐 Codes uniques</div>
                    <div class="stat-value-large">${codesUniques}</div>
                </div>
            </div>

            <div class="credit-frequency">
                <h5>Répartition des crédits</h5>
                ${creditFreqHtml || '<p>Aucune donnée</p>'}
            </div>

            <div class="forfait-history">
                <h5>Historique forfaits</h5>
                ${client.forfaitHistory && client.forfaitHistory.length > 0 ? 
                    client.forfaitHistory.slice().reverse().map(f => 
                        `<div>${new Date(f.date).toLocaleString()} — Forfait: ${f.forfait} — Crédit: ${f.credit}</div>`
                    ).join('') : 
                    '<div>Aucun historique</div>'}
            </div>

            <div class="client-meta-info">Première: ${premiere} — Dernière: ${derniere}</div>
        </div>
    `;
}

// Fonction pour la carte d'un client (crédit standard)
function renderClientCard(client) {
    const avgCredit = client.averageCredit ? client.averageCredit.toFixed(2) : '0.00';
    const zeroCount = client.zeroCreditDates ? client.zeroCreditDates.length : 0;
    
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
                    <div class="stat-value-large" style="color:#ffb74d;">${client.maxCredit || 0} <span class="stat-unit">€</span></div>
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
                                <div class="timeline-badge"> 0 </div>
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

// Navigation (gestion des événements)
function attachClientNavigation(clients, rechargeAnalysis) {
    // Attendre que les éléments soient dans le DOM
    setTimeout(() => {
        const tabs = document.querySelectorAll('.client-tab');
        const container = document.getElementById('activeClientContainer');
        const prevBtn = document.getElementById('prevClient');
        const nextBtn = document.getElementById('nextClient');
        
        if (!tabs.length || !container) return;
        
        let activeIndex = 0;
        
        function switchToClient(index) {
            if (index < 0 || index >= clients.length) return;
            
            activeIndex = index;
            
            tabs.forEach((tab, i) => {
                if (i === index) {
                    tab.classList.add('active');
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                } else {
                    tab.classList.remove('active');
                }
            });
            
            const client = clients[index];
            container.innerHTML = rechargeAnalysis ? 
                renderRechargeClientCard(client) : 
                renderClientCard(client);
        }
        
        // Ajouter les événements sur les tabs
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                switchToClient(index);
            });
        });
        
        // Boutons précédent/suivant
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
        
        // Navigation clavier
        const keydownHandler = (e) => {
            // Ne fonctionne que si l'onglet commercial est actif
            if (document.querySelector('.tab.active')?.dataset.tab !== 'Commercial') return;
            
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevBtn?.click();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextBtn?.click();
            }
        };
        
        window.addEventListener('keydown', keydownHandler);
        
        // Nettoyer l'ancien handler si on rappelle la fonction
        return () => {
            window.removeEventListener('keydown', keydownHandler);
        };
    }, 100);
}