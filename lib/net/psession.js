var EventEmitter = require('events').EventEmitter;
var util = require('util');
var logger = require('pomelo-logger').getLogger(__filename);
var utils = require('../util/utils');

var ST_INITED = 0;
var ST_VAILD = 2;
var ST_INVAILD = 3;
var ST_CLOSED = 1;
/**
 * PSession maintains the relationship between client connect and user information.
 * There is a session associated with each client connect. And it should bind to a
 * user id after the client passes the identification.
 *
 * PSession is generated in frontend server and should not be access in handler.
 * There is a proxy class called LocalPSession in backend servers and MockLocalPSession
 * in frontend servers.
 */
var PSession = function(sid, frontendId, socket, service) {
  EventEmitter.call(this);
  this.id = sid;          // r
  this.frontendId = frontendId; // r
  this.uid = null;        // r
  this.settings = {};

  // private
  this.__socket__ = socket;
  this.__sessionService__ = service;
  this.__state__ = ST_INITED;
};

util.inherits(PSession, EventEmitter);

/**
 * Bind the session with the the uid.
 *
 * @param {Number} uid User id
 * @api public
 */
PSession.prototype.bind = function(uid) {
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
PSession.prototype.set = function(key, value) {
  this.settings[key] = value;
};

/**
 * Get value from the session.
 *
 * @param {String} key session key
 * @return {Object} value associated with session key
 * @api public
 */
PSession.prototype.get = function(key, value) {
  return this.settings[key];
};

/**
 * Closed callback for the session which would disconnect client in next tick.
 *
 * @api public
 */
PSession.prototype.closed = function(reason) {
  if(this.__state__ === ST_CLOSED) {
    return;
  }
  this.__state__ = ST_CLOSED;
  this.__sessionService__.remove(this.id);
  this.emit('closed', this.mockLocalPSession(), reason);
  this.__socket__.emit('closing', reason);

  var self = this;
  // give a chance to send disconnect message to client
  process.nextTick(function() {
    self.__socket__.disconnect();
  });
};

module.exports = PSession;