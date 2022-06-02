const retry = require('async-retry');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const { getSolanaRpcEndpoint } = require('../utils/solana');

exports.metabossUpdateProcess = async (job, done) => {
  try {
    const { tokenAddress, keypair, metadataIpfsUrl } = job.data;
    const { stderr } = await retry(
      async () => {
        return await exec(
          `metaboss -r ${getSolanaRpcEndpoint()} update uri -a ${tokenAddress} -k ${keypair} -u ${metadataIpfsUrl}`
        );
      },
      {
        retries: 5,
      }
    );

    if (stderr) console.error('METABOSS STDERR:', stderr);
    done(null, 'success');
  } catch (error) {
    done(new Error(error.message));
  }
};
