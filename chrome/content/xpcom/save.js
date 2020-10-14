AbbrevsFilter.prototype.saveEntry = Zotero.Promise.coroutine(function* (styleID, jurisdiction, category, rawval, abbrevval, shy, domain) {
	let kc = this.keycache;
	yield this._setKeys(styleID, jurisdiction, category);
	let rawID = yield this._getStringID(rawval, true);
	let abbrID = yield this._getStringID(abbrevval, true);

	var domainIdx = null;
	if (domain) {
		var sql = "SELECT domainIdx FROM domains WHERE domain=?";
		domainIdx = yield this.db.valueQueryAsync(sql, [domain]);
		if (!domainIdx) {
			var sqlIns = "INSERT INTO domains VALUES (NULL, ?)";
			yield this.db.queryAsync(sqlIns, [domain]);
			domainIdx = yield this.db.valueQueryAsync(sql, [domain]);
		}
	}

	params = [
		kc[styleID],
		kc[jurisdiction],
		kc[category],
		rawID
	];
	
	// Get index, ID and old mapped value of abbreviation entry, if it exists
	var sql = "SELECT abbreviationIdx,abbrID,S.string AS abbrevval FROM abbreviations A JOIN strings S ON A.abbrID=S.stringID WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
	if ("number" === typeof domainIdx) {
		sql += " AND domainIdx=?";
		params.push(domainIdx);
	} else {
		sql += " AND domainIdx IS NULL";
	}
	var res = yield this.db.rowQueryAsync(sql, params);
	
	// Set IDs for styleID, jurisdiction, and category in cache if required
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
			if (!res) {
				// Create a new entry
				params = [
					kc[styleID],
					kc[jurisdiction],
					kc[category],
					rawID,
					abbrID
				];
				if ("number" === typeof domainIdx) {
					sql = "INSERT INTO abbreviations VALUES (NULL, ?, ?, ?, ?, ?, ?)";
					params.push(domainIdx);
				} else {
					sql = "INSERT INTO abbreviations VALUES (NULL, ?, ?, ?, ?, ?, NULL)";
				}
				yield this.db.queryAsync(sql, params);
			} else if (!shy) {
				// Update existing entry
				sql = "UPDATE abbreviations SET abbrID=? WHERE abbreviationIdx=?";
				yield this.db.queryAsync(sql, [abbrID, res.abbreviationIdx]);
			}
		}
	}
});
