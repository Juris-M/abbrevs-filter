// Getting abbreviations happens in two steps.
//
// A database call setCacheEntry(), to be issued in async iterator context,
//   pulls all key/value pairs that might be needed for a given
//   citation into a memory cache before the citation processor
//   is called.
//
// A synchronus getAbbreviation() function looks up specific
//   key/value pairs in the cache.

AbbrevsFilter.prototype.attachGetCachedAbbrevList = function () {
	CSL.getCachedAbbrevList = function(cslEngine) {
		cslEngine.transform.abbrevs = this.cachedAbbreviations;
	}.bind(this);
}

AbbrevsFilter.prototype.attachSetCachedAbbrevList = function () {
	CSL.setCachedAbbrevList = this.setCachedAbbrevList.bind(this);
}

AbbrevsFilter.prototype.attachSetCacheEntry = function () {
	CSL.setCacheEntry = this.setCacheEntry.bind(this);
}

AbbrevsFilter.prototype.attachPreloadAbbreviations = function () {
	Zotero.debug("XXX   attachPreloadAbbreviations");
	CSL.preloadAbbreviations = this.setCacheFromCitation.bind(this);
	Zotero.debug("XXX   OK");
}

AbbrevsFilter.prototype.attachGetAbbreviation = function () {
	CSL.getAbbreviation = this.getAbbreviation.bind(this);
}

AbbrevsFilter.prototype.attachSetSuppressJurisdictions = function() {
}

AbbrevsFilter.prototype.attachGetSuppressJurisdictions = function() {
}

AbbrevsFilter.prototype.attachGetSuppressJurisdictions = function() {
	
	// What the hell am I trying to do here? Seems to generate the
	// code-like jurisdiction strings that appear in our citations
	// by default. Can we provide something a little less alarmingly
	// ugly?
	
    this.Zotero.CiteProc.CSL.getSuppressedJurisdictionName = function (codeStr, humanStr) {
        if (!codeStr || !humanStr) {
            throw "AFZ: missing value for codeStr or humanStr in getSuppressedJurisdictionName()";
        }
        var codeLst = codeStr.split(':');
        var humanLst = humanStr.split("|");
        var isValid;
        if (codeLst.length == 1) {
            if (humanLst.length == 1) {
                humanLst = [humanLst[0], codeLst[0].toUpperCase()];                
            }
            isValid = (humanLst.length == 2 && humanLst[1] == codeLst[0].toUpperCase());
        } else {
            if (humanLst.length == codeLst.length-1 && humanLst[0].toLowerCase() != codeLst[0]) {
                humanLst = [codeLst[0].toUpperCase()].concat(humanLst);
            }
            isValid = (humanLst.length == codeLst.length && humanLst[0] == codeLst[0]);
        }
        if (isValid && this.opt.suppressedJurisdictions[codeLst[0]]) {
            if (codeLst.length == 1) {
                humanStr = humanLst.slice(2).join('|');
            } else {
                humanStr = humanLst.slice(1).join('|');
            }
        }
        return humanStr;
    }
}

AbbrevsFilter.prototype.attachSetSuppressJurisdictions = function() {

    var AbbrevsFilter = this;
    var Zotero = this.Zotero;
    var CSL = Zotero.CiteProc.CSL;
    
    CSL.setSuppressedJurisdictions = Zotero.Promise.coroutine(function* (styleID, suppressedJurisdictions) {
        var sql = "SELECT jurisdiction FROM suppressme "
            + "JOIN jurisdiction USING(jurisdictionID) "
            + "JOIN list USING(listID) "
            + "WHERE list=?;";
        var jurisdictionList = yield AbbrevsFilter.db.columnQueryAsync(sql,[styleID]);
        var results;
        if (jurisdictionList) {
            jurisdictionList = "'" + jurisdictionList.join("','") + "'";
		    var sql = 'SELECT jurisdictionName as val,jurisdictionID as comment FROM jurisdictions '
			    + 'WHERE jurisdictionID IN (' + jurisdictionList + ') ORDER BY jurisdictionName;'
            results = yield Zotero.DB.queryAsync(sql);
        } else {
            results = [];
        }
        for (var i=0,ilen=results.length;i<ilen;i+=1) {
            var result = results[i];
            suppressedJurisdictions[result.comment] = result.val;
        }
    });
}
