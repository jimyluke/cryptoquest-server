const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const fs = require('fs');
const { Connection } = require('@solana/web3.js');
const { fetchOldMetadata } = require('./utils/solana');
const path = require('path');
const { getParsedNftAccountsByUpdateAuthority } = require('@nfteyez/sol-rayz');
const { camelCase } = require('lodash');
const retry = require('async-retry');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/metadata', express.static('../../metadata'));

require('./routes/auth.routes')(app);
require('./routes/nft.routes')(app);
require('./routes/tokenName.routes')(app);
require('./routes/bullBoard.routes')(app);
require('./routes/admin.routes')(app);

async function generateNftsMetadata() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const connection = new Connection(process.env.MAINNET_CLUSTER_URL);

    console.log('Start parsing nft accounts');
    const parsedNfts = await retry(
      async () => {
        return await getParsedNftAccountsByUpdateAuthority({
          updateAuthority: process.env.UPDATE_AUTHORITY_PRODUCTION,
          connection,
        });
      },
      {
        retries: 5,
      }
    );

    console.log('Start filtering nft accounts');
    const filteredNfts = parsedNfts.filter(
      (nft) =>
        nft.mint.toBase58() !== 'BHMurHBSfVJuvMCSvYBTb3GmWGRX1S18Ui8XZf7fGc9n'
    );

    console.log('Start fetching metadata');
    const nftsWithMetadataPrevious = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, `../allNftsWithMetadata.json`))
    );

    // eslint-disable-next-line no-undef
    const nftsWithMetadata = await Promise.all(
      filteredNfts.map(async (nft) => {
        const mint = nft.mint.toBase58();
        const name = nft.data.name.replaceAll('\u0000', '');
        const symbol = nft.data.symbol.replaceAll('\u0000', '');
        const uri = nft.data.uri.replaceAll('\u0000', '');

        const nftPrevious = nftsWithMetadataPrevious.find(
          (nftPrevious) => nftPrevious.mint === mint
        );

        let oldMetadata;
        if (nftPrevious && nftPrevious?.data?.uri === uri) {
          oldMetadata = nftPrevious?.data?.customMetaData;
        } else {
          oldMetadata = await fetchOldMetadata(mint, uri);
          const attributes = oldMetadata?.attributes.reduce(
            (obj, item) =>
              Object.assign(obj, { [camelCase(item.trait_type)]: item.value }),
            {}
          );

          oldMetadata = { ...oldMetadata, attributes };
        }

        return {
          ...nft,
          data: {
            ...nft.data,
            name,
            symbol,
            uri,
            customMetaData: oldMetadata,
          },
        };
      })
    );

    console.log('FINISHED UPDATING NFTS');

    const metadataJSON = JSON.stringify(nftsWithMetadata, null, 2);
    fs.writeFileSync(
      path.resolve(__dirname, `../allNftsWithMetadata.json`),
      metadataJSON
    );
  }
}
generateNftsMetadata();

app.listen(port, (error) => {
  if (error) throw error;
  console.log('Server running on port ' + port);
});
