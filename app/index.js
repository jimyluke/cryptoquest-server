const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
require('dotenv').config();

const { blenderRenderQueue } = require('./queues/blenderRender.queue');
const { uploadIpfsQueue } = require('./queues/uploadIpfs.queue');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const serverAdapter = new ExpressAdapter();

createBullBoard({
  queues: [
    new BullAdapter(blenderRenderQueue),
    new BullAdapter(uploadIpfsQueue),
  ],
  serverAdapter: serverAdapter,
});

serverAdapter.setBasePath('/admin/queues');

app.use('/admin/queues', serverAdapter.getRouter());

app.use('/metadata', express.static('../../metadata'));

require('./routes/auth.routes')(app);
require('./routes/nft.routes')(app);
require('./routes/tokenName.routes')(app);

app.listen(port, (error) => {
  if (error) throw error;
  console.log('Server running on port ' + port);
});
