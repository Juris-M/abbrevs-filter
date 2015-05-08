AbbrevsFilter.prototype.attachGetSuppressJurisdictions = function() {

    var CSL = Zotero.CiteProc.CSL;
    var AbbrevsFilter = this;
    var Zotero = this.Zotero;
    var db = this.db;
    var _suppress = this._suppress;
    
    CSL.suppressJurisdictions = function (codeStr, humanStr) {
        var codeLst = codeStr.split(':');
        if (_suppress[codeLst[0]]) {
            humanStr = humanStr.split('|').slice(1).join('|');
        }
    }
}
