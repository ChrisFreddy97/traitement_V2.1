 const fileInput = document.getElementById('fileInput');
        const fileName = document.getElementById('fileName');
        const uploadSection = document.getElementById('uploadSection');
        const infoSection = document.getElementById('infoSection');
        const tablesContainer = document.getElementById('tablesContainer');
        const errorMessage = document.getElementById('errorMessage');
        const nanoreseauValue = document.getElementById('nanoreseauValue');
        const typeLegend = document.getElementById('typeLegend');
        const summaryGrid = document.getElementById('summaryGrid');

        // Configuration des types de tableaux
        const tableTypes = {
            'I': { name: 'Intensité', color: '#4CAF50', icon: '⚡' },
            'S': { name: 'Statistiques', color: '#2196F3', icon: '📊' },
            'R': { name: 'Recharges', color: '#FF9800', icon: '💳' },
            'E': { name: 'Événements', color: '#F44336', icon: '🔔' },
            'T': { name: 'Tension', color: '#9C27B0', icon: '🔋' }
        };

        // Gestion de l'upload de fichier
        fileInput.addEventListener('change', handleFileSelect);

        // Drag and drop
        uploadSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadSection.classList.add('dragover');
        });

        uploadSection.addEventListener('dragleave', () => {
            uploadSection.classList.remove('dragover');
        });

        uploadSection.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadSection.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                handleFileSelect();
            }
        });

        function handleFileSelect() {
            const file = fileInput.files[0];
            
            if (!file) return;

            fileName.textContent = `📄 ${file.name}`;
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const content = e.target.result;
                parseFileContent(content);
            };
            
            reader.onerror = function() {
                showError('Erreur lors de la lecture du fichier');
            };
            
            reader.readAsText(file);
        }

        function parseFileContent(content) {
            try {
                hideError();
                
                // Extraire NANORESEAU
                const nanoreseauMatch = content.match(/<#NANORESEAU:(\d+)>/);
                
                if (!nanoreseauMatch) {
                    showError('Numéro NANORESEAU non trouvé dans le fichier');
                    return;
                }
                
                const nanoreseau = nanoreseauMatch[1];
                nanoreseauValue.textContent = nanoreseau;
                
                // Parser tous les tableaux
                const tables = parseMultipleTables(content);
                
                if (tables.length === 0) {
                    showError('Aucune donnée valide trouvée dans le fichier');
                    return;
                }
                
                // Créer le résumé
                createSummary(tables);
                
                // Créer la légende
                createLegend(tables);
                
                // Afficher tous les tableaux
                displayTables(tables);
                
                infoSection.classList.add('show');
                tablesContainer.classList.add('show');
                
            } catch (error) {
                showError('Erreur lors de l\'analyse du fichier: ' + error.message);
                console.error(error);
            }
        }

        function parseMultipleTables(content) {
            const lines = content.split('\n');
            const tables = [];
            let currentHeader = null;
            let currentType = null;
            let currentData = [];
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Ignorer les lignes vides
                if (!line) continue;
                
                // Détecter une nouvelle en-tête
                if (line.match(/^<?Type;/i)) {
                    // Sauvegarder le tableau précédent s'il existe
                    if (currentHeader && currentData.length > 0) {
                        tables.push({
                            type: currentType,
                            header: currentHeader,
                            data: currentData
                        });
                    }
                    
                    // Nouvelle en-tête
                    currentHeader = line.replace(/^</, '').replace(/>$/, '');
                    currentType = null;
                    currentData = [];
                    continue;
                }
                
                // Détecter une ligne de données (commence par une lettre suivie de ;)
                const dataMatch = line.match(/^([A-Z]);/);
                if (dataMatch && currentHeader) {
                    const type = dataMatch[1];
                    
                    // Si changement de type, créer un nouveau tableau
                    if (currentType && type !== currentType && currentData.length > 0) {
                        tables.push({
                            type: currentType,
                            header: currentHeader,
                            data: currentData
                        });
                        currentData = [];
                    }
                    
                    currentType = type;
                    currentData.push(line);
                }
            }
            
            // Sauvegarder le dernier tableau
            if (currentHeader && currentData.length > 0) {
                tables.push({
                    type: currentType,
                    header: currentHeader,
                    data: currentData
                });
            }
            
            return tables;
        }

        function createSummary(tables) {
            const summary = {};
            tables.forEach(table => {
                if (!summary[table.type]) {
                    summary[table.type] = 0;
                }
                summary[table.type] += table.data.length;
            });
            
            let summaryHTML = '';
            Object.keys(summary).sort().forEach(type => {
                const typeInfo = tableTypes[type] || { name: type, icon: '📋' };
                summaryHTML += `
                    <div class="summary-item">
                        <div class="summary-item-label">${typeInfo.icon} ${typeInfo.name}</div>
                        <div class="summary-item-value">${summary[type]}</div>
                    </div>
                `;
            });
            
            summaryGrid.innerHTML = summaryHTML;
        }

        function createLegend(tables) {
            const types = [...new Set(tables.map(t => t.type))].sort();
            
            let legendHTML = '<strong style="margin-right: 15px;">Types de données :</strong>';
            types.forEach(type => {
                const typeInfo = tableTypes[type] || { name: type, color: '#999', icon: '📋' };
                legendHTML += `
                    <div class="legend-item">
                        <div class="legend-badge type-${type}" style="background: ${typeInfo.color};">
                            ${type}
                        </div>
                        <span>${typeInfo.icon} ${typeInfo.name}</span>
                    </div>
                `;
            });
            
            typeLegend.innerHTML = legendHTML;
        }

        function displayTables(tables) {
            let tablesHTML = '';
            
            tables.forEach((table, index) => {
                const typeInfo = tableTypes[table.type] || { name: table.type, color: '#999', icon: '📋' };
                
                // Créer l'en-tête du tableau
                const headers = table.header.split(';').filter(h => h.trim() !== '');
                let headerHTML = '<tr>';
                headers.forEach(header => {
                    headerHTML += `<th>${header.trim()}</th>`;
                });
                headerHTML += '</tr>';
                
                // Créer les lignes de données
                let bodyHTML = '';
                table.data.forEach(line => {
                    const cells = line.split(';');
                    bodyHTML += '<tr>';
                    cells.forEach(cell => {
                        bodyHTML += `<td>${cell.trim()}</td>`;
                    });
                    bodyHTML += '</tr>';
                });
                
                // Créer le bloc de tableau
                tablesHTML += `
                    <div class="table-block">
                        <div class="table-header">
                            <div class="table-title">
                                ${typeInfo.icon} ${typeInfo.name} (Type ${table.type})
                            </div>
                            <div class="table-badge">
                                ${table.data.length} enregistrement(s)
                            </div>
                        </div>
                        <div class="table-wrapper">
                            <table>
                                <thead>${headerHTML}</thead>
                                <tbody>${bodyHTML}</tbody>
                            </table>
                        </div>
                    </div>
                `;
            });
            
            tablesContainer.innerHTML = tablesHTML;
        }

        function showError(message) {
            errorMessage.textContent = '⚠️ ' + message;
            errorMessage.classList.add('show');
            infoSection.classList.remove('show');
            tablesContainer.classList.remove('show');
        }

        function hideError() {
            errorMessage.classList.remove('show');
        }