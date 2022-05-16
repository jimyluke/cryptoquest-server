const Queue = require('bull');
const { blenderRenderProcess } = require('../processes/blenderRender.process');

exports.blenderRenderQueue = new Queue('blenderRender', {
  redis: process.env.REDIS_URL,
});

this.blenderRenderQueue.process(blenderRenderProcess);

exports.addBlenderRender = async (data) => {
  return await this.blenderRenderQueue.add(data, {
    attempts: 5,
  });
};
