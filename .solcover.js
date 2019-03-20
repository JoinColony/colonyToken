module.exports = {
    skipFiles: [
      'Migrations.sol'
    ],
    compileCommand: 'yarn run provision:multisig:contract',
    testCommand: '../node_modules/.bin/truffle test --network coverage',
    testrpcOptions: `--port 8555 -i 1999 --acctKeys="./coverageEnv/ganache-accounts.json" --noVMErrorsOnRPCResponse --accounts 12`
};
