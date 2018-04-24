require("babel-register");

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
