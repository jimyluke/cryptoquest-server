const Queue = require('bull');
const { uploadIpfsProcess } = require('../processes/uploadIpfs.process');

exports.uploadIpfsQueue = new Queue('uploadIpfs', {
  redis: process.env.REDIS_URL,
});

this.uploadIpfsQueue.process(uploadIpfsProcess);

exports.addUploadIpfs = async (data) => {
  return await this.uploadIpfsQueue.add(data, {
    attempts: 5,
  });
};
