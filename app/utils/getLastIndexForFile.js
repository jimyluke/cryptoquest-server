const path = require('path');
const fs = require('fs');

exports.getLastIndexForFile = (substring, fileFormat) => {
  const allMetadataFiles = fs.readdirSync(
    path.resolve(__dirname, '../../../metadata'),
    (err) => {
      if (err) {
        return console.log('Unable to scan directory: ' + err);
      }
    }
  );

  const searchWords = [substring, fileFormat];

  const filteredFilesBySubstring = allMetadataFiles.filter((file) =>
    searchWords.every((word) => file.includes(word))
  );

  const mappedFiles = filteredFilesBySubstring
    .map((file) =>
      Number(file.substring(file.indexOf('-') + 1, file.lastIndexOf('.')))
    )
    .filter((file) => !Number.isNaN(file));

  if (mappedFiles.length === 0) {
    return 0;
  }

  const maxNumber = Math.max(...mappedFiles);

  return maxNumber;
};
