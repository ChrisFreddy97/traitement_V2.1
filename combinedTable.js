// combinedTable.js - Version avec graphiques empilés
// Constantes des forfaits pour le coloriage
const FORFAITS = {
    ECO: { max: 50, maxMarge: 57.5, heures: 5 },
    ECLAIRAGE: { max: 90, maxMarge: 103.5, heures: 5 },
    "ECLAIRAGE +": { max: 150, maxMarge: 172.5, heures: 5 },
    MULTIMEDIA: { max: 210, maxMarge: 241.5, heures: 5 },
    "MULTIMEDIA +": { max: 210, maxMarge: 241.5, heures: 5 },
    "ECLAIRAGE PUBLIC": { max: 150, maxMarge: 172.5, heures: 11 },
    CONGEL: { max: 1250, maxMarge: 1437.5, heures: 24 }, 
    PRENIUM: { max: 500, maxMarge: 575, heures: 24 },
    "FREEZER 1": { max: 1000, maxMarge: 1150, heures: 24 },
    "FREEZER 3": { max: 1000, maxMarge: 1150, heures: 24 }
};

// Variables globales pour les graphiques
let energyBarChart = null;
let tensionLineChart = null;
let comparisonChart = null;
let hourlyChart = null;
let hourlyTensionChart = null;

// Fonction pour obtenir les limites d'un forfait
function getForfaitLimits(forfaitName) {
    const forfaitKey = forfaitName?.toUpperCase() || 'ECO';
    return FORFAITS[forfaitKey] || FORFAITS.ECO;
}

// Fonction pour déterminer la couleur en fonction de la valeur et du forfait
function getEnergyColor(value, forfaitName) {
    const limits = getForfaitLimits(forfaitName);
    
    if (!value || value === 0) {
        return 'normal';
    }
    
    if (value > limits.maxMarge) {
        return 'danger';
    }
    
    if (value > limits.max) {
        return 'warning';
    }
    
    if (value > limits.max * 0.7) {
        return 'elevated';
    }
    
    return 'normal';
}

// Fonction pour créer et configurer un graphique Chart.js
function createChart(canvasId, chartType, chartData, chartOptions) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas ${canvasId} non trouvé`);
        return null;
    }
    
    const ctx = canvas.getContext('2d');
    return new Chart(ctx, {
        type: chartType,
        data: chartData,
        options: chartOptions
    });
}

// Fonction pour créer le graphique en barres de l'énergie totale
function createTotalEnergyBarChart(dailyMinMax) {
    const dates = dailyMinMax.map(d => d.date);
    const totalEnergyValues = dailyMinMax.map(d => d.totalEnergyMax);
    
    const data = {
        labels: dates,
        datasets: [{
            label: 'Total Énergie (Wh)',
            data: totalEnergyValues,
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }]
    };
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: 'Énergie Totale par Jour'
            },
            legend: {
                display: true
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Énergie (Wh)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Date'
                }
            }
        }
    };
    
    return createChart('totalEnergyChart', 'bar', data, options);
}

// Fonction pour créer le graphique de comparaison des clients
function createComparisonChart(dailyMinMax, combinedData) {
    const dates = dailyMinMax.map(d => d.date);
    
    const datasets = combinedData.clients.map((client, index) => {
        const colors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)'
        ];
        
        return {
            label: `Client ${client}`,
            data: dailyMinMax.map(d => d.energyMax[client] || 0),
            backgroundColor: colors[index % colors.length],
            borderColor: colors[index % colors.length].replace('0.7', '1'),
            borderWidth: 2,
            fill: false,
            tension: 0.4
        };
    });
    
    const data = {
        labels: dates,
        datasets: datasets
    };
    
    // Trouver la valeur maximale pour fixer l'échelle Y
    const allValues = datasets.flatMap(dataset => dataset.data);
    const maxValue = Math.max(...allValues);
    const yMax = Math.ceil(maxValue * 1.2);
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: 'Comparaison Énergie Clients'
            },
            legend: {
                display: true,
                position: 'top'
            },
            tooltip: {
                mode: 'index',
                intersect: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Énergie (Wh)'
                },
                max: yMax > 0 ? yMax : undefined
            },
            x: {
                title: {
                    display: true,
                    text: 'Date'
                },
                grid: {
                    display: true
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        }
    };
    
    return createChart('comparisonChart', 'line', data, options);
}

// Fonction pour créer le graphique horaire d'énergie
function createHourlyChart(combinedData, selectedDate = null) {
    let dates = combinedData.periods;
    let selectedDateData = selectedDate || dates[0];
    
    // Obtenir les heures (0-23)
    const hours = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}h`);
    
    const datasets = combinedData.clients.map((client, index) => {
        const colors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)'
        ];
        
        const data = hours.map((_, hourIndex) => {
            const clientData = combinedData.energyData[client];
            if (clientData && clientData.hourlyData && clientData.hourlyData[selectedDateData]) {
                const value = clientData.hourlyData[selectedDateData][hourIndex];
                return value !== null && value !== undefined ? value : 0;
            }
            return 0;
        });
        
        return {
            label: `Client ${client}`,
            data: data,
            backgroundColor: colors[index % colors.length].replace('0.7', '0.3'),
            borderColor: colors[index % colors.length].replace('0.7', '1'),
            borderWidth: 2,
            fill: true,
            tension: 0.4
        };
    });
    
    const data = {
        labels: hours,
        datasets: datasets
    };
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${context.parsed.y} Wh`;
                    }
                }
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Énergie (Wh)'
                },
                beginAtZero: true
            },
            x: {
                title: {
                    display: true,
                    text: 'Heures'
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        }
    };
    
    return createChart('hourlyChart', 'line', data, options);
}

// Fonction pour créer le graphique de tension horaire
function createHourlyTensionChart(combinedData, selectedDate = null) {
    let dates = combinedData.periods;
    let selectedDateData = selectedDate || dates[0];
    
    // Obtenir les heures (0-23)
    const hours = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}h`);
    
    // Vérifier si nous avons des données de tension pour la date sélectionnée
    if (!combinedData.tensionData[selectedDateData]) {
        console.warn(`Pas de données de tension pour la date ${selectedDateData}`);
        return null;
    }
    
    const tensionData = hours.map((_, hourIndex) => {
        const value = combinedData.tensionData[selectedDateData][hourIndex];
        return value !== null && value !== undefined ? value : null;
    });
    
    // Calculer les valeurs min et max pour ajuster l'échelle Y
    const validValues = tensionData.filter(v => v !== null && !isNaN(v));
    const minTension = validValues.length > 0 ? Math.min(...validValues) : 0;
    const maxTension = validValues.length > 0 ? Math.max(...validValues) : 0;
    
    // Pour un système 12V/24V, on ajuste l'échelle Y dynamiquement
    let suggestedMin = 0;
    let suggestedMax = 35; // Maximum pour système 24V + marge
    
    // Ajuster en fonction des données réelles
    if (validValues.length > 0) {
        // Si la tension maximale est inférieure à 15V, c'est probablement un système 12V
        if (maxTension < 15) {
            suggestedMax = 15;
        } 
        // Si la tension maximale est entre 15V et 30V, c'est probablement un système 24V
        else if (maxTension < 30) {
            suggestedMax = 35;
        }
        // Sinon on utilise la valeur max + 20% de marge
        else {
            suggestedMax = Math.ceil(maxTension * 1.2);
        }
        
        suggestedMin = Math.max(0, Math.floor(minTension * 0.8));
    }
    
    const data = {
        labels: hours,
        datasets: [{
            label: 'Tension (V)',
            data: tensionData,
            backgroundColor: 'rgba(159, 122, 234, 0.2)',
            borderColor: 'rgba(159, 122, 234, 1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
        }]
    };
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        return `Tension: ${context.parsed.y.toFixed(2)} V`;
                    }
                }
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Tension (Volts)'
                },
                beginAtZero: false,
                suggestedMin: suggestedMin,
                suggestedMax: suggestedMax,
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                },
                ticks: {
                    // Afficher seulement les valeurs entières
                    callback: function(value) {
                        return Number.isInteger(value) ? value + 'V' : '';
                    },
                    stepSize: 5 // Graduation tous les 5V
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Heures de la journée'
                },
                grid: {
                    display: true,
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        },
        elements: {
            line: {
                tension: 0.4
            }
        }
    };
    
    console.log(`📊 Graphique tension: min=${minTension.toFixed(2)}V, max=${maxTension.toFixed(2)}V, échelle: ${suggestedMin}-${suggestedMax}V`);
    
    return createChart('hourlyTensionChart', 'line', data, options);
}

// Fonction pour calculer les minimums et maximums journaliers
function calculateDailyMinMax(combinedData) {
    const dailyMinMax = [];
    
    combinedData.periods.forEach(date => {
        const dailyEntry = {
            date: date,
            energyMax: {},
            energyMin: {},
            tensionMax: null,
            tensionMin: null,
            energyHour: {},
            tensionHour: null
        };
        
        // Trouver le max et min d'énergie pour chaque client
        combinedData.clients.forEach(client => {
            const clientData = combinedData.energyData[client];
            if (clientData && clientData.hourlyData && clientData.hourlyData[date]) {
                const hourlyData = clientData.hourlyData[date];
                
                let maxValue = -Infinity;
                let minValue = Infinity;
                let maxHour = null;
                let minHour = null;
                
                hourlyData.forEach((value, hour) => {
                    if (value !== null && value !== undefined) {
                        if (value > maxValue) {
                            maxValue = value;
                            maxHour = hour;
                        }
                        if (value < minValue) {
                            minValue = value;
                            minHour = hour;
                        }
                    }
                });
                
                if (maxValue !== -Infinity && maxHour !== null) {
                    dailyEntry.energyMax[client] = maxValue;
                    dailyEntry.energyHour[client] = maxHour;
                }
                
                if (minValue !== Infinity && minHour !== null) {
                    dailyEntry.energyMin[client] = minValue;
                }
            }
        });
        
        // Trouver le max et min de tension
        if (combinedData.tensionData[date]) {
            const tensionData = combinedData.tensionData[date];
            let maxTension = -Infinity;
            let minTension = Infinity;
            let maxTensionHour = null;
            let minTensionHour = null;
            
            tensionData.forEach((value, hour) => {
                if (value !== null && value !== undefined) {
                    if (value > maxTension) {
                        maxTension = value;
                        maxTensionHour = hour;
                    }
                    if (value < minTension) {
                        minTension = value;
                        minTensionHour = hour;
                    }
                }
            });
            
            if (maxTension !== -Infinity && maxTensionHour !== null) {
                dailyEntry.tensionMax = maxTension;
                dailyEntry.tensionHour = maxTensionHour;
            }
            
            if (minTension !== Infinity && minTensionHour !== null) {
                dailyEntry.tensionMin = minTension;
            }
        }
        
        // Calculer le total d'énergie
        dailyEntry.totalEnergyMax = Object.values(dailyEntry.energyMax).reduce((sum, val) => sum + val, 0);
        
        dailyMinMax.push(dailyEntry);
    });
    
    return dailyMinMax;
}

// Fonction pour créer les graphiques
function createCharts(dailyMinMax, combinedData) {
    console.log('📈 Création des graphiques...');
    
    // Détruire les graphiques existants
    if (energyBarChart) {
        energyBarChart.destroy();
    }
    if (comparisonChart) {
        comparisonChart.destroy();
    }
    if (hourlyChart) {
        hourlyChart.destroy();
    }
    if (hourlyTensionChart) {
        hourlyTensionChart.destroy();
    }
    
    // Créer les graphiques demandés
    energyBarChart = createTotalEnergyBarChart(dailyMinMax);
    comparisonChart = createComparisonChart(dailyMinMax, combinedData);
    
    console.log('✅ Graphiques principaux créés');
}

// Fonction pour initialiser les onglets du tableau combiné
function initializeCombinedTableTabs() {
    const tabButtons = document.querySelectorAll('.combined-tab-btn');
    const tabContents = document.querySelectorAll('.combined-tab-content');
    const combinedData = window.currentCombinedData;
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Mettre à jour les stats
            const hourlyStats = document.getElementById('hourly-stats');
            const dailyStats = document.getElementById('daily-stats');
            
            if (hourlyStats && dailyStats) {
                if (tabId === 'hourly') {
                    hourlyStats.style.display = 'block';
                    dailyStats.style.display = 'none';
                } else if (tabId === 'daily') {
                    hourlyStats.style.display = 'none';
                    dailyStats.style.display = 'block';
                } else {
                    hourlyStats.style.display = 'none';
                    dailyStats.style.display = 'none';
                }
            }
            
            if (tabId === 'graphs' && combinedData && combinedData.periods.length > 0) {
                // Forcer un délai pour s'assurer que le DOM est prêt
                setTimeout(() => {
                    const graphDateSelect = document.getElementById('graph-date-select');
                    const selectedDate = graphDateSelect ? graphDateSelect.value : combinedData.periods[0];
                    
                    // Recréer tous les graphiques
                    createCharts(calculateDailyMinMax(combinedData), combinedData);
                    
                    // Créer le graphique horaire d'énergie
                    if (hourlyChart) {
                        hourlyChart.destroy();
                    }
                    hourlyChart = createHourlyChart(combinedData, selectedDate);
                    
                    // Créer le graphique de tension horaire
                    if (hourlyTensionChart) {
                        hourlyTensionChart.destroy();
                    }
                    hourlyTensionChart = createHourlyTensionChart(combinedData, selectedDate);
                }, 300);
            }
        });
    });
}

// Fonctions pour l'export CSV
function generateHourlyCSV(combinedData) {
    const headers = ['Date', 'Heure', ...combinedData.clients.map(c => `E_${c} (Wh)`), 'Tension (V)'];
    const csvRows = [headers.join(';')];

    let dataCount = 0;
    
    combinedData.periods.forEach(date => {
        for (let hour = 0; hour < 24; hour++) {
            const hourDisplay = `${hour.toString().padStart(2, '0')}h`;
            const rowData = [date, hourDisplay];

            combinedData.clients.forEach(client => {
                const clientData = combinedData.energyData[client];
                let value = '';
                
                if (clientData && clientData.hourlyData && clientData.hourlyData[date]) {
                    const hourValue = clientData.hourlyData[date][hour];
                    if (hourValue !== null && hourValue !== undefined) {
                        value = hourValue;
                        dataCount++;
                    }
                }
                
                rowData.push(value);
            });

            let tensionValue = '';
            if (combinedData.tensionData[date] && combinedData.tensionData[date][hour] !== null && combinedData.tensionData[date][hour] !== undefined) {
                tensionValue = combinedData.tensionData[date][hour].toFixed(2);
                dataCount++;
            }
            
            rowData.push(tensionValue);

            csvRows.push(rowData.join(';'));
        }
    });
    
    console.log(`📊 Export horaire: ${dataCount} points de données`);
    return csvRows.join('\n');
}

function generateDailyMinMaxCSV(dailyMinMax, clients, clientForfaits) {
    const headers = ['Date'];
    clients.forEach(client => {
        const forfait = clientForfaits[client] || 'ECO';
        headers.push(`E_${client}_Max_Wh`, `E_${client}_Heure`, `E_${client}_Forfait`);
    });
    headers.push('Tension_Max_V', 'Tension_Heure', 'Tension_Min_V', 'Total_Energie_Wh');
    
    const csvRows = [headers.join(';')];

    dailyMinMax.forEach(daily => {
        const rowData = [daily.date];
        
        clients.forEach(client => {
            const maxValue = daily.energyMax[client];
            const maxHour = daily.energyHour[client];
            const forfait = clientForfaits[client] || 'ECO';
            
            rowData.push(maxValue !== undefined ? maxValue.toFixed(0) : '');
            rowData.push(maxHour !== undefined ? `${maxHour.toString().padStart(2, '0')}h` : '');
            rowData.push(forfait);
        });
        
        rowData.push(
            daily.tensionMax !== null ? daily.tensionMax.toFixed(2) : '',
            daily.tensionHour !== null ? `${daily.tensionHour.toString().padStart(2, '0')}h` : '',
            daily.tensionMin !== null ? daily.tensionMin.toFixed(2) : '',
            daily.totalEnergyMax.toFixed(0)
        );
        
        csvRows.push(rowData.join(';'));
    });
    
    console.log(`📊 Export maximums: ${dailyMinMax.length} jours`);
    return csvRows.join('\n');
}

function exportCSVFile(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportCombinedTableToCSV(combinedData) {
    if (!combinedData || combinedData.clients.length === 0) {
        alert('Aucune donnée à exporter');
        return;
    }

    try {
        const dailyMinMax = calculateDailyMinMax(combinedData);
        
        const hourlyCSV = generateHourlyCSV(combinedData);
        const dailyCSV = generateDailyMinMaxCSV(dailyMinMax, combinedData.clients, combinedData.clientForfaits);
        
        exportCSVFile(hourlyCSV, `tableau_combine_horaire_${new Date().toISOString().slice(0, 10)}.csv`);
        exportCSVFile(dailyCSV, `tableau_combine_maximums_${new Date().toISOString().slice(0, 10)}.csv`);
        
        console.log(`✅ Export CSV réussi: 2 fichiers générés`);
        alert('Export réussi : 2 fichiers CSV ont été téléchargés\n1. Tableau horaire\n2. Tableau des maximums journaliers');
    } catch (error) {
        console.error('❌ Erreur export CSV:', error);
        alert('Erreur lors de l\'export CSV: ' + error.message);
    }
}

// Fonction pour créer le tableau combiné
export function createCombinedTable(analysisData) {
    console.log('📊 Création du tableau combiné...');

    if (!analysisData || !analysisData.files) {
        console.error('❌ Données d\'analyse manquantes');
        return null;
    }

    const energyFiles = analysisData.files.filter(f => f.type === 'énergie');
    const tensionFiles = analysisData.files.filter(f => f.type === 'tension');

    if (energyFiles.length === 0 && tensionFiles.length === 0) {
        console.warn('⚠️ Aucun fichier d\'énergie ou tension trouvé');
        return null;
    }

    const uniqueClients = [...new Set(energyFiles
        .filter(f => f.client && f.client.trim() !== '')
        .map(f => f.client)
    )];

    console.log(`👥 Clients identifiés: ${uniqueClients.join(', ')}`);

    const combinedData = {
        energyData: {},
        tensionData: {},
        clients: uniqueClients,
        periods: [],
        clientForfaits: {}
    };

    console.log('🔍 Récupération des données depuis les analyseurs...');
    
    if (window.energyResults) {
        console.log('📈 Données énergie disponibles:', Object.keys(window.energyResults));
        
        energyFiles.forEach(file => {
            const clientName = file.client;
            if (!clientName) return;
            
            const clientId = clientName.replace(/[^a-zA-Z0-9]/g, '_');
            const fileId = `${clientId}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
            console.log(`🔍 Recherche données pour client ${clientName}, fileId: ${fileId}`);
            
            let clientResults = null;
            
            if (window.energyResults[fileId]) {
                clientResults = window.energyResults[fileId];
            } else if (window.energyResults[file.name.replace(/[^a-zA-Z0-9]/g, '_')]) {
                clientResults = window.energyResults[file.name.replace(/[^a-zA-Z0-9]/g, '_')];
            } else {
                const keys = Object.keys(window.energyResults);
                const clientKey = keys.find(key => key.includes(clientId));
                if (clientKey) {
                    clientResults = window.energyResults[clientKey];
                }
            }
            
            if (clientResults && Array.isArray(clientResults)) {
                console.log(`✅ Données trouvées pour ${clientName}: ${clientResults.length} enregistrements`);
                
                const forfait = file.forfait || 'ECO';
                combinedData.clientForfaits[clientName] = forfait;
                
                if (!combinedData.energyData[clientName]) {
                    combinedData.energyData[clientName] = {
                        client: clientName,
                        forfait: forfait,
                        hourlyData: {},
                        allResults: clientResults
                    };
                }
                
                clientResults.forEach(record => {
                    if (!record.date || !record.heure) return;
                    
                    let hour = 0;
                    const hourStr = record.heure.trim();
                    
                    if (hourStr.includes('h')) {
                        const hourPart = hourStr.split('h')[0];
                        hour = parseInt(hourPart) || 0;
                    }
                    
                    const date = record.date;
                    
                    if (!combinedData.energyData[clientName].hourlyData[date]) {
                        combinedData.energyData[clientName].hourlyData[date] = new Array(24).fill(null);
                    }
                    
                    let value = record.valeur;
                    if (typeof value === 'string') {
                        value = parseFloat(value.replace(' Wh', '').trim());
                    }
                    
                    combinedData.energyData[clientName].hourlyData[date][hour] = value;
                    
                    if (!combinedData.periods.includes(date)) {
                        combinedData.periods.push(date);
                    }
                });
                
            } else {
                console.warn(`⚠️ Aucune donnée trouvée pour client ${clientName}`);
            }
        });
    } else {
        console.warn('❌ window.energyResults non disponible');
    }

    if (tensionFiles.length > 0) {
        console.log('⚡ Analyse des fichiers tension directement...');
        
        tensionFiles.forEach(file => {
            console.log(`🔍 Analyse du fichier tension: ${file.name}`);
            
            let analyzeFunction = null;
            
            if (typeof analyzeTension === 'function') {
                analyzeFunction = analyzeTension;
            } else if (window.analyzeTension) {
                analyzeFunction = window.analyzeTension;
            } else if (window.tensionAnalyzer && window.tensionAnalyzer.analyzeTension) {
                analyzeFunction = window.tensionAnalyzer.analyzeTension;
            }
            
            if (analyzeFunction) {
                const tensionResults = analyzeFunction(file.content);
                console.log(`✅ Données tension analysées pour ${file.name}: ${tensionResults.length} enregistrements`);
                
                window.tensionResults = window.tensionResults || {};
                const fileId = file.name.replace(/[^a-zA-Z0-9]/g, '_');
                window.tensionResults[fileId] = tensionResults;
                
                tensionResults.forEach((record, index) => {
                    if (!record.date || !record.heure) {
                        console.warn(`❌ Enregistrement tension ${index} sans date ou heure:`, record);
                        return;
                    }
                    
                    let hour = 0;
                    const hourStr = record.heure.trim();
                    
                    if (hourStr.includes('h')) {
                        const hourPart = hourStr.split('h')[0];
                        hour = parseInt(hourPart) || 0;
                    }
                    
                    const date = record.date;
                    let tension = record.tension || record.valeur;
                    
                    if (typeof tension === 'string') {
                        tension = parseFloat(tension.replace(' V', '').trim());
                    }
                    
                    if (!combinedData.tensionData[date]) {
                        combinedData.tensionData[date] = new Array(24).fill(null);
                    }
                    
                    combinedData.tensionData[date][hour] = tension;
                    
                    if (!combinedData.periods.includes(date)) {
                        combinedData.periods.push(date);
                    }
                });
                
            } else {
                console.error('❌ Fonction analyzeTension non trouvée');
            }
        });
    } else {
        console.warn('⚠️ Pas de fichiers tension trouvés');
    }

    combinedData.periods.sort((a, b) => {
        const convertToDate = (dateStr) => {
            const [day, month, year] = dateStr.split('/').map(Number);
            return new Date(year, month - 1, day);
        };
        return convertToDate(a) - convertToDate(b);
    });

    console.log(`📅 Périodes trouvées: ${combinedData.periods.length}`, combinedData.periods.slice(0, 5));
    
    window.currentCombinedData = combinedData;
    
    return combinedData;
}

// Fonction pour afficher le tableau combiné
export function renderCombinedTable(combinedData, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`❌ Conteneur ${containerId} non trouvé`);
        return;
    }

    if (!combinedData || combinedData.clients.length === 0) {
        container.innerHTML = `
            <div class="no-combined-data">
                <p>📋 Aucune donnée disponible pour le tableau combiné</p>
                <p class="info-text">Les données d'énergie client et de tension seront affichées ici lorsqu'elles seront disponibles.</p>
            </div>
        `;
        return;
    }

    console.log(`🎨 Rendu du tableau combiné avec ${combinedData.clients.length} clients et ${combinedData.periods.length} périodes`);

    // Calculer les minimums et maximums journaliers
    const dailyMinMax = calculateDailyMinMax(combinedData);
    console.log('📊 Minimums/Maximums journaliers calculés:', dailyMinMax.length, 'jours');

    // Créer la structure du tableau combiné
    let html = `
        <div class="combined-table-container">
            <div class="combined-table-header">
                <h3>📊 Tableau Combiné Énergie & Tension</h3>
                <div class="combined-table-info">
                    <span class="client-count">👥 ${combinedData.clients.length} client(s)</span>
                    <span class="date-range">📅 ${combinedData.periods.length} jour(s)</span>
                    <button class="btn-export-combined" id="export-combined-btn">📥 Exporter CSV</button>
                </div>
            </div>
            
            <div class="combined-table-tabs">
                <button class="combined-tab-btn active" data-tab="hourly">⏰ Vue Horaire</button>
                <button class="combined-tab-btn" data-tab="daily">📊 Vue Journalière (Maximums)</button>
                <button class="combined-tab-btn" data-tab="graphs">📈 Graphiques</button>
            </div>
            
            <!-- ONGLET 1: Vue Horaire -->
            <div class="combined-tab-content active" id="hourly-tab">
                <div class="hourly-controls">
                    <div class="date-selector">
                        <label for="hourly-date-select">Sélectionner une date :</label>
                        <select id="hourly-date-select" class="date-select">
                            ${combinedData.periods.map(date => 
                                `<option value="${date}">${date}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="hourly-chart-info">
                        <p>Ce graphique montre la consommation horaire pour la date sélectionnée.</p>
                    </div>
                </div>
                
                <div class="table-wrapper-scroll">
                    <table class="combined-table">
                        <thead>
                            <tr>
                                <th class="sticky-col">Date</th>
                                <th class="sticky-col">Heure</th>
    `;

    combinedData.clients.forEach(client => {
        const forfait = combinedData.clientForfaits[client] || 'ECO';
        html += `<th>👤 E_${client} (${forfait})</th>`;
    });

    html += `<th>⚡ Tension (V)</th>`;

    html += `
                            </tr>
                        </thead>
                        <tbody>
    `;

    let totalRows = 0;
    let tensionDataCount = 0;
    let energyDataCount = 0;
    
    combinedData.periods.forEach(date => {
        for (let hour = 0; hour < 24; hour++) {
            const hourDisplay = `${hour.toString().padStart(2, '0')}h`;
            html += `<tr>`;
            html += `<td class="sticky-col date-cell">${date}</td>`;
            html += `<td class="sticky-col hour-cell">${hourDisplay}</td>`;

            let hasDataInRow = false;
            
            combinedData.clients.forEach(client => {
                const clientData = combinedData.energyData[client];
                let value = '—';
                
                if (clientData && clientData.hourlyData && clientData.hourlyData[date]) {
                    const hourValue = clientData.hourlyData[date][hour];
                    if (hourValue !== null && hourValue !== undefined) {
                        value = `${hourValue}`;
                        hasDataInRow = true;
                        energyDataCount++;
                    }
                }
                
                html += `<td class="energy-cell">${value}</td>`;
            });

            let tensionValue = '—';
            if (combinedData.tensionData[date] && combinedData.tensionData[date][hour] !== null && combinedData.tensionData[date][hour] !== undefined) {
                const tension = combinedData.tensionData[date][hour];
                tensionValue = `${tension.toFixed(2)}`;
                hasDataInRow = true;
                tensionDataCount++;
            }
            
            html += `<td class="tension-cell">${tensionValue}</td>`;
            html += `</tr>`;
            
            if (hasDataInRow) {
                totalRows++;
            }
        }
    });

    html += `
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- ONGLET 2: Vue Journalière -->
            <div class="combined-tab-content" id="daily-tab">
                <div class="daily-maxima-info">
                    <p><strong>📈 Tableau des Maximums Journaliers</strong> - Affiche la valeur la plus élevée pour chaque journée</p>
                </div>
                <div class="table-wrapper-scroll">
                    <table class="combined-table daily-maxima-table">
                        <thead>
                            <tr>
                                <th class="sticky-col">Date</th>
    `;

    combinedData.clients.forEach(client => {
        const forfait = combinedData.clientForfaits[client] || 'ECO';
        html += `<th title="Forfait ${forfait} - Limite: ${FORFAITS[forfait]?.max || 50}Wh">👤 E_${client} (${forfait})</th>`;
    });

    html += `<th>⚡ Tension Max</th>`;
    html += `<th>⚡ Tension Min</th>`;
    html += `<th>📊 Total Énergie</th>`;

    html += `
                            </tr>
                        </thead>
                        <tbody>
    `;

    dailyMinMax.forEach(daily => {
        html += `<tr>`;
        html += `<td class="sticky-col date-cell">${daily.date}</td>`;
        
        combinedData.clients.forEach(client => {
            const maxValue = daily.energyMax[client];
            const forfait = combinedData.clientForfaits[client] || 'ECO';
            
            if (maxValue !== undefined) {
                html += `<td class="energy-max-cell" title="Forfait ${forfait}: ${maxValue.toFixed(0)}Wh">${maxValue.toFixed(0)}</td>`;
            } else {
                html += `<td class="energy-max-cell">—</td>`;
            }
        });
        
        // Tension Max
        if (daily.tensionMax !== null) {
            html += `<td class="tension-max-cell">${daily.tensionMax.toFixed(2)}</td>`;
        } else {
            html += `<td class="tension-max-cell">—</td>`;
        }
        
        // Tension Min
        if (daily.tensionMin !== null) {
            html += `<td class="tension-min-cell">${daily.tensionMin.toFixed(2)}</td>`;
        } else {
            html += `<td class="tension-min-cell">—</td>`;
        }
        
        html += `<td class="total-energy-cell">${daily.totalEnergyMax.toFixed(0)}</td>`;
        
        html += `</tr>`;
    });

    html += `
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- ONGLET 3: Graphiques -->
            <div class="combined-tab-content" id="graphs-tab">
                <div class="charts-section">
                    <h4>📈 Graphiques Synthétiques</h4>
                    
                    <div class="graph-controls">
                        <div class="date-selector">
                            <label for="graph-date-select">Sélectionner une date :</label>
                            <select id="graph-date-select" class="date-select">
                                ${combinedData.periods.map(date => 
                                    `<option value="${date}">${date}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="graph-info">
                            <p>Les deux graphiques sont synchronisés sur la même date pour faciliter la comparaison</p>
                        </div>
                    </div>
                    
                    <!-- GRAPHIQUES EMPILÉS - HAUT ET BAS -->
                    <div class="stacked-charts">
                        <!-- Graphique Énergie Horaire (en haut) -->
                        <div class="stacked-chart-container">
                            <div class="chart-wrapper-large">
                                <canvas id="hourlyChart"></canvas>
                            </div>
                        </div>
                        
                        <!-- Graphique Tension Horaire (en bas) -->
                        <div class="stacked-chart-container">
                            <div class="chart-wrapper-large">
                                <canvas id="hourlyTensionChart"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Énergie Totale par Jour -->
                    <div class="chart-container full-card">
                        <div class="chart-header">
                            <h5>Énergie Totale par Jour</h5>
                        </div>
                        <div class="chart-wrapper">
                            <canvas id="totalEnergyChart"></canvas>
                        </div>
                    </div>
                    
                    <!-- Comparaison Énergie Clients -->
                    <div class="chart-container full-card">
                        <div class="chart-header">
                            <h5>Comparaison Énergie Clients</h5>
                        </div>
                        <div class="chart-wrapper">
                            <canvas id="comparisonChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="combined-table-footer">
                <div class="legend">
                    <div class="legend-item">
                        <span class="legend-color energy"></span>
                        Énergie Client (Wh)
                    </div>
                    <div class="legend-item">
                        <span class="legend-color tension"></span>
                        Tension (V)
                    </div>
                </div>
                <div class="table-stats">
                    <div id="hourly-stats">
                        Vue Horaire: ${totalRows} lignes<br>
                        Énergie: ${energyDataCount} points | Tension: ${tensionDataCount} points
                    </div>
                    <div id="daily-stats" style="display: none;">
                        Vue Journalière: ${dailyMinMax.length} jours<br>
                        Affiche les maximums par jour
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    console.log(`✅ Tableau rendu: ${totalRows} lignes horaires, ${dailyMinMax.length} jours (maximums)`);

    // Ajouter l'événement d'export
    const exportBtn = document.getElementById('export-combined-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportCombinedTableToCSV(combinedData);
        });
    }
    
    // Gestion du sélecteur de date pour le graphique horaire
    const dateSelect = document.getElementById('hourly-date-select');
    if (dateSelect) {
        dateSelect.addEventListener('change', (e) => {
            if (hourlyChart) {
                hourlyChart.destroy();
            }
            hourlyChart = createHourlyChart(combinedData, e.target.value);
        });
    }
    
    // Gestion du sélecteur de date pour les graphiques (onglet Graphiques)
    const graphDateSelect = document.getElementById('graph-date-select');
    if (graphDateSelect) {
        graphDateSelect.addEventListener('change', (e) => {
            const selectedDate = e.target.value;
            
            // Mettre à jour le graphique horaire d'énergie
            if (hourlyChart) {
                hourlyChart.destroy();
            }
            hourlyChart = createHourlyChart(combinedData, selectedDate);
            
            // Mettre à jour le graphique de tension horaire
            if (hourlyTensionChart) {
                hourlyTensionChart.destroy();
            }
            hourlyTensionChart = createHourlyTensionChart(combinedData, selectedDate);
        });
    }
    
    // Gestion des onglets
    initializeCombinedTableTabs();
    
    // Créer les graphiques
    setTimeout(() => {
        createCharts(dailyMinMax, combinedData);
        
        // Créer le graphique horaire pour la première date
        if (combinedData.periods.length > 0) {
            const firstDate = combinedData.periods[0];
            hourlyChart = createHourlyChart(combinedData, firstDate);
            
            // Créer le graphique de tension horaire
            hourlyTensionChart = createHourlyTensionChart(combinedData, firstDate);
        }
    }, 500);
}

// Fonction pour mettre à jour le résumé global
export function updateGlobalSummary(analysisData, containerId) {
    console.log('🔄 Mise à jour du résumé global...');

    const energyFiles = analysisData?.files?.filter(f => f.type === 'énergie') || [];
    const tensionFiles = analysisData?.files?.filter(f => f.type === 'tension') || [];
    
    const clients = [...new Set(energyFiles
        .filter(f => f.client && f.client.trim() !== '')
        .map(f => f.client)
    )];

    const forfaits = energyFiles.reduce((acc, file) => {
        const forfait = file.forfait || 'ECO';
        acc[forfait] = (acc[forfait] || 0) + 1;
        return acc;
    }, {});

    const summaryHTML = `
        <div class="global-summary">
            <h3>📋 Résumé Global du Dossier</h3>
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-icon">📁</div>
                    <div class="summary-content">
                        <div class="summary-value">${analysisData?.files?.length || 0}</div>
                        <div class="summary-label">Fichiers totaux</div>
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-icon">👥</div>
                    <div class="summary-content">
                        <div class="summary-value">${clients.length}</div>
                        <div class="summary-label">Clients identifiés</div>
                        ${clients.length > 0 ? `
                            <div class="summary-detail">
                                ${clients.slice(0, 3).map(c => `<span class="client-tag">${c}</span>`).join('')}
                                ${clients.length > 3 ? `<span class="more-clients">+${clients.length - 3} autres</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-icon">⚡</div>
                    <div class="summary-content">
                        <div class="summary-value">${energyFiles.length}</div>
                        <div class="summary-label">Fichiers énergie</div>
                        ${Object.keys(forfaits).length > 0 ? `
                            <div class="summary-detail">
                                ${Object.entries(forfaits).slice(0, 3).map(([f, count]) => 
                                    `<span class="forfait-tag">${f}: ${count}</span>`
                                ).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="summary-card">
                    <div class="summary-icon">📊</div>
                    <div class="summary-content">
                        <div class="summary-value">${tensionFiles.length}</div>
                        <div class="summary-label">Fichiers tension</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = summaryHTML;
    }

    return summaryHTML;
}

// Fonction pour attendre que les données soient disponibles
export function waitForDataAndCreateCombinedTable(analysisData, containerId) {
    console.log('⏳ Attente des données d\'analyse...');
    
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkData = () => {
        attempts++;
        console.log(`🔍 Tentative ${attempts}/${maxAttempts} pour récupérer les données...`);
        
        const hasEnergyData = window.energyResults && Object.keys(window.energyResults).length > 0;
        const hasTensionData = window.tensionResults && Object.keys(window.tensionResults).length > 0;
        
        console.log(`📊 État données - Énergie: ${hasEnergyData}, Tension: ${hasTensionData}`);
        
        if (hasEnergyData || hasTensionData) {
            console.log('✅ Données disponibles!');
            console.log('📈 Données énergie:', window.energyResults ? Object.keys(window.energyResults) : 'non disponible');
            console.log('⚡ Données tension:', window.tensionResults ? Object.keys(window.tensionResults) : 'non disponible');
            
            const combinedData = createCombinedTable(analysisData);
            renderCombinedTable(combinedData, containerId);
            return true;
        }
        
        if (attempts < maxAttempts) {
            setTimeout(checkData, 500);
        } else {
            console.warn('❌ Données non disponibles après attente');
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div class="no-combined-data">
                        <p>📋 Données non disponibles pour le tableau combiné</p>
                        <p class="info-text">Les données n'ont pas pu être chargées après plusieurs tentatives.</p>
                        <button class="btn-retry" id="retry-combined-table">🔄 Réessayer</button>
                    </div>
                `;
                
                document.getElementById('retry-combined-table')?.addEventListener('click', () => {
                    waitForDataAndCreateCombinedTable(analysisData, containerId);
                });
            }
        }
        
        return false;
    };
    
    setTimeout(checkData, 1000);
}

// Style CSS pour le tableau combiné
export function loadCombinedTableCSS() {
    if (document.querySelector('#combined-table-css')) return;

    const style = document.createElement('style');
    style.id = 'combined-table-css';
    style.textContent = `
        /* Styles pour le tableau combiné */
        .combined-table-container {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin: 20px 0;
            overflow: hidden;
        }
        
        .combined-table-header {
            padding: 15px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .combined-table-header h3 {
            margin: 0;
            font-size: 18px;
        }
        
        .combined-table-info {
            display: flex;
            gap: 15px;
            align-items: center;
        }
        
        .btn-export-combined {
            background: white;
            color: #667eea;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
            transition: transform 0.2s;
        }
        
        .btn-export-combined:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .combined-table-tabs {
            display: flex;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            padding: 0 20px;
        }
        
        .combined-tab-btn {
            padding: 12px 20px;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            cursor: pointer;
            font-weight: 500;
            color: #718096;
            transition: all 0.3s;
        }
        
        .combined-tab-btn:hover {
            color: #4a5568;
            background: #edf2f7;
        }
        
        .combined-tab-btn.active {
            color: #667eea;
            border-bottom-color: #667eea;
            font-weight: 600;
        }
        
        .combined-tab-content {
            display: none;
        }
        
        .combined-tab-content.active {
            display: block;
        }
        
        /* Contrôles pour le graphique horaire */
        .hourly-controls {
            padding: 15px 20px;
            background: #f7fafc;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .date-selector {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .date-selector label {
            font-weight: 500;
            color: #4a5568;
            font-size: 14px;
        }
        
        .date-select {
            padding: 8px 12px;
            border: 1px solid #cbd5e0;
            border-radius: 6px;
            background: white;
            font-size: 14px;
            min-width: 150px;
        }
        
        .hourly-chart-info {
            font-size: 14px;
            color: #718096;
            max-width: 400px;
        }
        
        /* Contrôles pour les graphiques */
        .graph-controls {
            padding: 15px 20px;
            background: #f1f5f9;
            border-radius: 8px;
            margin: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .graph-info {
            font-size: 14px;
            color: #64748b;
            font-style: italic;
        }
        
        .daily-maxima-info {
            padding: 15px 20px;
            background: #f7fafc;
            border-bottom: 1px solid #e2e8f0;
            font-size: 14px;
            color: #4a5568;
        }
        
        .table-wrapper-scroll {
            overflow-x: auto;
            max-height: 600px;
            overflow-y: auto;
        }
        
        .combined-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 800px;
        }
        
        .combined-table th {
            background: #f8fafc;
            padding: 12px 15px;
            text-align: center;
            font-weight: 600;
            color: #2d3748;
            border-bottom: 2px solid #e2e8f0;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        .combined-table td {
            padding: 10px 15px;
            text-align: center;
            border-bottom: 1px solid #edf2f7;
            font-family: 'Courier New', monospace;
        }
        
        .sticky-col {
            position: sticky;
            left: 0;
            background: white;
            z-index: 5;
            box-shadow: 2px 0 5px rgba(0,0,0,0.1);
        }
        
        .date-cell {
            font-weight: 600;
            background: #f7fafc;
        }
        
        .hour-cell {
            font-weight: 500;
            background: #f7fafc;
        }
        
        .energy-cell {
            color: #2b6cb0;
            font-weight: 500;
        }
        
        .tension-cell {
            color: #9f7aea;
            font-weight: 600;
        }
        
        .daily-maxima-table th {
            background: #e6fffa;
        }
        
        .daily-maxima-table .energy-max-cell {
            font-weight: 600;
            color: #2d3748;
            background-color: rgba(72, 187, 120, 0.1);
        }
        
        .daily-maxima-table .tension-max-cell,
        .daily-maxima-table .tension-min-cell {
            font-weight: 600;
            color: #9f7aea;
            background-color: rgba(159, 122, 234, 0.1);
        }
        
        .daily-maxima-table .total-energy-cell {
            color: #38a169;
            font-weight: 700;
            background-color: rgba(72, 187, 120, 0.2);
            border-left: 2px solid #e2e8f0;
        }
        
        /* Styles pour la section des graphiques */
        .charts-section {
            padding: 0 20px 20px;
        }
        
        .charts-section h4 {
            margin: 0 0 15px 0;
            color: #2d3748;
            padding-top: 20px;
        }
        
        /* Styles pour les graphiques empilés */
        .stacked-charts {
            display: flex;
            flex-direction: column;
            gap: 25px;
            margin-bottom: 25px;
        }
        
        .stacked-chart-container {
            background: white;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            padding: 15px;
        }
        
        .chart-wrapper-large {
            position: relative;
            height: 350px;
            width: 100%;
        }
        
        .chart-container {
            background: white;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            margin-bottom: 25px;
        }
        
        /* Style pour les cartes pleine largeur */
        .chart-container.full-card {
            width: 100%;
            min-height: 400px;
        }
        
        .chart-header {
            padding: 15px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .chart-header h5 {
            margin: 0 0 5px 0;
            color: #4a5568;
            font-size: 16px;
            font-weight: 600;
        }
        
        .chart-subtitle {
            font-size: 13px;
            color: #718096;
        }
        
        .chart-wrapper {
            position: relative;
            height: 300px;
            padding: 15px;
        }
        
        .combined-table-footer {
            padding: 15px 20px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
        }
        
        .legend {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: #4a5568;
        }
        
        .legend-color {
            width: 14px;
            height: 14px;
            border-radius: 3px;
        }
        
        .legend-color.energy {
            background-color: #2b6cb0;
        }
        
        .legend-color.tension {
            background-color: #9f7aea;
        }
        
        .table-stats {
            font-size: 14px;
            color: #4a5568;
            text-align: right;
        }
        
        /* Styles pour le résumé global */
        .global-summary {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin: 20px 0;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }
        
        .summary-card {
            background: #f8fafc;
            border-radius: 8px;
            padding: 15px;
            display: flex;
            align-items: center;
            gap: 15px;
            border: 1px solid #e2e8f0;
            transition: transform 0.2s;
        }
        
        .summary-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .summary-icon {
            font-size: 24px;
            width: 50px;
            height: 50px;
            background: white;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .summary-content {
            flex: 1;
        }
        
        .summary-value {
            font-size: 28px;
            font-weight: 700;
            color: #2d3748;
        }
        
        .summary-label {
            font-size: 14px;
            color: #718096;
            margin-top: 2px;
        }
        
        .summary-detail {
            margin-top: 5px;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        
        .client-tag, .forfait-tag {
            background: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            border: 1px solid #e2e8f0;
        }
        
        .more-clients {
            font-size: 12px;
            color: #a0aec0;
            font-style: italic;
        }
        
        .no-combined-data {
            text-align: center;
            padding: 40px 20px;
            color: #718096;
        }
        
        .no-combined-data .info-text {
            font-size: 14px;
            margin-top: 10px;
            opacity: 0.8;
        }
        
        .btn-retry {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 15px;
            font-weight: 600;
        }
        
        .btn-retry:hover {
            background: #5a67d8;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
            .combined-table-header {
                flex-direction: column;
                gap: 10px;
                text-align: center;
            }
            
            .combined-table-info {
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .combined-table-tabs {
                overflow-x: auto;
                flex-wrap: nowrap;
            }
            
            .chart-wrapper-large {
                height: 280px;
            }
            
            .hourly-controls,
            .graph-controls {
                flex-direction: column;
                align-items: flex-start;
            }
            
            .combined-table-footer {
                flex-direction: column;
                gap: 15px;
                text-align: center;
            }
            
            .legend {
                justify-content: center;
            }
        }
    `;

    document.head.appendChild(style);
}

// Exporter toutes les fonctions nécessaires
export {
    getForfaitLimits,
    getEnergyColor,
    calculateDailyMinMax,
    createCharts,
    createHourlyTensionChart
};