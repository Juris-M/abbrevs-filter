// Getting abbreviations happens in two steps.
//
// A database call setCacheEntry(), to be issued in async iterator context,
//   pulls all key/value pairs that might be needed for a given
//   citation into a memory cache before the citation processor
//   is called.
//
// A synchronus getAbbreviation() function looks up specific
//   key/value pairs in the cache.

AbbrevsFilter.prototype.attachGetCachedAbbrevList = function () {
	CSL.getCachedAbbrevList = function(cslEngine) {
		cslEngine.transform.abbrevs = this.cachedAbbreviations;
	}.bind(this);
}

AbbrevsFilter.prototype.attachSetCachedAbbrevList = function () {
	CSL.setCachedAbbrevList = this.setCachedAbbrevList.bind(this);
}

AbbrevsFilter.prototype.attachPreloadAbbreviations = function () {
	CSL.preloadAbbreviations = this.preloadAbbreviations.bind(this);
}

AbbrevsFilter.prototype.attachGetAbbreviation = function () {
	CSL.getAbbreviation = this.getAbbreviation.bind(this);
}

AbbrevsFilter.prototype.attachSetSuppressJurisdictions = function() {
	
	// XXXXX OK for now, but this does not need to be an attacher.
	// XXXXX Juris-M can invoke it directly out of the Abbrevs Filter
	// XXXXX on the processor instance. Processor will then use the
	// XXXXX data that has been set, synchronously.
	
    var AbbrevsFilter = this;
    var Zotero = this.Zotero;
    var CSL = Zotero.CiteProc.CSL;
    
    CSL.setSuppressedJurisdictions = Zotero.Promise.coroutine(function* (styleID, suppressedJurisdictions) {
        var sql = "SELECT jurisdiction FROM suppressme "
            + "JOIN jurisdiction USING(jurisdictionID) "
            + "JOIN list USING(listID) "
            + "WHERE list=?;";
        var jurisdictionList = yield AbbrevsFilter.db.columnQueryAsync(sql,[styleID]);
        var results;
        if (jurisdictionList && jurisdictionList.length) {
            jurisdictionList = "'" + jurisdictionList.join("','") + "'";
		    var sql = 'SELECT jurisdictionName as val,jurisdictionID as comment FROM jurisdictions '
			    + 'WHERE jurisdictionID IN (' + jurisdictionList + ') ORDER BY jurisdictionName;'
            results = yield Zotero.DB.queryAsync(sql);
        } else {
            results = [];
        }
        for (var i=0,ilen=results.length;i<ilen;i+=1) {
            var result = results[i];
            suppressedJurisdictions[result.comment] = result.val;
        }
    });
}



AbbrevsFilter.prototype.setInstallAbbrevsForJurisdiction = Zotero.Promise.coroutine(function* () {
	// Check for existence of abbrevsInstalled table, create if not
	// present
	var sql = "CREATE TABLE IF NOT EXISTS abbrevsInstalled ("
		+ "styleName TEXT PRIMARY KEY,"
		+ "version INT"
	+ ")"
	yield AbbrevsFilter.db.queryAsync(sql, ["abbrevsInstalled"]);
	// Iterate over the abbrevsInstalled table, and memo installed lists
	// and their versions in a memory object
	var abbrevsInstalled = {};
	var sql = "SELECT styleName,version FROM abbrevsInstalled";
	var rows = yield AbbrevsFilter.db.queryAsync(sql);
	for (var i=0,ilen=rows.length; i<ilen; i++) {
		var row = rows[i];
		abbrevsInstalled[row[0]] = row[1];
	}
	var jurisdictionInstallMap = {};
	var resLst = JSON.parse(Zotero.File.getContentsFromURL('resource://abbrevs-filter/abbrevs/DIRECTORY_LISTING.json'));
	for (var i=0,ilen=resLst.length; i< ilen; i++) {
		var info = resLst[i];
		if (info.jurisdictions) {
			for (var j=0,jlen=info.jurisdictions.length; j<jlen; j++) {
				var jurisdiction = info.jurisdictions[j];
				if (!jurisdictionInstallMap[jurisdiction]) {
					jurisdictionInstallMap[jurisdiction] = [];
				}
				jurisdictionInstallMap[jurisdiction].push({
					filename: info.filename,
					version: info.version
				});
			}
		}
	}
	this.installAbbrevsForJurisdiction = Zotero.Promise.coroutine(function* (styleID, jurisdiction) {
		if (!jurisdiction) {
			return;
		}
		// If the jurisdiction has a key in jurisdictionInstall map, then
		// for each list associated with the jurisdiction:
		// * Check its version against any record in the memory object;
		if (jurisdictionInstallMap[jurisdiction]) {
			var reqLists = jurisdictionInstallMap[jurisdiction]
			for (var i=0,ilen=reqLists.length; i<ilen; i++) {
				var reqInfo = reqLists[i];
				if (!abbrevsInstalled[reqInfo.filename] || reqInfo.version != abbrevsInstalled[reqInfo.filename]) {
					// * If there is no match, install the list aggressively; and
					// * Memo the installed version in the memory object and the table.
					yield this.importList(null, {
						fileForImport: false,
						resourceListMenuValue: reqInfo.filename,
						mode: 1,
						styleID: styleID
					});
					abbrevsInstalled[reqInfo.filename] = reqInfo.version;
				}
			}
		}
	}
});
