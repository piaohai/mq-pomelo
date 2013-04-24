
module.exports = Protocol = {};

Protocol.decode = function(msg){
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

Protocol.encode = function(msg){
	return JSON.stringify(msg);
}

/**
 * Parse route string.
 *
 * @param  {String} route route string, such as: serverName.handlerName.methodName
 * @return {Object}       parse result object or null for illeagle route string
 */
Protocol.parseRoute = function(route) {
  if(!route) {
    return null;
  }
  var ts = route.split('.');
  if(ts.length !== 3) {
    return null;
  }
  return {route:route,serverType:ts[0],handler:ts[1], method:ts[2]};
};