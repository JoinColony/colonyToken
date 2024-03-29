/* globals artifacts */

import chai from "chai";
import bnChai from "bn-chai";

import { getFunctionSignature } from "../helpers/test-helper";

const { expect } = chai;
chai.use(bnChai(web3.utils.BN));

const TokenAuthority = artifacts.require("TokenAuthority");
const Token = artifacts.require("Token");
const VestingSimple = artifacts.require("VestingSimple");
const MultiSigWallet = artifacts.require("MultiSigWallet");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("TokenAuthority", () => {
  let tokenAuthority;
  let token;
  let vesting;
  let colonyMultiSig;

  const transferFunctionSig = getFunctionSignature("transfer(address,uint256)");
  const transferFromFunctionSig = getFunctionSignature("transferFrom(address,address,uint256)");
  const mintFunctionSig = getFunctionSignature("mint(address,uint256)");
  const burnFunctionSig = getFunctionSignature("burn(address,uint256)");

  before(async () => {
    token = await Token.deployed();
    colonyMultiSig = await MultiSigWallet.deployed();
    vesting = await VestingSimple.deployed();
    tokenAuthority = await TokenAuthority.deployed();
  });

  describe("when initialised", () => {
    it("sets token address correctly", async () => {
      const tokenAddress = await tokenAuthority.token();
      expect(token.address).to.equal(tokenAddress);
    });

    it("calls to contracts other than token return false", async () => {
      const check = await tokenAuthority.canCall(vesting.address, colonyMultiSig.address, mintFunctionSig);
      expect(check).to.be.false;
    });

    it("calls to burn functionality should always return true", async () => {
      const check = await tokenAuthority.canCall(ZERO_ADDRESS, ZERO_ADDRESS, burnFunctionSig);
      expect(check).to.be.true;
    });

    it("vesting contract can transfer", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, transferFunctionSig);
      expect(check).to.be.true;
    });

    it("vesting contract can transferFrom", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, transferFromFunctionSig);
      expect(check).to.be.true;
    });

    it("vesting contract cannot mint", async () => {
      const check = await tokenAuthority.canCall(vesting.address, token.address, mintFunctionSig);
      expect(check).to.be.false;
    });
  });
});
