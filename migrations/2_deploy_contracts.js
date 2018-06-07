const MultiSigWallet = artifacts.require("./gnosis/MultiSigWallet.sol");
const TokenAuthority = artifacts.require("./TokenAuthority.sol");
const Token = artifacts.require("./Token.sol");
const Vesting = artifacts.require("./Vesting.sol");

module.exports = (deployer, network, accounts) => {
  const COLONY_ACCOUNT = accounts[0];

  deployer
    .deploy(MultiSigWallet, [COLONY_ACCOUNT], 1)
    .then(() => deployer.deploy(Token, "Colony Token", "CLNY", 18))
    .then(() => deployer.deploy(Vesting, Token.address, MultiSigWallet.address))
    .then(() => deployer.deploy(TokenAuthority, Token.address, Vesting.address));
};
