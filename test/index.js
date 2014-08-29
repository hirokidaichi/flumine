var flumine = require("../");
var assert = require("power-assert");


describe("flumine", function() {
    var reserve = flumine.reserve;
    var delay = flumine.delay;
    var debug = flumine.debug;

    describe(".reserve", function() {
        it("should retern a funtion returning promise", function(done) {
            var promiseFunc = reserve(function(ctx) {
                ctx.next(10);
            });
            assert(promiseFunc, "not undefined");
            assert(promiseFunc(), "not undefined");
            var p = promiseFunc().then(function(d) {
                assert(d == 10);
            }).then(done, done);
        });
        it("should be connectable", function(done) {
            var double = function(ctx) {
                ctx.next(ctx.value * 2);
            };
            var $double = reserve(double);
            var $8thtimes = $double.to($double).to(function(d) {
                return d * 2
            });
            $8thtimes(10).then(function(d) {
                assert(d == 80);
            }).then(done, done)
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
            it("should wait all reservers", function(done) {
                var d1 = reserve.value(100).to(delay(100));
                var d2 = reserve.value(1000).to(delay(1000));
                var d3 = reserve.value(500).to(delay(500));
                var waitAll = reserve.race([d1, d2, d3]);

                waitAll().then(function(d) {
                    assert.equal(d, 100);
                }).then(done, done);
            })
        });
    });

})
