var async = require('async');
var log = require('./log');
var logger = require('pomelo-logger').getLogger(__filename);

/**
 * Initialize application configuration.
 */
module.exports.defaultConfiguration = function (app) {
  var args = parseArgs(process.argv);
  setupEnv(app, args);
  loadServers(app);
  processArgs(app, args);
  configLogger(app);
};

/**
 * Load default components for application.
 */
module.exports.loadDefaultComponents = function(app) {
  var pomelo = require('../pomelo');
  // load system default components
  app.load(pomelo.session, app.get('sessionConfig'));
  app.load(pomelo.channel, app.get('channelConfig'));
  app.load(pomelo.server, app.get('serverConfig'));
  return;
};

/**
 * Stop components.
 *
 * @param  {Array}  comps component list
 * @param  {Number}   index current component index
 * @param  {Boolean}  force whether stop component immediately
 * @param  {Function} cb
 */
module.exports.stopComps = function(comps, index, force, cb) {
  if(index >= comps.length) {
    cb();
    return;
  }
  var comp = comps[index];
  if(typeof comp.stop === 'function') {
    comp.stop(force, function() {
      // ignore any error
      module.exports.stopComps(comps, index +1, force, cb);
    });
  } else {
    module.exports.stopComps(comps, index +1, force, cb);
  }
};

/**
 * Apply command to loaded components.
 * This method would invoke the component {method} in series.
 * Any component {method} return err, it would return err directly.
 *
 * @param {Array} comps loaded component list
 * @param {String} method component lifecycle method name, such as: start, stop
 * @param {Function} cb
 */
 module.exports.optComponents = function(comps, method, cb) {
  for (var n in comps) {
    var comp = comps[n];
    if(typeof comp[method] === 'function') {
      comp[method](cb);
    } 
  }
};

/**
 * Load server info from config/servers.json.
 */
var loadServers = function(app) {
  app.loadConfig('servers', app.getBase() + '/config/servers.json');
  var servers = app.get('servers');
  var serverMap = {}, slist, i, l, server;
  for(var serverType in servers) {
    slist = servers[serverType];
    for(i=0, l=slist.length; i<l; i++) {
      server = slist[i];
      server.serverType = serverType;
       if (serverType==='master'){
        app.set('master',server);
       }
      serverMap[server.id] = server;
    }
  }
  app.set('__serverMap__', serverMap);
};


/**
 * Process server start command
 */
var processArgs = function(app, args){
  var serverId = args.id;
  app.set('main', args.main, true);
  if (!serverId) {
    args = app.getServersByType('master')[0];
  } else {
    args = app.getServerById(serverId);
  }
  app.set('serverType', args.serverType, true);
  app.set('serverId', args.id, true);
  app.set('curServer', args, true);
};

/**
 * Setup enviroment.
 */
var setupEnv = function(app, args) {
  app.set('env', args.env || process.env.NODE_ENV || 'development', true);
};

var configLogger = function(app) {
  if(process.env.POMELO_LOGGER !== 'off') {
    log.configure(app, app.getBase() + '/config/log4js.json');
  }
};

/**
 * Parse command line arguments.
 *
 * @param args command line arguments
 *
 * @return Object args_map map of arguments
 */
var parseArgs = function (args) {
  var args_map = {};
  var main_pos = 1;

  while(args[main_pos].indexOf('--')>0){
    main_pos++;
  }

  args_map.main = args[main_pos];

  for (var i = (main_pos+1); i < args.length; i++) {
    var str = args[i].split('=');
    var value = str[1];
    if(!isNaN(parseInt(str[1],10)) && (str[1].indexOf('.')<0))
      value = parseInt(str[1],10);
    args_map[str[0]] = value;
  }
  return args_map;
};
