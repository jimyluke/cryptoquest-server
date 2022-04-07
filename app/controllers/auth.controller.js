const crypto = require('crypto');

exports.generateNonce = async (req, res) => {
  try {
    const nonce = crypto.randomBytes(32).toString('base64');

    res.status(200).send({ nonce });
  } catch (error) {
    console.log(error.message);
    res.status(405).send(error.message);
  }
};
