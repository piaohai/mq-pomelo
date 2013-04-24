var EventEmitter = require('events').EventEmitter;
var util = require('util');
var logger = require('pomelo-logger').getLogger(__filename);
var utils = require('../../util/utils');

var MOCK_INCLUDE_FIELDS = ['id', 'sid', 'uid', '__sessionService__'];
var EXPORT_INCLUDE_FIELDS = ['id', 'sid', 'uid', 'settings'];

var ST_INITED = 0;
var ST_CLOSED = 1;

/**
 * Session service manages the sessions for each client connection.
 *
 * Session service is created by session component and is only
 * <b>available</b> in frontend servers. You can access the service by
 * `app.get('sessionService')` in frontend servers.
 *
 * @param {Object} opts constructor parameters
 *                      opts.sendDirectly - whether send the request to the client or cache them until next flush.
 * @class
 * @constructor
 */
var SessionService = function(opts) {
  opts = opts || {};
  this.sendDirectly = opts.sendDirectly;
  this.sessions = {};     // id -> session
  this.uidMap = {};       // uid -> session
  this.msgQueues = {};
};

module.exports = SessionService;

/**
 * Create and return session.
 *
 * @param {Object} opts {key:obj, uid: str,  and etc.}
 * @param {Boolean} force whether replace the origin session if it already existed
 * @return {Session}
 *
 * @memberOf SessionService
 * @api private
 */
SessionService.prototype.create = function(id, sid, socket) {
  var session = new Session(id, sid, socket, this);
  this.sessions[session.id] = session;
  return session;
};

SessionService.prototype.clone = function(session) {
  if (!session) return null;
  var id = session.id;
  var sid = session.sid;
  if (!id) return;
  var __session = this.sessions[id];
  if (!!__session) {
    __session.uid = session.uid;
    __session.settings = session.settings;
    return __session;
  } else {
    var __session = this.create(id,sid,null); 
    if (!!session.uid) {
      this.bind(id,session.uid);
    }
    __session.uid = session.uid;
    __session.settings = session.settings;
    return __session;
  }
};

/**
 * Bind the session with a user id.
 *
 * @memberOf SessionService
 * @api private
 */
SessionService.prototype.bind = function(id, uid, cb) {
  var session = this.sessions[id];
  
  if(!session) {
    if (!!cb) {
      cb(new Error('session not exist, id: ' + id));
    }
    return;
  }

  session.bind(uid);
  if (!!cb) {
    process.nextTick(cb);
  }
};



/**
 * Bind the session with a user id.
 * @memberOf SessionService
 * @api private
 */
SessionService.prototype.unbind = function(id, cb) {
  var session = this.sessions[id];
  if(!session) {
    cb(new Error('session not exist, id: ' + id));
    return;
  }
  var uid = session.uid;
  delete this.uidMap[uid];
  delete this.msgQueues[session.id];
  session.uid = null;
  session.settings = {};
  process.nextTick(cb);
};

/**
 * Get session by id.
 *
 * @param {Number} id The session id
 * @return {Session}
 *
 * @memberOf SessionService
 * @api private
 */
SessionService.prototype.get = function(id) {
  return this.sessions[id];
};

/**
 * Get session by userId.
 *
 * @param {Number} uid User id associated with the session
 * @return {Session}
 *
 * @memberOf SessionService
 * @api private
 */
SessionService.prototype.getByUid = function(uid) {
  return this.uidMap[uid];
};

/**
 * Remove session by key.
 *
 * @param {Number} id The session id
 *
 * @memberOf SessionService
 * @api private
 */
SessionService.prototype.remove = function(id) {
  var session = this.sessions[id];
  if(session) {
    delete this.sessions[session.id];
    delete this.uidMap[session.uid];
    delete this.msgQueues[session.id];
  }
};

/**
 * Import the key/value into session.
 *
 * @api private
 */
SessionService.prototype.import = function(id, key, value, cb) {
  var session = this.sessions[id];
  if(!session) {
    utils.invokeCallback(cb, new Error('session not exist, id: ' + id));
    return;
  }
  session.set(key, value);
  utils.invokeCallback(cb);
};

/**
 * Import new value for the existed session.
 *
 * @memberOf SessionService
 * @api private
 */
SessionService.prototype.importAll = function(id, settings, cb) {
  var session = this.sessions[id];
  if(!session) {
    utils.invokeCallback(cb, new Error('session not exist, id: ' + id));
    return;
  }

  for(var f in settings) {
    session.set(f, settings[f]);
  }
  utils.invokeCallback(cb);
};

/**
 * Kick a user offline by user id.
 *
 * @param {Number}   uid user id asscociated with the session
 * @param {Function} cb  callback function
 *
 * @memberOf SessionService
 */
SessionService.prototype.kick = function(uid, cb) {
  var session = this.getByUid(uid);

  if(session) {
    // notify client
    session.close('kick');
    process.nextTick(function() {
      utils.invokeCallback(cb);
    });
  } else {
    process.nextTick(function() {
      utils.invokeCallback(cb);
    });
  }
};

/**
 * Kick a user offline by session id.
 *
 * @param {Number}   id session id
 * @param {Function} cb  callback function
 *
 * @memberOf SessionService
 */
SessionService.prototype.kickBySessionId = function(id, cb) {
  var session = this.get(id);

  if(session) {
    // notify client
    session.close('kick');
    process.nextTick(function() {
      utils.invokeCallback(cb);
    });
  } else {
    process.nextTick(function() {
      utils.invokeCallback(cb);
    });
  }
};

/**
 * Send message to the client by session id.
 *
 * @param {String} id session id
 * @param {Object} msg message to send
 *
 * @memberOf SessionService
 * @api private
 */
SessionService.prototype.sendMessage = function(id, msg) {
  var session = this.sessions[id];

  if(!session) {
    logger.debug('fail to send message for session not exits');
    return false;
  }

  return send(this, session, msg);
};

SessionService.prototype.broadcast = function(msg) {
  for (var id in this.sessions) {
    var session = this.sessions[id];
    if(!session) {
      logger.debug('fail to send message for session not exits');
      continue;
    }
    send(this, session, msg);
  }
};

/**
 * Send message to the client by user id.
 *
 * @param {String} uid userId
 * @param {Object} msg message to send
 *
 * @memberOf SessionService
 * @api private
 */
SessionService.prototype.sendMessageByUid = function(uid, msg) {
  var session = this.uidMap[uid];

  if(!session) {
    logger.debug('fail to send message by uid for session not exist. uid: %j', uid);
    return false;
  }

  return send(this, session, msg);
};

/**
 * Iterate all the session in the session service.
 *
 * @param  {Function} cb callback function to fetch session
 * @api private
 */
SessionService.prototype.forEachSession = function(cb) {
  for(var id in this.sessions) {
    cb(this.sessions[id]);
  }
};

/**
 * Iterate all the binded session in the session service.
 *
 * @param  {Function} cb callback function to fetch session
 * @api private
 */
SessionService.prototype.forEachBindedSession = function(cb) {
  for(var uid in this.uidMap) {
    cb(this.uidMap[uid]);
  }
};

/**
 * Send message to the client that associated with the session.
 *
 * @api private
 */
var send = function(service, session, msg) {
  if(!msg){
    console.trace();
    console.error(msg);
  }
  //if(service.sendDirectly) {
  if (!!session.__socket__) {
    session.__socket__.send(msg);
  }

  return true;
  //}

  var id = session.id;
  var queue = service.msgQueues[id];
  if(!queue) {
    queue = [];
    service.msgQueues[id] = queue;
  }

  queue.push(msg);
  return true;
};

/**
 * Flush messages to clients.
 *
 * @memberOf SessionService
 * @api private
 */
SessionService.prototype.flush = function() {
  var queues = this.msgQueues, sessions = this.sessions, queue, session;
  for(var id in queues) {
    queue = queues[id];
    if(!queue || queue.length === 0) {
      continue;
    }

    session = sessions[id];
    if(session && session.__socket__) {
      session.__socket__.sendBatch(queue);
    } else {
      logger.debug('fail to send message for socket not exist.');
    }

    delete queues[id];
  }
};

/**
 * Session maintains the relationship between client connect and user information.
 * There is a session associated with each client connect. And it should bind to a
 * user id after the client passes the identification.
 *
 * Session is generated in frontend server and should not be access in handler.
 * in frontend servers.
 */
var Session = function(id, sid, socket, service) {
  EventEmitter.call(this);
  this.id = id;          // r
  this.sid = sid; // r
  this.uid = null;        // r
  this.settings = {};
  // private
  this.__socket__ = socket;
  this.__sessionService__ = service;
  this.__state__ = ST_INITED;
};

util.inherits(Session, EventEmitter);

/**
 * Bind the session with the the uid.
 *
 * @param {Number} uid User id
 * @api public
 */
Session.prototype.bind = function(uid) {
  this.__sessionService__.uidMap[uid] = this;
  this.uid = uid;
  this.emit('bind', uid);
};

/**
 * Set value for the session.
 *
 * @param {String} key session key
 * @param {Object} value session value
 * @api public
 */
Session.prototype.set = function(key, value) {
  this.settings[key] = value;
};

/**
 * Get value from the session.                                                                                                                                 
 *
 * @param {String} key session key
 * @return {Object} value associated with session key
 * @api public
 */
Session.prototype.get = function(key, value) {
  return this.settings[key];
};

/**
 * Closed callback for the session which would disconnect client in next tick.
 *
 * @api public
 */
Session.prototype.close = function(reason) {
  if(this.__state__ === ST_CLOSED) {
    return;
  }
  var self = this;
  this.__state__ = ST_CLOSED;
  self.__sessionService__.remove(self.id);
  if (!!this.__socket__) {
    this.__socket__.emit('close', reason);
  }
  this.emit('close',reason)                                          
  // give a chance to send disconnect message to client
  process.nextTick(function() {
    if (!!this.__socket__) {
      self.__socket__.disconnect();
    }
  });
};

Session.prototype.toJSON = function() {
  return {id:this.id,sid:this.sid,uid:this.uid,settings:this.settings};
};

Session.prototype.export = function() {
  return {id:this.id,sid:this.sid,uid:this.uid,settings:this.settings};
};


