const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const { sleep } = require('./sleep');
const {
  nftStages,
  heroTierRecipes,
  heroTierImagesIpfsUrls,
} = require('../variables/nft.variables');

const setImageUrlManifest = (manifestString, imageLink) => {
  const manifest = JSON.parse(manifestString);
  const originalImage = manifest.image;
  manifest.image = imageLink;
  manifest.properties.files.forEach((file) => {
    if (file.uri === originalImage) file.uri = imageLink;
  });

  return manifest;
};

const uploadJson = async (manifestJson, pinataApiKey, pinataSecretApiKey) => {
  const data = {
    pinataMetadata: {
      name: 'Ali',
      keyvalues: {
        tokenAddress: 'AliKey',
      },
    },

    pinataContent: manifestJson,
  };

  const { data: responseData } = await axios.post(
    `https://api.pinata.cloud/pinning/pinJSONToIPFS`,
    data,
    {
      maxBodyLength: 'Infinity',
      headers: {
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretApiKey,
      },
    }
  );
  console.log(responseData.IpfsHash);
  return responseData.IpfsHash;
};

const uploadMedia = async (media, pinataApiKey, pinataSecretApiKey) => {
  const data = new FormData();
  data.append('file', fs.createReadStream(media));

  const metadata = JSON.stringify({
    name: 'testname',
    keyvalues: {
      exampleKey: 'exampleValue',
    },
  });
  data.append('pinataMetadata', metadata);

  const { data: responseData } = await axios.post(
    `https://api.pinata.cloud/pinning/pinFileToIPFS`,
    data,
    {
      maxBodyLength: 'Infinity',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretApiKey,
      },
    }
  );
  console.log(responseData.IpfsHash);
  return responseData.IpfsHash;
};

const pinataUpload = async (
  stage,
  image,
  manifestBuffer,
  pinataApiKey,
  pinataSecretApiKey,
  gateway,
  heroTierImagePath
) => {
  const gatewayUrl = gateway ? gateway : `https://ipfs.io`;

  let mediaUrl;

  if (stage === nftStages.revealed) {
    if (heroTierImagePath === heroTierRecipes.dawnOfManCommon) {
      mediaUrl = heroTierImagesIpfsUrls.dawnOfManCommon;
    } else if (heroTierImagePath === heroTierRecipes.dawnOfManUncommon) {
      mediaUrl = heroTierImagesIpfsUrls.dawnOfManUncommon;
    } else if (heroTierImagePath === heroTierRecipes.dawnOfManRare) {
      mediaUrl = heroTierImagesIpfsUrls.dawnOfManRare;
    } else if (heroTierImagePath === heroTierRecipes.dawnOfManEpic) {
      mediaUrl = heroTierImagesIpfsUrls.dawnOfManEpic;
    } else if (heroTierImagePath === heroTierRecipes.dawnOfManLegendary) {
      mediaUrl = heroTierImagesIpfsUrls.dawnOfManLegendary;
    } else if (heroTierImagePath === heroTierRecipes.dawnOfManMythic) {
      mediaUrl = heroTierImagesIpfsUrls.dawnOfManMythic;
    } else if (heroTierImagePath === heroTierRecipes.woodlandRespiteCommon) {
      mediaUrl = heroTierImagesIpfsUrls.woodlandRespiteCommon;
    } else if (heroTierImagePath === heroTierRecipes.woodlandRespiteUncommon) {
      mediaUrl = heroTierImagesIpfsUrls.woodlandRespiteUncommon;
    } else if (heroTierImagePath === heroTierRecipes.woodlandRespiteRare) {
      mediaUrl = heroTierImagesIpfsUrls.woodlandRespiteRare;
    } else if (heroTierImagePath === heroTierRecipes.woodlandRespiteEpic) {
      mediaUrl = heroTierImagesIpfsUrls.woodlandRespiteEpic;
    } else if (heroTierImagePath === heroTierRecipes.woodlandRespiteLegendary) {
      mediaUrl = heroTierImagesIpfsUrls.woodlandRespiteLegendary;
    } else if (heroTierImagePath === heroTierRecipes.woodlandRespiteMythic) {
      mediaUrl = heroTierImagesIpfsUrls.woodlandRespiteMythic;
    }
  } else {
    const imageCid = await uploadMedia(image, pinataApiKey, pinataSecretApiKey);
    console.log('uploaded image: ', `${gatewayUrl}/ipfs/${imageCid}`);
    await sleep(500);

    mediaUrl = `${gatewayUrl}/ipfs/${imageCid}`;
  }

  const manifestJson = await setImageUrlManifest(
    manifestBuffer.toString('utf8'),
    mediaUrl
  );

  const metadataCid = await uploadJson(
    manifestJson,
    pinataApiKey,
    pinataSecretApiKey
  );

  await sleep(500);

  const link = `${gatewayUrl}/ipfs/${metadataCid}`;
  console.log('uploaded manifest: ', link);

  return [link, mediaUrl];
};

exports.uploadIPFS = async (
  stage, // TODO: use stages
  pinataApiKey,
  pinataSecretApiKey,
  pinataGateway,
  assetName,
  heroTierImagePath
) => {
  const dirname = path.resolve(__dirname, `../../../metadata`); // TODO: fix it

  const manifestPath = path.join(dirname, `${assetName}.json`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath).toString());

  let imagePath;
  if (heroTierImagePath) {
    imagePath = heroTierImagePath;
  } else {
    imagePath = assetName;
  }
  const image = path.join(dirname, `${imagePath}.png`);

  const manifestBuffer = Buffer.from(JSON.stringify(manifest));

  const [metadataUrlIpfs, imageUrlIpfs] = await pinataUpload(
    stage,
    image,
    manifestBuffer,
    pinataApiKey,
    pinataSecretApiKey,
    pinataGateway,
    heroTierImagePath
  );

  return { metadataUrlIpfs, imageUrlIpfs };
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
