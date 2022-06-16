const path = require('path');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const session = require('express-session');
const passport = require('passport');
const { ensureLoggedIn } = require('connect-ensure-login');
const LocalStrategy = require('passport-local').Strategy;

const { blenderRenderQueue } = require('../queues/blenderRender.queue');
const { uploadIpfsQueue } = require('../queues/uploadIpfs.queue');

module.exports = function (app) {
  passport.use(
    new LocalStrategy(function (username, password, cb) {
      if (
        username === process.env.BULL_BOARD_USERNAME &&
        password === process.env.BULL_BOARD_PASSWORD
      ) {
        return cb(null, { user: 'bull-board' });
      }
      return cb(null, false);
    })
  );

  passport.serializeUser((user, cb) => {
    cb(null, user);
  });

  passport.deserializeUser((user, cb) => {
    cb(null, user);
  });

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin');

  createBullBoard({
    queues: [
      new BullAdapter(blenderRenderQueue),
      new BullAdapter(uploadIpfsQueue),
    ],
    serverAdapter,
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      saveUninitialized: true,
      resave: true,
    })
  );
  app.use(passport.initialize({}));
  app.use(passport.session({}));

  app.set('views', path.resolve(__dirname, '../views'));
  app.set('view engine', 'ejs');

  app.get('/admin/login', (req, res) => {
    res.render('login', { invalid: req.query.invalid === 'true' });
  });

  app.post(
    '/admin/login',
    passport.authenticate('local', {
      failureRedirect: '/admin/login?invalid=true',
    }),
    (req, res) => {
      res.redirect('/admin');
    }
  );

  app.use(
    '/admin',
    ensureLoggedIn({ redirectTo: '/admin/login' }),
    serverAdapter.getRouter()
  );
};
