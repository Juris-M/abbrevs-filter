AbbrevsFilter.prototype.updateDB = function () {
    var Zotero = this.Zotero;
    var sql = Zotero.File.getContentsFromURL("resource://abbrevs-filter/schema/abbrevs-filter.sql");
    var version = parseInt(sql.match(/^-- ([0-9]+)/)[1]);

    if (!this.db.tableExists("abbreviations")) {
        Zotero.debug("AFZ: [SETUP] no abbreviations table table found, performing scratch install)");
	    this.db.query(sql);
        this.setDBVersion('abbreviations', version);
        if (!this.installInProgress) {
            AbbrevsFilter.launchImportProgressMeter();
        }
    } else {
        var dbVersion = this.getDBVersion('abbreviations');
        if (version > dbVersion) {
            Zotero.debug("AFZ: [SETUP] upgrading database schema to version " + version);
            
            try {
                
		        // make backup of database first
		        this.db.backupDatabase(dbVersion);
		        Zotero.wait(1000);
                
                this.db.beginTransaction();
                for (var i=dbVersion,ilen=version+1;i<ilen;i+=1) {
                    // Next version
                    // if (i === 15) {
                    //   Do stuff
                    //}
                }
                this.setDBVersion('abbreviations', version);
                this.db.commitTransaction();
		        
            } catch (e) {
                Zotero.debug("AFZ: [ERROR] failure during setup: "+e);
                this.db.rollbackTransaction();
                throw("AFZ: [ERROR] failure during setup: " + e);
            }
            if (!this.installInProgress) {
                this.launchImportProgressMeter();
            }
        }
    }
}
