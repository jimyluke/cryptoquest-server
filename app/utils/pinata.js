const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

const { environmentEnum } = require('../variables/global.variables');

exports.getPinataCredentials = () => {
  let pinataApiKey, pinataSecretApiKey, pinataJwt, pinataGateway;

  if (process.env.NODE_ENV === environmentEnum.development) {
    // TODO: change for production
    // pinataApiKey = process.env.PINATA_API_KEY_DEVELOPMENT;
    // pinataSecretApiKey = process.env.PINATA_API_SECRET_KEY_DEVELOPMENT;
    // pinataJwt = process.env.PINATA_JWT_DEVELOPMENT;
    // pinataGateway = process.env.PINATA_GATEWAY_DEVELOPMENT;
    pinataApiKey = process.env.PINATA_API_KEY_PRODUCTION;
    pinataSecretApiKey = process.env.PINATA_API_SECRET_KEY_PRODUCTION;
    pinataJwt = process.env.PINATA_JWT_PRODUCTION;
    pinataGateway = process.env.PINATA_GATEWAY_PRODUCTION;
  } else {
    pinataApiKey = process.env.PINATA_API_KEY_PRODUCTION;
    pinataSecretApiKey = process.env.PINATA_API_SECRET_KEY_PRODUCTION;
    pinataJwt = process.env.PINATA_JWT_PRODUCTION;
    pinataGateway = process.env.PINATA_GATEWAY_PRODUCTION;
  }

  return { pinataApiKey, pinataSecretApiKey, pinataJwt, pinataGateway };
};

exports.extractHashFromIpfsUrl = (ipfsUrl) => {
  return ipfsUrl.split('ipfs/').pop().split('?')[0];
};

exports.uploadJson = async (
  pinataApiKey,
  pinataSecretApiKey,
  gateway,
  metadata,
  tokenAddress,
  stage
) => {
  const gatewayUrl = gateway ? gateway : `https://ipfs.io`;

  const requestBody = {
    pinataMetadata: {
      name: `${tokenAddress}-${stage}`,
      keyvalues: {
        tokenAddress: tokenAddress,
        stage: stage,
      },
    },

    pinataContent: metadata,
  };

  const {
    data: { IpfsHash },
  } = await axios.post(
    `https://api.pinata.cloud/pinning/pinJSONToIPFS`,
    requestBody,
    {
      maxBodyLength: 'Infinity',
      headers: {
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretApiKey,
      },
    }
  );

  return {
    metadataIpfsHash: IpfsHash,
    metadataIpfsUrl: `${gatewayUrl}/ipfs/${IpfsHash}`,
  };
};

exports.uploadImage = async (
  pinataApiKey,
  pinataSecretApiKey,
  gateway,
  image,
  tokenAddress
) => {
  const gatewayUrl = gateway ? gateway : `https://ipfs.io`;

  const formData = new FormData();
  formData.append('file', fs.createReadStream(image));

  const pinataMetadata = JSON.stringify({
    name: tokenAddress,
    keyvalues: {
      tokenAddress: tokenAddress,
    },
  });
  formData.append('pinataMetadata', pinataMetadata);

  const {
    data: { IpfsHash },
  } = await axios.post(
    `https://api.pinata.cloud/pinning/pinFileToIPFS`,
    formData,
    {
      maxBodyLength: 'Infinity',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretApiKey,
      },
    }
  );

  return {
    imageIpfsHash: IpfsHash,
    imageIpfsUrl: `${gatewayUrl}/ipfs/${IpfsHash}`,
  };
};

// Fetches list of all pins from Pinata
// exports.fetchPinListPinata = async (
//   pinataApiKey,
//   pinataSecretApiKey,
//   queryParams
// ) => {
//   try {
//     let queryString = '?';
//     if (queryParams.hashContains) {
//       queryString = queryString + `hashContains=${queryParams.hashContains}&`;
//     }
//     if (queryParams.pinStartDate) {
//       queryString = queryString + `pinStart=${queryParams.pinStartDate}&`;
//     }
//     if (queryParams.pinEndDate) {
//       queryString = queryString + `pinEnd=${queryParams.pinEndDate}&`;
//     }
//     if (queryParams.unpinStartDate) {
//       queryString = queryString + `unpinStart=${queryParams.unpinStartDate}&`;
//     }
//     if (queryParams.unpinEndDate) {
//       queryString = queryString + `unpinEnd=${queryParams.unpinEndDate}&`;
//     }
//     if (queryParams.selectedPinStatus) {
//       queryString = queryString + `status=${queryParams.selectedPinStatus}&`;
//     }
//     if (queryParams.unpinEndDate) {
//       queryString = queryString + `unpinEnd=${queryParams.unpinEndDate}&`;
//     }
//     if (queryParams.unpinEndDate) {
//       queryString = queryString + `unpinEnd=${queryParams.unpinEndDate}&`;
//     }
//     if (queryParams.pageLimit) {
//       queryString = queryString + `pageLimit=${queryParams.pageLimit}&`;
//     }
//     if (queryParams.pageOffset) {
//       queryString = queryString + `pageOffset=${queryParams.pageOffset}&`;
//     }
//     if (queryParams.nameContains) {
//       queryString = queryString + `metadata[name]=${queryParams.nameContains}&`;
//     }
//     if (queryParams.keyvalues) {
//       const stringKeyValues = JSON.stringify(queryParams.keyvalues);
//       queryString = queryString + `metadata[keyvalues]=${stringKeyValues}`;
//     }
//     const url = `https://api.pinata.cloud/data/pinList${queryString}`;

//     console.log(url);

//     const { data } = await axios.get(url, {
//       headers: {
//         pinata_api_key: pinataApiKey,
//         pinata_secret_api_key: pinataSecretApiKey,
//       },
//     });

//     return data;
//   } catch (error) {
//     console.error(error);
//   }
// };

// Remove pin from Pinata by CID
// exports.removePinFromPinata = async (
//   pinataApiKey,
//   pinataSecretApiKey,
//   hashToUnpin
// ) => {
//   try {
//     const url = `https://api.pinata.cloud/pinning/unpin/${hashToUnpin}`;

//     await axios.delete(url, {
//       headers: {
//         pinata_api_key: pinataApiKey,
//         pinata_secret_api_key: pinataSecretApiKey,
//       },
//     });
//   } catch (error) {
//     console.error(error);
//   }
// };

// Unpin all pinned files from Pinata
// exports.unpinAllFromPinata = async (pinataApiKey, pinataSecretApiKey) => {
//   try {
//     const pinList = await this.fetchPinListPinata(
//       pinataApiKey,
//       pinataSecretApiKey,
//       {
//         selectedPinStatus: 'pinned',
//         pageLimit: 1000,
//       }
//     );
//     await sleep(1000);

//     for (var i = 0; i < pinList.rows.length; i++) {
//       await this.removePinFromPinata(
//         pinataApiKey,
//         pinataSecretApiKey,
//         pinList.rows[i]?.ipfs_pin_hash
//       );
//       console.log(i);
//       await sleep(1000);
//     }
//   } catch (error) {
//     console.error(error);
//   }
// };
