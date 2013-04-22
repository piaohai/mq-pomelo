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
Component.prototype.start = function(serverType,qn) {
  var self = this;
  var connection = amqp.createConnection(this.options, this.implOptions);
  this.connection = connection;
  var sessionService = self.app.get('sessionService');
  //console.log(this.connection);
  var serverId = qn;
  var self = this;
  connection.addListener('ready', function () {
 	connection.exchange(serverType, {durable: true,type:'fanout',passive:false }, function(exc) {
			self.clients[serverType] = exc;
			connection.queue(qn, {passive: false, durable: true}, function(q) {
	 			q.bind(exc,qn);
	 			q.subscribe({ack: false}, function(message, headers, deliveryInfo){
					var package = JSON.parse(message.data+'');
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

Component.prototype.stop = function(serverType,qn) {
	var self = this;
	console.log(qn);
	this.connection.emit('end');
	this.connection.emit('close');
	this.connection.end();

};


