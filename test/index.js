var flumine = require("../");
var assert = require("power-assert");
var fs = require("fs-promise");

describe("flumine", function() {
    var delay = flumine.delay;
    it("should retern a funtion returning promise", function(done) {
        var promiseFunc = flumine(function(d, ok, ng) {
            ok(10);
        });
        assert(promiseFunc, "not undefined");
        assert(promiseFunc(), "not undefined");
        var p = promiseFunc().then(function(d) {
            assert(d == 10);
        }).then(done, done);
    });
    it("should be connectable", function(done) {

        var $double = flumine(function(d) {
            return d * 2;
        });
        var $8thtimes = $double.to($double).to(function(d) {
            return d * 2;
        });
        $8thtimes(10).then(function(d) {
            assert(d == 80);
        }).then(done, done);
    });
    it("should wait all result", function(done) {
        var delayForValue = flumine(function(d, ok, ng) {
            var n = Date.now();
            setTimeout(function(a) {
                ok(Date.now() - n);
            }, d);
        });
        var forList = flumine.all(delayForValue);
        forList([100, 200, 300]).then(function(d) {
            assert(d[0] >= 100);
            assert(d[1] >= 200);
            assert(d[2] >= 300);
        }).then(done, done);
    });
    describe("all", function() {
        it("should wait all fluminers", function(done) {
            var d1 = flumine.value(100).to(delay(100));
            var d2 = flumine.value(1000).to(delay(1000));
            var d3 = flumine.value(500).to(delay(500));
            var waitAll = flumine.all([d1, d2, d3]);
            waitAll().then(function(d) {
                assert.deepEqual(d, [100, 1000, 500]);
            }).then(done, done);
        });
    });

    describe("race", function() {
        it("should return the fastest fluminer", function(done) {
            var d1 = flumine.value(100).to(delay(100));
            var d2 = flumine.value(1000).to(delay(1000));
            var d3 = flumine.value(500).to(delay(500));
            var waitAll = flumine.race([d1, d2, d3]);

            waitAll().then(function(d) {
                assert.equal(d, 100);
            }).then(done, done);
        });
    });

    describe("order", function() {
        var num = 0;
        var a = flumine.delay(30).and(function(d) {
            assert.equal(num++, 0);
            return d * 2;
        });
        var b = flumine.delay(20).and(function(d) {
            assert.equal(num++, 1);
            return d * 3;
        });
        var c = flumine.delay(10).and(function(d) {
            assert.equal(num++, 2);
            return d * 4;
        }).debug("c");

        var order = flumine.order([a, b, c]).and(function(d) {
            assert.deepEqual(d, [4, 6, 8]);
        });

        it("should be execute in order", function() {
            return order(2);
        });
    });
    describe("pair", function() {
        var add = function(d) {
            return d + 100;
        };
        it("should return result and response pair",
        flumine.value(10).pair(add).to(function(d) {
            assert.deepEqual(d, [10, 110]);
        }));

    });
    describe("set", function() {
        it("can set a flumine as object value", function() {
            return flumine.set({
                a: flumine.fixed(1),
                b: flumine.fixed(2),
                c: flumine.delay(200).fixed(3),
                d: 10
            }).to(function(d) {
                assert(d.a, 1);
                assert(d.b, 2);
                assert(d.c, 3);
                assert(d.d, 10);
            })();
        });
    });
    describe("through", function() {
        it("should ignore return value of a flumine", function() {
            return flumine.fixed(10).through(flumine.fixed(20)).to(function(d) {
                assert(d, 10);
            })();
        });
    });
    var mixedValue = {
        page: 1,
        index: 10,
        entries: [
            {
                age: 10,
                name: "hoge"
            },
            {
                age: 20,
                name: "fuga"
            }
        ]
    };
    describe("transform", function() {
        it("should transform by json-query and pickup the value", flumine.fixed(mixedValue)
        .transform("entries").to(function(d) {
            assert(d.length == 2);
        }));

        it("should transform by json-query and filtered value", function() {
            return flumine.fixed(mixedValue).transform({
                hoge: "entries[name=hoge].age",
                fuga: "entries[name=fuga].age"
            }).to(function(d) {
                assert(d.hoge == 10);
                assert(d.fuga == 20);
            })();
        });
    });
    describe("ifOnly", function() {
        it("should be through only if condition is filled", function() {
            return flumine.fixed(100).ifOnly(function(d) {
                return d > 10;
            }).to(function() {
                assert(true);
            })();
        });
        it("should not be through if condition is not filled", function() {
            var lesser = flumine.fixed(100).ifOnly(function(d) {
                return d < 0;
            });
            return flumine.first([
                lesser, flumine.fixed(10).delay(100)
            ]).to(function(d) {
                assert(d == 10);
            })();

        });

    });
});
