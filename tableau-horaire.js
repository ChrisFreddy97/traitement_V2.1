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
// ======================== ANALYSE ENR SIMPLE ========================
function analyzeENRSimple(input) {
    if (!input) return [];
    
    // Normaliser le contenu
    const cleaned = input
        .replace(/\r?\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    
    // Séparer en bytes
    const bytes = cleaned.split(/[\s,]+/).filter(b => b);
    const results = [];
    let i = 0;
    
    console.log('🔍 Analyse ENR simple -', bytes.length, 'bytes');
    
    // Fonction pour normaliser la date (ajouter 20 devant l'année)
    const normalizeDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return dateStr;
        return dateStr.replace(/(\d{2})\/(\d{2})\/(\d{2})/, (match, day, month, year) =>
            `${day}/${month}/20${year}`
        );
    };
    
    // Fonction pour formater l'heure
    const formatTime = (heure, minute) => {
        return `${String(heure).padStart(2, '0')}h${String(minute).padStart(2, '0')}`;
    };
    
    // Fonction pour vérifier si un bloc est valide
    const isValidENRBlock = (block) => {
        if (block.length < 8) return false;
        if (block.slice(0, 6).includes('FF')) return false;
        if (block[5] === '00') return false; // État 00 = invalide
        return block.slice(0, 6).every(b => /^[0-9A-F]{2}$/.test(b));
    };
    
    // Parcourir les bytes
    while (i < bytes.length) {
        const cmd = bytes[i];
        
        // Si c'est une commande D3, traiter le bloc
        if (cmd === 'D3' && i + 65 <= bytes.length) {
            // Un bloc D3 contient 8 sous-blocs de 8 bytes chacun
            for (let b = 0; b < 8; b++) {
                const start = i + 1 + b * 8;
                const block = bytes.slice(start, start + 8);
                
                if (isValidENRBlock(block)) {
                    const [d, m, y, h, min, state, fort, faible] = block;
                    
                    // Analyser l'état
                    const analyzeState = (stateHex) => {
                        const state = parseInt(stateHex, 16);
                        const bits = state.toString(2).padStart(8, '0').split('').reverse();
                        const res = [];
                        
                        if (bits[0] === '1') res.push("ECO ON");
                        if (bits[1] === '1') res.push("DT");
                        if (bits[2] === '1') res.push("DP");
                        
                        return res.length ? res.join(' + ') : 'NORMAL';
                    };
                    
                    // Créer l'objet de résultat
                    results.push({
                        Date: normalizeDate(`${d}/${m}/${y}`),
                        Heure: formatTime(h, min),
                        État: state,
                        'Tension Forte': fort,
                        'Tension Faible': faible,
                        'Analyse État': analyzeState(state)
                    });
                }
            }
            i += 65; // Passer au prochain bloc D3
        } else {
            i++; // Continuer à parcourir
        }
    }
    
    console.log(`✅ Analyse terminée: ${results.length} lignes extraites`);
    
    // Trier par date/heure
    return results.sort((a, b) => {
        const dateA = new Date(a.Date.split('/').reverse().join('-') + 'T' + a.Heure.replace('h', ':'));
        const dateB = new Date(b.Date.split('/').reverse().join('-') + 'T' + b.Heure.replace('h', ':'));
        return dateA - dateB;
    });
}

// ======================== ANALYSE EC SIMPLE ========================
function analyzeECSimple(input) {
    if (!input) return [];

    const cleaned = input
        .replace(/\r?\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    const bytes = cleaned.split(/[\s,]+/).filter(b => b.length > 0);
    const results = [];
    let sequencesFound = 0;

    console.log('🔍 [EC Simple] Début analyse -', bytes.length, 'bytes');

    // Vérification rapide du format
    if (bytes.length < 2) {
        console.warn('⚠️ Fichier EC trop court');
        return [];
    }

    const firstByte = bytes[0];
    const secondByte = bytes[1] || '';
    const isValidStart = (firstByte === "13" && secondByte === "E0") || firstByte === "E0";

    if (!isValidStart) {
        console.warn('⚠️ Format EC non reconnu. Début:', firstByte, secondByte);
        // On continue quand même, certains fichiers peuvent avoir des variations
    }

    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];

        // Recherche des séquences E3 ou D3
        if (b === "E3" || b === "D3") {
            sequencesFound++;

            if (i + 9 >= bytes.length) {
                console.warn('❌ Séquence EC incomplète à la position', i);
                continue;
            }

            const sequence = bytes.slice(i + 1, i + 10);
            
            // Éviter les séquences contenant E6/D6 (généralement invalides)
            if (sequence.includes("E6") || sequence.includes("D6")) {
                console.warn('❌ Séquence avec E6/D6 ignorée');
                continue;
            }

            const [a, b1, c, h1, h2, client, etat, fort, faible] = sequence;

            // Ignorer les séquences "FF FF FF"
            if (a === "FF" && b1 === "FF" && c === "FF") {
                console.warn('❌ Séquence FF FF FF ignorée');
                continue;
            }

            // Vérification hexadécimale basique
            const isValidSequence = sequence.every(val => /^[0-9A-F]{2}$/.test(val));
            if (!isValidSequence) {
                console.warn('❌ Séquence hex invalide ignorée:', sequence.join(' '));
                continue;
            }

            // Convertir la date hex en date normale
            let day, month, year;
            
            try {
                day = parseInt(a, 10);
                month = parseInt(b1, 10);
                const yearHex = parseInt(c, 10);
                
                // Gestion des années (si > 99, c'est déjà l'année complète)
                if (yearHex > 99) {
                    year = yearHex;
                } else {
                    year = 2000 + yearHex;
                }
                
                // Validation des valeurs de date
                if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) {
                    console.warn('❌ Date invalide ignorée:', day, month, year);
                    continue;
                }
            } catch (error) {
                console.warn('❌ Erreur conversion date:', error);
                continue;
            }
            
            const dateStr = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;

            // Extraire et valider l'heure
            let hour, minute;
            try {
                hour = parseInt(h1, 10);
                minute = parseInt(h2, 10);
                
                if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                    console.warn('❌ Heure invalide ignorée:', hour, minute);
                    continue;
                }
            } catch (error) {
                console.warn('❌ Erreur conversion heure:', error);
                continue;
            }
            
            const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

            // Analyser l'état
            let etatAnalyse = 'NORMAL';
            let etatBin = '';
            let hasEnergieEp = false;
            let hasCreditNul = false;
            let hasSurcharge = false;
            let hasPuissanceDep = false;
            
            try {
                const etatDecimal = parseInt(etat, 16);
                etatBin = etatDecimal.toString(2).padStart(8, '0');
                const bits = etatBin.split('').reverse();
                
                // Détection prioritaire selon la documentation EC
                // Bit 2 (index 2): Énergie épuisée (priorité 1)
                if (bits[2] === "1") {
                    etatAnalyse = "ÉNERGIE ÉPUISÉE";
                    hasEnergieEp = true;
                } 
                // Bit 1 (index 1): Crédit nul (priorité 2)
                else if (bits[1] === "1") {
                    etatAnalyse = "CRÉDIT NUL";
                    hasCreditNul = true;
                } 
                // Bit 3 (index 3): Surcharge (priorité 3)
                else if (bits[3] === "1") {
                    etatAnalyse = "SURCHARGE";
                    hasSurcharge = true;
                } 
                // Bit 4 (index 4): Puissance dépassée (priorité 4)
                else if (bits[4] === "1") {
                    etatAnalyse = "PUISSANCE DÉPASSÉE";
                    hasPuissanceDep = true;
                }
                
                // Vérification supplémentaire : si plusieurs bits sont à 1
                const activeBits = bits.filter(bit => bit === "1").length;
                if (activeBits > 1) {
                    const activeStates = [];
                    if (bits[1] === "1") activeStates.push("CRÉDIT NUL");
                    if (bits[2] === "1") activeStates.push("ÉNERGIE ÉPUISÉE");
                    if (bits[3] === "1") activeStates.push("SURCHARGE");
                    if (bits[4] === "1") activeStates.push("PUISSANCE DÉPASSÉE");
                    
                    if (activeStates.length > 1) {
                        console.log(`ℹ️ Multiple états détectés: ${activeStates.join(', ')} - Priorité donnée à: ${etatAnalyse}`);
                    }
                }
                
            } catch (error) {
                console.warn('❌ Erreur analyse état:', error);
                etatAnalyse = 'ERREUR';
                etatBin = '00000000';
            }

            // Validation des tensions
            let tensionFort = '00';
            let tensionFaible = '00';
            
            try {
                tensionFort = parseInt(fort, 16).toString();
                tensionFaible = parseInt(faible, 16).toString();
            } catch (error) {
                console.warn('❌ Erreur conversion tension:', error);
            }

            results.push({
                Date: dateStr,
                Heure: timeStr,
                Client: parseInt(client, 16),
                'État Hex': etat,
                'État Binaire': etatBin,
                'Analyse État': etatAnalyse,
                'Tension Forte': tensionFort,
                'Tension Faible': tensionFaible,
                'Séquence': sequencesFound,
                // Flags pour faciliter le filtrage
                hasEnergieEp: hasEnergieEp,
                hasCreditNul: hasCreditNul,
                hasSurcharge: hasSurcharge,
                hasPuissanceDep: hasPuissanceDep,
                // Données brutes pour référence
                rawDateHex: `${a}/${b1}/${c}`,
                rawHeureHex: `${h1}:${h2}`,
                // Timestamp pour tri
                timestamp: new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${timeStr}`).getTime()
            });

            i += 9; // Passer au prochain bloc
        }
    }

    console.log(`✅ [EC Simple] Analyse terminée: ${sequencesFound} séquences, ${results.length} événements valides`);

    if (results.length > 0) {
        // Afficher un résumé des types d'événements détectés
        const eventCounts = results.reduce((acc, event) => {
            acc[event['Analyse État']] = (acc[event['Analyse État']] || 0) + 1;
            return acc;
        }, {});
        
        console.log('📊 Répartition des événements EC:');
        Object.entries(eventCounts).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} événement(s)`);
        });
        
        // Afficher un échantillon des premières données
        console.log('📋 Échantillon des premières données:');
        results.slice(0, 5).forEach((event, index) => {
            console.log(`   ${index + 1}. ${event.Date} ${event.Heure} - Client ${event.Client} - ${event['Analyse État']}`);
        });
        
        // Calculer la période couverte
        const dates = results.map(r => r.timestamp);
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        console.log(`📅 Période couverte: ${minDate.toLocaleDateString()} au ${maxDate.toLocaleDateString()}`);
    }

    // Trier par date/heure
    const sortedResults = results.sort((a, b) => a.timestamp - b.timestamp);
    
    return sortedResults;
}

// ======================== FONCTION DE FILTRAGE DES FICHIERS ========================
function filterFilesByType(files, targetType) {
    return files.filter(file => {
        const name = file.name.toUpperCase();
        const type = file.type ? file.type.toUpperCase() : '';
        
        console.log(`🔍 Filtrage: ${file.name} | Type détecté: ${type} | Target: ${targetType}`);
        
        if (targetType === 'ENR') {
            return type === 'ENR' || name.includes('ENR');
        } else if (targetType === 'EC') {
            // EC uniquement, pas RECHARGE
            return (type === 'EC' || name.includes('EC')) && 
                   !name.includes('RECHARGE');
        } else if (targetType === 'RECHARGE') {
            // RECHARGE - soit dans type, soit dans nom
            return type === 'RECHARGE' || name.includes('RECHARGE');
        }
        return false;
    });
}

async function loadAnalyzers() {
    const analyzers = [
        { name: 'energyAnalyzer', path: './analyzer/energyAnalyzer.js' },
        { name: 'creditAnalyzer', path: './analyzer/creditAnalyzer.js' },
        { name: 'tensionAnalyzer', path: './analyzer/tensionAnalyzer.js' },
        { name: 'enrAnalyzer', path: './analyzer/enrAnalyzer.js' }
    ];

    for (const analyzer of analyzers) {
        await loadAnalyzer(analyzer.name, analyzer.path);
    }
}

async function loadAnalyzer(name, path) {
    return new Promise((resolve, reject) => {
        // Vérifications pour éviter le rechargement
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

        if (name === 'enrAnalyzer' && typeof window.analyzeENR === 'function') {
            console.log('✅ ENRAnalyzer déjà chargé');
            resolve();
            return;
        }

        console.log(`📥 Chargement de ${path}...`);

        const script = document.createElement('script');
        script.src = path;
        script.type = 'module';

        // Configuration des handlers en fonction de l'analyseur
        if (name === 'enrAnalyzer') {
            script.onload = () => {
                console.log(`✅ ${path} chargé`);
                setTimeout(() => {
                    if (typeof window.analyzeENR === 'function') {
                        console.log('✅ Fonction analyzeENR disponible');
                        resolve();
                    } else if (window.ENRAnalyzer && typeof window.ENRAnalyzer.analyzeENR === 'function') {
                        window.analyzeENR = window.ENRAnalyzer.analyzeENR;
                        window.generateENRDailySummary = window.ENRAnalyzer.generateENRDailySummary;
                        window.detectENRAnomalies = window.ENRAnalyzer.detectENRAnomalies;
                        window.createENRAnalysisContent = window.ENRAnalyzer.createENRAnalysisContent;
                        console.log('✅ Fonctions ENR trouvées via window.ENRAnalyzer');
                        resolve();
                    } else {
                        console.warn(`⚠️ Fonction analyzeENR non disponible, mais on continue`);
                        resolve();
                    }
                }, 500);
            };
        } else {
            // Handler pour les autres analyseurs
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
        }

        // Handler d'erreur commun
        script.onerror = (error) => {
            console.error(`❌ Erreur de chargement ${path}:`, error);
            if (name === 'creditAnalyzer' || name === 'tensionAnalyzer' || name === 'enrAnalyzer') {
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

        // Filtrer les fichiers par type
        const energyFiles = folderData.files.filter(file => file.type === 'énergie');
        const creditFiles = folderData.files.filter(file => file.type === 'crédit');
        const tensionFiles = folderData.files.filter(file => file.type === 'tension' || file.name.toLowerCase().includes('tension'));
        
        // SÉPARER LES 3 TYPES DANS L'ONGLET ÉVÈNEMENT AVEC FILTRAGE PRÉCIS
        const enrFiles = filterFilesByType(folderData.files, 'ENR');
        const ecFiles = filterFilesByType(folderData.files, 'EC');
        const rechargeFiles = filterFilesByType(folderData.files, 'RECHARGE');
        
        // Stocker tous les fichiers pour l'onglet ÉVÈNEMENT
        window.enrFiles = enrFiles;           // Pour analyse ENR
        window.ecFiles = ecFiles;             // Pour affichage brut EC
        window.rechargeFiles = rechargeFiles; // Pour affichage brut RECHARGE


        if (energyFiles.length === 0 && creditFiles.length === 0 && tensionFiles.length === 0 && enrFiles.length === 0) {
            showError('Aucun fichier d\'énergie, de crédit, tension ou ENR/EC trouvé');
            return;
        }

        console.log(`🔋 ${energyFiles.length} fichier(s) d'énergie`);
        console.log(`💰 ${creditFiles.length} fichier(s) de crédit`);
        console.log(`⚡ ${tensionFiles.length} fichier(s) de tension`);
        console.log(`📈 ${enrFiles.length} fichier(s) ENR/EC`);
        
        if (enrFiles.length > 0) {
            console.log('📊 Fichiers ENR/EC détectés:');
            enrFiles.forEach(file => {
                console.log(`   - ${file.name} (Type: ${file.type}, Client: ${file.client || 'N/A'})`);
            });
        }

        // Initialiser les variables globales pour les 3 types
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

        // NOUVELLES VARIABLES POUR LES 3 TYPES
        window.enrFiles = enrFiles;           // Fichiers ENR pour analyse
        window.ecFiles = ecFiles;             // Fichiers EC pour affichage brut
        window.rechargeFiles = rechargeFiles; // Fichiers RECHARGE pour affichage brut

        // Traiter l'énergie
        if (energyFiles.length > 0 && typeof window.analyzeEnergy === 'function') {
            console.log('🔍 Début de l\'analyse des fichiers d\'énergie...');
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
                            enrFiles: [], // Ajouté pour ENR
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
            console.log('✅ Analyse énergie terminée');
        }

        // Traiter le crédit
        if (creditFiles.length > 0 && typeof window.analyzeCredit === 'function') {
            console.log('🔍 Début de l\'analyse des fichiers de crédit...');
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
                            enrFiles: [],
                            energyDailyData: [],
                            combinedHourlyData: []
                        };
                    }

                } catch (error) {
                    console.error(`❌ Erreur lors de l'analyse de crédit ${file.name}:`, error);
                }
            }
            console.log('✅ Analyse crédit terminée');
        }

        // Traiter la tension
        if (tensionFiles.length > 0 && typeof window.analyzeTension === 'function') {
            console.log('🔍 Début de l\'analyse des fichiers de tension...');
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
            console.log('✅ Analyse tension terminée');
        }

        // Afficher les informations sur les fichiers ENR
        if (enrFiles.length > 0) {
            console.log('📊 Informations sur les fichiers ENR/EC:');
            enrFiles.forEach((file, index) => {
                console.log(`   ${index + 1}. ${file.name}`);
                console.log(`      Type: ${file.type}`);
                console.log(`      Client: ${file.client || 'N/A'}`);
                console.log(`      Forfait: ${file.forfait || 'N/A'}`);
                console.log(`      Taille: ${file.content.length} caractères`);
                console.log(`      Premières 100 chars: ${file.content.substring(0, 100)}...`);
            });
            
            // Vérifier si l'analyseur ENR est disponible
            if (typeof window.analyzeENR === 'function') {
                console.log('✅ Analyseur ENR disponible');
            } else {
                console.log('⚠️ Analyseur ENR non disponible');
            }
        }

        // Préparer les résultats et combiner énergie + tension pour chaque client
        console.log('🔗 Combinaison des données énergie et tension...');
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

        // Calculer les totaux
        const totalEnergyPoints = Object.values(allResultsByClient).reduce((sum, client) => sum + client.totalPoints, 0);
        const totalCreditPoints = Object.values(creditResultsByClient).reduce((sum, client) => sum + client.totalPoints, 0);
        const totalTensionPoints = tensionResults.length || 0;
        const totalPoints = totalEnergyPoints + totalCreditPoints + totalTensionPoints;

        console.log('📊 Statistiques finales:');
        console.log(`   Points d'énergie: ${totalEnergyPoints}`);
        console.log(`   Points de crédit: ${totalCreditPoints}`);
        console.log(`   Points de tension: ${totalTensionPoints}`);
        console.log(`   Total: ${totalPoints}`);
        console.log(`   Clients: ${Object.keys(allResultsByClient).length}`);
        console.log(`   Fichiers ENR/EC: ${enrFiles.length}`);

        // Afficher les onglets
        displayClientsTabs();

        // Vérifier s'il y a un paramètre d'URL pour l'onglet
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        
        setTimeout(() => {
            // Si le paramètre tab=evenement est présent, ouvrir l'onglet ÉVÈNEMENT
            if (tabParam === 'evenement' && enrFiles.length > 0) {
                currentMainTab = 'EVENEMENT';
                const evenementTab = document.querySelector('[data-main-tab="EVENEMENT"]');
                if (evenementTab) {
                    console.log('🔀 Ouverture automatique de l\'onglet ÉVÈNEMENT');
                    if (typeof window.switchMainTab === 'function') {
                        window.switchMainTab('EVENEMENT', evenementTab);
                    } else {
                        evenementTab.click();
                    }
                } else {
                    console.warn('⚠️ Onglet ÉVÈNEMENT non trouvé');
                    // Fallback vers TECHNIQUE
                    openDefaultTab();
                }
            } else {
                // Sinon, ouvrir TECHNIQUE par défaut
                openDefaultTab();
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

// Fonction pour ouvrir l'onglet par défaut (TECHNIQUE)
function openDefaultTab() {
    currentMainTab = 'TECHNIQUE';
    const techniqueTab = document.querySelector('[data-main-tab="TECHNIQUE"]');
    const allClientsTab = document.querySelector('[data-sub-tab="ALL"]');

    if (techniqueTab) {
        if (typeof window.switchMainTab === 'function') {
            window.switchMainTab('TECHNIQUE', techniqueTab);
        } else if (typeof switchMainTab === 'function') {
            switchMainTab('TECHNIQUE', techniqueTab);
        } else {
            techniqueTab.click();
        }
    } else if (allClientsTab) {
        if (typeof window.switchSubTab === 'function') {
            window.switchSubTab('ALL', 'TECHNIQUE', allClientsTab);
        } else if (typeof switchSubTab === 'function') {
            switchSubTab('ALL', 'TECHNIQUE', allClientsTab);
        } else {
            allClientsTab.click();
        }
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
        <button class="main-tab" 
                data-main-tab="EVENEMENT" 
                onclick="switchMainTab('EVENEMENT', this)">
            <span class="tab-icon">📈</span>
            <span class="tab-label">ÉVÈNEMENT</span>
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

    // Onglet "ANALYSE ENR" (EVENEMENT)
    subTabsHTML += `
        <button class="sub-tab" 
                data-sub-tab="ENR" 
                data-main="EVENEMENT"
                onclick="switchSubTab('ENR', 'EVENEMENT', this)">
            <span class="tab-icon">📈</span>
            <span class="tab-label">ANALYSE ENR et EC</span>
        </button>
    `;

    // Onglets clients individuels (COMMERCIALE)
    sortedClients.forEach((clientId, index) => {
        const clientData = allResultsByClient[clientId];
        // Format modifié : Client 2(ECO) au lieu de 02-ECO
        const tabLabel = `Client ${parseInt(clientId).toString().padStart(2, '0')}(${clientData.forfait || 'N/A'})`;

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
    contentHTML += `
        <div class="main-content" id="main-content-EVENEMENT">
            <div class="sub-content active" id="sub-content-ENR">
            </div>
        </div>
    `;

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
            } else if (subTabValue === 'ENR') {
                displayENRAnalysis(); // NOUVELLE FONCTION
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

    const clientTitle = `Client ${parseInt(clientId).toString().padStart(2, '0')}(${clientData.forfait || 'N/A'})`;
    // Générer la section commerciale (phrases analytiques)
    const commercialSectionHTML = generateCommercialSectionHTML(clientId, clientData);
    // Générer la section crédit (analyse comportement crédit)
    const creditSectionHTML = generateCreditBehaviorHTML(clientId, clientData);

    // Générer une synthèse globale (conso + crédit) si possible
    let globalSummaryHTML = '';
    const consumptionProfile = window.consumptionProfilesByClient && window.consumptionProfilesByClient[clientId];
    const creditProfile = window.creditProfilesByClient && window.creditProfilesByClient[clientId];

    if (consumptionProfile || creditProfile) {
        // Texte par défaut
        let summaryTitle = 'Profil global du client';
        let summaryBody = 'Les informations de consommation et/ou de crédit sont partielles pour ce client.';
        let summaryColor = '#1e293b'; // couleur par défaut du texte principal

        if (consumptionProfile && creditProfile) {
            // Combinaison conso + crédit
            const { percentZeroDays, percentOverQuotaDays, percentAbove70 } = consumptionProfile;
            const { profileType, profileScore, zeroCreditDays } = creditProfile;

            if (consumptionProfile.daysWithConsumption === 0 && zeroCreditDays === creditProfile.totalDays) {
                summaryTitle = 'Client inactif (énergie et crédit)';
                summaryBody = "Sur la période analysée, aucune consommation significative ni rechargements de crédit réguliers n’ont été observés. Le kit semble très peu ou pas utilisé, avec un risque de non-valorisation de l’équipement.";
                summaryColor = '#4b5563'; // gris neutre
            } else if (percentOverQuotaDays >= 30 && (profileType === 'excellent' || profileType === 'bon')) {
                summaryTitle = 'Client très actif, sous-dimensionné';
                summaryBody = "Le client consomme fortement et dépasse souvent le forfait tout en maintenant un profil de crédit correct. Cela indique un usage intensif et maîtrisé : un forfait paraît adapté pour sécuriser la qualité de service.";
                summaryColor = '#b91c1c'; // rouge (alerte : sous-dimensionné)
            } else if (percentZeroDays >= 50 && zeroCreditDays >= Math.round(creditProfile.totalDays * 0.5)) {
                summaryTitle = 'Client très peu utilisateur';
                summaryBody = "La consommation énergétique est rare et les jours sans crédit sont nombreux. Le kit est utilisé de façon très occasionnelle, ce qui suggère un potentiel de sous-utilisation ou un besoin mal adapté.";
                summaryColor = '#92400e'; // orange/brun (attention, faible usage)
            } else if (percentZeroDays <= 20 && percentAbove70 >= 40 && (profileType === 'excellent' || profileType === 'bon')) {
                summaryTitle = 'Client régulier et fiable';
                summaryBody = "La consommation est soutenue, proche du forfait sans excès, et le suivi du crédit est globalement bon. Le comportement est stable, avec un usage régulier et un risque limité d’interruption de service.";
                summaryColor = '#15803d'; // vert (profil très positif)
            } else if (percentZeroDays <= 20 && profileType === 'faible') {
                summaryTitle = 'Client gros consommateur mais fragile sur le crédit';
                summaryBody = "Le client utilise régulièrement son kit mais connaît de nombreuses périodes sans crédit. Le risque d’interruptions de service est élevé, ce qui peut justifier un accompagnement commercial ciblé.";
                summaryColor = '#c2410c'; // orange foncé (gros usage mais fragile)
            } else {
                summaryTitle = 'Client à consommation irrégulière';
                summaryBody = "La consommation présente des variations importantes et le comportement de crédit est intermédiaire. Un suivi plus fin peut aider à comprendre les usages réels et à ajuster l’offre si nécessaire.";
                summaryColor = '#be123c'; // rose/rouge (profil incertain / irrégulier)
            }
        } else if (consumptionProfile) {
            summaryTitle = 'Profil global basé sur la consommation';
            summaryBody = "Les données de consommation permettent de dégager un profil énergétique, mais aucune information de crédit fiable n’est disponible pour compléter l’analyse financière.";
            summaryColor = '#1d4ed8'; // bleu (info principalement technique)
        } else if (creditProfile) {
            summaryTitle = 'Profil global basé sur le crédit';
            summaryBody = "Les données de crédit décrivent un comportement de paiement, mais la consommation énergétique n’est pas suffisante pour qualifier l’usage réel du kit.";
            summaryColor = '#0369a1'; // bleu/teal (info principalement financière)
        }

        globalSummaryHTML = `
            <div class="client-global-summary" style="margin:12px 0; padding:12px 16px; border-radius:10px; border:1px solid #cbd5e1; background:linear-gradient(135deg,#eff6ff 0%,#ecfeff 100%); box-shadow:0 2px 6px rgba(15,23,42,0.05);">
                <div style="font-weight:700; font-size:14px; color:${summaryColor}; margin-bottom:6px;">🧩 ${summaryTitle}</div>
                <div style="font-size:13px; color:${summaryColor};">${summaryBody}</div>
            </div>
        `;
    }

    contentElement.innerHTML = `
        <div class="client-header">
            <h3>${clientTitle} - Résumé Journalier</h3>
        </div>
        ${globalSummaryHTML}
        ${commercialSectionHTML}
        ${creditSectionHTML}
        <!-- Tableau Journalier -->
        ${dailySummary.length > 0 ? displayDailySummaryTable(clientId, dailySummary) : ''}
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
        "FREEZER 1": { max: 1250, heures: 24 },
        "FREEZER 3": { max: 1250, heures: 24 }
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
    const daysAbove90 = daily.filter(d => (d.energieMax || 0) > 0.9 * forfaitMax).length;
    const percentAbove70 = Math.round((daysAbove70 / daysTotal) * 100);

    // Statistiques complémentaires pour profiler le client
    const daysWithConsumption = daily.filter(d => (d.energieMax || 0) > 0).length;
    const zeroDays = daysTotal - daysWithConsumption;
    const overQuotaDays = daily.filter(d => (d.energieMax || 0) >= forfaitMax).length;
    const percentZeroDays = Math.round((zeroDays / daysTotal) * 100);
    const percentOverQuotaDays = Math.round((overQuotaDays / daysTotal) * 100);

    // Exposer un petit résumé consommation pour d'autres fonctions (profil global)
    const consumptionProfile = {
        daysTotal,
        daysWithConsumption,
        zeroDays,
        overQuotaDays,
        percentZeroDays,
        percentOverQuotaDays,
        percentAbove70
    };
    window.consumptionProfilesByClient = window.consumptionProfilesByClient || {};
    window.consumptionProfilesByClient[clientId] = consumptionProfile;
    const daysAbove70List = daily.filter(d => (d.energieMax || 0) > 0.7 * forfaitMax).map(d => ({ date: d.date, valeur: d.energieMax, heure: d.heureMax }));

    // Moyenne / médiane des pics journaliers
    const maxValues = daily.map(d => d.energieMax || 0).sort((a,b)=>a-b);
    const avgMax = maxValues.length ? Math.round(maxValues.reduce((a,b)=>a+b,0)/maxValues.length) : 0;
    const medianMax = maxValues.length ? (maxValues.length%2===1 ? maxValues[Math.floor(maxValues.length/2)] : Math.round((maxValues[maxValues.length/2 -1] + maxValues[maxValues.length/2])/2)) : 0;
    const minMax = maxValues.length ? Math.min(...maxValues) : 0;

    const daysReachedMax = daily.filter(d => (d.energieMax || 0) >= forfaitMax);
    const daysReachedMaxBefore23 = daysReachedMax.filter(d => {
        if (!d.heureMax) return false;
        const h = formatHeureColon(d.heureMax);
        const hour = parseInt(h.split(':')[0], 10);
        if (isNaN(hour)) return false;
        return hour >= 1 && hour <= 22;
    });

    // Top jours
    const sortedByMax = [...daily].sort((a, b) => (b.energieMax || 0) - (a.energieMax || 0));
    const topList = sortedByMax.slice(0, 5);

    // Styles selon gravité
    const severity = percentAbove70 >= 80 ? 'high' : percentAbove70 >= 40 ? 'medium' : 'low';
    const severityColors = {
        high: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', icon: '⚠️' },
        medium: { bg: '#fff7ed', border: '#f97316', text: '#7c2d12', icon: '⚡' },
        low: { bg: '#f0f9ff', border: '#60a5fa', text: '#1e3a8a', icon: '✅' }
    };
    const sc = severityColors[severity];

    // Déterminer un "profil" de consommation lisible côté commercial
    let behaviorLabel = 'Profil non défini';
    let behaviorDescription = "Les données ne permettent pas encore de conclure clairement sur le profil de consommation.";

    if (daysWithConsumption === 0) {
        behaviorLabel = 'Aucune consommation';
        behaviorDescription = "Sur la période analysée, aucune consommation significative n’a été enregistrée. Le kit peut être éteint, non utilisé ou installé sans usage réel.";
    } else if (percentOverQuotaDays >= 30) {
        behaviorLabel = 'Dépassement régulier du forfait';
        behaviorDescription = "Le client dépasse fréquemment le plafond de son forfait. Cela traduit un usage intensif et récurrent : un forfait pourrait être envisagé pour sécuriser le service.";
    } else if (percentZeroDays >= 50 && percentOverQuotaDays === 0) {
        behaviorLabel = 'Consommation très occasionnelle / irrégulière';
        behaviorDescription = "La majorité des jours n’affichent aucune consommation. Le client utilise le kit de manière ponctuelle ou très irrégulière, avec peu de pression sur le forfait.";
    } else if (percentZeroDays <= 10 && percentAbove70 >= 40 && percentOverQuotaDays < 30) {
        behaviorLabel = 'Consommation régulière et soutenue';
        behaviorDescription = "Le client consomme presque tous les jours avec des niveaux proches du plafond sans le dépasser trop souvent. Le dimensionnement actuel semble pertinent, tout en restant à surveiller.";
    } else if (percentZeroDays <= 20 && percentAbove70 < 40 && percentOverQuotaDays < 20) {
        behaviorLabel = 'Consommation régulière et modérée';
        behaviorDescription = "La consommation est présente de façon assez continue, mais reste globalement loin du plafond. Le client dispose d’une bonne marge par rapport à son forfait.";
    } else {
        behaviorLabel = 'Consommation irrégulière';
        behaviorDescription = "Les jours de forte consommation alternent avec des jours très faibles ou nuls. Le comportement est fluctuant, ce qui peut nécessiter un suivi commercial personnalisé pour bien comprendre les usages.";
    }

    // Construire HTML stylé avec tableaux
    const html = `
        <div class="commercial-analysis-container" style="margin:12px 0; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            
            <!-- En-tête -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:16px 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div style="font-weight:700; font-size:16px; display:flex; align-items:center; gap:8px;">💼 Analyse Consommation</div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <div style="background:rgba(255,255,255,0.2); padding:6px 12px; border-radius:20px; font-size:12px; font-weight:600;">Forfait: ${forfaitName} (${forfaitMax}Wh)</div>
                        <div style="background:rgba(255,255,255,0.2); padding:6px 12px; border-radius:20px; font-size:12px; font-weight:600;">${daysTotal} jours</div>
                    </div>
                </div>
            </div>

            <!-- Indicateurs clés -->
            <div style="padding:16px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px;">
                <div style="text-align:center; padding:8px; background:white; border-radius:8px; border-left:4px solid #3b82f6;">
                    <div style="font-size:24px; font-weight:bold; color:#3b82f6;">${daysAbove70}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">Jours >70% du max</div>
                </div>
                <div style="text-align:center; padding:8px; background:white; border-radius:8px; border-left:4px solid #ef4444;">
                    <div style="font-size:24px; font-weight:bold; color:#ef4444;">${daysAbove90}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">Jours >90% du max</div>
                </div>
                <div style="text-align:center; padding:8px; background:white; border-radius:8px; border-left:4px solid #8b5cf6;">
                    <div style="font-size:24px; font-weight:bold; color:#8b5cf6;">${avgMax}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">Moyenne journalière (Wh)</div>
                </div>
                <div style="text-align:center; padding:8px; background:white; border-radius:8px; border-left:4px solid #f97316;">
                    <div style="font-size:24px; font-weight:bold; color:#f97316;">${overQuotaDays}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">Jours avec dépassement</div>
                    <div style="font-size:12px; color:#64748b; margin-top:4px;">Puissance dépassée</div>
                </div>
            </div>

            <!-- Analyse qualitative -->
            <div style="padding:16px 20px; background:${sc.bg}; border-bottom:1px solid ${sc.border}; display:flex; gap:12px; align-items:flex-start;">
                <span style="font-size:24px;">${sc.icon}</span>
                <div style="flex:1;">
                    <div style="font-weight:700; color:${sc.text}; margin-bottom:4px; font-size:14px;">Profil de consommation : ${behaviorLabel}</div>
                    <div style="color:${sc.text}; font-size:13px;">${behaviorDescription}</div>
                </div>
            </div>

            <!-- Les tableaux détaillés (jours critiques, top 5, statistiques générales) ont été supprimés pour alléger la vue commerciale -->
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

    // Détecter achats passant de 0 à différents seuils
    const bigPurchases60 = evolution.filter((e, idx, arr) => {
        if (idx === 0) return false;
        const prev = arr[idx - 1];
        return prev && prev.credit === 0 && e.credit >= 60;
    });
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

    // Stats crédit
    const creditValues = (dailySummary || []).map(d => d.creditMoyen || 0).filter(v => v > 0);
    const avgCredit = creditValues.length ? Math.round(creditValues.reduce((a,b) => a+b, 0) / creditValues.length) : 0;
    const maxCredit = creditValues.length ? Math.max(...creditValues) : 0;
    const minCredit = creditValues.length ? Math.min(...creditValues) : 0;

    // Déterminer le profil
    const totalDays = dailySummary.length;
    const profileScore = Math.round(((totalDays - zeroDays.length) / totalDays) * 100);
    const profileType = profileScore >= 90 ? 'excellent' : profileScore >= 70 ? 'bon' : profileScore >= 50 ? 'moyen' : 'faible';
    const profileColors = {
        excellent: { bg: '#dcfce7', border: '#22c55e', text: '#166534', icon: '✅' },
        bon: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', icon: '👍' },
        moyen: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '⚠️' },
        faible: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '🔴' }
    };
    const pc = profileColors[profileType];

    // Exposer un petit résumé crédit pour d'autres fonctions (profil global)
    const creditProfile = {
        totalDays,
        zeroCreditDays: zeroDays.length,
        avgCredit,
        maxCredit,
        minCredit,
        profileScore,
        profileType
    };
    window.creditProfilesByClient = window.creditProfilesByClient || {};
    window.creditProfilesByClient[clientId] = creditProfile;

    // HTML avec tableaux détaillés
    const html = `
        <div class="credit-analysis-container" style="margin:12px 0; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            
            <!-- En-tête -->
            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color:white; padding:16px 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div style="font-weight:700; font-size:16px; display:flex; align-items:center; gap:8px;">💰 Analyse de Crédit</div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <div style="background:rgba(255,255,255,0.2); padding:6px 12px; border-radius:20px; font-size:12px; font-weight:600;">${totalDays} jours analysés</div>
                        <div style="background:rgba(255,255,255,0.2); padding:6px 12px; border-radius:20px; font-size:12px; font-weight:600;">${creditData && creditData.results ? creditData.results.length : 0} enregistrements</div>
                    </div>
                </div>
            </div>

            <!-- Profil de crédit -->
            <div style="padding:16px 20px; background:${pc.bg}; border-bottom:1px solid ${pc.border}; display:flex; gap:12px; align-items:flex-start;">
                <span style="font-size:24px;">${pc.icon}</span>
                <div style="flex:1;">
                    <div style="font-weight:700; color:${pc.text}; margin-bottom:4px; font-size:14px;">Profil de Crédit: ${profileType.toUpperCase()}</div>
                    <div style="color:${pc.text}; font-size:12px;">
                        ${profileType === 'excellent' ? 'Excellent suivi du crédit. Client très fiable avec paiements réguliers.' : 
                          profileType === 'bon' ? 'Bon profil. Quelques jours de pénurie mais gestion globale satisfaisante.' : 
                          profileType === 'moyen' ? 'Profil à surveiller. Plusieurs périodes de crédit épuisé.' : 
                          'Profil problématique. Nombreuses interruptions de service dues au crédit.'}
                    </div>
                </div>
            </div>

            <!-- Indicateurs clés -->
            <div style="padding:16px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
                <div style="text-align:center; padding:8px; background:white; border-radius:8px; border-left:4px solid #8b5cf6;">
                    <div style="font-size:22px; font-weight:bold; color:#8b5cf6;">${avgCredit}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">Crédit moyen (jours)</div>
                </div>
                <div style="text-align:center; padding:8px; background:white; border-radius:8px; border-left:4px solid #06b6d4;">
                    <div style="font-size:22px; font-weight:bold; color:#06b6d4;">${maxCredit}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">Maximum observé</div>
                </div>
                <div style="text-align:center; padding:8px; background:white; border-radius:8px; border-left:4px solid #ef4444;">
                    <div style="font-size:22px; font-weight:bold; color:#ef4444;">${zeroDays.length}</div>
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">Jours sans crédit</div>
                </div>
                <div style="text-align:center; padding:8px; background:white; border-radius:8px; border-left:4px solid #f59e0b;">
                    <div style="font-size:22px; font-weight:bold; color:#f59e0b;">${profileScore}%</div>
                    <div style="font-size:11px; color:#64748b; margin-top:4px;">Taux de fiabilité</div>
                </div>
            </div>

            <!-- Les tableaux détaillés (jours sans crédit, achats détectés) ont été supprimés pour alléger la vue commerciale -->

            <!-- Synthèse générale -->
            <div style="padding:16px 20px; background:#f8fafc;">
                <h5 style="margin:0 0 12px; font-size:13px; font-weight:700; color:#1e293b; text-transform:uppercase; letter-spacing:0.5px;">
                    📝 Synthèse
                </h5>
                <div style="display:grid; grid-template-columns:1fr; gap:8px; font-size:12px; color:#374151; line-height:1.6;">
                    <div style="padding:8px; background:white; border-radius:6px; border-left:4px solid #6366f1;">
                        ${profileType === 'excellent' ? '✅ Excellent suivi du crédit. Client très fiable avec paiements réguliers.' :
                          profileType === 'bon' ? '👍 Bon profil. Quelques jours de pénurie mais gestion globale satisfaisante.' :
                          profileType === 'moyen' ? '⚠️ Profil à surveiller. Plusieurs périodes de crédit épuisé.' :
                          '🔴 Profil problématique. Nombreuses interruptions de service dues au crédit.'}
                    </div>
                    <div style="padding:8px; background:white; border-radius:6px; border-left:4px solid #6366f1;">
                        ${bigPurchases60.length > 0 ? `💰 Achats importants détectés: ${bigPurchases60.length} achat(s) ≥60 jours` :
                          bigPurchases30.length > 0 ? `💰 Achats moyens détectés: ${bigPurchases30.length} achat(s) ≥30 jours` :
                          '📦 Achats généralement faibles ou fréquents.'}
                    </div>
                </div>
            </div>
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
                if (tensionMin < 22 || tensionMax > 31) return '#e53e3e';
                if (tensionMin < 24 || tensionMax > 29) return '#d69e2e';
                return '#38a169';
            } else {
                if (tensionMin < 11 || tensionMax > 15) return '#e53e3e';
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
            min: 22,
            max: 31,
            ideal: { min: 24, max: 29 },
            normal: 28,
            maxVariation: 5,
            alertThreshold: 3
        };
    } else {
        return {
            min: 11,
            max: 15,
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
        message = `La tension du système ${systemType} est <strong>excellente</strong> avec ${stablePercent}% de jours Conforme. 
                  La variation moyenne de ${averageVariation} V/h est bien en dessous du seuil d'alerte. 
                  L'installation électrique fonctionne de manière optimale.`;
    } 
    else if (stabilityPercentage >= 80) {
        message = `La tension est <strong>globalement acceptable</strong> (${stablePercent}% de jours Conforme) mais présente 
                  ${unstablePercent}% de jours avec des variations importantes. 
                  Surveillez la variation moyenne de ${averageVariation} V/h.`;
    }
    else if (stabilityPercentage >= 60) {
        message = `La tension est <strong>préoccupante</strong> avec seulement ${stablePercent}% de jours Conforme. 
                  ${outOfLimits > 0 ? `${outOfLimits} jour${outOfLimits !== 1 ? 's' : ''} hors limites. ` : ''}
                  La variation moyenne de ${averageVariation} V/h approche du seuil critique. 
                  Une vérification technique est recommandée.`;
    }
    else {
        message = `⚠️ <strong>ALERTE</strong> ⚠️ La tension est <strong>critiquement mauvaise</strong> (${stablePercent}% de jours Conforme seulement). 
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

    // CALCULER LES JOURS D'ALERTE
    const alertData = calculateAlertDays(tensionResults);

    // Déterminer les couleurs selon le taux de stabilité
    const getStatusColor = () => {
        if (stabilityPercentage >= 90) return { bg: '#dcfce7', border: '#22c55e', text: '#166534', icon: '🟢' };
        if (stabilityPercentage >= 75) return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', icon: '🔵' };
        if (stabilityPercentage >= 60) return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '🟡' };
        return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '🔴' };
    };
    
    const statusColor = getStatusColor();

    container.innerHTML = `
        <div class="stability-dashboard" style="background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); border-radius: 12px; padding: 0; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            
            <!-- En-tête avec statut global -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 32px;">🔄</span>
                    <div>
                        <div style="font-weight: 700; font-size: 18px;">Analyse globale de Tension</div>
                        <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">Système ${systemType} DC - ${days} jour${days !== 1 ? 's' : ''} analysés</div>
                    </div>
                </div>
                <div style="background: ${statusColor.bg}; border: 2px solid ${statusColor.border}; color: ${statusColor.text}; padding: 10px 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700;">${stabilityPercentage}%</div>
                    <div style="font-size: 11px; font-weight: 600; margin-top: 4px;">Stabilité Globale</div>
                </div>
            </div>

            <!-- Contenu principal -->
            <div style="padding: 20px;">
                
                <!-- Stats principales - Grille 3x2 (modifié) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    <!-- Jours Conforme -->
                    <div style="background: linear-gradient(135deg, #f0fff4 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #22c55e; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.3s ease;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <div style="background: #22c55e; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">✅</div>
                            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Jours Conforme</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 800; color: #22c55e; text-align: center; margin-bottom: 8px;">${stable}</div>
                        <div style="text-align: center; padding: 6px 12px; background: rgba(34, 197, 94, 0.1); border-radius: 6px; font-size: 12px; color: #15803d; font-weight: 600;">
                            ${totalDays > 0 ? Math.round((stable / totalDays) * 100) : 0}% des jours
                        </div>
                    </div>

                    <!-- Jours Non Conformes -->
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #f59e0b; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.3s ease;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <div style="background: #f59e0b; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">⚠️</div>
                            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Jours Non Conformes</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 800; color: #f59e0b; text-align: center; margin-bottom: 8px;">${unstable}</div>
                        <div style="text-align: center; padding: 6px 12px; background: rgba(245, 158, 11, 0.1); border-radius: 6px; font-size: 12px; color: #92400e; font-weight: 600;">
                            ${totalDays > 0 ? Math.round((unstable / totalDays) * 100) : 0}% des jours
                        </div>
                    </div>

                    <!-- Jours Hors Limites -->
                    <div style="background: linear-gradient(135deg, #fee2e2 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #ef4444; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.3s ease;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <div style="background: #ef4444; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">🚫</div>
                            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Hors Limites</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 800; color: #ef4444; text-align: center; margin-bottom: 8px;">${outOfLimits}</div>
                        <div style="text-align: center; padding: 6px 12px; background: rgba(239, 68, 68, 0.1); border-radius: 6px; font-size: 12px; color: #991b1b; font-weight: 600;">
                            ${totalDays > 0 ? Math.round((outOfLimits / totalDays) * 100) : 0}% des jours
                        </div>
                    </div>

                    <!-- CARTE NOUVELLE : Jours d'Alerte -->
                    <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #f97316; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.3s ease;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <div style="background: #f97316; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">🚨</div>
                            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Jours d'Alerte</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 800; color: #f97316; text-align: center; margin-bottom: 8px;">
                            ${alertData.alertDays} / ${alertData.totalDays}
                        </div>
                        <div style="text-align: center; padding: 6px 12px; background: rgba(249, 115, 22, 0.1); border-radius: 6px; font-size: 12px; color: #92400e; font-weight: 600;">
                            ⚡ ${alertData.alertHours} heure(s) hors seuil
                        </div>
                    </div>

                    <!-- Variation Moyenne -->
                    <!-- <div style="background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #10b981; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.3s ease;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <div style="background: #10b981; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">📈</div>
                            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Variation Moy.</div>
                        </div>
                        <div style="font-size: 32px; font-weight: 800; color: #10b981; text-align: center; margin-bottom: 8px;">${averageVariation}</div>
                        <div style="text-align: center; padding: 6px 12px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; font-size: 12px; color: #065f46; font-weight: 600;">V/h</div>
                    </div>-->

                    <!-- Carte supplémentaire : Système -->
                    <div style="background: linear-gradient(135deg, #e0e7ff 0%, #ffffff 100%); padding: 16px; border-radius: 10px; border-left: 5px solid #6366f1; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.3s ease;">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <div style="background: #6366f1; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">⚡</div>
                            <div style="font-size: 11px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Système</div>
                        </div>
                        <div style="font-size: 28px; font-weight: 800; color: #6366f1; text-align: center; margin-bottom: 8px;">${systemType}</div>
                        <div style="text-align: center; padding: 6px 12px; background: rgba(99, 102, 241, 0.1); border-radius: 6px; font-size: 12px; color: #4f46e5; font-weight: 600;">DC</div>
                    </div>
                </div>

                <!-- Conclusion intelligente -->
                <div style="background: ${statusColor.bg}; border: 2px solid ${statusColor.border}; border-radius: 10px; padding: 16px; margin-bottom: 15px;">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <span style="font-size: 24px; line-height: 1.2;">${statusColor.icon}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; color: ${statusColor.text}; margin-bottom: 6px; font-size: 14px;">
                                ${stabilityPercentage >= 90 ? 'EXCELLENTE' : stabilityPercentage >= 75 ? 'BONNE' : stabilityPercentage >= 60 ? 'ACCEPTABLE' : 'CRITIQUE'}
                            </div>
                            <div style="color: ${statusColor.text}; font-size: 13px; line-height: 1.5;">
                                ${getConclusionMessage(stabilityPercentage, stable, unstable, outOfLimits, days, systemType, averageVariation)}
                            </div>
                        </div>
                    </div>
                </div>

                ${alertData.daysList.length > 0 ? `
                <!-- Liste des jours d'alerte - AJOUTÉ ICI -->
                <div style="background: #fff7ed; border-radius: 10px; padding: 16px; margin-bottom: 15px; border: 1px solid #fed7aa;">
                    <div style="font-weight: 600; color: #92400e; margin-bottom: 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
                        <span>📅</span> Jours avec dépassement de seuil (${alertData.daysList.length})
                    </div>
                    <div style="max-height: 200px; overflow-y: auto;">
                        <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #fed7aa; color: #92400e;">
                                    <th style="padding: 8px; text-align: left;">Date</th>
                                    <th style="padding: 8px; text-align: center;">Variation</th>
                                    <th style="padding: 8px; text-align: center;">Heures alerte</th>
                                    <th style="padding: 8px; text-align: center;">Min/Max</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${alertData.daysList.slice(0, 10).map(day => `
                                <tr style="border-bottom: 1px solid #fed7aa;">
                                    <td style="padding: 8px; font-weight: 500;">${day.date}</td>
                                    <td style="padding: 8px; text-align: center; color: ${parseFloat(day.dailyVariation) > alertData.limits.maxVariation ? '#dc2626' : '#f97316'};">
                                        ${day.dailyVariation}V
                                    </td>
                                    <td style="padding: 8px; text-align: center; color: ${day.hoursAboveThreshold > 0 ? '#dc2626' : '#f97316'};">
                                        ${day.hoursAboveThreshold}h
                                    </td>
                                    <td style="padding: 8px; text-align: center; color: ${day.isOutOfLimits ? '#dc2626' : '#92400e'};">
                                        ${day.min}V / ${day.max}V
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${alertData.daysList.length > 10 ? `
                        <div style="text-align: center; padding: 8px; color: #92400e; font-size: 10px;">
                            + ${alertData.daysList.length - 10} jour(s) supplémentaire(s)
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                <!-- Normes système -->
                <div style="background: #f8fafc; border-radius: 10px; padding: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-weight: 600; color: #2d3748; margin-bottom: 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
                        <span>⚡</span> Normes Système ${systemType}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #e53e3e;">
                            <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Tension Min</div>
                            <div style="font-size: 18px; font-weight: 700; color: #e53e3e;">${getSystemLimits(systemType).min}V</div>
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #f59e0b;">
                            <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Plage Idéale</div>
                            <div style="font-size: 18px; font-weight: 700; color: #f59e0b;">${getSystemLimits(systemType).ideal.min}V - ${getSystemLimits(systemType).ideal.max}V</div>
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #22c55e;">
                            <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Tension Max</div>
                            <div style="font-size: 18px; font-weight: 700; color: #22c55e;">${getSystemLimits(systemType).max}V</div>
                        </div>
                        <div style="background: white; padding: 12px; border-radius: 8px; border-left: 3px solid #3b82f6;">
                            <div style="font-size: 11px; color: #718096; margin-bottom: 4px;">Seuil Alerte</div>
                            <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${getSystemLimits(systemType).alertThreshold}V/h</div>
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
// ======================== CALCUL DES JOURS D'ALERTE ========================
function calculateAlertDays(tensionResults) {
    if (!tensionResults || !tensionResults.length) {
        return {
            alertDays: 0,
            totalDays: 0,
            percentage: 0,
            daysList: [],
            alertHours: 0
        };
    }

    // Group by date
    const dailyData = {};
    tensionResults.forEach(item => {
        const date = item.date;
        if (!dailyData[date]) {
            dailyData[date] = {
                values: [],
                min: Infinity,
                max: -Infinity,
                variations: []
            };
        }
        const tension = item.tension || item.valeur || 0;
        dailyData[date].values.push(tension);
        dailyData[date].min = Math.min(dailyData[date].min, tension);
        dailyData[date].max = Math.max(dailyData[date].max, tension);
        
        // Calculer les variations entre mesures successives
        if (dailyData[date].values.length > 1) {
            const lastValue = dailyData[date].values[dailyData[date].values.length - 2];
            const variation = Math.abs(tension - lastValue);
            dailyData[date].variations.push(variation);
        }
    });

    // Détecter le type de système
    const systemType = detectSystemType(tensionResults);
    const limits = getSystemLimits(systemType);
    
    let alertDays = 0;
    let alertHours = 0;
    const daysList = [];

    // Analyser chaque jour
    Object.entries(dailyData).forEach(([date, data]) => {
        // Variation maximale de la journée
        const dailyVariation = data.max - data.min;
        
        // Variation horaire moyenne
        const avgHourlyVariation = data.variations.length > 0 
            ? data.variations.reduce((a, b) => a + b, 0) / data.variations.length
            : 0;

        // Compter les heures avec variation > seuil
        const hoursAboveThreshold = data.variations.filter(v => v > limits.alertThreshold).length;
        
        // Conditions d'alerte
        const isAlertDay = 
            dailyVariation > limits.maxVariation ||          // Variation journalière trop élevée
            avgHourlyVariation > limits.alertThreshold ||    // Variation horaire moyenne trop élevée
            hoursAboveThreshold >= 3 ||                      // Au moins 3 heures au-dessus du seuil
            data.min < limits.min ||                         // Tension minimum trop basse
            data.max > limits.max;                           // Tension maximum trop élevée

        if (isAlertDay) {createStabilityChart
            alertDays++;
            alertHours += hoursAboveThreshold;
            daysList.push({
                date: date,
                dailyVariation: dailyVariation.toFixed(2),
                avgHourlyVariation: avgHourlyVariation.toFixed(2),
                hoursAboveThreshold: hoursAboveThreshold,
                min: data.min.toFixed(2),
                max: data.max.toFixed(2),
                isOutOfLimits: data.min < limits.min || data.max > limits.max
            });
        }
    });

    const totalDays = Object.keys(dailyData).length;
    const percentage = totalDays > 0 ? Math.round((alertDays / totalDays) * 100) : 0;

    return {
        alertDays,
        totalDays,
        percentage,
        daysList: daysList.sort((a, b) => parseFloat(b.dailyVariation) - parseFloat(a.dailyVariation)),
        alertHours,
        systemType,
        limits
    };
}
// ======================== CALCUL DES JOURS D'ALERTE ========================
function calculateAlertDays(tensionResults) {
    if (!tensionResults || !tensionResults.length) {
        return {
            alertDays: 0,
            totalDays: 0,
            percentage: 0,
            daysList: [],
            alertHours: 0
        };
    }

    // Group by date
    const dailyData = {};
    tensionResults.forEach(item => {
        const date = item.date;
        if (!dailyData[date]) {
            dailyData[date] = {
                values: [],
                min: Infinity,
                max: -Infinity,
                variations: []
            };
        }
        const tension = item.tension || item.valeur || 0;
        dailyData[date].values.push(tension);
        dailyData[date].min = Math.min(dailyData[date].min, tension);
        dailyData[date].max = Math.max(dailyData[date].max, tension);
        
        // Calculer les variations entre mesures successives
        if (dailyData[date].values.length > 1) {
            const lastValue = dailyData[date].values[dailyData[date].values.length - 2];
            const variation = Math.abs(tension - lastValue);
            dailyData[date].variations.push(variation);
        }
    });

    // Détecter le type de système
    const systemType = detectSystemType(tensionResults);
    const limits = getSystemLimits(systemType);
    
    let alertDays = 0;
    let alertHours = 0;
    const daysList = [];

    // Analyser chaque jour
    Object.entries(dailyData).forEach(([date, data]) => {
        // Variation maximale de la journée
        const dailyVariation = data.max - data.min;
        
        // Variation horaire moyenne
        const avgHourlyVariation = data.variations.length > 0 
            ? data.variations.reduce((a, b) => a + b, 0) / data.variations.length
            : 0;

        // Compter les heures avec variation > seuil
        const hoursAboveThreshold = data.variations.filter(v => v > limits.alertThreshold).length;
        
        // Conditions d'alerte (ajustez selon vos besoins)
        const isAlertDay = 
            dailyVariation > limits.maxVariation ||          // Variation journalière trop élevée
            avgHourlyVariation > limits.alertThreshold ||    // Variation horaire moyenne trop élevée
            hoursAboveThreshold >= 3 ||                      // Au moins 3 heures au-dessus du seuil
            data.min < limits.min ||                         // Tension minimum trop basse
            data.max > limits.max;                           // Tension maximum trop élevée

        if (isAlertDay) {
            alertDays++;
            alertHours += hoursAboveThreshold;
            daysList.push({
                date: date,
                dailyVariation: dailyVariation.toFixed(2),
                avgHourlyVariation: avgHourlyVariation.toFixed(2),
                hoursAboveThreshold: hoursAboveThreshold,
                min: data.min.toFixed(2),
                max: data.max.toFixed(2),
                isOutOfLimits: data.min < limits.min || data.max > limits.max
            });
        }
    });

    const totalDays = Object.keys(dailyData).length;
    const percentage = totalDays > 0 ? Math.round((alertDays / totalDays) * 100) : 0;

    return {
        alertDays,
        totalDays,
        percentage,
        daysList: daysList.sort((a, b) => parseFloat(b.dailyVariation) - parseFloat(a.dailyVariation)),
        alertHours,
        systemType,
        limits
    };
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

// ======================== FILTRE GLOBAL PAR DATES ========================
function createGlobalDateFilter() {
    const allDates = allClientsHourlyMatrix.dates || [];
    if (allDates.length === 0) return null;

    // Vérifier si un filtre est actif
    const isFilterActive = window.filteredDates && 
                          window.filteredDates.length > 0 && 
                          window.filteredDates.length < allDates.length;
    
    // Déterminer la classe CSS selon l'état
    const containerClass = isFilterActive ? 'global-filter-container filter-active' : 'global-filter-container';

    return `
        <div class="${containerClass}">
            <!-- En-tête avec titre et actions -->
            <div class="filter-header">
                <div class="filter-title">
                    <span class="filter-title-icon">🔍</span>
                    <div>
                        <div>Filtre Global des Données</div>
                        <div style="font-size: 12px; color: #718096; margin-top: 2px;">
                            ${allDates.length} jour${allDates.length !== 1 ? 's' : ''} disponibles
                            ${isFilterActive ? ` · ${window.filteredDates.length} sélectionné${window.filteredDates.length !== 1 ? 's' : ''}` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="filter-actions">
                    <button id="reset-all-filters-btn" class="filter-btn filter-btn-secondary">
                        <span style="font-size: 14px;">🔄</span>
                        Réinitialiser
                    </button>
                    <button id="apply-filter-btn" class="filter-btn filter-btn-primary">
                        <span style="font-size: 14px;">✅</span>
                        Appliquer
                    </button>
                </div>
            </div>
            
            <!-- Filtres principaux -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 20px;">
                <!-- Sélection par période -->
                <div class="filter-group">
                    <div class="filter-group-title">
                        <span>📅</span> Période
                    </div>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 140px;">
                            <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 500;">
                                Date de début
                            </label>
                            <input type="date" id="filter-start-date" class="filter-date-input" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; 
                                          font-size: 13px; transition: all 0.2s;"
                                   onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'"
                                   onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                        </div>
                        <div style="flex: 1; min-width: 140px;">
                            <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 500;">
                                Date de fin
                            </label>
                            <input type="date" id="filter-end-date" class="filter-date-input" 
                                   style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; 
                                          font-size: 13px; transition: all 0.2s;"
                                   onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'"
                                   onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                        </div>
                    </div>
                </div>
                
                <!-- Filtre par année/mois -->
                <div class="filter-group">
                    <div class="filter-group-title">
                        <span>🗓️</span> Année/Mois
                    </div>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 120px;">
                            <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 500;">
                                Année
                            </label>
                            <select id="filter-year" class="filter-select" 
                                    style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; 
                                           font-size: 13px; background: white; cursor: pointer;
                                           transition: all 0.2s;"
                                    onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'"
                                    onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                                <option value="all">Toutes les années</option>
                                ${[...new Set(allDates.map(d => d.split('/')[2]))].sort((a, b) => b - a).map(year => 
                                    `<option value="${year}">${year}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div style="flex: 1; min-width: 120px;">
                            <label style="display: block; font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 500;">
                                Mois
                            </label>
                            <select id="filter-month" class="filter-select" 
                                    style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; 
                                           font-size: 13px; background: white; cursor: pointer;
                                           transition: all 0.2s;"
                                    onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'"
                                    onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                                <option value="all">Tous les mois</option>
                                <option value="1">Janvier</option>
                                <option value="2">Février</option>
                                <option value="3">Mars</option>
                                <option value="4">Avril</option>
                                <option value="5">Mai</option>
                                <option value="6">Juin</option>
                                <option value="7">Juillet</option>
                                <option value="8">Août</option>
                                <option value="9">Septembre</option>
                                <option value="10">Octobre</option>
                                <option value="11">Novembre</option>
                                <option value="12">Décembre</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Sélection individuelle de dates -->
            <div class="filter-group">
                <div class="filter-group-title">
                    <span>📌</span> Sélection de dates spécifiques
                </div>
                
                <div class="date-selection-section">
                    <div class="date-selection-actions">
                        <button id="select-all-dates" class="date-select-btn date-select-btn-primary">
                            ✅ Tout sélectionner
                        </button>
                        <button id="deselect-all-dates" class="date-select-btn date-select-btn-secondary">
                            ❌ Tout désélectionner
                        </button>
                    </div>
                    
                    <div class="date-checkbox-container">
                        ${allDates.map(date => {
                            const isChecked = window.filteredDates ? 
                                window.filteredDates.includes(date) : true;
                            const labelClass = isChecked ? 'date-checkbox-label checked' : 'date-checkbox-label';
                            
                            return `
                                <label class="${labelClass}">
                                    <input type="checkbox" class="date-checkbox" value="${date}" ${isChecked ? 'checked' : ''}>
                                    <span>${date}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
            
            <!-- Indicateur de sélection -->
            <div id="filter-indicator" class="filter-indicator ${isFilterActive ? 'filtered' : ''}">
                <span class="filter-indicator-icon">📊</span>
                <div class="filter-indicator-info">
                    <div class="filter-indicator-title">
                        <span id="selected-dates-count">${isFilterActive ? window.filteredDates.length : allDates.length}</span>
                        jour${(isFilterActive ? window.filteredDates.length : allDates.length) !== 1 ? 's' : ''} sélectionné${(isFilterActive ? window.filteredDates.length : allDates.length) !== 1 ? 's' : ''}
                    </div>
                    <div class="filter-indicator-description">
                        Le filtre s'applique à tous les graphiques et tableaux de l'onglet TECHNIQUE
                    </div>
                </div>
                ${isFilterActive ? `
                <button onclick="resetAllFilters()" style="background: #f1f5f9; border: 1px solid #cbd5e1; 
                        padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer; 
                        color: #64748b; font-weight: 500;">
                    Effacer le filtre
                </button>
                ` : ''}
            </div>
        </div>
    `;
}
// ======================== RÉINITIALISATION COMPLÈTE DES FILTRES ========================
function resetAllFilters() {
    document.querySelectorAll('.date-checkbox').forEach(cb => {
        cb.checked = true;
        if (cb.parentElement) {
            cb.parentElement.classList.add('checked');
        }
    });
    
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    document.getElementById('filter-year').value = 'all';
    document.getElementById('filter-month').value = 'all';
    
    window.filteredDates = allClientsHourlyMatrix.dates;
    refreshAllTechniqueComponents();
    console.log('✅ Tous les filtres réinitialisés');
}

// ======================== MISE À JOUR DE L'INDICATEUR ========================
function updateFilterIndicator() {
    const allDates = allClientsHourlyMatrix.dates || [];
    const selectedCount = window.filteredDates ? window.filteredDates.length : allDates.length;
    const isFilterActive = selectedCount < allDates.length;
    
    const indicator = document.getElementById('filter-indicator');
    const countSpan = document.getElementById('selected-dates-count');
    const container = document.querySelector('.global-filter-container');
    
    if (countSpan) {
        countSpan.textContent = selectedCount;
    }
    
    if (indicator) {
        indicator.className = isFilterActive ? 'filter-indicator filtered' : 'filter-indicator';
    }
    
    if (container) {
        container.className = isFilterActive ? 
            'global-filter-container filter-active' : 
            'global-filter-container';
    }
}
// ======================== FONCTION D'APPLICATION DU FILTRE ========================
function applyGlobalDateFilter() {
    const selectedCheckboxes = document.querySelectorAll('.date-checkbox:checked');
    const selectedDates = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedDates.length === 0) {
        alert('Veuillez sélectionner au moins une date');
        return false;
    }
    
    window.filteredDates = selectedDates.sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateA - dateB;
    });
    
    refreshAllTechniqueComponents();
    console.log(`✅ Filtre appliqué: ${selectedDates.length} jour(s) sélectionné(s)`);
    return true;
}

// Dans addAllClientsStyles() ou dans une nouvelle fonction
function addDPDTStyles() {
    if (document.querySelector('#dpdt-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'dpdt-styles';
    styles.textContent = `
        /* Styles pour le tableau DP/DT */
        .dpdt-table-container {
            margin-top: 20px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .dpdt-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        
        .dpdt-table th {
            background: #f8fafc;
            padding: 12px 10px;
            text-align: left;
            font-weight: 600;
            color: #475569;
            border-bottom: 2px solid #e2e8f0;
            position: sticky;
            top: 0;
        }
        
        .dpdt-table td {
            padding: 10px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
        }
        
        .dpdt-dt-row {
            background: linear-gradient(90deg, rgba(254, 226, 226, 0.1) 0%, rgba(254, 226, 226, 0.05) 100%);
            border-left: 3px solid #ef4444;
        }
        
        .dpdt-dp-row {
            background: linear-gradient(90deg, rgba(254, 243, 199, 0.1) 0%, rgba(254, 243, 199, 0.05) 100%);
            border-left: 3px solid #f59e0b;
        }
        
        .dpdt-dt-row:hover {
            background: linear-gradient(90deg, rgba(254, 226, 226, 0.2) 0%, rgba(254, 226, 226, 0.1) 100%);
        }
        
        .dpdt-dp-row:hover {
            background: linear-gradient(90deg, rgba(254, 243, 199, 0.2) 0%, rgba(254, 243, 199, 0.1) 100%);
        }
        
        .dpdt-type-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .dpdt-type-badge.dt {
            background: #fee2e2;
            color: #dc2626;
            border: 1px solid #fecaca;
        }
        
        .dpdt-type-badge.dp {
            background: #fef3c7;
            color: #d97706;
            border: 1px solid #fde68a;
        }
        
        .dpdt-hour-chip {
            display: inline-block;
            margin: 2px;
            padding: 4px 8px;
            background: #f1f5f9;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            color: #4a5568;
            border: 1px solid #e2e8f0;
        }
        
        .dpdt-hour-chip.dt {
            background: #fee2e2;
            border-color: #fecaca;
            color: #991b1b;
        }
        
        .dpdt-hour-chip.dp {
            background: #fef3c7;
            border-color: #fde68a;
            color: #92400e;
        }
        
        /* Statistiques DP/DT */
        .dpdt-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            padding: 15px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
        }
        
        .dpdt-stat-card {
            text-align: center;
            padding: 15px;
            border-radius: 8px;
            background: white;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        
        .dpdt-stat-card.dt {
            border-top: 3px solid #ef4444;
        }
        
        .dpdt-stat-card.dp {
            border-top: 3px solid #f59e0b;
        }
        
        .dpdt-stat-value {
            display: block;
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 5px;
        }
        
        .dpdt-stat-value.dt {
            color: #dc2626;
        }
        
        .dpdt-stat-value.dp {
            color: #d97706;
        }
        
        .dpdt-stat-label {
            font-size: 11px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .dpdt-table {
                font-size: 11px;
            }
            
            .dpdt-table th,
            .dpdt-table td {
                padding: 8px 6px;
            }
            
            .dpdt-stats {
                grid-template-columns: 1fr;
            }
        }
    `;
    
    document.head.appendChild(styles);
}

// ======================== AFFICHAGE COMPACT DES PÉRIODES DP/DT ========================
function createCompactDPDTDisplay(dates, eventsByDate) {
    if (dates.length === 0) {
        return `
            <div style="text-align: center; padding: 20px; color: #718096; font-size: 14px;">
                <span>📭 Aucun événement de délestage pour les dates sélectionnées</span>
            </div>
        `;
    }
    
    let displayHTML = '';
    
    dates.forEach((date, dateIndex) => {
        const dateEvents = eventsByDate[date] || [];
        
        if (dateEvents.length === 0) return;
        
        // Séparer DP et DT
        const dpEvents = dateEvents.filter(e => e.type === 'DP');
        const dtEvents = dateEvents.filter(e => e.type === 'DT');
        
        // Grouper les événements en périodes continues
        const dpPeriods = groupEventsIntoPeriods(dpEvents);
        const dtPeriods = groupEventsIntoPeriods(dtEvents);
        
        // Format compact pour les périodes DP
        let dpCompact = '';
        if (dpPeriods.length > 0) {
            dpCompact = dpPeriods.map(period => {
                const startHour = period.events[0].heure.substring(0, 5);
                const endHour = period.events[period.events.length - 1].heure.substring(0, 5);
                const duration = calculateDuration(startHour, endHour);
                const extra = period.events.length > 1 ? ` (+${period.events.length - 1})` : '';
                
                return `
                    <div style="display: inline-block; margin-right: 15px;">
                        <span style="font-family: 'Courier New', monospace; font-weight: 600; color: #92400e;">
                            ${startHour}
                        </span>
                        <span style="color: #a0aec0; margin: 0 5px;">→</span>
                        <span style="font-family: 'Courier New', monospace; font-weight: 600; color: #92400e;">
                            ${endHour}
                        </span>
                        <span style="font-family: 'Courier New', monospace; color: #d97706; margin-left: 5px; font-size: 11px;">
                            ${duration}${extra}
                        </span>
                    </div>
                `;
            }).join('');
        }
        
        // Format compact pour les périodes DT
        let dtCompact = '';
        if (dtPeriods.length > 0) {
            dtCompact = dtPeriods.map(period => {
                const startHour = period.events[0].heure.substring(0, 5);
                const endHour = period.events[period.events.length - 1].heure.substring(0, 5);
                const duration = calculateDuration(startHour, endHour);
                const extra = period.events.length > 1 ? ` (+${period.events.length - 1})` : '';
                
                return `
                    <div style="display: inline-block; margin-right: 15px;">
                        <span style="font-family: 'Courier New', monospace; font-weight: 600; color: #991b1b;">
                            ${startHour}
                        </span>
                        <span style="color: #a0aec0; margin: 0 5px;">→</span>
                        <span style="font-family: 'Courier New', monospace; font-weight: 600; color: #991b1b;">
                            ${endHour}
                        </span>
                        <span style="font-family: 'Courier New', monospace; color: #dc2626; margin-left: 5px; font-size: 11px;">
                            ${duration}${extra}
                        </span>
                    </div>
                `;
            }).join('');
        }
        
        displayHTML += `
            <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; 
                  margin-bottom: ${dateIndex < dates.length - 1 ? '10px' : '0'}; 
                  padding: 12px 15px;">
                
                <!-- En-tête de la date -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 700; color: #2d3748; font-size: 14px;">
                        ${date}
                        <span style="font-size: 11px; color: #718096; font-weight: normal; margin-left: 8px;">
                            ${dateEvents.length} événement${dateEvents.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    
                    <!-- Indicateurs rapides -->
                    <div style="display: flex; gap: 10px;">
                        ${dpEvents.length > 0 ? `
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <div style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></div>
                                <span style="font-size: 11px; color: #92400e; font-weight: 600;">
                                    ${dpEvents.length} DP
                                </span>
                            </div>
                        ` : ''}
                        ${dtEvents.length > 0 ? `
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <div style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></div>
                                <span style="font-size: 11px; color: #991b1b; font-weight: 600;">
                                    ${dtEvents.length} DT
                                </span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Périodes DP -->
                ${dpCompact ? `
                    <div style="margin-bottom: ${dtCompact ? '8px' : '0'};">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <div style="width: 12px; height: 12px; background: #fef3c7; border-radius: 3px; 
                                  border: 1px solid #fcd34d; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 8px; color: #92400e; font-weight: bold;">DP</span>
                            </div>
                            <span style="font-size: 11px; color: #718096; font-weight: 600;">Délestage Partiel</span>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-left: 20px;">
                            ${dpCompact}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Périodes DT -->
                ${dtCompact ? `
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <div style="width: 12px; height: 12px; background: #fee2e2; border-radius: 3px; 
                                  border: 1px solid #f87171; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 8px; color: #991b1b; font-weight: bold;">DT</span>
                            </div>
                            <span style="font-size: 11px; color: #718096; font-weight: 600;">Délestage Total</span>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-left: 20px;">
                            ${dtCompact}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    // ⚠️ SUPPRIMEZ CE BLOC COMPLET (les 3 cartes) :
    // const statsHTML = `...`; // ← EFFACER
    
    // Et modifiez cette ligne :
    // return statsHTML + displayHTML; // ← ANCIENNE VERSION
    return displayHTML; // ← NOUVELLE VERSION
}

// ======================== FONCTIONS UTILITAIRES ========================

function groupEventsIntoPeriods(events) {
    if (events.length === 0) return [];
    
    // Trier les événements par heure
    const sortedEvents = [...events].sort((a, b) => {
        const timeA = convertTimeToMinutes(a.heure);
        const timeB = convertTimeToMinutes(b.heure);
        return timeA - timeB;
    });
    
    const periods = [];
    let currentPeriod = null;
    
    sortedEvents.forEach((event, index) => {
        const eventTime = convertTimeToMinutes(event.heure);
        
        if (!currentPeriod) {
            // Démarrer une nouvelle période
            currentPeriod = {
                events: [event],
                startTime: eventTime,
                endTime: eventTime
            };
        } else {
            const lastEventTime = currentPeriod.endTime;
            const timeDiff = eventTime - lastEventTime;
            
            // Si l'événement est dans les 30 minutes du précédent, continuer la période
            if (timeDiff <= 30) {
                currentPeriod.events.push(event);
                currentPeriod.endTime = eventTime;
            } else {
                // Fin de période, en commencer une nouvelle
                periods.push(currentPeriod);
                currentPeriod = {
                    events: [event],
                    startTime: eventTime,
                    endTime: eventTime
                };
            }
        }
        
        // Si c'est le dernier événement, terminer la période
        if (index === sortedEvents.length - 1) {
            periods.push(currentPeriod);
        }
    });
    
    return periods;
}

function convertTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

function calculateDuration(startTime, endTime) {
    const startMinutes = convertTimeToMinutes(startTime);
    const endMinutes = convertTimeToMinutes(endTime);
    const durationMinutes = endMinutes - startMinutes;
    
    if (durationMinutes < 60) {
        return `${durationMinutes}mn`;
    } else {
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        return minutes > 0 ? `${hours}h${minutes.toString().padStart(2, '0')}mn` : `${hours}h`;
    }
}
// Fonction utilitaire pour les noms de mois
function getMonthName(monthNumber) {
    const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months[monthNumber - 1];
}

// Fonction pour afficher les détails d'un jour (modal)
function showDayDetails(date) {
    // Implémentez cette fonction pour afficher un modal avec les détails du jour
    alert(`Détails pour ${date}`);
}
// ======================== RAFRAÎCHISSEMENT COMPLET DE L'ONGLET TECHNIQUE ========================
function refreshAllTechniqueComponents() {
    if (!window.filteredDates || window.filteredDates.length === 0) {
        window.filteredDates = allClientsHourlyMatrix.dates;
    }
    displayAllClientsTab();
}
// 1. Tableau matriciel
function refreshFilteredMatrixTable() {
    const tableBody = document.querySelector('.all-clients-table tbody');
    if (tableBody) {
        const filteredRows = generateFilteredTableRows();
        tableBody.innerHTML = filteredRows;
        console.log('✅ Tableau matriciel mis à jour');
    }
}

// 2. Statistiques techniques
function refreshFilteredTechnicalStats() {
    // Recalculer les statistiques avec les dates filtrées
    const filteredStats = calculateFilteredTechnicalStats();
    
    // Mettre à jour l'affichage des statistiques
    updateStatsDisplay(filteredStats);
}
// Calcul des statistiques techniques filtrées
function calculateFilteredTechnicalStats() {
    const dates = window.filteredDates || allClientsHourlyMatrix.dates;
    const sortedClients = Object.keys(allResultsByClient).sort((a, b) => {
        const numA = parseInt(a, 16) || 0;
        const numB = parseInt(b, 16) || 0;
        return numA - numB;
    });

    // Calculer l'énergie maximale par jour (filtrée)
    const energyDataByDay = {};
    dates.forEach(date => {
        let totalDayEnergy = 0;
        sortedClients.forEach(clientId => {
            const clientData = allResultsByClient[clientId];
            let maxEnergyForDay = 0;

            if (clientData.combinedHourlyData && clientData.combinedHourlyData.length > 0) {
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

    // Calculer les tensions filtrées
    let tensionValues = [];
    let maxTensionValue = 0;
    let maxTensionDate = '';
    let minTensionValue = Infinity;
    let minTensionDate = '';

    dates.forEach(date => {
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

    // Trouver l'énergie maximale
    let maxEnergyValue = 0;
    let maxEnergyDate = '';
    Object.entries(energyDataByDay).forEach(([date, energy]) => {
        if (energy > maxEnergyValue) {
            maxEnergyValue = energy;
            maxEnergyDate = date;
        }
    });

    return {
        dates: dates,
        clients: sortedClients,
        energyDataByDay: energyDataByDay,
        maxEnergyValue: maxEnergyValue,
        maxEnergyDate: maxEnergyDate,
        averageTension: averageTension,
        maxTensionValue: maxTensionValue > 0 ? maxTensionValue.toFixed(2) : 'N/A',
        maxTensionDate: maxTensionDate,
        minTensionValue: minTensionDisplay,
        minTensionDate: minTensionDate
    };
}

// Mise à jour de l'affichage des statistiques
function updateStatsDisplay(stats) {
    // Mettre à jour le tableau des statistiques
    const statsTable = document.querySelector('.stats-summary-table');
    if (statsTable) {
        statsTable.innerHTML = `
            <tbody>
                <tr>
                    <td class="stats-label">⚡ Énergie Maximale</td>
                    <td class="stats-value">${stats.maxEnergyValue} Wh</td>
                    <td class="stats-date">${stats.maxEnergyDate}</td>
                </tr>
                <tr>
                    <td class="stats-label">📊 Tension Moyenne</td>
                    <td class="stats-value">${stats.averageTension} V</td>
                    <td class="stats-date">Système ${detectSystemTypeFromTensionValue(parseFloat(stats.averageTension) || 14)}</td>
                </tr>
                <tr>
                    <td class="stats-label">⚡ Tension Minimale</td>
                    <td class="stats-value">${stats.minTensionValue} V</td>
                    <td class="stats-date">${stats.minTensionDate || '-'}</td>
                </tr>
                <tr>
                    <td class="stats-label">⚡ Tension Maximale</td>
                    <td class="stats-value">${stats.maxTensionValue} V</td>
                    <td class="stats-date">${stats.maxTensionDate || '-'}</td>
                </tr>
                <tr>
                    <td class="stats-label">📏 Variation Max/Jour</td>
                    <td class="stats-value" style="color: #d69e2e;">
                        ${(detectSystemTypeFromTensionValue(parseFloat(stats.averageTension) || 14) === '24V' ? 5 : 2.5).toFixed(1)} V
                    </td>
                    <td class="stats-date">
                        Seuil alerte: ${detectSystemTypeFromTensionValue(parseFloat(stats.averageTension) || 14) === '24V' ? '3' : '1.5'} V/h
                    </td>
                </tr>
            </tbody>
        `;
    }
    
    // Mettre à jour les en-têtes
    const header = document.querySelector('.all-clients-stats');
    if (header) {
        const statItems = header.querySelectorAll('.stat-item');
        if (statItems[0]) {
            statItems[0].querySelector('.stat-text').textContent = `${stats.dates.length} jours`;
        }
        if (statItems[1]) {
            statItems[1].querySelector('.stat-text').textContent = `${stats.clients.length} client${stats.clients.length !== 1 ? 's' : ''}`;
        }
    }
}
// 3. Analyse de stabilité
function refreshFilteredStabilityAnalysis() {
    if (tensionResults && tensionResults.length > 0) {
        // Filtrer les résultats de tension
        const filteredTensionResults = tensionResults.filter(item => 
            window.filteredDates.includes(item.date)
        );
        
        if (filteredTensionResults.length > 0) {
            // Recalculer l'analyse de stabilité
            const filteredStabilityData = analyzeTensionStability(filteredTensionResults);
            
            // Mettre à jour l'affichage
            const container = document.getElementById('stability-analysis-container');
            if (container) {
                createStabilityChart('stability-analysis-container', filteredStabilityData, filteredTensionResults);
                console.log('✅ Analyse de stabilité mise à jour');
            }
        }
    }
}

// 4. Graphique d'énergie
function refreshFilteredEnergyChart() {
    const filteredEnergyData = calculateFilteredEnergyData();
    const maxEnergyValue = Math.max(...Object.values(filteredEnergyData));
    const maxEnergyDate = Object.keys(filteredEnergyData).find(date => filteredEnergyData[date] === maxEnergyValue);
    
    if (window.allClientsEnergyChartInstance) {
        window.allClientsEnergyChartInstance.destroy();
    }
    
    // Recréer le graphique avec données filtrées
    createAllClientsEnergyChart(window.filteredDates, filteredEnergyData, maxEnergyDate);
    console.log('✅ Graphique d\'énergie mis à jour');
}

// 5. Graphique de tension
function refreshFilteredTensionChart() {
    const filteredTensionData = calculateFilteredTensionData();
    const systemType = detectSystemTypeFromTensionValue(
        Object.values(filteredTensionData).reduce((acc, day) => {
            if (day && day.min && day.max) {
                return acc + (day.min + day.max) / 2;
            }
            return acc;
        }, 0) / Object.keys(filteredTensionData).length
    );
    const systemLimits = getSystemLimits(systemType);
    
    if (window.allClientsTensionChartInstance) {
        window.allClientsTensionChartInstance.destroy();
    }
    
    createAllClientsTensionChart(window.filteredDates, filteredTensionData, systemType, systemLimits);
    console.log('✅ Graphique de tension mis à jour');
}
function refreshFilteredDisplay() {
    // Mettre à jour le tableau
    const tableBody = document.querySelector('.all-clients-table tbody');
    if (tableBody) {
        // Recréer les lignes avec les dates filtrées
        const filteredRows = generateFilteredTableRows();
        tableBody.innerHTML = filteredRows;
    }
    
    // Mettre à jour les graphiques
    updateFilteredCharts();
}

function generateFilteredTableRows() {
    if (!window.filteredDates || window.filteredDates.length === 0) {
        return generateAllClientsTableRows(0, allClientsHourlyMatrix.dates.length * allClientsHourlyMatrix.hours.length);
    }
    
    let rows = '';
    let rowIndex = 0;
    const itemsPerPage = window.allClientsItemsPerPage || 50;
    const currentPage = window.allClientsCurrentPage || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    // Filtrer les dates
    const filteredDates = window.filteredDates;
    
    // Parcourir toutes les combinaisons date/heure filtrées
    for (let i = 0; i < filteredDates.length; i++) {
        const date = filteredDates[i];
        
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

function updateFilteredCharts() {
    // Mettre à jour le graphique d'énergie
    const filteredEnergyData = calculateFilteredEnergyData();
    const maxEnergyValue = Math.max(...Object.values(filteredEnergyData));
    const maxEnergyDate = Object.keys(filteredEnergyData).find(date => filteredEnergyData[date] === maxEnergyValue);
    
    if (window.allClientsEnergyChartInstance) {
        window.allClientsEnergyChartInstance.destroy();
    }
    
    // Recréer le graphique avec données filtrées
    createAllClientsEnergyChart(window.filteredDates || allClientsHourlyMatrix.dates, filteredEnergyData, maxEnergyDate);
    
    // Mettre à jour le graphique de tension
    const filteredTensionData = calculateFilteredTensionData();
    const systemType = detectSystemTypeFromTensionValue(
        Object.values(filteredTensionData).reduce((acc, day) => {
            if (day && day.min && day.max) {
                return acc + (day.min + day.max) / 2;
            }
            return acc;
        }, 0) / Object.keys(filteredTensionData).length
    );
    const systemLimits = getSystemLimits(systemType);
    
    if (window.allClientsTensionChartInstance) {
        window.allClientsTensionChartInstance.destroy();
    }
    
    createAllClientsTensionChart(window.filteredDates || allClientsHourlyMatrix.dates, filteredTensionData, systemType, systemLimits);
}

function calculateFilteredEnergyData() {
    const dates = window.filteredDates || allClientsHourlyMatrix.dates;
    const energyDataByDay = {};
    
    // Pour chaque date filtrée
    dates.forEach(date => {
        let totalDayEnergy = 0;
        
        // Pour chaque client
        allClientsHourlyMatrix.clients.forEach(clientId => {
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
    
    return energyDataByDay;
}

function calculateFilteredTensionData() {
    const dates = window.filteredDates || allClientsHourlyMatrix.dates;
    const tensionByDay = {};
    
    dates.forEach(date => {
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
    
    return tensionByDay;
}
function addFilterIndicator() {
    const header = document.querySelector('.all-clients-header h3');
    if (header && window.filteredDates) {
        const totalDates = allClientsHourlyMatrix.dates.length;
        const filteredCount = window.filteredDates.length;
        
        if (filteredCount < totalDates) {
            // Ajouter un badge de filtrage
            if (!document.querySelector('.filter-badge')) {
                const badge = document.createElement('span');
                badge.className = 'filter-badge';
                badge.innerHTML = `
                    <span style="background: #3b82f6; color: white; padding: 2px 8px; 
                          border-radius: 12px; font-size: 12px; margin-left: 10px;">
                        🔍 Filtre actif: ${filteredCount}/${totalDates} jours
                    </span>
                `;
                header.appendChild(badge);
            }
        } else {
            // Retirer le badge si pas de filtre
            const badge = document.querySelector('.filter-badge');
            if (badge) {
                badge.remove();
            }
        }
    }
}
// NOUVELLE FONCTION : Afficher l'onglet TOUS LES CLIENTS
// ======================== AFFICHAGE ONGLET TOUS LES CLIENTS ========================
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
    const itemsPerPage = window.allClientsItemsPerPage || 50;
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
        ? { min: 22, max: 31, ideal: { min: 24, max: 29 }, normal: 28 }
        : { min: 11, max: 15, ideal: { min: 12, max: 14.5 }, normal: 14 };

    // === ANALYSE DES ÉVÉNEMENTS DP/DT ===
    const dpdtEvents = analyzeDPDTEvents();
    const hasDPDTEvents = dpdtEvents && dpdtEvents.length > 0;
    
    // Filtrer les événements DP/DT selon le filtre global
    let filteredDPDTEvents = dpdtEvents;
    if (window.filteredDates && window.filteredDates.length > 0) {
        filteredDPDTEvents = dpdtEvents.filter(event => 
            window.filteredDates.includes(event.date)
        );
    }
    
    // Grouper les événements DP/DT par date pour l'affichage
    const dpdtEventsByDate = {};
    filteredDPDTEvents.forEach(event => {
        if (!dpdtEventsByDate[event.date]) {
            dpdtEventsByDate[event.date] = [];
        }
        dpdtEventsByDate[event.date].push(event);
    });
    
    const dpdtDates = Object.keys(dpdtEventsByDate).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateA - dateB;
    });

    // === ANALYSE DE STABILITÉ ===
    let stabilityData = null;
    let stabilitySectionHTML = '';

    if (tensionResults && tensionResults.length > 0) {
        // Filtrer les données de tension si un filtre est actif
        const filteredTensionResults = window.filteredDates ? 
            tensionResults.filter(item => window.filteredDates.includes(item.date)) : 
            tensionResults;
        
        if (filteredTensionResults.length > 0) {
            stabilityData = analyzeTensionStability(filteredTensionResults);
            
            // Créer la section stabilité avec tableau DP/DT
            stabilitySectionHTML = `
                <!-- SECTION STABILITÉ AVEC TABLEAU DP/DT -->
                <div class="stability-section" style="margin: 25px 0; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; overflow: hidden;">
                    <!-- En-tête de la section -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px;">
                        <h4 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                            <span>🔄</span> Analyse globale de la Tension
                            ${window.filteredDates && window.filteredDates.length < allClientsHourlyMatrix.dates.length ? 
                                `<span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px; margin-left: 10px;">
                                    🔍 Filtre: ${window.filteredDates.length}/${allClientsHourlyMatrix.dates.length} jours
                                </span>` : ''
                            }
                        </h4>
                    </div>
                    
                    <!-- Conteneur principal -->
                    <div style="padding: 0;">
                        <!-- Analyse de stabilité -->
                        <div id="stability-analysis-container" style="padding: 20px; ${hasDPDTEvents ? 'border-bottom: 1px solid #e2e8f0;' : ''}"></div>
                        
                        <!-- Tableau des événements DP/DT -->
                        ${hasDPDTEvents && dpdtDates.length > 0 ? `
                        <div style="padding: 20px; background: #f8fafc;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                <h5 style="margin: 0; color: #2c3e50; display: flex; align-items: center; gap: 8px; font-size: 16px;">
                                    <span>⚡</span> Événements de Délestage (DP/DT)
                                    <span style="font-size: 12px; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; margin-left: 10px;">
                                        ${filteredDPDTEvents.length} événement${filteredDPDTEvents.length !== 1 ? 's' : ''}
                                    </span>
                                </h5>
                                <div style="display: flex; gap: 10px; font-size: 11px; color: #718096;">
                                    <div style="display: flex; align-items: center; gap: 4px;">
                                        <div style="width: 10px; height: 10px; background: #fef3c7; border-radius: 2px; border: 1px solid #fcd34d;"></div>
                                        <span>DP = Délestage Partiel</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 4px;">
                                        <div style="width: 10px; height: 10px; background: #fee2e2; border-radius: 2px; border: 1px solid #f87171;"></div>
                                        <span>DT = Délestage Total</span>
                                    </div>
                                </div>
                            </div>
                            ${createCompactDPDTDisplay(dpdtDates, dpdtEventsByDate)}
                        </div>
                        ` : hasDPDTEvents ? `
                        <div style="padding: 30px; text-align: center; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <div style="color: #718096; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; flex-direction: column;">
                                <span style="font-size: 32px;">📭</span>
                                <span>Aucun événement de délestage (DP/DT) pour les dates filtrées</span>
                                <small style="color: #a0aec0; margin-top: 5px;">
                                    (${dpdtEvents.length} événement${dpdtEvents.length !== 1 ? 's' : ''} détecté${dpdtEvents.length !== 1 ? 's' : ''} au total)
                                </small>
                            </div>
                        </div>
                        ` : `
                        <div style="padding: 20px; text-align: center; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                            <div style="color: #718096; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <span>ℹ️</span>
                                <span>Aucun événement de délestage (DP/DT) détecté dans les fichiers ENR analysés</span>
                            </div>
                        </div>
                        `}
                    </div>
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
    } else {
        stabilitySectionHTML = `
            <div class="no-stability-data" style="margin: 25px 0; padding: 40px; background: #f7fafc; border-radius: 8px; border: 2px dashed #cbd5e0; text-align: center;">
                <span style="font-size: 48px; display: block; margin-bottom: 15px; color: #a0aec0;">📊</span>
                <span style="color: #718096; font-size: 14px;">Données de tension insuffisantes pour l'analyse de stabilité</span>
            </div>
        `;
    }

    // === DÉTERMINER LES DATES À UTILISER ===
    const datesToUse = window.filteredDates || allClientsHourlyMatrix.dates;
    
    // === CALCUL DES DONNÉES FILTRÉES ===
    const filteredEnergyData = {};
    datesToUse.forEach(date => {
        if (energyDataByDay[date] !== undefined) {
            filteredEnergyData[date] = energyDataByDay[date];
        }
    });
    
    const filteredTensionData = {};
    datesToUse.forEach(date => {
        if (tensionByDay[date]) {
            filteredTensionData[date] = tensionByDay[date];
        }
    });

    // === CONSTRUCTION DU HTML ===
    contentElement.innerHTML = `
        <!-- FILTRE GLOBAL DES DATES EN HAUT -->
        ${createGlobalDateFilter() || ''}
        
        <div class="all-clients-header">
            <h3>👥 DONNÉES TECHNIQUES DU NR</h3>
            ${window.filteredDates && window.filteredDates.length < allClientsHourlyMatrix.dates.length ? 
                `<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 8px 12px; background: #dbeafe; border-radius: 6px; border-left: 4px solid #3b82f6;">
                    <span style="font-size: 14px;">🔍</span>
                    <span style="font-size: 12px; color: #1e40af; font-weight: 500;">
                        Filtre actif: ${window.filteredDates.length} jour${window.filteredDates.length !== 1 ? 's' : ''} sélectionné${window.filteredDates.length !== 1 ? 's' : ''} sur ${allClientsHourlyMatrix.dates.length}
                    </span>
                </div>` : ''
            }
            <div class="all-clients-stats">
                <div class="stat-item">
                    <span class="stat-icon">📅</span>
                    <span class="stat-text">${datesToUse.length} jour${datesToUse.length !== 1 ? 's' : ''}</span>
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
            <h4>
                ⚡ Énergie Maximale Totale par Jour (Somme des Max Clients)
                ${window.filteredDates && window.filteredDates.length < allClientsHourlyMatrix.dates.length ? 
                    `<span style="font-size: 12px; background: #f0f9ff; color: #0369a1; padding: 2px 8px; border-radius: 12px; margin-left: 10px;">
                        Données filtrées
                    </span>` : ''
                }
            </h4>
            <div class="chart-container all-clients-bar-chart-container">
                <canvas id="allClientsEnergyChart"></canvas>
                <div id="allClientsEnergySummary" class="kit-summary"></div>
            </div>
        </div>
        
        <!-- GRAPHIQUE TENSION : MIN/MAX PAR JOUR -->
        <div class="all-clients-chart-section">
            <h4>
                📈 Tension Min/Max par Jour (Système ${systemType})
                ${window.filteredDates && window.filteredDates.length < allClientsHourlyMatrix.dates.length ? 
                    `<span style="font-size: 12px; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; margin-left: 10px;">
                        Données filtrées
                    </span>` : ''
                }
            </h4>
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

        <!-- GRAPHIQUE PAS HORAIRE : SOMME ÉNERGIE HEURE PAR HEURE AVEC FILTRES -->
        <div class="all-clients-chart-section">
            <div class="hourly-chart-header">
                <h4>
                    ⏰ Énergie Totale par Heure (Somme Clients)
                    ${window.filteredDates && window.filteredDates.length < allClientsHourlyMatrix.dates.length ? 
                        `<span class="filter-badge">🔍 Filtre global actif</span>` : ''
                    }
                </h4>
                <div class="hourly-chart-controls">
                    <!-- Filtres rapides -->
                    <div class="quick-filters">
                        <span class="filter-label">📅 Période rapide:</span>
                        <div class="filter-buttons">
                            <button class="filter-btn-small" onclick="setHourlyChartRange('7days')">7 jours</button>
                            <button class="filter-btn-small" onclick="setHourlyChartRange('15days')">15 jours</button>
                            <button class="filter-btn-small" onclick="setHourlyChartRange('30days')">30 jours</button>
                            <button class="filter-btn-small" onclick="setHourlyChartRange('all')">Tout</button>
                        </div>
                    </div>
                    
                    <!-- Sélecteur de dates -->
                    <div class="date-range-selector">
                        <span class="filter-label">🗓️ Période spécifique:</span>
                        <div class="date-inputs">
                            <input type="date" id="hourly-start-date" class="date-input" 
                                value="${getDefaultStartDate(datesToUse)}"
                                onchange="updateHourlyChartWithCustomDates()">
                            <span style="color:#64748b; margin:0 5px;">à</span>
                            <input type="date" id="hourly-end-date" class="date-input" 
                                value="${getDefaultEndDate(datesToUse)}"
                                onchange="updateHourlyChartWithCustomDates()">
                        </div>
                    </div>
                    
                    <!-- Filtre par jour de semaine -->
                    <div class="day-filter">
                        <span class="filter-label">📆 Jours:</span>
                        <div class="day-buttons">
                            <button class="day-btn" data-day="all" onclick="toggleDayFilter('all')" style="background:#3b82f6; color:white;">Tous</button>
                            <button class="day-btn" data-day="weekday" onclick="toggleDayFilter('weekday')">Semaine</button>
                            <button class="day-btn" data-day="weekend" onclick="toggleDayFilter('weekend')">Weekend</button>
                        </div>
                    </div>
                    
                    <!-- Statistiques rapides -->
                    <div class="hourly-stats-summary">
                        <span class="stat-item">👥 ${allClientsHourlyMatrix.clients.length} clients</span>
                        <span class="stat-item">🕐 Pas: 1h</span>
                        <span id="hourly-days-count" class="stat-item">📅 ${datesToUse.length} jours</span>
                    </div>
                </div>
            </div>
            
            <!-- Conteneur du graphique -->
            <div class="chart-container all-clients-hourly-chart-container">
                <canvas id="allClientsHourlyChart"></canvas>
            </div>
            
            <!-- Légende et contrôles avancés -->
            <div class="hourly-chart-footer">
                <div class="chart-legend">
                    <div class="legend-item">
                        <span class="legend-color" style="background:#667eea;"></span>
                        <span class="legend-text">📊 Énergie Totale (Somme Clients)</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background:#f59e0b;"></span>
                        <span class="legend-text">⚡ Heures de pointe (>80% du max)</span>
                    </div>
                </div>
                
                <div class="advanced-controls">
                    <button class="btn-control" onclick="toggleClientsOnChart()" title="Afficher/masquer les clients individuels">
                        👤 Clients
                    </button>
                    <button class="btn-control" onclick="togglePeakHoursHighlight()" title="Surligner les heures de pointe">
                        ⚡ Pointe
                    </button>
                    <button class="btn-control" onclick="exportHourlyChartData()" title="Exporter les données">
                        📤 Exporter
                    </button>
                    <button class="btn-control" onclick="resetHourlyChartFilters()" title="Réinitialiser tous les filtres">
                        🔄 Réinitialiser
                    </button>
                </div>
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
                ${window.filteredDates && window.filteredDates.length < allClientsHourlyMatrix.dates.length ? 
                    `<div class="filter-info" style="margin-left: 20px; padding: 6px 12px; background: #dbeafe; border-radius: 6px; font-size: 12px; color: #1e40af;">
                        <span>🔍</span>
                        <span>Affichage des données filtrées (${window.filteredDates.length} jours)</span>
                    </div>` : ''
                }
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
                        ${window.filteredDates ? generateFilteredTableRows() : generateAllClientsTableRows(startIndex, endIndex)}
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
                        ${window.filteredDates && window.filteredDates.length < allClientsHourlyMatrix.dates.length ? 
                            `<span class="filter-info-badge" style="margin-left: 10px; padding: 2px 8px; background: #dbeafe; border-radius: 12px; font-size: 11px; color: #1e40af;">
                                🔍 Filtre actif
                            </span>` : ''
                        }
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
                    ${window.filteredDates && window.filteredDates.length < allClientsHourlyMatrix.dates.length ? 
                        `| 📅 ${window.filteredDates.length} jour${window.filteredDates.length !== 1 ? 's' : ''} filtré${window.filteredDates.length !== 1 ? 's' : ''}` : ''
                    }
                </div>
            </div>
            ` : ''}
        </div>
    `;

    // === INITIALISATION DES ÉVÉNEMENTS ===
    // Initialiser les événements du filtre (EN HAUT)
    initializeFilterEvents();
    
    // === CRÉER LES GRAPHIQUES AVEC DONNÉES FILTRÉES ===
    setTimeout(() => {
        // Calculer l'énergie max sur les dates filtrées
        let filteredMaxEnergyValue = 0;
        let filteredMaxEnergyDate = '';
        Object.entries(filteredEnergyData).forEach(([date, energy]) => {
            if (energy > filteredMaxEnergyValue) {
                filteredMaxEnergyValue = energy;
                filteredMaxEnergyDate = date;
            }
        });

        // 1. Graphique d'énergie
        createAllClientsEnergyChart(datesToUse, filteredEnergyData, filteredMaxEnergyDate);
        
        // 2. Graphique de tension
        createAllClientsTensionChart(datesToUse, filteredTensionData, systemType, systemLimits);

        // 3. Graphique de stabilité (si données disponibles)
        if (stabilityData) {
            const filteredTensionResults = window.filteredDates ? 
                tensionResults.filter(item => window.filteredDates.includes(item.date)) : 
                tensionResults;
            
            if (filteredTensionResults.length > 0) {
                createStabilityChart('stability-analysis-container', stabilityData, filteredTensionResults);
            }
        }
        // 4. Graphique horaire (pas horaire)
        const hourlyChartData = calculateHourlyEnergyData(datesToUse, 15); // 15 jours par défaut
        window.hourlyChartData = hourlyChartData;
        createAllClientsHourlyChart(hourlyChartData);

        console.log(`✅ Onglet TECHNIQUE affiché avec ${datesToUse.length} jour(s)`);
        console.log(`📊 Données filtrées: ${Object.keys(filteredEnergyData).length} jours d'énergie, ${Object.keys(filteredTensionData).length} jours de tension`);
        console.log(`⚡ Événements DP/DT: ${filteredDPDTEvents.length} événement${filteredDPDTEvents.length !== 1 ? 's' : ''} (sur ${dpdtDates.length} jour${dpdtDates.length !== 1 ? 's' : ''})`);
        
    }, 100);
}

// ======================== CALCUL DES DONNÉES HORAIRES ========================
function calculateHourlyEnergyData(dates, maxDays = null) {
    console.log('📊 Calcul des données horaires...');
    
    // Vérifier si on a des données
    if (!dates || dates.length === 0 || !allClientsHourlyMatrix || !allClientsHourlyMatrix.hours) {
        console.warn('⚠️ Pas de données disponibles pour le calcul horaire');
        return {
            hourlyData: {
                labels: [],
                datasets: [],
                totalByHour: [],
                maxTotal: 0,
                peakThreshold: 0,
                peakHours: []
            },
            datesUsed: [],
            hours: [],
            totalDays: 0,
            stats: {
                totalEnergy: 0,
                averagePerHour: 0,
                maxHourEnergy: 0,
                maxHourTime: '',
                peakHoursCount: 0,
                clientContributions: {}
            }
        };
    }
    
    // Si maxDays est spécifié et qu'on a plus de dates, limiter aux X derniers jours
    const datesToUse = maxDays && dates.length > maxDays ? 
        dates.slice(-maxDays) : 
        [...dates];
    
    console.log(`📅 Calcul sur ${datesToUse.length} jour(s) sur ${dates.length} disponible(s)`);
    
    // Obtenir toutes les heures uniques (de 00:00 à 23:00)
    const allHours = Array.from({length: 24}, (_, i) => {
        return `${i.toString().padStart(2, '0')}:00`;
    });
    
    // Initialiser la structure de données
    const hourlyData = {
        labels: [], // Format: "Date Heure" (ex: "01/01/2024 09:00")
        datasets: [], // Données par client
        totalByHour: new Array(allHours.length * datesToUse.length).fill(0), // Somme totale par créneau
        maxTotal: 0,
        peakThreshold: 0,
        peakHours: [], // Indices des heures de pointe
        clientContributions: {}, // Contribution par client
        hourStats: {} // Statistiques par heure
    };
    
    // Initialiser les contributions par client
    allClientsHourlyMatrix.clients.forEach(clientId => {
        hourlyData.clientContributions[clientId] = {
            total: 0,
            maxHour: 0,
            maxHourTime: '',
            percentage: 0
        };
    });
    
    // Initialiser les stats par heure
    allHours.forEach(hour => {
        hourlyData.hourStats[hour] = {
            total: 0,
            count: 0,
            average: 0,
            clientsActive: 0
        };
    });
    
    // Variables pour les statistiques globales
    let globalTotalEnergy = 0;
    let maxHourEnergy = 0;
    let maxHourIndex = -1;
    let maxHourDate = '';
    let maxHourTime = '';
    
    // Pour chaque date et heure, calculer la somme de tous les clients
    datesToUse.forEach((date, dateIndex) => {
        allHours.forEach((hour, hourIndex) => {
            const globalIndex = dateIndex * allHours.length + hourIndex;
            const key = `${date}_${hour}`;
            const rowData = allClientsHourlyMatrix.data[key] || {};
            
            // Calculer la somme de l'énergie de tous les clients pour cette heure
            let hourTotal = 0;
            let clientsActive = 0;
            
            allClientsHourlyMatrix.clients.forEach(clientId => {
                const clientEnergy = rowData[`client_${clientId}`];
                if (clientEnergy !== null && clientEnergy !== undefined && !isNaN(clientEnergy)) {
                    const energyValue = parseFloat(clientEnergy);
                    if (energyValue > 0) {
                        hourTotal += energyValue;
                        clientsActive++;
                        
                        // Mettre à jour les contributions par client
                        hourlyData.clientContributions[clientId].total += energyValue;
                        
                        // Trouver l'heure max pour ce client
                        if (energyValue > hourlyData.clientContributions[clientId].maxHour) {
                            hourlyData.clientContributions[clientId].maxHour = energyValue;
                            hourlyData.clientContributions[clientId].maxHourTime = `${date} ${hour}`;
                        }
                    }
                }
            });
            
            // Mettre à jour le total par heure
            hourlyData.totalByHour[globalIndex] = hourTotal;
            globalTotalEnergy += hourTotal;
            
            // Mettre à jour le maximum global
            if (hourTotal > hourlyData.maxTotal) {
                hourlyData.maxTotal = hourTotal;
            }
            
            // Trouver l'heure avec le maximum d'énergie
            if (hourTotal > maxHourEnergy) {
                maxHourEnergy = hourTotal;
                maxHourIndex = globalIndex;
                maxHourDate = date;
                maxHourTime = hour;
            }
            
            // Mettre à jour les statistiques par heure
            hourlyData.hourStats[hour].total += hourTotal;
            hourlyData.hourStats[hour].count++;
            hourlyData.hourStats[hour].clientsActive += clientsActive;
            
            // Créer le label
            if (hourIndex === 0) {
                // À minuit, afficher la date complète
                hourlyData.labels.push(`${date} ${hour}`);
            } else if (hour === '12:00') {
                // À midi, afficher juste "12:00" avec un indicateur
                hourlyData.labels.push(`🕛 ${hour}`);
            } else {
                // Autres heures, juste l'heure
                hourlyData.labels.push(hour);
            }
        });
    });
    
    // Calculer le seuil de pointe (80% du maximum)
    hourlyData.peakThreshold = hourlyData.maxTotal * 0.8;
    
    // Identifier les heures de pointe
    hourlyData.totalByHour.forEach((energy, index) => {
        if (energy >= hourlyData.peakThreshold) {
            hourlyData.peakHours.push(index);
        }
    });
    
    // Calculer les moyennes par heure
    allHours.forEach(hour => {
        if (hourlyData.hourStats[hour].count > 0) {
            hourlyData.hourStats[hour].average = hourlyData.hourStats[hour].total / hourlyData.hourStats[hour].count;
            hourlyData.hourStats[hour].clientsActive = Math.round(hourlyData.hourStats[hour].clientsActive / datesToUse.length);
        }
    });
    
    // Calculer les pourcentages de contribution par client
    allClientsHourlyMatrix.clients.forEach(clientId => {
        if (globalTotalEnergy > 0) {
            hourlyData.clientContributions[clientId].percentage = 
                (hourlyData.clientContributions[clientId].total / globalTotalEnergy) * 100;
        }
    });
    
    // Créer les datasets par client (pour l'affichage individuel)
    const clientColors = {};
    allClientsHourlyMatrix.clients.forEach((clientId, index) => {
        const clientLabel = `Client ${clientId.padStart(2, '0')}`;
        const clientColor = getClientColor(clientId);
        clientColors[clientId] = clientColor;
        
        const clientData = [];
        
        datesToUse.forEach(date => {
            allHours.forEach(hour => {
                const key = `${date}_${hour}`;
                const rowData = allClientsHourlyMatrix.data[key] || {};
                const energy = rowData[`client_${clientId}`];
                clientData.push(energy !== null && energy !== undefined ? parseFloat(energy) : 0);
            });
        });
        
        hourlyData.datasets.push({
            label: clientLabel,
            data: clientData,
            backgroundColor: clientColor + '20', // 20 = 12% d'opacité
            borderColor: clientColor,
            borderWidth: 1.5,
            hidden: true, // Caché par défaut, on affiche seulement la somme
            stack: 'stack',
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.2,
            fill: false
        });
    });
    
    // Dataset pour la somme totale (affiché par défaut)
    hourlyData.datasets.unshift({
        label: '📊 Énergie Totale (Somme Clients)',
        data: hourlyData.totalByHour,
        backgroundColor: 'rgba(102, 126, 234, 0.15)',
        borderColor: '#667eea',
        borderWidth: 2.5,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointBackgroundColor: hourlyData.totalByHour.map((value, index) => {
            // Colorer les points selon s'ils sont en pointe
            return hourlyData.peakHours.includes(index) ? '#f59e0b' : '#667eea';
        }),
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#764ba2',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2
    });
    
    // Dataset pour les heures de pointe (surlignage)
    const peakHourData = hourlyData.totalByHour.map((value, index) => {
        return hourlyData.peakHours.includes(index) ? value : null;
    });
    
    hourlyData.datasets.push({
        label: '⚡ Heures de pointe (>80% du max)',
        data: peakHourData,
        backgroundColor: 'rgba(245, 158, 11, 0.25)',
        borderColor: 'transparent',
        borderWidth: 0,
        fill: true,
        pointRadius: 0,
        tension: 0,
        hidden: !window.hourlyChartFilters?.highlightPeak ?? true // Suivre le paramètre global
    });
    
    // Calculer les statistiques finales
    const stats = {
        totalEnergy: globalTotalEnergy,
        averagePerHour: datesToUse.length > 0 ? globalTotalEnergy / (datesToUse.length * 24) : 0,
        maxHourEnergy: maxHourEnergy,
        maxHourTime: maxHourTime,
        maxHourDate: maxHourDate,
        peakHoursCount: hourlyData.peakHours.length,
        peakHoursPercentage: hourlyData.totalByHour.length > 0 ? 
            (hourlyData.peakHours.length / hourlyData.totalByHour.length * 100).toFixed(1) : 0,
        totalHours: datesToUse.length * 24,
        clientContributions: hourlyData.clientContributions,
        hourStats: hourlyData.hourStats,
        // Top 3 des heures les plus chargées en moyenne
        topHours: Object.entries(hourlyData.hourStats)
            .sort(([, a], [, b]) => b.average - a.average)
            .slice(0, 3)
            .map(([hour, data]) => ({
                hour: hour,
                average: data.average,
                clientsActive: data.clientsActive
            })),
        // Client dominant
        dominantClient: allClientsHourlyMatrix.clients.reduce((dominant, clientId) => {
            const currentContrib = hourlyData.clientContributions[clientId];
            if (!dominant || currentContrib.percentage > dominant.percentage) {
                return {
                    clientId: clientId,
                    percentage: currentContrib.percentage,
                    total: currentContrib.total
                };
            }
            return dominant;
        }, null)
    };
    
    console.log(`✅ Données horaires calculées:`, {
        jours: datesToUse.length,
        heures: hourlyData.totalByHour.length,
        énergieTotale: `${globalTotalEnergy.toFixed(0)} Wh`,
        énergieMaxHeure: `${maxHourEnergy.toFixed(1)} Wh (${maxHourDate} ${maxHourTime})`,
        heuresPointe: `${hourlyData.peakHours.length} (${stats.peakHoursPercentage}%)`,
        clientDominant: stats.dominantClient ? 
            `Client ${stats.dominantClient.clientId} (${stats.dominantClient.percentage.toFixed(1)}%)` : 'Aucun'
    });
    
    return {
        hourlyData: hourlyData,
        datesUsed: datesToUse,
        hours: allHours,
        totalDays: datesToUse.length,
        stats: stats,
        clientColors: clientColors
    };
}

// Fonction utilitaire pour générer une couleur par client (version améliorée)
function getClientColor(clientId) {
    // Palette de couleurs distinctes
    const colorPalettes = {
        primary: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'],
        secondary: ['#43e97b', '#38f9d7', '#fa709a', '#fee140', '#a8edea', '#fed6e3'],
        tertiary: ['#96fbc4', '#f9d423', '#ff5858', '#ff9a9e', '#a8edea', '#d299c2']
    };
    
    // Convertir l'ID client en nombre
    const clientNum = parseInt(clientId, 16) || parseInt(clientId) || 0;
    
    // Choisir une palette selon le numéro du client
    const paletteIndex = clientNum % 3;
    const paletteName = ['primary', 'secondary', 'tertiary'][paletteIndex];
    const palette = colorPalettes[paletteName];
    
    // Choisir une couleur dans la palette
    const colorIndex = clientNum % palette.length;
    
    return palette[colorIndex];
}

// Fonction utilitaire pour générer une couleur par client
function getClientColor(clientId) {
    const colors = [
        '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe',
        '#43e97b', '#38f9d7', '#fa709a', '#fee140', '#a8edea', '#fed6e3',
        '#a8edea', '#d299c2', '#f6d365', '#fda085', '#96fbc4', '#f9d423'
    ];
    const index = parseInt(clientId, 16) % colors.length;
    return colors[index];
}

// Fonction pour basculer entre 15 jours et toutes les données
function toggleHourlyChartRange() {
    const chartCanvas = document.getElementById('allClientsHourlyChart');
    if (!chartCanvas || !window.hourlyChartData) return;
    
    const currentDays = window.hourlyChartData.totalDays;
    const allDates = window.filteredDates || allClientsHourlyMatrix.dates;
    
    let newMaxDays = 15;
    if (currentDays <= 15 && allDates.length > 15) {
        newMaxDays = allDates.length; // Afficher tout
    } else if (currentDays > 15) {
        newMaxDays = 15; // Revenir à 15 jours
    }
    
    // Recalculer avec la nouvelle période
    const newHourlyData = calculateHourlyEnergyData(allDates, newMaxDays);
    window.hourlyChartData = newHourlyData;
    
    // Mettre à jour le graphique
    createAllClientsHourlyChart(newHourlyData);
    
    // Mettre à jour le bouton
    const button = document.querySelector('.system-info button');
    if (button) {
        if (newMaxDays <= 15) {
            button.textContent = '🔁 Voir tout';
            document.querySelector('.system-info span:first-child').textContent = `📊 Affichage: ${newMaxDays} jours`;
        } else {
            button.textContent = '🔁 Voir 15 jours';
            document.querySelector('.system-info span:first-child').textContent = `📊 Affichage: ${newMaxDays} jours (complet)`;
        }
    }
}
// ======================== FONCTIONS UTILITAIRES POUR LES FILTRES ========================

// Fonctions pour les dates par défaut
function getDefaultStartDate(dates) {
    if (!dates || dates.length === 0) return '';
    
    // Par défaut, 15 derniers jours
    const defaultDays = Math.min(15, dates.length);
    const startDate = dates[dates.length - defaultDays];
    
    // Convertir "DD/MM/YYYY" en "YYYY-MM-DD"
    const [day, month, year] = startDate.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function getDefaultEndDate(dates) {
    if (!dates || dates.length === 0) return '';
    
    // Dernière date disponible
    const lastDate = dates[dates.length - 1];
    const [day, month, year] = lastDate.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// Fonction pour convertir une date "YYYY-MM-DD" en "DD/MM/YYYY"
function formatDateToFrench(dateString) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

// Fonction pour obtenir le jour de la semaine (0=dimanche, 1=lundi, ...)
function getDayOfWeek(dateStr) {
    const [day, month, year] = dateStr.split('/');
    const date = new Date(year, month - 1, day);
    return date.getDay(); // 0=dimanche, 6=samedi
}

// Vérifier si c'est un jour de week-end
function isWeekend(dateStr) {
    const day = getDayOfWeek(dateStr);
    return day === 0 || day === 6; // Dimanche ou samedi
}
// ======================== FONCTIONS DE FILTRAGE POUR LE GRAPHIQUE HORAIRE ========================

// Variables globales pour les filtres
window.hourlyChartFilters = {
    dateRange: '15days', // '7days', '15days', '30days', 'all', 'custom'
    startDate: null,
    endDate: null,
    dayFilter: 'all', // 'all', 'weekday', 'weekend'
    showClients: false,
    highlightPeak: true
};

// Définir la période rapide
function setHourlyChartRange(rangeType) {
    const allDates = window.filteredDates || allClientsHourlyMatrix.dates;
    if (!allDates || allDates.length === 0) return;
    
    window.hourlyChartFilters.dateRange = rangeType;
    
    let filteredDates = [];
    const today = allDates[allDates.length - 1];
    
    switch(rangeType) {
        case '7days':
            filteredDates = allDates.slice(-7);
            break;
        case '15days':
            filteredDates = allDates.slice(-15);
            break;
        case '30days':
            filteredDates = allDates.slice(-30);
            break;
        case 'all':
            filteredDates = [...allDates];
            break;
        case 'custom':
            // Garder les dates actuelles
            filteredDates = getFilteredDatesByCustomRange();
            break;
    }
    
    // Appliquer le filtre de jour si actif
    if (window.hourlyChartFilters.dayFilter !== 'all') {
        filteredDates = filterDatesByDayType(filteredDates);
    }
    
    // Mettre à jour les champs de date
    if (rangeType !== 'custom' && filteredDates.length > 0) {
        document.getElementById('hourly-start-date').value = getDefaultStartDate(filteredDates);
        document.getElementById('hourly-end-date').value = getDefaultEndDate(filteredDates);
    }
    
    // Recalculer et mettre à jour le graphique
    updateHourlyChartWithFilters(filteredDates);
    
    // Mettre à jour le bouton actif
    updateActiveRangeButton(rangeType);
    
    // Mettre à jour le compteur de jours
    updateDaysCount(filteredDates.length);
}

// Filtrer par jour de semaine/week-end
function toggleDayFilter(dayType) {
    window.hourlyChartFilters.dayFilter = dayType;
    
    // Mettre à jour l'apparence des boutons
    document.querySelectorAll('.day-btn').forEach(btn => {
        if (btn.dataset.day === dayType) {
            btn.style.background = '#3b82f6';
            btn.style.color = 'white';
        } else {
            btn.style.background = '#f1f5f9';
            btn.style.color = '#64748b';
        }
    });
    
    // Recalculer les dates filtrées
    const allDates = window.filteredDates || allClientsHourlyMatrix.dates;
    let filteredDates = getFilteredDatesByCurrentRange(allDates);
    
    if (dayType !== 'all') {
        filteredDates = filterDatesByDayType(filteredDates);
    }
    
    updateHourlyChartWithFilters(filteredDates);
    updateDaysCount(filteredDates.length);
}

// Filtrer les dates par type de jour
function filterDatesByDayType(dates) {
    const dayType = window.hourlyChartFilters.dayFilter;
    
    return dates.filter(date => {
        const isWeekendDay = isWeekend(date);
        
        if (dayType === 'weekday') {
            return !isWeekendDay;
        } else if (dayType === 'weekend') {
            return isWeekendDay;
        }
        
        return true;
    });
}

// Obtenir les dates filtrées selon la plage actuelle
function getFilteredDatesByCurrentRange(allDates) {
    const rangeType = window.hourlyChartFilters.dateRange;
    
    switch(rangeType) {
        case '7days':
            return allDates.slice(-7);
        case '15days':
            return allDates.slice(-15);
        case '30days':
            return allDates.slice(-30);
        case 'all':
            return [...allDates];
        case 'custom':
            return getFilteredDatesByCustomRange();
        default:
            return allDates.slice(-15);
    }
}

// Filtrer par plage de dates personnalisée
function getFilteredDatesByCustomRange() {
    const startInput = document.getElementById('hourly-start-date').value;
    const endInput = document.getElementById('hourly-end-date').value;
    
    if (!startInput || !endInput) {
        const allDates = window.filteredDates || allClientsHourlyMatrix.dates;
        return allDates.slice(-15); // Fallback à 15 jours
    }
    
    const startDate = formatDateToFrench(startInput);
    const endDate = formatDateToFrench(endInput);
    const allDates = window.filteredDates || allClientsHourlyMatrix.dates;
    
    return allDates.filter(date => {
        const dateObj = new Date(date.split('/').reverse().join('-'));
        const startObj = new Date(startInput);
        const endObj = new Date(endInput);
        
        return dateObj >= startObj && dateObj <= endObj;
    });
}

// Mettre à jour avec dates personnalisées
function updateHourlyChartWithCustomDates() {
    window.hourlyChartFilters.dateRange = 'custom';
    updateActiveRangeButton('custom');
    
    const filteredDates = getFilteredDatesByCustomRange();
    
    // Appliquer le filtre de jour si actif
    if (window.hourlyChartFilters.dayFilter !== 'all') {
        filteredDates = filterDatesByDayType(filteredDates);
    }
    
    updateHourlyChartWithFilters(filteredDates);
    updateDaysCount(filteredDates.length);
}

// Mettre à jour le graphique avec les dates filtrées
function updateHourlyChartWithFilters(filteredDates) {
    if (!filteredDates || filteredDates.length === 0) {
        console.warn('⚠️ Aucune date à afficher');
        return;
    }
    
    // Recalculer les données horaires
    const hourlyChartData = calculateHourlyEnergyData(filteredDates, filteredDates.length); // Toutes les dates filtrées
    
    // Sauvegarder les données
    window.hourlyChartData = hourlyChartData;
    
    // Mettre à jour le graphique
    createAllClientsHourlyChart(hourlyChartData);
    
    console.log(`✅ Graphique horaire mis à jour: ${filteredDates.length} jours`);
}

// Mettre à jour le bouton actif
function updateActiveRangeButton(activeRange) {
    // Réinitialiser tous les boutons
    document.querySelectorAll('.filter-btn-small').forEach(btn => {
        btn.style.background = '#f1f5f9';
        btn.style.color = '#64748b';
        btn.style.fontWeight = 'normal';
    });
    
    // Activer le bouton sélectionné
    const activeBtn = Array.from(document.querySelectorAll('.filter-btn-small'))
        .find(btn => btn.textContent.includes(activeRange.replace('days', '').replace('all', 'Tout')));
    
    if (activeBtn) {
        activeBtn.style.background = '#3b82f6';
        activeBtn.style.color = 'white';
        activeBtn.style.fontWeight = 'bold';
    }
}

// Mettre à jour le compteur de jours
function updateDaysCount(count) {
    const daysCountElement = document.getElementById('hourly-days-count');
    if (daysCountElement) {
        daysCountElement.textContent = `📅 ${count} jour${count !== 1 ? 's' : ''}`;
    }
}

// Afficher/masquer les clients individuels
function toggleClientsOnChart() {
    window.hourlyChartFilters.showClients = !window.hourlyChartFilters.showClients;
    
    if (!window.allClientsHourlyChartInstance) return;
    
    const chart = window.allClientsHourlyChartInstance;
    
    // Montrer/masquer les datasets des clients (à partir de l'index 1)
    for (let i = 1; i < chart.data.datasets.length; i++) {
        const meta = chart.getDatasetMeta(i);
        meta.hidden = !window.hourlyChartFilters.showClients;
    }
    
    chart.update();
    
    // Mettre à jour le bouton
    const btn = document.querySelector('.btn-control[title*="Clients"]');
    if (btn) {
        btn.style.background = window.hourlyChartFilters.showClients ? '#10b981' : '#3b82f6';
        btn.innerHTML = window.hourlyChartFilters.showClients ? '👤 <small>Clients ON</small>' : '👤 Clients';
    }
}

// Surligner les heures de pointe
function togglePeakHoursHighlight() {
    window.hourlyChartFilters.highlightPeak = !window.hourlyChartFilters.highlightPeak;
    
    if (!window.allClientsHourlyChartInstance || !window.hourlyChartData) return;
    
    const chart = window.allClientsHourlyChartInstance;
    const { hourlyData } = window.hourlyChartData;
    
    if (window.hourlyChartFilters.highlightPeak) {
        // Ajouter un dataset pour les heures de pointe
        const peakThreshold = hourlyData.maxTotal * 0.8; // 80% du maximum
        
        const peakData = hourlyData.totalByHour.map(value => 
            value >= peakThreshold ? value : null
        );
        
        // Vérifier si le dataset de pointe existe déjà
        let peakDatasetIndex = -1;
        chart.data.datasets.forEach((dataset, index) => {
            if (dataset.label && dataset.label.includes('Heures de pointe')) {
                peakDatasetIndex = index;
            }
        });
        
        if (peakDatasetIndex === -1) {
            // Ajouter le dataset de pointe
            chart.data.datasets.push({
                label: '⚡ Heures de pointe (>80% du max)',
                data: peakData,
                backgroundColor: 'rgba(245, 158, 11, 0.3)',
                borderColor: '#f59e0b',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0
            });
        }
    } else {
        // Retirer le dataset de pointe
        chart.data.datasets = chart.data.datasets.filter(dataset => 
            !dataset.label.includes('Heures de pointe')
        );
    }
    
    chart.update();
    
    // Mettre à jour le bouton
    const btn = document.querySelector('.btn-control[title*="Pointe"]');
    if (btn) {
        btn.style.background = window.hourlyChartFilters.highlightPeak ? '#f59e0b' : '#3b82f6';
        btn.innerHTML = window.hourlyChartFilters.highlightPeak ? '⚡ <small>Pointe ON</small>' : '⚡ Pointe';
    }
}

// Exporter les données
function exportHourlyChartData() {
    if (!window.hourlyChartData) return;
    
    const { hourlyData, datesUsed, hours } = window.hourlyChartData;
    
    // Créer un tableau CSV
    let csv = 'Date,Heure,Énergie Totale (Wh),Nombre Clients\n';
    
    datesUsed.forEach((date, dateIndex) => {
        hours.forEach((hour, hourIndex) => {
            const index = dateIndex * hours.length + hourIndex;
            const totalEnergy = hourlyData.totalByHour[index];
            
            // Compter les clients avec consommation > 0
            let clientCount = 0;
            for (let i = 1; i < hourlyData.datasets.length; i++) {
                const clientValue = hourlyData.datasets[i].data[index];
                if (clientValue > 0) clientCount++;
            }
            
            csv += `${date},${hour},${totalEnergy.toFixed(2)},${clientCount}\n`;
        });
    });
    
    // Créer et télécharger le fichier
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `energie_horaire_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('📤 Données horaires exportées');
}

// Réinitialiser tous les filtres
function resetHourlyChartFilters() {
    window.hourlyChartFilters = {
        dateRange: '15days',
        startDate: null,
        endDate: null,
        dayFilter: 'all',
        showClients: false,
        highlightPeak: true
    };
    
    // Réinitialiser les boutons
    updateActiveRangeButton('15days');
    toggleDayFilter('all');
    
    // Réinitialiser les dates
    const allDates = window.filteredDates || allClientsHourlyMatrix.dates;
    document.getElementById('hourly-start-date').value = getDefaultStartDate(allDates);
    document.getElementById('hourly-end-date').value = getDefaultEndDate(allDates);
    
    // Mettre à jour le graphique
    setHourlyChartRange('15days');
}
// ======================== CRÉATION GRAPHIQUE HORAIRE ========================
function createAllClientsHourlyChart(hourlyChartData) {
    const chartCanvas = document.getElementById('allClientsHourlyChart');
    if (!chartCanvas || !hourlyChartData) return;

    // Détruire le graphique existant s'il existe
    if (window.allClientsHourlyChartInstance) {
        window.allClientsHourlyChartInstance.destroy();
    }

    const { hourlyData, datesUsed, hours, totalDays } = hourlyChartData;
    
    // Déterminer le pas d'affichage des labels X
    const labelStep = Math.max(1, Math.floor(hourlyData.labels.length / 20));
    
    const ctx = chartCanvas.getContext('2d');
    window.allClientsHourlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hourlyData.labels.map((label, index) => 
                (index % labelStep === 0 || index === hourlyData.labels.length - 1) ? label : ''
            ),
            datasets: hourlyData.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            animation: {
                duration: 800,
                easing: 'easeInOutQuart'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Énergie Totale (Wh)',
                        font: {
                            size: 13,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 10
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#718096',
                        callback: function(value) {
                            return value.toLocaleString('fr-FR');
                        }
                    },
                    grid: {
                        color: 'rgba(113, 128, 150, 0.08)',
                        lineWidth: 1
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 10
                        },
                        color: '#718096',
                        maxRotation: 45,
                        minRotation: 0,
                        callback: function(value, index) {
                            // Afficher seulement les labels non vides
                            return hourlyData.labels[index] || '';
                        }
                    },
                    grid: {
                        color: 'rgba(113, 128, 150, 0.05)',
                        lineWidth: 1
                    },
                    title: {
                        display: true,
                        text: totalDays <= 15 ? 
                            `Heures (${totalDays} jours complets)` : 
                            `Heures (${totalDays} jours - période complète)`,
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 10
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        color: '#2c3e50',
                        padding: 15,
                        usePointStyle: true,
                        filter: function(item, chart) {
                            // Par défaut, on n'affiche que la somme totale
                            return item.text.includes('Totale') || item.hidden === false;
                        }
                    },
                    onClick: function(e, legendItem, legend) {
                        // Permettre de montrer/cacher les clients individuels
                        const index = legendItem.datasetIndex;
                        const chart = legend.chart;
                        const meta = chart.getDatasetMeta(index);
                        
                        if (index === 0) {
                            // Ne pas permettre de cacher la somme totale
                            return;
                        }
                        
                        meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                        chart.update();
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(45, 55, 72, 0.95)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        weight: 'bold',
                        color: '#fff'
                    },
                    bodyFont: {
                        size: 12,
                        color: '#e2e8f0'
                    },
                    cornerRadius: 6,
                    displayColors: true,
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            const dateIndex = Math.floor(index / hours.length);
                            const hourIndex = index % hours.length;
                            
                            const date = datesUsed[dateIndex];
                            const hour = hours[hourIndex];
                            return `📅 ${date} - ${hour}`;
                        },
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y.toLocaleString('fr-FR');
                            
                            if (label.includes('Totale')) {
                                // Pour la somme totale, montrer aussi la répartition
                                let tooltipText = `${label}: ${value} Wh`;
                                
                                // Ajouter la répartition par client (optionnel)
                                const index = context.dataIndex;
                                let clientDetails = '';
                                let clientCount = 0;
                                
                                // Compter combien de clients ont contribué
                                for (let i = 1; i < hourlyData.datasets.length; i++) {
                                    const clientValue = hourlyData.datasets[i].data[index];
                                    if (clientValue > 0) {
                                        clientCount++;
                                    }
                                }
                                
                                if (clientCount > 0) {
                                    tooltipText += ` (${clientCount} client${clientCount > 1 ? 's' : ''})`;
                                }
                                
                                return tooltipText;
                            }
                            
                            return `${label}: ${value} Wh`;
                        },
                        afterLabel: function(context) {
                            // Optionnel: ajouter des infos supplémentaires
                            if (context.datasetIndex === 0) {
                                const index = context.dataIndex;
                                let maxClient = '';
                                let maxValue = 0;
                                
                                // Trouver le client avec la plus grande contribution
                                for (let i = 1; i < hourlyData.datasets.length; i++) {
                                    const clientValue = hourlyData.datasets[i].data[index];
                                    if (clientValue > maxValue) {
                                        maxValue = clientValue;
                                        maxClient = hourlyData.datasets[i].label;
                                    }
                                }
                                
                                if (maxValue > 0) {
                                    return `👤 Plus gros contributeur: ${maxClient} (${maxValue.toFixed(1)} Wh)`;
                                }
                            }
                            return null;
                        }
                    }
                }
            }
        }
    });
}

function initializeFilterEvents() {
    console.log('🔧 Initialisation des événements du filtre global');
    
    // Appliquer le filtre
    const applyBtn = document.getElementById('apply-filter-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            applyGlobalDateFilter();
            updateFilterIndicator();
        });
    }
    
    // Réinitialiser tous les filtres
    const resetBtn = document.getElementById('reset-all-filters-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAllFilters);
    }
    
    // Sélectionner/désélectionner toutes les dates
    const selectAllBtn = document.getElementById('select-all-dates');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            document.querySelectorAll('.date-checkbox').forEach(cb => {
                cb.checked = true;
                cb.parentElement.classList.add('checked');
            });
            updateSelectedCount();
        });
    }
    
    const deselectAllBtn = document.getElementById('deselect-all-dates');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', function() {
            document.querySelectorAll('.date-checkbox').forEach(cb => {
                cb.checked = false;
                cb.parentElement.classList.remove('checked');
            });
            updateSelectedCount();
        });
    }
    
    // Mettre à jour les cases à cocher quand les autres filtres changent
    const dateInputs = document.querySelectorAll('.filter-date-input, .filter-select');
    dateInputs.forEach(input => {
        input.addEventListener('change', updateDateCheckboxesFromFilters);
    });
    
    // Mettre à jour le style des cases quand elles changent
    document.querySelectorAll('.date-checkbox').forEach(cb => {
        cb.addEventListener('change', function() {
            if (this.checked) {
                this.parentElement.classList.add('checked');
            } else {
                this.parentElement.classList.remove('checked');
            }
            updateSelectedCount();
        });
    });
}

function updateSelectedCount() {
    const selectedCount = document.querySelectorAll('.date-checkbox:checked').length;
    const totalCount = document.querySelectorAll('.date-checkbox').length;
    const countSpan = document.getElementById('selected-dates-count');
    if (countSpan) {
        countSpan.textContent = selectedCount;
        
        // Changer la couleur de l'indicateur
        const indicator = document.getElementById('filter-indicator');
        if (indicator) {
            if (selectedCount === totalCount) {
                indicator.className = 'filter-indicator';
            } else if (selectedCount <= 5) {
                indicator.className = 'filter-indicator warning';
            } else {
                indicator.className = 'filter-indicator filtered';
            }
        }
    }
}

function updateDateCheckboxesFromFilters() {
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    const year = document.getElementById('filter-year').value;
    const month = document.getElementById('filter-month').value;
    
    document.querySelectorAll('.date-checkbox').forEach(cb => {
        const dateStr = cb.value;
        const [day, monthStr, yearStr] = dateStr.split('/');
        const dateObj = new Date(`${yearStr}-${monthStr.padStart(2, '0')}-${day.padStart(2, '0')}`);
        
        let shouldBeChecked = true;
        
        // Filtre par période
        if (startDate) {
            const startDateObj = new Date(startDate);
            if (dateObj < startDateObj) shouldBeChecked = false;
        }
        
        if (endDate) {
            const endDateObj = new Date(endDate);
            if (dateObj > endDateObj) shouldBeChecked = false;
        }
        
        // Filtre par année
        if (year !== 'all' && parseInt(yearStr) !== parseInt(year)) {
            shouldBeChecked = false;
        }
        
        // Filtre par mois
        if (month !== 'all' && parseInt(monthStr) !== parseInt(month)) {
            shouldBeChecked = false;
        }
        
        cb.checked = shouldBeChecked;
    });
    
    updateSelectedCount();
}
// NOUVELLE FONCTION : Générer les lignes du tableau tous clients
function generateAllClientsTableRows(startIndex, endIndex) {
    let rows = '';
    let rowIndex = 0;
    const dates = window.filteredDates || allClientsHourlyMatrix.dates;

    // Parcourir toutes les combinaisons date/heure
    for (let i = 0; i < dates.length; i++) {
        const date = dates[i];

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
        (window.filteredDates || allClientsHourlyMatrix.dates).length * allClientsHourlyMatrix.hours.length :
        itemsPerPg;
    window.allClientsCurrentPage = 1;
    displayAllClientsTab();
};

window.changeAllClientsMatrixPage = function (page) {
    const totalDates = window.filteredDates || allClientsHourlyMatrix.dates;
    const totalItems = totalDates.length * allClientsHourlyMatrix.hours.length;
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
        if (tension < 22 || tension > 31) return '#e53e3e';
        if (tension < 24 || tension > 29) return '#d69e2e';
        return '#38a169';
    } else {
        if (tension < 11 || tension > 15) return '#e53e3e';
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
            /* STYLE POUR FILTRE EN HAUT */
            .global-filter-container {
                margin-bottom: 25px;
                background: white;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                border: 1px solid #e2e8f0;
                transition: all 0.3s ease;
            }
            
            /* Animation pour indiquer le filtrage */
            .global-filter-container.filter-active {
                border: 2px solid #3b82f6;
                box-shadow: 0 4px 20px rgba(59, 130, 246, 0.2);
                background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);
            }
            
            .global-filter-container .filter-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                flex-wrap: wrap;
                gap: 15px;
            }
            
            .global-filter-container .filter-title {
                display: flex;
                align-items: center;
                gap: 12px;
                font-weight: 700;
                color: #2c3e50;
                font-size: 18px;
            }
            
            .global-filter-container .filter-title-icon {
                font-size: 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .global-filter-container .filter-actions {
                display: flex;
                gap: 10px;
                align-items: center;
            }
            
            /* Boutons spécifiques pour le filtre */
            .filter-btn {
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .filter-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            
            .filter-btn:active {
                transform: translateY(0);
            }
            
            .filter-btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .filter-btn-secondary {
                background: #f1f5f9;
                color: #64748b;
                border: 1px solid #cbd5e1;
            }
            
            .filter-btn-danger {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                color: white;
            }
            
            /* Groupes de filtres */
            .filter-group {
                background: #f8fafc;
                border-radius: 10px;
                padding: 18px;
                border: 1px solid #e2e8f0;
                margin-bottom: 20px;
                transition: all 0.3s ease;
            }
            
            .filter-group:hover {
                border-color: #cbd5e1;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            
            .filter-group-title {
                font-weight: 600;
                color: #475569;
                margin-bottom: 14px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 10px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            /* Sections de dates */
            .date-selection-section {
                max-height: 180px;
                overflow-y: auto;
                background: white;
                border-radius: 8px;
                padding: 16px;
                border: 1px solid #e2e8f0;
                margin-bottom: 15px;
            }
            
            .date-selection-actions {
                display: flex;
                gap: 10px;
                margin-bottom: 15px;
                padding-bottom: 15px;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .date-select-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                flex: 1;
                text-align: center;
            }
            
            .date-select-btn:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }
            
            .date-select-btn-primary {
                background: #dbeafe;
                color: #1e40af;
            }
            
            .date-select-btn-secondary {
                background: #f1f5f9;
                color: #64748b;
            }
            
            /* Cases à cocher */
            .date-checkbox-container {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                gap: 10px;
            }
            
            .date-checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                background: white;
                border-radius: 6px;
                border: 2px solid #e2e8f0;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 13px;
            }
            
            .date-checkbox-label:hover {
                border-color: #cbd5e1;
                background: #f8fafc;
                transform: translateY(-1px);
            }
            
            .date-checkbox-label.checked {
                border-color: #3b82f6;
                background: #dbeafe;
                font-weight: 600;
                color: #1e40af;
            }
            
            .date-checkbox-label input[type="checkbox"] {
                cursor: pointer;
                accent-color: #3b82f6;
                width: 16px;
                height: 16px;
            }
            
            /* Indicateur de filtrage */
            .filter-indicator {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 16px;
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                border-radius: 10px;
                border: 2px solid #bae6fd;
                margin-top: 20px;
                transition: all 0.3s ease;
            }
            
            .filter-indicator.filtered {
                background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
                border-color: #86efac;
            }
            
            .filter-indicator.warning {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border-color: #fcd34d;
            }
            
            .filter-indicator-icon {
                font-size: 24px;
            }
            
            .filter-indicator-info {
                flex: 1;
            }
            
            .filter-indicator-title {
                font-weight: 700;
                color: #0369a1;
                font-size: 14px;
                margin-bottom: 4px;
            }
            
            .filter-indicator-description {
                font-size: 12px;
                color: #0c4a6e;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .global-filter-container {
                    padding: 15px;
                }
                
                .filter-group {
                    padding: 15px;
                }
                
                .filter-header {
                    flex-direction: column;
                    align-items: flex-start !important;
                }
                
                .filter-actions {
                    width: 100%;
                    justify-content: space-between;
                }
                
                .date-checkbox-container {
                    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
                }
                
                .date-selection-section {
                    max-height: 150px;
                }
            }
            
            @media (max-width: 576px) {
                .date-checkbox-container {
                    grid-template-columns: 1fr;
                }
                
                .filter-btn {
                    padding: 10px 15px;
                    font-size: 12px;
                }
                
                .filter-indicator {
                    flex-direction: column;
                    text-align: center;
                    gap: 8px;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// NOUVELLE FONCTION : Afficher l'analyse ENR avec les 3 types
async function displayENRAnalysis() {
    const contentElement = document.getElementById('sub-content-ENR');
    if (!contentElement) return;

    showLoader();

    try {
        // Vérifier si nous avons des fichiers
        const hasEnrFiles = window.enrFiles && window.enrFiles.length > 0;
        const hasEcFiles = window.ecFiles && window.ecFiles.length > 0;
        const hasRechargeFiles = window.rechargeFiles && window.rechargeFiles.length > 0;
        
        if (!hasEnrFiles && !hasEcFiles && !hasRechargeFiles) {
            contentElement.innerHTML = `
                <div class="no-data">
                    <div class="no-data-content">
                        <span class="no-data-icon">📊</span>
                        <span class="no-data-text">Aucun fichier ENR/EC/RECHARGE trouvé dans ce dossier</span>
                    </div>
                </div>
            `;
            hideLoader();
            return;
        }

        console.log(`🔍 Analyse de l'onglet ÉVÈNEMENT: 
          ${hasEnrFiles ? window.enrFiles.length + ' ENR' : '0 ENR'},
          ${hasEcFiles ? window.ecFiles.length + ' EC' : '0 EC'},
          ${hasRechargeFiles ? window.rechargeFiles.length + ' RECHARGE' : '0 RECHARGE'}`);

        // Créer le contenu HTML avec sections séparées
        let enrAnalysisHTML = '<div class="enr-analysis-multi-container">';
        enrAnalysisHTML += '<h3>📈 Analyse des Évènements NR</h3>';
        
        // ============ SECTION TABLEAU COMBINÉ ============
        if (hasEnrFiles || hasEcFiles) {
            enrAnalysisHTML += `
                <div class="file-type-section">
                    <h4 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        📊 Évènements Combinés (ENR + EC)
                    </h4>
            `;
            
            // Analyser les événements combinés
            try {
                const combinedAnalysis = analyzeCombinedEvents(
                    hasEnrFiles ? window.enrFiles : [],
                    hasEcFiles ? window.ecFiles : []
                );
                
                // Ajouter le tableau combiné
                enrAnalysisHTML += createCombinedDailyTable(combinedAnalysis);
                
            } catch (error) {
                console.error('❌ Erreur analyse combinée:', error);
                enrAnalysisHTML += `
                    <div class="error-message">
                        <span class="error-icon">❌</span>
                        <span class="error-text">Erreur lors de l'analyse combinée: ${error.message}</span>
                    </div>
                `;
            }
            
            enrAnalysisHTML += '</div>';
        }
        
        // ============ SECTION RECHARGE (TABLEAU SIMPLE) ============
        if (hasRechargeFiles) {
            try {
                // Importer dynamiquement uniquement la logique d'analyse
                const { analyzeRecharge } = await import('./analyzer/rechargeAnalyzer.js');

                const allRecharges = [];

                for (const file of window.rechargeFiles) {
                    console.log(`🔋 Analyse RECHARGE (tableau simple) pour le fichier: ${file.name}`);
                    try {
                        const results = analyzeRecharge(file.content || '');
                        // Ajouter une trace du fichier source si besoin plus tard
                        results.forEach(r => {
                            allRecharges.push({
                                ...r,
                                sourceFile: file.name || '',
                                sourceClient: file.client || null
                            });
                        });
                    } catch (subError) {
                        console.error(`❌ Erreur lors de l'analyse RECHARGE pour ${file.name}:`, subError);
                    }
                }

                // Trier les recharges : plus récentes en premier (si timestamp disponible)
                allRecharges.sort((a, b) => {
                    if (a.timestamp && b.timestamp) {
                        return b.timestamp - a.timestamp;
                    }
                    return 0;
                });

                const rechargeTableHtml = createSimpleRechargeTable(allRecharges);

                enrAnalysisHTML += `
                    <div class="file-type-section">
                        <h4 style="background: #38a169; color: white;">
                            🔋 Recharge - ${window.rechargeFiles.length} fichier(s)
                        </h4>
                        ${rechargeTableHtml}
                    </div>
                `;
            } catch (error) {
                console.error('❌ Erreur lors de l\'import ou de l\'analyse RECHARGE:', error);
                enrAnalysisHTML += `
                    <div class="file-type-section">
                        <h4 style="background: #38a169; color: white;">
                            🔋 Recharge - ${window.rechargeFiles.length} fichier(s)
                        </h4>
                        <div class="error-message">
                            <span class="error-icon">❌</span>
                            <span class="error-text">Erreur lors de l'analyse des fichiers recharge: ${error.message}</span>
                        </div>
                    </div>
                `;
            }
        }
        
        enrAnalysisHTML += '</div>';
        contentElement.innerHTML = enrAnalysisHTML;
        
        // Ajouter les styles
        addSimpleENRStyles();
        addMultiFileStyles();
        addECSimpleStyles();
        addCombinedTableStyles(); // NOUVEAU : Ajouter les styles pour le tableau combiné
        addDPDTStyles();

    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse ENR:', error);
        contentElement.innerHTML = `
            <div class="error-message">
                <span class="error-icon">❌</span>
                <span class="error-text">Erreur: ${error.message}</span>
            </div>
        `;
    } finally {
        hideLoader();
    }
}
// ======================== STYLES CSS EC SIMPLE ========================
function addECSimpleStyles() {
    if (document.querySelector('#ec-simple-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'ec-simple-styles';
    styles.textContent = `
        .ec-table-container {
            margin-bottom: 30px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .ec-table-container h4 {
            margin: 0;
            padding: 15px;
            background: #4299e1;
            color: white;
            font-size: 16px;
        }
        
        .simple-ec-table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }
        
        .simple-ec-table th {
            background: #f1f5f9;
            padding: 12px 10px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
            color: #475569;
        }
        
        .simple-ec-table td {
            padding: 10px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
        }
        
        .simple-ec-table tr:hover {
            background: #f7fafc;
        }
        
        /* Couleurs pour les différentes types de lignes EC */
        .ec-credit-nul {
            background: #fef3c7 !important;
        }
        
        .ec-credit-nul:hover {
            background: #fde68a !important;
        }
        
        .ec-energie-epuisee {
            background: #fee2e2 !important;
        }
        
        .ec-energie-epuisee:hover {
            background: #fecaca !important;
        }
        
        .ec-surcharge {
            background: #e0e7ff !important;
        }
        
        .ec-surcharge:hover {
            background: #c7d2fe !important;
        }
        
        .ec-puissance-depassee {
            background: #dbeafe !important;
        }
        
        .ec-puissance-depassee:hover {
            background: #bfdbfe !important;
        }
        
        .ec-normal {
            background: #d1fae5 !important;
        }
        
        .ec-normal:hover {
            background: #a7f3d0 !important;
        }
        
        /* Style pour le code */
        .simple-ec-table code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            color: #334155;
            font-size: 12px;
        }
        
        .ec-file-error {
            background: #fee2e2;
            border: 1px solid #ef4444;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .ec-file-error h4 {
            margin: 0 0 10px 0;
            color: #dc2626;
        }
        
        /* Table summary */
        .table-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 10px;
            padding: 15px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
        }
        
        .summary-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
        }
        
        .summary-label {
            font-weight: 600;
            color: #475569;
        }
        
        .summary-value {
            color: #1e293b;
            font-weight: bold;
        }
        
        /* Responsive */
        @media (max-width: 1200px) {
            .simple-ec-table {
                font-size: 12px;
            }
            
            .simple-ec-table th,
            .simple-ec-table td {
                padding: 8px 6px;
            }
        }
        
        @media (max-width: 768px) {
            .table-summary {
                grid-template-columns: 1fr;
            }
            
            .simple-ec-table {
                font-size: 11px;
            }
        }
    `;
    
    document.head.appendChild(styles);
}
// Fonction pour ajouter les styles CSS multi-fichiers
function addMultiFileStyles() {
    if (document.querySelector('#multi-file-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'multi-file-styles';
    styles.textContent = `
        .enr-analysis-multi-container {
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .file-type-section {
            margin-bottom: 30px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .file-type-section h4 {
            margin: 0;
            padding: 15px;
            background: #2c3e50;
            color: white;
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .raw-file-container {
            margin: 15px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            overflow: hidden;
        }
        
        .raw-file-header {
            padding: 12px 15px;
            background: #f7fafc;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .raw-file-header h5 {
            margin: 0;
            font-size: 15px;
            color: #2d3748;
        }
        
        .file-info {
            display: flex;
            gap: 10px;
            align-items: center;
            font-size: 12px;
        }
        
        .client-info {
            color: #4a5568;
            background: #edf2f7;
            padding: 4px 8px;
            border-radius: 4px;
        }
        
        .file-type-badge {
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
        }
        
        .ec-file .file-type-badge {
            background: #4299e1; /* Bleu pour EC */
        }
        
        .recharge-file .file-type-badge {
            background: #38a169; /* Vert pour RECHARGE */
        }
        
        .file-size {
            color: #718096;
        }
        
        .raw-file-content {
            padding: 15px;
            background: #1a202c;
            color: #e2e8f0;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .raw-file-content pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        /* Différenciation visuelle entre les sections */
        .file-type-section:first-child {
            border-left: 4px solid #e53e3e; /* Rouge pour ENR */
        }
        
        .file-type-section:nth-child(2) {
            border-left: 4px solid #4299e1; /* Bleu pour EC */
        }
        
        .file-type-section:nth-child(3) {
            border-left: 4px solid #38a169; /* Vert pour RECHARGE */
        }
    `;
    
    document.head.appendChild(styles);
}
// Fonction pour créer un tableau HTML simple
function createSimpleENRTable(data, filename) {
    if (!data || !data.length) {
        return `
            <div class="enr-table-container">
                <h4>📄 ${filename}</h4>
                <div class="no-data">Aucune donnée ENR trouvée</div>
            </div>
        `;
    }
    
    // Créer l'en-tête du tableau
    const headers = ['#', 'Date', 'Heure', 'État', 'Tension Forte', 'Tension Faible', 'Analyse État'];
    
    // Créer les lignes
    const rows = data.map((row, index) => {
        // Déterminer la couleur selon l'état
        let rowClass = 'enr-normal';
        if (row['Analyse État'].includes('DT')) {
            rowClass = 'enr-dt';
        } else if (row['Analyse État'].includes('DP')) {
            rowClass = 'enr-dp';
        }
        
        return `
            <tr class="${rowClass}">
                <td class="row-number">${index + 1}</td>
                <td>${row.Date}</td>
                <td>${row.Heure}</td>
                <td><code>${row.État}</code></td>
                <td><code>${row['Tension Forte']}</code></td>
                <td><code>${row['Tension Faible']}</code></td>
                <td>${row['Analyse État']}</td>
            </tr>
        `;
    }).join('');
    
    // Compter les statistiques
    const dtCount = data.filter(r => r['Analyse État'].includes('DT')).length;
    const dpCount = data.filter(r => r['Analyse État'].includes('DP')).length;
    const normalCount = data.filter(r => r['Analyse État'] === 'NORMAL').length;
    
    return `
        <div class="enr-table-container">
            <h4>📄 ${filename} (${data.length} enregistrements)</h4>
            <div class="table-wrapper">
                <table class="simple-enr-table">
                    <thead>
                        <tr>
                            ${headers.map(header => `<th>${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            <div class="table-summary">
                <div class="summary-item">
                    <span class="summary-label">📅 Période:</span>
                    <span class="summary-value">${data[0].Date} ${data[0].Heure} - ${data[data.length-1].Date} ${data[data.length-1].Heure}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">🔴 DT:</span>
                    <span class="summary-value">${dtCount} événements</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">🟡 DP:</span>
                    <span class="summary-value">${dpCount} événements</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">✅ Normal:</span>
                    <span class="summary-value">${normalCount} événements</span>
                </div>
            </div>
        </div>
    `;
}

// ======================== CRÉATION TABLEAU EC SIMPLE ========================
function createSimpleECTable(data, filename) {
    if (!data || !data.length) {
        return `
            <div class="ec-table-container">
                <h4>📄 ${filename}</h4>
                <div class="no-data">Aucune donnée EC trouvée</div>
            </div>
        `;
    }

    // Compter les statistiques par type d'état
    const stats = {
        'NORMAL': 0,
        'CRÉDIT NUL': 0,
        'ÉNERGIE ÉPUISÉE': 0,
        'SURCHARGE': 0,
        'PUISSANCE DÉPASSÉE': 0
    };

    data.forEach(row => {
        const etat = row['Analyse État'];
        if (stats[etat] !== undefined) {
            stats[etat]++;
        }
    });

    // Créer les lignes du tableau
    const rows = data.map((row, index) => {
        // Déterminer la classe CSS selon l'état
        let rowClass = 'ec-normal';
        const etat = row['Analyse État'];
        
        if (etat === 'CRÉDIT NUL') rowClass = 'ec-credit-nul';
        else if (etat === 'ÉNERGIE ÉPUISÉE') rowClass = 'ec-energie-epuisee';
        else if (etat === 'SURCHARGE') rowClass = 'ec-surcharge';
        else if (etat === 'PUISSANCE DÉPASSÉE') rowClass = 'ec-puissance-depassee';

        return `
            <tr class="${rowClass}">
                <td class="row-number">${index + 1}</td>
                <td>${row.Date}</td>
                <td>${row.Heure}</td>
                <td>Client ${row.Client}</td>
                <td><code>${row['État Hex']}</code></td>
                <td><code>${row['État Binaire']}</code></td>
                <td>${etat}</td>
                <td><code>${row['Tension Forte']}</code></td>
                <td><code>${row['Tension Faible']}</code></td>
            </tr>
        `;
    }).join('');

    return `
        <div class="ec-table-container">
            <h4>📄 ${filename} (${data.length} événements)</h4>
            <div class="table-wrapper">
                <table class="simple-ec-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Date</th>
                            <th>Heure</th>
                            <th>Client</th>
                            <th>État (Hex)</th>
                            <th>État (Bin)</th>
                            <th>Analyse</th>
                            <th>Tension Forte</th>
                            <th>Tension Faible</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            <div class="table-summary">
                <div class="summary-item">
                    <span class="summary-label">📅 Période:</span>
                    <span class="summary-value">${data[0].Date} ${data[0].Heure} - ${data[data.length-1].Date} ${data[data.length-1].Heure}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">💰 Crédit Nul:</span>
                    <span class="summary-value">${stats['CRÉDIT NUL']}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">🔋 Énergie Épuisée:</span>
                    <span class="summary-value">${stats['ÉNERGIE ÉPUISÉE']}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">⚡ Surcharge:</span>
                    <span class="summary-value">${stats['SURCHARGE']}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">📈 Puissance Dépassée:</span>
                    <span class="summary-value">${stats['PUISSANCE DÉPASSÉE']}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">✅ Normal:</span>
                    <span class="summary-value">${stats['NORMAL']}</span>
                </div>
            </div>
        </div>
    `;
}
// ======================== ANALYSE DES ÉVÉNEMENTS DP/DT ========================
function analyzeDPDTEvents() {
    console.log('🔍 Analyse des événements DP/DT depuis les fichiers ENR...');
    
    const allDPDTEvents = [];
    
    // Vérifier si nous avons des fichiers ENR
    if (window.enrFiles && window.enrFiles.length > 0) {
        for (const file of window.enrFiles) {
            try {
                console.log(`📄 Analyse du fichier ENR: ${file.name}`);
                const enrResults = analyzeENRSimple(file.content);
                
                enrResults.forEach(event => {
                    const analysis = event['Analyse État'] || '';
                    
                    // Détecter DP (Délestage Partiel)
                    if (analysis.includes('DP')) {
                        allDPDTEvents.push({
                            type: 'DP',
                            date: event.Date,
                            heure: event.Heure.replace('h', ':'),
                            client: event.client || '00',
                            source: 'ENR',
                            file: file.name,
                            'Tension Forte': event['Tension Forte'],
                            'Tension Faible': event['Tension Faible'],
                            'État Hex': event.État
                        });
                    }
                    
                    // Détecter DT (Délestage Total)
                    if (analysis.includes('DT')) {
                        allDPDTEvents.push({
                            type: 'DT',
                            date: event.Date,
                            heure: event.Heure.replace('h', ':'),
                            client: event.client || '00',
                            source: 'ENR',
                            file: file.name,
                            'Tension Forte': event['Tension Forte'],
                            'Tension Faible': event['Tension Faible'],
                            'État Hex': event.État
                        });
                    }
                });
                
                console.log(`✅ ${enrResults.length} événements ENR analysés depuis ${file.name}`);
            } catch (error) {
                console.error(`❌ Erreur analyse ENR ${file.name}:`, error);
            }
        }
    }
    
    // Trier par date et heure
    const sortedEvents = allDPDTEvents.sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('-') + 'T' + a.heure);
        const dateB = new Date(b.date.split('/').reverse().join('-') + 'T' + b.heure);
        return dateA - dateB;
    });
    
    console.log(`📊 Total événements DP/DT: ${sortedEvents.length} (DP: ${sortedEvents.filter(e => e.type === 'DP').length}, DT: ${sortedEvents.filter(e => e.type === 'DT').length})`);
    
    return sortedEvents;
}
// Fonction pour créer l'affichage du contenu brut des fichiers
function createRawFileContent(file, fileType) {
    const fileId = file.name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileTypeClass = fileType === 'ec' ? 'ec-file' : 'recharge-file';
    
    // Pour les fichiers EC, on pourrait aussi afficher une analyse rapide
    let quickAnalysis = '';
    
    if (fileType === 'ec') {
        try {
            const results = analyzeECSimple(file.content);
            if (results.length > 0) {
                quickAnalysis = `
                    <div class="quick-analysis">
                        <h6>📊 Analyse rapide:</h6>
                        <div class="quick-stats">
                            <span>${results.length} événements</span>
                            <span>Période: ${results[0].Date} ${results[0].Heure} - ${results[results.length-1].Date} ${results[results.length-1].Heure}</span>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            // Silencieux en cas d'erreur
        }
    }
    
    return `
        <div class="raw-file-container ${fileTypeClass}" data-file-id="${fileId}">
            <div class="raw-file-header">
                <h5>📄 ${file.name}</h5>
                <div class="file-info">
                    ${file.client ? `<span class="client-info">👤 Client: ${file.client}</span>` : ''}
                    <span class="file-type-badge">${file.type || fileType.toUpperCase()}</span>
                    <span class="file-size">📏 ${file.content.length} caractères</span>
                </div>
            </div>
            ${quickAnalysis}
            <div class="raw-file-content">
                <pre>${escapeHtml(file.content)}</pre>
            </div>
        </div>
    `;
}

// Tableau simple pour les recharges (client, crédit, durée, forfait, ID)
function createSimpleRechargeTable(recharges) {
    if (!recharges || recharges.length === 0) {
        return `
            <div class="no-data">
                <div class="no-data-content">
                    <span class="no-data-icon">📭</span>
                    <span class="no-data-text">Aucune recharge détectée dans les fichiers analysés.</span>
                </div>
            </div>
        `;
    }

    const rowsHtml = recharges.map((r, index) => {
        const clientLabel = r.client != null ? r.client : '-';
        const creditLabel = r.credit != null ? `${r.credit}` : '-';
        const dureeLabel = r.uniteDuree != null ? `${r.uniteDuree}` : '-';
        // Utiliser le nom de forfait s'il est déjà formaté par rechargeAnalyzer, sinon un fallback texte simple
        const forfaitLabel = r.nomForfait || `Forfait ${r.forfait ?? '-'}`;
        const idLabel = r.idRecharge || '-';

        return `
            <tr>
                <td class="row-index">${index + 1}</td>
                <td class="row-date">${clientLabel}</td>
                <td class="row-credit">${creditLabel}</td>
                <td class="row-hour">${dureeLabel}</td>
                <td class="row-tension">${forfaitLabel}</td>
                <td class="row-credit">${idLabel}</td>
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
                                <th>Client</th>
                                <th>Crédit</th>
                                <th>Durée (jours)</th>
                                <th>Forfait</th>
                                <th>ID Recharge</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}
// ======================== ANALYSE COMBINÉE ENR + EC ========================
function analyzeCombinedEvents(enrFiles, ecFiles) {
    console.log('🔗 Début analyse combinée ENR + EC');
    
    const allEvents = [];
    const eventTypes = {
        'SURCHARGE': { color: '#FF6B6B', icon: '⚡' },
        'CRÉDIT NUL': { color: '#FFD93D', icon: '💰' },
        'PUISSANCE DÉPASSÉE': { color: '#6BCEF5', icon: '📈' },
        'ÉNERGIE ÉPUISÉE': { color: '#FF8B94', icon: '🔋' }, // AJOUTÉ
        'DP': { color: '#FFA726', icon: '🔶' },
        'DT': { color: '#EF5350', icon: '🔴' }
    };

    // Analyser les fichiers ENR
    if (enrFiles && enrFiles.length > 0) {
        for (const file of enrFiles) {
            try {
                const enrResults = analyzeENRSimple(file.content);
                
                enrResults.forEach(event => {
                    // Détecter DP et DT dans l'analyse d'état
                    const analysis = event['Analyse État'] || '';
                    
                    if (analysis.includes('DP')) {
                        allEvents.push({
                            type: 'DP',
                            date: event.Date,
                            heure: event.Heure.replace('h', ':'),
                            client: event.client || '00',
                            source: 'ENR',
                            file: file.name
                        });
                    }
                    
                    if (analysis.includes('DT')) {
                        allEvents.push({
                            type: 'DT',
                            date: event.Date,
                            heure: event.Heure.replace('h', ':'),
                            client: event.client || '00',
                            source: 'ENR',
                            file: file.name
                        });
                    }
                });
                
                console.log(`✅ ${enrResults.length} événements ENR analysés depuis ${file.name}`);
            } catch (error) {
                console.error(`❌ Erreur analyse ENR ${file.name}:`, error);
            }
        }
    }

    // Analyser les fichiers EC
    if (ecFiles && ecFiles.length > 0) {
        for (const file of ecFiles) {
            try {
                const ecResults = analyzeECSimple(file.content);
                const fileClient = file.client || 'N/A'; // Récupérer le client du fichier
                
                ecResults.forEach(event => {
                    const eventType = event['Analyse État'] || 'NORMAL';
                    const eventClient = event.Client || fileClient; // Priorité à l'événement, sinon fichier
                    
                    if (eventType !== 'NORMAL') {
                        // Normaliser les noms d'événements
                        let normalizedType = eventType;
                        if (eventType === 'ÉNERGIE ÉPUISÉE') {
                            normalizedType = 'ÉNERGIE ÉPUISÉE';
                        } else if (eventType === 'CRÉDIT NUL') {
                            normalizedType = 'CRÉDIT NUL';
                        } else if (eventType === 'SURCHARGE') {
                            normalizedType = 'SURCHARGE';
                        } else if (eventType === 'PUISSANCE DÉPASSÉE') {
                            normalizedType = 'PUISSANCE DÉPASSÉE';
                        }
                        
                        allEvents.push({
                            type: normalizedType,
                            date: event.Date,
                            heure: event.Heure,
                            client: eventClient, // AJOUT: Client spécifique
                            source: 'EC',
                            file: file.name,
                            // Informations supplémentaires pour le tableau
                            clientInfo: `Client ${eventClient}`,
                            // Pour le regroupement par client
                            clientId: eventClient.toString()
                        });
                    }
                });
                
                console.log(`✅ ${ecResults.length} événements EC analysés depuis ${file.name}`);
            } catch (error) {
                console.error(`❌ Erreur analyse EC ${file.name}:`, error);
            }
        }
    }

    console.log(`📊 Total événements combinés: ${allEvents.length}`);
    
    // Grouper par date et type d'événement
    const dailyEvents = groupEventsByDateAndType(allEvents);
    
    return {
        allEvents: allEvents,
        dailyEvents: dailyEvents,
        eventTypes: eventTypes
    };
}

function groupEventsByDateAndType(allEvents) {
    const dailyMap = {};
    
    allEvents.forEach(event => {
        const dateKey = event.date;
        const typeKey = event.type;
        
        if (!dailyMap[dateKey]) {
            dailyMap[dateKey] = {};
        }
        
        if (!dailyMap[dateKey][typeKey]) {
            dailyMap[dateKey][typeKey] = {
                events: [],
                periods: []
            };
        }
        
        dailyMap[dateKey][typeKey].events.push(event);
    });
    
    // Pour chaque date et type, calculer les périodes
    Object.keys(dailyMap).forEach(date => {
        Object.keys(dailyMap[date]).forEach(type => {
            const events = dailyMap[date][type].events;
            
            // Trier les événements par heure
            events.sort((a, b) => {
                const timeA = convertTimeToMinutes(a.heure);
                const timeB = convertTimeToMinutes(b.heure);
                return timeA - timeB;
            });
            
            // Grouper en périodes continues
            const periods = calculateEventPeriods(events, type);
            dailyMap[date][type].periods = periods;
        });
    });
    
    return dailyMap;
}

function calculateEventPeriods(events, eventType) {
    if (events.length === 0) return [];
    
    const periods = [];
    let currentPeriod = null;
    
    // Trier les événements par heure
    events.sort((a, b) => {
        return convertTimeToMinutes(a.heure) - convertTimeToMinutes(b.heure);
    });
    
    events.forEach((event, index) => {
        const eventTime = convertTimeToMinutes(event.heure);
        
        if (!currentPeriod) {
            // Commencer une nouvelle période
            currentPeriod = {
                debut: event.heure,
                fin: event.heure,
                events: [event]
            };
        } else {
            const lastEventTime = convertTimeToMinutes(currentPeriod.fin);
            const timeDiff = eventTime - lastEventTime;
            
            // Si l'événement est dans les 30 minutes du précédent, on continue la période
            if (timeDiff <= 30) {
                currentPeriod.fin = event.heure;
                currentPeriod.events.push(event);
            } else {
                // Fin de période, en commencer une nouvelle
                periods.push(formatPeriod(currentPeriod));
                currentPeriod = {
                    debut: event.heure,
                    fin: event.heure,
                    events: [event]
                };
            }
        }
        
        // Si c'est le dernier événement, fermer la période
        if (index === events.length - 1) {
            periods.push(formatPeriod(currentPeriod));
        }
    });
    
    return periods;
}

function formatPeriod(period) {
    const debutMinutes = convertTimeToMinutes(period.debut);
    const finMinutes = convertTimeToMinutes(period.fin);
    const dureeMinutes = finMinutes - debutMinutes;
    
    return {
        debut: period.debut,
        fin: period.fin,
        duree: formatDuration(dureeMinutes),
        dureeMinutes: dureeMinutes,
        eventsCount: period.events.length,
        events: period.events
    };
}
function convertTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes}mn`;
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h${mins.toString().padStart(2, '0')}mn` : `${hours}h`;
    }
}

function createCombinedDailyTable(combinedAnalysis) {
    const { dailyEvents, eventTypes } = combinedAnalysis;
    
    if (Object.keys(dailyEvents).length === 0) {
        return '<div class="no-data">Aucun événement détecté</div>';
    }
    
    // Trier les dates
    const sortedDates = Object.keys(dailyEvents).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateA - dateB;
    });
    
    // Types d'événements dans l'ordre souhaité
    const eventTypeOrder = [
        'SURCHARGE', 
        'CRÉDIT NUL', 
        'PUISSANCE DÉPASSÉE', 
        'ÉNERGIE ÉPUISÉE',
        'DP', 
        'DT'
    ];
    
    // Définir quels types ont besoin de la colonne "Client"
    const typesWithClientColumn = {
        'SURCHARGE': true,
        'CRÉDIT NUL': true,
        'PUISSANCE DÉPASSÉE': true,
        'ÉNERGIE ÉPUISÉE': true,
        'DP': false,  // Pas de colonne client
        'DT': false   // Pas de colonne client
    };
    
    // Créer le HTML du tableau
    let html = `
        <div class="combined-events-table-container">
            <h4>📊 Tableau Journalier des Événements Combinés (ENR + EC)</h4>
            <div class="table-wrapper">
                <table class="combined-events-table">
                    <thead>
                        <tr>
                            <th rowspan="2" class="date-header">Date</th>
    `;
    
    // En-têtes pour les types d'événements
    eventTypeOrder.forEach(type => {
        const typeInfo = eventTypes[type];
        const hasClientColumn = typesWithClientColumn[type];
        const colspan = hasClientColumn ? 4 : 3; // 4 colonnes si client, sinon 3
        
        if (typeInfo) {
            html += `
                <th colspan="${colspan}" class="event-type-header" style="background: ${typeInfo.color}20; border-left: 3px solid ${typeInfo.color};">
                    <div class="event-type-title">
                        <span class="event-type-icon">${typeInfo.icon}</span>
                        <span class="event-type-name">${type}</span>
                        ${!hasClientColumn ? '<span class="no-client-note">(Sans client)</span>' : ''}
                    </div>
                </th>
            `;
        }
    });
    
    html += `
                        </tr>
                        <tr>
    `;
    
    // Sous-en-têtes selon le type d'événement
    eventTypeOrder.forEach(type => {
        const hasClientColumn = typesWithClientColumn[type];
        
        if (hasClientColumn) {
            // Pour les événements EC : Client + Début + Fin + Durée
            html += `
                <th class="sub-header">Client</th>
                <th class="sub-header">Début</th>
                <th class="sub-header">Fin</th>
                <th class="sub-header">Durée</th>
            `;
        } else {
            // Pour DP et DT : Début + Fin + Durée seulement
            html += `
                <th class="sub-header">Début</th>
                <th class="sub-header">Fin</th>
                <th class="sub-header">Durée</th>
            `;
        }
    });
    
    html += `
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // Remplir les lignes du tableau
    sortedDates.forEach(date => {
        const dateEvents = dailyEvents[date];
        html += `<tr class="date-row">`;
        
        // Colonne Date
        html += `<td class="date-cell" style="font-weight: bold; background: #f8f9fa;">${date}</td>`;
        
        // Pour chaque type d'événement
        eventTypeOrder.forEach(type => {
            const typeInfo = eventTypes[type];
            const hasClientColumn = typesWithClientColumn[type];
            const periods = dateEvents[type] ? dateEvents[type].periods : [];
            
            if (periods.length > 0) {
                // Prendre la période la plus longue
                const period = periods.reduce((longest, current) => 
                    current.dureeMinutes > longest.dureeMinutes ? current : longest
                );
                
                const bgColor = `${typeInfo.color}15`;
                
                // Colonne Client (uniquement pour les événements EC)
                if (hasClientColumn) {
                    // Extraire les clients impliqués dans cette période
                    const clientsInPeriod = [...new Set(period.events.map(e => e.client || '00'))];
                    const clientsDisplay = clientsInPeriod.map(c => `Client ${c}`).join(', ');
                    
                    html += `
                        <td style="background: ${bgColor}; font-weight: 500; font-size: 11px; color: ${typeInfo.color};" class="client-cell">
                            <span class="client-value" title="${clientsInPeriod.length > 1 ? 'Clients concernés: ' + clientsDisplay : ''}">
                                ${clientsInPeriod.length > 1 ? `${clientsInPeriod.length} clients` : clientsDisplay}
                            </span>
                        </td>
                    `;
                }
                
                // Colonnes Heures (Début et Fin)
                html += `
                    <td style="background: ${bgColor}; font-weight: bold; color: ${typeInfo.color};" class="time-cell">
                        <span class="time-value">${period.debut}</span>
                    </td>
                    <td style="background: ${bgColor}; font-weight: bold; color: ${typeInfo.color};" class="time-cell">
                        <span class="time-value">${period.fin}</span>
                    </td>
                    <td style="background: ${bgColor}; font-weight: bold; color: ${typeInfo.color};" class="duration-cell">
                        <span class="duration-value">${period.duree}</span>
                        ${periods.length > 1 ? `
                            <span class="period-count" title="${periods.length} période(s) détectée(s)">
                                <div class="period-tooltip">
                                    <strong>${periods.length} période(s):</strong><br>
                                    ${periods.map((p, idx) => 
                                        `${idx+1}. ${p.debut} → ${p.fin} (${p.duree})`
                                    ).join('<br>')}
                                </div>
                                (+${periods.length-1})
                            </span>
                        ` : ''}
                    </td>
                `;
            } else {
                // Pas d'événement pour ce type cette date
                const colspan = hasClientColumn ? 4 : 3;
                html += `
                    <td style="background: #fafafa; color: #ccc;" class="empty-cell" colspan="${colspan}">
                        <span class="no-event">Aucun événement</span>
                    </td>
                `;
            }
        });
        
        html += `</tr>`;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
            
            <!-- Légende des couleurs -->
            <div class="color-legend">
                <h5>Légende des Événements:</h5>
                <div class="legend-items">
    `;
    
    Object.entries(eventTypes).forEach(([type, info]) => {
        const hasClientColumn = typesWithClientColumn[type];
        
        html += `
            <div class="legend-item" style="border-left: 4px solid ${info.color};">
                <span class="legend-color" style="background: ${info.color}"></span>
                <span class="legend-icon">${info.icon}</span>
                <span class="legend-text">${type}</span>
                ${!hasClientColumn ? '<span class="client-info-note">(Sans client)</span>' : ''}
            </div>
        `;
    });
    
    return html;
}

// ======================== CALCUL DES STATISTIQUES ========================
function calculateCombinedStats(combinedAnalysis) {
    const { allEvents, dailyEvents } = combinedAnalysis;
    
    let totalDurationMinutes = 0;
    let periodsCount = 0;
    let energieEpCount = 0;
    
    // Calculer la durée totale et compter les événements par type
    Object.values(dailyEvents).forEach(dateEvents => {
        Object.entries(dateEvents).forEach(([type, eventTypeData]) => {
            // Compter les événements "ÉNERGIE ÉPUISÉE"
            if (type === 'ÉNERGIE ÉPUISÉE') {
                energieEpCount += eventTypeData.events.length;
            }
            
            eventTypeData.periods.forEach(period => {
                totalDurationMinutes += period.dureeMinutes;
                periodsCount++;
            });
        });
    });
    
    return {
        totalDays: Object.keys(dailyEvents).length,
        totalEvents: allEvents.length,
        eventTypesCount: Object.keys(combinedAnalysis.eventTypes).length,
        energieEpCount: energieEpCount,
        averageDuration: periodsCount > 0 ? formatDuration(Math.round(totalDurationMinutes / periodsCount)) : '0mn',
        totalDuration: formatDuration(totalDurationMinutes),
        periodsCount: periodsCount,
        // Statistiques par type
        eventsByType: Object.keys(combinedAnalysis.eventTypes).reduce((acc, type) => {
            acc[type] = allEvents.filter(e => e.type === type).length;
            return acc;
        }, {})
    };
}
// Fonction pour échapper les caractères HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initializeENRTabs() {
    console.log('🔧 Initialisation des tabs ENR');
    
    document.addEventListener('click', (e) => {
        const tab = e.target.closest('.enr-tab');
        if (!tab) return;

        const targetId = tab.dataset.tab;
        const container = tab.closest('.enr-tabs-container');

        if (!container) return;

        // Désactiver tous les tabs et contenus
        container.querySelectorAll('.enr-tab').forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.enr-tab-content').forEach(c => c.classList.remove('active'));

        // Activer le tab sélectionné
        tab.classList.add('active');
        const contentElement = document.getElementById(targetId);
        if (contentElement) {
            contentElement.classList.add('active');
        }
    });
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

    // Définir les seuils des kits
    const kitThresholds = [
        { label: 'Kit 0', value: 250, color: '#FF6B6B' },    // Rouge
        { label: 'Kit 1', value: 360, color: '#FFA726' },    // Orange
        { label: 'Kit 2', value: 540, color: '#FFD93D' },    // Jaune
        { label: 'Kit 3', value: 720, color: '#4ECDC4' },    // Turquoise
        { label: 'Kit 4', value: 1080, color: '#667eea' }    // Bleu
    ];

    // Trouver l'énergie maximale dans les données (hors zéros)
    const nonZeroValues = data.filter(v => v && v > 0);
    const maxDataValue = nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 0;

    // DÉTERMINER LES KITS À AFFICHER DYNAMIQUEMENT
    let visibleKitThresholds = [];
    
    if (maxDataValue === 0) {
        // Aucune consommation : afficher seulement Kit 0
        visibleKitThresholds = [kitThresholds[0]];
    } else {
        // Trouver le plus petit kit qui dépasse la consommation max
        const relevantKits = kitThresholds.filter(kit => kit.value >= maxDataValue);
        
        if (relevantKits.length > 0) {
            // Afficher le kit trouvé + tous les kits inférieurs
            const maxKitIndex = kitThresholds.findIndex(kit => kit.value === relevantKits[0].value);
            visibleKitThresholds = kitThresholds.slice(0, maxKitIndex + 1);
            
            // Ajouter un kit supplémentaire si on est très proche du seuil supérieur
            if (maxKitIndex < kitThresholds.length - 1) {
                const nextKit = kitThresholds[maxKitIndex + 1];
                const ratio = maxDataValue / relevantKits[0].value;
                if (ratio > 0.8) { // Si on dépasse 80% du kit, montrer le suivant
                    visibleKitThresholds.push(nextKit);
                }
            }
        } else {
            // La consommation dépasse tous les kits : afficher tous les kits
            visibleKitThresholds = [...kitThresholds];
            // Ajouter une ligne spéciale pour la valeur max observée
            visibleKitThresholds.push({
                label: 'MAX',
                value: Math.ceil(maxDataValue / 100) * 100, // Arrondir à la centaine supérieure
                color: '#1f2933',
                dashed: true
            });
        }
    }

    // Si on a très peu de données, afficher au moins 2 kits pour l'échelle
    if (visibleKitThresholds.length < 2 && maxDataValue > 0) {
        const firstKitIndex = kitThresholds.findIndex(kit => kit.value >= maxDataValue);
        if (firstKitIndex > 0) {
            visibleKitThresholds.push(kitThresholds[firstKitIndex - 1]);
        }
    }

    // Trier par valeur croissante
    visibleKitThresholds.sort((a, b) => a.value - b.value);

    // Couleur des points selon le kit "adapté"
    const pointBackgroundColors = data.map(value => {
        if (value === 0 || value == null) {
            // Aucun kit consommé / pas de données : couleur neutre
            return '#CBD5E0';
        }

        // Trouver le premier kit dont la valeur est >= à l'énergie du jour
        const matchingKit = visibleKitThresholds.find(kit => value <= kit.value);

        if (matchingKit) {
            return matchingKit.color;
        }

        // Si la consommation dépasse le plus gros kit visible
        return '#1f2933';
    });

    // Déterminer un "kit recommandé" global pour la période
    let recommendedKit = null;
    if (nonZeroValues.length > 0) {
        const maxValue = Math.max(...nonZeroValues);
        recommendedKit = visibleKitThresholds.find(kit => maxValue <= kit.value) || null;
    }

    // Calculer l'échelle Y maximale pour avoir de la marge
    const maxVisibleKit = visibleKitThresholds[visibleKitThresholds.length - 1];
    const maxYValue = Math.max(
        maxDataValue * 1.2, // 20% de marge au-dessus des données
        maxVisibleKit.value * 1.1 // 10% au-dessus du plus haut kit
    );

    // Mettre à jour le texte de synthèse
    const summaryElement = document.getElementById('allClientsEnergySummary');
    if (summaryElement) {
        if (recommendedKit) {
            summaryElement.innerHTML = `
                <div style="background: #f0f9ff; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-top: 10px; margin-bottom: 10px;">
                    <strong style="color: #1e40af;">📊 Analyse dimensionnement :</strong>
                    <div style="margin-top: 8px; font-size: 13px; color: #374151;">
                        <strong>Kit recommandé :</strong> ${recommendedKit.label} (jusqu'à ${recommendedKit.value.toLocaleString('fr-FR')} Wh/jour)
                        <br>
                        <small style="color: #6b7280;">
                            ${visibleKitThresholds.length > 1 ? 
                                `Seuils affichés : ${visibleKitThresholds.map(k => k.label).join(', ')}` : 
                                `Seuil unique : ${visibleKitThresholds[0].label}`
                            }
                        </small>
                    </div>
                </div>
            `;
        } else if (nonZeroValues.length === 0) {
            summaryElement.innerHTML = `
                <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #94a3b8; margin-top: 10px;">
                    <strong style="color: #475569;">ℹ️ Information :</strong>
                    <div style="margin-top: 8px; font-size: 13px; color: #64748b;">
                        Aucune consommation significative détectée. Le dimensionnement de kit n'est pas pertinent avec ces données.
                    </div>
                </div>
            `;
        } else {
            summaryElement.innerHTML = `
                <div style="background: #fef3c7; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-top: 10px;">
                    <strong style="color: #92400e;">⚠️ Attention :</strong>
                    <div style="margin-top: 8px; font-size: 13px; color: #92400e;">
                        La consommation dépasse le plus grand kit disponible (${maxVisibleKit.label}).
                        <br>
                        <small style="color: #b45309;">
                            ${visibleKitThresholds.length} seuil(s) affiché(s) sur ${kitThresholds.length} disponible(s)
                        </small>
                    </div>
                </div>
            `;
        }
    }

    // Créer le graphique
    const ctx = chartCanvas.getContext('2d');
    window.allClientsEnergyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                // Dataset principal - ligne d'énergie
                {
                    label: 'Énergie Maximale Totale par Jour (Wh)',
                    data: data,
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderColor: '#667eea',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: pointBackgroundColors,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: '#764ba2',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 3
                },
                // Dataset pour les lignes de seuils des kits (DYNAMIQUE)
                ...visibleKitThresholds.map(kit => ({
                    label: kit.label,
                    data: labels.map(() => kit.value),
                    borderColor: kit.color,
                    borderWidth: kit.dashed ? 3 : 2,
                    borderDash: kit.dashed ? [10, 5] : [5, 3],
                    fill: false,
                    pointRadius: 0,
                    tension: 0
                }))
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: maxYValue, // ÉCHELLE DYNAMIQUE
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
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 13,
                            weight: 'bold',
                            family: "'Segoe UI', 'Helvetica Neue', sans-serif"
                        },
                        color: '#2c3e50',
                        padding: 15,
                        usePointStyle: true,
                        filter: function(item, chart) {
                            // Afficher toutes les légendes
                            return true;
                        }
                    },
                    onClick: function(e, legendItem, legend) {
                        const index = legendItem.datasetIndex;
                        const chart = legend.chart;
                        const meta = chart.getDatasetMeta(index);
                        
                        // Empêcher la désactivation des datasets de seuils
                        if (index === 0) {
                            // Pour le dataset principal, on peut toggle
                            meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                        } else {
                            // Pour les seuils, on ne permet pas de les cacher
                            return;
                        }
                        
                        chart.update();
                    }
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
                            if (context[0].datasetIndex === 0) {
                                return '📊 ' + context[0].label;
                            }
                            const kitIndex = context[0].datasetIndex - 1;
                            if (kitIndex < visibleKitThresholds.length) {
                                const kit = visibleKitThresholds[kitIndex];
                                return kit.dashed ? '🚨 ' + kit.label + ' - Consommation MAX' : '📏 ' + kit.label + ' - Seuil';
                            }
                            return 'Seuil';
                        },
                        label: function (context) {
                            const datasetIndex = context.datasetIndex;
                            const value = context.parsed.y.toLocaleString('fr-FR');
                            
                            if (datasetIndex === 0) {
                                const date = context.label === maxEnergyDate ? ' ⚡ MAXIMUM' : '';
                                return `${context.dataset.label}: ${value} Wh${date}`;
                            } else {
                                const kitIndex = datasetIndex - 1;
                                if (kitIndex < visibleKitThresholds.length) {
                                    const kit = visibleKitThresholds[kitIndex];
                                    if (kit.dashed) {
                                        return `Seuil max recommandé: ${kit.value} Wh`;
                                    }
                                    return `Seuil ${kit.label}: ${kit.value} Wh`;
                                }
                                return `Seuil: ${value} Wh`;
                            }
                        },
                        afterLabel: function(context) {
                            const lines = [];

                            // Message spécial pour le jour d'énergie maximale
                            if (context.datasetIndex === 0 && context.label === maxEnergyDate) {
                                lines.push('🏆 Énergie maximale enregistrée');
                            }

                            return lines;
                        }
                    }
                }
            }
        }
    });
}
// Ajoutez cette fonction pour inclure les styles dynamiques
function addDynamicKitStyles() {
    if (document.querySelector('#dynamic-kit-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'dynamic-kit-styles';
    styles.textContent = `
        /* Styles pour l'info-bulle des kits */
        .kit-threshold-info {
            position: absolute;
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            max-width: 300px;
            font-size: 12px;
        }
        
        .kit-threshold-info h4 {
            margin: 0 0 8px 0;
            color: #2d3748;
            font-size: 13px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
        }
        
        .kit-list {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        
        .kit-item {
            display: flex;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid #f7fafc;
        }
        
        .kit-color {
            width: 12px;
            height: 12px;
            border-radius: 3px;
            margin-right: 8px;
            border: 1px solid rgba(0,0,0,0.1);
        }
        
        /* Légende améliorée */
        .kit-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
            padding: 10px;
            background: #f8fafc;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
        }
        
        .kit-legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: #4a5568;
        }
        
        .kit-legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
        
        /* Message d'info sur le dimensionnement */
        .dimensioning-info {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-left: 4px solid #0ea5e9;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
        }
        
        .dimensioning-info h5 {
            margin: 0 0 8px 0;
            color: #0369a1;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .kit-status {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
            margin-left: 8px;
        }
        
        .kit-status.adequate {
            background: #dcfce7;
            color: #166534;
        }
        
        .kit-status.inadequate {
            background: #fee2e2;
            color: #991b1b;
        }
        
        .kit-status.warning {
            background: #fef3c7;
            color: #92400e;
        }
    `;
    
    document.head.appendChild(styles);
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
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: minData.map(value => {
                        if (value === null) return '#a855f7';
                        return value < systemLimits.min ? '#ef4444' : '#a855f7';
                    }),
                    pointBorderColor: minData.map(value => {
                        if (value === null) return '#7e22ce';
                        return value < systemLimits.min ? '#991b1b' : '#7e22ce';
                    }),
                    pointBorderWidth: minData.map(value => {
                        if (value === null) return 2;
                        return value < systemLimits.min ? 2.5 : 2;
                    }),
                    pointHoverRadius: 6
                },
                {
                    label: 'Tension Maximale (V)',
                    data: maxData,
                    borderColor: '#3182ce',
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: maxData.map(value => {
                        if (value === null) return '#3182ce';
                        return value > systemLimits.max ? '#ef4444' : '#3182ce';
                    }),
                    pointBorderColor: maxData.map(value => {
                        if (value === null) return '#2c5aa0';
                        return value > systemLimits.max ? '#991b1b' : '#2c5aa0';
                    }),
                    pointBorderWidth: maxData.map(value => {
                        if (value === null) return 2;
                        return value > systemLimits.max ? 2.5 : 2;
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
            animation: {
                duration: 800,
                easing: 'easeInOutQuart'
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
// Fonction pour ajouter les styles CSS
function addSimpleENRStyles() {
    if (document.querySelector('#simple-enr-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'simple-enr-styles';
    styles.textContent = `
        .enr-analysis-simple-container {
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .enr-table-container {
            margin-bottom: 30px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .enr-table-container h4 {
            margin: 0;
            padding: 15px;
            background: #2c3e50;
            color: white;
            font-size: 16px;
        }
        
        .table-wrapper {
            overflow-x: auto;
        }
        
        .simple-enr-table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        
        .simple-enr-table th {
            background: #f1f5f9;
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
            color: #475569;
        }
        
        .simple-enr-table td {
            padding: 10px 15px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .simple-enr-table tr:hover {
            background: #f7fafc;
        }
        
        .simple-enr-table .row-number {
            color: #64748b;
            font-size: 12px;
            text-align: center;
        }
        
        .simple-enr-table code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            color: #334155;
        }
        
        /* Couleurs pour les différentes types de lignes */
        .enr-dt {
            background: #fee2e2 !important;
        }
        
        .enr-dt:hover {
            background: #fecaca !important;
        }
        
        .enr-dp {
            background: #fef3c7 !important;
        }
        
        .enr-dp:hover {
            background: #fde68a !important;
        }
        
        .enr-normal {
            background: #d1fae5 !important;
        }
        
        .enr-normal:hover {
            background: #a7f3d0 !important;
        }
        
        .table-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            padding: 15px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
        }
        
        .summary-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .summary-label {
            font-weight: 600;
            color: #475569;
        }
        
        .summary-value {
            color: #1e293b;
        }
        
        .enr-file-error {
            background: #fee2e2;
            border: 1px solid #ef4444;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .enr-file-error h4 {
            margin: 0 0 10px 0;
            color: #dc2626;
        }
        
        .error-details {
            font-size: 12px;
            color: #7f1d1d;
            background: #fecaca;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            margin-top: 10px;
        }
    `;
    
    document.head.appendChild(styles);
}


// ======================== STYLES POUR LE TABLEAU COMBINÉ ========================
function addCombinedTableStyles() {
    if (document.querySelector('#combined-table-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'combined-table-styles';
    styles.textContent = `
        .combined-events-table-container {
            margin: 20px 0;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .combined-events-table-container h4 {
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 18px;
            text-align: center;
            border-bottom: 3px solid #4c51bf;
        }
        
        .table-wrapper {
            overflow-x: auto;
            padding: 15px;
            max-height: 600px;
            overflow-y: auto;
        }
        
        .combined-events-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 12px;
            min-width: 900px;
        }
        
        .combined-events-table th {
            padding: 12px 10px;
            text-align: center;
            font-weight: 600;
            border: 1px solid #e2e8f0;
            white-space: nowrap;
            position: sticky;
            top: 0;
            background: white;
            z-index: 20;
        }
        
        .combined-events-table .date-header {
            background: #f8f9fa;
            z-index: 30;
            left: 0;
            min-width: 90px;
            border-right: 2px solid #cbd5e0;
        }
        
        .combined-events-table .event-type-header {
            border-bottom: 2px solid #4a5568;
        }
        
        .event-type-title {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 5px 0;
        }
        
        .event-type-icon {
            font-size: 16px;
        }
        
        .event-type-name {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .combined-events-table .sub-header {
            background: #f8f9fa;
            font-size: 10px;
            color: #718096;
            font-weight: 500;
            border-top: none;
        }
        
        .combined-events-table td {
            padding: 10px 8px;
            border: 1px solid #e2e8f0;
            text-align: center;
            vertical-align: middle;
            position: relative;
        }
        
        .combined-events-table .date-cell {
            background: #f8f9fa;
            font-weight: bold;
            position: sticky;
            left: 0;
            z-index: 10;
            min-width: 90px;
            border-right: 2px solid #cbd5e0;
            box-shadow: 2px 0 5px rgba(0,0,0,0.05);
        }
        
        .combined-events-table .time-cell {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            font-weight: 600;
        }
        
        .combined-events-table .duration-cell {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            font-weight: 700;
        }
        
        .combined-events-table .empty-cell {
            color: #cbd5e0;
            font-style: italic;
        }
        
        .period-count {
            font-size: 9px;
            color: #718096;
            background: rgba(255,255,255,0.7);
            padding: 1px 4px;
            border-radius: 3px;
            margin-left: 4px;
            cursor: pointer;
            position: relative;
            display: inline-block;
        }
        
        .period-count:hover .period-tooltip {
            display: block;
        }
        
        .period-tooltip {
            display: none;
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #2d3748;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 10px;
            white-space: nowrap;
            z-index: 100;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            min-width: 200px;
            max-width: 300px;
            text-align: left;
            line-height: 1.4;
            margin-bottom: 5px;
        }
        
        .period-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-width: 5px;
            border-style: solid;
            border-color: #2d3748 transparent transparent transparent;
        }
        
        /* Légende */
        .color-legend {
            padding: 15px 20px;
            background: #f8f9fa;
            border-top: 2px solid #e2e8f0;
        }
        
        .color-legend h5 {
            margin: 0 0 12px 0;
            color: #2c3e50;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .color-legend h5::before {
            content: '🎨';
            font-size: 16px;
        }
        
        .legend-items {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 10px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            background: white;
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: all 0.2s;
        }
        
        .legend-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            border: 2px solid rgba(255,255,255,0.8);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        
        .legend-icon {
            font-size: 16px;
            width: 24px;
            text-align: center;
        }
        
        .legend-text {
            font-size: 12px;
            font-weight: 600;
            color: #2c3e50;
            flex: 1;
        }
        
        /* Statistiques */
        .combined-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 15px;
            padding: 20px;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-top: 2px solid #cbd5e0;
        }
        
        .stats-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.08);
            transition: all 0.3s;
            position: relative;
            overflow: hidden;
        }
        
        .stats-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
        }
        
        .stats-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.12);
        }
        
        .stats-icon {
            font-size: 28px;
            display: block;
            margin-bottom: 8px;
            opacity: 0.9;
        }
        
        .stats-value {
            display: block;
            font-size: 26px;
            font-weight: 800;
            color: #2c3e50;
            margin-bottom: 4px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .stats-label {
            font-size: 11px;
            color: #718096;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            font-weight: 600;
        }
        
        /* Responsive */
        @media (max-width: 1400px) {
            .table-wrapper {
                max-height: 500px;
            }
        }
        
        @media (max-width: 1200px) {
            .combined-events-table {
                font-size: 11px;
            }
            
            .combined-events-table th,
            .combined-events-table td {
                padding: 8px 6px;
            }
            
            .event-type-name {
                font-size: 10px;
            }
        }
        
        @media (max-width: 992px) {
            .legend-items {
                grid-template-columns: repeat(3, 1fr);
            }
            
            .combined-stats {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        
        @media (max-width: 768px) {
            .legend-items {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .event-type-title {
                flex-direction: column;
                gap: 2px;
            }
            
            .table-wrapper {
                padding: 10px;
                max-height: 400px;
            }
        }
        
        @media (max-width: 576px) {
            .legend-items {
                grid-template-columns: 1fr;
            }
            
            .combined-stats {
                grid-template-columns: 1fr;
            }
        }
        
        /* Animation pour les cellules */
        @keyframes fadeInRow {
            from { 
                opacity: 0; 
                transform: translateY(10px); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0); 
            }
        }
        
        .combined-events-table tbody tr {
            animation: fadeInRow 0.4s ease-out;
        }
        
        .combined-events-table tbody tr:nth-child(even) {
            background-color: #fafbfc;
        }
        
        .combined-events-table tbody tr:hover td:not(.date-cell) {
            background: #f0f9ff !important;
            box-shadow: inset 0 0 0 1px rgba(66, 153, 225, 0.2);
        }
        
        .combined-events-table tbody tr:hover .date-cell {
            background: #edf2f7 !important;
            box-shadow: inset 0 0 0 1px rgba(203, 213, 224, 0.5);
        }
        
        /* Style spécifique pour ÉNERGIE ÉPUISÉE */
        td[style*="#FF8B94"] {
            border-left: 2px solid #FF8B94 !important;
            border-right: 2px solid #FF8B94 !important;
        }
        
        /* Effet de surbrillance pour les cellules avec données */
        .time-value, .duration-value {
            position: relative;
            z-index: 1;
        }
        
        .time-value::after, .duration-value::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: calc(100% + 10px);
            height: calc(100% + 6px);
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            z-index: -1;
            opacity: 0;
            transition: opacity 0.2s;
        }
        
        .time-cell:hover .time-value::after,
        .duration-cell:hover .duration-value::after {
            opacity: 1;
        }
    `;
    
    document.head.appendChild(styles);
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