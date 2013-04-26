var util = require('util');
var EventEmitter = require('events').EventEmitter;

var ST_INITED = 0;
var ST_CLOSED = 1;

var id = 1;

/**
 * Socket class that wraps socket.io socket to provide unified interface for up level.
 */
var TcpSocket = function(sserver,socket) {
  EventEmitter.call(this);
  this.socket = socket;
  this.sserver = sserver;
  var app = this.sserver.app;
  this.remoteAddress = {
    ip: socket.address().address,
    port: socket.address().port
  };
  this.id = id++;
  var sessionService = app.get('sessionService');
  var serverId = app.get('serverId');
  var aid = serverId + '-' + this.id;
  this.session = sessionService.create(aid,serverId,this);
  var self = this;
  socket.on('disconnect', this.emit.bind(this, 'disconnect'));
  socket.on('close', this.emit.bind(this, 'close'));
  socket.on('error', this.emit.bind(this, 'error'));
  socket.on('data', function(data) {
    var msg = sserver.decode('socket',data);
    console.error('TcpSocket getvvv data %j',msg);
    sserver.handle(self.session,msg,function(err,res){
       if (!!msg.id) {res.id = msg.id;};
       if (!!err) self.send(err); else self.send(res);
     })   
  });
  this.on('close',function(reason){
    self.disconnect(reason);
  });
  this.state = ST_INITED;
};


util.inherits(TcpSocket, EventEmitter);

module.exports = TcpSocket;

var pro = TcpSocket.prototype;


pro.send = function(msg) {
  if(this.state !== ST_INITED) {
    return;
  }
  if (typeof msg !=='string'){
    msg = JSON.stringify(msg);
  }
  console.error(' TcpSocket too write %j',msg);
  this.socket.write(this.sserver.encode('socket',msg));
};

pro.disconnect = function(reason) {
  this.session.close(reason);
};

pro.sendBatch = function(msgs) {
  this.send(encodeBatch(msgs));
};



 