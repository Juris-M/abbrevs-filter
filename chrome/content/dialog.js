AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Components.interfaces.nsISupports).wrappedJSObject;

var Abbrevs_Filter_Dialog = new function () {

    var io = window.arguments[0]
    var style = io.style;
    var transform = io.style.transform;

    var AFZ = io.AFZ;
    var Zotero = AFZ.Zotero;
    var CSL = Zotero.CiteProc.CSL;
    var _suppress = AFZ.getSuppressJurisdictions(listname);
    var listname = style.opt.styleID;
    var listTitle = style.opt.styleName ? style.opt.styleName : style.opt.styleID;
    // This is not so good. AFZ values are global to the component,
    // so this will shift around as the user accesses different
    // open documents. Might do no harm, but it doesn't seem very clean.
    AFZ.listname = listname;

    var addOrDeleteEntry = AFZ.addOrDeleteEntry;

    this.init = init;
    this.handleJurisdictionAutoCompleteSelect = handleJurisdictionAutoCompleteSelect;
    this.saveField = saveField;

    var openFieldParent = null;


    // Strings and things.
    var stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService)
        .createBundle("chrome://abbrevs-filter/locale/overlay.properties")

    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService);
    prefs = prefs.getBranch("extensions.abbrevs-filter.");

    var category = prefs.getCharPref("currentCategory");

    function init() {

        var dialog = document.getElementById("abbrevs-filter-dialog");
        var categories = [];
        for (var value in style.transform.abbrevs["default"]) {
            if (["container-phrase", "title-phrase"].indexOf(value) > -1) {
                continue;
            }
            categories.push({value: value, label:stringBundle.GetStringFromName(value)});
        }

        categories.sort(function (a, b) {
            if (a.label > b.label) {
                return 1;
            } else if (a.label < b.label) {
                return -1;
            } else {
                return 0;
            }
        });

        buildResourceList();

        var switchSource = document.getElementById("switch-source");
        switchSource.addEventListener("click",switchSourceListener, false);

        if (!category) {
            category = "container-title";
        }

        var categoryMenu = document.getElementById("abbrevs-filter-category-menu");
        categoryMenu.setAttribute("type", "menu");
        categoryMenu.setAttribute("label", stringBundle.GetStringFromName(category));
        categoryMenu.setAttribute("value", category);
        categoryMenu.setAttribute("style", "margin-left:1em;");
        var categorymenupopup = document.createElement("menupopup");
        try {
            for (var i = 0, ilen = categories.length; i < ilen; i += 1) {
                var value = categories[i].value;
                var label = categories[i].label;
                var chld = document.createElement("menuitem");
                chld.setAttribute("label", label);
                chld.setAttribute("value", value);
                chld.addEventListener("click", function (event) {
                    try {
                        var node = event.target;
                        var mylabel = node.getAttribute("label");
                        var myvalue = node.getAttribute("value");
                        categoryMenu.setAttribute("label", mylabel);
                        categoryMenu.setAttribute("value", myvalue);
                        prefs.setCharPref("currentCategory", myvalue);
                        buildList(myvalue);
                    } catch (e) {
                        Zotero.debug("AFZ: [ERROR] failure while attempting to set current category: "+e);
                    }
                }, false);
                categorymenupopup.appendChild(chld);
            }
            categoryMenu.appendChild(categorymenupopup);
        } catch (e) {
            Zotero.debug("AFZ: [ERROR] failure while attempting to build category menu: "+e);
        }
        
        // Oh yes. The list name in the header.
        var listNameNode = document.getElementById("abbrevs-filter-list-name");
        listNameNode.setAttribute("value", listname);
        var listTitleNode = document.getElementById("abbrevs-filter-list-title");
        listTitleNode.setAttribute("value", listTitle);

        buildList(category);

        /*
         * Jurisdiction suppression UI initialization
         */

        for (var comment in _suppress) {
            setJurisdictionNode(comment, _suppress[comment]);
        }
        var suppressionAutocomplete = document.getElementById("suppression-autocomplete");
    }

    function handleJurisdictionAutoCompleteSelect (textbox) {
		var result;
		if (textbox.value) {
			// Comment is the tag code, value is the tag description
			result = getJurisdictionResult(textbox);
		}
        if (result) {
            setJurisdictionNode(result.comment,result.val);
            addToSuppressJurisdictions(result.comment);
        }
        textbox.value = '';
        textbox.blur();
    }

    function switchSourceListener(event) {
        // Do stuff
        var button = event.target;
        var resourceListMenu = document.getElementById("resource-list-menu");
        var resourceListPopup = document.getElementById("resource-list-popup");
        var fileForImport = document.getElementById("file-for-import");
        if (fileForImport.hidden) {
            button.setAttribute("value", "Input from file:");
            fileForImport.hidden = false;
            resourceListMenu.hidden = true;
        } else {
            button.setAttribute("value", "Input from defaults:");
            fileForImport.setAttribute('value','');
            fileForImport.hidden = true;
            resourceListMenu.hidden = false;
        }
    }

    function buildResourceList() {
        var popup = document.getElementById('resource-list-popup');
        var resLst = JSON.parse(Zotero.File.getContentsFromURL('resource://abbrevs-filter/abbrevs/DIRECTORY_LISTING.json'));
        for (var i=0,ilen=resLst.length;i<ilen;i+=1) {
            var info = resLst[i];
            var elem = document.createElement('menuitem');
            elem.setAttribute('value',info.filename);
            elem.setAttribute('label',info.name);
            popup.appendChild(elem)
        }
    }
    
    function openRow (parent) {

        // XXX This needs to show the jurisdiction on the left
        // read-only, just show it with some sort of highlight.

        var raw = parent.lastChild.previousSibling;
        var abbrev = parent.lastChild;
        // Set first child to wrap without truncation
        var rawval = raw.getAttribute("value");

        // Remap if in hereinafter, setting system_id
        var rawtext;
        if ("hereinafter" === category) {
            var key = raw.getAttribute("system_id");
            var libKeyObj = Zotero.Items.parseLibraryKeyHash(key);
            var entryItem, displayTitle;
            if (libKeyObj) {
                entryItem = Zotero.Items.getByLibraryAndKey(libKeyObj.libraryID, libKeyObj.key);
                displayTitle = entryItem.getDisplayTitle(true);
            } else {
                // Omit if this is not a real item.
                return;
            }
            rawtext = document.createTextNode(displayTitle);
        } else {
            rawtext = document.createTextNode(rawval);
        }
        raw.removeAttribute("value");
        raw.removeAttribute("crop");
        raw.appendChild(rawtext);
        
        // Save value, get rid of display box.
        var abbrevval = abbrev.getAttribute("value");
        parent.removeChild(abbrev);

        var inputbox = document.createElement("textbox");
        inputbox.setAttribute("value", abbrevval);
        inputbox.setAttribute("flex", "1");
        parent.appendChild(inputbox);
        inputbox.value = abbrevval;
        inputbox.selectionStart = abbrevval.length;
        inputbox.selectionEnd = abbrevval.length;
        inputbox.focus();
        //inputbox.addEventListener('blur', openCloseListener, false);
    }


    function saveField(event, parentArg) {
        // It looks like everything in this block is derived from parent
        // and event.
        
        // If so, we can move it to a function, call it here, and
        // call in from the Save button also. Maybe. Anyway, anything
        // that reduces the bulk of these silly functions is a step
        // forward.

        var type = event.type;

        if (!parentArg) {
            parent = openFieldParent;
        }
        if (!parent) {
            return;
        }

        var raw = parent.lastChild.previousSibling;
        var abbrev = parent.lastChild;

        if (type === "keypress" && parentArg) {

            switch (event.keyCode) {

            case event.DOM_VK_RETURN:
                event.preventDefault();
                break;
                
                // Later
            case event.DOM_VK_ESCAPE:
                abbrev.value = abbrev.getAttribute("value");
                break;
                
            case event.DOM_VK_TAB:
                if (event.shiftKey) {
                    var node = parent.previousElementSibling;
                } else {
                    var node = parent.nextElementSibling;
                }
                node._noBlurAction = true;
                openRow(node);
                return;
                
            default:
                return;
                
            }
        }

        var rawtext = raw.firstChild;

        // Use system_id if it exists (for hereinafter)
        rawval = rawtext.nodeValue;

        raw.removeChild(rawtext);
        raw.setAttribute("value", rawval);
        raw.setAttribute("crop", "end");
        
        var abbrevval = abbrev.value;
        parent.removeChild(abbrev);
        
        var jurisdiction = parent.firstChild.getAttribute("value");
        
        // Now rawval shifts to become the system_id
        if ("hereinafter" === category) {
            rawval = raw.getAttribute("system_id");
        }

        AFZ.addOrDeleteEntry(listname, jurisdiction, category, rawval, abbrevval);

        // Reverse remap hereinafter key here
        if ("hereinafter" === category) {
            var entryItem = Zotero.Items.parseLibraryKeyHash(rawval);
            if (entryItem) {
                entryItem = Zotero.Items.getByLibraryAndKey(entryItem.libraryID, entryItem.key);
            } else {
                entryItem = Zotero.Items.get(rawval);
            }
            rawval = entryItem.id;
        }

        // Assuming all of that went well, set value on memory object
        transform.abbrevs[jurisdiction][category][rawval] = abbrevval;
        
        var abbrevbox = document.createElement("description");
        abbrevbox.setAttribute("value", abbrevval);
        abbrevbox.setAttribute("flex", "1");
        abbrevbox.setAttribute("class", "zotero-clicky");
        parent.appendChild(abbrevbox);
    }

    function openCloseListener(event) {

        var type = event.type;
        try {
            var parent = event.currentTarget;
            
            if (parent.tagName !== "row") {
                parent = parent.parentNode;
            }
            
            var category = prefs.getCharPref("currentCategory");
            var jurisdiction = parent.firstChild.getAttribute("value");

            // Sniff the current state of the clicked object, set our parameter
            // to the opposite state.
            var action = false;
            var sniffnode = parent.lastChild;
            if ("description" === sniffnode.tagName) {
                action = "open";
            } else if ("textbox" === sniffnode.tagName) {
                action = "close";
            }

            // Click is for open only. [check]
            // Return should close in place. [check]
            // Escape should revert and close. [check]
            // Blur should save. [check]
            // Tab should open forward.
            // Shift-Tab should open backward.

            if ("click" === type && action === "close") {
                return;
            }

            if ("keypress" === type && action === "open") {
                return;
            }

            if ("blur" === type && parent._noBlurAction) {
                event.preventDefault();
                parent._noBlurAction = false;
                return;
            }
            
            if (action === "open") {
                openFieldParent = parent;
                openRow(parent);
            } else { // close
                info.openField = false;
                saveField(event, parent);
            }


        } catch (e) {
            Zotero.debug("AFZ: [ERROR] failure while attempting to save to database: "+e);
        }
    };

    // The actual list is built by this function.
    function buildList (category) {

        try {
            var abbreviationsContainer = document.getElementById("abbrevs-filter-abbrevs-list");
            for (var i = abbreviationsContainer.childNodes.length - 1; i > -1; i += -1) {
                abbreviationsContainer.removeChild(abbreviationsContainer.childNodes[i]);
            }

            // Ah, this has to move in two tiers.
            // XXX Hold on here. We only want to show the jurisdictions that are used.
            // XXX (Don't show default if it's not called anywhere)
            var keys = [];

            for (var jurisdiction in transform.abbrevs) {
                for (var key in transform.abbrevs[jurisdiction][category]) {
                    // Remap hereinafter key here
                    if ("hereinafter" === category) {
                        var entryItem = Zotero.Items.get(key);
                        key = (entryItem.libraryID ? entryItem.libraryID : 0) + "_" + entryItem.key;
                    }
                    keys.push([jurisdiction, key]);
                }
            }
            keys.sort(function(a,b){if (a[1] > b[1]) {return 1} else if (a[1] < b[1]) {return -1} else {return 0}});
            
            for (var i = 0, ilen = keys.length; i < ilen; i += 1) {
                var jurisdiction = keys[i][0];
                var key = keys[i][1];
                var row = document.createElement("row");
                row.setAttribute("maxheight", "300;");

                var rawlabel = document.createElement("label");
                rawlabel.setAttribute("value", jurisdiction);
                rawlabel.setAttribute("crop", "end");
                rawlabel.setAttribute("width", "100");
                rawlabel.setAttribute("tooltiptext", jurisdiction);
                row.appendChild(rawlabel);

                var rawbox = document.createElement("description");

                // Show displayTitle if hereinafter
                if ("hereinafter" === category) {
                    var entryItem = Zotero.Items.parseLibraryKeyHash(key)
                    entryItem = Zotero.Items.getByLibraryAndKey(entryItem.libraryID, entryItem.key);
                    var displayTitle = entryItem.getDisplayTitle(true);
                    rawbox.setAttribute("system_id", key);
                    rawbox.setAttribute("value", displayTitle);
                } else {
                    rawbox.setAttribute("value", key);
                }
                rawbox.setAttribute("crop", "end");
                rawbox.setAttribute("width", "330");
                rawbox.setAttribute("style", "background:#c8c8c8;padding:2px;");
                row.appendChild(rawbox);
                
                var abbrevbox = document.createElement("description");
                abbrevbox.setAttribute("crop", "end");
                abbrevbox.setAttribute("class", "zotero-clicky");

                // Remap hereinafter key here
                if ("hereinafter" === category) {
                    var entryItem = Zotero.Items.parseLibraryKeyHash(key);
                    if (entryItem) {
                        entryItem = Zotero.Items.getByLibraryAndKey(entryItem.libraryID, entryItem.key);
                    } else {
                        entryItem = Zotero.Items.get(key);
                    }
                    key = entryItem.id;
                }

                abbrevbox.setAttribute("value", transform.abbrevs[jurisdiction][category][key]);
                abbrevbox.setAttribute("flex", "1");
                
                row.appendChild(abbrevbox);
                abbreviationsContainer.appendChild(row);
                
                row.addEventListener('click', openCloseListener, false);
                row.addEventListener('keypress', openCloseListener, false);
            }
            var stretchbox = document.createElement("hbox");
            stretchbox.setAttribute("flex", "1");
            abbreviationsContainer.appendChild(stretchbox);
        } catch (e) {
            Zotero.debug("AFZ: [ERROR] failure while attempting to build category list: "+e);
        }
    }

    /*
     * Jurisdiction suppression UI utility functions
     */

    function setJurisdictionNode (comment,value) {
        var suppressionList = document.getElementById("suppression-list");
        var jurisdictionNode = document.createElement('label');
        jurisdictionNode.setAttribute('id','sj-' + comment.replace(':','-','g'));
        jurisdictionNode.setAttribute('value',value);
        jurisdictionNode.setAttribute('style','border:1px solid black;border-radius:6px;white-space:nowrap;background:white;padding: 0 6px 0 6px;cursor:pointer;');
        jurisdictionNode.addEventListener('click',function(event){
            var node = event.target;
            // Issue a yes/no popup with the jurisdiction name and its abbreviation in the current style list
            var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                .getService(Components.interfaces.nsIPromptService);
            var goAhead = promptService.confirm(window, "Allow this jurisdiction in cites", "Clicking OK will allow this jurisdiction to render in cites:\n\n   "+node.value);
            // Delete the node if the user says it is okay to do so
            if (goAhead) {
                node.parentNode.removeChild(node);
                var jurisdiction = node.id.slice(3).replace("-",":","g");
                removeFromSuppressJurisdictions(jurisdiction);
            }
        }, false);
        suppressionList.appendChild(jurisdictionNode);
    }

    function addToSuppressJurisdictions (jurisdiction) {
        // XXX Memory and DB
        var result = confirmJurisdictionValues(jurisdiction,listname);
        addJurisdictionValues(result);
        _suppress[jurisdiction] = true;
    }

    function removeFromSuppressJurisdictions (jurisdiction) {
        // XXX Memory and DB
        var result = confirmJurisdictionValues(jurisdiction,listname);
        removeJurisdictionValues(result);
        delete _suppress[jurisdiction];
    }

    function addJurisdictionValues(result) {
        var sql = "SELECT COUNT(*) FROM suppressme WHERE listID=? AND jurisdictionID=?";
        if (!AFZ.db.valueQuery(sql,[result.listID,result.jurisdictionID])) {
            var sql = "INSERT INTO suppressme VALUES (NULL,?,?)";
            AFZ.db.query(sql,[result.jurisdictionID,result.listID]);
        }
    };

    function removeJurisdictionValues(result) {
        var sql = "SELECT COUNT(*) FROM suppressme WHERE listID=? AND jurisdictionID=?";
        if (AFZ.db.valueQuery(sql,[result.listID,result.jurisdictionID])) {
            var sql = "DELETE FROM suppressme WHERE listID=? AND jurisdictionID=?";
            AFZ.db.query(sql,[result.listID,result.jurisdictionID]);
        }
    };

    function confirmJurisdictionValues (jurisdiction,styleID) {
        var ret = {};
        var check = checkDB('jurisdiction',jurisdiction);
        if (!check) {
            addDB('jurisdiction', jurisdiction);
        };
        ret.jurisdictionID = getDB('jurisdiction', jurisdiction);
        check = checkDB('list',styleID);
        if (!check) {
            addDB('list', styleID);
        }
        ret.listID = getDB('list', styleID);
        return ret;
    }


    function checkDB (arg, value) {
        var sql = "SELECT COUNT(*) FROM " + arg + " WHERE " + arg + "=?";
        var ret = AFZ.db.valueQuery(sql,[value]);
        return ret;
    }

    function addDB (arg, value) {
        var sql = "INSERT INTO " + arg + " VALUES(NULL,?);";
        AFZ.db.query(sql,[value]);
    }

    function getDB (arg, value) {
        var sql = "SELECT " + arg + "ID FROM " + arg + " WHERE " + arg + "=?;";
        return AFZ.db.valueQuery(sql,[value]);
    }

    /*
     * Event handlers for jurisdiction suppression autocomplete UI
     */

    function handleJurisdictionKeypress (event) {

		switch (event.keyCode) {
		case event.DOM_VK_ESCAPE:
		case event.DOM_VK_RETURN:
			event.preventDefault();
			event.target.blur();
			break;
		case event.DOM_VK_TAB:
			event.preventDefault();
			return true;
		}
		return false;
    }

    function getJurisdictionResult (textbox) {
		var controller = textbox.controller;
		for (var i=0; i<controller.matchCount; i++) {
			if (controller.getValueAt(i) == textbox.value) {
				return {val:controller.getValueAt(i),comment:controller.getCommentAt(i)};
			}
		}
		return false;
    }
}