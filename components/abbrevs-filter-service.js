/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Frank G. Bennett, Jr.
                     Faculty of Law, Nagoya University, Japan
                     http://twitter.com/#!/fgbjr
    
    This file is part of Abbreviations for Zotero.
    
    Abbreviations for Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Abbreviations for Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

/*global Components: true, XPCOMUtils: true */

const Cc = Components.classes;
const Ci = Components.interfaces;

dump("XXX HELLO\n");


function ifZotero(succeed, fail) {
    var ZoteroClass = Cc["@zotero.org/Zotero;1"];
    if (ZoteroClass) {
        Zotero = ZoteroClass
	        .getService(Ci.nsISupports)
	        .wrappedJSObject;
        dump("XXX Found Zotero, yay\n");
        succeed ? succeed(Zotero) : null;
    } else {
        fail ? fail() : null;
    }
}
function UiObserver() {
    this.register();
}
UiObserver.prototype = {
    observe: function(subject, topic, data) {
        dump("XXX Triggered observer, yay\n");
        ifZotero(
            function (Zotero) {
                try {
                    var AFZ = Components.classes['@juris-m.github.io/abbrevs-filter;1']
                        .getService(Components.interfaces.nsISupports)
                        .wrappedJSObject;
                    dump("XXX Init abbrevs filter, yay\n");
                    AFZ.initComponent(Zotero);
                } catch (e) {
                    dump("XXX HOWDY: "+e+"\n");
                }
            },
            null
        );
    },
    register: function() {
        var observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);
        observerService.addObserver(this, "final-ui-startup", false);
    },
    unregister: function() {
        var observerService = Components.classes["@mozilla.org/observer-service;1"]
            .getService(Components.interfaces.nsIObserverService);
        observerService.removeObserver(this, "final-ui-startup");
    }
}
var uiObserver = new UiObserver();


var WrappedAbbrevsFilter = this;

Components.utils["import"]("resource://gre/modules/XPCOMUtils.jsm");
//Components.utils.import("resource://gre/modules/AddonManager.jsm");

var xpcomFiles = [
	"load",
    "update",
	"window",
    "style",
    "adddel",
    "csl-get-abbreviation",
    "csl-get-suppress-jurisdictions",
	"import",
	"export"
];

for (var i=0, ilen=xpcomFiles.length; i < ilen; i += 1) {
    dump("XXX LOADING: "+xpcomFiles[i]+"\n");
	Cc["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Ci.mozIJSSubScriptLoader)
		.loadSubScript("chrome://abbrevs-filter/content/xpcom/" + xpcomFiles[i] + ".js");
}

var AbbrevsFilter = new AbbrevsFilter();

/*
function setupService(){
	try {
		AbbrevsFilter.init();
	} catch (e) {
		var msg = typeof e == 'string' ? e : e.name;
		Components.utils.reportError(e);
		throw (e);
	}
}
*/

function AbbrevsFilterService() { 
	this.wrappedJSObject = WrappedAbbrevsFilter.AbbrevsFilter;
}

AbbrevsFilterService.prototype = {
    classDescription: 'Juris-M Abbreviation Filter',
    classID:          Components.ID("{e2731ad0-8426-11e0-9d78-0800200c5798}"),
    contractID:       '@juris-m.github.io/abbrevs-filter;1',
    service: true,
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupports])
};

if (XPCOMUtils.generateNSGetFactory) {
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([AbbrevsFilterService]);
} else {
	var NSGetModule = XPCOMUtils.generateNSGetModule([AbbrevsFilterService]);
}
