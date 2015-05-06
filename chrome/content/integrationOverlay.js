window.addEventListener("load", function () {
	AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Components.interfaces.nsISupports).wrappedJSObject;
	AbbrevsFilter.main(window, document);
}, false);
