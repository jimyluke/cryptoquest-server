const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const path = require('path');
const { environmentEnum } = require('../variables/global.variables');

const addonName = 'CryptoQuest';
const blenderOutputFolderPathAbsolute =
  process.env.NODE_ENV === environmentEnum.development
    ? process.env.BLENDER_OUTPUT_LOCAL_ADDRESS
    : process.env.BLENDER_OUTPUT_SERVER_ADDRESS;
const blenderOutputFolderPathRelative = '../../../blender_output/';

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

  const config = {
    width: 2000,
    height: 2000,
    'Token Id': tokenId,
    race,
    sex,
    face_style: faceStyle,
    skin_tone: skinTone,
    hero_tier: heroTier,
    scar,
    hair_style: hairStyle,
    hair_color: hairColor,
    facial_hair: facialHair,
    eye_colors: eyes.split(' ').pop(),
    eye_detail: eyeDetail,
    glasses,
    necklace,
    earring,
    nose_piercing: nosePiercing,
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
    `blender 1> nul -b -noaudio --addons CryptoQuest --python-expr "import bpy;bpy.ops.crypto_quest.render_from_json(jsonPath= '${blenderOutputFolderPathAbsolute}${tokenId}.json', outDirPath = '${blenderOutputFolderPathAbsolute}')"`
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
