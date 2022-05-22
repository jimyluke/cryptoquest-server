const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const path = require('path');

const {
  heroTierImagesIpfsUrls,
  heroTierRecipes,
} = require('../variables/nft.variables');
const pool = require('../config/db.config');
const { environmentEnum } = require('../variables/global.variables');

const addonName = 'CryptoQuest_Test'; // TODO: fix it for real addon name
const blenderOutputFolderPathAbsolute =
  process.env.NODE_ENV === environmentEnum.development
    ? process.env.BLENDER_OUTPUT_LOCAL_ADDRESS
    : process.env.BLENDER_OUTPUT_SERVER_ADDRESS;
const blenderOutputFolderPathRelative = '../../../blender_output/';

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

exports.getHeroTierImageFromIpfs = (heroTierRecipe) => {
  if (heroTierRecipe === heroTierRecipes.dawnOfManCommon) {
    return heroTierImagesIpfsUrls.dawnOfManCommon;
  } else if (heroTierRecipe === heroTierRecipes.dawnOfManUncommon) {
    return heroTierImagesIpfsUrls.dawnOfManUncommon;
  } else if (heroTierRecipe === heroTierRecipes.dawnOfManRare) {
    return heroTierImagesIpfsUrls.dawnOfManRare;
  } else if (heroTierRecipe === heroTierRecipes.dawnOfManEpic) {
    return heroTierImagesIpfsUrls.dawnOfManEpic;
  } else if (heroTierRecipe === heroTierRecipes.dawnOfManLegendary) {
    return heroTierImagesIpfsUrls.dawnOfManLegendary;
  } else if (heroTierRecipe === heroTierRecipes.dawnOfManMythic) {
    return heroTierImagesIpfsUrls.dawnOfManMythic;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteCommon) {
    return heroTierImagesIpfsUrls.woodlandRespiteCommon;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteUncommon) {
    return heroTierImagesIpfsUrls.woodlandRespiteUncommon;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteRare) {
    return heroTierImagesIpfsUrls.woodlandRespiteRare;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteEpic) {
    return heroTierImagesIpfsUrls.woodlandRespiteEpic;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteLegendary) {
    return heroTierImagesIpfsUrls.woodlandRespiteLegendary;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteMythic) {
    return heroTierImagesIpfsUrls.woodlandRespiteMythic;
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

exports.renderTokenFromBlender = async (
  tokenId,
  cosmeticTraits,
  heroTier,
  tokenAddress
) => {
  console.log(tokenId);

  const {
    race,
    sex,
    faceStyle,
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

  const config = {
    engine: 'CYCLES',
    width: 1000,
    height: 1000,
    'NFT name': `${race}_${sex}_${faceStyle.split(' ').join('_')}`,
    'Token Id': tokenId,
    race,
    sex,
    face_style: faceStyle,
    hero_tier: heroTier,
    eye_detail: eyeDetail,
    eye_colors: eyes.split(' ').pop(),
    facial_hair: facialHair,
    glasses,
    hair_style: hairStyle,
    hair_color: hairColor,
    necklace,
    earring,
    nose_piercing: nosePiercing,
    scar,
    face_tattoo: tattoo,
    background,
  };

  console.log(config);

  const configJSON = JSON.stringify(config, null, 2);
  fs.writeFileSync(
    path.resolve(
      __dirname,
      `${blenderOutputFolderPathRelative}${tokenId}.json`
    ),
    configJSON
  );

  const { stdout, stderr } = await exec(
    `blender 1> nul -b -noaudio --addons ${addonName} --python-expr "import bpy;bpy.ops.crypto_quest_test.render_from_json(jsonPath= '${blenderOutputFolderPathAbsolute}${tokenId}.json', outDir = '${blenderOutputFolderPathAbsolute}')"`
  );

  console.log('BLENDER STDOUT:', stdout);
  if (stderr) {
    console.log('BLENDER STDERR:', stderr);
    const renderedImageExist = stderr.includes('exists in Tokens Directory');
    if (!renderedImageExist) {
      throw new Error(stderr);
    }
  }

  return {
    tokenAddress,
  };
};
