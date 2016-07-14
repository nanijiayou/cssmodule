/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var path = require("path");
var utils = require("./utils");

exports.getLocalIdent = function (loaderContext, localIdentName, localName, options) {
	if(!options.context)
		options.context = loaderContext.options && typeof loaderContext.options.context === "string" ? loaderContext.options.context : loaderContext.context;
	var request = path.relative(options.context, loaderContext.resourcePath);
	options.content = options.hashPrefix + request + "+" + localName;
	localIdentName = localIdentName.replace(/\[local\]/gi, localName);
	var hash = utils.interpolateName(loaderContext, localIdentName, options);
	return hash.replace(new RegExp("[^a-zA-Z0-9\\-_\u00A0-\uFFFF]", "g"), "-").replace(/^([^a-zA-Z_])/, "_$1");
};
