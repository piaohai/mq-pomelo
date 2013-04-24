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

var servicePath = '/sys/services/';
var compPath = '/sys/components/';
var filterPath = '/sys/filters/';
var prefix = './';

Pomelo.channelService = require(prefix+servicePath+'/channelService');
Pomelo.taskManager = require(prefix+servicePath+'/taskManager');
 
/**
 * Auto-load bundled components with getters.
 */
fs.readdirSync(__dirname + compPath).forEach(function (filename) {
  if (!/\.js$/.test(filename)) {
    return;
  }
  var name = path.basename(filename, '.js');

  function load() {
    return require(prefix+compPath + name);
  }
  Pomelo.components.__defineGetter__(name, load);
  Pomelo.__defineGetter__(name, load);
});

fs.readdirSync(__dirname + filterPath).forEach(function (filename) {
  if (!/\.js$/.test(filename)) {
    return;
  }
  var name = path.basename(filename, '.js');
  function load() {
    return require(prefix+filterPath + name);
  }
  Pomelo.filters.__defineGetter__(name, load);
  Pomelo.__defineGetter__(name, load);
});
