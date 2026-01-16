const fileSyncJson = require('../filesync.json');
const dist = fileSyncJson['scriptsFolder'];
const src = 'bitburner';
const allowedFiletypes = fileSyncJson['allowedFiletypes'];

module.exports = {
  dist,
  src,
  allowedFiletypes,
};
