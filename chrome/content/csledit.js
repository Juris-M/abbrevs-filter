window.addEventListener("load", function () {

	AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Components.interfaces.nsISupports).wrappedJSObject;
	AbbrevsFilter.main(window, document);

	var refresh = document.getElementById("preview-refresh-button");
	var cslmenu = document.getElementById("zotero-csl-list");
	var csleditor = document.getElementById("zotero-csl-editor");

    var hasEngine = false;

	var button = document.createElement("button");
	button.setAttribute("label", "Abbrevs.");
	button.setAttribute("id","abbrevs-button");
    button.setAttribute('disabled','true');
	cslmenu.parentNode.insertBefore(button, null);

	function attachStyleEngine () {
        if (hasEngine) return;
        var button = document.getElementById('abbrevs-button');
        var items = Zotero.getActiveZoteroPane().getSelectedItems();
        if (items.length > 0) {
            button.removeAttribute('disabled');
	        button.addEventListener("command", function() {
		        var io = {
                    style:csleditor.styleEngine,
                    AFZ: AbbrevsFilter
                };
                window.openDialog('chrome://abbrevs-filter/content/subpopup.xul', 'AbbrevsFilterSubpopup', 'chrome,centerscreen,alwaysRaised,modal',io);
            }, false);
            hasEngine = true;
        }
	}

    attachStyleEngine();

	cslmenu.addEventListener("command", attachStyleEngine, false);
	refresh.addEventListener("command", attachStyleEngine, false);
    button.addEventListener("command", attachStyleEngine, false);

}, false);
