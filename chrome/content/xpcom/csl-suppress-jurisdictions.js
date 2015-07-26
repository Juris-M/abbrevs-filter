AbbrevsFilter.prototype.attachGetSuppressJurisdictions = function() {

    var Zotero = this.Zotero;
    var CSL = Zotero.CiteProc.CSL;
    var _suppress = this._suppress;
    
    CSL.suppressJurisdictions = function (codeStr, humanStr) {
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
        if (!isValid) return humanStr;
        if (_suppress[codeLst[0]]) {
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

    var Zotero = this.Zotero;
    var CSL = Zotero.CiteProc.CSL;
    var AbbrevsFilter = this;
    var _suppress = this._suppress;
    
    CSL.setSuppressJurisdictions = function(styleID) {
        for (var key in _suppress) {
            delete _suppress[key];
        }
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
            _suppress[result.comment] = result.val;
        }
    }
}
