// Well, it's just broken, isn't it. The runtime
// logic is all fine, but the statements aren't getting
// through on first install.

// This doesn't need to be nearly this confusing.

// It might be work rewriting the install routines to take
// advantage of bootstrap, if  that's possible. We don't make
// heavy use of overlays, so it SHOULD be perfectly possible.

// The problem with the current code, if it's not abandoned,
// is that database install and database population are
// mixed up in a single function. Separate the two, and
// it all becomes quite straightforward and simple.

// Simplifying access with an abbreviationIdx column
// would also be a very good thing to do, while we're
// at it. There really isn't a need to be slinging around
// all those variable names just to get a known row out
// of the abbreviations table.

AbbrevsFilter = function () {};

AbbrevsFilter.prototype.init = function () {

    //if (this.installInProgress) {
    //    return;
    //}

    this.windowsSeen = {};
    this.windowsSeen.pStack = {};
    this.hasSeenStack = false;

    this.Zotero = Components.classes['@zotero.org/Zotero;1'].getService().wrappedJSObject;
    var Zotero = this.Zotero;

    this.db = new this.Zotero.DBConnection("abbrevs-filter");
    var db = this.db;

    // Stuff shamelessly borrowed from Zotero (zotero.js)
    this.mainThread = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].
	    getService(Components.interfaces.nsIXULAppInfo),
    platformVersion = appInfo.platformVersion;
    var versionComparator = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
	    .getService(Components.interfaces.nsIVersionComparator);
    this.isFx4 = versionComparator.compare(platformVersion, "2.0a1") >= 0;

    Zotero.debug("[AbbrevsFilter] appInfo: " + appInfo.platformVersion[0]);

    if(this.isFx4) {
	    Components.utils.import("resource://gre/modules/AddonManager.jsm");
	    AddonManager.getAddonByID("abbrevs-filter@juris-m.github.io",
			                      function(addon) { AbbrevsFilter.version = addon.version; AbbrevsFilter.addon = addon; });
    } else {
	    var gExtensionManager =
	        Components.classes["@mozilla.org/extensions/manager;1"]
	        .getService(Components.interfaces.nsIExtensionManager);
	    this.version
	        = gExtensionManager.getItemForID("abbrevs-filter@juris-m.github.io").version;
    }
    
    var schema = "abbrevs-filter";
    var schemaFile = schema + '.sql';
    AddonManager.getAddonByID("abbrevs-filter@juris-m.github.io", function(addon) {
	    
	    // From Zotero getInstallDirectory()
	    var file;
	    if(AbbrevsFilter.isFx4) {
	        while(AbbrevsFilter.addon === undefined) AbbrevsFilter.mainThread.processNextEvent(true);
	        var resourceURI = AbbrevsFilter.addon.getResourceURI();
	        file = resourceURI.QueryInterface(Components.interfaces.nsIFileURL).file;
	    } else {
	        var id = 'abbrevs-filter@juris-m.github.io';
	        var em = Components.classes["@mozilla.org/extensions/manager;1"]
		        .getService(Components.interfaces.nsIExtensionManager);
	        file= em.getInstallLocation(id).getItemLocation(id);
	    }
	    file.append(schemaFile);
	    var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
	        .createInstance(Components.interfaces.nsIFileInputStream);
	    istream.init(file, 0x01, 444, 0);
	    istream.QueryInterface(Components.interfaces.nsILineInputStream);
	    
	    var line = {}, sql = '', hasmore;
	    
	    // Skip the first line, which contains the schema version
        var hasVersion = false;
	    var version = istream.readLine(line);
	    version = line.value.replace(/^--\s+([0-9]+).*/, "$1");
        if (version.match(/^[0-9]+$/)) {
            version = parseInt(version, 10);
            hasVersion = true;
        }
        
        // XXX Careful here. Discriminate between version upgrade and complete reinstall.
	    if (!hasVersion) {
	        istream.close();
            Zotero.debug("AFZ: [ERROR] no version header found in SQL source file");
	        throw ("AFZ: [ERROR] no version header found in SQL source file\n");
	    } else if (!AbbrevsFilter.db.tableExists("abbreviations")) {
            Zotero.debug("AFZ: [SETUP] no abbreviations table table found, performing scratch install)");
	        do {
		        hasmore = istream.readLine(line);
		        sql += line.value + "\n";
	        } while(hasmore);
	        istream.close();
	        AbbrevsFilter.db.query(sql);
            setDBVersion('abbreviations', version);
            if (!this.installInProgress) {
                AbbrevsFilter.launchImportProgressMeter();
            }
        } else {
	        istream.close();
            var dbVersion = getDBVersion('abbreviations');
            if (version > dbVersion) {
                Zotero.debug("AFZ: [SETUP] upgrading database schema to version " + version);
                
                try {
                    
		            // make backup of database first
		            AbbrevsFilter.db.backupDatabase(dbVersion);
		            Zotero.wait(1000);
                    
                    AbbrevsFilter.db.beginTransaction();
                    for (var i=dbVersion,ilen=version+1;i<ilen;i+=1) {
                        if (i === 11) {
                            var sql = "CREATE TABLE IF NOT EXISTS suppressme ("
                                + "  suppressmeID INTEGER PRIMARY KEY,"
                                + "  jurisdictionID INTEGER,"
                                + "  listID INTEGER"
                                + ");"
                            AbbrevsFilter.db.query(sql);

                            var sql = "CREATE INDEX IF NOT EXISTS suppressme_list_jurisdiction ON suppressme(listID,jurisdictionID);";
                            AbbrevsFilter.db.query(sql);
                        }
                        if (i === 12) {
                            // The abbreviations table does not have an explicit entry ID.
                            //     Its PRIMARY KEY is just the full set of ID key numbers.
                            // This means that changing rawID will create a new entry, with a new rowid.
                            //     The old one will not be deleted.
                            // So ... we need to do this in several steps.
                            // First, create lowercase versions of all keys.
                            // IGNORE ITEM KEYS (used for "hereinafter" references)
                            var sql = "INSERT OR REPLACE INTO strings (string) "
                                + "SELECT DISTINCT lower(strings.string) AS string "
                                + "FROM strings "
                                + "JOIN abbreviations A ON A.rawID=strings.stringID "
                                + "LEFT JOIN strings LC ON LC.string=lower(strings.string) "
                                + "WHERE NOT strings.string=lower(strings.string) "
                                + "AND LC.stringID IS NULL "
                                + "AND strings.string NOT LIKE '%\\_%' ESCAPE '\\' "
                                + "ORDER BY strings.string;"
                            AbbrevsFilter.db.query(sql);
                            // Second, set the lowercase version on clashing values.
                            // IGNORE ITEM KEYS (used for "hereinafter" references)
                            var sql = "INSERT OR REPLACE INTO abbreviations (listID,jurisdictionID,categoryID,rawID,abbrID) "
                                + "SELECT A.listID,"
                                + "A.jurisdictionID,"
                                + "A.categoryID,"
                                + "LC.stringID AS rawID,"
                                + "A.abbrID "
                                + "FROM abbreviations A "
                                + "JOIN strings ON strings.stringID=A.rawID "
                                + "JOIN strings LC ON LC.string=lower(strings.string) "
                                + "WHERE NOT strings.string=lower(strings.string) "
                                + "AND strings.string NOT LIKE '%\\_%' ESCAPE '\\';"
                            AbbrevsFilter.db.query(sql);
                            // Third, remove abbreviations entries for mixed-case keys.
                            // IGNORE ITEM KEYS (used for "hereinafter" references)
                            var sql = "DELETE FROM abbreviations "
                                + "WHERE abbreviations.rowid IN ("
                                +   "SELECT abbreviations.rowid "
                                +   "FROM abbreviations "
                                +   "JOIN strings ON strings.stringID=abbreviations.rawID "
                                +   "WHERE NOT strings.string=lower(strings.string)"
                                +   "AND strings.string NOT LIKE '%\\_%' ESCAPE '\\');"
                            AbbrevsFilter.db.query(sql);
                            // Fourth, purge unused strings.
                            var sql = "DELETE FROM strings "
                                + "WHERE stringID IN ("
                                +   "SELECT stringID FROM strings "
                                +   "LEFT JOIN abbreviations RAW ON RAW.rawID=strings.stringID "
                                +   "LEFT JOIN abbreviations ABBR ON ABBR.abbrID=strings.stringID "
                                +   "LEFT JOIN containerPhrase CPPRI ON CPPRI.primaryID=strings.stringID "
                                +   "LEFT JOIN containerPhrase CPSEC ON CPSEC.secondaryID=strings.stringID "
                                +   "LEFT JOIN containerPhrase CPABBR ON CPABBR.abbrID=strings.stringID "
                                +   "LEFT JOIN titlePhrase TPPRI ON TPPRI.primaryID=strings.stringID "
                                +   "LEFT JOIN titlePhrase TPSEC ON TPSEC.secondaryID=strings.stringID "
                                +   "LEFT JOIN titlePhrase TPABBR ON TPABBR.abbrID=strings.stringID "
                                +   "WHERE RAW.rawID IS NULL "
                                +     "AND ABBR.abbrID IS NULL "
                                +     "AND CPPRI.primaryID IS NULL "
                                +     "AND CPSEC.secondaryID IS NULL "
                                +     "AND CPABBR.abbrID IS NULL "
                                +     "AND TPPRI.primaryID IS NULL "
                                +     "AND TPSEC.secondaryID IS NULL "
                                +     "AND TPABBR.abbrID IS NULL"
                                + ")"
                            AbbrevsFilter.db.query(sql);
                            // Now keep it clean.
                        }
                        if (i === 13) {
                            var sql;
                            // Okay. Here's where the business happens.
                            // Rename jurisdictions to new IDs, merging as necessary (ouch - there may be conflicts)
                            // Tick through the keys in the remap conversion object.
                            var countryKeys = JSON.parse(Zotero.File.getContentsFromURL("resource://abbrevs-filter/country-names.json"));
                            var conversionMap = JSON.parse(Zotero.File.getContentsFromURL("resource://abbrevs-filter/jurisdiction-map-10002.json"));
                            var jurisdictionData = JSON.parse(Zotero.File.getContentsFromURL("resource://abbrevs-filter/jurisdictions.json")).jurisdictions;
                            var jurisdictionMap = {}
                            for (var j=0,jlen=jurisdictionData.length;j<jlen;j++) {
                                var entry = jurisdictionData[j];
                                if ('number' === typeof entry[1]) {
                                    entry[0] = jurisdictionData[entry[1]][0] + '|' + entry[0]
                                    entry[2] = jurisdictionData[entry[1]][2] + ":" + entry[2]
                                }
                                jurisdictionMap[entry[2]] = entry[0]
                            }

                            for (var origKey in conversionMap) {
                                var targetKey = conversionMap[origKey];
                                sql = "SELECT jurisdictionID FROM jurisdiction WHERE jurisdiction=?";
                                var targetID = AbbrevsFilter.db.valueQuery(sql, [targetKey]);
                                var origID = AbbrevsFilter.db.valueQuery(sql, [origKey]);
                                if (!origID) {
                                    // Ensure that an entry exists for the original jurisdiction key
                                    var insertSql = "INSERT INTO jurisdiction VALUES(NULL, ?)";
                                    AbbrevsFilter.db.query(insertSql, [origKey]);
                                    origID = AbbrevsFilter.db.valueQuery(sql, [origKey]);
                                }
                                if (!targetID) {
                                    // If the target key does not yet exist, just rename it in place.
                                    sql = "UPDATE jurisdiction SET jurisdiction=? WHERE jurisdictionID=?";
                                    AbbrevsFilter.db.query(sql, [targetKey,origID]);
                                } else {
                                    // If the target key DOES exist, tick through the associated abbreviations, and
                                    // where there is a clash between the original and the target lists, remove
                                    // one of the items (the target - but the choice of which to delete is arbitrary).
                                    // Potential conflicts are on: suppressme and abbreviations only
                                    // 1. suppressme
                                    sql = "SELECT S2.suppressmeID FROM suppressme S1 JOIN suppressme S2 ON S1.listID=S2.listID WHERE S1.jurisdictionID=? AND S2.jurisdictionID=?";
                                    var conflicts = AbbrevsFilter.db.columnQuery(sql, [origID, targetID]);
                                    for (var j=0,jlen=conflicts.length-1;j<jlen;j++) {
                                        var conflictID = conflicts[j];
                                        sql = "DELETE FROM suppressme WHERE suppressmeID=?";
                                        AbbrevsFilter.db.query(sql, [conflictID]);
                                    }
                                    // Now safe to move entries across in suppressme
                                    sql = "UPDATE suppressme SET jurisdictionID=? WHERE jurisdictionID=?";
                                    AbbrevsFilter.db.query(sql, [targetID, origID]);
                                    // 2. abbreviations
                                    sql = "SELECT A1.listID,A1.jurisdictionID,A1.categoryID,A1.rawID "
                                        + "FROM abbreviations A1 JOIN abbreviations A2 "
                                        + "ON A1.rawID=A2.rawID AND A1.listID=A2.listID AND A1.categoryID=A2.categoryID "
                                        + "WHERE A1.jurisdictionID=? AND A2.jurisdictionID=?";

                                    // XXX I think I'm getting mixed up here.

                                    var conflicts = AbbrevsFilter.db.query(sql, [origID, targetID]);
                                    for (var j=0,jlen=conflicts.length;j<jlen;j++) {
                                        var conflict = conflicts[j];
                                        sql = "DELETE FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
                                        AbbrevsFilter.db.query(sql, [conflict.listID,conflict.jurisdictionID,conflict.categoryID,conflict.rawID]);
                                    }
                                    // Now safe to move entries across in abbreviations
                                    sql = "UPDATE abbreviations SET jurisdictionID=? WHERE jurisdictionID=?";
                                    AbbrevsFilter.db.query(sql, [targetID, origID]);
                                    // Done with the old jurisdiction now. Remove it.
                                    sql = "DELETE FROM jurisdiction WHERE jurisdictionID=?";
                                    AbbrevsFilter.db.query(sql, [origID]);
                                }
                            }

                            // Okay, so now that's out of the way, we can ...
                            sql = "SELECT categoryID FROM category WHERE category=?";
                            var categoryID = AbbrevsFilter.db.valueQuery(sql, ['place']);

                            // ... convert the strings for subjurisdictions and remapped "countries" ...
                            for (var jurisdictionKey in conversionMap) {
                                //var jurisdictionKey = conversionMap[key]
                                var jurisdictionName = jurisdictionMap[conversionMap[jurisdictionKey]];
                                if (jurisdictionName.indexOf("|") > -1) {
                                    jurisdictionName = jurisdictionName.split("|").slice(1).join("|");
                                }
                                jurisdictionName = jurisdictionName.toLowerCase();
                                sql = "SELECT stringID FROM strings WHERE string=?";
                                var jurisdictionNameID = AbbrevsFilter.db.valueQuery(sql, [jurisdictionName]);
                                var jurisdictionKeyID = AbbrevsFilter.db.valueQuery(sql, [jurisdictionKey]);
                                if (jurisdictionKeyID) {
                                    if (!jurisdictionNameID) {
                                        var insertSql = "INSERT INTO strings VALUES(NULL, ?);"
                                        AbbrevsFilter.db.query(insertSql, [jurisdictionName]);
                                        jurisdictionNameID = AbbrevsFilter.db.valueQuery(sql, [jurisdictionName]);
                                    }
                                    // XXX Replace jurisdictionKey ID with jurisdiction Name ID
                                    // XXX UH-OH. This could result in a conflict.
                                    // XXX Get a list of items to convert
                                    sql = "SELECT listID,jurisdictionID,abbrID FROM abbreviations WHERE rawID=? AND categoryID=?";
                                    var rows = AbbrevsFilter.db.query(sql, [jurisdictionKeyID, categoryID]);
                                    for (var j=0,jlen=rows.length;j<jlen;j++) {
                                        var row = rows[j];
                                        // Iterate through the list, checking for matches and skipping the update if there is one.
                                        
                                        // XXX Obviously not good enough.

                                        //if (row.rawID != jurisdictionNameID) {
                                        // Check for a duplicate target
                                        sql = "SELECT COUNT(*) FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
                                        var hasAlready = AbbrevsFilter.db.valueQuery(sql, [row.listID, row.jurisdictionID, categoryID, jurisdictionNameID]);
                                        if (hasAlready) {
                                            sql = "DELETE FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
                                            AbbrevsFilter.db.query(sql, [row.listID, row.jurisdictionID, categoryID, jurisdictionNameID]);
                                        }
                                        sql = "UPDATE abbreviations SET rawID=? WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
                                        AbbrevsFilter.db.query(sql, [jurisdictionNameID, row.listID, row.jurisdictionID, categoryID, jurisdictionKeyID]);
                                        //}
                                    }

                                }
                            }

                            // ... and for countries left over
                            // (these are pretty much the same as the block above)
                            for (var countryKey in countryKeys) {
                                var countryName = jurisdictionMap[countryKey];
                                if (!countryName) {
                                    countryName = countryKeys[countryKey];
                                }
                                if (countryName.indexOf("|") > -1) {
                                    countryName = countryName.split("|").slice(1).join("|");
                                }
                                sql = "SELECT stringID FROM strings WHERE string=?";
                                var countryNameID = AbbrevsFilter.db.valueQuery(sql, [countryName]);
                                var countryKeyID = AbbrevsFilter.db.valueQuery(sql, [countryKey]);
                                if (countryKeyID) {
                                    if (!countryNameID) {
                                        var insertSql = "INSERT INTO strings VALUES(NULL, ?);"
                                        AbbrevsFilter.db.query(insertSql, [countryName]);
                                        countryNameID = AbbrevsFilter.db.valueQuery(sql, [countryName]);
                                    }
                                    // XXX Replace countryKey ID with country Name ID
                                    // XXX UH-OH. This could result in a conflict.
                                    // XXX Get a list of items to convert
                                    sql = "SELECT listID,jurisdictionID,abbrID FROM abbreviations WHERE rawID=? AND categoryID=?";
                                    var rows = AbbrevsFilter.db.query(sql, [countryKeyID, categoryID]);
                                    for (var j=0,jlen=rows.length;j<jlen;j++) {
                                        var row = rows[j];
                                        // Check for a duplicate target
                                        sql = "SELECT COUNT(*) FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
                                        var hasAlready = AbbrevsFilter.db.valueQuery(sql, [row.listID, row.jurisdictionID, categoryID, countryNameID]);
                                        if (hasAlready) {
                                            sql = "DELETE FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
                                            AbbrevsFilter.db.query(sql, [row.listID, row.jurisdictionID, categoryID, countryNameID]);
                                        }
                                        sql = "UPDATE abbreviations SET rawID=? WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?";
                                        AbbrevsFilter.db.query(sql, [countryNameID, row.listID, row.jurisdictionID, categoryID, countryKeyID]);
                                    }
                                }
                            }
                            
                            // Completely remove abbreviations leading with "us;federal-bankr;" in the rawID.
                            var sql = "SELECT listID,jurisdictionID,categoryID,rawID FROM abbreviations A JOIN strings R ON R.stringID=A.rawID WHERE R.string LIKE ?;"
                            var rows = AbbrevsFilter.db.query(sql, ['us;federal-bankr;%']);
                            var deleteSql = "DELETE FROM abbreviations WHERE rawID=? AND jurisdictionID=? AND listID=? AND categoryID=?;"
                            for (var j=0,jlen=rows.length;j<jlen;j++) {
                                var row = rows[j];
                                AbbrevsFilter.db.query(deleteSql, [row.rawID, row.jurisdictionID, row.listID, row.categoryID]);
                            }

                            var sql = "SELECT S.stringID,S.string FROM abbreviations A JOIN category C USING(categoryID) JOIN strings S ON S.stringID=A.abbrID WHERE categoryID=? AND (S.string LIKE 'Bankr. %' OR S.string LIKE 'B.A.P. %') GROUP BY S.stringID;";
                            var rows = AbbrevsFilter.db.query(sql, [categoryID]);
                            for (var j=0,jlen=rows.length;j<jlen;j++) {
                                var targetID = rows[j].stringID;
                                var oldStr = rows[j].string;
                                var newStr = rows[j].string.replace(/^(?:Bankr\.|B\.A\.P\.)\s+/, "");
                                if (newStr) {
                                    var sql = "SELECT stringID FROM strings WHERE string=?;";
                                    var existingID = AbbrevsFilter.db.valueQuery(sql, [newStr]);
                                    if (existingID) {
                                        var sql = "UPDATE abbreviations SET abbrID=? WHERE abbrID=?;";
                                        AbbrevsFilter.db.query(sql, [existingID, targetID]);
                                    } else {
                                        var sql = "UPDATE strings SET string=? WHERE stringID=?;";
                                        AbbrevsFilter.db.query(sql, [newStr, targetID]);
                                    }
                                }
                            }
                        }

                        if (i === 14) {
                            var sql = "CREATE TEMP TABLE oldAbbreviations AS SELECT * FROM abbreviations;";
                            AbbrevsFilter.db.query(sql);
                            var sql = "DROP TABLE abbreviations;";
                            AbbrevsFilter.db.query(sql);
                            var sql = "CREATE TABLE abbreviations ("
                                + "abbreviationIdx INTEGER PRIMARY KEY,"
                                + "listID INTEGER,"
                                + "jurisdictionID INTEGER,"
                                + "categoryID INTEGER,"
                                + "rawID INTEGER,"
                                + "abbrID INTEGER"
                                + ");"
                            AbbrevsFilter.db.query(sql);
                            var sql = "INSERT INTO abbreviations (listID,jurisdictionID,categoryID,rawID,abbrID) "
                                + "SELECT listID,jurisdictionID,categoryID,rawID,abbrID "
                                + "FROM oldAbbreviations;"
                            AbbrevsFilter.db.query(sql);
                            var sql = "CREATE INDEX abbreviations_listID ON abbreviations(listID);"
                            AbbrevsFilter.db.query(sql);
                            var sql = "CREATE INDEX abbreviations_jurisdictionID ON abbreviations(jurisdictionID);"
                            AbbrevsFilter.db.query(sql);
                            var sql = "CREATE INDEX abbreviations_categoryID ON abbreviations(categoryID);"
                            AbbrevsFilter.db.query(sql);
                            var sql = "CREATE INDEX abbreviations_rawID ON abbreviations(rawID);"
                            AbbrevsFilter.db.query(sql);
                            var sql = "CREATE INDEX abbreviations_abbrID ON abbreviations(abbrID);"
                            AbbrevsFilter.db.query(sql);
                        }
                    }
                    setDBVersion('abbreviations', version);
                    AbbrevsFilter.db.commitTransaction();
		            
                } catch (e) {
                    Zotero.debug("AFZ: [ERROR] failure during setup: "+e);
                    AbbrevsFilter.db.rollbackTransaction();
                    throw("AFZ: [ERROR] failure during setup: " + e);
                }
                if (!this.installInProgress) {
                    AbbrevsFilter.launchImportProgressMeter();
                }
            }
	    }
    });
    
    function setDBVersion (facility, version) {
        var sql = 'SELECT COUNT(*) FROM version WHERE schema=?';
        var hasSchema = AbbrevsFilter.db.valueQuery(sql,[facility]);
        if (!hasSchema) {
	        sql = "INSERT INTO version VALUES (?,?)";
	        AbbrevsFilter.db.query(sql, [facility, version]);
        } else {
	        sql = "UPDATE version SET version=? WHERE schema=?;";
	        AbbrevsFilter.db.query(sql, [version, facility]);
        }
    }

    function getDBVersion (facility) {
	    if (AbbrevsFilter.db.tableExists("version")) {
            var sql = "SELECT version FROM version WHERE schema=?";
            var dbVersion = AbbrevsFilter.db.valueQuery(sql,[facility]);
            if (dbVersion) {
                dbVersion = parseInt(dbVersion, 10);
            } else {
                dbVersion = 0;
            }
        } else {
            dbVersion = 0;
        }
        return dbVersion;
    }

    
    this.getResourceObject = function (id) {
        var ext = '';
        var url = "resource://abbrevs-filter/" + id + ".json";
	    var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
	        .createInstance();
	    xmlhttp.open('GET', url, false);
	    xmlhttp.overrideMimeType("text/plain");
	    xmlhttp.send(null);
	    return JSON.parse(xmlhttp.responseText);
    }


    this.addOrDeleteEntry = function() {

        // Predefined statements
        var stmt = {};
        stmt.listSelect = db.getStatement("SELECT listID FROM list WHERE list=?");
        stmt.listInsert = db.getStatement("INSERT INTO list VALUES (NULL, ?)");
        stmt.jurisdictionSelect = db.getStatement("SELECT jurisdictionID FROM jurisdiction WHERE jurisdiction=?");
        stmt.jurisdictionInsert = db.getStatement("INSERT INTO jurisdiction VALUES (NULL, ?)");
        stmt.categorySelect = db.getStatement("SELECT categoryID FROM category WHERE category=?");
        stmt.categoryInsert = db.getStatement("INSERT INTO category VALUES (NULL, ?)");

        stmt.stringInsert = db.getStatement("INSERT INTO strings VALUES (NULL, ?)");
        stmt.rawIdSelect = db.getStatement("SELECT strings.stringID AS rawID FROM strings WHERE strings.string=?");
        stmt.abbrIdSelect = db.getStatement("SELECT strings.stringID AS abbrID FROM strings WHERE strings.string=?");
        stmt.abbrSelect = db.getStatement("SELECT COUNT (*) FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?");
        stmt.abbrUpdate = db.getStatement("UPDATE abbreviations SET abbrID=? WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?");
        stmt.abbrInsert = db.getStatement("INSERT INTO abbreviations VALUES (NULL, ?, ?, ?, ?, ?)");
        stmt.abbrDelete = db.getStatement("DELETE FROM abbreviations WHERE listID=? AND jurisdictionID=? AND categoryID=? AND rawID=?");

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
    }();
};
