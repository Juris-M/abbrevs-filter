AbbrevsFilter.prototype.initWindow = function (window, document) {
    if (!window.arguments) return;
    try {
	    var io = window.arguments[0].wrappedJSObject;
        this.io = io;
        var listname = io.style.opt.styleID;
	    this.categories = [];
	    for (var key in io.style.transform.abbrevs) {
		    this.categories.push(key);
	    }
	    this.categories.sort();
	    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService);
	    prefs = prefs.getBranch("extensions.abbrevs-filter.");
	    var category = prefs.getCharPref("currentCategory");
	    var transform = io.style.transform;
	    this.transform = transform;
	    // Strings and things.
	    stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
		    .getService(Components.interfaces.nsIStringBundleService)
		    .createBundle("chrome://abbrevs-filter/locale/overlay.properties")
	    if (!category) {
		    category = "container-title";
	    }
    } catch (e) {
        this.Zotero.debug("AFZ: [ERROR] failure while attempting to add UI to Zotero integration: "+e);
    }
}
