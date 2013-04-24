var countDownLatch = require('../../util/countDownLatch');
var utils = require('../../util/utils');
var logger = require('pomelo-logger').getLogger(__filename);
var async = require('async');

/**
 * constant
 */
var DEFAULT_GROUP_ID = 'default';

var ST_INITED = 0;
var ST_DESTROYED = 1;

/**
 * Create and maintain channels for server local.
 *
 * ChannelService is created by channel component which is a default loaded
 * component of pomelo and channel service would be accessed by `app.get('channelService')`.
 *
 * @class
 * @constructor
 */
var ChannelService = function(app, opts) {
  opts = opts || {};
  this.app = app;
  this.sessionService = app.get('sessionService');
  this.channels = {};
  this.uidChannles = {};
  this.broadcastFilter = opts.broadcastFilter;
};

module.exports = ChannelService;

/**
 * Create channel with name.
 *
 * @param {String} name channel's name
 * @memberOf ChannelService
 */
ChannelService.prototype.createChannel = function(name) {
  if(this.channels[name]) {
    return this.channels[name];
  }
  var c = new Channel(name, this);
  this.channels[name] = c;
  return c;
};

ChannelService.prototype.leave = function(uid) {
  for (var name in this.channels){
    var channel = this.channels[name];
    var s = channel.getMember(uid);
    if (!!s) {
        channel.leave(uid);
    } 
  }
  return true;
};


/**
 * Get channel by name.
 *
 * @param {String} name channel's name
 * @param {Boolean} create if true, create channel
 * @return {Channel}
 * @memberOf ChannelService
 */
ChannelService.prototype.getChannel = function(name, create) {
  var channel = this.channels[name];
  if(!channel && !!create) {
    channel = this.channels[name] = new Channel(name, this);
  }
  return channel;
};

/**
 * Destroy channel by name.
 *
 * @param {String} name channel name
 * @memberOf ChannelService
 */
ChannelService.prototype.destroyChannel = function(name) {
  delete this.channels[name];
};

/**
 * Push message by uids.
 * Group the uids by group. ignore any uid if sid not specified.
 *
 * @param {String} route message route
 * @param {Object} msg message that would be sent to client
 * @param {Array} uids the receiver info list, [{uid: userId, sid: frontendServerId}]
 * @param {Function} cb cb(err)
 * @memberOf ChannelService
 */
ChannelService.prototype.pushMessageByUids = function(resp,uids,req, cb) {
  console.log('pushMessageByUidspushMessageByUids%j',uids);
  if(!uids || uids.length === 0 || !resp) {
    utils.invokeCallback(cb, new Error('uids should not be empty'));
    return;
  }
 var groups = {};
  for(var i=0, l=uids.length; i<l; i++) {
    var uid = uids[i];
    var session = this.sessionService.getByUid(uid);
    if (!session){
      continue; 
    }
    var sid = session.sid;
    add(uid, sid, groups);
  }
  sendMessageByGroup(this, req, resp, groups, cb);
};

/**
 * Broadcast message to all the connected clients.
 *
 * @param  {String}   stype      frontend server type string
 * @param  {String}   route      route string
 * @param  {Object}   msg        message
 * @param  {Boolean}  opts       broadcast options. opts.binded: push to binded sessions or all the sessions
 * @param  {Function} cb         callback
 * @memberOf ChannelService
 */
ChannelService.prototype.broadcast = function(resp,serverType,req,cb) {
  if(!serverType || !resp) {
    cb();
    return;
  }
  var app = this.app;
  app.wserver.broadcast(null,resp,serverType,null,req);
  if (!!cb) cb();
};

/**
 * Channel maintains the receiver collection for a subject. You can
 * add users into a channel and then broadcast message to them by channel.
 *
 * @class channel
 * @constructor
 */
var Channel = function(name, service) {
  this.name = name;
  this.groups = {};       // group map for uids. key: sid, value: [uid]
  this.records = {};      // member records. key: uid
  this.__channelService__ = service;
  this.count = 0;
  this.state = ST_INITED;
};

/**
 * Add user to channel.
 *
 * @param {Number} uid user id
 * @param {String} sid frontend server id which user has connected to
 */
Channel.prototype.add = function(uid) {
  if(this.state > ST_INITED) {
    return false;
  } else {
    var session = this.__channelService__.sessionService.getByUid(uid);
    if (!session){
      console.error('session is not bind, add failed');
      return ;
    }
    var sid = session.sid;
    var res = add(uid, sid, this.groups);
    if(res) {
      this.records[uid] = {sid: sid, uid: uid};
    }
    this.count++;
    return res;
  }
};

/**
 * Remove user from channel.
 *
 * @param {Number} uid user id
 * @param {String} sid frontend server id which user has connected to.
 * @return [Boolean] true if success or false if fail
 */
Channel.prototype.leave = function(uid) {
  if(!uid) {
    return false;
  }
  var session = this.__channelService__.sessionService.getByUid(uid);
  if (!session){
    console.error('session is not bind, add failed');
    return ;
  }
  var sid = session.sid;
  delete this.records[uid];
  return deleteFrom(uid, sid, this.groups[sid]);
  this.count--;
};

/**
 * Get channel members.
 *
 * <b>Notice:</b> Heavy operation.
 *
 * @return {Array} channel member uid list
 */
Channel.prototype.getMembers = function() {
  var res = [], groups = this.groups;
  var group, i, l;
  for(var sid in this.groups) {
    group = this.groups[sid];
    for(i=0, l=group.length; i<l; i++) {
      res.push(group[i]);
    }
  }
  return res;
};

/**
 * Get Member info.
 *
 * @param  {String} uid user id
 * @return {Object} member info
 */
Channel.prototype.getMember = function(uid) {
  return this.records[uid];
};

/**
 * Destroy channel.
 */
Channel.prototype.destroy = function() {
  this.state = ST_DESTROYED;
  this.__channelService__.destroyChannel(this.name);
};

/**
 * Push message to all the members in the channel
 *
 * @param {String} route message route
 * @param {Object} msg message that would be sent to client
 * @param {Functioin} cb callback function
 */
Channel.prototype.pushMessage = function(resp,req,cb) {
  if(this.state !== ST_INITED) {
    utils.invokeCallback(new Error('channel is not running now'));
    return;
  }

  sendMessageByGroup(this.__channelService__, req, resp, this.groups, cb);
};

/**
 * add uid and sid into group. ignore any uid that uid not specified.
 *
 * @param uid user id
 * @param sid server id
 * @param groups {Object} grouped uids, , key: sid, value: [uid]
 */
var add = function(uid, sid, groups) {
  if(!sid) {
    logger.warn('ignore uid %j for sid not specified.', uid);
    return false;
  }

  var group = groups[sid];
  if(!group) {
    group = [];
    groups[sid] = group;
  }

  group.push(uid);
  return true;
};

/**
 * delete element from array
 */
var deleteFrom = function(uid, sid, group) {
  if(!group) {
    return true;
  }

  for(var i=0, l=group.length; i<l; i++) {
    if(group[i] === uid) {
      group.splice(i, 1);
      return true;
    }
  }

  return false;
};

/**
 * push message by group
 *
 * @param route {String} route route message
 * @param msg {Object} message that would be sent to client
 * @param groups {Object} grouped uids, , key: sid, value: [uid]
 * @param cb {Function} cb(err)
 *
 * @api private
 */
var sendMessageByGroup = function(channelService, req, resp, groups, cb) {
  var count = utils.size(groups);
  if(count === 0) {
    utils.invokeCallback(cb);
    return;
  }
  var app = channelService.app;
  for(var sid in groups) {
    var uids = groups[sid];
    var ids = [];
    if (uids.length<=0) continue;
    for (var i=0;i<uids.length;i++){
     var uid = uids[i];
     var session = channelService.sessionService.getByUid(uid);
     ids.push(session.id);
    }
    app.wserver.broadcastByIds(null,resp,sid,ids,null,req);
  }

};
