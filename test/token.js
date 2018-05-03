/* globals artifacts */

import { assert } from "chai";
import { expectEvent, checkErrorRevert, web3GetBalance } from "../helpers/test-helper";

const Token = artifacts.require("Token");
const TokenAuthority = artifacts.require("TokenAuthority");
const DSAuth = artifacts.require("DSAuth");
const Vesting = artifacts.require("Vesting");
const MultiSigWallet = artifacts.require("gnosis/MultiSigWallet.sol");

contract("Token", accounts => {
  const COLONY_ACCOUNT = accounts[0];
  const ACCOUNT_TWO = accounts[1];
  const ACCOUNT_THREE = accounts[2];

  let token;
  let tokenAuthority;
  let dsAuthToken;
  let vesting;
  let colonyMultiSig;

  beforeEach(async () => {
    token = await Token.new("Colony token", "CLNY", 18);
    colonyMultiSig = await MultiSigWallet.new([COLONY_ACCOUNT], 1);
    vesting = await Vesting.new(token.address, colonyMultiSig.address);

    tokenAuthority = await TokenAuthority.new(token.address, vesting.address, COLONY_ACCOUNT);
    dsAuthToken = DSAuth.at(token.address);
    await dsAuthToken.setAuthority(tokenAuthority.address);
  });

  describe("when working with ERC20 functions", () => {
    beforeEach("mint 1500000 tokens", async () => {
      await token.unlock();
      await token.mint(1500000);
    });

    it("should be able to get total supply", async () => {
      const total = await token.totalSupply.call();
      assert.equal(1500000, total.toNumber());
    });

    it("should be able to get token balance", async () => {
      const balance = await token.balanceOf.call(COLONY_ACCOUNT);
      assert.equal(1500000, balance.toNumber());
    });

    it("should be able to get allowance for address", async () => {
      await token.approve(ACCOUNT_TWO, 200000);
      const allowance = await token.allowance.call(COLONY_ACCOUNT, ACCOUNT_TWO);
      assert.equal(200000, allowance.toNumber());
    });

    it("should be able to transfer tokens from own address", async () => {
      const success = await token.transfer.call(ACCOUNT_TWO, 300000);
      assert.equal(true, success);

      await expectEvent(token.transfer(ACCOUNT_TWO, 300000), "Transfer");
      const balanceAccount1 = await token.balanceOf.call(COLONY_ACCOUNT);
      assert.equal(1200000, balanceAccount1.toNumber());
      const balanceAccount2 = await token.balanceOf.call(ACCOUNT_TWO);
      assert.equal(300000, balanceAccount2.toNumber());
    });

    it("should NOT be able to transfer more tokens than they have", async () => {
      await checkErrorRevert(token.transfer(ACCOUNT_TWO, 1500001));
      const balanceAccount2 = await token.balanceOf.call(ACCOUNT_TWO);
      assert.equal(0, balanceAccount2.toNumber());
    });

    it("should be able to transfer pre-approved tokens from address different than own", async () => {
      await token.approve(ACCOUNT_TWO, 300000);
      const success = await token.transferFrom.call(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO });
      assert.equal(true, success);

      await expectEvent(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO }), "Transfer");
      const balanceAccount1 = await token.balanceOf.call(COLONY_ACCOUNT);
      assert.equal(1200000, balanceAccount1.toNumber());
      const balanceAccount2 = await token.balanceOf.call(ACCOUNT_TWO);
      assert.equal(300000, balanceAccount2.toNumber());
      const allowance = await token.allowance.call(COLONY_ACCOUNT, ACCOUNT_TWO);
      assert.equal(0, allowance.toNumber());
    });

    it("should NOT be able to transfer tokens from another address if NOT pre-approved", async () => {
      await checkErrorRevert(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO }));
      const balanceAccount2 = await token.balanceOf.call(ACCOUNT_TWO);
      assert.equal(0, balanceAccount2.toNumber());
    });

    it("should NOT be able to transfer from another address more tokens than pre-approved", async () => {
      await token.approve(ACCOUNT_TWO, 300000);
      await checkErrorRevert(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300001, { from: ACCOUNT_TWO }));

      const balanceAccount2 = await token.balanceOf.call(ACCOUNT_TWO);
      assert.equal(0, balanceAccount2.toNumber());
    });

    it("should NOT be able to transfer from another address more tokens than the source balance", async () => {
      await token.approve(ACCOUNT_TWO, 300000);
      await token.transfer(ACCOUNT_THREE, 1500000);

      await checkErrorRevert(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO }));
      const balanceAccount2 = await token.balanceOf.call(ACCOUNT_TWO);
      assert.equal(0, balanceAccount2.toNumber());
    });

    it("should be able to approve token transfer for other accounts", async () => {
      const success = await token.approve.call(ACCOUNT_TWO, 200000);
      assert.equal(true, success);

      await expectEvent(token.approve(ACCOUNT_TWO, 200000), "Approval");
      const allowance = await token.allowance.call(COLONY_ACCOUNT, ACCOUNT_TWO);
      assert.equal(200000, allowance.toNumber());
    });
  });

  describe("when working with additional functions", () => {
    it("should be able to mint new tokens, when called by the Token owner", async () => {
      await token.mint(1500000, { from: COLONY_ACCOUNT });
      let totalSupply = await token.totalSupply.call();
      assert.equal(1500000, totalSupply.toNumber());

      let balance = await token.balanceOf.call(COLONY_ACCOUNT);
      assert.equal(1500000, balance.toNumber());

      // Mint some more tokens
      await expectEvent(token.mint(1), "Mint");
      totalSupply = await token.totalSupply.call();
      assert.equal(1500001, totalSupply.toNumber());

      balance = await token.balanceOf.call(COLONY_ACCOUNT);
      assert.equal(1500001, balance.toNumber());
    });

    it("should NOT be able to mint new tokens, when called by anyone NOT the Token owner", async () => {
      await checkErrorRevert(token.mint(1500000, { from: ACCOUNT_THREE }));
      const totalSupply = await token.totalSupply.call();
      assert.equal(0, totalSupply.toNumber());
    });
  });

  describe("when working with ether transfers", () => {
    it("should NOT accept eth", async () => {
      await checkErrorRevert(token.send(2));
      const tokenBalance = await web3GetBalance(token.address);
      assert.equal(0, tokenBalance.toNumber());
    });
  });
});
