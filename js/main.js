window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

$(function () {
	var _db = null,
		_dbName = 'netWorthDb',
		_entriesTable = 'entries',
		_editEntryId = null;

	var addEntry = function() {
		var local = new Date();
		local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
		$('.modal-title').html('Add');
		$('#date').val(local.toJSON().slice(0, 10));
		$('#assets, #debts').val('');

		$('#add-form').modal('show');
	};

	var editEntry = function() {
		_editEntryId = $(this).closest('tr').data('id');

		var entries = _db.transaction(_entriesTable, 'readonly').objectStore(_entriesTable);
		var request = entries.get(_editEntryId);
		request.onsuccess = function () {
			$('.modal-title').html('Edit');
			$('#date').val(request.result.date);
			$('#assets').val(request.result.assets);
			$('#debts').val(request.result.debts);

			$('#add-form').modal('show');
	   };
	};

	var saveEntry = function () {
		var date = $('#date').val();
		var assets = $('#assets').val();
		var debts = $('#debts').val();

		if (!isDate(date) || !isNumeric(assets) || !isNumeric(debts)) {
			alert('Invalid Entry');
			return;
		}

		var entry = {
			date: date,
			assets: assets,
			debts: debts
		};

		if (_editEntryId) {
			entry.id = _editEntryId;
		}

		var entries = _db.transaction(_entriesTable, 'readwrite').objectStore(_entriesTable);
		var request = entries.put(entry);
		request.onsuccess = function (event) {
			getData();
			$('#add-form').modal('hide');
		};
	};

	var deleteEntry = function () {
		var row = $(this).closest('tr')
		var id = row.data('id');
		var entries = _db.transaction(_entriesTable, 'readwrite').objectStore(_entriesTable);
		var request = entries.delete(id);
		request.onsuccess = function () {
			row.fadeOut(250, function () {
				row.remove();
			});
		};
	};

	var addRow = function (id, date, assets, debts) {
		var html = [],
			netWorth = assets - debts;
		html.push('<tr data-id="' + id + '"><td>');
		html.push(formatDate(new Date(date)));
		html.push('</td><td class="text-right text-success">');
		html.push('$' + Number(assets).toFixed(2));
		html.push('</td><td class="text-right text-danger">');
		html.push('$' + Number(debts).toFixed(2));
		html.push('</td><td class="text-right');
		if (netWorth > 0) {
			html.push(' text-success');
		}
		else if (netWorth < 0) {
			html.push(' text-danger');
		}
		html.push('">');
		html.push('$' + (assets - debts).toFixed(2));
		html.push('</td><td class="text-left">');
		html.push('<a class="edit-entry" href="javascript:void(0);"><span class="glyphicon glyphicon-edit"></span></a>');
		html.push('</td><td class="text-left">');
		html.push('<a class="delete-entry" href="javascript:void(0);"><span class="glyphicon glyphicon-remove"></span></a>');
		html.push('</td></tr>');

		$('#net-worth > tbody').append(html.join(''));
	};

	var displayData = function () {
		$('#net-worth > tbody').empty();

		var totalAssets = [];
		var totalDebts = [];

		// Open object store, get a cursor list of all the entries, and iterate
		var entries = _db.transaction(_entriesTable).objectStore(_entriesTable);
		entries.openCursor().onsuccess = function (event) {
			var cursor = event.target.result;
			if (cursor) {
				addRow(cursor.value.id, new Date(cursor.value.date), cursor.value.assets, cursor.value.debts);
				totalAssets.push(cursor.value.assets);
				totalDebts.push(cursor.value.debts);
				// continue on to the next item in the cursor
				cursor.continue();
			}
			var total = 0;
			for (var i in totalAssets) {
				total += parseInt(totalAssets[i]);
			};

			$('#charts').highcharts({
		        chart: {
		            plotBackgroundColor: null,
		            plotBorderWidth: null,
		            plotShadow: false
		        },
		        title: {
		            text: ''
		        },
		        tooltip: {
		    	    pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
		        },
		        plotOptions: {
		            pie: {
		                allowPointSelect: true,
		                cursor: 'pointer',
		                dataLabels: {
		                    enabled: true,
		                    color: '#000000',
		                    connectorColor: '#000000',
		                    format: '<b>{point.name}</b>: {point.percentage:.1f} %'
		                }
		            }
		        },
		        series: [{
		            type: 'pie',
		            name: 'Net Worth',
		            data: [
		                ['Assets',   total],
		                ['Debts',    totalDebts],
		            ]
		        }]
		    })	
		}
	};

	var getData = function() {	
		var request = window.indexedDB.open(_dbName, 1);
		request.onupgradeneeded = function (event) {
			_db = event.target.result;

			// Create an objectStore for this database
			var entries = _db.createObjectStore(_entriesTable, { keyPath: 'id', autoIncrement: true });
			entries.createIndex('date', 'date', { unique: false });
			entries.createIndex('assets', 'assets', { unique: false });
			entries.createIndex('debts', 'debts', { unique: false });
		};
		request.onsuccess = function (event) {
			_db = request.result;
			displayData();
		};
		request.onerror = function (e) {
			console.dir(e);
			alert('Error loading database.');
		};
	};

	var isDate = function (d) {
		return !isNaN(Date.parse(d));
	};

	var isNumeric = function (n) {
		return !isNaN(parseFloat(n)) && isFinite(n);
	};

	var formatDate = function (date) {
		return (date.getMonth() + 1) + '/' + (date.getDate() + 1) + '/' + date.getFullYear();
	};

	/*
	// Delete the local database - use for debugging
	window.indexedDB.deleteDatabase(_dbName).onsuccess = function () {
		console.log('deleted database successfully');
	};
	*/

	getData();

	$('#add-button').click(addEntry);
	$('#add-form').on('shown.bs.modal', function (e) {
		$('#assets').focus();
	});
	$('#save-button').click(saveEntry);

	$(document).on('click', '.edit-entry', editEntry);
	$(document).on('click', '.delete-entry', deleteEntry);

	
});
/*
// HighCharts
$(function () {
	getData();

	var entries = _db.transaction(_entriesTable, 'read').objectStore(_entriesTable);
	var assets = entries.data('assets');
	var debts = entries.data('debts');

	alert('assets:' + assets);
	alert('debts:' + debts);
	
	var totalAssets = 0;
	var totalDebts = 0;
		


    $('#container').highcharts({
        chart: {
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false
        },
        title: {
            text: 'Browser market shares at a specific website, 2010'
        },
        tooltip: {
    	    pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: {
                    enabled: true,
                    color: '#000000',
                    connectorColor: '#000000',
                    format: '<b>{point.name}</b>: {point.percentage:.1f} %'
                }
            }
        },
        series: [{
            type: 'pie',
            name: 'Browser share',
            data: [
                ['Firefox',   45.0],
                ['IE',       26.8],
                {
                    name: 'Chrome',
                    y: 12.8,
                    sliced: true,
                    selected: true
                },
                ['Safari',    8.5],
                ['Opera',     6.2],
                ['Others',   0.7]
            ]
        }]
    });
});*/