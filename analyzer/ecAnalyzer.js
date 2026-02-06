// analyzer/ecAnalyzer.js
const EC_SEUILS = {
  CREDIT_NUL: 1,
  ENERGIE_EPUISEE: 1,
  SURCHARGE: 1,
  PUISSANCE_DEPASSEE: 1
};

// ======================== UTILITAIRES ========================
const normalizeDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return dateStr;
  return dateStr.replace(/(\d{2})\/(\d{2})\/(\d{2})/, (match, day, month, year) => 
    `${day}/${month}/20${year}`
  );
};

const formatTime = (heure, minute) => {
  return `${String(heure).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const convertHexYear = (hexYear) => {
  const decimalYear = parseInt(hexYear, 16);
  return 2000 + decimalYear;
};

const formatDisplayDate = (hexDate) => {
  const [dayHex, monthHex, yearHex] = hexDate.split('/');
  
  const day = parseInt(dayHex, 10);
  const month = parseInt(monthHex, 10);
  const year = 2000 + parseInt(yearHex, 10);
  
  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
};

const hexDateToISODate = (hexDate) => {
  const [dayHex, monthHex, yearHex] = hexDate.split('/');
  
  const day = parseInt(dayHex, 10);
  const month = parseInt(monthHex, 10);
  const year = 2000 + parseInt(yearHex, 10);
  
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

// ======================== ANALYSE EC ========================
export function analyzeEC(input) {
  if (!input) return [];

  const cleaned = input
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const bytes = cleaned.split(/[\s,]+/).filter(b => b.length > 0);
  const results = [];
  let sequencesFound = 0;
  let validSequences = 0;

  console.log('🔍 [EC] Début analyse -', bytes.length, 'bytes');

  // Vérification du format
  if (bytes.length < 2) {
    throw new Error("Fichier trop court - doit contenir au moins 2 octets");
  }

  const firstTwoBytes = bytes.slice(0, 2).join(" ");
  if (firstTwoBytes !== "13 E0" && bytes[0] !== "E0") {
    throw new Error(`Format invalide - début du fichier: "${firstTwoBytes}" au lieu de "13 E0" ou "E0"`);
  }

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];

    if (b === "E3" || b === "D3") {
      sequencesFound++;

      if (i + 9 >= bytes.length) {
        console.warn("❌ [EC] Séquence incomplète après", b, "à la position", i);
        continue;
      }

      const sequence = bytes.slice(i + 1, i + 10);

      if (sequence.includes("E6") || sequence.includes("D6")) {
        console.warn("❌ [EC] Séquence invalide contenant E6/D6 après", b);
        continue;
      }

      const [a, b1, c, h1, h2, client, etat, fort, faible] = sequence;

      if (a === "FF" && b1 === "FF" && c === "FF") {
        console.warn("❌ [EC] Séquence ignorée (FF FF FF)");
        continue;
      }

      if (!isValidHex(a) || !isValidHex(b1) || !isValidHex(c) ||
        !isValidHex(h1) || !isValidHex(h2) || !isValidHex(client) ||
        !isValidHex(etat) || !isValidHex(fort) || !isValidHex(faible)) {
        console.warn("❌ [EC] Séquence contenant des valeurs hexadécimales invalides");
        continue;
      }

      validSequences++;

      const dateHex = `${a}/${b1}/${c}`;
      const dateDisplay = formatDisplayDate(dateHex);
      const heure = `${h1}:${h2}`;
      const etatBin = parseInt(etat, 16).toString(2).padStart(8, '0');
      const analyse = analyseEtatEC(etatBin);
      const isoDate = hexDateToISODate(dateHex);

      results.push({
        dateHex,
        date: dateDisplay,
        heure,
        client: parseInt(client, 16),
        etat,
        etatBin,
        analyse,
        fort,
        faible,
        sequenceIndex: sequencesFound,
        isoDate,
        hasCreditNul: analyse.includes("Crédit Nul"),
        hasEnergieEpuisee: analyse.includes("Énergie Épuisée"),
        hasSurcharge: analyse.includes("Surcharge"),
        hasPuissanceDepassee: analyse.includes("Puissance Dépassée"),
        timestamp: new Date(isoDate + 'T' + heure.replace(':', ':')).getTime()
      });

      i += 9;
    }
  }

  if (sequencesFound === 0) {
    throw new Error("Aucune séquence E3 ou D3 trouvée dans le fichier");
  }

  // Tri chronologique
  const sortedResults = results.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`✅ [EC] Analyse terminée: ${sortedResults.length} événements trouvés`);
  
  if (sortedResults.length > 0) {
    console.log('📋 [EC] Échantillon des premières lignes:');
    sortedResults.slice(0, 10).forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.date} ${row.heure} - Client ${row.client} - ${row.analyse.join(', ')}`);
    });
  }

  return sortedResults;
}

function isValidHex(value) {
  return /^[0-9A-F]{2}$/.test(value);
}

function analyseEtatEC(bin) {
  const bits = bin.split('').reverse();
  let states = [];
  
  if (bits[1] === "1") states.push("Crédit Nul");
  if (bits[2] === "1") states.push("Énergie Épuisée");
  if (bits[3] === "1") states.push("Surcharge");
  if (bits[4] === "1") states.push("Puissance Dépassée");
  
  return states;
}

// ======================== CALCULS EC ========================
export const generateECDailySummary = (results) => {
  if (!results || !results.length) {
    console.warn('❌ [EC] Aucune donnée pour générer le résumé journalier');
    return [];
  }

  const dailyMap = results.reduce((acc, r) => {
    if (!acc[r.date]) {
      acc[r.date] = {
        date: r.date,
        isoDate: r.isoDate,
        evenements: [],
        clients: new Set(),
        stats: {
          "Crédit Nul": 0,
          "Énergie Épuisée": 0,
          "Surcharge": 0,
          "Puissance Dépassée": 0
        },
        alertesParType: {
          "Crédit Nul": [],
          "Énergie Épuisée": [],
          "Surcharge": [],
          "Puissance Dépassée": []
        },
        periodesParType: {
          "Crédit Nul": { debut: null, fin: null, heures: [] },
          "Énergie Épuisée": { debut: null, fin: null, heures: [] },
          "Surcharge": { debut: null, fin: null, heures: [] },
          "Puissance Dépassée": { debut: null, fin: null, heures: [] }
        }
      };
    }
    
    acc[r.date].evenements.push(r);
    acc[r.date].clients.add(r.client);
    
    r.analyse.forEach(alerte => {
      acc[r.date].stats[alerte]++;
      acc[r.date].alertesParType[alerte].push({
        type: alerte,
        heure: r.heure,
        client: r.client
      });
      
      // Mise à jour des périodes pour chaque type d'alerte
      const periode = acc[r.date].periodesParType[alerte];
      periode.heures.push(r.heure);
      
      if (!periode.debut || r.heure < periode.debut) {
        periode.debut = r.heure;
      }
      if (!periode.fin || r.heure > periode.fin) {
        periode.fin = r.heure;
      }
    });
    
    return acc;
  }, {});

  const summary = Object.values(dailyMap).map(d => {
    const totalAlertes = Object.values(d.stats).reduce((sum, count) => sum + count, 0);
    
    // Calcul des périodes formatées pour chaque type
    const periodesFormatees = {};
    Object.entries(d.periodesParType).forEach(([type, periode]) => {
      if (periode.debut && periode.fin) {
        periodesFormatees[type] = `${periode.debut} - ${periode.fin}`;
      } else {
        periodesFormatees[type] = '-';
      }
    });
    
    return {
      date: d.date,
      isoDate: d.isoDate,
      evenementsTotal: d.evenements.length,
      clientsTotal: d.clients.size,
      totalAlertes: totalAlertes,
      stats: d.stats,
      alertesParType: d.alertesParType,
      periodes: periodesFormatees
    };
  });

  // Tri chronologique
  const sortedSummary = summary.sort((a, b) => {
    return new Date(a.isoDate) - new Date(b.isoDate);
  });

  console.log(`📊 [EC] Résumé journalier: ${sortedSummary.length} jours`);
  return sortedSummary;
};

export const generateECGlobalStats = (results, daily) => {
  if (!results || !results.length) {
    return {
      totalEvenements: 0,
      totalJours: 0,
      statsGlobales: {
        "Crédit Nul": 0,
        "Énergie Épuisée": 0,
        "Surcharge": 0,
        "Puissance Dépassée": 0
      },
      joursAvecAlerte: 0,
      clientsUniques: new Set()
    };
  }

  const statsGlobales = {
    "Crédit Nul": 0,
    "Énergie Épuisée": 0,
    "Surcharge": 0,
    "Puissance Dépassée": 0
  };

  const clientsUniques = new Set();
  let joursAvecAlerte = 0;

  results.forEach(r => {
    clientsUniques.add(r.client);
    r.analyse.forEach(alerte => {
      statsGlobales[alerte]++;
    });
  });

  daily.forEach(d => {
    if (d.totalAlertes > 0) {
      joursAvecAlerte++;
    }
  });

  return {
    totalEvenements: results.length,
    totalJours: daily.length,
    statsGlobales,
    joursAvecAlerte,
    clientsUniques: clientsUniques.size,
    pourcentageJoursAvecAlertes: daily.length > 0 ? (joursAvecAlerte / daily.length * 100).toFixed(1) : 0
  };
};
function createECGlobalDashboard(globalStats, daily) {
  const { totalEvenements, totalJours, statsGlobales, joursAvecAlerte, clientsUniques, pourcentageJoursAvecAlertes } = globalStats;

  return `
    <div class="ec-dashboard-global">
      <h5>📊 Tableau de Bord Global</h5>
      <div class="ec-stats-cards">
        <div class="ec-stat-card">
          <div class="ec-stat-icon">📅</div>
          <div class="ec-stat-content">
            <div class="ec-stat-value">${totalJours}</div>
            <div class="ec-stat-label">Jours analysés</div>
          </div>
        </div>
        
        <div class="ec-stat-card">
          <div class="ec-stat-icon">⚡</div>
          <div class="ec-stat-content">
            <div class="ec-stat-value">${totalEvenements}</div>
            <div class="ec-stat-label">Événements total</div>
          </div>
        </div>
        
        <div class="ec-stat-card">
          <div class="ec-stat-icon">👥</div>
          <div class="ec-stat-content">
            <div class="ec-stat-value">${clientsUniques}</div>
            <div class="ec-stat-label">Clients uniques</div>
          </div>
        </div>
        
        <div class="ec-stat-card">
          <div class="ec-stat-icon">🚨</div>
          <div class="ec-stat-content">
            <div class="ec-stat-value">${joursAvecAlerte}</div>
            <div class="ec-stat-label">Jours avec alertes</div>
            <div class="ec-stat-sub">${pourcentageJoursAvecAlertes}%</div>
          </div>
        </div>
      </div>

      <div class="ec-alerts-summary">
        <h6>📈 Répartition des point d'Alertes</h6>
        <div class="ec-alerts-grid">
          <div class="ec-alert-type credit-nul">
            <span class="ec-alert-icon">💰</span>
            <span class="ec-alert-label">Crédit Nul</span>
            <span class="ec-alert-count">${statsGlobales["Crédit Nul"]}</span>
          </div>
          <div class="ec-alert-type energie-epuisee">
            <span class="ec-alert-icon">🔋</span>
            <span class="ec-alert-label">Énergie Épuisée</span>
            <span class="ec-alert-count">${statsGlobales["Énergie Épuisée"]}</span>
          </div>
          <div class="ec-alert-type surcharge">
            <span class="ec-alert-icon">⚡</span>
            <span class="ec-alert-label">Surcharge</span>
            <span class="ec-alert-count">${statsGlobales["Surcharge"]}</span>
          </div>
          <div class="ec-alert-type puissance-depassee">
            <span class="ec-alert-icon">📈</span>
            <span class="ec-alert-label">Puissance Dépassée</span>
            <span class="ec-alert-count">${statsGlobales["Puissance Dépassée"]}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export const calculateECEvolution = (results) => {
  if (!results || !results.length) {
    console.warn('❌ [EC] Aucune donnée pour calculer l évolution');
    return [];
  }

  const evolution = results.map((current, index, array) => {
    let changement = 'stable';
    let variation = '';
    
    if (index > 0) {
      const previous = array[index - 1];
      
      // Détection des changements d'état
      const changements = [];
      
      if (!previous.hasCreditNul && current.hasCreditNul) {
        changements.push('début Crédit Nul');
      } else if (previous.hasCreditNul && !current.hasCreditNul) {
        changements.push('fin Crédit Nul');
      }
      
      if (!previous.hasEnergieEpuisee && current.hasEnergieEpuisee) {
        changements.push('début Énergie Épuisée');
      } else if (previous.hasEnergieEpuisee && !current.hasEnergieEpuisee) {
        changements.push('fin Énergie Épuisée');
      }
      
      if (!previous.hasSurcharge && current.hasSurcharge) {
        changements.push('début Surcharge');
      } else if (previous.hasSurcharge && !current.hasSurcharge) {
        changements.push('fin Surcharge');
      }
      
      if (!previous.hasPuissanceDepassee && current.hasPuissanceDepassee) {
        changements.push('début Puissance Dépassée');
      } else if (previous.hasPuissanceDepassee && !current.hasPuissanceDepassee) {
        changements.push('fin Puissance Dépassée');
      }
      
      if (changements.length > 0) {
        changement = changements.join(' + ');
        variation = changements.map(c => {
          if (c.includes('début')) return `🟡 ${c}`;
          if (c.includes('fin')) return `🟢 ${c}`;
          return c;
        }).join(' | ');
      }
    }

    return {
      date: current.date,
      heure: current.heure,
      client: current.client,
      etat: current.analyse.join(', '),
      changement: changement,
      variation: variation,
      tensionFort: current.fort,
      tensionFaible: current.faible
    };
  });

  console.log(`📈 [EC] Évolution calculée: ${evolution.length} points`);
  return evolution;
};

// ======================== ALERTES EC ========================
export const detectECAnomalies = (results, daily) => {
  const alerts = [];

  if (!daily.length) {
    console.warn('⚠️ [EC] Aucune donnée quotidienne pour détecter les anomalies');
    return alerts;
  }

  // Alertes basées sur le résumé journalier
  daily.forEach(d => {
    // Alerte crédit nul fréquent
    if (d.stats["Crédit Nul"] >= EC_SEUILS.CREDIT_NUL) {
      alerts.push({
        type: 'warning',
        icon: '💰',
        title: 'Crédit Nul détecté',
        message: `${d.stats["Crédit Nul"]} occurrence(s) de crédit nul`,
        date: d.date
      });
    }
    
    // Alerte énergie épuisée
    if (d.stats["Énergie Épuisée"] >= EC_SEUILS.ENERGIE_EPUISEE) {
      alerts.push({
        type: 'danger',
        icon: '🔋',
        title: 'Énergie Épuisée',
        message: `${d.stats["Énergie Épuisée"]} occurrence(s) d'énergie épuisée`,
        date: d.date
      });
    }
    
    // Alerte surcharge
    if (d.stats["Surcharge"] >= EC_SEUILS.SURCHARGE) {
      alerts.push({
        type: 'danger',
        icon: '⚡',
        title: 'Surcharge détectée',
        message: `${d.stats["Surcharge"]} occurrence(s) de surcharge`,
        date: d.date
      });
    }
    
    // Alerte puissance dépassée
    if (d.stats["Puissance Dépassée"] >= EC_SEUILS.PUISSANCE_DEPASSEE) {
      alerts.push({
        type: 'warning',
        icon: '📈',
        title: 'Puissance Dépassée',
        message: `${d.stats["Puissance Dépassée"]} occurrence(s) de puissance dépassée`,
        date: d.date
      });
    }
    
    // Alerte journée avec nombreux événements
    if (d.totalAlertes > 10) {
      alerts.push({
        type: 'info',
        icon: '📊',
        title: 'Nombreux événements',
        message: `${d.totalAlertes} alertes détectées ce jour`,
        date: d.date
      });
    }
  });

  // Alertes basées sur les données brutes
  let creditNulDebut = null;
  let energieEpuiseeDebut = null;
  
  results.forEach((current, index) => {
    // Détection des durées d'alertes longues
    if (current.hasCreditNul && !creditNulDebut) {
      creditNulDebut = current;
    } else if (!current.hasCreditNul && creditNulDebut) {
      const duree = calculateDureeEC(creditNulDebut.heure, current.heure);
      if (duree > 60) { // 1 heure
        alerts.push({
          type: 'danger',
          icon: '⏱️',
          title: 'Crédit Nul longue durée',
          message: `Crédit nul pendant ${duree} minutes (${creditNulDebut.heure} → ${current.heure})`,
          date: current.date
        });
      }
      creditNulDebut = null;
    }
    
    if (current.hasEnergieEpuisee && !energieEpuiseeDebut) {
      energieEpuiseeDebut = current;
    } else if (!current.hasEnergieEpuisee && energieEpuiseeDebut) {
      const duree = calculateDureeEC(energieEpuiseeDebut.heure, current.heure);
      if (duree > 30) { // 30 minutes
        alerts.push({
          type: 'danger',
          icon: '⏱️',
          title: 'Énergie Épuisée longue durée',
          message: `Énergie épuisée pendant ${duree} minutes (${energieEpuiseeDebut.heure} → ${current.heure})`,
          date: current.date
        });
      }
      energieEpuiseeDebut = null;
    }
  });

  console.log(`🚨 [EC] Alertes détectées: ${alerts.length}`);
  return alerts;
};

function calculateDureeEC(heureDebut, heureFin) {
  const [h1, m1] = heureDebut.split(':').map(Number);
  const [h2, m2] = heureFin.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

// ======================== DÉTERMINATION STATUT ========================
function determineECStatut(stats) {
  if (stats["Énergie Épuisée"] > 0) {
    return {
      statut: 'Énergie Épuisée',
      icone: '🔋',
      couleur: '#e53e3e',
      description: 'Énergie épuisée détectée'
    };
  }

  if (stats["Surcharge"] > 0) {
    return {
      statut: 'Surcharge',
      icone: '⚡',
      couleur: '#7c3aed',
      description: 'Surcharge détectée'
    };
  }

  if (stats["Crédit Nul"] > 0) {
    return {
      statut: 'Crédit Nul',
      icone: '💰',
      couleur: '#d69e2e',
      description: 'Crédit nul détecté'
    };
  }

  if (stats["Puissance Dépassée"] > 0) {
    return {
      statut: 'Puissance Dépassée',
      icone: '📈',
      couleur: '#3182ce',
      description: 'Puissance dépassée détectée'
    };
  }

  return {
    statut: 'Normal',
    icone: '✅',
    couleur: '#38a169',
    description: 'Aucune alerte détectée'
  };
}

// ======================== COMPOSANTS HTML ========================
// ======================== COMPOSANTS HTML - AMÉLIORÉS ========================
function createECStatsHTML(daily, results) {
  if (!daily.length) return '<p class="no-data">Aucune donnée EC disponible</p>';

  const globalStats = generateECGlobalStats(results, daily);

  // SUPPRIMER l'appel à createECGlobalDashboard ici
  // Le tableau de bord est maintenant affiché uniquement en haut de la section

  return `
    <div class="ec-detailed-stats">
      <h5>📋 Statistiques Détaillées</h5>
      <div class="stats-grid">
        <div><strong>Jours analysés</strong><br>${globalStats.totalJours}</div>
        <div><strong>Événements totaux</strong><br>${globalStats.totalEvenements}</div>
        <div><strong>Crédits Nuls</strong><br>${globalStats.statsGlobales["Crédit Nul"]}</div>
        <div><strong>Énergies Épuisées</strong><br>${globalStats.statsGlobales["Énergie Épuisée"]}</div>
        <div><strong>Surcharges</strong><br>${globalStats.statsGlobales["Surcharge"]}</div>
        <div><strong>Puissances Dépassées</strong><br>${globalStats.statsGlobales["Puissance Dépassée"]}</div>
      </div>
    </div>
    
    <div class="statuts-repartition">
      <h5>Répartition des jours :</h5>
      <div class="statuts-grid">
        <div class="statut-item" style="color: #38a169;">
          <span style="font-size: 20px;">✅</span> Jours normaux: ${globalStats.totalJours - globalStats.joursAvecAlerte}
        </div>
        <div class="statut-item" style="color: #d69e2e;">
          <span style="font-size: 20px;">⚠️</span> Jours avec alertes: ${globalStats.joursAvecAlerte}
        </div>
        <div class="statut-item" style="color: #3182ce;">
          <span style="font-size: 20px;">📊</span> Taux d'alertes: ${globalStats.pourcentageJoursAvecAlertes}%
        </div>
      </div>
    </div>`;
}

function createECAlertsHTML(alerts) {
  if (!alerts.length) return '<p style="color:#48bb78">✅ Fonctionnement normal - Aucune alerte</p>';

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

// Fonction pour obtenir la plage d'heures d'un type d'alerte
function getTimeRangeEC(alertes) {
  if (alertes.length === 0) return '';

  const heures = alertes.map(a => a.heure).sort();
  const premiere = heures[0];
  const derniere = heures[heures.length - 1];

  return `de ${premiere} à ${derniere}`;
}

// Fonction pour créer un tableau EC
function createECTable(data, columns, title, results = []) {
  if (!data || !data.length) {
    return `<div class="no-data">📊 Aucune donnée EC disponible pour "${title}"</div>`;
  }

  // Ajouter la numérotation
  const dataWithNumbers = data.map((item, index) => ({
    '#': index + 1,
    ...item
  }));

  const finalColumns = columns.includes('#') ? columns : ['#', ...columns];

  return `
    <div class="table-container">
      <h4>${title}</h4>
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
              } else if (row.stats) {
                statutInfo = determineECStatut(row.stats);
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

                    // Périodes des alertes
                    if (col === 'periodes') {
                      const periodesHTML = Object.entries(row.periodes || {})
                        .filter(([type, periode]) => periode !== '-')
                        .map(([type, periode]) => `
                          <div style="margin: 2px 0; font-size: 0.8rem;">
                            <strong>${type}:</strong> ${periode}
                          </div>
                        `).join('');
                      return `<td style="font-size: 0.8rem;">${periodesHTML || '-'}</td>`;
                    }

                    // Style pour les états
                    if (col === 'analyse' || col === 'etat') {
                      const badges = value.split(', ').map(v => {
                        let badgeClass = 'badge-info';
                        if (v.includes('Crédit Nul')) badgeClass = 'badge-warning';
                        else if (v.includes('Énergie Épuisée')) badgeClass = 'badge-error';
                        else if (v.includes('Surcharge')) badgeClass = 'badge-purple';
                        else if (v.includes('Puissance Dépassée')) badgeClass = 'badge-primary';
                        
                        return `<span class="badge ${badgeClass}">${v}</span>`;
                      }).join(' ');
                      
                      return `<td>${badges}</td>`;
                    }

                    if (col === 'changement') {
                      const color = value.includes('début') ? '#e53e3e' : 
                                   value.includes('fin') ? '#38a169' : '#4a5568';
                      return `<td style="color: ${color}; font-weight: bold;">${value}</td>`;
                    }

                    if (col === 'variation') {
                      return `<td style="font-weight: bold;">${value}</td>`;
                    }

                    // Tooltip pour l'état binaire
                    if (col === 'etatBin' && row.etat) {
                      return `<td>
                        <span class="tooltip">${value}
                          <span class="tooltip-text">Hex: ${row.etat}<br>Bin: ${value}</span>
                        </span>
                      </td>`;
                    }

                    // Stats journalières
                    if (col === 'stats') {
                      const statsHTML = Object.entries(row.stats || {})
                        .filter(([key, count]) => count > 0)
                        .map(([key, count]) => `<span class="badge badge-${getAlertClassEC(key)}">${key}: ${count}</span>`)
                        .join(' ');
                      return `<td>${statsHTML}</td>`;
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

function getAlertClassEC(alertType) {
  const classes = {
    "Crédit Nul": "warning",
    "Énergie Épuisée": "error",
    "Surcharge": "purple",
    "Puissance Dépassée": "primary"
  };
  return classes[alertType] || "info";
}

function createECFileSectionHTML(file, results, daily, evolution, alerts) {
  const id = file.name.replace(/[^a-zA-Z0-9]/g, '_');

  // Stocker les résultats dans l'objet global
  if (!window.ecResults) window.ecResults = {};
  window.ecResults[id] = results;

  console.log(`[EC] Création section pour: ${file.name}`);

  // Générer les stats globales
  const globalStats = generateECGlobalStats(results, daily);

  // Préparer les données journalières avec les statuts
  const dailyWithStatuts = daily.map(d => {
    const statutInfo = determineECStatut(d.stats);
    return {
      ...d,
      statut: statutInfo
    };
  });

  return `
    <div class="ec-file-section" data-file-id="${id}">
      <div class="file-header">
        <h4>Document ${file.name}</h4>
        ${file.client ? `<div class="client-badge">Client: ${file.client}</div>` : ''}
        <div class="forfait-badge">Type: Évènements Clients</div>
        <div class="data-stats">
          ${results.length} événements analysés |
          ${daily.length} jours avec données |
          ${evolution.filter(e => e.changement !== 'stable').length} changements d'état
        </div>
      </div>

      <!-- TABLEAU DE BORD GLOBAL -->
      <div class="ec-global-dashboard-container">
        ${createECGlobalDashboard(globalStats, daily)}
      </div>

      <div class="ec-tabs-container">
        <div class="ec-tabs-header">
          <button class="ec-tab active" data-tab="ec-day-${id}">Journalière</button>
          <button class="ec-tab" data-tab="ec-evol-${id}">Évolution</button>
          <button class="ec-tab" data-tab="ec-stats-${id}">Stats</button>
          <button class="ec-tab" data-tab="ec-alerts-${id}">
            Alertes${alerts.length ? `<span class="tab-badge">${alerts.length}</span>` : ''}
          </button>
        </div>

        <!-- Onglet Journalière -->
        <div class="ec-tab-content active" id="ec-day-${id}">
          ${createECTable(
            dailyWithStatuts.map(d => ({
              date: d.date,
              evenements: d.evenementsTotal,
              clients: d.clientsTotal,
              totalAlertes: d.totalAlertes,
              stats: d.stats,
              periodes: d.periodes,
              statut: d.statut
            })),
            ['date', 'evenements', 'clients', 'totalAlertes', 'stats', 'periodes', 'statut'],
            'Résumé Journalier EC',
            results
          )}
        </div>
      
        <!-- Onglet Évolution -->
        <div class="ec-tab-content" id="ec-evol-${id}">
          ${createECTable(
            evolution.filter(e => e.changement !== 'stable').map(e => ({
              date: e.date,
              heure: e.heure,
              client: e.client,
              etat: e.etat,
              changement: e.changement,
              variation: e.variation
            })),
            ['date', 'heure', 'client', 'etat', 'changement', 'variation'],
            'Évolution des États EC',
            results
          )}
        </div>
      
        <!-- Onglet Détail -->
        <div class="ec-tab-content" id="ec-detail-${id}">
          ${createECTable(
            results.map(r => ({
              date: r.date,
              heure: r.heure,
              client: r.client,
              etat: r.etat,
              etatBin: r.etatBin,
              analyse: r.analyse.join(', '),
              fort: r.fort,
              faible: r.faible,
              sequence: r.sequenceIndex
            })),
            ['date', 'heure', 'client', 'etat', 'etatBin', 'analyse', 'fort', 'faible', 'sequence'],
            'Données Brutes EC',
            results
          )}
        </div>
      
        <!-- Onglet Stats -->
        <div class="ec-tab-content" id="ec-stats-${id}">
          ${createECStatsHTML(daily, results)}
        </div>
      
        <!-- Onglet Alertes -->
        <div class="ec-tab-content" id="ec-alerts-${id}">
          ${createECAlertsHTML(alerts)}
        </div>
      </div>
    </div>`;
}

// ======================== INITIALISATION PRINCIPALE ========================
export function createECAnalysisContent(files) {
  if (!files?.length) return '<p class="no-data">Aucun fichier EC</p>';

  loadECCSS();
  window.ecResults = {};

  const html = files.map(file => {
    console.log(`🔍 [EC] Analyse du fichier: ${file.name}`);

    const results = analyzeEC(file.content);
    const daily = generateECDailySummary(results);
    const evolution = calculateECEvolution(results);
    const alerts = detectECAnomalies(results, daily);

    return createECFileSectionHTML(file, results, daily, evolution, alerts);
  }).join('');

  // Initialisation différée
  setTimeout(() => {
    initializeECTabs();
    initializeECAlertBadges();
  }, 300);

  return html;
}

// ======================== GESTION DE L'UI ========================
export function initializeECTabs() {
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.ec-tab');
    if (!tab) return;

    const targetId = tab.dataset.tab;
    const container = tab.closest('.ec-tabs-container');

    // Désactiver tous les tabs et contenus
    container.querySelectorAll('.ec-tab').forEach(t => t.classList.remove('active'));
    container.querySelectorAll('.ec-tab-content').forEach(c => c.classList.remove('active'));

    // Activer le tab sélectionné
    tab.classList.add('active');
    document.getElementById(targetId)?.classList.add('active');
  });
}

export function initializeECAlertBadges() {
  document.querySelectorAll('.ec-file-section').forEach(section => {
    const key = section.querySelector('h4')
      ?.textContent.replace(/Document /, '')
      .replace(/[^a-zA-Z0-9]/g, '_');

    const results = window.ecResults?.[key];
    if (!results) return;

    const alerts = detectECAnomalies(results, generateECDailySummary(results));
    const badge = section.querySelector('.ec-tab[data-tab^="ec-alerts"] .tab-badge');

    if (badge) {
      badge.textContent = alerts.length;
      badge.style.display = alerts.length ? 'inline' : 'none';
    }
  });
}

// ======================== UTILITAIRES GLOBAUX ========================
function loadECCSS() {
  if (document.querySelector('link[href*="ecAnalyzer.css"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './analyzer/ecAnalyzer.css';
  document.head.appendChild(link);
}

// ======================== EXPORT PAR DÉFAUT ========================
export default {
  analyzeEC,
  createECAnalysisContent,
  generateECDailySummary,
  calculateECEvolution,
  detectECAnomalies,
  initializeECTabs,
  initializeECAlertBadges
};