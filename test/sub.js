 var RedisStore = require('socket.io/lib/stores/redis')
 , redis  = require('socket.io/node_modules/redis')
 , sub    = redis.createClient();
 
var type2 = 'area2';
var type1 = 'area1';
var name = "area";

sub.on('subscribe',function subscribe (ch) {
	console.log('cccccccccccccch%j',ch);
    //sub.on('message', message);
});

function message (ch, msg) {
	console.log('name messagemessage %j %j' , ch,msg);
};


function ppmessage (pattern,ch, msg) {
	console.log('name ppmessageppmessage %j %j %j' , pattern,ch,msg);
};

sub.psubscribe(name+'*');
 
sub.on('message', message);

sub.on('pmessage', ppmessage);
