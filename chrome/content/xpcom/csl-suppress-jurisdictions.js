AbbrevsFilter.prototype.attachGetSuppressJurisdictions = function() {

    var Zotero = this.Zotero;
    var CSL = Zotero.CiteProc.CSL;
    var _suppress = this._suppress;
    
    CSL.suppressJurisdictions = function (codeStr, humanStr) {
        var codeLst = codeStr.split(':');
        if (_suppress[codeLst[0]]) {
            humanStr = humanStr.split('|').slice(1).join('|');
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
