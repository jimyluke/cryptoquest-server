const fs = require('fs');
const path = require('path');
const pool = require('../config/db.config');
const { addUploadIpfs } = require('../queues/uploadIpfs.queue');
const {
  selectTokenByAddress,
  selectCharacterByTokenId,
  renderImageAndUpdateMetadata,
  updateSolanaMetadataAfterCustomization,
} = require('../utils/nft.utils');
const { getPinataCredentials } = require('../utils/pinata');
const {
  fetchOldMetadata,
  throwErrorNoMetadata,
  getSolanaConnection,
  updateMetaplexMetadata,
} = require('../utils/solana');
const { nftStages, uploadIpfsType } = require('../variables/nft.variables');

const keypair = path.resolve(__dirname, `../../../keypair.json`);
const { pinataApiKey, pinataSecretApiKey, pinataGateway } =
  getPinataCredentials();

exports.rerenderToken = async (req, res) => {
  try {
    const { tokenAddress } = req.body;

    const connection = getSolanaConnection();

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
      skin_tone,
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
      skinTone: skin_tone,
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

    res.status(200).send({
      message: `Token "${tokenAddress.slice(
        0,
        8
      )}..." successfully added into queue for rendering`,
    });

    const { imageIpfsUrl } = await renderImageAndUpdateMetadata(
      token_id,
      cosmeticTraits,
      currentNft,
      tokenAddress
    );

    await updateSolanaMetadataAfterCustomization(
      connection,
      cosmeticTraits,
      currentNft,
      tokenAddress,
      oldMetadata,
      tokenName,
      skills,
      imageIpfsUrl
    );
  } catch (error) {
    await pool.query(
      'INSERT INTO errors (token_address, function, message) VALUES($1, $2, $3)',
      [req.body.tokenAddress, 'rerenderToken', error.message.substr(0, 250)]
    );
    console.error(error.message);
    if (!res.headersSent) {
      res.status(404).send({
        message: error.message,
      });
    }
  }
};

exports.uploadIpfsController = async (req, res) => {
  try {
    const { fileType, tokenAddress } = req.body;
    const file = req.file;

    let data;

    if (fileType === uploadIpfsType.image) {
      data = file.path;
    } else if (fileType === uploadIpfsType.json) {
      data = JSON.parse(fs.readFileSync(file.path));
    }

    const uploadIpfsProcess = await addUploadIpfs({
      type: fileType,
      pinataApiKey,
      pinataSecretApiKey,
      pinataGateway,
      data,
      tokenAddress,
      stage: nftStages.customized,
    });
    const uploadIpfsResult = await uploadIpfsProcess.finished();

    let ipfsUrl;
    if (fileType === uploadIpfsType.image) {
      ipfsUrl = uploadIpfsResult.imageIpfsUrl;
    } else if (fileType === uploadIpfsType.json) {
      ipfsUrl = uploadIpfsResult.metadataIpfsUrl;
    }

    res.status(200).send({ ipfsUrl });
  } catch (error) {
    await pool.query(
      'INSERT INTO errors (token_address, function, message) VALUES($1, $2, $3)',
      [
        req.body.tokenAddress,
        'uploadIpfsController',
        error.message.substr(0, 250),
      ]
    );
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

exports.updateMetadataUrlSolanaController = async (req, res) => {
  try {
    const { metadataIpfsUrl, tokenAddress } = req.body;

    const connection = getSolanaConnection();

    await updateMetaplexMetadata(
      connection,
      keypair,
      tokenAddress,
      metadataIpfsUrl
    );

    res.status(200).send({ success: 'Success' });
  } catch (error) {
    await pool.query(
      'INSERT INTO errors (token_address, function, message) VALUES($1, $2, $3)',
      [
        req.body.tokenAddress,
        'updateMetadataUrlSolanaController',
        error.message.substr(0, 250),
      ]
    );
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

// exports.addRevealedTokenToTheDatabase = async (req, res) => {
//   try {
//     const { metadataIpfsUrl, tokenAddress, tokenNumber } = req.body;

//     const oldMetadata = await fetchOldMetadata(tokenAddress, metadataIpfsUrl);
//     !oldMetadata && throwErrorNoMetadata(tokenAddress);

//     const {
//       name,
//       tome,
//       stat_points,
//       cosmetic_points,
//       stat_tier,
//       cosmetic_tier,
//       hero_tier,
//       image,
//     } = oldMetadata;

//     const mintNumber = name.split('#')[1];

//     const revealedTokenData = await pool.query(
//       'INSERT INTO tokens (token_address, mint_name, tome, mint_number, token_number, stat_points, cosmetic_points, stat_tier, cosmetic_tier, hero_tier) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
//       [
//         tokenAddress,
//         name,
//         tome,
//         mintNumber,
//         tokenNumber,
//         stat_points,
//         cosmetic_points,
//         stat_tier,
//         cosmetic_tier,
//         hero_tier,
//       ]
//     );

//     const revealedToken = revealedTokenData?.rows?.[0];

//     await pool.query(
//       'INSERT INTO metadata (nft_id, stage, metadata_url, image_url) VALUES($1, $2, $3, $4) RETURNING *',
//       [revealedToken.id, nftStages.revealed, metadataIpfsUrl, image]
//     );

//     await updateMetadataUrlSolana(tokenAddress, keypair, metadataIpfsUrl);

//     res.status(200).send({ success: 'Success' });
//   } catch (error) {
//     await pool.query(
//       'INSERT INTO errors (token_address, function, message) VALUES($1, $2, $3)',
//       [
//         req.body.tokenAddress,
//         'addRevealedTokenToTheDatabase',
//         error.message.substr(0, 250),
//       ]
//     );
//     console.error(error.message);
//     res.status(404).send({
//       message: error.message,
//     });
//   }
// };
