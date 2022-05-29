const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const controller = require('../controllers/admin.controller');
const { verifyRedisRunning, verifyJWTToken } = require('../middleware');

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      'Access-Control-Allow-Headers',
      'x-access-token, Origin, Content-Type, Accept'
    );
    next();
  });

  // Rernder token from Admin panel
  app.post(
    '/api/admin/rerenderToken',
    [verifyRedisRunning, verifyJWTToken],
    controller.rerenderToken
  );

  // Upload file to IPFS from Admin panel
  app.post(
    '/api/admin/uploadIpfs',
    [verifyRedisRunning, verifyJWTToken, upload.single('file')],
    controller.uploadIpfsController
  );

  // Update metadata url for nft on Solana from Admin panel
  app.post(
    '/api/admin/updateMetadataUrlSolana',
    [verifyJWTToken],
    controller.updateMetadataUrlSolanaController
  );
};
