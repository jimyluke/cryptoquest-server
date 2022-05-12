const {
  heroTierImagesIpfsUrls,
  heroTierRecipes,
} = require('../variables/nft.variables');
const pool = require('../config/db.config');

exports.throwErrorTokenAlreadyRevealed = (tokenAddress) => {
  throw new Error(
    `Token ${tokenAddress.slice(0, 8)}... has already been revealed`
  );
};

exports.throwErrorTokenHasNotBeenRevealed = async (tokenAddress) => {
  throw new Error(`Token ${tokenAddress.slice(0, 8)}... has not been revealed`);
};

exports.throwErrorTokenAlreadyCustomized = async (tokenAddress) => {
  throw new Error(`Token ${tokenAddress.slice(0, 8)}... already customized`);
};

exports.checkIsTokenAlreadyRevealed = async (tokenAddress) => {
  const isTokenAlreadyRevealedQuery = await pool.query(
    'SELECT EXISTS(SELECT 1 FROM tokens WHERE token_address = $1)',
    [tokenAddress]
  );

  const isTokenAlreadyRevealed = isTokenAlreadyRevealedQuery?.rows[0]?.exists;
  return isTokenAlreadyRevealed;
};

exports.checkIsTokenAlreadyCustomized = async (tokenId) => {
  const isTokenAlreadyCustomizedQuery = await pool.query(
    'SELECT EXISTS(SELECT * FROM characters WHERE nft_id = $1)',
    [tokenId]
  );

  const isTokenAlreadyCustomized = isTokenAlreadyCustomizedQuery.rows[0].exists;
  return isTokenAlreadyCustomized;
};

exports.getHeroTierImageFromIpfs = (heroTierRecipe) => {
  if (heroTierRecipe === heroTierRecipes.dawnOfManCommon) {
    return heroTierImagesIpfsUrls.dawnOfManCommon;
  } else if (heroTierRecipe === heroTierRecipes.dawnOfManUncommon) {
    return heroTierImagesIpfsUrls.dawnOfManUncommon;
  } else if (heroTierRecipe === heroTierRecipes.dawnOfManRare) {
    return heroTierImagesIpfsUrls.dawnOfManRare;
  } else if (heroTierRecipe === heroTierRecipes.dawnOfManEpic) {
    return heroTierImagesIpfsUrls.dawnOfManEpic;
  } else if (heroTierRecipe === heroTierRecipes.dawnOfManLegendary) {
    return heroTierImagesIpfsUrls.dawnOfManLegendary;
  } else if (heroTierRecipe === heroTierRecipes.dawnOfManMythic) {
    return heroTierImagesIpfsUrls.dawnOfManMythic;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteCommon) {
    return heroTierImagesIpfsUrls.woodlandRespiteCommon;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteUncommon) {
    return heroTierImagesIpfsUrls.woodlandRespiteUncommon;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteRare) {
    return heroTierImagesIpfsUrls.woodlandRespiteRare;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteEpic) {
    return heroTierImagesIpfsUrls.woodlandRespiteEpic;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteLegendary) {
    return heroTierImagesIpfsUrls.woodlandRespiteLegendary;
  } else if (heroTierRecipe === heroTierRecipes.woodlandRespiteMythic) {
    return heroTierImagesIpfsUrls.woodlandRespiteMythic;
  }
};

exports.selectTokenByAddress = async (tokenAddress) => {
  const tokenQuery = await pool.query(
    'SELECT * FROM tokens WHERE token_address = $1',
    [tokenAddress]
  );
  const token = tokenQuery?.rows?.[0];
  return token;
};
