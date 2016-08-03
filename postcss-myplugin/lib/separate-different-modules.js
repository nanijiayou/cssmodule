var postcss   = require("postcss");
var Tokenizer = require("css-selector-tokenizer");

module.exports = postcss.plugin("separate-different-modules", function(options) {
    return function(css, result) {
        var imports = {};
        var exports = {};
        var importItems = [];

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
                    if (options.url && !/^#/.test(item.url) && loaderUtils.isUrlRequest(item.url, options.root)) {
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

        function compileExports(exports) {
            if (!Object.keys(exports).length) {
                return "";
            }
            var exportJs = Object.keys(exports).reduce(function(res, key) {
                var valueAsString = JSON.stringify(exports[key]);
                res.push("\t" + JSON.stringify(key) + ": " + valueAsString);
                return res;
            }, []).join(",\n");

            return "{\n" + exportJs + "\n}";
        };
        
        var exportJs = "exports.locals = " + compileExports(exports) + ";"
        result.exports = exportJs;
    };
});