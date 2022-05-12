const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
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

app.listen(port, (error) => {
  if (error) throw error;
  console.log('Server running on port ' + port);
});
