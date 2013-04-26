var util = require('util');
var EventEmitter = require('events').EventEmitter;

var ST_INITED = 0;
var ST_CLOSED = 1;

var id = 1;

/**
 * Socket class that wraps socket.io socket to provide unified interface for up level.
 */
var SioSocket = function(sserver,socket) {
  EventEmitter.call(this);
  var self = this;
  this.socket = socket;
  this.sserver = sserver;
  var app = this.sserver.app;
  this.remoteAddress = {
    ip: socket.handshake.address.address,
    port: socket.handshake.address.port
  };
  this.id = id++;
  var sessionService = app.get('sessionService');
  var serverId = app.get('serverId');
  var aid = serverId + '-' + this.id;
  this.session = sessionService.create(aid,serverId,this);
  socket.on('disconnect', this.emit.bind(this, 'disconnect'));
  socket.on('close', this.emit.bind(this, 'close'));
  socket.on('error', this.emit.bind(this, 'error'));
  socket.on('message', function(data) {
    console.error('SioSocket getvvv data %j',data);
    var msg = sserver.decode('socket',data);
    sserver.handle(self.session,msg,function(err,res){
       if (!!msg.id) {res.id = msg.id;}
       if (!!err) self.send(err); else self.send(res);
     })   
  });
  this.on('close',function(reason){
    self.disconnect(reason);
  });
  this.state = ST_INITED;
};

util.inherits(SioSocket, EventEmitter);

module.exports = SioSocket;


SioSocket.prototype.send = function(msg) {
  if(this.state !== ST_INITED) {
    return;
  }
  if (typeof msg !=='string'){
    msg = JSON.stringify(msg);
  }
  console.error(' SioSocket too write %j',msg);
  this.socket.emit('message',this.sserver.encode('socket',msg));
};

SioSocket.prototype.disconnect = function(reason) {
  this.session.close(reason);
};

SioSocket.prototype.sendBatch = function(msgs) {
  this.send(encodeBatch(msgs));
};



 