var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var uuid = require('uuid');
var bcrypt = require('bcrypt-nodejs');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Cookie = require('./app/models/cookie');
var Cookies = require('./app/collections/cookies');
var Click = require('./app/models/click');
var session = require('express-session');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
app.use(cookieParser());
// Parse forms (signup/login)
app.use(session({
  secret: 'hack',
  resave: false,
  saveUninitialized: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.get('/', function(req, res) {
  // console.log(req.cookies);
  var username = req.cookies.username;
  var sid = req.cookies.sid;

  if(!username){
    res.redirect('/login');
  } else {
    util.userExists(username,function(err,data){
      if(!err){
        util.inSession(sid,function(err,data){
          if(!err){
            res.render('index');
          } else {
            res.redirect('/login')
          }
        })
      } else {
        res.redirect('/signup');
      }
    });
  }
});

app.get('/create', function(req, res) {
  if(req.session.username){
    res.render('index');
  } else {
    res.redirect('/login');
  }
});

app.get('/links', function(req, res) {
  var username = req.cookies.username;
  var sid = req.cookies.sid;


  if(!!username){
    util.inSession(sid,function(err,cookie){
      if(!err){
        console.log(cookie);
        if(cookie[0].username === username){
          Links.reset().fetch().then(function(links) {
            res.send(200, links.models);
          });
        } else {
          res.redirect('/login');
        }
      } else {
        res.redirect('/login');
      }
    })
  }
});

app.get('/login', function(req,res){
  res.render('login');
});

app.get('/signup', function(req,res){
  res.render('signup');
});

app.get('/logout',function(req,res){
  res.clearCookie('username');
  res.clearCookie('sid');
  res.redirect('/')
})

app.post('/login',function(req,res){
  var username = req.body.username;
  var password = req.body.password;

  new User({username: username})
    .fetch()
    .then(function(user){
      if(!user){
        res.redirect('/signup');
      } else {
        user.comparePassword(req.body.password,function(match){
          if(match){
            util.serveCookie(req.body.username,function(err,cookie){
              if(!err){
                res.cookie('username',cookie.username);
                res.cookie('sid',cookie.sid);
                res.redirect('/');
              }
            });
          } else {
            res.redirect('/login');
          }
        });
      }
    })
});

app.post('/signup',function(req,res){
  var user = new User({
    username: req.body.username,
    password: req.body.password
  });

  user.save().then(function(newUser) {
    Users.add(newUser);
    var sid = uuid.v4();
    var username = newUser.get('username');

    util.serveCookie(username,function(err,cookie){
      res.cookie('username',cookie.username);
      res.cookie('sid',cookie.sid);
      res.redirect('/');
    });
  }).catch(function(err){
    res.render('dupsignup');
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  if(req.url !== '/favicon.ico'){
    //console.log('catch up',req.url)
    new Link({ code: req.params[0] }).fetch().then(function(link) {
      if (!link) {
        res.redirect('/');
      } else {
        var click = new Click({
          link_id: link.get('id')
        });

        click.save().then(function() {
          db.knex('urls')
            .where('code', '=', link.get('code'))
            .update({
              visits: link.get('visits') + 1,
            }).then(function() {
              return res.redirect(link.get('url'));
            });
        });
      }
    });
  }
});

console.log('Shortly is listening on 4568');
app.listen(4568);
