/**
 * Component for server starup.
 */
var PServer = require('../net/pserver');

/**
 * Component factory function
 *
 * @param {Object} app  current application context
 * @return {Object}     component instance
 */
module.exports = function(app) {
  return new Component(app);
};

/**
 * Server component class
 *
 * @param {Object} app  current application context
 */
var Component = function(app,opts) {
  this.server = PServer.create(app,opts);
};


Component.prototype.name = '__server__';

/**
 * Component lifecycle callback
 *
 * @param {Function} cb
 * @return {Void}
 */
Component.prototype.start = function(cb) {
  this.server.start();
  process.nextTick(cb);
};

/**
 * Component lifecycle function
 *
 * @param {Boolean}  force whether stop the component immediately
 * @param {Function}  cb
 * @return {Void}
 */
Component.prototype.stop = function(force, cb) {
  this.server.stop();
  process.nextTick(cb);
};