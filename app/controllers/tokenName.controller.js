const fs = require('fs');
const path = require('path');

const pool = require('../config/db.config');
const {
  fetchOldMetadata,
  throwErrorNoMetadata,
  fetchTokenMetadataByTokenAddress,
  updateMetadataUrlSolana,
} = require('../utils/solana');
const { tokenNameStatuses } = require('../variables/tokenName.variables');
const { uploadIpfsType, nftStages } = require('../variables/nft.variables');
const { addUploadIpfs } = require('../queues/uploadIpfs.queue');
const {
  throwErrorTokenHasNotBeenCustomized,
  selectTokenByAddress,
  checkIsTokenAlreadyRevealed,
  throwErrorTokenHasNotBeenRevealed,
  checkIsTokenAlreadyCustomized,
} = require('../utils/nft.utils');
const { getPinataCredentials } = require('../utils/pinata');
const keypair = path.resolve(__dirname, `../../../keypair.json`);

const metadataFolderPath = '../../../metadata/';

const { pinataApiKey, pinataSecretApiKey, pinataGateway } =
  getPinataCredentials();

exports.checkIsTokenNameUnique = async (tokenName) => {
  const tokenNameLower = tokenName.trim().toLowerCase();

  const rejectedTokenNames = await pool.query(
    'SELECT * FROM token_names WHERE token_name_status = $1',
    [tokenNameStatuses.rejected]
  );
  const rejectedTokenNamesLower = rejectedTokenNames.rows.map((item) =>
    item.token_name.toLowerCase()
  );
  const isTokenNameRejected = rejectedTokenNamesLower.includes(tokenNameLower);

  const tokenNames = await pool.query('SELECT * FROM token_names');
  const tokenNamesLower = tokenNames.rows.map((item) =>
    item.token_name.toLowerCase()
  );
  const isTokenNameExist = tokenNamesLower.includes(tokenNameLower);

  return { isTokenNameExist, isTokenNameRejected };
};

exports.checkIsTokenNameUniqueController = async (req, res) => {
  try {
    const { tokenName } = req.body;

    const isTokenNameExistResult = await this.checkIsTokenNameUnique(tokenName);

    res.status(200).send(isTokenNameExistResult);
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

exports.loadTokenNames = async (req, res) => {
  try {
    const { rows: allTokenNames } = await pool.query(
      'SELECT * FROM token_names'
    );

    // eslint-disable-next-line no-undef
    const allTokenNamesData = await Promise.all(
      allTokenNames.map(async (tokenName) => {
        const nftData = await pool.query('SELECT * FROM tokens WHERE id = $1', [
          tokenName?.nft_id,
        ]);

        const { token_address, mint_name } = nftData.rows[0];

        return { ...tokenName, token_address, mint_name };
      })
    );

    res.status(200).send(allTokenNamesData);
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

const handleTokenNameStatusChange = async (
  tokenNameId,
  status,
  editedTokenName
) => {
  const tokenNameDataQuery = await pool.query(
    'SELECT * FROM token_names WHERE id = $1',
    [tokenNameId]
  );

  const tokenNameData = tokenNameDataQuery?.rows?.[0];

  if (!tokenNameData) {
    throw new Error(`There is no token name with id ${tokenNameId}`);
  }

  const tokenId = tokenNameData?.nft_id;
  const tokenNameFromDB = tokenNameData?.token_name;

  const tokenName = editedTokenName || tokenNameFromDB;

  const tokenDataQuery = await pool.query(
    'SELECT * FROM tokens WHERE id = $1',
    [tokenId]
  );

  const tokenData = tokenDataQuery?.rows?.[0];

  if (!tokenData) {
    throw new Error(`There is no token with id ${tokenId}`);
  }

  const tokenAddress = tokenData?.token_address;

  const tokenMetadata = await fetchTokenMetadataByTokenAddress(tokenAddress);
  const metadataUrl = tokenMetadata?.data?.data?.uri;

  const oldMetadata = await fetchOldMetadata(tokenAddress, metadataUrl);
  !oldMetadata && throwErrorNoMetadata(tokenAddress);

  const metadata = {
    ...oldMetadata,
    ...(status === tokenNameStatuses.approved
      ? { token_name: tokenName }
      : status === tokenNameStatuses.rejected
      ? { token_name: 'NAME PENDING' }
      : {}),
  };

  const uploadIpfs = await addUploadIpfs({
    type: uploadIpfsType.json,
    pinataApiKey,
    pinataSecretApiKey,
    pinataGateway,
    data: metadata,
    tokenAddress,
    stage: nftStages.renamed,
  });
  const uploadIpfsResult = await uploadIpfs.finished();
  console.log(uploadIpfsResult);
  const { metadataIpfsUrl, metadataIpfsHash } = uploadIpfsResult;

  const metadataJSON = JSON.stringify(metadata, null, 2);
  fs.writeFileSync(
    path.resolve(__dirname, `${metadataFolderPath}${metadataIpfsHash}.json`),
    metadataJSON
  );

  await updateMetadataUrlSolana(tokenAddress, keypair, metadataIpfsUrl);

  await pool.query(
    'INSERT INTO metadata (nft_id, stage, metadata_url, image_url) VALUES($1, $2, $3, $4) RETURNING *',
    [tokenId, nftStages.renamed, metadataIpfsUrl, oldMetadata?.image]
  );

  return tokenName;
};

exports.approveTokenName = async (req, res) => {
  try {
    const { tokenNameId } = req.body;

    const tokenName = await handleTokenNameStatusChange(
      tokenNameId,
      tokenNameStatuses.approved
    );

    await pool.query(
      'UPDATE token_names SET token_name_status = $1 WHERE id = $2',
      [tokenNameStatuses.approved, tokenNameId]
    );
    res.status(200).send({
      message: `Token name "${tokenName}" successfully approved`,
    });
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

exports.rejectTokenName = async (req, res) => {
  try {
    const { tokenNameId } = req.body;

    const tokenName = await handleTokenNameStatusChange(
      tokenNameId,
      tokenNameStatuses.rejected
    );

    await pool.query(
      'UPDATE token_names SET token_name_status = $1 WHERE id = $2',
      [tokenNameStatuses.rejected, tokenNameId]
    );
    res.status(200).send({
      message: `Token name "${tokenName}" successfully rejected`,
    });
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

exports.editTokenName = async (req, res) => {
  try {
    const { tokenName: editedTokenName, tokenNameId } = req.body;

    const tokenName = await handleTokenNameStatusChange(
      tokenNameId,
      tokenNameStatuses.approved,
      editedTokenName
    );

    await pool.query(
      'UPDATE token_names SET token_name = $1, token_name_status = $2 WHERE id = $3',
      [editedTokenName, tokenNameStatuses.approved, tokenNameId]
    );

    res.status(200).send({
      message: `Token name "${tokenName}" successfully updated`,
    });
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

exports.deleteTokenName = async (req, res) => {
  try {
    const { tokenNameId } = req.body;

    const tokenNameDataQuery = await pool.query(
      'SELECT * FROM token_names WHERE id = $1',
      [tokenNameId]
    );

    const tokenNameData = tokenNameDataQuery?.rows?.[0];

    if (!tokenNameData) {
      throw new Error(`There is no token name with id ${tokenNameId}`);
    }

    const tokenName = tokenNameData?.token_name;

    await pool.query('DELETE FROM token_names WHERE id = $1', [tokenNameId]);

    res.status(200).send({
      message: `Token name "${tokenName}" successfully deleted`,
    });
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};

exports.renameTokenName = async (req, res) => {
  try {
    const { tokenName, tokenAddress } = req.body;

    const currentNft = await selectTokenByAddress(tokenAddress);
    const isTokenAlreadyRevealed = await checkIsTokenAlreadyRevealed(
      tokenAddress
    );
    if (!isTokenAlreadyRevealed) {
      throwErrorTokenHasNotBeenRevealed(tokenAddress);
    }

    const isTokenAlreadyCustomized = await checkIsTokenAlreadyCustomized(
      currentNft.id
    );
    if (!isTokenAlreadyCustomized) {
      throwErrorTokenHasNotBeenCustomized(tokenAddress);
    }

    const tokenNameDataQuery = await pool.query(
      'SELECT * FROM token_names WHERE nft_id = $1',
      [currentNft.id]
    );

    const tokenNameData = tokenNameDataQuery?.rows;

    if (!tokenNameData || tokenNameData.length === 0) {
      throw new Error(
        `There is no name for token ${tokenAddress.slice(0, 8)}...`
      );
    }

    const tokenNamesStatuses = tokenNameData.map(
      (tokenName) => tokenName?.token_name_status
    );

    const validStatuses = [
      tokenNameStatuses.approved,
      tokenNameStatuses.underConsideration,
    ];

    const isValidTokenNameExists = validStatuses.some((elem) =>
      tokenNamesStatuses.includes(elem)
    );

    if (isValidTokenNameExists) {
      res.status(404).send({
        message: `Token name for token ${tokenAddress.slice(
          0,
          8
        )}... is not possible to change`,
      });
      return;
    }

    await pool.query(
      'INSERT INTO token_names (nft_id, token_name, token_name_status) VALUES($1, $2, $3) RETURNING *',
      [currentNft.id, tokenName, tokenNameStatuses.underConsideration]
    );

    res.status(200).send({
      message: `Character name "${tokenName}" was successfully submitted for verification`,
    });
  } catch (error) {
    console.error(error.message);
    res.status(404).send({
      message: error.message,
    });
  }
};
