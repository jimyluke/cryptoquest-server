const fs = require('fs');
const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);
const pool = require('../config/db.config');
const { randomInteger } = require('../utils/randomInteger');
const axios = require('axios');

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

// Reveal Nft
exports.revealNft = async (req, res) => {
  try {
    const { tokenAddress, metadataUri } = req.body;

    const { data: oldMetadata } = await axios.get(metadataUri);

    if (!oldMetadata) {
      res.status(400).send({
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

    const statPoints = randomInteger(72, 120);
    const rarityPoints = randomInteger(20, 645);

    const calculateHeroTier = () => {
      const totalPoints = statPoints + rarityPoints;
      if (totalPoints > 700) {
        return 'mythic';
      } else if (totalPoints > 600) {
        return 'legendary';
      } else if (totalPoints > 500) {
        return 'epic';
      } else if (totalPoints > 400) {
        return 'rare';
      } else if (totalPoints > 300) {
        return 'uncommon';
      } else {
        return 'common';
      }
    };

    const heroTier = calculateHeroTier();

    await pool.query(
      'INSERT INTO tokens (token_address, collection, stat_points, rarity_points) VALUES($1, $2, $3, $4) RETURNING *',
      [tokenAddress, oldMetadata?.collection?.name, statPoints, rarityPoints]
    );

    console.log(`NFT ${tokenAddress} has been written to the database`);
    console.log(`Start changing metadata for NFT ${tokenAddress}`);

    const metadata = {
      name: oldMetadata?.name,
      symbol: oldMetadata?.symbol,
      description: oldMetadata?.description,
      seller_fee_basis_points: oldMetadata?.seller_fee_basis_points,
      image: `${
        process.env.NODE_ENV === 'development'
          ? `${process.env.LOCAL_ADDRESS}/metadata/woodland-respite-${heroTier}.png`
          : `${process.env.SERVER_ADDRESS}/api/metadata/woodland-respite-${heroTier}.png`
      }`,
      external_url: `${process.env.WEBSITE_URL}`,
      stat_points: statPoints,
      rarity_points: rarityPoints,
      collection: {
        name: oldMetadata?.collection?.name,
        family: oldMetadata?.collection?.family,
      },
      properties: {
        files: [
          {
            uri: `${
              process.env.NODE_ENV === 'development'
                ? `${process.env.LOCAL_ADDRESS}/metadata/woodland-respite-${heroTier}.png`
                : `${process.env.SERVER_ADDRESS}/api/metadata/woodland-respite-${heroTier}.png`
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
      path.resolve(__dirname, `../../metadata/${tokenAddress}.json`),
      metadataJSON
    );

    const { stdout, stderr } = await exec(
      `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${
        process.env.NODE_ENV === 'development'
          ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}.json`
          : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}.json`
      }`
    );
    console.log('METABOSS:', stdout);

    res.status(200).send({ tokenAddress, heroTier, statPoints, rarityPoints }); // TODO:
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

    await pool.query(
      'INSERT INTO characters (nft_id, token_id, constitution, strength, dexterity, wisdom, intelligence, charisma, token_name, race, sex, face_style, eye_detail, eyes, facial_hair, glasses, hair_style, hair_color, necklace, earring, nose_piercing, scar, tattoo, background) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) RETURNING *',
      [
        currentNft.id,
        tokenId,
        skills.constitution,
        skills.strength,
        skills.dexterity,
        skills.wisdom,
        skills.intelligence,
        skills.charisma,
        tokenName,
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

    const attributes = Object.entries(cosmeticTraits)
      // .filter((item) => item[1] !== 'None')
      .map((item) => ({
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
      stat_points: currentNft?.stat_points,
      rarity_points: currentNft?.rarity_points,
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
      path.resolve(__dirname, `../../metadata/${tokenAddress}.json`),
      metadataJSON
    );

    const { stdout, stderr } = await exec(
      `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${
        process.env.NODE_ENV === 'development'
          ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}.json`
          : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}.json`
      }`
    );
    console.log('METABOSS:', stdout);

    res.status(200).send({ success: 'Success' });
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
};

// Load list of customized nfts for Admin UI
exports.loadCustomizedNfts = async (req, res) => {
  try {
    const range = req.query.range
      .slice(1, -1)
      .split(',')
      .map((i) => Number(i));
    let [sortBy, sortOrder] = req.query.sort.slice(1, -1).split(',');
    sortBy = sortBy.slice(1, -1);
    const { rowCount, rows: allNfts } = await pool.query(
      'SELECT * FROM tokens'
    );
    res.header('Content-Range', `tokens 0-${rowCount}/${rowCount}`);
    res.header('Access-Control-Expose-Headers', 'Content-Range');
    allNfts.sort((a, b) =>
      (
        sortOrder.slice(1, -1) === 'ASC'
          ? a[sortBy] < b[sortBy]
          : a[sortBy] > b[sortBy]
      )
        ? -1
        : 1
    );

    const sortedfts = allNfts.slice(range[0], range[1] + 1);
    res.json(sortedfts);
  } catch (error) {
    console.error(error.message);
  }
};

// Load single customized nft for Admin UI
exports.loadCustomizedNft = async (req, res) => {
  try {
    const { nftId } = req.params;
    const nfts = await pool.query(`SELECT * FROM tokens WHERE id = ${nftId}`);
    res.json(nfts.rows[0]);
  } catch (error) {
    console.error(error.message);
  }
};

// Edit customized nft from Admin UI
exports.editCustomizedNft = async (req, res) => {
  try {
    const { nftId } = req.params;
    const { token_name, race } = req.body;
    const nft = await pool.query(
      'UPDATE tokens SET token_name = $1, race = $2 WHERE id = $3 RETURNING *',
      [token_name, race, nftId]
    );
    res.json(nft.rows[0]);
  } catch (error) {
    console.error(error.message);
  }
};

// Delete customized nft from Admin UI
exports.deleteCustomizedNft = async (req, res) => {
  try {
    const { nftId } = req.params;
    await pool.query('DELETE FROM tokens WHERE id = $1', [nftId]);
    res.json('Nft was deleted');
  } catch (error) {
    console.error(error.message);
  }
};
