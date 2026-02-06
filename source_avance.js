console.log('✅ tableau-horaire.js: Architecture modulaire chargée avec succès');
console.log('📁 Structure: shared-utils.js → commerciale-tab.js → technique-tab.js → tableau-horaire.js');

document.addEventListener('DOMContentLoaded', async function () {
    console.log('📊 Page tableau horaire initialisée');

    const urlParams = new URLSearchParams(window.location.search);
    const nr = urlParams.get('nr');

    if (!nr) {
        showError('Aucun dossier spécifié.');
        setTimeout(() => window.location.href = 'files.html', 3000);
        return;
    }

    document.getElementById('folder-title').textContent = `📁 NR - ${nr}`;

    try {
        await loadAnalyzers();
        await loadAndDisplayData(nr);
    } catch (error) {
        console.error('❌ Erreur:', error);
        showError(`Erreur: ${error.message}`);
    }
});

async function loadAnalyzers() {
    const analyzers = [
        { name: 'energyAnalyzer', path: './analyzer/energyAnalyzer.js' },
        { name: 'creditAnalyzer', path: './analyzer/creditAnalyzer.js' },
        { name: 'tensionAnalyzer', path: './analyzer/tensionAnalyzer.js' }
    ];

    for (const analyzer of analyzers) {
        await loadAnalyzer(analyzer.name, analyzer.path);
    }
}

async function loadAnalyzer(name, path) {
    return new Promise((resolve, reject) => {
        if (name === 'energyAnalyzer' && typeof window.analyzeEnergy === 'function') {
            console.log('✅ EnergyAnalyzer déjà chargé');
            resolve();
            return;
        }

        if (name === 'creditAnalyzer' && typeof window.analyzeCredit === 'function') {
            console.log('✅ CreditAnalyzer déjà chargé');
            resolve();
            return;
        }

        if (name === 'tensionAnalyzer' && typeof window.analyzeTension === 'function') {
            console.log('✅ TensionAnalyzer déjà chargé');
            resolve();
            return;
        }

        console.log(`📥 Chargement de ${path}...`);

        const script = document.createElement('script');
        script.src = path;
        script.type = 'module';

        script.onload = () => {
            console.log(`✅ ${path} chargé`);
            setTimeout(() => {
                if (name === 'energyAnalyzer') {
                    if (typeof window.analyzeEnergy === 'function') {
                        console.log('✅ Fonction analyzeEnergy disponible');
                        resolve();
                    } else if (window.EnergyAnalyzer && typeof window.EnergyAnalyzer.analyzeEnergy === 'function') {
                        window.analyzeEnergy = window.EnergyAnalyzer.analyzeEnergy;
                        console.log('✅ Fonction trouvée via window.EnergyAnalyzer');
                        resolve();
                    } else {
                        reject(new Error(`Fonction analyzeEnergy non disponible dans ${path}`));
                    }
                }

                if (name === 'creditAnalyzer') {
                    if (typeof window.analyzeCredit === 'function') {
                        console.log('✅ Fonction analyzeCredit disponible');
                        resolve();
                    } else if (window.CreditAnalyzer && typeof window.CreditAnalyzer.analyzeCredit === 'function') {
                        window.analyzeCredit = window.CreditAnalyzer.analyzeCredit;
                        window.generateCreditDailySummary = window.CreditAnalyzer.generateCreditDailySummary;
                        window.comprehensiveCreditAnalysis = window.CreditAnalyzer.comprehensiveCreditAnalysis;
                        console.log('✅ Fonctions credit trouvées via window.CreditAnalyzer');
                        resolve();
                    } else {
                        console.warn(`⚠️ Fonction analyzeCredit non disponible, mais on continue`);
                        resolve();
                    }
                }

                if (name === 'tensionAnalyzer') {
                    if (typeof window.analyzeTension === 'function') {
                        console.log('✅ Fonction analyzeTension disponible');
                        window.generateTensionDailySummary = window.generateTensionDailySummary;
                        window.calculateTensionHourly = window.calculateTensionHourly;
                        resolve();
                    } else if (window.TensionAnalyzer && typeof window.TensionAnalyzer.analyzeTension === 'function') {
                        window.analyzeTension = window.TensionAnalyzer.analyzeTension;
                        window.generateTensionDailySummary = window.TensionAnalyzer.generateTensionDailySummary;
                        window.calculateTensionHourly = window.TensionAnalyzer.calculateTensionHourly;
                        console.log('✅ Fonctions tension trouvées via window.TensionAnalyzer');
                        resolve();
                    } else {
                        console.warn(`⚠️ Fonction analyzeTension non disponible, mais on continue`);
                        resolve();
                    }
                }
            }, 500);
        };

        script.onerror = (error) => {
            console.error(`❌ Erreur de chargement ${path}:`, error);
            if (name === 'creditAnalyzer' || name === 'tensionAnalyzer') {
                console.warn(`⚠️ ${name} non disponible, mais on continue`);
                resolve();
            } else {
                reject(new Error(`Impossible de charger ${path}`));
            }
        };

        document.head.appendChild(script);
    });
}

async function loadAndDisplayData(nr) {
    showLoader();

    try {
        const data = localStorage.getItem(`analysis_${nr}`);
        if (!data) {
            throw new Error(`Dossier ${nr} introuvable`);
        }

        const folderData = JSON.parse(data);
        console.log('📦 Données du dossier chargées');

        const energyFiles = folderData.files.filter(file => file.type === 'énergie');
        const creditFiles = folderData.files.filter(file => file.type === 'crédit');
        const tensionFiles = folderData.files.filter(file => file.type === 'tension' || file.name.toLowerCase().includes('tension'));

        if (energyFiles.length === 0 && creditFiles.length === 0 && tensionFiles.length === 0) {
            showError('Aucun fichier d\'énergie, de crédit ou de tension trouvé');
            return;
        }

        console.log(`🔋 ${energyFiles.length} fichier(s) d'énergie`);
        console.log(`💰 ${creditFiles.length} fichier(s) de crédit`);
        console.log(`⚡ ${tensionFiles.length} fichier(s) de tension`);

        allResultsByClient = {};
        creditResultsByClient = {};
        dailySummaryByClient = {};
        dailySummaryCurrentPage = {};
        dailySummaryItemsPerPage = {};
        currentPage = {};
        itemsPerPage = {};
        currentFilter = {};
        currentSubTab = {};
        tensionResults = {};
        tensionDailySummary = {};
        tensionHourlyData = {};
        allClientsHourlyMatrix = { dates: [], hours: [], data: {} };

        // Traiter l'énergie
        if (energyFiles.length > 0 && typeof window.analyzeEnergy === 'function') {
            for (const file of energyFiles) {
                const clientId = file.client || '00';
                console.log(`📄 Analyse énergie: ${file.name} → Client ${clientId}`);

                try {
                    const results = window.analyzeEnergy(file.content, file.forfait || 'ECO');
                    console.log(`✅ ${results.length} points d'énergie trouvés`);

                    if (!allResultsByClient[clientId]) {
                        allResultsByClient[clientId] = {
                            client: clientId,
                            forfait: file.forfait || 'ECO',
                            files: [],
                            results: [],
                            totalPoints: 0,
                            filteredResults: [],
                            energyFiles: [],
                            creditFiles: [],
                            tensionFiles: [],
                            energyDailyData: [],
                            combinedHourlyData: []
                        };
                    }

                    const enrichedResults = results.map(result => ({
                        ...result,
                        client: clientId,
                        forfait: file.forfait || 'ECO',
                        fileName: file.name,
                        type: 'energy'
                    }));

                    allResultsByClient[clientId].files.push(file.name);
                    allResultsByClient[clientId].energyFiles.push(file.name);
                    allResultsByClient[clientId].results.push(...enrichedResults);
                    allResultsByClient[clientId].totalPoints += results.length;

                    calculateEnergyDailyStats(clientId, results);

                } catch (error) {
                    console.error(`❌ Erreur lors de l'analyse d'énergie ${file.name}:`, error);
                }
            }
        }

        // Traiter le crédit
        if (creditFiles.length > 0 && typeof window.analyzeCredit === 'function') {
            for (const file of creditFiles) {
                const clientId = file.client || '00';
                console.log(`📄 Analyse crédit: ${file.name} → Client ${clientId}`);

                try {
                    const results = window.comprehensiveCreditAnalysis
                        ? window.comprehensiveCreditAnalysis(file.content)
                        : (window.analyzeCredit ? window.analyzeCredit(file.content) : []);

                    console.log(`✅ ${results.length} points de crédit trouvés`);

                    if (!creditResultsByClient[clientId]) {
                        creditResultsByClient[clientId] = {
                            client: clientId,
                            files: [],
                            results: [],
                            dailySummary: [],
                            totalPoints: 0
                        };
                    }

                    const enrichedResults = results.map(result => ({
                        ...result,
                        client: clientId,
                        fileName: file.name,
                        type: 'credit'
                    }));

                    creditResultsByClient[clientId].files.push(file.name);
                    creditResultsByClient[clientId].results.push(...enrichedResults);
                    creditResultsByClient[clientId].totalPoints += results.length;

                    if (window.generateCreditDailySummary) {
                        creditResultsByClient[clientId].dailySummary = window.generateCreditDailySummary(results);
                    }

                    if (allResultsByClient[clientId]) {
                        allResultsByClient[clientId].creditFiles.push(file.name);
                    } else {
                        allResultsByClient[clientId] = {
                            client: clientId,
                            forfait: 'N/A',
                            files: [],
                            results: [],
                            totalPoints: 0,
                            filteredResults: [],
                            energyFiles: [],
                            creditFiles: [file.name],
                            tensionFiles: [],
                            energyDailyData: [],
                            combinedHourlyData: []
                        };
                    }

                } catch (error) {
                    console.error(`❌ Erreur lors de l'analyse de crédit ${file.name}:`, error);
                }
            }
        }

        // Traiter la tension
        if (tensionFiles.length > 0 && typeof window.analyzeTension === 'function') {
            for (const file of tensionFiles) {
                console.log(`📄 Analyse tension: ${file.name} → Tous les clients`);

                try {
                    const results = window.analyzeTension(file.content);
                    console.log(`✅ ${results.length} points de tension trouvés`);

                    tensionResults = results;

                    if (window.generateTensionDailySummary) {
                        tensionDailySummary = window.generateTensionDailySummary(results);
                        console.log(`📊 Résumé journalier tension: ${tensionDailySummary.length} jours`);
                    }

                    if (window.calculateTensionHourly) {
                        tensionHourlyData = window.calculateTensionHourly(results);
                        console.log(`⏰ Données horaires tension: ${tensionHourlyData.length} points`);
                    }

                    Object.keys(allResultsByClient).forEach(clientId => {
                        allResultsByClient[clientId].tensionFiles.push(file.name);
                    });

                } catch (error) {
                    console.error(`❌ Erreur lors de l'analyse de tension ${file.name}:`, error);
                }
            }
        }

        // Préparer les résultats et combiner énergie + tension pour chaque client
        Object.keys(allResultsByClient).forEach(clientId => {
            if (allResultsByClient[clientId].energyFiles.length > 0) {
                combineEnergyAndTensionData(clientId);
            }

            createCombinedDailySummary(clientId);

            dailySummaryCurrentPage[clientId] = 1;
            dailySummaryItemsPerPage[clientId] = 20;

            if (allResultsByClient[clientId].energyFiles.length > 0) {
                currentSubTab[clientId] = 'combined';
            }
        });

        // Créer la matrice horaire pour tous les clients
        createAllClientsHourlyMatrix();

        const totalEnergyPoints = Object.values(allResultsByClient).reduce((sum, client) => sum + client.totalPoints, 0);
        const totalCreditPoints = Object.values(creditResultsByClient).reduce((sum, client) => sum + client.totalPoints, 0);
        const totalTensionPoints = tensionResults.length || 0;
        const totalPoints = totalEnergyPoints + totalCreditPoints + totalTensionPoints;

        displayClientsTabs();

        // Initialiser l'onglet TECHNIQUE par défaut
        setTimeout(() => {
            currentMainTab = 'TECHNIQUE';
            const techniqueTab = document.querySelector('[data-main-tab="TECHNIQUE"]');
            const allClientsTab = document.querySelector('[data-sub-tab="ALL"]');

            if (techniqueTab) {
                if (typeof window.switchMainTab === 'function') {
                    window.switchMainTab('TECHNIQUE', techniqueTab);
                } else if (typeof switchMainTab === 'function') {
                    switchMainTab('TECHNIQUE', techniqueTab);
                } else {
                    // fallback: trigger click on the tab element
                    techniqueTab.click();
                }
            } else if (allClientsTab) {
                // Fallback si les onglets ne sont pas encore créés
                if (typeof window.switchSubTab === 'function') {
                    window.switchSubTab('ALL', 'TECHNIQUE', allClientsTab);
                } else if (typeof switchSubTab === 'function') {
                    switchSubTab('ALL', 'TECHNIQUE', allClientsTab);
                } else {
                    allClientsTab.click();
                }
            }
        }, 100);

        addBackButton();

    } catch (error) {
        console.error('❌ Erreur lors du traitement:', error);
        showError(`Erreur: ${error.message}`);
    } finally {
        hideLoader();
    }
}
function combineEnergyAndTensionData(clientId) {
    const clientData = allResultsByClient[clientId];
    if (!clientData || !clientData.results) return;

    const energyResults = clientData.results.filter(r => r.type === 'energy');
    if (energyResults.length === 0) return;

    const hasTensionData = tensionResults && tensionResults.length > 0;
    const combinedData = [];

    energyResults.forEach(energyResult => {
        const combinedItem = {
            date: energyResult.date,
            heure: energyResult.heure,
            energie: energyResult.valeur,
            tension: null
        };

        if (hasTensionData) {
            const formattedHour = formatHeureColon(energyResult.heure);

            let tensionMatch = tensionResults.find(t =>
                t.date === energyResult.date &&
                formatHeureColon(t.heure) === formattedHour
            );

            if (!tensionMatch && formattedHour !== 'N/A') {
                const tensionsMemeDate = tensionResults.filter(t => t.date === energyResult.date);
                if (tensionsMemeDate.length > 0) {
                    const hourNumber = parseInt(formattedHour.split(':')[0]);
                    tensionsMemeDate.sort((a, b) => {
                        const hourA = parseInt(formatHeureColon(a.heure).split(':')[0]);
                        const hourB = parseInt(formatHeureColon(b.heure).split(':')[0]);
                        return Math.abs(hourA - hourNumber) - Math.abs(hourB - hourNumber);
                    });

                    if (Math.abs(parseInt(formatHeureColon(tensionsMemeDate[0].heure).split(':')[0]) - hourNumber) <= 1) {
                        tensionMatch = tensionsMemeDate[0];
                    }
                }
            }

            if (tensionMatch) {
                combinedItem.tension = tensionMatch.tension || tensionMatch.valeur || 0;
            }
        }

        combinedData.push(combinedItem);
    });

    clientData.combinedHourlyData = combinedData.sort((a, b) => {
        const dateA = convertToComparableDate(a.date);
        const dateB = convertToComparableDate(b.date);
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        const hourA = a.heure ? parseInt(a.heure.replace('h', '')) : 0;
        const hourB = b.heure ? parseInt(b.heure.replace('h', '')) : 0;
        return hourA - hourB;
    });

    console.log(`🔗 Données combinées pour client ${clientId}: ${combinedData.length} points`);
}

// NOUVELLE FONCTION : Créer une matrice horaire pour tous les clients
function createAllClientsHourlyMatrix() {
    const clientsWithEnergy = Object.keys(allResultsByClient).filter(
        clientId => allResultsByClient[clientId].energyFiles.length > 0
    );

    if (clientsWithEnergy.length === 0) {
        console.log('⚠️ Aucun client avec données d\'énergie');
        return;
    }

    console.log(`🔢 Création matrice horaire pour ${clientsWithEnergy.length} client(s)`);

    // Récupérer toutes les dates et heures uniques
    const allDatesSet = new Set();
    const allHoursSet = new Set();

    // Premier passage : collecter toutes les dates et heures
    clientsWithEnergy.forEach(clientId => {
        const clientData = allResultsByClient[clientId];
        if (clientData.combinedHourlyData) {
            clientData.combinedHourlyData.forEach(item => {
                if (item.date && item.heure) {
                    const formattedHour = formatHeureColon(item.heure);
                    allDatesSet.add(item.date);
                    allHoursSet.add(formattedHour);
                }
            });
        }
    });

    // Trier les dates et heures
    const allDates = Array.from(allDatesSet).sort((a, b) => {
        const dateA = convertToComparableDate(a);
        const dateB = convertToComparableDate(b);
        return dateA.localeCompare(dateB);
    });

    const allHours = Array.from(allHoursSet).sort((a, b) => {
        const hourA = a ? parseInt(a.split(':')[0]) : 0;
        const hourB = b ? parseInt(b.split(':')[0]) : 0;
        return hourA - hourB;
    });

    // Initialiser la structure de données
    allClientsHourlyMatrix = {
        dates: allDates,
        hours: allHours,
        data: {},
        clients: clientsWithEnergy.sort((a, b) => parseInt(a, 16) - parseInt(b, 16))
    };

    // Remplir la matrice
    allDates.forEach(date => {
        allHours.forEach(hour => {
            const key = `${date}_${hour}`;
            allClientsHourlyMatrix.data[key] = {
                tension: null
            };

            // Initialiser chaque client
            allClientsHourlyMatrix.clients.forEach(clientId => {
                allClientsHourlyMatrix.data[key][`client_${clientId}`] = null;
            });
        });
    });

    // Remplir avec les données réelles
    clientsWithEnergy.forEach(clientId => {
        const clientData = allResultsByClient[clientId];
        if (clientData.combinedHourlyData) {
            clientData.combinedHourlyData.forEach(item => {
                if (item.date && item.heure) {
                    const formattedHour = formatHeureColon(item.heure);
                    const key = `${item.date}_${formattedHour}`;

                    if (allClientsHourlyMatrix.data[key]) {
                        allClientsHourlyMatrix.data[key][`client_${clientId}`] = item.energie || 0;

                        // Ajouter la tension si disponible
                        if (item.tension !== null && item.tension !== undefined) {
                            allClientsHourlyMatrix.data[key].tension = item.tension;
                        }
                    }
                }
            });
        }
    });

    // Remplir les tensions manquantes depuis les données de tension
    if (tensionResults && tensionResults.length > 0) {
        tensionResults.forEach(tensionItem => {
            if (tensionItem.date && tensionItem.heure) {
                const formattedHour = formatHeureColon(tensionItem.heure);
                const key = `${tensionItem.date}_${formattedHour}`;

                if (allClientsHourlyMatrix.data[key] &&
                    (allClientsHourlyMatrix.data[key].tension === null ||
                        allClientsHourlyMatrix.data[key].tension === undefined)) {
                    allClientsHourlyMatrix.data[key].tension = tensionItem.tension || tensionItem.valeur || 0;
                }
            }
        });
    }

    console.log(`✅ Matrice horaire créée: ${allDates.length} dates × ${allHours.length} heures = ${Object.keys(allClientsHourlyMatrix.data).length} combinaisons`);
    console.log(`👥 Clients: ${allClientsHourlyMatrix.clients.map(id => `${id.padStart(2, '0')}-${allResultsByClient[id].forfait || 'N/A'}`).join(', ')}`);
}

function calculateEnergyDailyStats(clientId, results) {
    const clientData = allResultsByClient[clientId];
    if (!clientData) return;

    const dailyGroups = {};

    results.forEach(result => {
        const date = result.date;
        if (!date) return;

        if (!dailyGroups[date]) {
            dailyGroups[date] = {
                values: [],
                heures: []
            };
        }

        if (typeof result.valeur === 'number') {
            dailyGroups[date].values.push(result.valeur);
        }
        if (result.heure) {
            dailyGroups[date].heures.push(result.heure);
        }
    });

    clientData.energyDailyData = Object.keys(dailyGroups).map(date => {
        const values = dailyGroups[date].values;
        const heures = dailyGroups[date].heures;

        const sum = values.reduce((a, b) => a + b, 0);
        const avg = values.length > 0 ? Math.round(sum / values.length) : 0;
        const max = values.length > 0 ? Math.max(...values) : 0;

        let maxHour = '';
        if (values.length > 0 && heures.length === values.length) {
            const maxIndex = values.indexOf(max);
            if (maxIndex !== -1 && heures[maxIndex]) {
                maxHour = formatHeureColon(heures[maxIndex]);
            }
        }

        return {
            date,
            energieMoyenne: avg,
            energieMax: max,
            heureMax: maxHour,
            nbPoints: values.length
        };
    }).sort((a, b) => {
        const dateA = convertToComparableDate(a.date);
        const dateB = convertToComparableDate(b.date);
        return dateA.localeCompare(dateB);
    });
}

function createCombinedDailySummary(clientId) {
    const clientData = allResultsByClient[clientId];
    const creditData = creditResultsByClient[clientId];

    if (!clientData) return;

    const energyDaily = clientData.energyDailyData || [];
    const creditDaily = (creditData && creditData.dailySummary) || [];

    const dailyMap = {};

    energyDaily.forEach(day => {
        dailyMap[day.date] = {
            date: day.date,
            energieMoyenne: day.energieMoyenne,
            energieMax: day.energieMax,
            heureMax: day.heureMax,
            credit: null,
            tensionMin: null,
            tensionMax: null
        };
    });

    creditDaily.forEach(day => {
        const creditValue = day.credit || day.creditMoyen || day.valeur || null;

        if (dailyMap[day.date]) {
            dailyMap[day.date].credit = creditValue;
        } else {
            dailyMap[day.date] = {
                date: day.date,
                energieMoyenne: null,
                energieMax: null,
                heureMax: null,
                credit: creditValue,
                tensionMin: null,
                tensionMax: null
            };
        }
    });

    if (tensionDailySummary && tensionDailySummary.length > 0) {
        tensionDailySummary.forEach(day => {
            if (dailyMap[day.date]) {
                dailyMap[day.date].tensionMin = day.valeurMin;
                dailyMap[day.date].tensionMax = day.valeurMax;
            } else {
                dailyMap[day.date] = {
                    date: day.date,
                    energieMoyenne: null,
                    energieMax: null,
                    heureMax: null,
                    credit: null,
                    tensionMin: day.valeurMin,
                    tensionMax: day.valeurMax
                };
            }
        });
    }

    dailySummaryByClient[clientId] = Object.values(dailyMap).sort((a, b) => {
        const dateA = convertToComparableDate(a.date);
        const dateB = convertToComparableDate(b.date);
        return dateA.localeCompare(dateB);
    });
}

function getPaginatedDailySummary(clientId) {
    const dailySummary = dailySummaryByClient[clientId] || [];
    if (!dailySummary.length) return [];

    const itemsPerPg = dailySummaryItemsPerPage[clientId] || 20;
    const currentPage = dailySummaryCurrentPage[clientId] || 1;
    const startIndex = (currentPage - 1) * itemsPerPg;
    const endIndex = startIndex + itemsPerPg;

    return dailySummary.slice(startIndex, endIndex);
}

function displayClientsTabs() {
    const tabsContainer = document.getElementById('clients-tabs');
    const tabsContent = document.getElementById('clients-tabs-content');

    if (Object.keys(allResultsByClient).length === 0) {
        tabsContainer.innerHTML = '<p class="no-clients">Aucun client trouvé</p>';
        return;
    }

    const sortedClients = Object.keys(allResultsByClient).sort((a, b) => {
        const numA = parseInt(a, 16) || 0;
        const numB = parseInt(b, 16) || 0;
        return numA - numB;
    });

    // === ONGLETS PRINCIPAUX ===
    let mainTabsHTML = '<div class="main-tabs-header">';
    mainTabsHTML += `
        <button class="main-tab active" 
                data-main-tab="TECHNIQUE" 
                onclick="switchMainTab('TECHNIQUE', this)">
            <span class="tab-icon">⚙️</span>
            <span class="tab-label">TECHNIQUE</span>
        </button>
        <button class="main-tab" 
                data-main-tab="COMMERCIALE" 
                onclick="switchMainTab('COMMERCIALE', this)">
            <span class="tab-icon">💼</span>
            <span class="tab-label">COMMERCIALE</span>
        </button>
    `;
    mainTabsHTML += '</div>';

    // === ONGLETS SECONDAIRES (Clients) ===
    let subTabsHTML = '<div class="sub-tabs-header">';

    // Onglet "TOUS LES CLIENTS" (TECHNIQUE)
    subTabsHTML += `
        <button class="sub-tab active" 
                data-sub-tab="ALL" 
                data-main="TECHNIQUE"
                onclick="switchSubTab('ALL', 'TECHNIQUE', this)">
            <span class="tab-icon">👥</span>
            <span class="tab-label">TOUS LES CLIENTS</span>
        </button>
    `;

    // Onglets clients individuels (COMMERCIALE)
    sortedClients.forEach((clientId, index) => {
        const clientData = allResultsByClient[clientId];
        const tabLabel = `${clientId.padStart(2, '0')}-${clientData.forfait || 'N/A'}`;

        subTabsHTML += `
            <button class="sub-tab" 
                    data-sub-tab="${clientId}" 
                    data-main="COMMERCIALE"
                    onclick="switchSubTab('${clientId}', 'COMMERCIALE', this)">
                <span class="tab-icon">👤</span>
                <span class="tab-label">${tabLabel}</span>
            </button>
        `;
    });

    subTabsHTML += '</div>';

    // === CONTENU DES ONGLETS ===
    let contentHTML = '';

    // Contenu TECHNIQUE (Tous les clients)
    contentHTML += `
        <div class="main-content active" id="main-content-TECHNIQUE">
            <div class="sub-content active" id="sub-content-ALL">
            </div>
        </div>
    `;

    // Contenu COMMERCIALE (Clients individuels)
    contentHTML += `
        <div class="main-content" id="main-content-COMMERCIALE">
    `;

    sortedClients.forEach((clientId, index) => {
        contentHTML += `
            <div class="sub-content" id="sub-content-${clientId}">
            </div>
        `;
    });

    contentHTML += '</div>';

    tabsContainer.innerHTML = mainTabsHTML + subTabsHTML;
    tabsContent.innerHTML = contentHTML;

    // Initialiser le premier client COMMERCIALE
    if (sortedClients.length > 0) {
        currentSubClientTab = sortedClients[0];
    }

    document.getElementById('tabs-section').classList.remove('hidden');
}

window.switchMainTab = function (mainTab, tabElement) {
    console.log(`🔀 Changement onglet principal vers: ${mainTab}`);

    currentMainTab = mainTab;

    // Activer l'onglet principal
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    tabElement.classList.add('active');

    // Afficher le contenu principal
    document.querySelectorAll('.main-content').forEach(content => {
        content.classList.remove('active');
    });

    const mainContentElement = document.getElementById(`main-content-${mainTab}`);
    if (mainContentElement) {
        mainContentElement.classList.add('active');
    }

    // === GÉRER LA VISIBILITÉ DES SOUS-ONGLETS ===
    // Masquer/Afficher les sous-onglets selon l'onglet principal
    document.querySelectorAll('.sub-tab').forEach(tab => {
        const tabMainAttr = tab.getAttribute('data-main');
        if (tabMainAttr === mainTab) {
            tab.classList.remove('hidden');
        } else {
            tab.classList.add('hidden');
        }
        tab.classList.remove('active');
    });

    // Activer le premier sous-onglet correspondant à cet onglet principal
    const firstSubTab = document.querySelector(`.sub-tab[data-main="${mainTab}"]`);
    if (firstSubTab) {
        firstSubTab.classList.add('active');
        const subTabValue = firstSubTab.getAttribute('data-sub-tab');

        // Afficher le contenu du sous-onglet
        document.querySelectorAll('.sub-content').forEach(content => {
            content.classList.remove('active');
        });

        const subContentElement = document.getElementById(`sub-content-${subTabValue}`);
        if (subContentElement) {
            subContentElement.classList.add('active');

            if (subTabValue === 'ALL') {
                displayAllClientsTab();
            } else if (allResultsByClient[subTabValue]) {
                displayClientData(subTabValue, allResultsByClient[subTabValue]);
            }
        }
    }
};

window.switchSubTab = function (clientId, mainTab, tabElement) {
    console.log(`🔀 Changement vers: ${clientId} (${mainTab})`);

    // Désactiver tous les sous-onglets
    document.querySelectorAll('.sub-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    tabElement.classList.add('active');

    // Afficher le contenu du sous-onglet
    document.querySelectorAll('.sub-content').forEach(content => {
        content.classList.remove('active');
    });

    const contentElement = document.getElementById(`sub-content-${clientId}`);
    if (contentElement) {
        contentElement.classList.add('active');

        if (clientId === 'ALL') {
            displayAllClientsTab();
        } else if (allResultsByClient[clientId]) {
            currentSubClientTab = clientId;
            displayClientData(clientId, allResultsByClient[clientId]);
        }
    }
};

window.switchClientTab = function (clientId, tabElement) {
    // Fonction Legacy pour compatibilité
    switchSubTab(clientId, 'COMMERCIALE', tabElement);
};

function displayClientData(clientId, clientData) {
    const contentElement = document.getElementById(`sub-content-${clientId}`);
    if (!contentElement) return;

    const dailySummary = dailySummaryByClient[clientId] || [];
    const hasEnergy = clientData.energyFiles.length > 0;

    const clientTitle = `${clientId.padStart(2, '0')}-${clientData.forfait || 'N/A'}`;
    // Générer la section commerciale (phrases analytiques)
    const commercialSectionHTML = generateCommercialSectionHTML(clientId, clientData);
    // Générer la section crédit (analyse comportement crédit)
    const creditSectionHTML = generateCreditBehaviorHTML(clientId, clientData);

    contentElement.innerHTML = `
        <div class="client-header">
            <h3>${clientTitle} - Résumé Journalier</h3>
        </div>
        ${commercialSectionHTML}
        ${creditSectionHTML}
        <!-- Tableau Journalier -->
        ${dailySummary.length > 0 ? displayDailySummaryTable(clientId, dailySummary) : ''}
        
        ${hasEnergy ? `
        <div class="client-hourly-section">
            <h4>📊 Données Horaires</h4>
            <div class="table-container">
                <div class="table-wrapper">
                    <table class="client-hourly-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Date</th>
                                <th>Heure</th>
                                <th>Énergie (Wh)</th>
                                <th>Tension (V)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clientData.combinedHourlyData && clientData.combinedHourlyData.length > 0 ?
                clientData.combinedHourlyData.map((item, index) => {
                    const heure = formatHeureColon(item.heure);
                    const hasTension = item.tension !== null && item.tension !== undefined;
                    const tensionColor = hasTension ? getTensionColor(item.tension) : '#718096';

                    return `
                                    <tr>
                                        <td class="row-index">${index + 1}</td>
                                        <td class="row-date">${item.date || 'N/A'}</td>
                                        <td class="row-hour">${heure}</td>
                                        <td class="row-energy">${item.energie || 0}</td>
                                        <td class="row-tension" style="color: ${tensionColor}">
                                            ${hasTension ? item.tension.toFixed(1) : '-'}
                                        </td>
                                    </tr>
                                    `;
                }).join('') :
                '<tr><td colspan="5" style="text-align: center; padding: 20px;">Aucune donnée horaire disponible</td></tr>'
            }
                        </tbody>
                    </table>
                </div>
                
                ${clientData.combinedHourlyData && clientData.combinedHourlyData.length > 50 ? `
                <div class="table-info">
                    📋 ${clientData.combinedHourlyData.length} enregistrement(s) au total
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}
    `;
}

// ======================== ANALYSE COMMERCIALE ========================
function getLocalForfaitLimits(forfaitName) {
    const FORFAITS_LOCAL = {
        ECO: { max: 50, heures: 5 },
        ECLAIRAGE: { max: 90, heures: 5 },
        "ECLAIRAGE +": { max: 150, heures: 5 },
        MULTIMEDIA: { max: 210, heures: 5 },
        "MULTIMEDIA +": { max: 210, heures: 5 },
        "ECLAIRAGE PUBLIC": { max: 150, heures: 11 },
        CONGEL: { max: 1250, heures: 24 },
        PRENIUM: { max: 500, heures: 24 },
        "FREEZER 1": { max: 1000, heures: 24 },
        "FREEZER 3": { max: 1000, heures: 24 }
    };

    const key = (forfaitName || 'ECO').toUpperCase();
    return FORFAITS_LOCAL[key] || FORFAITS_LOCAL.ECO;
}

function generateCommercialSectionHTML(clientId, clientData) {
    const daily = dailySummaryByClient[clientId] || clientData.energyDailyData || [];
    if (!daily || daily.length === 0) return '';

    // Récupérer limites forfait
    const forfaitName = clientData.forfait || 'ECO';
    const limits = (typeof window.getForfaitLimits === 'function')
        ? window.getForfaitLimits(forfaitName)
        : getLocalForfaitLimits(forfaitName);
    const forfaitMax = (limits && limits.max) ? limits.max : getLocalForfaitLimits('ECO').max;

    const daysTotal = daily.length;
    const daysAbove70 = daily.filter(d => (d.energieMax || 0) > 0.7 * forfaitMax).length;
    const percentAbove70 = Math.round((daysAbove70 / daysTotal) * 100);
    const daysAbove70List = daily.filter(d => (d.energieMax || 0) > 0.7 * forfaitMax).map(d => ({ date: d.date, valeur: d.energieMax, heure: d.heureMax }));

    // Moyenne / médiane des pics journaliers
    const maxValues = daily.map(d => d.energieMax || 0).sort((a,b)=>a-b);
    const avgMax = maxValues.length ? Math.round(maxValues.reduce((a,b)=>a+b,0)/maxValues.length) : 0;
    const medianMax = maxValues.length ? (maxValues.length%2===1 ? maxValues[Math.floor(maxValues.length/2)] : Math.round((maxValues[maxValues.length/2 -1] + maxValues[maxValues.length/2])/2)) : 0;

    const daysReachedMax = daily.filter(d => (d.energieMax || 0) >= forfaitMax);
    // Ne considérer comme "avant 23:00" que les heures entre 01:00 et 22:59 (exclure 00:00 et 23:00)
    const daysReachedMaxBefore23 = daysReachedMax.filter(d => {
        if (!d.heureMax) return false;
        const h = formatHeureColon(d.heureMax);
        const hour = parseInt(h.split(':')[0], 10);
        if (isNaN(hour)) return false;
        return hour >= 1 && hour <= 22;
    });

    // Top jours
    const sortedByMax = [...daily].sort((a, b) => (b.energieMax || 0) - (a.energieMax || 0));
    const topList = sortedByMax.slice(0, 3);

    // Styles selon gravité
    const severity = percentAbove70 >= 80 ? 'high' : percentAbove70 >= 40 ? 'medium' : 'low';
    const severityColors = {
        high: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
        medium: { bg: '#fff7ed', border: '#f97316', text: '#7c2d12' },
        low: { bg: '#f0f9ff', border: '#60a5fa', text: '#1e3a8a' }
    };
    const sc = severityColors[severity];

    // Construire HTML stylé
    const html = `
        <div class="commercial-section" style="margin:12px 0; padding:14px; background:#ffffff; border-radius:10px; border:1px solid #e6eef6; box-shadow: 0 2px 6px rgba(15,23,42,0.03);">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <div style="font-weight:700; font-size:15px; color:#0f172a; display:flex; align-items:center; gap:8px;">💼 Analyse commerciale</div>
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;"> 
                    <div style="background:#eef2ff; color:#3730a3; padding:6px 8px; border-radius:999px; font-size:13px; font-weight:600;">${daysTotal} jours</div>
                    <div style="background:${sc.bg}; border:1px solid ${sc.border}; color:${sc.text}; padding:6px 10px; border-radius:999px; font-size:13px; font-weight:700;">${daysAbove70} (${percentAbove70}%) &gt;70%</div>
                    <div style="background:#fef2f2; color:#c53030; padding:6px 8px; border-radius:999px; font-size:13px; font-weight:600;">Max atteints: ${daysReachedMax.length}</div>
                </div>
            </div>

            <div style="margin-top:12px; color:#374151; font-size:13px; line-height:1.5;">
                ${daysReachedMax.length === 0 ?
                    `<div style="margin-bottom:8px;">Aucun jour n'a atteint le maximum du forfait (${forfaitName}).</div>` :
                          (daysReachedMaxBefore23.length > 0 ?
                                `<div style="margin-bottom:8px; color:#92400e; font-weight:600;">Attention: le maximum du forfait a été atteint les jours suivants (ex.) :</div>
                                 <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                                     ${daysReachedMaxBefore23.slice(0,10).map(d => `<span style="background:#fff7ed; border:1px solid #fce7d6; color:#7c2d12; padding:6px 10px; border-radius:999px; font-size:12px;">${d.date} — ${d.energieMax} Wh @ ${formatHeureColon(d.heureMax) || '-'} </span>`).join('')}
                                 </div>` :
                        `<div style="margin-bottom:8px; color:#065f46; font-weight:600;">Le maximum du forfait est atteint principalement à 23:00 (pic en fin de journée).</div>`)
                }

                        <!-- Détails consommation >70% -->
                        <div style="margin-top:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <div style="font-size:13px; color:#374151;">Jours &gt;70% :</div>
                            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                                ${daysAbove70List.length ? daysAbove70List.slice(0,10).map(d => `<span style="background:#eef2ff; color:#1e3a8a; padding:6px 8px; border-radius:999px; font-size:12px;">${d.date} — ${d.valeur} Wh @ ${formatHeureColon(d.heure)||'-'}</span>`).join('') : `<span style="color:#718096;">Aucun</span>`}
                            </div>
                            <div style="margin-left:auto; font-size:13px; color:#374151;">Moyenne pics: <strong>${avgMax} Wh</strong> — Médiane: <strong>${medianMax} Wh</strong></div>
                        </div>

                        <div style="margin-top:6px; padding:10px; border-radius:8px; background:${sc.bg}; border:1px solid ${sc.border}; color:${sc.text}; font-weight:600;">${severity === 'high' ? 'Comportement: Consommation élevée et régulière, proche du plafond.' : severity === 'medium' ? 'Comportement: Consommation variable, parfois proche du plafond.' : 'Comportement: consommation généralement basse par rapport au forfait.'}</div>

                <div style="margin-top:10px; font-size:12.5px; color:#374151;">
                    <div style="font-weight:700; margin-bottom:6px;">Plus fortes consommations</div>
                    <div style="color:#475569; font-size:13px;">${topList.map(d => `${d.date}: ${d.energieMax} Wh (${d.heureMax || '-'})`).join(' <span style="color:#cbd5e1">|</span> ')}</div>
                </div>
            </div>
        </div>
    `;

    return html;
}

// ======================== ANALYSE CRÉDIT (COMMERCIALE) ========================
function generateCreditBehaviorHTML(clientId, clientData) {
    const creditData = creditResultsByClient[clientId];
    const daily = creditData && creditData.dailySummary ? creditData.dailySummary : [];

    // Si aucune donnée crédit, rien à afficher
    if ((!daily || daily.length === 0) && (!creditData || !creditData.results || creditData.results.length === 0)) {
        return '';
    }

    // Utiliser dailySummary si disponible, sinon créer à partir des résultats
    let dailySummary = daily;
    if ((!dailySummary || dailySummary.length === 0) && creditData && creditData.results) {
        if (typeof window.generateCreditDailySummary === 'function') {
            dailySummary = window.generateCreditDailySummary(creditData.results) || [];
        } else {
            dailySummary = [];
        }
    }

    // Jours sans crédit (creditMoyen === 0)
    const zeroDays = (dailySummary || []).filter(d => (d.creditMoyen === 0 || d.creditMoyen === '0'));

    // Calculer évolution pour détecter achats importants
    const evolution = (creditData && creditData.results && typeof window.calculateCreditEvolution === 'function')
        ? window.calculateCreditEvolution(creditData.results)
        : [];

    // Détecter achats passant de 0 à >=30 et >=15
    const bigPurchases30 = evolution.filter((e, idx, arr) => {
        if (idx === 0) return false;
        const prev = arr[idx - 1];
        return prev && prev.credit === 0 && e.credit >= 30;
    });
    const bigPurchases15 = evolution.filter((e, idx, arr) => {
        if (idx === 0) return false;
        const prev = arr[idx - 1];
        return prev && prev.credit === 0 && e.credit >= 15;
    });

    // Construire messages
    const parts = [];
    parts.push(`<strong>Analyse crédit</strong>`);

    if (zeroDays.length > 0) {
        const preview = zeroDays.slice(0, 6).map(d => d.date).join(', ');
        parts.push(`${zeroDays.length} jour(s) sans crédit détecté(s) (ex.: ${preview}${zeroDays.length > 6 ? ', ...' : ''}).`);
    } else {
        parts.push('Aucun jour sans crédit détecté.');
    }

    if (bigPurchases30.length > 0) {
        const list30 = bigPurchases30.slice(0, 6).map(b => `${b.date} (0 → ${b.credit} jours)`).join(', ');
        parts.push(`<span style="color:#9b2c2c; font-weight:700;">Achats ≥30j détectés:</span> ${list30}${bigPurchases30.length > 6 ? ', ...' : ''}.`);
    } else {
        parts.push('Aucun achat ≥30j (0 → ≥30 jours) détecté.');
    }

    if (bigPurchases15.length > 0) {
        const list15 = bigPurchases15.slice(0, 6).map(b => `${b.date} (0 → ${b.credit} jours)`).join(', ');
        parts.push(`<span style="background:#ecfdf5; color:#065f46; padding:4px 8px; border-radius:6px; font-weight:700;">Achats ≥15j détectés:</span> ${list15}${bigPurchases15.length > 6 ? ', ...' : ''}.`);
    }

    // Synthèse courte
    let synth = '';
    if (bigPurchases30.length > 0) synth = 'Comportement: Achats ponctuels très importants (≥30j) détectés.';
    else if (bigPurchases15.length > 0) synth = 'Comportement: Achats importants (≥15j) détectés.';
    else if (zeroDays.length > 0) synth = 'Comportement: périodes sans crédit détectées, surveiller.';
    else synth = 'Comportement: crédit stable.';
    parts.push(`<em>${synth}</em>`);

    // HTML compact et stylé
    const html = `
        <div class="credit-behavior" style="margin:10px 0 14px; padding:12px; background:#fffaf0; border-radius:8px; border:1px solid #fbe7c6;">
            <div style="font-size:13px; color:#92400e;">${parts.map(p => `<div style=\"margin-bottom:6px;\">${p}</div>`).join('')}</div>
        </div>
    `;

    return html;
}

function displayDailySummaryTable(clientId, dailySummary) {
    if (!dailySummary || dailySummary.length === 0) return '';

    const paginatedData = getPaginatedDailySummary(clientId);
    const totalItems = dailySummary.length;
    const itemsPerPage = dailySummaryItemsPerPage[clientId] || 20;
    const currentPage = dailySummaryCurrentPage[clientId] || 1;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const rows = paginatedData.map((day, index) => {
        const globalIndex = ((currentPage - 1) * itemsPerPage) + index + 1;
        const hasEnergy = day.energieMoyenne !== null;
        const hasCredit = day.credit !== null;
        const hasTension = day.tensionMin !== null || day.tensionMax !== null;

        const getCreditColor = (days) => {
            if (days === null || days === undefined) return '#718096';
            if (days === 0) return '#e53e3e';
            if (days < 7) return '#dd6b20';
            if (days < 15) return '#d69e2e';
            if (days < 30) return '#38a169';
            if (days < 60) return '#2b6cb0';
            return '#2b6cb0';
        };

        const getTensionColor = (tensionMin, tensionMax) => {
            if (tensionMin === null || tensionMax === null) return '#718096';

            const avgTension = (tensionMin + tensionMax) / 2;
            const systemType = detectSystemTypeFromTensionValue(avgTension);

            if (systemType === '24V') {
                if (tensionMin < 21.4 || tensionMax > 31.5) return '#e53e3e';
                if (tensionMin < 24 || tensionMax > 29) return '#d69e2e';
                return '#38a169';
            } else {
                if (tensionMin < 10.7 || tensionMax > 15.6) return '#e53e3e';
                if (tensionMin < 12 || tensionMax > 14.5) return '#d69e2e';
                return '#38a169';
            }
        };

        const creditColor = hasCredit ? getCreditColor(day.credit) : '#718096';
        const creditDisplay = hasCredit ? day.credit : '-';

        const tensionColor = hasTension ? getTensionColor(day.tensionMin, day.tensionMax) : '#718096';
        const tensionDisplay = hasTension ?
            `${day.tensionMin !== null ? day.tensionMin.toFixed(1) : '-'}/${day.tensionMax !== null ? day.tensionMax.toFixed(1) : '-'}` :
            '-';

        return `
            <tr>
                <td class="row-index">${globalIndex}</td>
                <td class="row-date">${day.date || 'N/A'}</td>
                <td class="row-energy">${hasEnergy ? day.energieMoyenne : '-'}</td>
                <td class="row-energy">${hasEnergy ? day.energieMax : '-'}</td>
                <td class="row-hour">${hasEnergy && day.heureMax ? day.heureMax : '-'}</td>
                <td class="row-credit" style="color: ${creditColor}; font-weight: bold;">
                    ${creditDisplay}
                </td>
                <td class="row-tension" style="color: ${tensionColor}; font-weight: bold;">
                    ${tensionDisplay}
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="daily-summary-container">
            <div class="table-container">
                <div class="table-wrapper">
                    <table class="daily-summary-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Date</th>
                                <th>Énergie Moyenne</th>
                                <th>Énergie Max</th>
                                <th>Heure Max</th>
                                <th>Crédit (jours)</th>
                                <th>Tension Min/Max (V)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
                
                ${totalPages > 1 ? `
                <div class="table-footer">
                    <div class="pagination">
                        <button class="pagination-btn first" 
                                onclick="changeDailySummaryPage('${clientId}', 1)" 
                                ${currentPage <= 1 ? 'disabled' : ''}>
                            « Première
                        </button>
                        <button class="pagination-btn prev" 
                                onclick="changeDailySummaryPage('${clientId}', ${currentPage - 1})" 
                                ${currentPage <= 1 ? 'disabled' : ''}>
                            ‹ Précédente
                        </button>
                        
                        <div class="page-info">
                            Page <strong>${currentPage}</strong> sur <strong>${totalPages}</strong>
                            <span class="items-info">(${totalItems} jour${totalItems !== 1 ? 's' : ''})</span>
                        </div>
                        
                        <button class="pagination-btn next" 
                                onclick="changeDailySummaryPage('${clientId}', ${currentPage + 1})" 
                                ${currentPage >= totalPages ? 'disabled' : ''}>
                            Suivante ›
                        </button>
                        <button class="pagination-btn last" 
                                onclick="changeDailySummaryPage('${clientId}', ${totalPages})" 
                                ${currentPage >= totalPages ? 'disabled' : ''}>
                            Dernière »
                        </button>
                    </div>
                </div>
                ` : ''}
                
                <div class="table-info">
                    📋 ${paginatedData.length} jour(s) affiché(s) sur cette page
                </div>
            </div>
        </div>
    `;
}

// ======================== FONCTIONS D'ANALYSE DE STABILITÉ ========================

function analyzeTensionStability(tensionResults) {
    if (!tensionResults || !tensionResults.length) {
        return {
            stable: 0,
            unstable: 0,
            outOfLimits: 0,
            stabilityPercentage: 0,
            averageVariation: 0,
            days: 0
        };
    }

    // Group by date for daily analysis
    const dailyData = {};
    tensionResults.forEach(item => {
        if (!dailyData[item.date]) {
            dailyData[item.date] = {
                values: [],
                min: Infinity,
                max: -Infinity
            };
        }
        dailyData[item.date].values.push(item.tension || item.valeur || 0);
        if (item.tension < dailyData[item.date].min) {
            dailyData[item.date].min = item.tension;
        }
        if (item.tension > dailyData[item.date].max) {
            dailyData[item.date].max = item.tension;
        }
    });

    // Detect system type
    const systemType = detectSystemType(tensionResults);
    const limits = getSystemLimits(systemType);

    let stableDays = 0;
    let unstableDays = 0;
    let outOfLimitsDays = 0;

    // Analyze each day
    Object.values(dailyData).forEach(day => {
        const variation = day.max - day.min;
        const avg = day.values.reduce((a, b) => a + b, 0) / day.values.length;

        if (day.min < limits.min || day.max > limits.max) {
            outOfLimitsDays++;
        } else if (variation > (systemType === '24V' ? 5 : 2.5)) {
            unstableDays++;
        } else {
            stableDays++;
        }
    });

    // Calculate hourly variations
    const variations = [];
    for (let i = 1; i < tensionResults.length; i++) {
        if (tensionResults[i].date === tensionResults[i - 1].date) {
            const variation = Math.abs(
                (tensionResults[i].tension || tensionResults[i].valeur || 0) -
                (tensionResults[i - 1].tension || tensionResults[i - 1].valeur || 0)
            );
            variations.push(variation);
        }
    }

    const averageVariation = variations.length > 0
        ? (variations.reduce((a, b) => a + b, 0) / variations.length).toFixed(3)
        : 0;

    const totalDays = Object.keys(dailyData).length;
    const stabilityPercentage = totalDays > 0
        ? Math.round((stableDays / totalDays) * 100)
        : 0;

    return {
        stable: stableDays,
        unstable: unstableDays,
        outOfLimits: outOfLimitsDays,
        stabilityPercentage,
        averageVariation: parseFloat(averageVariation),
        days: totalDays,
        systemType,
        limits
    };
}

function detectSystemType(tensionResults) {
    if (!tensionResults || tensionResults.length === 0) return '12V';

    const tensions = tensionResults
        .map(r => r.tension || r.valeur)
        .filter(t => t > 0);

    if (tensions.length === 0) return '12V';

    const avgTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;
    const maxTension = Math.max(...tensions);

    return (maxTension > 20 || avgTension > 18) ? '24V' : '12V';
}

function getSystemLimits(systemType) {
    if (systemType === '24V') {
        return {
            min: 21.4,
            max: 31.5,
            ideal: { min: 24, max: 29 },
            normal: 28,
            maxVariation: 5,
            alertThreshold: 3
        };
    } else {
        return {
            min: 10.7,
            max: 15.6,
            ideal: { min: 12, max: 14.5 },
            normal: 14,
            maxVariation: 2.5,
            alertThreshold: 1.5
        };
    }
}

function getTensionStatus(tensionMin, tensionMax, systemType) {
    const limits = getSystemLimits(systemType);

    if (tensionMin < limits.min || tensionMax > limits.max) {
        return {
            status: 'Hors limites',
            color: '#e53e3e',
            icon: '🔴',
            severity: 'danger'
        };
    }

    const variation = tensionMax - tensionMin;
    if (variation > limits.maxVariation) {
        return {
            status: 'Instable',
            color: '#d69e2e',
            icon: '🟡',
            severity: 'warning'
        };
    }

    return {
        status: 'Stable',
        color: '#38a169',
        icon: '✅',
        severity: 'success'
    };
}

// Fonctions pour générer la conclusion intelligente
function getConclusionColor(stabilityPercentage) {
    if (stabilityPercentage >= 90) return '#f0fff4'; // Vert très clair
    if (stabilityPercentage >= 80) return '#feebc8'; // Orange clair
    if (stabilityPercentage >= 60) return '#fed7d7'; // Rouge clair
    return '#fed7d7'; // Rouge clair pour très bas
}

function getConclusionBorderColor(stabilityPercentage) {
    if (stabilityPercentage >= 90) return '#38a169'; // Vert
    if (stabilityPercentage >= 80) return '#d69e2e'; // Orange
    if (stabilityPercentage >= 60) return '#e53e3e'; // Rouge
    return '#e53e3e'; // Rouge pour très bas
}

function getConclusionIconColor(stabilityPercentage) {
    if (stabilityPercentage >= 90) return '#38a169';
    if (stabilityPercentage >= 80) return '#d69e2e';
    if (stabilityPercentage >= 60) return '#e53e3e';
    return '#e53e3e';
}

function getConclusionIcon(stabilityPercentage) {
    if (stabilityPercentage >= 90) return '✅';
    if (stabilityPercentage >= 80) return '⚠️';
    if (stabilityPercentage >= 60) return '🔴';
    return '🚫';
}

function getConclusionTitle(stabilityPercentage) {
    if (stabilityPercentage >= 90) return '✅ EXCELLENTE STABILITÉ';
    if (stabilityPercentage >= 80) return '⚠️ STABILITÉ SATISFAISANTE';
    if (stabilityPercentage >= 60) return '🔴 STABILITÉ PRÉOCCUPANTE';
    return 'STABILITÉ CRITIQUE';
}

function getConclusionMessage(stabilityPercentage, stable, unstable, outOfLimits, days, systemType, averageVariation) {
    const stablePercent = days > 0 ? Math.round((stable/days)*100) : 0;
    const unstablePercent = days > 0 ? Math.round((unstable/days)*100) : 0;
    const outOfLimitsPercent = days > 0 ? Math.round((outOfLimits/days)*100) : 0;
    
    let message = '';
    
    if (stabilityPercentage >= 90) {
        message = `La tension du système ${systemType} est <strong>excellente</strong> avec ${stablePercent}% de jours stables. 
                  La variation moyenne de ${averageVariation} V/h est bien en dessous du seuil d'alerte. 
                  L'installation électrique fonctionne de manière optimale.`;
    } 
    else if (stabilityPercentage >= 80) {
        message = `La tension est <strong>globalement stable</strong> (${stablePercent}% de jours stables) mais présente 
                  ${unstablePercent}% de jours avec des variations importantes. 
                  Surveillez la variation moyenne de ${averageVariation} V/h.`;
    }
    else if (stabilityPercentage >= 60) {
        message = `La tension est <strong>préoccupante</strong> avec seulement ${stablePercent}% de jours stables. 
                  ${outOfLimits > 0 ? `${outOfLimits} jour${outOfLimits !== 1 ? 's' : ''} hors limites. ` : ''}
                  La variation moyenne de ${averageVariation} V/h approche du seuil critique. 
                  Une vérification technique est recommandée.`;
    }
    else {
        message = `⚠️ <strong>ALERTE STABILITÉ</strong> ⚠️ La tension est <strong>critiquement instable</strong> (${stablePercent}% de jours stables seulement). 
                  ${outOfLimits > 0 ? `${outOfLimits} jour${outOfLimits !== 1 ? 's' : ''} présentent des tensions hors limites. ` : ''}
                  La variation moyenne de ${averageVariation} V/h dépasse les normes acceptables. 
                  <strong>Intervention technique urgente requise.</strong>`;
    }
    
    return message;
}

// ======================== FONCTIONS DE VISUALISATION DE STABILITÉ ========================

function createStabilityChart(containerId, stabilityData, tensionResults) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { stable, unstable, outOfLimits, stabilityPercentage, systemType, averageVariation, days } = stabilityData;
    const totalDays = stable + unstable + outOfLimits;

    // Dans createStabilityChart(), version ultra-compacte :

    container.innerHTML = `
        <div class="stability-dashboard">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 15px; font-size: 13px;">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span style="color: #718096;">Système:</span>
                        <span style="font-weight: bold; color: #2d3748; background: #e6fffa; padding: 4px 8px; border-radius: 4px;">${systemType}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span style="color: #718096;">Période:</span>
                        <span style="font-weight: bold; color: #2d3748;">${days} jour${days !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>
            
            <!-- Layout 2 colonnes -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <!-- Stats principales -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; width: 100%;">
                    <div style="background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding: 20px; border-radius: 10px; border-left: 5px solid #38a169; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                            <div style="background: #38a169; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                                ✅
                            </div>
                            <div style="font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.8px;">Stables</div>
                        </div>
                        <div style="font-size: 36px; font-weight: bold; color: #38a169; text-align: center; line-height: 1; margin-bottom: 10px;">${stable}</div>
                        <div style="text-align: center;">
                            <span style="font-size: 12px; color: #38a169; font-weight: 600; background: rgba(56, 161, 105, 0.15); padding: 6px 12px; border-radius: 15px;">
                                ${totalDays > 0 ? Math.round((stable / totalDays) * 100) : 0}% des jours
                            </span>
                        </div>
                    </div>
        
                    <div style="background: linear-gradient(135deg, #feebc8 0%, #ffffff 100%); padding: 20px; border-radius: 10px; border-left: 5px solid #d69e2e; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                            <div style="background: #d69e2e; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                                ⚠️
                            </div>
                            <div style="font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.8px;">Instables</div>
                        </div>
                        <div style="font-size: 36px; font-weight: bold; color: #d69e2e; text-align: center; line-height: 1; margin-bottom: 10px;">${unstable}</div>
                        <div style="text-align: center;">
                            <span style="font-size: 12px; color: #d69e2e; font-weight: 600; background: rgba(214, 158, 46, 0.15); padding: 6px 12px; border-radius: 15px;">
                                ${totalDays > 0 ? Math.round((unstable / totalDays) * 100) : 0}% des jours
                            </span>
                        </div>
                    </div>
        
                    <div style="background: linear-gradient(135deg, #fed7d7 0%, #ffffff 100%); padding: 20px; border-radius: 10px; border-left: 5px solid #e53e3e; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                            <div style="background: #e53e3e; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                                🚫
                            </div>
                            <div style="font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.8px;">Hors limites</div>
                        </div>
                        <div style="font-size: 36px; font-weight: bold; color: #e53e3e; text-align: center; line-height: 1; margin-bottom: 10px;">${outOfLimits}</div>
                        <div style="text-align: center;">
                            <span style="font-size: 12px; color: #e53e3e; font-weight: 600; background: rgba(229, 62, 62, 0.15); padding: 6px 12px; border-radius: 15px;">
                                ${totalDays > 0 ? Math.round((outOfLimits / totalDays) * 100) : 0}% des jours
                            </span>
                        </div>
                    </div>
        
                    <div style="background: linear-gradient(135deg, #ebf8ff 0%, #ffffff 100%); padding: 20px; border-radius: 10px; border-left: 5px solid ${stabilityPercentage >= 80 ? '#38a169' : stabilityPercentage >= 60 ? '#d69e2e' : '#e53e3e'}; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                            <div style="background: ${stabilityPercentage >= 80 ? '#38a169' : stabilityPercentage >= 60 ? '#d69e2e' : '#e53e3e'}; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                                📊
                            </div>
                            <div style="font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.8px;">Stabilité</div>
                        </div>
                        <div style="font-size: 36px; font-weight: bold; color: ${stabilityPercentage >= 80 ? '#38a169' : stabilityPercentage >= 60 ? '#d69e2e' : '#e53e3e'}; text-align: center; line-height: 1; margin-bottom: 10px;">${stabilityPercentage}%</div>
                        <div style="text-align: center;">
                            <div style="font-size: 11px; color: #a0aec0; background: #f7fafc; padding: 8px 12px; border-radius: 8px; margin-top: 8px; font-family: 'Courier New', monospace;">
                                <div>Variation moyenne:</div>
                                <div style="font-weight: bold; color: #4a5568; font-size: 12px; margin-top: 3px;">${averageVariation} V/h</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Phrase de conclusion intelligente -->
            <div style="margin-top: 25px; padding: 20px; background: ${getConclusionColor(stabilityPercentage)}; border-radius: 10px; border-left: 5px solid ${getConclusionBorderColor(stabilityPercentage)}; box-shadow: 0 3px 12px rgba(0,0,0,0.08);">
                <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <div style="font-size: 24px; color: ${getConclusionIconColor(stabilityPercentage)};">
                        ${getConclusionIcon(stabilityPercentage)}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #2d3748; font-size: 16px; margin-bottom: 8px;">
                            ${getConclusionTitle(stabilityPercentage)}
                        </div>
                        <div style="color: #4a5568; font-size: 14px; line-height: 1.5;">
                            ${getConclusionMessage(stabilityPercentage, stable, unstable, outOfLimits, days, systemType, averageVariation)}
                        </div>
                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.3);">
                            <div style="display: flex; flex-wrap: wrap; gap: 15px; font-size: 13px; color: #718096;">
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <span>📊</span>
                                    <span>Taux de stabilité: <strong style="color: #2d3748;">${stabilityPercentage}%</strong></span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <span>📅</span>
                                    <span>Période: <strong style="color: #2d3748;">${days} jour${days !== 1 ? 's' : ''}</strong></span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <span>⚡</span>
                                    <span>Variation moyenne: <strong style="color: #2d3748;">${averageVariation} V/h</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Normes système très compactes -->
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 18px; color: #4a5568;">⚡</span>
                        <span style="font-weight: 600; color: #2d3748; font-size: 14px;">Normes système ${systemType}</span>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 20px; font-size: 13px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #718096; font-size: 12px;">MIN</span>
                            <span style="font-weight: bold; color: #2d3748; background: #fff5f5; padding: 4px 8px; border-radius: 4px;">${getSystemLimits(systemType).min}V</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #718096; font-size: 12px;">IDÉAL</span>
                            <span style="font-weight: bold; color: #2d3748; background: #f0fff4; padding: 4px 8px; border-radius: 4px;">${getSystemLimits(systemType).ideal.min}-${getSystemLimits(systemType).ideal.max}V</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #718096; font-size: 12px;">MAX</span>
                            <span style="font-weight: bold; color: #2d3748; background: #fff5f5; padding: 4px 8px; border-radius: 4px;">${getSystemLimits(systemType).max}V</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #718096; font-size: 12px;">Δ/JOUR</span>
                            <span style="font-weight: bold; color: #d69e2e; background: #fefcbf; padding: 4px 8px; border-radius: 4px;">${getSystemLimits(systemType).maxVariation}V</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #718096; font-size: 12px;">ALERTE</span>
                            <span style="font-weight: bold; color: #e53e3e; background: #fed7d7; padding: 4px 8px; border-radius: 4px;">${getSystemLimits(systemType).alertThreshold}V/h</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Create the pie chart
    setTimeout(() => {
        createStabilityPieChart(`${containerId}-stability-chart`, stable, unstable, outOfLimits);
    }, 100);
}

function createStabilityPieChart(canvasId, stable, unstable, outOfLimits) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (window.stabilityPieChart) {
        window.stabilityPieChart.destroy();
    }

    window.stabilityPieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Stable', 'Instable', 'Hors limites'],
            datasets: [{
                data: [stable, unstable, outOfLimits],
                backgroundColor: ['#38a169', '#d69e2e', '#e53e3e'],
                borderColor: ['#2f855a', '#b7791f', '#c53030'],
                borderWidth: 2,
                hoverBackgroundColor: ['#48bb78', '#ecc94b', '#f56565']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        padding: 20,
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        color: '#2c3e50'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0
                                ? Math.round((context.raw / total) * 100)
                                : 0;
                            return `${context.label}: ${context.raw} jour${context.raw !== 1 ? 's' : ''} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// NOUVELLE FONCTION : Afficher l'onglet TOUS LES CLIENTS
function displayAllClientsTab() {
    const contentElement = document.getElementById('sub-content-ALL');
    if (!contentElement) return;

    if (allClientsHourlyMatrix.clients.length === 0) {
        contentElement.innerHTML = `
            <div class="no-data">
                <div class="no-data-content">
                    <span class="no-data-icon">👥</span>
                    <span class="no-data-text">Aucune donnée disponible pour tous les clients</span>
                </div>
            </div>
        `;
        return;
    }

    // === CALCUL DE L'ÉNERGIE MAX PAR JOUR (somme des max de tous les clients) ===
    const energyDataByDay = {};
    const sortedClients = Object.keys(allResultsByClient).sort((a, b) => {
        const numA = parseInt(a, 16) || 0;
        const numB = parseInt(b, 16) || 0;
        return numA - numB;
    });

    // Pour chaque jour, calculer le max de chaque client et faire la somme
    allClientsHourlyMatrix.dates.forEach(date => {
        let totalDayEnergy = 0;

        // Pour chaque client
        sortedClients.forEach(clientId => {
            const clientData = allResultsByClient[clientId];
            let maxEnergyForDay = 0;

            if (clientData.combinedHourlyData && clientData.combinedHourlyData.length > 0) {
                // Trouver le max d'énergie pour ce client ce jour-là
                clientData.combinedHourlyData.forEach(item => {
                    if (item.date === date && item.energie && !isNaN(item.energie)) {
                        maxEnergyForDay = Math.max(maxEnergyForDay, parseFloat(item.energie));
                    }
                });
            }

            totalDayEnergy += maxEnergyForDay;
        });

        energyDataByDay[date] = totalDayEnergy;
    });

    // Préparer les données paginées
    const itemsPerPage = 50;
    const currentPage = window.allClientsCurrentPage || 1;
    const totalItems = allClientsHourlyMatrix.dates.length * allClientsHourlyMatrix.hours.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Calculer les indices de pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    // === CALCULS DES STATISTIQUES ===
    // 1. Énergie maximale et sa date
    let maxEnergyValue = 0;
    let maxEnergyDate = '';
    Object.entries(energyDataByDay).forEach(([date, energy]) => {
        if (energy > maxEnergyValue) {
            maxEnergyValue = energy;
            maxEnergyDate = date;
        }
    });

    // 2. Tension moyenne, tension maximale et tension minimale
    let tensionValues = [];
    let maxTensionValue = 0;
    let maxTensionDate = '';
    let minTensionValue = Infinity;
    let minTensionDate = '';

    allClientsHourlyMatrix.dates.forEach(date => {
        allClientsHourlyMatrix.hours.forEach(hour => {
            const key = `${date}_${hour}`;
            const rowData = allClientsHourlyMatrix.data[key];
            if (rowData && rowData.tension !== null && rowData.tension !== undefined) {
                tensionValues.push(rowData.tension);
                if (rowData.tension > maxTensionValue) {
                    maxTensionValue = rowData.tension;
                    maxTensionDate = date;
                }
                if (rowData.tension < minTensionValue) {
                    minTensionValue = rowData.tension;
                    minTensionDate = date;
                }
            }
        });
    });

    const averageTension = tensionValues.length > 0
        ? (tensionValues.reduce((a, b) => a + b, 0) / tensionValues.length).toFixed(2)
        : 'N/A';

    const minTensionDisplay = minTensionValue !== Infinity ? minTensionValue.toFixed(2) : 'N/A';

    // === CALCUL TENSION MIN/MAX PAR JOUR ===
    const tensionByDay = {};
    allClientsHourlyMatrix.dates.forEach(date => {
        tensionByDay[date] = { min: Infinity, max: -Infinity };
        allClientsHourlyMatrix.hours.forEach(hour => {
            const key = `${date}_${hour}`;
            const rowData = allClientsHourlyMatrix.data[key];
            if (rowData && rowData.tension !== null && rowData.tension !== undefined) {
                tensionByDay[date].min = Math.min(tensionByDay[date].min, rowData.tension);
                tensionByDay[date].max = Math.max(tensionByDay[date].max, rowData.tension);
            }
        });
        // Si aucune donnée n'existe pour ce jour, ne pas afficher
        if (tensionByDay[date].min === Infinity) {
            delete tensionByDay[date];
        }
    });

    // === DÉTECTION DU TYPE DE MONTAGE ===
    const systemType = parseFloat(averageTension) > 20 ? '24V' : '12V';
    const systemLimits = systemType === '24V'
        ? { min: 21.4, max: 31.5, ideal: { min: 24, max: 29 }, normal: 28 }
        : { min: 10.7, max: 15.6, ideal: { min: 12, max: 14.5 }, normal: 14 };

    // === ANALYSE DE STABILITÉ ===
    let stabilityData = null;
    let stabilitySectionHTML = '';

    if (tensionResults && tensionResults.length > 0) {
        stabilityData = analyzeTensionStability(tensionResults);
        stabilitySectionHTML = `
            <!-- SECTION STABILITÉ -->
            <div class="stability-section" style="margin: 25px 0; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
                <h4 style="margin-top: 0; margin-bottom: 15px; color: #2c3e50; display: flex; align-items: center; gap: 10px;">
                    <span>🔄</span> Analyse de Stabilité de la Tension
                </h4>
                <div id="stability-analysis-container"></div>
            </div>
        `;
    } else {
        stabilitySectionHTML = `
            <div class="no-stability-data" style="margin: 25px 0; padding: 40px; background: #f7fafc; border-radius: 8px; border: 2px dashed #cbd5e0; text-align: center;">
                <span style="font-size: 48px; display: block; margin-bottom: 15px; color: #a0aec0;">📊</span>
                <span style="color: #718096; font-size: 14px;">Données de tension insuffisantes pour l'analyse de stabilité</span>
            </div>
        `;
    }

    contentElement.innerHTML = `
        <div class="all-clients-header">
            <h3>👥 DONNÉES TECHNIQUES DU NR</h3>
            <div class="all-clients-stats">
                <div class="stat-item">
                    <span class="stat-icon">📅</span>
                    <span class="stat-text">${allClientsHourlyMatrix.dates.length} jours</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">👤</span>
                    <span class="stat-text">${allClientsHourlyMatrix.clients.length} client${allClientsHourlyMatrix.clients.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">💼</span>
                    <span class="stat-text">Forfaits: ${sortedClients.map(id => `Client${id}-${allResultsByClient[id].forfait || 'N/A'}`).join(', ')}</span>
                </div>
            </div>
            
            <!-- TABLEAU STATISTIQUES -->
            <div class="all-clients-stats-table">
                <table class="stats-summary-table">
                    <tbody>
                        <tr>
                            <td class="stats-label">⚡ Énergie Maximale</td>
                            <td class="stats-value">${maxEnergyValue} Wh</td>
                            <td class="stats-date">${maxEnergyDate}</td>
                        </tr>
                        <tr>
                            <td class="stats-label">📊 Tension Moyenne</td>
                            <td class="stats-value">${averageTension} V</td>
                            <td class="stats-date">Système ${systemType}</td>
                        </tr>
                        <tr>
                            <td class="stats-label">⚡ Tension Minimale</td>
                            <td class="stats-value">${minTensionDisplay} V</td>
                            <td class="stats-date">${minTensionDate || '-'}</td>
                        </tr>
                        <tr>
                            <td class="stats-label">⚡ Tension Maximale</td>
                            <td class="stats-value">${maxTensionValue > 0 ? maxTensionValue.toFixed(2) : 'N/A'} V</td>
                            <td class="stats-date">${maxTensionDate || '-'}</td>
                        </tr>
                        <tr>
                            <td class="stats-label">📏 Variation Max/Jour</td>
                            <td class="stats-value" style="color: #d69e2e;">${(systemType === '24V' ? 5 : 2.5).toFixed(1)} V</td>
                            <td class="stats-date">Seuil alerte: ${systemType === '24V' ? '3' : '1.5'} V/h</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        ${stabilitySectionHTML}
        
        <!-- GRAPHIQUE EN BARRES : ÉNERGIE MAX PAR JOUR -->
        <div class="all-clients-chart-section">
            <h4>⚡ Énergie Maximale Totale par Jour (Somme des Max Clients)</h4>
            <div class="chart-container all-clients-bar-chart-container">
                <canvas id="allClientsEnergyChart"></canvas>
            </div>
        </div>
        
        <!-- GRAPHIQUE TENSION : MIN/MAX PAR JOUR -->
        <div class="all-clients-chart-section">
            <h4>📈 Tension Min/Max par Jour (Système ${systemType})</h4>
            <div class="system-info">
                <span>🔧 Type: ${systemType} DC</span>
                <span>Min acceptable: ${systemLimits.min}V</span>
                <span>Plage idéale: ${systemLimits.ideal.min}-${systemLimits.ideal.max}V</span>
                <span>Max acceptable: ${systemLimits.max}V</span>
            </div>
            <div class="chart-container all-clients-line-chart-container">
                <canvas id="allClientsTensionChart"></canvas>
            </div>
        </div>
        
        <div class="table-controls">
            <div class="pagination-controls">
                <div class="items-per-page">
                    <label>Lignes par page:</label>
                    <select class="items-per-page-select" onchange="changeAllClientsItemsPerPage(this.value)">
                        <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
                        <option value="200" ${itemsPerPage === 200 ? 'selected' : ''}>200</option>
                        <option value="0" ${itemsPerPage === 0 ? 'selected' : ''}>Tous</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="table-container all-clients-matrix">
            <div class="table-wrapper">
                <table class="all-clients-table">
                    <thead>
                        <tr>
                            <th class="sticky-header">#</th>
                            <th class="sticky-header">Date</th>
                            <th class="sticky-header">Heure</th>
                            ${allClientsHourlyMatrix.clients.map(clientId => {
        const clientData = allResultsByClient[clientId];
        const clientLabel = `${clientId.padStart(2, '0')}-${clientData.forfait || 'N/A'}`;
        return `<th class="client-header" title="Client ${clientLabel}">Énergie ${clientId.padStart(2, '0')}</th>`;
    }).join('')}
                            <th class="sticky-header tension-header">Tension (V)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateAllClientsTableRows(startIndex, endIndex)}
                    </tbody>
                </table>
            </div>
            
            ${totalPages > 1 ? `
            <div class="table-footer">
                <div class="pagination">
                    <button class="pagination-btn first" 
                            onclick="changeAllClientsMatrixPage(1)" 
                            ${currentPage <= 1 ? 'disabled' : ''}>
                        « Première
                    </button>
                    <button class="pagination-btn prev" 
                            onclick="changeAllClientsMatrixPage(${currentPage - 1})" 
                            ${currentPage <= 1 ? 'disabled' : ''}>
                        ‹ Précédente
                    </button>
                    
                    <div class="page-info">
                        Page <strong>${currentPage}</strong> sur <strong>${totalPages}</strong>
                        <span class="items-info">(${totalItems} point${totalItems !== 1 ? 's' : ''} de données)</span>
                    </div>
                    
                    <button class="pagination-btn next" 
                            onclick="changeAllClientsMatrixPage(${currentPage + 1})" 
                            ${currentPage >= totalPages ? 'disabled' : ''}>
                        Suivante ›
                    </button>
                    <button class="pagination-btn last" 
                            onclick="changeAllClientsMatrixPage(${totalPages})" 
                            ${currentPage >= totalPages ? 'disabled' : ''}>
                        Dernière »
                    </button>
                </div>
                
                <div class="table-info">
                    📋 Lignes ${startIndex + 1} à ${endIndex} sur ${totalItems} au total
                    | 👥 ${allClientsHourlyMatrix.clients.length} client${allClientsHourlyMatrix.clients.length !== 1 ? 's' : ''}
                </div>
            </div>
            ` : ''}
        </div>
    `;

    // === CRÉER LES GRAPHIQUES ===
    setTimeout(() => {
        createAllClientsEnergyChart(allClientsHourlyMatrix.dates, energyDataByDay, maxEnergyDate);
        createAllClientsTensionChart(allClientsHourlyMatrix.dates, tensionByDay, systemType, systemLimits);

        // AJOUT IMPORTANT : Créer le graphique de stabilité
        if (stabilityData) {
            createStabilityChart('stability-analysis-container', stabilityData, tensionResults);
        }
    }, 100);
}

// NOUVELLE FONCTION : Générer les lignes du tableau tous clients
function generateAllClientsTableRows(startIndex, endIndex) {
    let rows = '';
    let rowIndex = 0;

    // Parcourir toutes les combinaisons date/heure
    for (let i = 0; i < allClientsHourlyMatrix.dates.length; i++) {
        const date = allClientsHourlyMatrix.dates[i];

        for (let j = 0; j < allClientsHourlyMatrix.hours.length; j++) {
            const hour = allClientsHourlyMatrix.hours[j];

            // Vérifier si cette ligne est dans la plage de pagination
            if (rowIndex >= startIndex && rowIndex < endIndex) {
                const key = `${date}_${hour}`;
                const rowData = allClientsHourlyMatrix.data[key] || {};

                // Déterminer la couleur de la tension
                const tension = rowData.tension;
                const hasTension = tension !== null && tension !== undefined;
                const tensionColor = hasTension ? getTensionColor(tension) : '#718096';

                rows += `
                    <tr>
                        <td class="row-index">${rowIndex + 1}</td>
                        <td class="row-date">${date}</td>
                        <td class="row-hour">${hour}</td>
                        ${allClientsHourlyMatrix.clients.map(clientId => {
                    const energie = rowData[`client_${clientId}`];
                    return `
                                <td class="row-energy client-energy">
                                    ${energie !== null && energie !== undefined ? energie : '-'}
                                </td>
                            `;
                }).join('')}
                        <td class="row-tension" style="color: ${tensionColor}">
                            ${hasTension ? tension.toFixed(1) : '-'}
                        </td>
                    </tr>
                `;
            }

            rowIndex++;
            if (rowIndex >= endIndex) break;
        }
        if (rowIndex >= endIndex) break;
    }

    return rows;
}

// FONCTIONS POUR LA GESTION DE LA PAGINATION TOUS CLIENTS
window.changeAllClientsItemsPerPage = function (value) {
    const itemsPerPg = parseInt(value) || 0;
    window.allClientsItemsPerPage = itemsPerPg === 0 ?
        allClientsHourlyMatrix.dates.length * allClientsHourlyMatrix.hours.length :
        itemsPerPg;
    window.allClientsCurrentPage = 1;
    displayAllClientsTab();
};

window.changeAllClientsMatrixPage = function (page) {
    const totalItems = allClientsHourlyMatrix.dates.length * allClientsHourlyMatrix.hours.length;
    const itemsPerPage = window.allClientsItemsPerPage || 50;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    page = Math.max(1, Math.min(page, totalPages));
    window.allClientsCurrentPage = page;
    displayAllClientsTab();
};

window.changeDailySummaryPage = function (clientId, page) {
    const dailySummary = dailySummaryByClient[clientId] || [];
    if (!dailySummary.length) return;

    const itemsPerPage = dailySummaryItemsPerPage[clientId] || 20;
    const totalPages = Math.ceil(dailySummary.length / itemsPerPage);

    page = Math.max(1, Math.min(page, totalPages));
    dailySummaryCurrentPage[clientId] = page;

    const clientData = allResultsByClient[clientId];
    if (clientData) {
        displayClientData(clientId, clientData);
    }
};

function addBackButton() {
    const controlsContainer = document.getElementById('controls-container');

    controlsContainer.innerHTML = `
        <div class="action-buttons">
            <button id="back-btn" class="btn btn-warning" onclick="window.location.href='files.html'">
                ↩️ Retour aux dossiers
            </button>
        </div>
    `;

    controlsContainer.classList.remove('hidden');
}

// ======================== FONCTIONS UTILITAIRES ========================

function detectSystemTypeFromTensionValue(tensionValue) {
    if (tensionValue > 20) {
        return '24V';
    } else {
        return '12V';
    }
}

function getTensionColor(tension) {
    if (tension === null || tension === undefined) return '#718096';

    const systemType = detectSystemTypeFromTensionValue(tension);

    if (systemType === '24V') {
        if (tension < 21.4 || tension > 31.5) return '#e53e3e';
        if (tension < 24 || tension > 29) return '#d69e2e';
        return '#38a169';
    } else {
        if (tension < 10.7 || tension > 15.6) return '#e53e3e';
        if (tension < 12 || tension > 14.5) return '#d69e2e';
        return '#38a169';
    }
}

function formatHeureColon(heureStr) {
    if (!heureStr) return 'N/A';

    if (heureStr.includes('h')) {
        return heureStr.replace('h', ':');
    }

    if (heureStr.includes(':')) {
        return heureStr;
    }

    const match = heureStr.match(/(\d{1,2})[h:]?(\d{2})?/);
    if (match) {
        const heures = match[1].padStart(2, '0');
        const minutes = match[2] ? match[2] : '00';
        return `${heures}:${minutes}`;
    }

    return heureStr;
}

function convertToComparableDate(dateStr) {
    if (!dateStr) return '0000-00-00';

    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }

    return dateStr;
}

function showLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.remove('hidden');
    }
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-container');
    if (errorDiv) {
        errorDiv.innerHTML = `
            <div class="error-content">
                <span class="error-icon">❌</span>
                <span class="error-message">${message}</span>
            </div>
        `;
        errorDiv.classList.remove('hidden');
    } else {
        alert(`Erreur: ${message}`);
    }
}

// Ajouter des styles CSS pour la nouvelle interface
function addAllClientsStyles() {
    if (!document.querySelector('#all-clients-styles')) {
        const style = document.createElement('style');
        style.id = 'all-clients-styles';
        style.textContent = `
            /* Styles pour l'onglet TOUS LES CLIENTS */
            .all-clients-tab {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                color: white !important;
                font-weight: bold !important;
                border-left: 4px solid #4c51bf !important;
            }
            
            .all-clients-tab:hover {
                background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%) !important;
            }
            
            .all-clients-tab.active {
                background: linear-gradient(135deg, #553c9a 0%, #44337a 100%) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
            }
            
            .all-clients-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .all-clients-header h3 {
                margin: 0 0 15px 0;
                font-size: 1.5em;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .all-clients-stats {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                justify-content: center;
            }
            
            .stat-item {
                background: rgba(255, 255, 255, 0.2);
                padding: 8px 16px;
                border-radius: 20px;
                display: flex;
                align-items: center;
                gap: 8px;
                backdrop-filter: blur(10px);
            }
            
            .stat-icon {
                font-size: 1.2em;
            }
            
            .stat-text {
                font-weight: 500;
            }
            
            /* Styles pour le tableau matrice */
            .all-clients-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
                min-width: 100%;
                table-layout: fixed;
            }
            
            .all-clients-table th {
                background: #4a5568;
                color: white;
                padding: 12px 8px;
                text-align: center;
                font-weight: 600;
                position: sticky;
                top: 0;
                z-index: 10;
                border-right: 1px solid #718096;
            }
            
            .all-clients-table th.client-header {
                background: #2d3748;
                min-width: 80px;
                max-width: 100px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-size: 11px;
            }
            
            .all-clients-table th.tension-header {
                background: #805ad5;
                min-width: 90px;
            }
            
            .all-clients-table td {
                padding: 8px;
                border-bottom: 1px solid #e2e8f0;
                text-align: center;
                border-right: 1px solid #f7fafc;
            }
            
            .all-clients-table td.row-index {
                background: #f7fafc;
                font-weight: bold;
                width: 50px;
            }
            
            .all-clients-table td.row-date {
                background: #f0fff4;
                font-weight: bold;
                width: 90px;
            }
            
            .all-clients-table td.row-hour {
                background: #ebf8ff;
                font-weight: bold;
                width: 70px;
            }
            
            .all-clients-table td.client-energy {
                font-family: 'Courier New', monospace;
                background: #faf5ff;
                font-weight: 500;
            }
            
            .all-clients-table td.row-tension {
                font-family: 'Courier New', monospace;
                font-weight: bold;
                background: #faf5ff;
                width: 90px;
            }
            
            .all-clients-table tr:hover td {
                background: #e6fffa !important;
            }
            
            .all-clients-table .sticky-header {
                position: sticky;
                top: 0;
                z-index: 20;
            }
            
            /* Styles pour le tableau par client */
            .client-hourly-section {
                margin-top: 30px;
            }
            
            .client-hourly-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }
            
            .client-hourly-table th {
                background: #4a5568;
                color: white;
                padding: 12px 15px;
                text-align: left;
                font-weight: 600;
            }
            
            .client-hourly-table td {
                padding: 10px 15px;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .client-hourly-table tr:hover {
                background: #f7fafc;
            }
            
            .client-hourly-table .row-energy,
            .client-hourly-table .row-tension {
                font-family: 'Courier New', monospace;
                text-align: right;
            }
            
            /* Améliorations responsives */
            @media (max-width: 1200px) {
                .all-clients-table {
                    font-size: 11px;
                }
                
                .all-clients-table th,
                .all-clients-table td {
                    padding: 6px 4px;
                }
            }
            
            @media (max-width: 768px) {
                .all-clients-stats {
                    flex-direction: column;
                    align-items: flex-start;
                }
                
                .stat-item {
                    width: 100%;
                    justify-content: flex-start;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// === FONCTION POUR CRÉER LE GRAPHIQUE EN BARRES ===
function createAllClientsEnergyChart(dates, energyDataByDay, maxEnergyDate) {
    const chartCanvas = document.getElementById('allClientsEnergyChart');
    if (!chartCanvas) return;

    // Détruire le graphique existant s'il existe
    if (window.allClientsEnergyChartInstance) {
        window.allClientsEnergyChartInstance.destroy();
    }

    // Préparer les données pour le graphique
    const labels = dates;
    const data = dates.map(date => energyDataByDay[date] || 0);

    // Générer une couleur dégradée avec mise en évidence du max
    const maxValue = Math.max(...data);
    const backgroundColors = data.map((value, index) => {
        const date = dates[index];
        // Si c'est la date avec l'énergie maximale, utiliser une couleur orange/rouge éclatante
        if (date === maxEnergyDate) {
            return 'rgba(255, 107, 53, 1)'; // Orange éclatant
        }
        // Sinon, créer un dégradé de couleur basé sur la valeur - gradient de bleu à violet
        const intensity = Math.min(value / maxValue, 1);
        // Gradient: bleu ciel (faible) → indigo → violet (élevé)
        if (intensity < 0.33) {
            return `rgba(99, 179, 237, ${0.4 + intensity * 1.2})`; // Bleu clair
        } else if (intensity < 0.66) {
            return `rgba(102, 126, 234, ${0.6 + intensity})`; // Indigo
        } else {
            return `rgba(118, 75, 162, ${0.8 + intensity * 0.5})`; // Violet
        }
    });

    const borderColors = data.map((value, index) => {
        const date = dates[index];
        if (date === maxEnergyDate) {
            return '#e85d04'; // Rouge-orange foncé
        }
        const intensity = Math.min(value / maxValue, 1);
        if (intensity < 0.33) {
            return 'rgba(51, 152, 219, 0.8)'; // Bleu
        } else if (intensity < 0.66) {
            return 'rgba(102, 126, 234, 0.9)'; // Indigo
        } else {
            return 'rgba(118, 75, 162, 1)'; // Violet
        }
    });

    // Définition des seuils de kits avec couleurs
    const kitThresholds = [
        { value: 250, color: 'rgba(239, 68, 68, 0.9)', label: 'Kit 0' },   // Rouge
        { value: 360, color: 'rgba(59, 130, 246, 0.9)', label: 'Kit 1' }, // Bleu
        { value: 540, color: 'rgba(249, 115, 22, 0.9)', label: 'Kit 2' }, // Orange
        { value: 720, color: 'rgba(34, 197, 94, 0.9)', label: 'Kit 3' },  // Vert
        { value: 1080, color: 'rgba(168, 85, 247, 0.9)', label: 'Kit 4' } // Violet
    ];

    // Créer le graphique
    const ctx = chartCanvas.getContext('2d');
    window.allClientsEnergyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Énergie Maximale Totale par Jour (Wh)',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                borderRadius: 5,
                hoverBackgroundColor: borderColors,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'x',
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            weight: 'bold',
                            family: "'Segoe UI', 'Helvetica Neue', sans-serif"
                        },
                        color: '#2c3e50',
                        padding: 15,
                        generateLabels: function(chart) {
                            const data = chart.data;
                            return data.datasets.map((dataset, i) => ({
                                text: dataset.label,
                                fillStyle: 'rgba(102, 126, 234, 0.8)',
                                hidden: !chart.isDatasetVisible(i),
                                index: i,
                                boxWidth: 15,
                                borderRadius: 3
                            }));
                        }
                    }
                },
                title: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(45, 55, 72, 0.95)',
                    padding: 14,
                    titleFont: {
                        size: 15,
                        weight: 'bold',
                        color: '#fff'
                    },
                    bodyFont: {
                        size: 13,
                        color: '#e2e8f0'
                    },
                    cornerRadius: 8,
                    displayColors: true,
                    borderColor: 'rgba(102, 126, 234, 0.5)',
                    borderWidth: 1,
                    boxPadding: 8,
                    caretSize: 8,
                    callbacks: {
                        title: function(context) {
                            return '📊 ' + context[0].label;
                        },
                        label: function (context) {
                            const value = context.parsed.y.toLocaleString('fr-FR');
                            const date = context.label === maxEnergyDate ? ' ⚡ MAXIMUM' : '';
                            return `${context.dataset.label}: ${value} Wh${date}`;
                        },
                        afterLabel: function(context) {
                            if (context.label === maxEnergyDate) {
                                return '🏆 Énergie maximale enregistrée';
                            }
                        }
                    }
                },
                // Plugin pour les lignes horizontales des kits
                annotation: {
                    annotations: kitThresholds.reduce((acc, kit, index) => {
                        acc['line' + index] = {
                            type: 'line',
                            yMin: kit.value,
                            yMax: kit.value,
                            borderColor: kit.color,
                            borderWidth: 2,
                            borderDash: [6, 4],
                            label: {
                                display: true,
                                content: `${kit.label}: ${kit.value} Wh`,
                                position: 'end',
                                backgroundColor: kit.color,
                                color: '#fff',
                                font: {
                                    size: 11,
                                    weight: 'bold'
                                },
                                padding: 4,
                                borderRadius: 3,
                                yAdjust: -10 - (index * 15)
                            }
                        };
                        return acc;
                    }, {})
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: {
                            size: 12,
                            weight: '500'
                        },
                        color: '#718096',
                        callback: function (value) {
                            return value.toLocaleString('fr-FR');
                        },
                        padding: 10
                    },
                    grid: {
                        color: 'rgba(102, 126, 234, 0.08)',
                        lineWidth: 1.5,
                        drawBorder: true,
                        borderDash: [5, 5]
                    },
                    border: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Énergie (Wh)',
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 12
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 12,
                            weight: '500'
                        },
                        color: '#718096',
                        maxRotation: 45,
                        minRotation: 0,
                        padding: 8
                    },
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    border: {
                        display: true,
                        color: 'rgba(113, 128, 150, 0.2)'
                    },
                    title: {
                        display: true,
                        text: 'Dates',
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 12
                    }
                }
            }
        }
    });
}

// === FONCTION POUR CRÉER LE GRAPHIQUE TENSION (MIN/MAX PAR JOUR) ===
function createAllClientsTensionChart(dates, tensionByDay, systemType, systemLimits) {
    const chartCanvas = document.getElementById('allClientsTensionChart');
    if (!chartCanvas) return;

    // Détruire le graphique existant s'il existe
    if (window.allClientsTensionChartInstance) {
        window.allClientsTensionChartInstance.destroy();
    }

    // Préparer les données pour le graphique
    const labels = dates;
    const minData = dates.map(date => tensionByDay[date] ? tensionByDay[date].min : null);
    const maxData = dates.map(date => tensionByDay[date] ? tensionByDay[date].max : null);

    // Créer le graphique
    const ctx = chartCanvas.getContext('2d');
    window.allClientsTensionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Tension Minimale (V)',
                    data: minData,
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: minData.map(value => {
                        if (value === null) return '#a855f7';
                        return value < systemLimits.min ? '#dc2626' : '#a855f7';
                    }),
                    pointBorderColor: minData.map(value => {
                        if (value === null) return '#7e22ce';
                        return value < systemLimits.min ? '#991b1b' : '#7e22ce';
                    }),
                    pointBorderWidth: minData.map(value => {
                        if (value === null) return 2;
                        return value < systemLimits.min ? 3 : 2;
                    }),
                    pointHoverRadius: 7
                },
                {
                    label: 'Tension Maximale (V)',
                    data: maxData,
                    borderColor: '#3182ce',
                    backgroundColor: 'rgba(49, 130, 206, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: maxData.map(value => {
                        if (value === null) return '#3182ce';
                        return value > systemLimits.max ? '#dc2626' : '#3182ce';
                    }),
                    pointBorderColor: maxData.map(value => {
                        if (value === null) return '#2c5aa0';
                        return value > systemLimits.max ? '#991b1b' : '#2c5aa0';
                    }),
                    pointBorderWidth: maxData.map(value => {
                        if (value === null) return 2;
                        return value > systemLimits.max ? 3 : 2;
                    }),
                    pointHoverRadius: 7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    cornerRadius: 6,
                    displayColors: true,
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.y;
                            if (value === null) return 'Pas de données';
                            return `${context.dataset.label}: ${value.toFixed(2)} V`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#718096',
                        callback: function (value) {
                            return value.toFixed(1) + ' V';
                        }
                    },
                    grid: {
                        color: 'rgba(113, 128, 150, 0.1)',
                        lineWidth: 1
                    },
                    title: {
                        display: true,
                        text: 'Tension (V)',
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 10
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#718096',
                        maxRotation: 45,
                        minRotation: 0
                    },
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Dates',
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 10
                    }
                }
            }
        },
        plugins: [
            {
                id: 'limits',
                afterDatasetsDraw(chart) {
                    const ctx = chart.ctx;
                    const yScale = chart.scales.y;

                    // Ligne min acceptable
                    const minPixel = yScale.getPixelForValue(systemLimits.min);
                    ctx.strokeStyle = '#ed8936';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, minPixel);
                    ctx.lineTo(chart.chartArea.right, minPixel);
                    ctx.stroke();

                    // Ligne max acceptable
                    const maxPixel = yScale.getPixelForValue(systemLimits.max);
                    ctx.strokeStyle = '#ed8936';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, maxPixel);
                    ctx.lineTo(chart.chartArea.right, maxPixel);
                    ctx.stroke();

                    // Plage idéale
                    const idealMinPixel = yScale.getPixelForValue(systemLimits.ideal.min);
                    const idealMaxPixel = yScale.getPixelForValue(systemLimits.ideal.max);
                    ctx.fillStyle = 'rgba(56, 161, 105, 0.1)';
                    ctx.fillRect(chart.chartArea.left, idealMaxPixel,
                        chart.chartArea.right - chart.chartArea.left,
                        idealMinPixel - idealMaxPixel);

                    ctx.setLineDash([]);
                }
            }
        ],
        onClick: (event, elements, chart) => {
            if (elements.length > 0) {
                const element = elements[0];
                const dateIndex = element.index;
                const selectedDate = allClientsHourlyMatrix.dates[dateIndex];
                if (selectedDate) {
                    openTensionHourlyModal(selectedDate);
                }
            }
        }
    });
}

// ============ FONCTIONS POUR LE MODAL HORAIRE ============

function openTensionHourlyModal(selectedDate) {
    const modal = document.getElementById('tensionHourlyModal');
    if (!modal) return;

    // Mettre à jour le titre
    document.getElementById('modalTitle').textContent = `Evolution Horaire de la Tension - ${selectedDate}`;

    // Afficher le modal
    modal.classList.remove('hidden');

    // Créer le graphique horaire
    createHourlyTensionChart(selectedDate);
}

function closeTensionModal() {
    const modal = document.getElementById('tensionHourlyModal');
    if (!modal) return;

    modal.classList.add('hidden');

    // Détruire le graphique
    if (window.hourlyTensionChartInstance) {
        window.hourlyTensionChartInstance.destroy();
        window.hourlyTensionChartInstance = null;
    }
}

function createHourlyTensionChart(selectedDate) {
    const chartCanvas = document.getElementById('tensionHourlyChart');
    if (!chartCanvas) return;

    // Détruire le graphique existant s'il existe
    if (window.hourlyTensionChartInstance) {
        window.hourlyTensionChartInstance.destroy();
    }

    // Extraire les données horaires pour la date sélectionnée
    const hourlyData = {};

    // Parcourir tous les points de données pour la date sélectionnée
    for (const key in allClientsHourlyMatrix.data) {
        if (key.startsWith(selectedDate)) {
            const dataPoint = allClientsHourlyMatrix.data[key];
            if (dataPoint.tension !== undefined && dataPoint.tension !== null) {
                // Extraire l'heure de la clé (format: date heure)
                const timePart = key.substring(selectedDate.length).trim();
                if (!hourlyData[timePart]) {
                    hourlyData[timePart] = [];
                }
                hourlyData[timePart].push(dataPoint.tension);
            }
        }
    }

    // Créer les tableaux labels et données
    const hours = [];
    const averageTensions = [];

    for (let hour = 0; hour < 24; hour++) {
        const timeKey = `${hour.toString().padStart(2, '0')}:00`;
        hours.push(timeKey);

        if (hourlyData[timeKey] && hourlyData[timeKey].length > 0) {
            const avg = hourlyData[timeKey].reduce((a, b) => a + b, 0) / hourlyData[timeKey].length;
            averageTensions.push(avg);
        } else {
            averageTensions.push(null);
        }
    }

    // Déterminer le type de système
    const validTensions = averageTensions.filter(v => v !== null);
    const systemType = validTensions.length > 0 ?
        (validTensions.reduce((a, b) => a + b, 0) / validTensions.length > 20 ? '24V' : '12V') :
        '12V';
    const systemLimits = getSystemLimits(systemType);

    // Créer le graphique
    const ctx = chartCanvas.getContext('2d');
    window.hourlyTensionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [
                {
                    label: 'Tension Moyenne (V)',
                    data: averageTensions,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: averageTensions.map(value => {
                        if (value === null) return '#667eea';
                        if (value < systemLimits.min || value > systemLimits.max) {
                            return '#dc2626'; // Rouge pour hors limites
                        }
                        return '#667eea';
                    }),
                    pointBorderColor: averageTensions.map(value => {
                        if (value === null) return '#5568d3';
                        if (value < systemLimits.min || value > systemLimits.max) {
                            return '#991b1b';
                        }
                        return '#5568d3';
                    }),
                    pointBorderWidth: averageTensions.map(value => {
                        if (value === null) return 1;
                        if (value < systemLimits.min || value > systemLimits.max) {
                            return 3;
                        }
                        return 1;
                    }),
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 12
                    },
                    cornerRadius: 6,
                    displayColors: true,
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.y;
                            if (value === null) return 'Pas de données';
                            return `${value.toFixed(2)} V`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#718096',
                        callback: function (value) {
                            return value.toFixed(1) + ' V';
                        }
                    },
                    grid: {
                        color: 'rgba(113, 128, 150, 0.1)',
                        lineWidth: 1
                    },
                    title: {
                        display: true,
                        text: 'Tension (V)',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 10
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#718096',
                        maxRotation: 0
                    },
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Heure',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 10
                    }
                }
            }
        },
        plugins: [
            {
                id: 'hourlyLimits',
                afterDatasetsDraw(chart) {
                    const ctx = chart.ctx;
                    const yScale = chart.scales.y;

                    // Ligne min acceptable
                    const minPixel = yScale.getPixelForValue(systemLimits.min);
                    ctx.strokeStyle = '#ed8936';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, minPixel);
                    ctx.lineTo(chart.chartArea.right, minPixel);
                    ctx.stroke();

                    // Ligne max acceptable
                    const maxPixel = yScale.getPixelForValue(systemLimits.max);
                    ctx.strokeStyle = '#ed8936';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, maxPixel);
                    ctx.lineTo(chart.chartArea.right, maxPixel);
                    ctx.stroke();

                    // Plage idéale
                    const idealMinPixel = yScale.getPixelForValue(systemLimits.ideal.min);
                    const idealMaxPixel = yScale.getPixelForValue(systemLimits.ideal.max);
                    ctx.fillStyle = 'rgba(56, 161, 105, 0.1)';
                    ctx.fillRect(chart.chartArea.left, idealMaxPixel,
                        chart.chartArea.right - chart.chartArea.left,
                        idealMinPixel - idealMaxPixel);

                    ctx.setLineDash([]);
                }
            }
        ]
    });
}

// Fermer le modal quand on clique en dehors
document.addEventListener('click', (event) => {
    const modal = document.getElementById('tensionHourlyModal');
    if (!modal) return;

    if (event.target === modal) {
        closeTensionModal();
    }
});

document.addEventListener('DOMContentLoaded', addAllClientsStyles);