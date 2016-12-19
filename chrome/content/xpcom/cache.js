AbbrevsFilter.prototype.setKeys = Zotero.Promise.coroutine(function* (listname, jurisdiction, category) {
	var sql, res, abbrID, kc = this.keycache;
	let keys = {
		list: listname,
		jurisdiction: jurisdiction,
		category: category
	}
	for (let key in keys) {
		if (!keys[key]) {
			throw `[AFZ] No value for ${key} in setKeys()`;
		}
		if (!kc[keys[key]]) {
			// Look up or create ID
			sql = `SELECT ${key}ID FROM ${key} WHERE ${key}=?`;
			let id = yield AbbrevsFilter.db.valueQueryAsync(sql, [listname]);
			if (!id) {
				sql = `INSERT INTO ${key} VALUES (NULL, ?)`;
				yield AbbrevsFilter.db.queryAsync(sql, [keys[key]]);
				id = yield AbbrevsFilter.db.valueQueryAsync(sql, [keys[key]]);
			}
			kc[keys[key]] = id;
		}
	}
});

AbbrevsFilter.prototype.getStringID = Zotero.Promise.coroutine(function* (str, forceID) {
	sql = "SELECT stringID FROM strings WHERE string=?";
	strID = yield AbbrevsFilter.db.valueQueryAsync(sql, [str]);
	if (!strID && forceID) {
		sql = "INSERT INTO strings VALUES (NULL, ?)";
		yield AbbrevsFilter.db.queryAsync(sql, [str]);
		sql = "SELECT stringID FROM strings WHERE string=?";
		strID = yield AbbrevsFilter.db.valueQueryAsync(sql, str);
	}
	return strID;
});

AbbrevsFilter.prototype.setCacheEntry = Zotero.Promise.coroutine(function* (listname, jurisdiction, category, rawval) {
	if (!rawval) {
		throw "[AFZ] Empty value for rawval in setCacheEntry()";
	}
	var sql, abbrev;
	let c = this.cache, kc = this.keycache;
	// Extend cache segments if necessary
	if (!c[listname]) {
		c[listname] = {};
	}
	if (!c[listname][jurisdiction]) {
		c[listname][jurisdiction] = {};
	}
	if (!c[listname][jurisdiction][category]) {
		c[listname][jurisdiction][category] = {};
	}

	// If entry exists, we're done.
	if ("undefined" !== typeof c[listname][jurisdiction][category][rawval]) {
		return true;
	}

	// Otherwise, set the cache from DB record
	let rawID = yield this.getStringID(rawval);
	if (rawID) {
		this.setKeys(listname, jurisdiction, category);
		sql = "SELECT string AS abbrev FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
		abbrev = yield AbbrevsFilter.db.valueQueryAsync(sql, [kc[listname], kc[jurisdiction], kc[category], rawID]);
		if (abbrev) {
			c[listname][jurisdiction][category][rawval] = abbrev;
		}
	}
}
