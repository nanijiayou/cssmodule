var fs      = require("fs");
var path    = require("path");
var postcss = require("postcss");

var modulesScope    = require("postcss-modules-scope");
var modulesValues   = require("postcss-modules-values");
var extractImports  = require("postcss-modules-extract-imports");
var localByDefault  = require("postcss-modules-local-by-default");
var separateModules = require("./separate-different-modules");

var s = path.join(path.dirname(__dirname), 'src/style.css');
var t = path.join(path.dirname(__dirname), 'dist/dist.css');
fs.readFile(s, 'utf8', function (err, data) {
    if(err) {}
    var pipeline = postcss([
        localByDefault({mode: 'local'}),
        extractImports(),
        modulesValues,
        modulesScope(),
        separateModules()
    ]);
    pipeline.process(data).then(function (result) {
        console.log(result.css);
        console.log(result.exports);
    })
})


