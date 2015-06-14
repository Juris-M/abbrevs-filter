window.addEventListener("load", function () {
	AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Components.interfaces.nsISupports).wrappedJSObject;
	AbbrevsFilter.initWindow(window, document);

    var hasEngine = false;

    // Strings and things.
    var stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService)
        .createBundle("chrome://abbrevs-filter/locale/overlay.properties")

    var dialog = document.getElementById("zotero-add-citation-dialog");
    
	var menubar = document.createElement("hbox");
	var button = document.createElement("button");
	button.setAttribute("type", "button");
	button.setAttribute("label", stringBundle.GetStringFromName('dialogLabel'));
	button.setAttribute("id", "abbrevs-filter-dialog-button");

    var AbbrevsFilter = this;
    var myio = {
        style:io.style,
        AFZ: AbbrevsFilter
    }
    if (!hasEngine) {
        button.addEventListener("command", function() {
            window.openDialog('chrome://abbrevs-filter/content/dialog.xul', 'AbbrevsFilterDialog', 'chrome,centerscreen,alwaysRaised,modal',myio);
        });
        hasEngine = true;
    }
	menubar.appendChild(button);
    if (dialog) {
	    var vbox = document.getElementById("zotero-select-items-container");
	    dialog.insertBefore(menubar, vbox);
    } else {
        button.setAttribute("style","padding: 0 6px 0 6px;margin: -1px 2px 0 2px;display: inline-block;line-height: normal;");
        searchBox = document.getElementById("quick-format-search");
        searchBox.insertBefore(button, null);
    }
}, false);

