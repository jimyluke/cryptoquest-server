const controller = require('../controllers/auth.controller');
const { verifyJWTToken } = require('../middleware');

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      'Access-Control-Allow-Headers',
      'x-access-token, Origin, Content-Type, Accept'
    );

    next();
  });

  // Generate nonce for wallet signature on website
  app.get('/api/auth/nonce', controller.generateNonce);

  // Sign up to Admin UI
  // app.post('/api/auth/signUp', controller.signUp);

  // Sign in to Admin UI
  app.post('/api/auth/signIn', controller.signIn);

  // Login to Admin UI using JWT token
  app.get('/api/auth/login', verifyJWTToken, controller.login);
};
