/*!
 * Pomelo
 * Copyright(c) 2012 xiechengchao <xiecc@163.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */
var fs = require('fs');
var path = require('path');
var application = require('./sys/application');


/**
 * Expose `createApplication()`.
 *
 * @module
 */

var Pomelo = module.exports = {};

/**
 * Framework version.
 */

Pomelo.version = '0.3.1';
/**
 * auto loaded components
 */
Pomelo.components = {};

/**
 * auto loaded filters
 */
Pomelo.filters = {};

/**
 * connectors
 */
Pomelo.connectors = {};
Pomelo.connectors.__defineGetter__('sioconnector', function() {
  return require('./connectors/sioconnector');
});

Pomelo.connectors.__defineGetter__('hybridconnector', function() {
  return require('./connectors/hybridconnector');
});

var self = this;

/**
 * Create an pomelo application.
 *
 * @return {Application}
 * @memberOf Pomelo
 * @api public
 */
Pomelo.createApp = function (opts) {
  var app = application;
  app.init(opts);
  self.app = app;
  return app;
};

/**
 * Get application
 */
Object.defineProperty(Pomelo, 'app', {
  get:function () {
    return self.app;
  }
});

Pomelo.channelService = require('./sys/service/channelService');
Pomelo.taskManager = require('./sys/service/taskManager');

/**
 * Auto-load bundled components with getters.
 */
fs.readdirSync(__dirname + '/components').forEach(function (filename) {
  if (!/\.js$/.test(filename)) {
    return;
  }
  var name = path.basename(filename, '.js');

  function load() {
    return require('./components/' + name);
  }
  Pomelo.components.__defineGetter__(name, load);
  Pomelo.__defineGetter__(name, load);
});

fs.readdirSync(__dirname + '/sys/filters/handler').forEach(function (filename) {
  if (!/\.js$/.test(filename)) {
    return;
  }
  var name = path.basename(filename, '.js');

  function load() {
    return require('./sys/filters/handler/' + name);
  }
  Pomelo.filters.__defineGetter__(name, load);
  Pomelo.__defineGetter__(name, load);
});
