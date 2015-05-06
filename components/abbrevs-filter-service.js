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

var WrappedAbbrevsFilter = this;

dump("XXX DUMP (1)!\n");

Components.utils["import"]("resource://gre/modules/XPCOMUtils.jsm");

var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                         .getService(Components.interfaces.nsIXULAppInfo);
if(appInfo.platformVersion[0] >= 2) {
	Components.utils.import("resource://gre/modules/AddonManager.jsm");
}

var xpcomFiles = [
	"load",
	"main",
    "getabbr",
	"import",
	"export"
];

dump("XXX DUMPx (2)!\n");

for (var i=0, ilen=xpcomFiles.length; i < ilen; i += 1) {
	dump("XXX Load " + xpcomFiles[i] + ".js (or die trying)\n");
	//try {
		Cc["@mozilla.org/moz/jssubscript-loader;1"]
			.getService(Ci.mozIJSSubScriptLoader)
			.loadSubScript("chrome://abbrevs-filter/content/xpcom/" + xpcomFiles[i] + ".js");
	//}
	//catch (e) {
	//	dump("Error loading " + xpcomFiles[i] + ".js\n");
	//	Components.utils.reportError("Error loading " + xpcomFiles[i] + ".js");
	//	throw (e);
	//}
}

dump("XXX DUMPx (3)!\n");


var AbbrevsFilter = new AbbrevsFilter();

function setupService(){
	try {
		AbbrevsFilter.init();
	} catch (e) {
		var msg = typeof e == 'string' ? e : e.name;
		Components.utils.reportError(e);
		throw (e);
	}
}

dump("XXX DUMP (4)!\n");


function AbbrevsFilterService() { 
	this.wrappedJSObject = WrappedAbbrevsFilter.AbbrevsFilter;
	setupService();
}

dump("XXX DUMP (5)!\n");

AbbrevsFilterService.prototype = {
  classDescription: 'Juris-M Abbreviation Filter',
  classID:          Components.ID("{e2731ad0-8426-11e0-9d78-0800200c5798}"),
  contractID:       '@juris-m.github.io/abbrevs-filter;1',
  service: true,
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupports])
};

dump("XXX DUMP (6)!\n");

if (XPCOMUtils.generateNSGetFactory) {
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([AbbrevsFilterService]);
} else {
	var NSGetModule = XPCOMUtils.generateNSGetModule([AbbrevsFilterService]);
}
