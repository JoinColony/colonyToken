const MultiSigWallet = artifacts.require("./gnosis/MultiSigWallet");
const TokenAuthority = artifacts.require("./TokenAuthority");
const Token = artifacts.require("./Token");
const Vesting = artifacts.require("./Vesting");

module.exports = (deployer) => {
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
    .then(() => token.contract.methods.mint(TOTAL_SUPPLY.toString()).encodeABI())
    .then(txData => multiSig.submitTransaction(token.address, 0, txData))
    // approve vesting contract for entire supply
    .then(() => token.contract.methods.approve(vesting.address, TOTAL_SUPPLY.toString()).encodeABI())
    .then(txData => multiSig.submitTransaction(token.address, 0, txData));
};
