const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

/*
 * Function to pick up Zotero and tinker with it.
 */

var Zotero;
var AbbrevsFilter;
var AbbrevsFilterFactory;
var AbbrevsService;


function ifZotero(succeed, fail) {
    var ZoteroClass = Cc["@zotero.org/Zotero;1"];
    if (ZoteroClass) {
        Zotero = ZoteroClass
	        .getService(Ci.nsISupports)
	        .wrappedJSObject;
        succeed ? succeed(Zotero) : null;
    } else {
        fail ? fail() : null;
    }
}

// Preferences
// From https://developer.mozilla.org/en-US/Add-ons/How_to_convert_an_overlay_extension_to_restartless
function getGenericPref(branch,prefName)
{
	switch (branch.getPrefType(prefName))
	{
    default:
    case 0:   return undefined;                      // PREF_INVALID
    case 32:  return getUCharPref(prefName,branch);  // PREF_STRING
    case 64:  return branch.getIntPref(prefName);    // PREF_INT
    case 128: return branch.getBoolPref(prefName);   // PREF_BOOL
	}
}
function setGenericPref(branch,prefName,prefValue)
{
	switch (typeof prefValue)
	{
	case "string":
		setUCharPref(prefName,prefValue,branch);
		return;
	case "number":
		branch.setIntPref(prefName,prefValue);
		return;
	case "boolean":
		branch.setBoolPref(prefName,prefValue);
		return;
	}
}
function setDefaultPref(prefName,prefValue)
{
	var defaultBranch = Services.prefs.getDefaultBranch(null);
	setGenericPref(defaultBranch,prefName,prefValue);
}
function getUCharPref(prefName,branch)  // Unicode getCharPref
{
	branch = branch ? branch : Services.prefs;
	return branch.getComplexValue(prefName, Components.interfaces.nsISupportsString).data;
}
function setUCharPref(prefName,text,branch)  // Unicode setCharPref
{
	var string = Components.classes["@mozilla.org/supports-string;1"]
        .createInstance(Components.interfaces.nsISupportsString);
	string.data = text;
	branch = branch ? branch : Services.prefs;
	branch.setComplexValue(prefName, Components.interfaces.nsISupportsString, string);
}


var initializePlugin = function(Zotero) {

	dump("XXX initializePlugin\n");
	if (AbbrevsService && AbbrevsFilterFactory) {
		const registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
		registrar.unregisterFactory(AbbrevsService.prototype.classID,
									AbbrevsFilterFactory);
	}
	dump("XXX OK\n");
	
	// Set up preferences
	Services.scriptloader.loadSubScript("chrome://abbrevs-filter/content/defaultprefs.js",
										{pref:setDefaultPref} );

	// Empty context for build
	var buildContext = {
		Zotero: Zotero
	};

	// Build and instantiate the component
	var xpcomFiles = [
		"component",
		"utils",
		"save",
		"cache",
		"getabbrev",
		"initializers",
		"attachers",
		"import",
		"export"
	];
	for (var i=0, ilen=xpcomFiles.length; i < ilen; i += 1) {
		Services.scriptloader.loadSubScript("chrome://abbrevs-filter/content/xpcom/" + xpcomFiles[i] + ".js", buildContext);
	}

	AbbrevsService = function () {
		this.wrappedJSObject = new buildContext.AbbrevsFilter();
	};

	// Define the service
	AbbrevsService.prototype = {
		classDescription: 'Juris-M Abbreviation Filter',
		contractID: '@juris-m.github.io/abbrevs-filter;1',
		classID: Components.ID("{e2731ad0-8426-11e0-9d78-0800200c5798}"),
		service: true,
		QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsISupports])
	}

	// Plugin factory
	AbbrevsFilterFactory = Object.freeze({
		createInstance: function(aOuter, aIID) {
			if (aOuter) { throw Cr.NS_ERROR_NO_AGGREGATION; }
			return new AbbrevsService();
		},
		loadFactory: function (aLock) { /* unused */ },
		QueryInterface: XPCOMUtils.generateQI([Ci.nsIFactory])
	});

	const registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
	registrar.registerFactory(AbbrevsService.prototype.classID,
							  AbbrevsService.prototype.classDescription,
							  AbbrevsService.prototype.contractID,
							  AbbrevsFilterFactory);

	AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Ci.nsISupports).wrappedJSObject;
	AbbrevsFilter.initComponent(Zotero);
}.bind(this);

var startupObserver = {
	observe: function(subject, topic, data) {
		ifZotero(
			function (Zotero) {
				initializePlugin(Zotero);
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

function domListener (event) {
	var doc = event.target;
	if (doc.getElementById("abbrevs-button")) return;

	// Conditions: Open CSL Editor or one of the integration plugins

	var Zotero = Cc["@zotero.org/Zotero;1"].getService(Ci.nsISupports).wrappedJSObject;

	if (doc.getElementById('abbrevs-button')) return;

	if (doc.documentElement.getAttribute('id') === 'csl-edit') {

		var Zotero = Cc["@zotero.org/Zotero;1"].getService(Ci.nsISupports).wrappedJSObject;


		var AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Components.interfaces.nsISupports).wrappedJSObject;
		AbbrevsFilter.initWindow(doc.defaultView, doc);

		var hasEngine = false;

		var refresh = doc.getElementById("preview-refresh-button");
		var cslmenu = doc.getElementById("zotero-csl-list");
		var csleditor = doc.getElementById("zotero-csl-editor");

		var button = doc.createElement("button");
		button.setAttribute("label", "Abbrevs.");
		button.setAttribute("id","abbrevs-button");
		button.setAttribute('disabled','true');
		cslmenu.parentNode.insertBefore(button, null);

		function attachStyleEngine () {
			if (hasEngine) return;
			var button = doc.getElementById('abbrevs-button');
			var items = Zotero.getActiveZoteroPane().getSelectedItems();
			if (items.length > 0) {
				button.removeAttribute('disabled');
				button.addEventListener("command", function() {
					var io = {
						style:csleditor.styleEngine,
						AFZ: AbbrevsFilter
					};
					io.wrappedJSObject = io;
					doc.defaultView.openDialog('chrome://abbrevs-filter/content/dialog.xul', 'AbbrevsFilterDialog', 'chrome,centerscreen,alwaysRaised,modal',io);
				}, false);
				hasEngine = true;
			}
		}
		attachStyleEngine();

		cslmenu.addEventListener("command", attachStyleEngine, false);
		refresh.addEventListener("command", attachStyleEngine, false);
		button.addEventListener("command", attachStyleEngine, false);

	} else if (doc.getElementById("zotero-add-citation-dialog") || doc.getElementById("quick-format-search")) {

		var stringBundle = Cc["@mozilla.org/intl/stringbundle;1"]
			.getService(Components.interfaces.nsIStringBundleService)
			.createBundle("chrome://abbrevs-filter/locale/overlay.properties")

		var AbbrevsFilter = Components.classes['@juris-m.github.io/abbrevs-filter;1'].getService(Components.interfaces.nsISupports).wrappedJSObject;
		AbbrevsFilter.initWindow(doc.defaultView, doc);

		var io = doc.defaultView.arguments[0].wrappedJSObject;

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
			var bx = doc.createElement("hbox");
			var button = doc.createElement("button");
			button.setAttribute("type", "button");
			button.setAttribute("label", stringBundle.GetStringFromName('dialogLabel'));
			button.setAttribute("id", "abbrevs-button");
			if (!processorIsLoaded()) {
				button.setAttribute("disabled", "true");
			}
			bx.appendChild(button);
			return bx;
		}

		function attachButton(bx) {
			var dialog = doc.getElementById("zotero-add-citation-dialog");
			if (dialog) {
				var vbox = doc.getElementById("zotero-select-items-container");
				dialog.insertBefore(bx, vbox);
			} else {
				bx.firstChild.setAttribute("style","padding: 0 6px 0 6px;margin: -1px 2px 0 2px;display: inline-block;line-height: normal;");
				searchBox = doc.getElementById("quick-format-search");
				searchBox.insertBefore(bx, null);
			}
			return bx.firstChild;
		}

		var buttonbox = makeButtonBox();
		var button = attachButton(buttonbox);

		button.addEventListener("command", function() {
			doc.defaultView.openDialog('chrome://abbrevs-filter/content/dialog.xul', 
									   'AbbrevsFilterDialog', 
									   'chrome,centerscreen,alwaysRaised,modal',
									   io);
		});
	}
	event.target.removeEventListener(event.type, arguments.callee);
}

var popupObserver = {
	observe: function(subject, topic, data) {
		var target = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
		target.addEventListener("DOMContentLoaded", domListener, false);
	},
	register: function() {
		var observerService = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
		observerService.addObserver(this, "chrome-document-global-created", false);
	},
	unregister: function() {
		var observerService = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
		observerService.removeObserver(this, "chrome-document-global-created");
	}
}

/*
 * Bootstrap functions
 */

function startup (data, reason) {
	dump("XXX startup\n");
	ifZotero(
		function (Zotero) {
			initializePlugin(Zotero);
			popupObserver.register();
		},
		function () {
			startupObserver.register();
			popupObserver.register();
		}
	)
	dump("XXX startup done\n");
};

function shutdown (data, reason) {
	dump("XXX shutdown\n");
	AbbrevsFilter.db.closeDatabase(true);
/*
	if (popupObserver.unregister) {
		popupObserver.unregister();
	}
	if (startupObserver.unregister) {
		startupObserver.unregister();
	}
	//AbbrevsFilter.db.closeDatabase();
	const registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
	registrar.unregisterFactory(AbbrevsService.prototype.classID,
								AbbrevsFilterFactory);
*/
	dump("XXX shutdown done\n");
}

function install (data, reason) {
}

function uninstall (data, reason) {
	dump("XXX uninstall\n");
	try {
		popupObserver.unregister();
	} catch (e) {}
	try {
		startupObserver.unregister();
	} catch (e) {}
	const registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
	registrar.unregisterFactory(AbbrevsService.prototype.classID,
								AbbrevsFilterFactory);
	dump("XXX uninstall done\n");
}
