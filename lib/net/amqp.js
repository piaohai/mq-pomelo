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

module.exports = Component


Component.prototype.name = '__amqp__';
/**
 * Component lifecycle callback
 *
 * @param {Function} cb
 * @return {Void}
 */
Component.prototype.start = function(serverType,qn) {
  var connection = amqp.createConnection(this.options, this.implOptions);
  this.connection = connection;
  //console.log(this.connection);
  var self = this;
  connection.addListener('ready', function () {
 	connection.exchange(serverType, {durable: true,type:'fanout',passive:false }, function(exc) {
			self.clients[serverType] = exc;
			connection.queue(qn, {passive: false, durable: true}, function(q) {
	 			q.bind(exc,qn);
	 			q.subscribe({ack: false}, function(message, headers, deliveryInfo){
					var request = JSON.parse(message.data+'');
				    if (serverType==='connector') {
				    	var _session = sessionService.clone(request.session);
				    	console.log('connectorconnectorconnector,%j',request.session);
						self.app.pserver.frontedHandle(_session,request.params,request.toIds,function(err,resp){
							console.error(' connector response %j ',resp);
							self.app.pserver.response(err,resp,_session,request.params);
						});
				    } else  {
				    	var _session = sessionService.clone(request.session);
				    	console.log('connectorconnectorconnector,%j',request.session);
						self.app.pserver.handle(_session,request.params,function(err,resp){
							console.error(' other response %j ',resp);
							self.app.pserver.response(err,resp,_session,request.params);
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


