AbbrevsFilter.prototype.getAddOrDeleteEntry = function() {
    // Predefined statements
    var stmt = {};
    stmt.listSelect = this.db.getStatement("SELECT listID FROM list WHERE list=?");
    stmt.listInsert = this.db.getStatement("INSERT INTO list VALUES (NULL, ?)");
    stmt.jurisdictionSelect = this.db.getStatement("SELECT jurisdictionID FROM jurisdiction WHERE jurisdiction=?");
    stmt.jurisdictionInsert = this.db.getStatement("INSERT INTO jurisdiction VALUES (NULL, ?)");
    stmt.categorySelect = this.db.getStatement("SELECT categoryID FROM category WHERE category=?");
    stmt.categoryInsert = this.db.getStatement("INSERT INTO category VALUES (NULL, ?)");

    stmt.stringInsert = this.db.getStatement("INSERT INTO strings VALUES (NULL, ?)");
    stmt.rawIdSelect = this.db.getStatement("SELECT strings.stringID AS rawID FROM strings WHERE strings.string=?");
    stmt.abbrIdSelect = this.db.getStatement("SELECT strings.stringID AS abbrID FROM strings WHERE strings.string=?");
    stmt.abbrSelect = this.db.getStatement("SELECT COUNT (*) FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?");
    stmt.abbrUpdate = this.db.getStatement("UPDATE abbreviations SET abbrID=? WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?");
    stmt.abbrInsert = this.db.getStatement("INSERT INTO abbreviations VALUES (NULL, ?, ?, ?, ?, ?)");
    stmt.abbrDelete = this.db.getStatement("DELETE FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?");

    // Functions using the statements above
    function getIdFromStr(operation, str) {
        var ret;
        stmt[operation].bindUTF8StringParameter(0, str);
	    if (stmt[operation].executeStep()) {
	        ret = stmt[operation].getInt32(0);
	    } else {
	        ret = null;
	    }
	    stmt[operation].reset();
        return ret;
    }

    function setIdFromStr(operation, str) {
        stmt[operation].bindUTF8StringParameter(0, str);
        stmt[operation].executeStep();
        stmt[operation].reset();
    }

    // Encapsulated function incorporating the vars above as closure
    return function (listname, jurisdiction, category, rawval, abbrevval) {
        var sql, sqlinsert
        try {
            rawval = rawval.toLowerCase();
            // Add listname if necessary, get ID
            var listID = getIdFromStr("listSelect", listname);
            if (!listID) {
                setIdFromStr("listInsert", listname);
                listID = getIdFromStr("listSelect", listname);
            }
            
            // Get jurisdiction ID (preloaded)
            var jurisdictionID = getIdFromStr("jurisdictionSelect", jurisdiction);
            if (!jurisdictionID) {
                setIdFromStr("jurisdictionInsert", jurisdiction);
                jurisdictionID = getIdFromStr("jurisdictionSelect", jurisdiction);
            }
            
            // Add category if necessary, get ID
            var categoryID = getIdFromStr("categorySelect", category);
            if (!categoryID) {
                setIdFromStr("categoryInsert", category);
                categoryID = getIdFromStr("categorySelect", category);
            }
            
            // Add raw (key) if necessary, getID
            var rawID = getIdFromStr("rawIdSelect", rawval);
            if (!rawID) {
                setIdFromStr("stringInsert", rawval);
                rawID = getIdFromStr("rawIdSelect", rawval);
            }
            if (abbrevval) { // add
                // Add abbrevval if necessary, getID
                var abbrID = getIdFromStr("abbrIdSelect", abbrevval);
                if (!abbrID) {
                    setIdFromStr("stringInsert", abbrevval);
                    abbrID = getIdFromStr("abbrIdSelect", abbrevval);
                }
                // Set entry
                if (abbrID && listID && categoryID && rawID && jurisdictionID) {                
                    var hasItem = false;
                    stmt.abbrSelect.bindInt32Parameter(0, listID);
                    stmt.abbrSelect.bindInt32Parameter(1, jurisdictionID);
                    stmt.abbrSelect.bindInt32Parameter(2, categoryID);
                    stmt.abbrSelect.bindInt32Parameter(3, rawID);
                    if (stmt.abbrSelect.executeStep()) {
                        hasItem = stmt.abbrSelect.getInt32(0);
                    }
                    stmt.abbrSelect.reset();
                    if (hasItem) {
                        stmt.abbrUpdate.bindInt32Parameter(0, abbrID);
                        stmt.abbrUpdate.bindInt32Parameter(1, listID);
                        stmt.abbrUpdate.bindInt32Parameter(2, jurisdictionID);
                        stmt.abbrUpdate.bindInt32Parameter(3, categoryID);
                        stmt.abbrUpdate.bindInt32Parameter(4, rawID);
                        stmt.abbrUpdate.executeStep();
                        stmt.abbrUpdate.reset();
                    } else {
                        stmt.abbrInsert.bindInt32Parameter(0, listID);
                        stmt.abbrInsert.bindInt32Parameter(1, jurisdictionID);
                        stmt.abbrInsert.bindInt32Parameter(2, categoryID);
                        stmt.abbrInsert.bindInt32Parameter(3, rawID);
                        stmt.abbrInsert.bindInt32Parameter(4, abbrID);
                        stmt.abbrInsert.executeStep();
                        stmt.abbrInsert.reset();
                    }
                }
            } else { // delete
                // XXX Ditto
                stmt.abbrDelete.bindInt32Parameter(0, listID);
                stmt.abbrDelete.bindInt32Parameter(1, jurisdictionID);
                stmt.abbrDelete.bindInt32Parameter(2, categoryID);
                stmt.abbrDelete.bindInt32Parameter(3, rawID);
                stmt.abbrDelete.executeStep();
                stmt.abbrDelete.reset();
                // XXXXX Unused strings will be purged separately, at shutdown
            }
        } catch (e) {
            dump("AFZ: [ERROR] failure while attempting to add an abbreviation entry to the database: " + e + "\n");
        }
    }
}