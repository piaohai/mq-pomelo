var crc = require('crc');

module.exports = CrcRoute = function(app,session,serverType){
  var list = app.getServersByType(serverType);
  if(!list) {
    cb(new Error('can not find server info for type:' + msg.serverType));
    return;
  }
  var uid = session ? (session.uid || '') : '';
  var index = Math.abs(crc.crc32(uid)) % list.length;
  var serverId = list[index].id;
  return serverId;
}