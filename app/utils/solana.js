const {
  Connection,
  PublicKey,
  Keypair,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const path = require('path');
const fs = require('fs');
const {
  deprecated,
  PROGRAM_ID,
} = require('@metaplex-foundation/mpl-token-metadata');
const retry = require('async-retry');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const axios = require('axios');
const { environmentEnum } = require('../variables/global.variables');
const {
  Creator,
  MetadataDataData,
  UpdateMetadata,
} = require('@metaplex-foundation/mpl-token-metadata/dist/deprecated');
const { getPinataCredentials, uploadJson } = require('./pinata');
const { nftStages } = require('../variables/nft.variables');

const keypair = path.resolve(__dirname, `../../../keypair.json`);

exports.throwErrorNoMetadata = (tokenAddress) => {
  throw new Error(
    `There is no metadata for Token ${tokenAddress.slice(0, 8)}...`
  );
};

exports.throwErrorSolanaUnavailable = () => {
  throw new Error(
    'Unable to change metadata, Solana blockchain unavailable, please try again later'
  );
};

exports.getSolanaConnection = () => {
  const clusterUrl =
    process.env.NODE_ENV === environmentEnum.development
      ? process.env.DEVNET_CLUSTER_URL
      : process.env.MAINNET_CLUSTER_URL;

  const connection = new Connection(clusterUrl);
  return connection;
};

exports.getSolanaRpcEndpoint = () => {
  return process.env.NODE_ENV === environmentEnum.development
    ? process.env.DEVNET_CLUSTER_URL
    : process.env.MAINNET_CLUSTER_URL;
};

exports.getUpdateAuthtority = () => {
  return process.env.NODE_ENV === environmentEnum.development
    ? process.env.UPDATE_AUTHORITY_DEVELOPMENT
    : process.env.UPDATE_AUTHORITY_PRODUCTION;
};

exports.fetchTokenMetadataByTokenAddress = async (tokenAddress) => {
  const connection = this.getSolanaConnection();

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

exports.updateMetaplexMetadata = async (
  connection,
  keypairPath,
  tokenAddress,
  newMetadataUri,
  newTokenName
) => {
  try {
    const keypairArray = JSON.parse(fs.readFileSync(keypairPath));
    const keypairUnit8Array = Uint8Array.from(keypairArray);
    const keypairObject = Keypair.fromSecretKey(keypairUnit8Array);

    let nftMintAccount = new PublicKey(tokenAddress);
    let metadataAccount = await deprecated.Metadata.getPDA(nftMintAccount);
    const metadata = await deprecated.Metadata.load(
      connection,
      metadataAccount
    );

    const creators = metadata.data.data.creators.map(
      (el) =>
        new Creator({
          ...el,
        })
    );

    const newMetadataData = new MetadataDataData({
      name: newTokenName ? newTokenName : metadata.data.data.name,
      symbol: metadata.data.data.symbol,
      uri: newMetadataUri,
      creators: [...creators],
      sellerFeeBasisPoints: metadata.data.data.sellerFeeBasisPoints,
    });

    const updateTx = new UpdateMetadata(
      { feePayer: keypairObject.publicKey },
      {
        metadata: metadataAccount,
        updateAuthority: keypairObject.publicKey,
        metadataData: newMetadataData,
      }
    );

    await sendAndConfirmTransaction(connection, updateTx, [keypairObject]);
  } catch (error) {
    console.error(error.message);
    this.throwErrorSolanaUnavailable();
  }
};

exports.updateMetadataUrlSolana = async (
  tokenAddress,
  keypair,
  metadataUrlIpfs
) => {
  try {
    const { stderr } = await retry(
      async () => {
        return await exec(
          `metaboss -r ${this.getSolanaRpcEndpoint()} update uri -a ${tokenAddress} -k ${keypair} -u ${metadataUrlIpfs}`
        );
      },
      {
        retries: 5,
      }
    );

    if (stderr) console.error('METABOSS STDERR:', stderr);
  } catch (error) {
    this.throwErrorSolanaUnavailable();
  }
};

exports.updateTokenNameSolana = async (tokenAddress, keypair, tokenName) => {
  try {
    const { stderr } = await retry(
      async () => {
        return await exec(
          `metaboss -r ${this.getSolanaRpcEndpoint()} update name -a ${tokenAddress} -k ${keypair} --new-name '${tokenName}'`
        );
      },
      {
        retries: 5,
      }
    );

    if (stderr) console.error('METABOSS STDERR:', stderr);
  } catch (error) {
    this.throwErrorSolanaUnavailable();
  }
};

exports.sanitizeTokenMeta = (tokenData) => ({
  ...tokenData,
  data: {
    ...tokenData?.data,
    name: this.sanitizeMetaStrings(tokenData?.data?.name),
    symbol: this.sanitizeMetaStrings(tokenData?.data?.symbol),
    uri: this.sanitizeMetaStrings(tokenData?.data?.uri),
  },
});

exports.sanitizeMetaStrings = (metaString) => metaString.replace(/\0/g, '');

class TokenInfo {
  metadataAccount;
  nftTokenMint;
  nftName;
  metadataUri;

  constructor(metadataAccount, tokenMint) {
    this.metadataAccount = metadataAccount;
    this.nftTokenMint = tokenMint;
  }
}

const getAllNftsForUpdateAuthtority = async (connection, updateAuthtority) => {
  const config = {
    commitment: undefined,
    encoding: 'base64',
    dataSlice: undefined,
    filters: [
      {
        memcmp: {
          offset: 1,
          bytes: updateAuthtority,
        },
      },
    ],
  };

  const accountList = await connection.getProgramAccounts(PROGRAM_ID, config);

  const allInfo = [];

  for (let i = 0; i < accountList.length; i++) {
    const metadataAccountPK = accountList[i].pubkey.toBase58();

    const tokenMint = new PublicKey(
      accountList[i].account.data.slice(1 + 32, 1 + 32 + 32)
    ).toBase58();

    allInfo[i] = new TokenInfo(metadataAccountPK, tokenMint);

    const nameLenght = accountList[i].account.data.readUInt32LE(1 + 32 + 32);
    const nameBuffer = accountList[i].account.data.slice(
      1 + 32 + 32 + 4,
      1 + 32 + 32 + 4 + 32
    );

    let name = '';
    for (let j = 0; j < nameLenght; j++) {
      if (nameBuffer.readUInt8(j) == 0) break;
      name += String.fromCharCode(nameBuffer.readUInt8(j));
    }
    allInfo[i].nftName = name;
  }
  return allInfo;
};

// Fetch nfts names for customized characters from snapshot
exports.fetchNftNames = () => {
  try {
    const allNftsWithMetadata = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../allNftsWithMetadata.json'))
    );

    const heroNfts = allNftsWithMetadata.filter((nft) => {
      console.log(nft.mint);
      return nft.data.customMetaData.attributes.stage === 'Hero';
    });

    const nftNames = heroNfts.map((nft) => nft.data.name);

    const metadataJSON = JSON.stringify(nftNames, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `../../nftNames.json`),
      metadataJSON
    );
  } catch (error) {
    console.log(error.message);
  }
};

// Update tokens metadata after initial launch with new attributes
exports.updateMetadataAttributes = async () => {
  try {
    console.log('##### Establish connection #####');
    const connection = new Connection(process.env.MAINNET_CLUSTER_URL);

    const { pinataApiKey, pinataSecretApiKey, pinataGateway } =
      getPinataCredentials();

    console.log('##### Start changing metadata #####');
    const allNfts = await getAllNftsForUpdateAuthtority(
      connection,
      process.env.UPDATE_AUTHORITY_PRODUCTION
    );

    const allNftsForUpdateAuthtority = allNfts;

    for (let [index, nft] of allNftsForUpdateAuthtority.entries()) {
      // Continue from some index if failed
      // if (index < 0) continue;

      console.log(`________ INDEX: ${index} ________`);

      console.log('##### Start finding "metadataUri" #####');
      const mintPubkey = new PublicKey(nft.nftTokenMint);
      const tokenMetadataPubkey = await deprecated.Metadata.getPDA(mintPubkey);
      const tokenMetadata = await deprecated.Metadata.load(
        connection,
        tokenMetadataPubkey
      );
      allNftsForUpdateAuthtority[index].metadataUri =
        tokenMetadata.data.data.uri;

      console.log('##### Start fetching "metadata" #####');
      const oldMetadata = await this.fetchOldMetadata(
        nft.nftTokenMint,
        nft.metadataUri
      );
      !oldMetadata && this.throwErrorNoMetadata(nft.nftTokenMint);
      allNftsForUpdateAuthtority[index].metadata = oldMetadata;

      let newMetadata;
      let tokenName;
      if (oldMetadata.attributes[0].value === 'Key') {
        newMetadata = {
          ...oldMetadata,
          description:
            '1,250 Play-and-Earn Heroes of Aerinhome, introducing The first AAA gaming platform on Solana from the minds behind World of Warcraft, Overwatch, & League of Legends. Vanquish Opponents, Stake, and Rent Your Hero to earn $ZALTA',
        };
      } else if (oldMetadata.attributes[0].value === 'Tome') {
        const {
          tome,
          stat_points,
          cosmetic_points,
          stat_tier,
          cosmetic_tier,
          hero_tier,
          ...restOfProperties
        } = oldMetadata;

        const attributes = [
          ...restOfProperties.attributes,
          ...(tome
            ? [
                {
                  trait_type: 'Tome',
                  value: tome,
                },
              ]
            : []),
          ...(hero_tier
            ? [
                {
                  trait_type: 'Hero Tier',
                  value: hero_tier,
                },
              ]
            : []),
          ...(stat_tier
            ? [
                {
                  trait_type: 'Stat Tier',
                  value: stat_tier,
                },
              ]
            : []),
          ...(cosmetic_tier
            ? [
                {
                  trait_type: 'Cosmetic Tier',
                  value: cosmetic_tier,
                },
              ]
            : []),
          ...(stat_points
            ? [
                {
                  trait_type: 'Stat Points',
                  value: stat_points,
                },
              ]
            : []),
          ...(cosmetic_points
            ? [
                {
                  trait_type: 'Cosmetic Points',
                  value: cosmetic_points,
                },
              ]
            : []),
        ];

        const attributesSet = new Set();
        const uniqueAttributes = attributes.filter((item) =>
          !attributesSet.has(JSON.stringify(item))
            ? attributesSet.add(JSON.stringify(item))
            : false
        );

        newMetadata = {
          ...restOfProperties,
          description:
            '1,250 Play-and-Earn Heroes of Aerinhome, introducing The first AAA gaming platform on Solana from the minds behind World of Warcraft, Overwatch, & League of Legends. Vanquish Opponents, Stake, and Rent Your Hero to earn $ZALTA',
          attributes: uniqueAttributes,
        };
      } else if (oldMetadata.attributes[0].value === 'Hero') {
        const {
          tome,
          stat_points,
          cosmetic_points,
          stat_tier,
          cosmetic_tier,
          hero_tier,
          token_name,
          constitution,
          strength,
          dexterity,
          wisdom,
          intelligence,
          charisma,
          ...restOfProperties
        } = oldMetadata;

        tokenName = token_name;

        const newAttributesBefore = [
          ...(tome
            ? [
                {
                  trait_type: 'Tome',
                  value: tome,
                },
              ]
            : []),
          ...(hero_tier
            ? [
                {
                  trait_type: 'Hero Tier',
                  value: hero_tier,
                },
              ]
            : []),
          ...(stat_tier
            ? [
                {
                  trait_type: 'Stat Tier',
                  value: stat_tier,
                },
              ]
            : []),
          ...(cosmetic_tier
            ? [
                {
                  trait_type: 'Cosmetic Tier',
                  value: cosmetic_tier,
                },
              ]
            : []),
          ...(stat_points
            ? [
                {
                  trait_type: 'Stat Points',
                  value: stat_points,
                },
              ]
            : []),
          ...(cosmetic_points
            ? [
                {
                  trait_type: 'Cosmetic Points',
                  value: cosmetic_points,
                },
              ]
            : []),
        ];

        const newAttributesAfter = [
          ...(constitution
            ? [
                {
                  trait_type: 'Constitution',
                  value: constitution,
                },
              ]
            : []),
          ...(strength
            ? [
                {
                  trait_type: 'Strength',
                  value: strength,
                },
              ]
            : []),
          ...(dexterity
            ? [
                {
                  trait_type: 'Dexterity',
                  value: dexterity,
                },
              ]
            : []),
          ...(wisdom
            ? [
                {
                  trait_type: 'Wisdom',
                  value: wisdom,
                },
              ]
            : []),
          ...(intelligence
            ? [
                {
                  trait_type: 'Intelligence',
                  value: intelligence,
                },
              ]
            : []),
          ...(charisma
            ? [
                {
                  trait_type: 'Charisma',
                  value: charisma,
                },
              ]
            : []),
        ];

        const attributes = [
          restOfProperties.attributes[0],
          ...newAttributesBefore,
          ...restOfProperties.attributes,
          ...newAttributesAfter,
        ];

        const attributesSet = new Set();
        const uniqueAttributes = attributes.filter((item) =>
          !attributesSet.has(JSON.stringify(item))
            ? attributesSet.add(JSON.stringify(item))
            : false
        );

        newMetadata = {
          ...restOfProperties,
          name: tokenName,
          mint_name: restOfProperties.name,
          description:
            '1,250 Play-and-Earn Heroes of Aerinhome, introducing The first AAA gaming platform on Solana from the minds behind World of Warcraft, Overwatch, & League of Legends. Vanquish Opponents, Stake, and Rent Your Hero to earn $ZALTA',
          attributes: uniqueAttributes,
        };
      } else {
        console.log('Error: wrong stage');
        continue;
      }

      const { metadataIpfsUrl } = await uploadJson(
        pinataApiKey,
        pinataSecretApiKey,
        pinataGateway,
        newMetadata,
        `${nft.nftTokenMint}-${nftStages.updated}`,
        nft.nftTokenMint,
        nftStages.updated
      );

      console.log('##### Start updating token metadata #####');
      await this.updateMetaplexMetadata(
        connection,
        keypair,
        nft.nftTokenMint,
        metadataIpfsUrl
      );
    }
  } catch (error) {
    console.error(error.message);
  }
};
