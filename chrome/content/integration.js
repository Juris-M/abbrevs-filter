window.addEventListener("load", function () {

    var stringBundle = Cc["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService)
        .createBundle("chrome://abbrevs-filter/locale/overlay.properties")

	var AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Components.interfaces.nsISupports).wrappedJSObject;
	AbbrevsFilter.initWindow(window, document);

    var io = window.arguments[0].wrappedJSObject;

    io = {
        style:io.style,
        AFZ: AbbrevsFilter
    }
    io.wrappedJSObject = io;

    function processorIsLoaded() { 
        if (io.wrappedJSObject.style.registry.citationreg.citationByIndex.length) {
            return true;
        } else {
            return false;
        }
    }

    function makeButtonBox() {
	    var bx = document.createElement("hbox");
	    var button = document.createElement("button");
	    button.setAttribute("type", "button");
	    button.setAttribute("label", stringBundle.GetStringFromName('dialogLabel'));
	    button.setAttribute("id", "abbrevs-filter-dialog-button");
        if (!processorIsLoaded()) {
            button.setAttribute("disabled", "true");
        }
	    bx.appendChild(button);
        return bx;
    }

    function attachButton(bx) {
        var dialog = document.getElementById("zotero-add-citation-dialog");
        if (dialog) {
	        var vbox = document.getElementById("zotero-select-items-container");
	        dialog.insertBefore(bx, vbox);
        } else {
            bx.firstChild.setAttribute("style","padding: 0 6px 0 6px;margin: -1px 2px 0 2px;display: inline-block;line-height: normal;");
            searchBox = document.getElementById("quick-format-search");
            searchBox.insertBefore(bx, null);
        }
        return bx.firstChild;
    }

    var buttonbox = makeButtonBox();
    var button = attachButton(buttonbox);

    button.addEventListener("command", function() {
        window.openDialog('chrome://abbrevs-filter/content/dialog.xul', 
                          'AbbrevsFilterDialog', 
                          'chrome,centerscreen,alwaysRaised,modal',
                          io);
    });
}, false);
