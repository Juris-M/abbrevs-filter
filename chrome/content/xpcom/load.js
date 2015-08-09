AbbrevsFilter = function () {
    this.resource_cache = {};
};

AbbrevsFilter.prototype.initComponent = function(Zotero) {
    this.Zotero = Zotero;
    this.db = new this.Zotero.DBConnection("abbrevs-filter");
    this.updateDB();
    this.addOrDeleteEntry = this.getAddOrDeleteEntry();
    this.attachGetAbbreviation();
    this.attachSetSuppressJurisdictions();
    this.attachGetSuppressJurisdictions();
}

AbbrevsFilter.prototype.initPage = function () {
    this.resetResourceCache();
}

AbbrevsFilter.prototype.setDBVersion = function(facility, version) {
    var sql = 'SELECT COUNT(*) FROM version WHERE schema=?';
    var hasSchema = this.db.valueQuery(sql,[facility]);
    if (!hasSchema) {
	    sql = "INSERT INTO version VALUES (?,?)";
	    this.db.query(sql, [facility, version]);
    } else {
	    sql = "UPDATE version SET version=? WHERE schema=?;";
	    this.db.query(sql, [version, facility]);
    }
}

AbbrevsFilter.prototype.getDBVersion = function(facility) {
	if (AbbrevsFilter.db.tableExists("version")) {
        var sql = "SELECT version FROM version WHERE schema=?";
        var dbVersion = AbbrevsFilter.db.valueQuery(sql,[facility]);
        if (dbVersion) {
            dbVersion = parseInt(dbVersion, 10);
        } else {
            dbVersion = 0;
        }
    } else {
        dbVersion = 0;
    }
    return dbVersion;
}

AbbrevsFilter.prototype.getResourceObject = function (id) {
    if (!this.resource_cache[id]) {
        this.resource_cache[id] = JSON.parse(this.Zotero.File.getContentsFromURL("resource://abbrevs-filter/" + id + ".json"));
    }
    return this.resource_cache[id];
}

AbbrevsFilter.prototype.resetResourceCache = function() {
    this.resource_cache = {};
}
