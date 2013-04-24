var net = require('net');
var TcpSocket = require('../transports/tcpsocket');

module.exports = server = {};

server.listen = function(wserver,port,host) {
  var self = this;
  var sserver = net.createServer(function(socket) {
    new TcpSocket(wserver,socket);
  });
  sserver.listen(port, host);
  sserver.on('close', function() {
    wserver.stop();
  });
  return sserver;
}