// analyzer/energyAnalyzer.js — Version avec analyse des formats A0 et 13
const FORFAITS = {
  ECO: { max: 50, maxMarge: 57.5, heures: 5 },
  ECLAIRAGE: { max: 90, maxMarge: 103.5, heures: 5 },
  "ECLAIRAGE +": { max: 150, maxMarge: 172.5, heures: 5 },
  MULTIMEDIA: { max: 210, maxMarge: 241.5, heures: 5 },
  "MULTIMEDIA +": { max: 210, maxMarge: 241.5, heures: 5 },
  "ECLAIRAGE PUBLIC": { max: 150, maxMarge: 172.5, heures: 11 },
  CONGEL: { max: 1250, maxMarge: 1437.5, heures: 24 }, 
  PRENIUM: { max: 500, maxMarge: 575, heures: 24 },
  "FREEZER 1" : { heures: 24 },                
  "FREEZER 3" : { heures: 24 }                
};

window.energyResults = {};
window.energyCharts = new Map();

// ======================== UTILITAIRES ========================
const getForfait = (name) => {
  if (!name) return FORFAITS.ECO;

  let forfaitName;
  if (typeof name === 'string') {
    forfaitName = name;
  } else if (typeof name === 'object' && name !== null) {
    forfaitName = name.forfait || name.name || 'ECO';
  } else {
    forfaitName = String(name);
  }

  const normalizedName = forfaitName.toUpperCase().trim();
  return FORFAITS[normalizedName] || FORFAITS.ECO;
};

const normalizeDate = (dateStr) => dateStr.replace(/(\d{2})\/(\d{2})\/(\d{2})/, (match, day, month, year) => `${day}/${month}/20${year}`);

const parseHexValue = (hex1, hex2) => parseInt(hex1 + hex2, 16) || 0;

const formatTime = (heure, minute) => `${String(heure).padStart(2, '0')}h${String(minute).padStart(2, '0')}`;

// ======================== FONCTIONS D'AIDE POUR LE FORMAT A0 ========================
function parseDate(day, month, year) {
  if (!day || !month || !year || 
      day.length !== 2 || month.length !== 2 || year.length !== 2 ||
      isNaN(parseInt(day, 10)) || isNaN(parseInt(month, 10)) || isNaN(parseInt(year, 10))) {
    return 'N/A';
  }
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/20${year.padStart(2, '0')}`;
}

function checkEnergyState(energy, hour, plan) {
  const planLimits = {
    'ECO': 57,
    'ECLAIRAGE': 90,
    'ECLAIRAGE+': 150,
    'MULTIMEDIA': 210,
    'MULTIMEDIA+': 330,
    'PRENIUM': 500,
    'CONGEL': 1250
  };

  const effectivePlan = (plan && planLimits.hasOwnProperty(plan)) ? plan : 'ECO';
  const limit = planLimits[effectivePlan];

  let state = 'Correct';

  if (energy > (limit * 1.20)) {
    state = 'Invalid (Valeur d\'énergie anormale)';
  } else if (energy > limit) {
    state = 'Hors forfait';
  }

  return state;
}

// ======================== ANALYSE POUR FORMAT A0 ========================
function analyzeEnergyA0Format(tokens, clientPlan) {
  const allLogicalRecords = [];
  let lastProcessedDate = null;
  let hourCounter = 0;
  let globalHexIndex = 0;

  const addLogicalRecord = (displayData, date, hour, energy, energyValue, state) => {
    allLogicalRecords.push({
      displayData: displayData || 'N/A',
      date: date || 'N/A',
      hour: hour || 'N/A',
      energy: energy || 'N/A',
      energyValue: energyValue || 'N/A',
      state: state || 'Invalid'
    });
  };

  console.log(`🔍 Format détecté: A0 (nouvelles règles)`);

  // --- Traitement du TOUT PREMIER enregistrement logique (9 paires) ---
  // Cette ligne est toujours considérée INVALIDE
  if (tokens.length >= 9) {
    let firstBlockParts = tokens.slice(0, 9);
    
    // Détection de C7 pour information
    const firstLine = tokens.slice(0, 9).join(' ');
    if (firstLine.includes('C7')) {
      console.log("Bloc de configuration initiale (C7) trouvé sur la première ligne physique.");
    }
    
    // Le premier enregistrement est invalide
    const firstRecord = {
      displayData: firstBlockParts.join(' '),
      date: parseDate(firstBlockParts[0], firstBlockParts[1], firstBlockParts[2]),
      hour: 'INVALID',
      energy: 'INVALID',
      energyValue: 'N/A',
      state: 'Invalid (Première ligne)'
    };
    allLogicalRecords.push(firstRecord);
    globalHexIndex += 9;
    lastProcessedDate = firstRecord.date;
    hourCounter = 0; // Réinitialise le compteur d'heures à 00h après la première ligne
    
  } else if (tokens.length > 0) {
    addLogicalRecord(tokens.join(' '), 'N/A', 'N/A', 'N/A', 'N/A', 
                     `Invalid (Bloc initial incomplet, attendu 9 paires, trouvé ${tokens.length})`);
    globalHexIndex = tokens.length;
  }

  // --- Traitement des enregistrements logiques suivants ---
  let currentAccumulatedParts = tokens.slice(globalHexIndex);
  let bufferIndex = 0;

  while (currentAccumulatedParts.length - bufferIndex >= 1) {
    const part = currentAccumulatedParts[bufferIndex];

    // Règle: "FF" (consume 1 part)
    if (part === 'FF') {
      addLogicalRecord(currentAccumulatedParts.slice(bufferIndex, bufferIndex + 1).join(' '), 
                       'N/A', 'N/A', 'N/A', 'N/A', 'FF (Ignoré)');
      bufferIndex += 1;
      continue;
    }

    // Règle: "A2" (consume 6 parts) - toutes colonnes INVALID
    if (part === 'A2' && currentAccumulatedParts.length - bufferIndex >= 6) { 
      const a2Block = currentAccumulatedParts.slice(bufferIndex, bufferIndex + 6);
      addLogicalRecord(a2Block.join(' '), 'INVALID', 'INVALID', 'INVALID', 'N/A', 'Invalid (A2 line)');
      bufferIndex += 6; 
      continue;
    }

    // Règle: "A3" (6 paires) - peut être Correct
    if (allLogicalRecords.length > 0 && part === 'A3' && currentAccumulatedParts.length - bufferIndex >= 6) {
      const a3Block = currentAccumulatedParts.slice(bufferIndex, bufferIndex + 6);

      const day = a3Block[1]; 
      const month = a3Block[2]; 
      const year = a3Block[3]; 
      const hourActualHex = a3Block[4]; 
      const energyHex = a3Block[5]; 

      let date = 'N/A';
      let displayHour = 'N/A';
      let energy = 'N/A';
      let energyValue = 'N/A';
      let state = 'Correct';

      try {
        date = parseDate(day, month, year);

        // Réinitialiser l'heure si la date change
        if (lastProcessedDate !== null && date !== 'N/A' && date !== lastProcessedDate) {
          hourCounter = 0;
        }
        lastProcessedDate = date;

        displayHour = `${String(hourCounter).padStart(2, '0')}h`;

        const combinedEnergyHex = `${hourActualHex}${energyHex}`;
        if (/^[0-9A-F]{4}$/i.test(combinedEnergyHex)) {
          energyValue = parseInt(combinedEnergyHex, 16);
          energy = `${energyValue} Wh`;
          state = checkEnergyState(energyValue, displayHour, clientPlan);
        } else {
          energy = 'Invalid';
          energyValue = 'N/A';
          state = 'Invalid (Malformed energy value in A3 block)';
        }
      } catch (e) {
        console.error("Erreur lors de l'analyse du bloc A3 (6 paires):", a3Block, e);
        state = 'Parsing Error (A3 block)';
        energyValue = 'N/A';
      }

      allLogicalRecords.push({
        displayData: a3Block.join(' '),
        date: date,
        hour: displayHour,
        energy: energy,
        energyValue: energyValue,
        state: state
      });
      hourCounter = (hourCounter + 1) % 24;
      bufferIndex += 6;
      continue;
    }

    // Règle: "A7" (8 paires) - toujours invalide
    if (allLogicalRecords.length > 0 && part === 'A7' && currentAccumulatedParts.length - bufferIndex >= 8) {
      const a7Block = currentAccumulatedParts.slice(bufferIndex, bufferIndex + 8);
      addLogicalRecord(a7Block.join(' '), 'INVALID', 'INVALID', 'INVALID', 'N/A', 'INVALID (Bloc A7 isolé - 8 paires)');
      bufferIndex += 8;
      continue;
    }
    
    // Règle: Bloc de données standard (5 paires)
    if (currentAccumulatedParts.length - bufferIndex >= 5) { 
      const segmentParts = currentAccumulatedParts.slice(bufferIndex, bufferIndex + 5);

      // Validation des paires hexadécimales
      if (!segmentParts.every(p => /^[0-9A-F]{2}$/i.test(p))) {
        addLogicalRecord(segmentParts.join(' '), 'N/A', 'N/A', 'N/A', 'N/A', 'Invalid (Malformed hex pair in 5-pair block)');
        bufferIndex += 5;
        continue;
      }

      // Déterminer la date du segment actuel
      const currentSegmentDate = parseDate(segmentParts[0], segmentParts[1], segmentParts[2]);

      // Réinitialiser l'heure si la date change
      if (lastProcessedDate !== null && currentSegmentDate !== 'N/A' && currentSegmentDate !== lastProcessedDate) {
        hourCounter = 0;
      }
      lastProcessedDate = currentSegmentDate;

      // Règle spéciale: Bloc '00 A3' - énergie = 00 Wh, état "Correct"
      if (segmentParts[3] === '00' && segmentParts[4] === 'A3') {
        allLogicalRecords.push({
          displayData: segmentParts.join(' '),
          date: currentSegmentDate,
          hour: `${String(hourCounter).padStart(2, '0')}h`,
          energy: '00 Wh',
          energyValue: 0,
          state: 'Correct'
        });
      } else {
        // Traitement standard du bloc de 5 paires
        let date = currentSegmentDate;
        let displayHour = `${String(hourCounter).padStart(2, '0')}h`;
        let energy = 'N/A';
        let energyValue = 'N/A';
        let state = 'Correct';

        try {
          const combinedEnergyHex = `${segmentParts[3]}${segmentParts[4]}`;
          if (/^[0-9A-F]{4}$/i.test(combinedEnergyHex)) {
            energyValue = parseInt(combinedEnergyHex, 16);
            energy = `${energyValue} Wh`;
            state = checkEnergyState(energyValue, displayHour, clientPlan);
          } else {
            energy = 'Invalid';
            state = 'Invalid (Malformed energy value)';
          }
        } catch (e) {
          console.error("Erreur lors de l'analyse du bloc d'énergie (5 paires):", segmentParts, e);
          state = 'Parsing Error';
        }

        // Si l'état est "Invalid (Valeur d'énergie anormale)", on override l'heure et l'énergie
        if (state === 'Invalid (Valeur d\'énergie anormale)') {
          displayHour = 'INVALID';
          energy = 'INVALID';
        }

        allLogicalRecords.push({
          displayData: segmentParts.join(' '),
          date: date,
          hour: displayHour,
          energy: energy,
          energyValue: energyValue,
          state: state
        });
      }
      
      hourCounter = (hourCounter + 1) % 24;
      bufferIndex += 5;
      continue;
    }

    // Fallback: Fragment non reconnu
    addLogicalRecord(currentAccumulatedParts.slice(bufferIndex, bufferIndex + 1).join(' '), 
                     'N/A', 'N/A', 'N/A', 'N/A', 'Invalid (Unrecognized fragment)');
    bufferIndex += 1;
  }

  // Filtrer les enregistrements invalides pour l'affichage
  const validRecords = allLogicalRecords.filter(record => 
    !record.state.startsWith('Invalid') && 
    record.date !== 'N/A' && 
    record.energyValue !== 'N/A'
  );
  
  console.log(`📊 Résultat format A0: ${allLogicalRecords.length} enregistrements analysés, ${validRecords.length} valides`);
  
  // Convertir au format attendu par le reste du code
  return validRecords.map(record => ({
    date: record.date,
    heure: record.hour,
    valeur: record.energyValue
  }));
}

// ======================== ANALYSE POUR FORMAT 13 (ANCIEN) ========================
function findA2Time(tokens, a3Idx, dateRaw) {
  for (let k = a3Idx - 1; k >= 0; k--) {
    if (tokens[k] === "A2" && `${tokens[k + 1]}/${tokens[k + 2]}/${tokens[k + 3]}` === dateRaw) {
      return {
        heure: parseInt(tokens[k + 4] || "0"),
        minute: parseInt(tokens[k + 5] || "0")
      };
    }
  }
  return { heure: 0, minute: 0 };
}

function analyzeEnergy13Format(tokens) {
  const rows = [];
  let i = 0;
  let currentDate = "";
  let heureCourante = 0;
  let minuteCourante = 0;

  while (i < tokens.length) {
    const a3Idx = tokens.indexOf("A3", i);
    if (a3Idx === -1) break;

    const dateRaw = `${tokens[a3Idx + 1]}/${tokens[a3Idx + 2]}/${tokens[a3Idx + 3]}`;
    const date = normalizeDate(dateRaw);

    if (dateRaw !== currentDate) {
      currentDate = dateRaw;
      const time = findA2Time(tokens, a3Idx, dateRaw);
      heureCourante = time.heure;
      minuteCourante = time.minute;
    }

    const valeurA3 = parseHexValue(tokens[a3Idx + 4], tokens[a3Idx + 5]);

    rows.push({
      date: date,
      heure: formatTime(heureCourante, minuteCourante),
      valeur: valeurA3
    });

    heureCourante = (heureCourante + 1) % 24;

    let j = a3Idx + 6;
    while (j + 4 < tokens.length) {
      if ((tokens[j] === "13" && tokens[j + 1] === "A4") ||
        (tokens[j] === "FF" && tokens[j + 1] === "FF")) {
        j += 8;
        break;
      }

      const blocDateRaw = `${tokens[j]}/${tokens[j + 1]}/${tokens[j + 2]}`;
      const blocDate = normalizeDate(blocDateRaw);
      const valeurBloc = parseHexValue(tokens[j + 3], tokens[j + 4]);

      if (blocDateRaw !== currentDate) {
        currentDate = blocDateRaw;
        heureCourante = 0;
        minuteCourante = 0;
      }

      rows.push({
        date: blocDate,
        heure: formatTime(heureCourante, minuteCourante),
        valeur: valeurBloc
      });

      heureCourante = (heureCourante + 1) % 24;

      j += 5;
    }

    i = j;
  }

  return rows;
}

// ======================== FONCTION ANALYSE PRINCIPALE ========================
export function analyzeEnergy(input, clientPlan = 'ECO') {
  if (!input) return [];

  const tokens = input.trim().split(/\s+/);
  if (tokens.length === 0) return [];

  // Détecter le format basé sur le premier token
  const isA0Format = tokens[0] === 'A0';
  
  if (isA0Format) {
    return analyzeEnergyA0Format(tokens, clientPlan);
  } else {
    return analyzeEnergy13Format(tokens);
  }
}

// ======================== CALCULS ========================
export const generateDailySummary = (results) => {
  if (!results || !results.length) {
    return [];
  }

  const dailyMap = results.reduce((acc, r) => {
    if (!acc[r.date]) {
      acc[r.date] = { date: r.date, valeurs: [], max: 0 };
    }
    acc[r.date].valeurs.push(r.valeur);
    if (r.valeur > acc[r.date].max) {
      acc[r.date].max = r.valeur;
    }
    return acc;
  }, {});

  const summary = Object.values(dailyMap).map(d => ({
    date: d.date,
    valeurMoyenne: Math.round(d.valeurs.reduce((a, b) => a + b, 0) / d.valeurs.length),
    valeurMax: d.max
  }));

  return summary;
};

export const calculateHourlyConsumption = (results) => {
  if (!results || !results.length) {
    return [];
  }

  const sorted = [...results].sort((a, b) => {
    const dateA = convertToComparableDate(a.date);
    const dateB = convertToComparableDate(b.date);
    
    const dateCompare = dateA.localeCompare(dateB);
    if (dateCompare !== 0) return dateCompare;

    const heureA = parseInt(a.heure.split('h')[0]);
    const heureB = parseInt(b.heure.split('h')[0]);
    return heureA - heureB;
  });

  const consumption = sorted.reduce((cons, current, index, array) => {
    if (index === 0) return cons;

    const previous = array[index - 1];

    const heureCurrent = parseInt(current.heure.split('h')[0]);
    const heurePrevious = parseInt(previous.heure.split('h')[0]);

    if (current.date === previous.date && heureCurrent === heurePrevious + 1) {
      const diff = current.valeur - previous.valeur;
      if (diff >= 0) {
        const evolution = current.valeur - previous.valeur;
        
        cons.push({
          date: current.date,
          heure: current.heure,
          consommation: diff,
          evolution: evolution
        });
      }
    }
    return cons;
  }, []);

  return consumption;
};

// NOUVELLE FONCTION : Calcul de la consommation entre deux heures
export const calculateConsumptionBetweenHours = (results) => {
  if (!results || !results.length) {
    return [];
  }

  const sorted = [...results].sort((a, b) => {
    const dateA = convertToComparableDate(a.date);
    const dateB = convertToComparableDate(b.date);
    
    const dateCompare = dateA.localeCompare(dateB);
    if (dateCompare !== 0) return dateCompare;

    const heureA = parseInt(a.heure.split('h')[0]);
    const heureB = parseInt(b.heure.split('h')[0]);
    return heureA - heureB;
  });

  const hourlyConsumption = [];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];

    const heureCurrent = parseInt(current.heure.split('h')[0]);
    const heurePrevious = parseInt(previous.heure.split('h')[0]);

    // Vérifier que c'est la même date et des heures consécutives
    if (current.date === previous.date && heureCurrent === heurePrevious + 1) {
      const consommation = current.valeur - previous.valeur;
      
      if (consommation >= 0) {
        hourlyConsumption.push({
          date: current.date,
          heureDebut: previous.heure,
          heureFin: current.heure,
          periode: `${previous.heure} - ${current.heure}`,
          consommation: consommation,
          valeurDebut: previous.valeur,
          valeurFin: current.valeur
        });
      }
    }
  }

  return hourlyConsumption;
};

function convertToComparableDate(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

// ======================== ALERTES ========================
export const detectAnomalies = (results, daily, forfaitName) => {
  const forfait = getForfait(forfaitName);
  const alerts = [];

  if (!daily.length) {
    return alerts;
  }

  daily.forEach(d => {
    if (d.valeurMax > forfait.maxMarge) {
      alerts.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Dépassement',
        message: `${d.valeurMax} > ${forfait.maxMarge} Wh`,
        date: d.date
      });
    }
  });

  const avg = daily.reduce((sum, d) => sum + d.valeurMoyenne, 0) / daily.length || 0;
  if (avg > forfait.max * 0.8) {
    alerts.push({
      type: 'info',
      icon: 'ℹ️',
      title: 'Moyenne élevée',
      message: `${Math.round(avg)} Wh/jour`
    });
  }

  return alerts;
};

// ======================== GESTION DES DONNÉES PAR CLIENT ========================
class EnergyDataManager {
    constructor() {
        this.clientData = new Map();
        this.fileIndex = new Map();
    }

    storeClientData(clientId, fileId, results, daily, hourly, alerts) {
        if (!this.clientData.has(clientId)) {
            this.clientData.set(clientId, new Map());
        }

        const clientMap = this.clientData.get(clientId);
        clientMap.set(fileId, {
            results,
            daily,
            hourly,
            alerts,
            timestamp: Date.now()
        });

        this.fileIndex.set(fileId, { clientId, fileId });

        console.log(`💾 Données stockées - Client: ${clientId}, Fichier: ${fileId}`, {
            results: results.length,
            daily: daily.length,
            hourly: hourly.length
        });
    }

    getClientData(clientId, fileId) {
        if (!this.clientData.has(clientId)) {
            console.warn(`❌ Client non trouvé: ${clientId}`);
            return null;
        }

        const clientMap = this.clientData.get(clientId);
        const data = clientMap.get(fileId);
        
        if (!data) {
            console.warn(`❌ Fichier non trouvé: ${fileId} pour client: ${clientId}`);
            return null;
        }

        return data;
    }

    getHourlyDataForFile(clientId, fileId) {
        const data = this.getClientData(clientId, fileId);
        return data ? data.hourly : null;
    }

    findDataByFileId(fileId) {
        if (this.fileIndex.has(fileId)) {
            const { clientId } = this.fileIndex.get(fileId);
            const data = this.getClientData(clientId, fileId);
            if (data) {
                console.log(`🔍 Données trouvées via index - Client: ${clientId}, Fichier: ${fileId}`);
                return { clientId, data };
            }
        }

        for (let [clientId, clientMap] of this.clientData) {
            for (let [fileKey, data] of clientMap) {
                if (fileKey === fileId) {
                    console.log(`🔍 Données trouvées via recherche - Client: ${clientId}, Fichier: ${fileId}`);
                    this.fileIndex.set(fileId, { clientId, fileId });
                    return { clientId, data };
                }
            }
        }

        console.warn(`❌ Aucune donnée trouvée pour fileId: ${fileId}`);
        return null;
    }

    getClientFiles(clientId) {
        if (!this.clientData.has(clientId)) {
            return [];
        }
        const clientMap = this.clientData.get(clientId);
        return Array.from(clientMap.entries()).map(([fileId, data]) => ({
            fileId,
            ...data
        }));
    }
}

const energyDataManager = new EnergyDataManager();

// ======================== DASHBOARD CLIENT ========================
function createClientDashboard(file, results, daily, hourly, alerts) {
  if (!daily.length) {
    return '<div class="no-data">Aucune donnée disponible pour le dashboard</div>';
  }

  const forfait = getForfait(file.forfait || 'ECO');
  const stats = calculateClientStats(daily, forfait, alerts, file.forfait || 'ECO');

  return `
    <div class="client-dashboard">
      <div class="dashboard-header">
        <h3>📊 Tableau de Bord - Client ${file.client || file.name}</h3>
        <div class="forfait-info">Forfait: ${file.forfait || 'ECO'}</div>
      </div>
      
      <div class="dashboard-grid">
        <div class="dashboard-card peak-card">
          <div class="card-icon">⚡</div>
          <div class="card-content">
            <div class="card-value ${stats.peakExceeds ? 'exceeded' : ''}">${stats.peakConsumption} Wh</div>
            <div class="card-label">Pic Max</div>
            <div class="card-detail">${stats.peakDate}</div>
            ${stats.peakExceeds ? '<div class="card-alert">Dépassement</div>' : ''}
          </div>
        </div>
        
        <div class="dashboard-card avg-card">
          <div class="card-icon">📊</div>
          <div class="card-content">
            <div class="card-value">${stats.averageConsumption} Wh</div>
            <div class="card-label">Moyenne</div>
            <div class="card-detail">${stats.totalDays} jours</div>
          </div>
        </div>
        
        <div class="dashboard-card compliance-card">
          <div class="card-icon">✅</div>
          <div class="card-content">
            <div class="card-value ${stats.complianceRate < 80 ? 'warning' : ''}">${stats.complianceRate}%</div>
            <div class="card-label">Conformité</div>
            <div class="card-detail">${stats.compliantDays}/${stats.totalDays} j</div>
          </div>
        </div>
        
        <div class="dashboard-card alerts-card">
          <div class="card-icon">🚨</div>
          <div class="card-content">
            <div class="card-value ${stats.alertCount > 0 ? 'warning' : ''}">${stats.alertCount}</div>
            <div class="card-label">Alertes</div>
            <div class="card-detail">Dépassements</div>
          </div>
        </div>
      </div>

      <div class="status-distribution">
        <h4>📈 Répartition des Jours</h4>
        <div class="status-grid">
          <div class="status-item conform">
            <span class="status-icon">✅</span>
            <span class="status-label">Conforme</span>
            <span class="status-count">${stats.statusCount.conforme}j</span>
            <div class="status-bar">
              <div class="status-fill conform" style="width: ${stats.statusPercent.conforme}%"></div>
            </div>
          </div>
          <div class="status-item low-consumption">
            <span class="status-icon">🟡</span>
            <span class="status-label">Faible</span>
            <span class="status-count">${stats.statusCount.faible}j</span>
            <div class="status-bar">
              <div class="status-fill low-consumption" style="width: ${stats.statusPercent.faible}%"></div>
            </div>
          </div>
          <div class="status-item no-consumption">
            <span class="status-icon">🔵</span>
            <span class="status-label">Aucune</span>
            <span class="status-count">${stats.statusCount.pas}j</span>
            <div class="status-bar">
              <div class="status-fill no-consumption" style="width: ${stats.statusPercent.pas}%"></div>
            </div>
          </div>
          <div class="status-item exceeded">
            <span class="status-icon">🔴</span>
            <span class="status-label">Dépassement</span>
            <span class="status-count">${stats.statusCount.depassement}j</span>
            <div class="status-bar">
              <div class="status-fill exceeded" style="width: ${stats.statusPercent.depassement}%"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="dashboard-footer">
        <p>
          <span class="period">📅 Période: ${stats.periodStart} → ${stats.periodEnd}</span>
          <span class="separator">|</span>
          <span class="forfait ${file.forfait || 'ECO'}">Forfait: ${file.forfait || 'ECO'}</span>
        </p>
      </div>
    </div>
  `;
}

function calculateClientStats(daily, forfait, alerts, forfaitName) {
  const peakConsumption = Math.max(...daily.map(d => d.valeurMax));
  const peakDay = daily.find(d => d.valeurMax === peakConsumption);
  const averageConsumption = Math.round(daily.reduce((sum, d) => sum + d.valeurMoyenne, 0) / daily.length);

  const statusCount = {
    conforme: 0,
    faible: 0,
    pas: 0,
    depassement: 0
  };

  daily.forEach(day => {
    const statut = determineStatut(day.valeurMax, day.valeurMoyenne, forfaitName);
    if (statut.statut === 'Conforme') statusCount.conforme++;
    else if (statut.statut === 'Moins de consommation') statusCount.faible++;
    else if (statut.statut === 'Pas de consommation') statusCount.pas++;
    else if (statut.statut === 'Dépassement') statusCount.depassement++;
  });

  const totalDays = daily.length;
  const compliantDays = statusCount.conforme;
  const complianceRate = Math.round((compliantDays / totalDays) * 100);

  const statusPercent = {
    conforme: Math.round((statusCount.conforme / totalDays) * 100),
    faible: Math.round((statusCount.faible / totalDays) * 100),
    pas: Math.round((statusCount.pas / totalDays) * 100),
    depassement: Math.round((statusCount.depassement / totalDays) * 100)
  };

  // CORRECTION ICI : Trier correctement les dates
  const dates = daily.map(d => {
    const parts = d.date.split('/');
    // Convertir en format comparable YYYY-MM-DD
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }).sort((a, b) => a - b); // Trier par date croissante

  const periodStart = dates.length > 0 ? 
    `${String(dates[0].getDate()).padStart(2, '0')}/${String(dates[0].getMonth() + 1).padStart(2, '0')}/${dates[0].getFullYear()}` : 
    'N/A';
  
  const periodEnd = dates.length > 0 ? 
    `${String(dates[dates.length - 1].getDate()).padStart(2, '0')}/${String(dates[dates.length - 1].getMonth() + 1).padStart(2, '0')}/${dates[dates.length - 1].getFullYear()}` : 
    'N/A';

  return {
    peakConsumption,
    peakDate: peakDay?.date || 'N/A',
    peakExceeds: peakConsumption > forfait.maxMarge,
    averageConsumption,
    totalDays,
    compliantDays,
    complianceRate,
    alertCount: alerts.length,
    statusCount,
    statusPercent,
    periodStart,
    periodEnd
  };
}

// ======================== LEGENDE COULEURS ========================
function createColorLegend(forfaitName, containerId) {
  const forfait = getForfait(forfaitName);

  const seuilDanger = Math.round(forfait.maxMarge * 0.9);
  const seuilAlerte = Math.round(forfait.maxMarge * 0.7);
  const seuilNormal = Math.round(forfait.maxMarge * 0.4);

  const legendHTML = `
    <div class="color-legend">
      <h6>📊 Légende de Consommation (Forfait ${forfaitName})</h6>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-color" style="background-color: rgba(72, 187, 120, 0.8);"></span>
          <span class="legend-label">Faible: ≤ ${seuilNormal} Wh</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: rgba(96, 165, 250, 0.8);"></span>
          <span class="legend-label">Normal: ≤ ${seuilAlerte} Wh</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: rgba(245, 158, 11, 0.8);"></span>
          <span class="legend-label">Élevé: ≤ ${seuilDanger} Wh</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: rgba(239, 68, 68, 0.8);"></span>
          <span class="legend-label">Critique: > ${seuilDanger} Wh</span>
        </div>
      </div>
      <div class="legend-info">
        <small>Seuils basés sur la marge max du forfait: ${forfait.maxMarge} Wh</small>
      </div>
    </div>
  `;

  const container = document.getElementById(containerId);
  if (container) {
    const existingLegend = container.querySelector('.color-legend');
    if (existingLegend) {
      existingLegend.remove();
    }
    container.insertAdjacentHTML('afterbegin', legendHTML);
  }

  return legendHTML;
}

// ======================== FILTRES DATE - VERSION CORRIGÉE ========================
function createDateFilterControls(containerId, onFilterChange, allData) {
  const filterHTML = `
    <div class="date-filter-container">
      <h6>📅 Filtre par Période</h6>
      <div class="filter-controls">
        <div class="filter-group">
          <label>Période rapide:</label>
          <select class="quick-period-select">
            <option value="all">Toutes les données</option>
            <option value="5">5 derniers jours</option>
            <option value="7">7 derniers jours</option>
            <option value="14">14 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="custom">Période personnalisée</option>
          </select>
        </div>
        
        <div class="filter-group custom-dates" style="display: none;">
          <label>Du:</label>
          <input type="date" class="start-date">
          
          <label>Au:</label>
          <input type="date" class="end-date">
          
          <button class="apply-custom-dates">Appliquer</button>
        </div>
        
        <div class="filter-stats">
          <span class="filter-info">Sélectionnez une période</span>
        </div>
      </div>
    </div>
  `;

  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = filterHTML;

    const quickSelect = container.querySelector('.quick-period-select');
    const customDates = container.querySelector('.custom-dates');
    const startDate = container.querySelector('.start-date');
    const endDate = container.querySelector('.end-date');
    const applyBtn = container.querySelector('.apply-custom-dates');
    const filterInfo = container.querySelector('.filter-info');

    // Calculer la plage de dates basée sur les données réelles
    const dateRange = calculateDateRangeFromData(allData);
    
    // Définir les min/max pour les inputs date
    if (startDate && endDate) {
      startDate.min = dateRange.min;
      startDate.max = dateRange.max;
      endDate.min = dateRange.min;
      endDate.max = dateRange.max;
    }

    quickSelect.addEventListener('change', function () {
      if (this.value === 'custom') {
        customDates.style.display = 'flex';
      } else {
        customDates.style.display = 'none';
        if (this.value !== 'all') {
          const dateRange = getDateRange(this.value, allData);
          onFilterChange(dateRange);
          filterInfo.textContent = `Période: ${formatDateForDisplay(dateRange.start)} → ${formatDateForDisplay(dateRange.end)}`;
        } else {
          onFilterChange(null);
          filterInfo.textContent = 'Toutes les données affichées';
        }
      }
    });

    applyBtn.addEventListener('click', function () {
      if (startDate.value && endDate.value) {
        const dateRange = {
          start: startDate.value,
          end: endDate.value
        };
        onFilterChange(dateRange);
        filterInfo.textContent = `Période personnalisée: ${formatDateForDisplay(dateRange.start)} → ${formatDateForDisplay(dateRange.end)}`;
      }
    });
  }
}

function formatDateForDisplay(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function calculateDateRangeFromData(data) {
  if (!data || data.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    return { min: today, max: today };
  }

  // Convertir toutes les dates en objets Date pour trouver le min/max
  const dates = data.map(item => {
    const parts = item.date.split('/');
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  });

  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  return {
    min: minDate.toISOString().split('T')[0],
    max: maxDate.toISOString().split('T')[0]
  };
}

function getDateRange(period, data) {
  if (!data || data.length === 0) {
    return null;
  }

  // Trouver la date la plus récente dans les données
  const dates = data.map(item => {
    const parts = item.date.split('/');
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  });

  const end = new Date(Math.max(...dates));
  let start = new Date(end);

  switch (period) {
    case '5':
      start.setDate(end.getDate() - 5);
      break;
    case '7':
      start.setDate(end.getDate() - 7);
      break;
    case '14':
      start.setDate(end.getDate() - 14);
      break;
    case '30':
      start.setDate(end.getDate() - 30);
      break;
    default:
      return null;
  }

  // S'assurer que start ne soit pas avant la première date disponible
  const minDate = new Date(Math.min(...dates));
  if (start < minDate) {
    start = new Date(minDate);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

// FONCTION FILTRAGE CORRIGÉE
function filterDataByDate(data, dateRange) {
  if (!dateRange || !dateRange.start || !dateRange.end) {
    console.log('🔍 Filtre: Aucune plage de date, retour de toutes les données');
    return data;
  }

  console.log(`🔍 Filtre appliqué: ${dateRange.start} → ${dateRange.end}`);
  console.log(`📊 Données avant filtrage: ${data.length} éléments`);

  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  endDate.setHours(23, 59, 59, 999);

  const filteredData = data.filter(item => {
    // Convertir la date de l'item (format DD/MM/YYYY) en objet Date
    const itemDateParts = item.date.split('/');
    const itemDate = new Date(
      parseInt(itemDateParts[2]), // année
      parseInt(itemDateParts[1]) - 1, // mois (0-indexed)
      parseInt(itemDateParts[0]) // jour
    );

    const isInRange = itemDate >= startDate && itemDate <= endDate;
    
    if (isInRange) {
      console.log(`✅ Inclus: ${item.date} (${itemDate.toISOString()})`);
    }

    return isInRange;
  });

  console.log(`📊 Données après filtrage: ${filteredData.length} éléments`);
  
  // Debug détaillé
  if (filteredData.length === 0) {
    console.warn('❌ Aucune donnée filtrée. Debug:');
    console.log('📅 Plage demandée:', {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      startLocal: startDate.toLocaleDateString('fr-FR'),
      endLocal: endDate.toLocaleDateString('fr-FR')
    });
    console.log('📅 Premières dates disponibles:', data.slice(0, 3).map(d => ({
      date: d.date,
      dateObj: new Date(
        parseInt(d.date.split('/')[2]),
        parseInt(d.date.split('/')[1]) - 1,
        parseInt(d.date.split('/')[0])
      ).toISOString()
    })));
  }

  return filteredData;
}

// ======================== GRAPHIQUE JOURNALIER ========================
export function createDailyChart(dailyData, containerId, title = 'Consommation Journalière', forfaitName = 'ECO') {
  if (!dailyData || !dailyData.length) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="no-data-chart">
          <div class="no-data-icon">📊</div>
          <div class="no-data-text">Aucune donnée disponible pour le graphique journalier</div>
        </div>
      `;
    }
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`❌ Conteneur non trouvé: ${containerId}`);
    return null;
  }

  // Détruire le graphique existant s'il y en a un
  const existingChart = window.energyCharts.get(containerId);
  if (existingChart) {
    existingChart.destroy();
    window.energyCharts.delete(containerId);
  }

  // Trier les données par date
  const sortedData = [...dailyData].sort((a, b) => {
    const dateA = convertToComparableDate(a.date);
    const dateB = convertToComparableDate(b.date);
    return dateA.localeCompare(dateB);
  });

  container.innerHTML = `
    <div class="enhanced-chart-container">
      <div class="chart-header">
        <h5>${title}</h5>
        <div class="chart-actions">
          <button class="btn-download-csv" title="Télécharger CSV">📥 CSV</button>
          <button class="btn-export-png" title="Exporter PNG">🖼️ PNG</button>
        </div>
      </div>
      
      <div id="${containerId}-filters"></div>
      <div id="${containerId}-legend"></div>
      
      <div class="chart-wrapper">
        <canvas id="${containerId}-canvas" width="800" height="400"></canvas>
      </div>
      
      <div class="chart-footer">
        <div class="chart-info">
          📈 ${sortedData.length} jours | 
          Période: ${sortedData[0]?.date} → ${sortedData[sortedData.length - 1]?.date}
        </div>
        <div class="chart-stats">
          Moyenne: <span id="${containerId}-avg">0</span> Wh | 
          Max: <span id="${containerId}-max">0</span> Wh
        </div>
      </div>
    </div>
  `;

  // Créer la légende
  createColorLegend(forfaitName, `${containerId}-legend`);

  // Créer les filtres
  createDateFilterControls(`${containerId}-filters`, (dateRange) => {
    let filteredData = [...sortedData];
    if (dateRange) {
        filteredData = filterDataByDate(sortedData, dateRange);
    }
    
    if (filteredData.length === 0) {
        const canvas = document.getElementById(`${containerId}-canvas`);
        if (canvas) {
            canvas.parentElement.innerHTML = `
            <div class="no-data-chart">
                <div class="no-data-icon">📊</div>
                <div class="no-data-text">Aucune donnée disponible pour la période sélectionnée</div>
                <div class="no-data-detail">
                    Période demandée: ${formatDateForDisplay(dateRange.start)} → ${formatDateForDisplay(dateRange.end)}
                </div>
            </div>
            `;
        }
        return;
    }
    
    renderDailyChart(`${containerId}-canvas`, filteredData, title, forfaitName, containerId);
    updateDailyChartStats(containerId, filteredData);
  }, sortedData);

  // Rendre le graphique initial
  renderDailyChart(`${containerId}-canvas`, sortedData, title, forfaitName, containerId);
  updateDailyChartStats(containerId, sortedData);

  return `${containerId}-canvas`;
}

function renderDailyChart(canvasId, data, title, forfaitName, containerId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`❌ Canvas non trouvé: ${canvasId}`);
    return;
  }

  // Détruire le graphique existant
  const existingChart = window.energyCharts.get(containerId);
  if (existingChart) {
    existingChart.destroy();
  }

  if (typeof Chart === 'undefined') {
    canvas.parentElement.innerHTML = `
      <div class="chart-error">
        ❌ Chart.js n'est pas chargé. Le graphique ne peut pas être affiché.
      </div>
    `;
    return;
  }

  const labels = data.map(item => {
    const dateParts = item.date.split('/');
    return `${dateParts[0]}/${dateParts[1]}`; // Format DD/MM
  });

  const moyenneData = data.map(item => item.valeurMoyenne);
  const maxData = data.map(item => item.valeurMax);

  const forfait = getForfait(forfaitName);
  const limiteData = Array(data.length).fill(forfait.max);
  const limiteMargeData = Array(data.length).fill(forfait.maxMarge);

  const ctx = canvas.getContext('2d');

  try {
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Consommation Moyenne (Wh)',
            data: moyenneData,
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(54, 162, 235, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            order: 3
          },
          {
            label: 'Consommation Max (Wh)',
            data: maxData,
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(255, 99, 132, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            order: 2
          },
          {
            label: `Limite Forfait (${forfait.max} Wh)`,
            data: limiteData,
            type: 'line',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            order: 1
          },
          {
            label: `Marge Max (${forfait.maxMarge} Wh)`,
            data: limiteMargeData,
            type: 'line',
            borderColor: 'rgba(255, 159, 64, 1)',
            borderWidth: 2,
            borderDash: [3, 3],
            fill: false,
            pointRadius: 0,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: title,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function (context) {
                const value = context.parsed.y;
                let label = context.dataset.label || '';
                return `${label}: ${value} Wh`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            title: {
              display: true,
              text: 'Consommation (Wh)'
            },
            beginAtZero: true
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });

    // Stocker l'instance du graphique avec un ID unique
    window.energyCharts.set(containerId, chart);
    
  } catch (error) {
    console.error('❌ Erreur création graphique journalier:', error);
  }
}

function updateDailyChartStats(containerId, data) {
  const avgElement = document.getElementById(`${containerId}-avg`);
  const maxElement = document.getElementById(`${containerId}-max`);

  if (avgElement && maxElement && data.length > 0) {
    const avg = Math.round(data.reduce((sum, item) => sum + item.valeurMoyenne, 0) / data.length);
    const max = Math.max(...data.map(item => item.valeurMax));

    avgElement.textContent = avg;
    maxElement.textContent = max;
  }
}

// ======================== GRAPHIQUE HORAIRE AVEC GRAPHIQUE EN BARRES ========================
export function createHourlyChartWithBars(rawData, containerId, title = 'Consommation Horaire', forfaitName = 'ECO') {
  if (!rawData || !rawData.length) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="no-data-chart">
          <div class="no-data-icon">📊</div>
          <div class="no-data-text">Aucune donnée disponible pour le graphique horaire</div>
        </div>
      `;
    }
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`❌ Conteneur non trouvé: ${containerId}`);
    return null;
  }

  // Détruire les graphiques existants
  const existingChart1 = window.energyCharts.get(`${containerId}-line`);
  const existingChart2 = window.energyCharts.get(`${containerId}-bar`);
  if (existingChart1) existingChart1.destroy();
  if (existingChart2) existingChart2.destroy();
  window.energyCharts.delete(`${containerId}-line`);
  window.energyCharts.delete(`${containerId}-bar`);

  // Trier les données par date et heure
  const sortedData = [...rawData].sort((a, b) => {
    const dateCompare = convertToComparableDate(a.date).localeCompare(convertToComparableDate(b.date));
    if (dateCompare !== 0) return dateCompare;
    return parseInt(a.heure.split('h')[0]) - parseInt(b.heure.split('h')[0]);
  });

  // Calculer la consommation entre deux heures
  const hourlyConsumptionData = calculateConsumptionBetweenHours(sortedData);

  container.innerHTML = `
    <div class="enhanced-chart-container">
      <div class="chart-header">
        <h5>${title}</h5>
        <div class="chart-actions">
          <button class="btn-download-csv" title="Télécharger CSV">📥 CSV</button>
          <button class="btn-export-png" title="Exporter PNG">🖼️ PNG</button>
        </div>
      </div>
      
      <div id="${containerId}-filters"></div>
      <div id="${containerId}-legend"></div>
      
      <div class="dual-chart-container">
        <div class="chart-section">
          <h6>📈 Consommation Cumulée (Wh)</h6>
          <div class="chart-wrapper">
            <canvas id="${containerId}-line-canvas" width="800" height="300"></canvas>
          </div>
        </div>
        
        <div class="chart-section">
          <h6>📊 Consommation entre Deux Heures (Wh)</h6>
          <div class="chart-wrapper">
            <canvas id="${containerId}-bar-canvas" width="800" height="300"></canvas>
          </div>
        </div>
      </div>
      
      <div class="chart-footer">
        <div class="chart-info">
          📈 ${sortedData.length} points | 
          Période: ${sortedData[0]?.date} → ${sortedData[sortedData.length - 1]?.date}
        </div>
        <div class="chart-stats">
          Moyenne cumulée: <span id="${containerId}-avg-cumul">0</span> Wh | 
          Max cumulé: <span id="${containerId}-max-cumul">0</span> Wh |
          Moyenne horaire: <span id="${containerId}-avg-hourly">0</span> Wh
        </div>
      </div>
    </div>
  `;

  // Créer la légende
  createColorLegend(forfaitName, `${containerId}-legend`);

  // Créer les filtres (commun aux deux graphiques)
  createDateFilterControls(`${containerId}-filters`, (dateRange) => {
    let filteredRawData = [...sortedData];
    let filteredHourlyData = [...hourlyConsumptionData];
    
    if (dateRange) {
        filteredRawData = filterDataByDate(sortedData, dateRange);
        filteredHourlyData = filterDataByDate(hourlyConsumptionData, dateRange);
    }
    
    if (filteredRawData.length === 0 || filteredHourlyData.length === 0) {
        const lineCanvas = document.getElementById(`${containerId}-line-canvas`);
        const barCanvas = document.getElementById(`${containerId}-bar-canvas`);
        if (lineCanvas && barCanvas) {
            lineCanvas.parentElement.innerHTML = `
            <div class="no-data-chart">
                <div class="no-data-icon">📊</div>
                <div class="no-data-text">Aucune donnée disponible pour la période sélectionnée</div>
            </div>
            `;
            barCanvas.parentElement.innerHTML = `
            <div class="no-data-chart">
                <div class="no-data-icon">📊</div>
                <div class="no-data-text">Aucune donnée disponible pour la période sélectionnée</div>
            </div>
            `;
        }
        return;
    }
    
    renderHourlyLineChart(`${containerId}-line-canvas`, filteredRawData, `${title} - Cumulée`, forfaitName, `${containerId}-line`);
    renderHourlyBarChart(`${containerId}-bar-canvas`, filteredHourlyData, `${title} - Entre Deux Heures`, forfaitName, `${containerId}-bar`);
    updateHourlyDualChartStats(containerId, filteredRawData, filteredHourlyData);
  }, sortedData);

  // Rendre les graphiques initiaux
  renderHourlyLineChart(`${containerId}-line-canvas`, sortedData, `${title} - Cumulée`, forfaitName, `${containerId}-line`);
  renderHourlyBarChart(`${containerId}-bar-canvas`, hourlyConsumptionData, `${title} - Entre Deux Heures`, forfaitName, `${containerId}-bar`);
  updateHourlyDualChartStats(containerId, sortedData, hourlyConsumptionData);

  return `${containerId}-line-canvas`;
}

function renderHourlyLineChart(canvasId, data, title, forfaitName, containerId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`❌ Canvas non trouvé: ${canvasId}`);
    return;
  }

  // Détruire le graphique existant
  const existingChart = window.energyCharts.get(containerId);
  if (existingChart) {
    existingChart.destroy();
  }

  if (typeof Chart === 'undefined') {
    canvas.parentElement.innerHTML = `
      <div class="chart-error">
        ❌ Chart.js n'est pas chargé. Le graphique ne peut pas être affiché.
      </div>
    `;
    return;
  }

  // Préparer les labels (date + heure)
  const labels = data.map(item => {
    const dateParts = item.date.split('/');
    return `${dateParts[0]}/${dateParts[1]} ${item.heure}`;
  });

  const consommationData = data.map(item => item.valeur);

  const forfait = getForfait(forfaitName);
  const limiteData = Array(data.length).fill(forfait.max);
  const limiteMargeData = Array(data.length).fill(forfait.maxMarge);

  // Générer des couleurs différentes pour chaque date
  const dates = data.map(item => item.date);
  const dateColors = generateDateColors(dates);

  // Préparer les couleurs des points en fonction des dates et des seuils
  const pointBackgroundColors = data.map((item, index) => {
    const value = item.valeur;
    const baseColor = dateColors[item.date] || '#3B82F6';
    
    if (value > forfait.maxMarge) {
      return 'rgba(239, 68, 68, 1)'; // Rouge pour dépassement marge
    } else if (value > forfait.max) {
      return 'rgba(245, 158, 11, 1)'; // Orange pour dépassement limite
    } else {
      return baseColor; // Couleur de la date pour normal
    }
  });

  const pointBorderColors = data.map((item, index) => {
    const value = item.valeur;
    if (value > forfait.maxMarge) {
      return 'rgba(239, 68, 68, 1)';
    } else if (value > forfait.max) {
      return 'rgba(245, 158, 11, 1)';
    } else {
      return '#ffffff'; // Bordure blanche pour les points normaux
    }
  });

  // Couleur de la ligne principale (dégradé de couleurs)
  const lineGradient = canvas.getContext('2d').createLinearGradient(0, 0, canvas.width, 0);
  const uniqueDates = [...new Set(dates)];
  uniqueDates.forEach((date, index) => {
    const color = dateColors[date] || '#3B82F6';
    lineGradient.addColorStop(index / uniqueDates.length, color);
    lineGradient.addColorStop((index + 1) / uniqueDates.length, color);
  });

  const ctx = canvas.getContext('2d');

  try {
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Consommation Cumulée (Wh)',
            data: consommationData,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: lineGradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 6,
            pointBackgroundColor: pointBackgroundColors,
            pointBorderColor: pointBorderColors,
            pointBorderWidth: 2,
            pointHoverRadius: 8,
            order: 3
          },
          {
            label: `Limite Forfait (${forfait.max} Wh)`,
            data: limiteData,
            type: 'line',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 3,
            borderDash: [8, 4],
            fill: false,
            pointRadius: 0,
            order: 1
          },
          {
            label: `Marge Max (${forfait.maxMarge} Wh)`,
            data: limiteMargeData,
            type: 'line',
            borderColor: 'rgba(255, 159, 64, 1)',
            borderWidth: 3,
            borderDash: [5, 3],
            fill: false,
            pointRadius: 0,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: title,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function (context) {
                const value = context.parsed.y;
                let label = context.dataset.label || '';
                
                // Ajouter un indicateur de statut dans le tooltip
                let status = '';
                if (value > forfait.maxMarge) {
                  status = ' 🔴 DÉPASSEMENT';
                } else if (value > forfait.max) {
                  status = ' 🟠 ALERTE';
                }
                
                return `${label}: ${value} Wh${status}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date et Heure'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            title: {
              display: true,
              text: 'Consommation Cumulée (Wh)'
            },
            beginAtZero: true
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });

    // Stocker l'instance du graphique avec un ID unique
    window.energyCharts.set(containerId, chart);
    
  } catch (error) {
    console.error('❌ Erreur création graphique ligne horaire:', error);
  }
}

function generateDateColors(dates) {
    const uniqueDates = [...new Set(dates)];
    const colorPalette = [
        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
        '#14B8A6', '#F43F5E', '#0EA5E9', '#22C55E', '#EAB308',
        '#A855F7', '#D946EF', '#06D6A0', '#FF6B6B', '#4ECDC4'
    ];
    
    const dateColors = {};
    uniqueDates.forEach((date, index) => {
        dateColors[date] = colorPalette[index % colorPalette.length];
    });
    
    return dateColors;
}

function renderHourlyBarChart(canvasId, data, title, forfaitName, containerId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`❌ Canvas non trouvé: ${canvasId}`);
    return;
  }

  // Détruire le graphique existant
  const existingChart = window.energyCharts.get(containerId);
  if (existingChart) {
    existingChart.destroy();
  }

  if (typeof Chart === 'undefined') {
    canvas.parentElement.innerHTML = `
      <div class="chart-error">
        ❌ Chart.js n'est pas chargé. Le graphique ne peut pas être affiché.
      </div>
    `;
    return;
  }

  // Préparer les labels (période entre deux heures)
  const labels = data.map(item => item.periode);

  const consommationData = data.map(item => item.consommation);

  const forfait = getForfait(forfaitName);

  // Générer des couleurs différentes pour chaque date
  const dates = data.map(item => item.date);
  const dateColors = generateDateColors(dates);

  // Préparer les couleurs des barres
  const barColors = data.map((item, index) => {
    const value = item.consommation;
    const baseColor = dateColors[item.date] || '#3B82F6';
    
    // Ajuster la luminosité en fonction des seuils (optionnel - vous pouvez aussi simplifier)
    if (value > forfait.maxMarge) {
      return 'rgba(239, 68, 68, 0.9)'; // Rouge pour dépassement marge
    } else if (value > forfait.max) {
      return 'rgba(245, 158, 11, 0.9)'; // Orange pour dépassement limite
    } else {
      // Utiliser la couleur de base mais avec une opacité différente
      const rgb = hexToRgb(baseColor);
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    }
  });

  const borderColors = data.map((item, index) => {
    const value = item.consommation;
    if (value > forfait.maxMarge) {
      return 'rgba(239, 68, 68, 1)';
    } else if (value > forfait.max) {
      return 'rgba(245, 158, 11, 1)';
    } else {
      return dateColors[item.date] || '#3B82F6';
    }
  });

  const ctx = canvas.getContext('2d');

  try {
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Consommation Horaire (Wh)',
            data: consommationData,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.8,
            categoryPercentage: 0.9,
            order: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: title,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#1f2937',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              title: function(tooltipItems) {
                const item = data[tooltipItems[0].dataIndex];
                return `📅 ${item.date} - ${item.periode}`;
              },
              label: function (context) {
                const value = context.parsed.y;
                let label = context.dataset.label || '';
                
                const item = data[context.dataIndex];
                let status = '';
                if (value > forfait.maxMarge) {
                  status = ' 🔴 DÉPASSEMENT';
                } else if (value > forfait.max) {
                  status = ' 🟠 ALERTE';
                } else if (value > forfait.max * 0.7) {
                  status = ' 🔵 ÉLEVÉ';
                } else {
                  status = ' 🟢 NORMAL';
                }
                
                return `${label}: ${value} Wh${status}`;
              },
              afterLabel: function(context) {
                const item = data[context.dataIndex];
                return `Valeur début: ${item.valeurDebut} Wh\nValeur fin: ${item.valeurFin} Wh`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Période (Heure Début - Heure Fin)',
              font: { weight: 'bold', size: 12 }
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              font: { size: 10 }
            },
            grid: {
              display: false
            }
          },
          y: {
            title: {
              display: true,
              text: 'Consommation Horaire (Wh)',
              font: { weight: 'bold', size: 12 }
            },
            beginAtZero: true,
            ticks: {
              font: { size: 11 }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        animation: {
          duration: 1000,
          easing: 'easeOutQuart'
        }
      }
    });

    // Stocker l'instance du graphique avec un ID unique
    window.energyCharts.set(containerId, chart);
    
  } catch (error) {
    console.error('❌ Erreur création graphique barres horaire:', error);
  }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 }; // Bleu par défaut
}

function updateHourlyDualChartStats(containerId, rawData, hourlyData) {
  const avgCumulElement = document.getElementById(`${containerId}-avg-cumul`);
  const maxCumulElement = document.getElementById(`${containerId}-max-cumul`);
  const avgHourlyElement = document.getElementById(`${containerId}-avg-hourly`);

  if (avgCumulElement && maxCumulElement && avgHourlyElement) {
    // Statistiques pour les données cumulées
    const cumulValues = rawData.map(item => item.valeur);
    const avgCumul = Math.round(cumulValues.reduce((sum, value) => sum + value, 0) / rawData.length);
    const maxCumul = Math.max(...cumulValues);

    // Statistiques pour la consommation horaire
    const hourlyValues = hourlyData.map(item => item.consommation);
    const avgHourly = hourlyValues.length > 0 ? Math.round(hourlyValues.reduce((sum, value) => sum + value, 0) / hourlyValues.length) : 0;

    avgCumulElement.textContent = avgCumul;
    maxCumulElement.textContent = maxCumul;
    avgHourlyElement.textContent = avgHourly;
  }
}

// ======================== GESTION DES ONGLETS ========================
export function initializeEnergyTabsWithCharts() {
    console.log('🎯 Initialisation des onglets énergie avec graphiques...');

    document.addEventListener('click', (e) => {
        const tab = e.target.closest('.energy-tab');
        if (!tab) return;

        const targetId = tab.dataset.tab;
        const container = tab.closest('.energy-tabs-container');

        // Retirer active de tous les onglets et contenus
        container.querySelectorAll('.energy-tab').forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.energy-tab-content').forEach(c => c.classList.remove('active'));

        // Ajouter active à l'onglet cliqué
        tab.classList.add('active');
        const targetContent = document.getElementById(targetId);
        
        if (targetContent) {
            targetContent.classList.add('active');

            // Gestion du graphique journalier
            if (targetId.startsWith('chart-day-')) {
                const fileId = targetId.replace('chart-day-', '');
                const section = container.closest('.energy-file-section');
                const displayedClientId = section?.dataset.clientId;
                const forfaitName = section?.querySelector('.forfait-info')?.textContent.replace('Forfait: ', '') || 'ECO';

                console.log(`📊 Clic sur graphique journalier - Client affiché: ${displayedClientId}, Fichier: ${fileId}`);

                setTimeout(() => {
                    const containerId = `daily-chart-${fileId}`;
                    const clientName = section.querySelector('.client-badge')?.textContent.replace('👤 Client: ', '') || displayedClientId;
                    
                    console.log(`🎯 Création graphique journalier pour: ${containerId}`);

                    // Recherche des données par fileId
                    const found = energyDataManager.findDataByFileId(fileId);
                    
                    if (found && found.data && found.data.daily && found.data.daily.length > 0) {
                        console.log(`📈 Données journalières trouvées: ${found.data.daily.length} jours`);
                        createDailyChart(
                            found.data.daily,
                            containerId,
                            `Consommation Journalière - ${clientName}`,
                            forfaitName
                        );
                    } else {
                        console.error('❌ Données non trouvées pour le graphique journalier');
                        showChartError(containerId, 'Aucune donnée disponible pour afficher le graphique journalier.');
                    }
                }, 100);
            }

            // Gestion du graphique horaire avec barres
            if (targetId.startsWith('chart-hour-')) {
                const fileId = targetId.replace('chart-hour-', '');
                const section = container.closest('.energy-file-section');
                const displayedClientId = section?.dataset.clientId;
                const forfaitName = section?.querySelector('.forfait-info')?.textContent.replace('Forfait: ', '') || 'ECO';

                console.log(`📊 Clic sur graphique horaire - Client affiché: ${displayedClientId}, Fichier: ${fileId}`);

                setTimeout(() => {
                    const containerId = `hourly-chart-${fileId}`;
                    const clientName = section.querySelector('.client-badge')?.textContent.replace('👤 Client: ', '') || displayedClientId;
                    
                    console.log(`🎯 Création graphique horaire pour: ${containerId}`);

                    // Recherche des données par fileId
                    const found = energyDataManager.findDataByFileId(fileId);
                    
                    if (found && found.data) {
                        // Utiliser les données brutes pour le graphique horaire
                        const rawData = found.data.results || [];
                        if (rawData.length > 0) {
                            console.log(`📈 Données horaires trouvées: ${rawData.length} points`);
                            createHourlyChartWithBars(
                                rawData,
                                containerId,
                                `Consommation Horaire - ${clientName}`,
                                forfaitName
                            );
                        } else {
                            console.error('❌ Données brutes non trouvées pour le graphique horaire');
                            showChartError(containerId, 'Aucune donnée horaire disponible pour afficher le graphique.');
                        }
                    } else {
                        console.error('❌ Données non trouvées pour le graphique horaire');
                        showChartError(containerId, 'Aucune donnée disponible pour afficher le graphique horaire.');
                    }
                }, 100);
            }
        }
    });
}

function showChartError(containerId, message) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="chart-error">
        <div class="error-icon">❌</div>
        <div class="error-message">
          <h4>Erreur d'affichage</h4>
          <p>${message}</p>
        </div>
      </div>
    `;
  }
}

// ======================== COMPOSANTS HTML ========================
function createStatsHTML(daily, forfaitName) {
  if (!daily.length) return '<p class="no-data">Aucune donnée disponible</p>';

  const statuts = daily.map(d => determineStatut(d.valeurMax, d.valeurMoyenne, forfaitName));
  const countConforme = statuts.filter(s => s.statut === 'Conforme').length;
  const countMoinsConso = statuts.filter(s => s.statut === 'Moins de consommation').length;
  const countPasConso = statuts.filter(s => s.statut === 'Pas de consommation').length;
  const countDeppassement = statuts.filter(s => s.statut === 'Dépassement').length;

  const conformite = Math.round(countConforme / daily.length * 100);
  const avg = Math.round(daily.reduce((sum, d) => sum + d.valeurMoyenne, 0) / daily.length);
  const pic = Math.max(...daily.map(d => d.valeurMax));

  return `
    <div class="stats-grid">
      <div><strong>Moyenne/jour</strong><br>${avg} Wh</div>
      <div><strong>Pic max</strong><br>${pic} Wh</div>
      <div><strong>Conformité forfait</strong><br>
        <span style="color:${conformite >= 80 ? '#48bb78' : '#e53e3e'}">${conformite}%</span>
      </div>
      <div><strong>Jours analysés</strong><br>${daily.length}</div>
    </div>
    
    <div class="statuts-repartition">
      <h5>Répartition des statuts :</h5>
      <div class="statuts-grid">
        <div class="statut-item" style="color: #38a169;">
          <span style="font-size: 20px;">✅</span> Conforme: ${countConforme} jours
        </div>
        <div class="statut-item" style="color: #48bb78;">
          <span style="font-size: 20px;">🟢</span> Moins de consommation: ${countMoinsConso} jours
        </div>
        <div class="statut-item" style="color: #4299e1;">
          <span style="font-size: 20px;">🔵</span> Pas de consommation: ${countPasConso} jours
        </div>
        <div class="statut-item" style="color: #e53e3e;">
          <span style="font-size: 20px;">🔴</span> Dépassement: ${countDeppassement} jours
        </div>
      </div>
    </div>`;
}

function createAlertsHTML(alerts) {
  if (!alerts.length) return '<p style="color:#48bb78">✅ Aucune alerte détectée</p>';

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

function createTable(data, columns, title, forfaitName = 'ECO') {
  if (!data || !data.length) {
    return `<div class="no-data">📊 Aucune donnée disponible pour "${title}"</div>`;
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
            ${data.map(row => {
    let statutInfo;
    if (row.statut) {
      statutInfo = row.statut;
    } else if (row.valeur !== undefined) {
      statutInfo = determineStatut(row.valeur, row.valeur, forfaitName);
    } else {
      statutInfo = { statut: 'N/A', icone: '⚪', couleur: '#718096' };
    }

    return `
              <tr>
                ${columns.map(col => {
      const value = row[col] || '-';

      if (col === 'statut') {
        return `<td style="color: ${statutInfo.couleur}; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 16px;">${statutInfo.icone}</span>
                      ${statutInfo.statut}
                    </td>`;
      }

      if (col === 'maximum' && row.valeurMax > getForfait(forfaitName).maxMarge) {
        return `<td style="color: #e53e3e; font-weight: bold;">${value}</td>`;
      }

      return `<td>${value}</td>`;
    }).join('')}
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-info">
        📋 ${data.length} enregistrement(s) affiché(s)
      </div>
    </div>
  `;
}

// ======================== SECTION FICHIER ========================
function createFileSectionHTML(file, results, daily, hourly, alerts, fileId, clientId) {
    const forfaitName = file.forfait || 'ECO';

    const dailyWithStatuts = daily.map(d => {
        const statutInfo = determineStatut(d.valeurMax, d.valeurMoyenne, forfaitName);
        return {
            ...d,
            statut: statutInfo
        };
    });

    return `
    <div class="energy-file-section" data-file-id="${fileId}" data-client-id="${clientId}">
        <div class="file-header">
            <h4>📄 ${file.name}</h4>
            ${file.client ? `<div class="client-badge">👤 Client: ${file.client}</div>` : ''}
            ${file.forfait ? `<div class="forfait-badge">⚡ Forfait: ${file.forfait}</div>` : ''}
            <div class="data-stats">
                ${results.length} points | ${daily.length} jours | ${hourly.length} heures
            </div>
        </div>

        ${createClientDashboard(file, results, daily, hourly, alerts)}

        <div class="energy-tabs-container">
            <div class="energy-tabs-header">
                <button class="energy-tab active" data-tab="day-${fileId}">📅 Journalière</button>
                <button class="energy-tab" data-tab="chart-day-${fileId}">📊 Graphique Journalier</button>
                <button class="energy-tab" data-tab="chart-hour-${fileId}">⏰ Graphique Horaire</button>
                <button class="energy-tab" data-tab="detail-${fileId}">🔍 Détail</button>
                <button class="energy-tab" data-tab="stats-${fileId}">📈 Stats</button>
                <button class="energy-tab" data-tab="alerts-${fileId}">
                    🚨 Alertes${alerts.length ? `<span class="tab-badge">${alerts.length}</span>` : ''}
                </button>
            </div>

            <div class="energy-tab-content active" id="day-${fileId}">
                ${createTable(
                    dailyWithStatuts.map(d => ({
                        date: d.date,
                        moyenne: `${d.valeurMoyenne} Wh`,
                        maximum: `${d.valeurMax} Wh`,
                        statut: d.statut
                    })),
                    ['date', 'moyenne', 'maximum', 'statut'],
                    'Résumé Journalier',
                    forfaitName
                )}
            </div>

            <div class="energy-tab-content" id="chart-day-${fileId}">
                <div class="chart-container-full">
                    <div id="daily-chart-${fileId}" class="chart-placeholder">
                        <div class="chart-loading">
                            <div class="loading-spinner"></div>
                            <p>Chargement du graphique journalier...</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="energy-tab-content" id="chart-hour-${fileId}">
                <div class="chart-container-full">
                    <div id="hourly-chart-${fileId}" class="chart-placeholder">
                        <div class="chart-loading">
                            <div class="loading-spinner"></div>
                            <p>Chargement du graphique horaire...</p>
                        </div>
                    </div>
                </div>
            </div>
        
            <div class="energy-tab-content" id="detail-${fileId}">
                ${createTable(
                    results.map(r => {
                        const statutInfo = determineStatut(r.valeur, r.valeur, forfaitName);
                        return {
                            date: r.date,
                            heure: r.heure,
                            valeur: `${r.valeur} Wh`,
                            statut: statutInfo
                        };
                    }),
                    ['date', 'heure', 'valeur', 'statut'],
                    'Données Brutes Complètes',
                    forfaitName
                )}
            </div>
        
            <div class="energy-tab-content" id="stats-${fileId}">
                ${createStatsHTML(daily, forfaitName)}
            </div>
        
            <div class="energy-tab-content" id="alerts-${fileId}">
                ${createAlertsHTML(alerts)}
            </div>
        </div>
    </div>`;
}

// ======================== INITIALISATION PRINCIPALE ========================
export function createEnergyAnalysisContent(files) {
    if (!files?.length) return '<p class="no-data">Aucun fichier énergie</p>';

    loadCSS();
    loadChartCSS();

    window.energyResults = window.energyResults || {};
    window.energyCharts = new Map();

    const html = files.map(file => {
        console.log(`🔍 [INIT] Analyse du fichier: ${file.name}`);

        const results = analyzeEnergy(file.content, file.forfait || 'ECO');
        const daily = generateDailySummary(results);
        const hourly = calculateHourlyConsumption(results);
        const alerts = detectAnomalies(results, daily, file.forfait || 'ECO');

        const clientId = file.client ? file.client.replace(/[^a-zA-Z0-9]/g, '_') : 'default';
        const fileId = `${clientId}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // Stockage des données
        energyDataManager.storeClientData(clientId, fileId, results, daily, hourly, alerts);

        // Stocker aussi dans window.energyResults pour la compatibilité
        window.energyResults[fileId] = results;
        window.energyResults[file.name.replace(/[^a-zA-Z0-9]/g, '_')] = results;

        console.log(`💾 [INIT] Données stockées pour:`, {
            clientId,
            fileId,
            results: results.length,
            daily: daily.length
        });

        return createFileSectionHTML(file, results, daily, hourly, alerts, fileId, clientId);
    }).join('');

    // Initialisation
    setTimeout(() => {
        console.log('📊 [INIT] Structure energyResults:', Object.keys(window.energyResults));
        console.log('📈 [INIT] Graphiques initialisés:', window.energyCharts.size);
        
        // Initialisation CRITIQUE
        initializeEnergyTabsWithCharts();
        initializeAlertBadges();
        
        console.log('✅ Initialisation énergie terminée');
    }, 200);

    return html;
}

// ======================== FONCTIONS UTILITAIRES ========================
function determineStatut(valeurMax, valeurMoyenne, forfaitName) {
  const forfait = getForfait(forfaitName);

  if (valeurMax === 0) {
    return {
      statut: 'Pas de consommation',
      icone: '🔵',
      couleur: '#4299e1',
      description: 'Aucune consommation détectée'
    };
  }

  if (valeurMax > forfait.maxMarge) {
    return {
      statut: 'Dépassement',
      icone: '🔴',
      couleur: '#e53e3e',
      description: `Dépasse la marge autorisée de ${forfait.maxMarge} Wh`
    };
  }

  if (valeurMax <= forfait.max * 0.5 && valeurMax > 0) {
    return {
      statut: 'Moins de consommation',
      icone: '🟡',
      couleur: '#d69e2e',
      description: `Consommation inférieure à 50% du forfait (${forfait.max} Wh)`
    };
  }

  return {
    statut: 'Conforme',
    icone: '✅',
    couleur: '#38a169',
    description: `Respecte les limites du forfait (${forfait.max} Wh)`
  };
}

function loadCSS() {
  if (document.querySelector('link[href*="enrAnalyzer.css"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './analyzer/enrAnalyzer.css';
  document.head.appendChild(link);
}

function loadChartCSS() {
  if (document.querySelector('#energy-chart-css')) return;

  const style = document.createElement('style');
  style.id = 'energy-chart-css';
  document.head.appendChild(style);
}

// ======================== FONCTIONS DE COMPATIBILITÉ ========================
export function initializeEnergyTabs() {
  initializeEnergyTabsWithCharts();
}

export function initializeAlertBadges() {
  document.querySelectorAll('.energy-file-section').forEach(section => {
    const badge = section.querySelector('.energy-tab[data-tab^="alerts"] .tab-badge');
    if (badge) {
      const alertsCount = section.querySelectorAll('.alert').length;
      badge.textContent = alertsCount;
      badge.style.display = alertsCount ? 'inline' : 'none';
    }
  });
}

export default {
  analyzeEnergy,
  createEnergyAnalysisContent,
  initializeEnergyTabs: initializeEnergyTabsWithCharts,
  initializeAlertBadges,
  createDailyChart,
  createHourlyChartWithBars,
  calculateHourlyConsumption,
  calculateConsumptionBetweenHours,
  
};

// ======================== EXPOSITION GLOBALE ========================
// Exposer les fonctions globalement
if (typeof window !== 'undefined') {
    window.analyzeEnergy = analyzeEnergy;
    window.generateDailySummary = generateDailySummary;
    window.calculateHourlyConsumption = calculateHourlyConsumption;
    window.calculateConsumptionBetweenHours = calculateConsumptionBetweenHours;
    window.detectAnomalies = detectAnomalies;
    
    console.log('✅ EnergyAnalyzer exposé globalement');
}

// // Gardez les exports ES6 pour la compatibilité avec d'autres modules
// export {
//     analyzeEnergy,
//     generateDailySummary,
//     calculateHourlyConsumption,
//     calculateConsumptionBetweenHours,
//     detectAnomalies,
//     createDailyChart,
//     createHourlyChartWithBars,
//     initializeEnergyTabs,
//     initializeAlertBadges,
//     createEnergyAnalysisContent
// };