var db = require('../config');
var Cookie = require('../models/cookie');

var Cookies = new db.Collection();

Cookies.model = Cookie;

module.exports = Cookies;
