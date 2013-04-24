var WebSocketServer = require('ws').Server;
var WebSocket = require('../transports/wssocket');

module.exports = server = {};

server.listen = function(wserver,port,host) {
  var sserver = new WebSocketServer({port: port});
  sserver.on('connection', function(socket) {
    new WebSocket(wserver,socket);
  });
  sserver.on('close', function() {
    wserver.stop();
  });
  return sserver;
} 
