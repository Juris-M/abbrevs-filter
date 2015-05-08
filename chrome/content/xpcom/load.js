AbbrevsFilter = function () {
    this._suppress = {};
    this.resource_cache = {};
    this.updateDB();
};

AbbrevsFilter.prototype.initComponent = function(Zotero) {
    this.Zotero = Zotero;
    this.db = new this.Zotero.DBConnection("abbrevs-filter");
    this.addOrDeleteEntry = this.getAddOrDeleteEntry();
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
        this.resource_cache[id] = JSON.parse(this.Zotero.getContentsFromURL("resource://abbrevs-filter/" + id + ".json"));
    }
    return this.resource_cache[id];
}

AbbrevsFilter.prototype.resetResourceCache = function() {
    this.resource_cache = {};
}

AbbrevsFilter.prototype.setSuppressJurisdictions = function(listname) {
    for (var key in this._suppress) {
        delete this._suppress[key];
    }
    var sql = "SELECT jurisdiction FROM suppressme "
        + "JOIN jurisdiction USING(jurisdictionID) "
        + "JOIN list USING(listID) "
        + "WHERE list=?;";
    var jurisdictionList = this.db.columnQuery(sql,[listname]);
    var results;
    if (jurisdictionList) {
        jurisdictionList = "'" + jurisdictionList.join("','") + "'";
		var sql = 'SELECT jurisdictionName as val,jurisdictionID as comment FROM jurisdictions '
			+ 'WHERE jurisdictionID IN (' + jurisdictionList + ') ORDER BY jurisdictionName;'
        results = this.Zotero.DB.query(sql);
    } else {
        results = [];
    }
    for (var i=0,ilen=results.length;i<ilen;i+=1) {
        var result = results[i];
        this._suppress[result.comment] = result.val;
    }
}
