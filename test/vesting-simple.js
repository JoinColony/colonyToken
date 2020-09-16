/* globals artifacts */

import chai from "chai";
import bnChai from "bn-chai";
import BN from "bn.js";

import { checkErrorRevert, forwardTime } from "../helpers/test-helper";

const { expect } = chai;
chai.use(bnChai(web3.utils.BN));

const Token = artifacts.require("Token");
const VestingSimple = artifacts.require("VestingSimple");

contract("Vesting Simple", accounts => {
  let token;
  let vesting;

  const USER0 = accounts[0];
  const USER1 = accounts[1];

  const WAD = new BN(10).pow(new BN(18));

  const BASE = WAD.muln(250000);
  const GRANT = BASE.muln(5);

  const YEAR = 60 * 60 * 24 * 365;

  before(async () => {
    token = await Token.new("Colony Token", "CLNY", 18);
    token.unlock();
  });

  beforeEach(async () => {
    vesting = await VestingSimple.new(token.address, BASE, YEAR, { from: USER0 });
  });

  describe("when initialised", () => {
    it("can fetch the storage variables", async () => {
      const tokenAddress = await vesting.token();
      const base = await vesting.base();
      const period = await vesting.period();
      const isActive = await vesting.isActive();
      const startTime = await vesting.startTime();

      expect(token.address).to.equal(tokenAddress);
      expect(base).to.eq.BN(BASE);
      expect(period).to.eq.BN(YEAR);
      expect(isActive).to.be.false;
      expect(startTime).to.be.zero;
    });

    it("can set and view grants", async () => {
      await vesting.addGrant(USER1, WAD);

      const grant = await vesting.grants(USER1);
      expect(grant.amount).to.eq.BN(WAD);
      expect(grant.claimed).to.be.zero;
    });

    it("cannot set grants if not owner", async () => {
      await checkErrorRevert(vesting.addGrant(USER1, WAD, { from: USER1 }), "ds-auth-unauthorized");
    });

    it("cannot claim grants if not active", async () => {
      await vesting.addGrant(USER1, WAD);

      await checkErrorRevert(vesting.claimGrant({ from: USER1 }), "vesting-simple-not-active");
    });

    it("can withdraw tokens if owner", async () => {
      await token.mint(vesting.address, WAD);
      const balancePre = await token.balanceOf(USER0);

      await vesting.withdraw(WAD);

      const balancePost = await token.balanceOf(USER0);
      expect(balancePost.sub(balancePre)).to.eq.BN(WAD);
    });
  });

  describe("when active", () => {
    beforeEach(async () => {
      await token.mint(vesting.address, GRANT);

      await vesting.addGrant(USER1, GRANT);
      await vesting.activate();
    });

    it("cannot set grants once active", async () => {
      await checkErrorRevert(vesting.addGrant(USER1, WAD), "vesting-simple-already-active");
    });

    it("can claim BASE number of tokens immediately", async () => {
      const balancePre = await token.balanceOf(USER1);

      await vesting.claimGrant({ from: USER1 });

      const balancePost = await token.balanceOf(USER1);
      expect(balancePost.sub(balancePre)).to.eq.BN(BASE);
    });

    it("can claim BASE + 1/2 of the remaining grant after six months", async () => {
      const balancePre = await token.balanceOf(USER1);

      await forwardTime(YEAR / 2, this);
      await vesting.claimGrant({ from: USER1 });

      const balancePost = await token.balanceOf(USER1);
      expect(balancePost.sub(balancePre)).to.eq.BN(GRANT.divn(5).muln(3));
    });

    it("can claim the entire grant after one year", async () => {
      const balancePre = await token.balanceOf(USER1);

      await forwardTime(YEAR, this);
      await vesting.claimGrant({ from: USER1 });

      const balancePost = await token.balanceOf(USER1);
      expect(balancePost.sub(balancePre)).to.eq.BN(GRANT);
    });

    it("can claim no more than the entire grant after two years", async () => {
      const balancePre = await token.balanceOf(USER1);

      await forwardTime(YEAR * 2, this);
      await vesting.claimGrant({ from: USER1 });

      const balancePost = await token.balanceOf(USER1);
      expect(balancePost.sub(balancePre)).to.eq.BN(GRANT);
    });

    it("cannot claim more tokens than they should", async () => {
      const balancePre = await token.balanceOf(USER1);

      await vesting.claimGrant({ from: USER1 });

      const balancePost = await token.balanceOf(USER1);
      expect(balancePost.sub(balancePre)).to.eq.BN(BASE);

      await checkErrorRevert(vesting.claimGrant({ from: USER1 }), "vesting-simple-nothing-to-claim");
    });

    it("can claim the grant in phases", async () => {
      const balance0 = await token.balanceOf(USER1);

      await vesting.claimGrant({ from: USER1 });

      const balance1 = await token.balanceOf(USER1);
      expect(balance1.sub(balance0)).to.eq.BN(BASE);

      await forwardTime(YEAR / 2, this);
      await vesting.claimGrant({ from: USER1 });

      const balance2 = await token.balanceOf(USER1);
      expect(balance2.sub(balance1)).to.eq.BN(BASE.muln(2));

      await forwardTime(YEAR / 2, this);
      await vesting.claimGrant({ from: USER1 });

      const balance3 = await token.balanceOf(USER1);
      expect(balance3.sub(balance2)).to.eq.BN(BASE.muln(2));

      await forwardTime(YEAR / 2, this);

      await checkErrorRevert(vesting.claimGrant({ from: USER1 }), "vesting-simple-nothing-to-claim");
    });
  });
});
