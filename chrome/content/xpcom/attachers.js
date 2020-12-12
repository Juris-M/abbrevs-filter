// Getting abbreviations happens in two steps.
//
// A database call setCacheEntry(), to be issued in async iterator context,
//   pulls all key/value pairs that might be needed for a given
//   citation into a memory cache before the citation processor
//   is called.
//
// A synchronus getAbbreviation() function looks up specific
//   key/value pairs in the cache.

Components.utils.import("resource://gre/modules/osfile.jsm")

AbbrevsFilter.prototype.attachGetCachedAbbrevList = function () {
    var CSL = Zotero.CiteProc.CSL;
	CSL.getCachedAbbrevList = function(cslEngine) {
		cslEngine.transform.abbrevs = this.cachedAbbreviations;
	}.bind(this);
}

AbbrevsFilter.prototype.attachSetCachedAbbrevList = function () {
    var CSL = Zotero.CiteProc.CSL;
	CSL.setCachedAbbrevList = this.setCachedAbbrevList.bind(this);
}

AbbrevsFilter.prototype.attachPreloadAbbreviations = function () {
    var CSL = Zotero.CiteProc.CSL;
	CSL.preloadAbbreviations = this.preloadAbbreviations.bind(this);
}

AbbrevsFilter.prototype.attachGetAbbreviation = function () {
    var CSL = Zotero.CiteProc.CSL;
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

AbbrevsFilter.prototype.JurisdictionMapper = new function() {
	// Check for existence of abbrevsInstalled table, create if not
	// present
	var _initialized = false;

	this.init = Zotero.Promise.coroutine(function* (me) {	

		if (_initialized) return;
		
		var sql = "CREATE TABLE IF NOT EXISTS abbrevsInstalled ("
			+ "styleID TEXT,"
			+ "importListName TEXT,"
			+ "version INT,"
			+ "PRIMARY KEY (styleID, importListName)"
			+ ")"
		yield me.db.queryAsync(sql);
		me.abbrevsInstalled = {};
		me.jurisdictionInstallMap = {};
		
		var jurisAbbrevsDir = Zotero.getJurisAbbrevsDirectory().path;
		var jurisAbbrevsDirectoryFile = OS.Path.join(jurisAbbrevsDir, 'DIRECTORY_LISTING.json');
		var versions = yield Zotero.File.getContentsAsync(jurisAbbrevsDirectoryFile);
		var resLst = JSON.parse(versions);
		
		// var resLst = JSON.parse(Zotero.File.getContentsFromURL('resource://abbrevs-filter/abbrevs/DIRECTORY_LISTING.json'));
		
		for (var i=0,ilen=resLst.length; i< ilen; i++) {
			var info = resLst[i];
			if (info.jurisdiction) {
				var jurisdiction = info.jurisdiction;
				if (!me.jurisdictionInstallMap[jurisdiction]) {
					me.jurisdictionInstallMap[jurisdiction] = {};
				}
				me.jurisdictionInstallMap[jurisdiction][info.filename] = info.version;
				for (var variant in info.variants) {
					me.jurisdictionInstallMap[jurisdiction][info.filename.replace(/(.*)(\.json)/, "$1-" + variant + "$2")] = info.variants[variant];
				}
			}
		}
		_initialized = true;
	});
};

AbbrevsFilter.prototype.installAbbrevsForJurisdiction = Zotero.Promise.coroutine(function* (styleID, country) {
	// Okay!
	// This function can be hit repeatedly. We're encountering problems because its state is unstable.
	var ret = [];
	if (!country) {
		return ret;
	}
	// This should really only be called once per citation cluster, at most.
	yield this.JurisdictionMapper.init(this);
	
	// Attempt to recover from invalid key of the form Germany|DE or DE|Wurtzburg
	if (country.indexOf("|") > -1) {
		var lst = country.split(/\s*|\s*/);
		var front = lst[0].toLowerCase();
		var back = lst.slice(-1)[0].toLowerCase();
		if (this.jurisdictionInstallMap[front]) {
			country = front;
		} else if (this.jurisdictionInstallMap[back]) {
			country = back;
		}
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
			var mycountry = row.importListName.replace(/^auto-/, "").replace(/\-.*$/, "").replace(/\.json/, "");
			if (!this.abbrevsInstalled[styleID][mycountry]) {
				this.abbrevsInstalled[styleID][mycountry] = {};
			}
			this.abbrevsInstalled[styleID][mycountry][row.importListName] = row.version;
		}
	}
	// ✓ Check if country defs are available
	// ✓ If they are, check for each list+pref against abbrevsInstalled
	// ✓ Check if a list+pref exists, check its version
	// ✓ If it doesn't exist or the versions don't match, overwrite
	var ret = [];
	if (this.jurisdictionInstallMap[country]) {
		var installmap = this.jurisdictionInstallMap[country];
		for (var installkey in installmap) {
			var installver = installmap[installkey];
			if (!this.abbrevsInstalled[styleID][country]) {
				this.abbrevsInstalled[styleID][country] = {};
			}

			// Here is where the version check and update of individual
			// countrys happens.
			
			if (!this.abbrevsInstalled[styleID][country][installkey] || installver != this.abbrevsInstalled[styleID][country][installkey]) {
				yield this.importList(null, null, {
					fileForImport: false,
					resourceListMenuValue: installkey,
					mode: 1,
					styleID: styleID
				});
				var sql = "INSERT OR REPLACE INTO abbrevsInstalled (styleID, importListName, version) VALUES (?, ?, ?)";
				yield this.db.queryAsync(sql, [styleID, installkey, installver]);
				this.abbrevsInstalled[styleID][country][installkey] = installver;
			}
		}
		var ret = Object.keys(this.jurisdictionInstallMap[country]);
		ret = ret.map(key => key.replace(/^auto-[^\-]+(?:-([^.]+))*\.json/, "$1"));
		ret = ret.filter(o => o ? o : !!o);
	}
	return ret;
});
