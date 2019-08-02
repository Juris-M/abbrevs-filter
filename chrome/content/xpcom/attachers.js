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

AbbrevsFilter.prototype.setJurisdictionInstallMap = Zotero.Promise.coroutine(function* () {
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
		if (info.jurisdiction) {
			var jurisdiction = info.jurisdiction;
			if (!this.jurisdictionInstallMap[jurisdiction]) {
				this.jurisdictionInstallMap[jurisdiction] = {};
			}
			this.jurisdictionInstallMap[jurisdiction][info.filename] = info.version;
			for (var variant in info.variants) {
				this.jurisdictionInstallMap[jurisdiction][info.filename.replace(/(.*)(\.json)/, "$1-" + variant + "$2")] = info.variants[variant];
			}
		}
	}
});

AbbrevsFilter.prototype.installAbbrevsForJurisdiction = Zotero.Promise.coroutine(function* (styleID, jurisdiction, preferences) {
	// Okay!
	// This function can be hit repeatedly. We're encountering problems because its state is unstable.
	if (!jurisdiction) {
		return;
	}
	if (!preferences) {
		preferences = [];
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
			var country = row.importListName.slice(5);
			country = country.slice(0, country.indexOf("-"));
			this.abbrevsInstalled[styleID][country] = {};
			this.abbrevsInstalled[styleID][country][row.importListName] = row.version;
		}
	}
	// ✓ Check if jurisdiction defs are available
	// If they are, check for each list+pref in abbrevsInstalled
	// If a list+pref exists, check its version
	// If the versions don't match, overwrite
	if (this.jurisdictionInstallMap[jurisdiction]) {
		var installmap = this.jurisdictionInstallMap[jurisdiction];
		for (var installkey in installmap) {
			var installver = installmap[installkey];
			if (!this.abbrevsInstalled[styleID][jurisdiction][installkey] || installver != this.abbrevsInstalled[styleID][jurisdiction][installkey]) {
				yield this.importList(null, null, {
					fileForImport: false,
					resourceListMenuValue: installkey,
					mode: 1,
					styleID: styleID
				});
				var sql = "INSERT OR REPLACE INTO abbrevsInstalled (styleID, importListName, version) VALUES (?, ?, ?)";
				yield this.db.queryAsync(sql, [styleID, installkey, installver]);
				this.abbrevsInstalled[styleID][jurisdiction][installkey] = installver;
			}
		}
	}
});
