AbbrevsFilter.prototype.main = function (window, document) {
    if (!window.arguments) return;
	var Zotero = this.Zotero;
    try {
        var hasEngine = false;
	    var io = window.arguments[0].wrappedJSObject;
        this.io = io;
        var listname = io.style.opt.styleID;

	    var dialog = document.getElementById("zotero-add-citation-dialog");

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
	    
	    // Putting it all together.
	    var menubar = document.createElement("hbox");
	    var button = document.createElement("button");
	    button.setAttribute("type", "button");
	    button.setAttribute("label", stringBundle.GetStringFromName('subpopupLabel'));
	    button.setAttribute("id", "abbrevs-filter-subpopup-button");
        var AbbrevsFilter = this;
        var myio = {
            style:io.style,
            AFZ: AbbrevsFilter

        }
        if (!hasEngine) {
            button.addEventListener("command", function() {
                window.openDialog('chrome://abbrevs-filter/content/subpopup.xul', 'AbbrevsFilterSubpopup', 'chrome,centerscreen,alwaysRaised',myio);
            });
            hasEngine = true;
        }
	    menubar.appendChild(button);
	    //menubar.appendChild(button);
	    
        if (dialog) {
	        var vbox = document.getElementById("zotero-select-items-container");
	        dialog.insertBefore(menubar, vbox);
        } else {
            button.setAttribute("style","padding: 0 6px 0 6px;margin: -1px 2px 0 2px;display: inline-block;line-height: normal;");
            searchBox = document.getElementById("quick-format-search");
            searchBox.insertBefore(button, null);
        }
    } catch (e) {
        this.Zotero.debug("AFZ: [ERROR] failure while attempting to add UI to Zotero integration: "+e);
    }
}
