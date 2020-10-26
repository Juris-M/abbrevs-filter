// START Borrowed from Zotero
// Components.utils.import('resource://zotero/require.js');
// Not using Cu.import here since we don't want the require module to be cached
// for includes within ZoteroPane or other code where we want the window instance available to modules.
Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
	.getService(Components.interfaces.mozIJSSubScriptLoader)
	.loadSubScript('resource://abbrevs-filter/require.js');
// END Borrowed from Zotero

const FilePicker = require('modules/filePicker');

// Export an abbreviation list
AbbrevsFilter.prototype.exportList = function (window, document) {
	var me = this;
	Zotero.Promise.spawn(function* () {		
		var styleID = me.styleID;
		var shortname = styleID;
		var m = styleID.match(/.*\/(.*)/);
		if (m) {
			shortname = m[1];
		}
		fp = new FilePicker();
		fp.init(window, "Set the file for export", fp.modeSave);
		fp.appendFilter("JSON data", "*.json");
		fp.defaultExtension = ".json";
		fp.defaultString = shortname + ".json"
		var rv = yield fp.show();
		if (rv == fp.returnOK || rv == fp.returnReplace) {
			var json_obj = {};
			var sql = "SELECT jurisdiction,category,Raw.string AS raw,Abbr.string AS abbr FROM abbreviations "
				+ "NATURAL JOIN list "
				+ "NATURAL JOIN jurisdiction "
				+ "NATURAL JOIN category "
				+ "LEFT JOIN strings Raw ON abbreviations.rawID=Raw.stringID "
				+ "LEFT JOIN strings Abbr ON abbreviations.abbrID=Abbr.stringID "
				+ "WHERE list=?";

			// Why select by category? Why not just grab everything, and
			// assign what drifts through the category filter to JSON?

			var rows = yield me.db.queryAsync(sql, [styleID]);
			for (var i = 0, ilen = rows.length; i < ilen; i += 1) {
				var row = rows[i];
				if (["title", "title-phrase", "container-phrase", "nickname", "hereinafter"].indexOf(row.category) > -1) {
					continue;
				}
				if (!json_obj[row.jurisdiction]) {
					json_obj[row.jurisdiction] = {};
				}
				if (!json_obj[row.jurisdiction][row.category]) {
					json_obj[row.jurisdiction][row.category] = {};
				}
				json_obj[row.jurisdiction][row.category][row.raw] = row.abbr;
			}

			json_str = JSON.stringify(json_obj, null, 2);
			
			Components.utils.import("resource://gre/modules/FileUtils.jsm");
			var myfp = new FileUtils.File(fp.file);
			myfp.initWithPath(fp.file);
			
			var ostream = FileUtils.openSafeFileOutputStream(myfp);
			var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
				.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			converter.charset = "UTF-8";
			var chunk = converter.ConvertFromUnicode(json_str);
			ostream.write(chunk, chunk.length);
		}
	});
};
