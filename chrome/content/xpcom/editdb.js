AbbrevsFilter.prototype.editEntry = Zotero.Promise.coroutine(function* (listname, jurisdiction, category, rawval, abbrevval) {
	// Set IDs for listname, jurisdiction, and category in cache if required
	// If abbrevval is empty, delete any existing entry for rawval.
	// If abbrevval is non-empty, attempt a lookup, and
	//   If no value is returned, create an entry
	//   If value is returned, update the entry
	var sql, res, abbrID, idc = this.idcache;
	let keys = {
		list: listname,
		jurisdiction: jurisdiction,
		category: category,
		raw: rawval
	}
	for (let key in keys) {
		if (!keys[key]) {
			throw `[AFZ] No value for ${key} in editEntry()`;
		}
		if (!this.idcache[keys[key]]) {
			// Look up or create ID
			sql = `SELECT ${key}ID FROM ${key} WHERE ${key}=?`;
			let id = yield AbbrevsFilter.db.valueQueryAsync(sql, [listname]);
			if (!id) {
				sql = `INSERT INTO ${key} VALUES (NULL, ?)`;
				yield AbbrevsFilter.db.queryAsync(sql, [keys[key]]);
				id = yield AbbrevsFilter.db.valueQueryAsync(sql, [keys[key]]);
			}
			idc[keys[key]] = id;
		}
	}
	// Get index of abbreviation entry, if any
	sql = "SELECT abbreviationIdx,abbrID,string AS abbrevval FROM abbreviations A JOIN strings S ON A.abbrID=S.stringID WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawval=?";
	res = yield AbbrevsFilter.db.rowQueryAsync(sql,[idc[listname], idc[jurisdiction], idc[category], idc[rawval]]);
	if (!abbrevval) {
		if (res) {
			sql = "DELETE FROM abbreviations WHERE abbreviationIdx=?";
			yield AbbrevsFilter.db.queryAsync(sql,[res.abbreviationIdx]);
		}
	} else {
		if (!res || abbrevval !== res.abbrevval) {
			// Obtain abbrID, registering string if necessary
			sql = "SELECT stringID FROM strings WHERE string=?";
			abbrID = yield AbbrevsFilter.db.valueQueryAsync(sql, [abbrevval]);
			if (!abbrID) {
				sql = "INSERT INTO strings VALUES (NULL, ?)";
				yield AbbrevsFilter.db.queryAsync(sql, [abbrevval]);
				sql = "SELECT stringID FROM strings WHERE string=?";
				abbrID = yield AbbrevsFilter.db.valueQueryAsync(sql, abbrevval);
			}
			if (!res) {
				// Create a new entry
				sql = "INSERT INTO abbreviations VALUES (NULL, ?, ?, ?, ?, ?)";
				yield AbbrevsFilter.db.queryAsync(sql, idc[listname], idc[jurisdiction], idc[category], idc[rawval], abbrID);
			} else {
				// Update existing entry
				sql = "UPDATE abbreviations SET abbrID=? WHERE abbreviationIdx=?";
				yield AbbrevsFilter.db.queryAsync(sql, [abbrID, res.abbreviationIdx]);
			}
		}
	}
}
