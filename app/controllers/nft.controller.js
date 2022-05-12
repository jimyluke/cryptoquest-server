const fs = require('fs');
const util = require('util');
const path = require('path');
const retry = require('async-retry');
const axios = require('axios');
const exec = util.promisify(require('child_process').exec);

const pool = require('../config/db.config');
const {
  calculateStatTier,
  calculateCosmeticTier,
} = require('../utils/calculateTiers');
const { randomInteger } = require('../utils/randomInteger');
const { getLastIndexForFile } = require('../utils/getLastIndexForFile');
const { uploadIPFS } = require('../utils/pinata');
const { nftStages } = require('../variables/nft.variables');
const {
  updateMetadataUrlSolana,
  fetchOldMetadata,
  throwErrorNoMetadata,
} = require('../utils/solana');
const keypair = path.resolve(__dirname, `../config/keypair.json`);

const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_API_SECRET_KEY;
const pinataGateway = null;

const throwErrorTokenAlreadyRevealed = (tokenAddress) => {
  throw new Error(
    `NFT ${tokenAddress.slice(0, 8)}... has already been revealed`
  );
};

const checkIsTokenAlreadyRevealed = async (tokenAddress) => {
  const isTokenAddressExistQuery = await retry(
    async () => {
      return await pool.query(
        'SELECT EXISTS(SELECT 1 FROM tokens WHERE token_address = $1)',
        [tokenAddress]
      );
    },
    {
      retries: 5,
    }
  );

  const isTokenAddressExist = isTokenAddressExistQuery?.rows[0]?.exists;

  if (isTokenAddressExist) {
    throwErrorTokenAlreadyRevealed(tokenAddress);
  }
};

const getRandomTokenFromRecipe = async (recipe) => {
  return await retry(
    async () => {
      // Select all possible tokens from recipe
      let allTokensFromRecipe;
      if (recipe === 'Woodland Respite') {
        allTokensFromRecipe = await pool.query(
          'SELECT * FROM woodland_respite'
        );
      } else if (recipe === 'Dawn of Man') {
        allTokensFromRecipe = await pool.query('SELECT * FROM dawn_of_man');
      }

      // Select all already revealed tokens from recipe
      const revealedTokensFromRecipe = await pool.query(
        'SELECT * FROM tokens WHERE recipe = $1',
        [recipe]
      );

      const allTokenNumbers = Array.from(
        { length: allTokensFromRecipe?.rows.length },
        (_, i) => i + 1
      );

      const revealedTokenNumbers = revealedTokensFromRecipe?.rows.map(
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
      } = allTokensFromRecipe.rows.find(
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

// Check is nft unique
exports.checkIsTokenIdUnique = async (req, res) => {
  try {
    const { tokenId } = req.body;

    const isTokenIdExistQuery = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM characters WHERE token_id = $1)',
      [tokenId]
    );

    const isTokenIdExist = isTokenIdExistQuery.rows[0].exists;

    res.status(200).send({ isTokenIdExist });
  } catch (error) {
    console.error(error.message);
    res.status(404).send(error.message);
  }
};

// Check available recipes
exports.availableRecipes = async (req, res) => {
  try {
    const allRecipesWoodlandRespite = await pool.query(
      'SELECT * FROM woodland_respite'
    );
    const allRecipesDawnOfMan = await pool.query('SELECT * FROM dawn_of_man');

    const revealedRecipesWoodlandRespite = await pool.query(
      'SELECT * FROM tokens WHERE recipe = $1',
      ['Woodland Respite']
    );
    const revealedRecipesDawnOfMan = await pool.query(
      'SELECT * FROM tokens WHERE recipe = $1',
      ['Dawn of Man']
    );

    const remainingRecipesWoodlandRespite =
      allRecipesWoodlandRespite.rows.length -
      revealedRecipesWoodlandRespite.rows.length;
    const remainingRecipesDawnOfMan =
      allRecipesDawnOfMan.rows.length - revealedRecipesDawnOfMan.rows.length;

    res.status(200).send({
      woodlandRespite: remainingRecipesWoodlandRespite,
      dawnOfMan: remainingRecipesDawnOfMan,
    });
  } catch (error) {
    console.log(error.message);
    res.status(404).send(error.message);
  }
};

// Reveal Nft
exports.revealNft = async (req, res) => {
  try {
    const { tokenAddress, metadataUri, mintName, mintNumber, recipe } =
      req.body;

    const oldMetadata = await fetchOldMetadata(tokenAddress, metadataUri);
    !oldMetadata && throwErrorNoMetadata(tokenAddress);

    await checkIsTokenAlreadyRevealed(tokenAddress);

    console.log(`Start revealing NFT ${tokenAddress}`);

    const {
      tokenNumber,
      statPoints,
      cosmeticPoints,
      statTier,
      cosmeticTier,
      heroTier,
    } = await getRandomTokenFromRecipe(recipe);

    console.log(`Start changing metadata for NFT ${tokenAddress}`);

    const lastMetadataIndex = getLastIndexForFile(tokenAddress, 'json');
    const oldMetadataIndex = lastMetadataIndex + 1;
    const metadataIndex = oldMetadataIndex + 1;

    const oldMetadataJSON = JSON.stringify(oldMetadata, null, 2);

    fs.writeFileSync(
      path.resolve(
        __dirname,
        `../../../metadata/${tokenAddress}-${oldMetadataIndex}.json`
      ),
      oldMetadataJSON
    );

    const heroTierImagePath = `${recipe
      .toLowerCase()
      .split(' ')
      .join('_')}_${heroTier.toLowerCase()}`;

    const imageUrlServer = `${
      process.env.NODE_ENV === 'development'
        ? `${process.env.LOCAL_ADDRESS}/metadata/${heroTierImagePath}.png`
        : `${process.env.SERVER_ADDRESS}/api/metadata/${heroTierImagePath}.png`
    }`;

    const metadata = {
      ...oldMetadata,
      image: imageUrlServer,
      external_url: `${process.env.WEBSITE_URL}`,
      recipe,
      stat_points: statPoints,
      cosmetic_points: cosmeticPoints,
      stat_tier: statTier,
      cosmetic_tier: cosmeticTier,
      hero_tier: heroTier,
      properties: {
        ...oldMetadata?.properties,
        files: [
          {
            uri: imageUrlServer,
            type: 'image/png',
          },
        ],
      },
    };

    const metadataJSON = JSON.stringify(metadata, null, 2);

    fs.writeFileSync(
      path.resolve(
        __dirname,
        `../../../metadata/${tokenAddress}-${metadataIndex}.json`
      ),
      metadataJSON
    );

    const { metadataUrlIpfs, imageUrlIpfs } = await uploadIPFS(
      nftStages.revealed,
      pinataApiKey,
      pinataSecretApiKey,
      pinataGateway,
      `${tokenAddress}-${metadataIndex}`,
      heroTierImagePath
    );

    await updateMetadataUrlSolana(tokenAddress, keypair, metadataUrlIpfs);

    const revealedTokenData = await pool.query(
      'INSERT INTO tokens (token_address, mint_name, recipe, mint_number, token_number, stat_points, cosmetic_points, stat_tier, cosmetic_tier, hero_tier) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [
        tokenAddress,
        mintName,
        recipe,
        mintNumber,
        tokenNumber,
        statPoints,
        cosmeticPoints,
        statTier,
        cosmeticTier,
        heroTier,
      ]
    );

    const revealedToken = revealedTokenData.rows[0];

    const oldMetadataUrl = `${
      process.env.NODE_ENV === 'development'
        ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}-${oldMetadataIndex}.json`
        : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}-${oldMetadataIndex}.json`
    }`;

    await pool.query(
      'INSERT INTO metadata (nft_id, stage, metadata_url_ipfs, image_url_ipfs, metadata_url_server, image_url_server) VALUES($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        revealedToken.id,
        'minted',
        metadataUri,
        oldMetadata?.image,
        oldMetadataUrl,
        oldMetadata?.image, // TODO: change for blank slate token image url on server
      ]
    );

    const metadataUrl = `${
      process.env.NODE_ENV === 'development'
        ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}-${metadataIndex}.json`
        : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}-${metadataIndex}.json`
    }`;

    await pool.query(
      'INSERT INTO metadata (nft_id, stage, metadata_url_ipfs, image_url_ipfs, metadata_url_server, image_url_server) VALUES($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        revealedToken.id,
        'revealed',
        metadataUrlIpfs,
        imageUrlIpfs,
        metadataUrl,
        imageUrlServer,
      ]
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

    let oldMetadata;
    try {
      const { data } = await axios.get(metadataUri);
      oldMetadata = data;
    } catch (error) {
      res.status(404).send({
        message: `There is no metadata for NFT ${tokenAddress.slice(0, 8)}...`,
      });
      return;
    }

    if (!oldMetadata) {
      res.status(404).send({
        message: `There is no metadata for NFT ${tokenAddress.slice(0, 8)}...`,
      });
      return;
    }

    const currentNftQuery = await pool.query(
      'SELECT * FROM tokens WHERE token_address = $1',
      [tokenAddress]
    );

    const currentNft = currentNftQuery.rows[0];

    if (!currentNft) {
      throw new Error(
        `NFT ${tokenAddress.slice(0, 8)}... has not been revealed`
      );
    }

    const isTokenAddressExistQuery = await pool.query(
      'SELECT EXISTS(SELECT * FROM characters WHERE nft_id = $1)',
      [currentNft.id]
    );

    const isTokenAddressExist = isTokenAddressExistQuery.rows[0].exists;

    if (isTokenAddressExist) {
      throw new Error(`NFT ${tokenAddress.slice(0, 8)}... already customized`);
    }

    console.log(`Start customizing NFT ${tokenAddress}`);
    console.log(`Start changing metadata for NFT ${tokenAddress}`);

    const cosmeticMap = {
      race: 'Race',
      sex: 'Sex',
      faceStyle: 'Face Style',
      eyeDetail: 'Eye Detail',
      eyes: 'Eyes',
      facialHair: 'Facial Hair',
      glasses: 'Glasses',
      hairStyle: 'Hair Style',
      hairColor: 'Hair Color',
      necklace: 'Necklace',
      earring: 'Earring',
      nosePiercing: 'Nose Piercing',
      scar: 'Scar',
      tattoo: 'Tattoo',
      background: 'Background',
    };

    const attributes = Object.entries(cosmeticTraits).map((item) => ({
      trait_type: cosmeticMap[item[0]],
      value: item[1],
    }));

    const lastMetadataIndex = getLastIndexForFile(tokenAddress, 'json');
    const metadataIndex = lastMetadataIndex + 1;

    try {
      const { stdout, stderr } = await exec(
        `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${
          process.env.NODE_ENV === 'development'
            ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}-${metadataIndex}.json`
            : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}-${metadataIndex}.json`
        }`
      );

      console.log('METABOSS STDOUT:', stdout);
      if (stderr) console.log('METABOSS STDERR:', stderr);
    } catch (error) {
      res.status(404).send({
        message: `Unable to change metadata, Solana blockchain unavailable, please try again later`,
      });
      return;
    }

    const imageUrlServer = `${
      process.env.NODE_ENV === 'development'
        ? `${process.env.LOCAL_ADDRESS}/metadata/after_customization.png`
        : `${process.env.SERVER_ADDRESS}/api/metadata/after_customization.png`
    }`;

    const metadata = {
      ...oldMetadata,
      image: imageUrlServer,
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
            uri: imageUrlServer,
            type: 'image/png',
          },
        ],
      },
    };

    const metadataJSON = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(
      path.resolve(
        __dirname,
        `../../../metadata/${tokenAddress}-${metadataIndex}.json`
      ),
      metadataJSON
    );

    await pool.query(
      'INSERT INTO token_names (nft_id, token_name, token_name_status) VALUES($1, $2, $3) RETURNING *',
      [currentNft.id, tokenName, 'approved']
    );

    await pool.query(
      'INSERT INTO characters (nft_id, token_id, constitution, strength, dexterity, wisdom, intelligence, charisma, race, sex, face_style, eye_detail, eyes, facial_hair, glasses, hair_style, hair_color, necklace, earring, nose_piercing, scar, tattoo, background) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING *',
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

    const metadataUrl = `${
      process.env.NODE_ENV === 'development'
        ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}-${metadataIndex}.json`
        : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}-${metadataIndex}.json`
    }`;

    await pool.query(
      'INSERT INTO metadata (nft_id, stage, metadata_url_ipfs, image_url_ipfs, metadata_url_server, image_url_server) VALUES($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        currentNft.id,
        'customized',
        metadataUrl,
        imageUrlServer,
        metadataUrl,
        imageUrlServer,
      ]
    );

    console.log(`NFT ${tokenAddress} has been written to the database`);

    res.status(200).send({ success: 'Success' });
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
};
