/**
 * NanorParser.js
 * Décodeur de fichiers de relevé NanoR pour version Web
 * Avec gestion complète des heures : synchronisation, incrémentation +1h, reset à minuit
 */

class NanorParser {
    constructor() {
        this.sdf = (date, time) => `${date} ${time}`;
    }

    /**
     * Point d'entrée principal pour parser un fichier
     * @param {string} fileName Nom du fichier (ex: E01_..., T_..., EvNR_...)
     * @param {string} fileContent Contenu complet du fichier texte
     */
    parseFile(fileName, fileContent) {
        if (!fileContent || !fileContent.includes("=== DONNÉES BRUTES ===")) {
            return [];
        }

        const isEvnrFile = fileName.startsWith("EvNR_");
        const isEcFile = fileName.startsWith("EC_");
        const isCreditFile = fileName.startsWith("C");
        const isRechargeFile = fileName.startsWith("R_");
        const isEnergyFile = fileName.startsWith("E");
        const isTensionFile = fileName.startsWith("T_");

        // Extraction de la partie après le marqueur
        const dataMarker = "=== DONNÉES BRUTES ===";
        const dataPart = fileContent.split(dataMarker)[1].trim();
        const allParts = dataPart.split(/\s+/);

        let rows = [];
        let currentH = 0;
        let currentM = 0;
        let lastDate = null;
        let isTimeRecentlySet = false;
        let i = 0;
        let ignoredCount = 0;

        while (i < allParts.length) {
            let part = allParts[i];

            // --- 1. FILTRAGE DES DONNÉES À IGNORER ---
            
            if (part === "FF") {
                i++;
                continue;
            }

            // Ignorer les en-têtes de protocole (REL_START et REL_OK)
            if (part === "52" && allParts[i+1] === "45" && allParts[i+2] === "4C" && allParts[i+3] === "5F") {
                if (allParts[i+4] === "53") { i += 9; continue; }
                if (allParts[i+4] === "4F") { i += 6; continue; }
            }

            // Ignorer les trames techniques
            if (["D6", "D7", "E6", "E7"].includes(part)) { i += 7; continue; }
            if (["A5", "B5", "C5", "E5"].includes(part)) { i += 8; continue; }
            if (["A6", "B6", "C6"].includes(part)) { i += 7; continue; }
            if (["A7", "B7", "C7"].includes(part)) { i += 8; continue; }

            // --- 2. TRAITEMENT DES MARQUEURS DE SYNCHRONISATION HORAIRE ---
            if (["D2", "E2", "A2", "B2", "C2", "F2"].includes(part) && i + 5 < allParts.length) {
                if (this.isValidDate(allParts, i + 1)) {
                    lastDate = `${allParts[i+1]}/${allParts[i+2]}/20${allParts[i+3]}`;
                    currentH = parseInt(allParts[i+4], 10) || 0;
                    currentM = parseInt(allParts[i+5], 10) || 0;
                    isTimeRecentlySet = true;
                }
                i += 6;
                continue;
            }

            // --- 3. TRAITEMENT DES DONNÉES UTILES ---

            // Marqueur Recharge (F3)
            if (part === "F3" && i + 12 < allParts.length) {
                if (this.isValidDate(allParts, i + 1)) {
                    rows.push(this.decodeRecharge(allParts.slice(i + 1, i + 13)));
                    i += 13;
                } else i++;
                continue;
            }

            // Marqueur Événement NR (D3)
            if (part === "D3" && i + 8 < allParts.length) {
                if (this.isValidDate(allParts, i + 1)) {
                    const date = `${allParts[i+1]}/${allParts[i+2]}/20${allParts[i+3]}`;
                    
                    if (lastDate && lastDate !== date) {
                        currentH = 0;
                        currentM = 0;
                        isTimeRecentlySet = false;
                    }
                    lastDate = date;
                    
                    rows.push({
                        date: date,
                        time: `${allParts[i+4]}:${allParts[i+5]}`,
                        etatNR: this.decodeEtatNR(allParts[i+6]),
                        tBatt: this.decodeTBatt(allParts[i+7], allParts[i+8]),
                        isEvent: true
                    });
                    i += 9;
                } else i++;
                continue;
            }

            // Marqueur Événement Client (E3)
            if (part === "E3" && i + 9 < allParts.length) {
                if (this.isValidDate(allParts, i + 1)) {
                    const date = `${allParts[i+1]}/${allParts[i+2]}/20${allParts[i+3]}`;
                    
                    if (lastDate && lastDate !== date) {
                        currentH = 0;
                        currentM = 0;
                        isTimeRecentlySet = false;
                    }
                    lastDate = date;
                    
                    const pf = allParts[i+8];
                    const pb = allParts[i+9];
                    const valHex = pf + pb;
                    const valInt = parseInt(valHex, 16);
                    
                    const courantEnAmperes = valInt / 100;
                    
                    rows.push({
                        date: date,
                        time: `${allParts[i+4]}:${allParts[i+5]}`,
                        clientNum: allParts[i+6],
                        etatClient: this.decodeEtatClient(allParts[i+7]),
                        courant: courantEnAmperes.toFixed(2),
                        valeurBrute: valInt,
                        hexCourant: valHex,
                        isClientEvent: true
                    });
                    i += 10;
                } else i++;
                continue;
            }

            // Données Standards avec marqueurs (A3, B3, C3) - Énergie, Crédit, Tension
            if (["A3", "B3", "C3"].includes(part) && i + 5 < allParts.length) {
                if (this.isValidDate(allParts, i + 1)) {
                    const date = `${allParts[i+1]}/${allParts[i+2]}/20${allParts[i+3]}`;
                    
                    if (lastDate && lastDate !== date) {
                        currentH = 0;
                        currentM = 0;
                        isTimeRecentlySet = false;
                    }
                    
                    if (lastDate && lastDate === date && !isTimeRecentlySet && (isEnergyFile || isTensionFile)) {
                        currentH = (currentH + 1) % 24;
                    }
                    
                    lastDate = date;
                    
                    const hex = allParts[i+4] + allParts[i+5];
                    const intVal = parseInt(hex, 16);
                    
                    const timeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
                    
                    // TRAITEMENT SPÉCIAL POUR CRÉDIT : ignorer les valeurs > 200
                    if (isCreditFile) {
                        if (intVal > 200) {
                            ignoredCount++;
                            console.log(`🚫 Crédit ignoré - Valeur ${intVal} > 200 (${hex})`);
                            isTimeRecentlySet = false;
                            i += 6;
                            continue;
                        }
                    }
                    
                    if (isTensionFile) {
                        const tensionVal = intVal / 1000;
                        // MODIFICATION: retirer l'unité "V" de la valeur
                        rows.push({
                            date: date,
                            time: timeStr,
                            tension: tensionVal.toFixed(3),
                            hexVal: hex,
                            type: part
                        });
                    } else {
                        rows.push({
                            date: date,
                            time: timeStr,
                            intVal: intVal,
                            hexVal: hex,
                            type: part
                        });
                    }
                    
                    isTimeRecentlySet = false;
                    i += 6;
                } else i++;
                continue;
            }

            // Format sans marqueur
            if (i + 4 < allParts.length && this.isValidDate(allParts, i)) {
                const date = `${allParts[i]}/${allParts[i+1]}/20${allParts[i+2]}`;
                
                if (lastDate && lastDate !== date) {
                    currentH = 0;
                    currentM = 0;
                    isTimeRecentlySet = false;
                }
                
                if (lastDate && lastDate === date && !isTimeRecentlySet && (isEnergyFile || isTensionFile)) {
                    currentH = (currentH + 1) % 24;
                }
                
                lastDate = date;
                
                const hex = allParts[i+3] + allParts[i+4];
                const intVal = parseInt(hex, 16);
                const timeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
                
                // TRAITEMENT SPÉCIAL POUR CRÉDIT : ignorer les valeurs > 200
                if (isCreditFile) {
                    if (intVal > 200) {
                        ignoredCount++;
                        console.log(`🚫 Crédit ignoré (sans marqueur) - Valeur ${intVal} > 200 (${hex})`);
                        isTimeRecentlySet = false;
                        i += 5;
                        continue;
                    }
                }
                
                if (isTensionFile) {
                    const tensionVal = intVal / 1000;
                    // MODIFICATION: retirer l'unité "V" de la valeur
                    rows.push({
                        date: date,
                        time: timeStr,
                        tension: tensionVal.toFixed(3),
                        hexVal: hex
                    });
                } else {
                    rows.push({
                        date: date,
                        time: timeStr,
                        intVal: intVal,
                        hexVal: hex
                    });
                }
                
                isTimeRecentlySet = false;
                i += 5;
                continue;
            }

            i++;
        }

        if (ignoredCount > 0) {
            console.log(`📊 Total des valeurs crédit ignorées (${ignoredCount}) car > 200`);
        }

        return rows;
    }

    isValidDate(parts, idx) {
        if (idx + 2 >= parts.length) return false;
        const jj = parseInt(parts[idx], 10);
        const mm = parseInt(parts[idx+1], 10);
        return (jj >= 1 && jj <= 31 && mm >= 1 && mm <= 12);
    }

    decodeEtatNR(hex) {
        const v = parseInt(hex, 16);
        let b = [];
        if (v & 0x02) b.push("Délestage Total");
        if (v & 0x04) b.push("Délestage Partiel");
        return b.length === 0 ? "NORMAL" : b.join(" + ");
    }

    decodeTBatt(pf, pb) {
        const val = parseInt(pf + pb, 16);
        // Retirer l'unité "V" de la valeur
        return (val / 100).toFixed(1);
    }

    decodeEtatClient(hex) {
        const v = parseInt(hex, 16);
        let bits = [];
        if (!(v & 0x1E)) bits.push(v & 0x01 ? "ACTIF" : "INACTIF");
        if (v & 0x02) bits.push("Crédit Nul");
        if (v & 0x04) bits.push("Énergie Épuisée");
        if (v & 0x08) bits.push("Surcharge");
        if (v & 0x10) bits.push("Puis. Dépassée");
        return bits.join(", ");
    }

    decodeRecharge(p) {
        const typeHex = p[5];
        const typeInt = parseInt(typeHex, 16);
        return {
            date: `${p[0]}/${p[1]}/20${p[2]}`,
            time: `${p[3]}:${p[4]}`,
            typeCode: (typeInt & 0x01) ? "RECHARGE" : "AUTRE",
            idRecharge: parseInt(p[6] + p[7], 16).toString(),
            data1: p[8] + " | " + p[9],
            isRecharge: !!(typeInt & 0x01),
            isRechargeEvent: true
        };
    }
}