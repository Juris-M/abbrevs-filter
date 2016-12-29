AbbrevsFilter.prototype.importList = function (window, document) {
    var sql, sqlinsert;
    var Zotero = this.Zotero;
	var listname = this.listname;
    
	var mode = document.getElementById("abbrevs-filter-import-options").selectedIndex;

    // Check to see which node is exposed to view
    var fileForImport = document.getElementById('file-for-import');
    var resourceListMenu = document.getElementById('resource-list-menu');
    var resourceListPopup = document.getElementById('resource-list-popup');
    var resourceListMenuValue = resourceListMenu.value;

	var json_str = "";

    if (!fileForImport.hidden && this.fileForImport) {
        var file = this.fileForImport;
        this.fileForImport = false;
		// work with returned nsILocalFile...
		// |file| is nsIFile
		var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
			.createInstance(Components.interfaces.nsIConverterInputStream);
		fstream.init(file, -1, 0, 0);
		cstream.init(fstream, "UTF-8", 0, 0);
		var str = {};
		var read = 0;
		do {
			read = cstream.readString(0xffffffff, str);
			json_str += str.value;
		} while (read != 0);
		cstream.close(); // this closes fstream
    } else if (!resourceListMenu.hidden && resourceListMenuValue) {
        json_str = Zotero.File.getContentsFromURL('resource://abbrevs-filter/abbrevs/' + resourceListMenuValue);
    }

    if (json_str) {
        // Follow-on condition here
        try {
            var spec = {};
            var listObj = JSON.parse(json_str);
            if (listObj.xdata) {
                listObj = listObj.xdata;
                spec[listname] = [[listObj,mode]];
            } else {
                var normalizedObjects = normalizeObjects(listObj);
                spec[listname] = [];
                for (var i=0,ilen=normalizedObjects.length;i<ilen;i++) {
                    var normalizedObject = normalizedObjects[i];
                    spec[listname].push([normalizedObject,mode]);
                }
            }
            var launchImportProgressMeter = this.launchImportProgressMeter;
            launchImportProgressMeter(spec);
        } catch (e) {
            Zotero.debug("AFZ: [ERROR] MLZ: failure attempting to import abbreviation list: "+e);
        }
	}
    window.close();

    function normalizeObjects(obj) {
        // Set a list in which to collect objects
        // Traverse until we find an object with conforming keys and string pairs.
        var collector = [];
        getValidObjects(collector,null,obj);
        return collector;
    }
    function getValidObjects(collector,jurisdiction,obj) {
        if (!obj || "object" !== typeof obj || obj.length) {
            // Protect against: null obj, obj without keys
            return;
        }
        // Check if obj contains only conforming keys
        if (jurisdiction && hasValidKeys(obj) && hasValidKeyValues(obj)) {
            // If so, sanitize the object and push into collector
            var newObj = {};
            sanitizeObject(obj);
            newObj[jurisdiction] = obj;
            collector.push(newObj);
        } else {
            // If this isn't an abbrevs object itself, check each of its keys
            for (var key in obj) {
                getValidObjects(collector,key,obj[key]);
            }
        }
    }
    function hasValidKeys(obj) {
        // Check that all keys are valid
        for (var key in obj) {
            if (isValidKey(key)) {
                return true;
            }
        }
        return false;
    }
    function isValidKey(key) {
        var validKeys = [
            "container-title",
            "collection-title",
            "institution-entire",
            "institution-part",
            "nickname",
            "number",
            "title",
            "place",
            "hereinafter",
            "classic",
            "container-phrase",
            "title-phrase"
        ]
        if (validKeys.indexOf(key) > -1) {
            return true;
        }
        return false;
    }
    function hasValidKeyValues(obj) {
        var ret = false;
        for (var key in obj) {
            if (!obj[key]) {
                continue;
            }
            for (var subkey in obj[key]) {
                if (obj[key][subkey] && "string" === typeof obj[key][subkey]) {
                    ret = true;
                }
            }
        }
        return ret;
    }
    function sanitizeObject(obj) {
        // Blindly purge invalid keys and subkeys that are not simple key/string pairs.
        for (var key in obj) {
            if (!obj[key] || !isValidKey(key)) {
                delete obj[key];
                continue;
            }
            for (var subkey in obj[key]) {
                if (!obj[key][subkey] || "string" !== typeof obj[key][subkey]) {
                    delete obj[key][subkey];
                }
            }
        }
    }
}
