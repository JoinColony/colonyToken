/* globals artifacts */

import BN from "bn.js";
import chai from "chai";
import bnChai from "bn-chai";

import { checkErrorRevert } from "../helpers/test-helper";

const { expect } = chai;
chai.use(bnChai(web3.utils.BN));

const DSTokenBase = artifacts.require("DSTokenBase");
const TokenAuthority = artifacts.require("TokenAuthority");
const WrappedToken = artifacts.require("WrappedToken");

contract("Wrapped Token", accounts => {
  let token;
  let wrappedToken;

  const USER0 = accounts[0];
  const USER1 = accounts[1];
  const USER2 = accounts[2];

  const WAD = new BN(10).pow(new BN(18));

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach(async () => {
    token = await DSTokenBase.new(WAD, { from: USER0 });
    wrappedToken = await WrappedToken.new(token.address);

    const tokenAuthority = await TokenAuthority.new(wrappedToken.address, ZERO_ADDRESS, [USER2]);
    await wrappedToken.setAuthority(tokenAuthority.address);
  });

  describe("wrapping tokens", () => {
    it("should be able to wrap and unwrap tokens", async () => {
      await wrappedToken.unlock();

      await token.approve(wrappedToken.address, WAD, { from: USER0 });

      let balance;

      balance = await token.balanceOf(USER0);
      expect(balance).to.eq.BN(WAD);
      balance = await wrappedToken.balanceOf(USER0);
      expect(balance).to.be.zero;

      await wrappedToken.deposit(WAD, { from: USER0 });

      balance = await token.balanceOf(USER0);
      expect(balance).to.be.zero;
      balance = await wrappedToken.balanceOf(USER0);
      expect(balance).to.eq.BN(WAD);

      await wrappedToken.withdraw(WAD, { from: USER0 });

      balance = await token.balanceOf(USER0);
      expect(balance).to.eq.BN(WAD);
      balance = await wrappedToken.balanceOf(USER0);
      expect(balance).to.be.zero;
    });

    it("should be able to transfer wrapped tokens", async () => {
      await wrappedToken.unlock();

      await token.approve(wrappedToken.address, WAD, { from: USER0 });
      await wrappedToken.deposit(WAD, { from: USER0 });

      let balance;

      balance = await wrappedToken.balanceOf(USER0);
      expect(balance).to.eq.BN(WAD);
      balance = await wrappedToken.balanceOf(USER1);
      expect(balance).to.be.zero;

      await wrappedToken.transfer(USER1, WAD);

      balance = await wrappedToken.balanceOf(USER0);
      expect(balance).to.be.zero;
      balance = await wrappedToken.balanceOf(USER1);
      expect(balance).to.eq.BN(WAD);
    });

    it("owner can wrap tokens while locked", async () => {
      await token.approve(wrappedToken.address, WAD, { from: USER0 });
      await wrappedToken.deposit(WAD, { from: USER0 });

      const balance = await wrappedToken.balanceOf(USER0);
      expect(balance).to.eq.BN(WAD);

      // Non-owner cannot
      await checkErrorRevert(wrappedToken.deposit(WAD, { from: USER1 }), "colony-token-unauthorised");
      await checkErrorRevert(wrappedToken.deposit(WAD, { from: USER2 }), "colony-token-unauthorised");
    });

    it("cannot wrap tokens that don't exist", async () => {
      await token.approve(wrappedToken.address, WAD.addn(1), { from: USER0 });

      await checkErrorRevert(wrappedToken.deposit(WAD.addn(1), { from: USER0 }), "ds-token-insufficient-balance");
    });

    it("cannot unwrap tokens that don't exist", async () => {
      await checkErrorRevert(wrappedToken.withdraw(WAD, { from: USER0 }), "ds-math-sub-underflow");
    });

    it("cannot unwrap tokens while locked, unless authorized", async () => {
      // Authorised, as owner
      await checkErrorRevert(wrappedToken.withdraw(WAD, { from: USER0 }), "ds-math-sub-underflow");

      // Not authorised
      await checkErrorRevert(wrappedToken.withdraw(WAD, { from: USER1 }), "colony-token-unauthorised");

      // Not authorised (authority only allows transferring)
      await checkErrorRevert(wrappedToken.withdraw(WAD, { from: USER2 }), "colony-token-unauthorised");
    });

    it("cannot transfer tokens while locked, unless authorized", async () => {
      // Authorised, as owner
      await checkErrorRevert(wrappedToken.transfer(USER0, WAD, { from: USER0 }), "ds-token-insufficient-balance");

      // Not authorised
      await checkErrorRevert(wrappedToken.transfer(USER1, WAD, { from: USER1 }), "colony-token-unauthorised");

      // Authorised, by token authority
      await checkErrorRevert(wrappedToken.transfer(USER2, WAD, { from: USER2 }), "ds-token-insufficient-balance");
    });
  });
});
