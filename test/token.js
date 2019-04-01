/* globals artifacts */

import chai from "chai";
import bnChai from "bn-chai";

import { expectEvent, checkErrorRevert, web3GetBalance } from "../helpers/test-helper";

const { expect } = chai;
chai.use(bnChai(web3.utils.BN));

const Token = artifacts.require("Token");
const TokenAuthority = artifacts.require("TokenAuthority");
const DSAuth = artifacts.require("DSAuth");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("Token", accounts => {
  const COLONY_ACCOUNT = accounts[5];
  const ACCOUNT_TWO = accounts[1];
  const ACCOUNT_THREE = accounts[2];

  let token;
  let dsAuthToken;

  beforeEach(async () => {
    token = await Token.new("Colony token", "CLNY", 18, { from: COLONY_ACCOUNT });
    dsAuthToken = await DSAuth.at(token.address);

    const tokenAuthority = await TokenAuthority.new(
      token.address,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      [ZERO_ADDRESS],
      ZERO_ADDRESS,
      { from: COLONY_ACCOUNT }
    );
    await token.setAuthority(tokenAuthority.address, { from: COLONY_ACCOUNT });
  });

  describe("when working with ERC20 functions and token is unlocked", () => {
    beforeEach("mint 1500000 tokens", async () => {
      await token.unlock({ from: COLONY_ACCOUNT });
      await token.mint(COLONY_ACCOUNT, 1500000, { from: COLONY_ACCOUNT });
    });

    it("should be able to get total supply", async () => {
      const total = await token.totalSupply();
      expect(total).to.eq.BN(1500000);
    });

    it("should be able to get token balance", async () => {
      const balance = await token.balanceOf(COLONY_ACCOUNT);
      expect(balance).to.eq.BN(1500000);
    });

    it("should be able to get allowance for address", async () => {
      await token.approve(ACCOUNT_TWO, 200000, { from: COLONY_ACCOUNT });
      const allowance = await token.allowance(COLONY_ACCOUNT, ACCOUNT_TWO);
      expect(allowance).to.eq.BN(200000);
    });

    it("should be able to transfer tokens from own address", async () => {
      const success = await token.transfer.call(ACCOUNT_TWO, 300000, { from: COLONY_ACCOUNT });
      expect(success).to.be.true;

      await expectEvent(token.transfer(ACCOUNT_TWO, 300000, { from: COLONY_ACCOUNT }), "Transfer");
      const balanceAccount1 = await token.balanceOf(COLONY_ACCOUNT);
      expect(balanceAccount1).to.eq.BN(1200000);
      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      expect(balanceAccount2).to.eq.BN(300000);
    });

    it("should NOT be able to transfer more tokens than they have", async () => {
      await checkErrorRevert(token.transfer(ACCOUNT_TWO, 1500001, { from: COLONY_ACCOUNT }), "ds-token-insufficient-balance");
      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      expect(balanceAccount2).to.be.zero;
    });

    it("should be able to transfer pre-approved tokens from address different than own", async () => {
      await token.approve(ACCOUNT_TWO, 300000, { from: COLONY_ACCOUNT });
      const success = await token.transferFrom.call(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO });
      expect(success).to.be.true;

      await expectEvent(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO }), "Transfer");
      const balanceAccount1 = await token.balanceOf(COLONY_ACCOUNT);
      expect(balanceAccount1).to.eq.BN(1200000);
      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      expect(balanceAccount2).to.eq.BN(300000);
      const allowance = await token.allowance(COLONY_ACCOUNT, ACCOUNT_TWO);
      expect(allowance).to.be.zero;
    });

    it("should NOT be able to transfer tokens from another address if NOT pre-approved", async () => {
      await checkErrorRevert(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO }), "ds-token-insufficient-approval");
      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      expect(balanceAccount2).to.be.zero;
    });

    it("should NOT be able to transfer from another address more tokens than pre-approved", async () => {
      await token.approve(ACCOUNT_TWO, 300000);
      await checkErrorRevert(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300001, { from: ACCOUNT_TWO }), "ds-token-insufficient-approval");

      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      expect(balanceAccount2).to.be.zero;
    });

    it("should NOT be able to transfer from another address more tokens than the source balance", async () => {
      await token.approve(ACCOUNT_TWO, 300000, { from: COLONY_ACCOUNT });
      await token.transfer(ACCOUNT_THREE, 1500000, { from: COLONY_ACCOUNT });

      await checkErrorRevert(token.transferFrom(COLONY_ACCOUNT, ACCOUNT_TWO, 300000, { from: ACCOUNT_TWO }), "ds-token-insufficient-balance");
      const balanceAccount2 = await token.balanceOf(ACCOUNT_TWO);
      expect(balanceAccount2).to.be.zero;
    });

    it("should be able to approve token transfer for other accounts", async () => {
      const success = await token.approve.call(ACCOUNT_TWO, 200000, { from: COLONY_ACCOUNT });
      expect(success).to.be.true;

      await expectEvent(token.approve(ACCOUNT_TWO, 200000, { from: COLONY_ACCOUNT }), "Approval");
      const allowance = await token.allowance(COLONY_ACCOUNT, ACCOUNT_TWO);
      expect(allowance).to.eq.BN(200000);
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
      expect(balanceAccount1).to.eq.BN(1500000);
      const balanceAccount2 = await token.balanceOf(ACCOUNT_THREE);
      expect(balanceAccount2).to.be.zero;
    });

    it("shouldn't be able to transfer pre-approved tokens", async () => {
      await token.approve(ACCOUNT_THREE, 300000, { from: ACCOUNT_TWO });
      await checkErrorRevert(token.transferFrom(ACCOUNT_TWO, ACCOUNT_THREE, 300000, { from: ACCOUNT_THREE }), "colony-token-unauthorised");

      const balanceAccount1 = await token.balanceOf(ACCOUNT_TWO);
      expect(balanceAccount1).to.eq.BN(1500000);
      const balanceAccount2 = await token.balanceOf(ACCOUNT_THREE);
      expect(balanceAccount2).to.be.zero;
      const allowance = await token.allowance(ACCOUNT_TWO, ACCOUNT_THREE);
      expect(allowance).to.eq.BN(300000);
    });
  });

  describe("when working with additional functions", () => {
    it("should be able to get the token decimals", async () => {
      const decimals = await token.decimals();
      expect(decimals).to.eq.BN(18);
    });

    it("should be able to get the token symbol", async () => {
      const symbol = await token.symbol();
      expect(symbol).to.equal("CLNY");
    });

    it("should be able to get the token name", async () => {
      const name = await token.name();
      expect(name).to.equal("Colony token");
    });

    it("should be able to mint new tokens, when called by the Token owner", async () => {
      await token.mint(COLONY_ACCOUNT, 1500000, { from: COLONY_ACCOUNT });

      let totalSupply = await token.totalSupply();
      expect(totalSupply).to.eq.BN(1500000);

      let balance = await token.balanceOf(COLONY_ACCOUNT);
      expect(balance).to.eq.BN(1500000);

      // Mint some more tokens
      await expectEvent(token.mint(COLONY_ACCOUNT, 1, { from: COLONY_ACCOUNT }), "Mint");
      totalSupply = await token.totalSupply();
      expect(totalSupply).to.eq.BN(1500001);

      balance = await token.balanceOf(COLONY_ACCOUNT);
      expect(balance).to.eq.BN(1500001);
    });

    it("should be able to mint new tokens directly to sender, when called by the Token owner", async () => {
      // How truffle supports function overloads apparently
      await token.methods["mint(uint256)"](1500000, { from: COLONY_ACCOUNT });

      const totalSupply = await token.totalSupply();
      expect(totalSupply).to.eq.BN(1500000);

      const balance = await token.balanceOf(COLONY_ACCOUNT);
      expect(balance).to.eq.BN(1500000);
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
      expect(totalSupply).to.be.zero;
    });

    it("should be able to burn others' tokens when they have approved them to do so", async () => {
      await token.mint(ACCOUNT_TWO, 1500000, { from: COLONY_ACCOUNT });
      await token.methods["approve(address,uint256)"](ACCOUNT_THREE, 500000, { from: ACCOUNT_TWO });
      // await token.approve(ACCOUNT_THREE, 500000, { FROM: ACCOUNT_TWO });
      // await token.burn(ACCOUNT_TWO, 500000, { from: ACCOUNT_THREE });
      await token.methods["burn(address,uint256)"](ACCOUNT_TWO, 500000, { from: ACCOUNT_THREE });

      const totalSupply = await token.totalSupply();
      expect(totalSupply).to.eq.BN(1000000);

      const balance = await token.balanceOf(ACCOUNT_TWO);
      expect(balance).to.eq.BN(1000000);
    });

    it("should be able to burn own tokens", async () => {
      // How truffle supports function overloads apparently
      await token.mint(ACCOUNT_TWO, 1500000, { from: COLONY_ACCOUNT });
      await token.methods["burn(address,uint256)"](ACCOUNT_TWO, 500000, { from: ACCOUNT_TWO });

      let totalSupply = await token.totalSupply();
      expect(totalSupply).to.eq.BN(1000000);

      let balance = await token.balanceOf(ACCOUNT_TWO);
      expect(balance).to.eq.BN(1000000);

      await token.methods["burn(uint256)"](1000000, { from: ACCOUNT_TWO });
      totalSupply = await token.totalSupply();
      expect(totalSupply).to.be.zero;

      balance = await token.balanceOf(ACCOUNT_TWO);
      expect(balance).to.be.zero;
    });

    it("should emit a Burn event when burning tokens", async () => {
      await token.methods["mint(uint256)"](1, { from: COLONY_ACCOUNT });
      await expectEvent(token.burn(1, { from: COLONY_ACCOUNT }), "Burn");
    });

    it("should be able to unlock token by owner", async () => {
      // Note: due to an apparent bug, we cannot call a parameterless function with transaction params, e.g. { from: senderAccount }
      // So change the owner to coinbase so we are able to call it without params
      await dsAuthToken.setOwner(accounts[0], { from: COLONY_ACCOUNT });
      await token.unlock();
      await dsAuthToken.setAuthority(ZERO_ADDRESS);

      const locked = await token.locked();
      expect(locked).to.be.false;

      const tokenAuthorityLocal = await token.authority();
      expect(tokenAuthorityLocal).to.equal(ZERO_ADDRESS);
    });

    it("shouldn't be able to unlock token by non-owner", async () => {
      await checkErrorRevert(token.unlock({ from: ACCOUNT_THREE }), "ds-auth-unauthorized");
      await checkErrorRevert(dsAuthToken.setAuthority(ZERO_ADDRESS, { from: ACCOUNT_THREE }), "ds-auth-unauthorized");

      const locked = await token.locked();
      expect(locked).to.be.true;
    });
  });

  describe("when working with ether transfers", () => {
    it("should NOT accept eth", async () => {
      await checkErrorRevert(token.send(2));
      const tokenBalance = await web3GetBalance(token.address);
      expect(tokenBalance).to.be.zero;
    });
  });
});
