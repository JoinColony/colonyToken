/* globals artifacts */

import { assert } from "chai";

const TokenAuthority = artifacts.require("TokenAuthority");
const DSAuth = artifacts.require("DSAuth");
const Token = artifacts.require("Token");
const Vesting = artifacts.require("Vesting");
const MultiSigWallet = artifacts.require("gnosis/MultiSigWallet.sol");

contract("TokenAuthority", accounts => {
  const COLONY_ACCOUNT = accounts[0];

  let tokenAuthority;
  let token;
  let dsAuthToken;
  let vesting;
  let colonyMultiSig;

  before(async () => {
    token = await Token.new("Colony token", "CLNY", 18);
    colonyMultiSig = await MultiSigWallet.new([COLONY_ACCOUNT], 1);
    vesting = await Vesting.new(token.address, colonyMultiSig.address);

    tokenAuthority = await TokenAuthority.new(token.address, vesting.address);
    dsAuthToken = DSAuth.at(token.address);
    await dsAuthToken.setAuthority(tokenAuthority.address);
  });

  describe("when initialised", () => {
    it("sets token address correctly", async () => {
      const tokenAddress = await tokenAuthority.token.call();
      assert.equal(token.address, tokenAddress);
    });

    it("calls to contracts other than token return false", async () => {
      const check = await tokenAuthority.canCall.call(vesting.address, colonyMultiSig.address, "0xa9059cbb");
      assert.isFalse(check);
    });

    it("vesting contract can transfer", async () => {
      const check = await tokenAuthority.canCall.call(vesting.address, token.address, "0xa9059cbb");
      assert.isTrue(check);
    });

    it("vesting contract can transferFrom", async () => {
      const check = await tokenAuthority.canCall.call(vesting.address, token.address, "0x23b872dd");
      assert.isTrue(check);
    });

    it("vesting contract cannot mint", async () => {
      const check = await tokenAuthority.canCall.call(vesting.address, token.address, "0xa0712d68");
      assert.isFalse(check);
    });

    it("vesting contract cannnot mint", async () => {
      const check = await tokenAuthority.canCall.call(vesting.address, token.address, "0xa0712d68");
      assert.isFalse(check);
    });
  });
});
