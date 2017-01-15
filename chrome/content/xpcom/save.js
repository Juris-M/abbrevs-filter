AbbrevsFilter.prototype.saveEntry = Zotero.Promise.coroutine(function* (listname, jurisdiction, category, rawval, abbrevval) {
	let kc = this.keycache;
	yield this._setKeys(listname, jurisdiction, category);
	let rawID = yield this._getStringID(rawval, true);
	let abbrID = yield this._getStringID(abbrevval, true);
	
	// Get index, ID and old mapped value of abbreviation entry, if it exists
	var sql = "SELECT abbreviationIdx,abbrID,S.string AS abbrevval FROM abbreviations A JOIN strings S ON A.abbrID=S.stringID WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
	var res = yield this.db.rowQueryAsync(sql,[kc[listname], kc[jurisdiction], kc[category], rawID]);
	
	var me = this;
	yield this.db.executeTransaction(function* () {
		// Set IDs for listname, jurisdiction, and category in cache if required
		// If abbrevval is empty, delete any existing entry for rawval.
		// If abbrevval is non-empty, attempt a lookup, and
		//   If no value is returned, create an entry
		//   If value is returned, update the entry
		if (!abbrevval) {
			if (res || res.length === 0) {
				sql = "DELETE FROM abbreviations WHERE abbreviationIdx=?";
				yield this.db.queryAsync(sql,[res.abbreviationIdx]);
			}
		} else {
			if (!res || abbrevval !== res.abbrevval) {
				if (!res || res.length === 0) {
					// Create a new entry
					sql = "INSERT INTO abbreviations VALUES (NULL, ?, ?, ?, ?, ?)";
					yield this.db.queryAsync(sql, [kc[listname], kc[jurisdiction], kc[category], rawID, abbrID]);
				} else {
					// Update existing entry
					sql = "UPDATE abbreviations SET abbrID=? WHERE abbreviationIdx=?";
					yield this.db.queryAsync(sql, [abbrID, res.abbreviationIdx]);
				}
			}
		}
	}.bind(me));
});
