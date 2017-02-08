AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Components.interfaces.nsISupports).wrappedJSObject;

var Abbrevs_Filter_Dialog = new function () {

    // Strings and things.
    var stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService)
        .createBundle("chrome://abbrevs-filter/locale/overlay.properties")

    // Prefs
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefService)
        .getBranch("extensions.abbrevs-filter.");

    var io = window.arguments[0].wrappedJSObject;

    this.handleJurisdictionAutoCompleteSelect = handleJurisdictionAutoCompleteSelect;
	this.init = init;

    var style = io.style;
    var transform = io.style.transform;
    var listname = style.opt.styleID;
    var listTitle = style.opt.styleName ? style.opt.styleName : style.opt.styleID;

    var AFZ = io.AFZ;
    // Used by import, export
    AFZ.listname = listname;
    var Zotero = AFZ.Zotero;
    var CSL = Zotero.CiteProc.CSL;
    var saveEntry = AFZ.saveEntry;

    var category = prefs.getCharPref("currentCategory");
    if (!category) {
        category = "container-title";
        prefs.setCharPref("currentCategory", "container-title");
    }

    // Huh?
    var openFieldParent = null;

    function init () {
		Zotero.Promise.spawn(function* () {
			setTitle(listname, listTitle);
		
			populateCategoryMenu();
			setupCurrentCategoryList(category);
			
			buildResourceList();
			setImportSourceSelect();
			
			/*
			 * Jurisdiction suppression UI initialization
			 */
			
			for (var jurisdictionCode in io.style.opt.suppressedJurisdictions) {
				yield setJurisdictionNode(jurisdictionCode, io.style.opt.suppressedJurisdictions[jurisdictionCode]);
			}
		}, this);
	}

    function setTitle(listname, listTitle) {
        var listNameNode = document.getElementById("abbrevs-filter-list-name");
        listNameNode.setAttribute("value", listname);
        var listTitleNode = document.getElementById("abbrevs-filter-list-title");
        listTitleNode.setAttribute("value", listTitle);
    }

    function populateCategoryMenu() {
        var categoryMenu = document.getElementById("abbrevs-filter-category-menu");
        var categorymenupopup = document.createElement("menupopup");
        var categories = getCategories();
        for (var i = 0, ilen = categories.length; i < ilen; i += 1) {
            var value = categories[i].value;
            var label = categories[i].label;
            var chld = document.createElement("menuitem");
            chld.setAttribute("label", label);
            chld.setAttribute("value", value);
            chld.addEventListener("click", function (event) {
                var node = event.target;
                var category = node.getAttribute("value");
                setupCurrentCategoryList(category);
            }, false);
            categorymenupopup.appendChild(chld);
        }
        categoryMenu.appendChild(categorymenupopup);
    }
	
    function setCurrentCategory(category) {
        prefs.setCharPref("currentCategory", category);
        var categoryMenu = document.getElementById("abbrevs-filter-category-menu");
        categoryMenu.setAttribute("type", "menu");
        categoryMenu.setAttribute("label", stringBundle.GetStringFromName(category));
        categoryMenu.setAttribute("value", category);
        categoryMenu.setAttribute("style", "margin-left:1em;");
    }

    function emptyAbbreviationsList() {
        var abbreviationsContainer = document.getElementById("abbrevs-filter-abbrevs-list");
        for (var i = abbreviationsContainer.childNodes.length - 1; i > -1; i += -1) {
            abbreviationsContainer.removeChild(abbreviationsContainer.childNodes[i]);
        }
        return abbreviationsContainer;
    }

    function setupCurrentCategoryList (category) {
        setCurrentCategory(category);
        try {
            var abbreviationsContainer = emptyAbbreviationsList();
            var keys = getAbbreviationKeys(category);
            for (var i = 0, ilen = keys.length; i < ilen; i += 1) {
                var jurisdictionCode = keys[i][0];
                var key = keys[i][1];

                var row = writeDataToClosedRow(listname, jurisdictionCode, category, key);
                abbreviationsContainer.appendChild(row);
                row.addEventListener('click', openRow, false);
            }
            var stretchbox = document.createElement("hbox");
            stretchbox.setAttribute("flex", "1");
            abbreviationsContainer.appendChild(stretchbox);
        } catch (e) {
            Zotero.debug("AFZ: [ERROR] failure while attempting to build category list: "+e);
        }
    }

    function getAbbreviationKeys(category) {
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
        return keys;
    }

    function getCategories() {
        var categories = [];
        for (var value in style.transform.abbrevs["default"]) {
            if (["container-phrase", "title-phrase"].indexOf(value) > -1) {
                continue;
            }
            categories.push({value: value, label:stringBundle.GetStringFromName(value)});
        }
        categories.sort(labelSort);
        return categories;
    }

    function labelSort(a,b) {
        if (a.label > b.label) {
            return 1;
        } else if (a.label < b.label) {
            return -1;
        } else {
            return 0;
        }
    }

    function setImportSourceSelect() {
        var sourceSwitcher = document.getElementById("switch-source");
        sourceSwitcher.addEventListener("click",importSourceSelectHandler, false);
    }

    function importSourceSelectHandler(event) {
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

    function writeDataToClosedRow(listname, jurisdictionCode, category, key) {
        // Node order is: listname, jurisdiction, category, raw, abbrev

        // Row
        var row = document.createElement("row");
        row.setAttribute("maxheight", "300;");

        // Listname
        addHiddenNode(row, listname);
        
        // Jurisdiction
        var rawlabel = document.createElement("label");
		var jurisdictionName = Zotero.CachedJurisdictionData.jurisdictionNameFromId(jurisdictionCode);
        rawlabel.setAttribute("value", jurisdictionName);
        rawlabel.setAttribute("crop", "end");
        //rawlabel.setAttribute("width", "100");
        //rawlabel.setAttribute("tooltiptext", jurisdiction);
        row.appendChild(rawlabel);

        // Category
        addHiddenNode(row, category);

        // Raw (key)
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
        
        // Abbrev
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
        abbrevbox.setAttribute("value", transform.abbrevs[jurisdictionCode][category][key]);
        //abbrevbox.setAttribute("flex", "1");
        row.appendChild(abbrevbox);
        
        return row;
    }

    function readDataFromClosedRow(row) {
        var data = {};
        data.rawNode = row.lastChild.previousSibling;
        data.rawVal = data.rawNode.getAttribute("value");
        data.abbrevNode = row.lastChild;
        data.abbrevVal = data.abbrevNode.getAttribute("value");
        data.categoryVal = row.firstChild.nextSibling.nextSibling.getAttribute("value");
        return data;
    }

    function openRow (event) {
        var row = event.currentTarget;

        var data = readDataFromClosedRow(row);

/*
        // Remap if in hereinafter, setting system_id
        var rawtext;
        if ("hereinafter" === data.categoryVal) {

            var key = data.rawNode.getAttribute("system_id");
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
            rawtext = document.createTextNode(data.rawVal);
        }
        data.rawNode.removeAttribute("value");
        data.rawNode.removeAttribute("crop");
        data.rawNode.appendChild(rawtext);
*/  
      
        // Remove display box.
        row.removeChild(data.abbrevNode);

        // Create input box
        var inputbox = document.createElement("textbox");
        inputbox.setAttribute("value", data.abbrevVal);
        //inputbox.setAttribute("flex", "1");
        row.appendChild(inputbox);
        inputbox.value = data.abbrevVal;
        inputbox.selectionStart = data.abbrevVal.length;
        inputbox.selectionEnd = data.abbrevVal.length;

        // Save on blur
        inputbox.addEventListener("blur", blurHandler, false);
        // Blur on enter
        inputbox.addEventListener("keypress", keypressHandler, false);
        // Proceed (blurring) on tab

        inputbox.focus();
    }

    function keypressHandler(event) {
        var row = event.currentTarget.parentNode;

        switch (event.keyCode) {
            
        case event.DOM_VK_RETURN:
            event.preventDefault();
            event.currentTarget.blur();
            break;
            
            // Later
        case event.DOM_VK_ESCAPE:
            event.preventDefault();
            var data = readDataFromOpenRow(row);
            data.abbrevNode.value = data.abbrevNode.getAttribute("value");
            event.currentTarget.blur();
            break;
            
        default:
            return;
            
        }
    }

    function readDataFromOpenRow(row) {
        var data = {};
        data.listnameVal = row.firstChild.getAttribute("value");
        data.jurisdictionVal = row.firstChild.nextSibling.getAttribute("value");
        data.categoryVal = row.firstChild.nextSibling.nextSibling.getAttribute("value");
        data.rawNode = row.lastChild.previousSibling;
        //data.rawNodeTextNode = data.rawNode.firstChild;
        //data.rawVal = data.rawNodeTextNode.nodeValue;
        data.rawVal = data.rawNode.nodeValue;
        data.abbrevNode = row.lastChild;
        data.abbrevVal = data.abbrevNode.value;
        return data;
    }

    function blurHandler(event) {
        var row = event.currentTarget.parentNode;
        var data = readDataFromOpenRow(row);

        // Shorten view of key
        //data.rawNode.removeChild(data.rawNodeTextNode);
        //data.rawNode.setAttribute("value", data.rawVal);
        //data.rawNode.setAttribute("crop", "end");
        
        row.removeChild(data.abbrevNode);
        
        // Now rawval shifts to become the system_id
        if ("hereinafter" === data.categoryVal) {
             data.rawVal = data.rawNode.getAttribute("system_id");
        }
		
		var jurisdictionCode = Zotero.CachedJurisdictionData.jurisdictionIdFromName(data.jurisdictionVal);
		
        AFZ.saveEntry(data.listnameVal, jurisdictionCode, data.categoryVal, data.rawVal, data.abbrevVal);

        // Reverse remap hereinafter key here
        if ("hereinafter" === data.categoryVal) {
            var entryItem = Zotero.Items.parseLibraryKeyHash(data.rawVal);
            if (entryItem) {
                entryItem = Zotero.Items.getByLibraryAndKey(entryItem.libraryID, entryItem.key);
            } else {
                entryItem = Zotero.Items.get(data.rawVal);
            }
            data.rawVal = entryItem.id;
        }

        // Assuming all of that went well, set value on memory object
        transform.abbrevs[jurisdictionCode][data.categoryVal][data.rawVal] = data.abbrevVal;
        
        var abbrevbox = document.createElement("description");
        abbrevbox.setAttribute("value", data.abbrevVal);
        abbrevbox.setAttribute("flex", "1");
        abbrevbox.setAttribute("class", "zotero-clicky");
        row.appendChild(abbrevbox);
    }

    function addHiddenNode(row, value) {
        var node = document.createElement("label");
        node.setAttribute("value", value);
        node.setAttribute("hidden", "true");
        row.appendChild(node);
    }

    function handleJurisdictionAutoCompleteSelect (textbox) {
		return Zotero.spawn(function* () {
			var result;
			if (textbox.value) {
				// Comment is the tag code, value is the tag description
				result = getJurisdictionResult(textbox);
			}
			if (result) {
				yield setJurisdictionNode(result.comment,result.val);
				yield addToSuppressJurisdictions(result.comment, result.val);
			}
			textbox.value = '';
			textbox.blur();
		})
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
    
	function importChooseSourceFile () {
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
		fp.init(window, "Select a JSON file containing list data for import", nsIFilePicker.modeOpen);
		fp.appendFilter("JSON data", "*.json");
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
			this.fileForImport = fp.file;
			var elem = document.getElementById("file-for-import");
			elem.setAttribute('value',fp.file.path);
		}
	}

    /*
     * Jurisdiction suppression UI utility functions
     */

    var setJurisdictionNode = Zotero.Promise.coroutine(function* (comment,value) {
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
                yield removeFromSuppressJurisdictions(jurisdiction);
            }
        }, false);
        suppressionList.appendChild(jurisdictionNode);
    });

	var addToSuppressJurisdictions = Zotero.Promise.coroutine(function* (jurisdiction, jurisdictionName) {
		// XXX Memory and DB
		var result = yield confirmJurisdictionValues(jurisdiction,listname);
		yield addJurisdictionValues(result);
		io.style.opt.suppressedJurisdictions[jurisdiction] = jurisdictionName;
	});
	
    var removeFromSuppressJurisdictions = Zotero.Promise.coroutine(function* (jurisdiction) {
        // XXX Memory and DB
        var result = yield confirmJurisdictionValues(jurisdiction,listname);
        yield removeJurisdictionValues(result);
        delete io.style.opt.suppressedJurisdictions[jurisdiction];
    });
	
    var addJurisdictionValues = Zotero.Promise.coroutine(function* (result) {
		AFZ.db.executeTransaction(function* () {
			var sql = "SELECT COUNT(*) FROM suppressme WHERE listID=? AND jurisdictionID=?";
			var count = yield AFZ.db.valueQueryAsync(sql,[result.listID,result.jurisdictionID]);
			if (!count) {
				var sql = "INSERT INTO suppressme VALUES (NULL,?,?)";
				AFZ.db.queryAsync(sql,[result.jurisdictionID,result.listID]);
			}
		});
    });
	
    var removeJurisdictionValues = Zotero.Promise.coroutine(function* (result) {
		AFZ.db.executeTransaction(function* () {
			var sql = "SELECT COUNT(*) FROM suppressme WHERE listID=? AND jurisdictionID=?";
			if (AFZ.db.valueQueryAsync(sql,[result.listID,result.jurisdictionID])) {
				var sql = "DELETE FROM suppressme WHERE listID=? AND jurisdictionID=?";
				AFZ.db.queryAsync(sql,[result.listID,result.jurisdictionID]);
			}
		});
    });
	
    var confirmJurisdictionValues = Zotero.Promise.coroutine(function* (jurisdiction,styleID) {
        var ret = {};
        var check = yield checkDB('jurisdiction',jurisdiction);
        if (!check) {
            yield addDB('jurisdiction', jurisdiction);
        };
        ret.jurisdictionID = yield getDB('jurisdiction', jurisdiction);
        check = yield checkDB('list',styleID);
        if (!check) {
            yield addDB('list', styleID);
        }
        ret.listID = yield getDB('list', styleID);
        return ret;
    });
	
    var checkDB = Zotero.Promise.coroutine(function* (arg, value) {
        var sql = "SELECT COUNT(*) FROM " + arg + " WHERE " + arg + "=?";
        var ret = yield AFZ.db.valueQueryAsync(sql,[value]);
        return ret;
    });
	
    var addDB = Zotero.Promise.coroutine(function* (arg, value) {
		AFZ.db.executeTransaction(function* () {
			var sql = "INSERT INTO " + arg + " VALUES(NULL,?);";
			AFZ.db.queryAsync(sql,[value]);
		});
    });
	
    var getDB = Zotero.Promise.coroutine(function* (arg, value) {
        var sql = "SELECT " + arg + "ID FROM " + arg + " WHERE " + arg + "=?;";
        ret = yield AFZ.db.valueQueryAsync(sql,[value]);
		return ret;
    });
	
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
