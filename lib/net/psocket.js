var util = require('util');
var EventEmitter = require('events').EventEmitter;
var PSocket = require('./psocket');
var PSession = require('./psession');

var CRequest = require('./prequestc');

var SRequest = require('./prequests');


var ST_INITED = 0;
var ST_CLOSED = 1;

var id = 1;

var sockets = {};

/**
 * Socket class that wraps socket.io socket to provide unified interface for up level.
 */
var PSocket = function(pserver,socket) {
  EventEmitter.call(this);
  this.socket = socket;
  this.pserver = pserver;
  var app = this.pserver.app;
  // this.remoteAddress = {
  //   ip: socket.address().address,
  //   port: socket.address().port
  // };
  this.id = id++;
  var sessionService = app.get('sessionService');
  var serverId = app.get('serverId');
  this.session = sessionService.create(this.id,serverId,this);
  var self = this;
  this.state = ST_INITED;
  socket.on('disconnect', this.emit.bind(this, 'disconnect'));
  socket.on('close', this.emit.bind(this, 'close'));
  socket.on('error', this.emit.bind(this, 'error'));
  socket.on('data', function(data) {
    var msg = self.decode(data);
    console.error('psocket getvvv data %j',msg);
    pserver.handle(self.session,msg,function(err,res){
      if (!!msg.reqId) {res.id = msg.reqId;}
       if (!!err) self.send(err); else self.send(res);
     })   
  });
  this.on('close',function(reason){
    self.disconnect(reason);
  });
};



util.inherits(PSocket, EventEmitter);

module.exports = PSocket;

PSocket.prototype.decode = function(msg){
  if (msg instanceof Buffer){
    msg = msg+'';
  } 
  if (typeof msg==='string') {
    return JSON.parse(msg);
  }
  else { 
    return msg;
  }
}

PSocket.prototype.send = function(msg) {
  if(this.state !== ST_INITED) {
    return;
  }
  if (typeof msg !=='string'){
    msg = JSON.stringify(msg);
  }
  console.error(' psocket too write %j',msg);
  this.socket.write(msg);
  //this.socket.emit('message',msg);
};

PSocket.prototype.disconnect = function(reason) {
  this.session.close(reason);
};

PSocket.prototype.sendBatch = function(msgs) {
  this.send(encodeBatch(msgs));
};



 