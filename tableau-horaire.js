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

// ======================== VARIABLES GLOBALES ========================
let matrixTableVisible = false; // FALSE par défaut (tableau caché)

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

        // === AJOUT DU BOUTON ANALYSE V2 À CÔTÉ DU TITRE DU DOSSIER ===
        const folderTitle = document.getElementById('folder-title');
        if (folderTitle) {
            // Créer le conteneur flex
            folderTitle.innerHTML = ''; // Vider le contenu existant
            folderTitle.style.display = 'flex';
            folderTitle.style.alignItems = 'center';
            folderTitle.style.justifyContent = 'space-between';
            folderTitle.style.width = '100%';

            // Groupe de gauche : NR + ANALYSE V2
            const leftGroup = document.createElement('div');
            leftGroup.style.display = 'flex';
            leftGroup.style.alignItems = 'center';
            leftGroup.style.gap = '15px';

            // Créer le span pour le texte NR
            const nrSpan = document.createElement('span');
            nrSpan.className = 'nr-text';
            nrSpan.textContent = `📁 NR - ${nr}`;

            // Créer le bouton ANALYSE V2
            const analyzeButton = document.createElement('span');
            analyzeButton.className = 'analyze-v2-button';
            analyzeButton.textContent = '⚡ ANALYSE V2 ⚡';
            analyzeButton.style.cursor = 'pointer';
            analyzeButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            analyzeButton.style.color = 'white';
            analyzeButton.style.padding = '8px 20px';
            analyzeButton.style.borderRadius = '30px';
            analyzeButton.style.fontSize = '16px';
            analyzeButton.style.fontWeight = '600';
            analyzeButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            analyzeButton.style.transition = 'all 0.3s ease';

            // Action au clic pour ANALYSE V2
            analyzeButton.addEventListener('click', () => {
                console.log('⚡ Bouton ANALYSE V2 cliqué');
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });

            // Ajouter NR et ANALYSE V2 au groupe de gauche
            leftGroup.appendChild(nrSpan);
            leftGroup.appendChild(analyzeButton);

            // Groupe de droite : bouton Retour
            const rightGroup = document.createElement('div');

            // Créer le bouton RETOUR
            const backButton = document.createElement('button');
            backButton.id = 'back-btn-header';
            backButton.innerHTML = '↩️ Retour aux dossiers';
            backButton.style.background = '#f1f5f9';
            backButton.style.border = '1px solid #cbd5e1';
            backButton.style.color = '#475569';
            backButton.style.padding = '8px 20px';
            backButton.style.borderRadius = '30px';
            backButton.style.fontSize = '14px';
            backButton.style.fontWeight = '600';
            backButton.style.cursor = 'pointer';
            backButton.style.transition = 'all 0.3s ease';
            backButton.style.display = 'flex';
            backButton.style.alignItems = 'center';
            backButton.style.gap = '8px';

            // Effet hover
            backButton.addEventListener('mouseenter', () => {
                backButton.style.background = '#e2e8f0';
                backButton.style.borderColor = '#94a3b8';
                backButton.style.transform = 'translateY(-2px)';
                backButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
            });

            backButton.addEventListener('mouseleave', () => {
                backButton.style.background = '#f1f5f9';
                backButton.style.borderColor = '#cbd5e1';
                backButton.style.transform = 'translateY(0)';
                backButton.style.boxShadow = 'none';
            });

            // Action au clic
            backButton.addEventListener('click', () => {
                window.location.href = 'files.html';
            });

            rightGroup.appendChild(backButton);

            // Ajouter les deux groupes au titre
            folderTitle.appendChild(leftGroup);
            folderTitle.appendChild(rightGroup);
        }

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
            openDefaultTab();
        }, 100);

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
        <!-- NOUVEAU : Onglet FRAUDE -->
        <button class="main-tab" 
                data-main-tab="FRAUDE" 
                onclick="switchMainTab('FRAUDE', this)">
            <span class="tab-icon">🚨</span>
            <span class="tab-label">FRAUDE</span>
        </button>
    `;
    mainTabsHTML += '</div>';

    // === ONGLETS SECONDAIRES ===
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

    // NOUVEAU : Sous-onglet pour FRAUDE (optionnel - si vous voulez des sous-onglets)
    subTabsHTML += `
        <button class="sub-tab" 
                data-sub-tab="DETECTION" 
                data-main="FRAUDE"
                onclick="switchSubTab('DETECTION', 'FRAUDE', this)">
            <span class="tab-icon">🔍</span>
            <span class="tab-label">DÉTECTION</span>
        </button>
    `;

    subTabsHTML += '</div>';

    // === CONTENU DES ONGLETS ===
    let contentHTML = '';

    // Contenu TECHNIQUE
    contentHTML += `
        <div class="main-content active" id="main-content-TECHNIQUE">
            <div class="sub-content active" id="sub-content-ALL">
            </div>
        </div>
    `;

    // Contenu COMMERCIALE
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

    // NOUVEAU : Contenu FRAUDE
    contentHTML += `
        <div class="main-content" id="main-content-FRAUDE">
            <div class="sub-content" id="sub-content-DETECTION">
                <!-- Le contenu de détection sera ajouté ici plus tard -->
            </div>
            <div class="sub-content" id="sub-content-HISTORIQUE">
                <!-- Le contenu historique sera ajouté ici plus tard -->
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

    // Gérer la visibilité des sous-onglets
    document.querySelectorAll('.sub-tab').forEach(tab => {
        const tabMainAttr = tab.getAttribute('data-main');
        if (tabMainAttr === mainTab) {
            tab.classList.remove('hidden');
        } else {
            tab.classList.add('hidden');
        }
        tab.classList.remove('active');
    });

    // Activer le premier sous-onglet correspondant
    const firstSubTab = document.querySelector(`.sub-tab[data-main="${mainTab}"]`);
    if (firstSubTab) {
        firstSubTab.classList.add('active');
        const subTabValue = firstSubTab.getAttribute('data-sub-tab');

        document.querySelectorAll('.sub-content').forEach(content => {
            content.classList.remove('active');
        });

        const subContentElement = document.getElementById(`sub-content-${subTabValue}`);
        if (subContentElement) {
            subContentElement.classList.add('active');

            // Appeler les fonctions d'affichage selon l'onglet
            if (mainTab === 'TECHNIQUE' && subTabValue === 'ALL') {
                displayAllClientsTab();
            }
            else if (mainTab === 'COMMERCIALE' && allResultsByClient[subTabValue]) {
                displayClientData(subTabValue, allResultsByClient[subTabValue]);
            }
            else if (mainTab === 'FRAUDE') {
                // NOUVEAU : Appeler la fonction d'affichage FRAUDE
                displayFraudeTab(subTabValue);
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

// ======================== FONCTION PRINCIPALE CORRIGÉE ========================
// Cette fonction génère la vue commerciale complète
function generateCommercialView(clientId) {
    // --- Récupération des données ---
    const clientData = allResultsByClient[clientId];
    const dailySummary = dailySummaryByClient[clientId] || [];
    const creditData = creditResultsByClient[clientId];

    if (!clientData || dailySummary.length === 0) {
        return `<div class="no-data-message">Aucune donnée de consommation disponible pour ce client.</div>`;
    }

    // --- Informations de base et forfaits ---
    const clientNumber = parseInt(clientId).toString().padStart(2, '0');
    const allForfaits = extractClientForfaits(clientId);
    const currentForfait = allForfaits.find(f => f.isCurrent) || { name: 'N/A', max: 0, code: 'N/A' };
    const forfaitLimits = getLocalForfaitLimits(currentForfait.name);
    const forfaitMax = forfaitLimits.max;
    const toleranceMax = forfaitMax * 1.15;

    // --- Statistiques clés ---
    const stats = calculateClientStats(dailySummary, forfaitMax);

    // --- Construction du HTML ---
    return `
        <!-- EN-TÊTE CLIENT -->
        <div style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); color: white; padding: 15px 20px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px;">
            <span style="font-size: 24px;">👤</span>
            <span style="font-size: 18px; font-weight: 600;">Client ${clientNumber}</span>
            <span style="margin-left: auto; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 13px;">
                ${currentForfait.name} · ${forfaitMax}Wh · ${dailySummary.length} jours
            </span>
        </div>

        <!-- HISTORIQUE DES FORFAITS ET CONSOMMATION -->
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; margin: 20px 0; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <div style="padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">📋</span>
                    <span style="font-weight: 700; color: #1e293b; font-size: 16px;">Historique des forfaits et consommation</span>
                    <span style="margin-left: auto; font-size: 12px; color: #64748b;">${allForfaits.length} forfait(s) · Analyse détaillée par période</span>
                </div>
            </div>
            <div style="padding: 20px;">
                ${generateForfaitHistoryTable(allForfaits, dailySummary, forfaitMax)}
                ${generateForfaitProgressBars(allForfaits, dailySummary, forfaitMax)}
            </div>
        </div>
    `;
}

// ======================== FONCTION À ADAPTER SELON VOS DONNÉES ========================
// Extrait l'historique des forfaits d'un client à partir des données.
function extractClientForfaits(clientId) {
    const forfaits = [];
    const daily = dailySummaryByClient[clientId] || [];

    if (daily.length === 0) {
        return [{
            name: 'N/A',
            max: 0,
            startDate: '-',
            endDate: '-',
            isCurrent: true,
            code: '-',
            previousForfait: null
        }];
    }

    // --- ADAPTEZ CETTE PARTIE SELON VOTRE STRUCTURE DE DONNÉES RÉELLE ---
    // Exemple avec détection de changements de forfait dans les données de recharge
    const firstDay = daily[0]?.date || '-';
    const lastDay = daily[daily.length - 1]?.date || '-';
    const forfaitName = allResultsByClient[clientId]?.forfait || 'ECO';
    const forfaitInfo = getLocalForfaitLimits(forfaitName);

    // Forfait actuel (toujours présent)
    forfaits.push({
        name: forfaitName,
        max: forfaitInfo.max,
        code: '3',
        startDate: firstDay,
        endDate: lastDay,
        isCurrent: true,
        previousForfait: null
    });

    // --- EXEMPLE AVEC PLUSIEURS FORFAITS (DÉCOMMENTEZ ET ADAPTEZ) ---
    /*
    // Ancien forfait (si détecté)
    forfaits.unshift({
        name: 'ANCIEN FORFAIT',
        max: 50,
        code: '2',
        startDate: '01/01/2023',
        endDate: '31/12/2023',
        isCurrent: false,
        previousForfait: null
    });
    
    // Mettre à jour le changement pour le forfait actuel
    forfaits[1].previousForfait = forfaits[0].name;
    */

    return forfaits;
}

// Calcule les statistiques de consommation avec les seuils 85% et 115%
function calculateClientStats(dailySummary, forfaitMax) {
    const daysWithConsumption = dailySummary.filter(d => d.energieMax > 0);
    const daysWithoutConsumption = dailySummary.filter(d => !d.energieMax || d.energieMax === 0);

    // Calculs des énergies
    const maxEnergy = Math.max(...dailySummary.map(d => d.energieMax || 0));
    const maxEnergyDate = dailySummary.find(d => d.energieMax === maxEnergy)?.date || '-';

    const avgEnergy = daysWithConsumption.length > 0
        ? Math.round(dailySummary.reduce((sum, d) => sum + (d.energieMax || 0), 0) / daysWithConsumption.length)
        : 0;

    // SEUILS: 85% et 115% (conformes à votre exemple)
    const seuil85 = forfaitMax * 0.85;
    const seuil115 = forfaitMax * 1.15;

    const daysInLimits = dailySummary.filter(d => d.energieMax > 0 && d.energieMax <= seuil85).length;
    const daysInTolerance = dailySummary.filter(d => d.energieMax > seuil85 && d.energieMax <= seuil115).length;
    const daysOutOfTolerance = dailySummary.filter(d => d.energieMax > seuil115).length;
    const daysWithEnergyDepleted = daysOutOfTolerance; // Hors tolérance = Énergie épuisée

    const totalDaysWithData = dailySummary.filter(d => d.energieMax > 0).length;

    // Pourcentages
    const percentInLimits = totalDaysWithData > 0 ? Math.round((daysInLimits / totalDaysWithData) * 100) : 0;
    const percentInTolerance = totalDaysWithData > 0 ? Math.round((daysInTolerance / totalDaysWithData) * 100) : 0;
    const percentOutOfTolerance = totalDaysWithData > 0 ? Math.round((daysOutOfTolerance / totalDaysWithData) * 100) : 0;
    const percentDaysWithConsumption = dailySummary.length > 0 ? Math.round((daysWithConsumption.length / dailySummary.length) * 100) : 0;

    // Dates de début et fin
    const startDate = dailySummary.length > 0 ? dailySummary[0].date : '-';
    const endDate = dailySummary.length > 0 ? dailySummary[dailySummary.length - 1].date : '-';

    return {
        isActive: daysWithConsumption.length > 0,
        daysWithConsumption: daysWithConsumption.length,
        daysWithoutConsumption: daysWithoutConsumption.length,
        percentDaysWithConsumption,
        maxEnergy,
        maxEnergyDate,
        avgEnergy,
        daysInLimits,
        daysInTolerance,
        daysOutOfTolerance,
        daysWithEnergyDepleted,
        percentInLimits,
        percentInTolerance,
        percentOutOfTolerance,
        startDate,
        endDate,
        totalDays: dailySummary.length
    };
}


function generateForfaitHistoryTable(forfaits, dailySummary, currentForfaitMax) {
    if (forfaits.length === 0) return '';

    let tableRows = '';
    forfaits.forEach((f, index) => {
        const daysInPeriod = dailySummary.filter(d => d.date >= f.startDate && d.date <= f.endDate);
        const daysWith = daysInPeriod.filter(d => d.energieMax > 0).length;
        const daysWithout = daysInPeriod.length - daysWith;
        const changement = f.previousForfait ? `${f.previousForfait} → ${f.name}` : 'Premier forfait';
        const rowClass = f.isCurrent ? 'current-forfait-row' : '';

        // Calcul des énergies max et moyenne pour la période
        const energiesInPeriod = daysInPeriod.map(d => d.energieMax || 0).filter(v => v > 0);
        const maxEnergy = energiesInPeriod.length > 0 ? Math.max(...energiesInPeriod) : 0;
        const maxEnergyDate = energiesInPeriod.length > 0 ? daysInPeriod.find(d => d.energieMax === maxEnergy)?.date || '-' : '-';
        const avgEnergy = energiesInPeriod.length > 0 ? Math.round(energiesInPeriod.reduce((a, b) => a + b, 0) / energiesInPeriod.length) : 0;

        tableRows += `
            <tr class="${rowClass}" style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px 15px; white-space: nowrap;">${f.startDate} → ${f.endDate}</td>
                <td style="padding: 12px 15px; text-align: center;">
                    <span style="background: ${f.isCurrent ? '#22c55e20' : '#9f7aea20'}; color: ${f.isCurrent ? '#22c55e' : '#9f7aea'}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                        ${f.name}
                    </span>
                </td>
                <td style="padding: 12px 15px; text-align: center; color: #64748b;">${changement}</td>
                <td style="padding: 12px 15px; text-align: center; background: #f8fafc; font-weight: 600;">${daysInPeriod.length}</td>
                <td style="padding: 12px 15px; text-align: center; background: #f8fafc; color: #22c55e; font-weight: 600;">
                    ${daysWith} <span style="font-size: 11px; color: #64748b;">(${daysInPeriod.length > 0 ? Math.round(daysWith / daysInPeriod.length * 100) : 0}%)</span>
                </td>
                <td style="padding: 12px 15px; text-align: center; background: #f8fafc; color: #64748b; font-weight: 600;">
                    ${daysWithout} <span style="font-size: 11px; color: #64748b;">(${daysInPeriod.length > 0 ? Math.round(daysWithout / daysInPeriod.length * 100) : 0}%)</span>
                </td>
                <td style="padding: 12px 15px; text-align: center; background: #ede9fe;">
                    <div style="font-weight: 700; color: #7c3aed;">${maxEnergy.toFixed(1)} Wh</div>
                    <div style="font-size: 10px; color: #6b21a5;">${maxEnergyDate}</div>
                </td>
                <td style="padding: 12px 15px; text-align: center; background: #ede9fe; font-weight: 600; color: #7c3aed;">
                    ${avgEnergy} Wh
                </td>
            </tr>
        `;
    });

    return `
        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1200px;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 12px 15px; text-align: left; color: #475569; font-weight: 600;">Période</th>
                        <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600;">Forfait</th>
                        <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600;">Changement</th>
                        <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600; background: #f1f5f9;">📅 Jours totaux</th>
                        <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600; background: #f1f5f9;">✅ Jours avec conso</th>
                        <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600; background: #f1f5f9;">⭕ Jours sans conso</th>
                        <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600; background: #ede9fe;">⚡ Énergie max</th>
                        <th style="padding: 12px 15px; text-align: center; color: #475569; font-weight: 600; background: #ede9fe;">📊 Énergie moy</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}


function generateForfaitProgressBars(forfaits, dailySummary, currentForfaitMax) {
    const stats = calculateClientStats(dailySummary, currentForfaitMax);

    return `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 15px;">
            <span style="font-size: 18px;">📊</span>
            <span style="font-weight: 600; color: #1e293b;">Répartition de l'énergie consommée (seuils 85% et 115%)</span>
        </div>
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
            <div style="background: #f1f5f9; border-radius: 30px; height: 40px; overflow: hidden; display: flex; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 10px;">
                <div style="width: ${stats.percentInLimits}%; height: 100%; background: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white;">
                    ${stats.percentInLimits > 5 ? stats.percentInLimits + '%' : ''}
                </div>
                <div style="width: ${stats.percentInTolerance}%; height: 100%; background: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white;">
                    ${stats.percentInTolerance > 5 ? stats.percentInTolerance + '%' : ''}
                </div>
                <div style="width: ${stats.percentOutOfTolerance}%; height: 100%; background: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white;">
                    ${stats.percentOutOfTolerance > 5 ? stats.percentOutOfTolerance + '%' : ''}
                </div>
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between; font-size: 12px; color: #475569;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 14px; height: 14px; background: #22c55e; border-radius: 3px;"></span>
                    <span><strong>Normal (0-85%)</strong> · ${stats.daysInLimits} jours · ${stats.percentInLimits}%</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 14px; height: 14px; background: #f59e0b; border-radius: 3px;"></span>
                    <span><strong>Tolérance (85-115%)</strong> · ${stats.daysInTolerance} jours · ${stats.percentInTolerance}%</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 14px; height: 14px; background: #ef4444; border-radius: 3px;"></span>
                    <span><strong>Hors tolérance (>115%)</strong> · ${stats.daysOutOfTolerance} jours · ${stats.percentOutOfTolerance}%</span>
                </div>
            </div>
        </div>
    `;
}


function generateConsumptionStatsGrid(stats, forfaitMax, toleranceMax) {
    return `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px;">
            <!-- Énergie max (gradient-purple) -->
            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 12px; padding: 16px; color: white;">
                <div style="font-size: 18px; margin-bottom: 10px; opacity: 0.9;">⚡</div>
                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Énergie max (Wh)</div>
                <div style="font-size: 28px; font-weight: 700; line-height: 1.2;">${stats.maxEnergy.toFixed(1)}</div>
                <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">le ${stats.maxEnergyDate}</div>
            </div>
            
            <!-- Énergie moyenne (gradient-blue) -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; padding: 16px; color: white;">
                <div style="font-size: 18px; margin-bottom: 10px; opacity: 0.9;">📊</div>
                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Énergie moyenne (Wh)</div>
                <div style="font-size: 28px; font-weight: 700; line-height: 1.2;">${stats.avgEnergy}</div>
                <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">sur ${stats.daysWithConsumption} jours avec conso</div>
            </div>
            
            <!-- Jours sans conso (gradient-gray) -->
            <div style="background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); border-radius: 12px; padding: 16px; color: white;">
                <div style="font-size: 18px; margin-bottom: 10px; opacity: 0.9;">⭕</div>
                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Jours sans conso</div>
                <div style="font-size: 28px; font-weight: 700; line-height: 1.2;">${stats.daysWithoutConsumption}</div>
                <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">${stats.daysWithoutConsumption > 0 ? Math.round((stats.daysWithoutConsumption / stats.totalDays) * 100) : 0}% du temps</div>
            </div>
            
            <!-- Jours avec conso (gradient-green) -->
            <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 12px; padding: 16px; color: white;">
                <div style="font-size: 18px; margin-bottom: 10px; opacity: 0.9;">✅</div>
                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Jours avec conso</div>
                <div style="font-size: 28px; font-weight: 700; line-height: 1.2;">${stats.daysWithConsumption}</div>
                <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">${stats.percentDaysWithConsumption}% du temps</div>
            </div>
        </div>

        <!-- Section Répartition (seuils 85% et 115%) -->
        <div style="margin-top: 20px; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div style="font-weight: 600; color: #1e293b; font-size: 14px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">📈</span> Répartition (seuils 85% et 115%)
            </div>
            
            <div style="background: #f1f5f9; border-radius: 30px; height: 30px; overflow: hidden; display: flex; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 15px;">
                <div style="width: ${stats.percentInLimits}%; height: 100%; background: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white;">
                    ${stats.percentInLimits > 5 ? stats.percentInLimits + '%' : ''}
                </div>
                <div style="width: ${stats.percentInTolerance}%; height: 100%; background: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white;">
                    ${stats.percentInTolerance > 5 ? stats.percentInTolerance + '%' : ''}
                </div>
                <div style="width: ${stats.percentOutOfTolerance}%; height: 100%; background: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white;">
                    ${stats.percentOutOfTolerance > 5 ? stats.percentOutOfTolerance + '%' : ''}
                </div>
            </div>
            
            <div style="display: flex; gap: 25px; margin-top: 12px; font-size: 12px; color: #334155; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 14px; height: 14px; background: #22c55e; border-radius: 3px;"></span>
                    <span><strong>Normal</strong> (≤85%)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 14px; height: 14px; background: #f59e0b; border-radius: 3px;"></span>
                    <span><strong>Tolérance</strong> (85-115%)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 14px; height: 14px; background: #ef4444; border-radius: 3px;"></span>
                    <span><strong>Hors tolérance</strong> (>115%)</span>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 13px; color: #475569;">
                <span><strong>${stats.daysInLimits}</strong> jours (${stats.percentInLimits}%)</span>
                <span><strong>${stats.daysInTolerance}</strong> jours (${stats.percentInTolerance}%)</span>
                <span><strong>${stats.daysOutOfTolerance}</strong> jours (${stats.percentOutOfTolerance}%)</span>
            </div>
        </div>
    `;
}


// Génère la section dédiée aux jours avec énergie épuisée
function generateEnergyDepletedSection(stats) {
    return `
        <div style="margin-top: 20px; padding: 16px 20px; background: #fee2e2; border-radius: 10px; border-left: 4px solid #ef4444;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">🔋</span>
                <div>
                    <div style="font-weight: 600; color: #991b1b; font-size: 14px; margin-bottom: 5px;">Jours avec énergie épuisée (SuspendE)</div>
                    <div style="font-size: 28px; font-weight: 700; color: #b91c1c;">${stats.daysWithEnergyDepleted} jours <span style="font-size: 14px; font-weight: 400; color: #991b1b;">(${stats.percentOutOfTolerance}%)</span></div>
                </div>
            </div>
        </div>
    `;
}
// ======================== FONCTION SIMPLIFIÉE ========================
// Analyse les jours sans crédit pour un client à partir des données de crédit
function analyzeClientCreditDays(clientId) {
    const clientNumber = parseInt(clientId);

    const daysWithoutCredit = [];
    const streaks = [];

    // Utiliser creditResultsByClient qui est déjà défini dans votre code
    if (window.creditResultsByClient && window.creditResultsByClient[clientId] &&
        window.creditResultsByClient[clientId].results) {

        const results = window.creditResultsByClient[clientId].results;

        // Trier par date (du plus ancien au plus récent)
        const sortedResults = [...results].sort((a, b) => {
            const dateA = new Date(a.date.split('/').reverse().join('-'));
            const dateB = new Date(b.date.split('/').reverse().join('-'));
            return dateA - dateB;
        });

        console.log(`📊 Analyse crédit client ${clientId}: ${sortedResults.length} relevés`);

        // Analyser jour par jour
        let currentStreak = [];

        sortedResults.forEach((record, index) => {
            const creditValue = parseFloat(record.credit || record.valeur || 0);
            const dateStr = record.date;

            // Formater la date pour l'affichage (JJ/MM)
            const [day, month] = dateStr.split('/');
            const displayDate = `${day}/${month}`;

            if (creditValue === 0) {
                // Jour sans crédit
                daysWithoutCredit.push(displayDate);
                currentStreak.push({
                    date: dateStr,
                    displayDate: displayDate,
                    value: creditValue
                });
            } else {
                // Jour avec crédit, fin de la streak si elle existe
                if (currentStreak.length > 0) {
                    streaks.push([...currentStreak]);
                    currentStreak = [];
                }
            }

            // Si c'est le dernier élément, ajouter la streak en cours
            if (index === sortedResults.length - 1 && currentStreak.length > 0) {
                streaks.push([...currentStreak]);
            }
        });
    }

    // Formater les séries pour l'affichage
    const significantStreaks = streaks
        .filter(streak => streak.length > 1) // Garder seulement les séries > 1 jour
        .map(streak => {
            const startDate = streak[0].displayDate;
            const endDate = streak[streak.length - 1].displayDate;
            return {
                days: streak.length,
                startDate: startDate,
                endDate: endDate,
                originalStart: streak[0].date,
                originalEnd: streak[streak.length - 1].date
            };
        })
        .sort((a, b) => b.days - a.days); // Trier par durée décroissante

    const longestStreak = significantStreaks.length > 0 ? significantStreaks[0].days : 0;

    console.log(`✅ Résultat: ${daysWithoutCredit.length} jours sans crédit, ${significantStreaks.length} séries >1j`);

    return {
        daysWithoutCredit: daysWithoutCredit,
        totalDaysWithoutCredit: daysWithoutCredit.length,
        streaks: streaks,
        significantStreaks: significantStreaks,
        longestStreak: longestStreak
    };
}

// ======================== CRÉATION DU GRAPHIQUE D'ÉVOLUTION DU CRÉDIT ========================
function createCreditChart(creditData, clientId) {
    console.log(`📊 Création graphique crédit pour client ${clientId}`, creditData);
    
    if (!creditData || !creditData.results || creditData.results.length === 0) {
        console.warn(`⚠️ Aucune donnée de crédit pour client ${clientId}`);
        return `<div style="text-align: center; padding: 40px; color: #64748b; background: #f8fafc; border-radius: 12px;">
                    <span style="font-size: 48px; display: block; margin-bottom: 10px;">📭</span>
                    <span>Aucune donnée de crédit disponible pour ce client</span>
                </div>`;
    }

    // Préparer les données pour le graphique
    const sortedResults = [...creditData.results].sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        return dateA - dateB;
    });

    // Extraire les dates et valeurs
    const dates = [];
    const creditValues = [];

    sortedResults.forEach((item) => {
        const creditValue = parseFloat(item.credit || item.valeur || 0);
        const dateStr = item.date;
        dates.push(dateStr);
        creditValues.push(creditValue);
    });

    console.log(`📈 Données préparées: ${dates.length} points, min=${Math.min(...creditValues)}, max=${Math.max(...creditValues)}`);

    // Créer un ID unique pour le canvas
    const chartId = `credit-chart-${clientId}-${Date.now()}`;
    
    // Attendre que le DOM soit prêt pour créer le graphique
    setTimeout(() => {
        const canvas = document.getElementById(chartId);
        if (!canvas) {
            console.error(`❌ Canvas ${chartId} non trouvé - réessai dans 200ms`);
            // Réessayer une fois
            setTimeout(() => {
                const canvasRetry = document.getElementById(chartId);
                if (!canvasRetry) {
                    console.error(`❌ Canvas ${chartId} toujours non trouvé`);
                    return;
                }
                createChartInstance(canvasRetry, dates, creditValues, clientId);
            }, 200);
            return;
        }
        createChartInstance(canvas, dates, creditValues, clientId);
    }, 150);
    
    // Fonction interne pour créer l'instance du graphique
    function createChartInstance(canvas, dates, creditValues, clientId) {
        // Vérifier que Chart.js est chargé
        if (typeof Chart === 'undefined') {
            console.error('❌ Chart.js n\'est pas chargé!');
            canvas.parentElement.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444; background: #fee2e2; border-radius: 12px;">
                    <span style="font-size: 32px;">⚠️</span>
                    <p style="margin-top: 10px;">Chart.js n'est pas chargé. Veuillez ajouter le script dans votre page HTML.</p>
                </div>
            `;
            return;
        }
        
        // Créer les couleurs pour chaque barre
        const barColors = creditValues.map((value) => {
            return value === 0 ? '#ef4444' : '#22c55e';  // Changé de #3b82f6 (bleu) à #22c55e (vert)
        });
        
        // Détruire l'ancien graphique s'il existe
        if (window[`creditChart_${clientId}`]) {
            window[`creditChart_${clientId}`].destroy();
        }
        
        const ctx = canvas.getContext('2d');
        window[`creditChart_${clientId}`] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Crédit (jours)',
                    data: creditValues,
                    backgroundColor: barColors,
                    borderColor: barColors.map(c => c === '#ef4444' ? '#dc2626' : '#16a34a'), // Vert foncé 
                    borderWidth: 1,
                    borderRadius: 6,
                    barPercentage: 0.7,
                    categoryPercentage: 0.9
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            title: (context) => {
                                return context[0].label;
                            },
                            label: (context) => {
                                const value = context.parsed.y;
                                if (value === 0) {
                                    return '💰 Crédit nul - risque de coupure';
                                }
                                return `${value} jour(s) de crédit restant`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Jours de crédit',
                            font: { size: 11, weight: 'bold' },
                            color: '#334155'
                        },
                        ticks: {
                            stepSize: 10,
                            callback: (value) => value + 'j',
                            font: { size: 10 }
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date',
                            font: { size: 11, weight: 'bold' },
                            color: '#334155'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 30,
                            font: { size: 9 },
                            autoSkip: true,
                            maxTicksLimit: 12
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10
                    }
                }
            }
        });
        
        console.log(`✅ Graphique crédit créé pour client ${clientId}`);
    }

    // Générer le HTML du conteneur
    return `
        <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
                          border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 18px; color: white;">💰</span>
                </div>
                <div>
                    <div style="font-weight: 700; color: #1e293b; font-size: 16px;">Évolution du Crédit</div>
                    <div style="font-size: 11px; color: #64748b;">Évolution journalière du nombre de jours de crédit</div>
                </div>
                <div style="margin-left: auto; background: #fef3c7; padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #92400e;">
                    📊 ${sortedResults.length} relevés
                </div>
            </div>
            
            <div style="width: 100%; height: 300px;">
                <canvas id="${chartId}" style="width: 100% !important; height: 100% !important;"></canvas>
            </div>
            
            <div style="display: flex; justify-content: center; gap: 20px; margin-top: 15px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; background: #3b82f6; border-radius: 2px;"></span>
                    <span style="font-size: 11px; color: #475569;">Jours de crédit</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; background: #ef4444; border-radius: 2px;"></span>
                    <span style="font-size: 11px; color: #475569;">Crédit nul</span>
                </div>
            </div>
        </div>
    `;
}
// ======================== ANALYSE MENSUELLE DU CRÉDIT ========================
function analyzeMonthlyCredit(creditResults, clientId) {
    if (!creditResults || !creditResults.results || creditResults.results.length === 0) {
        return [];
    }

    // Grouper par mois/année
    const monthlyData = {};

    creditResults.results.forEach(item => {
        const dateStr = item.date;
        const [day, month, year] = dateStr.split('/');
        const monthKey = `${year}-${month.padStart(2, '0')}`;
        const monthName = getMonthName(parseInt(month));
        
        const creditValue = parseFloat(item.credit || item.valeur || 0);
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                year: parseInt(year),
                month: parseInt(month),
                monthName: monthName,
                days: new Set(),
                daysWithoutCredit: new Set(),
                creditValues: [],
                totalCredit: 0,
                creditCount: 0,
                maxCredit: 0
            };
        }
        
        // Ajouter le jour
        monthlyData[monthKey].days.add(dateStr);
        
        // Suivre les jours sans crédit
        if (creditValue === 0) {
            monthlyData[monthKey].daysWithoutCredit.add(dateStr);
        }
        
        // Statistiques de crédit (uniquement valeurs > 0)
        if (creditValue > 0) {
            monthlyData[monthKey].creditValues.push(creditValue);
            monthlyData[monthKey].totalCredit += creditValue;
            monthlyData[monthKey].creditCount++;
            if (creditValue > monthlyData[monthKey].maxCredit) {
                monthlyData[monthKey].maxCredit = creditValue;
            }
        }
    });

    // Calculer les statistiques mensuelles
    const monthlyStats = Object.values(monthlyData)
        .map(data => {
            const totalDays = data.days.size;
            const daysWithoutCredit = data.daysWithoutCredit.size;
            const tauxDisponibilite = totalDays > 0 
                ? ((totalDays - daysWithoutCredit) / totalDays * 100).toFixed(1)
                : 0;
            
            const creditMoyen = data.creditCount > 0 
                ? (data.totalCredit / data.creditCount).toFixed(1)
                : 0;
            
            return {
                month: `${data.monthName} ${data.year}`,
                monthKey: `${data.year}-${data.month.toString().padStart(2, '0')}`,
                totalDays: totalDays,
                daysWithoutCredit: daysWithoutCredit,
                tauxDisponibilite: parseFloat(tauxDisponibilite),
                maxCredit: data.maxCredit,
                creditMoyen: parseFloat(creditMoyen),
                pourcentageSansCredit: totalDays > 0 
                    ? ((daysWithoutCredit / totalDays) * 100).toFixed(1)
                    : 0
            };
        })
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    return monthlyStats;
}

// ======================== CRÉATION DU TABLEAU MENSUEL ========================
function createMonthlyCreditTable(monthlyStats) {
    if (!monthlyStats || monthlyStats.length === 0) {
        return `
            <div style="text-align: center; padding: 30px; color: #64748b; background: #f8fafc; border-radius: 12px;">
                <span style="font-size: 32px;">📊</span>
                <p style="margin-top: 10px;">Aucune donnée mensuelle disponible</p>
            </div>
        `;
    }

    const rows = monthlyStats.map(stat => {
        // Déterminer la couleur du taux de disponibilité
        let tauxColor = '#22c55e';
        let tauxBg = '#f0fdf4';
        if (stat.tauxDisponibilite < 80) {
            tauxColor = '#ef4444';
            tauxBg = '#fef2f2';
        } else if (stat.tauxDisponibilite < 95) {
            tauxColor = '#f59e0b';
            tauxBg = '#fef3c7';
        }
        
        // Déterminer la couleur pour les jours sans crédit
        let sansCreditColor = '#64748b';
        let sansCreditBg = '#f1f5f9';
        let sansCreditBadge = '';
        
        if (stat.daysWithoutCredit > 0) {
            const pourcentage = parseFloat(stat.pourcentageSansCredit);
            if (pourcentage > 20) {
                sansCreditColor = '#ef4444';
                sansCreditBg = '#fee2e2';
                sansCreditBadge = '🔴';
            } else if (pourcentage > 10) {
                sansCreditColor = '#f59e0b';
                sansCreditBg = '#fef3c7';
                sansCreditBadge = '⚠️';
            } else {
                sansCreditColor = '#f97316';
                sansCreditBg = '#fff7ed';
                sansCreditBadge = '⚠️';
            }
        } else {
            sansCreditBadge = '✅';
            sansCreditBg = '#f0fdf4';
            sansCreditColor = '#22c55e';
        }
        
        return `
            <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;" 
                onmouseover="this.style.background='#f8fafc'" 
                onmouseout="this.style.background='white'">
                <td style="padding: 14px 12px; font-weight: 600; color: #1e293b;">
                    ${stat.month}
                 </td>
                <td style="padding: 14px 12px; text-align: center; font-weight: 500;">
                    ${stat.totalDays}
                 </td>
                <td style="padding: 14px 12px; text-align: center;">
                    <span style="display: inline-flex; align-items: center; gap: 4px; 
                             background: ${sansCreditBg}; 
                             color: ${sansCreditColor}; 
                             padding: 4px 12px; 
                             border-radius: 20px; 
                             font-weight: 600;
                             font-size: 13px;">
                        ${sansCreditBadge} ${stat.daysWithoutCredit}
                        <span style="font-size: 11px; opacity: 0.8;">(${stat.pourcentageSansCredit}%)</span>
                    </span>
                  </td>
                <td style="padding: 14px 12px; text-align: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; background: #e2e8f0; border-radius: 20px; height: 6px; overflow: hidden;">
                            <div style="width: ${stat.tauxDisponibilite}%; height: 100%; background: ${tauxColor}; border-radius: 20px;"></div>
                        </div>
                        <span style="font-weight: 700; color: ${tauxColor}; min-width: 45px;">
                            ${stat.tauxDisponibilite}%
                        </span>
                    </div>
                  </td>
                <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #10b981;">
                    ${stat.maxCredit} j
                  </td>
                <td style="padding: 14px 12px; text-align: center; font-weight: 600; color: #3b82f6;">
                    ${stat.creditMoyen} j
                  </td>
              </tr>
        `;
    }).join('');

    // Calculer les totaux globaux
    const totalDays = monthlyStats.reduce((sum, s) => sum + s.totalDays, 0);
    const totalDaysWithoutCredit = monthlyStats.reduce((sum, s) => sum + s.daysWithoutCredit, 0);
    const globalTauxDisponibilite = totalDays > 0 
        ? ((totalDays - totalDaysWithoutCredit) / totalDays * 100).toFixed(1)
        : 0;
    const globalMaxCredit = Math.max(...monthlyStats.map(s => s.maxCredit));
    const globalCreditMoyen = (monthlyStats.reduce((sum, s) => sum + s.creditMoyen, 0) / monthlyStats.length).toFixed(1);
    
    // Déterminer la couleur globale du taux
    let globalTauxColor = '#22c55e';
    if (globalTauxDisponibilite < 80) {
        globalTauxColor = '#ef4444';
    } else if (globalTauxDisponibilite < 95) {
        globalTauxColor = '#f59e0b';
    }

    return `
        <div style="margin-top: 20px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); 
                          border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 18px; color: white;">📅</span>
                </div>
                <div>
                    <div style="font-weight: 700; color: #1e293b; font-size: 16px;">Analyse mensuelle du crédit</div>
                    <div style="font-size: 11px; color: #64748b;">Évolution mensuelle de la disponibilité et du crédit</div>
                </div>
                <div style="margin-left: auto; background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
                    📊 ${monthlyStats.length} mois analysés
                </div>
            </div>
            
            <div style="overflow-x: auto; border-radius: 12px; border: 1px solid #e2e8f0; background: white;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 14px 12px; text-align: left; font-weight: 700; color: #334155;">Mois</th>
                            <th style="padding: 14px 12px; text-align: center; font-weight: 700; color: #334155;">Jours analysés</th>
                            <th style="padding: 14px 12px; text-align: center; font-weight: 700; color: #334155;">Jours sans crédit</th>
                            <th style="padding: 14px 12px; text-align: center; font-weight: 700; color: #334155;">Taux de disponibilité</th>
                            <th style="padding: 14px 12px; text-align: center; font-weight: 700; color: #334155;">Crédit maximum</th>
                            <th style="padding: 14px 12px; text-align: center; font-weight: 700; color: #334155;">Crédit moyen</th>
                         </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f8fafc; border-top: 2px solid #e2e8f0; font-weight: 600;">
                            <td style="padding: 14px 12px; font-weight: 700; color: #1e293b;">TOTAL / MOYENNE</td>
                            <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #1e293b;">${totalDays}</td>
                            <td style="padding: 14px 12px; text-align: center; font-weight: 700; color: #1e293b;">${totalDaysWithoutCredit}</td>
                            <td style="padding: 14px 12px; text-align: center;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="flex: 1; background: #e2e8f0; border-radius: 20px; height: 8px; overflow: hidden;">
                                        <div style="width: ${globalTauxDisponibilite}%; height: 100%; background: ${globalTauxColor}; border-radius: 20px;"></div>
                                    </div>
                                    <span style="font-weight: 800; color: ${globalTauxColor}; min-width: 45px;">
                                        ${globalTauxDisponibilite}%
                                    </span>
                                </div>
                             </td>
                            <td style="padding: 14px 12px; text-align: center; font-weight: 800; color: #10b981;">${globalMaxCredit} j</td>
                            <td style="padding: 14px 12px; text-align: center; font-weight: 800; color: #3b82f6;">${globalCreditMoyen} j</td>
                         </tr>
                    </tfoot>
                 </table>
            </div>
            
            <!-- Légende -->
            <div style="display: flex; gap: 20px; margin-top: 12px; padding: 10px 0; font-size: 11px; color: #64748b; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; background: #22c55e; border-radius: 2px;"></span>
                    <span>Taux ≥ 95%</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; background: #f59e0b; border-radius: 2px;"></span>
                    <span>Taux 80-95%</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; background: #ef4444; border-radius: 2px;"></span>
                    <span>Taux < 80%</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px;">✅</span>
                    <span>0 jour sans crédit</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px;">⚠️</span>
                    <span>1-20% sans crédit</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 12px;">🔴</span>
                    <span>>20% sans crédit</span>
                </div>
            </div>
        </div>
    `;
}

// ======================== FONCTION CRÉDIT CARD MODIFIÉE AVEC TABLEAU MENSUEL ========================
function createCreditCard(clientId) {
    const clientNumber = parseInt(clientId).toString().padStart(2, '0');

    // Analyser les jours sans crédit pour ce client
    const creditAnalysis = analyzeClientCreditDays(clientId);
    
    // Récupérer les données de crédit complètes pour le graphique
    const creditData = creditResultsByClient[clientId];
    
    // ANALYSE MENSUELLE - NOUVEAU
    const monthlyStats = analyzeMonthlyCredit(creditData, clientId);
    
    // Calculer quelques statistiques pour le résumé
    const totalDays = creditAnalysis.totalDaysWithoutCredit;
    const significantStreaks = creditAnalysis.significantStreaks;
    const longestStreak = creditAnalysis.longestStreak;
    
    // Calculer le crédit moyen (hors zéros)
    let avgCredit = 0;
    let totalCredit = 0;
    let creditCount = 0;
    
    if (creditData && creditData.results) {
        creditData.results.forEach(item => {
            const val = parseFloat(item.credit || item.valeur || 0);
            if (val > 0) {
                totalCredit += val;
                creditCount++;
            }
        });
        avgCredit = creditCount > 0 ? (totalCredit / creditCount).toFixed(1) : 0;
    }
    
    // Déterminer le niveau de risque
    let riskLevel = 'faible';
    let riskColor = '#22c55e';
    let riskIcon = '✅';
    
    if (totalDays > 20 || longestStreak > 7) {
        riskLevel = 'élevé';
        riskColor = '#ef4444';
        riskIcon = '🔴';
    } else if (totalDays > 10 || longestStreak > 3) {
        riskLevel = 'moyen';
        riskColor = '#f59e0b';
        riskIcon = '⚠️';
    }

    return `
        <!-- CARTE CRÉDIT DU CLIENT AVEC GRAPHIQUE ET TABLEAU MENSUEL -->
        <div style="background: white; border-radius: 16px; border: 2px solid #e2e8f0; margin: 25px 0; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.08);">
            
            <!-- En-tête avec le numéro du client -->
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px 22px; display: flex; align-items: center; gap: 12px;">
                <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
                    <span style="font-size: 22px;">💰</span>
                </div>
                <div>
                    <div style="font-weight: 700; font-size: 18px;">Crédit & Recharge - Client ${clientNumber}</div>
                    <div style="font-size: 12px; opacity: 0.9;">Suivi de l'évolution du crédit</div>
                </div>
                <div style="margin-left: auto; background: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 30px; font-size: 13px; font-weight: 600;">
                    📊 ${creditCount} relevés
                </div>
            </div>
            
            <!-- GRAPHIQUE D'ÉVOLUTION DU CRÉDIT -->
            <div style="padding: 0;">
                ${createCreditChart(creditData, clientId)}
            </div>
            
            <!-- TABLEAU D'ANALYSE MENSUELLE - NOUVEAU -->
            <div style="padding: 20px; border-top: 1px solid #e2e8f0;">
                ${createMonthlyCreditTable(monthlyStats)}
            </div>
            
            <!-- RÉSUMÉ STATISTIQUE -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 15px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                <div style="text-align: center;">
                    <div style="font-size: 11px; color: #64748b;">Crédit moyen</div>
                    <div style="font-size: 22px; font-weight: 700; color: #f59e0b;">${avgCredit}j</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 11px; color: #64748b;">Jours sans crédit</div>
                    <div style="font-size: 22px; font-weight: 700; color: ${totalDays > 0 ? '#ef4444' : '#22c55e'};">${totalDays}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 11px; color: #64748b;">Plus longue série</div>
                    <div style="font-size: 22px; font-weight: 700; color: ${longestStreak > 3 ? '#ef4444' : '#f59e0b'};">${longestStreak}j</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 11px; color: #64748b;">Risque</div>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 5px;">
                        <span style="font-size: 18px;">${riskIcon}</span>
                        <span style="font-weight: 700; color: ${riskColor};">${riskLevel.toUpperCase()}</span>
                    </div>
                </div>
            </div>
            
            <!-- SÉRIES SANS CRÉDIT (version compacte) -->
            ${significantStreaks.length > 0 ? `
            <div style="padding: 16px 20px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <span style="font-size: 16px;">🔗</span>
                    <span style="font-weight: 600; color: #1e293b; font-size: 14px;">Périodes sans crédit</span>
                    <span style="background: #f1f5f9; color: #475569; padding: 2px 10px; border-radius: 30px; font-size: 11px;">${significantStreaks.length} série(s)</span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                    ${significantStreaks.slice(0, 5).map((streak, index) => {
                        const isLongest = streak.days === longestStreak;
                        return `
                            <div style="flex: 1 1 180px; background: white; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden;">
                                <div style="background: ${isLongest ? '#ef4444' : '#f59e0b'}; padding: 6px 12px; display: flex; justify-content: space-between;">
                                    <span style="color: white; font-weight: 600; font-size: 11px;">Série ${index + 1}</span>
                                    ${isLongest ? '<span style="background: white; color: #ef4444; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 700;">MAX</span>' : ''}
                                </div>
                                <div style="padding: 10px;">
                                    <div style="font-size: 20px; font-weight: 800; color: ${isLongest ? '#ef4444' : '#f59e0b'};">${streak.days} jours</div>
                                    <div style="font-size: 11px; color: #64748b; font-family: monospace;">${streak.startDate} → ${streak.endDate}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                ${significantStreaks.length > 5 ? `<div style="margin-top: 10px; font-size: 11px; color: #94a3b8; text-align: center;">+ ${significantStreaks.length - 5} autre(s) série(s)</div>` : ''}
            </div>
            ` : `
            <div style="padding: 20px; text-align: center; background: #f8fafc;">
                <span style="font-size: 48px; display: block; margin-bottom: 10px; color: #94a3b8;">✅</span>
                <span style="color: #64748b; font-size: 13px;">Aucune période sans crédit (>1 jour) détectée</span>
            </div>
            `}
            
            <!-- Pied de carte -->
            <div style="padding: 12px 22px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; display: flex; justify-content: space-between;">
                <span>📈 Graphique: Évolution du crédit (jours) | 📊 Analyse mensuelle</span>
                <span>Client ${clientNumber} · Dernière analyse: ${new Date().toLocaleDateString('fr-FR')}</span>
            </div>
        </div>
    `;
}

function displayClientEventsTab(clientId) {
    console.log(`🔍 ===== DÉBUT displayClientEventsTab pour client ${clientId} =====`);

    const clientEvents = [];

    // Convertir l'ID client en nombre pour la comparaison
    const targetClientNum = parseInt(clientId, 10);

    // 1. Chercher dans les fichiers EC globaux
    if (window.ecFiles && window.ecFiles.length > 0) {
        window.ecFiles.forEach(file => {
            try {
                const results = analyzeECSimple(file.content);

                // Filtrer les événements qui appartiennent au client cible
                const clientSpecificEvents = results.filter(event => {
                    return event.Client === targetClientNum;
                });

                if (clientSpecificEvents.length > 0) {
                    const enrichedResults = clientSpecificEvents.map(result => ({
                        ...result,
                        sourceFile: file.name
                    }));

                    clientEvents.push(...enrichedResults);
                }
            } catch (error) {
                console.error(`❌ Erreur analyse EC pour client ${clientId}:`, error);
            }
        });
    }

    // 2. Chercher dans les fichiers ENR pour les événements DP/DT
    if (window.enrFiles && window.enrFiles.length > 0) {
        window.enrFiles.forEach(file => {
            try {
                const results = analyzeENRSimple(file.content);

                // Pour ENR, on cherche les événements DP/DT
                const dpdtEvents = results.filter(event => {
                    const analysis = event['Analyse État'] || '';
                    return analysis.includes('DP') || analysis.includes('DT');
                });

                if (dpdtEvents.length > 0) {
                    const enrichedResults = dpdtEvents.map(result => ({
                        ...result,
                        sourceFile: file.name,
                        client: '00',
                        Client: 0
                    }));

                    clientEvents.push(...enrichedResults);
                }
            } catch (error) {
                console.error(`❌ Erreur analyse ENR pour client ${clientId}:`, error);
            }
        });
    }

    // Si aucun événement trouvé pour CE CLIENT SPÉCIFIQUE
    if (clientEvents.length === 0) {
        return `
            <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; margin: 20px 0; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 12px 16px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 18px;">📊</span>
                        <h4 style="margin: 0; font-size: 14px; font-weight: 600;">Événements Client ${parseInt(clientId).toString().padStart(2, '0')}</h4>
                    </div>
                </div>
                <div style="padding: 30px; text-align: center; background: #f8fafc;">
                    <span style="font-size: 48px; display: block; margin-bottom: 15px; color: #94a3b8;">✅</span>
                    <span style="color: #64748b; font-size: 14px; font-weight: 500;">Aucun événement détecté</span>
                    <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 12px;">Aucun événement (surcharge, crédit nul, suspend P/E) pour ce client</p>
                </div>
            </div>
        `;
    }

    // Trier les événements par date/heure
    clientEvents.sort((a, b) => {
        const dateA = new Date(a.Date.split('/').reverse().join('-') + 'T' + (a.Heure || '00:00'));
        const dateB = new Date(b.Date.split('/').reverse().join('-') + 'T' + (b.Heure || '00:00'));
        return dateA - dateB;
    });

    // Grouper les événements par date
    const eventsByDate = {};
    clientEvents.forEach(event => {
        if (!eventsByDate[event.Date]) {
            eventsByDate[event.Date] = [];
        }
        eventsByDate[event.Date].push(event);
    });

    // Calculer le nombre de JOURS avec événements
    const daysWithEvents = Object.keys(eventsByDate).length;

    // Statistiques par type d'événement (pour le tableau de bord - en JOURS)
    const eventStatsByDays = {
        'SURCHARGE': { days: new Set(), color: '#FF6B6B', icon: '⚡' },
        'CRÉDIT NUL': { days: new Set(), color: '#FFD93D', icon: '💰' },
        'PUISSANCE DÉPASSÉE': { days: new Set(), color: '#6BCEF5', icon: '📈' },
        'ÉNERGIE ÉPUISÉE': { days: new Set(), color: '#FF8B94', icon: '🔋' },
    };

    clientEvents.forEach(event => {
        const type = event['Analyse État'] || event.type || 'NORMAL';
        if (eventStatsByDays[type]) {
            eventStatsByDays[type].days.add(event.Date);
        }
    });

    // Fonction pour grouper les événements en périodes
    function groupEventsIntoPeriods(events) {
        if (events.length === 0) return [];

        const periods = [];
        let currentPeriod = {
            debut: events[0].Heure || '00:00',
            fin: events[0].Heure || '00:00',
            events: [events[0]]
        };

        for (let i = 1; i < events.length; i++) {
            const currentEvent = events[i];
            const lastEventTime = convertTimeToMinutes(currentPeriod.fin);
            const currentEventTime = convertTimeToMinutes(currentEvent.Heure || '00:00');

            // Si l'écart est <= 30 minutes, on continue la période
            if (currentEventTime - lastEventTime <= 30) {
                currentPeriod.fin = currentEvent.Heure || '00:00';
                currentPeriod.events.push(currentEvent);
            } else {
                // Nouvelle période
                periods.push(currentPeriod);
                currentPeriod = {
                    debut: currentEvent.Heure || '00:00',
                    fin: currentEvent.Heure || '00:00',
                    events: [currentEvent]
                };
            }
        }

        periods.push(currentPeriod);
        return periods;
    }

    // Fonction utilitaire pour convertir l'heure en minutes
    function convertTimeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours || 0) * 60 + (minutes || 0);
    }

    // Fonction pour formater la durée
    function formatDuration(minutes) {
        if (minutes < 60) {
            return `${minutes}mn`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return mins > 0 ? `${hours}h${mins.toString().padStart(2, '0')}mn` : `${hours}h`;
        }
    }

    // Préparer les données pour le tableau
    const sortedDates = Object.keys(eventsByDate).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateB - dateA; // Plus récent en premier
    });

    // Types d'événements dans l'ordre
    const eventTypes = ['PUISSANCE DÉPASSÉE', 'SURCHARGE', 'CRÉDIT NUL', 'ÉNERGIE ÉPUISÉE'];
    const typeColors = {
        'PUISSANCE DÉPASSÉE': '#6BCEF5',
        'SURCHARGE': '#FF6B6B',
        'CRÉDIT NUL': '#FFD93D',
        'ÉNERGIE ÉPUISÉE': '#FF8B94',
    };

    // Créer les lignes du tableau
    let tableRows = '';

    sortedDates.forEach(date => {
        const dayEvents = eventsByDate[date];

        // Grouper les événements par type
        const eventsByType = {};
        dayEvents.forEach(event => {
            const type = event['Analyse État'] || event.type || 'NORMAL';
            if (!eventsByType[type]) {
                eventsByType[type] = [];
            }
            eventsByType[type].push(event);
        });

        // Pour chaque type, créer des périodes
        const typePeriods = {};
        eventTypes.forEach(type => {
            if (eventsByType[type]) {
                // Trier par heure
                const sortedTypeEvents = eventsByType[type].sort((a, b) => {
                    return convertTimeToMinutes(a.Heure || '00:00') - convertTimeToMinutes(b.Heure || '00:00');
                });
                typePeriods[type] = groupEventsIntoPeriods(sortedTypeEvents);
            } else {
                typePeriods[type] = [];
            }
        });

        // Déterminer le nombre maximum de périodes pour cette date
        const maxPeriods = Math.max(...eventTypes.map(type => typePeriods[type].length));

        // Créer les lignes pour cette date
        for (let i = 0; i < maxPeriods; i++) {
            let rowHtml = `<tr>`;

            // Colonne Date (seulement sur la première ligne)
            if (i === 0) {
                rowHtml += `<td rowspan="${maxPeriods}" style="padding: 12px; font-weight: 600; background: #f8fafc; border-right: 1px solid #e2e8f0; vertical-align: middle;">${date}</td>`;
            }

            // Pour chaque type d'événement
            eventTypes.forEach(type => {
                const periods = typePeriods[type];
                const color = typeColors[type] || '#64748b';

                if (i < periods.length) {
                    const period = periods[i];
                    const debutMinutes = convertTimeToMinutes(period.debut);
                    const finMinutes = convertTimeToMinutes(period.fin);
                    const dureeMinutes = finMinutes - debutMinutes;
                    const duree = dureeMinutes < 60 ?
                        `${dureeMinutes}mn` :
                        `${Math.floor(dureeMinutes / 60)}h${(dureeMinutes % 60).toString().padStart(2, '0')}mn`;

                    rowHtml += `
                        <td style="padding: 8px; text-align: center; color: ${color}; font-weight: 600; background: ${color}08;">${period.debut}</td>
                        <td style="padding: 8px; text-align: center; color: ${color}; font-weight: 600; background: ${color}08;">${period.fin}</td>
                        <td style="padding: 8px; text-align: center; color: ${color}; font-weight: 700; background: ${color}12;">${duree}</td>
                    `;
                } else {
                    rowHtml += `
                        <td style="padding: 8px; text-align: center; color: #cbd5e1; background: #fafafa;">-</td>
                        <td style="padding: 8px; text-align: center; color: #cbd5e1; background: #fafafa;">-</td>
                        <td style="padding: 8px; text-align: center; color: #cbd5e1; background: #fafafa;">-</td>
                    `;
                }
            });

            rowHtml += `</tr>`;
            tableRows += rowHtml;
        }
    });

    // Générer un ID unique pour ce client
    const containerId = `client-events-${clientId}`;
    const tableId = `client-events-table-${clientId}`;

    // Retourner le HTML avec un ID unique pour le script
    return `
        <div id="${containerId}" style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; margin: 20px 0; overflow: hidden;">
            
            <!-- En-tête avec bouton -->
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 12px 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 18px;">📊</span>
                        <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Événements - Client ${parseInt(clientId).toString().padStart(2, '0')}</h3>
                    </div>
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <span style="background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 12px;">📅 ${daysWithEvents} jour(s)</span>
                        <span style="background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 12px;">📊 ${clientEvents.length} événement(s)</span>
                        <button id="toggle-${tableId}" 
                                data-table-id="${tableId}"
                                style="background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
                            <span style="font-size: 12px;">🔽</span>
                            <span>Afficher le tableau</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Mini tableau de bord : Nombre de JOURS avec événements (toujours visible) -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 15px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                ${Object.entries(eventStatsByDays).map(([type, data]) => `
                    <div style="text-align: center;">
                        <div style="font-size: 20px; margin-bottom: 4px;">${data.icon}</div>
                        <div style="font-size: 16px; font-weight: 700; color: ${data.color};">${data.days.size}</div>
                        <div style="font-size: 9px; color: #64748b;">${type}</div>
                    </div>
                `).join('')}
            </div>

            <!-- Tableau (caché par défaut) -->
            <div id="${tableId}" style="max-height: 350px; overflow-y: auto; overflow-x: auto; display: none;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; min-width: 1300px;">
                    <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 10;">
                        <tr>
                            <th style="padding: 12px; text-align: left; background: #f1f5f9;">📅 Date</th>
                            <th colspan="3" style="padding: 12px; text-align: center; background: #e0f2fe; color: #0369a1;">PUISSANCE DÉPASSÉE</th>
                            <th colspan="3" style="padding: 12px; text-align: center; background: #fee2e2; color: #b91c1c;">SURCHARGE</th>
                            <th colspan="3" style="padding: 12px; text-align: center; background: #fef9c3; color: #854d0e;">CRÉDIT NUL</th>
                            <th colspan="3" style="padding: 12px; text-align: center; background: #fae8ff; color: #86198f;">ÉNERGIE ÉPUISÉE</th>
                        </tr>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 8px;"></th>
                            <th style="padding: 8px;">Début</th><th style="padding: 8px;">Fin</th><th style="padding: 8px;">Durée</th>
                            <th style="padding: 8px;">Début</th><th style="padding: 8px;">Fin</th><th style="padding: 8px;">Durée</th>
                            <th style="padding: 8px;">Début</th><th style="padding: 8px;">Fin</th><th style="padding: 8px;">Durée</th>
                            <th style="padding: 8px;">Début</th><th style="padding: 8px;">Fin</th><th style="padding: 8px;">Durée</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}
// Fonction pour initialiser tous les boutons de toggle des événements clients
function initializeClientEventsToggles() {
    setTimeout(() => {
        console.log('🔧 Initialisation des boutons de toggle pour les événements clients');
        
        // Trouver tous les boutons de toggle
        document.querySelectorAll('[id^="toggle-client-events-table-"]').forEach(button => {
            // Éviter de dupliquer les événements
            button.removeEventListener('click', handleClientEventsToggle);
            button.addEventListener('click', handleClientEventsToggle);
        });
    }, 200);
}

// Gestionnaire d'événements pour les boutons
function handleClientEventsToggle(event) {
    const button = event.currentTarget;
    const tableId = button.getAttribute('data-table-id');
    const table = document.getElementById(tableId);
    
    console.log(`🔘 Bouton cliqué - tableId: ${tableId}, table trouvée: ${!!table}`);
    
    if (table) {
        if (table.style.display === 'none') {
            table.style.display = 'block';
            button.innerHTML = '<span style="font-size: 12px;">🔼</span><span>Masquer le tableau</span>';
            button.style.background = 'rgba(255,255,255,0.35)';
            console.log(`✅ Tableau ${tableId} affiché`);
        } else {
            table.style.display = 'none';
            button.innerHTML = '<span style="font-size: 12px;">🔽</span><span>Afficher le tableau</span>';
            button.style.background = 'rgba(255,255,255,0.25)';
            console.log(`✅ Tableau ${tableId} masqué`);
        }
    } else {
        console.error(`❌ Tableau avec ID ${tableId} non trouvé`);
    }
}
// Fonction principale d'affichage des données client
function displayClientData(clientId, clientData) {
    const contentElement = document.getElementById(`sub-content-${clientId}`);
    if (!contentElement) return;

    const dailySummary = dailySummaryByClient[clientId] || [];
    const clientNumber = parseInt(clientId).toString().padStart(2, '0');

    contentElement.innerHTML = `
        <!-- PARTIE COMMERCIALE PRINCIPALE -->
        ${generateCommercialView(clientId)}

        <!-- TABLEAU DES ÉVÉNEMENTS -->
        ${displayClientEventsTab(clientId)}

        <!-- CARTE CRÉDIT & RECHARGE DU CLIENT -->
        ${createCreditCard(clientId)}

        <!-- TABLEAU RÉSUMÉ JOURNALIER (AVEC BOUTON) -->
        ${dailySummary.length > 0 ? displayDailySummaryTable(clientId, dailySummary) :
            '<div style="text-align: center; padding: 30px; background: #f8fafc; border-radius: 8px; color: #64748b;">Aucune donnée journalière disponible</div>'
        }  
    `;

    // Initialiser les boutons après l'ajout du HTML
    setTimeout(() => {
        initializeTableToggles();
        initializeClientEventsToggles();
    }, 100);
}
// ======================== FONCTION GLOBALE ========================
// Initialise les boutons de toggle pour les tableaux
function initializeTableToggles() {
    // Attendre un peu que le DOM soit complètement chargé
    setTimeout(() => {
        // Trouver tous les boutons de toggle
        document.querySelectorAll('[id^="toggle-table-"]').forEach(button => {
            // Éviter de dupliquer les événements
            button.removeEventListener('click', handleTableToggle);
            button.addEventListener('click', handleTableToggle);
        });
    }, 200);
}

// Gestionnaire d'événements pour les boutons
function handleTableToggle(event) {
    const button = event.currentTarget;
    const buttonId = button.id;

    // Extraire l'ID du client du bouton (format: "toggle-table-clientId")
    const clientId = buttonId.replace('toggle-table-', '');
    const tableId = `daily-summary-table-${clientId}`;
    const table = document.getElementById(tableId);

    if (table) {
        if (table.style.display === 'none') {
            // Afficher le tableau
            table.style.display = 'block';
            button.innerHTML = '<span style="font-size: 18px;">🔼</span><span>Masquer le tableau détaillé</span>';
            button.style.background = 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
        } else {
            // Cacher le tableau
            table.style.display = 'none';

            // Compter le nombre de jours
            const totalItems = table.querySelector('.page-info .items-info')?.textContent.match(/\d+/) || [0];
            const count = totalItems[0];

            button.innerHTML = `<span style="font-size: 18px;">🔽</span><span>Afficher le tableau détaillé (${count} jour${count != 1 ? 's' : ''})</span>`;
            button.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        }
    }
}

// Appeler cette fonction après chaque mise à jour du contenu
function afterClientDataDisplay() {
    initializeTableToggles();
}
// ======================== ANALYSE DE CRÉDIT POUR un CLIENT ========================
function displayClientCreditAnalysis(clientId) {
    console.log(`🔍 Affichage analyse crédit pour client ${clientId}`);

    const targetClientNum = parseInt(clientId, 10);
    const creditData = [];
    const daysWithoutCredit = [];
    const consecutiveGroups = [];

    // Récupérer les données de crédit pour ce client
    if (window.creditResultsByClient && window.creditResultsByClient[clientId] &&
        window.creditResultsByClient[clientId].results) {

        const results = window.creditResultsByClient[clientId].results;

        // Trier par date/heure
        results.sort((a, b) => {
            const dateA = new Date(a.date.split('/').reverse().join('-') + 'T' + a.heure);
            const dateB = new Date(b.date.split('/').reverse().join('-') + 'T' + b.heure);
            return dateA - dateB; // Chronologique pour détecter les séries
        });

        // Collecter toutes les données
        let maxCredit = 0;
        const uniqueDays = new Set();
        let totalCreditSum = 0;
        let creditCount = 0;

        results.forEach(item => {
            const creditValue = parseFloat(item.credit || item.valeur || 0);
            const dateStr = item.date;
            uniqueDays.add(dateStr);

            creditData.push({
                date: dateStr,
                dateObj: new Date(dateStr.split('/').reverse().join('-')),
                credit: creditValue
            });

            // Statistiques
            if (creditValue > 0) {
                if (creditValue > maxCredit) {
                    maxCredit = creditValue;
                }
                totalCreditSum += creditValue;
                creditCount++;
            }

            // Si c'est un jour sans crédit (valeur = 0)
            if (creditValue === 0) {
                daysWithoutCredit.push({
                    date: dateStr,
                    formattedDate: new Date(dateStr.split('/').reverse().join('-')).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric'
                    })
                });
            }
        });

        // Calculer les métriques
        const totalDaysAnalyzed = uniqueDays.size;
        const uniqueDaysWithoutCredit = new Set(daysWithoutCredit.map(d => d.date)).size;
        const avgCredit = creditCount > 0 ? (totalCreditSum / creditCount).toFixed(1) : 0;
        const creditReliability = totalDaysAnalyzed > 0
            ? Math.round(((totalDaysAnalyzed - uniqueDaysWithoutCredit) / totalDaysAnalyzed) * 100)
            : 0;

        // Déterminer le profil de crédit
        let creditProfile = "";
        let profileColor = "";
        let profileIcon = "";
        let commercialAdvice = "";

        if (uniqueDaysWithoutCredit === 0) {
            creditProfile = "Excellent";
            profileColor = "#22c55e";
            profileIcon = "✅";
            commercialAdvice = "Client très fiable, jamais de coupure.";
        } else if (creditReliability >= 90) {
            creditProfile = "Bon";
            profileColor = "#3b82f6";
            profileIcon = "👍";
            commercialAdvice = "Bonne gestion du crédit, interruptions rares.";
        } else if (creditReliability >= 75) {
            creditProfile = "Moyen";
            profileColor = "#f59e0b";
            profileIcon = "⚠️";
            commercialAdvice = "Quelques interruptions du crédit.";
        } else {
            creditProfile = "Fragile";
            profileColor = "#ef4444";
            profileIcon = "🔴";
            commercialAdvice = "Risque élevé de coupures";
        }

        // Détecter les séries consécutives
        let currentGroup = [];

        for (let i = 0; i < creditData.length; i++) {
            const current = creditData[i];

            if (current.credit === 0) {
                currentGroup.push(current);
            } else {
                if (currentGroup.length > 0) {
                    consecutiveGroups.push([...currentGroup]);
                    currentGroup = [];
                }
            }
        }

        // Ajouter le dernier groupe si nécessaire
        if (currentGroup.length > 0) {
            consecutiveGroups.push([...currentGroup]);
        }

        // Filtrer pour garder uniquement les groupes > 1 jour
        const significantGroups = consecutiveGroups.filter(group => group.length > 1);

        // Trouver la série maximale
        let longestStreak = 0;
        let longestStreakDates = [];

        significantGroups.forEach(group => {
            if (group.length > longestStreak) {
                longestStreak = group.length;
                longestStreakDates = group;
            }
        });

        // Créer la phrase de synthèse
        const synthesePhrase = `👉 Ce client a eu ${uniqueDaysWithoutCredit} jour(s) sans crédit sur ${totalDaysAnalyzed} jours analysés, avec un crédit maximum de ${maxCredit.toFixed(2)} jours.`;

        // Créer le HTML
        return `
            <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; margin: 20px 0; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                
                <!-- En-tête -->
                <div style="background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); color: white; padding: 15px 20px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 28px;">🚫</span>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 18px; font-weight: 700;">Jours sans crédit</h3>
                            <p style="margin: 2px 0 0 0; font-size: 13px; opacity: 0.9;">Client ${parseInt(clientId).toString().padStart(2, '0')}</p>
                        </div>
                    </div>
                </div>
                
                <!-- PHRASE DE SYNTHÈSE CLIENT -->
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="background: #f43f5e; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 18px; color: white;">📌</span>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Synthèse client</div>
                            <div style="font-size: 13px; color: #334155;">
                                ${synthesePhrase}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- ANALYSE COMMERCIALE -->
                <div style="background: linear-gradient(135deg, ${profileColor}10 0%, #ffffff 100%); padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 28px;">${profileIcon}</span>
                            <div>
                                <div style="font-size: 11px; color: #64748b;">Profil de crédit</div>
                                <div style="font-size: 18px; font-weight: 700; color: ${profileColor};">${creditProfile}</div>
                            </div>
                        </div>
                        <div style="width: 1px; height: 40px; background: #e2e8f0;"></div>
                        <div style="flex: 1;">
                            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">💡 Analyse commerciale</div>
                            <div style="font-size: 13px; color: #334155; line-height: 1.5;">
                                ${commercialAdvice}
                            </div>
                        </div>
                        <div style="background: ${profileColor}; color: white; padding: 8px 16px; border-radius: 30px; font-size: 20px; font-weight: 700;">
                            ${creditReliability}%
                        </div>
                    </div>
                </div>
                
                <!-- Statistiques clés -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <div style="text-align: center;">
                        <div style="font-size: 11px; color: #64748b;">Jours sans crédit</div>
                        <div style="font-size: 24px; font-weight: 700; color: #e11d48;">${uniqueDaysWithoutCredit}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 11px; color: #64748b;">Crédit moyen</div>
                        <div style="font-size: 24px; font-weight: 700; color: #2c3e50;">${avgCredit}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 11px; color: #64748b;">Crédit max</div>
                        <div style="font-size: 24px; font-weight: 700; color: #2c3e50;">${maxCredit.toFixed(1)}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 11px; color: #64748b;">Fiabilité</div>
                        <div style="font-size: 24px; font-weight: 700; color: ${profileColor};">${creditReliability}%</div>
                    </div>
                </div>
                
                <!-- Série max (si existe) -->
                ${longestStreak > 0 ? `
                <div style="padding: 0 20px 10px 20px; margin-top: 5px;">
                    <div style="background: #fff7ed; border-radius: 8px; padding: 10px 15px; display: flex; align-items: center; gap: 10px; border-left: 4px solid #f97316;">
                        <span style="font-size: 20px;">🔴</span>
                        <span style="font-size: 13px; color: #7c2d12;">
                            <strong>Attention :</strong> Plus longue période sans crédit : <strong>${longestStreak} jour(s) consécutifs</strong>
                        </span>
                    </div>
                </div>
                ` : ''}
                
                <!-- Liste des jours sans crédit -->
                <div style="padding: 20px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span style="font-size: 18px;">📋</span>
                        <span style="font-weight: 600; color: #334155; font-size: 14px;">Liste des jours sans crédit</span>
                    </div>
                    
                    ${daysWithoutCredit.length > 0 ? `
                        <div style="max-height: 150px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${daysWithoutCredit.slice(0, 50).map(day => `
                                    <span style="background: #f1f5f9; padding: 5px 12px; border-radius: 20px; font-size: 12px; color: #475569; border-left: 3px solid #ef4444;">
                                        ${day.formattedDate}
                                    </span>
                                `).join('')}
                                ${daysWithoutCredit.length > 50 ? `
                                    <span style="background: #f1f5f9; padding: 5px 12px; border-radius: 20px; font-size: 12px; color: #64748b; font-style: italic;">
                                        + ${daysWithoutCredit.length - 50} autre(s)
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 20px; background: #f8fafc; border-radius: 8px; color: #64748b;">
                            ✅ Aucun jour sans crédit détecté
                        </div>
                    `}
                </div>
                
                <!-- Séries consécutives -->
                ${significantGroups.length > 0 ? `
                <div style="padding: 0 20px 20px 20px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span style="font-size: 18px;">🔗</span>
                        <span style="font-weight: 600; color: #334155; font-size: 14px;">Séries consécutives sans crédit (>1 jour)</span>
                    </div>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                        ${significantGroups.map((group, idx) => {
            const startDate = new Date(group[0].date.split('/').reverse().join('-')).toLocaleDateString('fr-FR');
            const endDate = new Date(group[group.length - 1].date.split('/').reverse().join('-')).toLocaleDateString('fr-FR');
            const isLongest = group.length === longestStreak;

            return `
                                <div style="background: white; padding: 12px 16px; border-radius: 10px; border-left: 4px solid ${isLongest ? '#ef4444' : '#f97316'}; min-width: 200px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Série ${idx + 1}</div>
                                    <div style="font-weight: 700; color: ${isLongest ? '#ef4444' : '#f97316'}; font-size: 20px;">${group.length} jour(s)</div>
                                    <div style="font-size: 12px; color: #475569; margin: 6px 0;">${startDate} → ${endDate}</div>
                                    ${isLongest ? '<span style="background: #ef4444; color: white; padding: 3px 12px; border-radius: 20px; font-size: 10px; display: inline-block; font-weight: 600;">SÉRIE MAX</span>' : ''}
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
                ` : ''}
                
            </div>
        `;
    }

    // Si pas de données
    return `
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; margin: 20px 0; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); color: white; padding: 15px 20px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 18px;">🚫</span>
                    <h4 style="margin: 0; font-size: 14px; font-weight: 600;">Jours sans crédit - Client ${parseInt(clientId).toString().padStart(2, '0')}</h4>
                </div>
            </div>
            <div style="padding: 30px; text-align: center; background: #f8fafc;">
                <span style="font-size: 40px; display: block; margin-bottom: 10px; color: #94a3b8;">📭</span>
                <span style="color: #64748b; font-size: 13px;">Aucune donnée de crédit disponible pour ce client</span>
            </div>
        </div>
    `;
}

// Fonction utilitaire pour vérifier si un client a des événements
function checkClientEvents(clientId) {
    const targetClientNum = parseInt(clientId, 10);

    if (window.ecFiles && window.ecFiles.length > 0) {
        for (const file of window.ecFiles) {
            try {
                const results = analyzeECSimple(file.content);
                const clientSpecificEvents = results.filter(event => event.Client === targetClientNum);
                if (clientSpecificEvents.length > 0) return true;
            } catch (error) {
                // Ignorer
            }
        }
    }

    if (window.enrFiles && window.enrFiles.length > 0) {
        for (const file of window.enrFiles) {
            try {
                const results = analyzeENRSimple(file.content);
                // Vérifier si le client a des événements (DP/DT)
                // À adapter selon votre logique
            } catch (error) {
                // Ignorer
            }
        }
    }

    return false;
}

// ======================== FONCTION À MODIFIER ========================
// Définit les limites des forfaits (max en Wh)
function getLocalForfaitLimits(forfaitName) {
    const FORFAITS_LOCAL = {
        "ECO": { max: 50, heures: 5 },
        "ECLAIRAGE": { max: 90, heures: 5 },
        "ECLAIRAGE +": { max: 150, heures: 5 },
        "MULTIMEDIA": { max: 210, heures: 5 },
        "MULTIMEDIA +": { max: 210, heures: 5 },
        "ECLAIRAGE PUBLIC": { max: 150, heures: 11 },
        "Eclairage Public 5h": { max: 150, heures: 5 },
        "Eclairage Public Pref": { max: 150, heures: 11 },
        "Eclairage + PREF": { max: 150, heures: 11 },
        "CONGEL": { max: 1250, heures: 24 },
        "CONGEL -5°C": { max: 1250, heures: 24 },
        "CONGEL -10°C": { max: 1250, heures: 24 },
        "FRIGO": { max: 500, heures: 24 },
        "PRENIUM": { max: 500, heures: 24 },
        "CSB": { max: 1250, heures: 24 },
        "CSB Congel": { max: 1250, heures: 24 }
    };

    // Alias pour les noms qui peuvent varier
    const FORFAIT_ALIAS = {
        "FREEZER 1": "CONGEL",
        "FREEZER 3": "CONGEL"
    };

    // Vérifier les alias d'abord
    if (FORFAIT_ALIAS[forfaitName]) {
        forfaitName = FORFAIT_ALIAS[forfaitName];
    }

    const key = (forfaitName || 'ECO').toUpperCase();
    return FORFAITS_LOCAL[key] || FORFAITS_LOCAL.ECO;
}

// ======================== FONCTION POUR LE GRAPHIQUE HORAIRE CLIENT ========================
function createClientHourlyEnergyChart(clientId) {
    const clientData = allResultsByClient[clientId];
    if (!clientData || !clientData.combinedHourlyData || clientData.combinedHourlyData.length === 0) {
        return `
            <div class="no-data-mini" style="text-align:center; padding:20px; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1; margin:15px 0;">
                <span style="font-size:24px; display:block; margin-bottom:8px;">📊</span>
                <span style="color:#64748b; font-size:13px;">Pas assez de données pour générer le graphique horaire</span>
            </div>
        `;
    }

    // Préparer les données horaires (moyenne par heure sur toute la période)
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    clientData.combinedHourlyData.forEach(item => {
        if (item.energie && item.energie > 0 && item.heure) {
            // Extraire l'heure du format "HHhMM" ou "HH:MM"
            let hour = parseInt(item.heure.split('h')[0]) || parseInt(item.heure.split(':')[0]);
            if (!isNaN(hour) && hour >= 0 && hour < 24) {
                hourlyAverages[hour] += parseFloat(item.energie);
                hourlyCounts[hour]++;
            }
        }
    });

    // Calculer les moyennes
    for (let i = 0; i < 24; i++) {
        if (hourlyCounts[i] > 0) {
            hourlyAverages[i] = Math.round(hourlyAverages[i] / hourlyCounts[i]);
        }
    }

    // Trouver l'heure de pointe
    const maxEnergy = Math.max(...hourlyAverages);
    const peakHour = hourlyAverages.indexOf(maxEnergy);

    // Couleurs selon le niveau
    const barColors = hourlyAverages.map((value, index) => {
        if (value === 0) return '#94a3b8';
        if (index === peakHour && value > 0) return '#ef4444';
        return '#3b82f6';
    });

    // Créer un ID unique pour ce graphique
    const chartId = `client-${clientId}-hourly-chart-${Date.now()}`;

    // Retourner le HTML du conteneur avec un data attribute
    return `
        <div class="client-hourly-chart-container" data-chart-id="${chartId}" data-client-id="${clientId}" style="background:white; border-radius:16px; border:2px solid #e2e8f0; margin:20px 0; padding:20px; box-shadow:0 8px 20px rgba(0,0,0,0.05);">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:15px;">
                <div style="width:44px; height:44px; background:linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); border-radius:12px; display:flex; align-items:center; justify-content:center;">
                    <span style="font-size:24px; color:white;">⏰</span>
                </div>
                <div>
                    <h4 style="margin:0; font-size:18px; font-weight:700; color:#0f172a;">Profil Horaire de Consommation</h4>
                    <div style="font-size:12px; color:#64748b; margin-top:4px;">
                        Moyenne sur ${clientData.combinedHourlyData.length} points de mesure
                        ${peakHour > 0 ? ` · Pic à ${peakHour}h (${maxEnergy} Wh)` : ''}
                    </div>
                </div>
            </div>
            <div style="width:100%; height:250px;">
                <canvas id="${chartId}"></canvas>
            </div>
            <div style="display:flex; justify-content:center; gap:20px; margin-top:15px; padding-top:10px; border-top:1px solid #e2e8f0;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="width:12px; height:12px; background:#3b82f6; border-radius:4px;"></span>
                    <span style="font-size:11px; color:#475569;">Consommation moyenne (Wh)</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <span style="width:12px; height:12px; background:#ef4444; border-radius:4px;"></span>
                    <span style="font-size:11px; color:#475569;">Heure de pointe</span>
                </div>
            </div>
        </div>
    `;
}

// ======================== MISE À JOUR DU GRAPHIQUE CONTINU ========================
function updateClientContinuousChart(chartId, clientId, filteredDates) {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;

    const clientData = allResultsByClient[clientId];

    // Préparer les données en continu
    const continuousData = [];
    const labels = [];
    const dayMarkers = [];

    // Pour chaque date, créer 24 points (un par heure)
    filteredDates.forEach((date, dateIndex) => {
        // Initialiser un tableau de 24 heures pour cette date
        const hourData = new Array(24).fill(null);

        // Remplir avec les données disponibles
        clientData.combinedHourlyData.forEach(item => {
            if (item.date === date && item.energie && item.heure) {
                let hour = parseInt(item.heure.split('h')[0]) || parseInt(item.heure.split(':')[0]);
                if (!isNaN(hour) && hour >= 0 && hour < 24) {
                    hourData[hour] = parseFloat(item.energie);
                }
            }
        });

        // Ajouter les 24 points au tableau continu
        hourData.forEach((value, hour) => {
            continuousData.push(value);

            // Créer le label pour cette heure
            if (hour === 0) {
                // À minuit, on met la date complète
                labels.push(`${date}\n00h`);
            } else if (hour === 12) {
                // À midi, on met juste 12h
                labels.push(`12h`);
            } else {
                // Autres heures, on met juste l'heure
                labels.push(`${hour}h`);
            }
        });

        // Marquer le début de chaque nouveau jour
        dayMarkers.push({
            date: date,
            index: dateIndex * 24 // Index dans le tableau continu
        });
    });

    // Calculer la moyenne mobile (lissage)
    const smoothedData = continuousData.map((value, index) => {
        if (value === null || value === 0) return null;

        // Moyenne sur 3 points (l'heure précédente, actuelle, suivante)
        let sum = 0;
        let count = 0;

        for (let i = -1; i <= 1; i++) {
            const idx = index + i;
            if (idx >= 0 && idx < continuousData.length) {
                const val = continuousData[idx];
                if (val !== null && val > 0) {
                    sum += val;
                    count++;
                }
            }
        }

        return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
    });

    // Détruire l'ancien graphique
    const chartProperty = `chart_${chartId}`;
    if (window[chartProperty]) {
        window[chartProperty].destroy();
    }

    // Créer le graphique
    try {
        window[chartProperty] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Consommation horaire',
                        data: continuousData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        pointRadius: 2,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 1,
                        tension: 0.3,
                        fill: true,
                        spanGaps: true // Relie les points même s'il y a des trous
                    },
                    {
                        label: 'Moyenne mobile (lissée)',
                        data: smoothedData,
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        tension: 0.4,
                        fill: false,
                        spanGaps: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 12,
                        callbacks: {
                            title: (context) => {
                                const index = context[0].dataIndex;
                                const dayIndex = Math.floor(index / 24);
                                const hour = index % 24;
                                return `${filteredDates[dayIndex]} - ${hour}h00`;
                            },
                            label: (context) => {
                                const value = context.parsed.y;
                                if (value === null || value === 0) return 'Pas de données';
                                return `${context.dataset.label}: ${value} Wh`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Énergie (Wh)',
                            font: { size: 11, weight: 'bold' }
                        },
                        ticks: {
                            callback: (value) => value + ' Wh'
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Heure (continu)',
                            font: { size: 11, weight: 'bold' }
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 30,
                            font: { size: 9 },
                            callback: function (val, index) {
                                // Afficher un tick sur 4 pour éviter la surcharge
                                return index % 12 === 0 ? this.getLabelForValue(val) : '';
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        // Mettre à jour les marqueurs de jours
        const markersContainer = document.getElementById(`${chartId}-day-markers`);
        if (markersContainer) {
            markersContainer.innerHTML = dayMarkers.map(marker => `
                <div style="display:flex; align-items:center; gap:4px;">
                    <span style="width:8px; height:8px; background:#3b82f6; border-radius:2px;"></span>
                    <span style="font-weight:600;">${marker.date}</span>
                    <span style="color:#94a3b8;">(début)</span>
                </div>
            `).join('');
        }

        // Calculer les statistiques
        const validValues = continuousData.filter(v => v !== null && v > 0);
        const maxVal = Math.max(...validValues);
        const maxIndex = continuousData.indexOf(maxVal);
        const maxDayIndex = Math.floor(maxIndex / 24);
        const maxHour = maxIndex % 24;

        const avgVal = Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length);
        const totalConsumption = Math.round(validValues.reduce((a, b) => a + b, 0));

        console.log(`✅ Graphique continu mis à jour: ${filteredDates.length} jours`);
    } catch (error) {
        console.error(`❌ Erreur graphique:`, error);
    }
}
// ======================== FONCTIONS DE FILTRAGE ========================
function setClientContinuousRange(chartId, days) {
    const container = document.querySelector(`[data-chart-id="${chartId}"]`);
    if (!container) return;

    const clientId = container.getAttribute('data-client-id');
    const clientData = allResultsByClient[clientId];

    // Récupérer toutes les dates
    const allDates = [...new Set(clientData.combinedHourlyData.map(item => item.date))].sort((a, b) => {
        const [da, ma, ya] = a.split('/');
        const [db, mb, yb] = b.split('/');
        return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
    });

    // Filtrer les dates
    let filteredDates = allDates;
    if (days !== 'all') {
        const numDays = parseInt(days);
        filteredDates = allDates.slice(-numDays);
    }

    // Mettre à jour le style des boutons
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.style.background = '#fff';
        btn.style.color = '#334155';
        btn.style.border = '1px solid #cbd5e1';
    });

    const activeBtn = Array.from(container.querySelectorAll('.filter-btn')).find(
        btn => btn.textContent.includes(days === 'all' ? 'Tout' : days)
    );
    if (activeBtn) {
        activeBtn.style.background = '#3b82f6';
        activeBtn.style.color = 'white';
        activeBtn.style.border = '1px solid #2563eb';
    }

    // Mettre à jour le compteur
    const countSpan = document.getElementById(`${chartId}-date-count`);
    if (countSpan) {
        countSpan.textContent = `📅 ${filteredDates.length} jours`;
    }

    // Mettre à jour le graphique
    updateClientContinuousChart(chartId, clientId, filteredDates);
}
// ======================== TABLEAU DE BORD CLIENT ========================
function createClientDashboard(clientId) {
    const clientData = allResultsByClient[clientId];
    const dailySummary = dailySummaryByClient[clientId] || [];
    const forfaitName = clientData.forfait || 'ECO';
    const limits = getLocalForfaitLimits(forfaitName);
    const forfaitMax = limits.max;

    if (dailySummary.length === 0) {
        return '';
    }

    // Calculer les statistiques
    const energiesMax = dailySummary.map(d => d.energieMax || 0).filter(v => v > 0);
    const energiesMoyennes = dailySummary.map(d => d.energieMoyenne || 0).filter(v => v > 0);

    const energieMaxGlobale = Math.max(...energiesMax);
    const dateEnergieMax = dailySummary.find(d => d.energieMax === energieMaxGlobale)?.date || '-';

    const energieMoyenne = energiesMoyennes.length > 0
        ? Math.round(energiesMoyennes.reduce((a, b) => a + b, 0) / energiesMoyennes.length)
        : 0;

    const joursSansConso = dailySummary.filter(d => !d.energieMax || d.energieMax === 0).length;
    const joursAvecConso = dailySummary.filter(d => d.energieMax && d.energieMax > 0).length;

    // Calculs par rapport au forfait
    const joursDepasse90 = dailySummary.filter(d => {
        const energie = d.energieMax || 0;
        return energie > 0 && energie >= (forfaitMax * 0.9);
    }).length;

    const joursSous90 = dailySummary.filter(d => {
        const energie = d.energieMax || 0;
        return energie > 0 && energie < (forfaitMax * 0.9);
    }).length;

    // Calculs pour les tolérances
    const joursDansLimites = dailySummary.filter(d => {
        const energie = d.energieMax || 0;
        return energie > 0 && energie <= forfaitMax;
    }).length;

    const joursDansTolerance = dailySummary.filter(d => {
        const energie = d.energieMax || 0;
        return energie > 0 && energie > forfaitMax && energie <= (forfaitMax * 1.2);
    }).length;

    const joursHorsTolerance = dailySummary.filter(d => {
        const energie = d.energieMax || 0;
        return energie > 0 && energie > (forfaitMax * 1.2);
    }).length;

    const totalJoursAvecConso = joursDansLimites + joursDansTolerance + joursHorsTolerance;

    // Pourcentages
    const pourcentLimites = totalJoursAvecConso > 0
        ? Math.round((joursDansLimites / totalJoursAvecConso) * 100)
        : 0;

    const pourcentTolerance = totalJoursAvecConso > 0
        ? Math.round((joursDansTolerance / totalJoursAvecConso) * 100)
        : 0;

    const pourcentHorsTolerance = totalJoursAvecConso > 0
        ? Math.round((joursHorsTolerance / totalJoursAvecConso) * 100)
        : 0;

    return `
        <!-- PREMIER CARD : STATISTIQUES GLOBALES -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius:16px; padding:20px; margin-bottom:20px; color:white; box-shadow:0 10px 25px rgba(102,126,234,0.3);">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:15px;">
                <div style="width:40px; height:40px; background:rgba(255,255,255,0.2); border-radius:10px; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);">
                    <span style="font-size:22px;">📊</span>
                </div>
                <h4 style="margin:0; font-size:16px; font-weight:600;">Tableau de Bord Client</h4>
                <div style="margin-left:auto; background:rgba(255,255,255,0.2); padding:4px 12px; border-radius:20px; font-size:12px;">
                    Forfait: ${forfaitName} (${forfaitMax}Wh)
                </div>
            </div>

            <!-- Première ligne : 4 indicateurs clés -->
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:15px; margin-bottom:20px;">
                <div style="background:rgba(255,255,255,0.1); border-radius:12px; padding:15px; text-align:center; backdrop-filter:blur(4px);">
                    <div style="font-size:28px; font-weight:800;">${energieMaxGlobale}</div>
                    <div style="font-size:11px; opacity:0.9;">Énergie max (Wh)</div>
                    <div style="font-size:10px; margin-top:5px; background:rgba(255,255,255,0.2); display:inline-block; padding:2px 8px; border-radius:12px;">${dateEnergieMax}</div>
                </div>
                <div style="background:rgba(255,255,255,0.1); border-radius:12px; padding:15px; text-align:center; backdrop-filter:blur(4px);">
                    <div style="font-size:28px; font-weight:800;">${energieMoyenne}</div>
                    <div style="font-size:11px; opacity:0.9;">Énergie moyenne (Wh)</div>
                    <div style="font-size:10px; margin-top:5px;">sur ${energiesMoyennes.length} jours</div>
                </div>
                <div style="background:rgba(255,255,255,0.1); border-radius:12px; padding:15px; text-align:center; backdrop-filter:blur(4px);">
                    <div style="font-size:28px; font-weight:800;">${joursSansConso}</div>
                    <div style="font-size:11px; opacity:0.9;">Jours sans conso</div>
                    <div style="font-size:10px; margin-top:5px;">sur ${dailySummary.length} jours</div>
                </div>
                <div style="background:rgba(255,255,255,0.1); border-radius:12px; padding:15px; text-align:center; backdrop-filter:blur(4px);">
                    <div style="font-size:28px; font-weight:800;">${joursAvecConso}</div>
                    <div style="font-size:11px; opacity:0.9;">Jours avec conso</div>
                    <div style="font-size:10px; margin-top:5px;">${Math.round((joursAvecConso / dailySummary.length) * 100)}% du temps</div>
                </div>
            </div>

            <!-- Deuxième ligne : 2 indicateurs forfait -->
            <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:15px; margin-bottom:15px;">
                <div style="background:rgba(239,68,68,0.2); border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center; border-left:5px solid #ef4444;">
                    <div>
                        <div style="font-size:11px; opacity:0.9;">>90% du forfait</div>
                        <div style="font-size:24px; font-weight:700;">${joursDepasse90}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:20px;">⚡</div>
                        <div style="font-size:10px;">${Math.round((joursDepasse90 / joursAvecConso) * 100)}% des jours conso</div>
                    </div>
                </div>
                <div style="background:rgba(34,197,94,0.2); border-radius:12px; padding:15px; display:flex; justify-content:space-between; align-items:center; border-left:5px solid #22c55e;">
                    <div>
                        <div style="font-size:11px; opacity:0.9;"><90% du forfait</div>
                        <div style="font-size:24px; font-weight:700;">${joursSous90}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:20px;">✅</div>
                        <div style="font-size:10px;">${Math.round((joursSous90 / joursAvecConso) * 100)}% des jours conso</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- DEUXIÈME CARD : POURCENTAGES DE TOLÉRANCE -->
        <div style="background:white; border-radius:16px; padding:20px; margin-bottom:20px; border:2px solid #e2e8f0; box-shadow:0 5px 15px rgba(0,0,0,0.08);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
                <div style="width:36px; height:36px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                    <span style="font-size:18px;">📈</span>
                </div>
                <h5 style="margin:0; font-size:14px; font-weight:600; color:#334155;">Répartition de l'énergie consommée (${forfaitMax}Wh)</h5>
            </div>

            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:15px; margin-bottom:20px;">
                <!-- Dans les limites -->
                <div style="text-align:center;">
                    <div style="position:relative; width:100px; height:100px; margin:0 auto 10px;">
                        <canvas id="gauge-${clientId}-limits" width="100" height="100"></canvas>
                    </div>
                    <div style="font-size:20px; font-weight:700; color:#22c55e;">${pourcentLimites}%</div>
                    <div style="font-size:11px; color:#64748b;">Dans les limites</div>
                    <div style="font-size:10px; color:#94a3b8;">≤ ${forfaitMax}Wh</div>
                </div>

                <!-- Dans la tolérance -->
                <div style="text-align:center;">
                    <div style="position:relative; width:100px; height:100px; margin:0 auto 10px;">
                        <canvas id="gauge-${clientId}-tolerance" width="100" height="100"></canvas>
                    </div>
                    <div style="font-size:20px; font-weight:700; color:#f59e0b;">${pourcentTolerance}%</div>
                    <div style="font-size:11px; color:#64748b;">Dans la tolérance</div>
                    <div style="font-size:10px; color:#94a3b8;">${forfaitMax} - ${forfaitMax * 1.2}Wh</div>
                </div>

                <!-- Hors tolérance -->
                <div style="text-align:center;">
                    <div style="position:relative; width:100px; height:100px; margin:0 auto 10px;">
                        <canvas id="gauge-${clientId}-hors" width="100" height="100"></canvas>
                    </div>
                    <div style="font-size:20px; font-weight:700; color:#ef4444;">${pourcentHorsTolerance}%</div>
                    <div style="font-size:11px; color:#64748b;">Hors tolérance</div>
                    <div style="font-size:10px; color:#94a3b8;">> ${forfaitMax * 1.2}Wh</div>
                </div>
            </div>

            <!-- Barre de progression globale -->
            <div style="background:#f1f5f9; border-radius:30px; height:30px; overflow:hidden; display:flex; margin-top:10px;">
                <div style="width:${pourcentLimites}%; background:#22c55e; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:white;">
                    ${pourcentLimites > 5 ? pourcentLimites + '%' : ''}
                </div>
                <div style="width:${pourcentTolerance}%; background:#f59e0b; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:white;">
                    ${pourcentTolerance > 5 ? pourcentTolerance + '%' : ''}
                </div>
                <div style="width:${pourcentHorsTolerance}%; background:#ef4444; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:white;">
                    ${pourcentHorsTolerance > 5 ? pourcentHorsTolerance + '%' : ''}
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:10px; color:#64748b;">
                <span>${joursDansLimites} jours</span>
                <span>${joursDansTolerance} jours</span>
                <span>${joursHorsTolerance} jours</span>
            </div>
        </div>
    `;
}

// ======================== FONCTION POUR DESSINER LES JAUX ========================
function drawGauges(clientId) {
    const dailySummary = dailySummaryByClient[clientId] || [];
    const clientData = allResultsByClient[clientId];
    const forfaitName = clientData.forfait || 'ECO';
    const limits = getLocalForfaitLimits(forfaitName);
    const forfaitMax = limits.max;

    if (dailySummary.length === 0) return;

    // Calculer les pourcentages
    const joursDansLimites = dailySummary.filter(d => {
        const energie = d.energieMax || 0;
        return energie > 0 && energie <= forfaitMax;
    }).length;

    const joursDansTolerance = dailySummary.filter(d => {
        const energie = d.energieMax || 0;
        return energie > 0 && energie > forfaitMax && energie <= (forfaitMax * 1.2);
    }).length;

    const joursHorsTolerance = dailySummary.filter(d => {
        const energie = d.energieMax || 0;
        return energie > 0 && energie > (forfaitMax * 1.2);
    }).length;

    const total = joursDansLimites + joursDansTolerance + joursHorsTolerance;

    const pourcentLimites = total > 0 ? (joursDansLimites / total) * 100 : 0;
    const pourcentTolerance = total > 0 ? (joursDansTolerance / total) * 100 : 0;
    const pourcentHorsTolerance = total > 0 ? (joursHorsTolerance / total) * 100 : 0;

    // Dessiner les jaux
    setTimeout(() => {
        // Jauge limites (verte)
        const canvasLimits = document.getElementById(`gauge-${clientId}-limits`);
        if (canvasLimits) {
            const ctx = canvasLimits.getContext('2d');
            const centerX = 50;
            const centerY = 50;
            const radius = 40;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (pourcentLimites / 100) * 2 * Math.PI;

            // Fond
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 10;
            ctx.stroke();

            // Progression
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 10;
            ctx.stroke();

            // Texte
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#22c55e';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(pourcentLimites) + '%', centerX, centerY);
        }

        // Jauge tolérance (orange)
        const canvasTolerance = document.getElementById(`gauge-${clientId}-tolerance`);
        if (canvasTolerance) {
            const ctx = canvasTolerance.getContext('2d');
            const centerX = 50;
            const centerY = 50;
            const radius = 40;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (pourcentTolerance / 100) * 2 * Math.PI;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 10;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 10;
            ctx.stroke();

            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#f59e0b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(pourcentTolerance) + '%', centerX, centerY);
        }

        // Jauge hors tolérance (rouge)
        const canvasHors = document.getElementById(`gauge-${clientId}-hors`);
        if (canvasHors) {
            const ctx = canvasHors.getContext('2d');
            const centerX = 50;
            const centerY = 50;
            const radius = 40;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (pourcentHorsTolerance / 100) * 2 * Math.PI;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 10;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 10;
            ctx.stroke();

            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#ef4444';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(pourcentHorsTolerance) + '%', centerX, centerY);
        }
    }, 300);
}

// ======================== INITIALISATION DES GRAPHIQUES CLIENTS ========================
function initializeClientCharts() {
    setTimeout(() => {
        console.log('🔄 Initialisation des graphiques clients...');

        // Parcourir tous les conteneurs de graphiques
        document.querySelectorAll('.client-hourly-chart-container').forEach(container => {
            const chartId = container.getAttribute('data-chart-id');
            const clientId = container.getAttribute('data-client-id');

            if (!chartId || !clientId) return;

            const canvas = document.getElementById(chartId);
            if (!canvas) return;

            const clientData = allResultsByClient[clientId];
            if (!clientData || !clientData.combinedHourlyData) return;

            // Recalculer les données (au cas où)
            const hourlyAverages = new Array(24).fill(0);
            const hourlyCounts = new Array(24).fill(0);

            clientData.combinedHourlyData.forEach(item => {
                if (item.energie && item.energie > 0 && item.heure) {
                    let hour = parseInt(item.heure.split('h')[0]) || parseInt(item.heure.split(':')[0]);
                    if (!isNaN(hour) && hour >= 0 && hour < 24) {
                        hourlyAverages[hour] += parseFloat(item.energie);
                        hourlyCounts[hour]++;
                    }
                }
            });

            for (let i = 0; i < 24; i++) {
                if (hourlyCounts[i] > 0) {
                    hourlyAverages[i] = Math.round(hourlyAverages[i] / hourlyCounts[i]);
                }
            }

            const maxEnergy = Math.max(...hourlyAverages);
            const peakHour = hourlyAverages.indexOf(maxEnergy);

            const barColors = hourlyAverages.map((value, index) => {
                if (value === 0) return '#94a3b8';
                if (index === peakHour && value > 0) return '#ef4444';
                return '#3b82f6';
            });

            // Détruire l'ancien graphique s'il existe
            const chartProperty = `chart_${chartId}`;
            if (window[chartProperty]) {
                window[chartProperty].destroy();
            }

            // Créer le nouveau graphique
            try {
                window[chartProperty] = new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: Array.from({ length: 24 }, (_, i) => i + 'h'),
                        datasets: [{
                            label: 'Consommation moyenne (Wh)',
                            data: hourlyAverages,
                            backgroundColor: barColors,
                            borderColor: '#1e293b',
                            borderWidth: 1,
                            borderRadius: 6,
                            barPercentage: 0.7
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const value = context.parsed.y;
                                        return value > 0 ? `${value} Wh` : 'Pas de données';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Énergie (Wh)',
                                    font: { size: 11 }
                                },
                                ticks: {
                                    callback: (value) => value + ' Wh'
                                }
                            },
                            x: {
                                title: {
                                    display: true,
                                    text: 'Heure',
                                    font: { size: 11 }
                                }
                            }
                        }
                    }
                });
                console.log(`✅ Graphique créé pour client ${clientId}`);
            } catch (error) {
                console.error(`❌ Erreur création graphique client ${clientId}:`, error);
            }
        });
    }, 300); // Délai pour laisser le DOM se mettre à jour
}
// ======================== AFFICHAGE DES ÉVÉNEMENTS EC PAR CLIENT ========================
function displayClientData(clientId, clientData) {
    const contentElement = document.getElementById(`sub-content-${clientId}`);
    if (!contentElement) return;

    const dailySummary = dailySummaryByClient[clientId] || [];
    const clientNumber = parseInt(clientId).toString().padStart(2, '0');

    contentElement.innerHTML = `
        <!-- PARTIE COMMERCIALE PRINCIPALE -->
        ${generateCommercialView(clientId)}

        <!-- TABLEAU DES ÉVÉNEMENTS -->
        ${displayClientEventsTab(clientId)}

        <!-- CARTE CRÉDIT & RECHARGE DU CLIENT -->
        ${createCreditCard(clientId)}

        <!-- TABLEAU RÉSUMÉ JOURNALIER (AVEC BOUTON) -->
        ${dailySummary.length > 0 ? displayDailySummaryTable(clientId, dailySummary) :
            '<div style="text-align: center; padding: 30px; background: #f8fafc; border-radius: 8px; color: #64748b;">Aucune donnée journalière disponible</div>'
        }  
    `;

    // Initialiser les boutons après l'ajout du HTML
    setTimeout(() => {
        initializeTableToggles();
        initializeClientEventsToggles(); // ← AJOUTER CETTE LIGNE
    }, 100);
}

// ======================== ANALYSE COMMERCIALE GLOBALE DU CLIENT ========================
function generateCommercialGlobalAnalysis(clientId) {
    const clientData = allResultsByClient[clientId];
    const dailySummary = dailySummaryByClient[clientId] || [];
    const creditData = creditResultsByClient[clientId];
    const clientEvents = collectClientEvents(clientId);

    if (dailySummary.length === 0) {
        return `
            <div class="commercial-global-analysis" style="margin-bottom: 20px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 18px; padding: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; background: #94a3b8; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 20px; color: white;">📋</span>
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">Analyse Commerciale</h3>
                        <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Données insuffisantes pour ce client</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Récupérer les informations de base
    const forfaitName = clientData.forfait || 'ECO';
    const limits = getLocalForfaitLimits(forfaitName);
    const forfaitMax = limits.max;

    // Statistiques de consommation
    const daysWithData = dailySummary.length;
    const daysWithConsumption = dailySummary.filter(d => d.energieMax > 0).length;
    const percentActive = Math.round((daysWithConsumption / daysWithData) * 100);

    // Analyse des pics de consommation
    const maxEnergy = Math.max(...dailySummary.map(d => d.energieMax || 0));
    const avgEnergy = Math.round(dailySummary.reduce((sum, d) => sum + (d.energieMax || 0), 0) / daysWithData);
    const percentOfForfait = Math.round((avgEnergy / forfaitMax) * 100);

    // Jours de dépassement
    const daysOverQuota = dailySummary.filter(d => d.energieMax > forfaitMax).length;
    const percentOverQuota = daysWithConsumption > 0 ? Math.round((daysOverQuota / daysWithConsumption) * 100) : 0;

    // Jours proches du forfait (>80%)
    const daysNearQuota = dailySummary.filter(d => d.energieMax > forfaitMax * 0.8 && d.energieMax <= forfaitMax).length;

    // === 1. ANALYSE DU CRÉDIT ===
    let creditText = "Aucune donnée de crédit";
    let creditStatus = "non défini";
    let creditColor = "#64748b";
    let creditDays = 0;
    let avgCredit = 0;

    if (creditData && creditData.dailySummary && creditData.dailySummary.length > 0) {
        const creditDays_data = creditData.dailySummary;
        creditDays = creditDays_data.length;
        const zeroCreditDays = creditDays_data.filter(d => d.creditMoyen === 0 || d.creditMoyen === '0').length;
        avgCredit = Math.round(creditDays_data.reduce((sum, d) => sum + (d.creditMoyen || 0), 0) / creditDays_data.length);
        const percentZeroCredit = Math.round((zeroCreditDays / creditDays_data.length) * 100);

        if (percentZeroCredit === 0) {
            creditStatus = "excellent";
            creditColor = "#22c55e";
            creditText = `${avgCredit} jours en moyenne, aucun jour sans crédit`;
        } else if (percentZeroCredit < 20) {
            creditStatus = "bon";
            creditColor = "#3b82f6";
            creditText = `${avgCredit} jours en moyenne, ${percentZeroCredit}% de jours sans crédit`;
        } else if (percentZeroCredit < 40) {
            creditStatus = "moyen";
            creditColor = "#f59e0b";
            creditText = `${percentZeroCredit}% des jours sans crédit`;
        } else {
            creditStatus = "fragile";
            creditColor = "#ef4444";
            creditText = `${percentZeroCredit}% des jours sans crédit - risque d'interruption`;
        }
    }

    // === 2. ANALYSE DES ÉVÉNEMENTS (en jours, pas en points) ===
    const eventStats = analyzeClientEvents(clientEvents);

    // === 3. ANALYSE DE LA TENDANCE RÉCENTE (Détection d'arrêt de consommation) ===
    const last30Days = dailySummary.slice(-30);
    const last7Days = dailySummary.slice(-7);
    const previous23Days = dailySummary.slice(-30, -7);

    // Calcul des moyennes
    const avgLast7 = last7Days.filter(d => d.energieMax > 0).length / 7 * 100;
    const avgLast30 = last30Days.filter(d => d.energieMax > 0).length / 30 * 100;
    const avgPrevious23 = previous23Days.filter(d => d.energieMax > 0).length / 23 * 100;

    // Détection des tendances
    let trendStatus = "stable";
    let trendIcon = "📊";
    let trendColor = "#3b82f6";
    let trendMessage = "Consommation stable";

    // Vérifier si le client ne consomme plus du tout dans les 7 derniers jours
    const noConsumptionLast7Days = last7Days.filter(d => d.energieMax > 0).length === 0;

    if (noConsumptionLast7Days) {
        // Plus aucune consommation depuis au moins 7 jours
        trendStatus = "alerte";
        trendIcon = "🔴";
        trendColor = "#ef4444";
        trendMessage = "⚠️ PLUS AUCUNE CONSOMMATION DEPUIS 7 JOURS";
    }
    else if (avgLast7 < avgPrevious23 * 0.5 && avgPrevious23 > 20) {
        // Baisse significative de 50% par rapport à la période précédente
        trendStatus = "baisse";
        trendIcon = "📉";
        trendColor = "#f59e0b";
        trendMessage = "Baisse d'activité détectée";
    }
    else if (avgLast7 > avgPrevious23 * 1.5) {
        // Hausse significative
        trendStatus = "hausse";
        trendIcon = "📈";
        trendColor = "#22c55e";
        trendMessage = "Hausse d'activité détectée";
    }

    // Compter les jours sans consommation dans la dernière semaine
    const daysWithoutConsoLast7 = 7 - last7Days.filter(d => d.energieMax > 0).length;

    // === 4. CALCUL DU SCORE DE SANTÉ CLIENT (0-100) ===
    let healthScore = 100;

    // Pénalités basées sur l'activité
    if (daysWithConsumption === 0) healthScore -= 50;
    else if (percentActive < 20) healthScore -= 30;
    else if (percentActive < 50) healthScore -= 15;

    // Pénalités basées sur les dépassements
    healthScore -= daysOverQuota * 3;
    if (percentOverQuota > 30) healthScore -= 10;

    // Pénalités basées sur le crédit
    if (creditStatus === "fragile") healthScore -= 25;
    else if (creditStatus === "moyen") healthScore -= 15;
    else if (creditStatus === "bon") healthScore -= 5;

    // Pénalités basées sur les événements
    healthScore -= eventStats.daysWithEvents * 2;

    // Pénalité pour baisse d'activité
    if (trendStatus === "baisse") healthScore -= 10;
    if (trendStatus === "alerte") healthScore -= 30;

    // Garder entre 0 et 100
    healthScore = Math.max(0, Math.min(100, healthScore));
    const healthColor = healthScore >= 80 ? "#22c55e" : healthScore >= 50 ? "#f59e0b" : "#ef4444";

    // === 5. CALCUL DU RISQUE DE CHURN (AVEC TERMES SIMPLIFIÉS) ===
    let churnRisk = "faible";
    let churnColor = "#22c55e";
    let churnIcon = "✅";
    let churnReasons = [];

    if (daysWithConsumption === 0) {
        churnRisk = "élevé";
        churnColor = "#ef4444";
        churnIcon = "🔴";
        churnReasons.push("N'utilise pas du tout son kit");
    } else if (percentActive < 20) {
        churnRisk = "moyen";
        churnColor = "#f59e0b";
        churnIcon = "🟠";
        churnReasons.push("Utilise très rarement son kit");
    } else if (percentActive < 50) {
        churnRisk = "moyen";
        churnColor = "#f59e0b";
        churnIcon = "🟠";
        churnReasons.push("Utilisation irrégulière");
    }

    if (creditStatus === "fragile") {
        churnRisk = churnRisk === "faible" ? "moyen" : churnRisk;
        churnColor = churnRisk === "moyen" ? "#f59e0b" : churnColor;
        churnIcon = churnRisk === "moyen" ? "🟠" : churnIcon;
        churnReasons.push("Problèmes fréquents de crédit");
    } else if (creditStatus === "moyen") {
        if (churnRisk === "faible") {
            churnRisk = "moyen";
            churnColor = "#f59e0b";
            churnIcon = "🟠";
        }
        churnReasons.push("Quelques jours sans crédit");
    }

    if (eventStats.hasCreditNul || eventStats.hasEnergieEpuisee) {
        if (churnRisk === "faible") {
            churnRisk = "moyen";
            churnColor = "#f59e0b";
            churnIcon = "🟠";
        }
        churnReasons.push("A subi des coupures de service");
    }

    // === 6. COMPARAISON AVEC LA MOYENNE DU NR ===
    let totalAvgEnergy = 0;
    let totalClientsWithData = 0;
    Object.keys(allResultsByClient).forEach(id => {
        const summary = dailySummaryByClient[id];
        if (summary && summary.length > 0) {
            const clientAvg = Math.round(summary.reduce((sum, d) => sum + (d.energieMax || 0), 0) / summary.length);
            totalAvgEnergy += clientAvg;
            totalClientsWithData++;
        }
    });
    const nrAvgEnergy = totalClientsWithData > 0 ? Math.round(totalAvgEnergy / totalClientsWithData) : 0;
    const comparisonVsNR = avgEnergy - nrAvgEnergy;
    const comparisonText = comparisonVsNR > 0 ?
        `${comparisonVsNR}Wh au-dessus` :
        `${Math.abs(comparisonVsNR)}Wh en dessous`;

    // === 7. TIMELINE DES 7 DERNIERS JOURS ===
    const last7DaysForTimeline = dailySummary.slice(-7).reverse();
    let timelineHTML = '';
    last7DaysForTimeline.forEach((day, index) => {
        const dateParts = day.date.split('/');
        const dateObj = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`);
        const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
        const intensity = day.energieMax > forfaitMax * 0.8 ? '🔴' : day.energieMax > 0 ? '🟢' : '⚪';
        timelineHTML += `
            <div style="text-align: center;">
                <div style="font-size: 9px; color: #64748b; text-transform: uppercase;">${dayName}</div>
                <div style="font-size: 16px; margin: 2px 0;">${intensity}</div>
                <div style="font-size: 8px; color: #94a3b8;">${day.energieMax || 0}Wh</div>
            </div>
        `;
    });

    /* ===== PROFILS CLIENTS ===== */
    let profileType = "";
    let profileDescription = "";
    let profileIcon = "";
    let profileColor = "";
    let recommendations = [];
    let badgeGradient = "";

    if (daysWithConsumption === 0) {
        profileType = "Client inactif";
        profileIcon = "😴";
        profileColor = "#64748b";
        badgeGradient = "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)";
        profileDescription = "Ce client n'a pas consommé d'énergie. Le kit est peut-être éteint ou l'installation pas encore opérationnelle.";
        recommendations = [
            "📞 Contacter le client pour comprendre pourquoi il n'utilise pas le service",
            "🔍 Vérifier si le kit est bien installé et fonctionnel",
            "💡 Rappeler les avantages du service et les usages possibles",
            "🛠️ Proposer une assistance à l'installation si nécessaire"
        ];
    }
    else if (percentOfForfait > 70 || percentOverQuota > 15) {
        profileType = "Gros consommateur";
        profileIcon = "⚡";
        profileColor = "#ef4444";
        badgeGradient = "linear-gradient(135deg, #f87171 0%, #dc2626 100%)";
        profileDescription = `Fort utilisateur : ${avgEnergy}Wh/jour (${percentOfForfait}% du forfait) avec ${daysOverQuota} dépassement(s).`;
        recommendations = [
            "📈 Proposer un forfait supérieur pour plus de confort et éviter les coupures",
            "💰 Discuter d'un forfait mieux adapté à ses besoins réels",
            "⚡ Vérifier les appareils utilisés (peut-être trop puissants pour le kit)",
            "📞 Proposer un appel pour optimiser son utilisation"
        ];
    }
    else if (percentActive >= 60 && percentOfForfait >= 15 && percentOfForfait <= 60) {
        profileType = "Client régulier";
        profileIcon = "📱";
        profileColor = "#22c55e";
        badgeGradient = "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)";
        profileDescription = `Utilisation régulière : ${percentActive}% des jours · ${avgEnergy}Wh/jour (${percentOfForfait}% du forfait)`;
        recommendations = [
            "📱 Lui proposer de découvrir les nouveaux services et équipements",
            "🔋 L'informer des accessoires compatibles pour enrichir son expérience",
            "📧 Lui envoyer des conseils pour optimiser sa consommation",
            "💡 L'encourager à partager son expérience (témoignage client)"
        ];
    }
    else if (percentActive >= 50 && percentOfForfait < 15) {
        profileType = "Client économe";
        profileIcon = "🌱";
        profileColor = "#10b981";
        badgeGradient = "linear-gradient(135deg, #34d399 0%, #059669 100%)";
        profileDescription = `Utilisation régulière mais très modérée : ${avgEnergy}Wh/jour (${percentOfForfait}% du forfait)`;
        recommendations = [
            "💡 Féliciter pour sa bonne gestion de l'énergie (exemple à valoriser)",
            "🔌 Proposer des équipements supplémentaires (lampes, radio, chargeur)",
            "📱 Lui suggérer d'augmenter son utilisation pour profiter pleinement du service",
            "⭐ L'encourager à témoigner de son expérience"
        ];
    }
    else if (percentActive >= 20 && percentActive < 60) {
        profileType = "Client occasionnel";
        profileIcon = "🌤️";
        profileColor = "#f59e0b";
        badgeGradient = "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)";
        profileDescription = `Utilisation occasionnelle : ${percentActive}% des jours · ${avgEnergy}Wh/jour en moyenne`;
        recommendations = [
            "💡 Rappeler les avantages du service (économie, autonomie, écologie)",
            "📱 Proposer des conseils pour utiliser plus régulièrement",
            "🔌 Suggérer des équipements simples pour démarrer (lampe, chargeur)",
            "📞 Prendre des nouvelles pour comprendre ses habitudes"
        ];
    }
    else {
        profileType = "Client très occasionnel";
        profileIcon = "🌙";
        profileColor = "#64748b";
        badgeGradient = "linear-gradient(135deg, #9ca3af 0%, #4b5563 100%)";
        profileDescription = `Très peu d'utilisation : ${percentActive}% des jours seulement`;
        recommendations = [
            "📞 Contacter pour comprendre pourquoi il n'utilise pas le service",
            "🛠️ Proposer une démonstration d'utilisation ou un rappel des fonctionnalités",
            "💡 Vérifier si le forfait actuel est adapté à ses besoins réels",
            "🔋 Rappeler que le service est disponible quand il en a besoin"
        ];
    }

    // Ajouter recommandations basées sur les événements
    if (eventStats.hasCreditNul) {
        recommendations.push("💰 Proposer un rappel automatique par SMS pour éviter les coupures de service");
    }
    if (eventStats.hasSurcharge) {
        recommendations.push("⚡ Éviter de brancher trop d'appareils en même temps pour ne pas surcharger le kit");
    }
    if (eventStats.hasPuissanceDep) {
        recommendations.push("📈 Répartir l'utilisation des appareils sur la journée pour éviter les dépassements");
    }

    // Supprimer doublons et limiter à 4 recommandations max
    recommendations = [...new Set(recommendations)].slice(0, 4);

    // Compter le nombre total de clients pour le contexte NR
    const totalClients = Object.keys(allResultsByClient).length;

    return `
        <div class="commercial-global-analysis" style="margin-bottom: 20px; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
            
            <!-- En-tête profil -->
            <div style="padding: 18px 20px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                <div style="width: 52px; height: 52px; background: ${badgeGradient}; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 12px ${profileColor}40;">
                    <span style="font-size: 28px;">${profileIcon}</span>
                </div>
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a;">${profileType}</h2>
                        <span style="background: ${profileColor}15; color: ${profileColor}; padding: 4px 12px; border-radius: 30px; font-size: 11px; font-weight: 600; border: 1px solid ${profileColor}30;">
                            ${forfaitName} · ${forfaitMax}Wh
                        </span>
                    </div>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569; line-height: 1.5;">
                        ${profileDescription}
                    </p>
                </div>
                
                <!-- Score de santé compact -->
                <div style="text-align: center; min-width: 70px;">
                    <div style="font-size: 24px; font-weight: 800; color: ${healthColor};">${healthScore}</div>
                    <div style="font-size: 9px; color: #64748b; text-transform: uppercase;">Santé</div>
                    <div style="height: 4px; width: 100%; background: #e2e8f0; border-radius: 10px; margin-top: 4px;">
                        <div style="width: ${healthScore}%; height: 100%; background: ${healthColor}; border-radius: 10px;"></div>
                    </div>
                </div>
            </div>
            
            
            
            <!-- Footer avec indicateurs -->
            <div style="padding: 10px 20px; background: #f1f5f9; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 11px; color: #475569;">✓ Analyse basée sur ${daysWithData} jours</span>
                    <span style="font-size: 11px; color: #475569;">📊 Confiance ${daysWithData > 20 ? 'élevée' : 'moyenne'}</span>
                </div>
                <span style="font-size: 11px; color: ${profileColor}; font-weight: 500;">Client ${parseInt(clientId).toString().padStart(2, '0')}/${totalClients}</span>
            </div>
        </div>
    `;
}

// ======================== FONCTION UTILITAIRE POUR ANALYSER LES ÉVÉNEMENTS ========================
function collectClientEvents(clientId) {
    const events = [];
    const targetClientNum = parseInt(clientId, 10);

    if (window.ecFiles && window.ecFiles.length > 0) {
        window.ecFiles.forEach(file => {
            try {
                const results = analyzeECSimple(file.content);
                const clientSpecificEvents = results.filter(event => event.Client === targetClientNum);
                events.push(...clientSpecificEvents);
            } catch (error) {
                // Ignorer les erreurs
            }
        });
    }

    return events;
}

// ======================== ANALYSE DES ÉVÉNEMENTS PAR JOUR ========================
function analyzeClientEvents(events) {
    if (events.length === 0) {
        return {
            hasSurcharge: false,
            hasCreditNul: false,
            hasPuissanceDep: false,
            hasEnergieEpuisee: false,
            totalEvents: 0,
            daysWithEvents: 0,  // NOUVEAU : nombre de jours uniques
            summary: "Aucun événement particulier détecté."
        };
    }

    // Compter les JOURS uniques pour chaque type d'événement
    const daysWithSurcharge = new Set();
    const daysWithCreditNul = new Set();
    const daysWithPuissanceDep = new Set();
    const daysWithEnergieEpuisee = new Set();
    const allEventDays = new Set();

    events.forEach(event => {
        const date = event.Date;
        const type = event['Analyse État'];

        allEventDays.add(date);

        if (type === 'SURCHARGE') daysWithSurcharge.add(date);
        if (type === 'CRÉDIT NUL') daysWithCreditNul.add(date);
        if (type === 'PUISSANCE DÉPASSÉE') daysWithPuissanceDep.add(date);
        if (type === 'ÉNERGIE ÉPUISÉE') daysWithEnergieEpuisee.add(date);
    });

    // Générer un résumé en nombre de JOURS
    let summaryParts = [];
    if (daysWithPuissanceDep.size > 0) {
        summaryParts.push(`📈 ${daysWithPuissanceDep.size} jour(s) avec puissance dépassée`);
    }
    if (daysWithSurcharge.size > 0) {
        summaryParts.push(`⚡ ${daysWithSurcharge.size} jour(s) avec surcharge`);
    }
    if (daysWithCreditNul.size > 0) {
        summaryParts.push(`💰 ${daysWithCreditNul.size} jour(s) avec crédit nul`);
    }
    if (daysWithEnergieEpuisee.size > 0) {
        summaryParts.push(`🔋 ${daysWithEnergieEpuisee.size} jour(s) avec énergie épuisée`);
    }

    const summary = summaryParts.length > 0 ? summaryParts.join(' · ') : "Aucun événement particulier détecté.";

    return {
        hasSurcharge: daysWithSurcharge.size > 0,
        hasCreditNul: daysWithCreditNul.size > 0,
        hasPuissanceDep: daysWithPuissanceDep.size > 0,
        hasEnergieEpuisee: daysWithEnergieEpuisee.size > 0,
        totalEvents: events.length,
        daysWithEvents: allEventDays.size,  // Nombre de jours uniques avec événements
        summary: summary
    };
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
    const maxValues = daily.map(d => d.energieMax || 0).sort((a, b) => a - b);
    const avgMax = maxValues.length ? Math.round(maxValues.reduce((a, b) => a + b, 0) / maxValues.length) : 0;
    const medianMax = maxValues.length ? (maxValues.length % 2 === 1 ? maxValues[Math.floor(maxValues.length / 2)] : Math.round((maxValues[maxValues.length / 2 - 1] + maxValues[maxValues.length / 2]) / 2)) : 0;
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
    const avgCredit = creditValues.length ? Math.round(creditValues.reduce((a, b) => a + b, 0) / creditValues.length) : 0;
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

//=================tableau principal de l'onglet commercial du client=============
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

    // IDs uniques
    const buttonId = `toggle-table-${clientId}`;
    const tableId = `daily-summary-table-${clientId}`;

    // Retourner le HTML
    return `
        <div class="daily-summary-container">
            <!-- BOUTON POUR AFFICHER/MASQUER LE TABLEAU -->
            <div style="margin-bottom: 15px;">
                <button id="${buttonId}" style="
                    width: 100%;
                    padding: 12px 20px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                ">
                    <span style="font-size: 18px;">🔽</span>
                    <span>Afficher le tableau détaillé (${totalItems} jour${totalItems !== 1 ? 's' : ''})</span>
                </button>
            </div>

            <!-- TABLEAU (CACHÉ PAR DÉFAUT) -->
            <div id="${tableId}" style="display: none;">
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
    const stablePercent = days > 0 ? Math.round((stable / days) * 100) : 0;
    const unstablePercent = days > 0 ? Math.round((unstable / days) * 100) : 0;
    const outOfLimitsPercent = days > 0 ? Math.round((outOfLimits / days) * 100) : 0;

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

// ======================== FONCTION DE VISUALISATION DE STABILITÉ AVEC STYLE CARTE ========================
function createStabilityChart(containerId, stabilityData, tensionResults) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { stable, unstable, outOfLimits, stabilityPercentage, systemType, averageVariation, days } = stabilityData;
    const totalDays = stable + unstable + outOfLimits;

    // CALCULER LES JOURS AVEC VARIATION HAUTE (instabilité)
    const highVariationDays = calculateHighVariationDays(tensionResults);
    
    // CALCULER LES JOURS D'ALERTE (dépassements de seuil)
    const alertData = calculateAlertDays(tensionResults);
    
    // Déterminer les seuils selon le système
    const tensionMin = systemType === '24V' ? '22' : '11';
    const tensionMax = systemType === '24V' ? '31' : '15';
    const variationSeuil = systemType === '24V' ? '5' : '2.5';
    
    // Calculer les pourcentages pour les barres de progression
    const percentConforme = totalDays > 0 ? Math.round((stable / totalDays) * 100) : 0;
    const percentNonConforme = totalDays > 0 ? Math.round((outOfLimits / totalDays) * 100) : 0;
    const percentVariationHaute = totalDays > 0 ? Math.round((highVariationDays.count / totalDays) * 100) : 0;
    
    // Générer un ID unique pour les tableaux
    const exceedanceTableId = `exceedance-table-${Date.now()}`;
    const variationTableId = `variation-table-${Date.now()}`;

    // Fonction pour formater la date correctement
    const formatDate = (dateStr) => {
        if (!dateStr) return 'Date invalide';
        if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('fr-FR', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                });
            }
        }
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('fr-FR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            });
        }
        return dateStr;
    };

    // Générer le HTML pour le tableau des dépassements (si des jours non conformes existent)
    let exceedanceTableHTML = '';
    if (outOfLimits > 0 && alertData && alertData.daysList && alertData.daysList.length > 0) {
        exceedanceTableHTML = `
            <div style="background: #fef2f2; border-radius: 0; margin: 0; border-top: 1px solid #fee2e2; overflow: hidden;">
                <div style="background: #fee2e2; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s ease;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 16px;">🔴</span>
                        <span style="font-weight: 600; color: #b91c1c;">Jours avec dépassement de seuil (${alertData.daysList.length})</span>
                        <span style="font-size: 11px; color: #dc2626;">Total: ${alertData.daysList.reduce((sum, day) => sum + day.hoursAboveThreshold, 0)} heures d'alerte</span>
                    </div>
                    <button id="toggle-${exceedanceTableId}" 
                            data-table-id="${exceedanceTableId}"
                            style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #b91c1c; padding: 5px 12px; border-radius: 20px; cursor: pointer; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 5px;">
                        <span style="font-size: 11px;">🔽</span>
                        <span>Afficher le tableau</span>
                    </button>
                </div>
                <div id="${exceedanceTableId}" style="display: none;">
                    <div style="max-height: 260px; overflow-y: auto; padding: 16px; background: white;">
                        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                            <thead style="background: #f1f5f9; position: sticky; top: 0;">
                                <tr>
                                    <th style="padding: 10px 8px; text-align: left;">Date</th>
                                    <th style="padding: 10px 8px; text-align: center;">Variation</th>
                                    <th style="padding: 10px 8px; text-align: center;">Tension Min</th>
                                    <th style="padding: 10px 8px; text-align: center;">Tension Max</th>
                                    <th style="padding: 10px 8px; text-align: center;">Heures alerte</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${alertData.daysList.map((day, index) => {
                                    const rowBgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
                                    return `
                                        <tr style="border-bottom: 1px solid #e2e8f0; background: ${rowBgColor};">
                                            <td style="padding: 8px; font-weight: 500;">${formatDate(day.date)}</td>
                                            <td style="padding: 8px; text-align: center; color: #f59e0b; font-weight: 600;">${day.dailyVariation}V</td>
                                            <td style="padding: 8px; text-align: center; color: ${parseFloat(day.min) < (systemType === '24V' ? 22 : 11) ? '#ef4444' : '#1e293b'};">${day.min}V</td>
                                            <td style="padding: 8px; text-align: center; color: ${parseFloat(day.max) > (systemType === '24V' ? 31 : 15) ? '#ef4444' : '#1e293b'};">${day.max}V</td>
                                            <td style="padding: 8px; text-align: center;">
                                                <span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 3px 8px; border-radius: 20px; font-weight: 600; font-size: 11px;">
                                                    ${day.hoursAboveThreshold}h
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    // Générer le HTML pour le tableau des variations hautes
    let variationTableHTML = '';
    if (highVariationDays.count > 0 && highVariationDays.daysList && highVariationDays.daysList.length > 0) {
        variationTableHTML = `
            <div style="background: #fff7ed; border-radius: 0; margin: 0; border-top: 1px solid #fed7aa; overflow: hidden;">
                <div style="background: #fff7ed; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s ease;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 16px;">⚠️</span>
                        <span style="font-weight: 600; color: #b45309;">Jours avec variation haute (${highVariationDays.count})</span>
                        <span style="font-size: 11px; color: #f97316;">Variation max: ${highVariationDays.maxVariation}V</span>
                    </div>
                    <button id="toggle-variation-${variationTableId}" 
                            data-table-id="variation-${variationTableId}"
                            style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #b45309; padding: 5px 12px; border-radius: 20px; cursor: pointer; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 5px;">
                        <span style="font-size: 11px;">🔽</span>
                        <span>Afficher le tableau</span>
                    </button>
                </div>
                <div id="variation-${variationTableId}" style="display: none;">
                    <div style="max-height: 260px; overflow-y: auto; padding: 16px; background: white;">
                        <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                            <thead style="background: #f1f5f9; position: sticky; top: 0;">
                                <tr>
                                    <th style="padding: 10px 8px; text-align: left;">Date</th>
                                    <th style="padding: 10px 8px; text-align: center;">Variation journalière</th>
                                    <th style="padding: 10px 8px; text-align: center;">Variation horaire</th>
                                    <th style="padding: 10px 8px; text-align: center;">Tension Min</th>
                                    <th style="padding: 10px 8px; text-align: center;">Tension Max</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${highVariationDays.daysList.map((day, index) => {
                                    const rowBgColor = index % 2 === 0 ? '#ffffff' : '#fafbfc';
                                    return `
                                        <tr style="border-bottom: 1px solid #e2e8f0; background: ${rowBgColor};">
                                            <td style="padding: 8px; font-weight: 500;">${formatDate(day.date)}</td>
                                            <td style="padding: 8px; text-align: center; color: #f59e0b; font-weight: 600;">${day.dailyVariation}V</td>
                                            <td style="padding: 8px; text-align: center; color: #f97316;">${day.avgHourlyVariation}V/h</td>
                                            <td style="padding: 8px; text-align: center;">${day.min}V</td>
                                            <td style="padding: 8px; text-align: center;">${day.max}V</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div style="background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; margin: 0;">
            
            <!-- En-tête du card -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
                        <span style="font-size: 28px;">⚡</span>
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 20px; font-weight: 700;">Analyse globale de la Tension</h3>
                        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Système ${systemType} DC · ${days} jours analysés</p>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.15); padding: 8px 20px; border-radius: 40px; font-size: 28px; font-weight: 700;">
                    ${stabilityPercentage}%
                </div>
            </div>
            
            <!-- Grille des cartes statistiques (style identique à createDPDTOnlyTable) -->
            <div class="dpdt-stats-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e2e8f0;">
                
                <!-- CARTE 1 : CONFORMITÉ GLOBALE -->
                <div class="dpdt-stat-card" style="background: white; padding: 20px; border-right: 1px solid #e2e8f0;">
                    <div class="dpdt-stat-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div class="dpdt-stat-icon" style="width: 40px; height: 40px; background: #22c55e20; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 20px;">✅</span>
                        </div>
                        <div class="dpdt-stat-title" style="font-weight: 600; color: #334155; font-size: 13px;">CONFORMITÉ GLOBALE</div>
                    </div>
                    <div class="dpdt-stat-value" style="font-size: 36px; font-weight: 800; color: #22c55e; line-height: 1; margin-bottom: 8px;">
                        ${stabilityPercentage}%
                    </div>
                    <div class="dpdt-stat-detail" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b;">
                        <span>Jours analysés</span>
                        <span class="dpdt-stat-percent" style="font-weight: 700; color: #22c55e;">${days}</span>
                    </div>
                    
                    <!-- Barre de progression -->
                    <div class="progress-bar-container" style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; margin: 12px 0 8px 0;">
                        <div class="progress-bar" style="width: ${stabilityPercentage}%; height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); border-radius: 20px;"></div>
                    </div>
                    <div class="progress-label" style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
                        <span>Taux de conformité</span>
                        <span>${stabilityPercentage}%</span>
                    </div>
                </div>

                <!-- CARTE 2 : JOURS CONFORMES -->
                <div class="dpdt-stat-card" style="background: white; padding: 20px; border-right: 1px solid #e2e8f0;">
                    <div class="dpdt-stat-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div class="dpdt-stat-icon" style="width: 40px; height: 40px; background: #3b82f620; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 20px;">📊</span>
                        </div>
                        <div class="dpdt-stat-title" style="font-weight: 600; color: #334155; font-size: 13px;">JOURS CONFORMES</div>
                    </div>
                    <div class="dpdt-stat-value" style="font-size: 36px; font-weight: 800; color: #3b82f6; line-height: 1; margin-bottom: 8px;">
                        ${stable}
                    </div>
                    <div class="dpdt-stat-detail" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b;">
                        <span>Jours concernés</span>
                        <span class="dpdt-stat-percent" style="font-weight: 700; color: #3b82f6;">${stable} / ${totalDays}</span>
                    </div>
                    
                    <!-- Barre de progression -->
                    <div class="progress-bar-container" style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; margin: 12px 0 8px 0;">
                        <div class="progress-bar" style="width: ${percentConforme}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); border-radius: 20px;"></div>
                    </div>
                    <div class="progress-label" style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
                        <span>Tension ${tensionMin}V - ${tensionMax}V</span>
                        <span>Var ≤ ${variationSeuil}V</span>
                    </div>
                </div>

                <!-- CARTE 3 : JOURS NON CONFORMES -->
                <div class="dpdt-stat-card" style="background: white; padding: 20px; border-right: 1px solid #e2e8f0;">
                    <div class="dpdt-stat-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div class="dpdt-stat-icon" style="width: 40px; height: 40px; background: #ef444420; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 20px;">🔴</span>
                        </div>
                        <div class="dpdt-stat-title" style="font-weight: 600; color: #334155; font-size: 13px;">JOURS NON CONFORMES</div>
                    </div>
                    <div class="dpdt-stat-value" style="font-size: 36px; font-weight: 800; color: #ef4444; line-height: 1; margin-bottom: 8px;">
                        ${outOfLimits}
                    </div>
                    <div class="dpdt-stat-detail" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b;">
                        <span>Jours concernés</span>
                        <span class="dpdt-stat-percent" style="font-weight: 700; color: #ef4444;">${outOfLimits} / ${totalDays}</span>
                    </div>
                    
                    <!-- Barre de progression -->
                    <div class="progress-bar-container" style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; margin: 12px 0 8px 0;">
                        <div class="progress-bar" style="width: ${percentNonConforme}%; height: 100%; background: linear-gradient(90deg, #ef4444, #dc2626); border-radius: 20px;"></div>
                    </div>
                    <div class="progress-label" style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
                        <span>Hors seuils</span>
                        <span>&lt; ${tensionMin}V ou &gt; ${tensionMax}V</span>
                    </div>
                </div>

                <!-- CARTE 4 : VARIATION HAUTE -->
                <div class="dpdt-stat-card" style="background: white; padding: 20px;">
                    <div class="dpdt-stat-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div class="dpdt-stat-icon" style="width: 40px; height: 40px; background: #f59e0b20; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 20px;">⚠️</span>
                        </div>
                        <div class="dpdt-stat-title" style="font-weight: 600; color: #334155; font-size: 13px;">VARIATION HAUTE</div>
                    </div>
                    <div class="dpdt-stat-value" style="font-size: 36px; font-weight: 800; color: #f59e0b; line-height: 1; margin-bottom: 8px;">
                        ${highVariationDays.count}
                    </div>
                    <div class="dpdt-stat-detail" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b;">
                        <span>Jours concernés</span>
                        <span class="dpdt-stat-percent" style="font-weight: 700; color: #f59e0b;">${highVariationDays.count} / ${totalDays}</span>
                    </div>
                    
                    <!-- Barre de progression -->
                    <div class="progress-bar-container" style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; margin: 12px 0 8px 0;">
                        <div class="progress-bar" style="width: ${percentVariationHaute}%; height: 100%; background: linear-gradient(90deg, #f59e0b, #d97706); border-radius: 20px;"></div>
                    </div>
                    <div class="progress-label" style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
                        <span>Variation > ${variationSeuil}V</span>
                        <span>Instabilité détectée</span>
                    </div>
                </div>
            </div>
            
            <!-- Tableaux détaillés -->
            ${exceedanceTableHTML}
            ${variationTableHTML}
            
            <!-- Pied de carte avec normes système -->
            <div style="padding: 12px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; gap: 15px;">
                    <span>⚡ Système ${systemType}</span>
                    <span>📊 Seuils: ${tensionMin}V - ${tensionMax}V</span>
                    <span>📈 Variation max: ${variationSeuil}V</span>
                    <span>📉 Variation moyenne: ${averageVariation}V/h</span>
                </div>
                <span>📅 ${new Date().toLocaleDateString('fr-FR')}</span>
            </div>
        </div>
    `;
    
    // Initialiser les boutons de toggle
    setTimeout(() => {
        // Bouton pour les dépassements de seuil
        const toggleBtn = document.getElementById(`toggle-${exceedanceTableId}`);
        const tableDiv = document.getElementById(exceedanceTableId);
        if (toggleBtn && tableDiv) {
            let isVisible = false;
            toggleBtn.onclick = function(e) {
                e.stopPropagation();
                isVisible = !isVisible;
                if (isVisible) {
                    tableDiv.style.display = 'block';
                    toggleBtn.innerHTML = '<span style="font-size: 11px;">🔼</span><span>Masquer le tableau</span>';
                } else {
                    tableDiv.style.display = 'none';
                    toggleBtn.innerHTML = '<span style="font-size: 11px;">🔽</span><span>Afficher le tableau</span>';
                }
            };
        }
        
        // Bouton pour les variations hautes
        const toggleVariationBtn = document.getElementById(`toggle-variation-${variationTableId}`);
        const variationTableDiv = document.getElementById(`variation-${variationTableId}`);
        if (toggleVariationBtn && variationTableDiv) {
            let isVisible = false;
            toggleVariationBtn.onclick = function(e) {
                e.stopPropagation();
                isVisible = !isVisible;
                if (isVisible) {
                    variationTableDiv.style.display = 'block';
                    toggleVariationBtn.innerHTML = '<span style="font-size: 11px;">🔼</span><span>Masquer le tableau</span>';
                } else {
                    variationTableDiv.style.display = 'none';
                    toggleVariationBtn.innerHTML = '<span style="font-size: 11px;">🔽</span><span>Afficher le tableau</span>';
                }
            };
        }
    }, 100);
}
// ======================== CALCUL DES JOURS AVEC VARIATION HAUTE ========================
function calculateHighVariationDays(tensionResults) {
    if (!tensionResults || !tensionResults.length) {
        return { count: 0, daysList: [], maxVariation: 0, averageVariation: 0 };
    }

    // Grouper par date
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
        const tension = parseFloat(item.tension || item.valeur || 0);
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
    const maxVariationAllowed = systemType === '24V' ? 5 : 2.5;
    
    let highVariationDays = 0;
    const daysList = [];
    let totalVariation = 0;
    let variationCount = 0;

    // Analyser chaque jour
    Object.entries(dailyData).forEach(([date, data]) => {
        const dailyVariation = data.max - data.min;
        
        // Calculer la variation moyenne horaire
        const avgHourlyVariation = data.variations.length > 0
            ? data.variations.reduce((a, b) => a + b, 0) / data.variations.length
            : 0;
        
        totalVariation += avgHourlyVariation;
        variationCount++;
        
        if (dailyVariation > maxVariationAllowed) {
            highVariationDays++;
            daysList.push({
                date: date,
                dailyVariation: dailyVariation.toFixed(2),
                avgHourlyVariation: avgHourlyVariation.toFixed(2),
                min: data.min.toFixed(2),
                max: data.max.toFixed(2),
                variationCount: data.variations.length
            });
        }
    });
    
    const averageVariation = variationCount > 0 ? totalVariation / variationCount : 0;
    
    // Trier par variation décroissante
    daysList.sort((a, b) => parseFloat(b.dailyVariation) - parseFloat(a.dailyVariation));
    
    return {
        count: highVariationDays,
        daysList: daysList,
        maxVariation: daysList.length > 0 ? parseFloat(daysList[0].dailyVariation) : 0,
        averageVariation: parseFloat(averageVariation.toFixed(2)),
        maxVariationAllowed: maxVariationAllowed,
        systemType: systemType
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

        // Conditions d'alerte
        const isAlertDay =
            dailyVariation > limits.maxVariation ||          // Variation journalière trop élevée
            avgHourlyVariation > limits.alertThreshold ||    // Variation horaire moyenne trop élevée
            hoursAboveThreshold >= 3 ||                      // Au moins 3 heures au-dessus du seuil
            data.min < limits.min ||                         // Tension minimum trop basse
            data.max > limits.max;                           // Tension maximum trop élevée

        if (isAlertDay) {
            createStabilityChart
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

// ======================== TABLEAU DES ATTEINTES DE TENSION NOMINALE ========================
// ======================== TABLEAU DES ATTEINTES DE TENSION NOMINALE ========================
function createNominalTensionTable(tensionResults, systemType, allDates) {
    if (!tensionResults || tensionResults.length === 0) {
        return `
            <div style="background: white; border-radius: 10px; border: 1px solid #e2e8f0; padding: 16px; margin-top: 20px;">
                <div style="display: flex; align-items: center; gap: 10px; color: #64748b;">
                    <span style="font-size: 18px;">📊</span>
                    <span style="font-size: 13px;">Aucune donnée de tension disponible</span>
                </div>
            </div>
        `;
    }

    // Définir la tension nominale cible selon le système
    const targetTension = systemType === '24V' ? 28.0 : 14.0;

    // Utiliser TOUTES les dates de la période filtrée
    const allDatesInPeriod = allDates || [];

    // Initialiser TOUS les jours avec 0 atteinte par défaut
    const dailyData = {};
    allDatesInPeriod.forEach(date => {
        dailyData[date] = {
            total: 0,
            nominalCount: 0,
            samples: [],
            hasData: false
        };
    });

    // Remplir avec les données réelles
    tensionResults.forEach(item => {
        const date = item.date;
        let heure = item.heure;
        const tension = parseFloat(item.tension || item.valeur || 0);

        // Formater l'heure correctement (15h00 → 15:00)
        if (heure && heure.includes('h')) {
            heure = heure.replace('h', ':');
        }
        if (heure && heure.length === 4 && heure.includes(':')) {
            heure = '0' + heure;
        }

        // Si la date n'existe pas dans allDates, on l'ajoute
        if (!dailyData[date]) {
            dailyData[date] = {
                total: 0,
                nominalCount: 0,
                samples: [],
                hasData: false
            };
        }

        dailyData[date].total++;
        dailyData[date].hasData = true;

        // Tension SUPÉRIEURE OU ÉGALE à la valeur nominale
        if (tension >= targetTension) {
            dailyData[date].nominalCount++;

            // Forcer 1 décimale pour l'affichage
            const roundedTension = Math.round(tension * 10) / 10;

            // Éviter les doublons exacts (même minute, même tension)
            const isDuplicate = dailyData[date].samples.some(s =>
                s.heure === heure && Math.abs(s.tension - roundedTension) < 0.01
            );

            if (!isDuplicate) {
                dailyData[date].samples.push({
                    heure: heure,
                    tension: roundedTension
                });
            }
        }
    });

    // Trier les échantillons par heure pour chaque date
    Object.keys(dailyData).forEach(date => {
        if (dailyData[date].samples.length > 0) {
            dailyData[date].samples.sort((a, b) => {
                const timeA = convertTimeToMinutes(a.heure);
                const timeB = convertTimeToMinutes(b.heure);
                return timeA - timeB;
            });
        }
    });

    // Trier les dates par ordre chronologique
    const sortedDates = Object.keys(dailyData).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateA - dateB;
    });

    // Calculer les statistiques globales
    let totalNominalHits = 0;
    let totalMeasurements = 0;
    let daysWithNominal = 0;
    let daysWithData = 0;

    // Compter les jours par catégorie d'atteintes
    let daysWith8Plus = 0;   // NOUVEAU : ≥8 atteintes (EXCÈS DE CHARGE)
    let daysWith4Plus = 0;   // ≥4 atteintes
    let daysWith3 = 0;       // 3 atteintes
    let daysWith2 = 0;       // 2 atteintes
    let daysWith1 = 0;       // 1 atteinte
    let daysWith0 = 0;       // 0 atteinte (mais avec données)
    let daysWithoutData = 0; // Pas de données

    Object.values(dailyData).forEach(day => {
        totalMeasurements += day.total;
        totalNominalHits += day.nominalCount;
        if (day.nominalCount > 0) daysWithNominal++;
        if (day.hasData) daysWithData++;

        // Catégoriser les jours
        if (!day.hasData) {
            daysWithoutData++;
        } 
        // NOUVEAU : ≥8 atteintes (excès de charge) - priorité la plus haute
        else if (day.nominalCount >= 8) {
            daysWith8Plus++;
        }
        else if (day.nominalCount >= 4) {
            daysWith4Plus++;
        }
        else if (day.nominalCount === 3) {
            daysWith3++;
        }
        else if (day.nominalCount === 2) {
            daysWith2++;
        }
        else if (day.nominalCount === 1) {
            daysWith1++;
        }
        else {
            daysWith0++;
        }
    });

    const percentageNominal = totalMeasurements > 0
        ? ((totalNominalHits / totalMeasurements) * 100).toFixed(1)
        : 0;

    // Calculer les pourcentages pour chaque catégorie
    const percent8Plus = daysWithData > 0 ? ((daysWith8Plus / daysWithData) * 100).toFixed(1) : 0;
    const percent4Plus = daysWithData > 0 ? ((daysWith4Plus / daysWithData) * 100).toFixed(1) : 0;
    const percent3 = daysWithData > 0 ? ((daysWith3 / daysWithData) * 100).toFixed(1) : 0;
    const percent2 = daysWithData > 0 ? ((daysWith2 / daysWithData) * 100).toFixed(1) : 0;
    const percent1 = daysWithData > 0 ? ((daysWith1 / daysWithData) * 100).toFixed(1) : 0;
    const percent0 = daysWithData > 0 ? ((daysWith0 / daysWithData) * 100).toFixed(1) : 0;
    const percentWithoutData = sortedDates.length > 0 ? ((daysWithoutData / sortedDates.length) * 100).toFixed(1) : 0;

    // Préparer les données pour le graphique en ligne
    const chartData = sortedDates.map((date, index) => {
        const day = dailyData[date];
        return {
            date: date,
            count: day.hasData ? day.nominalCount : null,
            index: index,
            hasData: day.hasData
        };
    });

    // Trouver les valeurs min/max pour le graphique
    const validCounts = chartData.filter(d => d.hasData).map(d => d.count);
    const maxCount = validCounts.length > 0 ? Math.max(...validCounts, 8) : 8;
    const minCount = 0;

    // Dimensions du graphique
    const chartWidth = 800;
    const chartHeight = 200;
    const padding = { top: 20, right: 30, bottom: 40, left: 40 };
    const graphWidth = chartWidth - padding.left - padding.right;
    const graphHeight = chartHeight - padding.top - padding.bottom;

    // Fonction pour convertir les coordonnées
    const getX = (index) => {
        return padding.left + (index / (sortedDates.length - 1)) * graphWidth;
    };

    const getY = (count) => {
        if (count === null || count === undefined) return null;
        return chartHeight - padding.bottom - (count / maxCount) * graphHeight;
    };

    // Créer les points du graphique
    let linePath = '';
    let areaPath = '';
    let validPoints = [];

    chartData.forEach((item, index) => {
        if (item.hasData) {
            const x = getX(index);
            const y = getY(item.count);
            validPoints.push({ x, y, count: item.count, date: item.date, index });

            if (validPoints.length === 1) {
                linePath += `M ${x} ${y}`;
                areaPath += `M ${x} ${y}`;
            } else {
                linePath += ` L ${x} ${y}`;
                areaPath += ` L ${x} ${y}`;
            }
        }
    });

    // Fermer le chemin pour l'aire
    if (validPoints.length > 0) {
        const lastPoint = validPoints[validPoints.length - 1];
        const firstPoint = validPoints[0];
        areaPath += ` L ${lastPoint.x} ${chartHeight - padding.bottom} L ${firstPoint.x} ${chartHeight - padding.bottom} Z`;
    }

    // Créer les lignes de la grille
    const gridLines = [];
    for (let i = 0; i <= 5; i++) {
        const y = chartHeight - padding.bottom - (i / 5) * graphHeight;
        const value = Math.round((i / 5) * maxCount * 10) / 10;
        gridLines.push(`
            <line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" 
                  stroke="#e2e8f0" stroke-width="1" stroke-dasharray="5,5" />
            <text x="${padding.left - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748b">
                ${value}
            </text>
        `);
    }

    // Créer les marqueurs de dates
    const dateMarkers = [];
    const step = Math.max(1, Math.floor(sortedDates.length / 8));
    chartData.forEach((item, index) => {
        if (index % step === 0 || index === sortedDates.length - 1) {
            const x = getX(index);
            dateMarkers.push(`
                <line x1="${x}" y1="${chartHeight - padding.bottom}" x2="${x}" y2="${chartHeight - padding.bottom + 5}" 
                      stroke="#94a3b8" stroke-width="1" />
                <text x="${x}" y="${chartHeight - padding.bottom + 20}" text-anchor="middle" 
                      font-size="9" fill="#475569" transform="rotate(45, ${x}, ${chartHeight - padding.bottom + 20})">
                    ${item.date.substring(0, 5)}
                </text>
            `);
        }
    });

    // Créer les points de données avec tooltips
    const dataPoints = validPoints.map(point => {
        let dotColor = '#22c55e';
        if (point.count >= 8) dotColor = '#a855f7';      // VIOLET pour excès de charge
        else if (point.count >= 4) dotColor = '#22c55e';  // Vert pour ≥4
        else if (point.count === 3) dotColor = '#eab308'; // Jaune
        else if (point.count === 2) dotColor = '#f59e0b'; // Orange
        else if (point.count === 1) dotColor = '#f97316'; // Orange clair
        else dotColor = '#ef4444';                         // Rouge pour 0

        return `
            <circle cx="${point.x}" cy="${point.y}" r="6" fill="white" 
                    stroke="${dotColor}" stroke-width="2" 
                    style="cursor: pointer; transition: r 0.2s;"
                    onmouseover="this.setAttribute('r', '8')"
                    onmouseout="this.setAttribute('r', '6')">
                <title>${point.date}: ${point.count} atteinte${point.count > 1 ? 's' : ''}</title>
            </circle>
            <circle cx="${point.x}" cy="${point.y}" r="3" fill="${dotColor}" 
                    style="pointer-events: none;" />
        `;
    }).join('');

    // Créer les lignes du tableau
    let tableRows = '';
    sortedDates.forEach(date => {
        const day = dailyData[date];

        // Déterminer la couleur selon le nombre d'atteintes
        let bgColor = '#ffffff';
        let badgeColor = '#64748b';
        let textColor = '#475569';

        if (!day.hasData) {
            bgColor = '#f8fafc';
            badgeColor = '#94a3b8';
            textColor = '#64748b';
        } 
        // NOUVEAU : ≥8 atteintes (EXCÈS DE CHARGE) - VIOLET
        else if (day.nominalCount >= 8) {
            bgColor = '#f5f3ff';
            badgeColor = '#a855f7';
            textColor = '#6d28d9';
        }
        else if (day.nominalCount >= 4) {
            bgColor = '#f0fdf4';
            badgeColor = '#22c55e';
            textColor = '#166534';
        }
        else if (day.nominalCount === 3) {
            bgColor = '#fef9c3';
            badgeColor = '#eab308';
            textColor = '#854d0e';
        }
        else if (day.nominalCount === 2) {
            bgColor = '#fef3c7';
            badgeColor = '#f59e0b';
            textColor = '#92400e';
        }
        else if (day.nominalCount === 1) {
            bgColor = '#fff7ed';
            badgeColor = '#f97316';
            textColor = '#9a3412';
        }
        else {
            bgColor = '#fef2f2';
            badgeColor = '#ef4444';
            textColor = '#b91c1c';
        }

        // Formatage des échantillons
        let samplesHTML = '';
        if (!day.hasData) {
            samplesHTML = `<span style="color: #94a3b8; font-size: 11px; font-style: italic;">Aucune donnée</span>`;
        } else if (day.samples.length > 0) {
            samplesHTML = day.samples.map(sample =>
                `<span style="display: inline-block; background: white; padding: 4px 10px; 
                          border-radius: 20px; font-size: 11px; font-weight: 600; color: ${badgeColor};
                          border: 1px solid ${badgeColor}40; margin-right: 6px; margin-bottom: 4px;
                          box-shadow: 0 2px 4px rgba(0,0,0,0.02); white-space: nowrap;">
                    ${sample.heure} → ${sample.tension.toFixed(1)}V
                </span>`
            ).join('');
        } else {
            samplesHTML = `<span style="color: #94a3b8; font-size: 11px; font-style: italic;">Aucune atteinte</span>`;
        }

        tableRows += `
            <tr style="background: ${bgColor}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 14px 12px; font-weight: 600; color: ${!day.hasData ? '#94a3b8' : '#1e293b'}; 
                          font-size: 13px; white-space: nowrap;">
                    ${date}
                    ${!day.hasData ? `<span style="margin-left: 8px; font-size: 10px; color: #94a3b8;">(pas de données)</span>` : ''}
                </td>
                <td style="padding: 14px 12px; text-align: center;">
                    <span style="display: inline-block; background: ${badgeColor}; color: white; 
                             padding: 6px 14px; border-radius: 30px; font-size: 14px; font-weight: 700;
                             min-width: 40px; box-shadow: 0 4px 8px ${badgeColor}60;
                             opacity: ${!day.hasData ? '0.5' : '1'};">
                        ${day.hasData ? day.nominalCount : '-'}
                    </span>
                </td>
                <td style="padding: 14px 12px; text-align: left;">
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                        ${samplesHTML}
                    </div>
                </td>
             </tr>
        `;
    });

    // Créer le HTML des barres de progression AVEC LE 6ÈME TABLEAU (EXCÈS DE CHARGE)
    const progressBarsHTML = `
        <div style="background: white; border-radius: 20px; padding: 24px; margin-bottom: 30px; 
                    border: 2px solid #e2e8f0; box-shadow: 0 8px 20px rgba(0,0,0,0.05);">
            
            <!-- En-tête -->
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                          border-radius: 14px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 24px; color: white;">📊</span>
                </div>
                <div>
                    <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a;">
                        Répartition des Atteintes Journalières
                    </h4>
                    <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
                        ${daysWithData} jour(s) avec données · ${totalNominalHits} atteinte(s) totales
                        ${daysWithoutData > 0 ? ` · ${daysWithoutData} jour(s) sans données (${percentWithoutData}%)` : ''}
                    </div>
                </div>
            </div>

            <!-- Grille des pourcentages - 6 TABLEAUX MAINTENANT -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 25px;">
                
                <!-- NOUVEAU : ≥8 atteintes (EXCÈS DE CHARGE) - VIOLET -->
                <div style="background: linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%); 
                          border-radius: 16px; padding: 16px; border-left: 5px solid #a855f7;
                          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.15);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 20px; height: 20px; background: #a855f7; border-radius: 6px;"></span>
                            <span style="font-weight: 600; color: #6d28d9;">≥8 atteintes</span>
                        </div>
                        <span style="font-size: 24px; font-weight: 800; color: #a855f7;">${percent8Plus}%</span>
                    </div>
                    <div style="background: #e2e8f0; height: 12px; border-radius: 20px; overflow: hidden; margin: 10px 0;">
                        <div style="width: ${percent8Plus}%; height: 100%; background: linear-gradient(90deg, #a855f7, #7e22ce); 
                                  border-radius: 20px; transition: width 0.5s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                        <span>${daysWith8Plus} jour(s)</span>
                        <span>🟣 Excès de charge</span>
                    </div>
                </div>

                <!-- ≥4 atteintes (Vert) -->
                <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%); 
                          border-radius: 16px; padding: 16px; border-left: 5px solid #22c55e;
                          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 20px; height: 20px; background: #22c55e; border-radius: 6px;"></span>
                            <span style="font-weight: 600; color: #166534;">≥4 atteintes</span>
                        </div>
                        <span style="font-size: 24px; font-weight: 800; color: #22c55e;">${percent4Plus}%</span>
                    </div>
                    <div style="background: #e2e8f0; height: 12px; border-radius: 20px; overflow: hidden; margin: 10px 0;">
                        <div style="width: ${percent4Plus}%; height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); 
                                  border-radius: 20px; transition: width 0.5s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                        <span>${daysWith4Plus} jour(s)</span>
                        <span>⭐ Excellente</span>
                    </div>
                </div>

                <!-- 3 atteintes (Jaune/Orange) -->
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #ffffff 100%); 
                          border-radius: 16px; padding: 16px; border-left: 5px solid #eab308;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 20px; height: 20px; background: #eab308; border-radius: 6px;"></span>
                            <span style="font-weight: 600; color: #854d0e;">3 atteintes</span>
                        </div>
                        <span style="font-size: 24px; font-weight: 800; color: #eab308;">${percent3}%</span>
                    </div>
                    <div style="background: #e2e8f0; height: 12px; border-radius: 20px; overflow: hidden; margin: 10px 0;">
                        <div style="width: ${percent3}%; height: 100%; background: linear-gradient(90deg, #eab308, #ca8a04); 
                                  border-radius: 20px; transition: width 0.5s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                        <span>${daysWith3} jour(s)</span>
                        <span>👍 Très bien</span>
                    </div>
                </div>

                <!-- 2 atteintes (Orange) -->
                <div style="background: linear-gradient(135deg, #ffedd5 0%, #ffffff 100%); 
                          border-radius: 16px; padding: 16px; border-left: 5px solid #f59e0b;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 20px; height: 20px; background: #f59e0b; border-radius: 6px;"></span>
                            <span style="font-weight: 600; color: #92400e;">2 atteintes</span>
                        </div>
                        <span style="font-size: 24px; font-weight: 800; color: #f59e0b;">${percent2}%</span>
                    </div>
                    <div style="background: #e2e8f0; height: 12px; border-radius: 20px; overflow: hidden; margin: 10px 0;">
                        <div style="width: ${percent2}%; height: 100%; background: linear-gradient(90deg, #f59e0b, #d97706); 
                                  border-radius: 20px; transition: width 0.5s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                        <span>${daysWith2} jour(s)</span>
                        <span>🟡 Correct</span>
                    </div>
                </div>

                <!-- 1 atteinte (Orange clair) -->
                <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffffff 100%); 
                          border-radius: 16px; padding: 16px; border-left: 5px solid #f97316;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 20px; height: 20px; background: #f97316; border-radius: 6px;"></span>
                            <span style="font-weight: 600; color: #9a3412;">1 atteinte</span>
                        </div>
                        <span style="font-size: 24px; font-weight: 800; color: #f97316;">${percent1}%</span>
                    </div>
                    <div style="background: #e2e8f0; height: 12px; border-radius: 20px; overflow: hidden; margin: 10px 0;">
                        <div style="width: ${percent1}%; height: 100%; background: linear-gradient(90deg, #f97316, #ea580c); 
                                  border-radius: 20px; transition: width 0.5s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                        <span>${daysWith1} jour(s)</span>
                        <span>⚠️ Faible</span>
                    </div>
                </div>

                <!-- 0 atteinte (Rouge) -->
                <div style="background: linear-gradient(135deg, #fee2e2 0%, #ffffff 100%); 
                          border-radius: 16px; padding: 16px; border-left: 5px solid #ef4444;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 20px; height: 20px; background: #ef4444; border-radius: 6px;"></span>
                            <span style="font-weight: 600; color: #b91c1c;">0 atteinte</span>
                        </div>
                        <span style="font-size: 24px; font-weight: 800; color: #ef4444;">${percent0}%</span>
                    </div>
                    <div style="background: #e2e8f0; height: 12px; border-radius: 20px; overflow: hidden; margin: 10px 0;">
                        <div style="width: ${percent0}%; height: 100%; background: linear-gradient(90deg, #ef4444, #dc2626); 
                                  border-radius: 20px; transition: width 0.5s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                        <span>${daysWith0} jour(s)</span>
                        <span>🔴 Faible</span>
                    </div>
                </div>
            </div>
    `;

    // Le reste de la fonction reste identique (retour HTML)
    return `
        <div style="background: linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%); 
                    border-radius: 20px; padding: 24px; margin-top: 25px;
                    border: 1px solid #86efac; box-shadow: 0 12px 30px rgba(34, 197, 94, 0.2);">
            
            <!-- En-tête du card -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 52px; height: 52px; background: linear-gradient(145deg, #22c55e, #16a34a); 
                              border-radius: 16px; display: flex; align-items: center; justify-content: center; 
                              box-shadow: 0 8px 16px #22c55e80;">
                        <span style="font-size: 28px; color: white;">⚡</span>
                    </div>
                    <div>
                        <h4 style="margin: 0; font-size: 18px; font-weight: 800; color: #166534; display: flex; align-items: center; gap: 12px;">
                            Tension ≥ ${targetTension.toFixed(1)}V (${systemType})
                            <span style="background: #166534; color: white; padding: 6px 16px; border-radius: 40px; font-size: 12px; font-weight: 600;">
                                🎯 ${totalNominalHits} atteintes
                            </span>
                        </h4>
                        <div style="margin-top: 6px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;">
                            <span style="font-size: 12px; color: #15803d; background: white; padding: 4px 14px; 
                                      border-radius: 30px; border: 1px solid #86efac;">
                                📊 ${percentageNominal}% des mesures
                            </span>
                            <span style="font-size: 12px; color: #15803d;">
                                🏆 ${daysWithNominal}/${sortedDates.length} jours avec atteinte
                            </span>
                            <span style="font-size: 12px; color: #64748b; background: white; padding: 4px 14px; 
                                      border-radius: 30px; border: 1px solid #cbd5e1;">
                                📅 ${daysWithData}/${sortedDates.length} jours avec données
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- SECTION BARRES DE PROGRESSION AVEC LE 6ÈME TABLEAU -->
            ${progressBarsHTML}
            
            <!-- Tableau scrollable (reste identique) -->
            <div style="background: white; border-radius: 16px; border: 1px solid #86efac; overflow: hidden;
                      box-shadow: 0 8px 20px rgba(0,0,0,0.05); margin-bottom: 20px;">
                <div style="max-height: 400px; overflow-y: auto; overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead style="position: sticky; top: 0; background: #f0fdf4; z-index: 10;">
                            <tr>
                                <th style="padding: 16px 12px; text-align: left; font-weight: 700; color: #166534; 
                                         border-bottom: 2px solid #86efac; background: #f0fdf4; font-size: 13px;
                                         white-space: nowrap;">
                                    📅 Date
                                </th>
                                <th style="padding: 16px 12px; text-align: center; font-weight: 700; color: #166534; 
                                         border-bottom: 2px solid #86efac; background: #f0fdf4; font-size: 13px;
                                         white-space: nowrap;">
                                    ⚡ Atteintes ≥${targetTension.toFixed(1)}V
                                </th>
                                <th style="padding: 16px 12px; text-align: left; font-weight: 700; color: #166534; 
                                         border-bottom: 2px solid #86efac; background: #f0fdf4; font-size: 13px;">
                                    🔍 Heures d'atteinte
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- GRAPHIQUE EN LIGNE (reste identique) -->
            <div style="background: white; border-radius: 16px; border: 1px solid #86efac; padding: 20px; box-shadow: 0 8px 20px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 18px;">📈</span>
                        <span style="font-weight: 700; color: #166534; font-size: 14px;">
                            Évolution quotidienne des atteintes
                        </span>
                    </div>
                    <div style="display: flex; gap: 16px; font-size: 11px;">
                        <span style="display: flex; align-items: center; gap: 4px;">
                            <span style="width: 20px; height: 3px; background: #22c55e; border-radius: 2px;"></span>
                            Courbe d'atteintes
                        </span>
                    </div>
                </div>
                
                <!-- Conteneur du graphique SVG avec scroll horizontal -->
                <div style="overflow-x: auto; width: auto; padding: 10px 0;">
                    <svg width="${Math.max(800, sortedDates.length * 35)}" height="${chartHeight + 30}" 
                        viewBox="0 0 ${Math.max(800, sortedDates.length * 35)} ${chartHeight + 30}"
                        style="display: block; min-width: ${Math.max(800, sortedDates.length * 35)}px;">
                        
                        <!-- Fond du graphique -->
                        <rect x="0" y="0" width="${Math.max(800, sortedDates.length * 35)}" 
                            height="${chartHeight + 30}" fill="white" />
                        
                        <!-- Grille horizontale -->
                        ${gridLines.join('')}
                        
                        <!-- Axe X -->
                        <line x1="${padding.left}" y1="${chartHeight - padding.bottom}" 
                            x2="${Math.max(800, sortedDates.length * 35) - padding.right}" 
                            y2="${chartHeight - padding.bottom}" 
                            stroke="#94a3b8" stroke-width="2" />
                        
                        <!-- Marqueurs de dates -->
                        ${dateMarkers.join('')}
                        
                        <!-- Aire sous la courbe (dégradé) -->
                        <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#22c55e" stop-opacity="0.2" />
                                <stop offset="100%" stop-color="#22c55e" stop-opacity="0.05" />
                            </linearGradient>
                        </defs>
                        <path d="${areaPath}" fill="url(#gradient)" stroke="none" />
                        
                        <!-- Ligne principale -->
                        <path d="${linePath}" fill="none" stroke="#22c55e" stroke-width="3" 
                            stroke-linecap="round" stroke-linejoin="round" />
                        
                        <!-- Points de données -->
                        ${dataPoints}
                        
                        <!-- Légende des seuils -->
                        <text x="${padding.left}" y="${padding.top - 5}" font-size="10" fill="#64748b">
                            Nombre d'atteintes
                        </text>
                    </svg>
                </div>
                
                <!-- Indicateurs de seuils -->
                <div style="display: flex; gap: 20px; margin-top: 15px; padding: 10px; 
                          background: #f8fafc; border-radius: 10px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 12px; height: 12px; background: #22c55e; border-radius: 50%;"></span>
                        <span style="font-size: 11px; color: #166534;">Points de données (avec valeur)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 20px; height: 3px; background: #22c55e; border-radius: 2px;"></span>
                        <span style="font-size: 11px; color: #166534;">Courbe d'évolution</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 20px; height: 3px; background: #22c55e; opacity: 0.2; border-radius: 2px;"></span>
                        <span style="font-size: 11px; color: #64748b;">Aire de tendance</span>
                    </div>
                </div>
                
            </div>
            
            <!-- Légende des couleurs AVEC LE VIOLET POUR ≥8 -->
            <div style="display: flex; gap: 20px; margin-top: 20px; padding: 12px 16px; 
                      background: white; border-radius: 12px; border: 1px solid #86efac; font-size: 12px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 14px; height: 14px; background: #a855f7; border-radius: 4px;"></span>
                    <span style="color: #6d28d9;">≥8 atteintes (Excès de charge)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 14px; height: 14px; background: #22c55e; border-radius: 4px;"></span>
                    <span style="color: #166534;">≥4 atteintes</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 14px; height: 14px; background: #eab308; border-radius: 4px;"></span>
                    <span style="color: #854d0e;">3 atteintes</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 14px; height: 14px; background: #f59e0b; border-radius: 4px;"></span>
                    <span style="color: #92400e;">2 atteintes</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 14px; height: 14px; background: #f97316; border-radius: 4px;"></span>
                    <span style="color: #9a3412;">1 atteinte</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 14px; height: 14px; background: #ef4444; border-radius: 4px;"></span>
                    <span style="color: #b91c1c;">0 atteinte</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
                    <span style="width: 14px; height: 14px; background: repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 5px, #e2e8f0 5px, #e2e8f0 10px); border-radius: 4px;"></span>
                    <span style="color: #475569;">Pas de données</span>
                </div>
            </div>
            
            <!-- Note explicative -->
            <div style="margin-top: 16px; padding: 10px 16px; background: white; border-radius: 10px; 
                      border: 1px dashed #86efac; font-size: 12px; color: #15803d; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">ℹ️</span>
                <span>
                    <strong>Tension ≥ ${targetTension.toFixed(1)}V</strong> • 
                    Comptage des mesures où la tension atteint ou dépasse ${targetTension.toFixed(1)}V • 
                    <strong style="color: #a855f7;">🟣 Excès de charge détecté pour ≥8 atteintes</strong>
                </span>
            </div>
        </div>
    `;
}

// Fonction utilitaire pour convertir l'heure en minutes
function convertTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

// ===== FONCTIONS D'INTERACTION POUR LE FILTRE DE DATES DU GRAPHIQUE TENSION =====

// Récupère et mémorise la liste triée de toutes les dates disponibles pour le graphique tension
function getSortedTensionDates() {
    const context = window.tensionEvolutionContext || {};
    let allDates = (context.allDates && context.allDates.length)
        ? context.allDates.slice()
        : (allClientsHourlyMatrix.dates || []).slice();

    if (!allDates.length) return [];

    allDates.sort((a, b) => {
        const da = new Date(a.split('/').reverse().join('-'));
        const db = new Date(b.split('/').reverse().join('-'));
        return da - db;
    });

    context.sortedDates = allDates;
    window.tensionEvolutionContext = context;
    return allDates;
}

// Met à jour la liste des dates possibles pour la fin en fonction de la date de début (fenêtre max 7 jours)
// ======================== FONCTIONS DE FILTRAGE POUR LE GRAPHIQUE TENSION ========================
function onTensionStartDateChange() {
    const startSelect = document.getElementById('tension-start-date');
    const endSelect = document.getElementById('tension-end-date');
    if (!startSelect || !endSelect) return;

    const sortedDates = getSortedTensionDates();
    if (!sortedDates.length) return;

    const selectedStart = startSelect.value || sortedDates[0];
    let startIndex = sortedDates.indexOf(selectedStart);
    if (startIndex === -1) {
        startIndex = 0;
        startSelect.value = sortedDates[0];
    }

    // On limite à 7 jours maximum (début inclus)
    const maxEndIndex = Math.min(startIndex + 6, sortedDates.length - 1);
    const allowedDates = sortedDates.slice(startIndex, maxEndIndex + 1);

    // 🔴 MODIFICATION : Sélectionner automatiquement la dernière date de la plage
    endSelect.innerHTML = allowedDates.map((date, index) => {
        const isLast = index === allowedDates.length - 1;
        return `<option value="${date}" ${isLast ? 'selected' : ''}>${date}</option>`;
    }).join('');
}

function applyTensionDateFilter() {
    const startSelect = document.getElementById('tension-start-date');
    const endSelect = document.getElementById('tension-end-date');
    if (!startSelect || !endSelect) return;

    const startDate = startSelect.value;
    const endDate = endSelect.value;

    if (!startDate || !endDate) return;

    // Récupérer les dates triées
    const allDates = getSortedTensionDates();
    if (!allDates.length) return;

    const startIndex = allDates.indexOf(startDate);
    const endIndex = allDates.indexOf(endDate);

    if (startIndex === -1 || endIndex === -1) return;

    const realStartIndex = Math.min(startIndex, endIndex);
    const realEndIndex = Math.max(startIndex, endIndex);

    // 🔴 MODIFICATION : S'assurer qu'on ne dépasse pas 7 jours
    if (realEndIndex - realStartIndex > 6) {
        alert('La période ne peut pas dépasser 7 jours. Veuillez choisir une plage plus petite.');
        return;
    }

    const selectedRange = allDates.slice(realStartIndex, realEndIndex + 1);

    // Mettre à jour le badge d'information
    const startLabel = document.getElementById('tension-range-start-label');
    const endLabel = document.getElementById('tension-range-end-label');
    if (startLabel && endLabel) {
        startLabel.textContent = selectedRange[0];
        endLabel.textContent = selectedRange[selectedRange.length - 1];
    }

    // Recréer le graphique sur la plage sélectionnée
    const context = window.tensionEvolutionContext || {};
    createTensionEvolutionChart(selectedRange, context.tensionResults, context.systemType);
}

function resetTensionDateFilter() {
    const context = window.tensionEvolutionContext || {};
    const allDates = getSortedTensionDates();
    if (!allDates.length) return;

    // 🔴 MODIFICATION : Revenir aux 7 derniers jours
    const last7Days = allDates.slice(-7);
    const firstDate = last7Days[0];
    const lastDate = last7Days[last7Days.length - 1];

    // Mettre à jour les sélecteurs
    const startSelect = document.getElementById('tension-start-date');
    const endSelect = document.getElementById('tension-end-date');
    if (startSelect) startSelect.value = firstDate;

    // Recalculer les options de fin
    if (startSelect && endSelect) {
        onTensionStartDateChange(); // Cela mettra à jour les options et sélectionnera lastDate
    }

    // Mettre à jour le badge
    const startLabel = document.getElementById('tension-range-start-label');
    const endLabel = document.getElementById('tension-range-end-label');
    if (startLabel && endLabel) {
        startLabel.textContent = firstDate;
        endLabel.textContent = lastDate;
    }

    // Revenir à l'affichage des 7 derniers jours
    createTensionEvolutionChart(last7Days, context.tensionResults, context.systemType);
}

// Fonction utilitaire pour convertir l'heure en minutes
function convertTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}
// ======================== FILTRE GLOBAL PAR DATES ========================
// Crée le filtre global des données avec tous les filtres sur la même ligne
function createGlobalDateFilter() {
    const allDates = allClientsHourlyMatrix.dates || [];
    if (allDates.length === 0) return null;

    // Vérifier si un filtre est actif
    const isFilterActive = window.filteredDates &&
        window.filteredDates.length > 0 &&
        window.filteredDates.length < allDates.length;

    // Déterminer la plage de dates à afficher
    let dateRangeText = '';
    let fullRangeText = '';

    // Trier toutes les dates pour référence
    const sortedAllDates = [...allDates].sort((a, b) => {
        const [da, ma, ya] = a.split('/');
        const [db, mb, yb] = b.split('/');
        return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
    });
    fullRangeText = `${sortedAllDates[0]} → ${sortedAllDates[sortedAllDates.length - 1]}`;

    if (isFilterActive) {
        // Trier les dates filtrées
        const sortedFilteredDates = [...window.filteredDates].sort((a, b) => {
            const [da, ma, ya] = a.split('/');
            const [db, mb, yb] = b.split('/');
            return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
        });

        const firstDate = sortedFilteredDates[0];
        const lastDate = sortedFilteredDates[sortedFilteredDates.length - 1];
        dateRangeText = `${firstDate} → ${lastDate}`;
    } else {
        dateRangeText = fullRangeText;
    }

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
                            ${isFilterActive ? ` · <strong>${window.filteredDates.length}</strong> sélectionné${window.filteredDates.length !== 1 ? 's' : ''}` : ''}
                        </div>
                        <!-- Affichage de la plage de dates -->
                        <div style="font-size: 13px; color: #2563eb; margin-top: 4px; font-weight: 500; background: #dbeafe; padding: 4px 10px; border-radius: 20px; display: inline-block;">
                            📅 ${dateRangeText}
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
            
            <!-- TOUS LES FILTRES SUR UNE SEULE LIGNE -->
            <div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap;">
                
                <!-- 1. FILTRE PAR PÉRIODE (30% de largeur) -->
                <div class="filter-group" style="flex: 3; min-width: 250px;">
                    <div class="filter-group-title">
                        <span>📅</span> Période
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <div style="flex: 1;">
                            <input type="date" id="filter-start-date" class="filter-date-input" 
                                   style="width: 100%; padding: 8px 10px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 12px;">
                        </div>
                        <div style="flex: 1;">
                            <input type="date" id="filter-end-date" class="filter-date-input" 
                                   style="width: 100%; padding: 8px 10px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 12px;">
                        </div>
                    </div>
                </div>
                
                <!-- 2. FILTRE PAR ANNÉE/MOIS (20% de largeur) -->
                <div class="filter-group" style="flex: 2; min-width: 180px;">
                    <div class="filter-group-title">
                        <span>🗓️</span> Année/Mois
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <select id="filter-year" class="filter-select" 
                                style="flex: 1; padding: 8px 10px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 12px; background: white;">
                            <option value="all">Année</option>
                            ${[...new Set(allDates.map(d => d.split('/')[2]))].sort((a, b) => b - a).map(year =>
        `<option value="${year}">${year}</option>`
    ).join('')}
                        </select>
                        <select id="filter-month" class="filter-select" 
                                style="flex: 1; padding: 8px 10px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 12px; background: white;">
                            <option value="all">Mois</option>
                            <option value="1">Jan</option>
                            <option value="2">Fév</option>
                            <option value="3">Mar</option>
                            <option value="4">Avr</option>
                            <option value="5">Mai</option>
                            <option value="6">Juin</option>
                            <option value="7">Juil</option>
                            <option value="8">Aoû</option>
                            <option value="9">Sep</option>
                            <option value="10">Oct</option>
                            <option value="11">Nov</option>
                            <option value="12">Déc</option>
                        </select>
                    </div>
                </div>
                
                <!-- 3. SÉLECTION DE DATES SPÉCIFIQUES (50% de largeur) -->
                <div class="filter-group" style="flex: 5; min-width: 300px;">
                    <div class="filter-group-title">
                        <span>📌</span> Sélection de dates spécifiques
                        <span style="margin-left: 10px; font-size: 11px; color: #64748b; font-weight: normal;">
                            ${allDates.length} date${allDates.length > 1 ? 's' : ''}
                        </span>
                    </div>
                    
                    <!-- Boutons de sélection rapide -->
                    <div style="display: flex; gap: 5px; margin-bottom: 8px; flex-wrap: wrap;">
                        <button class="quick-select-btn" onclick="selectLastNDays(3)" style="padding: 4px 8px; font-size: 11px;">3j</button>
                        <button class="quick-select-btn" onclick="selectLastNDays(7)" style="padding: 4px 8px; font-size: 11px;">7j</button>
                        <button class="quick-select-btn" onclick="selectLastNDays(15)" style="padding: 4px 8px; font-size: 11px;">15j</button>
                        <button class="quick-select-btn" onclick="selectLastNDays(30)" style="padding: 4px 8px; font-size: 11px;">30j</button>
                        <button id="select-all-dates" class="date-select-btn date-select-btn-primary" style="padding: 4px 8px; font-size: 11px;">✅ Tout</button>
                        <button id="deselect-all-dates" class="date-select-btn date-select-btn-secondary" style="padding: 4px 8px; font-size: 11px;">❌ Rien</button>
                    </div>
                    
                    <!-- Grille des dates (en dessous) -->
                    <div class="date-checkbox-container" style="
                        max-height: 100px;
                        overflow-y: auto;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 5px;
                        padding: 5px;
                        background: white;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                    ">
                        ${allDates.map(date => {
        const isChecked = window.filteredDates ?
            window.filteredDates.includes(date) : true;
        const labelClass = isChecked ? 'date-checkbox-label checked' : 'date-checkbox-label';

        return `
                                <label class="${labelClass}" style="
                                    display: inline-flex;
                                    align-items: center;
                                    gap: 3px;
                                    padding: 3px 8px;
                                    background: ${isChecked ? '#dbeafe' : '#f1f5f9'};
                                    border-radius: 15px;
                                    font-size: 11px;
                                    cursor: pointer;
                                    border: 1px solid ${isChecked ? '#3b82f6' : '#cbd5e1'};
                                ">
                                    <input type="checkbox" class="date-checkbox" value="${date}" ${isChecked ? 'checked' : ''} style="display: none;">
                                    <span>${date}</span>
                                </label>
                            `;
    }).join('')}
                    </div>
                    
                    <!-- Compteur compact -->
                    <div style="
                        margin-top: 8px;
                        font-size: 11px;
                        color: #475569;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <span>
                            📊 <strong id="selected-count-display">${document.querySelectorAll('.date-checkbox:checked').length}</strong> sélectionnée(s)
                        </span>
                        <span style="color: #64748b;">
                            Total: ${allDates.length}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Indicateur de sélection -->
            <div id="filter-indicator" class="filter-indicator ${isFilterActive ? 'filtered' : ''}" style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 16px;
                background: ${isFilterActive ? '#dcfce7' : '#f0f9ff'};
                border-radius: 8px;
                border: 2px solid ${isFilterActive ? '#86efac' : '#bae6fd'};
                margin-top: 15px;
            ">
                <span class="filter-indicator-icon">📊</span>
                <div class="filter-indicator-info" style="flex: 1;">
                    <div class="filter-indicator-title" style="font-weight: 700; color: ${isFilterActive ? '#166534' : '#0369a1'}; font-size: 13px;">
                        <span id="selected-dates-count">${isFilterActive ? window.filteredDates.length : allDates.length}</span>
                        jour${(isFilterActive ? window.filteredDates.length : allDates.length) !== 1 ? 's' : ''} sélectionné${(isFilterActive ? window.filteredDates.length : allDates.length) !== 1 ? 's' : ''}
                    </div>
                    <div class="filter-indicator-description" style="font-size: 11px; color: ${isFilterActive ? '#166534' : '#0c4a6e'};">
                        Période: <strong>${dateRangeText}</strong>
                    </div>
                </div>
                ${isFilterActive ? `
                <button onclick="resetAllFilters()" style="
                    background: white; 
                    border: 1px solid #cbd5e1; 
                    padding: 5px 12px; 
                    border-radius: 20px; 
                    font-size: 11px; 
                    cursor: pointer; 
                    color: #64748b; 
                    font-weight: 500;
                ">
                    Effacer
                </button>
                ` : ''}
            </div>
        </div>
    `;
}
// NOUVELLE FONCTION : Sélectionner les N derniers jours
function selectLastNDays(n) {
    const allDates = allClientsHourlyMatrix.dates || [];
    if (allDates.length === 0) return;

    // Trier les dates par ordre chronologique (du plus ancien au plus récent)
    const sortedDates = [...allDates].sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateA - dateB;
    });

    // Prendre les N dernières dates
    const lastNDates = sortedDates.slice(-n);

    // Mettre à jour les cases à cocher
    document.querySelectorAll('.date-checkbox').forEach(cb => {
        const isSelected = lastNDates.includes(cb.value);
        cb.checked = isSelected;

        // Mettre à jour la classe du label
        if (isSelected) {
            cb.parentElement.classList.add('checked');
        } else {
            cb.parentElement.classList.remove('checked');
        }
    });

    // Mettre à jour le compteur
    updateSelectedCount();

    // Optionnel : appliquer automatiquement le filtre
    // applyGlobalDateFilter();

    console.log(`✅ ${n} derniers jours sélectionnés: ${lastNDates.join(', ')}`);
}
// Mettre à jour la fonction updateSelectedCount pour afficher le compteur
function updateSelectedCount() {
    const selectedCount = document.querySelectorAll('.date-checkbox:checked').length;
    const totalCount = document.querySelectorAll('.date-checkbox').length;
    const countSpan = document.getElementById('selected-dates-count');

    if (countSpan) {
        countSpan.textContent = selectedCount;

        // Mettre à jour le compteur supplémentaire dans la section dates
        const counterDiv = document.querySelector('.filter-group:last-child div:last-child span strong');
        if (counterDiv) {
            counterDiv.textContent = selectedCount;
        }
    }
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

    // AJOUTEZ CES LIGNES ICI
    setTimeout(() => {
        if (matrixTableVisible) {
            const tableContainer = document.getElementById('matrix-table-container');
            if (tableContainer) {
                tableContainer.style.display = 'block';
            }
        }
    }, 200);

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
        /* MODIFICATION POUR LA GRILLE DE DATES */
        .date-checkbox-container {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important;
            gap: 8px !important;
            max-height: none !important;
            overflow-y: visible !important;
            height: auto !important;
            padding: 10px 0 !important;
        }
        
        /* Amélioration des labels pour meilleure visibilité */
        .date-checkbox-label {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 13px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        
        .date-checkbox-label:hover {
            border-color: #3b82f6;
            background: #f0f9ff;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(59,130,246,0.1);
        }
        
        .date-checkbox-label.checked {
            background: #3b82f6;
            border-color: #2563eb;
            color: white;
        }
        
        .date-checkbox-label.checked:hover {
            background: #2563eb;
        }
        
        .date-checkbox-label input[type="checkbox"] {
            width: 18px;
            height: 18px;
            cursor: pointer;
            accent-color: #3b82f6;
        }
        
        .date-checkbox-label.checked input[type="checkbox"] {
            accent-color: white;
        }
        
        /* Compteur amélioré */
        .date-counter {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            margin-top: 15px;
            font-size: 13px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        /* Responsive pour mobile */
        @media (max-width: 768px) {
            .date-checkbox-container {
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)) !important;
            }
            
            .date-checkbox-label {
                padding: 8px 10px;
                font-size: 12px;
            }
        }
        
        @media (max-width: 576px) {
            .date-checkbox-container {
                grid-template-columns: repeat(2, 1fr) !important;
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
    let hasAnyValidEvent = false;

    dates.forEach((date, dateIndex) => {
        const dateEvents = eventsByDate[date] || [];

        if (dateEvents.length === 0) return;

        // Séparer DP et DT
        const dpEvents = dateEvents.filter(e => e.type === 'DP');
        const dtEvents = dateEvents.filter(e => e.type === 'DT');

        // Grouper les événements en périodes continues
        const dpPeriods = groupEventsIntoPeriods(dpEvents);
        const dtPeriods = groupEventsIntoPeriods(dtEvents);

        // FILTRER LES PÉRIODES DE DURÉE NULLE (< 1 minute)
        const validDpPeriods = dpPeriods.filter(period => {
            const duration = calculateDurationMinutes(period.events[0].heure, period.events[period.events.length - 1].heure);
            return duration >= 1;
        });

        const validDtPeriods = dtPeriods.filter(period => {
            const duration = calculateDurationMinutes(period.events[0].heure, period.events[period.events.length - 1].heure);
            return duration >= 1;
        });

        // Calculer le nombre total d'événements valides pour cette date
        const totalValidEvents = (validDpPeriods.flatMap(p => p.events).length) +
            (validDtPeriods.flatMap(p => p.events).length);

        // Si aucun événement valide, afficher un message indiquant que tous ont été filtrés
        if (validDpPeriods.length === 0 && validDtPeriods.length === 0) {
            displayHTML += `
                <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; 
                      margin-bottom: ${dateIndex < dates.length - 1 ? '10px' : '0'}; 
                      padding: 12px 15px; opacity: 0.8;">
                    
                    <!-- En-tête de la date -->
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-weight: 700; color: #64748b; font-size: 14px;">
                            ${date}
                            <span style="font-size: 11px; color: #94a3b8; font-weight: normal; margin-left: 8px;">
                                ${dateEvents.length} événement${dateEvents.length !== 1 ? 's' : ''} détecté${dateEvents.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Message d'information -->
                    <div style="margin-top: 8px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; 
                          border-left: 3px solid #94a3b8; color: #475569; font-size: 12px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px;">ℹ️</span>
                        <span>
                            <strong>Aucun événement significatif</strong> — 
                            ${dateEvents.length === 1 ? 'L\'événement détecté a une durée de 0 minute' :
                    'Tous les événements détectés ont une durée de 0 minute'} 
                            et n'est pas considéré comme pertinent.
                        </span>
                    </div>
                </div>
            `;
            return;
        }

        hasAnyValidEvent = true;

        // Format compact pour les périodes DP filtrées
        let dpCompact = '';
        if (validDpPeriods.length > 0) {
            dpCompact = validDpPeriods.map(period => {
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

        // Format compact pour les périodes DT filtrées
        let dtCompact = '';
        if (validDtPeriods.length > 0) {
            dtCompact = validDtPeriods.map(period => {
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
                            ${totalValidEvents} événement${totalValidEvents !== 1 ? 's' : ''} significatif${totalValidEvents !== 1 ? 's' : ''}
                            ${dateEvents.length - totalValidEvents > 0 ?
                `<span style="color: #94a3b8; margin-left: 5px;">
                                    (${dateEvents.length - totalValidEvents} événement${dateEvents.length - totalValidEvents !== 1 ? 's' : ''} de 0mn filtré${dateEvents.length - totalValidEvents !== 1 ? 's' : ''})
                                </span>` : ''
            }
                        </span>
                    </div>
                    
                    <!-- Indicateurs rapides -->
                    <div style="display: flex; gap: 10px;">
                        ${validDpPeriods.length > 0 ? `
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <div style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></div>
                                <span style="font-size: 11px; color: #92400e; font-weight: 600;">
                                    ${validDpPeriods.flatMap(p => p.events).length} DP
                                </span>
                            </div>
                        ` : ''}
                        ${validDtPeriods.length > 0 ? `
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <div style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></div>
                                <span style="font-size: 11px; color: #991b1b; font-weight: 600;">
                                    ${validDtPeriods.flatMap(p => p.events).length} DT
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

    // Si aucun événement valide n'a été trouvé sur l'ensemble des dates
    if (!hasAnyValidEvent) {
        const totalEvents = Object.values(eventsByDate).flat().length;
        return `
            <div style="text-align: center; padding: 30px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                <div style="font-size: 48px; margin-bottom: 15px; color: #94a3b8;">📊</div>
                <div style="font-size: 16px; font-weight: 600; color: #475569; margin-bottom: 8px;">
                    Aucun événement de délestage significatif
                </div>
                <div style="font-size: 13px; color: #64748b;">
                    ${totalEvents > 0 ?
                `${totalEvents} événement${totalEvents !== 1 ? 's' : ''} détecté${totalEvents !== 1 ? 's' : ''} mais tous ont une durée de 0 minute et ne sont pas considérés comme pertinents.` :
                'Aucun événement de délestage détecté dans les fichiers analysés.'
            }
                </div>
            </div>
        `;
    }

    return displayHTML;
}

// Fonction utilitaire pour calculer la durée en minutes
function calculateDurationMinutes(startTime, endTime) {
    const startMinutes = convertTimeToMinutes(startTime);
    const endMinutes = convertTimeToMinutes(endTime);
    return endMinutes - startMinutes;
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

// Dans generateFilteredTableRows()
function generateFilteredTableRows() {
    if (!window.filteredDates || window.filteredDates.length === 0) {
        return generateAllClientsTableRows(0, allClientsHourlyMatrix.dates.length * allClientsHourlyMatrix.hours.length);
    }

    let rows = '';
    let rowIndex = 0;
    let displayIndex = 1;
    const itemsPerPage = window.allClientsItemsPerPage || 50;
    const currentPage = window.allClientsCurrentPage || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    const filteredDates = window.filteredDates;

    // Stocker les valeurs précédentes pour chaque client
    const previousValues = {};
    allClientsHourlyMatrix.clients.forEach(clientId => {
        previousValues[clientId] = null;
    });

    let previousDate = null;

    for (let i = 0; i < filteredDates.length; i++) {
        const date = filteredDates[i];

        // Si on change de jour, réinitialiser
        if (previousDate !== null && date !== previousDate) {
            allClientsHourlyMatrix.clients.forEach(clientId => {
                previousValues[clientId] = null;
            });
        }

        for (let j = 0; j < allClientsHourlyMatrix.hours.length; j++) {
            const hour = allClientsHourlyMatrix.hours[j];
            const key = `${date}_${hour}`;
            const rowData = allClientsHourlyMatrix.data[key] || {};

            // Récupérer la tension
            const tension = rowData.tension;
            const hasTension = tension !== null && tension !== undefined;

            // Calculer le cumul total et la consommation horaire
            let totalCumul = 0;
            let totalConsoHeure = 0;
            let hasEnergy = false;
            let hasPreviousForAnyClient = false;

            allClientsHourlyMatrix.clients.forEach(clientId => {
                const energie = rowData[`client_${clientId}`];
                if (energie !== null && energie !== undefined) {
                    const valeur = parseFloat(energie);
                    totalCumul += valeur;
                    hasEnergy = true;

                    // Calculer la consommation de l'heure
                    const previous = previousValues[clientId];
                    if (previous !== null && valeur >= previous) {
                        totalConsoHeure += (valeur - previous);
                        hasPreviousForAnyClient = true;
                    }

                    // Mettre à jour pour la prochaine heure
                    previousValues[clientId] = valeur;
                }
            });

            // Si ligne vide, passer
            if (!hasEnergy && !hasTension) {
                continue;
            }

            // Calculer l'intensité CORRIGÉE
            let intensity = null;
            if (hasTension && tension > 0 && totalConsoHeure > 0 && hasPreviousForAnyClient) {
                intensity = totalConsoHeure / tension;
            }

            // Déterminer la couleur
            let intensityColor = '#718096';
            if (intensity !== null) {
                if (intensity > 5) intensityColor = '#ef4444';
                else if (intensity > 2) intensityColor = '#f59e0b';
                else if (intensity > 0) intensityColor = '#10b981';
            }

            if (rowIndex >= startIndex && rowIndex < endIndex) {
                const tensionColor = hasTension ? getTensionColor(tension) : '#718096';

                rows += `
                    <tr>
                        <td class="row-index">${displayIndex}</td>
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
                        <td class="row-energy-sum" style="font-weight: bold; color: #2563eb;">
                            ${totalCumul > 0 ? totalCumul.toFixed(1) : '-'}
                        </td>
                        <td class="row-intensity" style="color: ${intensityColor}; font-weight: bold;">
                            ${intensity !== null ? intensity.toFixed(2) : '-'}
                        </td>
                    </tr>
                `;
                displayIndex++;
            }

            rowIndex++;
            if (rowIndex >= endIndex) break;
        }

        previousDate = date;
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

    allClientsHourlyMatrix.dates.forEach(date => {
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

    // === CALCULS DES STATISTIQUES D'ÉNERGIE ===
    let maxEnergyValue = 0;
    let maxEnergyDate = '';
    let totalEnergySum = 0;
    let daysWithEnergy = 0;

    Object.entries(energyDataByDay).forEach(([date, energy]) => {
        if (energy > 0) {
            totalEnergySum += energy;
            daysWithEnergy++;
        }
        if (energy > maxEnergyValue) {
            maxEnergyValue = energy;
            maxEnergyDate = date;
        }
    });

    const averageEnergyValue = daysWithEnergy > 0
        ? Math.round(totalEnergySum / daysWithEnergy)
        : 0;

    // Préparer les données paginées
    const itemsPerPage = window.allClientsItemsPerPage || 50;
    const currentPage = window.allClientsCurrentPage || 1;
    const totalItems = allClientsHourlyMatrix.dates.length * allClientsHourlyMatrix.hours.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    // === CALCULS DES STATISTIQUES DE TENSION ===
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
        if (tensionByDay[date].min === Infinity) {
            delete tensionByDay[date];
        }
    });

    // === DÉTECTION DU TYPE DE MONTAGE ===
    const systemType = parseFloat(averageTension) > 20 ? '24V' : '12V';
    const systemLimits = systemType === '24V'
        ? { min: 22, max: 31, ideal: { min: 24, max: 29 }, normal: 28, maxVariation: 5, alertThreshold: 3 }
        : { min: 11, max: 15, ideal: { min: 12, max: 14.5 }, normal: 14, maxVariation: 2.5, alertThreshold: 1.5 };

    // === ANALYSE DES ÉVÉNEMENTS DP/DT ===
    const dpdtEvents = analyzeDPDTEvents();
    let filteredDPDTEvents = dpdtEvents;
    if (window.filteredDates && window.filteredDates.length > 0) {
        filteredDPDTEvents = dpdtEvents.filter(event => window.filteredDates.includes(event.date));
    }
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
    let alertData = null;
    let stabilitySectionHTML = '';
    let filteredTensionResults = [];
    let totalNominalHits = 0;
    let daysWithNominal = 0;
    let daysWithData = 0;

    if (tensionResults && tensionResults.length > 0) {
        filteredTensionResults = window.filteredDates ?
            tensionResults.filter(item => window.filteredDates.includes(item.date)) :
            tensionResults;

        if (filteredTensionResults.length > 0) {
            stabilityData = analyzeTensionStability(filteredTensionResults);
            alertData = calculateAlertDays(filteredTensionResults);

            // Calcul des atteintes nominales
            const targetTension = systemType === '24V' ? 28.0 : 14.0;
            filteredTensionResults.forEach(item => {
                const tension = parseFloat(item.tension || item.valeur || 0);
                if (tension >= targetTension) totalNominalHits++;
            });

            const uniqueDates = [...new Set(filteredTensionResults.map(item => item.date))];
            daysWithNominal = uniqueDates.length;
            daysWithData = uniqueDates.length;
        }
    }

    // === ANALYSE DES ÉVÉNEMENTS COMBINÉS ENR + EC ===
    let combinedAnalysis = null;
    const hasEnrFiles = window.enrFiles && window.enrFiles.length > 0;
    const hasEcFiles = window.ecFiles && window.ecFiles.length > 0;

    if (hasEnrFiles || hasEcFiles) {
        try {
            combinedAnalysis = analyzeCombinedEvents(
                hasEnrFiles ? window.enrFiles : [],
                hasEcFiles ? window.ecFiles : []
            );
            console.log(`✅ Analyse combinée pour onglet TECHNIQUE: ${combinedAnalysis.allEvents.length} événements trouvés`);
        } catch (error) {
            console.error('❌ Erreur analyse combinée:', error);
        }
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

    // === CALCUL DES STATISTIQUES D'INTENSITÉ ===
    function calculateIntensityStats() {
        const intensityData = [];
        const intensityByHour = {};

        // Initialiser les stats par heure
        for (let h = 0; h < 24; h++) {
            const hour = `${h.toString().padStart(2, '0')}:00`;
            intensityByHour[hour] = {
                values: [],
                total: 0,
                count: 0,
                max: -Infinity,
                min: Infinity
            };
        }

        // Stocker les valeurs précédentes pour le calcul de l'intensité
        const previousValues = {};
        allClientsHourlyMatrix.clients.forEach(clientId => {
            previousValues[clientId] = null;
        });

        let previousDate = null;
        let maxIntensity = { value: 0, date: '', hour: '' };
        let minIntensity = { value: Infinity, date: '', hour: '' };
        let totalIntensity = 0;
        let intensityCount = 0;

        for (let i = 0; i < datesToUse.length; i++) {
            const date = datesToUse[i];

            // Réinitialiser au changement de jour
            if (previousDate !== null && date !== previousDate) {
                allClientsHourlyMatrix.clients.forEach(clientId => {
                    previousValues[clientId] = null;
                });
            }

            for (let j = 0; j < allClientsHourlyMatrix.hours.length; j++) {
                const hour = allClientsHourlyMatrix.hours[j];
                const key = `${date}_${hour}`;
                const rowData = allClientsHourlyMatrix.data[key] || {};

                const tension = rowData.tension;
                if (!tension || tension <= 0) continue;

                // Calculer la consommation horaire
                let totalConsoHeure = 0;
                let hasValidData = false;

                allClientsHourlyMatrix.clients.forEach(clientId => {
                    const energie = rowData[`client_${clientId}`];
                    if (energie !== null && energie !== undefined) {
                        const valeur = parseFloat(energie);
                        const previous = previousValues[clientId];
                        if (previous !== null && valeur >= previous) {
                            totalConsoHeure += (valeur - previous);
                            hasValidData = true;
                        }
                        previousValues[clientId] = valeur;
                    }
                });

                // Calculer l'intensité
                if (hasValidData && totalConsoHeure > 0) {
                    const intensity = totalConsoHeure / tension;

                    // Statistiques globales
                    if (intensity > maxIntensity.value) {
                        maxIntensity = { value: intensity, date, hour };
                    }
                    if (intensity < minIntensity.value) {
                        minIntensity = { value: intensity, date, hour };
                    }

                    totalIntensity += intensity;
                    intensityCount++;

                    // Statistiques par heure
                    if (intensityByHour[hour]) {
                        intensityByHour[hour].values.push(intensity);
                        intensityByHour[hour].total += intensity;
                        intensityByHour[hour].count++;
                        intensityByHour[hour].max = Math.max(intensityByHour[hour].max, intensity);
                        intensityByHour[hour].min = Math.min(intensityByHour[hour].min, intensity);
                    }

                    intensityData.push({
                        date,
                        hour,
                        intensity,
                        label: `${date} ${hour}`
                    });
                }
            }

            previousDate = date;
        }

        // Calculer les moyennes par heure
        Object.keys(intensityByHour).forEach(hour => {
            if (intensityByHour[hour].count > 0) {
                intensityByHour[hour].avg = intensityByHour[hour].total / intensityByHour[hour].count;
            } else {
                intensityByHour[hour].avg = 0;
            }
        });

        const avgIntensity = intensityCount > 0 ? totalIntensity / intensityCount : 0;

        return {
            intensityData,
            intensityByHour,
            maxIntensity: maxIntensity.value > 0 ? maxIntensity : { value: 0, date: '-', hour: '-' },
            minIntensity: minIntensity.value < Infinity ? minIntensity : { value: 0, date: '-', hour: '-' },
            avgIntensity,
            intensityCount,
            datesAnalyzed: datesToUse.length
        };
    }

    // Calculer les statistiques journalières d'intensité
    function calculateDailyIntensityStats() {
        const dailyIntensity = {};
        const previousValues = {};
        allClientsHourlyMatrix.clients.forEach(clientId => {
            previousValues[clientId] = null;
        });

        let previousDate = null;

        for (let i = 0; i < datesToUse.length; i++) {
            const date = datesToUse[i];

            if (previousDate !== null && date !== previousDate) {
                allClientsHourlyMatrix.clients.forEach(clientId => {
                    previousValues[clientId] = null;
                });
            }

            let dailyTotal = 0;
            let dailyCount = 0;
            let dailyMax = 0;
            let dailyMin = Infinity;

            for (let j = 0; j < allClientsHourlyMatrix.hours.length; j++) {
                const hour = allClientsHourlyMatrix.hours[j];
                const key = `${date}_${hour}`;
                const rowData = allClientsHourlyMatrix.data[key] || {};

                const tension = rowData.tension;
                if (!tension || tension <= 0) continue;

                let totalConsoHeure = 0;
                let hasValidData = false;

                allClientsHourlyMatrix.clients.forEach(clientId => {
                    const energie = rowData[`client_${clientId}`];
                    if (energie !== null && energie !== undefined) {
                        const valeur = parseFloat(energie);
                        const previous = previousValues[clientId];
                        if (previous !== null && valeur >= previous) {
                            totalConsoHeure += (valeur - previous);
                            hasValidData = true;
                        }
                        previousValues[clientId] = valeur;
                    }
                });

                if (hasValidData && totalConsoHeure > 0) {
                    const intensity = totalConsoHeure / tension;
                    dailyTotal += intensity;
                    dailyCount++;
                    dailyMax = Math.max(dailyMax, intensity);
                    dailyMin = Math.min(dailyMin, intensity);
                }
            }

            previousDate = date;

            if (dailyCount > 0) {
                dailyIntensity[date] = {
                    avg: dailyTotal / dailyCount,
                    max: dailyMax,
                    min: dailyMin,
                    count: dailyCount
                };
            }
        }

        return dailyIntensity;
    }


    const intensityStats = calculateIntensityStats();
    const dailyIntensityStats = calculateDailyIntensityStats();
    const dailyDates = Object.keys(dailyIntensityStats).sort();

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
                            <td class="stats-label">📊 Énergie Moyenne</td>
                            <td class="stats-value">${averageEnergyValue} Wh</td>
                            <td class="stats-date">sur ${daysWithEnergy} jour${daysWithEnergy !== 1 ? 's' : ''}</td>
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

        <!-- ===== CARTE PRINCIPALE : Analyse général de la Tension ===== -->
        <div class="main-tension-card" style="background: white; border-radius: 24px; padding: 24px; margin: 30px 0; border: 2px solid #e2e8f0; box-shadow: 0 12px 30px rgba(0,0,0,0.1);">

            <!-- EN-TÊTE DE LA CARTE PRINCIPALE -->
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 3px solid #3b82f6;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%); border-radius: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px #3b82f680;">
                    <span style="font-size: 32px; color: white;">⚡</span>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 26px; font-weight: 800; color: #0f172a;">
                        Analyse général de la Tension
                        <span style="margin-left: 12px; font-size: 14px; background: #f1f5f9; color: #475569; padding: 6px 16px; border-radius: 40px; font-weight: 600;">
                            ${systemType}
                        </span>
                    </h3>
                    <div style="margin-top: 6px; font-size: 14px; color: #475569;">
                        Analyse complète de la conformité, des atteintes nominales et de l'évolution temporelle
                    </div>
                </div>
            </div>

            <!-- CARTES EN COLONNE (les unes en dessous des autres) -->
            
            <!-- CARTE 1 : Analyse globale de Tension -->
            <div style="background: #f8fafc; border-radius: 20px; padding: 20px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 22px; color: white;">🔄</span>
                    </div>
                    <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">Analyse globale de Tension</h4>
                </div>
                <div id="stability-analysis-container" style="min-height: 350px;"></div>
            </div>

            <!-- CARTE 2 : Tableau des Événements Combinés ENR + EC -->
            ${combinedAnalysis && combinedAnalysis.allEvents.length > 0 ? `
            <div style="background: #f8fafc; border-radius: 20px; padding: 20px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                ${createDPDTOnlyTable(combinedAnalysis)}
            </div>
            ` : ''}

            <!-- CARTE 3 : Évolution quotidienne des atteintes - Courbe de tendance -->
            <div style="background: #f8fafc; border-radius: 20px; padding: 20px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 22px; color: white;">📈</span>
                    </div>
                    <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">Évolution quotidienne des atteintes</h4>
                </div>
                <div id="nominal-tension-table-container"></div>
            </div>

            <!-- CARTE 4 : Tension journalière (Min/Max/Moyenne par Jour) -->
            <div style="background: #f8fafc; border-radius: 20px; padding: 20px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 18px; color: white;">📊</span>
                    </div>
                    <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">Tension journalière (Système ${systemType})</h4>
                </div>
                <div class="system-info" style="font-size: 11px; color: #64748b; margin-bottom: 10px; display: flex; gap: 15px; flex-wrap: wrap; padding: 8px 0;">
                    <span>Min: ${systemLimits.min}V</span>
                    <span>Idéal: ${systemLimits.ideal.min}-${systemLimits.ideal.max}V</span>
                    <span>Max: ${systemLimits.max}V</span>
                </div>
                <div class="chart-container all-clients-line-chart-container" style="height: 100%;">
                    <canvas id="allClientsTensionChart" style="width: 100% !important; height: 100% !important; display: block;"></canvas>
                </div>
            </div>

            <!-- CARTE 5 : Évolution de la Tension (par date/heure) -->
            <div style="background: #f8fafc; border-radius: 20px; padding: 20px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #f97316 0%, #c2410c 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 22px; color: white;">⏱️</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                        <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">Évolution de la Tension (par date/heure)</h4>
                        <span style="font-size: 12px; color: #64748b;">
                            Visualisation fine des variations de tension avec surbrillance de la plage idéale.
                        </span>
                    </div>
                </div>

                <!-- FILTRE PAR PLAGE DE DATES POUR LE GRAPHIQUE TENSION -->
                <div style="margin-bottom: 18px; padding: 12px 16px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <!-- Ligne 1: contrôles sur la même ligne -->
                    <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-size: 13px; font-weight: 600; color: #334155;">📅 Plage de dates :</span>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <label style="font-size: 12px; color: #64748b;">
                                    Début
                                    <select id="tension-start-date" onchange="onTensionStartDateChange()" style="margin-left: 4px; padding: 8px 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-weight: 500; background: #ffffff; cursor: pointer; min-width: 130px;">
                                        ${allClientsHourlyMatrix.dates.map((date, index) => `
                                            <option value="${date}" ${index === 0 ? 'selected' : ''}>${date}</option>
                                        `).join('')}
                                    </select>
                                </label>
                                <label style="font-size: 12px; color: #64748b;">
                                    Fin
                                    <select id="tension-end-date" style="margin-left: 4px; padding: 8px 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-weight: 500; background: #ffffff; cursor: pointer; min-width: 130px;">
                                        ${allClientsHourlyMatrix.dates.map((date, index, arr) => `
                                            <option value="${date}" ${index === arr.length - 1 ? 'selected' : ''}>${date}</option>
                                        `).join('')}
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div style="display: flex; gap: 10px; margin-left: auto;">
                            <button onclick="applyTensionDateFilter()" style="padding: 9px 20px; background: #f97316; color: white; border: none; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 6px 12px rgba(249, 115, 22, 0.25);">
                                <span>🔍</span> Appliquer le filtre
                            </button>
                            <button onclick="resetTensionDateFilter()" style="padding: 9px 16px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer;">
                                Réinitialiser
                            </button>
                        </div>
                    </div>

                    <!-- Ligne 2: info 7 jours uniquement -->
                    <div style="margin-top: 8px; font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 12px;">ℹ️</span>
                        <span>Période limitée à <strong style="color:#334155;">7 jours maximum</strong>. La date de fin s’ajuste automatiquement selon la date de début.</span>
                    </div>

                    <div id="tension-current-range-badge" style="margin-top: 10px; font-size: 12px; color: #1e40af;">
                        <span style="padding: 4px 10px; background: #dbeafe; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px;">
                            📊 Période affichée :
                            <strong>
                                <span id="tension-range-start-label">${allClientsHourlyMatrix.dates[0]}</span>
                                &nbsp;→&nbsp;
                                <span id="tension-range-end-label">${allClientsHourlyMatrix.dates[allClientsHourlyMatrix.dates.length - 1]}</span>
                            </strong>
                        </span>
                    </div>
                </div>

                <div id="tension-evolution-container" style="background: transparent; padding: 0; border: none; box-shadow: none;">
                    <div class="chart-container" style="height: 350px; width: 100%; position: relative;">
                        <canvas id="tensionEvolutionChart" style="width: 100% !important; height: 100% !important;"></canvas>
                    </div>
                    <div id="tension-evolution-stats"></div>
                </div>
            </div>

            <!-- (supprimé) PIED DE CARTE : Résumé des indicateurs -->
        </div>
        <!-- ===== FIN CARTE PRINCIPALE TENSION ===== -->

        <!-- ===== CARTE PRINCIPALE : Analyse général de l'Énergie ===== -->
        <div class="main-energy-card" style="background: white; border-radius: 24px; padding: 24px; margin: 30px 0; border: 2px solid #e2e8f0; box-shadow: 0 12px 30px rgba(0,0,0,0.1);">

            <!-- EN-TÊTE DE LA CARTE PRINCIPALE -->
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 3px solid #22c55e;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px #22c55e80;">
                    <span style="font-size: 32px; color: white;">⚡</span>
                </div>
                <div>
                    <h3 style="margin: 0; font-size: 26px; font-weight: 800; color: #0f172a;">
                        Analyse général de l'Énergie
                        <span style="margin-left: 12px; font-size: 14px; background: #f1f5f9; color: #475569; padding: 6px 16px; border-radius: 40px; font-weight: 600;">
                            ${daysWithEnergy} jours de consommation
                        </span>
                    </h3>
                    <div style="margin-top: 6px; font-size: 14px; color: #475569; display: flex; gap: 20px;">
                        <span>📊 Max: ${maxEnergyValue} Wh</span>
                        <span>📈 Moy: ${averageEnergyValue} Wh</span>
                    </div>
                </div>
            </div>

            <!-- CARTES ÉNERGIE EN COLONNE -->
            
            <!-- CARTE 1 : Énergie Totale par Jour (Somme des Max Clients) -->
            <div style="background: #f8fafc; border-radius: 20px; padding: 20px; margin-bottom: 25px; border: 1px solid #e2e8f0; overflow: visible; height: auto; min-height: auto;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 22px; color: white;">📊</span>
                    </div>
                    <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">Énergie Totale par Jour (Somme des Max Clients)</h4>
                </div>
                <div class="chart-container all-clients-bar-chart-container" style="height: 400px; min-height: 400px; width: 100%; overflow: visible;">
                    <canvas id="allClientsEnergyChart" style="width: 100% !important; height: 100% !important;"></canvas>
                </div>
                <div id="allClientsEnergySummary" style="margin-top: 20px; width: 100%; overflow: visible;"></div>
            </div>

            <div style="background: #f8fafc; border-radius: 20px; padding: 20px; border: 1px solid #e2e8f0; overflow: visible;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 22px; color: white;">⏰</span>
                    </div>
                    <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">Énergie Totale par Heure (Somme Clients)</h4>
                </div>
                
                <!-- FILTRE PAR PLAGE DE DATES (MAX 7 JOURS) -->
                <div style="margin-bottom: 15px; padding: 12px 16px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <!-- Ligne 1: contrôles sur la même ligne -->
                    <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-size: 13px; font-weight: 600; color: #334155;">📅 Plage de dates :</span>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <label style="font-size: 12px; color: #64748b;">
                                    Début
                                    <select id="energy-hourly-start-date" onchange="onEnergyHourlyStartDateChange()" style="margin-left: 4px; padding: 8px 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-weight: 500; background: #ffffff; cursor: pointer; min-width: 130px;">
                                        ${allClientsHourlyMatrix.dates.map((date, index) => `
                                            <option value="${date}" ${index === Math.max(0, allClientsHourlyMatrix.dates.length - 7) ? 'selected' : ''}>${date}</option>
                                        `).join('')}
                                    </select>
                                </label>
                                <label style="font-size: 12px; color: #64748b;">
                                    Fin
                                    <select id="energy-hourly-end-date" style="margin-left: 4px; padding: 8px 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-weight: 500; background: #ffffff; cursor: pointer; min-width: 130px;">
                                        ${allClientsHourlyMatrix.dates.map((date, index, arr) => `
                                            <option value="${date}" ${index === arr.length - 1 ? 'selected' : ''}>${date}</option>
                                        `).join('')}
                                    </select>
                                </label>
                            </div>
                        </div>

                        <div style="display: flex; gap: 10px; margin-left: auto;">
                            <button onclick="applyEnergyHourlyDateFilter()" style="padding: 9px 20px; background: #3b82f6; color: white; border: none; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 6px 12px rgba(59, 130, 246, 0.25);">
                                <span>🔍</span> Appliquer le filtre
                            </button>
                            <button onclick="resetEnergyHourlyDateFilter()" style="padding: 9px 16px; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer;">
                                Réinitialiser
                            </button>
                        </div>
                    </div>

                    <!-- Ligne 2: info 7 jours uniquement -->
                    <div style="margin-top: 8px; font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 12px;">ℹ️</span>
                        <span>Période limitée à <strong style="color:#334155;">7 jours maximum</strong>. La date de fin s’ajuste automatiquement selon la date de début.</span>
                    </div>

                    <div id="energy-hourly-current-range-badge" style="margin-top: 10px; font-size: 12px; color: #1e40af;">
                        <span style="padding: 4px 10px; background: #dbeafe; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px;">
                            📊 Période affichée :
                            <strong>
                                <span id="energy-hourly-range-start-label">${allClientsHourlyMatrix.dates[Math.max(0, allClientsHourlyMatrix.dates.length - 7)]}</span>
                                &nbsp;→&nbsp;
                                <span id="energy-hourly-range-end-label">${allClientsHourlyMatrix.dates[allClientsHourlyMatrix.dates.length - 1]}</span>
                            </strong>
                        </span>
                    </div>
                </div>

                <!-- LES GRAPHIQUES D'ENERGIE HORAIRES BARRE ET LIGNE -->

                <!-- CARTE 1 : Graphique en lignes (cumul journalier) -->
                <div style="background: #f8fafc; border-radius: 20px; padding: 20px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                        <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 22px; color: white;">📈</span>
                        </div>
                        <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">Cumul Journalier par Heure</h4>
                    </div>
                    <div class="chart-container" style="height: 200px; width: 100%;">
                        <canvas id="allClientsCumulativeChart" style="width: 100% !important; height: 100% !important;"></canvas>
                    </div>
                </div>
                <!-- CARTE 2 : Graphique en barres (conso horaire) -->
                <div style="background: #f8fafc; border-radius: 20px; padding: 20px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                        <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 22px; color: white;">📊</span>
                        </div>
                        <h4 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">Énergie Totale par Heure (Consommation horaire)</h4>
                    </div>
                    <div class="chart-container" style="height: 250px; width: 100%;">
                        <canvas id="allClientsHourlyChart" style="width: 100% !important; height: 100% !important;"></canvas>
                    </div>
                </div>


                
                <div class="hourly-chart-footer" style="margin-top: 20px; padding: 16px 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <!-- Légende -->
                    <!-- STATISTIQUES DYNAMIQUES -->
                    <div id="hourly-quick-stats" style="font-size: 13px; color: #1e293b;">
                        <!-- Sera rempli par updateHourlyStats() -->
                        Chargement des statistiques...
                    </div>
                </div>
            </div>
        <!-- ===== FIN CARTE PRINCIPALE ÉNERGIE ===== -->

        <!-- BOUTON POUR AFFICHER/MASQUER LE TABLEAU -->
        <div style="margin: 20px 0;">
            <button id="toggle-matrix-table-btn" style="
                width: 100%;
                padding: 15px 20px;
                background: ${matrixTableVisible ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'};
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.2);
            ">
                <span style="font-size: 20px;">${matrixTableVisible ? '🔼' : '📊'}</span>
                <span>${matrixTableVisible ? 'Masquer le tableau détaillé' : 'Afficher le tableau détaillé'}</span>
                <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 30px;">
                    ${window.filteredDates ? window.filteredDates.length : allClientsHourlyMatrix.dates.length} jours
                </span>
            </button>
        </div>

        <!-- TABLEAU (CACHÉ PAR DÉFAUT) -->
        <div id="matrix-table-container" style="display: ${matrixTableVisible ? 'block' : 'none'};">
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
                                <th class="sticky-header energy-sum-header">∑ Énergie (Wh)</th>
                                <th class="sticky-header intensity-header">Intensité (A)</th>
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
        </div>
    `;

    // === INITIALISATION DES ÉVÉNEMENTS ===
    initializeFilterEvents();
    setTimeout(() => {
        initializeDPDTTableToggles();
    }, 200);

    // === CRÉER LES GRAPHIQUES ===
    setTimeout(() => {
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

        // 2. Graphique de tension min/max par jour
        createAllClientsTensionChart(datesToUse, filteredTensionData, systemType, systemLimits);

        // 3. Graphique de stabilité (avec les trois nouvelles cartes)
        if (stabilityData) {
            createStabilityChart('stability-analysis-container', stabilityData, filteredTensionResults);
            
            setTimeout(() => {
                const allDatesInPeriod = window.filteredDates || allClientsHourlyMatrix.dates;
                const nominalTableHTML = createNominalTensionTable(
                    filteredTensionResults,
                    systemType,
                    allDatesInPeriod
                );
                
                const nominalContainer = document.getElementById('nominal-tension-table-container');
                if (nominalContainer) {
                    nominalContainer.innerHTML = nominalTableHTML;
                }
            }, 200);
        }

        // 5. Graphique horaire d'énergie
        setTimeout(() => {
            initializeHourlyChartWithLastDate();
        }, 200);

        // Dans displayAllClientsTab(), vers la fin du setTimeout où les graphiques sont créés

        // 6. Graphique d'évolution de la tension
        if (tensionResults && tensionResults.length > 0) {
            window.tensionEvolutionContext = {
                tensionResults: tensionResults,
                systemType: systemType,
                allDates: datesToUse
            };

            setTimeout(() => {
                // 🔴 MODIFICATION : Créer le graphique avec les 7 derniers jours par défaut
                const allDates = window.filteredDates || allClientsHourlyMatrix.dates;

                // Prendre les 7 derniers jours
                const last7Days = allDates.slice(-7);

                // Mettre à jour les sélecteurs de dates
                const startSelect = document.getElementById('tension-start-date');
                const endSelect = document.getElementById('tension-end-date');

                if (startSelect && endSelect) {
                    // Définir la date de début sur le premier des 7 derniers jours
                    startSelect.value = last7Days[0];

                    // Recalculer les options de fin
                    onTensionStartDateChange();

                    // Sélectionner la dernière date (fin des 7 jours)
                    endSelect.value = last7Days[last7Days.length - 1];

                    // Mettre à jour les labels
                    const startLabel = document.getElementById('tension-range-start-label');
                    const endLabel = document.getElementById('tension-range-end-label');
                    if (startLabel) startLabel.textContent = last7Days[0];
                    if (endLabel) endLabel.textContent = last7Days[last7Days.length - 1];
                }

                // Créer le graphique avec les 7 derniers jours
                createTensionEvolutionChart(last7Days, tensionResults, systemType);

            }, 300);
        }

        // 8. Graphique journalier d'intensité
        createDailyIntensityChart(dailyIntensityStats);

        console.log(`✅ Onglet TECHNIQUE affiché avec ${datesToUse.length} jour(s)`);
        console.log(`📊 Énergie moyenne: ${averageEnergyValue} Wh sur ${daysWithEnergy} jours`);
        console.log(`⚡ Intensité moyenne: ${intensityStats.avgIntensity.toFixed(2)} A sur ${intensityStats.intensityCount} mesures`);

        // AJOUTEZ CES LIGNES ICI - juste avant la fermeture du setTimeout
        initializeMatrixTableToggle();
        // Restaurer l'état du tableau
        const tableContainer = document.getElementById('matrix-table-container');
        const toggleBtn = document.getElementById('toggle-matrix-table-btn');

        if (tableContainer && toggleBtn) {
            // Appliquer l'état sauvegardé
            tableContainer.style.display = matrixTableVisible ? 'block' : 'none';

            // Mettre à jour le texte du bouton
            toggleBtn.innerHTML = matrixTableVisible ?
                `<span style="font-size: 20px;">🔼</span>
                <span>Masquer le tableau détaillé</span>
                <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 30px;">
                    ${getCurrentDaysCount()} jours
                </span>` :
                `<span style="font-size: 20px;">📊</span>
                <span>Afficher le tableau détaillé</span>
                <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 30px;">
                    ${getCurrentDaysCount()} jours
                </span>`;

            toggleBtn.style.background = matrixTableVisible ?
                'linear-gradient(135deg, #64748b 0%, #475569 100%)' :
                'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        }
    }, 100);
}
function getCurrentDaysCount() {
    if (window.filteredDates && window.filteredDates.length > 0) {
        return window.filteredDates.length;
    }
    return allClientsHourlyMatrix?.dates?.length || 0;
}
// ======================== GESTION DU BOUTON TOGGLE POUR LE TABLEAU MATRICIEL ========================
function initializeMatrixTableToggle() {
    const toggleBtn = document.getElementById('toggle-matrix-table-btn');
    const tableContainer = document.getElementById('matrix-table-container');

    if (!toggleBtn || !tableContainer) return;

    // Éviter les doublons d'événements
    toggleBtn.removeEventListener('click', handleMatrixTableToggle);
    toggleBtn.addEventListener('click', handleMatrixTableToggle);
}

function handleMatrixTableToggle() {
    const toggleBtn = document.getElementById('toggle-matrix-table-btn');
    const tableContainer = document.getElementById('matrix-table-container');

    if (!toggleBtn || !tableContainer) return;

    if (tableContainer.style.display === 'none') {
        // Afficher le tableau
        tableContainer.style.display = 'block';
        toggleBtn.innerHTML = `
            <span style="font-size: 20px;">🔼</span>
            <span>Masquer le tableau détaillé</span>
            <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 30px;">
                ${getCurrentDaysCount()} jours
            </span>
        `;
        toggleBtn.style.background = 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
        matrixTableVisible = true; // ← AJOUTER CETTE LIGNE
    } else {
        // Cacher le tableau
        tableContainer.style.display = 'none';
        toggleBtn.innerHTML = `
            <span style="font-size: 20px;">📊</span>
            <span>Afficher le tableau détaillé</span>
            <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 30px;">
                ${getCurrentDaysCount()} jours
            </span>
        `;
        toggleBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        matrixTableVisible = false; // ← AJOUTER CETTE LIGNE
    }
}

// Fonction pour créer le graphique journalier d'intensité
function createDailyIntensityChart(dailyIntensityStats) {
    const chartCanvas = document.getElementById('dailyIntensityChart');
    if (!chartCanvas) return;

    // Détruire le graphique existant
    if (window.dailyIntensityChartInstance) {
        window.dailyIntensityChartInstance.destroy();
    }

    const dates = Object.keys(dailyIntensityStats).sort();
    const avgData = dates.map(date => dailyIntensityStats[date].avg || 0);
    const maxData = dates.map(date => dailyIntensityStats[date].max || null);
    const minData = dates.map(date => dailyIntensityStats[date].min || null);

    const ctx = chartCanvas.getContext('2d');
    window.dailyIntensityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Intensité Moyenne (A)',
                    data: avgData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 6
                },
                {
                    label: 'Intensité Maximale',
                    data: maxData,
                    borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0,
                    pointRadius: 3,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#fff'
                },
                {
                    label: 'Intensité Minimale',
                    data: minData,
                    borderColor: '#22c55e',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0,
                    pointRadius: 3,
                    pointBackgroundColor: '#22c55e',
                    pointBorderColor: '#fff'
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
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 12,
                    callbacks: {
                        title: function (context) {
                            return context[0].label;
                        },
                        label: function (context) {
                            const value = context.parsed.y;
                            const datasetLabel = context.dataset.label;
                            return `${datasetLabel}: ${value ? value.toFixed(2) : '-'} A`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Intensité (A)',
                        font: { size: 12, weight: 'bold' }
                    },
                    ticks: {
                        callback: function (value) {
                            return value.toFixed(1) + ' A';
                        }
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

// ======================== TABLEAU DES ÉVÉNEMENTS DP/DT SIMPLIFIÉ (UNIQUEMENT LES HEURES) ========================
function createDPDTOnlyTable(combinedAnalysis) {
    const { dailyEvents, eventTypes } = combinedAnalysis;

    if (Object.keys(dailyEvents).length === 0) {
        return '<div class="no-data" style="text-align: center; padding: 30px; background: #f8fafc; border-radius: 12px; color: #64748b;">Aucun événement DP/DT détecté</div>';
    }

    // Récupérer le nombre de jours de diagnostic depuis le filtre global
    const diagnosticDays = window.filteredDates ? window.filteredDates.length :
        (allClientsHourlyMatrix?.dates?.length || 0);

    // Trier les dates
    const sortedDates = Object.keys(dailyEvents).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateB - dateA; // Du plus récent au plus ancien
    });

    // Compter les événements
    let totalDP = 0;
    let totalDT = 0;
    const daysWithDP = new Set();
    const daysWithDT = new Set();
    const daysWithBoth = new Set();

    sortedDates.forEach(date => {
        const dateEvents = dailyEvents[date];
        const hasDP = dateEvents['DP'] && dateEvents['DP'].events.length > 0;
        const hasDT = dateEvents['DT'] && dateEvents['DT'].events.length > 0;

        if (hasDP) {
            totalDP += dateEvents['DP'].events.length;
            daysWithDP.add(date);
        }
        if (hasDT) {
            totalDT += dateEvents['DT'].events.length;
            daysWithDT.add(date);
        }
        if (hasDP && hasDT) {
            daysWithBoth.add(date);
        }
    });

    const daysWithDPCount = daysWithDP.size;
    const daysWithDTCount = daysWithDT.size;
    const daysWithBothCount = daysWithBoth.size;
    const totalDaysWithEvents = new Set([...daysWithDP, ...daysWithDT]).size;

    // Calcul des pourcentages
    const percentDP = diagnosticDays > 0 ? ((daysWithDPCount / diagnosticDays) * 100).toFixed(1) : '0';
    const percentDT = diagnosticDays > 0 ? ((daysWithDTCount / diagnosticDays) * 100).toFixed(1) : '0';
    const percentBoth = diagnosticDays > 0 ? ((daysWithBothCount / diagnosticDays) * 100).toFixed(1) : '0';
    const percentTotal = diagnosticDays > 0 ? ((totalDaysWithEvents / diagnosticDays) * 100).toFixed(1) : '0';

    // Pourcentages pour les barres de progression
    const percentPartielBar = Math.round(parseFloat(percentDP));
    const percentTotalBar = Math.round(parseFloat(percentDT));
    const percentBothBar = Math.round(parseFloat(percentBoth));
    const percentOccurrenceBar = Math.round(parseFloat(percentTotal));

    // Dernière date avec événement
    const lastEventDate = sortedDates.length > 0 ? sortedDates[0] : '-';

    // ID unique pour ce tableau
    const tableId = `dpdt-detailed-table-${Date.now()}`;
    const buttonId = `toggle-dpdt-table-${Date.now()}`;

    // Créer le HTML du tableau (version simplifiée avec heures uniquement)
    let tableHTML = '';
    
    // Créer les lignes du tableau avec les heures uniquement
    const tableRows = sortedDates.map(date => {
        const dateEvents = dailyEvents[date];
        
        // Récupérer les heures des événements DP
        let dpHours = [];
        if (dateEvents['DP'] && dateEvents['DP'].events.length > 0) {
            dpHours = dateEvents['DP'].events.map(e => e.heure).sort();
        }
        
        // Récupérer les heures des événements DT
        let dtHours = [];
        if (dateEvents['DT'] && dateEvents['DT'].events.length > 0) {
            dtHours = dateEvents['DT'].events.map(e => e.heure).sort();
        }
        
        return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 14px 12px; font-weight: 700; color: #0f172a; background: #f8fafc; border-right: 2px solid #e2e8f0;">
                    ${date}
                </td>
                <td style="padding: 14px 12px; vertical-align: top;">
                    ${dpHours.length > 0 ? 
                        `<div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${dpHours.map(hour => `
                                <span style="display: inline-block; background: #fef3c7; color: #b45309; 
                                           padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
                                           border: 1px solid #fed7aa;">
                                    ${hour}
                                </span>
                            `).join('')}
                        </div>` : 
                        `<span style="color: #cbd5e1; font-style: italic;">-</span>`
                    }
                </td>
                <td style="padding: 14px 12px; vertical-align: top;">
                    ${dtHours.length > 0 ? 
                        `<div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${dtHours.map(hour => `
                                <span style="display: inline-block; background: #fee2e2; color: #b91c1c; 
                                           padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
                                           border: 1px solid #fecaca;">
                                    ${hour}
                                </span>
                            `).join('')}
                        </div>` : 
                        `<span style="color: #cbd5e1; font-style: italic;">-</span>`
                    }
                </td>
            </tr>
        `;
    }).join('');

    tableHTML = `
        <div class="dpdt-analysis-container" style="background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; margin: 15px 0;">
            
            <!-- En-tête du card -->
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                <div class="dpdt-header-left" style="display: flex; align-items: center; gap: 15px;">
                    <div class="dpdt-header-icon" style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
                        <span style="font-size: 28px;">🔌</span>
                    </div>
                    <div class="dpdt-header-title">
                        <h3 style="margin: 0; font-size: 20px; font-weight: 700;">Événements de Délestage</h3>
                        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">📅 ${diagnosticDays} jour(s) de diagnostic</p>
                    </div>
                </div>
                <div class="dpdt-header-stats" style="display: flex; gap: 20px; background: rgba(255,255,255,0.15); padding: 10px 18px; border-radius: 40px;">
                    <span style="display: flex; align-items: center; gap: 6px;">🔌 Partiel: ${totalDP}</span>
                    <span style="display: flex; align-items: center; gap: 6px;">🔋 Total: ${totalDT}</span>
                </div>
            </div>
            
            <!-- Grille de statistiques -->
            <div class="dpdt-stats-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; padding: 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                
                <!-- Délestage Partiel -->
                <div class="dpdt-stat-card" style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; border-left: 4px solid #f59e0b;">
                    <div class="dpdt-stat-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div class="dpdt-stat-icon" style="width: 36px; height: 36px; background: #fef3c7; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #f59e0b;">
                            <span style="font-size: 18px;">🔌</span>
                        </div>
                        <div class="dpdt-stat-title" style="font-weight: 600; color: #334155; font-size: 13px;">DÉLESTAGE PARTIEL</div>
                    </div>
                    <div class="dpdt-stat-value" style="font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 8px;">${totalDP} fois</div>
                    <div class="dpdt-stat-detail" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
                        <span>Jours concernés</span>
                        <span class="dpdt-stat-percent" style="font-weight: 700; color: #f59e0b;">${daysWithDPCount} / ${diagnosticDays}</span>
                    </div>
                    <div class="progress-bar-container" style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; margin: 10px 0 5px 0;">
                        <div class="progress-bar" style="width: ${percentPartielBar}%; height: 100%; background: linear-gradient(90deg, #f59e0b, #ea580c); border-radius: 20px;"></div>
                    </div>
                    <div class="progress-label" style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-top: 2px;">
                        <span>${percentDP}% des jours</span>
                        <span>${daysWithDPCount} jour(s)</span>
                    </div>
                </div>
                
                <!-- Délestage Total -->
                <div class="dpdt-stat-card" style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; border-left: 4px solid #ef4444;">
                    <div class="dpdt-stat-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div class="dpdt-stat-icon" style="width: 36px; height: 36px; background: #fee2e2; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #ef4444;">
                            <span style="font-size: 18px;">🔋</span>
                        </div>
                        <div class="dpdt-stat-title" style="font-weight: 600; color: #334155; font-size: 13px;">DÉLESTAGE TOTAL</div>
                    </div>
                    <div class="dpdt-stat-value" style="font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 8px;">${totalDT} fois</div>
                    <div class="dpdt-stat-detail" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
                        <span>Jours concernés</span>
                        <span class="dpdt-stat-percent" style="font-weight: 700; color: #ef4444;">${daysWithDTCount} / ${diagnosticDays}</span>
                    </div>
                    <div class="progress-bar-container" style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; margin: 10px 0 5px 0;">
                        <div class="progress-bar" style="width: ${percentTotalBar}%; height: 100%; background: linear-gradient(90deg, #ef4444, #dc2626); border-radius: 20px;"></div>
                    </div>
                    <div class="progress-label" style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-top: 2px;">
                        <span>${percentDT}% des jours</span>
                        <span>${daysWithDTCount} jour(s)</span>
                    </div>
                </div>
                
                <!-- Jours avec les deux -->
                <div class="dpdt-stat-card" style="background: white; border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; border-left: 4px solid #8b5cf6;">
                    <div class="dpdt-stat-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div class="dpdt-stat-icon" style="width: 36px; height: 36px; background: #ede9fe; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #8b5cf6;">
                            <span style="font-size: 18px;">🔄</span>
                        </div>
                        <div class="dpdt-stat-title" style="font-weight: 600; color: #334155; font-size: 13px;">JOURS AVEC LES DEUX</div>
                    </div>
                    <div class="dpdt-stat-value" style="font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 8px;">${daysWithBothCount}</div>
                    <div class="dpdt-stat-detail" style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
                        <span>Jours concernés</span>
                        <span class="dpdt-stat-percent" style="font-weight: 700; color: #8b5cf6;">${daysWithBothCount} / ${diagnosticDays}</span>
                    </div>
                    <div class="progress-bar-container" style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; margin: 10px 0 5px 0;">
                        <div class="progress-bar" style="width: ${percentBothBar}%; height: 100%; background: linear-gradient(90deg, #8b5cf6, #7c3aed); border-radius: 20px;"></div>
                    </div>
                    <div class="progress-label" style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-top: 2px;">
                        <span>${percentBoth}% des jours</span>
                        <span>${daysWithBothCount} jour(s)</span>
                    </div>
                </div>
                
                <!-- Synthèse -->
                <div class="dpdt-stat-card" style="background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%); border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6;">
                    <div class="dpdt-stat-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div class="dpdt-stat-icon" style="width: 36px; height: 36px; background: #dbeafe; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #3b82f6;">
                            <span style="font-size: 18px;">📊</span>
                        </div>
                        <div class="dpdt-stat-title" style="font-weight: 600; color: #334155; font-size: 13px;">SYNTHÈSE</div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <div>
                            <div style="font-size: 11px; color: #64748b;">Jours diagnostic</div>
                            <div style="font-size: 20px; font-weight: 800;">${diagnosticDays}</div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #64748b;">Jours avec dél.</div>
                            <div style="font-size: 20px; font-weight: 800;">${totalDaysWithEvents}</div>
                        </div>
                    </div>
                    
                    <div class="progress-bar-container" style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 20px; overflow: hidden; margin: 10px 0;">
                        <div class="progress-bar" style="width: ${percentOccurrenceBar}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); border-radius: 20px;"></div>
                    </div>
                    <div class="progress-label" style="display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-bottom: 10px;">
                        <span>Taux d'occurrence: ${percentTotal}%</span>
                        <span>${totalDaysWithEvents} jour(s)</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px; padding-top: 8px; border-top: 1px dashed #e2e8f0;">
                        <div style="font-size: 11px; color: #64748b;">Dernier événement</div>
                        <div style="font-size: 16px; font-weight: 700; color: #3b82f6;">${lastEventDate}</div>
                    </div>
                </div>
            </div>
            
            <!-- BOUTON POUR AFFICHER/MASQUER LE TABLEAU DÉTAILLÉ -->
            <button id="${buttonId}" class="toggle-table-btn" data-table-id="${tableId}" style="width: 100%; padding: 12px 20px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.3s ease; margin: 0;">
                <span style="font-size: 18px;">🔽</span>
                <span>Afficher le tableau détaillé</span>
            </button>
            
            <!-- TABLEAU DÉTAILLÉ (CACHÉ PAR DÉFAUT) -->
            <div id="${tableId}" class="dpdt-detailed-table" style="display: none;">
                <div style="max-height: 450px; overflow-y: auto; overflow-x: auto; border-radius: 0; background: white;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 10;">
                            <tr style="border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 16px 12px; text-align: left; font-weight: 700; color: #334155; background: #f8fafc; min-width: 100px;">📅 DATE</th>
                                <th style="padding: 16px 12px; text-align: left; font-weight: 700; color: #b45309; background: #fef3c7;">🔌 DÉLESTAGE PARTIEL</th>
                                <th style="padding: 16px 12px; text-align: left; font-weight: 700; color: #b91c1c; background: #fee2e2;">🔋 DÉLESTAGE TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                
                <!-- Pied du tableau avec totaux -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #f8fafc; border-top: 2px solid #e2e8f0;">
                    <div style="display: flex; gap: 25px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="dpdt-total-value" style="font-weight: 800; font-size: 16px; color: #f59e0b;">${totalDP}</span>
                            <span class="dpdt-total-label" style="color: #64748b;">événement(s) partiel</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="dpdt-total-value" style="font-weight: 800; font-size: 16px; color: #ef4444;">${totalDT}</span>
                            <span class="dpdt-total-label" style="color: #64748b;">événement(s) total</span>
                        </div>
                    </div>
                    <div style="color: #64748b; font-size: 11px;">
                        📊 ${totalDaysWithEvents} jour(s) avec événement sur ${diagnosticDays}
                    </div>
                </div>
                
                <!-- Légende compacte -->
                <div style="display: flex; gap: 20px; padding: 12px 20px; background: white; border-top: 1px solid #e2e8f0; font-size: 11px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="width: 12px; height: 12px; background: #f59e0b; border-radius: 3px;"></span>
                        <span>🔌 Délestage Partiel (DP)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="width: 12px; height: 12px; background: #ef4444; border-radius: 3px;"></span>
                        <span>🔋 Délestage Total (DT)</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    return tableHTML;
}
// ======================== FONCTION GLOBALE ========================
// Initialise tous les boutons de toggle pour les tableaux DP/DT
function initializeDPDTTableToggles() {
    setTimeout(() => {
        console.log('🔧 Initialisation des boutons de toggle DP/DT');

        // Trouver tous les boutons de toggle
        document.querySelectorAll('.toggle-table-btn').forEach(button => {
            // Éviter de dupliquer les événements
            button.removeEventListener('click', handleDPDTTableToggle);
            button.addEventListener('click', handleDPDTTableToggle);
        });
    }, 200);
}

// Gestionnaire d'événements pour les boutons
function handleDPDTTableToggle(event) {
    const button = event.currentTarget;
    const tableId = button.getAttribute('data-table-id');
    const table = document.getElementById(tableId);

    if (table) {
        if (table.style.display === 'none') {
            // Afficher le tableau
            table.style.display = 'block';
            button.innerHTML = '<span style="font-size: 18px;">🔼</span><span>Masquer le tableau détaillé</span>';
            button.style.background = 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
        } else {
            // Cacher le tableau
            table.style.display = 'none';
            button.innerHTML = '<span style="font-size: 18px;">🔽</span><span>Afficher le tableau détaillé</span>';
            button.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        }
    } else {
        console.error(`❌ Tableau avec ID ${tableId} non trouvé`);
    }
}
// Initialise tous les boutons de toggle après l'affichage
function initializeAllToggles() {
    setTimeout(() => {
        // Cette fonction sera appelée automatiquement par le script inline
        console.log('✅ Boutons de toggle initialisés');
    }, 200);
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
    const allHours = Array.from({ length: 24 }, (_, i) => {
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

// ======================== GRAPHIQUE D'ÉVOLUTION DE LA TENSION PAR DATE/HEURE ========================
function createTensionEvolutionChart(dates, tensionResults, systemType) {
    const chartCanvas = document.getElementById('tensionEvolutionChart');
    if (!chartCanvas) return;

    // Récupérer le contexte global si les paramètres ne sont pas fournis (cas des filtres)
    const savedContext = window.tensionEvolutionContext || {};
    const effectiveTensionResults = tensionResults && tensionResults.length ? tensionResults : (savedContext.tensionResults || []);
    const effectiveSystemType = systemType || savedContext.systemType;

    // Si aucune donnée, ne rien faire
    if (!effectiveTensionResults || effectiveTensionResults.length === 0) {
        return;
    }

    // Détruire le graphique existant s'il existe
    if (window.tensionEvolutionChartInstance) {
        window.tensionEvolutionChartInstance.destroy();
    }

    // Filtrer les dates si nécessaire
    const baseDates = savedContext.allDates || (window.filteredDates || allClientsHourlyMatrix.dates);
    const datesToUse = (dates && dates.length) ? dates : baseDates;
    const filteredTensionResults = effectiveTensionResults.filter(item => datesToUse.includes(item.date));

    if (filteredTensionResults.length === 0) {
        document.getElementById('tension-evolution-container').innerHTML = `
            <div style="text-align: center; padding: 40px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <span style="font-size: 48px; display: block; margin-bottom: 15px; color: #94a3b8;">📊</span>
                <span style="color: #64748b; font-size: 14px;">Aucune donnée de tension disponible pour la période sélectionnée</span>
            </div>
        `;
        return;
    }

    // Grouper les données par date
    const groupedByDate = {};

    filteredTensionResults.forEach(item => {
        let heure = item.heure;
        const tension = parseFloat(item.tension || item.valeur || 0);

        // Formater l'heure
        if (heure && heure.includes('h')) {
            heure = heure.replace('h', ':');
        }
        if (heure && heure.length === 4 && heure.includes(':')) {
            heure = '0' + heure;
        }

        if (!groupedByDate[item.date]) {
            groupedByDate[item.date] = [];
        }

        groupedByDate[item.date].push({
            heure: heure,
            tension: tension,
            label: `${item.date} ${heure}`
        });
    });

    // Trier les dates
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateA - dateB;
    });

    // Générer une palette de couleurs distinctes pour chaque date
    const colorPalette = generateColorPalette(sortedDates.length);

    // Créer les labels (tous les points dans l'ordre chronologique)
    const allDataPoints = [];
    const datasetMap = {}; // Pour stocker les index par date

    sortedDates.forEach((date, index) => {
        const dayData = groupedByDate[date];

        // Trier par heure
        dayData.sort((a, b) => {
            const timeA = convertTimeToMinutes(a.heure);
            const timeB = convertTimeToMinutes(b.heure);
            return timeA - timeB;
        });

        // Ajouter les points avec un timestamp pour le tri
        dayData.forEach(point => {
            const timestamp = new Date(date.split('/').reverse().join('-') + 'T' + point.heure).getTime();
            allDataPoints.push({
                date: date,
                heure: point.heure,
                tension: point.tension,
                timestamp: timestamp,
                datasetIndex: index,
                label: `${date} ${point.heure}`
            });
        });
    });

    // Trier tous les points par timestamp
    allDataPoints.sort((a, b) => a.timestamp - b.timestamp);

    // Créer les labels (affichage Date + Heure)
    const labels = allDataPoints.map(p => p.label);

    // Préparer les datasets - un dataset par date
    const datasets = [];

    for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];

        // Créer un tableau de données avec null partout sauf pour les points de cette date
        const data = new Array(allDataPoints.length).fill(null);

        allDataPoints.forEach((point, idx) => {
            if (point.date === date) {
                data[idx] = point.tension;
            }
        });

        datasets.push({
            label: date,
            data: data,
            borderColor: colorPalette[i],
            backgroundColor: colorPalette[i] + '20',
            borderWidth: 3,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: colorPalette[i],
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1.5,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: colorPalette[i],
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
            spanGaps: false,
            fill: false
        });
    }

    // Déterminer les limites selon le système
    const systemLimits = getSystemLimits(effectiveSystemType);

    // Calculer les statistiques globales
    const values = filteredTensionResults.map(item => parseFloat(item.tension || item.valeur || 0));
    const min = Math.min(...values).toFixed(2);
    const max = Math.max(...values).toFixed(2);
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);

    const daysWithData = Object.keys(groupedByDate).length;
    const totalMeasurements = values.length;

    // Créer le graphique
    const ctx = chartCanvas.getContext('2d');
    window.tensionEvolutionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 10 },
                        color: '#334155',
                        padding: 8,
                        usePointStyle: true,
                        boxWidth: 8,
                        filter: function (item, chart) {
                            // Ne pas afficher les datasets vides dans la légende
                            return item.hidden !== true;
                        }
                    },
                    title: {
                        display: true,
                        text: '📅 Une couleur par date',
                        color: '#64748b',
                        font: { size: 11, weight: 'normal' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 12,
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    cornerRadius: 8,
                    callbacks: {
                        title: function (context) {
                            return context[0].label;
                        },
                        label: function (context) {
                            const datasetLabel = context.dataset.label;
                            const value = context.parsed.y;
                            return `${datasetLabel} → ${value.toFixed(2)}V`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Tension (V)',
                        font: { size: 12, weight: 'bold' },
                        color: '#334155',
                        padding: 10
                    },
                    ticks: {
                        font: { size: 11 },
                        color: '#64748b',
                        callback: function (value) {
                            return value.toFixed(1) + 'V';
                        }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date et Heure',
                        font: { size: 12, weight: 'bold' },
                        color: '#334155',
                        padding: 10
                    },
                    ticks: {
                        font: { size: 9 },
                        color: '#64748b',
                        maxRotation: 45,
                        minRotation: 30,
                        callback: function (val, index) {
                            // Afficher seulement 1 tick sur 6 pour éviter la surcharge
                            if (index % 6 === 0) {
                                return this.getLabelForValue(val);
                            }
                            return '';
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            elements: {
                line: {
                    tension: 0.35
                }
            }
        },
        plugins: []
    });

    // Mettre à jour les statistiques
    updateTensionEvolutionStats(filteredTensionResults, effectiveSystemType);
}

// Fonction utilitaire pour convertir l'heure en minutes
function convertTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

// Fonction pour générer une palette de couleurs distinctes
function generateColorPalette(count) {
    const baseColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
        '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71',
        '#E74C3C', '#1ABC9C', '#F1C40F', '#8E44AD', '#E67E22',
        '#16A085', '#27AE60', '#2980B9', '#8E44AD', '#F39C12',
        '#FF9F1C', '#2EC4B6', '#E71D36', '#011627', '#FF9F1C',
        '#7209B7', '#F72585', '#4CC9F0', '#4895EF', '#3F37C9'
    ];

    if (count <= baseColors.length) {
        return baseColors.slice(0, count);
    }

    // Si plus de couleurs nécessaires, générer avec HSL
    const palette = [];
    for (let i = 0; i < count; i++) {
        const hue = (i * 137) % 360; // Nombre d'or pour distribution uniforme
        palette.push(`hsl(${hue}, 70%, 60%)`);
    }
    return palette;
}

// ======================== STATISTIQUES DU GRAPHIQUE HORAIRE ========================
function updateTensionEvolutionStats(tensionResults, systemType) {
    const statsContainer = document.getElementById('tension-evolution-stats');
    if (!statsContainer) return;

    const systemLimits = getSystemLimits(systemType);

    const values = tensionResults.map(item => parseFloat(item.tension || item.valeur || 0));
    const min = Math.min(...values).toFixed(2);
    const max = Math.max(...values).toFixed(2);
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);

    const uniqueDates = [...new Set(tensionResults.map(item => item.date))];
    const daysWithData = uniqueDates.length;
    const totalMeasurements = values.length;

    statsContainer.innerHTML = `
        <div style="display: flex; gap: 20px; margin-top: 16px; padding: 12px 16px; 
                    background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
                    border-radius: 14px; border: 1px solid #e2e8f0; flex-wrap: wrap; align-items: center;">
            
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                          border-radius: 12px; display: flex; align-items: center; justify-content: center;
                          box-shadow: 0 6px 12px #8b5cf640;">
                    <span style="font-size: 20px; color: white;">📊</span>
                </div>
                <div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Tension moyenne</div>
                    <div style="font-size: 20px; font-weight: 700; color: #1e293b;">${avg}V</div>
                </div>
            </div>
            
            <div style="width: 1px; height: 50px; background: #e2e8f0;"></div>
            
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
                          border-radius: 12px; display: flex; align-items: center; justify-content: center;
                          box-shadow: 0 6px 12px #94a3b840;">
                    <span style="font-size: 20px; color: white;">⬇️⬆️</span>
                </div>
                <div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Min / Max</div>
                    <div style="font-size: 20px; font-weight: 700; color: #1e293b;">${min}V / ${max}V</div>
                </div>
            </div>
            
            <div style="width: 1px; height: 50px; background: #e2e8f0;"></div>
            
            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 18px;">📅</span>
                    <div>
                        <div style="font-size: 10px; color: #64748b;">Jours</div>
                        <div style="font-size: 16px; font-weight: 600; color: #1e293b;">${daysWithData}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 18px;">⚡</span>
                    <div>
                        <div style="font-size: 10px; color: #64748b;">Mesures</div>
                        <div style="font-size: 16px; font-weight: 600; color: #1e293b;">${totalMeasurements}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 18px;">🔧</span>
                    <div>
                        <div style="font-size: 10px; color: #64748b;">Système</div>
                        <div style="font-size: 16px; font-weight: 600; color: #1e293b;">${systemType}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
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

    switch (rangeType) {
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

    switch (rangeType) {
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
                        callback: function (value) {
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
                        callback: function (value, index) {
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
                        filter: function (item, chart) {
                            // Par défaut, on n'affiche que la somme totale
                            return item.text.includes('Totale') || item.hidden === false;
                        }
                    },
                    onClick: function (e, legendItem, legend) {
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
                        title: function (context) {
                            const index = context[0].dataIndex;
                            const dateIndex = Math.floor(index / hours.length);
                            const hourIndex = index % hours.length;

                            const date = datesUsed[dateIndex];
                            const hour = hours[hourIndex];
                            return `📅 ${date} - ${hour}`;
                        },
                        label: function (context) {
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
                        afterLabel: function (context) {
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
        applyBtn.addEventListener('click', function () {
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
        selectAllBtn.addEventListener('click', function () {
            document.querySelectorAll('.date-checkbox').forEach(cb => {
                cb.checked = true;
                cb.parentElement.classList.add('checked');
            });
            updateSelectedCount();
        });
    }

    const deselectAllBtn = document.getElementById('deselect-all-dates');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', function () {
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
        cb.addEventListener('change', function () {
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
    let displayIndex = 1;
    const dates = window.filteredDates || allClientsHourlyMatrix.dates;

    // Stocker les valeurs précédentes pour chaque client
    const previousValues = {};
    allClientsHourlyMatrix.clients.forEach(clientId => {
        previousValues[clientId] = null;
    });

    // Stocker la date précédente pour détecter les changements de jour
    let previousDate = null;

    for (let i = 0; i < dates.length; i++) {
        const date = dates[i];

        // Si on change de jour, réinitialiser les valeurs précédentes
        if (previousDate !== null && date !== previousDate) {
            allClientsHourlyMatrix.clients.forEach(clientId => {
                previousValues[clientId] = null;
            });
        }

        for (let j = 0; j < allClientsHourlyMatrix.hours.length; j++) {
            const hour = allClientsHourlyMatrix.hours[j];
            const key = `${date}_${hour}`;
            const rowData = allClientsHourlyMatrix.data[key] || {};

            // Récupérer la tension
            const tension = rowData.tension;
            const hasTension = tension !== null && tension !== undefined;

            // Calculer le cumul total et la consommation horaire
            let totalCumul = 0;
            let totalConsoHeure = 0;
            let hasEnergy = false;
            let hasPreviousForAnyClient = false;

            allClientsHourlyMatrix.clients.forEach(clientId => {
                const energie = rowData[`client_${clientId}`];
                if (energie !== null && energie !== undefined) {
                    const valeur = parseFloat(energie);
                    totalCumul += valeur;
                    hasEnergy = true;

                    // Calculer la consommation de l'heure (différence avec la valeur précédente)
                    const previous = previousValues[clientId];
                    if (previous !== null) {
                        // Vérifier que la valeur actuelle est supérieure à la précédente
                        // (protection contre les remises à zéro éventuelles)
                        if (valeur >= previous) {
                            totalConsoHeure += (valeur - previous);
                            hasPreviousForAnyClient = true;
                        } else {
                            // En cas de remise à zéro, on ne peut pas calculer la conso
                            console.log(`⚠️ Reset détecté pour client ${clientId} à ${date} ${hour}: ${previous} → ${valeur}`);
                        }
                    }

                    // Mettre à jour pour la prochaine heure
                    previousValues[clientId] = valeur;
                }
            });

            // Si ligne complètement vide, passer
            if (!hasEnergy && !hasTension) {
                continue;
            }

            // Calculer l'intensité CORRIGÉE : I = consommation_horaire / tension
            let intensity = null;
            if (hasTension && tension > 0 && totalConsoHeure > 0 && hasPreviousForAnyClient) {
                // totalConsoHeure est déjà en Wh (consommation pendant 1 heure)
                // Donc I = (Wh) / (V × 1h) = Ampères
                intensity = totalConsoHeure / tension;
            }

            // Déterminer la couleur de l'intensité
            let intensityColor = '#718096';
            if (intensity !== null) {
                if (intensity > 5) intensityColor = '#ef4444'; // Rouge (très élevé)
                else if (intensity > 2) intensityColor = '#f59e0b'; // Orange (élevé)
                else if (intensity > 0) intensityColor = '#10b981'; // Vert (normal)
            }

            // Vérifier si cette ligne est dans la plage de pagination
            if (rowIndex >= startIndex && rowIndex < endIndex) {
                const tensionColor = hasTension ? getTensionColor(tension) : '#718096';

                // Ajouter un indicateur pour la première heure du jour (pas de conso calculable)
                const intensityDisplay = intensity !== null ?
                    intensity.toFixed(2) :
                    (hasPreviousForAnyClient ? '-' : '(première heure)');

                rows += `
                    <tr>
                        <td class="row-index">${displayIndex}</td>
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
                        <td class="row-energy-sum" style="font-weight: bold; color: #2563eb;">
                            ${totalCumul > 0 ? totalCumul.toFixed(1) : '-'}
                        </td>
                        <td class="row-intensity" style="color: ${intensityColor}; font-weight: bold;">
                            ${intensity !== null ? intensity.toFixed(2) : '-'}
                        </td>
                    </tr>
                `;
                displayIndex++;
            }

            rowIndex++;
            if (rowIndex >= endIndex) break;
        }

        previousDate = date;
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
            /* NOUVEAUX STYLES POUR LES BOUTONS DE SÉLECTION RAPIDE */
            .quick-select-btn {
                padding: 8px 16px;
                background: #e2e8f0;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                color: #334155;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .quick-select-btn:hover {
                background: #cbd5e1;
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .quick-select-btn:active {
                transform: translateY(0);
            }
            
            /* Style pour les différents types de boutons rapides */
            .quick-select-btn[data-days="3"]:hover {
                background: #94a3b8;
                color: white;
            }
            
            .quick-select-btn[data-days="7"]:hover {
                background: #64748b;
                color: white;
            }
            
            .quick-select-btn[data-days="15"]:hover {
                background: #475569;
                color: white;
            }
            
            .quick-select-btn[data-days="30"]:hover {
                background: #1e293b;
                color: white;
            }
            
            /* Animation pour les boutons */
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .quick-select-btn:active {
                animation: pulse 0.2s ease;
            }
            
            /* Responsive pour les petits écrans */
            @media (max-width: 768px) {
                .quick-select-btn {
                    padding: 6px 12px;
                    font-size: 11px;
                }
            }
            
            @media (max-width: 576px) {
                .quick-select-btn {
                    flex: 1;
                    text-align: center;
                }
            }
        `;
        document.head.appendChild(style);
    }

    const responsiveHeaderStyles = `
        /* Styles pour l'en-tête responsive */
        .header-content {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            width: 100% !important;
        }
        
        #folder-title {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
            flex-wrap: wrap !important;
            gap: 15px !important;
        }
        
        .nr-text {
            font-size: 24px !important;
            font-weight: 700 !important;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .analyze-v2-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            color: white !important;
            padding: 8px 20px !important;
            border-radius: 30px !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
            transition: all 0.3s ease !important;
            white-space: nowrap !important;
        }
        
        .analyze-v2-button:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5) !important;
        }
        
        #back-btn-header {
            background: #f1f5f9 !important;
            border: 1px solid #cbd5e1 !important;
            color: #475569 !important;
            padding: 8px 20px !important;
            border-radius: 30px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.3s ease !important;
            white-space: nowrap !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }
        
        #back-btn-header:hover {
            background: #e2e8f0 !important;
            border-color: #94a3b8 !important;
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1) !important;
        }
        
        @media (max-width: 768px) {
            #folder-title {
                flex-direction: column !important;
                align-items: flex-start !important;
            }
            
            .nr-text {
                font-size: 20px !important;
            }
            
            .analyze-v2-button {
                font-size: 14px !important;
                padding: 6px 16px !important;
            }
            
            #back-btn-header {
                font-size: 12px !important;
                padding: 6px 16px !important;
            }
        }
    `;
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
                    <span class="summary-value">${data[0].Date} ${data[0].Heure} - ${data[data.length - 1].Date} ${data[data.length - 1].Heure}</span>
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
                    <span class="summary-value">${data[0].Date} ${data[0].Heure} - ${data[data.length - 1].Date} ${data[data.length - 1].Heure}</span>
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
                            <span>Période: ${results[0].Date} ${results[0].Heure} - ${results[results.length - 1].Date} ${results[results.length - 1].Heure}</span>
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
            <h4>📊 Tableau Journalier des Événements(ENR + EC)</h4>
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
                    `${idx + 1}. ${p.debut} → ${p.fin} (${p.duree})`
                ).join('<br>')}
                                </div>
                                (+${periods.length - 1})
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

// === FONCTION POUR CRÉER LE GRAPHIQUE D'ENERGIE MAX DU CLIENT AVEC DIMENSIONNEMENT DES KITS ===
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

    // === CALCUL DES POURCENTAGES DE DIMENSIONNEMENT ===
    const dimensioningStats = calculateDimensioningPercentages(data, kitThresholds);

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
            return '#CBD5E0';
        }

        const matchingKit = visibleKitThresholds.find(kit => value <= kit.value);
        if (matchingKit) {
            return matchingKit.color;
        }

        return '#1f2933';
    });

    // Calculer l'échelle Y maximale pour avoir de la marge
    const maxVisibleKit = visibleKitThresholds[visibleKitThresholds.length - 1];
    const maxYValue = Math.max(
        maxDataValue * 1.2,
        maxVisibleKit.value * 1.1
    );

    // === MODIFICATION : VERSION SIMPLIFIÉE DES STATISTIQUES (sans recommandation) ===
    const simplifiedStatsHTML = createSimplifiedDimensioningHTML(dimensioningStats, kitThresholds);

    // Mettre à jour le texte de synthèse
    const summaryElement = document.getElementById('allClientsEnergySummary');
    if (summaryElement) {
        summaryElement.innerHTML = simplifiedStatsHTML;
    }

    // Créer le graphique (le reste de la fonction reste identique)
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
                // Dataset pour les lignes de seuils des kits
                ...visibleKitThresholds.map(kit => ({
                    label: kit.label,
                    data: labels.map(() => kit.value),
                    borderColor: kit.color,
                    borderWidth: kit.dashed ? 3 : 2,
                    borderDash: kit.dashed ? [10, 5] : [5, 3],
                    fill: false,
                    pointRadius: 0,
                    tension: 0,
                    hidden: false
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
                    max: maxYValue,
                    ticks: {
                        font: { size: 12, weight: '500' },
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
                    border: { display: false },
                    title: {
                        display: true,
                        text: 'Énergie (Wh)',
                        font: { size: 13, weight: 'bold' },
                        color: '#2c3e50',
                        padding: 12
                    }
                },
                x: {
                    ticks: {
                        font: { size: 12, weight: '500' },
                        color: '#718096',
                        maxRotation: 45,
                        minRotation: 0,
                        padding: 8
                    },
                    grid: { display: false, drawBorder: false },
                    border: { display: true, color: 'rgba(113, 128, 150, 0.2)' },
                    title: {
                        display: true,
                        text: 'Dates',
                        font: { size: 13, weight: 'bold' },
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
                        font: { size: 13, weight: 'bold' },
                        color: '#2c3e50',
                        padding: 15,
                        usePointStyle: true,
                        filter: function (item, chart) {
                            return true;
                        }
                    },
                    onClick: function (e, legendItem, legend) {
                        const index = legendItem.datasetIndex;
                        const chart = legend.chart;
                        const meta = chart.getDatasetMeta(index);

                        if (index === 0) {
                            meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                        } else {
                            return;
                        }

                        chart.update();
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(45, 55, 72, 0.95)',
                    padding: 14,
                    titleFont: { size: 15, weight: 'bold', color: '#fff' },
                    bodyFont: { size: 13, color: '#e2e8f0' },
                    cornerRadius: 8,
                    displayColors: true,
                    borderColor: 'rgba(102, 126, 234, 0.5)',
                    borderWidth: 1,
                    boxPadding: 8,
                    caretSize: 8,
                    callbacks: {
                        title: function (context) {
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
                        }
                    }
                }
            }
        }
    });
}

// === VERSION SIMPLIFIÉE DES STATISTIQUES (avec pourcentages cumulés) ===
// === VERSION RECOMMANDÉE (une seule barre par kit, simple) ===
function createSimplifiedDimensioningHTML(stats, kitThresholds) {
    if (stats.totalDays === 0) {
        return `
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-top: 12px;">
                <span style="color: #64748b;">📊 Aucune consommation</span>
            </div>
        `;
    }

    const kitOrder = ['Kit 0', 'Kit 1', 'Kit 2', 'Kit 3', 'Kit 4', 'Kit 4+'];

    let html = '';
    kitOrder.forEach(kitLabel => {
        const percentage = stats.percentages[kitLabel] || 0;
        const count = stats.distribution[kitLabel] || 0;

        if (percentage === 0 && count === 0) return;

        const kitInfo = kitLabel === 'Kit 4+'
            ? { color: '#dc2626' }
            : kitThresholds.find(k => k.label === kitLabel);

        html += `
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>
                        <span style="display: inline-block; width: 12px; height: 12px; background: ${kitInfo.color}; border-radius: 4px; margin-right: 6px;"></span>
                        <span style="font-weight: 500;">${kitLabel}</span>
                        <span style="color: #64748b; font-size: 12px; margin-left: 8px;">${count}j</span>
                    </span>
                    <span style="font-weight: 600; color: ${kitInfo.color};">${percentage}%</span>
                </div>
                <div style="width: 100%; height: 16px; background: #edf2f7; border-radius: 8px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: ${kitInfo.color}; border-radius: 8px;"></div>
                </div>
            </div>
        `;
    });

    return `
        <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 20px; overflow: hidden;">
            <div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                <span style="font-weight: 600;">📊 Répartition cumulée par kit</span>
                <span style="float: right; color: #64748b; font-size: 12px;">${stats.totalDays} jours</span>
            </div>
            <div style="padding: 16px;">
                ${html}
            </div>
        </div>
    `;
}

// ======================== CALCUL DES POURCENTAGES DE DIMENSIONNEMENT (VERSION CUMULÉE) ========================
function calculateDimensioningPercentages(energyData, kitThresholds) {
    // Filtrer les jours avec consommation > 0
    const daysWithConsumption = energyData.filter(v => v && v > 0);
    const totalDays = daysWithConsumption.length;

    if (totalDays === 0) {
        return {
            totalDays: 0,
            percentages: {},
            distribution: {},
            averagePercentage: 0,
            recommendedKit: null,
            recommendedKitPercentage: 0,
            peakDistribution: {},
            modeKit: null,
            modePercentage: 0,
            maxCount: 0
        };
    }

    // Initialiser les compteurs
    const distribution = {};
    const percentages = {};

    kitThresholds.forEach(kit => {
        distribution[kit.label] = 0;
    });
    distribution['Kit 4+'] = 0; // Pour les dépassements

    // Analyser chaque jour
    let totalPercentageSum = 0;
    let maxEnergy = 0;
    let maxKitReached = null;

    daysWithConsumption.forEach(energy => {
        // Trouver le kit correspondant à cette consommation
        let kitForDay = null;
        let percentageForDay = 0;

        for (let i = 0; i < kitThresholds.length; i++) {
            if (energy <= kitThresholds[i].value) {
                kitForDay = kitThresholds[i].label;
                percentageForDay = Math.round((energy / kitThresholds[i].value) * 100);
                break;
            }
        }

        // Si dépasse le dernier kit
        if (!kitForDay) {
            const lastKit = kitThresholds[kitThresholds.length - 1];
            kitForDay = 'Kit 4+';
            percentageForDay = Math.round((energy / lastKit.value) * 100);
        }

        // Incrémenter la distribution
        distribution[kitForDay] = (distribution[kitForDay] || 0) + 1;
        totalPercentageSum += percentageForDay;

        // Suivre le pic maximum
        if (energy > maxEnergy) {
            maxEnergy = energy;
            maxKitReached = kitForDay;
        }
    });

    // === MODIFICATION ICI : Calcul des pourcentages CUMULÉS ===
    // Trier les kits par valeur croissante
    const kitValueOrder = {
        'Kit 0': 250,
        'Kit 1': 360,
        'Kit 2': 540,
        'Kit 3': 720,
        'Kit 4': 1080,
        'Kit 4+': 9999
    };

    // Trier les kits par leur valeur seuil (du plus petit au plus grand)
    const sortedKits = Object.keys(distribution).sort((a, b) => {
        return kitValueOrder[a] - kitValueOrder[b];
    });

    // Calculer les pourcentages cumulés
    let cumulativeSum = 0;
    sortedKits.forEach(kit => {
        cumulativeSum += distribution[kit];
        percentages[kit] = Math.round((cumulativeSum / totalDays) * 100);
    });

    // 🔴 Trouver le kit avec le PLUS GRAND NOMBRE DE JOURS (pour référence)
    let maxCount = 0;
    let modeKit = null;
    let modePercentage = 0;

    Object.keys(distribution).forEach(kit => {
        if (distribution[kit] > maxCount) {
            maxCount = distribution[kit];
            modeKit = kit;
            modePercentage = percentages[kit]; // Maintenant c'est le pourcentage cumulé
        }
    });

    // Kit recommandé = celui avec le plus de jours
    const recommendedKit = modeKit;
    const recommendedKitPercentage = modePercentage;
    const recommendedKitCount = maxCount;

    // Pourcentage moyen (non cumulé, reste le même)
    const averagePercentage = totalDays > 0 ? Math.round(totalPercentageSum / totalDays) : 0;

    console.log('📊 Analyse dimensionnement (cumulée):', {
        distribution,
        percentages, // Maintenant ce sont des pourcentages cumulés
        modeKit,
        modePercentage,
        maxCount,
        recommendedKit,
        totalDays
    });

    return {
        totalDays,
        percentages,        // ✅ Pourcentages CUMULÉS
        distribution,       // Distribution brute (non cumulée)
        averagePercentage,
        maxEnergy,
        maxKitReached,
        modeKit,
        modePercentage,
        maxCount,
        recommendedKit,
        recommendedKitPercentage,
        recommendedKitCount
    };
}

// ======================== CRÉATION DU HTML DES STATISTIQUES DE DIMENSIONNEMENT ========================
function createDimensioningStatsHTML(stats, kitThresholds) {
    if (stats.totalDays === 0) {
        return `
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #94a3b8; margin-top: 12px; font-size: 13px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 18px;">📊</span>
                    <span style="font-weight: 600; color: #475569;">Aucune consommation significative</span>
                </div>
            </div>
        `;
    }

    // ===== NOUVELLE LOGIQUE DE RECOMMANDATION =====
    let recommendedKit = null;
    let recommendedKitInfo = null;
    let recommendedKitPercentage = 0;

    // Trier les kits par leur pourcentage (du plus élevé au plus bas)
    const sortedKits = Object.entries(stats.percentages)
        .map(([kit, percentage]) => ({
            kit,
            percentage: percentage
        }))
        .sort((a, b) => b.percentage - a.percentage);

    // Filtrer les kits qui ont un pourcentage >= 20%
    const kitsAbove20 = sortedKits.filter(k => k.percentage >= 20);

    // Ordre de valeur des kits (du plus petit au plus grand)
    const kitValueOrder = {
        'Kit 0': 250,
        'Kit 1': 360,
        'Kit 2': 540,
        'Kit 3': 720,
        'Kit 4': 1080,
        'Kit 4+': 9999 // Valeur très élevée pour Kit 4+
    };

    if (kitsAbove20.length > 0) {
        // Si au moins un kit dépasse 20%, prendre le plus gros (avec la plus haute valeur seuil)
        recommendedKit = kitsAbove20.sort((a, b) => {
            const valueA = kitValueOrder[a.kit] || 0;
            const valueB = kitValueOrder[b.kit] || 0;
            return valueB - valueA; // Tri décroissant (du plus gros au plus petit)
        })[0].kit;
        recommendedKitPercentage = stats.percentages[recommendedKit];
    } else {
        // Si aucun kit ne dépasse 20%, prendre celui avec le plus grand pourcentage
        recommendedKit = sortedKits[0].kit;
        recommendedKitPercentage = stats.percentages[recommendedKit];
    }

    // Récupérer les informations du kit recommandé
    const cleanLabel = recommendedKit.replace('+', '');
    recommendedKitInfo = kitThresholds.find(k => k.label === cleanLabel);

    const dominantColor = recommendedKitInfo ? recommendedKitInfo.color :
        (recommendedKit === 'Kit 4+' ? '#dc2626' : '#667eea');

    const recommendedKitCount = stats.distribution[recommendedKit] || 0;

    // Barres de progression avec pourcentage de temps
    let progressBarsHTML = '';
    const kitOrder = ['Kit 0', 'Kit 1', 'Kit 2', 'Kit 3', 'Kit 4', 'Kit 4+'];

    kitOrder.forEach(kitLabel => {
        const percentage = stats.percentages[kitLabel] || 0;
        const count = stats.distribution[kitLabel] || 0;

        if (percentage === 0 && count === 0) return;

        const kitInfo = kitLabel === 'Kit 4+'
            ? { color: '#dc2626', label: 'Kit 4+' }
            : kitThresholds.find(k => k.label === kitLabel);

        const isRecommended = recommendedKit === kitLabel;

        progressBarsHTML += `
            <div style="margin-bottom: 14px; ${isRecommended ? 'background: ' + dominantColor + '08; padding: 10px; border-radius: 10px; border-left: 4px solid ' + dominantColor + ';' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 14px; height: 14px; background: ${kitInfo.color}; border-radius: 4px;"></span>
                            <span style="font-weight: ${isRecommended ? '700' : '600'}; font-size: 14px; color: ${isRecommended ? dominantColor : '#1e293b'};">
                                ${kitLabel}
                            </span>
                        </div>
                        <span style="font-size: 12px; color: #475569; background: #f1f5f9; padding: 3px 12px; border-radius: 20px;">
                            📅 ${count} jour${count !== 1 ? 's' : ''}
                        </span>
                        ${isRecommended ? `
                            <span style="background: ${dominantColor}; color: white; padding: 3px 12px; border-radius: 30px; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                                ⭐ RECOMMANDÉ
                            </span>
                        ` : ''}
                    </div>
                    <div style="display: flex; align-items: baseline; gap: 8px;">
                        <span style="font-weight: 800; font-size: 18px; color: ${kitInfo.color};">${percentage}%</span>
                        <span style="font-size: 11px; color: #64748b;">du temps</span>
                    </div>
                </div>
                
                <!-- Barre de progression -->
                <div style="position: relative; width: 100%; height: 10px; background: #edf2f7; border-radius: 6px; overflow: hidden; margin-top: 4px;">
                    <div style="width: ${percentage}%; height: 100%; background: ${kitInfo.color}; border-radius: 6px;"></div>
                </div>
                
                <!-- Phrase explicative pour chaque kit -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                    <span style="font-size: 11px; color: #475569;">
                        <span style="font-weight: 600;">${kitLabel}</span> correspond à 
                        <span style="font-weight: 700; color: ${kitInfo.color};">${percentage}% du temps</span>
                        ${isRecommended ? ' ⭐ (recommandé)' : ''}
                    </span>
                    <span style="font-size: 11px; color: #64748b;">
                        ${count}/${stats.totalDays} jours
                    </span>
                </div>
            </div>
        `;
    });

    // Message explicatif personnalisé
    let explicationMessage = '';
    if (kitsAbove20.length > 0) {
        const plusGrosKit = kitsAbove20.sort((a, b) =>
            (kitValueOrder[b.kit] || 0) - (kitValueOrder[a.kit] || 0)
        )[0].kit;
        explicationMessage = `Le <strong style="color: ${dominantColor};">${recommendedKit}</strong> est recommandé car il est le plus gros kit dépassant les 20% (${recommendedKitPercentage}% du temps).`;
    } else {
        explicationMessage = `Aucun kit ne dépasse 20% du temps. Le <strong style="color: ${dominantColor};">${recommendedKit}</strong> est recommandé car il a le pourcentage le plus élevé (${recommendedKitPercentage}% du temps).`;
    }

    return `
        <div style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; margin-top: 25px; 
                    box-shadow: 0 8px 20px rgba(0,0,0,0.06); overflow: hidden;">
            
            <!-- En-tête -->
            <div style="background: linear-gradient(135deg, ${dominantColor}10 0%, white 100%);
                      padding: 18px 22px; border-bottom: 3px solid ${dominantColor};">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 48px; height: 48px; background: ${dominantColor}; 
                              border-radius: 14px; display: flex; align-items: center; justify-content: center;
                              box-shadow: 0 6px 14px ${dominantColor}60;">
                        <span style="font-size: 26px; color: white;">🎯</span>
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                            <span style="font-size: 13px; color: #475569; font-weight: 700; letter-spacing: 0.8px;">
                                DIMENSIONNEMENT RECOMMANDÉ
                            </span>
                            <span style="background: ${dominantColor}20; color: ${dominantColor}; padding: 4px 14px; 
                                      border-radius: 40px; font-size: 12px; font-weight: 700;">
                                🏆 ${recommendedKitPercentage}% DU TEMPS
                            </span>
                        </div>
                        
                        <div style="display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;">
                            <span style="font-size: 28px; font-weight: 900; color: ${dominantColor}; line-height: 1;">
                                ${recommendedKit || 'Non déterminé'}
                            </span>
                            ${recommendedKitInfo ? `
                                <span style="font-size: 15px; color: #475569; background: white; 
                                          padding: 6px 18px; border-radius: 40px; border: 2px solid ${dominantColor}30;
                                          font-weight: 600;">
                                    ⚡ ${recommendedKitInfo.value.toLocaleString('fr-FR')} Wh/jour
                                </span>
                            ` : recommendedKit === 'Kit 4+' ? `
                                <span style="font-size: 15px; color: #475569; background: white; 
                                          padding: 6px 18px; border-radius: 40px; border: 2px solid #dc262630;
                                          font-weight: 600;">
                                    ⚡ >1080 Wh/jour
                                </span>
                            ` : ''}
                        </div>
                        
                        <div style="margin-top: 10px; font-size: 13px; color: #475569;">
                            <span style="font-weight: 600;">${recommendedKit}</span> est adapté pour 
                            <span style="font-weight: 800; color: ${dominantColor};">${recommendedKitPercentage}% du temps</span>
                            (${recommendedKitCount} jours sur ${stats.totalDays})
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Distribution détaillée -->
            <div style="padding: 22px 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
                    <h5 style="margin: 0; font-size: 16px; color: #0f172a; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 20px;">📊</span>
                        <span style="font-weight: 700;">Répartition détaillée par kit</span>
                    </h5>
                    <span style="font-size: 12px; color: #475569; background: #f8fafc; padding: 6px 16px; 
                              border-radius: 40px; border: 1px solid #e2e8f0; font-weight: 500;">
                        📋 ${stats.totalDays} jours de consommation
                    </span>
                </div>
                
                ${progressBarsHTML}
                
                <!-- Explication concise avec la nouvelle logique -->
                <div style="margin-top: 20px; padding: 14px 18px; background: #f8fafc; border-radius: 12px; 
                          border-left: 5px solid ${dominantColor}; font-size: 13px;">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <span style="font-size: 18px; color: ${dominantColor};">📌</span>
                        <div style="flex: 1;">
                            <span style="font-weight: 700; color: ${dominantColor};">En résumé :</span>
                            <span style="color: #334155;">
                                ${explicationMessage}
                                Le pic à ${Math.round(stats.maxEnergy)} Wh 
                                (${stats.maxKitReached}) n'est présent que ${stats.percentages[stats.maxKitReached] || 0}% du temps.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ======================== ONGLET FRAUDE ========================
// ======================== ONGLET FRAUDE - ANALYSE DES CHUTES DE TENSION NOCTURNES (18h-6h) ========================
let tensionAnalysisData = {
    voltageDrops: [],
    stats: {
        totalDrops: 0,
        criticalDrops: 0,
        maxDrop: 0,
        maxDropDate: '',
        systemType: '12V',
        normalTension: 14,
        criticalThreshold: 4.2,
        dropsByHour: new Array(24).fill(0),
        dropsByPeriod: {
            night: 0,      // 18h-6h (période critique)
            day: 0         // 6h-18h (période normale)
        }
    },
    lastUpdate: '',
    currentPeriodFilter: 'night' // Par défaut, on affiche la nuit
};

// Fonction d'analyse des chutes de tension NOCTURNES (18h-6h)
function analyzeVoltageDrops() {
    console.log('🔍 Analyse des chutes de tension nocturnes (18h-6h)...');

    const drops = [];
    const stats = {
        totalDrops: 0,
        criticalDrops: 0,
        maxDrop: 0,
        maxDropDate: '',
        systemType: '12V',
        normalTension: 14,
        criticalThreshold: 4.2,
        dropsByHour: new Array(24).fill(0),
        dropsByPeriod: {
            night: 0,  // 18h-6h (période critique pour picorage)
            day: 0     // 6h-18h (période normale)
        }
    };

    // Seuils de détection
    const SIGNIFICANT_DROP = 1.5; // Chute significative > 1.5V
    const CRITICAL_DROP = 4.2;    // Chute critique > 4.2V (30% de 14V)

    // Période nocturne à surveiller (18h - 6h)
    const NIGHT_START = 18; // 18h
    const NIGHT_END = 6;    // 6h (le lendemain)

    // Utiliser les données de tension existantes
    if (tensionResults && tensionResults.length > 0) {

        // Trier par date et heure
        const sortedTension = [...tensionResults].sort((a, b) => {
            const dateA = new Date(a.date.split('/').reverse().join('-') + 'T' + a.heure);
            const dateB = new Date(b.date.split('/').reverse().join('-') + 'T' + b.heure);
            return dateA - dateB;
        });

        // Détecter les chutes entre mesures consécutives
        for (let i = 1; i < sortedTension.length; i++) {
            const prev = sortedTension[i - 1];
            const curr = sortedTension[i];

            // Même date et heures consécutives
            if (prev.date === curr.date) {
                const prevHour = parseInt(prev.heure.split('h')[0] || prev.heure.split(':')[0]);
                const currHour = parseInt(curr.heure.split('h')[0] || curr.heure.split(':')[0]);
                const prevTension = parseFloat(prev.tension || prev.valeur || 0);
                const currTension = parseFloat(curr.tension || curr.valeur || 0);

                // Vérifier si c'est une chute (baisse de tension)
                if (prevTension > currTension && (currHour - prevHour === 1 || currHour - prevHour === 0)) {
                    const drop = prevTension - currTension;

                    if (drop > SIGNIFICANT_DROP) {
                        // Déterminer si c'est de nuit (période critique) ou de jour
                        const isNightTime = (currHour >= NIGHT_START || currHour < NIGHT_END);
                        const period = isNightTime ? '🌙 Nuit (18h-6h)' : '☀️ Jour (6h-18h)';

                        // Compter par heure
                        stats.dropsByHour[currHour]++;

                        // Compter par période
                        if (isNightTime) {
                            stats.dropsByPeriod.night++;
                        } else {
                            stats.dropsByPeriod.day++;
                        }

                        // Déterminer la sévérité
                        let severity = 'significatif';
                        let severityColor = '#f59e0b';
                        if (drop > CRITICAL_DROP) {
                            severity = 'critique';
                            severityColor = '#ef4444';
                            stats.criticalDrops++;
                        }

                        // Mettre à jour la pire chute
                        if (drop > stats.maxDrop) {
                            stats.maxDrop = Math.round(drop * 100) / 100;
                            stats.maxDropDate = curr.date;
                        }

                        drops.push({
                            date: curr.date,
                            hour: currHour,
                            time: curr.heure,
                            prevTension: Math.round(prevTension * 100) / 100,
                            currTension: Math.round(currTension * 100) / 100,
                            drop: Math.round(drop * 100) / 100,
                            period: period,
                            isNight: isNightTime,
                            severity: severity,
                            severityColor: severityColor,
                            duration: '60 min',
                            fromTo: `${prevTension.toFixed(2)} → ${currTension.toFixed(2)} V`
                        });

                        stats.totalDrops++;
                    }
                }
            }
        }
    }

    // Déterminer le type de système (basé sur la tension moyenne)
    if (tensionResults && tensionResults.length > 0) {
        const avgTension = tensionResults.reduce((sum, t) => sum + parseFloat(t.tension || t.valeur || 0), 0) / tensionResults.length;
        stats.systemType = avgTension > 20 ? '24V' : '12V';
        stats.normalTension = stats.systemType === '24V' ? 28 : 14;
        stats.criticalThreshold = Math.round(stats.normalTension * 0.3 * 10) / 10; // 30% de la tension normale
    }

    console.log(`✅ Analyse terminée: ${drops.length} chutes détectées (${stats.dropsByPeriod.night} de nuit, ${stats.dropsByPeriod.day} de jour)`);

    return {
        voltageDrops: drops.sort((a, b) => new Date(b.date) - new Date(a.date)),
        stats: stats,
        lastUpdate: new Date().toLocaleString('fr-FR'),
        currentPeriodFilter: 'night' // Par défaut, on affiche la nuit
    };
}

// Fonction pour filtrer les chutes par période
function filterDropsByPeriod(drops, period) {
    if (period === 'all') return drops;
    if (period === 'night') return drops.filter(drop => drop.isNight === true);
    if (period === 'day') return drops.filter(drop => drop.isNight === false);
    return drops;
}

// Générer le HTML pour l'onglet DÉTECTION
function generateFraudDetectionHTML() {
    // Lancer l'analyse si pas encore faite
    if (!tensionAnalysisData.voltageDrops || tensionAnalysisData.voltageDrops.length === 0) {
        tensionAnalysisData = analyzeVoltageDrops();
    }

    const data = tensionAnalysisData;
    const stats = data.stats;
    const allDrops = data.voltageDrops;
    const currentFilter = data.currentPeriodFilter || 'night';

    // Filtrer les drops selon la période sélectionnée
    const filteredDrops = filterDropsByPeriod(allDrops, currentFilter);

    // Créer la répartition par heure (uniquement les heures de nuit mises en évidence)
    let hourBarsHTML = '';
    for (let h = 0; h < 24; h++) {
        const count = stats.dropsByHour[h] || 0;
        const maxCount = Math.max(...stats.dropsByHour, 1);
        const barHeight = maxCount > 0 ? (count / maxCount) * 40 : 0;

        // Mettre en évidence les heures de nuit (18h-6h)
        const isNightHour = (h >= 18 || h < 6);
        const barColor = isNightHour ? '#6366f1' : '#94a3b8';
        const bgOpacity = isNightHour ? '1' : '0.3';

        hourBarsHTML += `
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                <div style="font-size: 10px; color: #64748b; margin-bottom: 4px;">${count}</div>
                <div style="height: 50px; width: 100%; display: flex; align-items: flex-end; justify-content: center;">
                    <div style="width: 70%; height: ${barHeight}px; background: ${barColor}; opacity: ${bgOpacity}; border-radius: 4px 4px 0 0;"></div>
                </div>
                <div style="font-size: 9px; color: ${isNightHour ? '#6366f1' : '#94a3b8'}; margin-top: 4px; font-weight: ${isNightHour ? '600' : 'normal'};">${h}h</div>
            </div>
        `;
    }

    // Créer les lignes du tableau des chutes (filtrées)
    const dropsRows = filteredDrops.map((drop, index) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: 500;">${drop.date}</td>
            <td style="padding: 12px;">
                <span style="display: flex; align-items: center; gap: 4px; background: ${drop.isNight ? '#6366f120' : 'transparent'}; padding: 4px 8px; border-radius: 12px;">
                    ${drop.period}
                </span>
            </td>
            <td style="padding: 12px; font-weight: 700; color: ${drop.severityColor};">${drop.drop} V</td>
            <td style="padding: 12px; font-family: monospace;">${drop.fromTo}</td>
            <td style="padding: 12px;">${drop.duration}</td>
            <td style="padding: 12px; font-family: monospace;">${drop.time}</td>
            <td style="padding: 12px;">
                <span style="background: ${drop.severityColor}20; color: ${drop.severityColor}; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">
                    ${drop.severity === 'critique' ? 'CRITIQUE' : 'Significatif'}
                </span>
            </td>
        </tr>
    `).join('');

    return `
        <div style="padding: 20px;">
            
            <!-- En-tête avec titre -->
            <div style="margin-bottom: 25px;">
                <h2 style="margin: 0 0 5px 0; font-size: 24px; color: #0f172a; display: flex; align-items: center; gap: 10px;">
                    <span>🌙</span> Analyse des Chutes de Tension Nocturnes (18h - 6h)
                </h2>
                <p style="margin: 0; color: #64748b; font-size: 14px;">Surveillance des baisses de tension en période critique (suspicion de picorage)</p>
            </div>
            
            <!-- Cartes KPI -->
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 15px; margin-bottom: 25px;">
                
                <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">Chutes totales</div>
                    <div style="font-size: 32px; font-weight: 700; color: #0f172a;">${stats.totalDrops}</div>
                </div>
                
                <div style="background: #6366f120; border-radius: 12px; padding: 16px; border: 1px solid #6366f1;">
                    <div style="font-size: 12px; color: #4f46e5; margin-bottom: 5px;">🌙 Chutes nocturnes</div>
                    <div style="font-size: 32px; font-weight: 700; color: #4f46e5;">${stats.dropsByPeriod.night}</div>
                </div>
                
                <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">Chutes critiques</div>
                    <div style="font-size: 32px; font-weight: 700; color: #ef4444;">${stats.criticalDrops}</div>
                </div>
                
                <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">Pire chute</div>
                    <div style="font-size: 32px; font-weight: 700; color: #f97316;">${stats.maxDrop} V</div>
                </div>
                
                <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">Système</div>
                    <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${stats.systemType}</div>
                </div>
                
                <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">Période critique</div>
                    <div style="font-size: 14px; font-weight: 600; color: #4f46e5;">18h → 6h</div>
                </div>
            </div>
            
            <!-- Indicateurs de seuils -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
                
                <div style="background: #f0f9ff; border-radius: 10px; padding: 15px; display: flex; align-items: center; gap: 15px; border: 1px solid #bae6fd;">
                    <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 20px; color: white;">📊</span>
                    </div>
                    <div>
                        <div style="font-size: 11px; color: #64748b;">Tension normale</div>
                        <div style="font-size: 24px; font-weight: 700; color: #0f172a;">${stats.normalTension} V</div>
                    </div>
                </div>
                
                <div style="background: #fef3c7; border-radius: 10px; padding: 15px; display: flex; align-items: center; gap: 15px; border: 1px solid #fde68a;">
                    <div style="width: 40px; height: 40px; background: #f59e0b; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 20px; color: white;">⚠️</span>
                    </div>
                    <div>
                        <div style="font-size: 11px; color: #64748b;">Seuil critique (-30%)</div>
                        <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">${stats.criticalThreshold} V</div>
                    </div>
                </div>
                
                <div style="background: #6366f120; border-radius: 10px; padding: 15px; display: flex; align-items: center; gap: 15px; border: 1px solid #6366f1;">
                    <div style="width: 40px; height: 40px; background: #4f46e5; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 20px; color: white;">🌙</span>
                    </div>
                    <div>
                        <div style="font-size: 11px; color: #4f46e5;">Période surveillée</div>
                        <div style="font-size: 18px; font-weight: 700; color: #4f46e5;">18h - 6h</div>
                    </div>
                </div>
            </div>
            
            <!-- Graphique de répartition par heure avec zone nuit surlignée -->
            <div style="background: white; border-radius: 16px; padding: 20px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
                <h4 style="margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                    <span>📊</span> Répartition des chutes par heure <span style="background: #6366f120; color: #4f46e5; padding: 4px 8px; border-radius: 12px; font-size: 12px; margin-left: 10px;">Zone critique surlignée</span>
                </h4>
                
                <div style="display: grid; grid-template-columns: repeat(24, 1fr); gap: 2px; margin-bottom: 20px;">
                    ${hourBarsHTML}
                </div>
                
                <!-- Indicateur de zone nocturne -->
                <div style="display: flex; justify-content: space-between; margin-top: 5px; padding: 5px 0;">
                    <div style="width: 25%; text-align: center; font-size: 11px; color: #94a3b8;">0h</div>
                    <div style="width: 25%; text-align: center; font-size: 11px; color: #94a3b8;">6h</div>
                    <div style="width: 25%; text-align: center; font-size: 11px; color: #94a3b8;">12h</div>
                    <div style="width: 25%; text-align: center; font-size: 11px; color: #94a3b8;">18h</div>
                </div>
                <div style="height: 6px; background: linear-gradient(90deg, #6366f1 0%, #6366f1 25%, #94a3b8 25%, #94a3b8 75%, #6366f1 75%, #6366f1 100%); border-radius: 3px;"></div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <span style="font-size: 10px; color: #4f46e5;">🌙 Nuit (0h-6h)</span>
                    <span style="font-size: 10px; color: #94a3b8;">☀️ Jour</span>
                    <span style="font-size: 10px; color: #4f46e5;">🌙 Nuit (18h-24h)</span>
                </div>
            </div>
            
            <!-- Tableau détaillé des chutes avec focus nuit -->
            <div style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
                
                <!-- Onglets du tableau -->
                <div style="display: flex; border-bottom: 2px solid #e2e8f0; background: #f8fafc;">
                    <div onclick="filterFraudTable('night')" style="padding: 12px 20px; cursor: pointer; border-bottom: 3px solid ${currentFilter === 'night' ? '#4f46e5' : 'transparent'}; font-weight: ${currentFilter === 'night' ? '700' : '500'}; color: ${currentFilter === 'night' ? '#4f46e5' : '#64748b'}; background: ${currentFilter === 'night' ? '#6366f110' : 'transparent'};">
                        🌙 Nuit (${stats.dropsByPeriod.night})
                    </div>
                    <div onclick="filterFraudTable('day')" style="padding: 12px 20px; cursor: pointer; border-bottom: 3px solid ${currentFilter === 'day' ? '#94a3b8' : 'transparent'}; font-weight: ${currentFilter === 'day' ? '700' : '500'}; color: ${currentFilter === 'day' ? '#475569' : '#64748b'};">
                        ☀️ Jour (${stats.dropsByPeriod.day})
                    </div>
                    <div onclick="filterFraudTable('all')" style="padding: 12px 20px; cursor: pointer; border-bottom: 3px solid ${currentFilter === 'all' ? '#3b82f6' : 'transparent'}; font-weight: ${currentFilter === 'all' ? '700' : '500'}; color: ${currentFilter === 'all' ? '#3b82f6' : '#64748b'};">
                        📋 Tous (${stats.totalDrops})
                    </div>
                </div>
                
                <!-- En-tête du tableau -->
                <div style="padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                        <span>📋</span> Détail des chutes de tension
                        ${currentFilter === 'night' ? '<span style="background: #6366f1; color: white; padding: 2px 10px; border-radius: 20px; font-size: 11px;">FOCUS NUIT</span>' : ''}
                    </h4>
                    <div style="display: flex; gap: 15px;">
                        <span style="font-size: 12px; background: #fef3c7; padding: 4px 10px; border-radius: 20px;">
                            ⚠️ Significatif >1.5V
                        </span>
                        <span style="font-size: 12px; background: #fee2e2; padding: 4px 10px; border-radius: 20px;">
                            🔴 Critique >${stats.criticalThreshold}V
                        </span>
                        <span style="font-size: 12px; background: #e2e8f0; padding: 4px 10px; border-radius: 20px;">
                            📊 ${filteredDrops.length} chute(s)
                        </span>
                    </div>
                </div>
                
                <div style="overflow-x: auto; max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 10;">
                            <tr>
                                <th style="padding: 12px; text-align: left;">Date</th>
                                <th style="padding: 12px; text-align: left;">Période</th>
                                <th style="padding: 12px; text-align: left;">Chute (V)</th>
                                <th style="padding: 12px; text-align: left;">Tension</th>
                                <th style="padding: 12px; text-align: left;">Durée</th>
                                <th style="padding: 12px; text-align: left;">Horaire</th>
                                <th style="padding: 12px; text-align: left;">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dropsRows || '<tr><td colspan="7" style="padding: 30px; text-align: center; color: #64748b;">Aucune chute de tension dans cette période</td></tr>'}
                        </tbody>
                    </table>
                </div>
                
                <!-- Légende et mise à jour -->
                <div style="padding: 15px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; display: flex; justify-content: space-between;">
                    <div style="display: flex; gap: 20px;">
                        <span>⚠️ Chute significative (>1.5V)</span>
                        <span>🔴 Chute critique (>${stats.criticalThreshold}V)</span>
                        <span>🌙 Période surveillée: 18h - 6h</span>
                    </div>
                    <span>Dernière analyse: ${data.lastUpdate}</span>
                </div>
            </div>
            
            <!-- Message d'alerte si anomalies nocturnes -->
            ${stats.dropsByPeriod.night > 0 ? `
            <div style="margin-top: 20px; background: #6366f110; border: 2px solid #4f46e5; border-radius: 12px; padding: 15px; display: flex; align-items: center; gap: 15px;">
                <span style="font-size: 24px;">🌙</span>
                <div>
                    <span style="font-weight: 700; color: #4f46e5;">${stats.dropsByPeriod.night} chute(s) nocturne(s) détectée(s)</span>
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #334155;">
                        Des baisses de tension anormales ont été détectées entre 18h et 6h. 
                        Ces créneaux sont critiques car ils peuvent indiquer des branchements sauvages (picorage).
                        ${stats.dropsByPeriod.night > 3 ? '⚠️ Nombre élevé de suspicions, vérification recommandée.' : ''}
                    </p>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

// Fonction pour filtrer le tableau
function filterFraudTable(period) {
    tensionAnalysisData.currentPeriodFilter = period;

    // Recharger l'onglet DETECTION
    const contentElement = document.getElementById('sub-content-DETECTION');
    if (contentElement) {
        contentElement.innerHTML = generateFraudDetectionHTML();
    }
}

// Rendre la fonction accessible globalement
window.filterFraudTable = filterFraudTable;

// Mettre à jour la fonction principale
function displayFraudeTab(subTab) {
    console.log(`🔍 Affichage onglet FRAUDE - Sous-onglet: ${subTab}`);

    const contentElement = document.getElementById(`sub-content-${subTab}`);
    if (!contentElement) return;

    // Lancer l'analyse des chutes de tension
    tensionAnalysisData = analyzeVoltageDrops();

    if (subTab === 'DETECTION') {
        contentElement.innerHTML = generateFraudDetectionHTML();
    } else if (subTab === 'HISTORIQUE') {
        contentElement.innerHTML = generateFraudHistoryHTML();
    }
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
// === FONCTION POUR CRÉER LE GRAPHIQUE TENSION (MIN/MAX/MOYENNE PAR JOUR) ===
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

    // --- NOUVEAU : Calcul des données pour la tension moyenne ---
    const avgData = dates.map(date => {
        if (tensionByDay[date] && tensionByDay[date].min !== null && tensionByDay[date].max !== null) {
            // Moyenne simple du min et du max du jour. Vous pouvez changer cette logique si vous avez une vraie moyenne journalière.
            return ((tensionByDay[date].min + tensionByDay[date].max) / 2).toFixed(2);
        }
        return null;
    });

    // Créer le graphique
    const ctx = chartCanvas.getContext('2d');
    window.allClientsTensionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Tension Maximale (V)',
                    data: maxData,
                    borderColor: '#f97316', // Orange plus vif
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: maxData.map(value => {
                        if (value === null) return '#f97316';
                        return value > systemLimits.max ? '#ef4444' : '#f97316';
                    }),
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5,
                    pointHoverRadius: 5
                },
                {
                    label: 'Tension Minimale (V)',
                    data: minData,
                    borderColor: '#3b82f6', // Bleu plus vif
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: minData.map(value => {
                        if (value === null) return '#3b82f6';
                        return value < systemLimits.min ? '#ef4444' : '#3b82f6';
                    }),
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1.5,
                    pointHoverRadius: 5
                },
                // --- NOUVEAU : Dataset pour la tension moyenne ---
                {
                    label: 'Tension Moyenne (V)',
                    data: avgData,
                    borderColor: '#22c55e', // Vert vif pour la moyenne
                    backgroundColor: 'rgba(34, 197, 94, 0.05)', // Fond très léger
                    borderWidth: 3, // Ligne légèrement plus épaisse
                    borderDash: [8, 5], // Ligne en pointillés pour la différencier
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0, // Pas de points individuels pour une ligne plus propre
                    pointHoverRadius: 4, // Un point apparaît au survol
                    pointHoverBackgroundColor: '#22c55e',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            // --- AMÉLIORATION : Réduction des marges internes ---
            layout: {
                padding: {
                    top: 5,
                    bottom: 5,
                    left: 5,
                    right: 5
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            animation: {
                duration: 500, // Animation plus rapide
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'center', // Centrer la légende
                    labels: {
                        font: {
                            size: 11, // Police légèrement plus petite
                            weight: '500'
                        },
                        color: '#334155',
                        padding: 10, // Moins d'espace autour des labels
                        usePointStyle: true,
                        boxWidth: 8,
                        boxHeight: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 10,
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 11 },
                    cornerRadius: 6,
                    displayColors: true,
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.y;
                            if (value === null) return `${context.dataset.label}: Pas de données`;
                            return `${context.dataset.label}: ${value.toFixed(2)} V`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    // --- AMÉLIORATION : Réduction de l'espace du titre Y ---
                    title: {
                        display: true,
                        text: 'Tension (V)',
                        font: { size: 11, weight: '500' },
                        color: '#475569',
                        padding: { top: 0, bottom: 5 } // Réduction du padding
                    },
                    ticks: {
                        font: { size: 10 },
                        color: '#64748b',
                        callback: function (value) {
                            return value.toFixed(1) + ' V';
                        },
                        padding: 5, // Réduction du padding
                        stepSize: 2, // Suggestion : Force un pas plus grand pour moins de ticks
                        autoSkip: true
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)',
                        lineWidth: 0.8
                    },
                    // --- AMÉLIORATION : Suggérer une plage pour éviter trop d'espace vide ---
                    suggestedMin: systemLimits.min - 1,
                    suggestedMax: systemLimits.max + 1
                },
                x: {
                    // --- AMÉLIORATION : Réduction de l'espace du titre X ---
                    title: {
                        display: true,
                        text: 'Dates',
                        font: { size: 11, weight: '500' },
                        color: '#475569',
                        padding: { top: 5, bottom: 0 } // Réduction du padding
                    },
                    ticks: {
                        font: { size: 10 },
                        color: '#64748b',
                        maxRotation: 30,
                        minRotation: 20,
                        autoSkip: true,
                        maxTicksLimit: 10 // Limite le nombre de dates affichées
                    },
                    grid: {
                        display: false
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
                    ctx.save();
                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, minPixel);
                    ctx.lineTo(chart.chartArea.right, minPixel);
                    ctx.stroke();

                    // Ligne max acceptable
                    const maxPixel = yScale.getPixelForValue(systemLimits.max);
                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(chart.chartArea.left, maxPixel);
                    ctx.lineTo(chart.chartArea.right, maxPixel);
                    ctx.stroke();

                    // Plage idéale (optionnel, peut être enlevé si trop chargé)
                    // const idealMinPixel = yScale.getPixelForValue(systemLimits.ideal.min);
                    // const idealMaxPixel = yScale.getPixelForValue(systemLimits.ideal.max);
                    // ctx.fillStyle = 'rgba(56, 161, 105, 0.05)';
                    // ctx.fillRect(chart.chartArea.left, idealMaxPixel,
                    //     chart.chartArea.right - chart.chartArea.left,
                    //     idealMinPixel - idealMaxPixel);

                    ctx.setLineDash([]);
                    ctx.restore();
                }
            }
        ],
        // Garder l'interaction au clic si nécessaire
        onClick: (event, elements, chart) => {
            if (elements.length > 0) {
                const element = elements[0];
                const dateIndex = element.index;
                const selectedDate = allClientsHourlyMatrix.dates[dateIndex];
                if (selectedDate && typeof openTensionHourlyModal === 'function') {
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

//=========================ANALYSES PICAGES=============================

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
// Dans addAllClientsStyles() ou dans une nouvelle fonction
function addNewColumnStyles() {
    if (document.querySelector('#new-column-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'new-column-styles';
    styles.textContent = `
        .energy-sum-header, .intensity-header {
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: white !important;
            font-weight: 700;
        }
        
        .row-energy-sum {
            background: #eff6ff;
            font-weight: 600;
            text-align: center;
            border-left: 2px solid #93c5fd;
            border-right: 2px solid #93c5fd;
        }
        
        .row-intensity {
            background: #f0fdf4;
            font-weight: 600;
            text-align: center;
        }
        
        .row-intensity[style*="color: #ef4444"] {
            background: #fee2e2;
            animation: pulse 2s infinite;
        }
        
        .row-intensity[style*="color: #f59e0b"] {
            background: #fff3cd;
        }
        
        .row-intensity[style*="color: #10b981"] {
            background: #d1fae5;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        /* Tooltip pour expliquer le calcul */
        .intensity-header {
            position: relative;
            cursor: help;
        }
        
        .intensity-header:hover::after {
            content: "Intensité = (∑ Énergie) / Tension";
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #1e293b;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
            z-index: 100;
            margin-bottom: 5px;
        }
    `;

    document.head.appendChild(styles);
}
// Ajoutez cette fonction si elle n'existe pas déjà
function addEventMatrixStyles() {
    if (document.querySelector('#event-matrix-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'event-matrix-styles';
    styles.textContent = `
        /* Styles pour le tableau matriciel des événements */
        .events-matrix-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            min-width: 1000px;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .events-matrix-table th {
            padding: 16px 12px;
            font-weight: 700;
            text-align: center;
            border: 1px solid #e2e8f0;
            white-space: nowrap;
        }

        .events-matrix-table td {
            padding: 14px 10px;
            border: 1px solid #e2e8f0;
            text-align: center;
            vertical-align: middle;
            transition: background-color 0.2s;
        }

        /* Style pour la colonne Date */
        .events-matrix-table .date-cell {
            background: #f8fafc;
            font-weight: 700;
            color: #1e293b;
            font-size: 14px;
            border-right: 2px solid #cbd5e1;
            box-shadow: 2px 0 5px rgba(0,0,0,0.02);
        }

        /* Style pour les cellules de temps (début/fin) */
        .events-matrix-table .time-cell {
            font-family: 'Courier New', monospace;
            font-weight: 600;
            font-size: 13px;
            background: white;
        }

        /* Style pour les cellules de durée */
        .events-matrix-table .duration-cell {
            font-family: 'Courier New', monospace;
            font-weight: 700;
            font-size: 13px;
            background: white;
        }

        /* Style pour les cellules vides */
        .events-matrix-table .empty-cell {
            color: #cbd5e1;
            background: #fafafa;
            font-style: italic;
        }

        /* Surbrillance au survol */
        .events-matrix-table tbody tr:hover td {
            background: #f8fafc !important;
        }

        .events-matrix-table tbody tr:hover .date-cell {
            background: #e6f0fa !important;
        }

        /* Style pour les en-têtes principaux */
        .events-matrix-table thead tr:first-child th {
            border-bottom: 3px solid currentColor;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 12px;
        }

        /* Style pour les sous-en-têtes */
        .events-matrix-table thead tr:last-child th {
            background: #f8fafc;
            color: #475569;
            font-weight: 600;
            font-size: 12px;
            padding: 12px 8px;
            border-top: none;
        }

        /* Lignes alternées pour meilleure lisibilité */
        .events-matrix-table tbody tr:nth-child(even) {
            background-color: #fafbfc;
        }

        /* Animation d'apparition */
        @keyframes fadeInRow {
            from { 
                opacity: 0; 
                transform: translateY(5px); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0); 
            }
        }

        .events-matrix-table tbody tr {
            animation: fadeInRow 0.3s ease-out;
        }

        /* Badge pour plusieurs périodes (optionnel) */
        .period-badge {
            display: inline-block;
            background: #f1f5f9;
            color: #475569;
            font-size: 10px;
            padding: 2px 8px;
            border-radius: 12px;
            margin-left: 6px;
            font-weight: 600;
        }

        /* Style pour les en-têtes colorés */
        .events-matrix-table th[style*="background: #e0f2fe"] {
            border-bottom-color: #38bdf8 !important;
        }

        .events-matrix-table th[style*="background: #fee2e2"] {
            border-bottom-color: #ef4444 !important;
        }

        .events-matrix-table th[style*="background: #fef9c3"] {
            border-bottom-color: #eab308 !important;
        }

        .events-matrix-table th[style*="background: #fae8ff"] {
            border-bottom-color: #c084fc !important;
        }

        /* Responsive */
        @media (max-width: 1200px) {
            .events-matrix-table {
                font-size: 12px;
            }
            
            .events-matrix-table th,
            .events-matrix-table td {
                padding: 10px 6px;
            }
            
            .events-matrix-table .time-cell,
            .events-matrix-table .duration-cell {
                font-size: 12px;
            }
        }

        @media (max-width: 768px) {
            .table-wrapper {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }
            
            .events-matrix-table {
                min-width: 900px;
            }
        }
    `;

    document.head.appendChild(styles);
}
// ======================== FONCTIONS POUR LE FILTRAGE PAR DATE ========================

// Variable pour stocker la date actuellement sélectionnée
window.currentSelectedDate = null;

// Initialiser le graphique avec la dernière date
function initializeHourlyChartWithLastDate() {
    const allDates = getSortedEnergyHourlyDates();
    if (!allDates || allDates.length === 0) return;

    const startIndex = Math.max(0, allDates.length - 7);
    const startDate = allDates[startIndex];
    const endDate = allDates[allDates.length - 1];

    const startSelect = document.getElementById('energy-hourly-start-date');
    const endSelect = document.getElementById('energy-hourly-end-date');
    if (startSelect) startSelect.value = startDate;

    // Mettre à jour la liste des fins (fenêtre 7 jours) et sélectionner la dernière
    if (startSelect && endSelect) {
        onEnergyHourlyStartDateChange();
        endSelect.value = endDate;
    }

    // Mettre à jour le badge de période
    const startLabel = document.getElementById('energy-hourly-range-start-label');
    const endLabel = document.getElementById('energy-hourly-range-end-label');
    if (startLabel) startLabel.textContent = startDate;
    if (endLabel) endLabel.textContent = endDate;

    // Dessiner le graphique sur la plage initiale
    const selectedRange = allDates.slice(startIndex);
    const hourlyData = calculateHourlyDataForDateRange(selectedRange);
    createEnergyHourlyRangeChart(hourlyData);

    // Afficher les statistiques avancées
    updateAdvancedHourlyStats(hourlyData);
}

// ===== FILTRE PAR PLAGE DE DATES (MAX 7 JOURS) - GRAPH ÉNERGIE HORAIRE =====
function getSortedEnergyHourlyDates() {
    const allDates = (window.filteredDates || allClientsHourlyMatrix.dates || []).slice();
    if (!allDates.length) return [];

    allDates.sort((a, b) => {
        const da = new Date(a.split('/').reverse().join('-'));
        const db = new Date(b.split('/').reverse().join('-'));
        return da - db;
    });
    return allDates;
}

function onEnergyHourlyStartDateChange() {
    const startSelect = document.getElementById('energy-hourly-start-date');
    const endSelect = document.getElementById('energy-hourly-end-date');
    if (!startSelect || !endSelect) return;

    const sortedDates = getSortedEnergyHourlyDates();
    if (!sortedDates.length) return;

    const startDate = startSelect.value || sortedDates[0];
    let startIndex = sortedDates.indexOf(startDate);
    if (startIndex === -1) startIndex = 0;

    const allowedDates = sortedDates.slice(startIndex, startIndex + 7);

    endSelect.innerHTML = allowedDates.map((date, index) => {
        const isLast = index === allowedDates.length - 1;
        return `<option value="${date}" ${isLast ? 'selected' : ''}>${date}</option>`;
    }).join('');
}

// ======================== FONCTION À REMPLACER ========================
function applyEnergyHourlyDateFilter() {
    const startSelect = document.getElementById('energy-hourly-start-date');
    const endSelect = document.getElementById('energy-hourly-end-date');
    if (!startSelect || !endSelect) return;

    const startDate = startSelect.value;
    const endDate = endSelect.value;
    if (!startDate || !endDate) return;

    const allDates = getSortedEnergyHourlyDates();
    if (!allDates.length) return;

    const startIndex = allDates.indexOf(startDate);
    const endIndex = allDates.indexOf(endDate);
    if (startIndex === -1 || endIndex === -1) return;

    const realStartIndex = Math.min(startIndex, endIndex);
    const realEndIndex = Math.max(startIndex, endIndex);
    const selectedRange = allDates.slice(realStartIndex, realEndIndex + 1);

    const startLabel = document.getElementById('energy-hourly-range-start-label');
    const endLabel = document.getElementById('energy-hourly-range-end-label');
    if (startLabel) startLabel.textContent = selectedRange[0];
    if (endLabel) endLabel.textContent = selectedRange[selectedRange.length - 1];

    const hourlyData = calculateHourlyDataForDateRange(selectedRange);
    createEnergyHourlyRangeChart(hourlyData);

    // Utiliser la nouvelle fonction de statistiques avancées
    updateAdvancedHourlyStats(hourlyData);
}

// ======================== FONCTION À REMPLACER ========================
function resetEnergyHourlyDateFilter() {
    const allDates = getSortedEnergyHourlyDates();
    if (!allDates.length) return;

    const startIndex = Math.max(0, allDates.length - 7);
    const startDate = allDates[startIndex];
    const endDate = allDates[allDates.length - 1];

    const startSelect = document.getElementById('energy-hourly-start-date');
    const endSelect = document.getElementById('energy-hourly-end-date');
    if (startSelect) startSelect.value = startDate;
    if (startSelect && endSelect) {
        onEnergyHourlyStartDateChange();
        endSelect.value = endDate;
    }

    const startLabel = document.getElementById('energy-hourly-range-start-label');
    const endLabel = document.getElementById('energy-hourly-range-end-label');
    if (startLabel) startLabel.textContent = startDate;
    if (endLabel) endLabel.textContent = endDate;

    const selectedRange = allDates.slice(startIndex);
    const hourlyData = calculateHourlyDataForDateRange(selectedRange);
    createEnergyHourlyRangeChart(hourlyData);

    // Utiliser la nouvelle fonction de statistiques avancées
    updateAdvancedHourlyStats(hourlyData);
}

function calculateHourlyDataForDateRange(dates) {
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    const clients = (allClientsHourlyMatrix.clients || []).slice();
    const daysCount = (dates && dates.length) ? dates.length : 0;

    // Détails par date pour les tooltips (par client / par heure)
    const detailsByDate = {};
    const allDataPoints = [];

    let totalEnergy = 0;
    let total00_18 = 0;
    let total18_23 = 0;
    let maxEnergy = 0;
    let peakHour = -1;

    // Agrégats globaux (sur toutes les dates sélectionnées) pour les stats
    const sumsAcrossDatesByHour = new Array(24).fill(0);

    if (daysCount > 0) {
        dates.forEach((date) => {
            const totalsByHour = new Array(24).fill(0);
            const perClientByHour = {};
            clients.forEach(clientId => {
                perClientByHour[clientId] = new Array(24).fill(0);
            });

            hours.forEach((hour, hourIndex) => {
                const key = `${date}_${hour}`;
                const rowData = allClientsHourlyMatrix.data[key] || {};

                let hourTotal = 0;
                clients.forEach(clientId => {
                    const energy = rowData[`client_${clientId}`];
                    const v = (energy !== null && energy !== undefined && !isNaN(energy)) ? parseFloat(energy) : 0;
                    perClientByHour[clientId][hourIndex] = v;
                    hourTotal += v;
                });

                totalsByHour[hourIndex] = hourTotal;
                sumsAcrossDatesByHour[hourIndex] += hourTotal;

                const timestamp = new Date(date.split('/').reverse().join('-') + 'T' + hour).getTime();
                allDataPoints.push({
                    date,
                    hour,
                    hourIndex,
                    timestamp,
                    label: `${date} ${hour}`,
                    total: hourTotal,
                    perClient: clients.reduce((acc, clientId) => {
                        acc[clientId] = perClientByHour[clientId][hourIndex];
                        return acc;
                    }, {})
                });
            });

            detailsByDate[date] = {
                totalsByHour,
                perClientByHour
            };
        });
    }

    // Stats globales sur la période sélectionnée
    sumsAcrossDatesByHour.forEach((hourTotal, index) => {
        totalEnergy += hourTotal;
        if (index < 18) total00_18 += hourTotal;
        else total18_23 += hourTotal;
        if (hourTotal > maxEnergy) {
            maxEnergy = hourTotal;
            peakHour = index;
        }
    });

    // Moyenne horaire par jour sur la période (utile pour le bloc stats)
    const averageEnergy = (daysCount > 0) ? (totalEnergy / (24 * daysCount)) : 0;
    const rangeLabel = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : '';

    return {
        date: rangeLabel,
        hours,
        clients: clients,
        detailsByDate: detailsByDate,
        allDataPoints: allDataPoints.sort((a, b) => a.timestamp - b.timestamp),
        daysCount: daysCount,
        totalEnergy,
        total00_18,
        total18_23,
        maxEnergy,
        peakHour,
        averageEnergy,
        peakHourDisplay: peakHour >= 0 ? `${peakHour}:00` : '-'
    };
}
// ======================== CALCUL DES STATISTIQUES HORAIRES AVANCÉES ========================
function calculateAdvancedHourlyStats(hourlyData) {
    if (!hourlyData || !hourlyData.allDataPoints || hourlyData.allDataPoints.length === 0) {
        return null;
    }

    const points = hourlyData.allDataPoints;
    const dates = [...new Set(points.map(p => p.date))].sort((a, b) => {
        const da = new Date(a.split('/').reverse().join('-'));
        const db = new Date(b.split('/').reverse().join('-'));
        return da - db;
    });

    const nbJours = dates.length;

    // Initialisation des accumulateurs
    let totalEnergie = 0;
    let heuresAvecConso = 0;
    let maxEnergie = 0;
    let maxEnergieHeure = '';
    let maxEnergieDate = '';

    // Cumuls par période
    let totalJour = 0;      // 6h-18h
    let heuresJour = 0;
    let totalNuit = 0;      // 18h-6h
    let heuresNuit = 0;

    // Pour la moyenne à 23h
    let valeurs23h = [];

    // Pour la moyenne max journalière
    let maxJournalier = [];

    // Pour chaque date, calculer les consommations horaires
    dates.forEach(date => {
        const datePoints = points.filter(p => p.date === date).sort((a, b) => a.hourIndex - b.hourIndex);
        let maxDuJour = 0;
        let heureMaxDuJour = '';

        if (datePoints.length > 0) {
            let previousTotal = 0;

            datePoints.forEach((point, idx) => {
                const hourIndex = point.hourIndex;
                const currentTotal = point.total || 0;

                // Calculer la consommation pour cette heure
                let consoHeure;
                if (hourIndex === 0) {
                    consoHeure = currentTotal; // Cumul minuit
                } else {
                    consoHeure = Math.max(0, currentTotal - previousTotal);
                }

                // Mise à jour du total général
                totalEnergie += consoHeure;

                // Compter les heures avec consommation
                if (consoHeure > 0) {
                    heuresAvecConso++;
                }

                // Mise à jour du max global
                if (consoHeure > maxEnergie) {
                    maxEnergie = consoHeure;
                    maxEnergieHeure = `${hourIndex.toString().padStart(2, '0')}:00`;
                    maxEnergieDate = date;
                }

                // Mise à jour du max journalier
                if (consoHeure > maxDuJour) {
                    maxDuJour = consoHeure;
                    heureMaxDuJour = `${hourIndex.toString().padStart(2, '0')}:00`;
                }

                // Cumuls par période
                // Jour: 6h à 18h (heureIndex 6 à 17 inclus)
                if (hourIndex >= 6 && hourIndex < 18) {
                    totalJour += consoHeure;
                    heuresJour++;
                }
                // Nuit: 18h à 23h et 0h à 5h
                else {
                    totalNuit += consoHeure;
                    heuresNuit++;
                }

                // Collecter les valeurs à 23h
                if (hourIndex === 23) {
                    valeurs23h.push({
                        date: date,
                        valeur: consoHeure
                    });
                }

                previousTotal = currentTotal;
            });

            // Ajouter le max du jour
            maxJournalier.push({
                date: date,
                valeur: maxDuJour,
                heure: heureMaxDuJour
            });
        }
    });

    // Calcul des moyennes
    const moyenneGlobale = heuresAvecConso > 0 ? totalEnergie / heuresAvecConso : 0;
    const moyenneJour = heuresJour > 0 ? totalJour / heuresJour : 0;
    const moyenneNuit = heuresNuit > 0 ? totalNuit / heuresNuit : 0;

    // Calcul des pourcentages
    const totalPeriode = totalJour + totalNuit;
    const pourcentageJour = totalPeriode > 0 ? (totalJour / totalPeriode) * 100 : 0;
    const pourcentageNuit = totalPeriode > 0 ? (totalNuit / totalPeriode) * 100 : 0;

    // Calcul de la moyenne à 23h
    const valeurs23hValides = valeurs23h.filter(v => v.valeur > 0);
    const moyenne23h = valeurs23hValides.length > 0
        ? valeurs23hValides.reduce((sum, v) => sum + v.valeur, 0) / valeurs23hValides.length
        : 0;

    // Calcul de la moyenne des max journaliers
    const maxJournalierValides = maxJournalier.filter(m => m.valeur > 0);
    const moyenneMaxJournalier = maxJournalierValides.length > 0
        ? maxJournalierValides.reduce((sum, m) => sum + m.valeur, 0) / maxJournalierValides.length
        : 0;

    // Trouver le pic maximum
    const picMax = maxJournalierValides.length > 0
        ? maxJournalierValides.reduce((max, m) => m.valeur > max.valeur ? m : max, { valeur: 0 })
        : { valeur: 0, date: '', heure: '' };

    return {
        nbJours,
        moyenneGlobale,
        totalEnergie,
        heuresAvecConso,
        maxEnergie,
        maxEnergieHeure,
        maxEnergieDate,
        periode: {
            jour: {
                total: totalJour,
                heures: heuresJour,
                moyenne: moyenneJour,
                pourcentage: pourcentageJour
            },
            nuit: {
                total: totalNuit,
                heures: heuresNuit,
                moyenne: moyenneNuit,
                pourcentage: pourcentageNuit
            }
        },
        moyenne23h,
        moyenneMaxJournalier,
        picMax: {
            valeur: maxEnergie,
            heure: maxEnergieHeure,
            date: maxEnergieDate
        },
        maxJournalier: maxJournalierValides,
        valeurs23h: valeurs23hValides
    };
}

// ======================== MISE À JOUR DE L'AFFICHAGE DES STATISTIQUES ========================
function updateAdvancedHourlyStats(hourlyData) {
    const statsDiv = document.getElementById('hourly-quick-stats');
    if (!statsDiv) return;

    const stats = calculateAdvancedHourlyStats(hourlyData);
    if (!stats) {
        statsDiv.innerHTML = '<div style="color: #64748b; padding: 8px;">Aucune donnée disponible</div>';
        return;
    }

    // Formatage des nombres avec 1 décimale
    const formatNumber = (num) => {
        if (num === undefined || num === null || isNaN(num)) return '0.0';
        return num.toFixed(1);
    };

    const formatPercentage = (num) => {
        if (num === undefined || num === null || isNaN(num)) return '0.0%';
        return num.toFixed(1) + '%';
    };

    statsDiv.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; background: white; padding: 16px 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            
            <!-- 📊 Moyenne horaire globale -->
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);">
                    <span style="font-size: 20px; color: white;">📊</span>
                </div>
                <div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 500; letter-spacing: 0.3px;">MOYENNE HORAIRE</div>
                    <div style="font-weight: 800; font-size: 22px; color: #1e293b; line-height: 1.2;">${formatNumber(stats.moyenneGlobale)} <span style="font-size: 14px; font-weight: 500; color: #64748b;">Wh/h</span></div>
                </div>
            </div>
            
            <div style="width: 1px; height: 40px; background: linear-gradient(to bottom, transparent, #cbd5e1, transparent);"></div>
            
            <!-- 🌅 Jour (6h-18h) -->
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);">
                    <span style="font-size: 20px; color: white;">🌅</span>
                </div>
                <div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 500; letter-spacing: 0.3px;">JOUR (6H-18H)</div>
                    <div style="display: flex; align-items: baseline; gap: 8px;">
                        <span style="font-weight: 800; font-size: 22px; color: #b45309;">${formatNumber(stats.periode.jour.moyenne)} <span style="font-size: 14px; font-weight: 500; color: #b45309;">Wh/h</span></span>
                        <span style="background: #fef3c7; padding: 4px 10px; border-radius: 30px; font-size: 13px; font-weight: 700; color: #b45309;">${formatPercentage(stats.periode.jour.pourcentage)}</span>
                    </div>
                </div>
            </div>
            
            <div style="width: 1px; height: 40px; background: linear-gradient(to bottom, transparent, #cbd5e1, transparent);"></div>
            
            <!-- 🌙 Nuit (18h-6h) -->
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">
                    <span style="font-size: 20px; color: white;">🌙</span>
                </div>
                <div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 500; letter-spacing: 0.3px;">NUIT (18H-6H)</div>
                    <div style="display: flex; align-items: baseline; gap: 8px;">
                        <span style="font-weight: 800; font-size: 22px; color: #1e40af;">${formatNumber(stats.periode.nuit.moyenne)} <span style="font-size: 14px; font-weight: 500; color: #1e40af;">Wh/h</span></span>
                        <span style="background: #dbeafe; padding: 4px 10px; border-radius: 30px; font-size: 13px; font-weight: 700; color: #1e40af;">${formatPercentage(stats.periode.nuit.pourcentage)}</span>
                    </div>
                </div>
            </div>
            
            <div style="width: 1px; height: 40px; background: linear-gradient(to bottom, transparent, #cbd5e1, transparent);"></div>
            
            <!-- 📅 Moyenne à 23h -->
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(168, 85, 247, 0.3);">
                    <span style="font-size: 20px; color: white;">📅</span>
                </div>
                <div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 500; letter-spacing: 0.3px;">MOYENNE À 23H</div>
                    <div style="font-weight: 800; font-size: 22px; color: #7e22ce; line-height: 1.2;">${formatNumber(stats.moyenne23h)} <span style="font-size: 14px; font-weight: 500; color: #7e22ce;">Wh/h</span></div>
                </div>
            </div>
            
            <div style="width: 1px; height: 40px; background: linear-gradient(to bottom, transparent, #cbd5e1, transparent);"></div>
            
            <!-- 🔥 Max observé -->
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);">
                    <span style="font-size: 20px; color: white;">🔥</span>
                </div>
                <div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 500; letter-spacing: 0.3px;">MAX OBSERVÉ</div>
                    <div style="font-weight: 800; font-size: 22px; color: #b91c1c; line-height: 1.2;">${formatNumber(stats.picMax.valeur)} <span style="font-size: 14px; font-weight: 500; color: #b91c1c;">Wh/h</span></div>
                    <div style="font-size: 10px; color: #991b1b; margin-top: 2px;">${stats.picMax.heure} · ${stats.picMax.date}</div>
                </div>
            </div>
            
            <div style="width: 1px; height: 40px; background: linear-gradient(to bottom, transparent, #cbd5e1, transparent);"></div>
            
            <!-- 📈 Moyenne des max journaliers -->
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #f97316 0%, #c2410c 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(249, 115, 22, 0.3);">
                    <span style="font-size: 20px; color: white;">📈</span>
                </div>
                <div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 500; letter-spacing: 0.3px;">MOYENNE DES MAX</div>
                    <div style="font-weight: 800; font-size: 22px; color: #c2410c; line-height: 1.2;">${formatNumber(stats.moyenneMaxJournalier)} <span style="font-size: 14px; font-weight: 500; color: #c2410c;">Wh/h</span></div>
                </div>
            </div>
        </div>
    `;

    console.log('✅ Statistiques avancées mises à jour');
}

// ======================== GRAPHIQUE 1 : BARRES (conso horaire) ========================
function createEnergyHourlyBarChart(hourlyData) {
    const chartCanvas = document.getElementById('allClientsHourlyChart');
    if (!chartCanvas) return;

    if (window.allClientsHourlyChartInstance) {
        window.allClientsHourlyChartInstance.destroy();
    }

    const ctx = chartCanvas.getContext('2d');

    const points = (hourlyData.allDataPoints || []).slice();
    const dates = Object.keys(hourlyData.detailsByDate || {}).sort((a, b) => {
        const da = new Date(a.split('/').reverse().join('-'));
        const db = new Date(b.split('/').reverse().join('-'));
        return da - db;
    });

    const palette = generateColorPalette(dates.length);

    // Créer des labels pour l'affichage continu
    const continuousLabels = [];

    dates.forEach((date, dateIndex) => {
        const dayNumber = dateIndex + 1;
        for (let hour = 0; hour < 24; hour++) {
            const startHour = hour.toString().padStart(2, '0');
            const endHour = ((hour + 1) % 24).toString().padStart(2, '0');
            continuousLabels.push(`J${dayNumber} ${startHour}-${endHour}`);
        }
    });

    // Créer les datasets pour les barres (conso horaire)
    const datasets = dates.map((date, dateIdx) => {
        const color = palette[dateIdx] || '#3b82f6';

        // Données pour les barres
        const barData = new Array(continuousLabels.length).fill(null);

        const datePoints = points.filter(p => p.date === date).sort((a, b) => a.hourIndex - b.hourIndex);

        if (datePoints.length > 0) {
            let previousTotal = 0;

            datePoints.forEach((point) => {
                const hourIndex = point.hourIndex;
                const currentTotal = point.total || 0;
                const startPos = dateIdx * 24 + hourIndex;

                // Consommation horaire (différence)
                let consoHeure;
                if (hourIndex === 0) {
                    consoHeure = currentTotal;
                } else {
                    consoHeure = Math.max(0, currentTotal - previousTotal);
                }

                barData[startPos] = consoHeure;
                previousTotal = currentTotal;
            });
        }

        return {
            label: `${date} (J${dateIdx + 1})`,
            data: barData,
            backgroundColor: color + '20', // 12% d'opacité
            borderColor: color,
            borderWidth: 2,
            borderRadius: 4,
            barThickness: 14,
            maxBarThickness: 18,
            barPercentage: 0.9,
            categoryPercentage: 1.0,
            order: dateIdx,
            hoverBackgroundColor: color + '40',
            hoverBorderColor: color,
            hoverBorderWidth: 3
        };
    });

    window.allClientsHourlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: continuousLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 10 },
                        color: '#334155',
                        padding: 10,
                        usePointStyle: true,
                        boxWidth: 8
                    },
                    title: {
                        display: true,
                        text: '📊 CONSOMMATION HORAIRE (Wh/h)',
                        font: { size: 12, weight: 'bold' },
                        color: '#0f172a'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 12,
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    displayColors: true,
                    callbacks: {
                        title: (context) => {
                            const label = context[0].label;
                            const [jour, interval] = label.split(' ');
                            const [startHour, endHour] = interval.split('-');
                            const dayNum = parseInt(jour.replace('J', ''));
                            const date = dates[dayNum - 1];
                            return `📅 ${date} - ${startHour}:00 → ${endHour}:00`;
                        },
                        label: (context) => {
                            const value = context.parsed.y;
                            if (value === null || value === 0) return '⚡ Aucune consommation';
                            return `⚡ Consommation: ${value.toFixed(1)} Wh`;
                        },
                        afterBody: (tooltipItems) => {
                            const item = tooltipItems[0];
                            const dayNum = parseInt(item.label.split(' ')[0].replace('J', ''));
                            const date = dates[dayNum - 1];
                            const hourMatch = item.label.match(/(\d{2})-/);
                            if (!hourMatch) return [];

                            const hourIndex = parseInt(hourMatch[1]);
                            const point = points.find(p => p.date === date && p.hourIndex === hourIndex);

                            if (!point || !point.perClient) return [];

                            const clientsWithConso = Object.entries(point.perClient)
                                .filter(([_, val]) => val > 0)
                                .sort(([_, a], [__, b]) => b - a);

                            if (clientsWithConso.length === 0) return [];

                            const lines = [' ', '📊 Détail par client:'];
                            clientsWithConso.forEach(([clientId, value]) => {
                                const clientNum = parseInt(clientId).toString().padStart(2, '0');
                                lines.push(`  Client ${clientNum}: ${value.toFixed(1)} Wh`);
                            });

                            return lines;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Consommation (Wh/h)',
                        font: { size: 12, weight: 'bold' },
                        color: '#334155'
                    },
                    ticks: {
                        callback: (value) => value + ' Wh',
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        font: { size: 8 },
                        maxRotation: 45,
                        minRotation: 30,
                        callback: function (val, index) {
                            const label = this.getLabelForValue(val);
                            if (label.includes('00-01')) return label;
                            if (label.includes('12-13')) return label.split(' ')[1];
                            return '';
                        }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// ======================== GRAPHIQUE 2 : LIGNES (cumul journalier) - MODE CONTINU ========================
function createEnergyCumulativeChart(hourlyData) {
    const chartCanvas = document.getElementById('allClientsCumulativeChart');
    if (!chartCanvas) return;

    if (window.allClientsCumulativeChartInstance) {
        window.allClientsCumulativeChartInstance.destroy();
    }

    const ctx = chartCanvas.getContext('2d');

    const points = (hourlyData.allDataPoints || []).slice();
    const dates = Object.keys(hourlyData.detailsByDate || {}).sort((a, b) => {
        const da = new Date(a.split('/').reverse().join('-'));
        const db = new Date(b.split('/').reverse().join('-'));
        return da - db;
    });

    const palette = generateColorPalette(dates.length);

    // Créer des labels pour l'affichage continu (J1 00h, J1 01h, ..., J2 00h, ... J7 23h)
    const continuousLabels = [];

    dates.forEach((date, dateIndex) => {
        const dayNumber = dateIndex + 1;
        for (let hour = 0; hour < 24; hour++) {
            continuousLabels.push(`J${dayNumber} ${hour.toString().padStart(2, '0')}h`);
        }
    });

    // Créer un dataset par date pour les barres de cumul
    const datasets = dates.map((date, dateIdx) => {
        const color = palette[dateIdx] || '#3b82f6';

        // Données de cumul pour cette date (placement continu)
        const cumulativeData = new Array(continuousLabels.length).fill(null);

        const datePoints = points.filter(p => p.date === date).sort((a, b) => a.hourIndex - b.hourIndex);

        if (datePoints.length > 0) {
            let cumulative = 0;

            datePoints.forEach((point) => {
                const hourIndex = point.hourIndex;
                const currentTotal = point.total || 0;
                const startPos = dateIdx * 24 + hourIndex;

                // Calculer la consommation horaire pour le cumul
                let consoHeure;
                if (hourIndex === 0) {
                    consoHeure = currentTotal;
                } else {
                    const previousPoint = datePoints.find(p => p.hourIndex === hourIndex - 1);
                    const previousTotal = previousPoint ? previousPoint.total : 0;
                    consoHeure = Math.max(0, currentTotal - previousTotal);
                }

                cumulative += consoHeure;
                cumulativeData[startPos] = cumulative;
            });
        }

        return {
            label: `${date} (J${dateIdx + 1}) - Cumul`,
            data: cumulativeData,
            backgroundColor: color + '15', // Très transparent (9% d'opacité)
            borderColor: color,
            borderWidth: 1.5,
            borderRadius: 3,
            barThickness: 10,
            maxBarThickness: 12,
            barPercentage: 0.8,
            categoryPercentage: 1.0,
            order: dateIdx,
            hoverBackgroundColor: color + '30',
            hoverBorderColor: color,
            hoverBorderWidth: 2
        };
    });

    window.allClientsCumulativeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: continuousLabels, // Mêmes labels continus que le graphique 1
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 9 },
                        color: '#334155',
                        padding: 8,
                        usePointStyle: true,
                        boxWidth: 6
                    },
                    title: {
                        display: true,
                        text: '📊 CUMUL JOURNALIER (Wh)',
                        font: { size: 11, weight: 'bold' },
                        color: '#0f172a'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 10,
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 11 },
                    displayColors: true,
                    callbacks: {
                        title: (context) => {
                            const label = context[0].label;
                            const [jour, heure] = label.split(' ');
                            const dayNum = parseInt(jour.replace('J', ''));
                            const date = dates[dayNum - 1];
                            return `📅 ${date} - ${heure}`;
                        },
                        label: (context) => {
                            const value = context.parsed.y;
                            if (value === null) return 'Donnée manquante';

                            const hour = context.label.split(' ')[1].replace('h', 'h00');
                            return `📊 Cumul à ${hour}: ${value.toFixed(1)} Wh`;
                        },
                        afterLabel: (context) => {
                            return '⬆️ Depuis minuit';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Wh',
                        font: { size: 10, weight: 'bold' },
                        color: '#334155'
                    },
                    ticks: {
                        callback: (value) => value + ' Wh',
                        font: { size: 9 }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        font: { size: 7 },
                        maxRotation: 30,
                        minRotation: 20,
                        callback: function (val, index) {
                            const label = this.getLabelForValue(val);
                            // Afficher le début de chaque jour et quelques repères
                            if (label.includes('00h')) return label;
                            if (label.includes('06h') || label.includes('12h') || label.includes('18h')) {
                                return label.split(' ')[1];
                            }
                            return '';
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    console.log('✅ Graphique cumulé créé en mode continu (barres)');
}

// ======================== FONCTION PRINCIPALE ========================
function createEnergyHourlyRangeChart(hourlyData) {
    // Créer le premier graphique (barres)
    createEnergyHourlyBarChart(hourlyData);

    // Créer le deuxième graphique (cumul)
    createEnergyCumulativeChart(hourlyData);

    console.log('✅ Graphiques créés : barres (conso horaire) + lignes (cumul)');
}

// Mettre à jour le graphique pour une date spécifique
function updateHourlyChartForSingleDate(date) {
    if (!date) return;

    // Préparer les données pour une seule date
    const hourlyData = calculateHourlyDataForSingleDate(date);

    // Mettre à jour le graphique
    createSingleDateHourlyChart(hourlyData);

    // Mettre à jour les statistiques
    updateHourlyStats(hourlyData);

    // Mettre à jour l'affichage
    updateDateDisplay(date);
}

// Calculer les données horaires pour une seule date avec les stats spécifiques
function calculateHourlyDataForSingleDate(date) {
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    const hourlyTotals = new Array(24).fill(0);

    // Variables pour les cumuls
    let totalEnergyDay = 0;
    let totalEnergy00_18 = 0; // Cumul 00h - 18h
    let totalEnergy18_23 = 0; // Cumul 18h - 23h
    let maxEnergy = 0;
    let peakHour = -1;

    // Pour chaque heure, calculer la somme de tous les clients
    hours.forEach((hour, index) => {
        const key = `${date}_${hour}`;
        const rowData = allClientsHourlyMatrix.data[key] || {};

        let hourTotal = 0;
        allClientsHourlyMatrix.clients.forEach(clientId => {
            const energy = rowData[`client_${clientId}`];
            if (energy !== null && energy !== undefined && !isNaN(energy)) {
                hourTotal += parseFloat(energy);
            }
        });

        hourlyTotals[index] = hourTotal;

        // Cumuls par période
        totalEnergyDay += hourTotal;

        if (index >= 0 && index < 18) { // 00h à 17h inclus (car index 0 = 00h, index 17 = 17h)
            totalEnergy00_18 += hourTotal;
        } else if (index >= 18 && index <= 23) { // 18h à 23h
            totalEnergy18_23 += hourTotal;
        }

        // Heure de pointe
        if (hourTotal > maxEnergy) {
            maxEnergy = hourTotal;
            peakHour = index;
        }
    });

    // Calcul de l'énergie moyenne (exclure les heures à 0)
    const nonZeroHours = hourlyTotals.filter(v => v > 0).length;
    const averageEnergy = nonZeroHours > 0 ? totalEnergyDay / 24 : 0; // Moyenne sur 24h

    return {
        date: date,
        hours: hours,
        data: hourlyTotals,
        totalEnergy: totalEnergyDay,
        total00_18: totalEnergy00_18,
        total18_23: totalEnergy18_23,
        maxEnergy: maxEnergy,
        peakHour: peakHour,
        averageEnergy: averageEnergy,
        peakHourDisplay: peakHour >= 0 ? `${peakHour}:00` : '-'
    };
}

// Créer le graphique pour une date unique
// Créer le graphique pour une date unique en mode LINE
function createSingleDateHourlyChart(hourlyData) {
    const chartCanvas = document.getElementById('allClientsHourlyChart');
    if (!chartCanvas) return;

    // Détruire l'ancien graphique
    if (window.allClientsHourlyChartInstance) {
        window.allClientsHourlyChartInstance.destroy();
    }

    // Points de données pour le graphique line
    const dataPoints = hourlyData.data;

    // Contexte canvas
    const ctx = chartCanvas.getContext('2d');

    window.allClientsHourlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hourlyData.hours,
            datasets: [{
                label: `Énergie Totale - ${hourlyData.date}`,
                data: dataPoints,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 4,
                pointBackgroundColor: dataPoints.map((value, index) => {
                    if (value === 0) return '#94a3b8';
                    if (index === hourlyData.peakHour) return '#ef4444';
                    return '#3b82f6';
                }),
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: dataPoints.map((value, index) => {
                    if (index === hourlyData.peakHour) return '#dc2626';
                    return '#2563eb';
                }),
                tension: 0.35,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 12,
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    callbacks: {
                        title: (context) => {
                            return `${hourlyData.date} - ${context[0].label}`;
                        },
                        label: (context) => {
                            const value = context.parsed.y;
                            return value > 0 ? `⚡ ${value.toFixed(1)} Wh` : 'Aucune consommation';
                        },
                        afterLabel: (context) => {
                            const hour = context.dataIndex;
                            if (hour === hourlyData.peakHour && context.parsed.y > 0) {
                                return '🔥 Heure de pointe';
                            }
                            return null;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Énergie (Wh)',
                        font: { size: 12, weight: 'bold' },
                        color: '#334155'
                    },
                    ticks: {
                        callback: (value) => value + ' Wh',
                        font: { size: 11 }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Heure',
                        font: { size: 12, weight: 'bold' },
                        color: '#334155'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        font: { size: 10 },
                        callback: function (val, index) {
                            // Afficher toutes les 2 heures pour éviter la surcharge
                            return index % 2 === 0 ? this.getLabelForValue(val) : '';
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Mettre à jour les statistiques avec les cumuls spécifiques
function updateHourlyStats(hourlyData) {
    const statsDiv = document.getElementById('hourly-quick-stats');
    if (!statsDiv) return;

    // Formater les nombres avec une décimale
    const formatNumber = (num) => num.toFixed(1);

    statsDiv.innerHTML = `
        <div style="display: flex; gap: 25px; align-items: center; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px;">📊</span>
                <span><strong>Moyenne:</strong> ${formatNumber(hourlyData.averageEnergy)} Wh/h</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px;">🔥</span>
                <span><strong>Max:</strong> ${formatNumber(hourlyData.maxEnergy)} Wh <span style="color: #64748b; font-size: 11px;">(${hourlyData.peakHourDisplay})</span></span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; background: #e0f2fe; padding: 4px 12px; border-radius: 20px;">
                <span style="font-size: 14px;">🌅</span>
                <span><strong>00h-18h:</strong> ${formatNumber(hourlyData.total00_18)} Wh</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; background: #fff3cd; padding: 4px 12px; border-radius: 20px;">
                <span style="font-size: 14px;">🌙</span>
                <span><strong>18h-23h:</strong> ${formatNumber(hourlyData.total18_23)} Wh</span>
            </div>
        </div>
    `;
}

// Mettre à jour l'affichage de la date
function updateDateDisplay(date) {
    const displaySpan = document.getElementById('selected-date-display');
    if (displaySpan) {
        displaySpan.textContent = date;
    }
}

// Fonction appelée quand on clique sur "Appliquer"
function updateHourlyChartForSelectedDate() {
    const selector = document.getElementById('hourly-date-selector');
    if (!selector) return;

    const selectedDate = selector.value;
    window.currentSelectedDate = selectedDate;
    updateHourlyChartForSingleDate(selectedDate);
}

// Revenir à la dernière date
function resetToLastDate() {
    const allDates = window.filteredDates || allClientsHourlyMatrix.dates;
    if (!allDates || allDates.length === 0) return;

    const lastDate = allDates[allDates.length - 1];

    const selector = document.getElementById('hourly-date-selector');
    if (selector) {
        selector.value = lastDate;
    }

    updateHourlyChartForSingleDate(lastDate);
}

// Écouter les changements dans le sélecteur (optionnel)
document.addEventListener('change', function (e) {
    if (e.target.id === 'hourly-date-selector') {
        // Mettre à jour automatiquement sans cliquer sur Appliquer
        // Décommentez la ligne suivante si vous voulez cette fonctionnalité
        // updateHourlyChartForSelectedDate();
    }
});
// Appelez cette fonction au chargement
document.addEventListener('DOMContentLoaded', addEventMatrixStyles);
// Fermer le modal quand on clique en dehors
document.addEventListener('click', (event) => {
    const modal = document.getElementById('tensionHourlyModal');
    if (!modal) return;

    if (event.target === modal) {
        closeTensionModal();
    }
});
function addCommercialStyles() {
    if (document.querySelector('#commercial-styles')) return;

    const style = document.createElement('style');
    style.id = 'commercial-styles';
    style.textContent = `
        /* --- En-tête Client --- */
        .commercial-header {
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: white;
            padding: 20px 25px;
            border-radius: 12px;
            margin-bottom: 25px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .client-icon {
            font-size: 28px;
        }
        .client-id {
            font-size: 22px;
            font-weight: 700;
        }
        .header-badges {
            display: flex;
            gap: 10px;
        }
        .badge {
            padding: 6px 18px;
            border-radius: 40px;
            font-size: 14px;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        .badge-active {
            background: #22c55e;
        }
        .badge-inactive {
            background: #94a3b8;
        }
        .badge-forfait {
            background: #f1f5f9;
            color: #1e293b;
        }

        /* --- Cartes Génériques --- */
        .card {
            background: white;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            margin-bottom: 25px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .card-header {
            padding: 18px 22px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .card-icon {
            font-size: 20px;
        }
        .card-title {
            font-weight: 700;
            color: #1e293b;
            font-size: 16px;
        }
        .card-subtitle {
            margin-left: auto;
            font-size: 12px;
            color: #64748b;
        }
        .card-subheader {
            padding: 12px 22px;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
            color: #475569;
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
        }
        .card-content {
            padding: 22px;
        }

        /* Carte spécifique au forfait actuel */
        .consumption-analysis-card.current-forfait {
            border: 2px solid #22c55e;
            box-shadow: 0 8px 20px rgba(34, 197, 94, 0.15);
            position: relative;
        }
        .badge-actuel {
            position: absolute;
            top: 15px;
            right: 22px;
            background: #22c55e;
            color: white;
            padding: 4px 16px;
            border-radius: 30px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        /* --- Tableau Historique --- */
        .forfait-history-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-bottom: 20px;
        }
        .forfait-history-table th {
            background: #f8fafc;
            padding: 12px 10px;
            text-align: left;
            font-weight: 600;
            color: #334155;
            border-bottom: 2px solid #e2e8f0;
        }
        .forfait-history-table td {
            padding: 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        .forfait-history-table .current-forfait-row {
            background: #f0fdf4;
            font-weight: 500;
        }

        /* --- Barres de progression --- */
        .progress-bars {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
        }
        .progress-bar-container {
            display: flex;
            height: 12px;
            background: #edf2f7;
            border-radius: 20px;
            overflow: hidden;
            margin: 8px 0;
        }
        .progress-bar-container.large {
            height: 20px;
        }
        .progress-bar-segment {
            height: 100%;
            transition: width 0.3s ease;
        }
        .progress-legend {
            display: flex;
            gap: 20px;
            font-size: 11px;
            color: #475569;
            flex-wrap: wrap;
        }
        .progress-legend span {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .progress-legend span span {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 3px;
        }

        /* --- Grille de statistiques --- */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }
        .stat-card {
            border-radius: 12px;
            padding: 16px;
            color: white;
        }
        .stat-card .stat-icon {
            font-size: 18px;
            margin-bottom: 10px;
            opacity: 0.9;
        }
        .stat-card .stat-label {
            font-size: 11px;
            opacity: 0.9;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .stat-card .stat-value {
            font-size: 28px;
            font-weight: 700;
            line-height: 1.2;
        }
        .stat-card .stat-sub {
            font-size: 10px;
            opacity: 0.8;
            margin-top: 4px;
        }
        .gradient-purple { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .gradient-blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
        .gradient-gray { background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); }
        .gradient-green { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }

        /* --- Section Répartition --- */
        .repartition-section {
            margin-top: 20px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        }
        .repartition-title {
            font-weight: 600;
            color: #1e293b;
            font-size: 14px;
            margin-bottom: 15px;
        }
        .repartition-legend {
            display: flex;
            gap: 25px;
            margin-top: 12px;
            font-size: 12px;
            color: #334155;
        }
        .repartition-legend div {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .repartition-legend div span {
            display: inline-block;
            width: 14px;
            height: 14px;
            border-radius: 3px;
        }
        .repartition-details {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            font-size: 13px;
            color: #475569;
        }

        /* --- Section Énergie Épuisée --- */
        .energy-depleted-section {
            margin-top: 20px;
            padding: 16px 20px;
            background: #fee2e2;
            border-radius: 10px;
            border-left: 4px solid #ef4444;
        }
        .depleted-title {
            font-weight: 600;
            color: #991b1b;
            font-size: 14px;
            margin-bottom: 5px;
        }
        .depleted-value {
            font-size: 24px;
            font-weight: 700;
            color: #b91c1c;
        }

        /* --- Responsive --- */
        @media (max-width: 1024px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        @media (max-width: 768px) {
            .stats-grid {
                grid-template-columns: 1fr;
            }
            .commercial-header {
                flex-direction: column;
                align-items: flex-start;
            }
            .header-badges {
                width: 100%;
                justify-content: flex-start;
            }
            .card-subheader {
                flex-direction: column;
            }
            .badge-actuel {
                position: static;
                display: inline-block;
                margin-left: 10px;
            }
        }
    `;
    document.head.appendChild(style);
}

// ======================== STYLES CSS POUR LA VERSION SIMPLIFIÉE ========================
function addSimplifiedCommercialStyles() {
    if (document.querySelector('#simplified-commercial-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'simplified-commercial-styles';
    styles.textContent = `
        /* Style pour l'en-tête client simplifié */
        .commercial-simple-header {
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        /* Améliorations pour le tableau existant */
        .daily-summary-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .daily-summary-table th {
            background: #f8fafc;
            padding: 14px 12px;
            text-align: left;
            font-weight: 600;
            color: #334155;
            border-bottom: 2px solid #e2e8f0;
            font-size: 13px;
        }
        
        .daily-summary-table td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .daily-summary-table tbody tr:hover {
            background: #f8fafc;
        }
        
        .row-index {
            color: #64748b;
            font-size: 12px;
            font-weight: 500;
            width: 50px;
        }
        
        .row-date {
            font-weight: 600;
            color: #0f172a;
        }
        
        .row-energy, .row-hour, .row-credit, .row-tension {
            font-family: 'Courier New', monospace;
        }
        
        .table-footer {
            padding: 15px 20px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
        }
        
        .pagination {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .pagination-btn {
            padding: 8px 16px;
            border: 1px solid #cbd5e1;
            background: white;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .pagination-btn:hover:not(:disabled) {
            background: #f1f5f9;
            border-color: #94a3b8;
        }
        
        .pagination-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .page-info {
            font-size: 13px;
            color: #334155;
            padding: 0 15px;
        }
        
        .items-info {
            color: #64748b;
            font-size: 12px;
            margin-left: 5px;
        }
        
        .table-info {
            text-align: center;
            font-size: 12px;
            color: #64748b;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed #e2e8f0;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .daily-summary-table {
                font-size: 12px;
            }
            
            .daily-summary-table th,
            .daily-summary-table td {
                padding: 8px 6px;
            }
            
            .pagination {
                flex-direction: column;
            }
        }
    `;

    document.head.appendChild(styles);
}
// ======================== STYLES À AJOUTER ========================
// Ajoutez cette fonction et appelez-la dans votre code
function addCommercialStyles() {
    if (document.querySelector('#commercial-styles')) return;

    const style = document.createElement('style');
    style.id = 'commercial-styles';
    style.textContent = `
        /* --- En-tête Client --- */
        .commercial-header {
            background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
            color: white;
            padding: 20px 25px;
            border-radius: 12px;
            margin-bottom: 25px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .client-icon {
            font-size: 28px;
        }
        .client-id {
            font-size: 22px;
            font-weight: 700;
        }
        .header-badges {
            display: flex;
            gap: 10px;
        }
        .badge {
            padding: 6px 18px;
            border-radius: 40px;
            font-size: 14px;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.2);
            color: white;
        }
        .badge-active {
            background: #22c55e;
        }
        .badge-inactive {
            background: #94a3b8;
        }
        .badge-forfait {
            background: #f1f5f9;
            color: #1e293b;
        }

        /* --- Cartes Génériques --- */
        .card {
            background: white;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            margin-bottom: 25px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .card-header {
            padding: 18px 22px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .card-icon {
            font-size: 20px;
        }
        .card-title {
            font-weight: 700;
            color: #1e293b;
            font-size: 16px;
        }
        .card-subtitle {
            margin-left: auto;
            font-size: 12px;
            color: #64748b;
        }
        .card-subheader {
            padding: 12px 22px;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
            color: #475569;
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
        }
        .card-content {
            padding: 22px;
        }

        /* Carte spécifique au forfait actuel */
        .consumption-analysis-card.current-forfait {
            border: 2px solid #22c55e;
            box-shadow: 0 8px 20px rgba(34, 197, 94, 0.15);
            position: relative;
        }
        .badge-actuel {
            position: absolute;
            top: 15px;
            right: 22px;
            background: #22c55e;
            color: white;
            padding: 4px 16px;
            border-radius: 30px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }

        /* --- Tableau Historique --- */
        .forfait-history-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-bottom: 20px;
        }
        .forfait-history-table th {
            background: #f8fafc;
            padding: 12px 10px;
            text-align: left;
            font-weight: 600;
            color: #334155;
            border-bottom: 2px solid #e2e8f0;
        }
        .forfait-history-table td {
            padding: 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        .forfait-history-table .current-forfait-row {
            background: #f0fdf4;
            font-weight: 500;
        }

        /* --- Barres de progression --- */
        .progress-bars {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
        }
        .progress-bar-container {
            display: flex;
            height: 12px;
            background: #edf2f7;
            border-radius: 20px;
            overflow: hidden;
            margin: 8px 0;
        }
        .progress-bar-container.large {
            height: 20px;
        }
        .progress-bar-segment {
            height: 100%;
            transition: width 0.3s ease;
        }
        .progress-legend {
            display: flex;
            gap: 20px;
            font-size: 11px;
            color: #475569;
            flex-wrap: wrap;
        }
        .progress-legend span {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .progress-legend span span {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 3px;
        }

        /* --- Grille de statistiques --- */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }
        .stat-card {
            border-radius: 12px;
            padding: 16px;
            color: white;
        }
        .stat-card .stat-icon {
            font-size: 18px;
            margin-bottom: 10px;
            opacity: 0.9;
        }
        .stat-card .stat-label {
            font-size: 11px;
            opacity: 0.9;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .stat-card .stat-value {
            font-size: 28px;
            font-weight: 700;
            line-height: 1.2;
        }
        .stat-card .stat-sub {
            font-size: 10px;
            opacity: 0.8;
            margin-top: 4px;
        }
        .gradient-purple { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .gradient-blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
        .gradient-gray { background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%); }
        .gradient-green { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }

        /* --- Section Répartition --- */
        .repartition-section {
            margin-top: 20px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        }
        .repartition-title {
            font-weight: 600;
            color: #1e293b;
            font-size: 14px;
            margin-bottom: 15px;
        }
        .repartition-legend {
            display: flex;
            gap: 25px;
            margin-top: 12px;
            font-size: 12px;
            color: #334155;
        }
        .repartition-legend div {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .repartition-legend div span {
            display: inline-block;
            width: 14px;
            height: 14px;
            border-radius: 3px;
        }
        .repartition-details {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            font-size: 13px;
            color: #475569;
        }

        /* --- Section Énergie Épuisée --- */
        .energy-depleted-section {
            margin-top: 20px;
            padding: 16px 20px;
            background: #fee2e2;
            border-radius: 10px;
            border-left: 4px solid #ef4444;
        }
        .depleted-title {
            font-weight: 600;
            color: #991b1b;
            font-size: 14px;
            margin-bottom: 5px;
        }
        .depleted-value {
            font-size: 24px;
            font-weight: 700;
            color: #b91c1c;
        }

        /* --- Responsive --- */
        @media (max-width: 1024px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        @media (max-width: 768px) {
            .stats-grid {
                grid-template-columns: 1fr;
            }
            .commercial-header {
                flex-direction: column;
                align-items: flex-start;
            }
            .header-badges {
                width: 100%;
                justify-content: flex-start;
            }
            .card-subheader {
                flex-direction: column;
            }
            .badge-actuel {
                position: static;
                display: inline-block;
                margin-left: 10px;
            }
        }
    `;
    document.head.appendChild(style);
}
// ======================== STYLES CSS À AJOUTER ========================
// Ajoutez cette fonction et appelez-la au chargement
function addFilterStyles() {
    if (document.querySelector('#filter-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'filter-styles';
    styles.textContent = `
        /* Style pour les groupes de filtres */
        .filter-group {
            background: #f8fafc;
            border-radius: 8px;
            padding: 12px 15px;
            border: 1px solid #e2e8f0;
            transition: all 0.2s;
        }
        
        .filter-group:hover {
            border-color: #cbd5e1;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .filter-group-title {
            font-weight: 600;
            color: #475569;
            margin-bottom: 8px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        /* Style pour les inputs */
        .filter-date-input, .filter-select {
            border: 2px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 10px;
            font-size: 12px;
            background: white;
            transition: all 0.2s;
        }
        
        .filter-date-input:focus, .filter-select:focus {
            border-color: #3b82f6;
            outline: none;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        /* Style pour les boutons rapides */
        .quick-select-btn {
            background: white;
            border: 1px solid #cbd5e1;
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 11px;
            cursor: pointer;
            color: #475569;
            transition: all 0.2s;
        }
        
        .quick-select-btn:hover {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
        }
        
        /* Style pour les labels de dates */
        .date-checkbox-label {
            transition: all 0.2s;
        }
        
        .date-checkbox-label:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .date-checkbox-label.checked {
            background: #dbeafe !important;
            border-color: #3b82f6 !important;
        }
        
        /* Responsive */
        @media (max-width: 1200px) {
            .filter-group {
                flex: 1 1 100% !important;
                min-width: 100% !important;
            }
        }
    `;

    document.head.appendChild(styles);
}
// Ajouter les styles au chargement
document.addEventListener('DOMContentLoaded', addSimplifiedCommercialStyles);
document.addEventListener('DOMContentLoaded', addCommercialStyles);
document.addEventListener('DOMContentLoaded', addAllClientsStyles);
document.addEventListener('DOMContentLoaded', addFilterStyles);
// Appeler la fonction au chargement
document.addEventListener('DOMContentLoaded', addNewColumnStyles);
// Effet de réduction de l'en-tête au scroll
window.addEventListener('scroll', function () {
    const header = document.querySelector('.header');
    const folderTitle = document.getElementById('folder-title');
    const analyzeButton = document.querySelector('.analyze-v2-button');

    if (!header || !folderTitle) return;

    if (window.scrollY > 50) {
        header.style.padding = '10px 20px';
        folderTitle.style.fontSize = '20px';
        if (analyzeButton) {
            analyzeButton.style.padding = '8px 20px';
            analyzeButton.style.fontSize = '16px';
        }
    } else {
        header.style.padding = '15px 20px';
        folderTitle.style.fontSize = '24px';
        if (analyzeButton) {
            analyzeButton.style.padding = '10px 25px';
            analyzeButton.style.fontSize = '18px';
        }
    }
});