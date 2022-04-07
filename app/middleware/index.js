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
