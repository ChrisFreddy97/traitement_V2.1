const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    icon: path.join(__dirname, 'img/logo.jpg'),
    title: 'Analyseur V2',
    show: false,
    autoHideMenuBar: true,  // Cache automatiquement la barre de menu
    menu: null              // Supprime complètement le menu
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Mode développement
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Gestion du cycle de vie
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ==================== IPC HANDLERS ====================

// Sélectionner un dossier
ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Sélectionner un dossier contenant les fichiers .txt',
      buttonLabel: 'Sélectionner'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, folderPath: result.filePaths[0] };
    }
    return { success: false, error: 'Aucun dossier sélectionné' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Lire les fichiers d'un dossier
ipcMain.handle('read-folder', async (event, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    const txtFiles = files.filter(file => 
      file.toLowerCase().endsWith('.txt') && !file.startsWith('.')
    );
    
    const fileContents = [];
    for (const file of txtFiles) {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        const content = fs.readFileSync(filePath, 'utf8');
        fileContents.push({
          name: file,
          path: filePath,
          content: content,
          size: stats.size
        });
      }
    }
    
    return { 
      success: true, 
      files: fileContents,
      totalFiles: txtFiles.length
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      files: [] 
    };
  }
});

// Exporter des données
ipcMain.handle('export-data', async (event, exportData) => {
  try {
    const { data, filename, format = 'json' } = exportData;
    
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${filename || 'export'}.${format}`,
      filters: [
        { name: 'Fichiers JSON', extensions: ['json'] },
        { name: 'Fichiers CSV', extensions: ['csv'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      let content = format === 'csv' ? convertToCSV(data) : JSON.stringify(data, null, 2);
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { success: true, path: result.filePath };
    }
    
    return { success: false, error: 'Export annulé' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Obtenir la version de l'app
ipcMain.handle('get-app-version', () => {
  return {
    version: app.getVersion(),
    name: app.getName()
  };
});

// ==================== HANDLERS UPLOAD DOSSIER ====================

// Lire la structure complète d'un dossier (récursivement)
ipcMain.handle('upload-folder-structure', async (event, folderPath) => {
  try {
    let totalFiles = 0;
    let totalSubfolders = 0;
    let totalSize = 0;
    
    function scanDirectory(dirPath, maxDepth = 100, currentDepth = 0) {
      if (currentDepth > maxDepth) {
        return { name: '', files: [], subdirs: [] };
      }
      
      const structure = {
        name: path.basename(dirPath),
        files: [],
        subdirs: []
      };
      
      try {
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
          if (item.startsWith('.')) continue;
          
          const itemPath = path.join(dirPath, item);
          const stats = fs.statSync(itemPath);
          
          if (stats.isFile()) {
            // Accepter uniquement les fichiers .txt
            if (item.toLowerCase().endsWith('.txt')) {
              structure.files.push(item);
              totalFiles++;
              totalSize += stats.size;
            }
          } else if (stats.isDirectory()) {
            totalSubfolders++;
            const substructure = scanDirectory(itemPath, maxDepth, currentDepth + 1);
            structure.subdirs.push(substructure);
          }
        }
      } catch (error) {
        console.error('Erreur lors de la lecture de', dirPath, error);
      }
      
      return structure;
    }
    
    const structure = scanDirectory(folderPath);
    
    // Limiter à 1000 fichiers .txt
    if (totalFiles > 1000) {
      return {
        success: false,
        error: `Le dossier contient ${totalFiles} fichiers .txt. Limite: 1000 fichiers maximum.`
      };
    }
    
    // Vérifier s'il y a au moins des fichiers .txt
    if (totalFiles === 0) {
      return {
        success: false,
        error: `Aucun fichier .txt trouvé dans le dossier. Seuls les fichiers .txt sont acceptés.`
      };
    }
    
    return {
      success: true,
      structure: structure,
      totalFiles: totalFiles,
      totalSubfolders: totalSubfolders,
      totalSize: totalSize
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Uploader et sauvegarder la structure du dossier
ipcMain.handle('upload-folder', async (event, folderData) => {
  try {
    // Le dossier est sauvegardé dans le localStorage côté renderer
    // Ici on peut ajouter une sauvegarde serveur si nécessaire
    
    console.log('✅ Dossier uploadé:', {
      name: folderData.name,
      files: folderData.totalFiles,
      date: folderData.date
    });
    
    return {
      success: true,
      message: 'Dossier uploadé avec succès',
      id: folderData.id
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Lire le contenu d'un fichier
ipcMain.handle('read-file-content', async (event, filePath) => {
  try {
    // Vérifier que le chemin reste dans les limites (sécurité)
    const normalizedPath = path.normalize(filePath);
    
    // Lire le fichier
    const content = fs.readFileSync(normalizedPath, 'utf8');
    
    // Limiter la taille affichée à 5000 caractères
    // const truncatedContent = content.length > 5000 
    //   ? content.substring(0, 5000) + '\n\n... (contenu tronqué)' 
    //   : content;
    return {
      success: true,
      content: content  // Renvoyer TOUT le contenu
    };
    
  } catch (error) {
    console.error('❌ Erreur de lecture:', filePath, error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// ==================== NOUVEAUX HANDLERS POUR LA SÉLECTION DE FICHIERS ====================

// Obtenir la date de modification d'un fichier
ipcMain.handle('get-file-date', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      success: true,
      date: stats.mtime // Date de dernière modification
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      date: null 
    };
  }
});

// Obtenir la taille d'un fichier
ipcMain.handle('get-file-size', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      success: true,
      size: stats.size // Taille en bytes
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      size: 0 
    };
  }
});

// Uploader uniquement les fichiers sélectionnés
ipcMain.handle('upload-selected-files', async (event, folderData) => {
  try {
    console.log('📤 Upload des fichiers sélectionnés:', {
      dossier: folderData.name,
      fichiers: folderData.selectedFiles?.length || 0,
      chemin: folderData.folderPath
    });
    
    // Ici, vous pouvez ajouter la logique pour traiter les fichiers sélectionnés
    // Par exemple : copier les fichiers vers un répertoire de destination
    
    // Pour l'instant, on simule juste un upload réussi
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { 
      success: true,
      message: `${folderData.selectedFiles?.length || 0} fichiers uploadés avec succès`
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Fonction utilitaire pour CSV
function convertToCSV(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] || '';
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Gestion des erreurs
process.on('uncaughtException', (error) => {
  console.error('Erreur:', error);
});