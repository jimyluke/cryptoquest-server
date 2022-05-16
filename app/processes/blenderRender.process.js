const { renderTokenFromBlender } = require('../utils/nft.utils');

exports.blenderRenderProcess = async (job, done) => {
  try {
    const { tokenId, cosmeticTraits, heroTier } = job.data;
    const result = await renderTokenFromBlender(
      tokenId,
      cosmeticTraits,
      heroTier
    );
    done(null, result);
  } catch (error) {
    done(new Error(error.message));
  }
};
