// analyzer/enrAnalyzer.js
const ENR_SEUILS = {
  DT_SEUIL: 3,    // Seuil pour alerte délestage total
  DP_SEUIL: 5,    // Seuil pour alerte délestage partiel
  DUREE_ALERTE: 30 // Minutes pour alerte de durée
};

// ======================== UTILITAIRES ========================
const normalizeDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return dateStr;
  return dateStr.replace(/(\d{2})\/(\d{2})\/(\d{2})/, (match, day, month, year) =>
    `${day}/${month}/20${year}`
  );
};

const formatTime = (heure, minute) => {
  return `${String(heure).padStart(2, '0')}h${String(minute).padStart(2, '0')}`;
};

// Fonction pour calculer la durée totale en minutes d'une série d'heures
const calculateDureeTotale = (heures) => {
  if (!heures || heures.length === 0) return 0;
  
  // Convertir toutes les heures en minutes depuis minuit
  const minutesArray = heures.map(heureStr => {
    const [h, m] = heureStr.split('h').map(Number);
    return h * 60 + m;
  });
  
  // Trier les minutes
  minutesArray.sort((a, b) => a - b);
  
  // Calculer la durée totale en minutes
  let dureeTotale = 0;
  let debutPeriode = minutesArray[0];
  
  for (let i = 1; i < minutesArray.length; i++) {
    // Si l'écart est supérieur à 15 minutes, considérer une nouvelle période
    if (minutesArray[i] - minutesArray[i-1] > 15) {
      dureeTotale += (minutesArray[i-1] - debutPeriode);
      debutPeriode = minutesArray[i];
    }
  }
  
  // Ajouter la dernière période
  dureeTotale += (minutesArray[minutesArray.length - 1] - debutPeriode);
  
  return dureeTotale;
};

// Fonction pour calculer la durée moyenne par événement
const calculateDureeMoyenne = (dureeTotaleMinutes, nombreEvenements) => {
  if (nombreEvenements === 0) return 0;
  return Math.round(dureeTotaleMinutes / nombreEvenements);
};

// ======================== ANALYSE ENR ========================
export function analyzeENR(input) {
  if (!input) return [];

  const cleaned = input
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const bytes = cleaned.split(/[\s,]+/).filter(b => b);
  const results = [];
  let i = 0, blocCounter = 1;

  console.log('🔍 [ENR] Début analyse -', bytes.length, 'bytes');

  while (i < bytes.length) {
    const cmd = bytes[i];

    // Ignorer les commandes non-D3
    if (['D0', 'D1', 'D4', 'D6'].includes(cmd) && i + 7 < bytes.length) {
      i += 8;
      continue;
    }
    if (cmd === '3F' && i + 7 < bytes.length && ['D0', 'D6'].includes(bytes[i + 1])) {
      i += 8;
      continue;
    }
    if (cmd === '13' && i + 7 < bytes.length && ['D0', 'D1', 'D4', 'D6'].includes(bytes[i + 1])) {
      i += 8;
      continue;
    }
    if (cmd === 'D2' && i + 5 < bytes.length) {
      i += 6;
      continue;
    }
    if (cmd === 'FF') {
      i++;
      continue;
    }

    // Traitement des blocs D3
    if (cmd === 'D3' && i + 65 <= bytes.length) {
      for (let b = 0; b < 8; b++) {
        const start = i + 1 + b * 8;
        const block = bytes.slice(start, start + 8);

        if (isValidENRDataBlock(block)) {
          const [d, m, y, h, min, state, fort, faible] = block;

          const dateStr = normalizeDate(`${d}/${m}/${y}`);
          const heureStr = formatTime(h, min);
          const etatDecimal = parseInt(state, 16);
          const etatBinaire = etatDecimal.toString(2).padStart(8, '0');
          const analyse = analyzeENRState(etatDecimal);

          results.push({
            date: dateStr,
            heure: heureStr,
            etat: state,
            etatBin: etatBinaire,
            analyse: analyse,
            fort: fort,
            faible: faible,
            bloc: blocCounter,
            timestamp: new Date(2000 + parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min)).getTime(),
            hasDT: analyse.includes('DT'),
            hasDP: analyse.includes('DP'),
            hasECO: analyse.includes('ECO')
          });
        }
      }
      blocCounter++;
      i += 65;
    } else {
      i++;
    }
  }

  // Tri chronologique
  const sortedResults = results.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`✅ [ENR] Analyse terminée: ${sortedResults.length} lignes générées`);

  if (sortedResults.length > 0) {
    console.log('📋 [ENR] Échantillon des premières lignes:');
    sortedResults.slice(0, 10).forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.date} ${row.heure} - ${row.analyse}`);
    });
  }

  return sortedResults;
}

function isValidENRDataBlock(block) {
  if (block.length < 8) return false;
  if (block.slice(0, 6).includes('FF')) return false;
  if (block[5] === '00') return false;
  return block.slice(0, 6).every(b => /^[0-9A-F]{2}$/.test(b));
}

function analyzeENRState(etat) {
  const bits = etat.toString(2).padStart(8, '0').split('').reverse();
  const res = [];

  if (bits[0] === '1') res.push("ECO ON");
  if (bits[1] === '1') res.push("DT");
  if (bits[2] === '1') res.push("DP");

  return res.length ? res.join(' + ') : 'NORMAL';
}

// ======================== CALCULS ENR ========================
export const generateENRDailySummary = (results) => {
  if (!results || !results.length) {
    console.warn('❌ [ENR] Aucune donnée pour générer le résumé journalier');
    return [];
  }

  const dailyMap = results.reduce((acc, r) => {
    if (!acc[r.date]) {
      acc[r.date] = {
        date: r.date,
        releves: [],
        dtPeriods: [],
        dpPeriods: [],
        periodesParType: {
          "DT": { debut: null, fin: null, heures: [] },
          "DP": { debut: null, fin: null, heures: [] }
        }
      };
    }

    acc[r.date].releves.push(r);

    if (r.hasDT) {
      acc[r.date].dtPeriods.push(r.heure);
      const periode = acc[r.date].periodesParType["DT"];
      periode.heures.push(r.heure);
      if (!periode.debut || r.heure < periode.debut) periode.debut = r.heure;
      if (!periode.fin || r.heure > periode.fin) periode.fin = r.heure;
    }

    if (r.hasDP) {
      acc[r.date].dpPeriods.push(r.heure);
      const periode = acc[r.date].periodesParType["DP"];
      periode.heures.push(r.heure);
      if (!periode.debut || r.heure < periode.debut) periode.debut = r.heure;
      if (!periode.fin || r.heure > periode.fin) periode.fin = r.heure;
    }

    return acc;
  }, {});

  const summary = Object.values(dailyMap).map(d => {
    const dtCount = d.dtPeriods.length;
    const dpCount = d.dpPeriods.length;

    // Calcul des durées totales en minutes
    const dtDureeMinutes = calculateDureeTotale(d.dtPeriods);
    const dpDureeMinutes = calculateDureeTotale(d.dpPeriods);

    // Formatage des durées (minutes ou heures:minutes)
    const formatDuree = (minutes) => {
      if (minutes === 0) return '-';
      if (minutes < 60) return `${minutes} min`;
      const heures = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${heures}h${mins.toString().padStart(2, '0')}` : `${heures}h`;
    };

    // Calcul des périodes formatées (SEULEMENT DT et DP)
    const periodesFormatees = {};
    Object.entries(d.periodesParType).forEach(([type, periode]) => {
      if (periode.debut && periode.fin) {
        periodesFormatees[type] = `${periode.debut} - ${periode.fin}`;
      }
    });

    return {
      date: d.date,
      relevesTotal: d.releves.length,
      dtCount: dtCount,
      dtDuree: formatDuree(dtDureeMinutes),
      dtDureeMinutes: dtDureeMinutes,
      dpCount: dpCount,
      dpDuree: formatDuree(dpDureeMinutes),
      dpDureeMinutes: dpDureeMinutes,
      periodes: periodesFormatees
    };
  });

  // Tri chronologique
  const sortedSummary = summary.sort((a, b) => {
    const convertToComparableDate = (dateStr) => {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
    return convertToComparableDate(a.date).localeCompare(convertToComparableDate(b.date));
  });

  console.log(`📊 [ENR] Résumé journalier: ${sortedSummary.length} jours`);
  return sortedSummary;
};

// ======================== TABLEAU DE BORD GLOBAL ENR ========================
export const generateENRGlobalStats = (results, daily) => {
  if (!results || !results.length) {
    return {
      totalReleves: 0,
      totalJours: 0,
      statsGlobales: {
        "DT": 0,
        "DP": 0
      },
      dureesGlobales: {
        "DT": 0,
        "DP": 0
      },
      dureesMoyennes: {
        "DT": 0,
        "DP": 0
      },
      joursAvecDT: 0,
      joursAvecDP: 0,
      jourAvecPlusDT: { date: '', duree: 0 },
      jourAvecPlusDP: { date: '', duree: 0 }
    };
  }

  const statsGlobales = {
    "DT": 0,
    "DP": 0
  };

  const dureesGlobales = {
    "DT": 0,
    "DP": 0
  };

  let joursAvecDT = 0;
  let joursAvecDP = 0;
  let jourAvecPlusDT = { date: '', duree: 0 };
  let jourAvecPlusDP = { date: '', duree: 0 };

  results.forEach(r => {
    if (r.hasDT) statsGlobales["DT"]++;
    if (r.hasDP) statsGlobales["DP"]++;
  });

  daily.forEach(d => {
    if (d.dtCount > 0) {
      joursAvecDT++;
      dureesGlobales["DT"] += d.dtDureeMinutes;
      if (d.dtDureeMinutes > jourAvecPlusDT.duree) {
        jourAvecPlusDT = { date: d.date, duree: d.dtDureeMinutes };
      }
    }
    if (d.dpCount > 0) {
      joursAvecDP++;
      dureesGlobales["DP"] += d.dpDureeMinutes;
      if (d.dpDureeMinutes > jourAvecPlusDP.duree) {
        jourAvecPlusDP = { date: d.date, duree: d.dpDureeMinutes };
      }
    }
  });

  // Calcul des durées moyennes
  const dureesMoyennes = {
    "DT": joursAvecDT > 0 ? calculateDureeMoyenne(dureesGlobales["DT"], joursAvecDT) : 0,
    "DP": joursAvecDP > 0 ? calculateDureeMoyenne(dureesGlobales["DP"], joursAvecDP) : 0
  };

  // Formatage des durées globales
  const formatDureeGlobale = (minutes) => {
    if (minutes === 0) return '0 min';
    if (minutes < 60) return `${minutes} min`;
    const heures = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${heures}h${mins.toString().padStart(2, '0')}` : `${heures}h`;
  };

  return {
    totalReleves: results.length,
    totalJours: daily.length,
    statsGlobales,
    dureesGlobales: {
      "DT": formatDureeGlobale(dureesGlobales["DT"]),
      "DP": formatDureeGlobale(dureesGlobales["DP"])
    },
    dureesMoyennes: {
      "DT": formatDureeGlobale(dureesMoyennes["DT"]),
      "DP": formatDureeGlobale(dureesMoyennes["DP"])
    },
    dureesGlobalesMinutes: dureesGlobales,
    joursAvecDT,
    joursAvecDP,
    jourAvecPlusDT,
    jourAvecPlusDP,
    pourcentageJoursAvecDT: daily.length > 0 ? (joursAvecDT / daily.length * 100).toFixed(1) : 0,
    pourcentageJoursAvecDP: daily.length > 0 ? (joursAvecDP / daily.length * 100).toFixed(1) : 0
  };
};

export const calculateENREvolution = (results) => {
  if (!results || !results.length) {
    console.warn('❌ [ENR] Aucune donnée pour calculer l évolution');
    return [];
  }

  const evolution = results.map((current, index, array) => {
    let changement = 'stable';
    let variation = '';

    if (index > 0) {
      const previous = array[index - 1];

      // Détection des changements d'état
      if (!previous.hasDT && current.hasDT) {
        changement = 'début DT';
        variation = '🔴 DT démarré';
      } else if (previous.hasDT && !current.hasDT) {
        changement = 'fin DT';
        variation = '🟢 DT terminé';
      } else if (!previous.hasDP && current.hasDP) {
        changement = 'début DP';
        variation = '🟡 DP démarré';
      } else if (previous.hasDP && !current.hasDP) {
        changement = 'fin DP';
        variation = '🟢 DP terminé';
      }
    }

    return {
      date: current.date,
      heure: current.heure,
      etat: current.analyse,
      changement: changement,
      variation: variation,
      tensionFort: current.fort,
      tensionFaible: current.faible
    };
  });

  console.log(`📈 [ENR] Évolution calculée: ${evolution.length} points`);
  return evolution;
};

// ======================== ALERTES ENR ========================
export const detectENRAnomalies = (results, daily) => {
  const alerts = [];

  if (!daily.length) {
    console.warn('⚠️ [ENR] Aucune donnée quotidienne pour détecter les anomalies');
    return alerts;
  }

  // Alertes basées sur le résumé journalier
  daily.forEach(d => {
    // Alerte délestage total fréquent
    if (d.dtCount > ENR_SEUILS.DT_SEUIL) {
      alerts.push({
        type: 'danger',
        icon: '🔴',
        title: 'Délestage Total fréquent',
        message: `${d.dtCount} périodes DT (seuil: ${ENR_SEUILS.DT_SEUIL}) - Durée totale: ${d.dtDuree}`,
        date: d.date,
        severity: 'high'
      });
    }

    // Alerte délestage partiel fréquent
    if (d.dpCount > ENR_SEUILS.DP_SEUIL) {
      alerts.push({
        type: 'warning',
        icon: '🟡',
        title: 'Délestage Partiel fréquent',
        message: `${d.dpCount} périodes DP (seuil: ${ENR_SEUILS.DP_SEUIL}) - Durée totale: ${d.dpDuree}`,
        date: d.date,
        severity: 'medium'
      });
    }

    // Alerte durée DT excessive
    if (d.dtDureeMinutes > ENR_SEUILS.DUREE_ALERTE) {
      alerts.push({
        type: 'danger',
        icon: '⏱️',
        title: 'DT longue durée',
        message: `DT de ${d.dtDuree} (${d.dtDureeMinutes} min) - Seuil: ${ENR_SEUILS.DUREE_ALERTE} min`,
        date: d.date,
        severity: 'high'
      });
    }
  });

  // Alerte pour jour avec le plus long DT
  const globalStats = generateENRGlobalStats(results, daily);
  if (globalStats.jourAvecPlusDT.duree > 0) {
    alerts.push({
      type: 'info',
      icon: '📅',
      title: 'Journée record DT',
      message: `Plus long DT: ${globalStats.dureesGlobales["DT"]} le ${globalStats.jourAvecPlusDT.date}`,
      date: globalStats.jourAvecPlusDT.date,
      severity: 'low'
    });
  }

  console.log(`🚨 [ENR] Alertes détectées: ${alerts.length}`);
  return alerts.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
};

// ======================== DÉTERMINATION STATUT ========================
function determineENRStatut(dtCount, dpCount) {
  if (dtCount > 0 && dpCount > 0) {
    return {
      statut: `DT:${dtCount} DP:${dpCount}`,
      icone: '🔴🟡',
      couleur: '#e53e3e',
      description: `${dtCount} délestage(s) total, ${dpCount} délestage(s) partiel`,
      severity: 'high'
    };
  }

  if (dtCount > 0) {
    return {
      statut: `DT:${dtCount}`,
      icone: '🔴',
      couleur: '#e53e3e',
      description: `${dtCount} délestage(s) total`,
      severity: 'high'
    };
  }

  if (dpCount > 0) {
    return {
      statut: `DP:${dpCount}`,
      icone: '🟡',
      couleur: '#d69e2e',
      description: `${dpCount} délestage(s) partiel`,
      severity: 'medium'
    };
  }

  return {
    statut: 'Normal',
    icone: '✅',
    couleur: '#38a169',
    description: 'Fonctionnement normal',
    severity: 'low'
  };
}

// ======================== COMPOSANTS HTML - AMÉLIORÉS ========================
function createENRGlobalDashboard(globalStats, daily) {
  const { 
    totalReleves, 
    totalJours, 
    dureesGlobales, 
    dureesMoyennes,
    joursAvecDT, 
    joursAvecDP, 
    pourcentageJoursAvecDT, 
    pourcentageJoursAvecDP,
    jourAvecPlusDT,
    jourAvecPlusDP
  } = globalStats;

  return `
    <div class="enr-dashboard-global">
      <h5>📊 Tableau de Bord d'Evènement NR</h5>
      <div class="enr-stats-cards">
        <div class="enr-stat-card">
          <div class="enr-stat-icon">📅</div>
          <div class="enr-stat-content">
            <div class="enr-stat-value">${totalJours}</div>
            <div class="enr-stat-label">Jours analysés</div>
          </div>
        </div>
        
        <div class="enr-stat-card">
          <div class="enr-stat-icon">📈</div>
          <div class="enr-stat-content">
            <div class="enr-stat-value">${totalReleves}</div>
            <div class="enr-stat-label">Relèves totales</div>
          </div>
        </div>
        
        <div class="enr-stat-card">
          <div class="enr-stat-icon">🔴</div>
          <div class="enr-stat-content">
            <div class="enr-stat-value">${joursAvecDT}</div>
            <div class="enr-stat-label">Jours avec DT</div>
            <div class="enr-stat-sub">${pourcentageJoursAvecDT}%</div>
          </div>
        </div>
        
        <div class="enr-stat-card">
          <div class="enr-stat-icon">🟡</div>
          <div class="enr-stat-content">
            <div class="enr-stat-value">${joursAvecDP}</div>
            <div class="enr-stat-label">Jours avec DP</div>
            <div class="enr-stat-sub">${pourcentageJoursAvecDP}%</div>
          </div>
        </div>
      </div>

      <div class="enr-durees-summary">
        <h6>⏱️ Durées des Délestages</h6>
        <div class="enr-durees-grid">
          <div class="enr-duree-type dt">
            <span class="enr-duree-icon">🔴</span>
            <div class="enr-duree-content">
              <span class="enr-duree-label">Délestage Total(DT)</span>
              <span class="enr-duree-totale">${dureesGlobales["DT"]}</span>
              <span class="enr-duree-moyenne">Moyenne: ${dureesMoyennes["DT"]}</span>
            </div>
          </div>
          <div class="enr-duree-type dp">
            <span class="enr-duree-icon">🟡</span>
            <div class="enr-duree-content">
              <span class="enr-duree-label">Délestage Partiel(DP)</span>
              <span class="enr-duree-totale">${dureesGlobales["DP"]}</span>
              <span class="enr-duree-moyenne">Moyenne: ${dureesMoyennes["DP"]}</span>
            </div>
          </div>
        </div>
        
        <div class="enr-records">
          <div class="enr-record">
            <span class="enr-record-icon">📅</span>
            <span class="enr-record-text">Plus long DT: ${jourAvecPlusDT.date} (${dureesGlobales["DT"]})</span>
          </div>
          <div class="enr-record">
            <span class="enr-record-icon">📅</span>
            <span class="enr-record-text">Plus long DP: ${jourAvecPlusDP.date} (${dureesGlobales["DP"]})</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ======================== COMPOSANTS HTML ========================
function createENRStatsHTML(daily, results) {
  if (!daily.length) return '<p class="no-data">Aucune donnée ENR disponible</p>';

  const globalStats = generateENRGlobalStats(results, daily);

  return `
    <div class="enr-detailed-stats">
      <h5>📋 Statistiques Détaillées</h5>
      <div class="stats-grid">
        <div><strong>Jours analysés</strong><br>${globalStats.totalJours}</div>
        <div><strong>Relèves totales</strong><br>${globalStats.totalReleves}</div>
        <div><strong>Durée DT totale</strong><br>${globalStats.dureesGlobales["DT"]}</div>
        <div><strong>Durée DP totale</strong><br>${globalStats.dureesGlobales["DP"]}</div>
        <div><strong>Durée moyenne DT</strong><br>${globalStats.dureesMoyennes["DT"]}</div>
        <div><strong>Durée moyenne DP</strong><br>${globalStats.dureesMoyennes["DP"]}</div>
      </div>
    </div>
    
    <div class="statuts-repartition">
      <h5>📅 Répartition des jours :</h5>
      <div class="statuts-grid">
        <div class="statut-item" style="color: #38a169;">
          <span style="font-size: 20px;">✅</span> Jours normaux: ${globalStats.totalJours - globalStats.joursAvecDT - globalStats.joursAvecDP}
        </div>
        <div class="statut-item" style="color: #d69e2e;">
          <span style="font-size: 20px;">🟡</span> Jours avec DP: ${globalStats.joursAvecDP}
        </div>
        <div class="statut-item" style="color: #e53e3e;">
          <span style="font-size: 20px;">🔴</span> Jours avec DT: ${globalStats.joursAvecDT}
        </div>
      </div>
    </div>
    
    <div class="enr-seuils">
      <h5>🚨 Seuils d'alerte :</h5>
      <div class="seuils-grid">
        <div style="color: #e53e3e;">🔴 DT: > ${ENR_SEUILS.DT_SEUIL} périodes/jour</div>
        <div style="color: #d69e2e;">🟡 DP: > ${ENR_SEUILS.DP_SEUIL} périodes/jour</div>
        <div style="color: #3182ce;">⏱️ Durée DT: > ${ENR_SEUILS.DUREE_ALERTE} minutes</div>
      </div>
    </div>`;
}

function createENRAlertsHTML(alerts) {
  if (!alerts.length) return '<div class="no-alerts">✅ <strong>Aucune alerte détectée</strong><br><span style="font-size: 0.9em; color: #666;">Fonctionnement normal du système</span></div>';

  return `
    <div class="alerts-container">
      <div class="alerts-header">
        <h6>🚨 Alertes Détectées</h6>
        <span class="alerts-count">${alerts.length} alerte(s)</span>
      </div>
      <div class="alerts-list">
        ${alerts.map(alert => `
          <div class="alert alert-${alert.type} alert-${alert.severity}">
            <span class="alert-icon">${alert.icon}</span>
            <div class="alert-content">
              <div class="alert-title">${alert.title}</div>
              <div class="alert-message">${alert.message}</div>
              ${alert.date ? `<div class="alert-date">📅 ${alert.date}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

// Fonction pour créer un tableau ENR
function createENRTable(data, columns, title, results = []) {
  if (!data || !data.length) {
    return `<div class="no-data">📊 Aucune donnée ENR disponible pour "${title}"</div>`;
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
        <table class="data-table enr-table">
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
    } else if (row.dtCount !== undefined && row.dpCount !== undefined) {
      statutInfo = determineENRStatut(row.dtCount, row.dpCount);
    } else {
      statutInfo = { statut: 'N/A', icone: '⚪', couleur: '#718096' };
    }

    return `
                <tr class="enr-row ${row.dtCount > 0 ? 'dt-row' : row.dpCount > 0 ? 'dp-row' : 'normal-row'}">
                  ${finalColumns.map(col => {
      if (col === '#') {
        return `<td class="row-number">${row[col]}</td>`;
      }

      const value = row[col] !== undefined ? row[col] : '-';

      if (col === 'statut') {
        return `<td class="statut-cell">
                        <div class="statut-badge" style="border-color: ${statutInfo.couleur}; background: ${statutInfo.couleur}15;">
                          <span class="statut-icon">${statutInfo.icone}</span>
                          <span class="statut-text">${statutInfo.statut}</span>
                        </div>
                      </td>`;
      }

      // Périodes des alertes (SEULEMENT DT et DP)
      if (col === 'periodes') {
        const periodesHTML = Object.entries(row.periodes || {})
          .filter(([type, periode]) => periode !== '-')
          .map(([type, periode]) => {
            let couleur = '#e53e3e';
            let icone = '🔴';
            if (type === 'DP') { couleur = '#d69e2e'; icone = '🟡'; }

            return `
                            <div class="periode-item" style="color: ${couleur};">
                              <span class="periode-icon">${icone}</span>
                              <span class="periode-type">${type}:</span>
                              <span class="periode-value">${periode}</span>
                            </div>
                          `;
          }).join('');
        return `<td class="periodes-cell">${periodesHTML || '<span class="no-periodes">-</span>'}</td>`;
      }

      // Style pour les durées
      if (col === 'dtDuree' || col === 'dpDuree') {
        const isDT = col === 'dtDuree';
        const couleur = isDT ? '#e53e3e' : '#d69e2e';
        return `<td class="duree-cell" style="color: ${couleur}; font-weight: bold;">${value}</td>`;
      }

      if (col === 'analyse') {
        let badgeClass = 'badge-normal';
        if (value.includes('DT')) badgeClass = 'badge-dt';
        else if (value.includes('DP')) badgeClass = 'badge-dp';

        return `<td><span class="badge ${badgeClass}">${value}</span></td>`;
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

function createENRFileSectionHTML(file, results, daily, evolution, alerts) {
  const id = file.name.replace(/[^a-zA-Z0-9]/g, '_');

  // Stocker les résultats dans l'objet global
  if (!window.enrResults) window.enrResults = {};
  window.enrResults[id] = results;

  console.log(`[ENR] Création section pour: ${file.name}`);

  // Générer les stats globales
  const globalStats = generateENRGlobalStats(results, daily);

  // Préparer les données journalières avec les statuts
  const dailyWithStatuts = daily.map(d => {
    const statutInfo = determineENRStatut(d.dtCount, d.dpCount);
    return {
      ...d,
      statut: statutInfo
    };
  });

  return `
    <div class="enr-file-section" data-file-id="${id}">
      <div class="file-header">
        <h4>📄 Document ${file.name}</h4>
        ${file.client ? `<div class="client-badge">👤 Client: ${file.client}</div>` : ''}
        <div class="forfait-badge">⚡ Type: Évènements NR</div>
        <div class="data-stats">
          📊 ${results.length} points de données |
          📅 ${daily.length} jours analysés |
          🔄 ${evolution.length} évolutions
        </div>
      </div>

      <!-- TABLEAU DE BORD GLOBAL -->
      <div class="enr-global-dashboard-container">
        ${createENRGlobalDashboard(globalStats, daily)}
      </div>

      <div class="enr-tabs-container">
        <div class="enr-tabs-header">
          <button class="enr-tab active" data-tab="enr-day-${id}">📅 Journalière</button>
          <button class="enr-tab" data-tab="enr-evol-${id}">🔄 Évolution</button>
          <button class="enr-tab" data-tab="enr-stats-${id}">📊 Stats</button>
          <button class="enr-tab" data-tab="enr-alerts-${id}">
            🚨 Alertes${alerts.length ? `<span class="tab-badge">${alerts.length}</span>` : ''}
          </button>
        </div>

        <!-- Onglet Journalière - COLONNES SIMPLIFIÉES -->
        <div class="enr-tab-content active" id="enr-day-${id}">
          ${createENRTable(
    dailyWithStatuts.map(d => ({
      date: d.date,
      dtDuree: d.dtDuree,
      dpDuree: d.dpDuree,
      periodes: d.periodes,
      statut: d.statut
    })),
    ['date', 'dtDuree', 'dpDuree', 'periodes', 'statut'],
    '📅 Résumé Journalier ENR',
    results
  )}
        </div>
      
        <!-- Onglet Évolution -->
        <div class="enr-tab-content" id="enr-evol-${id}">
          ${createENRTable(
    evolution.filter(e => e.changement !== 'stable').map(e => ({
      date: e.date,
      heure: e.heure,
      etat: e.etat,
      changement: e.changement,
      variation: e.variation
    })),
    ['date', 'heure', 'etat', 'changement', 'variation'],
    '🔄 Évolution des États ENR',
    results
  )}
        </div>
      
        <!-- Onglet Détail -->
        <div class="enr-tab-content" id="enr-detail-${id}">
          ${createENRTable(
    results.map(r => ({
      date: r.date,
      heure: r.heure,
      etat: r.etat,
      etatBin: r.etatBin,
      analyse: r.analyse,
      fort: r.fort,
      faible: r.faible,
      bloc: r.bloc
    })),
    ['date', 'heure', 'etat', 'etatBin', 'analyse', 'fort', 'faible', 'bloc'],
    '📋 Données Brutes ENR',
    results
  )}
        </div>
      
        <!-- Onglet Stats -->
        <div class="enr-tab-content" id="enr-stats-${id}">
          ${createENRStatsHTML(daily, results)}
        </div>
      
        <!-- Onglet Alertes -->
        <div class="enr-tab-content" id="enr-alerts-${id}">
          ${createENRAlertsHTML(alerts)}
        </div>
      </div>
    </div>`;
}

// ======================== INITIALISATION PRINCIPALE ========================
export function createENRAnalysisContent(files) {
  if (!files?.length) return '<p class="no-data">Aucun fichier ENR</p>';

  loadENRCSS();
  window.enrResults = {};

  const html = files.map(file => {
    console.log(`🔍 [ENR] Analyse du fichier: ${file.name}`);

    const results = analyzeENR(file.content);
    const daily = generateENRDailySummary(results);
    const evolution = calculateENREvolution(results);
    const alerts = detectENRAnomalies(results, daily);

    return createENRFileSectionHTML(file, results, daily, evolution, alerts);
  }).join('');

  // Initialisation différée
  setTimeout(() => {
    initializeENRTabs();
    initializeENRAlertBadges();
  }, 300);

  return html;
}

// ======================== GESTION DE L'UI ========================
export function initializeENRTabs() {
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.enr-tab');
    if (!tab) return;

    const targetId = tab.dataset.tab;
    const container = tab.closest('.enr-tabs-container');

    // Désactiver tous les tabs et contenus
    container.querySelectorAll('.enr-tab').forEach(t => t.classList.remove('active'));
    container.querySelectorAll('.enr-tab-content').forEach(c => c.classList.remove('active'));

    // Activer le tab sélectionné
    tab.classList.add('active');
    document.getElementById(targetId)?.classList.add('active');
  });
}

export function initializeENRAlertBadges() {
  document.querySelectorAll('.enr-file-section').forEach(section => {
    const key = section.querySelector('h4')
      ?.textContent.replace(/Document /, '')
      .replace(/[^a-zA-Z0-9]/g, '_');

    const results = window.enrResults?.[key];
    if (!results) return;

    const alerts = detectENRAnomalies(results, generateENRDailySummary(results));
    const badge = section.querySelector('.enr-tab[data-tab^="enr-alerts"] .tab-badge');

    if (badge) {
      badge.textContent = alerts.length;
      badge.style.display = alerts.length ? 'inline' : 'none';
    }
  });
}

// ======================== UTILITAIRES GLOBAUX ========================
function loadENRCSS() {
  if (document.querySelector('link[href*="enrAnalyzer.css"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './analyzer/enrAnalyzer.css';
  document.head.appendChild(link);
}

// ======================== EXPORT PAR DÉFAUT ========================
export default {
  analyzeENR,
  createENRAnalysisContent,
  generateENRDailySummary,
  calculateENREvolution,
  detectENRAnomalies,
  initializeENRTabs,
  initializeENRAlertBadges
};