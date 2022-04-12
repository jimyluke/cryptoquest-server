const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
// const IPFS = require('ipfs-core');
// const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/metadata', express.static('../../metadata'));

// const ipfsFunction = async () => {
//   const image = fs.readFileSync(
//     '../metadata/dawn_of_man.png',
//     function (err, data) {
//       if (err) throw err; // Fail if the file can't be read.
//       return data;
//     }
//   );
//   console.log(image);

//   const metadata = {
//     name: 'Woodland Respite #1',
//     symbol: 'WR',
//     description: 'Description for NFT',
//     seller_fee_basis_points: 500,
//     image: 'https://upload.wikimedia.org/wikipedia/commons/2/24/NFT_Icon.png',
//     external_url: 'https://cryptoquestnft.com/',
//     stat_points: 75,
//     rarity_points: 383,
//     collection: {
//       name: 'Woodland Respite3',
//       family: 'CryptoQuest',
//     },
//     properties: {
//       files: [
//         {
//           uri: 'https://upload.wikimedia.org/wikipedia/commons/2/24/NFT_Icon.png',
//           type: 'image/png',
//         },
//       ],
//       category: 'image',
//       creators: [
//         {
//           address: 'Fg1q7tUXS4St3cSFyT3jCPbvNk1N8MtqsNJBSXGB34WU',
//           share: 100,
//         },
//       ],
//     },
//   };

//   const metadataJSON = JSON.stringify(metadata);

//   const ipfs = await IPFS.create();
//   const { cid } = await ipfs.add(image);
//   console.log('cid', cid);
// };

// ipfsFunction();

require('./routes/auth.routes')(app);
require('./routes/nft.routes')(app);

app.listen(port, (error) => {
  if (error) throw error;
  console.log('Server running on port ' + port);
});
