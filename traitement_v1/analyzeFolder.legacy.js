// Fichier legacy : fonctions déplacées hors de analyzeFolder.js pour raccourcir le code.
// IMPORTANT : ce fichier n'est pas chargé par défaut.
// Si un jour vous avez besoin de restaurer une fonctionnalité supprimée par erreur,
// vous pouvez recopier la fonction concernée dans analyzeFolder.js.

/* eslint-disable */

function analyzeConsumptionWithForfaitHistory(clientNumber) {
    if (!combinedEnergyData || combinedEnergyData.length === 0) {
        return {
            clientNumber: clientNumber,
            hasData: false,
            totalDays: 0,
            daysAbove90Percent: 0,
            daysBelow90Percent: 0,
            daysInTolerance: 0,
            daysAboveTolerance: 0,
            consumptionByForfait: {},
            forfaitHistory: [],
            forfaitComparisons: []
        };
    }
    
    // Récupérer l'historique des forfaits du client (Code 4)
    const forfaitHistory = [];
    if (combinedRechargeData && combinedRechargeData.length > 0) {
        const clientRecharges = combinedRechargeData
            .filter(row => row['Code 1']?.toString().trim() === clientNumber.toString())
            .sort((a, b) => new Date(a['Date et Heure']) - new Date(b['Date et Heure']));
        
        clientRecharges.forEach((recharge, index) => {
            const date = new Date(recharge['Date et Heure']);
            const code4 = parseInt(recharge['Code 4']);
            const forfaitName = getForfaitName(code4);
            
            if (index === 0) {
                // Premier forfait connu
                forfaitHistory.push({
                    forfait: forfaitName,
                    forfaitCode: code4,
                    startDate: date,
                    endDate: null,
                    isCurrent: true
                });
            } else if (code4 !== parseInt(clientRecharges[index-1]['Code 4'])) {
                // Changement de forfait
                // Clôturer l'ancien forfait
                forfaitHistory[forfaitHistory.length - 1].endDate = date;
                forfaitHistory[forfaitHistory.length - 1].isCurrent = false;
                
                // Ajouter le nouveau forfait
                forfaitHistory.push({
                    forfait: forfaitName,
                    forfaitCode: code4,
                    startDate: date,
                    endDate: null,
                    isCurrent: true
                });
            }
        });
    }
    
    // Si pas d'historique de forfait, on ne peut pas analyser
    if (forfaitHistory.length === 0) {
        return {
            clientNumber: clientNumber,
            hasData: false,
            totalDays: 0,
            daysAbove90Percent: 0,
            daysBelow90Percent: 0,
            daysInTolerance: 0,
            daysAboveTolerance: 0,
            consumptionByForfait: {},
            forfaitHistory: [],
            forfaitComparisons: []
        };
    }
    
    // Analyser la consommation jour par jour
    const consumptionByDay = {};
    const energyKey = `Energie${clientNumber}`;
    
    combinedEnergyData.forEach(row => {
        if (!row['Date et Heure']) return;
        
        const dateTime = new Date(row['Date et Heure']);
        const dateStr = dateTime.toISOString().split('T')[0];
        const value = parseFloat(row[energyKey]) || 0;
        
        if (!consumptionByDay[dateStr]) {
            consumptionByDay[dateStr] = {
                date: dateStr,
                dateObj: dateTime,
                total: 0,
                count: 0
            };
        }
        
        if (value > 0) {
            consumptionByDay[dateStr].total = Math.max(consumptionByDay[dateStr].total, value);
            consumptionByDay[dateStr].count++;
        }
    });
    
    // Pour chaque jour, trouver le forfait applicable
    const daysAnalysis = [];
    let daysAbove90Percent = 0;
    let daysBelow90Percent = 0;
    let daysInTolerance = 0;
    let daysAboveTolerance = 0;
    const consumptionByForfait = {};
    
    Object.values(consumptionByDay).forEach(day => {
        if (day.total === 0) return;
        
        // Trouver le forfait actif ce jour-là
        let activeForfait = null;
        let activeForfaitCode = null;
        for (let i = forfaitHistory.length - 1; i >= 0; i--) {
            const forfait = forfaitHistory[i];
            if (!forfait.startDate) continue;
            
            const startDate = new Date(forfait.startDate);
            startDate.setHours(0, 0, 0, 0);
            
            if (forfait.endDate) {
                const endDate = new Date(forfait.endDate);
                endDate.setHours(23, 59, 59, 999);
                
                if (day.dateObj >= startDate && day.dateObj <= endDate) {
                    activeForfait = forfait.forfait;
                    activeForfaitCode = forfait.forfaitCode;
                    break;
                }
            } else {
                // Forfait actuel (pas de date de fin)
                if (day.dateObj >= startDate) {
                    activeForfait = forfait.forfait;
                    activeForfaitCode = forfait.forfaitCode;
                    break;
                }
            }
        }
        
        if (!activeForfait) return;
        
        // Obtenir les limites du forfait avec tolérance
        const limits = getForfaitLimits(activeForfait);
        if (limits.max === 0) return;
        
        // Calculer les seuils avec tolérance
        const baseMax = limits.max;
        const tolerancePercent = limits.tolerance || 15; // 15% par défaut
        const toleranceValue = baseMax * (tolerancePercent / 100);
        const maxWithTolerance = baseMax + toleranceValue;
        
        // Seuil d'alerte à 90% du max de base (comme avant)
        const alertThreshold = baseMax * 0.9;
        
        // Calculer les pourcentages
        const percentOfBase = (day.total / baseMax) * 100;
        const percentOfTotal = (day.total / maxWithTolerance) * 100;
        
        // Déterminer les statuts
        const isAbove90 = day.total > alertThreshold;
        const isInTolerance = day.total > baseMax && day.total <= maxWithTolerance;
        const isAboveTolerance = day.total > maxWithTolerance;
        
        if (isAbove90) daysAbove90Percent++;
        else daysBelow90Percent++;
        
        if (isInTolerance) daysInTolerance++;
        if (isAboveTolerance) daysAboveTolerance++;
        
        // Stocker par forfait
        if (!consumptionByForfait[activeForfait]) {
            consumptionByForfait[activeForfait] = {
                forfait: activeForfait,
                forfaitCode: activeForfaitCode,
                limits: limits,
                baseMax: baseMax,
                maxWithTolerance: maxWithTolerance,
                tolerancePercent: tolerancePercent,
                totalDays: 0,
                daysAbove90: 0,
                daysInTolerance: 0,
                daysAboveTolerance: 0,
                daysBelow90: 0,
                maxConsumption: 0,
                avgConsumption: 0,
                totalConsumption: 0,
                startDate: day.dateObj,
                endDate: day.dateObj
            };
        }
        
        const stats = consumptionByForfait[activeForfait];
        stats.totalDays++;
        if (isAbove90) stats.daysAbove90++;
        if (isInTolerance) stats.daysInTolerance++;
        if (isAboveTolerance) stats.daysAboveTolerance++;
        stats.maxConsumption = Math.max(stats.maxConsumption, day.total);
        stats.totalConsumption += day.total;
        stats.startDate = new Date(Math.min(stats.startDate, day.dateObj));
        stats.endDate = new Date(Math.max(stats.endDate, day.dateObj));
        
        daysAnalysis.push({
            date: day.date,
            dateObj: day.dateObj,
            consumption: day.total,
            forfait: activeForfait,
            baseMax: baseMax,
            maxWithTolerance: maxWithTolerance,
            percentOfBase: percentOfBase.toFixed(1),
            percentOfTotal: percentOfTotal.toFixed(1),
            isAbove90: isAbove90,
            isInTolerance: isInTolerance,
            isAboveTolerance: isAboveTolerance,
            toleranceUsed: isInTolerance ? ((day.total - baseMax) / toleranceValue * 100).toFixed(1) : 0
        });
    });
    
    // Calculer les moyennes et pourcentages par forfait
    Object.keys(consumptionByForfait).forEach(key => {
        const stats = consumptionByForfait[key];
        stats.avgConsumption = stats.totalDays > 0 ? 
            (stats.totalConsumption / stats.totalDays).toFixed(1) : 0;
        stats.percentAbove90 = stats.totalDays > 0 ? 
            ((stats.daysAbove90 / stats.totalDays) * 100).toFixed(1) : 0;
        stats.percentInTolerance = stats.totalDays > 0 ? 
            ((stats.daysInTolerance / stats.totalDays) * 100).toFixed(1) : 0;
        stats.percentAboveTolerance = stats.totalDays > 0 ? 
            ((stats.daysAboveTolerance / stats.totalDays) * 100).toFixed(1) : 0;
        stats.percentOK = stats.totalDays > 0 ? 
            (((stats.totalDays - stats.daysAbove90) / stats.totalDays) * 100).toFixed(1) : 0;
    });
    
    // ANALYSE COMPARATIVE AVANT/APRÈS CHANGEMENT DE FORFAIT
    const forfaitComparisons = [];
    
    for (let i = 1; i < forfaitHistory.length; i++) {
        const oldForfait = forfaitHistory[i-1];
        const newForfait = forfaitHistory[i];
        
        // Récupérer les stats de consommation pour l'ancien et nouveau forfait
        const oldStats = consumptionByForfait[oldForfait.forfait];
        const newStats = consumptionByForfait[newForfait.forfait];
        
        if (oldStats && newStats) {
            // Calculer les différences
            const diffAbove90 = newStats.percentAbove90 - oldStats.percentAbove90;
            const diffInTolerance = newStats.percentInTolerance - oldStats.percentInTolerance;
            const diffAboveTolerance = newStats.percentAboveTolerance - oldStats.percentAboveTolerance;
            
            // Amélioration = baisse des dépassements de tolérance
            const improvement = diffAboveTolerance < 0;
            const reductionValue = oldStats.percentAboveTolerance - newStats.percentAboveTolerance;
            const percentReduction = oldStats.percentAboveTolerance > 0 ? 
                ((reductionValue / oldStats.percentAboveTolerance) * 100).toFixed(1) : 0;
            
            let status = '';
            let statusColor = '';
            let statusIcon = '';
            
            // Déterminer le statut basé sur les dépassements de tolérance
            if (newStats.percentAboveTolerance === 0) {
                status = '✅ PARFAIT - Plus aucun dépassement de tolérance';
                statusColor = '#22c55e';
                statusIcon = '🎉';
            } else if (improvement) {
                if (reductionValue >= 20) {
                    status = `✅ FORTE AMÉLIORATION - Baisse de ${reductionValue.toFixed(1)} points des dépassements`;
                    statusColor = '#22c55e';
                    statusIcon = '📉';
                } else if (reductionValue >= 10) {
                    status = `🟡 AMÉLIORATION MODÉRÉE - Baisse de ${reductionValue.toFixed(1)} points`;
                    statusColor = '#eab308';
                    statusIcon = '📊';
                } else {
                    status = `🟠 LÉGÈRE AMÉLIORATION - Baisse de ${reductionValue.toFixed(1)} points`;
                    statusColor = '#f97316';
                    statusIcon = '➡️';
                }
            } else if (diffAboveTolerance > 0) {
                if (diffAboveTolerance >= 20) {
                    status = `🔴 FORTE AGGRAVATION - Hausse de ${diffAboveTolerance.toFixed(1)} points des dépassements`;
                    statusColor = '#ef4444';
                    statusIcon = '📈';
                } else if (diffAboveTolerance >= 10) {
                    status = `🟠 AGGRAVATION MODÉRÉE - Hausse de ${diffAboveTolerance.toFixed(1)} points`;
                    statusColor = '#f97316';
                    statusIcon = '⚠️';
                } else {
                    status = `🟡 LÉGÈRE AGGRAVATION - Hausse de ${diffAboveTolerance.toFixed(1)} points`;
                    statusColor = '#eab308';
                    statusIcon = '📊';
                }
            } else {
                status = '⚪ STABLE - Pas de changement significatif';
                statusColor = '#94a3b8';
                statusIcon = '➡️';
            }
            
            // Déterminer si le client est encore problématique
            const stillProblematic = newStats.percentAboveTolerance > 20 || newStats.percentAbove90 > 40;
            
            forfaitComparisons.push({
                oldForfait: oldForfait.forfait,
                newForfait: newForfait.forfait,
                changeDate: newForfait.startDate,
                oldStats: {
                    days: oldStats.totalDays,
                    above90: oldStats.daysAbove90,
                    percentAbove90: oldStats.percentAbove90,
                    inTolerance: oldStats.daysInTolerance,
                    percentInTolerance: oldStats.percentInTolerance,
                    aboveTolerance: oldStats.daysAboveTolerance,
                    percentAboveTolerance: oldStats.percentAboveTolerance,
                    maxConsumption: oldStats.maxConsumption,
                    avgConsumption: oldStats.avgConsumption,
                    baseMax: oldStats.baseMax,
                    maxWithTolerance: oldStats.maxWithTolerance
                },
                newStats: {
                    days: newStats.totalDays,
                    above90: newStats.daysAbove90,
                    percentAbove90: newStats.percentAbove90,
                    inTolerance: newStats.daysInTolerance,
                    percentInTolerance: newStats.percentInTolerance,
                    aboveTolerance: newStats.daysAboveTolerance,
                    percentAboveTolerance: newStats.percentAboveTolerance,
                    maxConsumption: newStats.maxConsumption,
                    avgConsumption: newStats.avgConsumption,
                    baseMax: newStats.baseMax,
                    maxWithTolerance: newStats.maxWithTolerance
                },
                improvement: improvement,
                diffAbove90: diffAbove90.toFixed(1),
                diffInTolerance: diffInTolerance.toFixed(1),
                diffAboveTolerance: diffAboveTolerance.toFixed(1),
                percentReduction: percentReduction,
                status: status,
                statusColor: statusColor,
                statusIcon: statusIcon,
                stillProblematic: stillProblematic
            });
        }
    }
    
    // Analyser la situation actuelle
    const currentForfait = forfaitHistory.find(f => f.isCurrent);
    const currentStats = currentForfait ? consumptionByForfait[currentForfait.forfait] : null;
    
    let currentSituation = '';
    let currentSituationColor = '';
    
    if (currentStats) {
        if (currentStats.percentAboveTolerance === 0) {
            currentSituation = '✅ Excellent - Aucun dépassement de tolérance';
            currentSituationColor = '#22c55e';
        } else if (currentStats.percentAboveTolerance < 10) {
            currentSituation = '🟢 Bon - Moins de 10% de jours au-dessus de la tolérance';
            currentSituationColor = '#22c55e';
        } else if (currentStats.percentAboveTolerance < 20) {
            currentSituation = '🟡 Moyen - Entre 10% et 20% de jours au-dessus de la tolérance';
            currentSituationColor = '#eab308';
        } else if (currentStats.percentAboveTolerance < 30) {
            currentSituation = '🟠 Préoccupant - Entre 20% et 30% de jours au-dessus de la tolérance';
            currentSituationColor = '#f97316';
        } else {
            currentSituation = '🔴 Critique - Plus de 30% de jours au-dessus de la tolérance';
            currentSituationColor = '#ef4444';
        }
    }
    
    return {
        clientNumber: clientNumber,
        hasData: true,
        totalDays: daysAnalysis.length,
        daysAbove90Percent: daysAbove90Percent,
        daysBelow90Percent: daysBelow90Percent,
        daysInTolerance: daysInTolerance,
        daysAboveTolerance: daysAboveTolerance,
        percentAbove90: daysAnalysis.length > 0 ? 
            ((daysAbove90Percent / daysAnalysis.length) * 100).toFixed(1) : 0,
        percentInTolerance: daysAnalysis.length > 0 ? 
            ((daysInTolerance / daysAnalysis.length) * 100).toFixed(1) : 0,
        percentAboveTolerance: daysAnalysis.length > 0 ? 
            ((daysAboveTolerance / daysAnalysis.length) * 100).toFixed(1) : 0,
        consumptionByForfait: consumptionByForfait,
        forfaitHistory: forfaitHistory,
        forfaitComparisons: forfaitComparisons,
        currentForfait: currentForfait,
        currentStats: currentStats,
        currentSituation: currentSituation,
        currentSituationColor: currentSituationColor,
        daysAnalysis: daysAnalysis.sort((a, b) => b.dateObj - a.dateObj).slice(0, 30)
    };
}

function updateHourlyEnergyChartWithDateFilter(selectedDate) {
    const container = document.getElementById('hourly-energy-chart-placeholder');
    if (!container) return;
    
    // Sauvegarder l'état du sélecteur
    const currentSelector = document.getElementById('hourly-energy-date-selector');
    
    // Recréer le graphique avec la date sélectionnée
    container.innerHTML = '';
    if (currentSelector) container.appendChild(currentSelector);
    
    // Recréer le graphique principal
    createHourlyEnergyChart(selectedDate);
    
    // Le graphique des différences sera automatiquement recréé
    // car il est appelé à la fin de createHourlyEnergyChart()
    
    // Mettre à jour la valeur du sélecteur
    const selector = document.getElementById('hourly-energy-date-filter');
    if (selector) {
        selector.value = selectedDate;
    }
}

