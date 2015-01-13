var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var Cookie = db.Model.extend({
  tableName: 'cookies',
  hasTimestamps: true,
  initialize: function(){
  }
});

module.exports = Cookie;
