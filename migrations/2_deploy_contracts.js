const web3Utils = require("web3-utils");

const MultiSigWallet = artifacts.require("./MultiSigWallet");
const TokenAuthority = artifacts.require("./TokenAuthority");
const Token = artifacts.require("./Token");
const Vesting = artifacts.require("./Vesting");
const TokenTransferBinaryRegulator = artifacts.require("./TokenTransferBinaryRegulator");

module.exports = (deployer, network, accounts) => {
  const COLONY_ACCOUNT = accounts[0];
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  deployer
    .deploy(MultiSigWallet, [COLONY_ACCOUNT], 1)
    .then(() => deployer.deploy(Token, web3Utils.asciiToHex("Colony Token"), web3Utils.asciiToHex("CLNY"), 18))
    .then(() => deployer.deploy(Vesting, Token.address, MultiSigWallet.address))
    .then(() => deployer.deploy(TokenTransferBinaryRegulator, MultiSigWallet.address, Token.address))
    .then(() => deployer.deploy(TokenAuthority, Token.address, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, Vesting.address, [ZERO_ADDRESS], TokenTransferBinaryRegulator.address));
};
