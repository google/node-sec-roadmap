const path = require('path');

module.exports = {
    output: {
        path: path.resolve('./dist'),
        filename: 'bundle.js',
    },
    entry: path.resolve('./index.js')
};
