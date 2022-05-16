const fs = require('fs');
const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);

const pool = require('../config/db.config');
const {
  fetchOldMetadata,
  throwErrorNoMetadata,
  fetchTokenMetadataByTokenAddress,
} = require('../utils/solana');
const { tokenNameStatuses } = require('../variables/tokenName.variables');

const keypair = path.resolve(__dirname, `../config/keypair.json`);

exports.checkIsTokenNameUnique = async (req, res) => {
  try {
    const { tokenName } = req.body;
    const tokenNameLower = tokenName.trim().toLowerCase();

    const rejectedTokenNames = await pool.query(
      'SELECT * FROM token_names WHERE token_name_status = $1',
      [tokenNameStatuses.rejected]
    );
    const rejectedTokenNamesLower = rejectedTokenNames.rows.map((item) =>
      item.token_name.toLowerCase()
    );
    const isTokenNameRejected =
      rejectedTokenNamesLower.includes(tokenNameLower);

    const tokenNames = await pool.query('SELECT * FROM token_names');
    const tokenNamesLower = tokenNames.rows.map((item) =>
      item.token_name.toLowerCase()
    );
    const isTokenNameExist = tokenNamesLower.includes(tokenNameLower);

    res.status(200).send({ isTokenNameExist, isTokenNameRejected });
  } catch (error) {
    console.log(error.message);
    res.status(404).send(error.message);
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

    res.json(allTokenNamesData);
  } catch (error) {
    console.error(error.message);
  }
};

const handleTokenNameStatusChange = async (req, res, tokenNameId, status) => {
  const tokenNameData = await pool.query(
    'SELECT * FROM token_names WHERE id = $1',
    [tokenNameId]
  );

  if (!tokenNameData.rows[0]) {
    res.status(404).send({
      message: `There is no token name with id ${tokenNameId}`,
    });
    return;
  }

  const tokenId = tokenNameData.rows[0].nft_id;
  const tokenName = tokenNameData.rows[0].token_name;

  const tokenData = await pool.query('SELECT * FROM tokens WHERE id = $1', [
    tokenId,
  ]);

  if (!tokenData.rows[0]) {
    res.status(404).send({
      message: `There is no token with id ${tokenId}`,
    });
    return;
  }

  const tokenAddress = tokenData?.rows?.[0]?.token_address;

  const tokenMetadata = await fetchTokenMetadataByTokenAddress(tokenAddress);
  const metadataUrl = tokenMetadata?.data?.data?.uri;

  const oldMetadata = await fetchOldMetadata(tokenAddress, metadataUrl);
  !oldMetadata && throwErrorNoMetadata(tokenAddress);

  try {
    const { stdout, stderr } = await exec(
      `metaboss update uri -a ${tokenAddress} -k ${keypair} -u ${
        process.env.NODE_ENV === 'development'
          ? `${process.env.LOCAL_ADDRESS}/metadata/${tokenAddress}.json`
          : `${process.env.SERVER_ADDRESS}/api/metadata/${tokenAddress}.json`
      }`
    );

    console.log('METABOSS STDOUT:', stdout);
    if (stderr) console.log('METABOSS STDERR:', stderr);
  } catch (error) {
    res.status(404).send({
      message: `Unable to change metadata, Solana blockchain unavailable, please try again later`,
    });
    return;
  }

  const metadata = {
    ...oldMetadata,
    ...(status === tokenNameStatuses.approved
      ? { token_name: tokenName }
      : status === tokenNameStatuses.rejected
      ? { token_name: 'NAME PENDING' }
      : {}),
  };

  const metadataJSON = JSON.stringify(metadata, null, 2);
  fs.writeFileSync(
    path.resolve(__dirname, `../../../metadata/${tokenAddress}.json`),
    metadataJSON
  );

  return tokenName;
};

exports.approveTokenName = async (req, res) => {
  try {
    const { tokenNameId } = req.body;

    const tokenName = await handleTokenNameStatusChange(
      req,
      res,
      tokenNameId,
      tokenNameStatuses.approved
    );

    if (!tokenName || res.statusCode === 404) return;

    await pool.query(
      'UPDATE token_names SET token_name_status = $1 WHERE id = $2',
      [tokenNameStatuses.approved, tokenNameId]
    );
    res.status(200).send({
      message: `Token name "${tokenName}" successfully approved`,
    });
  } catch (error) {
    console.error(error.message);
  }
};

exports.rejectTokenName = async (req, res) => {
  try {
    const { tokenNameId } = req.body;

    const tokenName = await handleTokenNameStatusChange(
      req,
      res,
      tokenNameId,
      tokenNameStatuses.rejected
    );

    if (!tokenName || res.statusCode === 404) return;

    await pool.query(
      'UPDATE token_names SET token_name_status = $1 WHERE id = $2',
      [tokenNameStatuses.rejected, tokenNameId]
    );
    res.status(200).send({
      message: `Token name "${tokenName}" successfully rejected`,
    });
  } catch (error) {
    console.error(error.message);
  }
};

exports.editTokenName = async (req, res) => {
  try {
    const { tokenName, tokenNameId } = req.body;

    await pool.query('UPDATE token_names SET token_name = $1 WHERE id = $2', [
      tokenName,
      tokenNameId,
    ]);

    await handleTokenNameStatusChange(
      req,
      res,
      tokenNameId,
      tokenNameStatuses.approved
    );

    await pool.query(
      'UPDATE token_names SET token_name_status = $1 WHERE id = $2',
      [tokenNameStatuses.approved, tokenNameId]
    );

    res.status(200).send({
      message: `Token name "${tokenName}" successfully updated`,
    });
  } catch (error) {
    console.error(error.message);
  }
};

exports.deleteTokenName = async (req, res) => {
  try {
    const { tokenNameId } = req.body;

    const tokenNameData = await pool.query(
      'SELECT * FROM token_names WHERE id = $1',
      [tokenNameId]
    );

    if (!tokenNameData.rows[0]) {
      res.status(404).send({
        message: `There is no token name with id ${tokenNameId}`,
      });
      return;
    }

    const tokenName = tokenNameData.rows[0].token_name;

    await pool.query('DELETE FROM token_names WHERE id = $1', [tokenNameId]);
    res.status(200).send({
      message: `Token name "${tokenName}" successfully deleted`,
    });
  } catch (error) {
    console.error(error.message);
  }
};

exports.renameTokenName = async (req, res) => {
  try {
    const { tokenName, tokenAddress } = req.body;

    const currentNftQuery = await pool.query(
      'SELECT * FROM tokens WHERE token_address = $1',
      [tokenAddress]
    );

    const currentNft = currentNftQuery.rows[0];

    if (!currentNft) {
      throw new Error(
        `NFT ${tokenAddress.slice(0, 8)}... has not been revealed`
      );
    }

    const isTokenAddressExistQuery = await pool.query(
      'SELECT EXISTS(SELECT * FROM characters WHERE nft_id = $1)',
      [currentNft.id]
    );

    const isTokenAddressExist = isTokenAddressExistQuery.rows[0].exists;

    if (!isTokenAddressExist) {
      throw new Error(
        `NFT ${tokenAddress.slice(0, 8)}... has not been customized`
      );
    }

    const tokenNameData = await pool.query(
      'SELECT * FROM token_names WHERE nft_id = $1',
      [currentNft.id]
    );

    const tokenNamesStatuses = tokenNameData.rows.map(
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
        message: `Token name for NFT ${tokenAddress.slice(
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
  }
};

exports.fetchLastTokenName = async (req, res) => {
  try {
    const { tokenAddress } = req.body;

    const currentNftQuery = await pool.query(
      'SELECT * FROM tokens WHERE token_address = $1',
      [tokenAddress]
    );

    const currentNft = currentNftQuery.rows[0];

    if (!currentNft) {
      res.status(200).send({ token_name_status: null });
      return;
    }

    const isTokenAddressExistQuery = await pool.query(
      'SELECT EXISTS(SELECT * FROM characters WHERE nft_id = $1)',
      [currentNft.id]
    );

    const isTokenAddressExist = isTokenAddressExistQuery.rows[0].exists;

    if (!isTokenAddressExist) {
      res.status(200).send({ token_name_status: null });
      return;
    }

    const tokenNameData = await pool.query(
      'SELECT * FROM token_names WHERE nft_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [currentNft.id]
    );

    if (!tokenNameData || tokenNameData.rows.length === 0) {
      res.status(200).send({ token_name_status: null });
      return;
    }

    const tokenNameStatus = tokenNameData.rows[0]?.token_name_status;

    if (!tokenNameStatus) {
      res.status(200).send({ token_name_status: null });
      return;
    }

    res.status(200).send({ token_name_status: tokenNameStatus });
  } catch (error) {
    console.error(error.message);
  }
};
