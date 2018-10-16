/* globals artifacts */

import { assert } from "chai";

const TokenAuthority = artifacts.require("TokenAuthority");
const Token = artifacts.require("Token");
const Vesting = artifacts.require("Vesting");
const MultiSigWallet = artifacts.require("gnosis/MultiSigWallet.sol");

contract("TokenAuthority", () => {
  let tokenAuthority;
  let token;
  let vesting;
  let colonyMultiSig;

  before(async () => {
    token = await Token.deployed();
    colonyMultiSig = await MultiSigWallet.deployed();
    vesting = await Vesting.deployed();
    tokenAuthority = await TokenAuthority.deployed();
  });

  describe("when initialised", () => {
    it("sets token address correctly", async () => {
      const tokenAddress = await tokenAuthority.token();
      assert.equal(token.address, tokenAddress);
    });

    it("calls to contracts other than token return false", async () => {
      const check = await tokenAuthority.canCall(vesting.address, colonyMultiSig.address, "0xa9059cbb");
      assert.isFalse(check);
    });

    it("vesting contract can transfer", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, "0xa9059cbb");
      assert.isTrue(check);
    });

    it("vesting contract can transferFrom", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, "0x23b872dd");
      assert.isTrue(check);
    });

    it("vesting contract cannot mint", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, "0xa0712d68");
      assert.isFalse(check);
    });

    it("vesting contract cannnot mint", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, "0xa0712d68");
      assert.isFalse(check);
    });
  });
});
