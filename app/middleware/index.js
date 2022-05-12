const jwt = require('jsonwebtoken');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const retry = require('async-retry');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');

const { getSolanaConnection } = require('../utils/solana');

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

    const connection = await getSolanaConnection();

    let result;
    try {
      result = await retry(
        async () => {
          return await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
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
        },
        {
          retries: 5,
        }
      );
    } catch (error) {
      res.status(503).send({
        message: `Solana blockchain unavailable, please try again later`,
      });
      return;
    }

    const accountInfo = result?.[0]?.account?.data?.parsed?.info;

    if (
      !result ||
      result.length === 0 ||
      !accountInfo ||
      accountInfo?.owner !== publicKey ||
      parseInt(accountInfo?.tokenAmount?.amount) <= 0
    ) {
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
