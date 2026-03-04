// dashboards/technical/TechnicalDashboard.js
import { database } from '../../arduinoCore.js';
import { VOLTAGE_NORMS } from '../../arduinoConstants.js';
import { getEnergyStats } from '../../analytics/energyAnalytics.js';
import { renderEnergyBoard } from './EnergyBoard.js';

// ===========================================
// MANAGER DE GRAPHIQUES (ÉVITE LES FUITES MEMOIRE)
// ===========================================

const chartManager = {
    instances: {},
    create: function(canvasId, config) {
        // Détruire ancien chart si existant
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
            delete this.instances[canvasId];
        }
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        this.instances[canvasId] = new Chart(canvas, config);
        return this.instances[canvasId];
    },
    destroy: function(canvasId) {
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
            delete this.instances[canvasId];
        }
    },
    destroyAll: function() {
        Object.keys(this.instances).forEach(id => this.destroy(id));
    }
};

// ===========================================
// RENDER DASHBOARD PRINCIPAL
// ===========================================

export function renderTechnicalDashboard() {
    const container = document.getElementById('technicalDashboard');
    if (!container) return;

    if (document.querySelector('.tab.active')?.dataset.tab !== 'Technique') {
        container.innerHTML = '';
        return;
    }

    // HTML statique des cartes
    container.innerHTML = `
        <div class="section-title"><h2>🔧 I) DONNÉES TECHNIQUES</h2></div>
        <div id="infoCard" class="card"></div>

        <div class="section-title"><h2>📊 II) ANALYSE GÉNÉRALE DE LA TENSION</h2></div>
        <div id="conformityContainer" class="card"></div>
        <div id="normsCard" class="card"></div>
        <div id="exceedanceBoard" class="card"></div>
        <div id="loadSheddingBoard" class="card"></div>
        <div id="highVoltageBoard" class="card"></div>
        <div id="dailyChartCard" class="card"></div>
        <div id="hourlyChartCard" class="card"></div>

        <div class="section-title"><h2>⚡ III) ANALYSE ÉNERGIE</h2></div>
        <div id="energyBoard" class="card"></div>
        <div id="energyTable" class="card"></div>
    `;

    // RENDER DES CARTES
    renderInfoCard();
    renderConformityCard();
    renderNormsCard();
    renderExceedanceBoard();
    renderLoadSheddingBoard();
    renderHighVoltageBoard();
    renderDailyChart();
    renderHourlyChart();
    renderEnergyBoard();
    renderEnergyTable();
}

// ===========================================
// I) INFO CARD
// ===========================================

function renderInfoCard() {
    const container = document.getElementById('infoCard');
    if (!container) return;
    const data = database.technicalData;
    if (!data) {
        container.innerHTML = '<p class="no-data">Aucune donnée technique</p>';
        return;
    }

    const nanoreseau = document.getElementById('nanoreseauValue')?.textContent || 'N/A';

    container.innerHTML = `
        <h3 class="card-title">📋 INFORMATIONS RÉSEAU</h3>
        <div class="info-grid">
            <div class="info-item"><span class="info-label">🔌 NANORÉSEAU</span><span class="info-value">${nanoreseau}</span></div>
            <div class="info-item"><span class="info-label">📅 Période</span><span class="info-value">${data.daysCount || 0} jours</span><span class="info-sub">${data.chartData?.dates[0] || '??'} au ${data.chartData?.dates[data.daysCount-1] || '??'}</span></div>
            <div class="info-item"><span class="info-label">👥 Clients</span><span class="info-value">${data.clientCount || 0}</span></div>
            <div class="info-item"><span class="info-label">⚡ Tension moyenne</span><span class="info-value">${data.globalAvg?.toFixed(2) || 0} V</span></div>
            <div class="info-item"><span class="info-label">⬇️ Tension minimale</span><span class="info-value min">${data.globalMin?.toFixed(2) || 0} V</span></div>
            <div class="info-item"><span class="info-label">⬆️ Tension maximale</span><span class="info-value max">${data.globalMax?.toFixed(2) || 0} V</span></div>
        </div>
    `;
}

// ===========================================
// II-1) CONFORMITY CARD
// ===========================================

function renderConformityCard() {
    const container = document.getElementById('conformityContainer');
    if (!container) return;
    const data = database.technicalData?.conformity;
    if (!data) {
        container.innerHTML = '<p class="no-data">Données de conformité non disponibles</p>';
        return;
    }

    const nonConformes = data.totalJours - data.conformes;
    const pourcentageNonConforme = (100 - parseFloat(data.pourcentage)).toFixed(1);
    const percentClass = data.pourcentage >= 80 ? 'color-success' : 'color-warning';
    const joursIdeaux = data.totalJours - (data.causes.max.length + data.causes.min.length + data.causes.variation.length);
    const pourcentageIdeal = ((joursIdeaux / data.totalJours) * 100).toFixed(1);

    container.innerHTML = `
        <h3 class="card-title">📊 CONFORMITÉ DU SYSTÈME</h3>
        <div class="grid-3 gap-15 mb-20">
            <div class="stat-card text-center"><div class="stat-label">✅ Jours conformes</div><div class="stat-value ${percentClass}">${data.pourcentage}%</div><div class="stat-detail">${data.conformes}/${data.totalJours} jours</div></div>
            <div class="stat-card text-center"><div class="stat-label">⚠️ Jours non conformes</div><div class="stat-value color-danger">${pourcentageNonConforme}%</div><div class="stat-detail">${nonConformes}/${data.totalJours} jours</div></div>
            <div class="stat-card text-center"><div class="stat-label">💚 Fonctionnement idéal</div><div class="stat-value color-success">${pourcentageIdeal}%</div><div class="stat-detail">${joursIdeaux}/${data.totalJours} jours</div></div>
        </div>
        <div class="mt-20">
            <h4 class="section-subtitle">🔍 Causes de non-conformité</h4>
            <div class="grid-3 gap-15">
                <div class="cause-card"><div class="cause-header"><span class="cause-icon">⬆️</span><span class="cause-label">Surtension</span></div><div class="cause-value color-danger">${data.causes.max.length}</div><div class="cause-detail">jours</div></div>
                <div class="cause-card"><div class="cause-header"><span class="cause-icon">⬇️</span><span class="cause-label">Sous-tension</span></div><div class="cause-value color-danger">${data.causes.min.length}</div><div class="cause-detail">jours</div></div>
                <div class="cause-card"><div class="cause-header"><span class="cause-icon">⚡</span><span class="cause-label">Variation</span></div><div class="cause-value color-danger">${data.causes.variation.length}</div><div class="cause-detail">jours</div></div>
            </div>
        </div>
    `;
}

// ===========================================
// II-2) NORMS CARD
// ===========================================

function renderNormsCard() {
    const container = document.getElementById('normsCard');
    if (!container) return;

    const data = database.technicalData;
    let normSystem = '', normData = null;

    if (data.globalAvg >= 22 && data.globalAvg <= 29) { normSystem = '24V'; normData = VOLTAGE_NORMS['24V']; }
    else if (data.globalAvg >= 11 && data.globalAvg <= 15) { normSystem = '12V'; normData = VOLTAGE_NORMS['12V']; }

    if (!normData) {
        container.innerHTML = '<h3 class="card-title">🔋 Normes système</h3><p>Non déterminé</p>';
        return;
    }

    container.innerHTML = `
        <h3 class="card-title">🔋 Normes Système ${normSystem}</h3>
        <div class="norms-grid">
            <div class="norm-item"><span class="norm-label">Tension minimale</span><span class="norm-value">${normData.min}V</span></div>
            <div class="norm-item"><span class="norm-label">Plage idéale</span><span class="norm-value norm-range">${normData.ideal}V</span></div>
            <div class="norm-item"><span class="norm-label">Tension maximale</span><span class="norm-value">${normData.max}V</span></div>
            <div class="norm-item"><span class="norm-label">Seuil d'alerte</span><span class="norm-value alert-threshold">${normData.alert}</span></div>
        </div>
    `;
}

// ===========================================
// II-3) EXCEEDANCE BOARD
// ===========================================

function renderExceedanceBoard() {
    const container = document.getElementById('exceedanceBoard');
    if (!container) return;
    const data = database.technicalData;
    if (!data) return;

    const norms = VOLTAGE_NORMS[data.normSystem || '12V'];
    const exceedances = data.exceedances || { min: 0, max: 0, variation: 0 };

    const minClass = exceedances.min>0?'color-danger':'color-success';
    const maxClass = exceedances.max>0?'color-danger':'color-success';
    const varClass = exceedances.variation>0?'color-danger':'color-success';

    container.innerHTML = `
        <h3 class="card-title">📊 DÉPASSEMENTS</h3>
        <div class="grid-3 gap-15">
            <div class="exceedance-card gradient-bg"><div class="icon-large color-min">⬇️</div><div class="text-center"><span class="stat-large ${minClass}">${exceedances.min}</span><span class="color-gray"> jours</span></div><div class="text-center color-gray font-small">sous ${norms.min}V</div></div>
            <div class="exceedance-card gradient-bg"><div class="icon-large color-max">⬆️</div><div class="text-center"><span class="stat-large ${maxClass}">${exceedances.max}</span><span class="color-gray"> jours</span></div><div class="text-center color-gray font-small">> ${norms.max}V</div></div>
            <div class="exceedance-card gradient-bg"><div class="icon-large color-warning">⚡</div><div class="text-center"><span class="stat-large ${varClass}">${exceedances.variation}</span><span class="color-gray"> jours</span></div><div class="text-center color-gray font-small">variations critiques</div></div>
        </div>
        <div class="mt-10 text-right color-grey font-tiny">Seuil variation: ${norms.variationSeuil}V/h</div>
    `;
}

// ===========================================
// II-4) LOAD SHEDDING BOARD
// ===========================================

function renderLoadSheddingBoard() {
    const container = document.getElementById('loadSheddingBoard');
    if (!container) return;
    const data = database.technicalData?.loadShedding || { partiel:0, total:0, jours:[] };
    const total = data.partiel+data.total;
    const partielPercent = total>0?((data.partiel/total)*100).toFixed(1):0;
    const totalPercent = total>0?((data.total/total)*100).toFixed(1):0;

    container.innerHTML = `
        <h3 class="card-title">⚡ DÉLESTAGES</h3>
        <div class="flex gap-20 mb-20">
            <div class="flex-1 text-center p-20 bg-dark radius-8"><div class="font-xlarge color-warning">${total}</div><div class="color-gray">Total événements</div></div>
            <div class="flex-2 flex-col gap-15 p-10">
                <div><div class="flex justify-space-between mb-5"><span class="color-max">🔸 Délestage partiel</span><span class="color-white">${data.partiel} (${partielPercent}%)</span></div><div class="progress-bar"><div class="progress-fill warning" data-percent="${partielPercent}"></div></div></div>
                <div><div class="flex justify-space-between mb-5"><span class="color-danger">🔴 Délestage total</span><span class="color-white">${data.total} (${totalPercent}%)</span></div><div class="progress-bar"><div class="progress-fill danger" data-percent="${totalPercent}"></div></div></div>
            </div>
        </div>
        <div class="bg-darker p-15 radius-8"><div class="flex justify-space-between align-center"><span class="color-gray">📅 Jours avec délestage</span><span class="stat-large color-warning">${data.jours.length}</span></div>
            ${data.jours.length>0?`<div class="mt-10 flex flex-wrap gap-5">${data.jours.slice(0,7).map(d=>`<span class="tag small">${d}</span>`).join('')}${data.jours.length>7?`<span class="color-gray">+${data.jours.length-7} autres</span>`:''}</div>`:''}
        </div>
    `;
}

// ===========================================
// II-5) HIGH VOLTAGE BOARD
// ===========================================

function renderHighVoltageBoard() {
    const container = document.getElementById('highVoltageBoard');
    if (!container) return;
    const data = database.technicalData;
    if (!data) return;

    const normSystem = data.normSystem||'12V';
    const seuil = normSystem==='24V'?28:14.2;
    const hvData = data.highVoltage||[];

    const stats = {excellent:0,bon:0,mauvais:0,critique:0};
    hvData.forEach(d=>stats[d.qualite]++);

    container.innerHTML = `
        <h3 class="card-title">🔋 TENSION HAUTE (≥${seuil}V)</h3>
        <div class="stats-grid-4">
            <div class="stat-card excellent"><div class="stat-value">${stats.excellent}</div><div class="stat-label">EXCELLENT</div><div class="stat-sub">≥4x/jour</div></div>
            <div class="stat-card bon"><div class="stat-value">${stats.bon}</div><div class="stat-label">BON</div><div class="stat-sub">2-3x/jour</div></div>
            <div class="stat-card mauvais"><div class="stat-value">${stats.mauvais}</div><div class="stat-label">MAUVAIS</div><div class="stat-sub">1x/jour</div></div>
            <div class="stat-card critique"><div class="stat-value">${stats.critique}</div><div class="stat-label">CRITIQUE</div><div class="stat-sub">0x/jour</div></div>
        </div>
        <div class="chart-container"><div class="chart-wrapper"><canvas id="highVoltageChart"></canvas></div></div>
    `;

    chartManager.destroy('highVoltageChart');
    requestAnimationFrame(()=>{
        createHighVoltageChart(hvData.map(d=>d.date).sort(), hvData.map(d=>d.count), seuil);
    });
}

function createHighVoltageChart(dates, counts, seuil) {
    const referenceLine = { label:`Seuil excellent (4x/jour)`, data:Array(dates.length).fill(4), borderColor:'#4CAF50', borderWidth:2, borderDash:[5,5], pointRadius:0, fill:false, tension:0 };
    chartManager.create('highVoltageChart',{
        type:'line',
        data:{labels:dates,datasets:[{label:`Nombre ≥${seuil}V`,data:counts,borderColor:'#FF9800',backgroundColor:'rgba(255,152,0,0.1)',borderWidth:3,tension:0.3,pointBackgroundColor:counts.map(c=>c>=4?'#4CAF50':c>=2?'#FFD700':c===1?'#FF9800':'#F44336'),pointRadius:5,pointHoverRadius:8,fill:true},referenceLine]},
        options:{responsive:true,maintainAspectRatio:false}
    });
}

// ===========================================
// II-6) DAILY CHART
// ===========================================

function renderDailyChart() {
    const container = document.getElementById('dailyChartCard');
    if (!container) return;
    const data = database.technicalData?.chartData;
    if (!data) { container.innerHTML='<p class="no-data">Données insuffisantes pour le graphique</p>'; return; }

    container.innerHTML = `<h3 class="card-title">📈 ÉVOLUTION JOURNALIÈRE DES TENSIONS</h3><div style="height:300px;width:100%"><canvas id="dailyTensionChart"></canvas></div>`;

    chartManager.destroy('dailyTensionChart');
    requestAnimationFrame(()=>createDailyTensionChart(data));
}

function createDailyTensionChart(data) {
    const norms = VOLTAGE_NORMS[database.technicalData.normSystem || '12V'];
    const labels = data.dates;
    const datasets = [
        { label:'Tension min', data:data.mins, borderColor:'#64b5f6',pointRadius:4,fill:false },
        { label:'Tension max', data:data.maxs, borderColor:'#ffb74d',pointRadius:4,fill:false },
        { label:'Tension moyenne', data:data.avgs, borderColor:'#4CAF50',pointRadius:0,fill:false },
        { label:'Seuil min', data:Array(labels.length).fill(norms.min), borderColor:'#f44336', borderDash:[5,5], pointRadius:0, fill:false },
        { label:'Seuil max', data:Array(labels.length).fill(norms.max), borderColor:'#ff9800', borderDash:[5,5], pointRadius:0, fill:false },
        { label:'Plage idéale', data:Array(labels.length).fill((norms.min+norms.max)/2), borderColor:'#4CAF50', borderDash:[5,5], pointRadius:0, fill:false }
    ];

    chartManager.create('dailyTensionChart',{
        type:'line',
        data:{labels,datasets},
        options:{responsive:true,maintainAspectRatio:false}
    });
}

// ===========================================
// II-7) HOURLY CHART
// ===========================================

function renderHourlyChart(selectedDate = null) {
    const container = document.getElementById('hourlyChartCard');
    if (!container) return;

    const table = database.tables?.find(t=>t.type==='T');
    if (!table) { container.innerHTML='<p class="no-data">Données horaires indisponibles</p>'; return; }

    const day = selectedDate || table.data[0]?.split(';')[1].split(' ')[0];
    const dayData = table.data.filter(r=>r.split(';')[1].startsWith(day));
    if (dayData.length===0) { container.innerHTML='<p class="no-data">Aucune donnée pour ce jour</p>'; return; }

    const hours = dayData.map(r=>r.split(';')[1].split(' ')[1].substring(0,5));
    const tensions = dayData.map(r=>parseFloat(r.split(';')[4]));
    const norms = VOLTAGE_NORMS[database.technicalData.normSystem || '12V'];

    container.innerHTML = `<h3 class="card-title">⏱ TENSIONS HORAIRES - ${day}</h3><div style="height:300px;width:100%"><canvas id="hourlyTensionChart"></canvas></div>`;

    chartManager.destroy('hourlyTensionChart');
    requestAnimationFrame(()=>{
        chartManager.create('hourlyTensionChart',{
            type:'line',
            data:{
                labels:hours,
                datasets:[
                    { label:`Tension - ${day}`, data:tensions, borderColor:'#ff9800', fill:true, pointRadius:5 },
                    { label:'Seuil min', data:Array(hours.length).fill(norms.min), borderColor:'#f44336', borderDash:[5,5], pointRadius:0, fill:false },
                    { label:'Seuil max', data:Array(hours.length).fill(norms.max), borderColor:'#ff9800', borderDash:[5,5], pointRadius:0, fill:false },
                    { label:'Plage idéale', data:Array(hours.length).fill((norms.min+norms.max)/2), borderColor:'#4CAF50', borderDash:[3,3], pointRadius:0, fill:false }
                ]
            },
            options:{responsive:true,maintainAspectRatio:false}
        });
    });
}

// ===========================================
// III) ÉNERGIE
// ===========================================

function renderEnergyTable() {
    const container = document.getElementById('energyTable');
    if (!container) return;
    
    const energyData = database.energyData?.parDate || {};
    const dates = Object.keys(energyData).sort().slice(-10);
    
    let html = '<h3 class="card-title">📋 DÉTAIL ÉNERGIE (10 derniers jours)</h3>';
    html += '<div class="table-wrapper"><table><thead><tr><th>Date</th><th>Énergie totale (Wh)</th></tr></thead><tbody>';
    
    dates.forEach(date => {
        const total = energyData[date]?.total || 0;
        html += `<tr><td>${date}</td><td>${total.toFixed(2)}</td></tr>`;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}
