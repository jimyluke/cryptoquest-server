const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const path = require('path');
const { environmentEnum } = require('../variables/global.variables');

const addonName = 'CryptoQuest_Test'; // TODO: fix it for real addon name
const blenderOutputFolderPathAbsolute =
  process.env.NODE_ENV === environmentEnum.development
    ? process.env.BLENDER_OUTPUT_LOCAL_ADDRESS
    : process.env.BLENDER_OUTPUT_SERVER_ADDRESS;
const blenderOutputFolderPathRelative = '../../../blender_output/';

// TODO: update new config with skin tones
exports.renderTokenFromBlender = async (
  tokenId,
  cosmeticTraits,
  heroTier,
  tokenAddress
) => {
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
    width: 2000,
    height: 2000,
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

  const configJSON = JSON.stringify(config, null, 2);
  fs.writeFileSync(
    path.resolve(
      __dirname,
      `${blenderOutputFolderPathRelative}${tokenId}.json`
    ),
    configJSON
  );

  const { stderr } = await exec(
    `blender 1> nul -b -noaudio --addons ${addonName} --python-expr "import bpy;bpy.ops.crypto_quest_test.render_from_json(jsonPath= '${blenderOutputFolderPathAbsolute}${tokenId}.json', outDir = '${blenderOutputFolderPathAbsolute}')"`
  );

  if (stderr) {
    console.error('BLENDER STDERR:', stderr);
    const renderedImageExist = stderr.includes('exists in Tokens Directory');
    if (!renderedImageExist) {
      throw new Error(stderr);
    }
  }

  return {
    tokenAddress,
  };
};
