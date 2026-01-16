const fs = require('node:fs');
const { dist } = require('./config');

// ensure dist exists
if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist);
}
