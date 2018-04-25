require("babel-register");

const HDWalletProvider = require("truffle-hdwallet-provider");

const mnemonic = "";

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*" // Match any network id
    },
    coverage: {
      host: "127.0.0.1",
      port: 8555,
      network_id: "*" // Match any network id
    },
    kovan: {
      provider() {
        return new HDWalletProvider(mnemonic, "https://kovan.infura.io/OGfF4xYJ82HoyaJNFkla");
      },
      network_id: "42"
    }
  },
  mocha: {
    reporter: "mocha-circleci-reporter"
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
