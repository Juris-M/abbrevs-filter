AbbrevsFilter.prototype.attachGetSuppressJurisdictions = function() {

    this.Zotero.CiteProc.CSL.getSuppressedJurisdictionName = function (codeStr, humanStr) {
        if (!codeStr || !humanStr) {
            throw "AFZ: missing value for codeStr or humanStr in getSuppressJurisdictionName()";
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
    var listname = this.citeproc.opt.styleID;
    
    CSL.setSuppressedJurisdictions = function(styleID, suppressedJurisdictions) {
        var sql = "SELECT jurisdiction FROM suppressme "
            + "JOIN jurisdiction USING(jurisdictionID) "
            + "JOIN list USING(listID) "
            + "WHERE list=?;";
        var jurisdictionList = AbbrevsFilter.db.columnQuery(sql,[styleID]);
        var results;
        if (jurisdictionList) {
            jurisdictionList = "'" + jurisdictionList.join("','") + "'";
		    var sql = 'SELECT jurisdictionName as val,jurisdictionID as comment FROM jurisdictions '
			    + 'WHERE jurisdictionID IN (' + jurisdictionList + ') ORDER BY jurisdictionName;'
            results = Zotero.DB.query(sql);
        } else {
            results = [];
        }
        for (var i=0,ilen=results.length;i<ilen;i+=1) {
            var result = results[i];
            suppressedJurisdictions[result.comment] = result.val;
        }
    }
}
