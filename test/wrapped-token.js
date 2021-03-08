/* globals artifacts */

import BN from "bn.js";
import chai from "chai";
import bnChai from "bn-chai";

import { checkErrorRevert } from "../helpers/test-helper";

const { expect } = chai;
chai.use(bnChai(web3.utils.BN));

const Token = artifacts.require("Token");
const TokenAuthority = artifacts.require("TokenAuthority");
const WrappedToken = artifacts.require("WrappedToken");

contract("Wrapped Token", accounts => {
  const USER0 = accounts[0];
  const USER1 = accounts[1];

  const WAD = new BN(10).pow(new BN(18));
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  let token;
  let wrappedToken;

  beforeEach(async () => {
    token = await Token.new("Colony token", "CLNY", 18);
    wrappedToken = await WrappedToken.new(token.address);

    const tokenAuthority = await TokenAuthority.new(token.address, ZERO_ADDRESS, [wrappedToken.address]);
    await token.setAuthority(tokenAuthority.address);
  });

  describe("wrapping tokens", () => {
    it("should be able to wrap and unwrap tokens", async () => {
      await wrappedToken.unlock();

      await token.mint(USER0, WAD, { from: USER0 });
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

      await token.mint(USER0, WAD, { from: USER0 });
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

    it("cannot wrap tokens that don't exist", async () => {
      await token.approve(wrappedToken.address, WAD, { from: USER0 });

      await checkErrorRevert(wrappedToken.deposit(WAD, { from: USER0 }), "ds-token-insufficient-balance");
    });

    it("cannot unwrap tokens that don't exist", async () => {
      await checkErrorRevert(wrappedToken.withdraw(WAD, { from: USER0 }), "ds-math-sub-underflow");
    });

    it("cannot unwrap tokens while locked, unless authorized", async () => {
      await checkErrorRevert(wrappedToken.withdraw(WAD, { from: USER1 }), "colony-token-unauthorised");
      await checkErrorRevert(wrappedToken.withdraw(WAD, { from: USER0 }), "ds-math-sub-underflow");
    });

    it("cannot transfer tokens while locked, unless authorized", async () => {
      await checkErrorRevert(wrappedToken.transfer(USER0, WAD, { from: USER1 }), "colony-token-unauthorised");
      await checkErrorRevert(wrappedToken.transfer(USER1, WAD, { from: USER0 }), "ds-token-insufficient-balance");
    });
  });
});
