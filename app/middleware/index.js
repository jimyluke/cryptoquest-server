const jwt = require('jsonwebtoken');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { Connection } = require('@solana/web3.js');

// Verify wallet signature from website
exports.verifySignature = async (req, res, next) => {
  try {
    const nonce = req.body.nonce;

    const message = `Sign this message for authenticating with your wallet. Nonce: ${nonce}`;
    const messageBytes = new TextEncoder().encode(message);

    const publicKeyBytes = bs58.decode(req.body.publicKey);
    const signatureBytes = bs58.decode(req.body.signature);

    const result = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!result) {
      return res.status(401).send({
        message: 'User unauthorized',
      });
    }

    next();
  } catch (error) {
    console.log(error.message);
    res.status(405).send(error.message);
  }
};

// Verify that wallet owns nft for revealing and customization
exports.verifyIsWalletOwnsNft = async (req, res, next) => {
  try {
    const { publicKey, tokenAddress } = req.body;

    const clusterUrl =
      process.env.NODE_ENV === 'development' // TODO: FIX FOR PRODUCTION
        ? process.env.DEVNET_CLUSTER_URL
        : process.env.DEVNET_CLUSTER_URL;
    // : process.env.MAINNET_CLUSTER_URL;

    const connection = new Connection(clusterUrl);

    let result;

    try {
      result = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: [
          {
            dataSize: 165,
          },
          {
            memcmp: {
              offset: 0,
              bytes: tokenAddress,
            },
          },
          {
            memcmp: {
              offset: 32,
              bytes: publicKey,
            },
          },
        ],
      });
    } catch (error) {
      res.status(503).send({
        message: `Solana blockchain unavailable, please try again later`,
      });
      return;
    }

    if (!result || result.length === 0) {
      return res.status(401).send({
        message: `You are not owner of NFT ${tokenAddress.slice(0, 8)}...`,
      });
    }

    next();
  } catch (error) {
    console.log(error.message);
    res.status(405).send(error.message);
  }
};

// Verify JWT token for users from Admin UI
exports.verifyJWTToken = (req, res, next) => {
  let token = req.headers['x-access-token'];

  if (!token) {
    return res.status(403).send({
      message: 'No token provided',
    });
  }

  jwt.verify(token, process.env.TOKEN_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: 'Session expired',
      });
    }

    req.userId = decoded.id;

    next();
  });
};
