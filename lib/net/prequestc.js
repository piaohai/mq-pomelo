var util = require('util');
var EventEmitter = require('events').EventEmitter;
var PSocket = require('./psocket');
var PSession = require('./psession');
var logger = require('pomelo-logger').getLogger(__filename);

var ST_INITED = 0;
var ST_CLOSED = 1;

var id = 1;

/**
 * Socket class that wraps socket.io socket to provide unified interface for up level.
 */
var CRequest = function(psocket) {
  EventEmitter.call(this);
  this.id = id++;
  var self = this;
  this.psocket = psocket;
  var pserver = this.psocket.pserver;
  psocket.socket.on('data', function(msg) {
    pserver.handle(msg,function(err,res){
       console.error(' client type client message %j',res);
       if (!!err) {
        self.psocket.send(err);
       } else {
          self.psocket.send(res);
        }
     })   
  });

  // TODO: any other events?
};

util.inherits(CRequest, EventEmitter);

var pro = CRequest.prototype;

module.exports = CRequest;
