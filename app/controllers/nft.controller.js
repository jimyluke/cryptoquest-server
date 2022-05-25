const fs = require('fs');
const path = require('path');
const retry = require('async-retry');
const Jimp = require('jimp');
const {
  getParsedNftAccountsByOwner,
  resolveToWalletAddress,
} = require('@nfteyez/sol-rayz');
const axios = require('axios');

const pool = require('../config/db.config');
const {
  calculateStatTier,
  calculateCosmeticTier,
} = require('../utils/calculateTiers');
const { randomInteger } = require('../utils/randomInteger');
const {
  extractHashFromIpfsUrl,
  getPinataCredentials,
} = require('../utils/pinata');
const {
  nftStages,
  cosmeticTraitsMap,
  uploadIpfsType,
} = require('../variables/nft.variables');
const {
  updateMetadataUrlSolana,
  fetchOldMetadata,
  throwErrorNoMetadata,
  getSolanaConnection,
} = require('../utils/solana');
const {
  getHeroTierImageFromIpfs,
  checkIsTokenAlreadyRevealed,
  throwErrorTokenAlreadyRevealed,
  selectTokenByAddress,
  throwErrorTokenHasNotBeenRevealed,
  checkIsTokenAlreadyCustomized,
  throwErrorTokenAlreadyCustomized,
  selectCharacterByTokenId,
} = require('../utils/nft.utils');
const { addBlenderRender } = require('../queues/blenderRender.queue');
const { addUploadIpfs } = require('../queues/uploadIpfs.queue');
const { checkIsTokenNameUnique } = require('./tokenName.controller');
const keypair = path.resolve(__dirname, `../../../keypair.json`);

const metadataFolderPath = '../../../metadata/';
const blenderOutputFolderPath = '../../../blender_output/';

const { pinataApiKey, pinataSecretApiKey, pinataGateway } =
  getPinataCredentials();

const getRandomTokenFromTome = async (tome) => {
  return await retry(
    async () => {
      // Select all possible tokens from tome
      let allTokensFromTome;
      if (tome === 'Woodland Respite') {
        allTokensFromTome = await pool.query('SELECT * FROM woodland_respite');
      } else if (tome === 'Dawn of Man') {
        allTokensFromTome = await pool.query('SELECT * FROM dawn_of_man');
      }

      // Select all already revealed tokens from tome
      const revealedTokensFromTome = await pool.query(
        'SELECT * FROM tokens WHERE tome = $1',
        [tome]
      );

      const allTokenNumbers = Array.from(
        { length: allTokensFromTome?.rows.length },
        (_, i) => i + 1
      );

      const revealedTokenNumbers = revealedTokensFromTome?.rows.map(
        (item) => item?.token_number
      );
      // eslint-disable-next-line no-undef
      const revealedTokenNumbersSet = new Set(revealedTokenNumbers);

      const remainingTokenNumbers = allTokenNumbers.filter(
        (item) => !revealedTokenNumbersSet.has(item)
      );

      if (remainingTokenNumbers.length <= 0) {
        throw new Error(`All tokens already revealed`);
      }

      const randomTokenNumberIndex = randomInteger(
        0,
        remainingTokenNumbers.length - 1
      );

      const selectedTokenNumber = remainingTokenNumbers[randomTokenNumberIndex];

      const {
        token_number: tokenNumber,
        stat_points: statPoints,
        cosmetic_points: cosmeticPoints,
        hero_tier: heroTier,
      } = allTokensFromTome.rows.find(
        (item) => item?.token_number === selectedTokenNumber
      );

      const statTier = calculateStatTier(statPoints);
      const cosmeticTier = calculateCosmeticTier(cosmeticPoints);

      return {
        tokenNumber,
        statPoints,
        cosmeticPoints,
        statTier,
        cosmeticTier,
        heroTier,
      };
    },
    {
      retries: 5,
    }
  );
};

const checkIsTokenIdUnique = async (tokenId) => {
  const isTokenIdExistQuery = await pool.query(
    'SELECT EXISTS(SELECT 1 FROM characters WHERE token_id = $1)',
    [tokenId]
  );

  const isTokenIdExist = isTokenIdExistQuery?.rows?.[0]?.exists;

  return isTokenIdExist;
};

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
    if (isTokenAlreadyRevealed) {
      throwErrorTokenAlreadyRevealed(tokenAddress);
    }

    console.log(`Start revealing NFT ${tokenAddress}`);

    const {
      tokenNumber,
      statPoints,
      cosmeticPoints,
      statTier,
      cosmeticTier,
      heroTier,
    } = await getRandomTokenFromTome(tome);

    console.log(`Start changing metadata for NFT ${tokenAddress}`);

    const oldMetadataJSON = JSON.stringify(oldMetadata, null, 2);
    const metadataUrlHash = extractHashFromIpfsUrl(metadataUri);
    fs.writeFileSync(
      path.resolve(__dirname, `${metadataFolderPath}${metadataUrlHash}.json`),
      oldMetadataJSON
    );

    const imageIpfsUrl = getHeroTierImageFromIpfs(heroTier);

    const metadata = {
      ...oldMetadata,
      image: imageIpfsUrl,
      external_url: `${process.env.WEBSITE_URL}`,
      tome,
      stat_points: statPoints,
      cosmetic_points: cosmeticPoints,
      stat_tier: statTier,
      cosmetic_tier: cosmeticTier,
      hero_tier: heroTier,
      properties: {
        ...oldMetadata?.properties,
        files: [
          {
            uri: imageIpfsUrl,
            type: 'image/png',
          },
        ],
      },
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
    console.log(uploadIpfsResult);

    const { metadataIpfsUrl, metadataIpfsHash } = uploadIpfsResult;

    const metadataJSON = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `${metadataFolderPath}${metadataIpfsHash}.json`),
      metadataJSON
    );

    await updateMetadataUrlSolana(tokenAddress, keypair, metadataIpfsUrl);

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

    await pool.query(
      'INSERT INTO metadata (nft_id, stage, metadata_url, image_url) VALUES($1, $2, $3, $4) RETURNING *',
      [revealedToken.id, nftStages.minted, metadataUri, oldMetadata?.image]
    );

    await pool.query(
      'INSERT INTO metadata (nft_id, stage, metadata_url, image_url) VALUES($1, $2, $3, $4) RETURNING *',
      [revealedToken.id, nftStages.revealed, metadataIpfsUrl, imageIpfsUrl]
    );

    console.log(`NFT ${tokenAddress} has been written to the database`);

    res.status(200).send({
      tokenAddress,
      statPoints,
      cosmeticPoints,
      heroTier,
      statTier,
      cosmeticTier,
    });
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

const startCustomization = async (
  tokenId,
  cosmeticTraits,
  currentNft,
  tokenAddress,
  oldMetadata,
  tokenName,
  skills
) => {
  const blenderRender = await addBlenderRender({
    tokenId,
    cosmeticTraits,
    heroTier: currentNft?.hero_tier,
    tokenAddress,
  });
  const renderResult = await blenderRender.finished();
  console.log(renderResult);

  const image = path.resolve(
    __dirname,
    `${blenderOutputFolderPath}${tokenId}.png` // TODO: change extension
  );

  const imageJpeg = path.resolve(
    __dirname,
    `${blenderOutputFolderPath}${tokenId}.jpeg` // TODO: change extension
  );

  Jimp.read(image, (error, image) => {
    if (error) {
      console.error(error);
    } else {
      image.write(imageJpeg);
    }
  });

  const uploadImageIpfs = await addUploadIpfs({
    type: uploadIpfsType.image,
    pinataApiKey,
    pinataSecretApiKey,
    pinataGateway,
    data: imageJpeg,
    tokenAddress,
    stage: nftStages.customized,
  });
  const uploadImageIpfsResult = await uploadImageIpfs.finished();
  console.log(uploadImageIpfsResult);

  const { imageIpfsHash, imageIpfsUrl } = uploadImageIpfsResult;

  const metadataImage = path.resolve(
    __dirname,
    `${metadataFolderPath}${imageIpfsHash}.jpeg` // TODO: change extension
  );

  fs.copyFile(imageJpeg, metadataImage, (err) => {
    if (err) throw err;
  });

  const attributes = Object.entries(cosmeticTraits).map((item) => ({
    trait_type: cosmeticTraitsMap[item[0]],
    value: item[1],
  }));

  const metadata = {
    ...oldMetadata,
    image: imageIpfsUrl,
    external_url: `${process.env.WEBSITE_URL}`,
    token_name: tokenName,
    constitution: skills?.constitution,
    strength: skills?.strength,
    dexterity: skills?.dexterity,
    wisdom: skills?.wisdom,
    intelligence: skills?.intelligence,
    charisma: skills?.charisma,
    attributes,
    properties: {
      ...oldMetadata?.properties,
      files: [
        {
          uri: imageIpfsUrl,
          type: 'image/jpeg', // TODO: change extension
        },
      ],
    },
  };

  const uploadJsonIpfs = await addUploadIpfs({
    type: uploadIpfsType.json,
    pinataApiKey,
    pinataSecretApiKey,
    pinataGateway,
    data: metadata,
    tokenAddress,
    stage: nftStages.customized,
  });
  const uploadJsonIpfsResult = await uploadJsonIpfs.finished();
  console.log(uploadJsonIpfsResult);

  const { metadataIpfsUrl, metadataIpfsHash } = uploadJsonIpfsResult;

  const metadataJSON = JSON.stringify(metadata, null, 2);
  fs.writeFileSync(
    path.resolve(__dirname, `${metadataFolderPath}${metadataIpfsHash}.json`),
    metadataJSON
  );

  await updateMetadataUrlSolana(tokenAddress, keypair, metadataIpfsUrl);

  await pool.query(
    'INSERT INTO metadata (nft_id, stage, metadata_url, image_url) VALUES($1, $2, $3, $4) RETURNING *',
    [currentNft.id, nftStages.customized, metadataIpfsUrl, imageIpfsUrl]
  );
};

exports.customizeNftFromAdminPanel = async (req, res) => {
  try {
    const { tokenAddress } = req.body;

    const currentNft = await selectTokenByAddress(tokenAddress);
    if (!currentNft) {
      throw new Error(
        `There is no token with address ${tokenAddress.slice(0, 8)}...`
      );
    }

    const character = await selectCharacterByTokenId(currentNft.id);
    if (!character) {
      throw new Error(
        `There is no character with address ${tokenAddress.slice(0, 8)}...`
      );
    }

    const {
      token_id,
      constitution,
      strength,
      dexterity,
      wisdom,
      intelligence,
      charisma,
      race,
      sex,
      face_style,
      eye_detail,
      eyes,
      facial_hair,
      glasses,
      hair_style,
      hair_color,
      necklace,
      earring,
      nose_piercing,
      scar,
      tattoo,
      background,
    } = character;

    const tokenNameData = await pool.query(
      'SELECT * FROM token_names WHERE nft_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [currentNft.id]
    );
    const tokenName = tokenNameData?.rows?.[0]?.token_name;
    if (!tokenName) {
      throw new Error(
        `There is no token name for nft with address ${tokenAddress.slice(
          0,
          8
        )}...`
      );
    }

    const metadataQuery = await pool.query(
      'SELECT * FROM metadata WHERE nft_id = $1 AND stage = $2 ORDER BY updated_at DESC LIMIT 1',
      [currentNft.id, nftStages.revealed]
    );
    const metadataUrl = metadataQuery?.rows?.[0]?.metadata_url;
    if (!metadataUrl) {
      throw new Error(
        `There is no metadata url for nft with address ${tokenAddress.slice(
          0,
          8
        )}...`
      );
    }

    const oldMetadata = await fetchOldMetadata(tokenAddress, metadataUrl);
    !oldMetadata && throwErrorNoMetadata(tokenAddress);

    const cosmeticTraits = {
      race,
      sex,
      faceStyle: face_style,
      eyeDetail: eye_detail,
      eyes,
      facialHair: facial_hair,
      glasses,
      hairStyle: hair_style,
      hairColor: hair_color,
      necklace,
      earring,
      nosePiercing: nose_piercing,
      scar,
      tattoo,
      background,
    };

    const skills = {
      constitution,
      strength,
      dexterity,
      wisdom,
      intelligence,
      charisma,
    };

    await startCustomization(
      token_id,
      cosmeticTraits,
      currentNft,
      tokenAddress,
      oldMetadata,
      tokenName,
      skills
    );

    res.status(200).send({
      message: `Token "${tokenAddress.slice(0, 8)}..." successfully updated`,
    });
  } catch (error) {
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

    console.log(`Start customizing NFT ${tokenAddress}`);
    console.log(`Start changing metadata for NFT ${tokenAddress}`);

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

    await startCustomization(
      tokenId,
      cosmeticTraits,
      currentNft,
      tokenAddress,
      oldMetadata,
      tokenName,
      skills
    );

    res.status(200).send({ success: 'Success' });
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

exports.fetchTokenData = async (tokenAddress) => {
  const currentNft = await selectTokenByAddress(tokenAddress);

  if (!currentNft) {
    return { token_name_status: null, isCustomized: false };
  }

  const isTokenAlreadyCustomized = await checkIsTokenAlreadyCustomized(
    currentNft.id
  );

  if (!isTokenAlreadyCustomized) {
    return {
      token_name_status: null,
      isCustomized: isTokenAlreadyCustomized,
    };
  }

  const tokenNameData = await pool.query(
    'SELECT * FROM token_names WHERE nft_id = $1 ORDER BY updated_at DESC LIMIT 1',
    [currentNft.id]
  );

  if (!tokenNameData || tokenNameData.rows.length === 0) {
    return {
      token_name_status: null,
      isCustomized: isTokenAlreadyCustomized,
    };
  }

  const tokenNameStatus = tokenNameData.rows[0]?.token_name_status;

  if (!tokenNameStatus) {
    return {
      token_name_status: null,
      isCustomized: isTokenAlreadyCustomized,
    };
  }

  return {
    token_name_status: tokenNameStatus,
    isCustomized: isTokenAlreadyCustomized,
  };
};

const getMetaData = async (tokenData) => {
  return await retry(
    async () => {
      let metaData = {};
      if (tokenData) {
        const metaDataUri = tokenData.data?.uri;

        const response = await axios.get(metaDataUri);

        if (response && response.data.image) {
          metaData = response.data;
        }
      }
      return metaData;
    },
    {
      retries: 5,
    }
  );
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
          nft.updateAuthority === process.env.UPDATE_AUTHORITY &&
          nft.mint === tokenAddress
        );
      } else {
        return nft.updateAuthority === process.env.UPDATE_AUTHORITY;
      }
    });

    const cryptoquestNftsWithMetadata = cryptoquestNfts.map((nft) => ({
      ...nft,
      data: {
        ...nft.data,
        customMetaData: {},
        token_name_status: null,
        isCustomized: false,
      },
    }));

    // eslint-disable-next-line no-undef
    const nftsMetaData = await Promise.all(
      cryptoquestNftsWithMetadata.map(async (tokenData) => {
        const metaData = await getMetaData(tokenData);
        return metaData;
      })
    );

    // eslint-disable-next-line no-undef
    const nftsDataDB = await Promise.all(
      cryptoquestNftsWithMetadata.map(async (tokenData) => {
        const tokenDataDB = await this.fetchTokenData(tokenData.mint);
        return tokenDataDB;
      })
    );

    cryptoquestNftsWithMetadata.forEach(async (tokenData, index) => {
      const metaData = nftsMetaData[index];
      if (metaData) {
        tokenData.data.customMetaData = metaData;
      }
      const tokenDataDB = nftsDataDB[index];

      tokenData.data.token_name_status = tokenDataDB.token_name_status;
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
