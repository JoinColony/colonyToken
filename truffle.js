require("babel-register");

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
      skipDryRun: true
    },
    coverage: {
      host: "127.0.0.1",
      port: 8555,
      network_id: "*", // Match any network id
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
      version: "0.4.23",
      docker: true,
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "byzantium"
      }
    }
  }
};
