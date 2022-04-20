const controller = require('../controllers/nft.controller');
const { verifySignature, verifyToken } = require('../middleware');

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      'Access-Control-Allow-Headers',
      'x-access-token, Origin, Content-Type, Accept'
    );
    next();
  });

  // Check is nft unique
  app.post('/api/checkIsNftUnique', controller.checkIsNftUnique);

  // Check is token name unique
  app.post('/api/checkIsTokenNameUnique', controller.checkIsTokenNameUnique);

  // Reveal nft
  app.post('/api/reveal', verifySignature, controller.revealNft);

  // Customize nft
  app.post('/api/customize', verifySignature, controller.customizeNft);

  // Load list of token names
  app.get('/api/tokenNames', verifyToken, controller.loadTokenNames);

  // Load single token name
  app.get(
    '/api/tokenNames/:tokenNameId',
    verifyToken,
    controller.loadTokenName
  );

  // Approve token name
  app.post('/api/tokenNames/approve', verifyToken, controller.approveTokenName);

  // Reject token name
  app.post('/api/tokenNames/reject', verifyToken, controller.rejectTokenName);
};
