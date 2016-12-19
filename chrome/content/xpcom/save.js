AbbrevsFilter.prototype.saveEntry = Zotero.Promise.coroutine(function* (listname, jurisdiction, category, rawval, abbrevval) {
	
	// Set IDs for listname, jurisdiction, and category in cache if required
	// If abbrevval is empty, delete any existing entry for rawval.
	// If abbrevval is non-empty, attempt a lookup, and
	//   If no value is returned, create an entry
	//   If value is returned, update the entry
	let kc = this.keycache;
	this.setKeys(listname, jurisdiction, category);
	let rawID = this.getStringID(rawval, true);
	let abbrID = this.getStringID(abbrevval, true);

	// Get index, ID and old mapped value of abbreviation entry, if it exists
	sql = "SELECT abbreviationIdx,abbrID,string AS abbrevval FROM abbreviations A JOIN strings S ON A.abbrID=S.stringID WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawval=?";
	res = yield AbbrevsFilter.db.rowQueryAsync(sql,[kc[listname], kc[jurisdiction], kc[category], kc[rawval]]);
	
	if (!abbrevval) {
		if (res) {
			sql = "DELETE FROM abbreviations WHERE abbreviationIdx=?";
			yield AbbrevsFilter.db.queryAsync(sql,[res.abbreviationIdx]);
		}
	} else {
		if (!res || abbrevval !== res.abbrevval) {
			if (!res) {
				// Create a new entry
				sql = "INSERT INTO abbreviations VALUES (NULL, ?, ?, ?, ?, ?)";
				yield AbbrevsFilter.db.queryAsync(sql, kc[listname], kc[jurisdiction], kc[category], kc[rawval], abbrID);
			} else {
				// Update existing entry
				sql = "UPDATE abbreviations SET abbrID=? WHERE abbreviationIdx=?";
				yield AbbrevsFilter.db.queryAsync(sql, [abbrID, res.abbreviationIdx]);
			}
		}
	}
}
