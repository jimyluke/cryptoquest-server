const pool = require('../config/db.config');
const { randomInteger } = require('../utils/randomInteger');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const keypair = path.resolve(__dirname, `../config/keypair.json`);

// Reveal NFT RESET
// exports.revealNft = async (req, res) => {
//   try {
//     const { nftAddress } = req.body;
//     console.log(`Start revealing NFT ${nftAddress}`);

//     const metadata = {
//       name: 'Woodland Respite #1',
//       symbol: 'WR',
//       description: 'Description for NFT',
//       seller_fee_basis_points: 500,
//       image: `${process.env.NODE_ENV === 'production' ? process.env.SERVER_ADDRESS : process.env.LOCAL_ADDRESS}/metadata/woodland_respite.png`,
//       external_url: 'https://cryptoquestnft.com/',
//       collection: {
//         name: 'Woodland Respite',
//         family: 'CryptoQuest',
//       },
//       properties: {
//         files: [
//           {
//             uri: `${process.env.NODE_ENV === 'production' ? process.env.SERVER_ADDRESS : process.env.LOCAL_ADDRESS}/metadata/woodland_respite.png`,
//             type: 'image/png',
//           },
//         ],
//         category: 'image',
//         creators: [
//           {
//             address: 'Fg1q7tUXS4St3cSFyT3jCPbvNk1N8MtqsNJBSXGB34WU',
//             share: 100,
//           },
//         ],
//       },
//     };

//     const metadataJSON = JSON.stringify(metadata, null, 2);
//     fs.writeFileSync(
//       path.resolve(__dirname, `../metadata/woodland_respite.json`),
//       metadataJSON
//     );

//     exec(
//       `metaboss update uri -a ${nftAddress} -k ${keypair} -u ${process.env.NODE_ENV === 'production' ? process.env.SERVER_ADDRESS : process.env.LOCAL_ADDRESS}/metadata/woodland_respite.json`,
//       (error, stdout, stderr) => {
//         if (error) {
//           console.log(error);
//         }
//         console.log(stdout);
//       }
//     );

//     res.status(200);
//   } catch (error) {
//     res.status(404).send({ message: error.message });
//   }
// };

// Reveal Nft
exports.revealNft = async (req, res) => {
  try {
    const { nftAddress, collection } = req.body;

    const isNftAddressExistQuery = await pool.query(
      'SELECT EXISTS(SELECT * FROM nfts WHERE nft_address = $1)',
      [nftAddress]
    );
    const isNftAddressExist = isNftAddressExistQuery.rows[0].exists;

    if (isNftAddressExist) {
      throw new Error(`NFT ${nftAddress} already revealed`);
    }

    console.log(`Start revealing NFT ${nftAddress}`);

    const statPoints = randomInteger(72, 120);
    const rarityPoints = randomInteger(20, 645);

    console.log(`Stat points: ${statPoints}`);
    console.log(`Rarity points: ${rarityPoints}`);

    await pool.query(
      'INSERT INTO nfts (nft_address, collection, stat_points, rarity_points) VALUES($1, $2, $3, $4) RETURNING *',
      [nftAddress, collection, statPoints, rarityPoints]
    );

    console.log(`NFT ${nftAddress} has been written to the database`);
    console.log(`Start changing metadata for NFT ${nftAddress}`);

    const metadata = {
      name: 'Woodland Respite #1',
      symbol: 'WR',
      description: 'Description for NFT',
      seller_fee_basis_points: 500,
      image: 'https://upload.wikimedia.org/wikipedia/commons/2/24/NFT_Icon.png',
      external_url: 'https://cryptoquestnft.com/',
      stat_points: statPoints,
      rarity_points: rarityPoints,
      collection: {
        name: 'Woodland Respite',
        family: 'CryptoQuest',
      },
      properties: {
        files: [
          {
            uri: 'https://upload.wikimedia.org/wikipedia/commons/2/24/NFT_Icon.png',
            type: 'image/png',
          },
        ],
        category: 'image',
        creators: [
          {
            address: 'Fg1q7tUXS4St3cSFyT3jCPbvNk1N8MtqsNJBSXGB34WU',
            share: 100,
          },
        ],
      },
    };

    const metadataJSON = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `../metadata/${nftAddress}.json`),
      metadataJSON
    );

    exec(
      `metaboss update uri -a ${nftAddress} -k ${keypair} -u ${
        process.env.NODE_ENV === 'production'
          ? process.env.SERVER_ADDRESS
          : process.env.LOCAL_ADDRESS
      }/metadata/${nftAddress}.json`,
      (error, stdout, stderr) => {
        if (error) {
          console.log(error);
        }
        console.log(stdout);
      }
    );

    res.status(200).send({ success: 'Success' });
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
};

// Customize NFT
exports.customizeNft = async (req, res) => {
  try {
    const { nftAddress, nftName, character } = req.body;

    const currentNftQuery = await pool.query(
      'SELECT * FROM nfts WHERE nft_address = $1',
      [nftAddress]
    );

    const currentNft = currentNftQuery.rows[0];

    if (!currentNft) {
      throw new Error(`NFT ${nftAddress} has not been revealed`);
    }

    const isNftAddressExistQuery = await pool.query(
      'SELECT EXISTS(SELECT * FROM characters WHERE nft_id = $1)',
      [currentNft.id]
    );
    console.log(isNftAddressExistQuery);

    const isNftAddressExist = isNftAddressExistQuery.rows[0].exists;

    if (isNftAddressExist) {
      throw new Error(`NFT ${nftAddress} already revealed`);
    }

    console.log(`Start customizing NFT ${nftAddress}`);

    console.log(currentNft);

    await pool.query(
      'INSERT INTO characters (nft_id, nft_name, race, sex, face_style, eye_detail, eyes, facial_hair, glasses, hair_style, hair_color, necklace, earring, nose_piercing, scar, tattoo, background) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *',
      [
        currentNft.id,
        nftName,
        character.race,
        character.sex,
        character.faceStyle,
        character.eyeDetail,
        character.eyes,
        character.facialHair,
        character.glasses,
        character.hairStyle,
        character.hairColor,
        character.necklace,
        character.earring,
        character.nosePiercing,
        character.scar,
        character.tattoo,
        character.background,
      ]
    );

    console.log(`NFT ${nftAddress} has been written to the database`);
    console.log(`Start changing metadata for NFT ${nftAddress}`);

    const metadata = {
      name: 'Woodland Respite #1',
      symbol: 'WR',
      description: 'Description for NFT',
      seller_fee_basis_points: 500,
      image: `${
        process.env.NODE_ENV === 'production'
          ? process.env.SERVER_ADDRESS
          : process.env.LOCAL_ADDRESS
      }/metadata/after_customization.png`,
      external_url: 'https://cryptoquestnft.com/',
      stat_points: currentNft.stat_points,
      rarity_points: currentNft.rarity_points,
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
            uri: `${
              process.env.NODE_ENV === 'production'
                ? process.env.SERVER_ADDRESS
                : process.env.LOCAL_ADDRESS
            }/metadata/after_customization.png`,
            type: 'image/png',
          },
        ],
        category: 'image',
        creators: [
          {
            address: 'Fg1q7tUXS4St3cSFyT3jCPbvNk1N8MtqsNJBSXGB34WU',
            share: 100,
          },
        ],
      },
    };

    const metadataJSON = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `../metadata/${nftAddress}.json`),
      metadataJSON
    );

    exec(
      `metaboss update uri -a ${nftAddress} -k ${keypair} -u ${
        process.env.NODE_ENV === 'production'
          ? process.env.SERVER_ADDRESS
          : process.env.LOCAL_ADDRESS
      }/metadata/${nftAddress}.json`,
      (error, stdout, stderr) => {
        if (error) {
          console.log(error);
        }
        console.log(stdout);
      }
    );

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
    const { rowCount, rows: allNfts } = await pool.query('SELECT * FROM nfts');
    res.header('Content-Range', `nfts 0-${rowCount}/${rowCount}`);
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
    const nfts = await pool.query(`SELECT * FROM nfts WHERE id = ${nftId}`);
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
      'UPDATE nfts SET token_name = $1, race = $2 WHERE id = $3 RETURNING *',
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
    await pool.query('DELETE FROM nfts WHERE id = $1', [nftId]);
    res.json('Nft was deleted');
  } catch (error) {
    console.error(error.message);
  }
};
