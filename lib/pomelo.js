/*!
 * Pomelo
 * Copyright(c) 2012 xiechengchao <xiecc@163.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

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

var self = this;

/**
 * Get application
 */
Object.defineProperty(Pomelo, 'app', {
  get:function () {return self.app;}
});




/**
 * Create an pomelo application.
 *
 * @return {Application}
 * @memberOf Pomelo
 * @api public
 */
Pomelo.createApp = function (opts) {
  application.init(Pomelo,opts);
  self.app = application;
  return self.app;
};
