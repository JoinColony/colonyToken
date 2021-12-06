const { execSync } = require("child_process");
const log = console.log;

// Copies pre-built token artifacts to .coverage_artifacts/contracts
function provisionMultisig(config){
  let output;
  const provisionMultisig = "yarn run provision:multisig:contract";

  log('Provisioning ColonyToken contracts...')
  output = execSync(provisionMultisig);
  log(output.toString())
}

module.exports = {
    skipFiles: [
      'Migrations.sol',
    ],
    providerOptions: {
      port: 8555,
      network_id: 1999,
      account_keys_path: "./ganache-accounts.json",
      vmErrorsOnRPCResponse: false,
      total_accounts: 18
    },
    onCompileComplete: provisionMultisig,
    istanbulFolder: "./coverage-contracts"
}

