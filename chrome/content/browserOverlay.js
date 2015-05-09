// Not wrapped in an onLoad function call, because we want this
// in place _before_ Zotero is initialized.
var Zotero = Components.classes["@zotero.org/Zotero;1"]
	.getService(Components.interfaces.nsISupports)
	.wrappedJSObject;
var AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Components.interfaces.nsISupports).wrappedJSObject;
AbbrevsFilter.attachGetAbbreviation(Zotero);
