const fs = require('fs');
const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);
const pool = require('../config/db.config');
const { randomInteger } = require('../utils/randomInteger');

const keypair = path.resolve(__dirname, `../config/keypair.json`);

// NFT RESET
// exports.revealNft = async (req, res) => {
//   try {
//     const { tokenAddress } = req.body;
//     console.log(`Start revealing NFT ${tokenAddress}`);

//     const metadata = {
//       name: 'Woodland Respite #1',
//       symbol: 'WR',
//       description: 'Description for NFT',
//       seller_fee_basis_points: 500,
//       image: `${process.env.SERVER_ADDRESS}/metadata/woodland_respite.png`,
//       external_url: `${process.env.WEBSITE_URL}`,
//       collection: {
//         name: 'Woodland Respite',
//         family: 'CryptoQuest',
//       },
//       properties: {
//         files: [
//           {
//             uri: `${process.env.SERVER_ADDRESS}/metadata/woodland_respite.png`,
//             type: 'image/png',
//           },
//         ],
//         category: 'image',
//         creators: [
//           {
//             address: `${process.env.UPDATE_AUTHORITY}`,
//             share: 100,
//           },
//         ],
//       },
//     };

//     const metadataJSON = JSON.stringify(metadata, null, 2);
//     fs.writeFileSync(
//       path.resolve(__dirname, `../../metadata/woodland_respite.json`),
//       metadataJSON
//     );

//     await exec(
//       `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${process.env.SERVER_ADDRESS}/metadata/woodland_respite.json`
//     );

//     console.log(`NFT ${tokenAddress} revealed`);

//     res.status(200).send({ success: 'Success' });
//   } catch (error) {
//     res.status(404).send({ message: error.message });
//   }
// };

// Reveal Nft
exports.revealNft = async (req, res) => {
  try {
    const { tokenAddress, collection } = req.body;

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

    await pool.query(
      'INSERT INTO tokens (token_address, collection, stat_points, rarity_points) VALUES($1, $2, $3, $4) RETURNING *',
      [tokenAddress, collection, statPoints, rarityPoints]
    );

    console.log(`NFT ${tokenAddress} has been written to the database`);
    console.log(`Start changing metadata for NFT ${tokenAddress}`);

    const metadata = {
      name: `${tokenAddress.slice(0, 7)}...`, // TODO:
      symbol: 'WR', // TODO:
      description: 'Description for NFT', // TODO:
      seller_fee_basis_points: 500, // TODO:
      image: 'https://upload.wikimedia.org/wikipedia/commons/2/24/NFT_Icon.png', // TODO:
      external_url: `${process.env.WEBSITE_URL}`,
      stat_points: statPoints,
      rarity_points: rarityPoints,
      collection: {
        // TODO:
        name: 'Woodland Respite',
        family: 'CryptoQuest',
      },
      properties: {
        // TODO:
        files: [
          {
            uri: 'https://upload.wikimedia.org/wikipedia/commons/2/24/NFT_Icon.png',
            type: 'image/png',
          },
        ],
        category: 'image',
        creators: [
          {
            address: `${process.env.UPDATE_AUTHORITY}`,
            share: 100,
          },
        ],
      },
    };

    const metadataJSON = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `../../metadata/${tokenAddress}.json`),
      metadataJSON
    );

    const { stdout, stderr } = await exec(
      `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${process.env.SERVER_ADDRESS}/metadata/${tokenAddress}.json`
    );
    console.log('METABOSS:', stdout);

    res.status(200).send({ tokenAddress, statPoints, rarityPoints }); // TODO:
  } catch (error) {
    console.log(error.message);
    res.status(404).send(error.message);
  }
};

// Customize NFT
exports.customizeNft = async (req, res) => {
  try {
    const { tokenAddress, tokenName, cosmeticTraits, skills } = req.body;

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
      'SELECT EXISTS(SELECT * FROM characters WHERE token_id = $1)',
      [currentNft.id]
    );

    const isTokenAddressExist = isTokenAddressExistQuery.rows[0].exists;

    if (isTokenAddressExist) {
      throw new Error(`NFT ${tokenAddress.slice(0, 8)}... already customized`);
    }

    console.log(`Start customizing NFT ${tokenAddress}`);

    await pool.query(
      'INSERT INTO characters (token_id, constitution, strength, dexterity, wisdom, intelligence, charisma, token_name, race, sex, face_style, eye_detail, eyes, facial_hair, glasses, hair_style, hair_color, necklace, earring, nose_piercing, scar, tattoo, background) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING *',
      [
        currentNft.id,
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

    const metadata = {
      name: 'Woodland Respite #1',
      symbol: 'WR',
      description: 'Description for NFT',
      seller_fee_basis_points: 500,
      image: `${process.env.SERVER_ADDRESS}/metadata/after_customization.png`,
      external_url: `${process.env.WEBSITE_URL}`,
      stat_points: currentNft.stat_points,
      rarity_points: currentNft.rarity_points,
      constitution: skills.constitution,
      strength: skills.strength,
      dexterity: skills.dexterity,
      wisdom: skills.wisdom,
      intelligence: skills.intelligence,
      charisma: skills.charisma,
      attributes: [
        {
          trait_type: 'Background',
          value: 'Black',
        },
        {
          trait_type: 'Race',
          value: 'Elf',
        },
        {
          trait_type: 'Sex',
          value: 'Female',
        },
        {
          trait_type: 'Face Style',
          value: 'High Elf',
        },
      ],
      collection: {
        name: 'Woodland Respite',
        family: 'CryptoQuest',
      },
      properties: {
        files: [
          {
            uri: `${process.env.SERVER_ADDRESS}/metadata/after_customization.png`,
            type: 'image/png',
          },
        ],
        category: 'image',
        creators: [
          {
            address: `${process.env.UPDATE_AUTHORITY}`,
            share: 100,
          },
        ],
      },
    };

    const metadataJSON = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `../../metadata/${tokenAddress}.json`),
      metadataJSON
    );

    const { stdout, stderr } = await exec(
      `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${process.env.SERVER_ADDRESS}/metadata/${tokenAddress}.json`
    );
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);

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
