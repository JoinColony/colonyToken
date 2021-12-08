const MultiSigWallet = artifacts.require("./MultiSigWallet");
const TokenAuthority = artifacts.require("./TokenAuthority");
const Token = artifacts.require("./Token");
const VestingSimple = artifacts.require("./VestingSimple");
const TokenTransferBinaryRegulator = artifacts.require("./TokenTransferBinaryRegulator");

module.exports = (deployer, network, accounts) => {
  const COLONY_ACCOUNT = accounts[0];
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const YEAR = 60 * 60 * 24 * 365;

  deployer
    .deploy(MultiSigWallet, [COLONY_ACCOUNT], 1)
    .then(() => deployer.deploy(Token, "Colony Token", "CLNY", 18))
    .then(() => deployer.deploy(VestingSimple, Token.address, 0, YEAR))
    .then(() => deployer.deploy(TokenTransferBinaryRegulator, MultiSigWallet.address, Token.address))
    .then(() => deployer.deploy(TokenAuthority, Token.address, ZERO_ADDRESS, [VestingSimple.address, TokenTransferBinaryRegulator.address]));
};
