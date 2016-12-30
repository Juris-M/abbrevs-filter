AbbrevsFilter.prototype.setCacheFromCitation = Zotero.Promise.coroutine(function* (listname, citation) {
	var jurisdiction, category, rawvals;

	let rawFieldFunction = {
        "container-title": function (item, varname) {
            return item[varname] ? [item[varname]] : false;
        },
        "collection-title": function (item, varname) {
		    return item[varname] ? [item[varname]] : false;
        },
        "institution-entire": function (item, varname) {
		    if (this.CSL.CREATORS.indexOf(varname) === -1) return false;
		    let ret = [];
		    let names = item[varname].length
		    for (let i=0,ilen=names.length;i<ilen;i++) {
			    if (names[i].literal) {
				    ret.push(names[i]);
			    }
		    }
		    return ret.length ? ret : false;
        },
        "institution-part": function (item, varname) {
		    if (this.CSL.CREATORS.indexOf(varname) === -1) return false;
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
		    return ret.length ? ret : false;
        },
        "number": function (item, varname) {
            return varname === "number" ? [item[varname]] : false;
        },
        "title": function (item, varname) {
		    return [
			    "title",
			    "title-short",
			    "genre",
			    "event",
			    "medium"
		    ].indexOf(varname) > -1 ? [item[varname]] : false;
        },
        "place": function (item, varname) {
		    return [
			    "archive-place",
			    "publisher-place",
			    "event-place",
			    "jurisdiction",
			    "language-name",
			    "language-name-original"
		    ].indexOf(varname) > -1 ? [item[varname]] : false;
        }
    };
	
	// For fields
	for (var i=0,ilen=citation.citationItems.length;i<ilen;i++) {
		var id = citation.citationItems[i].id;
		var item = this.sys.retrieveItem(id);
		jurisdiction = item.jurisdiction;
		for (var field in item) {
			category = Zotero.CiteProc.CSL.FIELD_CATEGORY_REMAP[field];
			if (category) {
				rawvals = rawFieldFunction[category](item, field);
				for (var j=0,jlen=rawvals.length;j<jlen;j++) {
					yield this._setCacheEntry(listname, jurisdiction, category, rawvals[j]);
				}
			}
		}
	}
	
	// For items
    let rawItemFunction = {
        "nickname": function (item) {
		    var ret = [];
		    for (let varname in this.CSL.CREATORS) {
			    if (item[varname]) {
				    for (let i=0,ilen=item[varname].length;i<ilen;i++) {
					    let name = item[varname][i];
					    if (!name.literal) {
						    let rawname = this.CSL.Util.Names.getRawName(item[varname][i]);
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
		rawvals = this.rawItemFunction[key](item);
		for (let i=0,ilen=rawvals.length;i<ilen;i++) {
			this._setCacheEntry(listname, "default", key, rawvals[i]);
		}
	}
});

AbbrevsFilter.prototype._setCacheEntry = Zotero.Promise.coroutine(function* (listname, jurisdiction, category, rawval) {
	if (!rawval) {
		throw "[AFZ] Empty value for rawval in _setCacheEntry()";
	}
	var sql, abbrev;
	let c = this.cache, kc = this.keycache;
	// Extend cache segments if necessary
	if (!c[listname]) {
		c[listname] = {};
	}
	
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

			if (!c[listname][jurisd]) {
				c[listname][jurisd] = {};
			}
			if (!c[listname][jurisd][category]) {
				c[listname][jurisd][category] = {};
			}
			if ("undefined" !== typeof c[listname][jurisd][category][rawval]) {
				break;
			}
			sql = "SELECT string AS abbrev FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
			abbrev = yield AbbrevsFilter.db.valueQueryAsync(sql, [kc[listname], kc[jurisd], kc[category], rawID]);
			if (abbrev) {
				c[listname][jurisd][category][rawval] = abbrev;
				break;
			}
		}
	}
});

AbbrevsFilter.prototype._setKeys = Zotero.Promise.coroutine(function* (listname, jurisdiction, category) {
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

AbbrevsFilter.prototype._getStringID = Zotero.Promise.coroutine(function* (str, forceID) {
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
