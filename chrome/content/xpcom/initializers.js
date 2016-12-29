AbbrevsFilter.prototype.initComponent = Zotero.Promise.coroutine(function* (Zotero) {
    this.Zotero = Zotero;
	this.CSL = Zotero.CiteProc.CSL;
	this.sys = new Zotero.Cite.System;
    this.db = new this.Zotero.DBConnection("abbrevs-filter");
	yield this.initDB();
    this.attachPreloadAbbreviations();
    this.attachGetAbbreviation();
    this.attachSetSuppressJurisdictions();
    this.attachGetSuppressJurisdictions();
});

AbbrevsFilter.prototype.initPage = function () {
    this.resetCache();
}

AbbrevsFilter.prototype.initWindow = function (window, document) {
    if (!window.arguments) return;
    try {
	    var io = window.arguments[0].wrappedJSObject;
        this.io = io;
        var listname = io.style.opt.styleID;
	    this.categories = [];
	    for (var key in io.style.transform.abbrevs) {
		    this.categories.push(key);
	    }
	    this.categories.sort();
	    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService);
	    prefs = prefs.getBranch("extensions.abbrevs-filter.");
	    var category = prefs.getCharPref("currentCategory");
	    var transform = io.style.transform;
	    this.transform = transform;
	    // Strings and things.
	    stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
		    .getService(Components.interfaces.nsIStringBundleService)
		    .createBundle("chrome://abbrevs-filter/locale/overlay.properties")
	    if (!category) {
		    category = "container-title";
	    }
    } catch (e) {
        this.Zotero.debug("AFZ: [ERROR] failure while attempting to add UI to Zotero integration: "+e);
    }
}

AbbrevsFilter.prototype.initDB = Zotero.Promise.coroutine(function* () {
    var sql = Zotero.File.getContentsFromURL("resource://abbrevs-filter/schema/abbrevs-filter.sql");
    var version = parseInt(sql.match(/^-- ([0-9]+)/)[1]);
    if (!this.db.tableExists("abbreviations")) {
        Zotero.debug("AFZ: [SETUP] no abbreviations table table found, performing scratch install)");
        this.db.beginTransaction();
	    yield this.db.query(sql);
        yield this.setDBVersion('abbreviations', version);
        this.db.commitTransaction();
	} else {
        var dbVersion = yield this.getDBVersion('abbreviations');
        if (version > dbVersion) {
            Zotero.debug("AFZ: [SETUP] upgrading database schema to version " + version);
            try {
		        // make backup of database first
		        yield this.db.backupDatabase(dbVersion, true);
                
                this.db.beginTransaction();
                for (var i=dbVersion,ilen=version+1;i<ilen;i+=1) {
                    // Next version
                    // if (i === 15) {
                    //   Do stuff
                    //}
                }
                yield this.setDBVersion('abbreviations', version);
                this.db.commitTransaction();
		        
            } catch (e) {
                Zotero.debug("AFZ: [ERROR] failure during setup: "+e);
                this.db.rollbackTransaction();
                throw("AFZ: [ERROR] failure during setup: " + e);
            }
        }
    }
});
