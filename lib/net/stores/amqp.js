/**
 * Component for server starup.
 */
var amqp = require('amqp');
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
	this.app.amqp = this;
	this.clients = {};
    this.option = {
		"host": "127.0.0.1",
		"port": 5672,
		"login": "guest",
		"password": "guest",
		"vhost": "/",
		"heartbeat": 12 * 60
    };
   this.implOptions = {
	defaultExchangeName: '',
	reconnect: true , 
	reconnectBackoffStrategy: 'linear',
	reconnectExponentialLimit: 120000, 
	reconnectBackoffTime: 1000
   };
};

module.exports = Component;

Component.prototype.name = '__amqp__';
/**
 * Component lifecycle callback
 *
 * @param {Function} cb
 * @return {Void}
 */
Component.prototype.start = function(serverType,serverId) {
  var self = this;
  var connection = amqp.createConnection(this.options, this.implOptions);
  this.connection = connection;
  var sessionService = self.app.get('sessionService');
  var self = this;
  connection.addListener('ready', function () {
 	connection.exchange(serverType, {durable: true,type:'fanout',passive:false }, function(exc) {
			self.clients[serverType] = exc;
			connection.queue(serverId, {passive: false, durable: true}, function(q) {
	 			q.bind(exc,serverId);
	 			q.subscribe({ack: false}, function(message, headers, deliveryInfo){
					var package = self.app.wserver.decode('rpc',message+'');
					var _session = sessionService.clone(package.session);
				    console.log('connectorconnectorconnector,%j',package);
				    if (package.type===3) {
				    	console.log('============broadcastHandle===============');
						self.app.wserver.broadcastHandle(_session,package.request);
				    } else if (serverId === package.request.to && package.type===2) {
				    	console.log('===========responseHandle================');
						self.app.wserver.responseHandle(_session,package.request);
				    } else  {
						self.app.wserver.selfHandle(_session,package.request,function(err,resp){
							self.app.wserver.response(err,resp,_session,package.request);
						});
					}
				});		
			});	
	});
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
	var serverId = pattern;
	self.app.amqp.connection.publish(serverId,self.app.wserver.encode('rpc',msg));
};

Component.prototype.broadcast = function(pattern,msg) {
	var self = this;
	var serverType = pattern;
	var exc = self.app.amqp.clients[serverType];
	if (!!exc) {
		exc.publish('*',self.encode(request));
	} else {
		self.app.amqp.connection.exchange(serverType, {durable: true,type:'fanout',passive:false }, function(exc) {
			self.app.amqp.clients[serverType] = exc;
			self.app.amqp.clients[serverType].publish('*',self.app.wserver.encode('rpc',msg));
		});
	}
};


