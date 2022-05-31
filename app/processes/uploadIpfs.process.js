const { uploadJson, uploadImage } = require('../utils/pinata');

exports.uploadIpfsProcess = async (job, done) => {
  try {
    const {
      type,
      pinataApiKey,
      pinataSecretApiKey,
      pinataGateway,
      data,
      tokenAddress,
      stage,
    } = job.data;
    if (type === 'json') {
      const result = await uploadJson(
        pinataApiKey,
        pinataSecretApiKey,
        pinataGateway,
        data,
        `${tokenAddress}-${stage}`,
        tokenAddress,
        stage
      );
      done(null, result);
    } else if (type === 'image') {
      const result = await uploadImage(
        pinataApiKey,
        pinataSecretApiKey,
        pinataGateway,
        data,
        `${tokenAddress}-image`,
        tokenAddress
      );
      done(null, result);
    } else {
      throw new Error('Unsupported type for uploading to IPFS');
    }
  } catch (error) {
    done(new Error(error.message));
  }
};
