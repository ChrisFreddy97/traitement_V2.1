class FileReaderModule {
    constructor() {
        this.currentFile = null;
        this.parsedData = {
            nrNumber: null,
            tables: []
        };
        this.currentPages = {}; // Stocker la page courante pour chaque tableau
        this.rowsPerPage = 10; // 10 lignes par page
        this.activeTab = 'tech'; // Onglet actif par défaut
        
        // Nouveau : système détecté (12V ou 24V)
        this.detectedSystem = null;
        
        // Nouveau : normes des systèmes
        this.systemNorms = {
            '12V': {
                min: 11,
                idealMin: 12,
                idealMax: 14.5,
                max: 15,
                variationMax: 2.5
            },
            '24V': {
                min: 22,
                idealMin: 24,
                idealMax: 29,
                max: 31,
                variationMax: 3
            }
        };
        
        this.init();
    }

    init() {
        this.uploadArea = document.querySelector('.upload-mini-area');
        this.fileInput = document.getElementById('fileInput');
        this.fileInfo = document.querySelector('.file-info-mini');
        this.contentContainer = document.getElementById('contentContainer');
        this.contentDisplay = document.getElementById('contentDisplay');
        this.fileContent = document.getElementById('fileContent');
        
        // Nouveaux éléments
        this.loadingContainer = document.getElementById('loadingContainer');
        this.progressBar = document.getElementById('progressBar');
        this.loadingText = document.getElementById('loadingText');
        this.nrInfo = document.getElementById('nrInfo');
        this.tabsContainer = document.getElementById('tabsContainer');
        this.techTab = document.getElementById('techTab');
        this.comTab = document.getElementById('comTab');
        this.techContent = document.getElementById('techContent');
        this.comContent = document.getElementById('comContent');
        this.techTabBtn = document.getElementById('techTabBtn');
        this.comTabBtn = document.getElementById('comTabBtn');

        this.bindEvents();
        
        // Exposer les fonctions globalement
        window.fileReader = this;
        window.switchTab = (tab) => this.switchTab(tab);
        window.changePage = (tableId, direction) => this.changePage(tableId, direction);
        window.fileReader.updateHourlyChart = this.updateHourlyChart.bind(this);
        window.fileReader.refreshHourlyChart = this.refreshHourlyChart.bind(this);
    }

    bindEvents() {
        // Click pour sélectionner un fichier
        this.uploadArea.addEventListener('click', () => this.fileInput.click());

        // Drag & Drop events
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });
        
        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });
        
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.processFile(file);
        });

        // File input event
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.processFile(file);
        });
    }

    async processFile(file) {
        this.currentFile = file;
        this.fileInfo.textContent = `📄 ${file.name}`;
        
        // Afficher le loading
        this.showLoading();
        
        // Simuler une progression
        await this.simulateProgress();
        
        // Lire le fichier
        await this.readFile(file);
    }

    showLoading() {
        this.loadingContainer.style.display = 'block';
        this.contentContainer.style.display = 'none';
        this.progressBar.style.width = '0%';
        this.loadingText.textContent = 'Analyse du fichier en cours...';
    }

    simulateProgress() {
        return new Promise((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress >= 90) {
                    progress = 90;
                    clearInterval(interval);
                    resolve();
                }
                this.progressBar.style.width = `${progress}%`;
            }, 100);
        });
    }

    readFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const content = e.target.result;
                
                // Compléter la progression
                this.progressBar.style.width = '100%';
                this.loadingText.textContent = 'Organisation des données...';
                
                setTimeout(() => {
                    this.parseContent(content);
                    
                    // Détecter automatiquement le type de montage
                    this.detectSystemType();
                    
                    // Initialiser les pages pour chaque tableau
                    this.parsedData.tables.forEach((table, index) => {
                        const tableId = `table_${index}`;
                        this.currentPages[tableId] = 1;
                    });
                    
                    this.displayContent();
                    this.loadingContainer.style.display = 'none';
                    resolve();
                }, 500);
            };

            reader.onerror = (e) => {
                alert('Erreur lors de la lecture du fichier');
                this.loadingContainer.style.display = 'none';
                resolve();
            };

            // Lecture en UTF-8 par défaut
            reader.readAsText(file, 'UTF-8');
        });
    }

    parseContent(content) {
        const lines = content.split('\n');
        this.parsedData = {
            nrNumber: null,
            tables: []
        };

        let currentTable = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '') continue;

            // Extraire le numéro NR
            if (line.includes('<#NANORESEAU:')) {
                const match = line.match(/<#NANORESEAU:(\d+)>/);
                if (match) {
                    this.parsedData.nrNumber = match[1];
                }
                continue;
            }

            // Ignorer les lignes sans point-virgule
            if (!line.includes(';')) continue;

            // Détection d'un en-tête de tableau
            if (line.includes('Type') || line.includes('TimeStamp') || line.includes('Client') || line.includes('Tension')) {
                // Sauvegarder le tableau précédent s'il existe
                if (currentTable && currentTable.rows.length > 0) {
                    this.parsedData.tables.push(currentTable);
                }

                // Créer un nouveau tableau
                const headerCells = line.split(';').filter(cell => cell.trim() !== '');
                currentTable = {
                    header: headerCells,
                    rows: [],
                    types: new Set()
                };
                continue;
            }

            // Si on a un tableau en cours et que la ligne contient des ';'
            if (currentTable && line.includes(';')) {
                const cells = line.split(';').filter(cell => cell.trim() !== '');
                
                // Vérifier si c'est une ligne de données
                if (cells.length > 0 && cells[0].length <= 3 && cells.length >= 3) {
                    // Éviter les lignes d'en-tête
                    if (!cells[0].includes('Type') && !cells[0].includes('TimeStamp')) {
                        currentTable.rows.push(cells);
                        
                        // Capturer le type depuis la première colonne
                        if (cells[0] && cells[0].match(/^[A-Z]$/)) {
                            currentTable.types.add(cells[0]);
                        }
                    }
                }
            }
        }

        // Ajouter le dernier tableau
        if (currentTable && currentTable.rows.length > 0) {
            this.parsedData.tables.push(currentTable);
        }
    }

    // Nouvelle méthode : Détection automatique du type de système
    detectSystemType() {
        const tensionTables = this.parsedData.tables.filter(table => 
            Array.from(table.types).includes('T')
        );
        
        if (tensionTables.length === 0) {
            this.detectedSystem = '24V'; // Par défaut
            return;
        }
        
        let allTensions = [];
        
        tensionTables.forEach(table => {
            table.rows.forEach(row => {
                const tensionInstIndex = table.header.findIndex(h => 
                    h.includes('Tension Inst') || h.includes('Tension')
                );
                const tensionMinIndex = table.header.findIndex(h => h.includes('Tension Min'));
                const tensionMaxIndex = table.header.findIndex(h => h.includes('Tension Max'));
                
                if (tensionInstIndex !== -1) {
                    const value = parseFloat(row[tensionInstIndex]);
                    if (!isNaN(value)) allTensions.push(value);
                }
                if (tensionMinIndex !== -1) {
                    const value = parseFloat(row[tensionMinIndex]);
                    if (!isNaN(value)) allTensions.push(value);
                }
                if (tensionMaxIndex !== -1) {
                    const value = parseFloat(row[tensionMaxIndex]);
                    if (!isNaN(value)) allTensions.push(value);
                }
            });
        });
        
        if (allTensions.length === 0) {
            this.detectedSystem = '24V'; // Par défaut
            return;
        }
        
        // Calculer la tension moyenne
        const avgTension = allTensions.reduce((a, b) => a + b, 0) / allTensions.length;
        
        // Déterminer le système basé sur la tension moyenne
        // Si la moyenne est > 18V, c'est probablement du 24V, sinon du 12V
        this.detectedSystem = avgTension > 18 ? '24V' : '12V';
    }

    // ✅ NOUVELLE MÉTHODE : Analyse complète de conformité
    analyzeConformity() {
        if (!this.detectedSystem) return null;
        
        const norms = this.systemNorms[this.detectedSystem];
        const tensionTables = this.parsedData.tables.filter(table => 
            Array.from(table.types).includes('T')
        );
        
        if (tensionTables.length === 0) return null;
        
        // Structure pour stocker les données quotidiennes
        let dailyData = {};
        let allDays = new Set();
        
        // Collecter toutes les données par jour
        tensionTables.forEach(table => {
            const dateIndex = table.header.findIndex(h => 
                h.includes('TimeStamp') || h.includes('Date') || h.includes('DATE')
            );
            const tensionInstIndex = table.header.findIndex(h => 
                h.includes('Tension Inst') || h.includes('Tension')
            );
            
            if (dateIndex === -1 || tensionInstIndex === -1) return;
            
            table.rows.forEach(row => {
                const dateStr = row[dateIndex];
                if (!dateStr) return;
                
                const date = dateStr.split(' ')[0];
                allDays.add(date);
                
                const tension = parseFloat(row[tensionInstIndex]);
                if (isNaN(tension)) return;
                
                if (!dailyData[date]) {
                    dailyData[date] = {
                        values: [],
                        min: Infinity,
                        max: -Infinity,
                        previousValue: null,
                        maxVariation: 0,
                        violations: []
                    };
                }
                
                dailyData[date].values.push(tension);
                dailyData[date].min = Math.min(dailyData[date].min, tension);
                dailyData[date].max = Math.max(dailyData[date].max, tension);
                
                // Calculer la variation horaire
                if (dailyData[date].previousValue !== null) {
                    const variation = Math.abs(tension - dailyData[date].previousValue);
                    dailyData[date].maxVariation = Math.max(dailyData[date].maxVariation, variation);
                }
                dailyData[date].previousValue = tension;
            });
        });
        
        // Analyser chaque jour
        let conformingDays = 0;
        let nonConformingDays = 0;
        let criticalDays = 0;
        let daysAnalysis = [];
        
        Object.keys(dailyData).forEach(date => {
            const dayData = dailyData[date];
            const avgTension = dayData.values.reduce((a, b) => a + b, 0) / dayData.values.length;
            
            let isConforming = true;
            let severity = 'conforming';
            let violations = [];
            
            // ✅ CRITÈRE 1 : Tension minimale
            if (dayData.min < norms.min) {
                isConforming = false;
                severity = 'critical';
                violations.push({
                    type: 'min',
                    message: `Tension < ${norms.min}V (${dayData.min.toFixed(2)}V)`,
                    icon: '🔴'
                });
            }
            
            // ✅ CRITÈRE 2 : Tension maximale
            if (dayData.max > norms.max) {
                isConforming = false;
                severity = 'critical';
                violations.push({
                    type: 'max',
                    message: `Tension > ${norms.max}V (${dayData.max.toFixed(2)}V)`,
                    icon: '🔴'
                });
            }
            
            // ✅ CRITÈRE 3 : Variation journalière
            if (dayData.maxVariation > norms.variationMax) {
                isConforming = false;
                if (severity !== 'critical') severity = 'warning';
                violations.push({
                    type: 'variation',
                    message: `Variation > ${norms.variationMax}V/h (${dayData.maxVariation.toFixed(2)}V/h)`,
                    icon: '🟠'
                });
            }
            
            // ✅ CRITÈRE 4 : Hors plage idéale (warning seulement)
            if (avgTension < norms.idealMin || avgTension > norms.idealMax) {
                // Ne rend pas le jour non conforme, mais ajoute un warning
                if (isConforming) {
                    violations.push({
                        type: 'ideal',
                        message: `Hors plage idéale [${norms.idealMin}-${norms.idealMax}V]`,
                        icon: '🟡'
                    });
                }
            }
            
            // Compter les jours
            if (!isConforming) {
                nonConformingDays++;
                if (severity === 'critical') criticalDays++;
            } else {
                conformingDays++;
            }
            
            daysAnalysis.push({
                date: date,
                isConforming: isConforming,
                severity: severity,
                min: dayData.min.toFixed(2),
                max: dayData.max.toFixed(2),
                avg: avgTension.toFixed(2),
                variation: dayData.maxVariation.toFixed(2),
                violations: violations
            });
        });
        
        const totalDays = allDays.size;
        const conformityRate = totalDays > 0 ? 
            Math.round((conformingDays / totalDays) * 100) : 0;
        
        return {
            totalDays: totalDays,
            conformingDays: conformingDays,
            nonConformingDays: nonConformingDays,
            criticalDays: criticalDays,
            conformityRate: conformityRate,
            systemType: this.detectedSystem,
            daysAnalysis: daysAnalysis.sort((a, b) => new Date(b.date) - new Date(a.date))
        };
    }

    // ✅ NOUVELLE MÉTHODE : Générer l'affichage des stats de conformité
    generateConformityStatsHTML(conformityData) {
        if (!conformityData || conformityData.totalDays === 0) {
            return `
            <div class="conformity-container">
                <div class="conformity-header">
                    <span class="conformity-icon">📊</span>
                    <h4>Analyse de conformité</h4>
                    <span class="system-badge ${this.detectedSystem === '12V' ? 'system-12v' : 'system-24v'}">
                        ⚡ Système ${this.detectedSystem}
                    </span>
                </div>
                <div class="no-data-message">Données insuffisantes pour l'analyse</div>
            </div>`;
        }
        
        const rate = conformityData.conformityRate;
        let rateColor = '#22c55e'; // Vert
        let rateIcon = '✅';
        
        if (rate < 60) {
            rateColor = '#ef4444'; // Rouge
            rateIcon = '🔴';
        } else if (rate < 80) {
            rateColor = '#f59e0b'; // Orange
            rateIcon = '🟠';
        } else if (rate < 90) {
            rateColor = '#eab308'; // Jaune
            rateIcon = '🟡';
        }
        
        return `
        <div class="conformity-container">
            <div class="conformity-header">
                <span class="conformity-icon">📊</span>
                <h4>Analyse de conformité des tensions</h4>
                <span class="system-badge ${this.detectedSystem === '12V' ? 'system-12v' : 'system-24v'}">
                    ⚡ Système ${this.detectedSystem}
                </span>
            </div>
            
            <!-- Carte principale avec le taux de conformité -->
            <div class="conformity-main-card" style="background: linear-gradient(135deg, ${rateColor}10, white); border-left: 6px solid ${rateColor};">
                <div class="conformity-rate">
                    <span class="rate-icon">${rateIcon}</span>
                    <div>
                        <span class="rate-value" style="color: ${rateColor};">${rate}%</span>
                        <span class="rate-label">de jours conformes</span>
                    </div>
                </div>
                
                <div class="conformity-stats-grid">
                    <div class="stat-badge conforming">
                        <span class="stat-value">${conformityData.conformingDays}</span>
                        <span class="stat-label">Jours ✅</span>
                    </div>
                    <div class="stat-badge non-conforming">
                        <span class="stat-value">${conformityData.nonConformingDays}</span>
                        <span class="stat-label">Jours ⚠️</span>
                    </div>
                    <div class="stat-badge critical">
                        <span class="stat-value">${conformityData.criticalDays}</span>
                        <span class="stat-label">Jours 🔴</span>
                    </div>
                    <div class="stat-badge total">
                        <span class="stat-value">${conformityData.totalDays}</span>
                        <span class="stat-label">Total jours</span>
                    </div>
                </div>
                
                <!-- Barre de progression -->
                <div class="conformity-progress">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${rate}%; background: ${rateColor};"></div>
                    </div>
                    <div class="progress-labels">
                        <span>Non conformes: ${conformityData.nonConformingDays}</span>
                        <span>Conformes: ${conformityData.conformingDays}</span>
                    </div>
                </div>
            </div>
            
            <!-- Tableau détaillé des jours non conformes -->
            <div class="nonconforming-days-section">
                <h5>📋 Détail des jours non conformes (${conformityData.nonConformingDays})</h5>
                
                <div class="nonconforming-table-wrapper">
                    <table class="nonconforming-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Min (V)</th>
                                <th>Max (V)</th>
                                <th>Moy (V)</th>
                                <th>Variation (V/h)</th>
                                <th>Violations</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${conformityData.daysAnalysis
                                .filter(day => !day.isConforming)
                                .map(day => `
                                <tr class="severity-${day.severity}">
                                    <td class="date-cell">${day.date}</td>
                                    <td class="${parseFloat(day.min) < this.systemNorms[this.detectedSystem].min ? 'critical-value' : ''}">
                                        ${day.min}
                                    </td>
                                    <td class="${parseFloat(day.max) > this.systemNorms[this.detectedSystem].max ? 'critical-value' : ''}">
                                        ${day.max}
                                    </td>
                                    <td>${day.avg}</td>
                                    <td class="${parseFloat(day.variation) > this.systemNorms[this.detectedSystem].variationMax ? 'warning-value' : ''}">
                                        ${day.variation}
                                    </td>
                                    <td class="violations-cell">
                                        ${day.violations.map(v => `
                                            <span class="violation-tag ${v.type}">
                                                ${v.icon} ${v.message}
                                            </span>
                                        `).join('')}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- Légende -->
            <div class="conformity-legend">
                <span class="legend-item"><span class="legend-color" style="background: #22c55e;"></span> Jour conforme</span>
                <span class="legend-item"><span class="legend-color" style="background: #f59e0b;"></span> Non conforme (warning)</span>
                <span class="legend-item"><span class="legend-color" style="background: #ef4444;"></span> Non conforme (critique)</span>
            </div>
        </div>
        `;
    }

    // Nouvelle méthode : Analyser les dépassements de seuils (existante)
    analyzeThresholdViolations() {
        if (!this.detectedSystem) return [];
        
        const norms = this.systemNorms[this.detectedSystem];
        const tensionTables = this.parsedData.tables.filter(table => 
            Array.from(table.types).includes('T')
        );
        
        let violations = [];
        let dailyData = {};
        
        tensionTables.forEach(table => {
            const dateIndex = table.header.findIndex(h => 
                h.includes('TimeStamp') || h.includes('Date') || h.includes('DATE')
            );
            const tensionInstIndex = table.header.findIndex(h => 
                h.includes('Tension Inst') || h.includes('Tension')
            );
            
            if (dateIndex === -1 || tensionInstIndex === -1) return;
            
            table.rows.forEach(row => {
                const dateStr = row[dateIndex];
                if (!dateStr) return;
                
                const date = dateStr.split(' ')[0]; // Prendre seulement la date
                const tension = parseFloat(row[tensionInstIndex]);
                
                if (isNaN(tension)) return;
                
                if (!dailyData[date]) {
                    dailyData[date] = {
                        values: [],
                        min: Infinity,
                        max: -Infinity,
                        previousValue: null,
                        maxVariation: 0
                    };
                }
                
                dailyData[date].values.push(tension);
                dailyData[date].min = Math.min(dailyData[date].min, tension);
                dailyData[date].max = Math.max(dailyData[date].max, tension);
                
                // Calculer la variation horaire si on a une valeur précédente
                if (dailyData[date].previousValue !== null) {
                    const variation = Math.abs(tension - dailyData[date].previousValue);
                    dailyData[date].maxVariation = Math.max(dailyData[date].maxVariation, variation);
                }
                dailyData[date].previousValue = tension;
            });
        });
        
        // Analyser chaque jour pour détecter les violations
        Object.keys(dailyData).forEach(date => {
            const dayData = dailyData[date];
            const avgTension = dayData.values.reduce((a, b) => a + b, 0) / dayData.values.length;
            
            let violationsForDay = [];
            
            // Vérifier la tension minimale
            if (dayData.min < norms.min) {
                violationsForDay.push({
                    type: 'min',
                    severity: 'critique',
                    message: `Tension minimale (${dayData.min.toFixed(2)}V) < ${norms.min}V`,
                    icon: '🔴'
                });
            }
            
            // Vérifier la tension maximale
            if (dayData.max > norms.max) {
                violationsForDay.push({
                    type: 'max',
                    severity: 'critique',
                    message: `Tension maximale (${dayData.max.toFixed(2)}V) > ${norms.max}V`,
                    icon: '🔴'
                });
            }
            
            // Vérifier la plage idéale
            if (avgTension < norms.idealMin || avgTension > norms.idealMax) {
                violationsForDay.push({
                    type: 'ideal',
                    severity: 'warning',
                    message: `Tension moyenne (${avgTension.toFixed(2)}V) hors plage idéale [${norms.idealMin}-${norms.idealMax}V]`,
                    icon: '🟡'
                });
            }
            
            // Vérifier la variation maximale
            if (dayData.maxVariation > norms.variationMax) {
                violationsForDay.push({
                    type: 'variation',
                    severity: 'warning',
                    message: `Variation max (${dayData.maxVariation.toFixed(2)}V/h) > ${norms.variationMax}V/h`,
                    icon: '🟠'
                });
            }
            
            if (violationsForDay.length > 0) {
                violations.push({
                    date: date,
                    tensions: {
                        min: dayData.min.toFixed(2),
                        max: dayData.max.toFixed(2),
                        avg: avgTension.toFixed(2),
                        variation: dayData.maxVariation.toFixed(2)
                    },
                    violations: violationsForDay
                });
            }
        });
        
        return violations.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    getTableType(types) {
        if (!types || types.size === 0) return 'Données';
        
        const typeArray = Array.from(types).sort();
        if (typeArray.length === 1) {
            return this.getTypeLabel(typeArray[0]);
        }
        return typeArray.map(t => this.getTypeLabel(t)).join(', ');
    }

    getTypeLabel(type) {
        const labels = {
            'S': 'SOLDE',
            'I': 'INTENSITÉ',
            'R': 'RECHARGE',
            'E': 'ÉVÈNEMENT',
            'T': 'TENSION',
            'C': 'ÉNERGIE'
        };
        return labels[type] || type;
    }

    getTypeColor(type) {
        const colors = {
            'S': '#9F7AEA', // Violet pour SOLDE
            'I': '#4299E1', // Bleu pour INTENSITÉ
            'R': '#48BB78', // Vert pour RECHARGE
            'E': '#F56565', // Rouge pour ÉVÈNEMENT
            'T': '#ED8936', // Orange pour TENSION
            'C': '#FBBF24'  // Jaune pour ÉNERGIE
        };
        
        if (type.includes(',')) {
            return '#718096';
        }
        return colors[type] || '#718096';
    }

    getTypeIcon(type) {
        const icons = {
            'S': '💰', // SOLDE
            'I': '⚡', // INTENSITÉ
            'R': '💳', // RECHARGE
            'E': '⚠️', // ÉVÈNEMENT
            'T': '📊', // TENSION
            'C': '🔋'  // ÉNERGIE
        };
        return icons[type] || '📋';
    }

    // Analyse des données de tension (existante)
    analyzeTensionData(tables) {
        const tensionTables = tables.filter(table => 
            Array.from(table.types).includes('T')
        );
        
        if (tensionTables.length === 0) return null;
        
        let allTensions = [];
        let tensionData = [];
        
        // Parcourir tous les tableaux de tension
        tensionTables.forEach(table => {
            table.rows.forEach(row => {
                // Chercher les colonnes de tension
                const tensionInstIndex = table.header.findIndex(h => 
                    h.includes('Tension Inst') || h.includes('Tension')
                );
                const tensionMinIndex = table.header.findIndex(h => h.includes('Tension Min'));
                const tensionMaxIndex = table.header.findIndex(h => h.includes('Tension Max'));
                const dateIndex = table.header.findIndex(h => 
                    h.includes('TimeStamp') || h.includes('Date') || h.includes('DATE')
                );
                
                if (tensionInstIndex !== -1) {
                    const value = parseFloat(row[tensionInstIndex]);
                    if (!isNaN(value)) {
                        allTensions.push(value);
                        if (dateIndex !== -1) {
                            tensionData.push({
                                value: value,
                                date: row[dateIndex],
                                type: 'inst'
                            });
                        }
                    }
                }
                
                if (tensionMinIndex !== -1) {
                    const value = parseFloat(row[tensionMinIndex]);
                    if (!isNaN(value)) {
                        allTensions.push(value);
                        if (dateIndex !== -1) {
                            tensionData.push({
                                value: value,
                                date: row[dateIndex],
                                type: 'min'
                            });
                        }
                    }
                }
                
                if (tensionMaxIndex !== -1) {
                    const value = parseFloat(row[tensionMaxIndex]);
                    if (!isNaN(value)) {
                        allTensions.push(value);
                        if (dateIndex !== -1) {
                            tensionData.push({
                                value: value,
                                date: row[dateIndex],
                                type: 'max'
                            });
                        }
                    }
                }
            });
        });
        
        if (allTensions.length === 0) return null;
        
        // Calculer les statistiques
        const tensionMoyenne = allTensions.reduce((a, b) => a + b, 0) / allTensions.length;
        const tensionMin = Math.min(...allTensions);
        const tensionMax = Math.max(...allTensions);
        
        // Trouver les dates correspondantes
        const minData = tensionData.find(d => d.value === tensionMin);
        const maxData = tensionData.find(d => d.value === tensionMax);
        
        // Calculer la variation max par jour
        let variationParJour = [];
        const tensionsParJour = {};
        
        tensionData.forEach(d => {
            if (d.date) {
                const date = d.date.split(' ')[0];
                if (!tensionsParJour[date]) {
                    tensionsParJour[date] = [];
                }
                tensionsParJour[date].push(d.value);
            }
        });
        
        Object.keys(tensionsParJour).forEach(date => {
            const valeurs = tensionsParJour[date];
            if (valeurs.length > 1) {
                const min = Math.min(...valeurs);
                const max = Math.max(...valeurs);
                variationParJour.push({
                    date: date,
                    variation: max - min
                });
            }
        });
        
        const maxVariation = variationParJour.length > 0 
            ? variationParJour.reduce((max, v) => v.variation > max.variation ? v : max, variationParJour[0])
            : null;
        
        return {
            moyenne: tensionMoyenne.toFixed(2),
            minimale: tensionMin.toFixed(2),
            minimaleDate: minData ? minData.date : 'N/A',
            maximale: tensionMax.toFixed(2),
            maximaleDate: maxData ? maxData.date : 'N/A',
            variationMax: maxVariation ? maxVariation.variation.toFixed(2) : '0.00',
            variationDate: maxVariation ? maxVariation.date : 'N/A',
            count: allTensions.length
        };
    }

    // Fonction pour changer de page
    changePage(tableId, direction) {
        if (!this.currentPages[tableId]) {
            this.currentPages[tableId] = 1;
        }
        
        const totalRows = this.getTableRowsCount(tableId);
        const totalPages = Math.ceil(totalRows / this.rowsPerPage);
        
        let newPage = this.currentPages[tableId];
        
        if (direction === 'prev' && newPage > 1) {
            newPage--;
        } else if (direction === 'next' && newPage < totalPages) {
            newPage++;
        } else if (typeof direction === 'number') {
            newPage = Math.min(Math.max(1, direction), totalPages);
        }
        
        if (newPage !== this.currentPages[tableId]) {
            this.currentPages[tableId] = newPage;
            
            // Recharger uniquement les tableaux sans changer d'onglet
            this.refreshTables();
        }
    }

    // Rafraîchir uniquement les tableaux sans changer l'onglet
    refreshTables() {
        // Compter les tableaux par catégorie
        let techTables = [];
        let comTables = [];
        
        this.parsedData.tables.forEach((table, index) => {
            const types = Array.from(table.types);
            const tableId = `table_${index}`;
            
            if (types.some(t => ['I', 'E', 'T'].includes(t))) {
                techTables.push({...table, tableId, originalIndex: index});
            }
            if (types.some(t => ['S', 'R'].includes(t))) {
                comTables.push({...table, tableId, originalIndex: index});
            }
        });

        // Mettre à jour les dates dans l'en-tête
        this.updateReleveDates();

        // Analyser les données de tension pour les statistiques
        const tensionStats = this.analyzeTensionData(techTables);
        
        // Analyser les dépassements de seuils
        const thresholdViolations = this.analyzeThresholdViolations();
        
        // ✅ Analyser la conformité
        const conformityData = this.analyzeConformity();
        
        // Générer le HTML pour l'onglet technique avec statistiques
        let techHTML = '';
        
        // Ajouter les statistiques de conformité en premier
        if (conformityData) {
            techHTML += this.generateConformityStatsHTML(conformityData);
        }
        
        // Ajouter les statistiques de tension si disponibles
        if (tensionStats) {
            techHTML += this.generateTensionStatsHTML(tensionStats);
        }
        
        // Ajouter le tableau des dépassements
        techHTML += this.generateViolationsTableHTML(thresholdViolations);
        
        // Ajouter les tableaux techniques
        techHTML += this.generateTablesHTML(techTables);
        
        // Mettre à jour le contenu des onglets
        this.techContent.innerHTML = techHTML;
        this.comContent.innerHTML = `<h4 class="tab-subtitle">📈 Données Commerciales (S, R)</h4>` + this.generateTablesHTML(comTables);
        
        // Restaurer l'onglet actif
        this.switchTab(this.activeTab, false);
    }
    
    // Nouvelle méthode pour mettre à jour les dates dans l'en-tête
    updateReleveDates() {
        if (!this.parsedData.nrNumber) return;
        
        const { firstDate, lastDate } = this.getReleveDates();
        
        if (firstDate && lastDate) {
            const nrInfoElement = document.getElementById('nrInfo');
            if (nrInfoElement) {
                // Chercher si l'élément dates existe déjà
                let datesElement = nrInfoElement.querySelector('.nr-dates');
                
                const formatDate = (date) => {
                    if (date.includes('-')) {
                        const [year, month, day] = date.split('-');
                        return `${day}/${month}/${year}`;
                    }
                    return date;
                };
                
                const datesHTML = `
                    <span class="nr-dates">
                        <span class="nr-date-icon">📅</span>
                        <span class="nr-date-text">${formatDate(firstDate)} - ${formatDate(lastDate)}</span>
                    </span>
                `;
                
                if (datesElement) {
                    // Remplacer le contenu existant
                    datesElement.outerHTML = datesHTML;
                } else {
                    // Insérer après le nr-info-text
                    const infoText = nrInfoElement.querySelector('.nr-info-text');
                    if (infoText) {
                        infoText.insertAdjacentHTML('afterend', datesHTML);
                    }
                }
            }
        }
    }

    // Générer le tableau des dépassements (existante améliorée)
    generateViolationsTableHTML(violations) {
        if (violations.length === 0) {
            return `
            <div class="violations-container">
                <div class="violations-header">
                    <span class="violations-icon">✅</span>
                    <h4>Aucun dépassement de seuil détecté</h4>
                    <span class="system-badge ${this.detectedSystem === '12V' ? 'system-12v' : 'system-24v'}">
                        ⚡ Système ${this.detectedSystem}
                    </span>
                </div>
            </div>`;
        }

        let html = `
        <div class="violations-container">
            <div class="violations-header">
                <span class="violations-icon">⚠️</span>
                <h4>Jours avec dépassements de seuils</h4>
                <span class="violations-count">${violations.length} jour(s)</span>
                <span class="system-badge ${this.detectedSystem === '12V' ? 'system-12v' : 'system-24v'}">
                    ⚡ Système ${this.detectedSystem}
                </span>
            </div>
            
            <div class="violations-table-wrapper">
                <table class="violations-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Tension Min</th>
                            <th>Tension Max</th>
                            <th>Tension Moy</th>
                            <th>Variation Max</th>
                            <th>Dépassements</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        violations.forEach(violation => {
            html += `
                <tr>
                    <td class="violation-date">${violation.date}</td>
                    <td class="violation-value ${parseFloat(violation.tensions.min) < this.systemNorms[this.detectedSystem].min ? 'critical' : ''}">
                        ${violation.tensions.min}V
                    </td>
                    <td class="violation-value ${parseFloat(violation.tensions.max) > this.systemNorms[this.detectedSystem].max ? 'critical' : ''}">
                        ${violation.tensions.max}V
                    </td>
                    <td class="violation-value">${violation.tensions.avg}V</td>
                    <td class="violation-value ${parseFloat(violation.tensions.variation) > this.systemNorms[this.detectedSystem].variationMax ? 'warning' : ''}">
                        ${violation.tensions.variation}V/h
                    </td>
                    <td class="violation-messages">
                        ${violation.violations.map(v => `
                            <span class="violation-badge ${v.severity}">
                                ${v.icon} ${v.message}
                            </span>
                        `).join('')}
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        </div>
        `;

        return html;
    }

    // Générer le HTML des statistiques de tension (existante)
    generateTensionStatsHTML(stats) {
        const systemNorms = this.systemNorms[this.detectedSystem];
        
        return `
        <div class="stats-container-tension">
            <div class="stats-header">
                <span class="stats-icon">📊</span>
                <h4>Données techniques du NR</h4>
                <span class="stats-count">${stats.count} mesures</span>
                <span class="system-badge ${this.detectedSystem === '12V' ? 'system-12v' : 'system-24v'}">
                    ⚡ Système ${this.detectedSystem}
                </span>
            </div>
            <div class="stats-grid-compact">
                <div class="stat-card-compact moyenne">
                    <div class="stat-header">
                        <span class="stat-icon">📊</span>
                        <span class="stat-label">Tension Moyenne</span>
                    </div>
                    <div class="stat-value">${stats.moyenne} V</div>
                    <div class="stat-sub">Plage idéale: ${systemNorms.idealMin}-${systemNorms.idealMax}V</div>
                </div>
                
                <div class="stat-card-compact min">
                    <div class="stat-header">
                        <span class="stat-icon">⬇️</span>
                        <span class="stat-label">Tension Minimale</span>
                    </div>
                    <div class="stat-value ${parseFloat(stats.minimale) < systemNorms.min ? 'critical' : ''}">${stats.minimale} V</div>
                    <div class="stat-sub">${stats.minimaleDate} • Seuil: ${systemNorms.min}V</div>
                </div>
                
                <div class="stat-card-compact max">
                    <div class="stat-header">
                        <span class="stat-icon">⬆️</span>
                        <span class="stat-label">Tension Maximale</span>
                    </div>
                    <div class="stat-value ${parseFloat(stats.maximale) > systemNorms.max ? 'critical' : ''}">${stats.maximale} V</div>
                    <div class="stat-sub">${stats.maximaleDate} • Seuil: ${systemNorms.max}V</div>
                </div>
                
                <div class="stat-card-compact variation">
                    <div class="stat-header">
                        <span class="stat-icon">📏</span>
                        <span class="stat-label">Variation Max/Jour</span>
                    </div>
                    <div class="stat-value ${parseFloat(stats.variationMax) > systemNorms.variationMax ? 'warning' : ''}">${stats.variationMax} V</div>
                    <div class="stat-sub">${stats.variationDate} • Seuil: ${systemNorms.variationMax}V</div>
                </div>
            </div>
        </div>
        `;
    }

    // Obtenir le nombre de lignes pour un tableau
    getTableRowsCount(tableId) {
        const index = parseInt(tableId.replace('table_', ''));
        if (this.parsedData.tables[index]) {
            return this.parsedData.tables[index].rows.length;
        }
        return 0;
    }

    // Obtenir les lignes paginées pour un tableau
    getPaginatedRows(table, tableId) {
        const currentPage = this.currentPages[tableId] || 1;
        const start = (currentPage - 1) * this.rowsPerPage;
        const end = start + this.rowsPerPage;
        return table.rows.slice(start, end);
    }

    getReleveDates() {
        let firstDate = null;
        let lastDate = null;
        
        // Parcourir tous les tableaux de tension
        const tensionTables = this.parsedData.tables.filter(table => 
            Array.from(table.types).includes('T')
        );
        
        if (tensionTables.length === 0) return { firstDate: null, lastDate: null };
        
        tensionTables.forEach(table => {
            const dateIndex = table.header.findIndex(h => 
                h.includes('TimeStamp') || h.includes('Date') || h.includes('DATE')
            );
            
            if (dateIndex === -1) return;
            
            table.rows.forEach(row => {
                const dateStr = row[dateIndex];
                if (!dateStr) return;
                
                // Extraire la date (supprimer l'heure si présente)
                const date = dateStr.split(' ')[0];
                
                if (!firstDate || date < firstDate) {
                    firstDate = date;
                }
                if (!lastDate || date > lastDate) {
                    lastDate = date;
                }
            });
        });
        
        return { firstDate, lastDate };
    }

    // ==============================================
    // ANALYSE DES ATTEINTES DE TENSION NOMINALE
    // ==============================================

    analyzeNominalTensionHits() {
        if (!this.detectedSystem) return null;
        
        const targetTension = this.detectedSystem === '24V' ? 28.0 : 14.0;
        const tensionTables = this.parsedData.tables.filter(table => 
            Array.from(table.types).includes('T')
        );
        
        if (tensionTables.length === 0) return null;
        
        // Structure pour stocker les données quotidiennes
        let dailyData = {};
        let allDays = new Set();
        
        tensionTables.forEach(table => {
            const dateIndex = table.header.findIndex(h => 
                h.includes('TimeStamp') || h.includes('Date') || h.includes('DATE')
            );
            const tensionInstIndex = table.header.findIndex(h => 
                h.includes('Tension Inst') || h.includes('Tension')
            );
            
            if (dateIndex === -1 || tensionInstIndex === -1) return;
            
            table.rows.forEach(row => {
                const dateStr = row[dateIndex];
                if (!dateStr) return;
                
                const date = dateStr.split(' ')[0];
                allDays.add(date);
                
                const tension = parseFloat(row[tensionInstIndex]);
                if (isNaN(tension)) return;
                
                if (!dailyData[date]) {
                    dailyData[date] = {
                        hits: [],
                        count: 0
                    };
                }
                
                // Vérifier si la tension atteint ou dépasse la cible
                if (tension >= targetTension) {
                    dailyData[date].hits.push({
                        time: dateStr.split(' ')[1] || '00:00',
                        value: tension
                    });
                    dailyData[date].count++;
                }
            });
        });
        
        // Trier les dates et préparer les données
        const sortedDates = Object.keys(dailyData).sort((a, b) => {
            return new Date(b) - new Date(a); // Plus récent en premier
        });
        
        const daysWithData = Object.keys(dailyData).length;
        const totalDays = allDays.size;
        
        // Compter les jours par catégorie
        let daysWith4Plus = 0;  // ≥4 atteintes
        let daysWith3 = 0;       // 3 atteintes
        let daysWith2 = 0;       // 2 atteintes
        let daysWith1 = 0;       // 1 atteinte
        let daysWith0 = 0;       // 0 atteinte (mais avec données)
        let daysWithoutData = totalDays - daysWithData; // Jours sans données
        
        Object.values(dailyData).forEach(day => {
            if (day.count >= 4) daysWith4Plus++;
            else if (day.count === 3) daysWith3++;
            else if (day.count === 2) daysWith2++;
            else if (day.count === 1) daysWith1++;
            else daysWith0++;
        });
        
        // Calculer les pourcentages (basés sur les jours avec données)
        const percent4Plus = daysWithData > 0 ? ((daysWith4Plus / daysWithData) * 100).toFixed(1) : 0;
        const percent3 = daysWithData > 0 ? ((daysWith3 / daysWithData) * 100).toFixed(1) : 0;
        const percent2 = daysWithData > 0 ? ((daysWith2 / daysWithData) * 100).toFixed(1) : 0;
        const percent1 = daysWithData > 0 ? ((daysWith1 / daysWithData) * 100).toFixed(1) : 0;
        const percent0 = daysWithData > 0 ? ((daysWith0 / daysWithData) * 100).toFixed(1) : 0;
        const percentWithoutData = totalDays > 0 ? ((daysWithoutData / totalDays) * 100).toFixed(1) : 0;
        
        return {
            targetTension: targetTension,
            systemType: this.detectedSystem,
            dailyData: dailyData,
            sortedDates: sortedDates,
            totalDays: totalDays,
            daysWithData: daysWithData,
            daysWithoutData: daysWithoutData,
            daysWith4Plus: daysWith4Plus,
            daysWith3: daysWith3,
            daysWith2: daysWith2,
            daysWith1: daysWith1,
            daysWith0: daysWith0,
            percent4Plus: percent4Plus,
            percent3: percent3,
            percent2: percent2,
            percent1: percent1,
            percent0: percent0,
            percentWithoutData: percentWithoutData,
            totalHits: Object.values(dailyData).reduce((sum, day) => sum + day.count, 0)
        };
    }

    generateNominalTensionTableHTML(data) {
        if (!data || data.daysWithData === 0) {
            return `
            <div class="nominal-container">
                <div class="nominal-header">
                    <span class="nominal-icon">⚡</span>
                    <h4>Analyse des atteintes de tension nominale</h4>
                    <span class="system-badge ${data.systemType === '12V' ? 'system-12v' : 'system-24v'}">
                        ⚡ Système ${data.systemType} · Cible: ${data.targetTension}V
                    </span>
                </div>
                <div class="no-data-message">Aucune donnée de tension disponible</div>
            </div>`;
        }
        
        // Créer les lignes du tableau
        let tableRows = '';
        data.sortedDates.forEach(date => {
            const day = data.dailyData[date];
            
            // Déterminer la couleur du badge selon le nombre d'atteintes
            let badgeColor = '#64748b';
            let bgColor = '#ffffff';
            
            if (day.count >= 4) {
                badgeColor = '#22c55e';
                bgColor = '#f0fdf4';
            } else if (day.count === 3) {
                badgeColor = '#eab308';
                bgColor = '#fef9c3';
            } else if (day.count === 2) {
                badgeColor = '#f59e0b';
                bgColor = '#fff7ed';
            } else if (day.count === 1) {
                badgeColor = '#f97316';
                bgColor = '#ffedd5';
            } else {
                badgeColor = '#ef4444';
                bgColor = '#fee2e2';
            }
            
            // Formater les heures d'atteinte
            let hitsHTML = '';
            if (day.hits.length > 0) {
                // Trier les hits par heure
                const sortedHits = [...day.hits].sort((a, b) => a.time.localeCompare(b.time));
                
                hitsHTML = sortedHits.map(hit => {
                    // Formater l'heure (supprimer les secondes si présentes)
                    const time = hit.time.length > 5 ? hit.time.substring(0, 5) : hit.time;
                    return `<span class="hit-time-badge" style="border-color: ${badgeColor}; color: ${badgeColor};">
                        ${time} → ${hit.value.toFixed(1)}V
                    </span>`;
                }).join('');
            } else {
                hitsHTML = `<span class="no-hit">Aucune atteinte</span>`;
            }
            
            tableRows += `
                <tr style="background: ${bgColor};">
                    <td class="nominal-date">${date}</td>
                    <td class="nominal-count">
                        <span class="count-badge" style="background: ${badgeColor};">
                            ${day.count}
                        </span>
                    </td>
                    <td class="nominal-hits">${hitsHTML}</td>
                </tr>
            `;
        });
        
        // Créer les cartes de pourcentages
        const cardsHTML = `
            <div class="nominal-cards-grid">
                <!-- ≥4 atteintes (Vert) -->
                <div class="nominal-card" style="border-left: 6px solid #22c55e; background: linear-gradient(135deg, #f0fdf4, white);">
                    <div class="card-header">
                        <span class="card-badge" style="background: #22c55e;">⭐</span>
                        <span class="card-title">≥4 atteintes</span>
                    </div>
                    <div class="card-value" style="color: #22c55e;">${data.percent4Plus}%</div>
                    <div class="card-stats">
                        <span class="card-days">${data.daysWith4Plus} jour(s)</span>
                        <span class="card-label">Excellente</span>
                    </div>
                    <div class="card-progress">
                        <div class="progress-bg">
                            <div class="progress-fill" style="width: ${data.percent4Plus}%; background: #22c55e;"></div>
                        </div>
                    </div>
                </div>
                
                <!-- 3 atteintes (Jaune) -->
                <div class="nominal-card" style="border-left: 6px solid #eab308; background: linear-gradient(135deg, #fef9c3, white);">
                    <div class="card-header">
                        <span class="card-badge" style="background: #eab308;">👍</span>
                        <span class="card-title">3 atteintes</span>
                    </div>
                    <div class="card-value" style="color: #eab308;">${data.percent3}%</div>
                    <div class="card-stats">
                        <span class="card-days">${data.daysWith3} jour(s)</span>
                        <span class="card-label">Très bien</span>
                    </div>
                    <div class="card-progress">
                        <div class="progress-bg">
                            <div class="progress-fill" style="width: ${data.percent3}%; background: #eab308;"></div>
                        </div>
                    </div>
                </div>
                
                <!-- 2 atteintes (Orange) -->
                <div class="nominal-card" style="border-left: 6px solid #f59e0b; background: linear-gradient(135deg, #fff7ed, white);">
                    <div class="card-header">
                        <span class="card-badge" style="background: #f59e0b;">🟡</span>
                        <span class="card-title">2 atteintes</span>
                    </div>
                    <div class="card-value" style="color: #f59e0b;">${data.percent2}%</div>
                    <div class="card-stats">
                        <span class="card-days">${data.daysWith2} jour(s)</span>
                        <span class="card-label">Correct</span>
                    </div>
                    <div class="card-progress">
                        <div class="progress-bg">
                            <div class="progress-fill" style="width: ${data.percent2}%; background: #f59e0b;"></div>
                        </div>
                    </div>
                </div>
                
                <!-- 1 atteinte (Orange clair) -->
                <div class="nominal-card" style="border-left: 6px solid #f97316; background: linear-gradient(135deg, #ffedd5, white);">
                    <div class="card-header">
                        <span class="card-badge" style="background: #f97316;">⚠️</span>
                        <span class="card-title">1 atteinte</span>
                    </div>
                    <div class="card-value" style="color: #f97316;">${data.percent1}%</div>
                    <div class="card-stats">
                        <span class="card-days">${data.daysWith1} jour(s)</span>
                        <span class="card-label">Faible</span>
                    </div>
                    <div class="card-progress">
                        <div class="progress-bg">
                            <div class="progress-fill" style="width: ${data.percent1}%; background: #f97316;"></div>
                        </div>
                    </div>
                </div>
                
                <!-- 0 atteinte (Rouge) -->
                <div class="nominal-card" style="border-left: 6px solid #ef4444; background: linear-gradient(135deg, #fee2e2, white);">
                    <div class="card-header">
                        <span class="card-badge" style="background: #ef4444;">🔴</span>
                        <span class="card-title">0 atteinte</span>
                    </div>
                    <div class="card-value" style="color: #ef4444;">${data.percent0}%</div>
                    <div class="card-stats">
                        <span class="card-days">${data.daysWith0} jour(s)</span>
                        <span class="card-label">Nulle</span>
                    </div>
                    <div class="card-progress">
                        <div class="progress-bg">
                            <div class="progress-fill" style="width: ${data.percent0}%; background: #ef4444;"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${data.daysWithoutData > 0 ? `
            <div class="nominal-info">
                <span class="info-icon">📭</span>
                <span class="info-text">
                    <strong>${data.daysWithoutData} jour(s) sans données</strong> (${data.percentWithoutData}% de la période)
                </span>
            </div>
            ` : ''}
        `;
        
        // Tableau principal
        const tableHTML = `
            <div class="nominal-container">
                <div class="nominal-header">
                    <span class="nominal-icon">⚡</span>
                    <h4>Atteintes de tension ≥ ${data.targetTension}V (${data.systemType})</h4>
                    <div class="nominal-stats">
                        <span class="stat-chip">📊 ${data.daysWithData} jours avec données</span>
                        <span class="stat-chip">🎯 ${data.totalHits} atteintes totales</span>
                        <span class="system-badge ${data.systemType === '12V' ? 'system-12v' : 'system-24v'}">
                            ⚡ ${data.systemType}
                        </span>
                    </div>
                </div>
                
                <!-- Cartes de pourcentages -->
                ${cardsHTML}
                
                <!-- Tableau détaillé -->
                <div class="nominal-table-wrapper">
                    <table class="nominal-table">
                        <thead>
                            <tr>
                                <th>📅 Date</th>
                                <th>⚡ Atteintes ≥${data.targetTension}V</th>
                                <th>🔍 Heures d'atteinte</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                
                <!-- Légende -->
                <div class="nominal-legend">
                    <span class="legend-item"><span class="legend-color" style="background: #22c55e;"></span> ≥4 (Excellente)</span>
                    <span class="legend-item"><span class="legend-color" style="background: #eab308;"></span> 3 (Très bien)</span>
                    <span class="legend-item"><span class="legend-color" style="background: #f59e0b;"></span> 2 (Correct)</span>
                    <span class="legend-item"><span class="legend-color" style="background: #f97316;"></span> 1 (Faible)</span>
                    <span class="legend-item"><span class="legend-color" style="background: #ef4444;"></span> 0 (Nulle)</span>
                    <span class="legend-item"><span class="legend-color" style="background: #94a3b8;"></span> Sans données</span>
                </div>
            </div>
        `;
        
        return tableHTML;
    }

    // ==============================================
    // GRAPHIQUE JOURNALIER DE TENSION (MIN, MAX, MOYENNE)
    // ==============================================

    prepareDailyTensionChartData() {
        if (!this.detectedSystem) return null;
        
        const norms = this.systemNorms[this.detectedSystem];
        const tensionTables = this.parsedData.tables.filter(table => 
            Array.from(table.types).includes('T')
        );
        
        if (tensionTables.length === 0) return null;
        
        // Structure pour stocker les données quotidiennes
        let dailyData = {};
        let allDates = [];
        
        tensionTables.forEach(table => {
            const dateIndex = table.header.findIndex(h => 
                h.includes('TimeStamp') || h.includes('Date') || h.includes('DATE')
            );
            const tensionInstIndex = table.header.findIndex(h => 
                h.includes('Tension Inst') || h.includes('Tension')
            );
            
            if (dateIndex === -1 || tensionInstIndex === -1) return;
            
            table.rows.forEach(row => {
                const dateStr = row[dateIndex];
                if (!dateStr) return;
                
                const date = dateStr.split(' ')[0];
                const tension = parseFloat(row[tensionInstIndex]);
                
                if (isNaN(tension)) return;
                
                if (!dailyData[date]) {
                    dailyData[date] = {
                        values: [],
                        min: Infinity,
                        max: -Infinity,
                        sum: 0
                    };
                }
                
                dailyData[date].values.push(tension);
                dailyData[date].min = Math.min(dailyData[date].min, tension);
                dailyData[date].max = Math.max(dailyData[date].max, tension);
                dailyData[date].sum += tension;
            });
        });
        
        // Calculer les moyennes et préparer les données pour le graphique
        const dates = Object.keys(dailyData).sort((a, b) => {
            return new Date(a) - new Date(b); // Ordre chronologique
        });
        
        const chartData = {
            labels: dates,
            minData: [],
            maxData: [],
            avgData: []
        };
        
        dates.forEach(date => {
            const day = dailyData[date];
            const avg = day.sum / day.values.length;
            
            chartData.minData.push(parseFloat(day.min.toFixed(2)));
            chartData.maxData.push(parseFloat(day.max.toFixed(2)));
            chartData.avgData.push(parseFloat(avg.toFixed(2)));
        });
        
        return {
            chartData: chartData,
            systemType: this.detectedSystem,
            norms: norms,
            totalDays: dates.length
        };
    }

    generateDailyTensionChartHTML(data) {
        if (!data || data.totalDays === 0) {
            return `
            <div class="chart-container">
                <div class="chart-header">
                    <span class="chart-icon">📊</span>
                    <h4>Évolution journalière de la tension</h4>
                    <span class="system-badge ${this.detectedSystem === '12V' ? 'system-12v' : 'system-24v'}">
                        ⚡ Système ${this.detectedSystem}
                    </span>
                </div>
                <div class="no-data-message">Données insuffisantes pour générer le graphique</div>
            </div>`;
        }
        
        // Créer un ID unique pour le canvas
        const chartId = `tension-chart-${Date.now()}`;
        
        // Stocker les données pour une utilisation ultérieure (pour Chart.js)
        setTimeout(() => {
            this.renderDailyTensionChart(chartId, data);
        }, 100);
        
        return `
        <div class="chart-container">
            <div class="chart-header">
                <span class="chart-icon">📊</span>
                <h4>Évolution journalière de la tension</h4>
                <div class="chart-stats">
                    <span class="stat-chip">📅 ${data.totalDays} jours</span>
                    <span class="stat-chip">📊 ${data.chartData.labels.length} points</span>
                    <span class="system-badge ${data.systemType === '12V' ? 'system-12v' : 'system-24v'}">
                        ⚡ ${data.systemType}
                    </span>
                </div>
            </div>
            
            <div class="chart-wrapper">
                <canvas id="${chartId}" width="800" height="400"></canvas>
            </div>
            
            <div class="chart-limits-info">
                <div class="limit-item">
                    <span class="limit-color" style="background: #ef4444;"></span>
                    <span class="limit-text">Limite min: ${data.norms.min}V</span>
                </div>
                <div class="limit-item">
                    <span class="limit-color" style="background: #22c55e;"></span>
                    <span class="limit-text">Plage idéale: ${data.norms.idealMin}V - ${data.norms.idealMax}V</span>
                </div>
                <div class="limit-item">
                    <span class="limit-color" style="background: #ef4444;"></span>
                    <span class="limit-text">Limite max: ${data.norms.max}V</span>
                </div>
            </div>
            
            <div class="chart-legend">
                <div class="legend-item">
                    <span class="legend-line" style="background: #3b82f6; height: 3px;"></span>
                    <span>Tension minimale</span>
                </div>
                <div class="legend-item">
                    <span class="legend-line" style="background: #ef4444; height: 3px;"></span>
                    <span>Tension maximale</span>
                </div>
                <div class="legend-item">
                    <span class="legend-line" style="background: #22c55e; height: 3px; border: 2px dashed #22c55e;"></span>
                    <span>Tension moyenne</span>
                </div>
            </div>
        </div>
        `;
    }

    renderDailyTensionChart(chartId, data) {
        const canvas = document.getElementById(chartId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const chartData = data.chartData;
        const norms = data.norms;
        
        // Détruire le graphique existant s'il y en a un
        if (window[`chart_${chartId}`]) {
            window[`chart_${chartId}`].destroy();
        }
        
        // Configuration du graphique
        window[`chart_${chartId}`] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Tension minimale',
                        data: chartData.minData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 3,
                        pointBackgroundColor: '#3b82f6',
                        fill: false
                    },
                    {
                        label: 'Tension maximale',
                        data: chartData.maxData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 3,
                        pointBackgroundColor: '#ef4444',
                        fill: false
                    },
                    {
                        label: 'Tension moyenne',
                        data: chartData.avgData,
                        borderColor: '#22c55e',
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#22c55e',
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        fill: false
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
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                return `${label}: ${value.toFixed(2)}V`;
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
                            color: '#334155'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + 'V';
                            },
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date',
                            font: { size: 12, weight: 'bold' },
                            color: '#334155'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            font: { size: 10 },
                            maxTicksLimit: 10
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            },
            plugins: [
                {
                    id: 'thresholdLines',
                    afterDatasetsDraw(chart) {
                        const ctx = chart.ctx;
                        const yScale = chart.scales.y;
                        const chartArea = chart.chartArea;
                        
                        // Ligne de limite minimale
                        const minLimitY = yScale.getPixelForValue(norms.min);
                        ctx.save();
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([5, 5]);
                        ctx.beginPath();
                        ctx.moveTo(chartArea.left, minLimitY);
                        ctx.lineTo(chartArea.right, minLimitY);
                        ctx.stroke();
                        
                        // Ligne de limite maximale
                        const maxLimitY = yScale.getPixelForValue(norms.max);
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([5, 5]);
                        ctx.beginPath();
                        ctx.moveTo(chartArea.left, maxLimitY);
                        ctx.lineTo(chartArea.right, maxLimitY);
                        ctx.stroke();
                        
                        // Zone de plage idéale
                        const idealMinY = yScale.getPixelForValue(norms.idealMin);
                        const idealMaxY = yScale.getPixelForValue(norms.idealMax);
                        ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
                        ctx.fillRect(
                            chartArea.left,
                            idealMaxY,
                            chartArea.right - chartArea.left,
                            idealMinY - idealMaxY
                        );
                        
                        ctx.setLineDash([]);
                        ctx.restore();
                    }
                }
            ]
        });
    }
    // ==============================================
    // GRAPHIQUE HORAIRE DE TENSION (Tens Inst, Min, Max)
    // ==============================================

    prepareHourlyTensionData() {
        if (!this.detectedSystem) return null;
        
        const tensionTables = this.parsedData.tables.filter(table => 
            Array.from(table.types).includes('T')
        );
        
        if (tensionTables.length === 0) return null;
        
        // Structure pour stocker les données par date et heure
        let hourlyData = {};
        let availableDates = new Set();
        
        tensionTables.forEach(table => {
            const dateIndex = table.header.findIndex(h => 
                h.includes('TimeStamp') || h.includes('Date') || h.includes('DATE')
            );
            const tensionInstIndex = table.header.findIndex(h => 
                h.includes('Tension Inst') || h.includes('Tension')
            );
            const tensionMinIndex = table.header.findIndex(h => h.includes('Tension Min'));
            const tensionMaxIndex = table.header.findIndex(h => h.includes('Tension Max'));
            
            if (dateIndex === -1 || tensionInstIndex === -1) return;
            
            table.rows.forEach(row => {
                const dateStr = row[dateIndex];
                if (!dateStr) return;
                
                const date = dateStr.split(' ')[0];
                const time = dateStr.split(' ')[1] || '00:00';
                const hour = time.substring(0, 5); // Format HH:MM
                
                const tensionInst = parseFloat(row[tensionInstIndex]);
                const tensionMin = tensionMinIndex !== -1 ? parseFloat(row[tensionMinIndex]) : null;
                const tensionMax = tensionMaxIndex !== -1 ? parseFloat(row[tensionMaxIndex]) : null;
                
                if (isNaN(tensionInst)) return;
                
                availableDates.add(date);
                
                if (!hourlyData[date]) {
                    hourlyData[date] = {};
                }
                
                if (!hourlyData[date][hour]) {
                    hourlyData[date][hour] = {
                        inst: [],
                        min: [],
                        max: []
                    };
                }
                
                hourlyData[date][hour].inst.push(tensionInst);
                if (tensionMin !== null) hourlyData[date][hour].min.push(tensionMin);
                if (tensionMax !== null) hourlyData[date][hour].max.push(tensionMax);
            });
        });
        
        // Pour chaque date et heure, calculer les moyennes
        const processedData = {};
        const sortedDates = Array.from(availableDates).sort((a, b) => {
            return new Date(a) - new Date(b);
        });
        
        sortedDates.forEach(date => {
            processedData[date] = {};
            const hours = hourlyData[date] || {};
            
            // Pour chaque heure de 00:00 à 23:00
            for (let h = 0; h < 24; h++) {
                const hourKey = `${h.toString().padStart(2, '0')}:00`;
                const values = hours[hourKey] || { inst: [], min: [], max: [] };
                
                const instAvg = values.inst.length > 0 
                    ? values.inst.reduce((sum, v) => sum + v, 0) / values.inst.length 
                    : null;
                
                const minAvg = values.min.length > 0 
                    ? values.min.reduce((sum, v) => sum + v, 0) / values.min.length 
                    : null;
                
                const maxAvg = values.max.length > 0 
                    ? values.max.reduce((sum, v) => sum + v, 0) / values.max.length 
                    : null;
                
                processedData[date][hourKey] = {
                    inst: instAvg !== null ? parseFloat(instAvg.toFixed(2)) : null,
                    min: minAvg !== null ? parseFloat(minAvg.toFixed(2)) : null,
                    max: maxAvg !== null ? parseFloat(maxAvg.toFixed(2)) : null
                };
            }
        });
        
        // Déterminer la dernière date disponible
        const lastDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
        
        return {
            data: processedData,
            dates: sortedDates,
            lastDate: lastDate,
            systemType: this.detectedSystem,
            norms: this.systemNorms[this.detectedSystem]
        };
    }

    generateHourlyTensionChartHTML(data) {
        if (!data || data.dates.length === 0) {
            return `
            <div class="hourly-chart-container">
                <div class="chart-header">
                    <span class="chart-icon">⏰</span>
                    <h4>Évolution horaire de la tension</h4>
                    <span class="system-badge ${this.detectedSystem === '12V' ? 'system-12v' : 'system-24v'}">
                        ⚡ Système ${this.detectedSystem}
                    </span>
                </div>
                <div class="no-data-message">Données insuffisantes pour générer le graphique</div>
            </div>`;
        }
        
        // Créer un ID unique pour le canvas
        const chartId = `hourly-chart-${Date.now()}`;
        const selectId = `date-selector-${Date.now()}`;
        
        // Stocker les données globalement pour le sélecteur
        window.hourlyTensionData = data;
        window.currentChartId = chartId;
        
        // Rendre le graphique après le rendu HTML
        setTimeout(() => {
            this.renderHourlyTensionChart(chartId, data.lastDate);
            this.populateDateSelector(selectId, data);
        }, 100);
        
        // Générer les options du sélecteur
        const optionsHTML = data.dates.map(date => {
            const selected = date === data.lastDate ? 'selected' : '';
            return `<option value="${date}" ${selected}>${date}</option>`;
        }).join('');
        
        return `
        <div class="hourly-chart-container">
            <div class="chart-header">
                <span class="chart-icon">⏰</span>
                <h4>Évolution horaire de la tension</h4>
                <div class="chart-stats">
                    <span class="stat-chip">📅 ${data.dates.length} jours disponibles</span>
                    <span class="system-badge ${data.systemType === '12V' ? 'system-12v' : 'system-24v'}">
                        ⚡ ${data.systemType}
                    </span>
                </div>
            </div>
            
            <!-- Sélecteur de date -->
            <div class="date-selector-wrapper">
                <div class="date-selector-label">
                    <span class="selector-icon">📅</span>
                    <span>Sélectionner une date :</span>
                </div>
                <select id="${selectId}" class="date-selector" onchange="window.fileReader.updateHourlyChart(this.value)">
                    ${optionsHTML}
                </select>
                <button class="refresh-btn" onclick="window.fileReader.refreshHourlyChart()" title="Dernière date">
                    ↻
                </button>
            </div>
            
            <!-- Graphique avec 3 courbes -->
            <div class="chart-wrapper">
                <canvas id="${chartId}" width="800" height="400"></canvas>
            </div>
            
            <!-- Limites et légende -->
            <div class="chart-limits-info">
                <div class="limit-item">
                    <span class="limit-color" style="background: #ef4444;"></span>
                    <span class="limit-text">Limite min: ${data.norms.min}V</span>
                </div>
                <div class="limit-item">
                    <span class="limit-color" style="background: #22c55e;"></span>
                    <span class="limit-text">Plage idéale: ${data.norms.idealMin}V - ${data.norms.idealMax}V</span>
                </div>
                <div class="limit-item">
                    <span class="limit-color" style="background: #ef4444;"></span>
                    <span class="limit-text">Limite max: ${data.norms.max}V</span>
                </div>
            </div>
            
            <!-- Légende des courbes -->
            <div class="hourly-legend">
                <div class="legend-item">
                    <span class="legend-line" style="background: #8b5cf6; height: 3px;"></span>
                    <span>Tension instantanée</span>
                </div>
                <div class="legend-item">
                    <span class="legend-line" style="background: #3b82f6; height: 3px;"></span>
                    <span>Tension minimale</span>
                </div>
                <div class="legend-item">
                    <span class="legend-line" style="background: #ef4444; height: 3px;"></span>
                    <span>Tension maximale</span>
                </div>
            </div>
            
            <!-- Statistiques -->
            <div class="hourly-stats" id="hourly-stats-${chartId}">
                Chargement...
            </div>
        </div>
        `;
    }

    renderHourlyTensionChart(chartId, selectedDate) {
        const canvas = document.getElementById(chartId);
        if (!canvas || !window.hourlyTensionData) return;
        
        const data = window.hourlyTensionData;
        const ctx = canvas.getContext('2d');
        const norms = data.norms;
        
        // Récupérer les données pour la date sélectionnée
        const dayData = data.data[selectedDate] || {};
        
        // Préparer les labels (heures) et les données
        const hours = [];
        const instData = [];
        const minData = [];
        const maxData = [];
        
        for (let h = 0; h < 24; h++) {
            const hourKey = `${h.toString().padStart(2, '0')}:00`;
            hours.push(hourKey);
            
            const values = dayData[hourKey] || { inst: null, min: null, max: null };
            instData.push(values.inst);
            minData.push(values.min);
            maxData.push(values.max);
        }
        
        // Calculer les statistiques
        const validInst = instData.filter(t => t !== null);
        const validMin = minData.filter(t => t !== null);
        const validMax = maxData.filter(t => t !== null);
        
        const minTension = validMin.length > 0 ? Math.min(...validMin) : null;
        const maxTension = validMax.length > 0 ? Math.max(...validMax) : null;
        const avgInst = validInst.length > 0 
            ? (validInst.reduce((a, b) => a + b, 0) / validInst.length).toFixed(2) 
            : null;
        
        // Mettre à jour les statistiques
        const statsElement = document.getElementById(`hourly-stats-${chartId}`);
        if (statsElement) {
            statsElement.innerHTML = `
                <div class="stat-item">
                    <span class="stat-dot" style="background: #8b5cf6;"></span>
                    <span>Moyenne inst.: <strong>${avgInst || 'N/A'}V</strong></span>
                </div>
                <div class="stat-item">
                    <span class="stat-dot" style="background: #3b82f6;"></span>
                    <span>Min globale: <strong>${minTension ? minTension.toFixed(2) : 'N/A'}V</strong></span>
                </div>
                <div class="stat-item">
                    <span class="stat-dot" style="background: #ef4444;"></span>
                    <span>Max globale: <strong>${maxTension ? maxTension.toFixed(2) : 'N/A'}V</strong></span>
                </div>
                <div class="stat-item">
                    <span class="stat-dot" style="background: #22c55e;"></span>
                    <span>Heures avec données: <strong>${validInst.length}/24</strong></span>
                </div>
            `;
        }
        
        // Détruire le graphique existant s'il y en a un
        if (window[`hourlyChart_${chartId}`]) {
            window[`hourlyChart_${chartId}`].destroy();
        }
        
        // Créer le graphique avec 3 courbes
        window[`hourlyChart_${chartId}`] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [
                    {
                        label: 'Tension instantanée',
                        data: instData,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 3,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: instData.map(t => {
                            if (t === null) return '#cbd5e1';
                            if (t < norms.min || t > norms.max) return '#ef4444';
                            if (t >= norms.idealMin && t <= norms.idealMax) return '#22c55e';
                            return '#8b5cf6';
                        }),
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        pointHoverRadius: 6,
                        fill: false
                    },
                    {
                        label: 'Tension minimale',
                        data: minData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3,
                        pointRadius: 3,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: 'white',
                        pointBorderWidth: 1,
                        fill: false
                    },
                    {
                        label: 'Tension maximale',
                        data: maxData,
                        borderColor: '#ef4444',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3,
                        pointRadius: 3,
                        pointBackgroundColor: '#ef4444',
                        pointBorderColor: 'white',
                        pointBorderWidth: 1,
                        fill: false
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
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: 12,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            title: function(context) {
                                return `${selectedDate} - ${context[0].label}`;
                            },
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                return value ? `${label}: ${value.toFixed(2)}V` : `${label}: Aucune donnée`;
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
                            color: '#334155'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + 'V';
                            },
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
                            maxTicksLimit: 12
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            },
            plugins: [
                {
                    id: 'hourlyThresholds',
                    afterDatasetsDraw(chart) {
                        const ctx = chart.ctx;
                        const yScale = chart.scales.y;
                        const chartArea = chart.chartArea;
                        
                        // Ligne de limite minimale
                        const minLimitY = yScale.getPixelForValue(norms.min);
                        ctx.save();
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([5, 5]);
                        ctx.beginPath();
                        ctx.moveTo(chartArea.left, minLimitY);
                        ctx.lineTo(chartArea.right, minLimitY);
                        ctx.stroke();
                        
                        // Ligne de limite maximale
                        const maxLimitY = yScale.getPixelForValue(norms.max);
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([5, 5]);
                        ctx.beginPath();
                        ctx.moveTo(chartArea.left, maxLimitY);
                        ctx.lineTo(chartArea.right, maxLimitY);
                        ctx.stroke();
                        
                        // Zone de plage idéale
                        const idealMinY = yScale.getPixelForValue(norms.idealMin);
                        const idealMaxY = yScale.getPixelForValue(norms.idealMax);
                        ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
                        ctx.fillRect(
                            chartArea.left,
                            idealMaxY,
                            chartArea.right - chartArea.left,
                            idealMinY - idealMaxY
                        );
                        
                        ctx.setLineDash([]);
                        ctx.restore();
                    }
                }
            ]
        });
    }

    populateDateSelector(selectId, data) {
        const selector = document.getElementById(selectId);
        if (!selector) return;
        
        // Ajouter l'événement change
        selector.addEventListener('change', (e) => {
            this.updateHourlyChart(e.target.value);
        });
    }

    updateHourlyChart(selectedDate) {
        if (!window.hourlyTensionData || !window.currentChartId) return;
        this.renderHourlyTensionChart(window.currentChartId, selectedDate);
    }

    refreshHourlyChart() {
        if (!window.hourlyTensionData || !window.currentChartId) return;
        
        // Recharger avec la dernière date
        this.renderHourlyTensionChart(window.currentChartId, window.hourlyTensionData.lastDate);
        
        // Mettre à jour le sélecteur
        const selector = document.querySelector('.date-selector');
        if (selector) {
            selector.value = window.hourlyTensionData.lastDate;
        }
    }
    
    //================Fonction pour afficher le contenu après le parsing================
    displayContent() {
        this.contentContainer.style.display = 'block';
        
        // Obtenir les dates de début et fin de la relève
        const { firstDate, lastDate } = this.getReleveDates();
        
        // Afficher le N° Nano Réseau
        if (this.parsedData.nrNumber) {
            this.nrInfo.style.display = 'flex';
            
            let datesHTML = '';
            if (firstDate && lastDate) {
                const formatDate = (date) => {
                    if (date.includes('-')) {
                        const [year, month, day] = date.split('-');
                        return `${day}/${month}/${year}`;
                    }
                    return date;
                };
                
                datesHTML = `
                    <span class="nr-dates">
                        <span class="nr-date-icon">📅</span>
                        <span class="nr-date-text">${formatDate(firstDate)} - ${formatDate(lastDate)}</span>
                    </span>
                `;
            }
            
            this.nrInfo.innerHTML = `
                <span class="nr-info-icon">📊</span>
                <span class="nr-info-text">Nano Réseau N° <strong>${this.parsedData.nrNumber}</strong></span>
                ${datesHTML}
                <span class="nr-system-badge ${this.detectedSystem === '12V' ? 'system-12v' : 'system-24v'}">
                    ⚡ Système ${this.detectedSystem}
                </span>
            `;
        } else {
            this.nrInfo.style.display = 'none';
        }

        // Compter les tableaux par catégorie
        let techTables = [];
        let comTables = [];
        
        // Séparer les tableaux pour l'onglet technique
        this.parsedData.tables.forEach((table, index) => {
            const types = Array.from(table.types);
            const tableId = `table_${index}`;
            
            if (types.some(t => ['I', 'E', 'T'].includes(t))) {
                techTables.push({...table, tableId, originalIndex: index});
            }
            if (types.some(t => ['S', 'R'].includes(t))) {
                comTables.push({...table, tableId, originalIndex: index});
            }
        });

        // ========== ANALYSES DES DONNÉES ==========
        
        // Analyser les données de tension pour les statistiques
        const tensionStats = this.analyzeTensionData(techTables);
        
        // Analyser les dépassements de seuils
        const thresholdViolations = this.analyzeThresholdViolations();
        
        // Analyser la conformité
        const conformityData = this.analyzeConformity();
        
        // Analyser les atteintes nominales
        const nominalHitsData = this.analyzeNominalTensionHits();
        
        // Préparer les données pour le graphique journalier
        const dailyChartData = this.prepareDailyTensionChartData();
        
        // Préparer les données pour le graphique horaire
        const hourlyChartData = this.prepareHourlyTensionData();
        
        // ========== GÉNÉRATION DU HTML ==========
        
        // Générer le HTML pour l'onglet technique
        let techHTML = '';
        
        // 1. Données techniques du NR (statistiques tension)
        if (tensionStats) {
            techHTML += this.generateTensionStatsHTML(tensionStats);
        }
        
        // 2. Analyse de conformité
        if (conformityData) {
            techHTML += this.generateConformityStatsHTML(conformityData);
        }
        
        // 3. Tableau des dépassements de seuils
        techHTML += this.generateViolationsTableHTML(thresholdViolations);
        
        // 4. Analyse des atteintes nominales
        if (nominalHitsData) {
            techHTML += this.generateNominalTensionTableHTML(nominalHitsData);
        }
        
        // 5. GRAPHIQUE JOURNALIER (min, max, moyenne)
        if (dailyChartData) {
            techHTML += this.generateDailyTensionChartHTML(dailyChartData);
        }
        
        // 6. GRAPHIQUE HORAIRE (avec sélecteur de date)
        if (hourlyChartData) {
            techHTML += this.generateHourlyTensionChartHTML(hourlyChartData);
        }
        
        // ========== TABLEAUX TECHNIQUES AVEC ORDRE SPÉCIFIQUE ==========
        
        // Séparer les tableaux techniques par type
        const eventTables = techTables.filter(table => Array.from(table.types).includes('E'));
        const intensityTables = techTables.filter(table => Array.from(table.types).includes('I'));
        const tensionTables = techTables.filter(table => Array.from(table.types).includes('T'));
        const otherTechTables = techTables.filter(table => {
            const types = Array.from(table.types);
            return !types.includes('E') && !types.includes('I') && !types.includes('T');
        });
        
        // 7. D'ABORD : Tableaux d'événements (type E)
        if (eventTables.length > 0) {
            techHTML += `<h4 class="tab-subtitle" style="margin-top: 30px;">⚠️ Événements</h4>`;
            techHTML += this.generateTablesHTML(eventTables);
        }
        
        // 8. ENSUITE : Tableaux d'intensité (type I)
        if (intensityTables.length > 0) {
            techHTML += `<h4 class="tab-subtitle" style="margin-top: 30px;">⚡ Intensité</h4>`;
            techHTML += this.generateTablesHTML(intensityTables);
        }
        
        // 9. PUIS : Tableaux de tension (type T)
        if (tensionTables.length > 0) {
            techHTML += `<h4 class="tab-subtitle" style="margin-top: 30px;">📊 Tension</h4>`;
            techHTML += this.generateTablesHTML(tensionTables);
        }
        
        // 10. ENFIN : Autres tableaux techniques
        if (otherTechTables.length > 0) {
            techHTML += `<h4 class="tab-subtitle" style="margin-top: 30px;">📋 Autres données</h4>`;
            techHTML += this.generateTablesHTML(otherTechTables);
        }
        
        // Mettre à jour le contenu des onglets
        this.techContent.innerHTML = techHTML;
        this.comContent.innerHTML = `<h4 class="tab-subtitle">📈 Données Commerciales (S, R)</h4>` + this.generateTablesHTML(comTables);

        // Afficher les onglets si au moins un tableau
        if (this.parsedData.tables.length > 0) {
            this.tabsContainer.style.display = 'block';
            this.contentDisplay.style.display = 'none';
            this.switchTab(this.activeTab, false);
        } else {
            this.tabsContainer.style.display = 'none';
            this.contentDisplay.style.display = 'block';
            this.fileContent.innerHTML = '<div class="no-data-message">Aucune donnée tabulaire trouvée dans le fichier.</div>';
        }
    }

    generateTablesHTML(tables) {
        if (tables.length === 0) {
            return '<div class="no-data-message">Aucune donnée dans cette catégorie.</div>';
        }

        let html = '';
        
        tables.forEach((table) => {
            const mainType = Array.from(table.types)[0] || 'S';
            const tableType = this.getTableType(table.types);
            const typeColor = this.getTypeColor(mainType);
            const typeIcon = this.getTypeIcon(mainType);
            
            // Déterminer le titre du tableau en fonction du type
            let tableTitle = 'TABLEAU';
            if (mainType === 'T') tableTitle = 'TABLEAU DE LA TENSION';
            else if (mainType === 'I') tableTitle = "TABLEAU DE L'INTENSITÉ";
            else if (mainType === 'E') tableTitle = "TABLEAU DES ÉVÈNEMENTS";
            else if (mainType === 'S') tableTitle = 'TABLEAU DES SOLDES';
            else if (mainType === 'R') tableTitle = 'TABLEAU DES RECHARGES';
            else if (mainType === 'C') tableTitle = "TABLEAU DE L'ÉNERGIE";
            
            // Obtenir les lignes paginées
            const paginatedRows = this.getPaginatedRows(table, table.tableId);
            const totalRows = table.rows.length;
            const totalPages = Math.ceil(totalRows / this.rowsPerPage);
            const currentPage = this.currentPages[table.tableId] || 1;
            
            html += `<div class="table-wrapper" style="border-left: 4px solid ${typeColor};">`;
            
            // En-tête du tableau avec titre personnalisé
            html += `<div class="table-header" style="background: linear-gradient(135deg, ${typeColor}, ${this.adjustColor(typeColor, -20)});">`;
            html += `<span class="table-icon">${typeIcon}</span>`;
            html += `<span class="table-title">${tableTitle}</span>`;
            html += `<span class="table-type-badge">${tableType}</span>`;
            html += `</div>`;

            html += `<div class="table-container">`;
            html += `<table>`;
            
            // En-tête du tableau
            html += `<thead><tr>`;
            table.header.forEach(header => {
                let formattedHeader = header.trim();
                formattedHeader = formattedHeader.replace(/Client/g, 'CL');
                formattedHeader = formattedHeader.replace(/TimeStamp/g, 'DATE');
                formattedHeader = formattedHeader.replace(/Timestamp/g, 'DATE');
                formattedHeader = formattedHeader.replace(/Tension/g, 'TENS');
                html += `<th>${formattedHeader.toUpperCase()}</th>`;
            });
            html += `</tr></thead>`;

            // Corps du tableau avec lignes paginées
            html += `<tbody>`;
            paginatedRows.forEach(row => {
                html += `<tr>`;
                row.forEach((cell, cellIndex) => {
                    let cellClass = '';
                    let customStyle = '';
                    
                    if (cell === 'Erreur' || cell.includes('Erreur')) {
                        cellClass = 'cell-error';
                    } else if (cell === 'Ok') {
                        cellClass = 'cell-ok';
                    } else if (cell === 'Recharge Reussie') {
                        cellClass = 'cell-success';
                    } else if (cell === 'Deja saisie') {
                        cellClass = 'cell-warning';
                    } else if (!isNaN(cell) && cell !== '' && !cell.includes(':')) {
                        cellClass = 'cell-number';
                    }
                    
                    if (cellIndex === 0 && cell.length <= 3 && cell.match(/^[A-Z]$/)) {
                        const typeColor = this.getTypeColor(cell);
                        const typeLabel = this.getTypeLabel(cell);
                        customStyle = `style="background: ${typeColor}15; font-weight: 700; color: ${typeColor}; border-left: 3px solid ${typeColor};"`;
                        html += `<td ${customStyle} class="${cellClass} type-cell" title="${typeLabel}"><strong>${cell}</strong></td>`;
                    } else {
                        html += `<td class="${cellClass}">${cell}</td>`;
                    }
                });
                html += `</tr>`;
            });
            html += `</tbody>`;
            
            html += `</table>`;
            
            // Pagination avec style Premier Prev X/Y Next Dernier
            if (totalPages > 1) {
                html += `<div class="pagination-container">`;
                
                // Informations de pagination
                html += `<div class="pagination-info-compact">`;
                html += `Page <strong>${currentPage}</strong> sur <strong>${totalPages}</strong>`;
                html += `</div>`;
                
                // Contrôles de pagination
                html += `<div class="pagination-controls-compact">`;
                
                // Bouton Premier
                html += `<button class="pagination-btn-compact" onclick="window.fileReader.changePage('${table.tableId}', 1)" ${currentPage === 1 ? 'disabled' : ''} title="Première page">`;
                html += `Premier`;
                html += `</button>`;
                
                // Bouton Précédent
                html += `<button class="pagination-btn-compact" onclick="window.fileReader.changePage('${table.tableId}', 'prev')" ${currentPage === 1 ? 'disabled' : ''} title="Page précédente">`;
                html += `Prev`;
                html += `</button>`;
                
                // Indicateur de page
                html += `<span class="pagination-current">${currentPage}/${totalPages}</span>`;
                
                // Bouton Suivant
                html += `<button class="pagination-btn-compact" onclick="window.fileReader.changePage('${table.tableId}', 'next')" ${currentPage === totalPages ? 'disabled' : ''} title="Page suivante">`;
                html += `Next`;
                html += `</button>`;
                
                // Bouton Dernier
                html += `<button class="pagination-btn-compact" onclick="window.fileReader.changePage('${table.tableId}', ${totalPages})" ${currentPage === totalPages ? 'disabled' : ''} title="Dernière page">`;
                html += `Dernier`;
                html += `</button>`;
                
                html += `</div>`;
                html += `</div>`;
            }
            
            html += `</div>`; // Fin table-container
            html += `</div>`; // Fin table-wrapper
        });

        return html;
    }


    switchTab(tab, updateActiveTab = true) {
        if (updateActiveTab) {
            this.activeTab = tab;
        }
        
        if (tab === 'tech') {
            this.techTabBtn.classList.add('active');
            this.comTabBtn.classList.remove('active');
            this.techTab.classList.add('active');
            this.comTab.classList.remove('active');
        } else {
            this.techTabBtn.classList.remove('active');
            this.comTabBtn.classList.add('active');
            this.techTab.classList.remove('active');
            this.comTab.classList.add('active');
        }
    }

    adjustColor(color, percent) {
        // Fonction simple pour assombrir/éclaircir une couleur hex
        if (color.startsWith('#')) {
            return color; // Simplifié pour l'exemple
        }
        return color;
    }
}

// Initialiser l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    new FileReaderModule();
});