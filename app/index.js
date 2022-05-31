const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { getSolanaConnection } = require('./utils/solana');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { Connection } = require('@solana/web3.js');
const { deprecated } = require('@metaplex-foundation/mpl-token-metadata');

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

const mainnet = async () => {
  const connection = new Connection(process.env.MAINNET_CLUSTER_URL);

  const result = await deprecated.Metadata.findDataByOwner(
    connection,
    '7nHxhSkaGCePXN4KEZ4CUh4HwLAuCZ3yvXM6a91jGeyg'
  );

  console.log(result);
};

mainnet();

app.listen(port, (error) => {
  if (error) throw error;
  console.log('Server running on port ' + port);
});
