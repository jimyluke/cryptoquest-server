const controller = require('../controllers/tokenName.controller');
const { verifyJWTToken, verifyRedisRunning } = require('../middleware');

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      'Access-Control-Allow-Headers',
      'x-access-token, Origin, Content-Type, Accept'
    );
    next();
  });

  // Check is token name unique
  app.post(
    '/api/checkIsTokenNameUnique',
    controller.checkIsTokenNameUniqueController
  );

  // Load list of token names
  app.get('/api/tokenNames', verifyJWTToken, controller.loadTokenNames);

  // Approve token name
  app.post(
    '/api/tokenNames/approve',
    [verifyRedisRunning, verifyJWTToken],
    controller.approveTokenName
  );

  // Reject token name
  app.post(
    '/api/tokenNames/reject',
    [verifyRedisRunning, verifyJWTToken],
    controller.rejectTokenName
  );

  // Edit token name
  app.post(
    '/api/tokenNames/edit',
    [verifyRedisRunning, verifyJWTToken],
    controller.editTokenName
  );

  // Reject token name
  app.post(
    '/api/tokenNames/delete',
    verifyJWTToken,
    controller.deleteTokenName
  );

  // Rename token name
  app.post('/api/tokenNames/rename', controller.renameTokenName);
};
