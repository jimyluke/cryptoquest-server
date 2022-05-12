const { Connection, PublicKey } = require('@solana/web3.js');
const { deprecated } = require('@metaplex-foundation/mpl-token-metadata');
const retry = require('async-retry');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const axios = require('axios');

exports.throwErrorNoMetadata = (tokenAddress) => {
  throw new Error(
    `There is no metadata for NFT ${tokenAddress.slice(0, 8)}...`
  );
};

exports.throwErrorSolanaUnavailable = () => {
  throw new Error(
    'Unable to change metadata, Solana blockchain unavailable, please try again later'
  );
};

exports.getSolanaConnection = async () => {
  const clusterUrl =
    process.env.NODE_ENV === 'development' // TODO: FIX FOR PRODUCTION
      ? process.env.DEVNET_CLUSTER_URL
      : process.env.DEVNET_CLUSTER_URL;
  // : process.env.MAINNET_CLUSTER_URL;

  const connection = new Connection(clusterUrl);
  return connection;
};

exports.fetchTokenMetadataByTokenAddress = async (tokenAddress) => {
  const connection = await this.getSolanaConnection();

  const mintPubkey = new PublicKey(tokenAddress);

  const tokenMetadataPubkey = await deprecated.Metadata.getPDA(mintPubkey);

  const tokenMetadata = await deprecated.Metadata.load(
    connection,
    tokenMetadataPubkey
  );

  return tokenMetadata;
};

exports.fetchOldMetadata = async (tokenAddress, metadataUri) => {
  try {
    const { data } = await retry(
      async () => {
        return await axios.get(metadataUri);
      },
      {
        retries: 5,
      }
    );
    return data;
  } catch (error) {
    this.throwErrorNoMetadata(tokenAddress);
  }
};

exports.updateMetadataUrlSolana = async (
  tokenAddress,
  keypair,
  metadataUrlIpfs
) => {
  try {
    const { stdout, stderr } = retry(
      async () => {
        return await exec(
          `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${metadataUrlIpfs}`
        );
      },
      {
        retries: 5,
      }
    );

    console.log('METABOSS STDOUT:', stdout);
    if (stderr) console.log('METABOSS STDERR:', stderr);
  } catch (error) {
    this.throwErrorSolanaUnavailable();
  }
};
