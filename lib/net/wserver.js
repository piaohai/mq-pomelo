/**
 * Implementation of server component.
 * Init and start server instance.
 */
var logger = require('pomelo-logger').getLogger(__filename);
var pathUtil = require('../util/pathUtil');
var Loader = require('pomelo-loader');
var FilterService = require('../sys/services/filterService');
var HandlerService = require('../sys/services/handlerService');
var crc = require('crc');
var Monitor = require('../sys/components/monitor');
var AMQP = require('../sys/components/amqp');
var Redis = require('../sys/components/redis');

var ST_INITED = 0;    // server inited
var ST_STARTED = 1;   // server started
var ST_STOPED = 2;    // server stoped

var Wserver = function (app,opts) {
  this.app = app;
  this.app.wserver = this;
  this.opts = opts;
  this.filterService = null;
  this.handlerService = null;
  this.state = ST_INITED;
  this.monitor = new Monitor(this.app);
  //this.amqp = new AMQP(this.app);
  this.redis = new Redis(this.app);
};

module.exports = Wserver;

var pro = Wserver.prototype;
 
var initFilter = function(app) {
  var service = new FilterService(app);
  var befores = app.get('__befores__');
  var afters = app.get('__afters__');
  var i, l;
  if(befores) {
    for(i=0, l=befores.length; i<l; i++) {
      service.before(befores[i]);
    }
  }
  if(afters) {
    for(i=0, l=afters.length; i<l; i++) {
      service.after(afters[i]);
    }
  }
  return service;
};

var initHandler = function(app) {
  return new HandlerService(app, loadHandlers(app));
};

/**
 * Load handlers from current application
 */
var loadHandlers = function(app) {
  var p = pathUtil.getHandlerPath(app.getBase(), app.getServerType());
  if(p) {
    return Loader.load(p, app);
  }
};

  
/**
 * Server lifecycle callback
 */
pro.start = function(serverType,serverId) {
  var self = this;
  if(this.state > ST_INITED) {
    return;
  }
  var serverType = serverType;
  var serverId = serverId;
  self.app.set('serverId',serverId);
  self.app.set('serverType',serverType);
  this.filterService = initFilter(this.app);
  this.handlerService = initHandler(this.app);
  self.redis.start(serverType,serverId);
  self.monitor.start(serverType,serverId);
  this.state = ST_STARTED;
};

/**
 * Stop server
 */
pro.stop = function() {
  var self = this;
  var serverType = self.app.get('serverType');
  var serverId = self.app.get('serverId');
  self.redis.stop(serverType,serverId);
  logger.error(' serve host=%j,port=%j closed ',this.host,this.port);
  this.state = ST_STOPED;
};

/**
 * Handle request
 */
pro.handle = function(session,msg,cb) {
  console.error('hhhhhhhhhh',msg);
  var routeRecord = this.parseRoute(msg.route);
  if(!routeRecord) {
    cb(new Error('meet unknown route message %j', msg.route));
    return;
  }
  if(this.app.getServerType() !== routeRecord.serverType) {
    this.doForward(session,msg, routeRecord, cb);
  } else {
    this.doHandle(session,msg, routeRecord, cb);
  }
};

pro.responseHandle = function(session,request){
  console.error('frontedHandlefrontedHandlefrontedHandle%j',request.id);
  if (!!request.id){
    var cbx = callback[request.id]
    cbx.cb(null,request.params);
    delete callback[request.id];
  } 
}

pro.broadcastHandle = function(session,request){
    var toIds = request.toIds; 
    var data = request.params;
    var sessionService = this.app.get('sessionService');
    if (toIds===-1) {
      sessionService.broadcast(data);
    } else {
      for (var index in toIds) {
        var id = toIds[index];
        sessionService.sendMessage(id,data);
      }
    }
}

pro.selfHandle = function(session,request,cb){
    console.error(' selfHandle got %j session = %j',request);
    this.handle(session,request.params,cb);
}


pro.encode = function(msg){
  return JSON.stringify(msg);
}

/**
 * Fire before filter chain if any
 */
pro.beforeFilter = function(msg, session, cb) {
  var fm = this.filterService;
  if(fm) {
    fm.beforeFilter(msg, session, cb);
  } else {
    cb();
  }
};

/**
 * Fire after filter chain if have
 */
pro.afterFilter = function(err, req, session,resp,cb) {
  var fm = this.filterService;
  if(!!fm) {
    fm.afterFilter(err, req, session,resp, cb);
  } else {
    cb();
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
pro.response = function(err,resp,session,req) {
  if (!resp) {
    return;
  }
  var self = this;
  var _session = session==null?null:session.export();
  this.afterFilter(err, req, _session,resp,function(err,res){
      var request = {
        params:resp,
        from:req.to,
        to:req.from,
        id:req.id
      }
      var package = {session:_session, request:request,type:2};
      console.error('mq respnserespnserespnse %j ',package);
      self.publish(req.from,package);
  });
};

pro.broadcast = function(err,resp,serverType,session,req) {
  if (!serverType || !resp) {
    return;
  }
  var self = this;
  var _session = session==null?{}:session.export();
  var toIds = -1;
  // after filter should not interfere response
  this.afterFilter(err, req, _session,resp,function(err,res){
      var request = {
        params:resp,
        toIds:toIds
      }
      var package = {session:_session, request:request,type:3};
      console.error('mq broadcastbroadcast %j ',package);
      self.publish(serverType,package);
      return;
      var exc = self.app.amqp.clients[serverType];
      if (!!exc) {
        exc.publish('*',self.encode(request));
      } else {
        self.app.amqp.connection.exchange(serverType, {durable: true,type:'fanout',passive:false }, function(exc) {
          self.app.amqp.clients[serverType] = exc;
          self.app.amqp.clients[serverType].publish('*',self.encode(package));
        });
      }
  });
};


pro.broadcastByIds = function(err,resp,serverId,toIds,session,req) {
  if (!resp || !toIds || toIds.length<=0) {
    return;
  }
  var self = this;
  var _session = session==null?{}:session.export();
  var toIds = toIds;
  this.afterFilter(err, req, _session,resp,function(err,res){
      var request = {
        params:resp,
        to:serverId,
        toIds:toIds
      }
      var package = {session:_session, request:request,type:3};
      console.error('mq broadcastByIds %j ',package);
      self.publish(serverId,package);
      return;
      self.app.amqp.connection.publish(serverId,self.encode(package));
  });
};


pro.publish = function(pattern,package) {
  console.log('public out data %j,%j',pattern,package);
  this.app.redis.pub.publish(pattern,this.encode(package));
}

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
  return {route:route,serverType:ts[0],handler:ts[1], method:ts[2]};
};


pro.doHandle = function(session,msg,routeRecord, cb) {
  var self = this;
  var handle = function(err, resp) {
    if(err) {
      self.handleError(err, msg, session, resp, function(err) {
        self.response(err, msg, session, resp, cb);
      });
      return;
    }
    self.handlerService.handle(routeRecord, msg, session, cb);
  };  //end of handle
  self.beforeFilter(msg, session, handle);
};


pro.route = function(serverType){
  var session = null; 
  var list = this.app.getServersByType(serverType);
  console.log('route %j',list);
  if(!list) {
    cb(new Error('can not find server info for type:' + msg.serverType));
    return;
  }
  var uid = session ? (session.uid || '') : '';
  var index = Math.abs(crc.crc32(uid)) % list.length;
  var serverId = list[index].id;
  return serverId;
}

var requestId = 1;

var callback = {};

pro.doForward = function(session,msg,routeRecord, cb) {
  var self = this;
  var serverId = self.route(routeRecord.serverType);
  var id = ++requestId;
  var _session = session==null?{}:session.export();
  var selfServerId = self.app.get('serverId');
  var package = {
    session:_session,
    request:{params:msg,from:selfServerId,to:serverId,id:id},
    type:1
  }
  callback[id] = {req:package,cb:cb};
  self.publish(serverId,package);
};


var compressResp = function(route, resp) {
  return resp;
};