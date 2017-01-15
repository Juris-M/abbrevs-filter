var Zotero = this.Zotero;
var CSL = Zotero.CiteProc.CSL;
this.citeproc = CSL;

// Install a custom abbreviations handler on the processor.
AbbrevsFilter.prototype.getAbbreviation = function (listname, obj, jurisdiction, category, key, itemType) {
	// Actually, no. We need to split jurisdiction, and iterate down to the first hit, if any.
	if (!obj[jurisdiction]) {
		obj[jurisdiction] = {};
	}
	if (!obj[jurisdiction][category]) {
		obj[jurisdiction][category] = {};
	}
	if (!obj[jurisdiction][category][key]) {
		obj[jurisdiction][category][key] = "";
	}
	return obj[jurisdiction][category][key];
}
