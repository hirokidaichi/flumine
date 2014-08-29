var Promise = require("promise");


var reserve = function(f) {
    var reserver = function(d) {
        return new Promise(function(ok, ng) {
            f({
                next: ok,
                error: ng,
                value: d,
            })
        });
    };
    reserver.label = function(reserverName){
        return debug(reserverName+" in :")
                .to(reserver)
                .to(debug(reserverName+" out :"));
    };
    reserver.rescue = function(handler) {
        return reserve(function(ctx) {
            reserver(ctx.value)
                .
            catch (handler)
                .then(ctx.next)
                .
            catch (ctx.error);

        })
    };
    reserver.to = function(nextReserver) {
        return reserve(function(ctx) {
            reserver(ctx.value)
                .then(nextReserver)
                .then(function(d) {
                    ctx.next(d)
                })
                .
            catch (ctx.error);
        });
    };
    reserver.race = function(list) {
        return reserve(function(ctx) {
            Promise.race(list.map(function(pf) {
                return pf(ctx.value);
            })).then(ctx.next);
        });
    };
    reserver.all = function(list) {
        return reserve(function(ctx) {
            Promise.all(list.map(function(pf) {
                return pf(ctx.value);
            })).then(ctx.next);
        });
    };
    return reserver;
};

var pass = reserve(function(ctx) {
    ctx.next(ctx.value);
});
reserve.to = function(nextHandler) {
    return pass.to(nextHandler);
};
reserve.all = function(list) {
    return pass.all(list);
};
reserve.race = function(list) {
    return pass.race(list);
};
reserve.value = function(value){
    return reserve(function(ctx){
        ctx.next(value);
    });
}
;
var debug = function(message) {
    return reserve(function(ctx) {
        debug.log(message, ctx.value);
        ctx.next(ctx.value);
    });
};

debug.log = console.log;

var delay = function(ms) {
    return reserve(function(ctx) {
        setTimeout(function() {
            ctx.next(ctx.value);
        }, ms);
    });
};

module.exports.reserve = reserve;
module.exports.delay = delay;
module.exports.debug = debug;



