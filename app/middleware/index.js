const jwt = require('jsonwebtoken');
const nacl = require('tweetnacl');
const bs58 = require('bs58');

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

exports.verifyToken = (req, res, next) => {
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
