AbbrevsFilter.prototype.setCacheFromCitation = Zotero.Promise.coroutine(function* (listname, obj, citation) {
	var CSL = this.CSL;
	var jurisdiction, category, rawvals;

	

	let rawFieldFunction = {
        "container-title": function (item, varname) {
            return item[varname] ? [item[varname]] : [];
        },
        "collection-title": function (item, varname) {
		    return item[varname] ? [item[varname]] : [];
        },
        "institution-entire": function (item, varname) {
		    if (CSL.CREATORS.indexOf(varname) === -1) return [];
		    let ret = [];
		    let names = item[varname].length
		    for (let i=0,ilen=names.length;i<ilen;i++) {
			    if (names[i].literal) {
				    ret.push(names[i]);
			    }
		    }
		    return ret.length ? ret : [];
        },
        "institution-part": function (item, varname) {
		    if (CSL.CREATORS.indexOf(varname) === -1) return [];
		    let ret = [];
		    let names = item[varname].length
		    for (let i=0,ilen=names.length;i<ilen;i++) {
			    if (names[i].literal) {
				    let nameparts = names[i].literal.split(/\s*|\s*/);
				    for (let j=0,jlen=nameparts.length;j<jlen;j++) {
					    ret.push(nameparts[j]);
				    }
			    }
		    }
		    return ret.length ? ret : [];
        },
        "number": function (item, varname) {
            return varname === "number" ? [item[varname]] : [];
        },
        "title": function (item, varname) {
		    return [
			    "title",
			    "title-short",
			    "genre",
			    "event",
			    "medium"
		    ].indexOf(varname) > -1 ? [item[varname]] : [];
        },
        "place": function (item, varname) {
		    return [
			    "archive-place",
			    "publisher-place",
			    "event-place",
			    "jurisdiction",
			    "language-name",
			    "language-name-original"
		    ].indexOf(varname) > -1 ? [item[varname]] : [];
        }
    };

	// For fields
	for (var i=0,ilen=citation.citationItems.length;i<ilen;i++) {
		var id = citation.citationItems[i].id;
		var item = this.sys.retrieveItem(id);
		jurisdiction = item.jurisdiction ? item.jurisdiction : "default";
		for (let field of Object.keys(item)) {
			category = CSL.FIELD_CATEGORY_REMAP[field];
			if (category) {
				rawvals = rawFieldFunction[category](item, field);
				for (var j=0,jlen=rawvals.length;j<jlen;j++) {
					yield this._setCacheEntry(listname, obj, jurisdiction, category, rawvals[j]);
				}
			}
		}
	}
	
	// For items
    let rawItemFunction = {
        "nickname": function (item) {
		    var ret = [];
		    for (let varname in CSL.CREATORS) {
			    if (item[varname]) {
				    for (let i=0,ilen=item[varname].length;i<ilen;i++) {
					    let name = item[varname][i];
					    if (!name.literal) {
						    let rawname = CSL.Util.Names.getRawName(item[varname][i]);
						    ret.push(rawname);
					    }
				    }
			    }
		    }
		    return ret.length ? ret : false;
        },
        "hereinafter": function (item) {
            return item.id;
        },
        "classic": function (item) {
		    // This is a change from legacy, which used "<author>, <title>"
            return item.id;
        }
    }
	
	for (let key in rawItemFunction) {
		rawvals = rawItemFunction[key](item);
		for (let i=0,ilen=rawvals.length;i<ilen;i++) {
			this._setCacheEntry(listname, obj, "default", key, rawvals[i]);
		}
	}
});

AbbrevsFilter.prototype._setCacheEntry = Zotero.Promise.coroutine(function* (listname, obj, jurisdiction, category, rawval) {
	if (!rawval) return;
	var sql, abbrev;
	kc = this.keycache;
	
	// Otherwise, set the cache for the current entry and all of its fallbacks from DB record,
	// stopping at the first hit.
	let rawID = yield this._getStringID(rawval);
	if (rawID) {
		var jurisdictionSplit = jurisdiction.split("-");
		var jurisdictionList = ["default"];
		if (jurisdiction) {
			for (var i=0,ilen=jurisdictionSplit.length;i<ilen;i++) {
				jurisdictionList.push(jurisdictionSplit.slice(0, i+1).join("-"));
			}
		}
		for (var i=jurisdictionList.length-1;i>-1;i--) {
			let jurisd = jurisdictionList[i];
			yield this._setKeys(listname, jurisd, category);

			if (!obj[jurisd]) {
				obj[jurisd] = {};
			}
			if (!obj[jurisd][category]) {
				obj[jurisd][category] = {};
			}
			if (obj[jurisd][category][rawval]) {
				break;
			}
			sql = "SELECT S.string AS abbrev FROM abbreviations A JOIN strings S ON A.abbrID=S.stringID WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
			abbrev = yield this.db.valueQueryAsync(sql, [kc[listname], kc[jurisd], kc[category], rawID]);
			if (abbrev) {
				obj[jurisd][category][rawval] = abbrev;
				break;
			}
		}
	}
});

AbbrevsFilter.prototype._setKeys = Zotero.Promise.coroutine(function* (listname, jurisdiction, category) {
	var me = this;
	yield this.db.executeTransaction(function* () {
		var sql, res, abbrID, kc = this.keycache;
		let keys = {
			list: listname,
			jurisdiction: jurisdiction,
			category: category
		}
		for (let key in keys) {
			if (!keys[key]) {
				throw `[AFZ] No value for ${key} in _setKeys()`;
			}
			if (!kc[keys[key]]) {
				// Look up or create ID
				sql = `SELECT ${key}ID FROM ${key} WHERE ${key}=?`;
				let id = yield this.db.valueQueryAsync(sql, [keys[key]]);
				if (!id) {
					sql = `INSERT INTO ${key} VALUES (NULL, ?)`;
					yield this.db.queryAsync(sql, [keys[key]]);
					id = yield this.db.valueQueryAsync(sql, [keys[key]]);
				}
				kc[keys[key]] = id;
			}
		}
	}.bind(me));
});

AbbrevsFilter.prototype._getStringID = Zotero.Promise.coroutine(function* (str, forceID) {
	var strID;
	let me = this;
	yield this.db.executeTransaction(function* () {
		var sql = "SELECT stringID FROM strings WHERE string=?";
		strID = yield this.db.valueQueryAsync(sql, [str]);
		if (!strID && forceID) {
			sql = "INSERT INTO strings VALUES (NULL, ?)";
			yield this.db.queryAsync(sql, [str]);
			sql = "SELECT stringID FROM strings WHERE string=?";
			strID = yield this.db.valueQueryAsync(sql, str);
		}
	}.bind(me));
	return strID;
});

AbbrevsFilter.prototype.setCachedAbbrevList = Zotero.Promise.coroutine(function* (styleID) {
	var cachedAbbreviations = {};
	// Load style abbreviations, if any, to cache
	var sql = "SELECT jurisdiction,category,RV.string AS rawval, ABBR.string AS abbr "
		+ "FROM abbreviations A "
		+ "JOIN list USING(listID) "
		+ "JOIN jurisdiction USING(jurisdictionID) "
		+ "JOIN category USING(categoryID) "
		+ "JOIN strings RV ON rawID=RV.stringID "
		+ "JOIN strings ABBR ON abbrID=ABBR.stringID "
		+ "WHERE list=?"
	var res = yield this.db.queryAsync(sql, [styleID]);
	if (res) {
		for (let i=0,ilen=res.length;i<ilen;i++) {
			let row = res[i];
			if (!cachedAbbreviations[row.jurisdiction]) {
				cachedAbbreviations[row.jurisdiction] = {};
			}
			if (!cachedAbbreviations[row.jurisdiction][row.category]) {
				cachedAbbreviations[row.jurisdiction][row.category] = {};
			}
			if (!cachedAbbreviations[row.jurisdiction][row.category][row.rawval]) {
				cachedAbbreviations[row.jurisdiction][row.category][row.rawval] = row.abbr;
			}
		}
	}
	this.cachedAbbreviations = cachedAbbreviations;
});
