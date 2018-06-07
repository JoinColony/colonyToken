const MultiSigWallet = artifacts.require("./gnosis/MultiSigWallet.sol");
const TokenAuthority = artifacts.require("./TokenAuthority.sol");
const Token = artifacts.require("./Token.sol");
const Vesting = artifacts.require("./Vesting.sol");

module.exports = (deployer, accounts) => {
  const TOTAL_SUPPLY = 1000;
  let token, multiSig, tokenAuthority, vesting;

  deployer
    .then(() => Token.deployed())
    .then(instance => {
      token = instance;
      return MultiSigWallet.deployed();
    })
    .then(instance => {
      multiSig = instance;
      return TokenAuthority.deployed()
    })
    .then(instance => {
      tokenAuthority = instance;
      return Vesting.deployed();
    })
    .then(instance => {
      vesting = instance;
      return token.setAuthority(tokenAuthority.address);
    })
    .then(() => token.setOwner(multiSig.address))
    // mint the token
    .then(() => token.contract.mint.getData(TOTAL_SUPPLY.toString()))
    .then(txData => multiSig.submitTransaction(token.address, 0, txData))
    // approve vesting contract for entire supply
    .then(() => token.contract.approve.getData(vesting.address, TOTAL_SUPPLY.toString()))
    .then(txData => multiSig.submitTransaction(token.address, 0, txData));
};
