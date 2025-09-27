const fs = require('fs');
const path = require('path');
// this is the diractory where plants pictures are being saved
const PHOTOS_DIR = path.resolve(__dirname, '../uploads/photos');
// handling photo deletion
const deleteFiles = async (names) => {
  const results = [];

  for (const name of names) {
    if (typeof name !== 'string') {
      results.push({ input: name, error: 'Invalid path' });
      continue;
    }
    const clean = name.startsWith('/static/photos/')
      ? name.slice('/static/photos/'.length)
      : name;

    const filePath = path.join(PHOTOS_DIR, path.basename(clean));

    try {
      fs.unlinkSync(filePath);
      results.push({ path: filePath, status: 'Deleted successfully' });
    } catch (err) {
      if (err.code === 'ENOENT') {
        results.push({ path: filePath, error: 'File not found' });
      } else {
        results.push({ path: filePath, error: 'Failed to delete file', details: err.message });
      }
    }
  }

  return results;
};

module.exports = { deleteFiles };
