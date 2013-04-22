var util = require('util');
var EventEmitter = require('events').EventEmitter;
var PSocket = require('./psocket');
var PSession = require('./psession');
var logger = require('pomelo-logger').getLogger(__filename);

var ST_INITED = 0;
var ST_CLOSED = 1;

var id = 1;

/**
 * Socket class that wraps socket.io socket to provide unified interface for up level.
 */
var SRequest = function(psocket) {
  EventEmitter.call(this);
  this.id = id++;
  var self = this;
  this.psocket = psocket;
  this.pserver = psocket.pserver;
  this.app = psocket.pserver.app;
  this.psession = psocket.psession;
  psocket.socket.on('data', function(data) {
    console.log(' server============== client');
    var msg = self.decode(data);
    self.handle(msg,function(err,res){
       console.error(' server client go handler err dataId %j %j',err,res);
       if (!!err) {
        self.psocket.send(err);
        return;
       } else {
        if (!!msg.id) {
          self.psocket.send({id:msg.id,res:res});
        } else {
          console.log(' server ============== client senddddd');
          self.psocket.send(res);
        }
       }
     })   
  });

  // TODO: any other events?
};

util.inherits(SRequest, EventEmitter);

var pro = SRequest.prototype;

module.exports = SRequest;
/**
 * Handle request
 */
pro.handle = function(msg, cb) {
  console.log('msg handle got %j',msg);
  if (!!msg.id){
      if (msg.msg.serverType===this.app.getServerType()){
        var m = msg.msg.args[0];
        var r = this.parseRoute(m.route);
        this.doHandle(m, r, cb);
      }
  } else {
    var routeRecord = this.parseRoute(msg.route);
    if(!routeRecord) {
      cb(new Error('meet unknown route message %j', msg.route));
      return;
    }
    if(this.app.getServerType() !== routeRecord.serverType) {
      this.doForward(msg, routeRecord, cb);
    } else {
      this.doHandle(msg, routeRecord, cb);
    }
  }
};

pro.decode = function(msg){
  return JSON.parse(msg+'');
}

/**
 * Fire before filter chain if any
 */
beforeFilter = function(server, msg, session, cb) {
  var fm = server.filterService;
  if(fm) {
    fm.beforeFilter(msg, session, cb);
  } else {
    cb();
  }
};

/**
 * Fire after filter chain if have
 */
var afterFilter = function(server, err, msg, session, resp) {
  var fm = server.filterService;
  if(fm) {
    fm.afterFilter(err, msg, session, resp, function() {
      // do nothing
    });
  }
};

/**
 * pass err to the global error handler if specified
 */
pro.handleError = function(server, err, msg, session, resp, cb) {
  var handler = server.app.get('errorHandler');
  if(!handler) {
    logger.debug('no default error handler to resolve unknown exception. ' + err.stack);
    cb(err);
  } else {
    handler(err, msg, session, cb);
  }
};

/**
 * Send response to client and fire after filter chain if any.
 */
pro.response = function(err, msg, session, resp, cb) {
  var server = this.pserver;
  if(resp) {
    resp = compressResp(msg.route, resp);
  }
  cb(err, resp);
  // after filter should not interfere response
  afterFilter(server, err, msg, session, resp);
};

/**
 * Parse route string.
 *
 * @param  {String} route route string, such as: serverName.handlerName.methodName
 * @return {Object}       parse result object or null for illeagle route string
 */
pro.parseRoute = function(route) {
  if(!route) {
    return null;
  }
  var ts = route.split('.');
  if(ts.length !== 3) {
    return null;
  }
  return {route: route, serverType: ts[0], handler: ts[1], method: ts[2]
  };
};


pro.doHandle = function(msg,routeRecord, cb) {
  var session = this.psession;
  msg = msg.body;
  var server = this.pserver;
  var self = this;
  var handle = function(err, resp) {
      if(err) {
        self.handleError(err, msg, session, resp, function(err) {
          self.response(err, msg, session, resp, cb);
        });
        return;
       }
    console.error(' dddddddddddddddddddo handle %j  rouyte %j',msg,routeRecord);
    server.handlerService.handle(routeRecord, msg, session, function(err, resp) {
      if(err) {
        //error from handler
        self.handleError(err, msg, session, resp, function(err, resp) {
          self.response(err, msg, session, resp, cb);
        });
        return;
      }
      self.response(err, msg, session, resp, cb);
    });
  };  //end of handle

  beforeFilter(server, msg, session, handle);
};


pro.doForward = function(msg,routeRecord, cb) {
  var finished = false;
  var self = this;
  var session = this.psession;
  console.error('ffffffffffffffffff %j',msg);
  //should route to other servers
  try {
    this.app.sysrpc[routeRecord.serverType].msgRemote.forwardMessage(
      session,
      msg,
      function(err, resp) {
        if(err) {
          logger.error('fail to process remote message:' + err.stack);
        }
        finished = true;
        if(resp) {
          resp = compressResp(msg.route, resp);
        }
        cb(err, resp);
      }
    );
  } catch(err) {
    if(!finished) {
      logger.error('fail to forward message:' + err.stack);
      cb(err);
    }
  }
};


var compressResp = function(route, resp) {
  return resp;
};