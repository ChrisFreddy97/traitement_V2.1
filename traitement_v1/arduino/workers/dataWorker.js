// workers/dataWorker.js
// Worker module handling heavy parsing and analyses off the UI thread.
import { parseRawTables, buildDatabase } from '../arduinoParser.js';
import { analyzeTechnicalData } from '../analytics/technicalAnalytics.js';
import { analyzeEnergyData } from '../analytics/energyAnalytics.js';
import { analyzeCommercialData } from '../analytics/commercialAnalytics.js';
import { buildEventMap } from '../analytics/eventAnalytics.js';
import { linkEnergyToCommercial, database } from '../arduinoCore.js';

self.addEventListener('message', async (e) => {
    const { content, nanoreseau } = e.data;
    try {
        // Provide a minimal `document.getElementById` for modules that expect it
        // so they can read the nanoreseau. This avoids crashing when modules
        // call `document.getElementById('nanoreseauValue')` inside the worker.
        globalThis.document = {
            getElementById: (id) => {
                if (id === 'nanoreseauValue') return { textContent: nanoreseau };
                return null;
            }
        };

        const rawTables = parseRawTables(content || '');
        buildDatabase(rawTables);

        // Expose nanoreseau on database for any code using it
        if (nanoreseau) database.nanoreseau = nanoreseau;

        buildEventMap();
        analyzeTechnicalData();
        analyzeEnergyData();
        analyzeCommercialData();
        linkEnergyToCommercial();

        // Serialize database (convert Map/Set to arrays where needed)
        const serialized = JSON.parse(JSON.stringify(database, (key, value) => {
            if (value instanceof Map) return Array.from(value.entries());
            if (value instanceof Set) return Array.from(value);
            return value;
        }));

        self.postMessage({ success: true, nanoreseau, database: serialized });
    } catch (err) {
        self.postMessage({ success: false, error: err.message });
    }
});
