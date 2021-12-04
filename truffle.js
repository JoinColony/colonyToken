require("@babel/register");
require("@babel/polyfill");

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
      gasPrice: 0,
      skipDryRun: true
    },
    coverage: {
      host: "127.0.0.1",
      port: 8555,
      network_id: "1999",
      gasPrice: 0x01, // <-- Use this low gas price
      skipDryRun: true
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
  compilers: {
    solc: {
      version: "0.7.3",
      docker: true,
      parser: "solcjs",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "petersburg"
      }
    }
  }
};
