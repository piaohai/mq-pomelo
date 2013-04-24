/**
 * Implementation of server component.
 * Init and start server instance.
 */
 var logger = require('pomelo-logger').getLogger(__filename);
 var pathUtil = require('../util/pathUtil');
 var Loader = require('pomelo-loader');
 var net = require('net');
 var TcpSocket = require('./transports/tcpsocket');
 var SioSocket = require('./transports/siosocket');
 var cluster = require('cluster');
 var crc = require('crc');
 var sio = require('socket.io');
 var Wserver = require('./wserver');

var ST_INITED = 0;    // server inited
var ST_STARTED = 1;   // server started
var ST_STOPED = 2;    // server stoped
/**
 * Server factory function.
 *
 * @param {Object} app  current application context
 * @return {Object} erver instance
 */
 module.exports.create = function(app,opts) {
  return new Cserver(app,opts);
};

var Cserver = function (app,opts) {
  this.app = app;
  this.app.pserver = this;
  this.opts = opts;
  this.state = ST_INITED;
  this.sserver = null;
};

var pro = Cserver.prototype;


/**
 * Server lifecycle callback
 */
 pro.start = function() {
  if(this.state > ST_INITED) {
    return;
  }
  var self = this;
  var numCPUs = this.app.curServer.num || 1;
  var serverType = self.app.get('serverType');
  var serverId = self.app.get('serverId');
  var curServer = self.app.get('curServer');
  if (cluster.isMaster) {
    for (var i = 0; i < numCPUs; i++) {
      cluster.fork();
    }
    var timeouts = [];
    cluster.on('online', function(worker) {
      console.log("Yay, the worker responded after it was forked " + worker.id);
    });
    cluster.on('disconnect', function(worker) {
      console.log('The worker #' + worker.id + ' has disconnected');
    });
    cluster.on('fork', function(worker) {
     timeouts[worker.id] = setTimeout(function() {
      console.error("Something must be wrong with the connection ...");
    }, 2000);
   });
    cluster.on('listening', function(worker, address) {
      console.error('worker ' + worker.process.pid + ' listening');
      clearTimeout(timeouts[worker.id]);
    });
    cluster.on('exit', function(worker, code, signal) {
      console.log('worker ' + worker.process.pid + ' died');
      //cluster.fork();
    });
  } else {
   var worker = cluster.worker;
   if (numCPUs>1) {serverId+='-'+worker.id;}
   this.wserver = new Wserver(self.app);
   this.wserver.start(serverType,serverId);
   var type = !curServer.type?'tcp':curServer.type;
   this[type]();
   this.state = ST_STARTED;
 }
}

pro.tcp = function() {
  var self = this;
  this.sserver = net.createServer(function(socket) {
    new TcpSocket(self.wserver,socket);
  });
  this.sserver.listen(this.app.curServer.port, this.app.curServer.host);
  this.sserver.on('close', function() {
    wserver.stop();
  });
}

pro.socketio = function() {
 var self = this;
 var RedisStore = require('socket.io/lib/stores/redis')
 , redis  = require('socket.io/node_modules/redis')
 , pub    = redis.createClient()
 , sub    = redis.createClient()
 , client = redis.createClient();
 this.sserver = sio.listen(this.app.curServer.port);
 this.sserver.set('log level', 3);
 this.sserver.set('store', new RedisStore({
  redisPub : pub
  , redisSub : sub
  , redisClient : client
}));
 this.sserver.sockets.on('connection', function (socket) {
   new SioSocket(self.wserver,socket);
 });
}

pro.ws = function() {
  this.sserver = net.createServer(function(socket) {
    var psocket = new PSocket(wserver,socket);
  });
  this.sserver.listen(this.app.curServer.port, this.app.curServer.host);
  this.sserver.on('close', function() {
    wserver.stop();
  });
} 
