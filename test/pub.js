 var RedisStore = require('socket.io/lib/stores/redis')
 , redis  = require('socket.io/node_modules/redis')
 , pub    = redis.createClient();

var type2 = 'area2';
var type1 = 'area1';
var name = "area";


var str1 = JSON.stringify({ nodeId: "111111", args: "args" });

var str2 = JSON.stringify({ nodeId: "222222", args: "args" });



setInterval(function(){

	pub.publish(type1, str1);

},2000);
