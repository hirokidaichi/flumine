var flumine = require("../");
var assert = require("assert");
var fs = require("fs-promise");

describe("flumine", function() {
    var delay = flumine.delay;

    it("listener", function() {
        var m = flumine.pass.listener();
        assert.equal(m.length, 0);
        var o = flumine.pass.listener(1);
        assert.equal(o.length, 1);
        var t = flumine.pass.listener(2);
        assert.equal(t.length, 2);
        t = flumine.pass.listener(2);
        assert.equal(t.length, 2);
    });
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
    describe("debug", function() {
        var request = flumine.fixed("request");
        var err = flumine.to(function(d) {
            throw new Error("value");
        });
        var model = flumine.and(err).fixed("view-assign").debug("test:model");
        var controller = flumine.fixed("model-request").and(model).debug("test:controller");

        var view = flumine.fixed("html").debug("test:view");
        var app = request.and(controller).and(view).debug("test:app");

        it("should get 3 captured tracelist", app.or(function(err) {
            assert(err.debugTraceList.length == 3);
            assert.equal(err.debugTraceList[0].name, 'test:model');
            assert.equal(err.debugTraceList[1].name, 'test:controller');
            assert.equal(err.debugTraceList[2].name, 'test:app');
        }));
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
    describe("assert", function() {
        var isNumber = function(n) {
            return require('util').isNumber(n);
        };
        it("should be ok", function() {
            var test = flumine.assert(isNumber, "should be number");
            return test(10);
        });
        it("should be error", function() {
            var test = flumine.assert(isNumber, "should be number")
                .or(function(err) {
                    assert(err);
                });
            return test("unko");
        });


        it("should be ok when multiple assertion", function() {
            var test = flumine.assert([
                ["p.q", isNumber, "should be number"],
                ["p.a", isNumber, "should be number"]
            ]);
            return test({
                p: {
                    q: 10,
                    a: 5
                }
            });
        });
        it("should be errors", function() {
            var test = flumine.assert([
                ["p.q", isNumber, "should be number"],
                ["p.a", isNumber, "should be number"]
            ]).or(function(err) {
                assert(err);
            });
            return test({
                p: {
                    q: "hoge",
                    a: "fuga"
                }
            });
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
        entries: [{
            age: 10,
            name: "hoge"
        }, {
            age: 20,
            name: "fuga"
        }]
    };
    describe("as", function() {
        it("should transform by json-query and pickup the value", flumine.fixed(mixedValue)
            .as("entries").to(function(d) {
                assert(d.length == 2);
            }));

        it("should transform by json-query and filtered value", function() {
            return flumine.fixed(mixedValue).as({
                hoge: "entries[name=hoge].age",
                fuga: "entries[name=fuga].age"
            }).print().to(function(d) {
                assert(d.hoge == 10);
                assert(d.fuga == 20);
            })();
        });
    });
    describe("when", function() {
        it("should branch execution", flumine.fixed({})
            .when("_", flumine.fixed(true)).to(function(d) {
                assert(d);
            }));

        it("should branch execution and elsecondition", flumine.fixed({})
            .when("entries", flumine.fixed(true), flumine.fixed(false)).to(function(d) {
                assert(!d);
            }));
    });
    describe("or", function() {
        it("should catch all type of error and within inputdata", function() {
            var input = {
                req: {},
                res: {},
            };
            var test = flumine(function(d, ok, ng) {
                ng(new Error("message"));
            }).or(function(err) {
                assert(err);
                assert.deepEqual(err.inputData, input);
            });
            return test(input);
        });

        it("should catch the error matching the given RegExp", function() {
            var input = {
                req: {},
                res: {},
            };
            var test = flumine(function(d, ok, ng) {
                ng(new Error("message"));
            }).or(/mess.*/g, function(err) {
                assert(err);
                assert.deepEqual(err.inputData, input);
            });
            return test(input);
        });
        it("should not catch", function() {
            var input = {
                req: {},
                res: {},
            };
            var test = flumine(function(d, ok, ng) {
                ng(new Error("piyopiyo"));
            }).or(/mess.*/g, function(err) {
                assert.fail();
            }).or(function(err) {
                assert(err);
                assert.deepEqual(err.inputData, input);
            });
            return test(input);
        });
        it("should catch the error which is a child of the given class", function() {
            var input = {
                req: {},
                res: {},
            };
            var CustomError = function() {};
            CustomError.prototype = new Error();
            var test = flumine(function(d, ok, ng) {
                ng(new CustomError("piyopiyo"));
            }).or(CustomError, function(err) {
                assert(err);
                assert.deepEqual(err.inputData, input);
            });
            return test(input);
        });
    });
    var isDeeply = function(r) {
        return flumine.and(function(d) {
            assert.deepEqual(d, r);
        });
    };
    var equals = function(r) {
        return flumine.and(function(d) {
            assert.equal(d, r);
        });
    };
    describe("uniqBy", function() {
        var list = flumine.fixed([1, 2, 22, 3, 22, 3, 4, 5]);
        var hashList = flumine.fixed([{
            age: 10,
            name: "hoge"
        }, {
            age: 20,
            name: "hoge"
        }]);
        var uniq = list.uniqBy();
        it("should return unique list", uniq.and(isDeeply([1, 2, 22, 3, 4, 5])));
        it("should return unique list by given parameter",
            hashList.uniqBy("name").and(isDeeply([{
                age: 10,
                name: "hoge"
            }])));
    });
    describe("groupBy", function() {
        var hashList = flumine.fixed([{
                age: 10,
                class: "A",
                name: "hoge"
            }, {
                age: 20,
                class: "B",
                name: "hoge"
            }, {
                age: 15,
                class: "B"
            }

        ]);
        var gp = hashList.groupBy("class");
        var range = hashList.groupBy(function(d) {
            return Math.floor(d.age / 10) * 10 + "";
        });
        it("should return a hash of list", gp.as("A.length").and(equals(1)));
        it("should return a hash of list", gp.as("B.length").and(equals(2)));
        it("should return a hash of list grouped by age range",
            range.as("10.length").and(equals(2)));

    });
    describe("pluck", function() {
        var hashList = flumine.fixed([{
            age: 10,
            class: "A",
            name: "hoge"
        }, {
            age: 20,
            class: "B",
            name: "hoge"
        }, {
            age: 15,
            class: "B"
        }]);
        it("should return a list of property",
            hashList.pluck("class").and(isDeeply(["A", "B", "B"])));
    });
    describe("sortBy", function() {
        var hashList = flumine.fixed([{
            age: 10,
            class: "A",
            name: "hoge"
        }, {
            age: 20,
            class: "B",
            name: "hoge"
        }, {
            age: 15,
            class: "B"
        }]);
        var sorted = hashList.sortBy(flumine.as("age"));
        var sorted_b = hashList.sortBy("age", true);
        it("", sorted.pluck("age").and(isDeeply([20, 15, 10])));
        it("", sorted_b.pluck("age").and(isDeeply([10, 15, 20])));
    });
    describe("where", function() {
        var hashList = flumine.fixed([{
            age: 10,
            class: "A",
            name: "hoge"
        }, {
            age: 20,
            class: "B",
            isPublic: true,
            name: "hoge"
        }, {
            age: 15,
            class: "B"
        }]);
        var sorted = hashList.where("age", 10);
        it("",
            hashList.where("age", 10).as("[0].age").and(equals(10)));
        it("", hashList.where("isPublic").as("[0].isPublic").and(equals(true)));
    });
});
