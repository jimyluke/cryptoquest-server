const controller = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware');

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      'Access-Control-Allow-Headers',
      'x-access-token, Origin, Content-Type, Accept'
    );

    next();
  });

  // Generate nonce for Solana signature
  app.get('/api/auth', controller.generateNonce);

  // Sign up into Admin UI
  app.post('/api/auth/signUp', controller.signUp);

  // Sign in into Admin UI
  app.post('/api/auth/signIn', controller.signIn);

  // Login user by token into Admin UI
  app.get('/api/auth/login', verifyToken, controller.login);
};
