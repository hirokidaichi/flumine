var promise = (global || window).Promise || require("promise");

var extend = require("extend");

var util = extend(require("util"), require("util-is"));
var zip = require("zip-object");
var jsonquery = require("json-query");

var slice = Array.prototype.slice;

var empty = function() {};

var query = function(data, query) {
    return jsonquery(query, {
        data: data
    }).value;
};

var transform = function(signature, data) {
    if (util.isString(signature)) {
        return query(data, signature);
    }
    if (util.isFunction(signature)) {
        return signature(data);
    }
    if (util.isArray(signature)) {
        return signature.map(function(elem) {
            return transform(elem, data);
        });
    }
    if (util.isPureObject(signature)) {
        var keys = Object.keys(signature);
        return zip(keys, keys.map(function(k) {
            return transform(signature[k], data);
        }));
    }
};

var flumine = module.exports = function(f) {
    if (f.isFlumine) return f;
    if (f.length != 3) return pass.to(f);
    var fluminer = function() {
        // 引数の数を0個にし、引数の数で継続を受け取る関数に対応する
        var d = arguments[0];
        return new promise(function(ok, ng) {
            f(d, ok, ng);
        });
    };
    var _self = fluminer;
    _self.isFlumine = true;
    _self.then = _self;
    Object.keys(flumine.extension).forEach(function(key) {
        _self[key] = flumine.extension[key].bind(_self);
    });

    return fluminer;
};


var extension = flumine.extension = {};

extension.rescue = function(handler) {
    var _self = this;
    return flumine(function(d, ok, ng) {
        _self(d)
        .
        catch (handler)
        .then(ok)
        .
        catch (ng);
    });
};

var fluminize = function(func) {
    if (func.isFlumine) return func;
    if (func.length == 3) return flumine(func);
    return flumine(function(d, ok, ng) {
        var result = func(d);
        if (result && result.then) return result.then(ok, ng);
        if (util.isError(result)) return ng(result);
        return ok(result);
    });
};
// [request,response = next(request)] の形で返す
extension.pair = function(n) {
    var next = fluminize(n);
    return this.to(function(d, ok, ng) {
        var req = d;
        next(d).then(function(res) {
            ok([req, res]);
        }).then(ok, ng);
    });
};

extension.transform = function(signature) {
    return this.to(function(d) {
        return transform(signature, d);
    });
};

extension.extend = function(value) {
    return this.to(function(d) {
        return extend(d, value);
    });
};

extension.and = extension.to = function(nextReserver) {
    var _self = this;
    var next = fluminize(nextReserver);
    return flumine(function(d, ok, ng) {
        _self(d)
        .then(next)
        .then(function(d) {
            ok(d);
        })
        .
        catch (ng);
    });
};

extension.first = extension.race = function(next) {
    var _self = this;
    if (util.isArray(next)) {
        return _self.to(function(d) {
            return promise.race(next.map(function(pf) {
                return fluminize(pf)(d);
            }));
        });
    } else {
        return _self.to(function(d) {
            return promise.race((d || []).map(fluminize(next)));
        });
    }
};

extension.order = function(flumines) {
    var _self = this;
    return this.to(function(d) {
        var ret = [];
        var ordered = flumines.map(function(f) {
            return flumine.fixed(d).and(f).and(function(r) {
                ret.push(r);
                if (ret.length == flumines.length) {
                    return ret;
                } else {
                    return d;
                }
            });
        }).reduce(function(p, n) {
            return p.and(n);
        });
        return ordered();

    });
};
extension.listener = function() {
    var _self = this;
    return function() {
        var args = (arguments.length > 1) ? slice.call(arguments) : arguments[0];
        return _self(args);
    };
};


extension.each = extension.all = function(next) {
    var _self = this;
    if (util.isArray(next)) {
        return _self.to(function(d) {
            return promise.all(next.map(function(pf) {
                return fluminize(pf)(d);
            }));
        });
    } else {
        return _self.to(function(d) {
            return promise.all((d || []).map(fluminize(next)));
        });
    }
};


flumine.debugLogger = (process.env.NODE_ENV == "development") ? console.log : empty;

var log = function(message) {
    return flumine(function(d) {
        flumine.debugLogger(message, d);
        return d;
    });
};

extension.debug = function(code) {
    var name = code || "";
    return log(name + " input:").and(this).and(log(name + " output:"));
};

extension.fixed = extension.value = function(value) {
    return this.to(function(d, ok, ng) {
        ok(value);
    });
};

extension.set = function(mapper) {
    var flumineList = Object.keys(mapper).map(function(k) {
        return util.isFunction(mapper[k]) ? fluminize(mapper[k]) : flumine.fixed(mapper[k]);
    });
    return this.each(flumineList).and(function(d) {
        return zip(Object.keys(mapper), d);
    });
};

extension.emit = function(emitter, eventName) {
    return this.to(function(d) {
        emitter.emit(eventName, d);
        return d;
    });
};

extension.delay = function(msec) {
    return this.to(function(d, ok, ng) {
        setTimeout(function() {
            ok(d);
        }, msec);
    });
};

extension.ifOnly = function(conditionOrQuery) {
    var predicate = util.isFunction(conditionOrQuery) ?
        conditionOrQuery : function(d) {
            return !!query(data, conditionOrQuery);
        };
    return this.to(function(d, ok, ng) {
        if (predicate(d)) {
            ok(d);
        }
    });
};

extension.through = function(reserver) {
    var next = fluminize(reserver);
    return this.pair(next).transform("[0]");
};

var pass = flumine.pass = flumine(function(d, ok, ng) {
    return ok(d);
});


Object.keys(extension).forEach(function(key) {
    flumine[key] = function() {
        return pass[key].apply(this, slice.call(arguments));
    };
});


