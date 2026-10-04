const path = require("path");

module.exports = {
  entry: "./src/app.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "turnkey-lit.js",
    clean: true
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "ts-loader",
          options: { configFile: path.resolve(__dirname, "tsconfig.build.json") }
        },
        exclude: /node_modules/
      }
    ]
  }
};
