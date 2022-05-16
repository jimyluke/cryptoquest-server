const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

const { sleep } = require('./sleep');

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
  await sleep(500);

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
  await sleep(500);

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
//     const pinList = await this.fetchPinListPinata(pinataApiKey, pinataSecretApiKey, {
//       selectedPinStatus: 'pinned',
//       pageLimit: 1000,
//     });
//     await sleep(1000);

//     for (var i = 0; i < pinList.rows.length; i++) {
//       await this.removePinFromPinata(
//         process.env.PINATA_API_KEY,
//         process.env.PINATA_API_SECRET_KEY,
//         pinList.rows[i]?.ipfs_pin_hash
//       );
//       console.log(i);
//       await sleep(1000);
//     }
//   } catch (error) {
//     console.error(error);
//   }
// };
