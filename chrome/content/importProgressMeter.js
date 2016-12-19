var Abbrevs_Filter_Import = new function () {

    var Zotero = Components.classes["@zotero.org/Zotero;1"]
	.getService(Components.interfaces.nsISupports)
	.wrappedJSObject;
    
    var AFZ = Components.classes['@juris-m.github.io/abbrevs-filter;1']
        .getService(Components.interfaces.nsISupports)
        .wrappedJSObject;

    AFZ.resetResourceCache();

    var totalAbbrevs, runningTotal, progressMeter, batchSpecs, batchPos, versionUpdateCallback;

    this.onLoad = onLoad;
    this.onUnload = onUnload;

    var listsForUpdate = {};

    function prepareUpdate() {
        try {
            // We don't use these yet, but there they are
            var schemaDataVersion = AFZ.getResourceObject("segments").version;
            var dbDataVersion = AFZ.getDBVersion('data');
            // Lists may change from time to time, though, and they should at least fill gaps
            // on install when they do.
            // ...
            // So get the directory list.
            var directoryMap = AFZ.getResourceObject('abbrevs/DIRECTORY_LISTING');

            /*

            // Check the versions in the list against those recorded in the database, if any.
            var somethingToUpdate = false;
            listsForUpdate = {};
            for (var i=0,ilen=directoryMap.length;i<ilen;i+=1) {
                var filename = directoryMap[i].filename;
                var filestub = filename.slice(0,-5);
                var listJsonVersion = directoryMap[i].version;
                var listDatabaseVersion = AFZ.getDBVersion(filestub);
                // ... and build a map of lists for update, with target version increments
                if (!listDatabaseVersion || listDatabaseVersion < listJsonVersion) {
                    listsForUpdate[filestub] = listJsonVersion;
                }
            }
            // Then get the install map.
            var installMap = AFZ.getResourceObject("map");

            */

            var spec = {};

            /*
            for (var styleID in installMap) {
                // Walk through the install map, building a spec object containing pointers
                // only to lists that require updating.
                var entries = installMap[styleID];
                var listsToUse = [];
                for (var i=0,ilen=entries.length;i<ilen;i+=1) {
                    var listID = entries[i];
                    if (listsForUpdate[listID]) {
                        listsToUse.push([listID,0]);
                    }
                }
                if (listsToUse.length) {
                    spec[styleID] = listsToUse;
                    somethingToUpdate = true;
                }
            }

            */

            if (Object.keys(spec).length) {
                return spec;
            } else {
                return false;
            }
        } catch (e) {
            Zotero.debug("AFZ: [ERROR] while importing list data: "+e);
        }
    }
    
    function onLoad (event) {
	
        progressMeter = document.getElementById('abbrevs-filter-progress');
        progressMeter.setAttribute('value', 5);
        

	    if (window.arguments[0].wrappedJSObject.spec) {
	        var spec = window.arguments[0].wrappedJSObject.spec;
	    } else {
            var spec = prepareUpdate();
	    }
        
        if (!spec) {
	        close();
        }
	
        setTimeout(function() {
	    totalAbbrevs = 0;
	    runningTotal = 0;
	    spec = spec;

	    // Synchronous
	    runBatchImport(spec, true);
	    // Async
	    runBatchImport(spec);
        }, 300);
    };
    
    function onUnload (event) {
        setTimeout(function() {
            AFZ.db.rollbackTransaction();
        },100);
    };
    
    function updateProgressMeter (justLooking) {
        if ((runningTotal % 10) == 0) {
            var percentage = (15 +(runningTotal*85/totalAbbrevs));
            progressMeter.setAttribute('value',percentage);
        }
        if (runningTotal == totalAbbrevs) {
            setTimeout(function() {
                AFZ.db.commitTransaction();
		        if (window.arguments[0].wrappedJSObject.spec) {
		            for (var listID in listsForUpdate) {
			            AFZ.setDBVersion(listID,listsForUpdate[listID]);
		            }
		        }
                close();
            },100);
        }
    };

    function runBatchImport (spec, justLooking) {

        try {
            
            if (!justLooking) {
                AFZ.db.beginTransaction();
                //AFZ.getStatements();
            }

            batchSpecs = [];

            outer:
            for (var listname in spec) {
                var abbrevs = spec[listname];
                var listObj = null;
                for (var i=0,ilen=abbrevs.length;i<ilen;i+=1) {
                    listObj = abbrevs[i][0];
                    var mode = abbrevs[i][1];
                    var requestedVersion = abbrevs[i][2];
                    // Oh, shoot! This won't work. We need to store the per-listname versions
                    // of EACH SOURCE LIST in the database for comparison. Bummer.
                    if ("string" === typeof listObj) {
                        try {
                            listObj = AFZ.getResourceObject("abbrevs/" + listObj, true);
                            if (listObj.xdata) {
                                listObj = listObj.xdata;
                            }
                        } catch (e) {
                            Zotero.debug("AFZ: [WARNING] skipping unknown abbreviation set \"" + listObj + "\": " + e);
                            continue outer;
                        }
                    }
                    batchSpecs.push({
                        listname:listname,
                        listObj:listObj,
                        mode:mode,
                        justLooking:justLooking
                    });
                    var obj = batchSpecs[batchSpecs.length-1];
                }
            }
            importListForStyle(0,justLooking);
        } catch (e) {
            Zotero.debug("AFZ: [ERROR] failure during import: "+e);
            AFZ.db.rollbackTransaction();
            close();
            throw("AFZ: [ERROR] failure during import: "+e);
        }
    };

    function importListForStyle (pos,justLooking) {

        if (pos === batchSpecs.length) {
            return;
        }

        batchPos = pos;

        var listname = batchSpecs[pos].listname;
        var json_obj = batchSpecs[pos].listObj;
        var mode = batchSpecs[pos].mode;
        // var justLooking = batchSpecs[pos].justLooking;
        
        var listID = AFZ.getListID(listname);

        if (!AFZ.transform) {
            AFZ.transform = {
                abbrevs:{}
            }
        }

        for (var jurisdiction in json_obj) {
            // If the jurisdiction segment doesn't yet exist on the memory object, create it.
            if (!AFZ.transform.abbrevs[jurisdiction]) {
                AFZ.transform.abbrevs[jurisdiction] = AFZ.getResourceObject("segments").segments;
            }
            // Be a little careful when deleting keys during iteration.
            // Not sure all ECMAscript implementations will be nice here.
            var deletes = [];
            for (var category in json_obj[jurisdiction]) {
                if (!AFZ.transform.abbrevs[jurisdiction][category]) {
                    deletes.push(category);
                }
            }
            for (var i = 0, ilen = deletes.length; i < ilen; i += 1) {
                delete json_obj[jurisdiction][category];
            }
        }

	    if (mode == 2) { // Replace
            replaceAbbrevs(listname,json_obj,justLooking);
	    } else if (mode == 1) { // Override
            overrideAbbrevs(listname,json_obj,justLooking);
	    } else { // Fill gaps
            if (!justLooking) Zotero.debug("AFZ: GAP-FILL update for style "+listname);
            fillAbbrevs(listname,json_obj,justLooking);
	    }

        // XXX transform-dependent
	    for (var jurisdiction in AFZ.transform.abbrevs) {
	        for (var category in AFZ.transform.abbrevs[jurisdiction]) {
		        AFZ.transform.abbrevs[jurisdiction][category] = {};
	        }
	    }

	    var hasContainerPhrase = false;
	    var hasTitlePhrase = false;
	    for (var jurisdiction in json_obj) {
	        // Word lists. Do not update if none contained in import object.

	        // XXX Assure that jurisdiction is registered here.
	        var sql = "SELECT jurisdictionID FROM jurisdiction WHERE jurisdiction=?";
	        var params = [jurisdiction];
	        var jurisdictionID = AFZ.db.valueQuery(sql, params);
	        if (!jurisdictionID) {
		        var sqlInsert = "INSERT INTO jurisdiction VALUES (NULL, ?)";
		        AFZ.db.query(sqlInsert, params);
		        jurisdictionID = AFZ.db.valueQuery(sql, params);
	        }

	        if (json_obj[jurisdiction]["title-phrase"]) {
		        hasTitlePhrase = true;
	        }
	        if (json_obj[jurisdiction]["container-phrase"]) {
		        hasContainerPhrase = true;
	        }
	    }
        if (hasTitlePhrase) {
            if (!justLooking) Zotero.debug("AFZ: TITLE-PHRASE update for style "+listname);
            titlePhrases(listname,json_obj,justLooking,listID,jurisdictionID);
        }
        if (hasContainerPhrase) {
            if (!justLooking) Zotero.debug("AFZ: CONTAINER-PHRASE update for style "+listname);
            containerPhrases(listname,json_obj,justLooking,listID,jurisdictionID);
        }
        if (justLooking) importListForStyle(pos+1,justLooking);
    }

    function replaceAbbrevs (listname,json_obj,justLooking) {
	    var sql = "DELETE FROM abbreviations WHERE listID IN (SELECT listID FROM list WHERE list=?)";
	    var params = [listname];
	    AFZ.db.query(sql, params);
	    
	    AFZ.transform.abbrevs = {};
	    AFZ.transform.abbrevs["default"] = new AFZ.citeproc.sys.AbbreviationSegments();

        var infos = [];
	    
	    for (var jurisdiction in json_obj) {
	        for (var category in json_obj[jurisdiction]) {
		        if (["title-phrase", "container-phrase"].indexOf(category) > -1) {
		            continue;
		        }
                if (justLooking) {
                    totalAbbrevs += 1;
                } else {
                    for (var raw in json_obj[jurisdiction][category]) {
                        infos.push({
                            raw:raw,
                            category:category,
                            jurisdiction:jurisdiction,
                            listname:listname
                        });
                    }
                }
	        }
	    }
        if (!justLooking) replaceAbbrevsAction(0,infos.length,infos,json_obj);
    }

    function replaceAbbrevsAction (pos,limit,infos,json_obj) {
        if (pos === limit) {
            importListForStyle(batchPos+1);
            return;
        }
        var info = infos[pos];
        setTimeout(function() {
	        var abbr = json_obj[info.jurisdiction][info.category][info.raw];
	        AFZ.saveEntry(info.listname, info.jurisdiction, info.category, info.raw, abbr);
            runningTotal += 1;
            replaceAbbrevsAction(pos+1,limit,infos,json_obj);
            updateProgressMeter();
        }, 20);
    };


    function overrideAbbrevs (listname,json_obj,justLooking) {
        var infos = [];
	    for (var jurisdiction in json_obj) {
	        if (!AFZ.transform.abbrevs[jurisdiction]) {
		        AFZ.transform.abbrevs[jurisdiction] = new AFZ.citeproc.sys.AbbreviationSegments();
	        }
	        for (var category in json_obj[jurisdiction]) {
		        if (["title-phrase", "container-phrase"].indexOf(category) > -1) {
		            continue;
		        }
		        // If the category is unknown, ignore it
		        if (!AFZ.transform.abbrevs[jurisdiction][category]) {
		            Zotero.debug("AFZ: [WARNING] ignoring unknown category: "+category);
		            continue;
		        }
                for (var raw in json_obj[jurisdiction][category]) {
                    if (justLooking) {
                        totalAbbrevs += 1;
                    } else {
                        infos.push({
                            raw:raw,
                            category:category,
                            jurisdiction:jurisdiction,
                            listname:listname
                        });
                    }
                }
	        }
	    }
        if (!justLooking) overrideAbbrevsAction(0,infos.length,infos,json_obj);
    }

    function overrideAbbrevsAction (pos,limit,infos,json_obj) {
        if (pos === limit) {
            importListForStyle(batchPos+1);
            return;
        }
        var info = infos[pos];
        setTimeout(function() {
	        var abbr = json_obj[info.jurisdiction][info.category][info.raw];
	        AFZ.saveEntry(info.listname, info.jurisdiction, info.category, info.raw, abbr);
            runningTotal += 1;
            overrideAbbrevsAction(pos+1,limit,infos,json_obj);
            updateProgressMeter();
        }, 20);
    }

    function fillAbbrevs (listname,json_obj,justLooking) {
        var infos = [];
	    for (var jurisdiction in json_obj) {
	        for (var category in json_obj[jurisdiction]) {
		        if (["title-phrase", "container-phrase"].indexOf(category) > -1) {
		            continue;
		        }
                for (var raw in json_obj[jurisdiction][category]) {
                    if (justLooking) {
                        totalAbbrevs += 1;
                    } else {
                        infos.push({
                            raw:raw,
                            category:category,
                            jurisdiction:jurisdiction,
                            listname:listname
                        });
                    }
                }
	        }
	    }
        if (!justLooking) {
            fillAbbrevsAction(0,infos.length,infos,json_obj);
        }
    }

    function fillAbbrevsAction (pos,limit,infos,json_obj) {
        if (pos === limit) {
            importListForStyle(batchPos+1);
            return;
        }
        var info = infos[pos];
        setTimeout(function() {
	        var subsql = "SELECT COUNT (*) FROM abbreviations "
		        + "NATURAL JOIN list "
		        + "NATURAL JOIN category "
		        + "NATURAL JOIN jurisdiction "
		        + "LEFT JOIN strings Raw ON Raw.stringID=abbreviations.rawID "
		        + "LEFT JOIN strings Abbr ON Abbr.stringID=abbreviations.abbrID "
		        + "WHERE list=? AND jurisdiction=? AND category=? and Raw.string=?";
	        var subparams = [info.listname, info.jurisdiction, info.category, info.raw];
	        var hasAlready = AFZ.db.valueQuery(subsql, subparams);
	        if (!hasAlready) {
		        var abbr = json_obj[info.jurisdiction][info.category][info.raw];
                AFZ.saveEntry(info.listname, info.jurisdiction, info.category, info.raw, abbr);
            }
            runningTotal += 1;
            fillAbbrevsAction(pos+1,limit,infos,json_obj);
            updateProgressMeter();
        }, 20);
    };
    
    function titlePhrases(listname,json_obj,justLooking,listID,jurisdictionID) {
	    var sql = "DELETE FROM titlePhrase WHERE listID IN (SELECT listID FROM list WHERE list=?)";
	    var params = [listname];
	    AFZ.db.query(sql, params);
        var infos = [];
	    for (var jurisdiction in json_obj) {
	        for (var raw in json_obj[jurisdiction]["title-phrase"]) {
		        var abbr = json_obj[jurisdiction]["title-phrase"][raw];
		        if (raw && abbr) {
                    if (justLooking) {
                        totalAbbrevs += 1;
                    } else {
                        infos.push({
                            raw:raw,
                            jurisdiction:jurisdiction,
                            listname:listname,
                            justLooking:justLooking,
                            listID:listID,
                            jurisdictionID:jurisdictionID,
                            abbr:abbr
                        });
                    }
		        }
	        }
        }
        if (!justLooking) titlePhrasesAction(0,infos.length,infos,json_obj);
    }

    function titlePhrasesAction (pos,limit,infos,json_obj) {
        if (pos === limit) {
            importListForStyle(batchPos+1);
            updateProgressMeter();
            return;
        }
        var info = infos[pos];
        setTimeout(function() {
            // code to import phrases goes here
            // XXX init "phrase" category name here			
	        var lst = info.raw.split(/\s+/);
	        var primary = lst[0];
	        var secondary = lst.slice(1).join(" ");
	        var secondaryLength = lst.length - 1;

	        // add primary to strings if necessary
	        sql = "SELECT strings.stringID AS primaryID FROM strings WHERE strings.string=?";
	        var primaryID = AFZ.db.valueQuery(sql, [primary]);
	        if (!primaryID) {
		        sqlinsert = "INSERT INTO strings VALUES (NULL, ?)";
		        AFZ.db.query(sqlinsert, [primary]);
		        primaryID = AFZ.db.valueQuery(sql, [primary]);
	        }

	        // add secondary to strings if necessary
	        sql = "SELECT strings.stringID AS secondaryID FROM strings WHERE strings.string=?";
	        var secondaryID = AFZ.db.valueQuery(sql, [secondary]);
	        if (!secondaryID) {
		        sqlinsert = "INSERT INTO strings VALUES (NULL, ?)";
		        AFZ.db.query(sqlinsert, [secondary]);
		        secondaryID = AFZ.db.valueQuery(sql, [secondary]);
	        }
	        // add abbr to strings if necessary
	        sql = "SELECT strings.stringID AS abbrID FROM strings WHERE strings.string=?";
	        var abbrID = AFZ.db.valueQuery(sql, [info.abbr]);
	        if (!abbrID) {
		        sqlinsert = "INSERT INTO strings VALUES (NULL, ?)";
		        AFZ.db.query(sqlinsert, [info.abbr]);
		        abbrID = AFZ.db.valueQuery(sql, [info.abbr]);
	        }
	        // add title phrase entries
	        sql = "SELECT phraseID FROM titlePhrase WHERE listID=? AND jurisdictionID=? AND primaryID=? AND secondaryID=?";
	        var phraseID = AFZ.db.valueQuery(sql, [info.listID, info.jurisdictionID, primaryID, secondaryID]);
	        if (!phraseID) {
		        sqlinsert = "INSERT INTO titlePhrase VALUES (NULL, ?, ?, ?, ?, ?, ?)";
		        AFZ.db.query(sqlinsert, [info.listID, info.jurisdictionID, primaryID, secondaryLength, secondaryID, abbrID]);
	        } else {
		        // update instead
		        sql = "UPDATE titlePhrase SET abbrID=? WHERE listID=? AND jurisdictionID=? AND primaryID=? AND secondaryID=?";
		        params = [abbrID, info.listID, info.jurisdictionID, primaryID, secondaryID];
		        AFZ.db.query(sql,params);
	        }
            runningTotal += 1;
            titlePhrasesAction(pos+1,limit,infos,json_obj);
            updateProgressMeter();
        }, 20);
    };
    
    function containerPhrases (listname,json_obj,justLooking,listID,jurisdictionID) {
	    var sql = "DELETE FROM containerPhrase WHERE listID IN (SELECT listID FROM list WHERE list=?)";
	    var params = [listname];
	    AFZ.db.query(sql, params);
        var infos = [];
	    for (var jurisdiction in json_obj) {
            for (var raw in json_obj[jurisdiction]["container-phrase"]) {
                var abbr = json_obj[jurisdiction]["container-phrase"][raw];
                if (raw && abbr) {
                    if (justLooking) {
                        totalAbbrevs += 1;
                    } else {
                        infos.push({
                            raw:raw,
                            jurisdiction:jurisdiction,
                            listname:listname,
                            listID:listID,
                            jurisdictionID:jurisdictionID,
                            abbr:abbr
                        });
                    }
                }
            }
        }
        if (!justLooking) containerPhrasesAction(0,infos.length,infos,json_obj);
    }

    function containerPhrasesAction (pos,limit,infos,json_obj) {
        if (pos === limit) {
            importListForStyle(batchPos+1);
            updateProgressMeter();
            return;
        }
        var info = infos[pos];
        setTimeout(function() {
            var lst = info.raw.split(/\s+/);
            var primary = lst[0];
            var secondary = lst.slice(1).join(" ");
            var secondaryLength = lst.length - 1;

            // add primary to strings if necessary
	        sql = "SELECT strings.stringID AS primaryID FROM strings WHERE strings.string=?";
	        var primaryID = AFZ.db.valueQuery(sql, [primary]);
	        if (!primaryID) {
		        sqlinsert = "INSERT INTO strings VALUES (NULL, ?)";
		        AFZ.db.query(sqlinsert, [primary]);
		        primaryID = AFZ.db.valueQuery(sql, [primary]);
	        }

            // add secondary to strings if necessary
	        sql = "SELECT strings.stringID AS secondaryID FROM strings WHERE strings.string=?";
	        var secondaryID = AFZ.db.valueQuery(sql, [secondary]);
	        if (!secondaryID) {
		        sqlinsert = "INSERT INTO strings VALUES (NULL, ?)";
		        AFZ.db.query(sqlinsert, [secondary]);
		        secondaryID = AFZ.db.valueQuery(sql, [secondary]);
	        }
            // add abbr to strings if necessary
	        sql = "SELECT strings.stringID AS abbrID FROM strings WHERE strings.string=?";
	        var abbrID = AFZ.db.valueQuery(sql, [info.abbr]);
	        if (!abbrID) {
		        sqlinsert = "INSERT INTO strings VALUES (NULL, ?)";
		        AFZ.db.query(sqlinsert, [info.abbr]);
		        abbrID = AFZ.db.valueQuery(sql, [info.abbr]);
	        }
            // add container phrase entries
	        sql = "SELECT phraseID FROM containerPhrase WHERE listID=? AND jurisdictionID=? AND primaryID=? AND secondaryID=?";
	        var phraseID = AFZ.db.valueQuery(sql, [info.listID, info.jurisdictionID, primaryID, secondaryID]);
            if (!phraseID) {
		        sqlinsert = "INSERT INTO containerPhrase VALUES (NULL, ?, ?, ?, ?, ?, ?)";
		        AFZ.db.query(sqlinsert, [info.listID, info.jurisdictionID, primaryID, secondaryLength, secondaryID, abbrID]);
            } else {
                // update instead
		        sql = "UPDATE containerPhrase SET abbrID=? WHERE listID=? AND jurisdictionID=? AND primaryID=? AND secondaryID=?";
		        params = [abbrID, info.listID, info.jurisdictionID, primaryID, secondaryID];
		        AFZ.db.query(sql,params);
            }

            runningTotal += 1;
            containerPhrasesAction(pos+1,limit,infos,json_obj);
            updateProgressMeter();
        }, 20);
    };

}
window.addEventListener("load", Abbrevs_Filter_Import.onLoad, false);
window.addEventListener("unload", Abbrevs_Filter_Import.onUnload, false);
window.addEventListener("abort", Abbrevs_Filter_Import.onUnload, false);
