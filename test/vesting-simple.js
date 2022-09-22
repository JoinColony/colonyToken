/* globals artifacts */

import chai from "chai";
import bnChai from "bn-chai";
import BN from "bn.js";

import { checkErrorRevert, currentBlockTime, forwardTime, makeTxAtTimestamp, startMining } from "../helpers/test-helper";

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
  const BASE = WAD.muln(100000);
  const GRANT = BASE.muln(5);
  const DURATION = 60 * 60 * 24 * 365 * 2;

  before(async () => {
    token = await Token.new("Colony Token", "CLNY", 18);
    token.unlock();
  });

  beforeEach(async () => {
    vesting = await VestingSimple.new(token.address, { from: USER0 });
  });

  describe("when initialised", () => {
    it("can fetch the storage variables", async () => {
      const tokenAddress = await vesting.token();
      // const initialClaimable = await vesting.initialClaimable();
      // const vestingDuration = await vesting.vestingDuration();
      const startTime = await vesting.startTime();

      expect(token.address).to.equal(tokenAddress);
      // expect(initialClaimable).to.eq.BN(BASE);
      // expect(vestingDuration).to.eq.BN(DURATION);
      expect(startTime).to.be.zero;
    });

    it("can set grants", async () => {
      await vesting.setGrant(USER1, WAD);

      const grant = await vesting.grants(USER1);
      expect(grant.amount).to.eq.BN(WAD);
      expect(grant.claimed).to.be.zero;
    });

    it("can set grants in bulk", async () => {
      await vesting.setGrants([USER0, USER1], [WAD.muln(2), WAD]);

      const grant0 = await vesting.grants(USER0);
      expect(grant0.amount).to.eq.BN(WAD.muln(2));

      const grant1 = await vesting.grants(USER1);
      expect(grant1.amount).to.eq.BN(WAD);
    });

    it("cannot set grants in bulk with mismatched arguments", async () => {
      await checkErrorRevert(vesting.setGrants([USER0, USER1], [WAD]), "vesting-simple-bad-inputs");
    });

    it("can edit grants", async () => {
      let grant;

      await vesting.setGrant(USER1, WAD);

      grant = await vesting.grants(USER1);
      expect(grant.amount).to.eq.BN(WAD);
      expect(grant.claimed).to.be.zero;

      await vesting.setGrant(USER1, WAD.divn(2));

      grant = await vesting.grants(USER1);
      expect(grant.amount).to.eq.BN(WAD.divn(2));
      expect(grant.claimed).to.be.zero;
    });

    it("can delete a grant by setting the amount to zero", async () => {
      let grant;

      await vesting.setGrant(USER1, WAD);

      grant = await vesting.grants(USER1);
      expect(grant.amount).to.eq.BN(WAD);
      expect(grant.claimed).to.be.zero;

      await vesting.setGrant(USER1, 0);

      grant = await vesting.grants(USER1);
      expect(grant.amount).to.be.zero;
      expect(grant.claimed).to.be.zero;
    });

    it("cannot set grants if not owner", async () => {
      await checkErrorRevert(vesting.setGrant(USER1, WAD, { from: USER1 }), "ds-auth-unauthorized");
    });

    it("cannot claim grants if not active", async () => {
      await vesting.setGrant(USER1, WAD);

      await checkErrorRevert(vesting.claimGrant({ from: USER1 }), "vesting-simple-nothing-to-claim");
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
    let startBlockTime;

    beforeEach(async () => {
      await token.mint(vesting.address, GRANT);

      await vesting.setGrant(USER1, GRANT);

      startBlockTime = await currentBlockTime();
      await makeTxAtTimestamp(vesting.activate, [], startBlockTime, this);
    });

    afterEach(async () => {
      // In case of errors
      await startMining();
    });

    it("can set the correct startTime", async () => {
      const startTime = await vesting.startTime();
      expect(startTime).to.eq.BN(startBlockTime);
    });

    it("cannot activate twice", async () => {
      await checkErrorRevert(vesting.activate(), "vesting-simple-already-active");
    });

    it("cannot claim a grant if the contract has no tokens", async () => {
      await vesting.withdraw(GRANT);

      await checkErrorRevert(vesting.claimGrant({ from: USER1 }), "ds-token-insufficient-balance");
    });

    it("cannot claim a non-existent grant", async () => {
      await checkErrorRevert(vesting.claimGrant({ from: USER0 }), "vesting-simple-nothing-to-claim");
    });

    it("can claim BASE number of tokens immediately", async () => {
      const balancePre = await token.balanceOf(USER1);

      const timestamp = await currentBlockTime();
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const balancePost = await token.balanceOf(USER1);
      expect(balancePost.sub(balancePre)).to.eq.BN(BASE);
    });

    it("can claim BASE + 1/2 of the remaining grant after six months", async () => {
      const balancePre = await token.balanceOf(USER1);

      let timestamp = await currentBlockTime();
      timestamp += DURATION / 2;
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const balancePost = await token.balanceOf(USER1);
      expect(balancePost.sub(balancePre)).to.eq.BN(GRANT.divn(5).muln(3));
    });

    it("can claim the entire grant after one year", async () => {
      const balancePre = await token.balanceOf(USER1);

      let timestamp = await currentBlockTime();
      timestamp += DURATION;
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const balancePost = await token.balanceOf(USER1);
      expect(balancePost.sub(balancePre)).to.eq.BN(GRANT);
    });

    it("can claim no more than the entire grant after two years", async () => {
      const balancePre = await token.balanceOf(USER1);

      let timestamp = await currentBlockTime();
      timestamp += DURATION * 2;
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const balancePost = await token.balanceOf(USER1);
      expect(balancePost.sub(balancePre)).to.eq.BN(GRANT);
    });

    it("cannot claim more tokens than they should", async () => {
      const balancePre = await token.balanceOf(USER1);

      const timestamp = await currentBlockTime();

      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const balancePost = await token.balanceOf(USER1);
      expect(balancePost.sub(balancePre)).to.eq.BN(BASE);

      await checkErrorRevert(makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this), "vesting-simple-nothing-to-claim");
    });

    it("can claim the grant in phases", async () => {
      const balance0 = await token.balanceOf(USER1);

      let timestamp = await currentBlockTime();
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const balance1 = await token.balanceOf(USER1);
      expect(balance1.sub(balance0)).to.eq.BN(BASE);

      timestamp += DURATION / 2;
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const balance2 = await token.balanceOf(USER1);
      expect(balance2.sub(balance1)).to.eq.BN(BASE.muln(2));

      timestamp += DURATION / 2;
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const balance3 = await token.balanceOf(USER1);
      expect(balance3.sub(balance2)).to.eq.BN(BASE.muln(2));

      timestamp += DURATION / 2;

      await checkErrorRevert(makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this), "vesting-simple-nothing-to-claim");
    });

    it("cannot set an amount below what has already been claimed", async () => {
      const timestamp = await currentBlockTime();
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const grant = await vesting.grants(USER1);
      expect(grant.claimed).to.eq.BN(BASE);

      await checkErrorRevert(vesting.setGrant(USER1, BASE.subn(1)), "vesting-simple-bad-amount");
    });

    it("can track the total amount of grants", async () => {
      let totalAmount;

      totalAmount = await vesting.totalAmount();
      expect(totalAmount).to.eq.BN(GRANT);

      await vesting.setGrant(USER0, WAD);
      totalAmount = await vesting.totalAmount();
      expect(totalAmount).to.eq.BN(GRANT.add(WAD));

      await vesting.setGrant(USER0, 0);
      totalAmount = await vesting.totalAmount();
      expect(totalAmount).to.eq.BN(GRANT);
    });

    it("can track the total amount claimed", async () => {
      await token.mint(vesting.address, GRANT);
      await vesting.setGrant(USER0, GRANT);

      await forwardTime(DURATION, this);

      let totalClaimed;

      await vesting.claimGrant({ from: USER0 });
      totalClaimed = await vesting.totalClaimed();
      expect(totalClaimed).to.eq.BN(GRANT);

      await vesting.claimGrant({ from: USER1 });
      totalClaimed = await vesting.totalClaimed();
      expect(totalClaimed).to.eq.BN(GRANT.muln(2));
    });

    it.skip("can vest immediately if given a vesting duration of 1", async () => {
      vesting = await VestingSimple.new(token.address, BASE, 1, { from: USER0 });
      await token.mint(vesting.address, GRANT);
      await vesting.setGrant(USER1, GRANT);
      await vesting.activate();

      const balance0 = await token.balanceOf(USER1);

      const timestamp = await currentBlockTime();
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp + 1, this);

      const balance1 = await token.balanceOf(USER1);
      expect(balance1.sub(balance0)).to.eq.BN(GRANT);
    });

    it.skip("can vest linearly if given an initial claimable of of 0", async () => {
      vesting = await VestingSimple.new(token.address, 0, DURATION, { from: USER0 });
      await token.mint(vesting.address, GRANT);
      await vesting.setGrant(USER1, GRANT);
      await vesting.activate();

      const balance0 = await token.balanceOf(USER1);

      let timestamp = await currentBlockTime();

      timestamp += DURATION / 2;
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const balance1 = await token.balanceOf(USER1);
      expect(balance1.sub(balance0)).to.eq.BN(GRANT.divn(2));

      timestamp += DURATION / 2;
      await makeTxAtTimestamp(vesting.claimGrant, [{ from: USER1 }], timestamp, this);

      const balance2 = await token.balanceOf(USER1);
      expect(balance2.sub(balance0)).to.eq.BN(GRANT);
    });
  });
});
