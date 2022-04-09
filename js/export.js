"use strict";

var exportFunc = execMain(function() {
	var exportDiv = $('<div />');
	var exportTable = $('<table class="expOauth expUpDown">');

	var inFile = $('<input type="file" id="file"/>');
	var inOtherFile = $('<input type="file" id="file"/>');
	var outFile = $('<a class="click"/>').html(EXPORT_TOFILE);

	var inServ = $('<a class="click"/>').html(EXPORT_FROMSERV + ' (csTimer)').click(downloadData);
	var outServ = $('<a class="click"/>').html(EXPORT_TOSERV + ' (csTimer)').click(uploadDataClk);

	var expString;

	exportTable.append(
		$('<tr>').append(
			$('<td>').append($('<a class="click"/>').html(EXPORT_FROMFILE).click(function() {
				inFile.click();
			})),
			$('<td>').append(outFile)),
		// $('<tr>').append(
		// 	$('<td>').append(inServ),
		// 	$('<td>').append(outServ)),
		$('<tr>').append(
			$('<td colspan=2>').append($('<a class="click"/>').html(EXPORT_FROMOTHER).click(function() {
				inOtherFile.click();
			}))
		)
	);

	function updateExpString() {
		return storage.exportAll().then(function(exportObj) {
			exportObj['properties'] = mathlib.str2obj(localStorage['properties']);
			expString = JSON.stringify(exportObj);
		});
	}

	function importData() {
		var dataobj = null;
		try {
			dataobj = JSON.parse(this.result);
		} catch (e) {
			logohint.push('Invalid Data');
			return;
		}
		loadData(dataobj);
	}

	function loadData(data) {
		var sessionDelta = 0;
		var solveAdd = 0;
		var solveRm = 0;
		storage.exportAll().then(function(exportObj) {
			for (var sessionIdx = 1; sessionIdx <= ~~kernel.getProp('sessionN'); sessionIdx++) {
				var times = mathlib.str2obj(exportObj['session' + sessionIdx] || []);
				var timesNew = mathlib.str2obj(data['session' + sessionIdx] || []);
				if (times.length != timesNew.length) {
					sessionDelta++;
					solveAdd += Math.max(timesNew.length - times.length, 0);
					solveRm += Math.max(times.length - timesNew.length, 0);
				}
			}
			if (confirm(IMPORT_FINAL_CONFIRM
					.replace("%d", sessionDelta)
					.replace("%a", solveAdd)
					.replace("%r", solveRm)
				)) {
				return Promise.resolve();
			} else {
				return Promise.reject();
			}
		}).then(function() {
			if ('properties' in data) {
				var devData = localStorage['devData'] || '{}';
				var locData = localStorage['locData'] || '{}';
				localStorage.clear();
				localStorage['devData'] = devData;
				localStorage['locData'] = locData;
				localStorage['properties'] = mathlib.obj2str(data['properties']);
				kernel.loadProp();
			}
			storage.importAll(data).then(function() {
				location.reload();
			});
		}, $.noop);
	}

	function importFile(reader) {
		if (this.files.length) {
			var f = this.files[0];
			reader.readAsBinaryString(f);
		}
	}

	function isValidId(id) {
		return id && /^[A-Za-z0-9]+$/.exec(id);
	}

	function getDataId(key1, key2) {
		try {
			return JSON.parse(localStorage[key1])[key2] || '';
		} catch (err) {
			return '';
		}
	}

	function getId(e) {
		var id = null;
		id = prompt(EXPORT_USERID, getDataId('locData', 'id'));
		if (id == null) {
			return;
		}
		localStorage['locData'] = JSON.stringify({ id: id, compid: getDataId('locData', 'compid') });
		kernel.pushSignal('export', ['account', 'locData']);
		if (!isValidId(id)) {
			alert(EXPORT_INVID);
			return;
		}
		return id;
	}

	function uploadDataClk(e) {
		var id = getId(e);
		if (!id) {
			return;
		}
		var target = $(e.target);
		var rawText = target.html();
		target.html('...');
		uploadData(id).then(function() {
			alert(EXPORT_UPLOADED);
		}, function() {
			alert(EXPORT_ERROR);
		}).then(function() {
			target.html(rawText);
		});
	}

	function downloadData(e) {
		var id = getId(e);
		if (!id) {
			return;
		}
		var target = $(e.target);
		var rawText = target.html();
		target.html('Check File List...');

		var onerr = function() {
			alert(EXPORT_ERROR);
		};

		var revert = function() {
			target.html(rawText);
		};

		var cntCallback = function(val) {
			var cnt = ~~val['data'];
			if (cnt == 0) {
				alert('No Data Found');
				return revert();
			}
			var idx = 1;
			if (kernel.getProp('expp')) {
				idx = ~~prompt('You have %d file(s), load (1 - lastest one, 2 - lastest but one, etc) ?'.replace('%d', cnt), '1');
				if (idx <= 0 || idx > cnt) {
					return revert();
				}
			}
			target.html('Import Data...');
			$.post('https://cstimer.net/userdata.php', {
				'id': id,
				'offset': idx - 1
			}, dataCallback, 'json').error(onerr).always(revert);
		};

		var dataCallback = function(val) {
			var retcode = val['retcode'];
			if (retcode == 0) {
				try {
					loadData(JSON.parse(LZString.decompressFromEncodedURIComponent(val['data'])));
				} catch (err) {
					alert(EXPORT_ERROR);
				}
			} else if (retcode == 404) {
				alert(EXPORT_NODATA);
			} else {
				alert(EXPORT_ERROR);
			}
			revert();
		};

		if (kernel.getProp('expp')) {
			$.post('https://cstimer.net/userdata.php', {
				'id': id,
				'cnt': 1
			}, cntCallback, 'json').error(onerr).always(revert);
		} else {
			cntCallback({'data':1});
		}
	}

	function showExportDiv() {
		updateExpString().then(function() {
			if (window.Blob) {
				var blob = new Blob([expString], {
					'type': 'text/plain'
				});
				outFile.attr('href', URL.createObjectURL(blob));
				outFile.attr('download', 'cstimer_' + mathlib.time2str(new Date() / 1000, '%Y%M%D_%h%m%s') + '.txt');
			}
			kernel.showDialog([exportDiv, 0, undefined, 0, [EXPORT_ONLYOPT, exportProperties], [EXPORT_ACCOUNT, exportAccounts]], 'export', EXPORT_DATAEXPORT);
		});
	}

	function exportByPrompt(expOpt) {
		var compOpt = LZString.compressToEncodedURIComponent(JSON.stringify(expOpt));
		var ret = prompt(EXPORT_CODEPROMPT, compOpt);
		if (!ret || ret == compOpt) {
			return;
		}
		try {
			ret = JSON.parse(LZString.decompressFromEncodedURIComponent(ret));
		} catch (e) {
			return;
		}
		return ret;
	}

	function exportProperties() {
		var data = JSON.parse(localStorage['properties']);
		var expOpt = {};
		for (var key in data) {
			if (!key.startsWith('session')) {
				expOpt[key] = data[key];
			}
		}
		var newOpt = exportByPrompt(expOpt);
		if (!newOpt) {
			return false;
		}
		data = JSON.parse(localStorage['properties']);
		for (var key in data) {
			if (key.startsWith('session')) {
				newOpt[key] = data[key];
			}
		}
		localStorage['properties'] = mathlib.obj2str(newOpt);
		location.reload();
		return false;
	}

	function exportAccounts() {
		var expOpt = {
			'locData': localStorage['locData']
		};
		var newOpt = exportByPrompt(expOpt);
		if (!newOpt) {
			return false;
		}
		for (var key in expOpt) {
			if (newOpt[key]) {
				localStorage[key] = newOpt[key];
				kernel.pushSignal('export', ['account', key]);
			}
		}
		location.reload();
		return false;
	}

	function procSignal(signal, value) {
		if (signal == 'atexpa') {
			if (value[1] == 'id') {
				var id = getDataId('locData', 'id');
				if (!isValidId(id) || value[2] == 'modify') {
					id = prompt(EXPORT_USERID, id);
					if (!isValidId(id)) {
						if (id != null) {
							alert(EXPORT_INVID);
						}
						kernel.setProp('atexpa', 'n');
						return;
					}
					localStorage['locData'] = JSON.stringify({ id: id, compid: getDataId('locData', 'compid') });
					kernel.pushSignal('export', ['account', 'locData']);
				}
			}
		}
	}

	var exportTid;

	function startBackExport() {
		if (exportTid) {
			clearTimeout(exportTid);
		}
		exportTid = setTimeout(doBackExport, 1000);
	}

	function doBackExport() {
		var atexpa = kernel.getProp('atexpa', 'n');
		if (atexpa == 'n') {
			return;
		}
		updateExpString().then(function() {
			if (atexpa == 'id') {
				var id = getDataId('locData', 'id');
				if (!isValidId(id)) {
					logohint.push('Auto Export Abort');
					kernel.setProp('atexpa', 'n');
					return;
				}
				uploadData(id).then(function() {
					logohint.push('Auto Export Success');
				}, function() {
					logohint.push('Auto Export Failed');
				});
			} else if (atexpa == 'f') {
				if (window.Blob) {
					var blob = new Blob([expString], {
						'type': 'text/plain'
					});
					var tmpFile = $('<a class="click"/>');
					tmpFile.attr('href', URL.createObjectURL(blob));
					tmpFile.attr('download', 'cstimer_' + mathlib.time2str(new Date() / 1000, '%Y%M%D_%h%m%s') + '.txt');
					tmpFile.appendTo('body');
					tmpFile[0].click();
					tmpFile.remove();
				}
			}
		});
		exportTid = 0;
		solvesAfterExport = 0;
	}

	var solvesAfterExport = 0;

	function newTimePushed() {
		if (kernel.getProp('atexpa', 'n') == 'n') {
			return;
		}
		solvesAfterExport += 1;
		if (solvesAfterExport >= kernel.getProp('atexpi', 100)) {
			startBackExport();
		}
	}

	$(function() {
		kernel.regListener('export', 'time', newTimePushed);
		kernel.regListener('export', 'property', procSignal, /^atexpa$/);
		kernel.regListener('export', 'export', procSignal, /^account$/);
		kernel.regProp('kernel', 'atexpa', 1, PROPERTY_AUTOEXP, ['n', ['n', 'f', 'id'], PROPERTY_AUTOEXP_OPT.split('|')]);
		kernel.regProp('kernel', 'atexpi', ~1, 'Auto Export Interval (Solves)', [100, [50, 100, 200, 500], ['50', '100', '200', '500']]);
		kernel.regProp('kernel', 'expp', 0, PROPERTY_IMPPREV, [false]);

		kernel.addButton('export', BUTTON_EXPORT, showExportDiv, 2);
		exportDiv.append('<br>',
			exportTable);
		if (window.FileReader && window.Blob) {
			var reader = new FileReader();
			reader.onload = importData;
			var readerOther = new FileReader();
			readerOther.onload = function() {
				var n_import = stats.importSessions(TimerDataConverter(this.result));
				if (n_import == 0) {
					logohint.push('No session imported');
				}
			};
			inFile.change(importFile.bind(inFile[0], reader));
			inOtherFile.change(importFile.bind(inOtherFile[0], readerOther));
		}
	});

	return {
		exportProperties: exportProperties,
		isValidId: isValidId,
		getDataId: getDataId
	};
});
