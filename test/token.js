/* globals artifacts */

import { assert } from "chai";
import { asciiToHex } from "web3-utils";
import { expectEvent, checkErrorRevert, web3GetBalance } from "../helpers/test-helper";

const Token = artifacts.require("Token");
const DSAuth = artifacts.require("DSAuth");

contract("Token", accounts => {
  const COLONY_ACCOUNT = accounts[5];
  const ACCOUNT_TWO = accounts[1];
  const ACCOUNT_THREE = accounts[2];

  let token;
  let dsAuthToken;

  beforeEach(async () => {
    token = await Token.new(asciiToHex("Colony token"), asciiToHex("CLNY"), 18, { from: COLONY_ACCOUNT });
    dsAuthToken = await DSAuth.at(token.address);
  });

  describe("when working with ERC20 functions and token is unlocked", () => {
    beforeEach("mint 1500000 tokens", async () => {
      await token.unlock({ from: COLONY_ACCOUNT });
      await token.mint(COLONY_ACCOUNT, 1500000, { from: COLONY_ACCOUNT });
    });

    it("should be able to get total supply", async () => {
      const total = await token.totalSupply();
      assert.equal(1500000, total.toNumber());
    });

    it("should be able to get token balance", async () => {
      const balance = await token.balanceOf(COLONY_ACCOUNT);
      assert.equal(1500000, balance.toNumber());
    });

    it("should be able to get allowance for address", async () => {
      await token.approve(ACCOUNT_TWO, 200000, { from: COLONY_ACCOUNT });
      const allowance = await token.allowance(COLONY_ACCOUNT, ACCOUNT_TWO);
      assert.equal(200000, allowance.toNumber());
    });

    it("should be able to transfer tokens from own address", async () => {
      const success = await token.transfer.call(ACCOUNT_TWO, 300000, { from: COLONY_ACCOUNT });
      assert.equal(true, success);

      await expectEvent(token.transfer(ACCOUNT_TWO, 300000, { from: COLONY_ACCOUNT }), "Transfer");
      const balanceAccount1 = await token.balanceOf(COLONY_ACCOUNT);
      assert.equal(1200000, balanceAccount1.toNumber());
      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      assert.equal(300000, balanceAccount2.toNumber());
    });

    it("should NOT be able to transfer more tokens than they have", async () => {
      await checkErrorRevert(token.transfer(ACCOUNT_TWO, 1500001, { from: COLONY_ACCOUNT }), "ds-token-insufficient-balance");
      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      assert.equal(0, balanceAccount2.toNumber());
    });

    it("should be able to transfer pre-approved tokens from address different than own", async () => {
      await token.approve(ACCOUNT_TWO, 300000, { from: COLONY_ACCOUNT });
      const success = await token.transferFrom.call(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO });
      assert.equal(true, success);

      await expectEvent(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO }), "Transfer");
      const balanceAccount1 = await token.balanceOf(COLONY_ACCOUNT);
      assert.equal(1200000, balanceAccount1.toNumber());
      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      assert.equal(300000, balanceAccount2.toNumber());
      const allowance = await token.allowance(COLONY_ACCOUNT, ACCOUNT_TWO);
      assert.equal(0, allowance.toNumber());
    });

    it("should NOT be able to transfer tokens from another address if NOT pre-approved", async () => {
      await checkErrorRevert(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO }), "ds-token-insufficient-approval");
      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      assert.equal(0, balanceAccount2.toNumber());
    });

    it("should NOT be able to transfer from another address more tokens than pre-approved", async () => {
      await token.approve(ACCOUNT_TWO, 300000);
      await checkErrorRevert(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300001, { from: ACCOUNT_TWO }), "ds-token-insufficient-approval");

      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      assert.equal(0, balanceAccount2.toNumber());
    });

    it("should NOT be able to transfer from another address more tokens than the source balance", async () => {
      await token.approve(ACCOUNT_TWO, 300000, { from: COLONY_ACCOUNT });
      await token.transfer(ACCOUNT_THREE, 1500000, { from: COLONY_ACCOUNT });

      await checkErrorRevert(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO }), "ds-token-insufficient-balance");
      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      assert.equal(0, balanceAccount2.toNumber());
    });

    it("should be able to approve token transfer for other accounts", async () => {
      const success = await token.approve.call(ACCOUNT_TWO, 200000, { from: COLONY_ACCOUNT });
      assert.equal(true, success);

      await expectEvent(token.approve(ACCOUNT_TWO, 200000, { from: COLONY_ACCOUNT }), "Approval");
      const allowance = await token.allowance(COLONY_ACCOUNT, ACCOUNT_TWO);
      assert.equal(200000, allowance.toNumber());
    });
  });

  describe("when working with ERC20 functions and token is locked", () => {
    beforeEach(async () => {
      await token.mint(COLONY_ACCOUNT, 1500000, { from: COLONY_ACCOUNT });
      await token.transfer(ACCOUNT_TWO, 1500000, { from: COLONY_ACCOUNT });
    });

    it("shouldn't be able to transfer tokens from own address", async () => {
      await checkErrorRevert(token.transfer(ACCOUNT_THREE, 300000, { from: ACCOUNT_TWO }), "colony-token-unauthorised");

      const balanceAccount1 = await token.balanceOf(ACCOUNT_TWO);
      assert.equal(1500000, balanceAccount1.toNumber());
      const balanceAccount2 = await token.balanceOf(ACCOUNT_THREE);
      assert.equal(0, balanceAccount2.toNumber());
    });

    it("shouldn't be able to transfer pre-approved tokens", async () => {
      await token.approve(ACCOUNT_THREE, 300000, { from: ACCOUNT_TWO });
      await checkErrorRevert(token.transferFrom(ACCOUNT_TWO, ACCOUNT_THREE, 300000, { from: ACCOUNT_THREE }), "colony-token-unauthorised");

      const balanceAccount1 = await token.balanceOf(ACCOUNT_TWO);
      assert.equal(1500000, balanceAccount1.toNumber());
      const balanceAccount2 = await token.balanceOf(ACCOUNT_THREE);
      assert.equal(0, balanceAccount2.toNumber());
      const allowance = await token.allowance(ACCOUNT_TWO, ACCOUNT_THREE);
      assert.equal(300000, allowance.toNumber());
    });
  });

  describe("when working with additional functions", () => {
    it("should be able to get the token decimals", async () => {
      const decimals = await token.decimals();
      assert.equal(decimals.toNumber(), 18);
    });

    it("should be able to get the token symbol", async () => {
      const symbol = await token.symbol();
      assert.equal(symbol, asciiToHex("CLNY"));
    });

    it("should be able to get the token name", async () => {
      const name = await token.name();
      assert.equal(name, asciiToHex("Colony token"));
    });

    it("should be able to mint new tokens, when called by the Token owner", async () => {
      await token.mint(COLONY_ACCOUNT, 1500000, { from: COLONY_ACCOUNT });

      let totalSupply = await token.totalSupply();
      assert.equal(1500000, totalSupply.toNumber());

      let balance = await token.balanceOf(COLONY_ACCOUNT);
      assert.equal(1500000, balance.toNumber());

      // Mint some more tokens
      await expectEvent(token.mint(COLONY_ACCOUNT, 1, { from: COLONY_ACCOUNT }), "Mint");
      totalSupply = await token.totalSupply();
      assert.equal(1500001, totalSupply.toNumber());

      balance = await token.balanceOf(COLONY_ACCOUNT);
      assert.equal(1500001, balance.toNumber());
    });

    it("should be able to mint new tokens directly to sender, when called by the Token owner", async () => {
      // How truffle supports function overloads apparently
      await token.methods["mint(uint256)"](1500000, { from: COLONY_ACCOUNT });

      const totalSupply = await token.totalSupply();
      assert.equal(1500000, totalSupply.toNumber());

      const balance = await token.balanceOf(COLONY_ACCOUNT);
      assert.equal(1500000, balance.toNumber());
    });

    it("should emit a Mint event when minting tokens", async () => {
      await expectEvent(token.mint(COLONY_ACCOUNT, 1, { from: COLONY_ACCOUNT }), "Mint");
      await expectEvent(token.methods["mint(uint256)"](1, { from: COLONY_ACCOUNT }), "Mint");
    });

    it("should emit a Transfer event when minting tokens", async () => {
      await expectEvent(token.mint(COLONY_ACCOUNT, 1, { from: COLONY_ACCOUNT }), "Transfer");
      await expectEvent(token.methods["mint(uint256)"](1, { from: COLONY_ACCOUNT }), "Transfer");
    });

    it("should NOT be able to mint new tokens, when called by anyone NOT the Token owner", async () => {
      await checkErrorRevert(token.mint(COLONY_ACCOUNT, 1500000, { from: ACCOUNT_THREE }), "ds-auth-unauthorized");
      const totalSupply = await token.totalSupply();
      assert.equal(0, totalSupply.toNumber());
    });

    it("should be able to burn tokens", async () => {
      await token.mint(COLONY_ACCOUNT, 1500000, { from: COLONY_ACCOUNT });
      await token.burn(500000, { from: COLONY_ACCOUNT });

      const totalSupply = await token.totalSupply();
      assert.equal(1000000, totalSupply.toNumber());

      const balance = await token.balanceOf(COLONY_ACCOUNT);
      assert.equal(1000000, balance.toNumber());
    });

    it("should be able to burn sender tokens", async () => {
      // How truffle supports function overloads apparently
      await token.methods["mint(uint256)"](1500000, { from: COLONY_ACCOUNT });
      await token.methods["burn(uint256)"](500000, { from: COLONY_ACCOUNT });

      const totalSupply = await token.totalSupply();
      assert.equal(1000000, totalSupply.toNumber());

      const balance = await token.balanceOf(COLONY_ACCOUNT);
      assert.equal(1000000, balance.toNumber());
    });

    it("should emit a Burn event when burning tokens", async () => {
      await token.mint(COLONY_ACCOUNT, 1, { from: COLONY_ACCOUNT });
      await expectEvent(token.burn(1, { from: COLONY_ACCOUNT }), "Burn");
    });

    it("should be able to unlock token by owner", async () => {
      // Note: due to an apparent bug, we cannot call a parameterless function with transaction params, e.g. { from: senderAccount }
      // So change the owner to coinbase so we are able to call it without params
      await dsAuthToken.setOwner(accounts[0], { from: COLONY_ACCOUNT });
      await token.unlock();
      await dsAuthToken.setAuthority("0x0000000000000000000000000000000000000000");

      const locked = await token.locked();
      assert.isFalse(locked);

      const tokenAuthorityLocal = await token.authority();
      assert.equal(tokenAuthorityLocal, "0x0000000000000000000000000000000000000000");
    });

    it("shouldn't be able to unlock token by non-owner", async () => {
      await checkErrorRevert(token.unlock({ from: ACCOUNT_THREE }), "ds-auth-unauthorized");
      await checkErrorRevert(dsAuthToken.setAuthority("0x0000000000000000000000000000000000000000", { from: ACCOUNT_THREE }), "ds-auth-unauthorized");

      const locked = await token.locked();
      assert.isTrue(locked);
    });
  });

  describe("when working with ether transfers", () => {
    it("should NOT accept eth", async () => {
      await checkErrorRevert(token.send(2));
      const tokenBalance = await web3GetBalance(token.address);
      assert.equal(0, tokenBalance);
    });
  });
});
