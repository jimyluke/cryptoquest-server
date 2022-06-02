const Queue = require('bull');
const {
  metabossUpdateProcess,
} = require('../processes/metabossUpdate.process');

exports.metabossUpdateQueue = new Queue('metabossUpdate', {
  redis: process.env.REDIS_URL,
});

this.metabossUpdateQueue.process(metabossUpdateProcess);

exports.addMetabossUpdate = async (data) => {
  return await this.metabossUpdateQueue.add(data, {
    attempts: 5,
  });
};
