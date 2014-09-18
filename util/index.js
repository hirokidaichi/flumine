

var flumine = require("../");


var debug = module.exports.debug = function(message) {
    return flumine(function(d, ok, ng) {
        debug.log(message, d);
        ok(d);
    });
};

debug.log = console.log;

var delay = module.exports.delay = function(ms) {
    return flumine(function(d, ok, ng) {
        setTimeout(function() {
            ok(d);
        }, ms);
    });
};
