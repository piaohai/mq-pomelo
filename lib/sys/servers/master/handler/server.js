module.exports = function(app) {
  return new Handler(app);
};

var Handler = function(app) {
  this.app = app;
};

/**
 * New client entry chat server.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next stemp callback
 * @return {Void}
 */
Handler.prototype.add = function(request,session,next) {
  var self = this;  
  var id = request.id;
  session.bind(id);
  session.set('serverType',request.serverType);
  var sessionService = this.app.get('sessionService');    
  session.on('close',function(){
    var uid = session.uid; type = session.get('serverType');
    if (!self.app.getServerById(uid)){
      self.app.removeServers([{id:uid,serverType:type}]);
      var msg = {method: 'sync',servers:self.app.servers};
      sessionService.broadcast(msg);
    }
    return;
  });
  if (request.route==='master.server.add'){
    var id = request.id; type = request.serverType;
    if (!self.app.getServerById(id)){
      self.app.addServers([{id:id,serverType:type}]);
      var msg = {method: 'sync',servers:self.app.servers};
      sessionService.broadcast(msg);
    }
    return;
  }
};


