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

  // Fetch nfts
  app.get('/api/nfts/all', controller.fetchNftsAll);

  // Fetch nft
  app.get('/api/nfts/single', controller.fetchNft);

  // Fetch inventory nfts
  app.post('/api/nfts/inventory', controller.fetchInventoryNfts);

  // Check is nft unique
  app.post(
    '/api/nfts/checkIsTokenIdUnique',
    controller.checkIsTokenIdUniqueController
  );

  // Load available tomes
  app.get('/api/nfts/availableTomes', controller.availableTomes);

  // Reveal nft
  app.post(
    '/api/nfts/reveal',
    [verifyRedisRunning, verifySignature, verifyIsWalletOwnsNft],
    controller.revealNft
  );

  // Customize nft
  app.post(
    '/api/nfts/customize',
    [verifyRedisRunning, verifySignature, verifyIsWalletOwnsNft],
    controller.customizeNft
  );
};
