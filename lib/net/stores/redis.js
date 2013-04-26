/**
 * Component for server starup.
 */
 var redis  = require('socket.io/node_modules/redis')

var REQUEST = 1;
var REQPONSE = 2;
var BROADCAST = 3;
/**
 * Component factory function
 *
 * @param {Object} app  current application context
 * @return {Object}     component instance
 */
/**
 * Server component class
 * @param {Object} app  current application context
 */
var Component = function(app,opts) {
	this.app = app;
	this.app.redis = this;
	this.clients = {};
    this.option = opts;
};

module.exports = Component;

Component.prototype.name = '__redis__';

/**
 * Component lifecycle callback
 *
 * @param {Function} cb
 * @return {Void}
 */
Component.prototype.start = function(serverType,serverId) {
  var self = this;
  self.pub    = redis.createClient()
  self.sub    = redis.createClient()
  self.client = redis.createClient();
  var sessionService = self.app.get('sessionService');
  self.sub.psubscribe(serverType+'*');
  self.sub.subscribe(serverId);
  self.sub.on('pmessage',function (pattern,ch, message) {
  	var package = self.app.wserver.decode('rpc',message+'');
  	var _session = sessionService.clone(package.session);
  	 console.log('connectorconnectorconnector,%j',package);
  	if (package.type===BROADCAST) {
  		console.log('============broadcastHandle===============');
  		self.app.wserver.broadcastHandle(_session,package.request);
  	} else if (serverId === ch && package.type===REQPONSE) {
  		console.log('===========responseHandle================');
  		self.app.wserver.responseHandle(_session,package.request);
  	} else {
  		self.app.wserver.selfHandle(_session,package.request,function(err,resp){
  			self.app.wserver.response(err,resp,_session,package.request);
  		});
  	}
  });
};

Component.prototype.stop = function(serverType,serverId) {
	var self = this;
	this.connection.emit('end');
	this.connection.emit('close');
	this.connection.end();
};

Component.prototype.response = function(pattern,msg) {
	var self = this;
	this.pub.publish(pattern,self.app.wserver.encode('rpc',msg));
};

Component.prototype.broadcast = function(pattern,msg) {
	var self = this;
	this.pub.publish(pattern,self.app.wserver.encode('rpc',msg));
};



