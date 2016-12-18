AbbrevsFilter.prototype.setDBVersion = Zotero.Promise.coroutine(function* (db, facility, version) {
    var sql = 'SELECT COUNT(*) FROM version WHERE schema=?';
    var hasSchema = yield db.valueQueryAsync(sql,[facility]);
    if (!hasSchema) {
	    sql = "INSERT INTO version VALUES (?,?)";
	    yield db.query(sql, [facility, version]);
    } else {
	    sql = "UPDATE version SET version=? WHERE schema=?;";
	    yield db.query(sql, [version, facility]);
    }
});

AbbrevsFilter.prototype.getDBVersion = Zotero.Promise.coroutine(function* (facility) {
	if (this.db.tableExists("version")) {
        var sql = "SELECT version FROM version WHERE schema=?";
        var dbVersion = this.db.valueQuery(sql,[facility]);
        if (dbVersion) {
            dbVersion = parseInt(dbVersion, 10);
        } else {
            dbVersion = 0;
        }
    } else {
        dbVersion = 0;
    }
    return dbVersion;
});

AbbrevsFilter.prototype.getCacheObject = function (id) {
    if (!this.cache[id]) {
        this.cache[id] = JSON.parse(this.Zotero.File.getContentsFromURL("resource://abbrevs-filter/" + id + ".json"));
    }
    return this.cache[id];
}

AbbrevsFilter.prototype.resetCache = function() {
    this.cache = {};
}
