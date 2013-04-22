/**
 * Implementation of server component.
 * Init and start server instance.
 */
var logger = require('pomelo-logger').getLogger(__filename);
var pathUtil = require('../util/pathUtil');
var Loader = require('pomelo-loader');
var FilterService = require('../common/service/filterService');
var HandlerService = require('../common/service/handlerService');
var net = require('net');
var PSocket = require('./psocket');
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var crc = require('crc');
var sio = require('socket.io');
var SServer = require('./sserver');

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
  return new PServer(app,opts);
};

var PServer = function (app,opts) {
  this.app = app;
  this.app.pserver = this;
  this.opts = opts;
  this.filterService = null;
  this.handlerService = null;
  this.state = ST_INITED;
  this.server = null;
};

var pro = PServer.prototype;

function errorMsg() {
  console.error("Something must be wrong with the connection ...");
}

pro.start1 = function() {
  if(this.state > ST_INITED) {
    return;
  }
  var self = this;
  {
   var net = require('net');
   this.server = net.createServer(function(socket) {
      var psocket = new PSocket(self,socket);
    });
   this.server.listen(this.app.curServer.port, this.app.curServer.host);
   this.server.on('close', function() {
      // cleanup
    });
   }
  this.state = ST_STARTED;
};


pro.start2 = function() {
  if(this.state > ST_INITED) {
    return;
  }
  var self = this;
  this.filterService = initFilter(this.app);
  this.handlerService = initHandler(this.app);
  this.wsocket = sio.listen(this.app.curServer.port);
  this.wsocket.set('log level', 1);
  this.wsocket.sockets.on('connection', function (socket) {
    var psocket = new PSocket(self,socket);
  });
  this.state = ST_STARTED;
};


/**
 * Server lifecycle callback
 */
pro.start = function() {
  var self = this;
  var numCPUs = this.app.curServer.num || 1;
  var serverType = self.app.get('serverType');
  var serverId = self.app.get('serverId');

  if(this.state > ST_INITED) {
    return;
  }

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
      var qn = serverId;
      if (numCPUs>1) {
        qn+='-'+worker.id;
      }
      self.amqp.stop(serverType,qn);
    });
    cluster.on('fork', function(worker) {
     timeouts[worker.id] = setTimeout(errorMsg, 2000);
   });
    cluster.on('listening', function(worker, address) {
      clearTimeout(timeouts[worker.id]);
      var qn = serverId;
      if (numCPUs>1) {
        qn+='-'+worker.id;
      }
      var server = new SServer(self.app);
      server.start(serverType,qn);
    });
    cluster.on('exit', function(worker, code, signal) {
      console.log('worker ' + worker.process.pid + ' died');
      cluster.fork();
    });
  } else {
   var net = require('net');
   this.server = net.createServer(function(socket) {
      var psocket = new PSocket(self,socket);
    });
   this.server.listen(this.app.curServer.port, this.app.curServer.host);
   this.server.on('close', function() {
      // cleanup
    });
   }
  this.state = ST_STARTED;
};
