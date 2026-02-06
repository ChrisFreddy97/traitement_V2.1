// analyzer/creditAnalyzer.js
const CREDIT_SEUILS = {
  FAIBLE: { seuil: 7, couleur: '#e53e3e', icone: '🔴' },
  MOYEN: { seuil: 15, couleur: '#d69e2e', icone: '🟡' },
  BON: { seuil: 30, couleur: '#38a169', icone: '✅' },
  ELEVE: { seuil: 60, couleur: '#2b6cb0', icone: '🔵' }
};

// ======================== UTILITAIRES ========================
const getCreditSeuil = (jours) => {
  if (jours < CREDIT_SEUILS.FAIBLE.seuil) return CREDIT_SEUILS.FAIBLE;
  if (jours < CREDIT_SEUILS.MOYEN.seuil) return CREDIT_SEUILS.MOYEN;
  if (jours < CREDIT_SEUILS.BON.seuil) return CREDIT_SEUILS.BON;
  return CREDIT_SEUILS.ELEVE;
};

const normalizeDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return dateStr;
  return dateStr.replace(/(\d{2})\/(\d{2})\/(\d{2})/, (match, day, month, year) => 
    `${day}/${month}/20${year}`
  );
};

// Fonction pour parser une date hexadécimale en BCD
const parseBCDDate = (dayHex, monthHex, yearHex) => {
  const day = ((dayHex >> 4) & 0xF) * 10 + (dayHex & 0xF);
  const month = ((monthHex >> 4) & 0xF) * 10 + (monthHex & 0xF);
  const year = ((yearHex >> 4) & 0xF) * 10 + (yearHex & 0xF);
  
  if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 0 && year <= 99) {
    return normalizeDate(`${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year.toString().padStart(2, '0')}`);
  }
  return null;
};

// ======================== DÉTECTION ET CORRECTION CRÉDIT ========================
function detectAndFixCreditValue(creditValue) {
  // Convertir en nombre si ce n'est pas déjà le cas
  const numValue = typeof creditValue === 'string' ? parseInt(creditValue, 10) : creditValue;
  
  // Vérifier si la valeur correspond à B6 (182), B3 (179) ou B7 (183)
  if (numValue === 182 || numValue === 179 || numValue === 183) {
    console.log(`⚠️ [CREDIT] Valeur détectée: ${numValue} (${numValue === 182 ? 'B6' : numValue === 179 ? 'B3' : 'B7'}) -> Forcé à 0`);
    return 0; // Forcer le crédit à 0
  }
  
  return numValue;
}

// ======================== ANALYSE CRÉDIT CORRIGÉE ========================
export function analyzeCredit(input) {
  if (!input) return [];

  const cleaned = input
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const tokens = cleaned.split(' ');
  const rows = [];
  let i = 0;

  console.log('🔍 [CREDIT] Début analyse -', tokens.length, 'tokens');

  while (i < tokens.length) {
    // Chercher B3 comme marqueur de début de bloc de données
    if (tokens[i] === "B3") {
      console.log(`📍 [CREDIT] Trouvé B3 à l'index ${i}`);
      
      // Traiter le bloc B3 initial (6 tokens)
      if (i + 5 < tokens.length) {
        const dayHex = parseInt(tokens[i + 1], 16);
        const monthHex = parseInt(tokens[i + 2], 16);
        const yearHex = parseInt(tokens[i + 3], 16);
        const creditH = parseInt(tokens[i + 4], 16);
        const creditL = parseInt(tokens[i + 5], 16);

        if (!isNaN(dayHex) && !isNaN(monthHex) && !isNaN(yearHex) && !isNaN(creditH) && !isNaN(creditL)) {
          const dateStr = parseBCDDate(dayHex, monthHex, yearHex);
          let creditDays = creditH * 256 + creditL;
          
          // Appliquer la correction si nécessaire
          creditDays = detectAndFixCreditValue(creditDays);

          if (dateStr && creditDays >= 0 && creditDays < 65535) {
            rows.push({
              date: dateStr,
              credit: creditDays,
              valeur: creditDays
            });
            console.log(`📝 [CREDIT] Ajout B3 initial - ${dateStr}: ${creditDays} jours`);
          }
        }
      }
      
      // Maintenant, chercher les séquences de données qui suivent (blocs de 5 tokens)
      let j = i + 6; // Position après le bloc B3 initial
      
      while (j + 4 < tokens.length) {
        // Vérifier si c'est le début d'un nouveau bloc (B3, B4, FF, etc.)
        if (tokens[j] === "B3" || tokens[j] === "B4" || tokens[j] === "FF" || tokens[j] === "13") {
          break;
        }
        
        // Essayer de parser une séquence de 5 tokens (date + crédit)
        const dayHex = parseInt(tokens[j], 16);
        const monthHex = parseInt(tokens[j + 1], 16);
        const yearHex = parseInt(tokens[j + 2], 16);
        const creditH = parseInt(tokens[j + 3], 16);
        const creditL = parseInt(tokens[j + 4], 16);

        if (!isNaN(dayHex) && !isNaN(monthHex) && !isNaN(yearHex) && !isNaN(creditH) && !isNaN(creditL)) {
          const dateStr = parseBCDDate(dayHex, monthHex, yearHex);
          let creditDays = creditH * 256 + creditL;
          
          // Appliquer la correction si nécessaire
          creditDays = detectAndFixCreditValue(creditDays);

          if (dateStr && creditDays >= 0 && creditDays < 65535) {
            rows.push({
              date: dateStr,
              credit: creditDays,
              valeur: creditDays
            });
            console.log(`📝 [CREDIT] Ajout séquence données - ${dateStr}: ${creditDays} jours`);
          }
          j += 5; // Avancer de 5 tokens pour la prochaine séquence
        } else {
          j++; // Token invalide, avancer d'un
        }
      }
      
      i = j; // Continuer à partir de la position actuelle
    } else {
      i++; // Continuer la recherche
    }
  }

  // Maintenant, chercher aussi après les blocs B4
  i = 0;
  while (i < tokens.length) {
    if (tokens[i] === "B4") {
      console.log(`📍 [CREDIT] Trouvé B4 à l'index ${i}`);
      
      // Avancer après le bloc B4 complet (6 tokens après B4)
      let j = i + 7;
      
      // Chercher le prochain B3 après B4
      while (j < tokens.length) {
        if (tokens[j] === "B3") {
          console.log(`📍 [CREDIT] Trouvé B3 après B4 à l'index ${j}`);
          
          // Traiter ce B3 et ses séquences
          if (j + 5 < tokens.length) {
            const dayHex = parseInt(tokens[j + 1], 16);
            const monthHex = parseInt(tokens[j + 2], 16);
            const yearHex = parseInt(tokens[j + 3], 16);
            const creditH = parseInt(tokens[j + 4], 16);
            const creditL = parseInt(tokens[j + 5], 16);

            if (!isNaN(dayHex) && !isNaN(monthHex) && !isNaN(yearHex) && !isNaN(creditH) && !isNaN(creditL)) {
              const dateStr = parseBCDDate(dayHex, monthHex, yearHex);
              let creditDays = creditH * 256 + creditL;
              
              // Appliquer la correction si nécessaire
              creditDays = detectAndFixCreditValue(creditDays);

              if (dateStr && creditDays >= 0 && creditDays < 65535) {
                // Vérifier si cette entrée existe déjà
                const existeDeja = rows.some(row => row.date === dateStr && row.credit === creditDays);
                if (!existeDeja) {
                  rows.push({
                    date: dateStr,
                    credit: creditDays,
                    valeur: creditDays
                  });
                  console.log(`📝 [CREDIT] Ajout B3 après B4 - ${dateStr}: ${creditDays} jours`);
                }
              }
            }
          }
          
          // Traiter les séquences après ce B3
          j += 6;
          while (j + 4 < tokens.length) {
            if (tokens[j] === "B3" || tokens[j] === "B4" || tokens[j] === "FF" || tokens[j] === "13") {
              break;
            }
            
            const dayHex = parseInt(tokens[j], 16);
            const monthHex = parseInt(tokens[j + 1], 16);
            const yearHex = parseInt(tokens[j + 2], 16);
            const creditH = parseInt(tokens[j + 3], 16);
            const creditL = parseInt(tokens[j + 4], 16);

            if (!isNaN(dayHex) && !isNaN(monthHex) && !isNaN(yearHex) && !isNaN(creditH) && !isNaN(creditL)) {
              const dateStr = parseBCDDate(dayHex, monthHex, yearHex);
              let creditDays = creditH * 256 + creditL;
              
              // Appliquer la correction si nécessaire
              creditDays = detectAndFixCreditValue(creditDays);

              if (dateStr && creditDays >= 0 && creditDays < 65535) {
                const existeDeja = rows.some(row => row.date === dateStr && row.credit === creditDays);
                if (!existeDeja) {
                  rows.push({
                    date: dateStr,
                    credit: creditDays,
                    valeur: creditDays
                  });
                  console.log(`📝 [CREDIT] Ajout séquence après B4 - ${dateStr}: ${creditDays} jours`);
                }
              }
              j += 5;
            } else {
              j++;
            }
          }
          
          i = j;
          break;
        }
        j++;
      }
      
      if (j >= tokens.length) {
        i++;
      } else {
        i = j;
      }
    } else {
      i++;
    }
  }

  // Tri chronologique
  const sortedRows = rows.sort((a, b) => {
    const dateA = a.date.split('/').reverse().join('-');
    const dateB = b.date.split('/').reverse().join('-');
    return dateA.localeCompare(dateB);
  });

  console.log(`✅ [CREDIT] Analyse terminée: ${sortedRows.length} lignes générées`);
  
  if (sortedRows.length > 0) {
    console.log('📋 [CREDIT] Toutes les lignes trouvées:');
    sortedRows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.date} - ${row.credit} jours`);
    });
  } else {
    console.log('❌ [CREDIT] Aucune donnée valide trouvée');
  }

  return sortedRows;
}

// ======================== ANALYSES ALTERNATIVES ========================
export function parseFormattedCredit(content) {
  if (!content) return [];

  const results = [];
  const lines = content.split('\n');
  
  lines.forEach(line => {
    const trimmedLine = line.trim();
    
    const dateMatch = trimmedLine.match(/(\d{2}\/\d{2}\/\d{2,4})/);
    const numberMatch = trimmedLine.match(/(\d+\.?\d*)/g);
    
    if (dateMatch && numberMatch && numberMatch.length > 0) {
      const date = normalizeDate(dateMatch[1]);
      let valeur = parseInt(numberMatch[0]);
      
      // Appliquer la correction si nécessaire
      valeur = detectAndFixCreditValue(valeur);
      
      results.push({
        date: date,
        credit: valeur,
        valeur: valeur
      });
    } else if (numberMatch && numberMatch.length > 0) {
      let valeur = parseInt(numberMatch[0]);
      
      // Appliquer la correction si nécessaire
      valeur = detectAndFixCreditValue(valeur);
      
      results.push({
        date: '-',
        credit: valeur,
        valeur: valeur
      });
    }
  });
  
  return results;
}

export function comprehensiveCreditAnalysis(content) {
  if (!content) return [];
  
  console.log('🔍 [CREDIT] Analyse complète du contenu');
  
  const b3Results = analyzeCredit(content);
  
  if (b3Results.length > 0) {
    console.log(`✅ [CREDIT] ${b3Results.length} données B3 trouvées`);
    return b3Results;
  }
  
  console.log('⚠️ [CREDIT] Aucune donnée B3 trouvée, tentative formatée');
  const formattedResults = parseFormattedCredit(content);
  
  if (formattedResults.length > 0) {
    console.log(`✅ [CREDIT] ${formattedResults.length} données formatées trouvées`);
    return formattedResults;
  }
  
  console.log('❌ [CREDIT] Aucune donnée de crédit trouvée');
  return [];
}

// ======================== CALCULS CRÉDIT ========================
export const generateCreditDailySummary = (results) => {
  if (!results || !results.length) {
    console.warn('❌ [CREDIT] Aucune donnée pour générer le résumé journalier');
    return [];
  }

  // Pour le crédit, on garde généralement la dernière valeur du jour
  const dailyMap = results.reduce((acc, r) => {
    acc[r.date] = { 
      date: r.date,
      credit: r.credit  // On prend la dernière valeur rencontrée pour cette date
    };
    return acc;
  }, {});

  const summary = Object.values(dailyMap).map(d => ({
    date: d.date,
    creditMoyen: d.credit
  }));

  console.log(`📊 [CREDIT] Résumé journalier: ${summary.length} jours`);
  return summary;
};

export const calculateCreditEvolution = (results) => {
  if (!results || !results.length) {
    console.warn('❌ [CREDIT] Aucune donnée pour calculer l évolution');
    return [];
  }

  const evolution = results.map((current, index, array) => {
    let variation = 0;
    let tendance = 'stable';
    
    if (index > 0) {
      const previous = array[index - 1];
      variation = current.credit - previous.credit;
      
      if (variation > 0) tendance = 'hausse';
      else if (variation < 0) tendance = 'baisse';
    }

    return {
      date: current.date,
      credit: current.credit,
      variation: variation,
      tendance: tendance
    };
  });

  console.log(`📈 [CREDIT] Évolution calculée: ${evolution.length} points`);
  return evolution;
};

// ======================== ALERTES CRÉDIT ========================
export const detectCreditAnomalies = (results, daily) => {
  const alerts = [];

  if (!daily.length) {
    console.warn('⚠️ [CREDIT] Aucune donnée quotidienne pour détecter les anomalies');
    return alerts;
  }

  daily.forEach(d => {
    if (d.creditMoyen < CREDIT_SEUILS.FAIBLE.seuil) {
      alerts.push({
        type: 'danger',
        icon: '⚠️',
        title: 'Crédit faible',
        message: `${d.creditMoyen} jours < ${CREDIT_SEUILS.FAIBLE.seuil} jours (seuil faible)`,
        date: d.date
      });
    }
    
    if (d.creditMoyen < CREDIT_SEUILS.MOYEN.seuil && d.creditMoyen >= CREDIT_SEUILS.FAIBLE.seuil) {
      alerts.push({
        type: 'warning',
        icon: '📉',
        title: 'Crédit moyen',
        message: `${d.creditMoyen} jours (entre ${CREDIT_SEUILS.FAIBLE.seuil} et ${CREDIT_SEUILS.MOYEN.seuil-1} jours)`,
        date: d.date
      });
    }
  });

  const evolution = calculateCreditEvolution(results);
  const baissesImportantes = evolution.filter(e => e.variation < -10);
  
  baissesImportantes.forEach(baisse => {
    alerts.push({
      type: 'warning',
      icon: '🔻',
      title: 'Baisse importante',
      message: `Diminution de ${Math.abs(baisse.variation)} jours`,
      date: baisse.date
    });
  });

  const avg = daily.reduce((sum, d) => sum + d.creditMoyen, 0) / daily.length || 0;
  if (avg < CREDIT_SEUILS.MOYEN.seuil) {
    alerts.push({
      type: 'info',
      icon: 'ℹ️',
      title: 'Crédit moyen bas',
      message: `Moyenne: ${Math.round(avg)} jours (seuil moyen: ${CREDIT_SEUILS.MOYEN.seuil} jours)`
    });
  }

  console.log(`🚨 [CREDIT] Alertes détectées: ${alerts.length}`);
  return alerts;
};

// ======================== DÉTERMINATION STATUT ========================
function determineCreditStatut(credit) {
  const seuil = getCreditSeuil(credit);

  if (credit === 0) {
    return {
      statut: 'Crédit épuisé',
      icone: '🔴',
      couleur: '#e53e3e',
      description: 'Aucun crédit disponible'
    };
  }

  if (credit < CREDIT_SEUILS.FAIBLE.seuil) {
    return {
      statut: 'Crédit faible',
      icone: '🟠',
      couleur: '#dd6b20',
      description: `Crédit très faible: ${credit} jours`
    };
  }

  if (credit < CREDIT_SEUILS.MOYEN.seuil) {
    return {
      statut: 'Crédit moyen',
      icone: '🟡',
      couleur: '#d69e2e',
      description: `Crédit moyen: ${credit} jours`
    };
  }

  if (credit < CREDIT_SEUILS.BON.seuil) {
    return {
      statut: 'Bon crédit',
      icone: '✅',
      couleur: '#38a169',
      description: `Bon niveau de crédit: ${credit} jours`
    };
  }

  return {
    statut: 'Crédit élevé',
    icone: '🔵',
    couleur: '#2b6cb0',
    description: `Crédit élevé: ${credit} jours`
  };
}

// ======================== GRAPHIQUE BARRE ========================
function createCreditBarChart(dailyData, containerId) {
  if (!dailyData || !dailyData.length) {
    return '<div class="no-data">Aucune donnée pour générer le graphique</div>';
  }

  // Trier les données par date
  const sortedData = [...dailyData].sort((a, b) => {
    const dateA = a.date.split('/').reverse().join('-');
    const dateB = b.date.split('/').reverse().join('-');
    return dateA.localeCompare(dateB);
  });

  const dates = sortedData.map(d => d.date);
  const credits = sortedData.map(d => d.creditMoyen);
  
  // Déterminer les couleurs pour chaque barre
  const colors = credits.map(credit => {
    if (credit < CREDIT_SEUILS.FAIBLE.seuil) return CREDIT_SEUILS.FAIBLE.couleur;
    if (credit < CREDIT_SEUILS.MOYEN.seuil) return CREDIT_SEUILS.MOYEN.couleur;
    if (credit < CREDIT_SEUILS.BON.seuil) return CREDIT_SEUILS.BON.couleur;
    return CREDIT_SEUILS.ELEVE.couleur;
  });

  const chartHeight = 300;
  const barWidth = Math.max(30, 400 / dates.length);
  const maxCredit = Math.max(...credits, CREDIT_SEUILS.ELEVE.seuil);
  const scaleFactor = (chartHeight - 60) / maxCredit;

  // Créer le SVG
  let svg = `
    <div class="credit-chart-container">
      <div class="chart-header">
        <h5>📊 Évolution du Crédit Jours</h5>
        <div class="chart-legende">
          <span class="legende-item" style="color: ${CREDIT_SEUILS.ELEVE.couleur};">● Élevé</span>
          <span class="legende-item" style="color: ${CREDIT_SEUILS.BON.couleur};">● Bon</span>
          <span class="legende-item" style="color: ${CREDIT_SEUILS.MOYEN.couleur};">● Moyen</span>
          <span class="legende-item" style="color: ${CREDIT_SEUILS.FAIBLE.couleur};">● Faible</span>
        </div>
      </div>
      <svg width="100%" height="${chartHeight}" viewBox="0 0 ${Math.max(600, dates.length * barWidth + 100)} ${chartHeight}" class="credit-bar-chart">
        <!-- Lignes de grille -->
        ${[0, 25, 50, 75, 100].map(y => `
          <line x1="50" y1="${chartHeight - 40 - (y * scaleFactor)}" 
                x2="${Math.max(600, dates.length * barWidth + 50)}" 
                y2="${chartHeight - 40 - (y * scaleFactor)}" 
                stroke="#e2e8f0" stroke-width="1" />
          <text x="40" y="${chartHeight - 40 - (y * scaleFactor) + 4}" 
                text-anchor="end" font-size="12" fill="#718096">${y}</text>
        `).join('')}
        
        <!-- Barres du graphique -->
        ${credits.map((credit, index) => {
          const barHeight = credit * scaleFactor;
          const x = 60 + index * barWidth;
          const y = chartHeight - 40 - barHeight;
          const color = colors[index];
          
          return `
            <g class="bar-group">
              <rect x="${x}" y="${y}" 
                    width="${barWidth - 10}" 
                    height="${barHeight}" 
                    fill="${color}" 
                    rx="3" 
                    class="credit-bar"
                    data-date="${dates[index]}"
                    data-credit="${credit}"/>
              <text x="${x + (barWidth - 10) / 2}" y="${y - 5}" 
                    text-anchor="middle" font-size="11" fill="#4a5568" font-weight="bold">
                ${credit}
              </text>
              <text x="${x + (barWidth - 10) / 2}" y="${chartHeight - 20}" 
                    text-anchor="middle" font-size="10" fill="#718096" transform="rotate(45 ${x + (barWidth - 10) / 2} ${chartHeight - 20})">
                ${dates[index]}
              </text>
            </g>
          `;
        }).join('')}
        
        <!-- Ligne de référence des seuils -->
        <line x1="50" y1="${chartHeight - 40 - (CREDIT_SEUILS.FAIBLE.seuil * scaleFactor)}" 
              x2="${Math.max(600, dates.length * barWidth + 50)}" 
              y2="${chartHeight - 40 - (CREDIT_SEUILS.FAIBLE.seuil * scaleFactor)}" 
              stroke="${CREDIT_SEUILS.FAIBLE.couleur}" stroke-width="2" stroke-dasharray="5,5" />
        <text x="${Math.max(600, dates.length * barWidth + 55)}" 
              y="${chartHeight - 40 - (CREDIT_SEUILS.FAIBLE.seuil * scaleFactor) + 4}" 
              font-size="10" fill="${CREDIT_SEUILS.FAIBLE.couleur}">Seuil faible (${CREDIT_SEUILS.FAIBLE.seuil}j)</text>
              
        <line x1="50" y1="${chartHeight - 40 - (CREDIT_SEUILS.MOYEN.seuil * scaleFactor)}" 
              x2="${Math.max(600, dates.length * barWidth + 50)}" 
              y2="${chartHeight - 40 - (CREDIT_SEUILS.MOYEN.seuil * scaleFactor)}" 
              stroke="${CREDIT_SEUILS.MOYEN.couleur}" stroke-width="2" stroke-dasharray="5,5" />
        <text x="${Math.max(600, dates.length * barWidth + 55)}" 
              y="${chartHeight - 40 - (CREDIT_SEUILS.MOYEN.seuil * scaleFactor) + 4}" 
              font-size="10" fill="${CREDIT_SEUILS.MOYEN.couleur}">Seuil moyen (${CREDIT_SEUILS.MOYEN.seuil}j)</text>
      </svg>
    </div>
  `;

  return svg;
}

// ======================== COMPOSANTS HTML ========================
function createCreditStatsHTML(daily, results) {
  if (!daily.length) return '<p class="no-data">Aucune donnée de crédit disponible</p>';

  const statuts = daily.map(d => determineCreditStatut(d.creditMoyen));
  const countEleve = statuts.filter(s => s.statut === 'Crédit élevé').length;
  const countBon = statuts.filter(s => s.statut === 'Bon crédit').length;
  const countMoyen = statuts.filter(s => s.statut === 'Crédit moyen').length;
  const countFaible = statuts.filter(s => s.statut === 'Crédit faible').length;
  const countEpuise = statuts.filter(s => s.statut === 'Crédit épuisé').length;

  const avg = Math.round(daily.reduce((sum, d) => sum + d.creditMoyen, 0) / daily.length);
  const totalMesures = results.length;

  const statutGlobal = determineCreditStatut(avg);

  return `
    <div class="stats-grid">
      <div><strong>Crédit moyen</strong><br>
        <span style="color:${statutGlobal.couleur}; font-size: 1.2em; font-weight: bold;">
          ${avg} jours
        </span>
      </div>
      <div><strong>Jours analysés</strong><br>${daily.length}</div>
      <div><strong>Mesures totales</strong><br>${totalMesures}</div>
    </div>
    
    <div class="statuts-repartition">
      <h5>Répartition des niveaux de crédit :</h5>
      <div class="statuts-grid">
        <div class="statut-item" style="color: #2b6cb0;">
          <span style="font-size: 20px;">🔵</span> Crédit élevé: ${countEleve} jours
        </div>
        <div class="statut-item" style="color: #38a169;">
          <span style="font-size: 20px;">✅</span> Bon crédit: ${countBon} jours
        </div>
        <div class="statut-item" style="color: #d69e2e;">
          <span style="font-size: 20px;">🟡</span> Crédit moyen: ${countMoyen} jours
        </div>
        <div class="statut-item" style="color: #dd6b20;">
          <span style="font-size: 20px;">🟠</span> Crédit faible: ${countFaible} jours
        </div>
        <div class="statut-item" style="color: #e53e3e;">
          <span style="font-size: 20px;">🔴</span> Crédit épuisé: ${countEpuise} jours
        </div>
      </div>
    </div>
    
    <div class="credit-seuils">
      <h5>📊 Seuils de référence :</h5>
      <div class="seuils-grid">
        <div style="color: #e53e3e;">🔴 Faible: &lt; ${CREDIT_SEUILS.FAIBLE.seuil} jours</div>
        <div style="color: #d69e2e;">🟡 Moyen: ${CREDIT_SEUILS.FAIBLE.seuil}-${CREDIT_SEUILS.MOYEN.seuil-1} jours</div>
        <div style="color: #38a169;">✅ Bon: ${CREDIT_SEUILS.MOYEN.seuil}-${CREDIT_SEUILS.BON.seuil-1} jours</div>
        <div style="color: #2b6cb0;">🔵 Élevé: ≥ ${CREDIT_SEUILS.BON.seuil} jours</div>
      </div>
    </div>`;
}

function createCreditAlertsHTML(alerts) {
  if (!alerts.length) return '<p style="color:#48bb78">✅ Crédit stable - Aucune alerte</p>';

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

function createCreditTable(data, columns, title, results = []) {
  if (!data || !data.length) {
    return `<div class="no-data">📊 Aucune donnée de crédit disponible pour "${title}"</div>`;
  }

  return `
    <div class="table-container">
      <h4>${title}</h4>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map((row, index) => {
              let statutInfo;
              if (row.statut) {
                statutInfo = row.statut;
              } else if (row.credit !== undefined) {
                statutInfo = determineCreditStatut(row.credit);
              } else {
                statutInfo = { statut: 'N/A', icone: '⚪', couleur: '#718096' };
              }

              return `
                <tr>
                  <td>${index + 1}</td>
                  ${columns.map(col => {
                    if (col === '#') return '';
                    
                    const value = row[col] !== undefined ? row[col] : '-';
                    
                    if (col === 'statut') {
                      return `<td style="color: ${statutInfo.couleur}; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 16px;">${statutInfo.icone}</span>
                                ${statutInfo.statut}
                              </td>`;
                    }

                    if (col === 'credit' && typeof value === 'number') {
                      const seuil = getCreditSeuil(value);
                      return `<td style="color: ${seuil.couleur}; font-weight: bold;">${value} jours</td>`;
                    }

                    if (col === 'variation' && typeof value === 'number') {
                      const color = value === 0 ? '#718096' : 
                                   value > 0 ? '#38a169' : '#e53e3e';
                      const sign = value > 0 ? '+' : '';
                      const icone = value > 0 ? '📈' : value < 0 ? '📉' : '➡️';
                      return `<td style="color: ${color}; font-weight: bold;">${icone} ${sign}${value} jours</td>`;
                    }

                    if (col === 'tendance') {
                      const color = value === 'hausse' ? '#38a169' : 
                                   value === 'baisse' ? '#e53e3e' : '#718096';
                      const icone = value === 'hausse' ? '📈' : value === 'baisse' ? '📉' : '➡️';
                      return `<td style="color: ${color}; font-weight: bold;">${icone} ${value}</td>`;
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
        📋 ${data.length} enregistrement(s) affiché(s)
      </div>
    </div>
  `;
}

function createCreditFileSectionHTML(file, results, daily, evolution, alerts) {
  const id = file.name.replace(/[^a-zA-Z0-9]/g, '_');

  if (!window.creditResults) window.creditResults = {};
  window.creditResults[id] = results;

  console.log(`[CREDIT] Création section pour: ${file.name}`);

  const dailyWithStatuts = daily.map(d => {
    const statutInfo = determineCreditStatut(d.creditMoyen);
    return {
      ...d,
      statut: statutInfo
    };
  });

  return `
    <div class="credit-file-section" data-file-id="${id}">
      <div class="file-header">
        <h4>Document ${file.name}</h4>
        ${file.client ? `<div class="client-badge">Client: ${file.client}</div>` : ''}
        <div class="forfait-badge">Type: Crédit Jours</div>
        <div class="data-stats">
          ${results.length} points de données |
          ${daily.length} jours analysés |
          ${evolution.length} évolutions
        </div>
      </div>
      <div class="credit-tabs-container">
        <div class="credit-tabs-header">
          <button class="credit-tab active" data-tab="credit-day-${id}">Journalière</button>
          <button class="credit-tab" data-tab="credit-chart-${id}">Graphique</button>
          <button class="credit-tab" data-tab="credit-evol-${id}">Évolution</button>
          <button class="credit-tab" data-tab="credit-detail-${id}">Détail</button>
          <button class="credit-tab" data-tab="credit-stats-${id}">Stats</button>
          <button class="credit-tab" data-tab="credit-alerts-${id}">
            Alertes${alerts.length ? `<span class="tab-badge">${alerts.length}</span>` : ''}
          </button>
        </div>

        <!-- Onglet Journalière -->
        <div class="credit-tab-content active" id="credit-day-${id}">
          ${createCreditTable(
            dailyWithStatuts.map(d => ({
              date: d.date,
              credit: d.creditMoyen,
              statut: d.statut
            })),
            ['#', 'date', 'credit', 'statut'],
            'Résumé Journalier Crédit',
            results
          )}
        </div>
      
        <!-- Nouvel Onglet Graphique -->
        <div class="credit-tab-content" id="credit-chart-${id}">
          <div class="chart-section">
            <h4>Graphique du Crédit Jours</h4>
            <p class="chart-description">
              Visualisation de l'évolution du crédit jours avec code couleur selon les seuils définis.
              Chaque barre représente le crédit disponible à une date donnée.
            </p>
            ${createCreditBarChart(daily, `chart-${id}`)}
          </div>
        </div>
      
        <!-- Onglet Évolution -->
        <div class="credit-tab-content" id="credit-evol-${id}">
          ${createCreditTable(
            evolution.map((e, index) => ({
              '#': index + 1,
              date: e.date,
              credit: e.credit,
              variation: e.variation,
              tendance: e.tendance
            })),
            ['#', 'date', 'credit', 'variation', 'tendance'],
            'Évolution du Crédit',
            results
          )}
        </div>
      
        <!-- Onglet Détail -->
        <div class="credit-tab-content" id="credit-detail-${id}">
          ${createCreditTable(
            results.map((r, index) => ({
              '#': index + 1,
              date: r.date,
              credit: r.credit,
              statut: determineCreditStatut(r.credit)
            })),
            ['#', 'date', 'credit', 'statut'],
            'Données Brutes Crédit',
            results
          )}
        </div>
      
        <!-- Onglet Stats -->
        <div class="credit-tab-content" id="credit-stats-${id}">
          ${createCreditStatsHTML(daily, results)}
        </div>
      
        <!-- Onglet Alertes -->
        <div class="credit-tab-content" id="credit-alerts-${id}">
          ${createCreditAlertsHTML(alerts)}
        </div>
      </div>
    </div>`;
}

// ======================== INITIALISATION PRINCIPALE ========================
export function createCreditAnalysisContent(files) {
  if (!files?.length) return '<p class="no-data">Aucun fichier crédit</p>';

  loadCreditCSS();
  window.creditResults = {};

  const html = files.map(file => {
    console.log(`🔍 [CREDIT] Analyse du fichier: ${file.name}`);

    const results = comprehensiveCreditAnalysis(file.content);
    const daily = generateCreditDailySummary(results);
    const evolution = calculateCreditEvolution(results);
    const alerts = detectCreditAnomalies(results, daily);

    return createCreditFileSectionHTML(file, results, daily, evolution, alerts);
  }).join('');

  setTimeout(() => {
    initializeCreditTabs();
    initializeCreditAlertBadges();
  }, 300);

  return html;
}

// ======================== GESTION DE L'UI ========================
export function initializeCreditTabs() {
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.credit-tab');
    if (!tab) return;

    const targetId = tab.dataset.tab;
    const container = tab.closest('.credit-tabs-container');

    container.querySelectorAll('.credit-tab').forEach(t => t.classList.remove('active'));
    container.querySelectorAll('.credit-tab-content').forEach(c => c.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(targetId)?.classList.add('active');
  });
}

export function initializeCreditAlertBadges() {
  document.querySelectorAll('.credit-file-section').forEach(section => {
    const key = section.querySelector('h4')
      ?.textContent.replace(/Document /, '')
      .replace(/[^a-zA-Z0-9]/g, '_');

    const results = window.creditResults?.[key];
    if (!results) return;

    const alerts = detectCreditAnomalies(results, generateCreditDailySummary(results));
    const badge = section.querySelector('.credit-tab[data-tab^="credit-alerts"] .tab-badge');

    if (badge) {
      badge.textContent = alerts.length;
      badge.style.display = alerts.length ? 'inline' : 'none';
    }
  });
}

function loadCreditCSS() {
  if (document.querySelector('link[href*="creditAnalyzer.css"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './analyzer/creditAnalyzer.css';
  document.head.appendChild(link);
}


// ======================== EXPOSITION GLOBALE ========================
// Exposer les fonctions globalement pour compatibilité avec tableau-horaire.js
if (typeof window !== 'undefined') {
    window.CreditAnalyzer = {
        analyzeCredit,
        comprehensiveCreditAnalysis,
        generateCreditDailySummary,
        calculateCreditEvolution,
        detectCreditAnomalies,
        createCreditAnalysisContent,
        initializeCreditTabs,
        initializeCreditAlertBadges
    };
    
    // Exposer aussi directement pour facilité d'accès
    window.analyzeCredit = analyzeCredit;
    window.comprehensiveCreditAnalysis = comprehensiveCreditAnalysis;
    window.generateCreditDailySummary = generateCreditDailySummary;
    window.calculateCreditEvolution = calculateCreditEvolution;
    window.detectCreditAnomalies = detectCreditAnomalies;
    
    console.log('✅ CreditAnalyzer exposé globalement');
}
export default {
  analyzeCredit,
  createCreditAnalysisContent,
  generateCreditDailySummary,
  calculateCreditEvolution,
  detectCreditAnomalies,
  initializeCreditTabs,
  initializeCreditAlertBadges
};