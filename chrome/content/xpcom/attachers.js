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
		+ "styleID TEXT,"
		+ "importListName TEXT,"
		+ "version INT,"
		+ "PRIMARY KEY (styleID, importListName)"
	+ ")"
	yield this.db.queryAsync(sql);
	this.abbrevsInstalled = {};

	this.jurisdictionInstallMap = {};
	var resLst = JSON.parse(Zotero.File.getContentsFromURL('resource://abbrevs-filter/abbrevs/DIRECTORY_LISTING.json'));
	for (var i=0,ilen=resLst.length; i< ilen; i++) {
		var info = resLst[i];
		if (info.jurisdictions) {
			for (var j=0,jlen=info.jurisdictions.length; j<jlen; j++) {
				var jurisdiction = info.jurisdictions[j];
				if (!this.jurisdictionInstallMap[jurisdiction]) {
					this.jurisdictionInstallMap[jurisdiction] = [];
				}
				this.jurisdictionInstallMap[jurisdiction].push({
					filename: info.filename,
					version: info.version
				});
			}
		}
	}
});

AbbrevsFilter.prototype.installAbbrevsForJurisdiction = Zotero.Promise.coroutine(function* (styleID, jurisdiction, preferences) {
	if (!jurisdiction) {
		return;
	}
	this.listname = styleID;
	if (!this.abbrevsInstalled[styleID]) {
		// It's an object, not an array. Besides, if we don't know the style, we should just initialize.
		//for (var key in this.abbrevsInstalled) {
		//	this.abbrevsInstalled.pop();
		//}
		this.abbrevsInstalled[styleID] = {};
		// Iterate over the abbrevsInstalled table, and memo installed lists
		// and their versions in a memory object
		var sql = "SELECT importListName,version FROM abbrevsInstalled WHERE styleID=?";
		var rows = yield this.db.queryAsync(sql, [styleID]);
		for (var i=0,ilen=rows.length; i<ilen; i++) {
			var row = rows[i];
			this.abbrevsInstalled[styleID][row.importListName] = row.version;
		}
	}
	// If the jurisdiction has a key in jurisdictionInstall map, then
	// for each list associated with the jurisdiction:
	// * Check its version against any record in the memory object;
	if (this.jurisdictionInstallMap[jurisdiction] && !this.abbrevsInstalled[styleID][jurisdiction]) {
		var reqLists = this.jurisdictionInstallMap[jurisdiction]
		for (var i=0,ilen=reqLists.length; i<ilen; i++) {
			var reqInfo = reqLists[i];
			if (!this.abbrevsInstalled[styleID][reqInfo.filename] || reqInfo.version != this.abbrevsInstalled[styleID][reqInfo.filename]) {
				// * If there is no match, install the list aggressively; and
				// * Memo the installed version in the memory object and the table.
				yield this.importList(null, null, {
					fileForImport: false,
					resourceListMenuValue: reqInfo.filename,
					mode: 1,
					styleID: styleID
				});
				var sql = "INSERT OR REPLACE INTO abbrevsInstalled (styleID, importListName, version) VALUES (?, ?, ?)";
				yield this.db.queryAsync(sql, [styleID, reqInfo.filename, reqInfo.version]);
				this.abbrevsInstalled[styleID][reqInfo.filename] = reqInfo.version;
			}
		}
		this.abbrevsInstalled[styleID][jurisdiction] = true;
	}
});
