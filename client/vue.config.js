const path = require("path");

module.exports = {
  outputDir: path.resolve(__dirname, "../client-dist"),
  publicPath: process.env.NODE_ENV === "production" ? "/thot-counter/" : "/" // Needed for github page hosted at /thot-counter/
};
