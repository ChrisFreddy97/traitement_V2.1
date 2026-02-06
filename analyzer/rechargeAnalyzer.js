// rechargeAnalyzer.js
const FORFAITS_RECHARGE = {
  1: { nom: "ECO", classe: "forfait-eco" },
  2: { nom: "ECLAIRAGE", classe: "forfait-eclairage" },
  3: { nom: "ECLAIRAGE +", classe: "forfait-eclairage" },
  4: { nom: "MULTIMEDIA", classe: "forfait-multimedia" },
  5: { nom: "MULTIMEDIA +", classe: "forfait-multimedia" },
  9: { nom: "ECLAIRAGE PUBLIC PREF", classe: "forfait-eclairage-pref" },
  8: { nom: "ECLAIRAGE PUBLIC 5H", classe: "forfait-eclairage-5h" },
  7: { nom: "ECLAIRAGE + PREF", classe: "forfait-eclairage-pref-plus" },
  16: { nom: "CSB", classe: "forfait-csb" },
  17: { nom: "CSB CONGEL", classe: "forfait-csb-congel" },
  6: { nom: "PREMIUM", classe: "forfait-premium" },
  14: { nom: "FRIGO", classe: "forfait-frigo" },
  12: { nom: "CONGEL", classe: "forfait-congel" },
  34: { nom: "CONGEL -10°C", classe: "forfait-congel-10" },
  32: { nom: "CONGEL -5°C", classe: "forfait-congel-5" }
};

// ======================== UTILITAIRES ========================
const getNomForfait = (numForfait) => {
  const forfait = FORFAITS_RECHARGE[numForfait];
  if (forfait) {
    return `<span class="forfait-badge ${forfait.classe}"><span>${forfait.nom}</span></span>`;
  }
  return `<span class="forfait-badge forfait-inconnu"><span>Forfait ${numForfait}</span></span>`;
};

const normalizeDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return dateStr;
  return dateStr.replace(/(\d{2})\/(\d{2})\/(\d{2})/, (match, day, month, year) => 
    `${day}/${month}/20${year}`
  );
};

const formatTime = (heures, minutes) => {
  return `${String(heures).padStart(2, '0')}h${String(minutes).padStart(2, '0')}`;
};

// ======================== ANALYSE RECHARGE AMÉLIORÉE ========================
export function analyzeRecharge(input) {
  if (!input) return [];

  const cleaned = input
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const bytes = cleaned.split(/[\s,]+/).filter(b => b.length > 0);
  const results = [];
  let sequencesFound = 0;

  console.log('🔍 [RECHARGE] Début analyse -', bytes.length, 'bytes');

  // Vérification du format
  if (bytes.length < 2) {
    throw new Error("Fichier trop court - doit contenir au moins 2 octets");
  }

  const firstTwoBytes = bytes.slice(0, 2).join(" ");
  if (firstTwoBytes !== "13 F0" && bytes[0] !== "F0") {
    throw new Error(`Format invalide - début du fichier: "${firstTwoBytes}" au lieu de "13 F0" ou "F0"`);
  }

  // Parcourir tous les bytes pour trouver les séquences F3 (0xF3)
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    
    // Recherche des séquences F3 (commande de données)
    if (b === "F3") {
      sequencesFound++;
      
      // Vérifier qu'il y a assez de bytes après F3 (12 bytes pour une séquence complète)
      if (i + 12 >= bytes.length) {
        console.warn("❌ [RECHARGE] Séquence incomplète après F3 à la position", i);
        continue;
      }

      const sequence = bytes.slice(i + 1, i + 13);
      
      // Validation des données hexadécimales
      if (!sequence.every(isValidHex)) {
        console.warn("❌ [RECHARGE] Séquence contenant des valeurs hexadécimales invalides");
        continue;
      }

      // Extraire les données selon le format spécifié
      const [date, mois, annee, heures, minutes, typeCode, poidsFort, poidsFaible, data1, data2, data3, data4] = sequence;
      
      // Formater la date et l'heure
      const dateFormatee = normalizeDate(`${date}/${mois}/${annee}`);
      const heureFormatee = formatTime(heures, minutes);
      
      // Analyser le type code selon la spécification
      const typeCodeBin = parseInt(typeCode, 16).toString(2).padStart(8, '0');
      const typeInfo = analyserTypeCodeDetaille(typeCodeBin, data1, data2, data3, data4);
      
      // Ne garder que les recharges (bit0 = 1)
      if (typeInfo.type === "Recharge") {
        const numClient = parseInt(data1, 16);
        const credit = parseInt(data2, 16);
        const uniteDuree = parseInt(data3, 16);
        const numForfait = parseInt(data4, 16);
        const idRecharge = `${poidsFort}${poidsFaible}`;

        results.push({
          date: dateFormatee,
          heure: heureFormatee,
          type: typeInfo.type,
          typeCode: typeCode,
          typeCodeBin: typeCodeBin,
          idRecharge: idRecharge,
          client: numClient,
          credit: credit,
          uniteDuree: uniteDuree,
          forfait: numForfait,
          nomForfait: getNomForfait(numForfait),
          poidsFort: poidsFort,
          poidsFaible: poidsFaible,
          data1: data1,
          data2: data2,
          data3: data3,
          data4: data4,
          data1Dec: parseInt(data1, 16),
          data2Dec: parseInt(data2, 16),
          data3Dec: parseInt(data3, 16),
          data4Dec: parseInt(data4, 16),
          sequenceIndex: sequencesFound,
          timestamp: new Date(`20${annee}`, parseInt(mois)-1, parseInt(date), parseInt(heures), parseInt(minutes)).getTime(),
          details: typeInfo.details
        });

        console.log(`📝 [RECHARGE] Ajout recharge - ${dateFormatee} ${heureFormatee}: Client ${numClient}, Crédit ${credit}, Durée ${uniteDuree}, Forfait ${numForfait}`);
      } else {
        // Enregistrer aussi les autres types pour le débogage
        console.log(`ℹ️  [RECHARGE] Autre type détecté: ${typeInfo.type} - ${typeInfo.details}`);
      }

      i += 12; // Passer à la prochaine séquence
    }
    
    // Gérer également les codes F7 (trame vide) et F5 (fin)
    if (b === "F7" || b === "F5") {
      console.log(`ℹ️  [RECHARGE] Code ${b} détecté à la position ${i}`);
    }
  }

  // Tri chronologique
  const sortedResults = results.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`✅ [RECHARGE] Analyse terminée: ${sortedResults.length} recharges trouvées`);
  
  if (sortedResults.length > 0) {
    console.log('📋 [RECHARGE] Échantillon des premières recharges:');
    sortedResults.slice(0, 5).forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.date} ${row.heure} - Client ${row.client}, Crédit ${row.credit}, Durée ${row.uniteDuree}, Forfait ${row.forfait}`);
    });
  }

  return sortedResults;
}

function isValidHex(value) {
  return /^[0-9A-F]{2}$/.test(value);
}

function analyserTypeCodeDetaille(typeCodeBin, data1, data2, data3, data4) {
  const bits = typeCodeBin.split('').reverse(); // bit0 est le LSB
  let type = "Inconnu";
  let details = "";
  let bitsActifs = [];
  
  console.log(`🔍 [RECHARGE] Analyse typeCode: ${typeCodeBin}, bits: ${bits.join('')}`);
  
  // Bit0 = 1 si code recharge
  if (bits[0] === "1") {
    type = "Recharge";
    const numClient = parseInt(data1, 16);
    const credit = parseInt(data2, 16);
    const uniteDuree = parseInt(data3, 16);
    const numForfait = parseInt(data4, 16);
    details = `Client: ${numClient}, Crédit: ${credit}, Unité durée: ${uniteDuree}, Forfait: ${numForfait}`;
    bitsActifs.push(0);
  }
  
  // Bit1 = 1 si code éco
  if (bits[1] === "1") {
    type = "Mode ECO";
    const modeEco = parseInt(data2, 16) === 0x01 ? "ON" : "OFF";
    const tensionPartiel = parseInt(data3, 16);
    const tensionTotal = parseInt(data4, 16);
    details = `Mode ECO: ${modeEco}, Tension délestage partiel: ${tensionPartiel}V, Tension délestage total: ${tensionTotal}V`;
    bitsActifs.push(1);
  }
  
  // Bit2 = 1 si code EP (Éclairage Public)
  if (bits[2] === "1") {
    type = "Éclairage Public";
    const epGratuit = parseInt(data2, 16) === 0x01 ? "GRATUIT" : "PAYANT";
    const heureDemarrage = parseInt(data3, 16);
    details = `Éclairage Public: ${epGratuit}, Heure démarrage: ${heureDemarrage}h`;
    bitsActifs.push(2);
  }
  
  // Bit3 = 1 si code tolérance
  if (bits[3] === "1") {
    type = "Tolérance";
    const toleranceEnergie = parseInt(data2, 16);
    const tolerancePuissance = parseInt(data3, 16);
    details = `Tolérance énergie: ${toleranceEnergie}%, Tolérance puissance: ${tolerancePuissance}%`;
    bitsActifs.push(3);
  }
  
  // Bit4 = 1 si code forfait
  if (bits[4] === "1") {
    type = "Configuration Forfait";
    const numForfait = parseInt(data2, 16);
    const puissance = parseInt(data3, 16);
    const heuresParJour = parseInt(data4, 16);
    details = `Forfait: ${numForfait}, Puissance: ${puissance}W, Heures/jour: ${heuresParJour}h`;
    bitsActifs.push(4);
  }
  
  // Si aucun bit défini, vérifier si c'est une trame vide (0xFF)
  if (bitsActifs.length === 0 && data1 === "FF" && data2 === "FF" && data3 === "FF" && data4 === "FF") {
    type = "Trame vide";
    details = "Données 0xFF (trame vide ou padding)";
  }
  
  // Si plusieurs bits sont à 1, on précise
  if (bitsActifs.length > 1) {
    details += ` [Bits actifs: ${bitsActifs.join(', ')}]`;
  }
  
  // Si toujours inconnu, afficher les données brutes
  if (type === "Inconnu") {
    details = `Données brutes: ${data1} ${data2} ${data3} ${data4}`;
  }
  
  return { type, details, bitsActifs };
}

// ======================== FILTRES PAR CLIENT ========================
export const getUniqueClients = (results) => {
  if (!results || !results.length) return [];
  
  const clients = [...new Set(results.map(r => r.client))].sort((a, b) => a - b);
  console.log(`👥 [RECHARGE] Clients uniques trouvés: ${clients.length}`);
  return clients;
};

export const filterRechargesByClient = (results, clientId) => {
  if (!results || !results.length) return [];
  
  if (!clientId || clientId === 'all') {
    return results;
  }
  
  const clientNum = parseInt(clientId);
  const filtered = results.filter(r => r.client === clientNum);
  
  console.log(`🔍 [RECHARGE] Filtrage client ${clientNum}: ${filtered.length} recharges trouvées`);
  return filtered;
};

// ======================== CALCULS RECHARGE ========================
export const generateRechargeDailySummary = (results) => {
  if (!results || !results.length) {
    console.warn('❌ [RECHARGE] Aucune donnée pour générer le résumé journalier');
    return [];
  }

  const dailyMap = results.reduce((acc, r) => {
    if (!acc[r.date]) {
      acc[r.date] = {
        date: r.date,
        recharges: [],
        clients: new Set(),
        totalCredit: 0,
        totalDuree: 0,
        forfaits: new Set()
      };
    }
    
    acc[r.date].recharges.push(r);
    acc[r.date].clients.add(r.client);
    acc[r.date].totalCredit += r.credit;
    acc[r.date].totalDuree += r.uniteDuree;
    acc[r.date].forfaits.add(r.forfait);
    
    return acc;
  }, {});

  const summary = Object.values(dailyMap).map(d => ({
    date: d.date,
    nbRecharges: d.recharges.length,
    nbClients: d.clients.size,
    creditTotal: d.totalCredit,
    dureeTotal: d.totalDuree,
    forfaits: Array.from(d.forfaits).map(f => FORFAITS_RECHARGE[f]?.nom || `Forfait ${f}`).join(', ')
  }));

  // Tri chronologique
  const sortedSummary = summary.sort((a, b) => {
    const convertToComparableDate = (dateStr) => {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };
    return convertToComparableDate(a.date).localeCompare(convertToComparableDate(b.date));
  });

  console.log(`📊 [RECHARGE] Résumé journalier: ${sortedSummary.length} jours`);
  return sortedSummary;
};

// ======================== ALERTES RECHARGE ========================
export const detectRechargeAnomalies = (results, daily) => {
  const alerts = [];

  if (!daily.length) {
    console.warn('⚠️ [RECHARGE] Aucune donnée quotidienne pour détecter les anomalies');
    return alerts;
  }

  // Alertes basées sur le résumé journalier
  daily.forEach(d => {
    if (d.nbRecharges === 0) {
      alerts.push({
        type: 'warning',
        icon: '📭',
        title: 'Aucune recharge',
        message: `Aucune recharge détectée ce jour`,
        date: d.date
      });
    }
    
    if (d.creditTotal < 10) {
      alerts.push({
        type: 'info',
        icon: '💰',
        title: 'Crédit total faible',
        message: `Seulement ${d.creditTotal} unités de crédit`,
        date: d.date
      });
    }
    
    if (d.nbClients > 5) {
      alerts.push({
        type: 'info',
        icon: '👥',
        title: 'Multiples clients',
        message: `${d.nbClients} clients différents`,
        date: d.date
      });
    }
  });

  // Alertes basées sur les données brutes
  let creditMax = 0;
  let rechargeMax = null;
  
  results.forEach(recharge => {
    if (recharge.credit > creditMax) {
      creditMax = recharge.credit;
      rechargeMax = recharge;
    }
  });

  if (rechargeMax && creditMax > 50) {
    alerts.push({
      type: 'info',
      icon: '🏆',
      title: 'Recharge importante',
      message: `Recharge de ${creditMax} unités (Client ${rechargeMax.client})`,
      date: rechargeMax.date
    });
  }

  // Vérifier les durées inhabituelles
  results.forEach(recharge => {
    if (recharge.uniteDuree > 100) {
      alerts.push({
        type: 'info',
        icon: '⏱️',
        title: 'Durée inhabituelle',
        message: `Durée de ${recharge.uniteDuree} unités (Client ${recharge.client})`,
        date: recharge.date
      });
    }
  });

  console.log(`🚨 [RECHARGE] Alertes détectées: ${alerts.length}`);
  return alerts;
};

// ======================== ONGLET ACHAT ========================
function createAchatHTML(results, daily) {
  if (!results || !results.length) {
    return '<div class="no-data">📊 Aucune donnée d\'achat disponible</div>';
  }

  const totalAchats = results.length;
  const totalCredit = results.reduce((sum, r) => sum + r.credit, 0);
  const totalDuree = results.reduce((sum, r) => sum + r.uniteDuree, 0);
  const clientsUniques = new Set(results.map(r => r.client)).size;
  const forfaitsUtilises = new Set(results.map(r => r.forfait)).size;

  const forfaitsStats = {};
  results.forEach(r => {
    if (!forfaitsStats[r.forfait]) {
      forfaitsStats[r.forfait] = {
        count: 0,
        totalCredit: 0,
        totalDuree: 0,
        nom: FORFAITS_RECHARGE[r.forfait]?.nom || `Forfait ${r.forfait}`
      };
    }
    forfaitsStats[r.forfait].count++;
    forfaitsStats[r.forfait].totalCredit += r.credit;
    forfaitsStats[r.forfait].totalDuree += r.uniteDuree;
  });

  // Trier les résultats du plus récent au plus ancien
  const dernieresRecharges = [...results].reverse().slice(0, 50);

  return `
    <div class="achat-container">
      <div class="achat-header">
        <div class="achat-stats-grid">
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-content">
              <div class="stat-value">${totalAchats}</div>
              <div class="stat-label">Total Recharges</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <div class="stat-value">${clientsUniques}</div>
              <div class="stat-label">Clients Uniques</div>
            </div>
          </div>
        </div>
      </div>

      <div class="achat-table-section">
        <h4>🛒 Dernières Recharges (${dernieresRecharges.length} affichées)</h4>
        <div class="table-wrapper">
          <table class="data-table achat-table detailed-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Heure</th>
                <th>Client</th>
                <th>Crédit</th>
                <th>Durée</th>
                <th>Forfait</th>
                <th>ID Recharge</th>
              </tr>
            </thead>
            <tbody>
              ${dernieresRecharges.map((recharge, index) => `
                <tr>
                  <td style="font-weight: bold; color: #718096;">${index + 1}</td>
                  <td style="font-weight: 500;">${recharge.date}</td>
                  <td style="color: #4b5563;">${recharge.heure}</td>
                  <td style="font-weight: bold; color: #1e40af;">
                    <div>${recharge.client}</div>
                  </td>
                  <td style="font-weight: bold; color: #059669;">
                    <div>${recharge.credit} unités</div>
                  </td>
                  <td style="font-weight: 500; color: #7c3aed;">
                    <div>${recharge.uniteDuree} jour(s)</div>
                  </td>
                  <td>
                    <div>${recharge.nomForfait}</div>
                  </td>
                  <td style="color: #6b7280; font-size: 0.9em;">
                    <div>${recharge.idRecharge}</div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${results.length > 50 ? 
          `<div class="table-info">📋 ${results.length} recharges au total, ${dernieresRecharges.length} affichées</div>` : 
          `<div class="table-info">📋 ${results.length} recharges au total</div>`
        }
      </div>
    </div>
  `;
}

// ======================== VUE CLIENTS ========================
function createClientsHTML(uniqueClients, results) {
  if (!uniqueClients.length) {
    return '<div class="no-data">Aucun client trouvé</div>';
  }

  const clientsStats = uniqueClients.map(clientId => {
    const clientRecharges = results.filter(r => r.client === clientId);
    const totalCredit = clientRecharges.reduce((sum, r) => sum + r.credit, 0);
    const totalDuree = clientRecharges.reduce((sum, r) => sum + r.uniteDuree, 0);
    const forfaits = [...new Set(clientRecharges.map(r => r.forfait))];
    const forfaitsDetails = forfaits.map(f => FORFAITS_RECHARGE[f]?.nom || `Forfait ${f}`).join(', ');
    
    // Trier les recharges par date décroissante
    const rechargesTriees = [...clientRecharges].sort((a, b) => b.timestamp - a.timestamp);
    
    return {
      id: clientId,
      nbRecharges: clientRecharges.length,
      totalCredit: totalCredit,
      totalDuree: totalDuree,
      creditMoyen: clientRecharges.length > 0 ? Math.round(totalCredit / clientRecharges.length) : 0,
      dureeMoyenne: clientRecharges.length > 0 ? Math.round(totalDuree / clientRecharges.length) : 0,
      forfaits: forfaitsDetails,
      premiereRecharge: clientRecharges[0]?.date || '-',
      derniereRecharge: rechargesTriees[0]?.date || '-',
      derniereHeure: rechargesTriees[0]?.heure || '-',
      forfaitsList: forfaits,
      derniereRechargeObj: rechargesTriees[0] || null
    };
  });

  clientsStats.sort((a, b) => b.nbRecharges - a.nbRecharges);

  return `
    <div class="clients-container">
      <div class="clients-header">
        <h4>👥 Clients (${uniqueClients.length})</h4>
        <div class="clients-summary">
          <span>${results.length} recharges totales</span>
          <span>${clientsStats.reduce((sum, c) => sum + c.totalCredit, 0)} crédits totaux</span>
          <span>${clientsStats.reduce((sum, c) => sum + c.totalDuree, 0)} durée totale</span>
        </div>
      </div>
      
      <div class="table-wrapper">
        <table class="data-table clients-table">
          <thead>
            <tr>
              <th>#</th>
              <th>ID Client</th>
              <th>Recharges</th>
              <th>Crédit Total</th>
              <th>Durée Total</th>
              <th>Crédit Moyen</th>
              <th>Durée Moyenne</th>
              <th>Dernière Recharge</th>
              <th>Forfaits</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${clientsStats.map((client, index) => `
              <tr data-client-id="${client.id}">
                <td style="font-weight: bold; color: #718096;">${index + 1}</td>
                <td style="font-weight: bold; color: #1e40af;">Client ${client.id}</td>
                <td style="font-weight: 500;">${client.nbRecharges}</td>
                <td style="font-weight: bold; color: #059669;">${client.totalCredit} unités</td>
                <td style="font-weight: bold; color: #7c3aed;">${client.totalDuree} unités</td>
                <td style="color: #4b5563;">${client.creditMoyen} unités</td>
                <td style="color: #4b5563;">${client.dureeMoyenne} unités</td>
                <td style="color: #6b7280;">
                  <div>${client.derniereRecharge}</div>
                  <div style="font-size: 0.8em; color: #9ca3af;">${client.derniereHeure}</div>
                </td>
                <td>
                  <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    ${client.forfaitsList.map(f => {
                      const forfait = FORFAITS_RECHARGE[f];
                      return `<span class="forfait-badge ${forfait?.classe || 'forfait-inconnu'}">
                        <span>${forfait?.nom || f}</span>
                      </span>`;
                    }).join('')}
                  </div>
                </td>
                <td>
                  <button class="btn-filter-client" 
                          data-client-id="${client.id}"
                          title="Filtrer ce client">
                    🔍 Filtrer
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="clients-actions">
        <button id="reset-all-filters" class="btn-reset">
          Réinitialiser tous les filtres
        </button>
      </div>
    </div>
  `;
}

// ======================== MISE À JOUR UI ========================
function updateRechargeUI(fileId, filteredResults, filteredDaily) {
  const container = document.querySelector(`.recharge-file-section[data-file-id="${fileId}"]`);
  if (!container) return;
  
  const clientId = window.rechargeResults?.[fileId]?.currentClient || 'all';
  
  const title = container.querySelector('.file-header h4');
  if (title) {
    const baseTitle = title.textContent.replace(/Document /, '').replace(/ - Client \d+$/, '');
    if (clientId === 'all') {
      title.textContent = `Document ${baseTitle}`;
    } else {
      title.textContent = `Document ${baseTitle} - Client ${clientId}`;
    }
  }
  
  const statsDiv = container.querySelector('.data-stats');
  if (statsDiv) {
    statsDiv.innerHTML = `
      ${filteredResults.length} recharges filtrées |
      ${filteredDaily.length} jours avec recharges |
      ${getUniqueClients(filteredResults).length} clients différents
    `;
  }
  
  const achatTab = container.querySelector('#recharge-achat-' + fileId);
  if (achatTab) {
    achatTab.innerHTML = createAchatHTML(filteredResults, filteredDaily);
  }
  
  const clientsTab = container.querySelector('#recharge-clients-' + fileId);
  if (clientsTab) {
    clientsTab.innerHTML = createClientsHTML(getUniqueClients(filteredResults), filteredResults);
  }
  
  console.log(`🔄 [RECHARGE] UI mise à jour pour ${fileId}, client: ${clientId}`);
}

// ======================== SECTION FICHIER ========================
function createRechargeFileSectionHTML(file, results, daily, alerts) {
  const id = file.name.replace(/[^a-zA-Z0-9]/g, '_');
  
  const uniqueClients = getUniqueClients(results);
  
  if (!window.rechargeResults) window.rechargeResults = {};
  window.rechargeResults[id] = {
    allResults: results,
    filteredResults: results,
    currentClient: 'all'
  };

  const clientFilterHTML = `
    <div class="client-filter-container">
      <label for="client-filter-${id}">Filtrer par client :</label>
      <select id="client-filter-${id}" class="client-filter-select" data-file-id="${id}">
        <option value="all">Tous les clients (${uniqueClients.length})</option>
        ${uniqueClients.map(clientId => 
          `<option value="${clientId}">Client ${clientId}</option>`
        ).join('')}
      </select>
      <button class="clear-filter-btn" data-file-id="${id}" style="display: none;">
        Effacer le filtre
      </button>
    </div>
  `;

  return `
    <div class="recharge-file-section" data-file-id="${id}">
      <div class="file-header">
        <h4>Document ${file.name}</h4>
        ${file.client ? `<div class="client-badge">Client: ${file.client}</div>` : ''}
        <div class="forfait-badge">Type: Recharges</div>
        <div class="data-stats">
          ${results.length} recharges analysées |
          ${daily.length} jours avec recharges |
          ${uniqueClients.length} clients différents
        </div>
      </div>
      
      <div class="filters-section">
        ${clientFilterHTML}
      </div>
      
      <div class="recharge-tabs-container">
        <div class="recharge-tabs-header">
          <button class="recharge-tab active" data-tab="recharge-achat-${id}">Achat</button>
          <button class="recharge-tab" data-tab="recharge-clients-${id}">
            Clients<span class="tab-badge">${uniqueClients.length}</span>
          </button>
        </div>

        <div class="recharge-tab-content active" id="recharge-achat-${id}">
          ${createAchatHTML(results, daily)}
        </div>
        
        <div class="recharge-tab-content" id="recharge-clients-${id}">
          ${createClientsHTML(uniqueClients, results)}
        </div>
      </div>
    </div>`;
}

// ======================== GESTION DES FILTRES ========================
export function initializeRechargeFilters() {
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('client-filter-select')) {
      const fileId = e.target.dataset.fileId;
      const clientId = e.target.value;
      const clearBtn = document.querySelector(`.clear-filter-btn[data-file-id="${fileId}"]`);
      
      if (clearBtn) {
        clearBtn.style.display = clientId === 'all' ? 'none' : 'inline-block';
      }
      
      applyClientFilter(fileId, clientId);
    }
  });
  
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('clear-filter-btn')) {
      const fileId = e.target.dataset.fileId;
      const select = document.getElementById(`client-filter-${fileId}`);
      
      if (select) {
        select.value = 'all';
        e.target.style.display = 'none';
        applyClientFilter(fileId, 'all');
      }
    }
    
    if (e.target.classList.contains('btn-filter-client')) {
      const clientId = e.target.dataset.clientId;
      const fileSection = e.target.closest('.recharge-file-section');
      const fileId = fileSection?.dataset.fileId;
      
      if (fileId && clientId) {
        const select = document.getElementById(`client-filter-${fileId}`);
        if (select) {
          select.value = clientId;
          select.dispatchEvent(new Event('change'));
        }
      }
    }
    
    if (e.target.id === 'reset-all-filters') {
      document.querySelectorAll('.client-filter-select').forEach(select => {
        select.value = 'all';
        const fileId = select.dataset.fileId;
        const clearBtn = document.querySelector(`.clear-filter-btn[data-file-id="${fileId}"]`);
        if (clearBtn) clearBtn.style.display = 'none';
        applyClientFilter(fileId, 'all');
      });
    }
  });
}

function applyClientFilter(fileId, clientId) {
  if (!window.rechargeResults?.[fileId]) return;
  
  const { allResults } = window.rechargeResults[fileId];
  const filteredResults = filterRechargesByClient(allResults, clientId);
  const filteredDaily = generateRechargeDailySummary(filteredResults);
  
  window.rechargeResults[fileId] = {
    ...window.rechargeResults[fileId],
    filteredResults,
    currentClient: clientId
  };
  
  updateRechargeUI(fileId, filteredResults, filteredDaily);
}

// ======================== GESTION DE L'UI ========================
export function initializeRechargeTabs() {
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.recharge-tab');
    if (!tab) return;

    const targetId = tab.dataset.tab;
    const container = tab.closest('.recharge-tabs-container');

    container.querySelectorAll('.recharge-tab').forEach(t => t.classList.remove('active'));
    container.querySelectorAll('.recharge-tab-content').forEach(c => c.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(targetId)?.classList.add('active');
  });
}

// ======================== UTILITAIRES GLOBAUX ========================
function loadRechargeCSS() {
  if (document.querySelector('link[href*="rechargeAnalyzer.css"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './analyzer/rechargeAnalyzer.css';
  document.head.appendChild(link);
}

// ======================== INITIALISATION PRINCIPALE ========================
export function createRechargeAnalysisContent(files) {
  if (!files?.length) return '<p class="no-data">Aucun fichier recharge</p>';

  loadRechargeCSS();
  window.rechargeResults = {};

  const html = files.map(file => {
    console.log(`🔍 [RECHARGE] Analyse du fichier: ${file.name}`);

    const results = analyzeRecharge(file.content);
    const daily = generateRechargeDailySummary(results);
    const alerts = detectRechargeAnomalies(results, daily);

    return createRechargeFileSectionHTML(file, results, daily, alerts);
  }).join('');

  setTimeout(() => {
    initializeRechargeTabs();
    initializeRechargeFilters();
  }, 300);

  return html;
}

// ======================== EXPORT PAR DÉFAUT ========================
export default {
  analyzeRecharge,
  createRechargeAnalysisContent,
  generateRechargeDailySummary,
  detectRechargeAnomalies,
  getUniqueClients,
  filterRechargesByClient,
  initializeRechargeTabs,
  initializeRechargeFilters
};