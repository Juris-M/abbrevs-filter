AbbrevsFilter.prototype.setDBVersion = Zotero.Promise.coroutine(function* (facility, version) {
    var sql = 'SELECT COUNT(*) FROM version WHERE schema=?';
    var hasSchema = yield this.db.valueQueryAsync(sql,[facility]);
    if (!hasSchema) {
	    sql = "INSERT INTO version VALUES (?,?)";
	    yield this.db.query(sql, [facility, version]);
    } else {
	    sql = "UPDATE version SET version=? WHERE schema=?;";
	    yield this.db.query(sql, [version, facility]);
    }
});

AbbrevsFilter.prototype.getDBVersion = Zotero.Promise.coroutine(function* (facility) {
	Zotero.debug("XXX version table exists? " + this.db.tableExists("version"));
	if (yield this.db.tableExists("version")) {
        var sql = "SELECT version FROM version WHERE schema=?";
        var dbVersion = this.db.valueQueryAsync(sql,[facility]);
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
