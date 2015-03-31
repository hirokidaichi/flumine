
flumine - promiseを返す関数を取り扱うユーティリティ
==========

# はじめに

``flumine``は、「promiseを返す関数」をそのまま合成できるように拡張するライブラリです。

通常、promiseを取りあつかう場合、次のようにpromiseを返す関数を作成します。

```javascript:before

var double = function(x){
	return new Promise(function(ok,ng){
		ok(x*2);
	});
};

var d = double(2).then(function(d){
	return new Promise(function(ok,ng){
		ok(d-2);
	});
});

d.then(console.log); // 2

```

また、複数のpromiseをつなぎ合わせるには、「promiseを返す関数」をthenに渡す必要があります。

私は、「promiseを返す関数」という単位に注目し、それらを一つのコンテナとして扱うことで、非同期プログラミングを容易にしようと考えました。flumineの場合、次のように書くことができます。

```flumine
var double = flumine(function(d,ok,ng){
	return ok(d*2);
});

var d = double.and(function(d,ok,ng){
	return ok(d-2);
}).print();

d(2); // 2
```

この時、dは「promiseを返す関数のコンテナ」として、作られます。
したがって、次のようにすることもできます。

```flumineとflumineの合成
var quad = double.and(double).print();

quad(2); // 8
```

quad は「promiseを返す関数」であるので、当然のことながら呼び出しを行うまで、実行はされません。

同じことを、ネイティブなpromiseでやる場合は次のようになります。

```javascript:ネイティブなpromiseで合成
var double = function(x){
	return new Promise(function(ok,ng){
		ok(x*2);
	});
};

var quad = function(x){
	return double(x).then(double).then(console.log);
};

```

少しだけ、面倒です。しかし、これだけをするのであれば、我慢できる程度のことです。

「promiseを返す関数」をコンテナとして扱うことで、様々なpromiseを用いたパターンをそのコンテナの中に閉じ込めることができます。

たとえば、複数の値を並列でとってきて、それをobjectとして返すケースでは
次のように記述する必要がありました。

```javascript:webサイトでありがちなpromiseの合成
var getFriendsId; // friendIdのリスト情報を渡すPromiseを返す関数
var getFriendObject; // friendIdから、friend情報を渡すPromiseを返す関数
var getArticle; // articleIdからarticle情報を渡すPromiseを返す関数
var getComments: // articleIdから、comment情報のリストを返す関数

var getPageInfo = function(parameter){
	return Promise.all([
		getFriendsId(parameter.userId).then(function(friendIds){
			return Promise.all(friendIds.map(getFriendObject));
		}),
		getArticle(parameter.articleId),
		getComments(parameter.articleId),
		
	]).then(function(d){
		return {
			friends : d[0],
			article  : d[1],
			comments : d[2]
		};
	});
};
```

これをflumineではsetというコンテナの関数を用いて、次のように記述することができます。

```javascript:上記をflumineで記述した場合
var getFriendsId; // friendIdのリスト情報を渡すPromiseを返す関数
var getFriendObject; // friendIdから、friend情報を渡すPromiseを返す関数
var getArticle; // articleIdからarticle情報を渡すPromiseを返す関数
var getComments: // articleIdから、comment情報のリストを返す関数

var as = flumine.as;
var getPageInfo = flumine.set({
    article  : as("articleId").and(getArticle),
    comments : as("userId").and(getComments),
    friends  : as("userId").and(getFriendsId).each(getFriendObject),
});
```
``function``キーワードを３つ減らすことに成功しました。

このように「promiseを返す関数」という単位をコンテナの基準にすることで、ありがちなパターンを閉じ込めることができます。これによって、非同期プログラミングの難しいところを閉じ込めることができます。

ところで、世の中には同じような目的をもったライブラリが多数存在します。コールバック地獄をさけるという命題の元、様々な方法でライブラリが提供されてきました。「それとの違いは何か」というのも当然の疑問です。

ポイントは、このライブラリでつくられた関数はどこまでいっても、「Promiseを返す関数」であるということです。
ですので、既存の、あるいは、これから登場する様々なライブラリともPromiseを取り扱うものである限り、親和性があります。

たとえば、先ほどの``getPageInfo``は、thenに渡すことができます。実行すればthenableなpromiseを返します。

```
var getPageInfo;
var requestToParams;

// promiseを返す関数なので実行すれば、thenメソッドがあります。
getPageInfo(params).then(console.log);

// peomiseを返す関数なので、thenに渡すことができます。
requestToParams(req).then(getPageInfo);

// coのなかにおいても自然に使うことができます。
co(function* (req) {
  var params = yield requestToParams(req);
  var result = yield getPageInfo(params);
  return result;
})
// ES7 にasync,awaitが来た場合にも問題ありません
var x = async function(req){
	var params = await requestToParams(req);
	var result = await getPageInfo(params);
	return result;
};

```

このような性質のため、現在においても将来においてもflumineがあなたをロックインすることはありません。
非同期処理において、「Promiseを返す関数」をファーストクラスに取り扱うことで、安心した夜を迎えることができます。
# インストールについて

```
npm install flumine
```

# コンテナ関数

## コンストラクタ

### flumine
渡された関数をFlumineコンテナに変換します。

一秒間遅延させるコンテナは次のように記述します。

```
var f = flumine(function(d,ok,ng){
	setTimeout(function(){
		ok(d)l
	},1000);
});
```



## 基本関数 

### and = to

複数のFlumineコンテナを結合します。

```
var k = double.and(double)
			   .and(function(d){ return d/4;});
```

### or = rescue
エラーを捕まえ、処理を行うことができます。

```
var getArticle = lookupArticle.or(function(err,ok,ng){
	return null;
});
var getArticle = lookupArticle.or(NotFoundError,flumine.null);

```
第一引数にErrorクラスのオブジェクトを渡した場合、その例外の時のみ処理を行います。

## 制御関数

### fixed = value
渡された値を戻すFlumineコンテナを作成します。

```
var ten = flumine.fixed(10);
var twenty = ten.and(double);

twenty.print()(1999); //20
```

### pass
そのままの値を返すFlumineコンテナです。

### null,true,false
それぞれの値を定数として返すflumineコンテナです。

```
var t = flumine.set({
	NULL : flumine.null,
	TRUE : flumine.true,
	FALSE : flumine.false,
	GIVEN : flumine.pass,
});

t(10).then(console.log); // { NULL : null, TRUE :true, FALSE : false, GIVEN : 10}
```
### each = all
複数のFlumineコンテナを受け取り、並列実行を試みます。すべてのFlumineコンテナの実行が終わるとその結果を配列として返します。

また、Arrayでなく単一のFlumineコンテナを受け取った場合、入力のリストのそれぞれの要素に対して受け取った処理を実行します。


### first = race
eachとことなり、すべての実行終了を待ちません。もっとも早く終了した処理結果を次に返します。


### stop
制御をそれ以上進めません。

### through
入力を受け取りますが、結果を出力せずに、入力と同じ値を出力します。受け取った処理の終了は待ち合わせます。
エラーの伝搬も行います。そのため、結果は必要ではないがエラーが起きた場合は知りたい処理に利用することができます。



### invoke
throughと違い、結果を待ち受けません。エラーの伝搬も行わないので渡すFlumineコンテナ側で対処する必要があります。バックグラウンドで実行したい処理を駆動するのに用います。

### order
複数のFlumineをうけとり、順番に実行します。結果は配列として渡されます。eachやsetと異なり、実行順を意識するがデータの依存関係のない処理に使用します。


### set
valueがflumineコンテナとなったhashmapを受け取り、並列実行します。結果は対応するkeyのvalueとして格納され、次に渡されます。

### props
setとほぼ同じですが、入力されたobjectのpropertyに追記します。

```
var getArticle = getArticle.props({
	owner : flumine.as("ownerId").and(getOwner)
}); // { owner : [Object], ownerId : xxx , id : xxxx, text : ssssss }
```

### delay
与えられた時間(micro sec)だけ処理を遅延します。

### as/transform
jsonqueryを受け取り、入力を変換します。

```
var obj = flumine.fixed({
	id : "11",
	name : "hoge",
	addr : ["tokyo","shibuya","japan"]
});
obj.as("id").print()();// 11

obj.as(["name","age"]).print()();//["hoge",null]

obj.as({
	country :"addr[2]",
	prefecture : "addr[0]",
	district : "addr[1]"
}).print()(); // { country : "japan", prefecture : "tokyo",district : "shibuya"}
```

### debug

環境変数DEBUGに与えられたフラグをもとに入力、出力、エラー時に値をコンソールに出力します。
これによって非同期プログラミングでのprintデバッグを容易にすることができます。

```test.js

var getArticle = model.lookupArticle.debug("app-model-article.lookupArticle"); 

```

DEBUG時には必要な箇所のフラグを与えてあげることで、入出力を確認することができます。

```
DEBUG=app-model-article* node text.js
// app-model-article input { articleId : "" }
// app-model-article output { articleId : "" , info : xxx }
```


### print
debugとことなり、一時的なものとして使用。戻り値をconsoleに出力します。

### when

第一引数にboolを返す関数を受け取り、trueの場合は第二引数のflumineコンテナを実行し、falseの場合は第三引数のflumineコンテナを実行します。

```
var articleOnlyPublic = getArticle.when("isPublic",flumine.pass,flumine.null);
```

## pre
事前処理を追加します。以下は等価です。

```
var A = X.and(Y);
var B = Y.pre(X);
```

## リスト関数
リスト関数は、入力値がリストであるFlumineコンテナに対して、処理を行うヘルパーです。

### each
リストの要素それぞれに対して処理を行います。

### pluck
リストの要素それぞれに対して、変換処理を行います。

### uniqBy
リストの要素それぞれに対して、処理を行いユニークな値の要素を取り出します。

### sortBy
リストの要素それぞれに対して、処理を行いその結果でソートします。第二引数にtrueを渡すと降順になります。

### groupBy
リストの要素それぞれに対して、処理を行いその結果でグループ化されたhashを返します。

### where
リストの要素それぞれに対して、処理を行い、その結果がtrueなもののみを返します。










