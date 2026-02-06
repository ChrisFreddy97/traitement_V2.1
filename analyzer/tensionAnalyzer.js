

// analyzer/tensionAnalyzer.js
const TENSION_FORFAITS = {
  "12V": { min: 10.7, max: 15.6, marge: 1.0 },
  "24V": { min: 21.4, max: 31.5, marge: 2.0 },
  STANDARD: { min: 200, max: 240, marge: 10 },
  INDUSTRIEL: { min: 380, max: 420, marge: 15 }
};

// ======================== UTILITAIRES ========================
const getTensionForfait = (name, results = []) => {
  // Détection automatique du système 12V/24V basée sur les données
  const systemType = detectSystemType(results);
  if (systemType === '12V') return TENSION_FORFAITS['12V'];
  if (systemType === '24V') return TENSION_FORFAITS['24V'];

  return TENSION_FORFAITS[name?.toUpperCase()?.trim()] || TENSION_FORFAITS['12V'];
};

const detectSystemType = (results) => {
  if (!results || results.length === 0) return '12V';

  // Analyser les valeurs de tension pour déterminer le système
  const tensions = results.map(r => r.tension).filter(t => t > 0);
  if (tensions.length === 0) return '12V';

  const maxTension = Math.max(...tensions);
  const avgTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;

  console.log(`🔍 [TENSION] Détection système - Max: ${maxTension}V, Moyenne: ${avgTension.toFixed(2)}V`);

  // Si la tension dépasse 20V, c'est probablement un système 24V
  if (maxTension > 20 || avgTension > 18) {
    console.log('✅ [TENSION] Système 24V détecté');
    return '24V';
  }

  console.log('✅ [TENSION] Système 12V détecté');
  return '12V';
};

const normalizeDate = (dateStr) => dateStr.replace(/(\d{2})\/(\d{2})\/(\d{2})/, (match, day, month, year) => `${day}/${month}/20${year}`);

const parseHexValue = (hex1, hex2) => parseInt(hex1 + hex2, 16) || 0;

const formatTime = (heure, minute) => `${String(heure).padStart(2, '0')}h${String(minute).padStart(2, '0')}`;

// ======================== ANALYSE TENSION ========================
export function analyzeTension(input) {
  if (!input) return [];

  const tokens = input.trim().split(/\s+/);
  let rows = [];
  let i = 0;
  let currentDate = "";
  let heureRef = null;

  console.log('🔍 [TENSION] Début analyse -', tokens.length, 'tokens');

  while (i < tokens.length) {
    // --- Bloc C2 pour récupérer l'heure de départ ---
    if (tokens[i] === "C2") {
      const dateTokens = tokens.slice(i + 1, i + 4);
      currentDate = normalizeDate(`${dateTokens[0]}/${dateTokens[1]}/${dateTokens[2]}`);

      const heureDec = parseInt(tokens[i + 4]) || 0;
      const minuteDec = parseInt(tokens[i + 5]) || 0;
      heureRef = { h: heureDec, m: minuteDec };

      console.log(`📍 [TENSION] Trouvé C2 - Date: ${currentDate}, Heure: ${heureRef.h}h${heureRef.m}`);

      i += 6;
      continue;
    }

    // --- Bloc C3 ---
    if (tokens[i] === "C3") {
      let dateTokens = tokens.slice(i + 1, i + 4);
      let dateBloc = normalizeDate(`${dateTokens[0]}/${dateTokens[1]}/${dateTokens[2]}`);

      // Si la date change, réinitialiser l'heure à 00:00 si pas de C2 pour cette date
      if (dateBloc !== currentDate) {
        currentDate = dateBloc;
        let foundC2 = false;
        for (let k = i - 1; k >= 0; k--) {
          if (tokens[k] === "C2") {
            const c2DateTokens = tokens.slice(k + 1, k + 4);
            const c2Date = normalizeDate(`${c2DateTokens[0]}/${c2DateTokens[1]}/${c2DateTokens[2]}`);
            if (c2Date === currentDate) {
              heureRef = { h: parseInt(tokens[k + 4]) || 0, m: parseInt(tokens[k + 5]) || 0 };
              foundC2 = true;
              console.log(`🔄 [TENSION] Changement date - Nouvelle heure C2: ${heureRef.h}h${heureRef.m}`);
              break;
            }
          }
        }
        if (!foundC2) {
          heureRef = { h: 0, m: 0 };
          console.log(`🔄 [TENSION] Changement date - Heure réinitialisée: 00h00`);
        }
      }

      let valueHex = tokens[i + 4] + tokens[i + 5];
      let tension = parseFloat((parseInt(valueHex, 16) / 1000).toFixed(3)) || 0;

      const heureAffichee = formatTime(heureRef.h, heureRef.m);

      rows.push({
        date: currentDate,
        heure: heureAffichee,
        tension: tension,
        valeur: tension
      });

      console.log(`📝 [TENSION] Ajout ligne C3 - ${currentDate} ${heureAffichee}: ${tension} V`);

      // Incrémentation heure
      heureRef.h = (heureRef.h + 1) % 24;

      i += 6;

      // --- Blocs suivants (5 paires) ---
      while (i < tokens.length) {
        // Ignorer 13 C4 ou FF
        if (
          (tokens[i] === "13" && tokens[i + 1] === "C4") ||
          (tokens[i] === "FF" && tokens[i + 1] === "FF")
        ) {
          i += 8;
          console.log(`⏹️ [TENSION] Marqueur de fin trouvé`);
          break;
        }

        const dateBlocTokens = tokens.slice(i, i + 3);
        const dateBlocCurrent = normalizeDate(`${dateBlocTokens[0]}/${dateBlocTokens[1]}/${dateBlocTokens[2]}`);

        if (dateBlocCurrent !== currentDate) {
          currentDate = dateBlocCurrent;
          heureRef = { h: 0, m: 0 };
          console.log(`🔄 [TENSION] Nouvelle date dans bloc: ${currentDate}`);
        }

        valueHex = tokens[i + 3] + tokens[i + 4];
        tension = parseFloat((parseInt(valueHex, 16) / 1000).toFixed(3)) || 0;

        const heureAff = formatTime(heureRef.h, heureRef.m);

        rows.push({
          date: currentDate,
          heure: heureAff,
          tension: tension,
          valeur: tension
        });

        console.log(`📝 [TENSION] Ajout ligne bloc - ${currentDate} ${heureAff}: ${tension} V`);

        // incrément +1h
        heureRef.h = (heureRef.h + 1) % 24;
        i += 5;
      }

      continue;
    }

    i++;
  }

  // Filtrer lignes FF pures et trier par date/heure
  const filteredRows = rows.filter((row) => row.tension > 0);

  // TRI CHRONOLOGIQUE CORRIGÉ
  const sortedRows = filteredRows.sort((a, b) => {
    // Convertir les dates en format comparable (yyyy-mm-dd)
    const convertToComparableDate = (dateStr) => {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };

    const dateA = convertToComparableDate(a.date);
    const dateB = convertToComparableDate(b.date);

    const dateCompare = dateA.localeCompare(dateB);
    if (dateCompare !== 0) return dateCompare;

    // Si même date, trier par heure
    const heureA = parseInt(a.heure.split('h')[0]);
    const heureB = parseInt(b.heure.split('h')[0]);
    return heureA - heureB;
  });

  console.log(`✅ [TENSION] Analyse terminée: ${sortedRows.length} lignes générées`);

  // Afficher un échantillon pour vérification
  if (sortedRows.length > 0) {
    console.log('📋 [TENSION] Échantillon des premières lignes (triées):');
    sortedRows.slice(0, 10).forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.date} ${row.heure} - ${row.tension} V`);
    });
  }

  return sortedRows;
}

// ======================== CALCULS TENSION ========================
export const generateTensionDailySummary = (results) => {
  if (!results || !results.length) {
    console.warn('❌ [TENSION] Aucune donnée pour générer le résumé journalier');
    return [];
  }

  const dailyMap = results.reduce((acc, r) => {
    if (!acc[r.date]) {
      acc[r.date] = {
        date: r.date,
        valeurs: [],
        min: Infinity,
        max: -Infinity,
        moyenne: 0
      };
    }
    acc[r.date].valeurs.push(r.tension);
    if (r.tension < acc[r.date].min) {
      acc[r.date].min = r.tension;
    }
    if (r.tension > acc[r.date].max) {
      acc[r.date].max = r.tension;
    }
    return acc;
  }, {});

  const summary = Object.values(dailyMap).map(d => ({
    date: d.date,
    valeurMoyenne: parseFloat((d.valeurs.reduce((a, b) => a + b, 0) / d.valeurs.length).toFixed(3)),
    valeurMin: parseFloat(d.min.toFixed(3)),
    valeurMax: parseFloat(d.max.toFixed(3))
  }));

  // TRI du résumé journalier par date
  const sortedSummary = summary.sort((a, b) => {
    const convertToComparableDate = (dateStr) => {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
    return convertToComparableDate(a.date).localeCompare(convertToComparableDate(b.date));
  });

  console.log(`📊 [TENSION] Résumé journalier: ${sortedSummary.length} jours`);
  return sortedSummary;
};

export const calculateTensionHourly = (results) => {
  if (!results || !results.length) {
    console.warn('❌ [TENSION] Aucune donnée pour calculer les variations horaires');
    return [];
  }

  // Les résultats sont déjà triés chronologiquement par analyzeTension
  const hourly = results.map((current, index, array) => {
    let variation = 0;
    if (index > 0) {
      const previous = array[index - 1];
      // Même date et heure consécutive
      if (current.date === previous.date) {
        const heureCurrent = parseInt(current.heure.split('h')[0]);
        const heurePrevious = parseInt(previous.heure.split('h')[0]);
        if (heureCurrent === heurePrevious + 1) {
          variation = parseFloat((current.tension - previous.tension).toFixed(3));
        }
      }
    }

    return {
      date: current.date,
      heure: current.heure,
      tension: current.tension,
      variation: variation
    };
  });

  console.log(`⏰ [TENSION] Variations horaires: ${hourly.length} points`);
  return hourly;
};

// ======================== ALERTES TENSION ========================
export const detectTensionAnomalies = (results, daily, forfaitName) => {
  const forfait = getTensionForfait(forfaitName, results);
  const alerts = [];

  if (!daily.length) {
    console.warn('⚠️ [TENSION] Aucune donnée quotidienne pour détecter les anomalies');
    return alerts;
  }

  // Détection du système
  const systemType = detectSystemType(results);
  console.log(`🔧 [TENSION] Système détecté: ${systemType}V`);

  // Alertes de tension hors limites
  daily.forEach(d => {
    if (d.valeurMin < forfait.min) {
      alerts.push({
        type: 'danger',
        icon: '⚠️',
        title: 'Tension trop basse',
        message: `${d.valeurMin} V < ${forfait.min} V (minimum ${systemType}V)`,
        date: d.date
      });
    }

    if (d.valeurMax > forfait.max) {
      alerts.push({
        type: 'danger',
        icon: '⚠️',
        title: 'Tension trop élevée',
        message: `${d.valeurMax} V > ${forfait.max} V (maximum ${systemType}V)`,
        date: d.date
      });
    }

    // Alerte de variation importante dans la journée
    const variationJournee = d.valeurMax - d.valeurMin;
    if (variationJournee > (systemType === '24V' ? 8 : 4)) {
      alerts.push({
        type: 'warning',
        icon: '📊',
        title: 'Variation importante',
        message: `Écart de ${variationJournee.toFixed(2)} V dans la journée`,
        date: d.date
      });
    }
  });

  // Alerte moyenne hors norme
  const avg = daily.reduce((sum, d) => sum + d.valeurMoyenne, 0) / daily.length || 0;
  const tensionNormale = systemType === '24V' ? 28 : 14;
  const ecartPourcentage = Math.abs((avg - tensionNormale) / tensionNormale * 100);

  if (ecartPourcentage > 15) {
    alerts.push({
      type: 'info',
      icon: 'ℹ️',
      title: 'Moyenne éloignée de la normale',
      message: `Moyenne: ${parseFloat(avg.toFixed(3))} V (normale ${systemType}V: ~${tensionNormale} V)`
    });
  }

  console.log(`🚨 [TENSION] Alertes détectées: ${alerts.length}`);
  return alerts;
};

// ======================== DÉTERMINATION STATUT ========================
function determineTensionStatut(valeurMin, valeurMax, valeurMoyenne, forfaitName, results) {
  const forfait = getTensionForfait(forfaitName, results);
  const systemType = detectSystemType(results);

  if (valeurMin === 0 && valeurMax === 0) {
    return {
      statut: 'Pas de tension',
      icone: '🔵',
      couleur: '#4299e1',
      description: 'Aucune tension détectée'
    };
  }

  // Seuils pour 12V/24V
  const tensionBasseSeuil = systemType === '24V' ? 21.4 : 10.7;
  const tensionHauteSeuil = systemType === '24V' ? 31.5 : 15.6;

  if (valeurMin < tensionBasseSeuil || valeurMax > tensionHauteSeuil) {
    return {
      statut: 'Hors limites',
      icone: '🔴',
      couleur: '#e53e3e',
      description: `Tension hors des limites (${tensionBasseSeuil}-${tensionHauteSeuil} V)`
    };
  }

  // Vérifier la stabilité
  const variation = valeurMax - valeurMin;
  const seuilVariation = systemType === '24V' ? 5 : 2.5;

  if (variation > seuilVariation) {
    return {
      statut: 'Instable',
      icone: '🟡',
      couleur: '#d69e2e',
      description: `Variation importante: ${variation.toFixed(2)} V`
    };
  }

  return {
    statut: 'Stable',
    icone: '✅',
    couleur: '#38a169',
    description: `Tension stable (${systemType}V système)`
  };
}

// ======================== TABLEAU DE BORD GLOBAL TENSION ========================
export const generateTensionGlobalStats = (results, daily) => {
  if (!results || !results.length) {
    return {
      totalMesures: 0,
      totalJours: 0,
      tensionMoyenne: 0,
      tensionMin: 0,
      tensionMax: 0,
      stabilite: 0,
      joursStables: 0,
      joursInstables: 0,
      joursHorsLimites: 0,
      systemType: '12V'
    };
  }

  const systemType = detectSystemType(results);
  const tensionMoyenne = parseFloat((daily.reduce((sum, d) => sum + d.valeurMoyenne, 0) / daily.length).toFixed(3));
  const tensionMin = parseFloat(Math.min(...daily.map(d => d.valeurMin)).toFixed(3));
  const tensionMax = parseFloat(Math.max(...daily.map(d => d.valeurMax)).toFixed(3));

  // Calcul de la stabilité
  const statuts = daily.map(d => determineTensionStatut(d.valeurMin, d.valeurMax, d.valeurMoyenne, 'STANDARD', results));
  const joursStables = statuts.filter(s => s.statut === 'Stable').length;
  const joursInstables = statuts.filter(s => s.statut === 'Instable').length;
  const joursHorsLimites = statuts.filter(s => s.statut === 'Hors limites').length;
  const joursPasTension = statuts.filter(s => s.statut === 'Pas de tension').length;

  const stabilite = Math.round(joursStables / daily.length * 100);

  return {
    totalMesures: results.length,
    totalJours: daily.length,
    tensionMoyenne,
    tensionMin,
    tensionMax,
    stabilite,
    joursStables,
    joursInstables,
    joursHorsLimites,
    joursPasTension,
    systemType
  };
};
function createTensionHourlyChartHTML(results, forfaitName, chartId, title = "Évolution Horaires de la Tension") {
  if (!results || !results.length) {
    return '<div class="no-chart-data">📊 Aucune donnée disponible pour le graphique horaire</div>';
  }

  const systemType = detectSystemType(results);
  const forfait = getTensionForfait(forfaitName, results);

  // Définir les limites selon le système
  const limites = systemType === '24V'
    ? { min: 21.4, max: 31.5, idealMin: 24, idealMax: 29 }
    : { min: 10.7, max: 15.6, idealMin: 12, idealMax: 14.5 };

  // Préparer les données horaires
  // Regrouper par date pour faciliter la navigation
  const dataByDate = {};
  results.forEach(result => {
    if (!dataByDate[result.date]) {
      dataByDate[result.date] = [];
    }
    dataByDate[result.date].push({
      heure: result.heure,
      tension: result.tension,
      datetime: new Date(`${result.date.split('/').reverse().join('-')}T${result.heure.replace('h', ':')}:00`)
    });
  });

  // Trier les dates
  const dates = Object.keys(dataByDate).sort((a, b) => {
    const dateA = new Date(a.split('/').reverse().join('-'));
    const dateB = new Date(b.split('/').reverse().join('-'));
    return dateA - dateB;
  });

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  const startDateValue = firstDate.split('/').reverse().join('-');
  const endDateValue = lastDate.split('/').reverse().join('-');

  return `
        <div class="tension-chart-container" data-chart-id="${chartId}">
            <div class="chart-header">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <h6 style="margin: 0;">${title} - Système ${systemType}</h6>
                    <div class="chart-filters" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <!-- Filtres par dates précises -->
                        <div class="date-filters" style="display: flex; gap: 10px; align-items: center;">
                            <div class="filter-group">
                                <label style="font-size: 12px; font-weight: 600; color: #4a5568;">Date:</label>
                                <select id="${chartId}-date-select" class="date-select" style="padding: 4px 8px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 12px;">
                                    ${dates.map(date => `
                                        <option value="${date}">${date}</option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="filter-group">
                                <label style="font-size: 12px; font-weight: 600; color: #4a5568;">Du:</label>
                                <input type="time" id="${chartId}-start-time" class="time-filter" 
                                       value="00:00" 
                                       style="padding: 4px 8px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 12px;">
                            </div>
                            <div class="filter-group">
                                <label style="font-size: 12px; font-weight: 600; color: #4a5568;">Au:</label>
                                <input type="time" id="${chartId}-end-time" class="time-filter" 
                                       value="23:00" 
                                       style="padding: 4px 8px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 12px;">
                            </div>
                            <button id="${chartId}-apply" class="btn-filter" style="padding: 6px 12px; background: #3182ce; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                Appliquer
                            </button>
                            <button id="${chartId}-reset" class="btn-reset" style="padding: 6px 12px; background: #718096; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
                <div class="chart-legend" style="margin-top: 10px; display: flex; gap: 15px; flex-wrap: wrap;">
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #38a169"></span>
                        Tension Horaires
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #ff0000"></span>
                        Point d'alerte
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #ff0000; border: 1px dashed #000;"></span>
                        Limite Max ${systemType}
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #ff6b6b; border: 1px dashed #000;"></span>
                        Limite Min ${systemType}
                    </div>
                </div>
            </div>
            
            <div class="chart-wrapper" style="position: relative; height: 400px;">
                <canvas id="${chartId}"></canvas>
            </div>
            
            <div class="chart-info hourly-chart-info">
              <div class="chart-info-horizontal">
                  <div class="chart-info-group">
                      <strong>📊 Période :</strong>
                      <span class="period-display" id="${chartId}-period-info">${firstDate} - 00h00 à 23h00</span>
                  </div>
                  
                  <span class="info-separator">•</span>
                  
                  <div class="chart-info-group">
                      <strong>Points :</strong>
                      <span class="data-count" id="${chartId}-data-count">${results.length}</span>
                  </div>
                  
                  <span class="info-separator">•</span>
                  
                  <div class="chart-info-group">
                      <strong>Limites ${systemType} :</strong>
                      <div class="limits-display">
                          <span class="limit-item limit-min">${limites.min}V min</span>
                          <span class="limit-item limit-ideal">${limites.idealMin}-${limites.idealMax}V idéal</span>
                          <span class="limit-item limit-max">${limites.max}V max</span>
                      </div>
                  </div>
                  
                  <span class="info-separator">•</span>
                  
                  <div class="alert-indicator">
                      <span class="alert-dot"></span>
                      Points rouges = dépassement
                  </div>
              </div>
          </div>
            
            <script>
                (function() {
                    try {
                        const ctx = document.getElementById('${chartId}');
                        if (!ctx) {
                            console.error('Canvas non trouvé:', '${chartId}');
                            return;
                        }
                        
                        // Données complètes
                        const allDataByDate = ${JSON.stringify(dataByDate)};
                        const allDates = ${JSON.stringify(dates)};
                        
                        // Limites du système
                        const limites = ${JSON.stringify(limites)};
                        const systemType = '${systemType}';
                        
                        // Données filtrées
                        let currentDate = allDates[0];
                        let filteredHours = [];
                        let filteredTensions = [];
                        
                        let chart = null;
                        
                        // Fonction pour déterminer la couleur d'un point selon les limites
                        function getPointColor(value) {
                            if (value > limites.max || value < limites.min) {
                                return '#ff0000'; // ROUGE pour dépassement
                            } else if (value > limites.idealMax || value < limites.idealMin) {
                                return '#ffa500'; // ORANGE pour hors plage idéale
                            } else {
                                return '#38a169'; // VERT pour normal
                            }
                        }
                        
                        // Fonction pour déterminer le rayon du point selon l'état
                        function getPointRadius(value) {
                            if (value > limites.max || value < limites.min) {
                                return 6; // Plus gros pour dépassement
                            } else if (value > limites.idealMax || value < limites.idealMin) {
                                return 5; // Moyen pour hors plage idéale
                            } else {
                                return 4; // Normal
                            }
                        }
                        
                        // Fonction pour mettre à jour les données affichées
                        function updateChartData() {
                            const dateSelect = document.getElementById('${chartId}-date-select');
                            const startTime = document.getElementById('${chartId}-start-time').value;
                            const endTime = document.getElementById('${chartId}-end-time').value;
                            
                            currentDate = dateSelect ? dateSelect.value : allDates[0];
                            const dayData = allDataByDate[currentDate] || [];
                            
                            // Convertir les heures en minutes pour la comparaison
                            const startMinutes = timeToMinutes(startTime);
                            const endMinutes = timeToMinutes(endTime);
                            
                            filteredHours = [];
                            filteredTensions = [];
                            
                            dayData.forEach(item => {
                                const itemMinutes = timeToMinutes(item.heure.replace('h', ':'));
                                if (itemMinutes >= startMinutes && itemMinutes <= endMinutes) {
                                    filteredHours.push(item.heure);
                                    filteredTensions.push(item.tension);
                                }
                            });
                            
                            updateChart();
                            updatePeriodInfo();
                        }
                        
                        // Fonction utilitaire pour convertir l'heure en minutes
                        function timeToMinutes(timeStr) {
                            const [hours, minutes] = timeStr.split(':').map(Number);
                            return hours * 60 + (minutes || 0);
                        }
                        
                        // Fonction pour mettre à jour les informations de période
                        function updatePeriodInfo() {
                            const periodInfo = document.getElementById('${chartId}-period-info');
                            const dataCount = document.getElementById('${chartId}-data-count');
                            
                            if (periodInfo && dataCount) {
                                const startTime = document.getElementById('${chartId}-start-time').value;
                                const endTime = document.getElementById('${chartId}-end-time').value;
                                periodInfo.textContent = \`\${currentDate} - \${startTime} à \${endTime}\`;
                                dataCount.textContent = \`\${filteredTensions.length} points\`;
                            }
                        }
                        
                        // Mettre à jour le graphique
                        function updateChart() {
                            if (chart) {
                                chart.data.labels = filteredHours;
                                chart.data.datasets[0].data = filteredHours.map(() => limites.max);
                                chart.data.datasets[1].data = filteredHours.map(() => limites.min);
                                chart.data.datasets[2].data = filteredHours.map(() => limites.idealMin);
                                chart.data.datasets[3].data = filteredHours.map(() => limites.idealMax);
                                chart.data.datasets[4].data = filteredTensions;
                                
                                // Mettre à jour les couleurs des points
                                chart.data.datasets[4].pointBackgroundColor = filteredTensions.map(value => 
                                    getPointColor(value)
                                );
                                chart.data.datasets[4].pointRadius = filteredTensions.map(value => 
                                    getPointRadius(value)
                                );
                                
                                chart.update();
                            }
                        }
                        
                        function initializeChart() {
                            // Configuration des datasets avec limites
                            const datasets = [
                                // Lignes de limites
                                {
                                    label: 'Limite Max ' + systemType,
                                    data: filteredHours.map(() => limites.max),
                                    borderColor: '#ff0000',
                                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                    borderWidth: 2,
                                    borderDash: [5, 5],
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0,
                                    order: 1
                                },
                                {
                                    label: 'Limite Min ' + systemType,
                                    data: filteredHours.map(() => limites.min),
                                    borderColor: '#ff6b6b',
                                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                                    borderWidth: 2,
                                    borderDash: [5, 5],
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0,
                                    order: 2
                                },
                                {
                                    label: 'Plage Idéale Min',
                                    data: filteredHours.map(() => limites.idealMin),
                                    borderColor: '#90ee90',
                                    backgroundColor: 'rgba(144, 238, 144, 0.1)',
                                    borderWidth: 1,
                                    borderDash: [3, 3],
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0,
                                    order: 3
                                },
                                {
                                    label: 'Plage Idéale Max',
                                    data: filteredHours.map(() => limites.idealMax),
                                    borderColor: '#90ee90',
                                    backgroundColor: 'rgba(144, 238, 144, 0.1)',
                                    borderWidth: 1,
                                    borderDash: [3, 3],
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0,
                                    order: 4
                                },
                                // Données principales
                                {
                                    label: 'Tension',
                                    data: filteredTensions,
                                    borderColor: '#38a169',
                                    backgroundColor: 'rgba(56, 161, 105, 0.1)',
                                    borderWidth: 3,
                                    tension: 0.4,
                                    fill: false,
                                    pointBackgroundColor: filteredTensions.map(value => 
                                        getPointColor(value)
                                    ),
                                    pointBorderColor: '#ffffff',
                                    pointBorderWidth: 1,
                                    pointRadius: filteredTensions.map(value => 
                                        getPointRadius(value)
                                    ),
                                    pointHoverRadius: filteredTensions.map(value => 
                                        getPointRadius(value) + 2
                                    ),
                                    order: 5
                                }
                            ];
                            
                            chart = new Chart(ctx, {
                                type: 'line',
                                data: {
                                    labels: filteredHours,
                                    datasets: datasets
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: '${title} - Système ' + systemType
                                        },
                                        tooltip: {
                                            mode: 'index',
                                            intersect: false,
                                            filter: function(tooltipItem) {
                                                const datasetLabel = tooltipItem.dataset.label || '';
                                                return !datasetLabel.includes('Limite') && !datasetLabel.includes('Plage Idéale');
                                            },
                                            callbacks: {
                                                label: function(context) {
                                                    let label = context.dataset.label + ': ' + context.parsed.y + ' V';
                                                    const value = context.parsed.y;
                                                    
                                                    if (value > limites.max) {
                                                        label += ' 🚫 DÉPASSEMENT MAX';
                                                    } else if (value < limites.min) {
                                                        label += ' 🚫 DÉPASSEMENT MIN';
                                                    } else if (value > limites.idealMax || value < limites.idealMin) {
                                                        label += ' ⚠️ Hors plage idéale';
                                                    }
                                                    
                                                    return label;
                                                }
                                            }
                                        },
                                        legend: {
                                            position: 'top',
                                            labels: {
                                                filter: function(legendItem, chartData) {
                                                    const label = legendItem.text || '';
                                                    return !label.includes('Plage Idéale Min') && !label.includes('Plage Idéale Max');
                                                }
                                            }
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: false,
                                            title: {
                                                display: true,
                                                text: 'Tension (V)'
                                            },
                                            grid: {
                                                color: 'rgba(0, 0, 0, 0.1)'
                                            },
                                            ticks: {
                                                callback: function(value, index, values) {
                                                    if (value === limites.max) {
                                                        return '🚫 ' + value + 'V (Max)';
                                                    }
                                                    if (value === limites.min) {
                                                        return '⚠️ ' + value + 'V (Min)';
                                                    }
                                                    if (value === limites.idealMin || value === limites.idealMax) {
                                                        return '✅ ' + value + 'V';
                                                    }
                                                    return value + 'V';
                                                }
                                            }
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                text: 'Heures'
                                            },
                                            grid: {
                                                color: 'rgba(0, 0, 0, 0.1)'
                                            }
                                        }
                                    },
                                    interaction: {
                                        intersect: false,
                                        mode: 'nearest'
                                    },
                                    animation: {
                                        duration: 500,
                                        easing: 'easeInOutQuart'
                                    }
                                }
                            });
                        }
                        
                        // Initialiser les événements
                        function initializeEventListeners() {
                            const applyBtn = document.getElementById('${chartId}-apply');
                            const resetBtn = document.getElementById('${chartId}-reset');
                            const dateSelect = document.getElementById('${chartId}-date-select');
                            const startTime = document.getElementById('${chartId}-start-time');
                            const endTime = document.getElementById('${chartId}-end-time');
                            
                            if (applyBtn) {
                                applyBtn.addEventListener('click', updateChartData);
                            }
                            
                            if (resetBtn) {
                                resetBtn.addEventListener('click', function() {
                                    if (dateSelect) dateSelect.value = allDates[0];
                                    if (startTime) startTime.value = '00:00';
                                    if (endTime) endTime.value = '23:00';
                                    updateChartData();
                                });
                            }
                            
                            if (dateSelect) {
                                dateSelect.addEventListener('change', updateChartData);
                            }
                            
                            if (startTime && endTime) {
                                startTime.addEventListener('change', updateChartData);
                                endTime.addEventListener('change', updateChartData);
                            }
                        }
                        
                        // Initialiser le graphique
                        updateChartData(); // Charge les données initiales
                        initializeChart();
                        initializeEventListeners();
                        
                        console.log('✅ Graphique horaire ${chartId} créé avec succès');
                        
                    } catch (error) {
                        console.error('❌ Erreur création graphique horaire ${chartId}:', error);
                    }
                })();
            </script>
        </div>
    `;
}

// ======================== FONCTION GRAPHIQUE TENSION - AVEC POINTS COLORÉS POUR DÉPASSEMENTS ========================
export function createTensionChart(daily, forfaitName, results) {
  if (!daily || !daily.length) {
    return '<div class="no-chart-data">📊 Aucune donnée disponible pour le graphique</div>';
  }

  const systemType = detectSystemType(results);
  const forfait = getTensionForfait(forfaitName, results);

  // Définir les limites selon le système
  const limites = systemType === '24V'
    ? { min: 21.4, max: 31.5, idealMin: 24, idealMax: 29 }
    : { min: 10.7, max: 15.6, idealMin: 12, idealMax: 14.5 };

  // Préparer les données
  const dates = daily.map(d => d.date);
  const minTensions = daily.map(d => d.valeurMin);
  const maxTensions = daily.map(d => d.valeurMax);
  const avgTensions = daily.map(d => d.valeurMoyenne);

  const canvasId = `tension-chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Trouver les dates min et max pour les filtres
  const allDates = [...new Set(daily.map(d => d.date))].sort((a, b) => {
    const convertToComparableDate = (dateStr) => {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
    return convertToComparableDate(a).localeCompare(convertToComparableDate(b));
  });

  const firstDate = allDates[0];
  const lastDate = allDates[allDates.length - 1];

  const startDateValue = firstDate.split('/').reverse().join('-');
  const endDateValue = lastDate.split('/').reverse().join('-');

  return `
        <div class="tension-chart-container">
            <div class="chart-header">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                    <h6 style="margin: 0;">📈 Évolution de la Tension - Système ${systemType}</h6>
                    <div class="chart-filters" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <!-- Filtres rapides -->
                        <div class="quick-filters" style="display: flex; gap: 8px; margin-right: 15px;">
                            <button class="btn-quick-filter" data-days="7" style="padding: 6px 12px; background: #edf2f7; color: #4a5568; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                7 derniers jours
                            </button>
                            <button class="btn-quick-filter" data-days="15" style="padding: 6px 12px; background: #edf2f7; color: #4a5568; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                15 derniers jours
                            </button>
                            <button class="btn-quick-filter" data-days="30" style="padding: 6px 12px; background: #edf2f7; color: #4a5568; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                30 derniers jours
                            </button>
                            <button class="btn-quick-filter" data-days="0" style="padding: 6px 12px; background: #3182ce; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                Toute la période
                            </button>
                        </div>
                        
                        <!-- Filtres par dates précises -->
                        <div class="date-filters" style="display: flex; gap: 10px; align-items: center;">
                            <div class="filter-group">
                                <label style="font-size: 12px; font-weight: 600; color: #4a5568;">Du:</label>
                                <input type="date" id="${canvasId}-start" class="date-filter" 
                                       value="${startDateValue}" 
                                       min="${startDateValue}" 
                                       max="${endDateValue}"
                                       style="padding: 4px 8px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 12px;">
                            </div>
                            <div class="filter-group">
                                <label style="font-size: 12px; font-weight: 600; color: #4a5568;">Au:</label>
                                <input type="date" id="${canvasId}-end" class="date-filter" 
                                       value="${endDateValue}" 
                                       min="${startDateValue}" 
                                       max="${endDateValue}"
                                       style="padding: 4px 8px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 12px;">
                            </div>
                            <button id="${canvasId}-apply" class="btn-filter" style="padding: 6px 12px; background: #3182ce; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                Appliquer
                            </button>
                            <button id="${canvasId}-reset" class="btn-reset" style="padding: 6px 12px; background: #718096; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
                <div class="chart-legend" style="margin-top: 10px; display: flex; gap: 15px; flex-wrap: wrap;">
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #e53e3e"></span>
                        Tension Min
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #3182ce"></span>
                        Tension Max
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #38a169"></span>
                        Tension Moyenne
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #ff0000"></span>
                        Point d'alerte
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #ff0000; border: 1px dashed #000;"></span>
                        Limite Max ${systemType}
                    </div>
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: #ff6b6b; border: 1px dashed #000;"></span>
                        Limite Min ${systemType}
                    </div>
                </div>
            </div>
            
            <div class="chart-wrapper" style="position: relative; height: 400px;">
                <canvas id="${canvasId}"></canvas>
            </div>
            
            <div class="chart-info">
              <div class="chart-info-horizontal">
                  <div class="chart-info-group">
                      <strong>📊 Période :</strong>
                      <span class="period-display" id="${canvasId}-period-info">${firstDate} - ${lastDate}</span>
                  </div>
                  
                  <span class="info-separator">•</span>
                  
                  <div class="chart-info-group">
                      <strong>Jours :</strong>
                      <span class="data-count" id="${canvasId}-data-count">${daily.length}</span>
                  </div>
                  
                  <span class="info-separator">•</span>
                  
                  <div class="chart-info-group">
                      <strong>Limites ${systemType} :</strong>
                      <div class="limits-display">
                          <span class="limit-item limit-min">${limites.min}V min</span>
                          <span class="limit-item limit-ideal">${limites.idealMin}-${limites.idealMax}V idéal</span>
                          <span class="limit-item limit-max">${limites.max}V max</span>
                      </div>
                  </div>
                  
                  <span class="info-separator">•</span>
                  
                  <div class="alert-indicator">
                      <span class="alert-dot"></span>
                      Points rouges = dépassement
                  </div>
              </div>
          </div>
            
            <script>
                (function() {
                    try {
                        const ctx = document.getElementById('${canvasId}');
                        if (!ctx) {
                            console.error('Canvas non trouvé:', '${canvasId}');
                            return;
                        }
                        
                        // Données complètes
                        const allDates = ${JSON.stringify(dates)};
                        const allMinTensions = ${JSON.stringify(minTensions)};
                        const allMaxTensions = ${JSON.stringify(maxTensions)};
                        const allAvgTensions = ${JSON.stringify(avgTensions)};
                        
                        // Limites du système
                        const limites = ${JSON.stringify(limites)};
                        const systemType = '${systemType}';
                        
                        // Convertir les dates en objets Date pour les calculs
                        const allDateObjects = allDates.map(date => {
                            const [day, month, year] = date.split('/');
                            return new Date(\`\${year}-\${month.padStart(2, '0')}-\${day.padStart(2, '0')}\`);
                        });
                        
                        // Données filtrées (initialement toutes)
                        let filteredDates = [...allDates];
                        let filteredMinTensions = [...allMinTensions];
                        let filteredMaxTensions = [...allMaxTensions];
                        let filteredAvgTensions = [...allAvgTensions];
                        
                        let chart = null;
                        
                        // Fonction pour déterminer la couleur d'un point selon les limites
                        function getPointColor(value, datasetType) {
                            if (value > limites.max || value < limites.min) {
                                // DÉPASSEMENT CRITIQUE - ROUGE
                                return '#ff0000';
                            } else if (value > limites.idealMax || value < limites.idealMin) {
                                // HORS PLAGE IDÉALE - ORANGE
                                return '#ffa500';
                            } else {
                                // DANS LA PLAGE IDÉALE - Couleur normale selon le dataset
                                switch(datasetType) {
                                    case 'min': return '#e53e3e';
                                    case 'max': return '#3182ce';
                                    case 'avg': return '#38a169';
                                    default: return '#3182ce';
                                }
                            }
                        }
                        
                        // Fonction pour déterminer le rayon du point selon l'état
                        function getPointRadius(value, datasetType) {
                            if (value > limites.max || value < limites.min) {
                                // Dépasse les limites - point plus gros
                                return 6;
                            } else if (value > limites.idealMax || value < limites.idealMin) {
                                // Hors plage idéale - point moyen
                                return 5;
                            } else {
                                // Normal - point standard
                                return datasetType === 'avg' ? 4 : 3;
                            }
                        }
                        
                        // Fonction pour mettre à jour les informations de période
                        function updatePeriodInfo() {
                            const periodInfo = document.getElementById('${canvasId}-period-info');
                            const dataCount = document.getElementById('${canvasId}-data-count');
                            
                            if (periodInfo && dataCount) {
                                if (filteredDates.length > 0) {
                                    periodInfo.textContent = \`\${filteredDates[0]} - \${filteredDates[filteredDates.length - 1]}\`;
                                    dataCount.textContent = \`\${filteredDates.length} jour(s)\`;
                                } else {
                                    periodInfo.textContent = 'Aucune donnée';
                                    dataCount.textContent = '0 jour';
                                }
                            }
                        }
                        
                        // Validation des dates
                        function validateDates(startDate, endDate) {
                            const start = new Date(startDate);
                            const end = new Date(endDate);
                            
                            if (start > end) {
                                alert('Erreur : La date de début doit être antérieure à la date de fin');
                                return false;
                            }
                            return true;
                        }
                        
                        // Fonction pour appliquer un filtre par nombre de jours
                        function filterByLastDays(days) {
                            if (days === 0) {
                                // Toute la période
                                filteredDates = [...allDates];
                                filteredMinTensions = [...allMinTensions];
                                filteredMaxTensions = [...allMaxTensions];
                                filteredAvgTensions = [...allAvgTensions];
                            } else {
                                // Calculer la date de début (aujourd'hui - X jours)
                                const endDate = new Date(Math.max(...allDateObjects));
                                const startDate = new Date(endDate);
                                startDate.setDate(startDate.getDate() - (days - 1));
                                
                                filteredDates = [];
                                filteredMinTensions = [];
                                filteredMaxTensions = [];
                                filteredAvgTensions = [];
                                
                                allDateObjects.forEach((date, index) => {
                                    if (date >= startDate && date <= endDate) {
                                        filteredDates.push(allDates[index]);
                                        filteredMinTensions.push(allMinTensions[index]);
                                        filteredMaxTensions.push(allMaxTensions[index]);
                                        filteredAvgTensions.push(allAvgTensions[index]);
                                    }
                                });
                            }
                            
                            // Mettre à jour les champs de date
                            if (filteredDates.length > 0) {
                                const startDateStr = filteredDates[0].split('/').reverse().join('-');
                                const endDateStr = filteredDates[filteredDates.length - 1].split('/').reverse().join('-');
                                
                                document.getElementById('${canvasId}-start').value = startDateStr;
                                document.getElementById('${canvasId}-end').value = endDateStr;
                            }
                            
                            // Mettre à jour le graphique
                            updateChart();
                            updatePeriodInfo();
                        }
                        
                        // Fonction de filtrage par dates précises
                        function filterDataByDate(startDate, endDate) {
                            // Validation des dates
                            if (!validateDates(startDate, endDate)) {
                                return;
                            }
                            
                            const start = new Date(startDate);
                            const end = new Date(endDate);
                            
                            filteredDates = [];
                            filteredMinTensions = [];
                            filteredMaxTensions = [];
                            filteredAvgTensions = [];
                            
                            allDateObjects.forEach((date, index) => {
                                if (date >= start && date <= end) {
                                    filteredDates.push(allDates[index]);
                                    filteredMinTensions.push(allMinTensions[index]);
                                    filteredMaxTensions.push(allMaxTensions[index]);
                                    filteredAvgTensions.push(allAvgTensions[index]);
                                }
                            });
                            
                            updateChart();
                            updatePeriodInfo();
                        }
                        
                        // Mettre à jour le graphique
                        function updateChart() {
                            if (chart) {
                                chart.data.labels = filteredDates;
                                chart.data.datasets[0].data = filteredDates.map(() => limites.max);
                                chart.data.datasets[1].data = filteredDates.map(() => limites.min);
                                chart.data.datasets[2].data = filteredDates.map(() => limites.idealMin);
                                chart.data.datasets[3].data = filteredDates.map(() => limites.idealMax);
                                
                                // Mettre à jour les données avec les couleurs dynamiques
                                chart.data.datasets[4].data = filteredMinTensions;
                                chart.data.datasets[5].data = filteredMaxTensions;
                                chart.data.datasets[6].data = filteredAvgTensions;
                                
                                // Mettre à jour les couleurs des points pour Min
                                chart.data.datasets[4].pointBackgroundColor = filteredMinTensions.map((value, index) => 
                                    getPointColor(value, 'min')
                                );
                                chart.data.datasets[4].pointRadius = filteredMinTensions.map((value, index) => 
                                    getPointRadius(value, 'min')
                                );
                                
                                // Mettre à jour les couleurs des points pour Max
                                chart.data.datasets[5].pointBackgroundColor = filteredMaxTensions.map((value, index) => 
                                    getPointColor(value, 'max')
                                );
                                chart.data.datasets[5].pointRadius = filteredMaxTensions.map((value, index) => 
                                    getPointRadius(value, 'max')
                                );
                                
                                // Mettre à jour les couleurs des points pour Moyenne
                                chart.data.datasets[6].pointBackgroundColor = filteredAvgTensions.map((value, index) => 
                                    getPointColor(value, 'avg')
                                );
                                chart.data.datasets[6].pointRadius = filteredAvgTensions.map((value, index) => 
                                    getPointRadius(value, 'avg')
                                );
                                
                                chart.update();
                            }
                        }
                        
                        function initializeChart() {
                            // Configuration des datasets avec limites
                            const datasets = [
                                // Lignes de limites (en premier pour être en arrière-plan)
                                {
                                    label: 'Limite Max ' + systemType,
                                    data: filteredDates.map(() => limites.max),
                                    borderColor: '#ff0000',
                                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                    borderWidth: 2,
                                    borderDash: [5, 5],
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0,
                                    order: 1
                                },
                                {
                                    label: 'Limite Min ' + systemType,
                                    data: filteredDates.map(() => limites.min),
                                    borderColor: '#ff6b6b',
                                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                                    borderWidth: 2,
                                    borderDash: [5, 5],
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0,
                                    order: 2
                                },
                                {
                                    label: 'Plage Idéale Min',
                                    data: filteredDates.map(() => limites.idealMin),
                                    borderColor: '#90ee90',
                                    backgroundColor: 'rgba(144, 238, 144, 0.1)',
                                    borderWidth: 1,
                                    borderDash: [3, 3],
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0,
                                    order: 3
                                },
                                {
                                    label: 'Plage Idéale Max',
                                    data: filteredDates.map(() => limites.idealMax),
                                    borderColor: '#90ee90',
                                    backgroundColor: 'rgba(144, 238, 144, 0.1)',
                                    borderWidth: 1,
                                    borderDash: [3, 3],
                                    fill: false,
                                    pointRadius: 0,
                                    tension: 0,
                                    order: 4
                                },
                                // Données principales avec points colorés dynamiquement
                                {
                                    label: 'Tension Min',
                                    data: filteredMinTensions,
                                    borderColor: '#e53e3e',
                                    backgroundColor: 'rgba(229, 62, 62, 0.1)',
                                    borderWidth: 2,
                                    tension: 0.4,
                                    fill: false,
                                    pointBackgroundColor: filteredMinTensions.map((value, index) => 
                                        getPointColor(value, 'min')
                                    ),
                                    pointBorderColor: '#ffffff',
                                    pointBorderWidth: 1,
                                    pointRadius: filteredMinTensions.map((value, index) => 
                                        getPointRadius(value, 'min')
                                    ),
                                    pointHoverRadius: filteredMinTensions.map((value, index) => 
                                        getPointRadius(value, 'min') + 2
                                    ),
                                    order: 5
                                },
                                {
                                    label: 'Tension Max',
                                    data: filteredMaxTensions,
                                    borderColor: '#3182ce',
                                    backgroundColor: 'rgba(49, 130, 206, 0.1)',
                                    borderWidth: 2,
                                    tension: 0.4,
                                    fill: false,
                                    pointBackgroundColor: filteredMaxTensions.map((value, index) => 
                                        getPointColor(value, 'max')
                                    ),
                                    pointBorderColor: '#ffffff',
                                    pointBorderWidth: 1,
                                    pointRadius: filteredMaxTensions.map((value, index) => 
                                        getPointRadius(value, 'max')
                                    ),
                                    pointHoverRadius: filteredMaxTensions.map((value, index) => 
                                        getPointRadius(value, 'max') + 2
                                    ),
                                    order: 6
                                },
                                {
                                    label: 'Tension Moyenne',
                                    data: filteredAvgTensions,
                                    borderColor: '#38a169',
                                    backgroundColor: 'rgba(56, 161, 105, 0.1)',
                                    borderWidth: 3,
                                    tension: 0.4,
                                    fill: false,
                                    pointBackgroundColor: filteredAvgTensions.map((value, index) => 
                                        getPointColor(value, 'avg')
                                    ),
                                    pointBorderColor: '#ffffff',
                                    pointBorderWidth: 1,
                                    pointRadius: filteredAvgTensions.map((value, index) => 
                                        getPointRadius(value, 'avg')
                                    ),
                                    pointHoverRadius: filteredAvgTensions.map((value, index) => 
                                        getPointRadius(value, 'avg') + 2
                                    ),
                                    order: 7
                                }
                            ];
                            
                            chart = new Chart(ctx, {
                                type: 'line',
                                data: {
                                    labels: filteredDates,
                                    datasets: datasets
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        title: {
                                            display: true,
                                            text: 'Évolution de la Tension Journalière - Système ' + systemType
                                        },
                                        tooltip: {
                                            mode: 'index',
                                            intersect: false,
                                            filter: function(tooltipItem) {
                                                const datasetLabel = tooltipItem.dataset.label || '';
                                                return !datasetLabel.includes('Limite') && !datasetLabel.includes('Plage Idéale');
                                            },
                                            callbacks: {
                                                label: function(context) {
                                                    let label = context.dataset.label + ': ' + context.parsed.y + ' V';
                                                    const value = context.parsed.y;
                                                    
                                                    // Ajouter un indicateur d'alerte dans le tooltip
                                                    if (value > limites.max) {
                                                        label += ' 🚫 DÉPASSEMENT MAX';
                                                    } else if (value < limites.min) {
                                                        label += ' 🚫 DÉPASSEMENT MIN';
                                                    } else if (value > limites.idealMax || value < limites.idealMin) {
                                                        label += ' ⚠️ Hors plage idéale';
                                                    }
                                                    
                                                    return label;
                                                }
                                            }
                                        },
                                        legend: {
                                            position: 'top',
                                            labels: {
                                                filter: function(legendItem, chartData) {
                                                    const label = legendItem.text || '';
                                                    return !label.includes('Plage Idéale Min') && !label.includes('Plage Idéale Max');
                                                }
                                            }
                                        }
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: false,
                                            title: {
                                                display: true,
                                                text: 'Tension (V)'
                                            },
                                            grid: {
                                                color: 'rgba(0, 0, 0, 0.1)'
                                            },
                                            ticks: {
                                                callback: function(value, index, values) {
                                                    if (value === limites.max) {
                                                        return '🚫 ' + value + 'V (Max)';
                                                    }
                                                    if (value === limites.min) {
                                                        return '⚠️ ' + value + 'V (Min)';
                                                    }
                                                    if (value === limites.idealMin || value === limites.idealMax) {
                                                        return '✅ ' + value + 'V';
                                                    }
                                                    return value + 'V';
                                                }
                                            }
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                text: 'Dates'
                                            },
                                            grid: {
                                                color: 'rgba(0, 0, 0, 0.1)'
                                            },
                                            ticks: {
                                                maxTicksLimit: 15,
                                                callback: function(value, index, values) {
                                                    if (filteredDates.length > 20) {
                                                        return index % Math.ceil(filteredDates.length / 15) === 0 ? this.getLabelForValue(value) : '';
                                                    }
                                                    return this.getLabelForValue(value);
                                                }
                                            }
                                        }
                                    },
                                    interaction: {
                                        intersect: false,
                                        mode: 'nearest'
                                    },
                                    animation: {
                                        duration: 500,
                                        easing: 'easeInOutQuart'
                                    }
                                }
                            });
                        }
                        
                        // Événements des filtres rapides
                        document.querySelectorAll('.btn-quick-filter').forEach(btn => {
                            btn.addEventListener('click', function() {
                                const days = parseInt(this.dataset.days);
                                
                                // Mettre à jour le style des boutons
                                document.querySelectorAll('.btn-quick-filter').forEach(b => {
                                    b.style.background = '#edf2f7';
                                    b.style.color = '#4a5568';
                                    b.style.border = '1px solid #cbd5e0';
                                });
                                
                                this.style.background = '#3182ce';
                                this.style.color = 'white';
                                this.style.border = 'none';
                                
                                filterByLastDays(days);
                            });
                        });
                        
                        // Événements des filtres par dates
                        document.getElementById('${canvasId}-apply').addEventListener('click', function() {
                            const startDate = document.getElementById('${canvasId}-start').value;
                            const endDate = document.getElementById('${canvasId}-end').value;
                            
                            if (startDate && endDate) {
                                // Désélectionner les filtres rapides
                                document.querySelectorAll('.btn-quick-filter').forEach(b => {
                                    b.style.background = '#edf2f7';
                                    b.style.color = '#4a5568';
                                    b.style.border = '1px solid #cbd5e0';
                                });
                                
                                filterDataByDate(startDate, endDate);
                            }
                        });
                        
                        document.getElementById('${canvasId}-reset').addEventListener('click', function() {
                            // Réinitialiser les dates
                            document.getElementById('${canvasId}-start').value = '${startDateValue}';
                            document.getElementById('${canvasId}-end').value = '${endDateValue}';
                            
                            // Réinitialiser les données
                            filteredDates = [...allDates];
                            filteredMinTensions = [...allMinTensions];
                            filteredMaxTensions = [...allMaxTensions];
                            filteredAvgTensions = [...allAvgTensions];
                            
                            // Réinitialiser les boutons de filtre rapide
                            document.querySelectorAll('.btn-quick-filter').forEach(b => {
                                b.style.background = '#edf2f7';
                                b.style.color = '#4a5568';
                                b.style.border = '1px solid #cbd5e0';
                            });
                            
                            // Sélectionner "Toute la période"
                            document.querySelector('.btn-quick-filter[data-days="0"]').style.background = '#3182ce';
                            document.querySelector('.btn-quick-filter[data-days="0"]').style.color = 'white';
                            document.querySelector('.btn-quick-filter[data-days="0"]').style.border = 'none';
                            
                            updateChart();
                            updatePeriodInfo();
                        });
                        
                        // Validation en temps réel des dates
                        document.getElementById('${canvasId}-start').addEventListener('change', function() {
                            const startDate = this.value;
                            const endDate = document.getElementById('${canvasId}-end').value;
                            
                            if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
                                document.getElementById('${canvasId}-end').value = startDate;
                            }
                            
                            // Désélectionner les filtres rapides
                            document.querySelectorAll('.btn-quick-filter').forEach(b => {
                                b.style.background = '#edf2f7';
                                b.style.color = '#4a5568';
                                b.style.border = '1px solid #cbd5e0';
                            });
                        });
                        
                        document.getElementById('${canvasId}-end').addEventListener('change', function() {
                            const endDate = this.value;
                            const startDate = document.getElementById('${canvasId}-start').value;
                            
                            if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
                                document.getElementById('${canvasId}-start').value = endDate;
                            }
                            
                            // Désélectionner les filtres rapides
                            document.querySelectorAll('.btn-quick-filter').forEach(b => {
                                b.style.background = '#edf2f7';
                                b.style.color = '#4a5568';
                                b.style.border = '1px solid #cbd5e0';
                            });
                        });
                        
                        // Initialiser le graphique
                        initializeChart();
                        updatePeriodInfo();
                        
                        console.log('✅ Graphique avec points d\\'alerte créé avec succès');
                        
                    } catch (error) {
                        console.error('❌ Erreur création graphique:', error);
                    }
                })();
            </script>
        </div>
    `;
}

// ======================== COMPOSANTS HTML - AMÉLIORÉS ========================
function createTensionGlobalDashboard(globalStats, daily, forfaitName, results) {
  const {
    totalMesures,
    totalJours,
    tensionMoyenne,
    tensionMin,
    tensionMax,
    stabilite,
    joursStables,
    joursInstables,
    joursHorsLimites,
    systemType
  } = globalStats;

  const forfait = getTensionForfait(forfaitName, results);

  // Calcul des tendances
  const tensions = results.map(r => r.tension);
  const variations = [];
  for (let i = 1; i < tensions.length; i++) {
    variations.push(Math.abs(tensions[i] - tensions[i - 1]));
  }
  const variationMoyenne = variations.length > 0 ? parseFloat((variations.reduce((a, b) => a + b, 0) / variations.length).toFixed(3)) : 0;

  return `
    <div class="tension-dashboard-global">
      <h5>📊 Tableau de Bord Tension - Système ${systemType}</h5>
      
      <div class="tension-stats-cards">
        <div class="tension-stat-card">
          <div class="tension-stat-icon">📅</div>
          <div class="tension-stat-content">
            <div class="tension-stat-value">${totalJours}</div>
            <div class="tension-stat-label">Jours analysés</div>
            <div class="tension-stat-sub">${totalMesures} mesures</div>
          </div>
        </div>
        
        <div class="tension-stat-card">
          <div class="tension-stat-icon">⚡</div>
          <div class="tension-stat-content">
            <div class="tension-stat-value">${tensionMoyenne}V</div>
            <div class="tension-stat-label">Tension moyenne</div>
            <div class="tension-stat-sub">${tensionMin}V - ${tensionMax}V</div>
          </div>
        </div>
        
        <div class="tension-stat-card">
          <div class="tension-stat-icon">📊</div>
          <div class="tension-stat-content">
            <div class="tension-stat-value" style="color: ${stabilite >= 80 ? '#48bb78' : stabilite >= 60 ? '#d69e2e' : '#e53e3e'}">
              ${stabilite}%
            </div>
            <div class="tension-stat-label">Stabilité</div>
            <div class="tension-stat-sub">${variationMoyenne}V variation moy.</div>
          </div>
        </div>
        
        <div class="tension-stat-card">
          <div class="tension-stat-icon">🎯</div>
          <div class="tension-stat-content">
            <div class="tension-stat-value" style="color: ${tensionMoyenne >= forfait.min && tensionMoyenne <= forfait.max ? '#48bb78' : '#e53e3e'}">
              ${systemType}
            </div>
            <div class="tension-stat-label">Système</div>
            <div class="tension-stat-sub">${forfait.min}V - ${forfait.max}V</div>
          </div>
        </div>
      </div>

      <div class="tension-alerts-summary">
        <h6>📈 Répartition des Jours par Statut</h6>
        <div class="tension-alerts-grid">
          <div class="tension-alert-type stable">
            <span class="tension-alert-icon">✅</span>
            <span class="tension-alert-label">Stables</span>
            <span class="tension-alert-count">${joursStables}</span>
            <span class="tension-alert-percent">${Math.round(joursStables / totalJours * 100)}%</span>
          </div>
          <div class="tension-alert-type instable">
            <span class="tension-alert-icon">🟡</span>
            <span class="tension-alert-label">Instables</span>
            <span class="tension-alert-count">${joursInstables}</span>
            <span class="tension-alert-percent">${Math.round(joursInstables / totalJours * 100)}%</span>
          </div>
          <div class="tension-alert-type hors-limites">
            <span class="tension-alert-icon">🔴</span>
            <span class="tension-alert-label">Hors limites</span>
            <span class="tension-alert-count">${joursHorsLimites}</span>
            <span class="tension-alert-percent">${Math.round(joursHorsLimites / totalJours * 100)}%</span>
          </div>
        </div>
      </div>

      <div class="tension-system-info">
        <h6>🔧 Informations Système ${systemType}V</h6>
        <div class="tension-system-grid">
          <div class="tension-system-item">
            <strong>Plage normale:</strong> ${systemType === '24V' ? '24V - 29V' : '12V - 14.5V'}
          </div>
          <div class="tension-system-item">
            <strong>Limites acceptables:</strong> ${systemType === '24V' ? '21.4V - 31.5V' : '10.7V - 15.6V'}
          </div>
          <div class="tension-system-item">
            <strong>Tension idéale:</strong> ${systemType === '24V' ? '28V' : '14V'}
          </div>
          <div class="tension-system-item">
            <strong>Variation max:</strong> ${systemType === '24V' ? '5V' : '2.5V'}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ======================== COMPOSANTS HTML ========================
function createTensionStatsHTML(daily, forfaitName, results) {
  if (!daily.length) return '<p class="no-data">Aucune donnée de tension disponible</p>';

  const globalStats = generateTensionGlobalStats(results, daily);
  const systemType = globalStats.systemType;
  const forfait = getTensionForfait(forfaitName, results);

  return `
    <div class="tension-detailed-stats">
      <h5>📋 Statistiques Détaillées</h5>
      <div class="stats-grid">
        <div><strong>Jours analysés</strong><br>${globalStats.totalJours}</div>
        <div><strong>Mesures totales</strong><br>${globalStats.totalMesures}</div>
        <div><strong>Tension moyenne</strong><br>${globalStats.tensionMoyenne} V</div>
        <div><strong>Minimum global</strong><br>${globalStats.tensionMin} V</div>
        <div><strong>Maximum global</strong><br>${globalStats.tensionMax} V</div>
        <div><strong>Taux de stabilité</strong><br>${globalStats.stabilite}%</div>
      </div>
    </div>
    
    <div class="statuts-repartition">
      <h5>Répartition des jours :</h5>
      <div class="statuts-grid">
        <div class="statut-item" style="color: #38a169;">
          <span style="font-size: 20px;">✅</span> Jours stables: ${globalStats.joursStables}
        </div>
        <div class="statut-item" style="color: #d69e2e;">
          <span style="font-size: 20px;">🟡</span> Jours instables: ${globalStats.joursInstables}
        </div>
        <div class="statut-item" style="color: #e53e3e;">
          <span style="font-size: 20px;">🔴</span> Jours hors limites: ${globalStats.joursHorsLimites}
        </div>
        ${globalStats.joursPasTension > 0 ? `
        <div class="statut-item" style="color: #4299e1;">
          <span style="font-size: 20px;">🔵</span> Pas de tension: ${globalStats.joursPasTension}
        </div>
        ` : ''}
      </div>
    </div>
    
    <div class="tension-normes">
      <h5>📏 Normes du système ${systemType} DC:</h5>
      <div class="normes-grid">
        <div>Minimum acceptable: ${systemType === '24V' ? '21.4' : '10.7'} V</div>
        <div>Maximum acceptable: ${systemType === '24V' ? '31.5' : '15.6'} V</div>
        <div>Tension normale: ${systemType === '24V' ? '28' : '14'} V</div>
        <div>Plage idéale: ${systemType === '24V' ? '24-29' : '12-14.5'} V</div>
        <div>Variation max/jour: ${systemType === '24V' ? '5' : '2.5'} V</div>
        <div>Seuil d'alerte: ${systemType === '24V' ? '3' : '1.5'} V/h</div>
      </div>
    </div>`;
}

function createTensionAlertsHTML(alerts) {
  if (!alerts.length) return '<p style="color:#48bb78">✅ Tension stable - Aucune alerte</p>';

  return `
    <div class="alerts">
      ${alerts.map(alert => `
        <div class="alert alert-${alert.type}">
          <span class="alert-icon">${alert.icon}</span>
          <div class="alert-content">
            <strong>${alert.title}</strong>
            <div>${alert.message}</div>
            ${alert.date ? `<small>Date: ${alert.date}</small>` : ''}
          </div>
        </div>
      `).join('')}
    </div>`;
}

// Fonction pour créer un tableau de tension
function createTensionTable(data, columns, title, forfaitName = 'STANDARD', results = [], showExportButton = false, fileName = '') {
  if (!data || !data.length) {
    return `<div class="no-data">📊 Aucune donnée de tension disponible pour "${title}"</div>`;
  }

  // AJOUT : Numéroter les lignes pour plus de clarté
  const dataWithNumbers = data.map((item, index) => ({
    '#': index + 1,
    ...item
  }));

  // AJOUT : Ajouter la colonne # si elle n'existe pas
  const finalColumns = columns.includes('#') ? columns : ['#', ...columns];

  // AJOUT : Bouton d'export si demandé
  const exportButtonHTML = showExportButton ? `
    <div class="export-section">
      <button class="btn btn-success export-excel-btn" data-filename="${fileName}">
        <i class="fas fa-file-excel"></i>
        Exporter vers Excel
      </button>
      <div class="export-info">
        📋 ${data.length} ligne(s) à exporter (Date, Heure, Tension)
      </div>
    </div>
  ` : '';

  return `
    <div class="table-container">
      <h4>${title}</h4>
      ${exportButtonHTML}
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              ${finalColumns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dataWithNumbers.map(row => {
    let statutInfo;
    if (row.statut) {
      statutInfo = row.statut;
    } else if (row.tension !== undefined) {
      statutInfo = determineTensionStatut(row.tension, row.tension, row.tension, forfaitName, results);
    } else if (row.valeurMin !== undefined) {
      statutInfo = determineTensionStatut(row.valeurMin, row.valeurMax, row.valeurMoyenne, forfaitName, results);
    } else {
      statutInfo = { statut: 'N/A', icone: '⚪', couleur: '#718096' };
    }

    return `
                <tr>
                  ${finalColumns.map(col => {
      if (col === '#') {
        return `<td style="font-weight: bold; color: #718096;">${row[col]}</td>`;
      }

      const value = row[col] !== undefined ? row[col] : '-';

      if (col === 'statut') {
        return `<td style="color: ${statutInfo.couleur}; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 16px;">${statutInfo.icone}</span>
                                ${statutInfo.statut}
                              </td>`;
      }

      // Style pour les valeurs hors limites
      if ((col === 'tension' || col === 'valeur' || col === 'valeurMin' || col === 'valeurMax') && typeof value === 'number') {
        const systemType = detectSystemType(results);
        const tensionBasseSeuil = systemType === '24V' ? 21.4 : 10.7;
        const tensionHauteSeuil = systemType === '24V' ? 31.5 : 15.6;

        if (value < tensionBasseSeuil || value > tensionHauteSeuil) {
          return `<td style="color: #e53e3e; font-weight: bold;">${value} V</td>`;
        } else if (value < (systemType === '24V' ? 22 : 11) || value > (systemType === '24V' ? 30 : 15)) {
          return `<td style="color: #d69e2e; font-weight: bold;">${value} V</td>`;
        }
        return `<td>${value} V</td>`;
      }

      if (col === 'variation' && typeof value === 'number') {
        const color = value === 0 ? '#718096' :
          value > 0 ? '#38a169' : '#e53e3e';
        const sign = value > 0 ? '+' : '';
        return `<td style="color: ${color}; font-weight: bold;">${sign}${value} V</td>`;
      }

      return `<td>${value}</td>`;
    }).join('')}
                </tr>
              `;
  }).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-info">
        📋 ${data.length} enregistrement(s) affiché(s) - Tri chronologique
      </div>
    </div>
  `;
}

function createTensionFileSectionHTML(file, results, daily, hourly, alerts) {
  const id = file.name.replace(/[^a-zA-Z0-9]/g, '_');
  const forfaitName = file.forfait || 'STANDARD';

  if (!window.tensionResults) window.tensionResults = {};
  window.tensionResults[id] = results;

  console.log(`[TENSION] Création section pour: ${file.name}, Forfait: ${forfaitName}`);
  console.log(`[TENSION] Données disponibles:`, {
    results: results.length,
    daily: daily.length,
    hourly: hourly.length,
    alerts: alerts.length
  });

  // Générer les stats globales
  const globalStats = generateTensionGlobalStats(results, daily);

  // Déclarer systemType pour l'utiliser dans le template
  const systemType = globalStats.systemType;

  console.log(`🔧 [TENSION] Système détecté pour ${file.name}: ${systemType}`);

  const dailyWithStatuts = daily.map(d => {
    const statutInfo = determineTensionStatut(d.valeurMin, d.valeurMax, d.valeurMoyenne, forfaitName, results);
    return {
      ...d,
      statut: statutInfo.statut,
      icone: statutInfo.icone,
      couleur: statutInfo.couleur,
      description: statutInfo.description
    };
  });

  // Calculer quelques statistiques supplémentaires pour l'affichage
  const statsSupplementaires = {
    tensionMoyenneGlobale: globalStats.tensionMoyenne,
    variationMoyenne: calculateAverageVariation(hourly),
    joursAvecProblemes: globalStats.joursInstables + globalStats.joursHorsLimites,
    pourcentageStable: globalStats.stabilite
  };

  // CORRECTION : Définir detailChartId AVANT de l'utiliser
  const detailChartId = `tension-detail-chart-${id}-${Date.now()}`;

  return `
    <div class="tension-file-section" data-file-id="${id}">
      <div class="file-header">
        <h4>📄 Document ${file.name}</h4>
        <div class="file-header-info">
          ${file.client ? `<div class="client-badge">👤 Client: ${file.client}</div>` : ''}
          <div class="forfait-badge">⚡ Système: ${systemType} DC</div>
          <div class="data-stats">
            <span class="stat-item">📊 ${results.length} points de données</span>
            <span class="stat-item">📅 ${daily.length} jours analysés</span>
            <span class="stat-item">⏰ ${hourly.length} variations horaires</span>
            ${alerts.length > 0 ? `<span class="stat-item alert-stat">🚨 ${alerts.length} alertes</span>` : ''}
          </div>
        </div>
      </div>

      <!-- TABLEAU DE BORD GLOBAL -->
      <div class="tension-global-dashboard-container">
        ${createTensionGlobalDashboard(globalStats, daily, forfaitName, results)}
      </div>

      <div class="tension-tabs-container">
        <div class="tension-tabs-header">
          <button class="tension-tab active" data-tab="tension-day-${id}">
            📈 Journalière
            ${daily.length > 0 ? `<span class="tab-indicator">${daily.length}j</span>` : ''}
          </button>
          <button class="tension-tab" data-tab="tension-var-${id}">
            🔄 Variations
          </button>
          <button class="tension-tab" data-tab="tension-detail-${id}">
            📋 Détail
            ${results.length > 0 ? `<span class="tab-indicator">${results.length}p</span>` : ''}
          </button>
          <button class="tension-tab" data-tab="tension-stats-${id}">
            📊 Statistiques
          </button>
          <button class="tension-tab" data-tab="tension-alerts-${id}">
            🚨 Alertes
            ${alerts.length > 0 ? `<span class="tab-badge">${alerts.length}</span>` : ''}
          </button>
        </div>

        <!-- Onglet Journalière - AVEC GRAPHIQUE -->
        <div class="tension-tab-content active" id="tension-day-${id}">
          <div class="tab-content-header">
            <h5>📈 Analyse Journalière de la Tension</h5>
            <div class="tab-summary">
              <span class="summary-item">Période: ${daily.length > 0 ? `${daily[0].date} - ${daily[daily.length - 1].date}` : 'N/A'}</span>
              <span class="summary-item">Plage: ${daily.length > 0 ? `${Math.min(...daily.map(d => d.valeurMin)).toFixed(2)}V - ${Math.max(...daily.map(d => d.valeurMax)).toFixed(2)}V` : 'N/A'}</span>
              <span class="summary-item">Moyenne: ${statsSupplementaires.tensionMoyenneGlobale}V</span>
            </div>
          </div>
          
          <!-- Graphique en haut -->
          ${createTensionChart(daily, forfaitName, results)}
          
          <!-- Tableau en bas -->
          ${createTensionTable(
    dailyWithStatuts.map(d => ({
      date: d.date,
      minimum: d.valeurMin,
      maximum: d.valeurMax,
      moyenne: d.valeurMoyenne,
      statut: {
        statut: d.statut,
        icone: d.icone,
        couleur: d.couleur,
        description: d.description
      }
    })),
    ['date', 'minimum', 'maximum', 'moyenne', 'statut'],
    `Résumé Journalier Tension - ${daily.length} jour(s)`,
    forfaitName,
    results
  )}
        </div>
      
        <!-- Onglet Variations -->
        <div class="tension-tab-content" id="tension-var-${id}">
          <div class="tab-content-header">
            <h5>🔄 Variations Horaires de la Tension</h5>
            <div class="tab-summary">
              <span class="summary-item">Total mesures: ${hourly.length}</span>
              <span class="summary-item">Variation moyenne: ${statsSupplementaires.variationMoyenne}V</span>
              <span class="summary-item">Période couverte: ${hourly.length > 0 ? `${Math.ceil(hourly.length / 24)} jour(s)` : 'N/A'}</span>
            </div>
          </div>
          
          ${createTensionTable(
    hourly.map(h => ({
      date: h.date,
      heure: h.heure,
      tension: h.tension,
      variation: h.variation,
      tendance: getTendanceIcon(h.variation)
    })),
    ['date', 'heure', 'tension', 'variation', 'tendance'],
    'Variations Horaires Tension',
    forfaitName,
    results
  )}
        </div>
      
        <!-- Onglet Détail - AVEC GRAPHIQUE HORAIRE -->
        <div class="tension-tab-content" id="tension-detail-${id}">
          <div class="tab-content-header">
            <h5>📋 Données Brutes de Tension</h5>
            <div class="tab-summary">
              <span class="summary-item">Points de mesure: ${results.length}</span>
              <span class="summary-item">Période: ${results.length > 0 ? `${results[0].date} ${results[0].heure} - ${results[results.length - 1].date} ${results[results.length - 1].heure}` : 'N/A'}</span>
              <span class="summary-item">Résolution: horaire</span>
            </div>
          </div>
          
          <!-- GRAPHIQUE HORAIRE EN HAUT -->
          ${createTensionHourlyChartHTML(results, forfaitName, detailChartId, "📊 Évolution Horaires de la Tension")}
          
          <!-- Tableau en bas -->
          ${createTensionTable(
    results.map(r => ({
      date: r.date,
      heure: r.heure,
      tension: r.tension,
      statut: determineTensionStatut(r.tension, r.tension, r.tension, forfaitName, results)
    })),
    ['date', 'heure', 'tension', 'statut'],
    'Données Brutes Tension',
    forfaitName,
    results,
    true, // Activer le bouton d'export
    file.name // Nom du fichier pour l'export
  )}
        </div>
      
        <!-- Onglet Stats -->
        <div class="tension-tab-content" id="tension-stats-${id}">
          <div class="tab-content-header">
            <h5>📊 Statistiques Détaillées</h5>
            <div class="tab-summary">
              <span class="summary-item">Système: ${systemType}</span>
              <span class="summary-item">Stabilité: ${statsSupplementaires.pourcentageStable}%</span>
              <span class="summary-item">Jours stables: ${globalStats.joursStables}/${daily.length}</span>
            </div>
          </div>
          
          ${createTensionStatsHTML(daily, forfaitName, results)}
        </div>
      
        <!-- Onglet Alertes -->
        <div class="tension-tab-content" id="tension-alerts-${id}">
          <div class="tab-content-header">
            <h5>🚨 Alertes et Anomalies</h5>
            <div class="tab-summary">
              <span class="summary-item">Total alertes: ${alerts.length}</span>
              <span class="summary-item">Jours avec problèmes: ${statsSupplementaires.joursAvecProblemes}</span>
              <span class="summary-item">Dernière analyse: ${new Date().toLocaleDateString()}</span>
            </div>
          </div>
          
          ${createTensionAlertsHTML(alerts)}
          
          ${alerts.length === 0 ? `
            <div class="no-alerts-message">
              <div class="no-alerts-icon">✅</div>
              <div class="no-alerts-content">
                <h6>Aucune alerte détectée</h6>
                <p>La tension est stable et dans les limites normales pour un système ${systemType}.</p>
                <div class="alerts-summary">
                  <div class="alert-summary-item positive">
                    <span class="summary-icon">📊</span>
                    <span class="summary-text">Stabilité: ${statsSupplementaires.pourcentageStable}%</span>
                  </div>
                  <div class="alert-summary-item positive">
                    <span class="summary-icon">⚡</span>
                    <span class="summary-text">Moyenne: ${statsSupplementaires.tensionMoyenneGlobale}V</span>
                  </div>
                  <div class="alert-summary-item positive">
                    <span class="summary-icon">📅</span>
                    <span class="summary-text">Jours stables: ${globalStats.joursStables}/${daily.length}</span>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Section d'informations techniques -->
      <div class="technical-info">
        <div class="technical-info-header">
          <h6>🔧 Informations Techniques</h6>
        </div>
        <div class="technical-info-grid">
          <div class="tech-item">
            <strong>Type de système:</strong> ${systemType} DC
          </div>
          <div class="tech-item">
            <strong>Plage normale:</strong> ${systemType === '24V' ? '24V - 29V' : '12V - 14.5V'}
          </div>
          <div class="tech-item">
            <strong>Limites acceptables:</strong> ${systemType === '24V' ? '21.4V - 31.5V' : '10.7V - 15.6V'}
          </div>
          <div class="tech-item">
            <strong>Fréquence d'échantillonnage:</strong> Horaires
          </div>
          <div class="tech-item">
            <strong>Période d'analyse:</strong> ${daily.length} jour(s)
          </div>
          <div class="tech-item">
            <strong>Dernière mise à jour:</strong> ${new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ======================== FONCTIONS UTILITAIRES SUPPLÉMENTAIRES ========================

function calculateAverageVariation(hourly) {
  if (!hourly || hourly.length === 0) return 0;

  const variations = hourly
    .map(h => Math.abs(h.variation))
    .filter(v => !isNaN(v) && isFinite(v));

  if (variations.length === 0) return 0;

  const average = variations.reduce((a, b) => a + b, 0) / variations.length;
  return parseFloat(average.toFixed(3));
}

function getTendanceIcon(variation) {
  if (variation > 0) {
    return '↗️';
  } else if (variation < 0) {
    return '↘️';
  } else {
    return '➡️';
  }
}

// ======================== EXPORT EXCEL - CORRIGÉ ========================
function exportTensionToExcel(results, fileName) {
  try {
    // Vérifier si SheetJS est disponible
    if (typeof XLSX === 'undefined') {
      console.error('❌ [TENSION] SheetJS (XLSX) non chargé');

      // Fallback: Export CSV si SheetJS n'est pas disponible
      return exportTensionToCSV(results, fileName);
    }

    // Préparer les données pour l'export
    const exportData = results.map(r => ({
      'Date': r.date,
      'Heure': r.heure,
      'Tension (V)': r.tension
    }));

    // Créer un workbook et une worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Définir les largeurs de colonnes
    const colWidths = [
      { wch: 12 }, // Date
      { wch: 8 },  // Heure
      { wch: 12 }  // Tension
    ];
    ws['!cols'] = colWidths;

    // Ajouter la worksheet au workbook
    XLSX.utils.book_append_sheet(wb, ws, "Tensions");

    // Générer le fichier Excel
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Télécharger le fichier
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_tensions_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✅ [TENSION] Export Excel réussi: ${exportData.length} lignes`);
    return true;
  } catch (error) {
    console.error('❌ [TENSION] Erreur export Excel:', error);

    // Fallback vers CSV en cas d'erreur
    return exportTensionToCSV(results, fileName);
  }
}

// ======================== FALLBACK CSV ========================
function exportTensionToCSV(results, fileName) {
  try {
    // Préparer les données CSV
    const headers = ['Date', 'Heure', 'Tension (V)'];
    const csvData = results.map(r => [r.date, r.heure, r.tension]);

    // Créer le contenu CSV
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    // Créer et télécharger le fichier CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_tensions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✅ [TENSION] Export CSV réussi: ${results.length} lignes`);
    return true;
  } catch (error) {
    console.error('❌ [TENSION] Erreur export CSV:', error);
    return false;
  }
}

// ======================== INITIALISATION DES GRAPHIQUES ========================
export function initializeTensionCharts() {
  console.log('📊 Initialisation des graphiques tension...');

  // Réinitialiser tous les graphiques tension
  document.querySelectorAll('.tension-chart-container').forEach(container => {
    const canvas = container.querySelector('canvas');
    if (canvas) {
      // Forcer le redessin du canvas
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Relancer le script de dessin
      const script = container.querySelector('script');
      if (script) {
        try {
          eval(script.textContent);
        } catch (error) {
          console.error('Erreur initialisation graphique:', error);
        }
      }
    }
  });
}

// ======================== INITIALISATION PRINCIPALE ========================
export function createTensionAnalysisContent(files) {
  if (!files?.length) return '<p class="no-data">Aucun fichier tension</p>';

  loadTensionCSS();
  window.tensionResults = {};

  const html = files.map(file => {
    console.log(`🔍 [TENSION] Analyse du fichier: ${file.name}`);

    const results = analyzeTension(file.content);
    const daily = generateTensionDailySummary(results);
    const hourly = calculateTensionHourly(results);
    const alerts = detectTensionAnomalies(results, daily, file.forfait || 'STANDARD');

    return createTensionFileSectionHTML(file, results, daily, hourly, alerts);
  }).join('');

  // Initialisation différée
  setTimeout(() => {
    initializeTensionTabs();
    initializeTensionAlertBadges();
  }, 300);

  return html;
}

// ======================== GESTION DE L'UI ========================
export function initializeTensionTabs() {
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tension-tab');
    if (!tab) return;

    const targetId = tab.dataset.tab;
    const container = tab.closest('.tension-tabs-container');

    // Désactiver tous les tabs et contenus
    container.querySelectorAll('.tension-tab').forEach(t => t.classList.remove('active'));
    container.querySelectorAll('.tension-tab-content').forEach(c => c.classList.remove('active'));

    // Activer le tab sélectionné
    tab.classList.add('active');
    document.getElementById(targetId)?.classList.add('active');
  });

  // Gestion du clic sur le bouton d'export Excel
  document.addEventListener('click', (e) => {
    const exportBtn = e.target.closest('.export-excel-btn');
    if (!exportBtn) return;

    const fileName = exportBtn.dataset.filename;
    const container = exportBtn.closest('.tension-file-section');
    const fileId = container?.dataset.fileId;

    if (!fileId || !window.tensionResults?.[fileId]) {
      console.error('❌ [TENSION] Données non trouvées pour l\'export');
      return;
    }

    const results = window.tensionResults[fileId];

    // Afficher un indicateur de chargement
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Export en cours...';
    exportBtn.disabled = true;

    // Lancer l'export après un petit délai pour l'UI
    setTimeout(() => {
      const success = exportTensionToExcel(results, fileName);

      if (success) {
        exportBtn.innerHTML = '<i class="fas fa-check"></i> Export réussi!';
        setTimeout(() => {
          exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Exporter vers Excel';
          exportBtn.disabled = false;
        }, 2000);
      } else {
        exportBtn.innerHTML = '<i class="fas fa-times"></i> Erreur d\'export';
        exportBtn.disabled = false;
      }
    }, 500);
  });
}

export function initializeTensionAlertBadges() {
  document.querySelectorAll('.tension-file-section').forEach(section => {
    const key = section.querySelector('h4')
      ?.textContent.replace(/Document /, '')
      .replace(/[^a-zA-Z0-9]/g, '_');

    const results = window.tensionResults?.[key];
    if (!results) return;

    const alerts = detectTensionAnomalies(results, generateTensionDailySummary(results), 'STANDARD');
    const badge = section.querySelector('.tension-tab[data-tab^="tension-alerts"] .tab-badge');

    if (badge) {
      badge.textContent = alerts.length;
      badge.style.display = alerts.length ? 'inline' : 'none';
    }
  });
}

// ======================== UTILITAIRES GLOBAUX ========================
function loadTensionCSS() {
  if (document.querySelector('link[href*="tensionAnalyzer.css"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './analyzer/tensionAnalyzer.css';
  document.head.appendChild(link);
}

// Exporter la fonction globalement pour qu'elle soit accessible partout
if (typeof window !== 'undefined') {
    window.analyzeTension = analyzeTension;
    window.generateTensionDailySummary = generateTensionDailySummary;
    window.calculateTensionHourly = calculateTensionHourly;
    console.log('✅ Fonctions tension exportées globalement');
} 