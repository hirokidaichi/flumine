



flumine - a library for connecting functions which return promise
====

# install

```
npm install flumine
```

# sample

```
var add10 = flumine(function(data,ok,ng){
	ok(data+10);
});

var add20 = add10.and(add10);

add20(1).then(console.log); // 21

```


```
var controller = transform({ req : "[0]",res:"[1]"}).and(validate);

var action = flumine(function(d,ok,ng){
	model.call(d,function(err,res){
		if( err ) return ng(err);
		ok(res);
	});
});

var view = flumine(function(d,ok,ng){
	d.res.render(d.entries);
});


app.get("/hoge",controller.set({
	res : "res",
	req : "req",
	entries : transform("req.param.id").and(action)
}).and(view).listener());

```

# flumine


## and / to


## each / all


## first / race



## delay

## debug

## set

## pair

## through

## transform

