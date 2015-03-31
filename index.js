var promise = (global || window).Promise || require("promise");

var extend = require("extend");
var logFactory = require("debug");
var util = extend(require("util"), require("util-is"));
var zip = require("zip-object");
var jsonquery = require("json-query");

var slice = Array.prototype.slice;

var empty = function() {};

var query = function(data, query) {
    if (query === "_") {
        return data;
    }
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

var shouldCatch = function(err, catchType) {
    if (util.isRegExp(catchType)) {
        if (err.name)
            return catchType.test(err.name) || catchType.test(err.message);
        return catchType.test(err.message);
    }
    return (err instanceof catchType);
};
extension.or = extension.rescue = function() {
    var _self = this;
    var handler;
    var catchType;
    if (arguments.length == 2) {
        catchType = arguments[0];
        handler = arguments[1];
    } else {
        handler = arguments[0];
    }
    var fHandler = fluminize(handler);
    return flumine(function(d, ok, ng) {
        var catcher = flumine(function(err, ok, ng) {
            if (catchType && !shouldCatch(err, catchType)) {
                ng(err);
            }
            err.inputData = d;
            return ok(err);
        }).and(fHandler);

        _self(d)
            .then(null, catcher)
            .then(ok)
            .then(null, ng);
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

extension.as = extension.transform = function(signature) {
    return this.to(function(d) {
        return transform(signature, d);
    });
};

extension.extend = function(value) {
    return this.to(function(d) {
        if (util.isPureObject(value))
            return extend(d, value);
        return value;
    });
};
extension.defaults = function(value) {
    return this.to(function(d) {
        if (util.isPureObject(value))
            return extend(extend({}, value), d);
        return d ? d : value;
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

var LISTENERS = [

    function zero() {
        var args = (arguments.length > 1) ? slice.call(arguments) : arguments[0];
        return this(args);
    },
    function one(f) {
        return this(f);
    },
    function two(f, s) {
        return this([f, s]);
    },
    function three(f, s, t) {
        return this([f, s, t]);
    },
    function four(f, s, t, fourth) {
        return this([f, s, t, fourth]);
    }
];
extension.listener = function(n) {
    var bindN = n || 0;
    if (bindN > 4)
        throw new Error("listener's args should be less than 5");
    return LISTENERS[bindN].bind(this);
};

extension.connect = extension.handler = function() {
    var _self = this;
    return function(req, res, next) {
        return _self({
            req: req,
            res: res
        }).then(next, next);
    };
};

extension.errorHandler = function() {
    var _self = this;
    return function(err, req, res, next) {
        return _self({
            req: req,
            res: res,
            err: err
        }).then(next, next);
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

extension.stop = function() {
    return this.and(function(r, ok, ng) {});
};


var log = function(message) {
    var logger = logFactory(message);
    return function(sig) {
        return flumine(function(d) {
            logger(sig, d);
            return d;
        });
    };
};

extension.debug = function(code) {
    var name = code || "";
    var logit = log(code);
    var wrapped = logit("input").and(this).and(logit("output"));
    return wrapped.or(Error, function(err, ok, ng) {
        err.debugTraceList = err.debugTraceList || [];
        err.debugTraceList.push({
            name: code,
            input: err.inputData
        });
        logit("error")(err);
        ng(err);
    });
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

var createValidator = function(preds, errorType) {
    var ErrClz = errorType || Error;
    return function(d) {
        var errors = [];

        preds.forEach(function(p) {
            var pred = p[1];
            var queryStr = p[0];
            var message = p[2];
            var val = query(d, queryStr);
            if (pred(val)) {
                return;
            }
            errors.push({
                name: "ValidationError",
                message: message,
                value: val,
                path: queryStr
            });
        });
        if (errors.length > 0) {
            var err = new ErrClz("flumine assertion error");
            err.errors = errors;
            throw err;

        }
    };

};

extension.assert = function(pred, message, errorType) {
    if (util.isArray(pred)) {
        return this.to(createValidator(pred, arguments[1]));
    }
    var ErrClz = errorType || Error;
    return this.to(function(d) {
        if (pred(d)) {
            return d;
        }
        var err = new ErrClz(message);
        throw err;
    });
};

extension.when = function(predicate, then, els) {
    var p = util.isFunction(predicate) ? predicate : function(d) {
            return !!query(d, predicate);
        };

    return this.to(function(d) {
        if (p(d))
            return then(d);
        return els ? els(d) : d;
    });
};

extension.print = function(p) {
    return this.to(function(d) {
        if (p) {
            console.log(p, d);
        } else {
            console.log(d);
        }
        return d;
    });
};

extension.pre = extension.before = function(pre) {
    return flumine.to(pre).and(this);
};

extension.invoke = function(reserver) {
    var invokee = fluminize(reserver);
    return this.and(function(d, ok, ng) {
        invokee(d);
        ok(d);
    });
};

extension.through = function(reserver) {
    var next = fluminize(reserver);
    return this.and(function(d, ok, ng) {
        next(d).then(function(v) {
            ok(d);
        }, ng);
    });
};

extension.props = function(map) {
    return this.set(extend({
        "__original__": flumine.pass
    }, map)).and(function(o) {
        var original = o.__original__;
        Object.keys(map).forEach(function(key) {
            original[key] = o[key];
        });
        return original;
    });
};
// for List
extension.pluck = function(t) {
    return this.each(flumine.as(t));
};

extension.uniqBy = function(t) {
    var sig = t || "_";
    var keyMaker = (sig.isFlumine) ? sig : flumine.as(sig);
    return this.each(flumine.set({
        val: flumine.pass,
        key: keyMaker
    })).and(function(list) {
        var result = {};
        var ret = [];
        list.forEach(function(e) {
            var key = e.key;
            if (!result[key]) {
                result[key] = true;
                ret.push(e.val);
            }
        });
        return ret;
    });
};

extension.sortBy = function(t, asc) {
    var sig = t || "_";
    var keyMaker = (sig.isFlumine) ? sig : flumine.as(sig);
    var order = (asc) ? 1 : -1;

    return this.each(flumine.set({
        comp: keyMaker,
        val: flumine.pass,
    })).and(function(list) {
        return list.sort(function(a, b) {
            return (a.comp - b.comp) * order;
        });
    }).pluck("val");
};

extension.groupBy = function(t) {
    var sig = t || "_";
    var keyMaker = (sig.isFlumine) ? sig : flumine.as(sig);

    return this.each(flumine.set({
        key: keyMaker,
        val: flumine.pass,
    })).and(function(list) {
        var result = {};
        list.forEach(function(e) {
            var key = e.key;
            result[key] = result[key] || [];
            result[key].push(e.val);
        });
        return result;
    });
};

extension.where = function(c, d) {
    var sig = c || "_";
    var f = d ? function(e) {
            return transform(sig, e) === d;
        } : function(e) {
            return !!transform(sig, e);
        };
    return this.and(function(list) {
        return list.filter(f);
    });
};


extension.error = function(type, message) {
    if (type instanceof Error) {
        return flumine.through(function(d) {
            throw new type(message);
        });
    } else {
        return flumine.through(function(d) {
            throw new Error(type);
        });
    }
};

var pass = flumine.pass = flumine(function(d, ok, ng) {
    return ok(d);
});


Object.keys(extension).forEach(function(key) {
    flumine[key] = function() {
        return pass[key].apply(this, slice.call(arguments));
    };
});

// 
extension.null = flumine.fixed(null);
extension.true = flumine.fixed(true);
extension.false = flumine.fixed(false);
