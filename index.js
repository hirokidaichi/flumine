var promise = (global || window).Promise || require("promise");

var extend = require("extend");

var util = extend(require("util"), require("util-is"));
var zip = require("zip-object");
var jsonquery = require("json-query");

var slice = Array.prototype.slice;

var k = function(a, b, c) {};

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
    Object.keys(flumine.extention).forEach(function(key) {
        _self[key] = flumine.extention[key].bind(_self);
    });

    return fluminer;
};


var extention = flumine.extention = {};

extention.rescue = function(handler) {
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
extention.pair = function(n) {
    var next = fluminize(n);
    return this.to(function(d, ok, ng) {
        var req = d;
        next(d).then(function(res) {
            ok([req, res]);
        }).then(ok, ng);
    });
};

extention.transform = function(signature) {
    return this.to(function(d) {
        return transform(signature, d);
    });
};

extention.and = extention.to = function(nextReserver) {
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

extention.first = extention.race = function(next) {
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
extention.each = extention.all = function(next) {
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

extention.fixed = extention.value = function(value) {
    return this.to(function(d, ok, ng) {
        ok(value);
    });
};

extention.set = function(mapper) {
    var flumineList = Object.keys(mapper).map(function(k) {
        return fluminize(mapper[k]);
    });
    return this.each(flumineList).and(function(d) {
        return zip(Object.keys(mapper), d);
    });
};

var pass = flumine.pass = flumine(function(d, ok, ng) {
    return ok(d);
});


Object.keys(extention).forEach(function(key) {
    flumine[key] = function() {
        return pass[key].apply(this, slice.call(arguments));
    };
});


