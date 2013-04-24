var sio = require('socket.io');
var SioSocket = require('../transports/iosocket');

module.exports = server = {};

server.listen = function(wserver,port,host) {
 var self = this;
 var RedisStore = require('socket.io/lib/stores/redis')
 , redis  = require('socket.io/node_modules/redis')
 , pub    = redis.createClient()
 , sub    = redis.createClient()
 , client = redis.createClient();
 var sserver = sio.listen(port);
 sserver.set('log level', 1);
 sserver.set('store', new RedisStore({redisPub:pub,redisSub:sub,redisClient:client}));
 sserver.sockets.on('connection', function (socket) {
   new SioSocket(wserver,socket);
 });
 return sserver;
}