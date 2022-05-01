const fs = require('fs');
const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);
const pool = require('../config/db.config');
const axios = require('axios');
const {
  calculateStatTier,
  calculateCosmeticTier,
} = require('../utils/calculateTiers');
const { randomInteger } = require('../utils/randomInteger');

const keypair = path.resolve(__dirname, `../config/keypair.json`);

// Check is nft unique
exports.checkIsNftUnique = async (req, res) => {
  try {
    const { tokenId } = req.body;

    const isTokenIdExistQuery = await pool.query(
      'SELECT EXISTS(SELECT * FROM characters WHERE token_id = $1)',
      [tokenId]
    );

    const isTokenIdExist = isTokenIdExistQuery.rows[0].exists;

    res.status(200).send({ isTokenIdExist });
  } catch (error) {
    console.log(error.message);
    res.status(404).send(error.message);
  }
};

// Check is token name unique
exports.checkIsTokenNameUnique = async (req, res) => {
  try {
    const { tokenName } = req.body;
    const tokenNameLower = tokenName.trim().toLowerCase();

    const tokenNames = await pool.query('SELECT * FROM token_names');
    const tokenNamesLower = tokenNames.rows.map((item) =>
      item.token_name.toLowerCase()
    );

    const isTokenNameExist = tokenNamesLower.includes(tokenNameLower);

    res.status(200).send({ isTokenNameExist });
  } catch (error) {
    console.log(error.message);
    res.status(404).send(error.message);
  }
};

// Reveal Nft
exports.revealNft = async (req, res) => {
  try {
    const { tokenAddress, metadataUri, mintName, mintNumber } = req.body;

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

    const isTokenAddressExistQuery = await pool.query(
      'SELECT EXISTS(SELECT * FROM tokens WHERE token_address = $1)',
      [tokenAddress]
    );
    const isTokenAddressExist = isTokenAddressExistQuery.rows[0].exists;

    if (isTokenAddressExist) {
      res.status(400).send({
        message: `NFT ${tokenAddress.slice(0, 8)}... already revealed`,
      });
      return;
    }

    console.log(`Start revealing NFT ${tokenAddress}`);

    // Get collection of NFT
    const collection = oldMetadata?.collection?.name;

    // Select all possible tokens from collection
    let allTokensFromCollection;
    if (collection === 'Woodland Respite') {
      allTokensFromCollection = await pool.query(
        'SELECT * FROM woodland_respite'
      );
    } else if (collection === 'Dawn of Man') {
      allTokensFromCollection = await pool.query('SELECT * FROM dawn_of_man');
    }

    // Select all already revealed tokens from collection
    const revealedTokensFromCollection = await pool.query(
      'SELECT * FROM tokens WHERE collection = $1',
      [collection]
    );

    const allTokenNumbers = Array.from(
      { length: allTokensFromCollection.rows.length },
      (_, i) => i + 1
    );

    const revealedTokenNumbers = revealedTokensFromCollection?.rows.map(
      (item) => item?.token_number
    );
    // eslint-disable-next-line no-undef
    const revealedTokenNumbersSet = new Set(revealedTokenNumbers);
    const remainingTokenNumbers = allTokenNumbers.filter(
      (item) => !revealedTokenNumbersSet.has(item)
    );

    if (remainingTokenNumbers.length <= 0) {
      res.status(400).send({
        message: `All tokens already revealed`,
      });
      return;
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
    } = allTokensFromCollection.rows.find(
      (item) => item.token_number === selectedTokenNumber
    );

    const statTier = calculateStatTier(statPoints);
    const cosmeticTier = calculateCosmeticTier(cosmeticPoints);

    console.log(`Start changing metadata for NFT ${tokenAddress}`);

    // Select all possible tokens from collection
    let collectionImagePath;
    if (collection === 'Woodland Respite') {
      collectionImagePath = 'woodland-respite';
    } else if (collection === 'Dawn of Man') {
      collectionImagePath = 'dawn-of-man';
    }

    const metadata = {
      name: oldMetadata?.name,
      symbol: oldMetadata?.symbol,
      description: oldMetadata?.description,
      seller_fee_basis_points: oldMetadata?.seller_fee_basis_points,
      image: `${
        process.env.NODE_ENV === 'development'
          ? `${
              process.env.LOCAL_ADDRESS
            }/metadata/${collectionImagePath}-${heroTier.toLowerCase()}.png`
          : `${
              process.env.SERVER_ADDRESS
            }/api/metadata/${collectionImagePath}-${heroTier.toLowerCase()}.png`
      }`,
      external_url: `${process.env.WEBSITE_URL}`,
      stat_points: statPoints,
      cosmetic_points: cosmeticPoints,
      stat_tier: statTier,
      cosmetic_tier: cosmeticTier,
      hero_tier: heroTier,
      collection: {
        name: collection,
        family: oldMetadata?.collection?.family,
      },
      properties: {
        files: [
          {
            uri: `${
              process.env.NODE_ENV === 'development'
                ? `${
                    process.env.LOCAL_ADDRESS
                  }/metadata/${collectionImagePath}-${heroTier.toLowerCase()}.png`
                : `${
                    process.env.SERVER_ADDRESS
                  }/api/metadata/${collectionImagePath}-${heroTier.toLowerCase()}.png`
            }`,
            type: 'image/png',
          },
        ],
        category: oldMetadata?.properties?.category,
        creators: oldMetadata?.properties?.creators,
      },
    };

    const metadataJSON = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `../../../metadata/${tokenAddress}.json`),
      metadataJSON
    );

    try {
      const { stdout, stderr } = await exec(
        `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${
          process.env.NODE_ENV === 'development'
            ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}.json`
            : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}.json`
        }`
      );

      console.log('METABOSS STDOUT:', stdout);
      if (stderr) console.log('METABOSS STDERR:', stderr);
    } catch (error) {
      fs.unlinkSync(
        path.resolve(__dirname, `../../../metadata/${tokenAddress}.json`)
      );
      res.status(404).send({
        message: `Unable to change metadata, Solana blockchain unavailable, please try again later`,
      });
      return;
    }

    await pool.query(
      'INSERT INTO tokens (token_address, mint_name, collection, mint_number, token_number, stat_points, cosmetic_points, stat_tier, cosmetic_tier, hero_tier) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [
        tokenAddress,
        mintName,
        collection,
        mintNumber,
        tokenNumber,
        statPoints,
        cosmeticPoints,
        statTier,
        cosmeticTier,
        heroTier,
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
    console.log(error.message);
    res.status(404).send(error.message);
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

    const { data: oldMetadata } = await axios.get(metadataUri);

    if (!oldMetadata) {
      res.status(400).send({
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

    const metadata = {
      name: oldMetadata?.name,
      symbol: oldMetadata?.symbol,
      description: oldMetadata?.description,
      seller_fee_basis_points: oldMetadata?.seller_fee_basis_points,
      image: `${
        process.env.NODE_ENV === 'development'
          ? `${process.env.LOCAL_ADDRESS}/metadata/after_customization.png`
          : `${process.env.SERVER_ADDRESS}/api/metadata/after_customization.png`
      }`,
      external_url: `${process.env.WEBSITE_URL}`,
      token_name_status: 'under_consideration',
      stat_points: oldMetadata?.stat_points,
      cosmetic_points: oldMetadata?.cosmetic_points,
      stat_tier: oldMetadata?.stat_tier,
      cosmetic_tier: oldMetadata?.cosmetic_tier,
      hero_tier: oldMetadata?.hero_tier,
      constitution: skills?.constitution,
      strength: skills?.strength,
      dexterity: skills?.dexterity,
      wisdom: skills?.wisdom,
      intelligence: skills?.intelligence,
      charisma: skills?.charisma,
      attributes,
      collection: {
        name: oldMetadata?.collection?.name,
        family: oldMetadata?.collection?.family,
      },
      properties: {
        files: [
          {
            uri: `${
              process.env.NODE_ENV === 'development'
                ? `${process.env.LOCAL_ADDRESS}/metadata/after_customization.png`
                : `${process.env.SERVER_ADDRESS}/api/metadata/after_customization.png`
            }`,
            type: 'image/png',
          },
        ],
        category: oldMetadata?.properties?.category,
        creators: oldMetadata?.properties?.creators,
      },
    };

    const metadataJSON = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `../../../metadata/${tokenAddress}.json`),
      metadataJSON
    );

    try {
      const { stdout, stderr } = await exec(
        `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${
          process.env.NODE_ENV === 'development'
            ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}.json`
            : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}.json`
        }`
      );

      console.log('METABOSS STDOUT:', stdout);
      if (stderr) console.log('METABOSS STDERR:', stderr);
    } catch (error) {
      const metadata = {
        ...oldMetadata,
      };

      const metadataJSON = JSON.stringify(metadata, null, 2);
      fs.writeFileSync(
        path.resolve(__dirname, `../../../metadata/${tokenAddress}.json`),
        metadataJSON
      );

      res.status(404).send({
        message: `Unable to change metadata, Solana blockchain unavailable, please try again later`,
      });
      return;
    }

    await pool.query(
      'INSERT INTO token_names (nft_id, token_name, token_name_status) VALUES($1, $2, $3) RETURNING *',
      [currentNft.id, tokenName, 'under_consideration']
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

    console.log(`NFT ${tokenAddress} has been written to the database`);

    res.status(200).send({ success: 'Success' });
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
};

exports.loadTokenNames = async (req, res) => {
  try {
    const { rows: allTokenNames } = await pool.query(
      'SELECT * FROM token_names WHERE token_name_status = $1',
      ['under_consideration']
    );

    res.json(allTokenNames);
  } catch (error) {
    console.error(error.message);
  }
};

exports.loadTokenName = async (req, res) => {
  try {
    const { tokenNameId } = req.params;
    const tokenNames = await pool.query(
      `SELECT * FROM token_names WHERE id = ${tokenNameId}`
    );
    res.json(tokenNames.rows[0]);
  } catch (error) {
    console.error(error.message);
  }
};

const handleTokenNameStatusChange = async (req, res, tokenNameId, status) => {
  const tokenNameData = await pool.query(
    'SELECT * FROM token_names WHERE id = $1',
    [tokenNameId]
  );

  if (!tokenNameData.rows[0]) {
    res.status(404).send({
      message: `There is no token name with id ${tokenNameId}`,
    });
    return;
  }

  const tokenId = tokenNameData.rows[0].nft_id;
  const tokenName = tokenNameData.rows[0].token_name;

  const tokenData = await pool.query('SELECT * FROM tokens WHERE id = $1', [
    tokenId,
  ]);

  if (!tokenData.rows[0]) {
    res.status(404).send({
      message: `There is no token with id ${tokenId}`,
    });
    return;
  }

  const tokenAddress = tokenData.rows[0].token_address;

  let oldMetadata;
  try {
    // TODO:
    const { data } = await axios.get(
      process.env.NODE_ENV === 'development'
        ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}.json`
        : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}.json`
    );
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

  const metadata = {
    ...oldMetadata,
    ...(status === 'approved'
      ? { name: tokenName, token_name_status: 'approved' }
      : status === 'rejected'
      ? { token_name_status: 'rejected' }
      : {}),
  };

  const metadataJSON = JSON.stringify(metadata, null, 2);
  fs.writeFileSync(
    path.resolve(__dirname, `../../../metadata/${tokenAddress}.json`),
    metadataJSON
  );

  try {
    const { stdout, stderr } = await exec(
      `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${
        process.env.NODE_ENV === 'development'
          ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}.json`
          : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}.json`
      }`
    );

    console.log('METABOSS STDOUT:', stdout);
    if (stderr) console.log('METABOSS STDERR:', stderr);
  } catch (error) {
    const metadata = {
      ...oldMetadata,
    };

    const metadataJSON = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `../../../metadata/${tokenAddress}.json`),
      metadataJSON
    );

    res.status(404).send({
      message: `Unable to change metadata, Solana blockchain unavailable, please try again later`,
    });
    return;
  }

  return tokenName;
};

exports.approveTokenName = async (req, res) => {
  try {
    const { tokenNameId } = req.body;

    const tokenName = await handleTokenNameStatusChange(
      req,
      res,
      tokenNameId,
      'approved'
    );

    if (!tokenName || res.statusCode === 404) return;

    await pool.query(
      'UPDATE token_names SET token_name_status = $1 WHERE id = $2',
      ['approved', tokenNameId]
    );
    res.status(200).send({
      message: `Token name ${tokenName} successfully approved`,
    });
  } catch (error) {
    console.error(error.message);
  }
};

exports.rejectTokenName = async (req, res) => {
  try {
    const { tokenNameId } = req.body;

    const tokenName = await handleTokenNameStatusChange(
      req,
      res,
      tokenNameId,
      'rejected'
    );

    if (!tokenName || res.statusCode === 404) return;

    await pool.query('DELETE FROM token_names WHERE id = $1', [tokenNameId]);
    res.status(200).send({
      message: `Token name ${tokenName} successfully rejected`,
    });
  } catch (error) {
    console.error(error.message);
  }
};
