const { renderTokenFromBlender } = require('../utils/nft.utils');

exports.blenderRenderProcess = async (job, done) => {
  try {
    const { tokenId, cosmeticTraits, heroTier, tokenAddress } = job.data;
    const result = await renderTokenFromBlender(
      tokenId,
      cosmeticTraits,
      heroTier,
      tokenAddress
    );
    done(null, result);
  } catch (error) {
    done(new Error(error.message));
  }
};
