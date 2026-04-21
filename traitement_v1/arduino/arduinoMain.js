// arduinoMain.js
import { database, showLoader, hideLoader, simulateProgress, showError, hideError, readFileAsync, linkEnergyToCommercial } from './arduinoCore.js';
import { parseRawTables, buildDatabase } from './arduinoParser.js';
import { analyzeTechnicalData } from './analytics/technicalAnalytics.js';
import { analyzeCommercialData } from './analytics/commercialAnalytics.js';
import { analyzeEnergyData } from './analytics/energyAnalytics.js';
import { buildEventMap } from './analytics/eventAnalytics.js';
import { handleCellClick } from './arduinoEvents.js';
import { renderByTab } from './arduinoRender.js';
import { VOLTAGE_NORMS, FORFAIT_LIMITS, FORFAIT_NAMES } from './arduinoConstants.js';

// ===========================================
// VARIABLE GLOBALE
// ===========================================
let currentFilter = {
    period: 'all',
    startDate: null,
    endDate: null,
    month: null,
    year: null
};
export function getCurrentFilter() {
    return { ...currentFilter };
}

// ============================================
// DÉTECTION PLATEFORME
// ============================================

function detectPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    const width = window.innerWidth;
    
    if (ua.includes('electron')) {
        return 'electron';
    }
    
    if (width <= 768 || 'ontouchstart' in window) {
        return 'mobile';
    }
    
    if (width <= 1024) {
        return 'tablet';
    }
    
    return 'web';
}

document.documentElement.classList.add(detectPlatform());

window.addEventListener('resize', () => {
    document.documentElement.classList.remove('electron', 'mobile', 'tablet', 'web');
    document.documentElement.classList.add(detectPlatform());
});

window.handleCellClick = handleCellClick;

// ===========================================
// INITIALISATION ELECTRON & NAVIGATION
// ===========================================

function initializeBackButton() {
    const backButton = document.getElementById('backButton');
    if (!backButton) return;

    backButton.addEventListener('click', () => {
        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.goBack) {
            window.electronAPI.goBack();
        } else {
            window.history.back();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBackButton);
} else {
    initializeBackButton();
}

// ===========================================
// INITIALISATION
// ===========================================

const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const fileName = document.getElementById('fileName');
const nanoreseauValue = document.getElementById('nanoreseauValue');

// ============================================
// DASHBOARD EXPORTER - EXPORT COMPLET DES DONNÉES
// ============================================
class DashboardExporter {
    constructor(database, nanoreseauId) {
        this.db = database;
        this.nanoreseauId = nanoreseauId;
        this.timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    }
    
    exportAll() {
        this.exportTechnical();
        this.exportCommercial();
        console.log(`📁 Exports générés pour NANORESEAU ${this.nanoreseauId}`);
    }
    
    // ==================== TECHNICAL DASHBOARD ====================
    
    exportTechnical() {
        const data = this.buildTechnicalData();
        this.saveFile(data, 'technical');
    }
    
    buildTechnicalData() {
        const tech = this.db.technicalData || {};
        const energy = this.db.energyData || {};
        const chartData = tech.chartData || {};
        const tables = this.db.tables || [];
        
        // Données des graphiques
        const hourlyTensionData = this.getHourlyTensionData(tables);
        const hourlyIntensiteData = this.getHourlyIntensiteData(tables);
        const hourlyConsumptionData = this.getHourlyConsumptionData();
        const clientTrendData = this.getClientTrendData(energy);
        
        // Récupérer les données horaires pour les heures de pic
        const hourlyPeakData = this.getHourlyPeakData(tables);
        
        // Distribution des kits
        const dailyValues = Object.values(energy.parDate || {}).map(d => d.total || 0);
        const totalJours = dailyValues.length;
        
        const seuils = [
            { id: 0, label: 'Kit 0', max: 250 },
            { id: 1, label: 'Kit 1', max: 360 },
            { id: 2, label: 'Kit 2', max: 540 },
            { id: 3, label: 'Kit 3', max: 720 },
            { id: 4, label: 'Kit 4', max: 1080 }
        ];
        
        const kitDistribution = [];
        let stopIndex = seuils.length;
        
        for (let i = 0; i < seuils.length; i++) {
            const seuil = seuils[i];
            const joursCouverts = dailyValues.filter(v => v <= seuil.max).length;
            const pourcentage = totalJours > 0 ? (joursCouverts / totalJours) * 100 : 0;
            
            kitDistribution.push({
                id: seuil.id,
                label: seuil.label,
                max: seuil.max,
                jours: joursCouverts,
                percentage: pourcentage
            });
            
            if (pourcentage >= 99.9 && stopIndex === seuils.length) {
                stopIndex = i + 1;
            }
        }
        
        // Enrichir les causes de conformité
        const conformity = tech.conformity || {};
        const causesMax = (conformity.causes?.max || []).map(date => {
            const idx = chartData.dates?.indexOf(date);
            return {
                date: date,
                valeur: idx !== -1 ? chartData.maxs?.[idx] : null
            };
        });
        
        const causesMin = (conformity.causes?.min || []).map(date => {
            const idx = chartData.dates?.indexOf(date);
            return {
                date: date,
                valeur: idx !== -1 ? chartData.mins?.[idx] : null
            };
        });
        
        const causesVariation = (conformity.causes?.variation || []).map(date => {
            const idx = chartData.dates?.indexOf(date);
            return {
                date: date,
                valeur: idx !== -1 ? chartData.avgs?.[idx] : null
            };
        });
        
        const normSystem = tech.normSystem || '12V';
        const voltageNorms = VOLTAGE_NORMS ? VOLTAGE_NORMS[normSystem] : { min: null, max: null, ideal: null, alert: null };
        
        return {
            metadata: {
                nanoreseau: this.nanoreseauId,
                exportDate: new Date().toISOString(),
                type: 'technical'
            },
            
            info: {
                periodeJours: tech.daysCount || 0,
                periodePlage: {
                    debut: chartData.dates?.[0] || null,
                    fin: chartData.dates?.[chartData.dates.length - 1] || null
                },
                clients: tech.clientCount || 0,
                tensionMoyenne: tech.globalAvg || 0,
                tensionMin: tech.globalMin || 0,
                tensionMax: tech.globalMax || 0,
                energieMax: {
                    valeur: this.getMaxEnergy(energy),
                    date: this.getMaxEnergyDate(energy)
                },
                energieMoyenne: this.getAvgEnergy(energy)
            },
            
            conformite: {
                totalJours: conformity.totalJours || 0,
                joursConformes: conformity.conformes || 0,
                pourcentageConformes: conformity.pourcentage || 0,
                joursNonConformes: (conformity.totalJours || 0) - (conformity.conformes || 0),
                seuils: {
                    min: voltageNorms.min,
                    max: voltageNorms.max
                },
                causes: {
                    surtension: {
                        count: conformity.causes?.max?.length || 0,
                        jours: causesMax
                    },
                    sousTension: {
                        count: conformity.causes?.min?.length || 0,
                        jours: causesMin
                    },
                    variation: {
                        count: conformity.causes?.variation?.length || 0,
                        jours: causesVariation
                    }
                }
            },
            
            normes: {
                systeme: normSystem,
                min: voltageNorms.min,
                max: voltageNorms.max,
                ideal: voltageNorms.ideal,
                alert: voltageNorms.alert
            },
            
            delestages: this.buildLoadSheddingData(tech.loadShedding),
            hauteTension: this.buildHighVoltageData(tech.highVoltage || [], hourlyPeakData),
            tensionsJournalieres: {
                dates: chartData.dates || [],
                min: chartData.mins || [],
                max: chartData.maxs || [],
                moyenne: chartData.avgs || []
            },
            consommations: {
                parJour: energy.parDate || {},
                parClient: energy.parClient || {},
                clients: Object.keys(energy.parClient || {}).length
            },
            distributionKits: {
                totalJours: totalJours,
                kits: kitDistribution.slice(0, stopIndex),
                complet: stopIndex < seuils.length ? false : true,
                dernierKitAtteint: stopIndex < seuils.length ? seuils[stopIndex - 1]?.label : null
            },
            
            graphiques: {
                tensionsHoraires: {
                    description: "Tensions mesurées toutes les heures",
                    donnees: hourlyTensionData,
                    totalPoints: hourlyTensionData.length
                },
                intensitesHoraires: {
                    description: "Intensités mesurées toutes les heures",
                    donnees: hourlyIntensiteData,
                    totalPoints: hourlyIntensiteData.length
                },
                cycleConsommation: {
                    description: "Consommation cumulée par jour et moyennes horaires",
                    consommationHoraire: hourlyConsumptionData.horaire,
                    consommationCumulee: hourlyConsumptionData.cumulee,
                    moyennesHoraires: hourlyConsumptionData.moyennes,
                    stats: hourlyConsumptionData.stats
                },
                consommationClient: {
                    description: "Consommation totale du site par jour",
                    journalier: clientTrendData.journalier,
                    stats: clientTrendData.stats,
                    distributionKits: clientTrendData.distributionKits
                },
                hauteTensionEvolution: {
                    description: "Nombre de dépassements de tension haute par jour",
                    dates: (tech.highVoltage || []).map(d => d.date),
                    counts: (tech.highVoltage || []).map(d => d.count)
                }
            }
        };
    }
    
    getMaxEnergy(energy) {
        const entries = Object.entries(energy.parDate || {});
        if (entries.length === 0) return 0;
        return Math.max(...entries.map(([_, d]) => d.total || 0));
    }
    
    getMaxEnergyDate(energy) {
        const entries = Object.entries(energy.parDate || {});
        if (entries.length === 0) return null;
        let maxEntry = entries[0];
        entries.forEach(([date, d]) => {
            if (d.total > maxEntry[1].total) maxEntry = [date, d];
        });
        return maxEntry[0];
    }
    
    getAvgEnergy(energy) {
        const entries = Object.entries(energy.parDate || {});
        if (entries.length === 0) return 0;
        const values = entries.map(([_, d]) => d.total || 0);
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
    
    getHourlyTensionData(tables) {
        const tensionTable = tables.find(t => t.type === 'T');
        const data = [];
        
        if (tensionTable) {
            tensionTable.data.forEach(row => {
                const cells = row.split(';');
                const timestamp = cells[1];
                const tension = parseFloat(cells[4]);
                if (timestamp && !isNaN(tension)) {
                    data.push({
                        timestamp: timestamp,
                        date: timestamp.split(' ')[0],
                        hour: timestamp.split(' ')[1]?.substring(0, 5),
                        tension: tension
                    });
                }
            });
        }
        return data;
    }
    
    getHourlyIntensiteData(tables) {
        const intensiteTable = tables.find(t => t.type === 'I');
        const data = [];
        
        if (intensiteTable) {
            intensiteTable.data.forEach(row => {
                const cells = row.split(';');
                const timestamp = cells[1];
                const intensite = parseFloat(cells[4]);
                if (timestamp && !isNaN(intensite)) {
                    data.push({
                        timestamp: timestamp,
                        date: timestamp.split(' ')[0],
                        hour: timestamp.split(' ')[1]?.substring(0, 5),
                        intensite: intensite
                    });
                }
            });
        }
        return data;
    }
    
    getHourlyPeakData(tables) {
        const hourlyData = {};
        const tensionTable = tables.find(t => t.type === 'T');
        
        if (tensionTable) {
            tensionTable.data.forEach(row => {
                const cells = row.split(';');
                const timestamp = cells[1];
                const tension = parseFloat(cells[4]);
                if (timestamp && !isNaN(tension)) {
                    const date = timestamp.split(' ')[0];
                    const hour = timestamp.split(' ')[1]?.substring(0, 5);
                    if (!hourlyData[date]) {
                        hourlyData[date] = { maxTension: 0, hourAtMax: '—' };
                    }
                    if (tension > hourlyData[date].maxTension) {
                        hourlyData[date].maxTension = tension;
                        hourlyData[date].hourAtMax = hour;
                    }
                }
            });
        }
        return hourlyData;
    }
    
    getHourlyConsumptionData() {
        const energyData = this.db.energyData;
        const result = {
            horaire: [],
            cumulee: [],
            moyennes: [],
            stats: {
                totalJours: 0,
                totalPoints: 0,
                moyenneGenerale: 0,
                moyenneJour: 0,
                moyenneNuit: 0
            }
        };
        
        if (!energyData?.data?.length) return result;
        
        const dateMap = new Map();
        energyData.data.forEach(point => {
            if (!point.timestamp || !point.energie) return;
            const match = point.timestamp.match(/\d{4}-\d{2}-\d{2} (\d{2}):\d{2}:\d{2}/);
            if (!match) return;
            const hour = parseInt(match[1]);
            const date = point.date;
            
            if (!dateMap.has(date)) dateMap.set(date, new Map());
            const hourMap = dateMap.get(date);
            hourMap.set(hour, (hourMap.get(hour) || 0) + point.energie);
        });
        
        const allDates = Array.from(dateMap.keys()).sort();
        const moyennesHoraires = Array(24).fill(0).map(() => ({ sum: 0, count: 0, avg: 0 }));
        
        allDates.forEach(date => {
            const hourMap = dateMap.get(date);
            let cumul = 0;
            
            for (let h = 0; h < 24; h++) {
                const value = hourMap.get(h) || 0;
                cumul += value;
                
                result.horaire.push({
                    date: date,
                    hour: h,
                    label: h + 'h',
                    valeur: value
                });
                
                result.cumulee.push({
                    date: date,
                    hour: h,
                    label: h + 'h',
                    cumul: cumul
                });
                
                moyennesHoraires[h].sum += value;
                moyennesHoraires[h].count++;
            }
        });
        
        for (let h = 0; h < 24; h++) {
            const avg = moyennesHoraires[h].count > 0 ? moyennesHoraires[h].sum / moyennesHoraires[h].count : 0;
            result.moyennes.push({
                hour: h,
                label: h + 'h',
                moyenne: avg,
                nombrePoints: moyennesHoraires[h].count
            });
        }
        
        const jourMoyenne = result.moyennes.filter(h => h.hour >= 6 && h.hour <= 17)
            .reduce((sum, h) => sum + h.moyenne, 0) / 12;
        const nuitMoyenne = result.moyennes.filter(h => h.hour >= 18 || h.hour <= 5)
            .reduce((sum, h) => sum + h.moyenne, 0) / 12;
        
        result.stats = {
            totalJours: allDates.length,
            totalPoints: result.horaire.length,
            moyenneGenerale: result.moyennes.reduce((sum, h) => sum + h.moyenne, 0) / 24,
            moyenneJour: jourMoyenne,
            moyenneNuit: nuitMoyenne
        };
        
        return result;
    }
    
    getClientTrendData(energyData) {
        const result = {
            journalier: [],
            stats: {
                totalJours: 0,
                max: 0,
                min: 0,
                moyenne: 0,
                percentile95: 0
            },
            distributionKits: {
                complete: [],
                dernierKitAtteint: null
            }
        };
        
        if (!energyData?.parDate) return result;
        
        const dailyValues = Object.entries(energyData.parDate)
            .map(([date, data]) => ({
                date: date,
                consommation: data.total || 0
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const valeurs = dailyValues.map(d => d.consommation);
        const totalJours = valeurs.length;
        
        if (totalJours === 0) return result;
        
        result.journalier = dailyValues;
        result.stats = {
            totalJours: totalJours,
            max: Math.max(...valeurs),
            min: Math.min(...valeurs),
            moyenne: valeurs.reduce((a, b) => a + b, 0) / totalJours,
            percentile95: this.calculatePercentile(valeurs, 95)
        };
        
        const seuils = [
            { label: 'Kit 0', max: 250 },
            { label: 'Kit 1', max: 360 },
            { label: 'Kit 2', max: 540 },
            { label: 'Kit 3', max: 720 },
            { label: 'Kit 4', max: 1080 }
        ];
        
        const distribution = [];
        let stopIndex = seuils.length;
        
        for (let i = 0; i < seuils.length; i++) {
            const seuil = seuils[i];
            const joursCouverts = valeurs.filter(v => v <= seuil.max).length;
            const pourcentage = (joursCouverts / totalJours) * 100;
            
            distribution.push({
                label: seuil.label,
                max: seuil.max,
                jours: joursCouverts,
                percentage: pourcentage
            });
            
            if (pourcentage >= 99.9 && stopIndex === seuils.length) {
                stopIndex = i + 1;
            }
        }
        
        result.distributionKits = {
            complete: distribution.slice(0, stopIndex),
            dernierKitAtteint: stopIndex < seuils.length ? seuils[stopIndex - 1]?.label : null
        };
        
        return result;
    }
    
    calculatePercentile(values, p) {
        if (!values.length) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.min(index, sorted.length - 1)];
    }
    
    buildLoadSheddingData(loadShedding) {
        const data = loadShedding || { partiel: 0, total: 0, jours: [], parDate: {} };
        const enrichedParDate = {};
        
        Object.entries(data.parDate || {}).forEach(([date, dayData]) => {
            const heures = (dayData.evenements || []).map(e => {
                const parts = e.time.split(':');
                return parts[0] + 'h' + parts[1];
            }).sort();
            
            enrichedParDate[date] = {
                partiel: dayData.partiel || 0,
                total: dayData.total || 0,
                evenements: dayData.evenements || [],
                heures: heures
            };
        });
        
        return {
            partiel: data.partiel || 0,
            total: data.total || 0,
            joursTouches: data.jours || [],
            totalEvenements: (data.partiel || 0) + (data.total || 0),
            details: enrichedParDate
        };
    }
    
    buildHighVoltageData(hvData, hourlyData) {
        return (hvData || []).map(d => ({
            date: d.date,
            count: d.count,
            qualite: d.qualite,
            heurePic: hourlyData[d.date]?.hourAtMax || '—',
            tensionPic: hourlyData[d.date]?.maxTension || null
        }));
    }
    
    // ==================== COMMERCIAL DASHBOARD ====================
    
    exportCommercial() {
        const data = this.buildCommercialData();
        this.saveFile(data, 'commercial');
    }
    
    buildCommercialData() {
        const commercial = this.db.commercialData || {};
        const clients = Array.from(commercial.clients?.values() || []);
        
        return {
            metadata: {
                nanoreseau: this.nanoreseauId,
                exportDate: new Date().toISOString(),
                type: 'commercial',
                totalClients: clients.length
            },
            clients: clients.map(client => this.buildClientData(client))
        };
    }
    
    buildClientData(client) {
        const consoJournaliere = client.consommation?.journaliere || [];
        const credits = client.credits || [];
        const recharges = client.recharges || [];
        const events = client.events || [];
        const zeroCreditDates = client.zeroCreditDates || [];
        const forfaitChanges = client.forfaitChanges || [];
        
        const isGhost = this.isGhostClient(client);
        const forfaitHistory = this.buildForfaitHistory(client, consoJournaliere, forfaitChanges);
        const forfaitStats = this.buildForfaitStats(forfaitHistory, consoJournaliere, events);
        const eventsData = this.buildEventsData(events, zeroCreditDates, consoJournaliere.length);
        const creditData = this.buildCreditData(credits, recharges, zeroCreditDates);
        
        return {
            id: client.id,
            estFantome: isGhost,
            forfaitActuel: {
                nom: client.forfaitName || 'ECO',
                code: client.forfaitActuel || 1
            },
            historiqueForfaits: forfaitHistory,
            forfaitStats: forfaitStats,
            consommation: {
                journaliere: consoJournaliere,
                totalJours: consoJournaliere.length,
                joursAvecConso: consoJournaliere.filter(d => d.valeur > 0).length
            },
            evenements: eventsData,
            credit: creditData
        };
    }
    
    isGhostClient(client) {
        const aDesRecharges = (client.recharges?.length > 0);
        const aDesConso = (client.consommation?.journaliere?.length > 0);
        const aDesEvents = (client.events?.length > 0);
        const aDesCredits = (client.credits?.length > 0);
        
        if (!aDesRecharges && !aDesConso && !aDesEvents && !aDesCredits) return true;
        
        const consoToutesNulles = (client.consommation?.journaliere?.every(c => c.valeur === 0) ?? true);
        const creditsTousNuls = (client.credits?.every(c => c.value === 0) ?? true);
        
        return (aDesConso && consoToutesNulles) || (aDesCredits && creditsTousNuls);
    }
    
    buildForfaitHistory(client, consoJournaliere, forfaitChanges) {
        const history = [];
        const premiereDate = consoJournaliere.length > 0 ? consoJournaliere[0].date : '2024-01-01';
        
        if (forfaitChanges.length === 0) {
            history.push({
                forfait: client.forfaitName || 'ECO',
                code: client.forfaitActuel || 1,
                startDate: premiereDate,
                endDate: null,
                isCurrent: true
            });
        } else {
            const sortedChanges = [...forfaitChanges].sort((a, b) => new Date(a.date) - new Date(b.date));
            
            history.push({
                forfait: FORFAIT_NAMES?.[sortedChanges[0].ancien] || `Forfait ${sortedChanges[0].ancien}`,
                code: sortedChanges[0].ancien,
                startDate: premiereDate,
                endDate: sortedChanges[0].date,
                isCurrent: false
            });
            
            for (let i = 0; i < sortedChanges.length; i++) {
                const change = sortedChanges[i];
                const nextChange = sortedChanges[i + 1];
                history.push({
                    forfait: FORFAIT_NAMES?.[change.nouveau] || `Forfait ${change.nouveau}`,
                    code: change.nouveau,
                    startDate: change.date,
                    endDate: nextChange ? nextChange.date : null,
                    isCurrent: !nextChange
                });
            }
        }
        
        return history;
    }
    
    buildForfaitStats(forfaitHistory, consoJournaliere, events) {
        const suspendEDates = new Set();
        events.forEach(e => {
            if (e.type === 'SuspendE' && e.date) {
                suspendEDates.add(e.date.split('T')[0]);
            }
        });
        
        return forfaitHistory.map((forfait, index, array) => {
            const forfaitMax = FORFAIT_LIMITS?.[forfait.forfait]?.max || 100;
            const seuil85 = forfaitMax * 0.85;
            const seuil115 = forfaitMax * 1.15;
            
            const allDaysInPeriod = [];
            const daysWithConsumption = [];
            
            consoJournaliere.forEach(day => {
                const dayDate = day.date;
                if (!dayDate) return;
                
                let inPeriod = false;
                if (forfait.endDate) {
                    if (dayDate >= forfait.startDate && dayDate <= forfait.endDate) inPeriod = true;
                } else {
                    if (dayDate >= forfait.startDate) inPeriod = true;
                }
                
                if (inPeriod) {
                    allDaysInPeriod.push(day);
                    if (day.valeur > 0) daysWithConsumption.push(day);
                }
            });
            
            const maxEnergy = daysWithConsumption.length > 0 ? Math.max(...daysWithConsumption.map(d => d.valeur)) : 0;
            const avgEnergy = daysWithConsumption.length > 0 
                ? daysWithConsumption.reduce((sum, d) => sum + d.valeur, 0) / daysWithConsumption.length : 0;
            
            const daysBelow85 = daysWithConsumption.filter(d => d.valeur <= seuil85).length;
            const daysInTolerance = daysWithConsumption.filter(d => d.valeur > seuil85 && d.valeur <= seuil115).length;
            const daysAbove115 = daysWithConsumption.filter(d => {
                const dateStr = d.date.split('T')[0];
                return d.valeur > seuil115 || suspendEDates.has(dateStr);
            }).length;
            
            return {
                forfait: forfait.forfait,
                code: forfait.code,
                startDate: forfait.startDate,
                endDate: forfait.endDate,
                isCurrent: forfait.isCurrent,
                totalJours: allDaysInPeriod.length,
                joursAvecConso: daysWithConsumption.length,
                joursSansConso: allDaysInPeriod.length - daysWithConsumption.length,
                maxEnergy: maxEnergy,
                avgEnergy: avgEnergy,
                seuils: {
                    max: forfaitMax,
                    seuil85: seuil85,
                    seuil115: seuil115
                },
                repartition: {
                    below85: { count: daysBelow85, percent: daysWithConsumption.length > 0 ? (daysBelow85 / daysWithConsumption.length) * 100 : 0 },
                    tolerance: { count: daysInTolerance, percent: daysWithConsumption.length > 0 ? (daysInTolerance / daysWithConsumption.length) * 100 : 0 },
                    above115: { count: daysAbove115, percent: daysWithConsumption.length > 0 ? (daysAbove115 / daysWithConsumption.length) * 100 : 0 }
                }
            };
        });
    }
    
    buildEventsData(events, zeroCreditDates, totalDays) {
        const eventsByDay = new Map();
        
        events.forEach(event => {
            if (!event.date) return;
            const dateStr = event.date.split('T')[0];
            const hour = event.date.includes('T') ? event.date.split('T')[1]?.substring(0, 5) : '';
            
            if (!eventsByDay.has(dateStr)) {
                eventsByDay.set(dateStr, {
                    date: dateStr,
                    SuspendE: 0,
                    SuspendE_start: '',
                    SuspendE_end: '',
                    SuspendP: 0,
                    SuspendP_start: '',
                    SuspendP_end: '',
                    CreditNul: 0
                });
            }
            
            const dayData = eventsByDay.get(dateStr);
            
            if (event.type === 'SuspendE') {
                dayData.SuspendE++;
                if (!dayData.SuspendE_start) dayData.SuspendE_start = hour;
                dayData.SuspendE_end = hour;
            }
            
            if (event.type === 'SuspendP') {
                dayData.SuspendP++;
                if (!dayData.SuspendP_start) dayData.SuspendP_start = hour;
                dayData.SuspendP_end = hour;
            }
        });
        
        zeroCreditDates.forEach(date => {
            const dateStr = date.split('T')[0];
            if (!eventsByDay.has(dateStr)) {
                eventsByDay.set(dateStr, {
                    date: dateStr,
                    SuspendE: 0,
                    SuspendE_start: '',
                    SuspendE_end: '',
                    SuspendP: 0,
                    SuspendP_start: '',
                    SuspendP_end: '',
                    CreditNul: 1
                });
            } else {
                eventsByDay.get(dateStr).CreditNul = 1;
            }
        });
        
        const daysWithCreditNul = new Set();
        const daysWithSuspendP = new Set();
        const daysWithSuspendE = new Set();
        
        eventsByDay.forEach(day => {
            if (day.CreditNul > 0) daysWithCreditNul.add(day.date);
            if (day.SuspendP > 0) daysWithSuspendP.add(day.date);
            if (day.SuspendE > 0) daysWithSuspendE.add(day.date);
        });
        
        return {
            totalJours: totalDays,
            joursAvecCreditNul: daysWithCreditNul.size,
            joursAvecSuspendP: daysWithSuspendP.size,
            joursAvecSuspendE: daysWithSuspendE.size,
            pourcentages: {
                creditNul: totalDays > 0 ? (daysWithCreditNul.size / totalDays) * 100 : 0,
                suspendP: totalDays > 0 ? (daysWithSuspendP.size / totalDays) * 100 : 0,
                suspendE: totalDays > 0 ? (daysWithSuspendE.size / totalDays) * 100 : 0
            },
            details: Array.from(eventsByDay.values()).sort((a, b) => new Date(b.date) - new Date(a.date))
        };
    }
    
    buildCreditData(credits, recharges, zeroCreditDates) {
        const creditByDate = new Map();
        
        credits.forEach(c => {
            if (c.date) {
                const dateStr = c.date.split('T')[0];
                creditByDate.set(dateStr, c.value || 0);
            }
        });
        
        zeroCreditDates.forEach(date => {
            const dateStr = date.split('T')[0];
            creditByDate.set(dateStr, 0);
        });
        
        const sortedCredits = Array.from(creditByDate.entries())
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const consecutiveGroups = [];
        let currentGroup = [];
        
        sortedCredits.forEach((record, index) => {
            if (record.value === 0) {
                if (index === 0 || sortedCredits[index - 1].value !== 0) {
                    if (currentGroup.length > 1) consecutiveGroups.push([...currentGroup]);
                    currentGroup = [record];
                } else {
                    currentGroup.push(record);
                }
            }
        });
        if (currentGroup.length > 1) consecutiveGroups.push(currentGroup);
        
        const purchaseDays = (recharges || [])
            .filter(r => r.credit && r.credit > 0)
            .map(r => ({
                date: r.date,
                days: r.credit,
                status: r.status || 'Réussie'
            }));
        
        const daysCountMap = new Map();
        purchaseDays.forEach(item => {
            daysCountMap.set(item.days, (daysCountMap.get(item.days) || 0) + 1);
        });
        
        const sortedDays = Array.from(daysCountMap.entries()).sort((a, b) => b[0] - a[0]);
        const total = purchaseDays.length;
        
        const intervals = {
            jours: purchaseDays.filter(p => p.days >= 1 && p.days <= 6).length,
            semaine: purchaseDays.filter(p => p.days >= 7 && p.days <= 28).length,
            mois: purchaseDays.filter(p => p.days >= 29).length
        };
        
        return {
            historiqueCredits: credits,
            historiqueRecharges: recharges,
            joursSansCredit: zeroCreditDates.length,
            seriesSansCredit: consecutiveGroups.map(group => ({
                debut: group[0].date,
                fin: group[group.length - 1].date,
                duree: group.length
            })),
            habitudesRecharge: {
                totalRecharges: recharges?.length || 0,
                rechargesReussies: purchaseDays.length,
                details: purchaseDays,
                repartitionParDuree: sortedDays.map(([days, count]) => ({
                    jours: days,
                    count: count,
                    percentage: total > 0 ? (count / total) * 100 : 0
                })),
                repartitionParIntervalle: {
                    jours: { count: intervals.jours, percentage: total > 0 ? (intervals.jours / total) * 100 : 0 },
                    semaine: { count: intervals.semaine, percentage: total > 0 ? (intervals.semaine / total) * 100 : 0 },
                    mois: { count: intervals.mois, percentage: total > 0 ? (intervals.mois / total) * 100 : 0 }
                }
            }
        };
    }
    
    // ==================== SAUVEGARDE DES FICHIERS ====================
    
    saveFile(data, type) {
        const jsonStr = JSON.stringify(data, null, 2);
        const csvStr = this.jsonToCSV(data);
        const filename = `NANORESEAU_${this.nanoreseauId}_${type}_${this.timestamp}`;
        
        if (window.electronAPI && window.electronAPI.saveFile) {
            window.electronAPI.saveFile({ content: jsonStr, filename: filename + '.json' });
            window.electronAPI.saveFile({ content: csvStr, filename: filename + '.csv' });
        } else {
            this.downloadBlob(jsonStr, filename + '.json', 'application/json');
            this.downloadBlob(csvStr, filename + '.csv', 'text/csv');
        }
    }
    
    jsonToCSV(json) {
        const rows = [];
        rows.push('# ' + json.metadata.type.toUpperCase() + ' DASHBOARD');
        rows.push('# NANORÉSEAU: ' + json.metadata.nanoreseau);
        rows.push('# Export: ' + json.metadata.exportDate);
        rows.push('');
        
        const flatten = function(obj, prefix, rowsArray) {
            for (const [key, value] of Object.entries(obj)) {
                if (key === 'metadata') continue;
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    flatten(value, prefix ? prefix + '.' + key : key, rowsArray);
                } else if (Array.isArray(value)) {
                    rowsArray.push((prefix ? prefix + '.' : '') + key + ',' + JSON.stringify(value));
                } else {
                    rowsArray.push((prefix ? prefix + '.' : '') + key + ',' + value);
                }
            }
        };
        
        flatten(json, '', rows);
        return rows.join('\n');
    }
    
    downloadBlob(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// ===========================================
// GESTIONNAIRE PRINCIPAL D'IMPORT
// ===========================================

async function handleFileSelect() {
    const file = fileInput.files[0];
    if (!file) return;

    fileName.textContent = `📄 ${file.name}`;
    showLoader();
    simulateProgress();

    try {
        const content = await readFileAsync(file);

        const nanoreseauMatch = content.match(/<#NANORESEAU:(\d+)>/);
        if (!nanoreseauMatch) {
            showError('Numéro NANORESEAU non trouvé');
            return;
        }
        nanoreseauValue.textContent = nanoreseauMatch[1];

        // 1. Parser les tables brutes
        const rawTables = parseRawTables(content);
        
        // 2. STOCKER LES TABLES BRUTES
        database.rawTables = JSON.parse(JSON.stringify(rawTables));
        
        // 3. Appliquer le filtre par défaut
        const tablesToUse = filterTablesByDate(rawTables, currentFilter);
        
        // 4. Build database avec les tables filtrées
        buildDatabase(tablesToUse);
        
        // 5. Analyses
        console.log("🚀 Lancement des analyses...");
        
        buildEventMap();
        const eventCount = database.eventMap.size;
        console.log(`✅ Étape 1/5 : ${eventCount} événements chargés`);
        
        analyzeTechnicalData();
        const hasTechData = database.technicalData && database.technicalData.daysCount > 0;
        console.log(`✅ Étape 2/5 : Analyse technique - ${hasTechData ? database.technicalData.daysCount + ' jours' : 'INCOMPLÈTE'}`);
        
        analyzeEnergyData();
        const energyClients = Object.keys(database.energyData?.parClient || {}).length;
        console.log(`✅ Étape 3/5 : Analyse énergie - ${energyClients} clients ou 0 si incomplète`);
        
        analyzeCommercialData();
        const commercialClients = database.commercialData?.clients?.size || 0;
        console.log(`✅ Étape 4/5 : Analyse commerciale - ${commercialClients} clients analysés`);
        
        const energyLinked = linkEnergyToCommercial();
        if (!energyLinked && energyClients > 0) {
            console.warn("⚠️ Attention : données énergétiques perte lors de la liaison");
        } else if (energyClients === 0) {
            console.log("ℹ️ Aucune donnée énergétique à lier (normal si tables T/I manquent)");
        }
        console.log(`✅ Étape 5/5 : Liaison énergie-clients - ${energyLinked ? 'Réussie' : 'N/A'}`);
        
        renderByTab();
        
        document.getElementById('infoSection').classList.add('show');
        hideError();
        
        // ===== ✅ EXPORT AUTOMATIQUE APRÈS ANALYSES =====
        const exporter = new DashboardExporter(database, nanoreseauMatch[1]);
        exporter.exportAll();
        console.log("📁 Fichiers exportés générés");
        
        console.log("✅ ==========================================");
        console.log("✅ TOUTES LES ANALYSES TERMINÉES AVEC SUCCÈS");
        console.log("✅ ==========================================");

    } catch (err) {
        showError('Erreur lors de l\'analyse: ' + err.message);
        console.error(err);
    } finally {
        hideLoader();
    }
}

// ===========================================
// ÉVÉNEMENTS D'IMPORT (Conditionnels)
// ===========================================

// Vérifier si les éléments existent dans le DOM
if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
} else {
    console.log("ℹ️ fileInput non trouvé (page d'analyse probablement)");
}

if (uploadSection) {
    uploadSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadSection.classList.add('dragover');
    });

    uploadSection.addEventListener('dragleave', () => {
        uploadSection.classList.remove('dragover');
    });

    uploadSection.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadSection.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect();
        }
    });
} else {
    console.log("ℹ️ uploadSection non trouvé (page d'analyse probablement)");
}

// ===========================================
// FONCTION POUR RÉINITIALISER LE FILTRE
// ===========================================

function resetFilterToAll() {
    currentFilter = {
        period: 'all',
        startDate: null,
        endDate: null,
        month: null,
        year: null
    };
    
    if (window.updateFilterUI) {
        window.updateFilterUI('all');
    }
    
    if (database.rawTables && database.rawTables.length > 0) {
        const tablesToUse = filterTablesByDate(database.rawTables, currentFilter);
        buildDatabase(tablesToUse);
        
        buildEventMap();
        analyzeTechnicalData();
        analyzeEnergyData();
        analyzeCommercialData();
        linkEnergyToCommercial();
        
        console.log("✅ Filtre réinitialisé à 'all'");
    }
}

// ===========================================
// GESTION DES ONGLETS AVEC RÉINITIALISATION
// ===========================================

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        resetFilterToAll();
        
        renderByTab();
        
        document.getElementById('tablesContainer').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    });
});

// ===========================================
// HELPER POUR RE-RENDU
// ===========================================

window.refreshCurrentTab = function() {
    renderByTab();
};

console.log("✅ ArduinoMain initialisé - Prêt pour l'import");

// ===========================================
// FONCTION DE FILTRAGE
// ===========================================

export function applyFilter(newFilter) {
    const originalPeriod = newFilter.period;
    let filterForData = { ...newFilter };
    let lastAvailableDate = new Date();
    
    if (database.technicalData?.dailyStats) {
        const availableDates = Object.keys(database.technicalData.dailyStats).sort();
        if (availableDates.length > 0) {
            lastAvailableDate = new Date(availableDates[availableDates.length - 1]);
        }
    }
    
    let startDate = null;
    let endDate = null;
    
    if (newFilter.period && newFilter.period !== 'all') {
        endDate = new Date(lastAvailableDate);
        startDate = new Date(lastAvailableDate);
        
        switch(newFilter.period) {
            case '7days':
                startDate.setDate(lastAvailableDate.getDate() - 7 + 1);
                break;
            case '15days':
                startDate.setDate(lastAvailableDate.getDate() - 15 + 1);
                break;
            case '30days':
                startDate.setDate(lastAvailableDate.getDate() - 30 + 1);
                break;
            case '2months':
                startDate.setMonth(lastAvailableDate.getMonth() - 2);
                startDate.setDate(startDate.getDate() + 1);
                break;
            case '3months':
                startDate.setMonth(lastAvailableDate.getMonth() - 3);
                startDate.setDate(startDate.getDate() + 1);
                break;
            case '6months':
                startDate.setMonth(lastAvailableDate.getMonth() - 6);
                startDate.setDate(startDate.getDate() + 1);
                break;
            case '1year':
                startDate.setFullYear(lastAvailableDate.getFullYear() - 1);
                startDate.setDate(startDate.getDate() + 1);
                break;
        }
        
        filterForData = {
            period: null,
            startDate: startDate,
            endDate: endDate,
            month: null,
            year: null
        };
    }
    
    currentFilter = {
        period: originalPeriod,
        startDate: filterForData.startDate || newFilter.startDate,
        endDate: filterForData.endDate || newFilter.endDate,
        month: newFilter.month,
        year: newFilter.year
    };
    
    console.log('✅ Filtre stocké:', {
        period: currentFilter.period,
        startDate: currentFilter.startDate?.toLocaleDateString(),
        endDate: currentFilter.endDate?.toLocaleDateString()
    });
    
    if (!database.rawTables || database.rawTables.length === 0) {
        console.warn("Pas de données brutes disponibles");
        return;
    }
    
    showLoader();
    
    setTimeout(() => {
        const filteredTables = filterTablesByDate(database.rawTables, filterForData);
        buildDatabase(filteredTables);
        
        buildEventMap();
        analyzeTechnicalData();
        analyzeEnergyData();
        analyzeCommercialData();
        linkEnergyToCommercial();
        
        renderByTab();
        
        setTimeout(() => {
            if (window.refreshFilterUI) {
                window.refreshFilterUI();
            }
        }, 50);
        
        hideLoader();
    }, 50);
}

// ===========================================
// FONCTION DE FILTRAGE PAR DATE 
// ===========================================
function filterTablesByDate(tables, filter) {
    if (!filter.startDate && !filter.endDate && !filter.month && !filter.year) {
        return tables;
    }
    
    const filteredTables = JSON.parse(JSON.stringify(tables));
    
    filteredTables.forEach(table => {
        if (table.type === 'T' || table.type === 'I' || table.type === 'E') {
            const originalCount = table.data.length;
            
            table.data = table.data.filter(row => {
                const cells = row.split(';');
                const timestamp = cells[1];
                if (!timestamp) return false;
                
                const dateStr = timestamp.split(' ')[0];
                const rowDate = new Date(dateStr);
                rowDate.setHours(0, 0, 0, 0);
                
                if (filter.startDate) {
                    const start = new Date(filter.startDate);
                    start.setHours(0, 0, 0, 0);
                    if (rowDate < start) return false;
                }
                
                if (filter.endDate) {
                    const end = new Date(filter.endDate);
                    end.setHours(0, 0, 0, 0);
                    if (rowDate > end) return false;
                }
                
                if (filter.month && filter.year) {
                    if (rowDate.getMonth() + 1 !== filter.month || 
                        rowDate.getFullYear() !== filter.year) return false;
                } else if (filter.year && !filter.month) {
                    if (rowDate.getFullYear() !== filter.year) return false;
                }
                
                return true;
            });
            
            if (originalCount !== table.data.length) {
                console.log(`Table ${table.type}: ${originalCount} → ${table.data.length} lignes`);
            }
        }
    });
    
    return filteredTables;
}

// ============================================
// ADAPTATEUR D'AFFICHAGE - DÉTECTION AUTO
// ============================================

(function() {
    function detectPlatform() {
        const ua = navigator.userAgent;
        const isElectron = navigator.userAgent.includes('Electron');
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua) && !isMobile;
        
        document.body.classList.remove('platform-web', 'platform-electron', 'platform-tablet', 'platform-mobile');
        
        if (isElectron) {
            document.body.classList.add('platform-electron');
        } else if (isTablet) {
            document.body.classList.add('platform-tablet');
        } else if (isMobile) {
            document.body.classList.add('platform-mobile');
        } else {
            document.body.classList.add('platform-web');
        }
    }
    
    function detectOrientation() {
        const isPortrait = window.innerHeight > window.innerWidth;
        document.body.classList.toggle('orientation-portrait', isPortrait);
        document.body.classList.toggle('orientation-landscape', !isPortrait);
    }
    
    window.addEventListener('resize', detectOrientation);
    window.addEventListener('orientationchange', detectOrientation);
    
    if (window.electronAPI) {
        document.body.classList.add('electron-app');
    }
    
    detectPlatform();
    detectOrientation();
    
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('dark-mode');
    }
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (e.matches) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    });
    
    console.log(`📱 Plateforme détectée: ${document.body.className}`);
})();

// ===========================================
// FONCTION POUR ANALYSER UN CONTENU TEXTE (pour analyzeFile.html)
// ===========================================

export async function analyzeFromContent(content, nrValue = null) {
    try {
        showLoader();
        simulateProgress();

        const nanoreseauMatch = content.match(/<#NANORESEAU:(\d+)>/);
        if (!nanoreseauMatch && !nrValue) {
            throw new Error('Numéro NANORESEAU non trouvé');
        }
        
        const nrNumber = nrValue || nanoreseauMatch[1];
        if (nanoreseauValue) nanoreseauValue.textContent = nrNumber;

        const rawTables = parseRawTables(content);
        database.rawTables = JSON.parse(JSON.stringify(rawTables));
        
        const tablesToUse = filterTablesByDate(rawTables, currentFilter);
        buildDatabase(tablesToUse);
        
        buildEventMap();
        analyzeTechnicalData();
        analyzeEnergyData();
        analyzeCommercialData();
        linkEnergyToCommercial();
        
        renderByTab();
        
        document.getElementById('infoSection')?.classList.add('show');
        hideError();
        
        console.log("✅ Analyse terminée avec succès");
        return { success: true, nr: nrNumber };
        
    } catch (err) {
        showError('Erreur lors de l\'analyse: ' + err.message);
        console.error(err);
        hideLoader();
        throw err;
    }
}