var flumine = require("../");
var assert = require("power-assert");
var fs = require("fs-promise");

describe("flumine", function() {
    var reserve = flumine.reserve;
    var delay = flumine.delay;
    var debug = flumine.debug;

    describe(".reserve", function() {
        it("should retern a funtion returning promise", function(done) {
            var promiseFunc = reserve(function(d, ok, ng) {
                ok(10);
            });
            assert(promiseFunc, "not undefined");
            assert(promiseFunc(), "not undefined");
            var p = promiseFunc().then(function(d) {
                assert(d == 10);
            }).then(done, done);
        });
        it("should be connectable", function(done) {
            var double = function(d, ok, ng) {
                ok(d * 2);
            };
            var $double = reserve(double);
            var $8thtimes = $double.to($double).to(function(d) {
                return d * 2
            });
            $8thtimes(10).then(function(d) {
                assert(d == 80);
            }).then(done, done)
        });
        it("should wait all result", function(done) {
            var delayForValue = reserve(function(d, ok, ng) {
                var n = Date.now()
                setTimeout(function(a) {
                    ok(Date.now() - n);
                }, d);
            });
            var forList = reserve.all(delayForValue);
            forList([100, 200, 300]).then(function(d) {
                assert(d[0] >= 100);
                assert(d[1] >= 200);
                assert(d[2] >= 300);
            }).then(done, done);
        });
        describe("all", function() {
            it("should wait all reservers", function(done) {
                var d1 = reserve.value(100).to(delay(100));
                var d2 = reserve.value(1000).to(delay(1000));
                var d3 = reserve.value(500).to(delay(500));
                var waitAll = reserve.all([d1, d2, d3]);

                waitAll().then(function(d) {
                    assert.deepEqual(d, [100, 1000, 500]);
                }).then(done, done);
            })
        });
        describe("race", function() {
            it("should return the fastest reserver", function(done) {
                var d1 = reserve.value(100).to(delay(100));
                var d2 = reserve.value(1000).to(delay(1000));
                var d3 = reserve.value(500).to(delay(500));
                var waitAll = reserve.race([d1, d2, d3]);

                waitAll().then(function(d) {
                    assert.equal(d, 100);
                }).then(done, done);
            })
        });
        describe("curry", function() {
            it("should make curried function", function(done) {
                var pf = function(a, b, c, d) {
                    var Promise = require("Promise");
                    return new Promise(function(ok, ng) {
                        ok([a, b, c, d]);
                    });
                };
                var r = reserve.curry(pf, 10, 20, 30, 40);
                r(11).then(function(d) {
                    assert.deepEqual(d, [10, 20, 30, 40]);
                }).then(done, done);
            });
            it("should adapt to promise function", function(done) {
                var existsIndexJs = reserve.to(fs.exists, "./index.js");
                existsIndexJs().then(function(d) {
                    assert(d);
                }).then(done, done);
            });
            it("should adapt to promise", function(done) {
                var existsIndexJs = reserve.value("./inde.js").to(fs.exists);
                existsIndexJs().then(function(d) {
                    assert(d == false);
                }).then(done, done);
            });
        });
    });

})
