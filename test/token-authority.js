/* globals artifacts */

import chai from "chai";
import bnChai from "bn-chai";

import { getFunctionSignature } from "../helpers/test-helper";

const { expect } = chai;
chai.use(bnChai(web3.utils.BN));

const TokenAuthority = artifacts.require("TokenAuthority");
const Token = artifacts.require("Token");
const Vesting = artifacts.require("Vesting");
const MultiSigWallet = artifacts.require("MultiSigWallet");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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
      expect(token.address).to.equal(tokenAddress);
    });

    it("calls to contracts other than token return false", async () => {
      const check = await tokenAuthority.canCall(vesting.address, colonyMultiSig.address, "0xa9059cbb");
      expect(check).to.be.false;
    });

    it("calls to burn functionality return true", async () => {
      const burnFunctionSig = getFunctionSignature("burn(address,uint256)");
      const check = await tokenAuthority.canCall(ZERO_ADDRESS, ZERO_ADDRESS, burnFunctionSig);
      expect(check).to.be.true;
    });

    it("vesting contract can transfer", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, "0xa9059cbb");
      expect(check).to.be.true;
    });

    it("vesting contract can transferFrom", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, "0x23b872dd");
      expect(check).to.be.true;
    });

    it("vesting contract cannot mint", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, "0xa0712d68");
      expect(check).to.be.false;
    });

    it("vesting contract cannot mint", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, "0xa0712d68");
      expect(check).to.be.false;
    });
  });
});
