AbbrevsFilter.prototype.attachGetAbbreviation = function (Zotero) {
    var db = this.db;
    var addOrDeleteEntry = this.addOrDeleteEntry;
    var CSL = Zotero.CiteProc.CSL;
    this.citeproc = CSL;
    var AbbrevsFilter = this;

    // Install a custom abbreviations handler on the processor.
    CSL.getAbbreviation = function (listname, obj, jurisdiction, category, key, itemType, noHints) {

        // Paranoia
        if (!key) return;
        
        // Keep JS key handy
        var key = ("" + key);
        var jsKey = key;

        if ("hereinafter" === category) {
            // Remap a hereinafter key if it is a real item.
            if (key.indexOf("/") === -1) {
                var entryItem = Zotero.Items.get(key);
                key = (entryItem.libraryID ? entryItem.libraryID : 0) + "_" + entryItem.key;
            }
        } else {
            // lowercase a non-hereinafter key
            key = key.toLowerCase();
        }

        // Assure requested jurisdiction ID exists
        var sql = "SELECT jurisdictionID FROM jurisdiction WHERE jurisdiction=?";
        var jurisdictionID = db.valueQuery(sql, [jurisdiction]);
        if (!jurisdictionID) {
            var sqlInsert = "INSERT INTO jurisdiction VALUES (NULL, ?)";
            db.query(sqlInsert, [jurisdiction]);
        }
        // Assure that abbreviation segments exist on memory object
        if (!obj[jurisdiction]) {
            obj[jurisdiction] = new CSL.AbbreviationSegments();
        }
        // Build a list of 1 or 2 jurisdictions, with any non-default first.
        var jurisdictions = ["default"];
        if (jurisdiction !== "default") {
            jurisdictions.push(jurisdiction);
        }
        jurisdictions.reverse();
        // Build a list of jurisdictions IDs in the same order
        var sql = "SELECT jurisdictionID FROM jurisdiction WHERE jurisdiction IN ("
        var placeholders = [];
        for (var i = 0, ilen = jurisdictions.length; i < ilen; i += 1) {
            placeholders.push("?");
        }
        sql += placeholders.join(",");
        sql += ") ORDER BY jurisdictionID DESC";
        var jurisdictionIDs = db.columnQuery(sql, jurisdictions);

        // The following assumes that a raw key value exists!

        // Pre-fetch category ID
        var sqlCategory = "SELECT categoryID FROM category WHERE category=?";
        var categoryID = db.valueQuery(sqlCategory, [category]);
        if (!categoryID) {
            var sqlInsert = "INSERT INTO category VALUES (NULL, ?)";
            db.query(sqlInsert, [category]);
            categoryID = db.valueQuery(sqlCategory, [category]);
        }

        // SQL to get full match
        var sqlFull = "SELECT Abbr.string FROM strings Raw "
            + "LEFT JOIN abbreviations ON Raw.stringID=abbreviations.rawID "
            + "LEFT JOIN strings Abbr ON Abbr.stringID=abbreviations.abbrID "
            + "WHERE listID=? AND jurisdictionID=? AND categoryID=? AND Raw.string=?";

        try {
            // Get the ID (the numeric database ID) of the styleID
            var sql = "SELECT listID FROM list WHERE list=?";
            var listID = db.valueQuery(sql, [listname]);
            if (!listID) {
                sqlinsert = "INSERT INTO list VALUES (NULL, ?)";
                db.query(sqlinsert, [listname]);
                listID = db.valueQuery(sql, [listname]);
            }
            // Try for a full match. If the jurisdiction of the match differs
            // (if the match is in default, but our item is from a specific
            // jurisdiction), write the abbreviation to the requested
            // jurisdiction list.
            var haveHit = false;
            for (var i = 0, ilen = jurisdictionIDs.length; i < ilen; i += 1) {
                var myjurisdictionID = jurisdictionIDs[i];
                var myjurisdiction = jurisdictions[i];
                var params = [listID, myjurisdictionID, categoryID, key];
                var abbr = db.valueQuery(sqlFull, params);
                if (abbr) {
                    obj[myjurisdiction][category][jsKey] = abbr;
                    //if (myjurisdiction !== jurisdiction) {
                    //    addOrDeleteEntry (listname, jurisdiction, category, key, abbr);
                    //}
                    haveHit = true;
                    break;
                }
            }
            if (!haveHit && !noHints) {
                // No full match, so try word lists for some fields
                // ** set sql

                var sql = false;
                // Should string match on word come first in these?

                if ("container-title" === category && "chapter" !== itemType) {
                    sql = "SELECT containerPhrase.secondaryLen,S.string AS secondary,Abbr.string AS abbr "
                        +"FROM containerPhrase "
                        + "LEFT JOIN strings P ON containerPhrase.primaryID=P.stringID "
                        + "LEFT JOIN strings S ON containerPhrase.secondaryID=S.stringID "
                        + "LEFT JOIN strings Abbr ON containerPhrase.abbrID=Abbr.stringID "
                        + "WHERE containerPhrase.listID=? AND containerPhrase.jurisdictionID=? AND P.string=? AND containerPhrase.secondaryLen<=? "
                        + "ORDER BY containerPhrase.secondaryLen DESC"
                } else if (["institution-part", "title", "place"].indexOf(category) > -1) {
                    sql = "SELECT titlePhrase.secondaryLen,S.string AS secondary,Abbr.string AS abbr "
                        +"FROM titlePhrase "
                        + "LEFT JOIN strings P ON titlePhrase.primaryID=P.stringID "
                        + "LEFT JOIN strings S ON titlePhrase.secondaryID=S.stringID "
                        + "LEFT JOIN strings Abbr ON titlePhrase.abbrID=Abbr.stringID "
                        + "WHERE titlePhrase.listID=? AND titlePhrase.jurisdictionID=? AND P.string=? AND titlePhrase.secondaryLen<=? "
                        + "ORDER BY titlePhrase.secondaryLen DESC"
                }
                if (sql) {
                    for (var i = 0, ilen = jurisdictionIDs.length; i < ilen; i += 1) {
                        var newlst = [];
                        var myjurisdictionID = jurisdictionIDs[i];
                        var lst = jsKey.split(/\s+/);
                        while (lst.length) {
                            var word = lst[0];
                            lst = lst.slice(1);
                            newlst.push(word);
                            var rows = db.query(sql, [listID, myjurisdictionID, word, lst.length]);
                            if (rows) {
                                // XXX iterate over secondaries
                                for (var j = 0, jlen = rows.length; j < jlen; j += 1) {
                                    var row = rows[j];
                                    if (row.secondary === lst.slice(0, row.secondaryLen).join(" ")) {
                                        newlst.pop();
                                        if ("{suppress}" !== row.abbr) {
                                            newlst.push(row.abbr);
                                        }
                                        lst = lst.slice(row.secondaryLen);
                                        break;
                                    }
                                }
                            }
                        }
                        // Adding to the memory list is not enough here?
                        // We need to force an add to the DB as well.
                        if (newlst.join(" ") !== jsKey) {
                            obj[jurisdiction][category][jsKey] = newlst.join(" ");
                            addOrDeleteEntry (listname, jurisdiction, category, key, newlst.join(" "));
                        } else {
                            obj[jurisdiction][category][jsKey] = "";
                        }
                    }
                } else {
                    obj[jurisdiction][category][jsKey] = "";
                }
            } else if (!haveHit && noHints) {
                obj[jurisdiction][category][jsKey] = "";
            }
        } catch (e) {
            Zotero.debug("AFZ: [ERROR] failure while attempting to get abbreviation: "+e);
        }
    }
}

