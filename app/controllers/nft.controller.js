const fs = require('fs');
const path = require('path');
const retry = require('async-retry');
const {
  getParsedNftAccountsByOwner,
  resolveToWalletAddress,
} = require('@nfteyez/sol-rayz');

const pool = require('../config/db.config');
const {
  getPinataCredentials,
  extractHashFromArweaveUrl,
} = require('../utils/pinata');
const { nftStages, uploadIpfsType } = require('../variables/nft.variables');
const {
  updateMetadataUrlSolana,
  fetchOldMetadata,
  throwErrorNoMetadata,
  getSolanaConnection,
  getUpdateAuthtority,
} = require('../utils/solana');
const {
  getHeroTierImageFromIpfs,
  checkIsTokenAlreadyRevealed,
  throwErrorTokenAlreadyRevealed,
  selectTokenByAddress,
  throwErrorTokenHasNotBeenRevealed,
  checkIsTokenAlreadyCustomized,
  throwErrorTokenAlreadyCustomized,
  checkIsSkillsValid,
  checkIsTraitsValid,
  checkIsTokenIdUnique,
  getRandomTokenFromTome,
  getMetaData,
  updateSolanaMetadataAfterCustomization,
  renderImageAndUpdateMetadata,
  fetchTokenNameStatus,
} = require('../utils/nft.utils');
const { addUploadIpfs } = require('../queues/uploadIpfs.queue');
const { checkIsTokenNameUnique } = require('./tokenName.controller');
const { camelCase } = require('lodash');
const keypair = path.resolve(__dirname, `../../../keypair.json`);

const metadataFolderPath = '../../../metadata/';

const { pinataApiKey, pinataSecretApiKey, pinataGateway } =
  getPinataCredentials();

const updateAuthority = getUpdateAuthtority();

// Check is nft unique
exports.checkIsTokenIdUniqueController = async (req, res) => {
  try {
    const { tokenId } = req.body;

    const isTokenIdExist = await checkIsTokenIdUnique(tokenId);

    res.status(200).send({ isTokenIdExist });
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

// Check available tomes
exports.availableTomes = async (req, res) => {
  try {
    const allTomesWoodlandRespite = await pool.query(
      'SELECT * FROM woodland_respite'
    );
    const allTomesDawnOfMan = await pool.query('SELECT * FROM dawn_of_man');

    const revealedTomesWoodlandRespite = await pool.query(
      'SELECT * FROM tokens WHERE tome = $1',
      ['Woodland Respite']
    );
    const revealedTomesDawnOfMan = await pool.query(
      'SELECT * FROM tokens WHERE tome = $1',
      ['Dawn of Man']
    );

    const totalTomesWoodlandRespite = allTomesWoodlandRespite.rows.length;
    const remainingTomesWoodlandRespite =
      totalTomesWoodlandRespite - revealedTomesWoodlandRespite.rows.length;

    const totalTomesDawnOfMan = allTomesDawnOfMan.rows.length;
    const remainingTomesDawnOfMan =
      totalTomesDawnOfMan - revealedTomesDawnOfMan.rows.length;

    res.status(200).send({
      woodlandRespite: {
        remaining: remainingTomesWoodlandRespite,
        total: totalTomesWoodlandRespite,
      },
      dawnOfMan: {
        remaining: remainingTomesDawnOfMan,
        total: totalTomesDawnOfMan,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

// Reveal Nft
exports.revealNft = async (req, res) => {
  try {
    const { tokenAddress, metadataUri, mintName, mintNumber, tome } = req.body;

    const oldMetadata = await fetchOldMetadata(tokenAddress, metadataUri);
    !oldMetadata && throwErrorNoMetadata(tokenAddress);

    const isTokenAlreadyRevealed = await checkIsTokenAlreadyRevealed(
      tokenAddress
    );
    if (isTokenAlreadyRevealed || oldMetadata?.tome) {
      throwErrorTokenAlreadyRevealed(tokenAddress);
    }

    const {
      tokenNumber,
      statPoints,
      cosmeticPoints,
      statTier,
      cosmeticTier,
      heroTier,
    } = await getRandomTokenFromTome(tome);

    const revealedTokenData = await pool.query(
      'INSERT INTO tokens (token_address, mint_name, tome, mint_number, token_number, stat_points, cosmetic_points, stat_tier, cosmetic_tier, hero_tier) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [
        tokenAddress,
        mintName,
        tome,
        mintNumber,
        tokenNumber,
        statPoints,
        cosmeticPoints,
        statTier,
        cosmeticTier,
        heroTier,
      ]
    );

    const revealedToken = revealedTokenData?.rows?.[0];

    const oldMetadataJSON = JSON.stringify(oldMetadata, null, 2);
    const metadataUrlHash = extractHashFromArweaveUrl(metadataUri);
    fs.writeFileSync(
      path.resolve(__dirname, `${metadataFolderPath}${metadataUrlHash}.json`),
      oldMetadataJSON
    );

    const imageIpfsUrl = getHeroTierImageFromIpfs(heroTier);

    const metadata = {
      ...oldMetadata,
      image: imageIpfsUrl,
      external_url: `${process.env.WEBSITE_URL}`,
      properties: {
        ...oldMetadata?.properties,
        files: [
          {
            uri: imageIpfsUrl,
            type: 'image/png',
          },
        ],
      },
      description:
        '1,250 Play-and-Earn Heroes of Aerinhome, introducing The first AAA gaming platform on Solana from the minds behind World of Warcraft, Overwatch, & League of Legends. Vanquish Opponents, Stake, and Rent Your Hero to earn $ZALTA',
      attributes: [
        {
          trait_type: 'Stage',
          value: 'Tome',
        },
        {
          trait_type: 'Tome',
          value: tome,
        },
        {
          trait_type: 'Hero Tier',
          value: heroTier,
        },
        {
          trait_type: 'Stat Tier',
          value: statTier,
        },
        {
          trait_type: 'Cosmetic Tier',
          value: cosmeticTier,
        },
        {
          trait_type: 'Stat Points',
          value: statPoints,
        },
        {
          trait_type: 'Cosmetic Points',
          value: cosmeticPoints,
        },
      ],
    };

    const uploadIpfs = await addUploadIpfs({
      type: uploadIpfsType.json,
      pinataApiKey,
      pinataSecretApiKey,
      pinataGateway,
      data: metadata,
      tokenAddress,
      stage: nftStages.revealed,
    });
    const uploadIpfsResult = await uploadIpfs.finished();

    const { metadataIpfsUrl, metadataIpfsHash } = uploadIpfsResult;

    const metadataJSON = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `${metadataFolderPath}${metadataIpfsHash}.json`),
      metadataJSON
    );

    await pool.query(
      'INSERT INTO metadata (nft_id, stage, metadata_url, image_url) VALUES($1, $2, $3, $4) RETURNING *',
      [revealedToken.id, nftStages.minted, metadataUri, oldMetadata?.image]
    );

    await pool.query(
      'INSERT INTO metadata (nft_id, stage, metadata_url, image_url) VALUES($1, $2, $3, $4) RETURNING *',
      [revealedToken.id, nftStages.revealed, metadataIpfsUrl, imageIpfsUrl]
    );

    await updateMetadataUrlSolana(tokenAddress, keypair, metadataIpfsUrl);

    res.status(200).send({
      tokenAddress,
      statPoints,
      cosmeticPoints,
      heroTier,
      statTier,
      cosmeticTier,
    });
  } catch (error) {
    await pool.query(
      'INSERT INTO errors (token_address, function, message) VALUES($1, $2, $3)',
      [req.body.tokenAddress, 'revealNft', error.message.substr(0, 250)]
    );
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

// Customize NFT
exports.customizeNft = async (req, res) => {
  try {
    const {
      tokenAddress,
      tokenName,
      tokenId,
      cosmeticTraits,
      skills,
      metadataUri,
    } = req.body;

    const isTokenIdExist = await checkIsTokenIdUnique(tokenId);
    if (isTokenIdExist) {
      throw new Error(
        `Current combination of traits already exist. Please change them.`
      );
    }

    const { isTokenNameExist, isTokenNameRejected } =
      await checkIsTokenNameUnique(tokenName);
    if (isTokenNameExist) {
      throw new Error(
        `Token name already exist. Please rename your character.`
      );
    }
    if (isTokenNameRejected) {
      throw new Error(
        `Token name is not allowed. Please rename your character.`
      );
    }

    const oldMetadata = await fetchOldMetadata(tokenAddress, metadataUri);
    !oldMetadata && throwErrorNoMetadata(tokenAddress);

    const currentNft = await selectTokenByAddress(tokenAddress);
    const isTokenAlreadyRevealed = await checkIsTokenAlreadyRevealed(
      tokenAddress
    );
    if (!isTokenAlreadyRevealed) {
      throwErrorTokenHasNotBeenRevealed(tokenAddress);
    }

    const isTokenAlreadyCustomized = await checkIsTokenAlreadyCustomized(
      currentNft.id
    );
    if (isTokenAlreadyCustomized) {
      throwErrorTokenAlreadyCustomized(tokenAddress);
    }

    const isSkillsValid = checkIsSkillsValid(currentNft.stat_points, skills);
    if (!isSkillsValid)
      throw new Error(
        'Invalid skills. You have to spend all stat points for skills'
      );

    const isTraitsValid = checkIsTraitsValid(
      currentNft.cosmetic_points,
      cosmeticTraits
    );
    if (!isTraitsValid)
      throw new Error(
        'Invalid cosmetic traits. You can spend no more cosmetic points than you have'
      );

    await pool.query(
      'INSERT INTO token_names (nft_id, token_name, token_name_status) VALUES($1, $2, $3) RETURNING *',
      [currentNft.id, tokenName, 'approved']
    );

    await pool.query(
      'INSERT INTO characters (nft_id, token_id, constitution, strength, dexterity, wisdom, intelligence, charisma, race, sex, face_style, skin_tone, eye_detail, eyes, facial_hair, glasses, hair_style, hair_color, necklace, earring, nose_piercing, scar, tattoo, background) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) RETURNING *',
      [
        currentNft.id,
        tokenId,
        skills.constitution,
        skills.strength,
        skills.dexterity,
        skills.wisdom,
        skills.intelligence,
        skills.charisma,
        cosmeticTraits.race,
        cosmeticTraits.sex,
        cosmeticTraits.faceStyle,
        cosmeticTraits.skinTone,
        cosmeticTraits.eyeDetail,
        cosmeticTraits.eyes,
        cosmeticTraits.facialHair,
        cosmeticTraits.glasses,
        cosmeticTraits.hairStyle,
        cosmeticTraits.hairColor,
        cosmeticTraits.necklace,
        cosmeticTraits.earring,
        cosmeticTraits.nosePiercing,
        cosmeticTraits.scar,
        cosmeticTraits.tattoo,
        cosmeticTraits.background,
      ]
    );

    res.status(200).send({ success: 'Success' });

    const { metadataIpfsUrl } = await updateSolanaMetadataAfterCustomization(
      cosmeticTraits,
      currentNft,
      tokenAddress,
      oldMetadata,
      tokenName,
      skills
    );

    const { imageIpfsUrl } = await renderImageAndUpdateMetadata(
      tokenId,
      cosmeticTraits,
      currentNft,
      tokenAddress
    );

    const metadataAfterInitialUpload = await fetchOldMetadata(
      tokenAddress,
      metadataIpfsUrl
    );
    !metadataAfterInitialUpload && throwErrorNoMetadata(tokenAddress);

    await updateSolanaMetadataAfterCustomization(
      cosmeticTraits,
      currentNft,
      tokenAddress,
      metadataAfterInitialUpload,
      tokenName,
      skills,
      imageIpfsUrl
    );
  } catch (error) {
    await pool.query(
      'INSERT INTO errors (token_address, function, message) VALUES($1, $2, $3)',
      [req.body.tokenAddress, 'customizeNft', error.message.substr(0, 250)]
    );
    console.error(error.message);
    if (!res.headersSent) {
      res.status(404).send({
        message: error.message,
      });
    }
  }
};

exports.fetchNfts = async (req, res) => {
  try {
    const { publicKey, tokenAddress } = req.body;

    const connection = await getSolanaConnection();

    const publicAddress = await retry(
      async () => {
        return await resolveToWalletAddress({
          text: publicKey,
        });
      },
      {
        retries: 5,
      }
    );

    if (!publicAddress) {
      throw new Error('Network error, please try again');
    }

    const nftArray = await retry(
      async () => {
        return await getParsedNftAccountsByOwner({
          publicAddress,
          connection,
          sanitize: true,
        });
      },
      {
        retries: 5,
      }
    );

    if (!nftArray) {
      throw new Error('Network error, please try again');
    }

    const cryptoquestNfts = nftArray.filter((nft) => {
      if (tokenAddress) {
        return (
          nft.updateAuthority === updateAuthority && nft.mint === tokenAddress
        );
      } else {
        return nft.updateAuthority === updateAuthority;
      }
    });

    const cryptoquestNftsWithMetadata = cryptoquestNfts.map((nft) => ({
      ...nft,
      data: {
        ...nft.data,
        customMetaData: {},
        tokenNameStatus: null,
        isRevealed: false,
        isCustomized: false,
      },
    }));

    // eslint-disable-next-line no-undef
    const nftsMetaData = await Promise.allSettled(
      cryptoquestNftsWithMetadata.map(async (tokenData) => {
        const metaData = await getMetaData(tokenData);
        return metaData;
      })
    );

    // eslint-disable-next-line no-undef
    const nftsDataDB = await Promise.allSettled(
      cryptoquestNftsWithMetadata.map(async ({ mint }) => {
        const currentNft = await selectTokenByAddress(mint);

        if (!currentNft) return null;

        const tokenNameStatus = await fetchTokenNameStatus(currentNft.id);
        const isRevealed = await checkIsTokenAlreadyRevealed(mint);
        const isCustomized = await checkIsTokenAlreadyCustomized(currentNft.id);

        return { tokenNameStatus, isRevealed, isCustomized };
      })
    );

    cryptoquestNftsWithMetadata.forEach(async (tokenData, index) => {
      const metaData = nftsMetaData[index]?.value;
      if (metaData) {
        const attributes = metaData.attributes.reduce(
          (obj, item) =>
            Object.assign(obj, { [camelCase(item.trait_type)]: item.value }),
          {}
        );

        tokenData.data.customMetaData = {
          ...metaData,
          attributes,
        };
      }

      const tokenDataDB = nftsDataDB[index]?.value;
      if (!tokenDataDB) return;

      tokenData.data.tokenNameStatus = tokenDataDB.tokenNameStatus;
      tokenData.data.isRevealed = tokenDataDB.isRevealed;
      tokenData.data.isCustomized = tokenDataDB.isCustomized;
    });

    res.status(200).send({ nfts: cryptoquestNftsWithMetadata });
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};
