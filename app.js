let express = require('express');
let request = require('request');
let cors = require('cors');
let querystring = require('querystring');
let cookieParser = require('cookie-parser');
let nunjucks = require('nunjucks')
require('dotenv').config()

const client_id = '544791d85ebe4e5e80ef49ac39d23001';
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = 'https://interactive-spotify.herokuapp.com/callback';

let access_tokens = new Map();

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
let generateRandomString = function(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const stateKey = 'spotify_auth_state';

let app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

nunjucks.configure('views', {
  autoescape: true,
  express: app
});

app.get('/', function(req, res) {
  res.redirect('/login')
});

app.get('/login', function(req, res) {

  let state = generateRandomString(16);
  let uid = generateRandomString(16);
  res.cookie(stateKey, state);
  res.cookie('uid', uid);

  // your application requests authorization
  let scope = 'user-read-private user-read-email user-top-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    let authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        let uid = req.cookies['uid'];
        access_tokens.set(uid, body.access_token);

        let options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_tokens.get(uid) },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          res.render('data.html', body);
        });
      }
    });
  }
});

app.get('/tracks', function(req, res) {
  res.render('tracks.html');
});

app.get('/top', function(req, res) {
  let uid = req.cookies['uid'];
  let time_range = req.query.time_range;
  let options = {
    url: 'https://api.spotify.com/v1/me/top/tracks?' +
      querystring.stringify({
        limit: 25,
        time_range: time_range
      }),
    headers: { 'Authorization': 'Bearer ' + access_tokens.get(uid) },
    json: true
  };

  request.get(options, function(error, response, body) {
    ids = body.items.map(track => track.id);
    names = body.items.map(track => track.name);
    let feature_options = {
      url: `https://api.spotify.com/v1/audio-features?ids=${ids.join(',')}`,
      headers: { 'Authorization': 'Bearer ' + access_tokens.get(uid) },
      json: true
    };
    request.get(feature_options, function(error, response, body) {
      let track_options = {
        url: `https://api.spotify.com/v1/tracks?ids=${ids.join(',')}`,
        headers: { 'Authorization': 'Bearer ' + access_tokens.get(uid) },
        json: true
      }
      request.get(track_options, function(error, response, track_body) {
        for (let i=0; i<body['audio_features'].length; i++) {
          body['audio_features'][i].track = track_body['tracks'][i]
        }
        res.send(body)
      });
    });
  });
});

const PORT = process.env.PORT || 8888;
console.log(`Listening on ${PORT}`);
app.listen(PORT);
