var ChannelService = require('../services/channelService');

module.exports = function(app, opts) {
  var service = new ChannelService(app, opts);
  app.set('channelService', service, true);
  service.name = '__channel__';
  return service;
};