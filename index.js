var Promise = require("promise");
var util = require("util");

var slice = Array.prototype.slice;
var reserve = module.exports.reserve = function(f) {
    var reserver = function(d) {
        return new Promise(function(ok, ng) {
            f(d, ok, ng)
        });
    };
    var _self = reserver;

    reserver.label = function(reserverName) {
        return debug(reserverName + " in :")
            .to(_self)
            .to(debug(reserverName + " out :"));
    };
    reserver.rescue = function(handler) {
        return reserve(function(d, ok, ng) {
            _self(d)
                .
            catch (handler)
                .then(ok)
                .
            catch (ng);

        })
    };
    reserver.to = function(nextReserver, hasArgs) {
        var next = (hasArgs != undefined) ? reserve.curry.apply(null, slice.call(arguments)) : nextReserver;
        return reserve(function(d, ok, ng) {
            _self(d)
                .then(next)
                .then(function(d) {
                    ok(d)
                })
                .
            catch (ng);
        });
    };
    reserver.race = function(next) {
        if (util.isArray(next)) {
            return _self.to(function(d) {
                return Promise.race(next.map(function(pf) {
                    return pf(d);
                }));
            });
        } else {
            return _self.to(function(d, ok, ng) {
                return Promise.race((d || []).map(next))
            });
        }
    };
    reserver.all = function(next) {
        if (util.isArray(next)) {
            return _self.to(function(d) {
                return Promise.all(next.map(function(pf) {
                    return pf(d);
                }));
            });
        } else {
            return _self.to(function(d, ok, ng) {
                return Promise.all((d || []).map(next))
            });
        }
    };
    return reserver;
};

var pass = reserve(function(d, ok, ng) {
    ok(d);
});

reserve.to = function() {
    return pass.to.apply(null,slice.call(arguments));
};
reserve.all = function(reserverList) {
    return pass.all(reserverList);
};
reserve.race = function(reserverList) {
    return pass.race(reserverList);
};
reserve.value = function(value) {
    return reserve(function(d, ok, ng) {
        ok(value);
    });
};

reserve.curry = function() {
    var args = slice.call(arguments);
    var pf = args.shift();
    return pass.to(function(d) {
        return pf.apply(null, args);
    });

};
var debug = module.exports.debug = function(message) {
    return reserve(function(d, ok, ng) {
        debug.log(message, d);
        ok(d);
    });
};

debug.log = console.log;

var delay = module.exports.delay = function(ms) {
    return reserve(function(d, ok, ng) {
        setTimeout(function() {
            ok(d);
        }, ms);
    });
};
