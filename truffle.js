require("babel-register");

const HDWalletProvider = require("truffle-hdwallet-provider");

const mnemonic = "";

const API_KEY = "OGfF4xYJ82HoyaJNFkla";

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*" // Match any network id
    },
    // coverage: {
    //   host: "127.0.0.1",
    //   port: 8555,
    //   network_id: "*" // Match any network id
    // },
    // kovan: {
    //   provider() {
    //     return new HDWalletProvider(mnemonic, `https://kovan.infura.io/${API_KEY}`);
    //   },
    //   network_id: "42"
    // },
    ropsten: {
      provider() {
        return new HDWalletProvider(mnemonic, `https://ropsten.infura.io/${API_KEY}`);
      },
      network_id: "3"
    }
  },
  mocha: {
    reporter: "mocha-circleci-reporter",
    reporterOptions: {
      currency: "USD",
      gasPrice: 1,
      onlyCalledMethods: true
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
