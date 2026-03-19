// arduinoParser.js
import { ROWS_PER_PAGE } from './arduinoConstants.js';
import { database } from './arduinoCore.js';

export function parseRawTables(content) {
    const lines = content.split('\n');
    const tables = [];
    let currentHeader = null;
    let currentType = null;
    let currentData = [];
    let currentIndex = 0;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.match(/^<?Type;/i)) {
            if (currentHeader && currentData.length > 0) {
                tables.push({
                    id: `table_${currentIndex++}`,
                    type: currentType,
                    header: currentHeader,
                    data: [...currentData]
                });
            }
            currentHeader = line.replace(/^</, '').replace(/>$/, '');
            currentType = null;
            currentData = [];
            continue;
        }

        const dataMatch = line.match(/^([A-Z]);/);
        if (dataMatch && currentHeader) {
            const type = dataMatch[1];
            if (currentType && type !== currentType && currentData.length > 0) {
                tables.push({
                    id: `table_${currentIndex++}`,
                    type: currentType,
                    header: currentHeader,
                    data: [...currentData]
                });
                currentData = [];
            }
            currentType = type;
            currentData.push(line);
        }
    }

    if (currentHeader && currentData.length > 0) {
        tables.push({
            id: `table_${currentIndex++}`,
            type: currentType,
            header: currentHeader,
            data: currentData
        });
    }
    return tables;
}

export function buildDatabase(tablesToUse) { 
    database.tables = tablesToUse;  
    database.pages = [];
    database.currentPages = {};

    let pageIndex = 0;

    tablesToUse.forEach((table, tableIdx) => {  // ← utiliser le paramètre
        const totalRows = table.data.length;
        const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
        database.currentPages[tableIdx] = 1;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const startIdx = (pageNum - 1) * ROWS_PER_PAGE;
            const endIdx = Math.min(startIdx + ROWS_PER_PAGE, totalRows);
            const pageData = table.data.slice(startIdx, endIdx);

            const pageRows = pageData.map((row, rowIdx) => ({
                id: `row_${tableIdx}_${pageNum}_${rowIdx + startIdx}`,
                content: row,
                cells: row.split(';')
            }));

            database.pages.push({
                id: `page_${pageIndex++}`,
                tableId: table.id,
                tableIndex: tableIdx,
                pageNumber: pageNum,
                startRow: startIdx + 1,
                endRow: endIdx,
                totalRows: totalRows,
                totalPages: totalPages,
                rows: pageRows,
                header: table.header,
                type: table.type
            });
        }
    });
}