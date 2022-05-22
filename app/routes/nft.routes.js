const controller = require('../controllers/nft.controller');
const {
  verifySignature,
  verifyIsWalletOwnsNft,
  verifyRedisRunning,
} = require('../middleware');

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      'Access-Control-Allow-Headers',
      'x-access-token, Origin, Content-Type, Accept'
    );
    next();
  });

  // Check is nft unique
  app.post(
    '/api/checkIsTokenIdUnique',
    controller.checkIsTokenIdUniqueController
  );

  // Load available recipes
  app.get('/api/availableRecipes', controller.availableRecipes);

  // Reveal nft
  app.post(
    '/api/reveal',
    [verifyRedisRunning, verifySignature, verifyIsWalletOwnsNft],
    controller.revealNft
  );

  // Customize nft
  app.post(
    '/api/customize',
    [verifyRedisRunning, verifySignature, verifyIsWalletOwnsNft],
    controller.customizeNft
  );

  // Fetch nfts
  app.post('/api/nfts', controller.fetchNfts);
};
