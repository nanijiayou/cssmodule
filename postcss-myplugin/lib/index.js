var postcss       = require("postcss");
var utils         = require("./utils");
var getLocalIdent = require("./getLocalIdent");

var modulesScope   = require("postcss-modules-scope");
var modulesValues  = require("postcss-modules-values");
var Tokenizer      = require("css-selector-tokenizer");
var extractImports = require("postcss-modules-extract-imports");
var localByDefault = require("postcss-modules-local-by-default");

function pre(css, result) {
    var imports = {};
    var exports = {};
    var importItems = [];
    var urlItems = [];

    function replaceImportsInString(str) {
        if(options.import) {
            var tokens = str.split(/(\S+)/);
            tokens = tokens.map(function (token) {
                var importIndex = imports["$" + token];
                if(typeof importIndex === "number") {
                    return "___CSS_LOADER_IMPORT___" + importIndex + "___";
                }
                return token;
            });
            return tokens.join("");
        }
        return str;
    }

    if(options.import) {
        css.walkAtRules("import", function(rule) {
            var values = Tokenizer.parseValues(rule.params);
            var url = values.nodes[0].nodes[0];
            if(url.type === "url") {
                url = url.url;
            } else if(url.type === "string") {
                url = url.value;
            } else throw rule.error("Unexpected format" + rule.params);
            values.nodes[0].nodes.shift();
            var mediaQuery = Tokenizer.stringifyValues(values);
            if(utils.isUrlRequest(url, options.root) && options.mode === "global") {
                url = utils.urlToRequest(url, options.root);
            }
            importItems.push({
                url: url,
                mediaQuery: mediaQuery
            });
            rule.remove();
        });
    }

    css.walkRules(function(rule) {
        if(rule.selector === ":export") {
            rule.walkDecls(function(decl) {
                exports[decl.prop] = decl.value;
            });
            rule.remove();
        } else if(/^:import\(.+\)$/.test(rule.selector)) {
            var match = /^:import\((.+)\)$/.exec(rule.selector);
            var url = utils.parseString(match[1]);
            rule.walkDecls(function(decl) {
                imports["$" + decl.prop] = importItems.length;
                importItems.push({
                    url: url,
                    export: decl.value
                });
            });
            rule.remove();
        }
    });

    Object.keys(exports).forEach(function(exportName) {
        exports[exportName] = replaceImportsInString(exports[exportName]);
    });

    function processNode(item) {
        switch (item.type) {
            case "value":
                item.nodes.forEach(processNode);
                break;
            case "nested-item":
                item.nodes.forEach(processNode);
                break;
            case "item":
                var importIndex = imports["$" + item.name];
                if (typeof importIndex === "number") {
                    item.name = "___CSS_LOADER_IMPORT___" + importIndex + "___";
                }
                break;
            case "url":
                if (options.url && !/^#/.test(item.url) && utils.isUrlRequest(item.url, options.root)) {
                    item.stringType = "";
                    delete item.innerSpacingBefore;
                    delete item.innerSpacingAfter;
                    var url = item.url;
                    item.url = "___CSS_LOADER_URL___" + urlItems.length + "___";
                    urlItems.push({
                        url: url
                    });
                }
                break;
        }
    }

    css.walkDecls(function(decl) {
        var values = Tokenizer.parseValues(decl.value);
        values.nodes.forEach(function(value) {
            value.nodes.forEach(processNode);
        });
        decl.value = Tokenizer.stringifyValues(values);
    });
    css.walkAtRules(function(atrule) {
        if(typeof atrule.params === "string") {
            atrule.params = replaceImportsInString(atrule.params);
        }
    });

    options.importItems = importItems;
    options.urlItems = urlItems;
    options.exports = exports;

};

module.exports = postcss.plugin("myplugin", function(options) {
    return function (css) {

        var inputMap = options.initMap;
        var root = options.root;
        var mode = options.mode;
        var context = options.context;
        var localIdentName = options.hash;
        var localIdentRegExp = options.localIdentRegExp;
        var minimize = false;
        var url = options.url;
        
        var pipeline = postcss([
            localByDefault({
                mode: mode,
                rewriteUrl: function(global, url) {
                    if(url){
                        if(!utils.isUrlRequest(url, root)) {
                            return url;
                        }
                        if(global) {
                            return utils.urlToRequest(url, root);
                        }
                    }
                    return url;
                }
            }),
            extractImports(),
            modulesValues,
            modulesScope({
                generateScopedName: function(exportName) {
                    return getLocalIdent(options.loaderContext, localIdentName, exportName, {
                        regExp: localIdentRegExp,
                        hashPrefix: query.hashPrefix || "",
                        context: context
                    });
                }
            }),
            //parserPlugin(parserOptions)
        ]);

        if(minimize) {
            var minimizeOptions = assign({}, query);
            ["zindex", "normalizeUrl", "discardUnused", "mergeIdents", "reduceIdents"].forEach(function(name) {
                if(typeof minimizeOptions[name] === "undefined")
                    minimizeOptions[name] = false;
            });
            pipeline.use(cssnano(minimizeOptions));
        }
        console.log("/css-loader!" + options.from, options.to);
        pipeline.process(css, {
            // we need a prefix to avoid path rewriting of PostCSS
            from: "/css-loader!" + options.from,
            to: options.to,
            map: {
                prev: inputMap,
                sourcesContent: true,
                inline: false,
                annotation: false
            }
        }).then(function(result) {
            console.log(result);
            callback(null, {
                source: result.css,
                map: result.map && result.map.toJSON(),
                exports: parserOptions.exports,
                importItems: parserOptions.importItems,
                importItemRegExpG: /___CSS_LOADER_IMPORT___([0-9]+)___/g,
                importItemRegExp: /___CSS_LOADER_IMPORT___([0-9]+)___/,
                urlItems: parserOptions.urlItems,
                urlItemRegExpG: /___CSS_LOADER_URL___([0-9]+)___/g,
                urlItemRegExp: /___CSS_LOADER_URL___([0-9]+)___/
            });
        }).catch(function(err) {
            callback(err);
        });
    }
});

