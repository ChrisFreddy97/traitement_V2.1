// arduinoPagination.js
import { ROWS_PER_PAGE } from './arduinoConstants.js';
import { database } from './arduinoCore.js';

export function generatePagination(tableIdx, page) {
    if (page.totalPages <= 1) return '';
    return `
        <div class="pagination" data-table-index="${tableIdx}">
            <button class="pagination-button" data-action="first" ${page.pageNumber === 1 ? 'disabled' : ''}>⏮️</button>
            <button class="pagination-button" data-action="prev" ${page.pageNumber === 1 ? 'disabled' : ''}>◀️</button>
            <div class="pagination-info">
                Page <input type="number" class="pagination-input" value="${page.pageNumber}" min="1" max="${page.totalPages}" data-table-index="${tableIdx}"> / ${page.totalPages}
            </div>
            <button class="pagination-button" data-action="next" ${page.pageNumber === page.totalPages ? 'disabled' : ''}>▶️</button>
            <button class="pagination-button" data-action="last" ${page.pageNumber === page.totalPages ? 'disabled' : ''}>⏭️</button>
        </div>
    `;
}

export function attachPaginationEvents(renderCallback) {
    document.querySelectorAll('.pagination-button').forEach(button => {
        button.removeEventListener('click', handlePaginationClick);
        button.addEventListener('click', (e) => handlePaginationClick(e, renderCallback));
    });

    document.querySelectorAll('.pagination-input').forEach(input => {
        input.removeEventListener('change', handlePageInputChange);
        input.addEventListener('change', (e) => handlePageInputChange(e, renderCallback));
        input.removeEventListener('keypress', handlePageInputKeypress);
        input.addEventListener('keypress', handlePageInputKeypress);
    });
}

function handlePaginationClick(e, renderCallback) {
    const button = e.currentTarget;
    const paginationDiv = button.closest('.pagination');
    if (!paginationDiv) return;

    const tableIndex = parseInt(paginationDiv.dataset.tableIndex);
    const table = database.tables[tableIndex];
    if (!table) return;

    const currentPage = database.currentPages[tableIndex] || 1;
    const totalPages = Math.ceil(table.data.length / ROWS_PER_PAGE);
    let newPage = currentPage;

    switch (button.dataset.action) {
        case 'first': newPage = 1; break;
        case 'prev': newPage = Math.max(1, currentPage - 1); break;
        case 'next': newPage = Math.min(totalPages, currentPage + 1); break;
        case 'last': newPage = totalPages; break;
    }

    if (newPage !== currentPage) {
        database.currentPages[tableIndex] = newPage;
        renderCallback();
        setTimeout(() => {
            const tableBlock = document.querySelector(`.table-block[data-table-index="${tableIndex}"] .table-wrapper`);
            if (tableBlock) tableBlock.scrollTop = 0;
        }, 50);
    }
}

function handlePageInputChange(e, renderCallback) {
    const input = e.currentTarget;
    const paginationDiv = input.closest('.pagination');
    if (!paginationDiv) return;

    const tableIndex = parseInt(paginationDiv.dataset.tableIndex);
    const table = database.tables[tableIndex];
    if (!table) return;

    const totalPages = Math.ceil(table.data.length / ROWS_PER_PAGE);
    let newPage = parseInt(input.value);

    if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
        database.currentPages[tableIndex] = newPage;
        renderCallback();
        setTimeout(() => {
            const tableBlock = document.querySelector(`.table-block[data-table-index="${tableIndex}"] .table-wrapper`);
            if (tableBlock) tableBlock.scrollTop = 0;
        }, 50);
    } else {
        input.value = database.currentPages[tableIndex] || 1;
    }
}

function handlePageInputKeypress(e) {
    if (e.key === 'Enter') e.currentTarget.dispatchEvent(new Event('change'));
}