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
module.exports = function(app) {
  return new Component(app);
};


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

Component.prototype.name = '__amqp__';
/**
 * Component lifecycle callback
 *
 * @param {Function} cb
 * @return {Void}
 */
Component.prototype.start = function(cb) {
  process.nextTick(cb);
  var connection = amqp.createConnection(this.options, this.implOptions);
  this.connection = connection;
  var self = this;
  var serverType = self.app.set('serverType');
  var serverId = self.app.get('serverId');
  var sessionService = self.app.get('sessionService');
  connection.addListener('ready', function () {
 	connection.exchange(serverType, {durable: true,type:'fanout',passive:false }, function(exc) {
			self.clients[serverType] = exc;
			connection.queue(serverId, {passive: false, durable: true}, function(q) {
	 			q.bind(exc,serverId);
	 			q.subscribe({ack: false}, function(message, headers, deliveryInfo){
					var package = JSON.parse(message.data+'');
					var _session = sessionService.clone(package.session);
				    console.log('connectorconnectorconnector,%j',package);
				    if (package.type===3) {
				    	console.log('============broadcastHandle===============');
						self.app.pserver.broadcastHandle(_session,package.request);
				    } else if (serverId === package.request.to && package.type===2) {
				    	console.log('===========responseHandle================');
						self.app.pserver.responseHandle(_session,package.request);
				    } else  {
						self.app.pserver.selfHandle(_session,package.request,function(err,resp){
							self.app.pserver.response(err,resp,_session,package.request);
						});
					}
				});	
			});	
	});

});
  
};

/**
 * Component lifecycle function
 *
 * @param {Boolean}  force whether stop the component immediately
 * @param {Function}  cb
 * @return {Void}
 */
Component.prototype.stop = function(force, cb) {
  this.connection.close();
  process.nextTick(cb);
};
