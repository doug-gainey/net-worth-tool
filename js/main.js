// Copyright (c) 2024, Doug Gainey
// All rights reserved.
// This source code is licensed under the BSD-style license found in the
// LICENSE file in the root directory of this source tree.
(function () {
    const DB_NAME = 'NetWorth';
    const TABLE_NAME = 'Entries';

    let _db = null,
        _chart = null,
        _editDate = null,
        _undoData = null;

    const select = function (selector) {
        return document.querySelector(selector);
    };

    const isDate = function (d) {
        return !isNaN(Date.parse(d));
    };

    const isNumeric = function (n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    };

    const formatDate = function (date) {
        return new Date(`${date}T00:00:00`).toLocaleDateString();
    };

    const formatNumber = function (number, style = 'currency') {
        const options = {
            style,
            currency: 'USD',
            maximumFractionDigits: 2
        }

        return new Intl.NumberFormat('en-US', options).format(number);
    };

    const stripHtml = function (html) {
        if (!html) {
            return '';
        }

        return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
    };

    const csvToArray = function (text) {
        let previousCharacter = '',
            withinQuotes = false,
            characterIndex = 0,
            rowIndex = 0,
            row = [''];

        const rows = [row];

        for (let character of text) {
            if (character === '"') {
                if (character === previousCharacter && !withinQuotes) {
                    row[characterIndex] += character;
                }

                withinQuotes = !withinQuotes;
            } else if (character === ',' && !withinQuotes) {
                character = row[++characterIndex] = '';
            } else if (character === '\n' && !withinQuotes) {
                if (previousCharacter === '\r') {
                    row[characterIndex] = row[characterIndex].slice(0, -1);
                }

                row = rows[++rowIndex] = [character = ''];
                characterIndex = 0;
            } else {
                row[characterIndex] += character;
                previousCharacter = character;
            }
        }

        return rows;
    };

    const addRow = function ({date, assets, debts, notes}) {
        select('.js-entries-table').classList.remove('visually-hidden');
        select('.js-entries').insertAdjacentHTML('beforeend', `
            <tr data-date="${date}">
                <td>${formatDate(date)}</td>
                <td class="text-end text-success">${formatNumber(assets)}</td>
                <td class="text-end text-danger">${formatNumber(debts)}</td>
                <td></td>
                <td>${notes}</td>
                <td class="text-end text-net-worth">${formatNumber(assets - debts)}</td>
                <td class="actions">
                    <button type="button" class="btn btn-light js-edit" data-bs-toggle="modal" data-bs-target=".js-add-form">
                        <span class="bi-pencil-square"></span>
                    </button>
                </td>
                <td class="actions">
                    <button type="submit" class="btn btn-light js-delete">
                        <span class="bi-x-circle"></span>
                    </button>
                </td>
            </tr>`);
    };

    const loadData = function () {
        const index = _db.transaction(TABLE_NAME, 'readonly').objectStore(TABLE_NAME).index('date');
        const dates = [];
        const assets = [];
        const debts = [];
        const netWorth = [];
        let firstEntry = null;
        let lastEntry = null;

        select('.js-entries-table').classList.add('visually-hidden');
        select('.js-entries').innerHTML = '';
        index.openCursor(null, 'prev').onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                const row = cursor.value;

                firstEntry = row;
                if (!lastEntry) {
                    lastEntry = row
                }

                dates.push(formatDate(row.date));
                assets.push(row.assets);
                debts.push(row.debts);
                netWorth.push(row.assets - row.debts);
                addRow(row);

                cursor.continue();
            } else {
                const ctx = select('.chart');

                if (_chart) {
                    _chart.destroy();
                }

                _chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: dates,
                        datasets: [
                            {
                                label: 'Assets',
                                data: assets.reverse(),
                                backgroundColor: '#198754',
                                borderColor: '#198754'
                            },
                            {
                                label: 'Debts',
                                data: debts.reverse(),
                                backgroundColor: '#dc3545',
                                borderColor: '#dc3545'
                            },
                            {
                                label: 'Net Worth',
                                data: netWorth.reverse(),
                                backgroundColor: '#36a2eb',
                                borderColor: '#36a2eb'
                            }
                        ]
                    },
                    options: {
                        interaction: {
                            mode: 'index'
                        },
                        plugins: {
                            legend: {
                                labels: {
                                    padding: 32
                                }
                            },
                            tooltip: {
                                boxPadding: 3,
                                callbacks: {
                                    label(context) {
                                        let label = context.dataset.label || '';

                                        if (label) {
                                            label += ': ';
                                        }

                                        if (context.parsed.y !== null) {
                                            label += formatNumber(context.parsed.y);
                                        }

                                        return label;
                                    }
                                }
                            }
                        }
                    }
                });

                // Calculate growth rate
                let monthlyGrowthRate = 0;
                let yearlyGrowthRate = 0;
                if (firstEntry && lastEntry && firstEntry !== lastEntry) {
                    const beginDate = new Date(`${firstEntry.date}T00:00:00`);
                    const endDate = new Date(`${lastEntry.date}T00:00:00`);
                    const days = Math.floor((endDate - beginDate) / 1000 / 60 / 60 / 24); // Date diff / 1000ms / 60s / 60m / 24h
                    const beginNetWorth = firstEntry.assets - firstEntry.debts;
                    const endNetWorth = lastEntry.assets - lastEntry.debts;
                    const dailyGrowthRate = Math.pow(endNetWorth / beginNetWorth, 1 / days) - 1;

                    // This calculation doesn't work if beginning net worth is zero... we'll show N/A in that scenario.
                    // It's also not that meaningful for some scenarios where one or both of the values are negative,
                    // but you don't need a percentage to let you know that's not good. :)
                    monthlyGrowthRate = days >= 30 ? Math.pow(endNetWorth / beginNetWorth, 1 / (days / 30)) - 1 : dailyGrowthRate * 30;
                    yearlyGrowthRate = days >= 365 ? Math.pow(endNetWorth / beginNetWorth, 1 / (days / 365)) - 1 : monthlyGrowthRate * 12;

                    // Make sure percentage is correctly signed
                    if (beginNetWorth < endNetWorth) {
                        monthlyGrowthRate = Math.abs(monthlyGrowthRate);
                        yearlyGrowthRate = Math.abs(yearlyGrowthRate);
                    } else if (beginNetWorth > endNetWorth) {
                        monthlyGrowthRate = -(Math.abs(monthlyGrowthRate));
                        yearlyGrowthRate = -(Math.abs(yearlyGrowthRate));
                    }
                }

                select('.js-monthly-growth-rate').textContent = isNaN(monthlyGrowthRate) ? 'N/A' : formatNumber(monthlyGrowthRate.toString(), 'percent');
                select('.js-yearly-growth-rate').textContent = isNaN(yearlyGrowthRate) ? 'N/A' : formatNumber(yearlyGrowthRate.toString(), 'percent');
            }
        }
    };

    const initializeData = function () {
        const request = window.indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = event => {
            _db = event.target.result;

            const store = _db.createObjectStore(TABLE_NAME, {keyPath: 'date'});
            store.createIndex('date', 'date', {unique: true});
            store.createIndex('assets', 'assets', {unique: false});
            store.createIndex('debts', 'debts', {unique: false});
        };
        request.onsuccess = () => {
            _db = request.result;
            loadData();
        };
        request.onerror = e => {
            console.dir(e);
            alert('Error loading database.');
        };
    };

    const showAddForm = function () {
        _editDate = null;

        const local = new Date();
        local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
        select('.js-modal-title').textContent = '';
        select('.js-date').value = local.toJSON().slice(0, 10);
        select('.js-assets').value = '';
        select('.js-debts').value = '';
        select('.js-notes').value = '';
    };

    const showEditForm = function (date) {
        _editDate = date;

        const request = _db.transaction(TABLE_NAME, 'readonly').objectStore(TABLE_NAME).get(date);
        request.onsuccess = () => {
            select('.js-modal-title').textContent = 'Edit Entry';
            select('.js-date').value = request.result.date;
            select('.js-assets').value = request.result.assets;
            select('.js-debts').value = request.result.debts;
            select('.js-notes').value = request.result.notes;
        };
    };

    const saveDbEntry = async function (entry) {
        const transaction = _db.transaction(TABLE_NAME, 'readwrite');
        const store = transaction.objectStore(TABLE_NAME);

        await store.put(entry);
        await transaction.complete;
    };

    const deleteDbEntry = async function (date) {
        const transaction = _db.transaction(TABLE_NAME, 'readwrite');
        await transaction.objectStore(TABLE_NAME).delete(date);
        await transaction.complete;
    };

    const saveEntry = async function () {
        const date = select('.js-date').value;
        const assets = Math.abs(select('.js-assets').value || 0);
        const debts = Math.abs(select('.js-debts').value || 0);
        const notes = stripHtml(select('.js-notes').value);

        if (!isDate(date) || !isNumeric(assets) || !isNumeric(debts)) {
            alert('Invalid Entry');
            return;
        }

        if (_editDate && _editDate !== date) {
            await deleteDbEntry(_editDate);
        }

        await saveDbEntry({date, assets, debts, notes});
        loadData();
        bootstrap.Modal.getInstance(select('.js-add-form')).hide();
    };

    const deleteEntry = function (row) {
        const request = _db.transaction(TABLE_NAME, 'readonly').objectStore(TABLE_NAME).get(row.dataset.date);
        request.onsuccess = async () => {
            _undoData = request.result;

            await deleteDbEntry(row.dataset.date);
            loadData();
            select('.js-deleted-message').textContent = `Entry for ${formatDate(row.dataset.date)} has been deleted.`;
            bootstrap.Toast.getOrCreateInstance(select('.js-deleted')).show();
        };
    };

    const saveRows = async function (rows) {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const date = new Date(row[0]).toISOString().substring(0, 10);
            const assets = Math.abs(parseFloat(row[1].replace(/[$,]/gi, '')) || 0);
            const debts = Math.abs(parseFloat(row[2].replace(/[$,]/gi, '')) || 0);
            const notes = stripHtml(row[3]);

            if (!isDate(date) || !isNumeric(assets) || !isNumeric(debts)) {
                alert('Invalid Entry');
                return;
            }

            await saveDbEntry({date, assets, debts, notes});
        }
    };

    const importData = function (event) {
        const file = event.target.files[0];
        const fileName = file.name;
        const maxSize = 10000000;
        const size = file.size;
        const nameParts = fileName.split('.');
        const extension = nameParts[nameParts.length - 1];

        if (extension.toLowerCase() !== 'csv' || size === 0 || size > maxSize) {
            // TODO: Error handling for different scenarios
            return;
        }

        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = async function (file) {
            await saveRows(csvToArray(file.target.result));
            loadData();
        };
    };

    const exportData = function () {
        const request = _db.transaction(TABLE_NAME, 'readonly').objectStore(TABLE_NAME).getAll();
        request.onsuccess = () => {
            const rows = request.result.map(row => {
                return [`"${row.date}"`, `"${row.assets}"`, `"${row.debts}"`, `"${row.notes}"`];
            });
            const csv = 'data:text/csv;charset=utf-8,' + rows.map(row => row.join(',')).join('\n');

            // Create download link
            const link = document.createElement('a');
            link.setAttribute('href', encodeURI(csv));
            link.setAttribute('download', `NetWorthExport_${new Date().toISOString().substring(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
        };
    };

    const clearData = function () {
        const request = _db.transaction(TABLE_NAME, 'readonly').objectStore(TABLE_NAME).getAll();
        request.onsuccess = () => {
            _undoData = request.result;
            _db.close();
            window.indexedDB.deleteDatabase(DB_NAME).onsuccess = () => {
                initializeData();
                select('.js-deleted-message').textContent = 'All data has been cleared.';
                bootstrap.Toast.getOrCreateInstance(select('.js-deleted')).show();
            };
        };
    }

    const undoDelete = async function () {
        if (Array.isArray(_undoData)) {
            await saveRows(_undoData.map(row => {
                return [row.date, row.assets.toString(), row.debts.toString(), row.notes];
            }));
        } else {
            await saveDbEntry(_undoData);
        }

        loadData();
        bootstrap.Toast.getOrCreateInstance(select('.js-deleted')).hide();
    };

    initializeData();

    select('.js-add').addEventListener('click', showAddForm);
    select('.js-import-data').addEventListener('change', importData);
    select('.js-export-data').addEventListener('click', exportData);
    select('.js-clear-data').addEventListener('click', clearData);
    select('.js-add-form').addEventListener('shown.bs.modal', () => {
        select('.js-assets').focus();
    });
    select('.js-save').addEventListener('click', saveEntry);
    select('.js-undo').addEventListener('click', undoDelete);
    document.addEventListener('click', function (event) {
        const editLink = event.target.closest('.js-edit');
        if (editLink) {
            showEditForm(editLink.closest('tr').dataset.date);
            return;
        }

        const deleteLink = event.target.closest('.js-delete');
        if (deleteLink) {
            deleteEntry(deleteLink.closest('tr'));
        }
    })
})();