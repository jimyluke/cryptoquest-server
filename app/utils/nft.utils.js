const fs = require('fs');
const path = require('path');
const retry = require('async-retry');
const axios = require('axios');

const { randomInteger } = require('./randomInteger');
const {
  calculateCosmeticTier,
  calculateStatTier,
} = require('./calculateTiers');
const {
  heroTierImagesIpfsUrls,
  heroTierEnum,
  cosmeticPointsForTraits,
  nftStages,
  uploadIpfsType,
  cosmeticTraitsMap,
} = require('../variables/nft.variables');
const pool = require('../config/db.config');

const { getPinataCredentials } = require('./pinata');
const { updateMetadataUrlSolana } = require('./solana');
const { addUploadIpfs } = require('../queues/uploadIpfs.queue');
const { addBlenderRender } = require('../queues/blenderRender.queue');
const { addMetabossUpdate } = require('../queues/metabossUpdate.queue');

const blenderOutputFolderPathRelative = '../../../blender_output/';
const metadataFolderPath = '../../../metadata/';
const { pinataApiKey, pinataSecretApiKey, pinataGateway } =
  getPinataCredentials();
const keypair = path.resolve(__dirname, `../../../keypair.json`);

exports.throwErrorTokenAlreadyRevealed = (tokenAddress) => {
  throw new Error(
    `Token ${tokenAddress.slice(0, 8)}... has already been revealed`
  );
};

exports.throwErrorTokenHasNotBeenRevealed = (tokenAddress) => {
  throw new Error(`Token ${tokenAddress.slice(0, 8)}... has not been revealed`);
};

exports.throwErrorTokenAlreadyCustomized = (tokenAddress) => {
  throw new Error(`Token ${tokenAddress.slice(0, 8)}... already customized`);
};

exports.throwErrorTokenHasNotBeenCustomized = (tokenAddress) => {
  throw new Error(
    `Token ${tokenAddress.slice(0, 8)}... has not been customized`
  );
};

exports.checkIsTokenAlreadyRevealed = async (tokenAddress) => {
  const isTokenAlreadyRevealedQuery = await pool.query(
    'SELECT EXISTS(SELECT 1 FROM tokens WHERE token_address = $1)',
    [tokenAddress]
  );

  const isTokenAlreadyRevealed = isTokenAlreadyRevealedQuery?.rows[0]?.exists;
  return isTokenAlreadyRevealed;
};

exports.checkIsTokenAlreadyCustomized = async (tokenId) => {
  const isTokenAlreadyCustomizedQuery = await pool.query(
    'SELECT EXISTS(SELECT 1 FROM characters WHERE nft_id = $1)',
    [tokenId]
  );

  const isTokenAlreadyCustomized = isTokenAlreadyCustomizedQuery.rows[0].exists;
  return isTokenAlreadyCustomized;
};

exports.getHeroTierImageFromIpfs = (heroTier) => {
  if (heroTier === heroTierEnum.common) {
    return heroTierImagesIpfsUrls.common;
  } else if (heroTier === heroTierEnum.uncommon) {
    return heroTierImagesIpfsUrls.uncommon;
  } else if (heroTier === heroTierEnum.rare) {
    return heroTierImagesIpfsUrls.rare;
  } else if (heroTier === heroTierEnum.epic) {
    return heroTierImagesIpfsUrls.epic;
  } else if (heroTier === heroTierEnum.legendary) {
    return heroTierImagesIpfsUrls.legendary;
  } else if (heroTier === heroTierEnum.mythic) {
    return heroTierImagesIpfsUrls.mythic;
  }
};

exports.selectTokenByAddress = async (tokenAddress) => {
  const tokenQuery = await pool.query(
    'SELECT * FROM tokens WHERE token_address = $1',
    [tokenAddress]
  );
  const token = tokenQuery?.rows?.[0];
  return token;
};

exports.selectCharacterByTokenId = async (tokenId) => {
  const characterQuery = await pool.query(
    'SELECT * FROM characters WHERE nft_id = $1',
    [tokenId]
  );
  const character = characterQuery?.rows?.[0];
  return character;
};

exports.checkIsSkillsValid = (statPoints, skills) => {
  const totalSkills = Object.values(skills).reduce((a, b) => a + b, 0);

  return totalSkills === statPoints ? true : false;
};

exports.checkIsTraitsValid = (cosmeticPoints, cosmeticTraits) => {
  const {
    sex,
    faceStyle,
    skinTone,
    eyeDetail,
    eyes,
    facialHair,
    glasses,
    hairStyle,
    hairColor,
    necklace,
    earring,
    nosePiercing,
    scar,
    tattoo,
    background,
  } = cosmeticTraits;

  const sexCP = cosmeticPointsForTraits.sexes[sex];
  const faceStyleCP = cosmeticPointsForTraits.faceStyles[faceStyle];
  const skinToneCP = cosmeticPointsForTraits.skinTones[skinTone];
  const eyeDetailCP = cosmeticPointsForTraits.eyeDetails[eyeDetail];
  const eyesCP = cosmeticPointsForTraits.eyes[eyes];
  const facialHairCP = cosmeticPointsForTraits.facialHair[facialHair];
  const glassesCP = cosmeticPointsForTraits.glasses[glasses];
  const hairStyleCP = cosmeticPointsForTraits.hairStyles[hairStyle];
  const hairColorCP = cosmeticPointsForTraits.hairColors[hairColor];
  const necklaceCP = cosmeticPointsForTraits.necklaces[necklace];
  const earringCP = cosmeticPointsForTraits.earrings[earring];
  const nosePiercingCP = cosmeticPointsForTraits.nosePiercing[nosePiercing];
  const scarCP = cosmeticPointsForTraits.scars[scar];
  const tattooCP = cosmeticPointsForTraits.tattoos[tattoo];
  const backgroundCP = cosmeticPointsForTraits.backgrounds[background];

  const cosmeticPointsSpent =
    sexCP +
    faceStyleCP +
    skinToneCP +
    eyeDetailCP +
    eyesCP +
    facialHairCP +
    glassesCP +
    hairStyleCP +
    hairColorCP +
    necklaceCP +
    earringCP +
    nosePiercingCP +
    scarCP +
    tattooCP +
    backgroundCP;

  return cosmeticPointsSpent <= cosmeticPoints ? true : false;
};

exports.getRandomTokenFromTome = async (tome) => {
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

      const statTier = calculateStatTier(statPoints, tome);
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

exports.checkIsTokenIdUnique = async (tokenId) => {
  const isTokenIdExistQuery = await pool.query(
    'SELECT EXISTS(SELECT 1 FROM characters WHERE token_id = $1)',
    [tokenId]
  );

  const isTokenIdExist = isTokenIdExistQuery?.rows?.[0]?.exists;

  return isTokenIdExist;
};

exports.updateSolanaMetadataAfterCustomization = async (
  cosmeticTraits,
  currentNft,
  tokenAddress,
  oldMetadata,
  tokenName,
  skills,
  rerenderedImageUrl
) => {
  const attributes = Object.entries(cosmeticTraits).map((item) => ({
    trait_type: cosmeticTraitsMap[item[0]],
    value: item[1],
  }));

  const {
    tome,
    stat_points,
    cosmetic_points,
    stat_tier,
    cosmetic_tier,
    hero_tier,
  } = currentNft;

  const { constitution, strength, dexterity, wisdom, intelligence, charisma } =
    skills;

  const imageUrl = rerenderedImageUrl ? rerenderedImageUrl : oldMetadata?.image;

  const metadata = {
    ...oldMetadata,
    image: imageUrl,
    external_url: `${process.env.WEBSITE_URL}`,
    properties: {
      ...oldMetadata?.properties,
      files: [
        {
          uri: imageUrl,
          type: rerenderedImageUrl ? 'image/jpeg' : 'image/png',
        },
      ],
    },
    tome,
    stat_points,
    cosmetic_points,
    stat_tier,
    cosmetic_tier,
    hero_tier,
    token_name: tokenName,
    constitution,
    strength,
    dexterity,
    wisdom,
    intelligence,
    charisma,
    attributes: [
      {
        trait_type: 'Stage',
        value: 'Hero',
      },
      ...attributes,
    ],
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

  const { metadataIpfsUrl, metadataIpfsHash } = uploadJsonIpfsResult;

  const metadataJSON = JSON.stringify(metadata, null, 2);
  fs.writeFileSync(
    path.resolve(__dirname, `${metadataFolderPath}${metadataIpfsHash}.json`),
    metadataJSON
  );

  // await updateMetadataUrlSolana(tokenAddress, keypair, metadataIpfsUrl);
  const metabossUpdate = await addMetabossUpdate({
    tokenAddress,
    keypair,
    metadataIpfsUrl,
  });
  await metabossUpdate.finished();

  await pool.query(
    'INSERT INTO metadata (nft_id, stage, metadata_url, image_url) VALUES($1, $2, $3, $4) RETURNING *',
    [currentNft.id, nftStages.customized, metadataIpfsUrl, imageUrl]
  );

  return { metadataIpfsUrl };
};

exports.renderImageAndUpdateMetadata = async (
  tokenId,
  cosmeticTraits,
  currentNft,
  tokenAddress
) => {
  const blenderRender = await addBlenderRender({
    tokenId,
    cosmeticTraits,
    heroTier: currentNft?.hero_tier,
    tokenAddress,
  });
  await blenderRender.finished();

  const image = path.resolve(
    __dirname,
    `${blenderOutputFolderPathRelative}${tokenId}.jpg`
  );

  const uploadImageIpfs = await addUploadIpfs({
    type: uploadIpfsType.image,
    pinataApiKey,
    pinataSecretApiKey,
    pinataGateway,
    data: image,
    tokenAddress,
    stage: nftStages.customized,
  });
  const uploadImageIpfsResult = await uploadImageIpfs.finished();

  const { imageIpfsHash, imageIpfsUrl } = uploadImageIpfsResult;

  const metadataImagePath = path.resolve(
    __dirname,
    `${metadataFolderPath}${imageIpfsHash}.jpg`
  );

  fs.copyFile(image, metadataImagePath, (err) => {
    if (err) throw err;
  });

  return { imageIpfsUrl };
};

exports.fetchTokenData = async (tokenAddress) => {
  const currentNft = await this.selectTokenByAddress(tokenAddress);

  if (!currentNft) {
    return { token_name_status: null, isCustomized: false };
  }

  const isTokenAlreadyCustomized = await this.checkIsTokenAlreadyCustomized(
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

exports.getMetaData = async (tokenData) => {
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
