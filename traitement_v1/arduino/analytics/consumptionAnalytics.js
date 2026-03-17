function renderConsumptionClient(client) {
    const container = document.getElementById('activeConsumptionClient');
    if (!container) return;
    
    // ✅ Utiliser les données de consommation du client
    const conso = client.consommation?.journaliere || [];
    const forfaitName = client.forfaitName || 'Inconnu';
    const forfaitMax = FORFAIT_LIMITS[forfaitName]?.max || 1;
    
    // Si pas de données, afficher un message
    if (conso.length === 0) {
        container.innerHTML = `
            <div class="client-card">
                <p class="no-data">Aucune donnée de consommation pour ce client</p>
            </div>
        `;
        return;
    }
    
    // Calculer les stats demandées par le chef
    const energieMax = Math.max(...conso.map(c => c.valeur), 0);
    const energieMoy = (conso.reduce((s, c) => s + c.valeur, 0) / conso.length).toFixed(2);
    const joursSans = conso.filter(c => c.valeur < 0.1).length;
    
    let joursDepasse90 = 0;
    let joursNormal = 0;
    let joursTolerance = 0;
    let joursHorsTolerance = 0;
    
    conso.forEach(jour => {
        const ratio = (jour.valeur / forfaitMax) * 100;
        if (ratio > 114) joursHorsTolerance++;
        else if (ratio > 100) joursTolerance++;
        else if (ratio > 90) joursDepasse90++;
        else joursNormal++;
    });
    
    const totalJours = conso.length;
    const normalPercent = totalJours > 0 ? ((joursNormal / totalJours) * 100).toFixed(1) : 0;
    const tolerancePercent = totalJours > 0 ? ((joursTolerance / totalJours) * 100).toFixed(1) : 0;
    const horsTolerancePercent = totalJours > 0 ? ((joursHorsTolerance / totalJours) * 100).toFixed(1) : 0;
    
    // Afficher les résultats
    container.innerHTML = `
        <div class="client-card">
            <div class="client-header">
                <span class="client-icon">⚡</span>
                <span class="client-id">Client ${client.id}</span>
                <span class="client-badge">Forfait: ${forfaitName}</span>
            </div>
            
            <!-- Stats principales -->
            <div class="stats-grid-4">
                <div class="stat-item">
                    <span class="stat-label">⚡ Énergie max</span>
                    <span class="stat-value">${energieMax.toFixed(2)} Wh</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">📊 Énergie moy</span>
                    <span class="stat-value">${energieMoy} Wh</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">📅 Jours sans</span>
                    <span class="stat-value ${joursSans > 0 ? 'warning' : ''}">${joursSans}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">📈 Jours >90%</span>
                    <span class="stat-value">${joursDepasse90}</span>
                </div>
            </div>
            
            <!-- Répartition -->
            <div class="distribution-section">
                <h4>Répartition de la consommation</h4>
                
                <div class="percent-bar">
                    <div class="bar-label">
                        <span>✅ Normal (≤90%)</span>
                        <span>${normalPercent}%</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill success" style="width: ${normalPercent}%"></div>
                    </div>
                </div>
                
                <div class="percent-bar">
                    <div class="bar-label">
                        <span>🟠 Tolérance (90-114%)</span>
                        <span>${tolerancePercent}%</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill warning" style="width: ${tolerancePercent}%"></div>
                    </div>
                </div>
                
                <div class="percent-bar">
                    <div class="bar-label">
                        <span>🔴 Hors tolérance (>114%)</span>
                        <span>${horsTolerancePercent}%</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill danger" style="width: ${horsTolerancePercent}%"></div>
                    </div>
                </div>
            </div>
            
            <!-- Mini graphique des 7 derniers jours -->
            <div class="mini-graph">
                <h4>📊 Derniers 7 jours</h4>
                <div class="bars-container">
                    ${conso.slice(-7).map(jour => `
                        <div class="bar-wrapper">
                            <div class="bar" style="height: ${(jour.valeur / energieMax) * 60}px"></div>
                            <span class="bar-label">${jour.date.slice(-2)}</span>
                            <span class="bar-value">${jour.valeur.toFixed(1)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}