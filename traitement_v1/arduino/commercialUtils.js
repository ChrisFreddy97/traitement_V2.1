/**
 * commercialUtils.js
 * Fonctions utilitaires pour l'export de données commerciales
 */

/**
 * Générer un rapport CSV pour tous les clients
 */
export function generateClientsCSV(clients) {
    if (!clients || clients.length === 0) return '';
    
    const headers = [
        'Client ID',
        'Forfait',
        'Score',
        'Consommation Max (Wh)',
        'Consommation Moy (Wh)',
        'Crédit Moyen',
        'Jours sans crédit',
        'Changements forfait',
        'Événements',
        'Statut'
    ];
    
    const rows = clients.map(c => [
        c.id,
        c.forfaitName || 'N/A',
        c.score?.valeur || '-',
        c.consommation?.max || 0,
        c.consommation?.moyenne || 0,
        c.averageCredit || 0,
        c.zeroCreditPercentage || 0,
        (c.forfaitChanges?.length || 0),
        (c.events?.length || 0),
        c.score?.grade || 'N/A'
    ]);
    
    const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.map(cell => 
            typeof cell === 'string' && cell.includes(';') 
                ? `"${cell}"` 
                : cell
        ).join(';'))
    ].join('\n');
    
    return csvContent;
}

/**
 * Générer un rapport CSV pour un client détaillé
 */
export function generateClientDetailsCSV(client) {
    if (!client) return '';
    
    let csv = 'RAPPORT DÉTAILLÉ CLIENT\n\n';
    
    csv += '=== INFORMATIONS GÉNÉRALES ===\n';
    csv += `Client ID;${client.id}\n`;
    csv += `Forfait;${client.forfaitName || 'N/A'}\n`;
    csv += `Score;${client.score?.valeur || '-'}/100\n`;
    csv += `Profil;${client.score?.grade || 'N/A'}\n\n`;
    
    csv += '=== CONSOMMATION ===\n';
    csv += `Énergie maximale;${client.consommation?.max || 0} Wh\n`;
    csv += `Énergie moyenne;${client.consommation?.moyenne || 0} Wh\n`;
    csv += `Jours sans consommation;${client.consommation?.joursSans || 0}\n\n`;
    
    csv += '=== CRÉDIT ===\n';
    csv += `Crédit moyen;${client.averageCredit || 0}\n`;
    csv += `% Jours sans crédit;${client.zeroCreditPercentage || 0}\n`;
    csv += `Total recharges;${client.totalRecharges || 0}\n\n`;
    
    csv += '=== FORFAIT ===\n';
    csv += `Forfait actuel;${client.forfaitName || 'N/A'}\n`;
    csv += `Changements détectés;${(client.forfaitChanges || []).length}\n\n`;
    
    csv += '=== ÉVÉNEMENTS ===\n';
    csv += `Total événements;${(client.events || []).length}\n\n`;
    
    return csv;
}

/**
 * Générer HTML pour impression PDF
 */
export function generateClientPDFHTML(client) {
    const score = client.score || { valeur: '-', grade: 'N/A' };
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
                color: #333;
            }
            h1 { color: #2c3e50; border-bottom: 3px solid #e74c3c; padding-bottom: 10px; }
            h2 { color: #2c3e50; margin-top: 20px; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #2c3e50; color: white; }
            .score-badge { 
                display: inline-block;
                padding: 8px 12px;
                border-radius: 4px;
                font-weight: bold;
                color: white;
            }
            .score-A { background: #27ae60; }
            .score-B { background: #3498db; }
            .score-C { background: #f39c12; }
            .score-D { background: #e74c3c; }
            .footer { margin-top: 30px; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
    </head>
    <body>
        <h1>Rapport Client #${client.id}</h1>
        
        <h2>Informations Générales</h2>
        <table>
            <tr><td>Forfait actuel</td><td>${client.forfaitName || 'N/A'}</td></tr>
            <tr><td>Profil client</td><td><span class="score-badge score-${score.grade}">${score.grade}</span></td></tr>
            <tr><td>Score</td><td>${score.valeur}/100</td></tr>
        </table>
        
        <h2>Consommation Énergétique</h2>
        <table>
            <tr><td>Énergie maximale</td><td>${client.consommation?.max || 0} Wh</td></tr>
            <tr><td>Énergie moyenne</td><td>${client.consommation?.moyenne || 0} Wh</td></tr>
            <tr><td>Jours sans consommation</td><td>${client.consommation?.joursSans || 0}</td></tr>
        </table>
        
        <h2>Gestion du Crédit</h2>
        <table>
            <tr><td>Crédit moyen</td><td>${client.averageCredit || 0}</td></tr>
            <tr><td>% de jours sans crédit</td><td>${client.zeroCreditPercentage || 0}%</td></tr>
            <tr><td>Total recharges</td><td>${client.totalRecharges || 0}</td></tr>
        </table>
        
        <h2>Historique Forfait</h2>
        <table>
            <tr><td>Forfait actuel</td><td>${client.forfaitName || 'N/A'}</td></tr>
            <tr><td>Changements de forfait</td><td>${(client.forfaitChanges || []).length}</td></tr>
        </table>
        
        <h2>Événements</h2>
        <table>
            <tr><td>Total d'événements</td><td>${(client.events || []).length}</td></tr>
        </table>
        
        <div class="footer">
            <p>Rapport généré le ${new Date().toLocaleString('fr-FR')}</p>
            <p>Analyseur de données NANORESEAU</p>
        </div>
    </body>
    </html>
    `;
    
    return html;
}

/**
 * Télécharger un fichier
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * Exporter CSV via API Electron si disponible
 */
export async function exportCSVElectron(csvContent, filename) {
    if (window.electronAPI && window.electronAPI.saveCSV) {
        return window.electronAPI.saveCSV(csvContent, filename);
    }
    // Fallback: téléchargement direct
    downloadFile(csvContent, filename, 'text/csv');
}

/**
 * Exporter PDF via API Electron si disponible
 */
export async function exportPDFElectron(htmlContent, filename) {
    if (window.electronAPI && window.electronAPI.savePDF) {
        return window.electronAPI.savePDF(htmlContent, filename);
    }
    // Fallback: impression
    const newWindow = window.open('', '', 'height=500,width=900');
    newWindow.document.write(htmlContent);
    newWindow.document.close();
    newWindow.print();
}
